// Acessibilidade: árvore que o TalkBack recebe, axe-core e foco visível sob a barra fixa.
// Lição de 17/11/2026: content-visibility deixava os cartões fora da tela vazios na árvore de
// acessibilidade, e um teste que lia o DOM (ariaSnapshot) não percebeu. Por isso, aqui se lê a
// árvore do próprio Chrome.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { abrir, fechar, aba, espera, busca, arvoreAcessibilidade, cartoes } = require("./lib/pagina");

after(fechar);

test("todo cartão na página está completo na árvore de acessibilidade", async () => {
  const pg = await abrir();
  await pg.click("#mais-btn");
  await espera(pg);
  const n = await cartoes(pg);
  const ax = await arvoreAcessibilidade(pg);
  const artigos = ax.filter((x) => x.role?.value === "article" && !x.ignored);
  const comNome = artigos.filter((x) => x.name?.value);
  const coracoes = ax.filter((x) => x.role?.value === "button" && !x.ignored && /^Favorito: /.test(x.name?.value || ""));
  assert.equal(artigos.length, n);
  assert.equal(comNome.length, n, "artigos sem nome = cartões fora da tela vazios para o leitor");
  assert.equal(coracoes.length, n);
});

test("a árvore de acessibilidade fica pequena (TalkBack travava com ~33 mil nós)", async () => {
  const pg = await abrir();
  const ax = await arvoreAcessibilidade(pg);
  assert.ok(ax.length < 5000, `${ax.length} nós`);
});

test("favoritar e atualizar o banco mexem em poucos nós", async () => {
  const pg = await abrir();
  await pg.evaluate(() => {
    window.__nos = 0;
    new MutationObserver((ms) => { for (const m of ms) window.__nos += m.addedNodes.length + m.removedNodes.length; })
      .observe(document.body, { subtree: true, childList: true });
  });
  await pg.click("#grid .ticket .heart");
  await pg.evaluate(() => window.__snap());
  await pg.waitForTimeout(300);
  const nos = await pg.evaluate(() => window.__nos);
  assert.ok(nos < 60, `${nos} nós trocados (antes eram 1.600 por favorito)`);
});

test("nenhum item focado fica escondido sob a barra fixa", async () => {
  const pg = await abrir();
  await pg.focus("#grid .ticket:last-child [data-act=use]");
  let cobertos = 0;
  for (let i = 0; i < 80; i++) {
    await pg.keyboard.press("Shift+Tab");
    cobertos += await pg.evaluate(() => {
      const a = document.activeElement;
      if (!a.closest("#grid")) return 0;
      return a.getBoundingClientRect().top < document.querySelector(".toolbar").getBoundingClientRect().bottom - 1 ? 1 : 0;
    });
  }
  assert.equal(cobertos, 0);
});

// axe-core (WCAG 2.2 AA + boas práticas); precisa de `npm install` nesta pasta
let axe = null;
try { axe = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"); } catch (_) {}

async function violacoes(pg) {
  // no topo da página: com a página rolada, algum chip fica atrás da barra fixa e o axe acusa "target-size".
  // Item focado escondido pela barra é outro problema, coberto pelo teste "nenhum item focado fica escondido".
  await pg.evaluate(() => scrollTo(0, 0));
  await pg.addScriptTag({ content: axe });
  return pg.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }))
    .violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`));
}

for (const tema of ["light", "dark"]) {
  test(`axe sem violações, tema ${tema === "light" ? "claro" : "escuro"}`, { skip: !axe && "rode npm install em tests/" }, async () => {
    const pg = await abrir({ tema, largura: 412, data: "2026-11-19T20:00:00" });
    assert.deepEqual(await violacoes(pg), [], "lista inicial");
    await aba(pg, "onde");
    await pg.selectOption("#perto-bairro", { index: 3 });
    await pg.click('#f-raio button[data-raio="5"]');
    await espera(pg, 150);
    assert.deepEqual(await violacoes(pg), [], "Filtros abertos, aba Onde");
    await aba(pg, "quando");
    await pg.click("#f-data button:nth-child(2)");
    await espera(pg, 150);
    assert.deepEqual(await violacoes(pg), [], "Filtros abertos, aba Quando, com a linha de filtros ativos");
    await aba(pg, "oque");
    assert.deepEqual(await violacoes(pg), [], "Filtros abertos, aba O quê");
    await pg.click("#filters-clear");
    await pg.click("#filters-toggle");
    await busca(pg, "spoleto");
    await pg.click("#grid .ticket .outros summary");
    await pg.click("#grid .ticket .det:not(.outros) summary");
    await espera(pg, 150);
    assert.deepEqual(await violacoes(pg), [], "cartão com os dois painéis abertos");
  });
}
