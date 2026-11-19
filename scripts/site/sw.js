// Service worker do site do GitHub Pages (docs/). Copiado por scripts/gerar-site.py.
//
// Guarda a página, a cópia dos cupons, as coordenadas, os ícones e as fontes (já na instalação) no aparelho:
// o site abre na hora (mesmo sem sinal) com o que está guardado e, em paralelo, busca a versão
// nova na rede. Se a cópia dos cupons mudou, avisa a página, que recarrega a lista sozinha;
// se a página mudou, avisa também, e ela se recarrega na próxima vez que a aba for para segundo plano.
const CACHE = "cupons-site-v1";
const ESSENCIAIS = ["index.html", "snapshot.json", "regras.json", "geo.json", "manifest.webmanifest", "icone-192.png", "icone-512.png", "apple-touch-icon.png"];
const FONTES = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS).then(() => guardaFontes(c))).then(() => self.skipWaiting()));
});

// Fontes já na instalação: sem isto, a primeira abertura sem sinal saía com a fonte do sistema.
// O endereço vem da própria página guardada (o <link id="fontes">), para não ficar duplicado aqui;
// só o subconjunto latino, o único que a página usa. Uma falha aqui não impede a instalação.
async function guardaFontes(c) {
  try {
    const pagina = await (await c.match(chave(new URL("index.html", self.location.href).href))).text();
    const m = pagina.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
    if (!m) return;
    const css = new URL(m[1].replace(/&amp;/g, "&")).href;
    const r = await fetch(css, { mode: "cors" });
    if (!r.ok) return;
    const texto = await r.clone().text();
    await c.put(css, r);
    const latinos = texto.split("/* ").filter((b) => b.startsWith("latin */"));
    const arquivos = [...new Set(latinos.flatMap((b) => b.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || []))];
    await Promise.all(arquivos.map(async (u) => {
      const f = await fetch(u, { mode: "cors" });
      if (f.ok) await c.put(u, f);
    }));
  } catch (_) {}
}

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
