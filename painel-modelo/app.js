/* =============================================================
   PAINEL TIKTOK SHOP DOS ALUNOS
   Telas: Hoje, Resultados, Produtos, Vídeos, Amostras, Importar, Perfil.
   Dados: Supabase (config.js) ou modo demonstração (sem config).
   Leitura dos pedidos igual ao admin do Ryan:
     Liquidado e Pendente formam o GMV; Inelegível e Aguardando pagamento ficam fora.
     Todo número compara com o mesmo período do mês anterior.
   ============================================================= */
(function () {
  "use strict";

  /* ---------- Ajudas ---------- */
  const CFG = window.PAINEL_CONFIG || {};
  const DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hojeISO = () => isoLocal(new Date());
  const somaDias = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoLocal(d); };
  const diasNoMes = (mes) => new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate();
  const mesDesloca = (mes, n) => { const d = new Date(+mes.slice(0, 4), +mes.slice(5, 7) - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const nomeMes = (mes) => `${MESES[+mes.slice(5, 7) - 1]} de ${mes.slice(0, 4)}`;
  const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  const real = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const realCurto = (v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil` : `R$ ${Math.round(v)}`);
  const num = (v) => Math.round(v || 0).toLocaleString("pt-BR");
  const pct = (v) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")}%`;
  const plural = (n, um, varios) => `${num(n)} ${n === 1 ? um : varios}`;

  function toast(t, ruim) { const e = $("#toast"); e.textContent = t; e.classList.toggle("ruim", !!ruim); e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), ruim ? 4200 : 2400); }
  function traduz(e) {
    const m = String((e && (e.message || e.error_description)) || e || "").toLowerCase();
    if (m.includes("schema cache") || (m.includes("column") && m.includes("does not exist")) || m.includes("violates check constraint")) return "Falta atualizar o banco do painel. Peça ao Claude: \"saiu versão nova do painel\" (ele copia o banco.sql para você rodar no Supabase).";
    if (m.includes("invalid login")) return "E-mail ou senha errados.";
    if (m.includes("email not confirmed")) return "Confirme seu e-mail primeiro: abra o link que mandamos na sua caixa de entrada.";
    if (m.includes("already registered") || m.includes("already been registered")) return "Esse e-mail já tem conta. Use Entrar ou Esqueci minha senha.";
    if (m.includes("password should be")) return "A senha precisa ter pelo menos 8 caracteres.";
    if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
    if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão. Confira sua internet e tente de novo.";
    return (e && e.message) || "Algo deu errado. Tente de novo.";
  }

  /* ---------- Aparência: estilo e cor (escolhidos em Meu perfil) ---------- */
  // Aparência: 4 estilos (forma) x 8 paletas (cores) + cor principal opcional. Tudo combina com tudo.
  const ESTILOS = {
    minimal: ["Minimalista", "Clean, muito espaço e foco nos dados."],
    editorial: ["Moderno Editorial", "Menu escuro, títulos com serifa e números grandes. Sofisticado."],
    glass: ["Glass / Aurora", "Vidro com blur, luzes da paleta e profundidade."],
    neon: ["Premium Neon", "Fundo escuro, contraste forte e gráficos luminosos."]
  };
  const PALETAS = {
    // [nome, [escuro, principal, destaque, suave, fundo]]
    cafe: ["Café", ["#2B211B", "#805A38", "#C19A62", "#E8DCCB", "#F8F4ED"]], oliva: ["Oliva", ["#283528", "#53663E", "#89975C", "#C5CDA8", "#F3F3E9"]],
    grafite: ["Grafite", ["#171719", "#414147", "#77777F", "#B9B9BF", "#F0F0F2"]], rosa: ["Rosa", ["#542B3C", "#A34466", "#D47796", "#EAB9C9", "#FAEFF3"]],
    azul: ["Azul", ["#142747", "#2456A6", "#5489D6", "#A9C7F0", "#F0F5FC"]], lavanda: ["Lavanda", ["#38245B", "#6843A6", "#9674D4", "#C9B7EB", "#F4F0FC"]],
    terracota: ["Terracota", ["#602F24", "#A65336", "#CE815B", "#E6B99C", "#F8F0E9"]], energia: ["Energia", ["#153D30", "#17865C", "#E5B323", "#A9D66B", "#F4F5EC"]]
  };
  const CORES = PALETAS;
  const ESTILO_ANTIGO = { light: "minimal", clean: "minimal", classico: "minimal", grafico: "editorial", colorful: "editorial", bold: "editorial", dark: "neon" };
  const LAYOUT_HOJE = { minimal: "classico", editorial: "classico", glass: "classico", neon: "classico" };
  const APARENCIA_PADRAO = { estilo: "minimal", cor: "cafe", custom: null };
  const normEstilo = (e) => { e = ESTILO_ANTIGO[e] || e; return ESTILOS[e] ? e : APARENCIA_PADRAO.estilo; };
  const normPaleta = (c) => (PALETAS[c] ? c : APARENCIA_PADRAO.cor);
  const normCustom = (c) => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? String(c).toLowerCase() : null);
  function lerAparencia() { try { return JSON.parse(localStorage.getItem("painel-aparencia") || "{}") || {}; } catch (_) { return {}; } }
  function aplicarAparencia(estilo, cor, custom, alvo) {
    const r = alvo || document.documentElement, c = normCustom(custom);
    r.dataset.estilo = normEstilo(estilo); r.dataset.paleta = normPaleta(cor);
    if (c) r.style.setProperty("--p-principal", c); else r.style.removeProperty("--p-principal");
    if (!alvo) try { localStorage.setItem("painel-aparencia", JSON.stringify({ estilo: r.dataset.estilo, cor: r.dataset.paleta, custom: c })); } catch (_) {}
  }
  (() => { const a = lerAparencia(); aplicarAparencia(a.estilo, a.cor, a.custom); })();

  /* ---------- Categorias e status ---------- */
  // Categorias e subcategorias (lista do curso). A categoria é a chave; a subcategoria é o nome.
  const CATS_SUB = {
    moda: ["Moda e acessórios", ["Roupas masculinas", "Roupas femininas", "Roupas infantis", "Roupas íntimas", "Pijamas e roupas de dormir", "Moda esportiva", "Moda praia", "Calçados masculinos", "Calçados femininos", "Bolsas", "Mochilas", "Carteiras", "Relógios", "Joias e bijuterias", "Óculos", "Acessórios de cabelo", "Acessórios de moda", "Malas e artigos de viagem"]],
    beleza: ["Beleza e cuidados pessoais", ["Maquiagem", "Cuidados com a pele", "Cuidados faciais", "Cuidados corporais", "Cuidados com os cabelos", "Shampoos e condicionadores", "Finalizadores capilares", "Perfumes", "Fragrâncias", "Higiene pessoal", "Produtos para unhas", "Acessórios de maquiagem", "Ferramentas de beleza", "Aparelhos de beleza"]],
    casa: ["Casa e estilo de vida", ["Decoração", "Organização doméstica", "Cozinha", "Utensílios de cozinha", "Eletrodomésticos", "Limpeza doméstica", "Lavanderia", "Iluminação", "Móveis", "Cama, mesa e banho", "Ferramentas", "Ferragens", "Jardinagem", "Produtos para atividades ao ar livre", "Artigos esportivos"]],
    eletronicos: ["Eletrônicos e eletrodomésticos", ["Celulares", "Tablets", "Acessórios para celulares", "Acessórios para tablets", "Informática", "Acessórios de informática", "Fones de ouvido", "Caixas de som", "Equipamentos de áudio", "Cabos", "Carregadores", "Power banks", "Smartwatches", "Acessórios eletrônicos", "Câmeras e acessórios", "Iluminação para fotografia", "Pequenos eletrodomésticos", "Aparelhos de higiene pessoal"]],
    auto: ["Automóveis e motocicletas", ["Acessórios automotivos", "Peças automotivas", "Iluminação automotiva", "Organização automotiva", "Limpeza automotiva", "Manutenção automotiva", "Acessórios para motocicletas", "Peças para motocicletas", "Capacetes e acessórios"]],
    pets: ["Produtos para animais", ["Alimentos para cães", "Alimentos para gatos", "Petiscos", "Brinquedos para animais", "Higiene para pets", "Acessórios para pets", "Camas e transporte", "Cuidados com cães e gatos", "Produtos para pássaros", "Produtos para peixes", "Produtos para pequenos animais"]],
    bebe: ["Bebê e maternidade", ["Roupas para bebês", "Acessórios para bebês", "Alimentação infantil", "Higiene infantil", "Cuidados com bebês", "Brinquedos infantis", "Produtos de maternidade"]],
    saude: ["Saúde, nutrição e bem-estar", ["Vitaminas e minerais", "Suplementos alimentares", "Nutrição esportiva", "Produtos de bem-estar", "Cuidados pessoais"]],
    alimentos: ["Alimentos e bebidas", ["Snacks e petiscos", "Doces e chocolates", "Alimentos embalados", "Ingredientes culinários", "Bebidas não alcoólicas", "Produtos para panificação"]],
    joias: ["Joias de alto valor", ["Joias de ouro", "Joias de prata", "Pedras preciosas"]],
    outros: ["Outros", []]
  };
  const CATS = Object.fromEntries(Object.entries(CATS_SUB).map(([k, [n]]) => [k, n]));
  // Categorias da versão antiga do painel
  const CAT_ANTIGA = { tech: "eletronicos", fitness: "saude", infantil: "bebe" };
  // Reconhece pelo nome do produto: a primeira pista que bater vence (as mais específicas vêm antes)
  const P = (cat, sub, re) => [cat, sub, re];
  const PISTAS = [
    P("joias", "Joias de ouro", /ouro (18k|18 ?quilates|750|maci[cç]o)|\b18k\b/i), P("joias", "Joias de prata", /prata (925|maci[cç]a|legítima)/i), P("joias", "Pedras preciosas", /diamante|esmeralda|\brubi\b|safira|pedra preciosa/i),
    P("moda", "Mochilas", /mochila/i),
    P("bebe", "Produtos de maternidade", /maternidade|gestante|amamenta|tirar leite|bomba de leite|p[oó]s[- ]parto/i),
    P("bebe", "Roupas para bebês", /(body|macac[aã]o|roupa|conjunto|mij[aã]o|saida de maternidade).{0,25}beb[eê]|beb[eê].{0,15}(body|roupa|macac)/i),
    P("pets", "Alimentos para cães", /ra[cç][aã]o.{0,25}(c[aã]o|c[aã]es|cachorro|dog)|(c[aã]es|cachorro).{0,15}ra[cç][aã]o/i),
    P("pets", "Alimentos para gatos", /ra[cç][aã]o.{0,25}(gato|cat\b|felin)|sach[eê].{0,10}gato/i),
    P("pets", "Petiscos", /petisco|bifinho|osso.{0,10}(c[aã]o|cachorro)|snack.{0,10}(c[aã]o|cachorro|gato|pet)/i),
    P("pets", "Cuidados com cães e gatos", /verm[ií]fugo|antipulga|carrapat|suplemento.{0,10}pet/i),
    P("pets", "Brinquedos para animais", /brinquedo.{0,20}(pet|c[aã]o|cachorro|gato)|arranhador|varinha.{0,10}gato|mordedor.{0,10}(pet|c[aã]o|cachorro)|bolinha.{0,10}(c[aã]o|cachorro|pet)/i),
    P("pets", "Higiene para pets", /tapete higi[eê]nico|areia (para gato|sanit[aá]ria)|(shampoo|escova|cortador de unha|len[cç]o).{0,15}(pet|c[aã]o|cachorro|gato)|tira pelos pet/i),
    P("pets", "Camas e transporte", /(cama|almofada|caminha).{0,10}(pet|c[aã]o|cachorro|gato)|caixa de transporte|bolsa de transporte|casinha (pet|de cachorro)/i),
    P("pets", "Produtos para pássaros", /p[aá]ssaro|calopsita|gaiola|alpiste|periquito/i), P("pets", "Produtos para peixes", /aqu[aá]rio|peixe/i),
    P("pets", "Produtos para pequenos animais", /hamster|coelho|porquinho[- ]da[- ][ií]ndia|roedor/i),
    P("pets", "Acessórios para pets", /coleira|peitoral (pet|para c)|comedouro|bebedouro (pet|para)|\bpet\b|cachorro|\bgatos?\b|\bc[aã]es\b|felin/i),
    P("auto", "Capacetes e acessórios", /capacete|viseira|intercomunicador/i),
    P("auto", "Peças para motocicletas", /(pe[cç]a|retrovisor|manete|pneu|corrente|pastilha|escapamento).{0,20}\bmoto/i),
    P("auto", "Acessórios para motocicletas", /\bmotos?\b|motocicleta|motoqueiro/i),
    P("auto", "Iluminação automotiva", /farol|l[aâ]mpada.{0,15}(farol|automotiv|carro|h\d)|led automotiv|super ?led/i),
    P("auto", "Limpeza automotiva", /(cera|shampoo|limpa|aspirador|flanela|pano|pretinho).{0,25}(carro|automotiv|ve[ií]cul|pneu)|lava[- ]?jato|polidor/i),
    P("auto", "Organização automotiva", /organizador.{0,20}(carro|banco|porta[- ]malas)|porta[- ]malas/i),
    P("auto", "Manutenção automotiva", /calibrador|compressor de ar|macaco hidr|scanner automotiv|\bobd\b|bateria.{0,10}carro|aditivo|[oó]leo (do )?motor/i),
    P("auto", "Peças automotivas", /(pe[cç]a|filtro|pastilha|amortecedor|retrovisor|palheta).{0,25}(carro|automotiv)|palheta/i),
    P("auto", "Acessórios automotivos", /\bcarros?\b|automotiv|ve[ií]cul|veicular|capa de banco|para[- ]sol/i),
    P("saude", "Vitaminas e minerais", /(vitamina|multivitam|magn[eé]sio|zinco|[oô]mega ?3|ferro).{0,40}(c[aá]psula|comprimido|gotas|mastig[aá]vel|caps\b)|multivitam|[oô]mega ?3|magn[eé]sio quelato/i),
    P("saude", "Nutrição esportiva", /whey|creatina|pr[eé][- ]treino|\bbcaa\b|prote[ií]na em p[oó]|hipercal[oó]rico|barra de prote[ií]na|glutamina|coqueteleira/i),
    P("saude", "Suplementos alimentares", /suplemento|col[aá]geno|c[aá]psulas?\b|termog[eê]nico|melatonina|probi[oó]tico|ch[aá] (emagrecedor|detox)/i),
    P("eletronicos", "Aparelhos de higiene pessoal", /escova (de dente )?el[eé]trica|barbeador|aparador de (pelos|barba)|irrigador oral|m[aá]quina de (cortar cabelo|acabamento)/i),
    P("eletronicos", "Smartwatches", /smart ?watch|rel[oó]gio inteligente|smart ?band|mi band/i),
    P("eletronicos", "Power banks", /power ?bank|carregador port[aá]til|bateria externa/i),
    P("eletronicos", "Iluminação para fotografia", /ring ?light|softbox|luz de v[ií]deo|iluminador de v[ií]deo|painel de led (para )?(foto|v[ií]deo)/i),
    P("eletronicos", "Fones de ouvido", /\bfones?\b|earbud|headset|headphone|airpods?/i),
    P("eletronicos", "Caixas de som", /caixa de som|caixinha de som|speaker|soundbar/i),
    P("eletronicos", "Equipamentos de áudio", /microfone|lapela|mesa de som|interface de [aá]udio/i),
    P("eletronicos", "Acessórios para tablets", /(capa|pel[ií]cula|caneta|teclado|suporte).{0,20}(tablet|ipad)|caneta touch|apple pencil/i),
    P("eletronicos", "Acessórios para celulares", /\bcapas?\b|capinha|pel[ií]cula|suporte (de |para )?celular|pop ?socket|anel (de|para) celular|magsafe|\bcase\b|celular.{0,20}suporte/i),
    P("eletronicos", "Câmeras e acessórios", /c[aâ]mera|webcam|gopro|gimbal|estabilizador|trip[eé]|lente (para|de) celular|cart[aã]o de mem[oó]ria/i),
    P("eletronicos", "Carregadores", /carregador|fonte usb|carregamento r[aá]pido/i),
    P("eletronicos", "Cabos", /\bcabos?\b|lightning/i),
    P("eletronicos", "Pequenos eletrodomésticos", /air ?fryer|fritadeira|liquidificador|mixer|cafeteira|processador|sanduicheira|batedeira|chaleira el[eé]trica|panela el[eé]trica|aspirador|grill|torradeira|espremedor|seladora|mopa? el[eé]tric/i),
    P("eletronicos", "Acessórios de informática", /\bmouse\b|teclado|mouse ?pad|hub usb|suporte (de |para )?notebook|pen ?drive|\bssd\b|hd externo/i),
    P("eletronicos", "Informática", /notebook|computador|monitor|impressora|roteador|repetidor wi/i),
    P("eletronicos", "Tablets", /tablet|\bipad\b/i), P("eletronicos", "Celulares", /\bcelular\b|smartphone|iphone|galaxy|redmi|xiaomi|motorola/i),
    P("beleza", "Aparelhos de beleza", /secador|chapinha|prancha (alisadora|de cabelo)|escova (secadora|alisadora|rotativa|modeladora)|babyliss|modelador de cachos|depilador|epilador|massageador facial|microcorrente|radiofrequ[eê]ncia|led facial/i),
    P("beleza", "Acessórios de maquiagem", /pinc[eé]is|pincel|esponja (de )?maquiag|beauty ?blender|kit de pinc/i),
    P("beleza", "Maquiagem", /maquiag|batom|corretivo|blush|r[ií]mel|m[aá]scara de c[ií]lios|sombra|delineador|p[oó] (compacto|facial|solto)|gloss|iluminador|contorno|primer|bruma fixadora|lip ?tint|base (l[ií]quida|de maquiag|matte)/i),
    P("beleza", "Produtos para unhas", /esmalte|unhas?\b|cabine (led|uv)|top coat|alongamento/i),
    P("beleza", "Cuidados faciais", /s[eé]rum|vitamina c|[aá]cido hialur|niacinamida|t[oô]nico facial|sabonete facial|m[aá]scara facial|creme facial|retinol|esfoliante facial|olheira|facial/i),
    P("beleza", "Shampoos e condicionadores", /shampoo|xampu|condicionador/i),
    P("beleza", "Finalizadores capilares", /finalizador|leave[- ]?in|creme de pentear|[oó]leo capilar|reparador de pontas|gel capilar|mousse capilar|pomada (capilar|modeladora)/i),
    P("beleza", "Cuidados com os cabelos", /m[aá]scara capilar|cabelos?\b|capilar|minoxidil|barba/i),
    P("beleza", "Perfumes", /perfume|eau de (parfum|toilette)|col[oô]nia/i), P("beleza", "Fragrâncias", /body splash|body mist|fragr[aâ]ncia/i),
    P("beleza", "Cuidados corporais", /corporal|desodorante|sabonete l[ií]quido|esfoliante|autobronzeador/i),
    P("beleza", "Cuidados com a pele", /protetor solar|hidratante|skin ?care|\bpele\b|acne|cravo/i),
    P("beleza", "Ferramentas de beleza", /\bpin[cç]a\b|curvex|curvador de c[ií]lios|gua ?sha|rolo de jade|espelho de maquiag|alicate de cut[ií]cula/i),
    P("beleza", "Higiene pessoal", /escova de dente|creme dental|fio dental|enxaguante|absorvente|l[aâ]mina de barbear|sabonete|cotonete|len[cç]o umedecido/i),
    P("moda", "Roupas íntimas", /calcinha|cueca|suti[aã]|lingerie|cinta modeladora|body modelador|meia[- ]cal[cç]a/i),
    P("moda", "Pijamas e roupas de dormir", /pijama|camisola|\brobe\b|roup[aã]o/i),
    P("moda", "Moda praia", /biqu[ií]ni|\bmai[oô]\b|sunga|sa[ií]da de praia|\bcanga\b/i),
    P("moda", "Moda esportiva", /legging|top fitness|conjunto fitness|short fitness|cal[cç]a fitness|roupa de academia|bermuda ciclista/i),
    P("moda", "Roupas infantis", /(roupa|conjunto|vestido|camiseta|pijama|short|cal[cç]a).{0,25}(infantil|menin[oa]|crian[cç]a|kids)/i),
    P("moda", "Calçados femininos", /(t[eê]nis|sand[aá]lia|sapat|chinelo|bota|mule|tamanco).{0,30}(femin|mulher)|rasteirinha|scarpin|salto alto|sapatilha/i),
    P("moda", "Calçados masculinos", /(t[eê]nis|sand[aá]lia|sapat|chinelo|bota).{0,30}(mascul|homem)|mocassim/i),
    P("moda", "", /t[eê]nis|sand[aá]lia|sapato|chinelo|\bbota\b|crocs|\bslide\b/i),
    P("moda", "Roupas femininas", /vestido|\bsaia\b|cropped|\bblusa|(cal[cç]a|camis|conjunto|short|jaqueta|moletom|regata).{0,30}(femin|mulher)/i),
    P("moda", "Roupas masculinas", /(camis|cal[cç]a|bermuda|short|jaqueta|moletom|polo|conjunto|regata).{0,30}(mascul|homem)|camisa polo/i),
    P("moda", "", /camiset|camisa|cal[cç]a|bermuda|\bshort|jaqueta|moletom|regata|roupa|blazer|macac[aã]o/i),
    P("moda", "Bolsas", /bolsa|necessaire|pochete|clutch/i), P("moda", "Carteiras", /carteira|porta[- ]cart/i),
    P("moda", "Relógios", /rel[oó]gio/i), P("moda", "Joias e bijuterias", /bijuteria|\bcolar\b|brincos?\b|pulseira|\banel\b|tornozeleira|choker|piercing|banhad[oa] a ouro|folheado/i),
    P("moda", "Óculos", /[oó]culos/i), P("moda", "Acessórios de cabelo", /presilha|piranha|tiara|scrunchie|xuxinha|el[aá]stico de cabelo|faixa de cabelo|grampo/i),
    P("moda", "Malas e artigos de viagem", /\bmalas?\b|organizador de mala|travesseiro de pesco[cç]o/i),
    P("moda", "Acessórios de moda", /\bcinto\b|chap[eé]u|\bbon[eé]\b|cachecol|\bluvas?\b|gravata|\blen[cç]o\b/i),
    P("bebe", "Alimentação infantil", /mamadeira|chupeta|papinha|prato infantil|copo de transi|babador|esterilizador/i),
    P("bebe", "Higiene infantil", /fralda|banheira.{0,10}beb|assadura|(shampoo|sabonete|len[cç]o).{0,15}(infantil|beb)/i),
    P("bebe", "Cuidados com bebês", /bab[aá] eletr|aspirador nasal|carrinho de beb|cadeirinha|ber[cç]o|beb[eê] conforto|\bsling\b|canguru/i),
    P("bebe", "Brinquedos infantis", /brinquedo|boneca|lego|blocos de montar|pel[uú]cia|quebra[- ]cabe[cç]a|massinha|slime|infantil|crian[cç]a/i),
    P("bebe", "Acessórios para bebês", /beb[eê]|naninha|mordedor/i),
    P("casa", "Lavanderia", /varal|lavanderia|tira (pelos|bolinhas)|removedor de bolinhas|ferro de passar|t[aá]bua de passar|sab[aã]o em p[oó]|amaciante|cesto de roupa/i),
    P("casa", "Limpeza doméstica", /limpa|limpeza|\bmop\b|vassoura|\brodo\b|pano de ch[aã]o|esponja|desengordurante|odoriz|lustra|tira manchas|desinfetante|escova sanit/i),
    P("casa", "Utensílios de cozinha", /esp[aá]tula|\bconcha\b|t[aá]bua de corte|\bfacas?\b|ralador|descascador|abridor|peneira|\bfouet\b|pegador|assadeira|\bforma (de|para)|cortador de (legume|fruta)|fatiador|pote herm[eé]tico/i),
    P("casa", "Cozinha", /panela|frigideira|cozinha|\bcopos?\b|caneca|x[ií]cara|\bpratos?\b|talher|garrafa|marmita|lancheira|\bjarra\b|\bpotes?\b/i),
    P("casa", "Organização doméstica", /organizador|cesto|caixa organizadora|cabide|prateleira|gaveteiro|porta[- ]trecos?|sapateira/i),
    P("casa", "Eletrodomésticos", /ventilador|umidificador|purificador|aquecedor|micro[- ]?ondas|geladeira|frigobar|lava[- ]lou[cç]as|ar[- ]condicionado/i),
    P("casa", "Iluminação", /lumin[aá]ria|abajur|l[aâ]mpada|fita (de )?led|refletor|arandela|pendente|luz noturna|\bspot\b/i),
    P("casa", "Cama, mesa e banho", /len[cç]ol|toalha|travesseiro|edredom|colcha|fronha|cobertor|\bmanta\b|jogo de cama|tapete de banheiro/i),
    P("casa", "Móveis", /cadeira|\bmesa\b|\bsof[aá]\b|\brack\b|estante|banqueta|poltrona|criado[- ]mudo|c[oô]moda|escrivaninha|\bpuff\b/i),
    P("casa", "Ferramentas", /furadeira|parafusadeira|chave de fenda|kit de ferramentas?|alicate|martelo|\btrena\b|n[ií]vel a laser|\bserra\b|lixadeira|soprador/i),
    P("casa", "Ferragens", /parafuso|\bbucha\b|dobradi[cç]a|fechadura|puxador|\bgancho\b|\bprego\b|cadeado/i),
    P("casa", "Jardinagem", /jardim|jardinagem|vaso de planta|regador|mangueira|sementes?\b|\badubo\b|tesoura de poda/i),
    P("casa", "Produtos para atividades ao ar livre", /camping|barraca|lanterna|cooler|rede de descanso|churrasqueira|caixa t[eé]rmica|pesca/i),
    P("casa", "Artigos esportivos", /\bbola\b|raquete|bicicleta|\bbike\b|patins|skate|halter|anilha|kettlebell|el[aá]stico.{0,15}(exerc|treino|resist)|corda de pular|tapete de yoga|colchonete|faixa el[aá]stica|caneleira|academia|yoga|pilates/i),
    P("casa", "Decoração", /decora|\bquadros?\b|\bvasos?\b|espelho|\bvelas?\b|tapete|cortina|almofada|porta[- ]retrato|planta artificial|difusor|aromatizador/i),
    P("saude", "Produtos de bem-estar", /massage|pistola de massagem|bolsa t[eé]rmica|travesseiro ortop|corretor postural|aromaterapia|[oó]leo essencial|palmilha/i),
    P("saude", "Cuidados pessoais", /balan[cç]a|term[oô]metro|ox[ií]metro|medidor de press[aã]o|nebulizador|joelheira|meia de compress/i),
    P("alimentos", "Snacks e petiscos", /snack|salgadinho|amendoim|castanha|pipoca|\bchips\b|biscoito|bolacha|granola/i),
    P("alimentos", "Doces e chocolates", /chocolate|\bdoces?\b|\bbalas?\b|bombom|brigadeiro|trufa|pa[cç]oca|geleia/i),
    P("alimentos", "Bebidas não alcoólicas", /\bsuco\b|refrigerante|\bch[aá]\b|caf[eé] (em gr[aã]o|mo[ií]do|sol[uú]vel)|c[aá]psulas? de caf[eé]|energ[eé]tico|isot[oô]nico|[aá]gua de coco/i),
    P("alimentos", "Produtos para panificação", /fermento|farinha|mistura para bolo|confeitaria|bico de confeitar|corante aliment/i),
    P("alimentos", "Ingredientes culinários", /tempero|azeite|sal rosa|especiaria|a[cç][uú]car|ado[cç]ante|\bmolho\b/i),
    P("alimentos", "Alimentos embalados", /macarr[aã]o|\barroz\b|feij[aã]o|enlatad|alimento|\bcomida\b/i),
    P("eletronicos", "Acessórios eletrônicos", /\busb\b|bluetooth|\bled\b|controle remoto|\bsmart\b|eletr[oô]nic|adaptador|projetor|\bpilhas?\b|recarreg[aá]vel|wi-?fi/i)
  ];
  const reconhecerCat = (nome) => { const t = String(nome || ""); for (const [c, s, re] of PISTAS) if (re.test(t)) return { cat: c, sub: s }; return { cat: "outros", sub: "" }; };
  const sugerirCat = (nome) => reconhecerCat(nome).cat;
  // Categoria do produto: a que o aluno corrigiu (convertendo nomes antigos) ou a reconhecida pelo nome
  function catDoProduto(pr, nome) {
    const auto = reconhecerCat(nome);
    if (!pr || !pr.categoria) return auto;
    const cat = CAT_ANTIGA[pr.categoria] || (CATS_SUB[pr.categoria] ? pr.categoria : "outros");
    const subs = CATS_SUB[cat][1];
    const sub = pr.subcategoria != null ? (subs.includes(pr.subcategoria) ? pr.subcategoria : "") : (auto.cat === cat ? auto.sub : "");
    return { cat, sub };
  }
  const catStatus = (s) => (s === "Liquidado" ? "liq" : s === "Pendente" ? "pen" : /ineleg/i.test(s || "") ? "ine" : s === "Aguardando pagamento" || s === "AwaitingPayment" ? "agu" : "out");
  const valido = (p) => p.cat === "liq" || p.cat === "pen";

  // Colunas do arquivo "Pedidos de afiliados" do TikTok, pelo título exato
  const COLUNAS = {
    pedido_id: "ID do pedido", sku_id: "ID do SKU", produto_id: "ID do produto", produto: "Nome do produto", loja: "Nome da loja",
    itens: "Itens vendidos", reembolsados: "Itens reembolsados", status: "Status de liquidação do pedido",
    tipo_conteudo: "Tipo de conteúdo", conteudo_id: "ID do conteúdo", gmv: "GMV",
    padrao: "Comissão padrão estimada", anuncios: "Comissão estimada de anúncios da loja", bonus: "Bônus estimado",
    recebido: "Valor total final recebido", data: "Data do pedido", liquidado: "Data de liquidação da comissão"
  };
  const lerNum = (v) => {
    if (typeof v === "number") return v;
    let t = String(v == null ? "" : v).replace(/R\$|\s/g, "").trim();
    if (!t || t === "/" || t === "-") return 0;
    if (/^-?\d+\.\d{1,2}$/.test(t)) return Number(t);
    return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
  };
  // "10/11/2026 22:47:14" vira "2026-11-10T22:47:14"
  const lerData = (v) => {
    if (v instanceof Date && !isNaN(v)) return `${isoLocal(v)}T${pad(v.getHours())}:${pad(v.getMinutes())}:${pad(v.getSeconds())}`;
    const t = String(v || "").trim();
    let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] || 0)}:${m[5] || "00"}:${m[6] || "00"}`;
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}` : null;
  };
  // Os 32 primeiros bits do ID de um vídeo do TikTok são o momento em que ele foi postado
  const postadoPeloId = (id) => { try { return isoLocal(new Date(Number(BigInt(id) >> 32n) * 1000)); } catch (_) { return ""; } };

  /* =============================================================
     DADOS: Supabase ou demonstração (mesmos métodos nos dois)
     ============================================================= */
  // Supadata direto do navegador (a Supadata libera chamadas de qualquer site)
  function erroSupadata(status, corpo) {
    const codigo = String((corpo && corpo.error) || "").toLowerCase(), det = String((corpo && (corpo.details || corpo.message)) || "");
    if (codigo === "limit-exceeded" || status === 429 || status === 402) {
      if (/plan usage|usage limit|credits/i.test(det) || status === 402) return { tipo: "cota", erro: "Os créditos da Supadata deste mês acabaram. Eles voltam no começo do mês que vem." };
      return { tipo: "ritmo", erro: "Foram muitos pedidos seguidos. Espere 1 minutinho e tente de novo." };
    }
    if (status === 401 || status === 403 || codigo === "unauthorized") return { tipo: "chave-errada", erro: "A sua chave da Supadata não funcionou. Copie de novo no site da Supadata (API Keys, começa com sd_) e cole em Meu perfil." };
    if (status === 206 || codigo === "transcript-unavailable") return { tipo: "sem-fala", erro: "Não achei fala nesse vídeo. Costuma ser vídeo só com música ou só com texto na tela." };
    if (status === 404 || codigo === "not-found") return { tipo: "nao-achou", erro: "Não encontrei esse vídeo. Ele pode ser privado, ter sido apagado ou o link está incompleto." };
    if (status === 400 || codigo === "invalid-request") return { tipo: "link", erro: "Esse link não é aceito. Use o link completo do vídeo do TikTok." };
    return { tipo: "outro", erro: "A Supadata não conseguiu transcrever agora. Tente de novo em instantes." };
  }
  function textoSupadata(d) {
    const c = d && d.content; const texto = typeof c === "string" ? c.trim() : Array.isArray(c) ? c.map((x) => (x && x.text) || "").join(" ").replace(/\s+/g, " ").trim() : "";
    return !texto || (d && d.lang === "none") ? { tipo: "sem-fala", erro: "Não achei fala nesse vídeo. Costuma ser vídeo só com música ou só com texto na tela." } : { texto };
  }
  async function supadataDireto(chave, link, aoAndar) {
    const pedir = async (caminho) => { const r = await fetch("https://api.supadata.ai/v1" + caminho, { headers: { "x-api-key": chave } }); let d = {}; try { d = await r.json(); } catch (_) {} return { r, d }; };
    try {
      if (!/^https?:\/\//i.test(link)) return { tipo: "link", erro: "Esse link não parece de um vídeo. Ele precisa começar com https://" };
      let { r, d } = await pedir(`/transcript?url=${encodeURIComponent(link)}&mode=auto&text=true&lang=pt`);
      const job = r.status === 202 || d.jobId ? d.jobId : null;
      if (!job) return !r.ok || r.status === 206 ? erroSupadata(r.status, d) : textoSupadata(d);
      const ini = Date.now();
      while (Date.now() - ini < 6 * 60000) {
        aoAndar && aoAndar(Math.round((Date.now() - ini) / 1000));
        await new Promise((ok) => setTimeout(ok, 5000));
        ({ r, d } = await pedir(`/transcript/${encodeURIComponent(job)}`));
        if (!r.ok) return erroSupadata(r.status, d);
        if (d.status === "failed") return { tipo: "sem-fala", erro: "A Supadata não conseguiu ouvir esse vídeo. Ele pode não ter fala." };
        if (d.status === "completed" || d.content !== undefined) return textoSupadata(d);
      }
      return { erro: "Passou de 6 minutos e não ficou pronto. Tente de novo daqui a pouco." };
    } catch (_) { return { erro: "Não consegui falar com a Supadata. Confira sua internet e tente de novo." }; }
  }

  function apiSupabase() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    let uid = null;
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const voltar = () => location.origin + location.pathname;
    return {
      async sessao() { const s = ok(await sb.auth.getSession()).session; uid = s ? s.user.id : null; return s ? { id: s.user.id, email: s.user.email } : null; },
      aoMudar(cb) { sb.auth.onAuthStateChange((ev, s) => { uid = s ? s.user.id : null; cb(ev, s ? { id: s.user.id, email: s.user.email } : null); }); },
      async entrar(email, senha) { const d = ok(await sb.auth.signInWithPassword({ email, password: senha })); uid = d.user.id; return { id: d.user.id, email: d.user.email }; },
      async cadastrar(c) {
        const d = ok(await sb.auth.signUp({ email: c.email, password: c.senha, options: { emailRedirectTo: voltar(), data: { nome: c.nome, whatsapp: c.whatsapp, tiktok: c.tiktok, aceite: c.aceite } } }));
        if (d.user && Array.isArray(d.user.identities) && d.user.identities.length === 0) throw new Error("already registered");
        if (d.session) { uid = d.user.id; return { id: d.user.id, email: d.user.email }; }
        return null; // precisa confirmar o e-mail
      },
      async recuperar(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: voltar() })); },
      async novaSenha(senha) { ok(await sb.auth.updateUser({ password: senha })); },
      async sair() { await sb.auth.signOut(); uid = null; },
      async perfil() { return ok(await sb.from("perfis").select("*").eq("user_id", uid).maybeSingle()); },
      async salvarPerfil(p) { ok(await sb.from("perfis").upsert({ ...p, user_id: uid }, { onConflict: "user_id" })); },
      async pedidos() {
        const todos = [], passo = 1000; let semConta = false;
        for (let i = 0; i < 200000; i += passo) {
          let lote;
          try { lote = ok(await sb.from("pedidos").select("pedido_id,sku_id,produto_id,produto,loja,itens,reembolsados,status,tipo_conteudo,conteudo_id,gmv,comissao_est,comissao_real,data,liquidado_em" + (semConta ? "" : ",conta")).order("data", { ascending: true }).order("pedido_id").range(i, i + passo - 1)); }
          catch (e) { if (!semConta && /conta/i.test(String(e && e.message))) { semConta = true; i -= passo; continue; } throw e; }
          todos.push(...lote); if (lote.length < passo) break;
        }
        return todos;
      },
      async statusExistentes(ids) {
        const m = new Map();
        for (let i = 0; i < ids.length; i += 200) ok(await sb.from("pedidos").select("pedido_id,sku_id,status").in("pedido_id", ids.slice(i, i + 200))).forEach((x) => m.set(x.pedido_id + "|" + x.sku_id, x.status));
        return m;
      },
      async gravarPedidos(lista, aoAndar) {
        for (let i = 0; i < lista.length; i += 500) { aoAndar && aoAndar(Math.min(i + 500, lista.length)); ok(await sb.from("pedidos").upsert(lista.slice(i, i + 500).map((p) => ({ ...p, user_id: uid })), { onConflict: "user_id,pedido_id,sku_id" })); }
      },
      async importacoes() { return ok(await sb.from("importacoes").select("*").order("importado_em", { ascending: false }).limit(20)); },
      async novaImportacao(r) { ok(await sb.from("importacoes").insert({ ...r, user_id: uid })); },
      async produtos() { return ok(await sb.from("produtos").select("*")); },
      async salvarProduto(r) { ok(await sb.from("produtos").upsert({ ...r, user_id: uid }, { onConflict: "user_id,produto_id" })); },
      async videos(ini, fim) { return ok(await sb.from("videos").select("*").gte("data", ini).lte("data", fim).order("data").order("hora", { nullsFirst: false })); },
      async novosVideos(l) { return ok(await sb.from("videos").insert(l.map((v) => ({ ...v, user_id: uid }))).select("*")); },
      async mudarVideo(id, p) { ok(await sb.from("videos").update(p).eq("id", id)); },
      async apagarVideo(id) { ok(await sb.from("videos").delete().eq("id", id)); },
      async amostras() { return ok(await sb.from("amostras").select("*").order("criado_em", { ascending: false })); },
      async novaAmostra(a) { return ok(await sb.from("amostras").insert({ ...a, user_id: uid }).select("*").single()); },
      async mudarAmostra(id, p) { ok(await sb.from("amostras").update(p).eq("id", id)); },
      async apagarAmostra(id) { ok(await sb.from("amostras").delete().eq("id", id)); },
      async referencias() { return ok(await sb.from("referencias").select("*").order("criado_em", { ascending: false })); },
      async salvarReferencia(r) { ok(await sb.from("referencias").upsert({ id: r.id, link: r.link || "", autor: r.autor || "", texto: r.texto || "", copy: r.copy || "", criado_em: r.criado_em, user_id: uid }, { onConflict: "id" })); },
      async apagarReferencia(id) { ok(await sb.from("referencias").delete().eq("id", id)); },
      // Transcrição automática: o painel pede direto à Supadata, com a chave que o aluno colou em Meu perfil.
      // (Sem chave no perfil, tenta a função "transcrever" do Supabase, para quem ligou por lá.)
      async transcrever(link, aoAndar) {
        const chave = String((S.perfil && S.perfil.supadata_key) || "").trim();
        if (chave) return await supadataDireto(chave, link, aoAndar);
        const chamar = async (corpo) => {
          const { data, error } = await sb.functions.invoke("transcrever", { body: corpo });
          if (!error) return data || { erro: "Não veio resposta. Tente de novo." };
          let j = null; try { j = await error.context.json(); } catch (_) {}
          if (j && j.erro) return j;
          const st = error.context && error.context.status;
          if (st === 404 || /Failed to send|not found/i.test(String(error.message))) return { tipo: "sem-chave", erro: "Falta a sua chave da Supadata. Crie uma conta grátis em supadata.ai, copie a API key e cole em Meu perfil > Chave da Supadata." };
          return { erro: "Não deu para transcrever agora. Tente de novo em instantes." };
        };
        if (/(vm|vt)\.tiktok\.com\//i.test(link)) { const r0 = await chamar({ acao: "resolver", link }); if (r0 && r0.link) link = r0.link; }
        const ini = Date.now(); let r = await chamar({ acao: "iniciar", link }), job = r && r.jobId;
        while (job) {
          if (Date.now() - ini > 6 * 60000) return { erro: "Passou de 6 minutos e não ficou pronto. Tente de novo daqui a pouco." };
          aoAndar && aoAndar(Math.round((Date.now() - ini) / 1000));
          await new Promise((ok2) => setTimeout(ok2, 5000));
          r = await chamar({ acao: "job", jobId: job });
          if (!(r && r.processando)) job = null;
        }
        return r;
      }
    };
  }

  function apiDemo() {
    const B = { perfil: null, pedidos: [], produtos: [], importacoes: [], videos: [], amostras: [], id: 1, refs: [{ id: "r1", link: "https://www.tiktok.com/@exemplo/video/7312345678901234567", autor: "@exemplo", titulo: "", texto: "gente para tudo que eu achei o processador que cabe na palma da mão olha isso aqui pica cebola alho tudo em dez segundos e é recarregável no USB eu uso todo dia pra fazer o almoço e não suja nada clica aqui no carrinho que ainda tá com frete grátis", copy: "", criado_em: "2026-11-18T10:00:00" }] };
    let rnd = 7; const r = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
    const PROD = [
      // nome, preço, comissão %, vendas/dia, formato: estavel | sobe | novo | cai
      ["Mini processador elétrico USB recarregável", 59.9, .15, 3.2, "estavel"], ["Ring light 26cm com tripé de chão", 89.9, .12, 2.1, "estavel"],
      ["Fone bluetooth TWS com case espelhado", 79.9, .14, 1.6, "cai"], ["Garrafa térmica 1L com display de temperatura", 64.9, .16, .9, "sobe"],
      ["Organizador de gaveta modular kit 8 peças", 39.9, .18, 1.2, "estavel"], ["Sérum vitamina C 30ml", 49.9, .2, .7, "sobe"],
      ["Cropped canelado alça fina", 34.9, .17, 1.4, "estavel"], ["Luminária LED de mesa recarregável", 69.9, .13, .5, "novo"],
      ["Suporte de celular articulado para mesa", 29.9, .15, 1.0, "cai"], ["Escova secadora 3 em 1", 129.9, .1, .35, "novo"],
      ["Mini aspirador portátil sem fio", 99.9, .12, .4, "estavel"], ["Capa magsafe transparente iPhone", 44.9, .18, .25, "novo"]
    ];
    const hoje = hojeISO(), fimDados = somaDias(hoje, -1), iniDados = somaDias(fimDados, -130);
    const conteudos = PROD.map((_, k) => Array.from({ length: 2 + (k % 4) }, (_, j) => (BigInt(Math.floor(new Date(somaDias(fimDados, -(10 + j * 17 + k)) + "T19:00:00").getTime() / 1000)) << 32n) + BigInt(1000 + k * 37 + j)).map(String));
    let n = 0;
    for (let d = iniDados; d <= fimDados; d = somaDias(d, 1)) {
      const idade = Math.round((new Date(fimDados) - new Date(d)) / 864e5);
      // Conta de exemplo grande: ~R$ 90 mil por mês, crescendo uns 12% ao mês
      const cresce = 1 / (1 + .004 * idade);
      PROD.forEach(([nome, preco, com, base0, forma], k) => {
        const base = base0 * 4.2 * cresce;
        let taxa = base;
        if (forma === "sobe") taxa = base * (idade > 28 ? .35 : idade > 14 ? .7 : 1.9);
        if (forma === "cai") taxa = base * (idade > 14 ? 1.3 : .35);
        if (forma === "novo") taxa = idade > 12 ? 0 : base * 2.2;
        const dow = new Date(d + "T12:00:00").getDay(); if (dow === 0 || dow === 6) taxa *= 1.25;
        let q = 0; const lim = Math.exp(-taxa); let pr = 1; do { q++; pr *= r(); } while (pr > lim); q--;
        for (let x = 0; x < q; x++) {
          const lojaEx = ["Casa Prática Store", "Foto & Luz Oficial", "Som Total Shop", "Casa Prática Store", "Organiza Já", "Bella Pele Cosméticos"][k % 6];
          const st = r() < (lojaEx === "Som Total Shop" ? .28 : .05) ? "Inelegível" : idade > 18 ? "Liquidado" : r() < .1 ? "AwaitingPayment" : "Pendente";
          const itens = r() < .12 ? 2 : 1, gmv = Math.round(preco * itens * 100) / 100, ce = Math.round(gmv * com * 100) / 100;
          const cs = conteudos[k];
          B.pedidos.push({ pedido_id: String(5800000000000000000n + BigInt(++n * 7919)), sku_id: String(1729000000 + k), produto_id: String(1730000000000 + k * 11), produto: nome, loja: lojaEx, conta: k % 3 === 2 ? "c2" : "", itens, reembolsados: 0, status: st,
            tipo_conteudo: r() < .9 ? "Vídeo" : "Vitrine", conteudo_id: cs[Math.floor(r() * cs.length)], gmv, comissao_est: ce, comissao_real: st === "Liquidado" ? ce : null,
            data: `${d}T${pad(8 + Math.floor(r() * 15))}:${pad(Math.floor(r() * 60))}:00`, liquidado_em: st === "Liquidado" ? `${somaDias(d, 15)}T10:00:00` : null });
        }
      });
    }
    B.pedidos.sort((a, b) => a.data.localeCompare(b.data));
    if (/vazio/.test(location.search)) { B.pedidos = []; B.amostras = []; B.semVendas = true; } // exemplo de quem ainda não vende
    B.importacoes.push({ id: B.id++, arquivo: "affiliate_orders_exemplo.xlsx", periodo_ini: iniDados, periodo_fim: fimDados, linhas: B.pedidos.length, novas: B.pedidos.length, atualizadas: 0, importado_em: new Date().toISOString() });
    B.amostras.push({ id: B.id++, produto: "Mini projetor portátil 4K", recebida_em: somaDias(hoje, -4), prazo_postar: somaDias(hoje, 3), custo: 0, decisao: "testando", obs: "" },
      { id: B.id++, produto: "Kit pincéis de maquiagem 12 peças", recebida_em: somaDias(hoje, -9), prazo_postar: somaDias(hoje, -1), custo: 0, decisao: "testando", obs: "" });
    const clone = (x) => JSON.parse(JSON.stringify(x));
    return {
      async sessao() { return B.perfil ? { id: "demo", email: B.perfil.email } : null; },
      aoMudar() {},
      async entrar(email) { B.perfil = B.perfil || { user_id: "demo", email: email || "voce@exemplo.com", nome: "Aluno de exemplo", whatsapp: "27912345678", tiktok: "@seuuser", aceite_avisos: true, meta_videos: 15, meta_gmv: 100000, estilo: lerAparencia().estilo || "minimal", cor: lerAparencia().cor || "cafe", cor_custom: lerAparencia().custom || null }; return { id: "demo", email: B.perfil.email }; },
      async cadastrar(c) { B.perfil = { user_id: "demo", email: c.email, nome: c.nome, whatsapp: c.whatsapp, tiktok: c.tiktok, aceite_avisos: c.aceite, meta_videos: 15, meta_gmv: null, estilo: "classico", cor: "cafe" }; return { id: "demo", email: c.email }; },
      async recuperar() {}, async novaSenha() {}, async sair() { B.perfil = null; },
      async perfil() { return clone(B.perfil); },
      async salvarPerfil(p) { Object.assign(B.perfil, p); },
      async pedidos() { return clone(B.pedidos); },
      async statusExistentes(ids) { const s = new Set(ids), m = new Map(); B.pedidos.forEach((p) => { if (s.has(p.pedido_id)) m.set(p.pedido_id + "|" + p.sku_id, p.status); }); return m; },
      async gravarPedidos(lista) { const m = new Map(B.pedidos.map((p, i) => [p.pedido_id + "|" + p.sku_id, i])); lista.forEach((p) => { const k = p.pedido_id + "|" + p.sku_id; if (m.has(k)) B.pedidos[m.get(k)] = { ...p }; else B.pedidos.push({ ...p }); }); B.pedidos.sort((a, b) => a.data.localeCompare(b.data)); },
      async importacoes() { return clone(B.importacoes).reverse(); },
      async novaImportacao(x) { B.importacoes.push({ ...x, id: B.id++, importado_em: new Date().toISOString() }); },
      async produtos() { return clone(B.produtos); },
      async salvarProduto(x) { const i = B.produtos.findIndex((p) => p.produto_id === x.produto_id); if (i > -1) B.produtos[i] = { ...B.produtos[i], ...x }; else B.produtos.push({ ...x }); },
      async videos(ini, fim) { return clone(B.videos.filter((v) => v.data >= ini && v.data <= fim)).sort((a, b) => (a.data + (a.hora || "99")).localeCompare(b.data + (b.hora || "99"))); },
      async novosVideos(l) { const out = l.map((v) => ({ ...v, id: B.id++, status: v.status || "rascunho" })); B.videos.push(...out); return clone(out); },
      async mudarVideo(id, p) { Object.assign(B.videos.find((v) => v.id === id) || {}, p); },
      async apagarVideo(id) { B.videos = B.videos.filter((v) => v.id !== id); },
      async amostras() { return clone(B.amostras); },
      async novaAmostra(a) { const x = { ...a, id: B.id++ }; B.amostras.unshift(x); return clone(x); },
      async mudarAmostra(id, p) { Object.assign(B.amostras.find((a) => a.id === id) || {}, p); },
      async apagarAmostra(id) { B.amostras = B.amostras.filter((a) => a.id !== id); },
      async referencias() { return clone(B.refs); },
      async salvarReferencia(r) { const i = B.refs.findIndex((x) => x.id === r.id); if (i > -1) B.refs[i] = { ...r }; else B.refs.unshift({ ...r }); },
      async apagarReferencia(id) { B.refs = B.refs.filter((x) => x.id !== id); }
    };
  }

  const API0 = DEMO ? apiDemo() : apiSupabase();
  /* ---------- PERFIS DO TIKTOK: uma pessoa pode ter mais de um @ no mesmo painel ---------- */
  // "" = perfil principal (o @ de Meu perfil). Os outros ficam em perfis.contas: [{ id: "c2", nome: "@outro", meta: 5000 }]
  const contas = () => (S.perfil && Array.isArray(S.perfil.contas) ? S.perfil.contas : []);
  const temContas = () => contas().length > 0;
  const verTodos = () => temContas() && S.conta === "*";
  const contaAtiva = () => (!temContas() || S.conta === "*" ? "" : S.conta || "");
  const daConta = (l) => (!temContas() || S.conta === "*" ? l : (l || []).filter((x) => (x.conta || "") === (S.conta || "")));
  const comConta = (x) => (contaAtiva() ? { ...x, conta: contaAtiva() } : x);
  const nomeConta = (id) => (id ? ((contas().find((c) => c.id === id) || {}).nome || id) : ((S.perfil && (S.perfil.tiktok || "").trim()) || "Perfil principal"));
  const API = { ...API0,
    videos: async (i, f) => daConta(await API0.videos(i, f)),
    novosVideos: async (l) => API0.novosVideos(l.map(comConta)),
    amostras: async () => daConta(await API0.amostras()),
    novaAmostra: async (a) => API0.novaAmostra(comConta(a))
  };
  const chaveConta = () => "painel-perfil-tiktok:" + ((S.user && S.user.id) || "anon");
  function lerConta() { if (!temContas()) return ""; let v = null; try { v = localStorage.getItem(chaveConta()); } catch (_) {} return v === "*" || v === "" || contas().some((c) => c.id === v) ? v : "*"; }
  async function trocarConta(v) {
    S.conta = v; try { localStorage.setItem(chaveConta(), v); } catch (_) {}
    reprocessar(); S.mes = (S.ultimo || hojeISO()).slice(0, 7);
    [S.amostras, S.videosHoje] = await Promise.all([API.amostras(), API.videos(hojeISO(), hojeISO())]);
    montarMenu(); irPara(S.tela);
  }
  // Meta do mês do que está na tela: a do perfil escolhido, ou a soma em "Todos"
  function metaAtual() {
    if (!temContas() || S.conta === "") return +S.perfil.meta_gmv || 0;
    if (S.conta === "*") return (+S.perfil.meta_gmv || 0) + contas().reduce((a, c) => a + (+c.meta || 0), 0);
    return +((contas().find((c) => c.id === S.conta) || {}).meta) || 0;
  }
  async function salvarMeta(valor) {
    if (contaAtiva()) { const l = contas().map((c) => (c.id === contaAtiva() ? { ...c, meta: valor } : c)); await API.salvarPerfil({ contas: l }); S.perfil.contas = l; }
    else { await API.salvarPerfil({ meta_gmv: valor }); S.perfil.meta_gmv = valor; }
  }

  /* =============================================================
     ESTADO E LEITURA
     ============================================================= */
  const S = { user: null, perfil: null, brutos: [], pedidos: [], produtos: {}, importacoes: [], amostras: [], tela: "hoje", mes: null, filtroCat: "todas", busca: "", ordem: "c30", diaVideos: hojeISO(), videosDia: [], videosHoje: [], ultimo: "", janela: 14 };

  function enriquecer(p) {
    const cat = catStatus(p.status), itens = +p.itens || 0, rb = +p.reembolsados || 0;
    const pr = S.produtos[p.produto_id] || {};
    const nome = pr.apelido || p.produto || "Sem nome";
    return { ...p, cat, g: +p.gmv || 0, c: +p.comissao_est || 0, liq: cat === "liq" ? (+p.comissao_real || +p.comissao_est || 0) : 0,
      i: cat === "liq" || cat === "pen" ? Math.max(0, itens - rb) : itens, dia: String(p.data).slice(0, 10), mes: String(p.data).slice(0, 7),
      chave: p.produto_id || "n:" + nome, nome, ...(() => { const c = catDoProduto(pr, p.produto); return { categoria: c.cat, subcategoria: c.sub }; })() };
  }
  function reprocessar() {
    S.pedidos = (temContas() && S.conta !== "*" ? S.brutos.filter((p) => (p.conta || "") === (S.conta || "")) : S.brutos).map(enriquecer);
    S.ultimo = S.pedidos.length ? S.pedidos[S.pedidos.length - 1].dia : "";
  }
  async function carregarTudo() {
    const [perfil, brutos, produtos, importacoes, amostras] = await Promise.all([API.perfil(), API.pedidos(), API.produtos(), API.importacoes(), API0.amostras()]);
    S.perfil = perfil || { nome: "", meta_videos: 15 };
    // Primeiro login: o perfil que o aluno preencheu no guia (config.js) entra sozinho
    const ini = CFG.PERFIL_INICIAL;
    if (!DEMO && ini && typeof ini === "object" && !(S.perfil.nome || "").trim()) {
      const ok = {}; ["nome", "apelido", "tiktok", "meta_gmv", "meta_videos", "estilo", "cor"].forEach((k) => { if (ini[k] !== undefined && ini[k] !== null && ini[k] !== "") ok[k] = ini[k]; });
      if (Object.keys(ok).length) { try { await API.salvarPerfil(ok); Object.assign(S.perfil, ok); } catch (_) {} }
    }
    aplicarAparencia(S.perfil.estilo, S.perfil.cor, S.perfil.cor_custom);
    aplicarMenuRecolhido(lerMenuRecolhido());
    S.conta = lerConta(); S.amostras = daConta(amostras);
    S.brutos = brutos; S.importacoes = importacoes;
    S.produtos = {}; produtos.forEach((p) => { S.produtos[p.produto_id] = p; });
    reprocessar();
    await conferirEsgotados();
    S.mes = (S.ultimo || hojeISO()).slice(0, 7);
    S.videosHoje = await API.videos(hojeISO(), hojeISO());
    try { S.refs = await API.referencias(); } catch (_) { S.refs = []; }
  }

  function somar(l) {
    const t = { g: 0, c: 0, liq: 0, pend: 0, i: 0, gIne: 0, gAgu: 0, ped: new Set() };
    l.forEach((p) => {
      if (valido(p)) { t.g += p.g; t.c += p.c; t.i += p.i; t.ped.add(p.pedido_id); }
      if (p.cat === "liq") t.liq += p.liq;
      if (p.cat === "pen") t.pend += p.c;
      if (p.cat === "ine") t.gIne += p.g;
      if (p.cat === "agu") t.gAgu += p.g;
    });
    t.pedidos = t.ped.size; t.ticket = t.pedidos ? t.g / t.pedidos : 0;
    return t;
  }
  const entre = (ini, fim, f = () => true) => S.pedidos.filter((p) => p.dia >= ini && p.dia <= fim && f(p));

  // Mês escolhido contra o mesmo pedaço do mês anterior (dia 1 a N contra dia 1 a N)
  function periodo(mes) {
    const D = diasNoMes(mes), ultimoNoMes = S.ultimo && S.ultimo.slice(0, 7) === mes ? S.ultimo : null;
    const atual = mes === hojeISO().slice(0, 7) || (ultimoNoMes && +ultimoNoMes.slice(8, 10) < D);
    const N = atual ? +(ultimoNoMes || somaDias(hojeISO(), -1)).slice(8, 10) || 1 : D;
    const ant = mesDesloca(mes, -1), Na = Math.min(N, diasNoMes(ant));
    return { mes, D, N, atual, ini: `${mes}-01`, fim: `${mes}-${pad(N)}`, ant, iniAnt: `${ant}-01`, fimAnt: `${ant}-${pad(Na)}` };
  }

  function selo(v, ant, inverso) {
    if (ant == null) return "";
    if (!ant) return v ? `<span class="selo novo">novo</span>` : "";
    const d = (v / ant - 1) * 100;
    if (Math.abs(d) < .05) return `<span class="selo">igual</span>`;
    const bom = inverso ? d < 0 : d > 0;
    return `<span class="selo ${bom ? "sobe" : "desce"}" title="contra o mesmo período do mês anterior">${d > 0 ? "▲" : "▼"} ${pct(Math.abs(d))}</span>`;
  }

  /* Leitura de produtos nos últimos 30 dias com dados:
     sinal (Recorrente, Repetindo, Pontual) e tendência (Novo, Acelerando, Estável, Esfriando). */
  // Esgotado: o aluno marca; sai das sugestões até o produto vender de novo (aí volta sozinho)
  const esgotadoDesde = (pid) => (pid && S.produtos[pid] && S.produtos[pid].esgotado_em) || "";
  async function conferirEsgotados(calado) {
    const voltaram = [];
    for (const pid of Object.keys(S.produtos)) {
      const desde = S.produtos[pid].esgotado_em; if (!desde) continue;
      const venda = S.pedidos.find((p) => p.produto_id === pid && valido(p) && p.dia > desde);
      if (!venda) continue;
      try { await API.salvarProduto({ produto_id: pid, esgotado_em: null }); S.produtos[pid].esgotado_em = null; voltaram.push(venda.nome); } catch (e) { console.warn(e); }
    }
    const msg = voltaram.length ? `${voltaram.length === 1 ? voltaram[0] + " voltou" : voltaram.length + " produtos voltaram"} a vender e ${voltaram.length === 1 ? "voltou" : "voltaram"} para as sugestões.` : "";
    if (msg && !calado) toast(msg);
    return msg;
  }
  async function marcarEsgotado(pid, sim) {
    const data = sim ? (S.ultimo || hojeISO()) : null;
    await API.salvarProduto({ produto_id: pid, esgotado_em: data });
    S.produtos[pid] = { ...(S.produtos[pid] || { produto_id: pid }), esgotado_em: data };
    toast(sim ? "Marcado como esgotado. Sai das sugestões e volta sozinho quando vender de novo." : "Voltou para as sugestões.");
    irPara(S.tela, true);
  }
  function analiseProdutos() {
    const fim = S.ultimo || somaDias(hojeISO(), -1), ini30 = somaDias(fim, -29);
    const w = S.janela, iniA = somaDias(fim, -(w - 1)), fimB = somaDias(iniA, -1), iniB = somaDias(fimB, -(w - 1));
    const comeco = iniB < ini30 ? iniB : ini30;
    const m = new Map();
    S.pedidos.forEach((p) => {
      if (!valido(p) || p.dia < comeco || p.dia > fim) return;
      const x = m.get(p.chave) || { chave: p.chave, produto_id: p.produto_id, nome: p.nome, original: p.produto, categoria: p.categoria, subcategoria: p.subcategoria, esgotado: esgotadoDesde(p.produto_id), g30: 0, c30: 0, i30: 0, dias: new Set(), cont: new Set(), a: 0, b: 0, diasA: new Set(), diasB: new Set(), spark: new Array(14).fill(0) };
      if (p.dia >= ini30) { x.g30 += p.g; x.c30 += p.c; x.i30 += p.i; x.dias.add(p.dia); if (p.conteudo_id) x.cont.add(p.conteudo_id); }
      if (p.dia >= iniA) { x.a += p.g; x.diasA.add(p.dia); } else if (p.dia >= iniB) { x.b += p.g; x.diasB.add(p.dia); }
      const k = 13 - Math.round((new Date(fim) - new Date(p.dia)) / 864e5); if (k >= 0) x.spark[k] += p.g;
      m.set(p.chave, x);
    });
    const l = [...m.values()].filter((x) => x.g30 > 0 || x.a > 0);
    const tot = l.reduce((s, x) => s + x.c30, 0);
    l.sort((a, b) => b.c30 - a.c30 || b.g30 - a.g30);
    let ac = 0;
    l.forEach((x) => {
      x.share = tot ? x.c30 / tot * 100 : 0; ac += x.share; x.acum = ac;
      x.sinal = x.dias.size >= 10 && x.cont.size >= 2 ? "Recorrente" : x.dias.size >= 4 ? "Repetindo" : "Pontual";
      x.tend = x.b === 0 && x.a > 0 && x.diasA.size >= 3 ? "Novo" : x.b > 0 && x.a >= 1.5 * x.b && x.diasA.size >= 3 ? "Acelerando" : x.b > 0 && x.diasB.size >= 3 && x.a <= .5 * x.b ? "Esfriando" : "Estável";
      x.var = x.b ? (x.a / x.b - 1) * 100 : null;
    });
    return { lista: l, fim, ini30, iniA, iniB, fimB };
  }
  // Onde focar: principais, apostas (começando a vender) e esfriando
  function foco(an) {
    const l = an.lista.filter((x) => !x.esgotado), fortes = l.filter((x) => x.dias.size >= 10);
    const principais = (fortes.length >= 3 ? fortes : l).slice(0, 3);
    const ids = new Set(principais.map((x) => x.chave));
    const apostas = l.filter((x) => !ids.has(x.chave) && (x.tend === "Novo" || x.tend === "Acelerando")).sort((a, b) => b.a - a.a).slice(0, 5);
    const esfriando = l.filter((x) => x.tend === "Esfriando").sort((a, b) => (b.b - b.a) - (a.b - a.a)).slice(0, 3);
    return { principais, apostas, esfriando, ids };
  }
  // Plano do dia pela meta: 40% principais, 40% com vendas (apostas primeiro), 20% testes
  function planoDoDia(an, f) {
    const N = Math.max(1, +S.perfil.meta_videos || 15);
    const nP = Math.round(N * .4), nC = Math.round(N * .4), nT = N - nP - nC;
    const prin = []; for (let k = 0; k < nP && f.principais.length; k++) prin.push({ produto: f.principais[k % f.principais.length].nome, bloco: "principal" });
    const usados = new Set(f.principais.map((x) => x.chave));
    const filaC = [...f.apostas, ...an.lista.filter((x) => !x.esgotado && !usados.has(x.chave) && !f.apostas.includes(x) && x.tend !== "Esfriando")];
    const com = filaC.slice(0, nC).map((x) => ({ produto: x.nome, bloco: "com_vendas", tag: x.tend === "Novo" || x.tend === "Acelerando" ? x.tend : "" }));
    const testes = S.amostras.filter((a) => a.decisao === "testando").sort((a, b) => String(a.prazo_postar || "9").localeCompare(String(b.prazo_postar || "9"))).slice(0, nT).map((a) => ({ produto: a.produto, bloco: "teste", tag: a.prazo_postar ? `postar até ${dataBR(a.prazo_postar)}` : "amostra" }));
    return { N, nP, nC, nT, prin, com, testes };
  }
  // Horários livres de 30 em 30 min entre 8h e 23h, longe dos que já existem
  function horariosLivres(ocupados, qtd, dia) {
    const paraMin = (h) => { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); };
    const fmt = (t) => `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    const oc = ocupados.filter(Boolean).map(paraMin), agora = new Date();
    const desde = dia === hojeISO() ? agora.getHours() * 60 + agora.getMinutes() + 20 : 0;
    let livres = []; for (let t = 8 * 60; t <= 23 * 60; t += 30) if (t >= desde && oc.every((o) => Math.abs(o - t) >= 25)) livres.push(t);
    const out = []; if (livres.length <= qtd) livres.forEach((t) => out.push(fmt(t))); else for (let k = 0; k < qtd; k++) out.push(fmt(livres[Math.floor(k * livres.length / qtd)]));
    while (out.length < qtd) out.push(null);
    return out;
  }

  /* ---------- Meta do mês ---------- */
  // Previsão: mistura a média do mês com a dos últimos 7 dias (no começo do mês, os 7 dias pesam mais)
  function previsaoMes(per) {
    const t = somar(entre(per.ini, per.fim)).g;
    if (!per.atual) return t;
    const r7 = somar(entre(somaDias(per.fim, -6), per.fim)).g / 7, rm = t / per.N, w = per.N / (per.N + 7);
    return t + (w * rm + (1 - w) * r7) * (per.D - per.N);
  }
  // Sugestão: último mês fechado + o crescimento médio dos meses anteriores (entre 5% e 30%)
  function sugestaoMeta() {
    if (!S.pedidos.length) return null;
    const cur = (S.ultimo || hojeISO()).slice(0, 7), ms = [3, 2, 1].map((n) => mesDesloca(cur, -n));
    const primeiro = S.pedidos[0].dia, cheio = (m) => primeiro <= `${m}-03`;
    const tot = ms.map((m) => (cheio(m) ? somar(S.pedidos.filter((p) => p.mes === m)).g : 0));
    const r = []; if (tot[0] && tot[1]) r.push(tot[1] / tot[0] - 1); if (tot[1] && tot[2]) r.push(tot[2] / tot[1] - 1);
    const g = Math.min(.3, Math.max(.05, r.length ? r.reduce((a, b) => a + b, 0) / r.length : .1));
    let base = tot[2], motivo;
    if (base) motivo = `Seu último mês fechado (${MESES[+ms[2].slice(5, 7) - 1]}) vendeu ${real(base)} e você ${r.length ? `vem crescendo em média ${pct(g * 100)} ao mês` : "ainda não tem histórico de crescimento, então somei 10%"}.`;
    else { base = previsaoMes(periodo(cur)); if (!base) return null; motivo = `No ritmo atual você fecha este mês em ${real(base)}. A sugestão soma 10% em cima disso.`; }
    return { valor: Math.max(1000, Math.round(base * (1 + g) / 1000) * 1000), motivo, g };
  }
  function cardMeta(per, t) {
    const mes = MESES[+per.mes.slice(5, 7) - 1], meta = metaAtual(), sug = verTodos() ? null : sugestaoMeta();
    if (!meta) return `<div class="card meta-card"><div class="card-topo"><h2>Meta de ${mes}</h2></div>
      <p class="vazio">Você ainda não definiu quanto quer vender este mês.</p>
      ${sug ? `<div class="sugestao"><span class="rot">Sugestão pelo seu crescimento</span><div class="meta-num">${real(sug.valor)}</div><p class="frase">${esc(sug.motivo)}</p>
        <div class="controles"><button class="btn pequeno" type="button" data-acao="usar-sugestao">Usar essa meta</button><button class="btn sec pequeno" type="button" data-tela="perfil">Escolher outra</button></div></div>` : `<button class="btn pequeno" type="button" data-tela="perfil">Definir minha meta</button>`}</div>`;
    const prev = previsaoMes(per), p = t.g / meta * 100, esperado = per.N / per.D * 100, falta = Math.max(0, meta - t.g), dias = per.D - per.N, bate = prev >= meta;
    return `<div class="card meta-card"><div class="card-topo"><h2>Meta de ${mes}</h2><span class="espaco"></span><button class="link" type="button" data-tela="perfil">mudar</button></div>
      <span class="meta-alvo" aria-hidden="true">${svgIc("meta")}</span><div class="meta-num">${real(t.g)}</div><p class="rot">de ${real(meta)} em vendas (${pct(p)})</p>
      <div class="barra meta-barra"><i style="width:${Math.min(100, p).toFixed(1)}%"></i><b style="left:${esperado.toFixed(1)}%" title="onde você deveria estar hoje"></b></div>
      <div class="meta-linhas">
        <div><span>Falta</span><b>${real(falta)}</b></div>
        <div><span>Precisa vender por dia</span><b>${real(dias ? falta / dias : falta)}</b></div>
        <div><span>Dias que faltam</span><b>${dias}</b></div>
        <div><span>Previsão no ritmo atual</span><b>${real(prev)} <span class="selo ${bate ? "sobe" : "desce"}">${bate ? "bate" : "não bate"}</span></b></div>
      </div>
      ${sug && Math.abs(sug.valor - meta) / meta > .15 ? `<p class="frase">Pelo seu crescimento, uma meta perto de ${real(sug.valor)} é ${sug.valor > meta ? "possível" : "mais realista"}. <button class="link" type="button" data-acao="usar-sugestao">Usar ${real(sug.valor)}</button></p>` : ""}
      <p class="frase">O tracinho na barra mostra onde você deveria estar hoje para bater a meta.</p></div>`;
  }

  /* =============================================================
     DESENHOS
     ============================================================= */
  // Área de vendas por dia do mês (estilo Gráfico)
  function grafArea(per) {
    const W = 600, H = 150, v = new Array(per.D + 1).fill(0);
    S.pedidos.forEach((p) => { if (valido(p) && p.mes === per.mes) v[+p.dia.slice(8, 10)] += p.g; });
    const n = per.N, max = Math.max(...v.slice(1, n + 1), 1);
    const X = (d) => (per.D > 1 ? (d - 1) / (per.D - 1) * W : 0), Y = (val) => H - 6 - val / max * (H - 18);
    let d = ""; for (let i = 1; i <= n; i++) d += `${i > 1 ? "L" : "M"}${X(i).toFixed(1)},${Y(v[i]).toFixed(1)}`;
    return `<svg class="graf area" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas por dia do mês"><path class="a-fill" d="${d}L${X(n).toFixed(1)},${H}L0,${H}Z"/><path class="a-linha" d="${d}"/><circle class="a-ponto" cx="${X(n).toFixed(1)}" cy="${Y(v[n]).toFixed(1)}" r="5"/></svg>`;
  }
  const IC_TILE = {
    vendas: '<path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/>', mes: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    comissao: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v11"/>',
    pedidos: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>', meta: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    video: '<path d="M8 5.5v13l10-6.5z"/>',
    coroa: '<path d="M4 8l4 4 4-7 4 7 4-4-2 11H6z"/>', alerta: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    chama: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>'
  };
  const svgIc = (k) => `<svg class="i" viewBox="0 0 24 24">${IC_TILE[k]}</svg>`;
  function sparkline(v) {
    const max = Math.max(...v, 1), W = 84, H = 24;
    const d = v.map((y, i) => `${i ? "L" : "M"}${(i / (v.length - 1) * W).toFixed(1)},${(H - 2 - y / max * (H - 4)).toFixed(1)}`).join("");
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`;
  }
  // Barras do mês por dia + linha tracejada do mês anterior
  function grafMes(per) {
    const W = 720, H = 220, m = { e: 54, d: 8, t: 10, b: 24 };
    const atual = new Array(per.D + 1).fill(0), ant = new Array(diasNoMes(per.ant) + 1).fill(0);
    S.pedidos.forEach((p) => { if (!valido(p)) return; if (p.mes === per.mes) atual[+p.dia.slice(8, 10)] += p.g; else if (p.mes === per.ant) ant[+p.dia.slice(8, 10)] += p.g; });
    const max = Math.max(...atual, ...ant, 1), passo = niceStep(max);
    const topo = Math.ceil(max / passo) * passo, Y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo);
    const bw = (W - m.e - m.d) / per.D, X = (d) => m.e + (d - .5) * bw;
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas por dia">`;
    for (let v = 0; v <= topo + .1; v += passo) s += `<line class="grade-l" x1="${m.e}" x2="${W - m.d}" y1="${Y(v)}" y2="${Y(v)}"/><text class="eixo" x="${m.e - 8}" y="${Y(v) + 4}" text-anchor="end">${realCurto(v)}</text>`;
    for (let d = 1; d <= per.D; d++) {
      const v = atual[d]; if (d > per.N && per.atual) continue;
      s += `<rect class="${d === per.N && per.atual ? "b-hoje" : "b-atual"}" x="${(X(d) - bw * .36).toFixed(1)}" width="${(bw * .72).toFixed(1)}" y="${Y(v).toFixed(1)}" height="${(Y(0) - Y(v)).toFixed(1)}" rx="2" data-dica="${dataBR(`${per.mes}-${pad(d)}`)} · ${real(v)}"><title>${dataBR(`${per.mes}-${pad(d)}`)}: ${real(v)}</title></rect>`;
    }
    const pts = []; for (let d = 1; d <= Math.min(per.D, ant.length - 1); d++) pts.push(`${pts.length ? "L" : "M"}${X(d).toFixed(1)},${Y(ant[d]).toFixed(1)}`);
    s += `<path class="l-ant" d="${pts.join("")}"/>`;
    [1, 8, 15, 22, per.D].forEach((d) => { s += `<text class="eixo" x="${X(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`; });
    return s + "</svg>";
  }
  function niceStep(max) { const r = max / 4, e = Math.pow(10, Math.floor(Math.log10(r))), f = r / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }

  /* =============================================================
     TELAS
     ============================================================= */
  const ICONES = {
    pedidos: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    hoje: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    resultados: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    produtos: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6M9 11h.01M12 11h.01M15 11h.01"/>',
    videos: '<path d="M7 4.5v15l12-7.5z"/>',
    amostras: '<path d="M4 7l2 2 3-3M4 14l2 2 3-3M12 8h8M12 15h8M12 20h8"/>',
    criar: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    importar: '<path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>'
  };
  const TELAS = [["hoje", "Hoje"], ["resultados", "Resultados"], ["pedidos", "Pedidos"], ["produtos", "Produtos"], ["videos", "Vídeos"], ["criar", "Criar"], ["amostras", "Amostras"], ["importar", "Importar"]];
  const NOMES = Object.fromEntries([...TELAS, ["perfil", "Meu perfil"]]);

  function montarMenu() {
    const atrasadas = S.amostras.filter((a) => a.decisao === "testando" && a.prazo_postar && a.prazo_postar < hojeISO()).length;
    $("#menuItens").innerHTML = TELAS.map(([id, nome]) => `<button class="menu-item" type="button" data-tela="${id}" data-dica="${nome}"${S.tela === id ? ' aria-current="page"' : ""}><svg class="i" viewBox="0 0 24 24">${ICONES[id]}</svg><span class="rotulo">${nome}</span>${id === "amostras" && atrasadas ? `<span class="bolinha" title="amostras com prazo vencido">${atrasadas}</span>` : ""}</button>`).join("");
    $$('.menu-rodape [data-tela]').forEach((b) => b.toggleAttribute("aria-current", S.tela === b.dataset.tela));
    $$(".assina").forEach((el) => { el.textContent = (S.perfil.nome || "").trim() || "Meu painel"; });
    const nomeQuem = (S.perfil.nome || "").trim() || (S.user && S.user.email) || "", arroba = (S.perfil.tiktok || "").trim();
    $("#quem").innerHTML = `<b>${esc(nomeQuem)}</b>${arroba ? `<span>${esc(arroba)}</span>` : ""}`;
    const ini = nomeQuem.split(/[\s@.]+/).filter(Boolean);
    $("#avatar").textContent = ((ini[0] || "?")[0] + (ini.length > 1 ? ini[ini.length - 1][0] : "")).toUpperCase();
    $("#marcaSinal").textContent = (((S.perfil.nome || "").trim() || "M")[0]).toUpperCase();
    $("#sair").dataset.dica = nomeQuem ? "Sair (" + nomeQuem + ")" : "Sair";
    $("#telaNomeCel").textContent = NOMES[S.tela] || "";
    const bc = $("#boxConta"); if (bc) { bc.hidden = !temContas(); if (temContas()) $("#selConta").innerHTML = [["*", "Todos os perfis"], ["", nomeConta("")], ...contas().map((c) => [c.id, c.nome || c.id])].map(([v, n]) => `<option value="${esc(v)}"${S.conta === v ? " selected" : ""}>${esc(n)}</option>`).join(""); }
  }
  async function irPara(tela, manterRolagem) {
    const y = window.scrollY;
    S.tela = tela; try { history.replaceState(null, "", "#" + tela); } catch (_) {}
    fecharMenu(); montarMenu(); if (!manterRolagem) window.scrollTo(0, 0);
    const el = $("#conteudo");
    if (manterRolagem) el.style.minHeight = el.offsetHeight + "px";   // segura a altura enquanto redesenha
    try { await DESENHOS[tela](el); } catch (e) { console.error(e); el.innerHTML = `<div class="aviso">Não consegui abrir esta tela: ${esc(traduz(e))}</div>`; }
    if (manterRolagem) { el.style.minHeight = ""; window.scrollTo(0, y); }
  }
  const semDados = () => `<div class="card"><div class="card-topo"><h2>Comece importando seus pedidos</h2></div><p class="vazio">Ainda não tem nenhum pedido aqui. Exporte o relatório de pedidos de afiliado do TikTok Shop e suba na aba Importar.</p><button class="btn" type="button" data-tela="importar">Importar agora</button></div>`;
  /* ---------- App no celular e lembrete da manhã ---------- */
  const noCelular = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent));
  const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /macintosh/i.test(navigator.userAgent));
  const instalado = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  let pedidoInstalar = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedidoInstalar = e; });
  window.addEventListener("appinstalled", () => { pedidoInstalar = null; toast("Pronto: o painel está na tela inicial do celular."); });
  if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  const lerDia = (k) => { try { return localStorage.getItem(k) === hojeISO(); } catch (_) { return false; } };
  const marcarDia = (k) => { try { localStorage.setItem(k, hojeISO()); } catch (_) {} };
  // Lembrete da manhã por notificação (o envio fica no Supabase do curso; só guarda o endereço de notificação e a hora)
  const LEMBRETE = { url: "https://heajflidlhgmzvhpjtuy.supabase.co/functions/v1/lembrete-push", chave: "BIMzUgEF1Qtd09pPqrd2ceH0SsJqRKYJuWj1OhTRbup7WDZwBBypAy4o1CdZHTUfgp7DB-rSuAb8vo3Iz0pgZkA" };
  const pushPossivel = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && location.protocol === "https:";
  const b64u = (t) => { const p = "=".repeat((4 - t.length % 4) % 4), b = atob((t + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
  const lerLembrete = () => { try { return +localStorage.getItem("painel-lembrete-hora") || 0; } catch (_) { return 0; } };
  async function chamarLembrete(rota, corpo) {
    const r = await fetch(LEMBRETE.url + "/" + rota, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.erro || "Não consegui falar com o lembrete agora. Tente de novo em alguns minutos."); return j;
  }
  async function ativarLembrete(hora) {
    if (ehIOS() && !instalado()) throw new Error("No iPhone, primeiro instale o painel na tela inicial (Safari > Compartilhar > Adicionar à Tela de Início) e abra por lá.");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("As notificações ficaram bloqueadas. Libere em Ajustes do celular > Notificações > Meu painel e tente de novo.");
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(LEMBRETE.chave) });
    await chamarLembrete("inscrever", { sub: sub.toJSON(), hora, painel: location.origin + location.pathname });
    try { localStorage.setItem("painel-lembrete-hora", String(hora)); } catch (_) {}
    await chamarLembrete("testar", { endpoint: sub.endpoint }).catch(() => {});
  }
  async function desligarLembrete() {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await chamarLembrete("sair", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
    try { localStorage.removeItem("painel-lembrete-hora"); } catch (_) {}
  }
  function cardLembrete() {
    if (!pushPossivel()) return `<div class="lembrete-push"><p class="lbl">Lembrete de manhã</p><p class="frase" style="margin-top:0">${ehIOS() ? "No iPhone, o lembrete chega depois de instalar o painel na tela inicial (iOS 16.4 ou mais novo). Instale e abra o painel por lá para ligar." : "Este navegador não recebe notificação. Abra o painel no Chrome do celular para ligar o lembrete."}</p></div>`;
    const h = lerLembrete(), ligado = h && Notification.permission === "granted";
    const horas = [6, 7, 8, 9, 10, 11].map((x) => `<option value="${x}"${(h || 8) === x ? " selected" : ""}>${x}h</option>`).join("");
    return `<div class="lembrete-push"><p class="lbl">Lembrete de manhã</p>
      ${ligado ? `<p class="ok-msg">Ligado: todo dia às ${h}h chega "Hora de subir o extrato", mesmo com o app fechado.</p>
        <div class="controles" style="margin-top:10px"><button class="btn sec pequeno" type="button" data-acao="lembrete-testar">Mandar um teste</button><button class="link" type="button" data-acao="lembrete-desligar">Desligar</button></div>`
      : `<p class="frase" style="margin-top:0">Toda manhã chega uma notificação no celular lembrando de subir o extrato, mesmo com o app fechado.</p>
        <div class="controles"><label class="lbl" for="lembreteHora" style="margin:0">Hora</label><select class="inp" id="lembreteHora" style="width:auto">${horas}</select><button class="btn pequeno" type="button" data-acao="lembrete-ligar">Ativar lembrete</button></div>`}</div>`;
  }
  function comoInstalar() {
    if (instalado()) return `<p class="ok-msg">O painel já está instalado como app neste aparelho.</p>`;
    if (pedidoInstalar) return `<p class="frase" style="margin-top:0">Um toque e ele vira app, com ícone na tela inicial.</p><button class="btn pequeno" type="button" data-acao="instalar-app">Instalar no celular</button>`;
    if (ehIOS()) return `<ol class="passos"><li>Abra este endereço no <b>Safari</b> (no Chrome do iPhone não aparece a opção).</li><li>Toque no botão <b>Compartilhar</b> (o quadrado com a seta para cima).</li><li>Role e toque em <b>Adicionar à Tela de Início</b>, depois em <b>Adicionar</b>.</li></ol>`;
    return `<ol class="passos"><li>Abra este endereço no <b>Chrome</b> do celular.</li><li>Toque nos <b>três pontinhos</b> lá em cima.</li><li>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li></ol>`;
  }
  function cartaoInstalar() {
    if (!noCelular() || instalado() || lerDia("painel-sem-instalar")) return "";
    return `<div class="card aviso-app"><div class="card-topo"><h2>Use o painel como app</h2><span class="espaco"></span><button class="link" type="button" data-acao="fechar-instalar">Agora não</button></div>${comoInstalar()}</div>`;
  }
  function lembreteManha() {
    const h = new Date().getHours();
    if (h < 5 || h >= 12 || lerDia("painel-sem-lembrete")) return "";
    const hoje = hojeISO(), subiuHoje = (S.importacoes || []).some((i) => { const d = new Date(i.importado_em); return !isNaN(d) && `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === hoje; });
    if (subiuHoje) return "";   // de manhã, até subir o extrato do dia
    return `<div class="aviso lembrete-manha"><span><b>Bom dia! Hora de subir o extrato.</b> Baixe o relatório de pedidos no app do TikTok e suba aqui: o Hoje e as sugestões do dia ficam certinhos.</span><span class="controles"><button class="btn pequeno" type="button" data-tela="importar">Subir agora</button><button class="link" type="button" data-acao="fechar-lembrete">Agora não</button></span></div>`;
  }
  // Voltou pro app (ex.: abriu de manhã): redesenha o Hoje para o lembrete aparecer
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.tela === "hoje" && S.user && !$("#app").hidden) irPara("hoje", true); });
  function avisoImport() {
    if (!S.ultimo) return "";
    const dias = Math.round((new Date(hojeISO()) - new Date(S.ultimo)) / 864e5);
    return dias >= 3 ? `<div class="aviso"><span>Seus pedidos vão até ${dataBR(S.ultimo)}. Importe o relatório novo pra ler os últimos ${dias} dias.</span><button class="btn pequeno" type="button" data-tela="importar">Importar</button></div>` : "";
  }

  /* ---------- HOJE ---------- */
  /* ---------- GRÁFICOS: um motor só; o modelo escolhe o tipo e as cores vêm da paleta ---------- */
  const modelo = () => (document.documentElement.dataset.estilo || "minimal");
  const TIPO_GRAF = { minimal: "linha", editorial: "area", glass: "barras", neon: "neon" };
  // pts = [{ rot: "1", v: 123, dica: "1/11 · R$ 123,00" }]
  function grafSerie(pts, tipo, rotulo) {
    if (!pts.length || !pts.some((p) => p.v > 0)) return '<p class="vazio">Ainda sem vendas neste período.</p>';
    const W = 640, H = 230, m = { e: 58, d: 12, t: 14, b: 26 };
    const max = Math.max(...pts.map((p) => p.v), 1), passo = niceStep(max), topo = Math.ceil(max / passo) * passo;
    const Y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo), larg = (W - m.e - m.d) / pts.length, X = (i) => m.e + (i + .5) * larg;
    const uid = (grafSerie.n = (grafSerie.n || 0) + 1);
    let s = `<svg class="graf serie serie-${tipo}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rotulo)}"><defs><linearGradient id="gArea${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--graf-linha)" stop-opacity=".35"/><stop offset="1" stop-color="var(--graf-linha)" stop-opacity="0"/></linearGradient><linearGradient id="gBarra${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--g1)"/><stop offset="1" stop-color="var(--g2)"/></linearGradient></defs>`;
    for (let v = 0; v <= topo + .1; v += passo) s += `<line class="grade-l" x1="${m.e}" x2="${W - m.d}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="eixo" x="${m.e - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${realCurto(v)}</text>`;
    const cada = Math.max(1, Math.ceil(pts.length / 7));
    pts.forEach((p, i) => { if (i % cada === 0 || i === pts.length - 1) s += `<text class="eixo" x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(p.rot)}</text>`; });
    if (tipo === "barras") {
      pts.forEach((p, i) => { const w = Math.max(3, larg * .62); s += `<rect class="b-serie" fill="url(#gBarra${uid})" x="${(X(i) - w / 2).toFixed(1)}" width="${w.toFixed(1)}" y="${Y(p.v).toFixed(1)}" height="${Math.max(0, Y(0) - Y(p.v)).toFixed(1)}" rx="${Math.min(6, w / 2).toFixed(1)}"/>`; });
    } else {
      // linha suave (curva) entre os pontos
      const P = pts.map((p, i) => [X(i), Y(p.v)]);
      let d = `M${P[0][0].toFixed(1)},${P[0][1].toFixed(1)}`;
      for (let i = 1; i < P.length; i++) { const [x0, y0] = P[i - 1], [x1, y1] = P[i], cx = (x0 + x1) / 2; d += ` C${cx.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`; }
      const area = `${d} L${P[P.length - 1][0].toFixed(1)},${Y(0).toFixed(1)} L${P[0][0].toFixed(1)},${Y(0).toFixed(1)} Z`;
      s += `<path class="a-serie" d="${area}" fill="url(#gArea${uid})"/><path class="l-serie" d="${d}"/>`;
      const iMax = pts.reduce((b, p, i) => (p.v > pts[b].v ? i : b), 0);
      s += `<circle class="p-serie" cx="${P[iMax][0].toFixed(1)}" cy="${P[iMax][1].toFixed(1)}" r="5"/>`;
    }
    // zonas invisíveis para a dica com o valor (mouse e toque)
    pts.forEach((p, i) => { s += `<rect class="zona-dica" x="${(X(i) - larg / 2).toFixed(1)}" y="${m.t}" width="${larg.toFixed(1)}" height="${(H - m.t - m.b).toFixed(1)}" data-dica="${esc(p.dica)}" data-x="${X(i).toFixed(1)}" data-y="${Y(p.v).toFixed(1)}"/>`; });
    return s + "</svg>";
  }
  // Rosca (com total no centro) ou pizza, com legenda, valores, % e dica
  function graficoCirculo(itens, pizza, rotulo) {
    const tot = itens.reduce((a, [, v]) => a + v, 0);
    if (!tot) return '<p class="vazio">Sem vendas válidas no período.</p>';
    let l = [...itens].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    if (l.length > 6) { const resto = l.slice(5).reduce((a, [, v]) => a + v, 0); l = [...l.slice(0, 5), ["Outros", resto]]; }
    const R = pizza ? 42 : 66, esp = pizza ? 84 : 24, C = 2 * Math.PI * R; let acc = 0;
    const pct2 = (f) => (f * 100).toFixed(1).replace(".", ",") + "%";
    const arcos = l.map(([n, v], i) => { const f = v / tot, el = `<circle class="fatia" r="${R}" cx="90" cy="90" fill="none" style="stroke:${CORES_ROSCA[i]}" stroke-width="${esp}" stroke-dasharray="${(f * C).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-acc * C).toFixed(2)}" transform="rotate(-90 90 90)" data-dica="${esc(n)} · ${real(v)} · ${pct2(f)}"/>`; acc += f; return el; }).join("");
    const centro = pizza ? "" : `<text class="centro-v" x="90" y="88" text-anchor="middle">${realCurto(tot)}</text><text class="centro-r" x="90" y="106" text-anchor="middle">no total</text>`;
    return `<div class="rosca${pizza ? " pizza" : ""}"><svg viewBox="0 0 180 180" role="img" aria-label="${esc(rotulo)}">${arcos}${centro}</svg>
      <ul class="rosca-leg">${l.map(([n, v], i) => `<li><i style="background:${CORES_ROSCA[i]}"></i><span class="n">${esc(n)}</span><b>${pct2(v / tot)}</b><small>${real(v)}</small></li>`).join("")}</ul></div>`;
  }
  // Dica dos gráficos: um balão só, que segue o mouse (ou o toque)
  const dicaGraf = document.createElement("div"); dicaGraf.className = "dica-graf"; dicaGraf.hidden = true; dicaGraf.setAttribute("role", "status"); document.body.appendChild(dicaGraf);
  function mostrarDicaGraf(alvo, ev) {
    dicaGraf.textContent = alvo.dataset.dica; dicaGraf.hidden = false;
    const r = dicaGraf.getBoundingClientRect(), x = Math.min(window.innerWidth - r.width - 8, Math.max(8, ev.clientX - r.width / 2)), y = ev.clientY - r.height - 14;
    dicaGraf.style.left = x + "px"; dicaGraf.style.top = (y < 8 ? ev.clientY + 18 : y) + "px";
    document.querySelectorAll(".zona-ativa").forEach((z) => z.classList.remove("zona-ativa")); alvo.classList.add("zona-ativa");
  }
  document.addEventListener("pointermove", (e) => { const a = e.target.closest && e.target.closest("[data-dica]"); if (a && a.closest("svg.graf, .rosca svg")) mostrarDicaGraf(a, e); else if (!dicaGraf.hidden) { dicaGraf.hidden = true; document.querySelectorAll(".zona-ativa").forEach((z) => z.classList.remove("zona-ativa")); } });
  document.addEventListener("scroll", () => { dicaGraf.hidden = true; }, true);

  /* ---------- HOJE: mesmos dados, composição própria em cada modelo ---------- */
  async function telaHoje(el) {
    const hoje = hojeISO(), d = new Date(), nome = (S.perfil.apelido || "").trim() || (S.perfil.nome || "").split(" ")[0];
    const saud = d.getHours() < 12 ? "Bom dia" : d.getHours() < 18 ? "Boa tarde" : "Boa noite";
    const cab = `<div class="cabeca"><div><h1>${saud}${nome ? ", <em>" + esc(nome) + "</em>" : ""}.</h1><p>${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}. ${S.ultimo ? `Pedidos lidos até ${dataBR(S.ultimo)}.` : ""}${temContas() ? ` <span class="selo novo">${verTodos() ? "Todos os perfis" : esc(nomeConta(S.conta))}</span>` : ""}</p></div></div>`;
    if (!S.pedidos.length) { telaComecando(el, cab); return; }
    const ref = S.ultimo, antes = somaDias(ref, -1);
    const tRef = somar(entre(ref, ref)), tAntes = somar(entre(antes, antes));
    const per = periodo(ref.slice(0, 7)), tMes = somar(entre(per.ini, per.fim)), tAnt = somar(entre(per.iniAnt, per.fimAnt));
    const an = analiseProdutos(), f = foco(an), plano = planoDoDia(an, f);
    const vids = S.videosHoje, feitos = vids.filter((v) => v.status !== "rascunho").length;
    const rotRef = ref === hoje ? "Hoje até agora" : ref === somaDias(hoje, -1) ? "Ontem" : "Último dia: " + dataBR(ref);
    const mod = modelo(), mesNome = MESES[+per.mes.slice(5, 7) - 1];
    const ic = (k) => `<span class="kpi-ic">${svgIc(k)}</span>`;
    const kVid = `${ic("video")}<p class="rot">Vídeos de hoje</p><div class="val">${feitos} de ${plano.N}</div><div class="barra"><i style="width:${Math.min(100, feitos / plano.N * 100).toFixed(1)}%"></i></div><small>${vids.length ? `${plural(vids.length, "planejado", "planejados")}, ${plural(feitos, "agendado ou postado", "agendados ou postados")}` : "Nenhum vídeo planejado ainda."}</small>`;
    const KPIS = `<div class="grade g4 kpis">
        <div class="card kpi escuro">${ic("vendas")}<p class="rot">${rotRef}</p><div class="val">${real(tRef.g)}</div>${selo(tRef.g, tAntes.g)}<small>${plural(tRef.pedidos, "pedido", "pedidos")} · comissão ${real(tRef.c)}</small></div>
        <div class="card kpi">${ic("mes")}<p class="rot">Vendas no mês</p><div class="val">${real(tMes.g)}</div>${selo(tMes.g, tAnt.g)}<small>até o dia ${per.N}, contra o mesmo pedaço de ${MESES[+per.ant.slice(5, 7) - 1]}</small></div>
        <div class="card kpi">${ic("comissao")}<p class="rot">Comissão no mês</p><div class="val">${real(tMes.c)}</div>${selo(tMes.c, tAnt.c)}<small>${pct(tMes.g ? tMes.c / tMes.g * 100 : 0)} das vendas · ${real(tMes.liq)} já liquidada</small></div>
        <div class="card kpi">${kVid}</div>
      </div>`;
    // dados dos gráficos: só pedidos válidos do mês
    const doMes = entre(per.ini, per.fim).filter(valido);
    const porDia = []; for (let k = 1; k <= per.N; k++) { const dia = `${per.mes}-${pad(k)}`, v = doMes.filter((p) => p.dia === dia).reduce((a, p) => a + p.g, 0); porDia.push({ rot: String(k), v, dica: `${dataBR(dia)} · ${real(v)}` }); }
    const cats = {}; doMes.forEach((p) => { const c = CATS[p.categoria] || "Outros"; cats[c] = (cats[c] || 0) + p.g; });
    const canais = {}; doMes.forEach((p) => { const c = (p.tipo_conteudo || "").trim() || "Outro"; canais[c] = (canais[c] || 0) + p.g; });
    const GRAF = `<div class="card graf-card"><div class="card-topo"><h2>Vendas por dia</h2><span class="sub">${mesNome}, só pedidos válidos</span></div>${grafSerie(porDia, TIPO_GRAF[mod] || "linha", "Vendas por dia")}</div>`;
    const CAT = `<div class="card"><div class="card-topo"><h2>Vendas por categoria</h2><span class="sub">${mesNome}</span></div>${graficoCirculo(Object.entries(cats), false, "Vendas por categoria")}</div>`;
    const CANAL = `<div class="card"><div class="card-topo"><h2>Vendas por canal</h2><span class="sub">${mesNome}</span></div>${graficoCirculo(Object.entries(canais), true, "Vendas por canal")}</div>`;
    const META = cardMeta(per, tMes);
    const item = (x, extra) => `<li><span class="nome" title="${esc(x.nome)}">${esc(x.nome)}</span><span class="val">${real(x.c30)}</span><small>${extra}${x.produto_id ? ` · <button class="link esg" type="button" data-acao="esgotado" data-id="${esc(x.produto_id)}">esgotou?</button>` : ""}</small></li>`;
    const esgotados = an.lista.filter((x) => x.esgotado);
    const icFoco = (k) => `<span class="foco-ic foco-${k}">${svgIc(k)}</span>`;
    const FOCO = `${mod === "editorial" ? '<div class="secao-titulo"><h2>Desempenho de produtos</h2><button class="link" type="button" data-tela="produtos">Ver todos</button></div>' : ""}<div class="grade g3 foco">
        <div class="card"><div class="card-topo">${icFoco("coroa")}<h2>Principais</h2><span class="sub">o que mais te paga</span></div>
          <ul class="lista-foco">${f.principais.map((x) => item(x, `${x.dias.size} dias com venda em 30 · ${pct(x.share)} da comissão`)).join("") || '<p class="vazio">Ainda sem vendas nos últimos 30 dias.</p>'}</ul>
          <p class="frase">Mantenha 2 vídeos por dia de cada um. São eles que seguram o mês.</p></div>
        <div class="card"><div class="card-topo">${icFoco("alerta")}<h2>Dê atenção</h2><span class="sub">começando a vender</span></div>
          <ul class="lista-foco">${f.apostas.map((x) => item(x, `<span class="selo ${x.tend === "Novo" ? "novo" : "sobe"}">${x.tend}</span> ${real(x.a)} nos últimos ${S.janela} dias${x.b ? ` contra ${real(x.b)} antes` : ""}`)).join("") || '<p class="vazio">Nenhum produto acelerando agora. Hora de testar produto novo.</p>'}</ul>
          <p class="frase">Produto novo ou que vendeu 1,5 vez mais que nos ${S.janela} dias anteriores, em pelo menos 3 dias diferentes. Grave mais desses.</p></div>
        <div class="card"><div class="card-topo">${icFoco("chama")}<h2>Esfriando</h2><span class="sub">perdeu força</span></div>
          <ul class="lista-foco">${f.esfriando.map((x) => item(x, `<span class="selo desce">▼ ${pct(Math.abs(x.var))}</span> ${real(x.a)} nos últimos ${S.janela} dias contra ${real(x.b)} antes`)).join("") || '<p class="vazio">Nenhum produto caindo forte. Bom sinal.</p>'}</ul>
          <p class="frase">Vendeu metade ou menos que antes. Teste gancho novo ou troque por um da coluna do meio. Se for falta de estoque, toque em "esgotou?".</p>
          ${esgotados.length ? `<div class="esgotados"><p class="lbl">Esgotados · fora das sugestões</p>${esgotados.map((x) => `<span class="chip">${esc(x.nome)} <button class="link" type="button" data-acao="desfazer-esgotado" data-id="${esc(x.produto_id)}" aria-label="Voltar ${esc(x.nome)} para as sugestões">voltar</button></span>`).join("")}<p class="frase" style="margin-top:6px">Voltam sozinhos quando venderem de novo.</p></div>` : ""}</div>
      </div>`;
    const PLANO = `<div class="grade g21">
        <div class="card"><div class="card-topo"><h2>Plano dos ${plano.N} vídeos de hoje</h2><span class="espaco"></span><button class="btn pequeno" type="button" data-acao="lancar-plano"${vids.length >= plano.N ? " disabled" : ""}>${vids.length ? "Completar o dia" : "Lançar no dia"}</button></div>
          ${blocoPlano("Principais", plano.prin, plano.nP)}${blocoPlano("Com vendas", plano.com, plano.nC)}${blocoPlano("Testes", plano.testes, plano.nT)}
          <p class="frase">40% nos principais, 40% em produtos que já venderam (os que estão acelerando primeiro) e 20% em testes. Mude a meta de vídeos em Meu perfil.</p></div>
        <div class="card"><div class="card-topo"><h2>Na agenda de hoje</h2><span class="espaco"></span><button class="link" type="button" data-tela="videos">Abrir Vídeos</button></div>
          ${vids.length ? `<ul class="dia-videos">${vids.map(linhaVideo).join("")}</ul>` : '<p class="vazio">Use "Lançar no dia" para criar a lista com horários.</p>'}</div>
      </div>`;
    // cada modelo organiza as mesmas peças do seu jeito
    const COMPOSICAO = {
      minimal: [KPIS, `<div class="grade g21">${GRAF}${CAT}</div>`, FOCO, `<div class="grade g2">${META}${CANAL}</div>`, PLANO],
      editorial: [KPIS, `<div class="grade g21 meta-destaque">${META}${CANAL}</div>`, FOCO, `<div class="grade g21">${GRAF}${CAT}</div>`, PLANO],
      glass: [KPIS, `<div class="grade g21">${GRAF}${CAT}</div>`, FOCO, `<div class="grade g2">${META}${CANAL}</div>`, PLANO],
      neon: [KPIS, `<div class="grade g21">${GRAF}${CAT}</div>`, `<div class="grade g12 meta-neon">${META}${CANAL}</div>`, FOCO, PLANO]
    };
    el.innerHTML = `<div class="hoje hoje-${mod}">` + cab + (lembreteManha() || avisoImport()) + cartaoInstalar() + (COMPOSICAO[mod] || COMPOSICAO.minimal).join("") + "</div>";
  }
  function blocoPlano(titulo, l, n) {
    if (!n) return "";
    const falta = n - l.length;
    return `<div class="plano-bloco"><h3>${titulo} · ${n}</h3><ul class="lista-foco">${l.map((x) => `<li><span class="nome">${esc(x.produto)}</span><span>${x.tag ? `<span class="selo ${x.tag === "Novo" ? "novo" : x.tag === "Acelerando" ? "sobe" : "alerta"}">${esc(x.tag)}</span>` : ""}</span></li>`).join("")}</ul>${falta > 0 ? `<p class="vazio">Faltam ${falta}: ${titulo === "Testes" ? "cadastre amostras em Amostras" : "importe mais pedidos ou escolha produtos novos"}.</p>` : ""}</div>`;
  }
  // Sugestão do dia: os N vídeos (meta de Meu perfil) divididos 40% principais, 40% com vendas, 20% testes
  function sugestaoDia() {
    if (S.pedidos.length) { const an = analiseProdutos(), pl = planoDoDia(an, foco(an)); return { N: pl.N, lista: [...pl.prin, ...pl.com, ...pl.testes], nP: pl.nP, nC: pl.nC, nT: pl.nT, comecando: false }; }
    const pc = planoComecando(); return { N: pc.N, lista: pc.lista, nP: 0, nC: 0, nT: pc.N, comecando: true };
  }
  // Intercala os blocos (não deixa os principais todos seguidos)
  function intercalar(l) {
    const g = { principal: [], com_vendas: [], teste: [] }; l.forEach((x) => (g[x.bloco] || g.teste).push(x));
    const out = []; while (out.length < l.length) ["principal", "com_vendas", "principal", "com_vendas", "teste"].forEach((b) => { if (g[b].length) out.push(g[b].shift()); });
    return out;
  }
  async function lancarPlano(dia = hojeISO(), so = null) {
    const sug = sugestaoDia(), todos = so || intercalar(sug.lista);
    const ja = dia === hojeISO() ? S.videosHoje : await API.videos(dia, dia);
    const faltam = so ? todos : todos.slice(0, Math.max(0, sug.N - ja.length));
    if (!faltam.length) { toast(sug.lista.length ? "O dia já está completo." : "Cadastre produtos para testar em Amostras para ter sugestão."); return; }
    const horas = horariosLivres(ja.map((v) => v.hora && v.hora.slice(0, 5)), faltam.length, dia);
    const novos = await API.novosVideos(faltam.map((x, k) => ({ data: dia, hora: horas[k], produto: x.produto.slice(0, 300), bloco: x.bloco, status: "rascunho" })));
    if (dia === hojeISO()) S.videosHoje = await API.videos(dia, dia);
    toast(`${plural(novos.length, "vídeo lançado", "vídeos lançados")} na agenda de ${dia === hojeISO() ? "hoje" : dataBR(dia)}.`);
    irPara(S.tela);
  }

  /* ---------- RESULTADOS ---------- */
  async function telaResultados(el) {
    const cab = (extra = "") => `<div class="cabeca"><div><h1>Resultados</h1><p>Todo número compara com o mesmo pedaço do mês anterior.</p></div>${extra}</div>`;
    if (!S.pedidos.length) { el.innerHTML = cab() + semDados(); return; }
    if (S.mes === "tudo") { telaTudo(el); return; }
    const per = periodo(S.mes), l = entre(per.ini, per.fim), t = somar(l), a = somar(entre(per.iniAnt, per.fimAnt));
    const primeiro = S.pedidos[0].mes, ultimo = S.ultimo.slice(0, 7);
    const seletor = `<div class="seletor-mes"><button type="button" data-acao="mes" data-n="-1" aria-label="Mês anterior"${S.mes <= primeiro ? " disabled" : ""}>‹</button><span>${nomeMes(S.mes)}</span><button type="button" data-acao="mes" data-n="1" aria-label="Próximo mês"${S.mes >= ultimo ? " disabled" : ""}>›</button></div><button type="button" class="btn sec pequeno" data-acao="periodo" data-v="tudo">Todo o período</button>`;
    const cats = {}; l.filter(valido).forEach((p) => { cats[p.categoria] = (cats[p.categoria] || 0) + p.c; });
    const catL = Object.entries(cats).sort((x, y) => y[1] - x[1]), totC = t.c || 1;
    const totStatus = t.g + t.gIne + t.gAgu || 1;
    el.innerHTML = cab(seletor) + `
      <div class="grade g4">
        <div class="card kpi escuro"><p class="rot">Vendas (GMV)</p><div class="val">${real(t.g)}</div>${selo(t.g, a.g)}<small>${per.atual ? `dia 1 a ${per.N}` : "mês fechado"}</small></div>
        <div class="card kpi"><p class="rot">Comissão estimada</p><div class="val">${real(t.c)}</div>${selo(t.c, a.c)}<small>${pct(t.g ? t.c / t.g * 100 : 0)} das vendas</small></div>
        <div class="card kpi"><p class="rot">Comissão liquidada</p><div class="val">${real(t.liq)}</div><small>já confirmada · ${real(t.pend)} ainda pendente</small></div>
        <div class="card kpi"><p class="rot">Pedidos</p><div class="val">${num(t.pedidos)}</div>${selo(t.pedidos, a.pedidos)}<small>${num(t.i)} itens · ticket médio ${real(t.ticket)}</small></div>
      </div>
      <div class="card"><div class="card-topo"><h2>Vendas por dia</h2><span class="sub">${nomeMes(S.mes)}</span></div>${grafMes(per)}
        <div class="legenda"><span><i style="background:var(--cafe)"></i>${MESES[+S.mes.slice(5, 7) - 1]}</span><span><i class="tr"></i>${MESES[+per.ant.slice(5, 7) - 1]}</span></div>
        <p class="frase">Cada barra é um dia de vendas válidas (liquidadas e pendentes). A linha tracejada é o mesmo dia no mês anterior.</p></div>
      <div class="grade g2">
        <div class="card"><div class="card-topo"><h2>Comissão por categoria</h2></div>
          ${catL.map(([k, v]) => `<div class="cat-linha"><span>${esc(CATS[k] || k)}</span><span class="b"><i style="width:${(v / totC * 100).toFixed(1)}%"></i></span><span class="p">${pct(v / totC * 100)}</span><span class="v">${real(v)}</span></div>`).join("") || '<p class="vazio">Sem vendas neste período.</p>'}
          <p class="frase">A categoria vem do nome do produto. Corrija na aba Produtos se alguma estiver errada.</p></div>
        <div class="card"><div class="card-topo"><h2>Para onde foram os pedidos</h2></div>
          ${[["Válidos (contam)", t.g], ["Inelegíveis (cancelados ou devolvidos)", t.gIne], ["Aguardando pagamento", t.gAgu]].map(([n, v]) => `<div class="cat-linha"><span>${n}</span><span class="b"><i style="width:${(v / totStatus * 100).toFixed(1)}%"></i></span><span class="p">${pct(v / totStatus * 100)}</span><span class="v">${real(v)}</span></div>`).join("")}
          <p class="frase">Se os inelegíveis passarem de 15%, confira se algum produto está voltando muito. A coluna "% inelegível" em Produtos mostra qual.</p></div>
      </div>`;
  }

  /* ---------- TODO O PERÍODO ---------- */
  const CORES_ROSCA = ["var(--g1)", "var(--g2)", "var(--g3)", "var(--g4)", "var(--g5)", "var(--g6)"];
  function rosca(itens) { return graficoCirculo(itens, false, "Divisão das vendas"); }
  function grafMeses(meses) {
    const W = 720, H = 220, m = { e: 54, d: 8, t: 10, b: 24 };
    const max = Math.max(...meses.map((x) => x.g), 1), passo = niceStep(max), topo = Math.ceil(max / passo) * passo;
    const Y = (v) => m.t + (H - m.t - m.b) * (1 - v / topo), bw = (W - m.e - m.d) / meses.length, X = (i) => m.e + (i + .5) * bw;
    const hoje = (S.ultimo || hojeISO()).slice(0, 7), cada = Math.ceil(meses.length / 12);
    let s = `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas por mês">`;
    for (let v = 0; v <= topo + .1; v += passo) s += `<line class="grade-l" x1="${m.e}" x2="${W - m.d}" y1="${Y(v)}" y2="${Y(v)}"/><text class="eixo" x="${m.e - 8}" y="${Y(v) + 4}" text-anchor="end">${realCurto(v)}</text>`;
    meses.forEach((x, i) => {
      const w = Math.min(bw * .7, 48);
      s += `<rect class="${x.mes === hoje ? "b-hoje" : "b-atual"}" x="${(X(i) - w / 2).toFixed(1)}" width="${w.toFixed(1)}" y="${Y(x.g).toFixed(1)}" height="${(Y(0) - Y(x.g)).toFixed(1)}" rx="3" data-dica="${nomeMes(x.mes)} · ${real(x.g)} em vendas · ${real(x.c)} de comissão"><title>${nomeMes(x.mes)}: ${real(x.g)} em vendas, ${real(x.c)} de comissão</title></rect>`;
      if (i % cada === 0 || i === meses.length - 1) s += `<text class="eixo" x="${X(i)}" y="${H - 6}" text-anchor="middle">${MESES[+x.mes.slice(5, 7) - 1].slice(0, 3)}/${x.mes.slice(2, 4)}</text>`;
    });
    return s + "</svg>";
  }
  function telaTudo(el) {
    const val = S.pedidos.filter(valido), t = somar(S.pedidos), ini = S.pedidos[0].dia, fim = S.ultimo || S.pedidos[S.pedidos.length - 1].dia;
    const meses = []; for (let mm = ini.slice(0, 7); mm <= fim.slice(0, 7); mm = mesDesloca(mm, 1)) meses.push({ mes: mm, ...somar(S.pedidos.filter((p) => p.mes === mm)) });
    const fechados = meses.filter((x) => x.mes !== (S.ultimo || hojeISO()).slice(0, 7)), media = fechados.length ? fechados.reduce((a, x) => a + x.g, 0) / fechados.length : t.g;
    const melhor = [...meses].sort((a, b) => b.g - a.g)[0];
    const canais = {}, cats = {};
    val.forEach((p) => { const k = (p.tipo_conteudo || "").trim() || "Outro"; canais[k] = (canais[k] || 0) + p.g; const c = CATS[p.categoria] || p.categoria || "Outros"; cats[c] = (cats[c] || 0) + p.g; });
    const ano = (d) => `${dataBR(d)}/${d.slice(2, 4)}`;
    el.innerHTML = `<div class="cabeca"><div><h1>Resultados</h1><p>Todo o período que você importou: de ${ano(ini)} a ${ano(fim)} (${meses.length} ${meses.length === 1 ? "mês" : "meses"}).</p></div>
      <div class="periodo-topo"><span class="seletor-mes"><span>Todo o período</span></span><button type="button" class="btn sec pequeno" data-acao="periodo" data-v="mes">Ver por mês</button></div></div>
      <div class="grade g4 tudo">
        <div class="card kpi escuro"><p class="rot">Vendas (GMV)</p><div class="val">${real(t.g)}</div><small>média de ${realCurto(media)} por mês</small></div>
        <div class="card kpi"><p class="rot">Comissão estimada</p><div class="val">${real(t.c)}</div><small>${pct(t.g ? t.c / t.g * 100 : 0)} das vendas</small></div>
        <div class="card kpi"><p class="rot">Comissão liquidada</p><div class="val">${real(t.liq)}</div><small>já confirmada · ${real(t.pend)} ainda pendente</small></div>
        <div class="card kpi"><p class="rot">Ticket médio</p><div class="val">${real(t.ticket)}</div><small>${num(t.pedidos)} pedidos · ${num(t.i)} itens</small></div>
      </div>
      <div class="card"><div class="card-topo"><h2>Vendas por mês</h2><span class="sub">melhor mês: ${nomeMes(melhor.mes)}</span></div>${grafMeses(meses)}
        <p class="frase">Cada barra é um mês de vendas válidas (liquidadas e pendentes). A barra clara é o mês que ainda está correndo.</p></div>
      <div class="grade g2">
        <div class="card"><div class="card-topo"><h2>Vendas por canal</h2></div>${graficoCirculo(Object.entries(canais), true, "Vendas por canal")}
          <p class="frase">De onde vêm as suas vendas: vídeo, LIVE ou vitrine (cartão de produto).</p></div>
        <div class="card"><div class="card-topo"><h2>Vendas por categoria</h2></div>${rosca(Object.entries(cats))}
          <p class="frase">O perfil do que você vende. Corrija a categoria na aba Produtos se alguma estiver errada.</p></div>
      </div>
      <div class="card"><div class="card-topo"><h2>Mês a mês</h2></div><div class="tabela-caixa"><table><thead><tr><th>Mês</th><th class="num">Vendas</th><th class="num">Comissão</th><th class="num">Pedidos</th><th class="num">Ticket médio</th></tr></thead><tbody>
        ${[...meses].reverse().map((x) => `<tr><td>${nomeMes(x.mes)}</td><td class="num"><b>${real(x.g)}</b></td><td class="num">${real(x.c)}</td><td class="num">${num(x.pedidos)}</td><td class="num">${real(x.ticket)}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="frase">Quer ver mais para trás? O TikTok exporta até 90 dias por arquivo. Exporte os períodos anteriores, de 90 em 90 dias, e importe todos: pedido repetido não duplica.</p></div>`;
  }

  /* ---------- PRODUTOS ---------- */
  function seletorCat(x) {
    const atual = x.categoria + "|" + (x.subcategoria || "");
    return `<select class="inp sel-cat" data-acao="mudar-cat" data-id="${esc(x.produto_id)}" aria-label="Categoria de ${esc(x.nome)}">${Object.entries(CATS_SUB).map(([k, [n, subs]]) => `<optgroup label="${esc(n)}"><option value="${k}|"${atual === k + "|" ? " selected" : ""}>${esc(n)}${subs.length ? " (geral)" : ""}</option>${subs.map((sb) => `<option value="${k}|${esc(sb)}"${atual === k + "|" + sb ? " selected" : ""}>${esc(sb)}</option>`).join("")}</optgroup>`).join("")}</select>`;
  }
  /* ---------- PEDIDOS: liquidado, pendente, aguardando e inelegível ---------- */
  const ST_PED = { liq: ["Liquidado", "sobe", "Comissão já liberada pelo TikTok."], pen: ["Pendente", "novo", "Pedido válido. A comissão é liberada depois do prazo de devolução."],
    agu: ["Aguardando pagamento", "alerta", "O cliente ainda não terminou de pagar. Se não pagar, o pedido cai."], ine: ["Inelegível", "desce", "Não gera comissão (por exemplo: cancelado, devolvido ou fora das regras de afiliado da loja). O motivo de cada um aparece na Central de afiliados."],
    out: ["Outros", "", "Status que o painel não reconhece."] };
  function telaPedidos(el) {
    const cab = `<div class="cabeca"><div><h1>Pedidos</h1><p>O que já foi pago, o que ainda vai cair e o que não gera comissão${S.ultimo ? `. Pedidos lidos até ${dataBR(S.ultimo)}` : ""}.</p></div></div>`;
    if (!S.pedidos.length) { el.innerHTML = cab + semDados(); return; }
    const fim = S.ultimo, per = S.pedPer || "30";
    const ini = per === "30" ? somaDias(fim, -29) : per === "90" ? somaDias(fim, -89) : per === "mes" ? fim.slice(0, 8) + "01" : "0000-00-00";
    const lista = S.pedidos.filter((p) => p.dia >= ini && p.dia <= fim);
    const G = {}; Object.keys(ST_PED).forEach((k) => { G[k] = { ped: new Set(), itens: 0, g: 0, c: 0 }; });
    lista.forEach((p) => { const x = G[p.cat] || G.out; x.ped.add(p.pedido_id); x.itens += +p.itens || 0; x.g += p.g; x.c += p.cat === "liq" ? (+p.comissao_real || p.c) : p.c; });
    const totPed = new Set(lista.map((p) => p.pedido_id)).size;
    const kpi = (k, rotulo, val, sub) => `<div class="card kpi"><p class="rot">${rotulo}</p><div class="val">${val}</div><span class="selo ${ST_PED[k][1]}">${plural(G[k].ped.size, "pedido", "pedidos")}</span><small>${sub}</small></div>`;
    // lojas e produtos com muito inelegível (mínimo de 5 pedidos para não alarmar à toa)
    const agrupa = (chave) => { const m = new Map(); lista.forEach((p) => { const k = (chave(p) || "").trim(); if (!k) return; const x = m.get(k) || { nome: k, ped: new Set(), ine: new Set(), gIne: 0, cIne: 0 }; x.ped.add(p.pedido_id); if (p.cat === "ine") { x.ine.add(p.pedido_id); x.gIne += p.g; x.cIne += p.c; } m.set(k, x); }); return [...m.values()].map((x) => ({ ...x, n: x.ped.size, ni: x.ine.size, pi: x.ped.size ? x.ine.size / x.ped.size * 100 : 0 })); };
    const temLoja = lista.some((p) => (p.loja || "").trim());
    const lojas = agrupa((p) => p.loja), alertas = lojas.filter((x) => x.n >= 5 && x.pi >= 20).sort((a, b) => b.pi - a.pi);
    const prods = agrupa((p) => p.nome).filter((x) => x.n >= 5 && x.pi >= 20).sort((a, b) => b.pi - a.pi).slice(0, 5);
    const piGeral = totPed ? G.ine.ped.size / totPed * 100 : 0;
    const filtro = S.pedFiltro || "todos", busca = (S.pedBusca || "").toLowerCase();
    let linhas = lista.filter((p) => (filtro === "todos" || p.cat === filtro) && (!busca || (p.nome + " " + (p.loja || "") + " " + p.pedido_id).toLowerCase().includes(busca)));
    const totalLinhas = linhas.length; linhas = linhas.slice().sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 200);
    const linhaAlerta = (x, tipo) => `<li><span class="nome">${esc(x.nome)}</span><span class="val"><span class="selo desce">${pct(x.pi)} inelegível</span></span><small>${x.ni} de ${plural(x.n, "pedido", "pedidos")} no período · ${real(x.cIne)} de comissão que não veio${tipo === "loja" ? "" : ""}</small></li>`;
    el.innerHTML = cab + `
      <div class="controles">${[["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["mes", "Este mês"], ["tudo", "Todo o período"]].map(([k, n]) => `<button class="chip" type="button" data-acao="ped-per" data-v="${k}" aria-pressed="${per === k}">${n}</button>`).join("")}</div>
      <div class="grade g4">
        ${kpi("liq", "Liquidado", real(G.liq.c), "comissão já paga")}
        ${kpi("pen", "Pendente", real(G.pen.c), "comissão que ainda vai cair")}
        ${kpi("agu", "Aguardando pagamento", real(G.agu.g), "em vendas, cliente ainda não pagou")}
        ${kpi("ine", "Inelegível", real(G.ine.c), `comissão que não vem · ${pct(piGeral)} dos pedidos`)}
      </div>
      <div class="grade g2 alto">
        <div class="card"><div class="card-topo"><h2>Divisão dos pedidos</h2><span class="sub">em vendas (GMV)</span></div>${rosca(Object.keys(ST_PED).filter((k) => G[k].g > 0).map((k) => [ST_PED[k][0], G[k].g]))}</div>
        <div class="card"><div class="card-topo"><h2>Fique de olho</h2><span class="sub">lojas e produtos com 20% ou mais de inelegível</span></div>
          ${!temLoja ? '<p class="vazio">Os pedidos importados ainda não trazem o nome da loja. Importe o extrato de novo para ver as lojas aqui.</p>' : alertas.length ? `<p class="lbl">Lojas</p><ul class="lista-foco">${alertas.slice(0, 5).map((x) => linhaAlerta(x, "loja")).join("")}</ul>` : '<p class="vazio">Nenhuma loja com muito pedido inelegível no período. Bom sinal.</p>'}
          ${prods.length ? `<p class="lbl" style="margin-top:14px">Produtos</p><ul class="lista-foco">${prods.map((x) => linhaAlerta(x, "prod")).join("")}</ul>` : ""}
          <p class="frase">Muito inelegível numa loja costuma ser cancelamento, devolução ou regra de afiliado da loja. Abra a Central de afiliados para ver o motivo de cada pedido e, se continuar, pense em trocar de loja ou de produto.</p></div>
      </div>
      <div class="card"><div class="card-topo"><h2>Todos os pedidos</h2><span class="sub">${plural(totalLinhas, "linha", "linhas")}${totalLinhas > 200 ? ", mostrando as 200 mais recentes" : ""}</span><span class="espaco"></span><input class="inp busca" id="buscaPed" type="search" placeholder="Buscar produto, loja ou nº do pedido" value="${esc(S.pedBusca || "")}"></div>
        <div class="chips" style="margin-bottom:10px">${[["todos", "Todos"], ...Object.entries(ST_PED).filter(([k]) => k !== "out" || G.out.ped.size).map(([k, [n]]) => [k, n])].map(([k, n]) => `<button class="chip" type="button" data-acao="ped-filtro" data-v="${k}" aria-pressed="${filtro === k}">${esc(n)}${k !== "todos" ? ` (${G[k].ped.size})` : ""}</button>`).join("")}</div>
        <div class="tabela-caixa"><table><thead><tr><th>Data</th><th>Produto</th><th>Loja</th><th>Status</th><th class="num">Itens</th><th class="num">Vendas</th><th class="num">Comissão</th><th>Liquidado em</th></tr></thead><tbody>
        ${linhas.map((p) => { const st = ST_PED[p.cat] || ST_PED.out; return `<tr><td>${dataBR(p.dia)}</td><td><div class="td-nome">${esc(p.nome)}</div></td><td>${esc(p.loja || "-")}</td><td><span class="selo ${st[1]}" title="${esc(p.status || "")}">${st[0]}</span></td><td class="num">${num(p.itens)}</td><td class="num">${real(p.g)}</td><td class="num">${real(p.cat === "liq" ? (+p.comissao_real || p.c) : p.c)}</td><td>${p.liquidado_em ? dataBR(String(p.liquidado_em).slice(0, 10)) : "-"}</td></tr>`; }).join("") || '<tr><td colspan="8"><p class="vazio">Nenhum pedido com esse filtro.</p></td></tr>'}
        </tbody></table></div></div>
      <div class="card"><div class="card-topo"><h2>O que cada status quer dizer</h2></div><ul class="lista-foco">${["liq", "pen", "agu", "ine"].map((k) => `<li><span class="nome"><span class="selo ${ST_PED[k][1]}">${ST_PED[k][0]}</span></span><span></span><small>${ST_PED[k][2]}</small></li>`).join("")}</ul></div>`;
    $("#buscaPed").addEventListener("input", (e) => { S.pedBusca = e.target.value; clearTimeout(telaPedidos.t); telaPedidos.t = setTimeout(() => { telaPedidos(el); const b = $("#buscaPed"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }, 250); });
  }
  async function telaProdutos(el) {
    const cab = `<div class="cabeca"><div><h1>Produtos</h1><p>Últimos 30 dias com dados${S.ultimo ? `, até ${dataBR(S.ultimo)}` : ""}. Ordenado pela comissão.</p></div></div>`;
    if (!S.pedidos.length) { el.innerHTML = cab + semDados(); return; }
    const an = analiseProdutos();
    const ine = new Map(); entre(an.ini30, an.fim).forEach((p) => { const x = ine.get(p.chave) || { t: 0, i: 0 }; x.t += p.itens || 0; if (p.cat === "ine") x.i += p.itens || 0; ine.set(p.chave, x); });
    let l = an.lista;
    if (S.filtroCat !== "todas") l = l.filter((x) => x.categoria === S.filtroCat);
    if (S.busca) { const b = S.busca.toLowerCase(); l = l.filter((x) => x.nome.toLowerCase().includes(b)); }
    const ord = { c30: (a, b) => b.c30 - a.c30, g30: (a, b) => b.g30 - a.g30, dias: (a, b) => b.dias.size - a.dias.size, var: (a, b) => (b.var ?? -1e9) - (a.var ?? -1e9) }[S.ordem];
    l = [...l].sort(ord);
    const presentes = new Set(an.lista.map((x) => x.categoria));
    const tendSelo = (x) => `<span class="selo ${x.tend === "Novo" ? "novo" : x.tend === "Acelerando" ? "sobe" : x.tend === "Esfriando" ? "desce" : ""}">${x.tend}${x.var != null && x.tend !== "Novo" ? ` ${x.var > 0 ? "▲" : "▼"} ${pct(Math.abs(x.var))}` : ""}</span>`;
    el.innerHTML = cab + `
      <div class="card"><div class="card-topo"><div class="chips">${[["todas", "Todas"], ...Object.entries(CATS).filter(([k]) => presentes.has(k))].map(([k, n]) => `<button class="chip" type="button" data-acao="cat" data-cat="${k}" aria-pressed="${S.filtroCat === k}">${esc(n)}</button>`).join("")}</div>
        <span class="espaco"></span><input class="inp busca" id="buscaProd" type="search" placeholder="Buscar produto" value="${esc(S.busca)}">
        <select class="inp" id="ordemProd" style="width:auto">${[["c30", "Maior comissão"], ["g30", "Maior venda"], ["dias", "Mais dias vendendo"], ["var", "Mais crescendo"]].map(([k, n]) => `<option value="${k}"${S.ordem === k ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="tabela-caixa"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Estoque</th><th>Sinal</th><th>Tendência</th><th>14 dias</th><th class="num">Dias c/ venda</th><th class="num">Vendas</th><th class="num">Comissão</th><th class="num">% do total</th><th class="num">% inelegível</th></tr></thead><tbody>
        ${l.map((x) => { const q = ine.get(x.chave) || { t: 0, i: 0 }, pi = q.t ? q.i / q.t * 100 : 0; return `<tr${x.acum - x.share < 80 ? ' style="background:rgba(168,134,74,.06)"' : ""}>
          <td><div class="td-nome" title="${esc(x.original || x.nome)}">${esc(x.nome)}</div></td>
          <td>${x.produto_id ? seletorCat(x) : esc(CATS[x.categoria] + (x.subcategoria ? " · " + x.subcategoria : ""))}</td>
          <td>${x.produto_id ? (x.esgotado ? `<span class="selo alerta">Esgotado</span> <button class="link" type="button" data-acao="desfazer-esgotado" data-id="${esc(x.produto_id)}">voltou</button>` : `<button class="link" type="button" data-acao="esgotado" data-id="${esc(x.produto_id)}">marcar esgotado</button>`) : ""}</td>
          <td><span class="selo ${x.sinal === "Recorrente" ? "sobe" : x.sinal === "Repetindo" ? "novo" : ""}">${x.sinal}</span></td>
          <td>${tendSelo(x)}</td><td>${sparkline(x.spark)}</td>
          <td class="num">${x.dias.size}</td><td class="num">${real(x.g30)}</td><td class="num"><b>${real(x.c30)}</b></td><td class="num">${pct(x.share)}</td>
          <td class="num"${pi > 15 ? ' style="color:var(--vermelho);font-weight:700"' : ""}>${pct(pi)}</td></tr>`; }).join("") || '<tr><td colspan="11"><p class="vazio">Nenhum produto com esse filtro.</p></td></tr>'}
        </tbody></table></div>
        <p class="frase">Linhas em destaque: os produtos que juntos fazem 80% da sua comissão. Recorrente: vendeu em 10 dias ou mais, por 2 vídeos ou mais (não depende de um vídeo só). Repetindo: 4 dias ou mais. Tendência compara os últimos ${S.janela} dias com os ${S.janela} anteriores. A categoria vem do nome do produto: se errar, troque na lista. Esgotado sai das sugestões e volta sozinho quando vender de novo.</p></div>`;
    $("#buscaProd").addEventListener("input", (e) => { S.busca = e.target.value; clearTimeout(telaProdutos.t); telaProdutos.t = setTimeout(() => { telaProdutos(el).then(() => { const b = $("#buscaProd"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }); }, 250); });
    $("#ordemProd").addEventListener("change", (e) => { S.ordem = e.target.value; telaProdutos(el); });
  }

  /* ---------- VÍDEOS ---------- */
  const linhaVideo = (v) => `<li><span class="hora">${v.hora ? v.hora.slice(0, 5) : "--:--"}</span><span class="prod" title="${esc(v.produto)}">${esc(v.produto)}${v.bloco ? `<small>${{ principal: "Principal", com_vendas: "Com vendas", teste: "Teste" }[v.bloco]}</small>` : ""}</span><button class="st st-${v.status}" type="button" data-acao="status-video" data-id="${v.id}" title="Mudar status">${{ rascunho: "A gravar", agendado: "Agendado", postado: "Postado" }[v.status]}</button><button class="x" type="button" data-acao="apagar-video" data-id="${v.id}" aria-label="Apagar">×</button></li>`;
  async function telaVideos(el) {
    S.videosDia = await API.videos(S.diaVideos, S.diaVideos);
    const nomes = [...new Set(analiseProdutos().lista.map((x) => x.nome))];
    const fim = S.ultimo || somaDias(hojeISO(), -1), ini = somaDias(fim, -29), m = new Map();
    entre(ini, fim, (p) => valido(p) && p.conteudo_id).forEach((p) => { const x = m.get(p.conteudo_id) || { id: p.conteudo_id, tipo: p.tipo_conteudo || "", prods: new Set(), ped: new Set(), g: 0, c: 0 }; x.prods.add(p.nome); x.ped.add(p.pedido_id); x.g += p.g; x.c += p.c; m.set(p.conteudo_id, x); });
    const conts = [...m.values()].sort((a, b) => b.c - a.c).slice(0, 25);
    const user = String(S.perfil.tiktok || "").replace(/^@/, "").trim();
    const v = S.videosDia, N = +S.perfil.meta_videos || 15;
    const passado = S.diaVideos < hojeISO(), sug = sugestaoDia(), lista = intercalar(sug.lista);
    const horasSug = horariosLivres(v.map((x) => x.hora && x.hora.slice(0, 5)), lista.length, S.diaVideos);
    const naAgenda = new Map(); v.forEach((x) => naAgenda.set(x.produto, (naAgenda.get(x.produto) || 0) + 1));
    const ROT = { principal: "Principal", com_vendas: "Com vendas", teste: "Teste" };
    const itens = lista.map((x, k) => { const tem = (naAgenda.get(x.produto) || 0) > 0; if (tem) naAgenda.set(x.produto, naAgenda.get(x.produto) - 1);
      return `<li class="${tem ? "ok" : ""}"><span class="n">${k + 1}</span><span class="hora">${horasSug[k] || "--:--"}</span><span class="prod" title="${esc(x.produto)}"><b>${esc(x.produto)}</b>${x.tag ? `<em>${esc(x.tag)}</em>` : ""}</span><span class="bl bl-${x.bloco}">${ROT[x.bloco] || "Teste"}</span>${tem ? '<span class="ja">na agenda</span>' : passado ? "" : `<button class="x mais" type="button" data-acao="sug-add" data-k="${k}" aria-label="Pôr na agenda" title="Pôr na agenda">+</button>`}</li>`; }).join("");
    const falta = sug.N - lista.length;
    const cardSug = passado ? "" : `<div class="card sugestao-dia"><div class="card-topo"><h2>Sugestão do dia</h2><span class="sub">${sug.N} vídeos${sug.comecando ? " de teste" : ` · ${sug.nP} principais, ${sug.nC} com vendas, ${sug.nT} testes`}</span><span class="espaco"></span>${lista.length ? `<button class="btn pequeno" type="button" data-acao="sug-lancar">Lançar na agenda de ${S.diaVideos === hojeISO() ? "hoje" : dataBR(S.diaVideos)}</button>` : ""}</div>
        ${lista.length ? `<ol class="sug-lista">${itens}</ol>` : '<p class="vazio">Ainda sem sugestão. Cadastre em Amostras os produtos que quer testar, ou importe seus pedidos.</p>'}
        ${falta > 0 && lista.length ? `<p class="frase">Faltam ${falta} para completar os ${sug.N}: ${sug.comecando ? "cadastre mais produtos para testar em Amostras" : "cadastre amostras (testes) ou importe mais pedidos"}.</p>` : ""}
        <p class="frase">A quantidade vem de "Vídeos por dia" em Meu perfil. Principais = o que mais te paga; com vendas = já vendeu e está subindo; testes = amostras e produtos novos.</p></div>`;
    S._sug = lista;
    el.innerHTML = `<div class="cabeca"><div><h1>Vídeos</h1><p>A sugestão do dia, a sua agenda e os vídeos que mais venderam.</p></div></div>
      ${cardSug}
      <div class="grade g2">
        <div class="card"><div class="card-topo"><h2>Agenda</h2><span class="sub">${v.length} de ${N} vídeos</span><span class="espaco"></span><input class="inp" type="date" id="diaVideos" value="${S.diaVideos}" style="width:auto"></div>
          ${v.length ? `<ul class="dia-videos">${v.map(linhaVideo).join("")}</ul>` : `<p class="vazio">Nada planejado para ${dataBR(S.diaVideos)}.${S.diaVideos === hojeISO() ? " Use \"Lançar no dia\" na tela Hoje." : ""}</p>`}
          <form class="form-linha" id="formVideo" style="margin-top:14px">
            <div class="curto"><label class="lbl" for="vHora">Hora</label><input class="inp" id="vHora" type="time"></div>
            <div><label class="lbl" for="vProd">Produto</label><input class="inp" id="vProd" list="listaProds" placeholder="nome do produto" required><datalist id="listaProds">${nomes.map((n) => `<option value="${esc(n)}">`).join("")}</datalist></div>
            <button class="btn pequeno" type="submit">Adicionar</button>
          </form>
          <p class="frase">Toque no status para mudar: A gravar, Agendado, Postado. Quando o Claude agendar no TikTok Studio, peça pra ele marcar aqui também.</p></div>
        <div class="card"><div class="card-topo"><h2>Vídeos que mais venderam</h2><span class="sub">30 dias, por comissão</span></div>
          ${conts.length ? `<div class="tabela-caixa"><table><thead><tr><th>Vídeo</th><th>Produto</th><th class="num">Pedidos</th><th class="num">Comissão</th></tr></thead><tbody>${conts.map((x) => { const quando = postadoPeloId(x.id); return `<tr><td>${user && /v[ií]deo/i.test(x.tipo) ? `<a href="https://www.tiktok.com/@${encodeURIComponent(user)}/video/${esc(x.id)}" target="_blank" rel="noopener">${quando ? "Postado " + dataBR(quando) : "Abrir"}</a>` : esc(x.tipo || "Conteúdo") + (quando ? " · " + dataBR(quando) : "")}</td><td><div class="td-nome" style="max-width:220px">${esc([...x.prods].join(", "))}</div></td><td class="num">${x.ped.size}</td><td class="num"><b>${real(x.c)}</b></td></tr>`; }).join("")}</tbody></table></div>` : '<p class="vazio">Nenhuma venda com vídeo nos últimos 30 dias.</p>'}
          <p class="frase">Grave de novo o formato dos vídeos do topo: mesmo gancho, produto parecido. ${user ? "" : "Coloque seu @ em Meu perfil para abrir os vídeos daqui."}</p></div>
      </div>`;
    $("#diaVideos").addEventListener("change", (e) => { S.diaVideos = e.target.value || hojeISO(); telaVideos(el); });
    $("#formVideo").addEventListener("submit", async (e) => {
      e.preventDefault(); const produto = $("#vProd").value.trim(); if (!produto) return;
      await API.novosVideos([{ data: S.diaVideos, hora: $("#vHora").value || null, produto: produto.slice(0, 300), status: "rascunho" }]);
      if (S.diaVideos === hojeISO()) S.videosHoje = await API.videos(hojeISO(), hojeISO());
      telaVideos(el); toast("Vídeo adicionado.");
    });
  }

  /* ---------- AMOSTRAS ---------- */
  const DECISOES = { testando: "Testando", escalar: "Escalar", monitorar: "Monitorar", pausar: "Pausar" };
  async function telaAmostras(el) {
    const hoje = hojeISO(), l = S.amostras;
    const vendasDe = (nome) => { const n = nome.toLowerCase().slice(0, 18); return somar(S.pedidos.filter((p) => p.nome.toLowerCase().includes(n))).c; };
    el.innerHTML = `<div class="cabeca"><div><h1>Amostras</h1><p>Produtos que você recebeu pra testar e o que fazer com cada um. Dica: mande o print da amostra pro Claude e escreva "cadastra essa amostra no meu painel".</p></div></div>
      <div class="card"><div class="card-topo"><h2>Nova amostra</h2></div>
        <form class="form-linha" id="formAmostra">
          <div><label class="lbl" for="aProd">Produto</label><input class="inp" id="aProd" required></div>
          <div class="curto" style="flex-basis:150px"><label class="lbl" for="aReceb">Recebi em</label><input class="inp" id="aReceb" type="date" value="${hoje}"></div>
          <div class="curto" style="flex-basis:150px"><label class="lbl" for="aPrazo">Postar até</label><input class="inp" id="aPrazo" type="date" value="${somaDias(hoje, 7)}"></div>
          <div class="curto"><label class="lbl" for="aCusto">Custo (R$)</label><input class="inp" id="aCusto" type="number" min="0" step="0.01" value="0"></div>
          <button class="btn pequeno" type="submit">Adicionar</button>
        </form></div>
      <div class="card"><div class="tabela-caixa"><table><thead><tr><th>Produto</th><th>Recebi</th><th>Postar até</th><th class="num">Custo</th><th class="num">Comissão já gerada</th><th>Decisão</th><th></th></tr></thead><tbody>
        ${l.map((a) => { const atras = a.decisao === "testando" && a.prazo_postar && a.prazo_postar < hoje; return `<tr><td><div class="td-nome">${esc(a.produto)}</div></td><td>${dataBR(a.recebida_em)}</td><td>${a.prazo_postar ? `<span class="selo ${atras ? "desce" : ""}">${dataBR(a.prazo_postar)}${atras ? " · atrasada" : ""}</span>` : ""}</td><td class="num">${real(a.custo)}</td><td class="num">${real(vendasDe(a.produto))}</td>
          <td><select class="inp" data-acao="decisao" data-id="${a.id}" aria-label="Decisão">${Object.entries(DECISOES).map(([k, n]) => `<option value="${k}"${a.decisao === k ? " selected" : ""}>${n}</option>`).join("")}</select></td>
          <td><button class="x" type="button" data-acao="apagar-amostra" data-id="${a.id}" aria-label="Apagar">×</button></td></tr>`; }).join("") || '<tr><td colspan="7"><p class="vazio">Nenhuma amostra cadastrada.</p></td></tr>'}
      </tbody></table></div>
      <p class="frase">As amostras em "Testando" entram nos testes do plano do dia, a de prazo mais perto primeiro. Comissão já gerada procura o nome do produto nos seus pedidos.</p></div>`;
    $("#formAmostra").addEventListener("submit", async (e) => {
      e.preventDefault(); const produto = $("#aProd").value.trim(); if (!produto) return;
      const a = await API.novaAmostra({ produto: produto.slice(0, 300), recebida_em: $("#aReceb").value || null, prazo_postar: $("#aPrazo").value || null, custo: Number($("#aCusto").value) || 0, decisao: "testando" });
      S.amostras.unshift(a); montarMenu(); telaAmostras(el); toast("Amostra adicionada.");
    });
  }

  /* ---------- IMPORTAR ---------- */
  async function telaImportar(el) {
    el.innerHTML = `<div class="cabeca"><div><h1>Importar pedidos</h1><p>Suba o relatório de afiliado do TikTok Shop. Pode subir de novo sempre que quiser: pedido repetido só é atualizado.</p></div></div>
      <div class="grade g21">
        <label class="solta" id="solta" for="arquivo"><strong>${noCelular() ? "Escolha o arquivo" : "Solte o arquivo aqui"}</strong><p>${noCelular() ? "Toque e pegue o relatório em Arquivos ou Downloads." : "ou clique para escolher."} Aceita .xlsx e .csv</p><span class="btn">Escolher arquivo</span><input id="arquivo" type="file" accept=".xlsx,.xls,.csv" hidden></label>
        <div class="card"><div class="card-topo"><h2>Como baixar o relatório</h2><span class="sub">pelo celular</span></div><ol class="passos">
          <li>No <b>app do TikTok</b>, entre na <b>Central de afiliados</b> (a central não abre no computador).</li>
          <li>Vá em <b>Pedidos</b> e escolha o período (até 90 dias).</li>
          <li>Toque em <b>Exportar</b>. O arquivo vai para <b>Arquivos</b> (iPhone) ou <b>Downloads</b> (Android).</li>
          <li>Aqui no painel, toque em <b>Escolher arquivo</b> e pegue o relatório. Faça isso toda manhã: o Hoje e as sugestões ficam em dia.</li></ol>
          <p class="frase">Dica: instale o painel como app (em Meu perfil). Aí, de manhã, ele já te lembra de subir o extrato.</p></div>
      </div>
      ${temContas() ? `<div class="card escolhe-conta"><label class="lbl" for="contaImp">Este extrato é de qual perfil?</label><select class="inp" id="contaImp">${[["", nomeConta("")], ...contas().map((c) => [c.id, c.nome || c.id])].map(([v, n]) => `<option value="${esc(v)}"${(contaAtiva() || "") === v ? " selected" : ""}>${esc(n)}</option>`).join("")}</select><p class="frase">Escolha antes de subir. Cada perfil baixa o próprio extrato na Central de afiliados dele.</p></div>` : ""}
      <p class="aviso neutro" id="progresso" hidden></p>
      <div class="card"><div class="card-topo"><h2>Arquivos importados</h2></div>
        <div class="tabela-caixa"><table><thead><tr><th>Quando</th>${temContas() ? "<th>Perfil</th>" : ""}<th>Arquivo</th><th>Período</th><th class="num">Linhas</th><th class="num">Novas</th><th class="num">Atualizadas</th></tr></thead><tbody>
        ${S.importacoes.map((i) => `<tr><td>${dataBR(String(i.importado_em).slice(0, 10))}</td>${temContas() ? `<td>${esc(nomeConta(i.conta || ""))}</td>` : ""}<td><div class="td-nome" style="max-width:260px">${esc(i.arquivo)}</div></td><td>${dataBR(String(i.periodo_ini || "").slice(0, 10))} a ${dataBR(String(i.periodo_fim || "").slice(0, 10))}</td><td class="num">${num(i.linhas)}</td><td class="num">${num(i.novas)}</td><td class="num">${num(i.atualizadas)}</td></tr>`).join("") || '<tr><td colspan="6"><p class="vazio">Nenhum arquivo ainda.</p></td></tr>'}
        </tbody></table></div></div>`;
    const solta = $("#solta"), inp = $("#arquivo");
    inp.addEventListener("change", () => inp.files[0] && importar(inp.files[0]));
    ["dragenter", "dragover"].forEach((t) => solta.addEventListener(t, (e) => { e.preventDefault(); solta.classList.add("sobre"); }));
    ["dragleave", "drop"].forEach((t) => solta.addEventListener(t, (e) => { e.preventDefault(); solta.classList.remove("sobre"); }));
    solta.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) importar(f); });
  }
  let leitor = null;
  function carregarLeitor() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!leitor) leitor = new Promise((ok, falha) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = () => ok(window.XLSX); s.onerror = () => { leitor = null; falha(new Error("Não consegui abrir o leitor de planilhas. Confira a internet e tente de novo.")); }; document.head.appendChild(s); });
    return leitor;
  }
  async function importar(arq) {
    const prog = $("#progresso"), diz = (t) => { if (prog) { prog.hidden = false; prog.textContent = t; } };
    try {
      diz("Lendo o arquivo...");
      const XLSX = await carregarLeitor();
      // CSV: lido como texto UTF-8 e sem conversão, pra "59,90" e os acentos chegarem intactos
      const ehCsv = /\.csv$/i.test(arq.name || "") || /csv/i.test(arq.type || "");
      const wb = ehCsv ? XLSX.read((await arq.text()).replace(/^﻿/, ""), { type: "string", raw: true })
        : XLSX.read(await arq.arrayBuffer(), { type: "array", cellDates: true });
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true });
      // O título pode não estar na primeira linha: procura nas 10 primeiras
      let h = linhas.slice(0, 10).findIndex((l) => l.map((c) => String(c).trim()).includes(COLUNAS.pedido_id));
      if (h < 0) throw new Error(`Esse arquivo não parece o de Pedidos de afiliados: não achei a coluna "${COLUNAS.pedido_id}".`);
      const tit = linhas[h].map((c) => String(c).replace(/\s+/g, " ").trim()), idx = {};
      for (const [k, nome] of Object.entries(COLUNAS)) idx[k] = tit.indexOf(nome);
      const faltam = ["gmv", "data"].filter((k) => idx[k] < 0);
      if (faltam.length) throw new Error(`Faltam as colunas ${faltam.map((k) => `"${COLUNAS[k]}"`).join(" e ")} no arquivo.`);
      const cel = (l, k) => (idx[k] >= 0 ? l[idx[k]] : ""), txt = (l, k, max) => { const v = String(cel(l, k) ?? "").trim(); return v ? v.slice(0, max) : null; };
      const agora = new Date().toISOString(), porChave = new Map(); let semData = 0;
      const contaImp = temContas() ? ($("#contaImp") ? $("#contaImp").value : contaAtiva()) : "";
      linhas.slice(h + 1).forEach((l) => {
        const pedido = txt(l, "pedido_id", 40); if (!pedido) return;
        const data = lerData(cel(l, "data")); if (!data) { semData++; return; }
        const st = txt(l, "status", 40), recebido = lerNum(cel(l, "recebido"));
        porChave.set(pedido + "|" + (txt(l, "sku_id", 40) || ""), {
          pedido_id: pedido, sku_id: txt(l, "sku_id", 40) || "", produto_id: txt(l, "produto_id", 40), produto: txt(l, "produto", 400), loja: txt(l, "loja", 200),
          itens: Math.round(lerNum(cel(l, "itens"))), reembolsados: Math.round(lerNum(cel(l, "reembolsados"))), status: st === "AwaitingPayment" ? "Aguardando pagamento" : st,
          tipo_conteudo: txt(l, "tipo_conteudo", 40), conteudo_id: txt(l, "conteudo_id", 40), gmv: lerNum(cel(l, "gmv")),
          comissao_est: Math.round((lerNum(cel(l, "padrao")) + lerNum(cel(l, "anuncios")) + lerNum(cel(l, "bonus"))) * 100) / 100,
          comissao_real: recebido || null, data, liquidado_em: lerData(cel(l, "liquidado")), atualizado_em: agora,
          ...(contaImp ? { conta: contaImp } : {})
        });
      });
      const lista = [...porChave.values()];
      if (!lista.length) throw new Error("Não achei nenhum pedido nesse arquivo.");
      diz("Conferindo o que já existe...");
      const ja = await API.statusExistentes([...new Set(lista.map((p) => p.pedido_id))]);
      await API.gravarPedidos(lista, (n) => diz(`Gravando pedidos... ${num(n)} de ${num(lista.length)}`));
      const novas = lista.filter((p) => !ja.has(p.pedido_id + "|" + p.sku_id)).length, datas = lista.map((p) => p.data).sort();
      await API.novaImportacao({ arquivo: String(arq.name || "").slice(0, 200), periodo_ini: datas[0], periodo_fim: datas[datas.length - 1], linhas: lista.length, novas, atualizadas: lista.length - novas, ...(contaImp ? { conta: contaImp } : {}) });
      diz("Atualizando o painel...");
      [S.brutos, S.importacoes] = await Promise.all([API.pedidos(), API.importacoes()]);
      reprocessar(); S.mes = (S.ultimo || hojeISO()).slice(0, 7);
      const voltaram = await conferirEsgotados(true);
      toast(`${temContas() ? nomeConta(contaImp) + ": " : "Pronto: "}${plural(novas, "pedido novo", "pedidos novos")} e ${plural(lista.length - novas, "atualizado", "atualizados")}.${semData ? ` ${semData} linhas sem data ficaram de fora.` : ""}${voltaram ? " " + voltaram : ""}`);
      irPara("hoje");
    } catch (e) { console.error(e); diz(traduz(e)); toast(traduz(e), true); }
  }

  /* ---------- PERFIL ---------- */
  async function telaPerfil(el) {
    const p = S.perfil, sug = sugestaoMeta();
    el.innerHTML = `<div class="cabeca"><div><h1>Meu perfil</h1><p>Seus dados, suas metas e o jeito que o painel aparece pra você.</p></div></div>
      <div class="grade">
      <div class="card"><div class="card-topo"><h2>Dados e metas</h2></div><form class="form" id="formPerfil">
        <div class="dupla"><div><label class="lbl" for="pNome">Nome</label><input class="inp" id="pNome" value="${esc(p.nome)}"></div>
          <div><label class="lbl" for="pApelido">Como quero ser chamado</label><input class="inp" id="pApelido" value="${esc(p.apelido)}" placeholder="ex.: Ju"></div></div>
        <div><label class="lbl" for="pTiktok">@ do TikTok</label><input class="inp" id="pTiktok" value="${esc(p.tiktok)}"></div>
        ${API.transcrever ? `<div><label class="lbl" for="pSupadata">Chave da Supadata <small>para transcrever os vídeos da aba Criar</small></label><input class="inp" id="pSupadata" type="password" autocomplete="off" spellcheck="false" placeholder="sd_..." value="${esc(p.supadata_key || "")}"><p class="frase" style="margin:6px 0 0">Conta grátis em <a href="https://supadata.ai" target="_blank" rel="noopener">supadata.ai</a> (100 por mês). No painel deles, abra API Keys e copie a chave. Fica guardada só no seu banco.</p></div>` : ""}
        <div class="dupla"><div><label class="lbl" for="pMetaG">Quanto quero vender no mês (R$)</label><input class="inp" id="pMetaG" type="number" min="0" step="500" value="${esc(p.meta_gmv || "")}" placeholder="ex.: 30000"></div>
          <div><label class="lbl" for="pMetaV">Vídeos por dia</label><input class="inp" id="pMetaV" type="number" min="1" max="60" value="${esc(p.meta_videos || 15)}"></div></div>
        ${sug ? `<div class="sugestao"><span class="rot">Sugestão pelo seu crescimento</span><div class="meta-num">${real(sug.valor)}</div><p class="frase">${esc(sug.motivo)}</p><button class="btn sec pequeno" type="button" id="pUsarSug">Usar a sugestão</button></div>` : `<p class="frase">Depois que você importar seus pedidos, o painel sugere uma meta pelo seu crescimento.</p>`}
        <div><button class="btn" type="submit">Salvar</button></div>
      </form></div>
      </div>
      <div class="card" id="cardContas"></div>
      <div class="card" id="cardAparencia"></div>
      <div class="card" id="cardApp"><div class="card-topo"><h2>App no celular</h2><span class="sub">ícone na tela inicial e lembrete de manhã pra subir o extrato</span></div>${comoInstalar()}${cardLembrete()}</div>`;
    desenharContas();
    S.ap = { estilo: normEstilo(p.estilo || document.documentElement.dataset.estilo), cor: normPaleta(p.cor || document.documentElement.dataset.paleta), custom: normCustom(p.cor_custom) };
    desenharAparencia();
    const u = $("#pUsarSug"); if (u) u.addEventListener("click", () => { $("#pMetaG").value = sug.valor; toast("Sugestão colocada. Clique em Salvar."); });
    $("#formPerfil").addEventListener("submit", async (e) => {
      e.preventDefault();
      let tk = $("#pTiktok").value.trim(); if (tk && tk[0] !== "@") tk = "@" + tk;
      const sd = $("#pSupadata"), extra = sd ? { supadata_key: sd.value.trim().slice(0, 200) || null } : {};
      const novo = { ...extra, nome: $("#pNome").value.trim().slice(0, 120), apelido: $("#pApelido").value.trim().slice(0, 40), tiktok: tk.slice(0, 60),
        meta_videos: Math.min(60, Math.max(1, parseInt($("#pMetaV").value, 10) || 15)), meta_gmv: Number($("#pMetaG").value) || null };
      try { await API.salvarPerfil(novo); Object.assign(S.perfil, novo); montarMenu(); toast("Perfil salvo."); } catch (er) { toast(traduz(er), true); }
    });
  }

  /* ---------- PERFIS DO TIKTOK (Meu perfil) ---------- */
  function desenharContas() {
    const box = $("#cardContas"); if (!box) return;
    const l = S.rascContas || contas().map((c) => ({ ...c }));
    box.innerHTML = `<div class="card-topo"><h2>Perfis do TikTok</h2><span class="sub">tem mais de um @? Cada um com os seus pedidos, vídeos, amostras e meta</span></div>
      <ul class="lista-foco contas">
        <li><span class="nome">${esc(nomeConta(""))}</span><span class="selo">principal</span><small>O @ dos seus dados acima. A meta dele é a de "Quanto quero vender no mês".</small></li>
        ${l.map((c, k) => `<li class="conta-linha"><div class="dupla"><div><label class="lbl" for="cN${k}">@ do perfil</label><input class="inp" id="cN${k}" data-conta-nome="${k}" value="${esc(c.nome || "")}" placeholder="@outroperfil"></div>
          <div><label class="lbl" for="cM${k}">Meta de vendas no mês (R$)</label><input class="inp" id="cM${k}" data-conta-meta="${k}" type="number" min="0" step="500" value="${esc(c.meta || "")}" placeholder="opcional"></div></div>
          <button class="link" type="button" data-acao="conta-remover" data-k="${k}">tirar este perfil</button></li>`).join("")}
      </ul>
      <div class="controles" style="margin-top:12px"><button class="btn sec pequeno" type="button" data-acao="conta-add">Adicionar perfil</button><button class="btn pequeno" type="button" data-acao="conta-salvar">Salvar perfis</button></div>
      <p class="frase">Com 2 perfis ou mais, aparece um seletor no menu: veja um perfil por vez ou "Todos os perfis" somados. Na aba Importar você escolhe de qual perfil é cada extrato. Tirar um perfil não apaga os pedidos dele: eles continuam em "Todos os perfis".</p>`;
    box.querySelectorAll("[data-conta-nome],[data-conta-meta]").forEach((i) => i.addEventListener("input", () => { S.rascContas = lerRascContas(); }));
  }
  function lerRascContas() {
    const l = (S.rascContas || contas()).map((c) => ({ ...c }));
    $$("#cardContas [data-conta-nome]").forEach((i) => { const k = +i.dataset.contaNome; if (l[k]) l[k].nome = i.value.trim().slice(0, 60); });
    $$("#cardContas [data-conta-meta]").forEach((i) => { const k = +i.dataset.contaMeta; if (l[k]) l[k].meta = Number(i.value) || null; });
    return l;
  }
  function novoIdConta(l) { let n = 2; while (l.some((c) => c.id === "c" + n)) n++; return "c" + n; }

  /* ---------- APARÊNCIA: escolher estilo, paleta e ver a prévia ---------- */
  // Prévia feita com as peças reais do painel (cartões, números, gráfico, lista) e os números do próprio usuário
  function dadosPrevia() {
    const ref = (S.ultimo || hojeISO()).slice(0, 7), per = periodo(ref), t = somar(entre(per.ini, per.fim));
    const dias = []; for (let k = 13; k >= 0; k--) dias.push(somaDias(S.ultimo || hojeISO(), -k));
    const porDia = dias.map((d) => S.pedidos.filter((x) => x.dia === d && valido(x)).reduce((a, x) => a + x.g, 0));
    const an = S.pedidos.length ? analiseProdutos().lista.slice().sort((a, b) => b.c30 - a.c30).slice(0, 3) : [];
    const cats = {}; entre(per.ini, per.fim).filter(valido).forEach((p) => { const c = CATS[p.categoria] || "Outros"; cats[c] = (cats[c] || 0) + p.g; });
    const temDados = porDia.some((v) => v > 0);
    return { t, dias, porDia: temDados ? porDia : [3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 11], exemplo: !temDados, an, cats: Object.keys(cats).length ? cats : { "Seus produtos": 1 }, N: +S.perfil.meta_videos || 15, feitos: (S.videosHoje || []).filter((v) => v.status !== "rascunho").length };
  }
  // Menu em miniatura (aberto ou recolhido), com os mesmos tokens do menu de verdade
  function miniMenu(recolhido, comDica) {
    const itens = [["hoje", "Hoje"], ["resultados", "Resultados"], ["pedidos", "Pedidos"], ["produtos", "Produtos"], ["videos", "Vídeos"], ["criar", "Criar"]];
    const ini = ((S.perfil.nome || "").trim() || "M")[0].toUpperCase();
    return `<div class="mm${recolhido ? " mm-rec" : ""}"><div class="mm-marca"><span class="marca-sinal">${esc(ini)}</span>${recolhido ? "" : `<b>${esc((S.perfil.nome || "Meu painel").split(" ")[0])}</b>`}</div>
      ${itens.map(([k, n], i) => `<span class="mm-item${i === 0 ? " at" : ""}"><svg class="i" viewBox="0 0 24 24">${ICONES[k]}</svg>${recolhido ? "" : `<span>${n}</span>`}${comDica && recolhido && i === 2 ? `<em class="mm-dica">${n}</em>` : ""}</span>`).join("")}</div>`;
  }
  function amostra(estilo, cor, custom, d, aba, compacto) {
    const nome = esc((S.perfil.apelido || "").trim() || (S.perfil.nome || "").split(" ")[0] || "você");
    const c = normCustom(custom), tipo = TIPO_GRAF[estilo] || "linha";
    const pts = d.porDia.map((v, i) => ({ rot: d.dias[i] ? String(+d.dias[i].slice(8, 10)) : String(i + 1), v, dica: `${d.dias[i] ? dataBR(d.dias[i]) : ""} · ${real(v)}` }));
    const lista = d.an.length ? d.an.map((x) => `<li><span class="nome">${esc(x.nome)}</span><span class="val">${realCurto(x.c30)}</span></li>`).join("") : "<li><span class=\"nome\">Seus produtos aparecem aqui</span><span class=\"val\">-</span></li>";
    const attrs = `data-estilo="${estilo}" data-paleta="${cor}"${c ? ` style="--p-principal:${c}"` : ""}`;
    let corpo;
    if (aba === "menu") corpo = `<div class="ta-menus"><div><p class="lbl">Menu aberto</p>${miniMenu(false)}</div><div><p class="lbl">Menu recolhido</p>${miniMenu(true, true)}</div></div>`;
    else if (aba === "resultados") corpo = `<div class="ta-topo"><div><p class="lbl" style="margin:0">Resultados</p><h3>${nomeMes((S.ultimo || hojeISO()).slice(0, 7))}</h3></div><span class="btn pequeno">Todo o período</span></div>
      <div class="ta-kpis"><div class="card kpi escuro"><p class="rot">Vendas no mês</p><div class="val">${realCurto(d.t.g)}</div></div><div class="card kpi"><p class="rot">Comissão</p><div class="val">${realCurto(d.t.c)}</div><span class="selo sobe">no mês</span></div><div class="card kpi"><p class="rot">Pedidos</p><div class="val">${num(d.t.pedidos)}</div></div></div>
      <div class="ta-grade"><div class="card"><div class="card-topo"><h2>Vendas por dia</h2></div>${grafSerie(pts, tipo, "Vendas por dia")}</div><div class="card"><div class="card-topo"><h2>Por categoria</h2></div>${graficoCirculo(Object.entries(d.cats), false, "Vendas por categoria")}</div></div>`;
    else corpo = `<div class="ta-topo"><div><p class="lbl" style="margin:0">Hoje</p><h3>Bom dia, <em>${nome}</em>.</h3></div><span class="btn pequeno">Lançar no dia</span></div>
      <div class="ta-kpis">
        <div class="card kpi escuro"><p class="rot">Vendas no mês</p><div class="val">${realCurto(d.t.g)}</div></div>
        <div class="card kpi"><p class="rot">Comissão</p><div class="val">${realCurto(d.t.c)}</div><span class="selo sobe">no mês</span></div>
        <div class="card kpi"><p class="rot">Vídeos de hoje</p><div class="val">${d.feitos} de ${d.N}</div><div class="barra"><i style="width:${Math.min(100, d.feitos / d.N * 100).toFixed(0)}%"></i></div></div>
      </div>
      <div class="ta-grade">
        <div class="card"><div class="card-topo"><h2>Vendas por dia</h2><span class="sub">${d.exemplo ? "exemplo" : "14 dias"}</span></div>${grafSerie(pts, tipo, "Vendas por dia")}</div>
        <div class="card"><div class="card-topo"><h2>Principais</h2></div><ul class="lista-foco">${lista}</ul><div class="chips" style="margin-top:10px"><span class="chip" aria-pressed="true">Todas</span><span class="chip">Tech</span></div></div>
      </div>`;
    if (aba !== "menu") corpo = `<div class="ta-app"><div class="ta-lado">${miniMenu(!!compacto)}</div><div class="ta-corpo">${corpo}</div></div>`;
    return `<div class="tema-amostra ta-${aba || "hoje"}" ${attrs}>${corpo}</div>`;
  }
  function desenharAparencia() {
    const box = $("#cardAparencia"); if (!box) return;
    const a = S.ap, d = dadosPrevia(), atual = document.documentElement, aba = a.aba || "hoje";
    const salvo = normEstilo(S.perfil.estilo || atual.dataset.estilo) === a.estilo && normPaleta(S.perfil.cor || atual.dataset.paleta) === a.cor && normCustom(S.perfil.cor_custom) === a.custom;
    const corBase = a.custom || PALETAS[a.cor][1][1];
    box.innerHTML = `<div class="card-topo"><h2>Aparência</h2><span class="sub">4 modelos x 8 paletas: tudo combina com tudo</span></div>
      <div class="ap-passo"><p class="lbl"><b>1</b>Modelo</p>
        <div class="ap-estilos">${Object.entries(ESTILOS).map(([k, [n, desc]]) => `<button type="button" class="ap-estilo" data-acao="ap-estilo" data-v="${k}" aria-pressed="${a.estilo === k}">${amostra(k, a.cor, a.custom, d, "hoje", true)}<b>${n}</b><small>${desc}</small></button>`).join("")}</div></div>
      <div class="ap-passo"><p class="lbl"><b>2</b>Paleta</p>
        <div class="ap-paletas">${Object.entries(PALETAS).map(([k, [n, cs]]) => `<button type="button" class="ap-paleta" data-acao="ap-paleta" data-v="${k}" aria-pressed="${a.cor === k}"><span class="ap-cores">${cs.map((x) => `<i style="background:${x}"></i>`).join("")}</span>${n}</button>`).join("")}</div>
        <div class="ap-custom"><label for="apCor">Cor principal personalizada</label><input type="color" id="apCor" value="${corBase}">${a.custom ? `<button class="link" type="button" data-acao="ap-sem-custom">usar a cor da paleta</button>` : `<span class="sub" style="color:var(--muted)">opcional</span>`}</div></div>
      <div class="ap-passo ap-previa"><p class="lbl"><b>3</b>Prévia ${salvo ? "· é o que você está usando" : "· ainda não aplicado"}</p>
        <div class="chips ap-abas" role="tablist">${[["hoje", "Hoje"], ["resultados", "Resultados"], ["menu", "Menu aberto e recolhido"]].map(([k, n]) => `<button class="chip" type="button" role="tab" data-acao="ap-aba" data-v="${k}" aria-pressed="${aba === k}" aria-selected="${aba === k}">${n}</button>`).join("")}</div>
        ${amostra(a.estilo, a.cor, a.custom, d, aba)}
        <div class="ap-acoes"><button class="btn sec pequeno" type="button" data-acao="ap-restaurar">Restaurar padrão</button><button class="btn pequeno" type="button" data-acao="ap-aplicar"${salvo ? " disabled" : ""}>Aplicar</button></div></div>`;
    const inp = $("#apCor");
    inp.addEventListener("input", () => { $$("#cardAparencia .tema-amostra").forEach((x) => x.style.setProperty("--p-principal", inp.value)); });
    inp.addEventListener("change", () => { S.ap.custom = normCustom(inp.value); desenharAparencia(); });
  }
  async function salvarAparencia(estilo, cor, custom) {
    aplicarAparencia(estilo, cor, custom);
    const novo = { estilo, cor, cor_custom: custom };
    Object.assign(S.perfil, novo);
    try { await API.salvarPerfil(novo); return true; }
    catch (e) { console.warn(e); toast("Apliquei neste aparelho. Para guardar na sua conta, atualize o banco do painel (peça ao Claude: \"saiu versão nova do painel\").", true); return false; }
  }

  /* ---------- COMEÇANDO (ainda sem vendas) ---------- */
  const PASSOS = [
    ["conta", "Criar a conta de criador e entrar na Central de afiliados do TikTok Shop"],
    ["vitrine", "Liberar a vitrine e colocar os primeiros produtos nela"],
    ["nicho", "Escolher 1 nicho para os primeiros 30 dias"],
    ["testes", "Escolher 3 produtos para testar (ou pedir 3 amostras)"],
    ["roteiro", "Treinar o Claude com o seu jeito de roteiro"],
    ["primeiros", "Postar os 10 primeiros vídeos"],
    ["venda", "Quando sair a primeira venda, importar os pedidos aqui"]
  ];
  function planoComecando() {
    const N = Math.max(1, +S.perfil.meta_videos || 15);
    const l = S.amostras.filter((a) => a.decisao === "testando" || a.decisao === "escalar")
      .sort((a, b) => (a.decisao === "escalar" ? -1 : 0) - (b.decisao === "escalar" ? -1 : 0) || String(a.prazo_postar || "9").localeCompare(String(b.prazo_postar || "9")));
    const lista = []; for (let k = 0; k < N && l.length; k++) { const a = l[k % l.length]; lista.push({ produto: a.produto, bloco: "teste", tag: a.decisao === "escalar" ? "Escalar" : "" }); }
    return { N, lista, produtos: l.length };
  }
  function telaComecando(el, cab) {
    const feitos = S.perfil.passos || {}, nFeitos = PASSOS.filter(([k]) => feitos[k]).length;
    const plano = planoComecando(), vids = S.videosHoje, testes = S.amostras.filter((a) => a.decisao === "testando" || a.decisao === "escalar");
    el.innerHTML = cab + `
      <div class="aviso neutro"><span><b>Você ainda não tem vendas, e tudo bem.</b> Enquanto isso o painel organiza seus primeiros passos, seus produtos de teste e seus vídeos. Na primeira venda, importe os pedidos e ele vira o painel completo.</span></div>
      <div class="grade g21">
        <div class="card"><div class="card-topo"><h2>Primeiros passos</h2><span class="sub">${nFeitos} de ${PASSOS.length}</span></div>
          <div class="barra"><i style="width:${(nFeitos / PASSOS.length * 100).toFixed(1)}%"></i></div>
          <ul class="passos-lista">${PASSOS.map(([k, t], i) => `<li><button type="button" class="passo-item" data-acao="passo" data-k="${k}" aria-pressed="${!!feitos[k]}"><span class="pn">${feitos[k] ? "✓" : i + 1}</span><span>${esc(t)}</span></button></li>`).join("")}</ul>
          <p class="frase">Toque em cada passo quando terminar. Fica salvo no seu painel.</p></div>
        <div class="card kpi"><p class="rot">Vídeos de hoje</p><div class="val">${vids.filter((v) => v.status !== "rascunho").length} de ${plano.N}</div>
          <div class="barra"><i style="width:${Math.min(100, vids.filter((v) => v.status !== "rascunho").length / plano.N * 100).toFixed(1)}%"></i></div>
          <small>Começando? Uma meta de 3 a 5 vídeos por dia já é ótima. <button class="link" type="button" data-tela="perfil">Mudar a meta</button></small></div>
      </div>
      <div class="grade g2">
        <div class="card"><div class="card-topo"><h2>Produtos para testar</h2><span class="sub">${testes.length}</span><span class="espaco"></span><button class="btn pequeno" type="button" data-tela="amostras">Adicionar produto</button></div>
          ${testes.length ? `<ul class="lista-foco">${testes.map((a) => `<li><span class="nome" title="${esc(a.produto)}">${esc(a.produto)}</span><span>${a.decisao === "escalar" ? '<span class="selo sobe">Escalar</span>' : a.prazo_postar ? `<span class="selo ${a.prazo_postar < hojeISO() ? "desce" : ""}">até ${dataBR(a.prazo_postar)}</span>` : ""}</span></li>`).join("")}</ul>`
            : '<p class="vazio">Nenhum produto ainda. Adicione em Amostras os produtos que você quer testar, ou mande o print de uma amostra pro Claude.</p>'}
          <p class="frase">Estes são os produtos do seu plano do dia. Teste cada um por uns 5 a 7 dias.</p></div>
        <div class="card"><div class="card-topo"><h2>Plano de hoje</h2><span class="espaco"></span><button class="btn pequeno" type="button" data-acao="lancar-plano"${!plano.lista.length || vids.length >= plano.N ? " disabled" : ""}>${vids.length ? "Completar o dia" : "Lançar no dia"}</button></div>
          ${vids.length ? `<ul class="dia-videos">${vids.map(linhaVideo).join("")}</ul>` : plano.lista.length ? `<p class="vazio">${plano.N} vídeos divididos entre seus ${plural(plano.produtos, "produto de teste", "produtos de teste")}. Clique em "Lançar no dia" para criar a lista com horários.</p>` : '<p class="vazio">Adicione pelo menos 1 produto para testar e o plano aparece aqui.</p>'}
          <p class="frase">Quer ideias de vídeo? Abra a aba Criar e modele a copy de um vídeo que já vendeu.</p></div>
      </div>`;
  }

  /* ---------- CRIAR (modelar copy) ---------- */
  const MUDA = [["gancho", "Gancho", "a primeira frase, que para o dedo"], ["jeito", "Jeito de falar", "as palavras e o ritmo, pro meu jeito"], ["historia", "História", "a situação contada no meio"], ["dor", "Dor de abertura", "o problema que abre o vídeo"], ["oferta", "Oferta", "preço, condição e motivo pra comprar agora"], ["antecipacao", "Antecipação e curiosidade", "gancho forte e descoberta guardada até o fim"]];
  const autorDo = (link) => { const m = String(link || "").match(/@([\w.]+)/); return m ? "@" + m[1] : ""; };
  const tituloDa = (r) => r.titulo || (r.texto ? r.texto.split(/\s+/).slice(0, 12).join(" ") + "…" : "Referência TikTok Shop");
  function nomesProdutos() { return [...new Set([...analiseProdutos().lista.map((x) => x.nome), ...S.amostras.map((a) => a.produto)])]; }
  function pedidoCopy(r) {
    const f = S.refForm, muda = MUDA.filter(([k]) => f.muda[k]).map(([, n, d]) => `- ${n} (${d})`);
    const produto = f.modo === "mesmo" ? (f.mesmo ? f.mesmo : "o mesmo produto da referência (descubra pelo texto; se o texto não disser o nome, use [nome do produto])") : f.modo === "meu" ? (f.produto || "[escolha o produto]") : (f.outro || "[escreva o produto]");
    return `Você vai modelar a copy de um vídeo de TikTok Shop que deu certo. Mantenha a estrutura, a ordem e o tom da referência.

REFERÊNCIA (o que a pessoa fala no vídeo):
"""
${r.texto || "[cole o texto do vídeo]"}
"""

PRODUTO DO MEU VÍDEO: ${produto}

O QUE MUDA (o resto fica igual à referência):
${muda.length ? muda.join("\n") : "- só o produto"}

O QUE EU SEI DO PRODUTO: ${f.modo === "mesmo"
  ? `é o MESMO produto da referência: use as características, números, benefícios e o que vem na caixa que a pessoa fala no vídeo, sem inventar nada além disso.${f.sabe ? " Além disso: " + f.sabe : ""} Deixe [entre colchetes] só o que é pessoal meu (minha história, minha reação) e o que a loja mostra (preço, cupom, frete).`
  : (f.sabe || "nada além do nome; o que faltar, deixe [entre colchetes]")}

ENTREGUE, em português do Brasil, nesta ordem:
MAPA DA REFERÊNCIA: as partes do vídeo numeradas (gancho, problema, demonstração, prova, chamada pro carrinho), com os segundos de cada uma. Calcule pelos números de palavras: palavras ÷ 3,25 = segundos.
POR QUE PRENDE: 1 frase sobre o gancho.
ROTEIRO NOVO: pronto para gravar, mesmo tamanho da referência, dividido em cenas. Use EXATAMENTE este formato, uma cena por parte do mapa, sem comentários entre as cenas:
CENA 1
FALA: o que eu falo, do jeito que eu falo
IMAGEM: o que aparece na tela (enquadramento, produto, demonstração)
TEXTO NA TELA: só se tiver (na cena 1, a headline do gancho)
3 GANCHOS ALTERNATIVOS: um por linha.
${f.muda.antecipacao ? `
TÉCNICA DA COPY (antecipação, curiosidade e retenção):
- Abra com um Big Hook: a promessa central que faz a pessoa querer ver até o fim. Use curiosidade, contraste, surpresa, um problema do dia a dia, uma descoberta inesperada, uma demonstração intrigante ou uma quebra de expectativa.
- Não entregue tudo no começo. Siga a ordem: desperta curiosidade, cria expectativa, desenvolve a situação, traz informação nova, entrega a descoberta prometida, liga a descoberta ao benefício e ao carrinho.
- Toda curiosidade aberta é respondida no próprio vídeo, com algo que valha a espera. Nada de suspense sem recompensa.
- A retenção trabalha pra venda: a descoberta é um benefício ou diferencial real do produto, e logo depois vem a chamada pro carrinho.
- Não é listar características: é uma história curta que faz a pessoa querer saber o que vem a seguir.
` : ""}
REGRAS: entregue tudo agora, sem fazer perguntas antes: o que faltar fica [entre colchetes] para eu ajustar. Não copie frases da referência, só a estrutura. Nada de promessa de cura, resultado garantido, preço de antes falso ou urgência que a loja não deu. Não invente preço nem característica: o que não souber fica [entre colchetes]. Se eu pedir mais de um roteiro, abra cada um com uma linha ROTEIRO 1, ROTEIRO 2 (e assim por diante), cada um com as suas cenas. Sem emoji e sem travessão.`;
  }
  // Lê a copy do Claude e separa as cenas. Entende "CENA 1 / FALA: / IMAGEM:", partes "[1. GANCHO]" e títulos "1. Gancho".
  function cenasDaCopy(txt) {
    const linhas = String(txt).replace(/\r/g, "").replace(/\*\*|__|^#+\s*/gm, "").split("\n").map((l) => l.trim());
    const eRoteiro = (l) => /^ROTEIRO( NOVO)?\b/i.test(l), eGanchos = (l) => /^(\d+\s+)?GANCHOS?( ALTERNATIVOS| PARA TESTAR)?\b/i.test(l), eFim = (l) => /^(RISCOS|CUIDADOS|OBSERVA|ANTES DE GRAVAR|DICAS)/i.test(l);
    let a = linhas.findIndex(eRoteiro); a = a < 0 ? 0 : a + 1;
    let b = linhas.findIndex((l, k) => k >= a && (eGanchos(l) || eFim(l))); if (b < 0) b = linhas.length;
    const corpo = linhas.slice(a, b);
    const ganchos = []; const g = linhas.findIndex(eGanchos);
    if (g >= 0) for (let k = g + 1; k < linhas.length && ganchos.length < 3; k++) { const l = linhas[k]; if (!l) continue; if (eFim(l)) break; ganchos.push(l.replace(/^\s*[-•\d.)]+\s*/, "")); }
    const marcaCena = (l) => /^CENA\s*\d+\b/i.test(l), marcaParte = (l) => /^\[[^\]]{2,60}\]$/.test(l) || /^\d+\s*[.)-]\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 +/,-]{2,50}:?$/.test(l) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ +/-]{3,40}:$/.test(l);
    const meta = (l) => /\b(palavras|segundos)\b.*(\d)/i.test(l) && /(fala lida|total|preenchendo|deve fechar|contagem)/i.test(l);
    const cenas = []; let atual = null;
    const temMarca = corpo.some((l) => marcaCena(l) || marcaParte(l));
    const nova = (nome) => { atual = { parte: nome, fala: [], imagem: [], texto: [] }; cenas.push(atual); };
    corpo.forEach((l) => {
      if (!l || meta(l)) return;
      if (temMarca && !atual && !marcaCena(l) && !marcaParte(l)) return;   // comentário do Claude antes da primeira cena
      if (marcaCena(l)) { nova(""); const resto = l.replace(/^CENA\s*\d+\s*[:.)-]?\s*/i, ""); if (resto) atual.parte = resto; return; }
      if (marcaParte(l)) { nova(l.replace(/^\[|\]$/g, "").replace(/^\d+\s*[.)-]\s*/, "").replace(/:$/, "").trim()); return; }
      if (!atual) nova("");
      let m;
      if ((m = l.match(/^FALA\s*:\s*(.*)$/i))) atual.fala.push(m[1]);
      else if ((m = l.match(/^(IMAGEM|CENA|TELA|VISUAL)\s*:\s*(.*)$/i))) atual.imagem.push(m[2]);
      else if ((m = l.match(/^TEXTO NA TELA\s*:\s*(.*)$/i))) { if (!/^\(?(nenhum|sem texto|-|n[aã]o tem)\)?\.?$/i.test(m[1].trim())) atual.texto.push(m[1]); }
      else atual.fala.push(l);
    });
    const parte = (x) => {
      if (!x) return "";
      let y = x.replace(/^[(\[]|[)\]]$/g, "").replace(/\b(cerca de|aprox\.?|aproximadamente|~)\s*/gi, "").replace(/\s*,\s*(\d+\s*(s|seg|segundos)\b)/i, " · $1").replace(/\s+/g, " ").trim().toLowerCase();
      return y.charAt(0).toUpperCase() + y.slice(1);
    };
    return { cenas: cenas.map((c) => ({ parte: parte(c.parte), fala: c.fala.join(" "), imagem: c.imagem.join(" "), texto: c.texto.join(" ") })).filter((c) => c.fala || c.imagem), ganchos };
  }
  // Uma copy pode trazer mais de um roteiro ("ROTEIRO 1", "VERSÃO 2", "OPÇÃO B"... ou a CENA 1 recomeçando). Separa cada um.
  function separarRoteiros(txt) {
    const linhas = String(txt || "").replace(/\r/g, "").split("\n");
    const limpa = (l) => l.replace(/\*\*|__/g, "").replace(/^#+\s*/, "").trim();
    const cab = /^(?:ROTEIRO|VERS[AÃ]O|OP[CÇ][AÃ]O|VARIA[CÇ][AÃ]O|V[IÍ]DEO|COPY)(?:\s+NOVO)?\s*(?:N[ºo°.]\s*)?(\d{1,2}|[A-E])(?![\wÀ-ú])\s*[:.)\-–—]?\s*(.*)$/i;
    let marcas = [];
    linhas.forEach((l, k) => { const m = limpa(l).match(cab); if (m) marcas.push({ k, nome: m[2].replace(/[:\-–—]\s*$/, "").trim() }); });
    if (marcas.length < 2) {   // sem títulos: a CENA 1 recomeçando abre um roteiro novo (sem nome: fica Roteiro 1, 2, 3)
      marcas = []; let viuCena = false;
      linhas.forEach((l, k) => { const t = limpa(l); if (/^CENA\s*0?1\b/i.test(t)) { marcas.push({ k, nome: "" }); viuCena = true; } });
      if (!viuCena || marcas.length < 2) marcas = [];
    }
    if (marcas.length < 2) return [{ titulo: "", ...cenasDaCopy(txt) }];
    const lista = marcas.map((m, n) => ({ titulo: m.nome, ...cenasDaCopy(linhas.slice(m.k, n + 1 < marcas.length ? marcas[n + 1].k : linhas.length).join("\n")) })).filter((r) => r.cenas.length);
    return lista.length ? lista : [{ titulo: "", ...cenasDaCopy(txt) }];
  }
  function abrirRoteiro(txt, produto, qual) {
    const roteiros = separarRoteiros(txt), n = Math.min(Math.max(0, qual || 0), roteiros.length - 1);
    const { cenas, ganchos, titulo } = roteiros[n];
    const palavras = cenas.reduce((t, c) => t + (c.fala.replace(/\[[^\]]*\]/g, "").match(/\S+/g) || []).length, 0), seg = Math.round(palavras / 3.25);
    const comCena = cenas.some((c) => c.imagem), nomeProd = String(produto || "").trim().slice(0, 60);
    const antigo = $("#roteiroCenas"); if (antigo) antigo.remove();
    const m = document.createElement("div"); m.id = "roteiroCenas"; m.className = "roteiro-tela"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Roteiro de gravação");
    const abas = roteiros.length > 1 ? `<div class="roteiro-abas" role="tablist" aria-label="Roteiros desta copy">${roteiros.map((r, k) => `<button type="button" class="chip" role="tab" data-roteiro="${k}" aria-pressed="${k === n}" aria-selected="${k === n}">Roteiro ${k + 1}${r.titulo ? " · " + esc(r.titulo.slice(0, 40)) : ""}</button>`).join("")}</div>` : "";
    m.innerHTML = `<div class="roteiro-caixa">
      <div class="roteiro-topo"><div><p class="rot">Roteiro de gravação${roteiros.length > 1 ? ` · ${n + 1} de ${roteiros.length}` : ""}</p><h2>Vídeo TikTok${nomeProd ? " · " + esc(nomeProd) : ""}${roteiros.length > 1 ? ` · Roteiro ${n + 1}` : ""}</h2>${titulo ? `<p class="sub"><b>${esc(titulo)}</b></p>` : ""}<p class="sub">${cenas.length} cenas · ~${seg}s de fala (${palavras} palavras)</p></div>
        <div class="controles"><button class="btn sec pequeno" type="button" data-acao="imprimir-roteiro">Imprimir</button><button class="btn pequeno" type="button" data-acao="fechar-roteiro">Fechar</button></div></div>
      ${abas}
      <div class="roteiro-colunas${comCena ? "" : " uma"}"><span>Áudio / fala</span>${comCena ? "<span>Imagem / cena</span>" : ""}</div>
      ${cenas.map((c, i) => `<div class="roteiro-linha${comCena ? "" : " uma"}"><div class="r-fala"><p class="rot">Fala ${i + 1}${c.parte ? " · " + esc(c.parte) : ""}</p><p>${esc(c.fala || "(sem fala)").replace(/\[([^\]]*)\]/g, '<span class="r-lacuna">[$1]</span>')}</p>${c.texto ? `<p class="r-texto">Texto na tela: <b>${esc(c.texto)}</b></p>` : ""}</div>${comCena ? `<div class="r-cena"><p class="rot">Cena ${i + 1}</p><p>${c.imagem ? esc(c.imagem) : "<i>sem cena descrita</i>"}</p></div>` : ""}</div>`).join("") || '<p class="vazio">Não achei cenas nessa copy.</p>'}
      ${ganchos.length ? `<div class="roteiro-ganchos"><p class="rot">Ganchos para testar</p><ol>${ganchos.map((g) => `<li>${esc(g)}</li>`).join("")}</ol></div>` : ""}
    </div>`;
    document.body.appendChild(m); document.body.classList.add("com-roteiro");
    m.addEventListener("click", (e) => { if (e.target === m) { m.remove(); document.body.classList.remove("com-roteiro"); } });
    m.querySelectorAll("[data-acao]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.acao === "imprimir-roteiro") window.print(); else { m.remove(); document.body.classList.remove("com-roteiro"); } }));
    m.querySelectorAll("[data-roteiro]").forEach((b) => b.addEventListener("click", () => { abrirRoteiro(txt, produto, +b.dataset.roteiro); const novo = $("#roteiroCenas"); if (novo) { novo.scrollTop = 0; const a = novo.querySelector(`[data-roteiro="${b.dataset.roteiro}"]`); if (a) a.focus(); } }));
  }
  async function telaCriar(el) {
    S.refForm = S.refForm || { modo: "mesmo", produto: "", outro: "", muda: { gancho: true, jeito: true, antecipacao: true }, sabe: "" };
    const refs = S.refs || [], prontas = refs.filter((r) => r.copy).length;
    let lista = S.refFiltro === "prontas" ? refs.filter((r) => r.copy) : refs;
    if (S.refBusca) { const b = S.refBusca.toLowerCase(); lista = lista.filter((r) => (tituloDa(r) + " " + (r.autor || "") + " " + (r.texto || "")).toLowerCase().includes(b)); }
    const r = refs.find((x) => x.id === S.refSel);
    const temClaude = !!(await usarClaude());
    el.innerHTML = `<div class="cabeca"><div><h1>Criar</h1><p>Pegue um vídeo de TikTok Shop que deu certo: mantenha a estrutura, o tom e a ordem, e troque o produto, a dor e o cenário.</p></div></div>
      <div class="grade criar">
        <div class="card"><div class="card-topo"><h2>Referências</h2><span class="sub">${refs.length}</span></div>
          <form class="form" id="formRef">
            <input class="inp" id="refLink" placeholder="Cole o link do vídeo do TikTok">
            <textarea class="inp" id="refTexto" rows="3" placeholder="O que a pessoa fala no vídeo (opcional: só com o link, o Claude transcreve)"></textarea>
            <button class="btn pequeno" type="submit">Adicionar referência</button>
          </form>
          <div class="chips" style="margin:14px 0 10px"><button class="chip" type="button" data-acao="ref-filtro" data-v="" aria-pressed="${!S.refFiltro}">Todas</button><button class="chip" type="button" data-acao="ref-filtro" data-v="prontas" aria-pressed="${S.refFiltro === "prontas"}">Com copy pronta (${prontas})</button></div>
          <input class="inp" id="refBusca" type="search" placeholder="Buscar" value="${esc(S.refBusca || "")}">
          <ul class="refs">${lista.map((x) => `<li><button type="button" data-acao="ref" data-id="${esc(x.id)}" aria-pressed="${x.id === S.refSel}">${x.copy ? '<span class="selo sobe">Copy pronta</span>' : ""}<b>${esc(tituloDa(x))}</b><small>${esc(x.autor || "")}</small></button></li>`).join("") || '<li><p class="vazio">Nenhuma referência ainda. Cole o link e o texto de um vídeo que vendeu.</p></li>'}</ul>
        </div>
        <div class="criar-dir">${r ? `
          <div class="card"><div class="card-topo"><h2>${esc(tituloDa(r))}</h2>${r.copy ? '<span class="espaco"></span><button class="btn pequeno" type="button" data-acao="ver-roteiro">Ver roteiro de gravação</button>' : ""}</div>
            <p class="sub-ref">${r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Abrir o vídeo</a>` : ""}${r.autor ? " · " + esc(r.autor) : ""}</p>
            <p class="lbl">Texto da referência</p>${r.texto ? `<div class="transcricao">${esc(r.texto)}</div>` : `<div class="aviso-texto"><b>Falta o texto do vídeo.</b> ${!r.link ? "Cole abaixo o que a pessoa fala no vídeo." : API.transcrever ? `Clique em <b>Transcrever</b>: o painel escuta o vídeo e escreve aqui. Usa 1 crédito da Supadata e leva até 3 minutos.` : `Clique em <b>Transcrever automático</b>, cole o pedido na aba Code do Claude e depois clique em <b>Atualizar</b>. O Claude baixa o vídeo, escuta e escreve aqui.`}</div>
            ${r.link ? `<div class="controles" style="margin-bottom:10px"><button class="btn pequeno" type="button" data-acao="transcrever">${API.transcrever ? "Transcrever" : "Transcrever automático"}</button>${API.transcrever ? "" : '<button class="btn sec pequeno" type="button" data-acao="atualizar-refs">Atualizar</button>'}</div>` : ""}
            <textarea class="inp" id="refTextoFalta" rows="3" placeholder="Ou cole aqui o que a pessoa fala no vídeo"></textarea>
            <div class="controles" style="justify-content:flex-end;margin-top:8px"><button class="btn sec pequeno" type="button" data-acao="salvar-texto">Salvar texto</button></div>`}</div>
          <div class="card form">
            <p class="lbl">1. Qual produto?</p>
            <div class="chips">${[["mesmo", "O mesmo do vídeo"], ["meu", "Um dos meus"], ["outro", "Outro produto"]].map(([k, n]) => `<button class="chip" type="button" data-acao="ref-modo" data-v="${k}" aria-pressed="${S.refForm.modo === k}">${n}</button>`).join("")}</div>
            ${S.refForm.modo === "meu" ? `<select class="inp" id="refProduto"><option value="">Escolha o produto</option>${nomesProdutos().map((n) => `<option${n === S.refForm.produto ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>` : ""}
            ${S.refForm.modo === "outro" ? `<input class="inp" id="refOutro" placeholder="Nome do produto" value="${esc(S.refForm.outro)}">` : ""}
            ${S.refForm.modo === "mesmo" ? `<input class="inp" id="refMesmo" placeholder="Nome do produto do vídeo (opcional, ajuda o Claude)" value="${esc(S.refForm.mesmo || "")}">` : ""}
            <p class="lbl" style="margin-top:8px">2. O que muda? <small>o resto fica igual à referência</small></p>
            <div class="muda">${MUDA.map(([k, n, d]) => `<label><input type="checkbox" data-muda="${k}"${S.refForm.muda[k] ? " checked" : ""}><span><b>${n}</b><small>${d}</small></span></label>`).join("")}</div>
            <p class="lbl" style="margin-top:8px">3. O que você sabe do produto <small>opcional: preço, diferencial, o que vem na caixa</small></p>
            <textarea class="inp" id="refSabe" rows="2" placeholder="Ex.: (preço) no carrinho, bateria de (horas), vem com (itens)">${esc(S.refForm.sabe)}</textarea>
            <div class="controles" style="justify-content:flex-end">
              ${temClaude ? `<button class="btn" type="button" data-acao="gerar"${r.texto ? "" : " disabled"}>Gerar com o Claude</button>` : ""}
              <button class="btn ${temClaude ? "sec" : ""}" type="button" data-acao="copiar-pedido"${r.texto ? "" : " disabled"}>Copiar o pedido</button>
            </div>
            ${r.texto ? "" : '<p class="frase">Cole o texto do vídeo acima para liberar os botões.</p>'}
            ${temClaude ? "" : '<p class="frase">Copie o pedido, cole no Claude e traga a resposta para a caixa Copy pronta.</p>'}
          </div>
          <div class="card"><div class="card-topo"><h2>Copy pronta</h2></div>
            <p class="frase" style="margin:0 0 8px">${temClaude ? "O Claude escreve aqui. Ajuste o que quiser e salve." : "Cole aqui o que o Claude devolveu e salve."} Fica guardado junto com a referência.</p>
            <textarea class="inp copy-pronta" id="refCopy" rows="14" placeholder="A copy aparece aqui.">${esc(S.rascunhoCopy && S.rascunhoCopy.id === r.id ? S.rascunhoCopy.v : (r.copy || ""))}</textarea>
            <div class="controles" style="justify-content:flex-end;margin-top:10px">
              <button class="link" type="button" data-acao="apagar-ref">Apagar referência</button>
              <button class="btn sec pequeno" type="button" data-acao="agenda-ref">Mandar pra agenda de hoje</button>
              <button class="btn sec pequeno" type="button" data-acao="ver-roteiro">Ver roteiro de gravação</button>
              <button class="btn pequeno" type="button" data-acao="salvar-copy">Salvar copy</button>
            </div></div>`
        : `<div class="card"><p class="vazio" style="text-align:center;padding:40px 0">Escolha uma referência ao lado pra modelar a copy.</p></div>`}</div>
      </div>`;
    $("#formRef").addEventListener("submit", async (e) => {
      e.preventDefault(); const link = $("#refLink").value.trim(), texto = $("#refTexto").value.trim();
      if (!link && !texto) { toast("Cole o link ou o texto do vídeo.", true); return; }
      const nova = { id: "r" + Date.now(), link: link.slice(0, 400), autor: autorDo(link), texto: texto.slice(0, 6000), copy: "", criado_em: new Date().toISOString() };
      try { await API.salvarReferencia(nova); S.refs = [nova, ...(S.refs || [])]; S.refSel = nova.id; telaCriar(el); toast(texto ? "Referência adicionada." : "Referência salva. Clique em Transcrever automático."); } catch (er) { toast(traduz(er), true); }
    });
    $("#refBusca").addEventListener("input", (e) => { S.refBusca = e.target.value; clearTimeout(telaCriar.t); telaCriar.t = setTimeout(() => telaCriar(el).then(() => { const b = $("#refBusca"); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }), 250); });
    if (r) {
      const p = $("#refProduto"); if (p) p.addEventListener("change", () => { S.refForm.produto = p.value; });
      const pm = $("#refMesmo"); if (pm) pm.addEventListener("input", () => { S.refForm.mesmo = pm.value.trim(); });
      const o = $("#refOutro"); if (o) o.addEventListener("input", () => { S.refForm.outro = o.value; });
      $("#refSabe").addEventListener("input", (e) => { S.refForm.sabe = e.target.value; });
      $$("[data-muda]").forEach((c) => c.addEventListener("change", () => { S.refForm.muda[c.dataset.muda] = c.checked; }));
    }
  }
  // O próprio painel pede o texto ao Claude (só funciona dentro do Claude)
  let claudeTexto;
  function usarClaude() { if (claudeTexto === undefined) claudeTexto = (window.claude && window.claude.use ? window.claude.use("sample").catch(() => null) : Promise.resolve(null)); return claudeTexto; }
  async function gerarCopy(r, botao) {
    const sample = await usarClaude(); if (!sample) return;
    const ta = $("#refCopy"); botao.disabled = true; botao.textContent = "Escrevendo...";
    try {
      const res = await sample(pedidoCopy(r), { modelTier: "default", onText: ({ text }) => { if (ta) ta.value = text || "Pensando..."; } });
      if (ta) ta.value = res.text;
      r.copy = res.text; await API.salvarReferencia(r); toast("Copy pronta e salva.");
    } catch (er) {
      toast(er && er.code === "not_granted" ? "Você não liberou o Claude nesta página. Use Copiar o pedido." : er && er.code === "rate_limited" ? "Muitos pedidos seguidos. Espere um pouco." : "Não consegui gerar agora. Tente de novo ou use Copiar o pedido.", true);
    } finally { botao.disabled = false; botao.textContent = "Gerar com o Claude"; }
  }

  const DESENHOS = { pedidos: telaPedidos, criar: telaCriar, hoje: telaHoje, resultados: telaResultados, produtos: telaProdutos, videos: telaVideos, amostras: telaAmostras, importar: telaImportar, perfil: telaPerfil };

  /* =============================================================
     CLIQUES (um ouvinte só para o painel)
     ============================================================= */
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-tela],[data-acao]"); if (!t || !$("#app").contains(t)) return;
    if (t.dataset.tela) { irPara(t.dataset.tela); return; }
    const a = t.dataset.acao, id = Number(t.dataset.id);
    try {
      if (a === "ap-estilo") { S.ap.estilo = t.dataset.v; desenharAparencia(); }
      else if (a === "ap-aba") { S.ap.aba = t.dataset.v; desenharAparencia(); }
      else if (a === "ap-paleta") { S.ap.cor = t.dataset.v; S.ap.custom = null; desenharAparencia(); }
      else if (a === "ap-sem-custom") { S.ap.custom = null; desenharAparencia(); }
      else if (a === "ap-aplicar") { t.disabled = true; const ok = await salvarAparencia(S.ap.estilo, S.ap.cor, S.ap.custom); montarMenu(); desenharAparencia(); if (ok) toast(`${ESTILOS[S.ap.estilo][0]} com ${PALETAS[S.ap.cor][0]} aplicado.`); }
      else if (a === "ap-restaurar") { S.ap = { ...APARENCIA_PADRAO }; const ok = await salvarAparencia(S.ap.estilo, S.ap.cor, null); desenharAparencia(); if (ok) toast("Aparência padrão restaurada."); }
      else if (a === "usar-sugestao") {
        const sg = sugestaoMeta(); if (!sg) return; await salvarMeta(sg.valor); toast(`Meta de ${real(sg.valor)} salva${temContas() ? " para " + nomeConta(contaAtiva()) : ""}.`); irPara(S.tela);
      } else if (a === "periodo") { S.mes = t.dataset.v === "tudo" ? "tudo" : (S.ultimo || hojeISO()).slice(0, 7); irPara("resultados");
      } else if (a === "mes") { S.mes = mesDesloca(S.mes, +t.dataset.n); irPara("resultados"); }
      else if (a === "passo") {
        const k = t.dataset.k, passos = { ...(S.perfil.passos || {}) }; passos[k] = !passos[k];
        await API.salvarPerfil({ passos }); S.perfil.passos = passos; irPara("hoje");
      } else if (a === "ref") { S.refSel = t.dataset.id; irPara("criar"); }
      else if (a === "ref-filtro") { S.refFiltro = t.dataset.v; irPara("criar", true); }
      else if (a === "ref-modo") { const ta = $("#refCopy"); if (ta) S.rascunhoCopy = { id: S.refSel, v: ta.value }; S.refForm.modo = t.dataset.v; irPara("criar", true); }
      else if (a === "atualizar-refs") { S.refs = await API.referencias(); const r2 = S.refs.find((x) => x.id === S.refSel); toast(r2 && r2.texto ? "Texto chegou. Agora é só gerar." : "Ainda sem texto. Espere o Claude terminar e clique de novo."); irPara("criar", true); }
      else if (a === "fechar-roteiro") { const m = $("#roteiroCenas"); if (m) m.remove(); document.body.classList.remove("com-roteiro"); }
      else if (a === "imprimir-roteiro") { window.print(); }
      else if (a === "gerar" || a === "copiar-pedido" || a === "salvar-copy" || a === "agenda-ref" || a === "apagar-ref" || a === "salvar-texto" || a === "transcrever" || a === "ver-roteiro") {
        const r = (S.refs || []).find((x) => x.id === S.refSel); if (!r) return;
        if (a === "ver-roteiro") {
          const txt = ($("#refCopy") && $("#refCopy").value) || r.copy || "";
          if (!txt.trim()) { toast("Ainda não tem copy. Gere ou cole a copy primeiro.", true); return; }
          const f = S.refForm, prod = (f.modo === "meu" ? f.produto : f.modo === "outro" ? f.outro : f.mesmo) || "";
          abrirRoteiro(txt, prod); return;
        }
        if (a === "transcrever" && API.transcrever) {
          t.disabled = true; const rot = t.textContent; toast("Ouvindo o vídeo. Leva até 3 minutos, pode deixar a aba aberta.");
          const res = await API.transcrever(r.link, (seg) => { t.textContent = `Ouvindo... ${seg}s`; });
          if (res && res.texto) { r.texto = String(res.texto).slice(0, 6000); await API.salvarReferencia(r); toast("Texto pronto. Confira e clique em Copiar o pedido."); }
          else { t.disabled = false; t.textContent = rot; toast((res && res.erro) || "Não deu para transcrever.", true); }
          irPara("criar", true); return;
        }
        if (a === "transcrever") {
          const txt = "Transcreva as referências do meu painel (aba Criar) que estão sem texto.";
          try { await navigator.clipboard.writeText(txt); } catch (_) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (__) {} ta.remove(); }
          toast("Pedido copiado. Cole na aba Code do Claude e depois clique em Atualizar."); return;
        }
        if (a === "salvar-texto") { const tx = ($("#refTextoFalta").value || "").trim(); if (!tx) { toast("Cole o texto do vídeo.", true); return; } r.texto = tx.slice(0, 6000); await API.salvarReferencia(r); toast("Texto salvo. Agora é só gerar."); irPara("criar", true); return; }
        if ((a === "gerar" || a === "copiar-pedido") && !r.texto) { toast("Falta o texto do vídeo. Cole o que a pessoa fala.", true); return; }
        if (a === "gerar") await gerarCopy(r, t);
        else if (a === "copiar-pedido") { const txt = pedidoCopy(r); try { await navigator.clipboard.writeText(txt); toast("Pedido copiado. Cole no Claude."); } catch (_) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Pedido copiado. Cole no Claude."); } catch (__) { toast("Não consegui copiar.", true); } ta.remove(); } }
        else if (a === "salvar-copy") { r.copy = $("#refCopy").value; await API.salvarReferencia(r); toast("Copy salva."); S.rascunhoCopy = null; irPara("criar", true); }
        else if (a === "agenda-ref") {
          const f = S.refForm, produto = f.modo === "meu" ? f.produto : f.modo === "outro" ? f.outro : (f.mesmo || "");
          const nome = (produto || tituloDa(r)).slice(0, 300); r.copy = $("#refCopy").value; await API.salvarReferencia(r);
          await API.novosVideos([{ data: hojeISO(), hora: null, produto: nome, status: "rascunho" }]); S.videosHoje = await API.videos(hojeISO(), hojeISO()); toast("Mandado pra agenda de hoje.");
        } else if (a === "apagar-ref") { await API.apagarReferencia(r.id); S.refs = S.refs.filter((x) => x.id !== r.id); S.refSel = null; toast("Referência apagada."); irPara("criar"); }
      }
      else if (a === "cat") { S.filtroCat = t.dataset.cat; irPara("produtos"); }
      else if (a === "ped-per") { S.pedPer = t.dataset.v; irPara("pedidos", true); }
      else if (a === "ped-filtro") { S.pedFiltro = t.dataset.v; irPara("pedidos", true); }
      else if (a === "esgotado") { await marcarEsgotado(t.dataset.id, true); }
      else if (a === "lembrete-ligar") { t.disabled = true; try { await ativarLembrete(+$("#lembreteHora").value || 8); toast("Lembrete ligado. Mandei uma notificação de teste agora."); } catch (er) { toast(er.message || traduz(er), true); } irPara(S.tela, true); }
      else if (a === "lembrete-testar") { try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (!sub) throw new Error("O lembrete não está ligado neste celular."); await chamarLembrete("testar", { endpoint: sub.endpoint }); toast("Mandei. Deve chegar em alguns segundos."); } catch (er) { toast(er.message || traduz(er), true); } }
      else if (a === "lembrete-desligar") { await desligarLembrete(); toast("Lembrete desligado neste celular."); irPara(S.tela, true); }
      else if (a === "conta-add") { const l = lerRascContas(); l.push({ id: novoIdConta(l), nome: "", meta: null }); S.rascContas = l; desenharContas(); const ult = $$("#cardContas [data-conta-nome]").pop(); if (ult) ult.focus(); }
      else if (a === "conta-remover") { const l = lerRascContas(); l.splice(+t.dataset.k, 1); S.rascContas = l; desenharContas(); }
      else if (a === "conta-salvar") {
        const l = lerRascContas().map((c) => { let n = (c.nome || "").trim(); if (n && n[0] !== "@") n = "@" + n; return { id: c.id, nome: n, ...(c.meta ? { meta: c.meta } : {}) }; }).filter((c) => c.nome);
        const tinha = temContas();
        await API.salvarPerfil({ contas: l }); S.perfil.contas = l; S.rascContas = null;
        if (!l.length) S.conta = ""; else if (!tinha || (S.conta !== "*" && S.conta !== "" && !l.some((c) => c.id === S.conta))) S.conta = "*";
        try { localStorage.setItem(chaveConta(), S.conta); } catch (_) {}
        reprocessar(); [S.amostras, S.videosHoje] = await Promise.all([API.amostras(), API.videos(hojeISO(), hojeISO())]);
        montarMenu(); desenharContas(); toast(l.length ? `${plural(l.length + 1, "perfil", "perfis")} no painel. Troque no menu.` : "Voltou a ter um perfil só.");
      }
      else if (a === "instalar-app") { if (pedidoInstalar) { pedidoInstalar.prompt(); try { await pedidoInstalar.userChoice; } catch (_) {} pedidoInstalar = null; irPara(S.tela, true); } }
      else if (a === "fechar-instalar") { marcarDia("painel-sem-instalar"); irPara(S.tela, true); }
      else if (a === "fechar-lembrete") { marcarDia("painel-sem-lembrete"); irPara(S.tela, true); }
      else if (a === "desfazer-esgotado") { await marcarEsgotado(t.dataset.id, false); }
      else if (a === "lancar-plano") { t.disabled = true; await lancarPlano(); }
      else if (a === "sug-lancar") { t.disabled = true; await lancarPlano(S.diaVideos); }
      else if (a === "sug-add") { const x = (S._sug || [])[+t.dataset.k]; if (x) { t.disabled = true; await lancarPlano(S.diaVideos, [x]); } }
      else if (a === "status-video") {
        const lista = S.tela === "videos" ? S.videosDia : S.videosHoje, v = lista.find((x) => x.id === id); if (!v) return;
        const prox = { rascunho: "agendado", agendado: "postado", postado: "rascunho" }[v.status];
        await API.mudarVideo(id, { status: prox }); v.status = prox;
        const h = S.videosHoje.find((x) => x.id === id); if (h) h.status = prox;
        irPara(S.tela);
      } else if (a === "apagar-video") {
        await API.apagarVideo(id); S.videosHoje = S.videosHoje.filter((x) => x.id !== id); irPara(S.tela);
      } else if (a === "apagar-amostra") {
        await API.apagarAmostra(id); S.amostras = S.amostras.filter((x) => x.id !== id); montarMenu(); irPara("amostras");
      }
    } catch (er) { console.error(er); toast(traduz(er), true); }
  });
  document.addEventListener("change", async (e) => {
    const t = e.target; if (!t.dataset || !t.dataset.acao) return;
    try {
      if (t.dataset.acao === "mudar-cat") {
        const pid = t.dataset.id, [categoria, subcategoria] = t.value.split("|"), mud = { categoria, subcategoria: subcategoria || "" };
        await API.salvarProduto({ produto_id: pid, ...mud });
        S.produtos[pid] = { ...(S.produtos[pid] || { produto_id: pid }), ...mud }; reprocessar(); toast("Categoria salva.");
      } else if (t.dataset.acao === "decisao") {
        const id = Number(t.dataset.id); await API.mudarAmostra(id, { decisao: t.value });
        const am = S.amostras.find((x) => x.id === id); if (am) am.decisao = t.value; montarMenu(); toast("Decisão salva.");
      }
    } catch (er) { toast(traduz(er), true); }
  });

  /* ---------- Menu no celular ---------- */
  function fecharMenu() { $("#menu").classList.remove("aberto"); $("#veu").hidden = true; }
  $("#abrirMenu").addEventListener("click", () => { $("#menu").classList.add("aberto"); $("#veu").hidden = false; });
  $("#veu").addEventListener("click", fecharMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#menu").classList.contains("aberto")) { fecharMenu(); $("#abrirMenu").focus(); } });

  /* ---------- Menu recolhido (computador): guarda a escolha de cada usuário ---------- */
  const chaveMenu = () => "painel-menu-recolhido:" + ((S.user && S.user.id) || "anon");
  function aplicarMenuRecolhido(sim) {
    $("#app").classList.toggle("recolhido", !!sim);
    const b = $("#alternaMenu"); b.setAttribute("aria-expanded", String(!sim)); b.setAttribute("aria-label", sim ? "Abrir menu" : "Recolher menu");
    esconderDica();
  }
  function lerMenuRecolhido() {
    try { const v = localStorage.getItem(chaveMenu()); if (v !== null) return v === "1"; } catch (_) {}
    return !!(S.perfil && S.perfil.menu_recolhido);
  }
  $("#selConta").addEventListener("change", (e) => { trocarConta(e.target.value); });
  $("#alternaMenu").addEventListener("click", () => {
    const sim = !$("#app").classList.contains("recolhido");
    aplicarMenuRecolhido(sim);
    try { localStorage.setItem(chaveMenu(), sim ? "1" : "0"); } catch (_) {}
    if (S.perfil) { S.perfil.menu_recolhido = sim; API.salvarPerfil({ menu_recolhido: sim }).catch(() => {}); }   // na conta também (se o banco já tiver a coluna)
  });
  // Dica com o nome do item quando o menu está recolhido (fica fora do menu para não ser cortada)
  const dica = document.createElement("div"); dica.className = "dica-menu"; dica.hidden = true; dica.setAttribute("role", "tooltip"); document.body.appendChild(dica);
  function esconderDica() { dica.hidden = true; }
  function mostrarDica(el) {
    if (!$("#app").classList.contains("recolhido") || window.innerWidth <= 900 || !el.dataset.dica) return esconderDica();
    const r = el.getBoundingClientRect();
    dica.textContent = el.dataset.dica; dica.style.left = (r.right + 12) + "px"; dica.style.top = (r.top + r.height / 2) + "px"; dica.hidden = false;
  }
  $("#menu").addEventListener("mouseover", (e) => { const el = e.target.closest("[data-dica]"); if (el) mostrarDica(el); else esconderDica(); });
  $("#menu").addEventListener("mouseleave", esconderDica);
  $("#menu").addEventListener("focusin", (e) => { const el = e.target.closest("[data-dica]"); if (el) mostrarDica(el); });
  $("#menu").addEventListener("focusout", esconderDica);
  $("#menu").addEventListener("scroll", esconderDica);
  $("#menu").addEventListener("click", esconderDica);

  /* =============================================================
     ENTRADA: entrar, criar conta, esqueci a senha
     ============================================================= */
  function modoEntrada(m) {
    $$(".abas-entrada button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.modo === m)));
    $(".abas-entrada").hidden = m === "esqueci" || m === "nova";
    $("#formEntrar").hidden = m !== "entrar"; $("#formCriar").hidden = m !== "criar"; $("#formEsqueci").hidden = m !== "esqueci"; $("#formNovaSenha").hidden = m !== "nova";
    $("#entradaOk").hidden = true; $$(".entrada .erro").forEach((x) => { x.textContent = ""; });
  }
  $$(".entrada [data-modo]").forEach((b) => b.addEventListener("click", () => modoEntrada(b.dataset.modo)));
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  async function comBotao(form, fn) { const b = $("button[type=submit]", form), txt = b.textContent; b.disabled = true; b.textContent = "Aguarde..."; try { await fn(); } finally { b.disabled = false; b.textContent = txt; } }
  function okEntrada(t) { const e = $("#entradaOk"); e.textContent = t; e.hidden = false; }

  $("#formEntrar").addEventListener("submit", (ev) => { ev.preventDefault(); const f = ev.target; comBotao(f, async () => {
    const email = $("#eEmail").value.trim(), senha = $("#eSenha").value;
    if (!DEMO && (!emailOk(email) || !senha)) { $("#eErro").textContent = "Coloque seu e-mail e sua senha."; return; }
    try { S.user = await API.entrar(email, senha); await abrirPainel(); } catch (e) { $("#eErro").textContent = traduz(e); }
  }); });

  $("#formCriar").addEventListener("submit", (ev) => { ev.preventDefault(); const f = ev.target; comBotao(f, async () => {
    const erro = $("#cErro"), nome = $("#cNome").value.trim(), email = $("#cEmail").value.trim(), whats = $("#cWhats").value.replace(/\D/g, ""), senha = $("#cSenha").value;
    let tiktok = $("#cTiktok").value.trim();
    if (nome.length < 2) { erro.textContent = "Coloque seu nome."; return; }
    if (!emailOk(email)) { erro.textContent = "Confira o e-mail: falta o @ ou o final (ex.: .com)."; return; }
    if (whats.length < 10 || whats.length > 13) { erro.textContent = "Coloque o WhatsApp com DDD (ex.: 27912345678)."; return; }
    if (tiktok.replace("@", "").length < 2) { erro.textContent = "Coloque seu @ do TikTok."; return; }
    if (senha.length < 8) { erro.textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
    if (!$("#cAceite").checked) { erro.textContent = "Marque a caixinha de avisos para criar a conta."; return; }
    if (tiktok[0] !== "@") tiktok = "@" + tiktok;
    try {
      const u = await API.cadastrar({ nome: nome.slice(0, 120), email, whatsapp: whats, tiktok: tiktok.slice(0, 60), senha, aceite: true });
      if (u) { S.user = u; await abrirPainel(); }
      else { modoEntrada("entrar"); $("#eEmail").value = email; okEntrada(`Conta criada. Enviamos um link para ${email}: abra para confirmar e depois entre aqui.`); }
    } catch (e) { erro.textContent = traduz(e); }
  }); });

  $("#formEsqueci").addEventListener("submit", (ev) => { ev.preventDefault(); const f = ev.target; comBotao(f, async () => {
    const email = $("#rEmail").value.trim(); if (!emailOk(email)) { $("#rErro").textContent = "Confira o e-mail."; return; }
    try { await API.recuperar(email); modoEntrada("entrar"); okEntrada(`Se ${email} tiver conta, o link para criar a senha nova chega em alguns minutos.`); } catch (e) { $("#rErro").textContent = traduz(e); }
  }); });

  $("#formNovaSenha").addEventListener("submit", (ev) => { ev.preventDefault(); const f = ev.target; comBotao(f, async () => {
    const s = $("#nSenha").value; if (s.length < 8) { $("#nErro").textContent = "A senha precisa ter pelo menos 8 caracteres."; return; }
    try { await API.novaSenha(s); toast("Senha nova salva."); await abrirPainel(); } catch (e) { $("#nErro").textContent = traduz(e); }
  }); });

  $("#sair").addEventListener("click", async () => { await API.sair(); S.user = null; mostrarEntrada(); });

  function mostrarEntrada(modo = "entrar") { $("#app").hidden = true; $("#entrada").hidden = false; modoEntrada(modo); $("#demoEntrada").hidden = !DEMO; }
  async function abrirPainel() {
    $("#entrada").hidden = true; $("#app").hidden = false; $("#faixaDemo").hidden = !DEMO;
    $("#conteudo").innerHTML = '<p class="vazio">Carregando seus dados...</p>';
    try { await carregarTudo(); } catch (e) { console.error(e); $("#conteudo").innerHTML = `<div class="aviso">Não consegui carregar seus dados: ${esc(traduz(e))}</div>`; return; }
    const pedida = location.hash.slice(1);
    irPara(DESENHOS[pedida] ? pedida : "hoje");
  }

  /* ---------- Início ---------- */
  (async () => {
    let recuperando = /type=recovery/.test(location.hash);
    API.aoMudar((ev) => { if (ev === "PASSWORD_RECOVERY") { recuperando = true; mostrarEntrada("nova"); } });
    try {
      const s = await API.sessao();
      if (recuperando) { mostrarEntrada("nova"); return; }
      if (s) { S.user = s; await abrirPainel(); } else mostrarEntrada();
    } catch (e) { console.error(e); mostrarEntrada(); }
  })();
})();
