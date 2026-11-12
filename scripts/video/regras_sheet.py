import json, re, os, sys
from PIL import Image, ImageDraw, ImageFont
T=sys.argv[1]
visits=json.load(open(f'{T}/visits.json')); sl=json.load(open(f'{T}/slugs.json'))
def tsv(b):
    rows=[r.split('\t') for r in open(f'{T}/ocr/{b}.tsv').read().splitlines()[1:]]
    return [dict(t=int(r[7]),txt=r[11].strip()) for r in rows if len(r)>=12 and r[11].strip()]
font=ImageFont.load_default(size=16); tiles=[]; none=[]
for vi,v in enumerate(visits):
    best=None
    for b in v['frames']:
        W=tsv(b)
        rg=[w['t'] for w in W if w['txt'].upper().startswith('REGRAS') and 130<w['t']<1250]
        if not rg: continue
        y=rg[0]; fer=[w['t'] for w in W if w['txt'].startswith(('Feriados','Datas','comemorativas')) and w['t']>y]
        end=fer[0] if fer else 1300
        cand=(end<1300, -y, b, y, end)
        if best is None or cand>best: best=cand
    if not best: none.append(f'#{vi} {sl[vi]}'); continue
    _,_,b,y,end=best
    im=Image.open(f'{T}/vf3/{b}.jpg').crop((90,y-10,720,min(1300,end+5))); im=im.resize((int(im.width*0.7),int(im.height*0.7)))
    d=ImageDraw.Draw(im); lab=f'#{vi} {sl[vi]}'; d.rectangle([0,0,9*len(lab),18],fill=(255,230,0)); d.text((2,1),lab,fill=0,font=font); tiles.append(im)
print('sem bloco de regras:',none)
W=max(t.width for t in tiles); cols=4; col_h=[0]*cols; placed=[]; page=0
def flush(placed,page):
    H=max(y+t.height for t,x,y in placed)
    S=Image.new('RGB',(cols*(W+6),H),(60,60,60))
    for t,x,y in placed: S.paste(t,(x,y))
    S.save(f'{T}/sheets/regras-{page}.jpg',quality=86); print(f'{T}/sheets/regras-{page}.jpg',S.size)
for t in tiles:
    c=col_h.index(min(col_h))
    if col_h[c]+t.height>1900: flush(placed,page); page+=1; placed=[]; col_h=[0]*cols; c=0
    placed.append((t,c*(W+6),col_h[c])); col_h[c]+=t.height+6
flush(placed,page)
