#!/bin/bash
# Prepara uma pasta de trabalho a partir das partes do vídeo (em ordem).
# Uso: scripts/video/preparar.sh <pasta-de-trabalho> parte_00.mp4 parte_01.mp4 ...
# Gera vf3/ (quadros a 3/s), vf3-keep.json (sem repetidos), ocr/*.txt e seq.json.
set -e
T="$(realpath -m "$1")"; shift
mkdir -p "$T/vf3" "$T/ocr" "$T/sheets"
LIST="$T/concat.txt"; : > "$LIST"
for f in "$@"; do echo "file '$(realpath "$f")'" >> "$LIST"; done
ffmpeg -v error -f concat -safe 0 -i "$LIST" -vf "fps=3" -q:v 2 "$T/vf3/f_%04d.jpg"
cd "$T"
python3 - <<'PY'
from PIL import Image, ImageChops
import glob, json
fs=sorted(glob.glob('vf3/*.jpg')); keep=[]; prev=None
for f in fs:  # descarta quadros quase iguais ao anterior (área sem barra de status/abas)
    im=Image.open(f).crop((0,110,720,1290)).convert('L').resize((90,148))
    if prev is None or sum(ImageChops.difference(im,prev).histogram()[12:])>250: keep.append(f); prev=im
json.dump(keep,open('vf3-keep.json','w')); print(len(fs),'->',len(keep),'quadros')
PY
# OCR na resolução nativa, 1 thread por tesseract e 4 em paralelo (bem mais rápido que ampliar a imagem)
python3 -c "import json;print('\n'.join(json.load(open('vf3-keep.json'))))" | OMP_THREAD_LIMIT=1 xargs -P4 -I{} sh -c 'b=$(basename {} .jpg); tesseract {} ocr/$b -l por --psm 4 >/dev/null 2>&1'
python3 - <<'PY'
import json
seq=[]
for f in json.load(open('vf3-keep.json')):
    b=f.split('/')[-1][:-4]
    t=[l.strip() for l in open(f'ocr/{b}.txt',encoding='utf-8') if l.strip()]
    kind='L' if any('procure por' in l.lower() or 'perto de mim' in l.lower() for l in t) else '?'
    title=next((t[i+1] for i,l in enumerate(t[:6]) if 'plano est' in l.lower() and i+1<len(t)),'')
    if kind!='L' and title: kind='D'
    seq.append((b,kind,title))  # L = lista, D = detalhe (título logo abaixo de "seu plano está ativo")
json.dump(seq,open('seq.json','w'),ensure_ascii=False); print(len(seq),'quadros classificados')
PY
