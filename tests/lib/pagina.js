// Abre cupons.html no Chromium com um banco falso, como o visualizador do claude.ai faria.
//
// - Os cupons vêm de data/*.json (id = <programa>--<slug>), como no banco.
// - window.__snap() reenvia o snapshot (simula uma atualização do banco, com objetos novos).
// - window.__escritas guarda cada update() que a página manda ao banco: [{ id, patch }].
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

// mesmo esqueleto que o Artifact põe em volta da página
const documento = (html) => `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${html}</body></html>`;

const bancoFalso = `
  window.__escritas = [];
  window.claude = { use: async (k) => {
    if (k === "user") return { isOwner: async () => true, can: async () => true };
    if (k !== "db") return null;
    return { collection: () => ({
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
 * @param {string} [o.arquivo]     outra versão da página (padrão cupons.html)
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
  await pg.addInitScript(`window.__docs = ${JSON.stringify(cupons())};${bancoFalso}`);
  if (o.prefs) await pg.addInitScript(`try { localStorage.setItem("cupons-em-dobro:prefs:v1", ${JSON.stringify(JSON.stringify(o.prefs))}); } catch (_) {}`);
  // CUPONS_HTML=<arquivo> roda os testes contra outra versão da página (útil para ver se um teste pega a regressão)
  const html = fs.readFileSync(o.arquivo || process.env.CUPONS_HTML || path.join(RAIZ, "cupons.html"), "utf8");
  await pg.route("https://fonts.googleapis.com/**", (r) => r.abort());
  await pg.route("https://fonts.gstatic.com/**", (r) => r.abort());
  await pg.route(ORIGEM, (r) => r.fulfill({ contentType: "text/html", body: documento(html) }));
  await pg.route(ORIGEM + "geo.json", (r) => (o.geo === false
    ? r.fulfill({ status: 404, body: "" })
    : r.fulfill({ contentType: "application/json", body: fs.readFileSync(path.join(RAIZ, "data", "geo.json"), "utf8") })));
  await pg.route(ORIGEM + "snapshot.json", (r) => r.fulfill({ status: 404, body: "" }));
  await pg.goto(ORIGEM);
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

module.exports = { abrir, fechar, cupons, texto, textos, numero, cartoes, espera, busca, focado, arvoreAcessibilidade, RAIZ };
