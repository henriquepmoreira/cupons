#!/usr/bin/env python3
"""Gera as camadas do Google My Maps com os endereços dos cupons.

Uso: python3 scripts/gerar-mapa.py   ->  mapa/<programa>.csv (uma camada por programa)

No My Maps (google.com/maps/d): Criar mapa > Adicionar camada > Importar > escolher o
CSV > marcar a coluna "Endereço" para posicionar os marcadores > "Nome" como título.
O próprio My Maps converte os endereços em pontos; nada é enviado a outro serviço.

Entra cada unidade com endereço (a principal e as de `outrasUnidades`). Cupons sem
unidade (os usados vistos só na lista do app) ficam de fora. Os dados vêm de
data/*.json; favoritos e usados marcados só na página não aparecem aqui.
"""
import csv
import json
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PROGRAMAS = {"poa-em-dobro": "Poa em Dobro", "tour-grande-poa": "Tour Grande Poa", "canoas-em-dobro": "Canoas em Dobro"}
DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
NOME_DIA = {"seg": "seg", "ter": "ter", "qua": "qua", "qui": "qui", "sex": "sex", "sab": "sáb", "dom": "dom"}
GANHE = {"igual": "ganhe outro igual", "igual_ou_menor": "ganhe outro igual ou de menor valor"}


def endereco_busca(u):
    """Endereço limpo para a busca do Google: rua e número, bairro, cidade, RS."""
    e = re.sub(r"\(.*?\)", "", u.get("endereco") or "")
    e = re.sub(r"\s*-\s*lado (par|ímpar)", "", e)
    m = re.match(r"\s*(.*?),?\s*\bN[ºo°]\.?\s*(\d[\w/-]*|S/N|SN)\b,?\s*(.*)", e, re.I)
    rua, num, resto = (m.group(1), m.group(2), m.group(3)) if m else (e, "", "")
    rua = rua.strip(" ,")
    num = "" if num.upper() in ("S/N", "SN", "0") else num.split("/")[0].strip(" ,")
    partes = [f"{rua}, {num}" if num else rua]
    if u.get("bairro"):
        partes.append(u["bairro"])
    partes.append(f"{u.get('cidade') or 'Porto Alegre'} - RS")
    partes.append("Brasil")
    return " - ".join(partes[:2]) + ", " + ", ".join(partes[2:]), resto.strip(" ,")


def horarios_txt(h):
    if not h:
        return ""
    grupos = []
    for d in DIAS:
        if d in h:
            if grupos and grupos[-1][1] == h[d] and DIAS.index(d) == DIAS.index(grupos[-1][0][-1]) + 1:
                grupos[-1][0].append(d)
            else:
                grupos.append(([d], h[d]))
    out = []
    for ds, v in grupos:
        rotulo = NOME_DIA[ds[0]] if len(ds) == 1 else f"{NOME_DIA[ds[0]]}–{NOME_DIA[ds[-1]]}"
        out.append(f"{rotulo} {v}")
    return " | ".join(out)


def main():
    pasta = RAIZ / "mapa"
    pasta.mkdir(exist_ok=True)
    total = 0
    for prog, rotulo in PROGRAMAS.items():
        cupons = json.loads((RAIZ / "data" / f"{prog}.json").read_text(encoding="utf-8"))["cupons"]
        linhas = []
        for c in cupons:
            unidades = []
            if c.get("unidade"):
                unidades.append({**c["unidade"], "horarios": c.get("horarios")})
            unidades += c.get("outrasUnidades") or []
            for k, u in enumerate(unidades):
                busca, compl = endereco_busca(u)
                oferta = f"Na compra de {c['item']} {GANHE.get(c.get('ganhe'), 'ganhe outro igual')}." if c.get("item") else ""
                if c.get("verRegras"):
                    oferta += " (ver regras no app)"
                linhas.append({
                    "Nome": c["nome"] + (f" ({u.get('bairro')})" if len(unidades) > 1 and u.get("bairro") else ""),
                    "Endereço": busca,
                    "Endereço no app": f"{u.get('endereco') or ''} - {u.get('bairro') or ''}, {u.get('cidade') or ''}",
                    "Complemento": compl,
                    "Programa": rotulo,
                    "Oferta": oferta,
                    "Situação": "Usado" if c.get("usado") else "Disponível",
                    "Favorito": "Sim" if c.get("favorito") else "Não",
                    "Categoria": c.get("categoria") or "",
                    "Dias e horários": horarios_txt(u.get("horarios")),
                    "Unidade": f"{k + 1} de {len(unidades)}" if len(unidades) > 1 else "",
                })
        arq = pasta / f"{prog}.csv"
        with arq.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(linhas[0]))
            w.writeheader()
            w.writerows(linhas)
        total += len(linhas)
        print(f"{arq.relative_to(RAIZ)}: {len(linhas)} endereços")
    print(f"total: {total}")


if __name__ == "__main__":
    main()
