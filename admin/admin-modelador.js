/* =========================================================
   TikTok > Modelar copy
   Separado dos roteiros de UGC e publi. Usa as referências de TikTok Shop
   (transcricoes com categoria "tiktok_shop" e link).
   Mantém estrutura, tom e ordem; troca produto, dor e cenário.
   Gera o pedido pra colar no Claude; a copy final volta pra "minha_versao" da referência.
   ========================================================= */
const MOD_MUDAR = [
  ["gancho", "Gancho", "a primeira frase, que para o dedo"],
  ["fala", "Jeito de falar", "as palavras e o ritmo, pro meu jeito"],
  ["historia", "História", "a situação contada no meio"],
  ["dor", "Dor de abertura", "o problema que abre o vídeo"],
  ["oferta", "Oferta", "preço, condição e motivo pra comprar agora"]
];
const ttkMod = { sel: null, busca: "", est: {}, voz: null, filtro: "todas" };

const modRefs = () => (S.transcricoes || []).filter((t) => t.categoria === "tiktok_shop" && t.link && t.de_quem !== "minha");
const modEst = (id) => (ttkMod.est[id] = ttkMod.est[id] || { modo: "mesmo", grupo: "", outro: "", info: "", mudar: new Set(["gancho", "fala"]) });

function modPedido(t, est) {
  const grupos = Object.values(ttkX.grupos || {});
  const mesmo = est.modo === "mesmo";
  const nomeProd = est.modo === "meu" ? ((grupos.find((g) => String(g.id) === est.grupo) || {}).nome || "(escolha o produto)") : (est.outro || "(escreva o produto)");
  const muda = MOD_MUDAR.filter(([k]) => est.mudar.has(k)), fica = MOD_MUDAR.filter(([k]) => !est.mudar.has(k));
  return `Você vai MODELAR a copy de um vídeo que deu certo, para eu gravar no meu TikTok Shop (@imryanbr).

O QUE EU MANTENHO DA REFERÊNCIA
- A estrutura (os blocos e a função de cada um)
- O tom de voz
- A ordem dos elementos
${mesmo ? fica.map(([, n, d]) => `- ${n} (${d}): fica igual ou bem perto`).join("\n") : ""}

O QUE EU TRANSFORMO
${mesmo
    ? `O produto é o MESMO do vídeo. Mude só isto:\n${muda.length ? muda.map(([, n, d]) => `- ${n} (${d})`).join("\n") : "- (nada marcado: me pergunte o que mudar antes de escrever)"}`
    : `- Produto: ${nomeProd}\n- Dor: a dor desse produto, grande e comum, que o meu público reconhece\n- Cenário: onde esse produto é usado de verdade no dia a dia`}
${est.info ? `\nO QUE EU SEI DO PRODUTO (use só isto, não invente nada além)\n${est.info}\n` : `\nNão tenho ficha do produto aqui. Qualquer preço, medida, número ou condição que você precisar fica entre parênteses pra eu preencher.\n`}
TRANSCRIÇÃO DA REFERÊNCIA (vídeo de ${t.perfil || "outra pessoa"}, ${t.link})
${String(t.transcricao || "").trim().slice(0, 3000)}

${ttkMod.voz ? `MEU GUIA DE VOZ (use o tom, o ritmo e a lista de proibidos)\n${ttkMod.voz}\n\n` : ""}REGRAS
- Se você tiver a skill "roteiro-ugc", siga as regras de linguagem e a lista de proibidos dela.
- Meu ritmo é 3,25 palavras por segundo. A copy nova fica com a mesma duração da referência (mais ou menos 2 segundos).
- Nunca use travessão. Nunca construa "não é X, é Y" nem variações.
- Uma chamada só no final (uma ação só).
- Nada de número, resultado ou depoimento inventado.
- Não copie frase da referência palavra por palavra, só a função dela, a não ser no que eu marquei pra manter.

ME ENTREGUE ASSIM (use exatamente estes títulos)
MAPA DA REFERÊNCIA: cada bloco da referência em uma linha (nome do bloco, a função dele, segundos).
COPY PRONTA PRA GRAVAR: dividida pelos mesmos blocos. Cada bloco começa numa linha com o nome entre colchetes, ex. [1. Gancho], depois a fala do jeito que eu falo, e embaixo a cena em [CENA: o que aparece na imagem].
LADO A LADO: uma tabela com as colunas Bloco | Referência | Minha versão | Mantido ou mudado (e o porquê em poucas palavras).
DURAÇÃO: palavras faladas ÷ 3,25 = segundos. Se passar, diga qual frase cortar.
2 GANCHOS ALTERNATIVOS: pra eu gravar junto e testar.
CENA DE PROVA: qual cena mostra o produto funcionando.`;
}

function ttkTelaModelar(el) {
  if (ttkMod.voz === null) { ttkMod.voz = ""; if (typeof carregarVoz === "function") carregarVoz().then((v) => { ttkMod.voz = v || ""; }).catch(() => {}); }
  const per = ttkPeriodo();
  const q = ttkMod.busca.toLowerCase();
  const comCopy = modRefs().filter((t) => t.minha_versao).length;
  const refs = modRefs().filter((t) => (ttkMod.filtro !== "copy" || t.minha_versao) && (!q || [t.titulo, t.perfil, t.transcricao, t.minha_versao].some((x) => String(x || "").toLowerCase().includes(q))))
    .sort((a, b) => (b.minha_versao ? 1 : 0) - (a.minha_versao ? 1 : 0));
  if (ttkMod.sel && !modRefs().some((t) => String(t.id) === String(ttkMod.sel))) ttkMod.sel = null;
  const t = ttkMod.sel ? modRefs().find((x) => String(x.id) === String(ttkMod.sel)) : null;
  const grupos = Object.values(ttkX.grupos || {}).sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  const tech = grupos.filter((g) => g.categoria === "tech"), outros = grupos.filter((g) => g.categoria !== "tech");

  const lista = `<div class="ini-card ttk-bloco mod-lista"><div class="ini-card-topo"><h2>Referências do TikTok Shop</h2><span class="sub">${refs.length}</span></div>
      <form class="mod-novo" id="mod-novo"><input class="campo" id="mod-link" type="url" placeholder="Cole o link de um vídeo do TikTok"><button class="btn primario pequeno" type="submit">Transcrever</button></form>
      <p class="sub" style="margin:4px 0 8px">Transcrever usa 1 crédito da Supadata e leva uns 3 minutos.</p>
      <div class="ini-periodo" role="group" aria-label="Mostrar" style="margin-bottom:6px">${[["todas", "Todas"], ["copy", `Com copy pronta (${comCopy})`]].map(([k, n]) => `<button type="button" data-mod-filtro="${k}" aria-pressed="${ttkMod.filtro === k}">${n}</button>`).join("")}</div>
      <input class="campo" id="mod-busca" type="search" placeholder="Buscar" value="${esc(ttkMod.busca)}" style="width:100%;margin-bottom:6px">
      <ul class="mod-itens">${refs.map((r) => { const rod = r.andamento === "processando"; return `<li><button type="button" data-mod-sel="${r.id}" aria-pressed="${String(r.id) === String(ttkMod.sel)}">
        ${r.minha_versao ? `<span class="ini-selo sobe mod-pronta">Copy pronta</span>` : ""}<b>${esc(String(r.titulo || "Sem título").slice(0, 70))}</b><small>${esc(r.perfil ? "@" + String(r.perfil).replace(/^@/, "") : "")}${rod ? " · transcrevendo..." : !r.transcricao ? " · sem transcrição" : ""}</small></button></li>`; }).join("") || `<li><p class="vazio">Nenhuma referência ainda. Cole um link aqui em cima ou mande um vídeo pela aba Sugestões.</p></li>`}</ul></div>`;

  let painel;
  if (!t) painel = `<div class="ini-card ttk-bloco"><p class="vazio">Escolha uma referência ao lado pra modelar a copy.</p></div>`;
  else {
    const est = modEst(t.id), rod = t.andamento === "processando";
    painel = `<div class="ini-card ttk-bloco"><div class="ini-card-topo"><div><h2>${esc(t.titulo || "Sem título")}</h2><span class="sub"><a href="${esc(t.link)}" target="_blank" rel="noopener">Abrir o vídeo</a>${t.perfil ? ` · @${esc(String(t.perfil).replace(/^@/, ""))}` : ""}</span></div></div>
        <h3 class="mod-h">Transcrição da referência</h3>
        ${rod ? `<p class="vazio">Transcrevendo... pode deixar a aba aberta.</p>` : t.transcricao ? `<div class="mod-transcricao">${esc(t.transcricao)}</div>` : `<p class="vazio">Sem transcrição. ${t.erro ? esc(t.erro) : ""}</p><button class="btn pequeno" type="button" id="mod-retranscrever">Transcrever</button>`}
      </div>
      ${t.transcricao && !rod ? `<div class="ini-card ttk-bloco">
        <h3 class="mod-h">1. Qual produto?</h3>
        <div class="ini-periodo" role="group" aria-label="Produto">${[["mesmo", "O mesmo do vídeo"], ["meu", "Um dos meus"], ["outro", "Outro produto"]].map(([k, n]) => `<button type="button" data-mod-modo="${k}" aria-pressed="${est.modo === k}">${n}</button>`).join("")}</div>
        ${est.modo === "meu" ? `<select class="campo" id="mod-grupo" style="width:100%;margin-top:8px"><option value="">Escolha o produto da sua vitrine</option>
          ${tech.length ? `<optgroup label="Tech">${tech.map((g) => `<option value="${g.id}" ${String(g.id) === est.grupo ? "selected" : ""}>${esc(String(g.nome).slice(0, 80))}</option>`).join("")}</optgroup>` : ""}
          ${outros.length ? `<optgroup label="Outras categorias">${outros.map((g) => `<option value="${g.id}" ${String(g.id) === est.grupo ? "selected" : ""}>${esc(String(g.nome).slice(0, 80))}</option>`).join("")}</optgroup>` : ""}</select>` : ""}
        ${est.modo === "outro" ? `<input class="campo" id="mod-outro" style="width:100%;margin-top:8px" placeholder="Nome do produto" value="${esc(est.outro)}">` : ""}
        ${est.modo === "mesmo" ? `<h3 class="mod-h">2. O que muda? <span class="sub">o resto fica igual à referência</span></h3>
          <div class="mod-checks">${MOD_MUDAR.map(([k, n, ds]) => `<label><input type="checkbox" data-mod-mudar="${k}" ${est.mudar.has(k) ? "checked" : ""}> <span><b>${n}</b><small>${ds}</small></span></label>`).join("")}</div>`
          : `<p class="sub" style="margin:8px 0 0">Com outro produto, mudam o produto, a dor e o cenário. Estrutura, tom e ordem ficam da referência.</p>`}
        <h3 class="mod-h">${est.modo === "mesmo" ? "3" : "2"}. O que você sabe do produto <span class="sub">opcional: preço, diferencial, o que vem na caixa</span></h3>
        <textarea class="campo" id="mod-info" rows="2" style="width:100%" placeholder="Ex.: (preço) no carrinho, bateria de (horas), vem com (itens)">${esc(est.info)}</textarea>
        <div class="barra" style="margin-top:10px"><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude</a><span class="espaco"></span><button class="btn primario" type="button" id="mod-copiar">Copiar o pedido</button></div>
        <details class="mod-ver"><summary>Ver o pedido</summary><textarea class="campo" id="mod-prompt" rows="10" style="width:100%;font-size:12px" readonly></textarea></details>
      </div>
      <div class="ini-card ttk-bloco"><h3 class="mod-h" style="margin-top:0">Copy pronta</h3>
        <p class="sub" style="margin:0 0 6px">Cole aqui o que o Claude devolveu e salve. Fica guardado junto com a referência.</p>
        <textarea class="campo" id="mod-final" rows="10" style="width:100%" placeholder="A copy final, pronta pra gravar">${esc(t.minha_versao || "")}</textarea>
        <div class="barra" style="margin-top:8px"><span class="sub" id="mod-salvo"></span><span class="espaco"></span>${typeof abrirRoteiroGravacao === "function" ? `<button class="btn" type="button" id="mod-roteiro">Ver roteiro de gravação</button>` : ""}<button class="btn primario" type="button" id="mod-salvar">Salvar copy</button></div>
      </div>` : ""}`;
  }

  el.innerHTML = ttkCabecalho(per, { titulo: "Modelar copy", comMes: false }) + `
    <p class="ini-frase" style="margin:-4px 0 10px">Pegue um vídeo de TikTok Shop que deu certo: mantém a estrutura, o tom e a ordem, e troca produto, dor e cenário.</p>
    <div class="mod-grade">${lista}<div class="mod-painel">${painel}</div></div>`;
  modLigar(el, t);
}

function modLigar(el, t) {
  const redesenhar = () => { const y = window.scrollY; desenharTikTok(el); window.scrollTo(0, y); };
  const q = (s) => el.querySelector(s);
  el.querySelectorAll("[data-mod-filtro]").forEach((b) => b.onclick = () => { ttkMod.filtro = b.dataset.modFiltro; redesenhar(); });
  el.querySelectorAll("[data-mod-sel]").forEach((b) => b.onclick = () => { ttkMod.sel = b.dataset.modSel; redesenhar(); });
  const busca = q("#mod-busca");
  if (busca) busca.oninput = (e) => { ttkMod.busca = e.target.value; clearTimeout(modLigar.tm); modLigar.tm = setTimeout(() => { desenharTikTok(el); const b = el.querySelector("#mod-busca"); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); } }, 300); };
  const novo = q("#mod-novo");
  if (novo) novo.onsubmit = async (e) => {
    e.preventDefault();
    let link = q("#mod-link").value.trim();
    if (!/^https?:\/\/.*tiktok\.com\//i.test(link)) { avisar("Cole um link de vídeo do TikTok.", true); return; }
    link = limparLink(link);
    if (/(vm|vt)\.tiktok\.com\//i.test(link) && typeof chamarTranscrever === "function") { const r = await chamarTranscrever({ acao: "resolver", link }); if (r && r.link) link = limparLink(r.link); }
    const igual = (S.transcricoes || []).find((x) => x.link && limparLink(x.link) === link);
    if (igual) {
      if (igual.categoria !== "tiktok_shop") await gravar("transcricoes", { categoria: "tiktok_shop" }, igual.id);
      ttkMod.sel = String(igual.id); await recarregar("transcricoes"); redesenhar(); avisar("Esse vídeo já estava salvo. Abri ele aqui."); return;
    }
    await modSalvarReferencia(link, { titulo: "Referência TikTok Shop" }, el);
  };
  if (!t) return;
  const ret = q("#mod-retranscrever");
  if (ret) ret.onclick = () => { transcreverVideo(t).then(() => { if (ttkX.sub === "modelar" && document.body.contains(el)) redesenhar(); }); setTimeout(redesenhar, 300); };
  const est = modEst(t.id);
  const atualizar = () => { const p = q("#mod-prompt"); if (p) p.value = modPedido(t, est); const c = q("#mod-copiar"); if (c) c.textContent = "Copiar o pedido"; };
  el.querySelectorAll("[data-mod-modo]").forEach((b) => b.onclick = () => { est.modo = b.dataset.modModo; redesenhar(); });
  el.querySelectorAll("[data-mod-mudar]").forEach((c) => c.onchange = () => { if (c.checked) est.mudar.add(c.dataset.modMudar); else est.mudar.delete(c.dataset.modMudar); atualizar(); });
  if (q("#mod-grupo")) q("#mod-grupo").onchange = (e) => { est.grupo = e.target.value; atualizar(); };
  if (q("#mod-outro")) q("#mod-outro").oninput = (e) => { est.outro = e.target.value.trim(); atualizar(); };
  if (q("#mod-info")) q("#mod-info").oninput = (e) => { est.info = e.target.value.trim(); atualizar(); };
  if (q("#mod-copiar")) q("#mod-copiar").onclick = async () => {
    if (est.modo === "meu" && !est.grupo) { avisar("Escolha qual produto seu vai entrar no lugar.", true); return; }
    if (est.modo === "outro" && !est.outro) { avisar("Escreva o nome do produto.", true); return; }
    const txt = modPedido(t, est);
    try { await navigator.clipboard.writeText(txt); q("#mod-copiar").textContent = "Copiado"; avisar("Pedido copiado. Cole no Claude."); }
    catch (_) { const p = q("#mod-prompt"); p.closest("details").open = true; p.select(); avisar("Selecionei o texto: aperte Cmd + C para copiar.", true); }
  };
  if (q("#mod-roteiro")) q("#mod-roteiro").onclick = () => {
    const v = q("#mod-final").value.trim();
    if (!v) { avisar("Cole a copy pronta aqui primeiro.", true); return; }
    const grupos = Object.values(ttkX.grupos || {});
    const produto = est.modo === "meu" ? (grupos.find((g) => String(g.id) === est.grupo) || {}).nome : est.modo === "outro" ? est.outro : "";
    abrirRoteiroGravacao({ ...t, categoria: "tiktok_shop", ...(produto ? { marca: String(produto).slice(0, 60) } : {}), nota: "Dá pra tocar no título e no cabeçalho pra mudar antes de baixar. O texto você muda em Copy pronta." }, modParaRoteiro(v));
  };
  if (q("#mod-salvar")) q("#mod-salvar").onclick = async () => {
    const v = q("#mod-final").value.trim();
    if (await gravar("transcricoes", { minha_versao: v || null }, t.id)) { t.minha_versao = v; q("#mod-salvo").textContent = "Salvo. Fica nesta referência, em Com copy pronta."; setTimeout(redesenhar, 1200); }
  };
  atualizar();
}

// Converte a resposta do Modelar copy pro formato do "Roteiro de gravação" (GANCHO ... CTA, GANCHOS, DICAS)
const MOD_SECOES = [["mapa", /^MAPA\b/i], ["copy", /^COPY PRONTA\b/i], ["lado", /^LADO A LADO\b/i], ["duracao", /^DURA[ÇC][ÃA]O\b/i], ["ganchos", /^(\d+\s+)?GANCHOS?\s+ALTERNATIVOS?\b/i], ["prova", /^CENA DE PROVA\b/i]];
function modParaRoteiro(texto) {
  const partes = { antes: [] }; let atual = "antes";
  String(texto || "").split("\n").forEach((bruta) => {
    const l = bruta.replace(/^[#>\s*]+/, "").replace(/\*\*/g, "").trim();
    const achou = l.length < 80 && MOD_SECOES.find(([, re]) => re.test(l.replace(/^\d+[.)]\s*/, "")));
    if (achou) { atual = achou[0]; partes[atual] = []; const resto = l.replace(/^[^:]*:\s*/, ""); if (resto && resto !== l) partes[atual].push(resto); return; }
    (partes[atual] = partes[atual] || []).push(bruta);
  });
  if (!partes.copy) return texto; // não veio no formato do modelador: usa como está
  // Cabeçalhos de bloco: "[1. Gancho]", "1. GANCHO", "**Gancho**"
  const cab = /^\s*(?:\[\s*)?(?:\*\*)?\s*(?:\d+[.)-]?\s*)?([A-Za-zÀ-ú][^\]\n:*]{1,50}?)(?:\*\*)?\s*(?:\]|:)?\s*$/;
  const linhas = partes.copy.filter((l) => l.trim());
  const ehCab = (l) => /^\s*\[(?!\s*(CENA|TELA|TEXTO|IMAGEM|TAKE)\s*:)/i.test(l) || (/^\s*(\*\*|\d+[.)])/.test(l) && cab.test(l) && l.trim().length < 60);
  const nomes = linhas.filter(ehCab);
  const mapear = (nome, i) => {
    if (i === 0) return "GANCHO";
    if (i === nomes.length - 1) return "CTA";
    const n = nome.toLowerCase();
    if (/dor|obje|problema/.test(n)) return "PROBLEMA";
    if (/hist[óo]ria|contexto|identifica/.test(n)) return "IDENTIFICAÇÃO";
    if (/uso|demonstr|mostra/.test(n)) return "DEMONSTRAÇÃO";
    if (/prova|resultado/.test(n)) return "PROVA";
    if (/vale|oferta|benef|atribut/.test(n)) return "POR QUE VALE A PENA";
    if (/solu/.test(n)) return "SOLUÇÃO";
    return "DESENVOLVIMENTO";
  };
  let i = -1;
  const copy = linhas.map((l) => {
    if (!ehCab(l)) return l;
    i++; const nome = (l.match(cab) || [])[1] || l.replace(/[[\]*]/g, "").trim();
    return `${mapear(nome.trim(), i)} (${nome.trim()})`;
  }).join("\n");
  const juntar = (k) => (partes[k] || []).join("\n").trim();
  const dicas = [juntar("prova") && `Cena de prova: ${juntar("prova")}`].filter(Boolean).join("\n\n");
  return `ROTEIRO\n${copy}\n\nGANCHOS\n${juntar("ganchos")}\n\nDICAS DE GRAVAÇÃO\n${dicas}`;
}

// Salva um vídeo como referência de TikTok Shop e começa a transcrição (usado aqui e na aba Sugestões)
async function modSalvarReferencia(link, extra, el) {
  const perfil = (link.match(/tiktok\.com\/@([^/?]+)/) || [])[1] || null;
  const dados = { link, plataforma: "tiktok", categoria: "tiktok_shop", status: "ideia", de_quem: "outra", perfil, andamento: "processando", ...extra };
  const limpo = {}; Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
  const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
  if (error) { avisar(traduzErro(error), true); return null; }
  await recarregar("transcricoes");
  const novo = S.transcricoes.find((x) => String(x.id) === String(data.id));
  if (novo) transcreverVideo(novo).then(() => { if (ttkX.sub === "modelar" && el && document.body.contains(el)) desenharTikTok(el); });
  ttkMod.sel = String(data.id);
  if (el) { if (ttkX.sub === "modelar") desenharTikTok(el); }
  avisar("Salvo. A transcrição chega em uns 3 minutos (1 crédito da Supadata).");
  return novo;
}

(function modEstilo() {
  const st = document.createElement("style");
  st.textContent = `
    .mod-grade { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 14px; align-items: start; }
    .mod-painel { display: grid; gap: 14px; min-width: 0; }
    .mod-painel .ttk-bloco, .mod-lista { margin: 0; }
    .mod-novo { display: flex; gap: 6px; }
    .mod-novo .campo { flex: 1; min-width: 0; }
    .mod-itens { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; max-height: 70vh; overflow: auto; }
    .mod-itens button { width: 100%; text-align: left; background: none; border: 1px solid transparent; border-radius: 10px; padding: 8px 10px; cursor: pointer; font: inherit; color: inherit; }
    .mod-itens button:hover { background: var(--tint); }
    .mod-itens button[aria-pressed="true"] { background: var(--tint); border-color: var(--line); }
    .mod-itens b { display: block; font-size: 13px; font-weight: 600; }
    .mod-itens small { color: var(--muted); font-size: 12px; }
    .mod-pronta { display: inline-block; margin-bottom: 3px; font-size: 11px; }
    .mod-h { font-size: 14px; margin: 14px 0 6px; }
    .mod-transcricao { white-space: pre-wrap; font-size: 13.5px; line-height: 1.55; max-height: 260px; overflow: auto; background: var(--tint); border-radius: 10px; padding: 10px 12px; }
    .mod-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; }
    .mod-checks label { display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; cursor: pointer; }
    .mod-checks small { display: block; color: var(--muted); font-size: 12px; }
    .mod-ver { margin-top: 8px; font-size: 13px; }
    @media (max-width: 860px) { .mod-grade { grid-template-columns: 1fr; } }`;
  document.head.appendChild(st);
})();
