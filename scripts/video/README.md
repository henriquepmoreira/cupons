# Leitura de gravações de tela (detalhes dos cupons)

Pipeline usado em 12/11/2026 para tirar regras, unidade, horários, feriados e comodidades do Tour Grande Poa de vídeos da tela de detalhe. Precisa de `ffmpeg`, `tesseract` com `por` e Pillow.

1. `preparar.sh <T> parte_*.mp4` gera quadros, OCR e `seq.json` (L = lista, D = detalhe).
2. `python3 visitas.py <T>` agrupa os quadros de detalhe em visitas (uma por abertura de cupom). **Confira a lista impressa:** a mesma tela aberta duas vezes vira duas visitas (junte os `frames` à mão em `visits.json`), e um quadro de lista mal classificado vira visita falsa (apague).
3. Crie `<T>/slugs.json`: a lista de slugs na ordem das visitas. Cupons já usados somem da lista do app, então pule-os.
4. `python3 extrair.py <T>`, `python3 extrair2.py <T>` e `python3 horarios.py <T> > <T>/horarios.txt` (o último é o mais lento: OCR 2x do bloco de horários com votação).
5. `python3 revisao.py <T>` e `python3 regras_sheet.py <T>` geram folhas em `<T>/sheets/` com unidade, feriados, horários e regras de cada visita. **Confira tudo em imagem.**
6. Correções vão em `<T>/manual.json` (`{slug: {unidade|horarios|regras|feriados|datasComemorativas|comodidades|maisUnidades: ...}}`); `python3 montar.py <T>` gera `<T>/detalhes.json`.

Armadilhas que já aconteceram: endereço com número errado (115 → 15, 1221 → 122]); bairro e cidade fora de ordem; "Delivery" detectado a partir de "Não é válido para delivery" nas regras; "Exclusivo Takeaway" não estava na lista de etiquetas; "REGRAS GERAIS DO TOUR" confundido com as regras do estabelecimento; regras não capturadas quando o bloco aparece só no fim de um quadro.

## Canoas em Dobro (`canoas/`)

A tela de detalhe do Canoas é diferente da do Tour (sem "seu plano está ativo", com tabela Manhã/Tarde × Noite e categorias abaixo do nome), por isso tem scripts próprios. O `preparar.sh` é o mesmo.

1. `preparar.sh <T> parte_*.mp4`
2. `python3 canoas/visitas.py <T>`: agrupa os quadros de detalhe. Junte à mão as aberturas repetidas em `visits.json` (em 12/11 foram 4: Las Comadres, Gran Forneria, Jaca Burguer e Be Coffee).
3. `<T>/slugs.json` na ordem das visitas.
4. `python3 canoas/extrair.py <T>`: unidade, horários, feriados e etiquetas (as etiquetas e as regras pelo OCR são pouco confiáveis).
5. `python3 canoas/folhas.py <T>`: folhas com cabeçalho (categorias do app), tabela, etiquetas e regras de cada visita. **Confira tudo em imagem.**
6. `<T>/manual.json` com `categoriasApp`, `comodidades` e `regras` transcritas das folhas; `python3 canoas/montar.py <T>` gera `<T>/detalhes.json`.

O cabeçalho às vezes fica escondido pela pílula vermelha de gravação do iOS; nesse caso, procure outro quadro da mesma visita.

Cupons com várias unidades: `python3 canoas/unidades.py <T> <slug>` gera `<T>/sheets/u-<slug>.jpg` com o cartão de cada endereço, a tabela de horários e as etiquetas logo abaixo (só usa quadros em que a tabela aparece inteira). As etiquetas podem mudar de uma unidade para outra; o OCR erra essas pílulas, então confira em imagem.
