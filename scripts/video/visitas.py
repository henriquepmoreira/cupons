import json, re, difflib, sys
import sys
SP = sys.argv[1]  # pasta de trabalho (vf3/, ocr/, visits.json...)
seq=json.load(open(f'{SP}/seq.json'))
def lines(b):
    return [l.strip() for l in open(f'{SP}/ocr/{b}.txt',encoding='utf-8') if l.strip()]
NOISE=re.compile(r'^(Olá, Henrique!?|seu plano est[aá] ativo|Home|Vouchers|Mapa|Meu Tour|.*Home.*Vouchers.*)$',re.I)
visits=[]; cur=None
for b,k,t in seq:
    if k=='L':
        if cur: visits.append(cur); cur=None
        continue
    if cur is None: cur={'frames':[], 'titles':[]}
    cur['frames'].append(b)
    if k=='D': cur['titles'].append(t)
if cur: visits.append(cur)
def norm(s): return re.sub(r'\W+','',s.lower())
for v in visits:
    merged=[]
    for b in v['frames']:
        for l in lines(b):
            if NOISE.match(l) or re.match(r'^\d{1,2}:\d{2}',l) and len(l)<12: continue
            n=norm(l)
            if not n: continue
            if any(n==norm(m) or (len(n)>8 and difflib.SequenceMatcher(None,n,norm(m)).ratio()>0.9) for m in merged[-80:]): continue
            merged.append(l)
    v['merged']=merged
    ts=[t for t in v['titles'] if len(t)>5 and 'procure' not in t and not t.startswith('Na compra')]
    v['title']=max(set(ts), key=lambda x:(ts.count(x),len(x))) if ts else ''
json.dump(visits,open(f'{SP}/visits.json','w'),ensure_ascii=False,indent=0)
print(len(visits))
for i,v in enumerate(visits): print(i, v['frames'][0][2:], len(v['frames']), v['title'])
