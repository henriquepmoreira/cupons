#!/usr/bin/env python3
"""Converte os endereços das unidades dos cupons em coordenadas (OpenStreetMap / Nominatim).

Uso: python3 scripts/geocodificar.py [data/geo.json]

Lê data/*.json, junta os endereços únicos (unidade e outrasUnidades) e grava data/geo.json:
    { "<endereco>|<bairro>|<cidade>": {"lat": -30.0, "lng": -51.2, "precisao": "endereco"|"rua"|"bairro"|"cidade"} }

Endereços já presentes no arquivo não são consultados de novo; rode outra vez depois de importar
cupons novos. Respeita a política do Nominatim: uma consulta por segundo, User-Agent próprio.

O OpenStreetMap quase não tem número de casa na região: sem número, ele devolve um trecho qualquer
da rua, às vezes a quilômetros (avenidas longas). Por isso, nesta ordem:
  1. rua e número, aceito como "endereco" só se o resultado tiver o número da casa;
  2. "rua, bairro, cidade", aceito como "rua" se o resultado estiver nesse bairro;
  3. a rua sem bairro, aceita como "rua" se cair a até 1,5 km do centro do bairro (ou se o mapa não
     conhecer o bairro, quando não há como conferir);
  4. o centro do bairro ("bairro");
  5. o centro da cidade ("cidade"), para ruas e bairros que o mapa não tem.
Grafias do app que diferem do mapa ficam em CORRECOES.
"""
import glob, json, math, re, sys, time, unicodedata, urllib.parse, urllib.request

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


# grafia do app -> grafia do OpenStreetMap
CORRECOES = {
    "Rua Ildo Menegueti": "Rua Ildo Meneghetti",
    "Avenida das Nações Unidas": "Avenida Nações Unidas",
}

ultima = 0.0


def busca(**params):
    """primeiro resultado: {"lat", "lng", "end"} (end = partes do endereço), ou None"""
    global ultima
    espera = 1.1 - (time.time() - ultima)
    if espera > 0:
        time.sleep(espera)
    q = {"format": "jsonv2", "limit": 1, "countrycodes": "br", "viewbox": VIEWBOX, "bounded": 1, "addressdetails": 1, **params}
    req = urllib.request.Request("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ultima = time.time()
                res = json.load(r)
                return {"lat": float(res[0]["lat"]), "lng": float(res[0]["lon"]), "end": res[0].get("address", {})} if res else None
        except Exception as e:  # rede instável: espera e tenta de novo
            ultima = time.time()
            print("  erro:", e, file=sys.stderr)
            time.sleep(5 * (tentativa + 1))
    return None


def sem_acento(s):
    return unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode().lower().strip()


def no_bairro(r, bairro):
    """o resultado fica no bairro? compara com bairro, vizinhança e distrito do OpenStreetMap"""
    b = sem_acento(bairro)
    for k in ("suburb", "neighbourhood", "quarter", "city_district"):
        v = sem_acento(r["end"].get(k))
        if v and (v == b or v in b or b in v):
            return True
    return False


def km(a, b):
    p = math.pi / 180
    h = math.sin((b["lat"] - a["lat"]) * p / 2) ** 2 + math.cos(a["lat"] * p) * math.cos(b["lat"] * p) * math.sin((b["lng"] - a["lng"]) * p / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


centros = {}


def centro_bairro(bairro, cidade):
    k = (bairro, cidade)
    if k not in centros:
        centros[k] = busca(q=f"{bairro}, {cidade}, RS") if bairro else None
    return centros[k]


def geocodifica(u):
    cidade, bairro = u["cidade"], u.get("bairro")
    if u.get("endereco"):
        rua, num = rua_numero(u["endereco"])
        rua = CORRECOES.get(rua, rua)
        if num:
            r = busca(street=f"{num} {rua}", city=cidade, state="RS")
            if r and r["end"].get("house_number"):
                return r, "endereco"
        if bairro:
            r = busca(q=f"{rua}, {bairro}, {cidade}, RS")
            if r and no_bairro(r, bairro):
                return r, "rua"
        r = busca(street=rua, city=cidade, state="RS") or busca(q=f"{rua}, {cidade}, RS")
        c = centro_bairro(bairro, cidade)
        if r and (not bairro or not c or km(r, c) <= 1.5 or no_bairro(r, bairro)):
            return r, "rua"
        if c:
            return c, "bairro"
    else:
        c = centro_bairro(bairro, cidade)
        if c:
            return c, "bairro"
    r = centro_cidade(cidade)
    return (r, "cidade") if r else (None, None)


def centro_cidade(cidade):
    k = ("", cidade)
    if k not in centros:
        centros[k] = busca(city=cidade, state="RS")
    return centros[k]


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
        r, prec = geocodifica(unidades[k])
        if r:
            geo[k] = {"lat": round(r["lat"], 6), "lng": round(r["lng"], 6), "precisao": prec}
        print(f"[{i}/{len(faltam)}] {prec if r else 'NÃO ACHOU'}: {k}", file=sys.stderr)
        if i % 20 == 0 or i == len(faltam):
            json.dump(dict(sorted(geo.items())), open(SAIDA, "w"), ensure_ascii=False, indent=0)
    json.dump(dict(sorted(geo.items())), open(SAIDA, "w"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
