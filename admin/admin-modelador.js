/* =========================================================
   Modelador de copy (Roteiros)
   Pega a transcrição de um vídeo que você gostou e monta o pedido pro Claude:
   mantém estrutura, tom e ordem; troca produto, dor e cenário.
   Mesmo produto: você marca o que muda (gancho, jeito de falar, história, dor de abertura, oferta).
   Entrega: copy pronta pra gravar + lado a lado do que ficou e do que mudou.
   ========================================================= */
const MOD_MUDAR = [
  ["gancho", "Gancho", "a primeira frase, que para o dedo"],
  ["fala", "Jeito de falar", "as palavras e o ritmo, pro meu jeito"],
  ["historia", "História", "a situação contada no meio"],
  ["dor", "Dor de abertura", "o problema que abre o vídeo"],
  ["oferta", "Oferta", "preço, condição e motivo pra comprar agora"]
];

async function modGrupos() {
  if (typeof ttkX !== "undefined" && ttkX.grupos && Object.keys(ttkX.grupos).length) return Object.values(ttkX.grupos);
  try { const { data } = await db.from("ttk_grupos").select("id,nome,categoria").order("nome"); return data || []; } catch (_) { return []; }
}

async function abrirModelador(t) {
  const texto = String(t.transcricao || "").trim();
  if (!texto) { avisar("Esse vídeo ainda não tem transcrição. Transcreva primeiro e depois modele.", true); return; }
  const [grupos, voz] = await Promise.all([modGrupos(), typeof carregarVoz === "function" ? carregarVoz().catch(() => "") : Promise.resolve("")]);
  const tech = grupos.filter((g) => g.categoria === "tech"), outros = grupos.filter((g) => g.categoria !== "tech");
  const est = { modo: "mesmo", grupo: "", outro: "", info: "", mudar: new Set(["gancho", "fala"]) };

  const montar = () => {
    const mesmo = est.modo === "mesmo";
    const nomeProd = mesmo ? "o mesmo produto do vídeo de referência" : est.modo === "meu" ? ((grupos.find((g) => String(g.id) === est.grupo) || {}).nome || "(escolha o produto)") : (est.outro || "(escreva o produto)");
    const muda = MOD_MUDAR.filter(([k]) => est.mudar.has(k));
    const fica = MOD_MUDAR.filter(([k]) => !est.mudar.has(k));
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
TRANSCRIÇÃO DA REFERÊNCIA (vídeo de ${t.perfil || "outra pessoa"}${t.link ? `, ${t.link}` : ""})
${texto.slice(0, 3000)}

${voz ? `MEU GUIA DE VOZ (use o tom, o ritmo e a lista de proibidos)\n${voz}\n\n` : ""}REGRAS
- Se você tiver a skill "roteiro-ugc", siga as regras de linguagem e a lista de proibidos dela.
- Meu ritmo é 3,25 palavras por segundo. A copy nova fica com a mesma duração da referência (mais ou menos 2 segundos).
- Nunca use travessão. Nunca construa "não é X, é Y" nem variações.
- Uma chamada só no final (uma ação só).
- Nada de número, resultado ou depoimento inventado.
- Não copie frase da referência palavra por palavra, só a função dela, a não ser no que eu marquei pra manter.

ME ENTREGUE ASSIM (use exatamente estes títulos)
MAPA DA REFERÊNCIA: cada bloco da referência em uma linha (nome do bloco, a função dele, segundos).
COPY PRONTA PRA GRAVAR: o texto corrido, do jeito que eu falo, dividido pelos mesmos blocos.
LADO A LADO: uma tabela com as colunas Bloco | Referência | Minha versão | Mantido ou mudado (e o porquê em poucas palavras).
DURAÇÃO: palavras faladas ÷ 3,25 = segundos. Se passar, diga qual frase cortar.
2 GANCHOS ALTERNATIVOS: pra eu gravar junto e testar.
CENA DE PROVA: qual cena mostra o produto funcionando.`;
  };

  const d = abrirJanelaSimples("Modelar copy", `
    <p class="sub" style="margin-top:0">Mantém a estrutura, o tom e a ordem do vídeo. Troca produto, dor e cenário.</p>
    <div class="mod-bloco"><b>Qual produto?</b>
      <div class="pro-abas" role="tablist" aria-label="Produto">
        <button type="button" role="tab" data-mod-modo="mesmo" aria-selected="true">O mesmo do vídeo</button>
        <button type="button" role="tab" data-mod-modo="meu" aria-selected="false">Um dos meus</button>
        <button type="button" role="tab" data-mod-modo="outro" aria-selected="false">Outro produto</button>
      </div>
      <div id="mod-meu" hidden><select class="campo" id="mod-grupo" style="width:100%"><option value="">Escolha o produto da sua vitrine</option>
        ${tech.length ? `<optgroup label="Tech">${tech.map((g) => `<option value="${g.id}">${esc(String(g.nome).slice(0, 80))}</option>`).join("")}</optgroup>` : ""}
        ${outros.length ? `<optgroup label="Outras categorias">${outros.map((g) => `<option value="${g.id}">${esc(String(g.nome).slice(0, 80))}</option>`).join("")}</optgroup>` : ""}</select></div>
      <div id="mod-outro" hidden><input class="campo" id="mod-outro-nome" style="width:100%" placeholder="Nome do produto"></div>
    </div>
    <div class="mod-bloco" id="mod-mudar"><b>O que muda?</b> <span class="sub">o resto fica igual à referência</span>
      <div class="mod-checks">${MOD_MUDAR.map(([k, n, ds]) => `<label><input type="checkbox" data-mod-mudar="${k}" ${est.mudar.has(k) ? "checked" : ""}> <span><b>${n}</b><small>${ds}</small></span></label>`).join("")}</div>
    </div>
    <div class="mod-bloco"><b>O que você sabe do produto</b> <span class="sub">opcional: preço, diferencial, o que vem na caixa</span>
      <textarea class="campo" id="mod-info" rows="2" style="width:100%" placeholder="Ex.: (preço) no carrinho, bateria de (horas), vem com (itens)"></textarea></div>
    <ol class="passos"><li>Toque em <b>Copiar o pedido</b> e cole no Claude.</li><li>Ele devolve a copy pronta e o lado a lado do que ficou e do que mudou.</li><li>Cole a copy final em <b>Minha versão</b> e salve.</li></ol>
    <textarea class="campo" id="mod-prompt" rows="8" style="width:100%;font-size:12px" readonly></textarea>`,
    `<a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude</a><button type="button" class="btn primario" id="mod-copiar">Copiar o pedido</button>`);

  const atualizar = () => {
    $("#mod-meu", d).hidden = est.modo !== "meu";
    $("#mod-outro", d).hidden = est.modo !== "outro";
    $("#mod-mudar", d).hidden = est.modo !== "mesmo";
    $("#mod-prompt", d).value = montar();
    $("#mod-copiar", d).textContent = "Copiar o pedido";
  };
  $$("[data-mod-modo]", d).forEach((b) => b.onclick = () => {
    est.modo = b.dataset.modModo;
    $$("[data-mod-modo]", d).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    atualizar();
  });
  $$("[data-mod-mudar]", d).forEach((c) => c.onchange = () => { if (c.checked) est.mudar.add(c.dataset.modMudar); else est.mudar.delete(c.dataset.modMudar); atualizar(); });
  $("#mod-grupo", d).onchange = (e) => { est.grupo = e.target.value; atualizar(); };
  $("#mod-outro-nome", d).oninput = (e) => { est.outro = e.target.value.trim(); atualizar(); };
  $("#mod-info", d).oninput = (e) => { est.info = e.target.value.trim(); atualizar(); };
  $("#mod-copiar", d).onclick = async () => {
    if (est.modo === "meu" && !est.grupo) { avisar("Escolha qual produto seu vai entrar no lugar.", true); return; }
    if (est.modo === "outro" && !est.outro) { avisar("Escreva o nome do produto.", true); return; }
    try { await navigator.clipboard.writeText($("#mod-prompt", d).value); $("#mod-copiar", d).textContent = "Copiado"; avisar("Pedido copiado. Cole no Claude."); }
    catch (_) { $("#mod-prompt", d).select(); avisar("Selecionei o texto: aperte Cmd + C para copiar.", true); }
  };
  atualizar();
}

// Coloca o botão "Modelar copy" no vídeo aberto em Roteiros (só quando tem link de referência)
(function modLigar() {
  if (typeof pintarDetalheTrans !== "function") return;
  const original = pintarDetalheTrans;
  pintarDetalheTrans = function () {
    original.apply(this, arguments);
    const t = S.transcricoes.find((x) => String(x.id) === String(trans.sel));
    const voz = document.getElementById("t-roteiro-voz");
    if (!t || !t.link || !voz || document.getElementById("t-modelar")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn pequeno"; b.id = "t-modelar"; b.textContent = "Modelar copy";
    b.title = "Mantém estrutura, tom e ordem da referência e troca produto, dor e cenário";
    b.onclick = () => { const ta = document.getElementById("t-transcricao"); abrirModelador({ ...t, transcricao: ta ? ta.value.trim() : t.transcricao, perfil: (document.getElementById("t-perfil") || {}).value || t.perfil }); };
    voz.parentNode.insertBefore(b, voz);
  };
  const st = document.createElement("style");
  st.textContent = `
    .mod-bloco { margin: 10px 0; }
    .mod-bloco .pro-abas { margin: 6px 0; }
    .mod-checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px; margin-top: 6px; }
    .mod-checks label { display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; cursor: pointer; }
    .mod-checks small { display: block; color: var(--muted); font-size: 12px; }`;
  document.head.appendChild(st);
})();
