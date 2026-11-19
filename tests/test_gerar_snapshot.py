"""Testes do scripts/gerar-snapshot.py: cópia enxuta e regras.json à parte."""
import importlib.util
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

RAIZ = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("gerar_snapshot", RAIZ / "scripts" / "gerar-snapshot.py")
gs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gs)


class Enxuto(unittest.TestCase):
    def test_tira_regras_e_vazios_mas_mantem_false_que_importa(self):
        c = {"nome": "X", "regras": "texto", "pendente": None, "comodidades": [], "favorito": False,
             "usado": False, "maisUnidades": False, "verRegras": False, "feriados": False,
             "datasComemorativas": False, "ordem": 0, "item": "pizza"}
        self.assertEqual(gs.enxuto(c), {"nome": "X", "feriados": False, "datasComemorativas": False, "ordem": 0, "item": "pizza"})

    def test_mantem_verdadeiros(self):
        c = {"favorito": True, "usado": True, "comodidades": ["Pet"]}
        self.assertEqual(gs.enxuto(c), c)


class Arquivos(unittest.TestCase):
    def test_gera_snapshot_e_regras(self):
        with tempfile.TemporaryDirectory() as tmp:
            banco = pathlib.Path(tmp, "cupons"); banco.mkdir()
            (banco / "poa-em-dobro--a.json").write_text(json.dumps({"programa": "poa-em-dobro", "ordem": 2, "nome": "A", "regras": "Só no almoço", "favorito": False}), encoding="utf-8")
            (banco / "poa-em-dobro--b.json").write_text(json.dumps({"programa": "poa-em-dobro", "ordem": 1, "nome": "B", "regras": None}), encoding="utf-8")
            saida = pathlib.Path(tmp, "saida"); saida.mkdir()
            subprocess.run([sys.executable, str(RAIZ / "scripts" / "gerar-snapshot.py"), str(banco), str(saida / "snapshot.json")], check=True, capture_output=True)
            snap = json.loads((saida / "snapshot.json").read_text(encoding="utf-8"))
            regras = json.loads((saida / "regras.json").read_text(encoding="utf-8"))
            self.assertEqual(snap["regras"], "regras.json")
            self.assertEqual([c["id"] for c in snap["cupons"]], ["poa-em-dobro--b", "poa-em-dobro--a"])
            self.assertTrue(all("regras" not in c and "favorito" not in c for c in snap["cupons"]))
            self.assertEqual(regras, {"poa-em-dobro--a": "Só no almoço"})


if __name__ == "__main__":
    unittest.main()
