/* =============================================================
   ADMIN, PARTE 10: Estúdio de arte (carrosséis)
   O mesmo carrossel dos 4 estilos, num jeito de editar mais visual:
   as miniaturas à esquerda, o slide grande no meio e os ajustes do
   slide à direita (layout, fundo, cor de destaque, textos e foto).
   A lista antiga continua lá, no botão "Ver em lista".
   ============================================================= */
const est = { i: 0 };
const modoCarrossel = () => { try { return localStorage.getItem("car-modo") || "estudio"; } catch (_) { return "estudio"; } };
const guardarModoCarrossel = (m) => { try { localStorage.setItem("car-modo", m); } catch (_) {} };
const NOMES_CAMPO_EST = { titulo: "Título", texto: "Texto", nota: "Nota" };
const PAGINAS_CAR = ["Gancho", "Contexto", "Construção", "Construção", "Tensão", "Recompensa", "CTA"];

function estCampo(car, s, c) {
  const rot = CAR_ESTILOS.rotulo(car.estilo, s.tipo, c);
  if (c === "foto") return `<div class="est-bloco"><span class="est-rot">Foto</span><div class="car-foto">
      ${s.foto ? `<img src="${esc(s.foto)}" alt="" crossorigin="anonymous">` : `<span class="car-foto-vazia">${ic("portfolio")}</span>`}
      <label class="btn pequeno">${s.foto ? "Trocar foto" : "Subir foto"}<input type="file" accept="image/*" data-est-foto hidden></label>
      ${s.foto ? `<button class="btn pequeno" type="button" data-est-tirar-foto>Tirar</button>
        <select class="campo" data-est-k="enquadrar" aria-label="Enquadrar a foto">${[["", "Enquadrar: automático"], ["topo", "Mostrar o topo"], ["meio", "Centro"], ["baixo", "Mostrar embaixo"]].map(([v, n]) => `<option value="${v}" ${(s.enquadrar || "") === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
      ${s.dicaFoto ? `<small class="sub">Sugestão: ${esc(s.dicaFoto)}</small>` : ""}</div></div>`;
  const longo = ["texto", "itens", "msgs"].includes(c);
  const v = String(s[c] || "");
  return `<label class="est-bloco"><span class="est-rot">${esc(rot)}<small>${v.replace(/\*/g, "").length}</small></span>${longo
    ? `<textarea class="campo" data-est-k="${c}" rows="${c === "texto" ? 3 : 4}">${esc(v)}</textarea>`
    : `<input class="campo" data-est-k="${c}" value="${esc(v)}">`}</label>`;
}

function desenharEstudio(el) {
  const car = igx.car;
  if (est.car !== car) { est.car = car; est.i = 0; est.sel = null; } // carrossel novo aberto: começa do primeiro slide
  car.slides.forEach((s) => { if (!CAR_ESTILOS.TIPOS.some((t) => t[0] === s.tipo)) s.tipo = "construcao"; });
  if (est.i >= car.slides.length) est.i = car.slides.length - 1;
  if (est.i < 0) est.i = 0;
  if (est.slideSel !== est.i) { est.slideSel = est.i; est.sel = null; }
  const E = CAR_ESTILOS.ESTILOS[car.estilo], s = car.slides[est.i], n = car.slides.length;
  const destaques = Object.entries(CAR_ESTILOS.DESTAQUES);

  el.innerHTML = `
    <details class="cartao car-ideia" id="est-ideia">
      <summary><b>Da sua ideia ao carrossel</b> <span class="sub">você escreve a ideia, o Claude monta, você cola aqui</span></summary>
      <textarea class="campo" id="est-ideia-txt" rows="3" placeholder="Ex.: quero mostrar como eu respondo marca que pede desconto">${esc(igx.ideiaCar || "")}</textarea>
      <div class="car-ideia-acoes">
        <select class="campo" id="est-ideia-estilo" aria-label="Estilo"><option value="auto">Estilo: o Claude escolhe</option>${Object.entries(CAR_ESTILOS.ESTILOS).map(([k, e]) => `<option value="${k}" ${k === car.estilo ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select>
        <button class="btn primario" type="button" id="est-ideia-copiar">${ic("transcricao")}Copiar pedido pro Claude</button>
      </div>
      <textarea class="campo" id="est-ideia-resp" rows="3" placeholder="Cole aqui a resposta do Claude (as linhas do CARROSSEL)"></textarea>
      <button class="btn" type="button" id="est-ideia-montar">Montar carrossel</button>
    </details>

    <section class="est-barra">
      <input class="campo est-titulo" id="est-titulo" value="${esc(car.titulo)}" aria-label="Nome do carrossel" placeholder="Nome do carrossel">
      <select class="campo" id="est-abrir" aria-label="Abrir carrossel salvo"><option value="">Abrir salvo (${igx.carrosseis.length})</option>${igx.carrosseis.map((c) => `<option value="${esc(c.id)}">${esc(c.titulo)} · ${dataBR(String(c.atualizado_em).slice(0, 10)).slice(0, 5)}</option>`).join("")}</select>
      <span class="espaco"></span>
      <button class="btn" type="button" id="est-lista">Ver em lista</button>
      <button class="btn" type="button" id="est-novo">Novo</button>
      <button class="btn" type="button" id="est-salvar">Salvar</button>
      <button class="btn primario" type="button" id="est-baixar">${ic("baixar")}Baixar imagens</button>
    </section>
    <div class="est-estilos" role="tablist" aria-label="Estilo">${ESTILOS_CHIPS().filter(([k]) => k !== "classico").map(([k, nome]) => `<button type="button" role="tab" data-est-estilo="${k}" aria-selected="${k === car.estilo}">${esc(nome)}</button>`).join("")}<span class="sub">${esc(E.quando)}</span></div>

    <div class="est-grade">
      <aside class="est-minis" aria-label="Slides">
        ${car.slides.map((x, i) => `<button type="button" class="est-mini ${i === est.i ? "on" : ""}" data-est-i="${i}" aria-label="Slide ${i + 1}: ${esc(CAR_ESTILOS.nomeTipo(x.tipo))}" aria-current="${i === est.i}"><span class="est-mini-n">${i + 1}</span><canvas data-est-mini="${i}" width="1080" height="1350"></canvas></button>`).join("")}
        <button type="button" class="est-mini-mais" id="est-mais" ${n >= 10 ? "disabled" : ""}>${ic("mais")}Slide</button>
      </aside>
      <div class="est-palco">
        <div class="est-tela" id="est-tela"><canvas class="est-grande" id="est-grande" width="1080" height="1350" aria-label="Slide ${est.i + 1} de ${n}"></canvas>
          <div class="est-sel" id="est-sel" hidden><span class="est-sel-nome"></span><button type="button" class="est-alca" id="est-alca" aria-label="Aumentar ou diminuir o texto"></button></div></div>
        <div class="est-nav"><button type="button" class="icone-btn" data-est-ir="-1" ${est.i === 0 ? "disabled" : ""} aria-label="Slide anterior">${ic("esq")}</button>
          <span>${est.i + 1} de ${n} · ${esc(PAGINAS_CAR[est.i] || "Extra")}</span>
          <button type="button" class="icone-btn" data-est-ir="1" ${est.i === n - 1 ? "disabled" : ""} aria-label="Próximo slide">${ic("dir")}</button></div>
        <p class="sub est-ajuda">Clique no título ou no texto do slide pra arrastar. A bolinha dourada no canto aumenta e diminui. Escreva <b>*palavra*</b> pro destaque e <b>**palavra**</b> pro cinza.</p>
      </div>
      <aside class="cartao est-painel" id="est-painel">
        <div class="est-painel-topo"><b>Prancheta ${est.i + 1} de ${n}</b><span class="espaco"></span>
          <button type="button" class="icone-btn" data-est-mover="-1" ${est.i === 0 ? "disabled" : ""} aria-label="Mover pra trás">${ic("esq")}</button>
          <button type="button" class="icone-btn" data-est-mover="1" ${est.i === n - 1 ? "disabled" : ""} aria-label="Mover pra frente">${ic("dir")}</button>
          <button type="button" class="icone-btn" data-est-duplicar ${n >= 10 ? "disabled" : ""} aria-label="Duplicar slide">${ic("mais")}</button>
          <button type="button" class="icone-btn" data-est-apagar ${n <= 1 ? "disabled" : ""} aria-label="Apagar slide">${ic("apagar")}</button></div>
        <label class="est-bloco"><span class="est-rot">Layout</span><select class="campo" data-est-tipo aria-label="Layout do slide">${CAR_ESTILOS.TIPOS.map(([v, nome]) => `<option value="${v}" ${s.tipo === v ? "selected" : ""}>${nome}</option>`).join("")}</select></label>
        <div class="est-bloco"><span class="est-rot">Fundo</span><div class="est-opcoes">
          <button type="button" data-est-fundo="" aria-pressed="${!s.fundo}">Como o estilo pede</button>
          <button type="button" data-est-fundo="trocar" aria-pressed="${s.fundo === "trocar"}">Trocar claro e escuro</button></div></div>
        <div class="est-bloco"><span class="est-rot">Cor de destaque</span><div class="est-cores">${destaques.map(([k, d]) => `<button type="button" data-est-cor="${k}" aria-pressed="${(s.destaque || "dourado") === k}" title="${esc(d.nome)}" aria-label="${esc(d.nome)}"><i style="background:linear-gradient(135deg, ${d.cores[0]} 50%, ${d.cores[1]} 50%)"></i></button>`).join("")}</div></div>
        <div class="est-bloco"><span class="est-rot">Texto no slide</span>
          <div class="est-opcoes">${["titulo", "texto", "nota"].filter((c) => CAR_ESTILOS.campos(car.estilo, s.tipo).includes(c) && s[c]).map((c) => `<button type="button" data-est-sel="${c}" aria-pressed="${est.sel === c}">${NOMES_CAMPO_EST[c]}</button>`).join("")}</div>
          ${est.sel ? `<div class="est-opcoes"><button type="button" data-est-tam="-1" aria-label="Diminuir">A-</button><button type="button" data-est-tam="1" aria-label="Aumentar">A+</button><button type="button" data-est-voltar>Voltar ao lugar</button></div>
          <small class="sub">Arraste no slide, ou use as setas do teclado (com Shift anda mais). Esc solta.</small>` : `<small class="sub">Escolha acima ou clique no texto do slide.</small>`}
          ${s.pos && Object.keys(s.pos).length ? `<button type="button" class="link-btn" data-est-voltar-tudo>Voltar tudo pro lugar do estilo</button>` : ""}</div>
        <div class="est-textos"><span class="est-rot est-rot-sec">Textos</span>${CAR_ESTILOS.campos(car.estilo, s.tipo).map((c) => estCampo(car, s, c)).join("")}</div>
        ${palavrasDe(s) > 22 ? `<p class="sub car-dica"><b class="car-muito">${palavrasDe(s)} palavras: carrossel bom é curto.</b></p>` : ""}
        <button type="button" class="link-btn" data-est-todos>Usar este fundo e esta cor em todos os slides</button>
      </aside>
    </div>`;

  // Desenho
  const pintarMini = (i) => { const cv = $(`[data-est-mini="${i}"]`, el); if (cv && car.slides[i]) CAR_ESTILOS.pintar(cv, car.slides[i], i, car.slides.length, car.estilo, () => pintarMini(i), car.slides); };
  const pintarGrande = () => { const cv = $("#est-grande", el); if (cv) { CAR_ESTILOS.pintar(cv, car.slides[est.i], est.i, car.slides.length, car.estilo, pintarGrande, car.slides); mostrarSel(); } };
  // Moldura do texto escolhido, por cima do slide
  const caixaDe = (cv, c) => {
    const bs = (cv.__caixas || []).filter((b) => b.campo === c); if (!bs.length) return null;
    return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) };
  };
  const mostrarSel = () => {
    const cv = $("#est-grande", el), caixa = $("#est-sel", el); if (!cv || !caixa) return;
    const b = est.sel && caixaDe(cv, est.sel);
    if (!b) { caixa.hidden = true; return; }
    const f = cv.clientWidth / cv.width, m = 14;
    Object.assign(caixa.style, { left: (b.x0 - m) * f + "px", top: (b.y0 - m) * f + "px", width: (b.x1 - b.x0 + 2 * m) * f + "px", height: (b.y1 - b.y0 + 2 * m) * f + "px" });
    $(".est-sel-nome", caixa).textContent = NOMES_CAMPO_EST[est.sel] || "Texto";
    caixa.hidden = false;
  };
  const pintarTudo = () => { pintarGrande(); car.slides.forEach((_, i) => pintarMini(i)); };
  pintarTudo();
  carregarFontesCarrossel().then(pintarTudo);
  let espera = null;
  const repintarAtual = () => { clearTimeout(espera); espera = setTimeout(() => { pintarGrande(); pintarMini(est.i); }, 120); };
  const ir = (i) => { est.i = Math.max(0, Math.min(car.slides.length - 1, i)); desenhar(); };

  // Topo
  $("#est-titulo", el).oninput = (e) => { car.titulo = e.target.value; };
  $("#est-abrir", el).onchange = (e) => { abrirCarrosselSalvo(e.target.value); est.i = 0; desenhar(); };
  $("#est-lista", el).onclick = () => { guardarModoCarrossel("lista"); desenhar(); };
  $("#est-novo", el).onclick = () => { igx.car = CAR_ESTILOS.exemplo(car.estilo); est.i = 0; desenhar(); avisar("Exemplo novo: troque os textos e as fotos."); };
  $("#est-salvar", el).onclick = () => salvarCarrossel(car);
  $("#est-baixar", el).onclick = (e) => baixarCarrossel(e.target.closest("button"), car, (cv, i) => CAR_ESTILOS.pintar(cv, car.slides[i], i, car.slides.length, car.estilo, null, car.slides));
  $$("[data-est-estilo]", el).forEach((b) => b.onclick = () => { trocarEstilo(car, b.dataset.estEstilo); desenhar(); });

  // Da ideia ao carrossel
  $("#est-ideia-txt", el).oninput = (e) => { igx.ideiaCar = e.target.value; };
  $("#est-ideia-copiar", el).onclick = () => {
    const ideia = $("#est-ideia-txt", el).value.trim(); if (!ideia) { avisar("Escreva a sua ideia primeiro.", true); return; }
    navigator.clipboard.writeText(pedidoCarrossel(ideia, $("#est-ideia-estilo", el).value)).then(() => avisar("Pedido copiado. Cole no Claude e traga a resposta pra cá."), () => avisar("Não deu para copiar.", true));
  };
  $("#est-ideia-montar", el).onclick = () => {
    const resp = $("#est-ideia-resp", el).value, lido = CAR_ESTILOS.lerTexto(resp)[0];
    if (!lido) { avisar("Não achei as linhas do carrossel. Cole a resposta inteira do Claude.", true); return; }
    const leg = (resp.match(/LEGENDA\s*:?\s*\n?([\s\S]+)$/i) || [])[1];
    const estilo = lido.estilo || ($("#est-ideia-estilo", el).value !== "auto" ? $("#est-ideia-estilo", el).value : car.estilo);
    igx.car = { titulo: lido.titulo, estilo, slides: lido.slides, legenda: leg ? leg.trim().split("\n")[0].replace(/\*\*/g, "") : "" };
    est.i = 0; desenhar(); avisar(`Carrossel montado no estilo ${CAR_ESTILOS.ESTILOS[estilo].nome}. Suba as fotos e confira.`);
  };

  // Miniaturas e navegação
  $$("[data-est-i]", el).forEach((b) => b.onclick = () => ir(Number(b.dataset.estI)));
  $$("[data-est-ir]", el).forEach((b) => b.onclick = () => ir(est.i + Number(b.dataset.estIr)));
  $("#est-mais", el).onclick = () => {
    const novo = { tipo: "construcao", titulo: "" }, fim = car.slides[car.slides.length - 1];
    if (fim && fim.tipo === "cta") { car.slides.splice(car.slides.length - 1, 0, novo); est.i = car.slides.length - 2; } else { car.slides.push(novo); est.i = car.slides.length - 1; }
    desenhar();
  };
  if (document.__estTeclas) document.removeEventListener("keydown", document.__estTeclas);
  document.__estTeclas = (e) => {
    if (!document.body.contains(el) || !$("#est-grande", el) || el.closest("[hidden]")) return;
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "") || $("#janela").open) return;
    if (est.sel && est.moverTeclado && /^Arrow/.test(e.key)) {
      e.preventDefault(); const d = e.shiftKey ? 40 : 8;
      est.moverTeclado(e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0); return;
    }
    if (e.key === "Escape" && est.sel) { est.sel = null; desenhar(); return; }
    if (e.key === "ArrowRight" && est.i < car.slides.length - 1) { e.preventDefault(); ir(est.i + 1); }
    if (e.key === "ArrowLeft" && est.i > 0) { e.preventDefault(); ir(est.i - 1); }
  };
  document.addEventListener("keydown", document.__estTeclas);

  // Mini Canva: arrastar o texto no slide e aumentar pela bolinha do canto
  const posDe = (c) => { s.pos = s.pos || {}; return (s.pos[c] = s.pos[c] || { x: 0, y: 0, k: 1 }); };
  const limpaPos = (c) => { const p = s.pos && s.pos[c]; if (p && !p.x && !p.y && (p.k || 1) === 1) delete s.pos[c]; if (s.pos && !Object.keys(s.pos).length) delete s.pos; };
  const tamanho = (k) => Math.min(3, Math.max(0.4, Math.round(k * 100) / 100));
  let quadro = 0;
  const repintarJa = () => { if (quadro) return; quadro = requestAnimationFrame(() => { quadro = 0; pintarGrande(); }); };
  const miniDepois = () => { clearTimeout(espera); espera = setTimeout(() => pintarMini(est.i), 300); };
  const tela = $("#est-tela", el), cvG = $("#est-grande", el);
  const pontoNoSlide = (e) => { const r = cvG.getBoundingClientRect(); return [(e.clientX - r.left) * (cvG.width / r.width), (e.clientY - r.top) * (cvG.height / r.height)]; };
  const campoNoPonto = ([x, y]) => { const bs = (cvG.__caixas || []).filter((b) => x >= b.x0 - 20 && x <= b.x1 + 20 && y >= b.y0 - 20 && y <= b.y1 + 20); return bs.length ? bs[bs.length - 1].campo : null; };
  let arrasto = null;
  tela.addEventListener("pointerdown", (e) => {
    const pt = pontoNoSlide(e);
    if (e.target.closest("#est-alca") && est.sel) {
      const b = caixaDe(cvG, est.sel); if (!b) return;
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      arrasto = { tipo: "tamanho", c: est.sel, cx, cy, d0: Math.hypot(pt[0] - cx, pt[1] - cy) || 1, k0: posDe(est.sel).k || 1 };
    } else {
      const c = campoNoPonto(pt);
      if (!c) { if (est.sel) { est.sel = null; desenhar(); } return; }
      const mudou = est.sel !== c; est.sel = c;
      const p = posDe(c); arrasto = { tipo: "mover", c, x0: pt[0], y0: pt[1], px: p.x || 0, py: p.y || 0, mudou };
      mostrarSel();
    }
    e.preventDefault();
    try { tela.setPointerCapture(e.pointerId); } catch (_) {}
  });
  tela.addEventListener("pointermove", (e) => {
    const pt = pontoNoSlide(e);
    if (!arrasto) { cvG.style.cursor = campoNoPonto(pt) ? "move" : ""; return; }
    const p = posDe(arrasto.c);
    if (arrasto.tipo === "mover") { p.x = Math.round(arrasto.px + pt[0] - arrasto.x0); p.y = Math.round(arrasto.py + pt[1] - arrasto.y0); }
    else p.k = tamanho(arrasto.k0 * (Math.hypot(pt[0] - arrasto.cx, pt[1] - arrasto.cy) / arrasto.d0));
    repintarJa();
  });
  const soltar = () => { if (!arrasto) return; const a = arrasto; arrasto = null; limpaPos(a.c); if (a.mudou) desenhar(); else { pintarGrande(); pintarMini(est.i); } };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);
  tela.addEventListener("dblclick", (e) => { const c = campoNoPonto(pontoNoSlide(e)); const f = c && $(`[data-est-k="${c}"]`, el); if (f) { f.focus(); if (f.select) f.select(); } });
  tela.addEventListener("wheel", (e) => {
    if (!est.sel) return;
    e.preventDefault();
    const p = posDe(est.sel); p.k = tamanho((p.k || 1) * (e.deltaY < 0 ? 1.04 : 1 / 1.04));
    limpaPos(est.sel); repintarJa(); miniDepois();
  }, { passive: false });
  if (window.__estResize) window.removeEventListener("resize", window.__estResize);
  window.__estResize = mostrarSel; window.addEventListener("resize", mostrarSel);
  est.moverTeclado = (dx, dy) => { const p = posDe(est.sel); p.x = (p.x || 0) + dx; p.y = (p.y || 0) + dy; limpaPos(est.sel); pintarGrande(); miniDepois(); };

  // Painel do slide
  const painel = $("#est-painel", el);
  $$("[data-est-sel]", painel).forEach((b) => b.onclick = () => { est.sel = est.sel === b.dataset.estSel ? null : b.dataset.estSel; desenhar(); });
  $$("[data-est-tam]", painel).forEach((b) => b.onclick = () => { const p = posDe(est.sel); p.k = tamanho((p.k || 1) * (Number(b.dataset.estTam) > 0 ? 1.1 : 1 / 1.1)); limpaPos(est.sel); pintarGrande(); pintarMini(est.i); });
  const voltar = $("[data-est-voltar]", painel);
  if (voltar) voltar.onclick = () => { if (s.pos) delete s.pos[est.sel]; limpaPos(est.sel); desenhar(); };
  const voltarTudo = $("[data-est-voltar-tudo]", painel);
  if (voltarTudo) voltarTudo.onclick = () => { delete s.pos; desenhar(); };
  $$("[data-est-mover]", painel).forEach((b) => b.onclick = () => { const j = est.i + Number(b.dataset.estMover); [car.slides[est.i], car.slides[j]] = [car.slides[j], car.slides[est.i]]; est.i = j; desenhar(); });
  $("[data-est-duplicar]", painel).onclick = () => { if (car.slides.length >= 10) return; car.slides.splice(est.i + 1, 0, JSON.parse(JSON.stringify(s))); est.i++; desenhar(); };
  $("[data-est-apagar]", painel).onclick = async () => { if (car.slides.length <= 1) return; if (!(await confirmar(`Apagar o slide ${est.i + 1}?`, "Apagar slide"))) return; car.slides.splice(est.i, 1); desenhar(); };
  $("[data-est-tipo]", painel).onchange = (e) => { s.tipo = e.target.value; desenhar(); };
  $$("[data-est-fundo]", painel).forEach((b) => b.onclick = () => { if (b.dataset.estFundo) s.fundo = b.dataset.estFundo; else delete s.fundo; desenhar(); });
  $$("[data-est-cor]", painel).forEach((b) => b.onclick = () => { if (b.dataset.estCor === "dourado") delete s.destaque; else s.destaque = b.dataset.estCor; desenhar(); });
  $("[data-est-todos]", painel).onclick = () => { car.slides.forEach((x) => { if (s.fundo) x.fundo = s.fundo; else delete x.fundo; if (s.destaque) x.destaque = s.destaque; else delete x.destaque; }); desenhar(); avisar("Fundo e cor aplicados em todos os slides."); };
  painel.addEventListener("input", (e) => {
    const k = e.target.dataset.estK; if (!k || e.target.tagName === "SELECT") return;
    s[k] = e.target.value;
    const cont = e.target.closest(".est-bloco") && $(".est-rot small", e.target.closest(".est-bloco"));
    if (cont) cont.textContent = e.target.value.replace(/\*/g, "").length;
    repintarAtual();
  });
  painel.addEventListener("change", async (e) => {
    if (e.target.tagName === "SELECT" && e.target.dataset.estK) { s[e.target.dataset.estK] = e.target.value; repintarAtual(); return; }
    if (e.target.matches("[data-est-foto]") && e.target.files && e.target.files[0]) {
      const rotulo = e.target.closest("label"); rotulo.firstChild.textContent = "Enviando...";
      try {
        const url = await enviarArquivo(await prepararFoto(e.target.files[0]), "carrosseis", "foto.jpg");
        if (url) { s.foto = url; desenhar(); avisar("Foto no slide."); } else rotulo.firstChild.textContent = "Subir foto";
      } catch (erro) { avisar(erro.message || "Não deu para usar essa foto.", true); rotulo.firstChild.textContent = "Subir foto"; }
    }
  });
  const tirarFoto = $("[data-est-tirar-foto]", painel);
  if (tirarFoto) tirarFoto.onclick = () => { delete s.foto; desenhar(); };
}
