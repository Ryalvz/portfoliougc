/* =============================================================
   LINK DA BIO (ugc.ryalvz.com.br/bio/) E "MEUS LINKS" (/bio/links/)
   Guarda tudo no site_conteudo:
     bio_links:  botões extras da página da bio
     indicacoes: cursos que eu indico, com o link de afiliado
   As páginas leem daqui na hora. Os cliques chegam em bio_cliques.
   ============================================================= */
const CATEGORIAS_IND = [["ugc", "UGC Creator"], ["tiktok", "TikTok Shop"], ["outro", "Outro"]];
const bioX = { cliques: null };

async function carregarCliquesBio() {
  const desde = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data, error } = await db.from("bio_cliques").select("pagina,link").gte("criado_em", desde).limit(5000);
  bioX.cliques = {};
  if (error) { bioX.faltaBanco = true; return; }
  bioX.faltaBanco = false;
  (data || []).forEach((c) => { const k = c.pagina + ":" + c.link; bioX.cliques[k] = (bioX.cliques[k] || 0) + 1; });
}
const cliquesDe = (pagina, link) => (bioX.cliques || {})[pagina + ":" + link] || 0;

async function desenharLinkBio(el) {
  if (!sc.dados || bioX.cliques === null) {
    el.innerHTML = `<p class="vazio">Abrindo os seus links...</p>`;
    await Promise.all([sc.dados ? null : carregarSiteConteudo(), carregarCliquesBio()]);
  }
  if (sc.erro) { el.innerHTML = `<div class="aviso-falta">Não consegui ler o conteúdo do site: ${esc(sc.erro)}</div>`; return; }
  const extras = sc.dados.bio_links || [], ind = sc.dados.indicacoes || [], prods = sc.dados.produtos || [];
  const setas = (tipo, i, n) => `<button class="icone-btn" type="button" data-bio-sobe="${tipo}:${i}" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button><button class="icone-btn" type="button" data-bio-desce="${tipo}:${i}" ${i === n - 1 ? "disabled" : ""} aria-label="Descer">↓</button>`;
  const cliques = (pagina, link) => bioX.faltaBanco ? "" : ` · ${plural(cliquesDe(pagina, link), "clique", "cliques")} em 30 dias`;
  const nomeCat = (c) => (CATEGORIAS_IND.find(([k]) => k === c) || [0, "Outro"])[1];
  el.innerHTML = `
    <section class="cartao ig-estr-topo">
      <div><h2 class="rot-titulo">🔗 Link da bio</h2>
        <p class="rot-frase">O que você mudar aqui aparece na hora em <a href="../bio/" target="_blank" rel="noopener"><b>ugc.ryalvz.com.br/bio</b></a>. Os botões de portfólio, WhatsApp e e-mail ficam sempre lá; aqui você põe o resto.</p></div>
      <div class="ig-estr-acoes">
        <a class="btn" href="../bio/" target="_blank" rel="noopener">${ic("link")}Ver a bio</a>
        <a class="btn" href="../bio/links/" target="_blank" rel="noopener">${ic("link")}Ver Meus links</a>
      </div>
    </section>
    ${bioX.faltaBanco ? `<div class="aviso-falta">Falta rodar a parte 38 do banco.sql no Supabase para salvar os links e contar os cliques.</div>` : ""}
    <div class="cartao" style="margin-bottom:16px">
      <div class="barra"><h2 style="margin:0">Produtos que eu indico</h2><span class="sub">página Indicações, fora da bio</span><span class="espaco"></span><a class="btn pequeno" href="../indica/" target="_blank" rel="noopener">${ic("link")}Ver a página</a><button class="btn primario pequeno" type="button" data-prod-novo>${ic("mais")}Adicionar</button></div>
      <p class="sub" style="margin:0 0 8px">Cada produto ganha um link próprio com os botões da Shopee, do Mercado Livre e da Amazon. Copie o link e cole na mensagem da automação do post (Instagram > Automações). Essa página não aparece na bio.</p>
      <ul class="sc-lista">${prods.map((x, i) => `<li class="${x.ativo === false ? "bio-desligado" : ""}">
        <span class="sc-logo">${x.imagem ? `<img src="${esc(urlSite(x.imagem))}" alt="">` : esc((x.titulo || "?").charAt(0).toUpperCase())}</span>
        <span class="sc-txt"><b>${esc(x.titulo)}</b><small>${esc(x.grupo || "Sem grupo")} · ${esc((x.lojas || []).map((l) => LOJAS_PROD[l.loja] || l.nome || "Outra").join(", ") || "sem loja")}${x.ativo === false ? " · desligado" : ""}${bioX.faltaBanco ? "" : ` · ${plural(cliquesProduto(x.slug), "clique", "cliques")} em 30 dias`}</small></span>
        <span class="sc-acoes">${setas("produtos", i, prods.length)}<button class="btn pequeno" type="button" data-prod-copiar="${esc(x.slug)}">Copiar link</button><button class="icone-btn" type="button" data-prod-editar="${i}" aria-label="Editar">${ic("editar")}</button></span></li>`).join("") || `<li class="sub">Nenhum produto ainda. Toque em Adicionar e cole os links de cada loja.</li>`}</ul>
    </div>
    <div class="sc-grade">
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Cursos que eu indico</h2><span class="sub">página Meus links</span><span class="espaco"></span><button class="btn primario pequeno" type="button" data-bio-novo="indicacoes">${ic("mais")}Adicionar</button></div>
        <p class="sub" style="margin:0 0 8px">Seus links de afiliado. Com pelo menos um ligado, aparece o botão <b>Meus links</b> na bio.</p>
        <ul class="sc-lista">${ind.map((x, i) => `<li class="${x.ativo === false ? "bio-desligado" : ""}">
          <span class="sc-logo">${x.imagem ? `<img src="${esc(urlSite(x.imagem))}" alt="">` : "🎓"}</span>
          <span class="sc-txt"><b>${esc(x.titulo)}</b><small>${esc(nomeCat(x.categoria))}${x.destaque ? " · ⭐ destaque" : ""}${x.texto ? " · " + esc(x.texto) : ""}${x.ativo === false ? " · desligado" : ""}${cliques("links", x.titulo)}</small></span>
          <span class="sc-acoes">${setas("indicacoes", i, ind.length)}<button class="icone-btn" type="button" data-bio-editar="indicacoes:${i}" aria-label="Editar">${ic("editar")}</button></span></li>`).join("") || `<li class="sub">Nenhum curso ainda. Toque em Adicionar e cole o seu link de afiliado.</li>`}</ul>
      </div>
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Botões extras da bio</h2><span class="espaco"></span><button class="btn primario pequeno" type="button" data-bio-novo="bio_links">${ic("mais")}Adicionar</button></div>
        <p class="sub" style="margin:0 0 8px">Qualquer link que você quiser na bio: um vídeo, um material, um cupom, uma publi.</p>
        <ul class="sc-lista">${extras.map((x, i) => `<li class="${x.ativo === false ? "bio-desligado" : ""}">
          <span class="sc-logo">${esc(x.emoji || "🔗")}</span>
          <span class="sc-txt"><b>${esc(x.titulo)}</b><small>${esc(x.sub || x.url)}${x.ativo === false ? " · desligado" : ""}${cliques("bio", x.titulo)}</small></span>
          <span class="sc-acoes">${setas("bio_links", i, extras.length)}<button class="icone-btn" type="button" data-bio-editar="bio_links:${i}" aria-label="Editar">${ic("editar")}</button></span></li>`).join("") || `<li class="sub">Nenhum botão extra.</li>`}</ul>
        ${bioX.faltaBanco ? "" : `<p class="sub" style="margin:10px 0 0">Cliques nos fixos em 30 dias: portfólio ${cliquesDe("bio", "portfolio")}, WhatsApp ${cliquesDe("bio", "whatsapp")}, e-mail ${cliquesDe("bio", "email")}, Meus links ${cliquesDe("bio", "meus-links")}.</p>`}
      </div>
    </div>`;
  const mover = async (alvo, passo) => {
    const [tipo, i] = alvo.split(":"); const k = Number(i), lista = [...(sc.dados[tipo] || [])], j = k + passo;
    if (j < 0 || j >= lista.length) return;
    [lista[k], lista[j]] = [lista[j], lista[k]];
    if (await salvarSiteConteudo(tipo, lista)) desenharLinkBio(el);
  };
  $$("[data-bio-sobe]", el).forEach((b) => b.onclick = () => mover(b.dataset.bioSobe, -1));
  $$("[data-bio-desce]", el).forEach((b) => b.onclick = () => mover(b.dataset.bioDesce, 1));
  $$("[data-bio-novo]", el).forEach((b) => b.onclick = () => (b.dataset.bioNovo === "indicacoes" ? formIndicacao(el, null) : formLinkBio(el, null)));
  $$("[data-prod-novo]", el).forEach((b) => b.onclick = () => formProduto(el, null));
  $$("[data-prod-editar]", el).forEach((b) => b.onclick = () => formProduto(el, Number(b.dataset.prodEditar)));
  $$("[data-prod-copiar]", el).forEach((b) => b.onclick = async () => {
    const url = linkProduto(b.dataset.prodCopiar);
    try { await navigator.clipboard.writeText(url); avisar("Link copiado: " + url); } catch (_) { avisar(url); }
  });
  $$("[data-bio-editar]", el).forEach((b) => b.onclick = () => { const [tipo, i] = b.dataset.bioEditar.split(":"); tipo === "indicacoes" ? formIndicacao(el, Number(i)) : formLinkBio(el, Number(i)); });
}

/* ---------- Produtos que eu indico (página /indica/, fora da bio) ----------
   site_conteudo "produtos": [{ slug, titulo, grupo, texto, imagem, ativo,
   lojas: [{ loja: "shopee" | "mercadolivre" | "amazon" | "outra", nome, url, cupom }] }]
   Cada clique numa loja chega em bio_cliques como pagina "indica", link "slug:loja". */
const LOJAS_PROD = { shopee: "Shopee", mercadolivre: "Mercado Livre", amazon: "Amazon" };
const linkProduto = (slug) => `https://ugc.ryalvz.com.br/indica/?p=${encodeURIComponent(slug)}`;
const slugDe = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "produto";
const cliquesProduto = (slug) => Object.entries(bioX.cliques || {}).reduce((t, [k, n]) => t + (k.startsWith("indica:" + slug + ":") ? n : 0), 0);

function formProduto(el, i) {
  const lista = [...(sc.dados.produtos || [])], x = i == null ? { ativo: true, lojas: [] } : lista[i];
  const loja = (k) => (x.lojas || []).find((l) => l.loja === k) || {};
  const grupos = [...new Set(lista.map((p) => p.grupo).filter(Boolean))];
  abrirForm({
    titulo: i == null ? "Novo produto indicado" : `Produto: ${x.titulo}`,
    valores: {
      titulo: x.titulo, grupo: x.grupo, texto: x.texto, slug: x.slug, ativo: x.ativo !== false,
      foto_x: x.foto_x ?? 50, foto_y: x.foto_y ?? 50, foto_zoom: x.foto_zoom ? Math.round(x.foto_zoom * 100) : 100,
      shopee: loja("shopee").url, shopee_cupom: loja("shopee").cupom,
      mercadolivre: loja("mercadolivre").url, mercadolivre_cupom: loja("mercadolivre").cupom,
      amazon: loja("amazon").url, amazon_cupom: loja("amazon").cupom,
      outra_nome: loja("outra").nome, outra: loja("outra").url, outra_cupom: loja("outra").cupom
    },
    campos: [
      { n: "titulo", r: "Nome do produto", req: true, ph: "Ex: Insta360 Ace Pro 2" },
      { n: "grupo", r: "Grupo", ph: grupos.length ? "Ex: " + grupos.slice(0, 3).join(", ") : "Ex: Câmeras, Setup, Celular", ajuda: grupos.length ? "Grupos que você já tem: " + grupos.join(", ") + ". Escreva igual pra ficar junto." : "Os produtos do mesmo grupo aparecem juntos." },
      { n: "texto", r: "O que eu achei (curto, opcional)", t: "textarea", inteiro: true, ph: "Ex: Uso pra gravar os bastidores. O que mais gostei foi a estabilização." },
      { n: "shopee", r: "Link da Shopee", t: "url", ph: "https://..." },
      { n: "shopee_cupom", r: "Cupom Shopee (opcional)" },
      { n: "mercadolivre", r: "Link do Mercado Livre", t: "url", ph: "https://..." },
      { n: "mercadolivre_cupom", r: "Cupom Mercado Livre (opcional)" },
      { n: "amazon", r: "Link da Amazon", t: "url", ph: "https://..." },
      { n: "amazon_cupom", r: "Cupom Amazon (opcional)" },
      { n: "outra_nome", r: "Outra loja: nome (opcional)", ph: "Ex: Site oficial" },
      { n: "outra", r: "Outra loja: link", t: "url", ph: "https://..." },
      { n: "outra_cupom", r: "Outra loja: cupom (opcional)" },
      { n: "imagem_arq", r: "Foto do produto (opcional)", t: "file", accept: "image/png,image/jpeg,image/webp", ajuda: x.imagem ? "Já tem foto. Escolha outra só se quiser trocar." : "De preferência quadrada, com fundo claro." },
      { n: "foto_x", r: "Foto: mover para os lados", t: "range", inteiro: true },
      { n: "foto_y", r: "Foto: mover para cima e para baixo", t: "range", inteiro: true },
      { n: "foto_zoom", r: "Foto: zoom", t: "range", inteiro: true },
      { n: "slug", r: "Final do link (opcional)", ph: "Ex: insta360", ajuda: "Fica ugc.ryalvz.com.br/indica/?p=este-texto. Vazio, eu faço a partir do nome." },
      { n: "ativo", r: "Mostrar na página", t: "check" }
    ],
    aoSalvar: async (d, status) => {
      const lojas = [];
      for (const k of ["shopee", "mercadolivre", "amazon", "outra"]) {
        if (!d[k]) continue;
        if (!linkValido(d[k])) { avisar(`O link da ${LOJAS_PROD[k] || "outra loja"} precisa começar com https://`, true); return false; }
        lojas.push({ loja: k, nome: k === "outra" ? (d.outra_nome || "Outra loja") : LOJAS_PROD[k], url: d[k], cupom: (d[k + "_cupom"] || "").toUpperCase() });
      }
      if (!lojas.length) { avisar("Coloque o link de pelo menos uma loja.", true); return false; }
      const slug = slugDe(d.slug || x.slug || d.titulo);
      if (lista.some((p, j) => j !== i && p.slug === slug)) { avisar(`Já existe um produto com o link "${slug}". Troque o final do link.`, true); return false; }
      let imagem = x.imagem || "";
      if (d.imagem_arq) { status("Enviando a foto..."); imagem = await enviarArquivo(d.imagem_arq, "indicacoes", d.titulo); if (!imagem) return false; }
      const novo = { slug, titulo: d.titulo, grupo: d.grupo || "", texto: d.texto || "", imagem, lojas, ativo: d.ativo,
        foto_x: Number(d.foto_x ?? 50), foto_y: Number(d.foto_y ?? 50), foto_zoom: Number(d.foto_zoom || 100) / 100 };
      if (i == null) lista.push(novo); else lista[i] = novo;
      const ok = await salvarSiteConteudo("produtos", lista);
      if (ok) { desenharLinkBio(el); try { await navigator.clipboard.writeText(linkProduto(slug)); setTimeout(() => avisar("Salvo. Link copiado: " + linkProduto(slug)), 400); } catch (_) {} }
      return ok;
    },
    aoApagar: i == null ? null : async () => { lista.splice(i, 1); const ok = await salvarSiteConteudo("produtos", lista); if (ok) desenharLinkBio(el); return ok; }
  });
  quadroDaFoto(x.imagem ? urlSite(x.imagem) : "");
}

// Quadro da foto no formulário: arrasta a foto pra escolher a parte que aparece,
// zoom com + e -, rodinha do mouse ou pinça. Os valores vão nos campos foto_x, foto_y e foto_zoom (escondidos).
function quadroDaFoto(urlAtual) {
  const d = [...document.querySelectorAll("dialog[open]")].pop();
  if (!d) return;
  const f = $("form", d), cx = f.elements.foto_x, cy = f.elements.foto_y, cz = f.elements.foto_zoom;
  cz.min = 100; cz.max = 300; cz.value = cz.getAttribute("value") || 100;
  [cx, cy, cz].forEach((c) => { c.closest("div").hidden = true; });
  const LADO = 220;
  const caixa = document.createElement("div");
  caixa.className = "inteiro";
  caixa.innerHTML = `<label>Como a foto aparece</label>
    <div style="display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap">
      <div data-quadro style="width:${LADO}px;height:${LADO}px;border-radius:24px;overflow:hidden;border:1px solid #ECE5D9;background:#fff;display:grid;place-items:center;cursor:grab;touch-action:none;user-select:none">
        <img alt="" draggable="false" style="width:100%;height:100%;object-fit:cover;display:none;pointer-events:none"><small class="sub">sem foto</small></div>
      <div style="display:grid;gap:8px">
        <div style="display:flex;gap:8px"><button type="button" class="btn pequeno" data-zoom="-1" aria-label="Diminuir zoom">−</button><button type="button" class="btn pequeno" data-zoom="1" aria-label="Aumentar zoom">+</button></div>
        <button type="button" class="btn pequeno" data-centro>Centralizar</button>
      </div>
    </div>
    <small class="ajuda">Arraste a foto dentro do quadro. Zoom no + e −, na rodinha do mouse ou com dois dedos.</small>`;
  cx.closest("div").before(caixa);
  const quadro = $("[data-quadro]", caixa), img = $("img", caixa), semFoto = $("small", quadro);
  const lim = (v, a, b) => Math.min(b, Math.max(a, v));
  let px = Number(cx.value) || 50, py = Number(cy.value) || 50, z = Number(cz.value) / 100 || 1;
  if (cx.value === "0") px = 0; if (cy.value === "0") py = 0;
  const pintar = () => {
    cx.value = Math.round(px); cy.value = Math.round(py); cz.value = Math.round(z * 100);
    Object.assign(img.style, { objectPosition: `${px}% ${py}%`, transform: `scale(${z})`, transformOrigin: `${px}% ${py}%` });
  };
  const usar = (url) => { img.src = url; img.style.display = url ? "block" : "none"; semFoto.style.display = url ? "none" : "block"; pintar(); };
  const zoom = (fator) => { z = lim(z * fator, 1, 3); pintar(); };
  // Arrastar (um dedo ou o mouse) e pinça (dois dedos)
  const toques = new Map(); let pinca = 0;
  quadro.addEventListener("pointerdown", (e) => { quadro.setPointerCapture(e.pointerId); toques.set(e.pointerId, [e.clientX, e.clientY]); quadro.style.cursor = "grabbing"; });
  quadro.addEventListener("pointermove", (e) => {
    const antes = toques.get(e.pointerId); if (!antes) return;
    toques.set(e.pointerId, [e.clientX, e.clientY]);
    if (toques.size === 2) {
      const [a, b] = [...toques.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinca) zoom(dist / pinca);
      pinca = dist; return;
    }
    px = lim(px - (e.clientX - antes[0]) * 100 / (LADO * z), 0, 100);
    py = lim(py - (e.clientY - antes[1]) * 100 / (LADO * z), 0, 100);
    pintar();
  });
  const soltar = (e) => { toques.delete(e.pointerId); pinca = 0; quadro.style.cursor = "grab"; };
  quadro.addEventListener("pointerup", soltar); quadro.addEventListener("pointercancel", soltar);
  quadro.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
  $$("[data-zoom]", caixa).forEach((b) => b.onclick = () => zoom(b.dataset.zoom === "1" ? 1.2 : 1 / 1.2));
  $("[data-centro]", caixa).onclick = () => { px = 50; py = 50; z = 1; pintar(); };
  usar(urlAtual);
  f.elements.imagem_arq.addEventListener("change", (e) => { const a = e.target.files[0]; if (a) { px = 50; py = 50; z = 1; usar(URL.createObjectURL(a)); } });
}

const linkValido = (u) => /^https?:\/\/\S+\.\S+/i.test(String(u || ""));

function formIndicacao(el, i) {
  const lista = [...(sc.dados.indicacoes || [])], x = i == null ? { ativo: true, categoria: "ugc" } : lista[i];
  abrirForm({
    titulo: i == null ? "Novo curso indicado" : `Curso: ${x.titulo}`,
    valores: { ...x, ativo: x.ativo !== false },
    campos: [
      { n: "titulo", r: "Nome do curso", req: true, ph: "Ex: Método UGC do Zero" },
      { n: "categoria", r: "Tipo", t: "select", op: CATEGORIAS_IND },
      { n: "url", r: "Seu link de afiliado", req: true, t: "url", inteiro: true, ph: "https://..." },
      { n: "texto", r: "Frase curta embaixo do nome", inteiro: true, ph: "Ex: Comece a vender agora no TikTok Shop" },
      { n: "cupom", r: "Cupom (opcional)", ph: "Ex: RYAN10" },
      { n: "destaque", r: "Cartão de destaque (grande, escuro, no topo do grupo)", t: "check" },
      { n: "promessa", r: "Destaque: a promessa grande", t: "textarea", ph: "Ex: O método que me fez sair da CLT e chegar aos *R$ 50 mil por mês*", ajuda: "Coloque *entre asteriscos* o pedaço que fica dourado." },
      { n: "detalhe", r: "Destaque: frase de apoio", t: "textarea" },
      { n: "botao", r: "Destaque: texto do botão", ph: "Quero conhecer" },
      { n: "imagem_arq", r: "Logo do curso (opcional)", t: "file", accept: "image/png,image/jpeg,image/webp", ajuda: x.imagem ? "Já tem capa. Escolha outra só se quiser trocar." : "PNG ou JPG, de preferência quadrada." },
      { n: "ativo", r: "Mostrar na página", t: "check" }
    ],
    aoSalvar: async (d, status) => {
      if (!linkValido(d.url)) { avisar("O link precisa começar com https://", true); return false; }
      let imagem = x.imagem || "";
      if (d.imagem_arq) { status("Enviando a capa..."); imagem = await enviarArquivo(d.imagem_arq, "indicacoes", d.titulo); if (!imagem) return false; }
      const novo = { ...x, titulo: d.titulo, categoria: d.categoria || "outro", url: d.url, texto: d.texto || "", cupom: (d.cupom || "").toUpperCase(), destaque: d.destaque, promessa: d.promessa || "", detalhe: d.detalhe || "", botao: d.botao || "", imagem, ativo: d.ativo };
      if (i == null) lista.push(novo); else lista[i] = novo;
      const ok = await salvarSiteConteudo("indicacoes", lista);
      if (ok) desenharLinkBio(el);
      return ok;
    },
    aoApagar: i == null ? null : async () => { lista.splice(i, 1); const ok = await salvarSiteConteudo("indicacoes", lista); if (ok) desenharLinkBio(el); return ok; }
  });
}

function formLinkBio(el, i) {
  const lista = [...(sc.dados.bio_links || [])], x = i == null ? { ativo: true, emoji: "🔗" } : lista[i];
  abrirForm({
    titulo: i == null ? "Novo botão na bio" : `Botão: ${x.titulo}`,
    valores: { ...x, ativo: x.ativo !== false },
    campos: [
      { n: "titulo", r: "Texto do botão", req: true, ph: "Ex: Meu último vídeo" },
      { n: "emoji", r: "Emoji", ph: "🔗" },
      { n: "sub", r: "Frase pequena embaixo (opcional)", inteiro: true, ph: "Ex: Assiste e me conta o que achou" },
      { n: "url", r: "Link", req: true, t: "url", inteiro: true, ph: "https://..." },
      { n: "ativo", r: "Mostrar na bio", t: "check" }
    ],
    aoSalvar: async (d) => {
      if (!linkValido(d.url)) { avisar("O link precisa começar com https://", true); return false; }
      const novo = { titulo: d.titulo, emoji: d.emoji || "🔗", sub: d.sub || "", url: d.url, ativo: d.ativo };
      if (i == null) lista.push(novo); else lista[i] = novo;
      const ok = await salvarSiteConteudo("bio_links", lista);
      if (ok) desenharLinkBio(el);
      return ok;
    },
    aoApagar: i == null ? null : async () => { lista.splice(i, 1); const ok = await salvarSiteConteudo("bio_links", lista); if (ok) desenharLinkBio(el); return ok; }
  });
}
