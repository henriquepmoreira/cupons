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
  assert.match(await texto(pg, "#notice"), /^Lista guardada neste aparelho \(17\/11\/26 \d\d:\d\d\)\. Atualizando…$/);
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
  assert.match(await texto(pg, "#notice"), /^Cópia da carteira de 17\/11\/26, só para consulta/);
  assert.equal(await pg.$$eval("#grid .ticket .heart:not([disabled])", (b) => b.length), 0, "sem favoritar");
});

test("lista guardada estragada é ignorada", async () => {
  const pg = await abrir({ cache: { em: 1, cupons: "x" } });
  assert.ok((await pg.$$eval("#grid .ticket", (t) => t.length)) > 0);
  assert.deepEqual(pg.erros, []);
});
