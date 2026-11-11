/* =============================================================
   ABA TIKTOK SHOP (#tiktok)
   Importa o affiliate_orders_*.xlsx (TikTok > Pedidos de afiliados > Baixar)
   para ttk_pedidos e mostra: ontem x média de 7 dias, o mês com a meta,
   o ranking de produtos e os vídeos do dia (ttk_videos).
   Pedido "Inelegível" (cancelado ou devolvido) fica fora das contas.
   Isto não entra no faturado do Financeiro: lá conta o repasse de quarta.
   ============================================================= */
const ttkX = { pedidos: null, videos: null, metas: null, erro: "", dia: null, periodo: "mes", ordem: "gmv" };
const TTK_STATUS_VIDEO = [["rascunho", "Rascunho"], ["agendado", "Agendado"], ["postado", "Postado"]];
const TTK_DIAS_LER = 100; // o ranking vai até 90 dias; a média de 7 dias precisa de folga

// Colunas do arquivo, pelo título exato que o TikTok usa
const TTK_COLUNAS = {
  pedido_id: "ID do pedido", sku_id: "ID do SKU", produto_id: "ID do produto", produto: "Nome do produto", loja: "Nome da loja",
  itens: "Itens vendidos", reembolsados: "Itens reembolsados", status: "Status de liquidação do pedido",
  tipo_conteudo: "Tipo de conteúdo", conteudo_id: "ID do conteúdo", gmv: "GMV",
  padrao: "Comissão padrão estimada", anuncios: "Comissão estimada de anúncios da loja", bonus: "Bônus estimado",
  recebido: "Valor total final recebido", data: "Data do pedido", liquidado: "Data de liquidação da comissão"
};

// "1.234,56" vira 1234.56; vazio vira 0
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
const ttkDiaISO = (d) => isoLocal(d);
const ttkSomaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); };
const ttkValido = (p) => p.status !== "Inelegível";

async function ttkCarregar() {
  ttkX.erro = "";
  const desde = ttkSomaDias(hojeISO(), -TTK_DIAS_LER) + "T00:00:00";
  const pedidos = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("ttk_pedidos").select("pedido_id,sku_id,produto_id,produto,status,gmv,comissao_est,comissao_real,data")
      .gte("data", desde).order("data", { ascending: false }).range(de, de + 999);
    if (error) { ttkX.erro = traduzErro(error); ttkX.pedidos = []; ttkX.videos = []; ttkX.metas = {}; return; }
    pedidos.push(...data);
    if (data.length < 1000) break;
  }
  ttkX.pedidos = pedidos;
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

// Soma por dia (só pedidos válidos)
function ttkPorDia() {
  const dias = {};
  ttkX.pedidos.filter(ttkValido).forEach((p) => {
    const d = String(p.data).slice(0, 10);
    const x = dias[d] || (dias[d] = { gmv: 0, com: 0, pedidos: new Set() });
    x.gmv += n2(p.gmv); x.com += n2(p.comissao_est); x.pedidos.add(p.pedido_id);
  });
  return dias;
}
const ttkDoDia = (dias, d) => { const x = dias[d]; return { gmv: x ? x.gmv : 0, com: x ? x.com : 0, ped: x ? x.pedidos.size : 0 }; };
function ttkMedia(dias, fim, n) {
  const t = { gmv: 0, com: 0, ped: 0 };
  for (let i = 0; i < n; i++) { const x = ttkDoDia(dias, ttkSomaDias(fim, -i)); t.gmv += x.gmv; t.com += x.com; t.ped += x.ped; }
  return { gmv: t.gmv / n, com: t.com / n, ped: t.ped / n };
}
// "+12% que a média" / "-8% que a média"
function ttkComparar(v, media) {
  if (!media) return v ? "sem média para comparar" : "";
  const p = Math.round((v / media - 1) * 100);
  return `<span class="${p >= 0 ? "ttk-sobe" : "ttk-desce"}">${p >= 0 ? "+" : ""}${p}%</span> que a média de 7 dias`;
}

async function desenharTikTok(el) {
  if (!ttkX.pedidos) { el.innerHTML = `<p class="vazio">Abrindo o TikTok Shop...</p>`; await ttkCarregar(); }
  if (ttkX.erro) {
    el.innerHTML = `<div class="aviso-falta">Não consegui ler os pedidos do TikTok Shop (${esc(ttkX.erro)}). Falta rodar a parte 46 do banco.sql no Supabase.</div>`;
    return;
  }
  const hoje = hojeISO(), ontem = ttkSomaDias(hoje, -1);
  const dias = ttkPorDia();
  const ultimo = ttkX.pedidos.length ? String(ttkX.pedidos[0].data) : "";
  const dadosAte = ultimo ? `${dataBR(ultimo)} às ${ultimo.slice(11, 16)}` : "";

  // 1. Ontem x média dos 7 dias antes de ontem
  const o = ttkDoDia(dias, ontem), m7 = ttkMedia(dias, ttkSomaDias(ontem, -1), 7);
  const atrasado = ultimo && ultimo.slice(0, 10) < ontem;

  // 2. O mês: total até ontem + média dos últimos 7 dias completos (até ontem) nos dias que faltam
  const mesChave = hoje.slice(0, 7), diaHoje = Number(hoje.slice(8, 10));
  const diasNoMes = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0).getDate();
  let mesGmv = 0, mesCom = 0, mesPed = new Set(), ateOntemGmv = 0, ateOntemCom = 0;
  ttkX.pedidos.filter((p) => ttkValido(p) && String(p.data).slice(0, 7) === mesChave).forEach((p) => {
    mesGmv += n2(p.gmv); mesCom += n2(p.comissao_est); mesPed.add(p.pedido_id);
    if (String(p.data).slice(0, 10) < hoje) { ateOntemGmv += n2(p.gmv); ateOntemCom += n2(p.comissao_est); }
  });
  const m7Proj = ttkMedia(dias, ontem, 7);
  const base = (ttkX.metas.base === "gmv") ? "gmv" : "com";
  const nomeBase = base === "gmv" ? "GMV" : "comissão";
  const meta = n2((ttkX.metas.mes || {})[mesChave] ?? ttkX.metas.ultimaMeta);
  const feito = base === "gmv" ? mesGmv : mesCom, feitoAteOntem = base === "gmv" ? ateOntemGmv : ateOntemCom;
  const diasRestantes = diasNoMes - diaHoje + 1; // hoje conta
  const projecao = feitoAteOntem + (base === "gmv" ? m7Proj.gmv : m7Proj.com) * diasRestantes;
  const falta = Math.max(0, meta - feitoAteOntem), porDia = diasRestantes ? falta / diasRestantes : 0;
  const pctMeta = meta ? Math.min(100, Math.round(feito / meta * 100)) : 0;

  // 3. Ranking de produtos
  const iniPeriodo = ttkX.periodo === "7" ? ttkSomaDias(ontem, -6) : ttkX.periodo === "90" ? ttkSomaDias(hoje, -89) : mesChave + "-01";
  const prods = {};
  ttkX.pedidos.filter((p) => ttkValido(p) && String(p.data).slice(0, 10) >= iniPeriodo).forEach((p) => {
    const k = p.produto_id || p.produto;
    const x = prods[k] || (prods[k] = { nome: p.produto || "Sem nome", gmv: 0, com: 0, pedidos: new Set(), ultima: "" });
    x.gmv += n2(p.gmv); x.com += n2(p.comissao_est); x.pedidos.add(p.pedido_id);
    if (String(p.data) > x.ultima) x.ultima = String(p.data);
  });
  const ranking = Object.values(prods).sort((a, b) => (ttkX.ordem === "com" ? b.com - a.com : b.gmv - a.gmv)).slice(0, 15);
  const maior = ranking.length ? (ttkX.ordem === "com" ? ranking[0].com : ranking[0].gmv) : 0;

  // 4. Vídeos do dia
  const dia = ttkX.dia || hoje;
  const vids = ttkX.videos.filter((v) => v.data === dia);
  const metaVideos = Number(ttkX.metas.videos) || 0;
  const postados = vids.filter((v) => v.status === "postado").length;
  const nomeDia = dia === hoje ? "Hoje" : dia === ontem ? "Ontem" : dia === ttkSomaDias(hoje, 1) ? "Amanhã" : dataBR(dia);

  el.innerHTML = `
    <section class="cartao ttk-topo">
      <div><h2 style="margin:0">TikTok Shop</h2>
        <p class="sub" style="margin:4px 0 0">${ultimo ? `Pedidos importados até ${dadosAte}.` : "Nenhum pedido ainda."} Baixe em TikTok, Pedidos de afiliados, Baixar, e importe aqui. Importar o mesmo arquivo de novo não duplica: só atualiza o status e a comissão.</p></div>
      <label class="btn primario">${ic("subir")}Importar pedidos<input type="file" id="ttk-arquivo" accept=".xlsx,.xls,.csv" hidden></label>
    </section>
    ${atrasado ? `<div class="aviso-falta">O último pedido importado é de ${dataBR(ultimo)}. Importe um arquivo novo pra ver ontem completo.</div>` : ""}

    <h3 class="ttk-titulo">Ontem, ${dataBR(ontem)}</h3>
    <div class="faixa-kpi">
      <div class="kpi"><span>GMV</span><strong>${real(o.gmv)}</strong><small>${ttkComparar(o.gmv, m7.gmv)}</small></div>
      <div class="kpi"><span>Comissão estimada</span><strong>${real(o.com)}</strong><small>${ttkComparar(o.com, m7.com)}</small></div>
      <div class="kpi"><span>Pedidos</span><strong>${num(o.ped)}</strong><small>${ttkComparar(o.ped, m7.ped)}</small></div>
      <div class="kpi"><span>Média de 7 dias</span><strong>${real(m7.gmv)}</strong><small>${real(m7.com)} de comissão, ${num(Math.round(m7.ped))} pedidos por dia</small></div>
    </div>

    <div class="grade-2 ttk-grade">
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">${MESES_LONGOS[Number(hoje.slice(5, 7)) - 1]}</h2><span class="espaco"></span><button class="btn pequeno" type="button" id="ttk-meta">${ic("editar")}${meta ? "Mudar a meta" : "Definir a meta"}</button></div>
        <div class="ttk-mes">
          <div><span>GMV no mês</span><b>${real(mesGmv)}</b></div>
          <div><span>Comissão no mês</span><b>${real(mesCom)}</b></div>
          <div><span>Pedidos</span><b>${num(mesPed.size)}</b></div>
        </div>
        ${meta ? `
          <p class="sub" style="margin:12px 0 6px">Meta de ${nomeBase}: <b>${real(meta)}</b>, ${pctMeta}% feito</p>
          <div class="progresso"><i style="width:${pctMeta}%"></i></div>
          <div class="ttk-mes" style="margin-top:12px">
            <div><span>Falta por dia</span><b>${falta ? real(porDia) : "Meta batida"}</b><small>${falta ? `${real(falta)} em ${plural(diasRestantes, "dia", "dias")}, contando hoje` : ""}</small></div>
            <div><span>Projeção do mês</span><b class="${projecao >= meta ? "ttk-sobe" : "ttk-desce"}">${real(projecao)}</b><small>no ritmo dos últimos 7 dias (${real(base === "gmv" ? m7Proj.gmv : m7Proj.com)} por dia)</small></div>
          </div>` : `<p class="sub" style="margin:12px 0 0">Defina a meta do mês pra ver quanto falta por dia e a projeção.</p>`}
      </div>

      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Vídeos: ${esc(nomeDia)}</h2><span class="espaco"></span>
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
      </div>
    </div>

    <div class="cartao">
      <div class="barra"><h2 style="margin:0">Produtos que mais vendem</h2><span class="sub">o que vale gravar de novo</span><span class="espaco"></span>
        <div class="chips" role="group" aria-label="Período">${[["7", "7 dias"], ["mes", "Mês"], ["90", "90 dias"]].map(([k, n]) => `<button class="chip" type="button" data-ttk-periodo="${k}" aria-pressed="${ttkX.periodo === k}">${n}</button>`).join("")}</div>
        <div class="chips" role="group" aria-label="Ordenar por">${[["gmv", "Por GMV"], ["com", "Por comissão"]].map(([k, n]) => `<button class="chip" type="button" data-ttk-ordem="${k}" aria-pressed="${ttkX.ordem === k}">${n}</button>`).join("")}</div>
      </div>
      ${ranking.length ? `<div class="tabela-caixa"><table>
        <thead><tr><th>#</th><th>Produto</th><th class="num">GMV</th><th class="num">Comissão</th><th class="num">Pedidos</th><th>Última venda</th></tr></thead>
        <tbody>${ranking.map((x, i) => `<tr>
          <td>${i + 1}</td>
          <td><div class="ttk-nome" title="${esc(x.nome)}">${esc(x.nome)}</div><div class="ttk-barra"><i style="width:${maior ? Math.round((ttkX.ordem === "com" ? x.com : x.gmv) / maior * 100) : 0}%"></i></div></td>
          <td class="num">${real(x.gmv)}</td><td class="num">${real(x.com)}</td><td class="num">${num(x.pedidos.size)}</td><td>${dataBR(x.ultima)}</td></tr>`).join("")}</tbody>
      </table></div>` : `<p class="vazio">Nenhuma venda nesse período.</p>`}
    </div>`;

  // Ligações
  $("#ttk-arquivo", el).onchange = (e) => { const a = e.target.files[0]; e.target.value = ""; if (a) ttkImportar(a, el); };
  $("#ttk-meta", el).onclick = () => abrirForm({
    titulo: `Meta de ${MESES_LONGOS[Number(hoje.slice(5, 7)) - 1]}`,
    valores: { valor: meta || "", base },
    campos: [
      { n: "base", r: "A meta é de", t: "select", op: [["com", "Comissão"], ["gmv", "GMV"]] },
      { n: "valor", r: "Valor da meta (R$)", t: "number", req: true }
    ],
    aoSalvar: async (d) => {
      ttkX.metas.mes = ttkX.metas.mes || {};
      ttkX.metas.mes[mesChave] = n2(d.valor); ttkX.metas.ultimaMeta = n2(d.valor); ttkX.metas.base = d.base;
      const ok = await ttkSalvarMetas(); if (ok) desenharTikTok(el); return ok;
    }
  });
  $("#ttk-meta-videos", el).onclick = () => abrirForm({
    titulo: "Meta de vídeos por dia",
    valores: { videos: metaVideos || "" },
    campos: [{ n: "videos", r: "Quantos vídeos por dia", t: "number", req: true }],
    aoSalvar: async (d) => { ttkX.metas.videos = Math.round(n2(d.videos)); const ok = await ttkSalvarMetas(); if (ok) desenharTikTok(el); return ok; }
  });
  $$("[data-ttk-dia]", el).forEach((b) => b.onclick = () => { ttkX.dia = ttkSomaDias(dia, Number(b.dataset.ttkDia)); desenharTikTok(el); });
  $$("[data-ttk-periodo]", el).forEach((b) => b.onclick = () => { ttkX.periodo = b.dataset.ttkPeriodo; desenharTikTok(el); });
  $$("[data-ttk-ordem]", el).forEach((b) => b.onclick = () => { ttkX.ordem = b.dataset.ttkOrdem; desenharTikTok(el); });
  // Toque no status: rascunho, agendado, postado e volta
  $$("[data-ttk-status]", el).forEach((b) => b.onclick = async () => {
    const v = ttkX.videos.find((x) => String(x.id) === b.dataset.ttkStatus); if (!v) return;
    const i = TTK_STATUS_VIDEO.findIndex(([k]) => k === v.status), novo = TTK_STATUS_VIDEO[(i + 1) % TTK_STATUS_VIDEO.length][0];
    const { error } = await db.from("ttk_videos").update({ status: novo }).eq("id", v.id);
    if (error) { avisar(traduzErro(error), true); return; }
    v.status = novo; desenharTikTok(el);
  });
  $$("[data-ttk-video]", el).forEach((b) => b.onclick = () => ttkFormVideo(el, ttkX.videos.find((x) => String(x.id) === b.dataset.ttkVideo), dia));
  $("#ttk-novo-video", el).onclick = () => ttkFormVideo(el, null, dia);
}

function ttkFormVideo(el, v, dia) {
  // Sugere os produtos do ranking de 90 dias
  const nomes = [...new Set(ttkX.pedidos.filter(ttkValido).map((p) => p.produto).filter(Boolean))].slice(0, 60);
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
      ttkX.videos = ttkX.videos.filter((x) => x.id !== r.data.id).concat(r.data)
        .sort((a, b) => String(a.hora || "99").localeCompare(String(b.hora || "99")));
      ttkX.dia = d.data; desenharTikTok(el); return true;
    },
    aoApagar: v ? async () => {
      const { error } = await db.from("ttk_videos").delete().eq("id", v.id);
      if (error) { avisar(traduzErro(error), true); return false; }
      ttkX.videos = ttkX.videos.filter((x) => x.id !== v.id); desenharTikTok(el); return true;
    } : null
  });
}

// Lê o arquivo, confere as colunas e grava. Pedido + SKU já existente só é atualizado.
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
      status: txt(l, "status", 40), tipo_conteudo: txt(l, "tipo_conteudo", 40), conteudo_id: txt(l, "conteudo_id", 40),
      gmv: ttkNum(cel(l, "gmv")), comissao_est: Math.round((ttkNum(cel(l, "padrao")) + ttkNum(cel(l, "anuncios")) + ttkNum(cel(l, "bonus"))) * 100) / 100,
      comissao_real: recebido || null, data, liquidado_em: liq, atualizado_em: agora
    };
    porChave.set(p.pedido_id + "|" + p.sku_id, p);
  });
  const lista = [...porChave.values()];
  if (!lista.length) { avisar("Não achei nenhum pedido nesse arquivo.", true); return; }
  // Quais já existiam (pra contar novos e atualizados)
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

// Estilos só desta aba
(() => {
  const s = document.createElement("style");
  s.textContent = `
    .ttk-topo { display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    .ttk-topo > div { flex: 1 1 320px; }
    .ttk-titulo { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); margin: 4px 0 8px; }
    .ttk-sobe { color: var(--green); font-weight: 700; }
    .ttk-desce { color: var(--red); font-weight: 700; }
    .ttk-grade { grid-template-columns: 1fr 1fr; }
    @media (max-width: 900px) { .ttk-grade { grid-template-columns: 1fr; } }
    .ttk-mes { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
    .ttk-mes span { display: block; font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .6px; }
    .ttk-mes b { display: block; font-size: 18px; color: var(--cobalt); }
    .ttk-mes small { display: block; font-size: 11.5px; color: var(--muted); }
    .ttk-videos { list-style: none; margin: 12px 0; padding: 0; display: grid; gap: 6px; }
    .ttk-videos li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; }
    .ttk-videos li.sub { border-style: dashed; }
    .ttk-hora { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 44px; }
    .ttk-prod { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-videos .pilula { border: 0; cursor: pointer; }
    .ttk-st-rascunho { background: var(--tint); color: var(--muted); }
    .ttk-st-agendado { background: var(--olive-tint); color: #5d5a3c; }
    .ttk-st-postado { background: var(--green-bg); color: var(--green); }
    .ttk-nome { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-barra { height: 4px; background: var(--tint); border-radius: 2px; margin-top: 4px; max-width: 420px; }
    .ttk-barra i { display: block; height: 100%; background: var(--cobalt); border-radius: 2px; }`;
  document.head.appendChild(s);
})();

DESENHOS.tiktok = desenharTikTok;
