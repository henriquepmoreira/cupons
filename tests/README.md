# Testes da carteira

Rodam também no GitHub a cada push em `claude/**` e a cada pull request (`.github/workflows/testes.yml`).

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
- `window.__falhaEscrita = "<código>"` faz os `update()` falharem com esse código (`not_granted`, `quota_exceeded`, `unavailable`…);
- `atrasoBanco` (ms), `semBanco` e `cache` (`{ em, cupons }` posto no localStorage antes de abrir) simulam banco lento, link aberto sem login e a lista guardada; `esperarCartoes: false` devolve a página logo depois de navegar;
- o Leaflet do mapa vem de `tests/node_modules/leaflet` (no lugar do cdnjs) e os ladrilhos do OpenStreetMap são imagens vazias; `pg.__atrasoGeo` (ms) atrasa o `geo.json` a partir do próximo carregamento;
- `geoJson` troca o conteúdo do `geo.json` (ex.: o compacto publicado);
- `snapshot` e `regras` servem a cópia publicada e o `regras.json` (sem eles, 404); `site: true` põe a marca do site do Pages (a página registra `sw.js`, que dá 404);
- lista completa por padrão (os testes leem botões que a compacta esconde); `compacta: true` abre com a compacta, o padrão da página;
- data e hora fixas (`abrir({ data: "2026-11-20T12:30:00" })`), localização simulada (`localizacao`), tema, largura e preferências salvas.

As verificações conferem relações ("o chip do feriado tem menos cupons que o de hoje") em vez de números exatos, para os testes não quebrarem quando os dados mudam.

## O que cada arquivo cobre

| arquivo | o quê |
|---|---|
| `datas.test.js` | validade dos planos no topo, feriados (20/11/2026), filtro Data, plano vencido, preferência antiga "Vale hoje" |
| `mesmo-lugar.test.js` | aviso "Também em…", comparação de ofertas, sugestão de qual usar, "Ver juntos" e foco ao voltar, aviso ao marcar como usado |
| `filtros.test.js` | atalhos Pet e Kids, aviso "só Tour", comodidades por unidade, shopping, turno, aceita em datas comemorativas, abas do painel (setas e contadores), linha de filtros ativos (remover e foco), sem rolagem lateral no celular |
| `perto.test.js` | ordem por distância com localização permitida, raio, localização negada, bairro salvo, sem `geo.json` |
| `lista.test.js` | lotes de 40 e foco do "Mostrar mais", lote mantido ao usar/favoritar, cartões reaproveitados, painéis montados ao abrir, ordem por categoria, etiqueta "Agora · até / a partir das / Encerrado hoje", topo compacto no celular, quatro atalhos inteiros de 320 a 412 px, barra que some ao rolar para baixo e volta ao subir (nunca no computador), lista nova montada em duas etapas (ordem certa, sem duplicar), "Voltar ao topo", mesmo lugar refeito só quando muda um nome |
| `cache.test.js` | lista guardada no navegador: guardada depois do banco, mostrada na hora com banco lento e trocada pela do banco, aviso só quando demora, favorito antes do banco, sem banco, cópia estragada, lista guardada enxuta (sem regras nem vazios), cópia sem login com as regras chegando depois (painel e busca) |
| `acessibilidade.test.js` | árvore de acessibilidade do Chrome (todo cartão completo; menos de 5 mil nós), poucos nós trocados por favorito, foco nunca sob a barra fixa, axe-core nos temas claro e escuro; o que o leitor ouve (títulos sem as maiúsculas do CSS, sem ·/×/✓ falados), regras em lista, foco quando o botão tocado some, aviso numa região ao vivo fixa, ✓ da compacta sem descrição e depois da oferta, mapa do site em português; botões de cupons com o mesmo nome diferenciados, foco fora do "Voltar ao topo", título sem rolagem lateral com texto ampliado, barra recolhida com o celular deitado, "Desfeito." falado; níveis de título, mudança de outro aparelho (sem anúncio, foco no vizinho), datas por extenso; "Valendo agora" sem pular o foco a cada minuto, gesto de voltar fecha o Filtros; uma fala por ação (sem total repetido) e mapa sem fala dupla; espaçamento de texto ampliado, tecla buscar, aviso sem coordenadas; paradas do TalkBack no cartão (modelo do Chrome do Android), áreas de toque de 44 px, aviso ao abrir pela linha; horários como lista para o leitor, "Ordenar" uma vez, aviso falado limpo depois de lido; total e avisos alcançáveis com o Filtros em tela cheia; foco no Filtros ao girar o celular; gravação recusada desfaz a mudança na tela |
| `desempenho.test.js` | com a CPU 4× mais lenta, favoritar, atualizar o banco, digitar, abrir o painel Filtros e tocar num chip ficam abaixo de 400 ms |
| `test_sincronizar.py` | sincronização banco ↔ arquivos: sem diferença, diferença nas duas direções, cupom novo e cupom só no banco |
| `tamanhos.test.js` | limites de tamanho da página e dos arquivos publicados (gerados de `data/*.json`), cópia enxuta e endereço das fontes |
| `sw.test.js` | service worker do site no Node: fontes guardadas na instalação (só o subconjunto latino), instalação sem rede para as fontes |
| `test_gerar_snapshot.py` | cópia enxuta (o que sai e o que fica) e `regras.json` à parte |
| `test_geocodificar.py` | leitura de rua e número, comparação de bairro, distância, todo endereço dos dados com coordenada |

## Cuidado ao escrever testes de acessibilidade

Leia a árvore do Chrome (`arvoreAcessibilidade(pg)`, via CDP `Accessibility.getFullAXTree`) e `textContent`. `innerText` e `ariaSnapshot` leem o DOM: em 17/11/2026, um `content-visibility: auto` deixou os cartões fora da tela vazios para o TalkBack, e um teste com `ariaSnapshot` não percebeu.

O TalkBack de verdade só dá para testar no celular. Estes testes medem a árvore que ele recebe.
