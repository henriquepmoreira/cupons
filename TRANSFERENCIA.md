# Transferência de sessão: Cupons em Dobro

Situação em 12/11/2026, no fim da sessão anterior. Leia este arquivo inteiro antes de mexer em dados, no banco ou na página. O `README.md` tem os detalhes de cada programa; este arquivo cobre o que é fácil deixar passar.

## 1. Onde está tudo

| o quê | onde |
|---|---|
| Repositório | `henriquepmoreira/cupons` |
| Branch com todo o trabalho | **`claude/clever-edison-q4u03f`**. O branch padrão não tem nada disso e não existe PR. Numa sessão nova, comece por `git fetch origin claude/clever-edison-q4u03f` e crie o branch da sessão a partir dele. |
| Página publicada | https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc ("Cupons em Dobro", versão 40, ícone `ticket`, compartilhada como "qualquer pessoa com o link") |
| Código da página | `cupons.html` (arquivo único, sem build) |
| Dados de origem | `data/poa-em-dobro.json`, `data/tour-grande-poa.json`, `data/canoas-em-dobro.json` |
| Gerador de documentos para o banco | `scripts/gerar-seed.py` |
| Leitura de vídeos | `scripts/video/` (instruções em `scripts/video/README.md`) |

**Estado verificado em 12/11/2026:** o banco tem os 584 documentos (280 + 203 + 101). Comparei campo a campo com os três `data/*.json`: nenhuma divergência. Depois disso, os detalhes de 98 cupons do Canoas foram gravados no arquivo e no banco (`update`, versão 1 → 2, em três lotes de 34, 36 e 28), com os mesmos valores. Antes de cada lote, banco e arquivo foram comparados de novo: nenhuma divergência. O banco agora tem 586 documentos (Canoas: 103, com Paradouro Café e The West Burger criados por `set`).

## 2. Regras que evitam estragos

1. **Favorito e usado valem o que está no banco.** A página grava `favorito`, `usado` e `usadoEm` direto no banco. Os arquivos só ficam iguais quando alguém sincroniza. Antes de editar `data/*.json` ou de gravar no banco, leia o banco (`ArtifactData` com `action: list` ou `query` e `out_dir`) e compare. Se a pessoa marcou algo na página, leve isso para o arquivo, e não o contrário.
2. **Não use `set` em documento que já existe.** O `set` troca o documento inteiro e apaga favorito ou usado marcados na página. O `gerar-seed.py` gera `set`, então só serve para cupons novos. Para mudar campos, use `update` só com os campos alterados. Para gravar muitos, use `batch` (até 50 escritas por vez, aplicadas juntas).
3. **Toda escrita precisa de `if_version`** igual à versão da última leitura. Hoje as versões variam: Poa de 1 a 8 conforme o cupom, Tour 2 ou 3, Canoas 2 (os 98 com detalhes e o Guido) ou 1 (cupons criados por último). Desde 17/11 os cupons usados novos estão na versão 1 e os do Canoas que andaram de posição na 3. Não adivinhe, leia antes. Se a versão não bater, o batch inteiro é recusado e nada é gravado.
4. **Para republicar a página numa sessão nova:** primeiro `Artifact` com `action: read` e a URL. Depois publique com `file_path: /home/user/cupons/cupons.html` **e** `url`. Sem `url`, nasce um artifact novo, com outro link. Não passe `capabilities`: as atuais são mantidas sozinhas (`db` com regra na raiz `read: view`, `write: owner`, e `user`). Passar `{}` apaga essas permissões.
   **Passo a passo de cada publicação (desde 18/11/2026):**
   1. `cd tests && npm test` (página, geocodificador e sincronização).
   2. Exporte o banco (`ArtifactData` list, `query {"limit": 1000}`, `out_dir <pasta>`), rode `python3 scripts/sincronizar.py <pasta>/cupons` e confira que não sobrou diferença (marcas da página vão para os arquivos com `--marcas-para-arquivos`; campos dos arquivos viram patches para o banco).
   3. Gere a cópia sem login: `python3 scripts/gerar-snapshot.py <pasta>/cupons <saida>/snapshot.json`.
   4. Publique com `files: {"geo.json": "data/geo.json", "snapshot.json": "<saida>/snapshot.json"}`.
   5. **Site do GitHub Pages:** `python3 scripts/gerar-site.py <pasta>/cupons` (mesma exportação) e commit de `docs/`. O Pages só publica o branch escolhido em Settings → Pages; se não for o branch da sessão, o `docs/` novo precisa chegar até ele (PR para o branch padrão, com pedido do usuário). Publicar só o `cupons.html` mantém os arquivos anteriores no artifact, e a cópia sem login fica para trás.
5. **Mudar o banco não exige republicar; mudar o `cupons.html` exige.**
   **Autorização permanente (18/11/2026):** o usuário autorizou republicar a página sempre que necessário (por exemplo, depois de mudar `cupons.html`, `data/geo.json` ou o banco, para atualizar a cópia sem login). Não é preciso pedir antes; avise depois.
6. **Cupons usados vão para o fim da lista do app**, com a foto em preto e branco no Poa e no Canoas (no Tour, ficam numa lista própria de vouchers usados). Ao casar prints ou vídeos com a lista pela ordem, pule os usados.
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
- **`PROGRAMAS` no JS:** cada programa tem id, nome, classe de cor, cidade padrão (Poa → Porto Alegre, Tour → RS, Canoas → Canoas) e `validade` (último dia do plano, `AAAA-MM-DD`, ou `null`). Um programa novo precisa de uma entrada aqui, além do arquivo de dados.
- **Acessibilidade e TalkBack (17/11/2026).** O TalkBack no Chrome travava com a página aberta. Medido com CDP (`Accessibility.getFullAXTree`) e `MutationObserver`:

  | | antes | depois |
  |---|---|---|
  | nós de acessibilidade | 32.928 | 2.377 |
  | nós no DOM | 59.619 | 1.591 |
  | favoritar: nós criados / removidos | 800 / 800 | 3 / 2 |
  | favoritar, até a tela atualizar (CPU 4×) | ~1,7 s | ~35 ms |

  - **Lotes de 40** (`LOTE`, `state.limite`, `#mais-btn`): o botão "Mostrar mais 40 (40 de 577)" põe o foco no primeiro cupom novo. Sem carregamento automático ao rolar (cartões entrando acima do ponto do leitor desorientam). O lote volta a 40 quando muda o que define a lista (`assinatura()`: busca, filtros, ordem, situação, ponto de partida); favoritar, marcar como usado, atualização do banco e "Ver juntos" (que mostra o grupo inteiro) mantêm o lote. Nas ordens agrupadas, o lote vale para a lista inteira.
  - **Painéis montados ao abrir:** "Regras, horários e endereço" e "Também em…" ficam com `.det-body` vazio até serem abertos; o evento `toggle` monta o conteúdo no lugar (sem trocar o cartão) e atualiza o cache do cartão.
  - **Escritas só quando mudam:** cabeçalho, controles, aviso e barra de resultado usam `htmlDe(el).innerHTML = …`/`.textContent = …`, `setAttr` e `setHidden`, que não tocam o DOM quando o valor é o mesmo. Use-os em código novo fora da grade.
  - **Foco escondido sob a barra fixa:** `scroll-padding-top` acompanha a altura da `.toolbar` (`ResizeObserver`). Antes, navegando para trás, metade dos itens focados ficava sob a barra.
  - axe-core 4.10 (WCAG 2.2 AA + boas práticas), temas claro e escuro, 412 px: lista com lotes, Filtros com Perto de/raio/Data, cartão com os dois painéis abertos: nenhuma violação.
  - O teste com o TalkBack de verdade precisa ser feito no celular; aqui só dá para medir a árvore que ele recebe.
- **Desempenho e UX (versão 36, 18/11/2026).**
  - **Lista guardada** (`CACHE_KEY = "cupons-em-dobro:cache:v1"`, `leCache`, `guardaCache`): 1,5 s depois de cada snapshot do servidor, `{ em, cupons }` vai para o localStorage (~500 KB). Em `boot()`, antes de esperar o banco, a lista guardada vira `state.cupons` com `state.deCache = em` e `phase = "ready"`. O primeiro snapshot do servidor troca a lista e limpa `deCache`; snapshot vazio vindo do cache da plataforma é ignorado. Escritas antes do banco (`!col`) ficam em `pendentes` e são enviadas (`envia`) assim que `col` existe. Sem banco e sem `snapshot.json`, a lista guardada fica só para consulta (vira `copiaDe`); com `snapshot.json`, fica a mais nova das duas. Aviso só depois de 1,5 s (`cacheLento`), para não piscar. Medido (CPU 4×, banco respondendo em 1,5 s): primeiro cartão em 1.992 → 391 ms.
  - **Etiqueta de hoje** (`etiquetaHoje`, `hhmm`): só no ramo de uma unidade e quando a data é hoje; mesma regra de `valeAgora` (o minuto final vale; faixa de ontem que passa da meia-noite conta). `renovaHora` redesenha a cada 60 s com a aba visível e no `visibilitychange`. Datas escolhidas e várias unidades seguem como antes ("Amanhã 18:00–23:00", "Hoje em 2 de 3 unidades").
  - **Mesmo lugar sem refazer:** `grupos()` guarda o agrupamento por id (`gruposPorId`, union-find O(n²)) e só o refaz quando muda a assinatura id/programa/nome; a cada snapshot só troca os objetos (O(n)). Números com `Intl.NumberFormat` criados uma vez (`NUM1`, `NUM0`, `kmTxt`).
  - **Topo no celular:** `.eyebrow` só para leitor de tela, `h1` numa linha (`clamp(26px, 8vw, 34px)`), números numa linha (`.stat b` 19 px: abaixo disso o vermelho dos favoritos perde o contraste de texto grande). Busca: `::-webkit-search-cancel-button` escondido (fica só o × da página); "Ordem do app" virou "Padrão (como no app)".
- **Desempenho e uso (versão 35, 18/11/2026).** CPU 4×, até a tela atualizar: abrir Filtros 248 → 103 ms, chip de turno 466 → 138 ms, chip de shopping 266 → 65 ms, trocar de aba 301 → 79 ms.
  - Contagens: `baseDe(grupo)` calcula uma vez por redesenho quem passa nos outros filtros, e `count()` só testa o chip nesse conjunto; só a aba aberta é montada (`if (aba === "...")`). `semFiltro` entra na chave da base. Chips fora da aba aberta ficam com valores antigos no DOM escondido; ao abrir a aba eles se atualizam (em testes, leia os chips com a aba aberta).
  - `chipsEm(el).innerHTML = …`: se os chips são os mesmos (mesmos `data-*`), atualiza `aria-pressed`, `disabled`, classe e conteúdo no lugar; o botão tocado não é trocado (foco e TalkBack ficam nele, sem layout forçado). `faixasMin` e `diaKey` guardam conversões em cache.
  - Fontes: `<link id="fontes" media="print">` vira `all` ao carregar (o script troca); `<noscript>` de reserva.
  - `garanteGeo()`: `geo.json` só com "Mais perto", "Agora, perto", aba Onde, ou bairro/ordem/raio salvos. O foco no seletor de bairro espera as coordenadas.
  - Filtros no celular (≤ 560 px) viram diálogo em tela cheia (`aplicaModoFiltros`): `role=dialog`, `aria-modal`, `inert` no cabeçalho, barra e lista, rolagem travada, título focado ao abrir, Esc fecha, "Ver N cupons" (`#filters-ver`) fecha e leva ao total; foco volta ao botão Filtros. No computador, painel no meio da página como antes. O aviso (toast) fica acima do diálogo (z-index 40).
  - Lista compacta (`state.compacto`, nas preferências): classe `compacto` na grade; cada cartão ganha o botão `[data-act=expandir]` (escondido fora do modo compacto) e a classe `expandido` (`state.expandidos`). O HTML do cartão não muda com o modo, então trocar de modo não recria cartões.
  - Nada encontrado: `sugestoesSemResultado()` testa tirar cada filtro ativo (e busca, favoritos, programas) e mostra até 4 botões `[data-act=tirar]`.
  - Posição: `sessionStorage` (`cupons-em-dobro:posicao`) guarda assinatura da lista, lote e rolagem; na primeira lista depois de abrir, se a assinatura bate, volta lote e rolagem. "Ver juntos" já devolvia a posição (o foco volta ao cartão).
- **Topo mais compacto no celular (versão 34, 18/11/2026):**
  - Barra fixa: a busca e **uma** linha `.controls` que rola de lado em telas de até 560 px (antes, até 5 linhas: 246 px presos no topo; agora 114 px, e o primeiro cupom aparece 300 px mais acima). Ordem no HTML (e no teclado/leitor): Filtros, Ordenar, situação, Favoritos, Vale agora, Agora perto, Pet, Kids. `.controls > * { position: relative }` prende os `.sr-only` dentro da linha (sem isso a página rola de lado; mesmo caso dos botões de programa).
  - Planos: `<details class="planos-det">` com o resumo numa linha ("Tour vence em 108 dias · cerca de 32 cupons por semana · ⚑ feriado sexta (20/11)") e o detalhe de cada plano ao abrir. Aberto/fechado fica nas preferências (`planosAbertos`).
  - O teste do axe roda com a página no topo: com ela rolada, um chip atrás da barra fixa dá "target-size" (falso positivo; foco escondido tem teste próprio).
- **"Agora, perto" (versão 33, 18/11/2026):** botão `#agora-perto` na barra. Liga `quando = "agora"` (tira a Data) e `sort = "perto"`, e pede a localização com `pedeLocalizacao(true)`: se ela falhar e já houver ponto de partida (bairro salvo ou localização anterior), usa ele e avisa ("Usando Moinhos de Vento (Porto Alegre)."); sem ponto de partida, abre a aba Onde com o foco no seletor de bairro. Fica pressionado quando os dois estão ligados; tocar de novo desliga os dois e volta à ordem do app.
- **Painel de filtros em abas (versão 32, 18/11/2026):** três abas com `role=tablist` (Quando: quando usar, data, dias, turno; O quê: categorias, categoria no app, benefício, regras, comodidades; Onde: cidade, shopping, bairro, perto de). Setas, Home e End trocam de aba (ativação automática); a aba aberta fica nas preferências (`abaFiltros`) e cada uma mostra quantos filtros estão ativos nela. "Perto de mim" sem localização abre a aba Onde.
  - **Linha "Filtros ativos"** (`#ativos`, `filtrosAtivos()`, `removeFiltro()`), acima da lista e visível com o painel fechado: um botão por filtro ("Noite ×", lido "Noite: remover filtro"). Remover leva o foco ao filtro vizinho ou, se era o último, ao total de resultados (`#result-count` agora tem `tabindex="-1"`). Busca, programas e favoritos não entram, porque já ficam visíveis na barra.
  - Filtro novo = entrada em `filtrosAtivos()` e `removeFiltro()`, além do grupo na aba certa.
- **Sincronização com o banco (18/11/2026):** `scripts/sincronizar.py` compara a exportação do banco com `data/*.json`. favorito/usado/usadoEm vêm do banco (`--marcas-para-arquivos` grava nos arquivos); o resto vem dos arquivos e vira um patch por cupom mais `writes.json` (sem `if_version`, porque a exportação não traz versões: leia cada cupom com `get` antes do batch). Testes em `tests/test_sincronizar.py`. Em 18/11: banco e arquivos iguais (680 cupons; 679 depois da conferência dos vídeos de 17/11).
- **Filtros dos apps (versão 31, 17/11/2026).** Comparados com os prints dos painéis "Filtros" dos três apps; o que faltava entrou:
  - "Aceita em" virou conjunto (`state.aceita`: `feriados`, `datas`; os dois juntos exigem os dois; plano vencido não conta). A preferência antiga `quando: "feriados"` é convertida.
  - Turno (`state.turnos`, `TURNOS`, `valeNoTurno`): manhã (6h–11h), almoço (11h–15h), tarde (15h–18h), noite (18h–23h), madrugada (23h–6h). Vale se alguma faixa do cupom cruza o turno, na data de "Data", nos dias de "Dias da semana" ou em qualquer dia.
  - Shopping e centro comercial (`SHOPPINGS`, `shoppingDaUnidade`, `shoppingsDe`, `state.shoppings`): regex no endereço de cada unidade (rua + número ou nome do lugar). A `categoriasApp` do Poa/Canoas **não** é usada: vale para o cupom inteiro e, em redes, lista vários shoppings. Shopping novo = uma linha em `SHOPPINGS`.
  - Ficou de fora: as 19 "culinárias" do Tour (Japonesa, Indiana, Tailandesa…), porque o Tour não mostra categoria na tela do cupom; precisaria de um print por cupom.
  - Painéis dos apps, para referência: Tour = dia da semana, faixa de horário, aceita em feriados/datas, favoritos, comodidades, já usados, categorias, culinária, cidade, perto de mim, centro comercial; Poa = dias, aberto agora, favoritos, perto de mim, ~40 categorias (com shoppings), diferenciais, bairros; Canoas = o mesmo do Poa com 18 categorias (ParkShopping Canoas, Stop Food Park, Garden Containers) e bairros de Canoas.
- **Desempenho (17/11/2026):** medido com a CPU 4× mais lenta (Playwright + `Emulation.setCPUThrottlingRate`), do toque até a tela atualizar: favoritar, atualização do banco e cada letra da busca caíram de 1,6–1,8 s para 150–260 ms, e cada favorito ou atualização do banco passou de 800 nós criados e 800 removidos para 16.
  - `cartaoEl` + `reconcilia`: o HTML de cada cartão é gerado de novo, mas o elemento só é recriado quando esse HTML muda (cache `_cartoes`, chave `<nível do título>:<id>`); os demais ficam no lugar, com foco e painéis abertos. Vale também para "Por categoria"/"Por programa" (seções reaproveitadas pelo nome do grupo). Estados vazios e de carregamento ainda usam `innerHTML` e zeram `gridDeCartoes`.
  - **Não use `content-visibility: auto` nos cartões.** Foi testado e retirado: no Chrome, os cartões fora da tela ficam vazios na árvore de acessibilidade (577 artigos sem nome, só 6 botões de favorito), e o TalkBack veria a lista acabar na tela atual. Para conferir acessibilidade, leia a árvore com CDP (`Accessibility.getFullAXTree`); `ariaSnapshot` e `textContent` leem o DOM e não mostram esse problema.
  - `renderControls` para logo depois da barra quando o painel Filtros está fechado: chips e contagens (dezenas de passadas pelos cupons) só são montados com ele aberto.
  - `matchesSearch` guarda o texto de busca de cada cupom num `WeakMap` (o objeto muda a cada atualização do banco, e o cache junto).
- **Perto de mim (versão 26, 17/11/2026):**
  - `data/geo.json`: `"<endereco>|<bairro>|<cidade>" -> {lat, lng, precisao}` para cada unidade (inclui `outrasUnidades`). Gerado por `scripts/geocodificar.py` (Nominatim/OpenStreetMap, 1 consulta por segundo, User-Agent genérico, sem dados pessoais). O OpenStreetMap quase não tem número de casa na região e, sem número, devolve um trecho qualquer da rua (na primeira tentativa, a Av. Sezefredo Azambuja Vieira e a Protásio Alves caíram a 4–7 km do lugar). Por isso o script: aceita "endereco" só com número da casa no resultado; depois procura "rua, bairro, cidade" e aceita "rua" se o resultado estiver no bairro; depois a rua sozinha, se cair a até 1,5 km do centro do bairro (ou se o mapa não conhece o bairro); depois o centro do bairro ("bairro") e, por fim, o da cidade ("cidade"). "bairro" e "cidade" aparecem com "≈". Grafias diferentes do mapa ficam em `CORRECOES`. Em 17/11: 596 endereços = 181 "endereco", 359 "rua", 56 "bairro"; conferido que nenhum "rua" fica a mais de 2 km da mediana do seu bairro. Consultas limitadas à caixa da Grande Porto Alegre e Vale dos Sinos. O Nominatim às vezes responde 429 (muitas consultas): rode de novo, que só consulta o que falta.
  - **Rede:** o ambiente padrão bloqueia o Nominatim. Foi criado o ambiente pessoal **"cupons"** (só `nominatim.openstreetmap.org` liberado, além dos registros de pacotes), ligado a este repositório. Use-o nas próximas sessões.
  - **Publicação:** `geo.json` vai junto com a página, como `snapshot.json`: `files: {"geo.json": "data/geo.json"}` no publish. Sem ele, o grupo "Perto de" diz que as coordenadas não carregaram.
  - Ponto de partida (`state.perto`): a localização do navegador (`navigator.geolocation`; só funciona onde o visualizador permitir, e a plataforma não oferece capacidade de localização) ou um bairro (média das coordenadas das unidades com endereço naquele bairro). Se a localização falhar, a página abre Filtros e põe o foco no seletor de bairro. O bairro fica salvo nas preferências (`pertoBairro`); a localização não.
  - Ordenação `perto` (cupons sem endereço no fim) e raio `state.raio` (1, 2, 5, 10 km; conta no selo de Filtros). A distância é em linha reta até a unidade mais perto (`distDe`, com cache por ponto de partida).
- **Comodidades (versão 24, 17/11/2026):**
  - cada chip calcula em quais programas a comodidade aparece (em todos os cupons, sem filtro); se não for em todos os programas com cupons, mostra "· só Tour" (falado: ", só no Tour Grande Poa"). Hoje só Pet e Kids aparecem nos três. `PROGRAMAS` ganhou `curto` (Poa, Tour, Canoas).
  - atalhos na barra: `#pet-toggle` e `#kids-toggle`, com `data-atalho` igual à chave do chip ("Pet Friendly / Aceita Pet", "Espaço Kids"); ligam e desligam o mesmo `state.comods`, então chip e atalho ficam sempre iguais e contam no selo de Filtros.
  - correção: `.prog-pill { position: relative; }`. O `.sr-only` (absoluto) do contador escapava da faixa rolável de programas e alargava a página no celular (rolagem lateral de ~550 px em tela de 390 px).
- **Mesmo lugar em outro programa (versão 23, 17/11/2026):**
  - `nomeBase(nome)`: sem o que vem depois de " - ", sem apóstrofos, acentos e sinais, "&" vira "e". Dois cupons de **programas diferentes** ficam no mesmo grupo quando um nome-base é o começo do outro, palavra por palavra. Os grupos são fechados por união (union-find), então redes juntam todas as unidades (Spoleto: 1 Poa + 4 Tour + 1 Canoas). Calculado na página, sem campo no banco; em 17/11 eram 197 cartões com aviso e nenhum par errado na conferência manual.
  - Se aparecer um par errado, a saída é uma lista de exceções em `grupos()`; se faltar um (nomes diferentes no app), uma lista de pares extras.
  - Cartão: `<details class="det outros" data-outros>` com resumo por programa ("1 disponível", "já usado", "todos usados") e, aberto, nome, unidade, situação e oferta de cada um. O estado aberto fica em `state.abertos` com a chave `outros:<id>`.
  - "Ver os N juntos" põe `state.grupo = id`: a lista mostra só o grupo, com usados, ignorando busca e filtros. Sai com "Voltar à lista" (foco volta ao botão) ou com qualquer clique em programa, barra ou filtros, ou digitando na busca. Não fica salvo.
  - Marcar como usado: o aviso diz "Ainda tem no Tour Grande Poa e no Canoas em Dobro." quando o grupo tem disponíveis em outros programas.
  - **Sugestão de uso (versão 25):** `mesmaUnidade` = alguma unidade dos dois no mesmo `cidade|bairro`. Entre os disponíveis da mesma unidade, `sugestaoUso` aponta o do plano que vence antes, se a diferença for de 7 dias ou mais ("Use primeiro o do Tour Grande Poa: vence em 05/03/27, 31 dias antes deste."); com diferença menor e ofertas diferentes, diz "escolha pela oferta". Em 17/11: 128 cartões com sugestão.
  - `mesmaOferta` compara as palavras do item sem acento, sinais e palavras vazias (um, de, com, prato…), ordenadas, mais o `ganhe`. Cada item da lista diz "Mesma oferta" ou "Oferta diferente", e o resumo ganha "· ofertas diferentes". Diferenças pequenas de texto contam como diferentes (ex.: "(exceto massas artesanais)").
- **Validade, feriados e datas comemorativas (versão 21, 17/11/2026):**
  - `validade`: Poa = `2027-04-05` e Canoas = `2027-04-08` (informadas pelo usuário em 17/11/2026); Tour = `2027-03-05` (rodapé do detalhe: "TOUR VÁLIDO ATÉ 05/03/2027"). O topo mostra os dias que faltam e o ritmo (disponíveis ÷ dias restantes, contando o último). Depois da data, os cartões do programa mostram "Plano vencido" e saem de Data, Vale agora e Aceita em feriados.
  - `FERIADOS`: nacionais, RS (20/09) e Porto Alegre (02/02 Navegantes e 27/05 Corpus Christi, com `onde: ["Porto Alegre"]`, pela Lei Municipal 4.453/78 citada no calendário 2027 do TRT4), até o fim de 2027. `onde` é comparado com as cidades das unidades do cupom (ou a cidade padrão do programa). Carnaval é ponto facultativo e ficou de fora. Feriados municipais de Canoas e de outras cidades não entraram, porque as fontes divergem. **Para 2028 é preciso estender a lista.**
  - `DATAS_COMEMORATIVAS`: estimativa (Natal e véspera, véspera de Ano-Novo, Ano-Novo, Páscoa, Mães, Namorados, Pais, Crianças); os apps não dizem quais datas contam.
  - `valeEm(cupom, data)` concentra a regra, nesta ordem: plano vencido → feriado com `feriados: false` → data comemorativa com `datasComemorativas: false` → dia da semana (`horDe`, todas as unidades). `feriados: null` não bloqueia. `valeAgora` usa `valeEm` para hoje e para ontem (faixas que passam da meia-noite).
  - Todos os cupons do Poa e do Canoas têm `feriados: false`; no Tour, 112 aceitam feriados. Em 20/11/2026, 464 dos 577 disponíveis não valem.
  - Filtro "Data" (`state.data`, `#f-data`, `data-data`): hoje e os próximos 6 dias. Ele e "Vale agora" se excluem, e as contagens de cada um ignoram o outro. A preferência antiga `quando: "hoje"` vira a data de hoje; o chip "Vale hoje" saiu. O filtro "Dias da semana" (`state.dias`) continua igual, sem olhar feriados.
- **Recursos:**
  - busca sem acentos, que também procura em bairro, cidade, endereço, regras e comodidades;
  - situação (Disponíveis / Usados / Todos) e favoritos;
  - filtros de programa, categoria, categoria no app (`categoriasApp`, só Canoas), tipo de benefício (`igual` ou `igual_ou_menor`), regras, "Quando", dias da semana (vale em pelo menos um dos dias marcados), comodidades, cidade e bairro (chave `cidade|bairro`, porque "Centro" existe em várias cidades; com cidade marcada, só os bairros dela);
  - **painel "Filtros" do Poa em Dobro (prints de 16/11/2026):** dias da semana, Aberto agora, Favoritos, Perto de mim, ~40 categorias (inclui shoppings e Mercado Público como categoria), Diferenciais (Espaço Kids, Aceita Pet) e Regiões (bairros e algumas cidades). Faltam na carteira: **Perto de mim** (os artifacts não recebem a localização do aparelho e os cupons não têm coordenadas) e **as categorias do Poa** (os cupons do Poa não têm a tela de detalhe lida, então não há de onde tirar a categoria do app);
  - botão "Vale agora" na barra (o mesmo filtro de "Quando"), imitando o "Aberto agora" dos apps;
  - comodidades: o filtro exige todas as marcadas, e "Aceita Pet" (Canoas) e "Pet Friendly" (Tour) contam como uma só;
  - seis ordenações: app, A–Z, favoritos, categoria, programa e usados por último;
  - marcar como usado, com botão Desfazer por 6 s;
  - link "Mapa ↗", que usa o endereço da unidade quando existe;
  - tema claro e escuro.
- **Acessibilidade (leitores de tela, como TalkBack), desde a versão 7:**
  - `lang="pt-BR"` é posto por script, porque o invólucro do artifact não declara idioma;
  - **o foco é preservado a cada render** (`descreveFoco`/`restauraFoco`): os botões são recriados com `innerHTML`, e sem isso o TalkBack voltava ao topo depois de cada filtro ou favorito. Ao marcar como usado, o foco vai para o nome do cupom seguinte (`focoPendente`). Qualquer botão novo que seja recriado no render precisa de um `data-*` listado em `FOCO_ATTRS`;
  - a grade não é mais região ao vivo; o total de cupons é anunciado uma vez, 0,7 s depois da última mudança, por `#sr-status` (`announce`);
  - nomes completos para o leitor: "Favorito: <nome>" (com `aria-pressed`), "Marcar como usado: <nome>", "Ver <nome> no mapa (abre em outra aba)", contadores com "cupons", horários falados ("das 11:30 às 14:30"), ✓/✗ lidos como "Vale em"/"Não vale em";
  - cada cartão é um `article` com o nome como título (h3, ou h4 dentro dos grupos de "Por categoria"/"Por programa", que são h3); há um h2 oculto "Cupons" antes da lista;
  - o aviso com "Desfazer" fica 10 s e não some enquanto o foco estiver nele;
  - **revisão de 17/11 (versão 20):** "Desfazer" devolve o foco ao cartão restaurado (antes caía no topo); cupons com várias unidades dizem "Vale hoje em N de M unidades" em vez de ler todos os horários emendados; bairros lidos como lista ("A, B e C"); o triângulo do "Regras, horários e endereço" é só visual (`content: "▸" / ""`); texto dos cupons usados com contraste AA no tema claro (cor `--muted` em vez de opacidade); a grade virou `role=region` com o título "Cupons";
  - conferido com axe-core 4.10 (WCAG 2.2 AA + boas práticas) nos temas claro e escuro, em tela de celular (Pixel 7), com a lista inicial, filtros abertos, detalhes de cupom com várias unidades, aba de usados, busca sem resultado e aviso de desfazer: nenhuma violação (17/11). A classe `.sr-only` esconde texto só da tela.
  - **dentro do visualizador do claude.ai** a página roda num iframe com título em inglês ("User-generated artifact content") e idioma en-US do lado de fora; o idioma pt-BR do quadro da carteira vale do mesmo jeito, e o foco entra no quadro pela navegação normal (conferido em 12/11). A regra `[hidden] { display: none !important; }` está na própria página porque o invólucro que a garante não existe em todo lugar onde ela abre;
  - quem recebe o link e só pode ver usa a carteira em modo leitura: os botões aparecem como "desativado" e um aviso (`role=status`) explica o motivo.
- **Quem abre sem login no claude.ai** não recebe o banco (`claude.use("db")` resolve `null`) e via "Entre na sua conta". O `cupons.html` agora tenta carregar `snapshot.json` publicado junto com a página (gerado do banco por `scripts/gerar-snapshot.py`) e mostra uma cópia só para consulta, com aviso da data. **Publicado em 13/11/2026 (versão 9), com autorização explícita do usuário** para expor a carteira completa, favoritos e usados incluídos, a quem tiver o link. A cópia **não se atualiza sozinha**: depois de mudar dados ou de o usuário marcar cupons, leia o banco inteiro, rode o gerador e republique com `files: {"snapshot.json": ...}`. Republicar só o `cupons.html` mantém a cópia anterior. Última atualização da cópia: 16/11/2026.
- **Preferências:** ficam no navegador, em `localStorage`, na chave `cupons-em-dobro:prefs:v1`.
- **Detalhes de cada cupom:**
  - etiqueta "Hoje 11:30–14:30" ou "Não vale hoje", só em cupons com horários e ainda não usados;
  - painel recolhível "Regras, horários e endereço";
  - "Quando" tem Vale agora e Aceita em feriados; "Data" tem hoje e os próximos 6 dias;
  - a etiqueta do cartão segue a data escolhida em "Data" (ex.: "Sex 20/11 11:30–14:30" ou "Não vale sex 20/11 (feriado: Consciência Negra)"), e a tabela de horários destaca o dia dela.
- **Quem tem detalhes:** o Tour inteiro e os cupons 1–98 do Canoas (até o Grano Forneria). O Poa e o resto do Canoas não têm `unidade`, `horarios` etc., então ficam de fora de "Quando", comodidades e cidade.
- **Regras com várias linhas:** as do Canoas guardam `\n` entre os itens; a página mostra as quebras (`white-space: pre-line`).
- **Comparação de horários:** é feita como texto `HH:MM`, por isso o zero à esquerda é obrigatório. Desde a versão 5, `valeAgora` entende faixas que passam da meia-noite: Estaleiro 2 Irmãos, 18:00–04:00, conta até 04:00 do dia seguinte.
- **Partes parciais são escondidas:** `horarios: {}` não mostra tabela, e `feriados: null` não mostra os ícones (era o caso do PopCorn Gourmet até 17/11).

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
| Poa em Dobro | 310 | 198 | 31 (Di Toni, Joe Hamburgueria em 16/11 e 29 vistos nos prints de 17/11) | detalhes de todos os cupons disponíveis até a Ferradura; Céu Zona Sul entrou como cupom novo (223); lista completa (o que vem depois do Di Toni são os usados); 2 nomes cortados nos usados |
| Tour Grande Poa | 237 | 150 | 37 (Don Carlone 11/11, Manos Fast Food 16/11, Chiquinho Havan e 34 vistos nos prints de 17/11, entre eles o Woking Thai Food - Canoas e o Cachorro do Bigode; o Cachorro do Bigode - Cristo Redentor continua disponível) | detalhes completos dos 203 disponíveis da captura; os usados novos não têm detalhes |
| Canoas em Dobro | 132 | 94 | 35 (Paradouro, Guido, The West Burger e 32 vistos nos prints de 17/11) | lista completa; Família Kabana, Guacamole Taqueria e Grano Forneria (saíram do programa) e segundo Urban 1736 (erro do app) apagados; detalhes de todos os disponíveis (1–98) |

## 6. O que falta fazer (por prioridade)

1. **Canoas em Dobro:** Degustar no Bairro (posição 77 depois das exclusões) tem detalhes desde 18/11. Guacamole Taqueria e Grano Forneria saíram do programa e foram apagadas.
   - **Tour:** Helena Burger POA (posição 158) tem detalhes completos desde 18/11. Go Coffee São Leopoldo saiu do programa e foi apagado. A lista do Poa e a de usados do Tour foram conferidas pelos vídeos de 17/11 e batem com a carteira.
2. **Poa em Dobro:** lista completa (os cupons depois do Di Toni são os usados, registrados em 17/11). As 13 emendas com anúncio foram confirmadas pelos vídeos de detalhe.
3. **Poa em Dobro, nomes:** resolvido em 17/11/2026 (Machry Armazém e Bistrô, Ponto Zero Bar e Cozinha; Raw Restaurante e Café já estava completo).
4. **Detalhes dos cupons novos do Poa e do resto do Canoas:** os vídeos do Poa de 12/11 vieram em 886 px de largura; converta para 720 px antes do `preparar.sh` (`ffmpeg -i <vídeo> -vf "scale=720:1560,fps=6" -c:v libx264 -crf 23 -an parte_00.mp4`), porque os recortes dos scripts são em coordenadas de 720 px. Os scripts de `scripts/video/canoas/` servem para o Poa (mesmo app, tema escuro). Os vídeos de 16/11 ("tour_parte_00…04", Poa apesar do nome) já vieram em 720 px. Para achar cupons com várias unidades, conte os endereços diferentes no OCR de cada visita. Confira se a oferta do topo da tela bate com o `item` registrado (o Shrek Lanches do Canoas tinha mudado). O `visitas.py` às vezes junta dois cupons numa visita (Fogo + Comfy em 16/11): procure duas moradas diferentes ou dois nomes e separe pelos quadros. Nome de restaurante que começa com "Rua" (Rua Gastronomia) confunde o `montar.py`: corrija a unidade no `manual.json`. Nos cupons com várias unidades, gere uma folha com a tabela de cada unidade e guarde as outras em `outrasUnidades` (`scripts/video/canoas/unidades.py <T> <slug>` gera essa folha). As etiquetas de cada unidade ficam logo abaixo da tabela dela; o OCR erra essas pílulas, então confira em imagem. Confira a ordem das colunas de horário em cada unidade: na unidade São Sebastião do Doce Docê o app mostra a manhã na coluna da noite. regras, unidade, horários, feriados e comodidades vêm de vídeos da tela de detalhe. Para o Canoas, use `scripts/video/canoas/` (o layout é diferente do Tour); o próximo vídeo deve começar no Paradouro Café (cupom 101). Os documentos já existem, então use `update`.
   - **Família Kabana Pizzaria:** saiu do programa; apagada do arquivo e do banco em 17/11/2026.
   - **Painel "Filtros" dos apps:** recebido em 17/11 (prints) e comparado; ver "Filtros dos apps".
5. **Tour, pendências menores:** resolvidas em 17/11/2026 por prints (Mark - Harmonia, Roubadinhas e Zona Sul, por dedução; PopCorn Gourmet e Pallina Di Latte completos). Os dois cupons do Mark ganharam as outras unidades com horários (prints de 17/11, 21:50). Ah! Casa e Camarão Express também ganharam a segunda unidade. Poke Delícia - São Leo, Coccaderia.Co, Milky Moo e Mr. Pretzels também (prints de 17/11, 22:06): nenhum cupom do Tour ficou só com a primeira unidade. Comodidades por unidade em `outrasUnidades[].comodidades` (Coccaderia, Poke Delícia); `comodSet` junta as de todas as unidades.
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
- **A pasta temporária (scratchpad) é apagada entre sessões.** Por isso os scripts foram para o repositório.
- **Testes automáticos:** `cd tests && npm install && npm test` (uns 20 s). Rode antes de republicar a página. Cobrem datas e feriados, mesmo lugar, filtros, Perto de mim, lotes, acessibilidade (árvore do Chrome e axe-core) e desempenho com CPU 4× mais lenta, além do `geocodificar.py`. Detalhes e o banco falso em `tests/README.md`. Para um teste novo, confira com `CUPONS_HTML=<versão quebrada>` que ele falha de verdade.
- **Organização dos arquivos de trabalho:** use uma pasta por lote (por exemplo `t2/` e `t3/` na sessão anterior). Os vídeos ficam numa pasta própria, e os scripts recebem a pasta como argumento.

## 10. Fatos dos apps que ajudam

- **Tour:**
  - a lista é agrupada por tipo de estabelecimento e vai em ordem alfabética dentro de cada grupo;
  - asterisco no texto do cupom quer dizer "ver regras" (57 cupons com `verRegras: true`);
  - o mesmo restaurante pode ter vários cupons (Gran Forneria, Saúde no Copo, Chá das Três, Banca do Açaí, redes com várias unidades).
- **Poa:** os prints vieram em 7 lotes, cada um **antes** do anterior na lista. As posições estão no README.
- **Canoas:** a lista começa no Kampeki Sushi. Comidas de Boteco tem dois cupons (o segundo Urban 1736 era erro do app e foi apagado).
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
10. `329a6e1` detalhes de mais 36 cupons do Canoas (Fornito a OCA Café & Brunch)
11. `e83c62a` detalhes de mais 28 cupons do Canoas (Confraria 110 a Grano Forneria), Paradouro Café e The West Burger, oferta do Guido e do Shrek Lanches
12. `e1430c3` acessibilidade para leitores de tela (versão 7 da página)
13. `948aef7` `[hidden]` garantido pela própria página (versão 8), notas sobre o visualizador
14. `78ac676`/`f68baa9` cópia somente leitura para quem abre sem login (versão 9)
15. `a67d53b` filtros de dias da semana e bairro (versão 10)
16. `290df83` detalhes de 9 cupons do Poa, `outrasUnidades` na página, cópia sem login atualizada em 16/11 (versão 11)
17. `c33e5a3` detalhes dos cupons 7 a 33 do Poa, "Centro Histórico" padronizado, cópia sem login atualizada (versão 12)
18. `3c58e70` detalhes dos cupons 34 a 45 do Poa, Raw Restaurante e Café, cópia sem login atualizada (versão 13)
19. `34e15c9` detalhes dos cupons 49 a 88 do Poa, cópia sem login atualizada (versão 14)
20. `dec2fdb` script de diagnóstico de visitas (`diagnostico.py`)
21. `641af64` detalhes dos cupons 89 a 184 do Poa, 13 cupons com várias unidades, cópia sem login atualizada (versão 15)
22. `b718de0` detalhes dos cupons 185 a 280 do Poa, Céu Zona Sul novo, 12 cupons com várias unidades, cópia sem login atualizada (versão 16)
23. `b797ea7` cupons já usados dos três programas (prints de 17/11), Família Kabana apagada, cópia sem login atualizada (versão 17)
24. `905db77` Woking Thai Food - Canoas usado no Tour, segundo Urban 1736 apagado do Canoas (erro do app), cópia sem login atualizada (versão 18)
25. `f28a8f2` Cachorro do Bigode usado separado do Cachorro do Bigode - Cristo Redentor (disponível), cópia sem login atualizada (versão 19)
26. `f2f4169` camadas do Google My Maps (`scripts/gerar-mapa.py` e `mapa/*.csv`)
27. `8669ead` revisão de acessibilidade para TalkBack (versão 20)
28. validade dos planos, feriados e datas comemorativas, filtro "Data" (versão 21)
29. `2d57205` validade do Poa (05/04/2027) e do Canoas (08/04/2027) (versão 22)
30. `1070743` aviso de mesmo lugar em outro programa e "Ver juntos" (versão 23)
31. `47ff31f` comodidades: aviso "só Tour" e atalhos Pet e Kids; rolagem lateral no celular corrigida (versão 24)
32. `74fee0a` sugestão de qual cupom usar e comparação de ofertas no aviso de mesmo lugar (versão 25)
33. perto de mim: `data/geo.json`, `scripts/geocodificar.py`, ordenação "Mais perto" e raio
34. desempenho (cartões reaproveitados), `content-visibility` retirado, geocodificação por bairro, acessibilidade para o TalkBack (lotes de 40, painéis sob demanda, escritas só quando mudam, foco fora da barra fixa) e `data/geo.json` completo: tudo publicado junto na versão 26
35. `e03428e` testes automáticos em `tests/` (30 da página + 5 do geocodificador)
36. `587e3c9`/`9347588` prints de 17/11: nomes do Machry, Ponto Zero e Mark - Harmonia; detalhes do PopCorn e do Pallina; unidades extras do Mark e etiqueta para unidades sem horário. arquivos e banco atualizados (batch com `if_version`, autorizado pelo usuário), página publicada na versão 27
37. (este commit) unidades e horários dos dois cupons do Mark (Bom Fim, Cidade Baixa; Auxiliadora e Tristeza do Harmonia), `ajustar` nos testes para simular dados; versão 28
38. (este commit) segunda unidade do Ah! Casa (Marechal Rondon) e do Camarão Express (Estância Velha), versão 29
39. (este commit) unidades de Coccaderia.Co (4), Milky Moo, Mr. Pretzels e Poke Delícia - São Leo; comodidades por unidade na página e no filtro; versão 30
40. (este commit) filtros dos apps: turno, aceita em datas comemorativas, shopping/centro comercial; versão 31
41. (este commit) painel de filtros em abas com linha de filtros ativos, `scripts/sincronizar.py`, cópia sem login regenerada; versão 32
42. (este commit) botão "Agora, perto"; versão 33
43. (este commit) barra fixa numa linha rolável e resumo dos planos recolhível; versão 34
44. (commits a8807e0, 6e1c3c5, fd770b1 e este) contagens mais rápidas, fontes sem bloquear, coordenadas sob demanda, Filtros em tela cheia no celular, lista compacta, sugestões sem resultado, posição ao recarregar; versão 35
45. (654b709) lista guardada no navegador (primeira tela na hora), etiqueta "Agora · até / Hoje a partir das / Encerrado hoje", topo compacto no celular, agrupamento mesmo lugar em cache, "Padrão (como no app)" e um × só na busca; versão 36
46. (f07fa00) conferência das listas do Canoas e do Tour pelos vídeos de 17/11 (README, "Conferência das listas"): Degustar no Bairro e Helena Burger POA novos, ofertas do Darna (Canoas e Tour) e do Spoleto (Canoas), 138 cupons com nova posição; banco atualizado em três lotes e conferido com `sincronizar.py` (682 cupons, sem diferença). Página não republicada.
47. (1418bae) Guacamole Taqueria, Grano Forneria (Canoas) e Go Coffee São Leopoldo (Tour) apagados, porque saíram do programa (confirmado pelo usuário); lista inteira do Poa e usados do Tour conferidos pelos vídeos de 17/11, sem diferenças; banco conferido com `sincronizar.py` (679 cupons). Página não republicada.
48. (f80153d) página republicada (versão 37) só para atualizar a cópia sem login: `snapshot.json` com os 679 cupons de 18/11, gerado da exportação do banco conferida com `sincronizar.py`; `cupons.html` e `geo.json` iguais à versão 36.
49. (c739c98) detalhes do Degustar no Bairro (completos) e do Helena Burger POA (unidade, feriados e datas) por prints de 18/11; dois endereços novos em `data/geo.json`. Banco atualizado e conferido. Página republicada depois (versão 38) com `geo.json` e cópia sem login novos.
50. (9e91e32) versão 38 publicada; autorização permanente para republicar registrada na regra 5.
51. (1b21c46) horários (domingo a quinta, 18:30–23:00) e comodidade do Helena Burger POA por prints de 18/11; banco conferido; versão 39 publicada.
52. (c28d653) "Meus lugares" em "Perto de" (README, seção própria): lugar Casa gravado em `data/users/me/lugares` (privado; coordenada fora do repositório), página lê com `user.id()` + `onSnapshot`, "Agora, perto" sem GPS usa o primeiro lugar; banco falso dos testes com área privada e 2 testes novos (64 no total); camadas do My Maps (`mapa/*.csv`) regeneradas; versão 40 publicada.
53. (este commit) site do GitHub Pages em `docs/` (`scripts/gerar-site.py`): a página fora do claude.ai, com GPS do navegador e a cópia dos cupons, só para consulta; testado localmente com localização (Hospital Moinhos → Mr. White a 200 m). O usuário precisa ligar o Pages em Settings → Pages.
