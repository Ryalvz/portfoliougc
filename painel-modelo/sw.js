/* App do painel no celular. Sempre busca a versão nova primeiro; sem internet, abre a última que guardou.
   Só guarda os arquivos do próprio painel (nunca os dados do Supabase). */
const CACHE = "painel-v2";
const ARQUIVOS = ["./", "./index.html", "./app.css", "./app.js", "./config.js", "./manifest.webmanifest", "./icone-192.png", "./icone-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(fetch(r, { cache: "no-cache" }).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("./index.html"))));
});
