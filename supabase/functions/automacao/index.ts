// =============================================================
// AJUDANTE "automacao" (Supabase Edge Function)
// Comentou a palavra, recebe no direct: quando alguém comenta uma
// palavra-chave num post do @ryalvz, a Meta avisa este ajudante,
// ele manda o direct (resposta privada ao comentário) e responde
// o comentário em público. Com botão, o primeiro direct pede um
// toque; só no toque o Instagram libera o nome (e se a pessoa
// segue a conta), e aí vai o link. Usa a mesma chave do ajudante
// "instagram" (tabela config_privada), que já se renova sozinha.
//
// Três jeitos de chamar:
// GET  com hub.challenge   -> a Meta confere o endereço (webhook)
// POST com assinatura      -> a Meta avisa de um comentário novo ou de um toque no botão
// POST {acao} do painel    -> só o login do Ryan:
//   "status":  endereço, código de verificação, segredo e avisos
//   "segredo": guarda a Chave secreta do app (para conferir a Meta)
//   "assinar": liga os avisos de comentários na conta
//   "posts":   os últimos posts, para escolher em qual vale
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const URL_BANCO = Deno.env.get("SUPABASE_URL")!;
const GRAPH = "https://graph.instagram.com/v22.0";
const ENDERECO = `${URL_BANCO}/functions/v1/automacao`;

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

/* ---------- Configurações guardadas (só este ajudante e o "instagram" leem) ---------- */
async function lerConfig(chaves: string[]) {
  const { data } = await db.from("config_privada").select("chave,valor").in("chave", chaves);
  return Object.fromEntries(chaves.map((k) => [k, (data || []).find((x) => x.chave === k)?.valor || ""]));
}
const guardar = (chave: string, valor: string) => db.from("config_privada").upsert({ chave, valor }, { onConflict: "chave" });

async function graph(caminho: string, token: string, corpo?: Record<string, unknown>) {
  const r = await fetch(`${GRAPH}/${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j?.error?.message || `A Meta respondeu com erro ${r.status}`);
  return j;
}

/* ---------- Conferir que o aviso veio mesmo da Meta ---------- */
async function assinaturaOk(corpo: string, cabecalho: string, segredo: string) {
  if (!segredo || !cabecalho.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const assinatura = new Uint8Array(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo)));
  const esperado = [...assinatura].map((b) => b.toString(16).padStart(2, "0")).join("");
  const recebido = cabecalho.slice(7);
  if (recebido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return dif === 0;
}

/* ---------- A palavra bate? (sem acento, sem maiúscula, palavra inteira) ---------- */
const normal = (t: string) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function bate(texto: string, palavras: string) {
  const t = ` ${normal(texto).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return palavras.split(/[,\n]/).map((p) => normal(p).replace(/[^\p{L}\p{N}]+/gu, " ").trim()).filter(Boolean).some((p) => t.includes(` ${p} `));
}
// Troca {nome} pelo primeiro nome e {usuario} pelo @; sem o dado, some junto com o espaço antes ("Oi {nome}!" vira "Oi!")
const preencher = (t: string, nome: string, usuario: string) => String(t || "")
  .replace(/\s*\{nome\}/g, nome ? ` ${nome}` : "").replace(/\s*\{usuario\}/g, usuario ? ` @${usuario}` : "").trim();
// O Instagram só entrega o nome de quem já conversou com a conta; para os outros, fica sem nome
let motivoSemNome = "";
async function primeiroNome(id: string, token: string) {
  motivoSemNome = "";
  if (!id) return "";
  try {
    const p = await graph(`${id}?fields=name,username`, token);
    const n = String(p.name || "").trim().split(/\s+/)[0] || "";
    if (!n) motivoSemNome = "o perfil não tem nome preenchido";
    return n;
  } catch (e) { motivoSemNome = (e as Error).message; return ""; }
}
const sortear = (linhas: string) => { const l = String(linhas || "").split("\n").map((x) => x.trim()).filter(Boolean); return l.length ? l[Math.floor(Math.random() * l.length)] : ""; };

const BOTAO_PADRAO = "Oi! Vi seu comentário 👀 Toca no botão aqui embaixo que eu te mando agora.";
const SEGUIR_PADRAO = "Quase lá, {nome}! Me segue aqui no @ryalvz e toca no botão de novo que o link chega na hora 💛";
// Mensagem com um botão; se a Meta não aceitar o modelo de botão, vai com resposta rápida (o botão aparece embaixo do texto)
async function enviarComBotao(para: Record<string, string>, texto: string, titulo: string, payload: string, token: string) {
  try {
    await graph("me/messages", token, { recipient: para, message: { attachment: { type: "template", payload: { template_type: "button", text: texto.slice(0, 640), buttons: [{ type: "postback", title: titulo.slice(0, 20), payload }] } } } });
  } catch (_) {
    await graph("me/messages", token, { recipient: para, message: { text: texto.slice(0, 1000), quick_replies: [{ content_type: "text", title: titulo.slice(0, 20), payload }] } });
  }
}
// A pessoa tocou no botão: agora o Instagram entrega o nome e se ela segue a conta
async function tratarToque(ev: any, token: string) {
  const payload = String(ev?.postback?.payload || ev?.message?.quick_reply?.payload || "");
  const m = payload.match(/^auto:(\d+)$/), quem = String(ev?.sender?.id || "");
  if (!m || !quem || ev?.message?.is_echo) return;
  const { data: env } = await db.from("automacao_envios").select("*").eq("id", Number(m[1])).single();
  if (!env || env.status === "enviado") return;
  const { data: a } = await db.from("automacoes").select("*").eq("id", env.automacao_id).single();
  if (!a) return;
  let perfil: any = {};
  try { perfil = await graph(`${quem}?fields=name,username,is_user_follow_business`, token); } catch (e) { perfil = { erro: (e as Error).message }; }
  const nome = String(perfil.name || "").trim().split(/\s+/)[0] || "";
  try {
    if (a.exige_seguir && perfil.is_user_follow_business !== true) {
      await enviarComBotao({ id: quem }, preencher(a.texto_seguir || SEGUIR_PADRAO, nome, env.usuario || ""), "Já sigo!", payload, token);
      await db.from("automacao_envios").update({ nome: nome || null, erro: perfil.erro ? `não deu pra conferir: ${perfil.erro}` : "esperando seguir" }).eq("id", env.id);
      return;
    }
    await graph("me/messages", token, { recipient: { id: quem }, message: { text: preencher(a.mensagem, nome, env.usuario || "").slice(0, 1000) } });
    await db.from("automacao_envios").update({ status: "enviado", nome: nome || null, erro: null }).eq("id", env.id);
  } catch (e) {
    await db.from("automacao_envios").update({ status: "erro", erro: String((e as Error).message).slice(0, 300) }).eq("id", env.id);
  }
}

async function tratarComentario(v: any, dono: string, token: string) {
  const comentario = String(v?.id || ""), texto = String(v?.text || ""), autor = v?.from || {};
  if (!comentario || !texto || String(autor.id || "") === dono) return; // o próprio Ryan comentando não conta
  const midia = String(v?.media?.id || "");
  const { data: autos } = await db.from("automacoes").select("*").eq("ativa", true).order("id");
  const a = (autos || []).find((x) => (!x.midia_id || x.midia_id === midia) && bate(texto, x.palavras));
  if (!a) return;
  // Um direct por comentário: se a Meta mandar o mesmo aviso de novo, o comentário já está registrado
  const { data: reg, error } = await db.from("automacao_envios").insert({
    automacao_id: a.id, comentario_id: comentario, usuario: autor.username || null, usuario_id: autor.id || null, midia_id: midia || null, texto: texto.slice(0, 500),
  }).select("id").single();
  if (error || !reg) return;
  const comBotao = !!(a.com_botao || a.exige_seguir);
  const nome = !comBotao && /\{nome\}/.test(`${a.mensagem}${a.respostas || ""}`) ? await primeiroNome(String(autor.id || ""), token) : "";
  const mensagem = preencher(a.mensagem, nome, autor.username || "");
  try {
    // Com botão: primeiro um direct curto; o link só vai quando a pessoa tocar (e aí o Instagram libera o nome)
    if (comBotao) await enviarComBotao({ comment_id: comentario }, preencher(a.texto_botao || BOTAO_PADRAO, "", ""), "Quero o link", `auto:${reg.id}`, token);
    else await graph("me/messages", token, { recipient: { comment_id: comentario }, message: { text: mensagem.slice(0, 1000) } });
    let erroPublico = "";
    const publica = sortear(a.respostas);
    if (publica) { try { await graph(`${comentario}/replies`, token, { message: preencher(publica, nome, autor.username || "") }); } catch (e) { erroPublico = `direct ok, resposta no comentário falhou: ${(e as Error).message}`; } }
    const avisos = [erroPublico, !comBotao && motivoSemNome && /\{nome\}/.test(a.mensagem) ? `sem nome: ${motivoSemNome}` : ""].filter(Boolean).join(" · ");
    await db.from("automacao_envios").update({ status: comBotao ? "aguardando" : "enviado", erro: avisos || null }).eq("id", reg.id);
  } catch (e) {
    await db.from("automacao_envios").update({ status: "erro", erro: String((e as Error).message).slice(0, 300) }).eq("id", reg.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  // 1. A Meta confere o endereço uma vez, quando você salva o webhook
  if (req.method === "GET") {
    const { ig_verify_token } = await lerConfig(["ig_verify_token"]);
    const ok = url.searchParams.get("hub.mode") === "subscribe" && ig_verify_token && url.searchParams.get("hub.verify_token") === ig_verify_token;
    return ok ? new Response(url.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("não", { status: 403 });
  }

  // 2. Aviso da Meta: comentário novo
  const assinatura = req.headers.get("x-hub-signature-256") || "";
  if (assinatura) {
    const corpo = await req.text();
    const cfg = await lerConfig(["ig_app_secret", "ig_token"]);
    if (!(await assinaturaOk(corpo, assinatura, cfg.ig_app_secret))) return new Response("assinatura inválida", { status: 401 });
    await guardar("ig_ultimo_aviso", new Date().toISOString());
    const dados = JSON.parse(corpo || "{}");
    for (const entrada of dados.entry || []) {
      for (const mudanca of entrada.changes || []) {
        if (mudanca.field === "comments") await tratarComentario(mudanca.value, String(entrada.id || ""), cfg.ig_token).catch(() => {});
      }
      for (const ev of entrada.messaging || []) await tratarToque(ev, cfg.ig_token).catch(() => {});
    }
    return new Response("ok", { status: 200 });
  }

  // 3. O painel
  if (!(await ehOAdmin(req))) return resposta({ erro: "Só o Ryan pode usar isso." }, 401);
  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* vazio */ }
  const cfg = await lerConfig(["ig_token", "ig_app_secret", "ig_verify_token", "ig_ultimo_aviso"]);

  if (corpo.acao === "segredo") {
    const v = String(corpo.valor || "").trim();
    if (!/^[a-f0-9]{32}$/i.test(v)) return resposta({ erro: "Isso não parece a Chave secreta do app (são 32 letras e números)." }, 400);
    await guardar("ig_app_secret", v);
    return resposta({ ok: true });
  }
  if (!cfg.ig_token) return resposta({ erro: "Conecte o Instagram primeiro em Métricas do Instagram." }, 400);

  if (corpo.acao === "assinar") {
    try {
      const r = await graph("me/subscribed_apps?subscribed_fields=comments,messages,messaging_postbacks", cfg.ig_token, {});
      return resposta({ ok: !!r.success });
    } catch (e) { return resposta({ erro: (e as Error).message }, 400); }
  }
  if (corpo.acao === "perfil") {
    try { return resposta({ perfil: await graph(`${String(corpo.id || "")}?fields=name,username,is_user_follow_business`, cfg.ig_token) }); }
    catch (e) { return resposta({ erro: (e as Error).message }); }
  }
  if (corpo.acao === "posts") {
    try {
      const r = await graph("me/media?fields=id,caption,media_type,thumbnail_url,media_url,permalink,timestamp&limit=24", cfg.ig_token);
      const posts = r.data || [];
      // Os últimos comentários do post mais recente (também confirma que a permissão de comentários funciona)
      let comentarios: unknown[] = [], erroComentarios = "";
      if (posts[0]) { try { comentarios = (await graph(`${posts[0].id}/comments?fields=id,text,username,timestamp&limit=5`, cfg.ig_token)).data || []; } catch (e) { erroComentarios = (e as Error).message; } }
      return resposta({ posts, comentarios, erroComentarios });
    } catch (e) { return resposta({ erro: (e as Error).message }, 400); }
  }

  // status (padrão): cria o código de verificação na primeira vez
  let verificar = cfg.ig_verify_token;
  if (!verificar) { verificar = crypto.randomUUID().replace(/-/g, ""); await guardar("ig_verify_token", verificar); }
  let assinado: boolean | null = null, erroAssinatura = "";
  let mensagens = false;
  try {
    const r = await graph("me/subscribed_apps", cfg.ig_token), campos = (r.data || []).flatMap((x: any) => x.subscribed_fields || []);
    assinado = campos.includes("comments"); mensagens = campos.includes("messages") && campos.includes("messaging_postbacks");
  } catch (e) { erroAssinatura = (e as Error).message; }
  return resposta({ endereco: ENDERECO, verificar, temSegredo: !!cfg.ig_app_secret, assinado, mensagens, erroAssinatura, ultimoAviso: cfg.ig_ultimo_aviso || null });
});
