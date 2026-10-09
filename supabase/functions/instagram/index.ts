// =============================================================
// AJUDANTE "instagram" (Supabase Edge Function)
// Busca as métricas do Instagram profissional do Ryan (@ryalvz)
// pela API oficial da Meta (Instagram API com login do Instagram).
//
// A chave de acesso NÃO fica escrita em lugar nenhum do código:
// o Ryan cola a chave no painel uma vez, ela fica guardada na
// tabela config_privada (que só este ajudante lê) e é renovada
// sozinha antes de vencer (ela dura 60 dias).
// Só o login do Ryan consegue usar este ajudante.
//
// acao "status":     diz se está conectado e qual @
// acao "conectar":   recebe a chave, confere com a Meta e guarda
// acao "dados":      perfil, métricas da conta (período e anterior),
//                    posts com métricas e público
// acao "desconectar": apaga a chave
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const URL_BANCO = Deno.env.get("SUPABASE_URL")!;
const GRAPH = "https://graph.instagram.com/v22.0";

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

/* ---------- Chave guardada no banco ---------- */
async function lerChave() {
  const { data } = await db.from("config_privada").select("chave,valor").in("chave", ["ig_token", "ig_renovado_em"]);
  const v = (k: string) => (data || []).find((x) => x.chave === k)?.valor || "";
  return { token: v("ig_token"), renovadoEm: v("ig_renovado_em") };
}
async function guardarChave(token: string) {
  await db.from("config_privada").upsert([
    { chave: "ig_token", valor: token },
    { chave: "ig_renovado_em", valor: new Date().toISOString() },
  ], { onConflict: "chave" });
}

async function graph(caminho: string, token: string) {
  const sep = caminho.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}/${caminho}${sep}access_token=${encodeURIComponent(token)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e: any = new Error(j?.error?.message || `A Meta respondeu com erro ${r.status}`);
    e.codigo = j?.error?.code;
    throw e;
  }
  return j;
}

// Renova a chave quando ela tem mais de 7 dias (cada renovação vale mais 60 dias)
async function renovarSePreciso(token: string, renovadoEm: string) {
  const dias = renovadoEm ? (Date.now() - Date.parse(renovadoEm)) / 864e5 : 99;
  if (dias < 7) return token;
  try {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
    const j = await r.json();
    if (j.access_token) { await guardarChave(j.access_token); return j.access_token; }
  } catch (_) { /* segue com a chave atual */ }
  return token;
}

/* ---------- Métricas ---------- */
const CAMPOS_PERFIL = "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count,biography";
const METRICAS_CONTA = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "profile_links_taps", "follows_and_unfollows"];

// Soma das métricas da conta num intervalo (no máximo 30 dias, regra da Meta)
async function totaisConta(id: string, token: string, desde: number, ate: number) {
  const r: Record<string, number> = {};
  // Pede tudo junto; se a Meta recusar alguma métrica, pede uma por uma
  const pedir = async (lista: string[]) => {
    const q = `${id}/insights?metric=${lista.join(",")}&period=day&metric_type=total_value&since=${desde}&until=${ate}`;
    const j = await graph(q, token);
    for (const m of j.data || []) {
      const tv = m.total_value || {};
      if (m.name === "follows_and_unfollows") {
        for (const b of tv.breakdowns?.[0]?.results || []) {
          const tipo = String(b.dimension_values?.[0] || "").toLowerCase();
          if (tipo.includes("non_follower") || tipo.includes("unfollow")) r.deixaram = (r.deixaram || 0) + (b.value || 0);
          else r.seguiram = (r.seguiram || 0) + (b.value || 0);
        }
      } else r[m.name] = tv.value ?? 0;
    }
  };
  try { await pedir(METRICAS_CONTA); }
  catch (_) { for (const m of METRICAS_CONTA) { try { await pedir([m]); } catch (_) { /* métrica indisponível */ } } }
  if (r.seguiram === undefined) {
    try {
      const j = await graph(`${id}/insights?metric=follows_and_unfollows&period=day&metric_type=total_value&breakdown=follow_type&since=${desde}&until=${ate}`, token);
      for (const b of j.data?.[0]?.total_value?.breakdowns?.[0]?.results || []) {
        const tipo = String(b.dimension_values?.[0] || "").toUpperCase();
        if (tipo === "FOLLOWER") r.seguiram = b.value || 0; else r.deixaram = b.value || 0;
      }
    } catch (_) { /* sem dados de seguir */ }
  }
  return r;
}

// Alcance de cada dia (para o gráfico)
async function alcancePorDia(id: string, token: string, desde: number, ate: number) {
  try {
    const j = await graph(`${id}/insights?metric=reach&period=day&metric_type=time_series&since=${desde}&until=${ate}`, token);
    return (j.data?.[0]?.values || []).map((v: any) => ({ dia: String(v.end_time || "").slice(0, 10), valor: v.value || 0 }));
  } catch (_) { return []; }
}

async function publico(id: string, token: string) {
  const r: Record<string, { nome: string; valor: number }[]> = {};
  for (const quebra of ["age", "gender", "city"]) {
    try {
      const j = await graph(`${id}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=${quebra}`, token);
      r[quebra] = (j.data?.[0]?.total_value?.breakdowns?.[0]?.results || [])
        .map((b: any) => ({ nome: String(b.dimension_values?.[0] || ""), valor: b.value || 0 }))
        .sort((a: any, b: any) => b.valor - a.valor);
    } catch (_) { r[quebra] = []; }
  }
  return r;
}

async function metricasDoPost(m: any, token: string) {
  const reels = m.media_product_type === "REELS";
  const base = ["reach", "views", "likes", "comments", "shares", "saved", "total_interactions"];
  const extra = reels ? ["ig_reels_avg_watch_time", "ig_reels_video_view_total_time"] : [];
  const r: Record<string, number> = {};
  const pedir = async (lista: string[]) => {
    const j = await graph(`${m.id}/insights?metric=${lista.join(",")}`, token);
    for (const x of j.data || []) r[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? 0;
  };
  try { await pedir([...base, ...extra]); }
  catch (_) { for (const x of [...base, ...extra]) { try { await pedir([x]); } catch (_) { /* indisponível */ } } }
  return r;
}

async function dados(token: string, dias: number) {
  const perfil = await graph(`me?fields=${CAMPOS_PERFIL}`, token);
  const id = perfil.user_id || perfil.id;
  const agora = Math.floor(Date.now() / 1000);
  const periodo = Math.min(30, Math.max(1, dias)) * 86400;
  const [atual, anterior, porDia, aud] = await Promise.all([
    totaisConta(id, token, agora - periodo, agora),
    totaisConta(id, token, agora - 2 * periodo, agora - periodo),
    alcancePorDia(id, token, agora - periodo, agora),
    publico(id, token),
  ]);

  // Últimos 50 posts (sem stories), com as métricas de cada um
  const lista = await graph("me/media?fields=id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count&limit=50", token);
  const posts = [];
  const itens = (lista.data || []).filter((m: any) => m.media_product_type !== "STORY");
  for (let i = 0; i < itens.length; i += 10) {
    const lote = itens.slice(i, i + 10);
    const metricas = await Promise.all(lote.map((m: any) => metricasDoPost(m, token)));
    lote.forEach((m: any, k: number) => posts.push({
      id: m.id, legenda: String(m.caption || "").slice(0, 300), tipo: m.media_product_type === "REELS" ? "REELS" : m.media_type === "CAROUSEL_ALBUM" ? "CARROSSEL" : m.media_type === "VIDEO" ? "VIDEO" : "FOTO",
      link: m.permalink, capa: m.thumbnail_url || m.media_url || "", data: m.timestamp,
      curtidas: m.like_count ?? metricas[k].likes ?? 0, comentarios: m.comments_count ?? metricas[k].comments ?? 0, ...metricas[k],
    }));
  }

  // Guarda os seguidores de hoje (o Instagram só mostra 30 dias; assim o painel vai juntando o histórico)
  try {
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    await db.from("ig_historico").upsert({ data: hoje, seguidores: perfil.followers_count ?? null, posts: perfil.media_count ?? null }, { onConflict: "data" });
  } catch (_) { /* tabela ainda não criada */ }

  return { perfil, dias: periodo / 86400, atual, anterior, porDia, publico: aud, posts, atualizado: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode ver isso. Saia e entre de novo." }, 401);

  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }

  try {
    if (corpo.acao === "conectar") {
      const token = String(corpo.token || "").trim();
      if (token.length < 20) return resposta({ erro: "Essa chave parece incompleta. Copie de novo o token inteiro na Meta." });
      const perfil = await graph(`me?fields=${CAMPOS_PERFIL}`, token);
      if (perfil.account_type && !/BUSINESS|MEDIA_CREATOR|CREATOR/i.test(perfil.account_type)) {
        return resposta({ erro: "Essa conta não é profissional. No Instagram, mude para Criador de conteúdo ou Empresa." });
      }
      await guardarChave(token);
      return resposta({ ok: true, usuario: perfil.username });
    }

    if (corpo.acao === "desconectar") {
      await db.from("config_privada").delete().in("chave", ["ig_token", "ig_renovado_em"]);
      return resposta({ ok: true });
    }

    const { token: guardado, renovadoEm } = await lerChave();
    if (!guardado) return resposta({ conectado: false });
    const token = await renovarSePreciso(guardado, renovadoEm);

    if (corpo.acao === "status") {
      const perfil = await graph("me?fields=username", token);
      return resposta({ conectado: true, usuario: perfil.username });
    }

    return resposta({ conectado: true, ...(await dados(token, Number(corpo.dias) || 30)) });
  } catch (e: any) {
    // Chave vencida ou revogada: pede para conectar de novo
    if (e?.codigo === 190) return resposta({ conectado: false, erro: "A chave do Instagram venceu ou foi desfeita. Gere uma nova na Meta e conecte de novo." });
    console.error(e);
    return resposta({ erro: String(e?.message || e) }, 200);
  }
});
