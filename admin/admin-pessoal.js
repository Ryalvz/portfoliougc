/* =============================================================
   ADMIN, PARTE 3: FINANCEIRO PESSOAL (PF)
   A chave "Pessoal" no topo do Financeiro. Junta cartões, compras
   parceladas (suas e de quem pegou o cartão emprestado), contas
   fixas e o que entra na conta, e calcula:
     - os próximos 12 meses: quanto já está comprometido e quanto sobra
     - quando cada parcela acaba e quanto libera
     - quem te deve e quanto
     - um plano de ação com os seus números
   A fatura (PDF ou CSV) é lida aqui no navegador: o arquivo não
   sobe para lugar nenhum, só as compras que você confirmar vão
   para o banco. Usa as funções do admin.js (carregado antes).
   ============================================================= */
Object.assign(ESQUEMA, {
  pf_cartoes: ["id", "nome", "vence_dia", "fecha_dia", "limite", "ordem"],
  pf_contas: ["id", "nome", "valor", "dia", "categoria", "inicio", "fim", "obs", "no_cartao"],
  pf_compras: ["id", "criado_em", "cartao_id", "descricao", "valor_parcela", "parcelas", "primeiro_mes", "data_compra", "dono", "categoria", "origem", "chave"],
  pf_recebimentos: ["id", "pessoa", "valor", "juros", "data", "obs"],
  pf_entradas: ["id", "data", "valor", "descricao", "origem"],
  pf_config: ["chave", "valor"]
});
const P = { ok: false, carregando: null, cartoes: [], contas: [], compras: [], receb: [], entradas: [], config: {} };
const pfx = { sub: "visao", cartao: "", dono: "", tipo: "parceladas", mesFat: "", mesGasto: "", gDono: "", gCartao: "" };
try { pfx.sub = localStorage.getItem("pf-sub") || "visao"; } catch (_) {}
const SUBS_PF = [["visao", "Visão geral"], ["gastos", "Gastos do mês"], ["compras", "Parcelas"], ["devem", "Quem me deve"], ["contas", "Contas fixas"], ["entradas", "Entradas"]];

/* ---------- Meses como "2026-10" ---------- */
const mesDe = (iso) => String(iso || "").slice(0, 7);
const mesHojePF = () => mesDe(hojeISO());
function somaMes(k, n) { const [a, m] = k.split("-").map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function difMes(de, ate) { const [a1, m1] = de.split("-").map(Number); const [a2, m2] = ate.split("-").map(Number); return (a2 - a1) * 12 + (m2 - m1); }
const nomeMes = (k, curto) => { const [a, m] = k.split("-").map(Number); return curto ? `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}` : `${MESES_LONGOS[m - 1]} de ${a}`; };
const r2 = (v) => Math.round(v * 100) / 100;

/* ---------- Carregar ---------- */
async function carregarPF(forcar) {
  if (P.ok && !forcar) return;
  if (P.carregando && !forcar) return P.carregando;
  P.carregando = (async () => {
    const [cartoes, contas, compras, receb, entradas, config] = await Promise.all([
      ler("pf_cartoes", (q, c) => (c.includes("ordem") ? q.order("ordem").order("id") : q)),
      ler("pf_contas", (q, c) => (c.includes("id") ? q.order("id") : q)),
      ler("pf_compras", (q, c) => (c.includes("id") ? q.order("id").limit(10000) : q)),
      ler("pf_recebimentos", (q, c) => (c.includes("data") ? q.order("data", { ascending: false }) : q)),
      ler("pf_entradas", (q, c) => (c.includes("data") ? q.order("data", { ascending: false }) : q)),
      ler("pf_config")
    ]);
    Object.assign(P, { cartoes, contas, compras, receb, entradas, ok: true });
    P.config = {};
    config.forEach((c) => { P.config[c.chave] = c.valor; });
  })();
  await P.carregando;
  P.carregando = null;
}
async function recarregarPF() { await carregarPF(true); desenhar(); }
const cfg = (k, padrao = 0) => (P.config[k] == null || P.config[k] === "" ? padrao : P.config[k]);

/* ---------- Contas ---------- */
const contaAtiva = (c, k) => (!c.inicio || mesDe(c.inicio) <= k) && (!c.fim || mesDe(c.fim) >= k);
// Conta paga no cartão já entra na fatura (no dia a dia): não soma de novo
const fixasNo = (k) => P.contas.filter((c) => contaAtiva(c, k) && !c.no_cartao).reduce((s, c) => s + n2(c.valor), 0);
const RECORRENTE = 60; // compra "parcelada" em 60x ou mais = valor mensal sem fim (ex.: a parte de alguém numa conta)
// Índice da parcela (0 = primeira) que cai no mês k, ou -1
const idxParcela = (c, k) => { const i = difMes(mesDe(c.primeiro_mes), k); return i >= 0 && i < Number(c.parcelas || 1) ? i : -1; };
const ultimoMes = (c) => somaMes(mesDe(c.primeiro_mes), Number(c.parcelas || 1) - 1);
const parcelado = (c) => Number(c.parcelas) > 1;
const nomePessoa = (s) => String(s || "").trim().replace(/\s+/g, " ");
const chavePessoa = (s) => semAcento(nomePessoa(s));
/* Compra dividida: em "De quem é" vale "Eu, Diego" ou "Diego e Emillie".
   Cada nome paga uma parte igual. Vazio = a compra é toda sua. */
const EU_NOMES = new Set(["eu", "meu", "minha", "ryan"]);
function partesDe(c) {
  const t = nomePessoa(c.dono);
  if (!t) return [{ nome: "", eu: true, frac: 1 }];
  const vistos = new Map();
  t.split(/\s*(?:,|;|\+|\/|\s+e\s+)\s*/i).map(nomePessoa).filter(Boolean).forEach((n) => {
    const eu = EU_NOMES.has(semAcento(n)), k = eu ? "eu" : chavePessoa(n);
    if (!vistos.has(k)) vistos.set(k, { nome: eu ? "" : n, eu });
  });
  const l = [...vistos.values()];
  return l.length ? l.map((x) => ({ ...x, frac: 1 / l.length })) : [{ nome: "", eu: true, frac: 1 }];
}
const fracMinha = (c) => partesDe(c).reduce((s, x) => s + (x.eu ? x.frac : 0), 0);
const ehMinha = (c) => fracMinha(c) === 1;   // toda sua
const temMinha = (c) => fracMinha(c) > 0;    // toda ou uma parte
const outrosDe = (c) => partesDe(c).filter((x) => !x.eu);
const dividida = (c) => partesDe(c).length > 1;
const rotuloDono = (c) => { const l = partesDe(c); return l.length === 1 ? (l[0].eu ? "Eu" : l[0].nome) : "Dividida: " + l.map((x) => (x.eu ? "eu" : x.nome)).join(" + "); };
// Monta o "De quem é" a partir do tipo escolhido no formulário
const donoDoTipo = (tipo, nomes) => {
  const n = nomePessoa(nomes);
  if (tipo === "minha" || !n) return null;
  return tipo === "dividida" ? `Eu, ${n}` : n;
};
// E o contrário: tipo e nomes de uma compra já salva
const tipoDaCompra = (c) => {
  if (ehMinha(c)) return { tipo: "minha", nomes: "" };
  const outros = outrosDe(c).map((x) => x.nome).join(", ");
  return { tipo: temMinha(c) ? "dividida" : "outra", nomes: outros };
};

function cartaoNo(k, filtro = () => true) {
  const r = { parcEu: 0, avEu: 0, outros: 0 };
  P.compras.forEach((c) => {
    if (!filtro(c) || idxParcela(c, k) < 0) return;
    const v = n2(c.valor_parcela), f = fracMinha(c);
    r.outros += v * (1 - f);
    if (parcelado(c)) r.parcEu += v * f; else r.avEu += v * f;
  });
  return r;
}
// Meses com fatura importada ou compra à vista lançada
const mesesComAvulsos = () => [...new Set(P.compras.filter((c) => !parcelado(c)).map((c) => mesDe(c.primeiro_mes)))].sort();
// Gasto do dia a dia (compras à vista suas): o que você definiu nos ajustes, senão a média das 3 últimas faturas
function diaADiaEstimado() {
  const fixo = n2(cfg("dia_a_dia"));
  if (fixo > 0) return { v: fixo, fonte: "o valor que você definiu nos ajustes" };
  const hoje = mesHojePF();
  const meses = mesesComAvulsos().filter((k) => k <= hoje).slice(-3);
  if (!meses.length) return { v: 0, fonte: "" };
  const v = meses.reduce((s, k) => s + cartaoNo(k).avEu, 0) / meses.length;
  return { v, fonte: `média das compras à vista ${meses.length === 1 ? "da última fatura" : `das últimas ${meses.length} faturas`}` };
}
function diaADiaNo(k, est) {
  const hoje = mesHojePF();
  const real_ = cartaoNo(k).avEu;
  if (k < hoje) return real_;
  if (k === hoje) return Math.max(real_, est);
  return est;
}
const entradasNo = (k) => P.entradas.filter((e) => mesDe(e.data) === k).reduce((s, e) => s + n2(e.valor), 0);
const pjNo = (k) => { const [a, m] = k.split("-").map(Number); return entrouEm(a, m); };
// Renda usada na projeção
function rendaPrevista() {
  const sal = n2(cfg("salario"));
  if (sal > 0) return { v: sal, fonte: "o salário fixo que você definiu" };
  // Sua renda é o que entra pelo trabalho (Financeiro da empresa: contratos + TikTok Shop), média dos 3 últimos meses completos
  const hoje = mesHojePF();
  const pj = [1, 2, 3].map((i) => pjNo(somaMes(hoje, -i)));
  if (pj.some(Boolean)) return { v: pj.reduce((s, v) => s + v, 0) / 3, fonte: "média do que entrou pelo seu trabalho nos 3 últimos meses (Financeiro da empresa)" };
  const meses = [...new Set(P.entradas.map((e) => mesDe(e.data)))].filter((k) => k < hoje).sort().slice(-3);
  if (meses.length) return { v: meses.reduce((s, k) => s + entradasNo(k), 0) / meses.length, fonte: `média das entradas ${meses.length === 1 ? "do último mês" : `dos últimos ${meses.length} meses`}` };
  return { v: 0, fonte: "" };
}

function projecao(meses = 12, extra = null) {
  const hoje = mesHojePF();
  const renda = rendaPrevista(), dia = diaADiaEstimado();
  return Array.from({ length: meses }, (_, i) => {
    const k = somaMes(hoje, i);
    const c = cartaoNo(k);
    const fixas = fixasNo(k), dd = diaADiaNo(k, dia.v);
    let parc = c.parcEu;
    if (extra && k >= extra.inicio && difMes(extra.inicio, k) < extra.n) parc += extra.v;
    const gasto = fixas + parc + dd;
    return { k, renda: renda.v, fixas, parc, dd, outros: c.outros, gasto, sobra: renda.v - gasto };
  });
}

/* ---------- Quem me deve ---------- */
// A cobrança começa no mês em que você passou a anotar (parcelas antigas já foram acertadas por fora)
function inicioCobranca() {
  const fixo = cfg("inicio_cobranca", "");
  if (fixo) return mesDe(fixo);
  const meses = P.compras.filter((c) => !ehMinha(c) && c.criado_em).map((c) => mesDe(c.criado_em)).sort();
  return meses[0] || mesHojePF();
}
function devedores() {
  const hoje = mesHojePF(), inicio = inicioCobranca(), ate = somaMes(hoje, 12);
  const mapa = new Map();
  const pega = (nome) => {
    const k = chavePessoa(nome);
    if (!mapa.has(k)) mapa.set(k, { nome: nomePessoa(nome), devido: 0, futuro: 0, pago: 0, jurosRecebidos: 0, compras: [], receb: [] });
    return mapa.get(k);
  };
  // Na compra dividida, cada pessoa entra só com a parte dela
  const dia = hojeISO();
  P.compras.forEach((c) => outrosDe(c).forEach((pt) => {
    const p = pega(pt.nome);
    const parte = pt.frac < 1 ? { ...c, valor_parcela: r2(n2(c.valor_parcela) * pt.frac), parteDe: n2(c.valor_parcela) } : c;
    p.compras.push(parte);
    const cartao = P.cartoes.find((x) => String(x.id) === String(c.cartao_id));
    for (let i = 0; i < Number(c.parcelas || 1); i++) {
      const k = somaMes(mesDe(c.primeiro_mes), i);
      if (k < inicio) continue;
      // Já venceu = a fatura daquele mês já passou do dia de vencimento do cartão
      if (vencimentoNoMes(cartao, k) <= dia) p.devido += n2(parte.valor_parcela); else if (k <= ate) p.futuro += n2(parte.valor_parcela);
    }
  }));
  // O juros que a pessoa pagou por atraso não abate as compras: é à parte
  P.receb.forEach((r) => { const p = pega(r.pessoa); const j = Math.min(n2(r.juros), n2(r.valor)); p.pago += n2(r.valor) - j; p.jurosRecebidos += j; p.receb.push(r); });
  return [...mapa.values()].map((p) => ({ ...p, falta: r2(p.devido - p.pago) })).sort((a, b) => b.falta - a.falta || b.futuro - a.futuro);
}
/* ---------- Quem me deve, fatura por fatura ----------
   Cada mês de fatura tem o seu valor por pessoa. Os pagamentos cobrem
   as faturas mais antigas primeiro; o que sobra (adiantado) já abate
   a próxima. Assim dá pra ver: "na fatura de novembro, a Emillie me
   deve tanto, até o dia tal". */
function contaPorMes(p, ate) {
  const inicio = inicioCobranca();
  const meses = [];
  for (let k = inicio; k <= ate; k = somaMes(k, 1)) {
    const itens = p.compras.map((c) => ({ c, i: idxParcela(c, k) })).filter((x) => x.i >= 0);
    const valor = r2(itens.reduce((s, x) => s + n2(x.c.valor_parcela), 0));
    // Vence no dia do vencimento do cartão daquela fatura (se tiver mais de um cartão, o primeiro a vencer)
    const vence = itens.map((x) => vencimentoNoMes(P.cartoes.find((cc) => String(cc.id) === String(x.c.cartao_id)), k)).sort()[0] || vencimentoNoMes(null, k);
    meses.push({ k, itens, valor, vence, coberto: 0 });
  }
  let sobra = p.pago;
  meses.forEach((m) => { const x = Math.max(0, Math.min(m.valor, sobra)); m.coberto = r2(x); sobra = r2(sobra - x); m.falta = r2(m.valor - m.coberto); });
  return meses;
}
function msgFatura(p, m) {
  const nomeM = MESES_LONGOS[Number(m.k.slice(5)) - 1].toLowerCase();
  const linhas = m.itens.map(({ c, i }) => `${c.descricao}${Number(c.parcelas) > 1 && Number(c.parcelas) < RECORRENTE ? ` (${i + 1}/${c.parcelas})` : ""} ${real(c.valor_parcela)}${c.parteDe ? ` (sua parte de ${real(c.parteDe)})` : ""}`);
  return `Oi, ${p.nome.split(" ")[0]}! Passando a sua parte da fatura de ${nomeM}: ${linhas.join("; ")}. Total: ${real(m.valor)}.${m.coberto > 0 ? ` Você já tinha adiantado ${real(m.coberto)}, então fica ${real(m.falta)}.` : ""} Consegue me mandar até ${dataBR(m.vence).slice(0, 5)}?`;
}

/* ---------- Juros por atraso de quem te deve ----------
   Cada parcela da pessoa vence no dia do vencimento da fatura do cartão
   em que ela caiu. Se o pagamento chega depois, corre juros simples por dia
   sobre o que está vencido e em aberto, na taxa do cartão (ao mês / 30).
   Os pagamentos abatem primeiro o valor das compras; os juros ficam para
   o fim, pagos com o que sobrar (como você combina com a pessoa). */
const TAXAS_CARTAO_PADRAO = { nubank: 10.99, bradesco: 14.99, inter: 10.99 };
const taxaDoCartao = (c) => {
  if (!c) return 0;
  const salvo = (P.config.juros_cartoes || {})[String(c.id)];
  if (salvo != null && salvo !== "") return n2(salvo);
  return TAXAS_CARTAO_PADRAO[semAcento(c.nome)] ?? 10.99;
};
const cobraJuros = (nome) => !!(P.config.juros_pessoas || {})[chavePessoa(nome)];
function vencimentoNoMes(cartao, k) {
  const [a, m] = k.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const dia = Math.min(ultimo, Number((cartao && cartao.vence_dia) || 10));
  return `${k}-${pad(dia)}`;
}
function jurosDe(p) {
  const hoje = hojeISO(), inicio = inicioCobranca();
  // Parcelas vencidas: { data, valor, taxa ao dia }
  const devidas = [];
  p.compras.forEach((c) => {
    const cartao = P.cartoes.find((x) => String(x.id) === String(c.cartao_id));
    for (let i = 0; i < Number(c.parcelas || 1); i++) {
      const k = somaMes(mesDe(c.primeiro_mes), i);
      if (k < inicio) continue;
      const venc = vencimentoNoMes(cartao, k);
      if (venc > hoje) continue;
      devidas.push({ data: venc, valor: n2(c.valor_parcela), dia: taxaDoCartao(cartao) / 100 / 30 });
    }
  });
  devidas.sort((a, b) => a.data.localeCompare(b.data));
  const pags = [...p.receb].map((r) => ({ data: String(r.data).slice(0, 10), valor: n2(r.valor) - n2(r.juros) })).sort((a, b) => a.data.localeCompare(b.data));
  // Anda dia a dia: abate os pagamentos nas parcelas mais antigas e soma os juros do que ficou vencido
  let juros = 0, sobra = 0, jurosPagos = 0, desde = null;
  const abertas = [];
  let iD = 0, iP = 0;
  const primeiro = devidas[0] ? devidas[0].data : null;
  if (!primeiro) return { juros: 0, jurosPagos: 0, pendente: 0, desde: null };
  for (let d = deISO(primeiro); isoLocal(d) <= hoje; d.setDate(d.getDate() + 1)) {
    const dia = isoLocal(d);
    while (iD < devidas.length && devidas[iD].data <= dia) abertas.push({ ...devidas[iD++] });
    while (iP < pags.length && pags[iP].data <= dia) {
      let v = pags[iP++].valor + sobra; sobra = 0;
      for (const a of abertas) { if (v <= 0) break; const x = Math.min(a.valor, v); a.valor -= x; v -= x; }
      if (v > 0) { const x = Math.min(juros - jurosPagos, v); jurosPagos += x; v -= x; sobra = v; }
    }
    // Juros do dia sobre o que venceu e não foi pago (a partir do dia seguinte ao vencimento)
    abertas.forEach((a) => { if (a.valor > 0.005 && a.data < dia) { juros += a.valor * a.dia; if (!desde) desde = a.data; } });
  }
  juros = r2(juros); jurosPagos = r2(jurosPagos + (p.jurosRecebidos || 0));
  return { juros, jurosPagos, pendente: r2(Math.max(0, juros - jurosPagos)), desde };
}

// "bob" e "Bob" são a mesma pessoa: fica um nome só (o que começa com maiúscula, se tiver)
const pessoasConhecidas = () => {
  const m = new Map();
  [...P.compras.flatMap((c) => outrosDe(c).map((x) => x.nome)), ...P.receb.map((r) => nomePessoa(r.pessoa))].filter(Boolean).forEach((n) => {
    const k = chavePessoa(n).toLowerCase(), atual = m.get(k);
    if (!atual || (atual[0] !== atual[0].toUpperCase() && n[0] === n[0].toUpperCase())) m.set(k, n);
  });
  return [...m.values()].sort(ordenaTexto);
};

/* ---------- Tela ---------- */
function chipsVisaoFin() {
  return `<div class="chips" role="tablist" aria-label="Qual financeiro">
    <button class="chip" type="button" data-visao-fin="pj" aria-pressed="${fin.visao !== "pf"}">Empresa</button>
    <button class="chip" type="button" data-visao-fin="pf" aria-pressed="${fin.visao === "pf"}">Pessoal</button></div>`;
}
function ligarVisaoFin(el) {
  $$("[data-visao-fin]", el).forEach((b) => b.onclick = () => {
    fin.visao = b.dataset.visaoFin;
    try { localStorage.setItem("fin-visao", fin.visao); } catch (_) {}
    desenhar();
  });
}

function desenharPessoal(el) {
  if (!P.ok) {
    el.innerHTML = `<div class="barra">${chipsVisaoFin()}</div><p class="vazio">Carregando seu financeiro pessoal...</p>`;
    ligarVisaoFin(el);
    carregarPF().then(() => { if (abaAtual === "financeiro" && fin.visao === "pf") desenhar(); });
    return;
  }
  if (!SUBS_PF.some(([k]) => k === pfx.sub)) pfx.sub = "visao";
  el.innerHTML = `
    <div class="barra">
      ${chipsVisaoFin()}
      <span class="espaco"></span>
      <button class="btn" type="button" id="pf-telegram">${ic("enviar")}Telegram</button>
      <button class="btn" type="button" id="pf-simular">${ic("grafico")}Simular compra</button>
      <button class="btn" type="button" id="pf-ajustes">${ic("editar")}Ajustes</button>
      <button class="btn primario" type="button" id="pf-importar">${ic("subir")}Importar fatura</button>
    </div>
    <div class="subabas" role="tablist">${SUBS_PF.map(([k, n]) => `<button class="subaba" type="button" role="tab" data-pf-sub="${k}" aria-selected="${pfx.sub === k}">${n}</button>`).join("")}</div>
    <div id="pf-corpo"></div>`;
  ligarVisaoFin(el);
  $$("[data-pf-sub]", el).forEach((b) => b.onclick = () => {
    pfx.sub = b.dataset.pfSub;
    try { localStorage.setItem("pf-sub", pfx.sub); } catch (_) {}
    desenhar();
  });
  $("#pf-importar", el).onclick = () => abrirImportarFatura();
  $("#pf-simular", el).onclick = () => abrirSimulador();
  $("#pf-telegram", el).onclick = () => abrirTelegram();
  $("#pf-ajustes", el).onclick = () => formAjustesPF();
  const corpo = $("#pf-corpo", el);
  ({ visao: pfVisao, gastos: pfGastos, compras: pfCompras, devem: pfDevem, contas: pfContas, entradas: pfEntradas })[pfx.sub](corpo);
  ligarDicas(el);
}

/* ---------- Visão geral ---------- */
function pfVisao(el) {
  const hoje = mesHojePF(), ref = mesAPagar();
  const proj = projecao(12);
  const atual = proj.find((m) => m.k === ref) || proj[0];
  const renda = rendaPrevista(), dia = diaADiaEstimado();
  const dev = devedores();
  const aReceber = dev.reduce((s, p) => s + Math.max(0, p.falta), 0);
  const restante = P.compras.filter(temMinha).filter(parcelado).reduce((s, c) => {
    let t = 0; for (let i = 0; i < Number(c.parcelas); i++) { if (somaMes(mesDe(c.primeiro_mes), i) >= ref) t += n2(c.valor_parcela) * fracMinha(c); } return s + t;
  }, 0);
  const fimParcelas = P.compras.filter((c) => parcelado(c) && Number(c.parcelas) < RECORRENTE).map(ultimoMes).filter((k) => k >= ref).sort().pop();
  const reserva = n2(cfg("reserva")), metaMeses = Number(cfg("reserva_meses", 3)) || 3;
  const metaReserva = metaMeses * (fixasNo(hoje) + dia.v);
  const vazio = !P.contas.length && !P.compras.length && !P.entradas.length;

  const maxV = Math.max(1, ...proj.map((m) => Math.max(m.gasto, m.renda)));
  const grafico = `<div class="barras-mes pf-barras" role="img" aria-label="Gastos comprometidos e renda nos próximos 12 meses">
    ${proj.map((m) => `<div class="grupo-mes ${m.k === hoje ? "hoje" : ""}" data-dica="<b>${nomeMes(m.k)}</b><br>Contas fixas: ${real(m.fixas)}<br>Suas parcelas: ${real(m.parc)}<br>Dia a dia${m.k > hoje ? " (estimado)" : ""}: ${real(m.dd)}<br>Renda prevista: ${real(m.renda)}<br><b>${m.sobra >= 0 ? "Sobra" : "Falta"}: ${real(Math.abs(m.sobra))}</b>${m.outros ? `<br>+ ${real(m.outros)} de outras pessoas no seu cartão` : ""}">
      <b class="valor-barra ${m.sobra < 0 ? "neg" : ""}">${privado ? "" : (m.sobra < 0 ? "−" : "+") + Math.round(Math.abs(m.sobra)).toLocaleString("pt-BR")}</b>
      <div class="par-barras"><div class="pf-pilha" style="height:${(m.gasto / maxV) * 100}%">
        ${[["pf-dd", m.dd], ["pf-parc", m.parc], ["pf-fixas", m.fixas]].filter((x) => x[1] > 0).map(([c, v]) => `<i class="${c}" style="flex:${v}"></i>`).join("")}
      </div>${m.renda ? `<em class="m-meta pf-renda" style="bottom:${(m.renda / maxV) * 100}%"></em>` : ""}</div>
      <span>${nomeMes(m.k, true)}</span>
    </div>`).join("")}
  </div>`;

  el.innerHTML = `
    ${vazio ? `<div class="cartao pf-comeco"><h2>Comece por aqui</h2><ol>
      <li>Em <b>Ajustes</b>, diga quanto você tem guardado hoje e, se quiser, um salário fixo pra você.</li>
      <li>Cadastre seus cartões e as <b>contas fixas</b>.</li>
      <li>Clique em <b>Importar fatura</b> e escolha o PDF (ou CSV) da fatura de cada cartão. Marque o nome de quem é cada compra que não é sua.</li></ol></div>` : ""}
    ${cartaoProximasFaturas()}
    <div class="faixa-kpi">
      <div class="kpi ${atual.sobra < 0 ? "alerta" : ""}"><span>${atual.sobra < 0 ? "Falta" : "Sobra"} em ${MESES_LONGOS[Number(ref.slice(5)) - 1].toLowerCase()}</span><strong>${real(Math.abs(atual.sobra))}</strong><small>renda ${real(atual.renda)} menos ${real(atual.gasto)}</small></div>
      <div class="kpi"><span>Comprometido em ${MESES_LONGOS[Number(ref.slice(5)) - 1].toLowerCase()}</span><strong>${real(atual.fixas + atual.parc)}</strong><small>${real(atual.fixas)} fixas + ${real(atual.parc)} parcelas</small></div>
      <div class="kpi"><span>Parcelas a pagar</span><strong>${real(restante)}</strong><small>${fimParcelas ? `a última acaba em ${nomeMes(fimParcelas, true)}` : "nenhuma parcela sua"}</small></div>
      <div class="kpi ${aReceber > 0 ? "alerta" : ""}"><span>Te devem</span><strong>${real(aReceber)}</strong><small>${dev.filter((p) => p.falta > 0).length ? qtd(dev.filter((p) => p.falta > 0).length, "pessoa", "pessoas") + " com valor vencido" : "ninguém atrasado"}</small></div>
      <div class="kpi"><span>Reserva</span><strong>${real(reserva)}</strong><small>meta ${real(metaReserva)} (${metaMeses} meses)</small></div>
    </div>
    <div class="grade-fin">
      <div class="cartao">
        <div class="barra" style="margin-bottom:4px"><h2 style="margin:0">Próximos 12 meses</h2><span class="espaco"></span>
          <span class="legenda" style="margin:0"><span><i class="leg-pf pf-fixas"></i>Contas fixas</span><span><i class="leg-pf pf-parc"></i>Parcelas</span><span><i class="leg-pf pf-dd"></i>Dia a dia</span><span><i class="leg-meta"></i>Renda</span></span></div>
        <p class="sub" style="margin:0 0 4px">o número em cima de cada mês é o que sobra (ou falta). Renda: ${renda.fonte ? esc(renda.fonte) : "ainda sem dado, lance suas entradas ou um salário fixo nos ajustes"}. Dia a dia: ${dia.fonte ? esc(dia.fonte) : "importe uma fatura para estimar"}.</p>
        ${grafico}
      </div>
      ${cartaoPlano(proj, dev, { reserva, metaReserva, metaMeses, dia, renda, restante, fimParcelas })}
    </div>
    <div class="grade-fin">
      ${cartaoLiberacao()}
      ${cartaoCartoes()}
    </div>`;
  ligarCartoes(el);
  ligarProximasFaturas(el);
}

/* ---------- Próximas faturas: o que já está garantido em cada cartão ---------- */
// Por cartão e mês: suas parcelas, seus gastos à vista já lançados e o que é de outras pessoas
function faturaPartes(cartaoId, k) {
  const r = { parc: 0, vista: 0, outros: 0 };
  P.compras.forEach((c) => {
    if (String(c.cartao_id) !== String(cartaoId) || idxParcela(c, k) < 0) return;
    const v = n2(c.valor_parcela), f = fracMinha(c);
    r.outros += v * (1 - f);
    if (parcelado(c)) r.parc += v * f; else r.vista += v * f;
  });
  r.eu = r.parc + r.vista; r.total = r.eu + r.outros;
  return r;
}
// Sua parte da fatura (todos os cartões): parcelas + à vista. É isso que o teto mede.
const suaFatura = (k) => P.cartoes.reduce((a, c) => { const f = faturaPartes(c.id, k); return { parc: a.parc + f.parc, vista: a.vista + f.vista, eu: a.eu + f.eu }; }, { parc: 0, vista: 0, eu: 0 });
// A fatura que você paga agora: o primeiro mês em que algum cartão ainda vai vencer
// (em 30/10 é novembro; em 10/11, com o Bradesco vencendo dia 15, continua novembro)
function mesAPagar() {
  const hoje = mesHojePF(), d = hojeISO();
  for (let i = 0; i < 3; i++) { const k = somaMes(hoje, i); if (P.cartoes.some((c) => vencimentoNoMes(c, k) >= d)) return k; }
  return somaMes(hoje, 1);
}
// Dia em que a fatura do mês k fecha (o fechamento vem antes do vencimento; se o dia é maior, foi no mês anterior)
function fechamentoNoMes(c, k) {
  const vence = Number(c.vence_dia) || 10, fecha = Number(c.fecha_dia) || Math.max(1, vence - 7);
  return vencimentoNoMes({ vence_dia: fecha }, fecha < vence ? k : somaMes(k, -1));
}
// Situação da fatura do cartão no mês k: importada, fechada sem importar, ou ainda aberta
function situacaoFatura(c, k) {
  const importada = P.compras.some((x) => String(x.cartao_id) === String(c.id) && x.origem === "fatura" && !parcelado(x) && mesDe(x.primeiro_mes) === k);
  const fecha = fechamentoNoMes(c, k), vence = vencimentoNoMes(c, k), hoje = hojeISO();
  if (importada) return { tipo: "importada", fecha, vence, texto: "fatura importada" };
  if (fecha <= hoje) return { tipo: "falta", fecha, vence, texto: `fechou ${dataBR(fecha).slice(0, 5)}, falta importar` };
  return { tipo: "aberta", fecha, vence, texto: `aberta, fecha ${dataBR(fecha).slice(0, 5)}` };
}
// A fatura que está aberta agora (a próxima a fechar)
const faturaAberta = () => (P.cartoes[0] ? mesFaturaDaCompra(P.cartoes[0], hojeISO()) : somaMes(mesHojePF(), 1));
function barraTeto(k, teto) {
  const f = suaFatura(k), p = teto ? Math.min(100, (f.eu / teto) * 100) : 0, pp = teto ? Math.min(100, (f.parc / teto) * 100) : 0;
  const passou = f.eu > teto;
  return `<div class="pf-teto-fat ${passou ? "estourou" : f.eu > teto * 0.8 ? "perto" : ""}">
    <div class="pf-teto-fat-txt"><b>Teto da fatura de ${MESES_LONGOS[Number(k.slice(5)) - 1].toLowerCase()}</b>
      <span>${real(f.eu)} de ${real(teto)} · ${passou ? `<strong>passou ${real(f.eu - teto)}</strong>` : `<strong>ainda dá ${real(teto - f.eu)}</strong> no cartão`}</span></div>
    <div class="pf-teto-fat-trilho"><i class="pf-parc" style="width:${pp}%"></i><i class="pf-vista" style="width:${Math.max(0, p - pp)}%"></i></div>
    <small>${real(f.parc)} já são parcelas (não dá pra mudar)${f.vista ? ` + ${real(f.vista)} de compras à vista` : ""}. O teto é a sua parte, somando os ${P.cartoes.length} cartões.</small>
  </div>`;
}
function cartaoProximasFaturas() {
  if (!P.cartoes.length) return "";
  const hoje = mesHojePF(), ref = mesAPagar();
  const validos = Array.from({ length: 12 }, (_, i) => somaMes(hoje, i));
  if (!validos.includes(pfx.mesFat)) pfx.mesFat = ref;
  const meses = validos.filter((m) => m >= ref).slice(0, 6);
  if (!meses.includes(pfx.mesFat)) meses.unshift(pfx.mesFat);
  const k = pfx.mesFat;
  const nomeK = MESES_LONGOS[Number(k.slice(5)) - 1].toLowerCase();
  const linhas = P.cartoes.map((c) => ({ c, sit: situacaoFatura(c, k), ...faturaPartes(c.id, k) }));
  const soma = linhas.reduce((a, l) => ({ parc: a.parc + l.parc, vista: a.vista + l.vista, outros: a.outros + l.outros, eu: a.eu + l.eu, total: a.total + l.total }), { parc: 0, vista: 0, outros: 0, eu: 0, total: 0 });
  const abertas = linhas.filter((l) => l.sit.tipo !== "importada");
  // Escada: suas parcelas mês a mês (de todos os cartões)
  const escada = Array.from({ length: 12 }, (_, i) => { const m = somaMes(ref, i); return { m, v: P.cartoes.reduce((s, c) => s + faturaPartes(c.id, m).parc, 0) }; });
  const tetoE = n2(cfg("teto_mes"));
  const maxE = Math.max(1, tetoE, ...escada.map((e) => e.v));
  return `<div class="cartao pf-faturas">
    <div class="barra" style="margin-bottom:4px"><h2 style="margin:0">Faturas de ${nomeK}${k === ref ? ` <span class="sub">(as que você paga agora)</span>` : ""}</h2><span class="espaco"></span>
      <div class="chips" role="tablist" aria-label="Mês da fatura">${meses.map((m) => `<button class="chip" type="button" data-mes-fat="${m}" aria-pressed="${m === k}">${nomeMes(m, true)}</button>`).join("")}</div></div>
    <div class="pf-fat-topo">
      <div class="pf-fat-total"><span>Total das faturas${abertas.length ? " até agora" : ""}</span><strong>${real(soma.total)}</strong><small>o que você paga aos bancos, somando os ${P.cartoes.length} cartões</small></div>
      <div><span>Volta pra você</span><strong>${real(soma.outros)}</strong><small>a parte das outras pessoas (veja em Quem me deve)</small></div>
      <div><span>Sai do seu bolso</span><strong>${real(soma.eu)}</strong><small>${real(soma.parc)} de parcelas + ${real(soma.vista)} à vista</small></div>
    </div>
    <div class="tabela-caixa"><table class="pf-fat-tabela"><thead><tr><th>Cartão</th><th>Vence</th><th>Situação</th><th>Total da fatura</th><th>Sua parte</th><th>Dos outros</th></tr></thead><tbody>
      ${linhas.map((l) => `<tr>
        <td><b>${esc(l.c.nome)}</b></td>
        <td>${dataBR(l.sit.vence).slice(0, 5)}</td>
        <td><span class="pilula ${l.sit.tipo === "importada" ? "p-pago" : l.sit.tipo === "falta" ? "p-vencido" : "p-pendente"}">${esc(l.sit.texto)}</span></td>
        <td><b>${real(l.total)}</b>${l.sit.tipo !== "importada" && l.total ? `<small>até agora</small>` : ""}</td>
        <td>${real(l.eu)}</td>
        <td>${l.outros ? real(l.outros) : "-"}</td></tr>`).join("")}
    </tbody></table></div>
    ${abertas.length ? `<p class="pf-fat-nota">${abertas.map((l) => `<b>${esc(l.c.nome)}</b>: ${l.sit.tipo === "falta" ? `a fatura já fechou (${dataBR(l.sit.fecha).slice(0, 5)}). Importe o PDF pra ter o valor exato.` : `a fatura ainda está aberta até ${dataBR(l.sit.fecha).slice(0, 5)}. Por enquanto entram só as parcelas que já se sabe e os gastos que você lançou; o valor vai subir até fechar.`}`).join("<br>")}</p>` : ""}
    ${tetoE ? barraTeto(k, tetoE) : ""}
    <details class="pf-escada-caixa"><summary>Suas parcelas mês a mês</summary>
      <p class="sub" style="margin:6px 0 0">Quanto das próximas faturas já está comprometido com parcelas (só a sua parte)${tetoE ? `. A linha é o seu teto de ${real(tetoE)}` : ""}.</p>
      <div class="pf-escada">${escada.map((e) => `<button type="button" class="pf-degrau ${e.m === k ? "foco" : ""}" data-mes-fat="${e.m}" data-dica="<b>${nomeMes(e.m)}</b><br>Suas parcelas: ${real(e.v)}${tetoE ? `<br>Sobra pra gastar no cartão: ${real(Math.max(0, tetoE - e.v))}` : ""}">
        <b class="valor-barra">${privado ? "" : Math.round(e.v).toLocaleString("pt-BR")}</b><span class="pf-degrau-area"><i style="height:${(e.v / maxE) * 100}%"></i>${tetoE ? `<em style="bottom:${(tetoE / maxE) * 100}%"></em>` : ""}</span><span>${nomeMes(e.m, true)}</span></button>`).join("")}</div>
    </details>
  </div>`;
}
function ligarProximasFaturas(el) {
  $$("[data-mes-fat]", el).forEach((b) => b.onclick = () => {
    pfx.mesFat = b.dataset.mesFat;
    const caixa = $(".pf-faturas", el);
    caixa.outerHTML = cartaoProximasFaturas();
    ligarProximasFaturas(el);
  });
}

function cartaoLiberacao() {
  const hoje = mesHojePF();
  const porMes = new Map();
  P.compras.filter((c) => parcelado(c) && Number(c.parcelas) < RECORRENTE).forEach((c) => {
    const fim = ultimoMes(c);
    if (fim < hoje) return;
    if (!porMes.has(fim)) porMes.set(fim, { v: 0, eu: 0, itens: [] });
    const g = porMes.get(fim); g.v += n2(c.valor_parcela); g.eu += n2(c.valor_parcela) * fracMinha(c); g.itens.push(c);
  });
  const lista = [...porMes].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, 10);
  let acumulado = 0;
  return `<div class="cartao"><h2>Quando as parcelas acabam</h2>
    <p class="sub" style="margin:-6px 0 8px">a última parcela cai no mês indicado. No mês seguinte esse valor sai da fatura.</p>
    ${lista.length ? `<ul class="pf-libera">${lista.map(([k, g]) => { acumulado += g.v; return `<li>
      <b>${nomeMes(k, true)}</b>
      <span>${g.itens.map((c) => esc(c.descricao) + (ehMinha(c) ? "" : ` <em>(${esc(rotuloDono(c))})</em>`)).join(", ")}</span>
      <strong>−${real(g.v)}</strong><small>a partir de ${nomeMes(somaMes(k, 1), true)}, ${real(acumulado)}/mês a menos</small></li>`; }).join("")}</ul>`
      : `<p class="vazio">Nenhuma compra parcelada cadastrada. Importe a fatura ou lance uma compra em Parcelas.</p>`}
  </div>`;
}

function faturaCartaoNo(cartao, k) { const c = cartaoNo(k, (x) => String(x.cartao_id) === String(cartao.id)); return c.parcEu + c.avEu + c.outros; }
function presoNoLimite(cartao) {
  const hoje = mesHojePF();
  return P.compras.filter((c) => String(c.cartao_id) === String(cartao.id) && parcelado(c)).reduce((s, c) => {
    let t = 0; for (let i = 0; i < Number(c.parcelas); i++) { if (somaMes(mesDe(c.primeiro_mes), i) > hoje) t += n2(c.valor_parcela); } return s + t;
  }, 0);
}
function cartaoCartoes() {
  const hoje = mesHojePF();
  return `<div class="cartao"><div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Cartões</h2><span class="espaco"></span><button class="btn" type="button" data-novo-cartao>${ic("mais")}Cartão</button></div>
    ${P.cartoes.length ? `<div class="pf-cartoes">${P.cartoes.map((c) => {
      const ref = mesAPagar(), agora = faturaCartaoNo(c, ref), prox = faturaCartaoNo(c, somaMes(ref, 1)), preso = presoNoLimite(c);
      return `<button type="button" class="pf-cartao" data-cartao="${c.id}">
        <b>${esc(c.nome)}</b><small>${c.vence_dia ? `vence dia ${c.vence_dia}` : "sem dia de vencimento"}</small>
        <span>Fatura de ${MESES_LONGOS[Number(ref.slice(5)) - 1].toLowerCase()}${situacaoFatura(c, ref).tipo === "importada" ? "" : " (até agora)"}: <strong>${real(agora)}</strong></span>
        <span>Já previsto em ${MESES_LONGOS[Number(somaMes(ref, 1).slice(5)) - 1].toLowerCase()}: <strong>${real(prox)}</strong></span>
        <span>${c.limite ? `Limite preso em parcelas: ${real(preso)} de ${real(c.limite)}` : `Preso em parcelas futuras: ${real(preso)}`}</span>
        ${c.limite ? `<i class="pf-trilho"><i style="width:${Math.min(100, (preso / n2(c.limite)) * 100)}%"></i></i>` : ""}
      </button>`; }).join("")}</div>` : `<p class="vazio">Cadastre seus cartões para separar as faturas.</p>`}
  </div>`;
}
function ligarCartoes(el) {
  $$("[data-novo-cartao]", el).forEach((b) => b.onclick = () => formCartaoPF());
  $$("[data-cartao]", el).forEach((b) => b.onclick = () => formCartaoPF(P.cartoes.find((c) => String(c.id) === b.dataset.cartao)));
}

/* ---------- Plano de ação ---------- */
function cartaoPlano(proj, dev, x) {
  const hoje = mesAPagar();
  const itens = [];
  const atual = proj.find((m) => m.k === hoje) || proj[0];
  // 1. Juros e encargos nas últimas faturas
  const juros = P.compras.filter((c) => /juros|multa|encargo|rotativ|mora\b|atraso|iof\W*(?:de\W*)?(?:financ|rotativ|parcelamento)/i.test(c.descricao) && mesDe(c.primeiro_mes) >= somaMes(hoje, -3) && mesDe(c.primeiro_mes) <= hoje).reduce((s, c) => s + n2(c.valor_parcela), 0);
  if (juros > 0) itens.push({ nivel: "critico", t: "Pare de pagar juros", d: `Nas últimas faturas foram ${real(juros)} de juros, multa ou encargos. Isso vem antes de tudo: pague sempre a fatura inteira e nunca o mínimo. Se não fechar, um parcelamento da fatura costuma ter juros menores que o rotativo; compare o CET antes de aceitar.` });
  // Parcelamento feito pelo banco (Nubank "Parcelamento de Compra", parcelamento de fatura): tem juros e IOF embutidos
  const comJuros = P.compras.filter((c) => /parcelamento de (compra|fatura)|parcelado f[aá]cil|parc\.? fatura/i.test(c.descricao) && idxParcela(c, hoje) >= 0);
  if (comJuros.length) itens.push({ nivel: "alerta", t: `Parcelamentos com juros: ${real(comJuros.reduce((s, c) => s + n2(c.valor_parcela), 0))} neste mês`, d: `${comJuros.map((c) => esc(c.descricao.replace(/^parcelamento de compra\s*/i, "").replace(/"/g, ""))).join(", ")}. Quando o banco parcela uma compra ou a fatura, vem juros e IOF embutidos. Não faça novos: se precisar parcelar, prefira o parcelado sem juros da loja.` });
  // 2. O mês atual
  if (atual.renda && atual.sobra < 0) {
    const cobrar = dev.reduce((s, p) => s + Math.max(0, p.falta), 0);
    itens.push({ nivel: "critico", t: `Este mês faltam ${real(-atual.sobra)}`, d: `${cobrar > 0 ? `Comece cobrando os ${real(cobrar)} que te devem (aba Quem me deve). ` : ""}Depois corte do dia a dia, que é o único gasto que dá para mexer agora${x.dia.v ? ` (está em ${real(x.dia.v)} por mês)` : ""}.` });
  }
  // Sem fatura ainda: a projeção só tem as contas fixas
  const semFatura = !P.compras.length;
  if (semFatura) itens.push({ nivel: "alerta", t: "Importe as faturas dos cartões", d: `Por enquanto a conta só tem as contas fixas. Sem as faturas${P.cartoes.length ? ` (${P.cartoes.map((c) => esc(c.nome)).join(", ")})` : ""}, faltam as parcelas e o gasto do dia a dia, então a sobra que aparece aqui está maior do que a real.` });
  // 3. Congelar parcelas novas
  if (atual.renda && !semFatura) {
    const neg = proj.map((m) => m.sobra < 0);
    const ultNeg = neg.lastIndexOf(true);
    if (ultNeg === -1) itens.push({ nivel: "ok", t: "Os próximos 12 meses fecham no positivo", d: "Mesmo assim, segure parcelamentos novos: use o Simular compra antes de parcelar qualquer coisa." });
    else if (ultNeg < proj.length - 1) itens.push({ nivel: "alerta", t: `Nada parcelado novo até ${nomeMes(proj[ultNeg + 1].k)}`, d: `É o primeiro mês em que a conta fecha e continua fechando. Cada parcela nova empurra essa data pra frente.` });
    else {
      const ultimo = proj[proj.length - 1];
      itens.push({ nivel: "critico", t: "Mesmo com as parcelas acabando, a conta não fecha", d: `Em ${nomeMes(ultimo.k)} ainda faltam ${real(-ultimo.sobra)}. Ou a renda sobe esse valor, ou as contas fixas e o dia a dia descem. Nenhuma parcela nova até isso mudar.` });
    }
  } else if (!atual.renda) itens.push({ nivel: "alerta", t: "Falta a sua renda", d: "Lance o que entrou na conta nos últimos meses (aba Entradas) ou defina um salário fixo em Ajustes. Sem isso não dá para saber quanto sobra." });
  // 4. Salário fixo (renda instável)
  const pj = Array.from({ length: 6 }, (_, i) => pjNo(somaMes(hoje, -(i + 1)))).filter((v) => v > 0).sort((a, b) => a - b);
  const custoVida = fixasNo(hoje) + x.dia.v;
  if (!n2(cfg("salario"))) {
    const pior = pj.length >= 3 ? (pj[0] + pj[1] + pj[2]) / 3 : 0;
    itens.push({ nivel: "", t: "Pague um salário fixo pra você", d: `Sua renda da internet varia muito, então o pessoal não pode depender do mês bom. Defina um valor fixo que passa da empresa pra sua conta todo mês${custoVida ? ` (seu custo de vida hoje é ${real(custoVida)} sem as parcelas, ${real(custoVida + atual.parc)} com elas)` : ""}. O que entrar acima fica guardado na empresa pra cobrir mês fraco.${pior ? ` Nos 3 piores dos últimos 6 meses entrou em média ${real(pior)} na empresa: um salário seguro fica perto disso.` : ""} Coloque o valor em Ajustes.` });
  }
  // 5. Cartão emprestado
  if (dev.length) {
    const atrasados = dev.filter((p) => p.falta > 0);
    itens.push({ nivel: atrasados.length ? "alerta" : "", t: "Cartão emprestado: cada um paga até o seu vencimento", d: `${atrasados.length ? `${atrasados.map((p) => `${esc(p.nome)} (${real(p.falta)})`).join(", ")} ${atrasados.length === 1 ? "está" : "estão"} com valor vencido. ` : ""}Combine que a parte de cada pessoa cai na sua conta antes do dia do vencimento da fatura. Enquanto a reserva estiver zerada, evite emprestar o cartão pra compras novas.` });
  }
  // 6. Contas que mudam no futuro (ex.: apê depois das chaves)
  const mudancas = [];
  for (let i = 1; i <= 72; i++) {
    const k = somaMes(hoje, i), d = fixasNo(k) - fixasNo(somaMes(k, -1));
    if (d > 50) mudancas.push({ k, d, i });
  }
  mudancas.slice(0, 2).forEach((m) => {
    const guardar = Math.ceil((m.d * 12) / m.i / 10) * 10;
    itens.push({ nivel: "", t: `Em ${nomeMes(m.k)} suas contas fixas sobem ${real(m.d)} por mês`, d: `Guardando ${real(guardar)} por mês daqui até lá, você junta o primeiro ano dessa diferença. O valor que for liberando das parcelas pode ir direto pra isso.` });
  });
  // 7. Reserva
  if (x.metaReserva > 0 && x.reserva < x.metaReserva) {
    itens.push({ nivel: "", t: `Reconstruir a reserva: faltam ${real(x.metaReserva - x.reserva)}`, d: `A meta é ${x.metaMeses} meses de contas fixas + dia a dia. Cada parcela que acaba libera dinheiro: mande esse valor pra reserva em vez de gastar${x.fimParcelas ? `. Quando a última parcela acabar (${nomeMes(x.fimParcelas, true)}), isso acelera bastante` : ""}.` });
  }
  return `<div class="cartao pf-plano"><h2>Plano de ação</h2>
    <ol>${itens.map((it) => `<li class="pf-${it.nivel || "normal"}"><b>${it.t}</b><p>${it.d}</p></li>`).join("")}</ol>
    <p class="sub">Organização e planejamento com os seus números, não é recomendação de investimento.</p></div>`;
}

/* ---------- Gastos do mês: tudo o que você comprou no mês, dia a dia ---------- */
const CATEGORIAS_GASTO = [
  ["Restaurantes e delivery", /ifd|ifood|restaurante|trattoria|cafe\b|caf[eé]|parrilla|lanche|pizza|burger|bar\b|padoca|food|sushi|churras/i],
  ["Mercado e padaria", /mercad|extra\b|extra-|oxxo|carrefour|assai|atacad|padaria|\bpao\b|hortifruti|market|distribuidora|super/i],
  ["Transporte", /\b99\b|99\*|uber|jet patin|turbi|metro|tembici|rentcars|posto|combust|estacion|onibus|taxi/i],
  ["Compras online", /tiktok|shopee|aliexpress|mercadoli|mp\*|amazon(?! prime)|shein|magalu|magazine/i],
  ["Assinaturas", /apple|totalpass|hubla|prime|netflix|spotify|youtube|google|icloud|vivo|loga|claro|tim\b/i],
  ["Saúde e farmácia", /hospital|drogasil|drogaria|farma|saude|sa[uú]de|clinica|lab/i],
  ["Lazer", /sympla|ingresso|cinema|sesc|show|teatro|bilhet/i]
];
const METAS_PADRAO = { "Mercado e padaria": 700, "Transporte": 300, "Restaurantes e delivery": 300, "Assinaturas": 300, "Compras online": 100, "Saúde e farmácia": 300, "Lazer": 100, "Outros": 300 };
const metasCat = () => ({ ...METAS_PADRAO, ...(P.config.metas_categoria || {}) });
const categoriaDe = (c) => c.categoria || (CATEGORIAS_GASTO.find(([, re]) => re.test(c.descricao)) || ["Outros"])[0];
// Mês em que a compra foi feita. Parcelada: a 1ª parcela cai no mês da compra ou no seguinte;
// se a data não bate com isso (o Nubank põe a data do começo da fatura), vale o mês antes da 1ª parcela.
function mesDaCompra(c) {
  const dm = c.data_compra ? mesDe(c.data_compra) : "";
  if (!parcelado(c)) return dm || mesDe(c.primeiro_mes);
  const pm = mesDe(c.primeiro_mes);
  return dm && (dm === pm || dm === somaMes(pm, -1)) ? dm : somaMes(pm, -1);
}
const dataAproximada = (c) => parcelado(c) && mesDaCompra(c) !== mesDe(c.data_compra || "");
const diaDaCompra = (c) => (dataAproximada(c) ? mesDaCompra(c) + "-01" : String(c.data_compra || c.primeiro_mes).slice(0, 10));
const DIAS_SEMANA_PF = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function pfGastos(el) {
  const hoje = mesHojePF();
  const meses = Array.from({ length: 4 }, (_, i) => somaMes(hoje, i - 3));
  if (!meses.includes(pfx.mesGasto)) pfx.mesGasto = hoje;
  const k = pfx.mesGasto;
  let lista = P.compras.filter((c) => mesDaCompra(c) === k && Number(c.parcelas) < RECORRENTE);
  const doMes = lista.slice();
  if (pfx.gCartao) lista = lista.filter((c) => (pfx.gCartao === "pix" ? !c.cartao_id : String(c.cartao_id) === pfx.gCartao));
  if (pfx.gDono === "eu") lista = lista.filter(temMinha); else if (pfx.gDono === "outros") lista = lista.filter((c) => !ehMinha(c));
  const total = (l) => l.reduce((s, c) => s + n2(c.valor_parcela) * Number(c.parcelas || 1), 0);
  // Só a sua parte (na dividida, a sua fração)
  const totalEu = (l) => l.reduce((s, c) => s + n2(c.valor_parcela) * Number(c.parcelas || 1) * fracMinha(c), 0);
  const meus = doMes.filter(temMinha);
  const vista = totalEu(meus.filter((c) => !parcelado(c))), novasParc = totalEu(meus.filter(parcelado)), dosOutros = total(doMes) - totalEu(doMes);
  const teto = n2(cfg("teto_mes"));
  // Por categoria (só o que é seu)
  const cats = {};
  // Só o à vista: é o que o teto e as metas medem (as parceladas já estão em Parcelas)
  meus.filter((c) => !parcelado(c)).forEach((c) => { const t = categoriaDe(c); cats[t] = (cats[t] || 0) + n2(c.valor_parcela) * fracMinha(c); });
  const listaCats = Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(1, ...listaCats.map(([, v]) => v));
  // Agrupado por dia, mais recente primeiro
  const dias = {};
  lista.forEach((c) => { (dias[diaDaCompra(c)] = dias[diaDaCompra(c)] || []).push(c); });
  const nomeCartao = (id) => (P.cartoes.find((c) => String(c.id) === String(id)) || {}).nome || "Pix/débito";
  el.innerHTML = `
    <div class="barra">
      <div class="chips" role="tablist" aria-label="Mês">${meses.map((m) => `<button class="chip" type="button" data-g-mes="${m}" aria-pressed="${m === k}">${MESES_LONGOS[Number(m.slice(5)) - 1]}</button>`).join("")}</div>
      <span class="espaco"></span>
      <select class="campo" id="g-cartao" aria-label="Cartão"><option value="">Todos os cartões</option>${P.cartoes.map((c) => `<option value="${c.id}" ${pfx.gCartao === String(c.id) ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}<option value="pix" ${pfx.gCartao === "pix" ? "selected" : ""}>Pix/débito</option></select>
      <select class="campo" id="g-dono" aria-label="De quem"><option value="">Meus e dos outros</option><option value="eu" ${pfx.gDono === "eu" ? "selected" : ""}>Só os meus</option><option value="outros" ${pfx.gDono === "outros" ? "selected" : ""}>Só dos outros</option></select>
    </div>
    <div class="pf-fat-topo">
      <div><span>Seus gastos à vista</span><strong>${real(vista)}</strong><small>comprados em ${MESES_LONGOS[Number(k.slice(5)) - 1].toLowerCase()}</small></div>
      <div><span>Compras parceladas novas</span><strong>${real(novasParc)}</strong><small>valor total, você paga aos poucos</small></div>
      <div><span>De outras pessoas</span><strong>${real(dosOutros)}</strong><small>no seu cartão</small></div>
    </div>
    ${teto ? barraTeto(mesAPagar(), teto) : ""}
    <div class="grade-fin pf-gastos-grade">
      <div class="cartao">
        <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Onde foi o seu dinheiro <span class="sub">(à vista)</span></h2><span class="espaco"></span><button class="btn" type="button" id="g-metas">${ic("editar")}Metas</button></div>
        ${listaCats.length ? `<div class="lista-barras">${listaCats.map(([t, v]) => { const meta = n2(metasCat()[t]); const passou = meta && v > meta; const escala = Math.max(maxCat, ...Object.values(metasCat()).map(Number)); return `<div class="linha-barra"><span class="lb-nome">${esc(t)}</span><span class="lb-trilho pf-trilho-meta"><i style="width:${(v / escala) * 100}%;background:${passou ? "var(--red)" : "#C9A464"}"></i>${meta ? `<em style="left:${(meta / escala) * 100}%"></em>` : ""}</span><span class="lb-valor">${real(v)}${meta ? `<small>de ${real(meta)}</small>` : ""}</span>${passou ? `<span class="lb-extra">passou ${real(v - meta)} da meta</span>` : ""}</div>`; }).join("")}</div>
        <p class="sub" style="margin-top:8px">O tracinho em cada barra é a meta da categoria. Vermelho = passou.</p>` : `<p class="vazio">Nenhum gasto seu neste mês ainda.</p>`}
        ${teto ? "" : `<p class="sub" style="margin-top:10px">Dica: defina um teto em Ajustes e acompanhe aqui quanto ainda dá pra gastar.</p>`}
      </div>
      <div class="cartao">
        <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Dia a dia</h2><span class="espaco"></span><button class="btn" type="button" id="g-novo">${ic("mais")}Gasto</button></div>
        ${Object.keys(dias).length ? Object.keys(dias).sort().reverse().map((d) => { const dt = deISO(d); const l = dias[d]; return `<div class="pf-dia">
          <div class="pf-dia-topo"><b>${DIAS_SEMANA_PF[dt.getDay()]}, ${dt.getDate()} de ${MESES_LONGOS[dt.getMonth()].toLowerCase()}</b><span>${real(totalEu(l))}</span></div>
          ${l.map((c) => `<button type="button" class="pf-gasto" data-g-id="${c.id}">
            <span class="pf-gasto-nome">${esc(c.descricao)}${c.origem === "rapido" ? ` <i class="pf-tag">lançado por você</i>` : ""}</span>
            <span class="pf-gasto-info">${esc(nomeCartao(c.cartao_id))}${parcelado(c) ? ` · ${c.parcelas}x de ${real(c.valor_parcela)}${dataAproximada(c) ? ", dia aproximado" : ""}` : ""}${ehMinha(c) ? "" : ` · <b>${esc(rotuloDono(c))}</b>`}${dividida(c) && temMinha(c) ? ` · sua parte ${real(n2(c.valor_parcela) * Number(c.parcelas || 1) * fracMinha(c))}` : ""} · ${esc(categoriaDe(c))}</span>
            <strong class="${n2(c.valor_parcela) < 0 ? "pf-credito-v" : ""}">${real(n2(c.valor_parcela) * Number(c.parcelas || 1))}</strong>
          </button>`).join("")}</div>`; }).join("") : `<p class="vazio">Nenhum gasto em ${MESES_LONGOS[Number(k.slice(5)) - 1].toLowerCase()}${pfx.gCartao || pfx.gDono ? " com esse filtro" : ""}. Lance pelo botão + Gasto ou pelo Telegram.</p>`}
      </div>
    </div>`;
  $$("[data-g-mes]", el).forEach((b) => b.onclick = () => { pfx.mesGasto = b.dataset.gMes; desenhar(); });
  $("#g-cartao", el).onchange = (e) => { pfx.gCartao = e.target.value; desenhar(); };
  $("#g-dono", el).onchange = (e) => { pfx.gDono = e.target.value; desenhar(); };
  $("#g-novo", el).onclick = () => abrirGastoRapido();
  $("#g-metas", el).onclick = () => {
    const m = metasCat();
    const campos = Object.keys(METAS_PADRAO).map((t, i) => ({ n: "m" + i, r: t + " (R$ por mês)", t: "number" }));
    const valores = {}; Object.keys(METAS_PADRAO).forEach((t, i) => { valores["m" + i] = m[t]; });
    abrirForm({ titulo: "Metas por categoria", campos, valores, aoSalvar: async (d) => {
      const novo = {}; Object.keys(METAS_PADRAO).forEach((t, i) => { novo[t] = Number(d["m" + i]) || 0; });
      const { error } = await db.from("pf_config").upsert({ chave: "metas_categoria", valor: novo }, { onConflict: "chave" });
      if (error) { avisar(traduzErro(error), true); return false; }
      await recarregarPF(); return true;
    } });
  };
  $$("[data-g-id]", el).forEach((b) => b.onclick = () => formCompraPF(P.compras.find((c) => String(c.id) === b.dataset.gId)));
}

/* ---------- Parcelas (cartões e compras) ---------- */
function pfCompras(el) {
  const hoje = mesHojePF();
  const pessoas = pessoasConhecidas();
  let lista = P.compras.slice();
  if (pfx.cartao) lista = lista.filter((c) => String(c.cartao_id) === pfx.cartao);
  if (pfx.dono === "eu") lista = lista.filter(temMinha);
  else if (pfx.dono === "outros") lista = lista.filter((c) => !ehMinha(c));
  else if (pfx.dono === "dividida") lista = lista.filter(dividida);
  else if (pfx.dono) lista = lista.filter((c) => outrosDe(c).some((x) => chavePessoa(x.nome) === pfx.dono));
  // Parceladas ainda rodando (padrão), parceladas que já acabaram, ou tudo (inclui à vista)
  if (pfx.tipo === "parceladas") lista = lista.filter((c) => parcelado(c) && ultimoMes(c) >= hoje);
  else if (pfx.tipo === "acabaram") lista = lista.filter((c) => parcelado(c) && ultimoMes(c) < hoje);
  const porMes = lista.filter((c) => idxParcela(c, hoje) >= 0).reduce((s, c) => s + n2(c.valor_parcela), 0);
  lista.sort((a, b) => (ultimoMes(a) < ultimoMes(b) ? -1 : ultimoMes(a) > ultimoMes(b) ? 1 : n2(b.valor_parcela) - n2(a.valor_parcela)));
  const nomeCartao = (id) => (P.cartoes.find((c) => String(c.id) === String(id)) || {}).nome || "";
  el.innerHTML = `
    <div class="barra">
      <select class="campo" id="pf-f-cartao" aria-label="Cartão"><option value="">Todos os cartões</option>${P.cartoes.map((c) => `<option value="${c.id}" ${pfx.cartao === String(c.id) ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select>
      <select class="campo" id="pf-f-dono" aria-label="De quem"><option value="">Todas as compras</option><option value="eu" ${pfx.dono === "eu" ? "selected" : ""}>Só as minhas</option><option value="outros" ${pfx.dono === "outros" ? "selected" : ""}>Só de outras pessoas</option><option value="dividida" ${pfx.dono === "dividida" ? "selected" : ""}>Só as divididas</option>${pessoas.map((p) => `<option value="${esc(chavePessoa(p))}" ${pfx.dono === chavePessoa(p) ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>
      <div class="chips" role="tablist" aria-label="Quais compras">${[["parceladas", "Parcelas rodando"], ["acabaram", "Já acabaram"], ["todas", "Tudo, com à vista"]].map(([k, n]) => `<button class="chip" type="button" data-pf-tipo="${k}" aria-pressed="${pfx.tipo === k}">${n}</button>`).join("")}</div>
      <span class="espaco"></span>
      <button class="btn" type="button" data-novo-cartao>${ic("mais")}Cartão</button>
      <button class="btn primario" type="button" id="pf-nova-compra">${ic("mais")}Compra parcelada</button>
    </div>
    <div class="tabela-caixa"><table><thead><tr><th>Compra</th><th>Cartão</th><th>De quem</th><th>Parcela agora</th><th>Valor da parcela</th><th>Falta pagar</th><th>Última</th></tr></thead>
    <tbody id="pf-lista">${lista.map((c) => {
      const i = idxParcela(c, hoje), n = Number(c.parcelas);
      let falta = 0; for (let j = 0; j < n; j++) if (somaMes(mesDe(c.primeiro_mes), j) >= hoje) falta += n2(c.valor_parcela);
      return `<tr class="clicavel" data-id="${c.id}"><td><b>${esc(c.descricao)}</b>${c.data_compra ? `<br><small class="sub">${dataBR(c.data_compra)}</small>` : ""}</td>
        <td>${esc(nomeCartao(c.cartao_id))}</td>
        <td>${ehMinha(c) ? "Eu" : `<span class="pilula p-pendente">${esc(rotuloDono(c))}</span>`}</td>
        <td>${n === 1 ? "à vista" : n >= RECORRENTE ? "todo mês" : i >= 0 ? `${i + 1}/${n}` : mesDe(c.primeiro_mes) > hoje ? `começa ${nomeMes(mesDe(c.primeiro_mes), true)}` : `acabou (${n}x)`}</td>
        <td>${real(c.valor_parcela)}${dividida(c) ? `<br><small class="sub">${partesDe(c).length} partes de ${real(n2(c.valor_parcela) / partesDe(c).length)}</small>` : ""}</td><td>${real(falta)}</td><td>${nomeMes(ultimoMes(c), true)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="vazio">Nada por aqui. Importe a fatura ou lance uma compra parcelada.</td></tr>`}</tbody></table></div>
    <p class="contagem">${qtd(lista.length, "compra", "compras")} · ${real(porMes)} neste mês${pfx.tipo === "parceladas" ? ". As compras à vista ficam em <b>Gastos do mês</b>." : ""}</p>`;
  $("#pf-f-cartao", el).onchange = (e) => { pfx.cartao = e.target.value; desenhar(); };
  $("#pf-f-dono", el).onchange = (e) => { pfx.dono = e.target.value; desenhar(); };
  $$("[data-pf-tipo]", el).forEach((b) => b.onclick = () => { pfx.tipo = b.dataset.pfTipo; desenhar(); });
  $("#pf-nova-compra", el).onclick = () => formCompraPF();
  ligarCartoes(el);
  $("#pf-lista", el).addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) formCompraPF(P.compras.find((c) => String(c.id) === tr.dataset.id));
  });
}

function formCompraPF(c) {
  const hoje = mesHojePF();
  const novo = !c;
  abrirForm({
    titulo: novo ? "Nova compra parcelada" : "Editar compra",
    tabela: "pf_compras",
    campos: [
      { n: "descricao", r: "O que foi", req: true, inteiro: true },
      { n: "cartao_id", r: "Cartão", t: "select", op: [["", "Sem cartão"], ...P.cartoes.map((x) => [String(x.id), x.nome])] },
      { n: "tipo", r: "Tipo", t: "select", livre: true, op: [["minha", "Minha"], ["outra", "De outra pessoa"], ["dividida", "Dividida (eu + outras pessoas)"]] },
      { n: "nomes", r: "Com quem / de quem", livre: true, lista: pessoasConhecidas(), ph: "ex.: Diego", ajuda: "Dividida: escreva só os outros nomes (ex.: Diego, ou Diego e Emillie). Cada um paga uma parte igual, você incluso. Minha: deixe vazio." },
      { n: "valor_parcela", r: "Valor de cada parcela (R$)", t: "number", req: true },
      { n: "parcelas", r: "Quantas parcelas no total", t: "number", req: true },
      ...(novo ? [{ n: "agora", r: "Qual parcela vem na fatura deste mês", t: "number", livre: true, ajuda: "Ex.: se este mês vem a 3/10, digite 3. Se ainda não começou, digite 0." }]
        : [{ n: "primeiro_mes", r: "Mês da fatura da 1ª parcela", t: "month" }]),
      { n: "data_compra", r: "Data da compra", t: "date" },
      { n: "categoria", r: "Categoria", lista: ["Casa", "Mercado", "Saúde", "Transporte", "Roupas", "Eletrônicos", "Lazer", "Trabalho", "Outros"] }
    ],
    valores: c ? { ...c, ...tipoDaCompra(c), cartao_id: c.cartao_id == null ? "" : String(c.cartao_id), primeiro_mes: mesDe(c.primeiro_mes) } : { tipo: "minha", nomes: "", parcelas: "", agora: 1, cartao_id: P.cartoes[0] ? String(P.cartoes[0].id) : "" },
    aoSalvar: async (d) => {
      const n = Math.max(1, Math.round(d.parcelas || 1));
      let primeiro;
      if (novo) { const agora = Math.max(0, Math.round(d.agora || 0)); primeiro = somaMes(hoje, agora ? -(agora - 1) : 1); }
      else primeiro = d.primeiro_mes || mesDe(c.primeiro_mes);
      const dados = { descricao: d.descricao, cartao_id: d.cartao_id ? Number(d.cartao_id) : null, dono: donoDoTipo(d.tipo, d.nomes), valor_parcela: d.valor_parcela, parcelas: n, primeiro_mes: primeiro + "-01", data_compra: d.data_compra, categoria: d.categoria };
      if (novo) dados.origem = "manual";
      const ok = await gravar("pf_compras", dados, c ? c.id : null);
      if (ok) await recarregarPF();
      return ok;
    },
    aoApagar: c ? async () => { const ok = await apagarLinha("pf_compras", c.id); if (ok) await recarregarPF(); return ok; } : null
  });
}

function formCartaoPF(c) {
  abrirForm({
    titulo: c ? "Editar cartão" : "Novo cartão",
    tabela: "pf_cartoes",
    campos: [
      { n: "nome", r: "Nome", req: true, lista: ["Nubank", "Bradesco", "Inter", "Itaú", "Santander", "C6", "Caixa", "Banco do Brasil"] },
      { n: "vence_dia", r: "Dia do vencimento", t: "number" },
      { n: "fecha_dia", r: "Dia do fechamento", t: "number" },
      { n: "limite", r: "Limite (R$)", t: "number" }
    ],
    valores: c || {},
    aoSalvar: async (d) => {
      const dados = { nome: d.nome, vence_dia: d.vence_dia || null, fecha_dia: d.fecha_dia || null, limite: d.limite || null };
      const ok = await gravar("pf_cartoes", dados, c ? c.id : null);
      if (ok) await recarregarPF();
      return ok;
    },
    aoApagar: c ? async () => { const ok = await apagarLinha("pf_cartoes", c.id); if (ok) await recarregarPF(); return ok; } : null
  });
}

/* ---------- Quem me deve ---------- */
function pfDevem(el) {
  const dev = devedores();
  const hoje = mesHojePF();
  const mesesFat = Array.from({ length: 5 }, (_, i) => somaMes(hoje, i - 1));
  // Abre na fatura que você paga agora
  if (!mesesFat.includes(pfx.mesDeve)) pfx.mesDeve = mesesFat.includes(mesAPagar()) ? mesAPagar() : hoje;
  const kF = pfx.mesDeve;
  const linhasFat = dev.map((p) => ({ p, m: contaPorMes(p, kF).find((x) => x.k === kF) })).filter((x) => x.m && x.m.valor > 0);
  const totFat = linhasFat.reduce((s, x) => s + x.m.valor, 0), totFalta = linhasFat.reduce((s, x) => s + x.m.falta, 0);
  // O que ficou em aberto de faturas anteriores à escolhida
  const antes = dev.map((p) => ({ p, l: contaPorMes(p, somaMes(kF, -1)).filter((m) => m.falta > 0.005) })).filter((x) => x.l.length);
  const quadroFatura = `<div class="cartao pf-por-fatura">
    <div class="barra" style="margin:0 0 6px"><h2 style="margin:0">Por fatura</h2><span class="espaco"></span>
      <div class="chips" role="tablist" aria-label="Fatura">${mesesFat.map((m) => `<button class="chip" type="button" data-mes-deve="${m}" aria-pressed="${m === kF}">${MESES_LONGOS[Number(m.slice(5)) - 1]}</button>`).join("")}</div></div>
    <p class="sub" style="margin:0 0 8px">Quanto cada pessoa te deve só na fatura de ${MESES_LONGOS[Number(kF.slice(5)) - 1].toLowerCase()}. O que ela pagou a mais antes já entra como "já coberto".</p>
    ${linhasFat.length ? `<div class="tabela-caixa"><table class="pf-fat-pessoas"><thead><tr><th>Pessoa</th><th>Nesta fatura</th><th>Já coberto</th><th>Falta</th><th>Até</th><th></th></tr></thead><tbody>
      ${linhasFat.map(({ p, m }) => `<tr>
        <td><b>${esc(p.nome)}</b><small>${m.itens.length === 1 ? "1 compra" : `${m.itens.length} compras`}</small></td>
        <td>${real(m.valor)}</td>
        <td>${m.coberto ? real(m.coberto) : "-"}</td>
        <td>${m.falta > 0.005 ? `<b>${real(m.falta)}</b>` : `<span class="pilula p-pago">pago</span>`}</td>
        <td>${dataBR(m.vence).slice(0, 5)}${m.falta > 0.005 && m.vence < hojeISO() ? ` <span class="pilula p-vencido">vencido</span>` : ""}</td>
        <td class="pf-fat-acoes">${m.falta > 0.005 ? `<a class="btn pequeno" href="https://wa.me/?text=${encodeURIComponent(msgFatura(p, m))}" target="_blank" rel="noopener">${ic("whats")}Cobrar</a>` : ""}</td></tr>`).join("")}
      </tbody><tfoot><tr><td>Total</td><td>${real(totFat)}</td><td></td><td><b>${real(totFalta)}</b></td><td colspan="2"></td></tr></tfoot></table></div>`
      : `<p class="vazio">Ninguém tem compra na fatura de ${MESES_LONGOS[Number(kF.slice(5)) - 1].toLowerCase()}.</p>`}
    ${antes.length ? `<p class="pf-antes">Ainda em aberto de faturas anteriores: ${antes.map(({ p, l }) => `<b>${esc(p.nome)}</b> ${real(l.reduce((s, m) => s + m.falta, 0))} (${l.map((m) => MESES_LONGOS[Number(m.k.slice(5)) - 1].toLowerCase()).join(", ")})`).join(" · ")}</p>` : ""}
  </div>`;
  el.innerHTML = quadroFatura + `
    <div class="barra"><p class="sub" style="margin:0">Cada compra marcada com o nome de alguém entra aqui. Nos cartões abaixo, o total de cada pessoa: "Já venceu" soma as faturas desde ${nomeMes(inicioCobranca())} que já passaram do dia de vencimento do cartão; "Próximos 12 meses" é o que ainda vai cair.</p><span class="espaco"></span>
      <button class="btn primario" type="button" id="pf-novo-receb">${ic("mais")}Registrar pagamento</button></div>
    ${dev.length ? `<div class="pf-pessoas">${dev.map((p) => {
      const abertas = p.compras.filter((c) => ultimoMes(c) >= hoje);
      const msg = `Oi, ${p.nome.split(" ")[0]}! Passando o resumo do cartão: ${abertas.map((c) => { const i = idxParcela(c, hoje); return `${c.descricao}${Number(c.parcelas) > 1 && Number(c.parcelas) < RECORRENTE && i >= 0 ? ` (${i + 1}/${c.parcelas})` : ""} ${real(c.valor_parcela)}${c.parteDe ? ` (sua parte de ${real(c.parteDe)})` : ""}`; }).join("; ")}. Em aberto até agora: ${real(Math.max(0, p.falta))}.${cobraJuros(p.nome) && jurosDe(p).pendente > 0 ? ` Juros por atraso: ${real(jurosDe(p).pendente)}. Total pra quitar hoje: ${real(Math.max(0, p.falta) + jurosDe(p).pendente)}.` : ""} Consegue me mandar até o vencimento?`;
      return `<div class="cartao pf-pessoa ${p.falta > 0 ? "atrasado" : ""}">
        <div class="barra" style="margin:0 0 6px"><h2 style="margin:0">${esc(p.nome)}</h2><span class="espaco"></span>
          ${p.falta > 0 ? `<span class="pilula p-vencido">deve ${real(p.falta)}</span>` : p.falta < 0 ? `<span class="pilula p-pago">pagou ${real(-p.falta)} adiantado</span>` : `<span class="pilula p-pago">em dia</span>`}</div>
        <div class="pf-nums"><span>Já venceu<b>${real(p.devido)}</b></span><span>Já pagou<b>${real(p.pago)}</b></span><span>Próximos 12 meses<b>${real(p.futuro)}</b></span></div>
        ${cobraJuros(p.nome) ? (() => { const j = jurosDe(p); return `<div class="pf-juros"><span>Juros por atraso${j.desde ? ` (desde ${dataBR(j.desde).slice(0, 5)})` : ""}<b>${real(j.pendente)}</b>${j.jurosPagos ? `<small>já pagou ${real(j.jurosPagos)} de juros</small>` : ""}</span><span>Pra quitar hoje<b>${real(Math.max(0, p.falta) + j.pendente)}</b><small>o que falta + juros</small></span></div>`; })() : ""}
        <label class="pf-juros-liga"><input type="checkbox" data-juros-pessoa="${esc(p.nome)}" ${cobraJuros(p.nome) ? "checked" : ""}> Cobrar juros por atraso (taxa do cartão, por dia)</label>
        <ul class="pf-mini">${abertas.slice(0, 8).map((c) => { const i = idxParcela(c, hoje); return `<li><span>${esc(c.descricao)}${c.parteDe ? ` <em>(parte de ${real(c.parteDe)})</em>` : ""}</span><small>${Number(c.parcelas) >= RECORRENTE ? "todo mês" : Number(c.parcelas) > 1 ? (i >= 0 ? `${i + 1}/${c.parcelas}` : `até ${nomeMes(ultimoMes(c), true)}`) : "à vista"}</small><b>${real(c.valor_parcela)}</b></li>`; }).join("")}</ul>
        ${p.jurosRecebidos ? `<p class="sub" style="margin:4px 0 0">Já te pagou ${real(p.jurosRecebidos)} de juros por atraso (não entra na conta das compras).</p>` : ""}
        ${p.devido > 0 ? `<div class="pf-pago-trilho" title="Pagou ${real(p.pago)} de ${real(p.devido)}"><i style="width:${Math.min(100, (p.pago / p.devido) * 100)}%"></i></div>` : ""}
        ${p.receb.length ? `<div class="pf-pagamentos"><b>Pagamentos</b>
          <ul>${[...p.receb].sort((a, b) => String(b.data).localeCompare(String(a.data))).map((r) => `<li><span>${dataBR(r.data)}${n2(r.juros) ? ` · <em>${real(r.juros)} de juros</em>` : ""}${r.obs && !n2(r.juros) ? ` · ${esc(r.obs)}` : ""}</span><strong>${real(r.valor)}</strong><button class="icone-btn" type="button" data-edita-receb="${r.id}" aria-label="Editar pagamento">${ic("editar")}</button></li>`).join("")}</ul>
          <p>${p.falta > 0 ? `Falta agora: <strong>${real(p.falta)}</strong>` : p.falta < 0 ? `Pagou <strong>${real(-p.falta)}</strong> a mais (conta para as próximas parcelas)` : "Tudo pago até agora ✅"}</p></div>` : ""}
        <div class="barra" style="margin:10px 0 0">
          <button class="btn primario" type="button" data-receb="${esc(p.nome)}">${ic("mais")}Pagamento</button>
          <a class="btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${ic("whats")}Cobrar no WhatsApp</a>
        </div></div>`; }).join("")}</div>`
      : `<p class="vazio">Ninguém te deve nada por aqui. Quando importar a fatura, escreva o nome da pessoa nas compras que não são suas.</p>`}`;
  $$("[data-mes-deve]", el).forEach((b) => b.onclick = () => { pfx.mesDeve = b.dataset.mesDeve; desenhar(); });
  $("#pf-novo-receb", el).onclick = () => formRecebPF();
  $$("[data-receb]", el).forEach((b) => b.onclick = () => formRecebPF(null, b.dataset.receb, (dev.find((p) => p.nome === b.dataset.receb) || {}).falta || 0));
  $$("[data-edita-receb]", el).forEach((x) => x.onclick = () => formRecebPF(P.receb.find((r) => String(r.id) === x.dataset.editaReceb)));
  $$("[data-juros-pessoa]", el).forEach((cx) => cx.onchange = async () => {
    const mapa = { ...(P.config.juros_pessoas || {}) };
    mapa[chavePessoa(cx.dataset.jurosPessoa)] = cx.checked;
    const { error } = await db.from("pf_config").upsert({ chave: "juros_pessoas", valor: mapa }, { onConflict: "chave" });
    if (error) { avisar(traduzErro(error), true); cx.checked = !cx.checked; return; }
    P.config.juros_pessoas = mapa;
    desenhar();
  });
}
// Pagamento pode ser em partes: cada valor que a pessoa manda vira uma linha, e o "falta" vai diminuindo
function formRecebPF(r, pessoa, falta) {
  abrirForm({
    titulo: r ? "Editar pagamento" : pessoa ? `Pagamento de ${pessoa}` : "Registrar pagamento recebido",
    tabela: "pf_recebimentos",
    campos: [
      { n: "pessoa", r: "Quem pagou", req: true, lista: pessoasConhecidas() },
      { n: "valor", r: "Quanto a pessoa te mandou (R$)", t: "number", req: true, ajuda: !r && falta > 0 ? `Falta ${real(falta)}. Pode ser só uma parte: cada pagamento fica guardado com a data.` : "" },
      { n: "juros", r: "Desse valor, quanto foi de juros por atraso (R$)", t: "number", ajuda: "Deixe 0 se não teve juros. O juros não abate as próximas faturas." },
      { n: "data", r: "Data", t: "date", req: true },
      { n: "obs", r: "Observação", inteiro: true }
    ],
    valores: r || { pessoa: pessoa || "", valor: "", data: hojeISO() },
    aoSalvar: async (d) => {
      if (n2(d.juros) > n2(d.valor)) { avisar("O juros não pode ser maior que o valor que a pessoa mandou.", true); return false; }
      const ok = await gravar("pf_recebimentos", { ...d, pessoa: nomePessoa(d.pessoa) }, r ? r.id : null);
      if (ok) {
        await recarregarPF();
        const p = devedores().find((x) => chavePessoa(x.nome) === chavePessoa(d.pessoa));
        if (p && !r) setTimeout(() => avisar(p.falta > 0 ? `Anotado. Falta ${real(p.falta)} de ${p.nome}.` : `Anotado. ${p.nome} está em dia.`), 50);
      }
      return ok;
    },
    aoApagar: r ? async () => { const ok = await apagarLinha("pf_recebimentos", r.id); if (ok) await recarregarPF(); return ok; } : null
  });
}

/* ---------- Contas fixas ---------- */
function pfContas(el) {
  const hoje = mesHojePF();
  const ativas = P.contas.filter((c) => contaAtiva(c, hoje)).sort((a, b) => n2(b.valor) - n2(a.valor));
  const outras = P.contas.filter((c) => !contaAtiva(c, hoje)).sort((a, b) => String(a.inicio || "").localeCompare(String(b.inicio || "")));
  const linha = (c) => `<tr class="clicavel" data-id="${c.id}"><td><b>${esc(c.nome)}</b>${c.no_cartao ? ` <span class="pilula p-status">no cartão</span>` : ""}${c.obs ? `<br><small class="sub">${esc(c.obs)}</small>` : ""}</td><td>${esc(c.categoria || "")}</td><td>${c.dia ? `dia ${c.dia}` : ""}</td><td>${real(c.valor)}</td>
    <td>${c.inicio && mesDe(c.inicio) > hoje ? `começa ${nomeMes(mesDe(c.inicio), true)}` : ""}${c.fim ? `${c.inicio && mesDe(c.inicio) > hoje ? ", " : ""}até ${nomeMes(mesDe(c.fim), true)}` : (c.inicio && mesDe(c.inicio) > hoje ? "" : "sem data pra acabar")}</td></tr>`;
  el.innerHTML = `
    <div class="barra"><p class="sub" style="margin:0">Total por mês fora do cartão: <b>${real(fixasNo(hoje))}</b>${ativas.some((c) => c.no_cartao) ? ` · no cartão: ${real(ativas.filter((c) => c.no_cartao).reduce((s, c) => s + n2(c.valor), 0))} (já conta na fatura)` : ""}</p><span class="espaco"></span>
      <button class="btn primario" type="button" id="pf-nova-conta">${ic("mais")}Conta fixa</button></div>
    <div class="tabela-caixa"><table><thead><tr><th>Conta</th><th>Categoria</th><th>Vence</th><th>Valor</th><th>Período</th></tr></thead>
    <tbody id="pf-contas">${ativas.map(linha).join("") || `<tr><td colspan="5" class="vazio">Nenhuma conta fixa cadastrada.</td></tr>`}
    ${outras.length ? `<tr><th colspan="5">Futuras ou encerradas</th></tr>${outras.map(linha).join("")}` : ""}</tbody></table></div>`;
  $("#pf-nova-conta", el).onclick = () => formContaPF();
  $("#pf-contas", el).addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) formContaPF(P.contas.find((c) => String(c.id) === tr.dataset.id));
  });
}
function formContaPF(c) {
  abrirForm({
    titulo: c ? "Editar conta fixa" : "Nova conta fixa",
    tabela: "pf_contas",
    campos: [
      { n: "nome", r: "Conta", req: true, inteiro: true },
      { n: "valor", r: "Valor por mês (R$)", t: "number", req: true },
      { n: "dia", r: "Dia do vencimento", t: "number" },
      { n: "categoria", r: "Categoria", lista: ["Moradia", "Saúde", "Seguro", "Internet e celular", "Impostos", "Transporte", "Assinaturas", "Família", "Outros"] },
      { n: "inicio", r: "Começa em", t: "month", ajuda: "Vazio = já está valendo." },
      { n: "fim", r: "Acaba em", t: "month", ajuda: "Vazio = sem data pra acabar." },
      { n: "no_cartao", r: "Pago no cartão de crédito (já aparece na fatura, não soma de novo)", t: "check", inteiro: true },
      { n: "obs", r: "Observação", inteiro: true }
    ],
    valores: c ? { ...c, inicio: mesDe(c.inicio), fim: mesDe(c.fim) } : {},
    aoSalvar: async (d) => {
      const dados = { ...d, dia: d.dia || null, inicio: d.inicio ? d.inicio + "-01" : null, fim: d.fim ? d.fim + "-01" : null };
      const ok = await gravar("pf_contas", dados, c ? c.id : null);
      if (ok) await recarregarPF();
      return ok;
    },
    aoApagar: c ? async () => { const ok = await apagarLinha("pf_contas", c.id); if (ok) await recarregarPF(); return ok; } : null
  });
}

/* ---------- Entradas ---------- */
function pfEntradas(el) {
  const hoje = mesHojePF();
  const meses = Array.from({ length: 6 }, (_, i) => somaMes(hoje, -(5 - i)));
  const maxV = Math.max(1, ...meses.map((k) => Math.max(entradasNo(k), pjNo(k))));
  el.innerHTML = `
    <div class="barra"><p class="sub" style="margin:0">O que caiu na sua conta pessoal. A renda da projeção usa ${esc(rendaPrevista().fonte || "estes valores")}.</p><span class="espaco"></span>
      <button class="btn primario" type="button" id="pf-nova-entrada">${ic("mais")}Entrada</button></div>
    <div class="cartao"><div class="barra" style="margin-bottom:4px"><h2 style="margin:0">Últimos 6 meses</h2><span class="espaco"></span>
      <span class="legenda" style="margin:0"><span><i class="leg-fat"></i>Entrou na conta pessoal</span><span><i class="leg-rec"></i>Entrou na empresa</span></span></div>
      <div class="barras-mes" style="grid-template-columns:repeat(6,minmax(0,1fr))">${meses.map((k) => `<div class="grupo-mes ${k === hoje ? "hoje" : ""}" data-dica="<b>${nomeMes(k)}</b><br>Conta pessoal: ${real(entradasNo(k))}<br>Empresa: ${real(pjNo(k))}">
        <div class="par-barras"><i class="b-fat" style="height:${(entradasNo(k) / maxV) * 100}%"></i><i class="b-rec" style="height:${(pjNo(k) / maxV) * 100}%"></i></div><span>${nomeMes(k, true)}</span></div>`).join("")}</div></div>
    <div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Descrição</th><th>Origem</th><th>Valor</th></tr></thead>
    <tbody id="pf-entradas">${P.entradas.map((e) => `<tr class="clicavel" data-id="${e.id}"><td>${dataBR(e.data)}</td><td>${esc(e.descricao || "")}</td><td>${esc(e.origem || "")}</td><td>${real(e.valor)}</td></tr>`).join("") || `<tr><td colspan="4" class="vazio">Nenhuma entrada lançada.</td></tr>`}</tbody></table></div>`;
  $("#pf-nova-entrada", el).onclick = () => formEntradaPF();
  $("#pf-entradas", el).addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) formEntradaPF(P.entradas.find((x) => String(x.id) === tr.dataset.id));
  });
}
function formEntradaPF(e) {
  abrirForm({
    titulo: e ? "Editar entrada" : "Nova entrada",
    tabela: "pf_entradas",
    campos: [
      { n: "data", r: "Data", t: "date", req: true },
      { n: "valor", r: "Valor (R$)", t: "number", req: true },
      { n: "descricao", r: "Descrição", inteiro: true },
      { n: "origem", r: "Origem", lista: ["Salário da empresa", "TikTok Shop", "Publi", "Freela", "Devolução de empréstimo", "Outro"] }
    ],
    valores: e || { data: hojeISO() },
    aoSalvar: async (d) => {
      const ok = await gravar("pf_entradas", d, e ? e.id : null);
      if (ok) await recarregarPF();
      return ok;
    },
    aoApagar: e ? async () => { const ok = await apagarLinha("pf_entradas", e.id); if (ok) await recarregarPF(); return ok; } : null
  });
}

/* ---------- Ajustes ---------- */
function formAjustesPF() {
  abrirForm({
    titulo: "Ajustes do financeiro pessoal",
    campos: [
      { n: "salario", r: "Salário fixo que você se paga (R$/mês)", t: "number", ajuda: "Vazio = usa a média do que entrou na conta." },
      { n: "reserva", r: "Quanto você tem guardado hoje (R$)", t: "number" },
      { n: "reserva_meses", r: "Meta da reserva (meses de custo)", t: "number", ajuda: "3 é um bom começo; 6 é o ideal pra renda que varia." },
      { n: "teto_mes", r: "Teto da sua parte da fatura por mês (R$)", t: "number", ajuda: "Tudo no cartão: parcelas + compras à vista, somando todos os cartões. Vazio = sem teto." },
      { n: "dia_a_dia", r: "Gasto do dia a dia por mês, para a projeção (R$)", t: "number", ajuda: "Vazio = calcula pela média das faturas importadas." },
      ...P.cartoes.map((c) => ({ n: "juros_" + c.id, r: `Juros por atraso no ${c.nome} (% ao mês)`, t: "number", livre: true, ajuda: "Usado para cobrar de quem te paga depois do vencimento. Veja na sua fatura: juros do rotativo." }))
    ],
    valores: { salario: cfg("salario", ""), reserva: cfg("reserva", ""), reserva_meses: cfg("reserva_meses", 3), teto_mes: cfg("teto_mes", ""), dia_a_dia: cfg("dia_a_dia", ""), ...Object.fromEntries(P.cartoes.map((c) => ["juros_" + c.id, taxaDoCartao(c)])) },
    aoSalvar: async (d) => {
      const juros = {};
      Object.keys(d).filter((k) => k.startsWith("juros_")).forEach((k) => { juros[k.slice(6)] = d[k]; delete d[k]; });
      const linhas = Object.entries(d).map(([chave, v]) => ({ chave, valor: v || 0 }));
      if (Object.keys(juros).length) linhas.push({ chave: "juros_cartoes", valor: juros });
      const { error } = await db.from("pf_config").upsert(linhas, { onConflict: "chave" });
      if (error) { avisar(traduzErro(error), true); return false; }
      await recarregarPF();
      return true;
    }
  });
}

/* ---------- Simular compra ---------- */
function abrirSimulador() {
  const hoje = mesHojePF();
  const d = abrirJanelaSimples("Simular uma compra parcelada", `
    <div class="form-grade">
      <div><label for="sim-v">Valor total (R$)</label><input class="campo" id="sim-v" type="number" step="any" min="0" placeholder="600"></div>
      <div><label for="sim-n">Em quantas vezes</label><input class="campo" id="sim-n" type="number" min="1" max="48" value="6"></div>
      <div><label for="sim-ini">1ª parcela na fatura de</label><input class="campo" id="sim-ini" type="month" value="${somaMes(hoje, 1)}"></div>
    </div>
    <div id="sim-res" style="margin-top:12px"><p class="vazio">Digite o valor para ver o impacto nos próximos meses.</p></div>`, `<button class="btn" type="button" data-fechar>Fechar</button>`);
  $$("[data-fechar]", d).forEach((b) => b.onclick = () => d.close());
  const calc = () => {
    const v = Number(String($("#sim-v", d).value).replace(",", ".")) || 0, n = Math.max(1, Math.round(Number($("#sim-n", d).value) || 1));
    const ini = $("#sim-ini", d).value || somaMes(hoje, 1);
    if (!v) { $("#sim-res", d).innerHTML = `<p class="vazio">Digite o valor para ver o impacto nos próximos meses.</p>`; return; }
    const antes = projecao(12), depois = projecao(12, { inicio: ini, n, v: v / n });
    const viraram = depois.filter((m, i) => m.sobra < 0 && antes[i].sobra >= 0);
    const piores = depois.filter((m) => m.sobra < 0);
    const veredito = !rendaPrevista().v ? `<p class="aviso-falta">Sem renda cadastrada não dá para avaliar. Lance suas entradas ou um salário fixo nos ajustes.</p>`
      : viraram.length ? `<p class="pf-veredito ruim"><b>Não compensa agora.</b> Essa compra faz ${qtd(viraram.length, "mês", "meses")} ficar no negativo (${viraram.map((m) => nomeMes(m.k, true)).join(", ")}).</p>`
      : piores.length ? `<p class="pf-veredito ruim"><b>Segure.</b> Esses meses já estão no negativo e a compra aumenta o buraco.</p>`
      : `<p class="pf-veredito bom"><b>Cabe.</b> A conta continua fechando em todos os meses, mas a sobra diminui ${real(v / n)} por ${qtd(n, "mês", "meses")}.</p>`;
    $("#sim-res", d).innerHTML = `${veredito}<p class="sub">${n}x de ${real(v / n)}</p>
      <div class="tabela-caixa"><table><thead><tr><th>Mês</th><th>Sobra hoje</th><th>Com a compra</th></tr></thead><tbody>
      ${depois.map((m, i) => `<tr><td>${nomeMes(m.k, true)}</td><td class="${antes[i].sobra < 0 ? "neg" : ""}">${real(antes[i].sobra)}</td><td class="${m.sobra < 0 ? "neg" : ""}"><b>${real(m.sobra)}</b></td></tr>`).join("")}
      </tbody></table></div>`;
  };
  $$("input", d).forEach((i) => i.addEventListener("input", calc));
  $("#sim-v", d).focus();
}

/* =============================================================
   IMPORTAR FATURA (PDF ou CSV)
   O arquivo é lido aqui mesmo no navegador. Cada linha com data e
   valor vira uma compra; "Parcela 3/10", "03/10" ou "3 de 10"
   viram parcelamento. Na revisão você marca de quem é cada uma.
   ============================================================= */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfjsPronto = null;
function carregarPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsPronto) pdfjsPronto = new Promise((ok, falha) => {
    const s = document.createElement("script");
    s.src = PDFJS + "pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
    s.onerror = () => { pdfjsPronto = null; falha(new Error("Não deu para carregar o leitor de PDF. Confira a internet.")); };
    document.head.appendChild(s);
  });
  return pdfjsPronto;
}
// Junta os pedaços de texto do PDF em linhas, pela altura na página
async function linhasDoPdf(buffer, senha) {
  const lib = await carregarPdfjs();
  const doc = await lib.getDocument({ data: buffer, password: senha || undefined }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pag = await doc.getPage(p);
    const tc = await pag.getTextContent();
    const grupos = [];
    tc.items.forEach((it) => {
      if (!it.str || !it.str.trim()) return;
      const y = it.transform[5], x = it.transform[4];
      let g = grupos.find((gg) => Math.abs(gg.y - y) <= 2.5);
      if (!g) { g = { y, itens: [] }; grupos.push(g); }
      g.itens.push({ x, s: it.str });
    });
    grupos.sort((a, b) => b.y - a.y).forEach((g) => linhas.push(g.itens.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join(" ").replace(/\s+/g, " ").trim()));
  }
  return linhas;
}

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
// O sinal de menos só conta colado no valor ("−R$ 50,00", "-50,00"); "Loja - R$ 50,00" é só separador
const RE_VALOR = /([-−–])?(?:R\$\s?)?([-−–])?(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)/g;
const valorBR = (s) => Number(String(s).replace(/\./g, "").replace(",", "."));
// Pagamento da própria fatura: não entra na conta. Estorno e crédito entram negativos (abatem a compra).
const RE_PAGAMENTO = /pagamento|pagto|pgto|deb\.?\s?aut|d[eé]bito autom/i;
const RE_CREDITO = /estorno|reembolso|devolu|cashback|cr[eé]dito/i;

// Lê uma linha "15/09 LOJA 03/10 123,45", "15 SET Loja - Parcela 3/10 R$ 123,45" ou "15 de set. 2026 Loja (Parcela 03 de 10) R$ 123,45".
// Vale o primeiro valor da linha: o que vem depois é de outra coluna do PDF (limites, taxas...)
function lerLinhaFatura(t, mesFatura) {
  let s = t.trim(), dia, mes, ano;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+/);
  if (m) { dia = +m[1]; mes = +m[2]; ano = m[3] ? +m[3] : null; }
  else {
    m = s.match(/^(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s+(?:de\s+)?(\d{4}))?\s+/i);
    if (m) { dia = +m[1]; mes = MESES_ABREV.indexOf(m[2].toLowerCase()) + 1; ano = m[3] ? +m[3] : null; }
  }
  if (!m || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  s = s.slice(m[0].length);
  const valores = [...s.matchAll(RE_VALOR)];
  if (!valores.length) return null;
  let v = valores[0];
  // Compra em dólar: "10,00 52,30" (US$ e R$ lado a lado) vale o segundo
  if (valores[1] && /^\s*$/.test(s.slice(v.index + v[0].length, valores[1].index))) v = valores[1];
  const valor = valorBR(v[3]);
  const depois = s.slice(v.index + v[0].length);
  const antes = s.slice(0, v.index);
  const negativo = !!(v[1] || v[2]) || /^\s*-(\s|$)/.test(depois) || /\+\s?(R\$\s?)?$/.test(antes);
  s = antes.replace(/[+\-–]?\s*R\$\s*$/, "");
  // Parcela
  let k = 0, n = 0;
  const pp = [/\(?\s*parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*\)?/i, /\(\s*(\d{1,2})\s*de\s*(\d{1,2})\s*\)/i, /(?<=^|[\sA-Za-z*])(\d{2})\/(\d{2})(?=\s|$)/, /(?:^|\s)(\d{1})\/(\d{1,2})(?=\s|$)/];
  for (const re of pp) {
    const x = s.match(re);
    if (x && +x[1] >= 1 && +x[2] >= 2 && +x[1] <= +x[2] && +x[2] <= 99) { k = +x[1]; n = +x[2]; s = s.replace(x[0], " "); break; }
  }
  const desc = s.replace(/[•*]{2,}\s*\d{4}/g, " ").replace(/\b(?:USD|US\$)\s?[\d.,]+/gi, " ").replace(/\s[-–]\s*$/, "").replace(/\s+/g, " ").replace(/^[\s\-–:]+|[\s\-–:]+$/g, "").trim();
  if (!desc || !valor) return null;
  if (!ano) { const [fa, fm] = mesFatura.split("-").map(Number); ano = mes > fm ? fa - 1 : fa; }
  if (ano < 100) ano += 2000;
  const pagamento = RE_PAGAMENTO.test(desc);
  const credito = pagamento || negativo || RE_CREDITO.test(desc);
  return { data: `${ano}-${pad(mes)}-${pad(dia)}`, desc, k: n ? k : 1, n: n || 1, valor, credito, pagamento };
}
// Junta as linhas da fatura. "Compras de Diego O P Moreira R$ 1.019,38" (cartão adicional do Nubank)
// marca as compras seguintes com o nome da pessoa, até o próximo título.
function itensDasLinhas(linhas, mesFatura) {
  let dono = "";
  const r = [];
  linhas.forEach((l) => {
    const tit = l.match(/^([A-Za-zÀ-ú .']+?)\s+[-−]?R\$\s?[\d.]+,\d{2}$/);
    if (tit) { const c = tit[1].match(/^compras de\s+(\S+)/i); dono = c ? c[1][0].toUpperCase() + c[1].slice(1).toLowerCase() : ""; return; }
    const x = lerLinhaFatura(l, mesFatura);
    if (x) { if (dono) x.donoSugerido = dono; r.push(x); }
  });
  return r;
}

function lerCsv(texto) {
  const sep = (texto.split(/\r?\n/)[0].match(/;/g) || []).length > (texto.split(/\r?\n/)[0].match(/,/g) || []).length ? ";" : ",";
  const linhas = [];
  let cel = "", lin = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) { if (ch === '"' && texto[i + 1] === '"') { cel += '"'; i++; } else if (ch === '"') aspas = false; else cel += ch; continue; }
    if (ch === '"') aspas = true;
    else if (ch === sep) { lin.push(cel); cel = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && texto[i + 1] === "\n") i++; lin.push(cel); linhas.push(lin); lin = []; cel = ""; }
    else cel += ch;
  }
  if (cel || lin.length) { lin.push(cel); linhas.push(lin); }
  return linhas.filter((l) => l.some((c) => c.trim()));
}
function itensDoCsv(texto, mesFatura) {
  const linhas = lerCsv(texto.replace(/^﻿/, ""));
  if (!linhas.length) return [];
  const cab = linhas[0].map(semAcento);
  const col = (re) => cab.findIndex((c) => re.test(c));
  let iData = col(/^(date|data)/), iDesc = col(/title|descri|estabelec|lancamento|historico|nome/), iVal = col(/amount|valor/);
  const temCab = iData >= 0 && iVal >= 0;
  if (!temCab) { iData = 0; iDesc = 1; iVal = linhas[0].length - 1; }
  const num = (s) => { s = String(s).replace(/R\$|\s/g, ""); if (s.includes(",") && s.includes(".")) return s.lastIndexOf(",") > s.lastIndexOf(".") ? valorBR(s) : Number(s.replace(/,/g, "")); if (s.includes(",")) return valorBR(s); return Number(s); };
  return linhas.slice(temCab ? 1 : 0).map((l) => {
    const dt = String(l[iData] || "").trim();
    let data = null, m;
    if ((m = dt.match(/^(\d{4})-(\d{2})-(\d{2})/))) data = `${m[1]}-${m[2]}-${m[3]}`;
    else if ((m = dt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) data = `${m[3].length === 2 ? "20" + m[3] : m[3]}-${pad(m[2])}-${pad(m[1])}`;
    const v = num(l[iVal]);
    if (!data || !isFinite(v) || !v) return null;
    const x = lerLinhaFatura(`${data.slice(8)}/${data.slice(5, 7)}/${data.slice(0, 4)} ${String(l[iDesc] || "").trim()} ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, mesFatura);
    if (!x) return null;
    // No CSV do Nubank, pagamento vem negativo; em outros bancos, a compra vem negativa
    x.pagamento = RE_PAGAMENTO.test(x.desc);
    x.credito = x.pagamento || RE_CREDITO.test(x.desc) || (v < 0 && linhas.slice(1).filter((y) => num(y[iVal]) > 0).length > linhas.length / 2);
    return x;
  }).filter(Boolean);
}

function infoDaFatura(texto) {
  const t = texto.replace(/\s+/g, " ");
  let mes = "";
  const v = t.match(/vencimento[^0-9]{0,40}(\d{1,2})(?:\/(\d{1,2})\/(\d{2,4})|\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s+(?:de\s+)?(\d{4}))/i);
  if (v) {
    const mm = v[2] ? +v[2] : MESES_ABREV.indexOf(v[4].toLowerCase()) + 1;
    let aa = +(v[3] || v[5]); if (aa < 100) aa += 2000;
    if (mm >= 1 && mm <= 12) mes = `${aa}-${pad(mm)}`;
  }
  if (!mes) {
    const v2 = t.match(/vencimento[\s\S]{0,80}?(\d{2})\/(\d{2})\/(\d{4})/i);
    if (v2 && +v2[2] >= 1 && +v2[2] <= 12) mes = `${v2[3]}-${v2[2]}`;
  }
  const tot = t.match(/total (?:da fatura|a pagar|desta fatura|da sua fatura)[^0-9]{0,40}(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  const baixo = semAcento(t);
  const cartao = P.cartoes.find((c) => new RegExp(`\\b${semAcento(c.nome).replace(/[^a-z0-9 ]/g, "")}\\b`).test(baixo));
  return { mes, total: tot ? valorBR(tot[1]) : 0, cartao: cartao ? String(cartao.id) : "" };
}

const baseDesc = (s) => semAcento(s).replace(/[^a-z0-9]+/g, " ").trim();
function chaveCompra(x, cartao, mes, ordem) {
  if (x.n > 1) return `p|${cartao}|${baseDesc(x.desc)}|${(x.credito ? -x.valor : x.valor).toFixed(2)}|${x.n}|${somaMes(mes, -(x.k - 1))}`;
  return `a|${cartao}|${mes}|${x.data || ""}|${baseDesc(x.desc)}|${(x.credito ? -x.valor : x.valor).toFixed(2)}|${ordem}`;
}

function abrirImportarFatura() {
  const hoje = mesHojePF();
  const st = { itens: [], mes: hoje, cartao: P.cartoes[0] ? String(P.cartoes[0].id) : "", total: 0, arquivo: null, buffer: null, texto: "", csv: false };
  const d = janela();
  d.classList.add("janela-larga", "pf-janela");
  d.addEventListener("close", () => d.classList.remove("janela-larga", "pf-janela"), { once: true });
  d.innerHTML = `<div class="janela-topo"><h3>Importar fatura do cartão</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div>
    <div class="janela-corpo">
      ${P.cartoes.length ? "" : `<p class="aviso-falta">Cadastre um cartão antes (botão Cartão, em Parcelas). Dá para importar assim mesmo, sem cartão.</p>`}
      <div class="form-grade">
        <div class="inteiro"><label for="imp-arq">Arquivo da fatura (PDF ou CSV)</label><input class="campo arquivo" id="imp-arq" type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv">
          <small class="ajuda">O arquivo é lido aqui no seu navegador e não é enviado pra lugar nenhum. Só as compras que você confirmar são salvas.</small></div>
        <div id="imp-senha-caixa" class="inteiro" hidden><label for="imp-senha">Este PDF tem senha</label>
          <div class="barra" style="margin:0"><input class="campo" id="imp-senha" type="password" autocomplete="off" style="flex:1"><button class="btn" type="button" id="imp-abrir">Abrir</button></div>
          <small class="ajuda">Digite a senha do PDF (no Bradesco costuma ser parte do CPF). Ela não é guardada.</small></div>
        <div><label for="imp-cartao">Cartão</label><select class="campo" style="width:100%" id="imp-cartao"><option value="">Sem cartão</option>${P.cartoes.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")}</select></div>
        <div><label for="imp-mes">Fatura que vence em</label><input class="campo" id="imp-mes" type="month" value="${hoje}"></div>
      </div>
      <div id="imp-rev"></div>
    </div>
    <div class="janela-pe"><button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn primario" id="imp-salvar" disabled>Salvar compras</button></div>`;
  $$("[data-fechar]", d).forEach((b) => b.onclick = () => d.close());
  $("#imp-cartao", d).value = st.cartao;
  d.showModal();

  // "dividido", "todos"... não são pessoas: ficam fora da lista (pra dividir, use o botão Dividir)
  const pessoas = () => pessoasConhecidas().filter((p) => !/^(dividid[oa]s?|todos|todo mundo|geral|grupo)$/i.test(semAcento(p)));
  const donoAnterior = (x) => {
    const b = baseDesc(x.desc);
    const igual = P.compras.filter((c) => baseDesc(c.descricao) === b && (!st.cartao || String(c.cartao_id) === st.cartao));
    return igual.length ? nomePessoa(igual[igual.length - 1].dono || "") : "";
  };
  const prepararItens = (lista) => {
    // Várias parcelas da mesma compra cobradas juntas (ex.: 1/5 a 5/5 no mesmo dia) viram lançamentos à vista
    const grupos = {};
    lista.forEach((x) => { if (x.n > 1) { const g = `${x.data}|${baseDesc(x.desc)}|${x.n}`; (grupos[g] = grupos[g] || new Set()).add(x.k); } });
    lista.forEach((x) => {
      const g = grupos[`${x.data}|${baseDesc(x.desc)}|${x.n}`];
      if (x.n > 1 && g && g.size >= 3 && Math.max(...g) === x.n) { x.desc = `${x.desc} (parcela ${x.k}/${x.n} cobrada junto)`; x.k = 1; x.n = 1; }
    });
    const ordens = {};
    st.itens = lista.map((x) => {
      const o = `${x.data}|${baseDesc(x.desc)}|${x.valor}`;
      ordens[o] = (ordens[o] || 0) + 1;
      return { ...x, ordem: ordens[o], incluir: !x.pagamento, dono: "" };
    });
    recalcular(true);
  };
  const recalcular = (novosDonos) => {
    st.itens.forEach((x) => {
      x.chave = chaveCompra(x, st.cartao, st.mes, x.ordem);
      x.existe = P.compras.find((c) => c.chave === x.chave) || null;
    });
    // Gasto que você lançou na hora (+ Gasto): a linha da fatura toma o lugar dele, sem duplicar
    const usados = new Set();
    st.itens.forEach((x) => {
      x.rapido = null;
      if (x.existe) return;
      const v = x.credito ? -x.valor : x.valor;
      const c = P.compras.find((r) => r.origem === "rapido" && !usados.has(r.id) && (!r.cartao_id || String(r.cartao_id) === st.cartao)
        && Math.abs(n2(r.valor_parcela) - v) < 0.015 && Number(r.parcelas) === x.n && (!r.data_compra || !x.data || Math.abs(diasEntre(r.data_compra, x.data)) <= 5));
      if (c) { usados.add(c.id); x.rapido = c; }
    });
    st.itens.forEach((x) => {
      if (novosDonos) {
        // Já salva vem com o nome que já tinha
        x.dono = x.existe ? nomePessoa(x.existe.dono || "") : x.rapido ? nomePessoa(x.rapido.dono || "") : (x.donoSugerido || donoAnterior(x));
        // Já salva: fica de fora, a não ser que você mude alguma coisa nela
        if (x.existe && !x.pagamento) x.incluir = false;
      }
    });
    pintar();
  };
  const pintar = () => {
    const rev = $("#imp-rev", d);
    if (!st.itens.length) { rev.innerHTML = st.arquivo ? `<p class="aviso-falta">Não achei compras neste arquivo. Se for PDF escaneado (imagem), baixe a fatura em CSV no app do banco ou lance as parcelas à mão.</p>` : ""; $("#imp-salvar", d).disabled = true; return; }
    const inc = st.itens.filter((x) => x.incluir);
    const soma = inc.reduce((s, x) => s + (x.credito ? -x.valor : x.valor), 0);
    const novos = st.itens.map((x, i) => [x, i]).filter(([x]) => !x.existe);
    const salvas = st.itens.map((x, i) => [x, i]).filter(([x]) => x.existe);
    const linha = ([x, i]) => {
      const partes = partesDe({ dono: x.dono });
      const cada = partes.length > 1 ? `<small class="pf-imp-cada">${partes.length} partes de ${real(x.valor / partes.length)}: ${partes.map((p) => (p.eu ? "você" : esc(p.nome))).join(", ")}</small>` : "";
      return `<tr class="${x.credito ? "pf-credito" : ""} ${x.existe ? "pf-existe" : ""}">
        <td><input type="checkbox" data-inc="${i}" ${x.incluir ? "checked" : ""} aria-label="Incluir"></td>
        <td>${dataBR(x.data)}</td>
        <td>${esc(x.desc)}${x.pagamento ? ` <span class="pilula p-parada">pagamento da fatura</span>` : x.credito ? ` <span class="pilula p-pago">estorno ou crédito</span>` : ""}${x.rapido ? ` <span class="pilula p-conversando">você lançou: ${esc(x.rapido.descricao)}</span>` : ""}</td>
        <td>${x.n > 1 ? `${x.k}/${x.n}` : "à vista"}</td>
        <td>${x.credito ? "−" : ""}${real(x.valor)}</td>
        <td><div class="pf-imp-dono"><input class="campo" data-dono="${i}" list="imp-pessoas" value="${esc(x.dono)}" placeholder="Eu" style="min-width:120px"><button type="button" class="btn pequeno" data-dividir="${i}">Dividir</button></div>${cada}</td></tr>`;
    };
    const tabela = (lista) => `<div class="tabela-caixa pf-imp-tabela"><table><thead><tr><th></th><th>Data</th><th>Compra</th><th>Parcela</th><th>Valor</th><th>De quem (vazio = sua)</th></tr></thead><tbody>${lista.map(linha).join("")}</tbody></table></div>`;
    rev.innerHTML = `
      <div class="pf-imp-resumo">
        <span><b>${st.itens.length}</b> lançamentos lidos</span>
        <span><b>${real(soma)}</b> marcados${st.total ? ` (a fatura diz ${real(st.total)}${Math.abs(st.total - soma) > 1 ? ", confira" : ""})` : ""}</span>
        <span><b>${novos.length}</b> novos, ${salvas.length} já estavam salvos</span>
      </div>
      <datalist id="imp-pessoas">${pessoas().map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
      ${novos.length ? `
        <div class="barra" style="margin:8px 0">
          <h3 class="pf-imp-titulo">Novas, ainda não salvas <span class="sub">${novos.length}</span></h3>
          <label class="check"><input type="checkbox" id="imp-todos" ${novos.every(([x]) => x.incluir) ? "checked" : ""}> Todas</label>
          <span class="espaco"></span>
          <input class="campo" id="imp-lote" list="imp-pessoas" placeholder="Nome da pessoa" style="max-width:180px">
          <button class="btn" type="button" id="imp-aplicar">Pôr nas marcadas sem nome</button>
        </div>
        ${tabela(novos)}`
      : `<p class="pf-imp-ok">Tudo desta fatura já está salvo. Se quiser conferir de quem é cada compra, abra a lista abaixo.</p>`}
      ${salvas.length ? `<details class="pf-imp-salvas" id="imp-salvas" ${st.verSalvas ? "open" : ""}>
        <summary><b>Já salvas</b> <span class="sub">${salvas.length}: abra pra conferir ou trocar de quem é</span></summary>
        ${tabela(salvas)}</details>` : ""}
      <p class="sub">Compra dividida: toque em <b>Dividir</b> e marque quem participou, ou escreva os nomes separados por vírgula (ex.: Eu, Diego, Emillie). Cada um fica com uma parte igual. Parcelado é salvo uma vez com todas as parcelas e não duplica no mês que vem. Pagamentos da fatura já vêm desmarcados; estornos entram negativos e abatem a compra.</p>`;
    $("#imp-salvar", d).disabled = !inc.length;
    $$("[data-inc]", rev).forEach((c) => c.onchange = () => { st.itens[c.dataset.inc].incluir = c.checked; pintar(); });
    $$("[data-dono]", rev).forEach((c) => {
      c.oninput = () => { st.itens[c.dataset.dono].dono = c.value; };
      // Trocou o nome de uma já salva: ela entra pra salvar de novo
      c.onchange = () => { const x = st.itens[c.dataset.dono]; if (x.existe) x.incluir = true; pintar(); };
    });
    $$("[data-dividir]", rev).forEach((b) => b.onclick = () => escolherDivisao(st.itens[b.dataset.dividir]));
    const salvasEl = $("#imp-salvas", rev);
    if (salvasEl) salvasEl.ontoggle = () => { st.verSalvas = salvasEl.open; };
    const todos = $("#imp-todos", rev);
    if (todos) todos.onchange = (e) => { novos.forEach(([x]) => { x.incluir = e.target.checked; }); pintar(); };
    const aplicar = $("#imp-aplicar", rev);
    if (aplicar) aplicar.onclick = () => {
      const nome = nomePessoa($("#imp-lote", rev).value);
      // Só nas novas marcadas que ainda não têm nome; para trocar uma, edite na própria linha
      if (!nome) { avisar("Digite o nome da pessoa.", true); return; }
      novos.forEach(([x]) => { if (x.incluir && !x.dono) x.dono = nome; });
      pintar();
    };
  };
  // Dividir uma compra: marca quem participou (você já vem marcado) e cada um fica com uma parte igual
  const escolherDivisao = (x) => {
    const naoEhNome = (n) => /^(dividid[oa]s?|todos|todo mundo|geral|grupo)$/i.test(semAcento(n));
    const atuais = partesDe({ dono: x.dono }).filter((p) => p.eu || !naoEhNome(p.nome));
    const temEu = atuais.some((p) => p.eu) || !nomePessoa(x.dono);
    const marcados = new Set(atuais.filter((p) => !p.eu).map((p) => chavePessoa(p.nome)));
    const lista = [...new Set([...pessoas(), ...atuais.filter((p) => !p.eu).map((p) => p.nome)])];
    const w = document.createElement("dialog");
    w.className = "pf-dividir";
    w.innerHTML = `<div class="janela-topo"><h3>Dividir ${esc(x.desc)}</h3></div>
      <div class="janela-corpo">
        <p class="sub" style="margin-top:0">${real(x.valor)}. Marque quem entra na divisão.</p>
        <div class="pf-dividir-lista">
          <label class="check"><input type="checkbox" data-quem="Eu" ${temEu ? "checked" : ""}> Eu</label>
          ${lista.map((n) => `<label class="check"><input type="checkbox" data-quem="${esc(n)}" ${marcados.has(chavePessoa(n)) ? "checked" : ""}> ${esc(n)}</label>`).join("")}
        </div>
        <label for="div-outros" style="display:block;margin-top:10px">Mais alguém (separe por vírgula)</label>
        <input class="campo" id="div-outros" style="width:100%" placeholder="Ex.: Ana, Bruno">
        <p class="pf-dividir-conta" id="div-conta"></p>
      </div>
      <div class="janela-pe"><button type="button" class="btn" data-n>Cancelar</button><button type="button" class="btn primario" data-s>Dividir</button></div>`;
    document.body.appendChild(w);
    const nomes = () => [...$$("[data-quem]", w).filter((c) => c.checked).map((c) => c.dataset.quem), ...$("#div-outros", w).value.split(/\s*[,;]\s*/).map(nomePessoa).filter(Boolean)];
    const conta = () => { const n = nomes().length; $("#div-conta", w).textContent = n > 1 ? `${n} pessoas: ${real(x.valor / n)} pra cada.` : "Marque pelo menos duas pessoas."; };
    w.oninput = conta; w.onchange = conta; conta();
    const fim = () => { w.close(); w.remove(); };
    $("[data-n]", w).onclick = fim;
    $("[data-s]", w).onclick = () => {
      const l = nomes();
      if (l.length < 2) { avisar("Marque pelo menos duas pessoas.", true); return; }
      x.dono = l.join(", ");
      if (x.existe) x.incluir = true;
      fim(); pintar();
    };
    w.addEventListener("cancel", (e) => { e.preventDefault(); fim(); });
    w.showModal();
  };

  const processar = async (senha) => {
    const arq = st.arquivo;
    const rev = $("#imp-rev", d);
    rev.innerHTML = `<p class="vazio">Lendo a fatura...</p>`;
    try {
      let lista;
      if (/\.pdf$/i.test(arq.name) || arq.type === "application/pdf") {
        if (!st.buffer) st.buffer = await arq.arrayBuffer();
        let linhas;
        try { linhas = await linhasDoPdf(st.buffer.slice(0), senha); }
        catch (e) {
          if (e && e.name === "PasswordException") {
            $("#imp-senha-caixa", d).hidden = false;
            rev.innerHTML = senha ? `<p class="aviso-falta">Senha errada. Tente de novo.</p>` : "";
            $("#imp-senha", d).focus();
            return;
          }
          throw e;
        }
        $("#imp-senha-caixa", d).hidden = true;
        st.texto = linhas.join("\n");
        const info = infoDaFatura(st.texto);
        if (info.mes) { st.mes = info.mes; $("#imp-mes", d).value = info.mes; }
        if (info.cartao) { st.cartao = info.cartao; $("#imp-cartao", d).value = info.cartao; }
        st.total = info.total;
        st.linhas = linhas;
        lista = itensDasLinhas(linhas, st.mes);
      } else {
        st.csv = true;
        st.texto = await arq.text();
        const info = infoDaFatura(arq.name + " " + st.texto.slice(0, 500));
        if (info.cartao) { st.cartao = info.cartao; $("#imp-cartao", d).value = info.cartao; }
        lista = itensDoCsv(st.texto, st.mes);
      }
      prepararItens(lista);
    } catch (e) {
      console.error(e);
      rev.innerHTML = `<p class="aviso-falta">Não consegui ler este arquivo (${esc(e.message || e)}). Tente o CSV da fatura, que quase todo banco oferece.</p>`;
    }
  };
  $("#imp-arq", d).onchange = (e) => { st.arquivo = e.target.files[0] || null; st.buffer = null; if (st.arquivo) processar(); };
  $("#imp-abrir", d).onclick = () => processar($("#imp-senha", d).value);
  $("#imp-senha", d).onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); processar(e.target.value); } };
  $("#imp-cartao", d).onchange = (e) => { st.cartao = e.target.value; recalcular(false); };
  $("#imp-mes", d).onchange = (e) => {
    st.mes = e.target.value || hoje;
    // A data das compras sem ano depende do mês da fatura: relê
    if (st.linhas) { const donos = new Map(st.itens.map((x) => [x.desc + x.valor, x.dono])); prepararItens(itensDasLinhas(st.linhas, st.mes)); st.itens.forEach((x) => { const dn = donos.get(x.desc + x.valor); if (dn != null) x.dono = dn; }); pintar(); }
    else if (st.csv) prepararItens(itensDoCsv(st.texto, st.mes));
    else recalcular(false);
  };
  $("#imp-salvar", d).onclick = async () => {
    const btn = $("#imp-salvar", d);
    const linhas = st.itens.filter((x) => x.incluir).map((x) => ({
      cartao_id: st.cartao ? Number(st.cartao) : null,
      descricao: x.desc,
      valor_parcela: r2(x.credito ? -x.valor : x.valor),
      parcelas: x.n,
      primeiro_mes: somaMes(st.mes, -(x.k - 1)) + "-01",
      data_compra: x.data,
      dono: nomePessoa(x.dono) || null,
      origem: "fatura",
      chave: x.chave
    }));
    btn.disabled = true; btn.textContent = "Salvando...";
    const { error } = await db.from("pf_compras").upsert(linhas, { onConflict: "chave" });
    btn.disabled = false; btn.textContent = "Salvar compras";
    if (error) { avisar(traduzErro(error), true); return; }
    const trocados = st.itens.filter((x) => x.incluir && x.rapido).map((x) => x.rapido.id);
    if (trocados.length) await db.from("pf_compras").delete().in("id", trocados);
    d.close();
    avisar(`${linhas.length} compras salvas${trocados.length ? `, ${trocados.length} que você lançou na hora foram reconhecidas` : ""}.`);
    await recarregarPF();
  };
}

/* =============================================================
   + GASTO: lançar uma compra na hora, pelo celular
   Vai para a fatura certa pelo dia de fechamento do cartão. Quando a
   fatura for importada, a linha do banco toma o lugar deste lançamento.
   ============================================================= */
function mesFaturaDaCompra(cartao, iso) {
  const d = deISO(iso || hojeISO());
  const k = mesDe(isoLocal(d));
  if (!cartao || !cartao.vence_dia) return k;
  const vence = Number(cartao.vence_dia);
  let fecha = Number(cartao.fecha_dia) || vence - 7;
  if (fecha <= 0) fecha += 30;
  const mesFecha = d.getDate() < fecha ? k : somaMes(k, 1);
  return vence > fecha ? mesFecha : somaMes(mesFecha, 1);
}
async function abrirGastoRapido() {
  await carregarPF();
  let ultimo = "";
  try { ultimo = localStorage.getItem("pf-ultimo-cartao") || ""; } catch (_) {}
  if (!P.cartoes.some((c) => String(c.id) === ultimo)) ultimo = P.cartoes[0] ? String(P.cartoes[0].id) : "";
  const st = { cartao: ultimo, n: 1 };
  const recentes = [...new Set(P.compras.filter((c) => c.origem === "rapido").map((c) => c.descricao))].slice(-30);
  const d = abrirJanelaSimples("Lançar um gasto", `
    <div class="pf-rapido">
      <label class="pf-rapido-valor"><span>R$</span><input id="gr-valor" type="text" inputmode="decimal" placeholder="0,00" autocomplete="off"></label>
      <input class="campo" id="gr-onde" list="gr-lista" placeholder="Onde? (ex.: iFood, mercado, Uber)" autocomplete="off">
      <datalist id="gr-lista">${recentes.map((r) => `<option value="${esc(r)}">`).join("")}</datalist>
      <div class="pf-rapido-rot">Cartão</div>
      <div class="pf-rapido-chips" id="gr-cartoes">${P.cartoes.map((c) => `<button type="button" class="chip-grande" data-gr-cartao="${c.id}" aria-pressed="${String(c.id) === st.cartao}">${esc(c.nome)}</button>`).join("")}<button type="button" class="chip-grande" data-gr-cartao="" aria-pressed="${!st.cartao}">Pix/débito</button></div>
      <div class="pf-rapido-rot">Tipo</div>
      <div class="pf-rapido-chips" id="gr-tipo">${[["minha", "Minha"], ["outra", "De outra pessoa"], ["dividida", "Dividida"]].map(([k, t]) => `<button type="button" class="chip-grande" data-gr-tipo="${k}" aria-pressed="${k === "minha"}">${t}</button>`).join("")}</div>
      <div class="pf-rapido-rot">Parcelas</div>
      <div class="pf-rapido-chips" id="gr-parc">${[1, 2, 3, 4, 5, 6, 10, 12].map((n) => `<button type="button" class="chip-grande" data-gr-n="${n}" aria-pressed="${n === 1}">${n === 1 ? "À vista" : n + "x"}</button>`).join("")}</div>
      <div class="form-grade" style="margin-top:10px">
        <div><label for="gr-dono">Com quem / de quem</label><input class="campo" id="gr-dono" list="gr-pessoas" placeholder="ex.: Diego" autocomplete="off" disabled><datalist id="gr-pessoas">${pessoasConhecidas().map((p) => `<option value="${esc(p)}">`).join("")}</datalist></div>
        <div><label for="gr-data">Dia</label><input class="campo" id="gr-data" type="date" value="${hojeISO()}"></div>
      </div>
      <p class="sub" id="gr-info" style="margin:10px 0 0"></p>
    </div>`, `<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn primario" id="gr-salvar">Lançar</button>`);
  d.classList.add("pf-janela-rapida");
  d.addEventListener("close", () => d.classList.remove("pf-janela-rapida"), { once: true });
  const valor = () => { const t = $("#gr-valor", d).value.replace(/\s|R\$/g, ""); return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t) || 0; };
  const cartao = () => P.cartoes.find((c) => String(c.id) === st.cartao) || null;
  const info = () => {
    const v = valor(), c = cartao(), k = mesFaturaDaCompra(c, $("#gr-data", d).value);
    const dono = donoDoTipo(st.tipo, $("#gr-dono", d).value), partes = partesDe({ dono });
    const div = partes.length > 1 && v ? ` Dividida em ${partes.length}: ${real(v / partes.length)} pra cada.` : "";
    $("#gr-info", d).innerHTML = (c ? `Cai na fatura de <b>${nomeMes(k)}</b> do ${esc(c.nome)}${st.n > 1 && v ? `: ${st.n}x de ${real(v / st.n)}, até ${nomeMes(somaMes(k, st.n - 1), true)}` : ""}.` : "Pago na hora (Pix ou débito): entra no dia a dia deste mês.") + div;
  };
  $$("[data-gr-cartao]", d).forEach((b) => b.onclick = () => { st.cartao = b.dataset.grCartao; $$("[data-gr-cartao]", d).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); info(); });
  $$("[data-gr-n]", d).forEach((b) => b.onclick = () => { st.n = Number(b.dataset.grN); $$("[data-gr-n]", d).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); info(); });
  st.tipo = "minha";
  $$("[data-gr-tipo]", d).forEach((b) => b.onclick = () => {
    st.tipo = b.dataset.grTipo;
    $$("[data-gr-tipo]", d).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const nome = $("#gr-dono", d); nome.disabled = st.tipo === "minha"; if (!nome.disabled) nome.focus();
    info();
  });
  ["#gr-valor", "#gr-data", "#gr-dono"].forEach((q) => $(q, d).addEventListener("input", info));
  info();
  $("#gr-valor", d).focus();
  $("#gr-salvar", d).onclick = async () => {
    const v = valor(), onde = $("#gr-onde", d).value.trim();
    if (!v) { avisar("Digite o valor.", true); $("#gr-valor", d).focus(); return; }
    if (!onde) { avisar("Diga onde foi.", true); $("#gr-onde", d).focus(); return; }
    if (st.tipo !== "minha" && !nomePessoa($("#gr-dono", d).value)) { avisar(st.tipo === "dividida" ? "Diga com quem você dividiu." : "Diga de quem é.", true); $("#gr-dono", d).focus(); return; }
    const c = cartao(), data = $("#gr-data", d).value || hojeISO();
    const btn = $("#gr-salvar", d); btn.disabled = true; btn.textContent = "Lançando...";
    const k = mesFaturaDaCompra(c, data);
    const { error } = await db.from("pf_compras").insert({ cartao_id: c ? c.id : null, descricao: onde, valor_parcela: r2(v / st.n), parcelas: st.n, primeiro_mes: k + "-01", data_compra: data, dono: donoDoTipo(st.tipo, $("#gr-dono", d).value), origem: "rapido" });
    btn.disabled = false; btn.textContent = "Lançar";
    if (error) { avisar(traduzErro(error), true); return; }
    try { localStorage.setItem("pf-ultimo-cartao", st.cartao); } catch (_) {}
    d.close();
    avisar(`Lançado: ${real(v)} ${c ? `na fatura de ${nomeMes(k, true)}` : "no dia a dia"}.`);
    await carregarPF(true);
    if (abaAtual === "financeiro" || abaAtual === "inicio") desenhar();
  };
}
/* ---------- Bot do Telegram (Edge Function "gastos") ---------- */
const COFRE = "https://supabase.com/dashboard/project/jlehawiwklvyvrzbfuiu/functions/secrets";
async function chamarGastos(acao) {
  const { data, error } = await db.functions.invoke("gastos", { body: { acao } });
  if (error) {
    let msg = error.message || "";
    try { const j = await error.context.json(); msg = j.erro || msg; } catch (_) {}
    return { erro: /not found|404|failed to send/i.test(msg) ? "O ajudante gastos ainda não foi publicado no Supabase." : msg };
  }
  return data || {};
}
async function abrirTelegram() {
  const d = abrirJanelaSimples("Lançar gastos pelo Telegram", `<div id="tg-corpo"><p class="vazio">Conferindo o bot...</p></div>`, `<button type="button" class="btn" data-fechar>Fechar</button>`);
  $$("[data-fechar]", d).forEach((b) => b.onclick = () => d.close());
  const pintar = (st) => {
    const passo = (feito, n, t, corpo) => `<li class="${feito ? "feito" : ""}"><b>${feito ? ic("check") : n}</b><div><strong>${t}</strong>${corpo}</div></li>`;
    const temToken = st && !st.semToken && !(st.erro && /token/i.test(st.erro)) && !(st.erro && /publicado/.test(st.erro));
    $("#tg-corpo", d).innerHTML = `
      ${st && st.erro && !/TELEGRAM_TOKEN|publicado/.test(st.erro) ? `<p class="aviso-falta">${esc(st.erro)}</p>` : ""}
      <ol class="tg-passos">
        ${passo(temToken, 1, "Criar o bot", `<p>No Telegram, abra o <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a>, mande <code>/newbot</code>, dê um nome (ex.: Gastos Ryan) e um usuário terminando em <i>bot</i>. Ele te dá um <b>token</b>.</p>`)}
        ${passo(temToken, 2, "Guardar o token no cofre do Supabase", `<p>Em <a href="${COFRE}" target="_blank" rel="noopener">Edge Functions &gt; Secrets</a>, clique em <i>Add new secret</i>: nome <code>TELEGRAM_TOKEN</code>, valor o token. Ninguém mais vê esse valor, nem eu.</p><p>Depois, em <a href="https://supabase.com/dashboard/project/jlehawiwklvyvrzbfuiu/functions/gastos/details" target="_blank" rel="noopener">Edge Functions &gt; gastos &gt; Settings</a>, desligue <i>Verify JWT</i> e salve: o Telegram não tem o seu login, então o bot confere sozinho que a mensagem é sua.</p>`)}
        ${passo(st && st.ia, 3, "Ler foto da nota (opcional)", `<p>${st && st.ia ? `Ligado: as fotos são lidas pelo ${st.ia === "gemini" ? "Gemini" : "Claude"}.` : `Para o bot ler fotos, guarde no mesmo cofre <code>GEMINI_API_KEY</code> (grátis, pegue em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>) ou <code>ANTHROPIC_API_KEY</code> (pago, centavos por foto). Sem isso, o bot funciona só por texto.`}</p>`)}
        ${passo(st && st.conectado, 4, "Conectar o seu Telegram", st && st.conectado ? `<p>Conectado ao bot <b>@${esc(st.bot || "")}</b>. Mande <code>/ajuda</code> pra ele ver os exemplos.</p><button class="btn" type="button" id="tg-desconectar">Desconectar</button>`
          : `<p>Toque no botão, abra o Telegram e aperte <b>Começar</b>. Só o seu chat fica autorizado.</p><button class="btn primario" type="button" id="tg-conectar" ${temToken ? "" : "disabled"}>${ic("enviar")}Conectar meu Telegram</button><div id="tg-link"></div>`)}
      </ol>
      <p class="sub">Exemplos: <code>45,90 ifood nubank</code> · <code>300 tênis bradesco 3x</code> · <code>30 uber nubank diego</code> · foto da nota com a legenda <code>diego</code>.</p>`;
    const con = $("#tg-conectar", d);
    if (con) con.onclick = async () => {
      con.disabled = true; con.textContent = "Ligando o bot...";
      const r = await chamarGastos("conectar");
      if (r.erro) { avisar(r.erro, true); pintar(r); return; }
      $("#tg-link", d).innerHTML = `<a class="btn primario" href="${esc(r.link)}" target="_blank" rel="noopener" style="margin-top:8px">${ic("link")}Abrir @${esc(r.bot)} no Telegram</a><p class="sub">Depois de apertar Começar no Telegram, volte aqui e toque em Conferir.</p><button class="btn" type="button" id="tg-conferir">Conferir</button>`;
      con.remove();
      $("#tg-conferir", d).onclick = async () => pintar(await chamarGastos("status"));
    };
    const des = $("#tg-desconectar", d);
    if (des) des.onclick = async () => { if (await confirmar("Desconectar o Telegram? O bot para de aceitar suas mensagens.", "Desconectar")) { await chamarGastos("desconectar"); pintar(await chamarGastos("status")); } };
  };
  pintar(await chamarGastos("status"));
}

// Botão flutuante em todas as abas, e o endereço #gasto abre direto nele (atalho na tela do iPhone)
(function botaoGasto() {
  const b = document.createElement("button");
  b.type = "button"; b.id = "fab-gasto"; b.className = "fab-gasto";
  b.innerHTML = `${ic("mais")}<span>Gasto</span>`;
  b.setAttribute("aria-label", "Lançar um gasto");
  b.onclick = () => abrirGastoRapido();
  document.body.appendChild(b);
  if (location.hash === "#gasto") {
    let n = 0;
    const t = setInterval(() => { n++; if ((typeof abaAtual !== "undefined" && S.contratos && document.documentElement.classList.contains("liberado") && $("#aba-inicio").textContent.trim() && !/Carregando/.test($("#aba-inicio").textContent)) || n > 40) { clearInterval(t); abrirGastoRapido(); } }, 500);
  }
})();

/* =============================================================
   RANKING DOS VÍDEOS DO PORTFÓLIO (no Dashboard)
   Lê a tabela video_views (o site grava cada vez que alguém assiste
   um vídeo com som) e mostra do mais assistido ao menos assistido.
   ============================================================= */
const rankV = { dias: 30, linhas: null, desde: "" };
try { rankV.dias = Number(localStorage.getItem("rank-dias")) || 30; } catch (_) {}
const fmtTempo = (s) => (s >= 60 ? `${Math.floor(s / 60)}min${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)}s`);
async function pintarRankingVideos(caixa) {
  if (!caixa) return;
  const desde = new Date(Date.now() - rankV.dias * 864e5).toISOString();
  if (rankV.linhas === null || rankV.desde.slice(0, 13) !== desde.slice(0, 13) || rankV.diasLidos !== rankV.dias) {
    caixa.innerHTML = `<div class="cartao"><h2>Vídeos mais assistidos no portfólio</h2><p class="vazio">Carregando...</p></div>`;
    const { data, error } = await db.from("video_views").select("video_id,titulo,secao,segundos,duracao,origem,criado_em").gte("criado_em", desde).limit(10000);
    if (error) { caixa.innerHTML = `<div class="cartao"><h2>Vídeos mais assistidos no portfólio</h2><p class="aviso-falta">${/does not exist|schema cache/i.test(error.message) ? "Falta criar a tabela video_views no banco (banco.sql, parte 34)." : esc(error.message)}</p></div>`; return; }
    rankV.linhas = data || []; rankV.desde = desde; rankV.diasLidos = rankV.dias;
  }
  if (!caixa.isConnected) return;
  const grupos = new Map();
  rankV.linhas.forEach((l) => {
    const k = l.video_id ? "v" + l.video_id : "t" + (l.titulo || "?");
    if (!grupos.has(k)) grupos.set(k, { id: l.video_id, titulo: l.titulo, secao: l.secao, plays: 0, seg: 0, dur: 0, completos: 0 });
    const g = grupos.get(k);
    g.plays++; g.seg += n2(l.segundos);
    if (l.duracao) { g.dur = Math.max(g.dur, n2(l.duracao)); if (n2(l.segundos) >= n2(l.duracao) * 0.9) g.completos++; }
  });
  const lista = [...grupos.values()].map((g) => {
    const v = g.id ? S.videos.find((x) => String(x.id) === String(g.id)) : null;
    return { ...g, v, nome: v ? v.titulo : g.titulo, marca: v ? v.marca : g.secao === "resultados" ? g.titulo : "", media: g.seg / g.plays };
  }).sort((a, b) => b.plays - a.plays || b.seg - a.seg);
  const maxP = Math.max(1, ...lista.map((x) => x.plays));
  const origens = {};
  rankV.linhas.forEach((l) => { origens[l.origem || "Direto"] = (origens[l.origem || "Direto"] || 0) + 1; });
  const topOrigens = Object.entries(origens).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const semPlay = S.videos.filter((v) => v.visivel !== false && !lista.some((x) => String(x.id) === String(v.id)));
  caixa.innerHTML = `<div class="cartao rank-videos">
    <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Vídeos mais assistidos no portfólio</h2><span class="espaco"></span>
      <div class="chips" role="tablist" aria-label="Período">${[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"]].map(([d, n]) => `<button class="chip" type="button" data-rank-dias="${d}" aria-pressed="${rankV.dias === d}">${n}</button>`).join("")}</div></div>
    <p class="sub" style="margin:0 0 10px">Conta cada vez que alguém deu play com som. Os vídeos que você assiste neste navegador não entram.${topOrigens.length ? ` Vieram de: ${topOrigens.map(([o, n]) => `${esc(o)} (${n})`).join(", ")}.` : ""}</p>
    ${lista.length ? `<ol class="rank-lista">${lista.map((x, i) => `<li>
      <b class="rank-pos">${i + 1}</b>
      ${x.v && x.v.capa ? `<img src="${esc(x.v.capa)}" alt="" loading="lazy">` : `<span class="rank-sem-capa">${ic("play")}</span>`}
      <span class="rank-txt"><strong>${esc(x.nome || "Vídeo")}</strong><small>${esc(x.marca || "")}${x.secao === "resultados" ? " · carrossel de resultados" : ""}</small>
        <i class="rank-trilho"><i style="width:${(x.plays / maxP) * 100}%"></i></i></span>
      <span class="rank-num"><strong>${x.plays} ${x.plays === 1 ? "play" : "plays"}</strong><small>assistem em média ${fmtTempo(x.media)}${x.dur ? ` de ${fmtTempo(x.dur)} (${Math.min(100, Math.round((x.media / x.dur) * 100))}%)` : ""}${x.completos ? ` · ${x.completos} até o fim` : ""}</small></span>
    </li>`).join("")}</ol>` : `<p class="vazio">Ninguém assistiu vídeos com som nos últimos ${rankV.dias} dias ainda. O registro começou agora: os números aparecem conforme as marcas visitarem o portfólio.</p>`}
    ${semPlay.length && lista.length ? `<details class="rank-sem"><summary>${semPlay.length} vídeos sem nenhum play no período</summary><p>${semPlay.map((v) => esc(v.titulo + (v.marca ? ` (${v.marca})` : ""))).join(" · ")}</p></details>` : ""}
  </div>`;
  $$("[data-rank-dias]", caixa).forEach((b) => b.onclick = () => { rankV.dias = Number(b.dataset.rankDias); try { localStorage.setItem("rank-dias", String(rankV.dias)); } catch (_) {} pintarRankingVideos(caixa); });
}

/* =============================================================
   CURADORIA DO PORTFÓLIO (Portfólio > Vídeos e curadoria)
   Por vídeo: quantos plays com som, quanto assistem e se vão até o
   fim. Mostra o que está prendendo, o que ninguém abre e o que as
   pessoas largam no começo, e pode reordenar cada nicho.
   ============================================================= */
const vstat = { dias: 30, mapa: null, total: 0, lidoEm: 0, diasLidos: 0, carregando: false };
try { vstat.dias = Number(localStorage.getItem("cur-dias")) || 30; } catch (_) {}
function statsVideosPortfolio(aoCarregar) {
  const velho = Date.now() - vstat.lidoEm > 5 * 60000 || vstat.diasLidos !== vstat.dias;
  if ((vstat.mapa === null || velho) && !vstat.carregando) {
    vstat.carregando = true;
    const desde = new Date(Date.now() - vstat.dias * 864e5).toISOString();
    db.from("video_views").select("video_id,segundos,duracao").gte("criado_em", desde).not("video_id", "is", null).limit(10000).then(({ data, error }) => {
      vstat.carregando = false;
      if (error) { vstat.erro = error.message; vstat.mapa = new Map(); }
      else {
        const m = new Map();
        (data || []).forEach((l) => {
          const k = String(l.video_id);
          if (!m.has(k)) m.set(k, { plays: 0, seg: 0, dur: 0, completos: 0 });
          const g = m.get(k); g.plays++; g.seg += n2(l.segundos);
          if (l.duracao) { g.dur = Math.max(g.dur, n2(l.duracao)); if (n2(l.segundos) >= n2(l.duracao) * 0.9) g.completos++; }
        });
        m.forEach((g) => { g.media = g.seg / g.plays; g.pct = g.dur ? Math.min(100, Math.round((g.media / g.dur) * 100)) : null; });
        vstat.mapa = m; vstat.total = (data || []).length; vstat.erro = null;
      }
      vstat.lidoEm = Date.now(); vstat.diasLidos = vstat.dias;
      if (aoCarregar) aoCarregar();
    });
  }
  return vstat.mapa;
}
function cartaoCuradoria(st) {
  const chips = `<div class="chips" role="tablist" aria-label="Período">${[[7, "7 dias"], [30, "30 dias"], [90, "90 dias"]].map(([d, n]) => `<button class="chip" type="button" data-cur-dias="${d}" aria-pressed="${vstat.dias === d}">${n}</button>`).join("")}</div>`;
  const topo = `<div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Curadoria do portfólio</h2><span class="espaco"></span>${chips}</div>`;
  if (!st) return `<div class="cartao cur">${topo}<p class="vazio">Lendo quem assistiu o quê...</p></div>`;
  if (vstat.erro) return `<div class="cartao cur">${topo}<p class="aviso-falta">${/does not exist|schema cache/i.test(vstat.erro) ? "Falta criar a tabela video_views (banco.sql, parte 34)." : esc(vstat.erro)}</p></div>`;
  const noAr = S.videos.filter((v) => v.visivel !== false);
  const com = noAr.map((v) => ({ v, e: st.get(String(v.id)) })).filter((x) => x.e);
  const nome = (v) => `${esc(v.titulo)}${v.marca ? ` <span class="sub">${esc(v.marca)}</span>` : ""}`;
  const lista = (arr, f) => arr.length ? `<ol>${arr.map((x) => `<li>${nome(x.v)}<b>${f(x)}</b></li>`).join("")}</ol>` : `<p class="sub">Nada ainda.</p>`;
  const mais = [...com].sort((a, b) => b.e.plays - a.e.plays).slice(0, 3);
  const prendem = com.filter((x) => x.e.plays >= 2 && x.e.pct != null).sort((a, b) => b.e.pct - a.e.pct).slice(0, 3);
  const largam = com.filter((x) => x.e.plays >= 2 && x.e.pct != null && x.e.pct < 25).sort((a, b) => a.e.pct - b.e.pct).slice(0, 4);
  const ninguem = noAr.filter((v) => !st.get(String(v.id)));
  const poucoDado = vstat.total < 15;
  return `<div class="cartao cur">${topo}
    <p class="sub" style="margin:0 0 10px">${vstat.total ? `${vstat.total} ${vstat.total === 1 ? "play" : "plays"} com som nos últimos ${vstat.dias} dias.` : `Nenhum play com som nos últimos ${vstat.dias} dias.`} Os vídeos que você assiste no seu navegador não contam.${poucoDado ? " <b>Ainda é pouco dado:</b> use como pista, não como verdade. Fica mais confiável a partir de uns 15 plays." : ""}</p>
    <div class="cur-grade">
      <div class="cur-bloco"><h3>🔥 Mais assistidos</h3>${lista(mais, (x) => `${x.e.plays} plays`)}</div>
      <div class="cur-bloco"><h3>⏱️ Prendem até o fim</h3>${lista(prendem, (x) => `${x.e.pct}% assistido`)}<small>Bons para ir para o começo do nicho.</small></div>
      <div class="cur-bloco"><h3>⚠️ Largam no começo</h3>${lista(largam, (x) => `${x.e.pct}%`)}<small>Menos de 25% assistido: o gancho ou a capa não seguram. Troque a capa ou tire do topo.</small></div>
      <div class="cur-bloco"><h3>😴 Ninguém deu play</h3><p class="cur-n">${ninguem.length}</p><small>${ninguem.length ? "Vídeos que ninguém abriu no período. Se continuar assim, troque a capa ou tire do site." : "Todo vídeo no ar teve play."}</small></div>
    </div>
    <div class="barra" style="margin:12px 0 0">
      <span class="sub">Quem visita vê primeiro os 3 primeiros vídeos de cada nicho.</span><span class="espaco"></span>
      <button class="btn" type="button" id="cur-ordenar" ${com.length < 3 || poucoDado ? "disabled title=\"Precisa de mais plays para valer a pena\"" : ""}>${ic("grafico")}Pôr na frente os que mais prendem</button>
    </div>
  </div>`;
}
function ligarCuradoria(el, redesenhar) {
  $$("[data-cur-dias]", el).forEach((b) => b.onclick = () => { vstat.dias = Number(b.dataset.curDias); try { localStorage.setItem("cur-dias", String(vstat.dias)); } catch (_) {} vstat.mapa = null; redesenhar(); });
  const ord = $("#cur-ordenar", el);
  if (ord) ord.onclick = async () => {
    if (!vstat.mapa || !(await confirmar("Reordenar os vídeos de cada nicho: os que as pessoas mais assistem e assistem até o fim vão para a frente. Os sem play ficam no fim, na ordem de hoje. Continuar?", "Reordenar"))) return;
    // Nota de cada vídeo = plays x quanto assistem (retenção pesa mais que só abrir)
    const nota = (v) => { const e = vstat.mapa.get(String(v.id)); return e ? e.plays * ((e.pct == null ? 30 : e.pct) / 100 + 0.2) : -1; };
    const nova = [];
    [...new Set(S.videos.map((v) => v.nicho))].forEach((n) => {
      const doNicho = S.videos.filter((v) => v.nicho === n).map((v, i) => ({ v, i, s: nota(v) }));
      doNicho.sort((a, b) => (b.s - a.s) || (a.i - b.i));
      doNicho.forEach((x) => nova.push(x.v));
    });
    ord.disabled = true; ord.textContent = "Reordenando...";
    let erros = 0;
    for (let i = 0; i < nova.length; i++) if (Number(nova[i].ordem) !== i) { if (!(await gravar("videos", { ordem: i }, nova[i].id))) erros++; }
    await recarregar("videos");
    avisar(erros ? `Reordenei, mas ${erros} não salvaram.` : "Pronto: em cada nicho, os que mais prendem estão na frente do site.", !!erros);
  };
}

window.__adminPessoal = true;
