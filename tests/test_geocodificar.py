"""Testes do scripts/geocodificar.py que não usam a rede.

Rode da raiz do repositório: python3 -m unittest tests/test_geocodificar.py
"""
import importlib.util
import pathlib
import sys
import unittest

RAIZ = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("geocodificar", RAIZ / "scripts" / "geocodificar.py")
geo = importlib.util.module_from_spec(spec)
sys.argv = ["geocodificar.py", "/dev/null"]
spec.loader.exec_module(geo)


class RuaNumero(unittest.TestCase):
    def test_formatos_do_app(self):
        casos = {
            "Avenida Praia de Belas, Nº 1181, Shopping Praia de Belas": ("Avenida Praia de Belas", "1181"),
            "Rua João Alfredo, Nº 395": ("Rua João Alfredo", "395"),
            "Avenida Praia de Belas Nº 3080, Acesso a Passarela": ("Avenida Praia de Belas", "3080"),
            "Praça da Alfândega Nº 1, Loja 6": ("Praça da Alfândega", "1"),
            "Rua Dr. Barcelos Nº 209, Loja 09": ("Rua Dr. Barcelos", "209"),
            "Av. Ipiranga, 5200 (Bourbon)": ("Av. Ipiranga", "5200"),
            "Estrada sem numero": ("Estrada sem numero", None),
        }
        for entrada, esperado in casos.items():
            self.assertEqual(geo.rua_numero(entrada), esperado, entrada)


class Bairro(unittest.TestCase):
    def test_compara_sem_acento_e_por_parte(self):
        r = {"end": {"suburb": "Petrópolis", "city": "Porto Alegre"}}
        self.assertTrue(geo.no_bairro(r, "Petropolis"))
        self.assertTrue(geo.no_bairro({"end": {"suburb": "Centro Histórico"}}, "Centro"))
        self.assertFalse(geo.no_bairro({"end": {"suburb": "Morro Santana"}}, "Petrópolis"))

    def test_distancia(self):
        # Praça da Matriz até o Mercado Público: ~0,6 km
        d = geo.km({"lat": -30.0333, "lng": -51.2303}, {"lat": -30.0277, "lng": -51.2280})
        self.assertAlmostEqual(d, 0.66, delta=0.1)


class ArquivoGeo(unittest.TestCase):
    def test_todo_endereco_dos_dados_tem_coordenada(self):
        import json
        geojson = json.loads((RAIZ / "data" / "geo.json").read_text())
        faltam = []
        for f in sorted((RAIZ / "data").glob("*.json")):
            if f.name == "geo.json":
                continue
            for c in json.loads(f.read_text())["cupons"]:
                for u in [c.get("unidade")] + list(c.get("outrasUnidades") or []):
                    if u and (u.get("endereco") or u.get("bairro")) and u.get("cidade") and geo.chave(u) not in geojson:
                        faltam.append(geo.chave(u))
        self.assertEqual(faltam, [], "rode scripts/geocodificar.py para os endereços novos")

    def test_precisoes_validas(self):
        import json
        geojson = json.loads((RAIZ / "data" / "geo.json").read_text())
        self.assertTrue(all(v["precisao"] in {"endereco", "rua", "bairro", "cidade"} for v in geojson.values()))


if __name__ == "__main__":
    unittest.main()
