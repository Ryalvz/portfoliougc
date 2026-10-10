// =============================================================
// AJUDANTE "lembretes" (Supabase Edge Function)
// Confere o painel e manda notificação para o celular do Ryan:
//   tipo "diario" (todo dia, 9h): resumo do que está pendente
//   tipo "quarta" (quarta, 8h): repasse do TikTok Shop (cai de madrugada)
//   tipo "rapidos" (a cada minuto): lembretes rápidos que chegaram na hora
//   tipo "propostas" (de 2 em 2 horas, das 8h às 22h): proposta nova no Gmail
//   Na segunda, o resumo das 9h começa com um balanço da semana.
//   Todo dia ele também renova a conexão do Instagram e avisa se o
//   Gmail ou o Instagram se desconectarem.
//   acao "teste" (botão no painel, só com o login do Ryan)
//   GET: devolve a chave pública que o celular usa para se inscrever
//
// Nenhuma chave secreta fica aqui. A chave de assinatura das
// notificações é criada na primeira vez e guardada na tabela
// config_privada, que só este ajudante consegue ler.
// Cada resumo é mandado no máximo uma vez por dia.
// =============================================================
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const URL_BANCO = Deno.env.get("SUPABASE_URL")!;
// Chave interna que o próprio Supabase entrega ao ajudante (não fica escrita em lugar nenhum)
function chaveInterna() {
  const nova = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (nova) { try { const k = Object.values(JSON.parse(nova))[0]; if (k) return String(k); } catch (_) { /* segue */ } }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
const db = createClient(URL_BANCO, chaveInterna(), { auth: { persistSession: false } });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* ---------- Datas no horário de Brasília ---------- */
const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somaDias = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaSemana = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDay();
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
const ultimaQuarta = (hoje: string) => somaDias(hoje, -((diaSemana(hoje) - 3 + 7) % 7));
const br = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const n2 = (v: unknown) => Number(v) || 0;
const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/* ---------- Chaves das notificações (criadas uma vez, guardadas no banco) ---------- */
let chavePublica = "";
async function prepararChaves() {
  if (chavePublica) return chavePublica;
  const ler = async () => (await db.from("config_privada").select("chave,valor").in("chave", ["vapid_publica", "vapid_privada"])).data || [];
  let linhas = await ler();
  if (linhas.length < 2) {
    const k = webpush.generateVAPIDKeys();
    await db.from("config_privada").upsert(
      [{ chave: "vapid_publica", valor: k.publicKey }, { chave: "vapid_privada", valor: k.privateKey }],
      { onConflict: "chave", ignoreDuplicates: true });
    linhas = await ler();
  }
  const pub = linhas.find((x) => x.chave === "vapid_publica")!.valor;
  const priv = linhas.find((x) => x.chave === "vapid_privada")!.valor;
  webpush.setVapidDetails("mailto:" + EMAIL_ADMIN, pub, priv);
  chavePublica = pub;
  return pub;
}

/* ---------- As mesmas regras dos lembretes do painel ---------- */
const NEGOCIACAO = ["Em negociação", "Assinatura de contrato"];
const PRODUCAO = ["Aguardando briefing", "Roteiro em andamento", "Aguardando aprovação de roteiro", "Gravando", "Editando", "Enviado p/ aprovação"];
const DINHEIRO = ["Entregue", "Nota fiscal enviada", "Aguardando pagamento", "Pago"];

const TIPO_AGENDA: Record<string, string> = { gravar: "gravar", editar: "editar", postar: "postar" };

type Lembrete = { tipo: string; texto: string; url?: string };
async function calcularLembretes(hoje: string): Promise<Lembrete[]> {
  const [contratos, comissoes, adiados, agenda, metas] = await Promise.all([
    db.from("contratos").select("*").then((r) => r.data || []),
    db.from("comissoes_ttk").select("data,valor").then((r) => r.data || []),
    db.from("lembretes_adiados").select("chave,ate").then((r) => r.data || []),
    db.from("calendario").select("id,titulo,marca,tipo,data,status,exemplo").gte("data", somaDias(hoje, -7)).lte("data", hoje).eq("status", "a fazer").then((r) => r.data || []),
    db.from("metas").select("ano,mes,valor").then((r) => r.data || []),
  ]);
  const adiado = (k: string) => adiados.some((a) => a.chave === k && a.ate >= hoje);
  const L: Lembrete[] = [];

  // Agenda do calendário: o que é pra hoje e o que ficou para trás
  for (const a of agenda.filter((x) => !x.exemplo)) {
    if (adiado(`cal-${a.id}`)) continue;
    const oque = `${TIPO_AGENDA[a.tipo] || a.tipo} ${a.titulo}${a.marca ? ` (${a.marca})` : ""}`;
    L.push(a.data === hoje
      ? { tipo: "agenda", texto: `Hoje: ${oque}`, url: "./#calendario" }
      : { tipo: "agenda", texto: `Ficou pra trás (${br(a.data)}): ${oque}`, url: "./#calendario" });
  }

  const quarta = ultimaQuarta(hoje);
  if (!comissoes.some((x) => String(x.data).slice(0, 10) === quarta) && !adiado("ttk-" + quarta)) {
    L.push({ tipo: "ttk", texto: quarta === hoje ? "Lançar o repasse do TikTok Shop de hoje" : `Lançar o repasse do TikTok Shop de quarta ${br(quarta)}` });
  }

  for (const c of contratos) {
    const fechado = PRODUCAO.includes(c.status) || DINHEIRO.includes(c.status);
    const recebido = (Number(c.parcela1) || 0) + (Number(c.parcela2) || 0);
    const saldo = fechado ? Math.max(0, (Number(c.valor) || 0) - recebido) : 0;
    const prev = c.data_nf && c.prazo_dias != null ? somaDias(String(c.data_nf).slice(0, 10), Number(c.prazo_dias)) : null;
    const aberto = fechado && c.status !== "Pago" && saldo > 0;

    if (aberto && prev && prev < hoje) {
      if (!adiado(`vencido-${c.id}`)) L.push({ tipo: "vencido", texto: `${c.cliente}: venceu há ${diasEntre(prev, hoje)} dias (${real(saldo)}). Já pagou?` });
      continue;
    }
    if (aberto && prev && prev >= hoje && prev <= somaDias(hoje, 2) && !adiado(`vence-${c.id}-${prev}`)) {
      L.push({ tipo: "vence", texto: `${c.cliente}: paga ${prev === hoje ? "hoje" : "até " + br(prev)} (${real(saldo)})` });
    }
    if (c.status === "Entregue" && !c.data_nf && saldo > 0 && !adiado(`nota-${c.id}`)) {
      L.push({ tipo: "nota", texto: `${c.cliente}: entregue e sem nota fiscal` });
    }
    if (PRODUCAO.includes(c.status) && c.prazo_entrega && c.prazo_entrega <= somaDias(hoje, 1) && !adiado(`entrega-${c.id}-${c.prazo_entrega}`)) {
      const d = diasEntre(hoje, c.prazo_entrega);
      L.push({ tipo: "entrega", texto: `${c.cliente}: ${d < 0 ? `entrega atrasada há ${-d} dias` : d === 0 ? "entrega hoje" : "entrega amanhã"}` });
    }
    if (NEGOCIACAO.includes(c.status) && c.criado_em && diasEntre(String(c.criado_em).slice(0, 10), hoje) >= 5 && !adiado(`negocia-${c.id}`)) {
      L.push({ tipo: "negocia", texto: `${c.cliente}: em negociação há ${diasEntre(String(c.criado_em).slice(0, 10), hoje)} dias. Fez follow-up?` });
    }
  }
  // Meta do mês: a partir do dia 20, se ainda não bateu
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7)), dia = Number(hoje.slice(8, 10));
  const meta = n2((metas.find((m) => Number(m.ano) === ano && Number(m.mes) === mes) || {}).valor);
  if (meta > 0 && dia >= 20 && !adiado(`meta-${ano}-${mes}`)) {
    const fechadoNoMes = contratos.filter((c) => (PRODUCAO.includes(c.status) || DINHEIRO.includes(c.status)) && Number(c.ano) === ano && Number(c.mes) === mes)
      .reduce((s, c) => s + n2(c.valor), 0)
      + comissoes.filter((x) => String(x.data).slice(0, 7) === hoje.slice(0, 7)).reduce((s, x) => s + n2(x.valor), 0);
    const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    if (fechadoNoMes < meta) L.push({ tipo: "meta", texto: `Faltam ${real(meta - fechadoNoMes)} pra meta de ${MESES[mes - 1]} (${ultimo - dia === 0 ? "último dia" : `${ultimo - dia} dias`})`, url: "./#financeiro" });
  }
  return L;
}

/* ---------- Segunda de manhã: balanço da semana ---------- */
async function resumoDaSemana(hoje: string): Promise<Lembrete[]> {
  const [contratos, comissoes] = await Promise.all([
    db.from("contratos").select("*").then((r) => r.data || []),
    db.from("comissoes_ttk").select("data,valor").then((r) => r.data || []),
  ]);
  const de = somaDias(hoje, -7), ate = somaDias(hoje, -1);
  const naSemana = (d: unknown) => { const x = String(d || "").slice(0, 10); return x >= de && x <= ate; };
  let entrou = comissoes.filter((x) => naSemana(x.data)).reduce((s, x) => s + n2(x.valor), 0);
  let aReceber = 0;
  for (const c of contratos) {
    if (naSemana(c.data_p1)) entrou += n2(c.parcela1);
    if (naSemana(c.data_p2)) entrou += n2(c.parcela2);
    if ((PRODUCAO.includes(c.status) || DINHEIRO.includes(c.status)) && c.status !== "Pago") aReceber += Math.max(0, n2(c.valor) - n2(c.parcela1) - n2(c.parcela2));
  }
  const entregas = contratos.filter((c) => PRODUCAO.includes(c.status) && c.prazo_entrega && c.prazo_entrega >= hoje && c.prazo_entrega <= somaDias(hoje, 6)).length;
  const partes = [`entrou ${real(entrou)} na semana passada`];
  if (aReceber) partes.push(`${real(aReceber)} a receber`);
  partes.push(entregas ? `${entregas} ${entregas === 1 ? "entrega" : "entregas"} nesta semana` : "nenhuma entrega marcada nesta semana");
  return [{ tipo: "semana", texto: "Semana: " + partes.join(", "), url: "./#inicio" }];
}

/* ---------- Conexões: mantém o Instagram vivo e avisa se algo cair ---------- */
async function conferirConexoes(hoje: string): Promise<Lembrete[]> {
  const L: Lembrete[] = [];
  const { data } = await db.from("config_privada").select("chave,valor").in("chave", ["gmail_refresh", "ig_token", "ig_renovado_em"]);
  const v = (k: string) => (data || []).find((x) => x.chave === k)?.valor || "";

  if (!v("gmail_refresh")) L.push({ tipo: "conexao", texto: "O Gmail se desconectou do painel. Abra Propostas e conecte de novo", url: "./#propostas" });
  else if (!(await acessoGmail())) L.push({ tipo: "conexao", texto: "O Gmail parou de responder. Abra Propostas e conecte de novo", url: "./#propostas" });

  let token = v("ig_token");
  if (!token) return L;
  // A chave do Instagram vale 60 dias: renova toda semana, mesmo sem abrir o painel
  const dias = v("ig_renovado_em") ? (Date.now() - Date.parse(v("ig_renovado_em"))) / 864e5 : 99;
  if (dias >= 7) {
    try {
      const j = await (await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`)).json();
      if (j.access_token) {
        token = j.access_token;
        await db.from("config_privada").upsert([{ chave: "ig_token", valor: token }, { chave: "ig_renovado_em", valor: new Date().toISOString() }], { onConflict: "chave" });
      }
    } catch (_) { /* tenta de novo amanhã */ }
  }
  try {
    const r = await fetch(`https://graph.instagram.com/v22.0/me/media?fields=timestamp&limit=1&access_token=${encodeURIComponent(token)}`);
    const j = await r.json();
    if (!r.ok || j.error) {
      L.push({ tipo: "conexao", texto: "O Instagram se desconectou do painel. Abra Redes sociais e conecte de novo", url: "./#instagram" });
    } else {
      // Muito tempo sem postar no feed
      const ultimo = j.data?.[0]?.timestamp ? new Date(j.data[0].timestamp).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : "";
      const parado = ultimo ? diasEntre(ultimo, hoje) : 0;
      const { data: ad } = await db.from("lembretes_adiados").select("ate").eq("chave", `postar-${ultimo}`).maybeSingle();
      if (parado >= 7 && !(ad && ad.ate >= hoje)) L.push({ tipo: "postar", texto: `Faz ${parado} dias que você não posta no Instagram`, url: "./#instagram" });
    }
  } catch (_) { /* sem internet agora: confere amanhã */ }
  return L;
}

/* ---------- Gmail: proposta nova chegando ---------- */
const GOOGLE_CLIENT_ID = "317757639743-datc7u3k3d7hauj06q6viqefstliqkle.apps.googleusercontent.com";
const EMAIL_PROPOSTAS = "heyryan.ugc@gmail.com";
const PALAVRAS_PROPOSTA = ["ugc", "\"user generated\"", "proposta", "parceria", "publi", "publicidade", "publipost", "campanha", "collab", "collaboration", "briefing", "orçamento", "orcamento", "\"mídia kit\"", "\"media kit\"", "midiakit", "influenciador", "influencer", "creator", "\"criador de conteúdo\"", "permuta", "cachê", "cache", "job", "contratar", "freela"];
const BUSCA_NOVAS = `in:inbox is:unread newer_than:1d -category:promotions -category:social -category:forums -category:updates (${PALAVRAS_PROPOSTA.join(" OR ")})`;
// As mesmas regras do painel para separar gente de robô
const REMETENTE_ROBO = /^(no-?reply|nao-?responda|naoresponda|donotreply|do-?not-?reply|notifica|notification|news|newsletter|marketing|mkt|comunicad|todomundo|support|suporte|faleconosco|fale-conosco|atendimento|info|noticias|alert|update|mailer|bounce|hello|team|time|equipe|contato-?noreply|campanhas|digest|community|comunidade|creators?|parcerias-?noreply|plataforma)/i;
const ASSUNTO_ROBO = /\[#?\d{3,}\]|novo dispositivo|fez login|c[oó]digo de (verifica|acesso|seguran)|verify|verifica[cç][aã]o|redefinir senha|password|fatura|boleto|pix|pagamento (recebido|aprovado|confirmado)|recibo|seu pedido|pedido #|inscri[cç][oõ]es abertas|newsletter|webinar|edi[cç][aã]o #?\d|#\d{2,}\b|grupo do whatsapp/i;

async function acessoGmail() {
  const segredo = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const { data } = await db.from("config_privada").select("valor").eq("chave", "gmail_refresh").maybeSingle();
  if (!segredo || !data?.valor) return "";
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: data.valor, client_id: GOOGLE_CLIENT_ID, client_secret: segredo, grant_type: "refresh_token" }),
  });
  const j = await r.json().catch(() => ({}));
  return r.ok ? String(j.access_token || "") : "";
}

async function propostasNovas() {
  const acesso = await acessoGmail();
  if (!acesso) return [];
  const api = async (caminho: string) => {
    const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/" + caminho, { headers: { Authorization: "Bearer " + acesso } });
    if (!r.ok) throw new Error("Gmail " + r.status);
    return r.json();
  };
  const lista = await api("messages?maxResults=20&q=" + encodeURIComponent(BUSCA_NOVAS));
  const ids: string[] = (lista.messages || []).map((x: any) => x.id);
  if (!ids.length) return [];
  const [{ data: avisados }, { data: adiados }] = await Promise.all([
    db.from("lembretes_enviados").select("chave").in("chave", ids.map((id) => "prop-" + id)),
    db.from("lembretes_adiados").select("chave"),
  ]);
  const jaFoi = new Set((avisados || []).map((x) => x.chave));
  const escondidos = new Set((adiados || []).map((x) => x.chave));
  const campos = ["From", "To", "Cc", "Subject", "List-Unsubscribe", "List-Id", "Precedence", "Auto-Submitted", "Feedback-ID", "X-Feedback-Id", "X-SES-Outgoing", "X-Mailer"].map((h) => "&metadataHeaders=" + h).join("");
  const novas: { id: string; nome: string; assunto: string }[] = [];
  for (const id of ids) {
    if (jaFoi.has("prop-" + id) || escondidos.has("email-" + id)) continue;
    const m = await api(`messages/${id}?format=metadata${campos}`).catch(() => null);
    if (!m) continue;
    const cab = (n: string) => (m.payload?.headers || []).find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
    const de = cab("From"), mm = de.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
    const email = (mm ? mm[2] : de).trim().toLowerCase(), nome = (mm && mm[1].trim()) || email;
    const dominio = (email.split("@")[1] || "").split(".")[0];
    const destino = (cab("To") + " " + cab("Cc")).toLowerCase();
    const robo = cab("List-Unsubscribe") || cab("List-Id") || cab("Feedback-ID") || cab("X-Feedback-Id") || cab("X-SES-Outgoing") || cab("X-Mailer")
      || /bulk|list|junk/i.test(cab("Precedence")) || (cab("Auto-Submitted") && !/^no$/i.test(cab("Auto-Submitted")))
      || REMETENTE_ROBO.test(email.split("@")[0]) || (destino.trim() && !destino.includes(EMAIL_PROPOSTAS))
      || ASSUNTO_ROBO.test(cab("Subject")) || escondidos.has("dominio-" + dominio) || email === EMAIL_PROPOSTAS;
    // Marca como avisado de qualquer jeito, para não conferir de novo
    await db.from("lembretes_enviados").insert({ chave: "prop-" + id });
    if (!robo) novas.push({ id, nome, assunto: cab("Subject") || "(sem assunto)" });
  }
  return novas;
}

function montarNotificacao(L: Lembrete[]) {
  if (L.length === 1 && L[0].tipo === "ttk") {
    return { titulo: "Dia de TikTok Shop", corpo: "O repasse costuma cair de madrugada. Confira e lance no painel, leva 10 segundos.", url: "./#financeiro", total: 1 };
  }
  const semana = L.find((x) => x.tipo === "semana");
  const resto = L.filter((x) => x.tipo !== "semana");
  const linhas = resto.slice(0, 5).map((x) => "• " + x.texto);
  if (resto.length > 5) linhas.push(`e mais ${resto.length - 5}`);
  if (semana) linhas.unshift(semana.texto);
  // Tocar na notificação abre a aba do primeiro aviso
  const url = (resto[0] || semana)?.url || "./#financeiro";
  return {
    titulo: semana ? "Bom dia! Sua semana" : resto.length === 1 ? "1 lembrete do seu painel" : `${resto.length} lembretes do seu painel`,
    corpo: linhas.join("\n"),
    url,
    total: resto.length,
  };
}

async function enviar(conteudo: Record<string, unknown>) {
  await prepararChaves();
  const { data: aparelhos } = await db.from("push_inscricoes").select("endpoint,inscricao");
  let enviados = 0;
  const erros: string[] = [];
  for (const a of aparelhos || []) {
    try {
      await webpush.sendNotification(a.inscricao, JSON.stringify(conteudo), { TTL: 60 * 60 * 12 });
      enviados++;
    } catch (e: any) {
      // Aparelho que desinstalou o app ou tirou a permissão: sai da lista
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_inscricoes").delete().eq("endpoint", a.endpoint);
      else erros.push(String(e?.statusCode || "") + " " + String(e?.body || e?.message || e));
    }
  }
  return { aparelhos: (aparelhos || []).length, enviados, erros };
}

async function ehOAdmin(req: Request) {
  try {
    const r = await fetch(`${URL_BANCO}/auth/v1/user`, {
      headers: { apikey: req.headers.get("apikey") ?? "", Authorization: req.headers.get("authorization") ?? "" },
    });
    const u = r.ok ? await r.json() : null;
    return !!u && String(u.email || "").toLowerCase() === EMAIL_ADMIN;
  } catch (_) {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method === "GET") return resposta({ chave_publica: await prepararChaves() });
    if (req.method !== "POST") return resposta({ erro: "Use GET ou POST." }, 405);

    let corpo: any = {};
    try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }
    const hoje = hojeSP();

    // Botão "Mandar notificação de teste" do painel
    if (corpo.acao === "teste") {
      if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode testar. Saia e entre de novo." }, 401);
      const L = await calcularLembretes(hoje);
      const conteudo = L.length ? montarNotificacao(L) : { titulo: "Notificações ligadas", corpo: "Tudo certo! Quando tiver algo pendente, o aviso chega aqui.", url: "./", total: 0 };
      return resposta({ ...(await enviar(conteudo)), lembretes: L.length });
    }

    // Relógio de cada minuto: lembrete rápido que chegou na hora
    if (corpo.tipo === "rapidos") {
      const { data: naHora } = await db.from("lembretes_rapidos").select("id,texto")
        .eq("feito", false).eq("avisado", false).lte("quando", new Date().toISOString()).limit(10);
      if (!naHora?.length) return resposta({ pulado: "nenhum lembrete agora" });
      for (const r of naHora) {
        // Marca antes de mandar, para nunca chegar repetido
        await db.from("lembretes_rapidos").update({ avisado: true }).eq("id", r.id);
        await enviar({ titulo: "Lembrete", corpo: r.texto, url: "./#inicio", tag: "rapido-" + r.id });
      }
      return resposta({ lembretes: naHora.length });
    }

    // Relógio de 2 em 2 horas: proposta nova no Gmail
    if (corpo.tipo === "propostas") {
      const novas = await propostasNovas();
      if (!novas.length) return resposta({ pulado: "nenhuma proposta nova" });
      const conteudo = novas.length === 1
        ? { titulo: `Proposta nova: ${novas[0].nome}`, corpo: novas[0].assunto, url: "./#propostas", tag: "propostas" }
        : { titulo: `${novas.length} propostas novas no Gmail`, corpo: novas.slice(0, 4).map((x) => `• ${x.nome}: ${x.assunto}`).join("\n"), url: "./#propostas", tag: "propostas" };
      return resposta({ ...(await enviar(conteudo)), propostas: novas.length });
    }

    // Relógio do Supabase (cron): no máximo um resumo de cada tipo por dia
    const tipo = corpo.tipo === "quarta" ? "quarta" : "diario";
    if (tipo === "quarta" && diaSemana(hoje) !== 3) return resposta({ pulado: "hoje não é quarta" });
    const { error: repetido } = await db.from("lembretes_enviados").insert({ chave: `${tipo}-${hoje}` });
    if (repetido) return resposta({ pulado: "já mandado hoje" });

    let L = await calcularLembretes(hoje);
    if (tipo === "quarta") L = L.filter((x) => x.tipo === "ttk");
    else {
      // Na quarta o TikTok já foi avisado às 8h: o resumo das 9h não repete
      const { data: jaAvisou } = await db.from("lembretes_enviados").select("chave").eq("chave", `quarta-${hoje}`).maybeSingle();
      if (jaAvisou) L = L.filter((x) => x.tipo !== "ttk");
      L = L.concat(await conferirConexoes(hoje));
      if (diaSemana(hoje) === 1) L = (await resumoDaSemana(hoje)).concat(L);
    }
    if (!L.length) return resposta({ pulado: "nada pendente" });
    return resposta({ ...(await enviar(montarNotificacao(L))), lembretes: L.length });
  } catch (e: any) {
    console.error(e);
    return resposta({ erro: String(e?.message || e) }, 500);
  }
});
