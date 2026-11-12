# Monta detalhes a partir de um workspace (t2/t3) + correções manuais em <T>/manual.json
import json, re, sys
T=sys.argv[1]
visits=json.load(open(f'{T}/visits.json')); ex=json.load(open(f'{T}/extraido2.json')); hj=json.load(open(f'{T}/horarios.json')); SLUGS=json.load(open(f'{T}/slugs.json'))
try: MAN=json.load(open(f'{T}/manual.json'))
except FileNotFoundError: MAN={}
def lines(b): return [l.strip() for l in open(f'{T}/ocr/{b}.txt',encoding='utf-8') if l.strip()]
DK={'domingo':'dom','segunda-feira':'seg','terça-feira':'ter','quarta-feira':'qua','quinta-feira':'qui','sexta-feira':'sex','sábado':'sab'}
CID_FIX={'Gravatai':'Gravataí','Sao Leopoldo':'São Leopoldo'}
def titulo(s): 
    s=s.title()
    for a in (' Da ',' De ',' Do ',' Das ',' Dos ',' E '): s=s.replace(a,a.lower())
    return s
def uparse(ls):
    ls=[l for l in ls if not re.search(r'seu plano|Olá|válido|unidade$|^selecione',l)]
    i0=next((i for i,l in enumerate(ls[:3]) if re.fullmatch(r"[A-ZÁÉÍÓÚÂÊÔÃÕÇ' ]{3,}",l)),None)
    if i0 is None: return None
    nome=ls[i0]; rest=' '.join(ls[i0+1:]); rest=re.sub(r'\s*-?\s*(RS|Rio\s*Grande\s*do\s*Sul|Rio\s*Grande|do Sul)\s*$','',rest).strip(' -')
    p=rest.lower().rfind(nome.lower())
    if p<0: return (nome, rest, None)
    rua=rest[:p].strip(' ,'); tail=rest[p+len(nome):]
    m=re.match(r'\s*-\s*(.+)$',tail); cid=m.group(1).strip(' -') if m else None
    if cid: cid=re.sub(r'\s+',' ',cid); cid=CID_FIX.get(cid,cid)
    return (nome, rua, cid)
out={}
for vi,slug in enumerate(SLUGS):
    e=ex[vi]; m=MAN.get(slug,{})
    if 'unidade' in m: u=m['unidade']
    else:
        p=uparse(e['unidade'] or [])
        u=dict(bairro=titulo(p[0]) if p and p[0] else None, endereco=p[1] if p else None, cidade=p[2] if p else None) if p else None
    h={DK[d]:v for d,v in hj[str(vi)]['hor'].items()}
    if 'horarios' in m: h=m['horarios']
    multi=any(re.search(r'selecione|UNIDADE SELECIONADA',l) for b in visits[vi]['frames'] for l in lines(b))
    rg=m['regras'] if 'regras' in m else (e['regras_txt'] or None)
    if rg: rg=re.sub(r'\s+',' ',rg).strip(' |')
    out[slug]=dict(unidade=u, horarios=h, feriados=m.get('feriados', e['feriados']=='sim'), datasComemorativas=m.get('datasComemorativas', e['datas']=='sim'),
                   regras=rg, comodidades=m.get('comodidades', e['tags']), maisUnidades=m.get('maisUnidades', multi), titulo=e['title'])
json.dump(out,open(f'{T}/detalhes.json','w'),ensure_ascii=False,indent=1)
for s,d in out.items():
    u=d['unidade'] or {}
    print(f"{s:28} {str(u.get('bairro')):18}| {str(u.get('cidade')):14}| {u.get('endereco')} {'[+unid]' if d['maisUnidades'] else ''}")
