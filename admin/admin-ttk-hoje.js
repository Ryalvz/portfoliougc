/* =========================================================
   TikTok > Hoje (tela de abertura) e Criar > Gravação (quadro)
   Hoje: fechamento de ontem, meta do mês, os vídeos do dia (com legenda pra copiar),
   o plano dos 15 (Principais, Com vendas, Testes), amostras com prazo e o produto da vez.
   Gravação: quadro Ideia > Gravar > Gravado > Agendado, salvo em preferencias "ttk_gravar" (v2).
   ========================================================= */
const TTK_BLOCOS = [["principal", "Principal"], ["com_vendas", "Com vendas"], ["teste", "Teste"]];
const TTK_TOP_ANTONELLA = 2;

// Os 15 do dia pelo padrão: 6 principais (3 produtos x 2), 6 com vendas, 3 testes
function ttkPlanoDoDia() {
  const fim = ttkSomaDias(hojeISO(), -1), ini = ttkSomaDias(fim, -29);
  const m = new Map();
  ttkX.todos.filter((p) => ttkValido(p) && p.dia >= ini && p.dia <= fim).forEach((p) => {
    const x = m.get(p.grupo) || { id: p.grupo, nome: p.nomeGrupo, g: 0, liq: 0, dias: new Set() };
    x.g += p.g; if (p.cat === "liq") x.liq += p.liq; x.dias.add(p.dia); m.set(p.grupo, x);
  });
  const l = [...m.values()];
  const top = m.get(TTK_TOP_ANTONELLA) || { id: TTK_TOP_ANTONELLA, nome: (ttkX.grupos[TTK_TOP_ANTONELLA] || {}).nome || "Top Antonella", g: 0, liq: 0, dias: new Set() };
  const resto = l.filter((x) => x.id !== TTK_TOP_ANTONELLA).sort((a, b) => b.liq - a.liq || b.g - a.g);
  const fortes = resto.filter((x) => x.dias.size >= 10);
  const principais = [top, ...(fortes.length >= 2 ? fortes : resto).slice(0, 2)];
  const ids = new Set(principais.map((x) => x.id));
  const comVendas = resto.filter((x) => !ids.has(x.id)).sort((a, b) => b.g - a.g).slice(0, 6);
  const testes = [];
  (ttkX.amostras || []).filter((a) => a.decisao === "testando").sort((a, b) => String(a.prazo_postar || "9").localeCompare(String(b.prazo_postar || "9")))
    .forEach((a) => testes.push({ nome: a.produto, de: a.prazo_postar ? `amostra, postar até ${dataBR(a.prazo_postar)}` : "amostra" }));
  if (typeof ttkSug !== "undefined" && ttkSug.lista) {
    const st = ttkSug.status || {};
    ttkSug.lista.filter((s) => s.tipo === "testar" && !["descartei", "entrou"].includes(st[s.id])).sort((a, b) => (a.fila || 99) - (b.fila || 99))
      .forEach((s) => testes.push({ nome: s.nome, de: "sugestão do CreatorsBase", sug: s.id }));
  }
  return { principais, comVendas, testes: testes.slice(0, 3) };
}

// Horários pras vagas que faltam: de 30 em 30 min entre 8h e 23h, longe dos já agendados e (hoje) depois de agora
function ttkHorariosLivres(vids, qtd, dia) {
  if (qtd <= 0) return [];
  const paraMin = (h) => { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); };
  const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  const ocup = vids.filter((v) => v.hora).map((v) => paraMin(v.hora));
  const agora = new Date(), desde = dia === hojeISO() ? agora.getHours() * 60 + agora.getMinutes() + 20 : 0;
  const grade = (passo) => { const g = []; for (let t = 8 * 60; t <= 23 * 60; t += passo) g.push(t); return g.filter((t) => t >= desde && ocup.every((o) => Math.abs(o - t) >= Math.min(25, passo))); };
  let livres = grade(30);
  if (livres.length < qtd) livres = grade(15);
  const out = [];
  if (livres.length <= qtd) livres.forEach((t) => out.push(fmt(t)));
  else for (let k = 0; k < qtd; k++) out.push(fmt(livres[Math.floor((k * livres.length) / qtd)]));
  while (out.length < qtd) out.push(""); // o dia acabou: fica sem horário
  return out;
}
// Produtos pras vagas: segue o plano dos 15 (principais 2 vezes, com vendas, testes), sem repetir o que já está agendado
function ttkSugestoesDoDia(plano, vids, qtd) {
  if (qtd <= 0) return [];
  const chave = (t) => semAcento(String(t || "")).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 22);
  const usados = new Map();
  vids.forEach((v) => { const k = chave(v.produto); usados.set(k, (usados.get(k) || 0) + 1); });
  const ja = (nome) => { const k = chave(nome); for (const [u, n] of usados) if (n > 0 && (u.includes(k) || k.includes(u))) { usados.set(u, n - 1); return true; } return false; };
  const filas = {
    // Primeiro um vídeo de cada principal; o 2º de cada um vai pro fim do dia
    principal: [0, 1].flatMap((n) => plano.principais.map((x) => ({ nome: x.nome, bloco: "principal", de: n ? "2º vídeo do dia" : x.id === TTK_TOP_ANTONELLA ? "principal, todo dia" : `principal · ${x.dias.size} dias com venda` }))),
    com_vendas: plano.comVendas.map((x) => ({ nome: x.nome, bloco: "com_vendas", de: `${real(x.g)} em 30 dias` })),
    teste: plano.testes.map((x) => ({ nome: x.nome, bloco: "teste", de: x.de || "teste" }))
  };
  Object.keys(filas).forEach((k) => { filas[k] = filas[k].filter((x) => x.nome && !ja(x.nome)); });
  const ordem = ["principal", "com_vendas", "principal", "com_vendas", "teste"], out = [];
  let i = 0, vazias = 0;
  while (out.length < qtd && vazias < ordem.length) {
    const f = filas[ordem[i % ordem.length]]; i++;
    if (f.length) { out.push(f.shift()); vazias = 0; } else vazias++;
  }
  // A meta é maior que o plano: repete quem mais vende
  const extra = [...plano.comVendas, ...plano.principais].filter((x) => x.nome);
  let j = 0; while (out.length < qtd && extra.length) { const x = extra[j++ % extra.length]; out.push({ nome: x.nome, bloco: "com_vendas", de: "mais um de quem vende" }); }
  return out;
}

function ttkTelaHoje(el) {
  if (typeof ttkSug !== "undefined" && !ttkSug.status) { el.innerHTML = `<p class="vazio">Abrindo o seu dia...</p>`; ttkSugCarregar().then(() => desenharTikTok(el)); return; }
  const hoje = hojeISO(), ontem = ttkSomaDias(hoje, -1);
  ttkX.dia = hoje;
  // Período do mês atual, sem mexer no mês escolhido nas outras telas
  ttkX.mes = hoje.slice(0, 7); ttkX.modo = "mes";
  const per = ttkPeriodo(), prev = ttkComEscopo(() => true, () => ttkPrevisao(per));
  const ultimo = ttkX.todos.length ? ttkX.todos[ttkX.todos.length - 1].dia : "";
  const dRef = ultimo && ultimo < hoje ? ultimo : ontem; // o último dia com pedido importado
  const O = ttkSomar(ttkX.todos.filter((p) => p.dia === dRef));
  const sete = [1, 2, 3, 4, 5, 6, 7].map((n) => ttkSomar(ttkX.todos.filter((p) => p.dia === ttkSomaDias(dRef, -n))));
  const m7 = sete.reduce((s, x) => s + x.g, 0) / 7, p7 = sete.reduce((s, x) => s + x.pedidos, 0) / 7;
  const caiuOntem = ttkCaiu(() => true, dRef, dRef + "~");
  const gTechO = ttkSomar(ttkX.todos.filter((p) => p.dia === dRef && ttkEhTech(p))).g;
  // Meta
  const meta = n2((ttkX.metas.mes || {})[per.mes] ?? ttkX.metas.ultimaMeta);
  const feito = ttkSomar(ttkX.todos.filter((p) => ttkNoPeriodo(p, per.ini, per.fim))).g;
  const diasRest = Math.max(1, per.D - per.fechados);
  const falta = Math.max(0, meta - feito), porDia = falta / diasRest;
  // Vídeos
  const vids = ttkX.videos.filter((v) => v.data === hoje);
  const metaV = Number(ttkX.metas.videos) || 15;
  const noAr = vids.filter((v) => v.status !== "rascunho").length;
  const porBloco = (b) => vids.filter((v) => v.bloco === b).length;
  const plano = ttkPlanoDoDia();
  const postados = vids.filter((v) => v.status === "postado").length, agendados = vids.filter((v) => v.status === "agendado").length, rascunhos = vids.filter((v) => v.status === "rascunho").length;
  // Vagas: o que falta pra meta vira sugestão com horário e produto
  const faltamVagas = Math.max(0, metaV - vids.length);
  const sugs = ttkSugestoesDoDia(plano, vids, faltamVagas), horas = ttkHorariosLivres(vids, sugs.length, hoje);
  const vagas = sugs.map((sg, i) => ({ s: sg, hora: horas[i], i }));
  ttkX.vagasHoje = vagas;
  const linhas = [...vids.map((v) => ({ v, h: v.hora ? String(v.hora).slice(0, 5) : "99" })), ...vagas.map((x) => ({ ...x, h: x.hora || "99" }))].sort((a, b) => a.h.localeCompare(b.h));
  // Amostras com prazo
  const amostras = (ttkX.amostras || []).filter((a) => a.decisao === "testando").sort((a, b) => String(a.prazo_postar || "9").localeCompare(String(b.prazo_postar || "9")));
  const liqDesde = (a) => (a.grupo_id ? ttkX.todos.filter((p) => p.grupo === a.grupo_id && p.cat === "liq" && (!a.recebida_em || p.dia >= a.recebida_em)).reduce((s, p) => s + p.liq, 0) : 0);
  const hora = new Date().getHours(), saud = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const diaSemana = new Date(hoje + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  el.innerHTML = ttkCabecalho(per, { titulo: `${saud}, Ryan`, comMes: false }) + `
    <p class="ini-frase" style="margin:-6px 0 14px">${esc(diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1))}</p>
    <div class="ttk-hoje-topo">
      <section class="ini-card ini-seg">
        <div class="ini-card-topo"><h2>Fechamento de ${dRef === ontem ? "ontem" : dataBR(dRef)}</h2><span class="ttk-etiqueta">todas as categorias</span></div>
        <div class="ttk-hoje-nums">
          <div><strong class="ini-grande">${real(O.g)}</strong><span class="ini-rot">GMV</span>${ttkSelo(O.g, m7)}<small class="ttk-hoje-sub">média de 7 dias: ${real(m7)}</small></div>
          <div><strong class="ini-medio">${num(O.pedidos)}</strong><span class="ini-rot">pedidos</span>${ttkSelo(O.pedidos, p7)}</div>
          <div><strong class="ini-medio">${real(O.c)}</strong><span class="ini-rot">comissão estimada</span></div>
          <div><strong class="ini-medio">${real(caiuOntem)}</strong><span class="ini-rot">comissão que caiu no dia</span></div>
        </div>
        <p class="ttk-status-linha">Tech foi ${real(gTechO)} desse GMV${O.g ? ` (${ttkFmtPct(ttkPct(gTechO, O.g))})` : ""}. O selo compara com a média dos 7 dias anteriores.</p>
      </section>
      <section class="ini-card ttk-meta-card">
        <div class="ini-card-topo"><h2>Meta de ${esc(MESES_LONGOS[Number(per.mes.slice(5, 7)) - 1].toLowerCase())}</h2><button class="link-btn" type="button" id="ttk-meta">${meta ? "mudar" : "definir"}</button></div>
        ${meta ? `<strong class="ini-grande">${real(feito)}</strong><span class="ini-rot">de ${real(meta)} em GMV (${ttkFmtPct(ttkPct(feito, meta))})</span>
          <div class="ttk-meta-barra" style="margin:10px 0"><i style="width:${Math.min(100, ttkPct(feito, meta))}%"></i>${prev ? `<b style="left:${Math.min(100, ttkPct(prev.total, meta))}%" title="previsão"></b>` : ""}</div>
          <div class="ttk-meta-linhas">
            <div><span>Falta</span><b>${real(falta)}</b></div>
            <div><span>Precisa vender por dia</span><b>${real(porDia)}</b></div>
            <div><span>Dias que faltam</span><b>${diasRest}</b></div>
            ${prev ? `<div><span>Previsão no ritmo atual</span><b>${real(prev.total)} <span class="ini-selo ${prev.total >= meta ? "sobe" : "desce"}">${prev.total >= meta ? "bate" : "não bate"}</span></b></div>` : ""}
          </div>` : `<p class="sub">Defina a meta de GMV do mês (todas as categorias).</p>`}
      </section>
    </div>

    <section class="ini-card ttk-bloco ttk-md">
      <div class="ttk-md-topo">
        <div><span class="ttk-md-rot">Meta de hoje</span><strong class="ttk-md-num">${noAr} <span>de ${metaV} vídeos</span></strong></div>
        <span class="ttk-md-falta">${noAr >= metaV ? "meta batida" : `faltam <b>${metaV - noAr}</b>`}</span>
        <span class="espaco"></span>
        <button class="link-btn" type="button" id="ttk-meta-videos">mudar a meta</button><button class="btn pequeno" type="button" id="ttk-novo-video">${ic("mais")}Adicionar</button>
      </div>
      <div class="ttk-md-barra"><i style="width:${Math.min(100, Math.round((noAr / metaV) * 100))}%"></i></div>
      <p class="ttk-md-dica">${postados} ${postados === 1 ? "postado" : "postados"}, ${agendados} ${agendados === 1 ? "agendado" : "agendados"}${rascunhos ? `, ${rascunhos} em rascunho` : ""}.${vagas.length ? ` As ${vagas.length} vagas que faltam já têm horário e produto sugeridos, tirados do plano dos 15: toque em Agendar.` : " Todas as vagas da meta estão preenchidas."}</p>
      <ol class="ttk-agenda">${linhas.map((x) => x.v ? `<li class="ttk-ag ttk-ag-${x.v.status}">
          <span class="ttk-ag-hora">${x.v.hora ? String(x.v.hora).slice(0, 5) : "--:--"}</span>
          <span class="ttk-ag-txt"><b>${esc(x.v.produto)}</b>${x.v.bloco ? ` <span class="ttk-bloco-chip ttk-b-${x.v.bloco}">${esc((TTK_BLOCOS.find(([k]) => k === x.v.bloco) || [0, x.v.bloco])[1])}</span>` : ""}
            ${x.v.legenda ? `<small>${esc(String(x.v.legenda).slice(0, 140))}</small>` : `<small class="ttk-sem-leg">sem legenda</small>`}</span>
          ${x.v.legenda ? `<button class="btn pequeno" type="button" data-ttk-copiar="${x.v.id}">Copiar legenda</button>` : "<span></span>"}
          <button class="pilula ttk-st-${x.v.status}" type="button" data-ttk-status="${x.v.id}" title="Toque pra mudar o status">${esc((TTK_STATUS_VIDEO.find(([k]) => k === x.v.status) || [0, x.v.status])[1])}</button>
          <button class="icone-btn" type="button" data-ttk-video="${x.v.id}" aria-label="Editar">${ic("editar")}</button></li>`
        : `<li class="ttk-ag ttk-ag-sug">
          <span class="ttk-ag-hora">${x.hora || "--:--"}</span>
          <span class="ttk-ag-txt"><b>${esc(String(x.s.nome).slice(0, 70))}</b> <span class="ttk-bloco-chip ttk-b-${x.s.bloco}">${esc((TTK_BLOCOS.find(([k]) => k === x.s.bloco) || [0, x.s.bloco])[1])}</span><small>${esc(x.s.de || "")}${x.hora ? "" : " · o dia já está no fim"}</small></span>
          <span></span>
          <span class="pilula ttk-st-sugestao">sugestão</span>
          <button class="btn pequeno" type="button" data-ttk-agendar="${x.i}">Agendar</button></li>`).join("") || `<li class="sub">Defina a meta de vídeos pra montar o dia.</li>`}</ol>
      <details class="ttk-md-plano"><summary>Ver o plano dos 15 (principais, com vendas e testes)</summary>
      <div class="ttk-plano">
        ${[["principal", "Principais", 6, plano.principais.map((x) => ({ nome: x.nome, de: x.id === TTK_TOP_ANTONELLA ? "sempre, 2 vídeos" : `2 vídeos · ${x.dias.size} dias com venda` }))],
           ["com_vendas", "Com vendas", 6, plano.comVendas.map((x) => ({ nome: x.nome, de: `${real(x.g)} em 30 dias` }))],
           ["teste", "Testes", 3, plano.testes]].map(([k, n, alvo, itens]) => { const f = porBloco(k); return `<div class="ttk-plano-col">
          <div class="ttk-plano-topo"><b>${n}</b><span class="ini-selo ${f >= alvo ? "sobe" : ""}">${f} de ${alvo}</span></div>
          <ol>${itens.map((x) => `<li><span>${esc(String(x.nome || "").slice(0, 60))}</span><small>${esc(x.de || "")}</small></li>`).join("") || `<li class="sub">Nada aqui ainda.</li>`}</ol></div>`; }).join("")}
      </div></details>
    </section>

    <div class="grade-2 ttk-grade2">
      <section class="ini-card ttk-bloco">
        <div class="ini-card-topo"><h2>Amostras com prazo</h2><span class="espaco"></span><button class="link-btn" type="button" data-ttk-ir="amostras">ver todas</button></div>
        <ul class="ttk-hoje-lista">${amostras.slice(0, 6).map((a) => { const d = a.prazo_postar ? Math.round((new Date(a.prazo_postar + "T12:00") - new Date(hoje + "T12:00")) / 864e5) : null; const liq = liqDesde(a), custo = n2(a.custo) - n2(a.reembolsado); return `<li>
          <span><b>${esc(a.produto)}</b><small>${liq ? `${real(liq)} liquidada desde que chegou` : "ainda sem comissão liquidada"}${custo > 0 ? ` · custo ${real(custo)}` : ""}</small></span>
          <span class="ini-selo ${d == null ? "" : d < 0 ? "desce" : d <= 2 ? "ttk-novo" : ""}">${d == null ? "sem prazo" : d < 0 ? `venceu há ${-d} ${-d === 1 ? "dia" : "dias"}` : d === 0 ? "vence hoje" : `faltam ${d} ${d === 1 ? "dia" : "dias"}`}</span></li>`; }).join("") || `<li class="sub">Nenhuma amostra em teste.</li>`}</ul>
      </section>
      <section class="ini-card ttk-bloco">
        <div class="ini-card-topo"><h2>Produto da vez pra testar</h2><span class="espaco"></span><button class="link-btn" type="button" data-ttk-ir="sugestoes">ver sugestões</button></div>
        ${ttkProdutoDaVez()}
      </section>
    </div>`;

  el.querySelectorAll("[data-ttk-agendar]").forEach((b) => b.onclick = () => {
    const x = (ttkX.vagasHoje || [])[Number(b.dataset.ttkAgendar)]; if (!x) return;
    ttkFormVideo(el, null, hoje, { produto: x.s.nome, hora: x.hora || "", bloco: x.s.bloco, status: "agendado" });
  });
  el.querySelectorAll("[data-ttk-copiar]").forEach((b) => b.onclick = async () => {
    const v = ttkX.videos.find((x) => String(x.id) === b.dataset.ttkCopiar); if (!v) return;
    try { await navigator.clipboard.writeText(v.legenda); b.textContent = "Copiada"; } catch (_) { avisar("Não consegui copiar. Abra o vídeo no lápis e copie de lá.", true); }
  });
}

function ttkProdutoDaVez() {
  if (typeof ttkSug === "undefined" || !ttkSug.lista) return `<p class="vazio">Sem sugestões carregadas.</p>`;
  const st = ttkSug.status || {};
  const s = ttkSug.lista.filter((x) => x.tipo === "testar" && !["descartei", "entrou", "testando"].includes(st[x.id])).sort((a, b) => (a.fila || 99) - (b.fila || 99))[0];
  if (!s) return `<p class="vazio">Todos os testes da fila já estão andando.</p>`;
  return `<div class="ttk-davez">${ttkSugFotoHTML(s, "ttk-sug-foto")}<div><b>${esc(s.nome)}</b><p class="sub" style="margin:2px 0 6px">${esc(s.nota)}</p>
    <span class="sub">${s.rec ? `até ${ttkSugReal(s.rec)} estimado · ` : ""}+${ttkSugMil(s.dia)} views por dia</span></div></div>`;
}

/* ---------- Criar > Gravação ---------- */
const TTK_ETAPAS_GRAV = [["ideia", "Ideia"], ["gravar", "Gravar"], ["gravado", "Gravado"], ["agendado", "Agendado"]];
const ttkGrav = { cards: null };
async function ttkGravCarregar() {
  if (ttkGrav.cards) return;
  ttkGrav.cards = [];
  try { const { data } = await db.from("preferencias").select("valor").eq("chave", "ttk_gravar").maybeSingle(); if (data && data.valor) ttkGrav.cards = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor; } catch (_) {}
}
async function ttkGravSalvar() {
  const { error } = await db.from("preferencias").upsert({ chave: "ttk_gravar", valor: JSON.stringify(ttkGrav.cards), atualizado_em: new Date().toISOString() });
  if (error) { avisar(traduzErro(error), true); return false; }
  return true;
}
// Usado pelo Modelar copy: manda a copy pronta pro quadro
async function ttkGravarAdicionar(card) {
  await ttkGravCarregar();
  const c = { id: Date.now().toString(36), etapa: "gravar", criado: hojeISO(), ...card };
  ttkGrav.cards.push(c);
  return ttkGravSalvar();
}

function ttkTelaGravar(el) {
  if (!ttkGrav.cards) { el.innerHTML = `<p class="vazio">Abrindo o quadro...</p>`; ttkGravCarregar().then(() => desenharTikTok(el)); return; }
  const per = ttkPeriodo();
  const nomes = Object.values(ttkX.grupos || {}).map((g) => g.nome).sort((a, b) => String(a).localeCompare(String(b)));
  el.innerHTML = ttkCabecalho(per, { titulo: "Gravação", comMes: false }) + `
    <p class="ini-frase" style="margin:-6px 0 12px">Cada cartão é um vídeo. Ele anda de Ideia até Agendado. As copies do Modelar copy chegam direto em Gravar.</p>
    <form class="ini-card ttk-bloco ttk-grav-novo" id="ttk-grav-form">
      <input class="campo" id="ttk-grav-prod" list="ttk-grav-lista" placeholder="Produto" required>
      <datalist id="ttk-grav-lista">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <input class="campo" id="ttk-grav-obs" placeholder="Ângulo ou gancho (opcional)">
      <button class="btn primario pequeno" type="submit">${ic("mais")}Nova ideia</button>
    </form>
    <div class="ttk-kanban">${TTK_ETAPAS_GRAV.map(([k, n], i) => { const cs = ttkGrav.cards.filter((c) => c.etapa === k); return `<section class="ttk-kcol">
      <div class="ttk-kcol-topo"><b>${n}</b><span class="sub">${cs.length}</span></div>
      ${cs.map((c) => `<div class="ttk-kcard">
        <b>${esc(c.produto)}</b>${c.obs ? `<small>${esc(c.obs)}</small>` : ""}${c.ref ? `<button type="button" class="link-btn" data-grav-ref="${esc(c.ref)}">ver a copy</button>` : ""}
        <div class="ttk-kacoes">
          <button type="button" class="icone-btn" data-grav-mover="${c.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Voltar">${ic("esq")}</button>
          <button type="button" class="icone-btn" data-grav-apagar="${c.id}" aria-label="Apagar">${ic("apagar")}</button>
          <button type="button" class="icone-btn" data-grav-mover="${c.id}" data-dir="1" ${i === TTK_ETAPAS_GRAV.length - 1 ? "disabled" : ""} aria-label="Avançar">${ic("dir")}</button>
        </div></div>`).join("") || `<p class="sub ttk-kvazio">Nada aqui.</p>`}
    </section>`; }).join("")}</div>`;
  const redesenhar = () => { const y = window.scrollY; desenharTikTok(el); window.scrollTo(0, y); };
  el.querySelector("#ttk-grav-form").onsubmit = async (e) => {
    e.preventDefault();
    const produto = el.querySelector("#ttk-grav-prod").value.trim(); if (!produto) return;
    ttkGrav.cards.push({ id: Date.now().toString(36), produto, obs: el.querySelector("#ttk-grav-obs").value.trim(), etapa: "ideia", criado: hojeISO() });
    if (await ttkGravSalvar()) redesenhar();
  };
  el.querySelectorAll("[data-grav-mover]").forEach((b) => b.onclick = async () => {
    const c = ttkGrav.cards.find((x) => x.id === b.dataset.gravMover); if (!c) return;
    const i = TTK_ETAPAS_GRAV.findIndex(([k]) => k === c.etapa) + Number(b.dataset.dir);
    if (i < 0 || i >= TTK_ETAPAS_GRAV.length) return;
    c.etapa = TTK_ETAPAS_GRAV[i][0]; if (await ttkGravSalvar()) redesenhar();
  });
  el.querySelectorAll("[data-grav-apagar]").forEach((b) => b.onclick = async () => {
    if (!(await confirmar("Apagar este cartão?", "Apagar"))) return;
    ttkGrav.cards = ttkGrav.cards.filter((x) => x.id !== b.dataset.gravApagar); if (await ttkGravSalvar()) redesenhar();
  });
  el.querySelectorAll("[data-grav-ref]").forEach((b) => b.onclick = () => { if (typeof ttkMod !== "undefined") ttkMod.sel = b.dataset.gravRef; irParaSub("tiktok", "modelar"); });
}

(function ttkHojeEstilo() {
  const st = document.createElement("style");
  st.textContent = `
    .ttk-hoje-topo { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px; margin-bottom: 14px; }
    .ttk-hoje-topo .ini-card { margin: 0; }
    .ttk-hoje-nums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 14px; align-items: end; margin: 6px 0 10px; }
    .ttk-hoje-nums > div:first-child { grid-column: 1 / -1; }
    .ttk-hoje-nums > div { min-width: 0; }
    .ttk-hoje-sub { display: block; opacity: .75; font-size: 12px; margin-top: 2px; }
    .ttk-plano { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
    .ttk-plano-col { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
    .ttk-plano-topo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .ttk-plano ol { margin: 0; padding-left: 18px; display: grid; gap: 5px; font-size: 13px; }
    .ttk-plano li small { display: block; color: var(--muted); font-size: 11.5px; }
    .ttk-md-topo { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 8px 16px; margin-bottom: 10px; }
    .ttk-md-rot { display: block; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
    .ttk-md-num { font-size: 30px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; }
    .ttk-md-num span { font-size: 16px; font-weight: 600; color: var(--muted); }
    .ttk-md-falta { font-size: 14px; color: var(--muted); padding-bottom: 4px; }
    .ttk-md-falta b { color: var(--text); font-size: 18px; }
    .ttk-md-barra { height: 12px; border-radius: 99px; background: var(--tint); overflow: hidden; }
    .ttk-md-barra i { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #5a3a1c, #a8742c); }
    .ttk-md-dica { margin: 10px 0 12px; font-size: 13px; color: var(--muted); }
    .ttk-agenda { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 6px; }
    .ttk-ag { display: grid; grid-template-columns: 66px minmax(0, 1fr) auto auto auto; gap: 12px; align-items: center; padding: 8px 10px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); font-size: 13.5px; }
    .ttk-ag-hora { text-align: center; padding: 7px 0; border-radius: 9px; background: #f3e2c7; color: #5a3a12; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: .02em; }
    .ttk-ag-postado .ttk-ag-hora { background: var(--green-bg); color: var(--green); }
    .ttk-ag-txt { min-width: 0; }
    .ttk-ag-txt small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ttk-ag-sug { background: transparent; border-style: dashed; }
    .ttk-ag-sug .ttk-ag-hora { background: transparent; border: 1.5px dashed #c9a46a; color: #7a5310; }
    .ttk-st-sugestao { background: #fbf0d6; color: #7a5310; }
    .ttk-md-plano summary { cursor: pointer; font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 10px; }
    .ttk-hoje-vids { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
    .ttk-hoje-vids li { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto auto auto; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--line); font-size: 13.5px; }
    .ttk-hoje-vids li:last-child { border-bottom: 0; }
    .ttk-hoje-vids li.sub { display: block; padding: 10px 0; }
    .ttk-hoje-vtexto small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }
    .ttk-sem-leg { font-style: italic; }
    .ttk-bloco-chip { font-size: 11px; padding: 2px 8px; border-radius: 99px; background: var(--tint); font-weight: 600; }
    .ttk-b-principal { background: #f3e2c7; color: #6b4410; }
    .ttk-b-teste { background: #dfe8f5; color: #23446e; }
    .ttk-hoje-lista { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .ttk-hoje-lista li { display: flex; justify-content: space-between; gap: 10px; align-items: center; font-size: 13.5px; }
    .ttk-hoje-lista small { display: block; color: var(--muted); font-size: 12px; }
    .ttk-davez { display: flex; gap: 12px; align-items: flex-start; font-size: 13.5px; }
    .ttk-grav-novo { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .ttk-grav-novo .campo { flex: 1; min-width: 180px; }
    .ttk-kanban { display: grid; grid-template-columns: repeat(4, minmax(200px, 1fr)); gap: 12px; overflow-x: auto; padding-bottom: 6px; }
    .ttk-kcol { background: var(--tint); border-radius: 14px; padding: 10px; min-height: 160px; display: flex; flex-direction: column; gap: 8px; }
    .ttk-kcol-topo { display: flex; justify-content: space-between; padding: 2px 4px; }
    .ttk-kcard { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 9px 10px; font-size: 13px; }
    .ttk-kcard small { display: block; color: var(--muted); margin-top: 2px; }
    .ttk-kacoes { display: flex; justify-content: space-between; margin-top: 6px; }
    .ttk-kvazio { text-align: center; margin: 10px 0; }
    @media (max-width: 900px) { .ttk-hoje-topo, .ttk-plano { grid-template-columns: 1fr; } .ttk-hoje-nums { grid-template-columns: 1fr 1fr; } .ttk-hoje-vids li { grid-template-columns: 46px minmax(0, 1fr) auto; } .ttk-hoje-vids li > button.btn { grid-column: 2; justify-self: start; } .ttk-ag { grid-template-columns: 58px minmax(0, 1fr) auto; } .ttk-ag > .btn, .ttk-ag > span:empty { grid-column: 2; justify-self: start; } }`;
  document.head.appendChild(st);
})();
