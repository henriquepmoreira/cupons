// Comodidades (aviso "só Tour", atalhos Pet e Kids) e largura no celular.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, texto, numero, espera } = require("./lib/pagina");

after(fechar);

test("atalhos Pet e Kids ligam os mesmos chips das comodidades", async () => {
  const pg = await abrir();
  const total = numero(await texto(pg, "#result-count"));
  await pg.click("#pet-toggle");
  await espera(pg);
  const pet = numero(await texto(pg, "#result-count"));
  assert.ok(pet > 0 && pet < total);
  assert.equal(await pg.$eval("#pet-toggle", (b) => b.getAttribute("aria-pressed")), "true");
  await pg.click("#kids-toggle");
  await espera(pg);
  assert.ok(numero(await texto(pg, "#result-count")) < pet, "Pet e Kids juntos exigem os dois");
  await pg.click("#filters-toggle");
  await pg.click('#f-comod button[data-comod="Espaço Kids"]');
  await espera(pg);
  assert.equal(await pg.$eval("#kids-toggle", (b) => b.getAttribute("aria-pressed")), "false", "desmarcar o chip desliga o atalho");
});

test('comodidade que só o Tour informa aparece como "só Tour"', async () => {
  const pg = await abrir();
  await pg.click("#filters-toggle");
  const vegano = await texto(pg, '#f-comod button[data-comod="Opções veganas"]');
  assert.match(vegano, /· só Tour/);
  assert.match(await texto(pg, '#f-comod button[data-comod="Opções veganas"] .sr-only'), /só no Tour Grande Poa/);
  const pet = await texto(pg, '#f-comod button[data-comod="Pet Friendly / Aceita Pet"]');
  assert.doesNotMatch(pet, /só /, "Pet aparece nos três programas");
});

test("sem rolagem lateral no celular, com e sem Filtros aberto", async () => {
  const pg = await abrir({ largura: 360 });
  const lateral = () => pg.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(await lateral(), false);
  await pg.click("#filters-toggle");
  await espera(pg);
  assert.equal(await lateral(), false);
});
