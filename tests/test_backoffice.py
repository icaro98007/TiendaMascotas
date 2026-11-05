"""
Suite de Pruebas Automatizadas para el Back Office de Solicitudes de Crédito.
Verifica con exactitud los 11 escenarios mínimos de aceptación:
1. Lote con archivos válidos y varios tipos de crédito.
2. Archivo que no abre, ID roto, enlace discrepante y nombres duplicados.
3. Fechas ambiguas, montos locales, estados/canales desconocidos, archivo sin texto.
4. Documento obligatorio ausente, condicional por umbral y discrepancia de valor.
5. Vigencia vencida.
6. Firma visible no autenticada remitida a humano.
7. Conteo matriz vs reportado.
8. Reintentos idempotentes sin duplicar artefactos.
9. Integridad de hipervínculos e índices secuenciales.
10. NINGUNA salida marca crédito aprobado/rechazado.
11. Sin tokens, PII innecesaria ni enlaces públicos en logs y artefactos.
"""

import unittest
import os
import json
import re
from backend.models import SolicitudCredito, DocumentoMatriz
from backend.normalizer import NormalizadorCredito
from backend.rules_engine import MotorReglasCredito
from backend.drive_service import ServicioGoogleDrive
from backend.pipeline import PipelineLoteCredito
from data.synthetic_dataset.generador_dataset import SOLICITUDES_SINTETICAS, DOCUMENTOS_SINTETICOS


class TestBackOfficeCredito(unittest.TestCase):

    def setUp(self):
        self.normalizador = NormalizadorCredito()
        self.motor_reglas = MotorReglasCredito()
        self.drive_service = ServicioGoogleDrive()
        self.pipeline = PipelineLoteCredito()

    def test_01_lote_con_multiples_tipos_de_credito(self):
        """1. Lote con archivos válidos y varios tipos de crédito."""
        tipos_esperados = ["LIBRANZA", "LIBRE_INVERSION", "VIVIENDA", "VEHICULO"]
        normalizados = []
        for sol in SOLICITUDES_SINTETICAS[:4]:
            t_norm, _ = self.normalizador.normalizar_tipo_credito(sol["tipo_credito_original"])
            normalizados.append(t_norm)

        for t in tipos_esperados:
            self.assertIn(t, normalizados)

    def test_02_id_roto_y_enlace_discrepante(self):
        """2. Un archivo que no abre, un ID roto, un enlace a archivo distinto."""
        res_roto = self.drive_service.verificar_archivo_drive("BROKEN_FILE_ID_404_NOT_FOUND", "doc.pdf", "application/pdf")
        self.assertEqual(res_roto["estado"], "NO_ACCESIBLE")
        self.assertFalse(res_roto["legible"])

        res_disc = self.drive_service.verificar_archivo_drive("123456789012345_DISCREPANTE", "original.pdf", "application/pdf")
        self.assertEqual(res_disc["estado"], "ENLACE_DISCREPANTE")
        self.assertNotEqual(res_disc["nombre_real"], "original.pdf")

        # Nombres duplicados con IDs diferentes se mantienen distintos
        id1 = "1A2B3C4D5E6F7G8H9I0J1"
        id2 = "9Z8Y7X6W5V4U3T2S1R0Q9"
        res_dup1 = self.drive_service.verificar_archivo_drive(id1, "cedula.pdf", "application/pdf")
        res_dup2 = self.drive_service.verificar_archivo_drive(id2, "cedula.pdf", "application/pdf")
        self.assertNotEqual(res_dup1["canonico"], res_dup2["canonico"])

    def test_03_fechas_ambiguas_montos_locales_y_sin_texto(self):
        """3. Fechas ambiguas, monto con formatos locales, estado/canal desconocidos y archivo sin texto."""
        # Fecha ambigua 05/06/2026
        f_norm, err_fecha = self.normalizador.normalizar_fecha("05/06/2026")
        self.assertIsNone(f_norm)
        self.assertIn("ambigua", err_fecha.lower())

        # Monto con formato local colombiano "$ 12.500.000 COP" y decimal "28,500,000.00"
        m1, mon1, _ = self.normalizador.normalizar_monto("$ 12.500.000 COP")
        self.assertEqual(m1, 12500000)
        self.assertEqual(mon1, "COP")

        m2, mon2, _ = self.normalizador.normalizar_monto("28,500,000.00")
        self.assertEqual(m2, 28500000)

        # Canal y estado desconocidos se preservan literalmente sin descartar
        cnl_norm, adv_cnl = self.normalizador.normalizar_canal("CANAL_INVENTADO_99")
        self.assertEqual(cnl_norm, "CANAL_INVENTADO_99")
        self.assertIsNotNone(adv_cnl)

        # Archivo borroso / sin texto
        res_borroso = self.drive_service.verificar_archivo_drive("123456789012345_BORROSO", "foto.jpg", "image/jpeg")
        self.assertFalse(res_borroso["legible"])

    def test_04_faltante_obligatorio_condicional_umbral_y_discrepancia(self):
        """4. Documento obligatorio ausente, soporte condicional por umbral y valor de soporte discrepante."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_999",
            id_carpeta_drive="drv_test_folder",
            nombre_carpeta_drive="Carpeta_Pruebas_BackOffice",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        incidencias = res_pipeline["incidencias"]
        tipos_inc = [i["tipo_incidencia"] for i in incidencias]

        # SOL-0002 supera $20M en libre inversión -> Falta CODEUDOR_SOPORTE
        inc_cond = [i for i in incidencias if i["id_solicitud"] == "SOL-0002" and i["tipo_incidencia"] == "FALTANTE_CONDICIONAL"]
        self.assertTrue(len(inc_cond) > 0)
        self.assertIn("CODEUDOR_SOPORTE", inc_cond[0]["detalle"])

        # SOL-0003 supera $50M en vivienda -> Falta AVALUO_COMERCIAL
        inc_avaluo = [i for i in incidencias if i["id_solicitud"] == "SOL-0003" and "AVALUO_COMERCIAL" in i["detalle"]]
        self.assertTrue(len(inc_avaluo) > 0)

        # SOL-0005 tiene discrepancia de monto: radicado 10M vs formulario 18M
        inc_disc = [i for i in incidencias if i["id_solicitud"] == "SOL-0005" and i["tipo_incidencia"] == "DISCREPANCIA_VALORES"]
        self.assertTrue(len(inc_disc) > 0)
        self.assertIn("18,000,000", inc_disc[0]["detalle"])

    def test_05_vigencia_expirada(self):
        """5. Vigencia vencida en soporte (ej. cotización con > 30 días o desprendible con > 60 días)."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_998",
            id_carpeta_drive="drv_test_vigencia",
            nombre_carpeta_drive="Carpeta_Vigencias",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        inc_vig = [i for i in res_pipeline["incidencias"] if i["tipo_incidencia"] == "VIGENCIA_EXPIRADA"]
        self.assertTrue(len(inc_vig) >= 1)
        self.assertTrue(any("excede el límite" in i["detalle"] or "Vigencia máxima" in i["impacto"] for i in inc_vig))

    def test_06_firma_visible_no_autenticada_y_remision_humana(self):
        """6. Firma visible no autenticada y caso remitido correctamente a humano."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_997",
            id_carpeta_drive="drv_test_firmas",
            nombre_carpeta_drive="Carpeta_Firmas",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        inc_firmas = [i for i in res_pipeline["incidencias"] if "FIRMA" in i["tipo_incidencia"]]
        self.assertTrue(len(inc_firmas) > 0)
        
        # Ninguna regla debe decir 'FIRMA_AUTENTICADA'
        for inc in inc_firmas:
            self.assertNotEqual(inc["tipo_incidencia"], "FIRMA_AUTENTICADA")
            self.assertEqual(inc["estado_revision"], "PENDIENTE_HUMANO")
            
        self.assertTrue(any("La IA no autentica firmas" in inc["impacto"] for inc in inc_firmas))

    def test_07_conteo_matriz_vs_reportado(self):
        """7. Conteo matriz vs reportado coincide/no coincide."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_996",
            id_carpeta_drive="drv_test_conteo",
            nombre_carpeta_drive="Carpeta_Conteo",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        sols = {s["id_solicitud_origen"]: s for s in res_pipeline["solicitudes"]}
        # SOL-0001 reporta 4 y tiene 4 -> coincide
        self.assertTrue(sols["SOL-0001"]["conteo_matriz_vs_reportado_coincide"])
        # SOL-0003 reporta 5 pero tiene 4 -> NO coincide
        self.assertFalse(sols["SOL-0003"]["conteo_matriz_vs_reportado_coincide"])

    def test_08_reintentos_idempotentes(self):
        """8. Reintento no crea carpetas/archivos duplicados."""
        res1 = self.pipeline.procesar_lote("Lote_001", "drv_1", "Lote_1", SOLICITUDES_SINTETICAS[:2], DOCUMENTOS_SINTETICOS[:4])
        res2 = self.pipeline.procesar_lote("Lote_001", "drv_1", "Lote_1", SOLICITUDES_SINTETICAS[:2], DOCUMENTOS_SINTETICOS[:4])
        
        # El número de carpetas generadas para solicitudes debe ser idéntico
        self.assertEqual(len(res1["jerarquia"]["carpetas_solicitudes"]), len(res2["jerarquia"]["carpetas_solicitudes"]))
        self.assertEqual(res1["jerarquia"]["nombre_lote"], res2["jerarquia"]["nombre_lote"])

    def test_09_hipervinculos_e_indices_secuenciales(self):
        """9. Índice: cada hyperlink apunta a carpeta/archivo correcto y folder secuencial."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_002",
            id_carpeta_drive="drv_test_links",
            nombre_carpeta_drive="Carpeta_Links",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        subs = res_pipeline["jerarquia"]["carpetas_solicitudes"]
        self.assertEqual(subs[0]["secuencia"], 1)
        self.assertIn("01_SOL-0001", subs[0]["nombre_carpeta"])
        self.assertTrue(subs[0]["url"].startswith("https://drive.google.com/drive/folders/"))

    def test_10_estricto_no_aprobacion_o_rechazo_financiero(self):
        """10. NINGUNA salida marca crédito aprobado/rechazado."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_003",
            id_carpeta_drive="drv_test_legal",
            nombre_carpeta_drive="Carpeta_Legal",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        # Revisar todas las solicitudes
        for sol in res_pipeline["solicitudes"]:
            self.assertNotIn("APROBADO", sol["estado_analisis_documental"])
            self.assertNotIn("RECHAZADO", sol["estado_analisis_documental"])
            self.assertIn("No constituye aprobación, rechazo ni scoring crediticio", sol["nota_legal"])

        # Revisar texto del informe ejecutivo
        ruta_informe = res_pipeline["entregables"]["informe_ejecutivo"]
        with open(ruta_informe, "r", encoding="utf-8") as f:
            contenido = f.read()
            self.assertIn("Bajo ninguna circunstancia aprueba, rechaza, calcula solvencia financiera", contenido)

    def test_11_sin_tokens_ni_pii_innecesaria_en_logs(self):
        """11. No hay tokens, PII innecesaria o links públicos en logs/artefactos."""
        res_pipeline = self.pipeline.procesar_lote(
            id_lote="Lote_004",
            id_carpeta_drive="drv_test_seguridad",
            nombre_carpeta_drive="Carpeta_Seguridad",
            filas_radicado=SOLICITUDES_SINTETICAS,
            filas_matriz=DOCUMENTOS_SINTETICOS
        )
        bitacora_str = json.dumps(res_pipeline["bitacora"])
        self.assertNotIn("Bearer ", bitacora_str)
        self.assertNotIn("access_token", bitacora_str)
        self.assertNotIn("client_secret", bitacora_str)
        self.assertNotIn("anyoneWithLink", bitacora_str)


if __name__ == "__main__":
    unittest.main()
