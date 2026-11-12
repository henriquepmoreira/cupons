import json, re, subprocess, collections, os, sys
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
import sys
SP = sys.argv[1]  # pasta de trabalho (vf3/, ocr/, visits.json...)
visits=json.load(open(f'{SP}/visits.json')); ex=json.load(open(f'{SP}/extraido2.json'))
env=dict(os.environ, OMP_THREAD_LIMIT='1')
sys.path.insert(0,f'{SP}/tools')
DAYS=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']
DRE=re.compile(r'(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)[-\w]*\s+(.*)',re.I)
HFULL=re.compile(r'^\d{2}:\d{2} - \d{2}:\d{2}(; \d{2}:\d{2} - \d{2}:\d{2})*$')
def clean_h(s):
    s=s.replace('—','-').replace('–','-').replace(',',';')
    s=re.sub(r'\s*-\s*',' - ',s); s=re.sub(r'\s*;\s*','; ',s); s=s.strip(' .|')
    s=re.sub(r'(^|; |- )[17]?1:(\d\d)',lambda m:m.group(1)+'11:'+m.group(2),s) if re.search(r'(^|; |- )71?:',s) else s
    s=re.sub(r'(^|; |- )1:(\d\d)',lambda m:m.group(1)+'11:'+m.group(2),s)
    s=re.sub(r'(^|; |- )(\d):(\d\d)',lambda m:f'{m.group(1)}0{m.group(2)}:{m.group(3)}',s)
    return s
def lines(b): return [l.strip() for l in open(f'{SP}/ocr/{b}.txt',encoding='utf-8') if l.strip()]
def ocr2x(b):
    img=Image.open(f'{SP}/vf3/{b}.jpg').crop((40,330,700,1290)); img=img.resize((img.width*2,img.height*2))
    p=f'/dev/shm/h_{b}.png'; img.save(p)
    t=subprocess.run(['tesseract',p,'-','-l','por','--psm','6'],capture_output=True,text=True,env=env).stdout
    os.remove(p); return t
jobs=[]
for vi,v in enumerate(visits):
    for b in v['frames']:
        L=' '.join(lines(b)).lower()
        if re.search(r'domingo|feira|s[aá]bado|dias e hor',L): jobs.append((vi,b))
with ThreadPoolExecutor(4) as ex_: outs=list(ex_.map(lambda j: ocr2x(j[1]), jobs))
per=collections.defaultdict(list)
for (vi,b),t in zip(jobs,outs): per[vi].append((b,t))
TAGRE=re.compile(r'Consumo no local|Acessibilidade|Estacionamento|Pet Friendly|Op[cç][oõ]es|Take Away|Espa[cç]o Kids|Compartilhar',re.I)
res={}
for vi in range(len(visits)):
    votes=collections.defaultdict(collections.Counter); complete=None
    for b,t in per.get(vi,[]):
        tl=[l for l in t.splitlines() if l.strip()]
        days={}
        for l in tl:
            m=DRE.search(l)
            if m and re.search(r'\d',m.group(2)):
                d=m.group(1).lower()[:3]; h=clean_h(m.group(2)); days[d]=h; votes[d][h]+=1
        txt=' '.join(tl)
        hi=txt.upper().find('DIAS E HOR'); ti=max((m.start() for m in TAGRE.finditer(txt)),default=-1)
        if hi>=0 and ti>hi and days: complete=(b,sorted(days))
    hor={}
    for d in DAYS:
        c=votes.get(d[:3])
        if not c: continue
        good=[h for h,_ in c.most_common() if HFULL.match(h)]
        hor[d]=good[0] if good else c.most_common(1)[0][0]+' (?)'
    res[vi]=dict(hor=hor, complete=complete)
json.dump(res,open(f'{SP}/horarios.json','w'),ensure_ascii=False,indent=1)
for vi in range(len(visits)):
    a=ex[vi]['horarios']; b=res[vi]['hor']; c=res[vi]['complete']
    diff='' if a==b else ' DIF'
    flag=''
    if c and set(d[:3] for d in b)!=set(c[1]): flag=' INCOMPLETO?'
    if not c: flag=' sem-quadro-completo'
    print(f"#{vi} {ex[vi]['title'][:28]:28} {' '.join(d[:3] for d in b)}{diff}{flag}  {'; '.join(f'{d[:3]} {h}' for d,h in b.items() if '(?)' in h)}")
