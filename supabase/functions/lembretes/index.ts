// =============================================================
// AJUDANTE "lembretes" (Supabase Edge Function)
// Confere o painel e manda notificação para o celular do Ryan:
//   tipo "diario" (todo dia, 9h): resumo do que está pendente
//   tipo "quarta" (quarta, 18h): repasse do TikTok Shop não lançado
//   acao "teste" (botão no painel, só com o login do Ryan)
//   GET: devolve a chave pública que o celular usa para se inscrever
//
// Nenhuma chave secreta fica aqui. A chave de assinatura das
// notificações é criada na primeira vez e guardada na tabela
// config_privada, que só este ajudante consegue ler.
// Cada resumo é mandado no máximo uma vez por dia.
// =============================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const URL_BANCO = Deno.env.get("SUPABASE_URL")!;
// Chave interna que o próprio Supabase entrega ao ajudante (não fica escrita em lugar nenhum)
function chaveInterna() {
  const nova = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (nova) { try { const k = Object.values(JSON.parse(nova))[0]; if (k) return String(k); } catch (_) { /* segue */ } }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const db = createClient(URL_BANCO, chaveInterna(), { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ---------- Datas no horário de Brasília ---------- */
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somaDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaSemana = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay();
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const ultimaQuarta = (hoje: string) => somaDias(hoje, -((diaSemana(hoje) - 3 + 7) % 7));
const br = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/* ---------- Chaves das notificações (criadas uma vez, guardadas no banco) ---------- */
let chavePublica = "";
async function prepararChaves() {
  if (chavePublica) return chavePublica;
  const ler = async () => (await db.from("config_privada").select("chave,valor").in("chave", ["vapid_publica", "vapid_privada"])).data || [];
  let linhas = await ler();
  if (linhas.length < 2) {
    const k = webpush.generateVAPIDKeys();
    await db.from("config_privada").upsert(
      [{ chave: "vapid_publica", valor: k.publicKey }, { chave: "vapid_privada", valor: k.privateKey }],
      { onConflict: "chave", ignoreDuplicates: true });
    linhas = await ler();
  }
  const pub = linhas.find((x) => x.chave === "vapid_publica")!.valor;
  const priv = linhas.find((x) => x.chave === "vapid_privada")!.valor;
  webpush.setVapidDetails("mailto:" + EMAIL_ADMIN, pub, priv);
  chavePublica = pub;
  return pub;
}

/* ---------- As mesmas regras dos lembretes do painel ---------- */
const NEGOCIACAO = ["Em negociação", "Assinatura de contrato"];
const PRODUCAO = ["Aguardando briefing", "Roteiro em andamento", "Aguardando aprovação de roteiro", "Gravando", "Editando", "Enviado p/ aprovação"];
const DINHEIRO = ["Entregue", "Nota fiscal enviada", "Aguardando pagamento", "Pago"];

type Lembrete = { tipo: string; texto: string };
async function calcularLembretes(hoje: string): Promise<Lembrete[]> {
  const [contratos, comissoes, adiados] = await Promise.all([
    db.from("contratos").select("*").then((r) => r.data || []),
    db.from("comissoes_ttk").select("data").then((r) => r.data || []),
    db.from("lembretes_adiados").select("chave,ate").then((r) => r.data || []),
  ]);
  const adiado = (k: string) => adiados.some((a) => a.chave === k && a.ate >= hoje);
  const L: Lembrete[] = [];

  const quarta = ultimaQuarta(hoje);
  if (!comissoes.some((x) => String(x.data).slice(0, 10) === quarta) && !adiado("ttk-" + quarta)) {
    L.push({ tipo: "ttk", texto: quarta === hoje ? "Lançar o repasse do TikTok Shop de hoje" : `Lançar o repasse do TikTok Shop de quarta ${br(quarta)}` });
  }

  for (const c of contratos) {
    const fechado = PRODUCAO.includes(c.status) || DINHEIRO.includes(c.status);
    const recebido = (Number(c.parcela1) || 0) + (Number(c.parcela2) || 0);
    const saldo = fechado ? Math.max(0, (Number(c.valor) || 0) - recebido) : 0;
    const prev = c.data_nf && c.prazo_dias != null ? somaDias(String(c.data_nf).slice(0, 10), Number(c.prazo_dias)) : null;
    const aberto = fechado && c.status !== "Pago" && saldo > 0;

    if (aberto && prev && prev < hoje) {
      if (!adiado(`vencido-${c.id}`)) L.push({ tipo: "vencido", texto: `${c.cliente}: venceu há ${diasEntre(prev, hoje)} dias (${real(saldo)}). Já pagou?` });
      continue;
    }
    if (aberto && prev && prev >= hoje && prev <= somaDias(hoje, 2) && !adiado(`vence-${c.id}-${prev}`)) {
      L.push({ tipo: "vence", texto: `${c.cliente}: paga ${prev === hoje ? "hoje" : "até " + br(prev)} (${real(saldo)})` });
    }
    if (c.status === "Entregue" && !c.data_nf && saldo > 0 && !adiado(`nota-${c.id}`)) {
      L.push({ tipo: "nota", texto: `${c.cliente}: entregue e sem nota fiscal` });
    }
    if (PRODUCAO.includes(c.status) && c.prazo_entrega && c.prazo_entrega <= somaDias(hoje, 1) && !adiado(`entrega-${c.id}-${c.prazo_entrega}`)) {
      const d = diasEntre(hoje, c.prazo_entrega);
      L.push({ tipo: "entrega", texto: `${c.cliente}: ${d < 0 ? `entrega atrasada há ${-d} dias` : d === 0 ? "entrega hoje" : "entrega amanhã"}` });
    }
    if (NEGOCIACAO.includes(c.status) && c.criado_em && diasEntre(String(c.criado_em).slice(0, 10), hoje) >= 5 && !adiado(`negocia-${c.id}`)) {
      L.push({ tipo: "negocia", texto: `${c.cliente}: em negociação há ${diasEntre(String(c.criado_em).slice(0, 10), hoje)} dias. Fez follow-up?` });
    }
  }
  return L;
}

function montarNotificacao(L: Lembrete[]) {
  if (L.length === 1 && L[0].tipo === "ttk") {
    return { titulo: "Dia de TikTok Shop", corpo: "Lance no painel o repasse que caiu. Leva 10 segundos.", url: "./#financeiro", total: 1 };
  }
  const linhas = L.slice(0, 4).map((x) => "• " + x.texto);
  if (L.length > 4) linhas.push(`e mais ${L.length - 4}`);
  return {
    titulo: L.length === 1 ? "1 lembrete do seu painel" : `${L.length} lembretes do seu painel`,
    corpo: linhas.join("\n"),
    url: "./#financeiro",
    total: L.length,
  };
}

async function enviar(conteudo: Record<string, unknown>) {
  await prepararChaves();
  const { data: aparelhos } = await db.from("push_inscricoes").select("endpoint,inscricao");
  let enviados = 0;
  const erros: string[] = [];
  for (const a of aparelhos || []) {
    try {
      await webpush.sendNotification(a.inscricao, JSON.stringify(conteudo), { TTL: 60 * 60 * 12 });
      enviados++;
    } catch (e: any) {
      // Aparelho que desinstalou o app ou tirou a permissão: sai da lista
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_inscricoes").delete().eq("endpoint", a.endpoint);
      else erros.push(String(e?.statusCode || "") + " " + String(e?.body || e?.message || e));
    }
  }
  return { aparelhos: (aparelhos || []).length, enviados, erros };
}

async function ehOAdmin(req: Request) {
  try {
    const r = await fetch(`${URL_BANCO}/auth/v1/user`, {
      headers: { apikey: req.headers.get("apikey") ?? "", Authorization: req.headers.get("authorization") ?? "" },
    });
    const u = r.ok ? await r.json() : null;
    return !!u && String(u.email || "").toLowerCase() === EMAIL_ADMIN;
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method === "GET") return resposta({ chave_publica: await prepararChaves() });
    if (req.method !== "POST") return resposta({ erro: "Use GET ou POST." }, 405);

    let corpo: any = {};
    try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }
    const hoje = hojeSP();

    // Botão "Mandar notificação de teste" do painel
    if (corpo.acao === "teste") {
      if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode testar. Saia e entre de novo." }, 401);
      const L = await calcularLembretes(hoje);
      const conteudo = L.length ? montarNotificacao(L) : { titulo: "Notificações ligadas", corpo: "Tudo certo! Quando tiver algo pendente, o aviso chega aqui.", url: "./", total: 0 };
      return resposta({ ...(await enviar(conteudo)), lembretes: L.length });
    }

    // Relógio do Supabase (cron): no máximo um resumo de cada tipo por dia
    const tipo = corpo.tipo === "quarta" ? "quarta" : "diario";
    if (tipo === "quarta" && diaSemana(hoje) !== 3) return resposta({ pulado: "hoje não é quarta" });
    const { error: repetido } = await db.from("lembretes_enviados").insert({ chave: `${tipo}-${hoje}` });
    if (repetido) return resposta({ pulado: "já mandado hoje" });

    let L = await calcularLembretes(hoje);
    if (tipo === "quarta") L = L.filter((x) => x.tipo === "ttk");
    if (!L.length) return resposta({ pulado: "nada pendente" });
    return resposta({ ...(await enviar(montarNotificacao(L))), lembretes: L.length });
  } catch (e: any) {
    console.error(e);
    return resposta({ erro: String(e?.message || e) }, 500);
  }
});
