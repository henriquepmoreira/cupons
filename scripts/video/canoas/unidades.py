# Folha com o cartão de cada unidade de um cupom (endereço + tabela de horários + etiquetas).
# Uso: python3 unidades.py <T> <slug>  -> <T>/sheets/u-<slug>.jpg
import json, re, sys, difflib
from PIL import Image, ImageDraw, ImageFont
T, slug = sys.argv[1], sys.argv[2]
V = json.load(open(f'{T}/visits.json')); SL = json.load(open(f'{T}/slugs.json'))
v = V[SL.index(slug)]
def tsv(b):
    rows = [r.split('\t') for r in open(f'{T}/ocr/{b}.tsv').read().splitlines()[1:]]
    return [dict(t=int(r[7]), txt=r[11].strip(), ln=(r[2], r[3], r[4])) for r in rows if len(r) >= 12 and r[11].strip()]
seen = {}; tiles = []
for b in v['frames']:
    W = tsv(b); lines = {}
    for w in W: lines.setdefault(w['ln'], []).append(w)
    for ws in lines.values():
        s = ' '.join(w['txt'] for w in ws); y = ws[0]['t']
        if re.search(r'N[ºo°]\s*\d', s) and 150 < y < 1300:
            k = re.sub(r'\W+', '', s.lower())[:30]
            # escolhe o quadro em que o endereço está mais alto (tabela inteira visível)
            m = next((o for o in seen if difflib.SequenceMatcher(None, k, o).ratio() > 0.8), None)
            dom = any(w['txt'].startswith('Doming') and y+150 < w['t'] < y+480 for w in W)
            if not dom: continue
            if m is None or y < seen[m][1]:
                if m: del seen[m]
                seen[k] = (b, y, s)
f = ImageFont.load_default(size=18)
for k, (b, y, s) in sorted(seen.items(), key=lambda x: (x[1][0], x[1][1])):
    im = Image.open(f'{T}/vf3/{b}.jpg').crop((0, max(0, y-60), 720, min(1560, y+620)))
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 90, 20], fill=(255, 230, 0)); d.text((2, 1), b[2:], fill=0, font=f)
    tiles.append(im); print(b, y, s)
cols = 3; rows = (len(tiles)+cols-1)//cols; H = max(t.height for t in tiles)
S = Image.new('RGB', (cols*724, rows*(H+4)), (90, 90, 90))
for i, t in enumerate(tiles): S.paste(t, ((i % cols)*724, (i//cols)*(H+4)))
S.save(f'{T}/sheets/u-{slug}.jpg', quality=85); print(f'{T}/sheets/u-{slug}.jpg', S.size)
