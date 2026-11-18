# Cupons em Dobro

Antes de qualquer tarefa neste repositório, leia **`TRANSFERENCIA.md` inteiro** (onde está tudo, regras que evitam estragos, pendências e histórico) e depois as seções do `README.md` ligadas ao pedido. Siga as regras da seção 2 do `TRANSFERENCIA.md`.

Lembretes rápidos (os detalhes estão no `TRANSFERENCIA.md`):

- Converse em português, de forma direta.
- O branch padrão é `claude/clever-edison-q4u03f` (não existe `main`): parta dele e confira se há pull request aberto de outra sessão.
- Banco do artifact: exporte e confira com `scripts/sincronizar.py` antes de gravar; em documentos que já existem use `update`, nunca `set`.
- Privacidade: endereço e coordenadas de "Meus lugares" ficam só na área privada do banco (`data/users/...`), nunca no repositório, na página, na cópia sem login ou no site.
- Mudou a página ou os dados: rode os testes (`cd tests && npm test`), republique o artifact (autorização permanente) e regenere o site (`scripts/gerar-site.py`).
- No fim, atualize o `TRANSFERENCIA.md` (situação, pendências e histórico).
