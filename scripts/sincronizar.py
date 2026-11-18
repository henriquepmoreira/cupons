#!/usr/bin/env python3
"""Compara o banco do artifact com data/*.json e prepara a sincronização nos dois sentidos.

Quem manda em cada campo:
  - favorito, usado, usadoEm: a página (banco) -> vão para os arquivos com --marcas-para-arquivos;
  - todo o resto: os arquivos (data/*.json) -> viram patches de "update" para o banco.

Uso:
  1. Exporte o banco: ArtifactData action "list", collection "cupons", query {"limit": 1000},
     out_dir <pasta>  (cria <pasta>/cupons/<id>.json).
  2. python3 scripts/sincronizar.py <pasta>/cupons [--marcas-para-arquivos] [--saida <dir>]
     - imprime as diferenças;
     - com --marcas-para-arquivos, grava favorito/usado/usadoEm do banco nos data/*.json
       (no formato de um cupom por linha);
     - grava em <dir> (padrão: <pasta>/../sincronizar) um patch por cupom (<id>.json, só os
       campos que mudam) e writes.json, a lista para um "batch" do ArtifactData.
  3. Para gravar: leia a versão atual de cada cupom de writes.json (ArtifactData "get";
     a exportação não traz versões), ponha "if_version" em cada entrada e rode o batch
     (até 50 por vez). Nunca use "set" num cupom que já existe.

Cupons que existem só nos arquivos são novos: crie com scripts/gerar-seed.py. Cupons que
existem só no banco são listados para conferência (não são apagados).
"""
import argparse
import glob
import json
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MARCAS = ("favorito", "usado", "usadoEm")
IGNORAR = {"slug", "programa"}  # o slug vira o id; programa vem do arquivo


def salva(path, d):
    """mesmo formato dos data/*.json: um cupom por linha"""
    lines = ",\n".join("    " + json.dumps(c, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }') for c in d["cupons"])
    head = {k: v for k, v in d.items() if k != "cupons"}
    out = "{\n" + "".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},\n" for k, v in head.items()) + '  "cupons": [\n' + lines + "\n  ]\n}\n"
    pathlib.Path(path).write_text(out, encoding="utf-8")


def vazio(v):
    return v is None or v is False


def igual(campo, a, b):
    # no arquivo, usado/usadoEm/pendente só aparecem quando têm valor; no banco vêm false/null
    if campo in ("usado", "usadoEm", "pendente") and vazio(a) and vazio(b):
        return True
    return a == b


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("banco", help="pasta com <id>.json exportados do banco")
    ap.add_argument("--marcas-para-arquivos", action="store_true", help="grava favorito/usado/usadoEm do banco nos data/*.json")
    ap.add_argument("--saida", help="pasta dos patches (padrão: <banco>/../sincronizar)")
    ap.add_argument("--dados", default=str(RAIZ / "data"), help="pasta dos <programa>.json (padrão: data/)")
    a = ap.parse_args()

    banco = {pathlib.Path(f).stem: json.loads(pathlib.Path(f).read_text(encoding="utf-8")) for f in glob.glob(str(pathlib.Path(a.banco) / "*.json"))}
    if not banco:
        sys.exit(f"nenhum documento em {a.banco}")
    saida = pathlib.Path(a.saida) if a.saida else pathlib.Path(a.banco).resolve().parent / "sincronizar"

    arquivos, vistos, patches, marcas = {}, set(), {}, []
    for f in sorted(glob.glob(str(pathlib.Path(a.dados) / "*.json"))):
        if f.endswith("geo.json"):
            continue
        d = json.loads(pathlib.Path(f).read_text(encoding="utf-8"))
        arquivos[f] = d
        for c in d["cupons"]:
            id_ = f"{d['programa']}--{c['slug']}"
            vistos.add(id_)
            b = banco.get(id_)
            if b is None:
                print(f"SÓ NO ARQUIVO (cupom novo, use gerar-seed.py): {id_}")
                continue
            for k in MARCAS:
                if not igual(k, c.get(k), b.get(k)):
                    marcas.append((id_, k, c.get(k), b.get(k)))
                    if a.marcas_para_arquivos:
                        if k in ("usado", "usadoEm") and vazio(b.get(k)):
                            c.pop(k, None)  # o arquivo só guarda usado quando é true
                        else:
                            c[k] = b.get(k)
            patch = {}
            for k in set(c) | set(b):
                if k in IGNORAR or k in MARCAS:
                    continue
                if k not in c:
                    if k not in ("pendente",):  # campos que o seed cria e o arquivo omite
                        print(f"  aviso: {id_}: campo '{k}' só no banco (não é apagado)")
                    continue
                if not igual(k, c.get(k), b.get(k)):
                    patch[k] = c[k]
            if patch:
                patches[id_] = patch

    for id_ in sorted(set(banco) - vistos):
        print(f"SÓ NO BANCO (confira): {id_}")

    print(f"\nMarcas diferentes (banco -> arquivo): {len(marcas)}")
    for id_, k, arq, bd in marcas:
        print(f"  {id_}: {k} arquivo={arq!r} banco={bd!r}")
    if a.marcas_para_arquivos and marcas:
        for f, d in arquivos.items():
            salva(f, d)
        print("  gravadas nos data/*.json")

    print(f"\nCupons com campos a gravar no banco (arquivo -> banco): {len(patches)}")
    saida.mkdir(parents=True, exist_ok=True)
    for old in saida.glob("*.json"):
        old.unlink()
    writes = []
    for id_, p in sorted(patches.items()):
        print(f"  {id_}: {', '.join(sorted(p))}")
        caminho = saida / f"{id_}.json"
        caminho.write_text(json.dumps(p, ensure_ascii=False, indent=1), encoding="utf-8")
        writes.append({"op": "update", "collection": "cupons", "doc_id": id_, "file_path": str(caminho), "if_version": None})
    (saida / "writes.json").write_text(json.dumps(writes, ensure_ascii=False, indent=1), encoding="utf-8")
    if writes:
        print(f"\n{len(writes)} patches em {saida} (writes.json sem if_version: leia as versões antes do batch)")
    else:
        print("\nBanco e arquivos iguais nos campos que vêm dos arquivos.")


if __name__ == "__main__":
    main()
