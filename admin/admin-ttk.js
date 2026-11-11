/* =============================================================
   ÁREA TIKTOK (#tiktok-geral, #tiktok-tech, ...)
   Nove seções no menu: Visão Geral, Shop Tech, Outras categorias,
   Produtos e SKUs, Conteúdos e vídeos, Oportunidades, Testes e amostras,
   LIVE e Histórico. Só a operação Tech entra em metas, previsões,
   rankings e oportunidades; as outras categorias ficam na seção própria
   e continuam no financeiro consolidado (cartão no Financeiro).
   Categorias e produtos comerciais: ttk_grupos e ttk_produtos (parte 48).
   Organização de leitura no estilo do Owra, com as cores do painel:
   todo número tem comparação com o mesmo período do mês anterior,
   todo gráfico tem uma frase dizendo o que mostra, toda tabela exporta.

   Dados:
     ttk_pedidos   o affiliate_orders_*.xlsx do TikTok (+ histórico do Owra)
     ttk_conteudos os vídeos com números e análise (histórico do Owra)
     ttk_videos    os vídeos planejados de cada dia
     preferencias  "ttk_metas": { mes: { "2026-11": 30000 }, ultimaMeta, videos }

   Status: Liquidado e Pendente formam o GMV. Inelegível (cancelado ou
   devolvido) e Aguardando pagamento ficam fora.
   Isto não entra no faturado do Financeiro: lá conta o repasse de quarta.
   ============================================================= */
const ttkX = {
  pedidos: null, conteudos: null, videos: null, metas: null, erro: "",
  mes: null, modo: "mes", dia: null,
  prodSel: "", pareto: "com", busca: "", pagina: 0, janela: 14, conteudoPor: "gancho",
  todos: null, sub: "geral", subcat: "", escopoGeral: "tech", escopoConteudo: "tech", ordemVideos: "liq",
  filtroProd: "tech", buscaProd: "", fichaGrupo: null,
  grupos: {}, prodGrupo: {}, prodInfo: {}, importacoes: [], historico: [], amostras: []
};
const TTK_SUBS = [["geral", "Visão Geral"], ["tech", "Shop Tech"], ["outras", "Outras categorias"], ["produtos", "Produtos e SKUs"], ["conteudos", "Conteúdos e vídeos"],
  ["oportunidades", "Oportunidades"], ["amostras", "Testes e amostras"], ["live", "LIVE"], ["historico", "Histórico"]];
// Subcategorias: [área, nome]. A área "tech" é a operação principal.
const TTK_CATS = {
  iluminacao: ["tech", "Iluminação"], audio: ["tech", "Áudio"], mobile: ["tech", "Acessórios mobile"], gravacao: ["tech", "Equipamentos de gravação"],
  eletronicos: ["tech", "Eletrônicos"], casa_inteligente: ["tech", "Casa inteligente"],
  beleza: ["outras", "Beleza e cuidados pessoais"], perfumes: ["outras", "Perfumes"], vestuario: ["outras", "Vestuário e calçados"],
  casa: ["outras", "Casa e utilidades"], outros: ["outras", "Outros"]
};
// Sugestão de categoria pelo nome do produto (você confirma ou corrige em Produtos e SKUs)
const TTK_PISTAS = [
  ["perfumes", /perfume|col[oô]nia|eau de/i], ["beleza", /protetor solar|s[eé]rum|skin|cabelo|barba|depila|maquiag|acne|espinha|olheira|bast[aã]o (anti|vitamina)|hidratante|sallve/i],
  ["vestuario", /camiset|cropped|blus|t[eê]nis|cal[cç]a|vestid|bolsa|roupa|short|meia|jaqueta|moletom/i],
  ["casa_inteligente", /wi-?fi|inteligente|smart|alexa|tomada/i], ["casa", /cesto|espelho|copo|cadeira|odoriz|limpa|lavar|abajur|lumin[aá]ria|panela|organizador/i],
  ["audio", /microfone|fone|caixa de som|headset|lapela|áudio|audio/i], ["iluminacao", /\bluz|led|ilumina|softbox|ring ?light|l[aâ]mpada|refletor|bowens/i],
  ["gravacao", /trip[eé]|gimbal|estabiliz|bra[cç]o|c[aâ]mera|filtro|lente|monitor|selfie|suporte de peito|teleprompter/i],
  ["mobile", /celular|iphone|ipad|capa|case|pel[ií]cula|carregador|cabo|stylus|caneta|magsafe/i],
  ["eletronicos", /eletr[oô]nic|bluetooth|usb|power ?bank|projetor|teclado|mouse|smartwatch|rel[oó]gio/i]
];
const ttkSugerir = (nome) => { const t = String(nome || ""); for (const [k, re] of TTK_PISTAS) if (re.test(t)) return k; return "outros"; };
const TTK_STATUS_VIDEO = [["rascunho", "Rascunho"], ["agendado", "Agendado"], ["postado", "Postado"]];
const TTK_STATUS = { liq: "Liquidado", pen: "Pendente", ine: "Inelegível: não pago", agu: "Aguardando pagamento" };

// Colunas do arquivo do TikTok, pelo título exato
const TTK_COLUNAS = {
  pedido_id: "ID do pedido", sku_id: "ID do SKU", produto_id: "ID do produto", produto: "Nome do produto", loja: "Nome da loja",
  itens: "Itens vendidos", reembolsados: "Itens reembolsados", status: "Status de liquidação do pedido",
  tipo_conteudo: "Tipo de conteúdo", conteudo_id: "ID do conteúdo", gmv: "GMV",
  padrao: "Comissão padrão estimada", anuncios: "Comissão estimada de anúncios da loja", bonus: "Bônus estimado",
  recebido: "Valor total final recebido", data: "Data do pedido", liquidado: "Data de liquidação da comissão"
};

/* ---------- Pequenas ajudas ---------- */
const ttkNum = (v) => {
  if (typeof v === "number") return v;
  const t = String(v == null ? "" : v).trim();
  if (!t || t === "/" || t === "-") return 0;
  return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
};
// "10/11/2026 22:47:14" vira "2026-11-10T22:47:14" (horário de Brasília, sem fuso)
const ttkData = (v) => {
  if (v instanceof Date && !isNaN(v)) return `${isoLocal(v)}T${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
  const m = String(v || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] || 0)}:${m[5] || "00"}:${m[6] || "00"}` : null;
};
const ttkStatusPt = (s) => (s === "AwaitingPayment" ? "Aguardando pagamento" : s);
const ttkSomaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); };
const ttkDiasNoMes = (mes) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
const ttkMesAnterior = (mes) => { const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 2, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const ttkNomeMes = (mes, longo) => `${(longo ? MESES_LONGOS : MESES_CURTOS)[Number(mes.slice(5, 7)) - 1]}${longo ? " de " : "/"}${longo ? mes.slice(0, 4) : mes.slice(2, 4)}`;
const ttkPct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
const ttkFmtPct = (v) => `${String(Math.round(v * 10) / 10).replace(".", ",")}%`;
const ttkCurto = (v) => (privado ? "" : v >= 1000 ? `R$ ${String(Math.round(v / 100) / 10).replace(".", ",")} mil` : `R$ ${Math.round(v)}`);
const ttkCat = (s) => (s === "Liquidado" ? "liq" : s === "Pendente" ? "pen" : s === "Inelegível" ? "ine" : s === "Aguardando pagamento" || s === "AwaitingPayment" ? "agu" : "out");
const ttkValido = (p) => p.cat === "liq" || p.cat === "pen";
const ttkMediana = (l) => { if (!l.length) return 0; const s = [...l].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// Os 32 primeiros bits do ID de um vídeo do TikTok são o momento em que ele foi postado
const ttkPostadoPeloId = (id) => { try { return isoLocal(new Date(Number(BigInt(id) >> 32n) * 1000)); } catch (_) { return ""; } };

// Selo de variação, o mesmo do Dashboard: seta pra cima verde, pra baixo vermelha (inverso: subir é ruim)
function ttkSelo(v, ant, { pp = false, inverso = false } = {}) {
  if (ant == null || ttkX.modo === "acum") return "";
  let d, txt;
  if (pp) { d = v - ant; txt = `${Math.abs(d).toFixed(1).replace(".", ",")} p.p.`; }
  else { if (!ant) return v ? `<span class="ini-selo ttk-novo">novo</span>` : ""; d = (v / ant - 1) * 100; txt = `${Math.abs(d).toFixed(1).replace(".", ",")}%`; }
  if (Math.abs(d) < 0.05) return `<span class="ini-selo">igual</span>`;
  const bom = inverso ? d < 0 : d > 0;
  return `<span class="ini-selo ${bom ? "sobe" : "desce"}" title="contra o mesmo período do mês anterior">${d > 0 ? "▲" : "▼"} ${txt}</span>`;
}
// Mesmo selo, sem depender do modo (ontem, produto, vídeo)
const ttkSeloLivre = (v, ant) => { if (!ant) return ""; const d = (v / ant - 1) * 100; return `<span class="ini-selo ${d >= 0 ? "sobe" : "desce"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1).replace(".", ",")}%</span>`; };
const ttkFrase = (t) => `<p class="ttk-frase">${t}</p>`;
const ttkExportar = (id) => `<button class="btn pequeno" type="button" data-ttk-exportar="${id}">${ic("baixar")}Exportar</button>`;

/* ---------- Carregar ---------- */
async function ttkLerTudo(tabela, campos, ordem) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from(tabela).select(campos).order(ordem, { ascending: true }).range(de, de + 999);
    if (error) throw error;
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}
async function ttkCarregar() {
  ttkX.erro = "";
  let ped;
  try {
    ped = await ttkLerTudo("ttk_pedidos", "pedido_id,sku_id,produto_id,produto,status,tipo_conteudo,conteudo_id,gmv,comissao_est,comissao_real,liquidado_em,itens,reembolsados,origem,data", "data");
  } catch (e) { ttkX.erro = traduzErro(e); ttkX.todos = ttkX.pedidos = []; ttkX.conteudos = []; ttkX.videos = []; ttkX.metas = {}; return; }
  await ttkCarregarApoio();
  ttkX.todos = ttkX.pedidos = ped.map(ttkEnriquecer);
  try { ttkX.conteudos = await ttkLerTudo("ttk_conteudos", "tiktok_video_id,postado_em,titulo,link,gancho_categoria,formato_categoria", "tiktok_video_id"); }
  catch (_) { ttkX.conteudos = []; }
  const { data: vids } = await db.from("ttk_videos").select("*").gte("data", ttkSomaDias(hojeISO(), -30)).order("hora", { ascending: true, nullsFirst: false });
  ttkX.videos = vids || [];
  const { data: pref } = await db.from("preferencias").select("valor").eq("chave", "ttk_metas").maybeSingle();
  try { ttkX.metas = pref && pref.valor ? JSON.parse(pref.valor) : {}; } catch (_) { ttkX.metas = {}; }
}
// Categorias, produtos comerciais, importações, mudanças de status e amostras
async function ttkCarregarApoio() {
  const [g, pr, im, hi, am] = await Promise.all([
    db.from("ttk_grupos").select("*"), db.from("ttk_produtos").select("*"),
    db.from("ttk_importacoes").select("*").order("importado_em", { ascending: false }).limit(30),
    db.from("ttk_status_historico").select("*").order("mudou_em", { ascending: false }).limit(40),
    db.from("ttk_amostras").select("*").order("criado_em", { ascending: false })
  ]);
  ttkX.grupos = {}; (g.data || []).forEach((x) => { ttkX.grupos[x.id] = x; });
  ttkX.prodGrupo = {}; ttkX.prodInfo = {}; (pr.data || []).forEach((x) => { ttkX.prodGrupo[x.produto_id] = x.grupo_id; ttkX.prodInfo[x.produto_id] = x; });
  ttkX.importacoes = im.data || []; ttkX.historico = hi.data || []; ttkX.amostras = am.data || [];
  if (ttkX.todos) ttkX.todos.forEach((p) => Object.assign(p, ttkClassificar(p)));
}
// Grupo (produto comercial), área e subcategoria de um pedido
function ttkClassificar(p) {
  const gid = ttkX.prodGrupo[p.produto_id], g = gid != null ? ttkX.grupos[gid] : null;
  const subcat = g ? g.subcategoria : "a_classificar";
  return { grupo: g ? g.id : "p" + p.produto_id, nomeGrupo: g ? g.nome : p.produto || "Sem nome", subcat, area: (TTK_CATS[subcat] || ["a_classificar"])[0], chave: g ? "g" + g.id : "p" + p.produto_id };
}
function ttkEnriquecer(p) {
  const cat = ttkCat(p.status), itens = Number(p.itens) || 0, r = Number(p.reembolsados) || 0;
  return {
    ...p, g: n2(p.gmv), c: n2(p.comissao_est), liq: cat === "liq" ? n2(p.comissao_real) : 0, liqEm: p.liquidado_em ? String(p.liquidado_em).slice(0, 10) : "",
    itens, i: cat === "liq" || cat === "pen" ? Math.max(0, itens - r) : itens, cat,
    dia: String(p.data).slice(0, 10), mes: String(p.data).slice(0, 7), ...ttkClassificar(p)
  };
}
async function ttkSalvarMetas() {
  const { error } = await db.from("preferencias").upsert({ chave: "ttk_metas", valor: JSON.stringify(ttkX.metas), atualizado_em: new Date().toISOString() });
  if (error) { avisar(traduzErro(error), true); return false; }
  return true;
}

/* ---------- Contas ---------- */
function ttkSomar(lista) {
  const t = { g: 0, c: 0, i: 0, ped: new Set(), gLiq: 0, gPen: 0, gIne: 0, gAgu: 0, gOut: 0, iLiq: 0, iPen: 0, iIne: 0, iAgu: 0, iOut: 0, liq: 0, pend: 0, pl: new Set(), pp: new Set(), iLiqNet: 0 };
  lista.forEach((p) => {
    const k = p.cat[0].toUpperCase() + p.cat.slice(1);
    t["g" + k] += p.g; t["i" + k] += p.itens;
    if (ttkValido(p)) { t.g += p.g; t.c += p.c; t.i += p.i; t.ped.add(p.pedido_id); }
    if (p.cat === "liq") { t.liq += p.liq; t.pl.add(p.pedido_id); t.iLiqNet += p.i; }
    if (p.cat === "pen") { t.pend += p.c; t.pp.add(p.pedido_id); }
  });
  t.pedidos = t.ped.size; t.pedLiq = t.pl.size; t.pedPen = t.pp.size;
  t.itensTodos = t.iLiq + t.iPen + t.iIne + t.iAgu + t.iOut;
  return t;
}
// O período escolhido e o mesmo período do mês anterior (dia 1 a dia N contra dia 1 a dia N)
function ttkPeriodo() {
  const hoje = hojeISO(), mesHoje = hoje.slice(0, 7);
  if (ttkX.modo === "acum") {
    const base = ttkX.todos || ttkX.pedidos, ini = base.length ? base[0].dia : hoje;
    return { acum: true, ini, fim: hoje, atual: true, titulo: `Desde ${dataBR(ini)}` };
  }
  const mes = ttkX.mes, D = ttkDiasNoMes(mes), atual = mes === mesHoje;
  // No mês atual, o período vai até o último dia que tem pedido importado (hoje sem importar não conta)
  const base = ttkX.todos || ttkX.pedidos, ultimoDia = base.length ? base[base.length - 1].dia : hoje;
  const fimDados = atual ? (ultimoDia.slice(0, 7) === mes && ultimoDia < hoje ? ultimoDia : hoje) : null;
  const N = atual ? Number(fimDados.slice(8, 10)) : D;
  const fechados = atual ? (fimDados < hoje ? N : N - 1) : D;
  const ant = ttkMesAnterior(mes), Nant = Math.min(N, ttkDiasNoMes(ant));
  return {
    mes, D, N, atual, ini: `${mes}-01`, fim: `${mes}-${pad(N)}`, ant, iniAnt: `${ant}-01`, fimAnt: `${ant}-${pad(Nant)}`,
    fechados, titulo: ttkNomeMes(mes, true)
  };
}
const ttkNoPeriodo = (p, ini, fim) => p.dia >= ini && p.dia <= fim;

// GMV por dia de um mês (índice 1..D)
function ttkPorDiaDoMes(mes, campo = "g", filtro = () => true) {
  const D = ttkDiasNoMes(mes), v = new Array(D + 1).fill(0);
  ttkX.pedidos.forEach((p) => { if (p.mes === mes && ttkValido(p) && filtro(p)) v[Number(p.dia.slice(8, 10))] += p[campo]; });
  return v;
}
/* Previsão do mês: mistura o ritmo deste mês com o dos últimos 7 dias do mês anterior.
   Peso deste mês = dias fechados ÷ (dias fechados + 7): no começo o mês anterior pesa
   mais, e a cada dia fechado este mês ganha peso. O caminho até o fim do mês segue o
   formato das vendas nos últimos 3 meses fechados (mediana dia a dia, suavizada em 7 dias). */
function ttkPrevisao(per, filtro = () => true) {
  const real = ttkPorDiaDoMes(per.mes, "g", filtro), D = per.D, k = per.fechados;
  const totalReal = real.reduce((s, x) => s + x, 0);
  if (!per.atual) return { total: totalReal, dias: real.map((r, d) => ({ d, real: r })), k: D };
  // Formato do mês: mediana dos 3 meses fechados anteriores (um dia que viralizou não distorce)
  const fatores = Array.from({ length: D + 1 }, () => []);
  let m = per.mes;
  for (let n = 0; n < 3; n++) {
    m = ttkMesAnterior(m);
    const v = ttkPorDiaDoMes(m, "g", filtro), Dm = ttkDiasNoMes(m), tot = v.reduce((s, x) => s + x, 0);
    if (!tot) continue;
    for (let d = 1; d <= Math.min(D, Dm); d++) fatores[d].push(v[d] / tot * Dm);
  }
  let f = fatores.map((l) => (l.length ? ttkMediana(l) : 1));
  f = f.map((_, d) => { if (!d) return 0; let s = 0, q = 0; for (let j = d - 3; j <= d + 3; j++) if (j >= 1 && j <= D) { s += f[j]; q++; } return s / q; });
  const somaK = real.slice(1, k + 1).reduce((s, x) => s + x, 0);
  const rAtual = k ? somaK / k : 0;
  const ant = ttkPorDiaDoMes(ttkMesAnterior(per.mes), "g", filtro), Da = ant.length - 1;
  const rAnt = ant.slice(Math.max(1, Da - 6), Da + 1).reduce((s, x) => s + x, 0) / 7;
  const w = k / (k + 7), ritmo = w * rAtual + (1 - w) * (rAnt || rAtual);
  const base = k ? f.slice(1, k + 1).reduce((s, x) => s + x, 0) / k || 1 : 1;
  const dias = real.map((r, d) => ({ d, real: d <= k ? r : null, prev: d > k ? ritmo * f[d] / base : null }));
  const total = somaK + dias.reduce((s, x) => s + (x.prev || 0), 0);
  return { total, dias, k, ritmo };
}
// Produtos do período ordenados por GMV, com o % acumulado
function ttkProdutos(lista) {
  const m = new Map();
  lista.forEach((p) => {
    const x = m.get(p.chave) || { chave: p.chave, nome: p.nomeGrupo || p.produto || "Sem nome", g: 0, c: 0, i: 0, iTodos: 0, iIne: 0, liq: 0 };
    x.iTodos += p.itens; if (p.cat === "ine") x.iIne += p.itens;
    if (ttkValido(p)) { x.g += p.g; x.c += p.c; x.i += p.i; }
    if (p.cat === "liq") x.liq += p.liq;
    m.set(p.chave, x);
  });
  const l = [...m.values()].filter((x) => x.g > 0 || x.iTodos > 0).sort((a, b) => b.g - a.g);
  const tot = l.reduce((s, x) => s + x.g, 0);
  let ac = 0;
  l.forEach((x) => { ac += x.g; x.acum = tot ? ac / tot * 100 : 0; x.pctIne = x.iTodos ? x.iIne / x.iTodos * 100 : 0; });
  return l;
}
const ttkOs80 = (prods) => { const s = new Set(); for (const x of prods) { s.add(x.chave); if (x.acum >= 80) break; } return s; };

/* ---------- Gráficos (SVG simples, um eixo só, com dica ao passar o mouse) ---------- */
let TTK_W = 960; const TTK_H = 240, TTK_M = { e: 68, d: 12, t: 14, b: 26 };
// Gráfico pela metade da largura usa um desenho mais estreito, pra o texto não ficar miúdo
const ttkLargura = (w, f) => { const antes = TTK_W; TTK_W = w; try { return f(); } finally { TTK_W = antes; } };
// Caixa da dica, a mesma do Dashboard (iniLigarDicas liga o mouse)
const ttkCaixa = (svg, extra = "") => `<div class="ini-graf-caixa ttk-caixa">${svg}${extra}<div class="ini-dica" hidden></div></div>`;
const ttkAlvos = (n, X, larg, dicas) => Array.from({ length: n }, (_, i) => `<rect data-dica="${esc(dicas(i))}" data-x="${X(i).toFixed(1)}" x="${(X(i) - larg / 2).toFixed(1)}" y="0" width="${larg.toFixed(1)}" height="${TTK_H - TTK_M.b}" fill="transparent"/>`).join("");
function ttkGrade(yMax, fmt = ttkCurto) {
  const h = TTK_H - TTK_M.t - TTK_M.b;
  return [0, .25, .5, .75, 1].map((f) => { const y = TTK_M.t + h - f * h; return `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${y}" y2="${y}" class="${f ? "ttk-grade" : "ttk-base"}"/><text x="${TTK_M.e - 8}" y="${y + 4}" text-anchor="end" class="ttk-eixo">${f ? fmt(yMax * f) : ""}</text>`; }).join("");
}
function ttkRotulosX(rotulos, X) {
  const n = rotulos.length, passo = Math.ceil(n / 10);
  return rotulos.map((r, i) => (i % passo && i !== n - 1 ? "" : `<text x="${X(i).toFixed(1)}" y="${TTK_H - 6}" text-anchor="middle" class="ttk-eixo">${esc(r)}</text>`)).join("");
}
// series: [{ v: [números ou null], classe, nome, area }], metas: [{ v, nome }]
function ttkGrafLinhas(rotulosX, series, metas = []) {
  const yMax = Math.max(1, ...series.flatMap((s) => s.v.filter((x) => x != null)), ...metas.map((m) => m.v)) * 1.08;
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d, n = rotulosX.length, base = TTK_M.t + h;
  const X = (i) => TTK_M.e + (n === 1 ? w / 2 : i / (n - 1) * w), Y = (v) => TTK_M.t + h - v / yMax * h;
  const caminhos = series.map((s) => {
    let d = "", aberto = false, pri = null, ult = null;
    s.v.forEach((v, i) => { if (v == null) { aberto = false; return; } d += `${aberto ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; aberto = true; if (pri == null) pri = i; ult = i; });
    const area = s.area && pri != null ? `<path d="${d} L${X(ult).toFixed(1)},${base} L${X(pri).toFixed(1)},${base} Z" class="ini-area"/>` : "";
    const ponto = s.area && ult != null ? `<circle cx="${X(ult)}" cy="${Y(s.v[ult])}" r="4.5" class="ttk-ponto"/>` : "";
    return `${area}<path d="${d}" class="${s.classe}"/>${ponto}`;
  }).join("");
  const ms = metas.map((m) => `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(m.v)}" y2="${Y(m.v)}" class="ttk-meta"/><text x="${TTK_W - TTK_M.d}" y="${Y(m.v) - 6}" text-anchor="end" class="ttk-eixo">${esc(m.nome)}</text>`).join("");
  const dica = (i) => `${rotulosX[i]}: ${series.filter((s) => s.v[i] != null).map((s) => `${s.nome} ${real(s.v[i])}`).join(" · ")}`;
  const svg = `<svg class="ttk-graf" viewBox="0 0 ${TTK_W} ${TTK_H}" role="img" aria-label="Gráfico de linhas">${ttkGrade(yMax)}${ms}${caminhos}${ttkRotulosX(rotulosX, X)}
    <line class="ini-mira" x1="0" x2="0" y1="${TTK_M.t}" y2="${base}" style="display:none"/>${ttkAlvos(n, X, w / Math.max(1, n - 1), dica)}</svg>`;
  return ttkCaixa(svg);
}
// Barras arredondadas com a média tracejada
function ttkGrafBarras(rotulosX, valores, { classe = "ttk-barra-cafe", nome = "Valor", media = true, fmt = real } = {}) {
  const vMax = Math.max(1, ...valores) * 1.08, n = valores.length;
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d, passo = w / Math.max(1, n), bw = Math.max(3, Math.min(34, passo * .62));
  const X = (i) => TTK_M.e + i * passo + passo / 2, Y = (v) => TTK_M.t + h - v / vMax * h;
  const curto = fmt === real ? ttkCurto : fmt;
  const barras = valores.map((v, i) => (v ? `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, TTK_M.t + h - Y(v)).toFixed(1)}" rx="${Math.min(5, bw / 2).toFixed(1)}" class="${classe}"/>` : "")).join("");
  const md = n ? valores.reduce((s, x) => s + x, 0) / n : 0;
  const linhaMedia = media && md ? `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(md)}" y2="${Y(md)}" class="ttk-media"/><text x="${TTK_W - TTK_M.d}" y="${Y(md) - 6}" text-anchor="end" class="ttk-eixo">média ${curto(md)}</text>` : "";
  const svg = `<svg class="ttk-graf" viewBox="0 0 ${TTK_W} ${TTK_H}" role="img" aria-label="${esc(nome)}">${ttkGrade(vMax, curto)}${barras}${linhaMedia}${ttkRotulosX(rotulosX, X)}${ttkAlvos(n, X, passo, (i) => `${rotulosX[i]}: ${fmt(valores[i])}`)}</svg>`;
  return ttkCaixa(svg);
}
// Pareto num eixo só: cada barra é o % do total; a linha é o % acumulado
function ttkGrafPareto(itens, chave) {
  const tot = itens.reduce((s, x) => s + x[chave], 0) || 1, l = itens.slice(0, 25);
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d, n = l.length || 1, passo = w / n, bw = Math.max(4, Math.min(30, passo * .62));
  const X = (i) => TTK_M.e + i * passo + passo / 2, Y = (pct) => TTK_M.t + h - pct / 100 * h;
  let ac = 0, d = "";
  const acs = [];
  const barras = l.map((x, i) => {
    const pct = x[chave] / tot * 100; ac += pct; acs.push(ac);
    d += `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(ac).toFixed(1)}`;
    return `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(pct).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(2, TTK_M.t + h - Y(pct)).toFixed(1)}" rx="${Math.min(5, bw / 2).toFixed(1)}" class="ttk-barra-cafe"/>`;
  }).join("");
  const grade = [0, 25, 50, 75, 100].map((p) => `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(p)}" y2="${Y(p)}" class="${p ? "ttk-grade" : "ttk-base"}"/><text x="${TTK_M.e - 8}" y="${Y(p) + 4}" text-anchor="end" class="ttk-eixo">${p}%</text>`).join("")
    + `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(80)}" y2="${Y(80)}" class="ttk-meta"/><text x="${TTK_W - TTK_M.d}" y="${Y(80) - 6}" text-anchor="end" class="ttk-eixo">80%</text>`;
  const dica = (i) => `${l[i].nome.slice(0, 50)}: ${chave === "c" ? real(l[i].c) : num(l[i].i) + " itens"} (${ttkFmtPct(l[i][chave] / tot * 100)}), acumulado ${ttkFmtPct(acs[i])}`;
  return ttkCaixa(`<svg class="ttk-graf" viewBox="0 0 ${TTK_W} ${TTK_H}" role="img" aria-label="Concentração 80/20">${grade}${barras}<path d="${d}" class="ttk-linha-dourada"/>
    <line class="ini-mira" x1="0" x2="0" y1="${TTK_M.t}" y2="${TTK_M.t + h}" style="display:none"/>${ttkAlvos(l.length, X, passo, dica)}</svg>`);
}
// Mini barras do GMV mês a mês (últimos 6 meses)
function ttkMini(vals) {
  const mx = Math.max(1, ...vals), w = 72, h = 22, bw = w / vals.length - 2;
  return `<svg class="ttk-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true">${vals.map((v, i) => `<rect x="${i * (w / vals.length) + 1}" y="${h - v / mx * h}" width="${bw}" height="${v / mx * h}" rx="1.5" class="${i === vals.length - 1 ? "ttk-barra-cafe" : "ttk-barra-cinza"}"/>`).join("")}</svg>`;
}
// Gráficos pequenos dos quadros do topo, no desenho do Dashboard (sem eixo, esticam na largura)
function ttkHeroBarras(dias) {
  if (dias.length < 2) return `<p class="ini-vazio-graf">O gráfico aparece com mais dias de venda.</p>`;
  const W = 320, H = 96, base = 90, mx = Math.max(1, ...dias.map((d) => d.v)), passo = W / dias.length, larg = Math.max(3, Math.min(16, passo - 3));
  return `<svg class="ini-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="GMV por dia">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="ini-base"/>
    ${dias.map((d, i) => { const hh = d.v ? Math.max(2, d.v / mx * (base - 6)) : 0;
      return `<g data-dica="${esc(`${d.rot}: ${real(d.v)}`)}"><rect x="${i * passo}" y="0" width="${passo}" height="${H}" fill="transparent"/>${hh ? `<rect x="${(i * passo + (passo - larg) / 2).toFixed(1)}" y="${(base - hh).toFixed(1)}" width="${larg.toFixed(1)}" height="${hh.toFixed(1)}" rx="2" class="ini-barra"/>` : ""}</g>`; }).join("")}
  </svg>`;
}
function ttkHeroArea(dias) {
  if (dias.length < 2) return `<p class="ini-vazio-graf">O gráfico aparece com mais dias de venda.</p>`;
  const W = 320, H = 96, topo = 8, fundo = 86, mx = Math.max(1, ...dias.map((d) => d.v));
  const px = (i) => (i / (dias.length - 1)) * W, py = (v) => fundo - (v / mx) * (fundo - topo);
  const pts = dias.map((d, i) => `${px(i).toFixed(1)},${py(d.v).toFixed(1)}`), ult = dias.length - 1;
  return `<svg class="ini-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Comissão por dia">
    <path d="M0,${fundo} L${pts.join(" L")} L${W},${fundo} Z" class="ini-area"/>
    <polyline points="${pts.join(" ")}" class="ini-linha" vector-effect="non-scaling-stroke"/>
    <line class="ini-mira" x1="0" x2="0" y1="${topo}" y2="${fundo}" vector-effect="non-scaling-stroke" style="display:none"/>
    ${dias.map((d, i) => `<rect data-dica="${esc(`${d.rot}: ${real(d.v)}`)}" data-x="${px(i).toFixed(1)}" x="${Math.max(0, px(i) - W / dias.length / 2).toFixed(1)}" y="0" width="${(W / dias.length).toFixed(1)}" height="${H}" fill="transparent"/>`).join("")}
  </svg><span class="ini-ponto" style="left:${((px(ult) / W) * 100).toFixed(2)}%;top:${((py(dias[ult].v) / H) * 100).toFixed(2)}%"></span>`;
}

/* ---------- A área TikTok: cabeçalho comum e a seção escolhida no menu ---------- */
// Roda uma função vendo só os pedidos de um escopo (Tech, outras, uma subcategoria).
// Os blocos de análise leem ttkX.pedidos; aqui ele vira a lista filtrada e depois volta.
function ttkComEscopo(filtro, fn) {
  const antes = ttkX.pedidos;
  ttkX.pedidos = ttkX.todos.filter(filtro);
  try { return fn(); } finally { ttkX.pedidos = antes; }
}
const ttkEhTech = (p) => p.area === "tech";
// Comissão que caiu entre duas datas, pela data de liquidação (comparação justa: não sofre com a demora de ~7 dias pra liquidar)
const ttkCaiu = (filtro, ini, fim) => ttkX.todos.reduce((s, p) => s + (p.cat === "liq" && p.liqEm && p.liqEm >= ini && p.liqEm <= fim && filtro(p) ? p.liq : 0), 0);
const ttkEhOutras = (p) => p.area !== "tech";
const ttkNomeCat = (k) => (TTK_CATS[k] || [0, k === "a_classificar" ? "A classificar" : "Outros"])[1];

function ttkMeses() {
  const hoje = hojeISO();
  const meses = [...new Set(ttkX.todos.map((p) => p.mes))].sort().reverse();
  if (!meses.includes(hoje.slice(0, 7))) meses.unshift(hoje.slice(0, 7));
  if (!ttkX.mes || !meses.includes(ttkX.mes)) ttkX.mes = meses[0];
  return meses;
}
function ttkCabecalho(per, { titulo, comMes = true } = {}) {
  const meses = ttkMeses(), ontem = ttkSomaDias(hojeISO(), -1);
  const ultimo = ttkX.todos.length ? String(ttkX.todos[ttkX.todos.length - 1].data) : "";
  const desconhecidos = [...new Set(ttkX.todos.filter((p) => p.cat === "out").map((p) => p.status))];
  return `<div class="ini-topo ttk-cabeca">
      <div><p class="ini-sobre"><span class="ini-traco"></span>TikTok · ${esc((TTK_SUBS.find(([k]) => k === ttkX.sub) || [0, ""])[1])}</p>
        <h2 class="ttk-titulo-grande">${esc(titulo)}</h2>
        <p class="ini-frase">${ultimo ? `Pedidos até ${dataBR(ultimo)} às ${ultimo.slice(11, 16)}.` : "Nenhum pedido ainda."}${comMes && !per.acum ? ` As setas comparam com o mesmo período de ${MESES_LONGOS[Number(per.ant.slice(5, 7)) - 1].toLowerCase()}.` : ""}</p></div>
      <div class="ttk-controles">
        ${comMes ? `<select class="campo" id="ttk-mes" aria-label="Mês" ${per.acum ? "disabled" : ""}>${meses.map((m) => `<option value="${m}" ${m === ttkX.mes ? "selected" : ""}>${ttkNomeMes(m, true)}</option>`).join("")}</select>
        <div class="ini-periodo" role="group" aria-label="Visão">${[["mes", "Mês a mês"], ["acum", "Acumulado"]].map(([k, n]) => `<button type="button" data-ttk-modo="${k}" aria-pressed="${ttkX.modo === k}">${n}</button>`).join("")}</div>` : ""}
        <label class="btn primario">${ic("subir")}Importar pedidos<input type="file" id="ttk-arquivo" accept=".xlsx,.xls,.csv" hidden></label>
      </div>
    </div>
    ${ultimo && ultimo.slice(0, 10) < ontem ? `<div class="aviso-falta">O último pedido importado é de ${dataBR(ultimo)}. Importe um arquivo novo pra ver os dias seguintes.</div>` : ""}
    ${desconhecidos.length ? `<div class="aviso-falta">O TikTok mandou um status que o painel não conhece (${desconhecidos.map(esc).join(", ")}). Esses pedidos ficaram fora das contas até eu aprender o que significam.</div>` : ""}`;
}
// Botões de subcategoria (Toda Tech, Iluminação, ...)
function ttkChipsSub(area) {
  const lista = Object.entries(TTK_CATS).filter(([, [a]]) => a === area);
  return `<div class="ini-periodo ttk-subcats" role="group" aria-label="Subcategoria">
    <button type="button" data-ttk-subcat="" aria-pressed="${!ttkX.subcat}">${area === "tech" ? "Toda Tech" : "Todas"}</button>
    ${lista.map(([k, [, n]]) => `<button type="button" data-ttk-subcat="${k}" aria-pressed="${ttkX.subcat === k}">${esc(n)}</button>`).join("")}</div>`;
}

async function desenharTikTok(el) {
  if (!ttkX.todos) { el.innerHTML = `<p class="vazio">Abrindo o TikTok...</p>`; await ttkCarregar(); }
  if (ttkX.erro) { el.innerHTML = `<div class="aviso-falta">Não consegui ler os pedidos do TikTok Shop (${esc(ttkX.erro)}). Falta rodar as partes 46, 47 e 48 do banco.sql no Supabase.</div>`; return; }
  if (!TTK_SUBS.some(([k]) => k === ttkX.sub)) ttkX.sub = "geral";
  ttkMeses();
  const telas = { geral: ttkTelaGeral, tech: (e) => ttkTelaAnalise(e, "tech"), outras: (e) => ttkTelaAnalise(e, "outras"), produtos: ttkTelaProdutos,
    conteudos: ttkTelaConteudos, oportunidades: ttkTelaOportunidades, amostras: ttkTelaAmostras, live: ttkTelaLive, historico: ttkTelaHistorico };
  telas[ttkX.sub](el);
  ttkLigar(el, { per: ttkPeriodo(), hoje: hojeISO() });
  if (typeof iniLigarDicas === "function") iniLigarDicas(el);
}

/* ---------- 1. Visão Geral: só o essencial ---------- */
function ttkTelaGeral(el) {
  const hoje = hojeISO(), ontem = ttkSomaDias(hoje, -1), per = ttkPeriodo();
  const tech = ttkX.escopoGeral !== "todas";
  const filtro = tech ? ttkEhTech : () => true;
  const doPer = ttkX.todos.filter((p) => filtro(p) && ttkNoPeriodo(p, per.ini, per.fim));
  const doAnt = per.acum ? [] : ttkX.todos.filter((p) => filtro(p) && ttkNoPeriodo(p, per.iniAnt, per.fimAnt));
  const A = ttkSomar(doPer), B = per.acum ? null : ttkSomar(doAnt);
  const prev = per.acum ? null : ttkComEscopo(filtro, () => ttkPrevisao(per));
  const meta = per.acum || !tech ? 0 : n2((ttkX.metas.mes || {})[per.mes] ?? (per.atual ? ttkX.metas.ultimaMeta : 0));
  const diasRest = per.acum || !per.atual ? 0 : per.D - per.fechados;
  const feitoAteOntem = prev ? prev.dias.reduce((s, x) => s + (x.real || 0), 0) : 0;
  const falta = Math.max(0, meta - feitoAteOntem);
  const taxaLiq = A.pedLiq + A.pedPen ? A.pedLiq / (A.pedLiq + A.pedPen) * 100 : 0;
  const fimCaiu = per.acum ? hoje : per.atual ? hoje : per.fim;
  const caiu = per.acum ? A.liq : ttkCaiu(filtro, per.ini, fimCaiu);
  const caiuAnt = per.acum ? null : ttkCaiu(filtro, per.iniAnt, per.atual ? `${per.ant}-${pad(Math.min(Number(hoje.slice(8, 10)), ttkDiasNoMes(per.ant)))}` : per.fimAnt);
  // Comissão que caiu por dia (data de liquidação), no mês escolhido
  let serie;
  if (per.acum) {
    serie = [...new Set(ttkX.todos.map((p) => p.mes))].sort().map((m) => ({ rot: ttkNomeMes(m), v: ttkX.todos.filter((p) => filtro(p) && p.cat === "liq" && p.mes === m).reduce((s, p) => s + p.liq, 0) }));
  } else {
    const v = new Array(per.D + 1).fill(0);
    ttkX.todos.forEach((p) => { if (filtro(p) && p.liqEm && p.liqEm.slice(0, 7) === per.mes) v[Number(p.liqEm.slice(8, 10))] += p.liq; });
    serie = Array.from({ length: per.atual ? Number(hoje.slice(8, 10)) : per.D }, (_, i) => ({ rot: `${i + 1}/${Number(per.mes.slice(5, 7))}`, v: v[i + 1] }));
  }
  const vendas = ttkX.todos.filter((p) => filtro(p) && ttkNoPeriodo(p, per.ini, per.fim));
  const gDia = per.acum ? [...new Set(ttkX.todos.map((p) => p.mes))].sort().map((m) => ({ rot: ttkNomeMes(m), v: ttkX.todos.filter((p) => filtro(p) && ttkValido(p) && p.mes === m).reduce((s, p) => s + p.g, 0) })) : Array.from({ length: per.N }, (_, i) => ({ rot: `${i + 1}/${Number(per.mes.slice(5, 7))}`, v: vendas.filter((p) => ttkValido(p) && Number(p.dia.slice(8, 10)) === i + 1).reduce((s, p) => s + p.g, 0) }));
  const oo = ttkSomar(ttkX.todos.filter((p) => filtro(p) && p.dia === ontem));
  const sete = [1, 2, 3, 4, 5, 6, 7].map((n) => ttkSomar(ttkX.todos.filter((p) => filtro(p) && p.dia === ttkSomaDias(ontem, -n))));
  const m7 = { g: sete.reduce((s, x) => s + x.g, 0) / 7, p: sete.reduce((s, x) => s + x.pedidos, 0) / 7 };
  const outras = ttkSomar(ttkX.todos.filter((p) => ttkEhOutras(p) && ttkNoPeriodo(p, per.ini, per.fim)));
  const aClassificar = Object.values(ttkX.grupos).filter((g) => g.categoria === "a_classificar").length;
  const vidsHoje = ttkX.videos.filter((v) => v.data === hoje);

  el.innerHTML = ttkCabecalho(per, { titulo: per.acum ? "Desde o começo" : MESES_LONGOS[Number(per.mes.slice(5, 7)) - 1] }) + `
    <div class="ttk-escopo"><div class="ini-periodo" role="group" aria-label="Escopo">${[["tech", "Tech"], ["todas", "Consolidado"]].map(([k, n]) => `<button type="button" data-ttk-escopo="${k}" aria-pressed="${(tech ? "tech" : "todas") === k}">${n}</button>`).join("")}</div>
      <span class="sub">${tech ? "Só a operação Tech. Outras categorias ficam fora das metas e previsões." : "Tech e outras categorias juntas, como no financeiro."}</span></div>
    <div class="ini-grade">
      <section class="ini-card ini-seg">
        <div class="ini-card-topo"><h2>Comissão${tech ? " Tech" : ""}</h2><span class="ttk-etiqueta">${per.acum ? "acumulado" : esc(ttkNomeMes(per.mes))}</span></div>
        <div class="ini-seg-nums"><div><strong class="ini-grande">${real(caiu)}</strong><span class="ini-rot">${per.acum ? "liquidada em todo o período" : "liquidada no mês (já caiu)"}</span>${ttkSelo(caiu, caiuAnt)}</div></div>
        <div class="ttk-seg-linha">
          <div><strong class="ini-medio">${real(A.pend)}</strong><span class="ini-rot">pendente dos pedidos ${per.acum ? "" : "do mês"}</span></div>
          <div><strong class="ini-medio">${ttkFmtPct(taxaLiq)}</strong><span class="ini-rot">desses pedidos já liquidados</span></div>
        </div>
        <p class="ttk-status-linha">${per.acum ? "" : `Dos pedidos do mês já caíram ${real(A.liq)}. `}Estimada desses pedidos: ${real(A.c)}. Estimada nunca é somada como recebida.</p>
        <div class="ini-graf-caixa">${ttkHeroBarras(serie)}<div class="ini-dica" hidden></div></div>
        <p class="ini-legenda">Comissão que caiu por ${per.acum ? "mês" : "dia de liquidação"}</p>
      </section>
      <section class="ini-card ini-alc ttk-com">
        <div class="ini-card-topo"><h2>Vendas${tech ? " Tech" : ""}</h2><span class="ttk-etiqueta ttk-etiqueta-clara">${per.acum ? "acumulado" : esc(ttkNomeMes(per.mes))}</span></div>
        <div class="ini-alc-nums">
          <div><strong class="ini-medio">${real(A.g)}</strong><span class="ini-rot">GMV</span>${ttkSelo(A.g, B && B.g)}</div>
          <div><strong class="ini-medio">${num(A.pedidos)}</strong><span class="ini-rot">pedidos</span>${ttkSelo(A.pedidos, B && B.pedidos)}</div>
          <div><strong class="ini-medio">${num(A.i)}</strong><span class="ini-rot">unidades</span>${ttkSelo(A.i, B && B.i)}</div>
        </div>
        <div class="ini-graf-caixa">${ttkHeroArea(gDia)}<div class="ini-dica" hidden></div></div>
        <p class="ini-legenda">GMV por ${per.acum ? "mês" : "dia do pedido"}</p>
      </section>
      <div class="ini-lado">
        <section class="ini-card ttk-meta-card">
          ${per.acum || !tech ? `<div class="ini-card-topo"><h2>${tech ? "Média por mês" : "Divisão"}</h2></div>
            ${tech ? `<strong class="ini-grande">${real(A.liq / Math.max(1, new Set(doPer.filter((p) => p.cat === "liq").map((p) => p.mes)).size))}</strong><span class="ini-rot">de comissão liquidada por mês</span>`
              : `<div class="ttk-meta-linhas"><div><span>Tech</span><b>${real(ttkSomar(doPer.filter(ttkEhTech)).liq)}</b></div><div><span>Outras categorias</span><b>${real(ttkSomar(doPer.filter(ttkEhOutras)).liq)}</b></div><div><span>Total liquidado</span><b>${real(A.liq)}</b></div></div>`}`
          : `<div class="ini-card-topo"><h2>Meta Tech</h2><button class="link-btn" type="button" id="ttk-meta">${meta ? "mudar" : "definir"}</button></div>
            ${meta ? `<div class="ttk-meta-nums"><strong class="ini-grande">${Math.round(ttkPct(A.g, meta))}%</strong><span class="ini-rot">de ${real(meta)} de GMV</span></div>
              <div class="ttk-meta-barra"><i style="width:${Math.min(100, ttkPct(A.g, meta))}%"></i>${prev ? `<b style="left:${Math.min(100, ttkPct(prev.total, meta))}%" title="previsão"></b>` : ""}</div>
              <div class="ttk-meta-linhas">
                ${per.atual ? `<div><span>${falta ? "Falta por dia" : "Meta batida"}</span><b>${falta ? real(falta / Math.max(1, diasRest)) : ""}</b></div>` : ""}
                <div><span>${per.atual ? "Previsão" : "Fechou em"}</span><b>${real(prev.total)} <span class="ini-selo ${prev.total >= meta ? "sobe" : "desce"}">${prev.total >= meta ? "▲" : "▼"} ${real(Math.abs(prev.total - meta))}</span></b></div>
              </div>`
            : `<p class="sub" style="margin:0">Defina a meta de GMV Tech do mês. A previsão hoje é de ${real(prev.total)}.</p>`}`}
        </section>
        <section class="ini-card ttk-ontem">
          <div class="ini-card-topo"><h2>Hoje</h2><span class="ttk-etiqueta ttk-etiqueta-clara">${dataBR(hoje).slice(0, 5)}</span></div>
          <div class="ttk-meta-linhas">
            <div><span>Ontem${tech ? " Tech" : ""}</span><b>${real(oo.g)} ${m7.g ? ttkSeloLivre(oo.g, m7.g) : ""}</b></div>
            <div><span>Vídeos de hoje</span><b>${vidsHoje.length ? `${vidsHoje.filter((v) => v.status !== "rascunho").length} de ${vidsHoje.length}` : "nenhum"}</b></div>
            ${tech ? `<div><span>Outras categorias</span><b>${real(outras.liq)}</b></div>` : ""}
          </div>
          ${aClassificar ? `<button class="link-btn ttk-alerta" type="button" data-ttk-ir="produtos">${plural(aClassificar, "produto novo", "produtos novos")} pra classificar</button>` : ""}
        </section>
      </div>
    </div>
    ${ttkBlocoCategorias(per)}
    ${ttkFrase(`Liquidada no mês é a comissão que o TikTok pagou nesses dias (valor final recebido), comparada com o que caiu nos mesmos dias do mês anterior. Pendente é a estimativa dos pedidos do mês que ainda vão liquidar, em média 7 dias depois do pedido. As análises completas ficam nas outras seções do menu.`)}`;
}

/* Todo o GMV do período por categoria (como o gráfico do TikTok) e a virada mês a mês pra Tech.
   Usa todas as categorias, sempre: é a foto da conta inteira. */
const TTK_FAIXAS = [["tech", "Tech", "ttk-f-tech"], ["vestuario", "Vestuário e calçados", "ttk-f-vest"], ["resto", "Outras categorias", "ttk-f-outras"]];
const ttkFaixa = (p) => (p.area === "tech" ? "tech" : p.subcat === "vestuario" ? "vestuario" : "resto");
function ttkBlocoCategorias(per) {
  const doPer = ttkX.todos.filter((p) => ttkValido(p) && ttkNoPeriodo(p, per.ini, per.fim));
  const tot = doPer.reduce((s, p) => s + p.g, 0);
  const cats = {};
  doPer.forEach((p) => { const k = TTK_CATS[p.subcat] ? p.subcat : "a_classificar"; const x = cats[k] || (cats[k] = { g: 0, liq: 0 }); x.g += p.g; x.liq += p.liq; });
  const linhas = Object.entries(cats).sort((a, b) => b[1].g - a[1].g);
  const maior = linhas.length ? linhas[0][1].g : 0;
  // Últimos 6 meses: quanto do GMV foi Tech, vestuário e o resto
  const meses = []; { let m = per.acum ? hojeISO().slice(0, 7) : per.mes; for (let n = 0; n < 6; n++) { meses.unshift(m); m = ttkMesAnterior(m); } }
  const porMes = meses.map((m) => { const l = ttkX.todos.filter((p) => ttkValido(p) && p.mes === m), t = l.reduce((s, p) => s + p.g, 0); const f = {}; TTK_FAIXAS.forEach(([k]) => { f[k] = t ? l.filter((p) => ttkFaixa(p) === k).reduce((s, p) => s + p.g, 0) / t * 100 : 0; }); return { m, t, f }; });
  const techAgora = porMes[porMes.length - 1].f.tech, techAntes = porMes.find((x) => x.t) ? porMes.find((x) => x.t).f.tech : 0;
  return `<div class="ini-card ttk-bloco ttk-cats">
    <div class="ini-card-topo"><h2>Todo o seu GMV por categoria</h2><span class="sub">${per.acum ? "todo o período" : esc(ttkNomeMes(per.mes, true))} · ${real(tot)}</span></div>
    <div class="ttk-cats-grade">
      <div>${linhas.map(([k, x]) => `<div class="ttk-cat-linha">
          <span class="ttk-cat-nome"><i class="${(TTK_CATS[k] || [])[0] === "tech" ? "ttk-f-tech" : k === "vestuario" ? "ttk-f-vest" : "ttk-f-outras"}"></i>${esc(ttkNomeCat(k))}</span>
          <span class="ttk-cat-barra"><b style="width:${maior ? (x.g / maior * 100).toFixed(1) : 0}%" class="${(TTK_CATS[k] || [])[0] === "tech" ? "ttk-f-tech" : k === "vestuario" ? "ttk-f-vest" : "ttk-f-outras"}"></b></span>
          <span class="ttk-cat-num">${ttkFmtPct(ttkPct(x.g, tot))}</span><span class="ttk-cat-valor">${real(x.g)}</span></div>`).join("") || `<p class="vazio">Sem vendas nesse período.</p>`}</div>
      <div>
        <h3 class="ttk-sub">Quanto do GMV foi Tech, mês a mês</h3>
        <div class="ttk-pilhas">${porMes.map((x) => `<div class="ttk-pilha" title="${esc(`${ttkNomeMes(x.m)}: Tech ${ttkFmtPct(x.f.tech)} · Vestuário ${ttkFmtPct(x.f.vestuario)} · Outras ${ttkFmtPct(x.f.resto)}`)}">
            <div class="ttk-pilha-col">${x.t ? TTK_FAIXAS.map(([k, , c]) => `<i class="${c}" style="height:${x.f[k].toFixed(1)}%"></i>`).join("") : ""}</div>
            <b>${x.t ? Math.round(x.f.tech) + "%" : "–"}</b><span>${ttkNomeMes(x.m)}</span></div>`).join("")}</div>
        <div class="ttk-pilha-leg">${TTK_FAIXAS.map(([, n, c]) => `<span><i class="${c}"></i>${n}</span>`).join("")}</div>
      </div>
    </div>
    ${ttkFrase(`À esquerda, cada categoria com o quanto pesou no GMV, de todas as áreas (Liquidado e Pendente). À direita, cada coluna é um mês: a parte escura é Tech, e o número embaixo é quanto do GMV daquele mês foi Tech. ${porMes.some((x) => x.t) ? `Em ${ttkNomeMes(porMes[porMes.length - 1].m)}, ${ttkFmtPct(techAgora)} do GMV foi Tech${techAntes !== techAgora ? `, contra ${ttkFmtPct(techAntes)} em ${ttkNomeMes(porMes.find((x) => x.t).m)}` : ""}.` : ""} É essa proporção que faz o TikTok te enxergar como uma categoria ou outra.`)}
  </div>`;
}

/* ---------- 2 e 3. Shop Tech e Outras categorias: os blocos de análise ---------- */
function ttkTelaAnalise(el, area) {
  if (ttkX.subcat && (TTK_CATS[ttkX.subcat] || [])[0] !== area) ttkX.subcat = "";
  const filtro = (p) => (area === "tech" ? ttkEhTech(p) : ttkEhOutras(p)) && (!ttkX.subcat || p.subcat === ttkX.subcat);
  const html = ttkComEscopo(filtro, () => {
    const per = ttkPeriodo();
    if (area === "outras") per.semPrev = true;
    const doPer = ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.ini, per.fim));
    const doAnt = per.acum ? [] : ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.iniAnt, per.fimAnt));
    const A = ttkSomar(doPer), B = per.acum ? null : ttkSomar(doAnt);
    const prev = per.acum ? null : ttkPrevisao(per);
    const meta = area === "tech" && !ttkX.subcat && !per.acum ? n2((ttkX.metas.mes || {})[per.mes] ?? (per.atual ? ttkX.metas.ultimaMeta : 0)) : 0;
    const prods = ttkProdutos(doPer), os80 = ttkOs80(prods);
    const diasCorridos = per.acum ? Math.max(1, Math.round((new Date(hojeISO()) - new Date(per.ini)) / 864e5) + 1) : per.N;
    const titulo = ttkX.subcat ? ttkNomeCat(ttkX.subcat) : area === "tech" ? "Shop Tech" : "Outras categorias";
    return ttkCabecalho(per, { titulo }) + ttkChipsSub(area) + `
      ${area === "outras" ? `<p class="sub ttk-aviso-outras">Estas vendas continuam no financeiro consolidado, mas não entram em metas, previsões, rankings nem oportunidades da operação Tech.</p>` : ""}
      <div class="ttk-mini-cards">
        <div class="ini-card"><span class="ini-rot">Liquidada ${per.acum ? "no período" : "no mês"}</span><strong class="ini-medio">${real(per.acum ? A.liq : ttkCaiu(filtro, per.ini, per.atual ? hojeISO() : per.fim))}</strong>${per.acum ? "" : ttkSelo(ttkCaiu(filtro, per.ini, per.atual ? hojeISO() : per.fim), ttkCaiu(filtro, per.iniAnt, per.atual ? `${per.ant}-${pad(Math.min(Number(hojeISO().slice(8, 10)), ttkDiasNoMes(per.ant)))}` : per.fimAnt))}<small>pendente dos pedidos ${real(A.pend)}</small></div>
        <div class="ini-card"><span class="ini-rot">GMV</span><strong class="ini-medio">${real(A.g)}</strong>${ttkSelo(A.g, B && B.g)}<small>${real(A.g / diasCorridos)} por dia</small></div>
        <div class="ini-card"><span class="ini-rot">Pedidos e unidades</span><strong class="ini-medio">${num(A.pedidos)} · ${num(A.i)}</strong><small>comissão por unidade ${real(A.iLiqNet ? A.liq / A.iLiqNet : 0)}</small></div>
        <div class="ini-card"><span class="ini-rot">Itens inelegíveis</span><strong class="ini-medio">${ttkFmtPct(ttkPct(A.iIne, A.itensTodos))}</strong>${ttkSelo(ttkPct(A.iIne, A.itensTodos), B ? ttkPct(B.iIne, B.itensTodos) : null, { pp: true, inverso: true })}<small>${num(A.iIne)} de ${num(A.itensTodos)} itens</small></div>
      </div>
      ${prods.length ? ttkBlocoRitmo(per, prev, meta) + ttkBlocoDiario(per, doPer) + ttkBlocoProduto(per, prods, os80, prev, A) + ttkBlocoStatus(A) + ttkBlocoPareto(prods) + ttkBlocoTodos(prods)
        : `<div class="ini-card ttk-bloco"><p class="vazio">Nenhuma venda nesse período.</p></div>`}`;
  });
  el.innerHTML = html;
}

/* ---------- 4. Produtos e SKUs ---------- */
function ttkTelaProdutos(el) {
  const per = ttkPeriodo();
  const filtroCat = ttkX.filtroProd || "tech";
  const porGrupo = new Map();
  ttkX.todos.forEach((p) => {
    const x = porGrupo.get(p.grupo) || { id: p.grupo, anuncios: new Set(), skus: new Set(), g: 0, i: 0, liq: 0, pend: 0, ultima: "" };
    x.anuncios.add(p.produto_id); x.skus.add(p.produto_id + "|" + p.sku_id);
    if (ttkValido(p)) { x.g += p.g; x.i += p.i; }
    if (p.cat === "liq") x.liq += p.liq; if (p.cat === "pen") x.pend += p.c;
    if (p.dia > x.ultima) x.ultima = p.dia;
    porGrupo.set(p.grupo, x);
  });
  const busca = semAcento(ttkX.buscaProd || "");
  const lista = Object.values(ttkX.grupos).filter((g) => (filtroCat === "todos" || (filtroCat === "classificar" ? g.categoria === "a_classificar" || !g.confirmado : g.categoria === filtroCat)) && (!busca || semAcento(g.nome).includes(busca)))
    .map((g) => ({ g, x: porGrupo.get(g.id) || { anuncios: new Set(), skus: new Set(), g: 0, i: 0, liq: 0, pend: 0, ultima: "" } }))
    .sort((a, b) => b.x.liq - a.x.liq || b.x.g - a.x.g);
  const naoConfirmados = Object.values(ttkX.grupos).filter((g) => !g.confirmado).length;
  const opcoesCat = Object.entries(TTK_CATS).map(([k, [a, n]]) => `<option value="${k}">${a === "tech" ? "Tech · " : ""}${esc(n)}</option>`).join("");
  el.innerHTML = ttkCabecalho(per, { titulo: "Produtos e SKUs", comMes: false }) + `
    <div class="ini-card ttk-bloco">
      <div class="ini-card-topo"><h2>Produtos comerciais</h2><span class="espaco"></span>
        <div class="ini-periodo" role="group" aria-label="Filtro">${[["tech", "Tech"], ["outras", "Outras"], ["classificar", `A conferir (${naoConfirmados})`], ["todos", "Todos"]].map(([k, n]) => `<button type="button" data-ttk-filtroprod="${k}" aria-pressed="${filtroCat === k}">${n}</button>`).join("")}</div>
        <input class="campo" id="ttk-busca-prod" type="search" placeholder="Buscar produto" value="${esc(ttkX.buscaProd || "")}" style="max-width:220px"></div>
      ${naoConfirmados ? `<p class="sub" style="margin:0 0 10px">A categoria de ${plural(naoConfirmados, "produto foi sugerida", "produtos foi sugerida")} pelo nome. Corrija o que estiver errado na coluna Categoria; quando estiver tudo certo, <button class="link-btn" type="button" id="ttk-confirmar-cats">confirme todas</button>.</p>` : ""}
      <div class="tabela-caixa"><table><thead><tr><th>Produto comercial</th><th>Categoria</th><th class="num">Anúncios</th><th class="num">Unidades</th><th class="num">GMV</th><th class="num">Liquidada</th><th class="num">Pendente</th><th>Última venda</th><th></th></tr></thead>
      <tbody>${lista.map(({ g, x }) => `<tr${ttkX.fichaGrupo === g.id ? ' class="ttk-linha-aberta"' : ""}>
        <td><div class="ttk-nome" title="${esc(g.nome)}">${esc(g.nome)}</div>${g.confirmado ? "" : `<small class="sub">categoria sugerida</small>`}</td>
        <td><select class="campo ttk-cat" data-ttk-cat="${g.id}" aria-label="Categoria">${opcoesCat.replace(`value="${g.subcategoria}"`, `value="${g.subcategoria}" selected`)}</select></td>
        <td class="num">${x.anuncios.size}</td><td class="num">${num(x.i)}</td><td class="num">${real(x.g)}</td><td class="num">${real(x.liq)}</td><td class="num">${real(x.pend)}</td><td>${dataBR(x.ultima)}</td>
        <td><button class="btn pequeno" type="button" data-ttk-ficha="${g.id}">${ttkX.fichaGrupo === g.id ? "Fechar" : "Abrir"}</button></td></tr>`).join("") || `<tr><td colspan="9"><p class="vazio">Nenhum produto aqui.</p></td></tr>`}</tbody></table></div>
      ${ttkFrase("Todo o período. Um produto comercial junta anúncios que são o mesmo produto pra você (anúncio substituído). Os pedidos continuam com o ID do anúncio e o SKU originais. Liquidada é o que já caiu; pendente é a estimativa dos pedidos que ainda vão liquidar.")}
    </div>
    ${ttkX.fichaGrupo && ttkX.grupos[ttkX.fichaGrupo] ? ttkFicha(ttkX.grupos[ttkX.fichaGrupo]) : ""}`;
}
// Ficha de um produto comercial: anúncios, SKUs separados, vídeos e evolução semanal
function ttkFicha(g) {
  const ped = ttkX.todos.filter((p) => p.grupo === g.id);
  const A = ttkSomar(ped);
  const anuncios = new Map(), skus = new Map(), vids = new Map();
  ped.forEach((p) => {
    const a = anuncios.get(p.produto_id) || { id: p.produto_id, nome: (ttkX.prodInfo[p.produto_id] || {}).nome || p.produto, loja: (ttkX.prodInfo[p.produto_id] || {}).loja || "", skus: new Set(), i: 0, g: 0, liq: 0, ultima: "" };
    a.skus.add(p.sku_id); if (ttkValido(p)) { a.i += p.i; a.g += p.g; } if (p.cat === "liq") a.liq += p.liq; if (p.dia > a.ultima) a.ultima = p.dia;
    anuncios.set(p.produto_id, a);
    const k = p.produto_id + "|" + p.sku_id;
    const s = skus.get(k) || { sku: p.sku_id, anuncio: p.produto_id, i: 0, g: 0, liq: 0, pend: 0, iTodos: 0, iIne: 0 };
    s.iTodos += p.itens; if (p.cat === "ine") s.iIne += p.itens; if (ttkValido(p)) { s.i += p.i; s.g += p.g; } if (p.cat === "liq") s.liq += p.liq; if (p.cat === "pen") s.pend += p.c;
    skus.set(k, s);
    if (p.conteudo_id && ttkValido(p)) { const v = vids.get(p.conteudo_id) || { id: p.conteudo_id, g: 0, liq: 0, tipo: p.tipo_conteudo }; v.g += p.g; v.liq += p.liq; vids.set(p.conteudo_id, v); }
  });
  // Evolução semanal: GMV das últimas 8 semanas (segunda a domingo)
  const seg = (iso) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoLocal(d); };
  const semanas = []; { let s = seg(hojeISO()); for (let n = 0; n < 8; n++) { semanas.unshift(s); s = ttkSomaDias(s, -7); } }
  const porSem = semanas.map((s) => ped.filter((p) => ttkValido(p) && p.dia >= s && p.dia <= ttkSomaDias(s, 6)).reduce((t, p) => t + p.g, 0));
  const cont = new Map(ttkX.conteudos.map((c) => [c.tiktok_video_id, c]));
  const topVids = [...vids.values()].sort((a, b) => b.liq - a.liq || b.g - a.g).slice(0, 5);
  const outrosGrupos = Object.values(ttkX.grupos).filter((x) => x.id !== g.id).sort((a, b) => a.nome.localeCompare(b.nome));
  const diasVenda = new Set(ped.filter(ttkValido).map((p) => p.dia)).size;
  return `<div class="ini-card ttk-bloco ttk-ficha">
    <div class="ini-card-topo"><div><h2>${esc(g.nome)}</h2><p class="sub" style="margin:4px 0 0">${ttkNomeCat(g.subcategoria)} · ${plural(anuncios.size, "anúncio", "anúncios")} · ${plural(skus.size, "SKU", "SKUs")} · ${plural(diasVenda, "dia com venda", "dias com venda")}</p></div><span class="espaco"></span>
      <button class="btn pequeno" type="button" id="ttk-renomear" data-grupo="${g.id}">${ic("editar")}Renomear</button></div>
    <div class="ttk-mini-cards">
      <div class="ini-card"><span class="ini-rot">Liquidada</span><strong class="ini-medio">${real(A.liq)}</strong><small>${real(A.iLiqNet ? A.liq / A.iLiqNet : 0)} por unidade</small></div>
      <div class="ini-card"><span class="ini-rot">Pendente</span><strong class="ini-medio">${real(A.pend)}</strong><small>estimada no total ${real(A.c)}</small></div>
      <div class="ini-card"><span class="ini-rot">GMV</span><strong class="ini-medio">${real(A.g)}</strong><small>${num(A.pedidos)} pedidos · ${num(A.i)} unidades</small></div>
      <div class="ini-card"><span class="ini-rot">Inelegíveis</span><strong class="ini-medio">${ttkFmtPct(ttkPct(A.iIne, A.itensTodos))}</strong><small>${num(A.iIne)} itens cancelados ou devolvidos</small></div>
    </div>
    <h3 class="ttk-sub">Evolução semanal do GMV</h3>
    ${ttkLargura(640, () => ttkGrafBarras(semanas.map((s) => dataBR(s).slice(0, 5)), porSem, { nome: "GMV por semana" }))}
    <h3 class="ttk-sub" style="margin-top:14px">Anúncios</h3>
    <div class="tabela-caixa"><table><thead><tr><th>Anúncio</th><th>Loja</th><th class="num">SKUs</th><th class="num">Unidades</th><th class="num">GMV</th><th class="num">Liquidada</th><th>Última venda</th><th>Produto comercial</th></tr></thead>
    <tbody>${[...anuncios.values()].sort((a, b) => b.ultima.localeCompare(a.ultima)).map((a) => `<tr><td><div class="ttk-nome" title="${esc(a.nome)}">${esc(a.nome)}</div><small class="sub">ID ${esc(a.id)}</small></td><td>${esc(a.loja)}</td><td class="num">${a.skus.size}</td><td class="num">${num(a.i)}</td><td class="num">${real(a.g)}</td><td class="num">${real(a.liq)}</td><td>${dataBR(a.ultima)}</td>
      <td><select class="campo" data-ttk-mover="${esc(a.id)}" aria-label="Mover anúncio"><option value="">Fica aqui</option><option value="novo">Separar num produto novo</option>${outrosGrupos.map((x) => `<option value="${x.id}">Juntar com: ${esc(x.nome.slice(0, 50))}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>
    <h3 class="ttk-sub" style="margin-top:14px">SKUs (variações), cada um separado</h3>
    <div class="tabela-caixa"><table><thead><tr><th>SKU</th><th>Anúncio</th><th class="num">Unidades</th><th class="num">GMV</th><th class="num">Liquidada</th><th class="num">Pendente</th><th class="num">% inelegível</th></tr></thead>
    <tbody>${[...skus.values()].sort((a, b) => b.g - a.g).map((s) => `<tr><td>${esc(s.sku)}</td><td><small>${esc(s.anuncio.slice(-6))}</small></td><td class="num">${num(s.i)}</td><td class="num">${real(s.g)}</td><td class="num">${real(s.liq)}</td><td class="num">${real(s.pend)}</td><td class="num">${ttkFmtPct(ttkPct(s.iIne, s.iTodos))}</td></tr>`).join("")}</tbody></table></div>
    <p class="sub" style="margin:6px 0 0">A planilha do TikTok traz só o número do SKU, não o nome da variação (cor, tamanho).</p>
    <h3 class="ttk-sub" style="margin-top:14px">Conteúdos que mais venderam este produto</h3>
    <div class="tabela-caixa"><table><thead><tr><th>Conteúdo</th><th>Tipo</th><th class="num">GMV</th><th class="num">Liquidada</th></tr></thead>
    <tbody>${topVids.map((v) => { const c = cont.get(v.id) || {}; const t = String(c.titulo || "").replace(/#\S+/g, "").trim() || `${v.tipo || "Conteúdo"} de ${dataBR((c.postado_em || "").slice(0, 10) || ttkPostadoPeloId(v.id))}`; return `<tr><td><div class="ttk-nome">${c.link ? `<a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t)}</div></td><td>${esc(v.tipo || "")}</td><td class="num">${real(v.g)}</td><td class="num">${real(v.liq)}</td></tr>`; }).join("") || `<tr><td colspan="4"><p class="vazio">Nenhum conteúdo ligado.</p></td></tr>`}</tbody></table></div>
  </div>`;
}

/* ---------- 5. Conteúdos e vídeos ---------- */
function ttkTelaConteudos(el) {
  const tech = ttkX.escopoConteudo !== "todas";
  const html = ttkComEscopo(tech ? ttkEhTech : () => true, () => {
    const per = ttkPeriodo();
    const doPer = ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.ini, per.fim));
    const doAnt = per.acum ? [] : ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.iniAnt, per.fimAnt));
    return ttkCabecalho(per, { titulo: "Conteúdos e vídeos" }) + `
      <div class="ttk-escopo"><div class="ini-periodo" role="group" aria-label="Escopo">${[["tech", "Tech"], ["todas", "Todas as categorias"]].map(([k, n]) => `<button type="button" data-ttk-escopoconteudo="${k}" aria-pressed="${(tech ? "tech" : "todas") === k}">${n}</button>`).join("")}</div></div>
      ${ttkBlocoVideos(per, doPer, doAnt)}${ttkBlocoConteudo()}`;
  });
  el.innerHTML = html + ttkBlocoDia(hojeISO(), ttkSomaDias(hojeISO(), -1));
}

/* ---------- 6. Oportunidades (só Tech) ---------- */
function ttkTelaOportunidades(el) {
  const html = ttkComEscopo(ttkEhTech, () => {
    const per = ttkPeriodo();
    const prods = ttkProdutos(ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.ini, per.fim))), os80 = ttkOs80(prods);
    // Recorrência nos últimos 30 dias: dias com venda e conteúdos diferentes que venderam
    const fim = ttkSomaDias(hojeISO(), -1), ini = ttkSomaDias(fim, -29);
    const m = new Map();
    ttkX.pedidos.filter((p) => ttkValido(p) && p.dia >= ini && p.dia <= fim).forEach((p) => {
      const x = m.get(p.grupo) || { nome: p.nomeGrupo, dias: new Set(), conteudos: new Set(), g: 0, liq: 0, pend: 0, i: 0 };
      x.dias.add(p.dia); if (p.conteudo_id) x.conteudos.add(p.conteudo_id); x.g += p.g; x.i += p.i; if (p.cat === "liq") x.liq += p.liq; else x.pend += p.c;
      m.set(p.grupo, x);
    });
    const rec = [...m.values()].map((x) => ({ ...x, sinal: x.dias.size >= 10 && x.conteudos.size >= 2 ? "Recorrente" : x.dias.size >= 4 ? "Repetindo" : "Pontual" }))
      .sort((a, b) => b.dias.size - a.dias.size || b.g - a.g);
    ttkX.tabRecorrencia = rec;
    return ttkCabecalho(per, { titulo: "Oportunidades" }) + `
      <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Recorrência dos produtos Tech</h2><span class="sub">últimos 30 dias</span><span class="espaco"></span>${ttkExportar("recorrencia")}</div>
        <div class="tabela-caixa"><table><thead><tr><th>Produto</th><th>Sinal</th><th class="num">Dias com venda</th><th class="num">Conteúdos que venderam</th><th class="num">Unidades</th><th class="num">GMV</th><th class="num">Liquidada</th><th class="num">Pendente</th></tr></thead>
        <tbody>${rec.map((x) => `<tr><td><div class="ttk-nome" title="${esc(x.nome)}">${esc(x.nome)}</div></td><td><span class="ini-selo ${x.sinal === "Recorrente" ? "sobe" : x.sinal === "Repetindo" ? "ttk-novo" : ""}">${x.sinal}</span></td><td class="num">${x.dias.size}</td><td class="num">${x.conteudos.size}</td><td class="num">${num(x.i)}</td><td class="num">${real(x.g)}</td><td class="num">${real(x.liq)}</td><td class="num">${real(x.pend)}</td></tr>`).join("") || `<tr><td colspan="8"><p class="vazio">Nenhuma venda Tech nos últimos 30 dias.</p></td></tr>`}</tbody></table></div>
        ${ttkFrase("Recorrente: vendeu em pelo menos 10 dias diferentes e por 2 ou mais conteúdos, ou seja, não depende de um vídeo só. Repetindo: vendeu em 4 dias ou mais. Pontual: poucas vendas, ainda sem prova de que repete. Produto novo fica aqui como pontual, sem ser descartado.")}</div>
      ${ttkBlocoApostas(per, os80)}`;
  });
  el.innerHTML = html;
}

/* ---------- 7. Testes e amostras ---------- */
function ttkTelaAmostras(el) {
  const per = ttkPeriodo();
  const liqDe = (a) => (a.grupo_id ? ttkX.todos.filter((p) => p.grupo === a.grupo_id && p.cat === "liq" && (!a.recebida_em || p.dia >= a.recebida_em)).reduce((s, p) => s + p.liq, 0) : 0);
  const pendDe = (a) => (a.grupo_id ? ttkX.todos.filter((p) => p.grupo === a.grupo_id && p.cat === "pen" && (!a.recebida_em || p.dia >= a.recebida_em)).reduce((s, p) => s + p.c, 0) : 0);
  const DEC = { testando: "Testando", escalar: "Escalar", novos_criativos: "Novos criativos", monitorar: "Monitorar", pausar: "Pausar" };
  const linhas = ttkX.amostras.map((a) => { const liq = liqDe(a), custoLiq = n2(a.custo) - n2(a.reembolsado); return { a, liq, pend: pendDe(a), custoLiq, saldo: liq - custoLiq, rec: custoLiq > 0 ? liq / custoLiq * 100 : null }; });
  ttkX.tabAmostras = linhas;
  el.innerHTML = ttkCabecalho(per, { titulo: "Testes e amostras", comMes: false }) + `
    <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Amostras e testes</h2><span class="espaco"></span>${ttkExportar("amostras")}<button class="btn primario pequeno" type="button" id="ttk-nova-amostra">${ic("mais")}Nova amostra</button></div>
      <div class="tabela-caixa"><table><thead><tr><th>Produto</th><th>Recebida</th><th>Prazo pra postar</th><th class="num">Custo</th><th class="num">Reembolsado</th><th class="num">Liquidada desde então</th><th class="num">Saldo</th><th class="num">Recuperação</th><th>Decisão</th><th></th></tr></thead>
      <tbody>${linhas.map(({ a, liq, pend, saldo, rec }) => { const vence = a.prazo_postar && a.prazo_postar <= ttkSomaDias(hojeISO(), 2) && a.decisao === "testando"; return `<tr>
        <td><div class="ttk-nome">${esc(a.produto)}</div>${a.grupo_id ? "" : `<small class="sub">sem produto ligado</small>`}</td>
        <td>${dataBR(a.recebida_em)}</td><td class="${vence ? "ttk-txt-ruim" : ""}">${dataBR(a.prazo_postar)}</td>
        <td class="num">${real(a.custo)}</td><td class="num">${real(a.reembolsado)}</td><td class="num">${real(liq)}${pend ? `<small class="sub" style="display:block">+ ${real(pend)} pendente</small>` : ""}</td>
        <td class="num ${saldo >= 0 ? "ttk-txt-bom" : "ttk-txt-ruim"}">${real(saldo)}</td><td class="num">${rec == null ? "–" : ttkFmtPct(rec)}</td><td>${DEC[a.decisao] || a.decisao}</td>
        <td><button class="icone-btn" type="button" data-ttk-amostra="${a.id}" aria-label="Editar">${ic("editar")}</button></td></tr>`; }).join("") || `<tr><td colspan="10"><p class="vazio">Nenhuma amostra cadastrada. Toque em Nova amostra quando receber um produto pra testar.</p></td></tr>`}</tbody></table></div>
      ${ttkFrase("Saldo = comissão liquidada do produto desde que a amostra chegou − custo líquido (custo menos o que foi reembolsado). Recuperação = liquidada ÷ custo líquido. Pendente aparece separado e não entra no saldo.")}</div>`;
}
function ttkFormAmostra(el, a) {
  const grupos = Object.values(ttkX.grupos).sort((x, y) => x.nome.localeCompare(y.nome));
  abrirForm({
    titulo: a ? "Editar amostra" : "Nova amostra",
    valores: a ? { ...a, grupo_id: a.grupo_id || "" } : { recebida_em: hojeISO(), decisao: "testando" },
    campos: [
      { n: "produto", r: "Produto", req: true, inteiro: true, ph: "Nome da amostra" },
      { n: "grupo_id", r: "Ligar ao produto do TikTok (pra contar a comissão)", t: "select", inteiro: true, op: [["", "Ainda não vende / não sei"], ...grupos.map((g) => [String(g.id), g.nome.slice(0, 70)])] },
      { n: "recebida_em", r: "Recebida em", t: "date" },
      { n: "prazo_postar", r: "Prazo pra postar", t: "date" },
      { n: "custo", r: "Custo da amostra (R$)", t: "number" },
      { n: "reembolsado", r: "Valor já reembolsado (R$)", t: "number" },
      { n: "reembolso_previsto", r: "Tem reembolso previsto", t: "check" },
      { n: "decisao", r: "Decisão", t: "select", op: [["testando", "Testando"], ["escalar", "Escalar"], ["novos_criativos", "Novos criativos"], ["monitorar", "Monitorar"], ["pausar", "Pausar"]] },
      { n: "obs", r: "Observações", t: "textarea" }
    ],
    aoSalvar: async (d) => {
      const dados = { produto: d.produto, grupo_id: d.grupo_id ? Number(d.grupo_id) : null, recebida_em: d.recebida_em || null, prazo_postar: d.prazo_postar || null, custo: n2(d.custo), reembolsado: n2(d.reembolsado), reembolso_previsto: !!d.reembolso_previsto, decisao: d.decisao || "testando", obs: d.obs || null };
      const r = a ? await db.from("ttk_amostras").update(dados).eq("id", a.id) : await db.from("ttk_amostras").insert(dados);
      if (r.error) { avisar(traduzErro(r.error), true); return false; }
      await ttkCarregarApoio(); desenharTikTok(el); return true;
    },
    aoApagar: a ? async () => { const r = await db.from("ttk_amostras").delete().eq("id", a.id); if (r.error) { avisar(traduzErro(r.error), true); return false; } await ttkCarregarApoio(); desenharTikTok(el); return true; } : null
  });
}

/* ---------- 8. LIVE ---------- */
function ttkTelaLive(el) {
  const per = ttkPeriodo();
  const lives = new Map();
  ttkX.todos.filter((p) => p.tipo_conteudo === "Live").forEach((p) => {
    const x = lives.get(p.conteudo_id) || { id: p.conteudo_id, dia: p.dia, ped: new Set(), i: 0, g: 0, liq: 0, pend: 0, prods: new Set() };
    if (p.dia < x.dia) x.dia = p.dia;
    if (ttkValido(p)) { x.ped.add(p.pedido_id); x.i += p.i; x.g += p.g; } if (p.cat === "liq") x.liq += p.liq; if (p.cat === "pen") x.pend += p.c; x.prods.add(p.nomeGrupo);
    lives.set(p.conteudo_id, x);
  });
  const l = [...lives.values()].sort((a, b) => b.dia.localeCompare(a.dia));
  el.innerHTML = ttkCabecalho(per, { titulo: "LIVE", comMes: false }) + `
    <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Vendas das lives</h2></div>
      <div class="tabela-caixa"><table><thead><tr><th>Live</th><th>Produtos</th><th class="num">Pedidos</th><th class="num">Unidades</th><th class="num">GMV</th><th class="num">Liquidada</th><th class="num">Pendente</th></tr></thead>
      <tbody>${l.map((x) => `<tr><td>${dataBR(x.dia)}<small class="sub" style="display:block">ID ${esc(String(x.id).slice(-6))}</small></td><td><div class="ttk-nome">${[...x.prods].map(esc).join(", ")}</div></td><td class="num">${x.ped.size}</td><td class="num">${num(x.i)}</td><td class="num">${real(x.g)}</td><td class="num">${real(x.liq)}</td><td class="num">${real(x.pend)}</td></tr>`).join("") || `<tr><td colspan="7"><p class="vazio">Nenhuma venda por live ainda.</p></td></tr>`}</tbody></table></div>
      ${ttkFrase("Cada linha é uma live, pela data do primeiro pedido dela. A planilha de pedidos não traz espectadores nem duração da live.")}</div>`;
}

/* ---------- 9. Histórico ---------- */
function ttkTelaHistorico(el) {
  const per = ttkPeriodo();
  const vest = ttkX.todos.filter((p) => p.subcat === "vestuario"), V = ttkSomar(vest);
  const topVest = ttkProdutos(vest).slice(0, 6);
  const fontes = ["tiktok", "owra"].map((o) => { const l = ttkX.todos.filter((p) => p.origem === o); return { o, n: l.length, ini: l.length ? l[0].dia : "", fim: l.length ? l[l.length - 1].dia : "", g: ttkSomar(l).g }; });
  el.innerHTML = ttkCabecalho(per, { titulo: "Histórico", comMes: false }) + `
    <div class="grade-2 ttk-grade2">
      <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Vestuário e calçados</h2><span class="sub">fora da operação Tech</span></div>
        <div class="ttk-meta-linhas"><div><span>GMV de todo o período</span><b>${real(V.g)}</b></div><div><span>Comissão liquidada</span><b>${real(V.liq)}</b></div><div><span>Unidades</span><b>${num(V.i)}</b></div></div>
        <div class="tabela-caixa" style="margin-top:10px"><table><thead><tr><th>Produto</th><th class="num">GMV</th><th class="num">Liquidada</th></tr></thead><tbody>${topVest.map((x) => `<tr><td><div class="ttk-nome ttk-nome-curto" title="${esc(x.nome)}">${esc(x.nome)}</div></td><td class="num">${real(x.g)}</td><td class="num">${real(x.liq)}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>De onde vieram os dados</h2></div>
        <div class="ttk-meta-linhas">${fontes.map((f) => `<div><span>${f.o === "owra" ? "Owra (histórico)" : "Planilha do TikTok"}</span><b>${num(f.n)} linhas</b></div><div><span></span><small class="sub">${f.n ? `${dataBR(f.ini)} a ${dataBR(f.fim)} · GMV ${real(f.g)}` : ""}</small></div>`).join("")}</div>
        ${ttkFrase("No histórico do Owra (até 12/08) o GMV é preço × itens, cerca de 3,5% abaixo do GMV que o TikTok mostra. Os pedidos que estavam nas duas fontes ficaram com os dados do TikTok.")}</div>
    </div>
    <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Importações</h2></div>
      <div class="tabela-caixa"><table><thead><tr><th>Quando</th><th>Arquivo</th><th>Período</th><th class="num">Linhas</th><th class="num">Novas</th><th class="num">Atualizadas</th><th class="num">Status mudou</th></tr></thead>
      <tbody>${ttkX.importacoes.map((i) => `<tr><td>${dataBR(String(i.importado_em).slice(0, 10))} ${String(new Date(i.importado_em).toTimeString()).slice(0, 5)}</td><td><div class="ttk-nome ttk-nome-curto">${esc(i.arquivo || "")}</div></td><td>${dataBR(i.periodo_ini)} a ${dataBR(i.periodo_fim)}</td><td class="num">${num(i.linhas)}</td><td class="num">${num(i.novas)}</td><td class="num">${num(i.atualizadas)}</td><td class="num">${num(i.status_mudou)}</td></tr>`).join("") || `<tr><td colspan="7"><p class="vazio">As importações passam a ficar registradas daqui pra frente.</p></td></tr>`}</tbody></table></div></div>
    <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Mudanças de status</h2><span class="sub">as 40 mais recentes</span></div>
      <div class="tabela-caixa"><table><thead><tr><th>Quando</th><th>Pedido</th><th>Antes</th><th>Depois</th><th class="num">Recebida antes</th><th class="num">Recebida depois</th></tr></thead>
      <tbody>${ttkX.historico.map((h) => `<tr><td>${dataBR(String(h.mudou_em).slice(0, 10))}</td><td><small>${esc(h.pedido_id)}</small></td><td>${esc(h.status_antes || "")}</td><td>${esc(h.status_depois || "")}</td><td class="num">${h.comissao_real_antes == null ? "–" : real(h.comissao_real_antes)}</td><td class="num">${h.comissao_real_depois == null ? "–" : real(h.comissao_real_depois)}</td></tr>`).join("") || `<tr><td colspan="6"><p class="vazio">Quando uma importação mudar o status de um pedido, a mudança aparece aqui.</p></td></tr>`}</tbody></table></div></div>`;
}

/* ---------- Financeiro: a comissão do TikTok por categoria e origem ---------- */
async function ttkCartaoFinanceiro(el) {
  if (!el || !el.isConnected) return;
  if (!ttkX.todos) { try { await ttkCarregar(); } catch (_) { return; } }
  if (ttkX.erro || !el.isConnected) return;
  const mes = ttkX.mesFin || hojeISO().slice(0, 7);
  const caiu = ttkX.todos.filter((p) => p.cat === "liq" && p.liqEm && p.liqEm.slice(0, 7) === mes);
  const linhas = [];
  Object.entries(TTK_CATS).forEach(([k, [a, n]]) => { const l = caiu.filter((p) => p.subcat === k); if (l.length) linhas.push([a === "tech" ? "Tech" : "Outras", n, l.reduce((s, p) => s + p.liq, 0), l.length]); });
  const semCat = caiu.filter((p) => !TTK_CATS[p.subcat]); if (semCat.length) linhas.push(["A classificar", "", semCat.reduce((s, p) => s + p.liq, 0), semCat.length]);
  const tot = caiu.reduce((s, p) => s + p.liq, 0), tech = caiu.filter(ttkEhTech).reduce((s, p) => s + p.liq, 0);
  const origens = {}; caiu.forEach((p) => { const k = p.tipo_conteudo || "Sem origem"; origens[k] = (origens[k] || 0) + p.liq; });
  const repasse = (S.comissoes || []).filter((c) => String(c.data).slice(0, 7) === mes).reduce((s, c) => s + n2(c.valor), 0);
  const pendente = ttkX.todos.filter((p) => p.cat === "pen").reduce((s, p) => s + p.c, 0);
  const meses = [...new Set(ttkX.todos.filter((p) => p.liqEm).map((p) => p.liqEm.slice(0, 7)))].sort().reverse();
  let caixa = $("#ttk-fin", el);
  if (!caixa) { caixa = document.createElement("section"); caixa.id = "ttk-fin"; caixa.className = "cartao"; el.appendChild(caixa); }
  caixa.innerHTML = `<div class="barra"><h2 style="margin:0">Comissão do TikTok por categoria e origem</h2><span class="espaco"></span>
      <select class="campo" id="ttk-fin-mes" aria-label="Mês">${(meses.length ? meses : [mes]).map((m) => `<option value="${m}" ${m === mes ? "selected" : ""}>${ttkNomeMes(m, true)}</option>`).join("")}</select>
      <button class="btn pequeno" type="button" data-ir-tiktok>Abrir o TikTok</button></div>
    <div class="faixa-kpi">
      <div class="kpi"><span>Caiu no mês (planilha)</span><strong>${real(tot)}</strong><small>Tech ${real(tech)} · outras ${real(tot - tech)}</small></div>
      <div class="kpi"><span>Repasses lançados no mês</span><strong>${real(repasse)}</strong><small>é o que conta no faturado</small></div>
      <div class="kpi"><span>Pendente hoje</span><strong>${real(pendente)}</strong><small>estimativa, ainda não caiu</small></div>
    </div>
    <div class="grade-2"><div class="tabela-caixa"><table><thead><tr><th>Área</th><th>Categoria</th><th class="num">Comissão</th><th class="num">Linhas</th></tr></thead>
      <tbody>${linhas.sort((a, b) => b[2] - a[2]).map((l) => `<tr><td>${l[0]}</td><td>${esc(l[1])}</td><td class="num">${real(l[2])}</td><td class="num">${l[3]}</td></tr>`).join("") || `<tr><td colspan="4"><p class="vazio">Nenhuma comissão caiu nesse mês.</p></td></tr>`}</tbody></table></div>
      <div class="tabela-caixa"><table><thead><tr><th>Origem do pedido</th><th class="num">Comissão</th></tr></thead>
      <tbody>${Object.entries(origens).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${real(v)}</td></tr>`).join("")}</tbody></table></div></div>
    <p class="sub" style="margin:8px 0 0">Pela data em que a comissão foi liquidada, segundo a planilha do TikTok. O faturado continua vindo só dos repasses de quarta, pra a mesma venda não contar duas vezes. A diferença entre as duas colunas é o tempo entre liquidar e o repasse cair.</p>`;
  $("#ttk-fin-mes", caixa).onchange = (e) => { ttkX.mesFin = e.target.value; ttkCartaoFinanceiro(el); };
  $("[data-ir-tiktok]", caixa).onclick = () => irParaSub("tiktok", "geral");
}

/* 2. GMV acumulado, ritmo do mês */
function ttkBlocoRitmo(per, prev, meta) {
  if (per.acum) {
    const meses = [...new Set(ttkX.pedidos.map((p) => p.mes))].sort();
    let ac = 0; const v = meses.map((m) => (ac += ttkX.pedidos.filter((p) => p.mes === m && ttkValido(p)).reduce((s, p) => s + p.g, 0)));
    return `<div class="ini-card ttk-bloco"><h2 class="ttk-h2">Quanto já vendi no total</h2>
      ${ttkGrafLinhas(meses.map((m) => ttkNomeMes(m)), [{ v, classe: "ttk-linha-cafe", nome: "GMV acumulado" }])}
      ${ttkFrase("A linha soma o GMV mês a mês desde o primeiro pedido. Quanto mais inclinada, mais rápido você vendeu naquele mês.")}</div>`;
  }
  const D = per.D, rot = Array.from({ length: D }, (_, i) => String(i + 1));
  let ac = 0;
  const realAc = prev.dias.slice(1).map((x) => (x.real != null ? (ac += x.real) : null));
  let ap = ac;
  const prevAc = per.atual && !per.semPrev ? prev.dias.slice(1).map((x, i) => (i + 1 === prev.k ? ac : x.prev != null ? (ap += x.prev) : null)) : null;
  const antDia = ttkPorDiaDoMes(per.ant); let aa = 0;
  const antAc = rot.map((_, i) => (i + 1 < antDia.length ? (aa += antDia[i + 1]) : null));
  const series = [{ v: antAc, classe: "ttk-linha-cinza", nome: ttkNomeMes(per.ant, true) }, { v: realAc, classe: "ttk-linha-cafe", nome: "Acumulado real" }];
  if (prevAc) series.push({ v: prevAc, classe: "ttk-linha-tracejada", nome: "Previsão" });
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>GMV acumulado, ritmo do mês</h2><span class="espaco"></span>
      <span class="ttk-leg"><i class="ttk-l-cafe"></i>Real ${per.atual ? `(até o dia ${prev.k}, ${real(ac)})` : real(ac)}</span>${per.atual && !per.semPrev ? `<span class="ttk-leg"><i class="ttk-l-tracejada"></i>Previsão ${real(prev.total)}</span>` : ""}<span class="ttk-leg"><i class="ttk-l-cinza"></i>${ttkNomeMes(per.ant, true)}</span>${meta ? `<span class="ttk-leg"><i class="ttk-l-meta"></i>Meta</span>` : ""}</div>
    ${ttkGrafLinhas(rot, series, meta ? [{ v: meta, nome: "meta " + ttkCurto(meta) }] : [])}
    ${ttkFrase(per.atual && !per.semPrev
      ? `Cada ponto é quanto o mês somou até aquele dia. A previsão mistura o ritmo deste mês com o da última semana de ${ttkNomeMes(per.ant, true)}: no começo do mês o anterior pesa mais e, a cada dia fechado, este mês ganha peso. O caminho até o fim segue como as vendas costumam se espalhar ao longo do mês (mediana dos últimos 3 meses fechados, pra um dia que viralizou não distorcer).`
      : `Cada ponto é quanto o mês somou até aquele dia. A linha cinza é ${ttkNomeMes(per.ant, true)} no mesmo dia.`)}</div>`;
}

/* 3. Ritmo diário do mês: duas barras separadas (GMV e comissão), cada uma com a sua média */
function ttkBlocoDiario(per, doPer) {
  let rot, g, c;
  if (per.acum) {
    rot = [...new Set(ttkX.pedidos.map((p) => p.mes))].sort();
    g = rot.map((m) => ttkX.pedidos.filter((p) => p.mes === m && ttkValido(p)).reduce((s, p) => s + p.g, 0));
    c = rot.map((m) => ttkX.pedidos.filter((p) => p.mes === m && ttkValido(p)).reduce((s, p) => s + p.c, 0));
    rot = rot.map((m) => ttkNomeMes(m));
  } else {
    const gd = ttkPorDiaDoMes(per.mes, "g"), cd = ttkPorDiaDoMes(per.mes, "c");
    rot = Array.from({ length: per.N }, (_, i) => String(i + 1));
    g = gd.slice(1, per.N + 1); c = cd.slice(1, per.N + 1);
  }
  const un = per.acum ? "mês" : "dia";
  return `<div class="ini-card ttk-bloco"><h2 class="ttk-h2">Ritmo ${per.acum ? "mensal" : "diário do mês"}</h2>
    <div class="ttk-dupla">
      <div><h3 class="ttk-sub">GMV por ${un}</h3>${ttkLargura(520, () => ttkGrafBarras(rot, g, { nome: "GMV por " + un }))}</div>
      <div><h3 class="ttk-sub">Comissão por ${un}</h3>${ttkLargura(520, () => ttkGrafBarras(rot, c, { classe: "ttk-barra-dourada", nome: "Comissão por " + un }))}</div>
    </div>
    ${ttkFrase(`Cada barra é um ${un}${per.acum ? "" : " do mês"}. As linhas tracejadas marcam a média por ${un}. ${per.atual && !per.acum && per.fechados < per.N ? "O último dia é hoje e ainda está em andamento." : ""}`)}</div>`;
}

/* 4. Ritmo diário por produto (só os que fazem 80% do GMV) */
function ttkBlocoProduto(per, prods, os80, prev, A) {
  const opcoes = prods.filter((x) => os80.has(x.chave));
  if (!opcoes.length) return "";
  if (!opcoes.some((x) => x.chave === ttkX.prodSel)) ttkX.prodSel = opcoes[0].chave;
  const x = opcoes.find((o) => o.chave === ttkX.prodSel), f = (p) => p.chave === x.chave;
  let corpo;
  if (per.acum) {
    const meses = [...new Set(ttkX.pedidos.map((p) => p.mes))].sort();
    const v = meses.map((m) => ttkX.pedidos.filter((p) => p.mes === m && ttkValido(p) && f(p)).reduce((s, p) => s + p.g, 0));
    corpo = `<div class="ttk-mes4">
        <div><span>% do GMV total</span><b>${ttkFmtPct(ttkPct(x.g, A.g))}</b></div>
        <div><span>GMV</span><b>${real(x.g)}</b></div><div><span>Itens</span><b>${num(x.i)}</b></div>
        <div><span>Comissão</span><b>${real(x.c)}</b></div></div>
      ${ttkGrafBarras(meses.map((m) => ttkNomeMes(m)), v, { nome: "GMV do produto por mês" })}
      ${ttkFrase("Cada barra é um mês. A linha tracejada é a média por mês desse produto.")}`;
  } else {
    const dia = ttkPorDiaDoMes(per.mes, "g", f).slice(1, per.N + 1);
    // Tendência: últimos 7 dias fechados contra os 7 anteriores
    const fimT = per.fechados ? `${per.mes}-${pad(per.fechados)}` : ttkSomaDias(per.ini, -1);
    const soma = (ini, fim) => ttkX.pedidos.filter((p) => f(p) && ttkValido(p) && p.dia >= ini && p.dia <= fim).reduce((s, p) => s + p.g, 0);
    const t1 = soma(ttkSomaDias(fimT, -6), fimT), t0 = soma(ttkSomaDias(fimT, -13), ttkSomaDias(fimT, -7));
    const antFechado = ttkX.pedidos.filter((p) => f(p) && ttkValido(p) && p.mes === per.ant).reduce((s, p) => s + p.g, 0);
    const prevProd = per.atual && !per.semPrev ? ttkPrevisao(per, f).total : x.g;
    corpo = `<div class="ttk-mes4">
        <div><span>% do GMV do mês</span><b>${ttkFmtPct(ttkPct(x.g, A.g))}</b></div>
        <div><span>Tendência 7 dias</span><b>${t0 ? `<span class="${t1 >= t0 ? "ttk-txt-bom" : "ttk-txt-ruim"}">${t1 >= t0 ? "+" : ""}${Math.round((t1 / t0 - 1) * 100)}%</span>` : t1 ? "começou agora" : "parado"}</b><small>${real(t1)} contra ${real(t0)} nos 7 dias antes</small></div>
        <div><span>Acumulado no mês</span><b>${real(x.g)}</b><small>${plural(x.i, "item", "itens")}</small></div>
        <div><span>${per.atual && !per.semPrev ? "Previsão do mês" : per.atual ? "Até agora" : "Fechou o mês"}</span><b>${real(prevProd)}</b><small>${ttkNomeMes(per.ant, true)} fechou em ${real(antFechado)} ${antFechado ? ttkSeloLivre(prevProd, antFechado) : ""}</small></div></div>
      ${ttkGrafBarras(Array.from({ length: per.N }, (_, i) => String(i + 1)), dia, { nome: "GMV do produto por dia" })}
      ${ttkFrase("Cada barra é o GMV desse produto num dia do mês. A linha tracejada é a média diária dele.")}`;
  }
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Ritmo ${per.acum ? "mensal" : "diário"} por produto</h2><span class="espaco"></span>
      <select class="campo" id="ttk-prod" aria-label="Produto" style="max-width:340px">${opcoes.map((o) => `<option value="${esc(o.chave)}" ${o.chave === x.chave ? "selected" : ""}>${esc(o.nome.slice(0, 60))}</option>`).join("")}</select></div>
    <p class="sub" style="margin:0 0 10px">Só aparecem os ${opcoes.length} produtos que fazem 80% do GMV ${per.acum ? "total" : "do mês"}.</p>
    ${corpo}</div>`;
}

/* 5. Composição do GMV por status */
function ttkBlocoStatus(A) {
  const linhas = [["liq", A.gLiq, A.iLiq], ["pen", A.gPen, A.iPen], ["ine", A.gIne, A.iIne], ["agu", A.gAgu, A.iAgu]];
  const tot = linhas.reduce((s, l) => s + l[1], 0);
  ttkX.tabStatus = linhas.map(([k, v, i]) => [TTK_STATUS[k] + (k === "ine" || k === "agu" ? " (fora do GMV)" : ""), v, ttkPct(v, tot), i]);
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Composição do GMV por status</h2><span class="espaco"></span>${ttkExportar("status")}</div>
    <div class="tabela-caixa"><table><thead><tr><th>Status</th><th class="num">Valor</th><th class="num">%</th><th class="num">Itens</th></tr></thead>
    <tbody>${linhas.map(([k, v, i]) => `<tr class="${k === "ine" || k === "agu" ? "ttk-fora" : ""}"><td>${TTK_STATUS[k]}${k === "ine" || k === "agu" ? ` <span class="ttk-fora-tag">fora do GMV</span>` : ""}</td><td class="num">${real(v)}</td><td class="num">${ttkFmtPct(ttkPct(v, tot))}</td><td class="num">${num(i)}</td></tr>`).join("")}</tbody></table></div>
    ${ttkFrase("O GMV soma só Liquidado e Pendente. Inelegível é pedido cancelado ou devolvido, e Aguardando pagamento ainda não foi pago: os dois aparecem aqui pra você ver o tamanho, mas ficam fora das contas.")}</div>`;
}

/* 6. Concentração 80/20 */
function ttkBlocoPareto(prods) {
  const chave = ttkX.pareto === "i" ? "i" : "c";
  const l = [...prods].filter((x) => x[chave] > 0).sort((a, b) => b[chave] - a[chave]);
  const tot = l.reduce((s, x) => s + x[chave], 0);
  let ac = 0, n80 = 0; for (const x of l) { ac += x[chave]; n80++; if (ac / tot >= .8) break; }
  const nome = chave === "c" ? "da comissão" : "dos itens vendidos";
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Concentração 80/20</h2><span class="sub">${l.length ? `${plural(n80, "produto", "produtos")} = 80% ${nome}` : ""}</span><span class="espaco"></span>
      <div class="ini-periodo" role="group" aria-label="Medir por">${[["c", "Comissão"], ["i", "Quantidade"]].map(([k, n]) => `<button type="button" data-ttk-pareto="${k}" aria-pressed="${chave === k}">${n}</button>`).join("")}</div></div>
    ${l.length ? ttkGrafPareto(l, chave) : `<p class="vazio">Sem vendas nesse período.</p>`}
    ${ttkFrase(`Cada barra é um produto, do que mais rende pro que menos rende, com o tamanho dele em % ${nome}. A linha dourada soma esses % até chegar a 100%. ${l.length ? `${plural(n80, "produto", "produtos")} de ${l.length} fazem 80% ${nome}.` : ""}`)}</div>`;
}

/* 7. Vídeos que mais venderam no período (pela data do pedido) */
function ttkBlocoVideos(per, doPer, doAnt) {
  const cont = new Map(ttkX.conteudos.map((c) => [c.tiktok_video_id, c]));
  const ehVideo = (p) => p.conteudo_id && (p.tipo_conteudo === "Vídeo" || cont.has(p.conteudo_id));
  const agrupa = (lista) => {
    const m = new Map();
    lista.filter((p) => ttkValido(p) && ehVideo(p)).forEach((p) => {
      const x = m.get(p.conteudo_id) || { id: p.conteudo_id, g: 0, i: 0, l: 0, prods: new Map() };
      x.g += p.g; x.i += p.i; x.l += p.liq; x.prods.set(p.nomeGrupo || p.produto, (x.prods.get(p.nomeGrupo || p.produto) || 0) + p.g); m.set(p.conteudo_id, x);
    });
    return m;
  };
  const agora = agrupa(doPer), antes = agrupa(doAnt);
  const totVideo = [...agora.values()].reduce((s, x) => s + x.g, 0);
  const top = [...agora.values()].sort((a, b) => (ttkX.ordemVideos === "liq" ? b.l - a.l || b.g - a.g : b.g - a.g)).slice(0, 10);
  if (!top.length) return `<div class="ini-card ttk-bloco"><h2 class="ttk-h2">Vídeos que mais venderam</h2><p class="vazio">Nenhuma venda por vídeo nesse período.</p></div>`;
  const ultimos = []; { let m = per.acum ? hojeISO().slice(0, 7) : per.mes; for (let n = 0; n < 6; n++) { ultimos.unshift(m); m = ttkMesAnterior(m); } }
  const somaTop = top.reduce((s, x) => s + x.g, 0), jaVendiam = top.filter((x) => antes.has(x.id)).length;
  const refFim = per.fim;
  ttkX.tabVideos = top.map((x, i) => {
    const c = cont.get(x.id) || {}, postado = (c.postado_em || "").slice(0, 10) || ttkPostadoPeloId(x.id);
    const produto = [...x.prods.entries()].sort((a, b) => b[1] - a[1])[0][0] || "";
    const meses = postado ? (Number(refFim.slice(0, 4)) - Number(postado.slice(0, 4))) * 12 + Number(refFim.slice(5, 7)) - Number(postado.slice(5, 7)) : 0;
    const quando = !postado ? "" : per.acum || meses < 1 ? `postado em ${dataBR(postado)}` : `vende há ${plural(meses, "mês", "meses")}`;
    const titulo = String(c.titulo || "").replace(/#\S+/g, "").trim() || `Vídeo de ${dataBR(postado) || "data desconhecida"}`;
    const ant = antes.get(x.id);
    const serie = ultimos.map((m) => ttkX.pedidos.filter((p) => p.conteudo_id === x.id && p.mes === m && ttkValido(p)).reduce((s, p) => s + p.g, 0));
    return { pos: i + 1, titulo, link: c.link || "", quando, produto, g: x.g, l: x.l, i: x.i, pct: ttkPct(x.g, totVideo), ant: ant ? ant.g : 0, serie };
  });
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Vídeos que mais venderam ${per.acum ? "" : "no mês"}</h2><span class="espaco"></span>
      <div class="ini-periodo" role="group" aria-label="Ordenar">${[["liq", "Por comissão liquidada"], ["gmv", "Por GMV"]].map(([k, n]) => `<button type="button" data-ttk-ordemvideos="${k}" aria-pressed="${ttkX.ordemVideos === k}">${n}</button>`).join("")}</div>${ttkExportar("videos")}</div>
    <p class="ttk-destaque">Os ${top.length} vídeos que mais venderam fizeram ${ttkFmtPct(ttkPct(somaTop, totVideo))} do GMV de vídeo ${per.acum ? "desde o começo" : `em ${MESES_LONGOS[Number(per.mes.slice(5, 7)) - 1].toLowerCase()}`}.${per.acum ? "" : ` ${jaVendiam} deles já vendiam no mês anterior.`}</p>
    <div class="tabela-caixa"><table><thead><tr><th>#</th><th>Vídeo</th><th>Produto</th><th class="num">Liquidada</th><th class="num">GMV</th><th class="num">Itens</th><th class="num">% ${per.acum ? "do total" : "do mês"}</th>${per.acum ? "" : `<th class="num">Mês anterior</th>`}<th>Mês a mês</th></tr></thead>
    <tbody>${ttkX.tabVideos.map((v) => `<tr>
      <td>${v.pos}</td>
      <td><div class="ttk-nome">${v.link ? `<a href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.titulo)}</a>` : esc(v.titulo)}</div><small class="sub">${esc(v.quando)}</small></td>
      <td><div class="ttk-nome ttk-nome-curto" title="${esc(v.produto)}">${esc(v.produto)}</div></td>
      <td class="num">${real(v.l)}</td><td class="num">${real(v.g)}</td><td class="num">${num(v.i)}</td><td class="num">${ttkFmtPct(v.pct)}</td>
      ${per.acum ? "" : `<td class="num">${v.ant ? ttkSeloLivre(v.g, v.ant) : `<span class="ini-selo ttk-novo">novo</span>`}</td>`}
      <td>${ttkMini(v.serie)}</td></tr>`).join("")}</tbody></table></div>
    ${ttkFrase(`Conta as vendas pela data do pedido, não pela data em que o vídeo foi postado. "Mês anterior" compara com o mesmo período do mês passado; "novo" quer dizer que o vídeo não vendia antes. As barrinhas são os últimos 6 meses.`)}</div>`;
}

/* 8. Todos os produtos */
function ttkBlocoTodos(prods) {
  const busca = semAcento(ttkX.busca);
  const lista = busca ? prods.filter((x) => semAcento(x.nome).includes(busca)) : prods;
  const paginas = Math.max(1, Math.ceil(lista.length / 10));
  ttkX.pagina = Math.min(ttkX.pagina, paginas - 1);
  const pag = lista.slice(ttkX.pagina * 10, ttkX.pagina * 10 + 10);
  const n80 = prods.findIndex((x) => x.acum >= 80) + 1;
  ttkX.tabProdutos = prods;
  return `<div class="ini-card ttk-bloco" id="ttk-todos"><div class="ini-card-topo"><h2>Todos os produtos</h2><span class="espaco"></span>
      <input class="campo" id="ttk-busca" type="search" placeholder="Buscar produto" value="${esc(ttkX.busca)}" style="max-width:240px">${ttkExportar("produtos")}</div>
    <div class="tabela-caixa"><table><thead><tr><th>Produto</th><th class="num">Qtde</th><th class="num">GMV</th><th class="num">Comissão</th><th class="num">% inelegível</th><th class="num">% acumulado</th></tr></thead>
    <tbody>${pag.map((x) => `<tr><td><div class="ttk-nome" title="${esc(x.nome)}">${esc(x.nome)}</div></td><td class="num">${num(x.i)}</td><td class="num">${real(x.g)}</td><td class="num">${real(x.c)}</td><td class="num">${ttkFmtPct(x.pctIne)}</td><td class="num">${ttkFmtPct(x.acum)}</td></tr>`).join("") || `<tr><td colspan="6"><p class="vazio">Nenhum produto encontrado.</p></td></tr>`}</tbody></table></div>
    <div class="barra" style="margin-top:8px"><span class="sub">Página ${ttkX.pagina + 1} de ${paginas} · ${plural(lista.length, "produto", "produtos")}</span><span class="espaco"></span>
      <button class="icone-btn" type="button" data-ttk-pag="-1" ${ttkX.pagina ? "" : "disabled"} aria-label="Página anterior">${ic("esq")}</button>
      <button class="icone-btn" type="button" data-ttk-pag="1" ${ttkX.pagina < paginas - 1 ? "" : "disabled"} aria-label="Próxima página">${ic("dir")}</button></div>
    ${ttkFrase(prods.length ? `${plural(n80 || prods.length, "produto", "produtos")} de ${prods.length} fazem 80% do seu GMV. O "% acumulado" soma o GMV de cima pra baixo.` : "Sem vendas nesse período.")}</div>`;
}

/* 9. Apostas: fora do 80%, novos ou acelerando, vendendo em pelo menos 3 dias */
function ttkBlocoApostas(per, os80) {
  const w = ttkX.janela, fim = per.acum ? ttkSomaDias(hojeISO(), -1) : per.fechados ? `${per.mes}-${pad(per.fechados)}` : ttkSomaDias(per.ini, -1);
  const iniA = ttkSomaDias(fim, -(w - 1)), fimB = ttkSomaDias(iniA, -1), iniB = ttkSomaDias(fimB, -(w - 1));
  const m = new Map();
  ttkX.pedidos.filter((p) => ttkValido(p) && p.dia >= iniB && p.dia <= fim && !os80.has(p.chave)).forEach((p) => {
    const x = m.get(p.chave) || { nome: p.produto || "Sem nome", a: 0, b: 0, dias: new Set() };
    if (p.dia >= iniA) { x.a += p.g; x.dias.add(p.dia); } else x.b += p.g;
    m.set(p.chave, x);
  });
  const apostas = [...m.values()].filter((x) => x.a > 0 && x.dias.size >= 3 && (x.b === 0 || x.a >= 1.5 * x.b))
    .map((x) => ({ ...x, tipo: x.b === 0 ? "Novo" : "Acelerando" })).sort((a, b) => b.a - a.a);
  ttkX.tabApostas = apostas;
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Apostas</h2><span class="sub">produtos fora dos 80% que estão crescendo</span><span class="espaco"></span>
      <div class="ini-periodo" role="group" aria-label="Janela">${[7, 14, 30].map((k) => `<button type="button" data-ttk-janela="${k}" aria-pressed="${w === k}">${k} dias</button>`).join("")}</div>${ttkExportar("apostas")}</div>
    ${apostas.length ? `<div class="tabela-caixa"><table><thead><tr><th>Produto</th><th>Sinal</th><th class="num">Últimos ${w} dias</th><th class="num">${w} dias antes</th><th class="num">Dias com venda</th></tr></thead>
      <tbody>${apostas.map((x) => `<tr><td><div class="ttk-nome" title="${esc(x.nome)}">${esc(x.nome)}</div></td><td><span class="ini-selo ${x.tipo === "Novo" ? "ttk-novo" : "sobe"}">${x.tipo}</span></td><td class="num">${real(x.a)}</td><td class="num">${real(x.b)}</td><td class="num">${x.dias.size}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="vazio">Nenhum produto novo ou acelerando nos últimos ${w} dias.${w < 30 ? " Tente uma janela maior." : ""}</p>`}
    ${ttkFrase(`Compara ${dataBR(iniA)} a ${dataBR(fim)} com os ${w} dias anteriores. Novo: não vendia antes. Acelerando: vendeu pelo menos 1,5 vez o da janela anterior. Os dois precisam ter vendido em pelo menos 3 dias diferentes, pra não ser um pedido solto.`)}</div>`;
}

/* 10. O que está vendendo no seu conteúdo (gancho e formato) */
function ttkBlocoConteudo() {
  if (!ttkX.conteudos.length) return "";
  const gmvVid = new Map();
  ttkX.pedidos.forEach((p) => { if (p.conteudo_id && ttkValido(p)) gmvVid.set(p.conteudo_id, (gmvVid.get(p.conteudo_id) || 0) + p.g); });
  const campo = ttkX.conteudoPor === "formato" ? "formato_categoria" : "gancho_categoria";
  const grupos = new Map();
  ttkX.conteudos.forEach((c) => {
    const cat = c[campo]; if (!cat) return;
    const nome = cat === "indeterminado" ? "Sem categoria clara" : cat;
    const l = grupos.get(nome) || []; l.push(gmvVid.get(c.tiktok_video_id) || 0); grupos.set(nome, l);
  });
  const linhas = [...grupos.entries()].map(([nome, l]) => {
    const tot = l.reduce((s, x) => s + x, 0), maior = Math.max(...l);
    const venderam = l.filter((x) => x > 0);
    return { nome, n: l.length, pctVendeu: ttkPct(venderam.length, l.length), mediana: ttkMediana(venderam), media: tot / l.length, acaso: tot > 0 && maior / tot > .5 && l.length > 1 ? Math.round(maior / tot * 100) : 0 };
  }).filter((x) => x.n >= 3).sort((a, b) => b.media - a.media);
  ttkX.tabConteudo = linhas;
  const analisados = ttkX.conteudos.filter((c) => c[campo]).length;
  return `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>O que está vendendo no seu conteúdo</h2><span class="espaco"></span>
      <div class="ini-periodo" role="group" aria-label="Agrupar por">${[["gancho", "Por gancho"], ["formato", "Por formato"]].map(([k, n]) => `<button type="button" data-ttk-conteudo="${k}" aria-pressed="${ttkX.conteudoPor === k}">${n}</button>`).join("")}</div>${ttkExportar("conteudo")}</div>
    <div class="tabela-caixa"><table><thead><tr><th>${ttkX.conteudoPor === "formato" ? "Formato" : "Tipo de gancho"}</th><th class="num">Vídeos</th><th class="num">% que venderam</th><th class="num">Mediana dos que venderam</th><th class="num">Média por vídeo</th></tr></thead>
    <tbody>${linhas.map((x) => `<tr><td>${esc(x.nome)}${x.acaso ? `<small class="ttk-aviso-acaso">1 vídeo fez ${x.acaso}% do GMV daqui: é um acaso que viralizou, não um padrão.</small>` : ""}</td><td class="num">${num(x.n)}</td><td class="num">${ttkFmtPct(x.pctVendeu)}</td><td class="num">${real(x.mediana)}</td><td class="num">${real(x.media)}</td></tr>`).join("")}</tbody></table></div>
    ${ttkFrase(`Usa os ${num(analisados)} vídeos que têm análise, com o GMV de todos os pedidos de cada um. A média divide o GMV por todos os vídeos do grupo, inclusive os que não venderam. A mediana olha só os que venderam e pega o do meio: mostra quanto um vídeo desse tipo costuma fazer quando vende, sem ser puxada por um que estourou. Grupos com menos de 3 vídeos ficam de fora.`)}</div>`;
}

/* Ontem e vídeos do dia */
function ttkBlocoDia(hoje, ontem) {
  const dia = ttkX.dia || hoje, vids = ttkX.videos.filter((v) => v.data === dia);
  const metaVideos = Number(ttkX.metas.videos) || 0, postados = vids.filter((v) => v.status === "postado").length;
  const nomeDia = dia === hoje ? "hoje" : dia === ontem ? "ontem" : dia === ttkSomaDias(hoje, 1) ? "amanhã" : dataBR(dia);
  return `<div class="ini-card ttk-bloco">
      <div class="ini-card-topo"><h2>Vídeos de ${esc(nomeDia)}</h2><span class="espaco"></span>
        <button class="icone-btn" type="button" data-ttk-dia="-1" aria-label="Dia anterior">${ic("esq")}</button>
        <button class="icone-btn" type="button" data-ttk-dia="1" aria-label="Próximo dia">${ic("dir")}</button></div>
      <p class="sub" style="margin:0 0 6px">${metaVideos ? `Meta: ${plural(metaVideos, "vídeo", "vídeos")} por dia. Postados: ${postados} de ${metaVideos}.` : "Defina quantos vídeos você quer postar por dia."} <button class="link-btn" type="button" id="ttk-meta-videos">${metaVideos ? "mudar" : "definir"}</button></p>
      ${metaVideos ? `<div class="ttk-meta-barra"><i style="width:${Math.min(100, Math.round(postados / metaVideos * 100))}%"></i></div>` : ""}
      <ul class="ttk-videos">${vids.map((v) => `<li>
        <span class="ttk-hora">${v.hora ? String(v.hora).slice(0, 5) : "--:--"}</span>
        <span class="ttk-prod">${esc(v.produto)}</span>
        <button class="pilula ttk-st-${v.status}" type="button" data-ttk-status="${v.id}" title="Toque pra mudar o status">${esc((TTK_STATUS_VIDEO.find(([k]) => k === v.status) || [0, v.status])[1])}</button>
        <button class="icone-btn" type="button" data-ttk-video="${v.id}" aria-label="Editar">${ic("editar")}</button></li>`).join("") || `<li class="sub">Nenhum vídeo planejado pra esse dia.</li>`}</ul>
      <button class="btn pequeno" type="button" id="ttk-novo-video">${ic("mais")}Adicionar vídeo</button>
    </div>`;
}

/* ---------- Ligações ---------- */
function ttkLigar(el, { per, hoje }) {
  const redesenhar = () => desenharTikTok(el);
  // Nem toda seção tem todos os botões: o que não existir vira um objeto vazio, sem quebrar
  const $ = (sel, raiz) => (raiz || document).querySelector(sel) || {};
  // Seções e filtros da área
  $$("[data-ttk-subcat]", el).forEach((b) => b.onclick = () => { ttkX.subcat = b.dataset.ttkSubcat; ttkX.pagina = 0; redesenhar(); });
  $$("[data-ttk-escopo]", el).forEach((b) => b.onclick = () => { ttkX.escopoGeral = b.dataset.ttkEscopo; redesenhar(); });
  $$("[data-ttk-escopoconteudo]", el).forEach((b) => b.onclick = () => { ttkX.escopoConteudo = b.dataset.ttkEscopoconteudo; redesenhar(); });
  $$("[data-ttk-ordemvideos]", el).forEach((b) => b.onclick = () => { ttkX.ordemVideos = b.dataset.ttkOrdemvideos; redesenhar(); });
  $$("[data-ttk-ir]", el).forEach((b) => b.onclick = () => { if (b.dataset.ttkIr === "produtos") ttkX.filtroProd = "classificar"; irParaSub("tiktok", b.dataset.ttkIr); });
  $$("[data-ttk-filtroprod]", el).forEach((b) => b.onclick = () => { ttkX.filtroProd = b.dataset.ttkFiltroprod; redesenhar(); });
  $$("[data-ttk-ficha]", el).forEach((b) => b.onclick = () => { const id = Number(b.dataset.ttkFicha); ttkX.fichaGrupo = ttkX.fichaGrupo === id ? null : id; redesenhar(); if (ttkX.fichaGrupo) setTimeout(() => { const f = el.querySelector(".ttk-ficha"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" }); }, 50); });
  const buscaProd = el.querySelector("#ttk-busca-prod");
  if (buscaProd) buscaProd.oninput = () => { ttkX.buscaProd = buscaProd.value; clearTimeout(ttkX.tBusca); ttkX.tBusca = setTimeout(() => { redesenhar(); const b = el.querySelector("#ttk-busca-prod"); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 250); };
  // Categoria de um produto comercial (vale na hora pra todas as seções)
  $$("[data-ttk-cat]", el).forEach((sel) => sel.onchange = async () => {
    const id = Number(sel.dataset.ttkCat), sub = sel.value, area = (TTK_CATS[sub] || ["outras"])[0];
    const { error } = await db.from("ttk_grupos").update({ subcategoria: sub, categoria: area, confirmado: true }).eq("id", id);
    if (error) { avisar(traduzErro(error), true); return; }
    Object.assign(ttkX.grupos[id], { subcategoria: sub, categoria: area, confirmado: true });
    ttkX.todos.forEach((x) => { if (x.grupo === id) Object.assign(x, ttkClassificar(x)); });
    avisar(`Categoria salva: ${ttkNomeCat(sub)}.`); redesenhar();
  });
  const confirmar = el.querySelector("#ttk-confirmar-cats");
  if (confirmar) confirmar.onclick = async () => {
    if (!(await confirmar_("Confirmar a categoria sugerida de todos os produtos que você ainda não mudou?", "Confirmar todas"))) return;
    const { error } = await db.from("ttk_grupos").update({ confirmado: true }).eq("confirmado", false).neq("categoria", "a_classificar");
    if (error) { avisar(traduzErro(error), true); return; }
    await ttkCarregarApoio(); avisar("Categorias confirmadas."); redesenhar();
  };
  // Mover um anúncio pra outro produto comercial (o pedido não muda, só o vínculo)
  $$("[data-ttk-mover]", el).forEach((sel) => sel.onchange = async () => {
    const pid = sel.dataset.ttkMover, alvo = sel.value; if (!alvo) return;
    let gid = Number(alvo);
    if (alvo === "novo") {
      const info = ttkX.prodInfo[pid] || {}, atual = ttkX.grupos[ttkX.prodGrupo[pid]] || {};
      const { data, error } = await db.from("ttk_grupos").insert({ nome: String(info.nome || "Produto").slice(0, 200), categoria: atual.categoria || "a_classificar", subcategoria: atual.subcategoria || null, confirmado: !!atual.confirmado }).select("id").single();
      if (error) { avisar(traduzErro(error), true); return; }
      gid = data.id;
    }
    const { error } = await db.from("ttk_produtos").update({ grupo_id: gid }).eq("produto_id", pid);
    if (error) { avisar(traduzErro(error), true); return; }
    await ttkCarregarApoio(); ttkX.fichaGrupo = gid; avisar("Anúncio movido. Os pedidos dele continuam iguais."); redesenhar();
  });
  const renomear = el.querySelector("#ttk-renomear");
  if (renomear) renomear.onclick = () => { const g = ttkX.grupos[Number(renomear.dataset.grupo)]; abrirForm({ titulo: "Nome do produto comercial", valores: { nome: g.nome }, campos: [{ n: "nome", r: "Nome", req: true, inteiro: true }],
    aoSalvar: async (d) => { const { error } = await db.from("ttk_grupos").update({ nome: d.nome.slice(0, 200) }).eq("id", g.id); if (error) { avisar(traduzErro(error), true); return false; } await ttkCarregarApoio(); redesenhar(); return true; } }); };
  const novaAmostra = el.querySelector("#ttk-nova-amostra"); if (novaAmostra) novaAmostra.onclick = () => ttkFormAmostra(el, null);
  $$("[data-ttk-amostra]", el).forEach((b) => b.onclick = () => ttkFormAmostra(el, ttkX.amostras.find((a) => String(a.id) === b.dataset.ttkAmostra)));
  $("#ttk-arquivo", el).onchange = (e) => { const a = e.target.files[0]; e.target.value = ""; if (a) ttkImportar(a, el); };
  $("#ttk-mes", el).onchange = (e) => { ttkX.mes = e.target.value; ttkX.pagina = 0; redesenhar(); };
  $$("[data-ttk-modo]", el).forEach((b) => b.onclick = () => { ttkX.modo = b.dataset.ttkModo; ttkX.pagina = 0; redesenhar(); });
  const prod = $("#ttk-prod", el); if (prod) prod.onchange = (e) => { ttkX.prodSel = e.target.value; redesenhar(); };
  $$("[data-ttk-pareto]", el).forEach((b) => b.onclick = () => { ttkX.pareto = b.dataset.ttkPareto; redesenhar(); });
  $$("[data-ttk-janela]", el).forEach((b) => b.onclick = () => { ttkX.janela = Number(b.dataset.ttkJanela); redesenhar(); });
  $$("[data-ttk-conteudo]", el).forEach((b) => b.onclick = () => { ttkX.conteudoPor = b.dataset.ttkConteudo; redesenhar(); });
  $$("[data-ttk-pag]", el).forEach((b) => b.onclick = () => { ttkX.pagina += Number(b.dataset.ttkPag); redesenhar(); $("#ttk-todos", el).scrollIntoView({ block: "nearest" }); });
  const busca = $("#ttk-busca", el);
  if (busca) busca.oninput = () => {
    ttkX.busca = busca.value; ttkX.pagina = 0;
    clearTimeout(ttkX.tBusca);
    ttkX.tBusca = setTimeout(() => { redesenhar(); const b = $("#ttk-busca", el); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 250);
  };
  // Exportar as tabelas
  const sufixo = per.acum ? "acumulado" : per.mes;
  $$("[data-ttk-exportar]", el).forEach((b) => b.onclick = () => {
    const br = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");
    const t = b.dataset.ttkExportar;
    if (t === "status") baixarCSV(`tiktok-status-${sufixo}`, ["Status", "Valor", "%", "Itens"], ttkX.tabStatus.map((l) => [l[0], br(l[1]), br(l[2]), l[3]]));
    if (t === "produtos") baixarCSV(`tiktok-produtos-${sufixo}`, ["Produto", "Qtde", "GMV", "Comissão", "% inelegível", "% acumulado"], ttkX.tabProdutos.map((x) => [x.nome, x.i, br(x.g), br(x.c), br(x.pctIne), br(x.acum)]));
    if (t === "apostas") baixarCSV(`tiktok-apostas-${ttkX.janela}-dias`, ["Produto", "Sinal", "GMV na janela", "GMV na janela anterior", "Dias com venda"], ttkX.tabApostas.map((x) => [x.nome, x.tipo, br(x.a), br(x.b), x.dias.size]));
    if (t === "recorrencia") baixarCSV("tiktok-recorrencia-tech-30-dias", ["Produto", "Sinal", "Dias com venda", "Conteúdos que venderam", "Unidades", "GMV", "Liquidada", "Pendente"], ttkX.tabRecorrencia.map((x) => [x.nome, x.sinal, x.dias.size, x.conteudos.size, x.i, br(x.g), br(x.liq), br(x.pend)]));
    if (t === "amostras") baixarCSV("tiktok-amostras", ["Produto", "Recebida", "Prazo", "Custo", "Reembolsado", "Liquidada", "Pendente", "Saldo", "Recuperação %", "Decisão"], ttkX.tabAmostras.map((x) => [x.a.produto, x.a.recebida_em || "", x.a.prazo_postar || "", br(n2(x.a.custo)), br(n2(x.a.reembolsado)), br(x.liq), br(x.pend), br(x.saldo), x.rec == null ? "" : br(x.rec), x.a.decisao]));
    if (t === "videos") baixarCSV(`tiktok-videos-${sufixo}`, ["Posição", "Vídeo", "Quando", "Link", "Produto", "Comissão liquidada", "GMV", "Itens", "% do GMV de vídeo", "GMV no período anterior"], ttkX.tabVideos.map((v) => [v.pos, v.titulo, v.quando, v.link, v.produto, br(v.l), br(v.g), v.i, br(v.pct), br(v.ant)]));
    if (t === "conteudo") baixarCSV(`tiktok-conteudo-${ttkX.conteudoPor}`, ["Categoria", "Vídeos", "% que venderam", "Mediana dos que venderam", "Média por vídeo", "Um vídeo fez % do GMV"], ttkX.tabConteudo.map((x) => [x.nome, x.n, br(x.pctVendeu), br(x.mediana), br(x.media), x.acaso || ""]));
  });
  const btnMeta = $("#ttk-meta", el);
  if (btnMeta) btnMeta.onclick = () => abrirForm({
    titulo: `Meta de GMV Tech de ${ttkNomeMes(per.mes, true)}`,
    valores: { valor: n2((ttkX.metas.mes || {})[per.mes]) || "" },
    campos: [{ n: "valor", r: "Meta de GMV Tech do mês (R$)", t: "number", req: true }],
    aoSalvar: async (d) => {
      ttkX.metas.mes = ttkX.metas.mes || {};
      ttkX.metas.mes[per.mes] = n2(d.valor); if (per.atual) ttkX.metas.ultimaMeta = n2(d.valor);
      const ok = await ttkSalvarMetas(); if (ok) redesenhar(); return ok;
    }
  });
  // Vídeos do dia
  const dia = ttkX.dia || hoje;
  $("#ttk-meta-videos", el).onclick = () => abrirForm({
    titulo: "Meta de vídeos por dia",
    valores: { videos: Number(ttkX.metas.videos) || "" },
    campos: [{ n: "videos", r: "Quantos vídeos por dia", t: "number", req: true }],
    aoSalvar: async (d) => { ttkX.metas.videos = Math.round(n2(d.videos)); const ok = await ttkSalvarMetas(); if (ok) redesenhar(); return ok; }
  });
  $$("[data-ttk-dia]", el).forEach((b) => b.onclick = () => { ttkX.dia = ttkSomaDias(dia, Number(b.dataset.ttkDia)); redesenhar(); });
  $$("[data-ttk-status]", el).forEach((b) => b.onclick = async () => {
    const v = ttkX.videos.find((x) => String(x.id) === b.dataset.ttkStatus); if (!v) return;
    const i = TTK_STATUS_VIDEO.findIndex(([k]) => k === v.status), novo = TTK_STATUS_VIDEO[(i + 1) % TTK_STATUS_VIDEO.length][0];
    const { error } = await db.from("ttk_videos").update({ status: novo }).eq("id", v.id);
    if (error) { avisar(traduzErro(error), true); return; }
    v.status = novo; redesenhar();
  });
  $$("[data-ttk-video]", el).forEach((b) => b.onclick = () => ttkFormVideo(el, ttkX.videos.find((x) => String(x.id) === b.dataset.ttkVideo), dia));
  $("#ttk-novo-video", el).onclick = () => ttkFormVideo(el, null, dia);
}

function ttkFormVideo(el, v, dia) {
  const nomes = [...new Set(ttkX.pedidos.slice(-2000).filter(ttkValido).map((p) => p.produto).filter(Boolean))].slice(0, 80);
  abrirForm({
    titulo: v ? "Editar vídeo" : "Novo vídeo",
    valores: v ? { ...v, hora: v.hora ? String(v.hora).slice(0, 5) : "" } : { data: dia, status: "rascunho" },
    campos: [
      { n: "produto", r: "Produto", req: true, inteiro: true, lista: nomes, ph: "Comece a digitar ou escolha um que já vende" },
      { n: "data", r: "Dia", t: "date", req: true },
      { n: "hora", r: "Horário", t: "time" },
      { n: "status", r: "Status", t: "select", op: TTK_STATUS_VIDEO }
    ],
    aoSalvar: async (d) => {
      const dados = { produto: d.produto, data: d.data, hora: d.hora || null, status: d.status || "rascunho" };
      const r = v ? await db.from("ttk_videos").update(dados).eq("id", v.id).select().single() : await db.from("ttk_videos").insert(dados).select().single();
      if (r.error) { avisar(traduzErro(r.error), true); return false; }
      ttkX.videos = ttkX.videos.filter((x) => x.id !== r.data.id).concat(r.data).sort((a, b) => String(a.hora || "99").localeCompare(String(b.hora || "99")));
      ttkX.dia = d.data; desenharTikTok(el); return true;
    },
    aoApagar: v ? async () => {
      const { error } = await db.from("ttk_videos").delete().eq("id", v.id);
      if (error) { avisar(traduzErro(error), true); return false; }
      ttkX.videos = ttkX.videos.filter((x) => x.id !== v.id); desenharTikTok(el); return true;
    } : null
  });
}

// Lê o arquivo do TikTok, confere as colunas e grava. Pedido + SKU já existente só é atualizado.
async function ttkImportar(arq, el) {
  avisar("Lendo o arquivo...");
  let linhas;
  try {
    const XLSX = await carregarLeitorPlanilha();
    const wb = XLSX.read(await arq.arrayBuffer(), { type: "array", cellDates: true });
    linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
  } catch (e) { avisar(e.message || "Não consegui ler esse arquivo.", true); return; }
  const tit = (linhas[0] || []).map((c) => String(c).replace(/\s+/g, " ").trim());
  const idx = {};
  for (const [k, nome] of Object.entries(TTK_COLUNAS)) idx[k] = tit.indexOf(nome);
  const faltam = ["pedido_id", "gmv", "data"].filter((k) => idx[k] < 0);
  if (faltam.length) { avisar(`Esse arquivo não parece o de Pedidos de afiliados: faltam as colunas ${faltam.map((k) => TTK_COLUNAS[k]).join(", ")}.`, true); return; }
  const cel = (l, k) => (idx[k] >= 0 ? l[idx[k]] : "");
  const txt = (l, k, max) => { const v = String(cel(l, k) ?? "").trim(); return v ? v.slice(0, max) : null; };
  const agora = new Date().toISOString(), porChave = new Map();
  let semData = 0;
  linhas.slice(1).forEach((l) => {
    const pedido = txt(l, "pedido_id", 40); if (!pedido) return;
    const data = ttkData(cel(l, "data")); if (!data) { semData++; return; }
    const recebido = ttkNum(cel(l, "recebido")), liq = ttkData(cel(l, "liquidado"));
    const p = {
      pedido_id: pedido, sku_id: txt(l, "sku_id", 40) || "", produto_id: txt(l, "produto_id", 40), produto: txt(l, "produto", 400), loja: txt(l, "loja", 200),
      itens: Math.round(ttkNum(cel(l, "itens"))), reembolsados: Math.round(ttkNum(cel(l, "reembolsados"))),
      status: ttkStatusPt(txt(l, "status", 40)), tipo_conteudo: txt(l, "tipo_conteudo", 40), conteudo_id: txt(l, "conteudo_id", 40),
      gmv: ttkNum(cel(l, "gmv")), comissao_est: Math.round((ttkNum(cel(l, "padrao")) + ttkNum(cel(l, "anuncios")) + ttkNum(cel(l, "bonus"))) * 100) / 100,
      comissao_real: recebido || null, data, liquidado_em: liq, atualizado_em: agora
    };
    porChave.set(p.pedido_id + "|" + p.sku_id, p);
  });
  const lista = [...porChave.values()];
  if (!lista.length) { avisar("Não achei nenhum pedido nesse arquivo.", true); return; }
  const existiam = new Map(), ids = [...new Set(lista.map((p) => p.pedido_id))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("ttk_pedidos").select("pedido_id,sku_id,status").in("pedido_id", ids.slice(i, i + 200));
    if (error) { avisar(traduzErro(error), true); return; }
    data.forEach((x) => existiam.set(x.pedido_id + "|" + x.sku_id, x.status));
  }
  for (let i = 0; i < lista.length; i += 500) {
    avisar(`Gravando pedidos... ${Math.min(i + 500, lista.length)} de ${lista.length}`);
    const { error } = await db.from("ttk_pedidos").upsert(lista.slice(i, i + 500), { onConflict: "pedido_id,sku_id" });
    if (error) { avisar(traduzErro(error), true); return; }
  }
  const novos = lista.filter((p) => !existiam.has(p.pedido_id + "|" + p.sku_id)).length;
  const mudou = lista.filter((p) => existiam.has(p.pedido_id + "|" + p.sku_id) && existiam.get(p.pedido_id + "|" + p.sku_id) !== p.status).length;
  const datas = lista.map((p) => p.data).sort();
  await db.from("ttk_importacoes").insert({ arquivo: String(arq.name || "").slice(0, 200), origem: "tiktok", periodo_ini: datas[0], periodo_fim: datas[datas.length - 1], linhas: lista.length, novas: novos, atualizadas: lista.length - novos, status_mudou: mudou });
  // Anúncio que ainda não tem produto comercial: cria um com a categoria sugerida pelo nome
  const semGrupo = new Map(); lista.forEach((p) => { if (p.produto_id && ttkX.prodGrupo[p.produto_id] == null && !semGrupo.has(p.produto_id)) semGrupo.set(p.produto_id, p); });
  for (const p of semGrupo.values()) {
    const sub = ttkSugerir(p.produto);
    const { data: g } = await db.from("ttk_grupos").insert({ nome: String(p.produto || "Produto").replace(/\s+/g, " ").slice(0, 120), categoria: TTK_CATS[sub][0], subcategoria: sub, confirmado: false }).select("id").single();
    if (g) await db.from("ttk_produtos").insert({ produto_id: p.produto_id, grupo_id: g.id, nome: String(p.produto || "").slice(0, 120), loja: p.loja });
  }
  ttkX.todos = ttkX.pedidos = null;
  await desenharTikTok(el);
  avisar(`Pronto: ${plural(novos, "pedido novo", "pedidos novos")} e ${plural(lista.length - novos, "atualizado", "atualizados")}${mudou ? `, ${plural(mudou, "mudou de status", "mudaram de status")}` : ""}.${semGrupo.size ? ` ${plural(semGrupo.size, "produto novo ganhou", "produtos novos ganharam")} categoria sugerida: confira em Produtos e SKUs.` : ""}${semData ? ` ${semData} linhas sem data ficaram de fora.` : ""}`);
}

// Estilos só desta aba. Os quadros do topo usam as classes do Dashboard (ini-*, em admin.css)
(() => {
  const s = document.createElement("style");
  s.textContent = `
    .ttk-cabeca { margin-top: 0; }
    .ttk-titulo-grande { font-family: "Playfair Display", Georgia, serif; font-weight: 500; font-size: clamp(30px, 4vw, 46px); line-height: 1.02; letter-spacing: -.02em; margin: 0; color: var(--cobalt); }
    .ttk-controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ttk-etiqueta { padding: 4px 11px; border-radius: 999px; background: rgba(246, 242, 235, .12); color: rgba(246, 242, 235, .85); font-size: 11.5px; font-weight: 700; letter-spacing: .04em; }
    .ttk-etiqueta-clara { background: var(--tint); color: var(--muted); }
    .ttk-seg-linha { display: flex; gap: 28px; margin-top: 18px; }
    .ttk-seg-linha .ini-medio { font-size: 22px; }
    .ttk-status-linha { margin: 14px 0 0; font-size: 11.5px; color: rgba(246, 242, 235, .62); }
    .ttk-alc-linha { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .ttk-alc-linha .ini-medio { font-size: 22px; }
    .ini-seg .ini-grande { font-size: clamp(32px, 3.4vw, 44px); }
    .ttk-meta-nums { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .ttk-meta-barra { position: relative; height: 8px; border-radius: 999px; background: var(--tint); margin: 12px 0 14px; }
    .ttk-meta-barra i { display: block; height: 100%; border-radius: 999px; background: var(--cobalt); }
    .ttk-meta-barra b { position: absolute; top: -4px; width: 3px; height: 16px; margin-left: -1.5px; border-radius: 2px; background: var(--olive); }
    .ttk-meta-linhas { display: grid; gap: 8px; }
    .ttk-meta-linhas > div { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; }
    .ttk-meta-linhas span:first-child { color: var(--muted); font-weight: 600; }
    .ttk-meta-linhas b { display: flex; align-items: center; gap: 6px; }
    .ttk-meta-linhas .ini-selo { margin-top: 0; }
    .ttk-com .ini-alc-nums .ini-medio, .ttk-ontem .ini-medio { font-size: clamp(18px, 1.55vw, 24px); white-space: nowrap; }
    .ttk-com .ini-alc-nums { gap: 14px; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr) minmax(0, 1fr); }
    .ttk-ontem-nums { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 12px; }
    .ttk-mini-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
    .ttk-mini-cards .ini-card { padding: 16px 18px; }
    .ttk-mini-cards .ini-rot { margin: 0 0 6px; }
    .ttk-mini-cards small { display: block; margin-top: 6px; font-size: 11.5px; color: var(--muted); }
    @media (max-width: 1000px) { .ttk-mini-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .ttk-bloco { margin-bottom: 16px; }
    .ttk-bloco .ini-card-topo { flex-wrap: wrap; justify-content: flex-start; }
    .ttk-bloco .ini-card-topo .espaco { flex: 1; }
    .ttk-bloco .ini-card-topo .sub { font-size: 12.5px; }
    .ttk-h2 { margin: 0 0 14px !important; }
    .ttk-frase { font-size: 12.5px; color: var(--muted); margin: 10px 0 0; line-height: 1.45; }
    .ttk-destaque { margin: 0 0 12px; font-size: 14px; }
    .ttk-sub { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 2px; }
    .ttk-caixa { margin-top: 4px; }
    .ttk-graf { width: 100%; height: auto; display: block; max-height: 300px; overflow: visible; }
    .ttk-grade { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 4; }
    .ttk-base { stroke: var(--line); stroke-width: 1; }
    .ttk-eixo { font-size: 11px; fill: var(--muted); font-family: inherit; }
    .ttk-linha-cafe { fill: none; stroke: var(--cobalt); stroke-width: 2.4; stroke-linejoin: round; stroke-linecap: round; }
    .ttk-linha-tracejada { fill: none; stroke: var(--olive); stroke-width: 2.2; stroke-dasharray: 7 5; stroke-linecap: round; }
    .ttk-linha-cinza { fill: none; stroke: var(--muted); stroke-opacity: .35; stroke-width: 2; }
    .ttk-linha-dourada { fill: none; stroke: var(--olive); stroke-width: 2.4; stroke-linejoin: round; }
    .ttk-ponto { fill: var(--cobalt); stroke: var(--card); stroke-width: 2; }
    .ttk-meta { stroke: var(--red); stroke-opacity: .55; stroke-width: 1.4; stroke-dasharray: 3 3; }
    .ttk-media { stroke: var(--text); stroke-opacity: .5; stroke-width: 1.2; stroke-dasharray: 5 4; }
    .ttk-barra-cafe { fill: var(--cobalt); } .ttk-barra-dourada { fill: var(--olive); } .ttk-barra-cinza { fill: var(--muted); fill-opacity: .3; }
    .ttk-leg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); margin-left: 10px; }
    .ttk-leg i { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
    .ttk-l-cafe { border-color: var(--cobalt) !important; } .ttk-l-tracejada { border-color: var(--olive) !important; border-top-style: dashed !important; }
    .ttk-l-cinza { border-color: var(--muted) !important; opacity: .5; } .ttk-l-meta { border-color: var(--red) !important; border-top-style: dotted !important; }
    .ttk-dupla { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .ttk-dupla { grid-template-columns: 1fr; } }
    .ttk-mes4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .ttk-mes4 > div > span { display: block; font-size: 10.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .ttk-mes4 b { display: block; font-size: 22px; color: var(--cobalt); margin-top: 2px; }
    .ttk-mes4 small { display: block; font-size: 11.5px; color: var(--muted); }
    .ttk-mes4 .ini-selo { margin: 4px 4px 0 0; }
    .ini-selo.ttk-novo { background: var(--olive-tint); color: #6b5426; }
    .ttk-txt-bom { color: var(--green); } .ttk-txt-ruim { color: var(--red); }
    .ttk-bloco td .ini-selo { margin-top: 0; }
    .ttk-fora td { color: var(--muted); }
    .ttk-fora-tag { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 700; background: var(--tint); color: var(--muted); }
    .ttk-nome { max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-nome-curto { max-width: 220px; }
    .ttk-mini { width: 72px; height: 22px; display: block; }
    .ttk-aviso-acaso { display: block; color: #8a5a00; font-size: 11.5px; margin-top: 2px; }
    .ttk-videos { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 6px; }
    .ttk-videos li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 12px; }
    .ttk-videos li.sub { border-style: dashed; }
    .ttk-hora { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 44px; }
    .ttk-prod { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-videos .pilula { border: 0; cursor: pointer; }
    .ttk-st-rascunho { background: var(--tint); color: var(--muted); }
    .ttk-st-agendado { background: var(--olive-tint); color: #5d5a3c; }
    .ttk-st-postado { background: var(--green-bg); color: var(--green); }
    .ttk-escopo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: -6px 0 16px; }
    .ttk-subcats { flex-wrap: wrap; margin: -6px 0 16px; border-radius: 16px; }
    .ttk-aviso-outras { margin: -6px 0 14px; }
    .ttk-alerta { display: block; margin-top: 12px; color: var(--amber); font-weight: 700; }
    .ttk-cat { max-width: 210px; font-size: 12.5px; padding: 4px 8px; }
    .ttk-linha-aberta td { background: var(--olive-tint); }
    .ttk-ficha { border: 1.5px solid var(--olive); }
    .ttk-ficha .ini-card-topo h2 { font-size: 20px; }
    #ttk-fin .grade-2 { grid-template-columns: 2fr 1fr; }
    .ttk-cats-grade { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 28px; align-items: start; }
    @media (max-width: 900px) { .ttk-cats-grade { grid-template-columns: 1fr; } }
    .ttk-cat-linha { display: grid; grid-template-columns: minmax(120px, 1.1fr) minmax(60px, 1.4fr) 54px 96px; gap: 10px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
    .ttk-cat-linha:last-child { border-bottom: 0; }
    .ttk-cat-nome { display: flex; align-items: center; gap: 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-cat-nome i { flex: none; width: 9px; height: 9px; border-radius: 50%; }
    .ttk-cat-barra { height: 8px; border-radius: 999px; background: var(--tint); overflow: hidden; }
    .ttk-cat-barra b { display: block; height: 100%; border-radius: 999px; }
    .ttk-cat-num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
    .ttk-cat-valor { text-align: right; color: var(--muted); font-variant-numeric: tabular-nums; }
    .ttk-f-tech { background: var(--cobalt); } .ttk-f-vest { background: var(--olive); } .ttk-f-outras { background: rgba(122, 110, 96, .35); }
    .ttk-pilhas { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; align-items: end; margin-top: 6px; }
    .ttk-pilha { display: grid; justify-items: center; gap: 4px; font-size: 11.5px; color: var(--muted); }
    .ttk-pilha-col { width: 100%; max-width: 38px; height: 120px; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column-reverse; background: var(--tint); gap: 2px; }
    .ttk-pilha-col i { display: block; width: 100%; }
    .ttk-pilha b { color: var(--cobalt); font-size: 13px; }
    .ttk-pilha-leg { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 10px; font-size: 12px; color: var(--muted); }
    .ttk-pilha-leg span { display: inline-flex; align-items: center; gap: 6px; }
    .ttk-pilha-leg i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }`;
  document.head.appendChild(s);
})();

DESENHOS.tiktok = desenharTikTok;
const confirmar_ = (t, r) => confirmar(t, r);

// O menu tem um item por seção (data-aba="tiktok" data-sub="..."). Ensina o roteador do painel a lembrar a seção.
{
  const subOriginal = subDaAba, irSubOriginal = irParaSub, enderecoOriginal = irParaEndereco;
  subDaAba = (aba) => (aba === "tiktok" ? ttkX.sub : subOriginal(aba));
  irParaSub = (aba, sub) => { if (aba === "tiktok") { ttkX.sub = sub; ttkX.subcat = ""; try { localStorage.setItem("ttk-sub", sub); } catch (_) {} irPara("tiktok"); return; } irSubOriginal(aba, sub); };
  irParaEndereco = () => {
    const alvo = (location.hash || "").slice(1);
    const m = alvo.match(/^tiktok(?:-(\w+))?$/);
    if (m) { ttkX.sub = TTK_SUBS.some(([k]) => k === m[1]) ? m[1] : "geral"; irPara("tiktok"); return; }
    enderecoOriginal();
  };
  try { const s = localStorage.getItem("ttk-sub"); if (s && TTK_SUBS.some(([k]) => k === s)) ttkX.sub = s; } catch (_) {}
}
// No Financeiro, depois de desenhar, entra o cartão da comissão do TikTok por categoria e origem
{
  const finOriginal = DESENHOS.financeiro;
  DESENHOS.financeiro = (el) => { finOriginal(el); ttkCartaoFinanceiro(el); };
}
