// Aviso de mesmo lugar em outro programa, sugestão de qual usar e "Ver juntos".
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, texto, textos, numero, espera, busca, focado, cartoes } = require("./lib/pagina");

after(fechar);
const SPOLETO = '.ticket[data-id="poa-em-dobro--spoleto"]';

test("o cartão resume os outros programas e compara as ofertas", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  await busca(pg, "spoleto");
  const resumo = await texto(pg, `${SPOLETO} .outros summary [aria-hidden]`);
  assert.match(resumo, /^Também em Tour Grande Poa \(\d+ disponíveis\) · Canoas em Dobro \(1 disponível\)/);
  assert.match(resumo, /ofertas diferentes/);
  // o painel só é montado ao abrir
  assert.equal(await pg.$$eval(`${SPOLETO} .outros li`, (x) => x.length), 0);
  await pg.click(`${SPOLETO} .outros summary`);
  await espera(pg);
  const itens = await textos(pg, `${SPOLETO} .outros li`);
  assert.ok(itens.length >= 2);
  assert.ok(itens.every((t) => /Mesma oferta:|Oferta diferente:/.test(t)));
  assert.ok(itens.some((t) => t.includes("(mesma unidade)")));
});

test("sugere usar primeiro o do plano que vence antes", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  await busca(pg, "trigo pizzaria");
  const doPoa = await texto(pg, '.ticket[data-id="poa-em-dobro--trigo-pizzaria"] .outros .sug');
  assert.match(doPoa, /^Use primeiro o do Tour Grande Poa: vence em 05\/03\/27, \d+ dias antes deste\./);
  const doTour = await texto(pg, '.ticket[data-id="tour-grande-poa--trigo-pizzaria"] .outros .sug');
  assert.match(doTour, /^Use este primeiro: o Tour Grande Poa vence em 05\/03\/27/);
});

test("Ver juntos mostra o grupo inteiro e Voltar devolve o foco", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  await busca(pg, "spoleto");
  await pg.click(`${SPOLETO} .outros summary`);
  await espera(pg);
  await pg.click(`${SPOLETO} [data-act=grupo]`);
  await espera(pg);
  assert.match(await texto(pg, "#result-count"), /cupons de Spoleto e do mesmo lugar nos outros programas/);
  assert.ok((await cartoes(pg)) >= 3);
  assert.equal((await focado(pg)).card, "poa-em-dobro--spoleto");
  await pg.click("#grupo-sair");
  await espera(pg);
  const f = await focado(pg);
  assert.equal(f.card, "poa-em-dobro--spoleto");
  assert.match(f.texto, /^Ver os \d+ juntos/);
});

test("ao marcar como usado, o aviso diz onde ainda tem", async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00" });
  await busca(pg, "spoleto");
  await pg.click(`${SPOLETO} [data-act=use]`);
  await espera(pg);
  assert.match(await texto(pg, "#toast-msg"), /^Spoleto: marcado como usado\. Ainda tem no Tour Grande Poa e no Canoas em Dobro\.$/);
  const escritas = await pg.evaluate(() => window.__escritas);
  assert.deepEqual(escritas.at(-1), { id: "poa-em-dobro--spoleto", patch: { usado: true, usadoEm: "2026-11-17" } });
});
