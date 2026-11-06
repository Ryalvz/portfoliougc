/* =============================================================
   ADMIN, PARTE 10: Estúdio de arte (carrosséis)
   Um mini Canva: as miniaturas à esquerda, o slide grande no meio
   e, à direita, a camada escolhida (tamanho da letra, espaço entre
   letras e linhas, largura, alinhamento) e a lista de camadas do
   slide (esconder, apagar, adicionar texto). O desenho das camadas
   está na parte 11 (CAMADAS). A lista antiga continua no botão
   "Ver em lista".
   ============================================================= */
const est = { i: 0, sel: null, hist: [], guia: true };
const modoCarrossel = () => { try { return localStorage.getItem("car-modo") || "estudio"; } catch (_) { return "estudio"; } };
const guardarModoCarrossel = (m) => { try { localStorage.setItem("car-modo", m); } catch (_) {} };
const PAGINAS_CAR = ["Gancho", "Contexto", "Construção", "Construção", "Tensão", "Recompensa", "CTA"];
const NOMES_COR_CAM = [["tinta", "Forte"], ["texto", "Normal"], ["ouro", "Destaque"], ["cinza", "Cinza"]];

function estFoto(s) {
  return `<div class="est-bloco"><span class="est-rot">Foto</span><div class="car-foto">
      ${s.foto ? `<img src="${esc(s.foto)}" alt="" crossorigin="anonymous">` : `<span class="car-foto-vazia">${ic("portfolio")}</span>`}
      <label class="btn pequeno">${s.foto ? "Trocar foto" : "Subir foto"}<input type="file" accept="image/*" data-est-foto hidden></label>
      ${s.foto ? `<button class="btn pequeno" type="button" data-est-tirar-foto>Tirar</button>
        <select class="campo" data-est-enquadrar aria-label="Enquadrar a foto">${[["", "Enquadrar: automático"], ["topo", "Mostrar o topo"], ["meio", "Centro"], ["baixo", "Mostrar embaixo"]].map(([v, n]) => `<option value="${v}" ${(s.enquadrar || "") === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
      ${s.dicaFoto ? `<small class="sub">Sugestão: ${esc(s.dicaFoto)}</small>` : ""}</div></div>`;
}
const fmtNum = (v, passo) => (passo < 1 ? Number(v).toFixed(2).replace(".", ",") : String(Math.round(v)));
function estFaixa(k, rotulo, min, max, passo, v, un = "") {
  return `<label class="est-faixa"><span>${rotulo}<output data-cam-saida="${k}">${fmtNum(v, passo)}${un}</output></span>
    <input type="range" min="${min}" max="${max}" step="${passo}" value="${v}" data-cam-num="${k}" data-un="${un}" data-passo="${passo}"></label>`;
}

function desenharEstudio(el) {
  const car = igx.car;
  if (est.car !== car) { est.car = car; est.i = 0; est.sel = null; est.hist = []; } // carrossel novo aberto: começa do primeiro slide
  if (!car.formato) car.formato = "quadrado";
  car.slides.forEach((s) => { if (!CAR_ESTILOS.TIPOS.some((t) => t[0] === s.tipo)) s.tipo = "construcao"; });
  if (est.i >= car.slides.length) est.i = car.slides.length - 1;
  if (est.i < 0) est.i = 0;
  const E = CAR_ESTILOS.ESTILOS[car.estilo], s = car.slides[est.i], n = car.slides.length;
  const { w: W, h: H } = CAMADAS.dims(car), M = CAMADAS.M;
  const camadas = CAMADAS.garantir(car, est.i);
  if (est.sel && !camadas.some((l) => l.id === est.sel)) est.sel = null;
  const L = est.sel ? camadas.find((l) => l.id === est.sel) : null;
  const ehTexto = L && CAMADAS.TEXTOS.includes(L.t);
  const destaques = Object.entries(CAR_ESTILOS.DESTAQUES);
  const temFoto = CAR_ESTILOS.campos(car.estilo, s.tipo).includes("foto") || camadas.some((l) => l.t === "foto");
  const npal = CAMADAS.palavras(camadas);

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
      <select class="campo" id="est-formato" aria-label="Formato">${Object.entries(CAMADAS.FORMATOS).map(([k, f]) => `<option value="${k}" ${car.formato === k ? "selected" : ""}>${f.nome}</option>`).join("")}</select>
      <span class="espaco"></span>
      <button class="btn" type="button" id="est-desfazer" ${est.hist.length ? "" : "disabled"} title="Cmd + Z">Desfazer</button>
      <button class="btn" type="button" id="est-lista">Ver em lista</button>
      <button class="btn" type="button" id="est-novo">Novo</button>
      <button class="btn" type="button" id="est-salvar">Salvar</button>
      <button class="btn primario" type="button" id="est-baixar">${ic("baixar")}Baixar imagens</button>
    </section>
    <div class="est-estilos" role="tablist" aria-label="Estilo">${ESTILOS_CHIPS().filter(([k]) => k !== "classico").map(([k, nome]) => `<button type="button" role="tab" data-est-estilo="${k}" aria-selected="${k === car.estilo}">${esc(nome)}</button>`).join("")}<span class="sub">${esc(E.quando)}</span></div>

    <div class="est-grade">
      <aside class="est-minis" aria-label="Slides">
        ${car.slides.map((x, i) => `<button type="button" class="est-mini ${i === est.i ? "on" : ""}" data-est-i="${i}" aria-label="Slide ${i + 1}: ${esc(CAR_ESTILOS.nomeTipo(x.tipo))}" aria-current="${i === est.i}"><span class="est-mini-n">${i + 1}</span><canvas data-est-mini="${i}" width="${W}" height="${H}"></canvas></button>`).join("")}
        <button type="button" class="est-mini-mais" id="est-mais" ${n >= 10 ? "disabled" : ""}>${ic("mais")}Slide</button>
      </aside>
      <div class="est-palco">
        <div class="est-tela" id="est-tela"><canvas class="est-grande" id="est-grande" width="${W}" height="${H}" aria-label="Slide ${est.i + 1} de ${n}"></canvas>
          <div class="est-sel" id="est-sel" hidden><span class="est-sel-nome"></span>
            <button type="button" class="est-alca-l" id="est-alca-l" aria-label="Largura da caixa"></button>
            <button type="button" class="est-alca" id="est-alca" aria-label="Tamanho"></button></div></div>
        <div class="est-nav"><button type="button" class="icone-btn" data-est-ir="-1" ${est.i === 0 ? "disabled" : ""} aria-label="Slide anterior">${ic("esq")}</button>
          <span>${est.i + 1} de ${n} · ${esc(PAGINAS_CAR[est.i] || "Extra")}</span>
          <button type="button" class="icone-btn" data-est-ir="1" ${est.i === n - 1 ? "disabled" : ""} aria-label="Próximo slide">${ic("dir")}</button></div>
        <label class="check est-guia-check"><input type="checkbox" id="est-guia" ${est.guia ? "checked" : ""}> Mostrar a borda de segurança (não sai na imagem)</label>
        <p class="sub est-ajuda">Clique em qualquer coisa do slide pra escolher. Arraste pra mover, a bolinha do lado muda a largura e a do canto muda o tamanho. Delete apaga, Cmd + Z desfaz.</p>
      </div>
      <aside class="cartao est-painel" id="est-painel">
        <div class="est-painel-topo"><b>Slide ${est.i + 1} de ${n}</b><span class="espaco"></span>
          <button type="button" class="icone-btn" data-est-mover="-1" ${est.i === 0 ? "disabled" : ""} aria-label="Mover pra trás">${ic("esq")}</button>
          <button type="button" class="icone-btn" data-est-mover="1" ${est.i === n - 1 ? "disabled" : ""} aria-label="Mover pra frente">${ic("dir")}</button>
          <button type="button" class="icone-btn" data-est-duplicar ${n >= 10 ? "disabled" : ""} aria-label="Duplicar slide">${ic("mais")}</button>
          <button type="button" class="icone-btn" data-est-apagar ${n <= 1 ? "disabled" : ""} aria-label="Apagar slide">${ic("apagar")}</button></div>

        ${npal > 25 ? `<p class="est-alerta">Muita coisa neste slide: ${npal} palavras. Carrossel bom tem até 25 por página. Esconda ou apague uma camada, ou passe uma parte pro próximo slide.</p>` : ""}
        <p class="est-alerta" id="est-fora" hidden></p>

        ${L ? `<div class="est-bloco est-cam-edit">
          <span class="est-rot">${esc(L.nome)}<small>camada escolhida</small></span>
          ${ehTexto && L.auto !== "num" ? `<textarea class="campo" data-cam-texto rows="${L.t === "texto" && String(L.texto).length > 60 ? 4 : 2}">${esc(L.texto)}</textarea>
            <small class="sub">*palavra* fica em destaque e **palavra** em cinza. Enter quebra a linha.</small>` : ""}
          ${ehTexto ? `
            ${estFaixa("tam", "Tamanho da letra", 12, 220, 1, L.tam, "px")}
            ${estFaixa("letra", "Espaço entre letras", -6, 40, 0.5, L.letra || 0, "px")}
            ${estFaixa("entre", "Espaço entre linhas", 0.8, 2.2, 0.02, L.entre || 1.25)}
            ${estFaixa("w", "Largura da caixa", 80, L.continua ? W : W - 2 * M, 10, L.w, "px")}
            <div class="est-opcoes est-opcoes-3" role="group" aria-label="Alinhamento">${[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]].map(([v, nome]) => `<button type="button" data-cam-alinhar="${v}" aria-pressed="${(L.alinhar || "left") === v}">${nome}</button>`).join("")}</div>
            ${L.t === "texto" ? `<div class="est-opcoes est-opcoes-4" role="group" aria-label="Cor do texto">${NOMES_COR_CAM.map(([v, nome]) => `<button type="button" data-cam-cor="${v}" aria-pressed="${(L.cor || "texto") === v}">${nome}</button>`).join("")}</div>
              ${estFaixa("rot", "Girar", -20, 20, 1, L.rot || 0, "°")}` : ""}
            ${est.i < n - 1 && L.t === "texto" ? `<label class="check est-continua"><input type="checkbox" data-cam-continua ${L.continua ? "checked" : ""}> Continua no próximo slide (o resto aparece quando a pessoa arrasta)</label>` : ""}` : ""}
          ${L.t === "foto" || L.t === "forma" ? `${estFaixa("w", "Largura", 40, W, 10, L.w, "px")}${estFaixa("h", "Altura", 40, H, 10, L.h, "px")}` : ""}
          ${L.t === "linha" ? estFaixa("w", "Comprimento", 40, W, 10, L.w, "px") : ""}
          <div class="est-opcoes"><button type="button" data-cam-dup>Duplicar</button><button type="button" data-cam-apagar="${L.id}">Apagar camada</button></div>
        </div>` : `<p class="sub est-dica">Clique num texto do slide (ou na lista abaixo) pra mudar o tamanho da letra, o espaço, a largura e o alinhamento.</p>`}

        <div class="est-bloco"><span class="est-rot">Camadas do slide<small>${camadas.length}</small></span>
          <ul class="est-camadas">${[...camadas].reverse().map((l) => `<li class="${l.id === est.sel ? "on" : ""} ${l.oculto ? "oculta" : ""}">
            <button type="button" class="est-cam-nome" data-cam-sel="${l.id}"><b>${esc(l.nome)}</b><small>${esc(String(l.auto === "num" ? "número do slide" : l.texto || (l.t === "foto" ? "foto" : "forma")).replace(/\*/g, "").slice(0, 40))}</small></button>
            <button type="button" class="est-cam-acao" data-cam-olho="${l.id}">${l.oculto ? "Mostrar" : "Esconder"}</button>
            <button type="button" class="icone-btn" data-cam-apagar="${l.id}" aria-label="Apagar ${esc(l.nome)}">${ic("apagar")}</button></li>`).join("")}</ul>
          <div class="est-opcoes"><button type="button" data-cam-novo>Adicionar texto</button><button type="button" data-cam-refazer>Refazer pelo estilo</button></div>
        </div>

        <div class="est-bloco"><span class="est-rot est-rot-sec">Slide</span></div>
        <label class="est-bloco"><span class="est-rot">Layout</span><select class="campo" data-est-tipo aria-label="Layout do slide">${CAR_ESTILOS.TIPOS.map(([v, nome]) => `<option value="${v}" ${s.tipo === v ? "selected" : ""}>${nome}</option>`).join("")}</select></label>
        <div class="est-bloco"><span class="est-rot">Fundo</span><div class="est-opcoes">
          <button type="button" data-est-fundo="" aria-pressed="${!s.fundo}">Como o estilo pede</button>
          <button type="button" data-est-fundo="trocar" aria-pressed="${s.fundo === "trocar"}">Trocar claro e escuro</button></div></div>
        <div class="est-bloco"><span class="est-rot">Cor de destaque</span><div class="est-cores">${destaques.map(([k, d]) => `<button type="button" data-est-cor="${k}" aria-pressed="${(s.destaque || "dourado") === k}" title="${esc(d.nome)}" aria-label="${esc(d.nome)}"><i style="background:linear-gradient(135deg, ${d.cores[0]} 50%, ${d.cores[1]} 50%)"></i></button>`).join("")}</div></div>
        ${temFoto ? estFoto(s) : ""}
        <button type="button" class="link-btn" data-est-todos>Usar este fundo e esta cor em todos os slides</button>
      </aside>
    </div>`;

  // Desenho
  const cvG = $("#est-grande", el);
  const pintarMini = (i) => { const cv = $(`[data-est-mini="${i}"]`, el); if (cv && car.slides[i]) CAMADAS.pintar(cv, car, i, { aoCarregar: () => pintarMini(i) }); };
  const pintarGrande = () => { if (!cvG) return; CAMADAS.pintar(cvG, car, est.i, { guia: est.guia, aoCarregar: pintarGrande }); mostrarSel(); avisarBorda(); };
  const mostrarSel = () => {
    const caixa = $("#est-sel", el); if (!caixa) return;
    const b = est.sel && (cvG.__caixas || []).find((x) => x.id === est.sel);
    if (!b) { caixa.hidden = true; return; }
    const f = cvG.clientWidth / cvG.width, m = 10;
    Object.assign(caixa.style, { left: (b.x0 - m) * f + "px", top: (b.y0 - m) * f + "px", width: (b.x1 - b.x0 + 2 * m) * f + "px", height: (b.y1 - b.y0 + 2 * m) * f + "px" });
    $(".est-sel-nome", caixa).textContent = (camadas.find((l) => l.id === est.sel) || {}).nome || "";
    caixa.hidden = false;
  };
  const avisarBorda = () => {
    const p = $("#est-fora", el); if (!p) return;
    const fora = CAMADAS.foraDaBorda(car, est.i, cvG);
    if (!fora.length) { p.hidden = true; return; }
    const nomes = fora.map((id) => (camadas.find((l) => l.id === id) || {}).nome).filter(Boolean);
    p.innerHTML = `${esc(nomes.join(", "))} ${nomes.length > 1 ? "passam" : "passa"} da borda de segurança. <button type="button" class="link-btn" data-cam-dentro>Trazer pra dentro</button>`;
    p.hidden = false;
    $("[data-cam-dentro]", p).onclick = () => { marcar(true); fora.forEach((id) => trazerPraDentro(camadas.find((l) => l.id === id))); editado(); pintarGrande(); pintarMini(est.i); };
  };
  const pintarTudo = () => { pintarGrande(); car.slides.forEach((_, i) => pintarMini(i)); };
  pintarTudo();
  carregarFontesCarrossel().then(() => { if (document.body.contains(cvG)) { CAMADAS.garantir(car, est.i); pintarTudo(); } });
  let quadro = 0, espera = null;
  const repintarJa = () => { if (quadro) return; quadro = requestAnimationFrame(() => { quadro = 0; pintarGrande(); }); };
  const miniDepois = () => { clearTimeout(espera); espera = setTimeout(() => { pintarMini(est.i); if (est.i < n - 1) pintarMini(est.i + 1); }, 250); };
  const ir = (i) => { est.i = Math.max(0, Math.min(car.slides.length - 1, i)); est.sel = null; desenhar(); };
  const editado = () => { s.camadasEditadas = true; };
  // Desfazer: guarda uma cópia antes de cada mudança (no máximo uma a cada 0,7 s ao arrastar ou digitar)
  const marcar = (forcar) => {
    const agora = Date.now(); if (!forcar && agora - (est.ultMarca || 0) < 700) return;
    est.ultMarca = agora; est.hist.push({ i: est.i, slides: JSON.stringify(car.slides), formato: car.formato });
    if (est.hist.length > 60) est.hist.shift();
    const b = $("#est-desfazer", el); if (b) b.disabled = false;
  };
  const desfazer = () => { const h = est.hist.pop(); if (!h) return; car.slides = JSON.parse(h.slides); car.formato = h.formato; est.i = Math.min(h.i, car.slides.length - 1); est.sel = null; desenhar(); };
  const limites = () => ({ x0: M, y0: M, x1: W - M, y1: H - M });
  function trazerPraDentro(l) {
    if (!l) return;
    const b = (cvG.__caixas || []).find((x) => x.id === l.id); if (!b) return;
    const lim = limites(), bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (bw > lim.x1 - lim.x0 && "w" in l) { l.w = Math.max(80, l.w - (bw - (lim.x1 - lim.x0))); }
    const dx = b.x0 < lim.x0 ? lim.x0 - b.x0 : (!l.continua && b.x0 + Math.min(bw, lim.x1 - lim.x0) > lim.x1) ? lim.x1 - (b.x0 + Math.min(bw, lim.x1 - lim.x0)) : 0;
    const dy = b.y0 < lim.y0 ? lim.y0 - b.y0 : b.y1 > lim.y1 ? Math.max(lim.y0 - b.y0, lim.y1 - b.y1) : 0;
    l.x = Math.round(l.x + dx); l.y = Math.round(l.y + dy);
  }

  // Topo
  $("#est-titulo", el).oninput = (e) => { car.titulo = e.target.value; };
  $("#est-abrir", el).onchange = (e) => { abrirCarrosselSalvo(e.target.value); est.i = 0; desenhar(); };
  $("#est-formato", el).onchange = async (e) => {
    const novo = e.target.value, mexidos = car.slides.some((x) => x.camadasEditadas);
    if (mexidos && !(await confirmar("Trocar o formato refaz o desenho de todos os slides. Os ajustes que você fez à mão se perdem (dá pra desfazer).", "Trocar formato"))) { e.target.value = car.formato; return; }
    marcar(true); car.formato = novo; car.slides.forEach((x) => { delete x.camadas; delete x.camadasEditadas; }); desenhar();
  };
  $("#est-desfazer", el).onclick = desfazer;
  $("#est-lista", el).onclick = () => { guardarModoCarrossel("lista"); desenhar(); };
  $("#est-novo", el).onclick = () => { igx.car = CAR_ESTILOS.exemplo(car.estilo); igx.car.formato = car.formato; est.i = 0; desenhar(); avisar("Exemplo novo: troque os textos e as fotos."); };
  $("#est-salvar", el).onclick = () => salvarCarrossel(car);
  $("#est-baixar", el).onclick = (e) => baixarCarrossel(e.target.closest("button"), car, (cv, i) => CAMADAS.pintar(cv, car, i));
  $$("[data-est-estilo]", el).forEach((b) => b.onclick = async () => {
    const antes = igx.car; trocarEstilo(car, b.dataset.estEstilo);
    if (igx.car === antes && car.slides.some((x) => x.camadasEditadas) && await confirmar("Refazer os slides no estilo novo? Os ajustes feitos à mão se perdem (dá pra desfazer).", "Refazer")) {
      marcar(true); car.slides.forEach((x) => { delete x.camadas; delete x.camadasEditadas; });
    }
    if (igx.car !== antes) igx.car.formato = car.formato;
    desenhar();
  });
  $("#est-guia", el).onchange = (e) => { est.guia = e.target.checked; pintarGrande(); };

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
    igx.car = { titulo: lido.titulo, estilo, formato: car.formato, slides: lido.slides, legenda: leg ? leg.trim().split("\n")[0].replace(/\*\*/g, "") : "" };
    est.i = 0; desenhar(); avisar(`Carrossel montado no estilo ${CAR_ESTILOS.ESTILOS[estilo].nome}. Suba as fotos e confira.`);
  };

  // Miniaturas e navegação
  $$("[data-est-i]", el).forEach((b) => b.onclick = () => ir(Number(b.dataset.estI)));
  $$("[data-est-ir]", el).forEach((b) => b.onclick = () => ir(est.i + Number(b.dataset.estIr)));
  $("#est-mais", el).onclick = () => {
    marcar(true);
    const novo = { tipo: "construcao", titulo: "Título do slide" }, fim = car.slides[car.slides.length - 1];
    if (fim && fim.tipo === "cta") { car.slides.splice(car.slides.length - 1, 0, novo); est.i = car.slides.length - 2; } else { car.slides.push(novo); est.i = car.slides.length - 1; }
    est.sel = null; desenhar();
  };

  // Teclado: setas movem a camada, Delete apaga, Cmd + Z desfaz, Esc solta
  if (document.__estTeclas) document.removeEventListener("keydown", document.__estTeclas);
  document.__estTeclas = (e) => {
    if (!document.body.contains(el) || !$("#est-grande", el) || el.closest("[hidden]")) return;
    const digitando = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "") && (document.activeElement || {}).type !== "range";
    if (digitando || ($("#janela") && $("#janela").open)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); desfazer(); return; }
    const l = est.sel && camadas.find((x) => x.id === est.sel);
    if (l && /^Arrow/.test(e.key)) {
      e.preventDefault(); marcar(); const d = e.shiftKey ? 40 : 4;
      l.x += e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0; l.y += e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
      editado(); pintarGrande(); miniDepois(); return;
    }
    if (l && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); apagarCamada(l.id); return; }
    if (e.key === "Escape" && est.sel) { est.sel = null; desenhar(); return; }
    if (e.key === "ArrowRight" && est.i < car.slides.length - 1) { e.preventDefault(); ir(est.i + 1); }
    if (e.key === "ArrowLeft" && est.i > 0) { e.preventDefault(); ir(est.i - 1); }
  };
  document.addEventListener("keydown", document.__estTeclas);

  // Mini Canva no slide: escolher, arrastar (sem sair da borda), largura e tamanho pelas bolinhas
  const tela = $("#est-tela", el);
  const pontoNoSlide = (e) => { const r = cvG.getBoundingClientRect(); return [(e.clientX - r.left) * (cvG.width / r.width), (e.clientY - r.top) * (cvG.height / r.height)]; };
  const camadaNoPonto = ([x, y]) => { const bs = (cvG.__caixas || []).filter((b) => x >= b.x0 - 8 && x <= b.x1 + 8 && y >= b.y0 - 8 && y <= b.y1 + 8); return bs.length ? bs[bs.length - 1].id : null; };
  let arrasto = null;
  tela.addEventListener("pointerdown", (e) => {
    const pt = pontoNoSlide(e);
    const l = est.sel && camadas.find((x) => x.id === est.sel);
    const b = l && (cvG.__caixas || []).find((x) => x.id === l.id);
    if (l && b && e.target.closest("#est-alca-l")) {
      marcar(true); arrasto = { tipo: "largura", l, x0: pt[0], w0: l.w };
    } else if (l && b && e.target.closest("#est-alca")) {
      const cx = b.x0, cy = b.y0;
      marcar(true); arrasto = { tipo: "tamanho", l, cx, cy, d0: Math.hypot(pt[0] - cx, pt[1] - cy) || 1, tam0: l.tam, w0: l.w, h0: l.h };
    } else {
      const id = camadaNoPonto(pt);
      if (!id) { if (est.sel) { est.sel = null; desenhar(); } return; }
      const c = camadas.find((x) => x.id === id), cb = (cvG.__caixas || []).find((x) => x.id === id);
      marcar(true);
      arrasto = { tipo: "mover", l: c, x0: pt[0], y0: pt[1], px: c.x, py: c.y, ox: cb.x0 - c.x, oy: cb.y0 - c.y, bw: cb.x1 - cb.x0, bh: cb.y1 - cb.y0, mudou: est.sel !== id, andou: false };
      est.sel = id; mostrarSel();
    }
    e.preventDefault();
    try { tela.setPointerCapture(e.pointerId); } catch (_) {}
  });
  tela.addEventListener("pointermove", (e) => {
    const pt = pontoNoSlide(e);
    if (!arrasto) { cvG.style.cursor = camadaNoPonto(pt) ? "move" : ""; return; }
    const a = arrasto, l = a.l;
    if (a.tipo === "mover") {
      let x = a.px + pt[0] - a.x0, y = a.py + pt[1] - a.y0;
      if (Math.abs(pt[0] - a.x0) + Math.abs(pt[1] - a.y0) > 3) a.andou = true;
      const decor = l.t === "forma" || l.t === "linha";
      // Gruda no meio do slide
      if (Math.abs(x + a.ox + a.bw / 2 - W / 2) < 10) x = W / 2 - a.bw / 2 - a.ox;
      // Não deixa sair da borda de segurança (Alt solta; o que continua no próximo slide pode passar pela direita)
      if (!e.altKey && !decor) {
        const lim = limites();
        if (a.bw <= lim.x1 - lim.x0) x = Math.max(lim.x0 - a.ox, l.continua ? x : Math.min(lim.x1 - a.bw - a.ox, x));
        if (a.bh <= lim.y1 - lim.y0) y = Math.max(lim.y0 - a.oy, Math.min(lim.y1 - a.bh - a.oy, y));
      }
      l.x = Math.round(x); l.y = Math.round(y);
    } else if (a.tipo === "largura") {
      const max = l.continua || e.altKey ? W : W - M - l.x;
      l.w = Math.round(Math.max(60, Math.min(max, a.w0 + pt[0] - a.x0)));
    } else {
      const k = Math.hypot(pt[0] - a.cx, pt[1] - a.cy) / a.d0;
      if (CAMADAS.TEXTOS.includes(l.t)) l.tam = Math.round(Math.max(10, Math.min(260, a.tam0 * k)));
      else { l.w = Math.round(Math.max(30, a.w0 * k)); if (a.h0) l.h = Math.round(Math.max(30, a.h0 * k)); }
    }
    editado(); repintarJa();
  });
  const soltar = () => {
    if (!arrasto) return; const a = arrasto; arrasto = null;
    if (a.tipo === "mover" && !a.andou) est.hist.pop(); // só clicou: nada pra desfazer
    if (a.mudou || a.tipo !== "mover") desenhar(); else { pintarGrande(); miniDepois(); }
  };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);
  tela.addEventListener("dblclick", () => { const f = $("[data-cam-texto]", el); if (f) { f.focus(); f.select(); } });
  tela.addEventListener("wheel", (e) => {
    const l = est.sel && camadas.find((x) => x.id === est.sel);
    if (!l || !CAMADAS.TEXTOS.includes(l.t)) return;
    e.preventDefault(); marcar();
    l.tam = Math.round(Math.max(10, Math.min(260, l.tam * (e.deltaY < 0 ? 1.04 : 1 / 1.04)) * 2) / 2);
    const f = $('[data-cam-num="tam"]', el); if (f) { f.value = l.tam; $('[data-cam-saida="tam"]', el).textContent = Math.round(l.tam) + "px"; }
    editado(); repintarJa(); miniDepois();
  }, { passive: false });
  if (window.__estResize) window.removeEventListener("resize", window.__estResize);
  window.__estResize = mostrarSel; window.addEventListener("resize", mostrarSel);

  // Painel: camada escolhida
  const painel = $("#est-painel", el);
  const Lsel = () => est.sel && camadas.find((x) => x.id === est.sel);
  function apagarCamada(id) { const k = camadas.findIndex((x) => x.id === id); if (k < 0) return; marcar(true); camadas.splice(k, 1); editado(); if (est.sel === id) est.sel = null; desenhar(); }
  $$("[data-cam-num]", painel).forEach((f) => {
    f.addEventListener("input", () => {
      const l = Lsel(); if (!l) return; marcar();
      const k = f.dataset.camNum; l[k] = Number(f.value);
      $(`[data-cam-saida="${k}"]`, painel).textContent = fmtNum(f.value, Number(f.dataset.passo)) + (f.dataset.un || "");
      editado(); repintarJa();
    });
    f.addEventListener("change", miniDepois);
  });
  const campoTexto = $("[data-cam-texto]", painel);
  if (campoTexto) campoTexto.addEventListener("input", () => { const l = Lsel(); if (!l) return; marcar(); l.texto = campoTexto.value; editado(); repintarJa(); miniDepois(); });
  $$("[data-cam-alinhar]", painel).forEach((b) => b.onclick = () => { const l = Lsel(); if (!l) return; marcar(true); l.alinhar = b.dataset.camAlinhar; editado(); desenhar(); });
  $$("[data-cam-cor]", painel).forEach((b) => b.onclick = () => { const l = Lsel(); if (!l) return; marcar(true); l.cor = b.dataset.camCor; editado(); desenhar(); });
  const cont = $("[data-cam-continua]", painel);
  if (cont) cont.onchange = () => {
    const l = Lsel(); if (!l) return; marcar(true); l.continua = cont.checked;
    // Continua: o texto fica numa linha só, com uns 45% passando pro próximo slide
    if (l.continua) { const larg = CAMADAS.medir({ ...l, w: 4000 }).larg; l.w = Math.ceil(larg) + 12; l.x = Math.round(W - l.w * 0.55); }
    if (!l.continua) trazerPraDentro(l);
    editado(); desenhar();
  };
  const dup = $("[data-cam-dup]", painel);
  if (dup) dup.onclick = () => { const l = Lsel(); if (!l) return; marcar(true); const c = { ...JSON.parse(JSON.stringify(l)), id: CAMADAS.novoId(), nome: `${l.nome} (cópia)`, x: l.x + 30, y: l.y + 30 }; delete c.auto; if (l.auto === "num") c.texto = ""; camadas.push(c); est.sel = c.id; editado(); desenhar(); };
  $$("[data-cam-apagar]", painel).forEach((b) => b.onclick = () => apagarCamada(b.dataset.camApagar));
  $$("[data-cam-sel]", painel).forEach((b) => b.onclick = () => { est.sel = est.sel === b.dataset.camSel ? null : b.dataset.camSel; desenhar(); });
  $$("[data-cam-olho]", painel).forEach((b) => b.onclick = () => { const l = camadas.find((x) => x.id === b.dataset.camOlho); if (!l) return; marcar(true); l.oculto = !l.oculto; if (l.oculto && est.sel === l.id) est.sel = null; editado(); desenhar(); });
  $("[data-cam-novo]", painel).onclick = () => {
    marcar(true);
    const c = CAMADAS.texto("Texto novo", "Escreva aqui", { x: M, y: Math.round(H / 2 - 30), w: W - 2 * M, tam: 48, peso: 700, cor: "tinta", entre: 1.2 });
    camadas.push(c); est.sel = c.id; editado(); desenhar();
    const f = $("[data-cam-texto]", el); if (f) { f.focus(); f.select(); }
  };
  $("[data-cam-refazer]", painel).onclick = async () => {
    if (s.camadasEditadas && !(await confirmar("Refazer este slide do jeito do estilo? Os ajustes feitos à mão neste slide se perdem (dá pra desfazer).", "Refazer slide"))) return;
    marcar(true); delete s.camadas; delete s.camadasEditadas; est.sel = null; desenhar();
  };

  // Painel: o slide
  $$("[data-est-mover]", painel).forEach((b) => b.onclick = () => { marcar(true); const j = est.i + Number(b.dataset.estMover); [car.slides[est.i], car.slides[j]] = [car.slides[j], car.slides[est.i]]; est.i = j; est.sel = null; desenhar(); });
  $("[data-est-duplicar]", painel).onclick = () => { if (car.slides.length >= 10) return; marcar(true); const c = JSON.parse(JSON.stringify(s)); (c.camadas || []).forEach((l) => { l.id = CAMADAS.novoId(); }); car.slides.splice(est.i + 1, 0, c); est.i++; est.sel = null; desenhar(); };
  $("[data-est-apagar]", painel).onclick = async () => { if (car.slides.length <= 1) return; if (!(await confirmar(`Apagar o slide ${est.i + 1}?`, "Apagar slide"))) return; marcar(true); car.slides.splice(est.i, 1); est.sel = null; desenhar(); };
  $("[data-est-tipo]", painel).onchange = async (e) => {
    if (s.camadasEditadas && !(await confirmar("Trocar o layout refaz este slide. Os ajustes feitos à mão se perdem (dá pra desfazer).", "Trocar layout"))) { e.target.value = s.tipo; return; }
    marcar(true); s.tipo = e.target.value; delete s.camadas; delete s.camadasEditadas; desenhar();
  };
  $$("[data-est-fundo]", painel).forEach((b) => b.onclick = () => { marcar(true); if (b.dataset.estFundo) s.fundo = b.dataset.estFundo; else delete s.fundo; if (s.camadasEditadas) s.camadasBase = null; desenhar(); });
  $$("[data-est-cor]", painel).forEach((b) => b.onclick = () => { marcar(true); if (b.dataset.estCor === "dourado") delete s.destaque; else s.destaque = b.dataset.estCor; desenhar(); });
  $("[data-est-todos]", painel).onclick = () => { marcar(true); car.slides.forEach((x) => { if (s.fundo) x.fundo = s.fundo; else delete x.fundo; if (s.destaque) x.destaque = s.destaque; else delete x.destaque; }); desenhar(); avisar("Fundo e cor aplicados em todos os slides."); };
  painel.addEventListener("change", async (e) => {
    if (e.target.matches("[data-est-enquadrar]")) { s.enquadrar = e.target.value; pintarGrande(); pintarMini(est.i); return; }
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
