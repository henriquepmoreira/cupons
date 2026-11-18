"""Testes do scripts/sincronizar.py com uma cópia dos dados e um banco simulado.

Rode da raiz do repositório: python3 -m unittest tests/test_sincronizar.py
"""
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SCRIPT = RAIZ / "scripts" / "sincronizar.py"


def banco_de(dados):
    """o que o banco teria se estivesse igual aos arquivos (como o gerar-seed grava)"""
    docs = {}
    for f in dados.glob("*.json"):
        if f.name == "geo.json":
            continue
        d = json.loads(f.read_text())
        for c in d["cupons"]:
            doc = {k: v for k, v in c.items() if k != "slug"}
            doc.update(programa=d["programa"], usado=c.get("usado", False), usadoEm=c.get("usadoEm"), pendente=c.get("pendente"))
            docs[f"{d['programa']}--{c['slug']}"] = doc
    return docs


class Sincronizar(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.dados = self.tmp / "data"
        shutil.copytree(RAIZ / "data", self.dados)
        self.banco = self.tmp / "banco"
        self.banco.mkdir()
        for id_, doc in banco_de(self.dados).items():
            (self.banco / f"{id_}.json").write_text(json.dumps(doc, ensure_ascii=False))

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def roda(self, *extra):
        r = subprocess.run([sys.executable, str(SCRIPT), str(self.banco), "--dados", str(self.dados), "--saida", str(self.tmp / "saida"), *extra],
                           capture_output=True, text=True, check=True)
        return r.stdout

    def test_igual_nao_gera_nada(self):
        out = self.roda()
        self.assertIn("Marcas diferentes (banco -> arquivo): 0", out)
        self.assertIn("Banco e arquivos iguais", out)
        self.assertEqual(json.loads((self.tmp / "saida" / "writes.json").read_text()), [])

    def test_duas_direcoes(self):
        # a página favoritou e usou um cupom (banco); o arquivo ganhou um nome novo em outro
        f = self.banco / "tour-grande-poa--trigo-pizzaria.json"
        doc = json.loads(f.read_text())
        doc.update(favorito=not doc["favorito"], usado=True, usadoEm="2026-11-18")
        f.write_text(json.dumps(doc, ensure_ascii=False))
        p = self.dados / "poa-em-dobro.json"
        d = json.loads(p.read_text())
        c = next(x for x in d["cupons"] if x["slug"] == "spoleto")
        c["nome"] = "Spoleto Novo Nome"
        p.write_text(json.dumps(d, ensure_ascii=False))

        out = self.roda()
        self.assertIn("Marcas diferentes (banco -> arquivo): 3", out)
        self.assertIn("poa-em-dobro--spoleto: nome", out)
        writes = json.loads((self.tmp / "saida" / "writes.json").read_text())
        self.assertEqual([w["doc_id"] for w in writes], ["poa-em-dobro--spoleto"])
        self.assertEqual(json.loads(pathlib.Path(writes[0]["file_path"]).read_text()), {"nome": "Spoleto Novo Nome"})
        self.assertIsNone(writes[0]["if_version"], "a versão é lida na hora do batch")

        self.roda("--marcas-para-arquivos")
        t = json.loads((self.dados / "tour-grande-poa.json").read_text())
        trigo = next(x for x in t["cupons"] if x["slug"] == "trigo-pizzaria")
        self.assertEqual((trigo["favorito"], trigo["usado"], trigo["usadoEm"]), (doc["favorito"], True, "2026-11-18"))
        self.assertIn('    { "slug": ', (self.dados / "tour-grande-poa.json").read_text(), "formato de um cupom por linha")
        self.assertIn("Marcas diferentes (banco -> arquivo): 0", self.roda())

    def test_cupom_novo_e_cupom_so_no_banco(self):
        (self.banco / "poa-em-dobro--fantasma.json").write_text("{}")
        (self.banco / "poa-em-dobro--spoleto.json").unlink()
        out = self.roda()
        self.assertIn("SÓ NO BANCO (confira): poa-em-dobro--fantasma", out)
        self.assertIn("SÓ NO ARQUIVO (cupom novo, use gerar-seed.py): poa-em-dobro--spoleto", out)


if __name__ == "__main__":
    unittest.main()
