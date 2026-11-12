# Canoas em Dobro: extrai os detalhes de cada visita (visits.json + slugs.json).
# Uso: python3 extrair.py <T>  -> <T>/extraido.json
import json, re, subprocess, os, sys, collections, difflib
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
T = sys.argv[1]
V = json.load(open(f'{T}/visits.json')); SL = json.load(open(f'{T}/slugs.json'))
env = dict(os.environ, OMP_THREAD_LIMIT='1')
def lines(b): return [l.strip() for l in open(f'{T}/ocr/{b}.txt', encoding='utf-8') if l.strip()]
def tsv(b):
    cache = f'{T}/ocr/{b}.tsv'
    if not os.path.exists(cache):
        open(cache, 'w').write(subprocess.run(['tesseract', f'{T}/vf3/{b}.jpg', '-', '-l', 'por', '--psm', '4', 'tsv'], capture_output=True, text=True, env=env).stdout)
    rows = [r.split('\t') for r in open(cache).read().splitlines()[1:]]
    return [dict(l=int(r[6]), t=int(r[7]), w=int(r[8]), h=int(r[9]), txt=r[11].strip(), ln=(r[2], r[3], r[4])) for r in rows if len(r) >= 12 and r[11].strip()]
def ocr(b, box, psm=6, scale=2):
    im = Image.open(f'{T}/vf3/{b}.jpg').crop(box); im = im.resize((im.width*scale, im.height*scale))
    p = f'/dev/shm/c_{b}_{box[1]}.png'; im.save(p)
    out = subprocess.run(['tesseract', p, '-', '-l', 'por', '--psm', str(psm)], capture_output=True, text=True, env=env).stdout
    os.remove(p); return [l.strip(' |') for l in out.splitlines() if l.strip(' |')]
allfr = [b for v in V for b in v['frames']]
with ThreadPoolExecutor(4) as ex: list(ex.map(tsv, allfr))
DAY = {'seg': 'seg', 'ter': 'ter', 'qua': 'qua', 'qui': 'qui', 'sex': 'sex', 'sab': 'sab', 'sáb': 'sab', 'dom': 'dom'}
DRE = re.compile(r'^\W*(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)\b(.*)', re.I)
HH = re.compile(r'(\d{1,2})[:.](\d{2})\s*[-–—~]\s*(\d{1,2})[:.](\d{2})')
def faixas(s):
    return '; '.join(f'{int(a):02d}:{b} - {int(c):02d}:{d}' for a, b, c, d in HH.findall(s))
def dkey(w):
    w = w.lower().replace('ç', 'c').replace('á', 'a')
    return {'segunda': 'seg', 'terca': 'ter', 'quarta': 'qua', 'quinta': 'qui', 'sexta': 'sex', 'sabado': 'sab', 'domingo': 'dom'}[w]
TAGS = ['Acessibilidade', 'Estacionamento conveniado', 'Estacionamento gratuito', 'Estacionamento pago', 'Opções veganas', 'Opções vegetarianas',
        'Opções sem glúten', 'Opções sem lactose', 'Consumo no local', 'Pet Friendly', 'Aceita Pet', 'Aceita Take Away', 'Exclusivo Takeaway',
        'Espaço Kids', 'Wi-Fi', 'Música ao vivo', 'Delivery']
jobs = []
def plan(vi, v):
    J = {}
    for b in v['frames']:
        W = tsv(b)
        qr = [w for w in W if w['txt'].upper().startswith('QRCODE') and 300 < w['t'] < 1400]
        if qr and qr[0]['t'] > 330 and ('head' not in J or qr[0]['t'] > J['head'][2]): J['head'] = (b, (150, qr[0]['t']-190, 720, qr[0]['t']-25), qr[0]['t'])
        di = [w for w in W if w['txt'] == 'Dias' and 150 < w['t'] < 1200]
        if di and 'card' not in J: J['card'] = (b, (90, di[0]['t']+50, 640, min(1560, di[0]['t']+230)))
        hd = [w for w in W if w['txt'].startswith('Manh') and 150 < w['t'] < 1300]
        fe = [w for w in W if w['txt'].startswith('Feriados') and 150 < w['t'] < 1500]
        if hd and fe and fe[0]['t'] > hd[0]['t'] and 'hor' not in J: J['hor'] = (b, (40, hd[0]['t']+20, 700, fe[0]['t']+45))
        ub = [w for w in W if w['txt'] in ('Uber', 'mapa') and 150 < w['t'] < 1450]
        if ub and 'chips' not in J: J['chips'] = (b, (30, ub[0]['t']+30, 700, min(1560, ub[0]['t']+140)))
    return J
res = []
plans = [plan(vi, v) for vi, v in enumerate(V)]
flat = [(vi, k, x[0], x[1]) for vi, J in enumerate(plans) for k, x in J.items()]
with ThreadPoolExecutor(4) as ex: outs = list(ex.map(lambda j: ocr(j[2], j[3]), flat))
got = collections.defaultdict(dict)
for (vi, k, b, box), o in zip(flat, outs): got[vi][k] = (b, o)
for vi, v in enumerate(V):
    g = got[vi]
    head = g.get('head', (None, []))[1]; card = g.get('card', (None, []))[1]
    # horários: tabela recortada; se faltar, votação nas linhas do OCR nativo
    hor = {}; dias_vistos = set()
    src = g.get('hor', (None, []))[1]
    if not src:
        src = [l for b in v['frames'] for l in lines(b)]
    for l in src:
        m = DRE.match(l)
        if not m: continue
        k = dkey(m.group(1)); dias_vistos.add(k)
        f = faixas(m.group(2))
        if f and k not in hor: hor[k] = f
    fer = None
    for b in v['frames']:
        for l in lines(b):
            if l.startswith('Feriados'):
                fer = False if re.search(r'N[aã]o', l) else (True if 'Aceita' in l else fer)
    blob = ' '.join(g.get('chips', (None, []))[1])
    tags = [t for t in TAGS if t.lower() in blob.lower() or difflib.get_close_matches(t.lower(), [blob.lower()[i:i+len(t)] for i in range(len(blob))], n=1, cutoff=0.85)]
    # regras do estabelecimento: junta as linhas dos quadros, sem repetir
    merged = []
    for b in v['frames']:
        for l in lines(b):
            n = re.sub(r'\W+', '', l.lower())
            if not n: continue
            if any(n == re.sub(r'\W+', '', m.lower()) or (len(n) > 10 and difflib.SequenceMatcher(None, n, re.sub(r'\W+', '', m.lower())).ratio() > 0.88) for m in merged[-60:]): continue
            merged.append(l)
    i0 = next((i for i, l in enumerate(merged) if re.search(r'Regras do estabelecimento', l, re.I)), None)
    i1 = next((i for i, l in enumerate(merged) if re.search(r'Regras de utiliza', l, re.I) and (i0 is None or i > i0)), None)
    regras = merged[i0+1:i1] if i0 is not None else None
    multi = any(re.search(r'selecione|unidade selecionada', l, re.I) for b in v['frames'] for l in lines(b))
    res.append(dict(i=vi, slug=SL[vi], head=head, card=card, horarios=hor, dias_vistos=sorted(dias_vistos), hor_frame=g.get('hor', (None,))[0],
                    feriados=fer, chips=blob, comodidades=tags, regras=regras, multi=multi))
json.dump(res, open(f'{T}/extraido.json', 'w'), ensure_ascii=False, indent=1)
for r in res:
    print(f"#{r['i']} {r['slug']:24} {' / '.join(r['head'][-2:])[:60]:60} | {' '.join(r['card'])[:110]}")
    print(f"     {r['horarios']}  fer={r['feriados']} tags={r['comodidades']} chips={r['chips'][:60]!r} multi={r['multi']}")
