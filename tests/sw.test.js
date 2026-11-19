// Service worker do site (scripts/site/sw.js), rodado no Node com caches e fetch simulados.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { RAIZ } = require("./lib/pagina");

const BASE = "https://exemplo.github.io/cupons/";
const CSS_URL = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..100,700..900&family=Figtree:wght@400;500;600;700&display=swap";
const CSS = `/* cyrillic */
@font-face { font-family: 'Figtree'; src: url(https://fonts.gstatic.com/s/figtree/cirilico.woff2) format('woff2'); }
/* latin-ext */
@font-face { font-family: 'Figtree'; src: url(https://fonts.gstatic.com/s/figtree/latin-ext.woff2) format('woff2'); }
/* latin */
@font-face { font-family: 'Archivo'; src: url(https://fonts.gstatic.com/l/font?kit=archivo&v=v25) format('woff2'); }
/* latin */
@font-face { font-family: 'Figtree'; src: url(https://fonts.gstatic.com/s/figtree/latin.woff2) format('woff2'); }`;

function ambiente({ falhaFontes = false } = {}) {
  const guardado = new Map(), buscas = [];
  const resposta = (corpo, ok = true) => ({ ok, status: ok ? 200 : 503, clone() { return resposta(corpo, ok); }, text: async () => corpo });
  const cache = {
    addAll: async (xs) => { for (const x of xs) guardado.set(new URL(x, BASE).href, resposta(x === "index.html" ? `<link rel="stylesheet" id="fontes" media="print" href="${CSS_URL.replace(/&/g, "&amp;")}">` : x)); },
    put: async (k, r) => { guardado.set(String(k), r); },
    match: async (k) => guardado.get(String(k)),
  };
  const ouvintes = {};
  const self = { location: { href: BASE + "sw.js", origin: new URL(BASE).origin }, addEventListener: (t, f) => { ouvintes[t] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => [] } };
  const fetch = async (u) => { buscas.push(String(u)); if (falhaFontes) throw new Error("sem rede"); return resposta(String(u) === CSS_URL ? CSS : "fonte"); };
  vm.runInNewContext(fs.readFileSync(path.join(RAIZ, "scripts", "site", "sw.js"), "utf8"), { self, caches: { open: async () => cache, keys: async () => [] }, fetch, URL, Response: class {} });
  const instala = async () => { let p; ouvintes.install({ waitUntil: (x) => { p = x; } }); await p; };
  return { guardado, buscas, instala };
}

test("na instalação, guarda a folha das fontes e só os arquivos do subconjunto latino", async () => {
  const a = ambiente();
  await a.instala();
  assert.ok(a.guardado.has(new URL(CSS_URL).href), "folha de estilos das fontes");
  assert.ok(a.guardado.has("https://fonts.gstatic.com/l/font?kit=archivo&v=v25"));
  assert.ok(a.guardado.has("https://fonts.gstatic.com/s/figtree/latin.woff2"));
  assert.ok(!a.buscas.some((u) => /cirilico|latin-ext/.test(u)), "não baixa outros alfabetos");
  assert.ok(a.guardado.has(BASE + "snapshot.json") && a.guardado.has(BASE + "regras.json"), "essenciais continuam");
});

test("sem rede para as fontes, a instalação termina do mesmo jeito", async () => {
  const a = ambiente({ falhaFontes: true });
  await a.instala();
  assert.ok(a.guardado.has(BASE + "index.html"));
});

test("o endereço das fontes no service worker é o mesmo que a página pede", () => {
  const pagina = fs.readFileSync(path.join(RAIZ, "cupons.html"), "utf8");
  assert.match(pagina, /<link rel="stylesheet" id="fontes"[^>]*href="https:\/\/fonts\.googleapis\.com\/css2[^"]+"/, "o service worker acha o <link id=\"fontes\"> pela regex");
});
