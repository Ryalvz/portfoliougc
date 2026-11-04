/* =============================================================
   ADMIN, PARTE 9: a página inicial nova
   Saudação grande com o resumo do dia, o dinheiro do mês, os
   cartões de Seguidores e Alcance com gráficos (números oficiais
   do Instagram), o "Para fazer" e um calendário pequeno. Embaixo,
   a semana, as ideias, os e-mails e o ranking dos vídeos.
   A página antiga (desenharInicio) continua em admin.js de reserva.
   ============================================================= */
const ini = { cache: {}, mes: null };

// Números do Instagram guardados por período, pra trocar 7/14/30 dias sem esperar de novo
function iniTrocarPeriodo(dias) {
  if (ig.dados) ini.cache[ig.dados.dias] = ig.dados;
  ig.dias = dias;
  if (ini.cache[dias]) { ig.dados = ini.cache[dias]; desenhar(); return; }
  carregarInstagram();
}
const iniPeriodoHTML = () => `<div class="ini-periodo" role="group" aria-label="Período">${[7, 14, 30].map((n) => `<button type="button" data-ini-dias="${n}" aria-pressed="${(ig.dados ? ig.dados.dias : ig.dias) === n}">${n} dias</button>`).join("")}</div>`;

// Selo de subiu/caiu comparado com o período anterior
function iniSelo(atual, antes, pp) {
  if (!antes && !atual) return "";
  if (pp) { const d = atual - antes; if (Math.abs(d) < 0.05) return `<span class="ini-selo">igual</span>`; return `<span class="ini-selo ${d > 0 ? "sobe" : "desce"}">${d > 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1).replace(".", ",")} p.p.</span>`; }
  if (!antes) return `<span class="ini-selo sobe">novo</span>`;
  const v = ((atual - antes) / antes) * 100;
  if (Math.abs(v) < 0.5) return `<span class="ini-selo">igual</span>`;
  return `<span class="ini-selo ${v > 0 ? "sobe" : "desce"}">${v > 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1).replace(".", ",")}%</span>`;
}
const iniDiaCurto = (iso) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/* ---------- Gráficos (SVG, sem biblioteca) ---------- */
// Barras do saldo de seguidores por dia: acima da linha ganhou, abaixo perdeu
function iniBarras(dias) {
  if (dias.length < 2) return `<p class="ini-vazio-graf">O gráfico aparece depois de alguns dias de histórico.</p>`;
  const W = 320, H = 96, base = 64, maxPos = Math.max(1, ...dias.map((d) => d.v)), maxNeg = Math.max(1, ...dias.map((d) => -d.v));
  const passo = W / dias.length, larg = Math.max(3, Math.min(18, passo - 3));
  const altPos = base - 6, altNeg = H - base - 4;
  return `<svg class="ini-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Saldo de seguidores por dia">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="ini-base"/>
    ${dias.map((d, i) => {
      const x = i * passo + (passo - larg) / 2;
      const h = d.v >= 0 ? Math.max(d.v ? 2 : 0, (d.v / maxPos) * altPos) : Math.max(2, (-d.v / maxNeg) * altNeg);
      const y = d.v >= 0 ? base - h : base;
      const dica = `${iniDiaCurto(d.dia)}: ${d.v > 0 ? "+" : ""}${num(d.v)} seguidores`;
      return `<g data-dica="${esc(dica)}"><rect x="${i * passo}" y="0" width="${passo}" height="${H}" fill="transparent"/>
        ${h ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${larg.toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${d.v >= 0 ? "ini-barra" : "ini-barra neg"}"/>` : ""}</g>`;
    }).join("")}
  </svg>`;
}
// Linha do alcance de cada dia
function iniLinha(dias) {
  if (dias.length < 2) return `<p class="ini-vazio-graf">Sem alcance por dia nesse período.</p>`;
  const W = 320, H = 96, topo = 8, fundo = 86, max = Math.max(1, ...dias.map((d) => d.valor));
  const px = (i) => (i / (dias.length - 1)) * W, py = (v) => fundo - (v / max) * (fundo - topo);
  const pts = dias.map((d, i) => `${px(i).toFixed(1)},${py(d.valor).toFixed(1)}`);
  const ult = dias.length - 1;
  return `<svg class="ini-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Alcance por dia">
    <path d="M0,${fundo} L${pts.join(" L")} L${W},${fundo} Z" class="ini-area"/>
    <polyline points="${pts.join(" ")}" class="ini-linha" vector-effect="non-scaling-stroke"/>
    <line class="ini-mira" x1="0" x2="0" y1="${topo}" y2="${fundo}" vector-effect="non-scaling-stroke" style="display:none"/>
    ${dias.map((d, i) => `<rect data-dica="${esc(`${iniDiaCurto(d.dia)}: ${num(d.valor)} contas alcançadas`)}" data-x="${px(i).toFixed(1)}" x="${Math.max(0, px(i) - W / dias.length / 2).toFixed(1)}" y="0" width="${(W / dias.length).toFixed(1)}" height="${H}" fill="transparent"/>`).join("")}
  </svg><span class="ini-ponto" style="left:${((px(ult) / W) * 100).toFixed(2)}%;top:${((py(dias[ult].valor) / H) * 100).toFixed(2)}%"></span>`;
}
// Dica ao passar o mouse (ou tocar) nos gráficos
function iniLigarDicas(raiz) {
  $$(".ini-graf-caixa", raiz).forEach((cx) => {
    const dica = $(".ini-dica", cx), mira = $(".ini-mira", cx);
    const mostrar = (alvo, ev) => {
      if (!alvo) { dica.hidden = true; if (mira) mira.style.display = "none"; return; }
      dica.textContent = alvo.dataset.dica; dica.hidden = false;
      const r = cx.getBoundingClientRect(), x = (ev.clientX || 0) - r.left;
      dica.style.left = Math.min(Math.max(x, 60), r.width - 60) + "px";
      if (mira && alvo.dataset.x) { mira.setAttribute("x1", alvo.dataset.x); mira.setAttribute("x2", alvo.dataset.x); mira.style.display = ""; }
    };
    cx.addEventListener("pointermove", (e) => mostrar(e.target.closest("[data-dica]"), e));
    cx.addEventListener("pointerleave", () => mostrar(null));
  });
}

/* ---------- Cartões do Instagram ---------- */
function iniSaldoPorDia(dias) {
  const h = (S.igHistorico || []).filter((x) => x.seguidores != null).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const desde = somaDiasISO(-dias);
  const r = [];
  for (let i = 1; i < h.length; i++) {
    const dia = String(h[i].data).slice(0, 10);
    if (dia <= desde) continue;
    r.push({ dia, v: Number(h[i].seguidores) - Number(h[i - 1].seguidores) });
  }
  return r;
}
function iniCartoesIG() {
  if (ig.carregando && !ig.dados) return `<section class="ini-card ini-seg"><p class="ini-carregando">Buscando o Instagram...</p></section><section class="ini-card ini-alc"><p class="ini-carregando">Buscando o alcance...</p></section>`;
  if (!ig.conectado || !ig.dados) return `<section class="ini-card ini-seg ini-sem-ig"><h2>Seguidores</h2><p>Conecte o @ryalvz para ver os seguidores, o alcance e o engajamento aqui.</p><button type="button" class="btn pequeno" data-ir="instagram">${ic("insta")}Conectar o Instagram</button></section>
    <section class="ini-card ini-alc ini-sem-ig"><h2>Alcance</h2><p class="sub">Os números aparecem depois de conectar.</p></section>`;
  const d = ig.dados, a = d.atual || {}, b = d.anterior || {}, n = d.dias;
  const novos = n2(a.seguiram), perdeu = n2(a.deixaram);
  const eng = n2(a.reach) ? (n2(a.total_interactions) / n2(a.reach)) * 100 : 0, engAntes = n2(b.reach) ? (n2(b.total_interactions) / n2(b.reach)) * 100 : 0;
  const atualizando = ig.carregando ? `<small class="ini-atualizando">atualizando...</small>` : "";
  return `<section class="ini-card ini-seg">
      <div class="ini-card-topo"><h2>Seguidores</h2>${iniPeriodoHTML()}</div>
      <div class="ini-seg-nums">
        <div><strong class="ini-grande">${num(d.perfil.followers_count)}</strong><span class="ini-rot">total hoje</span></div>
        <div><strong class="ini-medio">+${num(novos)}</strong><span class="ini-rot">novos em ${n} dias</span>${iniSelo(novos, n2(b.seguiram))}</div>
      </div>
      <div class="ini-seg-perdeu"><strong class="ini-medio">−${num(perdeu)}</strong><span class="ini-rot">deixaram de seguir em ${n} dias</span></div>
      <div class="ini-graf-caixa">${iniBarras(iniSaldoPorDia(n))}<div class="ini-dica" hidden></div></div>
      <p class="ini-legenda">Saldo de seguidores por dia ${atualizando}</p>
    </section>
    <section class="ini-card ini-alc">
      <div class="ini-card-topo"><h2>Alcance</h2>${iniPeriodoHTML()}</div>
      <div class="ini-alc-nums">
        <div><strong class="ini-medio">${compacto(a.reach)}</strong><span class="ini-rot">contas alcançadas</span>${iniSelo(n2(a.reach), n2(b.reach))}</div>
        <div><strong class="ini-medio">${eng.toFixed(1).replace(".", ",")}%</strong><span class="ini-rot">engajamento</span>${iniSelo(eng, engAntes, true)}</div>
        <div><strong class="ini-medio">${compacto(a.total_interactions)}</strong><span class="ini-rot">interações</span>${iniSelo(n2(a.total_interactions), n2(b.total_interactions))}</div>
      </div>
      <div class="ini-alc-views"><strong class="ini-medio">${compacto(a.views)}</strong><span class="ini-rot">visualizações</span>${iniSelo(n2(a.views), n2(b.views))}</div>
      <div class="ini-graf-caixa">${iniLinha(d.porDia || [])}<div class="ini-dica" hidden></div></div>
      <p class="ini-legenda">${(d.porDia || []).length ? `${iniDiaCurto(d.porDia[0].dia)} a ${iniDiaCurto(d.porDia[d.porDia.length - 1].dia)}, comparado com os ${n} dias antes` : ""} ${atualizando}</p>
      <button type="button" class="link-btn" data-ir="instagram">Ver as métricas completas</button>
    </section>`;
}

/* ---------- Calendário pequeno ---------- */
function iniCalendario(eventos) {
  const hoje = hojeISO();
  if (!ini.mes) ini.mes = hoje.slice(0, 7);
  const [a, m] = ini.mes.split("-").map(Number);
  const prim = new Date(a, m - 1, 1), diasMes = new Date(a, m, 0).getDate();
  const porDia = {};
  eventos.forEach((e) => { if (e.data.slice(0, 7) === ini.mes) (porDia[e.data] = porDia[e.data] || []).push(e); });
  const celulas = [];
  for (let i = 0; i < prim.getDay(); i++) celulas.push(`<span class="ini-dia fora"></span>`);
  for (let dd = 1; dd <= diasMes; dd++) {
    const iso = `${ini.mes}-${pad(dd)}`, tem = (porDia[iso] || []).length;
    celulas.push(`<button type="button" class="ini-dia ${iso === hoje ? "hoje" : ""} ${tem ? "tem" : ""}" data-ini-dia="${iso}" aria-label="${dd} de ${MESES_LONGOS[m - 1].toLowerCase()}${tem ? `, ${tem} ${tem === 1 ? "item" : "itens"}` : ""}">${dd}${tem ? `<i>${"<b></b>".repeat(Math.min(3, tem))}</i>` : ""}</button>`);
  }
  return `<section class="ini-card ini-cal">
    <div class="ini-cal-topo"><button type="button" class="icone-btn" data-ini-mes="-1" aria-label="Mês anterior">${ic("esq")}</button>
      <span class="ini-cal-mes">${MESES_LONGOS[m - 1]} ${a}</span>
      <button type="button" class="icone-btn" data-ini-mes="1" aria-label="Próximo mês">${ic("dir")}</button></div>
    <div class="ini-cal-sem">${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((x) => `<span>${x}</span>`).join("")}</div>
    <div class="ini-cal-grade">${celulas.join("")}</div>
    <button type="button" class="btn primario ini-cal-novo" data-ini-novo>${ic("mais")}Novo na agenda</button>
  </section>`;
}

/* ---------- A página ---------- */
function desenharInicioNovo(el) {
  const agora = new Date(), hoje = hojeISO();
  const ano = agora.getFullYear(), mes = agora.getMonth() + 1, h = agora.getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";

  const fat = faturadoEm(ano, mes), meta = metaDe(ano, mes);
  const aReceber = S.contratos.reduce((s, c) => s + saldoDe(c), 0);
  const vencido = S.contratos.filter((c) => situacaoDe(c) === "Vencido").reduce((s, c) => s + saldoDe(c), 0);
  const emProducao = S.contratos.filter((c) => grupoDe(c.status) === "producao");
  const entregasSemana = emProducao.filter((c) => c.prazo_entrega && c.prazo_entrega <= somaDiasISO(7));
  const diaDe = (v) => isoLocal(new Date(v.data));
  const visitasHoje = S.visitas.filter((v) => diaDe(v) === hoje).length, visitas7 = S.visitas.filter((v) => diaDe(v) > somaDiasISO(-7)).length;

  const todos = eventosCalendario();
  const eventos = todos.filter((e) => !e.feito);
  const atrasados = eventos.filter((e) => e.data < hoje && e.data >= somaDiasISO(-30));
  const deHoje = eventos.filter((e) => e.data === hoje);
  const proximos = eventos.filter((e) => e.data > hoje && e.data <= somaDiasISO(7));
  const follow = typeof marcasFollowup === "function" ? marcasFollowup().length : 0;
  const naoLidas = gmailConectado() && gm.emails ? propostasVisiveis().filter((x) => x.novo).length : 0;

  // A frase do dia
  const partes = [];
  partes.push(deHoje.length ? `${plural(deHoje.length, "coisa", "coisas")} pra hoje` : "nada marcado pra hoje");
  if (atrasados.length) partes.push(`${plural(atrasados.length, "atrasada", "atrasadas")}`);
  if (entregasSemana.length) partes.push(`${plural(entregasSemana.length, "entrega", "entregas")} na semana`);
  if (naoLidas) partes.push(`${plural(naoLidas, "proposta nova", "propostas novas")}`);
  if (follow) partes.push(`${plural(follow, "follow-up", "follow-ups")} de prospecção`);
  const frase = partes.length > 1 ? partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1] : partes[0];

  const linhaEvento = (e, extra = "") => `<button type="button" class="item-dia" data-evento="${esc(e.origem)}:${esc(e.ref.id)}">
      <span class="pilula item-cal t-${esc(e.tipo)}" style="width:auto;margin:0">${e.hora ? horaCurta(e.hora) + " · " : ""}${esc(nomeTipo(e.tipo))}</span>
      <span class="item-dia-texto sigilo"><b>${esc(e.titulo || "")}</b>${e.marca || e.local ? `<small>${esc([e.marca, e.local].filter(Boolean).join(" · "))}</small>` : ""}</span>${extra}</button>`;
  const ideias = S.transcricoes.filter((t) => ["agora", "fazendo"].includes(etapaDe(t))).sort((a, b) => (etapaDe(a) === "fazendo" ? 0 : 1) - (etapaDe(b) === "fazendo" ? 0 : 1)).slice(0, 5);
  const contatosRecentes = S.contatos_site.filter((c) => Date.now() - Date.parse(c.criado_em) < 30 * 864e5).slice(0, 5);
  // O cartão de e-mails é o mesmo de antes (sem o do Instagram, que agora tem os seus)
  const tmp = document.createElement("div"); tmp.innerHTML = quadrosEntrada();
  const cartaoEmails = (tmp.querySelector(".grade-entrada > .cartao") || {}).outerHTML || "";
  const pctMeta = meta ? Math.min(100, pct(fat, meta)) : 0;

  el.innerHTML = `<div class="ini">
    <header class="ini-topo">
      <div><p class="ini-sobre"><span class="ini-traco"></span>Painel · ${DIAS_SEMANA[agora.getDay()]}, ${agora.getDate()} de ${MESES_LONGOS[agora.getMonth()].toLowerCase()}</p>
        <h1 class="ini-ola">${saudacao}, Ryan.</h1>
        <p class="ini-frase">${esc(frase.charAt(0).toUpperCase() + frase.slice(1))}.</p></div>
      <div class="inicio-acoes">
        <button class="btn" type="button" data-rapido="lembrete">${ic("sino")}Lembrete</button>
        <button class="btn" type="button" data-rapido="ttk">${ic("mais")}Repasse TikTok</button>
        <button class="btn primario" type="button" data-rapido="ideia">${ic("mais")}Nova ideia</button>
      </div>
    </header>

    <div class="inicio-kpis">
      <button type="button" class="kpi-inicio" data-ir="financeiro"><span>Faturado em ${MESES_LONGOS[mes - 1].toLowerCase()}</span><strong>${real(fat)}</strong>
        ${meta ? `<span class="meta-trilho mini ${fat >= meta ? "batida" : ""}"><i style="width:${pctMeta}%"></i></span><small>${pct(fat, meta)}% da meta de ${real(meta)}</small>` : `<small>sem meta definida</small>`}</button>
      <button type="button" class="kpi-inicio ${vencido ? "alerta" : ""}" data-ir="financeiro"><span>Para receber</span><strong>${real(aReceber)}</strong><small>${vencido ? `${real(vencido)} vencido` : "nada vencido"}</small></button>
      <button type="button" class="kpi-inicio" data-ir="campanhas"><span>Em produção</span><strong>${qtd(emProducao.length, "campanha", "campanhas")}</strong><small>${entregasSemana.length ? `${qtd(entregasSemana.length, "entrega", "entregas")} nos próximos 7 dias` : "nenhuma entrega na semana"}</small></button>
      <button type="button" class="kpi-inicio" data-ir="portfolio" data-pf-sub="leads"><span>Visitas no site</span><strong>${plural(visitasHoje, "hoje", "hoje")}</strong><small>${plural(visitas7, "visita", "visitas")} nos últimos 7 dias</small></button>
    </div>

    <div class="ini-grade">
      ${iniCartoesIG()}
      <div class="ini-lado">
        <section class="ini-card ini-fazer">
          <div class="ini-card-topo"><h2>Para fazer</h2><button type="button" class="link-btn" data-ir="calendario">Abrir</button></div>
          ${atrasados.length || deHoje.length ? `<div class="lista-dia">${atrasados.map((e) => linhaEvento(e, `<span class="etq vermelha">${plural(diasEntre(e.data, hoje), "dia", "dias")} atrasado</span>`)).join("")}${deHoje.map((e) => linhaEvento(e)).join("")}</div>` : `<p class="sub" style="margin:0">Tudo feito por aqui.</p>`}
          ${follow ? `<button type="button" class="ini-follow" data-ir="prospeccao" data-pro-sub-ir="acompanhar">${ic("relogio")}${plural(follow, "marca precisa", "marcas precisam")} de follow-up</button>` : ""}
        </section>
        ${iniCalendario(todos)}
      </div>
    </div>

    <div class="grade-inicio">
      <div class="cartao">
        <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Próximos 7 dias</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="calendario">abrir calendário</button></div>
        ${proximos.length ? `<div class="lista-dia">${proximos.slice(0, 7).map((e) => linhaEvento(e, `<span class="sub">${DIAS_SEMANA[deISO(e.data).getDay()].slice(0, 3)} ${dataBR(e.data).slice(0, 5)}</span>`)).join("")}</div>${proximos.length > 7 ? `<p class="sub">e mais ${proximos.length - 7} no calendário</p>` : ""}` : `<p class="vazio">Semana livre por enquanto.</p>`}
      </div>
      <div class="coluna-inicio">
        ${cartaoEmails}
        <div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Ideias em andamento</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="transcricoes">ver todas</button></div>
          ${ideias.length ? `<div class="lista-dia">${ideias.map((t) => `<button type="button" class="item-dia" data-ideia="${esc(t.id)}"><span class="pilula ${etapaDe(t) === "fazendo" ? "p-conversando" : "p-pendente"}">${etapaDe(t) === "fazendo" ? "Fazendo" : "Fazer agora"}</span><span class="item-dia-texto sigilo"><b>${esc(t.titulo || "Ideia sem título")}</b><small>${esc(nomeCategoria(t.categoria))}</small></span></button>`).join("")}</div>` : `<p class="vazio">Nenhuma ideia em "Fazer agora" ou "Fazendo".</p>`}
        </div>
        ${contatosRecentes.length ? `<div class="cartao">
          <div class="barra" style="margin-bottom:6px"><h2 style="margin:0">Clientes que entraram em contato</h2><span class="espaco"></span><button type="button" class="link-btn" data-ir="portfolio" data-pf-sub="leads">ver todos</button></div>
          <div class="lista-dia">${contatosRecentes.map((c) => `<button type="button" class="item-dia" data-ir="portfolio" data-pf-sub="leads"><span class="pilula ${c.visto ? "p-conversando" : "p-pendente"}">${c.visto ? (c.tipo === "midia_kit" ? "Mídia kit" : "Formulário") : "Novo"}</span><span class="item-dia-texto sigilo"><b>${esc(c.marca || c.nome)}</b><small>${esc(c.marca ? c.nome : c.email)} · ${dataBR(String(c.criado_em).slice(0, 10)).slice(0, 5)}</small></span></button>`).join("")}</div></div>` : ""}
      </div>
    </div>
    <div id="inicio-ranking"></div>
  </div>`;
  if (typeof pintarRankingVideos === "function") pintarRankingVideos($("#inicio-ranking", el));
  if (ig.conectado === null && !ig.carregando) carregarInstagram();
  if (ig.dados) ini.cache[ig.dados.dias] = ig.dados;
  iniLigarDicas(el);

  const conectarGm = $("#inicio-conectar-gmail", el);
  if (conectarGm) conectarGm.onclick = async () => { try { await conectarGmail(); lerPropostas(); } catch (erro) { avisar(erro.message, true); } };
  el.onclick = (e) => {
    const p = e.target.closest("[data-ini-dias]");
    if (p) { iniTrocarPeriodo(Number(p.dataset.iniDias)); return; }
    const mm = e.target.closest("[data-ini-mes]");
    if (mm) { const [a, m] = ini.mes.split("-").map(Number); const d = new Date(a, m - 1 + Number(mm.dataset.iniMes), 1); ini.mes = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; desenhar(); return; }
    const dia = e.target.closest("[data-ini-dia]");
    if (dia) { const l = todos.filter((x) => x.data === dia.dataset.iniDia); if (l.length) abrirDia(dia.dataset.iniDia, l); else formCalendario(null, dia.dataset.iniDia); return; }
    if (e.target.closest("[data-ini-novo]")) { formCalendario(null, hoje); return; }
    const abrirEmail = e.target.closest("[data-inicio-email]");
    if (abrirEmail) { const x = (gm.emails || []).find((m) => m.id === abrirEmail.dataset.inicioEmail); irPara("propostas"); if (x) abrirConversa(x); return; }
    const ir = e.target.closest("[data-ir]");
    if (ir) { if (ir.dataset.pfSub) pf.sub = ir.dataset.pfSub; if (ir.dataset.proSubIr) pro.sub = ir.dataset.proSubIr; irPara(ir.dataset.ir); return; }
    const ev = e.target.closest("[data-evento]");
    if (ev) { const [origem, id] = ev.dataset.evento.split(":"); if (origem === "campanha") formContrato(S.contratos.find((c) => String(c.id) === id)); else formCalendario(S.calendario.find((c) => String(c.id) === id)); return; }
    const ideia = e.target.closest("[data-ideia]");
    if (ideia) { trans.sel = ideia.dataset.ideia; irPara("transcricoes"); return; }
    const r = e.target.closest("[data-rapido]");
    if (!r) return;
    if (r.dataset.rapido === "lembrete") formLembreteRapido();
    else if (r.dataset.rapido === "ttk") formComissao();
    else { irPara("transcricoes"); setTimeout(() => { const i = $("#form-add-trans input, #form-add-trans textarea"); if (i) i.focus(); }, 100); }
  };
}
// A página nova assume o Início; se der erro, a antiga aparece no lugar
DESENHOS.inicio = (el) => { try { desenharInicioNovo(el); } catch (e) { console.error("início novo", e); desenharInicio(el); } };
