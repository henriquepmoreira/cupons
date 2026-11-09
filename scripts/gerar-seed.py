#!/usr/bin/env python3
"""Gera um JSON por cupom a partir de data/<programa>.json, no formato dos documentos
da coleção `cupons` do artifact (id = "<programa>--<slug>").

Uso: python3 scripts/gerar-seed.py data/poa-em-dobro.json <pasta-de-saida>

Cria <pasta-de-saida>/<id>.json para cada cupom e <pasta-de-saida>/writes.json com a
lista de escritas ("set") pronta para um batch no banco do artifact.
Atenção: "set" substitui o documento inteiro e zera favorito/usado com o valor do
arquivo. Para cupons que já existem no banco, prefira "update" só nos campos novos.
"""
import json
import pathlib
import sys


def main(src: str, out: str) -> None:
    data = json.loads(pathlib.Path(src).read_text(encoding="utf-8"))
    outdir = pathlib.Path(out).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    writes = []
    for cupom in data["cupons"]:
        doc = dict(cupom)
        slug = doc.pop("slug")
        doc["programa"] = data["programa"]
        doc.setdefault("pendente", None)
        doc.setdefault("usado", False)
        doc.setdefault("usadoEm", None)
        doc_id = f'{data["programa"]}--{slug}'
        path = outdir / f"{doc_id}.json"
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        writes.append({"op": "set", "collection": "cupons", "doc_id": doc_id, "file_path": str(path)})
    (outdir / "writes.json").write_text(json.dumps(writes, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(writes)} cupons gerados em {outdir}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
