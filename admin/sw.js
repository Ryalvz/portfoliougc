/* =============================================================
   SERVICE WORKER DO PAINEL
   Só recebe as notificações do ajudante "lembretes" e abre o
   painel quando você toca nelas. Não guarda nada em cache, então
   o painel sempre abre na versão mais nova.
   ============================================================= */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data ? e.data.text() : "" }; }
  const tarefas = [self.registration.showNotification(d.titulo || "Painel Ryan", {
    body: d.corpo || "",
    icon: "icone-192.png",
    badge: "icone-192.png",
    tag: d.tag || "lembretes",
    data: { url: d.url || "./" }
  })];
  // Número no ícone do app (quantos lembretes)
  if (typeof d.total === "number" && self.navigator.setAppBadge) tarefas.push((d.total ? self.navigator.setAppBadge(d.total) : self.navigator.clearAppBadge()).catch(() => {}));
  e.waitUntil(Promise.all(tarefas));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
    const aberta = janelas.find((w) => w.url.startsWith(self.registration.scope));
    if (aberta) return (aberta.navigate ? aberta.navigate(url).catch(() => aberta) : Promise.resolve(aberta)).then((w) => (w || aberta).focus());
    return self.clients.openWindow(url);
  }));
});
