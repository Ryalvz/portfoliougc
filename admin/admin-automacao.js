/* =============================================================
   ADMIN, PARTE 5: 🤖 Automações do Instagram
   Comentou a palavra, recebe no direct (sem ManyChat). Quem faz o
   envio é o ajudante "automacao" no Supabase; aqui você cria as
   regras, liga a conexão com a Meta e vê quem recebeu.
   ============================================================= */
const au = { lista: null, envios: [], status: null, posts: null, falta: false };

async function chamarAutomacao(corpo) {
  const { data, error } = await db.functions.invoke("automacao", { body: corpo });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j && j.erro) msg = j.erro; } catch (_) {}
    throw new Error(msg);
  }
  return data;
}
async function carregarAutomacoes() {
  const [a, e] = await Promise.all([
    db.from("automacoes").select("*").order("id", { ascending: false }),
    db.from("automacao_envios").select("*").order("criado_em", { ascending: false }).limit(200)
  ]);
  au.falta = !!(a.error || e.error);
  au.lista = a.data || []; au.envios = e.data || [];
}

function desenharAutomacoes(el) {
  if (au.lista === null) {
    el.innerHTML = `<p class="vazio">Abrindo as automações...</p>`;
    Promise.all([carregarAutomacoes(), chamarAutomacao({ acao: "status" }).then((s) => { au.status = s; }, (e) => { au.status = { erro: e.message }; })]).then(desenhar);
    return;
  }
  if (au.falta) { el.innerHTML = `<div class="aviso-falta">Falta rodar a parte 36 do banco.sql no Supabase.</div>`; return; }
  const st = au.status || {};
  const enviosDe = (id) => au.envios.filter((x) => x.automacao_id === id);
  const passos = [
    [!!st.endereco, "Instagram conectado", `${st.endereco ? "A chave do Instagram está no painel." : esc(st.erro || "Conecte em Métricas do Instagram.")}
      <span class="au-linha"><input class="campo" id="au-token" type="password" autocomplete="off" placeholder="Gerou uma chave nova na Meta? Cole aqui"><button class="btn" type="button" id="au-token-ok">Trocar chave</button></span>`],
    [!!st.temSegredo, "Chave secreta do app", st.temSegredo ? "Guardada. Serve pra conferir que o aviso veio mesmo da Meta." : `Cole a <b>Chave secreta do app do Instagram</b> (na Meta: Casos de uso → Personalizar → Configuração da API com login do Instagram).
      <span class="au-linha"><input class="campo" id="au-segredo" type="password" autocomplete="off" placeholder="Chave secreta do app do Instagram"><button class="btn" type="button" id="au-segredo-ok">Guardar</button></span>`],
    [!!st.ultimoAviso, "Webhook na Meta", `Na Meta, em Webhooks do Instagram, use:
      <span class="au-linha"><code>${esc(st.endereco || "")}</code><button class="btn pequeno" type="button" data-copiar-au="${esc(st.endereco || "")}">Copiar endereço</button></span>
      <span class="au-linha"><code>${esc(st.verificar || "")}</code><button class="btn pequeno" type="button" data-copiar-au="${esc(st.verificar || "")}">Copiar código de verificação</button></span>
      ${st.ultimoAviso ? `<b>A Meta já avisou o painel</b> (último aviso ${new Date(st.ultimoAviso).toLocaleString("pt-BR")}).` : "Depois de salvar lá, marque o campo <b>comments</b>."}`],
    [st.assinado === true, "Avisos de comentários ligados na sua conta", st.assinado === true ? "Ligados." : `${st.erroAssinatura ? `<span class="sub">A Meta disse: ${esc(st.erroAssinatura)}</span><br>` : ""}<button class="btn primario pequeno" type="button" id="au-assinar">Ligar avisos de comentários</button>`]
  ];
  const pronto = passos.every((p) => p[0]);

  el.innerHTML = `
    <details class="cartao au-conexao" ${pronto ? "" : "open"}>
      <summary><b>${pronto ? "✅ Conexão com a Meta pronta" : "⚙️ Conexão com a Meta"}</b> <span class="sub">${passos.filter((p) => p[0]).length} de ${passos.length} passos</span></summary>
      <ol class="au-passos">${passos.map(([ok, t, d]) => `<li class="${ok ? "ok" : ""}"><b>${ok ? "✓" : "○"} ${t}</b><div class="sub">${d}</div></li>`).join("")}</ol>
      <button class="btn pequeno" type="button" id="au-recarregar">Conferir de novo</button>
    </details>

    <section class="cartao">
      <div class="au-topo"><div><h3 class="pro-titulo">🤖 Comentou, recebeu no direct</h3>
        <p class="sub">Quando alguém comenta a palavra, a pessoa recebe a mensagem no direct e o comentário ganha uma resposta. Um direct por comentário, só em comentários de até 7 dias (regra da Meta).</p></div>
        <button class="btn primario" type="button" id="au-nova">${ic("mais")}Nova automação</button></div>
      ${au.lista.length ? `<div class="au-lista">${au.lista.map((a) => {
        const env = enviosDe(a.id), ok = env.filter((x) => x.status === "enviado").length, erro = env.filter((x) => x.status === "erro").length;
        return `<article class="au-item ${a.ativa ? "" : "pausada"}">
          ${a.midia_capa ? `<img src="${esc(a.midia_capa)}" alt="">` : `<span class="au-todos">Todos os posts</span>`}
          <div class="au-meio"><b>${esc(a.nome)}</b>
            <div class="au-palavras">${String(a.palavras).split(/[,\n]/).map((p) => p.trim()).filter(Boolean).map((p) => `<span class="pilula">${esc(p)}</span>`).join("")}</div>
            <p class="sub">${esc(String(a.mensagem).slice(0, 140))}${String(a.mensagem).length > 140 ? "…" : ""}</p>
            <span class="sub"><b>${ok}</b> ${ok === 1 ? "pessoa recebeu" : "pessoas receberam"}${erro ? ` · <span class="au-erro">${erro} com erro</span>` : ""}</span></div>
          <div class="au-acoes">
            <label class="au-chave"><input type="checkbox" data-au-ativa="${a.id}" ${a.ativa ? "checked" : ""}> ${a.ativa ? "Ligada" : "Pausada"}</label>
            <button class="btn pequeno" type="button" data-au-editar="${a.id}">${ic("editar")}Editar</button>
            <button class="icone-btn" type="button" data-au-apagar="${a.id}" aria-label="Apagar">${ic("apagar")}</button>
          </div></article>`; }).join("")}</div>`
      : `<p class="vazio">Nenhuma automação ainda. Crie uma pra palavra do CTA do seu próximo carrossel (ex.: ROTEIRO).</p>`}
    </section>

    <section class="cartao">
      <h3 class="pro-titulo">📬 Quem recebeu</h3>
      ${au.envios.length ? `<div class="tabela-caixa"><table class="au-tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Comentou</th><th>Automação</th><th>Situação</th></tr></thead><tbody>
        ${au.envios.slice(0, 50).map((x) => `<tr><td>${new Date(x.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
          <td>${x.usuario ? `<a href="https://instagram.com/${esc(x.usuario)}" target="_blank" rel="noopener">@${esc(x.usuario)}</a>` : "?"}</td>
          <td>${esc(String(x.texto || "").slice(0, 60))}</td>
          <td>${esc((au.lista.find((a) => a.id === x.automacao_id) || {}).nome || "")}</td>
          <td>${x.status === "enviado" ? `<span class="pilula au-ok">Enviado</span>` : x.status === "erro" ? `<span class="pilula au-falhou" title="${esc(x.erro || "")}">Erro</span>` : `<span class="pilula">Enviando</span>`}${x.erro && x.status !== "erro" ? `<br><small class="sub">${esc(x.erro)}</small>` : x.status === "erro" ? `<br><small class="sub">${esc(x.erro || "")}</small>` : ""}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="vazio">Ninguém recebeu ainda.</p>`}
    </section>`;

  $("#au-recarregar").onclick = () => { au.lista = null; desenhar(); };
  $("#au-token-ok").onclick = async () => {
    const token = $("#au-token").value.trim(); if (!token) { avisar("Cole a chave nova primeiro.", true); return; }
    try { const r = await chamarInstagram({ acao: "conectar", token }); if (r.erro) throw new Error(r.erro); avisar(`Chave nova guardada${r.usuario ? ` (@${r.usuario})` : ""}.`); au.lista = null; ig.conectado = null; ig.dados = null; desenhar(); }
    catch (e) { avisar(e.message, true); }
  };
  const seg = $("#au-segredo-ok");
  if (seg) seg.onclick = async () => {
    try { await chamarAutomacao({ acao: "segredo", valor: $("#au-segredo").value }); avisar("Chave secreta guardada."); au.lista = null; desenhar(); }
    catch (e) { avisar(e.message, true); }
  };
  const ass = $("#au-assinar");
  if (ass) ass.onclick = async () => {
    ass.disabled = true; ass.textContent = "Ligando...";
    try { const r = await chamarAutomacao({ acao: "assinar" }); avisar(r.ok ? "Avisos de comentários ligados." : "A Meta não confirmou. Tente de novo.", !r.ok); au.lista = null; desenhar(); }
    catch (e) { avisar(e.message, true); ass.disabled = false; ass.textContent = "Ligar avisos de comentários"; }
  };
  el.addEventListener("click", async (e) => {
    const cp = e.target.closest("[data-copiar-au]");
    if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copiarAu); avisar("Copiado."); } catch (_) { avisar("Não deu para copiar.", true); } return; }
    if (e.target.closest("#au-nova")) return editarAutomacao(null);
    const ed = e.target.closest("[data-au-editar]"); if (ed) return editarAutomacao(au.lista.find((a) => String(a.id) === ed.dataset.auEditar));
    const ap = e.target.closest("[data-au-apagar]");
    if (ap && confirm("Apagar esta automação? Quem já recebeu continua no histórico.")) {
      const { error } = await db.from("automacoes").delete().eq("id", ap.dataset.auApagar);
      if (error) { avisar(traduzErro(error), true); return; }
      au.lista = au.lista.filter((a) => String(a.id) !== ap.dataset.auApagar); desenhar();
    }
  });
  el.addEventListener("change", async (e) => {
    const t = e.target.closest("[data-au-ativa]"); if (!t) return;
    const { error } = await db.from("automacoes").update({ ativa: t.checked }).eq("id", t.dataset.auAtiva);
    if (error) { avisar(traduzErro(error), true); t.checked = !t.checked; return; }
    const a = au.lista.find((x) => String(x.id) === t.dataset.auAtiva); if (a) a.ativa = t.checked; desenhar();
  });
}

function editarAutomacao(a) {
  const atual = a || { nome: "", palavras: "", mensagem: "Oi{usuario}! Aqui está o que você pediu: (link)\n\nQualquer dúvida, me chama aqui.", respostas: "Te mandei no direct! 📩\nAcabei de te mandar no direct 💌\nOlha o direct! ✨", midia_id: null };
  let midia = { id: atual.midia_id, legenda: atual.midia_legenda, capa: atual.midia_capa };
  const d = abrirJanelaSimples(a ? "Editar automação" : "Nova automação", `
    <label class="au-rot">Nome (só pra você)<input class="campo" id="af-nome" value="${esc(atual.nome)}" placeholder="Ex.: Modelo de roteiro"></label>
    <label class="au-rot">Palavras que disparam<input class="campo" id="af-palavras" value="${esc(atual.palavras)}" placeholder="Ex.: ROTEIRO, roteiros"><small class="sub">Separe por vírgula. Maiúscula e acento não importam; vale a palavra inteira no meio do comentário.</small></label>
    <div class="au-rot">Em qual post
      <div class="au-post" id="af-post"></div>
      <button class="btn pequeno" type="button" id="af-escolher">Escolher post</button>
      <div class="au-posts" id="af-posts" hidden></div></div>
    <label class="au-rot">Mensagem do direct<textarea class="campo" id="af-mensagem" rows="5">${esc(atual.mensagem)}</textarea><small class="sub">Até 1000 letras. {usuario} vira o @ da pessoa. Ponha o link do que você prometeu.</small></label>
    <label class="au-rot">Resposta no comentário (uma por linha, o painel sorteia)<textarea class="campo" id="af-respostas" rows="3">${esc(atual.respostas || "")}</textarea><small class="sub">Variar a resposta deixa mais natural. Deixe vazio pra não responder em público.</small></label>`,
    `<button class="btn" type="button" data-fechar>Cancelar</button><button class="btn primario" type="button" id="af-salvar">Salvar</button>`);
  const mostrarPost = () => {
    $("#af-post", d).innerHTML = midia.id ? `<img src="${esc(midia.capa || "")}" alt=""><span>${esc(String(midia.legenda || "Post escolhido").slice(0, 90))}</span><button class="link-btn" type="button" id="af-todos">usar em todos</button>`
      : `<span class="au-todos">Todos os posts</span><span class="sub">Vale em qualquer post. Escolha um post se a palavra for de um carrossel só.</span>`;
    const t = $("#af-todos", d); if (t) t.onclick = () => { midia = {}; mostrarPost(); };
  };
  mostrarPost();
  $("#af-escolher", d).onclick = async () => {
    const box = $("#af-posts", d); box.hidden = false;
    if (!au.posts) {
      box.innerHTML = `<p class="sub">Buscando seus posts...</p>`;
      try { au.posts = (await chamarAutomacao({ acao: "posts" })).posts || []; } catch (e) { box.innerHTML = `<p class="sub">${esc(e.message)}</p>`; return; }
    }
    box.innerHTML = au.posts.map((p) => `<button type="button" data-af-post="${esc(p.id)}" title="${esc(String(p.caption || "").slice(0, 120))}"><img src="${esc(p.thumbnail_url || p.media_url || "")}" alt=""></button>`).join("") || `<p class="sub">Nenhum post encontrado.</p>`;
  };
  $("#af-posts", d).addEventListener("click", (e) => {
    const b = e.target.closest("[data-af-post]"); if (!b) return;
    const p = au.posts.find((x) => x.id === b.dataset.afPost);
    midia = { id: p.id, legenda: String(p.caption || "").split("\n")[0].slice(0, 300), capa: p.thumbnail_url || p.media_url || "" };
    $("#af-posts", d).hidden = true; mostrarPost();
  });
  $("#af-salvar", d).onclick = async () => {
    const dados = {
      nome: $("#af-nome", d).value.trim() || $("#af-palavras", d).value.split(",")[0].trim() || "Automação",
      palavras: $("#af-palavras", d).value.trim(), mensagem: $("#af-mensagem", d).value.trim(), respostas: $("#af-respostas", d).value.trim() || null,
      midia_id: midia.id || null, midia_legenda: midia.id ? midia.legenda || null : null, midia_capa: midia.id ? midia.capa || null : null
    };
    if (!dados.palavras) { avisar("Escreva pelo menos uma palavra.", true); return; }
    if (!dados.mensagem) { avisar("Escreva a mensagem do direct.", true); return; }
    const { error } = await (a ? db.from("automacoes").update(dados).eq("id", a.id) : db.from("automacoes").insert(dados));
    if (error) { avisar(traduzErro(error), true); return; }
    d.close(); au.lista = null; desenhar(); avisar(a ? "Automação salva." : "Automação criada e ligada.");
  };
}
