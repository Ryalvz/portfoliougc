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
  const extras = sc.dados.bio_links || [], ind = sc.dados.indicacoes || [];
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
    <div class="sc-grade">
      <div class="cartao">
        <div class="barra"><h2 style="margin:0">Cursos que eu indico</h2><span class="sub">página Meus links</span><span class="espaco"></span><button class="btn primario pequeno" type="button" data-bio-novo="indicacoes">${ic("mais")}Adicionar</button></div>
        <p class="sub" style="margin:0 0 8px">Seus links de afiliado. Com pelo menos um ligado, aparece o botão <b>Meus links</b> na bio.</p>
        <ul class="sc-lista">${ind.map((x, i) => `<li class="${x.ativo === false ? "bio-desligado" : ""}">
          <span class="sc-logo">${x.imagem ? `<img src="${esc(urlSite(x.imagem))}" alt="">` : "🎓"}</span>
          <span class="sc-txt"><b>${esc(x.titulo)}</b><small>${esc(nomeCat(x.categoria))}${x.texto ? " · " + esc(x.texto) : ""}${x.ativo === false ? " · desligado" : ""}${cliques("links", x.titulo)}</small></span>
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
  $$("[data-bio-editar]", el).forEach((b) => b.onclick = () => { const [tipo, i] = b.dataset.bioEditar.split(":"); tipo === "indicacoes" ? formIndicacao(el, Number(i)) : formLinkBio(el, Number(i)); });
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
      { n: "imagem_arq", r: "Logo do curso (opcional)", t: "file", accept: "image/png,image/jpeg,image/webp", ajuda: x.imagem ? "Já tem capa. Escolha outra só se quiser trocar." : "PNG ou JPG, de preferência quadrada." },
      { n: "ativo", r: "Mostrar na página", t: "check" }
    ],
    aoSalvar: async (d, status) => {
      if (!linkValido(d.url)) { avisar("O link precisa começar com https://", true); return false; }
      let imagem = x.imagem || "";
      if (d.imagem_arq) { status("Enviando a capa..."); imagem = await enviarArquivo(d.imagem_arq, "indicacoes", d.titulo); if (!imagem) return false; }
      const novo = { ...x, titulo: d.titulo, categoria: d.categoria || "outro", url: d.url, texto: d.texto || "", cupom: (d.cupom || "").toUpperCase(), imagem, ativo: d.ativo };
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
