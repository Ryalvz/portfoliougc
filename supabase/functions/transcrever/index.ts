// =============================================================
// AJUDANTE "transcrever" (Supabase Edge Function)
// Recebe o link de um vídeo (YouTube, Instagram, TikTok), pede a
// transcrição ao Supadata e devolve o texto para o painel admin.
//
// A chave do Supadata NÃO fica aqui: ela é lida do cofre do Supabase
// (Edge Functions > Secrets), com o nome SUPADATA_API_KEY.
// Só o seu login (heyryan.ugc@gmail.com) consegue usar este ajudante.
// =============================================================

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const SUPADATA = "https://api.supadata.ai/v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Junta o texto, venha ele como texto puro ou em pedaços
function juntarTexto(dados: any): string {
  const c = dados?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p: any) => p?.text ?? "").join(" ").replace(/\s+/g, " ").trim();
  return "";
}

function erroSupadata(status: number, corpo: any): string {
  const msg = String(corpo?.message || corpo?.error || corpo?.details || "");
  if (status === 401 || status === 403) return "A chave do Supadata está errada ou faltando. Confira o SUPADATA_API_KEY no Supabase.";
  if (status === 402) return "Os créditos grátis do Supadata deste mês acabaram. Eles voltam no mês que vem, ou dá para assinar um plano.";
  if (status === 404) return "Não encontrei esse vídeo. Ele pode ser privado, ter sido apagado ou o link está incompleto.";
  if (status === 429) return "Muitos pedidos seguidos. Espere um minuto e tente de novo.";
  if (status === 400) return "Esse link não é aceito. Use o link completo do vídeo (YouTube, Instagram ou TikTok).";
  return "O Supadata não conseguiu transcrever agora" + (msg ? ` (${msg})` : "") + ". Tente de novo em instantes.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);

  // 1. Confere que quem pediu é o Ryan logado
  const url = Deno.env.get("SUPABASE_URL");
  const apikey = req.headers.get("apikey") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey, Authorization: auth } });
    const usuario = r.ok ? await r.json() : null;
    if (!usuario || String(usuario.email || "").toLowerCase() !== EMAIL_ADMIN) {
      return resposta({ erro: "Só o dono do painel pode transcrever. Saia e entre de novo." }, 401);
    }
  } catch (_) {
    return resposta({ erro: "Não deu para conferir o seu login. Tente de novo." }, 401);
  }

  // 2. Lê o link
  let link = "";
  try { link = String((await req.json())?.link || "").trim(); } catch (_) { /* corpo vazio */ }
  if (!/^https?:\/\//i.test(link)) return resposta({ erro: "Link inválido." }, 400);

  const chave = Deno.env.get("SUPADATA_API_KEY");
  if (!chave) return resposta({ erro: "Falta guardar a chave do Supadata no Supabase (Edge Functions > Secrets > SUPADATA_API_KEY)." }, 500);

  // 3. Pede a transcrição (prefere português; se o vídeo não tiver, vem no idioma original)
  const pedido = `${SUPADATA}/transcript?url=${encodeURIComponent(link)}&lang=pt&text=true&mode=auto`;
  let r = await fetch(pedido, { headers: { "x-api-key": chave } });
  let dados: any = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 202) return resposta({ erro: erroSupadata(r.status, dados) }, 200);

  // 4. Vídeo sem legenda: o Supadata gera com IA e devolve um número de pedido. Espera ficar pronto.
  if (dados?.jobId) {
    const job = dados.jobId;
    for (let i = 0; i < 50; i++) {
      await espera(2500);
      r = await fetch(`${SUPADATA}/transcript/${encodeURIComponent(job)}`, { headers: { "x-api-key": chave } });
      dados = await r.json().catch(() => ({}));
      if (!r.ok) return resposta({ erro: erroSupadata(r.status, dados) }, 200);
      if (dados?.status === "failed") return resposta({ erro: "O Supadata não conseguiu ouvir esse vídeo. Ele pode não ter fala." }, 200);
      if (dados?.status === "completed" || dados?.content) break;
    }
    if (!dados?.content) return resposta({ erro: "A transcrição está demorando mais que o normal. Tente de novo em um minuto." }, 200);
  }

  const texto = juntarTexto(dados);
  if (!texto) return resposta({ erro: "Esse vídeo não tem fala para transcrever." }, 200);
  return resposta({ texto, idioma: String(dados?.lang || "").slice(0, 2) });
});
