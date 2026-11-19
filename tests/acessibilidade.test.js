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

// Teste de estresse de 19/11/2026 (quinta rodada): uma fala por ação
async function ouve(pg) {
  await pg.evaluate(() => {
    window.__fala = [];
    for (const v of document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')) {
      let t; new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { if (v.textContent.trim()) window.__fala.push(v.id); }, 60); }).observe(v, { childList: true, subtree: true, characterData: true });
    }
  });
}
test("sem fala repetida: aviso + total, ou foco no total + anúncio do total", async () => {
  const pg = await abrir({ largura: 412, localizacao: { latitude: -30.027, longitude: -51.2 } });
  await espera(pg, 1200);
  await ouve(pg);
  await pg.click("#perto-toggle");
  await espera(pg, 1600);
  assert.deepEqual(await pg.evaluate(() => window.__fala), ["sr-aviso"], "Perto de mim: só o aviso (o total diria o mesmo)");
  await pg.click("#perto-toggle");
  await busca(pg, "xyzq");
  await espera(pg, 1200);
  await pg.evaluate(() => { window.__fala = []; });
  await pg.click('#grid [data-act="tirar"]');
  await espera(pg, 1600);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "result-count");
  assert.deepEqual(await pg.evaluate(() => window.__fala), [], "o foco já leu o total; anunciar de novo repetiria");
  await pg.evaluate(() => { window.__fala = []; });
  await pg.click("#agora-toggle");
  await espera(pg, 1600);
  assert.deepEqual(await pg.evaluate(() => window.__fala), ["sr-status"], "ação comum continua anunciando o total");
});

test("mapa aberto: filtrar anuncia só o total; o aviso do mapa fala só nas ações do mapa", async () => {
  const pg = await abrir({ largura: 412, site: true });
  await pg.click("#mapa-abrir");
  await pg.waitForSelector("#mapa-area .leaflet-interactive", { timeout: 5000 });
  await espera(pg, 1200);
  await ouve(pg);
  await pg.click("#fav-toggle");
  await espera(pg, 1600);
  assert.deepEqual(await pg.evaluate(() => window.__fala), ["sr-status"]);
  assert.match(await texto(pg, "#mapa-info"), /cupons no mapa/, "o texto do mapa acompanha a lista, em silêncio");
});

// Teste de estresse de 19/11/2026 (sexta rodada)
test("espaçamento de texto ampliado (WCAG 1.4.12) não faz a página rolar de lado em 320 px", async () => {
  for (const compacta of [true, false]) {
    const pg = await abrir({ largura: 320, compacta, prefs: compacta ? undefined : { lista: "completa" } });
    const normal = await pg.evaluate(() => ({ h1: document.querySelector("h1").getBoundingClientRect().height, linhas: new Set([...document.querySelectorAll(".stat")].map((s) => Math.round(s.getBoundingClientRect().top))).size }));
    assert.ok(normal.h1 < 40 && normal.linhas === 1, "sem o espaçamento, título e números continuam numa linha");
    await pg.addStyleTag({ content: "*{letter-spacing:.12em!important;word-spacing:.16em!important;line-height:1.5!important} p{margin-bottom:2em!important}" });
    await espera(pg, 200);
    assert.equal(await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, compacta ? "compacta" : "completa");
  }
});

test("tecla buscar do teclado: aplica a busca e leva o foco ao total", async () => {
  const pg = await abrir({ largura: 412 });
  assert.equal(await pg.$eval("#q", (i) => i.getAttribute("enterkeyhint")), "search");
  await pg.focus("#q");
  await pg.keyboard.type("sushi");
  await pg.keyboard.press("Enter");
  await espera(pg, 200);
  assert.equal(await pg.evaluate(() => document.activeElement.id), "result-count");
  assert.match(await texto(pg, "#result-count"), /^\d+ de \d+ cupons disponíveis/);
});

test("sem as coordenadas dos cupons, Perto de mim não diz que ordenou por distância", async () => {
  const pg = await abrir({ largura: 412, geo: false, localizacao: { latitude: -30.027, longitude: -51.2 } });
  await pg.click("#perto-toggle");
  await espera(pg, 1500);
  assert.match(await texto(pg, "#toast-msg"), /coordenadas dos cupons não carregaram/);
});

// Teste de estresse de 19/11/2026 (sétima rodada): paradas do TalkBack no Chrome do Android
// Modelo (como BrowserAccessibilityAndroid::IsLeaf): um nó só com filhos de texto vira uma parada; em bloco flex,
// cada pedaço de texto vira um nó próprio e uma parada própria ("Poa em Dobro", "vírgula", "Restaurante").
async function paradasDoCartao(pg, sel) {
  const ax = await arvoreAcessibilidade(pg);
  const porId = new Map(ax.map((n) => [n.nodeId, n]));
  const TEXTO = new Set(["StaticText", "InlineTextBox", "LineBreak"]);
  const ACAO = new Set(["button", "link", "DisclosureTriangle", "heading"]);
  const vivos = (n) => (n.childIds || []).flatMap((c) => { const x = porId.get(c); return !x ? [] : x.ignored ? vivos(x) : [x]; });
  const textoDe = (n) => (n.role?.value === "StaticText" ? n.name?.value || "" : n.role?.value === "InlineTextBox" ? "" : vivos(n).map(textoDe).join(" "));
  const nome = await pg.$eval(`${sel} .tname`, (h) => h.textContent);
  const art = ax.find((x) => !x.ignored && x.role?.value === "article" && x.name?.value === nome);
  const out = [];
  const v = (n) => {
    const r = n.role?.value, fs = vivos(n);
    if (ACAO.has(r)) { out.push(n.name?.value || ""); return; }
    if (r === "StaticText") { out.push(n.name?.value || ""); return; }
    if (fs.length && fs.every((f) => TEXTO.has(f.role?.value))) { out.push(textoDe(n).replace(/\s+/g, " ").trim()); return; }
    fs.forEach(v);
  };
  vivos(art).forEach(v);
  return out.filter((t) => t.trim());
}
test("cartão: oferta e programa numa parada cada, sem parada só de vírgula", async () => {
  const pg = await abrir({ largura: 412, compacta: true });
  const ps = await paradasDoCartao(pg, "#grid .ticket:first-child");
  assert.deepEqual(ps.filter((t) => /^[\s,.;:·]*$/.test(t)), [], "parada só com pontuação");
  assert.ok(ps.some((t) => /^Na compra de .+ ganhe .+\.$/.test(t)), `oferta inteira numa parada: ${JSON.stringify(ps)}`);
  assert.ok(ps.some((t) => /^(Poa em Dobro|Tour Grande Poa|Canoas em Dobro), .+/.test(t)), "programa e categoria juntos");
  assert.ok(ps.length <= 8, `${ps.length} paradas no cartão compacto`);
  const topo = await pg.$eval("#st-fala", (p) => p.textContent);
  assert.match(topo, /^\d+ disponíveis, \d+ favoritos, \d+ usados$/, "números do topo numa frase");
  assert.equal(await pg.$eval("#stats", (s) => s.getAttribute("aria-hidden")), "true");
});

test("áreas de toque dos botões só de texto com 44 px (exploração por toque)", async () => {
  const pg = await abrir({ largura: 412, data: "2026-11-19T20:00:00" });
  await busca(pg, "spoleto");
  await pg.click("#grid .ticket .outros summary");
  await espera(pg, 150);
  const alturas = await pg.$$eval("#agora .linkbtn, #result-clear, #grid .det > summary, #grid .maplink, #grid [data-act=grupo], #q-clear", (es) => es.filter((e) => e.getClientRects().length).map((e) => [e.id || e.className || e.tagName, Math.round(e.getBoundingClientRect().height)]));
  assert.ok(alturas.length >= 4);
  assert.deepEqual(alturas.filter(([, h]) => h < 43), []);
});

test("toque duplo no texto da linha compacta abre o cartão e avisa", async () => {
  const pg = await abrir({ largura: 412, compacta: true });
  const nome = await pg.$eval("#grid .ticket .tname", (h) => h.textContent);
  await pg.click("#grid .ticket .offer");
  await espera(pg, 300);
  assert.equal(await pg.$eval("#grid .ticket", (t) => t.classList.contains("expandido")), true);
  assert.equal(await texto(pg, "#sr-aviso"), `${nome}: cartão completo aberto.`);
});

// Teste de estresse de 19/11/2026 (oitava rodada)
test("horários: tabela só na tela, uma lista com um dia por item para o leitor", async () => {
  const pg = await abrir({ largura: 412, data: "2026-11-19T20:00:00" });
  await busca(pg, "spoleto");
  const card = '#grid .ticket[data-id="poa-em-dobro--spoleto"]';
  await pg.click(`${card} .det:not(.outros) summary`);
  await espera(pg, 150);
  const r = await pg.$$eval(`${card} .det-body table.hor`, (ts) => ts.map((t) => ({ escondida: t.getAttribute("aria-hidden"), lista: t.nextElementSibling?.matches("ul[aria-label]") ? [...t.nextElementSibling.children].map((li) => li.textContent) : null })));
  assert.equal(r.length, 2);
  for (const t of r) {
    assert.equal(t.escondida, "true");
    assert.equal(t.lista.length, 7);
    assert.match(t.lista[0], /^Domingo: (das \d\d:\d\d às \d\d:\d\d|não vale)/);
  }
  const ax = (await arvoreAcessibilidade(pg)).filter((x) => !x.ignored);
  assert.equal(ax.filter((x) => ["table", "cell", "rowheader"].includes(x.role?.value)).length, 0, "nenhuma tabela na árvore do leitor");
});

test("\"Ordenar\" falado uma vez e aviso falado sai da região depois de lido", async () => {
  const pg = await abrir({ largura: 412 });
  await abrirFiltros(pg);
  const ax = (await arvoreAcessibilidade(pg)).filter((x) => !x.ignored && x.name?.value === "Ordenar");
  assert.deepEqual(ax.map((x) => x.role?.value), ["combobox"]);
  await fecharFiltros(pg);
  await pg.click("#grid .ticket [data-act=use]");
  await espera(pg, 400);
  assert.match(await texto(pg, "#sr-aviso"), /marcado como usado/);
  await espera(pg, 4300);
  assert.equal(await texto(pg, "#sr-aviso"), "", "quem desliza até o fim ouve só o aviso visível, não duas vezes");
});

// Teste de estresse de 19/11/2026 (nona rodada): o main fica inerte com o Filtros aberto no celular
test("com o Filtros em tela cheia, o total e os avisos continuam chegando ao leitor", async () => {
  const pg = await abrir({ largura: 412, localizacao: { latitude: -30.027, longitude: -51.2 } });
  await aba(pg, "quando");
  assert.equal(await pg.$eval("main", (m) => m.inert), true, "o resto da página fica inerte");
  await pg.click("#f-turno button:nth-child(4)");
  await espera(pg, 1200);
  await pg.click("#aba-onde");
  await pg.click("#perto-gps");
  await espera(pg, 1500);
  const cdp = await pg.context().newCDPSession(pg);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const porId = new Map(nodes.map((n) => [n.nodeId, n]));
  const txt = (n) => (n.role?.value === "StaticText" ? n.name?.value || "" : (n.childIds || []).map((c) => porId.get(c)).filter(Boolean).map(txt).join(""));
  const vivas = nodes.filter((n) => !n.ignored && n.properties?.some((p) => p.name === "live" && p.value.value === "polite")).map(txt);
  assert.ok(vivas.some((t) => /de 575 cupons disponíveis/.test(t)), `total alcançável: ${JSON.stringify(vivas)}`);
  assert.ok(vivas.some((t) => /mais perto/.test(t)), "aviso alcançável");
  assert.equal(await pg.evaluate(() => !!document.getElementById("toast").closest("[inert]")), false, "o aviso (e o Desfazer) não ficam inertes");
});

// Teste de estresse de 19/11/2026 (décima rodada)
test("Filtros aberto deitado e o celular gira: o foco entra no diálogo (não cai no começo da página)", async () => {
  const pg = await abrir({ largura: 844, altura: 412 });
  await pg.click("#filters-toggle");
  await espera(pg, 200);
  assert.equal(await pg.$eval("#filters", (f) => f.getAttribute("role")), null, "deitado: painel, não diálogo");
  await pg.setViewportSize({ width: 412, height: 844 });
  await espera(pg, 400);
  assert.deepEqual(await pg.evaluate(() => [document.getElementById("filters").getAttribute("role"), document.querySelector(".toolbar").inert, document.activeElement.id]), ["dialog", true, "filters-titulo"]);
  await pg.setViewportSize({ width: 844, height: 412 });
  await espera(pg, 400);
  assert.deepEqual(await pg.evaluate(() => [document.querySelector("main").inert, history.state?.cuponsFiltros || null]), [false, null], "girando de volta, nada fica inerte nem sobra no histórico");
});

// Teste de estresse de 19/11/2026 (décima primeira rodada): gravação recusada pelo banco
test("gravação recusada: a tela volta ao estado real e o aviso diz qual cupom ficou como estava", async () => {
  const pg = await abrir({ largura: 412 });
  await pg.evaluate(() => { window.__falhaEscrita = "quota_exceeded"; });
  const [id, nome, antes] = await pg.$eval("#grid .ticket", (t) => [t.dataset.id, t.querySelector(".tname").textContent, t.querySelector(".heart").getAttribute("aria-pressed")]);
  await pg.click("#grid .ticket .heart");
  await espera(pg, 600);
  assert.equal(await pg.$eval(`.ticket[data-id="${id}"] .heart`, (b) => b.getAttribute("aria-pressed")), antes, "favorito não gravado não fica marcado");
  assert.match(await texto(pg, "#sr-aviso"), new RegExp(`não foi salva\\. ${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} ficou como estava\\.$`));
  await pg.click(`.ticket[data-id="${id}"] [data-act=use]`);
  await espera(pg, 600);
  assert.ok(await pg.$(`.ticket[data-id="${id}"]`), "cupom não marcado como usado volta à lista");
  assert.equal(await pg.evaluate(() => window.__escritas.length), 0);
});

// Teste de estresse de 19/11/2026 (décima segunda rodada): o foco do TalkBack não é o foco do navegador
test("aviso com Desfazer não some com o tempo curto; fecha no próximo toque fora dele", async () => {
  const pg = await abrir({ largura: 412 });
  await pg.click("#grid .ticket [data-act=use]");
  await espera(pg, 11000);
  assert.equal(await pg.$eval("#toast", (t) => t.hidden), false, "depois de 11 s o Desfazer continua lá (o leitor pode estar chegando nele)");
  await pg.click("#grid .ticket .heart");
  await espera(pg, 150);
  assert.equal(await pg.$eval("#toast", (t) => t.hidden), true, "tocar em outra coisa fecha");
});

test("recarregar a aba (Chrome do Android descarta abas) devolve o foco ao cupom que estava na tela", async () => {
  const pg = await abrir({ largura: 412 });
  await pg.click("#mais-btn");
  await espera(pg, 300);
  await pg.evaluate(() => { document.querySelector("#grid .ticket:nth-child(55)").scrollIntoView({ block: "start" }); scrollBy(0, -120); });
  await espera(pg, 800);
  const naTela = await pg.evaluate(() => { const topo = document.querySelector(".toolbar").getBoundingClientRect().bottom; return [...document.querySelectorAll("#grid .ticket")].find((t) => t.getBoundingClientRect().bottom > topo + 40).dataset.id; });
  await pg.reload();
  await pg.waitForSelector(".ticket");
  await espera(pg, 1200);
  assert.equal(await pg.evaluate(() => document.activeElement.closest(".ticket")?.dataset.id), naTela, "o foco do navegador tinha ficado no 41º (Mostrar mais); vale o cupom na tela");
  assert.equal(await pg.evaluate(() => document.activeElement.classList.contains("tname")), true);
});

// Teste de estresse de 19/11/2026 (décima terceira rodada): cartões atualizados no lugar
test("o minuto passa e outro aparelho favorita: nenhum cartão recriado (o leitor não perde o lugar)", async () => {
  const pg = await abrir({ largura: 412, compacta: true, data: "2026-11-19T17:20:00" });
  await espera(pg, 600);
  const marca = () => pg.evaluate(() => { window.__nos = []; document.querySelectorAll("#grid .ticket").forEach((t) => { const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.trim()) window.__nos.push(n); window.__nos.push(t); }); });
  const destruidos = () => pg.evaluate(() => window.__nos.filter((n) => !n.isConnected).length);
  await marca();
  const breve = await pg.$eval("#grid", (g) => g.querySelectorAll(".tag.breve").length);
  assert.ok(breve > 0, "há cartões com contagem que muda a cada minuto");
  await pg.clock.setFixedTime(new Date("2026-11-19T17:21:00"));
  await pg.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await espera(pg, 400);
  assert.equal(await destruidos(), 0, "um minuto");
  assert.match(await pg.$eval("#grid .tag.breve", (t) => t.textContent), /· em (\d+ h )?\d+/, "o texto mudou no lugar");
  await marca();
  await pg.evaluate(() => { const ids = [...document.querySelectorAll("#grid .ticket")].slice(0, 5).map((t) => t.dataset.id); for (const d of window.__docs) if (ids.includes(d.id)) d.favorito = !d.favorito; window.__snap(); });
  await espera(pg, 400);
  assert.equal(await destruidos(), 0, "favoritos vindos de outro aparelho");
});
