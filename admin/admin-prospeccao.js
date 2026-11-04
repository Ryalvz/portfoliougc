/* =============================================================
   ADMIN, PARTE 8: Prospecção por caminhos
   Os 5 caminhos (Chrome, Instagram, LinkedIn, e-commerces e ES),
   a etapa de cada marca, a ficha completa com checagens e histórico,
   e a trava de e-mail não verificado. Tudo usa a mesma tabela
   "marcas": nada é duplicado.
   ============================================================= */
const ETAPAS = [["nova", "Nova"], ["verificada", "Verificada"], ["contatada", "Contatada"], ["respondeu", "Respondeu"], ["negociando", "Negociando"], ["fechou", "Fechou"], ["descartada", "Descartada"]];
const nomeEtapa = (e) => (ETAPAS.find((x) => x[0] === e) || [e, e || "Nova"])[1];
const OPCOES_CREATOR = [["", "Não informado"], ["sim", "Sim"], ["nao", "Não"], ["nao_sei", "Não sei"]];
const OPCOES_LOJA = [["", "Não informado"], ["site", "Site próprio"], ["marketplace", "Marketplace"], ["so_dm", "Só por DM"]];
const CANAIS = [["email", "E-mail"], ["whatsapp", "WhatsApp"], ["dm", "DM do Instagram"], ["linkedin", "LinkedIn"], ["ligacao", "Ligação"], ["presencial", "Presencial"], ["outro", "Outro"]];
const PORTFOLIO_URL = "https://ugc.ryalvz.com.br/";

// O fim de todo prompt: a planilha volta com as colunas que o painel importa sozinho
const FORMATO_PLANILHA = `

Formato da planilha (é para eu importar no meu painel): um arquivo CSV com estes títulos na primeira linha, nesta ordem:
marca, nicho, cidade_uf, instagram, seguidores, site, link_produto, contato_nome, contato_cargo, linkedin, email, email_verificado, whatsapp, ja_usa_creator, loja_online, observacao

Regras das colunas:
email_verificado: escreva "sim" só se você viu esse e-mail publicado no site oficial, no perfil ou numa página da própria marca. Se não conseguiu confirmar, escreva "não".
ja_usa_creator: sim, não ou não sei.
loja_online: site, marketplace ou só DM.
observacao: o gancho, ou seja, o detalhe específico dessa marca que eu posso citar no e-mail.
Deixe em branco o que não se aplica.`;

const CAMINHOS = [
  {
    id: "chrome", nome: "Pesquisa no Chrome", icone: "busca", meta: 8, rotuloMeta: "marcas boas depois da limpeza",
    objetivo: "Achar marcas a partir de um produto específico.",
    campos: [{ k: "produto", r: "Produto", ph: "Ex.: fone bluetooth" }, { k: "qtd", r: "Quantidade", op: ["10", "20", "30"], padrao: "20" }],
    prompt: (c) => `Sou criador de conteúdo UGC e faço vídeos para marcas. Quero encontrar empresas para prospectar como clientes.

Meu foco: empresas que vendam ou produzam ${c.produto || "[PRODUTO]"}.

Encontre ${c.qtd || "20"} empresas diferentes que tenham esse produto e monte uma planilha com estas colunas:
nome da empresa · link do produto · link do Instagram · quantidade de seguidores · e-mail do responsável ou do setor de marketing · outro contato, como WhatsApp · observações suas sobre a marca.

Se você não encontrar o e-mail, escreva "não encontrado". Não invente contato.

Me mande a planilha pronta para baixar.`,
    checagens: ["O Instagram existe e postou nos últimos 30 dias", "O e-mail é de uma pessoa ou do marketing, não do suporte técnico", "A marca vende no Brasil e entrega na região", "O link do produto abre e é o produto certo"]
  },
  {
    id: "instagram", nome: "Instagram (via Google)", icone: "insta", meta: 20, rotuloMeta: "marcas checadas",
    objetivo: "Achar marcas pequenas e em crescimento que o algoritmo não mostra.",
    campos: [{ k: "nicho", r: "Nicho e produtos", ph: "Ex.: skincare masculino e barbear" }, { k: "qtd", r: "Quantidade", op: ["10", "20", "30"], padrao: "20" }],
    prompt: (c) => `Quero fechar parceria com marcas que vendam ${c.nicho || "[NICHO E PRODUTOS]"}.

Encontre marcas brasileiras com até 50 mil seguidores no Instagram. Prefiro marcas novas, que estão começando a aparecer.

Me traga ${c.qtd || "20"} marcas, em lista, com:
@ do perfil · link do Instagram · quantos seguidores · o que ela vende · se ela já postou vídeo feito por creator · e-mail ou forma de contato que estiver no perfil ou no site.

Não repita marca grande e conhecida. O foco é quem está crescendo agora.`,
    checagens: ["Posta com frequência? (parada há 3 meses significa sem verba)", "Tem loja online ou vende só por DM? (muda o tipo de vídeo oferecido)", "Os vídeos são caseiros? (a dor está visível no feed)", "Já marcou creator? (entende o formato e tem verba)", "Tem e-mail no perfil? (anotar junto com o @)"],
    nota: "Marca que nunca usou creator precisa de mais explicação. No e-mail, mostre o antes e depois: o vídeo caseiro dela ao lado do que você entrega."
  },
  {
    id: "linkedin", nome: "LinkedIn", icone: "marcas", meta: 10, rotuloMeta: "pessoas com nome e cargo",
    objetivo: "Chegar em quem decide, não só na empresa.",
    campos: [{ k: "nicho", r: "Nicho", ph: "Ex.: tecnologia e aplicativos" }, { k: "qtd", r: "Quantidade", op: ["10", "15", "20"], padrao: "15" }],
    prompt: (c) => `Estou procurando novos clientes para oferecer meu trabalho como criador de conteúdo UGC.

Encontre no LinkedIn pessoas responsáveis pelo marketing de empresas brasileiras do nicho de ${c.nicho || "[NICHO, ex.: tecnologia e aplicativos]"}.

Me traga ${c.qtd || "15"} pessoas, com:
nome · cargo · empresa · link do perfil no LinkedIn · Instagram da empresa · se a empresa já falou alguma coisa sobre UGC ou creator.

Prefiro analista, coordenador ou gerente de marketing, não o dono da empresa.`,
    checagens: ["Convite com nota de 2 linhas: quem sou e por que essa empresa, sem proposta no primeiro contato", "Falar de resultado (venda, teste, conversão), não de \"amo criar conteúdo\"", `Mandar link do portfólio, nunca anexo: ${PORTFOLIO_URL}`],
    nota: "Faça poucas buscas por dia no LinkedIn para a conta não ser restringida."
  },
  {
    id: "ecommerce", nome: "Listas dos e-commerces", icone: "campanhas", meta: 20, rotuloMeta: "marcas",
    objetivo: "Volume e recorrência com vídeo para página de produto e anúncio (clip).",
    passos: ["Abrir a página de marcas da Shopee (Shopee Brands)", "Escolher a categoria", "Com a página aberta, rodar o prompt", "Repetir na Amazon e no Mercado Livre"],
    campos: [{ k: "nicho", r: "Nicho", ph: "Ex.: casa e cozinha" }, { k: "qtd", r: "Quantidade", op: ["10", "20", "30"], padrao: "20" }],
    prompt: (c) => `Esta página tem a lista de marcas que vendem neste e-commerce.

Separe as marcas do nicho de ${c.nicho || "[NICHO]"} e, para cada uma, procure:
Instagram · quantos seguidores · site próprio · e-mail de contato ou de marketing · se ela já usa vídeo de creator na página do produto.

Me devolva ${c.qtd || "20"} marcas em planilha, da menor para a maior em seguidores.

Se não achar o contato, escreva "não encontrado".`,
    checagens: [],
    nota: "Clip de marketplace puxa o preço para baixo. Use como fonte de recorrência, sem deixar que vire o principal."
  },
  {
    id: "es_local", nome: "Marcas do Espírito Santo", icone: "casa", meta: 20, rotuloMeta: "marcas, 10 com loja online",
    objetivo: "Marcas capixabas: menos concorrência e o diferencial de estar perto (gravar presencial, produto em 1 dia, visitar a loja).",
    passos: ["Google e Google Maps: \"[nicho] Vitória ES\", \"[nicho] Vila Velha\", \"loja [nicho] Serra / Cariacica / Guarapari\"", "Instagram por hashtag e localização: #vitoriaes, #vilavelha, #feitonoes, #marcacapixaba, #capixaba, Praia do Canto, Praia da Costa, Jardim Camburi", "Lojas dos shoppings locais (Shopping Vitória, Shopping Vila Velha, Shopping Praia da Costa)", "Expositores de feiras e eventos do ES (Sebrae/ES, Findes)", "Perfis e páginas que fazem curadoria de marcas capixabas"],
    campos: [{ k: "nicho", r: "Nichos", ph: "tech, lifestyle, moda, grooming, casa, alimentação", padrao: "tech, lifestyle, moda, grooming, casa, alimentação" }, { k: "qtd", r: "Quantidade", op: ["10", "20", "30"], padrao: "20" }],
    prompt: (c) => `Sou criador de conteúdo UGC, moro em Vila Velha (ES) e faço vídeos para marcas. Quero prospectar marcas do Espírito Santo como clientes.

Encontre marcas com sede no Espírito Santo (Vitória, Vila Velha, Serra, Cariacica, Guarapari ou interior) nos nichos de ${c.nicho || "[tech, lifestyle, moda, grooming, casa, alimentação]"}.

Procure no Google, no Google Maps, em hashtags capixabas como #feitonoes e #marcacapixaba, e em listas de lojas de shoppings e de expositores de feiras do ES.

Me traga ${c.qtd || "20"} marcas em planilha, com:
nome da marca · cidade · nicho · link do Instagram · quantidade de seguidores · site ou loja online · se vende fora do ES · e-mail ou WhatsApp que estiver no perfil ou no site · se já postou vídeo feito por creator · observações suas sobre a marca.

Prefiro marcas locais com loja online ou que vendem para fora do estado. Não inclua franquias de rede nacional.

Se não encontrar o contato, escreva "não encontrado". Não invente contato.`,
    checagens: ["É marca do ES de verdade, não franquia nacional", "Postou nos últimos 30 dias", "Tem loja online ou vende para fora do ES (verba e necessidade de vídeo para escalar)", "O conteúdo atual é fraco ou caseiro (a dor está visível)", "Tem e-mail ou WhatsApp comercial"],
    nota: "Abra com proximidade (\"sou de Vila Velha, acompanho a marca de perto\"). Ofereça o que a creator de SP não oferece: gravação presencial, visita à loja, prazo curto. Em marca pequena local, o WhatsApp comercial costuma responder mais rápido. Mantenha o preço da tabela: local não é sinônimo de desconto."
  }
];
const caminhoPorId = (id) => CAMINHOS.find((c) => c.id === id);
const nomeCaminho = (id) => (caminhoPorId(id) || { nome: "Não informado" }).nome;
const OPCOES_CAMINHO = [["nao_informado", "Não informado"], ...CAMINHOS.map((c) => [c.id, c.nome])];
const FECHAMENTO = ["Peguei marcas pelos 5 caminhos", "Juntei tudo na tabela única, com o caminho de origem", "Apaguei as repetidas", "Verifiquei os e-mails antes de qualquer disparo", "Toda marca tem uma observação específica (o gancho do e-mail)", "Tenho 30 marcas ou mais"];
const montarPrompt = (cam, campos) => cam.prompt(campos || {}) + FORMATO_PLANILHA;

/* ---------- Duplicidade: mesmo @, mesmo domínio ou mesmo nome ---------- */
const PROVEDORES_LIVRES = /^(gmail|hotmail|outlook|live|yahoo|icloud|me|uol|bol|terra|ig|globo|msn|protonmail|aol)\./;
function dominioDe(v) {
  const t = String(v || "").trim().toLowerCase();
  if (!t) return "";
  const d = (t.includes("@") && !/^https?:/.test(t) ? t.split("@").pop() : t.replace(/^https?:\/\//, "").split(/[/?#]/)[0]).replace(/^www\./, "");
  return /\.[a-z]{2,}$/.test(d) && !PROVEDORES_LIVRES.test(d) ? d : "";
}
function chavesDaMarca(m) {
  const ks = [];
  const nome = semAcento(m.nome).replace(/[^a-z0-9]/g, "");
  if (nome) ks.push("n:" + nome);
  const ig = String(m.instagram || "").match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const h = (ig ? ig[1] : String(m.instagram || "")).replace(/^@+/, "").trim().toLowerCase();
  if (h && /^[a-z0-9._]+$/.test(h)) ks.push("@:" + h);
  const em = primeiroEmail(m);
  if (em) ks.push("e:" + em);
  [m.site, em].map(dominioDe).filter(Boolean).forEach((d) => ks.push("d:" + d));
  return [...new Set(ks)];
}
function marcaRepetida(m, ignorarId) {
  const ks = new Set(chavesDaMarca(m));
  if (!ks.size) return null;
  return S.marcas.find((x) => String(x.id) !== String(ignorarId) && chavesDaMarca(x).some((k) => ks.has(k))) || null;
}
const motivoRepetida = (a, b) => {
  const kb = new Set(chavesDaMarca(b)), k = chavesDaMarca(a).find((x) => kb.has(x)) || "";
  return k.startsWith("@:") ? "o mesmo @" : k.startsWith("d:") ? `o mesmo domínio (${k.slice(2)})` : k.startsWith("e:") ? "o mesmo e-mail" : "o mesmo nome";
};

/* ---------- A rodada (meta, checklist e campos de cada caminho) ---------- */
const pc = { rodada: null, carregando: false, falta: false, aberto: new Set(), timer: null };
function rodadaPadrao() { return { inicio: hojeISO(), fechamento: {}, caminhos: {} }; }
async function carregarRodada() {
  if (pc.carregando || pc.rodada) return;
  pc.carregando = true;
  const { data, error } = await db.from("prospeccao_rodada").select("valor").eq("chave", "rodada").maybeSingle();
  pc.falta = !!error;
  pc.rodada = Object.assign(rodadaPadrao(), (data && data.valor) || {});
  pc.carregando = false;
  if (abaAtual === "prospeccao") desenhar();
}
function salvarRodada() {
  clearTimeout(pc.timer);
  pc.timer = setTimeout(async () => {
    if (pc.falta) return;
    const { error } = await db.from("prospeccao_rodada").upsert({ chave: "rodada", valor: pc.rodada, atualizado_em: new Date().toISOString() });
    if (error) avisar(traduzErro(error), true);
  }, 600);
}
const estadoCaminho = (id) => {
  const r = pc.rodada.caminhos[id] || (pc.rodada.caminhos[id] = {});
  const cam = caminhoPorId(id);
  r.campos = r.campos || {};
  cam.campos.forEach((f) => { if (r.campos[f.k] == null && f.padrao) r.campos[f.k] = f.padrao; });
  r.checks = r.checks || {};
  if (!r.meta) r.meta = cam.meta;
  return r;
};
// Marcas que entraram por esse caminho nesta rodada (sem as descartadas)
const marcasDaRodada = (id) => S.marcas.filter((m) => m.caminho_origem === id && String(m.criado_em || "").slice(0, 10) >= pc.rodada.inicio && m.etapa !== "descartada");

function painelCaminhosHTML() {
  if (!pc.rodada) { carregarRodada(); return `<div class="cartao pc-painel"><p class="vazio">Abrindo os caminhos...</p></div>`; }
  const temCaminho = temCampo("marcas", "caminho_origem");
  const total = CAMINHOS.reduce((s, c) => s + marcasDaRodada(c.id).length, 0);
  return `<div class="cartao pc-painel" id="pc-painel">
    <div class="barra"><h2 style="margin:0">${ic("busca")} Caminhos de prospecção</h2><span class="espaco"></span>
      <small class="sub">Rodada desde ${dataBR(pc.rodada.inicio)} · ${plural(total, "marca nova", "marcas novas")}</small>
      <button class="btn pequeno" type="button" id="pc-nova-rodada">Começar nova rodada</button></div>
    <p class="sub" style="margin:2px 0 12px">Abra um caminho, preencha o que pede, copie o prompt e cole no Claude no Chrome. A planilha que voltar, você importa na aba Marcas escolhendo o caminho.</p>
    ${pc.falta || !temCaminho ? `<div class="aviso-falta">Falta rodar a parte 42 do banco.sql no Supabase. Os prompts funcionam, mas a meta, o checklist e o caminho de cada marca só ficam salvos depois disso.</div>` : ""}
    <div class="pc-lista">${CAMINHOS.map((cam) => {
      const st = estadoCaminho(cam.id), feitas = marcasDaRodada(cam.id).length, meta = Number(st.meta) || cam.meta;
      const pct = Math.min(100, Math.round((feitas / meta) * 100));
      const lojas = cam.id === "es_local" ? marcasDaRodada(cam.id).filter((m) => m.loja_online === "site" || m.loja_online === "marketplace").length : null;
      return `<details class="pc-card" data-cam="${cam.id}" ${pc.aberto.has(cam.id) ? "open" : ""}>
        <summary><span class="pc-icone">${ic(cam.icone)}</span><span class="pc-nome"><b>${esc(cam.nome)}</b><small>${esc(cam.objetivo)}</small></span>
          <span class="pc-meta-mini"><b>${feitas}/${meta}</b><span class="progresso"><i style="width:${pct}%"></i></span></span></summary>
        <div class="pc-corpo">
          ${cam.passos ? `<div class="pc-bloco"><b class="pc-rotulo">${cam.id === "es_local" ? "Onde procurar" : "Passo a passo"}</b><ol class="pc-passos">${cam.passos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></div>` : ""}
          <div class="pc-campos">${cam.campos.map((f) => `<label><span class="pc-rotulo">${esc(f.r)}</span>${f.op
            ? `<select class="campo" data-pc-campo="${f.k}">${f.op.map((o) => `<option ${String(st.campos[f.k]) === o ? "selected" : ""}>${o}</option>`).join("")}</select>`
            : `<input class="campo" data-pc-campo="${f.k}" value="${esc(st.campos[f.k] || "")}" placeholder="${esc(f.ph || "")}">`}</label>`).join("")}</div>
          <pre class="pro-prompt pc-prompt">${esc(montarPrompt(cam, st.campos))}</pre>
          <div class="pro-prompt-acoes"><button class="btn primario" type="button" data-pc-copiar>${ic("transcricao")}Copiar prompt</button><a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude</a></div>
          ${cam.checagens.length ? `<div class="pc-bloco"><b class="pc-rotulo">${cam.id === "linkedin" ? "Regras de contato" : "Checagens"}</b>${cam.checagens.map((t, i) => `<label class="check"><input type="checkbox" data-pc-check="${i}" ${st.checks[i] ? "checked" : ""}> ${esc(t)}</label>`).join("")}
            <small class="sub">Marque cada uma também na ficha da marca, uma por uma.</small></div>` : ""}
          ${cam.nota ? `<p class="porque">${esc(cam.nota)}</p>` : ""}
          <div class="pc-bloco pc-meta"><b class="pc-rotulo">Meta da rodada</b>
            <div class="pc-meta-linha"><input class="campo" type="number" min="1" data-pc-meta value="${meta}" aria-label="Meta de ${esc(cam.nome)}"><span>${esc(cam.rotuloMeta)}</span><span class="espaco"></span><b>${feitas} de ${meta}</b></div>
            <div class="progresso"><i style="width:${pct}%"></i></div>
            ${lojas != null ? `<small class="sub">${plural(lojas, "tem loja online", "têm loja online")} (a meta pede 10)</small>` : ""}</div>
        </div></details>`;
    }).join("")}
    <details class="pc-card" data-cam="fechamento" ${pc.aberto.has("fechamento") ? "open" : ""}>
      <summary><span class="pc-icone">${ic("checklist")}</span><span class="pc-nome"><b>Fechamento da rodada</b><small>Antes de mandar qualquer e-mail.</small></span>
        <span class="pc-meta-mini"><b>${FECHAMENTO.filter((_, i) => pc.rodada.fechamento[i]).length}/${FECHAMENTO.length}</b></span></summary>
      <div class="pc-corpo"><div class="pc-bloco">${FECHAMENTO.map((t, i) => `<label class="check"><input type="checkbox" data-pc-fecha="${i}" ${pc.rodada.fechamento[i] ? "checked" : ""}> ${esc(t)}${i === 5 ? ` <small class="sub">(agora: ${total})</small>` : ""}${i === 0 ? ` <small class="sub">(${CAMINHOS.filter((c) => marcasDaRodada(c.id).length).length} de 5)</small>` : ""}</label>`).join("")}</div></div>
    </details></div>
  </div>`;
}

function ligarPainelCaminhos(el) {
  const painel = $("#pc-painel", el);
  if (!painel) return;
  $$("details.pc-card", painel).forEach((d) => d.addEventListener("toggle", () => { if (d.open) pc.aberto.add(d.dataset.cam); else pc.aberto.delete(d.dataset.cam); }));
  $$("details.pc-card[data-cam]", painel).forEach((d) => {
    const cam = caminhoPorId(d.dataset.cam);
    if (!cam) return;
    const st = estadoCaminho(cam.id);
    const pre = $(".pc-prompt", d);
    $$("[data-pc-campo]", d).forEach((inp) => inp.addEventListener("input", () => { st.campos[inp.dataset.pcCampo] = inp.value.trim(); pre.textContent = montarPrompt(cam, st.campos); salvarRodada(); }));
    $("[data-pc-copiar]", d).onclick = async () => {
      const texto = montarPrompt(cam, st.campos);
      if (/\[[A-ZÇÃÕÉÍÓÚ ,.:]+/.test(texto.split("Formato da planilha")[0])) avisar("Ainda tem campo entre colchetes. Copiei mesmo assim.");
      try { await navigator.clipboard.writeText(texto); avisar(`Prompt de ${cam.nome} copiado. Cola no Claude no Chrome.`); }
      catch (_) { abrirJanelaSimples("Copie o prompt", `<textarea class="campo" rows="16" style="width:100%">${esc(texto)}</textarea>`); }
    };
    $$("[data-pc-check]", d).forEach((cx) => cx.onchange = () => { st.checks[cx.dataset.pcCheck] = cx.checked; salvarRodada(); });
    const meta = $("[data-pc-meta]", d);
    meta.onchange = () => { st.meta = Math.max(1, Number(meta.value) || cam.meta); salvarRodada(); desenhar(); };
  });
  $$("[data-pc-fecha]", painel).forEach((cx) => cx.onchange = () => { pc.rodada.fechamento[cx.dataset.pcFecha] = cx.checked; salvarRodada(); desenhar(); });
  $("#pc-nova-rodada", painel).onclick = async () => {
    if (!(await confirmar("Começar uma rodada nova? A contagem das metas e os checklists voltam pro zero. As marcas e o que você preencheu nos prompts continuam.", "Começar nova rodada"))) return;
    const campos = {};
    Object.entries(pc.rodada.caminhos).forEach(([k, v]) => { campos[k] = { campos: v.campos, meta: v.meta }; });
    pc.rodada = { ...rodadaPadrao(), caminhos: campos };
    salvarRodada(); desenhar();
  };
}

/* ---------- Trava de disparo ---------- */
// A pesquisa disse que não confirmou o e-mail: fica fora do disparo automático
const emailBarrado = (m) => m && m.email_verificado === false;

/* ---------- Filtros extras da aba Marcas ---------- */
const RE_ES = /(^|[^a-z])(es|espirito santo|vitoria|vila velha|serra|cariacica|guarapari|linhares|colatina|cachoeiro|aracruz|viana)([^a-z]|$)/;
const ehDoES = (m) => m.caminho_origem === "es_local" || RE_ES.test(semAcento(m.cidade_uf));
function filtrosExtrasHTML(f) {
  if (!temCampo("marcas", "etapa")) return "";
  const usados = new Set(S.marcas.map((m) => m.caminho_origem || "nao_informado"));
  const sel = (id, rotulo, valor, ops) => `<select class="campo" data-filtro="${id}" aria-label="${esc(rotulo)}"><option value="">${esc(rotulo)}</option>${ops.map(([v, t]) => `<option value="${esc(v)}" ${valor === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  return `<div class="pc-filtros">
    ${sel("caminho", "Todos os caminhos", f.caminho, OPCOES_CAMINHO.filter(([v]) => usados.has(v)))}
    ${sel("cidade", "Qualquer lugar", f.cidade, [["es", "Só do ES"], ["fora", "Fora do ES"]])}
    ${sel("creator", "Usa creator?", f.creator, OPCOES_CREATOR.slice(1).concat([["vazio", "Não informado"]]))}
    ${sel("verificado", "E-mail verificado?", f.verificado, [["sim", "Verificado"], ["nao", "Não verificado (fora do disparo)"], ["vazio", "Ninguém checou"]])}
  </div>`;
}
function passaFiltrosExtras(m, f) {
  if (f.etapa && (m.etapa || "nova") !== f.etapa) return false;
  if (f.caminho && (m.caminho_origem || "nao_informado") !== f.caminho) return false;
  if (f.cidade === "es" && !ehDoES(m)) return false;
  if (f.cidade === "fora" && ehDoES(m)) return false;
  if (f.creator && (f.creator === "vazio" ? !!m.ja_usa_creator : m.ja_usa_creator !== f.creator)) return false;
  if (f.verificado && (f.verificado === "sim" ? m.email_verificado !== true : f.verificado === "nao" ? m.email_verificado !== false : m.email_verificado != null)) return false;
  return true;
}
const pilulaEtapa = (m) => `<span class="pilula e-${esc(m.etapa || "nova")}">${esc(nomeEtapa(m.etapa))}</span>`;
function detalheMarcaLinha(m) {
  const partes = [];
  if (m.caminho_origem && m.caminho_origem !== "nao_informado") partes.push(nomeCaminho(m.caminho_origem));
  if (m.cidade_uf) partes.push(m.cidade_uf);
  if (m.seguidores) partes.push(`${num(m.seguidores)} seguidores`);
  if (emailBarrado(m)) partes.push("e-mail não verificado");
  return partes.length ? `<small class="sub pc-linha-info">${esc(partes.join(" · "))}</small>` : "";
}

/* ---------- Ficha da marca ---------- */
const marcaContatos = {};
async function lerContatosMarca(id) {
  const { data, error } = await db.from("marca_contatos").select("id,data,canal,texto,criado_em").eq("marca_id", id).order("data", { ascending: false }).limit(200);
  marcaContatos[id] = error ? null : data || [];
  return marcaContatos[id];
}
function historicoDaMarca(m) {
  const em = primeiroEmail(m);
  const envios = (pro.envios || []).filter((x) => String(x.marca_id) === String(m.id) || (em && x.email.toLowerCase() === em))
    .map((x) => ({ data: String(x.criado_em).slice(0, 10), canal: "email", texto: `${x.status === "ok" ? "E-mail enviado" : "E-mail com erro"}: ${x.assunto}`, auto: true }));
  return [...(marcaContatos[m.id] || []), ...envios].sort((a, b) => String(b.data).localeCompare(String(a.data)));
}

function fichaMarca(m, extra = {}) {
  const novo = !m;
  const v = { situacao: "lead", etapa: "nova", caminho_origem: "nao_informado", ultimo_contato: hojeISO(), checagens: {}, ...(m || extra.valores || {}) };
  const checks = { ...(v.checagens || {}) };
  const t = (n) => temCampo("marcas", n);
  const sel = (n, r, op) => ({ n, r, t: "select", op });
  const campos = [
    { n: "nome", r: "Marca", req: true },
    t("etapa") ? sel("etapa", "Etapa", ETAPAS) : sel("situacao", "Situação", SITUACOES),
    sel("caminho_origem", "Caminho de origem", OPCOES_CAMINHO),
    { n: "nicho", r: "Nicho", ph: "Tech, Moda, Casa e decoração...", lista: [...new Set(NICHOS_MARCAS.concat(S.marcas.map((x) => nichoPadrao(x.nicho)).filter(Boolean)))] },
    { n: "cidade_uf", r: "Cidade/UF", ph: "Vila Velha/ES" },
    { n: "instagram", r: "Instagram", ph: "@marca" },
    { n: "seguidores", r: "Seguidores", t: "number" },
    { n: "seguidores_verificado", r: "Conferi os seguidores no perfil", t: "check" },
    { n: "site", r: "Site", ph: "https://..." },
    { n: "link_produto", r: "Link do produto", ph: "https://..." },
    { n: "email", r: "E-mail", ph: "ou \"não encontrado\"" },
    sel("email_verificado", "E-mail verificado?", [["", "Ninguém checou (pode receber)"], ["true", "Sim, a pesquisa confirmou"], ["false", "Não confirmado (fica fora do disparo)"]]),
    { n: "telefone", r: "WhatsApp / telefone", t: "tel", ph: "(27) 90000-0000" },
    { n: "contato_nome", r: "Com quem falar (vira {pessoa})", ph: "Ex.: Ana" },
    { n: "contato_cargo", r: "Cargo", ph: "Ex.: coordenadora de marketing" },
    { n: "linkedin", r: "LinkedIn", ph: "https://linkedin.com/in/..." },
    sel("ja_usa_creator", "Já usa creator?", OPCOES_CREATOR),
    sel("loja_online", "Onde vende", OPCOES_LOJA),
    { n: "ultimo_contato", r: "Último contato", t: "date" },
    { n: "proximo_contato", r: "Próximo contato (follow-up)", t: "date" },
    { n: "conexao", r: "O gancho: por que essa marca, agora (vira {conexao})", t: "textarea", ph: "Ex.: Vi que vocês lançaram a linha X e quase todo vídeo mostra o produto parado na mesa." },
    { n: "ideia", r: "A ideia de vídeo pronta (vira {ideia})", t: "textarea" },
    { n: "obs", r: "Observação geral", t: "textarea" }
  ].filter((c) => t(c.n));
  const valor = (c) => c.n === "email_verificado" ? (v.email_verificado == null ? "" : String(v.email_verificado)) : v[c.n];

  const d = janela();
  d.innerHTML = `<form class="form-janela pc-ficha" novalidate>
    <div class="janela-topo"><h3>${novo ? "Adicionar marca" : esc(v.nome)}</h3><button type="button" class="icone-btn" data-fechar aria-label="Fechar">${ic("fechar")}</button></div>
    <div class="janela-corpo">
      <div id="pc-repetida"></div>
      <div class="form-grade">${campos.map((c) => campoHTML(c, valor(c))).join("")}</div>
      ${t("checagens") ? `<div class="pc-bloco" id="pc-ficha-checks"></div>` : ""}
      ${!novo && temCampo("marcas", "etapa") ? `<div class="pc-bloco"><b class="pc-rotulo">Histórico de contatos</b><div id="pc-hist"><p class="sub">Abrindo...</p></div></div>` : ""}
    </div>
    <div class="janela-pe">
      ${novo ? "" : `<button type="button" class="btn perigo esq" data-apagar>${ic("apagar")}Apagar</button>`}
      <button type="button" class="btn" data-fechar>Cancelar</button>
      <button type="submit" class="btn primario">Salvar</button>
    </div></form>`;
  const f = $("form", d);
  $$("[data-fechar]", d).forEach((b) => b.addEventListener("click", () => d.close()));

  const pintarChecks = () => {
    const caixa = $("#pc-ficha-checks", d);
    if (!caixa) return;
    const cam = caminhoPorId(f.elements.caminho_origem ? f.elements.caminho_origem.value : v.caminho_origem);
    caixa.innerHTML = !cam ? `<b class="pc-rotulo">Checagens</b><p class="sub">Escolha o caminho de origem para ver as checagens dessa marca.</p>`
      : !cam.checagens.length ? `<b class="pc-rotulo">Checagens</b><p class="sub">Esse caminho não tem checagens próprias.</p>`
      : `<b class="pc-rotulo">Checagens (${esc(cam.nome)})</b>${cam.checagens.map((x, i) => `<label class="check"><input type="checkbox" data-ck="${cam.id}:${i}" ${checks[cam.id + ":" + i] ? "checked" : ""}> ${esc(x)}</label>`).join("")}`;
    $$("[data-ck]", caixa).forEach((cx) => cx.onchange = () => { checks[cx.dataset.ck] = cx.checked; });
  };
  pintarChecks();
  if (f.elements.caminho_origem) f.elements.caminho_origem.addEventListener("change", pintarChecks);

  // Aviso de repetida enquanto digita (só ao adicionar)
  const conferirRepetida = () => {
    const caixa = $("#pc-repetida", d);
    const x = { nome: f.elements.nome.value, instagram: f.elements.instagram && f.elements.instagram.value, email: f.elements.email && f.elements.email.value, site: f.elements.site && f.elements.site.value };
    const r = marcaRepetida(x, m && m.id);
    caixa.innerHTML = r ? `<div class="pro-alerta">Já existe <b>${esc(r.nome)}</b> com ${esc(motivoRepetida(x, r))}${r.caminho_origem && r.caminho_origem !== "nao_informado" ? `, que veio de ${esc(nomeCaminho(r.caminho_origem))}` : ""}. <button type="button" class="link-btn" data-abrir-existente>Abrir a que já existe</button></div>` : "";
    const b = $("[data-abrir-existente]", caixa);
    if (b) b.onclick = () => { d.close(); setTimeout(() => fichaMarca(r), 50); };
    return r;
  };
  if (novo) ["nome", "instagram", "email", "site"].forEach((n) => f.elements[n] && f.elements[n].addEventListener("change", conferirRepetida));

  // Histórico
  const pintarHist = () => {
    const caixa = $("#pc-hist", d);
    if (!caixa) return;
    const lista = historicoDaMarca(m);
    caixa.innerHTML = `${marcaContatos[m.id] === null ? `<p class="sub">Falta rodar a parte 42 do banco.sql para registrar contatos.</p>` : `
      <div class="pc-hist-novo"><input class="campo" type="date" id="pc-h-data" value="${hojeISO()}" aria-label="Data do contato">
        <select class="campo" id="pc-h-canal" aria-label="Canal">${CANAIS.map(([k, r]) => `<option value="${k}">${r}</option>`).join("")}</select>
        <input class="campo" id="pc-h-texto" placeholder="O que foi enviado ou respondido" aria-label="O que aconteceu">
        <button type="button" class="btn pequeno" id="pc-h-add">${ic("mais")}Registrar</button></div>`}
      ${lista.length ? `<ul class="pc-hist-lista">${lista.map((x) => `<li><span class="pc-h-data">${dataBR(x.data)}</span><span class="etq">${esc((CANAIS.find((c) => c[0] === x.canal) || [0, x.canal])[1])}</span><span class="pc-h-texto">${esc(x.texto || "")}</span>${x.auto ? "" : `<button type="button" class="icone-btn" data-h-apagar="${x.id}" aria-label="Apagar esse registro">${ic("apagar")}</button>`}</li>`).join("")}</ul>` : `<p class="sub">Nenhum contato registrado ainda.</p>`}`;
    const add = $("#pc-h-add", caixa);
    if (add) add.onclick = async () => {
      const data = $("#pc-h-data", caixa).value || hojeISO(), canal = $("#pc-h-canal", caixa).value, texto = $("#pc-h-texto", caixa).value.trim();
      if (!texto) { avisar("Escreva o que foi enviado ou respondido.", true); return; }
      add.disabled = true;
      const { error } = await db.from("marca_contatos").insert({ marca_id: m.id, data, canal, texto: texto.slice(0, 2000) });
      if (error) { avisar(traduzErro(error), true); add.disabled = false; return; }
      // O último contato acompanha o registro mais recente
      if (!m.ultimo_contato || data > String(m.ultimo_contato)) {
        await db.from("marcas").update({ ultimo_contato: data }).eq("id", m.id);
        m.ultimo_contato = data;
        if (f.elements.ultimo_contato) f.elements.ultimo_contato.value = data;
      }
      await lerContatosMarca(m.id); pintarHist(); avisar("Contato registrado.");
    };
    $$("[data-h-apagar]", caixa).forEach((b) => b.onclick = async () => {
      if (!(await confirmar("Apagar esse registro do histórico?"))) return;
      const { error } = await db.from("marca_contatos").delete().eq("id", b.dataset.hApagar);
      if (error) { avisar(traduzErro(error), true); return; }
      await lerContatosMarca(m.id); pintarHist();
    });
  };
  if (!novo && $("#pc-hist", d)) Promise.all([lerContatosMarca(m.id), pro.carregado ? null : carregarProspeccao()]).then(pintarHist);

  if (!novo) $("[data-apagar]", d).addEventListener("click", async () => {
    if (!(await confirmar("Apagar de vez? Isso não tem como desfazer."))) return;
    if (await apagarLinha("marcas", m.id)) { d.close(); recarregar("marcas"); }
  });

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {};
    for (const c of campos) {
      const el = f.elements[c.n];
      if (c.t === "check") { dados[c.n] = el.checked; continue; }
      let x = el.value.trim();
      if (c.req && !x) { el.focus(); avisar(`Preencha o campo ${c.r}.`, true); return; }
      if (c.n === "email_verificado") x = x === "" ? null : x === "true";
      else if (c.t === "number") x = x === "" ? null : Math.max(0, Math.round(Number(x.replace(/\./g, "").replace(",", ".")) || 0));
      else if (c.n === "nicho") x = nichoPadrao(x) || null;
      else if (x === "") x = (c.n === "caminho_origem" ? "nao_informado" : null);
      dados[c.n] = x;
    }
    if (t("checagens")) dados.checagens = checks;
    if (novo) {
      const r = conferirRepetida();
      if (r && !(await confirmar(`Já existe ${r.nome} com ${motivoRepetida(dados, r)}. Salvar mesmo assim como outra marca?`, "Salvar mesmo assim"))) return;
    }
    const btn = $('button[type="submit"]', f);
    btn.disabled = true; btn.textContent = "Salvando...";
    const ok = await gravar("marcas", dados, novo ? null : m.id);
    btn.disabled = false; btn.textContent = "Salvar";
    if (!ok) return;
    d.close(); avisar("Salvo.");
    await recarregar("marcas");
    if (extra.depois) extra.depois();
  });
  d.showModal();
  const primeiro = $("input:not([type=checkbox])", d);
  if (primeiro) primeiro.focus();
}

/* ---------- Importar: as colunas que os prompts devolvem ---------- */
function numeroSeguidores(v) {
  if (typeof v === "number") return Math.round(v);
  const t = semAcento(v).replace(/seguidores?/, "").trim();
  const m = t.match(/([\d.,]+)\s*(mil|k|mi|m)?/);
  if (!m) return null;
  let n = m[2] ? Number(m[1].replace(",", ".")) : Number(m[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", "."));
  if (!isFinite(n)) return null;
  if (m[2] === "mil" || m[2] === "k") n *= 1000;
  if (m[2] === "mi" || m[2] === "m") n *= 1e6;
  return Math.round(n);
}
function simNao(v) {
  const t = semAcento(v);
  if (/^(s|sim|yes|true|verdadeiro|confirmado|verificado)\b/.test(t)) return true;
  if (/^(n|nao|no|false|falso)\b/.test(t)) return false;
  return null;
}
function creatorDe(v) { const b = simNao(v); return b === true ? "sim" : b === false && !/sei/.test(semAcento(v)) ? "nao" : semAcento(v) ? "nao_sei" : null; }
function lojaDe(v) {
  const t = semAcento(v);
  if (!t) return null;
  if (/dm|direct|whats|instagram/.test(t) && !/site|loja virtual/.test(t)) return "so_dm";
  if (/marketplace|shopee|mercado livre|amazon|magalu/.test(t)) return "marketplace";
  if (/site|loja|virtual|sim|nuvemshop|shopify|www\./.test(t)) return "site";
  return null;
}
