// Limites de tamanho do que a página carrega. Falha se algo crescer além da folga, para os ganhos
// de desempenho não se perderem aos poucos. Ao aumentar um limite de propósito, explique no commit.
// Tamanhos em 19/11/2026: página 169 KB, snapshot 366 KB, regras 102 KB, geo 52 KB, Archivo 51 KB.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { RAIZ, cupons } = require("./lib/pagina");

const KB = 1024;
// cupons.html: 200 → 210 KB em 19/11/2026, pelos textos falados para o TalkBack (datas, separadores, rótulos);
// 210 → 230 KB em 19/11/2026, a pedido do dono: as rodadas de acessibilidade somam ~1 KB cada (decidido não cortar os comentários)
const LIMITES = { "cupons.html": 230 * KB, "snapshot.json": 430 * KB, "regras.json": 125 * KB, "geo.json": 62 * KB };

// os arquivos publicados, gerados como na publicação, mas a partir de data/*.json em vez do banco
function publicados() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cupons-tamanhos-"));
  const banco = path.join(tmp, "cupons"); fs.mkdirSync(banco);
  for (const c of cupons()) { const { id, ...doc } = c; fs.writeFileSync(path.join(banco, `${id}.json`), JSON.stringify(doc)); }
  execFileSync("python3", [path.join(RAIZ, "scripts", "gerar-snapshot.py"), banco, path.join(tmp, "snapshot.json")], { stdio: "pipe" });
  return tmp;
}

test("página e arquivos publicados dentro dos limites de tamanho", () => {
  const tmp = publicados();
  const tam = {
    "cupons.html": fs.statSync(path.join(RAIZ, "cupons.html")).size,
    "snapshot.json": fs.statSync(path.join(tmp, "snapshot.json")).size,
    "regras.json": fs.statSync(path.join(tmp, "regras.json")).size,
    "geo.json": fs.statSync(path.join(tmp, "geo.json")).size,
  };
  for (const [arq, n] of Object.entries(tam)) assert.ok(n <= LIMITES[arq], `${arq}: ${Math.round(n / KB)} KB (limite ${LIMITES[arq] / KB} KB)`);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("a cópia publicada continua enxuta: sem regras, sem null e sem listas vazias", () => {
  const tmp = publicados();
  const snap = JSON.parse(fs.readFileSync(path.join(tmp, "snapshot.json"), "utf8"));
  assert.equal(snap.regras, "regras.json");
  for (const c of snap.cupons) {
    assert.ok(!("regras" in c), `${c.id} com regras`);
    for (const [k, v] of Object.entries(c)) assert.ok(v !== null && !(Array.isArray(v) && !v.length), `${c.id}.${k} vazio`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("fontes: só as três famílias, e o Archivo só nas larguras e pesos usados", () => {
  const pagina = fs.readFileSync(path.join(RAIZ, "cupons.html"), "utf8");
  const urls = [...new Set(pagina.match(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g))];
  assert.equal(urls.length, 1, "um só endereço de fontes (o <link> e o <noscript> iguais)");
  const familias = new URL(urls[0]).searchParams.getAll("family");
  assert.deepEqual(familias.map((f) => f.split(":")[0]).sort(), ["Archivo", "Figtree", "IBM Plex Mono"]);
  // 62..125 ou 500..900 faz o Google mandar o arquivo inteiro (90 KB em vez de 51 KB)
  assert.ok(familias.includes("Archivo:wdth,wght@62..100,700..900"), familias.join(" | "));
  assert.ok(familias.includes("IBM Plex Mono:wght@500;600"));
});
