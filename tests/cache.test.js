// Primeira tela instantânea: a última lista do banco fica guardada no navegador e aparece na hora.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, cupons, texto, espera } = require("./lib/pagina");

after(fechar);

const CHAVE = "cupons-em-dobro:cache:v1";
const guardada = (ajuste) => { const cs = cupons(); if (ajuste) ajuste(cs); return { em: "2026-11-17T21:05:00.000Z", cupons: cs }; };
const lerCache = (pg) => pg.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), CHAVE);

test("guarda a lista que veio do banco", async () => {
  const pg = await abrir();
  await pg.waitForTimeout(1700);
  const c = await lerCache(pg);
  assert.ok(c, "lista guardada");
  assert.equal(c.cupons.length, cupons().length);
  assert.match(c.em, /^\d{4}-\d\d-\d\dT/);
});

test("com banco lento, mostra a lista guardada na hora e troca pela do banco quando ele chega", async () => {
  // na guardada, o primeiro cupom não é favorito; no banco é
  const docs0 = cupons();
  const id = docs0[0].id, favBanco = !docs0[0].favorito;
  const pg = await abrir({
    atrasoBanco: 2500, esperarCartoes: false,
    cache: guardada((cs) => { cs[0].favorito = !favBanco; }),
    ajustar: (docs) => { docs[0].favorito = favBanco; },
  });
  await pg.waitForSelector(".ticket", { timeout: 1000 });
  const coracao = `.ticket[data-id="${id}"] .heart`;
  assert.equal(await pg.$eval(coracao, (b) => b.getAttribute("aria-pressed")), String(!favBanco), "valor da guardada");
  await pg.waitForTimeout(1700);
  assert.match(await texto(pg, "#notice"), /^Lista guardada neste aparelho \(17\/11\/26 \d\d:\d\d17 de novembro de 2026, às \d\d:\d\d\)\. Atualizando…$/);
  await pg.waitForTimeout(1200);
  assert.equal(await pg.$eval(coracao, (b) => b.getAttribute("aria-pressed")), String(favBanco), "o banco vale");
  assert.equal(await pg.$eval("#notice", (e) => e.hidden), true, "aviso some");
  assert.deepEqual(pg.erros, []);
});

test("banco rápido: o aviso da lista guardada nem aparece", async () => {
  const pg = await abrir({ cache: guardada(), atrasoBanco: 300 });
  await pg.waitForTimeout(1800);
  assert.equal(await pg.$eval("#notice", (e) => e.hidden), true);
});

test("favoritar antes de o banco responder: a marca vai ao banco quando ele chega", async () => {
  const pg = await abrir({ cache: guardada(), atrasoBanco: 2000, esperarCartoes: false });
  await pg.waitForSelector(".ticket", { timeout: 1000 });
  const id = await pg.$eval("#grid .ticket", (t) => t.dataset.id);
  const antes = await pg.$eval("#grid .ticket .heart", (b) => b.getAttribute("aria-pressed"));
  await pg.click("#grid .ticket .heart");
  await espera(pg);
  assert.notEqual(await pg.$eval(`.ticket[data-id="${id}"] .heart`, (b) => b.getAttribute("aria-pressed")), antes, "resposta na hora");
  assert.deepEqual(await pg.evaluate(() => window.__escritas), []);
  await pg.waitForTimeout(2300);
  const esc = await pg.evaluate(() => window.__escritas);
  assert.equal(esc.length, 1);
  assert.equal(esc[0].id, id);
  assert.equal(String(esc[0].patch.favorito), antes === "true" ? "false" : "true");
  assert.equal(await pg.$eval(`.ticket[data-id="${id}"] .heart`, (b) => b.getAttribute("aria-pressed")), String(esc[0].patch.favorito));
});

test("sem banco e sem cópia publicada: a lista guardada fica, só para consulta", async () => {
  const pg = await abrir({ cache: guardada(), semBanco: true });
  await pg.waitForTimeout(300);
  assert.ok((await pg.$$eval("#grid .ticket", (t) => t.length)) > 0);
  assert.match(await texto(pg, "#notice"), /^Cópia da carteira de 17\/11\/2617 de novembro de 2026, só para consulta/);
  assert.equal(await pg.$$eval("#grid .ticket .heart:not([disabled])", (b) => b.length), 0, "sem favoritar");
});

test("lista guardada estragada é ignorada", async () => {
  const pg = await abrir({ cache: { em: 1, cupons: "x" } });
  assert.ok((await pg.$$eval("#grid .ticket", (t) => t.length)) > 0);
  assert.deepEqual(pg.erros, []);
});

// lista guardada e cópia publicada enxutas: sem regras e sem valores vazios
test("a lista guardada vai enxuta: sem regras nem vazios, com feriados false mantido", async () => {
  const pg = await abrir();
  await pg.waitForTimeout(1700);
  const c = await lerCache(pg);
  const todos = c.cupons;
  assert.ok(todos.every((x) => !("regras" in x)), "sem regras");
  assert.ok(todos.every((x) => Object.values(x).every((v) => v !== null && !(Array.isArray(v) && !v.length))), "sem null nem listas vazias");
  assert.ok(todos.every((x) => x.favorito !== false && x.usado !== false), "favorito/usado false não são guardados");
  assert.ok(todos.some((x) => x.feriados === false), "feriados: false continua (quer dizer que não vale)");
  const bruto = JSON.stringify(cupons()).length, guardado = JSON.stringify(todos).length;
  assert.ok(guardado < bruto * 0.8, `${Math.round(guardado / 1024)} KB x ${Math.round(bruto / 1024)} KB`);
});

// cópia publicada como scripts/gerar-snapshot.py gera
function copiaPublicada() {
  const FALSO = new Set(["favorito", "usado", "maisUnidades", "verRegras"]);
  const cs = cupons();
  const regras = Object.fromEntries(cs.filter((c) => c.regras).map((c) => [c.id, c.regras]));
  const enx = cs.map((c) => Object.fromEntries(Object.entries(c).filter(([k, v]) => k !== "regras" && v != null && !(Array.isArray(v) && !v.length) && !(v === false && FALSO.has(k)))));
  return { snapshot: { geradoEm: "2026-11-18", regras: "regras.json", cupons: enx }, regras, cs };
}

test("sem login: a cópia publicada vem sem regras e elas chegam depois (painel e busca)", async () => {
  const { snapshot, regras, cs } = copiaPublicada();
  // palavra que só aparece nas regras de algum cupom
  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fora = norm(cs.map((c) => JSON.stringify({ ...c, regras: "" })).join(" "));
  let palavra = null, dono = null;
  for (const c of cs.filter((x) => x.regras && !x.usado)) {
    palavra = norm(c.regras).split(/[^a-z]+/).find((w) => w.length >= 8 && !fora.includes(w));
    if (palavra) { dono = c; break; }
  }
  assert.ok(palavra, "achou uma palavra só das regras");
  const pg = await abrir({ semBanco: true, snapshot, regras });
  await pg.waitForFunction((id) => document.querySelector(`.ticket[data-id="${id}"]`) || true, dono.id);
  await pg.fill("#q", palavra);
  await pg.waitForFunction((id) => !!document.querySelector(`#grid .ticket[data-id="${CSS.escape(id)}"]`), dono.id, { timeout: 4000 });
  await pg.click(`#grid .ticket[data-id="${dono.id}"] .det:not(.outros) summary`);
  await pg.waitForTimeout(100);
  const txt = await pg.$eval(`#grid .ticket[data-id="${dono.id}"] .det-body`, (e) => e.textContent);
  assert.ok(txt.includes("Regras do estabelecimento"), "o painel mostra as regras");
});

test("favoritar regrava só as marcas; ao reabrir com o banco lento, a marca vem delas", async () => {
  const pg = await abrir();
  await pg.waitForTimeout(1800);
  const bruta = () => pg.evaluate(() => localStorage.getItem("cupons-em-dobro:cache:v1"));
  const antes = await bruta();
  assert.ok(antes && JSON.parse(antes).h, "lista guardada com hash dos dados");
  const { id, fav } = await pg.evaluate(() => {
    const t = document.querySelector("#grid .ticket"); const b = t.querySelector(".heart");
    b.click(); return { id: t.dataset.id, fav: b.getAttribute("aria-pressed") === "true" };
  });
  await pg.waitForTimeout(1800);
  assert.equal(await bruta(), antes, "a lista inteira não foi regravada");
  const m = await pg.evaluate(() => JSON.parse(localStorage.getItem("cupons-em-dobro:marcas:v1")));
  assert.equal(!!m.marcas[id]?.f, fav, "a marca nova está nas marcas");
  // reabre com o banco demorando: a primeira tela é a lista guardada + marcas
  await pg.addInitScript("window.__atrasoBanco = 4000");
  await pg.reload();
  await pg.waitForSelector(".ticket", { timeout: 1500 });
  const agora = await pg.$eval(`.ticket[data-id="${id}"] .heart`, (b) => b.getAttribute("aria-pressed") === "true");
  assert.equal(agora, fav, "a marca aparece antes de o banco responder");
  assert.match(await pg.$eval("#result-count", (e) => e.textContent), /cupons/);
});
