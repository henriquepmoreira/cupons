// Lotes de 40 cartões, cartões reaproveitados e painéis montados ao abrir.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar, aba, fecharFiltros, texto, textos, numero, espera, busca, focado, cartoes, ordenar, compacta } = require("./lib/pagina");

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
  await ordenar(pg, "categoria");
  await espera(pg);
  assert.equal(await cartoes(pg), 40);
  assert.ok(await pg.$$eval(".group", (g) => g.length) >= 1);
  await ordenar(pg, "app");
  await espera(pg);
  assert.equal(await pg.$$eval(".group", (g) => g.length), 0);
  assert.equal(await pg.$$eval("#grid > .ticket", (t) => t.length), 40);
});

test("várias unidades com horário: a etiqueta conta em quantas vale (Mark, horários reais de 17/11)", async () => {
  const card = '.ticket[data-id="tour-grande-poa--mark-harmonia"]';
  let pg = await abrir({ data: "2026-11-17T12:30:00" }); // terça: as três unidades valem
  await busca(pg, "harmonia");
  assert.equal(await texto(pg, `${card} .tag.hoje [aria-hidden]`), "Hoje em 3 de 3 unidades");
  await pg.context().close();
  pg = await abrir({ data: "2026-11-18T12:30:00" }); // quarta: a unidade Auxiliadora não vale
  await busca(pg, "harmonia");
  assert.equal(await texto(pg, `${card} .tag.hoje [aria-hidden]`), "Hoje em 2 de 3 unidades");
  await pg.click(`${card} .det:not(.outros) summary`);
  await espera(pg);
  assert.equal(await pg.$$eval(`${card} .det-body table.hor`, (t) => t.length), 3, "uma tabela por unidade");
});

test("várias unidades com só um horário conhecido: a etiqueta diz qual unidade", async () => {
  // simula o Mark antes dos prints com os horários das outras unidades
  const pg = await abrir({
    data: "2026-11-17T12:30:00", // terça
    ajustar: (docs) => { for (const u of docs.find((d) => d.slug === "mark-harmonia").outrasUnidades) u.horarios = null; },
  });
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

test("lista compacta: uma linha por cupom, expandir mostra o cartão completo, e fica lembrada", async () => {
  const pg = await abrir({ largura: 390 });
  const alturaNormal = await pg.$eval("#grid .ticket", (t) => t.getBoundingClientRect().height);
  await compacta(pg);
  await espera(pg);
  assert.equal(await pg.$eval("#compacto-toggle", (b) => b.getAttribute("aria-pressed")), "true");
  const card = pg.locator("#grid .ticket").first();
  const alturaCompacta = await card.evaluate((t) => t.getBoundingClientRect().height);
  assert.ok(alturaCompacta < alturaNormal * 0.6, `${Math.round(alturaCompacta)} px x ${Math.round(alturaNormal)} px`);
  assert.equal(await card.evaluate((t) => getComputedStyle(t.querySelector(".tfoot")).display), "none");
  // quantos cupons cabem numa tela, rolando até o começo da lista
  await pg.evaluate(() => document.querySelector("#grid .ticket").scrollIntoView({ block: "start" }));
  await pg.waitForTimeout(100);
  const porTela = await pg.evaluate(() => [...document.querySelectorAll("#grid .ticket")].filter((t) => { const r = t.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }).length);
  assert.ok(porTela >= 5, `${porTela} cupons inteiros numa tela`);
  // o mesmo cartão (sem recriar) só troca de classe
  await card.evaluate((t) => { window.__c = t; });
  await card.locator('[data-act="expandir"]').click();
  await espera(pg);
  assert.equal(await card.evaluate((t) => t.classList.contains("expandido")), true);
  assert.equal(await card.evaluate((t) => getComputedStyle(t.querySelector(".tfoot")).display !== "none"), true, "Marcar como usado aparece");
  assert.equal(await pg.evaluate(() => document.activeElement.dataset.act), "expandir");
  assert.equal(await card.locator('[data-act="expandir"]').getAttribute("aria-expanded"), "true");
  await pg.reload();
  await pg.waitForSelector(".ticket");
  await pg.waitForTimeout(300);
  assert.equal(await pg.$eval("#grid", (g) => g.classList.contains("compacto")), true, "lembrada depois de recarregar");
});

test("lista compacta é o padrão, também para quem tinha a escolha antiga gravada; a completa fica lembrada", async () => {
  for (const prefs of [undefined, { compacto: false, sort: "app" }]) {
    const pg = await abrir({ compacta: true, prefs });
    assert.equal(await pg.$eval("#grid", (g) => g.classList.contains("compacto")), true, `compacta com ${JSON.stringify(prefs)}`);
    await pg.context().close();
  }
  const pg = await abrir({ compacta: true });
  await compacta(pg); // desliga
  assert.equal(await pg.$eval("#grid", (g) => g.classList.contains("compacto")), false);
  await pg.reload(); await pg.waitForSelector(".ticket"); await pg.waitForTimeout(300);
  assert.equal(await pg.$eval("#grid", (g) => g.classList.contains("compacto")), false, "completa lembrada depois de recarregar");
});

test("nada encontrado: sugere qual filtro tirar e aplica com um toque", async () => {
  const pg = await abrir();
  await aba(pg, "onde");
  await pg.click('#f-shopping button[data-shopping="Iguatemi"]');
  await aba(pg, "quando");
  await pg.click('#f-turno button[data-turno="madrugada"]');
  await fecharFiltros(pg);
  await pg.fill("#q", "pizza");
  await pg.waitForTimeout(250);
  assert.equal(await pg.$$eval("#grid .ticket", (t) => t.length), 0);
  const sug = await pg.$$eval("#grid .sugestoes button", (bs) => bs.map((b) => [b.dataset.remove, b.textContent.replace(/\s+/g, " ").trim()]));
  assert.ok(sug.length >= 1);
  assert.ok(sug.every(([, t]) => /^Sem .+ \d+ cupo(m|ns)$/.test(t)), JSON.stringify(sug));
  const [chave, texto0] = sug[0];
  const n = Number(texto0.match(/(\d+) cupo/)[1]);
  await pg.click(`#grid .sugestoes button[data-remove="${chave}"]`);
  await espera(pg);
  assert.equal(numero(await texto(pg, "#result-count")), n);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "result-count");
});

test("recarregar a aba volta ao mesmo ponto da lista (mesmos filtros)", async () => {
  const pg = await abrir({ largura: 390 });
  await pg.click("#mais-btn");
  await espera(pg);
  await pg.evaluate(() => scrollTo(0, 6000));
  await pg.waitForTimeout(500);
  const y = await pg.evaluate(() => scrollY);
  await pg.reload();
  await pg.waitForSelector(".ticket");
  await pg.waitForTimeout(500);
  assert.equal(await cartoes(pg), 80, "o lote carregado volta");
  assert.ok(Math.abs((await pg.evaluate(() => scrollY)) - y) < 60, "a rolagem volta");
});

test("etiqueta de hoje diz o momento: a partir de, agora até, encerrado (Grazie Mille, quarta 18:00–23:00)", async () => {
  const card = '.ticket[data-id="poa-em-dobro--grazie-mille-pizzaria"]';
  const pg = await abrir({ data: "2026-11-18T12:30:00" });
  await busca(pg, "grazie mille");
  assert.equal(await texto(pg, `${card} .tag.hoje [aria-hidden]`), "Hoje a partir das 18:00");
  assert.equal(await texto(pg, `${card} .tag.hoje .sr-only`), "Vale hoje a partir das 18:00, até as 23:00.");
  // ao voltar para a aba, a etiqueta acompanha a hora
  const volta = async (hora) => {
    await pg.clock.setFixedTime(new Date(`2026-11-18T${hora}:00`));
    await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await espera(pg);
  };
  // a 2 horas ou menos, "abre em breve" com quanto falta
  await volta("16:45");
  assert.equal(await texto(pg, `${card} .tag.breve [aria-hidden]`), "Abre às 18:00 · em 1 h 15");
  assert.equal(await texto(pg, `${card} .tag.breve .sr-only`), "Começa a valer hoje às 18:00, daqui a 1 hora e 15 minutos, até as 23:00.");
  await volta("17:20");
  assert.equal(await texto(pg, `${card} .tag.breve [aria-hidden]`), "Abre às 18:00 · em 40 min");
  await volta("20:00");
  assert.equal(await texto(pg, `${card} .tag.hoje [aria-hidden]`), "Agora · até 23:00");
  assert.equal(await texto(pg, `${card} .tag.hoje .sr-only`), "Vale agora, até as 23:00.");
  await volta("23:00");
  assert.equal(await texto(pg, `${card} .tag.hoje [aria-hidden]`), "Agora · até 23:00", "o minuto final ainda vale, como no filtro Vale agora");
  await volta("23:30");
  assert.equal(await texto(pg, `${card} .tag.off [aria-hidden]`), "Encerrado hoje");
  assert.match(await texto(pg, `${card} .tag.off .sr-only`), /^Hoje já encerrou\. Valia /);
});

test('com "Vale agora", toda etiqueta de uma unidade diz "Agora · até"', async () => {
  for (const hora of ["12:30", "16:00", "23:50", "00:30"]) {
    const pg = await abrir({ data: `2026-11-${hora < "06" ? 19 : 18}T${hora}:00` });
    await pg.click("#agora-toggle");
    await espera(pg);
    const tags = await textos(pg, "#grid .tag.hoje [aria-hidden], #grid .tag.off [aria-hidden]");
    const umaUnidade = tags.filter((t) => !/unidades/.test(t));
    assert.ok(umaUnidade.length > 0, hora);
    assert.deepEqual(umaUnidade.filter((t) => !/^Agora · até \d\d:\d\d$/.test(t)), [], hora);
    await pg.context().close();
  }
});

test('ordenação "Padrão (como no app)" e busca com um × só', async () => {
  const pg = await abrir();
  assert.equal(await pg.$eval('#sort option[value="app"]', (o) => o.textContent), "Padrão (como no app)");
  // o Chrome não informa o estilo desse pseudo-elemento; confere a regra que esconde o × do navegador
  assert.ok(await pg.evaluate(() => [...document.styleSheets].some((ss) => { try { return [...ss.cssRules].some((r) => /::-webkit-search-cancel-button/.test(r.selectorText || "") && r.style.display === "none"); } catch (_) { return false; } })));
  await busca(pg, "pizza");
  assert.equal(await pg.$eval("#q-clear", (b) => b.hidden), false, "o × da página aparece");
});

test("atualização do banco não refaz o agrupamento mesmo lugar; mudar um nome refaz", async () => {
  const pg = await abrir();
  await busca(pg, "spoleto");
  const aviso = () => pg.$$eval("#grid .ticket .outros", (x) => x.length);
  const n = await aviso();
  assert.ok(n > 0);
  await pg.evaluate(() => { window.__docs.find((d) => /spoleto/i.test(d.nome) && d.programa === "tour-grande-poa").nome = "Outro Lugar"; window.__snap(); });
  await espera(pg, 150);
  assert.ok((await aviso()) < n, "o nome novo saiu do grupo");
});

test("topo compacto no celular: título numa linha e a busca perto do topo", async () => {
  for (const largura of [320, 390, 412]) {
    const pg = await abrir({ largura });
    const m = await pg.evaluate(() => ({
      busca: document.querySelector(".toolbar").getBoundingClientRect().top,
      h1: document.querySelector("h1").getBoundingClientRect().height,
      lado: document.documentElement.scrollWidth - innerWidth,
    }));
    assert.ok(m.busca < (largura === 320 ? 240 : 200), `${largura}px: busca a ${Math.round(m.busca)} px do topo (antes 343)`);
    assert.ok(m.h1 < 40, `${largura}px: título numa linha (${Math.round(m.h1)} px)`);
    assert.equal(m.lado, 0, `${largura}px: sem rolagem lateral`);
    await pg.context().close();
  }
});

test("os quatro atalhos da barra cabem inteiros no celular, de 320 a 412 px", async () => {
  for (const largura of [320, 360, 390, 412]) {
    const pg = await abrir({ largura });
    const m = await pg.evaluate(() => {
      const c = document.querySelector(".controls");
      return { sobra: c.scrollWidth - c.clientWidth, fav: document.getElementById("fav-toggle").getBoundingClientRect().right, largura: innerWidth };
    });
    assert.equal(m.sobra, 0, `${largura}px: a linha de atalhos rola de lado (${m.sobra} px a mais)`);
    assert.ok(m.fav <= m.largura - 16, `${largura}px: o coração fica cortado (termina em ${Math.round(m.fav)} px)`);
    await pg.context().close();
  }
});

test("celular: a barra fixa some ao rolar para baixo e volta ao rolar para cima ou com o foco na busca", async () => {
  const pg = await abrir();
  const recolhida = () => pg.$eval(".toolbar", (b) => b.classList.contains("recolhida"));
  const rola = async (y) => { await pg.evaluate((y) => scrollTo(0, y), y); await espera(pg, 60); };
  await rola(200);
  assert.equal(await recolhida(), false, "no começo da página ela fica");
  await rola(900); await rola(1500);
  assert.equal(await recolhida(), true, "rolando para baixo ela some");
  assert.equal(await pg.$eval(".toolbar", (b) => getComputedStyle(b).visibility), "visible", "continua na árvore de acessibilidade");
  await rola(1400);
  assert.equal(await recolhida(), false, "rolando para cima ela volta");
  await rola(2200);
  assert.equal(await recolhida(), true);
  await pg.focus("#q");
  assert.equal(await recolhida(), false, "o foco na busca traz a barra de volta");
  await rola(3000);
  assert.equal(await recolhida(), false, "com o foco dentro dela, não some");
  await pg.context().close();
});

test("computador: a barra fixa nunca some", async () => {
  const pg = await abrir({ largura: 1200 });
  for (const y of [900, 1800, 2700]) { await pg.evaluate((y) => scrollTo(0, y), y); await espera(pg, 60); }
  assert.equal(await pg.$eval(".toolbar", (b) => b.classList.contains("recolhida")), false);
  await pg.context().close();
});

test("lista nova: os primeiros cartões aparecem na hora e o resto do lote logo depois, na ordem certa", async () => {
  const pg = await abrir();
  await pg.click("#filters-toggle");
  const imediato = await pg.evaluate(() => {
    const s = document.getElementById("sort");
    s.value = "az"; s.dispatchEvent(new Event("change", { bubbles: true }));
    return document.querySelectorAll("#grid .ticket").length;
  });
  assert.ok(imediato < 40, `primeira etapa com ${imediato} cartões (antes eram os 40 de uma vez)`);
  await espera(pg, 150);
  const nomes = await textos(pg, "#grid .ticket .tname");
  assert.equal(nomes.length, 40, "o lote inteiro entra logo depois");
  const ordenados = [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true }));
  assert.deepEqual(nomes, ordenados, "na ordem certa");
});

test("ordem por categoria também em duas etapas: contagem final já na primeira, lote inteiro logo depois", async () => {
  const pg = await abrir();
  await pg.click("#filters-toggle");
  const imediato = await pg.evaluate(() => {
    const s = document.getElementById("sort");
    s.value = "categoria"; s.dispatchEvent(new Event("change", { bubbles: true }));
    return { n: document.querySelectorAll("#grid .ticket").length,
      contagens: [...document.querySelectorAll("#grid .group-title > span")].map((e) => e.textContent) };
  });
  assert.ok(imediato.n < 40, `primeira etapa com ${imediato.n} cartões`);
  await espera(pg, 150);
  const depois = await pg.evaluate(() => ({ n: document.querySelectorAll("#grid .ticket").length,
    grupos: [...document.querySelectorAll("#grid section.group")].map((g) => [g.querySelector(".group-title > span").textContent, g.querySelectorAll(".ticket").length]) }));
  assert.equal(depois.n, 40);
  for (const [txt, n] of depois.grupos) assert.equal(parseInt(txt), n, `grupo diz ${txt} e tem ${n}`);
  for (const t of imediato.contagens) assert.ok(depois.grupos.some(([txt]) => txt === t), `contagem ${t} da primeira etapa é a final`);
});

test("lista nova: um redesenho no meio (banco, favorito) monta a lista inteira na hora", async () => {
  const pg = await abrir();
  await pg.click("#filters-toggle");
  const n = await pg.evaluate(() => {
    const s = document.getElementById("sort");
    s.value = "az"; s.dispatchEvent(new Event("change", { bubbles: true }));
    window.__snap();
    return document.querySelectorAll("#grid .ticket").length;
  });
  assert.equal(n, 40);
  await espera(pg, 150);
  assert.equal(await cartoes(pg), 40, "o resto atrasado não duplica nem tira cartões");
});

test('"Voltar ao topo" aparece depois de duas telas, some com aviso na tela e leva o foco ao título', async () => {
  const pg = await abrir();
  const visivel = () => pg.$eval("#topo", (b) => !b.hidden && getComputedStyle(b).display !== "none");
  assert.equal(await visivel(), false, "no começo da página não aparece");
  await pg.click("#mais-btn"); await espera(pg, 100);
  await pg.evaluate(() => scrollTo(0, innerHeight * 3)); await espera(pg, 100);
  assert.equal(await visivel(), true, "depois de duas telas aparece");
  await pg.$eval("#toast", (t) => { t.hidden = false; });
  assert.equal(await visivel(), false, "some enquanto há aviso no mesmo canto");
  await pg.$eval("#toast", (t) => { t.hidden = true; });
  await pg.click("#topo");
  await pg.waitForFunction(() => scrollY === 0, null, { timeout: 3000 });
  assert.equal(await pg.evaluate(() => document.activeElement.tagName), "H1", "foco no título");
  await espera(pg, 100);
  assert.equal(await visivel(), false, "no topo, o botão some");
});

test("320 px: números do topo numa linha e texto de exemplo da busca curto; em 360 px, o longo", async () => {
  for (const [largura, exemplo] of [[320, "Lugar, prato ou bairro"], [360, "Busque lugar, prato ou bairro"], [390, "Busque lugar, prato ou bairro"]]) {
    const pg = await abrir({ largura });
    const m = await pg.evaluate(() => ({
      linhas: new Set([...document.querySelectorAll(".stats .stat")].map((e) => Math.round(e.getBoundingClientRect().top))).size,
      exemplo: document.getElementById("q").placeholder,
      lado: document.documentElement.scrollWidth - innerWidth,
    }));
    assert.equal(m.linhas, 1, `${largura}px: números em ${m.linhas} linhas`);
    assert.equal(m.exemplo, exemplo);
    assert.equal(m.lado, 0);
    await pg.context().close();
  }
});

// bloco "Valendo agora" (topo da lista)
const LUGARES_AGORA = { lugares: [{ id: "casa", nome: "Casa", lat: -30.0256, lng: -51.2085 }] };

test('"Valendo agora" mostra até 5 cupons que valem neste minuto e abre o escolhido', async () => {
  const { abrir: abrir2, texto: texto2 } = require("./lib/pagina");
  const pg = await abrir2({ data: "2026-11-18T12:30:00" });
  assert.equal(await pg.$eval("#agora", (e) => e.hidden), false);
  const itens = await pg.$$eval("#agora ol:not([aria-label]) .agora-item", (b) => b.length);
  assert.ok(itens > 0 && itens <= 5, `itens: ${itens}`);
  assert.match(await texto2(pg, "#agora-h"), /valendo agora/i);
  const id = await pg.$eval("#agora .agora-item", (b) => b.dataset.agora);
  await pg.click("#agora .agora-item");
  await pg.waitForTimeout(200);
  assert.equal(await pg.$$eval("#grid .ticket", (t) => t.length) >= 1, true);
  assert.equal(await pg.$eval("#grid .ticket", (t) => t.dataset.id), id);
  assert.equal(await pg.$eval("#grupo-sair", (b) => b.hidden), false, "tem Voltar à lista");
  assert.equal(await pg.$eval("#agora", (e) => e.hidden), true, "o bloco some enquanto mostra um cupom");
  await pg.click("#grupo-sair");
  await pg.waitForTimeout(200);
  assert.equal(await pg.$eval("#agora", (e) => e.hidden), false);
  assert.deepEqual(pg.erros, []);
});

test('"Valendo agora" com ponto de partida lista do mais perto ao mais longe; some com busca', async () => {
  const { abrir: abrir2, texto: texto2, busca: busca2 } = require("./lib/pagina");
  const pg = await abrir2({ data: "2026-11-18T12:30:00", lugares: LUGARES_AGORA, prefs: { pertoBairro: "lugar:casa" } });
  await pg.waitForTimeout(800);
  assert.match(await texto2(pg, "#agora-h"), /perto de Casa/);
  const km = await pg.$$eval("#agora .agora-item .km > span[aria-hidden]", (s) => s.map((x) => x.textContent));
  const n = km.map((s) => { const m = s.match(/([\d,]+)\s*(km|m)/); return Number(m[1].replace(",", ".")) / (m[2] === "m" ? 1000 : 1); });
  assert.deepEqual(n, [...n].sort((a, b) => a - b), `em ordem: ${km}`);
  await busca2(pg, "pizza");
  assert.equal(await pg.$eval("#agora", (e) => e.hidden), true);
});

test('"Valendo agora" fica escondido de madrugada, quando nada vale nem abre na próxima hora', async () => {
  const { abrir: abrir2 } = require("./lib/pagina");
  const pg = await abrir2({ data: "2026-11-18T04:30:00" });
  assert.equal(await pg.$eval("#agora", (e) => e.hidden), true);
});

test('"Daqui a pouco": o que abre na próxima hora, com o horário e quanto falta; sozinho quando nada vale ainda', async () => {
  const { abrir: abrir2 } = require("./lib/pagina");
  // 05:10: nada vale, mas há cupons que abrem às 06:00
  let pg = await abrir2({ data: "2026-11-18T05:10:00" });
  assert.equal(await pg.$eval("#agora", (e) => e.hidden), false);
  assert.match(await texto(pg, "#agora-h"), /^Daqui a pouco \d+ cupons? na próxima hora$/);
  assert.match(await texto(pg, "#agora .agora-item .abre [aria-hidden]"), /^abre às 06:00 · em 50 min$/);
  assert.equal(await pg.$("#agora [data-agora-act=todos]"), null, "sem 'Ver todos que valem agora' quando nada vale");
  await pg.context().close();
  // 17:35: os que valem agora e, abaixo, os que abrem até 18:35
  pg = await abrir2({ data: "2026-11-18T17:35:00" });
  assert.match(await texto(pg, "#agora-h"), /valendo agora/i);
  assert.match(await texto(pg, "#agora-breve-h"), /^Daqui a pouco/);
  const quando = await textos(pg, "#agora ol[aria-label='Daqui a pouco'] .abre [aria-hidden]");
  assert.ok(quando.length >= 1 && quando.length <= 3);
  for (const q of quando) { const m = q.match(/em (\d+) min/); assert.ok(m && Number(m[1]) <= 60, q); }
  // tocar abre só aquele cupom, como nos que valem agora
  const id = await pg.$eval("#agora ol[aria-label='Daqui a pouco'] .agora-item", (b) => b.dataset.agora);
  await pg.click("#agora ol[aria-label='Daqui a pouco'] .agora-item");
  await espera(pg, 150);
  assert.ok(await pg.$(`#grid .ticket[data-id="${id}"]`));
});

test("site: com página nova, recarrega sozinho quando a aba vai para segundo plano (e volta ao mesmo ponto)", async () => {
  const pg = await abrir({ site: true });
  await pg.evaluate(() => { window.__marca = 1; scrollTo(0, 600); });
  await espera(pg, 400);
  // o service worker avisa que guardou uma página nova
  await pg.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { tipo: "pagina" } })));
  await espera(pg, 100);
  assert.equal(await pg.evaluate(() => window.__marca), 1, "com a aba visível, nada acontece");
  assert.equal(await pg.$eval("#toast", (t) => t.hidden), true, "sem aviso pedindo para fechar e abrir");
  const nav = pg.waitForEvent("framenavigated");
  await pg.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await nav;
  await pg.waitForSelector(".ticket"); await espera(pg, 400);
  assert.equal(await pg.evaluate(() => window.__marca), undefined, "recarregou");
  assert.ok(Math.abs((await pg.evaluate(() => scrollY)) - 600) < 5, "voltou ao mesmo ponto da lista");
});

test("compacta: tocar na linha abre o cartão; tocar no coração não abre", async () => {
  const pg = await abrir({ compacta: true });
  const card = pg.locator("#grid .ticket").first();
  await card.locator(".heart").click();
  await espera(pg);
  assert.equal(await card.evaluate((t) => t.classList.contains("expandido")), false, "o coração só favorita");
  await card.locator(".offer").click();
  await espera(pg);
  assert.equal(await card.evaluate((t) => t.classList.contains("expandido")), true, "tocar no texto abre");
  assert.equal(await card.locator('[data-act="expandir"]').getAttribute("aria-expanded"), "true");
  await card.locator(".offer").click(); // aberto, tocar no texto não fecha (a seta fecha)
  await espera(pg);
  assert.equal(await card.evaluate((t) => t.classList.contains("expandido")), true);
});

test("compacta: ✓ na linha marca como usado sem abrir; Desfazer devolve o foco ao ✓", async () => {
  const pg = await abrir({ compacta: true });
  const { id, nome } = await pg.$eval("#grid .ticket", (t) => ({ id: t.dataset.id, nome: t.querySelector(".tname").textContent }));
  const rapido = pg.locator(`.ticket[data-id="${id}"] [data-act="usar"]`);
  assert.equal(await rapido.getAttribute("aria-label"), `Marcar como usado: ${nome}`);
  await rapido.focus();
  await pg.keyboard.press("Enter");
  await espera(pg, 150);
  assert.equal(await pg.$(`#grid .ticket[data-id="${id}"]`), null, "saiu dos disponíveis");
  assert.ok((await pg.evaluate(() => window.__escritas.at(-1))).patch.usado);
  const f = await focado(pg);
  assert.match(f.cls, /tname/, "foco no nome do cupom vizinho");
  await pg.click("#toast-undo");
  await espera(pg, 150);
  const g = await focado(pg);
  assert.equal(g.card, id);
  assert.equal(await pg.evaluate(() => document.activeElement.dataset.act), "usar", "foco de volta no ✓ (visível na linha)");
});

test("lista completa: o ✓ rápido não aparece nem é lido", async () => {
  const pg = await abrir();
  assert.equal(await pg.$eval("#grid .ticket [data-act=usar]", (b) => getComputedStyle(b).display), "none");
});
