/* Conexão com o SEU Supabase (Project Settings > API, ou o botão Connect no topo do projeto).
   SUPABASE_URL = Project URL. SUPABASE_ANON_KEY = Publishable key (em projeto antigo: anon public).
   Essa chave é pública e pode ficar aqui: quem protege os seus dados são as travas do banco.sql.
   NUNCA coloque aqui a chave secreta (secret / service_role).
   Vazio = abre em modo demonstração, com dados de exemplo. */
window.PAINEL_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  // Perfil que entra sozinho no primeiro login (vem do que o aluno preencheu no guia)
  PERFIL_INICIAL: null
};
