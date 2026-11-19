#!/usr/bin/env python3
"""Converte os endereços das unidades dos cupons em coordenadas (OpenStreetMap / Nominatim).

Uso: python3 scripts/geocodificar.py [data/geo.json] [--refazer bairro|cidade]

--refazer bairro consulta de novo os endereços que ficaram só com o centro do bairro (ou da cidade)
e troca quando acha coisa melhor (rua ou endereço).

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
Grafias do app que diferem do mapa ficam em CORRECOES. O nome da rua é limpo antes (normaliza_rua):
sem " - lado par/ímpar" e com abreviações por extenso (Av. -> Avenida, Estr. -> Estrada, Dr. -> Doutor).
Na etapa 3, ruas longas voltam em vários trechos: fica o trecho mais perto do centro do bairro; se ainda
ficar longe, tenta o nome sem o tipo de via (o mapa às vezes troca "Avenida" por "Rua" no meio do caminho).
"""
import glob, json, math, re, sys, time, unicodedata, urllib.parse, urllib.request

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SAIDA = ARGS[0] if ARGS and not ARGS[0] in ("bairro", "cidade") else "data/geo.json"
REFAZER = set()
if "--refazer" in sys.argv:
    i = sys.argv.index("--refazer")
    REFAZER = {"bairro", "cidade"} if sys.argv[i + 1:i + 2] == ["bairro"] else {sys.argv[i + 1]} if len(sys.argv) > i + 1 else set()
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


ABREVIACOES = [(r"^Av\.?\s+", "Avenida "), (r"^Estr\.?\s+", "Estrada "), (r"^R\.\s+", "Rua "),
               (r"\bDr\.?\s+", "Doutor "), (r"\bProf\.?\s+", "Professor "), (r"\bCel\.?\s+", "Coronel "), (r"\bTen\.?\s+", "Tenente ")]


def normaliza_rua(rua):
    """'Rua Miguel Tostes - lado ímpar' -> 'Rua Miguel Tostes'; 'Av. Dr. X' -> 'Avenida Doutor X'"""
    r = re.sub(r"\s*-\s*lado\s+(par|ímpar|impar)\b.*$", "", rua, flags=re.I).strip(" ,")
    for de, para in ABREVIACOES:
        r = re.sub(de, para, r)
    return re.sub(r"\s+", " ", r).strip()


# grafia do app -> grafia do OpenStreetMap
CORRECOES = {
    "Avenida Venâcio Aires": "Avenida Venâncio Aires",
    "Rua Ildo Menegueti": "Rua Ildo Meneghetti",
    "Avenida das Nações Unidas": "Avenida Nações Unidas",
}

ultima = 0.0


def busca(**params):
    """primeiro resultado: {"lat", "lng", "end"} (end = partes do endereço), ou None"""
    res = busca_varios(**params)
    return res[0] if res else None


def busca_varios(limite=1, **params):
    """até `limite` resultados (trechos diferentes de uma mesma rua longa com dedupe=0)"""
    global ultima
    espera = 1.1 - (time.time() - ultima)
    if espera > 0:
        time.sleep(espera)
    q = {"format": "jsonv2", "limit": limite, "countrycodes": "br", "viewbox": VIEWBOX, "bounded": 1, "addressdetails": 1, **params}
    if limite > 1:
        q["dedupe"] = 0
    req = urllib.request.Request("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ultima = time.time()
                res = json.load(r)
                return [{"lat": float(x["lat"]), "lng": float(x["lon"]), "end": x.get("address", {})} for x in res]
        except Exception as e:  # rede instável: espera e tenta de novo
            ultima = time.time()
            print("  erro:", e, file=sys.stderr)
            time.sleep(5 * (tentativa + 1))
    return []


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
        rua = normaliza_rua(rua)
        rua = CORRECOES.get(rua, rua)
        if num:
            r = busca(street=f"{num} {rua}", city=cidade, state="RS")
            if r and r["end"].get("house_number"):
                return r, "endereco"
        if bairro:
            r = busca(q=f"{rua}, {bairro}, {cidade}, RS")
            if r and no_bairro(r, bairro):
                return r, "rua"
        c = centro_bairro(bairro, cidade)
        # rua longa: vários trechos; fica o mais perto do centro do bairro
        trechos = busca_varios(limite=15, street=rua, city=cidade, state="RS") or busca_varios(limite=15, q=f"{rua}, {cidade}, RS")
        r = min(trechos, key=lambda t: km(t, c)) if trechos and c else (trechos[0] if trechos else None)
        # o mapa às vezes muda o tipo de via no meio do caminho (a Av. Dr. Sezefredo Azambuja Vieira vira
        # "Rua" no Marechal Rondon): tenta só o nome, sem Avenida/Rua/Estrada, e fica com o trecho mais perto
        nome = re.sub(r"^(Avenida|Rua|Estrada|Travessa|Alameda|Rodovia)\s+", "", rua)
        # e sem títulos ("Doutor Sezefredo..." devolve 2 trechos; "Sezefredo..." devolve os do bairro)
        sem_titulo = re.sub(r"^((Doutor|Professor|Professora|Coronel|Tenente|General|Padre|Engenheiro|Presidente)\s+)+", "", nome)
        for n in dict.fromkeys([nome, sem_titulo]):
            if not c or n == rua or (r and km(r, c) <= 1.5):
                break
            outros = busca_varios(limite=15, q=f"{n}, {cidade}, RS")
            if outros:
                melhor = min(outros, key=lambda t: km(t, c))
                if not r or km(melhor, c) < km(r, c):
                    r = melhor
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
    faltam = [k for k in unidades if k not in geo or geo[k].get("precisao") in REFAZER]
    ordem = {"endereco": 0, "rua": 1, "bairro": 2, "cidade": 3}
    print(f"{len(unidades)} endereços, {len(faltam)} para consultar", file=sys.stderr)
    for i, k in enumerate(faltam, 1):
        r, prec = geocodifica(unidades[k])
        antes = geo.get(k)
        # ao refazer, só troca quando a nova é mais precisa
        if r and (not antes or ordem[prec] < ordem.get(antes.get("precisao"), 9)):
            geo[k] = {"lat": round(r["lat"], 6), "lng": round(r["lng"], 6), "precisao": prec}
        print(f"[{i}/{len(faltam)}] {prec if r else 'NÃO ACHOU'}: {k}", file=sys.stderr)
        if i % 20 == 0 or i == len(faltam):
            json.dump(dict(sorted(geo.items())), open(SAIDA, "w"), ensure_ascii=False, indent=0)
    json.dump(dict(sorted(geo.items())), open(SAIDA, "w"), ensure_ascii=False, indent=0)


if __name__ == "__main__":
    main()
