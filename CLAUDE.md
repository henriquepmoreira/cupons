# Cupons em Dobro

Antes de qualquer tarefa neste repositório, leia **`TRANSFERENCIA.md` inteiro** (onde está tudo, regras que evitam estragos, passo a passo de publicação, pendências e histórico) e depois as seções do `README.md` ligadas ao pedido. Siga as regras da seção 2 do `TRANSFERENCIA.md`.

## Lembretes rápidos

- Converse em português, de forma direta.
- O branch padrão é `claude/clever-edison-q4u03f` (não existe `main`): parta dele e confira se há pull request aberto de outra sessão.
- Banco do artifact: exporte e confira com `scripts/sincronizar.py` antes de gravar; em documentos que já existem use `update`, nunca `set`.
- Privacidade: endereço e coordenadas de "Meus lugares" ficam só na área privada do banco (`data/users/...`), nunca no repositório, na página, na cópia sem login ou no site.
- Mudou a página ou os dados: rode os testes (`cd tests && npm test`; também rodam no GitHub a cada push e PR), republique o artifact (abaixo) e regenere o site (`scripts/gerar-site.py`).
- No fim, atualize o `TRANSFERENCIA.md` (situação, pendências e histórico).

## Publicar a página: autorização permanente

O dono do repositório autorizou, para **todas as sessões deste repositório**, republicar o artifact https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc **sempre que necessário**, sem pedir antes (registrado em 18/11/2026). Avise depois de publicar.

- Vale para atualizar a página publicada depois de mudar `cupons.html`, `data/geo.json` ou o banco (inclusive a cópia sem login, `snapshot.json`).
- Siga o passo a passo da regra 4 do `TRANSFERENCIA.md`: testes (`cd tests && npm test`), exportar o banco e conferir com `scripts/sincronizar.py`, gerar `snapshot.json` e `regras.json`, publicar com `url` e `files: {"geo.json": "<saida>/geo.json", "snapshot.json": "<saida>/snapshot.json", "regras.json": "<saida>/regras.json"}`, regenerar `docs/` com `scripts/gerar-site.py`.
- Antes de publicar, leia a versão publicada (`Artifact` com `action: read`) e confira que ela é igual ao `cupons.html` do branch padrão; se não for, junte as mudanças em vez de sobrescrever.
- Não passe `capabilities` (as atuais ficam sozinhas; `{}` apaga as permissões do banco).
- A autorização é só para **publicar** a página. Apagar o artifact, mudar o compartilhamento ou gravar no banco continuam exigindo pedido do usuário (as regras do banco estão no `TRANSFERENCIA.md`).
- `.claude/settings.json` libera a ferramenta Artifact sem perguntar nas sessões deste repositório.
