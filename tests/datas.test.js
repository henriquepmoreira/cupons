// Validade dos planos, feriados, datas comemorativas e o filtro "Data".
// Datas fixas: 20/11/2026 é feriado (Consciência Negra, sexta); o Tour vence em 05/03/2027.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, texto, textos, numero, espera } = require("./lib/pagina");

after(fechar);

const chipsData = async (pg) => {
  await pg.click("#filters-toggle");
  const r = await pg.$$eval("#f-data button", (bs) => bs.map((b) => ({
    data: b.dataset.data,
    visual: b.querySelector("[aria-hidden]")?.textContent || "",
    fala: b.querySelector(".sr-only")?.textContent || "",
    n: Number(b.querySelector(".n").textContent.match(/\d+/)[0]),
  })));
  await pg.click("#filters-toggle");
  return r;
};

test("topo mostra a validade de cada plano e avisa o feriado da semana", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  const planos = await texto(pg, "#planos");
  assert.match(planos, /Tour Grande Poa vale até 05\/03\/27 · faltam 108 dias/);
  assert.match(planos, /Poa em Dobro vale até 05\/04\/27/);
  assert.match(planos, /Canoas em Dobro vale até 08\/04\/27/);
  assert.match(planos, /Sexta \(20\/11\) é feriado \(Consciência Negra\): \d+ cupons disponíveis não valem nesse dia/);
  assert.deepEqual(pg.erros, []);
});

test("chip do feriado conta menos cupons que os dias normais", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  const chips = await chipsData(pg);
  assert.equal(chips.length, 7);
  assert.equal(chips[0].visual, "Hoje");
  assert.equal(chips[1].visual, "Amanhã");
  const sexta = chips.find((c) => c.data === "2026-11-20");
  assert.match(sexta.visual, /Sex 20\/11 · feriado/);
  assert.match(sexta.fala, /feriado: Consciência Negra/);
  assert.ok(sexta.n < chips[0].n && sexta.n < chips[2].n, "o feriado bloqueia cupons que não aceitam feriados");
});

test("no feriado, cartões que não aceitam feriados dizem por quê", async () => {
  const pg = await abrir({ data: "2026-11-20T12:30:00" });
  assert.match(await texto(pg, "#planos"), /Hoje é feriado \(Consciência Negra\)/);
  const tags = await textos(pg, ".tag.off [aria-hidden]");
  assert.ok(tags.some((t) => t === "Não vale hoje (feriado: Consciência Negra)"), "etiqueta com o motivo");
  const fala = await textos(pg, ".tag.off .sr-only");
  assert.ok(fala.some((t) => t === "Não vale hoje, feriado: Consciência Negra."), "versão falada");
});

test("escolher uma data filtra e mostra o horário daquele dia", async () => {
  const pg = await abrir({ data: "2026-11-19T20:00:00" });
  const total = numero(await texto(pg, "#result-count"));
  await pg.click("#filters-toggle");
  await pg.click('#f-data button[data-data="2026-11-20"]');
  await espera(pg);
  const filtrado = numero(await texto(pg, "#result-count"));
  assert.ok(filtrado < total);
  assert.equal(await pg.$eval("#filters-badge", (e) => e.hidden), false);
  const tags = await textos(pg, ".tag.hoje [aria-hidden]");
  assert.ok(tags.length > 0 && tags.every((t) => t.startsWith("Amanhã")), "etiquetas seguem a data escolhida");
  // "Vale agora" e Data se excluem
  await pg.click("#agora-toggle");
  await espera(pg);
  assert.equal(await pg.$$eval("#f-data [aria-pressed=true]", (x) => x.length), 0);
});

test("depois da validade, o plano aparece como vencido", async () => {
  const pg = await abrir({ data: "2027-03-06T12:00:00" });
  assert.match(await texto(pg, "#planos"), /Tour Grande Poa venceu em 05\/03\/27/);
  await pg.click('#programs [data-prog="tour-grande-poa"]');
  await espera(pg);
  const tags = await textos(pg, ".tag.off");
  assert.ok(tags.length > 0 && tags.every((t) => t === "Plano vencido em 05/03/27"));
  await pg.click("#filters-toggle");
  assert.equal(numero(await texto(pg, '#f-quando [data-quando="feriados"] .n')), 0, "vencido não conta em Aceita em feriados");
});

test('a preferência antiga "Vale hoje" vira a data de hoje', async () => {
  const pg = await abrir({ data: "2026-11-18T12:00:00", prefs: { quando: "hoje" } });
  await pg.click("#filters-toggle");
  assert.equal(await pg.$eval('#f-data button[data-data="2026-11-18"]', (b) => b.getAttribute("aria-pressed")), "true");
});
