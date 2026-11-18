# Testes da carteira

Testes automáticos da página `cupons.html`, do `scripts/geocodificar.py` e do `scripts/sincronizar.py`. Rode antes de republicar a página.

```sh
cd tests
npm install        # só o axe-core; o Playwright já vem instalado no ambiente da nuvem
npm test           # página (node:test + Playwright), geocodificador e sincronização (unittest)
```

- `npm run test:pagina` roda só os da página (uns 20 s).
- `node --test lista.test.js` roda um arquivo.
- `CUPONS_HTML=/caminho/outra.html npm run test:pagina` roda contra outra versão da página. Serve para confirmar que um teste novo pega a regressão que ele promete pegar.
- Fora da nuvem, instale o Playwright antes: `npm i -D playwright && npx playwright install chromium`.

## Como funciona

`lib/pagina.js` abre a página no Chromium como o visualizador do claude.ai faria:

- banco falso com os cupons de `data/*.json` (`id = <programa>--<slug>`);
- `window.__snap()` simula uma atualização do banco;
- `window.__escritas` guarda os `update()` que a página manda ao banco;
- `data/geo.json` servido como `geo.json`; `snapshot.json` responde 404;
- `aba(pg, "onde")` abre o painel Filtros na aba pedida;
- `ajustar(docs)` muda os cupons antes de abrir, para simular um caso que os dados reais não têm;
- data e hora fixas (`abrir({ data: "2026-11-20T12:30:00" })`), localização simulada (`localizacao`), tema, largura e preferências salvas.

As verificações conferem relações ("o chip do feriado tem menos cupons que o de hoje") em vez de números exatos, para os testes não quebrarem quando os dados mudam.

## O que cada arquivo cobre

| arquivo | o quê |
|---|---|
| `datas.test.js` | validade dos planos no topo, feriados (20/11/2026), filtro Data, plano vencido, preferência antiga "Vale hoje" |
| `mesmo-lugar.test.js` | aviso "Também em…", comparação de ofertas, sugestão de qual usar, "Ver juntos" e foco ao voltar, aviso ao marcar como usado |
| `filtros.test.js` | atalhos Pet e Kids, aviso "só Tour", comodidades por unidade, shopping, turno, aceita em datas comemorativas, abas do painel (setas e contadores), linha de filtros ativos (remover e foco), sem rolagem lateral no celular |
| `perto.test.js` | ordem por distância com localização permitida, raio, localização negada, bairro salvo, sem `geo.json` |
| `lista.test.js` | lotes de 40 e foco do "Mostrar mais", lote mantido ao usar/favoritar, cartões reaproveitados, painéis montados ao abrir, ordem por categoria |
| `acessibilidade.test.js` | árvore de acessibilidade do Chrome (todo cartão completo; menos de 5 mil nós), poucos nós trocados por favorito, foco nunca sob a barra fixa, axe-core nos temas claro e escuro |
| `desempenho.test.js` | com a CPU 4× mais lenta, favoritar, atualizar o banco e digitar ficam abaixo de 400 ms |
| `test_sincronizar.py` | sincronização banco ↔ arquivos: sem diferença, diferença nas duas direções, cupom novo e cupom só no banco |
| `test_geocodificar.py` | leitura de rua e número, comparação de bairro, distância, todo endereço dos dados com coordenada |

## Cuidado ao escrever testes de acessibilidade

Leia a árvore do Chrome (`arvoreAcessibilidade(pg)`, via CDP `Accessibility.getFullAXTree`) e `textContent`. `innerText` e `ariaSnapshot` leem o DOM: em 17/11/2026, um `content-visibility: auto` deixou os cartões fora da tela vazios para o TalkBack, e um teste com `ariaSnapshot` não percebeu.

O TalkBack de verdade só dá para testar no celular. Estes testes medem a árvore que ele recebe.
