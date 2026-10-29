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
  // A parte de estratégia do Instagram fica em admin-estrategia.js: espera ela carregar
  if (!window.__adminEstrategia || !window.__adminPessoal) await new Promise((ok) => window.addEventListener("load", ok, { once: true }));
  iniciar(sessao);
})();

/* ---------- Datas e números ---------- */
const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hojeISO = () => isoLocal(new Date());
const deISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);
const dataBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
// Modo privado: esconde os valores em R$ e borra e-mails, temas e dados pessoais (para gravar ou mostrar o painel)
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
  marcas: ["id", "nome", "instagram", "email", "telefone", "situacao", "nicho", "favorita", "fixada", "selecionada", "email_enviado_em", "obs", "ultimo_contato", "exemplo", "criado_em", "contato_nome", "conexao", "ideia"],
  calendario: ["id", "titulo", "marca", "tipo", "data", "hora", "hora_fim", "local", "status", "serie_id", "repete", "repete_ate", "exemplo"],
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
  const usados = campos.filter((c) => !tabela || c.t === "file" || c.livre || temCampo(tabela, c.n));
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
  instagram: (el) => desenharInstagram(el), // fica em admin-estrategia.js
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
  $$("main > section").forEach((s) => { s.hidden = s.id !== "aba-" + aba; });
  fecharMenu();
  desenhar();
}

// Portfólio e Instagram têm partes, cada uma é um item do menu lateral
function subDaAba(aba) {
  if (aba === "instagram" && typeof igx !== "undefined") return igx.sub;
  if (aba === "portfolio") return pf.sub;
  return "";
}
function irParaSub(aba, sub) {
  if (aba === "instagram" && typeof igx !== "undefined") { igx.sub = sub; try { localStorage.setItem("ig-sub", sub); } catch (_) {} }
  if (aba === "portfolio") { pf.sub = sub; try { localStorage.setItem("pf-aba", sub); } catch (_) {} }
  irPara(aba);
}
// Marca o item do menu, o título e o endereço (#instagram-plano, #portfolio-leads...)
function marcarMenu() {
  const sub = subDaAba(abaAtual);
  let ativo = null;
  $$(".menu-item").forEach((b) => {
    const eh = b.dataset.aba === abaAtual && (!b.dataset.sub || b.dataset.sub === sub);
    if (eh) { b.setAttribute("aria-current", "page"); ativo = b; } else b.removeAttribute("aria-current");
  });
  const titulo = ativo && ativo.dataset.sub ? ativo.textContent.replace(/\d+$/, "").trim() : $("#aba-" + abaAtual).dataset.titulo;
  $("#titulo").textContent = titulo;
  $("#titulo-mobile").textContent = titulo;
  document.title = titulo + " | Admin Ryan Alves";
  const hash = "#" + abaAtual + (ativo && ativo.dataset.sub ? "-" + sub : "");
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

function desenhar() {
  const el = $("#aba-" + abaAtual);
  try { marcarMenu(); } catch (e) { console.error(e); }
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
  const parte = alvo.match(/^instagram-(metricas|reels|plano|carrossel|automacoes)$/);
  if (parte) { igx.sub = parte[1]; irPara("instagram"); return; }
  const pp = alvo.match(/^portfolio-(videos|leads|feedbacks|visitas|bio)$/);
  if (pp) { pf.sub = pp[1] === "visitas" ? "leads" : pp[1]; irPara("portfolio"); return; }
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
  // Este navegador é o seu: o site não conta os vídeos que você mesmo assiste no ranking
  try { localStorage.setItem("painel-ryan", "1"); } catch (_) {}
  $$(".menu-item").forEach((b) => b.addEventListener("click", () => (b.dataset.sub ? irParaSub(b.dataset.aba, b.dataset.sub) : irPara(b.dataset.aba))));
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
  completarSeriesCal().catch((e) => console.warn("repetições", e));
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
  window.addEventListener("hashchange", () => { const alvo = (location.hash || "").slice(1); if (alvo && alvo !== abaAtual + (subDaAba(abaAtual) ? "-" + subDaAba(abaAtual) : "")) irParaEndereco(); });
  sincronizarGmail();
}

/* =============================================================
   ABA 1: PORTFÓLIO
   ============================================================= */
const NICHOS = [["tech", "Tech & Apps"], ["cuidado", "Beleza & Cuidados"], ["alimentos", "Gastronomia"], ["casa", "Casa"], ["moda", "Moda"]];
const nomeNicho = (n) => (NICHOS.find((x) => x[0] === n) || [n, n || "Sem nicho"])[1];
// Filtro da lista "Meus vídeos": "" mostra todos, ou só um nicho para ordenar dentro dele
const pf = { nicho: "", sub: "videos" };
try { pf.sub = localStorage.getItem("pf-aba") || "videos"; } catch (_) {}
const SUBS_PORTFOLIO = [["videos", "Vídeos e curadoria"], ["leads", "Leads e visitas"], ["feedbacks", "Feedbacks e site"], ["bio", "Link da bio"]];

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

  if (pf.sub === "visitas") pf.sub = "leads"; // Visitas agora fica junto com os Leads
  if (!SUBS_PORTFOLIO.some(([k]) => k === pf.sub)) pf.sub = "videos";
  const abas = ""; // as partes do Portfólio ficam no menu lateral
  const ligarAbas = () => $$("[data-pf-aba]", el).forEach((b) => b.onclick = () => { pf.sub = b.dataset.pfAba; try { localStorage.setItem("pf-aba", pf.sub); } catch (_) {} desenharPortfolio(el); });
  if (pf.sub === "bio") { el.innerHTML = `<div id="link-bio"></div>`; desenharLinkBio($("#link-bio")); return; }
  if (pf.sub === "feedbacks") { el.innerHTML = abas + `<div id="conteudo-site"></div>`; ligarAbas(); desenharConteudoSite($("#conteudo-site")); return; }
  if (pf.sub === "leads") {
    el.innerHTML = abas + quadroContatosSite() + `
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
    </div>`;
    ligarAbas(); ligarContatosSite(el); return;
  }
  // Vídeos e curadoria: a lista com plays e retenção de cada vídeo (dados do site, tabela video_views)
  const st = typeof statsVideosPortfolio === "function" ? statsVideosPortfolio(() => { if (abaAtual === "portfolio" && pf.sub === "videos") desenharPortfolio(el); }) : null;
  el.innerHTML = abas + (typeof cartaoCuradoria === "function" ? cartaoCuradoria(st) : "") + `
    <div class="barra">
      <h2 style="margin:0">Meus vídeos</h2><span class="sub">${pf.nicho ? "arraste pela alça para mudar a ordem dentro deste nicho" : "arraste pela alça para mudar a ordem no site"}</span>
      <span class="espaco"></span>
      <div class="chips" role="group" aria-label="Mostrar só um nicho">
        ${[["", "Todos", S.videos.length], ...NICHOS.map(([k, n]) => [k, n, S.videos.filter((v) => v.nicho === k).length])].filter(([k, , q]) => !k || q)
          .map(([k, n, q]) => `<button class="chip" type="button" data-pf-nicho="${k}" aria-pressed="${pf.nicho === k}">${esc(n)} <span class="sub">${q}</span></button>`).join("")}
      </div>
      <button class="btn primario" type="button" id="add-video">${ic("mais")}Adicionar vídeo</button>
    </div>
    <div class="tabela-caixa">
      <table>
        <thead><tr><th style="width:30px"><span class="sr-only">Ordem</span></th><th>Título</th><th>Nicho</th><th>Marca</th>${st ? `<th class="num">Plays</th><th>Retenção</th>` : ""}<th>Destaque</th><th>Link</th><th class="num">Ações</th></tr></thead>
        <tbody id="lista-videos">${S.videos.length === 0
          ? `<tr><td colspan="9"><p class="vazio">Nenhum vídeo cadastrado. Clique em Adicionar vídeo e ele aparece no seu portfólio na hora.</p></td></tr>`
          : S.videos.filter((v) => !pf.nicho || v.nicho === pf.nicho).map((v) => linhaVideo(v, st)).join("")}</tbody>
      </table>
    </div>`;

  ligarAbas();
  if (typeof ligarCuradoria === "function") ligarCuradoria(el, () => desenharPortfolio(el));
  $("#add-video").addEventListener("click", () => formVideo(null, pf.nicho));
  $$("[data-pf-nicho]", el).forEach((b) => b.onclick = () => { pf.nicho = b.dataset.pfNicho; desenharPortfolio(el); });
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

function linhaVideo(v, st) {
  const escondido = v.visivel === false;
  const e = st ? st.get(String(v.id)) : null;
  const colStats = st ? `<td class="num">${e ? `<b>${e.plays}</b>` : `<span class="sub">0</span>`}</td><td>${e && e.pct != null ? `<span class="ret-mini ${e.pct >= 60 ? "boa" : e.pct < 25 ? "baixa" : ""}"><i style="width:${e.pct}%"></i></span><small>${e.pct}%</small>` : `<span class="sub">sem dado</span>`}</td>` : "";
  return `<tr data-id="${esc(v.id)}" class="${escondido ? "escondido" : ""}">
    <td><span class="alca" title="Arraste para mudar a ordem" aria-label="Arrastar">${ic("alca")}</span></td>
    <td><b>${esc(v.titulo)}</b>${v.exemplo ? '<span class="pilula p-exemplo">exemplo</span>' : ""}</td>
    <td>${esc(nomeNicho(v.nicho))}</td>
    <td>${esc(v.marca || "")}</td>
    ${colStats}
    <td>${v.destaque === true || v.destaque === "true" ? "Sim" : v.destaque && v.destaque !== "false" ? esc(v.destaque) : ""}</td>
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

function formVideo(v, nicho) {
  abrirForm({
    titulo: v ? "Editar vídeo" : "Adicionar vídeo",
    tabela: "videos",
    valores: v || { visivel: true, nicho: nicho || "tech" },
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
    // Com um nicho filtrado, os vídeos dele trocam de lugar entre si e o resto da lista fica onde está
    const novos = $$("tr[data-id]", corpo).map((tr) => tr.dataset.id), naTela = new Set(novos);
    let k = 0;
    const ids = S.videos.map((v) => (naTela.has(String(v.id)) ? novos[k++] : String(v.id)));
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
    ${sel ? `<button type="button" class="link-btn perigo-link" data-sel-sem-email>Apagar o e-mail das selecionadas</button><button type="button" class="link-btn perigo-link" data-sel-apagar>Apagar as marcas selecionadas</button>` : ""}
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
  // Apagar em lote: só o e-mail (a marca fica) ou a marca inteira. O histórico de envios não é apagado.
  const selecionadas = () => S.marcas.filter((m) => m.selecionada);
  const semEmail = $("[data-sel-sem-email]", caixa);
  if (semEmail) semEmail.onclick = async () => {
    const lista = selecionadas();
    if (!(await confirmar(`Apagar o e-mail de ${plural(lista.length, "marca selecionada", "marcas selecionadas")}? As marcas continuam na lista, sem e-mail. Não dá para desfazer.`, "Apagar e-mails"))) return;
    const { error } = await db.from("marcas").update({ email: null, selecionada: false }).in("id", lista.map((m) => m.id));
    if (error) { avisar(traduzErro(error), true); return; }
    lista.forEach((m) => { m.email = null; m.selecionada = false; });
    avisar(`E-mail apagado de ${plural(lista.length, "marca", "marcas")}.`);
    desenhar();
  };
  const apagarSel = $("[data-sel-apagar]", caixa);
  if (apagarSel) apagarSel.onclick = async () => {
    const lista = selecionadas();
    const nomes = lista.slice(0, 5).map((m) => m.nome).join(", ") + (lista.length > 5 ? ` e mais ${lista.length - 5}` : "");
    if (!(await confirmar(`Apagar de vez ${plural(lista.length, "marca", "marcas")} (${nomes})? Elas saem do painel. Não dá para desfazer.`, "Apagar marcas"))) return;
    const { error } = await db.from("marcas").delete().in("id", lista.map((m) => m.id));
    if (error) { avisar(traduzErro(error), true); return; }
    const ids = new Set(lista.map((m) => m.id));
    S.marcas = S.marcas.filter((m) => !ids.has(m.id));
    avisar(`${plural(lista.length, "marca apagada", "marcas apagadas")}.`);
    desenhar();
  };
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
            <td class="sigilo" style="white-space:nowrap">${esc(m.telefone || "")} ${wa ? `<a class="icone-btn" href="${wa}" target="_blank" rel="noopener" title="Abrir no WhatsApp" aria-label="Abrir ${esc(m.nome)} no WhatsApp">${ic("whats")}</a>` : ""}</td>
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
      { n: "obs", r: "Observação", t: "textarea" },
      { n: "contato_nome", r: "Com quem falar (vira {pessoa} no e-mail)", ph: "Ex.: Ana" },
      { n: "conexao", r: "A conexão: por que essa marca, agora (vira {conexao})", t: "textarea", ph: "Ex.: Vi que vocês lançaram a linha X e quase todo vídeo mostra o produto parado na mesa." },
      { n: "ideia", r: "A ideia de vídeo pronta (vira {ideia})", t: "textarea", ph: "Ex.: eu tirando o fone do case no metrô e mostrando o cancelamento de ruído funcionando." }
    ],
    aoSalvar: async (d) => { if ("nicho" in d) d.nicho = nichoPadrao(d.nicho) || null; const ok = await gravar("marcas", d, m ? m.id : null); if (ok) { recarregar("marcas"); if (extra.depois) extra.depois(); } return ok; },
    aoApagar: m ? async () => { const ok = await apagarLinha("marcas", m.id); if (ok) recarregar("marcas"); return ok; } : null
  });
}

/* =============================================================
   ABA 3: CALENDÁRIO
   ============================================================= */
const TIPOS_CAL = [["gravar", "Gravar"], ["editar", "Editar"], ["postar", "Postar"], ["reuniao", "Reunião"], ["compromisso", "Compromisso"], ["outro", "Outros"]];
// "16:00:00" vira "16h", "16:30:00" vira "16h30"
const horaCurta = (h) => { if (!h) return ""; const [hh, mm] = String(h).split(":"); return `${Number(hh)}h${mm && mm !== "00" ? mm : ""}`; };
const cal = { mes: new Date(new Date().getFullYear(), new Date().getMonth(), 1), filtro: "todos" };

function eventosCalendario() {
  const itens = S.calendario.filter((c) => c.data).map((c) => ({
    tipo: c.tipo || "gravar", titulo: (c.serie_id ? "🔁 " : "") + c.titulo, marca: c.marca, data: String(c.data).slice(0, 10),
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
  const daSerie = !!(c && c.serie_id);
  abrirForm({
    titulo: c ? "Editar compromisso" : "Novo compromisso no calendário",
    tabela: "calendario",
    valores: c ? { ...c, hora: c.hora ? String(c.hora).slice(0, 5) : "", hora_fim: c.hora_fim ? String(c.hora_fim).slice(0, 5) : "", repete: c.repete || "", _alcance: "este" }
      : { data: dataPadrao, tipo: cal.filtro !== "todos" && cal.filtro !== "prazo" ? cal.filtro : "gravar", status: "a fazer", repete: "" },
    campos: [
      { n: "titulo", r: "O que é", req: true, inteiro: true, ph: "Ex.: Reunião com a Canva" },
      { n: "tipo", r: "Tipo", t: "select", op: TIPOS_CAL },
      { n: "marca", r: "Marca" },
      { n: "data", r: daSerie ? "Data (deste dia)" : "Data", t: "date", req: true },
      { n: "status", r: "Situação", t: "select", op: [["a fazer", "A fazer"], ["feito", "Feito"]] },
      { n: "hora", r: "Começa às (opcional)", t: "time" },
      { n: "hora_fim", r: "Termina às (opcional)", t: "time" },
      { n: "local", r: "Local ou link (opcional)", inteiro: true, ph: "Endereço, Google Meet, Zoom..." },
      { n: "repete", r: "🔁 Repetir", t: "select", op: REPETE_CAL },
      { n: "repete_ate", r: "Repetir até (vazio = sem fim)", t: "date" },
      ...(daSerie ? [{ n: "_alcance", r: "Mudar ou apagar", t: "select", livre: true, inteiro: true, op: [["este", "Só este dia"], ["proximos", "Este e todos os próximos"]] }] : [])
    ],
    aoSalvar: async (d) => {
      if (d.hora_fim && !d.hora) { avisar("Coloque também a hora de começo.", true); return false; }
      if (d.hora && d.hora_fim && d.hora_fim <= d.hora) { avisar("A hora de término precisa ser depois da hora de começo.", true); return false; }
      if (d.repete_ate && d.repete && d.repete_ate < d.data) { avisar("O \"repetir até\" precisa ser depois da data.", true); return false; }
      const alcance = d._alcance; delete d._alcance;
      if (!d.repete) d.repete_ate = null;
      let ok;
      if (!c) ok = d.repete ? await criarSerieCal(d) : await gravar("calendario", d, null);
      else if (daSerie && alcance === "este") ok = await gravar("calendario", { ...d, repete: c.repete, repete_ate: c.repete_ate }, c.id);
      else if (daSerie || d.repete) ok = await refazerSerieCal(c, d);
      else ok = await gravar("calendario", d, c.id);
      if (ok) { recarregar("calendario"); sincronizarAgendaGoogle(); }
      return ok;
    },
    aoApagar: c ? async () => {
      const proximos = daSerie && ($("#janela form").elements._alcance || {}).value === "proximos";
      let ok;
      if (proximos) {
        const { error } = await db.from("calendario").delete().eq("serie_id", c.serie_id).gte("data", String(c.data).slice(0, 10));
        ok = !error; if (error) avisar(traduzErro(error), true);
      } else ok = await apagarLinha("calendario", c.id);
      if (ok) { recarregar("calendario"); sincronizarAgendaGoogle(); }
      return ok;
    } : null
  });
}

/* ---------- 🔁 Compromissos que se repetem ----------
   Cada dia da repetição vira um compromisso normal (com o mesmo
   serie_id), então vai para o Google Agenda e o iPhone com aviso.
   Sem data para acabar, o painel cria os próximos meses e vai
   completando sozinho quando você abre o painel. */
const REPETE_CAL = [["", "Não repete"], ["semanal", "Toda semana"], ["quinzenal", "A cada 2 semanas"], ["mensal", "Todo mês"], ["diario", "Todo dia"], ["dias_uteis", "De segunda a sexta"]];
const HORIZONTE_CAL = { semanal: 182, quinzenal: 182, mensal: 365, diario: 60, dias_uteis: 60 }; // dias criados à frente
function proximaData(iso, repete, inicio) {
  const d = deISO(iso);
  if (repete === "semanal") d.setDate(d.getDate() + 7);
  else if (repete === "quinzenal") d.setDate(d.getDate() + 14);
  else if (repete === "diario") d.setDate(d.getDate() + 1);
  else if (repete === "dias_uteis") { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
  else if (repete === "mensal") {
    // Mesmo dia do mês do começo (dia 31 vira o último dia dos meses curtos)
    const dia = deISO(inicio || iso).getDate();
    const alvo = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    alvo.setDate(Math.min(dia, new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate()));
    return isoLocal(alvo);
  }
  return isoLocal(d);
}
// Datas depois de "ultima" até o limite (o "repetir até" ou o horizonte a partir de hoje)
function datasDaSerie(ultima, repete, ate, inicio) {
  const limite = ate || somaDiasISO(HORIZONTE_CAL[repete] || 182);
  const datas = [];
  let atual = ultima;
  for (let i = 0; i < 400; i++) {
    atual = proximaData(atual, repete, inicio);
    if (atual > limite) break;
    datas.push(atual);
  }
  return datas;
}
const camposSerie = (d) => ({ titulo: d.titulo, tipo: d.tipo, marca: d.marca || null, hora: d.hora || null, hora_fim: d.hora_fim || null, local: d.local || null, repete: d.repete, repete_ate: d.repete_ate || null });
const idSerie = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
async function inserirLote(linhas) {
  for (let i = 0; i < linhas.length; i += 100) {
    const { error } = await db.from("calendario").insert(linhas.slice(i, i + 100));
    if (error) { avisar(traduzErro(error), true); return false; }
  }
  return true;
}
async function criarSerieCal(d) {
  const serie_id = idSerie();
  const primeira = { ...d, serie_id };
  const datas = datasDaSerie(d.data, d.repete, d.repete_ate, d.data);
  const ok = await inserirLote([primeira, ...datas.map((data) => ({ ...camposSerie(d), data, status: "a fazer", serie_id }))]);
  if (ok) setTimeout(() => avisar(`Repetição criada: ${plural(datas.length + 1, "compromisso", "compromissos")} até ${dataBR(datas[datas.length - 1] || d.data)}.`), 400);
  return ok;
}
// Mudou "este e os próximos" (ou ligou/desligou a repetição): apaga os próximos e recria
async function refazerSerieCal(c, d) {
  const serie_id = c.serie_id || idSerie();
  if (c.serie_id) {
    const { error } = await db.from("calendario").delete().eq("serie_id", c.serie_id).gt("data", String(c.data).slice(0, 10)).neq("id", c.id);
    if (error) { avisar(traduzErro(error), true); return false; }
  }
  if (!d.repete) return gravar("calendario", { ...d, serie_id: null, repete: null, repete_ate: null }, c.id);
  if (!(await gravar("calendario", { ...d, serie_id }, c.id))) return false;
  const datas = datasDaSerie(d.data, d.repete, d.repete_ate, d.data);
  return inserirLote(datas.map((data) => ({ ...camposSerie(d), data, status: "a fazer", serie_id })));
}
// Ao abrir o painel: repetição sem fim que está acabando ganha os próximos meses
async function completarSeriesCal() {
  if (!temCampo("calendario", "serie_id")) return;
  const porSerie = new Map();
  S.calendario.filter((x) => x.serie_id && x.repete && x.data).forEach((x) => {
    const atual = porSerie.get(x.serie_id);
    if (!atual || String(x.data) > String(atual.data)) porSerie.set(x.serie_id, x);
  });
  const novas = [];
  porSerie.forEach((ultima) => {
    const fim = String(ultima.data).slice(0, 10);
    if (ultima.repete_ate && fim >= String(ultima.repete_ate).slice(0, 10)) return;
    if (fim > somaDiasISO(Math.round((HORIZONTE_CAL[ultima.repete] || 182) / 2))) return;
    const primeira = S.calendario.filter((x) => x.serie_id === ultima.serie_id).map((x) => String(x.data).slice(0, 10)).sort()[0];
    datasDaSerie(fim, ultima.repete, ultima.repete_ate ? String(ultima.repete_ate).slice(0, 10) : null, primeira)
      .forEach((data) => novas.push({ ...camposSerie(ultima), data, status: "a fazer", serie_id: ultima.serie_id }));
  });
  if (novas.length && await inserirLote(novas)) { await recarregar("calendario"); sincronizarAgendaGoogle(); }
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
        <div id="roteiro-revisor" hidden></div>
        <p class="sub" style="margin-top:8px">A conferência automática pega as regras da sua voz. O checklist ao lado é pro que só você consegue julgar.</p>
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
  ligarRevisor(ta, $("#roteiro-revisor"), "roteiro");
  ta.addEventListener("input", () => { try { localStorage.setItem("roteiro-rascunho", ta.value); } catch (_) {} });
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

/* ---------- Revisor automático ----------
   Confere o texto com as regras da sua voz enquanto você digita (sem IA, na hora).
   tipo "roteiro": duração no seu ritmo, fala picotada e mais de um CTA.
   tipo "email": até 150 palavras, sem "espero que esteja bem" e sem anexo. */
const RITMO_FALA = 3.25; // palavras por segundo, medido em out/2026
const REGRAS_REVISOR = [
  { re: /[—–]/gu, t: "Travessão", d: "Troque por ponto, vírgula ou dois-pontos." },
  { re: /\S[ \t]-[ \t]\S/gu, t: "Hífen solto, parece travessão", d: "Troque por vírgula ou ponto." },
  { re: /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))n[ãa]o\s+(?:[ée]|era|foi|s[ãa]o|eram|t[áa]|est[áa])\s+(?:s[óo]\s+)?[^.!?\n]{1,60}?[,;:]\s*(?:mas\s+)?(?:[ée]|era|foi|s[ãa]o|e\s+sim)(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/giu, t: "\"Não é X, é Y\"", d: "Negação seguida de correção. Diga direto o que é." },
  { re: /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))o problema n[ãa]o [ée](?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))n[ãa]o se trata de(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/giu, t: "\"Não é X, é Y\"", d: "Negação seguida de correção. Diga direto o que é." },
  { re: /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))(?:a[íi] eu descobri|foi a[íi] que|foi quando|at[ée] que|a[íi] eu conheci|hoje eu descobri)(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/giu, t: "Falsa revelação", d: "Conte o que aconteceu, sem suspense forçado." },
  { re: /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))(?:voc[êe] sabia que|isso muda tudo|muda o jogo|e sinceramente\?|[ée] o tipo de|voc[êe] j[áa] reparou que|se voc[êe] ainda t[áa] no ciclo|ol[áa],? pessoal|hoje vou falar sobre|queria compartilhar com voc[êe]s|hoje vim indicar)/giu, t: "Frase da lista proibida", d: "Está entre as frases que você não usa." },
  { re: /\[(?!\s*(?:CENA|TELA|B-?ROLL|CORTE|TEXTO NA TELA)\b)[^\]\n]{2,80}\]/giu, t: "Campo pra preencher", d: "Ainda tem texto entre colchetes." }
];
const REGRAS_EMAIL = [
  { re: /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))espero que (?:voc[êe] )?(?:esteja|estejam) bem(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/giu, t: "\"Espero que esteja bem\"", d: "Abertura proibida. Comece por quem você é." },
  { re: /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))(?:segue em anexo|em anexo|anexad[oa]s?|anexo)(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/giu, t: "Anexo", d: "No primeiro contato, nada de anexo: mande o link do portfólio." }
];
const CTAS_REVISOR = [/(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))(?:me )?segu[ei](?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))siga(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/iu, /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))coment[ae](?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/iu, /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))salv[ae] (?:esse|este|o) (?:post|v[íi]deo)(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))salv[ae](?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/iu, /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))compartilh[ae](?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))manda (?:pra|para) (?:algu[ée]m|um amigo)/iu, /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))link na bio(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))clic[ae](?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))clique(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/iu, /(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))direct(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))me chama(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))|(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))dm(?:(?<![\p{L}\p{N}])(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}])(?![\p{L}\p{N}]))/iu];
function revisarTexto(texto, tipo = "roteiro") {
  const t = String(texto || "");
  const problemas = [];
  [...REGRAS_REVISOR, ...(tipo === "email" ? REGRAS_EMAIL : [])].forEach((r) => {
    for (const m of t.matchAll(r.re)) problemas.push({ t: r.t, d: r.d, pos: m.index, len: m[0].length, trecho: m[0].trim() });
  });
  // Só o que vai ser falado: sem rótulos (GANCHO:) nem marcações entre parênteses
  const falado = t.split("\n").map((l) => l.replace(/^\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{3,}\s*(?:\d\s*)?:/, "").replace(/\([^)]*\)/g, "")).join("\n");
  const palavras = (falado.match(/[\p{L}\p{N}]+/gu) || []).length;
  let info = "";
  if (tipo === "email") {
    const total = (t.match(/[\p{L}\p{N}]+/gu) || []).length;
    info = `${total} palavras`;
    if (total > 150) problemas.push({ t: "Passou de 150 palavras", d: `Está com ${total}. Corte o que não ajuda a marca a responder.`, pos: 0, len: 0, trecho: "" });
  } else {
    info = palavras ? `${palavras} palavras faladas, uns ${Math.round(palavras / RITMO_FALA)} segundos no seu ritmo` : "";
    const linhas = falado.split("\n").map((l) => l.trim()).filter(Boolean);
    const curtas = linhas.filter((l) => (l.match(/[\p{L}\p{N}]+/gu) || []).length <= 4).length;
    if (linhas.length >= 6 && curtas / linhas.length >= 0.6) problemas.push({ t: "Fala picotada", d: "Muitas linhas curtinhas uma embaixo da outra. Junte em frases que você falaria de verdade.", pos: 0, len: 0, trecho: "" });
    const ctas = CTAS_REVISOR.filter((re) => re.test(falado)).length;
    if (ctas > 1) problemas.push({ t: "Mais de um CTA", d: "Parece ter mais de uma chamada (seguir, salvar, comentar, link...). Deixe uma ação só.", pos: 0, len: 0, trecho: "" });
  }
  // O mesmo tipo de problema no mesmo trecho aparece uma vez só
  const unicos = problemas.sort((a, b) => a.pos - b.pos).filter((p, i, l) => !l.slice(0, i).some((q) => q.t === p.t && p.len && q.pos + q.len > p.pos));
  return { problemas: unicos, info };
}
// Liga o revisor numa caixa de texto: atualiza enquanto digita e, ao clicar num ponto, seleciona o trecho
function ligarRevisor(ta, caixa, tipo = "roteiro") {
  if (!ta || !caixa) return;
  let timer = null, res = { problemas: [] };
  const pintar = () => {
    res = revisarTexto(ta.value, tipo);
    if (!ta.value.trim()) { caixa.innerHTML = ""; caixa.hidden = true; return; }
    caixa.hidden = false;
    const n = res.problemas.length;
    caixa.className = `revisor ${n ? "tem" : "ok"}`;
    caixa.innerHTML = `<div class="revisor-topo"><b>${n ? `${n} ${n === 1 ? "ponto" : "pontos"} pra ajustar` : "✓ Dentro das suas regras"}</b>${res.info ? `<span>${esc(res.info)}</span>` : ""}</div>
      ${n ? `<ul>${res.problemas.map((p, i) => `<li><button type="button" data-rev="${i}"><b>${esc(p.t)}</b>${p.trecho ? ` <q>${esc(p.trecho.slice(0, 60))}</q>` : ""}<small>${esc(p.d)}</small></button></li>`).join("")}</ul>` : ""}`;
  };
  caixa.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rev]"); if (!b) return;
    const p = res.problemas[Number(b.dataset.rev)]; if (!p || !p.len) { ta.focus(); return; }
    ta.focus(); ta.setSelectionRange(p.pos, p.pos + p.len);
  });
  ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(pintar, 250); });
  pintar();
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
          <div id="t-revisor" hidden></div>
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

  ligarRevisor($("#t-versao"), $("#t-revisor"), "roteiro");
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
const fin = { ano: new Date().getFullYear(), mes: new Date().getMonth() + 1, busca: "", status: "", ordem: "recente", visao: "pj" };
try { fin.visao = localStorage.getItem("fin-visao") === "pf" ? "pf" : "pj"; } catch (_) {}

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
  // A chave Empresa | Pessoal: a parte pessoal fica em admin-pessoal.js
  if (fin.visao === "pf" && typeof desenharPessoal === "function") return desenharPessoal(el);
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
      ${typeof chipsVisaoFin === "function" ? chipsVisaoFin() : ""}
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
  if (typeof ligarVisaoFin === "function") ligarVisaoFin(el);
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
    if (e.target.closest("[data-depoimento]")) { pedirDepoimento(c); return; }
    formContrato(c);
  });
}

/* ---------- Pedir depoimento ----------
   Depois da entrega, mensagens prontas que conduzem a marca a falar de algo
   específico (processo, roteiro, resultado). A resposta vai pra Feedbacks e site. */
function mensagensDepoimento(c) {
  const marca = String(c.cliente || "a marca").trim();
  const trab = String(c.descricao || "").trim() ? `os vídeos de ${String(c.descricao).trim()}` : "os vídeos que fizemos";
  return {
    whats: { nome: "WhatsApp", texto: `Oi! Aqui é o Ryan. Fiquei muito feliz com ${trab} pra ${marca}. Posso te pedir um favor rápido?

Me conta em 2 ou 3 frases como foi trabalhar comigo. Se ajudar, responde uma destas:
1. Como foi o processo, do briefing à entrega?
2. O que você mais gostou no roteiro ou no vídeo?
3. Teve algum resultado que vale contar (views, vendas, aprovação de primeira)?

Com a sua autorização, coloco no meu portfólio com o nome da ${marca}. Pode ser?` },
    email: { nome: "E-mail", assunto: `Um favor rápido sobre ${trab}`, texto: `Oi, tudo certo?

Queria agradecer pela parceria em ${trab} pra ${marca}. Foi muito bom construir isso com vocês.

Posso te pedir um favor? Me responde com 2 ou 3 frases sobre como foi trabalhar comigo. Pra facilitar, pode ser sobre uma destas:
1. Como foi o processo, do briefing à entrega?
2. O que mais funcionou no roteiro ou no vídeo?
3. Teve algum resultado que vale contar?

Com a sua autorização, uso no meu portfólio (ugc.ryalvz.com.br) com o nome da ${marca}.

Obrigado!
Ryan Alves · @ryalvz` },
    numeros: { nome: "Pedir resultado", texto: `Oi! Passando pra saber como ${trab} performaram. Se tiver algum número (alcance, cliques, vendas ou custo por resultado), me conta?

Isso me ajuda a deixar os próximos roteiros ainda melhores pra vocês. E, com a sua autorização, coloco no meu portfólio como case da ${marca}.` },
    lembrete: { nome: "Lembrete", texto: `Oi! Sei que a rotina é corrida, então deixo fácil: se puder, me responde só com uma frase sobre como foi trabalhar comigo em ${trab}. Já me ajuda muito. Obrigado!` }
  };
}
function pedirDepoimento(c) {
  const msgs = mensagensDepoimento(c);
  let aba = "whats";
  const d = abrirJanelaSimples(`Pedir depoimento: ${esc(c.cliente || "campanha")}`, `
    <p class="sub" style="margin:0 0 12px">As perguntas fazem a marca falar de algo específico (processo, roteiro, resultado). Isso vende mais no portfólio do que um "amei o trabalho".</p>
    <div class="pro-abas" role="tablist" aria-label="Qual mensagem">${Object.entries(msgs).map(([k, m]) => `<button type="button" role="tab" data-dep="${k}" aria-selected="${k === aba}">${esc(m.nome)}</button>`).join("")}</div>
    <p class="sub" id="dep-assunto" style="margin:0 0 6px" hidden></p>
    <pre class="pro-prompt" id="dep-texto" role="tabpanel"></pre>
    <div class="pro-prompt-acoes">
      <button class="btn primario" type="button" id="dep-copiar">${ic("transcricao")}Copiar</button>
      <a class="btn" id="dep-abrir" target="_blank" rel="noopener"></a>
    </div>
    <p class="sub" style="margin:14px 0 0">Quando responderem, coloque o depoimento em <button type="button" class="link-btn" id="dep-site">Feedbacks e site</button> pra aparecer no portfólio.</p>`,
    `<button type="button" class="btn" data-fechar>Fechar</button>`);
  const pintar = () => {
    const m = msgs[aba];
    $("#dep-texto", d).textContent = m.texto;
    const as = $("#dep-assunto", d); as.hidden = !m.assunto; as.innerHTML = m.assunto ? `<b>Assunto:</b> ${esc(m.assunto)}` : "";
    const abrir = $("#dep-abrir", d);
    if (aba === "email") { abrir.href = `mailto:?subject=${encodeURIComponent(m.assunto)}&body=${encodeURIComponent(m.texto)}`; abrir.textContent = "Abrir no e-mail"; }
    else { abrir.href = `https://wa.me/?text=${encodeURIComponent(m.texto)}`; abrir.textContent = "Abrir no WhatsApp"; }
    $$("[data-dep]", d).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.dep === aba)));
  };
  $$("[data-dep]", d).forEach((b) => b.onclick = () => { aba = b.dataset.dep; pintar(); });
  $("#dep-copiar", d).onclick = async () => {
    const m = msgs[aba];
    try { await navigator.clipboard.writeText(m.assunto ? `${m.assunto}\n\n${m.texto}` : m.texto); avisar("Mensagem copiada."); } catch (_) { avisar("Não consegui copiar. Selecione o texto e copie.", true); }
  };
  $("#dep-site", d).onclick = () => { d.close(); pf.sub = "feedbacks"; irPara("portfolio"); };
  pintar();
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
    ${entregue(c) ? `<button class="link-btn" type="button" data-depoimento style="align-self:flex-start">💬 Pedir depoimento</button>` : ""}
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
  if (novosSite.length) L.push({ aba: "portfolio", sub: "leads", ic: "email", nivel: "alerta",
    texto: `${novosSite.length === 1 ? "<b>1 contato novo</b>" : `<b>${novosSite.length} contatos novos</b>`} pelo seu site: ${novosSite.slice(0, 2).map((c) => esc(c.marca || c.nome)).join(", ")}.`,
    acoes: [["Ver contatos", true, () => irParaSub("portfolio", "leads")]] });
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
  if (destaque) L.push({ aba: "instagram", sub: "metricas", ic: "insta", nivel: "",
    texto: `Seu post "<b>${esc((destaque.post.legenda || "sem legenda").slice(0, 50))}</b>" está alcançando <b>${destaque.vezes.toFixed(1).replace(".", ",")}x</b> mais que a sua média. Responda os comentários e repita o formato.`,
    acoes: [["Ver no painel", true, () => irParaSub("instagram", "metricas")], ["Ok, vi", false, () => { marcarVisto("ig-vistos", destaque.post.id); desenhar(); }]] });
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
        acoes: [["Já fiz", true, async () => { if (await gravar("calendario", { status: "feito" }, a.id)) { avisar("Marcado como feito."); recarregar("calendario"); sincronizarAgendaGoogle(); } }],
          ["Remarcar", false, () => remarcarCal(a)],
          ["Não vou fazer", false, () => desistirCal(a)],
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
    L.push({ aba: "instagram", sub: "plano", ic: "insta", nivel: "",
      texto: `Faz <b>${plural(diasEntre(ultimoPost, hoje), "dia", "dias")}</b> que você não posta no Instagram. Constância ajuda o alcance a voltar.`,
      acoes: [["Ver o plano", true, () => irParaSub("instagram", "plano")], ["Lembrar em 3 dias", false, () => adiarLembrete(`postar-${ultimoPost}`, somaDiasISO(2))]] });
  }
  return L;
}

// Compromisso que ficou pra trás: muda o dia (e a hora) sem abrir a agenda
function remarcarCal(a) {
  abrirForm({
    titulo: `Remarcar: ${a.titulo}`,
    valores: { data: hojeISO() > String(a.data).slice(0, 10) ? hojeISO() : String(a.data).slice(0, 10), hora: a.hora ? String(a.hora).slice(0, 5) : "" },
    campos: [
      { n: "data", r: "Novo dia", t: "date" },
      { n: "hora", r: "Hora (opcional)", t: "time" }
    ],
    aoSalvar: async (d) => {
      if (!d.data) { avisar("Escolha o novo dia.", true); return false; }
      const ok = await gravar("calendario", { data: d.data, hora: d.hora || null }, a.id);
      if (ok) { avisar(`Remarcado para ${dataBR(d.data).slice(0, 5)}.`); recarregar("calendario"); sincronizarAgendaGoogle(); }
      return ok;
    }
  });
}

// Não vai rolar: tira da agenda (e do Google) e o lembrete some
async function desistirCal(a) {
  if (!(await confirmar(`Tirar "${a.titulo}" da agenda? Ele some dos lembretes e do Google Agenda.`, "Sim, não vou fazer"))) return;
  if (await apagarLinha("calendario", a.id)) { avisar("Tirado da agenda."); recarregar("calendario"); sincronizarAgendaGoogle(); }
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
  L.forEach((x) => { if (x.aba) { const k = x.sub ? x.aba + ":" + x.sub : x.aba; conta[k] = (conta[k] || 0) + 1; } });
  $$(".menu-item[data-aba]").forEach((b) => {
    let bola = $(".menu-bolinha", b);
    // Item de uma parte (ex.: Leads): conta os avisos dela; o item marcado com data-bolinha também leva os avisos gerais da aba
    const n = b.dataset.sub ? (conta[b.dataset.aba + ":" + b.dataset.sub] || 0) + (b.dataset.bolinha ? conta[b.dataset.aba] || 0 : 0) : conta[b.dataset.aba] || 0;
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
  // "Lido": some do sino por 7 dias. Se o lembrete mudar (outro valor, outra data), ele volta na hora
  // A chave do "lido" usa o texto com os valores à mostra: no modo privado o texto muda ("R$ ••••") e o lembrete voltaria
  const priv = privado; privado = false;
  const chaves = calcularLembretes().map(chaveLido);
  privado = priv;
  const L = calcularLembretes().map((x, i) => Object.assign(x, { chaveLido: chaves[i] })).filter((x) => !adiado(x.chaveLido));
  lembretesAtuais = L;
  pintarBolinhasMenu(L);
  // Número no ícone do app no iPhone
  try { if (navigator.setAppBadge) (L.length ? navigator.setAppBadge(L.length) : navigator.clearAppBadge()).catch(() => {}); } catch (_) {}
  const conta = $("#sino-conta");
  if (conta) { conta.hidden = !L.length; conta.textContent = L.length > 9 ? "9+" : String(L.length); }
  $("#abrir-lembretes").setAttribute("aria-label", L.length ? plural(L.length, "lembrete", "lembretes") : "Nenhum lembrete");
  const proximos = S.rapidos.filter((r) => !r.feito && Date.parse(r.quando) > Date.now());
  caixa.innerHTML = `<header><div><b>Lembretes</b><span class="sub">${L.length ? plural(L.length, "coisa precisa", "coisas precisam") + " de você" : "tudo em dia"}</span></div>
      <span class="lembretes-topo-acoes">${L.length ? `<button type="button" class="btn pequeno" data-ler-todos>${ic("check")}Marcar tudo como lido</button>` : ""}<button type="button" class="btn pequeno primario" data-novo-rapido>${ic("mais")}Lembrete</button></span></header>
    ${L.length ? `<ul>${L.map((x, i) => `<li class="lembrete ${x.nivel}">
      <span class="insight-ic">${ic(x.ic)}</span>
      <p>${x.texto}</p>
      <div class="lembrete-acoes">${x.acoes.map(([r, p], j) => `<button type="button" class="btn pequeno ${p ? "primario" : ""}" data-lembrete="${i}" data-acao="${j}">${esc(r)}</button>`).join("")}<button type="button" class="btn pequeno lembrete-lido" data-lido="${i}" title="Some do sino por 7 dias">${ic("check")}Lido</button></div>
    </li>`).join("")}</ul>` : `<p class="vazio">Nenhum lembrete agora. Tudo em dia!</p>`}
    ${proximos.length ? `<div class="proximos-rapidos"><span class="sub">Vou te lembrar</span>${proximos.slice(0, 8).map((r) => `<button type="button" class="item-dia" data-rapido-id="${esc(r.id)}">
      <span class="etq">${esc(quandoTexto(r.quando))}</span><span class="item-dia-texto sigilo"><b>${esc(r.texto)}</b></span></button>`).join("")}</div>` : ""}`;
  caixa.onclick = (e) => {
    if (e.target.closest("[data-novo-rapido]")) { fecharLembretes(); formLembreteRapido(); return; }
    if (e.target.closest("[data-ler-todos]")) { marcarLidos(lembretesAtuais); return; }
    const li = e.target.closest("[data-lido]");
    if (li) { marcarLidos([lembretesAtuais[Number(li.dataset.lido)]]); return; }
    const ed = e.target.closest("[data-rapido-id]");
    if (ed) { fecharLembretes(); formLembreteRapido(S.rapidos.find((r) => String(r.id) === ed.dataset.rapidoId)); return; }
    const b = e.target.closest("[data-lembrete]");
    if (!b) return;
    const l = lembretesAtuais[Number(b.dataset.lembrete)];
    fecharLembretes();
    if (l) l.acoes[Number(b.dataset.acao)][2]();
  };
}

// Chave do "lido": o texto do lembrete sem HTML (mudou o texto, é outro lembrete)
function chaveLido(x) {
  const t = String(x.texto || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
  return "lido-" + (h >>> 0).toString(36);
}
async function marcarLidos(lista) {
  const linhas = lista.filter(Boolean).map((x) => ({ chave: x.chaveLido || chaveLido(x), ate: somaDiasISO(7) }));
  if (!linhas.length) return;
  const { error } = await db.from("lembretes_adiados").upsert(linhas, { onConflict: "chave" });
  if (error) { avisar(traduzErro(error), true); return; }
  S.adiados = S.adiados.filter((a) => !linhas.some((l) => l.chave === a.chave)).concat(linhas);
  avisar(linhas.length > 1 ? `${linhas.length} lembretes marcados como lidos.` : "Marcado como lido.");
  pintarLembretes();
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
      <span class="item-dia-texto sigilo"><b>${esc(e.titulo || "")}</b>${e.marca || e.local ? `<small>${esc([e.marca, e.local].filter(Boolean).join(" · "))}</small>` : ""}</span>
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
      <button type="button" class="kpi-inicio" data-ir="portfolio" data-pf-sub="leads">
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
                <span class="item-dia-texto sigilo"><b>${esc(t.titulo || "Ideia sem título")}</b><small>${esc(nomeCategoria(t.categoria))}</small></span>
              </button>`).join("")}</div>`
            : `<p class="vazio">Nenhuma ideia em "Fazer agora" ou "Fazendo".</p>`}
        </div>
        <div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Clientes que entraram em contato</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="portfolio" data-pf-sub="leads">ver todos</button></div>
          ${contatosRecentes.length
            ? `<div class="lista-dia">${contatosRecentes.map((c) => `<button type="button" class="item-dia" data-ir="portfolio" data-pf-sub="leads">
                <span class="pilula ${c.visto ? "p-conversando" : "p-pendente"}">${c.visto ? (c.tipo === "midia_kit" ? "Mídia kit" : "Formulário") : "Novo"}</span>
                <span class="item-dia-texto sigilo"><b>${esc(c.marca || c.nome)}</b><small>${esc(c.marca ? c.nome : c.email)} · ${dataBR(String(c.criado_em).slice(0, 10)).slice(0, 5)}</small></span>
              </button>`).join("")}</div>`
            : `<p class="vazio">Ninguém entrou em contato pelo site nos últimos 30 dias.</p>`}
        </div>
      </div>
    </div>
    <div id="inicio-ranking"></div>`;
  if (typeof pintarRankingVideos === "function") pintarRankingVideos($("#inicio-ranking", el));

  // Busca o Instagram em segundo plano (uma vez) para o quadro do Início
  if (ig.conectado === null && !ig.carregando) carregarInstagram();
  const conectarGm = $("#inicio-conectar-gmail", el);
  if (conectarGm) conectarGm.onclick = async () => { try { await conectarGmail(); lerPropostas(); } catch (erro) { avisar(erro.message, true); } };
  el.onclick = (e) => {
    const abrirEmail = e.target.closest("[data-inicio-email]");
    if (abrirEmail) { const x = (gm.emails || []).find((m) => m.id === abrirEmail.dataset.inicioEmail); irPara("propostas"); if (x) abrirConversa(x); return; }
    const ir = e.target.closest("[data-ir]");
    if (ir) { if (ir.dataset.pfSub) pf.sub = ir.dataset.pfSub; irPara(ir.dataset.ir); return; }
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
    olho.setAttribute("aria-label", privado ? "Mostrar dados" : "Esconder valores e dados pessoais");
    olho.title = privado ? "Mostrar dados" : "Esconder valores e dados pessoais";
    $("use", olho).setAttribute("href", privado ? "#i-olho-fechado" : "#i-olho");
  };
  pintarOlho();
  olho.addEventListener("click", () => {
    privado = !privado;
    try { localStorage.setItem("modo-privado", privado ? "1" : "0"); } catch (_) {}
    pintarOlho();
    desenhar();
    avisar(privado ? "Valores, e-mails e temas escondidos. Pode gravar o painel tranquilo." : "Tudo visível de novo.");
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
const PALAVRAS_PROPOSTA = ["oportunidade", "candidatura", "convite", "selecionado", "selecionada", "vaga", "invited", "picked", "task", "recompensa", "ugc", "\"user generated\"", "proposta", "parceria", "publi", "publicidade", "publipost", "campanha", "collab", "collaboration", "briefing", "orçamento", "orcamento", "\"mídia kit\"", "\"media kit\"", "midiakit", "influenciador", "influencer", "creator", "\"criador de conteúdo\"", "permuta", "cachê", "cache", "job", "contratar", "freela"];
// Lê a caixa de entrada E a de spam (às vezes o e-mail da marca cai lá)
// Promoções e Atualizações entram também: é lá que caem as campanhas das plataformas de UGC
const BUSCA_PROPOSTAS = `{in:inbox in:spam} newer_than:90d -category:social -category:forums (${PALAVRAS_PROPOSTA.join(" OR ")})`;
// E-mail automático de plataforma que é oportunidade de trabalho (campanha, convite, candidatura), e não login, código ou pedido
const OPORTUNIDADE_RE = /campanha|proposta|publi|candidatura|candidate|oportunidade|vaga|convite|convid|invited|selecionad|picked|task|tarefa|recompensa|reward|brief|job|collab|parceria/i;
const NAO_OPORTUNIDADE_RE = /senha|password|login|entrou|signed in|device|dispositivo|c[óo]digo|code|verifica|confirma[çc][ãa]o|pedido|entrega|order|pagamento|payment|fatura|documento|identidade|welcome|bem-vind|cadastro|recebemos/i;
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
  // Resposta de uma pessoa a uma conversa (Re:) aparece sempre, mesmo que ela use ferramenta de e-mail
  if (/^\s*(re|res|resp|enc|fw|fwd)\s*:/i.test(cabecalho(m, "Subject")) && !/resposta autom|automatic reply|out of office|aus[êe]ncia/i.test(cabecalho(m, "Subject")) && !REMETENTE_ROBO.test(de.email.split("@")[0])) return "";
  if (cabecalho(m, "List-Unsubscribe") || cabecalho(m, "List-Id")) return "envio em massa";
  if (cabecalho(m, "Feedback-ID") || cabecalho(m, "X-Feedback-Id") || cabecalho(m, "X-SES-Outgoing") || cabecalho(m, "X-Mailer")) return "ferramenta de envio em massa";
  if (/^yes/i.test(cabecalho(m, "X-Spam-Flag")) || /^yes/i.test(cabecalho(m, "X-Spam-Status"))) return "marcado como spam";
  if (/bulk|list|junk/i.test(cabecalho(m, "Precedence"))) return "envio em massa";
  const auto = cabecalho(m, "Auto-Submitted");
  if (auto && !/^no$/i.test(auto)) return "automático";
  if (REMETENTE_ROBO.test(de.email.split("@")[0]) || /no-?reply|nao-?responda|hostmaster|postmaster/i.test(de.email.split("@")[0])) return "remetente automático";
  // O que o Gmail separou em Promoções ou Atualizações é aviso de plataforma (se for campanha, vai pras oportunidades)
  if ((m.labelIds || []).some((l) => l === "CATEGORY_PROMOTIONS" || l === "CATEGORY_UPDATES")) return "promoção ou aviso";
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
    const lista = await gmailApi("messages?maxResults=100&includeSpamTrash=true&q=" + encodeURIComponent(q));
    const ids = (lista.messages || []).map((x) => x.id);
    const campos = ["From", "To", "Cc", "Subject", "Date", "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted", "Feedback-ID", "X-Feedback-Id", "X-SES-Outgoing", "X-Mailer", "X-Spam-Flag", "X-Spam-Status"].map((h) => "&metadataHeaders=" + h).join("");
    const msgs = await Promise.all(ids.map((id) => gmailApi(`messages/${id}?format=metadata${campos}`).catch(() => null)));
    gm.emails = msgs.filter(Boolean).map((m) => {
      const de = lerRemetente(cabecalho(m, "From"));
      return { id: m.id, thread: m.threadId, de, assunto: cabecalho(m, "Subject") || "(sem assunto)", trecho: semEntidades(m.snippet || ""),
        data: new Date(Number(m.internalDate) || Date.parse(cabecalho(m, "Date")) || Date.now()),
        spam: (m.labelIds || []).includes("SPAM"),
        novo: (m.labelIds || []).includes("UNREAD") && !adiado("lido-" + m.id), automatico: motivoAutomatico(m, de),
        oportunidade: OPORTUNIDADE_RE.test(cabecalho(m, "Subject") + " " + (m.snippet || "")) && !NAO_OPORTUNIDADE_RE.test(cabecalho(m, "Subject")),
        importante: /proposta|or[cç]amento|briefing|contrato|campanha|parceria|pagamento|valor|cach[eê]|budget|rate|paid|collab/i.test(cabecalho(m, "Subject") + " " + (m.snippet || "")) };
    }).filter((x) => x.de.email !== EMAIL_PROPOSTAS)
      // Uma conversa vira um cartão só (o e-mail mais recente dela)
      .filter((x, i, todos) => todos.findIndex((y) => y.thread === x.thread) === i);
  } catch (e) {
    gm.erro = e.message || String(e);
  }
  gm.carregando = false;
  propostasNovas = [...propostasVisiveis(), ...oportunidadesVisiveis()].filter((x) => x.novo).length;
  desenhar();
}

const propostasVisiveis = () => (gm.emails || []).filter((x) => !x.automatico && !adiado("email-" + x.id));
const oportunidadesVisiveis = () => (gm.emails || []).filter((x) => x.automatico && x.oportunidade && !adiado("email-" + x.id));
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
  propostasNovas = [...propostasVisiveis(), ...oportunidadesVisiveis()].filter((x) => x.novo).length;
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
  const site = "https://ugc.ryalvz.com.br/";
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
        <span class="sub">vai de <span class="sigilo">${esc(EMAIL_PROPOSTAS)}</span>, dentro da mesma conversa no Gmail</span>
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
        ${x.de.dominio ? `<button type="button" class="link-btn pequeno-link" data-acao-email="esconder-remetente">esconder sempre <span class="sigilo">${esc(x.de.dominio)}</span></button>` : ""}
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
      <p>O painel lê a caixa de entrada do <b class="sigilo">${esc(EMAIL_PROPOSTAS)}</b>, separa os e-mails de proposta escritos por pessoas e esconde os automáticos. Você responde daqui mesmo, sem abrir o Gmail.</p>
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
  const automaticos = (gm.emails || []).filter((x) => x.automatico && !x.oportunidade && !adiado("email-" + x.id));
  // Campanhas e convites das plataformas de UGC (Air, Creatify, Vyre, TikTok Shop...): não são de pessoa, mas são trabalho
  const oportunidades = oportunidadesVisiveis();
  const minutos = Math.max(1, Math.round((gm.expira - Date.now()) / 60000));
  el.innerHTML = `
    <div class="barra">
      <div class="busca">${ic("busca")}<input type="search" id="busca-gmail" placeholder="Filtrar mais (ex: nome da marca)" value="${esc(gm.busca)}" aria-label="Filtrar propostas"></div>
      <span class="espaco"></span>
      <span class="sub"><span class="sigilo">${esc(EMAIL_PROPOSTAS)}</span> · ${gm.permanente ? "sincronizado sozinho" : `conectado por mais ${minutos} min`}</span>
      <button class="btn" type="button" id="atualizar-gmail" ${gm.carregando ? "disabled" : ""}>${gm.carregando ? "Lendo..." : "Atualizar"}</button>
      <button class="btn" type="button" id="sair-gmail">Desconectar</button>
    </div>
    ${gm.erro ? `<div class="aviso-falta">${esc(gm.erro)}</div>` : ""}
    ${gm.carregando && !gm.emails ? `<p class="vazio">Lendo o seu Gmail...</p>`
      : `${visiveis.length
          ? `<p class="sub" style="margin:0 0 8px">${plural(visiveis.length, "proposta escrita por uma pessoa", "propostas escritas por pessoas")} nos últimos 90 dias${propostasNovas ? ` · <b>${plural(propostasNovas, "não lida", "não lidas")}</b>` : ""}</p>
            <div class="lista-emails">${visiveis.map(cartaoEmail).join("")}</div>`
          : `<p class="vazio">Nenhuma proposta de pessoa nos últimos 90 dias.</p>`}
        ${oportunidades.length ? `<h3 class="pro-titulo" style="margin:22px 0 4px">📣 Oportunidades em plataformas</h3>
          <p class="sub" style="margin:0 0 8px">Campanhas, convites e candidaturas que chegaram pelas plataformas de UGC${oportunidades.filter((x) => x.novo).length ? ` · <b>${plural(oportunidades.filter((x) => x.novo).length, "não lida", "não lidas")}</b>` : ""}</p>
          <div class="lista-emails">${oportunidades.map(cartaoEmail).join("")}</div>` : ""}
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
          <span class="item-dia-texto sigilo"><b>${x.novo ? "● " : ""}${esc(x.assunto)}</b><small>${esc(x.de.nome)} · ${x.data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</small></span>
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
// Modelos na voz do Ryan (estrutura: quem eu sou e o diferencial, a conexão, a ideia pronta, portfólio e uma pergunta).
// Até 150 palavras, sem "espero que esteja bem", sem anexo. {pessoa}, {conexao} e {ideia} vêm de cada marca.
const MODELOS_VOZ = {
  prospeccao: {
    nome: "E-mail de prospecção",
    assuntos: ["Uma ideia de vídeo pra {marca}", "Roteiro pronto pra {marca}", "Pensei num vídeo pra {marca}"],
    texto: `Oi, {pessoa}!

Sou o Ryan, criador de UGC de tech e lifestyle. Antes de gravar, passei 12 anos vendendo, então meus roteiros começam pela dúvida que faz o cliente desistir da compra.

{conexao}

A ideia: {ideia} Isso vira vídeo vertical pra vocês usarem no perfil e em anúncio, com roteiro aprovado antes de eu gravar.

Meu portfólio: https://ugc.ryalvz.com.br

Faz sentido eu te mandar o roteiro completo?

Ryan Alves · @ryalvz

P.S.: independente dessa collab, me conta como funciona o processo de vocês com criativos hoje? Se tiverem lista de creators, quero entrar nela.`
  },
  segundo: {
    nome: "Segundo e-mail (reabre a conversa)",
    assuntos: ["Sobre o vídeo pra {marca}", "Ainda sobre a ideia pra {marca}", "{marca}: posso te chamar no WhatsApp?"],
    texto: `Oi, {pessoa}!

Passando rapidinho pra saber se vocês conseguiram ver o meu último e-mail, com a ideia de vídeo pra {marca}.

Se for mais fácil conversar por outro canal, posso te chamar no WhatsApp. Qual número fica melhor pra você?

Ryan Alves · @ryalvz
https://ugc.ryalvz.com.br`
  }
};
// A DM não vende: só pede o canal certo pra mandar a proposta
const MODELO_DM = `Oi, time da {marca}! Sou o Ryan, criador de UGC de tech e lifestyle (@ryalvz). Tenho uma ideia de vídeo pra vocês e queria mandar a proposta por e-mail. Qual é o melhor e-mail pra esse tipo de contato?`;
// Candidatura nas campanhas do Seu Influencer: diferencial, apresentação, conexão e portfólio
const MODELO_SEUINF = `Mais de 40 marcas atendidas, entre elas Canva, Rexona e Mercado Livre.

Sou o Ryan, criador de UGC de tech e lifestyle. Antes do UGC, passei 12 anos em vendas, então meus roteiros começam pela objeção do cliente e terminam com uma chamada clara.

{conexao}

Meu portfólio: https://ugc.ryalvz.com.br`;
// Textos pra colar no Claude: o que é fixo já vem preenchido, o que muda fica entre colchetes
const SOBRE_RYAN = "gravo UGC de tech e lifestyle, vídeo vertical pra perfil e anúncio. Antes do UGC passei 12 anos em vendas, então meus roteiros começam pela dúvida que faz o cliente desistir da compra. Mais de 40 marcas atendidas, entre elas Canva, Rexona e Mercado Livre.";
const TOM_RYAN = "conversa de café, primeira pessoa, direto, frases curtas, de igual pra igual. Nunca usar travessão. Nada de \"não é X, é Y\", \"isso muda tudo\" ou número e resultado inventado.";
const PS_RYAN = "P.S.: independente dessa collab, me conta como funciona o processo de vocês com criativos hoje? Se tiverem lista de creators, quero entrar nela.";
const PROMPTS_CLAUDE = {
  email: { nome: "E-mail", texto: `Escreve o meu e-mail de prospecção pra marca, seguindo esta estrutura:
1 quem eu sou e o meu diferencial · 2 por que estou falando com essa marca · 3 a ideia de conteúdo pronta · 4 link do portfólio e uma pergunta no fim.

Sobre mim: ${SOBRE_RYAN}
Meu portfólio: https://ugc.ryalvz.com.br
Meu tom: ${TOM_RYAN}

Regras: no máximo 150 palavras, sem enrolação, sem "espero que esteja bem", nada de anexo.
Deixa marcado com chave o que muda em cada marca: {marca}, {pessoa} e {conexao}.
Termina com este P.S., do jeito que está:
${PS_RYAN}

Me entrega três opções de assunto também.

Marca desta vez (opcional): [cole o site, o Instagram ou o que você sabe da marca. Se colar, ele já preenche as chaves]` },
  dm: { nome: "Versão de DM", texto: `Escreve a versão de DM do meu e-mail de prospecção, pro direct do Instagram da marca, seguindo esta estrutura:
1 quem eu sou em uma frase · 2 a ideia de vídeo pra marca em uma frase · 3 uma pergunta pedindo o melhor e-mail pra mandar a proposta.

Sobre mim: ${SOBRE_RYAN}
Meu Instagram: @ryalvz
Meu tom: ${TOM_RYAN}

Regras: no máximo 60 palavras, sem link, sem "espero que esteja bem", uma pergunta só.
Deixa marcado com chave o que muda em cada marca: {marca} e {conexao}.

Me entrega duas versões: uma mais curta e uma com a ideia mais detalhada.

Marca desta vez (opcional): [cole o Instagram ou o que você sabe da marca]` },
  segundo: { nome: "Segundo e-mail", texto: `Escreve o segundo e-mail de prospecção, pra marca que não respondeu o primeiro, seguindo esta estrutura:
1 retoma em uma frase a ideia que mandei · 2 traz um ângulo novo (outra ideia curta de vídeo) · 3 pede o WhatsApp de quem cuida das parcerias.

Sobre mim: ${SOBRE_RYAN}
Meu portfólio: https://ugc.ryalvz.com.br
Meu tom: ${TOM_RYAN}

Regras: no máximo 80 palavras, sem cobrar resposta, sem "só passando pra lembrar", sem "espero que esteja bem", nada de anexo.
Deixa marcado com chave o que muda em cada marca: {marca}, {pessoa} e {ideia}.

Me entrega três opções de assunto também, que funcionem como resposta do primeiro e-mail.

Ideia do primeiro e-mail (opcional): [cole aqui a ideia que você mandou]` },
  seuinf: { nome: "Seu Influencer", texto: `Escreve a minha candidatura pra uma campanha no Seu Influencer, seguindo esta estrutura:
1 prova logo na primeira linha (marcas que já atendi) · 2 quem eu sou e o meu diferencial · 3 por que essa campanha combina comigo · 4 link do portfólio.

Sobre mim: ${SOBRE_RYAN}
Meu portfólio: https://ugc.ryalvz.com.br
Meu tom: ${TOM_RYAN}

Regras: no máximo 100 palavras, sem enrolação, sem pedir oportunidade, sem "espero que esteja bem".
Deixa marcado com chave o que muda em cada campanha: {marca} e {conexao}.

Campanha desta vez: [cole o briefing da campanha]` }
};
const usaCamposDaMarca = () => /\{\{?\s*(pessoa|conexao|conexão|ideia)\s*\}?\}/i.test([pro.assunto, pro.escrita === "html" ? pro.html : pro.texto].join(" "));

const MODELO_ASSUNTO = "Conteúdo UGC para a {{marca}}";
const MODELO_TEXTO = `Oi, time da {{nome}}! Tudo bem?

Meu nome é Ryan Alves e eu sou criador de conteúdo UGC. Faço vídeos com cara de cliente de verdade, pensados para anúncios e redes sociais.

Acompanho o trabalho da {{marca}} e acredito que dá para criar conteúdos que conversam muito bem com o público de vocês.

Se fizer sentido, é só responder este e-mail que eu mando ideias e valores.

Abraço,
Ryan Alves`;
const pro = {
  envio: "gmail", escrita: "texto", publico: "selecionadas", pularRepetidos: true,
  // Padrão: o e-mail na voz do Ryan (só falta preencher o que muda em cada marca)
  assunto: MODELOS_VOZ.prospeccao.assuntos[0], texto: MODELOS_VOZ.prospeccao.texto, modeloVoz: "prospeccao", html: "", botaoTexto: "", botaoLink: "https://ugc.ryalvz.com.br/",
  envios: null, optout: null, falta: [], carregando: false, carregado: false, buscaHist: "",
  testeFeito: "", filaPulados: [], sairConferido: false, abaPrompt: "email"
};
// O rascunho fica guardado neste aparelho, para você não perder o texto
(function lerRascunho() {
  try {
    const r = JSON.parse(localStorage.getItem("prospeccao-rascunho") || "null");
    if (!r) return;
    if (r.v === 4) ["envio", "escrita", "assunto", "texto", "html", "botaoTexto", "botaoLink", "modeloVoz"].forEach((k) => { if (r[k] != null) pro[k] = r[k]; });
    else if (r.envio) pro.envio = r.envio;
  } catch (_) {}
})();
function guardarRascunho() {
  try { localStorage.setItem("prospeccao-rascunho", JSON.stringify({ v: 4, envio: pro.envio, escrita: pro.escrita, assunto: pro.assunto, texto: pro.texto, html: pro.html, botaoTexto: pro.botaoTexto, botaoLink: pro.botaoLink, modeloVoz: pro.modeloVoz })); } catch (_) {}
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
  const linkar = (s) => s.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" style="color:#8A6B33;">$1</a>');
  return String(t || "").trim().split(/\n\s*\n/).map((p) => `<p style="margin:0 0 14px;">${linkar(esc(p)).replace(/\n/g, "<br>")}</p>`).join("\n      ");
}
function montarEmailHTML({ texto, botaoTexto, botaoLink }) {
  const botao = botaoTexto && /^https?:\/\//.test(botaoLink || "")
    ? `<p style="margin:24px 0 8px;"><a href="${esc(botaoLink)}" style="display:inline-block;background:#2B241C;color:#F6F2EB;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:999px;">${esc(botaoTexto)}</a></p>` : "";
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
// Chaves do e-mail: {marca}/{{marca}}, {nome}, {pessoa}, {conexao}, {ideia}. O que muda em cada marca vem da aba Marcas.
// Sem conexão ou sem ideia, o parágrafo inteiro sai (nada inventado). Sem pessoa, vira "time da Marca".
const CHAVE_RE = (k) => new RegExp(`\\{\\{?\\s*${k}\\s*\\}?\\}`, "gi");
function valoresDe(nome, marca, x = {}) {
  return { nome, marca, pessoa: String(x.pessoa || "").trim() || `time da ${nome}`, conexao: String(x.conexao || "").trim(), ideia: String(x.ideia || "").trim() };
}
function preencherChaves(t, nome, marca, x) {
  const v = valoresDe(nome, marca, x);
  const vazio = (p) => ["conexao", "conexão", "ideia"].some((k) => CHAVE_RE(k).test(p) && !v[k === "conexão" ? "conexao" : k]);
  let s = String(t || "").replace(/<p\b[^>]*>[\s\S]*?<\/p>/gi, (p) => (vazio(p) ? "" : p));
  ["nome", "marca", "pessoa", "conexao", "conexão", "ideia"].forEach((k) => { s = s.replace(CHAVE_RE(k), esc(v[k === "conexão" ? "conexao" : k])); });
  return s;
}
// Mesma coisa em texto puro (Gmail e rascunho), parágrafo por parágrafo
function preencherTexto(t, d) {
  const v = valoresDe(d.nome, d.marca, d);
  return String(t || "").split(/\n\s*\n/).filter((p) => !["conexao", "conexão", "ideia"].some((k) => CHAVE_RE(k).test(p) && !v[k === "conexão" ? "conexao" : k]))
    .map((p) => { ["nome", "marca", "pessoa", "conexao", "conexão", "ideia"].forEach((k) => { p = p.replace(CHAVE_RE(k), v[k === "conexão" ? "conexao" : k]); }); return p; }).join("\n\n");
}
const assuntoPara = (d) => preencherChaves(pro.assunto, d.nome, d.marca, d).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// Versão em texto puro (para copiar e para o Gmail)
function textoPuroPara(d) {
  if (pro.escrita === "html") {
    const div = document.createElement("div");
    div.innerHTML = preencherChaves(pro.html, d.nome, d.marca, d).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li|tr)>/gi, "\n\n");
    return (div.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }
  let t = preencherTexto(pro.texto, d).trim();
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
    lista.push({ email, nome: nomeCurto(m.nome), marca: m.nome, marca_id: m.id, pessoa: m.contato_nome || "", conexao: m.conexao || "", ideia: m.ideia || "" });
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
    <div class="cartao pro-prompts">
      <div class="barra"><h2 style="margin:0">${ic("transcricao")} Pedir pro Claude</h2></div>
      <p class="sub" style="margin:2px 0 12px">Escolha o texto, copie e cole no Claude. Só troque o que estiver entre colchetes.</p>
      <div class="pro-abas" role="tablist" aria-label="Qual texto">
        ${Object.entries(PROMPTS_CLAUDE).map(([k, p]) => `<button type="button" role="tab" data-aba-prompt="${k}" aria-selected="${pro.abaPrompt === k}">${esc(p.nome)}</button>`).join("")}
      </div>
      <pre class="pro-prompt" id="pro-prompt" role="tabpanel">${esc(PROMPTS_CLAUDE[pro.abaPrompt].texto)}</pre>
      <div class="pro-prompt-acoes">
        <button class="btn primario" type="button" id="pro-prompt-copiar">${ic("transcricao")}Copiar</button>
        <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude</a>
      </div>
    </div>
    <div class="pro-grade">
      <div class="pro-form">
        <div class="cartao">
          <div class="pro-modos" role="radiogroup" aria-label="Como enviar">
            <button type="button" role="radio" data-envio="gmail" aria-checked="${pro.envio === "gmail"}"><b>Pelo meu Gmail</b><small>sai do <span class="sigilo">${esc(EMAIL_PROPOSTAS)}</span></small></button>
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
          <div class="pro-modelos-voz"><span class="pro-rotulo" style="margin:0">Modelos na minha voz</span>
            ${Object.entries(MODELOS_VOZ).map(([k, m]) => `<button class="btn pequeno" type="button" data-modelo-voz="${k}">${ic("transcricao")}${esc(m.nome)}</button>`).join("")}
          </div>
          <div class="chips pro-escrita" role="group" aria-label="Jeito de escrever">
            <button class="chip" type="button" data-escrita="texto" aria-pressed="${pro.escrita === "texto"}">Texto fácil</button>
            <button class="chip" type="button" data-escrita="html" aria-pressed="${pro.escrita === "html"}">HTML</button>
          </div>
          <label class="pro-rotulo" for="pro-assunto">Assunto</label>
          <input class="campo" id="pro-assunto" value="${esc(pro.assunto)}" placeholder="Conteúdo UGC para a {{marca}}">
          ${MODELOS_VOZ[pro.modeloVoz] ? `<div class="pro-assuntos"><small class="sub">Outras opções:</small>${MODELOS_VOZ[pro.modeloVoz].assuntos.map((a) => `<button class="chip" type="button" data-assunto="${esc(a)}" aria-pressed="${pro.assunto === a}">${esc(a)}</button>`).join("")}</div>` : ""}
          ${pro.escrita === "texto" ? `
            <label class="pro-rotulo" for="pro-texto">Texto</label>
            <textarea class="campo pro-texto" id="pro-texto" rows="12">${esc(pro.texto)}</textarea>
            <div id="pro-revisor" hidden></div>
            <p class="ajuda">Use <code>{marca}</code> pro nome da marca, <code>{pessoa}</code> pra quem vai ler, <code>{conexao}</code> e <code>{ideia}</code> pro que muda em cada marca (preenche no item 3). Linha em branco separa os parágrafos, e os links viram clicáveis sozinhos.</p>
            <div class="pro-botao-campos">
              <div><label class="pro-rotulo" for="pro-btxt">Texto do botão (opcional)</label><input class="campo" id="pro-btxt" value="${esc(pro.botaoTexto)}" placeholder="Ver meu portfólio"></div>
              <div><label class="pro-rotulo" for="pro-blink">Link do botão</label><input class="campo" id="pro-blink" value="${esc(pro.botaoLink)}" placeholder="https://..."></div>
            </div>` : `
            <div class="barra" style="margin:12px 0 4px"><label class="pro-rotulo" for="pro-html" style="margin:0">HTML do e-mail</label><span class="espaco"></span>
              <button class="btn pequeno" type="button" id="pro-modelo">${ic("transcricao")}Começar do modelo pronto</button></div>
            <textarea class="campo pro-html" id="pro-html" rows="16" spellcheck="false" placeholder="Cole aqui o HTML do e-mail">${esc(pro.html)}</textarea>
            <p class="ajuda">O que estiver aqui é exatamente o que sai. <code>{{nome}}</code> e <code>{{marca}}</code> continuam funcionando. Deixe o rodapé do SAIR no texto.</p>`}
        </div>

        <div class="cartao" id="pro-por-marca" hidden></div>
        <div class="cartao" id="pro-enviar"></div>
      </div>

      <div class="pro-previa-coluna">
        <div class="pro-previa-topo"><b>Como vai chegar</b><span class="espaco"></span><button class="btn pequeno" type="button" id="pro-tela-cheia">${ic("olho")}Ver em tela cheia</button></div>
        <div class="pro-palco">
          <div class="pro-janela-email">
            <div class="pro-email-cabeca">
              <span class="pro-avatar">R</span>
              <div><strong id="pro-previa-assunto"></strong><small><span class="sigilo">Ryan Alves &lt;${esc(EMAIL_PROPOSTAS)}&gt;</span> para você</small></div>
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

  // Pedir pro Claude: troca de aba sem redesenhar a página
  $$("[data-aba-prompt]", el).forEach((b) => b.onclick = () => {
    pro.abaPrompt = b.dataset.abaPrompt;
    $$("[data-aba-prompt]", el).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $("#pro-prompt").textContent = PROMPTS_CLAUDE[pro.abaPrompt].texto;
  });
  $("#pro-prompt-copiar").onclick = async () => {
    const texto = PROMPTS_CLAUDE[pro.abaPrompt].texto;
    try { await navigator.clipboard.writeText(texto); avisar(`${PROMPTS_CLAUDE[pro.abaPrompt].nome}: copiado. Cola no Claude.`); }
    catch (_) { abrirJanelaSimples("Copie o texto", `<textarea class="campo" rows="14" style="width:100%">${esc(texto)}</textarea>`); }
  };

  const exemplo = () => (destinatariosDe(pro.publico === "teste" ? "todas" : pro.publico).lista[0]) || { nome: "Natura", marca: "Natura" };
  const pintarPrevia = () => {
    const d = exemplo();
    $("#pro-previa-assunto").textContent = assuntoPara(d) || "(sem assunto)";
    $("#pro-previa").srcdoc = preencherChaves(htmlAtual(), d.nome, d.marca, d) || `<p style="font-family:Arial;color:#888;padding:20px">Cole o HTML do e-mail para ver a prévia.</p>`;
  };
  // 3. O que muda em cada marca: pessoa, conexão e ideia, salvos na própria marca
  const pintarPorMarca = (r = destinatariosDe(pro.publico)) => {
    const caixa = $("#pro-por-marca");
    if (!caixa) return;
    if (!usaCamposDaMarca() || pro.publico === "teste") { caixa.hidden = true; return; }
    caixa.hidden = false;
    const lista = r.lista.filter((d) => d.marca_id).slice(0, 60);
    const comConexao = lista.filter((d) => d.conexao).length, comIdeia = lista.filter((d) => d.ideia).length;
    caixa.innerHTML = `<h3 class="pro-titulo">3. O que muda em cada marca</h3>
      <p class="sub" style="margin:0 0 8px">${comConexao} de ${lista.length} com conexão e ${comIdeia} com ideia. Quem estiver sem, recebe o e-mail sem esse parágrafo: nada é inventado. Fica salvo na marca, pra próxima vez.</p>
      ${lista.length ? `<div class="pro-marcas-campos">${lista.map((d) => `<div class="pro-marca-linha" data-mid="${d.marca_id}">
        <div class="pro-marca-nome"><b>${esc(d.marca)}</b><small>${esc(d.email)}</small><button class="link-btn" type="button" data-dm="${d.marca_id}">${ic("insta")}Copiar DM</button><button class="link-btn" type="button" data-dm="${d.marca_id}" data-tipo="seuinf">${ic("transcricao")}Copiar Seu Influencer</button></div>
        <input class="campo" data-campo="contato_nome" placeholder="Com quem falar (opcional)" value="${esc(d.pessoa)}">
        <textarea class="campo" data-campo="conexao" rows="2" placeholder="A conexão: por que essa marca, agora">${esc(d.conexao)}</textarea>
        <textarea class="campo" data-campo="ideia" rows="2" placeholder="A ideia de vídeo pronta">${esc(d.ideia)}</textarea>
      </div>`).join("")}</div>${r.lista.length > lista.length ? `<p class="sub">Mostrando as primeiras ${lista.length}.</p>` : ""}` : `<p class="vazio">Escolha pra quem vai no item 1.</p>`}`;
    $$("[data-campo]", caixa).forEach((inp) => inp.onchange = async () => {
      const id = inp.closest("[data-mid]").dataset.mid, campo = inp.dataset.campo, valor = inp.value.trim() || null;
      if (!(await gravar("marcas", { [campo]: valor }, id))) return;
      const m = S.marcas.find((x) => String(x.id) === String(id)); if (m) m[campo] = valor;
      pintarPrevia();
    });
    $$("[data-dm]", caixa).forEach((b) => b.onclick = async () => {
      const d = destinatariosDe(pro.publico).lista.find((x) => String(x.marca_id) === b.dataset.dm);
      const texto = preencherTexto(b.dataset.tipo === "seuinf" ? MODELO_SEUINF : MODELO_DM, d).trim();
      try { await navigator.clipboard.writeText(texto); avisar(b.dataset.tipo === "seuinf" ? "Texto do Seu Influencer copiado." : "DM copiada. Cola no direct da marca."); } catch (_) { abrirJanelaSimples("Copie a DM", `<textarea class="campo" rows="5" style="width:100%">${esc(texto)}</textarea>`); }
    });
  };
  const pintarContagem = () => {
    const r = destinatariosDe(pro.publico);
    pintarPorMarca(r);
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
  // Modelos na voz do Ryan e as sugestões de assunto
  $$("[data-modelo-voz]", el).forEach((b) => b.onclick = async () => {
    const m = MODELOS_VOZ[b.dataset.modeloVoz];
    if ((pro.texto || "").trim() && pro.texto !== m.texto && !(await confirmar(`Trocar o texto atual pelo modelo "${m.nome}"?`, "Usar o modelo"))) return;
    Object.assign(pro, { escrita: "texto", texto: m.texto, assunto: m.assuntos[0], botaoTexto: "", modeloVoz: b.dataset.modeloVoz });
    guardarRascunho();
    desenhar();
  });
  $$("[data-assunto]", el).forEach((b) => b.onclick = () => { pro.assunto = b.dataset.assunto; guardarRascunho(); desenhar(); });
  ["#pro-texto", "#pro-html", "#pro-assunto"].forEach((q) => { const x = $(q, el); if (x) x.addEventListener("change", () => pintarPorMarca()); });
  ligarRevisor($("#pro-texto", el), $("#pro-revisor", el), "email");
  const pintarEnviar = (r = destinatariosDe(pro.publico)) => {
    const caixa = $("#pro-enviar");
    if (pro.envio === "rascunho") { pintarFila(caixa, r); return; }
    const assinatura = pro.envio + "|" + pro.assunto + "|" + htmlAtual();
    const testado = pro.testeFeito === assinatura;
    if (pro.envio === "gmail") {
      const sobra = Math.max(0, LIMITE_GMAIL_DIA - enviadosHojeGmail());
      const vai = Math.min(sobra, r.lista.length);
      caixa.innerHTML = `<h3 class="pro-titulo">4. Enviar pelo seu Gmail</h3>
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
    caixa.innerHTML = `<h3 class="pro-titulo">4. Enviar</h3>
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
        <td class="sigilo">${esc(x.email)}</td><td class="corta" title="${esc(x.assunto)}">${esc(x.assunto)}</td>
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
    $("iframe", c).srcdoc = preencherChaves(htmlAtual(), d.nome, d.marca, d);
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
    const r = await chamarCarteiro({ teste: true, assunto: pro.assunto, html: htmlAtual(), destinatarios: [{ email: EMAIL_PROPOSTAS, nome: d.nome, marca: d.marca, pessoa: d.pessoa, conexao: d.conexao, ideia: d.ideia }] });
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
        ${pro.envio === "gmail" ? `<p class="sub">Sai do seu e-mail <span class="sigilo">${esc(EMAIL_PROPOSTAS)}</span>, um por um.</p>` : ""}
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
    `--${fronteira}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(preencherChaves(htmlAtual(), d.nome, d.marca, d)),
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
  if (pro.publico === "teste") { caixa.innerHTML = `<h3 class="pro-titulo">4. Fila de envio</h3><p class="sub">No modo rascunho, escolha uma lista de marcas em "Pra quem vai".</p>`; return; }
  if (!fila.length) {
    caixa.innerHTML = `<h3 class="pro-titulo">4. Fila de envio</h3><p class="vazio">${r.lista.length ? "Você passou por todas da fila." : "Ninguém na fila. Escolha outra lista ou selecione marcas na aba Marcas."}</p>
      ${pro.filaPulados.length ? `<button class="btn" type="button" id="pro-refila">Voltar as ${num(pro.filaPulados.length)} que pulei</button>` : ""}`;
    if ($("#pro-refila")) $("#pro-refila").onclick = () => { pro.filaPulados = []; desenhar(); };
    return;
  }
  const d = fila[0];
  const assunto = assuntoPara(d), texto = textoPuroPara(d);
  const gmail = "https://mail.google.com/mail/?view=cm&fs=1&authuser=" + encodeURIComponent(EMAIL_PROPOSTAS)
    + "&to=" + encodeURIComponent(d.email) + "&su=" + encodeURIComponent(assunto) + "&body=" + encodeURIComponent(texto);
  caixa.innerHTML = `<div class="barra"><h3 class="pro-titulo" style="margin:0">4. Fila de envio</h3><span class="espaco"></span><span class="etq">1 de ${num(fila.length)}</span></div>
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
            <li>Entre com <b class="sigilo">${esc(EMAIL_PROPOSTAS)}</b> e deixe <b>Calendários</b> ligado.</li>
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
    // CNPJ digitado só com números sai com a pontuação certa
    if (/cnpj/i.test(id)) { const dg = String(v).replace(/\D/g, ""); if (dg.length === 14) return dg.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); }
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
// A logo RA bem clarinha no fundo de cada página (igual à marca d'água do contrato no Word)
let logoContrato = null;
function carregarLogoContrato() {
  if (!logoContrato) logoContrato = fetch("logo-contrato.png").then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = () => ok(null); f.readAsDataURL(b); }) : null))
    .catch(() => null);
  return logoContrato;
}
async function baixarPdfContrato(texto, dados) {
  const pdfMake = await carregarPdfmake();
  const logo = await carregarLogoContrato();
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
    background: (pagina, tamanho) => logo ? { image: logo, width: 300, opacity: 0.13, absolutePosition: { x: (tamanho.width - 300) / 2, y: (tamanho.height - 245) / 2 } } : null,
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
   CONTEÚDO DO SITE (tabela site_conteudo)
   Feedbacks, carrossel de resultados, case em destaque e faixa da
   Black Friday. O site lê daqui; se uma parte estiver vazia, ele usa
   o que está escrito no index.html.
   ============================================================= */
const sc = { dados: null, erro: "" };
const linhasDoTexto = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const urlSite = (u) => (!u ? "" : /^https?:/i.test(u) ? u : "../" + u.replace(/^\.?\//, ""));

async function carregarSiteConteudo() {
  const { data, error } = await db.from("site_conteudo").select("chave,valor");
  if (error) { sc.erro = traduzErro(error); sc.dados = {}; return; }
  sc.erro = ""; sc.dados = Object.fromEntries(data.map((l) => [l.chave, l.valor]));
}
async function salvarSiteConteudo(chave, valor) {
  const { error } = await db.from("site_conteudo").upsert({ chave, valor, atualizado_em: new Date().toISOString() });
  if (error) { avisar(traduzErro(error), true); return false; }
  sc.dados[chave] = valor;
  return true;
}

async function desenharConteudoSite(el) {
  if (!el) return;
  if (!sc.dados) { el.innerHTML = `<p class="sub" style="margin-top:24px">Carregando o conteúdo do site...</p>`; await carregarSiteConteudo(); }
  if (sc.erro) { el.innerHTML = `<div class="cartao" style="margin-top:24px"><h2>Conteúdo do site</h2><p class="sub">Não consegui ler o conteúdo do site: ${esc(sc.erro)}. Rode a parte 31 do banco.sql no Supabase.</p></div>`; return; }
  const fb = sc.dados.feedbacks || [], rs = sc.dados.resultados || [], cs = sc.dados.case || {}, bf = sc.dados.black_friday || {};
  const setas = (tipo, i, n) => `<button class="icone-btn" type="button" data-sc-sobe="${tipo}:${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button><button class="icone-btn" type="button" data-sc-desce="${tipo}:${i}" ${i === n - 1 ? "disabled" : ""} aria-label="Descer">↓</button>`;
  const bfDias = bf.data ? Math.round((new Date(bf.data + "T00:00:00") - new Date(hojeISO() + "T00:00:00")) / 864e5) : null;
  el.innerHTML = `
    <div class="barra" style="margin-top:28px"><h2 style="margin:0">Conteúdo do site</h2><span class="sub">o que você mudar aqui aparece no portfólio na hora (em português e, se preencher, em inglês)</span></div>
    <div class="sc-grade">
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Feedbacks</h2><span class="sub">${fb.length} no carrossel</span><span class="espaco"></span><button class="btn primario pequeno" type="button" data-sc-novo="feedbacks">${ic("mais")}Adicionar</button></div>
        <ul class="sc-lista">${fb.map((t, i) => `<li>
          <span class="sc-logo">${t.logo ? `<img src="${esc(urlSite(t.logo))}" alt="">` : esc((t.nome || "?").charAt(0))}</span>
          <span class="sc-txt"><b>${esc(t.nome)}</b><small>${t.estrelas === false ? "sem estrelas" : "★★★★★"} · ${esc((t.texto || "").slice(0, 70))}${(t.texto || "").length > 70 ? "..." : ""}</small></span>
          <span class="sc-acoes">${setas("feedbacks", i, fb.length)}<button class="icone-btn" type="button" data-sc-editar="feedbacks:${i}" aria-label="Editar">${ic("editar")}</button></span></li>`).join("") || `<li class="sub">Nenhum feedback ainda.</li>`}</ul>
      </div>
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Os vídeos que mais renderam</h2><span class="sub">carrossel logo depois do Sobre</span><span class="espaco"></span><button class="btn primario pequeno" type="button" data-sc-novo="resultados">${ic("mais")}Adicionar</button></div>
        <ul class="sc-lista">${rs.map((r, i) => `<li>
          <span class="sc-logo sc-capa">${r.capa ? `<img src="${esc(r.capa)}" alt="">` : ""}</span>
          <span class="sc-txt"><b>${esc(r.marca)}</b><small>${esc(r.rotulo || "")} · ${esc(r.valor || "")}</small></span>
          <span class="sc-acoes">${setas("resultados", i, rs.length)}<button class="icone-btn" type="button" data-sc-editar="resultados:${i}" aria-label="Editar">${ic("editar")}</button></span></li>`).join("") || `<li class="sub">Nenhum vídeo no carrossel.</li>`}</ul>
      </div>
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Case em destaque</h2><span class="espaco"></span><button class="btn pequeno" type="button" data-sc-case>${ic("editar")}Editar case</button></div>
        <div class="sc-case">${cs.print ? `<img src="${esc(urlSite(cs.print))}" alt="">` : ""}<div><b>${esc(cs.marca || "Sem case")}</b><p class="sub" style="margin:4px 0 0">${esc(cs.titulo || "")}${cs.numero ? ` · ${esc(cs.numero)} ${esc(cs.rotulo || "")}` : ""}</p></div></div>
      </div>
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Faixa da Black Friday</h2><span class="espaco"></span><button class="btn pequeno" type="button" data-sc-bf>${ic("editar")}Editar faixa</button></div>
        <p class="sub" style="margin:0">${bf.ativo === false ? "Desligada." : !bf.data ? "Sem data." : bfDias < 0 ? "A data já passou, a faixa não aparece." : `Ligada: ${bfDias === 0 ? "hoje é o dia" : `faltam ${bfDias} dias`} (${dataBR(bf.data)}).`}</p>
        ${(bf.frases || []).length ? `<ul class="sc-frases">${bf.frases.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </div>
    </div>`;
  const mover = async (alvo, passo) => {
    const [tipo, i] = alvo.split(":"); const k = Number(i), lista = [...(sc.dados[tipo] || [])], j = k + passo;
    if (j < 0 || j >= lista.length) return;
    [lista[k], lista[j]] = [lista[j], lista[k]];
    if (await salvarSiteConteudo(tipo, lista)) desenharConteudoSite(el);
  };
  $$("[data-sc-sobe]", el).forEach((b) => b.onclick = () => mover(b.dataset.scSobe, -1));
  $$("[data-sc-desce]", el).forEach((b) => b.onclick = () => mover(b.dataset.scDesce, 1));
  $$("[data-sc-novo]", el).forEach((b) => b.onclick = () => (b.dataset.scNovo === "feedbacks" ? formFeedbackSite(el, null) : formResultadoSite(el, null)));
  $$("[data-sc-editar]", el).forEach((b) => b.onclick = () => { const [tipo, i] = b.dataset.scEditar.split(":"); tipo === "feedbacks" ? formFeedbackSite(el, Number(i)) : formResultadoSite(el, Number(i)); });
  $("[data-sc-case]", el).onclick = () => formCaseSite(el);
  $("[data-sc-bf]", el).onclick = () => formBlackFridaySite(el);
}

function formFeedbackSite(el, i) {
  const lista = [...(sc.dados.feedbacks || [])], t = i == null ? { estrelas: true } : lista[i];
  abrirForm({
    titulo: i == null ? "Novo feedback" : `Feedback: ${t.nome}`,
    valores: { ...t, estrelas: t.estrelas !== false },
    campos: [
      { n: "nome", r: "Marca", req: true },
      { n: "empresa", r: "Segmento (embaixo do nome)", ph: "Ex: Tecnologia, Moda, Agência" },
      { n: "texto", r: "O que a marca disse", t: "textarea", req: true },
      { n: "logo_arq", r: "Logo da marca (opcional)", t: "file", accept: "image/png,image/jpeg,image/webp", ajuda: t.logo ? "Já tem logo. Escolha outra só se quiser trocar." : "PNG ou JPG, de preferência quadrada." },
      { n: "estrelas", r: "Mostrar as 5 estrelas", t: "check" },
      { n: "empresa_en", r: "Segmento em inglês (opcional)" },
      { n: "texto_en", r: "O que a marca disse, em inglês (opcional)", t: "textarea", ajuda: "Aparece quando a pessoa escolhe EN no site. Se ficar vazio, mostra em português." }
    ],
    aoSalvar: async (d, status) => {
      let logo = t.logo || "";
      if (d.logo_arq) { status("Enviando a logo..."); logo = await enviarArquivo(d.logo_arq, "logos-feedback", d.nome); if (!logo) return false; }
      const novo = { nome: d.nome, empresa: d.empresa || "", empresa_en: d.empresa_en || "", texto: d.texto, texto_en: d.texto_en || "", logo, estrelas: d.estrelas };
      if (i == null) lista.unshift(novo); else lista[i] = novo;
      const ok = await salvarSiteConteudo("feedbacks", lista);
      if (ok) desenharConteudoSite(el);
      return ok;
    },
    aoApagar: i == null ? null : async () => { lista.splice(i, 1); const ok = await salvarSiteConteudo("feedbacks", lista); if (ok) desenharConteudoSite(el); return ok; }
  });
}

function formResultadoSite(el, i) {
  const lista = [...(sc.dados.resultados || [])], r = i == null ? {} : lista[i];
  const atual = S.videos.find((v) => v.link === r.video);
  const opcoes = [["", "Escolha um vídeo do portfólio"], ...S.videos.filter((v) => v.link).map((v) => [String(v.id), `${v.marca ? v.marca + " · " : ""}${v.titulo}`])];
  abrirForm({
    titulo: i == null ? "Novo vídeo no carrossel" : `Carrossel: ${r.marca}`,
    valores: { ...r, video_id: atual ? String(atual.id) : "" },
    campos: [
      { n: "video_id", r: "Vídeo", t: "select", op: opcoes, inteiro: true, ajuda: i != null && !atual ? "O vídeo atual não está na lista do portfólio. Escolha um para trocar, ou deixe como está." : "" },
      { n: "marca", r: "Nome em cima do vídeo", ph: "Se ficar vazio, usa a marca do vídeo" },
      { n: "rotulo", r: "Rótulo (à esquerda)", ph: "Ex: Visualizações, Roteiro" },
      { n: "valor", r: "Resultado (à direita, grande)", ph: "Ex: 2M, Elogiado" },
      { n: "texto", r: "Frase embaixo", t: "textarea" },
      { n: "rotulo_en", r: "Rótulo em inglês (opcional)" },
      { n: "valor_en", r: "Resultado em inglês (opcional)" },
      { n: "texto_en", r: "Frase em inglês (opcional)", t: "textarea" }
    ],
    aoSalvar: async (d) => {
      const v = S.videos.find((x) => String(x.id) === d.video_id);
      if (!v && !r.video) { avisar("Escolha um vídeo.", true); return false; }
      const novo = { marca: d.marca || (v && v.marca) || r.marca || "", rotulo: d.rotulo || "", rotulo_en: d.rotulo_en || "", valor: d.valor || "", valor_en: d.valor_en || "", texto: d.texto || "", texto_en: d.texto_en || "",
        video: v ? v.link : r.video, capa: v ? (v.capa || "") : r.capa };
      if (i == null) lista.push(novo); else lista[i] = novo;
      const ok = await salvarSiteConteudo("resultados", lista);
      if (ok) desenharConteudoSite(el);
      return ok;
    },
    aoApagar: i == null ? null : async () => { lista.splice(i, 1); const ok = await salvarSiteConteudo("resultados", lista); if (ok) desenharConteudoSite(el); return ok; }
  });
}

function formCaseSite(el) {
  const c = sc.dados.case || {}, rt = c.roteiro || {};
  abrirForm({
    titulo: "Case em destaque",
    valores: { ...c, selos: (c.selos || []).join("\n"), selos_en: (c.selos_en || []).join("\n"), gancho: rt.gancho, desenvolvimento: rt.desenvolvimento, cta: rt.cta },
    campos: [
      { n: "marca", r: "Marca", req: true },
      { n: "titulo", r: "Título", req: true },
      { n: "numero", r: "Número em destaque", ph: "Ex: 2M" },
      { n: "rotulo", r: "Texto do lado do número", ph: "Ex: de views no Instagram" },
      { n: "print_arq", r: "Print do resultado (opcional)", t: "file", accept: "image/png,image/jpeg,image/webp", ajuda: c.print ? "Já tem print. Escolha outro só se quiser trocar." : "" },
      { n: "desafio", r: "O desafio", t: "textarea" },
      { n: "ideia", r: "A ideia", t: "textarea" },
      { n: "resultado", r: "O resultado", t: "textarea" },
      { n: "selos", r: "Selos (um por linha)", t: "textarea", ph: "1,5M em 2 dias" },
      { n: "gancho", r: "Roteiro: gancho (opcional)", t: "textarea" },
      { n: "desenvolvimento", r: "Roteiro: desenvolvimento (opcional)", t: "textarea" },
      { n: "cta", r: "Roteiro: CTA (opcional)", t: "textarea" },
      { n: "titulo_en", r: "Título em inglês (opcional)" },
      { n: "rotulo_en", r: "Texto do número em inglês (opcional)" },
      { n: "desafio_en", r: "O desafio em inglês (opcional)", t: "textarea" },
      { n: "ideia_en", r: "A ideia em inglês (opcional)", t: "textarea" },
      { n: "resultado_en", r: "O resultado em inglês (opcional)", t: "textarea" },
      { n: "selos_en", r: "Selos em inglês, na mesma ordem (opcional)", t: "textarea" }
    ],
    aoSalvar: async (d, status) => {
      let print = c.print || "";
      if (d.print_arq) { status("Enviando o print..."); print = await enviarArquivo(d.print_arq, "cases", d.marca); if (!print) return false; }
      const novo = { marca: d.marca, titulo: d.titulo, titulo_en: d.titulo_en || "", numero: d.numero || "", rotulo: d.rotulo || "", rotulo_en: d.rotulo_en || "", print,
        desafio: d.desafio || "", desafio_en: d.desafio_en || "", ideia: d.ideia || "", ideia_en: d.ideia_en || "", resultado: d.resultado || "", resultado_en: d.resultado_en || "",
        selos: linhasDoTexto(d.selos), selos_en: linhasDoTexto(d.selos_en), roteiro: { gancho: d.gancho || "", desenvolvimento: d.desenvolvimento || "", cta: d.cta || "" } };
      const ok = await salvarSiteConteudo("case", novo);
      if (ok) desenharConteudoSite(el);
      return ok;
    }
  });
}

function formBlackFridaySite(el) {
  const b = sc.dados.black_friday || { ativo: true };
  abrirForm({
    titulo: "Faixa da Black Friday",
    valores: { ...b, ativo: b.ativo !== false, frases: (b.frases || []).join("\n"), frases_en: (b.frases_en || []).join("\n") },
    campos: [
      { n: "ativo", r: "Mostrar a faixa no site", t: "check" },
      { n: "data", r: "Dia da Black Friday", t: "date", ajuda: "A contagem é automática. Depois desse dia a faixa some sozinha." },
      { n: "frases", r: "Frases que giram (uma por linha)", t: "textarea" },
      { n: "frases_en", r: "Frases em inglês, na mesma ordem (opcional)", t: "textarea" }
    ],
    aoSalvar: async (d) => {
      const ok = await salvarSiteConteudo("black_friday", { ativo: d.ativo, data: d.data || "", frases: linhasDoTexto(d.frases), frases_en: linhasDoTexto(d.frases_en) });
      if (ok) desenharConteudoSite(el);
      return ok;
    }
  });
}
