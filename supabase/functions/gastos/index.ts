// =============================================================
// AJUDANTE "gastos" (Supabase Edge Function): o bot do Telegram
// Você manda pro bot:
//   texto:  "45,90 ifood nubank"   "120 mercado bradesco 3x"   "30 uber do diego"
//   foto da nota, com legenda opcional dizendo cartão/pessoa/parcelas
//           (ex.: "diego", "inter 2x"). A foto é lida por uma IA.
//   /desfazer  apaga o último lançamento
//   /resumo    mostra o que já está na próxima fatura de cada cartão
// Cada gasto entra em pf_compras (origem "rapido"), na fatura certa
// pelo dia de fechamento do cartão. Quando a fatura for importada no
// painel, a linha do banco toma o lugar do lançamento, sem duplicar.
//
// As chaves NÃO ficam aqui, ficam no cofre do Supabase (Edge Functions > Secrets):
//   TELEGRAM_TOKEN     o token que o @BotFather te dá (obrigatório)
//   GEMINI_API_KEY     para ler foto com o Gemini (Google AI Studio, plano grátis)
//   ANTHROPIC_API_KEY  ou, no lugar, para ler foto com o Claude (pago, centavos por foto)
// "Verify JWT" fica DESLIGADO: o Telegram não manda login. A segurança é:
//   o Telegram assina cada mensagem com um segredo (derivado do token) e
//   o bot só responde ao chat que você conectou pelo painel.
// acao "status" / "conectar" (painel, só o seu login): liga o webhook e
//   gera o código para conectar seu Telegram.
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const URL_BANCO = Deno.env.get("SUPABASE_URL")!;
const TOKEN = Deno.env.get("TELEGRAM_TOKEN") || "";
const TG = `https://api.telegram.org/bot${TOKEN}`;

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

// Segredo que o Telegram manda em cada mensagem (derivado do token, então não precisa de outra chave)
async function segredoWebhook() {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gastos:" + TOKEN));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

/* ---------- Config (pf_config) ---------- */
async function lerCfg(chave: string) {
  const { data } = await db.from("pf_config").select("valor").eq("chave", chave).maybeSingle();
  return data ? data.valor : null;
}
async function gravarCfg(chave: string, valor: unknown) {
  if (valor === null || valor === undefined) { await db.from("pf_config").delete().eq("chave", chave); return; }
  await db.from("pf_config").upsert({ chave, valor }, { onConflict: "chave" });
}

/* ---------- Datas e meses ---------- */
const pad = (n: number) => String(n).padStart(2, "0");
const hojeBR = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
function somaMes(k: string, n: number) { const [a, m] = k.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (k: string) => `${MESES[Number(k.slice(5)) - 1]}`;
const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
// Mesma regra do painel: a fatura em que a compra cai, pelo dia de fechamento
function mesFatura(cartao: any, iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const k = `${a}-${pad(m)}`;
  if (!cartao || !cartao.vence_dia) return k;
  const vence = Number(cartao.vence_dia);
  let fecha = Number(cartao.fecha_dia) || vence - 7;
  if (fecha <= 0) fecha += 30;
  const mesFecha = d < fecha ? k : somaMes(k, 1);
  return vence > fecha ? mesFecha : somaMes(mesFecha, 1);
}

/* ---------- Entender o texto ---------- */
const semAcento = (t: string) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const PALAVRAS_VAZIAS = new Set(["do", "da", "de", "dos", "das", "no", "na", "em", "pra", "pro", "para", "com", "reais", "real", "r$", "rs", "o", "a", "um", "uma", "gastei", "paguei", "comprei", "e"]);
const EU = new Set(["eu", "mim", "meu", "minha", "meus", "minhas"]);
function valorDe(t: string) {
  const m = t.match(/^r?\$?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/i);
  if (!m) return 0;
  const s = m[1];
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/\.\d{3}$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}
function entender(texto: string, cartoes: any[], pessoas: string[]) {
  const r: any = { valor: 0, cartao: undefined, n: 1, dono: undefined, desc: "" };
  const sobra: string[] = [];
  const palavras = String(texto || "").replace(/\n/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i], s = semAcento(p).replace(/[.,;:!?]+$/, "");
    const x = s.match(/^(\d{1,2})\s*x$/);
    if (x) { r.n = Math.max(1, Math.min(48, Number(x[1]))); continue; }
    if (!r.valor) { const v = valorDe(semAcento(p).replace(/[;:!?]+$/, "")); if (v) { r.valor = v; continue; } }
    const c = cartoes.find((c) => semAcento(c.nome) === s);
    if (c) { r.cartao = c; continue; }
    if (["pix", "debito", "dinheiro", "especie"].includes(s)) { r.cartao = null; continue; }
    if (EU.has(s)) { r.dono = null; continue; }
    const pessoa = pessoas.find((n) => semAcento(n) === s);
    if (pessoa) { r.dono = pessoa; continue; }
    // "do fulano" / "da fulana" com nome novo
    if (["do", "da", "pro", "pra"].includes(s) && palavras[i + 1] && !cartoes.some((c) => semAcento(c.nome) === semAcento(palavras[i + 1]))) {
      const nome = semAcento(palavras[i + 1]).replace(/[^a-z]/g, "");
      if (nome && !EU.has(nome) && nome.length > 2 && /^[A-ZÀ-Ú]/.test(palavras[i + 1])) { r.dono = capitalizar(nome); i++; continue; }
    }
    if (!PALAVRAS_VAZIAS.has(s)) sobra.push(p);
  }
  r.desc = sobra.join(" ").trim();
  if (r.desc) r.desc = capitalizar(r.desc);
  return r;
}

/* ---------- Ler a foto da nota ---------- */
const PEDIDO_FOTO = `Esta é a foto de uma nota fiscal, cupom, comprovante ou tela de compra no Brasil.
Responda SÓ com um JSON, sem texto em volta, neste formato:
{"valor_total": número em reais (ex.: 45.9), "estabelecimento": "nome curto da loja", "data": "AAAA-MM-DD" ou null, "parcelas": número de parcelas se aparecer, ou null}
Se não conseguir ler o valor, use "valor_total": 0.`;
async function lerFoto(b64: string, mime: string) {
  const gemini = Deno.env.get("GEMINI_API_KEY");
  const claude = Deno.env.get("ANTHROPIC_API_KEY");
  let texto = "";
  if (gemini) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: PEDIDO_FOTO }, { inline_data: { mime_type: mime, data: b64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    const j = await r.json();
    texto = j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!r.ok) throw new Error("Gemini: " + (j?.error?.message || r.status));
  } else if (claude) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": claude, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 300, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: b64 } }, { type: "text", text: PEDIDO_FOTO }] }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error("Claude: " + (j?.error?.message || r.status));
    texto = j?.content?.[0]?.text || "";
  } else return null;
  const m = texto.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : null;
}

/* ---------- Telegram ---------- */
async function enviar(chat: number, texto: string) {
  await fetch(`${TG}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: texto }) });
}
async function baixarFoto(fileId: string) {
  const f = await (await fetch(`${TG}/getFile?file_id=${fileId}`)).json();
  const caminho = f?.result?.file_path;
  if (!caminho) throw new Error("não consegui baixar a foto");
  const bin = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${TOKEN}/${caminho}`)).arrayBuffer());
  const mime = /\.png$/i.test(caminho) ? "image/png" : /\.webp$/i.test(caminho) ? "image/webp" : "image/jpeg";
  return { b64: encodeBase64(bin), mime };
}

const AJUDA = `Como lançar um gasto:
• Texto: 45,90 ifood nubank
• Parcelado: 300 tênis bradesco 3x
• De outra pessoa: 30 uber nubank diego
• Pix ou débito: 12 padaria pix
• Foto da nota, com legenda opcional (ex.: "diego", "inter 2x")

Sem cartão na mensagem, vai no último que você usou.
/desfazer apaga o último lançamento
/resumo mostra a próxima fatura de cada cartão`;

async function tratarMensagem(msg: any) {
  const chat = msg.chat?.id;
  if (!chat) return;
  const texto = String(msg.text || msg.caption || "").trim();
  const conectado = await lerCfg("telegram_chat");

  // Conectar: /start <código> (o link do painel já manda assim)
  const ini = texto.match(/^\/start(?:\s+(\S+))?/);
  if (ini) {
    const codigo = await lerCfg("telegram_codigo");
    if (ini[1] && codigo && ini[1] === codigo) {
      await gravarCfg("telegram_chat", chat);
      await gravarCfg("telegram_codigo", null);
      await enviar(chat, "Conectado ao seu painel! ✅\n\n" + AJUDA);
    } else if (String(conectado) === String(chat)) await enviar(chat, AJUDA);
    else await enviar(chat, "Este bot é particular. Para conectar, abra o painel em Financeiro > Pessoal > Telegram e toque em Conectar.");
    return;
  }
  if (String(conectado) !== String(chat)) { await enviar(chat, "Este bot é particular."); return; }

  const { data: cartoes } = await db.from("pf_cartoes").select("id,nome,vence_dia,fecha_dia").order("ordem").order("id");
  const { data: donos } = await db.from("pf_compras").select("dono").not("dono", "is", null).limit(2000);
  const pessoas = [...new Set((donos || []).map((d: any) => String(d.dono).trim()))];

  if (/^\/(ajuda|help)/i.test(texto)) { await enviar(chat, AJUDA); return; }

  if (/^\/desfazer/i.test(texto)) {
    const id = await lerCfg("telegram_ultimo_id");
    if (!id) { await enviar(chat, "Não tenho nenhum lançamento recente pra desfazer."); return; }
    const { data: c } = await db.from("pf_compras").select("id,descricao,valor_parcela,parcelas,origem").eq("id", id).maybeSingle();
    if (!c || c.origem !== "rapido") { await enviar(chat, "Esse lançamento já foi trocado pela fatura ou apagado."); await gravarCfg("telegram_ultimo_id", null); return; }
    await db.from("pf_compras").delete().eq("id", id);
    await gravarCfg("telegram_ultimo_id", null);
    await enviar(chat, `Apaguei: ${c.descricao}, ${real(Number(c.valor_parcela) * Number(c.parcelas))}.`);
    return;
  }

  if (/^\/resumo/i.test(texto)) {
    const k = somaMes(hojeBR().slice(0, 7), 1);
    const { data: compras } = await db.from("pf_compras").select("cartao_id,valor_parcela,parcelas,primeiro_mes,dono");
    const linhas = (cartoes || []).map((c: any) => {
      let eu = 0, outros = 0;
      (compras || []).forEach((x: any) => {
        if (String(x.cartao_id) !== String(c.id)) return;
        const i = (Number(k.slice(0, 4)) - Number(x.primeiro_mes.slice(0, 4))) * 12 + (Number(k.slice(5, 7)) - Number(x.primeiro_mes.slice(5, 7)));
        if (i < 0 || i >= Number(x.parcelas)) return;
        if (x.dono) outros += Number(x.valor_parcela); else eu += Number(x.valor_parcela);
      });
      return { nome: c.nome, eu, outros };
    });
    const tEu = linhas.reduce((s: number, l: any) => s + l.eu, 0), tOut = linhas.reduce((s: number, l: any) => s + l.outros, 0);
    await enviar(chat, `Fatura de ${nomeMes(k)}, até agora:\n\n${linhas.map((l: any) => `${l.nome}: ${real(l.eu)} seu${l.outros ? ` + ${real(l.outros)} dos outros` : ""}`).join("\n")}\n\nTotal seu: ${real(tEu)}\nDos outros: ${real(tOut)}`);
    return;
  }

  // Lançar
  const e = entender(texto, cartoes || [], pessoas);
  let data = hojeBR();
  if (msg.photo?.length) {
    const foto = msg.photo[msg.photo.length - 1];
    let lido: any = null;
    try {
      const { b64, mime } = await baixarFoto(foto.file_id);
      lido = await lerFoto(b64, mime);
    } catch (err) { await enviar(chat, "Não consegui ler a foto (" + String((err as Error).message || err).slice(0, 120) + "). Manda o valor por texto, ex.: 45,90 ifood"); return; }
    if (lido === null) { await enviar(chat, "Ainda não tenho uma IA ligada pra ler fotos. Peça pra configurar a chave GEMINI_API_KEY no Supabase. Enquanto isso, manda por texto: 45,90 ifood"); return; }
    if (!e.valor) e.valor = Number(lido.valor_total) || 0;
    if (!e.desc && lido.estabelecimento) e.desc = String(lido.estabelecimento).slice(0, 60);
    if (e.n === 1 && Number(lido.parcelas) > 1) e.n = Math.min(48, Number(lido.parcelas));
    if (lido.data && /^\d{4}-\d{2}-\d{2}$/.test(lido.data) && Math.abs(Date.parse(lido.data) - Date.parse(data)) < 40 * 864e5) data = lido.data;
  }
  if (!e.valor) { await enviar(chat, "Não entendi o valor. Exemplo: 45,90 ifood nubank\n\n/ajuda mostra tudo que eu entendo."); return; }
  if (!e.desc) e.desc = "Gasto";

  // Sem cartão na mensagem: o último usado
  let cartao = e.cartao;
  if (cartao === undefined) {
    const ult = await lerCfg("telegram_ultimo_cartao");
    cartao = ult === "pix" ? null : (cartoes || []).find((c: any) => String(c.id) === String(ult)) || (cartoes || [])[0] || null;
  }
  const k = mesFatura(cartao, data);
  const { data: novo, error } = await db.from("pf_compras").insert({
    cartao_id: cartao ? cartao.id : null, descricao: e.desc, valor_parcela: Math.round((e.valor / e.n) * 100) / 100, parcelas: e.n,
    primeiro_mes: k + "-01", data_compra: data, dono: e.dono || null, origem: "rapido",
  }).select("id").single();
  if (error) { await enviar(chat, "Não consegui salvar: " + error.message); return; }
  await gravarCfg("telegram_ultimo_id", novo.id);
  await gravarCfg("telegram_ultimo_cartao", cartao ? cartao.id : "pix");
  await enviar(chat, `Lancei ✅\n${e.desc}: ${real(e.valor)}${e.n > 1 ? ` em ${e.n}x de ${real(e.valor / e.n)}` : ""}\n${cartao ? `${cartao.nome}, fatura de ${nomeMes(k)}` : "Pix/débito"}${e.dono ? `\nDe: ${e.dono}` : ""}\n\nErrado? /desfazer`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  if (!TOKEN) return resposta({ semToken: true, erro: "Falta o TELEGRAM_TOKEN no cofre do Supabase (Edge Functions > Secrets)." });

  // Mensagem do Telegram
  const assinatura = req.headers.get("x-telegram-bot-api-secret-token");
  if (assinatura !== null) {
    if (assinatura !== await segredoWebhook()) return new Response("não", { status: 401 });
    try {
      const upd = await req.json();
      const msg = upd.message; // mensagem editada não lança de novo
      if (msg) await tratarMensagem(msg);
    } catch (err) { console.error(err); }
    return new Response("ok");
  }

  // Painel
  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* vazio */ }
  if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode usar. Saia e entre de novo." }, 401);
  try {
    const eu = await (await fetch(`${TG}/getMe`)).json();
    if (!eu.ok) return resposta({ erro: "O token do Telegram não funcionou. Confira o TELEGRAM_TOKEN no Supabase." });
    const ia = Deno.env.get("GEMINI_API_KEY") ? "gemini" : Deno.env.get("ANTHROPIC_API_KEY") ? "claude" : null;
    if (corpo.acao === "conectar") {
      const w = await (await fetch(`${TG}/setWebhook`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: `${URL_BANCO}/functions/v1/gastos`, secret_token: await segredoWebhook(), allowed_updates: ["message"] }),
      })).json();
      if (!w.ok) return resposta({ erro: "Não deu para ligar o bot: " + (w.description || "") });
      const codigo = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      await gravarCfg("telegram_codigo", codigo);
      return resposta({ ok: true, bot: eu.result.username, link: `https://t.me/${eu.result.username}?start=${codigo}`, conectado: !!(await lerCfg("telegram_chat")), ia });
    }
    if (corpo.acao === "desconectar") { await gravarCfg("telegram_chat", null); return resposta({ ok: true }); }
    return resposta({ ok: true, bot: eu.result.username, conectado: !!(await lerCfg("telegram_chat")), ia });
  } catch (err) {
    return resposta({ erro: String((err as Error).message || err) }, 500);
  }
});
