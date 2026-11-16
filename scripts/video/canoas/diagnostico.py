# Aponta visitas suspeitas depois do visitas.py (Canoas e Poa).
# Uso: python3 diagnostico.py <T>
# Para cada visita, lista os nomes lidos acima do botão "LER QRCODE" e os endereços distintos.
#  - dois nomes diferentes  -> provavelmente dois cupons juntos (separe os quadros em visits.json)
#  - dois endereços         -> várias unidades (ou o mesmo endereço lido de jeitos diferentes)
#  - poucos quadros, sem nome -> visita falsa (apague)
import json, re, sys, difflib, collections
T = sys.argv[1]
V = json.load(open(f'{T}/visits.json'))
ADDR = re.compile(r'((?:Rua|R\.|Avenida|Av\.?|Travessa|Praça|Largo|Estrada|Alameda)\s.{3,40}?N[ºo°]\s*\d+)')
def norm(s): return re.sub(r'\W+', '', s.lower())
for i, v in enumerate(V):
    nomes = collections.Counter(); addrs = {}
    for b in v['frames']:
        t = [l.strip() for l in open(f'{T}/ocr/{b}.txt', encoding='utf-8') if l.strip()]
        for j, l in enumerate(t):
            if re.match(r'LER QR', l, re.I):
                for x in t[max(0, j - 3):j]:
                    if len(x) > 3 and not re.search(r'compra de|ganhe|valor|igual', x, re.I): nomes[x] += 1
            m = ADDR.search(l)
            if m:
                k = norm(m.group(1))[:22]
                if not any(difflib.SequenceMatcher(None, k, o).ratio() > 0.85 for o in addrs): addrs[k] = (b, m.group(1))
    # nomes distintos que se repetem
    top = [n for n, c in nomes.most_common() if c >= 2]
    grupos = []
    for n in top:
        if not any(difflib.SequenceMatcher(None, norm(n), norm(g)).ratio() > 0.7 for g in grupos): grupos.append(n)
    flags = []
    if len(grupos) > 2: flags.append('NOMES?')
    if len(addrs) > 1: flags.append('UNIDADES/JUNTOS?')
    if len(v['frames']) < 6 and not grupos: flags.append('FALSA?')
    if flags or '-v' in sys.argv:
        print(f"{i:3} {v['frames'][0]} {len(v['frames']):3}q {' '.join(flags):18} nomes={grupos[:4]}")
        for b, a in addrs.values(): print(f"      {b} {a}")
