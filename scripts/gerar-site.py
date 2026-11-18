#!/usr/bin/env python3
"""Monta o site do GitHub Pages em docs/: a mesma página do artifact, fora do claude.ai.

Uso:
  1. Exporte o banco (ArtifactData list, collection "cupons", query {"limit": 1000},
     out_dir <pasta>) e confira com scripts/sincronizar.py.
  2. python3 scripts/gerar-site.py <pasta>/cupons

Gera:
  docs/index.html    cupons.html dentro de um documento completo (o artifact põe esse
                     invólucro sozinho; o Pages serve o arquivo como está)
  docs/geo.json      cópia de data/geo.json (distâncias e "Perto de")
  docs/snapshot.json cópia dos cupons, igual à cópia sem login do artifact
  docs/.nojekyll     o Pages serve os arquivos sem processar

Fora do claude.ai a página não tem banco: abre a cópia, só para consulta (favoritar e marcar
como usado continuam no artifact). Em compensação o navegador entrega a localização (GPS),
porque a página roda num endereço https próprio. "Meus lugares" (área privada do banco) não
existe aqui, e nada de data/users entra no site.

O site é público para quem tiver o endereço: entram a lista de cupons, favoritos e usados.
Rode sempre que republicar o artifact, para as duas cópias andarem juntas.
"""
import pathlib
import shutil
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DOCS = RAIZ / "docs"

# mesmo esqueleto que o Artifact põe em volta da página (cupons.html começa no <title>, dentro do body)
CABECA = ('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
          '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
          '<meta name="robots" content="noindex">'
          # a página só registra o service worker (sw.js) quando acha esta marca: no artifact ela não existe
          '<meta name="cupons-site" content="pages">'
          # app na Tela de Início (iOS e Android)
          '<link rel="manifest" href="manifest.webmanifest">'
          '<link rel="apple-touch-icon" href="apple-touch-icon.png">'
          '<link rel="icon" type="image/png" sizes="192x192" href="icone-192.png">'
          '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
          '<meta name="apple-mobile-web-app-title" content="Cupons">'
          '<meta name="apple-mobile-web-app-status-bar-style" content="default">'
          '<meta name="theme-color" content="#ECEFEA" media="(prefers-color-scheme: light)">'
          '<meta name="theme-color" content="#101311" media="(prefers-color-scheme: dark)">'
          '<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
          'body{margin:0;padding:0}[hidden]{display:none!important}</style></head><body>\n')
RODAPE = "\n</body></html>\n"


def main(banco: str) -> None:
    if not pathlib.Path(banco).is_dir():
        sys.exit(f"pasta do banco não encontrada: {banco}")
    DOCS.mkdir(exist_ok=True)
    pagina = (RAIZ / "cupons.html").read_text(encoding="utf-8")
    (DOCS / "index.html").write_text(CABECA + pagina + RODAPE, encoding="utf-8")
    shutil.copyfile(RAIZ / "data" / "geo.json", DOCS / "geo.json")
    subprocess.run([sys.executable, str(RAIZ / "scripts" / "gerar-snapshot.py"), banco, str(DOCS / "snapshot.json")], check=True)
    (DOCS / ".nojekyll").write_text("", encoding="utf-8")
    # service worker (offline e abertura na hora), manifesto e ícones do app na Tela de Início
    for nome in ("sw.js", "manifest.webmanifest", "apple-touch-icon.png", "icone-192.png", "icone-512.png"):
        shutil.copyfile(RAIZ / "scripts" / "site" / nome, DOCS / nome)
    print(f"site em {DOCS}: index.html, geo.json, snapshot.json, sw.js, manifesto e ícones")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
