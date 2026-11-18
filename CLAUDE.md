# Cupons em Dobro

Antes de mexer em dados, no banco ou na página, leia `TRANSFERENCIA.md` (onde está tudo, regras que evitam estragos, passo a passo de publicação) e o `README.md`.

## Publicar a página: autorização permanente

O dono do repositório autorizou, para **todas as sessões deste repositório**, republicar o artifact https://claude.ai/artifact/6YpmFkzyRmo1QhkfRksYGc **sempre que necessário**, sem pedir antes (registrado em 18/11/2026). Avise depois de publicar.

- Vale para atualizar a página publicada depois de mudar `cupons.html`, `data/geo.json` ou o banco (inclusive a cópia sem login, `snapshot.json`).
- Siga o passo a passo da regra 4 do `TRANSFERENCIA.md`: testes (`cd tests && npm test`), exportar o banco e conferir com `scripts/sincronizar.py`, gerar `snapshot.json`, publicar com `url` e `files: {"geo.json": "data/geo.json", "snapshot.json": "<saida>/snapshot.json"}`, regenerar `docs/` com `scripts/gerar-site.py`.
- Antes de publicar, leia a versão publicada (`Artifact` com `action: read`) e confira que ela é igual ao `cupons.html` do branch padrão; se não for, junte as mudanças em vez de sobrescrever.
- Não passe `capabilities` (as atuais ficam sozinhas; `{}` apaga as permissões do banco).
- A autorização é só para **publicar** a página. Apagar o artifact, mudar o compartilhamento ou gravar no banco continuam exigindo pedido do usuário (as regras do banco estão no `TRANSFERENCIA.md`).
- `.claude/settings.json` libera a ferramenta Artifact sem perguntar nas sessões deste repositório.
