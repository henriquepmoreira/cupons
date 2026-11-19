// Acessibilidade: árvore que o TalkBack recebe, axe-core e foco visível sob a barra fixa.
// Lição de 17/11/2026: content-visibility deixava os cartões fora da tela vazios na árvore de
// acessibilidade, e um teste que lia o DOM (ariaSnapshot) não percebeu. Por isso, aqui se lê a
// árvore do próprio Chrome.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { abrir, fechar, fecharFiltros, aba, espera, busca, arvoreAcessibilidade, cartoes, texto, textos, ordenar, abrirFiltros } = require("./lib/pagina");

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
    await fecharFiltros(pg);
    await busca(pg, "spoleto");
    await pg.click("#grid .ticket .outros summary");
    await pg.click("#grid .ticket .det:not(.outros) summary");
    await espera(pg, 150);
    assert.deepEqual(await violacoes(pg), [], "cartão com os dois painéis abertos");
  });
}

test("axe sem violações na lista compacta (o padrão), com um cartão expandido", { skip: !axe && "rode npm install em tests/" }, async () => {
  const pg = await abrir({ compacta: true, largura: 412, data: "2026-11-19T20:00:00" });
  assert.deepEqual(await violacoes(pg), [], "lista compacta");
  await pg.click("#grid .ticket [data-act=expandir]");
  await espera(pg, 150);
  assert.deepEqual(await violacoes(pg), [], "cartão expandido");
});

// Revisão para o TalkBack de 19/11/2026: o que o leitor ouve, e para onde vai o foco.
const PRA_TELA = /[·×✓✗⚑♥↗]/; // símbolos só da tela (o leitor diria "ponto", "vezes", "marca de seleção"…)
const SO_MAIUSCULAS = (n) => /[A-ZÀ-Ú]{2}/.test(n) && n === n.toUpperCase();
async function nomesFalados(pg) {
  const ax = (await arvoreAcessibilidade(pg)).filter((x) => !x.ignored);
  return {
    titulos: ax.filter((x) => ["heading", "group", "region", "dialog", "tabpanel"].includes(x.role?.value)).map((x) => x.name?.value || "").filter(Boolean),
    textos: ax.filter((x) => x.role?.value === "StaticText").map((x) => x.name?.value || ""),
    controles: ax.filter((x) => ["button", "link", "tab", "DisclosureTriangle"].includes(x.role?.value)).map((x) => x.name?.value || ""),
  };
}
async function confereFalados(pg, onde) {
  const { titulos, textos, controles } = await nomesFalados(pg);
  assert.deepEqual(titulos.filter(SO_MAIUSCULAS), [], `${onde}: títulos chegam ao leitor em maiúsculas (o TalkBack pode soletrar)`);
  assert.deepEqual([...textos, ...controles].filter((t) => PRA_TELA.test(t)), [], `${onde}: símbolos que o leitor falaria`);
}

test("leitor recebe títulos como foram escritos e sem símbolos da tela", async () => {
  const pg = await abrir({ largura: 412, data: "2026-11-19T17:20:00" });
  await pg.click("#planos summary");
  await confereFalados(pg, "lista inicial com planos abertos e Daqui a pouco");
  await busca(pg, "spoleto");
  await pg.click("#grid .ticket .outros summary");
  await pg.click("#grid .ticket .det:not(.outros) summary");
  await espera(pg, 150);
  await confereFalados(pg, "cartão com os dois painéis abertos");
  await busca(pg, "");
  for (const a of ["quando", "oque", "onde"]) { await aba(pg, a); await confereFalados(pg, `Filtros, aba ${a}`); }
  await pg.selectOption("#sort", "categoria");
  await fecharFiltros(pg);
  await espera(pg, 150);
  await confereFalados(pg, "por categoria");
  await busca(pg, "xyzwq");
  await confereFalados(pg, "nada encontrado");
});

test("regras com um item por linha viram lista, sem o hífen", async () => {
  const pg = await abrir({ largura: 412 });
  await busca(pg, "spoleto");
  const card = '#grid .ticket[data-id="poa-em-dobro--spoleto"]';
  await pg.click(`${card} .det:not(.outros) summary`);
  await espera(pg, 100);
  const itens = await pg.$$eval(`${card} .rg-lista li`, (li) => li.map((x) => x.textContent));
  assert.ok(itens.length >= 3, `${itens.length} itens`);
  assert.ok(itens.every((t) => !/^[-–•]/.test(t)), itens.join(" | "));
});

test("o foco não volta ao começo da página quando o botão tocado some", async () => {
  const foco = (pg) => pg.evaluate(() => (document.activeElement === document.body ? "body" : document.activeElement.id || document.activeElement.className));
  let pg = await abrir({ largura: 412 });
  await busca(pg, "pizza");
  await pg.click("#result-clear");
  await espera(pg, 150);
  assert.equal(await foco(pg), "result-count", "Limpar busca e filtros");
  pg = await abrir({ largura: 412, data: "2026-11-19T20:00:00", localizacao: { latitude: -30.027, longitude: -51.2 } });
  await pg.click('[data-agora-act="perto"]');
  await pg.waitForFunction(() => !document.querySelector('[data-agora-act="perto"]'));
  await espera(pg, 100);
  assert.equal(await foco(pg), "result-count", "Ordenar pelos mais perto");
  pg = await abrir({ largura: 412, site: true });
  await pg.click("#mapa-abrir");
  await pg.waitForSelector("#mapa-area .leaflet-interactive", { timeout: 5000 });
  assert.equal(await foco(pg), "mapa-info", "Ver no mapa");
});

test("aviso de usado é anunciado por uma região ao vivo que já estava na página", async () => {
  const pg = await abrir({ largura: 412 });
  assert.equal(await pg.$eval("#toast", (t) => t.getAttribute("role") || t.getAttribute("aria-live")), null, "o toast nasce escondido: não pode ser a região ao vivo");
  assert.equal(await pg.$eval("#sr-aviso", (e) => !e.closest("[hidden]") && e.getAttribute("role")), "status");
  const nome = await pg.$eval("#grid .ticket .tname", (h) => h.textContent);
  await pg.click("#grid .ticket [data-act=use]");
  await espera(pg, 300);
  assert.match(await texto(pg, "#sr-aviso"), new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: marcado como usado\\..*Desfazer`));
});

test("lista compacta: ✓ sem descrição repetida e lido depois da oferta", async () => {
  const pg = await abrir({ compacta: true, largura: 412 });
  const ax = await arvoreAcessibilidade(pg);
  const usar = ax.filter((x) => !x.ignored && x.role?.value === "button" && /^Marcar como usado: /.test(x.name?.value || ""));
  assert.ok(usar.length > 10);
  assert.deepEqual(usar.filter((x) => x.description?.value).map((x) => x.description.value), []);
  const depois = await pg.$eval("#grid .ticket", (t) => !!(t.querySelector(".offer").compareDocumentPosition(t.querySelector("[data-act=usar]")) & Node.DOCUMENT_POSITION_FOLLOWING));
  assert.ok(depois, "o ✓ fica no canto de baixo; na ordem do leitor também vem depois da oferta");
});

test("mapa do site em português e sem os pontos sem nome na árvore", async () => {
  const pg = await abrir({ largura: 412, site: true });
  await pg.click("#mapa-abrir");
  await pg.waitForSelector("#mapa-area .leaflet-interactive", { timeout: 5000 });
  const ax = (await arvoreAcessibilidade(pg)).filter((x) => !x.ignored);
  const nomes = ax.map((x) => `${x.name?.value || ""} ${x.description?.value || ""}`);
  assert.deepEqual(nomes.filter((n) => /Zoom|JavaScript|Close/.test(n)), []);
  assert.ok(ax.some((x) => x.role?.value === "button" && x.name?.value === "Aproximar"));
  assert.ok(ax.some((x) => x.role?.value === "group" && /lista abaixo tem os mesmos cupons/.test(x.name?.value || "")), "a área do mapa tem nome");
  assert.equal(ax.filter((x) => x.role?.value === "image" && !x.name?.value).length, 0, "imagem sem nome");
});

// Teste de estresse de 19/11/2026 (segunda rodada)
test("botões de cupons com o mesmo nome dizem de qual programa (e oferta) são", async () => {
  const pg = await abrir({ largura: 412, prefs: { status: "todos", lista: "completa" } });
  for (let i = 0; i < 20 && (await pg.$("#mais-btn:visible")); i++) { await pg.click("#mais-btn"); await espera(pg, 120); }
  const ax = (await arvoreAcessibilidade(pg)).filter((x) => !x.ignored && x.role?.value === "button");
  const cont = {};
  for (const x of ax) { const n = x.name?.value || ""; if (/^(Favorito|Marcar como usado|Voltar para disponíveis): /.test(n)) cont[n] = (cont[n] || 0) + 1; }
  assert.deepEqual(Object.entries(cont).filter(([, k]) => k > 1).map(([n]) => n), []);
  assert.ok(cont["Favorito: Trigo Pizzaria, Poa em Dobro"] && cont["Favorito: Trigo Pizzaria, Tour Grande Poa"], "o mesmo nome em dois programas");
  assert.ok(Object.keys(cont).some((n) => /^Favorito: Saúde no Copo, Tour Grande Poa, /.test(n)), "o mesmo nome no mesmo programa leva a oferta");
  assert.ok(cont["Favorito: Sabor de Luna"], "nome único fica como está");
});

test("o foco não para atrás de \"Voltar ao topo\" no pé da tela", async () => {
  // como na varredura que achou o problema: Tab pela lista; o botão aparece depois de duas telas de rolagem
  const pg = await abrir({ largura: 412, compacta: true });
  await pg.focus("#grid .ticket .heart");
  let cobertos = 0;
  for (let i = 0; i < 200; i++) {
    await pg.keyboard.press("Tab");
    cobertos += await pg.evaluate(() => {
      const t = document.getElementById("topo"), a = document.activeElement;
      const r = a.getBoundingClientRect(), q = t.getBoundingClientRect();
      if (t.hidden || t === a || r.height > innerHeight) return 0;
      return r.bottom > q.top && r.top < q.bottom && r.right > q.left && r.left < q.right ? 1 : 0;
    });
  }
  assert.equal(cobertos, 0);
});

test("com texto ampliado o título quebra em vez de a página rolar de lado", async () => {
  const pg = await abrir({ largura: 412, compacta: true });
  for (const z of [1.3, 1.5]) {
    const lateral = await pg.evaluate((z) => { document.documentElement.style.zoom = z; return document.documentElement.scrollWidth - document.documentElement.clientWidth; }, z);
    assert.equal(lateral, 0, `zoom ${z}`);
  }
});

test("celular deitado: a barra fixa se recolhe ao rolar para baixo", async () => {
  const pg = await abrir({ largura: 844, altura: 390 });
  await pg.mouse.wheel(0, 900); await espera(pg, 300); await pg.mouse.wheel(0, 400); await espera(pg, 300);
  assert.equal(await pg.$eval(".toolbar", (t) => t.classList.contains("recolhida")), true);
  await pg.mouse.wheel(0, -200); await espera(pg, 300);
  assert.equal(await pg.$eval(".toolbar", (t) => t.classList.contains("recolhida")), false);
});

test("Desfazer confirma em voz alta e não repete o total", async () => {
  const pg = await abrir({ largura: 412 });
  await pg.click("#grid .ticket [data-act=use]");
  await espera(pg, 1000);
  const total = await texto(pg, "#sr-status");
  await pg.click("#toast-undo");
  await espera(pg, 1000);
  assert.equal(await texto(pg, "#sr-aviso"), "Desfeito.");
  assert.equal(await texto(pg, "#sr-status"), total, "o total não é anunciado de novo");
});

// Teste de estresse de 19/11/2026 (terceira rodada)
test("níveis de título: painel do cartão um abaixo do nome, subtítulos do Filtros abaixo de \"Filtros\"", async () => {
  const pg = await abrir({ largura: 412 });
  await ordenar(pg, "categoria");
  await pg.click("#grid .ticket .det:not(.outros) summary");
  await espera(pg, 100);
  const niveis = await pg.$eval("#grid .ticket", (t) => ({ nome: t.querySelector(".tname").tagName, painel: [...new Set([...t.querySelectorAll(".det-body h4, .det-body h5")].map((h) => h.tagName))] }));
  assert.deepEqual(niveis, { nome: "H4", painel: ["H5"] }, "em \"Por categoria\" o cartão é h4 e o painel h5");
  await abrirFiltros(pg);
  assert.equal(await pg.$eval("#filters-titulo", (h) => h.tagName), "H2");
  assert.deepEqual([...new Set(await pg.$$eval("#filters .fgroup > :is(h2, h3, h4)", (hs) => hs.map((h) => h.tagName)))], ["H3"]);
});

test("mudança de outro aparelho: sem anunciar o total e, se o cartão focado sai, foco no vizinho com aviso", async () => {
  const pg = await abrir({ largura: 412 });
  await pg.focus("#grid .ticket:nth-child(3) .heart");
  await espera(pg, 900);
  const total = await texto(pg, "#sr-status");
  const usa = (i) => pg.evaluate((i) => { const id = document.querySelectorAll("#grid .ticket")[i].dataset.id; Object.assign(window.__docs.find((d) => d.id === id), { usado: true, usadoEm: "2026-11-19" }); window.__snap(); }, i);
  await usa(5);
  await espera(pg, 1000);
  assert.equal(await texto(pg, "#sr-status"), total, "outro cartão usado lá não interrompe a leitura");
  const [focado, vizinho] = await pg.$$eval("#grid .ticket", (t) => [t[2].querySelector(".tname").textContent, t[3].dataset.id]);
  await usa(2);
  await espera(pg, 1000);
  assert.equal(await pg.evaluate(() => document.activeElement.closest(".ticket")?.dataset.id), vizinho, "foco no cartão seguinte, não no começo da lista");
  assert.equal(await texto(pg, "#sr-aviso"), `${focado} foi marcado como usado em outro aparelho.`);
});

test("datas por extenso e \"número\" no endereço para o leitor", async () => {
  const pg = await abrir({ largura: 412, data: "2026-11-17T12:30:00" });
  await pg.click("#planos summary");
  assert.ok((await textos(pg, "#planos .sr-only")).includes("5 de março de 2027"));
  await busca(pg, "spoleto");
  await pg.click('#grid .ticket[data-id="poa-em-dobro--spoleto"] .det:not(.outros) summary');
  await espera(pg, 100);
  const ax = (await arvoreAcessibilidade(pg)).filter((x) => !x.ignored && x.role?.value === "StaticText").map((x) => x.name?.value || "");
  assert.ok(ax.some((t) => /número 1800/.test(t)), "Nº lido como número");
  assert.ok(!ax.some((t) => /\b\d{2}\/\d{2}\/\d{2}\b/.test(t)), "nenhuma data curta chega ao leitor");
});

// Teste de estresse de 19/11/2026 (quarta rodada)
test("\"Valendo agora\": o minuto passa e o foco fica no mesmo item (sem novo evento de foco)", async () => {
  const pg = await abrir({ largura: 412, data: "2026-11-19T17:20:00" });
  await pg.focus("#agora ol[aria-label] [data-agora]");
  await espera(pg, 300);
  await pg.evaluate(() => { window.__el = document.activeElement; window.__focos = 0; document.addEventListener("focusin", () => window.__focos++, true); });
  await pg.clock.setFixedTime(new Date("2026-11-19T17:21:00"));
  await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await espera(pg, 300);
  const r = await pg.evaluate(() => ({ mesmo: document.activeElement === window.__el, focos: window.__focos, txt: document.activeElement.textContent }));
  assert.deepEqual([r.mesmo, r.focos], [true, 0], "o leitor não é jogado para o total a cada minuto");
  assert.match(r.txt, /daqui a 9 minutos/, "o texto do item se atualiza no lugar");
  // item que deixa de valer: o foco vai para outro item do bloco, não para o começo da lista
  await pg.clock.setFixedTime(new Date("2026-11-19T17:31:00"));
  await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await espera(pg, 300);
  assert.ok(await pg.evaluate(() => !!document.activeElement.closest("#agora")), "foco continua no Valendo agora");
});

test("gesto de voltar do Android fecha o Filtros em tela cheia, sem sair da página", async () => {
  const pg = await abrir({ largura: 412 });
  await aba(pg, "quando");
  await pg.evaluate(() => history.back()).catch(() => {});
  await espera(pg, 400);
  assert.ok(await pg.$("#grid .ticket"), "a página continua aberta");
  assert.deepEqual(await pg.evaluate(() => [document.getElementById("filters").hidden, document.activeElement.id]), [true, "filters-toggle"]);
  await aba(pg, "onde");
  await fecharFiltros(pg);
  await espera(pg, 300);
  assert.equal(await pg.evaluate(() => history.state?.cuponsFiltros || null), null, "fechar pelo × tira a entrada do histórico");
  const pc = await abrir({ largura: 1280 });
  await aba(pc, "quando");
  assert.equal(await pc.evaluate(() => history.state?.cuponsFiltros || null), null, "no computador (painel, não diálogo) não há entrada");
});
