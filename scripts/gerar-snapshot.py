#!/usr/bin/env python3
"""Gera snapshot.json, a cópia somente leitura dos cupons que a página usa quando o
banco do artifact não está disponível (quem abre o link sem estar logado no claude.ai
não recebe dados do banco).

Uso:
  1. Leia o banco com ArtifactData: action "list", collection "cupons",
     query {"limit": 1000}, out_dir <pasta>. Isso cria <pasta>/cupons/<id>.json.
  2. python3 scripts/gerar-snapshot.py <pasta>/cupons <saida>/snapshot.json
  3. Publique a página com files {"snapshot.json": "<saida>/snapshot.json",
     "regras.json": "<saida>/regras.json"}. Republicar só o cupons.html mantém a cópia
     anterior no artifact.

A cópia é enxuta, como a lista que a página guarda no aparelho (enxuto() no cupons.html):
sem valores vazios (null, listas vazias e false em favorito, usado, maisUnidades e
verRegras) e sem as regras, que vão para regras.json ({id: texto}, na mesma pasta) e a
página busca em segundo plano. feriados e datasComemorativas ficam mesmo quando false
(false quer dizer "não vale").

A cópia vem do banco, e não de data/*.json, para levar favoritos e usados marcados
na página.
"""
import datetime
import json
import pathlib
import sys

ORDEM = {"poa-em-dobro": 0, "tour-grande-poa": 1, "canoas-em-dobro": 2}
FALSO_OPCIONAL = {"favorito", "usado", "maisUnidades", "verRegras"}


def enxuto(c: dict) -> dict:
    """O cupom sem regras e sem valores que a página trata como ausentes."""
    return {k: v for k, v in c.items()
            if k != "regras" and v is not None and v != [] and not (v is False and k in FALSO_OPCIONAL)}


def compacto(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def main(src: str, out: str) -> None:
    cupons = []
    for f in sorted(pathlib.Path(src).glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        doc["id"] = f.stem
        cupons.append(doc)
    if not cupons:
        sys.exit(f"nenhum cupom em {src}")
    cupons.sort(key=lambda c: (ORDEM.get(c.get("programa"), 9), c.get("ordem") or 999))
    saida = pathlib.Path(out)
    regras = {c["id"]: c["regras"] for c in cupons if c.get("regras")}
    data = {"geradoEm": datetime.date.today().isoformat(), "regras": "regras.json", "cupons": [enxuto(c) for c in cupons]}
    saida.write_text(compacto(data), encoding="utf-8")
    (saida.parent / "regras.json").write_text(compacto(regras), encoding="utf-8")
    print(f"{len(cupons)} cupons em {saida} ({saida.stat().st_size // 1024} KB) e {len(regras)} regras em "
          f"{saida.parent / 'regras.json'} ({(saida.parent / 'regras.json').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
