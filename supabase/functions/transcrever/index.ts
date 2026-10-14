// =============================================================
// AJUDANTE "transcrever" (Supabase Edge Function)
// Pede à Supadata a transcrição de um vídeo (YouTube, Instagram,
// TikTok) para a aba Roteiros do painel.
//
// A chave da Supadata NÃO fica aqui: ela é lida do cofre do Supabase
// (Edge Functions > Secrets), com o nome SUPADATA_API_KEY.
// Só o seu login (heyryan.ugc@gmail.com) consegue usar este ajudante.
//
// acao "iniciar" { link }: pede a transcrição. Devolve o texto na hora
//   ou um jobId (vídeo que precisa ser ouvido pela IA).
// acao "job" { jobId }: consulta UMA vez se o jobId já ficou pronto.
//   Quem espera e repete a cada 5 segundos é o painel (até 6 minutos),
//   assim o ajudante nunca estoura o tempo do Supabase.
// acao "saldo": créditos usados no mês ({ plano, usados, total }).
// Erros voltam como { erro, tipo }:
//   sem-chave, chave-errada, cota (créditos do mês acabaram),
//   ritmo (muitas chamadas seguidas), sem-fala, nao-achou, link, outro
// =============================================================

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const SUPADATA = "https://api.supadata.ai/v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Junta o texto, venha ele como texto puro ou em pedaços { text, offset, duration }
function juntarTexto(dados: any): string {
  const c = dados?.content;
  if (typeof c === "string") return c.trim();
  if (Array.isArray(c)) return c.map((p: any) => p?.text ?? "").join(" ").replace(/\s+/g, " ").trim();
  return "";
}
const trechos = (dados: any) => Array.isArray(dados?.content) ? dados.content.slice(0, 2000) : null;

// Traduz o erro da Supadata para português simples, com um "tipo" para o painel
function erroSupadata(status: number, corpo: any) {
  const codigo = String(corpo?.error || "").toLowerCase();
  const detalhe = String(corpo?.details || "") + " " + String(corpo?.message || "");
  if (codigo === "limit-exceeded" || status === 429 || status === 402) {
    if (/plan usage|usage limit|credits/i.test(detalhe) || status === 402)
      return { tipo: "cota", erro: "Os créditos da Supadata deste mês acabaram. Eles voltam no começo do mês que vem (ou dá para assinar um plano no site deles)." };
    return { tipo: "ritmo", erro: "Foram muitos pedidos seguidos. Espere 1 minutinho e tente de novo." };
  }
  if (status === 401 || status === 403 || codigo === "unauthorized")
    return { tipo: "chave-errada", erro: "A chave da Supadata guardada no Supabase não está funcionando. Gere outra no site da Supadata e cole de novo em Edge Functions > Secrets > SUPADATA_API_KEY." };
  if (status === 206 || codigo === "transcript-unavailable")
    return { tipo: "sem-fala", erro: "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela." };
  if (status === 404 || codigo === "not-found")
    return { tipo: "nao-achou", erro: "Não encontrei esse vídeo. Ele pode ser privado, ter sido apagado ou o link está incompleto." };
  if (status === 400 || codigo === "invalid-request")
    return { tipo: "link", erro: "Esse link não é aceito. Use o link completo do vídeo (Instagram, TikTok ou YouTube)." };
  return { tipo: "outro", erro: "A Supadata não conseguiu transcrever agora. Tente de novo em instantes." };
}

// Resposta com texto: confere se veio fala de verdade
function comTexto(dados: any) {
  const texto = juntarTexto(dados);
  const idioma = String(dados?.lang || "").slice(0, 2);
  if (!texto || dados?.lang === "none")
    return { tipo: "sem-fala", erro: "Não achei fala nesse vídeo. Costuma ser reel só com música ou só com texto na tela." };
  return { texto, idioma, segmentos: trechos(dados) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  // 1. Confere que quem pediu é o Ryan logado
  const url = Deno.env.get("SUPABASE_URL");
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: req.headers.get("apikey") ?? "", Authorization: req.headers.get("authorization") ?? "" } });
    const usuario = r.ok ? await r.json() : null;
    if (!usuario || String(usuario.email || "").toLowerCase() !== EMAIL_ADMIN)
      return resposta({ erro: "Só o dono do painel pode transcrever. Saia e entre de novo.", tipo: "login" }, 401);
  } catch (_) {
    return resposta({ erro: "Não deu para conferir o seu login. Tente de novo.", tipo: "login" }, 401);
  }

  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }
  const acao = corpo.acao || (corpo.link ? "iniciar" : "");

  const chave = Deno.env.get("SUPADATA_API_KEY");
  if (!chave) return resposta({ tipo: "sem-chave", erro: "Falta a chave da Supadata. Crie uma conta grátis em supadata.ai (100 créditos por mês, sem cartão), copie a API key e cole no Supabase em Edge Functions > Secrets, com o nome SUPADATA_API_KEY." });
  const pedir = (caminho: string) => fetch(SUPADATA + caminho, { headers: { "x-api-key": chave } });

  try {
    // Saldo do mês (é o único que responde mesmo com a cota acabada)
    if (acao === "saldo") {
      const r = await pedir("/me");
      const d: any = await r.json().catch(() => ({}));
      if (!r.ok) return resposta(erroSupadata(r.status, d));
      return resposta({ plano: d.plan || "", usados: Number(d.usedCredits) || 0, total: Number(d.maxCredits) || 0 });
    }

    // Consulta um pedido que ainda está sendo ouvido
    if (acao === "job") {
      const job = String(corpo.jobId || "");
      if (!job) return resposta({ tipo: "outro", erro: "Faltou o número do pedido." });
      const r = await pedir(`/transcript/${encodeURIComponent(job)}`);
      const d: any = await r.json().catch(() => ({}));
      if (!r.ok) return resposta(erroSupadata(r.status, d));
      if (d?.status === "failed") return resposta({ tipo: "sem-fala", erro: "A Supadata não conseguiu ouvir esse vídeo. Ele pode não ter fala." });
      if (d?.status === "completed" || d?.content !== undefined) return resposta(comTexto(d));
      return resposta({ processando: true, status: d?.status || "queued" });
    }

    // Pede a transcrição (mode=auto: usa a legenda se tiver, senão a IA ouve; lang=pt: nunca traduz para o inglês)
    const link = String(corpo.link || "").trim();
    if (!/^https?:\/\//i.test(link)) return resposta({ tipo: "link", erro: "Esse link não parece de um vídeo. Ele precisa começar com https://" });
    const r = await pedir(`/transcript?url=${encodeURIComponent(link)}&mode=auto&text=true&lang=pt`);
    const d: any = await r.json().catch(() => ({}));
    if (r.status === 202 || d?.jobId) return resposta({ jobId: d.jobId });
    if (!r.ok || r.status === 206) return resposta(erroSupadata(r.status, d));
    return resposta(comTexto(d));
  } catch (e: any) {
    console.error(e);
    return resposta({ tipo: "outro", erro: "A internet do Supabase falhou falando com a Supadata. Tente de novo." });
  }
});
