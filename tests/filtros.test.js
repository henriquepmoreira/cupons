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

test("comodidades por unidade: o filtro vale se alguma unidade tem, e os detalhes mostram cada uma", async () => {
  const pg = await abrir();
  await pg.fill("#q", "coccaderia");
  await pg.waitForTimeout(200);
  const card = '.ticket[data-id="tour-grande-poa--coccaderia"]';
  await pg.click("#filters-toggle");
  await pg.click('#f-comod button[data-comod="Consumo no local"]');
  await espera(pg);
  assert.equal(await pg.$$eval(card, (x) => x.length), 1, "a unidade principal é só para levar, mas as outras têm consumo no local");
  await pg.click("#filters-toggle");
  await pg.click(`${card} .det:not(.outros) summary`);
  await espera(pg);
  const blocos = await pg.$$eval(`${card} .det-body > div`, (ds) => ds.filter((d) => d.querySelector("h4")?.textContent.startsWith("Unidade")).map((d) => [...d.querySelectorAll(".tag")].map((t) => t.textContent)));
  assert.equal(blocos.length, 4);
  assert.deepEqual(blocos[0], ["Aceita Take Away", "Exclusivo Takeaway"]);
  assert.ok(blocos.slice(1).every((b) => b.length === 1 && b[0] === "Consumo no local"));
});

test("shopping: deduzido do endereço de cada unidade, aparece no cartão e na busca", async () => {
  const pg = await abrir();
  await pg.click("#filters-toggle");
  const chips = await pg.$$eval("#f-shopping button", (bs) => bs.map((b) => b.dataset.shopping));
  for (const s of ["BarraShoppingSul", "Iguatemi", "ParkShopping Canoas", "Cais Embarcadero", "Mercado Público"]) assert.ok(chips.includes(s), s);
  await pg.click('#f-shopping button[data-shopping="Iguatemi"]');
  await espera(pg);
  const nomes = await pg.$$eval("#grid .ticket .tname", (xs) => xs.map((x) => x.childNodes[0].textContent));
  assert.ok(nomes.includes("Spoleto Iguatemi Porto Alegre"));
  // o Spoleto do Poa tem unidade no Iguatemi entre várias: entra pelo endereço da unidade
  assert.ok(nomes.length >= 5 && nomes.length < 20);
  assert.match(await texto(pg, '.ticket[data-id="tour-grande-poa--spoleto-iguatemi"] .loc'), /Iguatemi/);
  await pg.click("#filters-clear");
  await pg.fill("#q", "embarcadero");
  await pg.waitForTimeout(200);
  assert.ok(numero(await texto(pg, "#result-count")) >= 5, "busca pelo nome do shopping");
});

test("turno: noite tem mais cupons que madrugada, e respeita a data escolhida", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  await pg.click("#filters-toggle");
  const n = async () => Object.fromEntries(await pg.$$eval("#f-turno button", (bs) => bs.map((b) => [b.dataset.turno, Number(b.querySelector(".n").textContent.match(/\d+/)[0])])));
  const semData = await n();
  assert.deepEqual(Object.keys(semData), ["manha", "almoco", "tarde", "noite", "madrugada"]);
  assert.ok(semData.noite > semData.madrugada && semData.almoco > semData.madrugada);
  await pg.click('#f-data button[data-data="2026-11-20"]'); // feriado
  await espera(pg);
  const feriado = await n();
  assert.ok(feriado.almoco < semData.almoco, "na data de feriado, menos cupons valem no almoço");
  await pg.click('#f-turno button[data-turno="almoco"]');
  await espera(pg);
  assert.equal(numero(await texto(pg, "#result-count")), feriado.almoco);
  assert.match(await texto(pg, '#f-turno button[data-turno="almoco"] .sr-only'), /^Almoço, das 11 às 15 horas$/);
});

test("aceita em datas comemorativas, e os dois juntos exigem os dois", async () => {
  const pg = await abrir();
  await pg.click("#filters-toggle");
  const nF = numero(await texto(pg, '#f-quando [data-aceita="feriados"] .n'));
  const nD = numero(await texto(pg, '#f-quando [data-aceita="datas"] .n'));
  assert.ok(nF > 0 && nD > 0);
  await pg.click('#f-quando [data-aceita="feriados"]');
  await pg.click('#f-quando [data-aceita="datas"]');
  await espera(pg);
  const ambos = numero(await texto(pg, "#result-count"));
  assert.ok(ambos <= Math.min(nF, nD) && ambos > 0);
});

test('preferência antiga "Aceita em feriados" continua marcada', async () => {
  const pg = await abrir({ prefs: { quando: "feriados" } });
  await pg.click("#filters-toggle");
  assert.equal(await pg.$eval('#f-quando [data-aceita="feriados"]', (b) => b.getAttribute("aria-pressed")), "true");
});
