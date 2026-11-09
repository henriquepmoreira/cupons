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

## Pendências da fase 1 (Poa em Dobro)

São 182 cupons, vindos de 64 prints enviados em quatro lotes. Cada lote vinha antes do anterior na lista do app, então as posições ficaram: lote 4 = 1–46, lote 3 = 47–91, lote 2 = 92–137, lote 1 = 138–182.

- **Di Toni:** a oferta ficou cortada no print.
- **Possíveis lacunas:** em doze pontos o print termina num anúncio e o seguinte já começa em outro cupom, então não dá para confirmar que nenhum ficou de fora:
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

  O início (antes da Pradie Bakery) e o fim (depois do Di Toni) também não estão confirmados.
- **Nomes cortados no app e ainda incompletos:** "Machry Armazém e…" e "Ponto Zero Bar e C…" (o logo não mostra o resto). Estão registrados como Machry Armazém e Ponto Zero Bar.
- **Nomes cortados no app e completados a partir do logo:** Biergarten Cervejaria, Usina de Massas Pocket, Famiglia Facin Casa Nápoles, Restaurante Figueiras, Rooster Crispy Kitchen, Edu_ Terrário Urbano, Primeiro Reino Burger, Mimô Brownie & Bistrô, Garibaldi Bar e Assado, Med Gastro Giardino, Quincho Parrilla y Bar, Du Nordeste Bom Fim, Johnny & Julie Doceria, Squisito Fatta a Mano, Confeitaria Dona Inês, Pueblo Casa Mexicana, Lê Bru Confeitaria, Marquês Empório Parrilla, Parrilla Hecho a Mano, Fornellone Ristorante, El Guerrero Mexican Food, Alcabar da Fábrica, Markt Mac and Cheese, Shakespeare Casa de Chá, Pipoca de Ipanema Gourmet, Bella Gula MedCenter.
- **Pequenas correções de grafia no texto do app:** "lIncendie" → "Incendie", "burguer"/"hamburguer" → "burger"/"hambúrguer" (exceto em nomes de estabelecimento), "amendoas" → "amêndoas", "cheeseou" → "cheese ou", "um experiência" → "uma experiência", "uma arepas" → "uma arepa", "Zaituna Arabe" → "Zaituna Árabe".
- O status "Aberto agora / Fechado" do app não foi importado, porque valia só para a hora do print.
