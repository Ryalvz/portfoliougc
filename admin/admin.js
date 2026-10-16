/* =============================================================
   PAINEL ADMIN DO RYAN ALVES
   1. Confere o login (antes de mostrar qualquer coisa)
   2. Lê as tabelas do Supabase (se faltar algo, avisa e segue)
   3. Desenha as abas: Portfólio, Marcas, Calendário, Campanhas, Checklist
   ============================================================= */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ic = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const htmlSeguro = (s) => esc(s).replace(/&lt;(\/?)(b|em|strong|i|br)&gt;/g, "<$1$2>");

/* ---------- 1. PORTEIRO: sem login, volta para a tela de entrar ---------- */
(async function porteiro() {
  if (!window.db) {
    document.documentElement.classList.add("liberado");
    document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">Não foi possível carregar o sistema de login. Confira a internet e recarregue a página.</p>';
    return;
  }
  let sessao = null;
  try { sessao = (await db.auth.getSession()).data.session; } catch (_) { sessao = null; }
  const email = sessao ? (sessao.user.email || "").toLowerCase() : "";
  if (!sessao || email !== window.BANCO.emailAdmin) {
    if (sessao) await db.auth.signOut();
    location.replace("../login/");
    return;
  }
  document.documentElement.classList.add("liberado");
  db.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT") location.replace("../login/"); });
  iniciar(sessao);
})();

/* ---------- Datas e números ---------- */
const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hojeISO = () => isoLocal(new Date());
const deISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
// Modo privado: esconde todos os valores em R$ (para mostrar o painel para alguém)
let privado = false;
try { privado = localStorage.getItem("modo-privado") === "1"; } catch (_) {}
const OCULTO = "R$ ••••";
// Quantidade de campanhas/contratos: também some no modo privado
const qtd = (n, um, varios) => (privado ? (varios ? "•• " + varios : "••") : (varios ? plural(n, um, varios) : num(n)));
const real = (v) => (privado ? OCULTO : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0));
const num = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const ordenaTexto = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true }).compare;

/* ---------- Avisos rápidos ---------- */
let timerToast = null;
function avisar(texto, erro) {
  let t = $(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = texto;
  t.classList.toggle("erro", !!erro);
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { t.hidden = true; }, erro ? 6000 : 2500);
}

function traduzErro(e) {
  const m = ((e && e.message) || "").toLowerCase();
  if (m.includes("row-level security") || m.includes("permission denied")) return "Sem permissão para isso. Saia e entre de novo.";
  if (m.includes("jwt") && m.includes("expired")) return "Sua sessão expirou. Saia e entre de novo.";
  if (m.includes("check constraint")) return "Algum campo tem um valor que o banco não aceita.";
  if (m.includes("does not exist") || m.includes("schema cache")) return "Falta algo no banco: " + ((e && e.message) || "") + ". Rode o banco.sql de novo.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão. Confira a internet e tente de novo.";
  return "Não deu para salvar: " + ((e && e.message) || "erro desconhecido");
}

/* ---------- 2. DADOS ---------- */
// Campos que o painel espera em cada tabela
const ESQUEMA = {
  videos: ["id", "titulo", "link", "capa", "nicho", "formato", "marca", "destaque", "ordem", "visivel", "exemplo"],
  marcas: ["id", "nome", "instagram", "email", "telefone", "situacao", "nicho", "favorita", "fixada", "selecionada", "email_enviado_em", "obs", "ultimo_contato", "exemplo", "criado_em"],
  calendario: ["id", "titulo", "marca", "tipo", "data", "hora", "hora_fim", "local", "status", "exemplo"],
  campanhas: ["id", "campanha", "cliente", "tipo", "status", "qtd", "valor", "prazo", "pagamento", "ativa", "favorita", "exemplo"],
  comissoes_ttk: ["id", "data", "valor", "gmv", "itens", "obs"],
  metas: ["ano", "mes", "valor"],
  lembretes_adiados: ["chave", "ate"],
  ig_historico: ["data", "seguidores", "posts"],
  lembretes_rapidos: ["id", "texto", "quando", "feito", "avisado", "criado_em"],
  contatos_site: ["id", "criado_em", "tipo", "nome", "marca", "email", "whats", "mensagem", "visto"],
  contratos: ["id", "cliente", "tipo", "descricao", "valor", "mes", "ano", "data_nf", "prazo_dias", "status", "parcela1", "data_p1", "parcela2", "data_p2", "obs", "qtd", "prazo_entrega", "favorita", "criado_em"],
  transcricoes: ["id", "criado_em", "link", "plataforma", "categoria", "status", "titulo", "transcricao", "transcricao_original", "idioma_original", "minha_versao", "observacoes", "de_quem", "perfil", "tags", "legenda", "postado_em", "andamento", "erro"],
  marcados: ["chave", "marcado"],
  visitas: ["id", "data", "pagina", "origem"]
};
const S = { videos: [], marcas: [], calendario: [], campanhas: [], marcados: {}, visitas: [], transcricoes: [], contratos: [], comissoes: [], metas: [], adiados: [], rapidos: [], contatos_site: [] };
const CAMPOS = {};          // campos que existem de verdade em cada tabela
const FALTAS = new Map();   // tabela -> o que faltou

function registrarFalta(tabela, texto) {
  FALTAS.set(tabela, texto);
  const caixa = $("#avisos");
  caixa.innerHTML = `<div class="aviso-falta" role="alert"><b>Faltou algo no banco de dados.</b> O resto do painel continua funcionando.
    <ul>${[...FALTAS].map(([t, x]) => `<li>Tabela <b>${esc(t)}</b>: ${esc(x)}</li>`).join("")}</ul>
    Para resolver, rode o arquivo banco.sql de novo no SQL Editor do Supabase.</div>`;
}
const temCampo = (tabela, campo) => (CAMPOS[tabela] || []).includes(campo);

async function ler(tabela, ajuste) {
  let campos = ESQUEMA[tabela].slice();
  const faltando = [];
  for (let tentativa = 0; tentativa < 15; tentativa++) {
    let q = db.from(tabela).select(campos.join(","));
    if (ajuste) q = ajuste(q, campos);
    let resp;
    try { resp = await q; } catch (e) { resp = { error: e }; }
    const { data, error } = resp;
    if (!error) {
      CAMPOS[tabela] = campos;
      if (faltando.length) registrarFalta(tabela, "faltam os campos " + faltando.join(", "));
      return data || [];
    }
    const msg = error.message || "";
    const col = msg.match(/column\s+(?:\w+\.)?"?(\w+)"?\s+does not exist/i);
    if (col && campos.includes(col[1])) { faltando.push(col[1]); campos = campos.filter((c) => c !== col[1]); continue; }
    CAMPOS[tabela] = [];
    if (error.code === "PGRST205" || error.code === "42P01" || /does not exist|schema cache/i.test(msg)) registrarFalta(tabela, "a tabela não existe");
    else registrarFalta(tabela, "não deu para ler (" + msg + ")");
    return [];
  }
  return [];
}

async function carregarTudo() {
  const desde = new Date(); desde.setHours(0, 0, 0, 0); desde.setDate(desde.getDate() - 13);
  const [videos, marcas, calendario, campanhas, marcados, visitas, transcricoes, contratos, comissoes, metas, adiados, rapidos, contatos_site] = await Promise.all([
    ler("videos", (q, c) => (c.includes("ordem") ? q.order("ordem", { ascending: true }) : q)),
    ler("marcas", (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }) : q)),
    ler("calendario"),
    Promise.resolve([]), // a tabela antiga de campanhas não é mais usada
    ler("marcados"),
    ler("visitas", (q, c) => (c.includes("data") ? q.gte("data", desde.toISOString()).order("data").limit(10000) : q)),
    ler("transcricoes", (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }) : q)),
    ler("contratos", (q, c) => (c.includes("id") ? q.order("id", { ascending: true }).limit(5000) : q)),
    ler("comissoes_ttk", (q, c) => (c.includes("data") ? q.order("data", { ascending: false }).limit(5000) : q)),
    ler("metas"),
    ler("lembretes_adiados"),
    lerRapidos(),
    lerContatosSite()
  ]);
  Object.assign(S, { videos, marcas, calendario, campanhas, visitas, transcricoes, contratos, comissoes, metas, adiados, rapidos, contatos_site });
  S.marcados = {};
  marcados.forEach((m) => { if (m.chave) S.marcados[m.chave] = m.marcado !== false; });
}

async function gravar(tabela, dados, id) {
  if (!CAMPOS[tabela] || !CAMPOS[tabela].length) { avisar(`A tabela ${tabela} não existe no banco. Rode o banco.sql.`, true); return false; }
  // Só manda os campos que existem no banco
  const limpo = {};
  Object.keys(dados).forEach((k) => { if (temCampo(tabela, k)) limpo[k] = dados[k]; });
  const q = id != null ? db.from(tabela).update(limpo).eq("id", id) : db.from(tabela).insert(limpo);
  const { error } = await q;
  if (error) { avisar(traduzErro(error), true); return false; }
  return true;
}

async function apagarLinha(tabela, id) {
  const { error } = await db.from(tabela).delete().eq("id", id);
  if (error) { avisar(traduzErro(error), true); return false; }
  return true;
}

async function recarregar(tabela) {
  const ajustes = {
    videos: (q, c) => (c.includes("ordem") ? q.order("ordem", { ascending: true }) : q),
    marcas: (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }) : q),
    transcricoes: (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }) : q)
  };
  const chave = tabela === "comissoes_ttk" ? "comissoes" : tabela;
  if (tabela === "comissoes_ttk") ajustes.comissoes_ttk = (q, c) => (c.includes("data") ? q.order("data", { ascending: false }).limit(5000) : q);
  S[chave] = await ler(tabela, ajustes[tabela]);
  desenhar();
}

/* ---------- Janela de formulário (serve para todas as abas) ---------- */
const janela = () => $("#janela");

function campoHTML(c, v) {
  const val = v == null ? "" : v;
  const id = "f-" + c.n;
  const cls = c.inteiro || c.t === "textarea" ? "inteiro" : "";
  const req = c.req ? "required" : "";
  const ph = c.ph ? `placeholder="${esc(c.ph)}"` : "";
  if (c.t === "check") return `<div class="${cls}"><label class="check"><input type="checkbox" name="${c.n}" ${val ? "checked" : ""}> ${esc(c.r)}</label></div>`;
  if (c.t === "file") return `<div class="${cls}"><label for="${id}">${esc(c.r)}</label>
    <input class="campo arquivo" id="${id}" name="${c.n}" type="file" accept="${esc(c.accept || "")}">
    ${c.ajuda ? `<small class="ajuda" data-ajuda="${c.n}">${esc(c.ajuda)}</small>` : ""}</div>`;
  let input;
  if (c.t === "select") input = `<select class="campo" style="width:100%" id="${id}" name="${c.n}">${c.op.map(([ov, ot]) => `<option value="${esc(ov)}" ${String(ov) === String(val) ? "selected" : ""}>${esc(ot)}</option>`).join("")}</select>`;
  else if (c.t === "textarea") input = `<textarea class="campo" id="${id}" name="${c.n}" rows="4" ${ph}>${esc(val)}</textarea>`;
  else input = `<input class="campo" id="${id}" name="${c.n}" type="${c.t || "text"}" value="${esc(String(val).slice(0, c.t === "date" ? 10 : undefined))}" ${c.t === "number" ? 'step="any" min="0"' : ""} ${c.lista ? `list="${id}-lista" autocomplete="off"` : ""} ${req} ${ph}>`
    + (c.lista ? `<datalist id="${id}-lista">${c.lista.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>` : "");
  return `<div class="${cls}"><label for="${id}">${esc(c.r)}${c.req ? " *" : ""}</label>${input}${c.ajuda ? `<small class="ajuda">${esc(c.ajuda)}</small>` : ""}</div>`;
}

function abrirForm({ titulo, tabela, campos, valores = {}, aoSalvar, aoApagar }) {
  const usados = campos.filter((c) => !tabela || c.t === "file" || temCampo(tabela, c.n));
  const d = janela();
  d.innerHTML = `<form class="form-janela" novalidate>
    <div class="janela-topo"><h3>${esc(titulo)}</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div>
    <div class="janela-corpo"><div class="form-grade">${usados.map((c) => campoHTML(c, valores[c.n])).join("")}</div></div>
    <div class="janela-pe">
      ${aoApagar ? `<button type="button" class="btn perigo esq" data-apagar>${ic("apagar")}Apagar</button>` : ""}
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="submit" class="btn primario">Salvar</button>
    </div></form>`;
  const f = $("form", d);
  $$("[data-fechar]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  if (aoApagar) $("[data-apagar]", d).addEventListener("click", async () => {
    if (!(await confirmar("Apagar de vez? Isso não tem como desfazer."))) return;
    if (await aoApagar()) d.close();
  });
  // Mostra o nome e o tamanho do arquivo escolhido
  $$('input[type="file"]', d).forEach((inp) => inp.addEventListener("change", () => {
    const aj = $(`[data-ajuda="${inp.name}"]`, d);
    const arq = inp.files[0];
    if (aj && arq) aj.textContent = `Escolhido: ${arq.name} (${(arq.size / 1048576).toFixed(1).replace(".", ",")} MB)`;
  }));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {};
    for (const c of usados) {
      const el = f.elements[c.n];
      if (c.t === "check") { dados[c.n] = el.checked; continue; }
      if (c.t === "file") { dados[c.n] = el.files[0] || null; continue; }
      let v = el.value.trim();
      if (c.req && !v) { el.focus(); avisar(`Preencha o campo ${c.r}.`, true); return; }
      if (c.t === "number") v = v === "" ? 0 : Number(v.replace(",", "."));
      else if (v === "") v = null;
      dados[c.n] = v;
    }
    const btn = $('button[type="submit"]', f);
    const fechar = $$("[data-fechar], [data-apagar]", d);
    btn.disabled = true;
    fechar.forEach((b) => { b.disabled = true; });
    const status = (t) => { btn.textContent = t; };
    status("Salvando...");
    let ok = false;
    try { ok = await aoSalvar(dados, status); } catch (erro) { avisar(traduzErro(erro), true); }
    btn.disabled = false;
    fechar.forEach((b) => { b.disabled = false; });
    status("Salvar");
    if (ok) { d.close(); avisar("Salvo."); }
  });
  d.showModal();
  const primeiro = $("input:not([type=checkbox]), select, textarea", d);
  if (primeiro) primeiro.focus();
}

function confirmar(texto, rotulo = "Sim, apagar") {
  return new Promise((resolve) => {
    const c = document.createElement("dialog");
    c.innerHTML = `<div class="janela-corpo">${esc(texto)}</div>
      <div class="janela-pe"><button type="button" class="btn" data-n>Cancelar</button><button type="button" class="btn primario" data-s>${esc(rotulo)}</button></div>`;
    document.body.appendChild(c);
    const fim = (r) => { c.close(); c.remove(); resolve(r); };
    $("[data-n]", c).onclick = () => fim(false);
    $("[data-s]", c).onclick = () => fim(true);
    c.addEventListener("cancel", (e) => { e.preventDefault(); fim(false); });
    c.showModal();
    $("[data-n]", c).focus();
  });
}

function abrirJanelaSimples(titulo, corpoHTML, peHTML) {
  const d = janela();
  d.innerHTML = `<div class="janela-topo"><h3>${titulo}</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div>
    <div class="janela-corpo">${corpoHTML}</div>${peHTML ? `<div class="janela-pe">${peHTML}</div>` : ""}`;
  $$("[data-fechar]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  d.showModal();
  return d;
}

/* ---------- CSV que abre certinho no Excel (com acento) ---------- */
function baixarCSV(nome, cabecalho, linhas) {
  const cel = (v) => { const s = v == null ? "" : String(v); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const texto = "﻿" + [cabecalho, ...linhas].map((l) => l.map(cel).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  a.download = `${nome}-${hojeISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- 3. ABAS ---------- */
const DESENHOS = {
  inicio: desenharInicio,
  propostas: desenharPropostas,
  instagram: desenharInstagram,
  portfolio: desenharPortfolio,
  marcas: desenharMarcas,
  prospeccao: desenharProspeccao,
  contrato: desenharContratoPadrao,
  calendario: desenharCalendario,
  campanhas: desenharProducao,
  transcricoes: desenharTranscricoes,
  financeiro: desenharFinanceiro,
  checklist: desenharChecklist
};
let abaAtual = "inicio";

function irPara(aba) {
  if (!DESENHOS[aba]) aba = "inicio";
  if (aba !== "portfolio" && typeof contatosNovosNaTela !== "undefined") contatosNovosNaTela.clear();
  abaAtual = aba;
  $$(".menu-item").forEach((b) => { if (b.dataset.aba === aba) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  $$("main > section").forEach((s) => { s.hidden = s.id !== "aba-" + aba; });
  const titulo = $("#aba-" + aba).dataset.titulo;
  $("#titulo").textContent = titulo;
  $("#titulo-mobile").textContent = titulo;
  document.title = titulo + " | Admin Ryan Alves";
  if (location.hash !== "#" + aba) history.replaceState(null, "", "#" + aba);
  fecharMenu();
  desenhar();
}

function desenhar() {
  const el = $("#aba-" + abaAtual);
  try { pintarLembretes(); } catch (e) { console.error(e); }
  try { DESENHOS[abaAtual](el); }
  catch (e) {
    console.error(e);
    el.innerHTML = `<div class="aviso-falta">Esta aba encontrou um problema e não conseguiu abrir por completo (${esc(e.message)}). As outras abas continuam funcionando.</div>`;
  }
}

// "#campanha-12" abre o financeiro já com a campanha 12 aberta (é o que a notificação do celular manda)
function irParaEndereco() {
  const alvo = (location.hash || "").slice(1) || "inicio";
  const parte = alvo.match(/^instagram-(metricas|reels|plano|carrossel)$/);
  if (parte) { igx.sub = parte[1]; irPara("instagram"); return; }
  const m = alvo.match(/^campanha-(\d+)$/);
  if (!m) { irPara(DESENHOS[alvo] ? alvo : "inicio"); return; }
  irPara("financeiro");
  const c = S.contratos.find((x) => String(x.id) === m[1]);
  if (c) setTimeout(() => formContrato(c), 50); else avisar("Não achei essa campanha. Ela pode ter sido apagada.", true);
}

function fecharMenu() {
  $("#menu").classList.remove("aberto");
  $("#fundo-menu").classList.remove("aberto");
  $("#abrir-menu").setAttribute("aria-expanded", "false");
}

async function iniciar(sessao) {
  $("#email-logado").textContent = sessao.user.email;
  $$(".menu-item").forEach((b) => b.addEventListener("click", () => irPara(b.dataset.aba)));
  $("#sair").addEventListener("click", async () => { await db.auth.signOut(); location.replace("../login/"); });
  $("#abrir-menu").addEventListener("click", () => {
    const aberto = $("#menu").classList.toggle("aberto");
    $("#fundo-menu").classList.toggle("aberto", aberto);
    $("#abrir-menu").setAttribute("aria-expanded", String(aberto));
  });
  $("#fundo-menu").addEventListener("click", fecharMenu);
  $("#abrir-notificacoes").addEventListener("click", () => { fecharMenu(); abrirNotificacoes(); });
  registrarServiceWorker();
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharMenu(); });

  ligarMenuRetratil();
  ligarCabecalho();
  $("#aba-inicio").innerHTML = '<p class="vazio">Carregando seus dados...</p>';
  await carregarTudo();
  irParaEndereco();
  // A cada minuto o sino confere se algum lembrete rápido chegou na hora
  setInterval(() => { try { pintarLembretes(); } catch (_) {} }, 60000);
  // A cada 2 minutos confere se chegou contato novo pelo site
  setInterval(async () => {
    const antes = S.contatos_site.length;
    S.contatos_site = await lerContatosSite();
    if (S.contatos_site.length !== antes) { if (abaAtual === "portfolio" || abaAtual === "inicio") desenhar(); else pintarLembretes(); }
  }, 120000);
  // Tocar numa notificação com o painel já aberto troca de aba
  window.addEventListener("hashchange", () => { const aba = (location.hash || "").slice(1); if (aba && aba !== abaAtual) irParaEndereco(); });
  sincronizarGmail();
}

/* =============================================================
   ABA 1: PORTFÓLIO
   ============================================================= */
const NICHOS = [["beleza", "Beleza"], ["moda", "Moda"], ["fitness", "Fitness"], ["tech", "Tech"]];
const nomeNicho = (n) => (NICHOS.find((x) => x[0] === n) || [n, n || "Sem nicho"])[1];

function desenharPortfolio(el) {
  const hoje = hojeISO();
  const dias = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dias.push(isoLocal(d)); }
  const porDia = Object.fromEntries(dias.map((d) => [d, 0]));
  const origens = {};
  S.visitas.forEach((v) => {
    if (!v.data) return;
    const d = isoLocal(new Date(v.data));
    if (!(d in porDia)) return;
    porDia[d]++;
    const o = v.origem || "Direto";
    origens[o] = (origens[o] || 0) + 1;
  });
  const total14 = dias.reduce((s, d) => s + porDia[d], 0);
  const noAr = S.videos.filter((v) => v.visivel !== false);
  const contaNicho = {};
  noAr.forEach((v) => { if (v.nicho) contaNicho[v.nicho] = (contaNicho[v.nicho] || 0) + 1; });
  const nichoForte = Object.entries(contaNicho).sort((a, b) => b[1] - a[1])[0];
  const listaOrigens = Object.entries(origens).sort((a, b) => b[1] - a[1]);

  const max = Math.max(1, ...dias.map((d) => porDia[d]));
  const grafico = total14 === 0
    ? `<p class="vazio">Ainda não tem visita registrada. Quando as pessoas começarem a abrir o seu portfólio, aqui aparece uma barra por dia mostrando quantas visitas você teve nos últimos 14 dias.</p>`
    : `<div class="grafico" role="img" aria-label="Visitas por dia nos últimos 14 dias">${dias.map((d) => {
        const n = porDia[d];
        return `<div class="barra-g ${d === hoje ? "hoje" : ""}" title="${dataBR(d)}: ${plural(n, "visita", "visitas")}"><b>${n || ""}</b><i style="height:${(n / max) * 100}%"></i><span>${d.slice(8, 10)}/${d.slice(5, 7)}</span></div>`;
      }).join("")}</div>`;
  const listaOrig = listaOrigens.length === 0
    ? `<p class="vazio">Aqui aparece de onde as pessoas chegam ao seu site: Instagram, Google, WhatsApp, link direto.</p>`
    : `<ul class="origens">${listaOrigens.map(([o, n]) => `<li><span>${esc(o)}</span><b>${n}</b><span class="trilho"><i style="width:${(n / total14) * 100}%"></i></span></li>`).join("")}</ul>`;

  el.innerHTML = quadroContatosSite() + `
    <div class="faixa-kpi">
      <div class="kpi"><span>Visitas em 14 dias</span><strong>${num(total14)}</strong></div>
      <div class="kpi"><span>Visitas hoje</span><strong>${num(porDia[hoje])}</strong></div>
      <div class="kpi"><span>Vídeos no ar</span><strong>${num(noAr.length)}</strong></div>
      <div class="kpi"><span>Nicho mais forte</span><strong>${nichoForte ? esc(nomeNicho(nichoForte[0])) : "Nenhum ainda"}</strong>${nichoForte ? `<small>${plural(nichoForte[1], "vídeo", "vídeos")} no ar</small>` : ""}</div>
      <div class="kpi"><span>De onde mais vêm</span><strong>${listaOrigens.length ? esc(listaOrigens[0][0]) : "Nenhuma ainda"}</strong></div>
    </div>
    <div class="grade-2">
      <div class="cartao"><h2>Visitas nos últimos 14 dias</h2>${grafico}</div>
      <div class="cartao"><h2>Por onde chegaram</h2>${listaOrig}</div>
    </div>
    <div class="barra">
      <h2 style="margin:0">Meus vídeos</h2><span class="sub">arraste pela alça para mudar a ordem no site</span>
      <span class="espaco"></span>
      <button class="btn primario" type="button" id="add-video">${ic("mais")}Adicionar vídeo</button>
    </div>
    <div class="tabela-caixa">
      <table>
        <thead><tr><th style="width:30px"><span class="sr-only">Ordem</span></th><th>Título</th><th>Nicho</th><th>Formato</th><th>Marca</th><th>Destaque</th><th>Link</th><th class="num">Ações</th></tr></thead>
        <tbody id="lista-videos">${S.videos.length === 0
          ? `<tr><td colspan="8"><p class="vazio">Nenhum vídeo cadastrado. Clique em Adicionar vídeo e ele aparece no seu portfólio na hora.</p></td></tr>`
          : S.videos.map(linhaVideo).join("")}</tbody>
      </table>
    </div>`;

  $("#add-video").addEventListener("click", () => formVideo());
  ligarContatosSite(el);
  const corpo = $("#lista-videos");
  corpo.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const v = S.videos.find((x) => String(x.id) === tr.dataset.id);
    if (e.target.closest("[data-olho]")) {
      if (await gravar("videos", { visivel: v.visivel === false }, v.id)) { avisar(v.visivel === false ? "Vídeo aparecendo no site." : "Vídeo escondido do site."); recarregar("videos"); }
    } else if (e.target.closest("[data-editar]")) formVideo(v);
    else if (e.target.closest("[data-apagar]")) {
      if (await confirmar(`Apagar o vídeo "${v.titulo}"? Ele sai do site na hora.`) && (await apagarVideo(v))) avisar("Vídeo apagado.");
    }
  });
  ligarArraste(corpo);
}

const linkAbrivel = (l) => (!l ? "" : /^https?:\/\//i.test(l) ? l : "../" + l.replace(/^\.?\//, ""));

function linhaVideo(v) {
  const escondido = v.visivel === false;
  return `<tr data-id="${esc(v.id)}" class="${escondido ? "escondido" : ""}">
    <td><span class="alca" title="Arraste para mudar a ordem" aria-label="Arrastar">${ic("alca")}</span></td>
    <td><b>${esc(v.titulo)}</b>${v.exemplo ? '<span class="pilula p-exemplo">exemplo</span>' : ""}</td>
    <td>${esc(nomeNicho(v.nicho))}</td>
    <td>${esc(v.formato || "")}</td>
    <td>${esc(v.marca || "")}</td>
    <td>${esc(v.destaque || "")}</td>
    <td class="corta">${v.link ? `<a href="${esc(linkAbrivel(v.link))}" target="_blank" rel="noopener">${ehDoStorage(v.link) ? "Vídeo enviado (abrir)" : esc(v.link)}</a>` : ""}</td>
    <td class="acoes">
      <button class="icone-btn" type="button" data-olho title="${escondido ? "Escondido do site. Clique para mostrar" : "Aparecendo no site. Clique para esconder"}" aria-label="${escondido ? "Mostrar no site" : "Esconder do site"}">${ic(escondido ? "olho-fechado" : "olho")}</button>
      <button class="icone-btn" type="button" data-editar aria-label="Editar">${ic("editar")}</button>
      <button class="icone-btn perigo" type="button" data-apagar aria-label="Apagar">${ic("apagar")}</button>
    </td></tr>`;
}

/* ---------- Envio de arquivos para o Storage do Supabase (espaço "portfolio") ---------- */
const BUCKET = "portfolio";
const LIMITE_MB = 50;
const TIPOS_ARQUIVO = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const MARCA_STORAGE = `/storage/v1/object/public/${BUCKET}/`;
const ehDoStorage = (url) => typeof url === "string" && url.includes(MARCA_STORAGE);

function traduzErroArquivo(e) {
  const m = ((e && e.message) || "").toLowerCase();
  if (m.includes("bucket not found")) return "O espaço de vídeos ainda não foi criado no Supabase. Rode a parte 10 do banco.sql.";
  if (m.includes("maximum allowed size") || m.includes("too large") || m.includes("payload")) return `O arquivo passa de ${LIMITE_MB} MB. Exporte em MP4 1080p (no CapCut ou no app Fotos) e tente de novo.`;
  if (m.includes("mime") || m.includes("not supported")) return "Formato não aceito. Use vídeo MP4, MOV ou WEBM, e capa JPG, PNG ou WEBP.";
  if (m.includes("row-level security") || m.includes("unauthorized")) return "Sem permissão para enviar arquivos. Saia e entre de novo.";
  if (m.includes("fetch") || m.includes("network")) return "A internet caiu no meio do envio. Tente de novo.";
  return "Não deu para enviar o arquivo: " + ((e && e.message) || "erro desconhecido");
}

async function enviarArquivo(arquivo, pasta, nomeBase) {
  const nome = (nomeBase || arquivo.name || "arquivo").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "arquivo";
  const ext = (nome.split(".").pop() || "").toLowerCase();
  const tipo = TIPOS_ARQUIVO[ext] || arquivo.type || "application/octet-stream";
  const caminho = `${pasta}/${Date.now()}-${nome}`;
  const { error } = await db.storage.from(BUCKET).upload(caminho, arquivo, { contentType: tipo, cacheControl: "31536000", upsert: false });
  if (error) { avisar(traduzErroArquivo(error), true); return null; }
  return db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

async function removerArquivos(urls) {
  const caminhos = urls.filter(ehDoStorage).map((u) => decodeURIComponent(u.split(MARCA_STORAGE)[1].split("?")[0]));
  if (caminhos.length) { try { await db.storage.from(BUCKET).remove(caminhos); } catch (_) {} }
}

// Tira uma "foto" do vídeo (por volta de 1 segundo) para usar como capa
function capturarCapa(arquivo) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(arquivo);
    let terminou = false;
    const fim = (blob) => { if (terminou) return; terminou = true; clearTimeout(t); URL.revokeObjectURL(url); resolve(blob || null); };
    const t = setTimeout(() => fim(null), 12000);
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    v.addEventListener("loadeddata", () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); }, { once: true });
    v.addEventListener("seeked", () => {
      try {
        if (!v.videoWidth || !v.videoHeight) return fim(null);
        const h = Math.min(960, v.videoHeight), w = Math.round((v.videoWidth / v.videoHeight) * h);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(v, 0, 0, w, h);
        c.toBlob((b) => fim(b), "image/jpeg", 0.8);
      } catch (_) { fim(null); }
    }, { once: true });
    v.addEventListener("error", () => fim(null), { once: true });
  });
}

async function apagarVideo(v) {
  const ok = await apagarLinha("videos", v.id);
  if (ok) { await removerArquivos([v.link, v.capa]); recarregar("videos"); }
  return ok;
}

function formVideo(v) {
  abrirForm({
    titulo: v ? "Editar vídeo" : "Adicionar vídeo",
    tabela: "videos",
    valores: v || { visivel: true, nicho: "beleza" },
    campos: [
      { n: "titulo", r: "Título", req: true, inteiro: true },
      { n: "arquivo", r: v && ehDoStorage(v.link) ? "Trocar o vídeo (opcional)" : "Vídeo do seu computador ou celular", t: "file", accept: "video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm", inteiro: true,
        ajuda: `MP4 ou MOV, até ${LIMITE_MB} MB. Dica: exporte em 1080p no CapCut. A capa é criada sozinha.` },
      { n: "link", r: "Ou cole um link (Reels, TikTok, YouTube)", inteiro: true, ph: "https://..." },
      { n: "capaArquivo", r: "Capa (opcional, se quiser escolher outra)", t: "file", accept: "image/jpeg,image/png,image/webp", inteiro: true, ajuda: "JPG, PNG ou WEBP, de preferência vertical." },
      { n: "nicho", r: "Nicho", t: "select", op: NICHOS },
      { n: "formato", r: "Formato", ph: "Reels, TikTok, Vídeo UGC..." },
      { n: "marca", r: "Marca" },
      { n: "destaque", r: "Destaque", ph: "ex: 2,4M views" },
      { n: "visivel", r: "Aparecer no site", t: "check", inteiro: true }
    ],
    aoSalvar: async (d, status) => {
      const arq = d.arquivo, capaArq = d.capaArquivo;
      delete d.arquivo; delete d.capaArquivo;
      for (const a of [arq, capaArq]) {
        if (a && a.size > LIMITE_MB * 1048576) { avisar(`O arquivo "${a.name}" tem ${(a.size / 1048576).toFixed(0)} MB e o limite é ${LIMITE_MB} MB. Exporte em MP4 1080p e tente de novo.`, true); return false; }
      }
      const enviados = [], antigos = [];
      if (arq) {
        status("Enviando vídeo...");
        const url = await enviarArquivo(arq, "videos");
        if (!url) return false;
        enviados.push(url);
        if (v && v.link !== url) antigos.push(v.link);
        d.link = url;
        if (!capaArq) {
          status("Criando a capa...");
          const foto = await capturarCapa(arq);
          if (foto) {
            const u = await enviarArquivo(foto, "capas", "capa.jpg");
            if (u) { enviados.push(u); if (v) antigos.push(v.capa); d.capa = u; }
          } else if (v && ehDoStorage(v.capa)) { antigos.push(v.capa); d.capa = null; }
        }
      }
      if (capaArq) {
        status("Enviando a capa...");
        const u = await enviarArquivo(capaArq, "capas");
        if (!u) { await removerArquivos(enviados); return false; }
        enviados.push(u);
        if (v) antigos.push(v.capa);
        d.capa = u;
      }
      // Trocou o vídeo enviado por um link? O arquivo antigo sai do Storage.
      if (!arq && v && ehDoStorage(v.link) && d.link !== v.link) antigos.push(v.link);
      if (!v) d.ordem = S.videos.reduce((m, x) => Math.max(m, Number(x.ordem) || 0), 0) + 1;
      status("Salvando...");
      const ok = await gravar("videos", d, v ? v.id : null);
      if (!ok) { await removerArquivos(enviados); return false; }
      await removerArquivos(antigos.filter((u) => !enviados.includes(u)));
      recarregar("videos");
      return true;
    },
    aoApagar: v ? () => apagarVideo(v) : null
  });
}

// Arrastar pela alça para mudar a ordem (funciona com mouse e com o dedo)
function ligarArraste(corpo) {
  let linha = null;
  corpo.addEventListener("pointerdown", (e) => {
    const alca = e.target.closest(".alca");
    if (!alca) return;
    e.preventDefault();
    linha = alca.closest("tr");
    linha.classList.add("arrastando");
    alca.setPointerCapture(e.pointerId);
  });
  corpo.addEventListener("pointermove", (e) => {
    if (!linha) return;
    const alvo = document.elementFromPoint(e.clientX, e.clientY);
    const tr = alvo && alvo.closest("#lista-videos tr[data-id]");
    if (!tr || tr === linha) return;
    const r = tr.getBoundingClientRect();
    corpo.insertBefore(linha, e.clientY < r.top + r.height / 2 ? tr : tr.nextSibling);
  });
  const soltar = async () => {
    if (!linha) return;
    linha.classList.remove("arrastando");
    linha = null;
    const ids = $$("tr[data-id]", corpo).map((tr) => tr.dataset.id);
    const mudou = ids.map((id, i) => ({ id, ordem: i + 1 })).filter(({ id, ordem }) => {
      const v = S.videos.find((x) => String(x.id) === id);
      return v && Number(v.ordem) !== ordem;
    });
    if (!mudou.length) return;
    if (!temCampo("videos", "ordem")) { avisar("Falta o campo ordem na tabela videos.", true); return; }
    const res = await Promise.all(mudou.map(({ id, ordem }) => db.from("videos").update({ ordem }).eq("id", id)));
    const erro = res.find((r) => r.error);
    if (erro) avisar(traduzErro(erro.error), true); else avisar("Ordem salva. O site já mostra assim.");
    recarregar("videos");
  };
  corpo.addEventListener("pointerup", soltar);
  corpo.addEventListener("pointercancel", soltar);
}

/* =============================================================
   ABA 2: MARCAS
   ============================================================= */
const SITUACOES = [["lead", "Lead"], ["conversando", "Conversando"], ["cliente", "Cliente"], ["parada", "Parada"]];
const nomeSituacao = (s) => (SITUACOES.find((x) => x[0] === s) || [s, s || ""])[1];
const filtroMarcas = { busca: "", situacao: "", nicho: "" };
// Nichos sugeridos (você pode escrever outro qualquer no cadastro)
const NICHOS_MARCAS = ["Agência", "Tech", "Casa e decoração", "Moda", "Beleza", "Alimentação", "Bebidas", "Fitness", "Saúde", "Pets", "Infantil", "Finanças", "Educação", "Viagem", "Games", "Automotivo", "Varejo", "Imóveis", "Serviços"];
// Junta "tech", "Tecnologia" e "TECH" no mesmo nicho
function nichoPadrao(v) {
  const t = String(v || "").trim();
  if (!t) return "";
  const k = semAcento(t);
  const pistas = [["Agência", /agencia|agency|plataforma de creator|casting/], ["Varejo", /varejo|e-?commerce|marketplace|loja de departamento/], ["Imóveis", /imove|imobili|construtora|incorporadora/], ["Tech", /^tech|tecnolog|eletronic|gadget|software|app/], ["Casa e decoração", /casa|decor|lar\b|moveis|cozinha|utilidade/], ["Moda", /moda|roupa|vestuario|calcad|acessori|fashion/],
    ["Beleza", /beleza|cosmet|maquiag|skin|cabelo|perfum|beauty/], ["Alimentação", /aliment|comida|food|restaurante|snack/], ["Bebidas", /bebida|drink|cerveja|vinho|cafe/],
    ["Fitness", /fitness|academia|suplement|esporte|treino/], ["Saúde", /saude|farmac|bem.?estar|wellness/], ["Pets", /pet|cachorro|gato|animal/], ["Infantil", /infantil|bebe|crianca|kids|brinquedo/],
    ["Finanças", /financ|banco|fintech|investim|cripto/], ["Educação", /educa|curso|escola|ensino/], ["Viagem", /viage|turismo|hotel|travel/], ["Games", /game|jogo/], ["Automotivo", /auto|carro|moto/]];
  const achou = pistas.find(([, re]) => re.test(k));
  return achou ? achou[0] : t.charAt(0).toUpperCase() + t.slice(1);
}

function linkInstagram(handle) {
  if (!handle) return "";
  const h = String(handle).trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#\s]/)[0];
  return h ? "https://instagram.com/" + encodeURIComponent(h) : "";
}
function linkWhats(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d || /^0+$/.test(d) || d.length < 10) return "";
  if (d.length <= 11) d = "55" + d;
  return "https://wa.me/" + d;
}

/* ---------- Importar planilha de leads ----------
   Você escolhe o arquivo (Excel, CSV ou Numbers exportado), o painel
   descobre sozinho qual coluna é o nome, o @, o e-mail, o telefone...
   mostra uma prévia e sobe só as marcas que ainda não estão na base.
   O que não tem coluna própria (site, nicho, responsável) vai para a
   Observação, para nada se perder. */
const CAMPOS_IMPORT = [["", "Ignorar"], ["nome", "Marca"], ["nicho", "Nicho"], ["instagram", "Instagram"], ["email", "E-mail"], ["telefone", "Telefone"], ["situacao", "Situação"], ["ultimo_contato", "Último contato"], ["obs", "Observação"]];
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const PISTAS_COLUNA = [
  ["nicho", /nicho|segmento|categoria|setor|ramo|area de atuacao/],
  ["email", /e-?mail|correio/],
  ["instagram", /insta|^ig$|arroba|^@|perfil/],
  ["telefone", /telefone|whats|zap|celular|fone|phone|^tel/],
  ["situacao", /status|situac|etapa|fase|andamento/],
  ["ultimo_contato", /ultimo contato|contato em|data|last contact|quando/],
  ["nome", /marca|empresa|nome|brand|company|loja|cliente|razao|fantasia/]
];

let bibliotecaPlanilha = null;
function carregarLeitorPlanilha() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!bibliotecaPlanilha) bibliotecaPlanilha = new Promise((ok, falha) => {
    const sc = document.createElement("script");
    sc.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    sc.onload = () => ok(window.XLSX);
    sc.onerror = () => { bibliotecaPlanilha = null; falha(new Error("Não consegui abrir o leitor de planilhas. Confira a internet e tente de novo.")); };
    document.head.appendChild(sc);
  });
  return bibliotecaPlanilha;
}

function adivinharColuna(titulo, valores) {
  const t = semAcento(titulo);
  for (const [campo, re] of PISTAS_COLUNA) if (t && re.test(t)) return campo;
  // Sem título que ajude: olha o conteúdo
  const amostra = valores.filter(Boolean).slice(0, 20).map(String);
  if (!amostra.length) return "";
  const parte = (re) => amostra.filter((v) => re.test(v)).length / amostra.length;
  if (parte(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) > .6) return "email";
  if (parte(/^@|instagram\.com/i) > .6) return "instagram";
  if (parte(/^[\d\s()+.-]{8,}$/) > .6) return "telefone";
  return "obs";
}

function limparInstagram(v) {
  const t = String(v || "").trim();
  if (!t) return "";
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (m ? m[1] : t).replace(/^@+/, "").replace(/[/?#].*$/, "").trim();
  return h && /^[A-Za-z0-9._]+$/.test(h) ? "@" + h : t.slice(0, 100);
}
function situacaoDaPlanilha(v) {
  const t = semAcento(v);
  if (!t) return "lead";
  if (/cliente|fechad|ganh|contrat/.test(t)) return "cliente";
  if (/convers|negoci|respond|contato|andamento|proposta/.test(t)) return "conversando";
  if (/parad|perd|nao|recus|sem resposta|frio|inativ/.test(t)) return "parada";
  return "lead";
}
function dataDe(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
  if (v instanceof Date && !isNaN(v)) return isoLocal(v);
  const t = String(v).trim();
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) { const a = m[3].length === 2 ? "20" + m[3] : m[3]; return `${a}-${pad(m[2])}-${pad(m[1])}`; }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Lê todas as abas da planilha e acha a linha de títulos de cada uma
async function lerPlanilha(arq) {
  const XLSX = await carregarLeitorPlanilha();
  const wb = XLSX.read(await arq.arrayBuffer(), { type: "array", cellDates: true });
  const blocos = [];
  wb.SheetNames.forEach((aba) => {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: "", raw: true })
      .filter((l) => l.some((c) => String(c).trim() !== ""));
    if (linhas.length < 1) return;
    // A linha de títulos é a primeira (entre as 10 primeiras) com mais palavras conhecidas
    let iTit = 0, melhor = -1;
    linhas.slice(0, 10).forEach((l, i) => {
      const pontos = l.filter((c) => typeof c === "string" && PISTAS_COLUNA.some(([, re]) => re.test(semAcento(c)))).length;
      if (pontos > melhor) { melhor = pontos; iTit = i; }
    });
    const temTitulo = melhor > 0;
    const titulos = temTitulo ? linhas[iTit].map((c) => String(c).trim()) : linhas[0].map((_, j) => `Coluna ${j + 1}`);
    const dados = linhas.slice(temTitulo ? iTit + 1 : 0);
    const largura = Math.max(titulos.length, ...dados.map((l) => l.length));
    while (titulos.length < largura) titulos.push(`Coluna ${titulos.length + 1}`);
    blocos.push({ aba, titulos, dados });
  });
  return blocos;
}

function montarMarcas(blocos, mapas) {
  const chave = (t) => semAcento(t).replace(/^@/, "").replace(/[^a-z0-9]/g, "");
  const existentes = new Set();
  S.marcas.forEach((m) => [m.nome, m.email, m.instagram].forEach((x) => { const k = chave(x); if (k) existentes.add(k); }));
  const novas = [], vistas = new Set();
  let repetidas = 0, vazias = 0;
  blocos.forEach((b, ib) => b.dados.forEach((l) => {
    const m = { nome: "", nicho: "", instagram: "", email: "", telefone: "", situacao: "lead", ultimo_contato: null, obs: [] };
    b.titulos.forEach((tit, j) => {
      const campo = mapas[ib][j], v = l[j];
      if (!campo || v == null || String(v).trim() === "") return;
      if (campo === "obs") { m.obs.push(`${tit}: ${v instanceof Date ? dataBR(isoLocal(v)) : String(v).trim()}`); return; }
      if (campo === "instagram") m.instagram = m.instagram || limparInstagram(v);
      else if (campo === "email") m.email = m.email || String(v).trim().toLowerCase();
      else if (campo === "telefone") m.telefone = m.telefone || String(v).trim();
      else if (campo === "situacao") m.situacao = situacaoDaPlanilha(v);
      else if (campo === "ultimo_contato") m.ultimo_contato = dataDe(v);
      else if (campo === "nome") m.nome = m.nome || String(v).trim();
      else if (campo === "nicho") m.nicho = m.nicho || nichoPadrao(v);
    });
    if (!m.nome) m.nome = m.instagram ? m.instagram.replace(/^@/, "") : m.email ? (m.email.split("@")[1] || "").split(".")[0] : "";
    if (!m.nome) { vazias++; return; }
    const ks = [m.nome, m.email, m.instagram].map(chave).filter(Boolean);
    if (ks.some((k) => existentes.has(k) || vistas.has(k))) { repetidas++; return; }
    ks.forEach((k) => vistas.add(k));
    novas.push({ nome: m.nome.slice(0, 150), nicho: m.nicho.slice(0, 60) || null, instagram: m.instagram.slice(0, 100) || null, email: m.email.slice(0, 200) || null,
      telefone: m.telefone.slice(0, 40) || null, situacao: m.situacao, ultimo_contato: m.ultimo_contato,
      obs: m.obs.length ? ("Importado da planilha. " + m.obs.join(" | ")).slice(0, 3000) : "Importado da planilha." });
  }));
  return { novas, repetidas, vazias };
}

async function importarPlanilha(arq) {
  avisar("Lendo a planilha...");
  let blocos;
  try { blocos = await lerPlanilha(arq); } catch (e) { avisar("Não consegui ler esse arquivo. Salve como Excel (.xlsx) ou CSV e tente de novo. " + (e.message || ""), true); return; }
  if (!blocos.length) { avisar("A planilha está vazia.", true); return; }
  const mapas = blocos.map((b) => b.titulos.map((t, j) => adivinharColuna(t, b.dados.map((l) => l[j]))));
  // Só uma coluna de nome por aba: as outras viram observação
  mapas.forEach((mp) => { let achou = false; mp.forEach((c, j) => { if (c === "nome") { if (achou) mp[j] = "obs"; achou = true; } }); });

  const d = janela();
  const pintar = () => {
    const { novas, repetidas, vazias } = montarMarcas(blocos, mapas);
    d.innerHTML = `<form class="form-janela importar" novalidate>
      <div class="janela-topo"><h3>Importar ${esc(arq.name)}</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div>
      <div class="janela-corpo">
        <p class="importar-resumo"><b>${plural(novas.length, "marca nova", "marcas novas")}</b> para entrar${repetidas ? ` · ${plural(repetidas, "já estava", "já estavam")} na sua base (fica de fora)` : ""}${vazias ? ` · ${plural(vazias, "linha sem nome", "linhas sem nome")}` : ""}</p>
        <p class="sub" style="margin:0 0 6px">Confira o que é cada coluna. Se eu errei alguma, é só trocar:</p>
        ${blocos.map((b, ib) => `<div class="importar-colunas">${blocos.length > 1 ? `<b class="sub">Aba ${esc(b.aba)}</b>` : ""}
          ${b.titulos.map((t, j) => `<label><span title="${esc(t)}">${esc(t)}</span><select class="campo" data-aba="${ib}" data-col="${j}">${CAMPOS_IMPORT.map(([v, r]) => `<option value="${v}" ${mapas[ib][j] === v ? "selected" : ""}>${r}</option>`).join("")}</select></label>`).join("")}</div>`).join("")}
        ${novas.length ? `<div class="tabela-caixa importar-previa"><table><thead><tr><th>Marca</th><th>Nicho</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th></tr></thead>
          <tbody>${novas.slice(0, 8).map((m) => `<tr><td><b>${esc(m.nome)}</b></td><td>${esc(m.nicho || "")}</td><td>${esc(m.instagram || "")}</td><td>${esc(m.email || "")}</td><td>${esc(m.telefone || "")}</td><td>${esc(nomeSituacao(m.situacao))}</td></tr>`).join("")}</tbody></table></div>
          ${novas.length > 8 ? `<p class="sub" style="margin:6px 0 0">e mais ${num(novas.length - 8)}...</p>` : ""}` : `<p class="vazio">Nenhuma marca nova para importar.</p>`}
      </div>
      <div class="janela-pe">
        <button type="button" class="btn" data-fechar>Cancelar</button>
        <button type="submit" class="btn primario" ${novas.length ? "" : "disabled"}>${ic("subir")}Importar ${plural(novas.length, "marca", "marcas")}</button>
      </div></form>`;
    $$("[data-fechar]", d).forEach((b) => b.addEventListener("click", () => d.close()));
    $$("select[data-col]", d).forEach((s) => s.addEventListener("change", () => {
      const ib = Number(s.dataset.aba), j = Number(s.dataset.col);
      if (s.value === "nome") mapas[ib].forEach((c, k) => { if (c === "nome" && k !== j) mapas[ib][k] = "obs"; });
      mapas[ib][j] = s.value; pintar();
    }));
    $("form", d).addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', d); btn.disabled = true;
      let feitas = 0;
      for (let i = 0; i < novas.length; i += 200) {
        btn.textContent = `Subindo ${num(Math.min(i + 200, novas.length))} de ${num(novas.length)}...`;
        const { error } = await db.from("marcas").insert(novas.slice(i, i + 200));
        if (error) { avisar(traduzErro(error), true); break; }
        feitas += Math.min(200, novas.length - i);
      }
      d.close();
      if (feitas) { avisar(`Pronto! ${plural(feitas, "marca entrou", "marcas entraram")} como Lead na sua base.`); filtroMarcas.busca = ""; recarregar("marcas"); }
    });
  };
  pintar();
  d.showModal();
}

// Na lista: o primeiro e-mail, e "+3" quando a marca tem mais (todos aparecem ao passar o mouse)
const temInstaMarcas = () => S.marcas.some((m) => String(m.instagram || "").trim());
function emailsDaMarca(m) {
  const todos = String(m.email || "").split(/[\s,;/]+/).map((x) => x.trim()).filter((x) => x.includes("@"));
  if (!todos.length) return esc(m.email || "");
  return `<a href="mailto:${esc(todos[0])}" title="${esc(todos.join("\n"))}">${esc(todos[0])}</a>${todos.length > 1 ? ` <span class="etq" title="${esc(todos.slice(1).join("\n"))}">+${todos.length - 1}</span>` : ""}`;
}

// Seleção para a prospecção: o resumo em cima da tabela
let listaMarcasVisivel = [];
function pintarBarraSelecao() {
  const caixa = $("#barra-selecao");
  if (!caixa) return;
  const sel = S.marcas.filter((m) => m.selecionada).length;
  const doFiltro = listaMarcasVisivel.filter((m) => primeiroEmail(m) && !m.selecionada);
  caixa.innerHTML = `<span class="barra-selecao-n">${ic("check")}<b>${plural(sel, "marca selecionada", "marcas selecionadas")}</b></span>
    ${doFiltro.length ? `<button type="button" class="link-btn" data-sel-todas>Selecionar as ${num(doFiltro.length)} com e-mail que estão aparecendo</button>` : ""}
    ${sel ? `<button type="button" class="link-btn" data-sel-limpar>Limpar seleção</button>` : ""}
    <span class="espaco"></span>
    ${sel ? `<button type="button" class="btn pequeno primario" data-ir-prosp>${ic("email")}Ir para Prospecção</button>` : `<small class="sub">Marque as caixinhas para escolher pra quem mandar o e-mail.</small>`}`;
  const todas = $("[data-sel-todas]", caixa);
  if (todas) todas.onclick = async () => {
    const ids = doFiltro.map((m) => m.id);
    const { error } = await db.from("marcas").update({ selecionada: true }).in("id", ids);
    if (error) { avisar(traduzErro(error), true); return; }
    doFiltro.forEach((m) => { m.selecionada = true; });
    avisar(`${plural(ids.length, "marca selecionada", "marcas selecionadas")}.`);
    desenhar();
  };
  const limpar = $("[data-sel-limpar]", caixa);
  if (limpar) limpar.onclick = () => limparSelecao();
  const ir = $("[data-ir-prosp]", caixa);
  if (ir) ir.onclick = () => { pro.publico = "selecionadas"; irPara("prospeccao"); };
}

function desenharMarcas(el) {
  // Abas por nicho, com quantas marcas tem em cada uma (as maiores primeiro)
  const contaNicho = {};
  S.marcas.forEach((m) => { const n = nichoPadrao(m.nicho) || "Sem nicho"; contaNicho[n] = (contaNicho[n] || 0) + 1; });
  const nichos = Object.entries(contaNicho).sort((a, b) => (a[0] === "Sem nicho") - (b[0] === "Sem nicho") || b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
  if (filtroMarcas.nicho && filtroMarcas.nicho !== "★" && !contaNicho[filtroMarcas.nicho]) filtroMarcas.nicho = "";
  if (filtroMarcas.nicho === "★" && !S.marcas.some((m) => m.favorita)) filtroMarcas.nicho = "";
  el.innerHTML = `
    <div class="abas-nicho" role="tablist" aria-label="Nichos">
      <button type="button" role="tab" class="aba-nicho" data-nicho="" aria-selected="${!filtroMarcas.nicho}">Todos <span>${qtd(S.marcas.length)}</span></button>
      ${S.marcas.some((m) => m.favorita) ? `<button type="button" role="tab" class="aba-nicho aba-favoritas" data-nicho="★" aria-selected="${filtroMarcas.nicho === "★"}">${ic("estrela")}Favoritas <span>${qtd(S.marcas.filter((m) => m.favorita).length)}</span></button>` : ""}
      ${nichos.map(([n, q]) => `<button type="button" role="tab" class="aba-nicho" data-nicho="${esc(n)}" aria-selected="${filtroMarcas.nicho === n}">${esc(n)} <span>${qtd(q)}</span></button>`).join("")}
    </div>
    <div class="barra">
      <div class="busca">${ic("busca")}<input type="search" id="busca-marcas" placeholder="Buscar por nome, @ ou e-mail" value="${esc(filtroMarcas.busca)}" aria-label="Buscar marcas"></div>
      <select class="campo" id="filtro-situacao" aria-label="Filtrar por situação">
        <option value="">Todas as situações</option>
        ${SITUACOES.map(([v, t]) => `<option value="${v}" ${filtroMarcas.situacao === v ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <span class="espaco"></span>
      <button class="btn" type="button" id="csv-marcas">${ic("baixar")}Baixar CSV</button>
      <button class="btn" type="button" id="importar-marcas">${ic("subir")}Importar planilha</button>
      <input type="file" id="arquivo-marcas" accept=".xlsx,.xls,.csv,.tsv,.ods,.numbers" hidden>
      <button class="btn primario" type="button" id="add-marca">${ic("mais")}Adicionar marca</button>
    </div>
    ${temProspeccao() ? `<div class="barra-selecao" id="barra-selecao"></div>` : ""}
    <div class="tabela-caixa">
      <table>
        <thead><tr>${temProspeccao() ? `<th class="col-sel"><span class="sr">Selecionar</span></th>` : ""}<th class="col-acoes-marca"><span class="sr">Favoritar e fixar</span></th><th>Marca</th><th>Nicho</th>${temInstaMarcas() ? "<th>Instagram</th>" : ""}<th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th></tr></thead>
        <tbody id="lista-marcas"></tbody>
      </table>
    </div>
    <p class="contagem" id="conta-marcas"></p>`;

  const pintar = () => {
    const q = filtroMarcas.busca.toLowerCase().replace(/^@/, "");
    const lista = S.marcas.filter((m) => {
      if (filtroMarcas.situacao && m.situacao !== filtroMarcas.situacao) return false;
      if (filtroMarcas.nicho === "★") { if (!m.favorita) return false; }
      else if (filtroMarcas.nicho && (nichoPadrao(m.nicho) || "Sem nicho") !== filtroMarcas.nicho) return false;
      if (!q) return true;
      return [m.nome, m.instagram, m.email].some((x) => String(x || "").toLowerCase().replace(/^@/, "").includes(q));
    }).sort((a, b) => (b.fixada === true) - (a.fixada === true)); // fixadas sempre no topo
    listaMarcasVisivel = lista;
    $("#lista-marcas").innerHTML = lista.length === 0
      ? `<tr><td colspan="10"><p class="vazio">${S.marcas.length ? "Nenhuma marca com esse filtro." : "Sua base está vazia. Quem mandar o formulário do site aparece aqui como Lead."}</p></td></tr>`
      : lista.map((m) => {
          const ig = linkInstagram(m.instagram), wa = linkWhats(m.telefone);
          const temEmail = !!primeiroEmail(m);
          return `<tr class="clicavel ${m.fixada ? "fixada" : ""} ${m.selecionada ? "selecionada" : ""}" data-id="${esc(m.id)}">
            ${temProspeccao() ? `<td class="col-sel"><input type="checkbox" data-sel ${m.selecionada ? "checked" : ""} ${temEmail ? "" : "disabled"} aria-label="Selecionar ${esc(m.nome)}" title="${temEmail ? (m.email_enviado_em ? "Recebeu seu e-mail em " + dataBR(m.email_enviado_em) : "Selecionar para a prospecção") : "Sem e-mail, não dá para selecionar"}"></td>` : ""}
            <td class="acoes-marca">
              <button class="icone-btn estrela ${m.favorita ? "on" : ""}" type="button" data-marca-fav aria-pressed="${!!m.favorita}" aria-label="${m.favorita ? "Tirar dos favoritos" : "Favoritar"} ${esc(m.nome)}" title="${m.favorita ? "Tirar dos favoritos" : "Favoritar"}">${ic("estrela")}</button>
              <button class="icone-btn alfinete ${m.fixada ? "on" : ""}" type="button" data-marca-fixar aria-pressed="${!!m.fixada}" aria-label="${m.fixada ? "Desafixar" : "Fixar no topo"} ${esc(m.nome)}" title="${m.fixada ? "Desafixar" : "Fixar no topo"}">${ic("fixar")}</button>
            </td>
            <td><b>${esc(m.nome)}</b>${m.exemplo ? '<span class="pilula p-exemplo">exemplo</span>' : ""}</td>
            <td>${m.nicho ? `<span class="etq">${esc(nichoPadrao(m.nicho))}</span>` : ""}</td>
            ${temInstaMarcas() ? `<td>${ig ? `<a href="${ig}" target="_blank" rel="noopener">${esc(m.instagram)}</a>` : esc(m.instagram || "")}</td>` : ""}
            <td class="col-email">${emailsDaMarca(m)}</td>
            <td style="white-space:nowrap">${esc(m.telefone || "")} ${wa ? `<a class="icone-btn" href="${wa}" target="_blank" rel="noopener" title="Abrir no WhatsApp" aria-label="Abrir ${esc(m.nome)} no WhatsApp">${ic("whats")}</a>` : ""}</td>
            <td><span class="pilula p-${esc(m.situacao)}">${esc(nomeSituacao(m.situacao))}</span></td>
            <td class="corta" title="${esc(m.obs || "")}">${esc(m.obs || "")}</td>
            <td>${dataBR(m.ultimo_contato)}</td></tr>`;
        }).join("");
    pintarBarraSelecao();
    $("#conta-marcas").textContent = lista.length === S.marcas.length
      ? plural(S.marcas.length, "marca", "marcas")
      : `${lista.length} de ${plural(S.marcas.length, "marca", "marcas")}`;
  };
  pintar();

  $("#busca-marcas").addEventListener("input", (e) => { filtroMarcas.busca = e.target.value; pintar(); });
  $$("[data-nicho]", el).forEach((b) => b.addEventListener("click", () => { filtroMarcas.nicho = b.dataset.nicho; desenhar(); }));
  $("#filtro-situacao").addEventListener("change", (e) => { filtroMarcas.situacao = e.target.value; pintar(); });
  $("#add-marca").addEventListener("click", () => formMarca());
  $("#importar-marcas").addEventListener("click", () => $("#arquivo-marcas").click());
  $("#arquivo-marcas").addEventListener("change", (e) => { const arq = e.target.files[0]; e.target.value = ""; if (arq) importarPlanilha(arq); });
  $("#csv-marcas").addEventListener("click", () => baixarCSV("marcas",
    ["Marca", "Nicho", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"],
    S.marcas.map((m) => [m.nome, nichoPadrao(m.nicho), m.instagram, m.email, m.telefone, nomeSituacao(m.situacao), m.obs, dataBR(m.ultimo_contato)])));
  $("#lista-marcas").addEventListener("change", async (e) => {
    const cx = e.target.closest("[data-sel]");
    if (!cx) return;
    const m = S.marcas.find((x) => String(x.id) === cx.closest("tr").dataset.id);
    if (await gravar("marcas", { selecionada: cx.checked }, m.id)) { m.selecionada = cx.checked; cx.closest("tr").classList.toggle("selecionada", cx.checked); pintarBarraSelecao(); }
    else cx.checked = !cx.checked;
  });
  $("#lista-marcas").addEventListener("click", async (e) => {
    if (e.target.closest("[data-sel], .col-sel")) return;
    const marcar = e.target.closest("[data-marca-fav], [data-marca-fixar]");
    if (marcar) {
      if (!temCampo("marcas", "favorita")) { avisar("Falta rodar a parte 22 do banco.sql no Supabase.", true); return; }
      const m = S.marcas.find((x) => String(x.id) === marcar.closest("tr").dataset.id);
      const campo = marcar.hasAttribute("data-marca-fav") ? "favorita" : "fixada";
      const novo = !m[campo];
      if (await gravar("marcas", { [campo]: novo }, m.id)) {
        m[campo] = novo;
        avisar(campo === "favorita" ? (novo ? `${m.nome} entrou nos favoritos.` : `${m.nome} saiu dos favoritos.`) : (novo ? `${m.nome} fixada no topo.` : `${m.nome} desafixada.`));
        desenhar();
      }
      return;
    }
    if (e.target.closest("a, button")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) formMarca(S.marcas.find((m) => String(m.id) === tr.dataset.id));
  });
}

function formMarca(m, extra = {}) {
  abrirForm({
    titulo: m ? "Editar marca" : "Adicionar marca",
    tabela: "marcas",
    valores: m || { situacao: "lead", ultimo_contato: hojeISO(), ...(extra.valores || {}) },
    campos: [
      { n: "nome", r: "Marca", req: true, inteiro: true },
      { n: "nicho", r: "Nicho", ph: "Tech, Moda, Casa e decoração...", lista: [...new Set(NICHOS_MARCAS.concat(S.marcas.map((x) => nichoPadrao(x.nicho)).filter(Boolean)))] },
      { n: "instagram", r: "Instagram", ph: "@marca" },
      { n: "email", r: "E-mail", t: "email" },
      { n: "telefone", r: "Telefone", t: "tel", ph: "(11) 90000-0000" },
      { n: "situacao", r: "Situação", t: "select", op: SITUACOES },
      { n: "ultimo_contato", r: "Último contato", t: "date" },
      { n: "obs", r: "Observação", t: "textarea" }
    ],
    aoSalvar: async (d) => { if ("nicho" in d) d.nicho = nichoPadrao(d.nicho) || null; const ok = await gravar("marcas", d, m ? m.id : null); if (ok) { recarregar("marcas"); if (extra.depois) extra.depois(); } return ok; },
    aoApagar: m ? async () => { const ok = await apagarLinha("marcas", m.id); if (ok) recarregar("marcas"); return ok; } : null
  });
}

/* =============================================================
   ABA 3: CALENDÁRIO
   ============================================================= */
const TIPOS_CAL = [["gravar", "Gravar"], ["editar", "Editar"], ["postar", "Postar"], ["reuniao", "Reunião"], ["compromisso", "Compromisso"]];
// "16:00:00" vira "16h", "16:30:00" vira "16h30"
const horaCurta = (h) => { if (!h) return ""; const [hh, mm] = String(h).split(":"); return `${Number(hh)}h${mm && mm !== "00" ? mm : ""}`; };
const cal = { mes: new Date(new Date().getFullYear(), new Date().getMonth(), 1), filtro: "todos" };

function eventosCalendario() {
  const itens = S.calendario.filter((c) => c.data).map((c) => ({
    tipo: c.tipo || "gravar", titulo: c.titulo, marca: c.marca, data: String(c.data).slice(0, 10),
    hora: c.hora ? String(c.hora).slice(0, 5) : "", horaFim: c.hora_fim ? String(c.hora_fim).slice(0, 5) : "", local: c.local || "",
    feito: c.status === "feito", origem: "calendario", ref: c
  }));
  // Prazos de entrega das campanhas (tabela contratos)
  const prazos = S.contratos.filter((c) => c.prazo_entrega && fechado(c)).map((c) => ({
    tipo: "prazo", titulo: "Entrega: " + c.cliente, marca: c.descricao, data: String(c.prazo_entrega).slice(0, 10),
    feito: c.status === "Entregue" || c.status === "Pago", origem: "campanha", ref: c
  }));
  // No mesmo dia: primeiro o que tem horário (em ordem), depois o resto
  return itens.concat(prazos).sort((a, b) => a.data.localeCompare(b.data) || (a.hora || "99").localeCompare(b.hora || "99"));
}

function desenharCalendario(el) {
  const hoje = hojeISO();
  const todos = eventosCalendario();
  const visiveis = todos.filter((e) => cal.filtro === "todos" || e.tipo === cal.filtro);
  const porData = {};
  visiveis.forEach((e) => { (porData[e.data] = porData[e.data] || []).push(e); });
  Object.values(porData).forEach((l) => l.sort((a, b) => a.feito - b.feito || (a.tipo === "prazo" ? -1 : 0)));

  const ano = cal.mes.getFullYear(), mes = cal.mes.getMonth();
  const primeiro = new Date(ano, mes, 1);
  const recuo = (primeiro.getDay() + 6) % 7; // segunda = 0
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const totalCelulas = Math.ceil((recuo + diasNoMes) / 7) * 7;
  const nomeMes = primeiro.toLocaleDateString("pt-BR", { month: "long" }).replace(/^./, (c) => c.toUpperCase()) + " de " + ano;

  let celulas = "";
  for (let i = 0; i < totalCelulas; i++) {
    const d = new Date(ano, mes, 1 - recuo + i);
    const iso = isoLocal(d);
    const lista = porData[iso] || [];
    const extra = lista.length - 3;
    celulas += `<div class="dia ${d.getMonth() !== mes ? "fora" : ""} ${iso === hoje ? "hoje" : ""}" data-data="${iso}">
      <span class="dia-num">${d.getDate()}</span>
      <button class="dia-mais" type="button" data-novo="${iso}" aria-label="Adicionar em ${dataBR(iso)}">${ic("mais")}</button>
      ${lista.slice(0, 3).map((e, k) => `<button type="button" class="item-cal t-${e.tipo} ${e.feito ? "feito" : ""}" data-ev="${iso}|${k}" title="${esc((e.hora ? horaCurta(e.hora) + " " : "") + e.titulo)}">${e.hora ? `<b class="hora-cal">${horaCurta(e.hora)}</b> ` : ""}${esc(e.titulo)}</button>`).join("")}
      ${extra > 0 ? `<button type="button" class="mais-itens" data-dia="${iso}">+${extra} mais</button>` : ""}
    </div>`;
  }

  const atrasados = todos.filter((e) => !e.feito && e.data < hoje).sort((a, b) => (a.data < b.data ? -1 : 1));

  el.innerHTML = `
    <div class="cal-topo">
      <button class="icone-btn" type="button" id="mes-ant" aria-label="Mês anterior">${ic("esq")}</button>
      <h2 aria-live="polite">${esc(nomeMes)}</h2>
      <button class="icone-btn" type="button" id="mes-prox" aria-label="Próximo mês">${ic("dir")}</button>
      <button class="btn" type="button" id="mes-hoje">Este mês</button>
      <span class="espaco" style="flex:1"></span>
      <div class="chips" role="group" aria-label="Filtrar por tipo">
        ${[["todos", "Todos"], ...TIPOS_CAL, ["prazo", "Prazos"]].map(([v, t]) => `<button class="chip" type="button" data-filtro="${v}" aria-pressed="${cal.filtro === v}">${t}</button>`).join("")}
      </div>
      <button class="btn" type="button" id="agenda-iphone">${ic("calendario")}${temAgendaGoogle() ? "iPhone e Google" : "Ver no iPhone"}</button>
      <button class="btn primario" type="button" id="add-cal">${ic("mais")}Adicionar</button>
    </div>
    <div class="cal">
      <div class="cal-semana">${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => `<div>${d}</div>`).join("")}</div>
      <div class="cal-grade" id="cal-grade">${celulas}</div>
    </div>
    <div class="cartao" style="margin-top:16px">
      <h2>Ficou pra trás</h2>
      ${atrasados.length === 0 ? `<p class="vazio">Nada atrasado. Tudo que passou do dia está feito.</p>` : `<ul class="atrasados">${atrasados.map((e, i) => {
        const n = diasEntre(e.data, hoje);
        return `<li><span class="pilula item-cal t-${e.tipo}" style="width:auto;margin:0">${e.tipo === "prazo" ? "Prazo" : esc(nomeTipo(e.tipo))}</span>
          <span class="tit">${esc(e.titulo)}${e.marca ? ` <span class="sub">· ${esc(e.marca)}</span>` : ""}</span>
          <span class="etq vermelha">há ${plural(n, "dia", "dias")}</span>
          <button class="btn" type="button" data-atraso="${i}">${e.origem === "calendario" ? ic("check") + "Marcar feito" : "Abrir campanha"}</button></li>`;
      }).join("")}</ul>`}
    </div>`;

  $("#mes-ant").onclick = () => { cal.mes = new Date(ano, mes - 1, 1); desenhar(); };
  $("#mes-prox").onclick = () => { cal.mes = new Date(ano, mes + 1, 1); desenhar(); };
  $("#mes-hoje").onclick = () => { const h = new Date(); cal.mes = new Date(h.getFullYear(), h.getMonth(), 1); desenhar(); };
  $$("[data-filtro]", el).forEach((b) => b.onclick = () => { cal.filtro = b.dataset.filtro; desenhar(); });
  $("#add-cal").onclick = () => formCalendario(null, hoje);
  $("#agenda-iphone").onclick = abrirAgendaIphone;
  // Ao abrir o Calendário, busca no Google o que você criou no iPhone
  if (!agendaG.abriu) { agendaG.abriu = true; sincronizarAgendaGoogle(true); }

  $("#cal-grade").addEventListener("click", (e) => {
    const ev = e.target.closest("[data-ev]");
    if (ev) { const [iso, k] = ev.dataset.ev.split("|"); abrirEvento(porData[iso][Number(k)]); return; }
    const mais = e.target.closest("[data-dia]");
    if (mais) { abrirDia(mais.dataset.dia, porData[mais.dataset.dia] || []); return; }
    const novo = e.target.closest("[data-novo]");
    if (novo) { formCalendario(null, novo.dataset.novo); return; }
    const dia = e.target.closest(".dia");
    if (dia) formCalendario(null, dia.dataset.data);
  });

  $$("[data-atraso]", el).forEach((b) => b.onclick = async () => {
    const e = atrasados[Number(b.dataset.atraso)];
    if (e.origem === "calendario") { if (await gravar("calendario", { status: "feito" }, e.ref.id)) { avisar("Marcado como feito."); recarregar("calendario"); sincronizarAgendaGoogle(); } }
    else formContrato(e.ref);
  });
}

const nomeTipo = (t) => (TIPOS_CAL.find((x) => x[0] === t) || [t, t === "prazo" ? "Prazo" : t])[1];
function abrirEvento(e) { if (e.origem === "calendario") formCalendario(e.ref); else formContrato(e.ref); }

function abrirDia(iso, lista) {
  const d = abrirJanelaSimples(
    esc(deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })),
    `<div style="display:grid;gap:4px">${lista.map((e, k) => `<button type="button" class="item-cal t-${e.tipo} ${e.feito ? "feito" : ""}" data-k="${k}" style="font-size:13px;padding:6px 8px">${e.hora ? `<b>${horaCurta(e.hora)}${e.horaFim ? " às " + horaCurta(e.horaFim) : ""}</b> · ` : ""}${esc(nomeTipo(e.tipo))}: ${esc(e.titulo)}${e.marca ? " · " + esc(e.marca) : ""}${e.local ? " · " + esc(e.local) : ""}</button>`).join("")}</div>`,
    `<button type="button" class="btn primario" data-novo>${ic("mais")}Adicionar neste dia</button>`
  );
  $$("[data-k]", d).forEach((b) => b.onclick = () => { d.close(); abrirEvento(lista[Number(b.dataset.k)]); });
  $("[data-novo]", d).onclick = () => { d.close(); formCalendario(null, iso); };
}

// Post que veio do Plano da semana: abre o conteúdo (ganchos, roteiro, legenda) antes do formulário
async function formCalendario(c, dataPadrao) {
  if (c && c.tipo === "postar") {
    if (igx.planos === null) await carregarPlanos();
    for (const p of igx.planos || []) {
      const it = ((p.itens || {}).itens || []).find((x) => `${x.formato}: ${x.tema}`.slice(0, 200) === c.titulo);
      if (it) { abrirPostDoPlano(p, it, c); return; }
    }
  }
  formCalendarioBase(c, dataPadrao);
}
function formCalendarioBase(c, dataPadrao) {
  abrirForm({
    titulo: c ? "Editar compromisso" : "Novo compromisso no calendário",
    tabela: "calendario",
    valores: c ? { ...c, hora: c.hora ? String(c.hora).slice(0, 5) : "", hora_fim: c.hora_fim ? String(c.hora_fim).slice(0, 5) : "" }
      : { data: dataPadrao, tipo: cal.filtro !== "todos" && cal.filtro !== "prazo" ? cal.filtro : "gravar", status: "a fazer" },
    campos: [
      { n: "titulo", r: "O que é", req: true, inteiro: true, ph: "Ex.: Reunião com a Canva" },
      { n: "tipo", r: "Tipo", t: "select", op: TIPOS_CAL },
      { n: "marca", r: "Marca" },
      { n: "data", r: "Data", t: "date", req: true },
      { n: "status", r: "Situação", t: "select", op: [["a fazer", "A fazer"], ["feito", "Feito"]] },
      { n: "hora", r: "Começa às (opcional)", t: "time" },
      { n: "hora_fim", r: "Termina às (opcional)", t: "time" },
      { n: "local", r: "Local ou link (opcional)", inteiro: true, ph: "Endereço, Google Meet, Zoom..." }
    ],
    aoSalvar: async (d) => {
      if (d.hora_fim && !d.hora) { avisar("Coloque também a hora de começo.", true); return false; }
      if (d.hora && d.hora_fim && d.hora_fim <= d.hora) { avisar("A hora de término precisa ser depois da hora de começo.", true); return false; }
      const ok = await gravar("calendario", d, c ? c.id : null); if (ok) { recarregar("calendario"); sincronizarAgendaGoogle(); } return ok; },
    aoApagar: c ? async () => { const ok = await apagarLinha("calendario", c.id); if (ok) { recarregar("calendario"); sincronizarAgendaGoogle(); } return ok; } : null
  });
}

/* =============================================================
   ABA 4: CAMPANHAS
   ============================================================= */
const STATUS = ["Briefing", "Roteiro", "Aprovação Roteiro", "Gravação", "Edição", "Aprovado", "Entregue"];
const camp = { filtro: "todas", busca: "", col: "prazo", dir: 1 };

const COLUNAS_CAMP = [
  { k: "favorita", r: "★", cmp: (a, b) => (b.favorita === true) - (a.favorita === true) },
  { k: "campanha", r: "Campanha", cmp: (a, b) => ordenaTexto(a.campanha || "", b.campanha || "") },
  { k: "cliente", r: "Cliente", cmp: (a, b) => ordenaTexto(a.cliente || "", b.cliente || "") },
  { k: "tipo", r: "Tipo", cmp: (a, b) => ordenaTexto(a.tipo || "", b.tipo || "") },
  { k: "status", r: "Status", cmp: (a, b) => STATUS.indexOf(a.status) - STATUS.indexOf(b.status) },
  { k: "qtd", r: "Qtd", num: true, cmp: (a, b) => (Number(a.qtd) || 0) - (Number(b.qtd) || 0) },
  { k: "valor", r: "Valor", num: true, cmp: (a, b) => (Number(a.valor) || 0) - (Number(b.valor) || 0) },
  { k: "prazo", r: "Prazo", cmp: (a, b) => (a.prazo || "").localeCompare(b.prazo || "") },
  { k: "pagamento", r: "Pagamento", cmp: (a, b) => (a.pagamento === "pago") - (b.pagamento === "pago") }
];

function avisoPrazo(c) {
  if (!c.prazo || c.status === "Entregue") return "";
  const d = diasEntre(hojeISO(), c.prazo);
  if (d < 0) return `<span class="etq vermelha">${plural(-d, "dia", "dias")} atrasada</span>`;
  if (d === 0) return `<span class="etq amarela">vence hoje</span>`;
  if (d <= 3) return `<span class="etq amarela">vence em ${plural(d, "dia", "dias")}</span>`;
  return "";
}

function desenharCampanhas(el) {
  const todas = S.campanhas;
  const soma = (l, f) => l.reduce((s, c) => s + (Number(c[f]) || 0), 0);
  const valorTotal = soma(todas, "valor");
  const qtdTotal = soma(todas, "qtd");
  const aReceber = soma(todas.filter((c) => c.pagamento !== "pago"), "valor");
  const recebido = soma(todas.filter((c) => c.pagamento === "pago"), "valor");
  const ativas = todas.filter((c) => c.ativa !== false).length;

  el.innerHTML = `
    <div class="faixa-kpi">
      <div class="kpi"><span>Campanhas</span><strong>${num(todas.length)}</strong></div>
      <div class="kpi"><span>Ativas</span><strong>${num(ativas)}</strong></div>
      <div class="kpi"><span>Valor total</span><strong>${real(valorTotal)}</strong><small>${qtdTotal > 0 ? `ticket médio ${real(valorTotal / qtdTotal)} por vídeo` : "ticket médio aparece com vídeos"}</small></div>
      <div class="kpi"><span>A receber</span><strong>${real(aReceber)}</strong><small>já recebido ${real(recebido)}</small></div>
    </div>
    <div class="barra">
      <div class="chips" role="group" aria-label="Filtrar campanhas">
        ${[["todas", "Todas"], ["ativas", "Ativas"], ["finalizadas", "Finalizadas"]].map(([v, t]) => `<button class="chip" type="button" data-f="${v}" aria-pressed="${camp.filtro === v}">${t}</button>`).join("")}
      </div>
      <div class="busca">${ic("busca")}<input type="search" id="busca-camp" placeholder="Buscar campanha ou cliente" value="${esc(camp.busca)}" aria-label="Buscar campanhas"></div>
      <span class="espaco"></span>
      <button class="btn" type="button" id="csv-camp">${ic("baixar")}Baixar CSV</button>
      <button class="btn primario" type="button" id="add-camp">${ic("mais")}Nova campanha</button>
    </div>
    <div class="tabela-caixa">
      <table>
        <thead><tr>${COLUNAS_CAMP.map((c) => `<th class="ordena ${c.num ? "num" : ""} ${camp.col === c.k ? "ativa" : ""}" data-col="${c.k}" aria-sort="${camp.col === c.k ? (camp.dir > 0 ? "ascending" : "descending") : "none"}" tabindex="0">${c.k === "favorita" ? '<span aria-label="Favorita">★</span>' : c.r}<span class="seta" aria-hidden="true">${camp.col === c.k ? (camp.dir > 0 ? "▲" : "▼") : "↕"}</span></th>`).join("")}</tr></thead>
        <tbody id="lista-camp"></tbody>
      </table>
    </div>
    <p class="contagem" id="conta-camp"></p>`;

  const pintar = () => {
    const q = camp.busca.toLowerCase();
    const col = COLUNAS_CAMP.find((c) => c.k === camp.col) || COLUNAS_CAMP[7];
    const lista = todas.filter((c) => {
      if (camp.filtro === "ativas" && c.ativa === false) return false;
      if (camp.filtro === "finalizadas" && c.ativa !== false) return false;
      return !q || [c.campanha, c.cliente].some((x) => String(x || "").toLowerCase().includes(q));
    }).sort((a, b) => {
      if (col.k === "prazo") { // sem prazo vai sempre para o fim
        if (!a.prazo && b.prazo) return 1;
        if (a.prazo && !b.prazo) return -1;
      }
      return col.cmp(a, b) * camp.dir || ordenaTexto(a.campanha || "", b.campanha || "");
    });
    $("#lista-camp").innerHTML = lista.length === 0
      ? `<tr><td colspan="9"><p class="vazio">${todas.length ? "Nenhuma campanha com esse filtro." : "Nenhuma campanha ainda. Clique em Nova campanha."}</p></td></tr>`
      : lista.map((c) => `<tr class="clicavel ${c.favorita ? "favorita" : ""}" data-id="${esc(c.id)}">
          <td><button class="icone-btn estrela ${c.favorita ? "on" : ""}" type="button" data-estrela aria-pressed="${!!c.favorita}" aria-label="${c.favorita ? "Tirar destaque" : "Destacar campanha"}">${ic("estrela")}</button></td>
          <td><b>${esc(c.campanha)}</b>${c.exemplo ? '<span class="pilula p-exemplo">exemplo</span>' : ""}</td>
          <td>${esc(c.cliente || "")}</td>
          <td><span class="pilula ${c.tipo === "Publicidade" ? "p-publicidade" : "p-conteudo"}">${esc(c.tipo || "")}</span></td>
          <td><span class="pilula p-s${Math.max(0, STATUS.indexOf(c.status))}">${esc(c.status || "")}</span></td>
          <td class="num">${num(c.qtd)}</td>
          <td class="num">${real(c.valor)}</td>
          <td style="white-space:nowrap">${dataBR(c.prazo)}${avisoPrazo(c)}</td>
          <td><span class="pilula ${c.pagamento === "pago" ? "p-pago" : "p-pendente"}">${c.pagamento === "pago" ? "Pago" : "Pendente"}</span></td></tr>`).join("");
    $("#conta-camp").textContent = `${lista.length} de ${plural(todas.length, "campanha", "campanhas")}`;
  };
  pintar();

  $$("[data-f]", el).forEach((b) => b.onclick = () => { camp.filtro = b.dataset.f; desenhar(); });
  $("#busca-camp").addEventListener("input", (e) => { camp.busca = e.target.value; pintar(); });
  const ordenar = (th) => {
    const k = th.dataset.col;
    if (camp.col === k) camp.dir *= -1; else { camp.col = k; camp.dir = 1; }
    desenhar();
    const novo = $(`th[data-col="${k}"]`); if (novo) novo.focus();
  };
  $$("th[data-col]", el).forEach((th) => {
    th.addEventListener("click", () => ordenar(th));
    th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ordenar(th); } });
  });
  $("#add-camp").onclick = () => formCampanha();
  $("#csv-camp").onclick = () => baixarCSV("campanhas",
    ["Campanha", "Cliente", "Tipo", "Status", "Qtd", "Valor", "Prazo", "Pagamento", "Ativa", "Favorita"],
    todas.map((c) => [c.campanha, c.cliente, c.tipo, c.status, c.qtd, (Number(c.valor) || 0).toFixed(2).replace(".", ","), dataBR(c.prazo), c.pagamento === "pago" ? "Pago" : "Pendente", c.ativa === false ? "Não" : "Sim", c.favorita ? "Sim" : "Não"]));
  $("#lista-camp").addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    const c = todas.find((x) => String(x.id) === tr.dataset.id);
    if (e.target.closest("[data-estrela]")) {
      if (await gravar("campanhas", { favorita: !c.favorita }, c.id)) recarregar("campanhas");
      return;
    }
    formCampanha(c);
  });
}

function formCampanha(c) {
  abrirForm({
    titulo: c ? "Editar campanha" : "Nova campanha",
    tabela: "campanhas",
    valores: c || { tipo: "Conteúdo", status: "Briefing", qtd: 1, valor: 0, pagamento: "pendente", ativa: true },
    campos: [
      { n: "campanha", r: "Campanha", req: true, inteiro: true },
      { n: "cliente", r: "Cliente" },
      { n: "tipo", r: "Tipo", t: "select", op: [["Conteúdo", "Conteúdo"], ["Publicidade", "Publicidade"]] },
      { n: "status", r: "Status", t: "select", op: STATUS.map((s) => [s, s]) },
      { n: "prazo", r: "Prazo", t: "date" },
      { n: "qtd", r: "Quantidade de vídeos", t: "number" },
      { n: "valor", r: "Valor total (R$)", t: "number" },
      { n: "pagamento", r: "Pagamento", t: "select", op: [["pendente", "Pendente"], ["pago", "Pago"]] },
      { n: "ativa", r: "Campanha ativa", t: "check" },
      { n: "favorita", r: "Destacar com estrela", t: "check" }
    ],
    aoSalvar: async (d) => { const ok = await gravar("campanhas", d, c ? c.id : null); if (ok) recarregar("campanhas"); return ok; },
    aoApagar: c ? async () => { const ok = await apagarLinha("campanhas", c.id); if (ok) recarregar("campanhas"); return ok; } : null
  });
}

/* =============================================================
   ABA 5: CHECKLIST PORTFÓLIO (conteúdo de js/biblioteca.js)
   ============================================================= */
const chk = { sub: "checklist", abertas: new Set() };
const SUBABAS = [["checklist", "Checklist do portfólio"], ["referencias", "Referências de vídeo"], ["roteiros", "Roteiros"], ["nichos", "Ideias por nicho"], ["revisar", "Revisar meu roteiro"]];

async function marcar(chave, valor) {
  S.marcados[chave] = valor;
  if (!temCampo("marcados", "chave")) { avisar("A tabela marcados não existe, então isso não fica salvo. Rode o banco.sql.", true); return; }
  const { error } = await db.from("marcados").upsert({ chave, marcado: valor }, { onConflict: "chave" });
  if (error) avisar(traduzErro(error), true);
}

function desenharChecklist(el) {
  const B = window.Biblioteca;
  if (!B) { el.innerHTML = `<div class="aviso-falta">Não encontrei o arquivo js/biblioteca.js. Confira se ele foi publicado junto com o site.</div>`; return; }
  el.innerHTML = `<div class="subabas" role="tablist">${SUBABAS.map(([v, t]) => `<button class="subaba" type="button" role="tab" data-sub="${v}" aria-selected="${chk.sub === v}">${t}</button>`).join("")}</div><div id="sub-corpo"></div>`;
  $$("[data-sub]", el).forEach((b) => b.onclick = () => { chk.sub = b.dataset.sub; desenhar(); });
  const corpo = $("#sub-corpo");
  ({ checklist: subChecklist, referencias: subReferencias, roteiros: subRoteiros, nichos: subNichos, revisar: subRevisar })[chk.sub](corpo, B);
}

function barra(feitos, total) { const p = total ? Math.round((feitos / total) * 100) : 0; return `<div class="progresso" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`; }

function itemCheck(chave, t, d) {
  const ok = !!S.marcados[chave];
  return `<label class="item-check ${ok ? "ok" : ""}"><input type="checkbox" data-chave="${esc(chave)}" ${ok ? "checked" : ""}><span><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ""}</span></label>`;
}

function ligarChecks(corpo, aoMudar) {
  corpo.addEventListener("change", async (e) => {
    const cb = e.target.closest("input[data-chave]");
    if (!cb) return;
    cb.closest(".item-check").classList.toggle("ok", cb.checked);
    await marcar(cb.dataset.chave, cb.checked);
    aoMudar();
  });
}

function lembrarAbertas(corpo) {
  corpo.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches || !d.matches("details[data-id]")) return;
    if (d.open) chk.abertas.add(d.dataset.id); else chk.abertas.delete(d.dataset.id);
  }, true);
}

function subChecklist(corpo, B) {
  const total = B.CHECKLIST.reduce((s, sec) => s + sec.itens.length, 0);
  const feitosSec = (sec) => sec.itens.filter((_, i) => S.marcados[`checklist:${sec.id}:${i}`]).length;
  const feitos = B.CHECKLIST.reduce((s, sec) => s + feitosSec(sec), 0);
  corpo.innerHTML = `
    <div class="cartao"><div class="barra" style="margin-bottom:6px"><b>Pronto no geral</b><span class="espaco"></span><span class="sub" id="geral-conta">${feitos} de ${total} itens</span></div><div id="geral-barra">${barra(feitos, total)}</div></div>
    ${B.CHECKLIST.map((sec) => {
      const f = feitosSec(sec);
      return `<details class="secao" data-id="ck-${esc(sec.id)}" ${chk.abertas.has("ck-" + sec.id) ? "open" : ""}>
        <summary><span class="emo" aria-hidden="true">${esc(sec.emoji)}</span><span><span class="nome">${esc(sec.nome)}</span> <span class="sub">${esc(sec.resumo)}</span></span><span class="conta">${f}/${sec.itens.length}</span>${barra(f, sec.itens.length)}</summary>
        <div class="corpo"><div class="porque"><b>Por que importa:</b> ${esc(sec.porque)}</div>
        ${sec.itens.map((it, i) => itemCheck(`checklist:${sec.id}:${i}`, it.t, it.d)).join("")}</div>
      </details>`;
    }).join("")}`;
  lembrarAbertas(corpo);
  ligarChecks(corpo, () => desenhar());
}

function subReferencias(corpo, B) {
  const aud = (v) => ((B.AUDIENCIAS || []).find((a) => a.v === v) || { t: v }).t;
  corpo.innerHTML = `<div class="refs">${B.REFERENCIAS.map((r, i) => `
    <button type="button" class="ref" data-ref="${i}">
      <div class="ref-capa cor-${esc(r.cor)}" aria-hidden="true">${esc(r.emoji)}</div>
      <div class="ref-info"><b>${esc(r.titulo)}</b><small>${esc(r.estilo)} · ${esc(r.duracao)} · ${esc(r.marca)}</small></div>
    </button>`).join("")}</div>`;
  $$("[data-ref]", corpo).forEach((b) => b.onclick = () => {
    const r = B.REFERENCIAS[Number(b.dataset.ref)];
    abrirJanelaSimples(`${esc(r.emoji)} ${esc(r.titulo)}`, `
      <p class="sub">${esc(r.estilo)} · ${esc(aud(r.audiencia))} · ${esc(r.duracao)} · ${esc(r.marca)}</p>
      <dl class="ficha">
        <dt>O gancho</dt><dd>${esc(r.gancho)}</dd>
        <dt>Por que funciona</dt><dd>${esc(r.porque)}</dd>
        <dt>O diferencial</dt><dd>${esc(r.diferencial)}</dd>
        <dt>Erro comum</dt><dd>${esc(r.erro)}</dd>
        <dt>Roteiro</dt><dd><div class="blocos">${(r.roteiro || []).map((x) => `<div class="bloco"><span>${esc(x.t)}</span><div>${htmlSeguro(x.o)}</div></div>`).join("")}</div></dd>
      </dl>`,
      r.youtube ? `<a class="btn primario" href="${esc(r.youtube)}" target="_blank" rel="noopener">${ic("play")}Assistir</a>` : "");
  });
}

function subRoteiros(corpo, B) {
  corpo.innerHTML = B.TIPOS.map((t) => `
    <details class="secao" data-id="tp-${esc(t.id)}" ${chk.abertas.has("tp-" + t.id) ? "open" : ""}>
      <summary><span class="emo" aria-hidden="true">${esc(t.emoji)}</span><span class="nome">${esc(t.nome)}</span><span class="conta">${esc(t.duracao)}</span></summary>
      <div class="corpo">
        <div class="porque"><b>Quando usar:</b> ${esc(t.porque)}</div>
        <div class="blocos">${(t.beats || []).map((x) => `<div class="bloco"><span>${esc(x.t)}</span><div>${htmlSeguro(x.o)}</div></div>`).join("")}</div>
        ${t.erros && t.erros.length ? `<p style="margin:12px 0 4px"><b>Erros comuns</b></p><ul style="margin:0;padding-left:18px">${t.erros.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>
    </details>`).join("");
  lembrarAbertas(corpo);
}

function subNichos(corpo, B) {
  corpo.innerHTML = `
    ${B.COMO_USAR && B.COMO_USAR.length ? `<div class="cartao"><h2>Como usar os ganchos</h2><ul style="margin:0;padding-left:18px">${B.COMO_USAR.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${B.NICHOS.map((n) => `
      <details class="secao" data-id="ni-${esc(n.id)}" ${chk.abertas.has("ni-" + n.id) ? "open" : ""}>
        <summary><span class="emo" aria-hidden="true">${esc(n.emoji)}</span><span class="nome">${esc(n.nome)}</span><span class="conta">${plural(n.ideias.length, "ideia", "ideias")}</span></summary>
        <div class="corpo"><ul class="ideias">${n.ideias.map((i) => `<li><b>${esc(i.t)}</b><q>${esc(i.gancho)}</q></li>`).join("")}</ul></div>
      </details>`).join("")}`;
  lembrarAbertas(corpo);
}

function subRevisar(corpo, B) {
  let rascunho = "";
  try { rascunho = localStorage.getItem("roteiro-rascunho") || ""; } catch (_) {}
  const chaves = [];
  B.REVISAO.forEach((b, bi) => b.itens.forEach((_, ii) => chaves.push(`revisao:${bi}:${ii}`)));
  const feitos = chaves.filter((k) => S.marcados[k]).length;
  corpo.innerHTML = `
    <div class="grade-2">
      <div class="cartao"><h2>Cole o seu roteiro aqui</h2>
        <textarea class="roteiro" id="roteiro" placeholder="Cole o roteiro e confira item por item ao lado.">${esc(rascunho)}</textarea>
        <p class="sub" id="roteiro-conta"></p>
      </div>
      <div>
        <div class="cartao"><div class="barra" style="margin-bottom:6px"><b>Revisão</b><span class="espaco"></span><span class="sub">${feitos} de ${chaves.length}</span></div>${barra(feitos, chaves.length)}
          <button class="btn" type="button" id="limpar-rev" style="margin-top:10px">Começar revisão nova</button></div>
        ${B.REVISAO.map((b, bi) => `<details class="secao" data-id="rv-${bi}" ${chk.abertas.has("rv-" + bi) || !chk.abertas.size ? "open" : ""}>
          <summary><span class="emo" aria-hidden="true">${esc(b.emoji)}</span><span class="nome">${esc(b.bloco)}</span><span class="conta">${b.itens.filter((_, ii) => S.marcados[`revisao:${bi}:${ii}`]).length}/${b.itens.length}</span></summary>
          <div class="corpo">${b.itens.map((it, ii) => itemCheck(`revisao:${bi}:${ii}`, it.t, it.d)).join("")}</div></details>`).join("")}
      </div>
    </div>`;
  const ta = $("#roteiro");
  const contar = () => {
    const palavras = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    $("#roteiro-conta").textContent = palavras ? `${plural(palavras, "palavra", "palavras")}, mais ou menos ${Math.round(palavras / 2.5)} segundos falando` : "";
  };
  contar();
  ta.addEventListener("input", () => { contar(); try { localStorage.setItem("roteiro-rascunho", ta.value); } catch (_) {} });
  lembrarAbertas(corpo);
  ligarChecks(corpo, () => desenhar());
  $("#limpar-rev").onclick = async () => {
    chaves.forEach((k) => { S.marcados[k] = false; });
    if (temCampo("marcados", "chave")) {
      const { error } = await db.from("marcados").delete().like("chave", "revisao:%");
      if (error) avisar(traduzErro(error), true);
    }
    desenhar();
  };
}

/* =============================================================
   ABA 6: TRANSCRIÇÕES
   Vídeos de referência do YouTube, Instagram e TikTok, separados em
   TikTok Shop, Ideias orgânicas e Publi / UGC. A transcrição é automática:
   o ajudante "transcrever" (supabase/functions/transcrever) pede o texto ao
   Supadata, e o que não vier em português é traduzido pelo tradutor do Chrome.
   ============================================================= */
const CATEGORIAS = [["tiktok_shop", "TikTok Shop"], ["organico", "Ideias orgânicas"], ["publi", "Publi / UGC"]];
const nomeCategoria = (c) => (CATEGORIAS.find((x) => x[0] === c) || [c, "Sem divisão"])[1];
const NOME_PLATAFORMA = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", outro: "Link" };
const NOME_IDIOMA = { en: "inglês", es: "espanhol", fr: "francês", it: "italiano", de: "alemão", ja: "japonês", ko: "coreano", zh: "chinês", ru: "russo", hi: "hindi", ar: "árabe", tr: "turco", nl: "holandês", pl: "polonês" };
const trans = { categoria: "todas", busca: "", sel: null, dequem: "todos", tag: "", etapa: "", aviso: "", saldo: null, saldoEm: 0, tiktokConsertado: false };
const DE_QUEM = [["outra", "De outra"], ["minha", "Meu"]];
const nomeDeQuem = (d) => d === "minha" ? "Meu" : "De outra";
const tagsDe = (t) => Array.isArray(t.tags) ? t.tags.filter(Boolean) : [];

// Limpa o link antes de mandar: /reels/ vira /reel/, e saem igsh, utm e outros rastreadores
function limparLink(link) {
  let u;
  try { u = new URL(String(link || "").trim()); } catch (_) { return String(link || "").trim(); }
  const h = u.hostname.replace(/^(www|m)\./, "");
  if (/instagram\.com$/.test(h)) { u.pathname = u.pathname.replace(/\/reels\//, "/reel/"); u.search = ""; }
  else if (/tiktok\.com$/.test(h)) u.search = "";
  else if (/youtube\.com$|youtu\.be$/.test(h)) {
    const v = u.searchParams.get("v");
    u.search = v ? "?v=" + encodeURIComponent(v) : "";
  } else [...u.searchParams.keys()].forEach((k) => { if (/^(utm_|igsh|si$|fbclid|gclid)/i.test(k)) u.searchParams.delete(k); });
  u.hash = "";
  return u.toString();
}
// O @ só aparece no link em instagram.com/<perfil>/reel/<id> e tiktok.com/@<perfil>/...
function perfilDoLink(link) {
  try {
    const u = new URL(link);
    const tk = u.pathname.match(/^\/@([^/]+)/);
    if (/tiktok\.com$/.test(u.hostname) && tk) return "@" + tk[1];
    const ig = u.pathname.match(/^\/([^/]+)\/(reel|reels|p|tv)\//);
    if (/instagram\.com$/.test(u.hostname) && ig && !["reel", "reels", "p", "tv", "stories"].includes(ig[1])) return "@" + ig[1];
  } catch (_) {}
  return "";
}

// Descobre a plataforma e o endereço para mostrar o vídeo dentro do painel
function videoDoLink(link) {
  try {
    const u = new URL(link);
    const h = u.hostname.replace(/^(www|m|vm|vt)\./, "");
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) {
      const id = h === "youtu.be" ? u.pathname.slice(1) : (u.searchParams.get("v") || (u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/) || [])[2]);
      return { plataforma: "youtube", src: id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null, vertical: /\/shorts\//.test(u.pathname) };
    }
    if (/(^|\.)instagram\.com$/.test(h)) {
      const m = u.pathname.match(/\/(p|reel|reels|tv)\/([^/?#]+)/);
      return { plataforma: "instagram", src: m ? `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${encodeURIComponent(m[2])}/embed` : null, vertical: true };
    }
    if (/(^|\.)tiktok\.com$/.test(h)) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      return { plataforma: "tiktok", src: m ? `https://www.tiktok.com/embed/v2/${m[1]}` : null, vertical: true };
    }
  } catch (_) {}
  return { plataforma: "outro", src: null, vertical: false };
}

/* ---------- Tradução para português ---------- */
// Palpite simples de idioma, para quando o Chrome não tiver o detector
function palpiteIdioma(t) {
  const p = (" " + t.toLowerCase().replace(/[^a-zà-ú\s]/g, " ") + " ");
  const conta = (lista) => lista.reduce((s, w) => s + (p.split(" " + w + " ").length - 1), 0);
  const pt = conta(["você", "não", "que", "uma", "pra", "para", "com", "isso", "muito", "tem", "é", "eu", "meu", "minha"]);
  const en = conta(["the", "you", "and", "this", "that", "is", "it", "my", "your", "with", "what", "i", "so"]);
  const es = conta(["el", "los", "las", "pero", "muy", "esto", "usted", "tú", "mi", "con", "qué", "es"]);
  if (pt >= en && pt >= es) return "pt";
  return en >= es ? "en" : "es";
}

async function detectarIdioma(texto) {
  try {
    if ("LanguageDetector" in self) {
      const det = await comLimite(self.LanguageDetector.create(), 6000);
      const r = await comLimite(det.detect(texto.slice(0, 3000)), 6000);
      if (r && r[0] && r[0].confidence > 0.5) return r[0].detectedLanguage;
    }
  } catch (_) {}
  return palpiteIdioma(texto);
}

// Espera uma promessa por no máximo "ms"; se passar disso, desiste
const comLimite = (promessa, ms) => Promise.race([promessa, new Promise((_, falha) => setTimeout(() => falha(new Error("demorou")), ms))]);

// Traduz em pedaços, para textos longos (de um idioma para outro, com o tradutor do Chrome)
async function traduzirParaPortugues(texto, idioma, aviso) { return traduzir(texto, idioma, "pt", aviso); }
async function traduzir(texto, idioma, destino, aviso = () => {}) {
  if (!("Translator" in self)) return null;
  const disp = await comLimite(self.Translator.availability({ sourceLanguage: idioma, targetLanguage: destino }), 6000);
  if (disp === "unavailable") return null;
  let baixando = false;
  const criar = self.Translator.create({
    sourceLanguage: idioma, targetLanguage: destino,
    monitor(m) { m.addEventListener("downloadprogress", (e) => { baixando = true; aviso(`Preparando o tradutor do Chrome (só na primeira vez)... ${Math.round((e.loaded || 0) * 100)}%`); }); }
  });
  // Se estiver baixando o tradutor, espera mais; se não, desiste rápido
  aviso("Abrindo o tradutor do Chrome...");
  const tradutor = await comLimite(criar, 60000).catch(async (erro) => { if (baixando) return comLimite(criar, 180000); throw erro; });
  const partes = texto.split(/(\n+)/);
  let saida = "";
  for (const parte of partes) {
    if (!parte.trim()) { saida += parte; continue; }
    const frases = parte.match(/[^.!?]+[.!?]*\s*/g) || [parte];
    let bloco = "";
    for (const f of frases) {
      if ((bloco + f).length > 900) { saida += await comLimite(tradutor.translate(bloco), 30000); bloco = ""; }
      bloco += f;
    }
    if (bloco) saida += await comLimite(tradutor.translate(bloco), 30000);
  }
  return saida;
}

function linkGoogleTradutor(texto, de = "auto", para = "pt") {
  return `https://translate.google.com/?sl=${de}&tl=${para}&op=translate&text=` + encodeURIComponent(texto.slice(0, 4500));
}

/* ---------- Banco de ideias: etapas ---------- */
const ETAPAS = [
  ["ideia", "Banco de ideias", "não quero fazer agora"],
  ["agora", "Fazer agora", "próximas da fila"],
  ["fazendo", "Fazendo", "em produção"],
  ["feito", "Feito", "já foi pro ar"]
];
const nomeEtapa = (s) => (ETAPAS.find((x) => x[0] === s) || ETAPAS[0])[1];
const etapaDe = (t) => (ETAPAS.some((x) => x[0] === t.status) ? t.status : "ideia");

/* ---------- Desenho da aba ---------- */
function desenharTranscricoes(el) {
  const todas = S.transcricoes;
  const conta = (c) => todas.filter((t) => t.categoria === c).length;
  if (trans.sel && !todas.some((t) => String(t.id) === String(trans.sel))) trans.sel = null;
  const catPadrao = trans.categoria === "todas" ? "organico" : trans.categoria;

  el.innerHTML = `
    <div class="barra">
      <div class="chips" role="group" aria-label="Divisões">
        ${[["todas", "Todas"], ...CATEGORIAS].map(([v, t]) => `<button class="chip" type="button" data-cat="${v}" aria-pressed="${trans.categoria === v}">${t} <span class="sub">${v === "todas" ? todas.length : conta(v)}</span></button>`).join("")}
      </div>
    </div>
    <div id="trans-conteudo"></div>`;

  $$("[data-cat]", el).forEach((b) => b.onclick = () => { trans.categoria = b.dataset.cat; trans.etapa = ""; trans.sel = null; desenhar(); });

  const caixa = $("#trans-conteudo");
  if (trans.sel) { caixa.innerHTML = `<div id="detalhe-trans"></div>`; pintarDetalheTrans(); return; }

  const todasTags = [...new Set(S.transcricoes.flatMap(tagsDe))].sort((a, b) => a.localeCompare(b, "pt"));
  caixa.innerHTML = `
    <section class="cartao rot-topo">
      <h2 class="rot-titulo">📜 Roteiros</h2>
      <p class="rot-frase">Cole o link de um reel e eu transcrevo. Serve pros seus e pros das outras, com etiqueta pra você separar.</p>
      <form id="form-add-trans" class="rot-linha" novalidate>
        <input class="campo" id="novo-link" type="url" inputmode="url" autocomplete="off" placeholder="Cole aqui: instagram.com/reel/... · tiktok.com/... · youtube.com/..." aria-label="Link do vídeo">
        <select class="campo" id="novo-dequem" aria-label="De quem é o vídeo"><option value="outra">De outra pessoa</option><option value="minha">Meu</option></select>
        <button class="btn primario" type="submit">🎙️ Transcrever</button>
        <button class="btn" type="button" id="ideia-sem-link">✍️ + Escrever na mão</button>
      </form>
      <div class="rot-linha rot-linha-extra">
        <input class="campo" id="novo-titulo" type="text" maxlength="150" placeholder="Título (opcional): do que se trata?" aria-label="Título">
        <select class="campo" id="novo-cat" aria-label="Divisão">${CATEGORIAS.map(([v, t]) => `<option value="${v}" ${v === catPadrao ? "selected" : ""}>${t}</option>`).join("")}</select>
        <select class="campo" id="novo-etapa" aria-label="Etapa">${ETAPAS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
      </div>
      <div id="rot-aviso" class="rot-aviso" aria-live="polite">${trans.aviso || ""}</div>
      <div class="rot-rodape"><span id="rot-saldo" class="sub"></span><span class="espaco"></span><button class="btn" type="button" id="rot-voz">🗣️ Minha voz</button><button class="btn" type="button" id="rot-estudar">🧠 Estudar com o Claude</button></div>
    </section>
    ${trans.categoria === "todas" ? "" : `<div id="painel-ideias"></div>`}
    <div class="barra rot-filtros">
      <div class="busca" style="max-width:340px">${ic("busca")}<input type="search" id="busca-trans" placeholder="Buscar na transcrição, perfil, título ou notas" value="${esc(trans.busca)}" aria-label="Buscar roteiros"></div>
      <div class="chips" role="group" aria-label="Filtrar">
        ${[["todos", "Todos"], ["minha", "Meus"], ["outra", "De outras"]].map(([v, t]) => `<button class="chip" type="button" data-dequem="${v}" aria-pressed="${trans.dequem === v && !trans.tag}">${t}</button>`).join("")}
        ${todasTags.map((tg) => `<button class="chip" type="button" data-tag="${esc(tg)}" aria-pressed="${trans.tag === tg}">#${esc(tg)}</button>`).join("")}
      </div>
    </div>
    ${trans.categoria === "todas" ? "" : `<div class="chips rot-etapas" role="group" aria-label="Etapa">
      ${[["", "Todas as etapas"], ...ETAPAS.map(([v, n]) => [v, n])].map(([v, n]) => `<button class="chip" type="button" data-etapa-filtro="${v}" aria-pressed="${trans.etapa === v}">${esc(n)}</button>`).join("")}
    </div>`}
    <div class="rot-biblioteca" id="mural"></div>`;

  $("#form-add-trans").addEventListener("submit", adicionarTranscricao);
  $("#ideia-sem-link").onclick = () => adicionarIdeia(null);
  $("#rot-estudar").onclick = estudarComClaude;
  $("#rot-voz").onclick = abrirMinhaVoz;
  $$("[data-dequem]", caixa).forEach((b) => b.onclick = () => { trans.dequem = b.dataset.dequem; trans.tag = ""; desenhar(); });
  $$("[data-tag]", caixa).forEach((b) => b.onclick = () => { trans.tag = trans.tag === b.dataset.tag ? "" : b.dataset.tag; desenhar(); });
  $$("[data-etapa-filtro]", caixa).forEach((b) => b.onclick = () => { trans.etapa = b.dataset.etapaFiltro; desenhar(); });
  consertarLinksTiktok();
  pintarSaldoSupadata();
  $("#busca-trans").addEventListener("input", (e) => { trans.busca = e.target.value; pintarListaTrans(); });

  if ($("#mural")) ligarBiblioteca($("#mural"));
  pintarListaTrans();
}

function filtrarTrans() {
  const q = trans.busca.toLowerCase();
  return S.transcricoes.filter((t) => {
    if (trans.categoria !== "todas" && t.categoria !== trans.categoria) return false;
    if (trans.dequem !== "todos" && (t.de_quem || "outra") !== trans.dequem) return false;
    if (trans.tag && !tagsDe(t).includes(trans.tag)) return false;
    if (trans.etapa && etapaDe(t) !== trans.etapa) return false;
    return !q || [t.titulo, t.transcricao, t.minha_versao, t.observacoes, t.link, t.perfil, t.legenda, tagsDe(t).join(" ")].some((x) => String(x || "").toLowerCase().includes(q));
  });
}

// Painel de números + quadro (também é chamado quando uma transcrição termina)
function pintarListaTrans() {
  pintarPainelIdeias();
  const mural = $("#mural");
  if (mural) {
    const ideias = filtrarTrans();
    mural.innerHTML = ideias.length ? ideias.map(cartaoRoteiro).join("")
      : `<p class="vazio">${S.transcricoes.length ? "Nenhum roteiro com esse filtro." : "Sua biblioteca está vazia. Cole o link de um reel aqui em cima ou escreva um roteiro na mão."}</p>`;
    return;
  }
  const quadro = $("#quadro");
  if (!quadro) return;
  const lista = filtrarTrans();
  quadro.innerHTML = ETAPAS.map(([v, nome, sub]) => {
    const itens = lista.filter((t) => etapaDe(t) === v);
    return `<section class="coluna col-${v}" data-etapa="${v}" aria-label="${nome}">
      <header><b>${nome}</b><span class="pilula">${itens.length}</span><small>${sub}</small></header>
      <div class="coluna-corpo">${itens.length ? itens.map(cartaoIdeia).join("") : `<p class="coluna-vazia">${S.transcricoes.length ? "Arraste uma ideia para cá" : v === "ideia" ? "Suas ideias aparecem aqui" : ""}</p>`}</div>
    </section>`;
  }).join("");
}

// Post-it do mural "Todas": cor pela divisão
function postit(t) {
  const rodando = transcrevendo.has(String(t.id));
  const resumo = rodando ? "Transcrevendo..." : (t.minha_versao || t.transcricao || t.observacoes || "");
  return `<article class="postit postit-${esc(t.categoria || "organico")}" data-trans="${esc(t.id)}" tabindex="0" aria-label="Abrir ${esc(t.titulo || "ideia")}, ${esc(nomeCategoria(t.categoria))}, ${esc(nomeEtapa(etapaDe(t)))}">
    <span class="postit-div">${esc(nomeCategoria(t.categoria))}</span>
    <b>${esc(t.titulo || "Sem título")}</b>
    <p>${resumo ? esc(resumo.slice(0, 160)) + (resumo.length > 160 ? "..." : "") : "Sem roteiro ainda"}</p>
    <footer>
      <span class="postit-etapa seg-txt-${etapaDe(t)}">${esc(nomeEtapa(etapaDe(t)))}</span>
      <span>${t.link ? esc(NOME_PLATAFORMA[t.plataforma] || "Link") : "Ideia própria"}</span>
    </footer>
  </article>`;
}

function cartaoIdeia(t) {
  const rodando = transcrevendo.has(String(t.id));
  const resumo = rodando ? "Transcrevendo..." : (t.minha_versao || t.transcricao || t.observacoes || "");
  return `<article class="cartao-ideia" draggable="true" data-trans="${esc(t.id)}" tabindex="0" aria-label="Abrir ${esc(t.titulo || "ideia")}">
    <div class="item-trans-topo">
      ${t.link ? `<span class="pilula p-plat-${esc(t.plataforma || "outro")}">${esc(NOME_PLATAFORMA[t.plataforma] || "Link")}</span>` : `<span class="pilula p-propria">Ideia própria</span>`}
      ${trans.categoria === "todas" ? `<span class="pilula p-cat">${esc(nomeCategoria(t.categoria))}</span>` : ""}
      <span class="etq-dequem ${t.de_quem === "minha" ? "minha" : "outra"}">${nomeDeQuem(t.de_quem)}</span>
      ${t.andamento === "processando" ? `<span class="pilula p-pendente">⏳ ouvindo</span>` : t.andamento === "falhou" ? `<span class="pilula p-parada">falhou</span>` : ""}
      ${t.minha_versao ? `<span class="pilula p-versao" title="Já tem a sua versão do roteiro">minha versão</span>` : ""}
    </div>
    <b>${esc(t.titulo || "Sem título")}</b>
    ${resumo ? `<small>${esc(resumo.slice(0, 110))}${resumo.length > 110 ? "..." : ""}</small>` : `<small>Sem roteiro ainda</small>`}
    <select class="campo etapa-cartao" data-mover="${esc(t.id)}" aria-label="Mudar a etapa de ${esc(t.titulo || "ideia")}">
      ${ETAPAS.map(([v, n]) => `<option value="${v}" ${v === etapaDe(t) ? "selected" : ""}>${n}</option>`).join("")}
    </select>
  </article>`;
}

function pintarPainelIdeias() {
  const caixa = $("#painel-ideias");
  if (!caixa) return;
  const lista = S.transcricoes.filter((t) => t.categoria === trans.categoria);
  const n = (s) => lista.filter((t) => etapaDe(t) === s).length;
  const total = lista.length;
  const pct = total ? Math.round((n("feito") / total) * 100) : 0;
  caixa.innerHTML = `
    <div class="faixa-kpi">
      <div class="kpi"><span>Banco de ideias</span><strong>${n("ideia")}</strong></div>
      <div class="kpi"><span>Fazer agora</span><strong>${n("agora")}</strong></div>
      <div class="kpi"><span>Fazendo</span><strong>${n("fazendo")}</strong></div>
      <div class="kpi"><span>Feito</span><strong>${n("feito")}</strong></div>
      <div class="kpi"><span>Executado</span><strong>${pct}%</strong><small>${total ? `${n("feito")} de ${total} ideias` : "adicione a primeira ideia"}</small></div>
    </div>
    ${total ? `<div class="trilho-etapas grande" role="img" aria-label="${ETAPAS.map(([s, en]) => `${n(s)} ${en.toLowerCase()}`).join(", ")}">${ETAPAS.map(([s]) => n(s) ? `<i class="seg-${s}" style="width:${(n(s) / total) * 100}%"></i>` : "").join("")}</div>
    <p class="legenda" style="margin-bottom:16px">${ETAPAS.map(([s, nome]) => `<span><i class="seg-${s}"></i>${nome}</span>`).join("")}</p>` : ""}`;
}

async function moverIdeia(id, etapa) {
  const t = S.transcricoes.find((x) => String(x.id) === String(id));
  if (!t || etapaDe(t) === etapa) return;
  const antes = t.status;
  t.status = etapa;
  pintarListaTrans();
  if (await gravar("transcricoes", { status: etapa }, t.id)) avisar(`Movida para ${nomeEtapa(etapa)}.`);
  else { t.status = antes; pintarListaTrans(); }
}

function abrirIdeia(id) {
  trans.sel = String(id);
  desenhar();
  window.scrollTo({ top: 0 });
}

// Arrastar entre colunas (computador) + abrir ao clicar + trocar etapa pelo seletor (celular)
function ligarQuadro(quadro) {
  let arrastando = null;
  quadro.addEventListener("dragstart", (e) => {
    const c = e.target.closest(".cartao-ideia");
    if (!c) return;
    arrastando = c.dataset.trans;
    c.classList.add("arrastando");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", arrastando);
  });
  quadro.addEventListener("dragend", (e) => {
    const c = e.target.closest(".cartao-ideia");
    if (c) c.classList.remove("arrastando");
    $$(".coluna.sobre", quadro).forEach((col) => col.classList.remove("sobre"));
  });
  quadro.addEventListener("dragover", (e) => {
    const col = e.target.closest(".coluna");
    if (!col || !arrastando) return;
    e.preventDefault();
    $$(".coluna.sobre", quadro).forEach((x) => { if (x !== col) x.classList.remove("sobre"); });
    col.classList.add("sobre");
  });
  quadro.addEventListener("drop", (e) => {
    const col = e.target.closest(".coluna");
    if (!col || !arrastando) return;
    e.preventDefault();
    const id = arrastando; arrastando = null;
    moverIdeia(id, col.dataset.etapa);
  });
  quadro.addEventListener("change", (e) => {
    const s = e.target.closest("[data-mover]");
    if (s) moverIdeia(s.dataset.mover, s.value);
  });
  quadro.addEventListener("click", (e) => {
    if (e.target.closest("select")) return;
    const c = e.target.closest(".cartao-ideia");
    if (c) abrirIdeia(c.dataset.trans);
  });
  quadro.addEventListener("keydown", (e) => {
    const c = e.target.closest(".cartao-ideia");
    if (c && e.target === c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirIdeia(c.dataset.trans); }
  });
}

async function adicionarIdeia(link) {
  if (!temCampo("transcricoes", "id")) { avisar("A tabela transcricoes ainda não existe. Rode o banco.sql.", true); return; }
  const info = link ? videoDoLink(link) : { plataforma: "outro" };
  const dados = {
    link: link || null,
    plataforma: link ? info.plataforma : null,
    categoria: $("#novo-cat").value,
    status: $("#novo-etapa").value,
    titulo: ($("#novo-titulo") && $("#novo-titulo").value.trim()) || (link ? null : "Nova ideia"),
    de_quem: ($("#novo-dequem") && $("#novo-dequem").value) || "outra",
    perfil: link ? perfilDoLink(link) || null : null,
    andamento: link ? "processando" : "pronto"
  };
  const limpo = {};
  Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
  const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
  if (error) { avisar(traduzErro(error), true); return; }
  if (trans.categoria !== "todas" && trans.categoria !== dados.categoria) trans.categoria = dados.categoria;
  // Com link: fica na biblioteca acompanhando o andamento. Sem link: abre para escrever na mão.
  if (!link) trans.sel = String(data.id);
  await recarregar("transcricoes");
  const novo = S.transcricoes.find((x) => String(x.id) === String(data.id));
  if (novo && link) transcreverVideo(novo);
  if (!link && dados.titulo === "Nova ideia") { const tt = $("#t-titulo"); if (tt) { tt.focus(); tt.select(); } }
}

async function adicionarTranscricao(e) {
  e.preventDefault();
  const bruto = $("#novo-link").value.trim();
  if (!bruto) { avisoRoteiro("📎 Cole o link do vídeo no campo aqui em cima. Para escrever um roteiro sem vídeo, use ✍️ + Escrever na mão.", "erro"); $("#novo-link").focus(); return; }
  if (!/^https?:\/\//i.test(bruto) || videoDoLink(bruto).plataforma === "outro") {
    avisoRoteiro("🤔 Esse link não parece de um vídeo do Instagram, TikTok ou YouTube. Copie o link pelo botão de compartilhar do vídeo e cole de novo.", "erro");
    $("#novo-link").focus(); return;
  }
  let link = limparLink(bruto);
  let igual = S.transcricoes.find((t) => t.link && limparLink(t.link) === link);
  // Link curto do TikTok: descobre o link completo antes (precisa dele para mostrar o vídeo)
  if (/(vm|vt)\.tiktok\.com\//i.test(link)) {
    avisoRoteiro("🔎 Abrindo o link do TikTok...", "andando");
    const r = await chamarTranscrever({ acao: "resolver", link });
    if (r && r.link && r.link !== link) link = limparLink(r.link);
    avisoRoteiro("");
    igual = igual || S.transcricoes.find((t) => t.link && limparLink(t.link) === link);
  }
  if (igual && !(await confirmar(`Esse vídeo já está na biblioteca ("${igual.titulo || "Sem título"}"). Transcrever de novo gasta mais um crédito. Quer mesmo?`, "Sim, transcrever de novo"))) { abrirIdeia(igual.id); return; }
  $("#novo-link").value = "";
  adicionarIdeia(link);
}

/* ---------- Transcrição automática (ajudante "transcrever" no Supabase + Supadata) ---------- */
const transcrevendo = new Set();

async function mensagemDoErroDaFuncao(error) {
  const st = error && error.context && error.context.status;
  if (st === 404) return "O ajudante de transcrição ainda não foi instalado no Supabase.";
  try { const j = await error.context.json(); if (j && j.erro) return j.erro; } catch (_) {}
  if (/fetch|network/i.test((error && error.message) || "")) return "Sem conexão. Confira a internet e tente de novo.";
  return "Não deu para transcrever agora. Tente de novo em instantes.";
}

// Atualiza a tela do vídeo aberto sem apagar o que você estiver digitando nas observações
function mostrarTranscricaoNaTela(item, aviso) {
  if (String(trans.sel) !== String(item.id) || !$("#t-transcricao")) return;
  const rodando = transcrevendo.has(String(item.id));
  $("#t-transcricao").value = item.transcricao || "";
  $("#t-transcricao").disabled = rodando;
  $("#t-status").textContent = aviso || "";
  $("#t-transcrever").disabled = rodando;
  $("#t-transcrever").innerHTML = `${ic("transcricao")}${rodando ? "Transcrevendo..." : item.transcricao ? "Transcrever de novo" : "Transcrever automaticamente"}`;
  const area = $("#t-original-area");
  if (area) area.innerHTML = botaoOriginal(item);
}

function botaoOriginal(t) {
  if (!(t.transcricao_original && t.idioma_original && t.idioma_original !== "pt")) return "";
  return `<button class="btn" type="button" id="t-original">Ver o original (${esc(NOME_IDIOMA[t.idioma_original] || t.idioma_original)})</button>
    <div id="t-original-caixa" hidden><p class="sub" style="margin:10px 0 4px">Texto original, antes da tradução:</p><div class="original">${esc(t.transcricao_original)}</div></div>`;
}

// Mensagem do andamento e dos erros, logo abaixo do campo do link
function avisoRoteiro(html, tipo = "") {
  trans.aviso = html ? `<div class="rot-aviso-caixa ${tipo}">${html}</div>` : "";
  const c = $("#rot-aviso");
  if (c) c.innerHTML = trans.aviso;
}
async function chamarTranscrever(corpo) {
  const { data, error } = await db.functions.invoke("transcrever", { body: corpo });
  if (error) {
    let j = null;
    try { j = await error.context.json(); } catch (_) {}
    return j && j.erro ? j : { tipo: "outro", erro: await mensagemDoErroDaFuncao(error) };
  }
  return data || { tipo: "outro", erro: "Não veio resposta. Tente de novo." };
}
const COMO_TER_CHAVE = "Crie uma conta grátis em <a href=\"https://supadata.ai\" target=\"_blank\" rel=\"noopener\">supadata.ai</a> (100 créditos por mês, sem cartão), copie a API key e cole no Supabase em Edge Functions &gt; Secrets, com o nome SUPADATA_API_KEY.";

// Transcreve: pede à Supadata pelo ajudante e, se o vídeo for longo, pergunta a cada 5 segundos (até 6 minutos)
async function transcreverVideo(item) {
  const id = String(item.id);
  if (transcrevendo.has(id)) return;
  transcrevendo.add(id);
  if (item.andamento !== "processando") { item.andamento = "processando"; item.erro = null; gravar("transcricoes", { andamento: "processando", erro: null }, item.id); }
  pintarListaTrans();
  const inicio = Date.now();
  const nome = item.titulo || item.perfil || "o vídeo";
  const andamento = () => {
    const s = Math.round((Date.now() - inicio) / 1000);
    const tempo = s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
    const txt = `🎧 Ouvindo ${esc(nome)}... ${tempo}. Costuma levar de 3 a 4 minutos, pode deixar a aba aberta.`;
    avisoRoteiro(`<span class="rot-relogio" aria-hidden="true"></span>${txt}`, "andando");
    mostrarTranscricaoNaTela(item, `Ouvindo o vídeo... ${tempo}`);
  };
  andamento();
  const relogio = setInterval(andamento, 1000);
  let r;
  try {
    r = await chamarTranscrever({ acao: "iniciar", link: item.link });
    while (r && r.jobId) {
      if (Date.now() - inicio > 6 * 60000) { r = { tipo: "demorou", erro: "Passou de 6 minutos e a transcrição não ficou pronta. Tente de novo daqui a pouco." }; break; }
      await new Promise((ok) => setTimeout(ok, 5000));
      const j = await chamarTranscrever({ acao: "job", jobId: r.jobId });
      if (j && j.processando) continue;
      r = j;
    }
  } catch (e) { r = { tipo: "outro", erro: "A conexão caiu no meio. Tente de novo." }; }
  clearInterval(relogio);
  try {
    if (r && r.texto) {
      let texto = String(r.texto).trim();
      const dados = { transcricao: texto, transcricao_original: null, idioma_original: null, andamento: "pronto", erro: null };
      // Garante português (a Supadata já recebe lang=pt; isto é só uma segunda checagem)
      const idioma = (await detectarIdioma(texto) || r.idioma || "").slice(0, 2);
      if (idioma && idioma !== "pt") {
        let pt = null;
        try { pt = await traduzirParaPortugues(texto, idioma, (t) => mostrarTranscricaoNaTela(item, t)); } catch (_) {}
        if (pt) { dados.transcricao = pt.trim(); dados.transcricao_original = texto; dados.idioma_original = idioma; }
      }
      if (await gravar("transcricoes", dados, item.id)) {
        Object.assign(item, dados);
        avisoRoteiro("✅ Pronto. Revisa, dá um nome e salva.", "ok");
        transcrevendo.delete(id);
        trans.sel = id; desenhar(); window.scrollTo({ top: 0 });
        setTimeout(() => { const tt = $("#t-titulo"); if (tt && !item.titulo) tt.focus(); }, 50);
        return;
      }
    } else {
      const erro = (r && r.erro) || "Não deu para transcrever agora.";
      Object.assign(item, { andamento: "falhou", erro });
      await gravar("transcricoes", { andamento: "falhou", erro }, item.id);
      const extra = r && r.tipo === "sem-chave" ? `<br>${COMO_TER_CHAVE}` : "";
      const botoes = r && r.tipo === "sem-fala"
        ? `<button class="btn pequeno" type="button" data-guardar-assim="${esc(id)}">💾 Guardar assim mesmo</button>`
        : r && ["ritmo", "outro", "demorou"].includes(r.tipo) ? `<button class="btn pequeno" type="button" data-tentar="${esc(id)}">🔁 Tentar de novo</button>` : "";
      avisoRoteiro(`${r && r.tipo === "sem-fala" ? "🔇" : r && r.tipo === "cota" ? "💳" : r && r.tipo === "ritmo" ? "⏱️" : "⚠️"} ${esc(erro)}${extra} ${botoes}`, "erro");
      mostrarTranscricaoNaTela(item, erro);
    }
  } finally {
    transcrevendo.delete(id);
    pintarListaTrans();
    pintarSaldoSupadata(true);
  }
}

// "Guardar assim mesmo": fica com o link, sem transcrição, para escrever na mão
async function guardarAssimMesmo(id) {
  const t = S.transcricoes.find((x) => String(x.id) === String(id));
  if (!t) return;
  if (await gravar("transcricoes", { andamento: "pronto", erro: null }, t.id)) {
    Object.assign(t, { andamento: "pronto", erro: null });
    avisoRoteiro("✍️ Guardado. Escreva o texto na mão e salve.", "ok");
    abrirIdeia(t.id);
  }
}

/* ---------- Card da biblioteca ---------- */
function cartaoRoteiro(t) {
  const info = videoDoLink(t.link);
  const rodando = transcrevendo.has(String(t.id));
  const proc = t.andamento === "processando" || rodando;
  const linhas = String(t.transcricao || t.minha_versao || "").trim();
  const quando = t.postado_em ? dataBR(String(t.postado_em).slice(0, 10)) : t.criado_em ? dataBR(String(t.criado_em).slice(0, 10)) : "";
  const fonte = t.link ? (NOME_PLATAFORMA[info.plataforma] || "Link") : "Escrito na mão";
  return `<article class="rot-card ${proc ? "processando" : ""} ${t.andamento === "falhou" ? "falhou" : ""}" data-trans="${esc(t.id)}">
    <div class="rot-capa fonte-${esc(t.link ? info.plataforma : "manual")}" data-capa="${esc(t.id)}">
      ${proc ? `<span class="rot-relogio grande" aria-label="Processando"></span>`
        : info.src ? `<button class="rot-play" type="button" data-video="${esc(t.id)}">▶ ver vídeo</button>`
        : `<span class="rot-capa-icone">${t.link ? "🔗" : "✍️"}</span>`}
      <span class="rot-fonte">${esc(fonte)}</span>
    </div>
    <div class="rot-info">
      <div class="rot-cabeca">
        <b class="rot-nome">${esc(t.titulo || "Sem título")}</b>
        <span class="etq-dequem ${t.de_quem === "minha" ? "minha" : "outra"}">${t.de_quem === "minha" ? "⭐ Meu" : "👀 De outra"}</span>
      </div>
      <small class="rot-meta">${[t.perfil ? esc(t.perfil) : "", esc(fonte), quando, esc(nomeCategoria(t.categoria))].filter(Boolean).join(" · ")}</small>
      ${tagsDe(t).length ? `<div class="rot-tags">${tagsDe(t).map((tg) => `<span>#${esc(tg)}</span>`).join("")}</div>` : ""}
      ${proc ? `<p class="rot-estado">⏳ Ouvindo o vídeo...${rodando ? "" : ` <button class="btn pequeno" type="button" data-tentar="${esc(t.id)}">🔁 Tentar de novo</button>`}</p>`
        : t.andamento === "falhou" ? `<p class="rot-estado erro">⚠️ ${esc(t.erro || "Não deu para transcrever.")} <button class="btn pequeno" type="button" data-abrir="${esc(t.id)}">Abrir mesmo assim</button> <button class="btn pequeno" type="button" data-tentar="${esc(t.id)}">🔁 Tentar de novo</button></p>`
        : `<p class="rot-trecho">${linhas ? esc(linhas) : "<i>Sem texto ainda. Abra para escrever.</i>"}</p>`}
      <div class="rot-acoes">
        <select class="campo rot-etapa-sel" data-mover="${esc(t.id)}" aria-label="Etapa de ${esc(t.titulo || "roteiro")}">${ETAPAS.map(([v, n]) => `<option value="${v}" ${v === etapaDe(t) ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
        <button class="btn pequeno" type="button" data-copiar="${esc(t.id)}" ${linhas ? "" : "disabled"}>📋 Copiar transcrição</button>
        <button class="btn pequeno" type="button" data-abrir="${esc(t.id)}">✏️ Editar</button>
        <button class="btn pequeno perigo" type="button" data-apagar-rot="${esc(t.id)}">🗑️ Apagar</button>
      </div>
    </div>
  </article>`;
}

function ligarBiblioteca(lista) {
  lista.addEventListener("change", (e) => { const s = e.target.closest("[data-mover]"); if (s) moverIdeia(s.dataset.mover, s.value); });
  lista.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    // Clicar em qualquer parte do card (fora dos botões) abre o roteiro
    if (!b) {
      if (e.target.closest("select, iframe, a")) return;
      const card = e.target.closest(".rot-card");
      if (card) abrirIdeia(card.dataset.trans);
      return;
    }
    const pega = (k) => S.transcricoes.find((x) => String(x.id) === String(b.dataset[k]));
    if (b.dataset.video) {
      // O vídeo só carrega quando você pede (o do Instagram é pesado)
      const t = pega("video"), info = videoDoLink(t.link), capa = b.closest(".rot-capa");
      capa.classList.add("tocando");
      capa.innerHTML = `<iframe src="${esc(info.src)}" title="Vídeo: ${esc(t.titulo || "roteiro")}" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen></iframe>`;
      return;
    }
    if (b.dataset.copiar) {
      const t = pega("copiar");
      try { await navigator.clipboard.writeText(t.transcricao || t.minha_versao || ""); b.textContent = "copiado ✓"; setTimeout(() => { b.textContent = "📋 Copiar transcrição"; }, 1800); }
      catch (_) { avisar("Não consegui copiar. Abra o roteiro e copie o texto.", true); }
      return;
    }
    if (b.dataset.abrir) { abrirIdeia(b.dataset.abrir); return; }
    if (b.dataset.tentar) { const t = pega("tentar"); if (t) transcreverVideo(t); return; }
    if (b.dataset.apagarRot) {
      const t = pega("apagarRot");
      if (!(await confirmar(`Apagar "${t.titulo || "este roteiro"}" da biblioteca? Não tem como desfazer.`))) return;
      if (await apagarLinha("transcricoes", t.id)) { avisar("Apagado."); recarregar("transcricoes"); }
    }
  });
}
// Botões do aviso (guardar assim mesmo / tentar de novo)
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-guardar-assim]");
  if (g) { guardarAssimMesmo(g.dataset.guardarAssim); return; }
  const tn = e.target.closest("#rot-aviso [data-tentar]");
  if (tn) { const t = S.transcricoes.find((x) => String(x.id) === tn.dataset.tentar); if (t) transcreverVideo(t); }
});

/* ---------- Saldo do mês na Supadata ---------- */
async function pintarSaldoSupadata(forcar) {
  const caixa = () => $("#rot-saldo");
  const mostrar = () => {
    const c = caixa(); if (!c) return;
    const sd = trans.saldo;
    if (!sd) { c.textContent = ""; return; }
    if (sd.erro) { c.innerHTML = sd.tipo === "sem-chave" ? `🔑 Falta a chave da Supadata. ${COMO_TER_CHAVE}` : `💳 ${esc(sd.erro)}`; return; }
    c.innerHTML = `💳 Supadata: <b>${num(sd.usados)} de ${num(sd.total)}</b> créditos usados este mês${sd.plano ? ` (plano ${esc(sd.plano)})` : ""}. 🔒 A chave fica guardada no cofre do Supabase.`;
  };
  mostrar();
  if (!forcar && trans.saldo && Date.now() - trans.saldoEm < 5 * 60000) return;
  const r = await chamarTranscrever({ acao: "saldo" });
  trans.saldo = r; trans.saldoEm = Date.now();
  mostrar();
}

/* ---------- 🧠 Estudar com o Claude ---------- */
function estudarComClaude() {
  const refs = S.transcricoes.filter((t) => (t.de_quem || "outra") === "outra" && String(t.transcricao || "").trim())
    .sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || ""))).slice(0, 10);
  if (!refs.length) { avisoRoteiro("🧠 Ainda não tem roteiro \"De outra\" com transcrição. Transcreva alguns vídeos de outras creators primeiro.", "erro"); return; }
  let assunto = "";
  try { assunto = localStorage.getItem("roteiros-assunto") || ""; } catch (_) {}
  if (!assunto) assunto = "UGC: vídeos com cara de cliente de verdade para marcas de tecnologia, apps e vida real";
  const montar = (a) => `Você é meu estrategista de conteúdo para vídeos curtos (Reels, TikTok e Shorts).

Abaixo estão ${refs.length} roteiros de vídeos de outras creators que eu salvei como referência, com o perfil e a transcrição de cada um.

Quero que você analise e me entregue:

1. Assuntos em alta: quais temas aparecem e por que estão funcionando.
2. Expressões que estão prendendo: frases e palavras que seguram a atenção, copiadas do texto.
3. Padrões de gancho: os tipos de abertura (os primeiros segundos), com um exemplo real tirado de cada roteiro.
4. 5 roteiros novos sobre o MEU assunto: ${a}.
   Reaproveite a ESTRUTURA (gancho, ritmo, virada, prova, chamada final), não o conteúdo.
   Fale como gente de verdade, em português do Brasil, com frases curtas para falar olhando para a câmera. Nada robotizado, nada de cara de anúncio.
   Para cada roteiro: gancho, desenvolvimento, chamada final, sugestão de cena e qual referência inspirou a estrutura.

ROTEIROS DE REFERÊNCIA

${refs.map((t, i) => `### ${i + 1}. ${t.perfil || "perfil não informado"} (${NOME_PLATAFORMA[t.plataforma] || "vídeo"})${t.titulo ? `: ${t.titulo}` : ""}
${String(t.transcricao).trim().slice(0, 2500)}`).join("\n\n")}`;
  const d = abrirJanelaSimples("🧠 Estudar com o Claude", `
    <p class="sub" style="margin-top:0">Junta os últimos ${refs.length} roteiros marcados como "De outra" num pedido pronto. Copie e cole no Claude.</p>
    <label class="pro-rotulo" for="est-assunto">O seu assunto</label>
    <input class="campo" id="est-assunto" style="width:100%" value="${esc(assunto)}">
    <label class="pro-rotulo" for="est-prompt">O pedido que vai ser copiado</label>
    <textarea class="campo" id="est-prompt" rows="12" style="width:100%;font-size:12px" readonly>${esc(montar(assunto))}</textarea>`,
    `<button type="button" class="btn" data-fechar>Fechar</button><button type="button" class="btn primario" id="est-copiar">📋 Copiar o pedido</button>`);
  $("#est-assunto", d).addEventListener("input", (e) => { $("#est-prompt", d).value = montar(e.target.value.trim() || assunto); try { localStorage.setItem("roteiros-assunto", e.target.value.trim()); } catch (_) {} });
  $("#est-copiar", d).onclick = async () => {
    try { await navigator.clipboard.writeText($("#est-prompt", d).value); $("#est-copiar", d).textContent = "copiado ✓"; avisar("Pedido copiado. Agora é só colar no Claude."); }
    catch (_) { $("#est-prompt", d).select(); avisar("Selecionei o texto: aperte Cmd + C para copiar.", true); }
  };
}

function pintarDetalheTrans() {
  const caixa = $("#detalhe-trans");
  const t = S.transcricoes.find((x) => String(x.id) === String(trans.sel));
  if (!caixa || !t) return;
  const info = videoDoLink(t.link);

  caixa.innerHTML = `
    <div class="barra">
      <button class="btn" type="button" id="t-voltar">${ic("esq")}Voltar aos roteiros</button>
      <span class="espaco"></span>
      <span class="sub" id="t-salvo"></span>
    </div>
    <div class="cartao">
      <div class="trans-cabeca">
        <input class="campo titulo-trans" id="t-titulo" value="${esc(t.titulo || "")}" placeholder="O tema desta ideia" aria-label="Título da ideia">
        <select class="campo" id="t-cat" aria-label="Divisão">${CATEGORIAS.map(([v, n]) => `<option value="${v}" ${v === t.categoria ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select class="campo" id="t-etapa" aria-label="Etapa">${ETAPAS.map(([v, n]) => `<option value="${v}" ${v === etapaDe(t) ? "selected" : ""}>${n}</option>`).join("")}</select>
      </div>
      <div class="rot-campos">
        <label>De quem<select class="campo" id="t-dequem">${DE_QUEM.map(([v, n]) => `<option value="${v}" ${v === (t.de_quem || "outra") ? "selected" : ""}>${v === "minha" ? "⭐ Meu" : "👀 De outra"}</option>`).join("")}</select></label>
        <label>Perfil<input class="campo" id="t-perfil" value="${esc(t.perfil || "")}" placeholder="@perfil"></label>
        <label>Link<input class="campo" id="t-link" type="url" value="${esc(t.link || "")}" placeholder="https://..."></label>
        <label>Postado em<input class="campo" id="t-postado" type="date" value="${esc(String(t.postado_em || "").slice(0, 10))}"></label>
        <label class="largo">Tags (separadas por vírgula)<input class="campo" id="t-tags" value="${esc(tagsDe(t).join(", "))}" placeholder="gancho forte, humor, review"></label>
      </div>
      ${t.andamento === "falhou" ? `<p class="rot-estado erro" style="margin:8px 0 0">⚠️ ${esc(t.erro || "A transcrição não deu certo.")} Dá para escrever o texto na mão aqui embaixo.</p>` : ""}
      ${t.link ? `<p class="sub" style="margin:6px 0 0"><a href="${esc(t.link)}" target="_blank" rel="noopener">Abrir a referência original no ${esc(NOME_PLATAFORMA[info.plataforma] || "site")}</a></p>` : ""}
    </div>
    <div class="trans-trabalho ${t.link ? "" : "sem-video"}">
      ${t.link ? `<div class="cartao trans-video">
        <h2>Referência</h2>
        ${info.src
          ? `<div class="moldura ${info.vertical ? "vertical" : ""}"><iframe src="${esc(info.src)}" title="Vídeo de referência" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen></iframe></div>`
          : `<p class="vazio">Esse link não dá para mostrar aqui dentro. Use o link "Abrir a referência original" acima.</p>`}
      </div>` : ""}
      <div class="trans-textos">
        ${t.link ? `<div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Roteiro da referência</h2><span class="espaco"></span><span class="sub" id="t-status"></span></div>
          <textarea class="campo" id="t-transcricao" rows="9" placeholder="A transcrição aparece aqui sozinha, sempre em português.">${esc(t.transcricao || "")}</textarea>
          <div class="barra" style="margin:6px 0 0">
            <button class="btn" type="button" id="t-transcrever">${ic("transcricao")}${t.transcricao ? "Transcrever de novo" : "Transcrever automaticamente"}</button>
            <span id="t-original-area">${botaoOriginal(t)}</span>
          </div>
        </div>` : ""}
        <div class="cartao destaque-versao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Minha versão (meu roteiro)</h2><span class="espaco"></span><button class="btn pequeno primario" type="button" id="t-roteiro-voz">✍️ Roteiro na minha voz</button></div>
          <textarea class="campo" id="t-versao" rows="9" placeholder="${t.link ? "Escreva aqui a sua versão: o seu gancho, a sua fala, como você vai adaptar essa referência." : "Escreva aqui a sua ideia e o roteiro: gancho, desenvolvimento e chamada final."}">${esc(t.minha_versao || "")}</textarea>
        </div>
        <div class="cartao">
          <h2>📝 Legenda do post</h2>
          <textarea class="campo" id="t-legenda" rows="3" placeholder="A legenda que foi publicada junto com o vídeo">${esc(t.legenda || "")}</textarea>
        </div>
        <div class="cartao">
          <h2>Observações</h2>
          <textarea class="campo" id="t-obs" rows="4" placeholder="O que funcionou na referência? Gancho, corte, fala, o que dá para adaptar para a marca...">${esc(t.observacoes || "")}</textarea>
        </div>
        <div class="barra">
          <button class="btn perigo" type="button" id="t-apagar">${ic("apagar")}Apagar</button>
          <span class="espaco"></span>
          <button class="btn primario" type="button" id="t-salvar">Salvar</button>
        </div>
      </div>
    </div>`;

  $("#t-roteiro-voz").onclick = () => roteiroNaMinhaVoz({ ...t, titulo: $("#t-titulo").value.trim(), categoria: $("#t-cat").value, minha_versao: $("#t-versao").value.trim(), observacoes: $("#t-obs").value.trim(), transcricao: $("#t-transcricao") ? $("#t-transcricao").value.trim() : t.transcricao });
  const ta = $("#t-transcricao");
  const status = (txt) => { const s = $("#t-status"); if (s) s.textContent = txt; };
  let originalPendente = null;
  let mudou = false;
  $$("#t-titulo, #t-versao, #t-obs, #t-transcricao, #t-perfil, #t-link, #t-postado, #t-tags, #t-legenda, #t-dequem", caixa).forEach((el) => el.addEventListener("input", () => { mudou = true; }));

  if (ta) {
    mostrarTranscricaoNaTela(t, transcrevendo.has(String(t.id)) ? "Transcrevendo o vídeo... pode levar até 1 minuto." : "");
    $("#t-transcrever").onclick = async () => {
      if (t.transcricao && !(await confirmar("Transcrever de novo? O roteiro da referência vai ser trocado pelo novo.", "Sim, transcrever"))) return;
      transcreverVideo(t);
    };
    $("#t-original-area").addEventListener("click", (e) => { if (e.target.closest("#t-original")) { const c = $("#t-original-caixa"); c.hidden = !c.hidden; } });

    const garantirPortugues = async () => {
      const texto = ta.value.trim();
      if (!texto) return;
      status("Conferindo o idioma...");
      const idioma = (await detectarIdioma(texto) || "").slice(0, 2);
      if (idioma === "pt") { status(""); return; }
      status(`Traduzindo do ${NOME_IDIOMA[idioma] || idioma} para português...`);
      try {
        const pt = await traduzirParaPortugues(texto, idioma, status);
        if (pt) { originalPendente = { texto, idioma }; ta.value = pt.trim(); mudou = true; status(`Traduzido do ${NOME_IDIOMA[idioma] || idioma}. Clique em Salvar.`); return; }
      } catch (_) {}
      status("");
      const d = abrirJanelaSimples("Traduzir para português",
        `<p>O tradutor que vem no Chrome não respondeu. Dá para traduzir pelo Google Tradutor:</p>
         <ol class="passos"><li>Clique em <b>Abrir o Google Tradutor</b>.</li><li>Copie o texto em português que aparecer.</li><li>Volte aqui, apague o texto do roteiro e cole o traduzido.</li></ol>`,
        `<a class="btn primario" href="${linkGoogleTradutor(texto)}" target="_blank" rel="noopener">Abrir o Google Tradutor</a>`);
      $("a", d).addEventListener("click", () => d.close());
    };
    ta.addEventListener("paste", () => setTimeout(garantirPortugues, 50));
    ta.addEventListener("change", garantirPortugues);
  }

  const salvar = async (mostrarAviso = true) => {
    const dados = {
      titulo: $("#t-titulo").value.trim() || null,
      categoria: $("#t-cat").value,
      status: $("#t-etapa").value,
      minha_versao: $("#t-versao").value.trim() || null,
      observacoes: $("#t-obs").value.trim() || null,
      de_quem: $("#t-dequem").value,
      perfil: (() => { const p = $("#t-perfil").value.trim().replace(/^@*/, ""); return p ? "@" + p : null; })(),
      postado_em: $("#t-postado").value || null,
      tags: [...new Set($("#t-tags").value.split(",").map((x) => x.trim().replace(/^#/, "")).filter(Boolean))],
      legenda: $("#t-legenda").value.trim() || null
    };
    const novoLink = $("#t-link").value.trim();
    if (novoLink && !/^https?:\/\//i.test(novoLink)) { avisar("O link precisa começar com https://", true); return false; }
    if (novoLink !== (t.link || "")) { dados.link = novoLink ? limparLink(novoLink) : null; dados.plataforma = novoLink ? videoDoLink(novoLink).plataforma : null; }
    if (t.andamento === "falhou" || t.andamento === "processando" && !transcrevendo.has(String(t.id))) { dados.andamento = "pronto"; dados.erro = null; }
    if (ta && !transcrevendo.has(String(t.id))) dados.transcricao = ta.value.trim() || null;
    if (originalPendente) { dados.transcricao_original = originalPendente.texto; dados.idioma_original = originalPendente.idioma; }
    const btn = $("#t-salvar"); btn.disabled = true; btn.textContent = "Salvando...";
    const ok = await gravar("transcricoes", dados, t.id);
    btn.disabled = false; btn.textContent = "Salvar";
    if (ok) {
      originalPendente = null; mudou = false;
      Object.assign(t, dados);
      $("#t-salvo").textContent = "Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      if (mostrarAviso) avisar("Salvo.");
    }
    return ok;
  };
  // Salvar volta para o quadro de ideias (não fica parado na ideia)
  $("#t-salvar").onclick = async () => {
    if (!(await salvar())) return;
    trans.sel = null; desenhar(); window.scrollTo({ top: 0 });
  };
  $("#t-cat").addEventListener("change", () => salvar(false));
  $("#t-etapa").addEventListener("change", async () => { if (await salvar(false)) avisar(`Movida para ${nomeEtapa($("#t-etapa").value)}.`); });
  $("#t-voltar").onclick = async () => {
    if (mudou && !(await salvar(false))) return;
    trans.sel = null; desenhar();
  };
  $("#t-apagar").onclick = async () => {
    if (!(await confirmar(`Apagar "${t.titulo || "esta ideia"}" do seu banco de ideias?`))) return;
    if (await apagarLinha("transcricoes", t.id)) { trans.sel = null; avisar("Apagada."); recarregar("transcricoes"); }
  };
}

/* =============================================================
   ABA 7: FINANCEIRO
   Os contratos (tabela contratos), do primeiro contato com a marca
   até o dinheiro na conta. O painel calcula: data prevista (nota +
   prazo), recebido (parcela 1 + 2), saldo, vencido (prazo passou e
   ainda falta receber), a meta do mês (tabela metas) e onde o
   dinheiro está parado.
   ============================================================= */
const TIPOS_CONTRATO = ["UGC", "Influencer", "Freelance", "Videomaker", "Infoproduto/Comissão", "Outro"];
// O caminho de um contrato, em ordem
const GRUPOS_STATUS = [
  ["negociacao", ["Em negociação", "Assinatura de contrato"]],
  ["producao", ["Aguardando briefing", "Roteiro em andamento", "Aguardando aprovação de roteiro", "Gravando", "Editando", "Enviado p/ aprovação"]],
  ["dinheiro", ["Entregue", "Nota fiscal enviada", "Aguardando pagamento", "Pago"]],
  ["fora", ["Perdida", "Cancelado"]]
];
const STATUS_CONTRATO = GRUPOS_STATUS.flatMap((g) => g[1]);
const grupoDe = (s) => (GRUPOS_STATUS.find((g) => g[1].includes(s)) || GRUPOS_STATUS[1])[0];
// Fechado = a marca contratou de verdade. Só isso conta no faturado.
const fechado = (c) => ["producao", "dinheiro"].includes(grupoDe(c.status));
// Lista do filtro: as etapas na ordem, com o Vencido automático antes do Pago
const STATUS_FILTRO = [...STATUS_CONTRATO.filter((s) => s !== "Pago" && grupoDe(s) !== "fora"), "Vencido", "Pago", "Perdida", "Cancelado"];
const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fin = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1, busca: "", status: "", ordem: "recente" };

const n2 = (v) => Number(v) || 0;
const recebidoDe = (c) => n2(c.parcela1) + n2(c.parcela2);
const saldoDe = (c) => (!fechado(c) ? 0 : Math.max(0, Math.round((n2(c.valor) - recebidoDe(c)) * 100) / 100));
function previstaDe(c) {
  if (!c.data_nf || c.prazo_dias == null) return null;
  const d = deISO(c.data_nf); d.setDate(d.getDate() + Number(c.prazo_dias));
  return isoLocal(d);
}
// Vencido é automático: o prazo passou, ainda falta receber e não está pago
function situacaoDe(c) {
  if (!fechado(c) || c.status === "Pago") return c.status;
  const prev = previstaDe(c);
  if (saldoDe(c) > 0 && prev && prev < hojeISO()) return "Vencido";
  return c.status;
}
function classeStatus(s) {
  if (s === "Pago") return "p-pago";
  if (s === "Vencido") return "p-vencido";
  return { negociacao: "p-lead", producao: "p-conversando", dinheiro: "p-pendente", fora: "p-parada" }[grupoDe(s)];
}
const chaveCliente = (c) => String(c.cliente || "").trim().toLowerCase();
const melhorNome = (atual, novo) => (!atual || (atual === atual.toLowerCase() && novo !== novo.toLowerCase()) ? String(novo).trim() : atual);
const metaDe = (ano, mes) => n2((S.metas.find((m) => Number(m.ano) === ano && Number(m.mes) === mes) || {}).valor);
const mesAntes = (ano, mes, k = 1) => { const d = new Date(ano, mes - 1 - k, 1); return [d.getFullYear(), d.getMonth() + 1]; };
const noPeriodo = (data, ano, mes) => { if (!data) return false; const d = deISO(data); return d.getFullYear() === ano && (!mes || d.getMonth() + 1 === mes); };

// Faturado = contratos fechados no mês + comissões do TikTok Shop que caíram no mês (mes 0 = ano todo)
function faturadoEm(ano, mes) {
  return S.contratos.filter((c) => fechado(c) && Number(c.ano) === ano && (!mes || Number(c.mes) === mes)).reduce((s, c) => s + n2(c.valor), 0)
    + S.comissoes.filter((x) => noPeriodo(x.data, ano, mes)).reduce((s, x) => s + n2(x.valor), 0);
}
// Entrou na conta = parcelas pelo dia em que caíram + TikTok Shop
function entrouEm(ano, mes) {
  let t = 0;
  S.contratos.forEach((c) => [[c.parcela1, c.data_p1], [c.parcela2, c.data_p2]].forEach(([v, d]) => { if (v && noPeriodo(d, ano, mes)) t += n2(v); }));
  return t + S.comissoes.filter((x) => noPeriodo(x.data, ano, mes)).reduce((s, x) => s + n2(x.valor), 0);
}
// Sugestão de meta: média dos 3 últimos meses com faturamento, mais 15%, arredondada para cima de 100 em 100
function sugestaoMeta(ano, mes) {
  const vals = [];
  for (let k = 1; k <= 12 && vals.length < 3; k++) { const [a, m] = mesAntes(ano, mes, k); const v = faturadoEm(a, m); if (v > 0) vals.push(v); }
  return vals.length ? Math.ceil((vals.reduce((s, v) => s + v, 0) / vals.length) * 1.15 / 100) * 100 : 0;
}

// Onde cada contrato em aberto está parado agora
const BALDES = [
  { k: "negociacao", nome: "Em negociação", explica: "propostas que ainda não fecharam (não conta no faturado)",
    acao: "Faça follow-up: marca que não respondeu em 3 dias recebe uma mensagem curta perguntando se ficou alguma dúvida." },
  { k: "producao", nome: "Em produção", explica: "fechado, mas o trabalho ainda não foi entregue",
    acao: "O dinheiro só começa a andar depois da entrega. Priorize o que está mais perto do fim e cobre o briefing de quem está parado." },
  { k: "sem-nota", nome: "Entregue sem nota fiscal", explica: "entregou, mas a nota ainda não foi enviada",
    acao: "Emita a nota hoje: o prazo de pagamento da marca só começa a contar quando a nota chega." },
  { k: "esperando", nome: "Esperando pagamento", explica: "nota enviada, dentro do prazo",
    acao: "Confira as datas previstas e mande um lembrete 2 dias antes do vencimento." },
  { k: "vencido", nome: "Vencido", explica: "o prazo passou e o dinheiro não entrou",
    acao: "Cobre hoje, com educação: mande a nota de novo, os dados de pagamento e pergunte a data certa." }
];
function baldeDe(c) {
  const g = grupoDe(c.status);
  if (g === "negociacao") return "negociacao";
  if (g === "fora" || c.status === "Pago" || saldoDe(c) <= 0) return null;
  if (situacaoDe(c) === "Vencido") return "vencido";
  if (g === "producao") return "producao";
  if (c.status === "Entregue" && !c.data_nf) return "sem-nota";
  return "esperando";
}
function ondeEstaODinheiro() {
  const r = BALDES.map((b) => ({ ...b, lista: [], v: 0 }));
  S.contratos.forEach((c) => {
    const k = baldeDe(c); if (!k) return;
    const b = r.find((x) => x.k === k);
    b.lista.push(c); b.v += k === "negociacao" ? n2(c.valor) : saldoDe(c);
  });
  // Gargalo: vencido primeiro (é o mais urgente); se não tiver, onde há mais dinheiro parado depois de fechado
  const candidatos = r.filter((b) => b.k !== "negociacao" && b.v > 0);
  const gargalo = r.find((b) => b.k === "vencido" && b.v > 0) || candidatos.sort((a, b) => b.v - a.v)[0] || null;
  return { baldes: r, gargalo };
}

// Tooltip único para todos os gráficos do financeiro
function ligarDicas(el) {
  let dica = $("#dica-grafico");
  if (!dica) { dica = document.createElement("div"); dica.id = "dica-grafico"; dica.className = "dica-grafico"; dica.hidden = true; document.body.appendChild(dica); }
  el.addEventListener("pointermove", (e) => {
    const alvo = e.target.closest("[data-dica]");
    if (!alvo) { dica.hidden = true; return; }
    dica.innerHTML = alvo.dataset.dica;
    dica.hidden = false;
    const w = dica.offsetWidth;
    dica.style.left = Math.min(window.innerWidth - w - 8, e.clientX + 14) + "px";
    dica.style.top = (e.clientY + 16) + "px";
  });
  el.addEventListener("pointerleave", () => { dica.hidden = true; });
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function variacao(atual, antes) {
  if (!antes) return atual ? `<span class="sobe">novo</span>` : `<span class="sub">-</span>`;
  if (antes < 0 || atual < 0) {
    // Com número negativo (ex.: saldo de seguidores) porcentagem não faz sentido: mostra a diferença
    const dif = atual - antes;
    return dif >= 0 ? `<span class="sobe">▲ ${dif}</span>` : `<span class="desce">▼ ${-dif}</span>`;
  }
  const p = Math.round(((atual - antes) / antes) * 100);
  return p >= 0 ? `<span class="sobe">▲ ${p}%</span>` : `<span class="desce">▼ ${-p}%</span>`;
}

/* ---------- Relatório do mês (o topo do Financeiro) ---------- */
function relatorioPeriodo() {
  const { ano, mes } = fin;
  const hoje = new Date();
  const fat = faturadoEm(ano, mes);
  const entrou = entrouEm(ano, mes);
  const ttk = S.comissoes.filter((x) => noPeriodo(x.data, ano, mes)).reduce((s, x) => s + n2(x.valor), 0);
  const fechadosP = S.contratos.filter((c) => fechado(c) && Number(c.ano) === ano && (!mes || Number(c.mes) === mes));
  const ticket = fechadosP.length ? (fat - ttk) / fechadosP.length : 0;
  const meta = mes ? metaDe(ano, mes) : 0;
  const negociando = S.contratos.filter((c) => grupoDe(c.status) === "negociacao");
  const vNeg = negociando.reduce((s, c) => s + n2(c.valor), 0);

  let comparar = "", media = "";
  if (mes) {
    const [pa, pm] = mesAntes(ano, mes);
    const antes = faturadoEm(pa, pm);
    const ult3 = [1, 2, 3].map((k) => faturadoEm(...mesAntes(ano, mes, k)));
    const med = ult3.reduce((s, v) => s + v, 0) / 3;
    comparar = `<div><span>vs ${MESES_LONGOS[pm - 1].toLowerCase()}</span><b>${variacao(fat, antes)}</b>${antes ? `<small>${real(antes)}</small>` : ""}</div>`;
    media = `<div><span>Média dos 3 meses antes</span><b>${real(med)}</b><small>${fat >= med ? "este mês está acima" : "este mês está abaixo"}</small></div>`;
  } else {
    const antes = faturadoEm(ano - 1, 0);
    const mesesCom = MESES_CURTOS.map((_, i) => faturadoEm(ano, i + 1)).filter((v) => v > 0);
    comparar = `<div><span>vs ${ano - 1}</span><b>${variacao(fat, antes)}</b>${antes ? `<small>${real(antes)}</small>` : ""}</div>`;
    media = `<div><span>Média por mês</span><b>${real(mesesCom.length ? fat / mesesCom.length : 0)}</b><small>nos ${plural(mesesCom.length, "mês", "meses")} com faturamento</small></div>`;
  }

  // Barra da meta
  let barraMeta;
  if (meta) {
    const p = pct(fat, meta);
    const falta = Math.max(0, meta - fat);
    const ehAgora = mes && ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
    const diasFim = ehAgora ? new Date(ano, mes, 0).getDate() - hoje.getDate() : 0;
    const trabalhos = ticket && falta ? Math.ceil(falta / ticket) : 0;
    barraMeta = `<div class="meta-linha">
        <div class="meta-trilho ${p >= 100 ? "batida" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, p)}" aria-label="Meta"><i style="width:${Math.min(100, p)}%"></i></div>
        <b>${p}%</b>
      </div>
      <p class="meta-texto">${p >= 100
        ? `Meta de ${real(meta)} batida${fat > meta ? `, com ${real(fat - meta)} a mais` : ""}. Parabéns!`
        : `Meta ${real(meta)}. Faltam <b>${real(falta)}</b>${ehAgora ? ` em ${plural(diasFim, "dia", "dias")}` : ""}${trabalhos ? `, mais ou menos ${qtd(trabalhos, "trabalho", "trabalhos")} no seu ticket médio` : ""}.`}
        ${mes ? `<button type="button" class="link-btn" data-meta>mudar a meta</button>` : ""}</p>`;
  } else {
    const sug = mes ? sugestaoMeta(ano, mes) : 0;
    barraMeta = mes
      ? `<p class="meta-texto">Você ainda não tem meta para ${MESES_LONGOS[mes - 1].toLowerCase()}. ${sug ? `Uma boa meta seria <b>${real(sug)}</b> (sua média recente mais 15%).` : ""} <button type="button" class="btn primario pequeno" data-meta>Definir meta</button></p>`
      : (() => {
        const comMeta = S.metas.filter((m) => Number(m.ano) === ano && n2(m.valor) > 0);
        const batidas = comMeta.filter((m) => faturadoEm(ano, Number(m.mes)) >= n2(m.valor));
        return comMeta.length
          ? `<p class="meta-texto">Meta batida em <b>${batidas.length} de ${plural(comMeta.length, "mês", "meses")}</b> com meta definida.${batidas.length ? ` (${batidas.map((m) => MESES_CURTOS[m.mes - 1]).join(", ")})` : ""}</p>`
          : `<p class="meta-texto">Escolha um mês no filtro para definir a meta dele.</p>`;
      })();
  }

  return `<div class="cartao relatorio">
    <div class="rel-topo">
      <div>
        <span class="rel-rotulo">Faturado em ${mes ? `${MESES_LONGOS[mes - 1].toLowerCase()} de ${ano}` : ano}</span>
        <strong class="rel-numero">${real(fat)}</strong>
        ${barraMeta}
      </div>
    </div>
    <div class="rel-grade">
      <div><span>Entrou na conta</span><b>${real(entrou)}</b></div>
      ${comparar}
      <div><span>TikTok Shop</span><b>${real(ttk)}</b></div>
      <div><span>Em negociação</span><b>${real(vNeg)}</b>${negociando.length ? `<small>${qtd(negociando.length, "proposta", "propostas")}</small>` : ""}</div>
    </div>
  </div>`;
}

/* ---------- "Onde está o seu dinheiro" ---------- */
function cartaoFunil({ baldes, gargalo }) {
  const max = Math.max(1, ...baldes.map((b) => b.v));
  const aberto = baldes.filter((b) => b.k !== "negociacao").reduce((s, b) => s + b.v, 0);
  const comDinheiro = baldes.filter((b) => b.v > 0);
  return `<div class="cartao">
    <h2>Onde está o seu dinheiro</h2>
    <p class="sub" style="margin:-6px 0 10px">${real(aberto)} para receber</p>
    ${comDinheiro.length ? `<div class="funil">
      ${comDinheiro.map((b) => `<button type="button" class="funil-linha f-${b.k} ${gargalo && gargalo.k === b.k ? "gargalo" : ""}" data-balde="${b.k}" ${b.lista.length ? "" : "disabled"}
        data-dica="<b>${esc(b.nome)}</b><br>${esc(b.explica)}${b.lista.length ? "<br>" + b.lista.slice(0, 5).map((c) => esc(c.cliente) + ": " + real(b.k === "negociacao" ? c.valor : saldoDe(c))).join("<br>") + (b.lista.length > 5 ? "<br>..." : "") : ""}">
        <span class="fl-nome">${esc(b.nome)}${gargalo && gargalo.k === b.k ? ` <span class="etq ${b.k === "vencido" ? "vermelha" : "amarela"}">gargalo</span>` : ""}</span>
        <span class="lb-trilho"><i style="width:${(b.v / max) * 100}%"></i></span>
        <span class="lb-valor">${real(b.v)}</span>
        <small class="lb-extra">${qtd(b.lista.length, "contrato", "contratos")}</small>
      </button>`).join("")}
    </div>` : ""}
    ${gargalo
      ? `<div class="dica-caixa ${gargalo.k === "vencido" ? "urgente" : ""}"><b>O que fazer:</b> ${esc(gargalo.acao)}</div>`
      : `<div class="dica-caixa"><b>Tudo em dia.</b> Nenhum dinheiro parado.</div>`}
  </div>`;
}

/* ---------- "O que os números dizem" (insights do ano) ---------- */
function insightsDoAno(funil) {
  const ano = fin.ano;
  const doAno = S.contratos.filter((c) => fechado(c) && Number(c.ano) === ano);
  const ttkAno = S.comissoes.filter((x) => noPeriodo(x.data, ano, 0));
  const total = faturadoEm(ano, 0);
  const itens = [];
  if (!total) return `<div class="cartao"><h2>Resumo de ${ano}</h2><p class="vazio">Sem faturamento em ${ano} ainda.</p></div>`;

  // 1. Fonte de renda principal
  const fontes = TIPOS_CONTRATO.map((t) => ({ t, v: doAno.filter((c) => c.tipo === t).reduce((s, c) => s + n2(c.valor), 0) }));
  fontes.push({ t: "TikTok Shop", v: ttkAno.reduce((s, x) => s + n2(x.valor), 0) });
  fontes.sort((a, b) => b.v - a.v);
  const [f1, f2] = fontes;
  itens.push({ ic: "financeiro", titulo: "Fonte principal",
    texto: `<b>${esc(f1.t)}</b>, ${pct(f1.v, total)}% do que você faturou.`,
    dica: pct(f1.v, total) >= 70
      ? `Mais de 2/3 vem de um tipo só. Tente fechar pelo menos 1 trabalho por mês de ${esc(f2 && f2.v ? f2.t : "outro tipo")} para não depender só de ${esc(f1.t)}.`
      : "Sua renda está bem dividida entre os tipos de trabalho. Isso dá segurança." });

  // 2. Maior ganho
  const maior = [...doAno].sort((a, b) => n2(b.valor) - n2(a.valor))[0];
  const ticketAno = doAno.length ? doAno.reduce((s, c) => s + n2(c.valor), 0) / doAno.length : 0;
  const meses = MESES_CURTOS.map((_, i) => faturadoEm(ano, i + 1));
  const melhor = meses.indexOf(Math.max(...meses));
  if (maior) itens.push({ ic: "estrela", titulo: "Maior ganho",
    texto: `<b>${esc(maior.cliente)}</b> (${real(maior.valor)}). Melhor mês: ${MESES_LONGOS[melhor].toLowerCase()}.`,
    dica: "Use esse trabalho como case no mídia kit e mande proposta para marcas do mesmo porte. Um contrato grande vale por vários pequenos." });

  // 4. Recorrência
  const porCliente = {};
  doAno.forEach((c) => { const k = chaveCliente(c); (porCliente[k] = porCliente[k] || { nome: "", n: 0, v: 0 }); porCliente[k].nome = melhorNome(porCliente[k].nome, c.cliente); porCliente[k].n++; porCliente[k].v += n2(c.valor); });
  const clientes = Object.values(porCliente);
  const voltaram = clientes.filter((x) => x.n > 1).sort((a, b) => b.n - a.n || b.v - a.v);
  const vVoltaram = voltaram.reduce((s, x) => s + x.v, 0);
  const totalContratos = doAno.reduce((s, c) => s + n2(c.valor), 0);
  itens.push({ ic: "marcas", titulo: "Clientes que voltam",
    texto: voltaram.length
      ? `<b>${qtd(voltaram.length)} de ${qtd(clientes.length)}</b> marcas fecharam de novo (${pct(vVoltaram, totalContratos)}% dos contratos).`
      : `Nenhuma marca fechou duas vezes ainda.`,
    dica: `Você não tem cliente fixo, então todo mês começa do zero. Ofereça ${voltaram.length ? `para ${esc(voltaram[0].nome)}` : "para as marcas que gostaram do seu trabalho"} um pacote mensal (ex: 4 vídeos por mês com 10% de desconto). Um contrato fixo de ${real(Math.max(800, Math.round(ticketAno * 3 / 100) * 100))} por mês já dá uma base para o mês não começar do zero.` });

  // 5. Concentração
  const top = clientes.sort((a, b) => b.v - a.v)[0];
  if (top && pct(top.v, total) >= 30) {
    const p = pct(top.v, total);
    itens.push({ ic: "grafico", titulo: "Dependência de uma marca", alerta: p >= 30,
      texto: `<b>${esc(top.nome)}</b> é ${p}% de tudo que você faturou.`,
      dica: p >= 30 ? "É muito peso numa marca só: se ela parar, o mês cai junto. Use o tempo livre para abrir 2 ou 3 conversas novas por semana." : "Nenhuma marca pesa demais no seu faturamento. Bom sinal." });
  }

  // 6. Tempo para receber
  const tempos = S.contratos.filter((c) => c.status === "Pago" && c.data_nf && (c.data_p1 || c.data_p2)).map((c) => {
    const ultimo = [c.data_p1, c.data_p2].filter(Boolean).sort().pop();
    return { dias: diasEntre(c.data_nf, ultimo), prazo: n2(c.prazo_dias) };
  }).filter((x) => x.dias >= 0);
  if (tempos.length >= 3) {
    const medio = Math.round(tempos.reduce((s, x) => s + x.dias, 0) / tempos.length);
    const prazoMedio = Math.round(tempos.reduce((s, x) => s + x.prazo, 0) / tempos.length);
    itens.push({ ic: "calendario", titulo: "Tempo para receber",
      texto: `<b>${plural(medio, "dia", "dias")}</b> depois da nota, em média.`,
      dica: medio > 40 ? "Isso segura o seu caixa. Em trabalhos acima de R$ 800, peça 50% na assinatura e 50% na entrega, e tente prazo de 30 dias em vez de 60 ou 90." : "Seu dinheiro entra rápido. Mantenha o hábito de mandar a nota no dia da entrega." });
  }

  let dicas = false;
  try { dicas = localStorage.getItem("fin-dicas") === "1"; } catch (_) {}
  return `<div class="cartao resumo-ano ${dicas ? "mostra-dicas" : ""}">
    <div class="barra" style="margin-bottom:8px"><h2 style="margin:0">Resumo de ${ano}</h2><span class="espaco"></span>
      <button type="button" class="link-btn" data-dicas>${dicas ? "esconder dicas" : "ver dicas"}</button></div>
    <div class="insights">${itens.map((x) => `<div class="insight ${x.alerta ? "alerta" : ""}">
      <span class="insight-ic">${ic(x.ic)}</span>
      <div><b>${x.titulo}</b><p>${x.texto}</p><p class="insight-dica">${x.dica}</p></div>
    </div>`).join("")}</div>
  </div>`;
}

function desenharFinanceiro(el) {
  const todos = S.contratos;
  const anos = [...new Set([new Date().getFullYear(), ...todos.map((c) => Number(c.ano)).filter(Boolean)])].sort((a, b) => b - a);
  if (!anos.includes(fin.ano)) fin.ano = anos[0];
  const doAno = todos.filter((c) => Number(c.ano) === fin.ano);
  const doPeriodo = doAno.filter((c) => !fin.mes || Number(c.mes) === fin.mes);
  const validos = doPeriodo.filter(fechado);
  // Comissões do TikTok Shop (contam como faturado e recebido no dia que caíram)
  const comAno = S.comissoes.filter((x) => noPeriodo(x.data, fin.ano, 0));
  const comPeriodo = comAno.filter((x) => noPeriodo(x.data, fin.ano, fin.mes));
  const totalTtk = comPeriodo.reduce((s, x) => s + n2(x.valor), 0);
  const faturado = validos.reduce((s, c) => s + n2(c.valor), 0) + totalTtk;
  const nomePeriodo = fin.mes ? `${MESES_LONGOS[fin.mes - 1]} de ${fin.ano}` : `${fin.ano}`;
  const funil = ondeEstaODinheiro();
  let analiseAberta = false;
  try { analiseAberta = localStorage.getItem("fin-analise") === "1"; } catch (_) {}

  // Gráfico 1: faturado (mês de fechamento) x entrou na conta (dia de cada parcela), com a meta de cada mês
  const fatMes = MESES_CURTOS.map((_, i) => faturadoEm(fin.ano, i + 1));
  const recMes = MESES_CURTOS.map((_, i) => entrouEm(fin.ano, i + 1));
  const metaMes = MESES_CURTOS.map((_, i) => metaDe(fin.ano, i + 1));
  const prevMes = Array(12).fill(0);
  todos.forEach((c) => {
    // Gráfico 2: previsão = o que falta receber, no mês da data prevista
    const prev = previstaDe(c), sal = saldoDe(c);
    if (sal > 0 && prev && deISO(prev).getFullYear() === fin.ano) prevMes[deISO(prev).getMonth()] += sal;
  });
  const maxBarras = Math.max(1, ...fatMes, ...recMes, ...metaMes);
  const maxPrev = Math.max(1, ...prevMes);
  const mesHoje = new Date().getFullYear() === fin.ano ? new Date().getMonth() : -1;
  const temMeta = metaMes.some(Boolean);

  const graficoMeses = `<div class="barras-mes" role="img" aria-label="Faturado e recebido por mês em ${fin.ano}">
    ${MESES_CURTOS.map((m, i) => `<div class="grupo-mes ${fin.mes === i + 1 ? "foco" : ""}" data-dica="<b>${MESES_LONGOS[i]}</b><br>Faturado: ${real(fatMes[i])}<br>Entrou na conta: ${real(recMes[i])}${metaMes[i] ? `<br>Meta: ${real(metaMes[i])} (${pct(fatMes[i], metaMes[i])}%)` : ""}">
      <div class="par-barras">
        <i class="b-fat" style="height:${(fatMes[i] / maxBarras) * 100}%"></i>
        <i class="b-rec" style="height:${(recMes[i] / maxBarras) * 100}%"></i>
        ${metaMes[i] ? `<em class="m-meta" style="bottom:${(metaMes[i] / maxBarras) * 100}%"></em>` : ""}
      </div>
      <span>${m}</span>
    </div>`).join("")}
  </div>`;
  const graficoPrev = prevMes.every((v) => !v)
    ? `<p class="vazio">Nada a receber com data prevista em ${fin.ano}. Quando um contrato tiver nota fiscal e prazo, o valor que falta aparece aqui no mês certo.</p>`
    : `<div class="barras-mes" role="img" aria-label="Previsão de recebimento por mês em ${fin.ano}">
      ${MESES_CURTOS.map((m, i) => `<div class="grupo-mes ${i === mesHoje ? "hoje" : ""}" data-dica="<b>${MESES_LONGOS[i]}</b><br>A receber: ${real(prevMes[i])}${i < mesHoje && prevMes[i] ? "<br>já passou do prazo" : ""}">
        <b class="valor-barra">${prevMes[i] && !privado ? Math.round(prevMes[i]).toLocaleString("pt-BR") : ""}</b>
        <div class="par-barras"><i class="b-prev ${i < mesHoje && prevMes[i] ? "atrasada" : ""}" style="height:${(prevMes[i] / maxPrev) * 100}%"></i></div>
        <span>${m}</span>
      </div>`).join("")}
    </div>`;

  // Por tipo: faturado, %, ticket médio e quantidade
  const porTipo = TIPOS_CONTRATO.map((t) => {
    const l = validos.filter((c) => c.tipo === t);
    const v = l.reduce((s, c) => s + n2(c.valor), 0);
    return { t, v, n: l.length, ticket: l.length ? v / l.length : 0 };
  }).filter((x) => x.n);
  if (comPeriodo.length) porTipo.push({ t: "TikTok Shop", v: totalTtk, n: comPeriodo.length, ticket: totalTtk / comPeriodo.length, repasse: true });
  porTipo.sort((a, b) => b.v - a.v);
  const maxTipo = Math.max(1, ...porTipo.map((x) => x.v));

  // Top clientes (junta "Torra" e "torra"), com quantas vezes cada marca já fechou em todos os anos
  const vezes = {};
  todos.filter(fechado).forEach((c) => { vezes[chaveCliente(c)] = (vezes[chaveCliente(c)] || 0) + 1; });
  const clientes = {};
  validos.forEach((c) => {
    const k = chaveCliente(c);
    if (!clientes[k]) clientes[k] = { nome: "", v: 0, n: 0, vezes: vezes[k] || 1 };
    clientes[k].nome = melhorNome(clientes[k].nome, c.cliente);
    clientes[k].v += n2(c.valor); clientes[k].n++;
  });
  const top = Object.values(clientes).sort((a, b) => b.v - a.v).slice(0, 6);
  const maxTop = Math.max(1, ...top.map((x) => x.v));

  // Por status (com o vencido automático)
  const contaStatus = {};
  doPeriodo.forEach((c) => { const s = situacaoDe(c); contaStatus[s] = (contaStatus[s] || 0) + 1; });

  el.innerHTML = `
    <div class="barra">
      <select class="campo" id="fin-ano" aria-label="Ano">${anos.map((a) => `<option ${a === fin.ano ? "selected" : ""}>${a}</option>`).join("")}</select>
      <select class="campo" id="fin-mes" aria-label="Mês"><option value="0">Ano todo</option>${MESES_LONGOS.map((m, i) => `<option value="${i + 1}" ${fin.mes === i + 1 ? "selected" : ""}>${m}</option>`).join("")}</select>
      <span class="espaco"></span>
      <button class="btn" type="button" id="csv-fin">${ic("baixar")}Baixar CSV</button>
      <button class="btn primario" type="button" id="add-contrato">${ic("mais")}Novo contrato</button>
    </div>
    ${relatorioPeriodo()}
    <div class="grade-fin">
      ${cartaoFunil(funil)}
      ${insightsDoAno(funil)}
    </div>
    <details class="analise" id="analise" ${analiseAberta ? "open" : ""}>
    <summary>Ver análise completa <span class="sub">gráficos, TikTok Shop, tipos de trabalho e clientes</span></summary>
    ${cartaoTtk(comAno)}
    <div class="grade-fin">
      <div class="cartao">
        <div class="barra" style="margin-bottom:4px"><h2 style="margin:0">Faturado x entrou na conta em ${fin.ano}</h2><span class="espaco"></span>
          <span class="legenda" style="margin:0"><span><i class="leg-fat"></i>Faturado (mês do fechamento)</span><span><i class="leg-rec"></i>Entrou na conta (dia que caiu)</span>${temMeta ? `<span><i class="leg-meta"></i>Meta</span>` : ""}</span></div>
        ${fatMes.some(Boolean) || recMes.some(Boolean) ? graficoMeses : `<p class="vazio">Nenhum contrato em ${fin.ano}.</p>`}
      </div>
      <div class="cartao">
        <h2>Previsão de recebimento em ${fin.ano}</h2>
        <p class="sub" style="margin:-6px 0 6px">o que ainda falta receber, no mês da data prevista (nota + prazo)</p>
        ${graficoPrev}
      </div>
    </div>
    <div class="grade-fin tres">
      <div class="cartao">
        <h2>Por tipo de trabalho</h2>
        ${porTipo.length ? `<div class="lista-barras">${porTipo.map((x) => `<div class="linha-barra" data-dica="<b>${esc(x.t)}</b><br>${real(x.v)} em ${qtd(x.n, x.repasse ? "repasse" : "contrato", x.repasse ? "repasses" : "contratos")}<br>${x.repasse ? "média por repasse" : "ticket médio"} ${real(x.ticket)}">
          <span class="lb-nome">${esc(x.t)}</span>
          <span class="lb-trilho"><i style="width:${(x.v / maxTipo) * 100}%"></i></span>
          <span class="lb-valor">${real(x.v)} <small>${pct(x.v, faturado)}%</small></span>
          <small class="lb-extra">${x.repasse ? `${qtd(x.n, "repasse", "repasses")} · média ${real(x.ticket)}` : `${qtd(x.n, "contrato", "contratos")} · ticket ${real(x.ticket)}`}</small>
        </div>`).join("")}</div>` : `<p class="vazio">Sem contratos fechados no período.</p>`}
      </div>
      <div class="cartao">
        <h2>Clientes que mais pagaram</h2>
        ${top.length ? `<div class="lista-barras">${top.map((x, i) => `<div class="linha-barra" data-dica="<b>${esc(x.nome)}</b><br>${real(x.v)} em ${qtd(x.n, "contrato", "contratos")}<br>${x.vezes > 1 ? `já fechou ${qtd(x.vezes)} vezes com você` : "fechou uma vez só"}">
          <span class="lb-nome">${i + 1}. ${esc(x.nome)}</span>
          <span class="lb-trilho"><i style="width:${(x.v / maxTop) * 100}%"></i></span>
          <span class="lb-valor">${real(x.v)}</span>
          <small class="lb-extra">${qtd(x.n, "contrato", "contratos")}${x.vezes > 1 ? ` <span class="etq verde">voltou ${qtd(x.vezes)}x</span>` : ""}</small>
        </div>`).join("")}</div>` : `<p class="vazio">Sem contratos fechados no período.</p>`}
      </div>
      <div class="cartao">
        <h2>Contratos por status</h2>
        ${Object.keys(contaStatus).length ? `<div class="status-lista">${STATUS_FILTRO.filter((s) => contaStatus[s]).map((s) => `<button type="button" class="status-item" data-filtrar="${esc(s)}"><span class="pilula ${classeStatus(s)}">${esc(s)}</span><b>${qtd(contaStatus[s])}</b></button>`).join("")}</div>
          <p class="sub">Clique num status para ver só esses contratos na lista.</p>` : `<p class="vazio">Sem contratos no período.</p>`}
      </div>
    </div>
    <details class="cartao como-usar">
      <summary><b>Dicas para o painel mostrar a verdade</b></summary>
      <ol>
        <li><b>Toda proposta entra como "Em negociação"</b>, mesmo antes de fechar. Assim você vê quanto dinheiro está em jogo e não esquece de fazer follow-up. Se a marca disser não, mude para "Perdida".</li>
        <li><b>Mude o status sempre que o trabalho andar.</b> Dá para fazer direto pela aba Campanhas, arrastando o cartão.</li>
        <li><b>Coloque a data da nota fiscal no dia que enviar.</b> É ela que calcula a data prevista e avisa quando venceu.</li>
        <li><b>Lance cada parcela no dia que o dinheiro caiu.</b> Quando o valor todo entrar, o contrato vira "Pago" sozinho.</li>
        <li><b>Toda quarta, lance o repasse do TikTok Shop.</b> Leva 10 segundos e entra no faturado.</li>
        <li><b>No dia 1 de cada mês</b>, defina a meta e olhe o card "Onde está o seu dinheiro". O gargalo é por onde começar o mês.</li>
      </ol>
    </details>
    </details>
    <div class="barra" style="margin-top:4px">
      <h2 style="margin:0">Contratos de ${nomePeriodo}</h2>
      <div class="busca">${ic("busca")}<input type="search" id="busca-fin" placeholder="Buscar cliente ou descrição" value="${esc(fin.busca)}" aria-label="Buscar contratos"></div>
      <select class="campo" id="fin-status" aria-label="Filtrar por status"><option value="">Todos os status</option>${STATUS_FILTRO.map((s) => `<option ${fin.status === s ? "selected" : ""}>${s}</option>`).join("")}</select>
    </div>
    <div class="tabela-caixa">
      <table>
        <thead><tr><th>Cliente</th><th>Tipo</th><th>Descrição</th><th>Mês</th><th class="num">Valor</th><th>Previsto</th><th>Status</th><th class="num">Recebido</th><th class="num">Saldo</th></tr></thead>
        <tbody id="lista-contratos"></tbody>
      </table>
    </div>
    <p class="contagem" id="conta-contratos"></p>`;

  const pintar = () => {
    const q = fin.busca.toLowerCase();
    const lista = doPeriodo.filter((c) => (!fin.status || situacaoDe(c) === fin.status) && (!q || [c.cliente, c.descricao, c.obs].some((x) => String(x || "").toLowerCase().includes(q))))
      .sort((a, b) => (n2(b.mes) - n2(a.mes)) || (String(b.data_nf || "").localeCompare(String(a.data_nf || ""))) || (b.id - a.id));
    $("#lista-contratos").innerHTML = lista.length === 0
      ? `<tr><td colspan="9"><p class="vazio">${todos.length ? "Nenhum contrato com esse filtro." : "Nenhum contrato ainda. Clique em Novo contrato."}</p></td></tr>`
      : lista.map((c) => {
          const s = situacaoDe(c), prev = previstaDe(c), sal = saldoDe(c);
          const dias = prev ? diasEntre(prev, hojeISO()) : 0;
          return `<tr class="clicavel ${grupoDe(c.status) === "fora" ? "escondido" : ""}" data-id="${esc(c.id)}">
            <td><b>${esc(c.cliente)}</b></td>
            <td>${esc(c.tipo || "")}</td>
            <td class="corta" title="${esc(c.descricao || "")}">${esc(c.descricao || "")}</td>
            <td>${c.mes ? MESES_CURTOS[c.mes - 1] : ""}</td>
            <td class="num">${real(c.valor)}</td>
            <td style="white-space:nowrap">${prev ? dataBR(prev) : `<span class="sub">${fechado(c) ? "sem nota" : ""}</span>`}${s === "Vencido" ? `<span class="etq vermelha">${plural(dias, "dia", "dias")}</span>` : ""}</td>
            <td><span class="pilula ${classeStatus(s)}">${esc(s)}</span></td>
            <td class="num">${real(recebidoDe(c))}</td>
            <td class="num">${sal > 0 ? `<b>${real(sal)}</b>` : `<span class="sub">${real(0)}</span>`}</td>
          </tr>`;
        }).join("");
    const tot = lista.filter(fechado);
    $("#conta-contratos").textContent = `${qtd(lista.length, "contrato", "contratos")} · ${real(tot.reduce((s, c) => s + n2(c.valor), 0))} faturado · ${real(tot.reduce((s, c) => s + saldoDe(c), 0))} a receber`;
  };
  pintar();

  $("#fin-ano").onchange = (e) => { fin.ano = Number(e.target.value); desenhar(); };
  $("#fin-mes").onchange = (e) => { fin.mes = Number(e.target.value); desenhar(); };
  $("#busca-fin").addEventListener("input", (e) => { fin.busca = e.target.value; pintar(); });
  $("#fin-status").onchange = (e) => { fin.status = e.target.value; pintar(); };
  $$("[data-filtrar]", el).forEach((b) => b.onclick = () => { fin.status = b.dataset.filtrar; desenhar(); $("#lista-contratos").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $$("[data-meta]", el).forEach((b) => b.onclick = () => formMeta(fin.ano, fin.mes));
  // Lembra se a análise completa e as dicas ficam abertas
  $("#analise").addEventListener("toggle", (e) => { try { localStorage.setItem("fin-analise", e.target.open ? "1" : "0"); } catch (_) {} });
  $$("[data-dicas]", el).forEach((b) => b.onclick = () => {
    const card = b.closest(".resumo-ano");
    const mostra = card.classList.toggle("mostra-dicas");
    b.textContent = mostra ? "esconder dicas" : "ver dicas";
    try { localStorage.setItem("fin-dicas", mostra ? "1" : "0"); } catch (_) {}
  });
  // Clicar numa etapa do "onde está o seu dinheiro" mostra os contratos dela
  $$("[data-balde]", el).forEach((b) => b.onclick = () => {
    const balde = funil.baldes.find((x) => x.k === b.dataset.balde);
    if (!balde || !balde.lista.length) return;
    abrirJanelaSimples(balde.nome, `<p class="sub" style="margin-top:0">${esc(balde.explica)}</p>
      <ul class="lista-balde">${balde.lista.map((c) => `<li><button type="button" class="link-btn" data-abrir-contrato="${esc(c.id)}"><b>${esc(c.cliente)}</b> ${c.descricao ? `· ${esc(c.descricao)}` : ""}</button>
        <span class="pilula ${classeStatus(situacaoDe(c))}">${esc(situacaoDe(c))}</span><b>${real(balde.k === "negociacao" ? c.valor : saldoDe(c))}</b></li>`).join("")}</ul>
      <div class="dica-caixa ${balde.k === "vencido" ? "urgente" : ""}"><b>O que fazer:</b> ${esc(balde.acao)}</div>`, "");
    $$("[data-abrir-contrato]").forEach((x) => x.onclick = () => {
      x.closest("dialog").close();
      formContrato(S.contratos.find((c) => String(c.id) === x.dataset.abrirContrato));
    });
  });
  $("#add-contrato").onclick = () => formContrato();
  ligarCartaoTtk(el);
  $("#lista-contratos").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) formContrato(todos.find((c) => String(c.id) === tr.dataset.id));
  });
  $("#csv-fin").onclick = () => baixarCSV("financeiro",
    ["Cliente", "Tipo", "Descrição", "Valor", "Mês", "Ano", "Data da nota", "Prazo (dias)", "Data prevista", "Status", "Parcela 1", "Data pgto P1", "Parcela 2", "Data pgto P2", "Recebido", "Saldo", "Obs"],
    todos.map((c) => [c.cliente, c.tipo, c.descricao, n2(c.valor).toFixed(2).replace(".", ","), c.mes ? MESES_LONGOS[c.mes - 1] : "", c.ano, dataBR(c.data_nf), c.prazo_dias, dataBR(previstaDe(c)), situacaoDe(c),
      c.parcela1 != null ? n2(c.parcela1).toFixed(2).replace(".", ",") : "", dataBR(c.data_p1), c.parcela2 != null ? n2(c.parcela2).toFixed(2).replace(".", ",") : "", dataBR(c.data_p2),
      recebidoDe(c).toFixed(2).replace(".", ","), saldoDe(c).toFixed(2).replace(".", ","), c.obs])
    .concat(S.comissoes.map((x) => ["TikTok Shop (repasse)", "TikTok Shop", x.gmv ? `GMV ${real(x.gmv)}` : "", n2(x.valor).toFixed(2).replace(".", ","), MESES_LONGOS[deISO(x.data).getMonth()], deISO(x.data).getFullYear(), "", "", "", "Pago", n2(x.valor).toFixed(2).replace(".", ","), dataBR(x.data), "", "", n2(x.valor).toFixed(2).replace(".", ","), "0,00", x.obs])));
  ligarDicas(el);
}

function formMeta(ano, mes) {
  const atual = metaDe(ano, mes);
  const sug = sugestaoMeta(ano, mes);
  abrirForm({
    titulo: `Meta de ${MESES_LONGOS[mes - 1].toLowerCase()} de ${ano}`,
    valores: { valor: atual || sug || "", repetir: false },
    campos: [
      { n: "valor", r: "Quanto você quer faturar no mês (R$)", t: "number", inteiro: true,
        ajuda: sug ? `Sugestão: ${real(sug)}, que é a média dos seus últimos meses com faturamento mais 15%. Meta boa é a que puxa um pouco, sem ser impossível.` : "Comece com um valor um pouco acima do que você já faturou num mês bom." },
      { n: "repetir", r: "Usar o mesmo valor nos próximos meses, até dezembro", t: "check", inteiro: true }
    ],
    aoSalvar: async (d) => {
      if (!CAMPOS.metas || !CAMPOS.metas.length) { avisar("A tabela metas não existe no banco. Rode o banco.sql.", true); return false; }
      const linhas = [];
      for (let m = mes; m <= (d.repetir ? 12 : mes); m++) linhas.push({ ano, mes: m, valor: n2(d.valor) });
      const { error } = await db.from("metas").upsert(linhas, { onConflict: "ano,mes" });
      if (error) { avisar(traduzErro(error), true); return false; }
      recarregar("metas");
      return true;
    }
  });
}

function formContrato(c, extra = {}) {
  const hoje = new Date();
  abrirForm({
    titulo: c ? "Editar contrato" : "Novo contrato",
    tabela: "contratos",
    valores: c || { tipo: "UGC", status: "Em negociação", mes: hoje.getMonth() + 1, ano: hoje.getFullYear(), prazo_dias: 30, ...(extra.valores || {}) },
    campos: [
      { n: "cliente", r: "Marca / cliente", req: true, inteiro: true },
      { n: "tipo", r: "Tipo", t: "select", op: TIPOS_CONTRATO.map((t) => [t, t]) },
      { n: "status", r: "Etapa", t: "select", op: STATUS_CONTRATO.map((s) => [s, s]) },
      { n: "descricao", r: "Descrição", inteiro: true, ph: "ex: 2 vídeos + 3 stories" },
      { n: "qtd", r: "Quantidade de vídeos", t: "number" },
      { n: "prazo_entrega", r: "Prazo de entrega para a marca", t: "date" },
      { n: "valor", r: "Valor total (R$)", t: "number" },
      { n: "mes", r: "Mês de fechamento", t: "select", op: MESES_LONGOS.map((m, i) => [i + 1, m]) },
      { n: "ano", r: "Ano", t: "number" },
      { n: "data_nf", r: "Data da nota fiscal", t: "date" },
      { n: "prazo_dias", r: "Prazo para pagar (dias)", t: "number" },
      { n: "parcela1", r: "Parcela 1 recebida (R$)", t: "number" },
      { n: "data_p1", r: "Dia que a parcela 1 entrou", t: "date" },
      { n: "parcela2", r: "Parcela 2 recebida (R$)", t: "number" },
      { n: "data_p2", r: "Dia que a parcela 2 entrou", t: "date" },
      { n: "favorita", r: "Destacar com estrela", t: "check" },
      { n: "obs", r: "Observação", t: "textarea" }
    ],
    aoSalvar: async (d) => {
      if (d.qtd === 0 && !(c && c.qtd === 0)) d.qtd = null;
      d.mes = Number(d.mes) || null;
      d.ano = Number(d.ano) || hoje.getFullYear();
      // Parcela vazia fica vazia (e não zero)
      ["parcela1", "parcela2"].forEach((k) => { if (!d[k]) d[k] = null; });
      if (d.prazo_dias === 0 && !(c && c.prazo_dias === 0)) d.prazo_dias = null;
      // Ajudas automáticas: nota enviada sem data ganha a data de hoje; valor todo recebido vira Pago
      if (["Nota fiscal enviada", "Aguardando pagamento"].includes(d.status) && !d.data_nf) d.data_nf = hojeISO();
      const quitado = n2(d.valor) > 0 && n2(d.parcela1) + n2(d.parcela2) >= n2(d.valor);
      if (quitado && grupoDe(d.status) === "dinheiro" && d.status !== "Pago") { d.status = "Pago"; setTimeout(() => avisar("Marquei como Pago: o valor todo já foi recebido."), 400); }
      const ok = await gravar("contratos", d, c ? c.id : null);
      if (ok) { recarregar("contratos"); if (extra.depois) extra.depois(); }
      return ok;
    },
    aoApagar: c ? async () => { const ok = await apagarLinha("contratos", c.id); if (ok) recarregar("contratos"); return ok; } : null
  });
}

/* =============================================================
   ABA CAMPANHAS (quadro de etapas)
   Mostra os mesmos contratos do Financeiro, da negociação até o
   pagamento. Cadastrou uma vez, aparece nas duas abas.
   ============================================================= */
const COLUNAS_PRODUCAO = [
  ["Negociação", ["Em negociação", "Assinatura de contrato"]],
  ["Briefing", ["Aguardando briefing"]],
  ["Roteiro", ["Roteiro em andamento", "Aguardando aprovação de roteiro"]],
  ["Produção", ["Gravando", "Editando"]],
  ["Aprovação", ["Enviado p/ aprovação"]],
  ["Entregue", ["Entregue", "Nota fiscal enviada", "Aguardando pagamento"]],
  ["Pago", ["Pago"]]
];
const prod = { busca: "", soDestaque: false, mes: "" }; // mes: "" (todos) ou "2026-10"
const colunaDe = (c) => (COLUNAS_PRODUCAO.find((x) => x[1].includes(c.status)) || [null])[0];
const entregue = (c) => grupoDe(c.status) === "dinheiro";

function avisoEntrega(c) {
  if (!c.prazo_entrega || entregue(c) || !fechado(c)) return "";
  const d = diasEntre(hojeISO(), c.prazo_entrega);
  if (d < 0) return `<span class="etq vermelha">${plural(-d, "dia", "dias")} atrasada</span>`;
  if (d === 0) return `<span class="etq amarela">entrega hoje</span>`;
  if (d <= 3) return `<span class="etq amarela">entrega em ${plural(d, "dia", "dias")}</span>`;
  return "";
}

function desenharProducao(el) {
  // Meses que têm campanha, do mais novo para o mais antigo
  const chaveMes = (c) => c.ano && c.mes ? `${c.ano}-${pad(Number(c.mes))}` : "";
  const meses = [...new Set(S.contratos.filter((c) => grupoDe(c.status) !== "fora").map(chaveMes).filter(Boolean))].sort().reverse();
  const nomeMes = (k) => `${MESES_LONGOS[Number(k.slice(5)) - 1]} ${k.slice(0, 4)}`;
  const ativos = S.contratos.filter((c) => grupoDe(c.status) !== "fora" && (!prod.mes || chaveMes(c) === prod.mes));
  const negociando = ativos.filter((c) => grupoDe(c.status) === "negociacao");
  const emProducao = ativos.filter((c) => grupoDe(c.status) === "producao");
  const atrasadas = emProducao.filter((c) => c.prazo_entrega && c.prazo_entrega < hojeISO());
  const videos = emProducao.reduce((s, c) => s + (Number(c.qtd) || 0), 0);
  const agora = new Date();
  const mesKpi = prod.mes || `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}`;
  const entreguesMes = ativos.filter((c) => entregue(c) && chaveMes(c) === mesKpi);

  el.innerHTML = `
    <div class="faixa-kpi">
      <div class="kpi"><span>Em negociação</span><strong>${qtd(negociando.length)}</strong><small>${real(negociando.reduce((s, c) => s + n2(c.valor), 0))} em propostas</small></div>
      <div class="kpi"><span>Em produção</span><strong>${qtd(emProducao.length)}</strong><small>${real(emProducao.reduce((s, c) => s + n2(c.valor), 0))} em contratos</small></div>
      <div class="kpi"><span>Vídeos para entregar</span><strong>${qtd(videos)}</strong><small>somando as campanhas abertas</small></div>
      <div class="kpi ${atrasadas.length ? "alerta" : ""}"><span>Atrasadas</span><strong>${qtd(atrasadas.length)}</strong><small>${atrasadas.length ? "passou do prazo de entrega" : "tudo em dia"}</small></div>
      <div class="kpi"><span>${prod.mes ? "Entregues no mês" : "Entregues este mês"}</span><strong>${qtd(entreguesMes.length)}</strong><small>${nomeMes(mesKpi)}</small></div>
    </div>
    <div class="barra">
      <div class="busca">${ic("busca")}<input type="search" id="busca-prod" placeholder="Buscar cliente ou descrição" value="${esc(prod.busca)}" aria-label="Buscar campanhas"></div>
      <div class="chips" role="group" aria-label="Filtro"><button class="chip" type="button" data-dest="0" aria-pressed="${!prod.soDestaque}">Todas</button><button class="chip" type="button" data-dest="1" aria-pressed="${prod.soDestaque}">★ Destaques</button></div>
      <label class="filtro-mes">${ic("calendario")}<select id="mes-prod" aria-label="Filtrar por mês">
        <option value="">Todos os meses</option>
        ${meses.map((k) => `<option value="${k}" ${prod.mes === k ? "selected" : ""}>${nomeMes(k)}</option>`).join("")}
      </select></label>
      <span class="espaco"></span>
      <span class="sub">o mesmo cadastro do Financeiro</span>
      <button class="btn primario" type="button" id="add-prod">${ic("mais")}Nova campanha</button>
    </div>
    <div class="quadro quadro-7" id="quadro-prod"></div>`;

  const pintar = () => {
    const q = prod.busca.toLowerCase();
    const lista = ativos.filter((c) => (!prod.soDestaque || c.favorita) && (!q || [c.cliente, c.descricao, c.obs].some((x) => String(x || "").toLowerCase().includes(q))));
    $("#quadro-prod").innerHTML = COLUNAS_PRODUCAO.map(([nome, sts]) => {
      let itens = lista.filter((c) => colunaDe(c) === nome)
        .sort((a, b) => (b.favorita === true) - (a.favorita === true) || sts.indexOf(b.status) - sts.indexOf(a.status) || String(a.prazo_entrega || "9999").localeCompare(String(b.prazo_entrega || "9999")));
      let resto = 0;
      if (nome === "Pago" && !prod.mes) { // só os mais recentes, o histórico completo está no Financeiro
        itens = itens.sort((a, b) => (n2(b.ano) * 100 + n2(b.mes)) - (n2(a.ano) * 100 + n2(a.mes)) || b.id - a.id);
        resto = Math.max(0, itens.length - 6); itens = itens.slice(0, 6);
      }
      const soma = itens.reduce((s, c) => s + (nome === "Entregue" ? saldoDe(c) : n2(c.valor)), 0);
      return `<section class="coluna col-prod" data-coluna="${esc(nome)}" aria-label="${nome}">
        <header><b>${nome}</b><span class="pilula">${qtd(itens.length + resto)}</span>${soma && nome !== "Pago" ? `<small class="sub" style="margin-left:auto">${real(soma)}</small>` : ""}</header>
        <div class="coluna-corpo">${itens.map(cartaoCampanha).join("") || `<p class="coluna-vazia">${nome === "Negociação" ? "Propostas novas aparecem aqui" : "Arraste para cá"}</p>`}
        ${resto ? `<button class="btn" type="button" data-ir-financeiro style="width:100%;justify-content:center">+${qtd(resto)} no Financeiro</button>` : ""}</div>
      </section>`;
    }).join("");
  };
  pintar();

  $("#busca-prod").addEventListener("input", (e) => { prod.busca = e.target.value; pintar(); });
  $("#mes-prod").onchange = (e) => { prod.mes = e.target.value; desenhar(); };
  $$("[data-dest]", el).forEach((b) => b.onclick = () => { prod.soDestaque = b.dataset.dest === "1"; desenhar(); });
  $("#add-prod").onclick = () => formContrato();

  const quadro = $("#quadro-prod");
  let arrastando = null;
  quadro.addEventListener("dragstart", (e) => { const c = e.target.closest(".cartao-ideia"); if (!c) return; arrastando = c.dataset.id; c.classList.add("arrastando"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", arrastando); });
  quadro.addEventListener("dragend", (e) => { const c = e.target.closest(".cartao-ideia"); if (c) c.classList.remove("arrastando"); $$(".coluna.sobre", quadro).forEach((x) => x.classList.remove("sobre")); });
  quadro.addEventListener("dragover", (e) => { const col = e.target.closest(".coluna"); if (!col || !arrastando) return; e.preventDefault(); $$(".coluna.sobre", quadro).forEach((x) => { if (x !== col) x.classList.remove("sobre"); }); col.classList.add("sobre"); });
  quadro.addEventListener("drop", (e) => {
    const col = e.target.closest(".coluna"); if (!col || !arrastando) return;
    e.preventDefault();
    const c = S.contratos.find((x) => String(x.id) === arrastando); arrastando = null;
    if (!c || colunaDe(c) === col.dataset.coluna) return;
    mudarEtapa(c, COLUNAS_PRODUCAO.find((x) => x[0] === col.dataset.coluna)[1][0]);
  });
  quadro.addEventListener("change", (e) => { const s = e.target.closest("[data-etapa-prod]"); if (s) mudarEtapa(S.contratos.find((x) => String(x.id) === s.dataset.etapaProd), s.value); });
  quadro.addEventListener("click", async (e) => {
    if (e.target.closest("[data-ir-financeiro]")) { fin.status = ""; irPara("financeiro"); return; }
    if (e.target.closest("select")) return;
    const estrela = e.target.closest("[data-estrela]");
    const cartao = e.target.closest(".cartao-ideia");
    if (!cartao) return;
    const c = S.contratos.find((x) => String(x.id) === cartao.dataset.id);
    if (estrela) { if (await gravar("contratos", { favorita: !c.favorita }, c.id)) { c.favorita = !c.favorita; pintar(); } return; }
    formContrato(c);
  });
}

function cartaoCampanha(c) {
  const s = situacaoDe(c);
  return `<article class="cartao-ideia cartao-campanha ${c.favorita ? "favorita" : ""}" draggable="true" data-id="${esc(c.id)}" tabindex="0">
    <div class="item-trans-topo">
      <span class="pilula ${c.tipo === "Influencer" ? "p-publicidade" : "p-conteudo"}">${esc(c.tipo || "")}</span>
      ${c.qtd ? `<span class="pilula p-status">${plural(Number(c.qtd), "vídeo", "vídeos")}</span>` : ""}
      <button class="icone-btn estrela ${c.favorita ? "on" : ""}" type="button" data-estrela aria-pressed="${!!c.favorita}" aria-label="${c.favorita ? "Tirar destaque" : "Destacar"}" style="margin-left:auto;width:24px;height:24px">${ic("estrela")}</button>
    </div>
    <b>${esc(c.cliente)}</b>
    ${c.descricao ? `<small>${esc(c.descricao)}</small>` : ""}
    ${fechado(c) && !entregue(c) ? `<small>${c.prazo_entrega ? `Entrega ${dataBR(c.prazo_entrega)}` : "Sem prazo de entrega"}${avisoEntrega(c)}</small>` : ""}
    <small><b>${real(c.valor)}</b>${saldoDe(c) > 0 && entregue(c) ? ` · falta receber ${real(saldoDe(c))}` : ""}</small>
    ${c.status !== "Pago" ? `<span class="pilula ${classeStatus(s)}" style="align-self:flex-start">${esc(s)}</span>` : ""}
    <select class="campo etapa-cartao" data-etapa-prod="${esc(c.id)}" aria-label="Mudar a etapa de ${esc(c.cliente)}">
      ${STATUS_CONTRATO.map((v) => `<option value="${esc(v)}" ${v === c.status ? "selected" : ""}>${esc(v)}</option>`).join("")}
    </select>
  </article>`;
}

async function mudarEtapa(c, novo) {
  if (!c || c.status === novo) return;
  // Entregue com o valor todo recebido já vira "Pago"
  if (grupoDe(novo) === "dinheiro" && novo !== "Pago" && n2(c.valor) > 0 && recebidoDe(c) >= n2(c.valor)) novo = "Pago";
  const dados = { status: novo };
  if (["Nota fiscal enviada", "Aguardando pagamento"].includes(novo) && !c.data_nf) dados.data_nf = hojeISO();
  const antes = { status: c.status, data_nf: c.data_nf };
  Object.assign(c, dados);
  desenhar();
  if (await gravar("contratos", dados, c.id)) avisar(`${c.cliente}: ${novo}.${dados.data_nf ? " Coloquei a data da nota como hoje." : ""}`);
  else { Object.assign(c, antes); desenhar(); }
}

/* ---------- TikTok Shop: repasses de comissão (toda quarta) ---------- */
// A última quarta-feira (ou hoje, se hoje for quarta)
function ultimaQuarta() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - 3 + 7) % 7));
  return isoLocal(d);
}

function cartaoTtk(comAno) {
  const ultimos = [...S.comissoes].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const barras = ultimos.slice(0, 12).reverse();
  const max = Math.max(1, ...barras.map((x) => n2(x.valor)));
  const totalAno = comAno.reduce((s, x) => s + n2(x.valor), 0);
  const media = comAno.length ? totalAno / comAno.length : 0;
  const lancadoUltima = S.comissoes.some((x) => String(x.data).slice(0, 10) === ultimaQuarta());
  return `<div class="cartao cartao-ttk">
    <div class="barra" style="margin-bottom:6px">
      <h2 style="margin:0">Comissões do TikTok Shop</h2>
      <span class="sub">${comAno.length ? `${real(totalAno)} em ${fin.ano} · média ${real(media)} por repasse` : `nenhum repasse em ${fin.ano}`}</span>
      <span class="espaco"></span>
      ${lancadoUltima ? `<span class="pilula p-pago">quarta ${dataBR(ultimaQuarta()).slice(0, 5)} lançada</span>` : `<span class="pilula p-pendente">falta lançar a quarta ${dataBR(ultimaQuarta()).slice(0, 5)}</span>`}
      <button class="btn primario" type="button" id="add-ttk">${ic("mais")}Lançar repasse</button>
    </div>
    ${barras.length ? `<div class="grade-ttk">
      <div class="barras-mes barras-ttk" role="img" aria-label="Últimos repasses do TikTok Shop">
        ${barras.map((x) => `<div class="grupo-mes" data-ttk="${esc(x.id)}" data-dica="<b>${dataBR(x.data)}</b><br>Comissão: ${real(x.valor)}${x.gmv ? `<br>GMV: ${real(x.gmv)}` : ""}${x.itens ? `<br>${plural(Number(x.itens), "item vendido", "itens vendidos")}` : ""}">
          <b class="valor-barra">${privado ? "" : Math.round(n2(x.valor)).toLocaleString("pt-BR")}</b>
          <div class="par-barras"><i class="b-prev" style="height:${(n2(x.valor) / max) * 100}%"></i></div>
          <span>${dataBR(x.data).slice(0, 5)}</span>
        </div>`).join("")}
      </div>
      <ul class="lista-ttk">${ultimos.slice(0, 5).map((x) => `<li><button type="button" class="link-ttk" data-ttk="${esc(x.id)}"><span>${dataBR(x.data)}</span><b>${real(x.valor)}</b>${x.gmv ? `<small>GMV ${real(x.gmv)}</small>` : ""}</button></li>`).join("")}</ul>
    </div>
    <p class="sub" style="margin:6px 0 0">os últimos 12 repasses. Clique num repasse para editar.</p>`
    : `<p class="vazio">Lance aqui o valor que o TikTok Shop paga toda quarta. Ele soma no faturado, no recebido e nos gráficos do Financeiro.</p>`}
  </div>`;
}

function ligarCartaoTtk(el) {
  const b = $("#add-ttk", el);
  if (b) b.onclick = () => formComissao();
  $$("[data-ttk]", el).forEach((x) => x.addEventListener("click", () => formComissao(S.comissoes.find((c) => String(c.id) === x.dataset.ttk))));
}

function formComissao(c) {
  abrirForm({
    titulo: c ? "Editar repasse do TikTok Shop" : "Lançar repasse do TikTok Shop",
    tabela: "comissoes_ttk",
    valores: c || { data: ultimaQuarta() },
    campos: [
      { n: "data", r: "Dia que caiu (quarta)", t: "date", req: true },
      { n: "valor", r: "Comissão recebida (R$)", t: "number" },
      { n: "gmv", r: "GMV da semana (opcional)", t: "number" },
      { n: "itens", r: "Itens vendidos (opcional)", t: "number" },
      { n: "obs", r: "Observação", t: "textarea", ph: "ex: produto que mais vendeu na semana" }
    ],
    aoSalvar: async (d) => {
      if (!d.gmv) d.gmv = null;
      if (!d.itens) d.itens = null;
      const ok = await gravar("comissoes_ttk", d, c ? c.id : null);
      if (ok) recarregar("comissoes_ttk");
      return ok;
    },
    aoApagar: c ? async () => { const ok = await apagarLinha("comissoes_ttk", c.id); if (ok) recarregar("comissoes_ttk"); return ok; } : null
  });
}

/* =============================================================
   LEMBRETES
   O painel confere sozinho o que precisa da sua atenção e pergunta
   com botões de resposta rápida:
     repasse do TikTok Shop (a partir de quarta, até ser lançado)
     pagamento vencido ou vencendo, trabalho entregue sem nota,
     entrega chegando e negociação parada há 5 dias ou mais.
   As mesmas regras mandam a notificação no celular (ajudante
   "lembretes" no Supabase, em supabase/functions/lembretes).
   ============================================================= */
const somaDiasISO = (n, base = hojeISO()) => { const d = deISO(base); d.setDate(d.getDate() + n); return isoLocal(d); };
const adiado = (chave) => S.adiados.some((a) => a.chave === chave && String(a.ate).slice(0, 10) >= hojeISO());

async function adiarLembrete(chave, ate, aviso = "Certo, eu lembro de novo depois.") {
  if (!CAMPOS.lembretes_adiados || !CAMPOS.lembretes_adiados.length) { avisar("A tabela lembretes_adiados não existe no banco. Rode o banco.sql.", true); return; }
  const { error } = await db.from("lembretes_adiados").upsert({ chave, ate }, { onConflict: "chave" });
  if (error) { avisar(traduzErro(error), true); return; }
  S.adiados = S.adiados.filter((a) => a.chave !== chave).concat({ chave, ate });
  avisar(aviso);
  desenhar();
}

/* ---------- Lembretes rápidos ----------
   Você escreve ("cobrar a RAMPY do pagamento"), escolhe quando, e na
   hora o celular avisa (ajudante "lembretes", relógio de cada minuto).
   Enquanto não marcar "Feito", ele fica no sino. */
const lerRapidos = () => ler("lembretes_rapidos", (q, c) => (c.includes("feito") ? q.eq("feito", false).order("quando", { ascending: true }) : q));
async function recarregarRapidos() { S.rapidos = await lerRapidos(); desenhar(); }

const QUANDO_RAPIDO = [["1h", "Em 1 hora"], ["3h", "Em 3 horas"], ["hoje18", "Hoje 18h"], ["amanha9", "Amanhã 9h"], ["segunda9", "Segunda 9h"]];
function quandoRapido(op) {
  const d = new Date(); d.setSeconds(0, 0);
  if (op === "1h") d.setHours(d.getHours() + 1);
  else if (op === "3h") d.setHours(d.getHours() + 3);
  else if (op === "hoje18") d.setHours(18, 0);
  else if (op === "amanha9") { d.setDate(d.getDate() + 1); d.setHours(9, 0); }
  else if (op === "segunda9") { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0); }
  return d;
}
const paraCampoHora = (d) => `${isoLocal(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function quandoTexto(iso) {
  const d = new Date(iso), hoje = hojeISO(), dia = isoLocal(d);
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (dia === hoje) return `hoje ${hora}`;
  if (dia === somaDiasISO(1)) return `amanhã ${hora}`;
  return `${DIAS_SEMANA[d.getDay()].slice(0, 3)} ${dataBR(dia).slice(0, 5)} ${hora}`;
}

function formLembreteRapido(r) {
  if (!CAMPOS.lembretes_rapidos || !CAMPOS.lembretes_rapidos.length) { avisar("A tabela lembretes_rapidos não existe no banco. Rode o banco.sql.", true); return; }
  const d = janela();
  const inicial = r ? new Date(r.quando) : quandoRapido("amanha9");
  const opcoes = QUANDO_RAPIDO.filter(([k]) => k !== "hoje18" || new Date().getHours() < 17);
  d.innerHTML = `<form class="form-janela" novalidate>
    <div class="janela-topo"><h3>${r ? "Editar lembrete" : "Novo lembrete"}</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div>
    <div class="janela-corpo"><div class="form-grade">
      <div class="inteiro"><label for="f-texto">O que lembrar</label><input class="campo" style="width:100%" id="f-texto" name="texto" value="${esc(r ? r.texto : "")}" placeholder="Ex.: cobrar o time da RAMPY sobre o pagamento" autocomplete="off"></div>
      <div class="inteiro"><label>Quando avisar</label>
        <div class="chips quando-chips" role="group" aria-label="Atalhos de horário">${opcoes.map(([k, t]) => `<button type="button" class="chip" data-quando="${k}" aria-pressed="${!r && k === "amanha9"}">${t}</button>`).join("")}</div>
      </div>
      <div class="inteiro"><label for="f-quando">Dia e hora</label><input class="campo" style="width:100%" id="f-quando" name="quando" type="datetime-local" value="${paraCampoHora(inicial)}"></div>
    </div><p class="sub" style="margin:10px 0 0">Na hora marcada chega a notificação no celular, e o lembrete fica no sino até você marcar "Feito".</p></div>
    <div class="janela-pe">
      ${r ? `<button type="button" class="btn perigo esq" data-apagar>${ic("apagar")}Apagar</button>` : ""}
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="submit" class="btn primario">${ic("sino")}Salvar lembrete</button>
    </div></form>`;
  const f = $("form", d);
  $$("[data-fechar]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  $$("[data-quando]", d).forEach((b) => b.addEventListener("click", () => {
    f.elements.quando.value = paraCampoHora(quandoRapido(b.dataset.quando));
    $$("[data-quando]", d).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  f.elements.quando.addEventListener("input", () => $$("[data-quando]", d).forEach((x) => x.setAttribute("aria-pressed", "false")));
  if (r) $("[data-apagar]", d).addEventListener("click", async () => {
    if (!(await confirmar("Apagar esse lembrete?"))) return;
    if (await apagarLinha("lembretes_rapidos", r.id)) { d.close(); recarregarRapidos(); }
  });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = f.elements.texto.value.trim();
    if (!texto) { f.elements.texto.focus(); avisar("Escreva o que é pra lembrar.", true); return; }
    const quando = new Date(f.elements.quando.value);
    if (isNaN(quando)) { avisar("Escolha o dia e a hora.", true); return; }
    const btn = $('button[type="submit"]', f); btn.disabled = true;
    const ok = await gravar("lembretes_rapidos", { texto, quando: quando.toISOString(), avisado: false, feito: false }, r ? r.id : null);
    btn.disabled = false;
    if (ok) { d.close(); avisar(`Combinado! Eu te aviso ${quandoTexto(quando.toISOString())}.`); recarregarRapidos(); }
  });
  d.showModal();
  f.elements.texto.focus();
}
async function concluirRapido(r) {
  if (await gravar("lembretes_rapidos", { feito: true }, r.id)) { avisar("Feito! Tirei da lista."); recarregarRapidos(); }
}
async function adiarRapido(r, op) {
  const quando = quandoRapido(op).toISOString();
  if (await gravar("lembretes_rapidos", { quando, avisado: false }, r.id)) { avisar(`Certo, eu lembro de novo ${quandoTexto(quando)}.`); recarregarRapidos(); }
}

function calcularLembretes() {
  const hoje = hojeISO();
  const L = [];
  // Contato novo pelo site (formulário ou mídia kit) vem primeiro
  const novosSite = S.contatos_site.filter((c) => !c.visto);
  if (novosSite.length) L.push({ aba: "portfolio", ic: "email", nivel: "alerta",
    texto: `${novosSite.length === 1 ? "<b>1 contato novo</b>" : `<b>${novosSite.length} contatos novos</b>`} pelo seu site: ${novosSite.slice(0, 2).map((c) => esc(c.marca || c.nome)).join(", ")}.`,
    acoes: [["Ver contatos", true, () => irPara("portfolio")]] });
  // Lembretes rápidos que chegaram na hora vêm primeiro
  const agoraMs = Date.now();
  S.rapidos.filter((r) => !r.feito && Date.parse(r.quando) <= agoraMs).forEach((r) => {
    L.push({ ic: "sino", nivel: "alerta", texto: `<b>${esc(r.texto)}</b><br><span class="sub">lembrete de ${quandoTexto(r.quando)}</span>`,
      acoes: [["Feito", true, () => concluirRapido(r)], ["+1 hora", false, () => adiarRapido(r, "1h")], ["Amanhã 9h", false, () => adiarRapido(r, "amanha9")]] });
  });
  const naoVistas = propostasNaoVistas();
  if (naoVistas.length) {
    const imp = naoVistas.filter((x) => x.importante).length;
    L.push({ aba: "propostas", ic: "email", nivel: imp ? "alerta" : "",
      texto: `${naoVistas.length === 1 ? "Chegou <b>1 proposta nova</b>" : `Chegaram <b>${naoVistas.length} propostas novas</b>`} no Gmail${imp ? ` (${imp === 1 ? "1 parece" : imp + " parecem"} importante)` : ""}: ${naoVistas.slice(0, 2).map((x) => esc(x.de.marca)).join(", ")}.`,
      acoes: [["Ver propostas", true, () => irPara("propostas")]] });
  }
  const destaque = postEmDestaque();
  if (destaque) L.push({ aba: "instagram", ic: "insta", nivel: "",
    texto: `Seu post "<b>${esc((destaque.post.legenda || "sem legenda").slice(0, 50))}</b>" está alcançando <b>${destaque.vezes.toFixed(1).replace(".", ",")}x</b> mais que a sua média. Responda os comentários e repita o formato.`,
    acoes: [["Ver no painel", true, () => irPara("instagram")], ["Ok, vi", false, () => { marcarVisto("ig-vistos", destaque.post.id); desenhar(); }]] });
  const quarta = ultimaQuarta();
  if (!S.comissoes.some((x) => String(x.data).slice(0, 10) === quarta) && !adiado("ttk-" + quarta)) {
    L.push({ aba: "financeiro", ic: "financeiro", nivel: quarta === hoje ? "" : "alerta",
      texto: quarta === hoje ? "Hoje é quarta: <b>lance o repasse do TikTok Shop</b> que caiu." : `Falta lançar o <b>repasse do TikTok Shop</b> de quarta ${dataBR(quarta).slice(0, 5)}.`,
      acoes: [["Lançar agora", true, () => formComissao()], ["Não teve repasse", false, () => adiarLembrete("ttk-" + quarta, somaDiasISO(6, quarta), "Anotado: sem repasse nessa semana.")]] });
  }
  S.contratos.forEach((c) => {
    const nome = `<b>${esc(c.cliente)}</b>`;
    const sal = saldoDe(c), prev = previstaDe(c);
    const aberto = fechado(c) && c.status !== "Pago" && sal > 0;
    if (aberto && prev && prev < hoje) {
      const k = `vencido-${c.id}`;
      if (!adiado(k)) L.push({ aba: "financeiro", ic: "relogio", nivel: "alerta",
        texto: `${nome} venceu há ${plural(diasEntre(prev, hoje), "dia", "dias")} (${real(sal)}). A marca já pagou?`,
        acoes: [["Sim, recebi", true, () => formRecebi(c)], ["Ainda não, vou cobrar", false, () => adiarLembrete(k, somaDiasISO(2), "Combinado. Pergunto de novo em 3 dias.")], ["Abrir campanha", false, () => formContrato(c)]] });
      return;
    }
    if (aberto && prev && prev >= hoje && prev <= somaDiasISO(2)) {
      const k = `vence-${c.id}-${prev}`;
      if (!adiado(k)) L.push({ aba: "financeiro", ic: "calendario", nivel: "",
        texto: `${nome} deve pagar ${prev === hoje ? "hoje" : "até " + dataBR(prev).slice(0, 5)} (${real(sal)}). O dinheiro já caiu?`,
        acoes: [["Sim, recebi", true, () => formRecebi(c)], ["Ainda não", false, () => adiarLembrete(k, prev, "Certo. Se não cair até o prazo, eu aviso que venceu.")], ["Abrir campanha", false, () => formContrato(c)]] });
    }
    if (c.status === "Entregue" && !c.data_nf && sal > 0) {
      const k = `nota-${c.id}`;
      if (!adiado(k)) L.push({ aba: "financeiro", ic: "transcricao", nivel: "",
        texto: `${nome} foi entregue e está <b>sem nota fiscal</b>. Sem nota, o prazo de pagamento não começa a contar.`,
        acoes: [["Enviei a nota hoje", true, () => mudarEtapa(c, "Nota fiscal enviada")], ["Já foi paga", false, () => formRecebi(c)], ["Abrir campanha", false, () => formContrato(c)], ["Lembrar amanhã", false, () => adiarLembrete(k, hoje)]] });
    }
    if (grupoDe(c.status) === "producao" && c.prazo_entrega && c.prazo_entrega <= somaDiasISO(1)) {
      const k = `entrega-${c.id}-${c.prazo_entrega}`;
      const d = diasEntre(hoje, c.prazo_entrega);
      if (!adiado(k)) L.push({ aba: "campanhas", ic: "campanhas", nivel: d < 0 ? "alerta" : "",
        texto: `${nome}: ${d < 0 ? `a entrega está <b>atrasada há ${plural(-d, "dia", "dias")}</b>` : d === 0 ? "a entrega é <b>hoje</b>" : "a entrega é <b>amanhã</b>"} (${esc(c.status.toLowerCase())}).`,
        acoes: [["Já entreguei", true, () => mudarEtapa(c, "Entregue")], ["Abrir campanha", false, () => formContrato(c)], ["Lembrar amanhã", false, () => adiarLembrete(k, hoje)]] });
    }
    if (grupoDe(c.status) === "negociacao" && c.criado_em && diasEntre(String(c.criado_em).slice(0, 10), hoje) >= 5) {
      const k = `negocia-${c.id}`;
      if (!adiado(k)) L.push({ aba: "campanhas", ic: "marcas", nivel: "",
        texto: `${nome} está em negociação há ${plural(diasEntre(String(c.criado_em).slice(0, 10), hoje), "dia", "dias")}${n2(c.valor) ? ` (${real(c.valor)})` : ""}. Já fez follow-up?`,
        acoes: [["Fechou!", true, () => mudarEtapa(c, "Aguardando briefing")], ["Não fechou", false, () => mudarEtapa(c, "Perdida")], ["Abrir campanha", false, () => formContrato(c)], ["Lembrar em 3 dias", false, () => adiarLembrete(k, somaDiasISO(2))]] });
    }
  });
  // Agenda do calendário: o que é pra hoje e o que ficou pra trás (até 7 dias)
  S.calendario.filter((a) => !a.exemplo && a.status !== "feito" && a.data && String(a.data).slice(0, 10) <= hoje && String(a.data).slice(0, 10) >= somaDiasISO(-7))
    .forEach((a) => {
      const k = `cal-${a.id}`, data = String(a.data).slice(0, 10);
      if (adiado(k)) return;
      const oque = `<b>${a.hora ? horaCurta(a.hora) + " · " : ""}${esc((TIPOS_CAL.find((t) => t[0] === a.tipo) || [0, a.tipo])[1])}: ${esc(a.titulo)}</b>${a.marca ? ` (${esc(a.marca)})` : ""}`;
      L.push({ aba: "calendario", ic: "calendario", nivel: data < hoje ? "alerta" : "",
        texto: data === hoje ? `Na sua agenda de hoje: ${oque}.` : `Ficou pra trás no dia ${dataBR(data).slice(0, 5)}: ${oque}.`,
        acoes: [["Já fiz", true, async () => { if (await gravar("calendario", { status: "feito" }, a.id)) { avisar("Marcado como feito."); recarregar("calendario"); } }],
          ["Lembrar amanhã", false, () => adiarLembrete(k, hoje)]] });
    });
  // Meta do mês: a partir do dia 20, se ainda não bateu
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const meta = metaDe(ano, mes), feito = faturadoEm(ano, mes);
  if (meta > 0 && dia >= 20 && feito < meta && !adiado(`meta-${ano}-${mes}`)) {
    const sobra = new Date(ano, mes, 0).getDate() - dia;
    L.push({ aba: "financeiro", ic: "grafico", nivel: "",
      texto: `Faltam <b>${real(meta - feito)}</b> pra bater a meta de ${MESES_LONGOS[mes - 1].toLowerCase()} (${sobra ? plural(sobra, "dia", "dias") + " até o fim do mês" : "hoje é o último dia"}). Tem proposta parada que dá pra puxar?`,
      acoes: [["Ver propostas", true, () => irPara("propostas")], ["Lembrar semana que vem", false, () => adiarLembrete(`meta-${ano}-${mes}`, somaDiasISO(6))]] });
  }
  // Instagram parado: 7 dias ou mais sem post no feed
  const ultimoPost = typeof ig !== "undefined" && ig.dados && (ig.dados.posts || []).map((x) => isoLocal(new Date(x.data))).sort().pop();
  if (ultimoPost && diasEntre(ultimoPost, hoje) >= 7 && !adiado(`postar-${ultimoPost}`)) {
    L.push({ aba: "instagram", ic: "insta", nivel: "",
      texto: `Faz <b>${plural(diasEntre(ultimoPost, hoje), "dia", "dias")}</b> que você não posta no Instagram. Constância ajuda o alcance a voltar.`,
      acoes: [["Ver o que funciona", true, () => irPara("instagram")], ["Lembrar em 3 dias", false, () => adiarLembrete(`postar-${ultimoPost}`, somaDiasISO(2))]] });
  }
  return L;
}

// "Sim, recebi": lança o pagamento na parcela livre e marca Pago quando completa o valor
function formRecebi(c) {
  abrirForm({
    titulo: `Pagamento de ${c.cliente}`,
    valores: { valor: saldoDe(c), data: hojeISO() },
    campos: [
      { n: "valor", r: "Quanto caiu (R$)", t: "number" },
      { n: "data", r: "Dia que caiu", t: "date" }
    ],
    aoSalvar: async (d) => {
      if (!n2(d.valor)) { avisar("Coloque o valor que caiu.", true); return false; }
      const dados = {};
      if (c.parcela1 == null || !n2(c.parcela1)) { dados.parcela1 = n2(d.valor); dados.data_p1 = d.data || hojeISO(); }
      else if (c.parcela2 == null || !n2(c.parcela2)) { dados.parcela2 = n2(d.valor); dados.data_p2 = d.data || hojeISO(); }
      else { dados.parcela2 = n2(c.parcela2) + n2(d.valor); dados.data_p2 = d.data || hojeISO(); }
      const total = n2(dados.parcela1 ?? c.parcela1) + n2(dados.parcela2 ?? c.parcela2);
      if (total >= n2(c.valor)) dados.status = "Pago";
      else if (grupoDe(c.status) === "dinheiro") dados.status = "Aguardando pagamento";
      const ok = await gravar("contratos", dados, c.id);
      if (ok) { setTimeout(() => avisar(dados.status === "Pago" ? `${c.cliente} marcado como Pago.` : `Parcela lançada. Ainda faltam ${real(n2(c.valor) - total)}.`), 400); recarregar("contratos"); }
      return ok;
    }
  });
}

let lembretesAtuais = [];

/* ---------- "Já vi": o aviso some só depois que você olha ---------- */
function lerVistos(chave) { try { return JSON.parse(localStorage.getItem(chave) || "[]"); } catch (_) { return []; } }
function marcarVisto(chave, ...ids) {
  const atuais = new Set(lerVistos(chave));
  ids.forEach((id) => atuais.add(String(id)));
  try { localStorage.setItem(chave, JSON.stringify([...atuais].slice(-500))); } catch (_) {}
}
// Propostas de pessoas, não lidas no Gmail, que você ainda não viu no painel
function propostasNaoVistas() {
  if (typeof propostasVisiveis !== "function" || !gm.emails) return [];
  const vistos = new Set(lerVistos("propostas-vistas"));
  return propostasVisiveis().filter((x) => x.novo && !vistos.has(x.id));
}
// Post recente (últimos 4 dias) rendendo bem acima da média
function postEmDestaque() {
  if (typeof ig === "undefined" || !ig.dados) return null;
  const posts = (ig.dados.posts || []).filter((x) => n2(x.reach));
  if (posts.length < 5) return null;
  const vistos = new Set(lerVistos("ig-vistos"));
  const mediaAlcance = posts.reduce((s, x) => s + n2(x.reach), 0) / posts.length;
  const recente = posts.filter((x) => Date.now() - Date.parse(x.data) < 4 * 864e5 && !vistos.has(String(x.id)))
    .sort((a, b) => n2(b.reach) - n2(a.reach))[0];
  if (!recente || n2(recente.reach) < mediaAlcance * 1.8) return null;
  return { post: recente, vezes: n2(recente.reach) / mediaAlcance };
}

// Bolinha com número no menu: fica até você resolver ou abrir a aba
function pintarBolinhasMenu(L) {
  const conta = {};
  L.forEach((x) => { if (x.aba) conta[x.aba] = (conta[x.aba] || 0) + 1; });
  $$(".menu-item[data-aba]").forEach((b) => {
    let bola = $(".menu-bolinha", b);
    const n = conta[b.dataset.aba] || 0;
    if (!n) { if (bola) bola.remove(); return; }
    if (!bola) { bola = document.createElement("i"); bola.className = "menu-bolinha"; b.appendChild(bola); }
    bola.textContent = n > 9 ? "9+" : String(n);
    bola.setAttribute("aria-label", plural(n, "aviso", "avisos"));
  });
}
function pintarLembretes() {
  const caixa = $("#lembretes");
  if (!caixa) return;
  // Abrir a aba conta como "vi": as propostas e o destaque do Instagram saem da bolinha
  if (abaAtual === "propostas" && gm.emails && !gm.aberto) marcarVisto("propostas-vistas", ...propostasVisiveis().map((x) => x.id));
  if (abaAtual === "instagram" && ig.dados) { const d = postEmDestaque(); if (d) marcarVisto("ig-vistos", d.post.id); }
  const L = calcularLembretes();
  lembretesAtuais = L;
  pintarBolinhasMenu(L);
  // Número no ícone do app no iPhone
  try { if (navigator.setAppBadge) (L.length ? navigator.setAppBadge(L.length) : navigator.clearAppBadge()).catch(() => {}); } catch (_) {}
  const conta = $("#sino-conta");
  if (conta) { conta.hidden = !L.length; conta.textContent = L.length > 9 ? "9+" : String(L.length); }
  $("#abrir-lembretes").setAttribute("aria-label", L.length ? plural(L.length, "lembrete", "lembretes") : "Nenhum lembrete");
  const proximos = S.rapidos.filter((r) => !r.feito && Date.parse(r.quando) > Date.now());
  caixa.innerHTML = `<header><div><b>Lembretes</b><span class="sub">${L.length ? plural(L.length, "coisa precisa", "coisas precisam") + " de você" : "tudo em dia"}</span></div>
      <button type="button" class="btn pequeno primario" data-novo-rapido>${ic("mais")}Lembrete</button></header>
    ${L.length ? `<ul>${L.map((x, i) => `<li class="lembrete ${x.nivel}">
      <span class="insight-ic">${ic(x.ic)}</span>
      <p>${x.texto}</p>
      <div class="lembrete-acoes">${x.acoes.map(([r, p], j) => `<button type="button" class="btn pequeno ${p ? "primario" : ""}" data-lembrete="${i}" data-acao="${j}">${esc(r)}</button>`).join("")}</div>
    </li>`).join("")}</ul>` : `<p class="vazio">Nenhum lembrete agora. Tudo em dia!</p>`}
    ${proximos.length ? `<div class="proximos-rapidos"><span class="sub">Vou te lembrar</span>${proximos.slice(0, 8).map((r) => `<button type="button" class="item-dia" data-rapido-id="${esc(r.id)}">
      <span class="etq">${esc(quandoTexto(r.quando))}</span><span class="item-dia-texto"><b>${esc(r.texto)}</b></span></button>`).join("")}</div>` : ""}`;
  caixa.onclick = (e) => {
    if (e.target.closest("[data-novo-rapido]")) { fecharLembretes(); formLembreteRapido(); return; }
    const ed = e.target.closest("[data-rapido-id]");
    if (ed) { fecharLembretes(); formLembreteRapido(S.rapidos.find((r) => String(r.id) === ed.dataset.rapidoId)); return; }
    const b = e.target.closest("[data-lembrete]");
    if (!b) return;
    const l = lembretesAtuais[Number(b.dataset.lembrete)];
    fecharLembretes();
    if (l) l.acoes[Number(b.dataset.acao)][2]();
  };
}

/* ---------- Notificações no celular (app na tela de início) ---------- */
const temPush = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const ehIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const comoApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function registrarServiceWorker() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch((e) => console.warn("service worker", e));
}

function bytesDaChave(base64) {
  const b = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}

async function inscricaoAtual() {
  if (!temPush()) return null;
  try { const reg = await navigator.serviceWorker.getRegistration(); return reg ? await reg.pushManager.getSubscription() : null; } catch (_) { return null; }
}

async function ativarNotificacoes() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { avisar("Sem permissão, o celular não deixa mandar notificação.", true); return false; }
  const { data, error } = await db.functions.invoke("lembretes", { method: "GET" });
  if (error || !data || !data.chave_publica) { avisar("Não consegui falar com o ajudante de lembretes no Supabase.", true); return false; }
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("sw.js"));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytesDaChave(data.chave_publica) });
  const j = sub.toJSON();
  const aparelho = ehIPhone() ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Computador";
  const { error: e2 } = await db.from("push_inscricoes").upsert({ endpoint: j.endpoint, inscricao: j, aparelho }, { onConflict: "endpoint" });
  if (e2) { avisar(traduzErro(e2), true); return false; }
  return true;
}

async function desativarNotificacoes() {
  const sub = await inscricaoAtual();
  if (!sub) return;
  await db.from("push_inscricoes").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

async function mandarTeste() {
  const { data, error } = await db.functions.invoke("lembretes", { body: { acao: "teste" } });
  if (error || (data && data.erro)) { avisar((data && data.erro) || "O ajudante de lembretes não respondeu.", true); return; }
  if (!data.enviados) avisar(data.erros && data.erros.length ? "O envio falhou: " + data.erros[0] : "Nenhum aparelho com notificação ligada.", true);
  else avisar(`Notificação enviada para ${plural(data.enviados, "aparelho", "aparelhos")}. Ela chega em alguns segundos.`);
}

async function abrirNotificacoes() {
  let corpo, pe = "";
  const sub = await inscricaoAtual();
  if (ehIPhone() && !comoApp()) {
    corpo = `<p>No iPhone, as notificações só funcionam com o painel instalado como app. Leva 1 minuto:</p>
      <ol class="passos">
        <li>Abra este painel no <b>Safari</b>.</li>
        <li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).</li>
        <li>Toque em <b>Adicionar à Tela de Início</b> e depois em <b>Adicionar</b>.</li>
        <li>Abra o <b>Painel Ryan</b> pelo ícone novo, entre com o seu login e volte aqui em <b>Notificações no celular</b>.</li>
      </ol>`;
  } else if (!temPush()) {
    corpo = `<p>Este navegador não aceita notificações. No iPhone, instale o painel na tela de início pelo Safari (precisa do iOS 16.4 ou mais novo).</p>`;
  } else if (Notification.permission === "denied") {
    corpo = `<p>As notificações deste app estão bloqueadas. No iPhone, vá em <b>Ajustes</b>, depois <b>Notificações</b>, toque em <b>Painel Ryan</b> e ligue <b>Permitir Notificações</b>. Depois volte aqui.</p>`;
  } else if (sub && Notification.permission === "granted") {
    corpo = `<p><b>Notificações ligadas neste aparelho.</b></p>
      <ul class="passos"><li>Todo dia às 9h: um resumo do que está pendente (só quando tem algo). Na segunda, com o balanço da semana.</li><li>Toda quarta às 8h: lembrete do repasse do TikTok Shop, que cai de madrugada.</li><li>De 2 em 2 horas (8h às 22h): proposta nova no Gmail.</li></ul>
      <p class="sub">O número no ícone do app mostra quantos lembretes estão abertos.</p>`;
    pe = `<button type="button" class="btn perigo esq" data-desligar>Desligar neste aparelho</button><button type="button" class="btn primario" data-teste>Mandar notificação de teste</button>`;
  } else {
    corpo = `<p>Ligue as notificações para receber:</p>
      <ul class="passos"><li>Todo dia às 9h: um resumo do que está pendente (pagamento, nota, entrega, negociação parada, agenda do dia, meta do mês, Instagram parado). Na segunda, com o balanço da semana.</li><li>Toda quarta às 8h: lembrete do repasse do TikTok Shop, que cai de madrugada.</li><li>De 2 em 2 horas (8h às 22h): proposta nova no Gmail.</li></ul>`;
    pe = `<button type="button" class="btn primario" data-ligar>Ligar notificações</button>`;
  }
  const d = abrirJanelaSimples("Notificações no celular", corpo, pe);
  const b = (s) => $(s, d);
  if (b("[data-ligar]")) b("[data-ligar]").onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Ligando...";
    try { if (await ativarNotificacoes()) { d.close(); avisar("Notificações ligadas!"); setTimeout(abrirNotificacoes, 300); } }
    catch (erro) { avisar("Não deu para ligar: " + (erro.message || erro), true); }
    e.target.disabled = false; e.target.textContent = "Ligar notificações";
  };
  if (b("[data-teste]")) b("[data-teste]").onclick = async (e) => { e.target.disabled = true; await mandarTeste(); e.target.disabled = false; };
  if (b("[data-desligar]")) b("[data-desligar]").onclick = async () => { await desativarNotificacoes(); d.close(); avisar("Notificações desligadas neste aparelho."); };
}

/* =============================================================
   ABA INÍCIO
   O resumo do dia numa tela só: dinheiro do mês, o que tem para
   hoje (agenda e entregas), ideias em andamento, contatos novos e
   visitas do site. Os lembretes aparecem em cima, como em toda aba.
   ============================================================= */
const DIAS_SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function desenharInicio(el) {
  const agora = new Date();
  const hoje = hojeISO();
  const ano = agora.getFullYear(), mes = agora.getMonth() + 1;
  const h = agora.getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  // Dinheiro
  const fat = faturadoEm(ano, mes);
  const meta = metaDe(ano, mes);
  const aReceber = S.contratos.reduce((s, c) => s + saldoDe(c), 0);
  const vencido = S.contratos.filter((c) => situacaoDe(c) === "Vencido").reduce((s, c) => s + saldoDe(c), 0);

  // Produção
  const emProducao = S.contratos.filter((c) => grupoDe(c.status) === "producao");
  const entregasSemana = emProducao.filter((c) => c.prazo_entrega && c.prazo_entrega <= somaDiasISO(7));

  // Visitas do site
  const diaDe = (v) => isoLocal(new Date(v.data));
  const visitasHoje = S.visitas.filter((v) => diaDe(v) === hoje).length;
  const visitas7 = S.visitas.filter((v) => diaDe(v) > somaDiasISO(-7)).length;

  // Agenda: atrasados, hoje e próximos 7 dias
  const eventos = eventosCalendario().filter((e) => !e.feito);
  const atrasados = eventos.filter((e) => e.data < hoje && e.data >= somaDiasISO(-30));
  const deHoje = eventos.filter((e) => e.data === hoje);
  const proximos = eventos.filter((e) => e.data > hoje && e.data <= somaDiasISO(7)).sort((a, b) => a.data.localeCompare(b.data));
  const linhaEvento = (e, extra = "") => `<button type="button" class="item-dia" data-evento="${esc(e.origem)}:${esc(e.ref.id)}">
      <span class="pilula item-cal t-${esc(e.tipo)}" style="width:auto;margin:0">${e.hora ? horaCurta(e.hora) + " · " : ""}${esc(nomeTipo(e.tipo))}</span>
      <span class="item-dia-texto"><b>${esc(e.titulo || "")}</b>${e.marca || e.local ? `<small>${esc([e.marca, e.local].filter(Boolean).join(" · "))}</small>` : ""}</span>
      ${extra}
    </button>`;

  // Ideias em andamento e contatos novos
  const ideias = S.transcricoes.filter((t) => ["agora", "fazendo"].includes(etapaDe(t)))
    .sort((a, b) => (etapaDe(a) === "fazendo" ? 0 : 1) - (etapaDe(b) === "fazendo" ? 0 : 1)).slice(0, 5);
  // Quem entrou em contato pelo site (formulário ou mídia kit) nos últimos 30 dias
  const contatosRecentes = S.contatos_site.filter((c) => Date.now() - Date.parse(c.criado_em) < 30 * 864e5).slice(0, 5);

  const pctMeta = meta ? Math.min(100, pct(fat, meta)) : 0;
  el.innerHTML = `
    <div class="inicio-topo">
      <div><h2 class="saudacao">${saudacao}, Ryan</h2><p class="sub">${DIAS_SEMANA[agora.getDay()]}, ${agora.getDate()} de ${MESES_LONGOS[agora.getMonth()].toLowerCase()}</p></div>
      <div class="inicio-acoes">
        <button class="btn" type="button" data-rapido="lembrete">${ic("sino")}Lembrete</button>
        <button class="btn" type="button" data-rapido="ideia">${ic("mais")}Ideia</button>
        <button class="btn" type="button" data-rapido="ttk">${ic("mais")}Repasse TikTok</button>
      </div>
    </div>

    <div class="inicio-kpis">
      <button type="button" class="kpi-inicio" data-ir="financeiro">
        <span>Faturado em ${MESES_LONGOS[mes - 1].toLowerCase()}</span>
        <strong>${real(fat)}</strong>
        ${meta ? `<span class="meta-trilho mini ${fat >= meta ? "batida" : ""}"><i style="width:${pctMeta}%"></i></span><small>${pct(fat, meta)}% da meta de ${real(meta)}</small>` : `<small>sem meta definida</small>`}
      </button>
      <button type="button" class="kpi-inicio ${vencido ? "alerta" : ""}" data-ir="financeiro">
        <span>Para receber</span>
        <strong>${real(aReceber)}</strong>
        <small>${vencido ? `${real(vencido)} vencido` : "nada vencido"}</small>
      </button>
      <button type="button" class="kpi-inicio" data-ir="campanhas">
        <span>Em produção</span>
        <strong>${qtd(emProducao.length, "campanha", "campanhas")}</strong>
        <small>${entregasSemana.length ? `${qtd(entregasSemana.length, "entrega", "entregas")} nos próximos 7 dias` : "nenhuma entrega na semana"}</small>
      </button>
      <button type="button" class="kpi-inicio" data-ir="portfolio">
        <span>Visitas no site</span>
        <strong>${plural(visitasHoje, "hoje", "hoje")}</strong>
        <small>${plural(visitas7, "visita", "visitas")} nos últimos 7 dias</small>
      </button>
    </div>

    ${quadrosEntrada()}

    <div class="grade-inicio">
      <div class="cartao">
        <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Hoje</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="calendario">abrir calendário</button></div>
        ${atrasados.length || deHoje.length
          ? `<div class="lista-dia">${atrasados.map((e) => linhaEvento(e, `<span class="etq vermelha">${plural(diasEntre(e.data, hoje), "dia", "dias")} atrasado</span>`)).join("")}${deHoje.map((e) => linhaEvento(e)).join("")}</div>`
          : `<p class="vazio">Nada marcado para hoje.</p>`}
        <h2 class="sub-titulo">Próximos 7 dias</h2>
        ${proximos.length
          ? `<div class="lista-dia">${proximos.slice(0, 6).map((e) => linhaEvento(e, `<span class="sub">${DIAS_SEMANA[deISO(e.data).getDay()].slice(0, 3)} ${dataBR(e.data).slice(0, 5)}</span>`)).join("")}</div>${proximos.length > 6 ? `<p class="sub">e mais ${proximos.length - 6} no calendário</p>` : ""}`
          : `<p class="vazio">Semana livre por enquanto.</p>`}
      </div>
      <div class="coluna-inicio">
        <div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Ideias em andamento</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="transcricoes">ver todas</button></div>
          ${ideias.length
            ? `<div class="lista-dia">${ideias.map((t) => `<button type="button" class="item-dia" data-ideia="${esc(t.id)}">
                <span class="pilula ${etapaDe(t) === "fazendo" ? "p-conversando" : "p-pendente"}">${etapaDe(t) === "fazendo" ? "Fazendo" : "Fazer agora"}</span>
                <span class="item-dia-texto"><b>${esc(t.titulo || "Ideia sem título")}</b><small>${esc(nomeCategoria(t.categoria))}</small></span>
              </button>`).join("")}</div>`
            : `<p class="vazio">Nenhuma ideia em "Fazer agora" ou "Fazendo".</p>`}
        </div>
        <div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Clientes que entraram em contato</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="portfolio">ver todos</button></div>
          ${contatosRecentes.length
            ? `<div class="lista-dia">${contatosRecentes.map((c) => `<button type="button" class="item-dia" data-ir="portfolio">
                <span class="pilula ${c.visto ? "p-conversando" : "p-pendente"}">${c.visto ? (c.tipo === "midia_kit" ? "Mídia kit" : "Formulário") : "Novo"}</span>
                <span class="item-dia-texto"><b>${esc(c.marca || c.nome)}</b><small>${esc(c.marca ? c.nome : c.email)} · ${dataBR(String(c.criado_em).slice(0, 10)).slice(0, 5)}</small></span>
              </button>`).join("")}</div>`
            : `<p class="vazio">Ninguém entrou em contato pelo site nos últimos 30 dias.</p>`}
        </div>
      </div>
    </div>`;

  // Busca o Instagram em segundo plano (uma vez) para o quadro do Início
  if (ig.conectado === null && !ig.carregando) carregarInstagram();
  const conectarGm = $("#inicio-conectar-gmail", el);
  if (conectarGm) conectarGm.onclick = async () => { try { await conectarGmail(); lerPropostas(); } catch (erro) { avisar(erro.message, true); } };
  el.onclick = (e) => {
    const abrirEmail = e.target.closest("[data-inicio-email]");
    if (abrirEmail) { const x = (gm.emails || []).find((m) => m.id === abrirEmail.dataset.inicioEmail); irPara("propostas"); if (x) abrirConversa(x); return; }
    const ir = e.target.closest("[data-ir]");
    if (ir) { irPara(ir.dataset.ir); return; }
    const ev = e.target.closest("[data-evento]");
    if (ev) {
      const [origem, id] = ev.dataset.evento.split(":");
      if (origem === "campanha") formContrato(S.contratos.find((c) => String(c.id) === id));
      else formCalendario(S.calendario.find((c) => String(c.id) === id));
      return;
    }
    const ideia = e.target.closest("[data-ideia]");
    if (ideia) { trans.sel = ideia.dataset.ideia; irPara("transcricoes"); return; }
    const r = e.target.closest("[data-rapido]");
    if (!r) return;
    if (r.dataset.rapido === "lembrete") formLembreteRapido();
    else if (r.dataset.rapido === "contrato") formContrato();
    else if (r.dataset.rapido === "ttk") formComissao();
    else { irPara("transcricoes"); setTimeout(() => { const i = $("#form-add-trans input, #form-add-trans textarea"); if (i) i.focus(); }, 100); }
  };
}

/* ---------- Mostrar e esconder o menu lateral ---------- */
function ligarMenuRetratil() {
  const raiz = document.documentElement;
  try { if (localStorage.getItem("menu-oculto") === "1") raiz.classList.add("menu-oculto"); } catch (_) {}
  $("#alternar-menu").addEventListener("click", () => {
    // No celular abre a gaveta; no computador recolhe ou mostra o menu
    if (matchMedia("(max-width: 860px)").matches) { $("#abrir-menu").click(); return; }
    const oculto = raiz.classList.toggle("menu-oculto");
    try { localStorage.setItem("menu-oculto", oculto ? "1" : "0"); } catch (_) {}
  });
  // No celular, a barra de cima some ao rolar para baixo e volta ao rolar para cima
  let ultimo = window.scrollY;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (Math.abs(y - ultimo) < 8) return;
    raiz.classList.toggle("topo-escondido", y > ultimo && y > 60);
    ultimo = y;
  }, { passive: true });
}

/* ---------- Sino dos lembretes e botão de esconder valores ---------- */
function fecharLembretes() {
  const p = $("#lembretes");
  if (!p || p.hidden) return;
  p.hidden = true;
  $("#abrir-lembretes").setAttribute("aria-expanded", "false");
}

function ligarCabecalho() {
  const botao = $("#abrir-lembretes"), painel = $("#lembretes");
  botao.addEventListener("click", (e) => {
    e.stopPropagation();
    painel.hidden = !painel.hidden;
    botao.setAttribute("aria-expanded", String(!painel.hidden));
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sino-caixa")) fecharLembretes(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharLembretes(); });

  const olho = $("#modo-privado");
  const pintarOlho = () => {
    document.documentElement.classList.toggle("privado", privado);
    olho.setAttribute("aria-pressed", String(privado));
    olho.setAttribute("aria-label", privado ? "Mostrar valores" : "Esconder valores");
    olho.title = privado ? "Mostrar valores" : "Esconder valores";
    $("use", olho).setAttribute("href", privado ? "#i-olho-fechado" : "#i-olho");
  };
  pintarOlho();
  olho.addEventListener("click", () => {
    privado = !privado;
    try { localStorage.setItem("modo-privado", privado ? "1" : "0"); } catch (_) {}
    pintarOlho();
    desenhar();
    avisar(privado ? "Valores escondidos. Pode mostrar o painel tranquilo." : "Valores visíveis de novo.");
  });
}

/* =============================================================
   ABA PROPOSTAS (Gmail)
   Lê o Gmail de propostas (heyryan.ugc@gmail.com), separa os
   e-mails com cara de proposta e esconde os automáticos e em massa
   (plataformas, bancos, newsletters, "no-reply"). Dá para abrir a
   conversa e responder daqui mesmo.
   O login é feito pelo Google numa janela própria: a senha nunca
   passa pelo painel. O ID abaixo é público (não é segredo).
   O acesso vale por cerca de 1 hora; depois é só conectar de novo.
   ============================================================= */
const GOOGLE_CLIENT_ID = "317757639743-datc7u3k3d7hauj06q6viqefstliqkle.apps.googleusercontent.com";
const EMAIL_PROPOSTAS = "heyryan.ugc@gmail.com";
// Gmail (ler e responder) + Google Agenda (só os calendários criados pelo painel, como o "Trabalhos")
const ESCOPOS_GMAIL = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar.app.created";
const temAgendaGoogle = () => gm.escopo.includes("calendar");
const PALAVRAS_PROPOSTA = ["ugc", "\"user generated\"", "proposta", "parceria", "publi", "publicidade", "publipost", "campanha", "collab", "collaboration", "briefing", "orçamento", "orcamento", "\"mídia kit\"", "\"media kit\"", "midiakit", "influenciador", "influencer", "creator", "\"criador de conteúdo\"", "permuta", "cachê", "cache", "job", "contratar", "freela"];
// Lê a caixa de entrada E a de spam (às vezes o e-mail da marca cai lá)
const BUSCA_PROPOSTAS = `{in:inbox in:spam} newer_than:90d -category:promotions -category:social -category:forums -category:updates (${PALAVRAS_PROPOSTA.join(" OR ")})`;
const DOMINIOS_PESSOAIS = ["gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "bol", "uol", "terra", "me"];
// Remetentes que são robôs ou envio em massa (o começo do e-mail, antes do @)
const REMETENTE_ROBO = /^(no-?reply|nao-?responda|naoresponda|donotreply|do-?not-?reply|notifica|notification|news|newsletter|marketing|mkt|comunicad|todomundo|support|suporte|faleconosco|fale-conosco|atendimento|info|noticias|alert|update|mailer|bounce|hello|team|time|equipe|contato-?noreply|campanhas|digest|community|comunidade|creators?|parcerias-?noreply|plataforma)/i;
const gm = { token: null, expira: 0, escopo: "", carregando: false, emails: null, erro: "", busca: "", verAutomaticos: false, aberto: null, conversa: null, carregandoConversa: false };
let propostasNovas = 0;

try {
  const t = JSON.parse(sessionStorage.getItem("gmail-token") || "null");
  if (t && t.expira > Date.now()) { gm.token = t.token; gm.expira = t.expira; gm.escopo = t.escopo || ""; }
} catch (_) {}
const gmailConectado = () => !!gm.token && gm.expira > Date.now() + 30000;
const podeResponder = () => gm.escopo.includes("gmail.send");

function carregarGoogle() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((ok, falhou) => {
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.async = true;
    sc.onload = () => ok();
    sc.onerror = () => falhou(new Error("Não consegui carregar o login do Google. Confira a internet."));
    document.head.appendChild(sc);
  });
}

// Conexão permanente: o Ryan autoriza uma vez e o ajudante "gmail" do
// Supabase guarda a autorização e entrega um acesso novo sempre que precisar.
async function chamarGmail(corpo) {
  const { data, error } = await db.functions.invoke("gmail", { body: corpo });
  if (error) throw new Error(error.context && error.context.status === 404 ? "O ajudante do Gmail ainda não foi publicado no Supabase." : "O ajudante do Gmail não respondeu.");
  return data || {};
}
function guardarAcesso(r) {
  gm.token = r.access_token;
  gm.expira = Date.now() + (Number(r.expires_in) || 3600) * 1000;
  gm.escopo = r.scope || ESCOPOS_GMAIL;
  try { sessionStorage.setItem("gmail-token", JSON.stringify({ token: gm.token, expira: gm.expira, escopo: gm.escopo })); } catch (_) {}
  // Renova sozinho 5 minutos antes de vencer
  clearTimeout(gm.renovar);
  gm.renovar = setTimeout(() => sincronizarGmail(), Math.max(60000, gm.expira - Date.now() - 300000));
}
// Chamado ao abrir o painel e antes de vencer: busca um acesso novo sem pedir nada ao Ryan
async function sincronizarGmail() {
  try {
    const r = await chamarGmail({ acao: "token" });
    if (r.access_token) { gm.permanente = true; guardarAcesso(r); await lerPropostas(); return true; }
    gm.permanente = false;
    if (r.erro) gm.erro = r.erro;
  } catch (e) { gm.erro = e.message; }
  if (["inicio", "propostas"].includes(abaAtual)) desenhar();
  return false;
}

// Primeira conexão (uma vez só): abre o Google numa janelinha e pede a autorização permanente
function conectarGmail() {
  return new Promise((ok, falhou) => {
    const volta = new URL("oauth.html", location.href); volta.search = ""; volta.hash = "";
    const estado = Math.random().toString(36).slice(2);
    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID, redirect_uri: volta.href, response_type: "code", scope: ESCOPOS_GMAIL,
      access_type: "offline", prompt: "consent", include_granted_scopes: "true", login_hint: EMAIL_PROPOSTAS, state: estado
    });
    const janelaGoogle = window.open(url, "gmail-conectar", "width=520,height=680");
    if (!janelaGoogle) { falhou(new Error("O navegador bloqueou a janela do Google. Libere pop-ups para este site e tente de novo.")); return; }
    const ouvir = async (e) => {
      if (e.origin !== location.origin || !e.data || e.data.tipo !== "gmail-code") return;
      window.removeEventListener("message", ouvir);
      if (e.data.erro || !e.data.code || e.data.state !== estado) { falhou(new Error(e.data.erro === "access_denied" ? "Você cancelou a autorização no Google." : "O Google não completou a conexão. Tente de novo.")); return; }
      try {
        const r = await chamarGmail({ acao: "conectar", code: e.data.code, redirect_uri: volta.href });
        if (!r.access_token) throw new Error(r.erro || "Não deu para conectar.");
        gm.permanente = true; gm.erro = "";
        guardarAcesso(r);
        ok();
      } catch (erro) { falhou(erro); }
    };
    window.addEventListener("message", ouvir);
  });
}

async function desconectarGmail() {
  try { await chamarGmail({ acao: "desconectar" }); } catch (_) {}
  clearTimeout(gm.renovar);
  Object.assign(gm, { token: null, expira: 0, escopo: "", emails: null, aberto: null, conversa: null, permanente: false });
  propostasNovas = 0;
  try { sessionStorage.removeItem("gmail-token"); } catch (_) {}
}

async function gmailApi(caminho, opcoes = {}) {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + caminho, {
    method: opcoes.metodo || "GET",
    headers: { Authorization: "Bearer " + gm.token, ...(opcoes.corpo ? { "Content-Type": "application/json" } : {}) },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined
  });
  if (r.status === 401) {
    if (!opcoes.repetiu && await sincronizarGmail()) return gmailApi(caminho, { ...opcoes, repetiu: true });
    throw new Error("O acesso ao Gmail expirou e não deu para renovar sozinho. Recarregue a página.");
  }
  if (r.status === 403) throw new Error("O Google não deu permissão para isso. Clique em Desconectar e conecte de novo, aceitando todas as permissões.");
  if (!r.ok) throw new Error("O Gmail respondeu com erro " + r.status + ".");
  return r.json();
}

// Quem mandou: nome, e-mail e um palpite do nome da marca (pelo domínio do e-mail)
function lerRemetente(de) {
  const m = String(de || "").match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  const nome = m ? m[1].trim() : "";
  const email = (m ? m[2] : de || "").trim().toLowerCase();
  const dominioCompleto = email.split("@")[1] || "";
  const dominio = dominioCompleto.split(".")[0];
  const pessoal = DOMINIOS_PESSOAIS.includes(dominio);
  const marca = dominio && !pessoal ? dominio.charAt(0).toUpperCase() + dominio.slice(1) : (nome || email);
  return { nome: nome || email, email, marca, dominio: pessoal ? "" : dominioCompleto };
}
// O Gmail manda o trecho com códigos HTML (&#39; &amp;): volta para texto normal
const semEntidades = (t) => new DOMParser().parseFromString(String(t), "text/html").documentElement.textContent || "";
const cabecalho = (m, n) => (((m.payload && m.payload.headers) || []).find((x) => x.name.toLowerCase() === n.toLowerCase()) || {}).value || "";

// E-mail automático ou em massa? Devolve o motivo (ou "" se parece escrito por uma pessoa)
// Assunto típico de aviso automático, chamado de suporte ou newsletter
const ASSUNTO_ROBO = /\[#?\d{3,}\]|novo dispositivo|fez login|c[oó]digo de (verifica|acesso|seguran)|verify|verifica[cç][aã]o|redefinir senha|password|fatura|boleto|pix|pagamento (recebido|aprovado|confirmado)|recibo|seu pedido|pedido #|inscri[cç][oõ]es abertas|newsletter|webinar|edi[cç][aã]o #?\d|#\d{2,}\b|grupo do whatsapp/i;

function motivoAutomatico(m, de) {
  if (cabecalho(m, "List-Unsubscribe") || cabecalho(m, "List-Id")) return "envio em massa";
  if (cabecalho(m, "Feedback-ID") || cabecalho(m, "X-Feedback-Id") || cabecalho(m, "X-SES-Outgoing") || cabecalho(m, "X-Mailer")) return "ferramenta de envio em massa";
  if (/^yes/i.test(cabecalho(m, "X-Spam-Flag")) || /^yes/i.test(cabecalho(m, "X-Spam-Status"))) return "marcado como spam";
  if (/bulk|list|junk/i.test(cabecalho(m, "Precedence"))) return "envio em massa";
  const auto = cabecalho(m, "Auto-Submitted");
  if (auto && !/^no$/i.test(auto)) return "automático";
  if (REMETENTE_ROBO.test(de.email.split("@")[0])) return "remetente automático";
  if (/^(updates?|mail|email|news|mkt|marketing|send|info|noreply|notify|notifica[cç]oes?)\./i.test(de.email.split("@")[1] || "")) return "remetente automático";
  // Mandado em cópia oculta para muita gente: o seu e-mail não aparece no "Para" nem no "Cc"
  const destino = (cabecalho(m, "To") + " " + cabecalho(m, "Cc")).toLowerCase();
  if (destino.trim() && !destino.includes(EMAIL_PROPOSTAS)) return "enviado em massa (cópia oculta)";
  if (ASSUNTO_ROBO.test(cabecalho(m, "Subject"))) return "aviso automático";
  if (de.dominio && adiado("dominio-" + de.dominio)) return "você escondeu esse remetente";
  return "";
}

async function lerPropostas() {
  if (!gmailConectado() || gm.carregando) return;
  gm.carregando = true; gm.erro = "";
  if (abaAtual === "propostas") desenhar();
  try {
    const q = BUSCA_PROPOSTAS + (gm.busca ? " " + gm.busca : "");
    const lista = await gmailApi("messages?maxResults=60&includeSpamTrash=true&q=" + encodeURIComponent(q));
    const ids = (lista.messages || []).map((x) => x.id);
    const campos = ["From", "To", "Cc", "Subject", "Date", "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted", "Feedback-ID", "X-Feedback-Id", "X-SES-Outgoing", "X-Mailer", "X-Spam-Flag", "X-Spam-Status"].map((h) => "&metadataHeaders=" + h).join("");
    const msgs = await Promise.all(ids.map((id) => gmailApi(`messages/${id}?format=metadata${campos}`).catch(() => null)));
    gm.emails = msgs.filter(Boolean).map((m) => {
      const de = lerRemetente(cabecalho(m, "From"));
      return { id: m.id, thread: m.threadId, de, assunto: cabecalho(m, "Subject") || "(sem assunto)", trecho: semEntidades(m.snippet || ""),
        data: new Date(Number(m.internalDate) || Date.parse(cabecalho(m, "Date")) || Date.now()),
        spam: (m.labelIds || []).includes("SPAM"),
        novo: (m.labelIds || []).includes("UNREAD") && !adiado("lido-" + m.id), automatico: motivoAutomatico(m, de),
        importante: /proposta|or[cç]amento|briefing|contrato|campanha|parceria|pagamento|valor|cach[eê]|budget|rate|paid|collab/i.test(cabecalho(m, "Subject") + " " + (m.snippet || "")) };
    }).filter((x) => x.de.email !== EMAIL_PROPOSTAS)
      // Uma conversa vira um cartão só (o e-mail mais recente dela)
      .filter((x, i, todos) => todos.findIndex((y) => y.thread === x.thread) === i);
  } catch (e) {
    gm.erro = e.message || String(e);
  }
  gm.carregando = false;
  propostasNovas = propostasVisiveis().filter((x) => x.novo).length;
  desenhar();
}

const propostasVisiveis = () => (gm.emails || []).filter((x) => !x.automatico && !adiado("email-" + x.id));
const marcarEmailTratado = (id, aviso) => adiarLembrete("email-" + id, "2999-12-31", aviso);

/* ---------- Conversa aberta e resposta ---------- */
function decodificar(b64) {
  try {
    const bin = atob(String(b64 || "").replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch (_) { return ""; }
}
// Pega o texto da mensagem (prefere o texto simples; se só tiver HTML, tira as tags)
function textoDaMensagem(parte) {
  if (!parte) return "";
  if (parte.mimeType === "text/plain" && parte.body && parte.body.data) return decodificar(parte.body.data);
  for (const p of parte.parts || []) { const t = textoDaMensagem(p); if (t) return t; }
  if (parte.mimeType === "text/html" && parte.body && parte.body.data) {
    const doc = new DOMParser().parseFromString(decodificar(parte.body.data), "text/html");
    $$("style, script", doc).forEach((x) => x.remove());
    $$("br, p, div, li, tr", doc).forEach((x) => x.append("\n"));
    return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  return "";
}
// Esconde o histórico citado ("Em ... escreveu:") para a conversa ficar limpa
function semCitacao(t) {
  const corte = t.search(/\n(On .+wrote:|Em .+escreveu:|-{2,}\s*Mensagem original|De: .+\nEnviada)/i);
  return (corte > 0 ? t.slice(0, corte) : t).replace(/\n>.*$/gm, "").trim();
}

// O painel só lê o Gmail (não muda nada lá), então guarda no banco o que você já abriu aqui.
// Assim o e-mail deixa de aparecer como não lido no celular e no computador.
function marcarLidoNoPainel(email) {
  if (!email.novo) return;
  email.novo = false;
  const chave = "lido-" + email.id, ate = "2999-12-31";
  S.adiados = S.adiados.filter((a) => a.chave !== chave).concat({ chave, ate });
  propostasNovas = propostasVisiveis().filter((x) => x.novo).length;
  db.from("lembretes_adiados").upsert({ chave, ate }, { onConflict: "chave" }).then(({ error }) => { if (error) console.warn("lido", error); });
}

async function abrirConversa(email) {
  marcarLidoNoPainel(email);
  gm.aberto = email; gm.conversa = null; gm.carregandoConversa = true; gm.idioma = "pt"; gm.rascunho = ""; gm.rascunhoPt = "";
  desenhar();
  try {
    const th = await gmailApi(`threads/${email.thread}?format=full`);
    gm.conversa = (th.messages || []).map((m) => ({
      id: m.id, de: lerRemetente(cabecalho(m, "From")), para: cabecalho(m, "To"), responderPara: cabecalho(m, "Reply-To"),
      data: new Date(Number(m.internalDate) || Date.now()), assunto: cabecalho(m, "Subject"),
      messageId: cabecalho(m, "Message-ID") || cabecalho(m, "Message-Id"), referencias: cabecalho(m, "References"),
      texto: semCitacao(textoDaMensagem(m.payload) || m.snippet || "")
    }));
    // Em que idioma a marca escreve? (para traduzir a conversa e a resposta)
    const daMarca = [...gm.conversa].reverse().find((m) => m.de.email !== EMAIL_PROPOSTAS);
    gm.idioma = daMarca ? String(await detectarIdioma(daMarca.texto) || "pt").slice(0, 2) : "pt";
  } catch (e) { gm.erro = e.message; gm.aberto = null; }
  gm.carregandoConversa = false;
  desenhar();
}

const base64Utf8 = (t) => { const b = new TextEncoder().encode(t); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const base64Url = (t) => base64Utf8(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const assuntoMime = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : `=?UTF-8?B?${base64Utf8(t)}?=`);

async function enviarResposta(texto) {
  const msgs = gm.conversa || [];
  const alvo = [...msgs].reverse().find((m) => m.de.email !== EMAIL_PROPOSTAS) || msgs[msgs.length - 1];
  if (!alvo) throw new Error("Não achei para quem responder.");
  const para = alvo.responderPara || (alvo.de.nome && alvo.de.nome !== alvo.de.email ? `${alvo.de.nome} <${alvo.de.email}>` : alvo.de.email);
  const assunto = /^re:/i.test(alvo.assunto || gm.aberto.assunto) ? (alvo.assunto || gm.aberto.assunto) : "Re: " + (alvo.assunto || gm.aberto.assunto);
  const corpo = base64Utf8(texto).replace(/(.{76})/g, "$1\r\n");
  const linhas = [`To: ${para}`, `Subject: ${assuntoMime(assunto)}`];
  if (alvo.messageId) linhas.push(`In-Reply-To: ${alvo.messageId}`, `References: ${[alvo.referencias, alvo.messageId].filter(Boolean).join(" ")}`);
  linhas.push("MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", corpo);
  const mensagem = linhas.join("\r\n");
  await gmailApi("messages/send", { metodo: "POST", corpo: { raw: base64Url(mensagem), threadId: gm.aberto.thread } });
}

// Modelos de resposta rápida (dá para editar antes de mandar)
function modelosResposta(email) {
  const marca = email.de.marca;
  const site = "https://ryalvz.github.io/portfoliougc/";
  return [
    ["Pedir briefing", `Oi, tudo bem?\n\nObrigado pelo contato! Fiquei muito feliz com o interesse da ${marca}.\n\nPara eu montar uma proposta certinha, você consegue me mandar:\n- o briefing ou a ideia da campanha\n- quantos vídeos e em quais formatos\n- se é para uso orgânico ou anúncio (e por quanto tempo)\n- o prazo de entrega\n\nMeu portfólio está aqui: ${site}\n\nUm abraço,\nRyan Alves`],
    ["Mandar portfólio e valores", `Oi, tudo bem?\n\nObrigado por pensar em mim para essa campanha!\n\nSegue meu portfólio com os trabalhos mais recentes: ${site}\n\nMeus pacotes começam a partir de R$ ___ por vídeo, e o valor final depende da quantidade, do formato e do direito de uso. Se você me passar esses detalhes, eu mando a proposta fechada ainda hoje.\n\nUm abraço,\nRyan Alves`],
    ["Recusar com educação", `Oi, tudo bem?\n\nMuito obrigado pelo convite e pela confiança! Neste momento não vou conseguir participar dessa campanha, mas adoraria trabalhar com a ${marca} em uma próxima oportunidade.\n\nUm abraço,\nRyan Alves`]
  ];
}

function desenharConversa(el) {
  const x = gm.aberto;
  el.innerHTML = `
    <div class="barra">
      <button class="btn" type="button" id="voltar-propostas">${ic("esq")}Voltar às propostas</button>
      <span class="espaco"></span>
      <button type="button" class="btn" data-acao-email="contrato">Virar contrato</button>
      <button type="button" class="btn" data-acao-email="marca">Salvar marca</button>
    </div>
    <div class="cartao conversa">
      <h2 class="conversa-assunto">${esc(x.assunto)}</h2>
      ${gm.carregandoConversa ? `<p class="vazio">Abrindo a conversa...</p>` : (gm.conversa || []).map((m) => `<div class="msg ${m.de.email === EMAIL_PROPOSTAS ? "minha" : ""}">
        <div class="email-topo"><b>${m.de.email === EMAIL_PROPOSTAS ? "Você" : esc(m.de.nome)}</b><span class="sub">${esc(m.de.email)}</span><span class="espaco"></span><span class="sub">${m.data.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
        <div class="msg-texto">${esc(m.verTraducao && m.traducao ? m.traducao : m.texto)}</div>
        ${m.de.email !== EMAIL_PROPOSTAS && gm.idioma && gm.idioma !== "pt" ? `<button type="button" class="link-btn pequeno-link" data-traduzir-msg="${esc(m.id)}">${m.verTraducao ? "ver o original" : "ver em português"}</button>` : ""}
      </div>`).join("")}
    </div>
    ${gm.carregandoConversa ? "" : `<div class="cartao responder">
      <div class="barra" style="margin-bottom:8px"><h2 style="margin:0">Responder ${esc(x.de.nome)}</h2><span class="espaco"></span>
        <span class="chips">${modelosResposta(x).map(([n], i) => `<button type="button" class="chip" data-modelo="${i}">${esc(n)}</button>`).join("")}</span></div>
      ${podeResponder() ? "" : `<div class="aviso-falta">Para responder daqui, o Google precisa da sua permissão de envio. Clique em <b>Liberar respostas</b> e aceite no Google.</div>`}
      <textarea class="campo" id="texto-resposta" rows="9" placeholder="Escreva a sua resposta em português ou escolha um modelo acima.">${esc(gm.rascunho || "")}</textarea>
      <div class="barra traduzir-barra">
        <span class="sub">Traduzir a resposta para</span>
        <select class="campo" id="idioma-resposta" aria-label="Idioma da resposta">${[["en", "inglês"], ["es", "espanhol"], ["fr", "francês"], ["it", "italiano"], ["de", "alemão"]].map(([v, n]) => `<option value="${v}" ${v === (gm.idioma && gm.idioma !== "pt" ? gm.idioma : "en") ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button class="btn" type="button" id="traduzir-resposta">${ic("traduzir")}Traduzir</button>
        ${gm.rascunhoPt ? `<button type="button" class="link-btn pequeno-link" id="voltar-pt">voltar ao português</button>` : ""}
        <span class="sub" id="status-traducao">${gm.idioma && gm.idioma !== "pt" ? `a marca escreve em ${esc(NOME_IDIOMA[gm.idioma] || gm.idioma)}` : ""}</span>
      </div>
      <div class="barra" style="margin:8px 0 0">
        <span class="sub">vai de ${esc(EMAIL_PROPOSTAS)}, dentro da mesma conversa no Gmail</span>
        <span class="espaco"></span>
        ${podeResponder() ? `<button class="btn primario" type="button" id="enviar-resposta">${ic("email")}Enviar resposta</button>` : `<button class="btn primario" type="button" id="liberar-respostas">Liberar respostas</button>`}
      </div>
    </div>`}`;

  $("#voltar-propostas").onclick = () => { gm.aberto = null; gm.conversa = null; desenhar(); };
  const caixa = $("#texto-resposta");
  if (caixa) caixa.addEventListener("input", () => { gm.rascunho = caixa.value; });
  $$("[data-modelo]", el).forEach((b) => b.onclick = () => { gm.rascunhoPt = ""; gm.rascunho = modelosResposta(x)[Number(b.dataset.modelo)][1]; desenhar(); $("#texto-resposta").focus(); });
  $$("[data-traduzir-msg]", el).forEach((b) => b.onclick = async () => {
    const m = gm.conversa.find((y) => y.id === b.dataset.traduzirMsg);
    if (m.traducao) { m.verTraducao = !m.verTraducao; desenhar(); return; }
    b.textContent = "traduzindo...";
    try {
      const pt = await traduzir(m.texto, gm.idioma, "pt", (t) => { b.textContent = t; });
      if (!pt) { window.open(linkGoogleTradutor(m.texto, gm.idioma, "pt"), "_blank", "noopener"); b.textContent = "ver em português"; return; }
      m.traducao = pt.trim(); m.verTraducao = true; desenhar();
    } catch (_) { window.open(linkGoogleTradutor(m.texto, gm.idioma, "pt"), "_blank", "noopener"); b.textContent = "ver em português"; }
  });
  const btnTraduzir = $("#traduzir-resposta");
  if (btnTraduzir) btnTraduzir.onclick = async () => {
    const texto = caixa.value.trim();
    if (!texto) { avisar("Escreva a resposta em português primeiro.", true); return; }
    const destino = $("#idioma-resposta").value;
    const status = (t) => { const st = $("#status-traducao"); if (st) st.textContent = t; };
    btnTraduzir.disabled = true; status("Traduzindo...");
    try {
      const traduzido = await traduzir(texto, "pt", destino, status);
      if (!traduzido) throw new Error("sem tradutor");
      gm.rascunhoPt = texto; gm.rascunho = traduzido.trim();
      desenhar(); avisar("Traduzido! Confira o texto antes de enviar.");
    } catch (_) {
      btnTraduzir.disabled = false; status("");
      const d = abrirJanelaSimples("Traduzir a resposta",
        `<p>O tradutor que vem no Chrome não respondeu. Dá para traduzir pelo Google Tradutor:</p>
         <ol class="passos"><li>Clique em <b>Abrir o Google Tradutor</b>.</li><li>Copie o texto traduzido.</li><li>Volte aqui, apague a resposta e cole o texto traduzido.</li></ol>`,
        `<a class="btn primario" href="${linkGoogleTradutor(texto, "pt", destino)}" target="_blank" rel="noopener">Abrir o Google Tradutor</a>`);
      $("a", d).addEventListener("click", () => d.close());
    }
  };
  const voltarPt = $("#voltar-pt");
  if (voltarPt) voltarPt.onclick = () => { gm.rascunho = gm.rascunhoPt; gm.rascunhoPt = ""; desenhar(); };
  const liberar = $("#liberar-respostas");
  if (liberar) liberar.onclick = async () => {
    try { await conectarGmail(); desenhar(); } catch (e) { avisar(e.message, true); }
  };
  const enviar = $("#enviar-resposta");
  if (enviar) enviar.onclick = async () => {
    const texto = $("#texto-resposta").value.trim();
    if (!texto) { avisar("Escreva a resposta antes de enviar.", true); return; }
    if (texto.includes("R$ ___")) { avisar("Troque o R$ ___ pelo seu valor antes de enviar.", true); return; }
    if (!(await confirmar(`Enviar esta resposta para ${x.de.email}?`, "Sim, enviar"))) return;
    enviar.disabled = true; enviar.textContent = "Enviando...";
    try { await enviarResposta(texto); gm.rascunho = ""; gm.rascunhoPt = ""; avisar("Resposta enviada!"); await abrirConversa(x); }
    catch (e) { avisar("Não deu para enviar: " + e.message, true); enviar.disabled = false; enviar.textContent = "Enviar resposta"; }
  };
}

function acaoEmail(tipo, x) {
  const quando = x.data.toLocaleDateString("pt-BR");
  if (tipo === "ignorar") marcarEmailTratado(x.id, "Tirei da lista de propostas.");
  else if (tipo === "esconder-remetente") adiarLembrete("dominio-" + x.de.dominio, "2999-12-31", `Não mostro mais e-mails de ${x.de.dominio}.`).then(() => lerPropostas());
  else if (tipo === "marca") formMarca(null, {
    valores: { nome: x.de.marca, email: x.de.email, obs: `Chegou por e-mail em ${quando}: "${x.assunto}"` },
    depois: () => marcarEmailTratado(x.id, "Marca salva como lead. O e-mail saiu da lista.")
  });
  else if (tipo === "contrato") formContrato(null, {
    valores: { cliente: x.de.marca, descricao: x.assunto.slice(0, 120), status: "Em negociação", obs: `Proposta por e-mail de ${x.de.nome} <${x.de.email}> em ${quando}.` },
    depois: () => marcarEmailTratado(x.id, "Proposta virou contrato em negociação. O e-mail saiu da lista.")
  });
  else if (tipo === "abrir") abrirConversa(x);
}

function cartaoEmail(x) {
  return `<article class="email-card ${x.novo ? "novo" : ""} ${x.automatico ? "automatico" : ""}" data-email="${esc(x.id)}">
    <span class="email-avatar">${esc((x.de.marca || "?").charAt(0).toUpperCase())}</span>
    <div class="email-corpo">
      <button type="button" class="email-abrir" data-acao-email="abrir">
        <span class="email-topo"><b>${esc(x.de.nome)}</b><span class="sub">${esc(x.de.email)}</span><span class="espaco"></span><span class="sub">${x.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span></span>
        <span class="email-assunto">${x.novo ? `<i class="ponto-novo" aria-label="não lido"></i>` : ""}${esc(x.assunto)}${x.importante && !x.automatico ? ` <span class="etq amarela">importante</span>` : ""}${x.spam ? ` <span class="etq vermelha">estava no spam</span>` : ""}</span>
        <span class="email-trecho">${esc(x.trecho)}</span>
      </button>
      ${x.automatico ? `<p class="sub" style="margin:0">escondido: ${esc(x.automatico)}</p>` : `<div class="lembrete-acoes" style="justify-content:flex-start">
        <button type="button" class="btn pequeno primario" data-acao-email="abrir">Responder</button>
        <button type="button" class="btn pequeno" data-acao-email="contrato">Virar contrato</button>
        <button type="button" class="btn pequeno" data-acao-email="marca">Salvar marca</button>
        <button type="button" class="btn pequeno" data-acao-email="ignorar">Não é proposta</button>
        ${x.de.dominio ? `<button type="button" class="link-btn pequeno-link" data-acao-email="esconder-remetente">esconder sempre ${esc(x.de.dominio)}</button>` : ""}
      </div>`}
    </div>
  </article>`;
}

function desenharPropostas(el) {
  if (!gmailConectado() && gm.permanente === undefined) { el.innerHTML = `<p class="vazio">Sincronizando o Gmail...</p>`; return; }
  if (!gmailConectado()) {
    el.innerHTML = `<div class="cartao gmail-conectar">
      <span class="gmail-icone">${ic("email")}</span>
      <h2>Conecte o Gmail de propostas</h2>
      <p>O painel lê a caixa de entrada do <b>${esc(EMAIL_PROPOSTAS)}</b>, separa os e-mails de proposta escritos por pessoas e esconde os automáticos. Você responde daqui mesmo, sem abrir o Gmail.</p>
      <p class="sub">Você só faz isso <b>uma vez</b>: depois o painel fica sincronizado sozinho, em qualquer aba e no celular. O Google mostra um aviso de "app não verificado"; é normal, o app é só seu: clique em <b>Continuar</b> e aceite ver e enviar e-mails.</p>
      ${gm.erro ? `<div class="aviso-falta">${esc(gm.erro)}</div>` : ""}
      <button class="btn primario" type="button" id="conectar-gmail">${ic("email")}Conectar o Gmail</button>
    </div>`;
    $("#conectar-gmail").onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = "Abrindo o Google...";
      try { await conectarGmail(); await lerPropostas(); }
      catch (erro) { gm.erro = erro.message; desenhar(); }
    };
    return;
  }
  if (gm.aberto) { desenharConversa(el); ligarAcoesEmail(el); return; }
  if (!gm.emails && !gm.carregando && !gm.erro) lerPropostas();

  const visiveis = propostasVisiveis();
  const automaticos = (gm.emails || []).filter((x) => x.automatico && !adiado("email-" + x.id));
  const minutos = Math.max(1, Math.round((gm.expira - Date.now()) / 60000));
  el.innerHTML = `
    <div class="barra">
      <div class="busca">${ic("busca")}<input type="search" id="busca-gmail" placeholder="Filtrar mais (ex: nome da marca)" value="${esc(gm.busca)}" aria-label="Filtrar propostas"></div>
      <span class="espaco"></span>
      <span class="sub">${esc(EMAIL_PROPOSTAS)} · ${gm.permanente ? "sincronizado sozinho" : `conectado por mais ${minutos} min`}</span>
      <button class="btn" type="button" id="atualizar-gmail" ${gm.carregando ? "disabled" : ""}>${gm.carregando ? "Lendo..." : "Atualizar"}</button>
      <button class="btn" type="button" id="sair-gmail">Desconectar</button>
    </div>
    ${gm.erro ? `<div class="aviso-falta">${esc(gm.erro)}</div>` : ""}
    ${gm.carregando && !gm.emails ? `<p class="vazio">Lendo o seu Gmail...</p>`
      : `${visiveis.length
          ? `<p class="sub" style="margin:0 0 8px">${plural(visiveis.length, "proposta escrita por uma pessoa", "propostas escritas por pessoas")} nos últimos 90 dias${propostasNovas ? ` · <b>${plural(propostasNovas, "não lida", "não lidas")}</b>` : ""}</p>
            <div class="lista-emails">${visiveis.map(cartaoEmail).join("")}</div>`
          : `<p class="vazio">Nenhuma proposta de pessoa nos últimos 90 dias. Os e-mails automáticos e de plataformas ficam escondidos.</p>`}
        ${automaticos.length ? `<button type="button" class="link-btn ver-automaticos" id="ver-automaticos">${gm.verAutomaticos ? "esconder" : "ver"} ${plural(automaticos.length, "e-mail automático escondido", "e-mails automáticos escondidos")}</button>
          ${gm.verAutomaticos ? `<div class="lista-emails">${automaticos.map(cartaoEmail).join("")}</div>` : ""}` : ""}`}`;

  $("#atualizar-gmail").onclick = () => lerPropostas();
  $("#sair-gmail").onclick = async () => {
    if (!(await confirmar("Desconectar o Gmail do painel? Para voltar, vai precisar conectar de novo.", "Sim, desconectar"))) return;
    await desconectarGmail(); desenhar(); avisar("Gmail desconectado.");
  };
  const ver = $("#ver-automaticos");
  if (ver) ver.onclick = () => { gm.verAutomaticos = !gm.verAutomaticos; desenhar(); };
  let espera;
  $("#busca-gmail").addEventListener("input", (e) => { gm.busca = e.target.value.trim(); clearTimeout(espera); espera = setTimeout(lerPropostas, 700); });
  ligarAcoesEmail(el);
}

function ligarAcoesEmail(el) {
  el.onclick = (e) => {
    const b = e.target.closest("[data-acao-email]");
    if (!b) return;
    const card = b.closest("[data-email]");
    const x = card ? (gm.emails || []).find((m) => m.id === card.dataset.email) : gm.aberto;
    if (x) acaoEmail(b.dataset.acaoEmail, x);
  };
}

/* =============================================================
   ABA REDES SOCIAIS: INSTAGRAM (@ryalvz)
   Métricas oficiais do Instagram (pelo ajudante "instagram" no
   Supabase): alcance, visualizações, interações, seguidores,
   desempenho de cada post, formato que mais rende, melhor dia e
   horário, público e os números para o mídia kit.
   A chave de acesso fica guardada só no Supabase, nunca aqui.
   ============================================================= */
const ig = { dados: null, conectado: null, carregando: false, erro: "", dias: 30, ordem: "taxa", tipo: "" };
const NOME_FORMATO = { REELS: "Reels", CARROSSEL: "Carrossel", FOTO: "Foto", VIDEO: "Vídeo" };
const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const compacto = (n) => { n = Math.round(Number(n) || 0); return n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " mi" : n >= 1e4 ? (n / 1e3).toFixed(1).replace(".", ",") + " mil" : num(n); };
const interacoesDe = (p) => n2(p.total_interactions) || (n2(p.curtidas) + n2(p.comentarios) + n2(p.shares) + n2(p.saved));
const taxaDe = (p) => (n2(p.reach) ? (interacoesDe(p) / n2(p.reach)) * 100 : 0);
const pct1 = (v) => v.toFixed(1).replace(".", ",") + "%";
const media = (lista, f) => (lista.length ? lista.reduce((s, x) => s + f(x), 0) / lista.length : 0);

async function chamarInstagram(corpo) {
  const { data, error } = await db.functions.invoke("instagram", { body: corpo });
  if (error) {
    const st = error.context && error.context.status;
    throw new Error(st === 404 ? "O ajudante do Instagram ainda não foi publicado no Supabase." : "O ajudante do Instagram não respondeu. Tente de novo em instantes.");
  }
  return data || {};
}

async function carregarInstagram() {
  if (ig.carregando) return;
  ig.carregando = true; ig.erro = "";
  if (["instagram", "inicio"].includes(abaAtual)) desenhar();
  try {
    const r = await chamarInstagram({ acao: "dados", dias: ig.dias });
    ig.conectado = r.conectado !== false && !!r.perfil;
    ig.dados = ig.conectado ? r : null;
    if (r.erro) ig.erro = r.erro;
    if (ig.conectado) S.igHistorico = await ler("ig_historico", (q, c) => (c.includes("data") ? q.order("data") : q)).catch(() => []);
  } catch (e) { ig.erro = e.message; ig.conectado = ig.conectado ?? false; }
  ig.carregando = false;
  if (["instagram", "inicio"].includes(abaAtual)) desenhar();
}

function desenharMetricasInstagram(el) {
  if (ig.conectado === null && !ig.carregando) { carregarInstagram(); }
  if (ig.carregando && !ig.dados) { el.innerHTML = `<p class="vazio">Buscando as métricas do Instagram...</p>`; return; }
  if (!ig.conectado) { desenharConectarInstagram(el); return; }

  const d = ig.dados, p = d.perfil, a = d.atual || {}, b = d.anterior || {};
  const posts = d.posts || [];
  const novos = n2(a.seguiram) - n2(a.deixaram), novosAntes = n2(b.seguiram) - n2(b.deixaram);
  const kpi = (rotulo, atual, antes, dica) => `<div class="kpi-inicio estatico" title="${esc(dica)}">
      <span>${rotulo}</span><strong>${compacto(atual)}</strong><small>${variacao(atual, antes)} <span class="sub">vs ${d.dias} dias antes</span></small></div>`;

  // Formatos
  const formatos = ["REELS", "CARROSSEL", "FOTO", "VIDEO"].map((t) => {
    const l = posts.filter((x) => x.tipo === t && n2(x.reach));
    return { t, n: l.length, alcance: media(l, (x) => n2(x.reach)), taxa: media(l, taxaDe), salvos: media(l, (x) => n2(x.saved)) };
  }).filter((x) => x.n);
  const maxAlcFormato = Math.max(1, ...formatos.map((x) => x.alcance));

  // Melhor dia e horário (pelo alcance médio dos seus posts)
  const comAlcance = posts.filter((x) => n2(x.reach));
  const porDia = DIAS_CURTOS.map((_, i) => { const l = comAlcance.filter((x) => new Date(x.data).getDay() === i); return { n: l.length, alcance: media(l, (x) => n2(x.reach)) }; });
  const FAIXAS = [["madrugada", 0, 6], ["manhã", 6, 12], ["tarde", 12, 18], ["noite", 18, 24]];
  const porHora = FAIXAS.map(([nome, de, ate]) => { const l = comAlcance.filter((x) => { const h = new Date(x.data).getHours(); return h >= de && h < ate; }); return { nome, de, ate, n: l.length, alcance: media(l, (x) => n2(x.reach)) }; });
  const maxDia = Math.max(1, ...porDia.map((x) => x.alcance));

  // Insights: onde focar
  const dicas = [];
  const melhorFormato = [...formatos].filter((x) => x.n >= 2).sort((x, y) => y.alcance - x.alcance)[0];
  const piorFormato = [...formatos].filter((x) => x.n >= 2).sort((x, y) => x.alcance - y.alcance)[0];
  if (melhorFormato && piorFormato && melhorFormato.t !== piorFormato.t && piorFormato.alcance) {
    dicas.push({ ic: "play", titulo: "Formato que mais rende", texto: `<b>${NOME_FORMATO[melhorFormato.t]}</b> alcança em média <b>${compacto(melhorFormato.alcance)}</b> pessoas, ${(melhorFormato.alcance / piorFormato.alcance).toFixed(1).replace(".", ",")}x mais que ${NOME_FORMATO[piorFormato.t].toLowerCase()}.`, dica: `Priorize ${NOME_FORMATO[melhorFormato.t].toLowerCase()} para crescer. Use ${NOME_FORMATO[piorFormato.t].toLowerCase()} quando o objetivo for conteúdo salvável.` });
  }
  const melhorDia = porDia.map((x, i) => ({ ...x, i })).filter((x) => x.n >= 2).sort((x, y) => y.alcance - x.alcance)[0];
  const melhorFaixa = porHora.filter((x) => x.n >= 2).sort((x, y) => y.alcance - x.alcance)[0];
  if (melhorDia || melhorFaixa) dicas.push({ ic: "calendario", titulo: "Quando postar", texto: `Seus posts de <b>${melhorDia ? DIAS_SEMANA[melhorDia.i] : "qualquer dia"}</b>${melhorFaixa ? ` à <b>${melhorFaixa.nome}</b>` : ""} têm o maior alcance médio.`, dica: "Teste postar nesse dia e horário por 3 semanas seguidas e compare aqui." });
  const salvavel = [...comAlcance].sort((x, y) => (n2(y.saved) + n2(y.shares)) - (n2(x.saved) + n2(x.shares)))[0];
  if (salvavel && n2(salvavel.saved) + n2(salvavel.shares) > 0) dicas.push({ ic: "estrela", titulo: "O que as pessoas guardam e mandam", texto: `"${esc((salvavel.legenda || "Post sem legenda").slice(0, 70))}" teve <b>${num(salvavel.saved)}</b> salvamentos e <b>${num(salvavel.shares)}</b> compartilhamentos.`, dica: "Salvamento e compartilhamento são o que mais faz o Instagram entregar para gente nova. Faça mais conteúdos nessa linha." });
  if (n2(b.reach)) {
    const v = ((n2(a.reach) - n2(b.reach)) / n2(b.reach)) * 100;
    dicas.push({ ic: "grafico", titulo: v >= 0 ? "Alcance subindo" : "Alcance caindo", alerta: v < -15, texto: `Seu alcance ${v >= 0 ? "subiu" : "caiu"} <b>${Math.abs(Math.round(v))}%</b> nos últimos ${d.dias} dias.`, dica: v >= 0 ? "Bom momento: mantenha a frequência e aproveite para fechar parcerias mostrando esse crescimento." : "Volte ao formato e ao tema dos seus posts com mais alcance (lista abaixo) e poste com mais constância." });
  }
  const reels = comAlcance.filter((x) => x.tipo === "REELS" && n2(x.ig_reels_avg_watch_time));
  if (reels.length >= 2) {
    const seg = media(reels, (x) => n2(x.ig_reels_avg_watch_time)) / 1000;
    dicas.push({ ic: "relogio", titulo: "Tempo assistido nos Reels", alerta: seg < 3, texto: `Em média as pessoas assistem <b>${seg.toFixed(1).replace(".", ",")} s</b> dos seus Reels.`, dica: seg < 3 ? "Muita gente sai antes de 3 segundos: comece com o resultado ou uma frase forte, sem introdução." : "Boa retenção. Para segurar até o fim, deixe a revelação para os últimos segundos." });
  }
  const ultimos30 = posts.filter((x) => Date.now() - Date.parse(x.data) < 30 * 864e5).length;
  dicas.push({ ic: "campanhas", titulo: "Frequência", alerta: ultimos30 < 8, texto: `Você postou <b>${plural(ultimos30, "vez", "vezes")}</b> nos últimos 30 dias.`, dica: ultimos30 < 8 ? "Para crescer, o ideal é 3 a 4 posts por semana. Use o banco de ideias (aba Transcrições) para não travar." : "Ótima constância. Agora foque em repetir os formatos que mais rendem." });
  if (n2(a.reach) && novos > 0) dicas.push({ ic: "marcas", titulo: "Quem vê, segue?", texto: `A cada 1.000 pessoas alcançadas, <b>${((novos / n2(a.reach)) * 1000).toFixed(1).replace(".", ",")}</b> viraram seguidoras.`, dica: "Para converter mais, termine os vídeos com um motivo para seguir (série, parte 2, dica fixa toda semana)." });

  // Posts ordenados
  const ORDENS = [["taxa", "Engajamento"], ["reach", "Alcance"], ["saved", "Salvamentos"], ["shares", "Compartilhamentos"], ["data", "Mais recentes"]];
  const valorOrdem = (x) => (ig.ordem === "taxa" ? taxaDe(x) : ig.ordem === "data" ? Date.parse(x.data) : n2(x[ig.ordem]));
  const lista = posts.filter((x) => !ig.tipo || x.tipo === ig.tipo).sort((x, y) => valorOrdem(y) - valorOrdem(x));

  // Mídia kit
  const reelsTodos = comAlcance.filter((x) => x.tipo === "REELS");
  const kit = { seguidores: n2(p.followers_count), alcanceReel: media(reelsTodos, (x) => n2(x.reach)), viewsReel: media(reelsTodos, (x) => n2(x.views)), taxa: media(comAlcance, taxaDe) };

  // Público
  const aud = d.publico || {};
  const totalIdade = (aud.age || []).reduce((s, x) => s + x.valor, 0);
  const totalGenero = (aud.gender || []).reduce((s, x) => s + x.valor, 0);
  const NOME_GENERO = { F: "Mulheres", M: "Homens", U: "Não informado" };

  // Crescimento guardado no painel
  const hist = (S.igHistorico || []).filter((x) => x.seguidores != null);
  const maxAlcDia = Math.max(1, ...(d.porDia || []).map((x) => x.valor));

  el.innerHTML = `
    <div class="ig-topo">
      ${p.profile_picture_url ? `<img class="ig-foto" src="${esc(p.profile_picture_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="ig-foto">${ic("insta")}</span>`}
      <div><b class="ig-nome">@${esc(p.username)}</b><span class="sub">${compacto(p.followers_count)} seguidores · ${num(p.media_count)} posts · seguindo ${num(p.follows_count)}</span></div>
      <span class="espaco"></span>
      <div class="chips" role="group" aria-label="Período">${[7, 14, 30].map((n) => `<button class="chip" type="button" data-ig-dias="${n}" aria-pressed="${ig.dias === n}">${n} dias</button>`).join("")}</div>
      <button class="btn" type="button" id="ig-atualizar" ${ig.carregando ? "disabled" : ""}>${ig.carregando ? "Atualizando..." : "Atualizar"}</button>
    </div>
    ${ig.erro ? `<div class="aviso-falta">${esc(ig.erro)}</div>` : ""}

    <div class="inicio-kpis ig-kpis">
      ${kpi("Alcance", n2(a.reach), n2(b.reach), "Pessoas diferentes que viram seus conteúdos")}
      ${kpi("Visualizações", n2(a.views), n2(b.views), "Quantas vezes seus conteúdos foram vistos")}
      ${kpi("Interações", n2(a.total_interactions), n2(b.total_interactions), "Curtidas, comentários, salvamentos e compartilhamentos")}
      ${kpi("Contas engajadas", n2(a.accounts_engaged), n2(b.accounts_engaged), "Pessoas que interagiram com você")}
      ${kpi("Novos seguidores", novos, novosAntes, "Quem seguiu menos quem deixou de seguir")}
      ${kpi("Cliques no link", n2(a.profile_links_taps), n2(b.profile_links_taps), "Toques no link da bio")}
    </div>

    <div class="grade-fin">
      <div class="cartao resumo-ano mostra-dicas">
        <h2>Onde focar</h2>
        <div class="insights">${[...dicas].sort((x, y) => (y.alerta ? 1 : 0) - (x.alerta ? 1 : 0)).slice(0, 5).map((x) => `<div class="insight ${x.alerta ? "alerta" : ""}"><span class="insight-ic">${ic(x.ic)}</span>
          <div><b>${x.titulo}</b><p>${x.texto}</p><p class="insight-dica">${x.dica}</p></div></div>`).join("") || `<p class="vazio">Poste mais algumas vezes para o painel ter base para comparar.</p>`}</div>
      </div>
      <div class="coluna-inicio">
        <div class="cartao">
          <h2>Alcance por dia</h2>
          ${(d.porDia || []).length ? `<div class="barras-mes barras-dias" role="img" aria-label="Alcance por dia">${d.porDia.map((x) => `<div class="grupo-mes" data-dica="<b>${dataBR(x.dia)}</b><br>Alcance: ${num(x.valor)}"><div class="par-barras"><i class="b-prev" style="height:${(x.valor / maxAlcDia) * 100}%"></i></div><span>${x.dia.slice(8, 10)}</span></div>`).join("")}</div>` : `<p class="vazio">Sem dados por dia.</p>`}
        </div>
        <div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Para o mídia kit</h2><span class="espaco"></span><button type="button" class="btn pequeno" id="ig-copiar">Copiar números</button></div>
          <div class="rel-grade" style="margin-top:0;border-top:0">
            <div><span>Seguidores</span><b>${compacto(kit.seguidores)}</b></div>
            <div><span>Alcance médio por Reel</span><b>${compacto(kit.alcanceReel)}</b></div>
            <div><span>Views médias por Reel</span><b>${compacto(kit.viewsReel)}</b></div>
            <div><span>Engajamento médio</span><b>${pct1(kit.taxa)}</b></div>
          </div>
        </div>
      </div>
    </div>

    <div class="grade-fin tres">
      <div class="cartao">
        <h2>Formato que mais rende</h2>
        ${formatos.length ? `<div class="lista-barras">${formatos.map((x) => `<div class="linha-barra" data-dica="<b>${NOME_FORMATO[x.t]}</b><br>${plural(x.n, "post", "posts")}<br>Alcance médio: ${num(Math.round(x.alcance))}<br>Engajamento médio: ${pct1(x.taxa)}">
          <span class="lb-nome">${NOME_FORMATO[x.t]}</span>
          <span class="lb-trilho"><i style="width:${(x.alcance / maxAlcFormato) * 100}%"></i></span>
          <span class="lb-valor">${compacto(x.alcance)}</span>
          <small class="lb-extra">${plural(x.n, "post", "posts")} · engajamento ${pct1(x.taxa)} · ${num(Math.round(x.salvos))} salvos em média</small>
        </div>`).join("")}</div>` : `<p class="vazio">Sem posts com métricas.</p>`}
      </div>
      <div class="cartao">
        <h2>Melhor dia para postar</h2>
        <div class="barras-mes barras-semana" role="img" aria-label="Alcance médio por dia da semana">${porDia.map((x, i) => `<div class="grupo-mes ${melhorDia && melhorDia.i === i ? "foco" : ""}" data-dica="<b>${DIAS_SEMANA[i]}</b><br>${plural(x.n, "post", "posts")}<br>Alcance médio: ${num(Math.round(x.alcance))}"><div class="par-barras"><i class="b-prev" style="height:${(x.alcance / maxDia) * 100}%"></i></div><span>${DIAS_CURTOS[i]}</span></div>`).join("")}</div>
        <p class="sub" style="margin:8px 0 0">${porHora.filter((x) => x.n).map((x) => `${x.nome}: ${compacto(x.alcance)}`).join(" · ")}</p>
      </div>
      <div class="cartao">
        <h2>Quem te segue</h2>
        ${totalIdade ? `<div class="lista-barras">${(aud.age || []).slice(0, 5).map((x) => `<div class="linha-barra"><span class="lb-nome">${esc(x.nome)} anos</span><span class="lb-trilho"><i style="width:${(x.valor / totalIdade) * 100}%"></i></span><span class="lb-valor">${pct(x.valor, totalIdade)}%</span></div>`).join("")}</div>
          <p class="sub" style="margin:10px 0 4px">${(aud.gender || []).map((x) => `${NOME_GENERO[x.nome] || x.nome}: ${pct(x.valor, totalGenero)}%`).join(" · ")}</p>
          <p class="sub" style="margin:0">Cidades: ${(aud.city || []).slice(0, 4).map((x) => esc(x.nome.split(",")[0])).join(", ")}</p>`
          : `<p class="vazio">O Instagram só mostra o público para contas com mais de 100 seguidores.</p>`}
      </div>
    </div>

    ${hist.length >= 2 ? `<div class="cartao"><h2>Seguidores ao longo do tempo</h2>
      <p class="sub" style="margin:-6px 0 6px">o painel guarda um ponto por dia em que você abre esta aba</p>
      ${(() => { const min = Math.min(...hist.map((x) => x.seguidores)), max = Math.max(...hist.map((x) => x.seguidores)); return `<div class="barras-mes barras-dias">${hist.slice(-30).map((x) => `<div class="grupo-mes" data-dica="<b>${dataBR(x.data)}</b><br>${num(x.seguidores)} seguidores"><div class="par-barras"><i class="b-fat" style="height:${max === min ? 60 : 15 + ((x.seguidores - min) / (max - min)) * 85}%"></i></div><span>${String(x.data).slice(8, 10)}</span></div>`).join("")}</div>`; })()}
    </div>` : ""}

    <div class="barra" style="margin-top:4px">
      <h2 style="margin:0">Seus posts</h2>
      <div class="chips" role="group" aria-label="Ordenar">${ORDENS.map(([v, n]) => `<button class="chip" type="button" data-ig-ordem="${v}" aria-pressed="${ig.ordem === v}">${n}</button>`).join("")}</div>
      <select class="campo" id="ig-tipo" aria-label="Formato"><option value="">Todos os formatos</option>${Object.entries(NOME_FORMATO).map(([v, n]) => `<option value="${v}" ${ig.tipo === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    </div>
    <div class="ig-posts">${lista.map((x) => `<a class="ig-post" href="${esc(x.link)}" target="_blank" rel="noopener">
      <span class="ig-capa">${x.capa ? `<img src="${esc(x.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ""}<span class="pilula p-status">${NOME_FORMATO[x.tipo] || x.tipo}</span></span>
      <span class="ig-post-info">
        <small class="sub">${new Date(x.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small>
        <span class="ig-legenda">${esc((x.legenda || "Sem legenda").slice(0, 90))}</span>
        <span class="ig-numeros">
          <span><b>${compacto(x.reach)}</b> alcance</span>
          <span><b>${pct1(taxaDe(x))}</b> engaj.</span>
          <span><b>${num(x.saved)}</b> salvos</span>
          <span><b>${num(x.shares)}</b> compart.</span>
        </span>
      </span>
    </a>`).join("") || `<p class="vazio">Nenhum post nesse formato.</p>`}</div>
    <p class="sub" style="margin-top:14px">Dados oficiais do Instagram, atualizados às ${new Date(d.atualizado).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. <button type="button" class="link-btn" id="ig-desconectar">desconectar o Instagram</button></p>`;

  $$("[data-ig-dias]", el).forEach((b) => b.onclick = () => { ig.dias = Number(b.dataset.igDias); carregarInstagram(); });
  $$("[data-ig-ordem]", el).forEach((b) => b.onclick = () => { ig.ordem = b.dataset.igOrdem; desenhar(); });
  $("#ig-tipo").onchange = (e) => { ig.tipo = e.target.value; desenhar(); };
  $("#ig-atualizar").onclick = () => carregarInstagram();
  $("#ig-copiar").onclick = async () => {
    const texto = `Instagram @${p.username}\nSeguidores: ${num(kit.seguidores)}\nAlcance médio por Reel: ${num(Math.round(kit.alcanceReel))}\nVisualizações médias por Reel: ${num(Math.round(kit.viewsReel))}\nTaxa de engajamento média: ${pct1(kit.taxa)}\nAlcance nos últimos ${d.dias} dias: ${num(a.reach)}`;
    try { await navigator.clipboard.writeText(texto); avisar("Números copiados. É só colar no mídia kit ou na proposta."); } catch (_) { avisar("Não deu para copiar automaticamente.", true); }
  };
  $("#ig-desconectar").onclick = async () => {
    if (!(await confirmar("Desconectar o Instagram do painel? Para voltar, vai precisar gerar uma chave nova na Meta.", "Sim, desconectar"))) return;
    try { await chamarInstagram({ acao: "desconectar" }); ig.conectado = false; ig.dados = null; desenhar(); avisar("Instagram desconectado."); } catch (e) { avisar(e.message, true); }
  };
  ligarDicas(el);
}

function desenharConectarInstagram(el) {
  el.innerHTML = `<div class="cartao gmail-conectar ig-conectar">
    <span class="gmail-icone">${ic("insta")}</span>
    <h2>Conecte o Instagram @ryalvz</h2>
    <p>Com o Instagram conectado, o painel mostra alcance, visualizações, interações, seguidores ganhos, os posts que mais rendem, o melhor formato, o melhor dia para postar, o seu público e os números prontos para o mídia kit.</p>
    <ol class="passos" style="text-align:left">
      <li>No site da Meta (developers.facebook.com), abra o app <b>Painel Ryan</b>, vá em <b>Instagram</b> e depois em <b>Configuração da API com login do Instagram</b>.</li>
      <li>Em <b>Gerar tokens de acesso</b>, clique em <b>Adicionar conta</b>, entre com o @ryalvz e depois em <b>Gerar token</b>.</li>
      <li>Copie o token e cole aqui embaixo. Ele fica guardado só no Supabase e o painel renova sozinho antes de vencer.</li>
    </ol>
    ${ig.erro ? `<div class="aviso-falta">${esc(ig.erro)}</div>` : ""}
    <input class="campo" type="password" id="ig-token" placeholder="Cole aqui o token do Instagram" autocomplete="off" spellcheck="false">
    <button class="btn primario" type="button" id="ig-conectar">${ic("insta")}Conectar o Instagram</button>
  </div>`;
  $("#ig-conectar").onclick = async (e) => {
    const token = $("#ig-token").value.trim();
    if (!token) { avisar("Cole o token primeiro.", true); return; }
    e.target.disabled = true; e.target.textContent = "Conferindo com a Meta...";
    try {
      const r = await chamarInstagram({ acao: "conectar", token });
      if (r.erro) throw new Error(r.erro);
      avisar(`Instagram @${r.usuario} conectado!`);
      ig.conectado = null; ig.dados = null; carregarInstagram();
    } catch (erro) { ig.erro = erro.message; desenhar(); }
  };
}

/* ---------- Início: quadros de propostas (Gmail) e Instagram ---------- */
function quadrosEntrada() {
  // E-mails
  let emails;
  if (!gmailConectado() && gm.permanente !== false) {
    emails = `<p class="vazio">Sincronizando o Gmail...</p>`;
  } else if (!gmailConectado()) {
    emails = `<p class="sub" style="margin:0 0 8px">Conecte o Gmail uma vez para ver aqui as propostas que chegam.</p>
      <button type="button" class="btn pequeno primario" id="inicio-conectar-gmail">${ic("email")}Conectar o Gmail</button>`;
  } else if (!gm.emails) {
    emails = `<p class="vazio">${gm.carregando ? "Lendo o seu Gmail..." : "Abrindo as propostas..."}</p>`;
  } else {
    // Só os e-mails novos (não lidos); os antigos ficam na aba Propostas
    const novas = propostasVisiveis().filter((x) => x.novo);
    const lista = novas.sort((a, b) => (b.importante === true) - (a.importante === true) || b.data - a.data).slice(0, 4);
    const naoLidas = novas.length;
    emails = lista.length
      ? `<p class="sub" style="margin:0 0 6px">${naoLidas ? `<b>${plural(naoLidas, "proposta não lida", "propostas não lidas")}</b> de pessoas` : "nenhuma proposta não lida"}</p>
        <div class="lista-dia">${lista.map((x) => `<button type="button" class="item-dia" data-inicio-email="${esc(x.id)}">
          <span class="pilula ${x.spam ? "p-parada" : x.importante ? "p-pendente" : "p-conversando"}">${x.spam ? "Estava no spam" : x.importante ? "Importante" : x.novo ? "Nova" : "Proposta"}</span>
          <span class="item-dia-texto"><b>${x.novo ? "● " : ""}${esc(x.assunto)}</b><small>${esc(x.de.nome)} · ${x.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></span>
        </button>`).join("")}</div>`
      : `<p class="vazio">Nenhum e-mail novo de proposta. Os antigos estão na aba Propostas.</p>`;
  }
  // Instagram
  let insta;
  if (ig.carregando && !ig.dados) insta = `<p class="vazio">Buscando o Instagram...</p>`;
  else if (!ig.conectado || !ig.dados) insta = `<p class="sub" style="margin:0 0 8px">Conecte o @ryalvz para ver alcance, seguidores e os posts que estão rendendo.</p>
      <button type="button" class="btn pequeno" data-ir="instagram">${ic("insta")}Conectar o Instagram</button>`;
  else {
    const d = ig.dados, a = d.atual || {}, b = d.anterior || {};
    const novos = n2(a.seguiram) - n2(a.deixaram);
    const top = [...(d.posts || [])].filter((x) => Date.now() - Date.parse(x.data) < 14 * 864e5).sort((x, y) => n2(y.reach) - n2(x.reach))[0];
    const destaque = postEmDestaque();
    insta = `<div class="ig-mini">
        <div><span>Seguidores</span><b>${compacto(d.perfil.followers_count)}</b><small>${novos >= 0 ? "+" : ""}${num(novos)} em ${d.dias} dias</small></div>
        <div><span>Alcance</span><b>${compacto(a.reach)}</b><small>${variacao(n2(a.reach), n2(b.reach))}</small></div>
        <div><span>Interações</span><b>${compacto(a.total_interactions)}</b><small>${variacao(n2(a.total_interactions), n2(b.total_interactions))}</small></div>
      </div>
      ${destaque ? `<p class="dica-caixa" style="margin:8px 0 0">🔥 Post rendendo <b>${destaque.vezes.toFixed(1).replace(".", ",")}x</b> a sua média: "${esc((destaque.post.legenda || "").slice(0, 60))}"</p>`
        : top ? `<p class="sub" style="margin:8px 0 0">Melhor post das últimas 2 semanas: "${esc((top.legenda || "sem legenda").slice(0, 60))}" (${compacto(top.reach)} de alcance)</p>` : ""}`;
  }
  return `<div class="grade-entrada">
    <div class="cartao">
      <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">${ic("email")} E-mails de propostas</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="propostas">ver todas</button></div>
      ${emails}
    </div>
    <div class="cartao">
      <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">${ic("insta")} Instagram</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="instagram">ver métricas</button></div>
      ${insta}
    </div>
  </div>`;
}

/* =============================================================
   ABA PROSPECÇÃO
   Manda o seu e-mail de apresentação para as marcas da aba Marcas.
   Dois jeitos de enviar:
     Resend (automático): o ajudante "enviar-emails" do Supabase
       manda em lotes. A chave do Resend fica só no cofre do Supabase.
     Rascunho (plano B): uma fila, uma marca por vez, com o Gmail
       já preenchido. Funciona sem Resend nenhum.
   Os e-mails vêm sempre da tabela de marcas. O registro de cada
   envio fica em email_envios e o descadastro em email_optout
   (arquivo disparo.sql).
   ============================================================= */
const MODELO_ASSUNTO = "Conteúdo UGC para a {{marca}}";
const MODELO_TEXTO = `Oi, time da {{nome}}! Tudo bem?

Meu nome é Ryan Alves e eu sou criador de conteúdo UGC. Faço vídeos com cara de cliente de verdade, pensados para anúncios e redes sociais.

Acompanho o trabalho da {{marca}} e acredito que dá para criar conteúdos que conversam muito bem com o público de vocês.

Se fizer sentido, é só responder este e-mail que eu mando ideias e valores.

Abraço,
Ryan Alves`;
const pro = {
  envio: "gmail", escrita: "texto", publico: "selecionadas", pularRepetidos: true,
  assunto: MODELO_ASSUNTO, texto: MODELO_TEXTO, html: "", botaoTexto: "Ver meu portfólio", botaoLink: "https://ryalvz.github.io/portfoliougc/",
  envios: null, optout: null, falta: [], carregando: false, carregado: false, buscaHist: "",
  testeFeito: "", filaPulados: [], sairConferido: false
};
// O rascunho fica guardado neste aparelho, para você não perder o texto
(function lerRascunho() {
  try { const r = JSON.parse(localStorage.getItem("prospeccao-rascunho") || "null"); if (r && r.v !== 2) delete r.envio; if (r) ["envio", "escrita", "assunto", "texto", "html", "botaoTexto", "botaoLink"].forEach((k) => { if (r[k] != null) pro[k] = r[k]; }); } catch (_) {}
})();
function guardarRascunho() {
  try { localStorage.setItem("prospeccao-rascunho", JSON.stringify({ v: 2, envio: pro.envio, escrita: pro.escrita, assunto: pro.assunto, texto: pro.texto, html: pro.html, botaoTexto: pro.botaoTexto, botaoLink: pro.botaoLink })); } catch (_) {}
}

// O primeiro e-mail válido do campo (tem marca com vários e-mails no mesmo campo)
function primeiroEmail(m) {
  return String(m && m.email || "").split(/[\s,;/]+/).map((x) => x.trim().toLowerCase()).find((x) => /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(x)) || "";
}
// {{nome}}: o nome da marca sem o que está entre parênteses ou depois da barra
const nomeCurto = (nome) => String(nome || "").replace(/\s*\(.*?\)\s*/g, " ").split(/\s+\/\s+/)[0].trim() || String(nome || "").trim();
const temProspeccao = () => temCampo("marcas", "selecionada");

/* ---------- Montar o e-mail ---------- */
function textoParaHTML(t) {
  const linkar = (s) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" style="color:#1F3FC3;">$1</a>');
  return String(t || "").trim().split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px;">${linkar(esc(p)).replace(/\n/g, "<br>")}</p>`).join("\n      ");
}
function montarEmailHTML({ texto, botaoTexto, botaoLink }) {
  const botao = botaoTexto && /^https?:\/\//.test(botaoLink || "")
    ? `<p style="margin:24px 0 8px;"><a href="${esc(botaoLink)}" style="display:inline-block;background:#1F3FC3;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 24px;border-radius:8px;">${esc(botaoTexto)}</a></p>` : "";
  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="max-width:560px;margin:0 auto;padding:28px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1f2430;">
      ${textoParaHTML(texto)}
      ${botao}
      <p style="margin:32px 0 0;padding-top:12px;border-top:1px solid #eeeeee;font-size:11px;line-height:1.5;color:#8a8f99;">Se não quiser receber mais e-mails meus, é só responder com SAIR.</p>
    </div>
  </body>
</html>`;
}
// O HTML que vai sair, do jeito que estiver ligado (texto fácil ou HTML colado)
const htmlAtual = () => pro.escrita === "html" ? pro.html : montarEmailHTML(pro);
const preencherChaves = (t, nome, marca) => String(t || "").replace(/\{\{\s*nome\s*\}\}/gi, esc(nome)).replace(/\{\{\s*marca\s*\}\}/gi, esc(marca));
const assuntoPara = (d) => preencherChaves(pro.assunto, d.nome, d.marca).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// Versão em texto puro (para copiar e para o Gmail)
function textoPuroPara(d) {
  if (pro.escrita === "html") {
    const div = document.createElement("div");
    div.innerHTML = preencherChaves(pro.html, d.nome, d.marca).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li|tr)>/gi, "\n\n");
    return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  const subs = (t) => String(t).replace(/\{\{\s*nome\s*\}\}/gi, d.nome).replace(/\{\{\s*marca\s*\}\}/gi, d.marca);
  let t = subs(pro.texto).trim();
  if (pro.botaoTexto && /^https?:\/\//.test(pro.botaoLink || "")) t += `\n\n${pro.botaoTexto}: ${pro.botaoLink}`;
  return t + "\n\nSe não quiser receber mais e-mails meus, é só responder com SAIR.";
}

/* ---------- Pra quem vai ---------- */
function opcoesPublico() {
  const sits = [...new Set(S.marcas.map((m) => m.situacao).filter(Boolean))];
  const ordem = SITUACOES.map((x) => x[0]);
  sits.sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99));
  const plurais = { lead: "Só os leads", conversando: "Só quem está conversando", cliente: "Só quem já é cliente", parada: "Só as paradas" };
  return [["selecionadas", "Só as marcas que eu selecionei"], ["teste", "Só pra mim (teste)"], ["todas", "Todas as marcas com e-mail"]]
    .concat(sits.map((s) => ["sit:" + s, plurais[s] || `Só: ${nomeSituacao(s)}`]));
}
// Devolve quem recebe e quantas ficaram de fora (sem e-mail, repetido, descadastro, já recebeu)
function destinatariosDe(publico) {
  if (publico === "teste") return { lista: [{ email: EMAIL_PROPOSTAS, nome: "Natura", marca: "Natura", marca_id: null }], semEmail: 0, repetidos: 0, descadastrados: 0, jaReceberam: 0, total: 1 };
  const marcas = S.marcas.filter((m) => !m.exemplo && (
    publico === "selecionadas" ? m.selecionada : publico === "todas" ? true : publico.startsWith("sit:") ? m.situacao === publico.slice(4) : false));
  const fora = new Set((pro.optout || []).map((x) => x.email));
  const ja = new Set((pro.envios || []).filter((x) => x.status === "ok" && x.assunto === pro.assunto).map((x) => x.email.toLowerCase()));
  const vistos = new Set();
  let semEmail = 0, repetidos = 0, descadastrados = 0, jaReceberam = 0;
  const lista = [];
  marcas.forEach((m) => {
    const email = primeiroEmail(m);
    if (!email) { semEmail++; return; }
    if (vistos.has(email)) { repetidos++; return; }
    vistos.add(email);
    if (fora.has(email)) { descadastrados++; return; }
    if (pro.pularRepetidos && ja.has(email)) { jaReceberam++; return; }
    lista.push({ email, nome: nomeCurto(m.nome), marca: m.nome, marca_id: m.id });
  });
  return { lista, semEmail, repetidos, descadastrados, jaReceberam, total: marcas.length };
}
const nomePublico = (p) => (opcoesPublico().find((x) => x[0] === p) || [p, p])[1];

/* ---------- Dados da aba (registro e descadastro) ---------- */
async function carregarProspeccao(forcar) {
  if (pro.carregando || (pro.carregado && !forcar)) return;
  pro.carregando = true;
  const falta = [];
  const [envios, optout] = await Promise.all([
    db.from("email_envios").select("id,email,assunto,status,erro,via,marca_id,criado_em").order("criado_em", { ascending: false }).limit(5000),
    db.from("email_optout").select("email,criado_em").order("criado_em", { ascending: false })
  ]);
  if (envios.error) falta.push("email_envios (o registro de envios)"); else pro.envios = envios.data || [];
  if (optout.error) falta.push("email_optout (o descadastro)"); else pro.optout = (optout.data || []).map((x) => ({ ...x, email: String(x.email).toLowerCase() }));
  if (!temProspeccao()) falta.push("as colunas selecionada e email_enviado_em na tabela marcas");
  pro.falta = falta;
  pro.carregando = false; pro.carregado = true;
  if (abaAtual === "prospeccao") desenhar();
  conferirSair();
}
// Quem respondeu SAIR no Gmail entra no descadastro sozinho
async function conferirSair() {
  if (pro.sairConferido || !pro.optout || typeof gmailConectado !== "function" || !gmailConectado()) return;
  pro.sairConferido = true;
  try {
    const lista = await gmailApi("messages?maxResults=50&q=" + encodeURIComponent('in:anywhere newer_than:365d -from:me (subject:SAIR OR "SAIR")'));
    const novos = [];
    for (const { id } of lista.messages || []) {
      const m = await gmailApi(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`).catch(() => null);
      if (!m) continue;
      const assunto = cabecalho(m, "Subject").trim(), trecho = semEntidades(m.snippet || "").trim();
      if (!/^sair\b/i.test(assunto) && !/^sair\b/i.test(trecho)) continue;
      const email = lerRemetente(cabecalho(m, "From")).email;
      if (email && email !== EMAIL_PROPOSTAS && !pro.optout.some((x) => x.email === email) && !novos.includes(email)) novos.push(email);
    }
    if (novos.length) {
      const { error } = await db.from("email_optout").upsert(novos.map((email) => ({ email })), { onConflict: "email", ignoreDuplicates: true });
      if (!error) { pro.optout = novos.map((email) => ({ email, criado_em: new Date().toISOString() })).concat(pro.optout); avisar(`${plural(novos.length, "pessoa respondeu", "pessoas responderam")} SAIR e saiu da lista.`); if (abaAtual === "prospeccao") desenhar(); }
    }
  } catch (e) { console.warn("conferir SAIR", e); }
}

/* ---------- A tela ---------- */
function desenharProspeccao(el) {
  if (!pro.carregado) { carregarProspeccao(); el.innerHTML = `<p class="vazio">Abrindo a prospecção...</p>`; return; }
  const comEmail = S.marcas.filter((m) => !m.exemplo && primeiroEmail(m));
  const selecionadas = S.marcas.filter((m) => m.selecionada && primeiroEmail(m));
  const okEnvios = (pro.envios || []).filter((x) => x.status === "ok");
  const receberam = new Set(okEnvios.map((x) => x.email.toLowerCase()));
  const traco = "-";
  const numero = (v, ok) => ok ? num(v) : traco;
  const temEnvios = !!pro.envios, temOptout = !!pro.optout;

  const capa = `<section class="pro-capa">
    <div class="pro-capa-texto">
      <span class="pro-capa-icone">${ic("email")}</span>
      <div><h2>Prospecção</h2><p>Mande o seu e-mail de apresentação para as marcas da sua base, cada uma chamada pelo nome, sem copiar e colar uma por uma.</p>
        <div class="pro-etiquetas"><span>Teste antes, sempre</span><span>A chave vive no Supabase</span><span>Quem responde SAIR sai da lista</span></div></div>
    </div>
    <div class="pro-capa-numero"><strong>${temEnvios && okEnvios.length ? num(okEnvios.length) : traco}</strong><span>enviados até agora</span></div>
  </section>`;

  const cartoes = `<div class="pro-cartoes">
    ${[["cor-principal", numero(comEmail.length, true), "Marcas com e-mail", `${num(S.marcas.length - comEmail.length)} sem e-mail na base`],
       ["ambar", numero(selecionadas.filter((m) => !m.email_enviado_em).length, temProspeccao()), "A enviar", "selecionadas e ainda sem e-mail"],
       ["verde", numero(receberam.size, temEnvios), "Já receberam", temEnvios ? "e-mails diferentes" : "falta a tabela de registro"],
       ["vermelho", numero((pro.envios || []).filter((x) => x.status === "erro").length, temEnvios), "Falhas", "e-mails que deram erro"],
       ["azul", numero((pro.optout || []).length, temOptout), "Descadastrados", "responderam SAIR"]]
      .map(([cor, v, r, ctx]) => `<div class="pro-cartao ${cor === "cor-principal" ? "" : cor}"><strong>${v}</strong><span>${r}</span>${ctx ? `<small>${ctx}</small>` : ""}</div>`).join("")}
  </div>`;

  const aviso = pro.falta.length ? `<div class="aviso-falta" role="alert"><b>Falta preparar o banco para a prospecção:</b> ${pro.falta.map(esc).join(", ")}. Rode o arquivo <b>disparo.sql</b> no SQL Editor do Supabase. O resto da aba continua funcionando.</div>` : "";

  // Base sem e-mail nenhum: nada de tela de envio vazia
  if (!comEmail.length) {
    el.innerHTML = capa + cartoes + aviso + `<div class="cartao pro-vazio"><h2>Sua base ainda está sem e-mail</h2>
      <p class="sub">Os e-mails da prospecção vêm da sua aba Marcas. Cadastre o e-mail das marcas ou importe a sua planilha primeiro.</p>
      <button class="btn primario" type="button" data-ir-aba="marcas">${ic("marcas")}Ir para Marcas</button></div>`;
    $$("[data-ir-aba]", el).forEach((b) => b.onclick = () => irPara(b.dataset.irAba));
    return;
  }

  if (!opcoesPublico().some((x) => x[0] === pro.publico)) pro.publico = "selecionadas";
  el.innerHTML = capa + cartoes + aviso + `
    <div class="pro-grade">
      <div class="pro-form">
        <div class="cartao">
          <div class="pro-modos" role="radiogroup" aria-label="Como enviar">
            <button type="button" role="radio" data-envio="gmail" aria-checked="${pro.envio === "gmail"}"><b>Pelo meu Gmail</b><small>sai do ${esc(EMAIL_PROPOSTAS)}</small></button>
            <button type="button" role="radio" data-envio="resend" aria-checked="${pro.envio === "resend"}"><b>Resend</b><small>precisa de domínio próprio</small></button>
            <button type="button" role="radio" data-envio="rascunho" aria-checked="${pro.envio === "rascunho"}"><b>Rascunho</b><small>uma por vez, você confere</small></button>
          </div>
          <h3 class="pro-titulo">1. Pra quem vai</h3>
          <p class="pro-origem">${ic("marcas")}Os e-mails vêm da sua aba Marcas.</p>
          <select class="campo" id="pro-publico" aria-label="Destinatários">${opcoesPublico().map(([v, t]) => `<option value="${esc(v)}" ${pro.publico === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
          <div id="pro-contagem" class="pro-contagem"></div>
          <label class="check pro-check"><input type="checkbox" id="pro-pular" ${pro.pularRepetidos ? "checked" : ""}> Pular quem já recebeu este mesmo assunto</label>
        </div>

        <div class="cartao">
          <h3 class="pro-titulo">2. O e-mail</h3>
          <div class="chips pro-escrita" role="group" aria-label="Jeito de escrever">
            <button class="chip" type="button" data-escrita="texto" aria-pressed="${pro.escrita === "texto"}">Texto fácil</button>
            <button class="chip" type="button" data-escrita="html" aria-pressed="${pro.escrita === "html"}">HTML</button>
          </div>
          <label class="pro-rotulo" for="pro-assunto">Assunto</label>
          <input class="campo" id="pro-assunto" value="${esc(pro.assunto)}" placeholder="Conteúdo UGC para a {{marca}}">
          ${pro.escrita === "texto" ? `
            <label class="pro-rotulo" for="pro-texto">Texto</label>
            <textarea class="campo pro-texto" id="pro-texto" rows="12">${esc(pro.texto)}</textarea>
            <p class="ajuda">Use <code>{{nome}}</code> e <code>{{marca}}</code> onde quiser o nome da marca. Linha em branco separa os parágrafos, e os links viram clicáveis sozinhos.</p>
            <div class="pro-botao-campos">
              <div><label class="pro-rotulo" for="pro-btxt">Texto do botão (opcional)</label><input class="campo" id="pro-btxt" value="${esc(pro.botaoTexto)}" placeholder="Ver meu portfólio"></div>
              <div><label class="pro-rotulo" for="pro-blink">Link do botão</label><input class="campo" id="pro-blink" value="${esc(pro.botaoLink)}" placeholder="https://..."></div>
            </div>` : `
            <div class="barra" style="margin:12px 0 4px"><label class="pro-rotulo" for="pro-html" style="margin:0">HTML do e-mail</label><span class="espaco"></span>
              <button class="btn pequeno" type="button" id="pro-modelo">${ic("transcricao")}Começar do modelo pronto</button></div>
            <textarea class="campo pro-html" id="pro-html" rows="16" spellcheck="false" placeholder="Cole aqui o HTML do e-mail">${esc(pro.html)}</textarea>
            <p class="ajuda">O que estiver aqui é exatamente o que sai. <code>{{nome}}</code> e <code>{{marca}}</code> continuam funcionando. Deixe o rodapé do SAIR no texto.</p>`}
        </div>

        <div class="cartao" id="pro-enviar"></div>
      </div>

      <div class="pro-previa-coluna">
        <div class="pro-previa-topo"><b>Como vai chegar</b><span class="espaco"></span><button class="btn pequeno" type="button" id="pro-tela-cheia">${ic("olho")}Ver em tela cheia</button></div>
        <div class="pro-palco">
          <div class="pro-janela-email">
            <div class="pro-email-cabeca">
              <span class="pro-avatar">R</span>
              <div><strong id="pro-previa-assunto"></strong><small>Ryan Alves &lt;${esc(EMAIL_PROPOSTAS)}&gt; para você</small></div>
            </div>
            <iframe id="pro-previa" title="Prévia do e-mail" sandbox="allow-popups"></iframe>
          </div>
        </div>
        <p class="sub pro-lembrete">Antes de disparar, mande o teste pra você e abra no celular.</p>
      </div>
    </div>

    <div class="cartao pro-historico">
      <div class="barra"><h2 style="margin:0">Histórico de envios</h2><span class="espaco"></span>
        <div class="busca">${ic("busca")}<input type="search" id="pro-busca" placeholder="Buscar por e-mail" value="${esc(pro.buscaHist)}" aria-label="Buscar no histórico"></div>
        <button class="btn" type="button" id="pro-optout">${ic("fechar")}Descadastrar um e-mail</button></div>
      <div class="tabela-caixa"><table><thead><tr><th>Para</th><th>Assunto</th><th>Quando</th><th>Situação</th></tr></thead><tbody id="pro-hist"></tbody></table></div>
    </div>`;

  const exemplo = () => (destinatariosDe(pro.publico === "teste" ? "todas" : pro.publico).lista[0]) || { nome: "Natura", marca: "Natura" };
  const pintarPrevia = () => {
    const d = exemplo();
    $("#pro-previa-assunto").textContent = assuntoPara(d) || "(sem assunto)";
    $("#pro-previa").srcdoc = preencherChaves(htmlAtual(), d.nome, d.marca) || `<p style="font-family:Arial;color:#888;padding:20px">Cole o HTML do e-mail para ver a prévia.</p>`;
  };
  const pintarContagem = () => {
    const r = destinatariosDe(pro.publico);
    const fora = [];
    if (r.semEmail) fora.push(`${plural(r.semEmail, "ficou", "ficaram")} de fora por não ter e-mail`);
    if (r.repetidos) fora.push(`${plural(r.repetidos, "e-mail repetido", "e-mails repetidos")} (vai uma vez só)`);
    if (r.descadastrados) fora.push(`${plural(r.descadastrados, "descadastrada", "descadastradas")}`);
    if (r.jaReceberam) fora.push(`${plural(r.jaReceberam, "já recebeu", "já receberam")} este assunto`);
    $("#pro-contagem").innerHTML = pro.publico === "selecionadas" && !r.total
      ? `<div class="pro-alerta">Nenhuma marca selecionada ainda. Marque as caixinhas na aba Marcas.<button class="btn pequeno primario" type="button" data-ir-aba="marcas">${ic("marcas")}Selecionar marcas</button></div>`
      : `<strong>${pro.publico === "teste" ? "1 e-mail, só pra você" : plural(r.lista.length, "marca vai receber", "marcas vão receber")}</strong>${fora.length ? `<small>${fora.join(" · ")}</small>` : ""}`;
    $$("[data-ir-aba]", $("#pro-contagem")).forEach((b) => b.onclick = () => irPara(b.dataset.irAba));
    pintarEnviar(r);
  };
  const pintarEnviar = (r = destinatariosDe(pro.publico)) => {
    const caixa = $("#pro-enviar");
    if (pro.envio === "rascunho") { pintarFila(caixa, r); return; }
    const assinatura = pro.envio + "|" + pro.assunto + "|" + htmlAtual();
    const testado = pro.testeFeito === assinatura;
    if (pro.envio === "gmail") {
      const sobra = Math.max(0, LIMITE_GMAIL_DIA - enviadosHojeGmail());
      const vai = Math.min(sobra, r.lista.length);
      caixa.innerHTML = `<h3 class="pro-titulo">3. Enviar pelo seu Gmail</h3>
        ${gmailConectado() ? "" : `<div class="pro-alerta">O Gmail ainda está conectando. Espere alguns segundos ou abra a aba Propostas.</div>`}
        <div class="pro-acoes">
          <button class="btn" type="button" id="pro-teste">${ic("email")}Enviar teste pra mim</button>
          <button class="btn primario" type="button" id="pro-disparar" ${!testado || !vai || pro.publico === "teste" || !gmailConectado() ? "disabled" : ""}>${ic("subir")}Disparar para ${plural(vai, "marca", "marcas")}</button>
        </div>
        <p class="ajuda">${testado ? "Teste enviado. Confira no celular e, se estiver tudo certo, pode disparar." : "Mande o teste pra você primeiro. O botão de disparar libera depois do teste."}
          Hoje ainda dá pra mandar <b>${num(sobra)} de ${LIMITE_GMAIL_DIA}</b>${r.lista.length > sobra ? `, então ${plural(r.lista.length - sobra, "marca fica", "marcas ficam")} pra amanhã` : ""}. Os e-mails saem com pausa de alguns segundos entre um e outro, como se fosse você mandando.</p>
        <div id="pro-progresso"></div>`;
      $("#pro-teste").onclick = enviarTesteGmail;
      $("#pro-disparar").onclick = () => dispararGmail(destinatariosDe(pro.publico));
      return;
    }
    caixa.innerHTML = `<h3 class="pro-titulo">3. Enviar</h3>
      <div class="pro-acoes">
        <button class="btn" type="button" id="pro-teste">${ic("email")}Enviar teste pra mim</button>
        <button class="btn primario" type="button" id="pro-disparar" ${!testado || !r.lista.length || pro.publico === "teste" ? "disabled" : ""}>${ic("subir")}Disparar para ${plural(r.lista.length, "marca", "marcas")}</button>
      </div>
      <p class="ajuda">${testado ? "Teste enviado. Confira no celular e, se estiver tudo certo, pode disparar." : "Mande o teste pra você primeiro. O botão de disparar libera depois do teste."}</p>
      <div id="pro-progresso"></div>`;
    $("#pro-teste").onclick = enviarTeste;
    $("#pro-disparar").onclick = () => disparar(destinatariosDe(pro.publico));
  };
  const pintarHistorico = () => {
    const q = pro.buscaHist.trim().toLowerCase();
    if (!pro.envios) { $("#pro-hist").innerHTML = `<tr><td colspan="4"><p class="vazio">O histórico aparece depois de rodar o disparo.sql.</p></td></tr>`; return; }
    const l = pro.envios.filter((x) => !q || x.email.toLowerCase().includes(q));
    $("#pro-hist").innerHTML = l.length ? l.slice(0, 300).map((x) => `<tr>
        <td>${esc(x.email)}</td><td class="corta" title="${esc(x.assunto)}">${esc(x.assunto)}</td>
        <td style="white-space:nowrap">${new Date(x.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
        <td>${x.status === "ok" ? `<span class="pilula p-cliente">${x.via === "gmail" ? "Enviado pelo Gmail" : "Enviado"}</span>` : `<span class="pilula p-parada" title="${esc(x.erro || "")}">Erro</span> <small class="sub">${esc((x.erro || "").slice(0, 80))}</small>`}</td></tr>`).join("")
      : `<tr><td colspan="4"><p class="vazio">${pro.envios.length ? "Nenhum envio com esse e-mail." : "Nenhum e-mail enviado ainda."}</p></td></tr>`;
  };

  pintarPrevia(); pintarContagem(); pintarHistorico();

  // Eventos
  $$("[data-envio]", el).forEach((b) => b.onclick = () => { pro.envio = b.dataset.envio; guardarRascunho(); desenhar(); });
  $$("[data-escrita]", el).forEach((b) => b.onclick = () => {
    pro.escrita = b.dataset.escrita;
    if (pro.escrita === "html" && !pro.html.trim()) pro.html = montarEmailHTML(pro);
    guardarRascunho(); desenhar();
  });
  $("#pro-publico").onchange = (e) => { pro.publico = e.target.value; pintarPrevia(); pintarContagem(); };
  $("#pro-pular").onchange = (e) => { pro.pularRepetidos = e.target.checked; pintarContagem(); };
  const aoDigitar = (id, campo) => { const i = $(id, el); if (i) i.addEventListener("input", () => { pro[campo] = i.value; guardarRascunho(); pintarPrevia(); pintarContagem(); }); };
  aoDigitar("#pro-assunto", "assunto"); aoDigitar("#pro-texto", "texto"); aoDigitar("#pro-html", "html"); aoDigitar("#pro-btxt", "botaoTexto"); aoDigitar("#pro-blink", "botaoLink");
  if ($("#pro-modelo")) $("#pro-modelo").onclick = async () => {
    if (pro.html.trim() && !(await confirmar("Trocar o HTML que está no campo pelo modelo pronto?", "Sim, trocar"))) return;
    pro.html = montarEmailHTML(pro); guardarRascunho(); desenhar();
  };
  $("#pro-tela-cheia").onclick = () => {
    const d = exemplo();
    const c = document.createElement("dialog"); c.className = "pro-cheia";
    c.innerHTML = `<div class="janela-topo"><h3>${esc(assuntoPara(d))}</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div><iframe title="E-mail em tela cheia" sandbox="allow-popups"></iframe>`;
    document.body.appendChild(c);
    $("iframe", c).srcdoc = preencherChaves(htmlAtual(), d.nome, d.marca);
    const fim = () => { c.close(); c.remove(); };
    $("[data-fechar]", c).onclick = fim;
    c.addEventListener("click", (e) => { if (e.target === c) fim(); });
    c.addEventListener("cancel", (e) => { e.preventDefault(); fim(); });
    c.showModal();
  };
  $("#pro-busca").addEventListener("input", (e) => { pro.buscaHist = e.target.value; pintarHistorico(); });
  $("#pro-optout").onclick = () => abrirForm({
    titulo: "Descadastrar um e-mail",
    campos: [{ n: "email", r: "E-mail que não deve receber mais", t: "email", req: true, inteiro: true }],
    aoSalvar: async (dd) => {
      const email = String(dd.email || "").trim().toLowerCase();
      if (!email.includes("@")) { avisar("Coloque um e-mail válido.", true); return false; }
      const { error } = await db.from("email_optout").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
      if (error) { avisar(traduzErro(error), true); return false; }
      setTimeout(() => carregarProspeccao(true), 200);
      return true;
    }
  });
}

/* ---------- Envio pelo Resend ---------- */
async function chamarCarteiro(corpo) {
  const { data, error } = await db.functions.invoke("enviar-emails", { body: corpo });
  if (error) {
    let msg = "O carteiro (enviar-emails) não respondeu. Confira se ele foi criado no Supabase.";
    try { const j = await error.context.json(); if (j && j.erro) msg = j.erro; } catch (_) {}
    throw new Error(msg);
  }
  if (data && data.erro) throw new Error(data.erro);
  return data;
}
function explicarErroResend(t) {
  if (/testing emails|own email|verify a domain|domain is not verified/i.test(t)) return "O Resend só entrega para outras pessoas depois que você verifica um domínio seu. Enquanto isso, use o modo Rascunho.";
  if (/api key is invalid|invalid.*api key/i.test(t)) return "A chave do Resend guardada no Supabase está errada. Gere outra no Resend e cole de novo em RESEND_API_KEY.";
  return t;
}
async function enviarTeste() {
  const b = $("#pro-teste"); b.disabled = true; b.textContent = "Enviando teste...";
  const d = destinatariosDe(pro.publico === "teste" ? "todas" : pro.publico).lista[0] || { nome: "Natura", marca: "Natura" };
  try {
    const r = await chamarCarteiro({ teste: true, assunto: pro.assunto, html: htmlAtual(), destinatarios: [{ email: EMAIL_PROPOSTAS, nome: d.nome, marca: d.marca }] });
    if (r.enviados) { pro.testeFeito = "resend|" + pro.assunto + "|" + htmlAtual(); avisar(`Teste enviado para ${EMAIL_PROPOSTAS}, com o nome "${d.nome}". Abra no celular para conferir.`); }
    else avisar("O teste não saiu: " + explicarErroResend((r.erros || [])[0] || "erro desconhecido"), true);
  } catch (e) { avisar(explicarErroResend(e.message), true); }
  desenhar();
}
function confirmarDisparo(r, nota = "") {
  return new Promise((resolve) => {
    const semSair = pro.escrita === "html" && !/sair/i.test(pro.html);
    const c = document.createElement("dialog");
    c.innerHTML = `<div class="janela-topo"><h3>Confirmar o disparo</h3></div>
      <div class="janela-corpo"><p class="pro-confirma">Vai para <b>${plural(r.lista.length, "marca", "marcas")}</b>, da lista <b>${esc(nomePublico(pro.publico))}</b>, e não dá pra desfazer.</p>
        <p class="sub">Assunto: ${esc(pro.assunto)}</p>
        ${pro.envio === "gmail" ? `<p class="sub">Sai do seu e-mail ${esc(EMAIL_PROPOSTAS)}, um por um.</p>` : ""}
        ${nota ? `<p class="sub">${esc(nota)}</p>` : ""}
        ${semSair ? `<div class="pro-alerta">O seu HTML está sem o rodapé do SAIR. Sem ele a marca não tem como pedir para sair da lista. Use "Começar do modelo pronto" para ter o rodapé.</div>` : ""}</div>
      <div class="janela-pe"><button type="button" class="btn" data-n>Cancelar</button><button type="button" class="btn primario" data-s>${semSair ? "Disparar mesmo assim" : "Sim, disparar"}</button></div>`;
    document.body.appendChild(c);
    const fim = (v) => { c.close(); c.remove(); resolve(v); };
    $("[data-n]", c).onclick = () => fim(false);
    $("[data-s]", c).onclick = () => fim(true);
    c.addEventListener("cancel", (e) => { e.preventDefault(); fim(false); });
    c.showModal(); $("[data-n]", c).focus();
  });
}
async function disparar(r) {
  if (!r.lista.length) return;
  if (!(await confirmarDisparo(r))) return;
  const caixa = $("#pro-progresso"), total = r.lista.length;
  $$("#pro-teste, #pro-disparar").forEach((b) => { b.disabled = true; });
  const soma = { enviados: 0, falharam: 0, pulados: 0, cotaAcabou: false, faltaram: 0, erros: [] };
  const barra = (feitos) => { caixa.innerHTML = `<div class="pro-barra"><i style="width:${Math.round((feitos / total) * 100)}%"></i></div><small class="sub">${num(feitos)} de ${num(total)}</small>`; };
  barra(0);
  try {
    for (let i = 0; i < total; i += 100) {
      const lote = r.lista.slice(i, i + 100);
      const res = await chamarCarteiro({ assunto: pro.assunto, html: htmlAtual(), destinatarios: lote, pularRepetidos: pro.pularRepetidos });
      soma.enviados += res.enviados || 0; soma.falharam += res.falharam || 0; soma.pulados += res.pulados || 0;
      (res.erros || []).forEach((e) => { if (soma.erros.length < 3) soma.erros.push(e); });
      barra(Math.min(total, i + lote.length));
      if (res.cotaAcabou) { soma.cotaAcabou = true; soma.faltaram = (res.faltaram || 0) + Math.max(0, total - i - lote.length); break; }
    }
  } catch (e) { soma.erros.unshift(e.message); }
  await Promise.all([carregarProspeccao(true), recarregar("marcas")]);
  mostrarResumoDisparo(soma, "A cota diária do Resend acabou no meio do disparo.");
}
function mostrarResumoDisparo(soma, motivoParada) {
  const corpo = `<div class="pro-resumo">
      <div><strong>${num(soma.enviados)}</strong><span>enviados</span></div>
      <div><strong>${num(soma.falharam)}</strong><span>falhas</span></div>
      <div><strong>${num(soma.pulados)}</strong><span>pulados</span></div></div>
    ${soma.cotaAcabou ? `<div class="pro-alerta"><b>${esc(motivoParada)}</b> ${plural(soma.faltaram, "marca ficou", "marcas ficaram")} sem receber.
      Volte amanhã, cole o mesmo assunto e o mesmo texto e deixe marcada a caixinha "Pular quem já recebeu este mesmo assunto". Aí ele manda só para quem faltou.</div>` : ""}
    ${soma.erros.length ? `<p class="sub">Motivo das falhas: ${esc(explicarErroResend(soma.erros[0]))}</p>` : ""}
    ${pro.publico === "selecionadas" && S.marcas.some((m) => m.selecionada) ? `<p>Quer limpar a seleção da aba Marcas? Se for mandar para a mesma lista de novo, deixe como está.</p>` : ""}`;
  const pe = pro.publico === "selecionadas" && S.marcas.some((m) => m.selecionada)
    ? `<button type="button" class="btn" data-fechar>Manter a seleção</button><button type="button" class="btn primario" id="pro-limpar-sel">Limpar a seleção</button>`
    : `<button type="button" class="btn primario" data-fechar>Fechar</button>`;
  const d = abrirJanelaSimples("Disparo concluído", corpo, pe);
  if ($("#pro-limpar-sel", d)) $("#pro-limpar-sel", d).onclick = async () => { await limparSelecao(); d.close(); };
}

/* ---------- Envio pelo seu Gmail (sai do seu próprio e-mail) ----------
   Usa a conexão do Gmail que o painel já tem. Manda um por um, com
   pausa de alguns segundos, e no máximo LIMITE_GMAIL_DIA por dia, para
   o Google não achar que é envio em massa. */
const LIMITE_GMAIL_DIA = 50;
function enviadosHojeGmail() {
  const hoje = hojeISO();
  return (pro.envios || []).filter((x) => x.via === "gmail" && x.status === "ok" && isoLocal(new Date(x.criado_em)) === hoje).length;
}
function mensagemGmail(d) {
  const fronteira = "painel-" + Math.random().toString(36).slice(2);
  const b64 = (t) => base64Utf8(t).replace(/(.{76})/g, "$1\r\n");
  return [`From: Ryan Alves <${EMAIL_PROPOSTAS}>`, `To: ${d.email}`, `Subject: ${assuntoMime(assuntoPara(d))}`,
    `List-Unsubscribe: <mailto:${EMAIL_PROPOSTAS}?subject=SAIR>`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${fronteira}"`, "",
    `--${fronteira}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(textoPuroPara(d)),
    `--${fronteira}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(preencherChaves(htmlAtual(), d.nome, d.marca)),
    `--${fronteira}--`, ""].join("\r\n");
}
const mandarPeloGmail = async (d) => (await gmailApi("messages/send", { metodo: "POST", corpo: { raw: base64Url(mensagemGmail(d)) } })).id;

async function enviarTesteGmail() {
  const b = $("#pro-teste"); b.disabled = true; b.textContent = "Enviando teste...";
  const d = destinatariosDe(pro.publico === "teste" ? "todas" : pro.publico).lista[0] || { nome: "Natura", marca: "Natura" };
  try {
    await mandarPeloGmail({ ...d, email: EMAIL_PROPOSTAS });
    pro.testeFeito = "gmail|" + pro.assunto + "|" + htmlAtual();
    avisar(`Teste enviado do seu Gmail para você mesmo, com o nome "${d.nome}". Confira no celular.`);
  } catch (e) { avisar("O teste não saiu: " + e.message, true); }
  desenhar();
}

async function dispararGmail(r) {
  const sobra = Math.max(0, LIMITE_GMAIL_DIA - enviadosHojeGmail());
  const lote = r.lista.slice(0, sobra);
  if (!lote.length) { avisar(`Você já mandou ${LIMITE_GMAIL_DIA} hoje pelo Gmail. Continue amanhã.`, true); return; }
  if (!(await confirmarDisparo({ ...r, lista: lote }, r.lista.length > lote.length ? `As outras ${num(r.lista.length - lote.length)} ficam pra amanhã, por causa do limite de ${LIMITE_GMAIL_DIA} por dia.` : ""))) return;
  const caixa = $("#pro-progresso"), total = lote.length;
  $$("#pro-teste, #pro-disparar").forEach((b) => { b.disabled = true; });
  const soma = { enviados: 0, falharam: 0, pulados: 0, cotaAcabou: false, faltaram: 0, erros: [] };
  const barra = (feitos) => { caixa.innerHTML = `<div class="pro-barra"><i style="width:${Math.round((feitos / total) * 100)}%"></i></div><small class="sub">${num(feitos)} de ${num(total)}. Não feche esta aba até terminar.</small>`; };
  barra(0);
  const ids = [];
  let seguidos = 0;
  for (let i = 0; i < total; i++) {
    const d = lote[i];
    if ((pro.optout || []).some((x) => x.email === d.email)) { soma.pulados++; barra(i + 1); continue; }
    let id = null, erro = null;
    try { id = await mandarPeloGmail(d); } catch (e) { erro = e.message; }
    if (pro.envios) await db.from("email_envios").insert({ email: d.email, assunto: pro.assunto, status: id ? "ok" : "erro", erro: erro && erro.slice(0, 1000), resend_id: id, via: "gmail", marca_id: d.marca_id });
    if (id) { soma.enviados++; seguidos = 0; if (d.marca_id) ids.push(d.marca_id); }
    else { soma.falharam++; seguidos++; if (soma.erros.length < 3) soma.erros.push(erro); }
    barra(i + 1);
    // O Google pediu para parar (limite) ou 3 erros seguidos: para na hora
    if (/429|limit|quota/i.test(erro || "") || seguidos >= 3) { soma.cotaAcabou = true; soma.faltaram = total - i - 1; break; }
    if (i < total - 1) await new Promise((ok) => setTimeout(ok, 4000 + Math.random() * 4000));
  }
  if (ids.length && temCampo("marcas", "email_enviado_em")) await db.from("marcas").update({ email_enviado_em: hojeISO() }).in("id", ids);
  await Promise.all([carregarProspeccao(true), recarregar("marcas")]);
  mostrarResumoDisparo(soma, "O Gmail pediu uma pausa no meio do disparo.");
}

/* ---------- Modo rascunho (plano B, sem Resend) ---------- */
function pintarFila(caixa, r) {
  const fila = r.lista.filter((d) => !pro.filaPulados.includes(d.email));
  if (pro.publico === "teste") { caixa.innerHTML = `<h3 class="pro-titulo">3. Fila de envio</h3><p class="sub">No modo rascunho, escolha uma lista de marcas em "Pra quem vai".</p>`; return; }
  if (!fila.length) {
    caixa.innerHTML = `<h3 class="pro-titulo">3. Fila de envio</h3><p class="vazio">${r.lista.length ? "Você passou por todas da fila." : "Ninguém na fila. Escolha outra lista ou selecione marcas na aba Marcas."}</p>
      ${pro.filaPulados.length ? `<button class="btn" type="button" id="pro-refila">Voltar as ${num(pro.filaPulados.length)} que pulei</button>` : ""}`;
    if ($("#pro-refila")) $("#pro-refila").onclick = () => { pro.filaPulados = []; desenhar(); };
    return;
  }
  const d = fila[0];
  const assunto = assuntoPara(d), texto = textoPuroPara(d);
  const gmail = "https://mail.google.com/mail/?view=cm&fs=1&authuser=" + encodeURIComponent(EMAIL_PROPOSTAS)
    + "&to=" + encodeURIComponent(d.email) + "&su=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(texto);
  caixa.innerHTML = `<div class="barra"><h3 class="pro-titulo" style="margin:0">3. Fila de envio</h3><span class="espaco"></span><span class="etq">1 de ${num(fila.length)}</span></div>
    <div class="pro-fila-item">
      <div class="pro-fila-para"><b>${esc(d.marca)}</b><small>${esc(d.email)}</small></div>
      <p class="pro-fila-assunto">${esc(assunto)}</p>
      <pre class="pro-fila-texto">${esc(texto)}</pre>
    </div>
    <div class="pro-acoes">
      <button class="btn" type="button" id="pro-copiar">${ic("transcricao")}Copiar texto</button>
      <a class="btn" href="${esc(gmail)}" target="_blank" rel="noopener">${ic("email")}Abrir no Gmail</a>
      <button class="btn primario" type="button" id="pro-enviada">${ic("check")}Marcar como enviada</button>
      <button class="btn" type="button" id="pro-pular-um">Pular</button>
    </div>
    <p class="ajuda">Abra no Gmail, confira e clique em Enviar lá. Depois volte aqui e marque como enviada.</p>`;
  $("#pro-copiar").onclick = async () => { try { await navigator.clipboard.writeText(texto); avisar("Texto copiado."); } catch (_) { avisar("Não consegui copiar. Selecione o texto e copie.", true); } };
  $("#pro-pular-um").onclick = () => { pro.filaPulados.push(d.email); desenhar(); };
  $("#pro-enviada").onclick = async () => {
    const b = $("#pro-enviada"); b.disabled = true;
    if (pro.envios) {
      const { error } = await db.from("email_envios").insert({ email: d.email, assunto: pro.assunto, status: "ok", via: "gmail", marca_id: d.marca_id });
      if (error) { avisar(traduzErro(error), true); b.disabled = false; return; }
      pro.envios.unshift({ email: d.email, assunto: pro.assunto, status: "ok", via: "gmail", marca_id: d.marca_id, criado_em: new Date().toISOString() });
    }
    if (temCampo("marcas", "email_enviado_em") && d.marca_id) {
      await db.from("marcas").update({ email_enviado_em: hojeISO() }).eq("id", d.marca_id);
      const m = S.marcas.find((x) => x.id === d.marca_id); if (m) m.email_enviado_em = hojeISO();
    }
    if (!pro.envios || !pro.pularRepetidos) pro.filaPulados.push(d.email);
    avisar(`${d.marca} marcada como enviada.`);
    desenhar();
  };
}

/* ---------- Seleção na aba Marcas ---------- */
async function limparSelecao() {
  const ids = S.marcas.filter((m) => m.selecionada).map((m) => m.id);
  if (!ids.length) return;
  const { error } = await db.from("marcas").update({ selecionada: false }).in("id", ids);
  if (error) { avisar(traduzErro(error), true); return; }
  S.marcas.forEach((m) => { m.selecionada = false; });
  avisar("Seleção limpa.");
  desenhar();
}

/* =============================================================
   CONTATOS DO SITE (aba Portfólio)
   Quem preenche "Bora criar juntos?" ou pede o mídia kit cai aqui,
   separado da lista de marcas. O celular avisa na hora (ajudante
   "lembretes", tipo "contato") e o sino mostra até você abrir.
   ============================================================= */
const lerContatosSite = () => ler("contatos_site", (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }).limit(300) : q));
let contatosNovosNaTela = new Set();

function quadroContatosSite() {
  if (!CAMPOS.contatos_site || !CAMPOS.contatos_site.length) return "";
  const lista = S.contatos_site;
  // O que estava sem ver continua com a etiqueta "Novo" enquanto você estiver na aba
  lista.filter((c) => !c.visto).forEach((c) => contatosNovosNaTela.add(c.id));
  const novos = lista.filter((c) => contatosNovosNaTela.has(c.id)).length;
  const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return `<section class="cartao contatos-site">
    <div class="barra" style="margin-bottom:8px"><h2 style="margin:0">${ic("email")} Contatos pelo site</h2>
      ${novos ? `<span class="pilula p-pendente">${plural(novos, "novo", "novos")}</span>` : ""}
      <span class="espaco"></span><span class="sub">quem preencheu o formulário ou pediu o mídia kit</span></div>
    ${lista.length ? `<div class="contatos-lista">${lista.slice(0, 12).map((c) => {
      const wa = linkWhats(c.whats);
      const assunto = c.tipo === "midia_kit" ? "Meu mídia kit" : "Re: seu contato pelo meu portfólio";
      const gmail = "https://mail.google.com/mail/?view=cm&fs=1&authuser=" + encodeURIComponent(EMAIL_PROPOSTAS) + "&to=" + encodeURIComponent(c.email) + "&su=" + encodeURIComponent(assunto)
        + "&body=" + encodeURIComponent(`Oi, ${String(c.nome).split(" ")[0]}! Tudo bem?\n\n`);
      return `<article class="contato-site ${contatosNovosNaTela.has(c.id) ? "novo" : ""}" data-contato="${esc(c.id)}">
        <div class="contato-topo">
          <span class="pilula ${c.tipo === "midia_kit" ? "p-conversando" : "p-cliente"}">${c.tipo === "midia_kit" ? "Pediu o mídia kit" : "Formulário"}</span>
          ${contatosNovosNaTela.has(c.id) ? `<span class="etq amarela">Novo</span>` : ""}
          <span class="espaco"></span><small class="sub">${quando(c.criado_em)}</small>
        </div>
        <b>${esc(c.nome)}${c.marca ? ` <span class="sub">· ${esc(c.marca)}</span>` : ""}</b>
        <small><a href="mailto:${esc(c.email)}">${esc(c.email)}</a>${c.whats ? ` · ${esc(c.whats)}` : ""}</small>
        ${c.mensagem ? `<p class="contato-msg">${esc(c.mensagem)}</p>` : ""}
        <div class="contato-acoes">
          <a class="btn pequeno primario" href="${esc(gmail)}" target="_blank" rel="noopener">${ic("email")}Responder</a>
          ${wa ? `<a class="btn pequeno" href="${wa}" target="_blank" rel="noopener">${ic("whats")}WhatsApp</a>` : ""}
          <button class="btn pequeno" type="button" data-contato-marca>${ic("marcas")}Salvar como marca</button>
          <button class="icone-btn perigo" type="button" data-contato-apagar aria-label="Apagar contato" title="Apagar contato">${ic("apagar")}</button>
        </div>
      </article>`;
    }).join("")}</div>${lista.length > 12 ? `<p class="sub" style="margin:8px 0 0">e mais ${num(lista.length - 12)} contatos antigos.</p>` : ""}`
    : `<p class="vazio">Quando uma marca preencher o formulário do seu site ou pedir o mídia kit, ela aparece aqui e o seu celular avisa na hora.</p>`}
  </section>`;
}

function ligarContatosSite(el) {
  const caixa = $(".contatos-site", el);
  if (!caixa) return;
  // Abriu a aba: os novos contam como vistos (o sino apaga), mas a etiqueta "Novo" fica até sair da aba
  const naoVistos = S.contatos_site.filter((c) => !c.visto).map((c) => c.id);
  if (naoVistos.length) {
    db.from("contatos_site").update({ visto: true }).in("id", naoVistos).then(({ error }) => {
      if (error) return;
      S.contatos_site.forEach((c) => { if (naoVistos.includes(c.id)) c.visto = true; });
      pintarLembretes();
    });
  }
  caixa.addEventListener("click", async (e) => {
    const art = e.target.closest("[data-contato]");
    if (!art) return;
    const c = S.contatos_site.find((x) => String(x.id) === art.dataset.contato);
    if (e.target.closest("[data-contato-marca]")) {
      formMarca(null, { valores: { nome: c.marca || c.nome, email: c.email, telefone: c.whats || "", situacao: "conversando", ultimo_contato: hojeISO(),
        obs: `Veio pelo site (${c.tipo === "midia_kit" ? "pediu o mídia kit" : "formulário"}). Contato: ${c.nome}.${c.mensagem ? "\n\n" + c.mensagem : ""}`.slice(0, 3000) } });
      return;
    }
    if (e.target.closest("[data-contato-apagar]")) {
      if (!(await confirmar(`Apagar o contato de ${c.nome}?`))) return;
      if (await apagarLinha("contatos_site", c.id)) { S.contatos_site = S.contatos_site.filter((x) => x.id !== c.id); desenhar(); }
    }
  });
}


/* =============================================================
   AGENDA NO IPHONE
   O ajudante "lembretes" monta um calendário chamado "Trabalhos Ryan"
   (gravações, edições, posts, entregas, pagamentos previstos e
   lembretes). O iPhone assina esse calendário uma vez e ele se
   atualiza sozinho, aparecendo junto com os outros calendários.
   ============================================================= */
async function abrirAgendaIphone() {
  const d = abrirJanelaSimples("Calendário no iPhone", `<p class="vazio">Abrindo...</p>`);
  const corpo = $(".janela-corpo", d);
  const pintar = async () => {
    const google = temAgendaGoogle();
    const r = agendaG.ultimo;
    corpo.innerHTML = `
      <div class="agenda-bloco ${google ? "ligado" : ""}">
        <h3>${ic("calendario")} Google Agenda: "Trabalhos" <span class="pilula ${google ? "p-cliente" : "p-pendente"}">${google ? "ligado" : "desligado"}</span></h3>
        <p>Funciona <b>nos dois sentidos</b>: o que você cria aqui aparece no iPhone, e o que você cria no iPhone, no calendário <b>Trabalhos</b>, aparece aqui. Atualiza a cada 5 minutos (e na hora quando você salva no painel).</p>
        ${google ? `
          ${r && !r.pulado ? `<p class="sub">Última conversa com o Google: ${plural((r.trouxe || 0) + (r.mudou || 0), "mudança trazida", "mudanças trazidas")}, ${plural(r.enviou || 0, "enviada", "enviadas")}.</p>` : ""}
          <p><b>No iPhone, uma vez só:</b></p>
          <ol class="passos">
            <li>Abra <b>Ajustes &gt; Apps &gt; Calendário &gt; Contas &gt; Adicionar Conta &gt; Google</b>.</li>
            <li>Entre com <b>${esc(EMAIL_PROPOSTAS)}</b> e deixe <b>Calendários</b> ligado.</li>
            <li>No app Calendário, toque em <b>Calendários</b> e confira que <b>Trabalhos</b> está marcado.</li>
            <li>Para criar pelo iPhone: novo evento &gt; <b>Calendário: Trabalhos</b>. Em até 5 minutos ele aparece aqui.</li>
          </ol>
          <button class="btn" type="button" id="agenda-sinc-agora">${ic("relogio")}Sincronizar agora</button>
          <a class="btn" href="https://calendar.google.com/calendar/u/0/r?authuser=${encodeURIComponent(EMAIL_PROPOSTAS)}" target="_blank" rel="noopener">${ic("link")}Abrir o Google Agenda</a>`
        : `<p>Para ligar, o Google precisa da sua autorização para o Calendário (é a mesma conta do Gmail do painel). Ele vai mostrar uma tela pedindo permissão. Se aparecer <b>"o Google não verificou este app"</b>, toque em <b>Avançado</b> e depois em <b>Acessar Painel Ryan</b>: o app é seu.</p>
           <button class="btn primario" type="button" id="agenda-ligar" style="width:100%;justify-content:center">${ic("calendario")}Ligar o Google Agenda</button>`}
      </div>
      <div class="agenda-bloco">
        <h3>${ic("relogio")} Automático: "Trabalhos Ryan" <span class="pilula p-conversando">só leitura</span></h3>
        <p class="sub">Entregas das campanhas, pagamentos previstos e os seus lembretes, que o painel calcula sozinho.${google ? " Os seus compromissos ficam no calendário Trabalhos, aqui em cima." : " Enquanto o Google Agenda estiver desligado, os compromissos também aparecem aqui."}</p>
        <div id="agenda-assinar"><p class="vazio">Gerando o endereço...</p></div>
      </div>`;
    const ligar = $("#agenda-ligar", corpo);
    if (ligar) ligar.onclick = async () => {
      ligar.disabled = true; ligar.textContent = "Esperando o Google...";
      try { await conectarGmail(); } catch (e) { avisar(e.message, true); pintar(); return; }
      if (!temAgendaGoogle()) { avisar("O Google não liberou o Calendário. Tente de novo e marque a caixinha do Google Agenda.", true); pintar(); return; }
      avisar("Google Agenda ligado! Criando o calendário Trabalhos...");
      await sincronizarAgendaGoogle(true);
      pintar();
    };
    const agora = $("#agenda-sinc-agora", corpo);
    if (agora) agora.onclick = async () => { agora.disabled = true; agora.textContent = "Sincronizando..."; await sincronizarAgendaGoogle(true); avisar("Calendário sincronizado com o Google."); pintar(); };
    const { data, error } = await db.functions.invoke("lembretes", { body: { acao: "agenda-link" } });
    const caixa = $("#agenda-assinar", corpo);
    if (!caixa) return;
    if (error || !data || !data.url) { caixa.innerHTML = `<p class="sub">Não consegui gerar o endereço agora.</p>`; return; }
    const https = data.url, webcal = https.replace(/^https:/, "webcal:");
    caixa.innerHTML = `<a class="btn" href="${esc(webcal)}">${ic("calendario")}Assinar no iPhone</a>
      <button class="btn" type="button" id="copiar-agenda">${ic("transcricao")}Copiar endereço</button>
      <p class="sub" style="margin-top:6px">Abra esta tela no iPhone e toque em Assinar. Ou cole o endereço em Ajustes &gt; Apps &gt; Calendário &gt; Contas &gt; Adicionar Conta &gt; Outra &gt; Adicionar Calendário Assinado. Esse endereço é só seu.</p>`;
    $("#copiar-agenda", caixa).onclick = async () => { try { await navigator.clipboard.writeText(https); avisar("Endereço copiado."); } catch (_) { avisar("Não consegui copiar.", true); } };
  };
  pintar();
}


/* =============================================================
   GOOGLE AGENDA NOS DOIS SENTIDOS
   O ajudante "lembretes" (tipo "google") conversa com o calendário
   "Trabalhos" do Google a cada 5 minutos. Aqui o painel pede essa
   conversa na hora: ao abrir o Calendário e ao salvar ou apagar.
   ============================================================= */
const agendaG = { abriu: false, rodando: false, ultimo: null };
async function sincronizarAgendaGoogle(recarregarDepois) {
  if (agendaG.rodando) return;
  agendaG.rodando = true;
  try {
    const { data } = await db.functions.invoke("lembretes", { body: { tipo: "google" } });
    agendaG.ultimo = data || null;
    if (data && (data.trouxe || data.mudou || data.apagou)) {
      await recarregar("calendario");
      const n = (data.trouxe || 0) + (data.mudou || 0) + (data.apagou || 0);
      avisar(`${plural(n, "compromisso atualizado", "compromissos atualizados")} pelo Google Agenda.`);
    } else if (recarregarDepois && abaAtual === "calendario") desenhar();
  } catch (_) { /* tenta de novo no relógio de 5 minutos */ }
  agendaG.rodando = false;
}


// Roteiros antigos salvos com link curto do TikTok: troca pelo link completo (uma vez por sessão)
async function consertarLinksTiktok() {
  if (trans.tiktokConsertado) return;
  trans.tiktokConsertado = true;
  const curtos = S.transcricoes.filter((t) => t.link && /tiktok\.com/i.test(t.link) && !/\/video\/\d+/.test(t.link));
  let mudou = false;
  for (const t of curtos) {
    const r = await chamarTranscrever({ acao: "resolver", link: t.link });
    if (!r || !r.link || !/\/video\/\d+/.test(r.link)) continue;
    const dados = { link: limparLink(r.link) };
    if (!t.perfil) { const p = perfilDoLink(r.link); if (p) dados.perfil = p; }
    if (await gravar("transcricoes", dados, t.id)) { Object.assign(t, dados); mudou = true; }
  }
  if (mudou && abaAtual === "transcricoes" && !trans.sel) pintarListaTrans();
}

/* =============================================================
   📄 CONTRATOS (contrato padrão em PDF)
   O modelo do seu contrato fica no banco (modelos_contrato), com os
   lugares que mudam marcados como {{campo}}. Aqui você escolhe a
   campanha (opcional), preenche o que falta e baixa o PDF pronto.
   Marcações do modelo:
     # título, ## seção, "- " item de lista, linha em branco = parágrafo
     {{campo}}            valor como foi digitado
     {{campo|extenso}}    7 vira "7 (sete)"   ({{campo|extensof}}: "2 (duas)")
     {{valor|reais}}      1500 vira "R$ 1.500,00 (mil e quinhentos reais)"
     {{data|extenso}}     2026-10-15 vira "15 de outubro de 2026"
     [se:campo] no começo da linha: a linha só aparece se o campo não for vazio nem 0
     [assinaturas]        as linhas de assinatura das duas partes
   ============================================================= */
const ctr = { modelo: null, gerados: [], carregado: false, carregando: false, falta: "", dados: {}, contratoId: "", editando: false };

function numeroExtenso(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "zero";
  const u = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const d = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const c = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const ate999 = (x) => {
    if (!x) return "";
    if (x === 100) return "cem";
    const p = [], ce = Math.floor(x / 100), r = x % 100;
    if (ce) p.push(c[ce]);
    if (r) p.push(r < 20 ? u[r] : d[Math.floor(r / 10)] + (r % 10 ? " e " + u[r % 10] : ""));
    return p.join(" e ");
  };
  const mi = Math.floor(n / 1e6), mil = Math.floor((n % 1e6) / 1000), resto = n % 1000;
  const partes = [];
  if (mi) partes.push(mi === 1 ? "um milhão" : ate999(mi) + " milhões");
  if (mil) partes.push(mil === 1 ? "mil" : ate999(mil) + " mil");
  if (resto) partes.push(ate999(resto));
  if (partes.length > 1 && resto && (resto < 100 || resto % 100 === 0)) return partes.slice(0, -1).join(" ") + " e " + partes[partes.length - 1];
  return partes.join(" ");
}
const extensoF = (n) => numeroExtenso(n).replace(/\bum$/, "uma").replace(/\bdois$/, "duas").replace(/entos\b/g, "entas");
function reaisExtenso(v) {
  const t = String(v).trim();
  const total = Math.round((Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0) * 100);
  const inteiro = Math.floor(total / 100), cent = total % 100;
  const fmt = (total / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let ext = inteiro ? `${numeroExtenso(inteiro)}${inteiro % 1e6 === 0 && inteiro >= 1e6 ? " de" : ""} ${inteiro === 1 ? "real" : "reais"}` : "";
  if (cent) ext += `${ext ? " e " : ""}${numeroExtenso(cent)} ${cent === 1 ? "centavo" : "centavos"}`;
  return `R$ ${fmt} (${ext || "zero reais"})`;
}
const dataPorExtenso = (iso) => { const d = deISO(String(iso).slice(0, 10)); return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`; };

// Troca os {{campos}} e devolve o texto pronto + a lista do que ficou em branco
function preencherContrato(texto, dados, campos) {
  const faltando = new Set();
  const vazio = (v) => v == null || String(v).trim() === "";
  const valorDe = (id, mod) => {
    const v = dados[id];
    if (vazio(v)) { faltando.add(id); return `⟦${(campos.find((c) => c.id === id) || {}).rotulo || id}⟧`; }
    if (id === "data") return dataPorExtenso(v);
    if (mod === "extenso") return `${v} (${numeroExtenso(v)})`;
    if (mod === "extensof") return `${v} (${extensoF(v)})`;
    if (mod === "reais") return reaisExtenso(v);
    return String(v).trim();
  };
  const linhas = String(texto || "").split("\n").filter((l) => {
    const m = l.match(/^\[se:([a-z0-9_]+)\]\s?/i);
    if (!m) return true;
    const v = dados[m[1]];
    return !vazio(v) && String(v).trim() !== "0";
  }).map((l) => l.replace(/^\[se:[a-z0-9_]+\]\s?/i, ""));
  const pronto = linhas.join("\n").replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|\s*([a-z]+))?\s*\}\}/gi, (_, id, mod) => valorDe(id, mod));
  return { texto: pronto, faltando: [...faltando] };
}

// Texto do modelo vira blocos: título, seção, parágrafo, lista, assinaturas
function blocosContrato(texto) {
  const blocos = [];
  let par = [], lista = [];
  const fechar = () => {
    if (par.length) { blocos.push({ tipo: "par", linhas: par }); par = []; }
    if (lista.length) { blocos.push({ tipo: "lista", itens: lista }); lista = []; }
  };
  String(texto).split("\n").forEach((bruta) => {
    const l = bruta.trim();
    if (!l) { fechar(); return; }
    if (l === "[assinaturas]") { fechar(); blocos.push({ tipo: "assinaturas" }); return; }
    if (l.startsWith("## ")) { fechar(); blocos.push({ tipo: "secao", texto: l.slice(3) }); return; }
    if (l.startsWith("# ")) { fechar(); blocos.push({ tipo: "titulo", texto: l.slice(2) }); return; }
    if (/^[-–•]\s/.test(l)) { if (par.length) { blocos.push({ tipo: "par", linhas: par }); par = []; } lista.push(l.replace(/^[-–•]\s/, "")); return; }
    if (lista.length) { blocos.push({ tipo: "lista", itens: lista }); lista = []; }
    par.push(l);
  });
  fechar();
  return blocos;
}

function htmlContrato(texto, dados) {
  const marcar = (t) => esc(t).replace(/⟦([^⟧]+)⟧/g, '<mark class="ctr-falta">[$1]</mark>')
    .replace(/^([^:]{2,40}):\s/, "<b>$1:</b> ");
  return blocosContrato(texto).map((b) => {
    if (b.tipo === "titulo") return `<h1>${marcar(b.texto)}</h1>`;
    if (b.tipo === "secao") return `<h2>${marcar(b.texto)}</h2>`;
    if (b.tipo === "lista") return `<ul>${b.itens.map((i) => `<li>${marcar(i)}</li>`).join("")}</ul>`;
    if (b.tipo === "assinaturas") return `<div class="ctr-assinaturas">
      <div><span></span><b>CONTRATADA</b><small>Ryan Alves Cavalcanti</small></div>
      <div><span></span><b>CONTRATANTE</b><small>${esc(dados.razao_social || "")}${dados.representante ? `<br>${esc(dados.representante)}` : ""}</small></div></div>`;
    return `<p>${b.linhas.map(marcar).join("<br>")}</p>`;
  }).join("");
}

/* ---------- PDF (pdfmake, carregado só quando precisa) ---------- */
let leitorPdf = null;
function carregarPdfmake() {
  if (window.pdfMake && window.pdfMake.vfs) return Promise.resolve(window.pdfMake);
  const script = (src) => new Promise((ok, falha) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => falha(new Error("Não consegui abrir o gerador de PDF. Confira a internet.")); document.head.appendChild(s); });
  if (!leitorPdf) leitorPdf = script("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js")
    .then(() => script("https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js")).then(() => window.pdfMake)
    .catch((e) => { leitorPdf = null; throw e; });
  return leitorPdf;
}
async function baixarPdfContrato(texto, dados) {
  const pdfMake = await carregarPdfmake();
  const negritoRotulo = (t) => { const m = t.match(/^([^:]{2,40}):\s(.*)$/); return m ? [{ text: m[1] + ": ", bold: true }, { text: m[2] }] : t; };
  const content = [];
  blocosContrato(texto).forEach((b) => {
    if (b.tipo === "titulo") content.push({ text: b.texto, fontSize: 13, bold: true, alignment: "center", margin: [0, 0, 0, 16] });
    else if (b.tipo === "secao") content.push({ text: b.texto, fontSize: 11, bold: true, margin: [0, 12, 0, 5] });
    else if (b.tipo === "lista") content.push({ ul: b.itens, margin: [6, 0, 0, 6], alignment: "justify" });
    else if (b.tipo === "assinaturas") content.push({
      margin: [0, 46, 0, 0], columnGap: 40, unbreakable: true,
      columns: [
        { stack: [{ canvas: [{ type: "line", x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8 }] }, { text: "CONTRATADA", bold: true, margin: [0, 4, 0, 0] }, { text: "Ryan Alves Cavalcanti", fontSize: 9 }] },
        { stack: [{ canvas: [{ type: "line", x1: 0, y1: 0, x2: 210, y2: 0, lineWidth: 0.8 }] }, { text: "CONTRATANTE", bold: true, margin: [0, 4, 0, 0] }, { text: [dados.razao_social, dados.representante].filter(Boolean).join("\n"), fontSize: 9 }] }
      ]
    });
    else content.push({ stack: b.linhas.map(negritoRotulo).map((t) => ({ text: t, alignment: "justify" })), margin: [0, 0, 0, 6] });
  });
  const doc = {
    pageSize: "A4", pageMargins: [58, 56, 58, 56], content,
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.3 },
    footer: (pag, total) => ({ text: `Página ${pag} de ${total}`, alignment: "center", fontSize: 8, color: "#888", margin: [0, 18, 0, 0] }),
    info: { title: `Contrato ${dados.razao_social || ""}`.trim(), author: "Ryan Alves" }
  };
  const nome = `Contrato - ${String(dados.razao_social || "marca").replace(/[\\/:*?"<>|]+/g, "").trim()} - ${dataBR(dados.data || hojeISO()).replace(/\//g, "-")}.pdf`;
  pdfMake.createPdf(doc).download(nome);
}

/* ---------- Dados ---------- */
async function carregarContratoPadrao(forcar) {
  if (ctr.carregando || (ctr.carregado && !forcar)) return;
  ctr.carregando = true;
  const [m, g] = await Promise.all([
    db.from("modelos_contrato").select("*").order("id").limit(1),
    db.from("contratos_gerados").select("*").order("criado_em", { ascending: false }).limit(50)
  ]);
  ctr.falta = m.error || g.error ? "Falta rodar a parte 26 do banco.sql no Supabase." : "";
  ctr.modelo = (m.data || [])[0] || null;
  ctr.gerados = g.data || [];
  ctr.carregando = false; ctr.carregado = true;
  if (abaAtual === "contrato") desenhar();
}
function camposDoModelo() {
  const m = ctr.modelo; if (!m) return [];
  const lista = Array.isArray(m.campos) ? m.campos.slice() : [];
  // Campo novo escrito no texto e ainda sem formulário: entra como texto simples
  [...String(m.texto).matchAll(/\{\{\s*([a-z0-9_]+)/gi), ...String(m.texto).matchAll(/\[se:([a-z0-9_]+)\]/gi)].forEach(([, id]) => {
    if (!lista.some((c) => c.id === id)) lista.push({ id, rotulo: id.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()) });
  });
  return lista;
}
function dadosPadrao() {
  const d = {};
  camposDoModelo().forEach((c) => { d[c.id] = c.padrao === "hoje" ? hojeISO() : (c.padrao ?? ""); });
  return d;
}
// Campanha escolhida: preenche o que dá (marca, valor, vídeos, prazo de pagamento, e-mail da marca)
function dadosDaCampanha(c) {
  const d = {};
  if (!c) return d;
  d.razao_social = c.cliente || "";
  if (n2(c.valor)) d.valor = String(n2(c.valor));
  if (n2(c.qtd)) d.qtd_videos = String(n2(c.qtd));
  if (c.prazo_dias != null && c.prazo_dias !== "") d.prazo_pagamento = String(c.prazo_dias);
  const chave = semAcento(c.cliente || "");
  const marca = S.marcas.find((m) => semAcento(m.nome || "") === chave) || S.marcas.find((m) => chave && semAcento(m.nome || "").includes(chave));
  if (marca && primeiroEmail(marca)) d.email = primeiroEmail(marca);
  return d;
}

/* ---------- A tela ---------- */
function desenharContratoPadrao(el) {
  if (!ctr.carregado) { carregarContratoPadrao(); el.innerHTML = `<p class="vazio">Abrindo o seu contrato...</p>`; return; }
  if (ctr.falta) { el.innerHTML = `<div class="aviso-falta">${esc(ctr.falta)}</div>`; return; }
  if (!ctr.modelo) { el.innerHTML = `<div class="cartao"><h2>📄 Nenhum modelo de contrato ainda</h2><p class="sub">Mande o seu contrato para o Claude transformar em modelo.</p></div>`; return; }
  if (ctr.editando) { desenharEditorModelo(el); return; }
  const campos = camposDoModelo();
  if (!Object.keys(ctr.dados).length) ctr.dados = dadosPadrao();
  const campanhas = S.contratos.filter((c) => c.cliente).slice().sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 80);
  const tipoInput = (c) => c.tipo === "numero" ? 'type="number" min="0" step="1" inputmode="numeric"' : c.tipo === "dinheiro" ? 'type="number" min="0" step="0.01" inputmode="decimal"' : c.tipo === "data" ? 'type="date"' : c.tipo === "email" ? 'type="email"' : 'type="text"';

  el.innerHTML = `
    <section class="cartao ctr-topo">
      <div><h2 class="rot-titulo">📄 Contratos</h2>
        <p class="rot-frase">Escolha a campanha, preencha o que falta e baixe o seu contrato pronto em PDF. Nada fica para trás: o que estiver em branco aparece em amarelo.</p></div>
      <button class="btn" type="button" id="ctr-editar">✏️ Editar o modelo</button>
    </section>
    <div class="pro-grade">
      <div class="pro-form">
        <div class="cartao">
          <h3 class="pro-titulo">1. De qual campanha? (opcional)</h3>
          <select class="campo" id="ctr-campanha" style="width:100%">
            <option value="">Não tem campanha cadastrada, vou preencher tudo</option>
            ${campanhas.map((c) => `<option value="${esc(c.id)}" ${String(ctr.contratoId) === String(c.id) ? "selected" : ""}>${esc(c.cliente)}${c.descricao ? " · " + esc(c.descricao) : ""}${n2(c.valor) ? " · " + real(c.valor) : ""} (${esc(c.status || "")})</option>`).join("")}
          </select>
          <p class="ajuda">Preenche sozinho a marca, o valor, a quantidade de vídeos, o prazo de pagamento e o e-mail (se a marca estiver na aba Marcas).</p>
        </div>
        <div class="cartao">
          <h3 class="pro-titulo">2. Dados do contrato</h3>
          <div class="ctr-campos">
            ${campos.map((c) => `<label class="${["razao_social", "email", "forma_pagamento", "duracao"].includes(c.id) ? "largo" : ""}">${esc(c.rotulo)}${c.obrigatorio ? " *" : ""}
              <input class="campo" data-campo="${esc(c.id)}" ${tipoInput(c)} value="${esc(ctr.dados[c.id] ?? "")}" placeholder="${esc(c.ph || "")}"></label>`).join("")}
          </div>
        </div>
        <div class="cartao">
          <h3 class="pro-titulo">3. Baixar</h3>
          <div id="ctr-falta" class="ctr-faltando"></div>
          <div class="pro-acoes">
            <button class="btn primario" type="button" id="ctr-pdf">📄 Gerar PDF</button>
            <button class="btn" type="button" id="ctr-limpar">🧹 Limpar</button>
          </div>
        </div>
      </div>
      <div class="pro-previa-coluna">
        <div class="pro-previa-topo"><b>Como vai ficar</b></div>
        <div class="pro-palco"><article class="ctr-papel" id="ctr-previa"></article></div>
      </div>
    </div>
    <div class="cartao">
      <h2>🗂️ Contratos gerados</h2>
      ${ctr.gerados.length ? `<div class="tabela-caixa"><table><thead><tr><th>Marca</th><th>Valor</th><th>Gerado em</th><th></th></tr></thead><tbody>
        ${ctr.gerados.map((g) => `<tr><td><b>${esc(g.marca || (g.dados || {}).razao_social || "")}</b></td><td>${(g.dados || {}).valor ? real((g.dados || {}).valor) : ""}</td>
          <td>${new Date(g.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          <td style="white-space:nowrap"><button class="btn pequeno" type="button" data-ctr-baixar="${esc(g.id)}">⬇️ Baixar de novo</button> <button class="btn pequeno" type="button" data-ctr-usar="${esc(g.id)}">📋 Usar como base</button></td></tr>`).join("")}
      </tbody></table></div>` : `<p class="vazio">Os contratos que você gerar aparecem aqui, para baixar de novo quando precisar.</p>`}
    </div>`;

  const pintar = () => {
    const { texto, faltando } = preencherContrato(ctr.modelo.texto, ctr.dados, campos);
    $("#ctr-previa").innerHTML = htmlContrato(texto, ctr.dados);
    const obrig = faltando.filter((id) => (campos.find((c) => c.id === id) || {}).obrigatorio !== false);
    $("#ctr-falta").innerHTML = obrig.length
      ? `<div class="pro-alerta">⚠️ Falta preencher: <b>${obrig.map((id) => esc((campos.find((c) => c.id === id) || { rotulo: id }).rotulo)).join(", ")}</b></div>`
      : `<div class="rot-aviso-caixa ok">✅ Tudo preenchido. Pode gerar o PDF.</div>`;
    $$("[data-campo]", el).forEach((i) => i.classList.toggle("ctr-vazio", faltando.includes(i.dataset.campo) && (campos.find((c) => c.id === i.dataset.campo) || {}).obrigatorio !== false));
    return { texto, obrig };
  };
  pintar();

  $$("[data-campo]", el).forEach((i) => i.addEventListener("input", () => { ctr.dados[i.dataset.campo] = i.value; pintar(); }));
  $("#ctr-campanha").onchange = (e) => {
    ctr.contratoId = e.target.value;
    const c = S.contratos.find((x) => String(x.id) === e.target.value);
    ctr.dados = { ...dadosPadrao(), ...dadosDaCampanha(c) };
    desenhar();
  };
  $("#ctr-limpar").onclick = () => { ctr.dados = dadosPadrao(); ctr.contratoId = ""; desenhar(); };
  $("#ctr-editar").onclick = () => { ctr.editando = true; desenhar(); };
  $("#ctr-pdf").onclick = async () => {
    const { texto, obrig } = pintar();
    if (obrig.length && !(await confirmar(`Ainda falta preencher ${obrig.length === 1 ? "1 campo" : obrig.length + " campos"} (em amarelo). Gerar o PDF assim mesmo?`, "Gerar assim mesmo"))) return;
    const b = $("#ctr-pdf"); b.disabled = true; b.textContent = "Gerando...";
    try {
      await baixarPdfContrato(texto, ctr.dados);
      const { data } = await db.from("contratos_gerados").insert({ modelo_id: ctr.modelo.id, contrato_id: Number(ctr.contratoId) || null, marca: ctr.dados.razao_social || null, dados: ctr.dados }).select().single();
      if (data) ctr.gerados.unshift(data);
      avisar("Contrato gerado. O PDF foi para a pasta Downloads.");
      desenhar();
    } catch (e) { avisar(e.message || "Não deu para gerar o PDF.", true); b.disabled = false; b.textContent = "📄 Gerar PDF"; }
  };
  el.querySelector(".cartao:last-child").addEventListener("click", async (e) => {
    const baixar = e.target.closest("[data-ctr-baixar]"), usar = e.target.closest("[data-ctr-usar]");
    const g = ctr.gerados.find((x) => String(x.id) === (baixar || usar || {}).dataset?.[baixar ? "ctrBaixar" : "ctrUsar"]);
    if (!g) return;
    if (baixar) { try { await baixarPdfContrato(preencherContrato(ctr.modelo.texto, g.dados || {}, campos).texto, g.dados || {}); } catch (err) { avisar(err.message, true); } return; }
    ctr.dados = { ...dadosPadrao(), ...(g.dados || {}), data: hojeISO() }; ctr.contratoId = g.contrato_id || ""; desenhar(); window.scrollTo({ top: 0 });
  });
}

function desenharEditorModelo(el) {
  el.innerHTML = `
    <div class="barra"><button class="btn" type="button" id="ctr-voltar">${ic("esq")}Voltar</button><span class="espaco"></span>
      <button class="btn primario" type="button" id="ctr-salvar-modelo">💾 Salvar o modelo</button></div>
    <div class="cartao">
      <h2>✏️ Texto do seu contrato</h2>
      <p class="sub">Mude o que quiser. Os lugares que mudam a cada marca ficam entre chaves duplas, como <code>{{razao_social}}</code>. Se você criar um campo novo, ex. <code>{{produto}}</code>, ele aparece sozinho no formulário.</p>
      <details class="agenda-manual"><summary>Como funcionam as marcações</summary>
        <ul class="passos">
          <li><code># </code> no começo da linha: título. <code>## </code>: título de seção. <code>- </code>: item de lista.</li>
          <li><code>{{campo|extenso}}</code>: o número vem por extenso, ex. 7 (sete). <code>{{campo|extensof}}</code>: no feminino, ex. 2 (duas).</li>
          <li><code>{{valor|reais}}</code>: R$ 1.500,00 (mil e quinhentos reais). <code>{{data|extenso}}</code>: 15 de outubro de 2026.</li>
          <li><code>[se:qtd_fotos]</code> no começo da linha: a linha só aparece se o campo tiver valor (e não for 0).</li>
          <li><code>[assinaturas]</code>: as linhas para as duas assinaturas.</li>
        </ul></details>
      <textarea class="campo ctr-editor" id="ctr-texto" spellcheck="false">${esc(ctr.modelo.texto)}</textarea>
    </div>`;
  $("#ctr-voltar").onclick = () => { ctr.editando = false; desenhar(); };
  $("#ctr-salvar-modelo").onclick = async () => {
    const texto = $("#ctr-texto").value;
    if (!texto.trim()) { avisar("O modelo não pode ficar vazio.", true); return; }
    const { error } = await db.from("modelos_contrato").update({ texto, atualizado_em: new Date().toISOString() }).eq("id", ctr.modelo.id);
    if (error) { avisar(traduzErro(error), true); return; }
    ctr.modelo.texto = texto; ctr.editando = false; avisar("Modelo salvo."); desenhar();
  };
}

/* =============================================================
   INSTAGRAM: ESTRATÉGIA
   A aba Instagram ganhou 4 partes:
     📊 Métricas        (o que já existia)
     🔥 Reels da semana  os 30 reels com mais views do seu nicho (Apify, grátis)
     🧭 Plano da semana  pesquisa de mercado + o que postar (pedido pronto para o Claude)
     🎨 Carrossel        o seu sistema visual e o gerador de imagens
   ============================================================= */
const igx = { sub: "metricas", pesq: null, reels: null, buscando: false, timer: null, planos: null, semanaVista: "", carrosseis: null, car: null };
try { igx.sub = localStorage.getItem("ig-sub") || "metricas"; } catch (_) {}
const SUBS_IG = [["metricas", "📊 Métricas"], ["reels", "🔥 Reels da semana"], ["plano", "🧭 Plano da semana"], ["carrossel", "🎨 Carrossel"]];

function segundaISO(base) {
  const d = base ? deISO(base) : new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoLocal(d);
}

function desenharInstagram(el) {
  if (!SUBS_IG.some(([k]) => k === igx.sub)) igx.sub = "metricas";
  el.innerHTML = `<div class="chips ig-subs" role="tablist" aria-label="Partes do Instagram">${SUBS_IG.map(([k, n]) => `<button class="chip" type="button" role="tab" data-ig-sub="${k}" aria-pressed="${igx.sub === k}">${n}</button>`).join("")}</div><div id="ig-corpo"></div>`;
  $$("[data-ig-sub]", el).forEach((b) => b.onclick = () => {
    igx.sub = b.dataset.igSub;
    try { localStorage.setItem("ig-sub", igx.sub); } catch (_) {}
    desenhar();
  });
  const corpo = $("#ig-corpo", el);
  if (igx.sub !== "reels" && igx.timer) { clearTimeout(igx.timer); igx.timer = null; }
  if (igx.sub === "reels") return desenharReelsSemana(corpo);
  if (igx.sub === "plano") return desenharPlanoSemana(corpo);
  if (igx.sub === "carrossel") return desenharCarrossel(corpo);
  return desenharMetricasInstagram(corpo);
}

/* ---------- 🔥 Reels da semana ---------- */
async function chamarTendencias(corpo) {
  const { data, error } = await db.functions.invoke("tendencias", { body: corpo });
  if (error) {
    const st = error.context && error.context.status;
    throw new Error(st === 404 ? "O ajudante \"tendencias\" ainda não foi publicado no Supabase." : "O ajudante de tendências não respondeu. Tente de novo em instantes.");
  }
  return data || {};
}
async function carregarReels() {
  const { data, error } = await db.from("ig_reels").select("*").order("semana", { ascending: false }).order("views", { ascending: false }).limit(300);
  if (error) { igx.reels = []; igx.faltaBanco = true; return; }
  igx.faltaBanco = false;
  igx.reels = data || [];
}
async function atualizarPesquisa(acao) {
  try {
    const r = await chamarTendencias({ acao: acao || "status" });
    igx.pesq = r;
    if (r.guardados) { await carregarReels(); avisar(`Pronto! ${r.guardados} reels guardados.`); }
    if (acao === "buscar" && r.erro && !r.semChave) avisar(r.erro, true);
  } catch (e) { igx.pesq = { erro: e.message }; }
  if (abaAtual === "instagram" && igx.sub === "reels") desenhar();
  // Enquanto o Apify trabalha, confere de 15 em 15 segundos
  clearTimeout(igx.timer); igx.timer = null;
  if (igx.pesq && igx.pesq.rodando && abaAtual === "instagram" && igx.sub === "reels") igx.timer = setTimeout(() => atualizarPesquisa(), 15000);
}

function desenharReelsSemana(el) {
  if (igx.reels === null) { el.innerHTML = `<p class="vazio">Abrindo os reels da semana...</p>`; carregarReels().then(() => { if (!igx.pesq) atualizarPesquisa(); else desenhar(); }); return; }
  if (igx.faltaBanco) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 27 do banco.sql no Supabase.</div>`; return; }
  const p = igx.pesq || {};
  const cfg = p.config || {};
  const semanas = [...new Set(igx.reels.map((r) => r.semana))];
  if (!igx.semanaVista || !semanas.includes(igx.semanaVista)) igx.semanaVista = semanas[0] || "";
  const lista = igx.reels.filter((r) => r.semana === igx.semanaVista).sort((a, b) => n2(b.views) - n2(a.views));
  const u = p.uso;
  const usoHtml = u ? `<div class="ig-uso" title="Plano grátis do Apify: quando acaba, ele bloqueia até o mês seguinte, sem cobrar nada.">
      <span>Crédito grátis do mês: <b>US$ ${u.usado.toFixed(2).replace(".", ",")}</b> de US$ ${u.total.toFixed(2).replace(".", ",")} usados</span>
      <span class="lb-trilho"><i style="width:${Math.min(100, (u.usado / (u.total || 5)) * 100)}%"></i></span></div>` : "";

  // O que se repete nos que mais bombaram
  const top10 = lista.slice(0, 10);
  const comDur = top10.filter((x) => n2(x.duracao));
  const durs = comDur.map((x) => n2(x.duracao)).sort((a, b) => a - b);
  const durMedia = durs.length ? Math.round(durs.length % 2 ? durs[(durs.length - 1) / 2] : (durs[durs.length / 2 - 1] + durs[durs.length / 2]) / 2) : 0;
  const perfis = {}; lista.forEach((x) => { if (x.perfil) perfis[x.perfil] = (perfis[x.perfil] || 0) + 1; });
  const perfisTop = Object.entries(perfis).sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1).slice(0, 4);
  const tags = {}; lista.forEach((x) => (String(x.legenda || "").match(/#[\p{L}\d_]+/gu) || []).forEach((t) => { t = t.toLowerCase(); tags[t] = (tags[t] || 0) + 1; }));
  const tagsTop = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);

  el.innerHTML = `
    <section class="cartao ig-estr-topo">
      <div><h2 class="rot-titulo">🔥 Reels da semana</h2>
        <p class="rot-frase">Os ${QUANTOS_REELS} reels com mais views nas hashtags do seu nicho. Toda segunda de manhã a lista se atualiza sozinha e chega uma notificação no celular.</p>
        ${usoHtml}</div>
      <div class="ig-estr-acoes">
        ${semanas.length > 1 ? `<select class="campo" id="ig-semana" aria-label="Semana">${semanas.map((s) => `<option value="${s}" ${s === igx.semanaVista ? "selected" : ""}>Semana de ${dataBR(s).slice(0, 5)}</option>`).join("")}</select>` : ""}
        <button class="btn" type="button" id="ig-hashtags">⚙️ Hashtags</button>
        <button class="btn primario" type="button" id="ig-buscar" ${p.rodando || p.semChave ? "disabled" : ""}>${p.rodando ? "Buscando..." : "🔎 Buscar agora"}</button>
      </div>
    </section>
    ${p.semChave ? `<div class="cartao ig-passos">
      <h3 class="pro-titulo">Falta só ligar o Apify (grátis, sem cartão)</h3>
      <ol class="passos">
        <li>Crie uma conta em <a href="https://console.apify.com/sign-up" target="_blank" rel="noopener"><b>apify.com</b></a>. Pode entrar com o Google. Não pede cartão.</li>
        <li>No Apify, abra <b>Settings</b> e depois <b>API &amp; Integrations</b>. Copie o <b>Personal API token</b>.</li>
        <li>No <a href="https://supabase.com/dashboard/project/jlehawiwklvyvrzbfuiu/functions/secrets" target="_blank" rel="noopener"><b>Supabase</b></a>, em <b>Edge Functions</b> e depois <b>Secrets</b>, crie um segredo com o nome <code>APIFY_TOKEN</code> e cole o token como valor.</li>
        <li>Volte aqui e toque em <b>Buscar agora</b>.</li>
      </ol>
      <p class="sub">O plano grátis dá US$ 5 por mês e cada busca semanal gasta uns US$ 0,40. Quando o crédito acaba, o Apify só para até o mês seguinte: não cobra nada. A chave fica só no cofre do Supabase.</p>
      <button class="btn" type="button" id="ig-conferir">Já colei, conferir</button>
    </div>` : ""}
    ${p.erro && !p.semChave ? `<div class="aviso-falta">${esc(p.erro)}</div>` : ""}
    ${cfg.erro ? `<div class="aviso-falta">${esc(cfg.erro)}</div>` : ""}
    ${p.rodando ? `<div class="rot-aviso-caixa">⏳ O Apify está vasculhando ${esc((cfg.hashtags || []).map((h) => "#" + h).join(", "))}. Leva de 2 a 5 minutos. Pode sair desta tela, a lista fica guardada.</div>` : ""}
    ${lista.length ? `
      <div class="grade-fin tres ig-padroes">
        <div class="cartao"><h3 class="pro-titulo">Duração que mais rende</h3><p class="ig-num-grande">${durMedia ? durMedia + " s" : "?"}</p><p class="sub">a duração do meio entre os 10 reels com mais views</p></div>
        <div class="cartao"><h3 class="pro-titulo">Hashtags que se repetem</h3><p>${tagsTop.map(([t, n]) => `<span class="pilula">${esc(t)} <span class="sub">${n}</span></span>`).join(" ") || '<span class="sub">poucas hashtags nas legendas</span>'}</p></div>
        <div class="cartao"><h3 class="pro-titulo">Perfis para acompanhar</h3><p>${perfisTop.map(([pf, n]) => `<a class="pilula" href="https://www.instagram.com/${esc(pf.slice(1))}/" target="_blank" rel="noopener">${esc(pf)} <span class="sub">${n} reels</span></a>`).join(" ") || '<span class="sub">nenhum perfil apareceu mais de uma vez</span>'}</p></div>
      </div>
      <div class="ig-reels">${lista.map((r, i) => `
        <article class="ig-reel">
          <a class="ig-reel-capa" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Assistir no Instagram">
            ${r.capa ? `<img src="${esc(r.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
            <span class="ig-reel-pos">${i + 1}</span>
            <span class="ig-reel-views">▶ ${compacto(r.views)}</span>
          </a>
          <div class="ig-reel-info">
            <b>${esc(r.perfil || "")}</b>
            <small class="sub">${r.postado_em ? new Date(r.postado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : ""}${n2(r.duracao) ? " · " + Math.round(r.duracao) + " s" : ""} · ❤ ${compacto(r.curtidas)} · 💬 ${compacto(r.comentarios)}</small>
            <p class="ig-legenda">${esc(String(r.legenda || "Sem legenda").slice(0, 140))}</p>
            <div class="ig-reel-acoes">
              <a class="btn pequeno" href="${esc(r.url)}" target="_blank" rel="noopener">▶ Assistir</a>
              <button class="btn pequeno" type="button" data-reel-rot="${esc(r.id)}" ${S.transcricoes.some((t) => t.link && String(t.link).split("?")[0] === r.url) ? "disabled" : ""}>${S.transcricoes.some((t) => t.link && String(t.link).split("?")[0] === r.url) ? "✓ Nos Roteiros" : "📜 Roteiros"}</button>
            </div>
          </div>
        </article>`).join("")}</div>
      <p class="sub" style="margin-top:12px">Guardado em ${dataBR(igx.semanaVista)}${cfg.coletado_em && igx.semanaVista === semanas[0] ? ` às ${new Date(cfg.coletado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}. As capas vêm do Instagram e podem sumir depois de alguns dias, o link continua funcionando.</p>`
    : !p.semChave && !p.rodando ? `<p class="vazio">Ainda não tem reels guardados. Toque em <b>Buscar agora</b>.</p>` : ""}`;

  const sem = $("#ig-semana"); if (sem) sem.onchange = (e) => { igx.semanaVista = e.target.value; desenhar(); };
  const conf = $("#ig-conferir"); if (conf) conf.onclick = () => { igx.pesq = null; el.innerHTML = `<p class="vazio">Conferindo...</p>`; atualizarPesquisa(); };
  $("#ig-buscar").onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Começando...";
    await atualizarPesquisa("buscar");
  };
  $("#ig-hashtags").onclick = () => formHashtags(cfg);
  $$("[data-reel-rot]", el).forEach((b) => b.onclick = async () => {
    const r = lista.find((x) => String(x.id) === b.dataset.reelRot);
    if (!r) return;
    b.disabled = true; b.textContent = "Salvando...";
    const dados = { link: r.url, plataforma: "instagram", categoria: "organico", status: "ideia", titulo: String(r.legenda || "").split("\n")[0].replace(/#\S+/g, "").trim().slice(0, 70) || `Reel de ${r.perfil || "referência"}`,
      de_quem: "outra", perfil: r.perfil, legenda: r.legenda, postado_em: r.postado_em ? String(r.postado_em).slice(0, 10) : null, tags: ["reels-da-semana"], andamento: "processando" };
    const limpo = {}; Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
    const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
    if (error) { avisar(traduzErro(error), true); b.disabled = false; b.textContent = "📜 Roteiros"; return; }
    await recarregar("transcricoes");
    const novo = S.transcricoes.find((x) => String(x.id) === String(data.id));
    if (novo) transcreverVideo(novo);
    avisar("Salvo nos Roteiros. A transcrição chega em instantes (usa 1 crédito da Supadata).");
  });
}
const QUANTOS_REELS = 30;

function formHashtags(cfg) {
  const d = abrirJanelaSimples("⚙️ Hashtags vasculhadas", `
    <p class="sub" style="margin-top:0">Uma por linha, sem o #. Misture as do seu nicho (UGC) com as de tech, beleza, moda e fitness. Até 12.</p>
    <textarea class="campo" id="hx-lista" rows="8" style="width:100%">${esc((cfg.hashtags || []).join("\n"))}</textarea>
    <label class="pro-rotulo" for="hx-por">Reels por hashtag</label>
    <input class="campo" id="hx-por" type="number" min="5" max="60" value="${esc(cfg.por_hashtag || 25)}">
    <p class="sub" id="hx-custo"></p>`,
    `<button type="button" class="btn primario" data-salvar>Salvar</button>`);
  const custo = () => {
    const n = $("#hx-lista", d).value.split(/\s|,/).filter(Boolean).length, por = Number($("#hx-por", d).value) || 25;
    const us = (n * por * 2.6) / 1000;
    $("#hx-custo", d).textContent = `Cada busca: até ${n * por} reels, uns US$ ${us.toFixed(2).replace(".", ",")}. Uma por semana dá uns US$ ${(us * 4.3).toFixed(2).replace(".", ",")} no mês (o grátis é US$ 5).`;
  };
  custo();
  $("#hx-lista", d).oninput = custo; $("#hx-por", d).oninput = custo;
  $("[data-salvar]", d).onclick = async () => {
    const lista = $("#hx-lista", d).value.split(/[\s,]+/).map((x) => x.replace(/^#/, "")).filter(Boolean);
    try {
      const r = await chamarTendencias({ acao: "hashtags", hashtags: lista, por_hashtag: Number($("#hx-por", d).value) || 25 });
      if (r.erro) { avisar(r.erro, true); return; }
      d.close(); avisar("Hashtags salvas. Valem a partir da próxima busca.");
      if (igx.pesq) igx.pesq.config = { ...(igx.pesq.config || {}), hashtags: r.hashtags, por_hashtag: r.por_hashtag };
      desenhar();
    } catch (e) { avisar(e.message, true); }
  };
}

/* ---------- 🧭 Plano da semana ---------- */
const DIAS_PLANO = [["SEG", 0, "Segunda"], ["TER", 1, "Terça"], ["QUA", 2, "Quarta"], ["QUI", 3, "Quinta"], ["SEX", 4, "Sexta"], ["SAB", 5, "Sábado"], ["DOM", 6, "Domingo"]];
const NICHO_PADRAO = "Sou o Ryan (@ryalvz), creator UGC no Brasil. Meu Instagram mistura duas coisas: bastidores de UGC (como fechar com marcas, quanto cobrar, rotina, gravação, edição) e conteúdo de produtos na vida real (tech e apps, beleza, moda e fitness). Quero crescer, atrair marcas e ter constância.";

async function carregarPlanos() {
  const [a, b] = await Promise.all([
    db.from("ig_planos").select("*").order("semana", { ascending: false }).limit(20),
    igx.reels === null ? carregarReels() : Promise.resolve()
  ]);
  igx.planos = a.error ? [] : a.data || [];
  igx.faltaPlanos = !!a.error;
}

const ORDEM_CAMPOS_PLANO = { capa: ["titulo", "texto", "destaque"], texto: ["titulo", "texto"], lista: ["titulo", "texto"], numero: ["texto2", "titulo", "texto"], moldura: ["texto2", "titulo"], notas: ["titulo", "texto2"], polaroid: ["titulo"], colagem: ["titulo", "texto"], cartao: ["titulo", "texto", "texto2"], frase: ["titulo"], final: ["titulo", "texto", "destaque", "texto2"] };
// Lê a resposta do Claude: linhas "SEG | Reels | tema | gancho | por quê" e blocos "CARROSSEL: título"
function lerPlano(texto) {
  const itens = [], carrosseis = [];
  let car = null;
  String(texto || "").split("\n").forEach((bruta) => {
    const l = bruta.replace(/^[\s>*•-]+/, "").replace(/\*\*/g, "").replace(/^\|/, "").replace(/\|\s*$/, "").trim();
    const mc = l.match(/^CARROSSEL\s*:\s*(.+)$/i);
    if (mc) { car = { titulo: mc[1].trim(), slides: [] }; carrosseis.push(car); return; }
    const md = l.match(/^(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)[A-Za-zçÇáÁ-]*\s*\|\s*(.+)$/i);
    if (md) {
      const p = md[2].split("|").map((x) => x.trim());
      const sigla = md[1].toUpperCase().replace("Á", "A");
      itens.push({ dia: sigla, formato: p[0] || "", tema: p[1] || "", gancho: p[2] || "", porque: p[3] || "" });
      car = null; return;
    }
    const ms = l.match(/^(\d{1,2})[.)]?\s*(capa|texto|lista|numero|número|moldura|notas|polaroid|colagem|cartao|cartão|frase|final|comparacao|comparação)\s*\|\s*(.*)$/i);
    if (ms && car) {
      const modelo = ms[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("comparacao", "cartao");
      const partes = ms[3].split("|").map((x) => x.trim());
      const slide = { modelo };
      const dica = partes.findIndex((x) => /^foto\s*:/i.test(x));
      if (dica >= 0) { slide.dicaFoto = partes[dica].replace(/^foto\s*:\s*/i, ""); partes.splice(dica, 1); }
      (ORDEM_CAMPOS_PLANO[modelo] || ["titulo", "texto"]).forEach((c, k) => { if (partes[k]) slide[c] = partes[k]; });
      if (modelo === "lista" && slide.texto) slide.texto = slide.texto.split(/\s*;\s*/).join("\n");
      if (modelo === "final") { slide.tom = "escuro"; slide.texto2 = slide.texto2 || "Link na bio"; }
      if (modelo === "texto") slide.tom = car.slides.filter((x) => x.modelo === "texto").length % 2 ? "forte" : "escuro";
      car.slides.push(slide);
    }
  });
  return { itens, carrosseis: carrosseis.filter((c) => c.slides.length) };
}

function pedidoPlano(nicho) {
  const d = ig.dados;
  let meus = "";
  if (d && (d.posts || []).length) {
    const posts = d.posts.filter((x) => n2(x.reach));
    const top = [...posts].sort((a, b) => n2(b.reach) - n2(a.reach)).slice(0, 6);
    const fraco = [...posts].sort((a, b) => n2(a.reach) - n2(b.reach)).slice(0, 3);
    const linha = (x) => `- ${NOME_FORMATO[x.tipo] || x.tipo}, ${new Date(x.data).toLocaleDateString("pt-BR")} (${DIAS_SEMANA[new Date(x.data).getDay()]}): alcance ${num(x.reach)}, ${num(x.saved)} salvos, ${num(x.shares)} compartilhamentos. "${String(x.legenda || "sem legenda").replace(/\s+/g, " ").slice(0, 160)}"`;
    meus = `MEUS NÚMEROS (Instagram @${d.perfil.username}, ${num(d.perfil.followers_count)} seguidores, últimos ${d.dias} dias: alcance ${num((d.atual || {}).reach)})
Meus posts com MAIS alcance:
${top.map(linha).join("\n")}
Meus posts com MENOS alcance:
${fraco.map(linha).join("\n")}
`;
  }
  const semana = (igx.reels || []).filter((r) => r.semana === (igx.reels[0] || {}).semana).slice(0, 30);
  const refs = semana.length ? `OS ${semana.length} REELS COM MAIS VIEWS DESTA SEMANA NO MEU NICHO (por hashtag)
${semana.map((r, i) => `${i + 1}. ${r.perfil || ""} · ${num(r.views)} views${n2(r.duracao) ? ` · ${Math.round(r.duracao)} s` : ""}: "${String(r.legenda || "").replace(/\s+/g, " ").slice(0, 220)}"`).join("\n")}
` : "";
  // Suas ideias de roteiro que ainda não foram pro ar (as "Fazer agora" primeiro)
  const ordemEtapa = { agora: 0, fazendo: 1, ideia: 2 };
  const ideias = (S.transcricoes || []).filter((t) => t.status !== "feito" && t.categoria === "organico" && (t.titulo || t.minha_versao || t.transcricao))
    .sort((a, b) => (ordemEtapa[a.status] ?? 3) - (ordemEtapa[b.status] ?? 3)).slice(0, 30);
  const minhasIdeias = ideias.length ? `MINHAS IDEIAS DE ROTEIRO PARA O INSTAGRAM JÁ ANOTADAS (#número para você citar)
${ideias.map((t) => `#${t.id} [${(CATEGORIAS.find((c) => c[0] === t.categoria) || [0, t.categoria || ""])[1]}${t.status === "agora" ? ", fazer agora" : ""}] ${t.titulo || "sem título"}${(t.minha_versao || t.transcricao) ? `: ${String(t.minha_versao || t.transcricao).replace(/\s+/g, " ").slice(0, 160)}` : ""}`).join("\n")}
` : "";
  const seg = segundaISO();
  return `Você é meu estrategista de conteúdo para Instagram.

QUEM SOU EU
${nicho}

${meus}
${refs}
${minhasIdeias}
O QUE EU PRECISO (pesquise na internet o que está em alta no Brasil nesta semana, ${dataBR(seg)} a ${dataBR(somaDiasISO(6, seg))}):

1. TENDÊNCIAS DA SEMANA: 5 temas, formatos ou áudios em alta no meu nicho e por que estão funcionando.
2. O QUE O MEU PÚBLICO QUER SABER: 8 perguntas reais que as pessoas estão fazendo sobre esses assuntos.
3. PADRÕES DOS REELS QUE BOMBARAM: o que os reels da lista acima têm em comum (gancho, duração, estilo, tema). Se não tiver lista, use o que você achou na pesquisa.
4. O QUE FUNCIONA PARA MIM: o que os meus números mostram (o que repetir e o que parar de fazer).
5. PLANO DA SEMANA: de 5 a 7 posts, misturando bastidores de UGC e produtos na vida real, com pelo menos 2 carrosséis e 3 reels.
   Este plano é SÓ para o Instagram. Não coloque nada de TikTok Shop (vídeo de venda de produto com carrinho), isso é outra estratégia.
   PRIORIZE as minhas ideias já anotadas que combinam com o que está em alta e com o que funciona para mim. Quando usar uma, coloque o número dela no tema (ex.: "#34 Memória cheia do iPhone"). Só invente tema novo se faltar.
   Escreva CADA post numa linha, EXATAMENTE neste formato, separado por | :
   SEG | Reels | tema | gancho (a primeira frase do vídeo ou a capa) | por que vai funcionar
   Use só SEG, TER, QUA, QUI, SEX, SAB, DOM no começo. Formatos: Reels, Carrossel, Stories ou Foto.
6. CARROSSÉIS PRONTOS: para cada carrossel do plano, escreva os slides neste formato (de 5 a 8 slides, no máximo 30 palavras por slide). Num título, *palavra* fica em itálico colorido e **palavra** em negrito (use 1 destaque por título, no máximo).
   CARROSSEL: título do carrossel
   1 capa | título forte (até 10 palavras) | linha pequena em cima (opcional) | etiqueta curta (opcional) | foto: que foto minha usar
   2 texto | título com *uma palavra* destacada | texto do slide
   3 lista | título | item um; item dois; item três
   4 numero | linha pequena (ex.: HOJE) | o número (ex.: +40 MARCAS.) | linha de baixo
   5 moldura | nota pequena | frase (ex.: sem experiência. **sem marca.** sem cliente.) | foto: que foto ou print usar
   6 notas | frase forte do card | balão curtinho (ex.: *panic*) | foto: fundo
   7 polaroid | legenda curta | foto: que foto usar
   8 colagem | título | texto com **final em negrito** | foto: quais 2 fotos
   9 cartao | título do card | texto do card | bilhete curto | foto: fundo
   10 frase | frase de impacto | foto: fundo
   11 final | frase de cima | frase de baixo | caixa de destaque (ex.: Salva esse post) | letra de mão (ex.: Link na bio)
   Modelos possíveis: capa, texto, lista, numero, moldura, notas, polaroid, colagem, cartao, frase, final. Comece sempre com capa e termine com final. Alterne slides com foto e slides de texto.

Fale como gente de verdade, em português do Brasil, sem cara de anúncio. Não use travessão em nenhum texto.`;
}

function desenharPlanoSemana(el) {
  if (igx.planos === null) { el.innerHTML = `<p class="vazio">Abrindo o seu plano...</p>`; carregarPlanos().then(desenhar); return; }
  if (igx.faltaPlanos) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 27 do banco.sql no Supabase.</div>`; return; }
  const seg = segundaISO();
  if (!igx.semanaPlano) igx.semanaPlano = (igx.planos.find((p) => p.semana === seg) || igx.planos[0] || { semana: seg }).semana;
  const plano = igx.planos.find((p) => p.semana === igx.semanaPlano);
  let nicho = NICHO_PADRAO;
  try { nicho = localStorage.getItem("ig-nicho") || NICHO_PADRAO; } catch (_) {}
  const temReels = (igx.reels || []).length;
  const itens = plano ? (plano.itens || {}).itens || [] : [];
  const carrosseisPlano = plano ? (plano.itens || {}).carrosseis || [] : [];
  const dataDoDia = (sigla) => somaDiasISO((DIAS_PLANO.find((x) => x[0] === sigla) || [0, 0])[1], plano ? plano.semana : seg);
  const carDoItem = (it) => {
    if (!/carross/i.test(it.formato)) return -1;
    const ordem = itens.filter((x) => /carross/i.test(x.formato)).indexOf(it);
    const porNome = carrosseisPlano.findIndex((c) => semAcento(c.titulo).includes(semAcento(it.tema).slice(0, 18)) || semAcento(it.tema).includes(semAcento(c.titulo).slice(0, 18)));
    return porNome >= 0 ? porNome : ordem < carrosseisPlano.length ? ordem : -1;
  };

  el.innerHTML = `
    <section class="cartao ig-estr-topo">
      <div><h2 class="rot-titulo">🧭 Plano da semana</h2>
        <p class="rot-frase">Pesquisa de mercado e o que postar de segunda a domingo, com os seus números e os reels que bombaram. Sem custo: o Claude faz a pesquisa e você cola a resposta aqui.</p></div>
      ${igx.planos.length > 1 ? `<select class="campo" id="pl-semana" aria-label="Semana">${[...new Set([seg, ...igx.planos.map((p) => p.semana)])].map((s) => `<option value="${s}" ${s === igx.semanaPlano ? "selected" : ""}>Semana de ${dataBR(s).slice(0, 5)}</option>`).join("")}</select>` : ""}
    </section>

    ${itens.length ? `
      <div class="pl-dias">${itens.map((it, i) => { const ci = carDoItem(it); const data = dataDoDia(it.dia); return `
        <article class="pl-dia ${data === hojeISO() ? "hoje" : ""}" data-pl-abrir="${i}" tabindex="0" role="button" aria-label="Ver tudo de ${esc(it.tema)}">
          <header><b>${esc((DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0, it.dia])[2])}</b><span class="sub">${dataBR(data).slice(0, 5)}</span><span class="pilula ${/reel/i.test(it.formato) ? "p-azul" : /carross/i.test(it.formato) ? "p-oliva" : ""}">${esc(it.formato)}</span></header>
          <h3>${esc(it.tema)}</h3>
          ${it.gancho ? `<p class="pl-gancho">“${esc(String(it.gancho).replace(/^["“]+|["”]+$/g, ""))}”</p>` : ""}
          ${it.porque ? `<p class="sub">${esc(it.porque)}</p>` : ""}
          <div class="pl-acoes">
            <button class="btn pequeno primario" type="button" data-pl-ver="${i}">👁️ Ver tudo</button>
            ${ci >= 0 ? `<button class="btn pequeno" type="button" data-pl-car="${ci}">🎨 Carrossel</button>` : ""}
            <button class="btn pequeno" type="button" data-pl-agenda="${i}">📅 Agenda</button>
            ${it.gancho ? `<button class="btn pequeno" type="button" data-pl-copiar="${i}">📋 Gancho</button>` : ""}
          </div>
        </article>`; }).join("")}</div>
      <details class="cartao pl-completo"><summary><b>Ver a pesquisa completa</b> (tendências, perguntas do público e padrões)</summary><div class="pl-texto">${esc(plano.resposta).replace(/\n/g, "<br>")}</div></details>`
    : plano ? `<div class="cartao"><p>Você colou uma resposta, mas não achei as linhas do plano no formato <code>SEG | Reels | tema | gancho | por quê</code>. Peça para o Claude: <i>"reescreva o item 5 exatamente no formato pedido"</i> e cole de novo.</p><details><summary>Ver o que foi colado</summary><div class="pl-texto">${esc(plano.resposta).replace(/\n/g, "<br>")}</div></details></div>` : ""}

    <div class="cartao pl-passos">
      <h3 class="pro-titulo">${itens.length ? "Refazer o plano desta semana" : "Montar o plano desta semana (2 minutos)"}</h3>
      <ol class="passos">
        <li>${temReels ? `O pedido já leva os ${Math.min(30, temReels)} reels que mais bombaram${ig.dados ? " e os seus números do Instagram" : ""}.` : `Dica: busque antes os <button type="button" class="link-btn" id="pl-ir-reels">🔥 Reels da semana</button> para o pedido ir com dados reais.`}</li>
        <li>Toque em <b>Copiar pedido</b> e cole no <a href="https://claude.ai/new" target="_blank" rel="noopener"><b>Claude</b></a> (com a pesquisa na web ligada).</li>
        <li>Copie a resposta inteira do Claude, cole aqui embaixo e toque em <b>Salvar plano</b>.</li>
      </ol>
      <details><summary>Sobre o seu nicho (o Claude lê isso)</summary>
        <textarea class="campo" id="pl-nicho" rows="4" style="width:100%;margin-top:8px">${esc(nicho)}</textarea></details>
      <div class="pro-acoes" style="margin:10px 0">
        <button class="btn primario" type="button" id="pl-copiar">📋 Copiar pedido</button>
        <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude ↗</a>
      </div>
      <textarea class="campo" id="pl-resposta" rows="7" style="width:100%" placeholder="Cole aqui a resposta do Claude"></textarea>
      <div class="pro-acoes" style="margin-top:10px"><button class="btn primario" type="button" id="pl-salvar">💾 Salvar plano</button></div>
    </div>`;

  const sel = $("#pl-semana"); if (sel) sel.onchange = (e) => { igx.semanaPlano = e.target.value; desenhar(); };
  const irReels = $("#pl-ir-reels"); if (irReels) irReels.onclick = () => { igx.sub = "reels"; desenhar(); };
  $("#pl-nicho").onchange = (e) => { try { localStorage.setItem("ig-nicho", e.target.value.trim() || NICHO_PADRAO); } catch (_) {} };
  $("#pl-copiar").onclick = async (e) => {
    // Garante que os seus números do Instagram vão junto
    if (!ig.dados && ig.conectado !== false) { e.target.textContent = "Juntando seus números..."; await chamarInstagram({ acao: "dados", dias: 30 }).then((r) => { if (r.perfil) { ig.dados = r; ig.conectado = true; } }).catch(() => {}); e.target.textContent = "📋 Copiar pedido"; }
    const texto = pedidoPlano($("#pl-nicho").value.trim() || NICHO_PADRAO);
    try { await navigator.clipboard.writeText(texto); avisar("Pedido copiado. Cole no Claude."); }
    catch (_) { abrirJanelaSimples("Copie o pedido", `<textarea class="campo" rows="14" style="width:100%" readonly>${esc(texto)}</textarea>`, ""); }
  };
  $("#pl-salvar").onclick = async () => {
    const resposta = $("#pl-resposta").value.trim();
    if (!resposta) { avisar("Cole a resposta do Claude primeiro.", true); return; }
    const lido = lerPlano(resposta);
    const semana = segundaISO();
    const { error } = await db.from("ig_planos").upsert({ semana, resposta, itens: lido }, { onConflict: "semana" });
    if (error) { avisar(traduzErro(error), true); return; }
    await carregarPlanos(); igx.semanaPlano = semana;
    avisar(lido.itens.length ? `Plano salvo: ${plural(lido.itens.length, "post", "posts")}${lido.carrosseis.length ? ` e ${plural(lido.carrosseis.length, "carrossel pronto", "carrosséis prontos")}` : ""}.` : "Salvei, mas não achei as linhas do plano. Veja o aviso.", !lido.itens.length);
    desenhar();
  };
  $$("[data-pl-car]", el).forEach((b) => b.onclick = () => {
    const c = carrosseisPlano[Number(b.dataset.plCar)];
    if (!c) return;
    igx.car = { titulo: c.titulo, slides: c.slides.map((s) => ({ ...s })) };
    igx.sub = "carrossel"; try { localStorage.setItem("ig-sub", "carrossel"); } catch (_) {}
    desenhar(); window.scrollTo({ top: 0 });
  });
  const abrirItem = (i) => abrirPostDoPlano(plano, itens[i]);
  $$("[data-pl-abrir]", el).forEach((card) => {
    card.addEventListener("click", (e) => { if (e.target.closest("button, a")) return; abrirItem(Number(card.dataset.plAbrir)); });
    card.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); abrirItem(Number(card.dataset.plAbrir)); } });
  });
  $$("[data-pl-ver]", el).forEach((b) => b.onclick = () => abrirItem(Number(b.dataset.plVer)));
  $$("[data-pl-copiar]", el).forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(itens[Number(b.dataset.plCopiar)].gancho); avisar("Gancho copiado."); } catch (_) { avisar("Não deu para copiar.", true); }
  });
  $$("[data-pl-agenda]", el).forEach((b) => b.onclick = async () => {
    const it = itens[Number(b.dataset.plAgenda)];
    const titulo = `${it.formato}: ${it.tema}`.slice(0, 200);
    if (S.calendario.some((a) => a.titulo === titulo)) { avisar("Esse post já está na agenda."); return; }
    if (await gravar("calendario", { titulo, tipo: "postar", data: dataDoDia(it.dia), status: "a fazer" })) { avisar(`Na agenda: ${(DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0, it.dia])[2]}.`); recarregar("calendario"); }
  });
}

/* ---------- 🎨 Carrossel: sistema visual + gerador ----------
   Estilo editorial (inspirado nos seus fixados e nas referências):
   foto sua no centro, serifada elegante + bastão grossa, objetos de
   papel (etiqueta, Notas, polaroid, clipe, fita, estrela).
   No texto: *palavra* = itálico colorido, **palavra** = negrito.
   ----------------------------------------------------------------- */
const FONTE_SERIFA = "'Playfair Display'", FONTE_BASTAO = "Montserrat", FONTE_MAO = "Allura";
const TEMAS_CARROSSEL = {
  ryan: { nome: "Ryan (creme e dourado)", acento: "#1F3FC3",
    claro: { fundo: "#F5F1EA", titulo: "#2B241C", texto: "#3A3128", destaque: "#7A6322" },
    escuro: { fundo: "#2B241C", titulo: "#F5F1EA", texto: "#E9E1D3", destaque: "#D9C48A" },
    forte: { fundo: "#7A6322", titulo: "#FFF8EA", texto: "#F5ECD9", destaque: "#F3E2A6" } },
  roxo: { nome: "Roxo e lima", acento: "#7B3FB0",
    claro: { fundo: "#F3EEE3", titulo: "#3A0E46", texto: "#3A0E46", destaque: "#7B2C8F" },
    escuro: { fundo: "#3A0E46", titulo: "#FBF6E8", texto: "#EDE3F0", destaque: "#E4F04B" },
    forte: { fundo: "#D8F04A", titulo: "#3A0E46", texto: "#2B2B2B", destaque: "#3A0E46" } },
  cafe: { nome: "Café e verde", acento: "#1F4D3A",
    claro: { fundo: "#ECE7E0", titulo: "#4A3428", texto: "#4A3428", destaque: "#1F4D3A" },
    escuro: { fundo: "#1F3A2E", titulo: "#F3EEE6", texto: "#E8E2D6", destaque: "#E3C987" },
    forte: { fundo: "#4A3428", titulo: "#F3EEE6", texto: "#EDE5DA", destaque: "#E3C987" } },
  cobalto: { nome: "Cobalto (cores do site)", acento: "#1F3FC3",
    claro: { fundo: "#F0EEEA", titulo: "#1F3FC3", texto: "#14182B", destaque: "#8A855E" },
    escuro: { fundo: "#1F3FC3", titulo: "#F0EEEA", texto: "#E8EAF6", destaque: "#F2E66B" },
    forte: { fundo: "#14182B", titulo: "#F0EEEA", texto: "#D9DCE8", destaque: "#F2E66B" } }
};
const ASSINATURA = { nome: "RYAN ALVES", cargo: "UGC CREATOR", arroba: "@ryalvz" };
const W_CAR = 1080, H_CAR = 1350, M_CAR = 90;

// Modelos: [chave, nome, para que serve, campos (na ordem do editor)]
const MODELOS_SLIDE = [
  ["capa", "Capa com foto", "Sua foto em tela cheia e a promessa do carrossel.", ["foto", "texto", "titulo", "destaque"]],
  ["texto", "Texto editorial", "01. Título elegante e um parágrafo. Fundo de cor chapada.", ["tom", "titulo", "texto"]],
  ["lista", "Lista", "Passos ou itens, um por linha.", ["tom", "titulo", "texto"]],
  ["numero", "Número grande", "Um número que impressiona (ex.: +40 MARCAS).", ["tom", "texto2", "titulo", "texto"]],
  ["moldura", "Foto emoldurada", "Foto ou print no meio, frase embaixo.", ["tom", "foto", "texto2", "titulo"]],
  ["notas", "Card do Notas", "Frase forte num card do app Notas, com balão.", ["foto", "titulo", "texto2"]],
  ["polaroid", "Polaroid", "Uma foto em polaroid com legenda.", ["tom", "foto", "titulo"]],
  ["colagem", "Colagem (2 fotos)", "Título, duas fotos tortas com clipe e um texto.", ["tom", "titulo", "foto", "foto2", "texto"]],
  ["cartao", "Card sobre a foto", "Card de papel e um bilhete por cima da sua foto.", ["foto", "titulo", "texto", "texto2"]],
  ["frase", "Frase sobre a foto", "Uma frase centralizada em cima da sua foto.", ["foto", "titulo"]],
  ["final", "Final com chamada", "Chamada para seguir, salvar ou ir no link.", ["tom", "titulo", "foto", "texto", "destaque", "texto2"]]
];
const ROTULOS_CAMPO = {
  capa: { texto: "Linha pequena em cima (opcional)", titulo: "Título (*itálico* **negrito**)", destaque: "Etiqueta torta (opcional)" },
  texto: { titulo: "Título (*palavra* fica colorida)", texto: "Texto do slide" },
  lista: { titulo: "Título", texto: "Um item por linha" },
  numero: { texto2: "Linha pequena em cima (ex.: HOJE)", titulo: "O número (ex.: +40 MARCAS.)", texto: "Embaixo (ex.: Moda · Tecnologia · Lifestyle)" },
  moldura: { texto2: "Nota pequena no canto (opcional)", titulo: "Frase (ex.: sem experiência. **sem marca.**)" },
  notas: { titulo: "Texto do card", texto2: "Balão azul (ex.: *panic*)" },
  polaroid: { titulo: "Legenda da polaroid" },
  colagem: { titulo: "Título", texto: "Texto embaixo (**negrito** no final)" },
  cartao: { titulo: "Título do card (itálico)", texto: "Texto do card", texto2: "Bilhete por cima (opcional)" },
  frase: { titulo: "A frase" },
  final: { titulo: "Frase de cima", texto: "Frase de baixo", destaque: "Caixa de destaque (ex.: Salva esse post)", texto2: "Letra de mão (ex.: Link na bio)" }
};
const CARROSSEL_EXEMPLO = {
  titulo: "Há 1 ano eu não tinha nenhuma marca", tema: "ryan",
  slides: [
    { modelo: "capa", titulo: "Há 1 ano eu não tinha *nenhuma marca* no portfólio.", texto: "", destaque: "" },
    { modelo: "moldura", tom: "claro", texto2: "Meu primeiro vídeo para portfólio", titulo: "sem experiência. **sem marca.** sem cliente." },
    { modelo: "texto", tom: "escuro", titulo: "O que *ninguém* te conta.", texto: "Meu primeiro trabalho veio 3 meses depois. Teve mês sem fechar nada. E eu pensei várias vezes que aquilo não ia funcionar para mim. Mas continuei criando e melhorando o portfólio." },
    { modelo: "numero", tom: "claro", texto2: "HOJE", titulo: "+40 MARCAS.", texto: "Moda · Tecnologia · Lifestyle · Grooming" },
    { modelo: "notas", titulo: "Constância vence talento quando o talento não aparece.", texto2: "*anota*" },
    { modelo: "frase", titulo: "A única coisa que me separa de quem eu era há 1 ano é que eu não parei." },
    { modelo: "final", tom: "escuro", titulo: "Se você quer começar no UGC,", texto: "me segue que eu conto os bastidores por aqui.", destaque: "Salva esse post", texto2: "@ryalvz" }
  ]
};

let fontesCarrossel = null;
function carregarFontesCarrossel() {
  if (!fontesCarrossel) fontesCarrossel = Promise.all([
    `400 60px ${FONTE_SERIFA}`, `700 60px ${FONTE_SERIFA}`, `italic 400 60px ${FONTE_SERIFA}`, `italic 700 60px ${FONTE_SERIFA}`,
    `500 40px ${FONTE_BASTAO}`, `600 40px ${FONTE_BASTAO}`, `700 40px ${FONTE_BASTAO}`, `800 40px ${FONTE_BASTAO}`, `400 60px ${FONTE_MAO}`
  ].map((f) => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready);
  return fontesCarrossel;
}

/* ---------- Fotos: guardadas no Storage, carregadas sem "sujar" o canvas ---------- */
const fotosCarrossel = new Map();
function fotoCarrossel(url, aoCarregar) {
  if (!url) return null;
  const f = fotosCarrossel.get(url);
  if (f) return f.pronta ? f.img : null;
  const img = new Image(); img.crossOrigin = "anonymous";
  const reg = { img, pronta: false, promessa: null };
  reg.promessa = new Promise((ok) => { img.onload = () => { reg.pronta = true; ok(img); if (aoCarregar) aoCarregar(); }; img.onerror = () => ok(null); });
  img.src = url;
  fotosCarrossel.set(url, reg);
  return null;
}
const esperarFotos = (slides) => Promise.all(slides.flatMap((s) => [s.foto, s.foto2]).filter(Boolean).map((u) => { fotoCarrossel(u); return fotosCarrossel.get(u).promessa; }));
async function prepararFoto(arquivo) {
  const url = URL.createObjectURL(arquivo);
  const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não consegui abrir essa imagem. Use JPG, PNG ou HEIC convertido.")); i.src = url; });
  const escala = Math.min(1, 1700 / Math.max(img.width, img.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.88));
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

/* ---------- Texto rico: *itálico colorido* e **negrito** ---------- */
function pedacosRicos(texto) {
  const r = [], re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let ultimo = 0, m;
  const s = String(texto || "");
  while ((m = re.exec(s))) {
    if (m.index > ultimo) r.push({ t: s.slice(ultimo, m.index), e: "n" });
    r.push(m[0].startsWith("**") ? { t: m[0].slice(2, -2), e: "b" } : { t: m[0].slice(1, -1), e: "a" });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) r.push({ t: s.slice(ultimo), e: "n" });
  return r;
}
// fontes(tam) => { n, a, b }: a fonte de cada estilo naquele tamanho
function linhasRicas(ctx, texto, fontes, largura, maiusc) {
  const linhas = [];
  String(texto || "").split("\n").forEach((par) => {
    const palavras = [];
    let antesEspaco = true;
    pedacosRicos(maiusc ? par.toUpperCase() : par).forEach((p) => p.t.split(/(\s+)/).forEach((w) => {
      if (!w) return;
      if (/^\s+$/.test(w)) { antesEspaco = true; return; }
      palavras.push({ t: w, e: p.e, cola: !antesEspaco && palavras.length > 0 }); antesEspaco = false;
    }));
    if (!palavras.length) { linhas.push({ itens: [], fim: true }); return; }
    let atual = [], larg = 0;
    palavras.forEach((p) => {
      ctx.font = fontes[p.e]; const w = ctx.measureText(p.t).width;
      ctx.font = fontes.n; const esp = atual.length && !p.cola ? ctx.measureText(" ").width : 0;
      if (atual.length && !p.cola && larg + esp + w > largura) { linhas.push({ itens: atual, fim: false }); atual = []; larg = 0; }
      atual.push({ ...p, cola: p.cola && atual.length > 0, w }); larg += (atual.length > 1 ? esp : 0) + w;
    });
    linhas.push({ itens: atual, fim: true });
  });
  return linhas;
}
function caberRico(ctx, texto, { fontes, max, min, largura, altura, entre = 1.15, maiusc = false, passo = 2 }) {
  for (let tam = max; tam >= min; tam -= passo) {
    const f = fontes(tam), linhas = linhasRicas(ctx, texto, f, largura, maiusc);
    if (linhas.length * tam * entre <= altura) return { tam, linhas, entre, f };
  }
  const f = fontes(min);
  return { tam: min, linhas: linhasRicas(ctx, texto, f, largura, maiusc), entre, f };
}
// alinhar: "left" | "center" | "right" | "justify"
function escreverRico(ctx, bloco, x, y, cores, alinhar = "left", largura = 0, extra = {}) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  bloco.linhas.forEach((l, i) => {
    const base = y + i * bloco.tam * bloco.entre + bloco.tam * 0.86;
    ctx.font = bloco.f.n; const esp = ctx.measureText(" ").width;
    const vaos = l.itens.filter((p, k) => k > 0 && !p.cola).length;
    const total = l.itens.reduce((s, p) => s + p.w, 0) + vaos * esp;
    let cx = alinhar === "center" ? x - total / 2 : alinhar === "right" ? x - total : x;
    const gap = alinhar === "justify" && !l.fim && vaos > 0 ? (largura - (total - vaos * esp)) / vaos : esp;
    l.itens.forEach((p, k) => {
      if (k > 0 && !p.cola) { if (extra.sublinhado) { ctx.fillStyle = cores.n; ctx.fillRect(cx, base + bloco.tam * 0.12, gap, Math.max(2, bloco.tam * 0.06)); } cx += gap; }
      ctx.font = bloco.f[p.e]; ctx.fillStyle = cores[p.e] || cores.n;
      ctx.fillText(p.t, cx, base);
      if (extra.sublinhado) ctx.fillRect(cx, base + bloco.tam * 0.12, p.w, Math.max(2, bloco.tam * 0.06));
      cx += p.w;
    });
  });
  return y + bloco.linhas.length * bloco.tam * bloco.entre;
}
const serifa = (estilo = "") => (t) => ({ n: `${estilo} 400 ${t}px ${FONTE_SERIFA}`.trim(), a: `italic 700 ${t}px ${FONTE_SERIFA}`, b: `${estilo} 700 ${t}px ${FONTE_SERIFA}`.trim() });
const serifaItalica = (t) => ({ n: `italic 700 ${t}px ${FONTE_SERIFA}`, a: `italic 700 ${t}px ${FONTE_SERIFA}`, b: `italic 700 ${t}px ${FONTE_SERIFA}` });
const bastao = (peso = 500) => (t) => ({ n: `${peso} ${t}px ${FONTE_BASTAO}`, a: `italic 700 ${t * 1.08}px ${FONTE_SERIFA}`, b: `800 ${t}px ${FONTE_BASTAO}` });

/* ---------- Objetos de papel ---------- */
function retanguloRedondo(ctx, x, y, w, h, r, cor) {
  ctx.fillStyle = cor; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath(); ctx.fill();
}
let granulado = null;
function texturaPapel(ctx, forca = 0.07) {
  if (!granulado) {
    granulado = document.createElement("canvas"); granulado.width = granulado.height = 240;
    const g = granulado.getContext("2d"), d = g.createImageData(240, 240);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  ctx.save(); ctx.globalAlpha = forca; ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(granulado, "repeat"); ctx.fillRect(0, 0, W_CAR, H_CAR); ctx.restore();
}
function caixaPapel(ctx, x, y, w, h, r, cor, sombra) {
  ctx.save();
  if (sombra) { ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14; }
  retanguloRedondo(ctx, x, y, w, h, r, cor); ctx.restore();
}
function girar(ctx, cx, cy, graus, desenho) { ctx.save(); ctx.translate(cx, cy); ctx.rotate((graus * Math.PI) / 180); desenho(); ctx.restore(); }
function fotoCobre(ctx, img, x, y, w, h, foco = 0.35) {
  if (!img) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#5b5248"); g.addColorStop(1, "#2b241c");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = `600 ${Math.max(22, Math.min(40, w / 16))}px ${FONTE_BASTAO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("sua foto aqui", x + w / 2, y + h / 2); return;
  }
  const esc = Math.max(w / img.width, h / img.height), iw = img.width * esc, ih = img.height * esc;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * foco, iw, ih); ctx.restore();
}
function fotoRedonda(ctx, img, x, y, w, h, r, foco) { ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.clip(); fotoCobre(ctx, img, x, y, w, h, foco); ctx.restore(); }
function estrelaPapel(ctx, cx, cy, raio, cor, pontas = 12) {
  ctx.fillStyle = cor; ctx.beginPath();
  for (let i = 0; i < pontas * 2; i++) { const r = i % 2 ? raio * 0.55 : raio, a = (Math.PI * i) / pontas; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}
function fita(ctx, cx, cy, graus) { girar(ctx, cx, cy, graus, () => { ctx.fillStyle = "rgba(226,210,174,.82)"; ctx.fillRect(-80, -26, 160, 52); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(-80, -26, 160, 10); }); }
function clipe(ctx, cx, cy, graus) {
  girar(ctx, cx, cy, graus, () => {
    ctx.strokeStyle = "#a9a9a9"; ctx.lineWidth = 7; ctx.lineCap = "round";
    const laco = (w, h, x0) => { ctx.beginPath(); ctx.moveTo(x0, h / 2); ctx.lineTo(x0, -h / 2 + w / 2); ctx.arc(x0 + w / 2, -h / 2 + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x0 + w, h / 2 - 10); ctx.stroke(); };
    laco(46, 150, -23); laco(30, 110, -15);
  });
}
function espacado(ctx, texto, x, y, espaco, alinhar = "center") {
  const letras = [...texto]; const ws = letras.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + espaco * (letras.length - 1);
  let cx = alinhar === "center" ? x - total / 2 : alinhar === "right" ? x - total : x;
  ctx.textAlign = "left"; letras.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + espaco; });
}
function cabecalhoSlide(ctx, cor, i, total) {
  ctx.save(); ctx.fillStyle = cor; ctx.globalAlpha = 0.6; ctx.textBaseline = "alphabetic";
  ctx.font = `600 22px ${FONTE_BASTAO}`; espacado(ctx, `${ASSINATURA.nome}  |  ${ASSINATURA.cargo}`, W_CAR / 2, 74, 3);
  ctx.font = `500 22px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.fillText(ASSINATURA.arroba, M_CAR, H_CAR - 52);
  ctx.textAlign = "right"; ctx.fillText(`${i + 1}/${total}`, W_CAR - M_CAR, H_CAR - 52);
  ctx.restore();
}
function marcaDagua(ctx, cor) { ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = cor; ctx.font = `400 104px ${FONTE_SERIFA}`; ctx.textBaseline = "alphabetic"; espacado(ctx, "UGC Creator", W_CAR / 2, H_CAR - 26, 34); ctx.restore(); }
function arraste(ctx, cx, cy, cor) {
  ctx.save(); ctx.font = `italic 400 30px ${FONTE_SERIFA}`; const w = ctx.measureText("Arraste a tela").width + 50;
  ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - w / 2 - 20, cy - 24, w, 48, 24) : ctx.rect(cx - w / 2 - 20, cy - 24, w, 48); ctx.stroke();
  ctx.fillStyle = cor; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Arraste a tela", cx - 20, cy + 1);
  ctx.beginPath(); ctx.moveTo(cx + w / 2 - 14, cy); ctx.lineTo(cx + w / 2 + 34, cy); ctx.lineTo(cx + w / 2 + 24, cy - 8); ctx.moveTo(cx + w / 2 + 34, cy); ctx.lineTo(cx + w / 2 + 24, cy + 8); ctx.stroke();
  ctx.restore();
}
function etiqueta(ctx, texto, cx, cy, graus, fundo, cor, tam = 40) {
  girar(ctx, cx, cy, graus, () => {
    ctx.font = `800 ${tam}px ${FONTE_BASTAO}`; const w = ctx.measureText(texto).width + tam * 1.1, h = tam * 1.6;
    ctx.fillStyle = fundo; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = cor; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, 0, 2);
  });
}

/* ---------- Desenha um slide ---------- */
function pintarSlide(cv, s, i, total, temaChave, aoCarregar) {
  const T = TEMAS_CARROSSEL[temaChave] || TEMAS_CARROSSEL.ryan;
  const ctx = cv.getContext("2d"), W = W_CAR, H = H_CAR, M = M_CAR, LW = W - M * 2;
  cv.width = W; cv.height = H;
  const tom = T[s.tom] || T[{ texto: "escuro", lista: "claro", numero: "claro", moldura: "claro", polaroid: "claro", colagem: "claro", final: "escuro" }[s.modelo] || "claro"];
  const foco = { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3;
  const f1 = fotoCarrossel(s.foto, aoCarregar), f2 = fotoCarrossel(s.foto2, aoCarregar);
  const fundoTom = () => { ctx.fillStyle = tom.fundo; ctx.fillRect(0, 0, W, H); texturaPapel(ctx); };
  const cores = (c) => ({ n: c.titulo, a: c.destaque, b: c.titulo });

  switch (s.modelo) {
    case "capa": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco);
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.72)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, 0.05);
      const t = caberRico(ctx, s.titulo, { fontes: serifa(), max: 104, min: 56, largura: LW, altura: 420, entre: 1.06 });
      const altT = t.linhas.length * t.tam * t.entre;
      let y = H - 250 - altT;
      if (s.texto) { const p = caberRico(ctx, s.texto, { fontes: bastao(700), max: 40, min: 28, largura: LW, altura: 120, entre: 1.2 }); y -= p.linhas.length * p.tam * p.entre + 16; escreverRico(ctx, p, W / 2, y, { n: "#fff", a: "#fff", b: "#fff" }, "center"); y += p.linhas.length * p.tam * p.entre + 16; }
      if (s.destaque) etiqueta(ctx, s.destaque, W - M - 170, y - 34, -5, T.forte.fundo, T.forte.titulo, 34);
      escreverRico(ctx, t, W / 2, y + (s.destaque ? 14 : 0), { n: "#FFFFFF", a: "#FFFFFF", b: "#FFFFFF" }, "center");
      arraste(ctx, W / 2, H - 175, "rgba(255,255,255,.9)");
      marcaDagua(ctx, "#FFFFFF");
      return;
    }
    case "texto": case "lista": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      const X = 170, LX = W - X - 120;
      ctx.fillStyle = tom.titulo; ctx.font = `500 40px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(i + 1).padStart(2, "0") + ".", X - 40, 300);
      const t = caberRico(ctx, s.titulo, { fontes: serifaItalica, max: 110, min: 60, largura: LX, altura: 400, entre: 1.02 });
      let y = escreverRico(ctx, t, X, 330, cores(tom)) + 46;
      if (s.modelo === "texto") {
        const b = caberRico(ctx, s.texto, { fontes: bastao(500), max: 46, min: 28, largura: LX, altura: H - 160 - y, entre: 1.32 });
        escreverRico(ctx, b, X, y, { n: tom.texto, a: tom.destaque, b: tom.texto }, "left", LX);
      } else {
        const itens = String(s.texto || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 7);
        const esp = Math.min(190, (H - 170 - y) / Math.max(1, itens.length));
        itens.forEach((it, k) => {
          const yy = y + k * esp;
          ctx.fillStyle = tom.destaque; ctx.font = `italic 700 54px ${FONTE_SERIFA}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
          ctx.fillText(String(k + 1).padStart(2, "0"), X - 40, yy + 46);
          const b = caberRico(ctx, it, { fontes: bastao(500), max: 42, min: 28, largura: LX - 60, altura: esp - 20, entre: 1.25 });
          escreverRico(ctx, b, X + 50, yy + 4, { n: tom.texto, a: tom.destaque, b: tom.texto });
        });
      }
      return;
    }
    case "numero": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      let y = 420;
      if (s.texto2) { ctx.fillStyle = tom.titulo; ctx.font = `700 46px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(s.texto2).toUpperCase(), M, y); y += 20; }
      const t = caberRico(ctx, s.titulo, { fontes: (n) => ({ n: `800 ${n}px ${FONTE_BASTAO}`, a: `italic 700 ${n}px ${FONTE_SERIFA}`, b: `800 ${n}px ${FONTE_BASTAO}` }), max: 180, min: 80, largura: LW, altura: 520, entre: 0.98, maiusc: true });
      y = escreverRico(ctx, t, M, y, { n: tom.destaque, a: tom.titulo, b: tom.destaque }) + 50;
      if (s.texto) { ctx.fillStyle = tom.texto; ctx.font = `600 32px ${FONTE_BASTAO}`; ctx.textBaseline = "alphabetic"; espacado(ctx, String(s.texto).toUpperCase(), M, y + 30, 4, "left"); }
      return;
    }
    case "moldura": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      if (s.texto2) { const n = caberRico(ctx, s.texto2, { fontes: serifa(), max: 38, min: 26, largura: 300, altura: 200, entre: 1.15 }); escreverRico(ctx, n, W - M, 130, { n: tom.destaque, a: tom.destaque, b: tom.destaque }, "right"); }
      caixaPapel(ctx, W / 2 - 250, 200, 500, 640, 26, "#000", true);
      fotoRedonda(ctx, f1, W / 2 - 250, 200, 500, 640, 26, foco);
      const t = caberRico(ctx, String(s.titulo || "").replace(/\.(\*\*)?\s+/g, ".$1\n"), { fontes: serifa(), max: 86, min: 46, largura: LW, altura: H - 900 - 100, entre: 1.05 });
      escreverRico(ctx, t, M, 900, { n: tom.destaque, a: tom.destaque, b: tom.destaque });
      return;
    }
    case "notas": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco); ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(0, 0, W, H);
      const cw = 880, cx = (W - cw) / 2;
      const t = caberRico(ctx, s.titulo, { fontes: (n) => ({ n: `800 ${n}px ${FONTE_BASTAO}`, a: `800 ${n}px ${FONTE_BASTAO}`, b: `800 ${n}px ${FONTE_BASTAO}` }), max: 66, min: 38, largura: cw - 120, altura: 420, entre: 1.18, maiusc: true });
      const ch = Math.max(420, t.linhas.length * t.tam * t.entre + 260), cy = (H - ch) / 2 - 20;
      caixaPapel(ctx, cx, cy, cw, ch, 40, "#FFFFFF", true);
      ctx.fillStyle = "#E0A100"; ctx.font = `500 40px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("‹ Notas", cx + 40, cy + 64);
      [0, 1, 2, 3].forEach((k) => { ctx.strokeStyle = k === 1 ? "#c8c8c8" : "#E0A100"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx + cw - 250 + k * 66, cy + 64, 22, 0, Math.PI * 2); ctx.stroke(); });
      escreverRico(ctx, t, cx + 60, cy + 160, { n: "#3A2A1E", a: "#3A2A1E", b: "#3A2A1E" }, "left", 0, { sublinhado: true });
      if (s.texto2) girar(ctx, cx + cw - 120, cy + ch - 10, -8, () => {
        ctx.font = `500 46px ${FONTE_BASTAO}`; const tx = String(s.texto2), w = ctx.measureText(tx).width + 70;
        retanguloRedondo(ctx, -w / 2, -42, w, 84, 42, "#FFFFFF"); retanguloRedondo(ctx, -w / 2 + 6, -36, w - 12, 72, 36, "#1E7CF2");
        ctx.fillStyle = "#1E7CF2"; ctx.beginPath(); ctx.moveTo(w / 2 - 40, 30); ctx.lineTo(w / 2 + 6, 44); ctx.lineTo(w / 2 - 20, 14); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tx, 0, 2);
      });
      return;
    }
    case "polaroid": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      girar(ctx, W / 2, H / 2 + 10, -2.5, () => {
        const pw = 820, ph = 1020;
        caixaPapel(ctx, -pw / 2, -ph / 2, pw, ph, 6, "#FFFFFF", true);
        fotoCobre(ctx, f1, -pw / 2 + 44, -ph / 2 + 44, pw - 88, pw - 88, foco);
        const t = caberRico(ctx, s.titulo, { fontes: (n) => ({ n: `800 ${n}px ${FONTE_BASTAO}`, a: `800 ${n}px ${FONTE_BASTAO}`, b: `800 ${n}px ${FONTE_BASTAO}` }), max: 52, min: 30, largura: pw - 120, altura: ph - pw - 60, entre: 1.15, maiusc: true });
        escreverRico(ctx, t, 0, -ph / 2 + pw + 10, { n: T.claro.destaque, a: T.claro.destaque, b: T.claro.destaque }, "center", 0, { sublinhado: true });
      });
      estrelaPapel(ctx, W - 200, 230, 80, T.acento);
      fita(ctx, 220, 200, -28);
      return;
    }
    case "colagem": {
      fundoTom();
      ctx.fillStyle = tom.titulo; ctx.globalAlpha = 0.75; ctx.font = `600 24px ${FONTE_BASTAO}`; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillText("‹ " + ASSINATURA.nome, M + 150, 80);
      [0, 1, 2, 3].forEach((k) => { ctx.strokeStyle = tom.titulo; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(W - M - 230 + k * 30, 72, 10, 0, Math.PI * 2); ctx.stroke(); });
      ctx.globalAlpha = 1;
      const t = caberRico(ctx, s.titulo, { fontes: serifa(), max: 84, min: 50, largura: LW - 60, altura: 300, entre: 1.05 });
      const yT = escreverRico(ctx, t, W / 2, 130, cores(tom), "center");
      const yF = yT + 30, hF = 470;
      girar(ctx, 330, yF + hF / 2, -4, () => { caixaPapel(ctx, -230, -hF / 2, 460, hF, 4, "#FFFFFF", true); fotoCobre(ctx, f1, -216, -hF / 2 + 14, 432, hF - 28, foco); });
      girar(ctx, 760, yF + hF / 2 + 30, 5, () => { caixaPapel(ctx, -220, -hF / 2, 440, hF, 4, "#FFFFFF", true); fotoCobre(ctx, f2 || null, -206, -hF / 2 + 14, 412, hF - 28, foco); });
      clipe(ctx, 210, yF + 10, -12); clipe(ctx, 860, yF + 40, 18);
      const b = caberRico(ctx, s.texto, { fontes: bastao(500), max: 42, min: 28, largura: LW - 40, altura: H - (yF + hF + 70) - 60, entre: 1.3 });
      escreverRico(ctx, b, W / 2, yF + hF + 80, { n: tom.texto, a: tom.destaque, b: tom.texto }, "center");
      return;
    }
    case "cartao": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco); ctx.fillStyle = "rgba(0,0,0,.1)"; ctx.fillRect(0, 0, W, H);
      const cw = 660, X = M + 10;
      const t = caberRico(ctx, s.titulo, { fontes: serifaItalica, max: 74, min: 44, largura: cw - 90, altura: 320, entre: 1.04 });
      const b = s.texto ? caberRico(ctx, s.texto, { fontes: bastao(500), max: 38, min: 26, largura: cw - 90, altura: 240, entre: 1.3 }) : null;
      const ch = 90 + t.linhas.length * t.tam * t.entre + (b ? 30 + b.linhas.length * b.tam * b.entre : 0);
      const Y = 360;
      caixaPapel(ctx, X, Y, cw, ch, 4, "#F7F4EE", true); ctx.save(); ctx.beginPath(); ctx.rect(X, Y, cw, ch); ctx.clip(); texturaPapel(ctx, 0.08); ctx.restore();
      let y = escreverRico(ctx, t, X + 45, Y + 45, { n: T.escuro.fundo, a: T.claro.destaque, b: T.escuro.fundo });
      if (b) escreverRico(ctx, b, X + 45, y + 30, { n: "#3A3128", a: T.claro.destaque, b: "#2B241C" });
      if (s.texto2) {
        const nb = caberRico(ctx, s.texto2, { fontes: bastao(600), max: 40, min: 26, largura: 360, altura: 260, entre: 1.25 });
        const nh = nb.linhas.length * nb.tam * nb.entre + 90, nx = W - M - 220, ny = Y + ch - 40 + nh / 2;
        girar(ctx, nx, ny, 5, () => { caixaPapel(ctx, -210, -nh / 2, 420, nh, 2, T.acento, true); escreverRico(ctx, nb, 0, -nh / 2 + 45, { n: "#fff", a: "#fff", b: "#fff" }, "center"); });
        clipe(ctx, nx + 170, ny - nh / 2 + 10, 20);
      }
      return;
    }
    case "frase": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(0, 0, W, H);
      const t = caberRico(ctx, s.titulo, { fontes: serifa(), max: 68, min: 40, largura: 620, altura: 700, entre: 1.25 });
      escreverRico(ctx, t, W / 2, (H - t.linhas.length * t.tam * t.entre) / 2, { n: "#fff", a: "#fff", b: "#fff" }, "center");
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = `500 22px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(ASSINATURA.arroba, M, H - 52);
      ctx.textAlign = "right"; ctx.fillText(`${i + 1}/${total}`, W - M, H - 52);
      return;
    }
    default: { // final
      fundoTom();
      const temFoto = !!s.foto;
      const t = caberRico(ctx, s.titulo, { fontes: bastao(700), max: 56, min: 34, largura: LW, altura: 200, entre: 1.15 });
      let y = escreverRico(ctx, t, W / 2, 110, { n: tom.destaque, a: tom.destaque, b: tom.destaque }, "center") + 40;
      if (temFoto) { caixaPapel(ctx, W / 2 - 300, y, 600, 470, 2, "#F7F4EE", true); fotoCobre(ctx, f1, W / 2 - 280, y + 20, 560, 430, foco); y += 470 + 50; }
      else y = 360;
      if (s.texto) { const b = caberRico(ctx, s.texto, { fontes: bastao(700), max: 54, min: 32, largura: LW, altura: 200, entre: 1.15 }); y = escreverRico(ctx, b, W / 2, y, { n: tom.titulo, a: tom.destaque, b: tom.titulo }, "center") + 24; }
      if (s.destaque) {
        const d = caberRico(ctx, s.destaque, { fontes: bastao(800), max: 44, min: 28, largura: LW - 120, altura: 120, entre: 1.15 });
        const dw = Math.max(...d.linhas.map((l) => l.itens.reduce((a, p) => a + p.w, 0))) + 120, dh = d.linhas.length * d.tam * d.entre + 40;
        ctx.fillStyle = tom.destaque; ctx.fillRect(W / 2 - dw / 2, y, dw, dh);
        escreverRico(ctx, d, W / 2, y + 20, { n: tom.fundo, a: tom.fundo, b: tom.fundo }, "center"); y += dh;
      }
      if (s.texto2) { ctx.fillStyle = tom.titulo; ctx.font = `400 110px ${FONTE_MAO}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(s.texto2, W / 2 + 120, Math.min(H - 90, y + 110)); }
      return;
    }
  }
}

async function carregarCarrosseis() {
  const { data, error } = await db.from("carrosseis").select("*").order("atualizado_em", { ascending: false }).limit(60);
  igx.carrosseis = error ? [] : data || [];
  igx.faltaCarrosseis = !!error;
}
const novoSlide = (modelo) => ({ modelo, titulo: "", texto: "" });

function desenharCarrossel(el) {
  if (igx.carrosseis === null) { el.innerHTML = `<p class="vazio">Abrindo o gerador...</p>`; Promise.all([carregarCarrosseis(), carregarFontesCarrossel()]).then(desenhar); return; }
  if (igx.faltaCarrosseis) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 27 do banco.sql no Supabase.</div>`; return; }
  if (!igx.car) igx.car = JSON.parse(JSON.stringify(CARROSSEL_EXEMPLO));
  const car = igx.car;
  car.slides.forEach((s) => { if (!MODELOS_SLIDE.some((m) => m[0] === s.modelo)) s.modelo = s.modelo === "comparacao" ? "cartao" : "texto"; });
  if (!TEMAS_CARROSSEL[car.tema]) car.tema = "ryan";
  const T = TEMAS_CARROSSEL[car.tema];
  let guiaAberto = false; try { guiaAberto = localStorage.getItem("ig-guia") === "1"; } catch (_) {}
  const amostra = (k) => `<span class="car-amostra" style="background:${T[k].fundo};color:${T[k].titulo}"><b>Aa</b><i style="color:${T[k].destaque}">Aa</i></span>`;

  const campoHtml = (s, i, c) => {
    const rot = (ROTULOS_CAMPO[s.modelo] || {})[c] || c;
    if (c === "tom") return `<label class="car-campo-curto">Fundo <select class="campo" data-k="tom">${[["claro", "Claro"], ["escuro", "Escuro"], ["forte", "Cor forte"]].map(([v, n]) => `<option value="${v}" ${(s.tom || "") === v ? "selected" : ""}>${n}</option>`).join("")}<option value="" ${!s.tom ? "selected" : ""}>Padrão</option></select></label>`;
    if (c === "foto" || c === "foto2") return `<div class="car-foto">
        ${s[c] ? `<img src="${esc(s[c])}" alt="" crossorigin="anonymous">` : `<span class="car-foto-vazia">📷</span>`}
        <label class="btn pequeno">${s[c] ? "Trocar foto" : c === "foto2" ? "Segunda foto" : "Subir foto"}<input type="file" accept="image/*" data-foto="${c}" hidden></label>
        ${s[c] ? `<button class="btn pequeno" type="button" data-tirar-foto="${c}">Tirar</button>` : ""}
        ${c === "foto" && s.foto ? `<select class="campo" data-k="enquadrar" aria-label="Enquadrar">${[["", "Enquadrar: auto"], ["topo", "Mostrar o topo"], ["meio", "Centro"], ["baixo", "Mostrar embaixo"]].map(([v, n]) => `<option value="${v}" ${(s.enquadrar || "") === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
        ${s.dicaFoto && c === "foto" ? `<small class="sub">Sugestão: ${esc(s.dicaFoto)}</small>` : ""}
      </div>`;
    const longo = (c === "texto" && ["texto", "lista", "colagem", "cartao"].includes(s.modelo)) || (c === "titulo" && ["notas", "frase", "moldura"].includes(s.modelo));
    return longo ? `<textarea class="campo" data-k="${c}" rows="${s.modelo === "lista" && c === "texto" ? 4 : 2}" placeholder="${esc(rot)}">${esc(s[c] || "")}</textarea>`
      : `<input class="campo" data-k="${c}" value="${esc(s[c] || "")}" placeholder="${esc(rot)}">`;
  };

  el.innerHTML = `
    <details class="cartao car-guia" id="car-guia" ${guiaAberto ? "open" : ""}>
      <summary><b>🎨 O seu sistema visual</b> <span class="sub">o jeito Ryan de fazer carrossel</span></summary>
      <div class="car-guia-grade">
        <div><h3 class="pro-titulo">Paleta: ${esc(T.nome)}</h3>
          <div class="car-tons">${amostra("claro")}${amostra("escuro")}${amostra("forte")}</div>
          <p class="sub">Use sempre a mesma paleta. Troque só se for uma série especial.</p></div>
        <div><h3 class="pro-titulo">Letras</h3>
          <p class="car-f-serifa">Playfair Display <i>itálica</i></p>
          <p class="car-f-bastao">MONTSERRAT GROSSA</p>
          <p class="car-f-mao">Allura, a letra de mão</p></div>
        <div><h3 class="pro-titulo">Sua assinatura</h3>
          <ul class="passos"><li>Foto sua na capa, sempre. Rosto aparece, carrossel rende.</li><li>"Arraste a tela →" e a marca d'água UGC Creator na capa.</li><li>RYAN ALVES | UGC CREATOR no topo dos slides de texto.</li><li>Só uma palavra destacada por título.</li></ul></div>
        <div><h3 class="pro-titulo">Regras de ouro</h3>
          <ul class="passos"><li>1 ideia por slide, no máximo 30 palavras.</li><li>Capa: promessa clara em até 10 palavras.</li><li>De 5 a 8 slides. Alterne foto e texto.</li><li>Último slide: chamada (salvar, seguir ou link na bio).</li><li>Legenda: repita o gancho na primeira linha.</li></ul></div>
      </div>
    </details>

    <section class="cartao car-barra">
      <input class="campo" id="car-titulo" value="${esc(car.titulo)}" aria-label="Nome do carrossel" placeholder="Nome do carrossel">
      <select class="campo" id="car-tema" aria-label="Paleta">${Object.entries(TEMAS_CARROSSEL).map(([k, t]) => `<option value="${k}" ${car.tema === k ? "selected" : ""}>🎨 ${esc(t.nome)}</option>`).join("")}</select>
      <span class="espaco"></span>
      <select class="campo" id="car-abrir" aria-label="Abrir carrossel salvo"><option value="">📂 Abrir salvo (${igx.carrosseis.length})</option>${igx.carrosseis.map((c) => `<option value="${esc(c.id)}">${esc(c.titulo)} · ${dataBR(String(c.atualizado_em).slice(0, 10)).slice(0, 5)}</option>`).join("")}</select>
      <button class="btn" type="button" id="car-novo">Novo</button>
      <button class="btn" type="button" id="car-salvar">💾 Salvar</button>
      <button class="btn primario" type="button" id="car-baixar">⬇️ Baixar imagens</button>
    </section>
    <p class="sub car-ajuda">Dica: escreva <b>*palavra*</b> para itálico colorido e <b>**palavra**</b> para negrito.</p>

    <div class="car-grade">
      <div class="car-slides" id="car-slides">${car.slides.map((s, i) => {
        const mod = MODELOS_SLIDE.find((m) => m[0] === s.modelo) || MODELOS_SLIDE[1];
        return `<div class="cartao car-slide" data-i="${i}">
          <div class="car-slide-topo"><b>${i + 1}</b>
            <select class="campo" data-k="modelo" aria-label="Modelo do slide ${i + 1}">${MODELOS_SLIDE.map(([v, n]) => `<option value="${v}" ${s.modelo === v ? "selected" : ""}>${n}</option>`).join("")}</select>
            <span class="espaco"></span>
            <button class="btn pequeno" type="button" data-mover="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
            <button class="btn pequeno" type="button" data-mover="1" ${i === car.slides.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
            <button class="btn pequeno" type="button" data-copiar-slide aria-label="Duplicar slide">⧉</button>
            <button class="btn pequeno" type="button" data-tirar aria-label="Tirar slide">✕</button></div>
          ${mod[3].map((c) => campoHtml(s, i, c)).join("")}
          <p class="sub car-dica">${esc(mod[2])} ${palavrasDe(s) > 30 ? `<b class="car-muito">${palavrasDe(s)} palavras: tente deixar em 30.</b>` : ""}</p>
        </div>`; }).join("")}
        <div class="car-mais">
          <select class="campo" id="car-modelo-novo" aria-label="Modelo do slide novo">${MODELOS_SLIDE.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select>
          <button class="btn" type="button" id="car-mais" ${car.slides.length >= 10 ? "disabled" : ""}>${ic("mais")}Slide</button>
        </div>
      </div>
      <div class="car-previa" id="car-previa">${car.slides.map((_, i) => `<canvas class="car-tela" data-tela="${i}" width="1080" height="1350" aria-label="Prévia do slide ${i + 1}"></canvas>`).join("")}</div>
    </div>`;

  const pintarUm = (i) => { const cv = $(`[data-tela="${i}"]`, el); if (cv && car.slides[i]) pintarSlide(cv, car.slides[i], i, car.slides.length, car.tema, () => pintarUm(i)); };
  const pintarTudo = () => car.slides.forEach((_, i) => pintarUm(i));
  pintarTudo();
  carregarFontesCarrossel().then(pintarTudo);

  $("#car-guia").addEventListener("toggle", (e) => { try { localStorage.setItem("ig-guia", e.target.open ? "1" : "0"); } catch (_) {} });
  $("#car-titulo").oninput = (e) => { car.titulo = e.target.value; };
  $("#car-tema").onchange = (e) => { car.tema = e.target.value; desenhar(); };
  let espera = null;
  $("#car-slides").addEventListener("input", (e) => {
    const box = e.target.closest(".car-slide"), k = e.target.dataset.k;
    if (!box || !k || k === "modelo" || e.target.tagName === "SELECT") return;
    const i = Number(box.dataset.i);
    car.slides[i][k] = e.target.value;
    clearTimeout(espera); espera = setTimeout(() => pintarUm(i), 120);
  });
  $("#car-slides").addEventListener("change", async (e) => {
    const box = e.target.closest(".car-slide"); if (!box) return;
    const i = Number(box.dataset.i), s = car.slides[i];
    if (e.target.dataset.k === "modelo") { s.modelo = e.target.value; desenhar(); return; }
    if (e.target.tagName === "SELECT" && e.target.dataset.k) { s[e.target.dataset.k] = e.target.value; pintarUm(i); return; }
    const campoFoto = e.target.dataset.foto;
    if (campoFoto && e.target.files && e.target.files[0]) {
      const rotulo = e.target.closest("label"); rotulo.firstChild.textContent = "Enviando...";
      try {
        const arq = await prepararFoto(e.target.files[0]);
        const url = await enviarArquivo(arq, "carrosseis", "foto.jpg");
        if (url) { s[campoFoto] = url; desenhar(); avisar("Foto no slide."); }
        else rotulo.firstChild.textContent = "Subir foto";
      } catch (erro) { avisar(erro.message || "Não deu para usar essa foto.", true); rotulo.firstChild.textContent = "Subir foto"; }
    }
  });
  $("#car-slides").addEventListener("click", (e) => {
    const box = e.target.closest(".car-slide"); if (!box) return;
    const i = Number(box.dataset.i);
    const mv = e.target.closest("[data-mover]");
    if (mv) { const j = i + Number(mv.dataset.mover); [car.slides[i], car.slides[j]] = [car.slides[j], car.slides[i]]; desenhar(); return; }
    if (e.target.closest("[data-copiar-slide]")) { if (car.slides.length >= 10) { avisar("No máximo 10 slides.", true); return; } car.slides.splice(i + 1, 0, JSON.parse(JSON.stringify(car.slides[i]))); desenhar(); return; }
    const tf = e.target.closest("[data-tirar-foto]"); if (tf) { delete car.slides[i][tf.dataset.tirarFoto]; desenhar(); return; }
    if (e.target.closest("[data-tirar]")) { if (car.slides.length <= 1) { avisar("O carrossel precisa de pelo menos 1 slide.", true); return; } car.slides.splice(i, 1); desenhar(); }
  });
  $("#car-mais").onclick = () => { const novo = novoSlide($("#car-modelo-novo").value); const fim = car.slides[car.slides.length - 1]; if (fim && fim.modelo === "final") car.slides.splice(car.slides.length - 1, 0, novo); else car.slides.push(novo); desenhar(); };
  $("#car-novo").onclick = () => { igx.car = { titulo: "Novo carrossel", tema: car.tema, slides: [novoSlide("capa"), { ...novoSlide("texto"), tom: "escuro" }, { ...novoSlide("final"), tom: "escuro", destaque: "Salva esse post", texto2: "Link na bio" }] }; desenhar(); };
  $("#car-abrir").onchange = (e) => {
    const c = igx.carrosseis.find((x) => String(x.id) === e.target.value); if (!c) return;
    const dados = Array.isArray(c.slides) ? { slides: c.slides } : c.slides || {};
    igx.car = { id: c.id, titulo: c.titulo, tema: dados.tema || "ryan", slides: JSON.parse(JSON.stringify(dados.slides || [])) }; desenhar();
  };
  $("#car-salvar").onclick = async () => {
    const dados = { titulo: (car.titulo || "Carrossel").slice(0, 200), slides: { tema: car.tema, slides: car.slides }, atualizado_em: new Date().toISOString() };
    const { data, error } = await (car.id ? db.from("carrosseis").update(dados).eq("id", car.id).select().single() : db.from("carrosseis").insert(dados).select().single());
    if (error) { avisar(traduzErro(error), true); return; }
    car.id = data.id; await carregarCarrosseis(); avisar("Carrossel salvo."); desenhar();
  };
  $("#car-baixar").onclick = async (e) => {
    const b = e.target; b.disabled = true; b.textContent = "Preparando...";
    try {
      await carregarFontesCarrossel(); await esperarFotos(car.slides);
      const nome = (car.titulo || "carrossel").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "carrossel";
      const arquivos = [];
      for (let i = 0; i < car.slides.length; i++) {
        const cv = document.createElement("canvas");
        pintarSlide(cv, car.slides[i], i, car.slides.length, car.tema);
        const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.93));
        arquivos.push(new File([blob], `${nome}-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
      }
      // No celular: abre o "compartilhar" para salvar tudo nas Fotos de uma vez
      if (navigator.canShare && navigator.canShare({ files: arquivos }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: arquivos, title: car.titulo }).catch(() => {});
      } else {
        for (const f of arquivos) {
          const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          await new Promise((ok) => setTimeout(ok, 350));
        }
        avisar(`${plural(arquivos.length, "imagem", "imagens")} na pasta Downloads (1080 x 1350, o tamanho certo do Instagram).`);
      }
    } catch (erro) { avisar("Não deu para gerar as imagens: " + (erro.message || erro), true); }
    b.disabled = false; b.textContent = "⬇️ Baixar imagens";
  };
}
const palavrasDe = (s) => [s.titulo, s.texto, s.texto2, s.destaque].join(" ").replace(/\*/g, "").split(/\s+/).filter(Boolean).length;

/* =============================================================
   🗣️ MINHA VOZ: roteiros prontos para gravar, do seu jeito
   O guia de voz fica no banco (preferencias, chave "guia_voz").
   Cada ideia tem o botão "✍️ Roteiro na minha voz", que junta o
   guia, a ideia, a referência e o formato certo num pedido pronto
   para colar no Claude.
   ============================================================= */
const VOZ_PADRAO = `QUEM EU SOU
Ryan Alves (@ryalvz), creator UGC de Tech & Lifestyle. 12 anos em vendas B2B antes do UGC. Mais de 40 marcas no portfólio. Uma campanha passou de 2 milhões de alcance.

MEU TOM
Próximo, de amigo contando uma coisa que descobriu. Confiante sem ser arrogante. Humor leve e autoironia ("e quem nunca...?", "quem é você da dupla?").

COMO EU ESCREVO E FALO
Frases curtas, uma ideia por frase. Muitas vezes uma frase por linha, criando ritmo: "Eu não tinha nenhuma marca. Nenhum cliente. Só a vontade de tentar."
Português do dia a dia: pra, tá, né, gente. Sem gíria forçada.
Uso números reais e a minha própria experiência como prova (3 meses, 40 marcas, 2 milhões).

COMO EU ABRO
Pergunta direta em que a pessoa se reconhece: "Você também achava que o Hollyland servia só pra gravar áudio?"
Ou uma confissão que puxa história: "Há 1 ano eu gravava esse vídeo para criar meu primeiro portfólio."

COMO EU FECHO
Chamada simples e natural: "salva pra não esquecer", "me conta nos comentários", "segue que tem parte 2".

O QUE FUNCIONA COMIGO
Dica prática de iPhone, equipamento e app (é o que mais salvam e compartilham).
Série com episódios (EP. 1, EP. 2), como o Diário de Mudança.
Bastidores de creator e história pessoal com virada.

O QUE EVITAR
Cara de anúncio e palavra de vendedor ("imperdível", "revolucionário").
Textão. Travessão. Emoji demais (1 a 3 por legenda).`;
let vozGuia = null, vozFalta = false;
async function carregarVoz() {
  if (vozGuia !== null) return vozGuia;
  const { data, error } = await db.from("preferencias").select("valor").eq("chave", "guia_voz").maybeSingle();
  vozFalta = !!error;
  vozGuia = (data && data.valor) || VOZ_PADRAO;
  return vozGuia;
}

const FORMATO_ROTEIRO = {
  organico: `FORMATO: Reels orgânico para o MEU Instagram (Tech & Lifestyle e bastidores de UGC).
De 30 a 60 segundos de fala (uns 80 a 150 palavras). O objetivo é alcance, salvamento e seguidores novos, NÃO vender produto.
Gancho nos 3 primeiros segundos, ritmo rápido, uma virada ou revelação perto do fim.`,
  tiktok_shop: `FORMATO: vídeo de venda para o TikTok Shop (afiliado).
De 15 a 40 segundos. Estrutura: dor ou situação real, produto em uso na mão, 2 ou 3 benefícios concretos que dá para ver na tela, prova (antes e depois, teste, detalhe), chamada para o carrinho laranja.
Fale do preço ou da oferta só se fizer sentido. Nada de promessa exagerada ou proibida.`,
  publi: `FORMATO: vídeo UGC para uma marca (publi).
De 20 a 45 segundos, com cara de cliente de verdade, não de anúncio. Siga o briefing das observações, se tiver.
Estrutura: gancho, dor, produto em uso, benefício principal com prova, chamada da marca.`
};

function roteiroNaMinhaVoz(t) {
  carregarVoz().then((voz) => {
    const cat = FORMATO_ROTEIRO[t.categoria] ? t.categoria : "organico";
    const montar = () => `Você vai escrever um roteiro pronto para eu gravar, do MEU jeito de falar.

MEU GUIA DE VOZ (siga à risca)
${voz}

${FORMATO_ROTEIRO[cat]}

A IDEIA
Título: ${t.titulo || "sem título"}
${t.minha_versao ? `O que eu já anotei:\n${t.minha_versao}\n` : ""}${t.observacoes ? `Observações:\n${t.observacoes}\n` : ""}${t.transcricao ? `Referência (vídeo de ${t.perfil || "outra pessoa"}): use só a ESTRUTURA, nunca copie as frases.\n${String(t.transcricao).slice(0, 2500)}\n` : ""}
ME ENTREGUE ASSIM
1. GANCHOS: 3 opções diferentes de primeira frase (pergunta, confissão e afirmação polêmica).
2. ROTEIRO: fala por fala, uma frase por linha, do jeito que eu falaria olhando pra câmera. Entre colchetes, o que aparece na tela: [CENA: ...] e [TEXTO NA TELA: ...].
3. CHAMADA FINAL.
4. ${cat === "tiktok_shop" ? "TEXTO DO POST para o TikTok, curto, com 3 a 5 hashtags." : cat === "publi" ? "LEGENDA sugerida para a marca." : "LEGENDA para o Instagram: repita o gancho na primeira linha, 1 a 3 emojis, 3 a 5 hashtags."}
5. DICAS DE GRAVAÇÃO: enquadramento, cenas de apoio e duração estimada.

Português do Brasil, natural, sem cara de anúncio. Não use travessão em nenhum texto.`;
    const d = abrirJanelaSimples("✍️ Roteiro na minha voz", `
      <p class="sub" style="margin-top:0">O pedido já leva o seu guia de voz, a ideia${t.transcricao ? ", a referência" : ""} e o formato de <b>${esc((CATEGORIAS.find((c) => c[0] === cat) || [0, ""])[1])}</b>.</p>
      <ol class="passos"><li>Toque em <b>Copiar o pedido</b> e cole no Claude.</li><li>Ajuste o que quiser conversando com ele.</li><li>Cole o roteiro final em <b>Minha versão</b> e salve. Pronto pra gravar.</li></ol>
      ${vozGuia === VOZ_PADRAO ? `<p class="sub">Dica: em <b>🗣️ Minha voz</b> (embaixo da lista de roteiros) dá para deixar o guia ainda mais com a sua cara.</p>` : ""}
      <textarea class="campo" id="rv-prompt" rows="10" style="width:100%;font-size:12px" readonly>${esc(montar())}</textarea>`,
      `<a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude ↗</a><button type="button" class="btn primario" id="rv-copiar">📋 Copiar o pedido</button>`);
    $("#rv-copiar", d).onclick = async () => {
      try { await navigator.clipboard.writeText($("#rv-prompt", d).value); $("#rv-copiar", d).textContent = "copiado ✓"; avisar("Pedido copiado. Cole no Claude."); }
      catch (_) { $("#rv-prompt", d).select(); avisar("Selecionei o texto: aperte Cmd + C para copiar.", true); }
    };
  });
}

async function abrirMinhaVoz() {
  const voz = await carregarVoz();
  // Material para o Claude entender o seu jeito: seus roteiros e suas legendas
  const meus = S.transcricoes.filter((t) => t.de_quem === "minha" && (t.minha_versao || t.transcricao || t.legenda)).slice(0, 12);
  let legendas = [];
  if (ig.dados && ig.dados.posts) legendas = ig.dados.posts.filter((x) => x.legenda && n2(x.reach)).sort((a, b) => n2(b.reach) - n2(a.reach)).slice(0, 15);
  const pedidoGuia = () => `Leia os meus textos abaixo (roteiros e legendas que eu mesmo escrevi) e monte o meu GUIA DE VOZ para roteiros, no mesmo formato do guia atual: QUEM EU SOU, MEU TOM, COMO EU ESCREVO E FALO, COMO EU ABRO, COMO EU FECHO, O QUE FUNCIONA COMIGO, O QUE EVITAR.
Use exemplos reais tirados dos meus textos. Seja específico (palavras que eu repito, tamanho das frases, tipo de humor). Não use travessão. Me devolva só o guia, pronto para colar.

GUIA ATUAL
${voz}

MEUS ROTEIROS
${meus.map((t) => `### ${t.titulo || "sem título"}\n${String(t.minha_versao || t.transcricao || t.legenda).slice(0, 1500)}`).join("\n\n") || "(ainda não tenho roteiros meus salvos)"}

MINHAS LEGENDAS COM MAIS ALCANCE
${legendas.map((x) => `- (${num(x.reach)} de alcance) ${String(x.legenda).replace(/\s+/g, " ").slice(0, 600)}`).join("\n") || "(abra a aba Instagram antes para eu juntar as legendas)"}`;
  const d = abrirJanelaSimples("🗣️ Minha voz", `
    <p class="sub" style="margin-top:0">É o jeito como você fala. Todo "✍️ Roteiro na minha voz" usa este guia. Quanto mais parecido com você, menos você precisa mexer antes de gravar.</p>
    ${vozFalta ? `<div class="aviso-falta">Falta rodar a parte 28 do banco.sql no Supabase para o guia ficar salvo.</div>` : ""}
    <textarea class="campo" id="vz-texto" rows="14" style="width:100%;font-size:13px">${esc(voz)}</textarea>
    <details style="margin-top:10px"><summary><b>Deixar o guia mais a minha cara com o Claude</b></summary>
      <ol class="passos" style="margin-top:8px"><li>Copie o pedido: ele junta ${plural(meus.length, "roteiro seu", "roteiros seus")} e ${plural(legendas.length, "legenda", "legendas")} dos seus posts.</li><li>Cole no Claude e copie o guia que ele devolver.</li><li>Cole aqui em cima no lugar do texto e salve.</li></ol>
      <button type="button" class="btn" id="vz-pedido">📋 Copiar o pedido</button>
    </details>`,
    `<button type="button" class="btn" data-fechar>Fechar</button><button type="button" class="btn primario" id="vz-salvar">💾 Salvar</button>`);
  $("#vz-pedido", d).onclick = async () => { try { await navigator.clipboard.writeText(pedidoGuia()); avisar("Pedido copiado. Cole no Claude."); } catch (_) { avisar("Não deu para copiar.", true); } };
  $("#vz-salvar", d).onclick = async () => {
    const valor = $("#vz-texto", d).value.trim();
    if (!valor) { avisar("O guia não pode ficar vazio.", true); return; }
    const { error } = await db.from("preferencias").upsert({ chave: "guia_voz", valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (error) { avisar("Falta rodar a parte 28 do banco.sql no Supabase.", true); return; }
    vozGuia = valor; vozFalta = false; d.close(); avisar("Guia de voz salvo. Os próximos roteiros já saem assim.");
  };
}

/* ---------- 👁️ Tudo de um post do plano numa janela ----------
   Junta o que está no plano (gancho, por quê), o roteiro das ideias
   citadas (#34 etc.: ganchos, roteiro, chamada, legenda, hashtags,
   dicas) e o trecho da pesquisa que fala do post. Cada parte tem
   o seu botão de copiar. */
const SECOES_ROTEIRO = [["ganchos", /^GANCHOS?\b/i], ["roteiro", /^ROTEIRO\b/i], ["chamada", /^CHAMADA( FINAL)?\b/i], ["legenda", /^(LEGENDA|TEXTO DO POST)\b/i], ["dicas", /^DICAS( DE GRAVA[ÇC][ÃA]O)?\b/i], ["anotacao", /^ANOTA[ÇC][ÃA]O ORIGINAL\b/i]];
function partesDoRoteiro(texto) {
  const partes = {}; let atual = "inicio";
  String(texto || "").split("\n").forEach((bruta) => {
    const l = bruta.replace(/^[#>\s*]+/, "").replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim();
    // Título de parte: "GANCHOS", "**Legenda**", "3. CHAMADA FINAL:", "## Roteiro"
    const semParenteses = l.replace(/\(.*?\)/g, "").replace(/:.*$/, "").trim();
    const ehTitulo = l.length < 70 && (semParenteses === semParenteses.toUpperCase() || /:\s*$/.test(l) || /^\s*(#|\*\*|\d+[.)])/.test(bruta));
    const achou = ehTitulo && SECOES_ROTEIRO.find(([, re]) => re.test(l));
    if (achou) { atual = achou[0]; partes[atual] = []; return; }
    (partes[atual] = partes[atual] || []).push(bruta);
  });
  Object.keys(partes).forEach((k) => { partes[k] = partes[k].join("\n").trim(); if (!partes[k]) delete partes[k]; });
  return partes;
}
const ganchosDe = (txt) => String(txt || "").split("\n").map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").replace(/^["“]|["”]$/g, "").trim()).filter((l) => l.length > 3);
const hashtagsDe = (txt) => [...new Set((String(txt || "").match(/#[\p{L}\d_]+/gu) || []))];

function abrirPostDoPlano(plano, it, evento) {
  const numeros = [...String(it.tema || "").matchAll(/#(\d+)/g)].map((m) => m[1]);
  const ideias = numeros.map((n) => S.transcricoes.find((t) => String(t.id) === n)).filter(Boolean);
  const dia = (DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0, it.dia]);
  const data = somaDiasISO(dia[1] || 0, plano.semana);
  const car = ((plano.itens || {}).carrosseis || []).find((c) => semAcento(c.titulo).includes(semAcento(String(it.tema).replace(/#\d+\s*/g, "")).slice(0, 16)));
  // Trecho da pesquisa que fala deste post (fora a própria linha do plano)
  const chaves = [...numeros.map((n) => "#" + n), semAcento(String(it.tema).replace(/#\d+\s*/g, "")).slice(0, 18)].filter((x) => x.length > 2);
  const trechos = String(plano.resposta || "").split("\n").map((l) => l.trim()).filter((l) => l && !/^(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)\s*\|/i.test(l.replace(/^[|*\s-]+/, "")) && chaves.some((c) => semAcento(l).includes(semAcento(c)))).slice(0, 6);

  const copiaveis = [];
  const btnCopiar = (texto, rotulo = "📋") => { copiaveis.push(texto); return `<button type="button" class="btn pequeno" data-copiar="${copiaveis.length - 1}">${rotulo}</button>`; };
  const bloco = (titulo, texto, extra = "") => texto ? `<section class="pp-bloco"><div class="pp-bloco-topo"><h4>${titulo}</h4>${btnCopiar(texto, "📋 Copiar")}</div><div class="pp-texto">${esc(texto).replace(/\n/g, "<br>")}</div>${extra}</section>` : "";

  // Ganchos: o do plano + os do roteiro
  const ganchos = [...new Set([it.gancho, ...ideias.flatMap((t) => ganchosDe(partesDoRoteiro(t.minha_versao).ganchos))].map((g) => String(g || "").replace(/^["“]|["”]$/g, "").trim()).filter(Boolean))];

  const htmlIdeias = ideias.map((t) => {
    const p = partesDoRoteiro(t.minha_versao);
    const pronto = !!(p.roteiro || p.legenda);
    const tags = hashtagsDe(p.legenda);
    return `<div class="pp-ideia">
      <div class="pp-ideia-topo"><b>#${t.id} ${esc(t.titulo || "")}</b><span class="espaco"></span>
        <button type="button" class="btn pequeno" data-ir-ideia="${t.id}">Abrir nos Roteiros</button></div>
      ${pronto ? `
        ${bloco("🎬 Roteiro", p.roteiro)}
        ${bloco("📣 Chamada final", p.chamada)}
        ${bloco("📝 Legenda", p.legenda, tags.length ? `<div class="pp-tags">${tags.map((h) => `<span class="pilula">${esc(h)}</span>`).join(" ")} ${btnCopiar(tags.join(" "), "📋 Hashtags")}</div>` : "")}
        ${bloco("🎥 Dicas de gravação", p.dicas)}`
      : `<p class="sub">${t.minha_versao ? "Essa ideia tem anotações, mas ainda não tem roteiro pronto." : "Essa ideia ainda não tem roteiro."}</p>
        ${t.minha_versao ? bloco("Suas anotações", t.minha_versao) : ""}
        <button type="button" class="btn primario" data-voz="${t.id}">✍️ Fazer o roteiro na minha voz</button>`}
    </div>`;
  }).join("");

  const d = abrirJanelaSimples(`${esc(dia[2])} ${dataBR(data).slice(0, 5)} · ${esc(it.formato)}`, `
    <h3 class="pp-tema">${esc(it.tema)}</h3>
    ${it.porque ? `<p class="pp-porque">💡 ${esc(it.porque)}</p>` : ""}
    ${ganchos.length ? `<section class="pp-bloco"><div class="pp-bloco-topo"><h4>🪝 Ganchos</h4></div>
      <ul class="pp-ganchos">${ganchos.map((g) => `<li><span>“${esc(g)}”</span>${btnCopiar(g)}</li>`).join("")}</ul></section>` : ""}
    ${htmlIdeias || `<section class="pp-bloco"><p class="sub" style="margin:0 0 8px">Esse post não está ligado a uma ideia dos Roteiros, então ainda não tem roteiro, legenda nem hashtags.</p>
      <button type="button" class="btn primario" data-voz-novo>✍️ Fazer o roteiro na minha voz</button></section>`}
    ${car ? `<section class="pp-bloco"><div class="pp-bloco-topo"><h4>🎨 Slides do carrossel</h4><button type="button" class="btn pequeno primario" data-abrir-car>Abrir no gerador</button></div>
      <ol class="pp-slides">${car.slides.map((sl) => `<li><span class="pilula">${esc((MODELOS_SLIDE.find((m) => m[0] === sl.modelo) || [0, sl.modelo])[1])}</span> ${esc([sl.titulo, sl.texto].filter(Boolean).join(" · ").replace(/\*/g, ""))}</li>`).join("")}</ol></section>` : ""}
    ${trechos.length ? `<details class="pp-bloco"><summary><b>🔎 O que a pesquisa falou desse post</b></summary><div class="pp-texto">${trechos.map((l) => esc(l.replace(/\*\*/g, ""))).join("<br>")}</div></details>` : ""}`,
    `${evento ? `<button type="button" class="btn" data-editar-evento>Editar data e hora</button>` : `<button type="button" class="btn" data-agenda>📅 Pôr na agenda</button>`}<button type="button" class="btn primario" data-fechar>Fechar</button>`);
  d.classList.add("janela-larga");
  d.addEventListener("close", () => { d.classList.remove("janela-larga"); d.onclick = null; }, { once: true });

  d.onclick = async (e) => {
    const c = e.target.closest("[data-copiar]");
    if (c) { try { await navigator.clipboard.writeText(copiaveis[Number(c.dataset.copiar)]); const antes = c.textContent; c.textContent = "copiado ✓"; setTimeout(() => { c.textContent = antes; }, 1500); } catch (_) { avisar("Não deu para copiar.", true); } return; }
    const ir = e.target.closest("[data-ir-ideia]");
    if (ir) { d.close(); trans.sel = ir.dataset.irIdeia; irPara("transcricoes"); return; }
    const voz = e.target.closest("[data-voz]");
    if (voz) { const t = S.transcricoes.find((x) => String(x.id) === voz.dataset.voz); d.close(); if (t) roteiroNaMinhaVoz(t); return; }
    if (e.target.closest("[data-voz-novo]")) { d.close(); roteiroNaMinhaVoz({ titulo: String(it.tema).replace(/#\d+\s*/g, ""), categoria: "organico", minha_versao: [it.gancho && `Gancho sugerido: ${it.gancho}`, it.porque && `Por que vai funcionar: ${it.porque}`].filter(Boolean).join("\n") }); return; }
    if (e.target.closest("[data-abrir-car]")) { d.close(); igx.car = { titulo: car.titulo, slides: car.slides.map((x) => ({ ...x })) }; igx.sub = "carrossel"; try { localStorage.setItem("ig-sub", "carrossel"); } catch (_) {} irPara("instagram"); return; }
    if (e.target.closest("[data-editar-evento]")) { d.close(); formCalendarioBase(evento); return; }
    if (e.target.closest("[data-agenda]")) {
      const titulo = `${it.formato}: ${it.tema}`.slice(0, 200);
      if (S.calendario.some((a) => a.titulo === titulo)) { avisar("Esse post já está na agenda."); return; }
      if (await gravar("calendario", { titulo, tipo: "postar", data, status: "a fazer" })) { avisar(`Na agenda: ${dia[2]}.`); recarregar("calendario"); }
    }
  };
}
