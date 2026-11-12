# Transferência de sessão: Cupons em Dobro

Situação em 12/11/2026, no fim da sessão anterior. Leia este arquivo inteiro antes de mexer em dados, no banco ou na página. O `README.md` tem os detalhes de cada programa; este arquivo cobre o que é fácil deixar passar.

## 1. Onde está tudo

| o quê | onde |
|---|---|
| Repositório | `henriquepmoreira/cupons` |
| Branch com todo o trabalho | **`claude/clever-edison-q4u03f`**. O branch padrão não tem nada disso e não existe PR. Numa sessão nova, comece por `git fetch origin claude/clever-edison-q4u03f` e crie o branch da sessão a partir dele. |
| Página publicada | https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc ("Cupons em Dobro", privada, versão 6, ícone `ticket`) |
| Código da página | `cupons.html` (arquivo único, sem build) |
| Dados de origem | `data/poa-em-dobro.json`, `data/tour-grande-poa.json`, `data/canoas-em-dobro.json` |
| Gerador de documentos para o banco | `scripts/gerar-seed.py` |
| Leitura de vídeos | `scripts/video/` (instruções em `scripts/video/README.md`) |

**Estado verificado em 12/11/2026:** o banco tem os 584 documentos (280 + 203 + 101). Comparei campo a campo com os três `data/*.json`: nenhuma divergência. Depois disso, os detalhes de 70 cupons do Canoas foram gravados no arquivo e no banco (`update`, versão 1 → 2, em dois lotes de 34 e 36), com os mesmos valores. Antes do segundo lote, banco e arquivo foram comparados de novo: nenhuma divergência.

## 2. Regras que evitam estragos

1. **Favorito e usado valem o que está no banco.** A página grava `favorito`, `usado` e `usadoEm` direto no banco. Os arquivos só ficam iguais quando alguém sincroniza. Antes de editar `data/*.json` ou de gravar no banco, leia o banco (`ArtifactData` com `action: list` ou `query` e `out_dir`) e compare. Se a pessoa marcou algo na página, leve isso para o arquivo, e não o contrário.
2. **Não use `set` em documento que já existe.** O `set` troca o documento inteiro e apaga favorito ou usado marcados na página. O `gerar-seed.py` gera `set`, então só serve para cupons novos. Para mudar campos, use `update` só com os campos alterados. Para gravar muitos, use `batch` (até 50 escritas por vez, aplicadas juntas).
3. **Toda escrita precisa de `if_version`** igual à versão da última leitura. Hoje as versões variam: Poa de 1 a 8 conforme o cupom, Tour 2 ou 3, Canoas 2 (os 70 com detalhes) ou 1 (o resto). Não adivinhe, leia antes. Se a versão não bater, o batch inteiro é recusado e nada é gravado.
4. **Para republicar a página numa sessão nova:** primeiro `Artifact` com `action: read` e a URL. Depois publique com `file_path: /home/user/cupons/cupons.html` **e** `url`. Sem `url`, nasce um artifact novo, com outro link. Não passe `capabilities`: as atuais são mantidas sozinhas (`db` com regra na raiz `read: view`, `write: owner`, e `user`). Passar `{}` apaga essas permissões.
5. **Mudar o banco não exige republicar; mudar o `cupons.html` exige.**
6. **Cupons usados somem da lista do app** (aconteceu com o Don Carlone). Ao casar prints ou vídeos com a lista pela ordem, pule os usados.
7. **Dia que falta nos horários do app quer dizer que o cupom não vale nesse dia.** Conferi isso em imagem dezenas de vezes. Não complete dias faltantes.
8. **Mantenha o formato dos arquivos de dados** (um cupom por linha) para o diff continuar legível. Foi escrito assim:
   ```python
   lines = ",\n".join("    " + json.dumps(c, ensure_ascii=False).replace('{"', '{ "').replace('}', ' }') for c in d["cupons"])
   head = {k: v for k, v in d.items() if k != "cupons"}
   out = "{\n" + "".join(f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},\n' for k, v in head.items()) + '  "cupons": [\n' + lines + "\n  ]\n}\n"
   ```
9. **Git:** commits em português, com mensagem clara. Termine com as linhas de atribuição que a **nova** sessão informar; não copie o link de sessão antigo. Faça push para o branch da sessão. Não abra PR sem pedido. Não ponha identificador de modelo em commits ou arquivos.
10. **Conversa:** em português, direta. O e-mail do usuário é privado e não vai para serviços externos.

## 3. Como a página funciona

- **Conexão com o banco:** usa `window.claude.use("db")` e `collection("cupons").onSnapshot(...)`. Grava com `doc(id).update(patch)`: a tela muda na hora e o snapshot confirma depois. Há mensagens próprias para modo leitura, espaço de dados esgotado e falha de rede. Aberta fora do claude.ai, a página não tem banco e mostra um aviso.
- **`PROGRAMAS` no JS:** cada programa tem id, nome, classe de cor e cidade padrão (Poa → Porto Alegre, Tour → RS, Canoas → Canoas). Um programa novo precisa de uma entrada aqui, além do arquivo de dados.
- **Recursos:**
  - busca sem acentos, que também procura em bairro, cidade, endereço, regras e comodidades;
  - situação (Disponíveis / Usados / Todos) e favoritos;
  - filtros de programa, categoria, categoria no app (`categoriasApp`, só Canoas), tipo de benefício (`igual` ou `igual_ou_menor`), regras, "Quando", comodidades e cidade;
  - botão "Vale agora" na barra (o mesmo filtro de "Quando"), imitando o "Aberto agora" dos apps;
  - comodidades: o filtro exige todas as marcadas, e "Aceita Pet" (Canoas) e "Pet Friendly" (Tour) contam como uma só;
  - seis ordenações: app, A–Z, favoritos, categoria, programa e usados por último;
  - marcar como usado, com botão Desfazer por 6 s;
  - link "Mapa ↗", que usa o endereço da unidade quando existe;
  - tema claro e escuro.
- **Preferências:** ficam no navegador, em `localStorage`, na chave `cupons-em-dobro:prefs:v1`.
- **Detalhes de cada cupom:**
  - etiqueta "Hoje 11:30–14:30" ou "Não vale hoje", só em cupons com horários e ainda não usados;
  - painel recolhível "Regras, horários e endereço";
  - "Quando" tem três opções: Vale hoje, Vale agora e Aceita em feriados.
- **Quem tem detalhes:** o Tour inteiro e os cupons 1–71 do Canoas (até o OCA Café & Brunch, menos a Família Kabana). O Poa e o resto do Canoas não têm `unidade`, `horarios` etc., então ficam de fora de "Quando", comodidades e cidade.
- **Regras com várias linhas:** as do Canoas guardam `\n` entre os itens; a página mostra as quebras (`white-space: pre-line`).
- **Comparação de horários:** é feita como texto `HH:MM`, por isso o zero à esquerda é obrigatório. Desde a versão 5, `valeAgora` entende faixas que passam da meia-noite: Estaleiro 2 Irmãos, 18:00–04:00, conta até 04:00 do dia seguinte.
- **Partes parciais são escondidas:** `horarios: {}` não mostra tabela, e `feriados: null` não mostra os ícones (é o caso do PopCorn Gourmet).

## 4. Campos

Os campos básicos de todos os programas estão na tabela do `README.md`. Detalhes que não estão lá:

- **`horarios`:** chaves `dom`, `seg`, `ter`, `qua`, `qui`, `sex`, `sab`. Valor no formato `"11:30 - 14:30; 18:30 - 22:30"`.
- **`unidade`:** `{bairro, endereco, cidade}`. O bairro pode ser `null` (Chiquinho Novo Hamburgo). O endereço é transcrito como o app mostra: "Rua Dr. Barcelos" no Ah! Casa, "Rua Doutor Barcelos" em outros.
- **`comodidades`, na ordem usada:** Acessibilidade, Estacionamento conveniado, Estacionamento gratuito, Opções veganas, Opções vegetarianas, Opções sem glúten, Consumo no local, Pet Friendly, Aceita Take Away, Exclusivo Takeaway, Espaço Kids. A lista inclui as opções que o app tem; nem todas aparecem nos dados.
- **`usado`:** só existe no arquivo quando é `true`. No banco, o seed grava `usado: false` e `usadoEm: null`. Para comparar arquivo e banco, trate ausente, `false` e `null` como iguais.
- **Cabeçalho dos arquivos:** `programa`, `capturadoEm`, `fonte`, o resumo `detalhes` (só no Tour) e `cupons`.

## 5. Situação por programa

| programa | cupons | favoritos | usados | pendências |
|---|---|---|---|---|
| Poa em Dobro | 280 | 176 | Di Toni (sem data) | Di Toni sem oferta registrada; 15 possíveis lacunas; fim da lista e topo não confirmados; 3 nomes cortados |
| Tour Grande Poa | 203 | 126 | Don Carlone (11/11/2026) | detalhes completos, exceto o Don Carlone (usado); poucas pendências menores (abaixo) |
| Canoas em Dobro | 101 | 67 | nenhum | **lista incompleta**: termina no Grano Forneria, e Guido Café & Cia está pendente, sem oferta. Detalhes dos cupons 1–71 (menos a Família Kabana, que sumiu da lista do app) |

## 6. O que falta fazer (por prioridade)

1. **Canoas em Dobro:** mandar prints, ou um vídeo, da lista depois do Grano Forneria. O Guido Café & Cia só aparece pelo topo do card e pode haver mais cupons depois dele.
2. **Poa em Dobro:**
   - confirmar as 15 emendas com anúncio no meio (lista no README);
   - confirmar o fim, depois do Di Toni, e o topo (o card do Sabor de Luna está levemente cortado).
   - Um vídeo rolando a lista inteira resolve tudo de uma vez, como resolveu no Tour.
3. **Poa em Dobro, nomes:** completar "Machry Armazém e…", "Ponto Zero Bar e C…" e "Raw Restaurante e…". A tela de detalhe mostra o nome completo.
4. **Detalhes de Poa e do resto do Canoas:** regras, unidade, horários, feriados e comodidades vêm de vídeos da tela de detalhe. Para o Canoas, use `scripts/video/canoas/` (o layout é diferente do Tour); o próximo vídeo deve começar na Confraria 110 (cupom 72) e ir até o fim da lista, que também mostra o que vem depois do Grano Forneria. Os documentos já existem, então use `update`.
   - **Família Kabana Pizzaria:** não aparece mais na lista do app (12/11/2026) e não estava usada. Confirmar com o usuário se saiu do programa antes de apagar ou marcar.
   - **Painel "Filtros" dos apps:** nunca apareceu aberto nos vídeos. Um print dele mostraria se há filtros que a carteira ainda não tem.
5. **Tour, pendências menores:**
   - "Mark - Harmonia, R…" continua cortado, porque a tela de detalhe mostra só "Mark Hamburgueria";
   - PopCorn Gourmet - Praia de Belas só tem as regras;
   - Pallina Di Latte não tem dias e horários.
6. **Avisos com data:** várias regras do Tour citam datas que já passaram ("Dia dos Namorados", "nesse domingo 08/11"). Estão transcritas como o app mostrava em 12/11. Se o usuário mandar telas novas, atualize.
7. **Contradição no app:** o Mr. Pretzels mostra ✓ em feriados e datas comemorativas, mas a regra dele diz que não vale nesses dias. Ficou como o app mostra.

## 7. Como o usuário manda as informações

- **Prints:** lotes de imagens ou zip. Um zip de quase 30 MB passou.
- **Telas de detalhe no iOS:** o app bloqueia print nessas telas, mas **a gravação de tela funciona**. O usuário abre cada cupom em sequência e rola a tela até o fim.
- **Limite de anexo:** vídeo de 160 MB, ou 96 MB, não passa. O que funcionou foi converter no computador e dividir em partes de 90 s (cerca de 9 MB cada):
  ```
  ffmpeg -i tour.mov -vf "scale=720:-2,fps=6" -c:v libx265 -crf 30 -preset medium -tag:v hvc1 -an -force_key_frames "expr:gte(t,n_forced*90)" -f segment -segment_time 90 -reset_timestamps 1 tour_parte_%02d.mp4
  ```
  - Sem `libx265`, troque por `-c:v libx264 -crf 30`.
  - Se uma parte passar de 25 MB, use 45 s.
  - Sem computador: app Atalhos com "Codificar Mídia" em 1280×720, e cortar no app Fotos com "Salvar Vídeo como Novo Clipe".
- **Onde chegam os anexos:** em `/root/.claude/uploads/<sessão>/`, com um prefixo aleatório no nome. Ordene pelo número da parte e confira se cada parte continua a anterior.
- **Exemplo de partes salteadas:** o Tour veio em dois envios, partes 00–04 e depois 05–10. Partes podem vir em mensagens separadas.

## 8. Pipeline de vídeo (resumo)

Use `scripts/video/README.md`. Os scripts que estavam na pasta temporária da sessão anterior agora estão no repositório e foram testados de novo. Pontos que custaram tempo:

- **Velocidade do OCR:** rode na resolução nativa, com `OMP_THREAD_LIMIT=1` e 4 processos em paralelo, cerca de 0,5 s por quadro. Ampliar a imagem com várias threads ficou lento demais e precisou ser interrompido.
- **Volume:** 7,5 min de vídeo dão cerca de 1.350 quadros a 3/s. Sem os repetidos, ficam uns 1.100. O OCR leva uns 2 min. O `horarios.py` leva de 3 a 7 min e o `revisao.py` cerca de 1,5 min.
- **Visitas repetidas e falsas:**
  - a mesma tela aberta duas vezes vira duas visitas: junte em `visits.json`;
  - um quadro de lista mal classificado vira visita falsa: apague.
  - Confira a lista impressa por `visitas.py` contra a ordem do app.
- **Conferência em imagem:** a confiança vem daqui, não do OCR. As folhas de `revisao.py` e `regras_sheet.py` mostram unidade, feriados, horários, comodidades e regras de cada cupom. Na sessão anterior, uns 40 endereços e cerca de 20 regras foram corrigidos à mão em `manual.json`.
- **Erros típicos do OCR:**
  - número da rua errado (115 → 15, 1221 → 122]);
  - bairro e cidade fora de ordem;
  - "Delivery" detectado a partir de "Não é válido para delivery";
  - "REGRAS GERAIS DO TOUR" lido como regra do estabelecimento;
  - regras perdidas quando o bloco aparece só no fim de um quadro;
  - ✓/✗ escondidos pelo rótulo da folha (a leitura por cor no quadro original continua certa).
- **Mais de uma unidade:** "selecione a unidade" ou "DA UNIDADE SELECIONADA" indicam seletor. Os dados ficam da unidade mostrada primeiro, com `maisUnidades: true`.
- **Fim de cada página de detalhe:** mostra "TOUR VÁLIDO ATÉ 05/03/2027". É a validade do plano do Tour.

## 9. Ambiente

- **Ferramentas disponíveis na nuvem:** `ffmpeg`, Pillow, `node` e Chromium com Playwright. O `tesseract` **não** veio instalado na sessão de 12/11 à noite: `apt-get install -y tesseract-ocr tesseract-ocr-por` (se falhar, rode `apt-get update` antes). Sem ele, o `preparar.sh` gera os quadros mas o OCR sai vazio, sem erro.
- **Teste local da página:** o `window.claude` falso precisa de `use("user")` com `isOwner()` e `can()`, e o snapshot precisa de `metadata: { fromCache: false }`.
- **A pasta temporária (scratchpad) é apagada entre sessões.** Por isso os scripts foram para o repositório.
- **Testar a página localmente:** carregue `cupons.html` no Playwright com um `window.claude.use` falso, que devolva um objeto `collection(...)` com `onSnapshot` entregando os cupons de `data/*.json` (com `id = <programa>--<slug>` e `programa`). Esse arquivo de teste não ficou no repositório. Antes de publicar, rode `node --check` no script extraído do HTML.
- **Organização dos arquivos de trabalho:** use uma pasta por lote (por exemplo `t2/` e `t3/` na sessão anterior). Os vídeos ficam numa pasta própria, e os scripts recebem a pasta como argumento.

## 10. Fatos dos apps que ajudam

- **Tour:**
  - a lista é agrupada por tipo de estabelecimento e vai em ordem alfabética dentro de cada grupo;
  - asterisco no texto do cupom quer dizer "ver regras" (57 cupons com `verRegras: true`);
  - o mesmo restaurante pode ter vários cupons (Gran Forneria, Saúde no Copo, Chá das Três, Banca do Açaí, redes com várias unidades).
- **Poa:** os prints vieram em 7 lotes, cada um **antes** do anterior na lista. As posições estão no README.
- **Canoas:** a lista começa no Kampeki Sushi. Urban 1736 e Comidas de Boteco têm dois cupons cada.
- **Status momentâneos:** "Aberto agora / Fechado" e "ACEITA AGORA!" valem só para a hora da captura e não foram importados.
- **Categorias:** 10, deduzidas do item do cupom (lista no README).

## 11. Histórico (commits no branch)

1. `224fc30` página, dados do Poa em Dobro e gerador de seed
2. `1094b08` … `a9b0be7` mais lotes do Poa em Dobro
3. `2943b78` Di Toni marcado como usado
4. `2d4de8a` Tour Grande Poa e Canoas em Dobro (304 cupons)
5. `afece63` detalhes de 88 cupons do Tour (primeiro vídeo), painel de detalhes, filtros Quando e cidade
6. `9d1f202` detalhes de mais 113 cupons do Tour (segundo vídeo), "Exclusivo Takeaway", Vale agora depois da meia-noite
7. `42c5c3e` detalhes do Ah! Casa (dois prints)
8. `9aec061` `TRANSFERENCIA.md`, scripts de vídeo em `scripts/video/`, README atualizado
9. `0dbf2af` detalhes de 34 cupons do Canoas, `scripts/video/canoas/`, filtros de categoria no app e comodidades, botão "Vale agora"
10. (este commit) detalhes de mais 36 cupons do Canoas (Fornito a OCA Café & Brunch)
