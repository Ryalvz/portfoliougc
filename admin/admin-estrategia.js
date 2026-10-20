/* =============================================================
   ADMIN, PARTE 2: estratégia do Instagram, carrossel, roteiros na
   minha voz e DNA do perfil. Fica separado do admin.js porque o
   arquivo único ficou grande demais para o upload do GitHub.
   Usa as funções e variáveis do admin.js (carregado antes).
   ============================================================= */
/* =============================================================
   INSTAGRAM: ESTRATÉGIA
   A aba Instagram ganhou 4 partes:
     📊 Métricas        (o que já existia)
     🔥 Reels da semana  os 30 reels com mais views do seu nicho (Apify, grátis)
     🧭 Plano da semana  pesquisa de mercado + o que postar (pedido pronto para o Claude)
     🎨 Carrossel        o seu sistema visual e o gerador de imagens
   ============================================================= */
const igx = { sub: "metricas", pesq: null, reels: null, buscando: false, timer: null, planos: null, semanaVista: "", carrosseis: null, car: null };
try { igx.sub = localStorage.getItem("ig-sub") || "metricas"; } catch (_) {}
const SUBS_IG = [["metricas", "📊 Métricas"], ["reels", "🔥 Reels da semana"], ["plano", "🧭 Plano da semana"], ["carrossel", "🎨 Carrossel"]];

function segundaISO(base) {
  const d = base ? deISO(base) : new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoLocal(d);
}

function desenharInstagram(el) {
  if (!SUBS_IG.some(([k]) => k === igx.sub)) igx.sub = "metricas";
  el.innerHTML = `<div class="chips ig-subs" role="tablist" aria-label="Partes do Instagram">${SUBS_IG.map(([k, n]) => `<button class="chip" type="button" role="tab" data-ig-sub="${k}" aria-pressed="${igx.sub === k}">${n}</button>`).join("")}</div><div id="ig-corpo"></div>`;
  $$("[data-ig-sub]", el).forEach((b) => b.onclick = () => {
    igx.sub = b.dataset.igSub;
    try { localStorage.setItem("ig-sub", igx.sub); } catch (_) {}
    desenhar();
  });
  const corpo = $("#ig-corpo", el);
  if (igx.sub !== "reels" && igx.timer) { clearTimeout(igx.timer); igx.timer = null; }
  if (igx.sub === "reels") return desenharReelsSemana(corpo);
  if (igx.sub === "plano") return desenharPlanoSemana(corpo);
  if (igx.sub === "carrossel") return desenharCarrossel(corpo);
  return desenharMetricasInstagram(corpo);
}

/* ---------- 🔥 Reels da semana ---------- */
async function chamarTendencias(corpo) {
  const { data, error } = await db.functions.invoke("tendencias", { body: corpo });
  if (error) {
    const st = error.context && error.context.status;
    throw new Error(st === 404 ? "O ajudante \"tendencias\" ainda não foi publicado no Supabase." : "O ajudante de tendências não respondeu. Tente de novo em instantes.");
  }
  return data || {};
}
async function carregarReels() {
  const { data, error } = await db.from("ig_reels").select("*").order("semana", { ascending: false }).order("views", { ascending: false }).limit(300);
  if (error) { igx.reels = []; igx.faltaBanco = true; return; }
  igx.faltaBanco = false;
  igx.reels = data || [];
}
async function atualizarPesquisa(acao) {
  try {
    const r = await chamarTendencias({ acao: acao || "status" });
    igx.pesq = r;
    if (r.guardados) { await carregarReels(); avisar(`Pronto! ${r.guardados} reels guardados.`); }
    if (acao === "buscar" && r.erro && !r.semChave) avisar(r.erro, true);
  } catch (e) { igx.pesq = { erro: e.message }; }
  if (abaAtual === "instagram" && igx.sub === "reels") desenhar();
  // Enquanto o Apify trabalha, confere de 15 em 15 segundos
  clearTimeout(igx.timer); igx.timer = null;
  if (igx.pesq && igx.pesq.rodando && abaAtual === "instagram" && igx.sub === "reels") igx.timer = setTimeout(() => atualizarPesquisa(), 15000);
}

function desenharReelsSemana(el) {
  if (igx.reels === null) { el.innerHTML = `<p class="vazio">Abrindo os reels da semana...</p>`; carregarReels().then(() => { if (!igx.pesq) atualizarPesquisa(); else desenhar(); }); return; }
  if (igx.faltaBanco) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 27 do banco.sql no Supabase.</div>`; return; }
  const p = igx.pesq || {};
  const cfg = p.config || {};
  const semanas = [...new Set(igx.reels.map((r) => r.semana))];
  if (!igx.semanaVista || !semanas.includes(igx.semanaVista)) igx.semanaVista = semanas[0] || "";
  const lista = igx.reels.filter((r) => r.semana === igx.semanaVista).sort((a, b) => n2(b.views) - n2(a.views));
  const u = p.uso;
  const usoHtml = u ? `<div class="ig-uso" title="Plano grátis do Apify: quando acaba, ele bloqueia até o mês seguinte, sem cobrar nada.">
      <span>Crédito grátis do mês: <b>US$ ${u.usado.toFixed(2).replace(".", ",")}</b> de US$ ${u.total.toFixed(2).replace(".", ",")} usados</span>
      <span class="lb-trilho"><i style="width:${Math.min(100, (u.usado / (u.total || 5)) * 100)}%"></i></span></div>` : "";

  // O que se repete nos que mais bombaram
  const top10 = lista.slice(0, 10);
  const comDur = top10.filter((x) => n2(x.duracao));
  const durs = comDur.map((x) => n2(x.duracao)).sort((a, b) => a - b);
  const durMedia = durs.length ? Math.round(durs.length % 2 ? durs[(durs.length - 1) / 2] : (durs[durs.length / 2 - 1] + durs[durs.length / 2]) / 2) : 0;
  const perfis = {}; lista.forEach((x) => { if (x.perfil) perfis[x.perfil] = (perfis[x.perfil] || 0) + 1; });
  const perfisTop = Object.entries(perfis).sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1).slice(0, 4);
  const tags = {}; lista.forEach((x) => (String(x.legenda || "").match(/#[\p{L}\d_]+/gu) || []).forEach((t) => { t = t.toLowerCase(); tags[t] = (tags[t] || 0) + 1; }));
  const tagsTop = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 8);

  el.innerHTML = `
    <section class="cartao ig-estr-topo">
      <div><h2 class="rot-titulo">🔥 Reels da semana</h2>
        <p class="rot-frase">Os ${QUANTOS_REELS} reels com mais views nas hashtags do seu nicho. Toda segunda de manhã a lista se atualiza sozinha e chega uma notificação no celular.</p>
        ${usoHtml}</div>
      <div class="ig-estr-acoes">
        ${semanas.length > 1 ? `<select class="campo" id="ig-semana" aria-label="Semana">${semanas.map((s) => `<option value="${s}" ${s === igx.semanaVista ? "selected" : ""}>Semana de ${dataBR(s).slice(0, 5)}</option>`).join("")}</select>` : ""}
        <button class="btn" type="button" id="ig-hashtags">⚙️ Hashtags</button>
        <button class="btn primario" type="button" id="ig-buscar" ${p.rodando || p.semChave ? "disabled" : ""}>${p.rodando ? "Buscando..." : "🔎 Buscar agora"}</button>
      </div>
    </section>
    ${p.semChave ? `<div class="cartao ig-passos">
      <h3 class="pro-titulo">Falta só ligar o Apify (grátis, sem cartão)</h3>
      <ol class="passos">
        <li>Crie uma conta em <a href="https://console.apify.com/sign-up" target="_blank" rel="noopener"><b>apify.com</b></a>. Pode entrar com o Google. Não pede cartão.</li>
        <li>No Apify, abra <b>Settings</b> e depois <b>API &amp; Integrations</b>. Copie o <b>Personal API token</b>.</li>
        <li>No <a href="https://supabase.com/dashboard/project/jlehawiwklvyvrzbfuiu/functions/secrets" target="_blank" rel="noopener"><b>Supabase</b></a>, em <b>Edge Functions</b> e depois <b>Secrets</b>, crie um segredo com o nome <code>APIFY_TOKEN</code> e cole o token como valor.</li>
        <li>Volte aqui e toque em <b>Buscar agora</b>.</li>
      </ol>
      <p class="sub">O plano grátis dá US$ 5 por mês e cada busca semanal gasta uns US$ 0,40. Quando o crédito acaba, o Apify só para até o mês seguinte: não cobra nada. A chave fica só no cofre do Supabase.</p>
      <button class="btn" type="button" id="ig-conferir">Já colei, conferir</button>
    </div>` : ""}
    ${p.erro && !p.semChave ? `<div class="aviso-falta">${esc(p.erro)}</div>` : ""}
    ${cfg.erro ? `<div class="aviso-falta">${esc(cfg.erro)}</div>` : ""}
    ${p.rodando ? `<div class="rot-aviso-caixa">⏳ O Apify está vasculhando ${esc((cfg.hashtags || []).map((h) => "#" + h).join(", "))}. Leva de 2 a 5 minutos. Pode sair desta tela, a lista fica guardada.</div>` : ""}
    ${lista.length ? `
      <div class="grade-fin tres ig-padroes">
        <div class="cartao"><h3 class="pro-titulo">Duração que mais rende</h3><p class="ig-num-grande">${durMedia ? durMedia + " s" : "?"}</p><p class="sub">a duração do meio entre os 10 reels com mais views</p></div>
        <div class="cartao"><h3 class="pro-titulo">Hashtags que se repetem</h3><p>${tagsTop.map(([t, n]) => `<span class="pilula">${esc(t)} <span class="sub">${n}</span></span>`).join(" ") || '<span class="sub">poucas hashtags nas legendas</span>'}</p></div>
        <div class="cartao"><h3 class="pro-titulo">Perfis para acompanhar</h3><p>${perfisTop.map(([pf, n]) => `<a class="pilula" href="https://www.instagram.com/${esc(pf.slice(1))}/" target="_blank" rel="noopener">${esc(pf)} <span class="sub">${n} reels</span></a>`).join(" ") || '<span class="sub">nenhum perfil apareceu mais de uma vez</span>'}</p></div>
      </div>
      <div class="ig-reels">${lista.map((r, i) => `
        <article class="ig-reel">
          <a class="ig-reel-capa" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Assistir no Instagram">
            ${r.capa ? `<img src="${esc(r.capa)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}
            <span class="ig-reel-pos">${i + 1}</span>
            <span class="ig-reel-views">▶ ${compacto(r.views)}</span>
          </a>
          <div class="ig-reel-info">
            <b>${esc(r.perfil || "")}</b>
            <small class="sub">${r.postado_em ? new Date(r.postado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : ""}${n2(r.duracao) ? " · " + Math.round(r.duracao) + " s" : ""} · ❤ ${compacto(r.curtidas)} · 💬 ${compacto(r.comentarios)}</small>
            <p class="ig-legenda">${esc(String(r.legenda || "Sem legenda").slice(0, 140))}</p>
            <div class="ig-reel-acoes">
              <a class="btn pequeno" href="${esc(r.url)}" target="_blank" rel="noopener">▶ Assistir</a>
              <button class="btn pequeno" type="button" data-reel-rot="${esc(r.id)}" ${S.transcricoes.some((t) => t.link && String(t.link).split("?")[0] === r.url) ? "disabled" : ""}>${S.transcricoes.some((t) => t.link && String(t.link).split("?")[0] === r.url) ? "✓ Nos Roteiros" : "📜 Roteiros"}</button>
            </div>
          </div>
        </article>`).join("")}</div>
      <p class="sub" style="margin-top:12px">Guardado em ${dataBR(igx.semanaVista)}${cfg.coletado_em && igx.semanaVista === semanas[0] ? ` às ${new Date(cfg.coletado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}. As capas vêm do Instagram e podem sumir depois de alguns dias, o link continua funcionando.</p>`
    : !p.semChave && !p.rodando ? `<p class="vazio">Ainda não tem reels guardados. Toque em <b>Buscar agora</b>.</p>` : ""}`;

  const sem = $("#ig-semana"); if (sem) sem.onchange = (e) => { igx.semanaVista = e.target.value; desenhar(); };
  const conf = $("#ig-conferir"); if (conf) conf.onclick = () => { igx.pesq = null; el.innerHTML = `<p class="vazio">Conferindo...</p>`; atualizarPesquisa(); };
  $("#ig-buscar").onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = "Começando...";
    await atualizarPesquisa("buscar");
  };
  $("#ig-hashtags").onclick = () => formHashtags(cfg);
  $$("[data-reel-rot]", el).forEach((b) => b.onclick = async () => {
    const r = lista.find((x) => String(x.id) === b.dataset.reelRot);
    if (!r) return;
    b.disabled = true; b.textContent = "Salvando...";
    const dados = { link: r.url, plataforma: "instagram", categoria: "organico", status: "ideia", titulo: String(r.legenda || "").split("\n")[0].replace(/#\S+/g, "").trim().slice(0, 70) || `Reel de ${r.perfil || "referência"}`,
      de_quem: "outra", perfil: r.perfil, legenda: r.legenda, postado_em: r.postado_em ? String(r.postado_em).slice(0, 10) : null, tags: ["reels-da-semana"], andamento: "processando" };
    const limpo = {}; Object.keys(dados).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = dados[k]; });
    const { data, error } = await db.from("transcricoes").insert(limpo).select("id").single();
    if (error) { avisar(traduzErro(error), true); b.disabled = false; b.textContent = "📜 Roteiros"; return; }
    await recarregar("transcricoes");
    const novo = S.transcricoes.find((x) => String(x.id) === String(data.id));
    if (novo) transcreverVideo(novo);
    avisar("Salvo nos Roteiros. A transcrição chega em instantes (usa 1 crédito da Supadata).");
  });
}
const QUANTOS_REELS = 30;

function formHashtags(cfg) {
  const d = abrirJanelaSimples("⚙️ Hashtags vasculhadas", `
    <p class="sub" style="margin-top:0">Uma por linha, sem o #. Misture as do seu nicho (UGC) com as de tech, beleza, moda e fitness. Até 12.</p>
    <textarea class="campo" id="hx-lista" rows="8" style="width:100%">${esc((cfg.hashtags || []).join("\n"))}</textarea>
    <label class="pro-rotulo" for="hx-por">Reels por hashtag</label>
    <input class="campo" id="hx-por" type="number" min="5" max="60" value="${esc(cfg.por_hashtag || 25)}">
    <p class="sub" id="hx-custo"></p>`,
    `<button type="button" class="btn primario" data-salvar>Salvar</button>`);
  const custo = () => {
    const n = $("#hx-lista", d).value.split(/\s|,/).filter(Boolean).length, por = Number($("#hx-por", d).value) || 25;
    const us = (n * por * 2.6) / 1000;
    $("#hx-custo", d).textContent = `Cada busca: até ${n * por} reels, uns US$ ${us.toFixed(2).replace(".", ",")}. Uma por semana dá uns US$ ${(us * 4.3).toFixed(2).replace(".", ",")} no mês (o grátis é US$ 5).`;
  };
  custo();
  $("#hx-lista", d).oninput = custo; $("#hx-por", d).oninput = custo;
  $("[data-salvar]", d).onclick = async () => {
    const lista = $("#hx-lista", d).value.split(/[\s,]+/).map((x) => x.replace(/^#/, "")).filter(Boolean);
    try {
      const r = await chamarTendencias({ acao: "hashtags", hashtags: lista, por_hashtag: Number($("#hx-por", d).value) || 25 });
      if (r.erro) { avisar(r.erro, true); return; }
      d.close(); avisar("Hashtags salvas. Valem a partir da próxima busca.");
      if (igx.pesq) igx.pesq.config = { ...(igx.pesq.config || {}), hashtags: r.hashtags, por_hashtag: r.por_hashtag };
      desenhar();
    } catch (e) { avisar(e.message, true); }
  };
}

/* ---------- 🧭 Plano da semana ---------- */
const DIAS_PLANO = [["SEG", 0, "Segunda"], ["TER", 1, "Terça"], ["QUA", 2, "Quarta"], ["QUI", 3, "Quinta"], ["SEX", 4, "Sexta"], ["SAB", 5, "Sábado"], ["DOM", 6, "Domingo"]];
const NICHO_PADRAO = "Sou o Ryan (@ryalvz), creator UGC no Brasil. Meu Instagram mistura duas coisas: bastidores de UGC (como fechar com marcas, quanto cobrar, rotina, gravação, edição) e conteúdo de produtos na vida real (tech e apps, beleza, moda e fitness). Quero crescer, atrair marcas e ter constância.";

async function carregarPlanos() {
  const [a, b] = await Promise.all([
    db.from("ig_planos").select("*").order("semana", { ascending: false }).limit(20),
    igx.reels === null ? carregarReels() : Promise.resolve(),
    carregarDna()
  ]);
  igx.planos = a.error ? [] : a.data || [];
  igx.faltaPlanos = !!a.error;
  // O que acontece em cada semana (aniversário, viagem, evento...): o plano respeita isso
  igx.contextos = {};
  try { const { data } = await db.from("preferencias").select("chave,valor").like("chave", "semana_%"); (data || []).forEach((p) => { igx.contextos[p.chave.slice(7)] = p.valor; }); } catch (_) {}
}
const C_INFO = {
  conhecer: { nome: "Conhecer", cls: "p-conhecer", cta: "seguir ou compartilhar", metrica: "alcance e seguidores novos" },
  conectar: { nome: "Conectar", cls: "p-conectar", cta: "salvar ou comentar", metrica: "salvamentos, comentários e tempo assistido" },
  converter: { nome: "Converter", cls: "p-converter", cta: "uma ação só: portfólio ou direct", metrica: "mensagens de marca e cliques no portfólio" }
};
const cDoItem = (it) => { const m = semAcento(it.c || it.porque || "").match(/conhecer|conectar|converter/); return m ? m[0] : ""; };

const ORDEM_CAMPOS_PLANO = { capa: ["titulo", "texto", "destaque"], texto: ["titulo", "texto"], lista: ["titulo", "texto"], numero: ["texto2", "titulo", "texto"], moldura: ["texto2", "titulo"], notas: ["titulo", "texto2"], polaroid: ["titulo"], colagem: ["titulo", "texto"], cartao: ["titulo", "texto", "texto2"], frase: ["titulo"], final: ["titulo", "texto", "destaque", "texto2"] };
// Lê a resposta do Claude: linhas "SEG | Reels | tema | gancho | por quê" e blocos "CARROSSEL: título"
function lerPlano(texto) {
  const itens = [], carrosseis = [];
  let car = null;
  String(texto || "").split("\n").forEach((bruta) => {
    const l = bruta.replace(/^[\s>*•-]+/, "").replace(/\*\*/g, "").replace(/^\|/, "").replace(/\|\s*$/, "").trim();
    const mc = l.match(/^CARROSSEL\s*:\s*(.+)$/i);
    if (mc) { car = { titulo: mc[1].trim(), slides: [] }; carrosseis.push(car); return; }
    const md = l.match(/^(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)[A-Za-zçÇáÁ-]*\s*\|\s*(.+)$/i);
    if (md) {
      const p = md[2].split("|").map((x) => x.trim());
      const sigla = md[1].toUpperCase().replace("Á", "A");
      // Formato novo: SEG | Reels | Conectar | tema | gancho | objetivo e CTA (o antigo, sem o C, continua valendo)
      if (/^(conhecer|conectar|converter)$/i.test(semAcento(p[1] || ""))) itens.push({ dia: sigla, formato: p[0] || "", c: semAcento(p[1]), tema: p[2] || "", gancho: p[3] || "", porque: p[4] || "" });
      else itens.push({ dia: sigla, formato: p[0] || "", tema: p[1] || "", gancho: p[2] || "", porque: p[3] || "" });
      car = null; return;
    }
    const ms = l.match(/^(\d{1,2})[.)]?\s*(capa|texto|lista|numero|número|moldura|notas|polaroid|colagem|cartao|cartão|frase|final|comparacao|comparação)\s*\|\s*(.*)$/i);
    if (ms && car) {
      const modelo = ms[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace("comparacao", "cartao");
      const partes = ms[3].split("|").map((x) => x.trim());
      const slide = { modelo };
      const dica = partes.findIndex((x) => /^foto\s*:/i.test(x));
      if (dica >= 0) { slide.dicaFoto = partes[dica].replace(/^foto\s*:\s*/i, ""); partes.splice(dica, 1); }
      (ORDEM_CAMPOS_PLANO[modelo] || ["titulo", "texto"]).forEach((c, k) => { if (partes[k]) slide[c] = partes[k]; });
      if (modelo === "lista" && slide.texto) slide.texto = slide.texto.split(/\s*;\s*/).join("\n");
      if (modelo === "final") { slide.tom = "escuro"; slide.texto2 = slide.texto2 || "Link na bio"; }
      if (modelo === "texto") slide.tom = car.slides.filter((x) => x.modelo === "texto").length % 2 ? "forte" : "escuro";
      car.slides.push(slide);
    }
  });
  return { itens, carrosseis: carrosseis.filter((c) => c.slides.length) };
}

function pedidoPlano(nicho) {
  const d = ig.dados;
  let meus = "";
  if (d && (d.posts || []).length) {
    const posts = d.posts.filter((x) => n2(x.reach));
    const top = [...posts].sort((a, b) => n2(b.reach) - n2(a.reach)).slice(0, 6);
    const fraco = [...posts].sort((a, b) => n2(a.reach) - n2(b.reach)).slice(0, 3);
    const linha = (x) => `- ${NOME_FORMATO[x.tipo] || x.tipo}, ${new Date(x.data).toLocaleDateString("pt-BR")} (${DIAS_SEMANA[new Date(x.data).getDay()]}): alcance ${num(x.reach)}, ${num(x.saved)} salvos, ${num(x.shares)} compartilhamentos. "${String(x.legenda || "sem legenda").replace(/\s+/g, " ").slice(0, 160)}"`;
    meus = `MEUS NÚMEROS (Instagram @${d.perfil.username}, ${num(d.perfil.followers_count)} seguidores, últimos ${d.dias} dias: alcance ${num((d.atual || {}).reach)})
Meus posts com MAIS alcance:
${top.map(linha).join("\n")}
Meus posts com MENOS alcance:
${fraco.map(linha).join("\n")}
`;
  }
  const semana = (igx.reels || []).filter((r) => r.semana === (igx.reels[0] || {}).semana).slice(0, 30);
  const refs = semana.length ? `OS ${semana.length} REELS COM MAIS VIEWS DESTA SEMANA NO MEU NICHO (por hashtag)
${semana.map((r, i) => `${i + 1}. ${r.perfil || ""} · ${num(r.views)} views${n2(r.duracao) ? ` · ${Math.round(r.duracao)} s` : ""}: "${String(r.legenda || "").replace(/\s+/g, " ").slice(0, 220)}"`).join("\n")}
` : "";
  // Suas ideias de roteiro que ainda não foram pro ar (as "Fazer agora" primeiro)
  const ordemEtapa = { agora: 0, fazendo: 1, ideia: 2 };
  const ideias = (S.transcricoes || []).filter((t) => t.status !== "feito" && t.categoria === "organico" && (t.titulo || t.minha_versao || t.transcricao))
    .sort((a, b) => (ordemEtapa[a.status] ?? 3) - (ordemEtapa[b.status] ?? 3)).slice(0, 30);
  const minhasIdeias = ideias.length ? `MINHAS IDEIAS DE ROTEIRO PARA O INSTAGRAM JÁ ANOTADAS (#número para você citar)
${ideias.map((t) => `#${t.id} [${(CATEGORIAS.find((c) => c[0] === t.categoria) || [0, t.categoria || ""])[1]}${t.status === "agora" ? ", fazer agora" : ""}] ${t.titulo || "sem título"}${(t.minha_versao || t.transcricao) ? `: ${String(t.minha_versao || t.transcricao).replace(/\s+/g, " ").slice(0, 160)}` : ""}`).join("\n")}
` : "";
  const seg = segundaISO();
  const contexto = String((igx.contextos || {})[seg] || "").trim();
  return `Você é o meu estrategista de conteúdo para Instagram. O seu trabalho é montar uma semana que siga a MINHA ESTRATÉGIA abaixo, com ideias específicas e coerentes, nada vago.

QUEM SOU EU
${nicho}

O QUE ACONTECE NESTA SEMANA (${dataBR(seg)} a ${dataBR(somaDiasISO(6, seg))})
${contexto || "(nada de especial informado)"}

${meus}
${refs}
${minhasIdeias}
MINHA ESTRATÉGIA (siga à risca)
O meu perfil existe para três coisas: atrair as pessoas e as marcas certas, gerar confiança e converter isso em trabalho. Cada post tem UM papel, um dos três Cs:
- CONHECER (1 a 2 por semana): mostra quem eu sou, meu estilo de vida e minha área (tech, lifestyle, moda, grooming, UGC). Formatos: vídeo curto, opinião, situação do cotidiano. CTA: seguir ou compartilhar. Métrica: alcance e seguidores novos.
- CONECTAR (2 a 3 por semana): educa e ensina com a minha experiência real, rotina e bastidores. Formatos: carrossel educativo, tutorial, bastidor, vlog. CTA: salvar ou comentar. Métrica: salvamentos, comentários e tempo assistido.
- CONVERTER (1 por semana, nunca some): mostra o meu trabalho para as marcas: como eu gravo, estruturo roteiro, estudo a marca e entrego, com prova social real. CTA: uma ação só (portfólio na bio ou direct). Métrica: mensagens de marca e cliques no portfólio.
A semana precisa ter uma sequência: Conhecer puxa gente nova, Conectar segura e ensina, Converter mostra para as marcas como me contratar.

REGRAS PARA AS IDEIAS NÃO FICAREM GENÉRICAS
1. Todo post nasce de uma história, experiência ou prova REAL minha: das minhas ideias anotadas (use o #número) ou do que acontece nesta semana. Proibido dica que qualquer creator daria. Se faltar a minha história para o post funcionar, escreva no fim da linha "(preciso de: o que eu tenho que te contar)".
2. Ensinar de verdade: o post entrega um passo a passo, um número, um antes e depois ou um exemplo concreto. "Dicas para melhorar a edição" sem dizer QUAIS dicas não serve.
3. Retenção: o gancho abre uma pergunta nos 3 primeiros segundos e o post só responde no fim. Nada de apresentação. Tem uma mudança perceptível do começo ao fim.
4. Estrutura do perfil: GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO. Um CTA só, coerente com o C.
5. Respeite O QUE ACONTECE NESTA SEMANA: use como matéria-prima (ex.: aniversário vira um Conhecer ou Conectar pessoal) e NÃO coloque nesses dias tema que fica sem sentido.
6. Os 12 anos que eu passei em vendas B2B rendem gancho em Converter e em conteúdo sobre carreira de creator e negócio.
7. O post mais importante vai nos meus melhores dias (sábado, quarta, segunda). Evite domingo e sexta para ele.
8. Este plano é SÓ para o Instagram. Nada de TikTok Shop (vídeo de venda de produto com carrinho).

${dnaPerfil || DNA_PADRAO}
(As fórmulas acima são formatos que já funcionaram no meu perfil. Use como formato, mas o PAPEL de cada post vem dos três Cs.)

O QUE EU PRECISO (pesquise na internet o que está em alta no Brasil nesta semana):

1. TENDÊNCIAS DA SEMANA: 5 temas, formatos ou áudios em alta no meu nicho e por que estão funcionando.
2. O QUE O MEU PÚBLICO QUER SABER: 8 perguntas reais que as pessoas estão fazendo sobre esses assuntos.
3. PADRÕES DOS REELS QUE BOMBARAM: o que os reels da lista têm em comum (gancho, duração, estilo, tema).
4. O QUE FUNCIONA PARA MIM: o que os meus números mostram (o que repetir e o que parar).
5. PLANO DA SEMANA: de 4 a 6 posts, com 1 a 2 Conhecer, 2 a 3 Conectar e 1 Converter, pelo menos 1 carrossel e 2 reels.
   PRIORIZE as minhas ideias anotadas (com o #número no tema). Só invente tema novo se faltar, e aí ele precisa sair de uma história minha.
   Escreva CADA post numa linha, EXATAMENTE neste formato, separado por | :
   SEG | Reels | Conectar | tema | gancho (a primeira frase do vídeo ou a capa) | o que a pessoa aprende ou sente + CTA
   Use só SEG, TER, QUA, QUI, SEX, SAB, DOM no começo. Formatos: Reels, Carrossel, Stories ou Foto. O terceiro campo é sempre Conhecer, Conectar ou Converter.
6. ROTEIRO DE CADA POST: depois do plano, para cada post escreva:
   ROTEIRO (tema)
   GANCHO: duas opções
   CONTEXTO: uma frase
   CONTEÚDO: os passos ou pontos concretos, um por linha
   FECHAMENTO: o CTA, uma ação só
7. CARROSSÉIS PRONTOS: para cada carrossel do plano, escreva os slides neste formato (de 5 a 8 slides, no máximo 30 palavras por slide). Num título, *palavra* fica em itálico colorido e **palavra** em negrito (1 destaque por título, no máximo).
   CARROSSEL: título do carrossel
   1 capa | título forte (até 10 palavras) | linha pequena em cima (opcional) | etiqueta curta (opcional) | foto: que foto minha usar
   2 texto | título com *uma palavra* destacada | texto do slide
   3 lista | título | item um; item dois; item três
   4 numero | linha pequena (ex.: HOJE) | o número (ex.: +40 MARCAS.) | linha de baixo
   5 moldura | nota pequena | frase (ex.: sem experiência. **sem marca.** sem cliente.) | foto: que foto ou print usar
   6 notas | frase forte do card | balão curtinho (ex.: *panic*) | foto: fundo
   7 polaroid | legenda curta | foto: que foto usar
   8 colagem | título | texto com **final em negrito** | foto: quais 2 fotos
   9 cartao | título do card | texto do card | bilhete curto | foto: fundo
   10 frase | frase de impacto | foto: fundo
   11 final | frase de cima | frase de baixo | caixa de destaque (ex.: Salva esse post) | letra de mão (ex.: Link na bio)
   Modelos possíveis: capa, texto, lista, numero, moldura, notas, polaroid, colagem, cartao, frase, final. Comece sempre com capa e termine com final.

Fale como gente de verdade, em português do Brasil, tom de conversa de café, sem cara de anúncio. Não use travessão em nenhum texto. Proibido: "não é X, é Y" e variações, "aí eu descobri", "foi aí que", "foi quando", "até que", "você sabia que" como gancho, "isso muda tudo", "isso muda o jogo". Não invente número ou resultado meu: o que você não sabe vira campo entre parênteses.`;
}

// Adiar: tira o post da semana (e da agenda) e a ideia volta para o banco de ideias.
// Se o post não veio de uma ideia anotada, ele vira uma ideia nova no banco, com o gancho guardado.
async function adiarPostDoPlano(plano, i) {
  const itensPlano = ((plano.itens || {}).itens || []).slice();
  const it = itensPlano[i];
  if (!it || !(await confirmar(`Adiar "${String(it.tema).slice(0, 60)}"? Ele sai desta semana e da agenda e volta para o banco de ideias.`, "Adiar"))) return;
  const id = (String(it.tema).match(/#(\d+)/) || [])[1];
  const ideia = id ? S.transcricoes.find((t) => String(t.id) === id) : null;
  if (ideia) {
    if (!(await gravar("transcricoes", { status: "ideia" }, ideia.id))) return;
  } else {
    const nota = [it.gancho ? `Gancho: ${it.gancho}` : "", it.porque ? `Por quê: ${it.porque}` : "", `Adiado do plano da semana de ${dataBR(plano.semana).slice(0, 5)}.`].filter(Boolean).join("\n");
    const nova = { link: null, plataforma: null, categoria: "organico", status: "ideia", titulo: String(it.tema).replace(/#\d+\s*/g, "").slice(0, 200), observacoes: nota, de_quem: "minha", andamento: "pronto" };
    const limpo = {}; Object.keys(nova).forEach((k) => { if (temCampo("transcricoes", k)) limpo[k] = nova[k]; });
    const { error } = await db.from("transcricoes").insert(limpo);
    if (error) { avisar(traduzErro(error), true); return; }
  }
  // Sai da agenda (o post marcado para aquele dia)
  const dia = (DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0])[1];
  const data = somaDiasISO(dia, plano.semana);
  const base = semAcento(String(it.tema).replace(/#\d+\s*/g, "")).slice(0, 18);
  const ev = S.calendario.filter((c) => c.tipo === "postar" && String(c.data).slice(0, 10) === data && ((id && String(c.titulo).includes("#" + id)) || semAcento(c.titulo).includes(base)));
  for (const c of ev) await apagarLinha("calendario", c.id);
  itensPlano.splice(i, 1);
  const { error } = await db.from("ig_planos").update({ itens: { ...(plano.itens || {}), itens: itensPlano } }).eq("semana", plano.semana);
  if (error) { avisar(traduzErro(error), true); return; }
  await Promise.all([carregarPlanos(), recarregar("transcricoes"), ev.length ? recarregar("calendario") : Promise.resolve()]);
  avisar(`Adiado: voltou para o banco de ideias${ev.length ? " e saiu da agenda" : ""}.`);
  desenhar();
}

function desenharPlanoSemana(el) {
  if (igx.planos === null) { el.innerHTML = `<p class="vazio">Abrindo o seu plano...</p>`; carregarPlanos().then(desenhar); return; }
  if (igx.faltaPlanos) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 27 do banco.sql no Supabase.</div>`; return; }
  const seg = segundaISO();
  if (!igx.semanaPlano) igx.semanaPlano = (igx.planos.find((p) => p.semana === seg) || igx.planos[0] || { semana: seg }).semana;
  const plano = igx.planos.find((p) => p.semana === igx.semanaPlano);
  let nicho = NICHO_PADRAO;
  try { nicho = localStorage.getItem("ig-nicho") || NICHO_PADRAO; } catch (_) {}
  const temReels = (igx.reels || []).length;
  const itens = plano ? (plano.itens || {}).itens || [] : [];
  const carrosseisPlano = plano ? (plano.itens || {}).carrosseis || [] : [];
  const dataDoDia = (sigla) => somaDiasISO((DIAS_PLANO.find((x) => x[0] === sigla) || [0, 0])[1], plano ? plano.semana : seg);
  const carDoItem = (it) => {
    if (!/carross/i.test(it.formato)) return -1;
    const ordem = itens.filter((x) => /carross/i.test(x.formato)).indexOf(it);
    const porNome = carrosseisPlano.findIndex((c) => semAcento(c.titulo).includes(semAcento(it.tema).slice(0, 18)) || semAcento(it.tema).includes(semAcento(c.titulo).slice(0, 18)));
    return porNome >= 0 ? porNome : ordem < carrosseisPlano.length ? ordem : -1;
  };

  el.innerHTML = `
    <section class="cartao ig-estr-topo">
      <div><h2 class="rot-titulo">🧭 Plano da semana</h2>
        <p class="rot-frase">Pesquisa de mercado e o que postar de segunda a domingo, com os seus números e os reels que bombaram. Sem custo: o Claude faz a pesquisa e você cola a resposta aqui.</p></div>
      ${igx.planos.length > 1 ? `<select class="campo" id="pl-semana" aria-label="Semana">${[...new Set([seg, ...igx.planos.map((p) => p.semana)])].map((s) => `<option value="${s}" ${s === igx.semanaPlano ? "selected" : ""}>Semana de ${dataBR(s).slice(0, 5)}</option>`).join("")}</select>` : ""}
    </section>
    ${cartaoDna()}
    <section class="cartao pl-contexto">
      <h3 class="pro-titulo">O que acontece nesta semana?</h3>
      <p class="sub" style="margin:0 0 6px">Aniversário, viagem, evento, gravação de marca, semana corrida... O plano usa isso como matéria-prima e tira o que não faz sentido nesses dias.</p>
      <textarea class="campo" id="pl-contexto" rows="2" style="width:100%" placeholder="Ex.: quinta é meu aniversário, faço (idade) anos. Sábado vou gravar com a LV Clinic.">${esc((igx.contextos || {})[plano ? plano.semana : seg] || "")}</textarea>
    </section>
    ${itens.length ? (() => { const cont = { conhecer: 0, conectar: 0, converter: 0 }; itens.forEach((it) => { const c = cDoItem(it); if (c) cont[c]++; }); const semC = itens.filter((it) => !cDoItem(it)).length; return `<div class="pl-cs">${["conhecer", "conectar", "converter"].map((c) => `<span class="pilula ${C_INFO[c].cls}">${C_INFO[c].nome}: ${cont[c]}</span>`).join("")}<span class="sub">ideal: 1 a 2 Conhecer, 2 a 3 Conectar, 1 Converter${!cont.converter && !semC ? ". <b>Falta um Converter</b>: sem ele as marcas não entendem como te contratar." : ""}${semC ? `. ${semC === itens.length ? "Este plano foi feito antes dos três Cs: refaça com o pedido novo." : `${semC} sem C definido.`}` : ""}</span></div>`; })() : ""}

    ${itens.length ? `
      <div class="pl-dias">${itens.map((it, i) => { const ci = carDoItem(it); const data = dataDoDia(it.dia); return `
        <article class="pl-dia ${data === hojeISO() ? "hoje" : ""}" data-pl-abrir="${i}" tabindex="0" role="button" aria-label="Ver tudo de ${esc(it.tema)}">
          <header><b>${esc((DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0, it.dia])[2])}</b><span class="sub">${dataBR(data).slice(0, 5)}</span><span class="pilula ${/reel/i.test(it.formato) ? "p-azul" : /carross/i.test(it.formato) ? "p-oliva" : ""}">${esc(it.formato)}</span>${cDoItem(it) ? `<span class="pilula ${C_INFO[cDoItem(it)].cls}">${C_INFO[cDoItem(it)].nome}</span>` : ""}</header>
          <h3>${esc(it.tema)}</h3>
          ${it.gancho ? `<p class="pl-gancho">“${esc(String(it.gancho).replace(/^["“]+|["”]+$/g, ""))}”</p>` : ""}
          ${it.porque ? `<p class="sub">${esc(it.porque)}</p>` : ""}
          <div class="pl-acoes">
            <button class="btn pequeno primario" type="button" data-pl-ver="${i}">👁️ Ver tudo</button>
            ${ci >= 0 ? `<button class="btn pequeno" type="button" data-pl-car="${ci}">🎨 Carrossel</button>` : ""}
            <button class="btn pequeno" type="button" data-pl-agenda="${i}">📅 Agenda</button>
            ${it.gancho ? `<button class="btn pequeno" type="button" data-pl-copiar="${i}">📋 Gancho</button>` : ""}
            <button class="btn pequeno" type="button" data-pl-adiar="${i}" title="Tira da semana e devolve para o banco de ideias">⏭️ Adiar</button>
          </div>
        </article>`; }).join("")}</div>
      <details class="cartao pl-completo"><summary><b>Ver a pesquisa completa</b> (tendências, perguntas do público e padrões)</summary><div class="pl-texto">${esc(plano.resposta).replace(/\n/g, "<br>")}</div></details>`
    : plano ? `<div class="cartao"><p>Você colou uma resposta, mas não achei as linhas do plano no formato <code>SEG | Reels | tema | gancho | por quê</code>. Peça para o Claude: <i>"reescreva o item 5 exatamente no formato pedido"</i> e cole de novo.</p><details><summary>Ver o que foi colado</summary><div class="pl-texto">${esc(plano.resposta).replace(/\n/g, "<br>")}</div></details></div>` : ""}

    <div class="cartao pl-passos">
      <h3 class="pro-titulo">${itens.length ? "Refazer o plano desta semana" : "Montar o plano desta semana (2 minutos)"}</h3>
      <ol class="passos">
        <li>${temReels ? `O pedido já leva os ${Math.min(30, temReels)} reels que mais bombaram${ig.dados ? " e os seus números do Instagram" : ""}.` : `Dica: busque antes os <button type="button" class="link-btn" id="pl-ir-reels">🔥 Reels da semana</button> para o pedido ir com dados reais.`}</li>
        <li>Toque em <b>Copiar pedido</b> e cole no <a href="https://claude.ai/new" target="_blank" rel="noopener"><b>Claude</b></a> (com a pesquisa na web ligada).</li>
        <li>Copie a resposta inteira do Claude, cole aqui embaixo e toque em <b>Salvar plano</b>.</li>
      </ol>
      <details><summary>Sobre o seu nicho (o Claude lê isso)</summary>
        <textarea class="campo" id="pl-nicho" rows="4" style="width:100%;margin-top:8px">${esc(nicho)}</textarea></details>
      <div class="pro-acoes" style="margin:10px 0">
        <button class="btn primario" type="button" id="pl-copiar">📋 Copiar pedido</button>
        <a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude ↗</a>
      </div>
      <textarea class="campo" id="pl-resposta" rows="7" style="width:100%" placeholder="Cole aqui a resposta do Claude"></textarea>
      <div class="pro-acoes" style="margin-top:10px"><button class="btn primario" type="button" id="pl-salvar">💾 Salvar plano</button></div>
    </div>`;

  const sel = $("#pl-semana"); if (sel) sel.onchange = (e) => { igx.semanaPlano = e.target.value; desenhar(); };
  ligarCartaoDna();
  const irReels = $("#pl-ir-reels"); if (irReels) irReels.onclick = () => { igx.sub = "reels"; desenhar(); };
  $("#pl-nicho").onchange = (e) => { try { localStorage.setItem("ig-nicho", e.target.value.trim() || NICHO_PADRAO); } catch (_) {} };
  $("#pl-copiar").onclick = async (e) => {
    // Garante que os seus números do Instagram vão junto
    if (!ig.dados && ig.conectado !== false) { e.target.textContent = "Juntando seus números..."; await chamarInstagram({ acao: "dados", dias: 30 }).then((r) => { if (r.perfil) { ig.dados = r; ig.conectado = true; } }).catch(() => {}); e.target.textContent = "📋 Copiar pedido"; }
    const texto = pedidoPlano($("#pl-nicho").value.trim() || NICHO_PADRAO);
    try { await navigator.clipboard.writeText(texto); avisar("Pedido copiado. Cole no Claude."); }
    catch (_) { abrirJanelaSimples("Copie o pedido", `<textarea class="campo" rows="14" style="width:100%" readonly>${esc(texto)}</textarea>`, ""); }
  };
  $("#pl-salvar").onclick = async () => {
    const resposta = $("#pl-resposta").value.trim();
    if (!resposta) { avisar("Cole a resposta do Claude primeiro.", true); return; }
    const lido = lerPlano(resposta);
    const semana = segundaISO();
    const { error } = await db.from("ig_planos").upsert({ semana, resposta, itens: lido }, { onConflict: "semana" });
    if (error) { avisar(traduzErro(error), true); return; }
    await carregarPlanos(); igx.semanaPlano = semana;
    avisar(lido.itens.length ? `Plano salvo: ${plural(lido.itens.length, "post", "posts")}${lido.carrosseis.length ? ` e ${plural(lido.carrosseis.length, "carrossel pronto", "carrosséis prontos")}` : ""}.` : "Salvei, mas não achei as linhas do plano. Veja o aviso.", !lido.itens.length);
    desenhar();
  };
  $$("[data-pl-car]", el).forEach((b) => b.onclick = () => {
    const c = carrosseisPlano[Number(b.dataset.plCar)];
    if (!c) return;
    igx.car = { titulo: c.titulo, slides: c.slides.map((s) => ({ ...s })) };
    igx.sub = "carrossel"; try { localStorage.setItem("ig-sub", "carrossel"); } catch (_) {}
    desenhar(); window.scrollTo({ top: 0 });
  });
  const abrirItem = (i) => abrirPostDoPlano(plano, itens[i]);
  $$("[data-pl-abrir]", el).forEach((card) => {
    card.addEventListener("click", (e) => { if (e.target.closest("button, a")) return; abrirItem(Number(card.dataset.plAbrir)); });
    card.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); abrirItem(Number(card.dataset.plAbrir)); } });
  });
  $$("[data-pl-ver]", el).forEach((b) => b.onclick = () => abrirItem(Number(b.dataset.plVer)));
  const ctx = $("#pl-contexto");
  if (ctx) ctx.onchange = async () => {
    const semana = plano ? plano.semana : seg;
    const valor = ctx.value.trim();
    const { error } = await db.from("preferencias").upsert({ chave: "semana_" + semana, valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (error) { avisar(traduzErro(error), true); return; }
    igx.contextos[semana] = valor;
    avisar("Guardei. O próximo pedido de plano já leva isso.");
  };
  $$("[data-pl-adiar]", el).forEach((b) => b.onclick = () => adiarPostDoPlano(plano, Number(b.dataset.plAdiar)));
  $$("[data-pl-copiar]", el).forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(itens[Number(b.dataset.plCopiar)].gancho); avisar("Gancho copiado."); } catch (_) { avisar("Não deu para copiar.", true); }
  });
  $$("[data-pl-agenda]", el).forEach((b) => b.onclick = async () => {
    const it = itens[Number(b.dataset.plAgenda)];
    const titulo = `${it.formato}: ${it.tema}`.slice(0, 200);
    if (S.calendario.some((a) => a.titulo === titulo)) { avisar("Esse post já está na agenda."); return; }
    if (await gravar("calendario", { titulo, tipo: "postar", data: dataDoDia(it.dia), status: "a fazer" })) { avisar(`Na agenda: ${(DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0, it.dia])[2]}.`); recarregar("calendario"); }
  });
}

/* ---------- 🎨 Carrossel: sistema visual + gerador ----------
   Estilo editorial (inspirado nos seus fixados e nas referências):
   foto sua no centro, serifada elegante + bastão grossa, objetos de
   papel (etiqueta, Notas, polaroid, clipe, fita, estrela).
   No texto: *palavra* = itálico colorido, **palavra** = negrito.
   ----------------------------------------------------------------- */
const FONTE_SERIFA = "'Playfair Display'", FONTE_BASTAO = "Montserrat", FONTE_MAO = "Allura";
const TEMAS_CARROSSEL = {
  ryan: { nome: "Ryan (creme e dourado)", acento: "#1F3FC3",
    claro: { fundo: "#F5F1EA", titulo: "#2B241C", texto: "#3A3128", destaque: "#7A6322" },
    escuro: { fundo: "#2B241C", titulo: "#F5F1EA", texto: "#E9E1D3", destaque: "#D9C48A" },
    forte: { fundo: "#7A6322", titulo: "#FFF8EA", texto: "#F5ECD9", destaque: "#F3E2A6" } },
  roxo: { nome: "Roxo e lima", acento: "#7B3FB0",
    claro: { fundo: "#F3EEE3", titulo: "#3A0E46", texto: "#3A0E46", destaque: "#7B2C8F" },
    escuro: { fundo: "#3A0E46", titulo: "#FBF6E8", texto: "#EDE3F0", destaque: "#E4F04B" },
    forte: { fundo: "#D8F04A", titulo: "#3A0E46", texto: "#2B2B2B", destaque: "#3A0E46" } },
  cafe: { nome: "Café e verde", acento: "#1F4D3A",
    claro: { fundo: "#ECE7E0", titulo: "#4A3428", texto: "#4A3428", destaque: "#1F4D3A" },
    escuro: { fundo: "#1F3A2E", titulo: "#F3EEE6", texto: "#E8E2D6", destaque: "#E3C987" },
    forte: { fundo: "#4A3428", titulo: "#F3EEE6", texto: "#EDE5DA", destaque: "#E3C987" } },
  cobalto: { nome: "Cobalto (cores do site)", acento: "#1F3FC3",
    claro: { fundo: "#F0EEEA", titulo: "#1F3FC3", texto: "#14182B", destaque: "#8A855E" },
    escuro: { fundo: "#1F3FC3", titulo: "#F0EEEA", texto: "#E8EAF6", destaque: "#F2E66B" },
    forte: { fundo: "#14182B", titulo: "#F0EEEA", texto: "#D9DCE8", destaque: "#F2E66B" } }
};
const ASSINATURA = { nome: "RYAN ALVES", cargo: "UGC CREATOR", arroba: "@ryalvz" };
const W_CAR = 1080, H_CAR = 1350, M_CAR = 90;

// Modelos: [chave, nome, para que serve, campos (na ordem do editor)]
const MODELOS_SLIDE = [
  ["capa", "Capa com foto", "Sua foto em tela cheia e a promessa do carrossel.", ["foto", "texto", "titulo", "destaque"]],
  ["texto", "Texto editorial", "01. Título elegante e um parágrafo. Fundo de cor chapada.", ["tom", "titulo", "texto"]],
  ["lista", "Lista", "Passos ou itens, um por linha.", ["tom", "titulo", "texto"]],
  ["numero", "Número grande", "Um número que impressiona (ex.: +40 MARCAS).", ["tom", "texto2", "titulo", "texto"]],
  ["moldura", "Foto emoldurada", "Foto ou print no meio, frase embaixo.", ["tom", "foto", "texto2", "titulo"]],
  ["notas", "Card do Notas", "Frase forte num card do app Notas, com balão.", ["foto", "titulo", "texto2"]],
  ["polaroid", "Polaroid", "Uma foto em polaroid com legenda.", ["tom", "foto", "titulo"]],
  ["colagem", "Colagem (2 fotos)", "Título, duas fotos tortas com clipe e um texto.", ["tom", "titulo", "foto", "foto2", "texto"]],
  ["cartao", "Card sobre a foto", "Card de papel e um bilhete por cima da sua foto.", ["foto", "titulo", "texto", "texto2"]],
  ["frase", "Frase sobre a foto", "Uma frase centralizada em cima da sua foto.", ["foto", "titulo"]],
  ["final", "Final com chamada", "Chamada para seguir, salvar ou ir no link.", ["tom", "titulo", "foto", "texto", "destaque", "texto2"]]
];
const ROTULOS_CAMPO = {
  capa: { texto: "Linha pequena em cima (opcional)", titulo: "Título (*itálico* **negrito**)", destaque: "Etiqueta torta (opcional)" },
  texto: { titulo: "Título (*palavra* fica colorida)", texto: "Texto do slide" },
  lista: { titulo: "Título", texto: "Um item por linha" },
  numero: { texto2: "Linha pequena em cima (ex.: HOJE)", titulo: "O número (ex.: +40 MARCAS.)", texto: "Embaixo (ex.: Moda · Tecnologia · Lifestyle)" },
  moldura: { texto2: "Nota pequena no canto (opcional)", titulo: "Frase (ex.: sem experiência. **sem marca.**)" },
  notas: { titulo: "Texto do card", texto2: "Balão azul (ex.: *panic*)" },
  polaroid: { titulo: "Legenda da polaroid" },
  colagem: { titulo: "Título", texto: "Texto embaixo (**negrito** no final)" },
  cartao: { titulo: "Título do card (itálico)", texto: "Texto do card", texto2: "Bilhete por cima (opcional)" },
  frase: { titulo: "A frase" },
  final: { titulo: "Frase de cima", texto: "Frase de baixo", destaque: "Caixa de destaque (ex.: Salva esse post)", texto2: "Letra de mão (ex.: Link na bio)" }
};
const CARROSSEL_EXEMPLO = {
  titulo: "Há 1 ano eu não tinha nenhuma marca", tema: "ryan",
  slides: [
    { modelo: "capa", titulo: "Há 1 ano eu não tinha *nenhuma marca* no portfólio.", texto: "", destaque: "" },
    { modelo: "moldura", tom: "claro", texto2: "Meu primeiro vídeo para portfólio", titulo: "sem experiência. **sem marca.** sem cliente." },
    { modelo: "texto", tom: "escuro", titulo: "O que *ninguém* te conta.", texto: "Meu primeiro trabalho veio 3 meses depois. Teve mês sem fechar nada. E eu pensei várias vezes que aquilo não ia funcionar para mim. Mas continuei criando e melhorando o portfólio." },
    { modelo: "numero", tom: "claro", texto2: "HOJE", titulo: "+40 MARCAS.", texto: "Moda · Tecnologia · Lifestyle · Grooming" },
    { modelo: "notas", titulo: "Constância vence talento quando o talento não aparece.", texto2: "*anota*" },
    { modelo: "frase", titulo: "A única coisa que me separa de quem eu era há 1 ano é que eu não parei." },
    { modelo: "final", tom: "escuro", titulo: "Se você quer começar no UGC,", texto: "me segue que eu conto os bastidores por aqui.", destaque: "Salva esse post", texto2: "@ryalvz" }
  ]
};

let fontesCarrossel = null;
function carregarFontesCarrossel() {
  if (!fontesCarrossel) fontesCarrossel = Promise.all([
    `400 60px ${FONTE_SERIFA}`, `700 60px ${FONTE_SERIFA}`, `italic 400 60px ${FONTE_SERIFA}`, `italic 700 60px ${FONTE_SERIFA}`,
    `500 40px ${FONTE_BASTAO}`, `600 40px ${FONTE_BASTAO}`, `700 40px ${FONTE_BASTAO}`, `800 40px ${FONTE_BASTAO}`, `400 60px ${FONTE_MAO}`
  ].map((f) => document.fonts.load(f).catch(() => null))).then(() => document.fonts.ready);
  return fontesCarrossel;
}

/* ---------- Fotos: guardadas no Storage, carregadas sem "sujar" o canvas ---------- */
const fotosCarrossel = new Map();
function fotoCarrossel(url, aoCarregar) {
  if (!url) return null;
  const f = fotosCarrossel.get(url);
  if (f) return f.pronta ? f.img : null;
  const img = new Image(); img.crossOrigin = "anonymous";
  const reg = { img, pronta: false, promessa: null };
  reg.promessa = new Promise((ok) => { img.onload = () => { reg.pronta = true; ok(img); if (aoCarregar) aoCarregar(); }; img.onerror = () => ok(null); });
  img.src = url;
  fotosCarrossel.set(url, reg);
  return null;
}
const esperarFotos = (slides) => Promise.all(slides.flatMap((s) => [s.foto, s.foto2]).filter(Boolean).map((u) => { fotoCarrossel(u); return fotosCarrossel.get(u).promessa; }));
async function prepararFoto(arquivo) {
  const url = URL.createObjectURL(arquivo);
  const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error("Não consegui abrir essa imagem. Use JPG, PNG ou HEIC convertido.")); i.src = url; });
  const escala = Math.min(1, 1700 / Math.max(img.width, img.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.88));
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

/* ---------- Texto rico: *itálico colorido* e **negrito** ---------- */
function pedacosRicos(texto) {
  const r = [], re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let ultimo = 0, m;
  const s = String(texto || "");
  while ((m = re.exec(s))) {
    if (m.index > ultimo) r.push({ t: s.slice(ultimo, m.index), e: "n" });
    r.push(m[0].startsWith("**") ? { t: m[0].slice(2, -2), e: "b" } : { t: m[0].slice(1, -1), e: "a" });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < s.length) r.push({ t: s.slice(ultimo), e: "n" });
  return r;
}
// fontes(tam) => { n, a, b }: a fonte de cada estilo naquele tamanho
function linhasRicas(ctx, texto, fontes, largura, maiusc) {
  const linhas = [];
  String(texto || "").split("\n").forEach((par) => {
    const palavras = [];
    let antesEspaco = true;
    pedacosRicos(maiusc ? par.toUpperCase() : par).forEach((p) => p.t.split(/(\s+)/).forEach((w) => {
      if (!w) return;
      if (/^\s+$/.test(w)) { antesEspaco = true; return; }
      palavras.push({ t: w, e: p.e, cola: !antesEspaco && palavras.length > 0 }); antesEspaco = false;
    }));
    if (!palavras.length) { linhas.push({ itens: [], fim: true }); return; }
    let atual = [], larg = 0;
    palavras.forEach((p) => {
      ctx.font = fontes[p.e]; const w = ctx.measureText(p.t).width;
      ctx.font = fontes.n; const esp = atual.length && !p.cola ? ctx.measureText(" ").width : 0;
      if (atual.length && !p.cola && larg + esp + w > largura) { linhas.push({ itens: atual, fim: false }); atual = []; larg = 0; }
      atual.push({ ...p, cola: p.cola && atual.length > 0, w }); larg += (atual.length > 1 ? esp : 0) + w;
    });
    linhas.push({ itens: atual, fim: true });
  });
  return linhas;
}
function caberRico(ctx, texto, { fontes, max, min, largura, altura, entre = 1.15, maiusc = false, passo = 2 }) {
  for (let tam = max; tam >= min; tam -= passo) {
    const f = fontes(tam), linhas = linhasRicas(ctx, texto, f, largura, maiusc);
    if (linhas.length * tam * entre <= altura) return { tam, linhas, entre, f };
  }
  const f = fontes(min);
  return { tam: min, linhas: linhasRicas(ctx, texto, f, largura, maiusc), entre, f };
}
// alinhar: "left" | "center" | "right" | "justify"
function escreverRico(ctx, bloco, x, y, cores, alinhar = "left", largura = 0, extra = {}) {
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  bloco.linhas.forEach((l, i) => {
    const base = y + i * bloco.tam * bloco.entre + bloco.tam * 0.86;
    ctx.font = bloco.f.n; const esp = ctx.measureText(" ").width;
    const vaos = l.itens.filter((p, k) => k > 0 && !p.cola).length;
    const total = l.itens.reduce((s, p) => s + p.w, 0) + vaos * esp;
    let cx = alinhar === "center" ? x - total / 2 : alinhar === "right" ? x - total : x;
    const gap = alinhar === "justify" && !l.fim && vaos > 0 ? (largura - (total - vaos * esp)) / vaos : esp;
    l.itens.forEach((p, k) => {
      if (k > 0 && !p.cola) { if (extra.sublinhado) { ctx.fillStyle = cores.n; ctx.fillRect(cx, base + bloco.tam * 0.12, gap, Math.max(2, bloco.tam * 0.06)); } cx += gap; }
      ctx.font = bloco.f[p.e]; ctx.fillStyle = cores[p.e] || cores.n;
      ctx.fillText(p.t, cx, base);
      if (extra.sublinhado) ctx.fillRect(cx, base + bloco.tam * 0.12, p.w, Math.max(2, bloco.tam * 0.06));
      cx += p.w;
    });
  });
  return y + bloco.linhas.length * bloco.tam * bloco.entre;
}
const serifa = (estilo = "") => (t) => ({ n: `${estilo} 400 ${t}px ${FONTE_SERIFA}`.trim(), a: `italic 700 ${t}px ${FONTE_SERIFA}`, b: `${estilo} 700 ${t}px ${FONTE_SERIFA}`.trim() });
const serifaItalica = (t) => ({ n: `italic 700 ${t}px ${FONTE_SERIFA}`, a: `italic 700 ${t}px ${FONTE_SERIFA}`, b: `italic 700 ${t}px ${FONTE_SERIFA}` });
const bastao = (peso = 500) => (t) => ({ n: `${peso} ${t}px ${FONTE_BASTAO}`, a: `italic 700 ${t * 1.08}px ${FONTE_SERIFA}`, b: `800 ${t}px ${FONTE_BASTAO}` });

/* ---------- Objetos de papel ---------- */
function retanguloRedondo(ctx, x, y, w, h, r, cor) {
  ctx.fillStyle = cor; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath(); ctx.fill();
}
let granulado = null;
function texturaPapel(ctx, forca = 0.07) {
  if (!granulado) {
    granulado = document.createElement("canvas"); granulado.width = granulado.height = 240;
    const g = granulado.getContext("2d"), d = g.createImageData(240, 240);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  ctx.save(); ctx.globalAlpha = forca; ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(granulado, "repeat"); ctx.fillRect(0, 0, W_CAR, H_CAR); ctx.restore();
}
function caixaPapel(ctx, x, y, w, h, r, cor, sombra) {
  ctx.save();
  if (sombra) { ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 36; ctx.shadowOffsetY = 14; }
  retanguloRedondo(ctx, x, y, w, h, r, cor); ctx.restore();
}
function girar(ctx, cx, cy, graus, desenho) { ctx.save(); ctx.translate(cx, cy); ctx.rotate((graus * Math.PI) / 180); desenho(); ctx.restore(); }
function fotoCobre(ctx, img, x, y, w, h, foco = 0.35) {
  if (!img) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#5b5248"); g.addColorStop(1, "#2b241c");
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = `600 ${Math.max(22, Math.min(40, w / 16))}px ${FONTE_BASTAO}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("sua foto aqui", x + w / 2, y + h / 2); return;
  }
  const esc = Math.max(w / img.width, h / img.height), iw = img.width * esc, ih = img.height * esc;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * foco, iw, ih); ctx.restore();
}
function fotoRedonda(ctx, img, x, y, w, h, r, foco) { ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.clip(); fotoCobre(ctx, img, x, y, w, h, foco); ctx.restore(); }
function estrelaPapel(ctx, cx, cy, raio, cor, pontas = 12) {
  ctx.fillStyle = cor; ctx.beginPath();
  for (let i = 0; i < pontas * 2; i++) { const r = i % 2 ? raio * 0.55 : raio, a = (Math.PI * i) / pontas; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
  ctx.closePath(); ctx.fill();
}
function fita(ctx, cx, cy, graus) { girar(ctx, cx, cy, graus, () => { ctx.fillStyle = "rgba(226,210,174,.82)"; ctx.fillRect(-80, -26, 160, 52); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(-80, -26, 160, 10); }); }
function clipe(ctx, cx, cy, graus) {
  girar(ctx, cx, cy, graus, () => {
    ctx.strokeStyle = "#a9a9a9"; ctx.lineWidth = 7; ctx.lineCap = "round";
    const laco = (w, h, x0) => { ctx.beginPath(); ctx.moveTo(x0, h / 2); ctx.lineTo(x0, -h / 2 + w / 2); ctx.arc(x0 + w / 2, -h / 2 + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x0 + w, h / 2 - 10); ctx.stroke(); };
    laco(46, 150, -23); laco(30, 110, -15);
  });
}
function espacado(ctx, texto, x, y, espaco, alinhar = "center") {
  const letras = [...texto]; const ws = letras.map((c) => ctx.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + espaco * (letras.length - 1);
  let cx = alinhar === "center" ? x - total / 2 : alinhar === "right" ? x - total : x;
  ctx.textAlign = "left"; letras.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + espaco; });
}
function cabecalhoSlide(ctx, cor, i, total) {
  ctx.save(); ctx.fillStyle = cor; ctx.globalAlpha = 0.6; ctx.textBaseline = "alphabetic";
  ctx.font = `600 22px ${FONTE_BASTAO}`; espacado(ctx, `${ASSINATURA.nome}  |  ${ASSINATURA.cargo}`, W_CAR / 2, 74, 3);
  ctx.font = `500 22px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.fillText(ASSINATURA.arroba, M_CAR, H_CAR - 52);
  ctx.textAlign = "right"; ctx.fillText(`${i + 1}/${total}`, W_CAR - M_CAR, H_CAR - 52);
  ctx.restore();
}
function marcaDagua(ctx, cor) { ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = cor; ctx.font = `400 104px ${FONTE_SERIFA}`; ctx.textBaseline = "alphabetic"; espacado(ctx, "UGC Creator", W_CAR / 2, H_CAR - 26, 34); ctx.restore(); }
function arraste(ctx, cx, cy, cor) {
  ctx.save(); ctx.font = `italic 400 30px ${FONTE_SERIFA}`; const w = ctx.measureText("Arraste a tela").width + 50;
  ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - w / 2 - 20, cy - 24, w, 48, 24) : ctx.rect(cx - w / 2 - 20, cy - 24, w, 48); ctx.stroke();
  ctx.fillStyle = cor; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Arraste a tela", cx - 20, cy + 1);
  ctx.beginPath(); ctx.moveTo(cx + w / 2 - 14, cy); ctx.lineTo(cx + w / 2 + 34, cy); ctx.lineTo(cx + w / 2 + 24, cy - 8); ctx.moveTo(cx + w / 2 + 34, cy); ctx.lineTo(cx + w / 2 + 24, cy + 8); ctx.stroke();
  ctx.restore();
}
function etiqueta(ctx, texto, cx, cy, graus, fundo, cor, tam = 40) {
  girar(ctx, cx, cy, graus, () => {
    ctx.font = `800 ${tam}px ${FONTE_BASTAO}`; const w = ctx.measureText(texto).width + tam * 1.1, h = tam * 1.6;
    ctx.fillStyle = fundo; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = cor; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(texto, 0, 2);
  });
}

/* ---------- Desenha um slide ---------- */
function pintarSlide(cv, s, i, total, temaChave, aoCarregar) {
  const T = TEMAS_CARROSSEL[temaChave] || TEMAS_CARROSSEL.ryan;
  const ctx = cv.getContext("2d"), W = W_CAR, H = H_CAR, M = M_CAR, LW = W - M * 2;
  cv.width = W; cv.height = H;
  const tom = T[s.tom] || T[{ texto: "escuro", lista: "claro", numero: "claro", moldura: "claro", polaroid: "claro", colagem: "claro", final: "escuro" }[s.modelo] || "claro"];
  const foco = { topo: 0.15, meio: 0.45, baixo: 0.8 }[s.enquadrar] ?? 0.3;
  const f1 = fotoCarrossel(s.foto, aoCarregar), f2 = fotoCarrossel(s.foto2, aoCarregar);
  const fundoTom = () => { ctx.fillStyle = tom.fundo; ctx.fillRect(0, 0, W, H); texturaPapel(ctx); };
  const cores = (c) => ({ n: c.titulo, a: c.destaque, b: c.titulo });

  switch (s.modelo) {
    case "capa": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco);
      const g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.72)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); texturaPapel(ctx, 0.05);
      const t = caberRico(ctx, s.titulo, { fontes: serifa(), max: 104, min: 56, largura: LW, altura: 420, entre: 1.06 });
      const altT = t.linhas.length * t.tam * t.entre;
      let y = H - 250 - altT;
      if (s.texto) { const p = caberRico(ctx, s.texto, { fontes: bastao(700), max: 40, min: 28, largura: LW, altura: 120, entre: 1.2 }); y -= p.linhas.length * p.tam * p.entre + 16; escreverRico(ctx, p, W / 2, y, { n: "#fff", a: "#fff", b: "#fff" }, "center"); y += p.linhas.length * p.tam * p.entre + 16; }
      if (s.destaque) etiqueta(ctx, s.destaque, W - M - 170, y - 34, -5, T.forte.fundo, T.forte.titulo, 34);
      escreverRico(ctx, t, W / 2, y + (s.destaque ? 14 : 0), { n: "#FFFFFF", a: "#FFFFFF", b: "#FFFFFF" }, "center");
      arraste(ctx, W / 2, H - 175, "rgba(255,255,255,.9)");
      marcaDagua(ctx, "#FFFFFF");
      return;
    }
    case "texto": case "lista": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      const X = 170, LX = W - X - 120;
      ctx.fillStyle = tom.titulo; ctx.font = `500 40px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(String(i + 1).padStart(2, "0") + ".", X - 40, 300);
      const t = caberRico(ctx, s.titulo, { fontes: serifaItalica, max: 110, min: 60, largura: LX, altura: 400, entre: 1.02 });
      let y = escreverRico(ctx, t, X, 330, cores(tom)) + 46;
      if (s.modelo === "texto") {
        const b = caberRico(ctx, s.texto, { fontes: bastao(500), max: 46, min: 28, largura: LX, altura: H - 160 - y, entre: 1.32 });
        escreverRico(ctx, b, X, y, { n: tom.texto, a: tom.destaque, b: tom.texto }, "left", LX);
      } else {
        const itens = String(s.texto || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 7);
        const esp = Math.min(190, (H - 170 - y) / Math.max(1, itens.length));
        itens.forEach((it, k) => {
          const yy = y + k * esp;
          ctx.fillStyle = tom.destaque; ctx.font = `italic 700 54px ${FONTE_SERIFA}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
          ctx.fillText(String(k + 1).padStart(2, "0"), X - 40, yy + 46);
          const b = caberRico(ctx, it, { fontes: bastao(500), max: 42, min: 28, largura: LX - 60, altura: esp - 20, entre: 1.25 });
          escreverRico(ctx, b, X + 50, yy + 4, { n: tom.texto, a: tom.destaque, b: tom.texto });
        });
      }
      return;
    }
    case "numero": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      let y = 420;
      if (s.texto2) { ctx.fillStyle = tom.titulo; ctx.font = `700 46px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(s.texto2).toUpperCase(), M, y); y += 20; }
      const t = caberRico(ctx, s.titulo, { fontes: (n) => ({ n: `800 ${n}px ${FONTE_BASTAO}`, a: `italic 700 ${n}px ${FONTE_SERIFA}`, b: `800 ${n}px ${FONTE_BASTAO}` }), max: 180, min: 80, largura: LW, altura: 520, entre: 0.98, maiusc: true });
      y = escreverRico(ctx, t, M, y, { n: tom.destaque, a: tom.titulo, b: tom.destaque }) + 50;
      if (s.texto) { ctx.fillStyle = tom.texto; ctx.font = `600 32px ${FONTE_BASTAO}`; ctx.textBaseline = "alphabetic"; espacado(ctx, String(s.texto).toUpperCase(), M, y + 30, 4, "left"); }
      return;
    }
    case "moldura": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      if (s.texto2) { const n = caberRico(ctx, s.texto2, { fontes: serifa(), max: 38, min: 26, largura: 300, altura: 200, entre: 1.15 }); escreverRico(ctx, n, W - M, 130, { n: tom.destaque, a: tom.destaque, b: tom.destaque }, "right"); }
      caixaPapel(ctx, W / 2 - 250, 200, 500, 640, 26, "#000", true);
      fotoRedonda(ctx, f1, W / 2 - 250, 200, 500, 640, 26, foco);
      const t = caberRico(ctx, String(s.titulo || "").replace(/\.(\*\*)?\s+/g, ".$1\n"), { fontes: serifa(), max: 86, min: 46, largura: LW, altura: H - 900 - 100, entre: 1.05 });
      escreverRico(ctx, t, M, 900, { n: tom.destaque, a: tom.destaque, b: tom.destaque });
      return;
    }
    case "notas": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco); ctx.fillStyle = "rgba(0,0,0,.12)"; ctx.fillRect(0, 0, W, H);
      const cw = 880, cx = (W - cw) / 2;
      const t = caberRico(ctx, s.titulo, { fontes: (n) => ({ n: `800 ${n}px ${FONTE_BASTAO}`, a: `800 ${n}px ${FONTE_BASTAO}`, b: `800 ${n}px ${FONTE_BASTAO}` }), max: 66, min: 38, largura: cw - 120, altura: 420, entre: 1.18, maiusc: true });
      const ch = Math.max(420, t.linhas.length * t.tam * t.entre + 260), cy = (H - ch) / 2 - 20;
      caixaPapel(ctx, cx, cy, cw, ch, 40, "#FFFFFF", true);
      ctx.fillStyle = "#E0A100"; ctx.font = `500 40px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("‹ Notas", cx + 40, cy + 64);
      [0, 1, 2, 3].forEach((k) => { ctx.strokeStyle = k === 1 ? "#c8c8c8" : "#E0A100"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx + cw - 250 + k * 66, cy + 64, 22, 0, Math.PI * 2); ctx.stroke(); });
      escreverRico(ctx, t, cx + 60, cy + 160, { n: "#3A2A1E", a: "#3A2A1E", b: "#3A2A1E" }, "left", 0, { sublinhado: true });
      if (s.texto2) girar(ctx, cx + cw - 120, cy + ch - 10, -8, () => {
        ctx.font = `500 46px ${FONTE_BASTAO}`; const tx = String(s.texto2), w = ctx.measureText(tx).width + 70;
        retanguloRedondo(ctx, -w / 2, -42, w, 84, 42, "#FFFFFF"); retanguloRedondo(ctx, -w / 2 + 6, -36, w - 12, 72, 36, "#1E7CF2");
        ctx.fillStyle = "#1E7CF2"; ctx.beginPath(); ctx.moveTo(w / 2 - 40, 30); ctx.lineTo(w / 2 + 6, 44); ctx.lineTo(w / 2 - 20, 14); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tx, 0, 2);
      });
      return;
    }
    case "polaroid": {
      fundoTom(); cabecalhoSlide(ctx, tom.titulo, i, total);
      girar(ctx, W / 2, H / 2 + 10, -2.5, () => {
        const pw = 820, ph = 1020;
        caixaPapel(ctx, -pw / 2, -ph / 2, pw, ph, 6, "#FFFFFF", true);
        fotoCobre(ctx, f1, -pw / 2 + 44, -ph / 2 + 44, pw - 88, pw - 88, foco);
        const t = caberRico(ctx, s.titulo, { fontes: (n) => ({ n: `800 ${n}px ${FONTE_BASTAO}`, a: `800 ${n}px ${FONTE_BASTAO}`, b: `800 ${n}px ${FONTE_BASTAO}` }), max: 52, min: 30, largura: pw - 120, altura: ph - pw - 60, entre: 1.15, maiusc: true });
        escreverRico(ctx, t, 0, -ph / 2 + pw + 10, { n: T.claro.destaque, a: T.claro.destaque, b: T.claro.destaque }, "center", 0, { sublinhado: true });
      });
      estrelaPapel(ctx, W - 200, 230, 80, T.acento);
      fita(ctx, 220, 200, -28);
      return;
    }
    case "colagem": {
      fundoTom();
      ctx.fillStyle = tom.titulo; ctx.globalAlpha = 0.75; ctx.font = `600 24px ${FONTE_BASTAO}`; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.fillText("‹ " + ASSINATURA.nome, M + 150, 80);
      [0, 1, 2, 3].forEach((k) => { ctx.strokeStyle = tom.titulo; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(W - M - 230 + k * 30, 72, 10, 0, Math.PI * 2); ctx.stroke(); });
      ctx.globalAlpha = 1;
      const t = caberRico(ctx, s.titulo, { fontes: serifa(), max: 84, min: 50, largura: LW - 60, altura: 300, entre: 1.05 });
      const yT = escreverRico(ctx, t, W / 2, 130, cores(tom), "center");
      const yF = yT + 30, hF = 470;
      girar(ctx, 330, yF + hF / 2, -4, () => { caixaPapel(ctx, -230, -hF / 2, 460, hF, 4, "#FFFFFF", true); fotoCobre(ctx, f1, -216, -hF / 2 + 14, 432, hF - 28, foco); });
      girar(ctx, 760, yF + hF / 2 + 30, 5, () => { caixaPapel(ctx, -220, -hF / 2, 440, hF, 4, "#FFFFFF", true); fotoCobre(ctx, f2 || null, -206, -hF / 2 + 14, 412, hF - 28, foco); });
      clipe(ctx, 210, yF + 10, -12); clipe(ctx, 860, yF + 40, 18);
      const b = caberRico(ctx, s.texto, { fontes: bastao(500), max: 42, min: 28, largura: LW - 40, altura: H - (yF + hF + 70) - 60, entre: 1.3 });
      escreverRico(ctx, b, W / 2, yF + hF + 80, { n: tom.texto, a: tom.destaque, b: tom.texto }, "center");
      return;
    }
    case "cartao": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco); ctx.fillStyle = "rgba(0,0,0,.1)"; ctx.fillRect(0, 0, W, H);
      const cw = 660, X = M + 10;
      const t = caberRico(ctx, s.titulo, { fontes: serifaItalica, max: 74, min: 44, largura: cw - 90, altura: 320, entre: 1.04 });
      const b = s.texto ? caberRico(ctx, s.texto, { fontes: bastao(500), max: 38, min: 26, largura: cw - 90, altura: 240, entre: 1.3 }) : null;
      const ch = 90 + t.linhas.length * t.tam * t.entre + (b ? 30 + b.linhas.length * b.tam * b.entre : 0);
      const Y = 360;
      caixaPapel(ctx, X, Y, cw, ch, 4, "#F7F4EE", true); ctx.save(); ctx.beginPath(); ctx.rect(X, Y, cw, ch); ctx.clip(); texturaPapel(ctx, 0.08); ctx.restore();
      let y = escreverRico(ctx, t, X + 45, Y + 45, { n: T.escuro.fundo, a: T.claro.destaque, b: T.escuro.fundo });
      if (b) escreverRico(ctx, b, X + 45, y + 30, { n: "#3A3128", a: T.claro.destaque, b: "#2B241C" });
      if (s.texto2) {
        const nb = caberRico(ctx, s.texto2, { fontes: bastao(600), max: 40, min: 26, largura: 360, altura: 260, entre: 1.25 });
        const nh = nb.linhas.length * nb.tam * nb.entre + 90, nx = W - M - 220, ny = Y + ch - 40 + nh / 2;
        girar(ctx, nx, ny, 5, () => { caixaPapel(ctx, -210, -nh / 2, 420, nh, 2, T.acento, true); escreverRico(ctx, nb, 0, -nh / 2 + 45, { n: "#fff", a: "#fff", b: "#fff" }, "center"); });
        clipe(ctx, nx + 170, ny - nh / 2 + 10, 20);
      }
      return;
    }
    case "frase": {
      fotoCobre(ctx, f1, 0, 0, W, H, foco); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(0, 0, W, H);
      const t = caberRico(ctx, s.titulo, { fontes: serifa(), max: 68, min: 40, largura: 620, altura: 700, entre: 1.25 });
      escreverRico(ctx, t, W / 2, (H - t.linhas.length * t.tam * t.entre) / 2, { n: "#fff", a: "#fff", b: "#fff" }, "center");
      ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.font = `500 22px ${FONTE_BASTAO}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(ASSINATURA.arroba, M, H - 52);
      ctx.textAlign = "right"; ctx.fillText(`${i + 1}/${total}`, W - M, H - 52);
      return;
    }
    default: { // final
      fundoTom();
      const temFoto = !!s.foto;
      const t = caberRico(ctx, s.titulo, { fontes: bastao(700), max: 56, min: 34, largura: LW, altura: 200, entre: 1.15 });
      let y = escreverRico(ctx, t, W / 2, 110, { n: tom.destaque, a: tom.destaque, b: tom.destaque }, "center") + 40;
      if (temFoto) { caixaPapel(ctx, W / 2 - 300, y, 600, 470, 2, "#F7F4EE", true); fotoCobre(ctx, f1, W / 2 - 280, y + 20, 560, 430, foco); y += 470 + 50; }
      else y = 360;
      if (s.texto) { const b = caberRico(ctx, s.texto, { fontes: bastao(700), max: 54, min: 32, largura: LW, altura: 200, entre: 1.15 }); y = escreverRico(ctx, b, W / 2, y, { n: tom.titulo, a: tom.destaque, b: tom.titulo }, "center") + 24; }
      if (s.destaque) {
        const d = caberRico(ctx, s.destaque, { fontes: bastao(800), max: 44, min: 28, largura: LW - 120, altura: 120, entre: 1.15 });
        const dw = Math.max(...d.linhas.map((l) => l.itens.reduce((a, p) => a + p.w, 0))) + 120, dh = d.linhas.length * d.tam * d.entre + 40;
        ctx.fillStyle = tom.destaque; ctx.fillRect(W / 2 - dw / 2, y, dw, dh);
        escreverRico(ctx, d, W / 2, y + 20, { n: tom.fundo, a: tom.fundo, b: tom.fundo }, "center"); y += dh;
      }
      if (s.texto2) { ctx.fillStyle = tom.titulo; ctx.font = `400 110px ${FONTE_MAO}`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillText(s.texto2, W / 2 + 120, Math.min(H - 90, y + 110)); }
      return;
    }
  }
}

async function carregarCarrosseis() {
  const { data, error } = await db.from("carrosseis").select("*").order("atualizado_em", { ascending: false }).limit(60);
  igx.carrosseis = error ? [] : data || [];
  igx.faltaCarrosseis = !!error;
}
const novoSlide = (modelo) => ({ modelo, titulo: "", texto: "" });

function desenharCarrossel(el) {
  if (igx.carrosseis === null) { el.innerHTML = `<p class="vazio">Abrindo o gerador...</p>`; Promise.all([carregarCarrosseis(), carregarFontesCarrossel()]).then(desenhar); return; }
  if (igx.faltaCarrosseis) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 27 do banco.sql no Supabase.</div>`; return; }
  if (!igx.car) igx.car = JSON.parse(JSON.stringify(CARROSSEL_EXEMPLO));
  const car = igx.car;
  car.slides.forEach((s) => { if (!MODELOS_SLIDE.some((m) => m[0] === s.modelo)) s.modelo = s.modelo === "comparacao" ? "cartao" : "texto"; });
  if (!TEMAS_CARROSSEL[car.tema]) car.tema = "ryan";
  const T = TEMAS_CARROSSEL[car.tema];
  let guiaAberto = false; try { guiaAberto = localStorage.getItem("ig-guia") === "1"; } catch (_) {}
  const amostra = (k) => `<span class="car-amostra" style="background:${T[k].fundo};color:${T[k].titulo}"><b>Aa</b><i style="color:${T[k].destaque}">Aa</i></span>`;

  const campoHtml = (s, i, c) => {
    const rot = (ROTULOS_CAMPO[s.modelo] || {})[c] || c;
    if (c === "tom") return `<label class="car-campo-curto">Fundo <select class="campo" data-k="tom">${[["claro", "Claro"], ["escuro", "Escuro"], ["forte", "Cor forte"]].map(([v, n]) => `<option value="${v}" ${(s.tom || "") === v ? "selected" : ""}>${n}</option>`).join("")}<option value="" ${!s.tom ? "selected" : ""}>Padrão</option></select></label>`;
    if (c === "foto" || c === "foto2") return `<div class="car-foto">
        ${s[c] ? `<img src="${esc(s[c])}" alt="" crossorigin="anonymous">` : `<span class="car-foto-vazia">📷</span>`}
        <label class="btn pequeno">${s[c] ? "Trocar foto" : c === "foto2" ? "Segunda foto" : "Subir foto"}<input type="file" accept="image/*" data-foto="${c}" hidden></label>
        ${s[c] ? `<button class="btn pequeno" type="button" data-tirar-foto="${c}">Tirar</button>` : ""}
        ${c === "foto" && s.foto ? `<select class="campo" data-k="enquadrar" aria-label="Enquadrar">${[["", "Enquadrar: auto"], ["topo", "Mostrar o topo"], ["meio", "Centro"], ["baixo", "Mostrar embaixo"]].map(([v, n]) => `<option value="${v}" ${(s.enquadrar || "") === v ? "selected" : ""}>${n}</option>`).join("")}</select>` : ""}
        ${s.dicaFoto && c === "foto" ? `<small class="sub">Sugestão: ${esc(s.dicaFoto)}</small>` : ""}
      </div>`;
    const longo = (c === "texto" && ["texto", "lista", "colagem", "cartao"].includes(s.modelo)) || (c === "titulo" && ["notas", "frase", "moldura"].includes(s.modelo));
    return longo ? `<textarea class="campo" data-k="${c}" rows="${s.modelo === "lista" && c === "texto" ? 4 : 2}" placeholder="${esc(rot)}">${esc(s[c] || "")}</textarea>`
      : `<input class="campo" data-k="${c}" value="${esc(s[c] || "")}" placeholder="${esc(rot)}">`;
  };

  el.innerHTML = `
    <details class="cartao car-guia" id="car-guia" ${guiaAberto ? "open" : ""}>
      <summary><b>🎨 O seu sistema visual</b> <span class="sub">o jeito Ryan de fazer carrossel</span></summary>
      <div class="car-guia-grade">
        <div><h3 class="pro-titulo">Paleta: ${esc(T.nome)}</h3>
          <div class="car-tons">${amostra("claro")}${amostra("escuro")}${amostra("forte")}</div>
          <p class="sub">Use sempre a mesma paleta. Troque só se for uma série especial.</p></div>
        <div><h3 class="pro-titulo">Letras</h3>
          <p class="car-f-serifa">Playfair Display <i>itálica</i></p>
          <p class="car-f-bastao">MONTSERRAT GROSSA</p>
          <p class="car-f-mao">Allura, a letra de mão</p></div>
        <div><h3 class="pro-titulo">Sua assinatura</h3>
          <ul class="passos"><li>Foto sua na capa, sempre. Rosto aparece, carrossel rende.</li><li>"Arraste a tela →" e a marca d'água UGC Creator na capa.</li><li>RYAN ALVES | UGC CREATOR no topo dos slides de texto.</li><li>Só uma palavra destacada por título.</li></ul></div>
        <div><h3 class="pro-titulo">Regras de ouro</h3>
          <ul class="passos"><li>1 ideia por slide, no máximo 30 palavras.</li><li>Capa: promessa clara em até 10 palavras.</li><li>De 5 a 8 slides. Alterne foto e texto.</li><li>Último slide: chamada (salvar, seguir ou link na bio).</li><li>Legenda: repita o gancho na primeira linha.</li></ul></div>
      </div>
    </details>

    <section class="cartao car-barra">
      <input class="campo" id="car-titulo" value="${esc(car.titulo)}" aria-label="Nome do carrossel" placeholder="Nome do carrossel">
      <select class="campo" id="car-tema" aria-label="Paleta">${Object.entries(TEMAS_CARROSSEL).map(([k, t]) => `<option value="${k}" ${car.tema === k ? "selected" : ""}>🎨 ${esc(t.nome)}</option>`).join("")}</select>
      <span class="espaco"></span>
      <select class="campo" id="car-abrir" aria-label="Abrir carrossel salvo"><option value="">📂 Abrir salvo (${igx.carrosseis.length})</option>${igx.carrosseis.map((c) => `<option value="${esc(c.id)}">${esc(c.titulo)} · ${dataBR(String(c.atualizado_em).slice(0, 10)).slice(0, 5)}</option>`).join("")}</select>
      <button class="btn" type="button" id="car-novo">Novo</button>
      <button class="btn" type="button" id="car-salvar">💾 Salvar</button>
      <button class="btn primario" type="button" id="car-baixar">⬇️ Baixar imagens</button>
    </section>
    <p class="sub car-ajuda">Dica: escreva <b>*palavra*</b> para itálico colorido e <b>**palavra**</b> para negrito.</p>

    <div class="car-grade">
      <div class="car-slides" id="car-slides">${car.slides.map((s, i) => {
        const mod = MODELOS_SLIDE.find((m) => m[0] === s.modelo) || MODELOS_SLIDE[1];
        return `<div class="cartao car-slide" data-i="${i}">
          <div class="car-slide-topo"><b>${i + 1}</b>
            <select class="campo" data-k="modelo" aria-label="Modelo do slide ${i + 1}">${MODELOS_SLIDE.map(([v, n]) => `<option value="${v}" ${s.modelo === v ? "selected" : ""}>${n}</option>`).join("")}</select>
            <span class="espaco"></span>
            <button class="btn pequeno" type="button" data-mover="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
            <button class="btn pequeno" type="button" data-mover="1" ${i === car.slides.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
            <button class="btn pequeno" type="button" data-copiar-slide aria-label="Duplicar slide">⧉</button>
            <button class="btn pequeno" type="button" data-tirar aria-label="Tirar slide">✕</button></div>
          ${mod[3].map((c) => campoHtml(s, i, c)).join("")}
          <p class="sub car-dica">${esc(mod[2])} ${palavrasDe(s) > 30 ? `<b class="car-muito">${palavrasDe(s)} palavras: tente deixar em 30.</b>` : ""}</p>
        </div>`; }).join("")}
        <div class="car-mais">
          <select class="campo" id="car-modelo-novo" aria-label="Modelo do slide novo">${MODELOS_SLIDE.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select>
          <button class="btn" type="button" id="car-mais" ${car.slides.length >= 10 ? "disabled" : ""}>${ic("mais")}Slide</button>
        </div>
      </div>
      <div class="car-previa" id="car-previa">${car.slides.map((_, i) => `<canvas class="car-tela" data-tela="${i}" width="1080" height="1350" aria-label="Prévia do slide ${i + 1}"></canvas>`).join("")}</div>
    </div>`;

  const pintarUm = (i) => { const cv = $(`[data-tela="${i}"]`, el); if (cv && car.slides[i]) pintarSlide(cv, car.slides[i], i, car.slides.length, car.tema, () => pintarUm(i)); };
  const pintarTudo = () => car.slides.forEach((_, i) => pintarUm(i));
  pintarTudo();
  carregarFontesCarrossel().then(pintarTudo);

  $("#car-guia").addEventListener("toggle", (e) => { try { localStorage.setItem("ig-guia", e.target.open ? "1" : "0"); } catch (_) {} });
  $("#car-titulo").oninput = (e) => { car.titulo = e.target.value; };
  $("#car-tema").onchange = (e) => { car.tema = e.target.value; desenhar(); };
  let espera = null;
  $("#car-slides").addEventListener("input", (e) => {
    const box = e.target.closest(".car-slide"), k = e.target.dataset.k;
    if (!box || !k || k === "modelo" || e.target.tagName === "SELECT") return;
    const i = Number(box.dataset.i);
    car.slides[i][k] = e.target.value;
    clearTimeout(espera); espera = setTimeout(() => pintarUm(i), 120);
  });
  $("#car-slides").addEventListener("change", async (e) => {
    const box = e.target.closest(".car-slide"); if (!box) return;
    const i = Number(box.dataset.i), s = car.slides[i];
    if (e.target.dataset.k === "modelo") { s.modelo = e.target.value; desenhar(); return; }
    if (e.target.tagName === "SELECT" && e.target.dataset.k) { s[e.target.dataset.k] = e.target.value; pintarUm(i); return; }
    const campoFoto = e.target.dataset.foto;
    if (campoFoto && e.target.files && e.target.files[0]) {
      const rotulo = e.target.closest("label"); rotulo.firstChild.textContent = "Enviando...";
      try {
        const arq = await prepararFoto(e.target.files[0]);
        const url = await enviarArquivo(arq, "carrosseis", "foto.jpg");
        if (url) { s[campoFoto] = url; desenhar(); avisar("Foto no slide."); }
        else rotulo.firstChild.textContent = "Subir foto";
      } catch (erro) { avisar(erro.message || "Não deu para usar essa foto.", true); rotulo.firstChild.textContent = "Subir foto"; }
    }
  });
  $("#car-slides").addEventListener("click", (e) => {
    const box = e.target.closest(".car-slide"); if (!box) return;
    const i = Number(box.dataset.i);
    const mv = e.target.closest("[data-mover]");
    if (mv) { const j = i + Number(mv.dataset.mover); [car.slides[i], car.slides[j]] = [car.slides[j], car.slides[i]]; desenhar(); return; }
    if (e.target.closest("[data-copiar-slide]")) { if (car.slides.length >= 10) { avisar("No máximo 10 slides.", true); return; } car.slides.splice(i + 1, 0, JSON.parse(JSON.stringify(car.slides[i]))); desenhar(); return; }
    const tf = e.target.closest("[data-tirar-foto]"); if (tf) { delete car.slides[i][tf.dataset.tirarFoto]; desenhar(); return; }
    if (e.target.closest("[data-tirar]")) { if (car.slides.length <= 1) { avisar("O carrossel precisa de pelo menos 1 slide.", true); return; } car.slides.splice(i, 1); desenhar(); }
  });
  $("#car-mais").onclick = () => { const novo = novoSlide($("#car-modelo-novo").value); const fim = car.slides[car.slides.length - 1]; if (fim && fim.modelo === "final") car.slides.splice(car.slides.length - 1, 0, novo); else car.slides.push(novo); desenhar(); };
  $("#car-novo").onclick = () => { igx.car = { titulo: "Novo carrossel", tema: car.tema, slides: [novoSlide("capa"), { ...novoSlide("texto"), tom: "escuro" }, { ...novoSlide("final"), tom: "escuro", destaque: "Salva esse post", texto2: "Link na bio" }] }; desenhar(); };
  $("#car-abrir").onchange = (e) => {
    const c = igx.carrosseis.find((x) => String(x.id) === e.target.value); if (!c) return;
    const dados = Array.isArray(c.slides) ? { slides: c.slides } : c.slides || {};
    igx.car = { id: c.id, titulo: c.titulo, tema: dados.tema || "ryan", slides: JSON.parse(JSON.stringify(dados.slides || [])) }; desenhar();
  };
  $("#car-salvar").onclick = async () => {
    const dados = { titulo: (car.titulo || "Carrossel").slice(0, 200), slides: { tema: car.tema, slides: car.slides }, atualizado_em: new Date().toISOString() };
    const { data, error } = await (car.id ? db.from("carrosseis").update(dados).eq("id", car.id).select().single() : db.from("carrosseis").insert(dados).select().single());
    if (error) { avisar(traduzErro(error), true); return; }
    car.id = data.id; await carregarCarrosseis(); avisar("Carrossel salvo."); desenhar();
  };
  $("#car-baixar").onclick = async (e) => {
    const b = e.target; b.disabled = true; b.textContent = "Preparando...";
    try {
      await carregarFontesCarrossel(); await esperarFotos(car.slides);
      const nome = (car.titulo || "carrossel").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "carrossel";
      const arquivos = [];
      for (let i = 0; i < car.slides.length; i++) {
        const cv = document.createElement("canvas");
        pintarSlide(cv, car.slides[i], i, car.slides.length, car.tema);
        const blob = await new Promise((ok) => cv.toBlob(ok, "image/jpeg", 0.93));
        arquivos.push(new File([blob], `${nome}-${String(i + 1).padStart(2, "0")}.jpg`, { type: "image/jpeg" }));
      }
      // No celular: abre o "compartilhar" para salvar tudo nas Fotos de uma vez
      if (navigator.canShare && navigator.canShare({ files: arquivos }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await navigator.share({ files: arquivos, title: car.titulo }).catch(() => {});
      } else {
        for (const f of arquivos) {
          const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          await new Promise((ok) => setTimeout(ok, 350));
        }
        avisar(`${plural(arquivos.length, "imagem", "imagens")} na pasta Downloads (1080 x 1350, o tamanho certo do Instagram).`);
      }
    } catch (erro) { avisar("Não deu para gerar as imagens: " + (erro.message || erro), true); }
    b.disabled = false; b.textContent = "⬇️ Baixar imagens";
  };
}
const palavrasDe = (s) => [s.titulo, s.texto, s.texto2, s.destaque].join(" ").replace(/\*/g, "").split(/\s+/).filter(Boolean).length;

/* =============================================================
   🗣️ MINHA VOZ: roteiros prontos para gravar, do seu jeito
   O guia de voz fica no banco (preferencias, chave "guia_voz").
   Cada ideia tem o botão "✍️ Roteiro na minha voz", que junta o
   guia, a ideia, a referência e o formato certo num pedido pronto
   para colar no Claude.
   ============================================================= */
const VOZ_PADRAO = `QUEM GRAVA
Ryan Alves (@ryalvz), creator de UGC focado em conversão. 12 anos em venda B2B no atacado de moda (vendendo para dono de loja) antes do UGC. Nichos: tech e lifestyle, moda e grooming. Também faz curadoria de TikTok Shop.
Escreva no masculino quando a fala ou a cena for minha ("cansado", "aponto pros meus poros").
Público padrão: consumidor final. Lojista só quando o briefing pedir.

TOM
Conversa de café. Íntimo, sem pressa, honesto. Autoridade sem pose, sem amadorismo engraçadinho.
Português falado, primeira pessoa, frases curtas, ritmo ágil. Se travar na boca, reescreva.

A EXPERIÊNCIA EM VENDAS VIRA TÉCNICA
Antecipe a objeção principal antes que ela vire motivo para rolar a tela: vale o que custa? funciona pra mim? vou usar mesmo? posso confiar na loja?
Responda com prova: mostrar, usar, comparar com a rotina.
Um benefício principal por vídeo, dito do jeito que o cliente falaria.
Fechamento que conduz: uma ação clara e o motivo para fazer agora, sem urgência inventada.
Os 12 anos em vendas só viram gancho em conteúdo sobre venda, negócio, carreira de creator ou para lojista.

ESTRUTURA
Para marca: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO.
Conteúdo de valor no meu perfil: GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO.
Se o briefing da marca trouxer estrutura própria, ela vence.
Gancho para o dedo nos 3 primeiros segundos, com dor grande e comum. Sempre mais de uma opção (em anúncio, 2 ou 3 para gravar todas).
Mudança perceptível do começo ao fim. O produto entra como consequência da história. Toda afirmação tem prova na tela.
CTA com uma ação só. Palavra de gatilho única, sem espaço, igual no vídeo, na legenda e na automação.

DURAÇÃO
Meu ritmo: 3,25 palavras por segundo. Duração = palavras faladas ÷ 3,25. Demonstração de tela e unboxing somam respiro por fora.

PROIBIDO
Travessão.
Negação seguida de correção: "não é X, é Y", "o problema não é X, é Y", "não é só X, é Y" e variações.
Falsa revelação: "aí eu descobri", "foi aí que", "foi quando", "até que", "aí eu conheci", "hoje eu descobri".
"é o tipo de...", "se você ainda tá no ciclo de...", "você já reparou que...", "tem produtos que... e tem produtos que...", "você sabia que" como gancho, "e sinceramente?", "isso muda tudo", "isso muda o jogo", "olá pessoal", "hoje vou falar sobre", "queria compartilhar com vocês", "hoje vim indicar um app".
Fala picotada linha por linha para dar falso impacto. Frase bonita demais para ser falada. Lista de funcionalidades sem história. Palavra de interface na boca.
Inventar número, dado, data, preço, funcionalidade ou resultado meu. O que não se sabe vira campo entre parênteses, ex.: (quantos GB voltaram).
Promessa de resultado financeiro sem base. Acusar concorrente. Alimento ou suplemento prometendo efeito terapêutico.`;
let vozGuia = null, vozFalta = false;
async function carregarVoz() {
  if (vozGuia !== null) return vozGuia;
  const { data, error } = await db.from("preferencias").select("valor").eq("chave", "guia_voz").maybeSingle();
  vozFalta = !!error;
  vozGuia = (data && data.valor) || VOZ_PADRAO;
  return vozGuia;
}

const FORMATO_ROTEIRO = {
  organico: `FORMATO: Reels de conteúdo de valor para o MEU Instagram (Tech & Lifestyle e bastidores de UGC).
Estrutura: GANCHO, CONTEXTO, CONTEÚDO, FECHAMENTO. De 30 a 60 segundos (uns 100 a 195 palavras no meu ritmo).
O objetivo é alcance, salvamento e seguidores novos. Sem produto de marca, a não ser que a ideia peça.`,
  tiktok_shop: `FORMATO: vídeo de venda para o TikTok Shop (afiliado), falando com consumidor final.
Estrutura: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO. De 15 a 40 segundos.
Produto em uso na mão, um benefício principal com prova na tela, a objeção principal respondida, chamada para o carrinho laranja. Preço ou oferta só se eu informar.`,
  publi: `FORMATO: vídeo UGC para uma marca (publi).
Estrutura: GANCHO, IDENTIFICAÇÃO, SOLUÇÃO, PROVA, FECHAMENTO, a não ser que o briefing traga a estrutura dele. Briefing é lei: antes de escrever, liste obrigatórios e proibidos e aponte o que estiver faltando ou contraditório.
Falas obrigatórias literais. Ofereça 2 ou 3 ganchos para gravar todos.`
};

function roteiroNaMinhaVoz(t) {
  Promise.all([carregarVoz(), carregarDna()]).then(([voz, dna]) => {
    const cat = FORMATO_ROTEIRO[t.categoria] ? t.categoria : "organico";
    const montar = () => `Você vai escrever um roteiro pronto para eu gravar, do MEU jeito de falar.

MEU GUIA DE VOZ (siga à risca)
${voz}

${FORMATO_ROTEIRO[cat]}
${cat === "organico" ? `
O QUE JÁ FUNCIONOU NO MEU PERFIL (encaixe a ideia na fórmula que mais combina e diga qual no ÂNGULO)
${dna}
` : ""}
A IDEIA
Título: ${t.titulo || "sem título"}
${t.minha_versao ? `O que eu já anotei:\n${t.minha_versao}\n` : ""}${t.observacoes ? `Observações:\n${t.observacoes}\n` : ""}${t.transcricao ? `Referência (vídeo de ${t.perfil || "outra pessoa"}): use só a ESTRUTURA, nunca copie as frases.\n${String(t.transcricao).slice(0, 2500)}\n` : ""}
Se você tiver a skill "roteiro-ugc", siga ela. Se não, siga o meu guia acima.

ME ENTREGUE ASSIM (use exatamente estes títulos em maiúsculas)
GANCHOS: 3 opções de tipos diferentes, com dor grande e comum.
ROTEIRO: dividido nos blocos da estrutura. Em cada bloco, a fala corrida entre aspas, do jeito que eu falaria, e embaixo a cena em [CENA: ...] escrita em primeira pessoa ("gravo a tela", "aponto pro produto"). Nada de picotar a fala linha por linha.
CHAMADA FINAL: uma ação só.
${cat === "tiktok_shop" ? "LEGENDA: texto do post para o TikTok, curto, com 3 a 5 hashtags." : cat === "publi" ? "LEGENDA: sugestão para a marca, respeitando o briefing." : "LEGENDA: para o Instagram, gancho na primeira linha, o mesmo CTA do vídeo, 1 a 3 emojis e 3 a 5 hashtags."}
DURAÇÃO: quantas palavras faladas, dividido por 3,25, mais o respiro de tela. Se passar do formato, diga qual frase cortar.
DICAS DE GRAVAÇÃO: enquadramento, cenas de apoio e qual cena é a prova do vídeo.
ÂNGULO: em uma linha, por que escolheu esse ângulo.

Antes de entregar, confira contra a lista de proibidos do guia. Nada de número ou resultado inventado: o que eu precisar preencher vai entre parênteses.`;
    const d = abrirJanelaSimples("✍️ Roteiro na minha voz", `
      <p class="sub" style="margin-top:0">O pedido já leva o seu guia de voz, a ideia${t.transcricao ? ", a referência" : ""} e o formato de <b>${esc((CATEGORIAS.find((c) => c[0] === cat) || [0, ""])[1])}</b>.</p>
      <ol class="passos"><li>Toque em <b>Copiar o pedido</b> e cole no Claude.</li><li>Ajuste o que quiser conversando com ele.</li><li>Cole o roteiro final em <b>Minha versão</b> e salve. Pronto pra gravar.</li></ol>
      ${vozGuia === VOZ_PADRAO ? `<p class="sub">Dica: em <b>🗣️ Minha voz</b> (embaixo da lista de roteiros) dá para deixar o guia ainda mais com a sua cara.</p>` : ""}
      <textarea class="campo" id="rv-prompt" rows="10" style="width:100%;font-size:12px" readonly>${esc(montar())}</textarea>`,
      `<a class="btn" href="https://claude.ai/new" target="_blank" rel="noopener">Abrir o Claude ↗</a><button type="button" class="btn primario" id="rv-copiar">📋 Copiar o pedido</button>`);
    $("#rv-copiar", d).onclick = async () => {
      try { await navigator.clipboard.writeText($("#rv-prompt", d).value); $("#rv-copiar", d).textContent = "copiado ✓"; avisar("Pedido copiado. Cole no Claude."); }
      catch (_) { $("#rv-prompt", d).select(); avisar("Selecionei o texto: aperte Cmd + C para copiar.", true); }
    };
  });
}

async function abrirMinhaVoz() {
  const voz = await carregarVoz();
  // Material para o Claude entender o seu jeito: seus roteiros e suas legendas
  const meus = S.transcricoes.filter((t) => t.de_quem === "minha" && (t.minha_versao || t.transcricao || t.legenda)).slice(0, 12);
  let legendas = [];
  if (ig.dados && ig.dados.posts) legendas = ig.dados.posts.filter((x) => x.legenda && n2(x.reach)).sort((a, b) => n2(b.reach) - n2(a.reach)).slice(0, 15);
  const pedidoGuia = () => `Leia os meus textos abaixo (roteiros e legendas que eu mesmo escrevi) e monte o meu GUIA DE VOZ para roteiros, no mesmo formato do guia atual: QUEM EU SOU, MEU TOM, COMO EU ESCREVO E FALO, COMO EU ABRO, COMO EU FECHO, O QUE FUNCIONA COMIGO, O QUE EVITAR.
Use exemplos reais tirados dos meus textos. Seja específico (palavras que eu repito, tamanho das frases, tipo de humor). Não use travessão. Me devolva só o guia, pronto para colar.

GUIA ATUAL
${voz}

MEUS ROTEIROS
${meus.map((t) => `### ${t.titulo || "sem título"}\n${String(t.minha_versao || t.transcricao || t.legenda).slice(0, 1500)}`).join("\n\n") || "(ainda não tenho roteiros meus salvos)"}

MINHAS LEGENDAS COM MAIS ALCANCE
${legendas.map((x) => `- (${num(x.reach)} de alcance) ${String(x.legenda).replace(/\s+/g, " ").slice(0, 600)}`).join("\n") || "(abra a aba Instagram antes para eu juntar as legendas)"}`;
  const d = abrirJanelaSimples("🗣️ Minha voz", `
    <p class="sub" style="margin-top:0">É o jeito como você fala. Todo "✍️ Roteiro na minha voz" usa este guia. Quanto mais parecido com você, menos você precisa mexer antes de gravar.</p>
    ${vozFalta ? `<div class="aviso-falta">Falta rodar a parte 28 do banco.sql no Supabase para o guia ficar salvo.</div>` : ""}
    <textarea class="campo" id="vz-texto" rows="14" style="width:100%;font-size:13px">${esc(voz)}</textarea>
    <details style="margin-top:10px"><summary><b>Deixar o guia mais a minha cara com o Claude</b></summary>
      <ol class="passos" style="margin-top:8px"><li>Copie o pedido: ele junta ${plural(meus.length, "roteiro seu", "roteiros seus")} e ${plural(legendas.length, "legenda", "legendas")} dos seus posts.</li><li>Cole no Claude e copie o guia que ele devolver.</li><li>Cole aqui em cima no lugar do texto e salve.</li></ol>
      <button type="button" class="btn" id="vz-pedido">📋 Copiar o pedido</button>
    </details>`,
    `<button type="button" class="btn" data-fechar>Fechar</button><button type="button" class="btn primario" id="vz-salvar">💾 Salvar</button>`);
  $("#vz-pedido", d).onclick = async () => { try { await navigator.clipboard.writeText(pedidoGuia()); avisar("Pedido copiado. Cole no Claude."); } catch (_) { avisar("Não deu para copiar.", true); } };
  $("#vz-salvar", d).onclick = async () => {
    const valor = $("#vz-texto", d).value.trim();
    if (!valor) { avisar("O guia não pode ficar vazio.", true); return; }
    const { error } = await db.from("preferencias").upsert({ chave: "guia_voz", valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
    if (error) { avisar("Falta rodar a parte 28 do banco.sql no Supabase.", true); return; }
    vozGuia = valor; vozFalta = false; d.close(); avisar("Guia de voz salvo. Os próximos roteiros já saem assim.");
  };
}

/* ---------- 👁️ Tudo de um post do plano numa janela ----------
   Junta o que está no plano (gancho, por quê), o roteiro das ideias
   citadas (#34 etc.: ganchos, roteiro, chamada, legenda, hashtags,
   dicas) e o trecho da pesquisa que fala do post. Cada parte tem
   o seu botão de copiar. */
const SECOES_ROTEIRO = [["ganchos", /^(GANCHOS|OP[ÇC][ÕO]ES DE GANCHO)\b/i], ["duracao", /^DURA[ÇC][ÃA]O\b/i], ["angulo", /^(ÂNGULO|ANGULO)\b/i], ["filmar", /^O QUE FILMAR\b/i], ["roteiro", /^ROTEIRO\b/i], ["chamada", /^CHAMADA( FINAL)?\b/i], ["legenda", /^(LEGENDA|TEXTO DO POST)\b/i], ["dicas", /^DICAS( DE GRAVA[ÇC][ÃA]O)?\b/i], ["anotacao", /^ANOTA[ÇC][ÃA]O ORIGINAL\b/i]];
function partesDoRoteiro(texto) {
  const partes = {}; let atual = "inicio";
  String(texto || "").split("\n").forEach((bruta) => {
    const l = bruta.replace(/^[#>\s*]+/, "").replace(/^\d+[.)]\s*/, "").replace(/\*\*/g, "").trim();
    // Título de parte: "GANCHOS", "**Legenda**", "3. CHAMADA FINAL:", "## Roteiro"
    const semParenteses = l.replace(/\(.*?\)/g, "").replace(/:.*$/, "").trim();
    const ehTitulo = l.length < 100 && (semParenteses === semParenteses.toUpperCase() || /:\s*$/.test(l) || /^\s*(#|\*\*|\d+[.)])/.test(bruta));
    const achou = ehTitulo && SECOES_ROTEIRO.find(([, re]) => re.test(l));
    if (achou) { atual = achou[0]; partes[atual] = []; return; }
    (partes[atual] = partes[atual] || []).push(bruta);
  });
  Object.keys(partes).forEach((k) => { partes[k] = partes[k].join("\n").trim(); if (!partes[k]) delete partes[k]; });
  return partes;
}
// Só a frase do gancho: o que está entre aspas, sem o "(tipo de gancho)" do lado
const ganchosDe = (txt) => String(txt || "").split("\n").map((l) => {
  const entreAspas = l.match(/["“]([^"”]{4,})["”]/);
  return (entreAspas ? entreAspas[1] : l.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").replace(/\s*\([^)]*\)\s*$/, "")).trim();
}).filter((l) => l.length > 3);
const hashtagsDe = (txt) => [...new Set((String(txt || "").match(/#[\p{L}\d_]+/gu) || []))];

function abrirPostDoPlano(plano, it, evento) {
  const numeros = [...String(it.tema || "").matchAll(/#(\d+)/g)].map((m) => m[1]);
  const ideias = numeros.map((n) => S.transcricoes.find((t) => String(t.id) === n)).filter(Boolean);
  const dia = (DIAS_PLANO.find((x) => x[0] === it.dia) || [0, 0, it.dia]);
  const data = somaDiasISO(dia[1] || 0, plano.semana);
  const car = ((plano.itens || {}).carrosseis || []).find((c) => semAcento(c.titulo).includes(semAcento(String(it.tema).replace(/#\d+\s*/g, "")).slice(0, 16)));
  // Trecho da pesquisa que fala deste post (fora a própria linha do plano)
  const chaves = [...numeros.map((n) => "#" + n), semAcento(String(it.tema).replace(/#\d+\s*/g, "")).slice(0, 18)].filter((x) => x.length > 2);
  const trechos = String(plano.resposta || "").split("\n").map((l) => l.trim()).filter((l) => l && !/^(SEG|TER|QUA|QUI|SEX|S[AÁ]B|DOM)\s*\|/i.test(l.replace(/^[|*\s-]+/, "")) && chaves.some((c) => semAcento(l).includes(semAcento(c)))).slice(0, 6);

  const copiaveis = [];
  const btnCopiar = (texto, rotulo = "📋") => { copiaveis.push(texto); return `<button type="button" class="btn pequeno" data-copiar="${copiaveis.length - 1}">${rotulo}</button>`; };
  const bloco = (titulo, texto, extra = "") => texto ? `<section class="pp-bloco"><div class="pp-bloco-topo"><h4>${titulo}</h4>${btnCopiar(texto, "📋 Copiar")}</div><div class="pp-texto">${esc(texto).replace(/\n/g, "<br>")}</div>${extra}</section>` : "";

  // Ganchos: o do plano + os do roteiro
  const ganchos = [...new Set([it.gancho, ...ideias.flatMap((t) => ganchosDe(partesDoRoteiro(t.minha_versao).ganchos))].map((g) => String(g || "").replace(/^["“]|["”]$/g, "").trim()).filter(Boolean))];

  const htmlIdeias = ideias.map((t) => {
    const p = partesDoRoteiro(t.minha_versao);
    const pronto = !!(p.roteiro || p.legenda);
    const tags = hashtagsDe(p.legenda);
    return `<div class="pp-ideia">
      <div class="pp-ideia-topo"><b>#${t.id} ${esc(t.titulo || "")}</b><span class="espaco"></span>
        <button type="button" class="btn pequeno" data-ir-ideia="${t.id}">Abrir nos Roteiros</button></div>
      ${pronto ? `
        ${bloco("🎬 Roteiro", p.roteiro)}
        ${bloco("📣 Chamada final", p.chamada)}
        ${bloco("📝 Legenda", p.legenda, tags.length ? `<div class="pp-tags">${tags.map((h) => `<span class="pilula">${esc(h)}</span>`).join(" ")} ${btnCopiar(tags.join(" "), "📋 Hashtags")}</div>` : "")}
        ${bloco("⏱️ Duração", p.duracao)}
        ${bloco("🎞️ O que filmar", p.filmar)}
        ${bloco("🎥 Dicas de gravação", p.dicas)}
        ${bloco("🧭 Por que esse ângulo", p.angulo)}`
      : `<p class="sub">${t.minha_versao ? "Essa ideia tem anotações, mas ainda não tem roteiro pronto." : "Essa ideia ainda não tem roteiro."}</p>
        ${t.minha_versao ? bloco("Suas anotações", t.minha_versao) : ""}
        <button type="button" class="btn primario" data-voz="${t.id}">✍️ Fazer o roteiro na minha voz</button>`}
    </div>`;
  }).join("");

  const d = abrirJanelaSimples(`${esc(dia[2])} ${dataBR(data).slice(0, 5)} · ${esc(it.formato)}`, `
    <h3 class="pp-tema">${esc(it.tema)}</h3>
    ${it.porque ? `<p class="pp-porque">💡 ${esc(it.porque)}</p>` : ""}
    ${ganchos.length ? `<section class="pp-bloco"><div class="pp-bloco-topo"><h4>🪝 Ganchos</h4></div>
      <ul class="pp-ganchos">${ganchos.map((g) => `<li><span>“${esc(g)}”</span>${btnCopiar(g)}</li>`).join("")}</ul></section>` : ""}
    ${htmlIdeias || `<section class="pp-bloco"><p class="sub" style="margin:0 0 8px">Esse post não está ligado a uma ideia dos Roteiros, então ainda não tem roteiro, legenda nem hashtags.</p>
      <button type="button" class="btn primario" data-voz-novo>✍️ Fazer o roteiro na minha voz</button></section>`}
    ${car ? `<section class="pp-bloco"><div class="pp-bloco-topo"><h4>🎨 Slides do carrossel</h4><button type="button" class="btn pequeno primario" data-abrir-car>Abrir no gerador</button></div>
      <ol class="pp-slides">${car.slides.map((sl) => `<li><span class="pilula">${esc((MODELOS_SLIDE.find((m) => m[0] === sl.modelo) || [0, sl.modelo])[1])}</span> ${esc([sl.titulo, sl.texto].filter(Boolean).join(" · ").replace(/\*/g, ""))}</li>`).join("")}</ol></section>` : ""}
    ${trechos.length ? `<details class="pp-bloco"><summary><b>🔎 O que a pesquisa falou desse post</b></summary><div class="pp-texto">${trechos.map((l) => esc(l.replace(/\*\*/g, ""))).join("<br>")}</div></details>` : ""}`,
    `${evento ? `<button type="button" class="btn" data-editar-evento>Editar data e hora</button>` : `<button type="button" class="btn" data-agenda>📅 Pôr na agenda</button>`}<button type="button" class="btn primario" data-fechar>Fechar</button>`);
  d.classList.add("janela-larga");
  d.addEventListener("close", () => { d.classList.remove("janela-larga"); d.onclick = null; }, { once: true });

  d.onclick = async (e) => {
    const c = e.target.closest("[data-copiar]");
    if (c) { try { await navigator.clipboard.writeText(copiaveis[Number(c.dataset.copiar)]); const antes = c.textContent; c.textContent = "copiado ✓"; setTimeout(() => { c.textContent = antes; }, 1500); } catch (_) { avisar("Não deu para copiar.", true); } return; }
    const ir = e.target.closest("[data-ir-ideia]");
    if (ir) { d.close(); trans.sel = ir.dataset.irIdeia; irPara("transcricoes"); return; }
    const voz = e.target.closest("[data-voz]");
    if (voz) { const t = S.transcricoes.find((x) => String(x.id) === voz.dataset.voz); d.close(); if (t) roteiroNaMinhaVoz(t); return; }
    if (e.target.closest("[data-voz-novo]")) { d.close(); roteiroNaMinhaVoz({ titulo: String(it.tema).replace(/#\d+\s*/g, ""), categoria: "organico", minha_versao: [it.gancho && `Gancho sugerido: ${it.gancho}`, it.porque && `Por que vai funcionar: ${it.porque}`].filter(Boolean).join("\n") }); return; }
    if (e.target.closest("[data-abrir-car]")) { d.close(); igx.car = { titulo: car.titulo, slides: car.slides.map((x) => ({ ...x })) }; igx.sub = "carrossel"; try { localStorage.setItem("ig-sub", "carrossel"); } catch (_) {} irPara("instagram"); return; }
    if (e.target.closest("[data-editar-evento]")) { d.close(); formCalendarioBase(evento); return; }
    if (e.target.closest("[data-agenda]")) {
      const titulo = `${it.formato}: ${it.tema}`.slice(0, 200);
      if (S.calendario.some((a) => a.titulo === titulo)) { avisar("Esse post já está na agenda."); return; }
      if (await gravar("calendario", { titulo, tipo: "postar", data, status: "a fazer" })) { avisar(`Na agenda: ${dia[2]}.`); recarregar("calendario"); }
    }
  };
}

/* =============================================================
   🧬 DNA DO PERFIL: o que já funcionou no @ryalvz
   Análise dos 50 posts de jun a out/2026 (alcance, retenção,
   comentários, salvamentos e compartilhamentos). Fica no banco
   (preferencias, chave "dna_perfil") e entra no Plano da semana e
   no roteiro dos posts orgânicos, para tudo seguir a mesma linha.
   ============================================================= */
const DNA_PADRAO = `O DNA DO @RYALVZ (análise de 50 posts, jun a out/2026)
Média de alcance dos Reels: uns 1.000. Tudo abaixo vem dos posts que passaram bem disso.

FÓRMULA 1. SÉRIE COM EPISÓDIOS DE UM CAPÍTULO REAL DA VIDA
Prova: "Diário de uma Mudança" EP. 2 (2.811 de alcance), EP. 4 (2.711), EP. 3 (1.225), e o fechamento "Hoje eu fechei a porta do apartamento 142 pela última vez" (2.641, 61 comentários).
Por que funciona: é a maior retenção do perfil (23 a 30 segundos assistidos, contra 5 a 9 nos outros) e o que mais gera comentário. Quem viu um episódio volta pro próximo.
Como replicar: escolher um capítulo real que tem começo, meio e fim e contar em episódios. Título fixo "EP. X | Nome da série", final que puxa o próximo ("e calma, ainda tem a parte 3").
Assuntos novos: Diário de uma campanha (do briefing à entrega), Diário de creator (os meses até a primeira marca), Montando meu setup, Diário de viagem a trabalho.

FÓRMULA 2. CONFISSÃO COM MARCO DE TEMPO
Prova: "Há 1 ano eu gravava esse vídeo para criar meu primeiro portfólio" (1.659, 23 comentários), "Aos 15 anos eu pintava o cabelo de verde... Aos 24 troquei a tinta por figurinhas" (1.601, 39 comentários, e era publi), "Às vezes eu paro pra pensar naquele primeiro encontro" (1.639).
Por que funciona: abre com um tempo concreto (há 1 ano, aos 15 anos, naquele dia) e mostra a distância entre quem eu era e quem eu sou. Gera identificação e comentário.
Como replicar: primeira frase com o marco de tempo e uma situação específica. Depois a virada até hoje, com um número real. Na legenda, frases curtas com respiro entre elas, que é o estilo das legendas que funcionaram.
Funciona até em publi: o marco de tempo leva o produto junto sem cara de anúncio.

FÓRMULA 3. DICA DE CREATOR EM UMA PERGUNTA
Prova: "Você também achava que o Hollyland servia só pra gravar áudio?" (2.055, 19 salvamentos e 31 compartilhamentos, o melhor do perfil nisso) e "E quem nunca esqueceu de tirar esse encerramento automático, né?" (1.702, 16 salvamentos e 15 compartilhamentos).
Por que funciona: a pergunta faz a pessoa se reconhecer no erro, e a dica é útil o bastante para salvar e mandar pra um amigo creator.
Como replicar: um equipamento, app ou recurso (iPhone, CapCut, microfone, luz) e uma pergunta de identificação no gancho e na legenda. Legenda curta: só a pergunta e 3 a 4 hashtags.

FÓRMULA 4. CENA DE VIDA REAL COM HUMOR
Prova: "preparados pra mais uma viagem? quem é você da dupla?" (2.234, 17 compartilhamentos), "Pegando a jaqueta do fundo do guarda roupas" (1.619), "O tempo inteiro ligado nos 220v" (1.573).
Por que funciona: situação que todo mundo vive, curta, com pergunta que marca alguém. Alcance bom, mas pouca retenção e pouco salvamento.
Como usar: no máximo 1 por semana, para trazer gente nova. Ela não sustenta o perfil sozinha.

O QUE DERRUBA O ALCANCE (evitar)
Carrossel de viagem só com emoji na legenda (385 a 456 de alcance).
Reels sem legenda ou repostado (10 a 140). O Hollyland postado duas vezes: a primeira teve 132, a segunda 2.055. Escolher a melhor versão e postar uma vez só.
Frase motivacional genérica ("Mudar não é sobre dar um passo para trás": 12 e 47 de alcance).
Pergunta genérica sem história minha ("O ano novo já está se aproximando, isso te assusta?": 140).
Postar em rajada no mesmo dia e depois sumir.

A SEMANA IDEAL
1 episódio de série (Fórmula 1)
1 dica de creator em uma pergunta (Fórmula 3)
1 confissão com marco de tempo (Fórmula 2), em Reels ou em carrossel narrativo
1 cena de vida real com humor (Fórmula 4), opcional
Carrossel só quando ele conta uma história (como o "Há 1 ano"). Nada de álbum de fotos.`;
let dnaPerfil = null;
async function carregarDna() {
  if (dnaPerfil !== null) return dnaPerfil;
  let data = null;
  try { ({ data } = await db.from("preferencias").select("valor").eq("chave", "dna_perfil").maybeSingle()); } catch (_) {}
  dnaPerfil = (data && data.valor) || DNA_PADRAO;
  return dnaPerfil;
}
function cartaoDna() {
  const dna = dnaPerfil || DNA_PADRAO;
  return `<details class="cartao pl-dna" id="pl-dna"><summary><b>🧬 O DNA do seu perfil</b> <span class="sub">as 4 fórmulas que já funcionaram. Todo plano e roteiro orgânico segue isso.</span></summary>
    <div class="pl-texto" style="margin-top:10px">${esc(dna).replace(/\n/g, "<br>")}</div>
    <div class="pro-acoes" style="margin-top:10px">
      <button type="button" class="btn" id="dna-copiar">📋 Copiar (para a sua skill de posts orgânicos)</button>
      <button type="button" class="btn" id="dna-editar">✏️ Editar</button>
    </div></details>`;
}
function ligarCartaoDna() {
  const c = $("#dna-copiar"); if (!c) return;
  c.onclick = async () => { try { await navigator.clipboard.writeText(dnaPerfil || DNA_PADRAO); avisar("DNA copiado. Cole na sua skill de posts orgânicos."); } catch (_) { avisar("Não deu para copiar.", true); } };
  $("#dna-editar").onclick = () => {
    const d = abrirJanelaSimples("🧬 O DNA do seu perfil", `<p class="sub" style="margin-top:0">Ajuste quando aparecer um post que funcionou muito (ou um formato que parou de funcionar).</p>
      <textarea class="campo" id="dna-texto" rows="18" style="width:100%;font-size:13px">${esc(dnaPerfil || DNA_PADRAO)}</textarea>`,
      `<button type="button" class="btn" data-fechar>Fechar</button><button type="button" class="btn primario" id="dna-salvar">💾 Salvar</button>`);
    $("#dna-salvar", d).onclick = async () => {
      const valor = $("#dna-texto", d).value.trim();
      if (!valor) { avisar("O DNA não pode ficar vazio.", true); return; }
      const { error } = await db.from("preferencias").upsert({ chave: "dna_perfil", valor, atualizado_em: new Date().toISOString() }, { onConflict: "chave" });
      if (error) { avisar(traduzErro(error), true); return; }
      dnaPerfil = valor; d.close(); avisar("DNA salvo."); desenhar();
    };
  };
}

window.__adminEstrategia = true;
