# Canoas em Dobro: monta <T>/detalhes.json a partir de extraido.json + correções conferidas em imagem (<T>/manual.json).
# Uso: python3 montar.py <T>
import json, re, sys
T = sys.argv[1]
EX = json.load(open(f'{T}/extraido.json'))
try: MAN = json.load(open(f'{T}/manual.json'))
except FileNotFoundError: MAN = {}
RUA = re.compile(r'(Rua|Avenida|Av\.|Estrada|Travessa|Alameda|Praça|Rodovia)\b')
def unidade(card):
    s = ' '.join(card)
    m = RUA.search(s)
    if not m: return None
    s = s[m.start():]
    m = re.search(r'^(.*?)\s+-\s+([^-]+?)\s*/\s*RS\b', s)
    if not m: return None
    left, cidade = m.group(1).strip(' ,'), m.group(2).strip()
    partes = [p.strip() for p in left.split(',')]
    return dict(bairro=partes[-1], endereco=', '.join(partes[:-1]), cidade=cidade)
out = {}
for e in EX:
    m = MAN.get(e['slug'], {})
    d = dict(unidade=unidade(e['card']), horarios=e['horarios'], feriados=e['feriados'],
             # o app do Canoas só mostra o ícone de feriados; as regras gerais dizem que nenhum cupom vale em datas comemorativas
             datasComemorativas=False, regras=None, comodidades=e['comodidades'], maisUnidades=e['multi'], categoriasApp=[])
    d.update({k: v for k, v in m.items()})
    out[e['slug']] = d
json.dump(out, open(f'{T}/detalhes.json', 'w'), ensure_ascii=False, indent=1)
for s, d in out.items():
    u = d['unidade'] or {}
    print(f"{s:24} {str(u.get('bairro')):26}| {str(u.get('cidade')):18}| {u.get('endereco')}")
