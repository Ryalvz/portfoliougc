/* =============================================================
   🎬 ROTEIRO DE GRAVAÇÃO
   Mostra o roteiro de "Minha versão" no formato do modelo do Ryan:
   cabeçalho (marca, título, objetivo, formato) e uma tabela com a
   FALA de um lado e a CENA do outro, em 3 etapas (gancho,
   desenvolvimento, CTA). Serve pra gravar (letra grande) e pra
   mandar pra marca (PDF ou Word).
   ============================================================= */
const BLOCOS_ROT = /^(GANCHO|CONTEXTO|CONTE[ÚU]DO|FECHAMENTO|PROBLEMA|PRODUTO EM USO|POR QUE VALE A PENA|COMPRA|IDENTIFICA[ÇC][ÃA]O|SOLU[ÇC][ÃA]O|PROVA|CTA|DESENVOLVIMENTO|DEMONSTRA[ÇC][ÃA]O|BENEF[ÍI]CIOS?)\b/i;
const tiraAspas = (s) => String(s || "").trim().replace(/^["“”]+|["“”]+$/g, "").trim();
const nomeBloco = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

// "Em “olha esse take”, entra o melhor take" → corta a fala nessa frase e põe a cena do lado
function dividirPorDeixas(fala, cena) {
  const partes = String(cena || "").split(/(?=\b[Ee]m\s+[“"][^”"]+[”"])/);
  const antes = /^\s*[Ee]m\s+[“"]/.test(partes[0]) ? "" : partes.shift().trim().replace(/[.,;]\s*$/, "");
  if (!partes.length || !fala) return [{ fala, cena: String(cena || "").trim() }];
  const letras = [...fala];
  const baixa = letras.map((c) => (c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() || c)[0]).join("");
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const deixas = [];
  partes.forEach((p) => {
    const m = p.match(/^\s*[Ee]m\s+[“"]([^”"]+)[”"]\s*,?\s*([\s\S]*)$/);
    if (!m) return;
    const desc = m[2].trim().replace(/\.\s*$/, "");
    const pos = baixa.indexOf(norm(m[1]).trim());
    if (pos < 0) { deixas.push({ pos: -1, desc }); return; }
    // Volta até o começo da frase onde a deixa aparece
    let ini = 0;
    for (let i = pos - 1; i > 0; i--) if (/[.!?]/.test(letras[i - 1]) && /\s/.test(letras[i])) { ini = i + 1; break; }
    deixas.push({ pos: ini, desc });
  });
  const achadas = deixas.filter((d) => d.pos >= 0).sort((a, b) => a.pos - b.pos);
  const cortes = [...new Set([0, ...achadas.map((d) => d.pos)])];
  const linhas = cortes.map((c, i) => ({ fala: letras.slice(c, cortes[i + 1]).join("").trim(), cena: "" }));
  // Na ordem da cena; a deixa que não achei na fala fica junto da anterior
  let ultima = 0;
  deixas.forEach((d) => {
    if (d.pos >= 0) ultima = cortes.lastIndexOf(d.pos);
    const l = linhas[ultima];
    l.cena = [l.cena, d.desc].filter(Boolean).join(". ");
  });
  if (antes) linhas[0].cena = [antes, linhas[0].cena].filter(Boolean).join(". ");
  return linhas.filter((l) => l.fala || l.cena);
}

// Texto na tela: o que vem entre aspas depois de "texto" dentro da cena
const textosNaTela = (cena) => [...String(cena || "").matchAll(/texto(?:\s+na\s+tela)?[^“"]{0,20}[“"]([^”"]+)[”"]/gi)].map((m) => m[1]);

function lerRoteiroGravacao(texto) {
  const p = partesDoRoteiro(texto);
  const fonte = p.roteiro || p.inicio || String(texto || "");
  const blocos = []; let atual = null;
  const novaLinha = () => { const l = { fala: "", cena: "", tela: [] }; atual.linhas.push(l); return l; };
  const linhaAtual = () => atual.linhas[atual.linhas.length - 1] || novaLinha();
  const limpa = (bruta) => bruta.replace(/^[#>\s*]+/, "").replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim();
  const cabecalho = (l) => { const c = l.match(/^([A-ZÀ-Ü][A-ZÀ-Ü ]+?)\s*(\([^)]*\))?\s*(?::|$)\s*(.*)$/); return c && BLOCOS_ROT.test(c[1]) && c[1] === c[1].toUpperCase() ? c : null; };
  const temBlocos = fonte.split("\n").some((b) => cabecalho(limpa(b)));
  fonte.split("\n").forEach((bruta) => {
    const l = limpa(bruta);
    if (!l) return;
    const cab = cabecalho(l);
    // Antes do primeiro bloco (o "C:" do plano, anotações): fica de fora
    if (!cab && !atual && temBlocos) return;
    if (cab) {
      atual = { nome: nomeBloco(cab[1].trim()), tempo: (cab[2] || "").replace(/[()]/g, ""), linhas: [] };
      blocos.push(atual);
      if (cab[3]) novaLinha().fala = tiraAspas(cab[3]);
      return;
    }
    if (!atual) { atual = { nome: "", tempo: "", linhas: [] }; blocos.push(atual); }
    // [CENA: ...] e [TELA: ...] podem vir sozinhos na linha ou no meio da fala
    let resto = l;
    const cenas = [], telas = [];
    resto = resto.replace(/\[\s*(CENA|IMAGEM|TAKE)\s*:\s*([^\]]*)\]?/gi, (_, __, c) => { cenas.push(c.trim()); return ""; });
    resto = resto.replace(/\[\s*(TEXTO NA TELA|TELA|LETTERING)\s*:\s*([^\]]*)\]?/gi, (_, __, c) => { telas.push(tiraAspas(c)); return ""; });
    const soCena = resto.match(/^(CENA|IMAGEM)\s*:\s*(.+)$/i), soTela = resto.match(/^(TEXTO NA TELA|TELA|LETTERING)\s*:\s*(.+)$/i);
    if (soCena) { cenas.push(soCena[2]); resto = ""; }
    if (soTela) { telas.push(tiraAspas(soTela[2])); resto = ""; }
    resto = tiraAspas(resto);
    if (resto) {
      // Fala nova depois de uma cena: começa outra linha da tabela
      let lin = linhaAtual();
      if (lin.cena) lin = novaLinha();
      lin.fala = [lin.fala, resto].filter(Boolean).join(" ");
    }
    if (cenas.length) { const lin = linhaAtual(); lin.cena = [lin.cena, ...cenas].filter(Boolean).join(" "); }
    if (telas.length) linhaAtual().tela.push(...telas);
  });
  // Quebra as falas longas nas deixas da cena e acha o texto na tela
  blocos.forEach((b) => {
    b.linhas = b.linhas.flatMap((l) => dividirPorDeixas(l.fala, l.cena).map((x, i) => ({ ...x, tela: [...(i === 0 ? l.tela : []), ...textosNaTela(x.cena)] })));
  });
  const validos = blocos.filter((b) => b.linhas.some((l) => l.fala || l.cena));
  const palavras = validos.flatMap((b) => b.linhas).map((l) => l.fala).join(" ").split(/\s+/).filter(Boolean).length;
  return { blocos: validos, ganchos: ganchosDe(p.ganchos), chamada: p.chamada || "", dicas: p.dicas || "", palavras, segundos: Math.round(palavras / 3.25) };
}

// As 3 etapas do modelo: o 1º bloco é o gancho, o último é o CTA, o meio é o desenvolvimento
function etapasDoRoteiro(blocos) {
  if (blocos.length <= 1) return [{ n: 1, nome: "Roteiro", blocos }];
  const meio = blocos.slice(1, -1);
  return [
    { n: 1, nome: "Gancho", tempo: blocos[0].tempo || "0s a 3s", desc: "problema / promessa", blocos: [blocos[0]] },
    ...(meio.length ? [{ n: 2, nome: "Desenvolvimento e demonstração", desc: "ponte de transformação", blocos: meio }] : []),
    { n: meio.length ? 3 : 2, nome: "CTA", desc: "chamada pra ação / fechamento", blocos: [blocos[blocos.length - 1]] }
  ];
}

const META_ROTEIRO = {
  organico: { marca: "Perfil @ryalvz", objetivo: "Conteúdo orgânico (alcance e conexão)", formato: "Reels (9:16 vertical)" },
  tiktok_shop: { marca: "[Nome do produto]", objetivo: "Venda direta no TikTok Shop", formato: "TikTok (9:16 vertical)" },
  publi: { marca: "[Nome da marca]", objetivo: "Conversão", formato: "Reels / TikTok / Anúncio Meta (9:16 vertical)" }
};

function abrirRoteiroGravacao(t, texto) {
  const r = lerRoteiroGravacao(texto != null ? texto : t.minha_versao);
  if (!r.blocos.length) { avisar("Ainda não achei o roteiro: escreva em Minha versão com os blocos (GANCHO, CONTEXTO...) e a cena em [CENA: ...].", true); return; }
  const meta = { ...(META_ROTEIRO[t.categoria] || META_ROTEIRO.organico), titulo: t.titulo || "Roteiro", data: dataBR(hojeISO()) };
  const etapas = etapasDoRoteiro(r.blocos);
  let n = 0;
  const campo = (k, rot) => `<div class="rg-meta-item"><span>${rot}</span><b contenteditable="true" spellcheck="false" data-meta="${k}">${esc(meta[k])}</b></div>`;
  const linha = (l, bloco, mostrarBloco) => { n++; return `<div class="rg-linha">
      <div class="rg-fala"><span class="rg-rot">🗣️ Fala ${n}${mostrarBloco ? ` <i>${esc(bloco)}</i>` : ""}</span>
        <p>${l.fala ? esc(l.fala) : '<span class="rg-vazio">sem fala, só imagem</span>'}</p>
        ${l.tela.length ? `<div class="rg-tela">💬 Texto na tela: ${l.tela.map((x) => `<b>${esc(x)}</b>`).join(" · ")}</div>` : ""}</div>
      <div class="rg-cena"><span class="rg-rot">🎥 Cena ${n}</span><p>${l.cena ? esc(l.cena) : '<span class="rg-vazio">sem cena descrita</span>'}</p></div>
    </div>`; };

  const d = document.createElement("dialog");
  d.className = "rg-janela";
  d.innerHTML = `
    <div class="rg-barra">
      <b class="rg-barra-titulo">🎬 Roteiro de gravação</b><span class="espaco"></span>
      <button type="button" class="btn" data-rg="grande" aria-pressed="false">🔠 Letra grande</button>
      <button type="button" class="btn" data-rg="pdf">📄 PDF</button>
      <button type="button" class="btn" data-rg="word">⬇️ Word</button>
      <button type="button" class="btn primario" data-rg="fechar">Fechar</button>
    </div>
    <div class="rg-folha">
      <header class="rg-cabeca">
        <p class="rg-assina">Roteiro por <em>Ryan Alves</em></p>
        <h1 contenteditable="true" spellcheck="false" data-meta="titulo">${esc(meta.titulo)}</h1>
        <div class="rg-meta">${campo("marca", "Marca / cliente")}${campo("data", "Data")}${campo("objetivo", "Objetivo do vídeo")}${campo("formato", "Formato / plataforma")}
          <div class="rg-meta-item"><span>Duração</span><b>~${r.segundos}s de fala (${r.palavras} palavras)</b></div></div>
      </header>
      <div class="rg-colunas" aria-hidden="true"><span>🗣️ Áudio / fala</span><span>🎥 Imagem / cena</span></div>
      ${etapas.map((e) => `<section class="rg-etapa">
        <h2><span>📍 Etapa ${e.n}</span>${esc(e.nome)}${e.tempo ? ` <small>${esc(e.tempo)}</small>` : ""}${e.desc ? ` <small>${esc(e.desc)}</small>` : ""}</h2>
        ${e.blocos.map((b) => b.linhas.map((l) => linha(l, b.nome, e.blocos.length > 1)).join("")).join("")}
        ${e.n === 1 && r.ganchos.length > 1 ? `<div class="rg-extra"><b>Outras opções de gancho</b><ol>${r.ganchos.map((g) => `<li>“${esc(g)}”</li>`).join("")}</ol></div>` : ""}
      </section>`).join("")}
      ${r.chamada ? `<div class="rg-extra rg-chamada"><b>📣 Chamada final</b><p>${esc(r.chamada).replace(/\n/g, "<br>")}</p></div>` : ""}
      ${r.dicas ? `<details class="rg-extra rg-dicas"><summary><b>🎥 Dicas de gravação</b></summary><p>${esc(r.dicas).replace(/\n/g, "<br>")}</p></details>` : ""}
      <p class="rg-nota">Dá pra tocar no título e no cabeçalho pra mudar antes de baixar. O roteiro em si você muda em Minha versão.</p>
    </div>`;
  document.body.appendChild(d);
  const lerMeta = () => { $$("[data-meta]", d).forEach((x) => { meta[x.dataset.meta] = x.textContent.trim(); }); return meta; };
  const fechar = () => { document.body.classList.remove("imprimindo-rg"); d.close(); d.remove(); };
  d.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
  d.onclick = (e) => {
    const b = e.target.closest("[data-rg]");
    if (!b) return;
    const acao = b.dataset.rg;
    if (acao === "fechar") fechar();
    if (acao === "grande") { const on = d.classList.toggle("rg-grande"); b.setAttribute("aria-pressed", String(on)); }
    if (acao === "pdf") {
      lerMeta();
      const antes = document.title;
      document.title = `Roteiro - ${meta.titulo} - Ryan Alves`;
      document.body.classList.add("imprimindo-rg");
      setTimeout(() => { window.print(); document.body.classList.remove("imprimindo-rg"); document.title = antes; }, 50);
    }
    if (acao === "word") baixarRoteiroWord(lerMeta(), etapas, r);
  };
  d.showModal();
}

// Word: a mesma tabela do modelo (cabeçalho + Fala | Cena por etapa). O Word e o Google Docs abrem o .doc
function baixarRoteiroWord(meta, etapas, r) {
  const e = (s) => esc(s).replace(/\n/g, "<br>");
  const cel = "border:1px solid #CFC5B4;padding:8px 10px;vertical-align:top;font-family:Arial;font-size:10.5pt;";
  const cab = "border:1px solid #CFC5B4;padding:8px 10px;font-family:Arial;font-size:10.5pt;background:#ECE5D9;font-weight:bold;";
  let n = 0;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${e(meta.titulo)}</title></head>
<body style="font-family:Arial">
<p style="font-family:Georgia;font-size:18pt;font-weight:bold;margin:0 0 10pt">${e(meta.titulo)}</p>
<table style="border-collapse:collapse;width:100%">
<tr><td style="${cab}">Marca / Cliente:</td><td style="${cel}">${e(meta.marca)}</td><td style="${cab}">Creator / Criador:</td><td style="${cel}">Ryan Alves</td></tr>
<tr><td style="${cab}">Título do Roteiro:</td><td style="${cel}">${e(meta.titulo)}</td><td style="${cab}">Data:</td><td style="${cel}">${e(meta.data)}</td></tr>
<tr><td style="${cab}">Objetivo do Vídeo:</td><td style="${cel}" colspan="3">${e(meta.objetivo)}</td></tr>
<tr><td style="${cab}">Formato / Plataforma:</td><td style="${cel}" colspan="3">${e(meta.formato)} · ~${r.segundos}s de fala</td></tr>
</table><br>
<table style="border-collapse:collapse;width:100%">
<tr><td style="${cab}width:50%">🗣️ ÁUDIO / FALA (Speech &amp; Voice Over)</td><td style="${cab}width:50%">🎥 IMAGEM / CENA (Captação &amp; Edição)</td></tr>
${etapas.map((et) => `<tr><td colspan="2" style="${cel}background:#2B241C;color:#F6F2EB;font-weight:bold">📍 ETAPA ${et.n}: ${e(et.nome.toUpperCase())}${et.tempo ? ` (${e(et.tempo)})` : ""}${et.desc ? `: ${e(et.desc.toUpperCase())}` : ""}</td></tr>
${et.blocos.map((b) => b.linhas.map((l) => { n++; return `<tr><td style="${cel}"><b>Fala ${n} (Cena ${n}):</b><br>${e(l.fala || "(sem fala)")}${l.tela.length ? `<br><br>💬 <b>Texto na tela:</b> ${e(l.tela.join(" · "))}` : ""}</td><td style="${cel}"><b>Cena ${n}:</b><br>${e(l.cena || "")}</td></tr>`; }).join("")).join("")}`).join("")}
</table>
${r.chamada ? `<p style="font-size:10.5pt"><b>Chamada final:</b> ${e(r.chamada)}</p>` : ""}
</body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/msword" }));
  a.download = `Roteiro - ${meta.titulo.replace(/[\\/:*?"<>|#]+/g, "").slice(0, 80)} - Ryan Alves.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  avisar("Word baixado. Abre no Word ou no Google Docs.");
}
