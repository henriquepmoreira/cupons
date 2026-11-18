// Comodidades (aviso "só Tour", atalhos Pet e Kids) e largura no celular.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, aba, fecharFiltros, texto, numero, espera } = require("./lib/pagina");

after(fechar);

test("Pet e Kids ficam nas comodidades de Filtros e se somam", async () => {
  const pg = await abrir();
  const total = numero(await texto(pg, "#result-count"));
  await aba(pg, "oque");
  await pg.click('#f-comod button[data-comod="Pet Friendly / Aceita Pet"]');
  await espera(pg);
  const pet = numero(await texto(pg, "#result-count"));
  assert.ok(pet > 0 && pet < total);
  await pg.click('#f-comod button[data-comod="Espaço Kids"]');
  await espera(pg);
  assert.ok(numero(await texto(pg, "#result-count")) < pet, "Pet e Kids juntos exigem os dois");
});

test('comodidade que só o Tour informa aparece como "só Tour"', async () => {
  const pg = await abrir();
  await aba(pg, "oque");
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
  await aba(pg, "oque");
  await pg.click('#f-comod button[data-comod="Consumo no local"]');
  await espera(pg);
  assert.equal(await pg.$$eval(card, (x) => x.length), 1, "a unidade principal é só para levar, mas as outras têm consumo no local");
  await fecharFiltros(pg);
  await pg.click(`${card} .det:not(.outros) summary`);
  await espera(pg);
  const blocos = await pg.$$eval(`${card} .det-body > div`, (ds) => ds.filter((d) => d.querySelector("h4")?.textContent.startsWith("Unidade")).map((d) => [...d.querySelectorAll(".tag")].map((t) => t.textContent)));
  assert.equal(blocos.length, 4);
  assert.deepEqual(blocos[0], ["Aceita Take Away", "Exclusivo Takeaway"]);
  assert.ok(blocos.slice(1).every((b) => b.length === 1 && b[0] === "Consumo no local"));
});

test("shopping: deduzido do endereço de cada unidade, aparece no cartão e na busca", async () => {
  const pg = await abrir();
  await aba(pg, "onde");
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

test("abas do painel: setas trocam de aba, cada aba mostra quantos filtros estão ativos", async () => {
  const pg = await abrir();
  await aba(pg, "quando");
  assert.equal(await pg.$eval("#painel-quando", (e) => e.hidden), false);
  assert.equal(await pg.$eval("#painel-onde", (e) => e.hidden), true);
  await pg.focus("#aba-quando");
  await pg.keyboard.press("ArrowRight");
  await espera(pg);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "aba-oque");
  assert.equal(await pg.$eval("#aba-oque", (b) => b.getAttribute("aria-selected")), "true");
  assert.equal(await pg.$eval("#painel-oque", (e) => e.hidden), false);
  await pg.keyboard.press("ArrowLeft");
  await pg.keyboard.press("ArrowLeft"); // volta ao fim
  await espera(pg);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "aba-onde");
  await pg.click('#f-shopping button[data-shopping="Iguatemi"]');
  await pg.click('#f-cidade button[data-cidade="Porto Alegre"]');
  await espera(pg);
  assert.equal(await pg.$eval("#aba-onde .badge", (b) => b.hidden), false);
  assert.match(await texto(pg, "#aba-onde .badge"), /2/);
  assert.equal(await pg.$eval("#aba-quando .badge", (b) => b.hidden), true);
});

test("linha de filtros ativos: mostra com o painel fechado, o × remove e o foco vai para o vizinho", async () => {
  const pg = await abrir({ prefs: { turnos: ["noite"], shoppings: ["Iguatemi"], comods: ["Espaço Kids"] } });
  assert.equal(await pg.$eval("#filters", (e) => e.hidden), true, "painel fechado");
  const chips = async () => pg.$$eval("#ativos .ativo", (bs) => bs.map((b) => b.dataset.remove));
  assert.deepEqual(await chips(), ["comod:Espaço Kids", "turno:noite", "shopping:Iguatemi"]);
  assert.match(await texto(pg, '#ativos [data-remove="turno:noite"]'), /^Noite×: remover filtro$/);
  const antes = numero(await texto(pg, "#result-count"));
  await pg.click('#ativos [data-remove="turno:noite"]');
  await espera(pg);
  assert.deepEqual(await chips(), ["comod:Espaço Kids", "shopping:Iguatemi"]);
  assert.equal((await pg.evaluate(() => document.activeElement.dataset.remove)), "shopping:Iguatemi");
  assert.ok(numero(await texto(pg, "#result-count")) >= antes);
  await pg.click('#ativos [data-remove="*"]');
  await espera(pg);
  assert.equal(await pg.$eval("#ativos", (e) => e.hidden), true);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "result-count");
});

test("barra fixa no celular: busca + quatro atalhos numa linha, sem rolar de lado", async () => {
  const pg = await abrir({ largura: 390 });
  const r = await pg.evaluate(() => {
    const barra = document.querySelector(".toolbar").getBoundingClientRect();
    const ctl = document.querySelector(".controls");
    const tops = [...ctl.children].map((e) => { const r = e.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 6); });
    return { altura: barra.height, linhas: new Set(tops).size, cabe: ctl.scrollWidth <= ctl.clientWidth + 1, ordem: [...ctl.children].map((e) => e.id) };
  });
  assert.ok(r.altura < 120, `${r.altura}px`);
  assert.equal(r.linhas, 1, "todos os botões na mesma linha");
  assert.ok(r.cabe, "a linha cabe na tela, sem rolar");
  assert.deepEqual(r.ordem, ["filters-toggle", "perto-toggle", "agora-toggle", "fav-toggle"]);
  assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "sem rolagem lateral da página");
  // rótulo curto na tela, nome completo para o leitor de tela
  assert.equal(await pg.$eval("#perto-toggle", (b) => b.getAttribute("aria-label")), "Perto de mim");
  assert.equal(await pg.$eval("#fav-toggle", (b) => b.getAttribute("aria-label")), "Favoritos");
});

test("Situação, Ordenar e Compacta ficam no topo do painel Filtros", async () => {
  const pg = await abrir({ largura: 390 });
  await pg.click("#filters-toggle");
  await espera(pg);
  for (const id of ["status", "sort", "compacto-toggle"]) assert.equal(await pg.$eval("#" + id, (e) => !!e.closest("#filters") && e.getBoundingClientRect().height > 0), true, id);
  await pg.click('#status button[data-status="usados"]');
  await espera(pg);
  assert.match(await texto(pg, "#result-count"), /usados/);
});

test("tocar num chip mantém o mesmo botão (foco e leitor de tela ficam nele)", async () => {
  const pg = await abrir();
  await aba(pg, "quando");
  await pg.evaluate(() => { window.__chip = document.querySelector('#f-turno button[data-turno="noite"]'); });
  await pg.focus('#f-turno button[data-turno="noite"]');
  await pg.keyboard.press("Enter");
  await espera(pg);
  assert.equal(await pg.evaluate(() => document.activeElement === window.__chip && document.contains(window.__chip)), true);
  assert.equal(await pg.evaluate(() => window.__chip.getAttribute("aria-pressed")), "true");
});

test("no celular, Filtros abre como diálogo: resto inerte, Esc fecha, Ver N cupons leva à lista", async () => {
  const pg = await abrir({ largura: 390 });
  await pg.click("#filters-toggle");
  await espera(pg);
  assert.equal(await pg.$eval("#filters", (f) => f.getAttribute("role") + "|" + f.getAttribute("aria-modal")), "dialog|true");
  assert.equal(await pg.evaluate(() => document.activeElement.id), "filters-titulo");
  assert.equal(await pg.evaluate(() => document.querySelector("main").inert && document.querySelector(".toolbar").inert), true);
  const cobre = await pg.$eval("#filters", (f) => { const r = f.getBoundingClientRect(); return r.top <= 0 && r.height >= innerHeight - 1; });
  assert.ok(cobre, "tela cheia");
  await pg.keyboard.press("Escape");
  await espera(pg);
  assert.equal(await pg.$eval("#filters", (f) => f.hidden), true);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "filters-toggle", "foco volta ao botão Filtros");
  assert.equal(await pg.evaluate(() => document.querySelector("main").inert), false);
  await aba(pg, "quando");
  await pg.click('#f-turno button[data-turno="noite"]');
  await espera(pg);
  const total = numero(await texto(pg, "#result-count"));
  assert.equal(await texto(pg, "#filters-ver"), `Ver ${total} cupons`);
  await pg.click("#filters-ver");
  await espera(pg);
  assert.equal(await pg.$eval("#filters", (f) => f.hidden), true);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "result-count");
});

test("no computador, Filtros continua no meio da página (sem diálogo)", async () => {
  const pg = await abrir({ largura: 1100 });
  await pg.click("#filters-toggle");
  await espera(pg);
  assert.equal(await pg.$eval("#filters", (f) => f.hasAttribute("role")), false);
  assert.equal(await pg.evaluate(() => document.querySelector("main").inert), false);
});
