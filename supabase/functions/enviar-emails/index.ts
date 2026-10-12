// =============================================================
// AJUDANTE "enviar-emails" (Supabase Edge Function)
// O carteiro da aba Prospecção: manda o seu e-mail de apresentação
// para uma lista de marcas, pelo Resend, uma de cada vez.
//
// A chave do Resend NÃO fica aqui: ela fica no cofre do Supabase
// (Edge Functions > Secrets) com o nome RESEND_API_KEY.
// Opcional: RESEND_FROM com o remetente (ex.: Ryan Alves <ryan@seudominio.com>).
// Sem domínio verificado, o Resend só aceita o remetente de teste
// onboarding@resend.dev e só entrega para o seu próprio e-mail.
//
// Recebe: { destinatarios: [{ email, nome, marca, marca_id }], assunto, html, pularRepetidos, teste }
// teste: true manda só para o seu e-mail, sem entrar no registro
// Devolve: { enviados, falharam, pulados, cotaAcabou, faltaram }
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const EMAIL_RESPOSTA = "heyryan.ugc@gmail.com";
const MAXIMO_POR_CHAMADA = 250;
const PAUSA_MS = 200; // uns 5 por segundo
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Só o login do Ryan passa
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

// Troca {{nome}} e {{marca}} (com ou sem espaços dentro das chaves)
const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const preencher = (t: string, nome: string, marca: string) =>
  t.replace(/\{\{\s*nome\s*\}\}/gi, escapar(nome)).replace(/\{\{\s*marca\s*\}\}/gi, escapar(marca));
const emailValido = (e: string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode enviar. Saia e entre de novo." }, 401);

  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) return resposta({ erro: "Falta guardar a chave do Resend no Supabase (Edge Functions > Secrets > RESEND_API_KEY).", semChave: true });
  const remetente = Deno.env.get("RESEND_FROM") || "Ryan Alves <onboarding@resend.dev>";

  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { return resposta({ erro: "Pedido sem conteúdo." }, 400); }
  const assunto = String(corpo.assunto || "").trim().slice(0, 300);
  const html = String(corpo.html || "");
  const teste = corpo.teste === true;
  let lista: any[] = Array.isArray(corpo.destinatarios) ? corpo.destinatarios : [];
  // Teste: sempre e só para o seu e-mail, usando o nome de exemplo que veio
  if (teste) lista = [{ ...(lista[0] || {}), email: EMAIL_ADMIN, marca_id: null }];
  if (!assunto || !html) return resposta({ erro: "Faltou o assunto ou o texto do e-mail." }, 400);
  if (!lista.length) return resposta({ erro: "Nenhum destinatário." }, 400);
  if (lista.length > MAXIMO_POR_CHAMADA) return resposta({ erro: `No máximo ${MAXIMO_POR_CHAMADA} destinatários por vez.` }, 400);

  // Nunca duas vezes para o mesmo e-mail no mesmo disparo
  const vistos = new Set<string>();
  const unicos = lista.map((d) => ({ ...d, email: String(d.email || "").trim().toLowerCase() }))
    .filter((d) => emailValido(d.email) && !vistos.has(d.email) && vistos.add(d.email));
  const emails = unicos.map((d) => d.email);

  // Quem pediu para sair, e (se pedido) quem já recebeu este mesmo assunto
  const { data: fora } = teste ? { data: [] } : await db.from("email_optout").select("email").in("email", emails);
  const descadastrados = new Set((fora || []).map((x) => String(x.email).toLowerCase()));
  let jaReceberam = new Set<string>();
  if (!teste && corpo.pularRepetidos !== false) {
    const { data: ja } = await db.from("email_envios").select("email").eq("assunto", assunto).eq("status", "ok").in("email", emails);
    jaReceberam = new Set((ja || []).map((x) => String(x.email).toLowerCase()));
  }

  let enviados = 0, falharam = 0, pulados = lista.length - unicos.length, cotaAcabou = false, faltaram = 0;
  const enviadosIds: number[] = [];
  const erros: string[] = [];

  for (let i = 0; i < unicos.length; i++) {
    const d = unicos[i];
    if (descadastrados.has(d.email) || jaReceberam.has(d.email)) { pulados++; continue; }
    const nome = String(d.nome || d.marca || "").trim(), marca = String(d.marca || d.nome || "").trim();

    let r: Response | null = null, j: any = {};
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: remetente,
          to: [d.email],
          subject: preencher(assunto, nome, marca).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
          html: preencher(html, nome, marca),
          reply_to: EMAIL_RESPOSTA,
          headers: { "List-Unsubscribe": `<mailto:${EMAIL_RESPOSTA}?subject=SAIR>` },
        }),
      }).catch(() => null);
      j = r ? await r.json().catch(() => ({})) : {};
      // Muito rápido: espera 1 segundo e tenta mais uma vez
      if (r && r.status === 429 && j.name !== "daily_quota_exceeded" && tentativa === 0) { await esperar(1000); continue; }
      break;
    }

    // Cota do dia acabou: para na hora
    if (j.name === "daily_quota_exceeded" || /daily.?quota/i.test(String(j.message || ""))) {
      cotaAcabou = true;
      faltaram = unicos.slice(i).filter((x) => !descadastrados.has(x.email) && !jaReceberam.has(x.email)).length;
      break;
    }

    const ok = !!r && r.ok && !!j.id;
    const erro = ok ? null : String(j.message || j.name || (r ? `Erro ${r.status}` : "Sem conexão com o Resend")).slice(0, 1000);
    if (!teste) await db.from("email_envios").insert({
      email: d.email, assunto, status: ok ? "ok" : "erro", erro, resend_id: ok ? j.id : null, via: "resend",
      marca_id: Number(d.marca_id) || null,
    });
    if (ok) { enviados++; if (Number(d.marca_id)) enviadosIds.push(Number(d.marca_id)); }
    else { falharam++; if (erros.length < 3 && erro) erros.push(erro); }
    await esperar(PAUSA_MS);
  }

  // Marca na sua base o dia em que cada marca recebeu
  if (enviadosIds.length) {
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    await db.from("marcas").update({ email_enviado_em: hoje }).in("id", enviadosIds);
  }

  return resposta({ enviados, falharam, pulados, cotaAcabou, faltaram, erros });
});
