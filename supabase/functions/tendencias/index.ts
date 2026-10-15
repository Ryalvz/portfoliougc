// =============================================================
// AJUDANTE "tendencias" (Supabase Edge Function)
// Busca os reels públicos com mais views do seu nicho, por hashtag,
// usando o Apify (plano grátis: US$ 5 por mês, sem cartão; quando
// o crédito acaba, ele bloqueia em vez de cobrar).
//
// A chave do Apify NÃO fica aqui: ela fica no cofre do Supabase
// (Edge Functions > Secrets) com o nome APIFY_TOKEN.
//
// tipo "semanal" (o relógio de toda segunda chama): começa a busca
//   da semana e, quando o Apify termina, guarda os 30 melhores.
//   Só faz UMA busca por semana, então chamar de novo não gasta nada.
// acao "status" (painel): hashtags, andamento e quanto do crédito
//   do mês já foi usado. Se tiver busca rodando, confere e guarda.
// acao "buscar" (painel): busca agora (no máximo 1 a cada 6 horas).
// acao "hashtags" (painel): salva a lista de hashtags.
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const URL_BANCO = Deno.env.get("SUPABASE_URL")!;
const APIFY = "https://api.apify.com/v2";
const ATOR = "apify~instagram-hashtag-scraper";
const QUANTOS = 30;

function chaveInterna() {
  const nova = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (nova) { try { const k = Object.values(JSON.parse(nova))[0]; if (k) return String(k); } catch (_) { /* segue */ } }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const db = createClient(URL_BANCO, chaveInterna(), { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

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

// Segunda-feira da semana (horário de Brasília), ex.: 2026-10-12
function segundaDaSemana() {
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = (hoje.getDay() + 6) % 7;
  hoje.setDate(hoje.getDate() - dia);
  return hoje.toLocaleDateString("sv-SE");
}

async function apify(caminho: string, chave: string, init: RequestInit = {}) {
  const r = await fetch(APIFY + caminho, { ...init, headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", ...(init.headers || {}) } });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = String(j?.error?.message || j?.error?.type || `Erro ${r.status}`);
    if (r.status === 401) throw new Error("A chave do Apify não está funcionando. Copie de novo em console.apify.com > Settings > API & Integrations e cole no Supabase em Edge Functions > Secrets > APIFY_TOKEN.");
    if (r.status === 402 || /usage|limit|credit|balance/i.test(msg)) throw new Error("O crédito grátis do Apify deste mês acabou. Ele volta sozinho no começo do próximo ciclo (sem cobrar nada).");
    throw new Error("O Apify respondeu com erro: " + msg);
  }
  return j;
}

async function lerConfig() {
  const { data } = await db.from("ig_pesquisa").select("*").eq("id", 1).maybeSingle();
  return data || { hashtags: [], por_hashtag: 25 };
}

// Começa uma busca no Apify (não espera terminar)
async function comecar(chave: string, cfg: any) {
  const hashtags = (cfg.hashtags || []).map((h: string) => String(h).replace(/^#/, "").trim()).filter(Boolean).slice(0, 12);
  if (!hashtags.length) throw new Error("Coloque pelo menos uma hashtag.");
  const limite = Math.min(60, Math.max(5, Number(cfg.por_hashtag) || 25));
  const maximo = hashtags.length * limite;
  // maxItems e maxTotalChargeUsd: travas para nunca passar do previsto
  const j = await apify(`/acts/${ATOR}/runs?maxItems=${maximo}&maxTotalChargeUsd=1`, chave, {
    method: "POST",
    body: JSON.stringify({ hashtags, resultsType: "reels", resultsLimit: limite }),
  });
  const runId = j?.data?.id;
  if (!runId) throw new Error("O Apify não devolveu o número da busca.");
  await db.from("ig_pesquisa").update({ run_id: runId, iniciado_em: new Date().toISOString(), erro: null }).eq("id", 1);
  return runId;
}

// Legenda em português? (o nicho é Brasil: reels gringos não entram)
const MARCAS_PT = /[ãõç]|\b(você|voce|vc|não|nao|isso|também|tambem|muito|fazer|pra|meu|minha|seu|sua|quem|agora|aqui|então|entao|porque|dicas?|marca|vídeo|video|conteúdo|conteudo|em|com|essa|esse|mais|ainda|gente|sempre|nunca|olha|vem|tá)\b/i;
const MARCAS_FORA = /[\u0400-\u04FF¿¡ñ]|\b(the|and|this|your|with|und|der|die|das|che|della|para ti|está|cómo|también|usted|aquí)\b/i;
const ehPortugues = (t: string) => { const x = String(t || ""); return MARCAS_PT.test(x) && !(MARCAS_FORA.test(x) && !/[ãõ]|\b(você|voce|não|nao)\b/i.test(x)); };

const numero = (...v: any[]) => { for (const x of v) { const n = Number(x); if (Number.isFinite(n) && n > 0) return Math.round(n); } return 0; };

// Confere a busca que está rodando; se terminou, guarda os 30 melhores
async function conferir(chave: string, cfg: any) {
  if (!cfg.run_id) return { rodando: false };
  const run = (await apify(`/actor-runs/${cfg.run_id}`, chave))?.data || {};
  const st = String(run.status || "");
  if (["READY", "RUNNING"].includes(st)) return { rodando: true };
  if (st !== "SUCCEEDED") {
    const erro = st === "TIMED-OUT" ? "A busca demorou demais e parou. Tente de novo." : "A busca não deu certo no Apify. Tente de novo mais tarde.";
    await db.from("ig_pesquisa").update({ run_id: null, erro }).eq("id", 1);
    return { rodando: false, erro };
  }
  const itens: any[] = await fetch(`${APIFY}/datasets/${run.defaultDatasetId}/items?clean=true&format=json&limit=1000`, { headers: { Authorization: `Bearer ${chave}` } }).then((r) => r.json()).catch(() => []);
  const vistos = new Set<string>();
  const reels = (Array.isArray(itens) ? itens : [])
    .filter((x) => x && x.url && (x.type === "Video" || x.productType === "clips" || x.videoUrl || numero(x.videoPlayCount, x.videoViewCount)))
    .map((x) => ({
      url: String(x.url).split("?")[0],
      perfil: x.ownerUsername ? "@" + x.ownerUsername : null,
      legenda: String(x.caption || "").slice(0, 2200),
      views: numero(x.videoPlayCount, x.videoViewCount, x.playCount),
      curtidas: numero(x.likesCount),
      comentarios: numero(x.commentsCount),
      duracao: Number(x.videoDuration) || null,
      postado_em: x.timestamp || null,
      hashtag: String(x.inputUrl || x.queryTag || x.hashtag || "").replace(/^.*\/tags\//, "").replace(/\/.*$/, "") || null,
      capa: x.displayUrl || null,
    }))
    .filter((x) => !vistos.has(x.url) && vistos.add(x.url))
    .filter((x) => ehPortugues(x.legenda));
  // Primeiro os das últimas 2 semanas (mais views antes); se faltar, completa com os mais antigos
  const limiteData = Date.now() - 14 * 864e5;
  const recentes = reels.filter((x) => x.postado_em && Date.parse(x.postado_em) >= limiteData).sort((a, b) => b.views - a.views);
  const antigos = reels.filter((x) => !(x.postado_em && Date.parse(x.postado_em) >= limiteData)).sort((a, b) => b.views - a.views);
  const top = [...recentes, ...antigos].slice(0, QUANTOS);
  const semana = segundaDaSemana();
  if (top.length) {
    await db.from("ig_reels").delete().eq("semana", semana);
    await db.from("ig_reels").insert(top.map((x) => ({ ...x, semana })));
  }
  await db.from("ig_pesquisa").update({ run_id: null, coletado_em: new Date().toISOString(), erro: top.length ? null : "O Apify não achou reels nessas hashtags. Troque as hashtags e tente de novo.", avisado: !top.length }).eq("id", 1);
  // Avisa no celular (o ajudante de lembretes manda a notificação)
  if (top.length) {
    await fetch(`${URL_BANCO}/functions/v1/lembretes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}` },
      body: JSON.stringify({ tipo: "reels" }),
    }).catch(() => null);
  }
  return { rodando: false, guardados: top.length, recentes: recentes.length };
}

async function uso(chave: string) {
  try {
    const j = (await apify("/users/me/limits", chave))?.data || {};
    return { usado: Number(j?.current?.monthlyUsageUsd) || 0, total: Number(j?.limits?.maxMonthlyUsageUsd) || 5, fimCiclo: j?.monthlyUsageCycle?.endAt || null };
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* vazio */ }

  const chave = Deno.env.get("APIFY_TOKEN");
  const semChave = { semChave: true, erro: "Falta a chave do Apify. Crie a conta grátis em apify.com (sem cartão), copie o token em Settings > API & Integrations e cole no Supabase em Edge Functions > Secrets, com o nome APIFY_TOKEN." };

  try {
    // Relógio de segunda: no máximo uma busca por semana
    if (corpo.tipo === "semanal") {
      if (!chave) return resposta(semChave);
      const cfg = await lerConfig();
      if (cfg.run_id) return resposta(await conferir(chave, cfg));
      const ultima = cfg.coletado_em ? Date.parse(cfg.coletado_em) : 0;
      if (Date.now() - ultima < 6 * 864e5) return resposta({ pulado: "já buscou esta semana" });
      return resposta({ comecou: await comecar(chave, cfg) });
    }

    if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode usar. Saia e entre de novo." }, 401);

    if (corpo.acao === "hashtags") {
      const lista = (Array.isArray(corpo.hashtags) ? corpo.hashtags : []).map((h: string) => String(h).replace(/^#/, "").replace(/\s+/g, "").toLowerCase()).filter(Boolean).slice(0, 12);
      if (!lista.length) return resposta({ erro: "Coloque pelo menos uma hashtag." });
      const por = Math.min(60, Math.max(5, Number(corpo.por_hashtag) || 25));
      await db.from("ig_pesquisa").update({ hashtags: lista, por_hashtag: por }).eq("id", 1);
      return resposta({ ok: true, hashtags: lista, por_hashtag: por });
    }

    if (!chave) return resposta({ ...semChave, config: await lerConfig() });
    let cfg = await lerConfig();

    if (corpo.acao === "buscar") {
      if (cfg.run_id) return resposta({ ...(await conferir(chave, cfg)), config: cfg });
      const ultima = Math.max(cfg.iniciado_em ? Date.parse(cfg.iniciado_em) : 0);
      if (Date.now() - ultima < 6 * 3600e3) return resposta({ erro: "Você já buscou há pouco. Para economizar o crédito, dá para buscar de novo 6 horas depois da última.", config: cfg });
      await comecar(chave, cfg);
      cfg = await lerConfig();
      return resposta({ rodando: true, config: cfg, uso: await uso(chave) });
    }

    // status
    const andamento = cfg.run_id ? await conferir(chave, cfg) : { rodando: false };
    cfg = await lerConfig();
    return resposta({ ...andamento, config: cfg, uso: await uso(chave) });
  } catch (e: any) {
    console.error(e);
    return resposta({ erro: e.message || "O ajudante não conseguiu falar com o Apify agora." });
  }
});
