# Cupons em Dobro

Uma carteira pessoal com os cupons 2 por 1 que ainda não usei do **Poa em Dobro**, do **Tour Grande Poa** e do **Canoas em Dobro**.

- **Artifact:** https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc (privado)
- **Página:** `cupons.html` (publicada como artifact; sem build)
- **Dados de origem:** `data/<programa>.json`, transcritos dos prints da aba Cupons de cada app

## O que a página faz

- Busca por estabelecimento, prato, categoria ou programa (ignora acentos)
- Filtros: programa, situação (disponíveis / usados / todos), favoritos, categoria, categoria no app, tipo de benefício (outro igual × igual ou de menor valor), cupons que pedem para ver regras, quando usar (vale agora, aceita em feriados), data (hoje e os próximos 6 dias), dias da semana, comodidades e diferenciais, cidade e bairro
- Botão "Vale agora" na barra, ao lado de Filtros, como o "Aberto agora" dos apps, e atalhos "Pet" e "Kids" (os mesmos chips de comodidades)
- Botão "Agora, perto": liga "Vale agora" e ordena do mais perto ao mais longe num toque; sem localização, usa o bairro escolhido ou abre a aba Onde
- Comodidades que só um programa informa aparecem marcadas no chip (ex.: "Opções veganas · só Tour"): o Poa e o Canoas só informam Aceita Pet e Espaço Kids
- Ordenação: padrão (como no app), nome, favoritos primeiro, por categoria (agrupado), por programa (agrupado), usados por último
- A lista aparece em lotes de 40 cartões, com o botão "Mostrar mais" no fim (com os 577 de uma vez, o TalkBack no Chrome travava)
- Favoritar com o coração e marcar como usado, com opção de desfazer. As duas marcações ficam salvas no banco do artifact.
- Link de mapa para cada estabelecimento
- Validade de cada plano no topo, com os dias que faltam e quantos cupons por dia e por semana dão conta dos disponíveis (Poa em Dobro até 05/04/2027, Tour Grande Poa até 05/03/2027, Canoas em Dobro até 08/04/2027)
- Feriados e datas comemorativas: cupons com `feriados: false` ou `datasComemorativas: false` aparecem como "Não vale hoje (feriado: …)" nesses dias, e o topo avisa os feriados dos próximos 7 dias com quantos cupons eles bloqueiam
- Mesmo lugar em outro programa: o cartão avisa "Também em Tour Grande Poa (1 disponível) · …", lista os outros cupons (unidade, situação e oferta) e tem "Ver os N juntos", que mostra só esse grupo, com os usados. Ao marcar um como usado, o aviso diz em quais programas ainda tem. Quando a mesma unidade está em dois planos, o cartão sugere qual usar primeiro (o do plano que vence antes) e marca "mesma oferta" ou "oferta diferente" em cada um
- No celular, só a busca e uma linha de botões que rola de lado ficam presas no topo (Filtros, Ordenar, situação, Favoritos, Vale agora, Agora perto, Pet, Kids); a validade dos planos aparece resumida numa linha que abre com um toque
- Etiqueta de hoje diz o momento: "Agora · até 15:00" (vale agora), "Hoje a partir das 18:00" (ainda vai valer hoje) ou "Encerrado hoje"; acompanha a hora a cada minuto e ao voltar para a aba
- Primeira tela na hora: a última lista que veio do banco fica guardada no navegador e aparece antes de o banco responder; quando ele chega, a lista é trocada (favoritos e usados valem o banco). Favoritar nesse intervalo funciona e vai ao banco quando ele responder. Se o banco demorar mais de 1,5 s, um aviso discreto diz que a lista é a guardada
- No celular, o topo é compacto: título numa linha e os números (disponíveis, favoritos, usados) numa linha abaixo, menores; a busca fica a ~190 px do topo (antes 343)
- Lista compacta (botão "Compacta"): uma linha por cupom, com o cartão completo ao expandir
- Quando nada combina, a página sugere qual filtro tirar ("Sem Noite: 12 cupons") e aplica com um toque
- Ao recarregar a aba, a lista volta ao mesmo ponto (mesmo lote e rolagem), se os filtros forem os mesmos
- Painel de filtros em três abas (no celular, em tela cheia com "Ver N cupons") (Quando, O quê, Onde) e, acima da lista, a linha "Filtros ativos" com um × para remover cada um
- Filtros que imitam os painéis dos apps (prints de 17/11/2026): turno (manhã, almoço, tarde, noite, madrugada), aceita em feriados e em datas comemorativas, e shopping/centro comercial (20 locais, deduzidos do endereço de cada unidade; o nome do shopping também aparece no cartão e na busca)
- Perto de mim: ordenação "Mais perto" e, em Filtros, o grupo "Perto de" (minha localização ou um bairro como ponto de partida, e raio de 1, 2, 5 ou 10 km). O cartão mostra a distância em linha reta até a unidade mais perto. As coordenadas ficam em `data/geo.json`, publicado junto com a página, e vêm de `scripts/geocodificar.py` (OpenStreetMap)
- Filtro "Data" para planejar: filtra os cupons que valem numa data dos próximos 7 dias (com feriados e validade) e mostra no cartão o horário dessa data
- Acessível a leitores de tela (TalkBack, VoiceOver, NVDA): o foco não se perde ao filtrar, favoritar ou marcar como usado, o total de cupons é anunciado, e cada botão diz de qual cupom é

## Onde os dados ficam

O artifact guarda os cupons no próprio banco de dados, na coleção `cupons`, com um documento por cupom (id `<programa>--<slug>`):

| campo | tipo | observação |
|---|---|---|
| `programa` | string | `poa-em-dobro`, `tour-grande-poa`, `canoas-em-dobro` |
| `nome` | string | nome do estabelecimento |
| `categoria` | string | estimada a partir do item do cupom: Restaurante, Carnes e parrilla, Pizzaria, Hamburgueria, Lanches, Mexicano e latino, Japonês e asiático, Cafeteria, Doces e sorvetes, Bar |
| `item` | string \| null | trecho em negrito do app ("Na compra de **…**") |
| `ganhe` | `igual` \| `igual_ou_menor` | "ganhe outro igual" ou "outro igual ou de menor valor" |
| `verRegras` | bool | o app mostra "(ver regras)" no cupom |
| `ordem` | número | posição na lista do app |
| `favorito` | bool | coração preenchido |
| `usado` / `usadoEm` | bool / `AAAA-MM-DD` | marcado na página |
| `pendente` | string \| null | aviso quando falta informação |
| `unidade` | objeto \| null | `{bairro, endereco, cidade}` da unidade onde o cupom vale (Tour) |
| `horarios` | objeto | dias em que o cupom vale (`dom`…`sab`) e faixas de horário; dia ausente = não vale |
| `feriados` / `datasComemorativas` | bool | se o cupom vale em feriados e datas comemorativas |
| `regras` | string \| null | texto de "Regras e avisos do estabelecimento" |
| `comodidades` | lista | etiquetas do app (Acessibilidade, Pet Friendly, Opções veganas…) |
| `maisUnidades` | bool | o app mostra um seletor de unidade; os dados são da unidade que aparece primeiro |
| `outrasUnidades` | lista | as outras unidades, quando o vídeo mostra todas: `{bairro, endereco, cidade, horarios, comodidades?}` cada (Poa e Tour). `horarios: null` = horário não conhecido; `comodidades` só quando a unidade tem comodidades diferentes das do cupom (a primeira unidade usa as do cupom). Os filtros de dia, horário, cidade e bairro valem se qualquer unidade atende |
| `categoriasApp` | lista | categorias que o app mostra abaixo do nome na tela do cupom (Canoas), como "Culinária Internacional" ou "Saudável, ParkShopping Canoas" |

Só a pessoa dona do artifact pode gravar no banco (regra `write: owner`).

Quem abre o link sem estar logado no claude.ai não recebe o banco: a página mostra então uma cópia só para consulta, publicada junto com ela (`snapshot.json`, gerada do banco por `scripts/gerar-snapshot.py`). A cópia tem a data em que foi gerada e só muda quando a página é republicada com uma nova.

`data/*.json` é o registro de origem, com a mesma estrutura. Mudanças feitas na página (favoritos, usados) ficam só no banco.
Para importar um programa novo, crie `data/<programa>.json` e gere os documentos com:

```sh
python3 scripts/gerar-seed.py data/<programa>.json <pasta-de-saida>
```

Antes de republicar a página, rode os testes: `cd tests && npm install && npm test` (detalhes em `tests/README.md`). Para conferir banco e arquivos e levar favoritos e usados da página para os arquivos, use `scripts/sincronizar.py`; para atualizar a cópia de quem abre sem login, `scripts/gerar-snapshot.py` (passo a passo no `TRANSFERENCIA.md`).

Os scripts que leem gravações de tela (detalhes dos cupons) estão em `scripts/video/`, com instruções no README de lá. O passo a passo para continuar o trabalho numa sessão nova está em `TRANSFERENCIA.md`.

## Tour Grande Poa

São 203 cupons, vindos de 108 prints da aba Vouchers (os dois zips enviados eram idênticos). O app agrupa a lista por tipo de estabelecimento, em ordem alfabética dentro de cada grupo, e a carteira mantém essa ordem. O início (Ah! Casa) e o fim (Vino! Novo Hamburgo) aparecem nos prints.

- **Asterisco = ver regras:** no Tour, um asterisco no texto do cupom indica condições que só aparecem no detalhe. Esses 57 cupons estão marcados como "Ver regras no app".
- **Mesmo restaurante, cupons diferentes:** Gran Forneria (massa/risoto e pizza), Saúde no Copo (wrap, salada e açaí), Chá das Três (café colonial e chá), Banca do Açaí (açaí e crepe) e várias unidades de redes (Spoleto, El Guerrero, Oaks, Menu Poke, Woking, Chiquinho, Cremolatto, Go Coffee, Tortas Doquinha, OCA Pizza…) são cupons separados.
- **Possíveis lacunas:** os nove pontos com anúncio entre dois prints foram todos confirmados pelos vídeos (ver abaixo); a lista do Tour está completa.
- **Nomes completados por dedução:** Coco Bambu - Porto Alegre, Menu Poke - BarraShoppingSul e ParkShopping, Woking - Mercado Público, Spoleto Bourbon Ipiranga e Iguatemi Porto Alegre, Cheirin Bão - ParkShopping e Praia de Belas, Chiquinho Canoas Shopping / Novo Hamburgo / ParkShopping, Go Coffee Cachoeirinha e São Leopoldo, Mais 1 Café - Independência, Prazer Donuts Canoas, Startt & Brothers Café, Tortas Doquinha Porto Alegre, Troppo Buono Moinhos, ViVa Padaria e Cafeteria, Buonissima Canoas e Sapucaia, Domino's Pizza Canoas, OCA Pizza - Ocarrinho Cais Embarcadero, Mark - Auxiliadora, Bom Fim e Cidade Baixa, Buteco Comedy Bar - Novo Hamburgo, Cervejaria Artesanal Horst & Biermann, Caramello Bolos Caseiros, Cremolatto Dr. Barcelos, Ah! Casa - café, bistrô e confeitaria.
- **Nomes que continuam cortados:** nenhum. "Mark - Harmonia, R…" virou "Mark - Harmonia, Roubadinhas e Zona Sul" (prints de 17/11, ver abaixo); os outros foram completados pela tela de detalhe.

### Detalhes do Tour (vídeos de 12/11/2026)

Duas gravações de tela (11 partes de 90 s, 720 px, 6 quadros/s) mostraram a tela de detalhe de todos os cupons do Tour, menos o Ah! Casa (não foi aberto; entrou depois por dois prints) e o Don Carlone (já usado, some da lista do app). Os quadros foram lidos com OCR (tesseract, português) e **todos os cupons foram conferidos em imagem** (folhas com unidade, feriados, horários e regras de cada um); as leituras erradas do OCR foram corrigidas à mão.

- **Dias e horários:** dia que falta na lista do app está mesmo ausente (conferido em imagem), ou seja, o cupom não vale nesse dia. Ex.: Domino's sem sexta, Pratika Rodízio sem segunda e quarta, Lumberjack sem terça, Ser Gastro Pub sem sexta.
- **Feriados e datas comemorativas:** lidos pela cor do ícone (✓ verde / ✗ vermelho). O Mr. Pretzels mostra ✓ nos dois, mas a regra do próprio estabelecimento diz que não vale em feriados e datas comemorativas; ficou como o app mostra, com a regra no texto.
- **Comodidades:** inclui a etiqueta "Exclusivo Takeaway" (só para retirada), presente em 17 cupons.
- **Nomes completos:** o título da tela de detalhe completou 20 nomes que a lista corta (ex.: Empório 22 Wine & Bar, Pallina Di Latte - Shopping João Pessoa, Janela Bar POA - Zona Sul). "Mark - Harmonia, R…" foi completado por dedução em 17/11: a tela de detalhe mostra só "Mark Hamburgueria", mas as regras citam "Zona Sul, Roubadinhas e Parque Harmonia", e o outro cupom do Mark põe as unidades em ordem alfabética no nome ("Auxiliadora, Bom Fim e Cidade Baixa"); daí "Mark - Harmonia, Roubadinhas e Zona Sul".
- **Mais de uma unidade:** Ah! Casa, Camarão Express, Poke Delícia - São Leo, Coccaderia.Co, Milky Moo, Mr. Pretzels e os dois Mark Hamburgueria têm seletor de unidade. Com prints de 17/11/2026, **todos têm as unidades e os horários de cada uma** em `outrasUnidades`: Ah! Casa (+ Marechal Rondon), Camarão Express (+ Estância Velha), Milky Moo (+ Independência), Mr. Pretzels (+ Praia de Belas, das 11:00 às 20:00), Poke Delícia - São Leo (+ Jardim América, São Leopoldo), Coccaderia.Co (+ Estação Mercado, Sarandi/Leroy Merlin e Praça Dom Feliciano, sem domingo) e os dois Mark. No Coccaderia e no Poke Delícia as comodidades mudam por unidade (o Cristal do Coccaderia é só para levar) e ficam em cada unidade; o filtro de comodidades vale se alguma unidade tem.
- **Detalhes completados por prints de 17/11/2026:** PopCorn Gourmet - Praia de Belas (unidade, horários das 10:00 às 22:00, feriados e datas comemorativas ✓, comodidades) e Pallina Di Latte (horários das 09:10 às 20:30 todos os dias e comodidades).
- **Os dois cupons do Mark (prints de 17/11/2026), com o horário de cada unidade em `outrasUnidades`:**
  - Mark - Auxiliadora, Bom Fim e Cidade Baixa: Auxiliadora (Av. Mariland 908), Bom Fim (Rua Felipe Camarão 383, mesmo horário) e Cidade Baixa (Rua Joaquim Nabuco 383; na sexta só 12:00–15:00).
  - Mark - Harmonia, Roubadinhas e Zona Sul: Praia de Belas (Av. Edvaldo Pereira Paiva 63), Auxiliadora (Rua Silva Jardim 140; 15:30–22:30, sexta e sábado 12:00–16:00, sem quarta) e Tristeza (Av. Wenceslau Escobar 1823; 12:00–15:30 e 18:00–22:30, sem segunda).
  - Se uma unidade vier sem horário (`horarios: null`), a página diz "Hoje 18:00–23:00 (Praia de Belas)" em vez de contar unidades.
- **Lacunas resolvidas:** os vídeos percorrem a lista sem pular, e a lista entre um cupom e outro mostra os dois cartões lado a lado; as nove emendas suspeitas dos prints estão confirmadas.
- **Avisos com data:** várias regras falam de datas que já passaram (Dia dos Namorados, "nesse domingo 08/11"); estão transcritas como o app mostra.
- **Dados do app que parecem errados, transcritos como estão:** Spoleto Bourbon Ipiranga mostra "Bourbon Shopping Novo Hamburgo" no endereço da Av. Ipiranga 5200; Poke Delícia - São Leo mostra primeiro a unidade Hamburgo Velho (Novo Hamburgo); a de São Leopoldo (Jardim América) é a segunda do seletor.

## Canoas em Dobro

São 134 cupons: 99 de 34 prints da aba Cupons (a Família Kabana saiu do programa e o segundo Urban 1736 era um erro do app; os dois foram apagados), 2 vistos no vídeo de 12/11 (Paradouro Café e The West Burger) 32 já usados, vistos em prints de 17/11 (ver "Cupons já usados"), e o Degustar no Bairro, visto no vídeo de 17/11 (ver "Conferência das listas"). Na captura original a lista parecia **não terminar**: depois do Grano Forneria vêm Paradouro Café, Guido Café & Cia e The West Burger, e embaixo deste há pelo menos mais um cartão, com o nome escondido pela barra de navegação. A lista carrega mais cupons quando chega ao fim.

- Não há pontos de anúncio sem emenda: em todos os prints o cupom seguinte aparece no rodapé do anterior.
- **Dois cupons do Comidas de Boteco**, com ofertas diferentes, são registrados como cupons separados. O segundo Urban 1736 que aparecia na lista era um erro do app (confirmado em 17/11) e foi apagado.
- **Nomes completados por dedução:** Bocasanta Pub e Pizza, Churras in Box Canoas e Novo Hamburgo, Darna Cozinha Mediterrânea, Cremolatto Dr. Barcelos, Domino's Pizza Canoas, Família Kabana Pizzaria, Mas Bah Tchê!, Oak's Burritos y Bowls, Churrascaria Passoquinha, Nonno Eugênio Pizzeria, Manjericão Toscano.
- **Nomes que continuam cortados:** nenhum. Empório 22 Wine & Bar e Rodrigues Estação Gourmet foram completados pela tela de detalhe.
- **Banca do Açaí:** a oferta muda por dia (terça e quinta, rodízio de crepes com reserva; sexta a domingo, um crepe à la carte) e está registrada inteira no texto do cupom.

### Detalhes do Canoas (vídeo de 12/11/2026)

Uma gravação de tela (15 partes de 90 s, enviadas em três lotes: 00–04, 05–09 e 10–14) abriu os cupons 1 a 100 da lista, do Kampeki Sushi ao Grano Forneria. São 98 cupons com detalhes, todos conferidos em imagem.

- **Sem detalhes:** os cupons depois do Grano Forneria (Paradouro Café, Guido Café & Cia, The West Burger e o que vier depois).
- **Mudanças vistas no vídeo:** o Shrek Lanches agora oferece um cachorro-quente salsicha (antes, um xis salada); o Guido Café & Cia ganhou oferta (qualquer doce do cardápio + um café com leite, igual ou de menor valor).
- **A barra de categorias do app**, rolada até o fim, mostra as mesmas categorias de `categoriasApp`: Hamburgueria, Italiano, Restaurante, Oriental, Bar, Culinária Internacional, Culinária Regional… Saudável, Carnes, ParkShopping Canoas, Stop Food Park e Garden Containers.
- **Aviso momentâneo não importado:** o Grano Forneria mostrava "O estabelecimento não está atendendo ao tour hoje".

- **Família Kabana Pizzaria não aparece mais na lista do app:** o Numa Bar vai direto para o Balanceado. Saiu do programa (confirmado em 17/11/2026) e foi apagada da carteira.
- **Tela de detalhe do Canoas:** nome, categorias do app (`categoriasApp`), unidade, tabela com Manhã/Tarde e Noite, ícone de feriados, etiquetas (só aparecem "Espaço Kids" e "Aceita Pet") e "Regras do estabelecimento". As "Regras de utilização" são iguais em todos os cupons e não foram copiadas.
- **Feriados:** os 34 mostram "Não Aceita". **Datas comemorativas:** o app não mostra ícone; as regras gerais dizem que nenhum cupom vale em datas comemorativas (Carnaval, Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais, Natal e Ano Novo), então ficou `false` em todos.
- **Horários:** as duas colunas viram faixas no mesmo formato do Tour (`"11:30 - 15:00; 17:00 - 22:00"`). Dia com "-" nas duas colunas não vale.
- **Cidades fora de Canoas:** El Guerrero (Gravataí); 51 Bar e Cozinha e Sweet Life (São Leopoldo); Numa Bar, Café da Lila e Banca do Açaí (Esteio); Rancho Fat Bull (Ivoti); Bomburguer e La Giovanas (Sapucaia do Sul); Don Zarichta e Churras in Box Novo Hamburgo (Novo Hamburgo); Mas Bah Tchê! e O Velho Burguer (Nova Santa Rita); Trempe Parrilla (Viamão); Porto Burger e Nonno Eugênio (Guaíba); Okawa Sushi Bar (Cachoeirinha); Confraria 110 (Esteio); The Big Mamma e Manjericão Toscano (Novo Hamburgo); Shrek Lanches (Nova Santa Rita).
- **Ordem e nomes atualizados pelo vídeo:** Café Normal agora vem antes do segundo Comidas de Boteco (posições 54 e 55 trocadas). O segundo Comidas de Boteco é a unidade "Comidas de Boteco Garden" (Avenida Açucena), e Empório 22 virou "Empório 22 Wine & Bar".
- **Regras com aviso:** o Kampeki é o único cupom que exige reserva antecipada, com sinal de R$ 100 por pessoa; o Darna atende mediante reserva; o Sushiaki só aceita consumo no local; o Buteco Comedy só funciona em dia de show (ver o Instagram @butecocomedy); a Trempe Parrilla pede reserva de sexta a domingo; o OCA Café & Brunch só vale no almoço, das 11h às 15h.
- **Pequenas correções de grafia nas regras:** "sequencia" → "sequência", "burguer" → "burger", "Rodizio" → "Rodízio", "segundo pizza" → "segunda pizza", "segunda saladas" → "segunda salada", "igual ou menor valor" → "igual ou de menor valor", "a segundo pizza" → "a segunda pizza", "o segundo costelinha" → "a segunda costelinha", "o segundo um cesto" → "o segundo cesto", "fatia bolo" → "fatia de bolo", "waffer de igual" → "waffle igual", "Wook" → "wok".

## Detalhes do Poa em Dobro (vídeos de 12/11 e 16/11/2026)

As gravações de tela abriram todos os cupons da lista, do Sabor de Luna à Ferradura (o Di Toni, já usado, ficou sem detalhes). O app do Poa é o mesmo do Canoas, em tema escuro, e foi lido com os mesmos scripts, tudo conferido em imagem.

- **Várias unidades:** Charlie Confeitaria (Mont'Serrat e Moinhos de Vento), Osso Parrilla Bar (Centro Histórico e Bom Fim), Soft Ice Cream (Cidade Baixa e Bom Fim), Spia Bar e Cozinha (Moinhos de Vento e Bom Fim), Lucho Burger (Rua Mostardeiro e Rua Padre Chagas, só almoço), Chocolate Lugano (Floresta e Iguatemi) e Gelateria Di Argento (Iguatemi e Moinhos de Vento) têm duas unidades, e Mix Natural tem três (Bela Vista, Bom Fim e Centro Histórico), cada uma com horários próprios. A primeira fica em `unidade`/`horarios` e a outra em `outrasUnidades`.
- **Várias unidades (cupons 89 a 184):** Consuela's (Moinhos de Vento e Santana), Spoleto (Passo da Areia e Jardim Botânico), Primeiro Reino Burger (Mário Quintana e Santa Cecília), Menu Poke (Cristal e Moinhos de Vento), Gelato Borelli (Cristal e Passo da Areia), Woking Thai Food (Boa Vista e Centro Histórico), Cachorro do Bigode (Sarandi e Cristo Redentor), O'Pasta Trattoria (Cristal e Petrópolis), Gelson Lanches (Tristeza e Praia de Belas) e El Lato (Bela Vista e Mont'Serrat) têm duas unidades; Cachorro do Bonfa tem três (Cidade Baixa, Bom Fim e Praia de Belas); Doce Docê Café tem cinco (Praia de Belas, Teresópolis, Jardim Lindóia, São João e São Sebastião); Gianluca Zaffari tem sete (Navegantes, São João, Moinhos de Vento, Bom Fim, Cristal, Tristeza e Jardim Europa). Na unidade São Sebastião do Doce Docê o app troca as colunas de manhã e noite; o horário foi guardado na ordem certa (08:00 - 15:00 e 15:01 - 20:00).
- **Várias unidades (cupons 185 a 280):** Balcone Pizzaria (Auxiliadora e Boa Vista), Fuga Bar (Floresta e Centro Histórico), Frutos de Goiás (Jardim São Pedro e Parque Harmonia), Hora do Pastel (Moinhos de Vento e Petrópolis) e Uai Why (Bom Fim e Moinhos de Vento) têm duas unidades; Mercado Brasco (Jardim Europa, Moinhos de Vento e Bom Fim), Milky Moo (Pontal, Barra Shopping Sul e Iguatemi) e El Guerrero (Barra Shopping Sul, Pontal e Vila Roubadinhas) têm três; Mais1Café, Temakeria Japesca e Mark Hamburgueria têm seis; 4Beer tem sete. As etiquetas (Aceita Pet, Espaço Kids) às vezes mudam de uma unidade para outra; o cupom fica com as de qualquer unidade.
- **Cupom novo:** Céu Zona Sul (um hambúrguer selecionado, Cristal), entre o Empório do Cookie e o Zambrano Gastrô. Os cupons seguintes andaram uma posição (o Di Toni agora é o 281).
- **Fora de Porto Alegre:** Don Zarichta Pizzaria fica em Novo Hamburgo e POB Burger House em Viamão.
- **Feriados:** todos mostram "Não Aceita"; datas comemorativas ficam `false` pelas regras gerais, como no Canoas.
- **Categorias do app** (`categoriasApp`) são as do painel de filtros do Poa: Restaurante, Combos, Tipico, Doces / Cafés, Carnes, Opção vegetariana, Hamburgueria, Sorveterias, Orientais, Saudável. Grafia como no app ("Tipico"), exceto o bairro "Centro Historico", que o app também escreve com acento e ficou "Centro Histórico" para não virar dois bairros no filtro.
- **Ofertas:** todas batem com as registradas, menos a do Ponto Zero, que mudou para "um prato principal (exceto Da Panela e da Brasa)", e a do Le Grand Burger, que agora é "um Le Incendie Burger ou Burger do Mês (ver regras)"; os cupons com "(ver regras)" na oferta já estavam marcados.
- **Nomes completados:** Raw Restaurante e Café, O Burguês Hamburgueria Clássica.
- **Endereços com erro do app, normalizados:** Barranquinho e O Burguês aparecem como "Porto Alegre / AC", e Startt & Brothers como "Porto Ale / RS"; ficaram Porto Alegre.
- **Emendas confirmadas:** Lucho Burger → Bistrô do Mercado e Joe Hamburgueria → D'Juca Confeitaria (a lista mostra os dois cartões juntos).
- **Visita que juntou dois cupons:** Bierkeller e Hanko Sushi (separados pelos quadros).
- **Depois do Di Toni:** o vídeo de 16/11 mostra, sem abrir, mais cupons. Os prints de 17/11 confirmaram que são cupons já usados (ver "Cupons já usados").

## Mapa no Google My Maps (`mapa/`)

`python3 scripts/gerar-mapa.py` gera um CSV por programa em `mapa/`. Cada CSV vira uma camada no Google My Maps: [google.com/maps/d](https://www.google.com/maps/d/) > Criar um novo mapa > Adicionar camada > Importar > escolher o CSV > marcar **Endereço** para posicionar os marcadores > **Nome** como título. O próprio My Maps transforma os endereços em pontos.

- Entra cada unidade com endereço: a principal e as de `outrasUnidades` (cupons com várias unidades aparecem com o bairro no nome). Os cupons usados vistos só na lista do app não têm endereço e ficam de fora.
- A coluna **Endereço** é uma versão limpa para a busca (rua, número, bairro, cidade, RS). O endereço como está no app fica em **Endereço no app**, e lojas, shoppings e salas em **Complemento**.
- Outras colunas: Programa, Oferta, Situação (Disponível/Usado), Favorito, Categoria, Dias e horários, Unidade. No My Maps dá para estilizar a camada por qualquer uma delas (por exemplo, cor por Situação ou por Categoria).
- Os dados vêm de `data/*.json`. Favoritos e usados marcados na página depois da última sincronização não aparecem; sincronize os arquivos com o banco e gere de novo.
- Alguns endereços não têm número no app (Galeria Mercado Público, Rua dos Andradas, Largo Glênio Peres, Rua Dom Sebastião, Rua Olavo Barreto Viana); o My Maps põe o ponto no meio da rua ou pede para escolher.

## Cupons já usados (prints de 17/11/2026)

Dois zips com 44 prints mostraram os cupons já usados nos três apps. No Poa e no Canoas, os usados ficam no fim da lista, com a foto em preto e branco. No Tour, os prints são da lista de vouchers usados (as fotos ficam coloridas). Cada cupom foi registrado com a oferta, o tipo de benefício e o coração do print, `usado: true` e `usadoEm` vazio (a data não aparece no app). Esses cupons não têm detalhes.

- **Poa em Dobro:** 29 cupons novos, do Galeto Mamma Mia ao De Rua Burger, na ordem do app (ordem 282–310). O Di Toni ganhou a oferta (um item selecionado, igual ou de menor valor). O Joe Hamburgueria já tinha sido marcado como usado na página em 16/11.
- **Canoas em Dobro:** 32 cupons novos depois do The West Burger, do Zanardi Padaria ao Amo Café (ordem 102–133). Paradouro Café, Guido Café & Cia e The West Burger também estão usados; por isso não abriam no vídeo. A lista do Canoas agora está completa: o "pelo menos mais um cartão" depois do The West Burger eram os usados.
- **Tour Grande Poa:** 34 vouchers novos (ordem 204–237). Chiquinho Havan, que já estava na carteira, foi marcado como usado. O Cachorro do Bigode usado é outro voucher (ordem 237); o da carteira, de Cristo Redentor, continua disponível e passou a se chamar "Cachorro do Bigode - Cristo Redentor" (confirmado em 17/11); Manos Fast Food já tinha sido marcado na página em 16/11 e o Don Carlone em 11/11. O Ah! Casa usado oferece "um salgado ou doce", diferente do voucher que está na carteira ("qualquer prato participante"), então entrou como outro cupom. O "Woking Thai Food - …" usado é o de Canoas (confirmado em 17/11), que não estava na carteira, e entrou como voucher novo (ordem 236). No Canoas em Dobro, o Woking Thai Food usado também foi confirmado.
- **Nomes cortados no app:** Pastel com Borda C…, Village Grill Restau… (Poa); Zanardi Padaria &…, El Mago Parrilla y B…, BBQ Pizzas Artesa…, Salvador Bar e Cozi… (Canoas); Fiesckis Pizzas Cano…, Wish Burguer - Can…, Quiero Café - ParkShopping Can…, Helena Burger Cano… (Tour). Completados pelo logo: Cantina Famiglia Lando, La Bella Donna Pizzaria, Ventralis BBQ e Burger, Boxfim 24 de Outubro, Louis Hamburgueria.
- **Família Kabana Pizzaria:** saiu do programa (confirmado em 17/11) e foi apagada do arquivo e do banco. Os cupons seguintes do Canoas andaram uma posição.

## Conferência das listas (vídeos de 17/11/2026)

Duas gravações rolando a lista inteira, sem abrir os cupons: Canoas em Dobro às 18:56 (94 s, em duas partes) e Tour Grande Poa às 18:58 (199 s, em três partes; os arquivos vieram todos com o nome "tour_parte_NN"). Cada quadro foi conferido em imagem, com a ajuda do OCR para achar os nomes.

- **Canoas em Dobro:** a ordem bate com a carteira do Kampeki Sushi ao Manjericão Toscano, e os 35 usados do fim da lista (Paradouro Café ao Amo Café) batem um a um.
  - **Cupom novo:** Degustar no Bairro, entre o Xis Rei e o The Big Mamma (uma garrafa de vinho boscato, igual ou de menor valor; sem favorito). Entrou na posição 78 e os seguintes andaram uma posição. Não tem detalhes.
  - **Ofertas mudadas:** Darna (agora "uma sequência árabe") e Spoleto (filé de frango no lugar de filé de sobrecoxa).
  - **Sumiram da lista:** Guacamole Taqueria e Grano Forneria. Não aparecem nem entre os disponíveis nem entre os usados (em preto e branco no fim). Continuam na carteira até o usuário dizer se saíram do programa.
- **Tour Grande Poa:** a lista de vouchers disponíveis bate com a carteira, na mesma ordem, de Ah! Casa a Vino! Novo Hamburgo. Os três usados que já estavam na carteira (Don Carlone, Chiquinho Havan e Manos Fast Food) não aparecem, como esperado. As ofertas dos 200 cartões foram comparadas com a carteira.
  - **Cupom novo:** Helena Burger POA, entre o Funny Feelings e o Inner (qualquer hambúrguer, igual ou de menor valor; sem asterisco, sem favorito). É outro voucher, diferente do Helena Burger Cano… já usado. Entrou na posição 159 e os seguintes andaram uma posição. Não tem detalhes.
  - **Oferta mudada:** Darna Cozinha Mediterrânea (agora "uma sequência árabe individual", ganhe outra igual, sem asterisco; antes era "um prato participante*", igual ou de menor valor).
  - **Sumiu da lista:** Go Coffee São Leopoldo. A lista do vídeo não mostra os usados do Tour, então pode ter sido usado ou ter saído do programa. Continua na carteira como disponível até o usuário confirmar.

## Pendências da fase 1 (Poa em Dobro)

São 310 cupons: 280 vindos de 99 prints enviados em sete lotes, o Céu Zona Sul, achado no vídeo, e 29 já usados, vistos em prints de 17/11. Cada lote vinha antes do anterior na lista do app, então as posições ficaram: lote 7 = 1–8, lote 6 = 9–52, lote 5 = 53–98, lote 4 = 99–144, lote 3 = 145–189, lote 2 = 190–235, lote 1 = 236–280.

- **Di Toni:** já foi usado (sem data). A oferta veio dos prints de 17/11: um item selecionado, igual ou de menor valor.
- **Lacunas resolvidas:** em treze pontos o print terminava num anúncio. Os vídeos de detalhe abriram os cupons um a um, na ordem da lista, e nenhum ficou de fora nesses pontos (o único cupom novo, o Céu Zona Sul, apareceu em outro lugar):
  - Restaurante Hotel Intercity → Restaurante Madregaia
  - Confeitaria Princesa → Cheirin Bão
  - Ponto Zero Bar → Encouraçado Butikin
  - Gianluca Zaffari → Bar Spoiler
  - Usina de Massas Pocket → Açaí das Maravilhas
  - Johnny & Julie → Mima Focacceria
  - O'Sullivans → Tú Bar
  - Cantina do Ian → Ursa
  - 336 Hamburgueria → Café da Catedral
  - Banca 43 → Squisito
  - Luigi Pastéis → Ruta
  - Saori → Kampeki
  - Chic Brigadeiro → Fornellone

  O fim está confirmado: depois do Di Toni vêm só cupons já usados. O Sabor de Luna é o primeiro cupom da lista (confirmado pelo vídeo de 12/11). As emendas Freddo → Iaiá Bistrô, Comfy Pizza Napoletana → A Costela Burger e Kioske do Pirata → Pradie Bakery estão confirmadas.
- **Nomes cortados no app:** todos completados. Raw Restaurante e Café pela tela de detalhe; Machry Armazém e Bistrô e Ponto Zero Bar e Cozinha por prints de 17/11/2026 (o Ponto Zero também passou a "exceto da Panela e da Brasa", com minúscula, como no app).
- **Nomes cortados no app e completados a partir do logo:** Ratskeller Restaurante, Ciao Pizzeria Napoletana, Don Francesco Pastelaria, Salvador Carlos Gomes, Doralice Cantinho Saudável, Comfy Pizza Napoletana, La Chiviteria Restaurante (o "Restaurante" é dedução a partir de "Resta…"), Chica Maria Cocina y Bar, Churrascaria O Espeto de Ouro, Startt & Brothers Café, O Burguês Hamburgueria, Restaurante Hotel Intercity, Restaurante Madregaia, Biergarten Cervejaria, Usina de Massas Pocket, Famiglia Facin Casa Nápoles, Restaurante Figueiras, Rooster Crispy Kitchen, Edu_ Terrário Urbano, Primeiro Reino Burger, Mimô Brownie & Bistrô, Garibaldi Bar e Assado, Med Gastro Giardino, Quincho Parrilla y Bar, Du Nordeste Bom Fim, Johnny & Julie Doceria, Squisito Fatta a Mano, Confeitaria Dona Inês, Pueblo Casa Mexicana, Lê Bru Confeitaria, Marquês Empório Parrilla, Parrilla Hecho a Mano, Fornellone Ristorante, El Guerrero Mexican Food, Alcabar da Fábrica, Markt Mac and Cheese, Shakespeare Casa de Chá, Pipoca de Ipanema Gourmet, Bella Gula MedCenter.
- **Pequenas correções de grafia no texto do app:** "lIncendie" → "Incendie", "burguer"/"hamburguer" → "burger"/"hambúrguer" (exceto em nomes de estabelecimento), "amendoas" → "amêndoas", "cheeseou" → "cheese ou", "um experiência" → "uma experiência", "uma arepas" → "uma arepa", "Zaituna Arabe" → "Zaituna Árabe", "El Patron" → "El Patrón" (como no logo), "menu koreano" → "menu coreano", "300gr" → "300 g", "um Iscas" → "iscas".
- O status "Aberto agora / Fechado" do app não foi importado, porque valia só para a hora do print.
