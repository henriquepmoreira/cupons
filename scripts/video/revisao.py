import json, re, subprocess, os, sys
from PIL import Image, ImageDraw, ImageFont
from concurrent.futures import ThreadPoolExecutor
T=sys.argv[1]; NP=int(sys.argv[2]) if len(sys.argv)>2 else 4
visits=json.load(open(f'{T}/visits.json')); sl=json.load(open(f'{T}/slugs.json'))
env=dict(os.environ, OMP_THREAD_LIMIT='1')
DW=re.compile(r'^(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)',re.I)
def tsv(b):
    cache=f'{T}/ocr/{b}.tsv'
    if not os.path.exists(cache):
        out=subprocess.run(['tesseract',f'{T}/vf3/{b}.jpg','-','-l','por','--psm','4','tsv'],capture_output=True,text=True,env=env).stdout
        open(cache,'w').write(out)
    rows=[r.split('\t') for r in open(cache).read().splitlines()[1:]]
    return [dict(t=int(r[7]),txt=r[11].strip()) for r in rows if len(r)>=12 and r[11].strip()]
jobs=[(vi,b) for vi,v in enumerate(visits) for b in v['frames']]
with ThreadPoolExecutor(NP) as ex: R=list(ex.map(lambda j: tsv(j[1]), jobs))
info={}
for (vi,b),W in zip(jobs,R):
    fer=[w['t'] for w in W if w['txt'].startswith('Feriados') and 140<w['t']<1290]
    days=[w['t'] for w in W if DW.match(w['txt']) and 140<w['t']<1290]
    tags=[w['t'] for w in W if re.match(r'(Consumo|Acessibilidade|Pet|Estacionamento|Op[cç]|Aceita|Espa[cç]o)',w['txt']) and 140<w['t']<1290]
    info.setdefault(vi,[]).append(dict(b=b,fer=fer[0] if fer else None,days=days,tags=tags))
tiles=[]
font=ImageFont.load_default(size=16)
for vi in range(len(visits)):
    L=info.get(vi,[])
    # quadro que mostra Feriados + mais dias; senão dois quadros
    def score(x): return (x['fer'] is not None)*10+len(x['days'])+(1 if x['tags'] and x['days'] and max(x['tags'])>max(x['days']) else 0)
    best=max(L,key=score) if L else None
    crops=[]
    if best:
        top=(best['fer'] if best['fer'] is not None else (min(best['days'])-60 if best['days'] else 300))-25
        bot=(max(best['tags'])+45) if best['tags'] else ((max(best['days'])+45) if best['days'] else top+700)
        crops.append((best['b'],max(140,top),min(1300,bot)))
        alld=max(L,key=lambda x:(len(x['days']), bool(x['tags'])))
        if len(alld['days'])>len(best['days']) or (best['fer'] is None):
            ff=[x for x in L if x['fer'] is not None]
            if ff and best['fer'] is None:
                f=ff[0]; crops.insert(0,(f['b'],max(140,f['fer']-25),min(1300,f['fer']+330)))
            elif alld['b']!=best['b'] and alld['days']:
                crops.append((alld['b'],max(140,min(alld['days'])-70),min(1300,(max(alld['tags'])+45) if alld['tags'] else max(alld['days'])+45)))
    if not crops: crops=[(visits[vi]['frames'][len(visits[vi]['frames'])//2],140,1300)]
    for b,y0,y1 in crops:
        if y1-y0<40: y1=min(1300,y0+400)
        im=Image.open(f'{T}/vf3/{b}.jpg').crop((0,y0,720,y1)); im=im.resize((int(im.width*0.6),int(im.height*0.6)))
        d=ImageDraw.Draw(im); lab=f'#{vi} {sl[vi]} {b[2:]}'; d.rectangle([0,0,9*len(lab),19],fill=(255,230,0)); d.text((2,1),lab,fill=0,font=font); tiles.append(im)
W=max(t.width for t in tiles); cols=4; col_h=[0]*cols; placed=[]; page=0
os.makedirs(f'{T}/sheets',exist_ok=True)
def flush(placed,page):
    H=max(y+t.height for t,x,y in placed)
    S=Image.new('RGB',(cols*(W+6),H),(60,60,60))
    for t,x,y in placed: S.paste(t,(x,y))
    S.save(f'{T}/sheets/rev-{page}.jpg',quality=86); print(f'{T}/sheets/rev-{page}.jpg',S.size)
for t in tiles:
    c=col_h.index(min(col_h))
    if col_h[c]+t.height>1900:
        flush(placed,page); page+=1; placed=[]; col_h=[0]*cols; c=0
    placed.append((t,c*(W+6),col_h[c])); col_h[c]+=t.height+6
flush(placed,page)
