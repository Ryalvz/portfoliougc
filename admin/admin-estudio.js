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

const FONTES_EST = [["grot", "Inter Tight"], ["mont", "Montserrat"], ["marcador", "Caveat Brush (à mão)"], ["mono", "Mono (código)"], ["serif", "Playfair (serifa)"]];
const PESOS_EST = [["400", "Regular"], ["500", "Médio"], ["700", "Negrito"], ["800", "Extra"], ["900", "Black"]];
const PALETA_EST = [["#1E1813", "Café"], ["#231A13", "Café alternativo"], ["#F1EAE0", "Creme"], ["#D9C48A", "Dourado"], ["#F2D46B", "Amarelo"], ["#A8742C", "Caramelo"], ["#B9783F", "Terra"], ["#8A7C66", "Cinza quente"], ["#E5483B", "Vermelho REC"], ["#FFFDF8", "Branco papel"]];
const NOMES_VINC = { nome: "Nome", arroba: "@", assinatura: "Assinatura", logo: "Logo" };
// A mesma peça em outra página: mesmo papel (título, nome, @...) e mesmo tipo
const chaveCamada = (l) => `${l.papel || l.nome}|${l.t}`;
const PROPS_GLOBAIS = ["fonte", "peso", "tam", "cor", "corDestaque", "corNegrito", "letra", "entre", "alinhar", "contorno", "fonteSolta", "fundoCor", "corTexto"];

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
  if (!car.formato) car.formato = car.estilo === "ryan" ? "retrato" : "quadrado";
  const novo = car.estilo === "ryan", ID = novo ? CAMADAS.identidadeDe(car) : null;
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
  // Quantas outras páginas têm a mesma peça (pro "aplicar em todas")
  const outrasCom = (l) => car.slides.filter((x, k) => k !== est.i && (x.camadas || CAMADAS.garantir(car, k)).some((o) => chaveCamada(o) === chaveCamada(l))).length;
  const fonteDe = (l) => (novo && !l.fonteSolta && (l.papel === "titulo" || l.papel === "texto") ? (l.papel === "titulo" ? CAMADAS.idDaPagina(car, s).fonteTitulo : CAMADAS.idDaPagina(car, s).fonteTexto) : l.fonte || "sans");

  el.innerHTML = `
    <details class="cartao car-ideia" id="est-ideia">
      <summary><b>Da sua ideia ao carrossel</b> <span class="sub">você escreve a ideia, o Claude monta, você cola aqui</span></summary>
      <textarea class="campo" id="est-ideia-txt" rows="3" placeholder="Ex.: quero mostrar como eu respondo marca que pede desconto">${esc(igx.ideiaCar || "")}</textarea>
      <div class="car-ideia-acoes">
        <input type="hidden" id="est-ideia-estilo" value="ryan">
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
      <button class="btn" type="button" id="est-refazer" ${(est.refazer || []).length ? "" : "disabled"} title="Cmd + Shift + Z">Refazer</button>
      <button class="btn" type="button" id="est-ver-tudo">Ver o carrossel inteiro</button>
      <button class="btn" type="button" id="est-lista">Ver em lista</button>
      <button class="btn" type="button" id="est-novo">Novo</button>
      <button class="btn" type="button" id="est-salvar">Salvar</button>
      <button class="btn primario" type="button" id="est-baixar">${ic("baixar")}Baixar imagens</button>
    </section>
    ${novo ? "" : `<div class="est-antigo"><span>Este carrossel está num estilo antigo, que saiu do Estúdio. Ele continua abrindo, mas a identidade nova e o "aplicar em todas" só funcionam no visual novo.</span><button class="btn primario" type="button" id="est-converter">Converter pro visual novo</button></div>`}

    <div class="est-grade">
      <aside class="est-minis" aria-label="Slides">
        ${car.slides.map((x, i) => `<button type="button" class="est-mini ${i === est.i ? "on" : ""}" data-est-i="${i}" aria-label="Slide ${i + 1}: ${esc(CAR_ESTILOS.nomeTipo(x.tipo))}" aria-current="${i === est.i}"><span class="est-mini-n">${i + 1}</span><canvas data-est-mini="${i}" width="${W}" height="${H}"></canvas></button>`).join("")}
        <button type="button" class="est-mini-mais" id="est-mais" ${n >= 10 ? "disabled" : ""}>${ic("mais")}Slide</button>
      </aside>
      <div class="est-palco">
        <div class="est-tela" id="est-tela"><canvas class="est-grande" id="est-grande" width="${W}" height="${H}" aria-label="Slide ${est.i + 1} de ${n}"></canvas>
          <div class="est-guias" id="est-guias" aria-hidden="true"></div>
          <div class="est-sel" id="est-sel" hidden><span class="est-sel-nome"></span>
            <button type="button" class="est-alca-l" id="est-alca-l" aria-label="Largura da caixa"></button>
            <button type="button" class="est-alca" id="est-alca" aria-label="Tamanho"></button></div></div>
        <div class="est-nav"><button type="button" class="est-seta" data-est-desfaz ${est.hist.length ? "" : "disabled"} title="Desfazer (Cmd + Z)" aria-label="Desfazer">&#8630;</button>
          <button type="button" class="est-seta" data-est-refaz ${(est.refazer || []).length ? "" : "disabled"} title="Refazer (Cmd + Shift + Z)" aria-label="Refazer">&#8631;</button>
          <button type="button" class="icone-btn" data-est-ir="-1" ${est.i === 0 ? "disabled" : ""} aria-label="Slide anterior">${ic("esq")}</button>
          <span>${est.i + 1} de ${n} · ${esc(PAGINAS_CAR[est.i] || "Extra")}</span>
          <button type="button" class="icone-btn" data-est-ir="1" ${est.i === n - 1 ? "disabled" : ""} aria-label="Próximo slide">${ic("dir")}</button>
          <button type="button" class="btn pequeno" id="est-baixar-uma">${ic("baixar")}Baixar esta página</button></div>
        <label class="check est-guia-check"><input type="checkbox" id="est-guia" ${est.guia ? "checked" : ""}> Mostrar a borda de segurança (não sai na imagem)</label>
        <p class="sub est-ajuda">Clique em qualquer coisa do slide pra escolher. Arraste pra mover, a bolinha do lado muda a largura e a do canto muda o tamanho. Delete apaga, Cmd + Z desfaz.</p>
      </div>
      <aside class="cartao est-painel" id="est-painel">
        <div class="est-painel-topo"><b>Slide ${est.i + 1} de ${n}</b><span class="espaco"></span>
          <button type="button" class="icone-btn" data-est-mover="-1" ${est.i === 0 ? "disabled" : ""} aria-label="Mover pra trás">${ic("esq")}</button>
          <button type="button" class="icone-btn" data-est-mover="1" ${est.i === n - 1 ? "disabled" : ""} aria-label="Mover pra frente">${ic("dir")}</button>
          <button type="button" class="icone-btn" data-est-duplicar ${n >= 10 ? "disabled" : ""} aria-label="Duplicar slide">${ic("mais")}</button>
          <button type="button" class="icone-btn" data-est-apagar ${n <= 1 ? "disabled" : ""} aria-label="Apagar slide">${ic("apagar")}</button></div>

        ${novo ? (() => {
          const linkadas = (k) => car.slides.filter((x) => (x.camadas || []).some((l) => l.vinc === k && !l.solto)).length;
          const IDP = CAMADAS.idDaPagina(car, s), local = Object.keys(s.idLocal || {}).length;
          const corBotoes = (campo, atual) => `<div class="est-paleta">${PALETA_EST.map(([c, nm]) => `<button type="button" data-id-cor="${campo}" data-cor="${c}" title="${nm}" aria-label="${nm}" aria-pressed="${String(atual).toLowerCase() === c.toLowerCase()}"><i style="background:${c}"></i></button>`).join("")}<input type="color" data-id-cor-livre="${campo}" value="${esc(atual)}" aria-label="Outra cor"></div>`;
          return `<details class="est-bloco est-id" ${est.idAberta ? "open" : ""}><summary class="est-rot est-id-topo">Identidade do carrossel<small>${est.idTodas ? `todas as ${n} páginas` : "só esta página"}</small></summary>
          <div class="est-id-corpo">
            <label class="check est-id-todas"><input type="checkbox" data-id-todas ${est.idTodas ? "checked" : ""}> Aplicar em todas as páginas (${n})</label>
            <small class="sub">${est.idTodas ? "Marcado: o que você mudar aqui vale pro carrossel inteiro." : "Desmarcado: o que você mudar aqui vale só pra esta página."}${local ? ` Esta página tem ${local === 1 ? "1 ajuste só dela" : `${local} ajustes só dela`}. <button type="button" class="link-btn" data-id-voltar>Voltar ao padrão do carrossel</button>` : ""}</small>
            ${[["nome", "Nome"], ["arroba", "@ do Instagram"], ["assinatura", "Assinatura"]].map(([k, r]) => `<label class="est-id-campo"><span>${r}<small>${linkadas(k)} ${linkadas(k) === 1 ? "página" : "páginas"}</small></span><input class="campo" data-id-txt="${k}" value="${esc(IDP[k])}"></label>`).join("")}
            <div class="est-id-campo"><span>Cor de destaque</span>${corBotoes("destaque", IDP.destaque)}</div>
            <div class="est-id-campo"><span>Cor principal (fundo escuro e texto)</span>${corBotoes("principal", IDP.principal)}</div>
            <label class="est-id-campo"><span>Fonte dos títulos</span><select class="campo" data-id-fonte="fonteTitulo">${FONTES_EST.map(([v, nm]) => `<option value="${v}" ${IDP.fonteTitulo === v ? "selected" : ""}>${nm}</option>`).join("")}</select></label>
            <label class="est-id-campo"><span>Fonte dos textos</span><select class="campo" data-id-fonte="fonteTexto">${FONTES_EST.map(([v, nm]) => `<option value="${v}" ${IDP.fonteTexto === v ? "selected" : ""}>${nm}</option>`).join("")}</select></label>
            <div class="est-id-campo"><span>Logo</span><div class="est-id-logo">${ID.logo ? `<img src="${esc(ID.logo)}" alt="" crossorigin="anonymous"><button type="button" class="btn pequeno" data-id-logo-todas>Colocar em todas as páginas</button><button type="button" class="btn pequeno" data-id-logo-tirar>Tirar</button>` : ""}<label class="btn pequeno">${ID.logo ? "Trocar" : "Subir logo"}<input type="file" accept="image/*" data-id-logo hidden></label></div></div>
            <small class="sub">Uma peça que você desvincular numa página fica com o jeito dela.</small>
          </div></details>`; })() : ""}
        ${npal > 25 ? `<p class="est-alerta">Muita coisa neste slide: ${npal} palavras. Carrossel bom tem até 25 por página. Esconda ou apague uma camada, ou passe uma parte pro próximo slide.</p>` : ""}
        <p class="est-alerta" id="est-fora" hidden></p>

        ${L ? `<div class="est-bloco est-cam-edit">
          <span class="est-rot">${esc(L.nome)}<small>camada escolhida</small></span>
          ${novo && L.vinc ? `<div class="est-vinc ${L.solto ? "solto" : ""}">${L.solto ? `Desvinculado: nesta página o ${esc(NOMES_VINC[L.vinc] || L.vinc)} tem o jeito dele. <button type="button" class="link-btn" data-cam-vincular>Vincular de novo</button>` : `Vinculado à identidade (${esc(NOMES_VINC[L.vinc] || L.vinc)}). <button type="button" class="link-btn" data-cam-desvincular>Desvincular desta página</button>`}</div>` : ""}
          ${ehTexto && L.auto !== "num" ? `<textarea class="campo" data-cam-texto rows="${L.t === "texto" && String(L.texto).length > 60 ? 4 : 2}">${esc(L.texto)}</textarea>
            <small class="sub">*palavra* fica em destaque e **palavra** em cinza. Enter quebra a linha.</small>` : ""}
          ${ehTexto && novo && L.vinc && L.solto ? `<div class="est-opcoes"><button type="button" data-cam-aplicar-texto="esta">Aplicar nesta página</button><button type="button" data-cam-aplicar-texto="todas">Aplicar em todas (${outrasCom(L) + 1})</button></div>` : ""}
          ${ehTexto ? `
            <div class="est-opcoes"><label class="est-mini-campo"><span>Fonte</span><select class="campo" data-cam-fonte>${FONTES_EST.map(([v, nm]) => `<option value="${v}" ${fonteDe(L) === v ? "selected" : ""}>${nm}</option>`).join("")}</select></label>
              <label class="est-mini-campo"><span>Peso</span><select class="campo" data-cam-peso>${PESOS_EST.map(([v, nm]) => `<option value="${v}" ${String(L.peso || 500) === v ? "selected" : ""}>${nm}</option>`).join("")}</select></label></div>
            ${estFaixa("tam", "Tamanho da letra", 12, 260, 1, L.tam, "px")}
            ${estFaixa("letra", "Espaço entre letras", -6, 40, 0.5, L.letra || 0, "px")}
            ${estFaixa("entre", "Espaço entre linhas", 0.8, 2.2, 0.02, L.entre || 1.25)}
            ${estFaixa("w", "Largura da caixa", 80, L.continua ? W : W - 2 * M, 10, L.w, "px")}
            <div class="est-opcoes est-opcoes-3" role="group" aria-label="Alinhamento">${[["left", "Esquerda"], ["center", "Centro"], ["right", "Direita"]].map(([v, nome]) => `<button type="button" data-cam-alinhar="${v}" aria-pressed="${(L.alinhar || "left") === v}">${nome}</button>`).join("")}</div>
            ${L.t === "texto" ? `<div class="est-opcoes est-opcoes-4" role="group" aria-label="Cor do texto">${NOMES_COR_CAM.map(([v, nome]) => `<button type="button" data-cam-cor="${v}" aria-pressed="${(L.cor || "texto") === v}">${nome}</button>`).join("")}</div>
              <label class="est-mini-campo est-cor-livre"><span>Outra cor</span><input type="color" data-cam-cor-livre value="${/^#[0-9a-f]{6}$/i.test(L.cor || "") ? L.cor : "#1E1813"}"></label>` : ""}
            ${estFaixa("rot", "Girar", -20, 20, 1, L.rot || 0, "°")}
            ${est.i < n - 1 && L.t === "texto" ? `<label class="check est-continua"><input type="checkbox" data-cam-continua ${L.continua ? "checked" : ""}> Continua no próximo slide (o resto aparece quando a pessoa arrasta)</label>` : ""}` : ""}
          ${["foto", "forma", "imagem", "janela", "celular"].includes(L.t) ? `${estFaixa("w", "Largura", 40, W, 10, L.w, "px")}${estFaixa("h", "Altura", 40, H, 10, L.h, "px")}${estFaixa("rot", "Girar", -20, 20, 1, L.rot || 0, "°")}` : ""}
          ${L.t === "imagem" ? estFaixa("foco", "Enquadramento da foto (cima / baixo)", 0, 1, 0.02, L.foco ?? 0.4) : ""}
          ${L.t === "fundoFoto" ? `<small class="sub">Arraste a foto no slide pra posicionar. A bolinha do canto aumenta e diminui.</small>
            ${estFaixa("zoom", "Tamanho da foto", 0.4, 4, 0.01, L.zoom || 1, "x")}
            ${estFaixa("px", "Posição na horizontal", -W, W, 5, L.px || 0, "px")}
            ${estFaixa("py", "Posição na vertical", -H, H, 5, L.py || 0, "px")}
            <label class="check"><input type="checkbox" data-cam-escurecer ${L.escurecer !== false ? "checked" : ""}> Escurecer em cima e embaixo (deixa o texto legível)</label>
            <div class="est-opcoes"><button type="button" data-cam-encaixar>Encaixar de novo</button></div>` : ""}
          ${L.t === "linha" ? estFaixa("w", "Comprimento", 40, W, 10, L.w, "px") : ""}
          ${novo && outrasCom(L) ? `<div class="est-global"><button type="button" class="btn" data-cam-global>Aplicar em todas as páginas</button><small>Leva fonte, peso, tamanho, cor e espaçamento desta peça pra ${outrasCom(L)} ${outrasCom(L) === 1 ? "outra página" : "outras páginas"} que têm ${esc(L.nome.toLowerCase())}. Posição e texto de cada página não mudam.</small></div>` : ""}
          <div class="est-opcoes"><button type="button" data-cam-dup>Duplicar</button><button type="button" data-cam-apagar="${L.id}">Apagar camada</button></div>
        </div>` : `<p class="sub est-dica">Clique num texto do slide (ou na lista abaixo) pra mudar o tamanho da letra, o espaço, a largura e o alinhamento.</p>`}

        <div class="est-bloco"><span class="est-rot">Camadas do slide<small>${camadas.length}</small></span>
          <ul class="est-camadas">${[...camadas].reverse().map((l) => `<li class="${l.id === est.sel ? "on" : ""} ${l.oculto ? "oculta" : ""}">
            <button type="button" class="est-cam-nome" data-cam-sel="${l.id}"><b>${esc(l.nome)}</b><small>${esc(String(l.auto === "num" ? "número do slide" : l.texto || (l.t === "foto" ? "foto" : "forma")).replace(/\*/g, "").slice(0, 40))}</small></button>
            <button type="button" class="est-cam-acao" data-cam-olho="${l.id}">${l.oculto ? "Mostrar" : "Esconder"}</button>
            <button type="button" class="icone-btn" data-cam-apagar="${l.id}" aria-label="Apagar ${esc(l.nome)}">${ic("apagar")}</button></li>`).join("")}</ul>
          <div class="est-opcoes"><button type="button" data-cam-novo>Adicionar texto</button><label class="est-btn-arquivo">Adicionar imagem<input type="file" accept="image/*" data-cam-imagem hidden></label></div>
          <div class="est-opcoes"><button type="button" data-cam-refazer>${novo ? "Refazer a página" : "Refazer pelo estilo"}</button></div>
        </div>

        <div class="est-bloco"><span class="est-rot est-rot-sec">Slide</span></div>
        ${novo ? `<label class="est-bloco"><span class="est-rot">Composição da página</span><select class="campo" data-est-comp>${CAMADAS.COMPS.map(([v, nm]) => `<option value="${v}" ${CAMADAS.compDe(car, s, est.i) === v ? "selected" : ""}>${nm}</option>`).join("")}</select></label>` : ""}
        <label class="est-bloco"><span class="est-rot">Layout</span><select class="campo" data-est-tipo aria-label="Layout do slide">${CAR_ESTILOS.TIPOS.map(([v, nome]) => `<option value="${v}" ${s.tipo === v ? "selected" : ""}>${nome}</option>`).join("")}</select></label>
        <div class="est-bloco"><span class="est-rot">Fundo</span><div class="est-opcoes">
          <button type="button" data-est-fundo="" aria-pressed="${!s.fundo}">Como o estilo pede</button>
          <button type="button" data-est-fundo="trocar" aria-pressed="${s.fundo === "trocar"}">Trocar claro e escuro</button></div></div>
        ${novo ? "" : `<div class="est-bloco"><span class="est-rot">Cor de destaque</span><div class="est-cores">${destaques.map(([k, d]) => `<button type="button" data-est-cor="${k}" aria-pressed="${(s.destaque || "dourado") === k}" title="${esc(d.nome)}" aria-label="${esc(d.nome)}"><i style="background:linear-gradient(135deg, ${d.cores[0]} 50%, ${d.cores[1]} 50%)"></i></button>`).join("")}</div></div>`}
        ${temFoto || novo ? estFoto(s) : ""}
        <button type="button" class="link-btn" data-est-todos>Usar este fundo e esta cor em todos os slides</button>
      </aside>
    </div>`;

  // Desenho
  const cvG = $("#est-grande", el);
  const pintarMini = (i) => { const cv = $(`[data-est-mini="${i}"]`, el); if (cv && car.slides[i]) CAMADAS.pintar(cv, car, i, { aoCarregar: () => pintarMini(i) }); };
  const pintarGrande = () => { if (!cvG) return; CAMADAS.pintar(cvG, car, est.i, { guia: est.guia, aoCarregar: pintarGrande }); mostrarSel(); avisarBorda(); };
  /* ---------- Guias inteligentes (como no Canva) ----------
     Linhas rosas quando a peça alinha com a borda ou o centro de outra peça,
     com o centro do slide ou com a borda de segurança; aviso de mesma largura e altura. */
  const LIM_GUIA = 8;
  const outrasCaixas = (id) => (cvG.__caixas || []).filter((b) => b.id !== id && !(b.x1 - b.x0 >= W * 0.95 && b.y1 - b.y0 >= H * 0.95));
  const pontosEixo = (b, eixo) => (eixo === "x" ? [b.x0, (b.x0 + b.x1) / 2, b.x1] : [b.y0, (b.y0 + b.y1) / 2, b.y1]);
  function encaixar(box, outros, eixo, lim = LIM_GUIA) {
    let melhor = null;
    const meus = pontosEixo(box, eixo), pagina = eixo === "x" ? [M, W / 2, W - M] : [M, H / 2, H - M];
    const testa = (t, o) => meus.forEach((m) => { const d = t - m; if (Math.abs(d) <= lim && (!melhor || Math.abs(d) < Math.abs(melhor.d))) melhor = { d, p: t, o }; });
    outros.forEach((o) => pontosEixo(o, eixo).forEach((t) => testa(t, o)));
    pagina.forEach((t) => testa(t, null));
    return melhor;
  }
  // Linhas de alinhamento e avisos de tamanho pra uma caixa (lim 1 = só o que já está exato)
  function guiasDe(box, outros, lim) {
    const linhas = [], rotulos = [];
    ["x", "y"].forEach((eixo) => {
      const meus = pontosEixo(box, eixo), pagina = eixo === "x" ? [M, W / 2, W - M] : [M, H / 2, H - M], vistos = new Set();
      const add = (t, o) => { const k = Math.round(t); if (vistos.has(k)) return; vistos.add(k);
        if (eixo === "x") linhas.push({ v: true, p: t, a: o ? Math.min(box.y0, o.y0) : 0, b: o ? Math.max(box.y1, o.y1) : H });
        else linhas.push({ v: false, p: t, a: o ? Math.min(box.x0, o.x0) : 0, b: o ? Math.max(box.x1, o.x1) : W }); };
      outros.forEach((o) => pontosEixo(o, eixo).forEach((t) => { if (meus.some((m) => Math.abs(t - m) <= lim)) add(t, o); }));
      pagina.forEach((t) => { if (meus.some((m) => Math.abs(t - m) <= lim)) add(t, null); });
    });
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    if (outros.some((o) => Math.abs(o.x1 - o.x0 - bw) <= Math.max(1, lim / 4))) rotulos.push({ x: (box.x0 + box.x1) / 2, y: box.y1 + 46, t: "mesma largura" });
    if (outros.some((o) => Math.abs(o.y1 - o.y0 - bh) <= Math.max(1, lim / 4))) rotulos.push({ x: box.x1, y: (box.y0 + box.y1) / 2, t: "mesma altura", lado: true });
    if (Math.abs((box.x0 + box.x1) / 2 - W / 2) <= lim) rotulos.push({ x: W / 2, y: box.y1 + 96, t: "no centro" });
    return { linhas, rotulos };
  }
  function mostrarGuias(g) {
    const alvo = $("#est-guias", el); if (!alvo) return;
    if (!g) { alvo.innerHTML = ""; return; }
    const f = cvG.clientWidth / cvG.width;
    alvo.innerHTML = g.linhas.map((x) => x.v ? `<i class="est-g v" style="left:${x.p * f}px;top:${x.a * f}px;height:${Math.max(1, (x.b - x.a) * f)}px"></i>` : `<i class="est-g h" style="top:${x.p * f}px;left:${x.a * f}px;width:${Math.max(1, (x.b - x.a) * f)}px"></i>`).join("")
      + g.rotulos.map((r) => `<span class="est-g-rot ${r.lado ? "lado" : ""}" style="left:${r.x * f}px;top:${r.y * f}px">${esc(r.t)}</span>`).join("");
  }
  const mostrarSel = () => {
    const caixa = $("#est-sel", el); if (!caixa) return;
    const b = est.sel && (cvG.__caixas || []).find((x) => x.id === est.sel);
    if (!est.arrastando) mostrarGuias(b && !(b.x1 - b.x0 >= W * 0.95 && b.y1 - b.y0 >= H * 0.95) ? guiasDe(b, outrasCaixas(b.id), 1) : null);
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
    est.ultMarca = agora; est.hist.push({ i: est.i, slides: JSON.stringify(car.slides), formato: car.formato, identidade: JSON.stringify(car.identidade || null), estilo: car.estilo });
    est.refazer = [];
    if (est.hist.length > 60) est.hist.shift();
    [$("#est-desfazer", el), $("[data-est-desfaz]", el)].forEach((b) => { if (b) b.disabled = false; });
    [$("#est-refazer", el), $("[data-est-refaz]", el)].forEach((b) => { if (b) b.disabled = true; });
  };
  const foto = () => ({ i: est.i, slides: JSON.stringify(car.slides), formato: car.formato, identidade: JSON.stringify(car.identidade || null), estilo: car.estilo });
  const voltarPara = (h) => { car.slides = JSON.parse(h.slides); car.formato = h.formato; car.estilo = h.estilo || car.estilo; const idv = JSON.parse(h.identidade || "null"); if (idv) car.identidade = idv; else delete car.identidade; est.i = Math.min(h.i, car.slides.length - 1); est.sel = null; desenhar(); };
  const desfazer = () => { const h = est.hist.pop(); if (!h) return; (est.refazer = est.refazer || []).push(foto()); voltarPara(h); };
  const refazer = () => { const h = (est.refazer || []).pop(); if (!h) return; est.hist.push(foto()); voltarPara(h); };
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
  $("#est-novo", el).onclick = () => { igx.car = CAR_ESTILOS.exemplo("ryan"); igx.car.formato = "retrato"; est.i = 0; desenhar(); avisar("Exemplo novo: troque os textos e as fotos."); };
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
    const estilo = "ryan";
    igx.car = { titulo: lido.titulo, estilo, formato: "retrato", slides: lido.slides, legenda: leg ? leg.trim().split("\n")[0].replace(/\*\*/g, "") : "" };
    est.i = 0; desenhar(); avisar("Carrossel montado no visual novo. Suba as fotos e confira.");
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) refazer(); else desfazer(); return; }
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
      marcar(true); arrasto = { tipo: "largura", l, x0: pt[0], w0: l.w, outros: outrasCaixas(l.id), b0: b };
    } else if (l && b && e.target.closest("#est-alca")) {
      const cx = b.x0, cy = b.y0;
      marcar(true); arrasto = { tipo: "tamanho", l, cx, cy, d0: Math.hypot(pt[0] - cx, pt[1] - cy) || 1, tam0: l.tam, w0: l.w, h0: l.h, zoom0: l.zoom || 1, outros: outrasCaixas(l.id), b0: b };
    } else {
      const id = camadaNoPonto(pt);
      if (!id) { if (est.sel) { est.sel = null; desenhar(); } return; }
      const c = camadas.find((x) => x.id === id), cb = (cvG.__caixas || []).find((x) => x.id === id);
      marcar(true);
      arrasto = c.t === "fundoFoto" ? { tipo: "foto", l: c, x0: pt[0], y0: pt[1], px: c.px || 0, py: c.py || 0, mudou: est.sel !== id, andou: false } : { tipo: "mover", l: c, x0: pt[0], y0: pt[1], px: c.x, py: c.y, ox: cb.x0 - c.x, oy: cb.y0 - c.y, bw: cb.x1 - cb.x0, bh: cb.y1 - cb.y0, mudou: est.sel !== id, andou: false, outros: outrasCaixas(id) };
      est.sel = id; mostrarSel();
    }
    e.preventDefault();
    est.arrastando = true;
    try { tela.setPointerCapture(e.pointerId); } catch (_) {}
  });
  tela.addEventListener("pointermove", (e) => {
    const pt = pontoNoSlide(e);
    if (!arrasto) { cvG.style.cursor = camadaNoPonto(pt) ? "move" : ""; return; }
    const a = arrasto, l = a.l;
    if (a.tipo === "foto") {
      if (Math.abs(pt[0] - a.x0) + Math.abs(pt[1] - a.y0) > 3) a.andou = true;
      l.px = Math.round(a.px + pt[0] - a.x0); l.py = Math.round(a.py + pt[1] - a.y0);
    } else if (a.tipo === "mover") {
      let x = a.px + pt[0] - a.x0, y = a.py + pt[1] - a.y0;
      if (Math.abs(pt[0] - a.x0) + Math.abs(pt[1] - a.y0) > 3) a.andou = true;
      const decor = l.t === "forma" || l.t === "linha";
      // Gruda nas outras peças, no centro e na borda (Alt solta)
      if (!e.altKey) {
        const box = { x0: x + a.ox, x1: x + a.ox + a.bw, y0: y + a.oy, y1: y + a.oy + a.bh };
        const sx = encaixar(box, a.outros, "x"), sy = encaixar(box, a.outros, "y");
        if (sx) x += sx.d; if (sy) y += sy.d;
      }
      // Não deixa sair da borda de segurança (Alt solta; o que continua no próximo slide pode passar pela direita)
      if (!e.altKey && !decor) {
        const lim = limites();
        if (a.bw <= lim.x1 - lim.x0) x = Math.max(lim.x0 - a.ox, l.continua ? x : Math.min(lim.x1 - a.bw - a.ox, x));
        if (a.bh <= lim.y1 - lim.y0) y = Math.max(lim.y0 - a.oy, Math.min(lim.y1 - a.bh - a.oy, y));
      }
      l.x = Math.round(x); l.y = Math.round(y);
      const box = { x0: l.x + a.ox, x1: l.x + a.ox + a.bw, y0: l.y + a.oy, y1: l.y + a.oy + a.bh };
      mostrarGuias(e.altKey ? null : guiasDe(box, a.outros, 1));
    } else if (a.tipo === "largura") {
      const max = l.continua || e.altKey ? W : W - M - l.x;
      l.w = Math.round(Math.max(60, Math.min(max, a.w0 + pt[0] - a.x0)));
      // Gruda na largura de outra peça e na borda direita / centro de outra
      if (!e.altKey) {
        const dx0 = a.b0.x0 - l.x, mesmo = a.outros.find((o) => Math.abs(o.x1 - o.x0 - l.w) <= LIM_GUIA);
        if (mesmo) l.w = Math.round(mesmo.x1 - mesmo.x0);
        else { const sx = encaixar({ x0: l.x + dx0 + l.w, x1: l.x + dx0 + l.w, y0: a.b0.y0, y1: a.b0.y1 }, a.outros, "x"); if (sx) l.w = Math.round(l.w + sx.d); }
        const box = { x0: a.b0.x0, x1: a.b0.x0 + l.w, y0: a.b0.y0, y1: a.b0.y1 };
        mostrarGuias(guiasDe(box, a.outros, 1));
      }
    } else {
      const k = Math.hypot(pt[0] - a.cx, pt[1] - a.cy) / a.d0;
      if (l.t === "fundoFoto") l.zoom = Math.round(Math.max(0.4, Math.min(4, a.zoom0 * k)) * 100) / 100;
      else if (CAMADAS.TEXTOS.includes(l.t)) l.tam = Math.round(Math.max(10, Math.min(260, a.tam0 * k)));
      else {
        l.w = Math.round(Math.max(30, a.w0 * k)); if (a.h0) l.h = Math.round(Math.max(30, a.h0 * k));
        // Gruda no mesmo tamanho de outra peça
        if (!e.altKey && a.outros) {
          const mesmo = a.outros.find((o) => Math.abs(o.x1 - o.x0 - l.w) <= LIM_GUIA);
          if (mesmo) { const k2 = (mesmo.x1 - mesmo.x0) / a.w0; l.w = Math.round(a.w0 * k2); if (a.h0) l.h = Math.round(a.h0 * k2); }
          mostrarGuias(guiasDe({ x0: a.b0.x0, y0: a.b0.y0, x1: a.b0.x0 + l.w, y1: a.b0.y0 + (a.h0 ? l.h : a.b0.y1 - a.b0.y0) }, a.outros, 1));
        }
      }
    }
    editado(); repintarJa();
  });
  const soltar = () => {
    est.arrastando = false; mostrarGuias(null);
    if (!arrasto) return; const a = arrasto; arrasto = null;
    if ((a.tipo === "mover" || a.tipo === "foto") && !a.andou) est.hist.pop(); // só clicou: nada pra desfazer
    if (a.mudou || (a.tipo !== "mover" && a.tipo !== "foto")) desenhar(); else { pintarGrande(); miniDepois(); }
  };
  tela.addEventListener("pointerup", soltar);
  tela.addEventListener("pointercancel", soltar);
  tela.addEventListener("dblclick", () => { const f = $("[data-cam-texto]", el); if (f) { f.focus(); f.select(); } });
  // A rodinha do mouse só rola a página (o tamanho muda pela bolinha do canto ou pelo painel)
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

  const esc0 = $("[data-cam-escurecer]", painel);
  if (esc0) esc0.onchange = () => { const l = Lsel(); if (!l) return; marcar(true); l.escurecer = esc0.checked; editado(); desenhar(); };
  const enc = $("[data-cam-encaixar]", painel);
  if (enc) enc.onclick = () => { const l = Lsel(); if (!l) return; marcar(true); l.zoom = 1; l.px = 0; l.py = 0; editado(); desenhar(); };

  // Refazer, ver o carrossel inteiro, baixar uma página
  $("#est-refazer", el).onclick = refazer;
  $("[data-est-desfaz]", el).onclick = desfazer;
  $("[data-est-refaz]", el).onclick = refazer;
  $("#est-baixar-uma", el).onclick = async (e) => {
    const b = e.target.closest("button"); b.disabled = true;
    try {
      await carregarFontesCarrossel(); await esperarFotos(car.slides);
      const cv = document.createElement("canvas"); CAMADAS.pintar(cv, car, est.i);
      const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.93));
      const nome = (car.titulo || "carrossel").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "carrossel";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${nome}-${String(est.i + 1).padStart(2, "0")}.jpg`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      avisar(`Página ${est.i + 1} baixada (${cv.width} x ${cv.height}).`);
    } catch (erro) { avisar("Não deu pra baixar: " + (erro.message || erro), true); }
    b.disabled = false;
  };
  $("#est-ver-tudo", el).onclick = async () => {
    await carregarFontesCarrossel();
    const imgs = car.slides.map((_, k) => { const cv = document.createElement("canvas"); CAMADAS.pintar(cv, car, k); return cv.toDataURL("image/jpeg", 0.8); });
    const d = abrirJanelaSimples(`${esc(car.titulo || "Carrossel")} · ${car.slides.length} páginas`, `<div class="est-tudo">${imgs.map((u, k) => `<button type="button" class="est-tudo-pag" data-ir-pag="${k}"><img src="${u}" alt="Página ${k + 1}"><span>${k + 1}</span></button>`).join("")}</div>`,
      `<button type="button" class="btn primario" data-fechar>Fechar</button>`);
    $$("[data-ir-pag]", d).forEach((b) => b.onclick = () => { d.close(); est.i = Number(b.dataset.irPag); est.sel = null; desenhar(); });
  };
  const conv = $("#est-converter", el);
  if (conv) conv.onclick = async () => {
    if (!(await confirmar("Converter pro visual novo? As páginas são refeitas com a identidade e as composições novas, no formato 4:5. Os textos continuam (dá pra desfazer).", "Converter"))) return;
    marcar(true); car.estilo = "ryan"; car.formato = "retrato"; CAMADAS.identidadeDe(car);
    car.slides.forEach((x) => { delete x.camadas; delete x.camadasEditadas; delete x.comp; });
    est.sel = null; desenhar(); avisar("Pronto: carrossel no visual novo.");
  };

  // Composição da página
  const comp = $("[data-est-comp]", painel);
  if (comp) comp.onchange = async (e) => {
    if (s.camadasEditadas && !(await confirmar("Trocar a composição refaz esta página. Os ajustes feitos à mão nela se perdem (dá pra desfazer).", "Trocar composição"))) { e.target.value = CAMADAS.compDe(car, s, est.i); return; }
    marcar(true); s.comp = e.target.value; delete s.camadas; delete s.camadasEditadas; est.sel = null; desenhar();
  };

  // Identidade do carrossel: muda e todas as páginas vinculadas acompanham na hora
  const idBox = $(".est-id", painel);
  if (idBox) {
    idBox.addEventListener("toggle", () => { est.idAberta = idBox.open; });
    const repintarTudo = () => { pintarGrande(); car.slides.forEach((_, k) => pintarMini(k)); };
    const gravaId = (k, v) => {
      if (est.idTodas) { ID[k] = v; car.slides.forEach((x) => { if (x.idLocal) { delete x.idLocal[k]; if (!Object.keys(x.idLocal).length) delete x.idLocal; } }); }
      else { s.idLocal = s.idLocal || {}; if (ID[k] === v) delete s.idLocal[k]; else s.idLocal[k] = v; if (!Object.keys(s.idLocal).length) delete s.idLocal; s.camadasEditadas = true; }
    };
    const todas = $("[data-id-todas]", idBox);
    if (todas) todas.onchange = () => { est.idTodas = todas.checked; desenhar(); };
    const voltarId = $("[data-id-voltar]", idBox);
    if (voltarId) voltarId.onclick = () => { marcar(true); delete s.idLocal; desenhar(); };
    $$("[data-id-txt]", idBox).forEach((inp) => inp.addEventListener("input", () => { marcar(); gravaId(inp.dataset.idTxt, inp.value); repintarJa(); clearTimeout(espera); espera = setTimeout(repintarTudo, 300); }));
    $$("[data-id-cor]", idBox).forEach((b) => b.onclick = () => { marcar(true); gravaId(b.dataset.idCor, b.dataset.cor); desenhar(); });
    $$("[data-id-cor-livre]", idBox).forEach((inp) => { inp.addEventListener("input", () => { marcar(); gravaId(inp.dataset.idCorLivre, inp.value); repintarJa(); }); inp.addEventListener("change", () => desenhar()); });
    $$("[data-id-fonte]", idBox).forEach((sel) => sel.onchange = () => { marcar(true); gravaId(sel.dataset.idFonte, sel.value); desenhar(); });
    const up = $("[data-id-logo]", idBox);
    if (up) up.onchange = async () => {
      const f = up.files && up.files[0]; if (!f) return;
      try { const url = await enviarArquivo(await prepararFoto(f), "carrosseis", "logo.jpg"); if (url) { marcar(true); ID.logo = url; desenhar(); avisar("Logo salvo. Toque em \"Colocar em todas as páginas\" pra ele aparecer."); } }
      catch (erro) { avisar(erro.message || "Não deu pra usar esse logo.", true); }
    };
    const logoTodas = $("[data-id-logo-todas]", idBox);
    if (logoTodas) logoTodas.onclick = () => {
      marcar(true); let n2 = 0;
      car.slides.forEach((x, k) => { const cs = CAMADAS.garantir(car, k); if (cs.some((l) => l.vinc === "logo")) return; const nomeL = cs.find((l) => l.vinc === "nome"); cs.push({ id: CAMADAS.novoId(), nome: "Logo", papel: "logo", vinc: "logo", t: "imagem", src: ID.logo, x: M, y: M - 8, w: 44, h: 44, raio: 22, sombra: false, moldura: true }); if (nomeL && !nomeL.solto && nomeL.x < M + 50) nomeL.x = M + 56; x.camadasEditadas = true; n2++; });
      desenhar(); avisar(n2 ? `Logo colocado em ${n2} ${n2 === 1 ? "página" : "páginas"}.` : "Todas as páginas já tinham o logo.");
    };
    const logoTirar = $("[data-id-logo-tirar]", idBox);
    if (logoTirar) logoTirar.onclick = () => { marcar(true); ID.logo = ""; car.slides.forEach((x) => { if (x.camadas) x.camadas = x.camadas.filter((l) => l.vinc !== "logo"); }); desenhar(); };
  }
  // O logo vinculado segue o logo da identidade
  car.slides.forEach((x) => (x.camadas || []).forEach((l) => { if (l.vinc === "logo" && !l.solto && ID && ID.logo) l.src = ID.logo; }));

  // Camada escolhida: fonte, peso, cor livre, vínculo e aplicar em todas
  const fonteSel = $("[data-cam-fonte]", painel);
  if (fonteSel) fonteSel.onchange = () => { const l = Lsel(); if (!l) return; marcar(true); l.fonte = fonteSel.value; if (l.papel === "titulo" || l.papel === "texto") l.fonteSolta = true; editado(); desenhar(); };
  const pesoSel = $("[data-cam-peso]", painel);
  if (pesoSel) pesoSel.onchange = () => { const l = Lsel(); if (!l) return; marcar(true); l.peso = Number(pesoSel.value); editado(); desenhar(); };
  const corLivre = $("[data-cam-cor-livre]", painel);
  if (corLivre) { corLivre.addEventListener("input", () => { const l = Lsel(); if (!l) return; marcar(); l.cor = corLivre.value; editado(); repintarJa(); }); corLivre.addEventListener("change", () => desenhar()); }
  const desv = $("[data-cam-desvincular]", painel);
  if (desv) desv.onclick = () => { const l = Lsel(); if (!l) return; marcar(true); l.texto = ID[l.vinc] != null && l.vinc !== "logo" ? ID[l.vinc] : l.texto; l.solto = true; editado(); desenhar(); };
  const revinc = $("[data-cam-vincular]", painel);
  if (revinc) revinc.onclick = () => { const l = Lsel(); if (!l) return; marcar(true); delete l.solto; editado(); desenhar(); };
  // Texto de uma peça vinculada: digitar muda só esta página; "aplicar em todas" leva pra identidade
  if (campoTexto) campoTexto.addEventListener("input", () => { const l = Lsel(); if (l && novo && l.vinc && !l.solto) { l.solto = true; } });
  $$("[data-cam-aplicar-texto]", painel).forEach((b) => b.onclick = () => {
    const l = Lsel(); if (!l || !l.vinc) return; marcar(true);
    if (b.dataset.camAplicarTexto === "todas") {
      ID[l.vinc] = l.texto; let n2 = 0;
      car.slides.forEach((x) => (x.camadas || []).forEach((o) => { if (o.vinc === l.vinc && o.solto) { delete o.solto; n2++; } }));
      delete l.solto; avisar(`${NOMES_VINC[l.vinc] || "Texto"} atualizado em todas as páginas.`);
    } else avisar("Mudou só nesta página.");
    editado(); desenhar();
  });
  const global = $("[data-cam-global]", painel);
  if (global) global.onclick = () => {
    const l = Lsel(); if (!l) return; marcar(true);
    const chave = chaveCamada(l); let pags = 0;
    car.slides.forEach((x, k) => {
      if (k === est.i) return;
      const cs = CAMADAS.garantir(car, k); let mexeu = false;
      cs.forEach((o) => {
        if (chaveCamada(o) !== chave) return;
        PROPS_GLOBAIS.forEach((p) => { if (l[p] === undefined) delete o[p]; else o[p] = l[p]; });
        if (l.vinc) { if (l.solto) { o.solto = true; o.texto = l.texto; } else delete o.solto; }
        mexeu = true;
      });
      if (mexeu) { x.camadasEditadas = true; pags++; }
    });
    editado(); desenhar(); avisar(`Aplicado em ${pags} ${pags === 1 ? "página" : "páginas"}. Dá pra desfazer com Cmd + Z.`);
  };
  // Adicionar imagem solta
  const novaImg = $("[data-cam-imagem]", painel);
  if (novaImg) novaImg.onchange = async () => {
    const f = novaImg.files && novaImg.files[0]; if (!f) return;
    const rot = novaImg.closest("label"); rot.firstChild.textContent = "Enviando...";
    try {
      const arq = await prepararFoto(f), url = await enviarArquivo(arq, "carrosseis", "imagem.jpg");
      if (!url) { rot.firstChild.textContent = "Adicionar imagem"; return; }
      const dimsImg = await new Promise((ok) => { const im = new Image(); im.onload = () => ok([im.width, im.height]); im.onerror = () => ok([4, 3]); im.src = URL.createObjectURL(arq); });
      const w = Math.round((W - 2 * M) * 0.6), h = Math.round(w * dimsImg[1] / dimsImg[0]);
      marcar(true);
      const c = { id: CAMADAS.novoId(), nome: "Imagem", papel: "imagem", t: "imagem", src: url, x: Math.round((W - w) / 2), y: Math.round(Math.max(M, (H - h) / 2)), w, h: Math.min(h, H - 2 * M), raio: 18, foco: 0.4 };
      camadas.push(c); est.sel = c.id; editado(); desenhar(); avisar("Imagem no slide. Arraste e redimensione pela bolinha do canto.");
    } catch (erro) { avisar(erro.message || "Não deu pra usar essa imagem.", true); rot.firstChild.textContent = "Adicionar imagem"; }
  };
}
