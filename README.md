# Cupons em Dobro

Uma carteira pessoal com os cupons 2 por 1 que ainda não usei do **Poa em Dobro**, do **Tour Grande Poa** e do **Canoas em Dobro**.

- **Artifact:** https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc (privado)
- **Página:** `cupons.html` (publicada como artifact; sem build)
- **Dados de origem:** `data/<programa>.json`, transcritos dos prints da aba Cupons de cada app

## O que a página faz

- Busca por estabelecimento, prato, categoria ou programa (ignora acentos)
- Filtros: programa, situação (disponíveis / usados / todos), favoritos, categoria, categoria no app, tipo de benefício (outro igual × igual ou de menor valor), cupons que pedem para ver regras, quando usar (vale hoje, vale agora, aceita em feriados), dias da semana, comodidades e diferenciais, cidade e bairro
- Botão "Vale agora" na barra, ao lado de Filtros, como o "Aberto agora" dos apps
- Ordenação: ordem do app, nome, favoritos primeiro, por categoria (agrupado), por programa (agrupado), usados por último
- Favoritar com o coração e marcar como usado, com opção de desfazer. As duas marcações ficam salvas no banco do artifact.
- Link de mapa para cada estabelecimento
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
| `categoriasApp` | lista | categorias que o app mostra abaixo do nome na tela do cupom (Canoas), como "Culinária Internacional" ou "Saudável, ParkShopping Canoas" |

Só a pessoa dona do artifact pode gravar no banco (regra `write: owner`).

Quem abre o link sem estar logado no claude.ai não recebe o banco: a página mostra então uma cópia só para consulta, publicada junto com ela (`snapshot.json`, gerada do banco por `scripts/gerar-snapshot.py`). A cópia tem a data em que foi gerada e só muda quando a página é republicada com uma nova.

`data/*.json` é o registro de origem, com a mesma estrutura. Mudanças feitas na página (favoritos, usados) ficam só no banco.
Para importar um programa novo, crie `data/<programa>.json` e gere os documentos com:

```sh
python3 scripts/gerar-seed.py data/<programa>.json <pasta-de-saida>
```

Os scripts que leem gravações de tela (detalhes dos cupons) estão em `scripts/video/`, com instruções no README de lá. O passo a passo para continuar o trabalho numa sessão nova está em `TRANSFERENCIA.md`.

## Tour Grande Poa

São 203 cupons, vindos de 108 prints da aba Vouchers (os dois zips enviados eram idênticos). O app agrupa a lista por tipo de estabelecimento, em ordem alfabética dentro de cada grupo, e a carteira mantém essa ordem. O início (Ah! Casa) e o fim (Vino! Novo Hamburgo) aparecem nos prints.

- **Asterisco = ver regras:** no Tour, um asterisco no texto do cupom indica condições que só aparecem no detalhe. Esses 57 cupons estão marcados como "Ver regras no app".
- **Mesmo restaurante, cupons diferentes:** Gran Forneria (massa/risoto e pizza), Saúde no Copo (wrap, salada e açaí), Chá das Três (café colonial e chá), Banca do Açaí (açaí e crepe) e várias unidades de redes (Spoleto, El Guerrero, Oaks, Menu Poke, Woking, Chiquinho, Cremolatto, Go Coffee, Tortas Doquinha, OCA Pizza…) são cupons separados.
- **Possíveis lacunas:** os nove pontos com anúncio entre dois prints foram todos confirmados pelos vídeos (ver abaixo); a lista do Tour está completa.
- **Nomes completados por dedução:** Coco Bambu - Porto Alegre, Menu Poke - BarraShoppingSul e ParkShopping, Woking - Mercado Público, Spoleto Bourbon Ipiranga e Iguatemi Porto Alegre, Cheirin Bão - ParkShopping e Praia de Belas, Chiquinho Canoas Shopping / Novo Hamburgo / ParkShopping, Go Coffee Cachoeirinha e São Leopoldo, Mais 1 Café - Independência, Prazer Donuts Canoas, Startt & Brothers Café, Tortas Doquinha Porto Alegre, Troppo Buono Moinhos, ViVa Padaria e Cafeteria, Buonissima Canoas e Sapucaia, Domino's Pizza Canoas, OCA Pizza - Ocarrinho Cais Embarcadero, Mark - Auxiliadora, Bom Fim e Cidade Baixa, Buteco Comedy Bar - Novo Hamburgo, Cervejaria Artesanal Horst & Biermann, Caramello Bolos Caseiros, Cremolatto Dr. Barcelos, Ah! Casa - café, bistrô e confeitaria.
- **Nomes que continuam cortados:** só "Mark - Harmonia, R…". Os outros nomes cortados na lista foram completados pela tela de detalhe (ver abaixo).

### Detalhes do Tour (vídeos de 12/11/2026)

Duas gravações de tela (11 partes de 90 s, 720 px, 6 quadros/s) mostraram a tela de detalhe de todos os cupons do Tour, menos o Ah! Casa (não foi aberto; entrou depois por dois prints) e o Don Carlone (já usado, some da lista do app). Os quadros foram lidos com OCR (tesseract, português) e **todos os cupons foram conferidos em imagem** (folhas com unidade, feriados, horários e regras de cada um); as leituras erradas do OCR foram corrigidas à mão.

- **Dias e horários:** dia que falta na lista do app está mesmo ausente (conferido em imagem), ou seja, o cupom não vale nesse dia. Ex.: Domino's sem sexta, Pratika Rodízio sem segunda e quarta, Lumberjack sem terça, Ser Gastro Pub sem sexta.
- **Feriados e datas comemorativas:** lidos pela cor do ícone (✓ verde / ✗ vermelho). O Mr. Pretzels mostra ✓ nos dois, mas a regra do próprio estabelecimento diz que não vale em feriados e datas comemorativas; ficou como o app mostra, com a regra no texto.
- **Comodidades:** inclui a etiqueta "Exclusivo Takeaway" (só para retirada), presente em 17 cupons.
- **Nomes completos:** o título da tela de detalhe completou 20 nomes que a lista corta (ex.: Empório 22 Wine & Bar, Pallina Di Latte - Shopping João Pessoa, Janela Bar POA - Zona Sul). "Mark - Harmonia, R…" continua cortado: a tela de detalhe mostra só "Mark Hamburgueria".
- **Mais de uma unidade:** Ah! Casa, Camarão Express, Poke Delícia - São Leo, Coccaderia.Co, Milky Moo, Mr. Pretzels e os dois Mark Hamburgueria têm seletor de unidade; os dados são da unidade que aparece primeiro.
- **Detalhes parciais:** PopCorn Gourmet - Praia de Belas (só as regras; o vídeo não rolou a tela) e Pallina Di Latte (unidade e feriados, sem dias e horários).
- **Lacunas resolvidas:** os vídeos percorrem a lista sem pular, e a lista entre um cupom e outro mostra os dois cartões lado a lado; as nove emendas suspeitas dos prints estão confirmadas.
- **Avisos com data:** várias regras falam de datas que já passaram (Dia dos Namorados, "nesse domingo 08/11"); estão transcritas como o app mostra.
- **Dados do app que parecem errados, transcritos como estão:** Spoleto Bourbon Ipiranga mostra "Bourbon Shopping Novo Hamburgo" no endereço da Av. Ipiranga 5200; Poke Delícia - São Leo mostra a unidade Hamburgo Velho.

## Canoas em Dobro

São 103 cupons: 101 de 34 prints da aba Cupons e 2 vistos no vídeo de 12/11 (Paradouro Café e The West Burger). A lista começa no Kampeki Sushi (topo confirmado) e **ainda não termina**: depois do Grano Forneria vêm Paradouro Café, Guido Café & Cia e The West Burger, e embaixo deste há pelo menos mais um cartão, com o nome escondido pela barra de navegação. A lista carrega mais cupons quando chega ao fim.

- Não há pontos de anúncio sem emenda: em todos os prints o cupom seguinte aparece no rodapé do anterior.
- **Dois cupons do Urban 1736** e **dois do Comidas de Boteco**, com ofertas diferentes, são registrados como cupons separados.
- **Nomes completados por dedução:** Bocasanta Pub e Pizza, Churras in Box Canoas e Novo Hamburgo, Darna Cozinha Mediterrânea, Cremolatto Dr. Barcelos, Domino's Pizza Canoas, Família Kabana Pizzaria, Mas Bah Tchê!, Oak's Burritos y Bowls, Churrascaria Passoquinha, Nonno Eugênio Pizzeria, Manjericão Toscano.
- **Nomes que continuam cortados:** nenhum. Empório 22 Wine & Bar e Rodrigues Estação Gourmet foram completados pela tela de detalhe.
- **Banca do Açaí:** a oferta muda por dia (terça e quinta, rodízio de crepes com reserva; sexta a domingo, um crepe à la carte) e está registrada inteira no texto do cupom.

### Detalhes do Canoas (vídeo de 12/11/2026)

Uma gravação de tela (15 partes de 90 s, enviadas em três lotes: 00–04, 05–09 e 10–14) abriu os cupons 1 a 100 da lista, do Kampeki Sushi ao Grano Forneria. São 98 cupons com detalhes, todos conferidos em imagem.

- **Sem detalhes:** Família Kabana (sumiu da lista), o segundo Urban 1736 (aparece na lista, entre The Big Mamma e O Artesão, mas não foi aberto) e os cupons depois do Grano Forneria (Paradouro Café, Guido Café & Cia, The West Burger e o que vier depois).
- **Mudanças vistas no vídeo:** o Shrek Lanches agora oferece um cachorro-quente salsicha (antes, um xis salada); o Guido Café & Cia ganhou oferta (qualquer doce do cardápio + um café com leite, igual ou de menor valor).
- **A barra de categorias do app**, rolada até o fim, mostra as mesmas categorias de `categoriasApp`: Hamburgueria, Italiano, Restaurante, Oriental, Bar, Culinária Internacional, Culinária Regional… Saudável, Carnes, ParkShopping Canoas, Stop Food Park e Garden Containers.
- **Aviso momentâneo não importado:** o Grano Forneria mostrava "O estabelecimento não está atendendo ao tour hoje".

- **Família Kabana Pizzaria não aparece mais na lista do app:** o Numa Bar vai direto para o Balanceado. Ela não estava marcada como usada. Continua na carteira, sem detalhes, até alguém confirmar se saiu do programa.
- **Tela de detalhe do Canoas:** nome, categorias do app (`categoriasApp`), unidade, tabela com Manhã/Tarde e Noite, ícone de feriados, etiquetas (só aparecem "Espaço Kids" e "Aceita Pet") e "Regras do estabelecimento". As "Regras de utilização" são iguais em todos os cupons e não foram copiadas.
- **Feriados:** os 34 mostram "Não Aceita". **Datas comemorativas:** o app não mostra ícone; as regras gerais dizem que nenhum cupom vale em datas comemorativas (Carnaval, Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais, Natal e Ano Novo), então ficou `false` em todos.
- **Horários:** as duas colunas viram faixas no mesmo formato do Tour (`"11:30 - 15:00; 17:00 - 22:00"`). Dia com "-" nas duas colunas não vale.
- **Cidades fora de Canoas:** El Guerrero (Gravataí); 51 Bar e Cozinha e Sweet Life (São Leopoldo); Numa Bar, Café da Lila e Banca do Açaí (Esteio); Rancho Fat Bull (Ivoti); Bomburguer e La Giovanas (Sapucaia do Sul); Don Zarichta e Churras in Box Novo Hamburgo (Novo Hamburgo); Mas Bah Tchê! e O Velho Burguer (Nova Santa Rita); Trempe Parrilla (Viamão); Porto Burger e Nonno Eugênio (Guaíba); Okawa Sushi Bar (Cachoeirinha); Confraria 110 (Esteio); The Big Mamma e Manjericão Toscano (Novo Hamburgo); Shrek Lanches (Nova Santa Rita).
- **Ordem e nomes atualizados pelo vídeo:** Café Normal agora vem antes do segundo Comidas de Boteco (posições 54 e 55 trocadas). O segundo Comidas de Boteco é a unidade "Comidas de Boteco Garden" (Avenida Açucena), e Empório 22 virou "Empório 22 Wine & Bar".
- **Regras com aviso:** o Kampeki é o único cupom que exige reserva antecipada, com sinal de R$ 100 por pessoa; o Darna atende mediante reserva; o Sushiaki só aceita consumo no local; o Buteco Comedy só funciona em dia de show (ver o Instagram @butecocomedy); a Trempe Parrilla pede reserva de sexta a domingo; o OCA Café & Brunch só vale no almoço, das 11h às 15h.
- **Pequenas correções de grafia nas regras:** "sequencia" → "sequência", "burguer" → "burger", "Rodizio" → "Rodízio", "segundo pizza" → "segunda pizza", "segunda saladas" → "segunda salada", "igual ou menor valor" → "igual ou de menor valor", "a segundo pizza" → "a segunda pizza", "o segundo costelinha" → "a segunda costelinha", "o segundo um cesto" → "o segundo cesto", "fatia bolo" → "fatia de bolo", "waffer de igual" → "waffle igual", "Wook" → "wok".

## Pendências da fase 1 (Poa em Dobro)

São 280 cupons, vindos de 99 prints enviados em sete lotes. Cada lote vinha antes do anterior na lista do app, então as posições ficaram: lote 7 = 1–8, lote 6 = 9–52, lote 5 = 53–98, lote 4 = 99–144, lote 3 = 145–189, lote 2 = 190–235, lote 1 = 236–280.

- **Di Toni:** já foi usado (marcado como usado na carteira, sem data). A oferta não foi registrada.
- **Possíveis lacunas:** em quinze pontos o print termina num anúncio e o seguinte já começa em outro cupom, então não dá para confirmar que nenhum ficou de fora:
  - Lucho Burger → Bistrô do Mercado
  - Joe Hamburgueria → D'Juca Confeitaria
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

  O fim (depois do Di Toni) não está confirmado. O Sabor de Luna parece ser o primeiro cupom da lista, mas o card aparece levemente cortado no print. As emendas Freddo → Iaiá Bistrô, Comfy Pizza Napoletana → A Costela Burger e Kioske do Pirata → Pradie Bakery estão confirmadas.
- **Nomes cortados no app e ainda incompletos:** "Machry Armazém e…", "Ponto Zero Bar e C…" e "Raw Restaurante e…" (o logo não mostra o resto). Estão registrados como Machry Armazém, Ponto Zero Bar e Raw Restaurante.
- **Nomes cortados no app e completados a partir do logo:** Ratskeller Restaurante, Ciao Pizzeria Napoletana, Don Francesco Pastelaria, Salvador Carlos Gomes, Doralice Cantinho Saudável, Comfy Pizza Napoletana, La Chiviteria Restaurante (o "Restaurante" é dedução a partir de "Resta…"), Chica Maria Cocina y Bar, Churrascaria O Espeto de Ouro, Startt & Brothers Café, O Burguês Hamburgueria, Restaurante Hotel Intercity, Restaurante Madregaia, Biergarten Cervejaria, Usina de Massas Pocket, Famiglia Facin Casa Nápoles, Restaurante Figueiras, Rooster Crispy Kitchen, Edu_ Terrário Urbano, Primeiro Reino Burger, Mimô Brownie & Bistrô, Garibaldi Bar e Assado, Med Gastro Giardino, Quincho Parrilla y Bar, Du Nordeste Bom Fim, Johnny & Julie Doceria, Squisito Fatta a Mano, Confeitaria Dona Inês, Pueblo Casa Mexicana, Lê Bru Confeitaria, Marquês Empório Parrilla, Parrilla Hecho a Mano, Fornellone Ristorante, El Guerrero Mexican Food, Alcabar da Fábrica, Markt Mac and Cheese, Shakespeare Casa de Chá, Pipoca de Ipanema Gourmet, Bella Gula MedCenter.
- **Pequenas correções de grafia no texto do app:** "lIncendie" → "Incendie", "burguer"/"hamburguer" → "burger"/"hambúrguer" (exceto em nomes de estabelecimento), "amendoas" → "amêndoas", "cheeseou" → "cheese ou", "um experiência" → "uma experiência", "uma arepas" → "uma arepa", "Zaituna Arabe" → "Zaituna Árabe", "El Patron" → "El Patrón" (como no logo), "menu koreano" → "menu coreano", "300gr" → "300 g", "um Iscas" → "iscas".
- O status "Aberto agora / Fechado" do app não foi importado, porque valia só para a hora do print.
