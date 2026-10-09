// =============================================================
// AJUDANTE "gmail" (Supabase Edge Function)
// Mantém o Gmail de propostas (heyryan.ugc@gmail.com) conectado
// para sempre: guarda a autorização permanente do Google e entrega
// ao painel um acesso novo sempre que ele pedir. Assim o Ryan
// conecta uma vez só e nunca mais precisa clicar em "Conectar".
//
// O segredo do app do Google NÃO fica aqui: ele fica no cofre do
// Supabase (Edge Functions > Secrets) com o nome GOOGLE_CLIENT_SECRET.
// A autorização permanente fica na tabela config_privada, que só
// este ajudante lê. Só o login do Ryan consegue usar este ajudante.
//
// acao "conectar":    recebe o código do Google e guarda a autorização
// acao "token":       devolve um acesso novo (vale 1 hora)
// acao "desconectar": desfaz a autorização no Google e apaga
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_ADMIN = "heyryan.ugc@gmail.com";
const GOOGLE_CLIENT_ID = "317757639743-datc7u3k3d7hauj06q6viqefstliqkle.apps.googleusercontent.com";
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

async function lerAutorizacao() {
  const { data } = await db.from("config_privada").select("valor").eq("chave", "gmail_refresh").maybeSingle();
  return data?.valor || "";
}

async function pedirAoGoogle(campos: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(campos),
  });
  return { ok: r.ok, dados: await r.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  if (!(await ehOAdmin(req))) return resposta({ erro: "Só o dono do painel pode usar isso. Saia e entre de novo." }, 401);

  const segredo = Deno.env.get("GOOGLE_CLIENT_SECRET");
  let corpo: any = {};
  try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }

  try {
    if (corpo.acao === "conectar") {
      if (!segredo) return resposta({ erro: "Falta guardar o segredo do app do Google no Supabase (Edge Functions > Secrets > GOOGLE_CLIENT_SECRET)." });
      const { ok, dados } = await pedirAoGoogle({
        code: String(corpo.code || ""), client_id: GOOGLE_CLIENT_ID, client_secret: segredo,
        redirect_uri: String(corpo.redirect_uri || ""), grant_type: "authorization_code",
      });
      if (!ok) return resposta({ erro: "O Google recusou a conexão (" + (dados.error_description || dados.error || "erro") + "). Tente conectar de novo." });
      if (!dados.refresh_token) {
        return resposta({ erro: "O Google não mandou a autorização permanente. Abra myaccount.google.com/permissions, remova o acesso do Painel Ryan e conecte de novo." });
      }
      await db.from("config_privada").upsert([{ chave: "gmail_refresh", valor: dados.refresh_token }], { onConflict: "chave" });
      return resposta({ conectado: true, access_token: dados.access_token, expires_in: dados.expires_in, scope: dados.scope });
    }

    if (corpo.acao === "desconectar") {
      const refresh = await lerAutorizacao();
      if (refresh) await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(refresh), { method: "POST" }).catch(() => {});
      await db.from("config_privada").delete().eq("chave", "gmail_refresh");
      return resposta({ ok: true });
    }

    // acao "token": acesso novo a partir da autorização permanente
    const refresh = await lerAutorizacao();
    if (!refresh) return resposta({ conectado: false });
    if (!segredo) return resposta({ conectado: false, erro: "Falta o segredo do app do Google no Supabase." });
    const { ok, dados } = await pedirAoGoogle({ refresh_token: refresh, client_id: GOOGLE_CLIENT_ID, client_secret: segredo, grant_type: "refresh_token" });
    if (!ok) {
      if (dados.error === "invalid_grant") await db.from("config_privada").delete().eq("chave", "gmail_refresh");
      return resposta({ conectado: false, erro: "A conexão com o Gmail foi desfeita. Conecte de novo (é só uma vez)." });
    }
    return resposta({ conectado: true, access_token: dados.access_token, expires_in: dados.expires_in, scope: dados.scope });
  } catch (e: any) {
    console.error(e);
    return resposta({ erro: String(e?.message || e) });
  }
});
