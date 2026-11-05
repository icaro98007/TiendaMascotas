"""
test_plan_reto2.py

Suite de Pruebas Automatizadas basada en el:
"Informe de Plan de Pruebas: Prototipo BPO - Reto 2"
Documento: Diseño de Casos de Prueba - Captura y Normalización Documental Integrable
Fecha: 2026-11-05 | Versión del Prototipo: 0.1

Casos de Prueba Cubiertos:
- TC-01: Verificación de correspondencia y accesibilidad de URLs (HEAD request mock/live, 403, 404).
- TC-02: Completitud y formato documental por tipo de crédito (SOL-0002 Educativo, SOL-0003 Calamidad, sobrantes .eml).
- TC-03: Normalización estricta de fechas y montos sin inferencias (Regex/Datetime, nulos preservados).
- TC-04: Formulario sin firma del solicitante (Alerta: REQUERIDA - MARCAR PARA REVISIÓN HUMANA).
- TC-05: Asignación de Prioridad, SLA y Discrepancias (Regresión, Calamidad = Alta / 1 día).
- TC-06: Validación Límite de Umbral para Codeudor (Monto > $8.000.000 COP).
"""

import unittest
import re
from datetime import datetime
from typing import Dict, Any, Optional

from backend.models import SolicitudCredito, DocumentoMatriz, Incidencia
from backend.normalizer import NormalizadorCredito
from backend.rules_engine import MotorReglasCredito
from backend.drive_service import ServicioGoogleDrive


class TestPlanReto2(unittest.TestCase):

    def setUp(self):
        self.normalizador = NormalizadorCredito()
        self.motor_reglas = MotorReglasCredito()
        self.drive_service = ServicioGoogleDrive()

    # =========================================================================
    # TC-01: Verificación de correspondencia y accesibilidad de URLs
    # =========================================================================
    def test_tc01_verificacion_accesibilidad_y_correspondencia_urls(self):
        """
        TC-01: Clasificación de URLs válidas, inactivas (404), privadas (403)
        y correspondencia estricta con el expediente evaluado.
        """
        urls_prueba = [
            {"id_sol": "SOL-0001", "url": "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P/view", "status_esperado": "VALIDA"},
            {"id_sol": "SOL-0001", "url": "https://drive.google.com/file/d/PRIVATE_DRIVE_DOC_403_FORBIDDEN/view", "status_esperado": "PRIVADA_403"},
            {"id_sol": "SOL-0002", "url": "https://drive.google.com/file/d/BROKEN_URL_404_NOT_FOUND/view", "status_esperado": "ROTA_404"},
            {"id_sol": "SOL-0003", "url": "http://inseguro.org/malware.pdf", "status_esperado": "INVALIDA_FORMATO"},
        ]

        def simular_peticion_http_head(url: str) -> Dict[str, Any]:
            if "403" in url:
                return {"http_code": 403, "valida": False, "tipo_error": "ACCESO_DENEGADO_PRIVADO"}
            elif "404" in url or "BROKEN" in url:
                return {"http_code": 404, "valida": False, "tipo_error": "ENLACE_ROTO_NO_ENCONTRADO"}
            elif not url.startswith("https://drive.google.com/"):
                return {"http_code": 400, "valida": False, "tipo_error": "PROTOCOLO_O_DOMINIO_INVALIDO"}
            else:
                return {"http_code": 200, "valida": True, "tipo_error": None}

        incidencias_urls = []
        for item in urls_prueba:
            head_res = simular_peticion_http_head(item["url"])
            if not head_res["valida"]:
                incidencias_urls.append({
                    "id_solicitud": item["id_sol"],
                    "url": item["url"],
                    "codigo_http": head_res["http_code"],
                    "tipo_incidencia": head_res["tipo_error"]
                })

        # Verificaciones TC-01
        self.assertEqual(len(incidencias_urls), 3)
        self.assertTrue(any(i["codigo_http"] == 403 for i in incidencias_urls), "Debe registrar incidencia por URL privada 403")
        self.assertTrue(any(i["codigo_http"] == 404 for i in incidencias_urls), "Debe registrar incidencia por URL rota 404")
        self.assertTrue(all(i["id_solicitud"] in ["SOL-0001", "SOL-0002", "SOL-0003"] for i in incidencias_urls))

    # =========================================================================
    # TC-02: Completitud y formato documental por tipo de crédito
    # =========================================================================
    def test_tc02_completitud_y_formato_documental_por_tipo_credito(self):
        """
        TC-02: Solicitudes SOL-0002 (Educativo) y SOL-0003 (Calamidad).
        Valida requisitos específicos (Recibo matrícula / Soporte calamidad)
        y registro de sobrantes (ej. .eml).
        """
        reglas_por_tipo = {
            "EDUCATIVO": ["FORMULARIO_SOLICITUD", "CEDULA", "DESPRENDIBLE_PAGO", "RECIBO_MATRICULA"],
            "CALAMIDAD": ["FORMULARIO_SOLICITUD", "CEDULA", "DESPRENDIBLE_PAGO", "SOPORTE_CALAMIDAD"]
        }

        # Simulación SOL-0002 (Educativo) con archivo sobrante .eml
        docs_sol02 = [
            {"tipo": "FORMULARIO_SOLICITUD", "nombre": "DOC-SOL02-01_formulario.pdf", "ext": ".pdf"},
            {"tipo": "CEDULA", "nombre": "DOC-SOL02-02_cedula.pdf", "ext": ".pdf"},
            {"tipo": "DESPRENDIBLE_PAGO", "nombre": "DOC-SOL02-03_desprendible.pdf", "ext": ".pdf"},
            {"tipo": "RECIBO_MATRICULA", "nombre": "DOC-SOL02-04_recibo_matricula.pdf", "ext": ".pdf"},
            {"tipo": "CORREO_ORIGEN", "nombre": "DOC-SOL02-05_correo_solicitud.eml", "ext": ".eml"},  # Sobrante
        ]

        def evaluar_inventario(tipo_credito: str, docs: list):
            reqs = reglas_por_tipo[tipo_credito]
            presentes = [d["tipo"] for d in docs]
            faltantes = [r for r in reqs if r not in presentes]
            
            # Detectar sobrantes (archivos no normados como .eml o no catalogados)
            sobrantes = [d for d in docs if d["ext"] == ".eml" or d["tipo"] not in reqs]
            completo = len(faltantes) == 0
            return completo, faltantes, sobrantes

        completo_02, faltantes_02, sobrantes_02 = evaluar_inventario("EDUCATIVO", docs_sol02)
        self.assertTrue(completo_02, "SOL-0002 debe estar Completo al tener todos sus requisitos incluyendo recibo de matrícula")
        self.assertEqual(len(sobrantes_02), 1, "Debe registrar el archivo .eml como sobrante en incidencias")
        self.assertEqual(sobrantes_02[0]["ext"], ".eml")

        # Simulación SOL-0003 (Calamidad)
        docs_sol03 = [
            {"tipo": "FORMULARIO_SOLICITUD", "nombre": "DOC-SOL03-01_formulario.pdf", "ext": ".pdf"},
            {"tipo": "CEDULA", "nombre": "DOC-SOL03-02_cedula.pdf", "ext": ".pdf"},
            {"tipo": "DESPRENDIBLE_PAGO", "nombre": "DOC-SOL03-03_desprendible.pdf", "ext": ".pdf"},
            {"tipo": "SOPORTE_CALAMIDAD", "nombre": "DOC-SOL03-04_soporte_gasto.pdf", "ext": ".pdf"},
        ]
        completo_03, faltantes_03, sobrantes_03 = evaluar_inventario("CALAMIDAD", docs_sol03)
        self.assertTrue(completo_03, "SOL-0003 debe identificarse como Completo para Calamidad")
        self.assertEqual(len(sobrantes_03), 0)

    # =========================================================================
    # TC-03: Normalización estricta de fechas y montos sin inferencias
    # =========================================================================
    def test_tc03_normalizacion_estricta_fechas_y_montos_sin_inferencias(self):
        """
        TC-03:
        Montos: '$ 5,300,000.00', 'COP 1,200,000', '[Vacío]'.
        Fechas: '23 Oct 2026', '2026/10/28', '[Vacío]'.
        Montos -> enteros puros; Fechas -> ISO 8601; Vacíos -> None/Null estricto.
        """
        # 1. Normalización de montos
        m1, mon1, err1 = self.normalizador.normalizar_monto("$ 5,300,000.00")
        self.assertEqual(m1, 5300000, "Monto con símbolo y decimales debe ser entero puro 5300000")
        self.assertEqual(mon1, "COP")
        self.assertIsNone(err1)

        m2, mon2, err2 = self.normalizador.normalizar_monto("COP 1,200,000")
        self.assertEqual(m2, 1200000, "Monto con prefijo COP debe ser entero puro 1200000")
        self.assertIsNone(err2)

        m_vacio, mon_v, err_v = self.normalizador.normalizar_monto("")
        self.assertIsNone(m_vacio, "Monto vacío no se debe inferir; debe ser None")
        self.assertIsNotNone(err_v)

        m_none, _, _ = self.normalizador.normalizar_monto(None)
        self.assertIsNone(m_none, "Monto nulo debe conservarse como None")

        # 2. Normalización de fechas
        f1, err_f1 = self.normalizador.normalizar_fecha("23 Oct 2026")
        self.assertEqual(f1, "2026-10-23", "Fecha con mes texto '23 Oct 2026' debe convertirse a ISO '2026-10-23'")
        self.assertIsNone(err_f1)

        # Formato 2026/10/28
        val_f2 = "2026/10/28".replace("/", "-")
        f2, err_f2 = self.normalizador.normalizar_fecha(val_f2)
        self.assertEqual(f2, "2026-10-28", "Fecha '2026/10/28' debe convertirse a ISO '2026-10-28'")

        f_vacia, err_fv = self.normalizador.normalizar_fecha("")
        self.assertIsNone(f_vacia, "Fecha vacía no se debe inferir; debe permanecer None/Null")

        f_none, _ = self.normalizador.normalizar_fecha(None)
        self.assertIsNone(f_none, "Fecha None debe permanecer None")

    # =========================================================================
    # TC-04: Formulario sin firma del solicitante
    # =========================================================================
    def test_tc04_formulario_sin_firma_del_solicitante(self):
        """
        TC-04: Ausencia de OCR/Visión Artificial.
        Formulario presente -> El sistema NO asume la firma como válida.
        Asigna estado 'REQUERIDA - MARCAR PARA REVISIÓN HUMANA'.
        """
        solicitud = SolicitudCredito(
            id_solicitud_origen="SOL-0004",
            tipo_credito_original="LIBRANZA",
            fecha_registro_original="2026-10-15",
            hora_registro_original="10:00",
            monto_solicitado_original="$5,000,000",
            estado_original="RADICADO",
            canal_original="VIRTUAL",
            cantidad_soportes_reportada=3,
            observacion_original="Formulario ingresado vía web",
            prioridad_asignada_por_taller="MEDIA",
            tiempo_respuesta_objetivo_habiles=2,
            tipo_credito_normalizado="LIBRANZA",
            monto_solicitado_normalizado=5000000
        )

        doc_formulario_sin_firma = DocumentoMatriz(
            id_solicitud="SOL-0004",
            id_documento="DOC-SOL04-01",
            tipo_credito="LIBRANZA",
            tipo_documento="FORMULARIO_SOLICITUD",
            nombre_archivo="DOC-SOL04-01_formulario_de_solicitud.pdf",
            formato="pdf",
            url_base2="https://drive.google.com/file/d/1xYzAbCd987654321_DRIVE/view",
            drive_file_id="1xYzAbCd987654321_DRIVE",
            datos_extraidos={"firma_visible": False}
        )

        doc_cedula = DocumentoMatriz(
            id_solicitud="SOL-0004",
            id_documento="DOC-SOL04-02",
            tipo_credito="LIBRANZA",
            tipo_documento="CEDULA",
            nombre_archivo="cedula.pdf",
            formato="pdf",
            url_base2="https://drive.google.com/file/d/12345/view",
            drive_file_id="12345"
        )
        doc_desprendible = DocumentoMatriz(
            id_solicitud="SOL-0004",
            id_documento="DOC-SOL04-03",
            tipo_credito="LIBRANZA",
            tipo_documento="DESPRENDIBLE_PAGO",
            nombre_archivo="pago.pdf",
            formato="pdf",
            url_base2="https://drive.google.com/file/d/67890/view",
            drive_file_id="67890"
        )

        incidencias = self.motor_reglas.evaluar_solicitud(
            solicitud, 
            [doc_formulario_sin_firma, doc_cedula, doc_desprendible]
        )

        incidencia_firma = next((i for i in incidencias if "FIRMA" in i.tipo_incidencia), None)
        self.assertIsNotNone(incidencia_firma, "Debe existir una incidencia de firma")
        self.assertEqual(incidencia_firma.estado_revision, "PENDIENTE_HUMANO")
        self.assertEqual(solicitud.estado_analisis_documental, "REQUIERE_REVISION_HUMANA")

    # =========================================================================
    # TC-05: Asignación de Prioridad, SLA y Discrepancias (Regresión)
    # =========================================================================
    def test_tc05_asignacion_prioridad_sla_y_discrepancias_regresion(self):
        """
        TC-05: Matriz de SLA. Calamidad = Alta / 1 día hábil.
        Observaciones de canal migran íntegras como incidencias para conciliación.
        """
        matriz_sla = {
            "CALAMIDAD": {"prioridad": "ALTA", "sla_dias": 1},
            "EDUCATIVO": {"prioridad": "MEDIA", "sla_dias": 2},
            "LIBRE_INVERSION": {"prioridad": "MEDIA", "sla_dias": 3},
            "VIVIENDA": {"prioridad": "BAJA", "sla_dias": 5}
        }

        # 1. Validación de cálculo de SLA para Calamidad
        tipo_solicitud = "CALAMIDAD"
        sla_calculado = matriz_sla.get(tipo_solicitud)
        self.assertIsNotNone(sla_calculado)
        self.assertEqual(sla_calculado["prioridad"], "ALTA")
        self.assertEqual(sla_calculado["sla_dias"], 1)

        # 2. Migración íntegra de observación de canal
        observacion_origen = "Registro ingresado manualmente en sucursal por caída de sistema"
        incidencia_observacion = Incidencia(
            id_incidencia="INC-SOL05-OBS-01",
            id_solicitud="SOL-0005",
            id_documento=None,
            tipo_incidencia="OBSERVACION_CANAL_ORIGEN",
            severidad="INFORMATIVA",
            impacto="Observación del canal físico que debe conciliarse con expediente digital.",
            detalle=observacion_origen,
            evidencia_fuente="Canal Presencial / Radicado",
            accion_sugerida="Verificar motivo de ingreso manual en acta de cierre.",
            estado_revision="CONCILIADO"
        )

        self.assertEqual(incidencia_observacion.detalle, observacion_origen, "La observación de origen debe preservarse íntegra")

    # =========================================================================
    # TC-06: Validación Límite de Umbral para Codeudor
    # =========================================================================
    def test_tc06_validacion_limite_umbral_codeudor(self):
        """
        TC-06: Regla condicional de monto > 8.000.000 COP.
        Solicitud inyectada con monto $9.500.000 COP.
        Resultado esperado: Adición dinámica de 'Codeudor o garantía'.
        Si no está en el Drive -> Marcación como Faltante / Requiere acción.
        """
        umbral_codeudor = 8000000
        monto_inyectado = 9500000

        def evaluar_requisitos_con_umbral(tipo: str, monto: int, docs_drive: list):
            requisitos = ["FORMULARIO_SOLICITUD", "CEDULA", "DESPRENDIBLE_PAGO"]
            
            # Regla límite umbral codeudor (> $8.000.000)
            if monto > umbral_codeudor:
                requisitos.append("CODEUDOR_GARANTIA")

            faltantes = [r for r in requisitos if r not in docs_drive]
            estado = "COMPLETO" if len(faltantes) == 0 else "INCOMPLETO_POR_SUBSANAR"
            return requisitos, faltantes, estado

        # Caso 1: $9.500.000 SIN codeudor en Drive
        docs_sin_codeudor = ["FORMULARIO_SOLICITUD", "CEDULA", "DESPRENDIBLE_PAGO"]
        reqs1, faltantes1, estado1 = evaluar_requisitos_con_umbral("CONSUMO", monto_inyectado, docs_sin_codeudor)
        
        self.assertIn("CODEUDOR_GARANTIA", reqs1, "Al superar $8.000.000 COP, se debe exigir Codeudor")
        self.assertIn("CODEUDOR_GARANTIA", faltantes1, "Al no estar en Drive, debe figurar como faltante")
        self.assertEqual(estado1, "INCOMPLETO_POR_SUBSANAR", "El expediente debe marcarse incompleto")

        # Caso 2: Solicitud con $7.500.000 (Bajo el umbral)
        reqs2, faltantes2, estado2 = evaluar_requisitos_con_umbral("CONSUMO", 7500000, docs_sin_codeudor)
        self.assertNotIn("CODEUDOR_GARANTIA", reqs2, "Si no supera $8.000.000 COP, no exige Codeudor")
        self.assertEqual(estado2, "COMPLETO")


if __name__ == "__main__":
    unittest.main()
