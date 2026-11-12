import json, re, subprocess, collections, difflib, os
from PIL import Image
import sys
SP = sys.argv[1]  # pasta de trabalho (vf3/, ocr/, visits.json...)
visits=json.load(open(f'{SP}/visits.json'))
env=dict(os.environ, OMP_THREAD_LIMIT='1')
def lines(b): return [l.strip() for l in open(f'{SP}/ocr/{b}.txt',encoding='utf-8') if l.strip()]
def tsv(img_path, psm=4):
    out=subprocess.run(['tesseract',img_path,'-','-l','por','--psm',str(psm),'tsv'],capture_output=True,text=True,env=env).stdout
    rows=[r.split('\t') for r in out.splitlines()[1:]]
    return [dict(l=int(r[6]),t=int(r[7]),w=int(r[8]),h=int(r[9]),txt=r[11]) for r in rows if len(r)>=12 and r[11].strip()]
def ocr(img, psm=6):
    p='/dev/shm/_cupons_crop.png'; img.save(p)
    return subprocess.run(['tesseract',p,'-','-l','por','--psm',str(psm)],capture_output=True,text=True,env=env).stdout
DAYS=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']
DRE=re.compile(r'(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)[-\w]*\s+(.*)',re.I)
HFULL=re.compile(r'^\d{2}:\d{2} - \d{2}:\d{2}(; \d{2}:\d{2} - \d{2}:\d{2})*$')
def clean_h(s):
    s=s.replace('—','-').replace('–','-').replace(' -',' -')
    s=re.sub(r'\s*-\s*',' - ',s); s=re.sub(r'\s*;\s*','; ',s); s=s.strip(' .|')
    return s
TAGS=['Acessibilidade','Estacionamento conveniado','Estacionamento gratuito','Estacionamento pago','Estacionamento próprio','Opções veganas','Opções vegetarianas','Opções sem glúten','Opções sem lactose','Consumo no local','Pet Friendly','Aceita Take Away','Espaço Kids','Wi-Fi','Delivery','Música ao vivo','Ambiente climatizado','Espaço ao ar livre']
res=[]
for vi,v in enumerate(visits):
    fr=v['frames']; L={b:lines(b) for b in fr}
    # horarios por votação
    votes=collections.defaultdict(collections.Counter)
    for b in fr:
        for l in L[b]:
            m=DRE.search(l)
            if m:
                d=m.group(1).lower()[:3]; h=clean_h(m.group(2))
                if re.search(r'\d',h): votes[d][h]+=1
    hor={}
    for d in DAYS:
        c=votes.get(d[:3])
        if not c: continue
        good=[h for h,_ in c.most_common() if HFULL.match(h)]
        hor[d]=good[0] if good else c.most_common(1)[0][0]+' (?)'
    # regras
    regras=None
    for b in fr:
        t=L[b]
        idx=[i for i,l in enumerate(t) if 'REGRAS E AVISOS' in l.upper()]
        if not idx: continue
        blk=[]
        for l in t[idx[0]+1:]:
            if re.search(r'Feriados|comemorativas|válido|DIAS E HOR|OD €|Compartilhar',l): break
            blk.append(l)
        if regras is None or len(' '.join(blk))>len(' '.join(regras)): regras=blk
    # tags
    alltxt=' '.join(' '.join(L[b]) for b in fr).lower().replace(' ','')
    tags=[t for t in TAGS if t.lower().replace(' ','')[:12] in alltxt or difflib.get_close_matches(t.lower().replace(' ',''), re.findall(r'[a-zçãéêíóúâõ\-]{6,}', alltxt), n=1, cutoff=0.85)]
    # feriados e unidade por TSV
    fer=dat=None; unidade=None
    for b in fr:
        jl=' '.join(L[b])
        if fer is None and 'Feriados' in jl and 'comemorativas' in jl:
            img=Image.open(f'{SP}/vf3/{b}.jpg').convert('RGB')
            words=tsv(f'{SP}/vf3/{b}.jpg')
            def cor(w):
                r=g=0
                for x in range(w['l']-40, w['l']+w['w']):
                    for y in range(w['t'], w['t']+w['h']):
                        if not (0<=x<img.width and 0<=y<img.height): continue
                        R,G,B=img.getpixel((x,y))
                        if R>150 and G<110 and B<110: r+=1
                        elif G>R+25 and G>90: g+=1
                return 'nao' if r>g else ('sim' if g>r else None)
            for w in words:
                if w['txt'].startswith('Feriados'): fer=cor(w)
                if w['txt'].startswith('comemorativas'): dat=cor(w)
        if unidade is None and 'válido na' in jl:
            words=tsv(f'{SP}/vf3/{b}.jpg')
            vw=[w for w in words if w['txt'].startswith('válido')]
            if vw and 250<vw[0]['t']<1250:
                y=vw[0]['t']; img=Image.open(f'{SP}/vf3/{b}.jpg')
                crop=img.crop((255,max(0,y-95),715,min(img.height,y+120))).resize((920,int((min(img.height,y+120)-max(0,y-95))*2)))
                txt=[l.strip() for l in ocr(crop).splitlines() if l.strip()]
                if txt and len(txt)>=2: unidade=txt
    res.append(dict(i=vi, title=v['title'], frames=[fr[0],fr[-1]], regras=regras, horarios=hor, tags=tags, feriados=fer, datas=dat, unidade=unidade,
                    oferta=[l for l in v['merged'] if 'compra de' in l.lower()][:1]))
json.dump(res,open(f'{SP}/extraido.json','w'),ensure_ascii=False,indent=1)
print('ok',len(res))
