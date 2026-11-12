# Canoas em Dobro: agrupa os quadros de detalhe em visitas.
# Uso: python3 visitas.py <T>   (depois de preparar.sh; gera <T>/visits.json)
import json, re, sys
T = sys.argv[1]
keep = json.load(open(f'{T}/vf3-keep.json'))
def lines(b): return [l.strip() for l in open(f'{T}/ocr/{b}.txt', encoding='utf-8') if l.strip()]
LIST = re.compile(r'Total ?economizado|Busque|Todos Hamburgueria|Hamburgueria Italiano|restaurante, bairro|Carregando', re.I)
DET = re.compile(r'LER QRCODE|Dias e hor|Manh[aã]{1,2}/Tarde|Regras d|REGRAS|CUPOM V[AÁ]LIDO|Ver no mapa|Chamar Uber|estabelecimento', re.I)
seq = []
for f in keep:
    b = f.split('/')[-1][:-4]; t = lines(b); j = '\n'.join(t)
    k = 'D' if DET.search(j) and not re.search(r'Total ?economizado|Busque', j) else ('L' if LIST.search(j) else '?')
    seq.append((b, k, t))
visits = []; cur = None
for b, k, t in seq:
    if k == 'L':
        if cur: visits.append(cur); cur = None
        continue
    if k == '?' and cur is None: continue
    if cur is None: cur = {'frames': []}
    cur['frames'].append(b)
if cur: visits.append(cur)
for v in visits:
    tit = []
    for b in v['frames']:
        t = lines(b)
        for i, l in enumerate(t):
            if re.match(r'LER QR', l, re.I):
                # nome e subtítulo ficam logo acima do botão
                cand = [x for x in t[max(0, i-4):i] if len(x) > 2 and not re.search(r'compra de|ganhe|valor\.?$', x)]
                if cand: tit.append(tuple(cand[-2:]))
    v['title'] = max(set(tit), key=tit.count) if tit else ('',)
json.dump(visits, open(f'{T}/visits.json', 'w'), ensure_ascii=False, indent=0)
print(len(visits), 'visitas')
for i, v in enumerate(visits): print(i, v['frames'][0][2:], len(v['frames']), ' | '.join(v['title']))
