/* =============================================================
   ABA TIKTOK SHOP (#tiktok)
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
  prodSel: "", pareto: "com", busca: "", pagina: 0, janela: 14, conteudoPor: "gancho"
};
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
const ttkCat = (s) => (s === "Liquidado" ? "liq" : s === "Inelegível" ? "ine" : s === "Aguardando pagamento" || s === "AwaitingPayment" ? "agu" : "pen");
const ttkValido = (p) => p.cat === "liq" || p.cat === "pen";
const ttkMediana = (l) => { if (!l.length) return 0; const s = [...l].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// Os 32 primeiros bits do ID de um vídeo do TikTok são o momento em que ele foi postado
const ttkPostadoPeloId = (id) => { try { return isoLocal(new Date(Number(BigInt(id) >> 32n) * 1000)); } catch (_) { return ""; } };

// Pílula de variação: verde se subiu, vermelho se caiu (inverso: subir é ruim)
function ttkPilula(v, ant, { pp = false, inverso = false } = {}) {
  if (ant == null || ttkX.modo === "acum") return "";
  let d, txt;
  if (pp) { d = v - ant; txt = `${d >= 0 ? "+" : ""}${String(Math.round(d * 10) / 10).replace(".", ",")} p.p.`; }
  else { if (!ant) return v ? `<span class="ttk-pill ttk-novo">novo</span>` : ""; d = (v / ant - 1) * 100; txt = `${d >= 0 ? "+" : ""}${Math.round(d)}%`; }
  if (Math.abs(d) < 0.05) return `<span class="ttk-pill">0%</span>`;
  const bom = inverso ? d < 0 : d > 0;
  return `<span class="ttk-pill ${bom ? "ttk-bom" : "ttk-ruim"}" title="contra o mesmo período do mês anterior">${txt}</span>`;
}
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
  try {
    const ped = await ttkLerTudo("ttk_pedidos", "pedido_id,sku_id,produto_id,produto,status,tipo_conteudo,conteudo_id,gmv,comissao_est,itens,data", "data");
    ttkX.pedidos = ped.map((p) => ({
      ...p, g: n2(p.gmv), c: n2(p.comissao_est), i: Number(p.itens) || 0, cat: ttkCat(p.status),
      dia: String(p.data).slice(0, 10), mes: String(p.data).slice(0, 7), chave: p.produto_id || p.produto || "?"
    }));
  } catch (e) { ttkX.erro = traduzErro(e); ttkX.pedidos = []; ttkX.conteudos = []; ttkX.videos = []; ttkX.metas = {}; return; }
  try { ttkX.conteudos = await ttkLerTudo("ttk_conteudos", "tiktok_video_id,postado_em,titulo,link,gancho_categoria,formato_categoria", "tiktok_video_id"); }
  catch (_) { ttkX.conteudos = []; }
  const { data: vids } = await db.from("ttk_videos").select("*").gte("data", ttkSomaDias(hojeISO(), -30)).order("hora", { ascending: true, nullsFirst: false });
  ttkX.videos = vids || [];
  const { data: pref } = await db.from("preferencias").select("valor").eq("chave", "ttk_metas").maybeSingle();
  try { ttkX.metas = pref && pref.valor ? JSON.parse(pref.valor) : {}; } catch (_) { ttkX.metas = {}; }
}
async function ttkSalvarMetas() {
  const { error } = await db.from("preferencias").upsert({ chave: "ttk_metas", valor: JSON.stringify(ttkX.metas), atualizado_em: new Date().toISOString() });
  if (error) { avisar(traduzErro(error), true); return false; }
  return true;
}

/* ---------- Contas ---------- */
function ttkSomar(lista) {
  const t = { g: 0, c: 0, i: 0, ped: new Set(), gLiq: 0, gPen: 0, gIne: 0, gAgu: 0, iLiq: 0, iPen: 0, iIne: 0, iAgu: 0 };
  lista.forEach((p) => {
    const k = p.cat[0].toUpperCase() + p.cat.slice(1);
    t["g" + k] += p.g; t["i" + k] += p.i;
    if (ttkValido(p)) { t.g += p.g; t.c += p.c; t.i += p.i; t.ped.add(p.pedido_id); }
  });
  t.pedidos = t.ped.size;
  t.itensTodos = t.iLiq + t.iPen + t.iIne + t.iAgu;
  return t;
}
// O período escolhido e o mesmo período do mês anterior (dia 1 a dia N contra dia 1 a dia N)
function ttkPeriodo() {
  const hoje = hojeISO(), mesHoje = hoje.slice(0, 7);
  if (ttkX.modo === "acum") {
    const ini = ttkX.pedidos.length ? ttkX.pedidos[0].dia : hoje;
    return { acum: true, ini, fim: hoje, atual: true, titulo: `Desde ${dataBR(ini)}` };
  }
  const mes = ttkX.mes, D = ttkDiasNoMes(mes), atual = mes === mesHoje;
  const N = atual ? Number(hoje.slice(8, 10)) : D;
  const ant = ttkMesAnterior(mes), Nant = Math.min(N, ttkDiasNoMes(ant));
  return {
    mes, D, N, atual, ini: `${mes}-01`, fim: `${mes}-${pad(N)}`, ant, iniAnt: `${ant}-01`, fimAnt: `${ant}-${pad(Nant)}`,
    fechados: atual ? N - 1 : D, titulo: ttkNomeMes(mes, true)
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
   formato das vendas nos últimos 3 meses fechados (dia a dia, suavizado em 7 dias). */
function ttkPrevisao(per, filtro = () => true) {
  const real = ttkPorDiaDoMes(per.mes, "g", filtro), D = per.D, k = per.fechados;
  const totalReal = real.reduce((s, x) => s + x, 0);
  if (!per.atual) return { total: totalReal, dias: real.map((r, d) => ({ d, real: r })), k: D };
  // Formato do mês: média dos 3 meses fechados anteriores
  const fator = new Array(D + 1).fill(0), conta = new Array(D + 1).fill(0);
  let m = per.mes;
  for (let n = 0; n < 3; n++) {
    m = ttkMesAnterior(m);
    const v = ttkPorDiaDoMes(m, "g", filtro), Dm = ttkDiasNoMes(m), tot = v.reduce((s, x) => s + x, 0);
    if (!tot) continue;
    for (let d = 1; d <= Math.min(D, Dm); d++) { fator[d] += v[d] / tot * Dm; conta[d]++; }
  }
  let f = fator.map((x, d) => (conta[d] ? x / conta[d] : 1));
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
    const x = m.get(p.chave) || { chave: p.chave, nome: p.produto || "Sem nome", g: 0, c: 0, i: 0, iTodos: 0, iIne: 0 };
    x.iTodos += p.i; if (p.cat === "ine") x.iIne += p.i;
    if (ttkValido(p)) { x.g += p.g; x.c += p.c; x.i += p.i; }
    if (p.produto) x.nome = p.produto;
    m.set(p.chave, x);
  });
  const l = [...m.values()].filter((x) => x.g > 0 || x.iTodos > 0).sort((a, b) => b.g - a.g);
  const tot = l.reduce((s, x) => s + x.g, 0);
  let ac = 0;
  l.forEach((x) => { ac += x.g; x.acum = tot ? ac / tot * 100 : 0; x.pctIne = x.iTodos ? x.iIne / x.iTodos * 100 : 0; });
  return l;
}
const ttkOs80 = (prods) => { const s = new Set(); for (const x of prods) { s.add(x.chave); if (x.acum >= 80) break; } return s; };

/* ---------- Gráficos (SVG simples, um eixo só) ---------- */
const TTK_W = 640, TTK_H = 220, TTK_M = { e: 56, d: 12, t: 12, b: 26 };
function ttkEixos(yMax, rotulosX) {
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d;
  const linhas = [0, .25, .5, .75, 1].map((f) => {
    const y = TTK_M.t + h - f * h;
    return `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${y}" y2="${y}" class="ttk-grade"/><text x="${TTK_M.e - 6}" y="${y + 4}" text-anchor="end" class="ttk-eixo">${f ? ttkCurto(yMax * f) : ""}</text>`;
  }).join("");
  const n = rotulosX.length, passo = Math.ceil(n / 10);
  const xs = rotulosX.map((r, i) => (i % passo && i !== n - 1 ? "" : `<text x="${TTK_M.e + (n === 1 ? w / 2 : i / (n - 1) * w)}" y="${TTK_H - 6}" text-anchor="middle" class="ttk-eixo">${esc(r)}</text>`)).join("");
  return linhas + xs;
}
// series: [{ v: [números ou null], classe, nome }], metas: [{ v, nome }]
function ttkGrafLinhas(rotulosX, series, metas = []) {
  const yMax = Math.max(1, ...series.flatMap((s) => s.v.filter((x) => x != null)), ...metas.map((m) => m.v)) * 1.08;
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d, n = rotulosX.length;
  const X = (i) => TTK_M.e + (n === 1 ? w / 2 : i / (n - 1) * w), Y = (v) => TTK_M.t + h - v / yMax * h;
  const caminhos = series.map((s) => {
    let d = "", aberto = false;
    s.v.forEach((v, i) => { if (v == null) { aberto = false; return; } d += `${aberto ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; aberto = true; });
    const pontos = s.v.map((v, i) => (v == null ? "" : `<circle cx="${X(i)}" cy="${Y(v)}" r="7" class="ttk-alvo"><title>${esc(s.nome)} · ${esc(rotulosX[i])}: ${real(v)}</title></circle>`)).join("");
    return `<path d="${d}" class="${s.classe}"/>${pontos}`;
  }).join("");
  const ms = metas.map((m) => `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(m.v)}" y2="${Y(m.v)}" class="ttk-meta"/><text x="${TTK_W - TTK_M.d}" y="${Y(m.v) - 5}" text-anchor="end" class="ttk-eixo">${esc(m.nome)}</text>`).join("");
  return `<svg class="ttk-graf" viewBox="0 0 ${TTK_W} ${TTK_H}" role="img" aria-label="Gráfico de linhas">${ttkEixos(yMax, rotulosX)}${ms}${caminhos}</svg>`;
}
// Barras com a média tracejada
function ttkGrafBarras(rotulosX, valores, { classe = "ttk-barra-cafe", nome = "Valor", media = true, fmt = real } = {}) {
  const vMax = Math.max(1, ...valores) * 1.08, n = valores.length;
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d, bw = Math.max(2, w / n - 2);
  const Y = (v) => TTK_M.t + h - v / vMax * h;
  const barras = valores.map((v, i) => {
    const x = TTK_M.e + i * (w / n) + 1, y = Y(v);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, TTK_M.t + h - y).toFixed(1)}" rx="2" class="${classe}"><title>${esc(rotulosX[i])}: ${fmt(v)}</title></rect>`;
  }).join("");
  const xs = rotulosX.map((_, i) => i);
  const md = valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : 0;
  const linhaMedia = media && md ? `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(md)}" y2="${Y(md)}" class="ttk-media"/><text x="${TTK_W - TTK_M.d}" y="${Y(md) - 5}" text-anchor="end" class="ttk-eixo">média ${fmt === real ? ttkCurto(md) : fmt(md)}</text>` : "";
  // os rótulos do eixo X ficam no centro de cada barra
  const passo = Math.ceil(n / 12);
  const rx = xs.map((i) => (i % passo ? "" : `<text x="${TTK_M.e + i * (w / n) + w / n / 2}" y="${TTK_H - 6}" text-anchor="middle" class="ttk-eixo">${esc(rotulosX[i])}</text>`)).join("");
  const grade = [0, .25, .5, .75, 1].map((f) => { const y = TTK_M.t + h - f * h; return `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${y}" y2="${y}" class="ttk-grade"/><text x="${TTK_M.e - 6}" y="${y + 4}" text-anchor="end" class="ttk-eixo">${f ? (fmt === real ? ttkCurto(vMax * f) : fmt(vMax * f)) : ""}</text>`; }).join("");
  return `<svg class="ttk-graf" viewBox="0 0 ${TTK_W} ${TTK_H}" role="img" aria-label="${esc(nome)}">${grade}${barras}${linhaMedia}${rx}</svg>`;
}
// Pareto num eixo só: cada barra é o % do total; a linha é o % acumulado
function ttkGrafPareto(itens, chave) {
  const tot = itens.reduce((s, x) => s + x[chave], 0) || 1, l = itens.slice(0, 25);
  const h = TTK_H - TTK_M.t - TTK_M.b, w = TTK_W - TTK_M.e - TTK_M.d, n = l.length || 1, bw = Math.max(3, w / n - 3);
  const Y = (pct) => TTK_M.t + h - pct / 100 * h;
  let ac = 0, d = "";
  const barras = l.map((x, i) => {
    const pct = x[chave] / tot * 100; ac += pct;
    const cx = TTK_M.e + i * (w / n) + w / n / 2;
    d += `${i ? "L" : "M"}${cx.toFixed(1)},${Y(ac).toFixed(1)}`;
    return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${Y(pct).toFixed(1)}" width="${bw.toFixed(1)}" height="${(TTK_M.t + h - Y(pct)).toFixed(1)}" rx="2" class="ttk-barra-cafe"><title>${esc(x.nome)}: ${chave === "c" ? real(x[chave]) : num(x[chave]) + " itens"} (${ttkFmtPct(pct)}), acumulado ${ttkFmtPct(ac)}</title></rect>`;
  }).join("");
  const grade = [0, 25, 50, 75, 100].map((p) => `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(p)}" y2="${Y(p)}" class="${p === 80 ? "ttk-meta" : "ttk-grade"}"/><text x="${TTK_M.e - 6}" y="${Y(p) + 4}" text-anchor="end" class="ttk-eixo">${p}%</text>`).join("")
    + `<line x1="${TTK_M.e}" x2="${TTK_W - TTK_M.d}" y1="${Y(80)}" y2="${Y(80)}" class="ttk-meta"/><text x="${TTK_W - TTK_M.d}" y="${Y(80) - 5}" text-anchor="end" class="ttk-eixo">80%</text>`;
  return `<svg class="ttk-graf" viewBox="0 0 ${TTK_W} ${TTK_H}" role="img" aria-label="Concentração 80/20">${grade}${barras}<path d="${d}" class="ttk-linha-dourada"/></svg>`;
}
// Mini barras do GMV mês a mês (últimos 6 meses)
function ttkMini(vals) {
  const mx = Math.max(1, ...vals), w = 72, h = 22, bw = w / vals.length - 2;
  return `<svg class="ttk-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true">${vals.map((v, i) => `<rect x="${i * (w / vals.length) + 1}" y="${h - v / mx * h}" width="${bw}" height="${v / mx * h}" rx="1" class="${i === vals.length - 1 ? "ttk-barra-cafe" : "ttk-barra-cinza"}"/>`).join("")}</svg>`;
}

/* ---------- A aba ---------- */
async function desenharTikTok(el) {
  if (!ttkX.pedidos) { el.innerHTML = `<p class="vazio">Abrindo o TikTok Shop...</p>`; await ttkCarregar(); }
  if (ttkX.erro) { el.innerHTML = `<div class="aviso-falta">Não consegui ler os pedidos do TikTok Shop (${esc(ttkX.erro)}). Falta rodar as partes 46 e 47 do banco.sql no Supabase.</div>`; return; }
  const hoje = hojeISO(), ontem = ttkSomaDias(hoje, -1);
  const meses = [...new Set(ttkX.pedidos.map((p) => p.mes))].sort().reverse();
  if (!meses.includes(hoje.slice(0, 7))) meses.unshift(hoje.slice(0, 7));
  if (!ttkX.mes || !meses.includes(ttkX.mes)) ttkX.mes = meses[0];
  const per = ttkPeriodo();
  const doPer = ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.ini, per.fim));
  const doAnt = per.acum ? [] : ttkX.pedidos.filter((p) => ttkNoPeriodo(p, per.iniAnt, per.fimAnt));
  const A = ttkSomar(doPer), B = per.acum ? null : ttkSomar(doAnt);
  const ultimo = ttkX.pedidos.length ? String(ttkX.pedidos[ttkX.pedidos.length - 1].data) : "";
  const atrasado = ultimo && ultimo.slice(0, 10) < ontem;

  // Previsão e meta (só no mês a mês)
  const prev = per.acum ? null : ttkPrevisao(per);
  const meta = per.acum ? 0 : n2((ttkX.metas.mes || {})[per.mes] ?? (per.atual ? ttkX.metas.ultimaMeta : 0));
  const diasRest = per.acum || !per.atual ? 0 : per.D - per.fechados;
  const feitoAteOntem = prev ? prev.dias.reduce((s, x) => s + (x.real || 0), 0) : 0;
  const falta = Math.max(0, meta - feitoAteOntem);
  const taxa = A.g ? A.c / A.g : 0, taxaAnt = B && B.g ? B.c / B.g : null;
  const diasCorridos = per.acum ? Math.max(1, Math.round((new Date(hoje) - new Date(per.ini)) / 864e5) + 1) : per.N;
  const prods = ttkProdutos(doPer), os80 = ttkOs80(prods);

  const card = (titulo, valor, pilula, sub) => `<div class="ttk-card"><span>${titulo}</span><div class="ttk-valor"><strong>${valor}</strong>${pilula || ""}</div>${sub ? `<small>${sub}</small>` : ""}</div>`;
  const bruto = A.gLiq + A.gPen + A.gIne + A.gAgu;

  el.innerHTML = `
    <section class="cartao ttk-topo">
      <div><h2 style="margin:0">TikTok Shop</h2>
        <p class="sub" style="margin:4px 0 0">${ultimo ? `Pedidos até ${dataBR(ultimo)} às ${ultimo.slice(11, 16)}.` : "Nenhum pedido ainda."} Baixe em TikTok, Pedidos de afiliados, Baixar, e importe aqui. Importar o mesmo arquivo de novo não duplica.</p></div>
      <div class="ttk-controles">
        <select class="campo" id="ttk-mes" aria-label="Mês" ${per.acum ? "disabled" : ""}>${meses.map((m) => `<option value="${m}" ${m === ttkX.mes ? "selected" : ""}>${ttkNomeMes(m, true)}</option>`).join("")}</select>
        <div class="chips" role="group" aria-label="Visão">${[["mes", "Mês a mês"], ["acum", "Acumulado"]].map(([k, n]) => `<button class="chip" type="button" data-ttk-modo="${k}" aria-pressed="${ttkX.modo === k}">${n}</button>`).join("")}</div>
        <label class="btn primario">${ic("subir")}Importar pedidos<input type="file" id="ttk-arquivo" accept=".xlsx,.xls,.csv" hidden></label>
      </div>
    </section>
    ${atrasado ? `<div class="aviso-falta">O último pedido importado é de ${dataBR(ultimo)}. Importe um arquivo novo pra ver os dias seguintes.</div>` : ""}
    <p class="ttk-legenda-topo">${per.acum ? `Tudo desde ${dataBR(per.ini)}.` : `${esc(per.titulo)}${per.atual ? `, até o dia ${per.N}` : ""}. As porcentagens comparam com o mesmo período de ${ttkNomeMes(per.ant, true)} (dia 1 ao dia ${Number(per.fimAnt.slice(8, 10))}).`}</p>

    <div class="ttk-cards">
      ${card(per.acum ? "GMV total" : "GMV no mês", real(A.g), ttkPilula(A.g, B && B.g),
        `Liquidado ${real(A.gLiq)} (${ttkFmtPct(ttkPct(A.gLiq, bruto))}) · Pendente ${real(A.gPen)} (${ttkFmtPct(ttkPct(A.gPen, bruto))}) · Inelegível: reembolso ${real(A.gIne)} (${ttkFmtPct(ttkPct(A.gIne, bruto))})`)}
      ${per.acum ? card("Meses com venda", num(new Set(doPer.filter(ttkValido).map((p) => p.mes)).size), "", `média de ${real(A.g / Math.max(1, new Set(doPer.filter(ttkValido).map((p) => p.mes)).size))} por mês`)
        : `<div class="ttk-card"><span>Meta do mês <button class="link-btn" type="button" id="ttk-meta">${meta ? "mudar" : "definir"}</button></span>
          ${meta ? `<div class="ttk-valor"><strong>${real(meta)}</strong><span class="ttk-pill">${ttkFmtPct(ttkPct(A.g, meta))} feito</span></div>
            <div class="progresso" style="margin:6px 0"><i style="width:${Math.min(100, ttkPct(A.g, meta))}%"></i></div>
            <small>${per.atual ? (falta ? `Faltam ${real(falta)}, ${real(falta / Math.max(1, diasRest))}/dia em ${plural(diasRest, "dia", "dias")}. ` : "Meta batida. ") : ""}${per.atual ? "Previsão" : "Fechou em"} ${real(prev.total)}, <b class="${prev.total >= meta ? "ttk-txt-bom" : "ttk-txt-ruim"}">${real(Math.abs(prev.total - meta))} ${prev.total >= meta ? "acima" : "abaixo"}</b> da meta</small>`
            : `<div class="ttk-valor"><strong>Sem meta</strong></div><small>Defina a meta de GMV do mês pra ver quanto falta por dia e a previsão (${real(prev.total)}).</small>`}</div>`}
      ${card(per.acum ? "Comissão total" : "Comissão no mês", real(A.c), ttkPilula(A.c, B && B.c), `Taxa efetiva ${ttkFmtPct(taxa * 100)}${taxaAnt != null ? ` (${ttkPilula(taxa * 100, taxaAnt * 100, { pp: true })})` : ""}${prev && per.atual ? ` · previsão ${real(prev.total * taxa)}` : ""}`)}
      ${card("Comissão média por item", real(A.i ? A.c / A.i : 0), ttkPilula(A.i ? A.c / A.i : 0, B && B.i ? B.c / B.i : null), "comissão ÷ itens vendidos")}
      ${card("Itens vendidos", num(A.i), ttkPilula(A.i, B && B.i), `${num(A.iLiq)} liquidados e ${num(A.iPen)} pendentes`)}
      ${card("GMV por dia", real(A.g / diasCorridos), ttkPilula(A.g / diasCorridos, B ? B.g / Math.max(1, Number(per.fimAnt.slice(8, 10))) : null), `${plural(diasCorridos, "dia corrido", "dias corridos")}`)}
      ${card("Ticket médio", real(A.pedidos ? A.g / A.pedidos : 0), ttkPilula(A.pedidos ? A.g / A.pedidos : 0, B && B.pedidos ? B.g / B.pedidos : null), `${num(A.pedidos)} pedidos`)}
      ${card("Itens inelegíveis", ttkFmtPct(ttkPct(A.iIne, A.itensTodos)), ttkPilula(ttkPct(A.iIne, A.itensTodos), B ? ttkPct(B.iIne, B.itensTodos) : null, { pp: true, inverso: true }), `${num(A.iIne)} de ${num(A.itensTodos)} itens foram cancelados ou devolvidos`)}
    </div>

    ${ttkBlocoRitmo(per, prev, meta)}
    ${ttkBlocoDiario(per, doPer)}
    ${ttkBlocoProduto(per, prods, os80, prev, A)}
    ${ttkBlocoStatus(A)}
    ${ttkBlocoPareto(prods)}
    ${ttkBlocoVideos(per, doPer, doAnt)}
    ${ttkBlocoTodos(prods)}
    ${ttkBlocoApostas(per, os80)}
    ${ttkBlocoConteudo()}
    ${ttkBlocoDia(hoje, ontem)}`;

  ttkLigar(el, { per, prods, A, hoje });
}

/* 2. GMV acumulado, ritmo do mês */
function ttkBlocoRitmo(per, prev, meta) {
  if (per.acum) {
    const meses = [...new Set(ttkX.pedidos.map((p) => p.mes))].sort();
    let ac = 0; const v = meses.map((m) => (ac += ttkX.pedidos.filter((p) => p.mes === m && ttkValido(p)).reduce((s, p) => s + p.g, 0)));
    return `<div class="cartao"><h2>Quanto já vendi no total</h2>
      ${ttkGrafLinhas(meses.map((m) => ttkNomeMes(m)), [{ v, classe: "ttk-linha-cafe", nome: "GMV acumulado" }])}
      ${ttkFrase("A linha soma o GMV mês a mês desde o primeiro pedido. Quanto mais inclinada, mais rápido você vendeu naquele mês.")}</div>`;
  }
  const D = per.D, rot = Array.from({ length: D }, (_, i) => String(i + 1));
  let ac = 0;
  const realAc = prev.dias.slice(1).map((x) => (x.real != null ? (ac += x.real) : null));
  let ap = ac;
  const prevAc = per.atual ? prev.dias.slice(1).map((x, i) => (i + 1 === prev.k ? ac : x.prev != null ? (ap += x.prev) : null)) : null;
  const antDia = ttkPorDiaDoMes(per.ant); let aa = 0;
  const antAc = rot.map((_, i) => (i + 1 < antDia.length ? (aa += antDia[i + 1]) : null));
  const series = [{ v: antAc, classe: "ttk-linha-cinza", nome: ttkNomeMes(per.ant, true) }, { v: realAc, classe: "ttk-linha-cafe", nome: "Acumulado real" }];
  if (prevAc) series.push({ v: prevAc, classe: "ttk-linha-tracejada", nome: "Previsão" });
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">GMV acumulado, ritmo do mês</h2><span class="espaco"></span>
      <span class="ttk-leg"><i class="ttk-l-cafe"></i>Real ${per.atual ? `(até ontem, ${real(ac)})` : real(ac)}</span>${per.atual ? `<span class="ttk-leg"><i class="ttk-l-tracejada"></i>Previsão ${real(prev.total)}</span>` : ""}<span class="ttk-leg"><i class="ttk-l-cinza"></i>${ttkNomeMes(per.ant, true)}</span>${meta ? `<span class="ttk-leg"><i class="ttk-l-meta"></i>Meta</span>` : ""}</div>
    ${ttkGrafLinhas(rot, series, meta ? [{ v: meta, nome: "meta " + ttkCurto(meta) }] : [])}
    ${ttkFrase(per.atual
      ? `Cada ponto é quanto o mês somou até aquele dia. A previsão mistura o ritmo deste mês com o da última semana de ${ttkNomeMes(per.ant, true)}: no começo do mês o anterior pesa mais e, a cada dia fechado, este mês ganha peso. O caminho até o fim segue como as vendas se espalharam nos últimos 3 meses fechados.`
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
  return `<div class="cartao"><h2>Ritmo ${per.acum ? "mensal" : "diário do mês"}</h2>
    <div class="ttk-dupla">
      <div><h3 class="ttk-sub">GMV por ${un}</h3>${ttkGrafBarras(rot, g, { nome: "GMV por " + un })}</div>
      <div><h3 class="ttk-sub">Comissão por ${un}</h3>${ttkGrafBarras(rot, c, { classe: "ttk-barra-dourada", nome: "Comissão por " + un })}</div>
    </div>
    ${ttkFrase(`Cada barra é um ${un}${per.acum ? "" : " do mês"}. As linhas tracejadas marcam a média por ${un}. ${per.atual && !per.acum ? "O último dia é hoje e ainda está em andamento." : ""}`)}</div>`;
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
    const fimT = per.atual ? ttkSomaDias(hojeISO(), -1) : per.fim;
    const soma = (ini, fim) => ttkX.pedidos.filter((p) => f(p) && ttkValido(p) && p.dia >= ini && p.dia <= fim).reduce((s, p) => s + p.g, 0);
    const t1 = soma(ttkSomaDias(fimT, -6), fimT), t0 = soma(ttkSomaDias(fimT, -13), ttkSomaDias(fimT, -7));
    const antFechado = ttkX.pedidos.filter((p) => f(p) && ttkValido(p) && p.mes === per.ant).reduce((s, p) => s + p.g, 0);
    const prevProd = per.atual ? ttkPrevisao(per, f).total : x.g;
    corpo = `<div class="ttk-mes4">
        <div><span>% do GMV do mês</span><b>${ttkFmtPct(ttkPct(x.g, A.g))}</b></div>
        <div><span>Tendência 7 dias</span><b>${t0 ? `<span class="${t1 >= t0 ? "ttk-txt-bom" : "ttk-txt-ruim"}">${t1 >= t0 ? "+" : ""}${Math.round((t1 / t0 - 1) * 100)}%</span>` : t1 ? "começou agora" : "parado"}</b><small>${real(t1)} contra ${real(t0)} nos 7 dias antes</small></div>
        <div><span>Acumulado no mês</span><b>${real(x.g)}</b><small>${plural(x.i, "item", "itens")}</small></div>
        <div><span>${per.atual ? "Previsão do mês" : "Fechou o mês"}</span><b>${real(prevProd)}</b><small>${ttkNomeMes(per.ant, true)} fechou em ${real(antFechado)} ${antFechado ? ttkPilulaSimples(prevProd, antFechado) : ""}</small></div></div>
      ${ttkGrafBarras(Array.from({ length: per.N }, (_, i) => String(i + 1)), dia, { nome: "GMV do produto por dia" })}
      ${ttkFrase("Cada barra é o GMV desse produto num dia do mês. A linha tracejada é a média diária dele.")}`;
  }
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">Ritmo ${per.acum ? "mensal" : "diário"} por produto</h2><span class="espaco"></span>
      <select class="campo" id="ttk-prod" aria-label="Produto" style="max-width:340px">${opcoes.map((o) => `<option value="${esc(o.chave)}" ${o.chave === x.chave ? "selected" : ""}>${esc(o.nome.slice(0, 60))}</option>`).join("")}</select></div>
    <p class="sub" style="margin:0 0 10px">Só aparecem os ${opcoes.length} produtos que fazem 80% do GMV ${per.acum ? "total" : "do mês"}.</p>
    ${corpo}</div>`;
}
const ttkPilulaSimples = (v, ant) => { const d = Math.round((v / ant - 1) * 100); return `<span class="ttk-pill ${d >= 0 ? "ttk-bom" : "ttk-ruim"}">${d >= 0 ? "+" : ""}${d}%</span>`; };

/* 5. Composição do GMV por status */
function ttkBlocoStatus(A) {
  const linhas = [["liq", A.gLiq, A.iLiq], ["pen", A.gPen, A.iPen], ["ine", A.gIne, A.iIne], ["agu", A.gAgu, A.iAgu]];
  const tot = linhas.reduce((s, l) => s + l[1], 0);
  ttkX.tabStatus = linhas.map(([k, v, i]) => [TTK_STATUS[k] + (k === "ine" || k === "agu" ? " (fora do GMV)" : ""), v, ttkPct(v, tot), i]);
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">Composição do GMV por status</h2><span class="espaco"></span>${ttkExportar("status")}</div>
    <div class="tabela-caixa"><table><thead><tr><th>Status</th><th class="num">Valor</th><th class="num">%</th><th class="num">Itens</th></tr></thead>
    <tbody>${linhas.map(([k, v, i]) => `<tr class="${k === "ine" || k === "agu" ? "ttk-fora" : ""}"><td>${TTK_STATUS[k]}${k === "ine" || k === "agu" ? ` <span class="pilula ttk-pill">fora do GMV</span>` : ""}</td><td class="num">${real(v)}</td><td class="num">${ttkFmtPct(ttkPct(v, tot))}</td><td class="num">${num(i)}</td></tr>`).join("")}</tbody></table></div>
    ${ttkFrase("O GMV soma só Liquidado e Pendente. Inelegível é pedido cancelado ou devolvido, e Aguardando pagamento ainda não foi pago: os dois aparecem aqui pra você ver o tamanho, mas ficam fora das contas.")}</div>`;
}

/* 6. Concentração 80/20 */
function ttkBlocoPareto(prods) {
  const chave = ttkX.pareto === "i" ? "i" : "c";
  const l = [...prods].filter((x) => x[chave] > 0).sort((a, b) => b[chave] - a[chave]);
  const tot = l.reduce((s, x) => s + x[chave], 0);
  let ac = 0, n80 = 0; for (const x of l) { ac += x[chave]; n80++; if (ac / tot >= .8) break; }
  const nome = chave === "c" ? "da comissão" : "dos itens vendidos";
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">Concentração 80/20</h2><span class="sub">${l.length ? `${plural(n80, "produto", "produtos")} = 80% ${nome}` : ""}</span><span class="espaco"></span>
      <div class="chips" role="group" aria-label="Medir por">${[["c", "Comissão"], ["i", "Quantidade"]].map(([k, n]) => `<button class="chip" type="button" data-ttk-pareto="${k}" aria-pressed="${chave === k}">${n}</button>`).join("")}</div></div>
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
      const x = m.get(p.conteudo_id) || { id: p.conteudo_id, g: 0, i: 0, prods: new Map() };
      x.g += p.g; x.i += p.i; x.prods.set(p.produto, (x.prods.get(p.produto) || 0) + p.g); m.set(p.conteudo_id, x);
    });
    return m;
  };
  const agora = agrupa(doPer), antes = agrupa(doAnt);
  const totVideo = [...agora.values()].reduce((s, x) => s + x.g, 0);
  const top = [...agora.values()].sort((a, b) => b.g - a.g).slice(0, 10);
  if (!top.length) return `<div class="cartao"><h2>Vídeos que mais venderam</h2><p class="vazio">Nenhuma venda por vídeo nesse período.</p></div>`;
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
    return { pos: i + 1, titulo, link: c.link || "", quando, produto, g: x.g, i: x.i, pct: ttkPct(x.g, totVideo), ant: ant ? ant.g : 0, serie };
  });
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">Vídeos que mais venderam ${per.acum ? "" : "no mês"}</h2><span class="espaco"></span>${ttkExportar("videos")}</div>
    <p class="ttk-destaque">Os ${top.length} vídeos que mais venderam fizeram ${ttkFmtPct(ttkPct(somaTop, totVideo))} do GMV de vídeo ${per.acum ? "desde o começo" : `em ${MESES_LONGOS[Number(per.mes.slice(5, 7)) - 1].toLowerCase()}`}.${per.acum ? "" : ` ${jaVendiam} deles já vendiam no mês anterior.`}</p>
    <div class="tabela-caixa"><table><thead><tr><th>#</th><th>Vídeo</th><th>Produto</th><th class="num">GMV</th><th class="num">Itens</th><th class="num">% ${per.acum ? "do total" : "do mês"}</th>${per.acum ? "" : `<th class="num">Mês anterior</th>`}<th>Mês a mês</th></tr></thead>
    <tbody>${ttkX.tabVideos.map((v) => `<tr>
      <td>${v.pos}</td>
      <td><div class="ttk-nome">${v.link ? `<a href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.titulo)}</a>` : esc(v.titulo)}</div><small class="sub">${esc(v.quando)}</small></td>
      <td><div class="ttk-nome ttk-nome-curto" title="${esc(v.produto)}">${esc(v.produto)}</div></td>
      <td class="num">${real(v.g)}</td><td class="num">${num(v.i)}</td><td class="num">${ttkFmtPct(v.pct)}</td>
      ${per.acum ? "" : `<td class="num">${v.ant ? ttkPilulaSimples(v.g, v.ant) : `<span class="ttk-pill ttk-novo">novo</span>`}</td>`}
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
  return `<div class="cartao" id="ttk-todos"><div class="barra"><h2 style="margin:0">Todos os produtos</h2><span class="espaco"></span>
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
  const w = ttkX.janela, fim = per.atual ? ttkSomaDias(hojeISO(), -1) : per.fim;
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
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">Apostas</h2><span class="sub">produtos fora dos 80% que estão crescendo</span><span class="espaco"></span>
      <div class="chips" role="group" aria-label="Janela">${[7, 14, 30].map((k) => `<button class="chip" type="button" data-ttk-janela="${k}" aria-pressed="${w === k}">${k} dias</button>`).join("")}</div>${ttkExportar("apostas")}</div>
    ${apostas.length ? `<div class="tabela-caixa"><table><thead><tr><th>Produto</th><th>Sinal</th><th class="num">Últimos ${w} dias</th><th class="num">${w} dias antes</th><th class="num">Dias com venda</th></tr></thead>
      <tbody>${apostas.map((x) => `<tr><td><div class="ttk-nome" title="${esc(x.nome)}">${esc(x.nome)}</div></td><td><span class="pilula ${x.tipo === "Novo" ? "ttk-novo" : "ttk-bom"}">${x.tipo}</span></td><td class="num">${real(x.a)}</td><td class="num">${real(x.b)}</td><td class="num">${x.dias.size}</td></tr>`).join("")}</tbody></table></div>`
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
    return { nome, n: l.length, pctVendeu: ttkPct(l.filter((x) => x > 0).length, l.length), mediana: ttkMediana(l), media: tot / l.length, acaso: tot > 0 && maior / tot > .5 && l.length > 1 ? Math.round(maior / tot * 100) : 0 };
  }).filter((x) => x.n >= 3).sort((a, b) => b.mediana - a.mediana || b.media - a.media);
  ttkX.tabConteudo = linhas;
  const analisados = ttkX.conteudos.filter((c) => c[campo]).length;
  return `<div class="cartao"><div class="barra"><h2 style="margin:0">O que está vendendo no seu conteúdo</h2><span class="espaco"></span>
      <div class="chips" role="group" aria-label="Agrupar por">${[["gancho", "Por gancho"], ["formato", "Por formato"]].map(([k, n]) => `<button class="chip" type="button" data-ttk-conteudo="${k}" aria-pressed="${ttkX.conteudoPor === k}">${n}</button>`).join("")}</div>${ttkExportar("conteudo")}</div>
    <div class="tabela-caixa"><table><thead><tr><th>${ttkX.conteudoPor === "formato" ? "Formato" : "Tipo de gancho"}</th><th class="num">Vídeos</th><th class="num">% que venderam</th><th class="num">Mediana por vídeo</th><th class="num">Média por vídeo</th></tr></thead>
    <tbody>${linhas.map((x) => `<tr><td>${esc(x.nome)}${x.acaso ? `<small class="ttk-aviso-acaso">1 vídeo fez ${x.acaso}% do GMV daqui: é um acaso que viralizou, não um padrão.</small>` : ""}</td><td class="num">${num(x.n)}</td><td class="num">${ttkFmtPct(x.pctVendeu)}</td><td class="num">${real(x.mediana)}</td><td class="num">${real(x.media)}</td></tr>`).join("")}</tbody></table></div>
    ${ttkFrase(`Usa os ${num(analisados)} vídeos que têm análise, com o GMV de todos os pedidos de cada um. A mediana é o vídeo do meio: mostra o que costuma acontecer, sem ser puxada por um vídeo que estourou. Grupos com menos de 3 vídeos ficam de fora.`)}</div>`;
}

/* Ontem e vídeos do dia */
function ttkBlocoDia(hoje, ontem) {
  const doDia = (d) => ttkSomar(ttkX.pedidos.filter((p) => p.dia === d));
  const o = doDia(ontem), sete = [1, 2, 3, 4, 5, 6, 7].map((n) => doDia(ttkSomaDias(ontem, -n)));
  const m = { g: sete.reduce((s, x) => s + x.g, 0) / 7, c: sete.reduce((s, x) => s + x.c, 0) / 7, p: sete.reduce((s, x) => s + x.pedidos, 0) / 7 };
  const dia = ttkX.dia || hoje, vids = ttkX.videos.filter((v) => v.data === dia);
  const metaVideos = Number(ttkX.metas.videos) || 0, postados = vids.filter((v) => v.status === "postado").length;
  const nomeDia = dia === hoje ? "hoje" : dia === ontem ? "ontem" : dia === ttkSomaDias(hoje, 1) ? "amanhã" : dataBR(dia);
  const comp = (v, md) => (md ? ttkPilulaSimples(v, md) : "");
  return `<div class="grade-2 ttk-grade2">
    <div class="cartao"><h2>Como foi ontem, ${dataBR(ontem)}</h2>
      <div class="ttk-mes4">
        <div><span>GMV</span><b>${real(o.g)} ${comp(o.g, m.g)}</b></div>
        <div><span>Comissão</span><b>${real(o.c)} ${comp(o.c, m.c)}</b></div>
        <div><span>Pedidos</span><b>${num(o.pedidos)} ${comp(o.pedidos, m.p)}</b></div>
      </div>
      ${ttkFrase(`Compara ontem com a média dos 7 dias anteriores (${real(m.g)} de GMV por dia).`)}</div>
    <div class="cartao">
      <div class="barra"><h2 style="margin:0">Vídeos de ${esc(nomeDia)}</h2><span class="espaco"></span>
        <button class="icone-btn" type="button" data-ttk-dia="-1" aria-label="Dia anterior">${ic("esq")}</button>
        <button class="icone-btn" type="button" data-ttk-dia="1" aria-label="Próximo dia">${ic("dir")}</button></div>
      <p class="sub" style="margin:0 0 6px">${metaVideos ? `Meta: ${plural(metaVideos, "vídeo", "vídeos")} por dia. Postados: ${postados} de ${metaVideos}.` : "Defina quantos vídeos você quer postar por dia."} <button class="link-btn" type="button" id="ttk-meta-videos">${metaVideos ? "mudar" : "definir"}</button></p>
      ${metaVideos ? `<div class="progresso"><i style="width:${Math.min(100, Math.round(postados / metaVideos * 100))}%"></i></div>` : ""}
      <ul class="ttk-videos">${vids.map((v) => `<li>
        <span class="ttk-hora">${v.hora ? String(v.hora).slice(0, 5) : "--:--"}</span>
        <span class="ttk-prod">${esc(v.produto)}</span>
        <button class="pilula ttk-st-${v.status}" type="button" data-ttk-status="${v.id}" title="Toque pra mudar o status">${esc((TTK_STATUS_VIDEO.find(([k]) => k === v.status) || [0, v.status])[1])}</button>
        <button class="icone-btn" type="button" data-ttk-video="${v.id}" aria-label="Editar">${ic("editar")}</button></li>`).join("") || `<li class="sub">Nenhum vídeo planejado pra esse dia.</li>`}</ul>
      <button class="btn pequeno" type="button" id="ttk-novo-video">${ic("mais")}Adicionar vídeo</button>
    </div></div>`;
}

/* ---------- Ligações ---------- */
function ttkLigar(el, { per, hoje }) {
  const redesenhar = () => desenharTikTok(el);
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
    if (t === "videos") baixarCSV(`tiktok-videos-${sufixo}`, ["Posição", "Vídeo", "Quando", "Link", "Produto", "GMV", "Itens", "% do GMV de vídeo", "GMV no período anterior"], ttkX.tabVideos.map((v) => [v.pos, v.titulo, v.quando, v.link, v.produto, br(v.g), v.i, br(v.pct), br(v.ant)]));
    if (t === "produtos") baixarCSV(`tiktok-produtos-${sufixo}`, ["Produto", "Qtde", "GMV", "Comissão", "% inelegível", "% acumulado"], ttkX.tabProdutos.map((x) => [x.nome, x.i, br(x.g), br(x.c), br(x.pctIne), br(x.acum)]));
    if (t === "apostas") baixarCSV(`tiktok-apostas-${ttkX.janela}-dias`, ["Produto", "Sinal", "GMV na janela", "GMV na janela anterior", "Dias com venda"], ttkX.tabApostas.map((x) => [x.nome, x.tipo, br(x.a), br(x.b), x.dias.size]));
    if (t === "conteudo") baixarCSV(`tiktok-conteudo-${ttkX.conteudoPor}`, ["Categoria", "Vídeos", "% que venderam", "Mediana por vídeo", "Média por vídeo", "Um vídeo fez % do GMV"], ttkX.tabConteudo.map((x) => [x.nome, x.n, br(x.pctVendeu), br(x.mediana), br(x.media), x.acaso || ""]));
  });
  const btnMeta = $("#ttk-meta", el);
  if (btnMeta) btnMeta.onclick = () => abrirForm({
    titulo: `Meta de GMV de ${ttkNomeMes(per.mes, true)}`,
    valores: { valor: n2((ttkX.metas.mes || {})[per.mes]) || "" },
    campos: [{ n: "valor", r: "Meta de GMV do mês (R$)", t: "number", req: true }],
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
  const existiam = new Set(), ids = [...new Set(lista.map((p) => p.pedido_id))];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db.from("ttk_pedidos").select("pedido_id,sku_id").in("pedido_id", ids.slice(i, i + 200));
    if (error) { avisar(traduzErro(error), true); return; }
    data.forEach((x) => existiam.add(x.pedido_id + "|" + x.sku_id));
  }
  for (let i = 0; i < lista.length; i += 500) {
    avisar(`Gravando pedidos... ${Math.min(i + 500, lista.length)} de ${lista.length}`);
    const { error } = await db.from("ttk_pedidos").upsert(lista.slice(i, i + 500), { onConflict: "pedido_id,sku_id" });
    if (error) { avisar(traduzErro(error), true); return; }
  }
  const novos = lista.filter((p) => !existiam.has(p.pedido_id + "|" + p.sku_id)).length;
  ttkX.pedidos = null;
  await desenharTikTok(el);
  avisar(`Pronto: ${plural(novos, "pedido novo", "pedidos novos")} e ${plural(lista.length - novos, "atualizado", "atualizados")}.${semData ? ` ${semData} linhas sem data ficaram de fora.` : ""}`);
}

// Estilos só desta aba (cores e fontes do admin.css)
(() => {
  const s = document.createElement("style");
  s.textContent = `
    .ttk-topo { display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    .ttk-topo > div:first-child { flex: 1 1 300px; }
    .ttk-controles { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .ttk-legenda-topo { font-size: 13px; color: var(--muted); margin: -6px 0 12px; }
    .ttk-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    @media (max-width: 1100px) { .ttk-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 560px) { .ttk-cards { grid-template-columns: 1fr; } }
    .ttk-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; min-width: 0; }
    .ttk-card > span { display: block; font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .6px; }
    .ttk-card > span .link-btn { text-transform: none; letter-spacing: 0; font-size: 12px; }
    .ttk-valor { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
    .ttk-valor strong { font-size: 20px; color: var(--cobalt); }
    .ttk-card small { display: block; font-size: 11.5px; color: var(--muted); margin-top: 4px; line-height: 1.4; }
    .ttk-pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--tint); color: var(--muted); white-space: nowrap; }
    .ttk-pill.ttk-bom, .pilula.ttk-bom { background: var(--green-bg); color: var(--green); }
    .ttk-pill.ttk-ruim { background: var(--red-bg); color: var(--red); }
    .ttk-pill.ttk-novo, .pilula.ttk-novo { background: var(--olive-tint); color: #6b5426; }
    .ttk-txt-bom { color: var(--green); } .ttk-txt-ruim { color: var(--red); }
    .ttk-frase { font-size: 12.5px; color: var(--muted); margin: 8px 0 0; line-height: 1.45; }
    .ttk-destaque { margin: 0 0 10px; font-size: 14px; }
    .ttk-sub { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 0 0 4px; }
    .ttk-graf { width: 100%; height: auto; display: block; }
    .ttk-grade { stroke: var(--line); stroke-width: 1; }
    .ttk-eixo { font-size: 10.5px; fill: var(--muted); font-family: inherit; }
    .ttk-linha-cafe { fill: none; stroke: var(--cobalt); stroke-width: 2.2; }
    .ttk-linha-tracejada { fill: none; stroke: var(--olive); stroke-width: 2; stroke-dasharray: 6 4; }
    .ttk-linha-cinza { fill: none; stroke: var(--muted); stroke-opacity: .45; stroke-width: 2; }
    .ttk-linha-dourada { fill: none; stroke: var(--olive); stroke-width: 2.2; }
    .ttk-meta { stroke: var(--red); stroke-opacity: .6; stroke-width: 1.4; stroke-dasharray: 3 3; }
    .ttk-media { stroke: var(--text); stroke-opacity: .55; stroke-width: 1.2; stroke-dasharray: 5 4; }
    .ttk-alvo { fill: transparent; }
    .ttk-alvo:hover { fill: var(--olive-tint); }
    .ttk-barra-cafe { fill: var(--cobalt); } .ttk-barra-dourada { fill: var(--olive); } .ttk-barra-cinza { fill: var(--muted); fill-opacity: .35; }
    rect.ttk-barra-cafe:hover, rect.ttk-barra-dourada:hover { fill-opacity: .8; }
    .ttk-leg { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
    .ttk-leg i { display: inline-block; width: 18px; height: 0; border-top: 2px solid; }
    .ttk-l-cafe { border-color: var(--cobalt) !important; } .ttk-l-tracejada { border-color: var(--olive) !important; border-top-style: dashed !important; }
    .ttk-l-cinza { border-color: var(--muted) !important; opacity: .5; } .ttk-l-meta { border-color: var(--red) !important; border-top-style: dotted !important; }
    .ttk-dupla { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 900px) { .ttk-dupla { grid-template-columns: 1fr; } }
    .ttk-mes4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px; }
    .ttk-mes4 span { display: block; font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .6px; }
    .ttk-mes4 b { display: block; font-size: 18px; color: var(--cobalt); }
    .ttk-mes4 small { display: block; font-size: 11.5px; color: var(--muted); }
    .ttk-fora td { color: var(--muted); }
    .ttk-nome { max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-nome-curto { max-width: 220px; }
    .ttk-mini { width: 72px; height: 22px; display: block; }
    .ttk-aviso-acaso { display: block; color: #8a5a00; font-size: 11.5px; margin-top: 2px; }
    .ttk-grade2 { grid-template-columns: 1fr 1fr; }
    @media (max-width: 900px) { .ttk-grade2 { grid-template-columns: 1fr; } }
    .ttk-videos { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 6px; }
    .ttk-videos li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; }
    .ttk-videos li.sub { border-style: dashed; }
    .ttk-hora { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 44px; }
    .ttk-prod { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-videos .pilula { border: 0; cursor: pointer; }
    .ttk-st-rascunho { background: var(--tint); color: var(--muted); }
    .ttk-st-agendado { background: var(--olive-tint); color: #5d5a3c; }
    .ttk-st-postado { background: var(--green-bg); color: var(--green); }`;
  document.head.appendChild(s);
})();

DESENHOS.tiktok = desenharTikTok;
