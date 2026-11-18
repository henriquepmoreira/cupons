#!/usr/bin/env python3
"""Gera snapshot.json, a cópia somente leitura dos cupons que a página usa quando o
banco do artifact não está disponível (quem abre o link sem estar logado no claude.ai
não recebe dados do banco).

Uso:
  1. Leia o banco com ArtifactData: action "list", collection "cupons",
     query {"limit": 1000}, out_dir <pasta>. Isso cria <pasta>/cupons/<id>.json.
  2. python3 scripts/gerar-snapshot.py <pasta>/cupons <saida>/snapshot.json
  3. Publique a página com files {"snapshot.json": "<saida>/snapshot.json"}.
     Republicar só o cupons.html mantém o snapshot anterior no artifact.

A cópia vem do banco, e não de data/*.json, para levar favoritos e usados marcados
na página.
"""
import datetime
import json
import pathlib
import sys

ORDEM = {"poa-em-dobro": 0, "tour-grande-poa": 1, "canoas-em-dobro": 2}


def main(src: str, out: str) -> None:
    cupons = []
    for f in sorted(pathlib.Path(src).glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        doc["id"] = f.stem
        cupons.append(doc)
    if not cupons:
        sys.exit(f"nenhum cupom em {src}")
    cupons.sort(key=lambda c: (ORDEM.get(c.get("programa"), 9), c.get("ordem") or 999))
    data = {"geradoEm": datetime.date.today().isoformat(), "cupons": cupons}
    pathlib.Path(out).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(cupons)} cupons em {out} ({pathlib.Path(out).stat().st_size // 1024} KB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
