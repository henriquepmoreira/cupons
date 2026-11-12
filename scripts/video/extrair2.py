import json, re, subprocess, collections, difflib, os, unicodedata
from PIL import Image
import sys
SP = sys.argv[1]  # pasta de trabalho (vf3/, ocr/, visits.json...)
visits=json.load(open(f'{SP}/visits.json')); old=json.load(open(f'{SP}/extraido.json'))
env=dict(os.environ, OMP_THREAD_LIMIT='1')
def lines(b): return [l.strip() for l in open(f'{SP}/ocr/{b}.txt',encoding='utf-8') if l.strip()]
_tsv={}
def tsv(b):
    if b not in _tsv:
        out=subprocess.run(['tesseract',f'{SP}/vf3/{b}.jpg','-','-l','por','--psm','4','tsv'],capture_output=True,text=True,env=env).stdout
        rows=[r.split('\t') for r in out.splitlines()[1:]]
        _tsv[b]=[dict(l=int(r[6]),t=int(r[7]),w=int(r[8]),h=int(r[9]),txt=r[11],line=(r[2],r[3],r[4])) for r in rows if len(r)>=12 and r[11].strip()]
    return _tsv[b]
def ocr(img, psm=6):
    p='/dev/shm/_cupons_crop.png'; img.save(p)
    return subprocess.run(['tesseract',p,'-','-l','por','--psm',str(psm)],capture_output=True,text=True,env=env).stdout
DAYS=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado']
DRE=re.compile(r'(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)[-\w]*\s+(.*)',re.I)
HFULL=re.compile(r'^\d{2}:\d{2} - \d{2}:\d{2}(; \d{2}:\d{2} - \d{2}:\d{2})*$')
def clean_h(s):
    s=s.replace('—','-').replace('–','-').replace(',',';')
    s=re.sub(r'\s*-\s*',' - ',s); s=re.sub(r'\s*;\s*','; ',s); s=s.strip(' .|')
    s=re.sub(r'(^|\s)[17]1?:(\d\d)',lambda m:m.group(1)+('11:' if m.group(0).strip().startswith(('1:','71:')) else m.group(0).strip()[:-2])+m.group(2),s)
    s=re.sub(r'(^|; |- )(\d):(\d\d)',lambda m:f'{m.group(1)}0{m.group(2)}:{m.group(3)}',s)
    return s
def norm(s): return re.sub(r'[^a-z]','',unicodedata.normalize('NFD',s.lower()).encode('ascii','ignore').decode())
TAGS=['Acessibilidade','Estacionamento conveniado','Estacionamento gratuito','Estacionamento pago','Estacionamento próprio','Opções veganas','Opções vegetarianas','Opções sem glúten','Opções sem lactose','Consumo no local','Pet Friendly','Aceita Take Away','Espaço Kids','Wi-Fi','Delivery','Música ao vivo','Ambiente climatizado','Área externa','Fraldário','Brinquedoteca']
res=[]
for vi,v in enumerate(visits):
    fr=v['frames']; L={b:lines(b) for b in fr}; o=old[vi]
    # horários: recorte do bloco em quadros onde ele aparece inteiro
    votes=collections.defaultdict(collections.Counter)
    for b in fr:
        if not any('DIAS E HOR' in l.upper() for l in L[b]): 
            for l in L[b]:
                m=DRE.search(l)
                if m and re.search(r'\d',m.group(2)): votes[m.group(1).lower()[:3]][clean_h(m.group(2))]+=1
            continue
        hw=[w for w in tsv(b) if w['txt'].upper().startswith('HOR')]
        if not hw: continue
        y=hw[0]['t']; img=Image.open(f'{SP}/vf3/{b}.jpg')
        y1=min(img.height-260, y+400)
        if y1-(y+30)<60: continue
        crop=img.crop((60,y+30,700,y1)); crop=crop.resize((crop.width*2,crop.height*2))
        for l in ocr(crop).splitlines():
            m=DRE.search(l)
            if m and re.search(r'\d',m.group(2)): votes[m.group(1).lower()[:3]][clean_h(m.group(2))]+=3
    hor={}
    for d in DAYS:
        c=votes.get(d[:3])
        if not c: continue
        good=[h for h,_ in c.most_common() if HFULL.match(h)]
        hor[d]=good[0] if good else c.most_common(1)[0][0]+' (?)'
    # unidade: palavra "válido" seguida de "na"
    cands=[]
    for b in fr:
        if not any('válido na' in l or 'valido na' in l.lower() for l in L[b]): continue
        W=tsv(b)
        for i,w in enumerate(W[:-1]):
            if w['txt'].lower().startswith(('válido','valido')) and W[i+1]['txt'].lower()=='na' and 300<w['t']<1150:
                y=w['t']; img=Image.open(f'{SP}/vf3/{b}.jpg')
                crop=img.crop((250,y-100,715,y+125)); crop=crop.resize((crop.width*2,crop.height*2))
                t=[l.strip(' |') for l in ocr(crop).splitlines() if len(l.strip(' |'))>2]
                score=len(t)+3*any(re.search(r'(RS|Sul)$',l) for l in t)+2*any(l.isupper() and len(l)>3 for l in t[:2])
                cands.append((score,t,b))
    cands.sort(key=lambda x:-x[0])
    unidade=cands[0][1] if cands else o['unidade']
    # comodidades: só tags cuja forma normalizada aparece no texto
    blob=norm(' '.join(' '.join(L[b]) for b in fr))
    tags=[]
    for t in TAGS:
        n=norm(t)
        if n in blob: tags.append(t); continue
        # tolerância a OCR: compara janelas do mesmo tamanho
        best=max((difflib.SequenceMatcher(None,n,blob[i:i+len(n)]).ratio() for i in range(0,max(1,len(blob)-len(n)),2)),default=0)
        if best>0.88: tags.append(t)
    # regras: limpa ícone de alerta
    rg=' '.join(o['regras'] or [])
    rg=re.sub(r'^(ELECIMENTO|[A-Za-zÁáÀÃ]{1,3}[\]\)|,.]*|o,|TÁ\)|E|\||\(6\)|mid|==)\s+','',rg)
    rg=re.sub(r'\s(AN|ÁN|áN|Ás|ás,|\(6\)|mid|==|\]|\|)\s',' ',rg).strip(' |')
    res.append(dict(o, horarios=hor, unidade=unidade, tags=tags, regras_txt=rg, unidade_frame=cands[0][2] if cands else None))
json.dump(res,open(f'{SP}/extraido2.json','w'),ensure_ascii=False,indent=1)
print('ok')
