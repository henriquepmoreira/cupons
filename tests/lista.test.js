// Lotes de 40 cartões, cartões reaproveitados e painéis montados ao abrir.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, texto, espera, busca, focado, cartoes } = require("./lib/pagina");

after(fechar);

test('mostra 40 cartões e "Mostrar mais" leva o foco ao primeiro novo', async () => {
  const pg = await abrir();
  assert.equal(await cartoes(pg), 40);
  assert.match(await texto(pg, "#mais-btn"), /^Mostrar mais 40 cupons \(40 de \d+\)$/);
  const quadragesimoPrimeiro = await pg.evaluate(() => document.querySelectorAll("#grid .ticket").length);
  await pg.click("#mais-btn");
  await espera(pg);
  assert.equal(await cartoes(pg), 80);
  const f = await focado(pg);
  assert.equal(f.card, await pg.$eval("#grid .ticket:nth-child(41)", (e) => e.dataset.id));
  assert.match(f.cls, /tname/);
  assert.equal(quadragesimoPrimeiro, 40);
});

test("usar, favoritar e atualizar o banco mantêm o lote; buscar volta ao primeiro", async () => {
  const pg = await abrir();
  await pg.click("#mais-btn");
  await espera(pg);
  await pg.click("#grid .ticket:nth-child(50) [data-act=use]");
  await espera(pg);
  assert.equal(await cartoes(pg), 80);
  await pg.click("#grid .ticket:nth-child(60) .heart");
  await pg.evaluate(() => window.__snap());
  await espera(pg);
  assert.equal(await cartoes(pg), 80);
  await busca(pg, "a");
  assert.equal(await cartoes(pg), 40);
  await busca(pg, "spoleto");
  assert.equal(await pg.$eval("#mais", (e) => e.hidden), true, "sem botão quando tudo cabe");
});

test("favoritar não recria a lista nem tira o foco do coração", async () => {
  const pg = await abrir();
  await pg.evaluate(() => { window.__primeiro = document.querySelector("#grid .ticket:nth-child(2)"); });
  await pg.focus("#grid .ticket:nth-child(5) .heart");
  await pg.keyboard.press("Enter");
  await espera(pg);
  assert.equal(await pg.evaluate(() => document.querySelector("#grid .ticket:nth-child(2)") === window.__primeiro), true, "cartão que não mudou é o mesmo elemento");
  const f = await focado(pg);
  assert.match(f.cls, /heart/);
  assert.equal(await pg.$eval("#grid .ticket:nth-child(5) .heart", (b) => b.getAttribute("aria-pressed")), await pg.evaluate(() => String(window.__docs.find((d) => d.id === document.querySelector("#grid .ticket:nth-child(5)").dataset.id).favorito)));
});

test("painel de detalhes é montado ao abrir, no mesmo cartão, e continua aberto", async () => {
  const pg = await abrir();
  const card = pg.locator("#grid .ticket").first();
  await card.evaluate((e) => { window.__card = e; });
  assert.equal(await card.evaluate((e) => e.querySelector(".det:not(.outros) .det-body").childElementCount), 0);
  await card.locator(".det:not(.outros) summary").click();
  await espera(pg);
  assert.ok(await card.evaluate((e) => e.querySelector(".det:not(.outros) .det-body").childElementCount) > 0);
  assert.equal(await pg.evaluate(() => document.querySelector("#grid .ticket") === window.__card), true);
  assert.match((await focado(pg)).texto, /^Regras, horários e endereço/);
  await pg.click("#fav-toggle");
  await pg.click("#fav-toggle");
  await espera(pg);
  assert.equal(await pg.$eval("#grid .ticket .det:not(.outros)", (d) => d.open && d.querySelector(".det-body").childElementCount > 0), true);
});

test("ordem por categoria agrupa e respeita o lote", async () => {
  const pg = await abrir();
  await pg.selectOption("#sort", "categoria");
  await espera(pg);
  assert.equal(await cartoes(pg), 40);
  assert.ok(await pg.$$eval(".group", (g) => g.length) >= 1);
  await pg.selectOption("#sort", "app");
  await espera(pg);
  assert.equal(await pg.$$eval(".group", (g) => g.length), 0);
  assert.equal(await pg.$$eval("#grid > .ticket", (t) => t.length), 40);
});

test("várias unidades com só um horário conhecido: a etiqueta diz qual unidade", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" }); // terça
  await busca(pg, "harmonia");
  const card = '.ticket[data-id="tour-grande-poa--mark-harmonia"]';
  assert.equal(await texto(pg, `${card} .tag.hoje [aria-hidden]`), "Hoje 18:00–23:00 (Praia de Belas)");
  assert.match(await texto(pg, `${card} .tag.hoje .sr-only`), /na unidade Praia de Belas\. Os horários das outras unidades não estão cadastrados\.$/);
  assert.match(await texto(pg, `${card} .loc`), /3 unidades/);
  await pg.click(`${card} .det:not(.outros) summary`);
  await espera(pg);
  const notas = await pg.$$eval(`${card} .det-body .fnote`, (xs) => xs.map((x) => x.textContent));
  assert.equal(notas.filter((t) => t === "Dias e horários desta unidade ainda não cadastrados.").length, 2);
});
