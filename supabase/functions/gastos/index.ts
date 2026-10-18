// =============================================================
// AJUDANTE "gastos" (Supabase Edge Function): o bot do Telegram
// Você manda pro bot:
//   texto:  "45,90 ifood nubank"   "120 mercado bradesco 3x"   "30 uber do diego"
//   foto da nota, com legenda opcional dizendo cartão/pessoa/parcelas
//           (ex.: "diego", "inter 2x"). A foto é lida por uma IA.
//   "errado" ou o botão Desfazer apagam o último lançamento
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
const PALAVRAS_VAZIAS = new Set(["do", "da", "de", "dos", "das", "no", "na", "em", "pra", "pro", "para", "com", "reais", "real", "r$", "r", "rs", "o", "a", "um", "uma", "gastei", "paguei", "comprei", "e"]);
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
  let t = String(texto || "").replace(/\n/g, " ");
  // Parcelas por extenso: "à vista", "em 3x", "3 vezes", "3 parcelas", "parcelado em 3"
  const VISTA = /(^|\s)(?:[àáa]\s?vista|avista)(?=$|\s|[!.,;?])/gi;
  if (VISTA.test(t)) { r.n = 1; t = t.replace(VISTA, " "); }
  const ext = t.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas)\b/i) || t.match(/\bparcelad[oa]\s+em\s+(\d{1,2})\b/i);
  if (ext) { r.n = Math.max(1, Math.min(48, Number(ext[1]))); t = t.replace(ext[0], " "); }
  const palavras = t.split(/\s+/).filter(Boolean);
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
    const limpa = p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (limpa && !PALAVRAS_VAZIAS.has(semAcento(limpa))) sobra.push(limpa);
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
async function enviar(chat: number, texto: string, botoes?: { text: string; callback_data: string }[]) {
  await tg("sendMessage", { chat_id: chat, text: texto, ...(botoes ? { reply_markup: { inline_keyboard: [botoes] } } : {}) });
}
async function tg(metodo: string, corpo: unknown) {
  return await (await fetch(`${TG}/${metodo}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })).json();
}
// Apaga lançamentos feitos pelo bot (só os que ainda não viraram linha da fatura)
async function apagarLancamentos(ids: number[]) {
  if (!ids.length) return [];
  const { data } = await db.from("pf_compras").select("id,descricao,valor_parcela,parcelas,origem").in("id", ids);
  const vivos = (data || []).filter((c: any) => c.origem === "rapido");
  if (vivos.length) await db.from("pf_compras").delete().in("id", vivos.map((c: any) => c.id));
  return vivos;
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
• Parcelado: 300 tênis bradesco 3x (ou "em 3 vezes")
• De outra pessoa: 30 uber nubank diego
• Pix ou débito: 12 padaria pix
• Foto da nota, com legenda opcional (ex.: "diego", "inter 2x")

Sem cartão na mensagem, vai no último que você usou.
Pode mandar vários de uma vez, um por linha.
Errou? Toque em Desfazer, ou mande "errado".
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

  if (/^\/?(desfazer|desfaz|errado|errada|errei|apaga|apagar|apague|cancela|cancelar|deleta|deletar|remove|remover)\b/i.test(semAcento(texto)) && texto.length < 30) {
    const ult = await lerCfg("telegram_ultimo_id");
    const ids = (Array.isArray(ult) ? ult : ult ? [ult] : []).map(Number);
    const apagados = await apagarLancamentos(ids);
    await gravarCfg("telegram_ultimo_id", null);
    if (!apagados.length) { await enviar(chat, "Não tenho nenhum lançamento recente pra desfazer."); return; }
    await enviar(chat, `Apaguei ↩️\n${apagados.map((c: any) => `${c.descricao}: ${real(Number(c.valor_parcela) * Number(c.parcelas))}`).join("\n")}`);
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

  // Lançar: cada linha com valor vira um gasto; linhas sem valor (ex.: "nubank") valem para todas
  const linhasTexto = texto.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const comValor = linhasTexto.filter((l) => entender(l, cartoes || [], pessoas).valor);
  const partes = comValor.length >= 2 ? comValor : [texto];
  const extra = comValor.length >= 2 ? linhasTexto.filter((l) => !comValor.includes(l)).join(" ") : "";
  const itens = partes.map((l) => {
    const e = entender(l, cartoes || [], pessoas);
    if (extra) { const x = entender(extra, cartoes || [], pessoas); if (e.cartao === undefined) e.cartao = x.cartao; if (e.dono === undefined) e.dono = x.dono; if (e.n === 1) e.n = x.n; }
    return e;
  });
  let data = hojeBR();
  if (msg.photo?.length) {
    const e = itens[0];
    const foto = msg.photo[msg.photo.length - 1];
    let lido: any = null;
    try {
      const { b64, mime } = await baixarFoto(foto.file_id);
      lido = await lerFoto(b64, mime);
    } catch (err) { await enviar(chat, "Não consegui ler a foto (" + String((err as Error).message || err).slice(0, 120) + "). Manda o valor por texto, ex.: 45,90 ifood"); return; }
    if (lido === null) { await enviar(chat, "Ainda não tenho uma IA ligada pra ler fotos. Enquanto isso, manda por texto: 45,90 ifood"); return; }
    if (!e.valor) e.valor = Number(lido.valor_total) || 0;
    if (!e.desc && lido.estabelecimento) e.desc = String(lido.estabelecimento).slice(0, 60);
    if (e.n === 1 && Number(lido.parcelas) > 1) e.n = Math.min(48, Number(lido.parcelas));
    if (lido.data && /^\d{4}-\d{2}-\d{2}$/.test(lido.data) && Math.abs(Date.parse(lido.data) - Date.parse(data)) < 40 * 864e5) data = lido.data;
  }
  if (!itens.some((e) => e.valor)) { await enviar(chat, "Não achei o valor. Exemplos:\n45,90 ifood nubank\n300 tênis bradesco 3x\n\n/ajuda mostra tudo que eu entendo."); return; }

  // Sem cartão na mensagem: o último usado
  const ult = await lerCfg("telegram_ultimo_cartao");
  const padrao = ult === "pix" ? null : (cartoes || []).find((c: any) => String(c.id) === String(ult)) || (cartoes || [])[0] || null;
  const ids: number[] = [], linhas: string[] = [];
  let ultimoCartao: any = padrao, semNome = false;
  for (const e of itens.filter((x) => x.valor)) {
    const cartao = e.cartao === undefined ? padrao : e.cartao;
    if (!e.desc) { e.desc = "Gasto"; semNome = true; }
    const k = mesFatura(cartao, data);
    const { data: novo, error } = await db.from("pf_compras").insert({
      cartao_id: cartao ? cartao.id : null, descricao: e.desc, valor_parcela: Math.round((e.valor / e.n) * 100) / 100, parcelas: e.n,
      primeiro_mes: k + "-01", data_compra: data, dono: e.dono || null, origem: "rapido",
    }).select("id").single();
    if (error) { await enviar(chat, "Não consegui salvar: " + error.message); return; }
    ids.push(novo.id);
    ultimoCartao = cartao;
    linhas.push(`${e.desc}: ${real(e.valor)}${e.n > 1 ? ` em ${e.n}x de ${real(e.valor / e.n)}` : " à vista"}\n${cartao ? `${cartao.nome}, fatura de ${nomeMes(k)}` : "Pix/débito"}${e.dono ? ` · de ${e.dono}` : ""}`);
  }
  await gravarCfg("telegram_ultimo_id", ids);
  await gravarCfg("telegram_ultimo_cartao", ultimoCartao ? ultimoCartao.id : "pix");
  await enviar(chat, `Lancei ✅\n\n${linhas.join("\n\n")}${semNome ? `\n\nDica: diga onde foi, ex.: "700 mercado"` : ""}`, [{ text: ids.length > 1 ? `↩️ Desfazer os ${ids.length}` : "↩️ Desfazer", callback_data: "undo:" + ids.join(",") }]);
}

// Toque no botão "Desfazer"
async function tratarBotao(cb: any) {
  const chat = cb.message?.chat?.id;
  const conectado = await lerCfg("telegram_chat");
  if (!chat || String(conectado) !== String(chat)) { await tg("answerCallbackQuery", { callback_query_id: cb.id, text: "Este bot é particular." }); return; }
  const m = String(cb.data || "").match(/^undo:([\d,]+)$/);
  if (!m) { await tg("answerCallbackQuery", { callback_query_id: cb.id }); return; }
  const apagados = await apagarLancamentos(m[1].split(",").map(Number));
  await tg("answerCallbackQuery", { callback_query_id: cb.id, text: apagados.length ? "Apagado" : "Já tinha sido apagado" });
  await tg("editMessageText", { chat_id: chat, message_id: cb.message.message_id, text: (cb.message.text || "") .replace(/^Lancei ✅/, "Apagado ↩️") + (apagados.length ? "" : "\n\n(já tinha sido apagado)") });
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
      else if (upd.callback_query) await tratarBotao(upd.callback_query);
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
    // Liga (ou atualiza) o endereço que o Telegram chama a cada mensagem
    const w = await tg("setWebhook", { url: `${URL_BANCO}/functions/v1/gastos`, secret_token: await segredoWebhook(), allowed_updates: ["message", "callback_query"] });
    if (!w.ok) return resposta({ erro: "Não deu para ligar o bot: " + (w.description || "") });
    if (corpo.acao === "conectar") {
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
