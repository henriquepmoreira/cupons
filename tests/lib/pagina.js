// Abre cupons.html no Chromium com um banco falso, como o visualizador do claude.ai faria.
//
// - Os cupons vêm de data/*.json (id = <programa>--<slug>), como no banco.
// - window.__snap() reenvia o snapshot (simula uma atualização do banco, com objetos novos).
// - window.__escritas guarda cada update() que a página manda ao banco: [{ id, patch }].
// - window.__atrasoBanco (ms) atrasa a resposta de claude.use("db") (simula banco lento).
// - A página é servida em https (a localização do navegador só funciona em contexto seguro).
// - Para conferir acessibilidade, use a árvore do Chrome (arvoreAcessibilidade) e textContent;
//   innerText e ariaSnapshot leem o DOM e podem esconder problemas que o TalkBack veria.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..");
const ORIGEM = "https://cupons.test/";
const PROGRAMAS = ["poa-em-dobro", "tour-grande-poa", "canoas-em-dobro"];

function cupons() {
  const docs = [];
  for (const p of PROGRAMAS) {
    const d = JSON.parse(fs.readFileSync(path.join(RAIZ, "data", `${p}.json`), "utf8"));
    for (const c of d.cupons) docs.push({ id: `${p}--${c.slug}`, programa: p, ...c });
  }
  return docs;
}

// mesmo esqueleto que o Artifact põe em volta da página; site = com a marca do site do Pages (service worker)
const documento = (html, site) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">${site ? '<meta name="cupons-site" content="pages">' : ""}</head><body>${html}</body></html>`;

const bancoFalso = `
  window.__escritas = [];
  window.claude = { use: async (k) => {
    if (k === "user") return { isOwner: async () => true, can: async () => true, id: async () => "u_teste" };
    if (k !== "db") return null;
    if (window.__semBanco) return null;
    if (window.__atrasoBanco) await new Promise((r) => setTimeout(r, window.__atrasoBanco));
    return { collection: (caminho) => (String(caminho).startsWith("data/users/") ? {
      // área privada de quem está logado: só o documento "lugares" (window.__lugares)
      doc: (id) => ({ onSnapshot: (cb) => {
        setTimeout(() => cb({ id, exists: !!window.__lugares, data: () => window.__lugares, metadata: { fromCache: false, hasPendingWrites: false } }), 10);
        return () => {};
      } }),
    } : {
      onSnapshot: (cb) => {
        window.__snap = () => cb({ metadata: { fromCache: false }, size: window.__docs.length,
          docs: window.__docs.map((d) => ({ id: d.id, data: () => ({ ...d }) })) });
        setTimeout(window.__snap, 10);
      },
      doc: (id) => ({ update: async (patch) => {
        window.__escritas.push({ id, patch });
        const d = window.__docs.find((x) => x.id === id); if (d) Object.assign(d, patch);
      } }),
    }) };
  } };`;

let navegador = null;
async function abrirNavegador() {
  if (!navegador) navegador = await chromium.launch();
  return navegador;
}

/**
 * @param {object} o
 * @param {string} [o.data]        data e hora fixas, ex.: "2026-11-20T12:30:00"
 * @param {number} [o.largura]     padrão 390 (celular)
 * @param {"light"|"dark"} [o.tema]
 * @param {{latitude:number, longitude:number}} [o.localizacao]  com permissão concedida
 * @param {boolean} [o.geo]        serve data/geo.json (padrão true)
 * @param {string} [o.geoJson]     outro conteúdo para geo.json (ex.: o compacto publicado)
 * @param {string} [o.arquivo]     outra versão da página (padrão cupons.html)
 * @param {(docs: object[]) => object[]|void} [o.ajustar]  muda os cupons antes de abrir
 * @param {number} [o.atrasoBanco] ms até o banco responder
 * @param {boolean} [o.semBanco]   sem banco (como quem abre o link sem estar logado)
 * @param {{em:string, cupons:object[]}} [o.cache]  lista guardada no navegador antes de abrir
 * @param {{lugares: object[]}} [o.lugares]  documento data/users/<id>/lugares ("Meus lugares")
 * @param {object} [o.snapshot]   cópia publicada servida como snapshot.json (sem isto, 404)
 * @param {object} [o.regras]     regras.json ({ id: texto }); sem isto, 404
 * @param {boolean} [o.site]      com a marca do site do Pages (a página registra sw.js, que aqui dá 404)
 * @param {boolean} [o.esperarCartoes]  padrão true
 * @param {boolean} [o.compacta]   abre com a lista compacta, o padrão da página (os testes usam a completa,
 *                                 que mostra todos os botões do cartão; uma preferência em o.prefs vale mais)
 */
async function abrir(o = {}) {
  const b = await abrirNavegador();
  const ctx = await b.newContext({
    viewport: { width: o.largura || 390, height: o.altura || 844 },
    colorScheme: o.tema || "light",
    ...(o.localizacao ? { geolocation: o.localizacao, permissions: ["geolocation"] } : { permissions: [] }),
  });
  const pg = await ctx.newPage();
  pg.erros = [];
  pg.on("pageerror", (e) => pg.erros.push(e.message));
  if (o.data) await pg.clock.setFixedTime(new Date(o.data));
  // ajustar(docs) muda os cupons antes de a página abrir (para simular um caso que os dados reais não têm)
  let docs = cupons();
  if (o.ajustar) docs = o.ajustar(docs) || docs;
  await pg.addInitScript(`window.__docs = ${JSON.stringify(docs)};window.__atrasoBanco = ${o.atrasoBanco || 0};window.__semBanco = ${!!o.semBanco};window.__lugares = ${JSON.stringify(o.lugares || null)};${bancoFalso}`);
  if (o.cache) await pg.addInitScript(`try { if (!sessionStorage.getItem("__cache_ok")) { localStorage.setItem("cupons-em-dobro:cache:v1", ${JSON.stringify(JSON.stringify(o.cache))}); sessionStorage.setItem("__cache_ok", "1"); } } catch (_) {}`);
  const prefs = o.compacta ? o.prefs : { lista: "completa", ...(o.prefs || {}) };
  // só antes da primeira abertura: um recarregar no meio do teste lê o que a página gravou
  if (prefs) await pg.addInitScript(`try { if (!sessionStorage.getItem("__prefs_ok")) { localStorage.setItem("cupons-em-dobro:prefs:v1", ${JSON.stringify(JSON.stringify(prefs))}); sessionStorage.setItem("__prefs_ok", "1"); } } catch (_) {}`);
  // CUPONS_HTML=<arquivo> roda os testes contra outra versão da página (útil para ver se um teste pega a regressão)
  const html = fs.readFileSync(o.arquivo || process.env.CUPONS_HTML || path.join(RAIZ, "cupons.html"), "utf8");
  await pg.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await pg.route("https://fonts.gstatic.com/**", (r) => r.abort());
  // mapa do site: Leaflet da pasta node_modules (o mesmo 1.9.4 do cdnjs) e ladrilhos vazios, sem internet
  await pg.route("https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/**", (r) => {
    const arq = r.request().url().endsWith(".css") ? "leaflet.css" : "leaflet.js";
    return r.fulfill({ contentType: arq.endsWith(".css") ? "text/css" : "application/javascript", body: fs.readFileSync(path.join(__dirname, "..", "node_modules", "leaflet", "dist", arq), "utf8") });
  });
  await pg.route("https://tile.openstreetmap.org/**", (r) => r.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") }));
  await pg.route(ORIGEM, (r) => r.fulfill({ contentType: "text/html", body: documento(html, o.site) }));
  await pg.route(ORIGEM + "sw.js", (r) => r.fulfill({ status: 404, body: "" }));
  await pg.route(ORIGEM + "regras.json", (r) => (o.regras ? r.fulfill({ contentType: "application/json", body: JSON.stringify(o.regras) }) : r.fulfill({ status: 404, body: "" })));
  // pg.__atrasoGeo (ms): geo.json demora a chegar (o teste muda antes de recarregar)
  await pg.route(ORIGEM + "geo.json", async (r) => (pg.__atrasoGeo && await new Promise((ok) => setTimeout(ok, pg.__atrasoGeo)), o.geo === false
    ? r.fulfill({ status: 404, body: "" })
    : r.fulfill({ contentType: "application/json", body: o.geoJson || fs.readFileSync(path.join(RAIZ, "data", "geo.json"), "utf8") })));
  await pg.route(ORIGEM + "snapshot.json", (r) => (o.snapshot ? r.fulfill({ contentType: "application/json", body: JSON.stringify(o.snapshot) }) : r.fulfill({ status: 404, body: "" })));
  await pg.goto(ORIGEM);
  if (o.esperarCartoes === false) return pg;
  await pg.waitForSelector(".ticket");
  await pg.waitForTimeout(300);
  return pg;
}

async function fechar() {
  if (navegador) await navegador.close();
  navegador = null;
}

// utilidades de leitura (sempre textContent)
const texto = (pg, sel) => pg.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim());
const textos = (pg, sel) => pg.$$eval(sel, (es) => es.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const numero = (s) => Number(String(s).match(/\d+/)?.[0] ?? NaN);
const cartoes = (pg) => pg.$$eval("#grid .ticket", (t) => t.length);
const espera = (pg, ms = 80) => pg.waitForTimeout(ms);
// a busca tem um atraso de 80 ms antes de filtrar
async function busca(pg, q) { await pg.fill("#q", q); await pg.waitForTimeout(200); }
// abre o painel Filtros (se fechado) na aba pedida: "quando", "oque" ou "onde"
async function aba(pg, nome) {
  if (await pg.$eval("#filters", (e) => e.hidden)) await pg.click("#filters-toggle");
  await pg.click(`#aba-${nome}`);
  await pg.waitForTimeout(50);
}
// fecha o painel Filtros pelo × (no celular ele cobre a página e o botão Filtros fica inerte)
async function fecharFiltros(pg) {
  if (!(await pg.$eval("#filters", (e) => e.hidden))) await pg.click("#filters-close");
  await pg.waitForTimeout(50);
}
// Situação, Ordenar e Compacta ficam no topo do painel Filtros (a barra só tem os atalhos)
async function abrirFiltros(pg) { if (await pg.$eval("#filters", (e) => e.hidden)) await pg.click("#filters-toggle"); await pg.waitForTimeout(50); }
async function ordenar(pg, valor, { fechar: fecha = true } = {}) { await abrirFiltros(pg); await pg.selectOption("#sort", valor); await pg.waitForTimeout(80); if (fecha) await fecharFiltros(pg); }
async function compacta(pg) { await abrirFiltros(pg); await pg.click("#compacto-toggle"); await pg.waitForTimeout(80); await fecharFiltros(pg); }
async function focado(pg) {
  return pg.evaluate(() => {
    const a = document.activeElement;
    return { id: a.id, cls: a.className, texto: a.textContent.replace(/\s+/g, " ").trim(), card: a.closest(".ticket")?.dataset.id || null };
  });
}

// árvore de acessibilidade do Chrome (o que o TalkBack recebe)
async function arvoreAcessibilidade(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send("Accessibility.enable");
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  return nodes;
}

module.exports = { abrir, fechar, cupons, texto, textos, numero, cartoes, espera, busca, aba, fecharFiltros, focado, abrirFiltros, ordenar, compacta, arvoreAcessibilidade, RAIZ };
