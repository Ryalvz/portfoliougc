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
  // Papel (referência Lara Dam): papel creme, título café e caramelo, caixa caramelo com destaque amarelo
  const BASE_PAPEL = { tinta: "#3A2618", texto: "#4A3424", cinza: "#8A7A68", ouro: "#8A5A35", naOuro: "#FBF4E8", vidro: "rgba(58,38,24,.06)", balao: "#FFFFFF", marca: "", naMarca: "#8A5A35", marcaTipo: "",
    faixa: "#8E6A48", amarelo: "#FFE9A0", laranja: "#E07A55", branco: "#FFFFFF", caixa: "#8E6A48", naCaixa: "#FBF4E8", cartao: "#FFFFFF" };
  TEMAS.papel = { ...BASE_PAPEL, fundo: "#EEE8DE" };
  TEMAS.papelFoto = { ...BASE_PAPEL, fundo: "#2B1D13", tinta: "#FFFFFF", texto: "#FFFFFF", cinza: "rgba(255,255,255,.8)" };
  // Colagem: fundo chapado (café, creme, caramelo), letra gigante, marca-texto amarelo em bloco
  const BASE_COL = { amarelo: "#F2D46B", laranja: "#E07A55", branco: "#FFFFFF", marcaTipo: "bloco", marca: "#F2D46B", naMarca: "#231A13", naOuro: "#231A13", vidro: "rgba(0,0,0,.08)" };
  TEMAS.colEscuro = { ...BASE_COL, fundo: "#231A13", tinta: "#F6EEDF", texto: "#E9DFCC", cinza: "#B3A68F", ouro: "#F2D46B", balao: "#3A2C20" };
  TEMAS.colClaro = { ...BASE_COL, fundo: "#F3EBDD", tinta: "#231A13", texto: "#3A2C20", cinza: "#8A7C66", ouro: "#B9783F", balao: "#E4D8C3", naOuro: "#F3EBDD" };
  TEMAS.colTerra = { ...BASE_COL, fundo: "#B9783F", tinta: "#FFF6E6", texto: "#FFF1DA", cinza: "#F2DDBF", ouro: "#231A13", balao: "#A2652F", marca: "#231A13", naMarca: "#F2D46B", naOuro: "#F2D46B" };
  const SEQ_COLAGEM = ["colEscuro", "colClaro", "colEscuro", "colTerra", "colEscuro", "colClaro", "colTerra"];
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
    if (car.estilo === "papel") t = s.tipo === "gancho" ? "papelFoto" : "papel";
    if (car.estilo === "colagem") { const k = Math.max(0, (car.slides || []).indexOf(s)), n = (car.slides || []).length; t = k === n - 1 && n > 1 ? "colTerra" : SEQ_COLAGEM[k % SEQ_COLAGEM.length]; if (s.fundo === "trocar") return t === "colEscuro" ? "colClaro" : "colEscuro"; }
    if (car.estilo === "papel" && s.fundo === "trocar") return t === "papel" ? "colEscuro" : t;
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
    if (l.fonte === "mont") return `${e === "n" ? l.peso || 500 : Math.max(800, l.peso || 500)} ${tam}px ${FONTE_BASTAO}`;
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
      if (cores.faixaLinha && ln.w) { const pad = m.tam * 0.22; ctx.fillStyle = cores.faixaLinha; ctx.fillRect(cx - pad, base - m.tam * 0.86, ln.w + pad * 2, m.tam * 1.12); }
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
  const TEXTOS = ["texto", "bolha", "pilula", "bilhete", "caixa", "aviso", "cartao", "selo", "stat"];
  const ENFEITES = ["forma", "linha", "enfeite", "seta"];
  const caminhoRedondo = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const sombra = (ctx, forca = 0.22, blur = 34, dy = 14) => { ctx.shadowColor = `rgba(58,38,24,${forca})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy; };
  const semSombra = (ctx) => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
  // Número fixo por camada, pra o enfeite não mudar a cada desenho
  const semente = (id) => { let h = 7; String(id).split("").forEach((c) => { h = (h * 31 + c.charCodeAt(0)) % 9973; }); return () => { h = (h * 9301 + 49297) % 233280; return h / 233280; }; };
  // Medidas das camadas com caixa em volta (o gerador usa as mesmas pra empilhar)
  function medidaCaixa(ctx, l) {
    if (l.t === "caixa") { const px = Math.round(l.tam * 1.1), py = Math.round(l.tam * 0.8); const m = montar(ctx, { ...l, w: l.w - px * 2 }); return { m, px, py, bw: Math.min(l.w, Math.ceil(m.larg) + px * 2), bh: Math.ceil(m.alt) + py * 2 }; }
    if (l.t === "aviso") { const ic = Math.round(l.tam * 2.3), pad = Math.round(l.tam * 0.85), tw = l.w - pad * 2 - ic - 24; const m = montar(ctx, { ...l, w: tw }); const th = l.tam * 1.35; return { m, ic, pad, tw, bw: l.w, bh: Math.ceil(Math.max(ic, th + m.alt)) + pad * 2, th }; }
    if (l.t === "cartao") { const pad = Math.round(l.tam * 0.95), nw = Math.round(l.tam * 1.5), tw = l.w - pad * 2 - nw; const m = montar(ctx, { ...l, w: tw }); const ms = l.sub ? montar(ctx, { ...l, texto: l.sub, tam: Math.round(l.tam * 0.78), peso: 500, w: tw }) : null; return { m, ms, pad, nw, tw, bw: l.w, bh: Math.ceil(m.alt + (ms ? ms.alt + l.tam * 0.35 : 0)) + pad * 2 }; }
    if (l.t === "stat") { const pad = 30, rt = 26; const m = montar(ctx, l); return { m, pad, rt, bw: l.w, bh: Math.ceil(m.alt + rt * 1.6) + pad * 2 }; }
    return null;
  }
  function desenharEspecial(ctx, l, tema, s, i, n, aoCarregar) {
    const girar0 = (c, f) => { if (l.rot) { const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; ctx.translate(cx, cy); ctx.rotate((l.rot * Math.PI) / 180); ctx.translate(-cx, -cy); } f(); };
    if (l.t === "enfeite") {
      const c = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.w }, cx = l.x + l.w / 2, cy = l.y + l.w / 2, rnd = semente(l.id);
      ctx.fillStyle = ctx.strokeStyle = cor(tema, l.cor || "laranja");
      if (l.forma === "brilho") { // estrela de 4 pontas
        const r = l.w / 2; ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.quadraticCurveTo(cx, cy, cx + r, cy); ctx.quadraticCurveTo(cx, cy, cx, cy + r); ctx.quadraticCurveTo(cx, cy, cx - r, cy); ctx.quadraticCurveTo(cx, cy, cx, cy - r); ctx.fill();
      } else { // estrela de traços, feita à mão
        const raios = 9, r0 = l.w * 0.1; ctx.lineCap = "round"; ctx.lineWidth = l.w * 0.075;
        for (let k = 0; k < raios; k++) { const a = (k / raios) * Math.PI * 2 + rnd() * 0.25, r = l.w * (0.32 + rnd() * 0.18); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
      }
      return c;
    }
    if (l.t === "seta") { // seta desenhada à mão
      const c = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h };
      const [x1, y1, x2, y2] = l.vira ? [l.x + l.w, l.y + l.h, l.x, l.y] : [l.x, l.y + l.h, l.x + l.w, l.y];
      ctx.strokeStyle = cor(tema, l.cor || "amarelo"); ctx.lineWidth = 7; ctx.lineCap = ctx.lineJoin = "round";
      const qx = (x1 + x2) / 2 + (y2 - y1) * 0.35, qy = (y1 + y2) / 2 - (x2 - x1) * 0.35;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(qx, qy, x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - qy, x2 - qx);
      ctx.beginPath(); ctx.moveTo(x2 - 40 * Math.cos(a - 0.5), y2 - 40 * Math.sin(a - 0.5)); ctx.lineTo(x2, y2); ctx.lineTo(x2 - 40 * Math.cos(a + 0.5), y2 - 40 * Math.sin(a + 0.5)); ctx.stroke();
      return c;
    }
    if (l.t === "janela") { // print de verdade numa janelinha com sombra
      const c = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.h }, r = 28, barra = l.barra ? 46 : 0;
      ctx.save(); sombra(ctx); caminhoRedondo(ctx, l.x, l.y, l.w, l.h, r); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
      ctx.save(); caminhoRedondo(ctx, l.x, l.y, l.w, l.h, r); ctx.clip();
      if (barra) { ctx.fillStyle = cor(tema, "tinta") === "#FFFFFF" ? "#2B1D13" : "#2B1D13"; ctx.fillRect(l.x, l.y, l.w, barra); ["#E9695B", "#F2C14E", "#7CC46B"].forEach((k, j) => { ctx.fillStyle = k; ctx.beginPath(); ctx.arc(l.x + 30 + j * 26, l.y + barra / 2, 7, 0, Math.PI * 2); ctx.fill(); }); }
      const img = fotoCarrossel(l.foto === "foto2" ? s.foto2 : s.foto, aoCarregar);
      if (img) fotoCobre(ctx, img, l.x, l.y + barra, l.w, l.h - barra, { topo: 0.05, meio: 0.45, baixo: 0.85 }[s.enquadrar] ?? 0.1);
      else { ctx.fillStyle = "#F4EFE7"; ctx.fillRect(l.x, l.y + barra, l.w, l.h - barra); ctx.fillStyle = "#A99A86"; ctx.font = `600 30px ${FONTE_BASTAO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("seu print aqui", l.x + l.w / 2, l.y + barra + (l.h - barra) / 2); }
      ctx.restore();
      return c;
    }
    if (l.t === "polaroid") { // foto com moldura branca e fita
      const pad = Math.round(l.w * 0.06), pe = Math.round(l.w * 0.2), c = { x0: l.x - pad, y0: l.y - pad, x1: l.x + l.w + pad, y1: l.y + l.h + pe };
      girar0(c, () => {
        ctx.save(); sombra(ctx, 0.35, 30, 12); ctx.fillStyle = "#FFFDF8"; ctx.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0); ctx.restore();
        ctx.save(); if (l.pb) ctx.filter = "grayscale(1) contrast(1.06)"; fotoCobre(ctx, fotoCarrossel(s.foto, aoCarregar), l.x, l.y, l.w, l.h, { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3); ctx.restore();
        if (l.texto) { ctx.font = `400 ${Math.round(pe * 0.55)}px ${FONTE_MARCADOR}`; ctx.fillStyle = "#3A2C20"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(l.texto, l.x + l.w / 2, l.y + l.h + pe / 2); }
        if (l.fita !== false) { ctx.save(); ctx.translate(l.x + l.w / 2, c.y0 + 4); ctx.rotate(-0.08); ctx.fillStyle = "rgba(242,212,107,.82)"; ctx.fillRect(-l.w * 0.22, -24, l.w * 0.44, 48); ctx.restore(); }
      });
      return c;
    }
    const lt = { ...l, texto: textoDe(l, i, n) };
    if (l.t === "selo") { // adesivo redondo girado
      const c = { x0: l.x, y0: l.y, x1: l.x + l.w, y1: l.y + l.w }, cx = l.x + l.w / 2, cy = l.y + l.w / 2;
      girar0(c, () => {
        ctx.save(); sombra(ctx, 0.25, 18, 6); ctx.fillStyle = cor(tema, l.fundoCor || "amarelo"); ctx.beginPath();
        const dentes = 22; for (let k = 0; k <= dentes * 2; k++) { const a = (k / (dentes * 2)) * Math.PI * 2, r = l.w / 2 - (k % 2 ? 0 : l.w * 0.035); ctx[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
        ctx.fill(); ctx.restore();
        const m = montar(ctx, { ...lt, w: l.w * 0.72 });
        escrever(ctx, lt, m, l.x + l.w * 0.14, cy - m.alt / 2, l.w * 0.72, { n: cor(tema, l.cor || "#231A13"), a: cor(tema, l.cor || "#231A13"), b: cor(tema, l.cor || "#231A13") }, "center");
      });
      return c;
    }
    const q = medidaCaixa(ctx, lt);
    if (l.t === "caixa") { // caixa caramelo com o destaque em amarelo
      const x0 = l.alinhar === "left" ? l.x : l.x + (l.w - q.bw) / 2, c = { x0, y0: l.y, x1: x0 + q.bw, y1: l.y + q.bh };
      girar0(c, () => {
        ctx.save(); sombra(ctx, 0.28, 40, 16); caminhoRedondo(ctx, x0, l.y, q.bw, q.bh, Math.min(48, q.bh / 2)); ctx.fillStyle = cor(tema, l.fundoCor || "caixa"); ctx.fill(); ctx.restore();
        escrever(ctx, lt, q.m, x0 + q.px, l.y + q.py, q.bw - q.px * 2, { n: cor(tema, l.cor || "naCaixa"), a: cor(tema, "amarelo"), b: cor(tema, l.cor || "naCaixa") }, l.alinhar === "left" ? "left" : "center");
      });
      return c;
    }
    if (l.t === "aviso") { // notificação do celular
      const c = { x0: l.x, y0: l.y, x1: l.x + q.bw, y1: l.y + q.bh };
      girar0(c, () => {
        ctx.save(); sombra(ctx, 0.2, 30, 10); caminhoRedondo(ctx, l.x, l.y, q.bw, q.bh, 40); ctx.fillStyle = "#FCEBC0"; ctx.fill(); semSombra(ctx); ctx.lineWidth = 4; ctx.strokeStyle = "#E2C58A"; ctx.stroke(); ctx.restore();
        const ix = l.x + q.pad, iy = l.y + q.pad;
        ctx.save(); sombra(ctx, 0.15, 10, 3); caminhoRedondo(ctx, ix, iy, q.ic, q.ic, q.ic * 0.26); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
        ctx.fillStyle = "#8A5A35"; ctx.font = `800 ${Math.round(q.ic * 0.46)}px ${FONTE_BASTAO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(l.quem || "M").charAt(0).toUpperCase(), ix + q.ic / 2, iy + q.ic / 2 + 2);
        const tx = ix + q.ic + 24; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        ctx.font = `800 ${Math.round(l.tam * 1.02)}px ${FONTE_BASTAO}`; ctx.fillStyle = "#2B1D13"; ctx.fillText(l.quem || "Marca", tx, iy + l.tam);
        ctx.font = `500 ${Math.round(l.tam * 0.85)}px ${FONTE_BASTAO}`; ctx.fillStyle = "#A07A4E"; ctx.textAlign = "right"; ctx.fillText("agora", l.x + q.bw - q.pad, iy + l.tam);
        escrever(ctx, lt, q.m, tx, iy + q.th, q.tw, { n: "#2B1D13", a: "#8A5A35", b: "#2B1D13" }, "left");
      });
      return c;
    }
    if (l.t === "cartao") { // opção numerada num cartão branco
      const c = { x0: l.x, y0: l.y, x1: l.x + q.bw, y1: l.y + q.bh };
      ctx.save(); sombra(ctx, 0.16, 26, 8); caminhoRedondo(ctx, l.x, l.y, q.bw, q.bh, 30); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
      ctx.font = `800 ${Math.round(l.tam * 1.35)}px ${FONTE_BASTAO}`; ctx.fillStyle = cor(tema, "ouro"); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(l.numero || 1), l.x + q.pad, l.y + q.pad + l.tam * 1.1);
      escrever(ctx, lt, q.m, l.x + q.pad + q.nw, l.y + q.pad, q.tw, { n: "#2B1D13", a: cor(tema, "ouro"), b: "#2B1D13" }, "left");
      if (q.ms) escrever(ctx, { ...lt, texto: l.sub, tam: Math.round(l.tam * 0.78), peso: 500 }, q.ms, l.x + q.pad + q.nw, l.y + q.pad + q.m.alt + l.tam * 0.35, q.tw, { n: "#8A7A68", a: "#8A7A68", b: "#8A7A68" }, "left");
      return c;
    }
    if (l.t === "stat") { // cartão de número (aprovações, ganhos...)
      const c = { x0: l.x, y0: l.y, x1: l.x + q.bw, y1: l.y + q.bh };
      girar0(c, () => {
        ctx.save(); sombra(ctx, 0.22, 30, 10); caminhoRedondo(ctx, l.x, l.y, q.bw, q.bh, 30); ctx.fillStyle = "#FFFFFF"; ctx.fill(); ctx.restore();
        ctx.font = `600 ${q.rt}px ${FONTE_BASTAO}`; ctx.fillStyle = "#4A3424"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(l.rotulo || "", l.x + q.pad, l.y + q.pad + q.rt);
        escrever(ctx, lt, q.m, l.x + q.pad, l.y + q.pad + q.rt * 1.6, q.bw - q.pad * 2, { n: "#2B1D13", a: "#8A5A35", b: "#2B1D13" }, "left");
      });
      return c;
    }
    return null;
  }
  const ESPECIAIS = ["enfeite", "seta", "janela", "polaroid", "selo", "caixa", "aviso", "cartao", "stat"];
  function textoDe(l, i, n) {
    if (l.auto === "num" && l.numEspaco) return `${i + 1} / ${n}`;
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
    } else if (ESPECIAIS.includes(l.t)) {
      caixa = desenharEspecial(ctx, l, tema, s, i, n, aoCarregar);
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
        if (l.faixaLinha) marca.faixaLinha = cor(tema, l.faixaLinha);
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
    if (car.estilo === "direto" || car.estilo === "colagem") texturaPapel(ctx, ["escuro", "colEscuro"].includes(tema.tom) ? 0.1 : 0.07);
    else if (tema.tom === "papel") {
      const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 80, W * 0.5, H * 0.5, W * 0.9); g.addColorStop(0, "rgba(255,255,255,.38)"); g.addColorStop(1, "rgba(120,90,60,.08)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, 0.12);
    } else if (tema.tom === "papelFoto") {
      const img = fotoCarrossel(s.foto, aoCarregar), foco = { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3;
      fotoCobre(ctx, img, 0, 0, W, H, foco);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(30,20,12,.45)"); g.addColorStop(0.3, "rgba(30,20,12,0)"); g.addColorStop(0.6, "rgba(30,20,12,0)"); g.addColorStop(1, "rgba(30,20,12,.55)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, 0.06);
    }
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
    if (e === "papel") return gerarPapel(car, i, s, n, W, H, tema, ctx);
    if (e === "colagem") return gerarColagem(car, i, s, n, W, H, tema, ctx);
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

  /* ---------- Papel: papel creme, título enorme em duas cores, caixa caramelo, print e notificação ---------- */
  function msgsDe(v) { return linhasDe(v).map((l) => { const m = l.match(/^\s*(eu|ryan|eu mesmo)\s*:\s*(.*)$/i), o = l.match(/^\s*([^:]{1,24}):\s*(.*)$/); return m ? { eu: true, quem: "Ryan", texto: m[2] } : o ? { eu: false, quem: o[1].trim(), texto: o[2] } : { eu: false, quem: "Marca", texto: l }; }); }
  function alturaDe(ctx, l) { const q = medidaCaixa(ctx, l); if (q) return q.bh; if (l.t === "janela") return l.h; if (l.t === "bolha") return montar(ctx, l).alt + 48; if (l.t === "pilula") { const m = montar(ctx, l); return m.alt + m.tam * 0.5; } if (l.t === "bilhete") { const m = montar(ctx, l); return m.alt + Math.round(m.tam * 1.8); } if (l.t === "polaroid") return l.h + l.w * 0.26; return montar(ctx, l).alt; }
  function empilhar(ctx, C, topo, fim, ancora, encolher) {
    const soma = () => C.reduce((a, l, k) => a + alturaDe(ctx, l) + (k < C.length - 1 ? l.gap ?? 34 : 0), 0);
    let voltas = 0; while (soma() > fim - topo && voltas++ < 60) encolher();
    const total = soma(); let y = ancora === "baixo" ? fim - total : ancora === "topo" ? topo : topo + Math.max(0, (fim - topo - total) / 2);
    C.forEach((l) => { l.y = Math.round(y); y += alturaDe(ctx, l) + (l.gap ?? 34); delete l.gap; });
    return y;
  }
  function gerarPapel(car, i, s, n, W, H, tema, ctx) {
    const L = [], mold = { moldura: true }, capa = i === 0 && W === H, xC = capa ? 150 : M, wC = W - 2 * xC;
    const MT = (nome, texto, o) => T(nome, texto, { fonte: "mont", ...o });
    const msgs = msgsDe(s.msgs).slice(0, 2);
    if (s.tipo === "gancho") {
      L.push(MT("Arroba", "@ryalvz", { x: M, y: M, w: 420, tam: 30, peso: 600, cor: "branco", entre: 1.2, ...mold }));
      L.push(MT("Nome", "Ryan Alves", { x: W - M - 420, y: M, w: 420, tam: 30, peso: 800, cor: "branco", alinhar: "right", entre: 1.2, ...mold }));
      const fim = H - M - 20;
      if (s.titulo) {
        const t = MT("Título", s.titulo, { x: xC, w: wC, tam: W === H ? 82 : 94, peso: 800, cor: "amarelo", corDestaque: "branco", alinhar: "center", entre: 1.24, letra: -2, faixaLinha: "faixa" });
        while (montar(ctx, t).alt > H * 0.4 && t.tam > 46) t.tam -= 4;
        t.y = Math.round(fim - montar(ctx, t).alt); L.push(t);
        L.push({ id: novoId(), nome: "Brilho", t: "enfeite", forma: "brilho", cor: "amarelo", x: xC - 40, y: t.y - 70, w: 64 });
        L.push({ id: novoId(), nome: "Brilho 2", t: "enfeite", forma: "brilho", cor: "amarelo", x: W - xC - 10, y: t.y - 110, w: 48 });
      }
      if (msgs[0]) L.push({ id: novoId(), nome: "Notificação", t: "aviso", quem: msgs[0].quem, texto: msgs[0].texto, x: M + 10, y: M + 120, w: Math.min(560, W - 2 * M), tam: 26, fonte: "mont", peso: 500, cor: "tinta", entre: 1.25, letra: 0, alinhar: "left", rot: -2 });
      if (s.lead) { const [a, b] = par(s.lead); L.push({ id: novoId(), nome: "Cartão de número", t: "stat", rotulo: b ? a : "", texto: b || a, x: W - M - 300, y: Math.round(H * 0.38), w: 300, tam: 50, fonte: "mont", peso: 700, cor: "tinta", entre: 1.1, letra: 0, alinhar: "left", rot: 2 }); }
      if (s.nota) L.push(T("Nota à mão", s.nota, { fonte: "marcador", tam: 64, cor: "amarelo", rot: -4, entre: 1.05, x: M, y: Math.round(H * 0.5), w: 520 }));
      return L;
    }
    L.push(MT("Nome", "Ryan Alves", { x: M, y: M - 4, w: W - 2 * M, tam: 32, peso: 800, cor: "tinta", alinhar: "center", entre: 1.2, ...mold }));
    L.push(MT("Assinatura", s.lead || "UGC criativo e bastidor", { x: M, y: M + 38, w: W - 2 * M, tam: 27, peso: 500, cor: "texto", alinhar: "center", entre: 1.2, ...mold }));
    L.push(MT("Número do slide", "", { auto: "num", numEspaco: true, x: M, y: H - M - 30, w: W - 2 * M, tam: 28, peso: 700, cor: "ouro", alinhar: "center", entre: 1.1, letra: 2, ...mold }));
    const topo = M + 130, fim = H - M - 70, C = [];
    if (s.titulo) C.push({ ...MT("Título", s.titulo, { x: xC, w: wC, tam: W === H ? 108 : 120, peso: 800, cor: "tinta", corDestaque: "ouro", alinhar: "center", entre: 1.0, letra: -3 }), gap: 46 });
    msgs.forEach((m) => C.push({ id: novoId(), nome: "Notificação", t: "aviso", quem: m.quem, texto: m.texto, x: xC, w: wC, tam: 28, fonte: "mont", peso: 500, cor: "tinta", entre: 1.25, letra: 0, alinhar: "left", gap: 22 }));
    linhasDe(s.itens).slice(0, 3).forEach((l, k) => { const [a, b] = par(l); C.push({ id: novoId(), nome: `Opção ${k + 1}`, t: "cartao", numero: k + 1, texto: a, sub: b, x: xC, w: wC, tam: 32, fonte: "mont", peso: 600, cor: "tinta", entre: 1.25, letra: 0, alinhar: "left", gap: 22 }); });
    let caixa = null;
    if (s.tipo === "cta" && s.palavra) caixa = `Comenta *${String(s.palavra).replace(/\*/g, "").toUpperCase()}*${s.texto ? `\n${s.texto}` : ""}`;
    else if (s.texto) caixa = s.texto;
    if (caixa) C.push({ id: novoId(), nome: "Caixa", t: "caixa", texto: caixa, x: xC, w: wC, tam: 40, fonte: "mont", peso: 400, cor: "naCaixa", entre: 1.3, letra: -0.5, alinhar: "center", gap: 40 });
    if (s.foto) C.push({ id: novoId(), nome: "Print", t: "janela", barra: true, x: xC, w: wC, h: W === H ? 300 : 420 });
    const tit = C.find((l) => l.nome === "Título");
    empilhar(ctx, C, topo, fim, "meio", () => {
      if (tit && tit.tam > 60) { tit.tam -= 4; tit.letra = -Math.round(tit.tam * 0.03); return; }
      const j = C.find((l) => l.t === "janela" && l.h > 180); if (j) { j.h -= 20; return; }
      C.forEach((l) => { if (l !== tit && l.tam > 24) l.tam -= 2; });
    });
    L.push(...C);
    if (s.nota) { const nl = T("Nota à mão", s.nota, { fonte: "marcador", tam: 62, cor: "laranja", rot: -4, entre: 1.05, w: 3000 }); const m = montar(ctx, nl); nl.w = Math.min(wC, Math.ceil(m.larg) + 12); nl.x = W - M - nl.w; nl.y = Math.round(Math.min(fim - m.alt, (C.length ? C[C.length - 1].y + alturaDe(ctx, C[C.length - 1]) : topo) + 10)); L.push(nl); }
    // Estrelas laranja nos cantos, nos slides que pedem respiro
    if (["tensao", "recompensa", "cta"].includes(s.tipo)) {
      L.push({ id: novoId(), nome: "Estrela", t: "enfeite", forma: "estrela", cor: "laranja", x: W - 230, y: -60, w: 330 });
      L.push({ id: novoId(), nome: "Estrela 2", t: "enfeite", forma: "estrela", cor: "laranja", x: -110, y: H - 230, w: 300 });
    }
    return L;
  }

  /* ---------- Colagem: fundo chapado, letra gigante, polaroid com fita, adesivo e seta ---------- */
  function gerarColagem(car, i, s, n, W, H, tema, ctx) {
    const L = [], mold = { moldura: true }, capa = i === 0 && W === H, xC = capa ? 150 : M, wC = W - 2 * xC;
    const G = (nome, texto, o) => T(nome, texto, { fonte: "grot", ...o });
    const minus = (v) => String(v || "").toLowerCase();
    L.push(G("Arroba", "@ryalvz", { x: M, y: M, w: 300, tam: 26, peso: 800, cor: "tinta", entre: 1.2, ...mold }));
    L.push(G("Número do slide", "", { auto: "num", numDois: true, x: W - M - 200, y: M, w: 200, tam: 26, peso: 800, cor: "tinta", alinhar: "right", entre: 1.2, ...mold }));
    L.push(T("Arrasta pro lado", "arrasta →", { auto: "arrasta", fonte: "marcador", x: W - M - 320, y: H - M - 56, w: 320, tam: 46, cor: "ouro", alinhar: "right", entre: 1.1, rot: -4, ...mold }));
    const topo = M + 70, fim = H - M - 80;
    const aperto = (tam) => -Math.round(tam * 0.03);
    const titulo = (tam, w) => G("Título", minus(s.titulo), { x: xC, w, tam, peso: 900, cor: "tinta", marca: true, entre: 0.92, letra: aperto(tam) });
    const caber = (t, alt, min) => { while (montar(ctx, t).alt > alt && t.tam > min) { t.tam -= 4; t.letra = aperto(t.tam); } return t; };
    if (s.tipo === "gancho") {
      const pw = W === H ? 340 : 420, ph = Math.round(pw * 1.08), fx = W - M - pw - 30, fy = fim - ph - Math.round(pw * 0.22) - 10;
      if (s.titulo) { const t = caber(titulo(W === H ? 150 : 168, wC), fy - topo - 10, 70); t.y = topo; L.push(t); }
      L.push({ id: novoId(), nome: "Foto polaroid", t: "polaroid", x: fx, y: fy, w: pw, h: ph, rot: 5, fita: true });
      if (s.lead) L.push({ id: novoId(), nome: "Adesivo", t: "selo", texto: String(s.lead).toUpperCase(), x: fx - 110, y: fy - 70, w: 220, tam: 30, fonte: "grot", peso: 900, cor: "#231A13", entre: 1.0, letra: 0, alinhar: "center", rot: -12 });
      if (s.nota) {
        const nl = T("Nota à mão", minus(s.nota), { fonte: "marcador", tam: 72, cor: "ouro", rot: -5, entre: 1.05, w: fx - xC - 40 }); const m = montar(ctx, nl);
        nl.x = xC; nl.y = Math.round(fim - m.alt - 10); L.push(nl);
        L.push({ id: novoId(), nome: "Seta", t: "seta", cor: "ouro", x: xC + Math.min(m.larg, fx - xC - 120) * 0.55, y: fy + ph * 0.35, w: Math.max(80, fx - xC - Math.min(m.larg, fx - xC - 120) * 0.55 - 30), h: Math.max(60, nl.y - fy - ph * 0.35 - 20) });
      }
      return L;
    }
    const C = [], comFoto = !!s.foto, pw = W === H ? 300 : 340, ladoW = comFoto ? wC - pw - 50 : wC;
    msgsDe(s.msgs).slice(0, 2).forEach((m) => C.push({ id: novoId(), nome: m.eu ? "Mensagem sua" : "Mensagem da marca", t: "bolha", eu: m.eu, texto: m.texto, x: xC, w: Math.min(620, ladoW - 80), tam: 38, fonte: "grot", peso: 500, cor: "tinta", entre: 1.3, letra: 0, alinhar: "left", gap: 24 }));
    const sozinha = !s.texto && !s.itens && !s.msgs && !s.foto && s.tipo !== "cta";
    if (s.titulo) C.push({ ...titulo(sozinha ? (W === H ? 176 : 196) : W === H ? 132 : 148, wC), gap: 40 });
    const itens = linhasDe(s.itens).slice(0, 4);
    if (itens.length) C.push({ ...G("Bilhete", itens.map((x, k) => `${k + 1}. ${x.replace(/\s+\/\s+/, ": ")}`).join("\n"), { t: "bilhete", x: xC + 10, w: Math.min(620, ladoW - 20), tam: 40, peso: 500, cor: "tinta", entre: 1.45, rot: -3 }), gap: 34 });
    if (s.tipo === "cta" && s.palavra) C.push({ id: novoId(), nome: "Palavra", t: "pilula", texto: `comenta ${String(s.palavra).replace(/\*/g, "").toUpperCase()}`, x: xC, w: wC, tam: 52, fonte: "grot", peso: 900, cor: "naOuro", entre: 1.1, letra: 0, alinhar: "left", gap: 26 });
    if (s.texto) C.push(G("Texto", s.texto, { x: xC, w: Math.min(ladoW, 780), tam: 40, peso: 500, cor: "texto", corNegrito: "tinta", entre: 1.3 }));
    C.forEach((l) => { if (l.t === "pilula") { l.w = wC; const m = montar(ctx, l); l.w = Math.ceil(m.larg + m.tam * 1.4); } });
    const tit = C.find((l) => l.nome === "Título");
    empilhar(ctx, C, topo, comFoto ? fim : fim, s.tipo === "tensao" || s.tipo === "cta" ? "baixo" : "topo", () => {
      if (tit && tit.tam > 64) { tit.tam -= 4; tit.letra = aperto(tit.tam); return; }
      C.forEach((l) => { if (l !== tit && l.tam > 24) l.tam -= 2; });
    });
    // O texto de apoio desce pro rodapé, longe do título
    const ult = C[C.length - 1];
    if (ult && ult.nome === "Texto" && s.tipo !== "cta" && s.tipo !== "tensao") ult.y = Math.max(ult.y, Math.round(fim - alturaDe(ctx, ult)));
    L.push(...C);
    if (comFoto) { const ph = Math.round(pw * 1.1); L.push({ id: novoId(), nome: "Foto polaroid", t: "polaroid", x: W - M - pw - 20, y: fim - ph - Math.round(pw * 0.2) + 30, w: pw, h: ph, rot: i % 2 ? -5 : 5, fita: true }); }
    if (s.nota) {
      const nl = T("Nota à mão", minus(s.nota), { fonte: "marcador", tam: 66, cor: "ouro", rot: -5, entre: 1.05, w: 3000 }); let m = montar(ctx, nl);
      while (m.larg > wC * 0.7 && nl.tam > 40) { nl.tam -= 4; m = montar(ctx, nl); }
      nl.w = Math.ceil(m.larg) + 12; nl.x = comFoto ? xC : W - xC - nl.w;
      const ocupado = C.reduce((a, l) => Math.max(a, l.y + alturaDe(ctx, l)), topo);
      nl.y = Math.round(Math.min(fim - m.alt - 20, ocupado + 40)); L.push(nl);
    }
    // Adesivo: embaixo do título, à direita; sem espaço, menor e colado no canto de cima
    const ySelo = Math.round(tit ? tit.y + alturaDe(ctx, tit) + 30 : topo), cabe = ySelo + 190 <= fim;
    if (s.lead && s.tipo !== "cta") L.push({ id: novoId(), nome: "Adesivo", t: "selo", texto: String(s.lead).toUpperCase(), x: W - M - (cabe ? 200 : 150), y: cabe ? ySelo : M + 40, w: cabe ? 190 : 150, tam: 26, fonte: "grot", peso: 900, cor: "#231A13", entre: 1.0, letra: 0, alinhar: "center", rot: 10 });
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
      if (!l || ENFEITES.includes(l.t)) return false;
      return b.x0 < M - 2 || b.y0 < M - 2 || b.y1 > H - M + 2 || (!l.continua && b.x1 > W - M + 2);
    }).map((b) => b.id);
  }
  function palavras(camadas) {
    return camadas.filter((l) => !l.oculto && !l.moldura && TEXTOS.includes(l.t)).map((l) => String(l.texto || "")).join(" ").replace(/\*/g, "").split(/\s+/).filter(Boolean).length;
  }
  const medir = (l) => { const m = montar(ctxMedir(), l); return { larg: m.larg, alt: m.alt }; };
  return { M, FORMATOS, TEXTOS, dims, pintar, garantir, gerar, foraDaBorda, palavras, novoId, medir, texto: T, temaDe };
})();
