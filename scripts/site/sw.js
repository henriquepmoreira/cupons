// Service worker do site do GitHub Pages (docs/). Copiado por scripts/gerar-site.py.
//
// Guarda a página, a cópia dos cupons, as coordenadas, os ícones e as fontes no aparelho:
// o site abre na hora (mesmo sem sinal) com o que está guardado e, em paralelo, busca a versão
// nova na rede. Se a cópia dos cupons mudou, avisa a página, que recarrega a lista sozinha;
// se a página mudou, avisa também, e ela se recarrega na próxima vez que a aba for para segundo plano.
const CACHE = "cupons-site-v1";
const ESSENCIAIS = ["index.html", "snapshot.json", "regras.json", "geo.json", "manifest.webmanifest", "icone-192.png", "icone-512.png", "apple-touch-icon.png"];
const FONTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// mesma chave para "/cupons/", "/cupons/index.html" e "/cupons/index.html?x=1"
function chave(url) {
  const u = new URL(url);
  if (u.origin === self.location.origin) {
    u.search = ""; u.hash = "";
    if (u.pathname.endsWith("/")) u.pathname += "index.html";
  }
  return u.href;
}

async function avisa(k) {
  const tipo = k.endsWith("/snapshot.json") ? "snapshot" : k.endsWith("/index.html") ? "pagina" : null;
  if (!tipo) return;
  for (const c of await self.clients.matchAll({ type: "window" })) c.postMessage({ tipo });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  const fonte = FONTES.includes(u.hostname);
  if (u.origin !== self.location.origin && !fonte) return;
  const k = chave(req.url);

  if (fonte) { // fontes não mudam: o que estiver guardado vale
    e.respondWith(caches.open(CACHE).then(async (c) => (await c.match(k)) || fetch(req).then((r) => {
      if (r.ok || r.type === "opaque") c.put(k, r.clone());
      return r;
    })));
    return;
  }

  // guardado primeiro; a rede atualiza em paralelo
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const velho = await c.match(k);
    const velhoTexto = velho ? velho.clone().text() : null;
    const rede = fetch(k, { cache: "no-cache" }).then(async (r) => {
      if (!r.ok) return r;
      const mudou = velhoTexto && (await velhoTexto) !== (await r.clone().text());
      await c.put(k, r.clone()); // guarda antes de avisar: a página relê e já recebe a versão nova
      if (mudou) await avisa(k);
      return r;
    }).catch(() => null);
    if (velho) { e.waitUntil(rede); return velho; }
    return (await rede) || new Response("Sem conexão e sem cópia guardada.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  })());
});
