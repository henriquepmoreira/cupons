#!/usr/bin/env python3
"""Converte os endereços das unidades dos cupons em coordenadas (OpenStreetMap / Nominatim).

Uso: python3 scripts/geocodificar.py [data/geo.json]

Lê data/*.json, junta os endereços únicos (unidade e outrasUnidades) e grava data/geo.json:
    { "<endereco>|<bairro>|<cidade>": {"lat": -30.0, "lng": -51.2, "precisao": "endereco"|"rua"|"bairro"} }

Endereços já presentes no arquivo não são consultados de novo; rode outra vez depois de importar
cupons novos. Respeita a política do Nominatim: uma consulta por segundo, User-Agent próprio.
Tentativas, nesta ordem: rua e número; só a rua; bairro e cidade (centro do bairro).
"""
import glob, json, re, sys, time, urllib.parse, urllib.request

SAIDA = sys.argv[1] if len(sys.argv) > 1 else "data/geo.json"
UA = "cupons-carteira/1.0 (uso pessoal)"
# Grande Porto Alegre e Vale dos Sinos; resultados fora disso são descartados
VIEWBOX = "-51.75,-29.35,-50.55,-30.45"


def chave(u):
    return f"{u.get('endereco') or ''}|{u.get('bairro') or ''}|{u.get('cidade') or ''}"


def rua_numero(endereco):
    """'Avenida Praia de Belas, Nº 1181, Shopping Praia de Belas' -> ('Avenida Praia de Belas', '1181')"""
    e = re.sub(r"\s*\(.*?\)", "", endereco)
    m = re.match(r"\s*(.+?)[,\s]+(?:N[º°o]\.?|n[º°o]\.?|Número)\s*(\d+)", e)
    if m:
        return m.group(1).strip(" ,"), m.group(2)
    m = re.match(r"\s*([^,\d]+?)[,\s]+(\d+)\b", e)
    if m:
        return m.group(1).strip(" ,"), m.group(2)
    return e.split(",")[0].strip(), None


ultima = 0.0


def busca(**params):
    global ultima
    espera = 1.1 - (time.time() - ultima)
    if espera > 0:
        time.sleep(espera)
    q = {"format": "jsonv2", "limit": 1, "countrycodes": "br", "viewbox": VIEWBOX, "bounded": 1, **params}
    req = urllib.request.Request("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ultima = time.time()
                res = json.load(r)
                return (float(res[0]["lat"]), float(res[0]["lon"])) if res else None
        except Exception as e:  # rede instável: espera e tenta de novo
            ultima = time.time()
            print("  erro:", e, file=sys.stderr)
            time.sleep(5 * (tentativa + 1))
    return None


def main():
    unidades = {}
    for f in sorted(glob.glob("data/*.json")):
        if f.endswith("geo.json"):
            continue
        for c in json.load(open(f))["cupons"]:
            for u in [c.get("unidade")] + list(c.get("outrasUnidades") or []):
                if u and (u.get("endereco") or u.get("bairro")) and u.get("cidade"):
                    unidades[chave(u)] = u
    try:
        geo = json.load(open(SAIDA))
    except FileNotFoundError:
        geo = {}
    faltam = [k for k in unidades if k not in geo]
    print(f"{len(unidades)} endereços, {len(faltam)} para consultar", file=sys.stderr)
    for i, k in enumerate(faltam, 1):
        u = unidades[k]
        cidade = u["cidade"]
        r = None
        if u.get("endereco"):
            rua, num = rua_numero(u["endereco"])
            if num:
                r = busca(street=f"{num} {rua}", city=cidade, state="RS")
                prec = "endereco"
            if not r:
                r = busca(street=rua, city=cidade, state="RS")
                prec = "rua"
        if not r and u.get("bairro"):
            r = busca(q=f"{u['bairro']}, {cidade}, RS")
            prec = "bairro"
        if r:
            geo[k] = {"lat": round(r[0], 6), "lng": round(r[1], 6), "precisao": prec}
        print(f"[{i}/{len(faltam)}] {prec if r else 'NÃO ACHOU'}: {k}", file=sys.stderr)
        if i % 20 == 0 or i == len(faltam):
            json.dump(dict(sorted(geo.items())), open(SAIDA, "w"), ensure_ascii=False, indent=0)
    json.dump(dict(sorted(geo.items())), open(SAIDA, "w"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
