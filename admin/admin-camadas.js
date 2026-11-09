/* =============================================================
   ADMIN, PARTE 11: camadas do Estúdio de arte
   Cada coisa do slide (título, texto, balão, cabeçalho, arroba,
   foto...) é uma camada solta: dá pra mover, mudar o tamanho da
   letra, o espaço entre letras e entre linhas, a largura da caixa,
   o alinhamento, esconder ou apagar.
   O slide nasce dos campos (título, texto, msgs...) no estilo
   escolhido, já dentro da borda de segurança do Instagram.
   Formato padrão: quadrado 1080 x 1080 (dá pra trocar pra 4:5).
   ============================================================= */
const CAMADAS = (() => {
  const M = 80; // borda de segurança
  const FORMATOS = { quadrado: { nome: "Quadrado 1:1", w: 1080, h: 1080 }, retrato: { nome: "Retrato 4:5", w: 1080, h: 1350 } };
  const dims = (car) => FORMATOS[car && car.formato] || FORMATOS.quadrado;
  const TEMAS = {
    claro: { fundo: "#F5F1EA", tinta: "#2B241C", texto: "#3A3128", cinza: "#8F8676", ouro: "#7A6322", naOuro: "#FFF8EA", vidro: "rgba(43,36,28,.06)", balao: "#E6DDCD", marca: "#D9C48A", naMarca: "#2B241C", marcaTipo: "meia" },
    escuro: { fundo: "#2B241C", tinta: "#F5F1EA", texto: "#E9E1D3", cinza: "#A89E8E", ouro: "#D9C48A", naOuro: "#2B241C", vidro: "rgba(255,255,255,.06)", balao: "#3A3128", marca: "", naMarca: "#D9C48A", marcaTipo: "" },
    foto: { fundo: "#1A1511", tinta: "#FFF8EA", texto: "#F2EBDD", cinza: "rgba(255,248,234,.75)", ouro: "#D9C48A", naOuro: "#2B241C", vidro: "rgba(0,0,0,.28)", balao: "rgba(43,36,28,.85)", marca: "", naMarca: "#D9C48A", marcaTipo: "" },
    // Só no Direto: o slide de fundo dourado chapado
    ouro: { fundo: "#D9C48A", tinta: "#2B241C", texto: "#2B241C", cinza: "#5C5038", ouro: "#2B241C", naOuro: "#F5F1EA", vidro: "rgba(43,36,28,.08)", balao: "#F5F1EA", marca: "#2B241C", naMarca: "#D9C48A", marcaTipo: "bloco" }
  };
  // Direto: o fundo muda a cada slide (café, creme, dourado...), como nas referências
  const SEQ_DIRETO = ["escuro", "claro", "ouro", "claro", "escuro", "claro", "ouro"];
  const TOM = {
    bastidor: { gancho: "foto", contexto: "claro", construcao: "claro", tensao: "escuro", recompensa: "claro", cta: "escuro" },
    revista: { gancho: "claro", contexto: "claro", construcao: "claro", tensao: "escuro", recompensa: "claro", cta: "claro" },
    conversa: { gancho: "escuro", contexto: "escuro", construcao: "escuro", tensao: "escuro", recompensa: "claro", cta: "escuro" },
    fotos: { gancho: "foto", contexto: "foto", construcao: "foto", tensao: "foto", recompensa: "foto", cta: "claro" }
  };
  function tomDe(car, s) {
    let t = ((TOM[car.estilo] || TOM.bastidor)[s.tipo]) || "claro";
    if (car.estilo === "direto") { const k = Math.max(0, (car.slides || []).indexOf(s)), n = (car.slides || []).length; t = k === n - 1 && n > 1 ? "ouro" : SEQ_DIRETO[k % SEQ_DIRETO.length]; }
    if (s.fundo === "trocar") return t === "escuro" ? "claro" : "escuro";
    return t;
  }
  function temaDe(car, s) {
    const tom = tomDe(car, s), c = { ...TEMAS[tom], tom };
    const d = CAR_ESTILOS.DESTAQUES[s.destaque];
    if (d && s.destaque !== "dourado") {
      if (tom === "ouro") { c.fundo = d.cores[1]; c.naMarca = d.cores[1]; }
      else { c.ouro = d.cores[tom === "claro" ? 0 : 1]; if (tom === "claro") c.marca = d.cores[1]; else c.naMarca = d.cores[1]; }
    }
    return c;
  }
  const cor = (tema, k) => tema[k] || k;

  /* ---------- Texto: *destaque*, **cinza**, quebra de linha pela largura da caixa ---------- */
  function pedacos(s) {
    const out = [], re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g; let u = 0, m;
    while ((m = re.exec(s))) { if (m.index > u) out.push({ t: s.slice(u, m.index), e: "n" }); out.push({ t: m[1] != null ? m[1] : m[2], e: m[1] != null ? "b" : "a" }); u = re.lastIndex; }
    if (u < s.length) out.push({ t: s.slice(u), e: "n" });
    return out;
  }
  function tokens(linha) {
    const tk = []; let cola = false;
    pedacos(linha).forEach((p) => p.t.split(/(\s+)/).forEach((x) => {
      if (!x) return;
      if (/^\s+$/.test(x)) { cola = false; return; }
      tk.push({ t: x, e: p.e, cola: tk.length > 0 && cola }); cola = true;
    }));
    return tk;
  }
  function fonte(l, e, tam) {
    if (l.fonte === "mao") return `400 ${tam}px ${FONTE_MAO}`;
    if (l.fonte === "marcador") return `400 ${tam}px ${FONTE_MARCADOR}`;
    if (l.fonte === "grot") return `${e === "a" || e === "b" ? Math.max(800, l.peso || 500) : l.peso || 500} ${tam}px ${FONTE_GROT}`;
    if (l.fonte === "serif") return `${e === "a" ? "italic " : ""}700 ${tam}px ${FONTE_SERIFA}`;
    if (e === "a") return `italic 700 ${Math.round(tam * 1.04)}px ${FONTE_SERIFA}`;
    return `${l.peso || 500} ${tam}px ${FONTE_BASTAO}`;
  }
  function montar(ctx, l) {
    const tam = Math.max(8, Number(l.tam) || 40), larg = Math.max(40, Number(l.w) || 400), entre = Number(l.entre) || 1.25;
    ctx.letterSpacing = `${Number(l.letra) || 0}px`;
    ctx.font = fonte(l, "n", tam); const esp = ctx.measureText(" ").width;
    const linhas = [];
    String(l.texto || "").split("\n").forEach((par) => {
      let atual = { itens: [], w: 0 };
      tokens(par).forEach((tk) => {
        ctx.font = fonte(l, tk.e, tam); const w = ctx.measureText(tk.t).width;
        if (atual.itens.length && !tk.cola && atual.w + esp + w > larg) { linhas.push(atual); atual = { itens: [], w: 0 }; }
        const sep = atual.itens.length && !tk.cola ? esp : 0;
        atual.itens.push({ ...tk, w, sep }); atual.w += sep + w;
      });
      linhas.push(atual);
    });
    return { linhas, tam, entre, alt: Math.max(1, linhas.length) * tam * entre, larg: Math.max(0, ...linhas.map((x) => x.w)) };
  }
  function escrever(ctx, l, m, x0, y0, largura, cores, alinhar) {
    ctx.letterSpacing = `${Number(l.letra) || 0}px`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    const lh = m.tam * m.entre;
    m.linhas.forEach((ln, k) => {
      const base = y0 + k * lh + (lh - m.tam) / 2 + m.tam * 0.8;
      let cx = alinhar === "center" ? x0 + (largura - ln.w) / 2 : alinhar === "right" ? x0 + largura - ln.w : x0;
      ln.itens.forEach((it, j) => {
        cx += it.sep;
        if (it.e === "a" && cores.marca) { // marca-texto: meia altura (creme) ou bloco cheio (dourado)
          const prox = ln.itens[j + 1], junta = prox && prox.e === "a" ? prox.sep : 0, pad = m.tam * 0.08;
          ctx.fillStyle = cores.marca;
          if (cores.marcaTipo === "bloco") ctx.fillRect(cx - pad, base - m.tam * 0.8, it.w + junta + pad * 2, m.tam * 0.98);
          else ctx.fillRect(cx - pad, base - m.tam * 0.36, it.w + junta + pad * 2, m.tam * 0.44);
        }
        ctx.font = fonte(l, it.e, m.tam); ctx.fillStyle = it.e === "a" ? cores.a : it.e === "b" ? cores.b : cores.n; ctx.fillText(it.t, cx, base); cx += it.w;
      });
    });
  }

  /* ---------- Desenho de cada camada; devolve a caixa (pra selecionar) ---------- */
  const TEXTOS = ["texto", "bolha", "pilula", "bilhete"];
  function textoDe(l, i, n) {
    if (l.auto === "num") return l.numDois ? `${String(i + 1).padStart(2, "0")}/${String(n).padStart(2, "0")}` : `${i + 1}/${n}`;
    return l.texto;
  }
  function desenharCamada(ctx, l, tema, s, i, n, aoCarregar) {
    ctx.save(); ctx.letterSpacing = "0px"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    let caixa = null;
    const girarEm = (c, desenho) => {
      if (l.rot) { const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; ctx.translate(cx, cy); ctx.rotate((l.rot * Math.PI) / 180); ctx.translate(-cx, -cy); }
      desenho();
    };
    if (l.t === "forma") {
      caixa = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h };
      ctx.fillStyle = cor(tema, l.cor || "vidro");
      if (l.forma === "circulo") { ctx.beginPath(); ctx.ellipse(l.x + l.w / 2, l.y + l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(l.x, l.y, l.w, l.h);
      if (l.texto) { ctx.fillStyle = cor(tema, l.corTexto || "naOuro"); ctx.font = `800 ${l.tam || 32}px ${FONTE_BASTAO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(l.texto, l.x + l.w / 2, l.y + l.h / 2 + 2); }
    } else if (l.t === "linha") {
      caixa = { x0: l.x, y0: l.y - 8, x1: l.x + l.w, y1: l.y + 8 };
      ctx.strokeStyle = cor(tema, l.cor || "tinta"); ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.w, l.y); ctx.stroke();
    } else if (l.t === "foto") {
      caixa = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h };
      const img = fotoCarrossel(s.foto, aoCarregar), foco = { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3;
      const arco = (b) => { ctx.beginPath(); ctx.moveTo(l.x - b, l.y + l.h + b); ctx.lineTo(l.x - b, l.y + l.w / 2); ctx.arc(l.x + l.w / 2, l.y + l.w / 2, l.w / 2 + b, Math.PI, 0); ctx.lineTo(l.x + l.w + b, l.y + l.h + b); ctx.closePath(); };
      if (l.forma === "arco" && l.borda) { arco(14); ctx.fillStyle = cor(tema, l.borda); ctx.fill(); }
      if (l.forma === "arco") { arco(0); ctx.clip(); }
      if (l.pb) ctx.filter = "grayscale(1) contrast(1.05)";
      fotoCobre(ctx, img, l.x, l.y, l.w, l.h, foco);
    } else {
      const lt = { ...l, texto: textoDe(l, i, n) };
      const m = montar(ctx, lt);
      if (l.t === "texto") {
        caixa = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + m.alt };
        const marca = l.marca ? { marca: tema.marca, marcaTipo: tema.marcaTipo } : {};
        girarEm(caixa, () => escrever(ctx, lt, m, l.x, l.y, l.w, { n: cor(tema, l.cor || "texto"), a: l.marca ? tema.naMarca : cor(tema, l.corDestaque || "ouro"), b: cor(tema, l.corNegrito || "cinza"), ...marca }, l.alinhar));
      } else if (l.t === "bolha") {
        const px = 34, py = 24, bw = Math.min(m.larg, l.w) + px * 2, bh = m.alt + py * 2;
        const x0 = l.eu ? l.x + l.w + px * 2 - bw : l.x;
        caixa = { x0, y0: l.y, x1: x0 + bw, y1: l.y + bh };
        const fundo = l.eu ? cor(tema, "ouro") : cor(tema, "balao");
        retanguloRedondo(ctx, x0, l.y, bw, bh, 36, fundo);
        ctx.fillStyle = fundo; ctx.beginPath();
        if (l.eu) { ctx.moveTo(x0 + bw - 30, l.y + bh - 30); ctx.lineTo(x0 + bw + 16, l.y + bh + 6); ctx.lineTo(x0 + bw - 58, l.y + bh - 4); }
        else { ctx.moveTo(x0 + 30, l.y + bh - 30); ctx.lineTo(x0 - 16, l.y + bh + 6); ctx.lineTo(x0 + 58, l.y + bh - 4); }
        ctx.fill();
        const tc = l.eu ? cor(tema, "naOuro") : cor(tema, "tinta");
        escrever(ctx, lt, m, x0 + px, l.y + py, bw - px * 2, { n: tc, a: l.eu ? tc : cor(tema, "ouro"), b: tc }, "left");
      } else if (l.t === "bilhete") { // papel colado com fita, sempre claro
        const pad = Math.round(m.tam * 0.9), bw = Math.min(l.w, m.larg + pad * 2), bh = m.alt + pad * 2;
        caixa = { x0: l.x, y0: l.y, x1: l.x + bw, y1: l.y + bh };
        girarEm(caixa, () => {
          caixaPapel(ctx, l.x, l.y, bw, bh, 6, "#FFFDF8", true);
          ctx.save(); ctx.translate(l.x + bw * 0.32, l.y + 4); ctx.rotate(-0.14); ctx.fillStyle = "rgba(217,196,138,.88)"; ctx.fillRect(-70, -20, 140, 40); ctx.restore();
          escrever(ctx, lt, m, l.x + pad, l.y + pad, bw - pad * 2, { n: "#2B241C", a: "#7A6322", b: "#2B241C" }, "left");
        });
      } else if (l.t === "pilula") {
        const bw = m.larg + m.tam * 1.4, bh = m.alt + m.tam * 0.5, x0 = l.x + (l.w - bw) / 2;
        caixa = { x0, y0: l.y, x1: x0 + bw, y1: l.y + bh };
        retanguloRedondo(ctx, x0, l.y, bw, bh, bh / 2, cor(tema, "ouro"));
        const tc = cor(tema, "naOuro");
        escrever(ctx, lt, m, x0, l.y + m.tam * 0.25, bw, { n: tc, a: tc, b: tc }, "center");
      }
    }
    ctx.restore();
    return caixa;
  }

  /* ---------- Fundo do slide ---------- */
  function fundo(ctx, car, s, tema, W, H, aoCarregar) {
    ctx.save(); ctx.fillStyle = tema.fundo; ctx.fillRect(0, 0, W, H);
    if (car.estilo === "direto") texturaPapel(ctx, tema.tom === "escuro" ? 0.1 : 0.07);
    else if (tema.tom === "foto") {
      const img = fotoCarrossel(s.foto, aoCarregar), foco = { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3;
      ctx.save(); if (car.estilo === "bastidor") ctx.filter = "grayscale(1) contrast(1.08)"; fotoCobre(ctx, img, 0, 0, W, H, foco); ctx.restore();
      const g = ctx.createLinearGradient(0, H * 0.25, 0, H); g.addColorStop(0, "rgba(10,8,6,0)"); g.addColorStop(0.55, "rgba(10,8,6,.72)"); g.addColorStop(1, "rgba(10,8,6,.94)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const g2 = ctx.createLinearGradient(0, 0, 0, 260); g2.addColorStop(0, "rgba(10,8,6,.55)"); g2.addColorStop(1, "rgba(10,8,6,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 260);
      texturaPapel(ctx, 0.08);
    } else {
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.45, 900);
      g.addColorStop(0, tema.tom === "escuro" ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, tema.tom === "escuro" ? 0.14 : 0.12);
    }
    ctx.restore();
  }

  /* ---------- O slide nasce dos campos, no estilo, dentro da borda ---------- */
  const novoId = () => Math.random().toString(36).slice(2, 9);
  const T = (nome, texto, o = {}) => ({ id: novoId(), nome, t: "texto", texto: String(texto || ""), x: M, y: 0, w: 920, tam: 40, fonte: "sans", peso: 500, cor: "texto", alinhar: "left", letra: 0, entre: 1.3, rot: 0, ...o });
  const linhasDe = (v) => String(v || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const par = (l) => { const k = l.indexOf(" / "); return k < 0 ? [l, ""] : [l.slice(0, k).trim(), l.slice(k + 3).trim()]; };
  let medidor = null;
  const ctxMedir = () => (medidor = medidor || document.createElement("canvas").getContext("2d"));

  function gerar(car, i) {
    const ctx = ctxMedir();
    const s = car.slides[i], n = car.slides.length, { w: W, h: H } = dims(car), e = car.estilo || "bastidor";
    const tema = temaDe(car, s), L = [], mold = { moldura: true };
    // Capa no quadrado: o perfil mostra só o meio (3:4), então o texto fica longe das laterais
    const capa = i === 0 && W === H, xC = capa ? 160 : M, wC = W - 2 * xC;
    if (e === "direto") return gerarDireto(car, i, s, n, W, H, tema, ctx);
    let topo = M + 100;
    if (e === "conversa") {
      const nome = String(s.tipo === "recompensa" ? "Notas do Ryan" : s.lead || "Marca");
      L.push({ id: novoId(), nome: "Faixa do topo", t: "forma", forma: "ret", x: 0, y: 0, w: W, h: 196, cor: "vidro", ...mold });
      L.push({ id: novoId(), nome: "Bolinha do contato", t: "forma", forma: "circulo", x: M, y: 82, w: 72, h: 72, cor: "ouro", texto: (nome[0] || "M").toUpperCase(), tam: 32, corTexto: "naOuro", ...mold });
      L.push(T("Nome do contato", nome, { x: M + 92, y: 80, w: 560, tam: 30, peso: 700, cor: "tinta", entre: 1.2, ...mold }));
      L.push(T("Online", "online", { x: M + 92, y: 120, w: 300, tam: 22, cor: "cinza", entre: 1.2, ...mold }));
      L.push(T("Número do slide", "", { auto: "num", x: W - M - 200, y: 100, w: 200, tam: 24, peso: 700, cor: "tinta", alinhar: "right", entre: 1.2, ...mold }));
      topo = 250;
    } else {
      if (e !== "fotos") L.push(T("Assinatura do topo", e === "bastidor" ? "RYAN ALVES  ·  UGC CREATOR" : "DE CREATOR PRA CREATOR", { y: M, w: 640, tam: 22, peso: 600, letra: 2, cor: "tinta", entre: 1.2, ...mold }));
      L.push(T("Número do slide", "", { auto: "num", numDois: e === "bastidor", x: W - M - 200, y: M, w: 200, tam: 24, peso: 700, cor: "tinta", alinhar: "right", entre: 1.2, ...mold }));
      if (e === "revista") L.push({ id: novoId(), nome: "Linha do topo", t: "linha", x: M, y: M + 46, w: W - 2 * M, cor: "tinta", ...mold });
    }
    L.push(T("Arroba", "@ryalvz", { y: H - M - 28, w: 300, tam: 22, cor: "cinza", entre: 1.2, ...mold }));
    L.push(T("Arrasta pro lado", "arrasta pro lado  →", { auto: "arrasta", x: W - M - 360, y: H - M - 28, w: 360, tam: 22, cor: "cinza", alinhar: "right", entre: 1.2, ...mold }));
    let fim = H - M - 70;

    // Conteúdo
    const C = [], centro = s.tipo === "cta" || (e !== "conversa" && ["tensao", "recompensa"].includes(s.tipo)), al = centro ? "center" : "left";
    let ancora = tema.tom === "foto" ? "baixo" : "meio";
    if (e === "revista" && s.tipo === "gancho") {
      L.push({ id: novoId(), nome: "Foto", t: "foto", forma: "arco", pb: true, x: W - M - 360, y: H - M - 90 - (W === H ? 430 : 560), w: 360, h: W === H ? 430 : 560 });
      ancora = "topo";
    }
    if (e === "fotos" && s.tipo === "cta") {
      const fh = W === H ? 360 : 520;
      L.push({ id: novoId(), nome: "Foto", t: "foto", x: (W - 460) / 2, y: topo, w: 460, h: fh });
      topo += fh + 50; ancora = "topo";
    }
    if (s.lead && e !== "conversa") C.push(T(e === "fotos" ? "Etapa" : "Linha fina", s.lead, { tam: 28, peso: 700, letra: 2, cor: "ouro", alinhar: al, entre: 1.25, gap: 22 }));
    if (s.titulo) C.push(T("Título", s.titulo, { fonte: e === "bastidor" && s.tipo !== "gancho" ? "sans" : "serif", peso: 800, tam: s.tipo === "gancho" ? 88 : 68, cor: "tinta", alinhar: al, entre: 1.08, gap: 40 }));
    linhasDe(s.msgs).slice(0, 3).forEach((l) => {
      const m = l.match(/^\s*(eu|ryan|eu mesmo)\s*:\s*(.*)$/i), o = l.match(/^\s*[^:]{1,20}:\s*(.*)$/);
      C.push({ id: novoId(), nome: m ? "Mensagem sua" : "Mensagem da marca", t: "bolha", eu: !!m, texto: m ? m[2] : o ? o[1] : l, x: M, w: 600, tam: 34, fonte: "sans", peso: 500, cor: "tinta", entre: 1.3, letra: 0, alinhar: "left", gap: 20 });
    });
    const itens = linhasDe(s.itens).slice(0, 4);
    if (itens.length) C.push(T("Lista", itens.map((l, k) => { const [a, b] = par(l); return `${k + 1}. ${a.replace(/\*/g, "")}${b ? ` **${b.replace(/\*/g, "")}**` : ""}`; }).join("\n"), { tam: 34, peso: 700, cor: "tinta", alinhar: al, entre: 1.55 }));
    if (s.texto) C.push(T("Texto", s.texto, { tam: 34, cor: "texto", alinhar: al, entre: 1.4 }));
    if (s.palavra) {
      if (!s.titulo) C.push(T("Chamada", "Comenta", { fonte: "serif", tam: 60, cor: "tinta", alinhar: "center", entre: 1.1, gap: 26 }));
      C.push({ id: novoId(), nome: "Palavra", t: "pilula", texto: String(s.palavra).replace(/\*/g, "").toUpperCase(), x: M, w: W - 2 * M, tam: 64, fonte: "sans", peso: 800, cor: "naOuro", entre: 1.1, letra: 2, alinhar: "center", gap: 30 });
    }
    // Largura e posição de cada um, depois empilha no meio (ou embaixo, quando tem foto)
    const wConteudo = e === "revista" && s.tipo === "gancho" ? Math.min(wC, 540) : wC;
    C.forEach((l) => {
      if (l.t === "texto" || l.t === "pilula") { l.x = xC; l.w = wConteudo; }
      else if (l.t === "bolha") { l.w = Math.min(600, wC - 80); l.x = l.eu ? W - xC - (l.w + 68) : xC; }
    });
    const medir = (l) => { const m = montar(ctx, l); return l.t === "bolha" ? m.alt + 48 : l.t === "pilula" ? m.alt + m.tam * 0.5 : m.alt; };
    const orig = C.map((l) => l.tam);
    let alturas = [], total = 0, k = 1;
    const calc = () => { alturas = C.map(medir); total = alturas.reduce((a, b) => a + b, 0) + C.slice(0, -1).reduce((a, l) => a + (l.gap ?? 34), 0); };
    calc();
    while (total > fim - topo && k > 0.55) { k *= 0.92; C.forEach((l, j) => { l.tam = Math.max(18, Math.round(orig[j] * k)); }); calc(); }
    let y = ancora === "baixo" ? fim - total : ancora === "topo" ? topo : topo + Math.max(0, (fim - topo - total) * 0.45);
    const yIni = y;
    C.forEach((l, j) => { l.y = Math.round(y); y += alturas[j] + (l.gap ?? 34); delete l.gap; });
    const yFim = y;
    L.push(...C);
    if (s.nota) {
      const nl = T("Nota à mão", s.nota, { fonte: "mao", tam: 74, cor: "ouro", rot: -5, entre: 1.1, w: 3000 });
      const vai = s.notaContinua === true && i < n - 1;
      let m = montar(ctx, nl);
      // Numa linha só: se não continua no próximo slide, a letra diminui até caber na borda
      while (!vai && m.larg > W - 2 * M && nl.tam > 40) { nl.tam -= 4; m = montar(ctx, nl); }
      nl.w = Math.ceil(m.larg) + 12;
      const inclina = Math.abs(Math.sin((nl.rot * Math.PI) / 180)) * Math.min(nl.w, W) / 2; // a nota é inclinada: as pontas sobem e descem
      if (ancora === "baixo") { nl.x = xC; nl.y = Math.max(topo - 40, Math.round(yIni - m.alt - 24 - inclina)); }
      else { nl.x = W - M - nl.w; nl.y = Math.min(fim - 40, Math.round(yFim - 10 + inclina)); }
      if (vai) { nl.x = Math.round(W - nl.w * 0.55); nl.continua = true; }
      else if (nl.x < M) { nl.x = M; nl.w = W - 2 * M; }
      L.push(nl);
    }
    return L;
  }

  /* ---------- Direto: letra gigante e apertada, uma frase por slide, bilhete e marca-texto ---------- */
  function gerarDireto(car, i, s, n, W, H, tema, ctx) {
    const L = [], mold = { moldura: true }, capa = i === 0 && W === H, xC = capa ? 160 : M, wC = W - 2 * xC;
    const G = (nome, texto, o) => T(nome, texto, { fonte: "grot", ...o });
    L.push(G("Etiqueta do topo", s.lead || "bastidor de ugc", { x: xC, y: M, w: 640, tam: 24, peso: 500, cor: "cinza", entre: 1.2, ...mold }));
    L.push(G("Número do slide", "", { auto: "num", numDois: true, x: W - M - 200, y: M, w: 200, tam: 24, peso: 800, cor: "tinta", alinhar: "right", entre: 1.2, ...mold }));
    L.push(G("Arroba", "@ryalvz", { y: H - M - 28, w: 300, tam: 22, cor: "cinza", entre: 1.2, ...mold }));
    L.push(G("Arrasta pro lado", "arrasta pro lado  →", { auto: "arrasta", x: W - M - 360, y: H - M - 28, w: 360, tam: 22, cor: "cinza", alinhar: "right", entre: 1.2, ...mold }));
    const topo = M + 80, fim = H - M - 60;
    const titulo = (tam, w) => G("Título", s.titulo, { x: xC, w, tam, peso: 900, cor: "tinta", corNegrito: "tinta", marca: true, entre: 0.94, letra: -Math.round(tam * 0.045) });
    const caber = (l, alt, min = 48) => { const t0 = l.tam; while (montar(ctx, l).alt > alt && l.tam > min) { l.tam -= 4; l.letra = -Math.round(l.tam * 0.045); } return l.tam !== t0 ? l : l; };
    const nota = (txt, o) => T("Nota à mão", txt, { fonte: "marcador", tam: 76, cor: "ouro", rot: -5, entre: 1.05, ...o });

    if (s.tipo === "gancho") {
      // Capa: a frase grande em cima e a sua foto num arco com borda, embaixo à direita
      const fw = W === H ? 330 : 400, fh = W === H ? 420 : 560;
      const fx = W - xC - fw, fy = fim - fh;
      if (s.titulo) { const t = caber(titulo(W === H ? 120 : 132, wC), fy - topo - 30, 64); t.y = topo; L.push(t); }
      L.push({ id: novoId(), nome: "Foto", t: "foto", forma: "arco", borda: "tinta", x: fx, y: fy, w: fw, h: fh });
      if (s.nota) { const nl = nota(s.nota, { tam: 76, x: xC, w: Math.max(200, fx - xC - 30) }); const m = montar(ctx, nl); nl.y = Math.round(fim - m.alt - 20); L.push(nl); }
      return L;
    }
    // Os outros slides: frase grande no topo, apoio embaixo
    const C = [];
    const msgs = String(s.msgs || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 2);
    msgs.forEach((l) => {
      const m = l.match(/^\s*(eu|ryan|eu mesmo)\s*:\s*(.*)$/i), o = l.match(/^\s*[^:]{1,20}:\s*(.*)$/);
      C.push({ id: novoId(), nome: m ? "Mensagem sua" : "Mensagem da marca", t: "bolha", eu: !!m, texto: m ? m[2] : o ? o[1] : l, x: xC, w: Math.min(640, wC - 80), tam: 42, fonte: "grot", peso: 500, cor: "tinta", entre: 1.3, letra: 0, alinhar: "left", gap: 28 });
    });
    // A frase começa enorme e diminui até caber: com apoio embaixo ela fica com uns 60% da altura, sozinha com quase tudo
    if (s.titulo) {
      const t = titulo(156, wC), sozinha = !s.texto && !s.itens && !s.msgs && !s.nota && s.tipo !== "cta";
      caber(t, (fim - topo) * (sozinha ? 0.8 : 0.58), 52); C.push({ ...t, gap: 44 });
    }
    const itens = String(s.itens || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 4);
    if (itens.length) C.push({ ...G("Bilhete", itens.map((x, k) => `${k + 1}. ${x.replace(/\s+\/\s+/, ": ")}`).join("\n"), { t: "bilhete", x: xC + 10, w: Math.min(640, wC - 20), tam: 46, peso: 500, cor: "tinta", entre: 1.45, rot: -3 }), gap: 34 });
    let botao = null;
    if (s.tipo === "cta") {
      if (s.palavra) {
        C.push({ ...G("Chamada", "comenta", { tam: 44, peso: 800, cor: "tinta", entre: 1.1 }), gap: 18 });
        botao = { id: novoId(), nome: "Palavra", t: "pilula", texto: String(s.palavra).replace(/\*/g, "").toUpperCase(), x: xC, w: 0, tam: 60, fonte: "grot", peso: 900, cor: "naOuro", entre: 1.1, letra: 1, alinhar: "center", gap: 26 };
        C.push(botao);
        if (s.texto) C.push(G("Texto", s.texto, { tam: 40, peso: 500, cor: "texto", corNegrito: "tinta", entre: 1.3 }));
      } else if (s.texto) {
        botao = { id: novoId(), nome: "Botão", t: "pilula", texto: String(s.texto).replace(/\*/g, ""), x: xC, w: 0, tam: 44, fonte: "grot", peso: 800, cor: "naOuro", entre: 1.1, letra: 0, alinhar: "center" };
        C.push(botao);
      }
    } else if (s.texto) C.push(G("Texto", s.texto, { tam: 46, peso: 500, cor: "texto", corNegrito: "tinta", entre: 1.28, w: Math.min(wC, 820) }));
    // Tamanho: diminui o título até tudo caber entre o topo e o rodapé
    const alturaDe = (l) => { const m = montar(ctx, l); return l.t === "bolha" ? m.alt + 48 : l.t === "pilula" ? m.alt + m.tam * 0.5 : l.t === "bilhete" ? m.alt + Math.round(m.tam * 1.8) : m.alt; };
    const soma = () => C.reduce((a, l, k) => a + alturaDe(l) + (k < C.length - 1 ? l.gap ?? 34 : 0), 0);
    C.forEach((l) => { if (l.t === "pilula") l.w = wC; });
    const tit = C.find((l) => l.nome === "Título");
    while (soma() > fim - topo && tit && tit.tam > 52) { tit.tam -= 4; tit.letra = -Math.round(tit.tam * 0.045); }
    while (soma() > fim - topo && C.some((l) => l.tam > 26 && l !== tit)) C.forEach((l) => { if (l !== tit) l.tam = Math.max(24, l.tam - 2); });
    const larguraPilula = (l) => { l.w = wC; const m = montar(ctx, l); l.w = Math.ceil(m.larg + m.tam * 1.4); };
    C.forEach((l) => { if (l.t === "pilula") larguraPilula(l); });
    // Onde fica: tensão e CTA embaixo; o resto começa no topo, e o texto de apoio desce pro rodapé
    const total = soma();
    let y = s.tipo === "tensao" || s.tipo === "cta" ? fim - total : topo;
    C.forEach((l, k) => { l.y = Math.round(y); y += alturaDe(l) + (l.gap ?? 34); delete l.gap; });
    const ultimo = C[C.length - 1];
    if (ultimo && ultimo.nome === "Texto" && s.tipo !== "cta" && s.tipo !== "tensao") ultimo.y = Math.max(ultimo.y, Math.round(fim - alturaDe(ultimo)));
    L.push(...C);
    if (s.nota) {
      const nl = nota(s.nota, { w: 3000 });
      let m = montar(ctx, nl);
      while (m.larg > wC * 0.75 && nl.tam > 40) { nl.tam -= 4; m = montar(ctx, nl); }
      nl.w = Math.ceil(m.larg) + 12; nl.x = W - xC - nl.w;
      const ocupado = C.filter((l) => l.nome !== "Texto").reduce((a, l) => Math.max(a, l.y + alturaDe(l)), topo);
      const temTexto = ultimo && ultimo.nome === "Texto";
      nl.y = Math.round(Math.min(fim - m.alt - (temTexto ? alturaDe(ultimo) + 40 : 10), Math.max(ocupado + 30, fim - m.alt - 140)));
      L.push(nl);
    }
    return L;
  }

  // As camadas do slide: nascem dos campos e só refazem sozinhas enquanto ninguém mexeu à mão
  const fontesProntas = () => { try { return document.fonts.check(`700 60px ${FONTE_SERIFA}`) && document.fonts.check(`500 40px ${FONTE_BASTAO}`) && document.fonts.check(`400 60px ${FONTE_MAO}`) && document.fonts.check(`900 60px ${FONTE_GROT}`) && document.fonts.check(`400 60px ${FONTE_MARCADOR}`); } catch (_) { return true; } };
  const baseDe = (car, s, i) => JSON.stringify([car.estilo, car.formato || "quadrado", i === 0, s.tipo, s.fundo || "", s.titulo, s.texto, s.lead, s.itens, s.msgs, s.palavra, s.nota, s.notaContinua]);
  function garantir(car, i) {
    const s = car.slides[i]; if (!s) return [];
    const b = baseDe(car, s, i), prontas = fontesProntas();
    if (Array.isArray(s.camadas) && (s.camadasEditadas || (s.camadasBase === b && (s.camadasFontes || !prontas)))) return s.camadas;
    s.camadas = gerar(car, i); s.camadasBase = b; s.camadasFontes = prontas;
    return s.camadas;
  }

  function guias(ctx, W, H, i) {
    ctx.save();
    ctx.setLineDash([16, 10]); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(226,78,60,.9)"; ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
    ctx.setLineDash([]); ctx.font = `700 20px ${FONTE_BASTAO}`; ctx.letterSpacing = "0px"; ctx.textBaseline = "bottom"; ctx.textAlign = "left";
    ctx.fillStyle = "rgba(226,78,60,.95)"; ctx.fillText("borda de segurança", M + 6, M - 8);
    if (i === 0 && W === H) {
      const c = (W - H * 0.75) / 2;
      ctx.setLineDash([8, 10]); ctx.strokeStyle = "rgba(60,120,226,.9)"; ctx.lineWidth = 3;
      [c, W - c].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); });
      ctx.fillStyle = "rgba(60,120,226,.95)"; ctx.textBaseline = "top"; ctx.fillText("o que aparece na grade do perfil", c + 8, H - M + 12);
    }
    ctx.restore();
  }

  function pintar(cv, car, i, { guia = false, aoCarregar = null } = {}) {
    const { w: W, h: H } = dims(car), s = car.slides[i], n = car.slides.length;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"), tema = temaDe(car, s), camadas = garantir(car, i);
    fundo(ctx, car, s, tema, W, H, aoCarregar);
    // O que passa da borda direita do slide anterior continua aqui (efeito de arrastar)
    if (i > 0) {
      // Com as cores deste slide, pra continuar legível se o fundo mudar de claro pra escuro
      const ant = car.slides[i - 1];
      garantir(car, i - 1).filter((l) => l.continua && !l.oculto).forEach((l) => { ctx.save(); ctx.translate(-W, 0); desenharCamada(ctx, l, tema, ant, i - 1, n, aoCarregar); ctx.restore(); });
    }
    const caixas = [];
    camadas.forEach((l) => {
      if (l.oculto || (l.auto === "arrasta" && i === n - 1)) return;
      const c = desenharCamada(ctx, l, tema, s, i, n, aoCarregar);
      if (c) caixas.push({ id: l.id, ...c });
    });
    if (guia) guias(ctx, W, H, i);
    cv.__caixas = caixas;
  }

  // Camadas que passam da borda de segurança (a que continua no próximo slide pode passar pela direita)
  function foraDaBorda(car, i, cv) {
    const { w: W, h: H } = dims(car), lista = garantir(car, i);
    return (cv.__caixas || []).filter((b) => {
      const l = lista.find((x) => x.id === b.id);
      if (!l || l.t === "forma" || l.t === "linha") return false;
      return b.x0 < M - 2 || b.y0 < M - 2 || b.y1 > H - M + 2 || (!l.continua && b.x1 > W - M + 2);
    }).map((b) => b.id);
  }
  function palavras(camadas) {
    return camadas.filter((l) => !l.oculto && !l.moldura && TEXTOS.includes(l.t)).map((l) => String(l.texto || "")).join(" ").replace(/\*/g, "").split(/\s+/).filter(Boolean).length;
  }
  const medir = (l) => { const m = montar(ctxMedir(), l); return { larg: m.larg, alt: m.alt }; };
  return { M, FORMATOS, TEXTOS, dims, pintar, garantir, gerar, foraDaBorda, palavras, novoId, medir, texto: T, temaDe };
})();
