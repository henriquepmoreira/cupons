// "Perto de mim": localização do navegador, bairro como ponto de partida, raio e preferência salva.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, aba, texto, textos, numero, espera, focado } = require("./lib/pagina");

after(fechar);
const PRACA_DA_MATRIZ = { latitude: -30.0333, longitude: -51.2303 };
const km = (s) => { const m = s.match(/([\d,]+)\s*(km|m)\b/); return m ? Number(m[1].replace(",", ".")) / (m[2] === "m" ? 1000 : 1) : Infinity; };

test("com a localização permitida, ordena do mais perto ao mais longe", async () => {
  const pg = await abrir({ localizacao: PRACA_DA_MATRIZ });
  await pg.selectOption("#sort", "perto");
  await pg.waitForTimeout(1500);
  assert.match(await texto(pg, "#result-count"), /do mais perto ao mais longe de você$/);
  const dist = (await textos(pg, "#grid .ticket .loc .dist [aria-hidden]")).map(km);
  assert.ok(dist.length >= 20);
  for (let i = 1; i < dist.length; i++) assert.ok(dist[i] >= dist[i - 1] - 0.05, `ordem: ${dist[i - 1]} antes de ${dist[i]}`);
  assert.ok(dist[0] < 1, "há cupom a menos de 1 km do Centro Histórico");
  assert.match(await texto(pg, "#grid .ticket .loc .dist .sr-only"), /^A (cerca de )?[\d,]+ (metros|quilômetros) de você/);
});

test("o raio filtra e os chips crescem com a distância", async () => {
  const pg = await abrir({ localizacao: PRACA_DA_MATRIZ });
  await pg.selectOption("#sort", "perto");
  await pg.waitForTimeout(1500);
  await aba(pg, "onde");
  const ns = (await textos(pg, "#f-raio button .n")).map(numero);
  assert.equal(ns.length, 4);
  for (let i = 1; i < ns.length; i++) assert.ok(ns[i] >= ns[i - 1]);
  await pg.click('#f-raio button[data-raio="1"]');
  await espera(pg);
  assert.equal(numero(await texto(pg, "#result-count")), ns[0]);
});

test("sem permissão de localização, abre Filtros e foca o seletor de bairro", async () => {
  const pg = await abrir();
  await pg.selectOption("#sort", "perto");
  await pg.waitForTimeout(800);
  assert.equal(await pg.$eval("#filters", (e) => e.hidden), false);
  assert.equal((await focado(pg)).id, "perto-bairro");
  assert.match(await texto(pg, "#toast-msg"), /Escolha um bairro em Filtros/);
});

test("bairro como ponto de partida fica salvo para a próxima visita", async () => {
  const pg = await abrir();
  await aba(pg, "onde");
  const valor = await pg.$$eval("#perto-bairro option", (os) => os.find((o) => o.textContent === "Moinhos de Vento").value);
  await pg.selectOption("#perto-bairro", valor);
  await espera(pg);
  assert.match(await texto(pg, "#result-count"), /mais longe de Moinhos de Vento \(Porto Alegre\)$/);
  await pg.reload();
  await pg.waitForSelector(".ticket");
  await pg.waitForTimeout(400);
  assert.match(await texto(pg, "#result-count"), /mais longe de Moinhos de Vento \(Porto Alegre\)$/);
});

test("sem geo.json, o grupo Perto de explica e fica desativado", async () => {
  const pg = await abrir({ geo: false });
  await aba(pg, "onde");
  assert.match(await texto(pg, "#perto-nota"), /não carregaram/);
  assert.equal(await pg.$eval("#perto-gps", (b) => b.disabled), true);
});

test('"Agora, perto": um toque liga Vale agora e ordena por distância; outro toque desliga', async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00", localizacao: PRACA_DA_MATRIZ });
  const total = numero(await texto(pg, "#result-count"));
  await pg.click("#agora-perto");
  await pg.waitForTimeout(1500);
  assert.equal(await pg.$eval("#agora-perto", (b) => b.getAttribute("aria-pressed")), "true");
  assert.equal(await pg.$eval("#agora-toggle", (b) => b.getAttribute("aria-pressed")), "true");
  assert.equal(await pg.$eval("#sort", (s) => s.value), "perto");
  assert.match(await texto(pg, "#result-count"), /do mais perto ao mais longe de você$/);
  assert.ok(numero(await texto(pg, "#result-count")) < total, "só os que valem agora");
  const dist = (await textos(pg, "#grid .ticket .loc .dist [aria-hidden]")).map(km);
  for (let i = 1; i < dist.length; i++) assert.ok(dist[i] >= dist[i - 1] - 0.05);
  assert.match(await texto(pg, '#ativos [data-remove="agora:"]'), /^Vale agora/);
  await pg.click("#agora-perto");
  await espera(pg);
  assert.equal(await pg.$eval("#agora-perto", (b) => b.getAttribute("aria-pressed")), "false");
  assert.equal(await pg.$eval("#agora-toggle", (b) => b.getAttribute("aria-pressed")), "false");
  assert.equal(await pg.$eval("#sort", (s) => s.value), "app");
  assert.equal(numero(await texto(pg, "#result-count")), total);
});

test('"Agora, perto" sem localização usa o bairro já escolhido; sem bairro, abre a aba Onde', async () => {
  let pg = await abrir({ data: "2026-11-17T12:30:00", prefs: { pertoBairro: "Porto Alegre|Moinhos de Vento" } });
  await pg.click("#agora-perto");
  await pg.waitForTimeout(800);
  assert.match(await texto(pg, "#toast-msg"), /Usando Moinhos de Vento \(Porto Alegre\)\.$/);
  assert.match(await texto(pg, "#result-count"), /mais longe de Moinhos de Vento \(Porto Alegre\)$/);
  assert.equal(await pg.$eval("#filters", (e) => e.hidden), true, "não abre o painel");
  await pg.context().close();
  pg = await abrir({ data: "2026-11-17T12:30:00" });
  await pg.click("#agora-perto");
  await pg.waitForTimeout(800);
  assert.equal(await pg.$eval("#filters", (e) => e.hidden), false);
  assert.equal(await pg.$eval("#aba-onde", (b) => b.getAttribute("aria-selected")), "true");
  assert.equal((await focado(pg)).id, "perto-bairro");
});

test("geo.json só é baixado quando algo usa distância ou bairro", async () => {
  const pg = await abrir();
  const pedidos = [];
  pg.on("request", (r) => { if (r.url().endsWith("/geo.json")) pedidos.push(r.url()); });
  await pg.reload();
  await pg.waitForSelector(".ticket");
  await pg.waitForTimeout(400);
  assert.equal(pedidos.length, 0, "abertura comum não baixa as coordenadas");
  await aba(pg, "onde");
  await pg.waitForTimeout(300);
  assert.equal(pedidos.length, 1);
  assert.ok(await pg.$$eval("#perto-bairro option", (o) => o.length) > 10);
});

// "Meus lugares": ponto de partida pessoal, lido da área privada do banco (coordenada de teste, não real)
const LUGARES = { lugares: [{ id: "casa", nome: "Casa", lat: -29.9177, lng: -51.1836 }] };

test('"Meus lugares" aparece primeiro no seletor, ordena a partir dele e fica salvo', async () => {
  let pg = await abrir({ data: "2026-11-17T12:30:00", lugares: LUGARES });
  await aba(pg, "onde");
  await pg.waitForTimeout(300);
  const grupos = await pg.$$eval("#perto-bairro optgroup", (gs) => gs.map((g) => g.label));
  assert.equal(grupos[0], "Meus lugares");
  assert.equal(await pg.$eval("#perto-bairro", (s) => s.getAttribute("aria-label")), "Perto de um dos seus lugares ou de um bairro");
  await pg.selectOption("#perto-bairro", "lugar:casa");
  await espera(pg, 200);
  assert.match(await texto(pg, "#result-count"), /do mais perto ao mais longe de Casa$/);
  const prefs = await pg.evaluate(() => JSON.parse(localStorage.getItem("cupons-em-dobro:prefs:v1")));
  assert.equal(prefs.pertoBairro, "lugar:casa");
  // a primeira distância é a de um cupom em Canoas, perto do ponto
  const d = await textos(pg, "#grid .ticket .loc .dist > span[aria-hidden]");
  assert.ok(km(d[0]) < 3, `primeira distância: ${d[0]}`);
  await pg.reload();
  await pg.waitForSelector(".ticket");
  await pg.waitForTimeout(800);
  assert.match(await texto(pg, "#result-count"), /mais longe de Casa$/, "volta com o lugar escolhido");
  assert.deepEqual(pg.erros, []);
});

test('"Agora, perto" sem localização e sem bairro usa o primeiro lugar salvo', async () => {
  const pg = await abrir({ data: "2026-11-17T12:30:00", lugares: LUGARES });
  await pg.click("#agora-perto");
  await pg.waitForTimeout(800);
  assert.match(await texto(pg, "#toast-msg"), /Usando Casa\.$/);
  assert.match(await texto(pg, "#result-count"), /mais longe de Casa$/);
  assert.equal(await pg.$eval("#filters", (e) => e.hidden), true, "não abre o painel");
});
