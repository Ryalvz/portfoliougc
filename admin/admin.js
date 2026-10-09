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
  marcas: ["id", "nome", "instagram", "email", "telefone", "situacao", "obs", "ultimo_contato", "exemplo", "criado_em"],
  calendario: ["id", "titulo", "marca", "tipo", "data", "status", "exemplo"],
  campanhas: ["id", "campanha", "cliente", "tipo", "status", "qtd", "valor", "prazo", "pagamento", "ativa", "favorita", "exemplo"],
  comissoes_ttk: ["id", "data", "valor", "gmv", "itens", "obs"],
  metas: ["ano", "mes", "valor"],
  lembretes_adiados: ["chave", "ate"],
  ig_historico: ["data", "seguidores", "posts"],
  contratos: ["id", "cliente", "tipo", "descricao", "valor", "mes", "ano", "data_nf", "prazo_dias", "status", "parcela1", "data_p1", "parcela2", "data_p2", "obs", "qtd", "prazo_entrega", "favorita", "criado_em"],
  transcricoes: ["id", "criado_em", "link", "plataforma", "categoria", "status", "titulo", "transcricao", "transcricao_original", "idioma_original", "minha_versao", "observacoes"],
  marcados: ["chave", "marcado"],
  visitas: ["id", "data", "pagina", "origem"]
};
const S = { videos: [], marcas: [], calendario: [], campanhas: [], marcados: {}, visitas: [], transcricoes: [], contratos: [], comissoes: [], metas: [], adiados: [] };
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
  const [videos, marcas, calendario, campanhas, marcados, visitas, transcricoes, contratos, comissoes, metas, adiados] = await Promise.all([
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
    ler("lembretes_adiados")
  ]);
  Object.assign(S, { videos, marcas, calendario, campanhas, visitas, transcricoes, contratos, comissoes, metas, adiados });
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
  else input = `<input class="campo" id="${id}" name="${c.n}" type="${c.t || "text"}" value="${esc(String(val).slice(0, c.t === "date" ? 10 : undefined))}" ${c.t === "number" ? 'step="any" min="0"' : ""} ${req} ${ph}>`;
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
  calendario: desenharCalendario,
  campanhas: desenharProducao,
  transcricoes: desenharTranscricoes,
  financeiro: desenharFinanceiro,
  checklist: desenharChecklist
};
let abaAtual = "inicio";

function irPara(aba) {
  if (!DESENHOS[aba]) aba = "inicio";
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
  irPara((location.hash || "").slice(1) || "inicio");
  // Tocar numa notificação com o painel já aberto troca de aba
  window.addEventListener("hashchange", () => { const aba = (location.hash || "").slice(1); if (aba && aba !== abaAtual) irPara(aba); });
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

  el.innerHTML = `
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
const filtroMarcas = { busca: "", situacao: "" };

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

function desenharMarcas(el) {
  el.innerHTML = `
    <div class="barra">
      <div class="busca">${ic("busca")}<input type="search" id="busca-marcas" placeholder="Buscar por nome, @ ou e-mail" value="${esc(filtroMarcas.busca)}" aria-label="Buscar marcas"></div>
      <select class="campo" id="filtro-situacao" aria-label="Filtrar por situação">
        <option value="">Todas as situações</option>
        ${SITUACOES.map(([v, t]) => `<option value="${v}" ${filtroMarcas.situacao === v ? "selected" : ""}>${t}</option>`).join("")}
      </select>
      <span class="espaco"></span>
      <button class="btn" type="button" id="csv-marcas">${ic("baixar")}Baixar CSV</button>
      <button class="btn primario" type="button" id="add-marca">${ic("mais")}Adicionar marca</button>
    </div>
    <div class="tabela-caixa">
      <table>
        <thead><tr><th>Marca</th><th>Instagram</th><th>E-mail</th><th>Telefone</th><th>Situação</th><th>Observação</th><th>Último contato</th></tr></thead>
        <tbody id="lista-marcas"></tbody>
      </table>
    </div>
    <p class="contagem" id="conta-marcas"></p>`;

  const pintar = () => {
    const q = filtroMarcas.busca.toLowerCase().replace(/^@/, "");
    const lista = S.marcas.filter((m) => {
      if (filtroMarcas.situacao && m.situacao !== filtroMarcas.situacao) return false;
      if (!q) return true;
      return [m.nome, m.instagram, m.email].some((x) => String(x || "").toLowerCase().replace(/^@/, "").includes(q));
    });
    $("#lista-marcas").innerHTML = lista.length === 0
      ? `<tr><td colspan="7"><p class="vazio">${S.marcas.length ? "Nenhuma marca com esse filtro." : "Sua base está vazia. Quem mandar o formulário do site aparece aqui como Lead."}</p></td></tr>`
      : lista.map((m) => {
          const ig = linkInstagram(m.instagram), wa = linkWhats(m.telefone);
          return `<tr class="clicavel" data-id="${esc(m.id)}">
            <td><b>${esc(m.nome)}</b>${m.exemplo ? '<span class="pilula p-exemplo">exemplo</span>' : ""}</td>
            <td>${ig ? `<a href="${ig}" target="_blank" rel="noopener">${esc(m.instagram)}</a>` : esc(m.instagram || "")}</td>
            <td>${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : ""}</td>
            <td style="white-space:nowrap">${esc(m.telefone || "")} ${wa ? `<a class="icone-btn" href="${wa}" target="_blank" rel="noopener" title="Abrir no WhatsApp" aria-label="Abrir ${esc(m.nome)} no WhatsApp">${ic("whats")}</a>` : ""}</td>
            <td><span class="pilula p-${esc(m.situacao)}">${esc(nomeSituacao(m.situacao))}</span></td>
            <td class="corta" title="${esc(m.obs || "")}">${esc(m.obs || "")}</td>
            <td>${dataBR(m.ultimo_contato)}</td></tr>`;
        }).join("");
    $("#conta-marcas").textContent = lista.length === S.marcas.length
      ? plural(S.marcas.length, "marca", "marcas")
      : `${lista.length} de ${plural(S.marcas.length, "marca", "marcas")}`;
  };
  pintar();

  $("#busca-marcas").addEventListener("input", (e) => { filtroMarcas.busca = e.target.value; pintar(); });
  $("#filtro-situacao").addEventListener("change", (e) => { filtroMarcas.situacao = e.target.value; pintar(); });
  $("#add-marca").addEventListener("click", () => formMarca());
  $("#csv-marcas").addEventListener("click", () => baixarCSV("marcas",
    ["Marca", "Instagram", "E-mail", "Telefone", "Situação", "Observação", "Último contato"],
    S.marcas.map((m) => [m.nome, m.instagram, m.email, m.telefone, nomeSituacao(m.situacao), m.obs, dataBR(m.ultimo_contato)])));
  $("#lista-marcas").addEventListener("click", (e) => {
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
      { n: "instagram", r: "Instagram", ph: "@marca" },
      { n: "email", r: "E-mail", t: "email" },
      { n: "telefone", r: "Telefone", t: "tel", ph: "(11) 90000-0000" },
      { n: "situacao", r: "Situação", t: "select", op: SITUACOES },
      { n: "ultimo_contato", r: "Último contato", t: "date" },
      { n: "obs", r: "Observação", t: "textarea" }
    ],
    aoSalvar: async (d) => { const ok = await gravar("marcas", d, m ? m.id : null); if (ok) { recarregar("marcas"); if (extra.depois) extra.depois(); } return ok; },
    aoApagar: m ? async () => { const ok = await apagarLinha("marcas", m.id); if (ok) recarregar("marcas"); return ok; } : null
  });
}

/* =============================================================
   ABA 3: CALENDÁRIO
   ============================================================= */
const TIPOS_CAL = [["gravar", "Gravar"], ["editar", "Editar"], ["postar", "Postar"]];
const cal = { mes: new Date(new Date().getFullYear(), new Date().getMonth(), 1), filtro: "todos" };

function eventosCalendario() {
  const itens = S.calendario.filter((c) => c.data).map((c) => ({
    tipo: c.tipo || "gravar", titulo: c.titulo, marca: c.marca, data: String(c.data).slice(0, 10),
    feito: c.status === "feito", origem: "calendario", ref: c
  }));
  // Prazos de entrega das campanhas (tabela contratos)
  const prazos = S.contratos.filter((c) => c.prazo_entrega && fechado(c)).map((c) => ({
    tipo: "prazo", titulo: "Entrega: " + c.cliente, marca: c.descricao, data: String(c.prazo_entrega).slice(0, 10),
    feito: c.status === "Entregue" || c.status === "Pago", origem: "campanha", ref: c
  }));
  return itens.concat(prazos);
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
      ${lista.slice(0, 3).map((e, k) => `<button type="button" class="item-cal t-${e.tipo} ${e.feito ? "feito" : ""}" data-ev="${iso}|${k}" title="${esc(e.titulo)}">${esc(e.titulo)}</button>`).join("")}
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
    if (e.origem === "calendario") { if (await gravar("calendario", { status: "feito" }, e.ref.id)) { avisar("Marcado como feito."); recarregar("calendario"); } }
    else formContrato(e.ref);
  });
}

const nomeTipo = (t) => (TIPOS_CAL.find((x) => x[0] === t) || [t, t === "prazo" ? "Prazo" : t])[1];
function abrirEvento(e) { if (e.origem === "calendario") formCalendario(e.ref); else formContrato(e.ref); }

function abrirDia(iso, lista) {
  const d = abrirJanelaSimples(
    esc(deISO(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })),
    `<div style="display:grid;gap:4px">${lista.map((e, k) => `<button type="button" class="item-cal t-${e.tipo} ${e.feito ? "feito" : ""}" data-k="${k}" style="font-size:13px;padding:6px 8px">${esc(nomeTipo(e.tipo))}: ${esc(e.titulo)}${e.marca ? " · " + esc(e.marca) : ""}</button>`).join("")}</div>`,
    `<button type="button" class="btn primario" data-novo>${ic("mais")}Adicionar neste dia</button>`
  );
  $$("[data-k]", d).forEach((b) => b.onclick = () => { d.close(); abrirEvento(lista[Number(b.dataset.k)]); });
  $("[data-novo]", d).onclick = () => { d.close(); formCalendario(null, iso); };
}

function formCalendario(c, dataPadrao) {
  abrirForm({
    titulo: c ? "Editar tarefa" : "Nova tarefa no calendário",
    tabela: "calendario",
    valores: c || { data: dataPadrao, tipo: cal.filtro !== "todos" && cal.filtro !== "prazo" ? cal.filtro : "gravar", status: "a fazer" },
    campos: [
      { n: "titulo", r: "O que fazer", req: true, inteiro: true },
      { n: "marca", r: "Marca" },
      { n: "tipo", r: "Tipo", t: "select", op: TIPOS_CAL },
      { n: "data", r: "Data", t: "date", req: true },
      { n: "status", r: "Situação", t: "select", op: [["a fazer", "A fazer"], ["feito", "Feito"]] }
    ],
    aoSalvar: async (d) => { const ok = await gravar("calendario", d, c ? c.id : null); if (ok) recarregar("calendario"); return ok; },
    aoApagar: c ? async () => { const ok = await apagarLinha("calendario", c.id); if (ok) recarregar("calendario"); return ok; } : null
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
const trans = { categoria: "todas", busca: "", sel: null };

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

  $$("[data-cat]", el).forEach((b) => b.onclick = () => { trans.categoria = b.dataset.cat; trans.sel = null; desenhar(); });

  const caixa = $("#trans-conteudo");
  if (trans.sel) { caixa.innerHTML = `<div id="detalhe-trans"></div>`; pintarDetalheTrans(); return; }

  caixa.innerHTML = `
    <form class="cartao add-trans" id="form-add-trans" novalidate>
      <label for="novo-link"><b>Nova ideia</b> <span class="sub">cole o link de uma referência (YouTube, Instagram ou TikTok) e a transcrição vem sozinha</span></label>
      <div class="barra" style="margin:6px 0 0">
        <input class="campo" id="novo-link" type="url" placeholder="https://www.instagram.com/reel/..." style="flex:1 1 260px">
        <select class="campo" id="novo-cat" aria-label="Divisão">${CATEGORIAS.map(([v, t]) => `<option value="${v}" ${v === catPadrao ? "selected" : ""}>${t}</option>`).join("")}</select>
        <select class="campo" id="novo-etapa" aria-label="Etapa">${ETAPAS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select>
        <button class="btn primario" type="submit">${ic("mais")}Adicionar</button>
        <button class="btn" type="button" id="ideia-sem-link">Nova ideia sem link</button>
      </div>
    </form>
    ${trans.categoria === "todas" ? "" : `<div id="painel-ideias"></div>`}
    <div class="barra" style="margin:4px 0 10px">
      <div class="busca" style="max-width:360px">${ic("busca")}<input type="search" id="busca-trans" placeholder="Buscar no título, roteiro ou observação" value="${esc(trans.busca)}" aria-label="Buscar ideias"></div>
      <span class="sub">${trans.categoria === "todas" ? "todas as suas ideias. Clique numa para abrir, ou entre numa divisão para ver as etapas" : "arraste os cartões entre as colunas, ou troque a etapa no próprio cartão"}</span>
    </div>
    ${trans.categoria === "todas" ? `<div class="mural" id="mural"></div>` : `<div class="quadro" id="quadro"></div>`}`;

  $("#form-add-trans").addEventListener("submit", adicionarTranscricao);
  $("#ideia-sem-link").onclick = () => adicionarIdeia(null);
  $("#busca-trans").addEventListener("input", (e) => { trans.busca = e.target.value; pintarListaTrans(); });
  if ($("#quadro")) ligarQuadro($("#quadro"));
  if ($("#mural")) {
    const mural = $("#mural");
    mural.addEventListener("click", (e) => { const p = e.target.closest(".postit"); if (p) abrirIdeia(p.dataset.trans); });
    mural.addEventListener("keydown", (e) => { const p = e.target.closest(".postit"); if (p && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirIdeia(p.dataset.trans); } });
  }
  pintarListaTrans();
}

function filtrarTrans() {
  const q = trans.busca.toLowerCase();
  return S.transcricoes.filter((t) => {
    if (trans.categoria !== "todas" && t.categoria !== trans.categoria) return false;
    return !q || [t.titulo, t.transcricao, t.minha_versao, t.observacoes, t.link].some((x) => String(x || "").toLowerCase().includes(q));
  });
}

// Painel de números + quadro (também é chamado quando uma transcrição termina)
function pintarListaTrans() {
  pintarPainelIdeias();
  const mural = $("#mural");
  if (mural) {
    const ideias = filtrarTrans();
    mural.innerHTML = ideias.length ? ideias.map(postit).join("")
      : `<p class="vazio" style="grid-column:1/-1">${S.transcricoes.length ? "Nenhuma ideia com essa busca." : "Seu mural está vazio. Cole o link de uma referência aqui em cima ou crie uma ideia sem link."}</p>`;
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
    titulo: link ? `Vídeo do ${NOME_PLATAFORMA[info.plataforma] || "link"} de ${dataBR(hojeISO()).slice(0, 5)}` : "Nova ideia"
  };
  const limpo = {};
  Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
  const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
  if (error) { avisar(traduzErro(error), true); return; }
  if (trans.categoria !== "todas" && trans.categoria !== dados.categoria) trans.categoria = dados.categoria;
  trans.sel = String(data.id);
  await recarregar("transcricoes");
  const novo = S.transcricoes.find((x) => String(x.id) === String(data.id));
  if (novo && link) transcreverVideo(novo);
  if (!link) { const tt = $("#t-titulo"); if (tt) { tt.focus(); tt.select(); } }
}

async function adicionarTranscricao(e) {
  e.preventDefault();
  const link = $("#novo-link").value.trim();
  if (!/^https?:\/\//i.test(link)) { avisar("Cole um link completo, começando com https://. Para anotar sem link, use Nova ideia sem link.", true); $("#novo-link").focus(); return; }
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

async function transcreverVideo(item) {
  const id = String(item.id);
  if (transcrevendo.has(id)) return;
  transcrevendo.add(id);
  pintarListaTrans();
  mostrarTranscricaoNaTela(item, "Transcrevendo o vídeo... pode levar até 1 minuto.");
  let aviso = "";
  try {
    const { data, error } = await db.functions.invoke("transcrever", { body: { link: item.link } });
    if (error || !data || data.erro) {
      aviso = error ? await mensagemDoErroDaFuncao(error) : (data && data.erro) || "Não deu para transcrever agora.";
      avisar(aviso, true);
      return;
    }
    let texto = String(data.texto || "").trim();
    // Confere o idioma pelo próprio texto (mais seguro que confiar só no que o serviço diz)
    let idioma = (await detectarIdioma(texto) || data.idioma || "").slice(0, 2);
    const dados = { transcricao: texto, transcricao_original: null, idioma_original: null };
    if (idioma && idioma !== "pt") {
      let pt = null;
      try { pt = await traduzirParaPortugues(texto, idioma, (t) => mostrarTranscricaoNaTela(item, t)); } catch (_) {}
      if (pt) { dados.transcricao = pt.trim(); dados.transcricao_original = texto; dados.idioma_original = idioma; }
      else aviso = `Veio em ${NOME_IDIOMA[idioma] || idioma} e o tradutor do Chrome não respondeu. Apague o texto e cole de novo para traduzir.`;
    }
    if (await gravar("transcricoes", dados, item.id)) {
      Object.assign(item, dados);
      if (!aviso) aviso = dados.idioma_original ? `Transcrito e traduzido do ${NOME_IDIOMA[dados.idioma_original] || dados.idioma_original}.` : "Transcrito.";
      avisar(dados.idioma_original ? "Transcrição pronta e traduzida para português." : "Transcrição pronta.");
    }
  } finally {
    transcrevendo.delete(id);
    pintarListaTrans();
    mostrarTranscricaoNaTela(item, aviso);
  }
}

function pintarDetalheTrans() {
  const caixa = $("#detalhe-trans");
  const t = S.transcricoes.find((x) => String(x.id) === String(trans.sel));
  if (!caixa || !t) return;
  const info = videoDoLink(t.link);

  caixa.innerHTML = `
    <div class="barra">
      <button class="btn" type="button" id="t-voltar">${ic("esq")}Voltar ao quadro</button>
      <span class="espaco"></span>
      <span class="sub" id="t-salvo"></span>
    </div>
    <div class="cartao">
      <div class="trans-cabeca">
        <input class="campo titulo-trans" id="t-titulo" value="${esc(t.titulo || "")}" placeholder="O tema desta ideia" aria-label="Título da ideia">
        <select class="campo" id="t-cat" aria-label="Divisão">${CATEGORIAS.map(([v, n]) => `<option value="${v}" ${v === t.categoria ? "selected" : ""}>${n}</option>`).join("")}</select>
        <select class="campo" id="t-etapa" aria-label="Etapa">${ETAPAS.map(([v, n]) => `<option value="${v}" ${v === etapaDe(t) ? "selected" : ""}>${n}</option>`).join("")}</select>
      </div>
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
          <h2>Minha versão (meu roteiro)</h2>
          <textarea class="campo" id="t-versao" rows="9" placeholder="${t.link ? "Escreva aqui a sua versão: o seu gancho, a sua fala, como você vai adaptar essa referência." : "Escreva aqui a sua ideia e o roteiro: gancho, desenvolvimento e chamada final."}">${esc(t.minha_versao || "")}</textarea>
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

  const ta = $("#t-transcricao");
  const status = (txt) => { const s = $("#t-status"); if (s) s.textContent = txt; };
  let originalPendente = null;
  let mudou = false;
  $$("#t-titulo, #t-versao, #t-obs, #t-transcricao", caixa).forEach((el) => el.addEventListener("input", () => { mudou = true; }));

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
      observacoes: $("#t-obs").value.trim() || null
    };
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
  $("#t-salvar").onclick = () => salvar();
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
const prod = { busca: "", soDestaque: false };
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
  const ativos = S.contratos.filter((c) => grupoDe(c.status) !== "fora");
  const negociando = ativos.filter((c) => grupoDe(c.status) === "negociacao");
  const emProducao = ativos.filter((c) => grupoDe(c.status) === "producao");
  const atrasadas = emProducao.filter((c) => c.prazo_entrega && c.prazo_entrega < hojeISO());
  const videos = emProducao.reduce((s, c) => s + (Number(c.qtd) || 0), 0);
  const agora = new Date();
  const entreguesMes = ativos.filter((c) => entregue(c) && Number(c.mes) === agora.getMonth() + 1 && Number(c.ano) === agora.getFullYear());

  el.innerHTML = `
    <div class="faixa-kpi">
      <div class="kpi"><span>Em negociação</span><strong>${qtd(negociando.length)}</strong><small>${real(negociando.reduce((s, c) => s + n2(c.valor), 0))} em propostas</small></div>
      <div class="kpi"><span>Em produção</span><strong>${qtd(emProducao.length)}</strong><small>${real(emProducao.reduce((s, c) => s + n2(c.valor), 0))} em contratos</small></div>
      <div class="kpi"><span>Vídeos para entregar</span><strong>${qtd(videos)}</strong><small>somando as campanhas abertas</small></div>
      <div class="kpi ${atrasadas.length ? "alerta" : ""}"><span>Atrasadas</span><strong>${qtd(atrasadas.length)}</strong><small>${atrasadas.length ? "passou do prazo de entrega" : "tudo em dia"}</small></div>
      <div class="kpi"><span>Entregues este mês</span><strong>${qtd(entreguesMes.length)}</strong><small>${MESES_LONGOS[agora.getMonth()]}</small></div>
    </div>
    <div class="barra">
      <div class="busca">${ic("busca")}<input type="search" id="busca-prod" placeholder="Buscar cliente ou descrição" value="${esc(prod.busca)}" aria-label="Buscar campanhas"></div>
      <div class="chips" role="group" aria-label="Filtro"><button class="chip" type="button" data-dest="0" aria-pressed="${!prod.soDestaque}">Todas</button><button class="chip" type="button" data-dest="1" aria-pressed="${prod.soDestaque}">★ Destaques</button></div>
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
      if (nome === "Pago") { // só os mais recentes, o histórico completo está no Financeiro
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

function calcularLembretes() {
  const hoje = hojeISO();
  const L = [];
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
        acoes: [["Sim, recebi", true, () => formRecebi(c)], ["Ainda não, vou cobrar", false, () => adiarLembrete(k, somaDiasISO(2), "Combinado. Pergunto de novo em 3 dias.")]] });
      return;
    }
    if (aberto && prev && prev >= hoje && prev <= somaDiasISO(2)) {
      const k = `vence-${c.id}-${prev}`;
      if (!adiado(k)) L.push({ aba: "financeiro", ic: "calendario", nivel: "",
        texto: `${nome} deve pagar ${prev === hoje ? "hoje" : "até " + dataBR(prev).slice(0, 5)} (${real(sal)}). O dinheiro já caiu?`,
        acoes: [["Sim, recebi", true, () => formRecebi(c)], ["Ainda não", false, () => adiarLembrete(k, prev, "Certo. Se não cair até o prazo, eu aviso que venceu.")]] });
    }
    if (c.status === "Entregue" && !c.data_nf && sal > 0) {
      const k = `nota-${c.id}`;
      if (!adiado(k)) L.push({ aba: "financeiro", ic: "transcricao", nivel: "",
        texto: `${nome} foi entregue e está <b>sem nota fiscal</b>. Sem nota, o prazo de pagamento não começa a contar.`,
        acoes: [["Enviei a nota hoje", true, () => mudarEtapa(c, "Nota fiscal enviada")], ["Lembrar amanhã", false, () => adiarLembrete(k, hoje)]] });
    }
    if (grupoDe(c.status) === "producao" && c.prazo_entrega && c.prazo_entrega <= somaDiasISO(1)) {
      const k = `entrega-${c.id}-${c.prazo_entrega}`;
      const d = diasEntre(hoje, c.prazo_entrega);
      if (!adiado(k)) L.push({ aba: "campanhas", ic: "campanhas", nivel: d < 0 ? "alerta" : "",
        texto: `${nome}: ${d < 0 ? `a entrega está <b>atrasada há ${plural(-d, "dia", "dias")}</b>` : d === 0 ? "a entrega é <b>hoje</b>" : "a entrega é <b>amanhã</b>"} (${esc(c.status.toLowerCase())}).`,
        acoes: [["Já entreguei", true, () => mudarEtapa(c, "Entregue")], ["Lembrar amanhã", false, () => adiarLembrete(k, hoje)]] });
    }
    if (grupoDe(c.status) === "negociacao" && c.criado_em && diasEntre(String(c.criado_em).slice(0, 10), hoje) >= 5) {
      const k = `negocia-${c.id}`;
      if (!adiado(k)) L.push({ aba: "campanhas", ic: "marcas", nivel: "",
        texto: `${nome} está em negociação há ${plural(diasEntre(String(c.criado_em).slice(0, 10), hoje), "dia", "dias")}${n2(c.valor) ? ` (${real(c.valor)})` : ""}. Já fez follow-up?`,
        acoes: [["Fechou!", true, () => mudarEtapa(c, "Aguardando briefing")], ["Não fechou", false, () => mudarEtapa(c, "Perdida")], ["Lembrar em 3 dias", false, () => adiarLembrete(k, somaDiasISO(2))]] });
    }
  });
  // Agenda do calendário: o que é pra hoje e o que ficou pra trás (até 7 dias)
  S.calendario.filter((a) => !a.exemplo && a.status !== "feito" && a.data && String(a.data).slice(0, 10) <= hoje && String(a.data).slice(0, 10) >= somaDiasISO(-7))
    .forEach((a) => {
      const k = `cal-${a.id}`, data = String(a.data).slice(0, 10);
      if (adiado(k)) return;
      const oque = `<b>${esc((TIPOS_CAL.find((t) => t[0] === a.tipo) || [0, a.tipo])[1])}: ${esc(a.titulo)}</b>${a.marca ? ` (${esc(a.marca)})` : ""}`;
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
  caixa.innerHTML = `<header><b>Lembretes</b><span class="sub">${L.length ? plural(L.length, "coisa precisa", "coisas precisam") + " de você" : "tudo em dia"}</span></header>
    ${L.length ? `<ul>${L.map((x, i) => `<li class="lembrete ${x.nivel}">
      <span class="insight-ic">${ic(x.ic)}</span>
      <p>${x.texto}</p>
      <div class="lembrete-acoes">${x.acoes.map(([r, p], j) => `<button type="button" class="btn pequeno ${p ? "primario" : ""}" data-lembrete="${i}" data-acao="${j}">${esc(r)}</button>`).join("")}</div>
    </li>`).join("")}</ul>` : `<p class="vazio">Nenhum lembrete agora. Tudo em dia!</p>`}`;
  caixa.onclick = (e) => {
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
      <span class="pilula ${e.tipo === "prazo" ? "p-pendente" : "p-conversando"}">${esc(nomeTipo(e.tipo))}</span>
      <span class="item-dia-texto"><b>${esc(e.titulo || "")}</b>${e.marca ? `<small>${esc(e.marca)}</small>` : ""}</span>
      ${extra}
    </button>`;

  // Ideias em andamento e contatos novos
  const ideias = S.transcricoes.filter((t) => ["agora", "fazendo"].includes(etapaDe(t)))
    .sort((a, b) => (etapaDe(a) === "fazendo" ? 0 : 1) - (etapaDe(b) === "fazendo" ? 0 : 1)).slice(0, 5);
  const leads = S.marcas.filter((m) => m.situacao === "lead" && !m.exemplo)
    .sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || ""))).slice(0, 4);

  const pctMeta = meta ? Math.min(100, pct(fat, meta)) : 0;
  el.innerHTML = `
    <div class="inicio-topo">
      <div><h2 class="saudacao">${saudacao}, Ryan</h2><p class="sub">${DIAS_SEMANA[agora.getDay()]}, ${agora.getDate()} de ${MESES_LONGOS[agora.getMonth()].toLowerCase()}</p></div>
      <div class="inicio-acoes">
        <button class="btn" type="button" data-rapido="ideia">${ic("mais")}Ideia</button>
        <button class="btn" type="button" data-rapido="ttk">${ic("mais")}Repasse TikTok</button>
        <button class="btn primario" type="button" data-rapido="contrato">${ic("mais")}Contrato</button>
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
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Contatos novos</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="marcas">ver marcas</button></div>
          ${leads.length
            ? `<div class="lista-dia">${leads.map((m) => `<button type="button" class="item-dia" data-ir="marcas">
                <span class="pilula p-lead">Lead</span>
                <span class="item-dia-texto"><b>${esc(m.nome || "")}</b><small>${esc(m.instagram || m.email || "")}${m.criado_em ? ` · ${dataBR(String(m.criado_em).slice(0, 10)).slice(0, 5)}` : ""}</small></span>
              </button>`).join("")}</div>`
            : `<p class="vazio">Nenhum contato novo pelo site.</p>`}
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
    if (r.dataset.rapido === "contrato") formContrato();
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
const ESCOPOS_GMAIL = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
const PALAVRAS_PROPOSTA = ["ugc", "\"user generated\"", "proposta", "parceria", "publi", "publicidade", "publipost", "campanha", "collab", "collaboration", "briefing", "orçamento", "orcamento", "\"mídia kit\"", "\"media kit\"", "midiakit", "influenciador", "influencer", "creator", "\"criador de conteúdo\"", "permuta", "cachê", "cache", "job", "contratar", "freela"];
const BUSCA_PROPOSTAS = `in:inbox newer_than:90d -category:promotions -category:social -category:forums -category:updates (${PALAVRAS_PROPOSTA.join(" OR ")})`;
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
    const lista = await gmailApi("messages?maxResults=60&q=" + encodeURIComponent(q));
    const ids = (lista.messages || []).map((x) => x.id);
    const campos = ["From", "To", "Cc", "Subject", "Date", "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted", "Feedback-ID", "X-Feedback-Id", "X-SES-Outgoing", "X-Mailer", "X-Spam-Flag", "X-Spam-Status"].map((h) => "&metadataHeaders=" + h).join("");
    const msgs = await Promise.all(ids.map((id) => gmailApi(`messages/${id}?format=metadata${campos}`).catch(() => null)));
    gm.emails = msgs.filter(Boolean).map((m) => {
      const de = lerRemetente(cabecalho(m, "From"));
      return { id: m.id, thread: m.threadId, de, assunto: cabecalho(m, "Subject") || "(sem assunto)", trecho: semEntidades(m.snippet || ""),
        data: new Date(Number(m.internalDate) || Date.parse(cabecalho(m, "Date")) || Date.now()),
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
        <span class="email-assunto">${x.novo ? `<i class="ponto-novo" aria-label="não lido"></i>` : ""}${esc(x.assunto)}${x.importante && !x.automatico ? ` <span class="etq amarela">importante</span>` : ""}</span>
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

function desenharInstagram(el) {
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
    const lista = propostasVisiveis().sort((a, b) => (b.importante === true) - (a.importante === true) || (b.novo === true) - (a.novo === true) || b.data - a.data).slice(0, 3);
    const naoLidas = propostasVisiveis().filter((x) => x.novo).length;
    emails = lista.length
      ? `<p class="sub" style="margin:0 0 6px">${naoLidas ? `<b>${plural(naoLidas, "proposta não lida", "propostas não lidas")}</b> de pessoas` : "nenhuma proposta não lida"}</p>
        <div class="lista-dia">${lista.map((x) => `<button type="button" class="item-dia" data-inicio-email="${esc(x.id)}">
          <span class="pilula ${x.importante ? "p-pendente" : "p-conversando"}">${x.importante ? "Importante" : x.novo ? "Nova" : "Proposta"}</span>
          <span class="item-dia-texto"><b>${x.novo ? "● " : ""}${esc(x.assunto)}</b><small>${esc(x.de.nome)} · ${x.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></span>
        </button>`).join("")}</div>`
      : `<p class="vazio">Nenhuma proposta de pessoa nos últimos 90 dias.</p>`;
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
