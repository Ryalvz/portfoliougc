/* App do painel no celular. Sempre busca a versão nova primeiro; sem internet, abre a última que guardou.
   Só guarda os arquivos do próprio painel (nunca os dados do Supabase). */
const CACHE = "painel-v3";
const ARQUIVOS = ["./", "./index.html", "./app.css", "./app.js", "./config.js", "./manifest.webmanifest", "./icone-192.png", "./icone-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("./index.html"))));
});

/* Lembrete da manhã: chega mesmo com o app fechado */
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Meu painel", { body: d.corpo || "Hora de subir o extrato.", icon: "icone-192.png", badge: "icone-192.png", data: { url: d.url || "./#importar" }, tag: "lembrete-extrato" }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    for (const c of ws) if (c.url.startsWith(self.registration.scope)) { c.navigate(alvo); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
