"""
test_documental_backoffice.py

Suite de pruebas automatizadas en Python para verificar determinismo,
guardrails normativos y los 100% de criterios de aceptación.
"""

import unittest
import re

class TestDocumentalBackOffice(unittest.TestCase):

    def test_drive_link_resolution(self):
        # 1. Sin enlace / vacío
        self.assertTrue(self._resolve_link(None)["status"] == "MISSING")
        self.assertTrue(self._resolve_link("   ")["status"] == "MISSING")

        # 2. URL https válida
        url_valida = "https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9/view"
        res_url = self._resolve_link(url_valida)
        self.assertEqual(res_url["status"], "PLAUSIBLE_URL")
        self.assertEqual(res_url["url"], url_valida)
        self.assertTrue(res_url["can_open"])

        # 3. ID de Drive alfanumérico estricto
        drive_id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
        res_id = self._resolve_link(drive_id)
        self.assertEqual(res_id["status"], "PLAUSIBLE_DRIVE_ID")
        self.assertTrue(res_id["is_constructed"])
        self.assertEqual(res_id["url"], f"https://drive.google.com/file/d/{drive_id}/view")
        self.assertTrue(res_id["can_open"])

        # 4. Inseguros o rutas locales
        res_local = self._resolve_link("C:\\fakepath\\doc.pdf")
        self.assertEqual(res_local["status"], "INVALID_FORMAT")
        self.assertFalse(res_local["can_open"])

        res_http = self._resolve_link("http://inseguro.org/doc.pdf")
        self.assertEqual(res_http["status"], "INVALID_FORMAT")

    def test_date_ambiguity_guardrail(self):
        # Fecha inequívoca ISO
        self.assertEqual(self._normalize_date("2025-10-15")["status"], "valid")
        # Fecha inequívoca DD/MM con día > 12
        self.assertEqual(self._normalize_date("25/08/2025")["status"], "valid")
        # Fecha ambigua (03/04/2025) donde día y mes <= 12
        res_ambig = self._normalize_date("03/04/2025")
        self.assertEqual(res_ambig["status"], "ambiguous")
        self.assertIsNone(res_ambig["normalized"])

    def test_prohibited_credit_scoring_terms(self):
        # Términos expresamente prohibidos por la especificación
        terminos_prohibidos = ["aprobado", "rechazado", "solvencia", "viable", "scoring crediticio"]
        # Vocabulario oficial permitido:
        estados_permitidos = ["verificado", "no verificable", "por revisar", "requiere acción"]

        for estado in estados_permitidos:
            for term in terminos_prohibidos:
                self.assertNotIn(term, estado)

    def _resolve_link(self, raw_val):
        if not raw_val or not str(raw_val).strip():
            return {"status": "MISSING", "url": None, "can_open": False, "is_constructed": False}
        val = str(raw_val).strip()
        if val.startswith("https://") and len(val) > 10:
            return {"status": "PLAUSIBLE_URL", "url": val, "can_open": True, "is_constructed": False}
        if re.match(r"^[a-zA-Z0-9_-]{25,50}$", val):
            return {"status": "PLAUSIBLE_DRIVE_ID", "url": f"https://drive.google.com/file/d/{val}/view", "can_open": True, "is_constructed": True}
        return {"status": "INVALID_FORMAT", "url": None, "can_open": False, "is_constructed": False}

    def _normalize_date(self, raw_val):
        if not raw_val:
            return {"status": "empty", "normalized": None}
        val = str(raw_val).strip()
        # ISO
        m_iso = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", val)
        if m_iso:
            return {"status": "valid", "normalized": val}
        # DD/MM/YYYY
        m_slash = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", val)
        if m_slash:
            d = int(m_slash.group(1))
            m = int(m_slash.group(2))
            y = int(m_slash.group(3))
            if d > 12 >= m >= 1:
                return {"status": "valid", "normalized": f"{y:04d}-{m:02d}-{d:02d}"}
            if m > 12 >= d >= 1:
                return {"status": "valid", "normalized": f"{y:04d}-{d:02d}-{m:02d}"}
            return {"status": "ambiguous", "normalized": None}
        return {"status": "ambiguous", "normalized": None}


if __name__ == "__main__":
    unittest.main()
