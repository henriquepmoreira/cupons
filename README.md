# Cupons em Dobro

Uma carteira pessoal com os cupons 2 por 1 que ainda não usei do **Poa em Dobro**, do **Tour Grande Poa** e do **Canoas em Dobro**.

- **Artifact:** https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc (privado)
- **Página:** `cupons.html` (publicada como artifact; sem build)
- **Dados de origem:** `data/<programa>.json`, transcritos dos prints da aba Cupons de cada app

## O que a página faz

- Busca por estabelecimento, prato, categoria ou programa (ignora acentos)
- Filtros: programa, situação (disponíveis / usados / todos), favoritos, categoria, tipo de benefício (outro igual × igual ou de menor valor) e cupons que pedem para ver regras
- Ordenação: ordem do app, nome, favoritos primeiro, por categoria (agrupado), por programa (agrupado), usados por último
- Favoritar com o coração e marcar como usado, com opção de desfazer. As duas marcações ficam salvas no banco do artifact.
- Link de mapa para cada estabelecimento

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

Só a pessoa dona do artifact pode gravar no banco (regra `write: owner`).

`data/*.json` é o registro de origem, com a mesma estrutura. Mudanças feitas na página (favoritos, usados) ficam só no banco.
Para importar um programa novo, crie `data/<programa>.json` e gere os documentos com:

```sh
python3 scripts/gerar-seed.py data/<programa>.json <pasta-de-saida>
```

## Tour Grande Poa

São 203 cupons, vindos de 108 prints da aba Vouchers (os dois zips enviados eram idênticos). O app agrupa a lista por tipo de estabelecimento, em ordem alfabética dentro de cada grupo, e a carteira mantém essa ordem. O início (Ah! Casa) e o fim (Vino! Novo Hamburgo) aparecem nos prints.

- **Asterisco = ver regras:** no Tour, um asterisco no texto do cupom indica condições que só aparecem no detalhe. Esses 57 cupons estão marcados como "Ver regras no app".
- **Mesmo restaurante, cupons diferentes:** Gran Forneria (massa/risoto e pizza), Saúde no Copo (wrap, salada e açaí), Chá das Três (café colonial e chá), Banca do Açaí (açaí e crepe) e várias unidades de redes (Spoleto, El Guerrero, Oaks, Menu Poke, Woking, Chiquinho, Cremolatto, Go Coffee, Tortas Doquinha, OCA Pizza…) são cupons separados.
- **Possíveis lacunas:** em nove pontos o print termina num anúncio e o seguinte já começa no cupom de baixo, então não dá para confirmar que nenhum ficou escondido: Espaço Eminente → Gran Armazém, Chavin → Chica Maria, El Guerrero Gravataí → El Guerrero Pontal, Menu Poke Moinhos → Menu Poke ParkShopping, Usina de Massas Granvia → Saúde no Copo, ViVa Padaria → Buonissima Canoas, Montecchio → Morango & Alecrim, Inner → Janela Bar e Poeta Bar → Rancho Boiadeiros. (Xuvisko Rodízio → Bomba Burguer está confirmada.)
- **Nomes completados por dedução:** Coco Bambu - Porto Alegre, Menu Poke - BarraShoppingSul e ParkShopping, Woking - Mercado Público, Spoleto Bourbon Ipiranga e Iguatemi Porto Alegre, Cheirin Bão - ParkShopping e Praia de Belas, Chiquinho Canoas Shopping / Novo Hamburgo / ParkShopping, Go Coffee Cachoeirinha e São Leopoldo, Mais 1 Café - Independência, Prazer Donuts Canoas, Startt & Brothers Café, Tortas Doquinha Porto Alegre, Troppo Buono Moinhos, ViVa Padaria e Cafeteria, Buonissima Canoas e Sapucaia, Domino's Pizza Canoas, OCA Pizza - Ocarrinho Cais Embarcadero, Mark - Auxiliadora, Bom Fim e Cidade Baixa, Buteco Comedy Bar - Novo Hamburgo, Cervejaria Artesanal Horst & Biermann, Caramello Bolos Caseiros, Cremolatto Dr. Barcelos, Ah! Casa - café, bistrô e confeitaria.
- **Nomes que continuam cortados (com "…"):** Empório 22 Wine &…, El Guerrero - Barra… e Vila R…, Oaks Burritos - Park…, Quiero Café - Barra…, Portofino - Rodízio de Massas e…, Spoleto Park Bourb…, Café Con Acento by…, Pallina Di Latte - Sh…, PopCorn Gourmet - …, The Waffle King Gr… e - S…, Tortas Doquinha Sa…, OCA Pizza - Ocarri… e Oca Pizza - Ocarrin… (duas unidades), Janela Bar POA - Zo…, Mark - Harmonia, R….

## Canoas em Dobro

São 101 cupons, vindos de 34 prints da aba Cupons. A lista começa no Kampeki Sushi (topo confirmado) e **não termina** no último print: abaixo do Grano Forneria aparece o topo do card "Guido Café & Cia", registrado como pendente, e pode haver mais cupons depois dele.

- Não há pontos de anúncio sem emenda: em todos os prints o cupom seguinte aparece no rodapé do anterior.
- **Dois cupons do Urban 1736** e **dois do Comidas de Boteco**, com ofertas diferentes, são registrados como cupons separados.
- **Nomes completados por dedução:** Bocasanta Pub e Pizza, Churras in Box Canoas e Novo Hamburgo, Darna Cozinha Mediterrânea, Cremolatto Dr. Barcelos, Domino's Pizza Canoas, Família Kabana Pizzaria, Mas Bah Tchê!, Oak's Burritos y Bowls, Churrascaria Passoquinha, Nonno Eugênio Pizzeria, Manjericão Toscano.
- **Nomes que continuam cortados:** Empório 22 Wine &…, Rodrigues Estação….
- **Banca do Açaí:** a oferta muda por dia (terça e quinta, rodízio de crepes com reserva; sexta a domingo, um crepe à la carte) e está registrada inteira no texto do cupom.

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
