/* =============================================================
   CONEXÃO COM O SUPABASE (usada por todas as páginas)

   Aqui ficam só o endereço do projeto e a chave PÚBLICA.
   A chave pública pode ficar no site: quem protege os dados é o RLS
   (as regras do arquivo banco.sql). NUNCA coloque a chave secreta
   (service_role ou sb_secret) aqui nem em arquivo nenhum.
   ============================================================= */
window.BANCO = {
  url: "https://jlehawiwklvyvrzbfuiu.supabase.co",
  chave: "sb_publishable_oZdhIWRB1gBabQH4xRJ2Xg__F8Lq0V0",
  // O único e-mail que pode entrar no admin
  emailAdmin: "heyryan.ugc@gmail.com"
};

/* Se a página carregou a biblioteca do Supabase (login e admin carregam),
   cria o cliente "db" pronto para usar. O portfólio público não carrega a
   biblioteca, para abrir mais rápido no celular: ele fala direto com o
   banco pelas funções abaixo. */
if (window.supabase && window.supabase.createClient) {
  window.db = window.supabase.createClient(window.BANCO.url, window.BANCO.chave);
}

/* Funções leves para o portfólio público (sem biblioteca nenhuma) */
window.bancoLer = async function (tabela, consulta) {
  const r = await fetch(`${window.BANCO.url}/rest/v1/${tabela}?${consulta || "select=*"}`, {
    headers: { apikey: window.BANCO.chave }
  });
  if (!r.ok) throw new Error("Falha ao ler " + tabela + " (" + r.status + ")");
  return r.json();
};

window.bancoInserir = async function (tabela, dados) {
  const r = await fetch(`${window.BANCO.url}/rest/v1/${tabela}`, {
    method: "POST",
    headers: {
      apikey: window.BANCO.chave,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(dados)
  });
  if (!r.ok) throw new Error("Falha ao gravar em " + tabela + " (" + r.status + ")");
  return true;
};
