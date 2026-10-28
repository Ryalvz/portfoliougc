/* =============================================================
   ADMIN, PARTE 4: os 4 estilos de carrossel do Ryan
   Bastidor, Revista, Conversa e Fotos. Todos em creme, café e
   dourado, com Playfair, Montserrat e Allura, e a mesma estrutura
   de 7 páginas: gancho, contexto, construção (2), tensão,
   recompensa e CTA. Usa as funções de desenho da parte 2
   (caberRico, escreverRico, fotoCobre, texturaPapel...).
   No texto: *palavra* = destaque dourado, **palavra** = cinza.
   ============================================================= */
const CAR_ESTILOS = (() => {
  const W = W_CAR, H = H_CAR;
  const R = {
    claro: { fundo: "#F5F1EA", tinta: "#2B241C", cinza: "#A39A8C", texto: "#3A3128", faixa: "#7A6322", naFaixa: "#FFF8EA", ouro: "#7A6322" },
    escuro: { fundo: "#2B241C", tinta: "#F5F1EA", cinza: "#A89E8E", texto: "#E9E1D3", faixa: "#D9C48A", naFaixa: "#2B241C", ouro: "#D9C48A" }
  };
  R.foto = R.escuro;
  const PAPEL = "#ECE4D6";
  const mont = (p, t) => `${p} ${t}px Montserrat`;
  const play = (t) => `italic 700 ${t}px 'Playfair Display'`;
  const ETQ = (t) => `800 ${t}px Montserrat`;
  const serifF = (t) => ({ n: `700 ${t}px 'Playfair Display'`, a: `italic 700 ${t}px 'Playfair Display'`, b: `italic 400 ${t}px 'Playfair Display'` });
  const txt = (v) => String(v || "");
  const linhas = (v) => txt(v).split("\n").map((x) => x.trim()).filter(Boolean);
  const par = (l) => { const k = l.indexOf(" / "); return k < 0 ? [l, ""] : [l.slice(0, k).trim(), l.slice(k + 3).trim()]; };

  /* ---------- Peças comuns ---------- */
  function papel(ctx, cor, forca = 0.1) { ctx.fillStyle = cor; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, forca); }
  function fundoLuz(ctx, tom) {
    ctx.fillStyle = R[tom].fundo; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.45, 900);
    g.addColorStop(0, tom === "escuro" ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, tom === "escuro" ? 0.14 : 0.12);
  }
  function rodape(ctx, cor, i, total) {
    ctx.save(); ctx.fillStyle = cor; ctx.globalAlpha = 0.7; ctx.font = mont(500, 22); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillText(ASSINATURA.arroba, 80, H - 60);
    if (i < total - 1) { ctx.textAlign = "right"; ctx.fillText("arrasta pro lado  →", W - 80, H - 60); }
    ctx.restore();
  }
  // Ficha técnica no topo do Bastidor
  function moldura(ctx, tom, i, total) {
    const c = R[tom], cor = tom === "foto" ? "rgba(255,255,255,.85)" : c.tinta;
    ctx.save(); ctx.fillStyle = cor; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.font = mont(600, 21);
    [["RYAN ALVES", "UGC CREATOR"], ["CONTEÚDO", "DE TECH"], ["DE CREATOR", "PRA CREATOR"]].forEach(([a, b], k) => { ctx.globalAlpha = 0.75; ctx.fillText(a, 80 + k * 230, 92); ctx.fillText(b, 80 + k * 230, 118); });
    ctx.globalAlpha = 1; ctx.textAlign = "right"; ctx.font = mont(700, 24); ctx.fillText(`${String(i + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}`, W - 80, 104);
    ctx.restore(); rodape(ctx, cor, i, total);
  }
  // Montserrat grossa com *palavra* em Playfair itálica numa faixa dourada
  function rico(ctx, texto, x, y, { tam, largura, tom, alinhar = "left", entre = 1.12, altura = 9999 }) {
    const c = R[tom], f = (t) => ({ n: mont(800, t), b: mont(800, t), a: play(t * 1.04) });
    let ls = linhasRicas(ctx, txt(texto), f(tam), largura, false);
    while ((ls.length * tam * entre > altura || ls.some((l) => larguraDaLinha(ctx, l, f(tam)) > largura + 1)) && tam > 30) { tam -= 4; ls = linhasRicas(ctx, txt(texto), f(tam), largura, false); }
    ls.forEach((l, li) => {
      const base = y + li * tam * entre + tam * 0.86;
      ctx.font = f(tam).n; const esp = ctx.measureText(" ").width;
      const total = l.itens.reduce((s, p, k) => s + p.w + (k > 0 && !p.cola ? esp : 0), 0);
      let cx = alinhar === "center" ? x - total / 2 : alinhar === "right" ? x - total : x;
      l.itens.forEach((p, k) => {
        if (k > 0 && !p.cola) { if (p.e === "a" && l.itens[k - 1].e === "a") { ctx.fillStyle = c.faixa; ctx.fillRect(cx - 2, base - tam * 0.8, esp + 4, tam); } cx += esp; }
        if (p.e === "a") { ctx.fillStyle = c.faixa; ctx.fillRect(cx - 12, base - tam * 0.8, p.w + 24, tam); }
        ctx.font = f(tam)[p.e]; ctx.fillStyle = p.e === "a" ? c.naFaixa : p.e === "b" ? c.cinza : tom === "foto" ? "#fff" : c.tinta;
        ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(p.t, cx, base); cx += p.w;
      });
    });
    return y + ls.length * tam * entre;
  }
  // Playfair com *palavra* em itálico dourado
  function serif(ctx, texto, x, y, { tam = 96, min = 44, largura = 900, altura = 500, tom = "claro", alinhar = "left", entre = 1.08, cor } = {}) {
    const c = R[tom], b = caberRico(ctx, txt(texto), { fontes: serifF, max: tam, min, largura, altura, entre });
    escreverRico(ctx, b, x, y, { n: cor || c.tinta, a: tom === "foto" ? R.escuro.faixa : c.ouro, b: cor || c.cinza }, alinhar);
    return y + b.linhas.length * b.tam * b.entre;
  }
  function paragrafo(ctx, texto, x, y, { tam = 36, largura = 820, tom, alinhar = "left", altura = 400 }) {
    if (!texto) return y;
    const c = R[tom], b = caberRico(ctx, txt(texto), { fontes: (t) => ({ n: mont(500, t), a: mont(800, t), b: mont(800, t) }), max: tam, min: 24, largura, altura, entre: 1.38 });
    escreverRico(ctx, b, x, y, { n: c.texto, a: c.tinta, b: c.tinta }, alinhar);
    return y + b.linhas.length * b.tam * b.entre;
  }
  function etiqueta(ctx, texto, cx, y, tam, tom = "claro", graus = 0, maxW = 900) {
    ctx.save(); ctx.font = ETQ(tam);
    while (ctx.measureText(texto).width + tam * 0.6 > maxW && tam > 30) { tam -= 4; ctx.font = ETQ(tam); }
    const w = ctx.measureText(texto).width + tam * 0.6, h = tam * 1.25;
    girar(ctx, cx, y + h / 2, graus, () => { ctx.fillStyle = R[tom].faixa; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.fillStyle = R[tom].naFaixa; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, 0, tam * 0.04); });
    ctx.restore(); return y + h;
  }
  function anotacao(ctx, texto, x, y, graus = -6, tam = 80, tom = "escuro") {
    if (!texto) return;
    girar(ctx, x, y, graus, () => { ctx.font = `400 ${tam}px ${FONTE_MAO}`; ctx.fillStyle = R[tom].ouro; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(texto, 0, 0); });
  }
  function seta(ctx, pts, cor) {
    ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); ctx.stroke();
    const [px, py] = pts[3], [qx, qy] = pts[2], a = Math.atan2(py - qy, px - qx);
    ctx.beginPath(); ctx.moveTo(px - 34 * Math.cos(a - 0.45), py - 34 * Math.sin(a - 0.45)); ctx.lineTo(px, py); ctx.lineTo(px - 34 * Math.cos(a + 0.45), py - 34 * Math.sin(a + 0.45)); ctx.stroke();
    ctx.restore();
  }
  function fotoPB(ctx, img, x, y, w, h, foco) { ctx.save(); ctx.filter = "grayscale(1) contrast(1.08)"; fotoCobre(ctx, img, x, y, w, h, foco); ctx.restore(); }
  function fotoArco(ctx, img, x, y, w, h, foco) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.clip();
    ctx.filter = "grayscale(1) contrast(1.05)"; fotoCobre(ctx, img, x, y, w, h, foco); ctx.restore();
  }
  function pilula(ctx, texto, cx, y, w, tom) {
    ctx.save(); ctx.font = mont(700, 36); retanguloRedondo(ctx, cx - w / 2, y, w, 76, 38, R[tom].faixa);
    ctx.fillStyle = R[tom].naFaixa; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, cx, y + 40); ctx.restore(); return y + 76;
  }
  function regua(ctx, y, cor, x1 = 80, x2 = W - 80) { ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore(); }

  /* ---------- Bastidor: foto P&B, faixas douradas, claro e escuro alternando ---------- */
  function bastidor(ctx, s, i, total, img, foco) {
    switch (s.tipo) {
      case "gancho": {
        fotoPB(ctx, img, 0, 0, W, H, foco);
        const g = ctx.createLinearGradient(0, H * 0.3, 0, H); g.addColorStop(0, "rgba(10,8,6,0)"); g.addColorStop(0.55, "rgba(10,8,6,.75)"); g.addColorStop(1, "rgba(10,8,6,.95)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, 0.08); moldura(ctx, "foto", i, total);
        const y = serif(ctx, s.titulo, 80, H - 640, { tam: 124, min: 70, largura: W - 160, altura: 340, tom: "foto", cor: "#FFF8EA", entre: 1.02 });
        rico(ctx, s.texto, 92, y + 34, { tam: 76, largura: W - 180, tom: "foto", altura: 200 });
        anotacao(ctx, s.nota, 96, H - 680, -5, 76);
        return;
      }
      case "contexto": {
        fundoLuz(ctx, "claro"); moldura(ctx, "claro", i, total);
        ctx.font = mont(600, 40); ctx.fillStyle = R.claro.cinza; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt(s.lead), W / 2, 470);
        const y = rico(ctx, s.titulo, W / 2, 500, { tam: 92, largura: 900, tom: "claro", alinhar: "center", altura: 360 });
        paragrafo(ctx, s.texto, W / 2, y + 60, { tam: 40, largura: 760, tom: "claro", alinhar: "center" });
        return;
      }
      case "construcao": {
        fundoLuz(ctx, "claro"); moldura(ctx, "claro", i, total);
        const itens = linhas(s.itens).slice(0, 4);
        if (itens.length) { // lista numerada
          let y = rico(ctx, s.titulo, 100, 300, { tam: 84, largura: 880, tom: "claro", altura: 300 }) + 70;
          const passo = Math.min(190, (H - 160 - y) / itens.length);
          itens.map(par).forEach(([a, b], k) => {
            ctx.save(); ctx.strokeStyle = R.claro.tinta; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(100, y, 120, 120, 26) : ctx.rect(100, y, 120, 120); ctx.stroke();
            ctx.font = play(70); ctx.fillStyle = R.claro.faixa; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(k + 1), 160, y + 64); ctx.restore();
            const t = caberRico(ctx, a, { fontes: (n) => ({ n: mont(800, n), a: mont(800, n), b: mont(800, n) }), max: 50, min: 30, largura: 700, altura: 70, entre: 1.1 });
            escreverRico(ctx, t, 262, y + 8, { n: R.claro.tinta, a: R.claro.tinta, b: R.claro.tinta });
            ctx.font = mont(500, 34); ctx.fillStyle = R.claro.cinza; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(b, 262, y + 104);
            y += passo;
          });
        } else { // print: etiqueta, texto e o print/foto do vídeo
          let y = etiqueta(ctx, txt(s.titulo).replace(/\*/g, "").toUpperCase(), W / 2, 230, 64);
          y = paragrafo(ctx, s.texto, W / 2, y + 50, { tam: 40, largura: 820, tom: "claro", alinhar: "center", altura: 200 }) + 50;
          const w = 560, h = H - y - 170, x = (W - w) / 2;
          girar(ctx, W / 2, y + h / 2, -2, () => { caixaPapel(ctx, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 30, "#fff", true); fotoRedonda(ctx, img, -w / 2, -h / 2, w, h, 22, foco); });
          anotacao(ctx, s.nota, x + w - 30, y + h - 40, -8, 76, "claro");
          seta(ctx, [[x + w + 40, y + h - 120], [x + w + 110, y + h - 220], [x + w + 70, y + 160], [x + w + 10, y + 120]], R.claro.ouro);
        }
        return;
      }
      case "tensao": {
        fundoLuz(ctx, "escuro"); moldura(ctx, "escuro", i, total);
        let y = rico(ctx, s.titulo, W / 2, 340, { tam: 104, largura: 900, tom: "escuro", alinhar: "center", altura: 360 });
        ctx.font = mont(600, 42); ctx.fillStyle = R.escuro.cinza; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt(s.lead), W / 2, y + 60);
        y += 130;
        linhas(s.itens).slice(0, 5).forEach((t) => { y = pilula(ctx, t, W / 2, y, 760, "escuro") + 34; });
        return;
      }
      case "recompensa": {
        fundoLuz(ctx, "escuro");
        if (s.lead) { ctx.save(); ctx.font = `italic 700 300px 'Playfair Display'`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.strokeStyle = "rgba(255,255,255,.06)"; ctx.lineWidth = 3; ctx.strokeText(s.lead, W / 2, H / 2 - 40); ctx.restore(); }
        moldura(ctx, "escuro", i, total);
        const y = rico(ctx, s.titulo, W / 2, 420, { tam: 110, largura: 900, tom: "escuro", alinhar: "center", entre: 1.1, altura: 520 });
        if (s.texto) {
          ctx.font = mont(600, 40); ctx.fillStyle = R.escuro.texto; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(s.texto, 420, y + 120);
          seta(ctx, [[400, y + 110], [250, y + 120], [250, y + 300], [640, y + 300]], R.escuro.ouro);
        }
        anotacao(ctx, s.nota, 680, y + 320, -6, 80);
        return;
      }
      default: { // cta
        fundoLuz(ctx, "claro");
        const fw = 440, fx = W - fw;
        ctx.save(); ctx.beginPath(); ctx.rect(fx, 0, fw, H); ctx.clip(); fotoPB(ctx, img, fx, 0, fw, H, foco); ctx.restore();
        const g = ctx.createLinearGradient(fx, 0, fx + 200, 0); g.addColorStop(0, R.claro.fundo); g.addColorStop(1, "rgba(245,241,234,0)"); ctx.fillStyle = g; ctx.fillRect(fx, 0, 200, H);
        moldura(ctx, "claro", i, total);
        ctx.font = play(130); ctx.fillStyle = R.claro.tinta; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Comenta", 80, 520);
        const palavra = txt(s.palavra || "PALAVRA").toUpperCase();
        ctx.font = ETQ(96); const wp = Math.min(560, ctx.measureText(palavra).width + 58);
        etiqueta(ctx, palavra, 80 + wp / 2, 570, 96, "claro", -3, 560);
        paragrafo(ctx, s.texto, 86, 800, { tam: 46, largura: 560, tom: "claro", altura: 300 });
        seta(ctx, [[120, 1120], [160, 1210], [380, 1200], [470, 1120]], R.claro.ouro);
      }
    }
  }

  /* ---------- Revista: tudo claro, título grande, foto em arco ---------- */
  function cabecalhoRevista(ctx, tom, i, total) {
    const c = R[tom];
    ctx.save(); ctx.fillStyle = c.tinta; ctx.font = mont(600, 22); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillText("DE CREATOR PRA CREATOR", 80, 100); ctx.textAlign = "right"; ctx.fillText(`${i + 1} / ${total}`, W - 80, 100); ctx.restore();
    regua(ctx, 124, c.tinta); rodape(ctx, c.tinta, i, total);
  }
  function revista(ctx, s, i, total, img, foco, todos) {
    switch (s.tipo) {
      case "gancho": {
        papel(ctx, R.claro.fundo); cabecalhoRevista(ctx, "claro", i, total);
        fotoArco(ctx, img, W - 520, 560, 440, 640, foco);
        const y = serif(ctx, s.titulo, 80, 190, { tam: 132, largura: 900, altura: 420, entre: 1.0 });
        paragrafo(ctx, s.texto, 80, Math.max(y + 60, 760), { tam: 36, largura: 400, tom: "claro", altura: 300 });
        anotacao(ctx, s.nota, 90, 1150, -6, 80, "claro");
        return;
      }
      case "contexto": {
        papel(ctx, PAPEL); cabecalhoRevista(ctx, "claro", i, total);
        ctx.save(); ctx.font = `italic 700 420px 'Playfair Display'`; ctx.fillStyle = R.claro.ouro; ctx.globalAlpha = 0.25; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("“", 50, 560); ctx.restore();
        const y = serif(ctx, s.titulo, 120, 400, { tam: 92, largura: 840, altura: 520, entre: 1.12 });
        regua(ctx, y + 50, R.claro.ouro, 120, 320);
        paragrafo(ctx, s.texto, 120, y + 90, { tam: 38, largura: 760, tom: "claro" });
        return;
      }
      case "construcao": {
        papel(ctx, R.claro.fundo); cabecalhoRevista(ctx, "claro", i, total);
        const n = todos.slice(0, i + 1).filter((x) => x.tipo === "construcao").length;
        ctx.save(); ctx.font = `italic 700 460px 'Playfair Display'`; ctx.fillStyle = R.claro.ouro; ctx.globalAlpha = 0.18; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(n).padStart(2, "0"), W - 60, H - 130); ctx.restore();
        ctx.font = mont(700, 26); ctx.fillStyle = R.claro.ouro; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt(s.lead).toUpperCase(), 80, 420);
        const y = serif(ctx, s.titulo, 80, 450, { tam: 104, largura: 900, altura: 360 });
        paragrafo(ctx, s.texto, 80, y + 50, { tam: 40, largura: 820, tom: "claro" });
        return;
      }
      case "tensao": {
        papel(ctx, PAPEL); cabecalhoRevista(ctx, "claro", i, total);
        const y0 = serif(ctx, s.titulo, W / 2, 260, { tam: 88, largura: 880, altura: 260, alinhar: "center" }) + 70;
        const ls = linhas(s.itens).map(par);
        if (!ls.length) return;
        ctx.save(); ctx.strokeStyle = R.claro.tinta; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, y0); ctx.lineTo(W / 2, H - 170); ctx.stroke(); ctx.restore();
        const [cab, ...resto] = ls;
        [[0, 100, R.claro.cinza], [1, W / 2 + 50, R.claro.tinta]].forEach(([k, x, cor]) => {
          ctx.font = mont(800, 30); ctx.fillStyle = k ? R.claro.ouro : R.claro.cinza; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt(cab[k]).toUpperCase(), x, y0 + 30);
          let y = y0 + 90;
          resto.forEach((l) => { const b = caberRico(ctx, l[k], { fontes: serifF, max: 52, min: 30, largura: 380, altura: 200, entre: 1.15 }); escreverRico(ctx, b, x, y, { n: cor, a: R.claro.ouro, b: cor }); y += b.linhas.length * b.tam * b.entre + 44; });
        });
        return;
      }
      case "recompensa": {
        papel(ctx, R.escuro.fundo, 0.14); cabecalhoRevista(ctx, "escuro", i, total);
        const y = serif(ctx, s.titulo, W / 2, 420, { tam: 110, largura: 880, altura: 560, tom: "escuro", alinhar: "center", entre: 1.1 });
        regua(ctx, y + 60, R.escuro.ouro, W / 2 - 80, W / 2 + 80);
        paragrafo(ctx, s.texto, W / 2, y + 100, { tam: 34, largura: 760, tom: "escuro", alinhar: "center", altura: 160 });
        return;
      }
      default: {
        papel(ctx, R.claro.fundo); cabecalhoRevista(ctx, "claro", i, total);
        fotoArco(ctx, img, W - 460, 330, 380, 560, foco);
        const palavra = txt(s.palavra || "palavra").toLowerCase();
        ctx.font = `700 120px 'Playfair Display'`; ctx.fillStyle = R.claro.tinta; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("Comenta", 80, 470);
        let tam = 128; ctx.font = play(tam); while (ctx.measureText(palavra).width > 520 && tam > 60) { tam -= 6; ctx.font = play(tam); }
        ctx.fillStyle = R.claro.ouro; ctx.fillText(palavra, 80, 610);
        const w = ctx.measureText(palavra).width;
        ctx.save(); ctx.strokeStyle = R.claro.ouro; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(84, 640); ctx.bezierCurveTo(84 + w * 0.3, 625, 84 + w * 0.7, 660, 84 + w, 632); ctx.stroke(); ctx.restore();
        paragrafo(ctx, s.texto, 80, 960, { tam: 44, largura: 880, tom: "claro", altura: 260 });
      }
    }
  }

  /* ---------- Conversa: fundo café, balões de mensagem e card de Notas ---------- */
  function balao(ctx, texto, eu, y) {
    const b = caberRico(ctx, texto, { fontes: (t) => ({ n: mont(500, t), a: mont(800, t), b: mont(800, t) }), max: 42, min: 28, largura: 560, altura: 600, entre: 1.3 });
    const tw = Math.max(1, ...b.linhas.map((l) => larguraDaLinha(ctx, l, b.f))), w = tw + 80, h = b.linhas.length * b.tam * b.entre + 56;
    const x = eu ? W - 80 - w : 80, cor = eu ? R.escuro.faixa : "#3A3128";
    retanguloRedondo(ctx, x, y, w, h, 40, cor);
    ctx.fillStyle = cor; ctx.beginPath();
    if (eu) { ctx.moveTo(x + w - 30, y + h - 30); ctx.lineTo(x + w + 18, y + h + 6); ctx.lineTo(x + w - 60, y + h - 4); } else { ctx.moveTo(x + 30, y + h - 30); ctx.lineTo(x - 18, y + h + 6); ctx.lineTo(x + 60, y + h - 4); }
    ctx.fill();
    escreverRico(ctx, b, x + 40, y + 28, eu ? { n: R.escuro.naFaixa, a: R.escuro.naFaixa, b: R.escuro.naFaixa } : { n: R.escuro.tinta, a: R.escuro.faixa, b: R.escuro.tinta });
    return y + h + 36;
  }
  function cabecalhoConversa(ctx, i, total, nome) {
    ctx.save(); ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = R.escuro.faixa; ctx.beginPath(); ctx.arc(130, 92, 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = R.escuro.naFaixa; ctx.font = mont(800, 34); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText((nome[0] || "M").toUpperCase(), 130, 94);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = R.escuro.tinta; ctx.font = mont(700, 32); ctx.fillText(nome, 190, 88);
    ctx.font = mont(500, 24); ctx.fillStyle = R.escuro.cinza; ctx.fillText("online", 190, 122);
    ctx.textAlign = "right"; ctx.font = mont(700, 24); ctx.fillStyle = R.escuro.tinta; ctx.fillText(`${i + 1}/${total}`, W - 80, 104);
    ctx.restore(); rodape(ctx, R.escuro.tinta, i, total);
  }
  function conversa(ctx, s, i, total) {
    papel(ctx, R.escuro.fundo, 0.14);
    if (s.tipo === "recompensa") {
      cabecalhoConversa(ctx, i, total, "Notas do Ryan");
      const cw = 860, cx = (W - cw) / 2, cy = 300;
      caixaPapel(ctx, cx, cy, cw, 720, 40, R.claro.fundo, true);
      ctx.fillStyle = R.claro.ouro; ctx.font = mont(600, 32); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("‹ Notas", cx + 50, cy + 80);
      const y = serif(ctx, s.titulo, cx + 60, cy + 150, { tam: 84, largura: cw - 120, altura: 400 });
      paragrafo(ctx, s.texto, cx + 60, y + 30, { tam: 36, largura: cw - 120, tom: "claro", altura: cy + 690 - y });
      return;
    }
    cabecalhoConversa(ctx, i, total, txt(s.lead) || "Marca");
    let y = 260;
    if (s.titulo) y = serif(ctx, s.titulo, 80, y, { tam: 96, largura: 900, altura: 420, tom: "escuro" }) + 70;
    linhas(s.msgs).slice(0, 6).forEach((l) => {
      const m = l.match(/^\s*(eu|ryan|eu mesmo)\s*:\s*(.*)$/i), o = l.match(/^\s*[^:]{1,20}:\s*(.*)$/);
      y = balao(ctx, m ? m[2] : o ? o[1] : l, !!m, y);
    });
    if (s.tipo === "tensao") { retanguloRedondo(ctx, 80, y, 170, 80, 40, "#3A3128"); [0, 1, 2].forEach((k) => { ctx.fillStyle = R.escuro.cinza; ctx.beginPath(); ctx.arc(125 + k * 40, y + 40, 10, 0, Math.PI * 2); ctx.fill(); }); y += 120; }
    paragrafo(ctx, s.texto, 80, Math.max(y + 20, 900), { tam: 38, largura: 880, tom: "escuro", altura: 220 });
    anotacao(ctx, s.nota, W - 460, H - 170, -6, 80, "escuro");
  }

  /* ---------- Fotos: foto colorida em tela cheia, legenda curta ---------- */
  function fotos(ctx, s, i, total, img, foco) {
    if (s.tipo === "cta") {
      papel(ctx, R.claro.fundo);
      const fw = 600, fh = 640, fx = (W - fw) / 2;
      girar(ctx, W / 2, 200 + fh / 2, -3, () => { caixaPapel(ctx, -fw / 2 - 22, -fh / 2 - 22, fw + 44, fh + 120, 6, "#FFFFFF", true); fotoCobre(ctx, img, -fw / 2, -fh / 2, fw, fh, foco); });
      anotacao(ctx, s.nota, fx + 40, 200 + fh + 70, -3, 72, "claro");
      const y = serif(ctx, s.titulo, W / 2, 1010, { tam: 72, largura: 900, altura: 160, alinhar: "center" });
      paragrafo(ctx, s.texto, W / 2, y + 16, { tam: 34, largura: 820, tom: "claro", alinhar: "center", altura: 120 });
      rodape(ctx, R.claro.tinta, i, total);
      return;
    }
    fotoCobre(ctx, img, 0, 0, W, H, foco);
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, "rgba(43,36,28,0)"); g.addColorStop(1, "rgba(43,36,28,.92)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, 0.06);
    ctx.save(); ctx.fillStyle = "rgba(245,241,234,.92)"; ctx.font = mont(700, 24); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(txt(s.lead).toUpperCase(), 80, 104);
    ctx.textAlign = "right"; ctx.fillText(`${i + 1}/${total}`, W - 80, 104); ctx.restore();
    const b = caberRico(ctx, txt(s.titulo), { fontes: serifF, max: s.tipo === "gancho" ? 112 : 78, min: 44, largura: W - 160, altura: 420, entre: 1.06 });
    const base = H - 150 - (s.texto ? 110 : 0);
    escreverRico(ctx, b, 80, base - b.linhas.length * b.tam * b.entre, { n: "#FFF8EA", a: R.escuro.faixa, b: "#FFF8EA" });
    if (s.texto) { const p = caberRico(ctx, s.texto, { fontes: (t) => ({ n: mont(500, t), a: mont(800, t), b: mont(800, t) }), max: 34, min: 24, largura: W - 160, altura: 100, entre: 1.3 }); escreverRico(ctx, p, 80, base + 20, { n: R.escuro.texto, a: R.escuro.faixa, b: R.escuro.texto }); }
    anotacao(ctx, s.nota, W - 420, 260, -6, 84, "escuro");
    rodape(ctx, "rgba(245,241,234,.9)", i, total);
  }

  /* ---------- O que cada estilo pede em cada página ---------- */
  const TIPOS = [["gancho", "Gancho"], ["contexto", "Contexto"], ["construcao", "Construção"], ["tensao", "Tensão"], ["recompensa", "Recompensa"], ["cta", "CTA"]];
  const ESTILOS = {
    bastidor: { nome: "Bastidor", quando: "Método e bastidor de UGC: a marca vê como você pensa.", desenho: bastidor,
      campos: { gancho: ["foto", "titulo", "texto", "nota"], contexto: ["lead", "titulo", "texto"], construcao: ["titulo", "itens", "texto", "foto", "nota"], tensao: ["titulo", "lead", "itens"], recompensa: ["titulo", "texto", "nota", "lead"], cta: ["palavra", "texto", "foto"] },
      rotulos: { contexto: { lead: "Linha pequena em cima (ex.: Exemplo real:)" }, construcao: { itens: "Lista, um por linha: item / explicação (vazio = slide de print com foto)" }, tensao: { lead: "Frase embaixo do título", itens: "Botões, um por linha" }, recompensa: { lead: "Palavra fantasma ao fundo", texto: "Frase com seta (opcional)" } } },
    revista: { nome: "Revista", quando: "Dicas e listas, como a série De Creator pra Creator: elegante e pra salvar.", desenho: revista,
      campos: { gancho: ["foto", "titulo", "texto", "nota"], contexto: ["titulo", "texto"], construcao: ["lead", "titulo", "texto"], tensao: ["titulo", "itens"], recompensa: ["titulo", "texto"], cta: ["palavra", "texto", "foto"] },
      rotulos: { construcao: { lead: "Linha pequena (ex.: pra cortar e legendar)" }, tensao: { itens: "Duas colunas: 1ª linha 'todo mundo / eu', depois 'isso / aquilo'" } } },
    conversa: { nome: "Conversa", quando: "Negociação e perguntas de marca: parece print de conversa.", desenho: conversa,
      campos: { gancho: ["lead", "titulo", "msgs"], contexto: ["lead", "msgs", "texto"], construcao: ["lead", "msgs", "texto"], tensao: ["lead", "msgs", "nota"], recompensa: ["titulo", "texto"], cta: ["lead", "titulo", "msgs", "texto"] },
      rotulos: { _: { lead: "Nome no topo (ex.: Marca)" }, recompensa: { titulo: "Frase do card de Notas (*palavra* dourada)" } } },
    fotos: { nome: "Fotos", quando: "Rotina e bastidor com foto (Conhecer): leve e colorido.", desenho: fotos,
      campos: { gancho: ["foto", "lead", "titulo", "texto", "nota"], contexto: ["foto", "lead", "titulo", "texto"], construcao: ["foto", "lead", "titulo", "texto"], tensao: ["foto", "lead", "titulo", "texto"], recompensa: ["foto", "lead", "titulo", "texto", "nota"], cta: ["foto", "nota", "titulo", "texto"] },
      rotulos: { _: { lead: "Etiqueta no topo (ex.: 8H)" } } }
  };
  const ROTULO = { titulo: "Título (*palavra* em destaque)", texto: "Texto", lead: "Linha pequena", nota: "Anotação à mão (opcional)", itens: "Itens, um por linha", msgs: "Mensagens, uma por linha: marca: ... ou eu: ...", palavra: "Palavra do comentário (ex.: ROTEIRO)", foto: "Foto" };
  const ESTRUTURA = ["gancho", "contexto", "construcao", "construcao", "tensao", "recompensa", "cta"];

  const EXEMPLOS = {
    bastidor: { titulo: "O briefing pedia uma coisa", slides: [
      { tipo: "gancho", titulo: "O briefing pedia uma coisa.", texto: "O cliente queria *outra.*", nota: "bastidor de UGC" },
      { tipo: "contexto", lead: "Exemplo real:", titulo: "o briefing pede **pra mostrar a** *bateria de 30h.*", texto: "Um fone bluetooth. Parece simples: mostra a bateria e pronto. Só que não." },
      { tipo: "construcao", titulo: "Só que o cliente tem *outra* dúvida", itens: "Cai da orelha? / a primeira coisa que ele pensa\nAguenta suor? / academia, corrida, calor\nFica firme pulando? / se não fica, ele nem compra" },
      { tipo: "construcao", titulo: "Então o vídeo abre assim", texto: "Correndo de fone, pulando corda. E ele **não sai do lugar.**", nota: "0 a 3s" },
      { tipo: "tensao", titulo: "E a *bateria?*", lead: "Ela não some. Só muda de lugar:", itens: "0 a 3 s: a dúvida\n3 a 10 s: a prova\ndepois: a bateria" },
      { tipo: "recompensa", lead: "dúvida", titulo: "A bateria entra depois. A *dúvida* vem primeiro.", texto: "É assim que eu penso", nota: "cada roteiro" },
      { tipo: "cta", palavra: "ROTEIRO", texto: "que eu te mando o modelo que eu uso pra transformar briefing em vídeo que vende." }] },
    revista: { titulo: "Os 3 apps que editam todo vídeo meu", slides: [
      { tipo: "gancho", titulo: "Os 3 apps que *editam* todo vídeo meu", texto: "E o que cada um faz **melhor que os outros.**", nota: "ep. 01" },
      { tipo: "contexto", titulo: "Editar *rápido* não é ter o app mais caro.", texto: "É saber qual app faz cada parte do vídeo melhor. Eu divido assim:" },
      { tipo: "construcao", lead: "pra cortar e legendar", titulo: "*CapCut*", texto: "(a função que você mais usa nele, e por quê)." },
      { tipo: "construcao", lead: "pra deixar com cara de Reels", titulo: "*Edits*", texto: "(o recurso do Edits que você usa em todo vídeo)." },
      { tipo: "tensao", titulo: "Onde quase todo mundo *erra*", itens: "todo mundo / eu\nFaz tudo num app só / Cada app numa *etapa*\nExporta e posta / (o seu cuidado antes de postar)" },
      { tipo: "recompensa", titulo: "O app não faz o vídeo. A *ordem* das etapas faz.", texto: "Salva pra usar no próximo vídeo." },
      { tipo: "cta", palavra: "APPS", texto: "que eu te mando o passo a passo de cada etapa." }] },
    conversa: { titulo: "O que eu respondo quando a marca pergunta o preço", slides: [
      { tipo: "gancho", lead: "Marca", titulo: "O que eu respondo quando a marca pergunta *o preço*", msgs: "marca: Oi! Quanto você cobra por um vídeo?" },
      { tipo: "contexto", lead: "Marca", msgs: "marca: Quanto você cobra por um vídeo?\neu: Depende do que vocês precisam. Posso te fazer 3 perguntas?", texto: "Mandar o preço seco é o jeito mais rápido de perder a marca." },
      { tipo: "construcao", lead: "Marca", msgs: "eu: 1. O vídeo vai pra anúncio ou só pro orgânico?\neu: 2. Quantas versões de gancho vocês querem?", texto: "Cada resposta muda o trabalho. E o preço." },
      { tipo: "construcao", lead: "Marca", msgs: "eu: 3. Por quanto tempo vão usar o vídeo?\nmarca: Anúncio, 3 ganchos, 6 meses.", texto: "Agora eu sei **o que eu estou vendendo.**" },
      { tipo: "tensao", lead: "Marca", msgs: "eu: Fica (seu valor), com os 3 ganchos inclusos.\nmarca: Hmm, ficou acima do que a gente pensou.", nota: "e agora?" },
      { tipo: "recompensa", titulo: "Quem pergunta *antes* cobra pelo que entrega.", texto: "Anúncio, versões e tempo de uso mudam o preço. Pergunta sempre." },
      { tipo: "cta", lead: "Você", titulo: "Comenta *PREÇO*", msgs: "eu: PREÇO", texto: "que eu te mando as 3 perguntas prontas pra copiar." }] },
    fotos: { titulo: "Um dia gravando UGC em casa", slides: [
      { tipo: "gancho", lead: "UM DIA DE UGC", titulo: "Um dia gravando UGC *em casa*", texto: "Do briefing ao vídeo entregue.", nota: "vem comigo" },
      { tipo: "contexto", lead: "8H", titulo: "Começa *lendo o briefing*, não gravando.", texto: "(o que você procura primeiro no briefing)" },
      { tipo: "construcao", lead: "10H", titulo: "Luz da janela, *celular no tripé*." },
      { tipo: "construcao", lead: "14H", titulo: "Gravo cada gancho *3 vezes*.", texto: "(por que você faz isso)" },
      { tipo: "tensao", lead: "16H", titulo: "A parte que *ninguém vê*: editar." },
      { tipo: "recompensa", lead: "19H", titulo: "Vídeo entregue. *Dia ganho.*" },
      { tipo: "cta", nota: "bastidor", titulo: "Quer ver o *resultado*?", texto: "Os vídeos estão no portfólio, link na bio." }] }
  };

  function pintar(cv, s, i, total, estilo, aoCarregar, todos = []) {
    const E = ESTILOS[estilo] || ESTILOS.bastidor, ctx = cv.getContext("2d");
    cv.width = W; cv.height = H;
    const img = fotoCarrossel(s.foto, aoCarregar), foco = { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3;
    E.desenho(ctx, s, i, total, img, foco, todos);
  }

  /* ---------- Texto <-> slides: o formato que o Claude escreve ----------
     CARROSSEL: título | estilo: revista
     1 gancho | título | texto: ... | linha: ... | nota: ... | itens: a / b; c / d | msgs: marca: oi; eu: tudo | palavra: X | foto: ...  */
  const CHAVES = { titulo: "titulo", "título": "titulo", texto: "texto", linha: "lead", lead: "lead", etapa: "lead", contato: "lead", nome: "lead", nota: "nota", itens: "itens", msgs: "msgs", mensagens: "msgs", palavra: "palavra", foto: "dicaFoto" };
  const TIPO_RE = /^(\d{1,2})[.)]?\s*(gancho|contexto|constru[cç][aã]o|tens[aã]o|recompensa|cta)\s*\|\s*(.*)$/i;
  const tipoDe = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function lerSlide(l) {
    const m = l.match(TIPO_RE); if (!m) return null;
    const s = { tipo: tipoDe(m[2]) };
    m[3].split("|").map((x) => x.trim()).filter(Boolean).forEach((p, k) => {
      const c = p.match(/^([A-Za-zçÇíÍ]+)\s*:\s*([\s\S]*)$/), chave = c && CHAVES[c[1].toLowerCase()];
      if (chave) s[chave] = c[2].trim(); else if (!s.titulo && k === 0) s.titulo = p; else s.texto = s.texto ? `${s.texto} ${p}` : p;
    });
    ["itens", "msgs"].forEach((k) => { if (s[k]) s[k] = s[k].split(/\s*;\s*/).filter(Boolean).join("\n"); });
    return s;
  }
  const escCampo = (v) => txt(v).replace(/\|/g, "/").replace(/\n/g, "; ");
  function emTexto(car) {
    return [`CARROSSEL: ${car.titulo} | estilo: ${car.estilo}`, ...car.slides.map((s, i) => [`${i + 1} ${s.tipo}`, s.titulo ? escCampo(s.titulo) : "",
      ...["texto", "lead", "itens", "msgs", "palavra", "nota"].filter((k) => s[k]).map((k) => `${{ lead: "linha" }[k] || k}: ${escCampo(s[k])}`)].filter(Boolean).join(" | "))].join("\n");
  }
  function lerTexto(texto) {
    const cars = []; let car = null;
    String(texto || "").split("\n").forEach((bruta) => {
      const l = bruta.replace(/^[\s>*•-]+/, "").replace(/^\|/, "").replace(/\|\s*$/, "").trim();
      const mc = l.replace(/\*\*/g, "").match(/^CARROSSEL\s*:\s*(.+)$/i);
      if (mc) { const [tit, ...resto] = mc[1].split("|").map((x) => x.trim()); const me = resto.join(" ").match(/estilo\s*:?\s*(bastidor|revista|conversa|fotos)/i); car = { titulo: tit, estilo: me ? me[1].toLowerCase() : "", slides: [] }; cars.push(car); return; }
      const s = lerSlide(l);
      if (s) { if (!car) { car = { titulo: "Carrossel", estilo: "", slides: [] }; cars.push(car); } car.slides.push(s); }
    });
    return cars.filter((c) => c.slides.length);
  }
  // As regras e o formato, para o pedido ao Claude (plano da semana e ideia solta)
  function formato(estilo) {
    const lista = estilo ? [estilo] : Object.keys(ESTILOS);
    return `Estrutura de 7 slides, nesta ordem: 1 gancho (provoca curiosidade com uma promessa forte), 2 contexto (o problema, direto), 3 e 4 construção (uma ideia só, explicada até não sobrar dúvida: é aqui que entra a autoridade), 5 tensão (desafia o que a pessoa acha), 6 recompensa (o "AHA", a solução clara) e 7 CTA (uma ação só; "comenta PALAVRA que eu te mando..." apenas se eu tiver algo pra mandar, senão portfólio no link da bio).
Carrossel curto: título de até 10 palavras e texto de até 20 por slide, linguagem de conversa, nada de apostila. *palavra* fica em destaque dourado (1 por título) e **palavra** fica em cinza. Não use travessão. O que você não souber de mim vira campo entre parênteses.
Escreva assim, um slide por linha, com o nome de cada campo (o primeiro campo sem nome é o título):
CARROSSEL: título do carrossel | estilo: ${lista.join(" ou ")}
${lista.map((e) => `Estilo ${ESTILOS[e].nome} (${ESTILOS[e].quando}), campos de cada página: ${TIPOS.map(([t, n]) => `${n}: ${ESTILOS[e].campos[t].filter((c) => c !== "foto").map((c) => ({ lead: "linha" }[c] || c)).join(", ")}`).join("; ")}. Exemplo:
${emTexto({ ...EXEMPLOS[e], estilo: e })}`).join("\n\n")}
Nos itens e nas mensagens, separe com ponto e vírgula; num item com explicação use " / ". Se quiser sugerir foto, acrescente | foto: qual foto minha usar.`;
  }

  return {
    ESTILOS, TIPOS, ESTRUTURA, pintar, lerTexto, lerSlide, emTexto, formato,
    campos: (e, t) => (ESTILOS[e] || ESTILOS.bastidor).campos[t] || ["titulo", "texto"],
    rotulo: (e, t, c) => { const r = (ESTILOS[e] || {}).rotulos || {}; return (r[t] || {})[c] || (r._ || {})[c] || ROTULO[c] || c; },
    exemplo: (e) => ({ estilo: e, titulo: EXEMPLOS[e].titulo, slides: JSON.parse(JSON.stringify(EXEMPLOS[e].slides)) }),
    nomeTipo: (t) => (TIPOS.find((x) => x[0] === t) || [0, t])[1]
  };
})();
