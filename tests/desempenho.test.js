// Desempenho no celular: CPU 4× mais lenta, tempo do toque até a tela atualizar.
// Em 17/11/2026: antes ~1,7 s por favorito; depois ~35 ms. O limite aqui é folgado (máquinas variam),
// mas pega a volta de um redesenho completo.
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { abrir, fechar } = require("./lib/pagina");

after(fechar);
const LIMITE_MS = 400;

async function ateQuadro(pg, acao) {
  return pg.evaluate(async (acao) => {
    const t = performance.now();
    if (acao === "favoritar") document.querySelector("#grid .ticket .heart").click();
    if (acao === "banco") window.__snap();
    if (acao === "letra") {
      const q = document.getElementById("q");
      q.value += "a";
      q.dispatchEvent(new Event("input"));
      await new Promise((r) => setTimeout(r, 90)); // atraso da busca
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - t - (acao === "letra" ? 90 : 0);
  }, acao);
}

test(`favoritar, atualizar o banco e digitar ficam abaixo de ${LIMITE_MS} ms (CPU 4×)`, async () => {
  const pg = await abrir();
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  for (const acao of ["favoritar", "banco", "letra"]) {
    await ateQuadro(pg, acao); // aquece
    const ms = await ateQuadro(pg, acao);
    assert.ok(ms < LIMITE_MS, `${acao}: ${Math.round(ms)} ms`);
  }
});
