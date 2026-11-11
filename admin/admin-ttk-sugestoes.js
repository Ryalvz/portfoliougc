/* =========================================================
   TikTok > Sugestões: produtos Tech que estão crescendo no TikTok Shop
   Fonte: CreatorsBase, Radar de Mercado (busca por termo), coletado em 11/11/2026.
   Números do CreatorsBase são ESTIMATIVAS deles (faturamento e unidades),
   do vídeo mais forte de cada produto na amostra coletada.
   O status de cada sugestão fica em preferencias "ttk_sugestoes".
   ========================================================= */
const TTK_SUG_COLETA = "11/11/2026";
// ref: [caminho do vídeo no tiktok.com, legenda (headline), autor, views, +views/dia, faturamento estimado máx]
const TTK_SUGESTOES = [
  // ---- Já estão na sua vitrine: o mercado está comprando, falta volume seu
  { id: "hrebos-eb400", tipo: "escalar", grupo: 33, sub: "audio", nome: "Fone TWS Hrebos EB-400 PureSound", vids: 1, dia: 17000, rec: 844000, un: 15934, views: 17700000,
    nota: "Você já tem esse fone na vitrine. Um único vídeo de outro creator estimou até R$ 844 mil. O produto já foi provado; o que falta é você postar mais dele.",
    refs: [["@lgbieel/video/7675381405248949511", "Fone de ouvido TWS Hrebos EB-400 Pure Sound, Audio HiFi, Redução de Ruído IA, Autonomia Total 30H", "Lucas Lopes", 17700000, 17000, 844000]] },
  { id: "ulanzi-mt78", tipo: "escalar", grupo: 55, sub: "gravacao", nome: "ULANZI MT-78 Tripé extensível 1,85 m", vids: 12, dia: 158546, rec: 210000, un: 1028, views: 2841000,
    nota: "12 creators diferentes vendendo ao mesmo tempo: a demanda está espalhada, não é um viral só. Você já tem o link.",
    refs: [["@bruno_sds93/video/7694703176229965063", "Tripé profissional para celular, câmera e nível a laser. 1,80m", "Bruno Silva", 752000, 41000, 57000],
      ["@anafariasfs/video/7693697524288261397", "Tripé de 1,80m com luz de led", "Ana Farias", 703000, 22000, 53000],
      ["@julianaaiko_/video/7697295374284803336", "", "Juliana Aiko", 919000, 63000, 70000]] },
  { id: "basike-bastao", tipo: "escalar", grupo: 28, sub: "gravacao", nome: "Basike Bastão de selfie e tripé (4 pernas, rastreamento por IA)", vids: 3, dia: 18000, rec: 647000, un: 4008, views: 6900000,
    nota: "Confira se é o mesmo modelo do seu anúncio Basike. A Ana Farias fez 3 vídeos dele com o mesmo ângulo (\"perfeito e baratinho\") e o primeiro estimou até R$ 647 mil.",
    refs: [["@anafariasfs/video/7678470555854490901", "Esse tripé em bastão/pau de selfie é perfeito e baratinhooo!", "Ana Farias", 6900000, 18000, 647000],
      ["@anafariasfs/video/7682939579145506068", "Respondendo a um comentário: esse tripé em bastão/pau de selfie é perfeito e baratinhooo!", "Ana Farias", 316000, 15000, 0],
      ["@anafariasfs/video/7661750500773334292", "Esse tripé em bastão/pau de selfie é perfeito e baratinhooo!", "Ana Farias", 1100000, 13000, 0]] },
  { id: "lapela-hmaston", tipo: "escalar", grupo: 27, sub: "gravacao", nome: "Microfone de lapela (o seu H'maston MK05/06)", vids: 4, dia: 55000, rec: 100000, un: 1009, views: 1720000,
    nota: "Lapela sem fio está vendendo no Radar (o mais forte é o ZCCO J6-F). Use esses vídeos como referência de ângulo pro microfone que você já vende.",
    refs: [["@lealrecomenda/video/7689237575738985749", "ZCCO J6-F Microfone Lapela celular", "Leal Recomenda", 761000, 25000, 45000],
      ["@descontos_br/video/7680660639211162888", "Microfone de lapela: queima estoque! O microfone mais vendido da internet em oferta hoje!", "Mari | Descontos BR", 494000, 3000, 25000],
      ["@kaumonteiiro/video/7693608024333946132", "Se você grava vídeo, olha esse achadinho! O Hollyland Lark M2 é um microfone de lapela sem fio", "kaumonteiiro", 302000, 13000, 0]] },

  // ---- Produtos novos pra testar (fila na ordem sugerida)
  { id: "ringlight-ret", tipo: "testar", fila: 1, sub: "iluminacao", nome: "Ring light iluminador LED retangular 10\" com tripé de 2 m", vids: 6, dia: 55045, rec: 253000, un: 3847, views: 4222000,
    nota: "Encaixa direto no que você já vende (Vedo, luzes Ulanzi, softbox). Mesmo público, mesmo tipo de vídeo.",
    refs: [["@julianaaiko_/video/7689211639928818951", "", "Juliana Aiko", 1300000, 2000, 78000],
      ["@achadinhosmodernoofc/video/7653121677764742418", "", "Achadinhos Moderno", 1300000, 13000, 77000],
      ["@julianaaiko_/video/7659852701034974482", "", "Juliana Aiko", 1100000, 26000, 68000]] },
  { id: "gimbal-mesa", tipo: "testar", fila: 2, sub: "gravacao", nome: "Tripé gimbal de mesa com rastreamento de rosto", vids: 1, dia: 29000, rec: 0, un: 0, views: 274000,
    nota: "Equipamento de gravação com demonstração fácil: o próprio vídeo mostra o tripé seguindo você.",
    refs: [["@japapink.mi/video/7687619640477977863", "Tripé gimbal de mesa que faz o rastreamento do rosto e acompanha os movimentos", "Japa Pink Mi", 274000, 29000, 0]] },
  { id: "basike-anc", tipo: "testar", fila: 3, sub: "audio", nome: "Basike Fone Bluetooth ANC (redução de ruído ativa, 30 h)", vids: 11, dia: 284036, rec: 5724000, un: 36015, views: 61524000,
    nota: "O maior da coleta inteira: 11 vídeos e 284 mil views por dia somados. Está puxado pela Black Friday. Mesmo nicho do fone Hrebos que você já vende.",
    refs: [["@lorra.ynee/video/7572629402119343368", "Impossível não gostar desse! Dos mimos bons e baratos da Black Friday", "Lorrayne Fernandes", 44200000, 121000, 4100000],
      ["@walkerindica/video/7698191323282558224", "Fone de ouvido perfeito pra quem quer qualidade de som e liberdade no dia a dia. Conexão rápida", "walkerindica", 3300000, 21000, 313000]] },
  { id: "mic-rgb", tipo: "testar", fila: 4, sub: "gravacao", nome: "Microfone RGB para celular (Jiditech)", vids: 2, dia: 62000, rec: 0, un: 0, views: 426000,
    nota: "Vídeos recentes subindo rápido (62 mil views por dia num vídeo de 358 mil). Ainda tem pouca gente vendendo.",
    refs: [["@isadoraeallan/video/7688964710326144257", "Jiditech Microfone RGB, mic p/ celular", "ISA e CLARKK | Creators", 358000, 62000, 0],
      ["@isadoraeallan/video/7689977418521595157", "Respondendo a um comentário: Jiditech Microfone RGB", "ISA e CLARKK | Creators", 68000, 20000, 0]] },
  { id: "mini-tripe-led", tipo: "testar", fila: 5, sub: "gravacao", nome: "Mini tripé com LED", vids: 1, dia: 27000, rec: 0, un: 0, views: 2000000,
    nota: "Produto barato de compra por impulso, bom pra completar o kit de quem já comprou tripé ou luz com você.",
    refs: [["@irisinspira/video/7663581335369305352", "Respondendo a um comentário: dá sim, se você grava vídeos de desenho ou qualquer conteúdo com a câmera", "iris inspira", 2000000, 27000, 0]] },
  { id: "hmaston-yd80", tipo: "testar", fila: 6, sub: "mobile", nome: "H'MASTON YD80/YD81 Carregador portátil magnético 20.000/30.000 mAh", vids: 8, dia: 52143, rec: 260000, un: 2103, views: 3567000,
    nota: "Mesma marca do microfone que você já vende. 8 vídeos vendendo, o mais forte estimou até R$ 148 mil.",
    refs: [["@houyttg1/video/7687926072050011413", "Carregador Mini Power Bank 2 em 1", "houyttg1", 2000000, 24000, 148000],
      ["@brenoocavalcante97/video/7697009184264523029", "Carregador Mini Power Bank", "Breno César", 797000, 1000, 58000],
      ["@gabsaraujo_/video/7683676414603791637", "Carregador portátil super potente! Levo sempre comigo, pois ele tem cabos embutidos e carrega meu celular", "Gabi", 361000, 14000, 26000]] },
  { id: "basike-caixa100", tipo: "testar", fila: 7, sub: "audio", nome: "Basike Caixa de som Bluetooth 100W RGB (bateria 10.000 mAh)", vids: 5, dia: 47010, rec: 1293000, un: 3077, views: 8536000,
    nota: "Segundo maior faturamento estimado da coleta. Bom pra fim de ano (festa, churrasco).",
    refs: [["@renan_soares_shop/video/7647215373107956999", "Caixinha de som Bluetooth inova", "Renan Soares Shop", 4300000, 6000, 649000],
      ["@fernandinhaacer/video/7686264562739465493", "Caixa de som Bluetooth com led", "Fernanda", 2500000, 34000, 382000]] },
  { id: "aoc-acs3351", tipo: "testar", fila: 8, sub: "audio", nome: "AOC ACS3351 Caixa de som Bluetooth portátil RGB", vids: 2, dia: 224000, rec: 0, un: 0, views: 294000,
    nota: "Está subindo agora: vídeos novos com 224 mil views por dia somados. Marca conhecida ajuda na confiança de quem compra.",
    refs: [["@ovitorferrari/video/7698201492548963604", "Já garanti a minha AOC ACS3351 Caixa de Som Bluetooth Portátil, Luzes RGB, Bluetooth 5.3", "ovitorferrari", 175000, 139000, 0],
      ["@ovitorferrari/video/7698529229146836225", "Já peguei a minha AOC ACS3351 Caixa de Som Bluetooth Portátil", "ovitorferrari", 119000, 85000, 0]] },
  { id: "caixa-inova", tipo: "testar", fila: 9, sub: "audio", nome: "Caixa de som Inova à prova d'água", vids: 3, dia: 110000, rec: 0, un: 0, views: 13472000,
    nota: "Um vídeo do mesmo creator passou de 11 milhões de views. O ângulo que repete é simples: a caixa na água.",
    refs: [["@renan_soares_shop/video/7642741938696752392", "Caixinha de som Inova prova d'água", "Renan Soares Shop", 11900000, 91000, 0],
      ["@renan_soares_shop/video/7654257710145260818", "Caixa de som inova a prova d'água", "Renan Soares Shop", 2700000, 27000, 0],
      ["@shopdoalmeida/video/7637677879714712853", "Caixa de som alta e custo benefício", "Shop do Almeida", 2000000, 14000, 46000]] },
  { id: "cabo-4em1", tipo: "testar", fila: 10, sub: "mobile", nome: "Cabo carregador 4 em 1 (multi conector, carga rápida)", vids: 2, dia: 116000, rec: 34000, un: 680, views: 5955000,
    nota: "Produto barato que todo mundo entende em 2 segundos. O gancho que funcionou é a dor de ter vários cabos.",
    refs: [["@vibedehoje_br/video/7671267606233500935", "Nunca mais preciso comprar vários cabos, porque ele tem quatro conectores. Com um único cabo, dá pra", "VibeDeHoje", 5200000, 96000, 0],
      ["@alves_july0/video/7691473144325917959", "Cabo de dados de carregamento rápido 4 em 1 Tipo C PD", "July Alves", 755000, 20000, 34000]] },
  { id: "mini-powerbank", tipo: "testar", fila: 11, sub: "mobile", nome: "Mini power bank 10.000 mAh 2 em 1 (iPhone e Tipo-C)", vids: 2, dia: 207000, rec: 0, un: 0, views: 3400000,
    nota: "Muito recente: um vídeo com 192 mil views por dia. Sem estimativa de faturamento ainda no CreatorsBase.",
    refs: [["@dnachados_/video/7701833371432832264", "Carregador Mini Power Bank 2 em 1 para iPhone e Tipo-C, alta capacidade", "Achados bons", 1100000, 192000, 0],
      ["@eletro94/video/7680128960948112660", "Quantas vezes a bateria já te deixou na mão? Este mini carregador portátil garante 4 recargas rápidas", "Eletro", 2300000, 15000, 0]] },
  { id: "heyoo-magsafe", tipo: "testar", fila: 12, sub: "mobile", nome: "Heyoo Capa MagSafe com carregador portátil magnético (iPhone)", vids: 11, dia: 119201, rec: 366000, un: 9880, views: 10908000,
    nota: "11 vídeos vendendo. Os vídeos que vendem mostram cor e toque da capa.",
    refs: [["@br.one.capa1/video/7668611358555966740", "Capinha macia, leve e com toque fosco incrível! Proteção simples e perfeita.", "Br.One Capa1", 3800000, 52000, 129000],
      ["@rafaelaulla/video/7657717764034989333", "Foi difícil escolher só uma cor, agora eu quero TODAS!", "Rafaela Ulla", 1300000, 7000, 45000]] },
  { id: "redmi-buds6", tipo: "testar", fila: 13, sub: "audio", nome: "Xiaomi Redmi Buds 6 Play", vids: 2, dia: 16000, rec: 0, un: 0, views: 864000,
    nota: "Ângulo diferente e bom pra sua conta: ensinar a conferir se o fone é original.",
    refs: [["@bryan.klug/video/7694171997135310088", "Olha como conferir a autenticidade do Redmi Buds 6 Play! No vídeo, raspei a etiqueta da embalagem", "Bryan Klug | Creator", 527000, 5000, 0],
      ["@giulianoazevedoreviews/video/7689570183060507922", "Xiaomi Redmi Buds 6 Play Fone de Ouvido Bluetooth TWS 5.4 Som Imersivo Cancelamento de Ruído", "Giuliano Azevedo Reviews", 337000, 11000, 0]] },
  { id: "redmi-watch5", tipo: "testar", fila: 14, sub: "eletronicos", nome: "Xiaomi Redmi Watch 5 Active (smartwatch com Alexa)", vids: 30, dia: 203774, rec: 755000, un: 2862, views: 7908000,
    nota: "30 vídeos na amostra, o produto com mais gente vendendo. Os mais vistos são de fora do Brasil, então procure referências brasileiras no Radar antes de gravar.",
    refs: [["@b0d9i9/video/7692772934175313158", "óculos e relógios", "Reply", 1900000, 18000, 184000],
      ["@izak.abdellah/video/7699779937896746258", "", "ABDULLLLLLLL", 1600000, 71000, 158000]] },
  { id: "braco-mic", tipo: "testar", fila: 15, sub: "gravacao", nome: "Microfone com braço articulado RGB (podcast e live)", vids: 3, dia: 15000, rec: 0, un: 0, views: 3600000,
    nota: "Pra quem faz live e podcast. Combina com o seu Braço Mágico Articulado.",
    refs: [["@tkneew/video/7612426487265824021", "Respondendo a um comentário: microfone e braço articulado RGB para lives, streamers, podcast e cantores", "NEEW | DJ", 1200000, 6000, 0],
      ["@tkneew/video/7611632297934195989", "Respondendo a um comentário: microfone com braço articulado e LED RGB funciona em celulares, MacBook e computador", "NEEW | DJ", 1000000, 5000, 0]] },
  { id: "ulanzi-mt44", tipo: "testar", fila: 16, sub: "gravacao", nome: "Tripé ULANZI MT-44", vids: 1, dia: 15000, rec: 0, un: 0, views: 1500000,
    nota: "Mesma marca dos tripés e luzes que você já vende. Um modelo menor, de mesa.",
    refs: [["@kalitacolim/video/7653951666219240725", "Tripé Ulanzi MT-44 branco", "Kálita Colim", 1500000, 15000, 0]] }
];
// Subiram no Radar ("Produtos em alta"), mas sem vídeo de referência coletado
const TTK_SUG_RADAR = [
  ["Relógio inteligente T800", "subiu 550% em 7 dias no Radar"],
  ["Adaptador CarPlay sem fio", "apareceu entre os eletrônicos em alta"]
];
const TTK_SUG_STATUS = [["nova", "Nova"], ["vou_testar", "Vou testar"], ["pedi_amostra", "Pedi amostra"], ["testando", "Testando"], ["entrou", "Entrou na rotina"], ["descartei", "Descartei"]];
const ttkSug = { status: null, filtro: "todas", sub: "" };

async function ttkSugCarregar() {
  if (ttkSug.status) return;
  ttkSug.status = {};
  try {
    const { data } = await db.from("preferencias").select("valor").eq("chave", "ttk_sugestoes").maybeSingle();
    if (data && data.valor) ttkSug.status = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
  } catch (_) {}
}
async function ttkSugSalvar() {
  const { error } = await db.from("preferencias").upsert({ chave: "ttk_sugestoes", valor: JSON.stringify(ttkSug.status), atualizado_em: new Date().toISOString() });
  if (error) avisar(traduzErro(error), true);
}

const ttkSugLink = (c) => "https://www.tiktok.com/" + c;
const ttkSugTexto = (t) => String(t || "").replace(/\p{Extended_Pictographic}|️/gu, "").replace(/\s+/g, " ").trim();
const ttkSugMil = (n) => !n ? "–" : n >= 1e6 ? `${String(Math.round(n / 1e5) / 10).replace(".", ",")} mi` : n >= 1e3 ? `${Math.round(n / 1e3)} mil` : String(n);
const ttkSugReal = (n) => !n ? "sem estimativa" : n >= 1e6 ? `R$ ${String(Math.round(n / 1e5) / 10).replace(".", ",")} mi` : `R$ ${Math.round(n / 1e3)} mil`;

// Transcrição já feita nos Roteiros: primeira frase = gancho, última = CTA
function ttkSugTranscricao(caminho) {
  const alvo = limparLink(ttkSugLink(caminho));
  const t = (S.transcricoes || []).find((x) => x.link && limparLink(x.link) === alvo);
  if (!t) return null;
  const texto = String(t.transcricao || "").trim();
  const frases = texto.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean);
  return { t, rodando: t.andamento === "processando", gancho: frases[0] || "", cta: frases.length > 1 ? frases[frases.length - 1] : "" };
}

// Suas vendas do produto nos últimos 30 dias (só pros que já estão na vitrine)
function ttkSugMinhas(grupo) {
  if (!grupo || !ttkX.todos) return null;
  const fim = ttkSomaDias(hojeISO(), -1), ini = ttkSomaDias(fim, -29);
  const l = ttkX.todos.filter((p) => p.grupo === grupo && ttkValido(p) && p.dia >= ini && p.dia <= fim);
  return { g: l.reduce((s, p) => s + p.g, 0), i: l.reduce((s, p) => s + p.i, 0), dias: new Set(l.map((p) => p.dia)).size };
}

function ttkSugCartao(s) {
  const st = ttkSug.status[s.id] || "nova", minhas = ttkSugMinhas(s.grupo);
  const refs = s.refs.map((r) => {
    const tr = ttkSugTranscricao(r[0]), leg = ttkSugTexto(r[1]);
    return `<li>
      <span class="ttk-cv-texto"><a href="${esc(ttkSugLink(r[0]))}" target="_blank" rel="noopener">${esc(leg || "Vídeo sem legenda")}</a>
        <small>${esc(ttkSugTexto(r[2]))} · ${ttkSugMil(r[3])} views · +${ttkSugMil(r[4])} views/dia${r[5] ? ` · até ${ttkSugReal(r[5])} estimado` : ""}</small>
        ${tr && tr.gancho ? `<small class="ttk-sug-rot"><b>Gancho:</b> "${esc(tr.gancho.slice(0, 180))}"</small>` : ""}
        ${tr && tr.cta ? `<small class="ttk-sug-rot"><b>CTA:</b> "${esc(tr.cta.slice(0, 180))}"</small>` : ""}</span>
      <span class="ttk-sug-acao">${tr ? (tr.rodando ? `<span class="sub">Transcrevendo...</span>` : `<button class="btn pequeno" type="button" data-sug-abrir="${esc(tr.t.id)}">Ver nos Roteiros</button>`)
        : `<button class="btn pequeno" type="button" data-sug-rot="${esc(r[0])}" data-sug-nome="${esc(s.nome)}" data-sug-leg="${esc(leg)}" title="Transcreve pelo seu painel (1 crédito da Supadata)">Mandar pros Roteiros</button>`}</span></li>`;
  }).join("");
  return `<div class="ini-card ttk-bloco ttk-sug${st === "descartei" ? " ttk-sug-fora" : ""}">
    <div class="ini-card-topo"><div><h2>${s.fila ? `<span class="ttk-sug-fila">${s.fila}</span>` : ""}${esc(s.nome)}</h2>
      <span class="sub">${esc((TTK_CATS[s.sub] || [0, ""])[1])}${s.tipo === "escalar" ? " · já está na sua vitrine" : ""}</span></div><span class="espaco"></span>
      <select class="campo ttk-sug-status" data-sug-status="${s.id}" aria-label="Status">${TTK_SUG_STATUS.map(([k, n]) => `<option value="${k}" ${k === st ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    <div class="ttk-sug-nums">
      <div><span>Vídeos vendendo</span><b>${s.vids}</b></div>
      <div><span>Views por dia</span><b>+${ttkSugMil(s.dia)}</b></div>
      <div><span>Faturamento estimado</span><b>${s.rec ? `até ${ttkSugReal(s.rec)}` : "sem estimativa"}</b></div>
      <div><span>Unidades estimadas</span><b>${s.un ? `até ${num(s.un)}` : "–"}</b></div>
      ${minhas ? `<div><span>Suas vendas em 30 dias</span><b>${real(minhas.g)}</b><small class="sub">${num(minhas.i)} un. em ${minhas.dias} dias</small></div>` : ""}
    </div>
    <p class="ttk-sug-nota">${esc(s.nota)}</p>
    <ul class="ttk-cv">${refs}</ul></div>`;
}

function ttkTelaSugestoes(el) {
  if (!ttkSug.status) { el.innerHTML = `<p class="vazio">Abrindo as sugestões...</p>`; ttkSugCarregar().then(() => desenharTikTok(el)); return; }
  const per = ttkPeriodo();
  const passa = (s) => (ttkSug.filtro === "todas" || s.tipo === ttkSug.filtro) && (!ttkSug.sub || s.sub === ttkSug.sub);
  const lista = TTK_SUGESTOES.filter(passa);
  const subs = [...new Set(TTK_SUGESTOES.map((s) => s.sub))];
  const escalar = lista.filter((s) => s.tipo === "escalar"), testar = lista.filter((s) => s.tipo === "testar").sort((a, b) => a.fila - b.fila);
  el.innerHTML = ttkCabecalho(per, { titulo: "Sugestões", comMes: false }) + `
    <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Como encaixar nos seus 15 vídeos por dia</h2><span class="sub">pesquisa do CreatorsBase de ${TTK_SUG_COLETA}</span></div>
      <div class="ttk-sug-plano">
        <div><b>Principais (6)</b><p>Continuam iguais: Top Antonella e os 2 campeões do mês.</p></div>
        <div><b>Com vendas (6)</b><p>Os ${TTK_SUGESTOES.filter((s) => s.tipo === "escalar").length} produtos de "Escalar" entram aqui primeiro: o mercado está comprando e você já tem o link.</p></div>
        <div><b>Testes (3)</b><p>Um produto novo de cada vez, com 3 ganchos diferentes em 3 dias. Vendeu em 2 dos 3 dias: sobe pra Com vendas. Não vendeu: troca pelo próximo da fila.</p></div>
      </div>
      ${ttkFrase("A fila começa por iluminação e gravação, que é o que a sua conta já vende. Postar mais Tech, e menos roupa, tende a mudar a categoria em que o TikTok te encaixa. Os números de faturamento e unidades são estimativas do CreatorsBase, do vídeo mais forte de cada produto. Pra ver gancho e CTA de um vídeo, toque em Mandar pros Roteiros: ele é transcrito pelo seu painel (1 crédito da Supadata) e a primeira e a última frase aparecem aqui.")}</div>
    <div class="ttk-sug-filtros">
      <div class="ini-periodo" role="group" aria-label="Tipo">${[["todas", "Todas"], ["escalar", "Escalar"], ["testar", "Testar"]].map(([k, n]) => `<button type="button" data-sug-filtro="${k}" aria-pressed="${ttkSug.filtro === k}">${n}</button>`).join("")}</div>
      <div class="ini-periodo" role="group" aria-label="Categoria"><button type="button" data-sug-sub="" aria-pressed="${!ttkSug.sub}">Toda Tech</button>${subs.map((k) => `<button type="button" data-sug-sub="${k}" aria-pressed="${ttkSug.sub === k}">${esc((TTK_CATS[k] || [0, k])[1])}</button>`).join("")}</div>
    </div>
    ${escalar.length ? `<h3 class="ttk-sug-titulo">Escalar: já está na sua vitrine</h3>${escalar.map(ttkSugCartao).join("")}` : ""}
    ${testar.length ? `<h3 class="ttk-sug-titulo">Testar: fila de produtos novos</h3>${testar.map(ttkSugCartao).join("")}` : ""}
    ${!lista.length ? `<p class="vazio">Nenhuma sugestão com esse filtro.</p>` : ""}
    <div class="ini-card ttk-bloco"><div class="ini-card-topo"><h2>Também subindo no Radar</h2><span class="sub">sem vídeo de referência coletado</span></div>
      <ul class="ttk-sug-radar">${TTK_SUG_RADAR.map(([n, d]) => `<li><b>${esc(n)}</b> ${esc(d)}</li>`).join("")}</ul></div>`;
  ttkSugLigar(el);
}

function ttkSugLigar(el) {
  const redesenhar = () => { const y = window.scrollY; desenharTikTok(el); window.scrollTo(0, y); };
  el.querySelectorAll("[data-sug-filtro]").forEach((b) => b.onclick = () => { ttkSug.filtro = b.dataset.sugFiltro; redesenhar(); });
  el.querySelectorAll("[data-sug-sub]").forEach((b) => b.onclick = () => { ttkSug.sub = b.dataset.sugSub; redesenhar(); });
  el.querySelectorAll("[data-sug-status]").forEach((s) => s.onchange = async () => { ttkSug.status[s.dataset.sugStatus] = s.value; await ttkSugSalvar(); redesenhar(); });
  el.querySelectorAll("[data-sug-abrir]").forEach((b) => b.onclick = () => { trans.sel = b.dataset.sugAbrir; irPara("transcricoes"); });
  el.querySelectorAll("[data-sug-rot]").forEach((b) => b.onclick = async () => {
    b.disabled = true; b.textContent = "Salvando...";
    const link = ttkSugLink(b.dataset.sugRot), perfil = (b.dataset.sugRot.match(/^@([^/]+)/) || [])[1] || null;
    const dados = { link, plataforma: "tiktok", categoria: "tiktok_shop", status: "ideia", titulo: `Referência: ${b.dataset.sugNome}`.slice(0, 90), de_quem: "outra", perfil,
      legenda: b.dataset.sugLeg || null, tags: ["sugestao-ttk"], andamento: "processando" };
    const limpo = {}; Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
    const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
    if (error) { avisar(traduzErro(error), true); b.disabled = false; b.textContent = "Mandar pros Roteiros"; return; }
    await recarregar("transcricoes");
    const novo = S.transcricoes.find((x) => String(x.id) === String(data.id));
    if (novo) transcreverVideo(novo).then(() => { if (ttkX.sub === "sugestoes" && document.body.contains(el)) redesenhar(); });
    avisar("Salvo nos Roteiros. A transcrição chega em alguns minutos (1 crédito da Supadata).");
    redesenhar();
  });
}

(function ttkSugEstilo() {
  const st = document.createElement("style");
  st.textContent = `
    .ttk-sug-plano { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 4px 0 8px; }
    .ttk-sug-plano > div { border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
    .ttk-sug-plano p { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
    .ttk-sug-filtros { display: flex; flex-wrap: wrap; gap: 10px; margin: 6px 0 4px; }
    .ttk-sug-titulo { margin: 18px 2px 8px; font-size: 15px; }
    .ttk-sug .ini-card-topo h2 { display: flex; align-items: center; gap: 8px; }
    .ttk-sug-fila { display: inline-grid; place-items: center; min-width: 24px; height: 24px; border-radius: 50%; background: var(--tint); font-size: 12px; font-weight: 700; }
    .ttk-sug-status { width: auto; min-width: 150px; }
    .ttk-sug-nums { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 6px 0 10px; }
    .ttk-sug-nums > div { background: var(--tint); border-radius: 10px; padding: 8px 10px; }
    .ttk-sug-nums span { display: block; font-size: 12px; color: var(--muted); }
    .ttk-sug-nums b { font-size: 16px; font-variant-numeric: tabular-nums; }
    .ttk-sug-nums small { display: block; }
    .ttk-sug-nota { margin: 0 0 6px; font-size: 13.5px; }
    .ttk-sug .ttk-cv li { grid-template-columns: minmax(0, 1fr) auto; }
    .ttk-sug-rot { color: var(--ink, inherit) !important; }
    .ttk-sug-acao { text-align: right; }
    .ttk-sug-fora { opacity: .55; }
    .ttk-sug-radar { margin: 0; padding-left: 18px; font-size: 13.5px; display: grid; gap: 4px; }
    @media (max-width: 760px) { .ttk-sug-plano { grid-template-columns: 1fr; } .ttk-sug .ttk-cv li { grid-template-columns: 1fr; } .ttk-sug-acao { text-align: left; } }`;
  document.head.appendChild(st);
})();
