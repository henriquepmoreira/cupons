# Canoas em Dobro: folhas de conferência (cabeçalho, unidade, horários, feriados, etiquetas e regras de cada visita).
# Uso: python3 folhas.py <T>  -> <T>/sheets/canoas-*.jpg e regras-*.jpg
import json, re, os, sys
from PIL import Image, ImageDraw, ImageFont
T = sys.argv[1]
V = json.load(open(f'{T}/visits.json')); SL = json.load(open(f'{T}/slugs.json'))
def tsv(b):
    rows = [r.split('\t') for r in open(f'{T}/ocr/{b}.tsv').read().splitlines()[1:]]
    return [dict(l=int(r[6]), t=int(r[7]), txt=r[11].strip()) for r in rows if len(r) >= 12 and r[11].strip()]
font = ImageFont.load_default(size=18)
def crop(b, y0, y1, lab, x0=0):
    im = Image.open(f'{T}/vf3/{b}.jpg').crop((x0, max(0, y0), 720, min(1560, y1)))
    im = im.resize((int(im.width*0.62), int(im.height*0.62)))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 10*len(lab), 20], fill=(255, 230, 0)); d.text((2, 1), lab, fill=0, font=font)
    return im
tiles = []; rtiles = []
def cab_frame(v):
    # primeiro quadro com o botão LER QRCODE na posição de abertura (y ~ 950-1000)
    for b in v['frames'][:8]:
        if any(w['txt'].upper().startswith(('QRCODE', 'QRCO')) and 930 < w['t'] < 1010 for w in tsv(b)): return b
    return v['frames'][1] if len(v['frames']) > 1 else v['frames'][0]
for vi, v in enumerate(V):
    lab = f'#{vi} {SL[vi]}'
    best = {}
    for b in v['frames']:
        W = tsv(b)
        def y(pred, lo=140, hi=1480):
            ys = [w['t'] for w in W if pred(w['txt']) and lo < w['t'] < hi]; return ys[0] if ys else None
        qr = y(lambda t: t.upper().startswith('QRCODE')); di = y(lambda t: t == 'Dias'); fe = y(lambda t: t.startswith('Feriados'))
        ub = y(lambda t: t in ('Uber', 'mapa')); rg = y(lambda t: t == 'Regras' or t.startswith('Regras'), 140, 1300)
        if di and fe and 'tab' not in best: best['tab'] = (b, di, fe)
        if ub and ('ub' not in best or ub < best['ub'][1]): best['ub'] = (b, ub)
        if rg is not None and 'rg' not in best: best['rg'] = (b, rg)
    parts = []
    # cabeçalho (nome + categorias do app): posição fixa no quadro de abertura, antes de rolar
    hb = cab_frame(v)
    if hb: parts.append(crop(hb, 770, 900, lab + ' cab'))
    if 'tab' in best: b, a, f = best['tab']; parts.append(crop(b, a-10, f+60, lab + ' tab'))
    if 'ub' in best: b, u = best['ub']; parts.append(crop(b, u-15, u+190, lab + ' etiq'))
    if not parts: parts.append(crop(v['frames'][0], 140, 1300, lab))
    tiles += parts
    if 'rg' in best:
        b, r = best['rg']
        rtiles.append(crop(b, r-10, r+900, lab + ' regras'))
def pack(ts, name):
    W = max(t.width for t in ts); cols = 4; col_h = [0]*cols; placed = []; page = 0
    def flush(placed, page):
        H = max(y+t.height for t, x, y in placed); S = Image.new('RGB', (cols*(W+6), H), (60, 60, 60))
        for t, x, y in placed: S.paste(t, (x, y))
        p = f'{T}/sheets/{name}-{page}.jpg'; S.save(p, quality=85); print(p, S.size)
    for t in ts:
        c = col_h.index(min(col_h))
        if col_h[c]+t.height > 1900: flush(placed, page); page += 1; placed = []; col_h = [0]*cols; c = 0
        placed.append((t, c*(W+6), col_h[c])); col_h[c] += t.height+6
    flush(placed, page)
os.makedirs(f'{T}/sheets', exist_ok=True)
pack(tiles, 'canoas'); pack(rtiles, 'regras')
