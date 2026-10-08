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
const real = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
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
  transcricoes: ["id", "criado_em", "link", "plataforma", "categoria", "titulo", "transcricao", "transcricao_original", "idioma_original", "observacoes"],
  marcados: ["chave", "marcado"],
  visitas: ["id", "data", "pagina", "origem"]
};
const S = { videos: [], marcas: [], calendario: [], campanhas: [], marcados: {}, visitas: [], transcricoes: [] };
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
  const [videos, marcas, calendario, campanhas, marcados, visitas, transcricoes] = await Promise.all([
    ler("videos", (q, c) => (c.includes("ordem") ? q.order("ordem", { ascending: true }) : q)),
    ler("marcas", (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }) : q)),
    ler("calendario"),
    ler("campanhas"),
    ler("marcados"),
    ler("visitas", (q, c) => (c.includes("data") ? q.gte("data", desde.toISOString()).order("data").limit(10000) : q)),
    ler("transcricoes", (q, c) => (c.includes("criado_em") ? q.order("criado_em", { ascending: false }) : q))
  ]);
  Object.assign(S, { videos, marcas, calendario, campanhas, visitas, transcricoes });
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
  S[tabela] = await ler(tabela, ajustes[tabela]);
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
  return `<div class="${cls}"><label for="${id}">${esc(c.r)}${c.req ? " *" : ""}</label>${input}</div>`;
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

function confirmar(texto) {
  return new Promise((resolve) => {
    const c = document.createElement("dialog");
    c.innerHTML = `<div class="janela-corpo">${esc(texto)}</div>
      <div class="janela-pe"><button type="button" class="btn" data-n>Cancelar</button><button type="button" class="btn primario" data-s>Sim, apagar</button></div>`;
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
  portfolio: desenharPortfolio,
  marcas: desenharMarcas,
  calendario: desenharCalendario,
  campanhas: desenharCampanhas,
  transcricoes: desenharTranscricoes,
  checklist: desenharChecklist
};
let abaAtual = "portfolio";

function irPara(aba) {
  if (!DESENHOS[aba]) aba = "portfolio";
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
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharMenu(); });

  $("#aba-portfolio").innerHTML = '<p class="vazio">Carregando seus dados...</p>';
  await carregarTudo();
  irPara((location.hash || "").slice(1) || "portfolio");
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

function formMarca(m) {
  abrirForm({
    titulo: m ? "Editar marca" : "Adicionar marca",
    tabela: "marcas",
    valores: m || { situacao: "lead", ultimo_contato: hojeISO() },
    campos: [
      { n: "nome", r: "Marca", req: true, inteiro: true },
      { n: "instagram", r: "Instagram", ph: "@marca" },
      { n: "email", r: "E-mail", t: "email" },
      { n: "telefone", r: "Telefone", t: "tel", ph: "(11) 90000-0000" },
      { n: "situacao", r: "Situação", t: "select", op: SITUACOES },
      { n: "ultimo_contato", r: "Último contato", t: "date" },
      { n: "obs", r: "Observação", t: "textarea" }
    ],
    aoSalvar: async (d) => { const ok = await gravar("marcas", d, m ? m.id : null); if (ok) recarregar("marcas"); return ok; },
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
  const prazos = S.campanhas.filter((c) => c.prazo).map((c) => ({
    tipo: "prazo", titulo: "Prazo: " + c.campanha, marca: c.cliente, data: String(c.prazo).slice(0, 10),
    feito: c.status === "Entregue", origem: "campanha", ref: c
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
    else formCampanha(e.ref);
  });
}

const nomeTipo = (t) => (TIPOS_CAL.find((x) => x[0] === t) || [t, t === "prazo" ? "Prazo" : t])[1];
function abrirEvento(e) { if (e.origem === "calendario") formCalendario(e.ref); else formCampanha(e.ref); }

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
   TikTok Shop, Ideias orgânicas e Publi / UGC. A transcrição é feita
   pelo TokScript aberto dentro do próprio painel, e o texto colado é
   traduzido para português pelo tradutor que vem dentro do Chrome.
   ============================================================= */
const CATEGORIAS = [["tiktok_shop", "TikTok Shop"], ["organico", "Ideias orgânicas"], ["publi", "Publi / UGC"]];
const nomeCategoria = (c) => (CATEGORIAS.find((x) => x[0] === c) || [c, "Sem divisão"])[1];
const NOME_PLATAFORMA = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", outro: "Link" };
const NOME_IDIOMA = { en: "inglês", es: "espanhol", fr: "francês", it: "italiano", de: "alemão", ja: "japonês", ko: "coreano", zh: "chinês", ru: "russo", hi: "hindi", ar: "árabe", tr: "turco", nl: "holandês", pl: "polonês" };
const trans = { categoria: "todas", busca: "", sel: null, tokscriptAberto: false };

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

// Traduz em pedaços, para textos longos
async function traduzirParaPortugues(texto, idioma, aviso) {
  if (!("Translator" in self)) return null;
  const disp = await comLimite(self.Translator.availability({ sourceLanguage: idioma, targetLanguage: "pt" }), 6000);
  if (disp === "unavailable") return null;
  let baixando = false;
  const criar = self.Translator.create({
    sourceLanguage: idioma, targetLanguage: "pt",
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

function linkGoogleTradutor(texto) {
  return "https://translate.google.com/?sl=auto&tl=pt&op=translate&text=" + encodeURIComponent(texto.slice(0, 4500));
}

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
    <form class="cartao add-trans" id="form-add-trans" novalidate>
      <label for="novo-link"><b>Novo vídeo de referência</b> <span class="sub">cole o link do YouTube, Instagram ou TikTok</span></label>
      <div class="barra" style="margin:6px 0 0">
        <input class="campo" id="novo-link" type="url" placeholder="https://www.instagram.com/reel/..." style="flex:1 1 280px">
        <select class="campo" id="novo-cat" aria-label="Divisão">${CATEGORIAS.map(([v, t]) => `<option value="${v}" ${v === catPadrao ? "selected" : ""}>${t}</option>`).join("")}</select>
        <button class="btn primario" type="submit">${ic("mais")}Adicionar</button>
      </div>
    </form>
    <div class="trans-grade">
      <div class="trans-lista">
        <div class="busca" style="max-width:none;margin-bottom:8px">${ic("busca")}<input type="search" id="busca-trans" placeholder="Buscar no título, roteiro ou observação" value="${esc(trans.busca)}" aria-label="Buscar transcrições"></div>
        <div id="lista-trans"></div>
      </div>
      <div class="trans-detalhe" id="detalhe-trans"></div>
    </div>`;

  $$("[data-cat]", el).forEach((b) => b.onclick = () => { trans.categoria = b.dataset.cat; desenhar(); });
  $("#form-add-trans").addEventListener("submit", adicionarTranscricao);
  $("#busca-trans").addEventListener("input", (e) => { trans.busca = e.target.value; pintarListaTrans(); });
  $("#lista-trans").addEventListener("click", (e) => {
    const b = e.target.closest("[data-trans]");
    if (!b) return;
    trans.sel = b.dataset.trans; trans.tokscriptAberto = false;
    pintarListaTrans(); pintarDetalheTrans();
    if (window.innerWidth < 960) $("#detalhe-trans").scrollIntoView({ behavior: "smooth" });
  });
  pintarListaTrans();
  pintarDetalheTrans();
}

function filtrarTrans() {
  const q = trans.busca.toLowerCase();
  return S.transcricoes.filter((t) => {
    if (trans.categoria !== "todas" && t.categoria !== trans.categoria) return false;
    return !q || [t.titulo, t.transcricao, t.observacoes, t.link].some((x) => String(x || "").toLowerCase().includes(q));
  });
}

function pintarListaTrans() {
  const lista = filtrarTrans();
  $("#lista-trans").innerHTML = lista.length === 0
    ? `<p class="vazio">${S.transcricoes.length ? "Nada com esse filtro." : "Sua biblioteca está vazia. Cole o link de um vídeo que você gosta aqui em cima."}</p>`
    : lista.map((t) => `<button type="button" class="item-trans ${String(t.id) === String(trans.sel) ? "ativo" : ""}" data-trans="${esc(t.id)}">
        <span class="item-trans-topo"><span class="pilula p-plat-${esc(t.plataforma || "outro")}">${esc(NOME_PLATAFORMA[t.plataforma] || "Link")}</span><span class="pilula p-cat">${esc(nomeCategoria(t.categoria))}</span></span>
        <b>${esc(t.titulo || "Sem título")}</b>
        <small>${t.transcricao ? esc(t.transcricao.slice(0, 90)) + (t.transcricao.length > 90 ? "..." : "") : "Ainda sem transcrição"}</small>
        <small class="data">${t.criado_em ? dataBR(isoLocal(new Date(t.criado_em))) : ""}</small>
      </button>`).join("");
}

async function adicionarTranscricao(e) {
  e.preventDefault();
  const link = $("#novo-link").value.trim();
  if (!/^https?:\/\//i.test(link)) { avisar("Cole um link completo, começando com https://", true); $("#novo-link").focus(); return; }
  if (!temCampo("transcricoes", "link")) { avisar("A tabela transcricoes ainda não existe. Rode a parte 11 do banco.sql.", true); return; }
  const info = videoDoLink(link);
  const dados = {
    link, plataforma: info.plataforma, categoria: $("#novo-cat").value,
    titulo: `Vídeo do ${NOME_PLATAFORMA[info.plataforma] || "link"} de ${dataBR(hojeISO()).slice(0, 5)}`
  };
  const limpo = {};
  Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
  const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
  if (error) { avisar(traduzErro(error), true); return; }
  trans.sel = String(data.id); trans.tokscriptAberto = true;
  if (trans.categoria !== "todas" && trans.categoria !== dados.categoria) trans.categoria = dados.categoria;
  avisar("Vídeo salvo. Agora gere a transcrição no quadro do TokScript.");
  await recarregar("transcricoes");
}

function pintarDetalheTrans() {
  const caixa = $("#detalhe-trans");
  const t = S.transcricoes.find((x) => String(x.id) === String(trans.sel));
  if (!t) { caixa.innerHTML = `<div class="cartao"><p class="vazio">Escolha um vídeo na lista ou adicione um novo link para ver o vídeo, gerar o roteiro e anotar as suas observações.</p></div>`; return; }
  const info = videoDoLink(t.link);
  const traduzido = t.transcricao_original && t.idioma_original && t.idioma_original !== "pt";

  caixa.innerHTML = `
    <div class="cartao">
      <div class="trans-cabeca">
        <input class="campo titulo-trans" id="t-titulo" value="${esc(t.titulo || "")}" placeholder="Dê um nome para este vídeo" aria-label="Título">
        <select class="campo" id="t-cat" aria-label="Divisão">${CATEGORIAS.map(([v, n]) => `<option value="${v}" ${v === t.categoria ? "selected" : ""}>${n}</option>`).join("")}</select>
      </div>
      <p class="sub" style="margin:6px 0 0"><a href="${esc(t.link)}" target="_blank" rel="noopener">Abrir o vídeo original no ${esc(NOME_PLATAFORMA[info.plataforma] || "site")}</a></p>
    </div>
    <div class="trans-trabalho">
      <div class="cartao trans-video">
        <h2>Conteúdo</h2>
        ${info.src
          ? `<div class="moldura ${info.vertical ? "vertical" : ""}"><iframe src="${esc(info.src)}" title="Vídeo de referência" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" allowfullscreen></iframe></div>`
          : `<p class="vazio">Esse link não dá para mostrar aqui dentro. Use o link "Abrir o vídeo original" acima.${info.plataforma === "tiktok" ? " No TikTok, use o link completo do vídeo (com /video/ no endereço), não o link curto." : ""}</p>`}
      </div>
      <div class="cartao trans-textos">
        <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Roteiro (transcrição)</h2><span class="espaco"></span><span class="sub" id="t-status"></span></div>
        <textarea class="campo" id="t-transcricao" rows="12" placeholder="Cole aqui o texto do TokScript. Se vier em outro idioma, eu traduzo para português sozinho.">${esc(t.transcricao || "")}</textarea>
        <div class="barra" style="margin:6px 0 0">
          <button class="btn" type="button" id="t-traduzir">${ic("traduzir")}Traduzir para português</button>
          ${traduzido ? `<button class="btn" type="button" id="t-original">Ver o original (${esc(NOME_IDIOMA[t.idioma_original] || t.idioma_original)})</button>` : ""}
        </div>
        <div id="t-original-caixa" hidden><p class="sub" style="margin:10px 0 4px">Texto original, como veio do TokScript:</p><div class="original">${esc(t.transcricao_original || "")}</div></div>
        <h2 style="margin-top:16px">Minhas observações</h2>
        <textarea class="campo" id="t-obs" rows="6" placeholder="O que chamou sua atenção? Gancho, ritmo, enquadramento, o que você quer copiar ou adaptar...">${esc(t.observacoes || "")}</textarea>
        <div class="barra" style="margin:10px 0 0">
          <button class="btn perigo" type="button" id="t-apagar">${ic("apagar")}Apagar</button>
          <span class="espaco"></span>
          <span class="sub" id="t-salvo"></span>
          <button class="btn primario" type="button" id="t-salvar">Salvar</button>
        </div>
      </div>
    </div>
    <details class="secao tokscript" id="t-tokscript" ${trans.tokscriptAberto ? "open" : ""}>
      <summary><span class="emo" aria-hidden="true">${ic("transcricao")}</span><span class="nome">Gerar a transcrição aqui (TokScript)</span><span class="conta">grátis, até 5 por dia</span></summary>
      <div class="corpo">
        <ol class="passos">
          <li>A transcrição começa sozinha no quadro abaixo. Espere uns segundos e role o quadro até aparecer o texto. Se não começar, clique em <b>Scan Video</b>.</li>
          <li>Selecione o texto, copie (<b>Cmd + C</b>) e cole (<b>Cmd + V</b>) no campo <b>Roteiro</b> aqui em cima.</li>
          <li>Se vier em inglês, espanhol ou outro idioma, eu traduzo para português sozinho. Depois clique em <b>Salvar</b>.</li>
        </ol>
        <div class="moldura-tokscript" id="t-tokscript-moldura"></div>
      </div>
    </details>`;

  const ta = $("#t-transcricao"), status = (txt) => { $("#t-status").textContent = txt; };
  let originalPendente = null;

  // Abre o TokScript só quando a pessoa pede, para não pesar
  const carregarTokscript = () => {
    const m = $("#t-tokscript-moldura");
    if (!m.firstChild) m.innerHTML = `<iframe src="https://tokscript.com/${esc(t.link)}" title="TokScript" allow="clipboard-read; clipboard-write"></iframe>`;
  };
  if (trans.tokscriptAberto) carregarTokscript();
  $("#t-tokscript").addEventListener("toggle", (e) => { trans.tokscriptAberto = e.target.open; if (e.target.open) carregarTokscript(); });

  async function garantirPortugues(manual) {
    const texto = ta.value.trim();
    if (!texto) { if (manual) avisar("Cole o texto primeiro.", true); return; }
    status("Conferindo o idioma...");
    const idioma = (await detectarIdioma(texto) || "").slice(0, 2);
    if (idioma === "pt") { status(manual ? "Esse texto já está em português." : ""); return; }
    status(`Traduzindo do ${NOME_IDIOMA[idioma] || idioma} para português...`);
    try {
      const pt = await traduzirParaPortugues(texto, idioma, status);
      if (pt) {
        originalPendente = { texto, idioma };
        ta.value = pt.trim();
        status(`Traduzido do ${NOME_IDIOMA[idioma] || idioma}. Confira e clique em Salvar.`);
        return;
      }
    } catch (_) {}
    status("");
    const d = abrirJanelaSimples("Traduzir para português",
      `<p>O tradutor que vem no Chrome não está disponível neste navegador. Dá para traduzir pelo Google Tradutor:</p>
       <ol class="passos"><li>Clique em <b>Abrir o Google Tradutor</b>.</li><li>Copie o texto em português que aparecer.</li><li>Volte aqui, apague o texto do campo Roteiro e cole o traduzido.</li></ol>`,
      `<a class="btn primario" href="${linkGoogleTradutor(texto)}" target="_blank" rel="noopener">Abrir o Google Tradutor</a>`);
    $("a", d).addEventListener("click", () => d.close());
  }

  ta.addEventListener("paste", () => setTimeout(() => garantirPortugues(false), 50));
  $("#t-traduzir").onclick = () => garantirPortugues(true);
  if ($("#t-original")) $("#t-original").onclick = () => { const c = $("#t-original-caixa"); c.hidden = !c.hidden; };

  const salvar = async () => {
    const dados = { titulo: $("#t-titulo").value.trim() || null, categoria: $("#t-cat").value, transcricao: ta.value.trim() || null, observacoes: $("#t-obs").value.trim() || null };
    if (originalPendente) { dados.transcricao_original = originalPendente.texto; dados.idioma_original = originalPendente.idioma; }
    const btn = $("#t-salvar"); btn.disabled = true; btn.textContent = "Salvando...";
    const ok = await gravar("transcricoes", dados, t.id);
    btn.disabled = false; btn.textContent = "Salvar";
    if (ok) {
      originalPendente = null;
      Object.assign(t, dados);
      $("#t-salvo").textContent = "Salvo " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      pintarListaTrans();
    }
  };
  $("#t-salvar").onclick = salvar;
  $("#t-cat").addEventListener("change", salvar);
  $("#t-apagar").onclick = async () => {
    if (!(await confirmar(`Apagar "${t.titulo || "este vídeo"}" da sua biblioteca?`))) return;
    if (await apagarLinha("transcricoes", t.id)) { trans.sel = null; avisar("Apagado."); recarregar("transcricoes"); }
  };
}
