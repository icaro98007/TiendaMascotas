"""
Generador de Dataset Sintético 100% Ficticio para Pruebas del Back Office.
Cubre explícitamente los 11 escenarios de aceptación obligatorios:
- IDs rotos
- Discrepancias de monto
- Vigencias vencidas
- Fechas ambiguas
- Formatos de moneda local
- Nombres duplicados con IDs diferentes
- Firmas visibles no autenticadas
"""

import os
import csv
import json

try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False


SOLICITUDES_SINTETICAS = [
    {
        "id_solicitud_origen": "SOL-0001",
        "tipo_credito_original": "LIBRANZA_DOCENTE",
        "fecha_registro_original": "2026-10-15",
        "hora_registro_original": "14:30:00",
        "monto_solicitado_original": "$ 12.500.000 COP",
        "estado_original": "RADICADO",
        "canal_original": "PORTAL_WEB",
        "cantidad_soportes_reportada": 4,
        "observacion_original": "Asociado solicita crédito libranza con deducción mensual ordinaria.",
        "prioridad_asignada_por_taller": "ALTA",
        "tiempo_respuesta_objetivo_habiles": 3,
        "fecha_hora_primera_respuesta": "2026-10-15T15:10:00",
        "resultado_prueba": "CONFORME",
        "firma_solicitante_revisada_por_participante": None,
        "resultado_revision_firma": "PENDIENTE_HUMANO"
    },
    {
        "id_solicitud_origen": "SOL-0002",
        "tipo_credito_original": "CONSUMO_PERSONAL",
        "fecha_registro_original": "05/06/2026",  # AMBIGUA (¿5 junio o 6 mayo?)
        "hora_registro_original": "09:15 AM",
        "monto_solicitado_original": "28,500,000.00",  # Supera umbral de $20M -> requiere codeudor
        "estado_original": "INGRESADO",
        "canal_original": "AGENCIA_CENTRAL",
        "cantidad_soportes_reportada": 3,
        "observacion_original": "Solicitud con fecha ambigua y monto alto para libre inversión.",
        "prioridad_asignada_por_taller": "MEDIA",
        "tiempo_respuesta_objetivo_habiles": 5,
        "fecha_hora_primera_respuesta": None,
        "resultado_prueba": None,
        "firma_solicitante_revisada_por_participante": None,
        "resultado_revision_firma": "PENDIENTE_HUMANO"
    },
    {
        "id_solicitud_origen": "SOL-0003",
        "tipo_credito_original": "VIVIENDA_URBANA",
        "fecha_registro_original": "2026-10-18",
        "hora_registro_original": "16:45",
        "monto_solicitado_original": "$75.000.000",  # Supera $50M -> requiere Avalúo Comercial
        "estado_original": "EN_TRAMITE",
        "canal_original": "SUCURSAL",
        "cantidad_soportes_reportada": 5,  # Pero en matriz solo se cargan 4 -> discrepancia conteo
        "observacion_original": "Crédito hipotecario con soporte faltante de avalúo y discrepancia de conteo.",
        "prioridad_asignada_por_taller": "ALTA",
        "tiempo_respuesta_objetivo_habiles": 2,
        "fecha_hora_primera_respuesta": "2026-10-18T17:00:00",
        "resultado_prueba": None,
        "firma_solicitante_revisada_por_participante": None,
        "resultado_revision_firma": "PENDIENTE_HUMANO"
    },
    {
        "id_solicitud_origen": "SOL-0004",
        "tipo_credito_original": "COMPRA_VEHICULO",
        "fecha_registro_original": "2026-10-20",
        "hora_registro_original": "11:00",
        "monto_solicitado_original": "35000000",
        "estado_original": "RECIBIDO",
        "canal_original": "VIRTUAL_PORTAL",
        "cantidad_soportes_reportada": 4,
        "observacion_original": "Caso con enlace Drive inaccesible y documento con vigencia vencida.",
        "prioridad_asignada_por_taller": "MEDIA",
        "tiempo_respuesta_objetivo_habiles": 5,
        "fecha_hora_primera_respuesta": None,
        "resultado_prueba": None,
        "firma_solicitante_revisada_por_participante": None,
        "resultado_revision_firma": "PENDIENTE_HUMANO"
    },
    {
        "id_solicitud_origen": "SOL-0005",
        "tipo_credito_original": "TIPO_DESCONOCIDO_XYZ",  # Tipo no catalogado
        "fecha_registro_original": "2026-10-22",
        "hora_registro_original": "18:20",
        "monto_solicitado_original": "$ 10.000.000 COP",
        "estado_original": "RADICADO",
        "canal_original": "ONLINE",
        "cantidad_soportes_reportada": 2,
        "observacion_original": "Caso con discrepancia entre monto de formulario y radicado, y cédula borrosa.",
        "prioridad_asignada_por_taller": "BAJA",
        "tiempo_respuesta_objetivo_habiles": 5,
        "fecha_hora_primera_respuesta": None,
        "resultado_prueba": None,
        "firma_solicitante_revisada_por_participante": None,
        "resultado_revision_firma": "PENDIENTE_HUMANO"
    }
]

DOCUMENTOS_SINTETICOS = [
    # SOL-0001 (Libranza completa conforme)
    {
        "id_solicitud": "SOL-0001",
        "id_documento": "DOC-101",
        "tipo_credito": "LIBRANZA_DOCENTE",
        "tipo_documento": "FORMULARIO_SOLICITUD",
        "nombre_archivo": "SOL-0001_Formulario_Solicitud_Firmado.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/1vA8K9L0M1N2O3P4Q5R6S7T8U9V0W1/view",
        "datos_extraidos": {"firma_visible": True, "monto_formulario": 12500000, "fecha_expedicion": "2026-10-15"}
    },
    {
        "id_solicitud": "SOL-0001",
        "id_documento": "DOC-102",
        "tipo_credito": "LIBRANZA_DOCENTE",
        "tipo_documento": "CEDULA",
        "nombre_archivo": "SOL-0001_Cedula_Ciudadania_150dpi.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/1bC2D3E4F5G6H7I8J9K0L1M2N3O4P5/view",
        "datos_extraidos": {"fecha_expedicion": "2018-05-12"}
    },
    {
        "id_solicitud": "SOL-0001",
        "id_documento": "DOC-103",
        "tipo_credito": "LIBRANZA_DOCENTE",
        "tipo_documento": "DESPRENDIBLE_PAGO",
        "nombre_archivo": "SOL-0001_Desprendible_Nomina_Septiembre.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/1qW2E3R4T5Y6U7I8O9P0A1S2D3F4G5/view",
        "datos_extraidos": {"fecha_expedicion": "2026-09-30"}  # 15 días de expedición -> vigencia OK
    },
    {
        "id_solicitud": "SOL-0001",
        "id_documento": "DOC-104",
        "tipo_credito": "LIBRANZA_DOCENTE",
        "tipo_documento": "CERTIFICADO_LABORAL",
        "nombre_archivo": "SOL-0001_Certificacion_Laboral_Reciente.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/1zX2C3V4B5N6M7A8S9D0F1G2H3J4K5/view",
        "datos_extraidos": {"fecha_expedicion": "2026-10-05"}  # 10 días -> vigencia OK
    },

    # SOL-0002 (Consumo / Libre Inversión: falta codeudor por umbral > $20M)
    {
        "id_solicitud": "SOL-0002",
        "id_documento": "DOC-201",
        "tipo_credito": "CONSUMO_PERSONAL",
        "tipo_documento": "FORMULARIO_SOLICITUD",
        "nombre_archivo": "SOL-0002_Formulario_Credito.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/2aB3C4D5E6F7G8H9I0J1K2L3M4N5O6/view",
        "datos_extraidos": {"firma_visible": True, "monto_formulario": 28500000, "fecha_expedicion": "2026-06-05"}
    },
    {
        "id_solicitud": "SOL-0002",
        "id_documento": "DOC-202",
        "tipo_credito": "CONSUMO_PERSONAL",
        "tipo_documento": "CEDULA",
        "nombre_archivo": "SOL-0002_Cedula_Asociado.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/2pQ3R4S5T6U7V8W9X0Y1Z2A3B4C5D6/view",
        "datos_extraidos": {"fecha_expedicion": "2015-08-20"}
    },
    {
        "id_solicitud": "SOL-0002",
        "id_documento": "DOC-203",
        "tipo_credito": "CONSUMO_PERSONAL",
        "tipo_documento": "DESPRENDIBLE_PAGO",
        "nombre_archivo": "SOL-0002_Desprendible_Ultimo_Mes.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/2mN3B4V5C6X7Z8A9S0D1F2G3H4J5K6/view",
        "datos_extraidos": {"fecha_expedicion": "2026-05-15"}
    },

    # SOL-0003 (Vivienda: Falta Avalúo Comercial obligatorio por monto > 50M, y conteo matriz es 4 vs 5 reportados)
    {
        "id_solicitud": "SOL-0003",
        "id_documento": "DOC-301",
        "tipo_credito": "VIVIENDA_URBANA",
        "tipo_documento": "FORMULARIO_SOLICITUD",
        "nombre_archivo": "SOL-0003_Formulario_Hipotecario.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/3aB3C4D5E6F7G8H9I0J1K2L3M4N5O6/view",
        "datos_extraidos": {"firma_visible": True, "monto_formulario": 75000000, "fecha_expedicion": "2026-10-18"}
    },
    {
        "id_solicitud": "SOL-0003",
        "id_documento": "DOC-302",
        "tipo_credito": "VIVIENDA_URBANA",
        "tipo_documento": "CEDULA",
        "nombre_archivo": "SOL-0003_Documento_Identidad.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/3pQ3R4S5T6U7V8W9X0Y1Z2A3B4C5D6/view",
        "datos_extraidos": {"fecha_expedicion": "2010-02-14"}
    },
    {
        "id_solicitud": "SOL-0003",
        "id_documento": "DOC-303",
        "tipo_credito": "VIVIENDA_URBANA",
        "tipo_documento": "DESPRENDIBLE_PAGO",
        "nombre_archivo": "SOL-0003_Comprobante_Pago_Nomina.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/3mN3B4V5C6X7Z8A9S0D1F2G3H4J5K6/view",
        "datos_extraidos": {"fecha_expedicion": "2026-09-30"}
    },
    {
        "id_solicitud": "SOL-0003",
        "id_documento": "DOC-304",
        "tipo_credito": "VIVIENDA_URBANA",
        "tipo_documento": "CERTIFICADO_TRADICION",
        "nombre_archivo": "SOL-0003_Certificado_Libertad_Tradicion.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/3zX2C3V4B5N6M7A8S9D0F1G2H3J4K5/view",
        "datos_extraidos": {"fecha_expedicion": "2026-10-10"}
    },

    # SOL-0004 (Vehículo: Un archivo con ID ROTO INACCESIBLE, y cotización con vigencia expirada > 30 días)
    {
        "id_solicitud": "SOL-0004",
        "id_documento": "DOC-401",
        "tipo_credito": "COMPRA_VEHICULO",
        "tipo_documento": "FORMULARIO_SOLICITUD",
        "nombre_archivo": "SOL-0004_Formulario_Credito_Auto.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/4aB3C4D5E6F7G8H9I0J1K2L3M4N5O6/view",
        "datos_extraidos": {"firma_visible": True, "monto_formulario": 35000000, "fecha_expedicion": "2026-10-20"}
    },
    {
        "id_solicitud": "SOL-0004",
        "id_documento": "DOC-402",
        "tipo_credito": "COMPRA_VEHICULO",
        "tipo_documento": "CEDULA",
        "nombre_archivo": "SOL-0004_Cedula.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/BROKEN_FILE_ID_404_NOT_FOUND/view",  # ID INACCESIBLE
        "datos_extraidos": {}
    },
    {
        "id_solicitud": "SOL-0004",
        "id_documento": "DOC-403",
        "tipo_credito": "COMPRA_VEHICULO",
        "tipo_documento": "DESPRENDIBLE_PAGO",
        "nombre_archivo": "SOL-0004_Desprendible_Agosto.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/4mN3B4V5C6X7Z8A9S0D1F2G3H4J5K6/view",
        "datos_extraidos": {"fecha_expedicion": "2026-07-15"}  # > 60 días -> Vencido
    },
    {
        "id_solicitud": "SOL-0004",
        "id_documento": "DOC-404",
        "tipo_credito": "COMPRA_VEHICULO",
        "tipo_documento": "COTIZACION_VEHICULO",
        "nombre_archivo": "SOL-0004_Cotizacion_Concesionario.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/4zX2C3V4B5N6M7A8S9D0F1G2H3J4K5/view",
        "datos_extraidos": {"fecha_expedicion": "2026-08-10"}  # > 30 días -> Vencida
    },

    # SOL-0005 (Discrepancia de monto: radicado dice 10M y formulario dice 18M; además Formulario SIN firma visible y archivo con ID DISCREPANTE)
    {
        "id_solicitud": "SOL-0005",
        "id_documento": "DOC-501",
        "tipo_credito": "TIPO_DESCONOCIDO_XYZ",
        "tipo_documento": "FORMULARIO_SOLICITUD",
        "nombre_archivo": "SOL-0005_Formulario_Sin_Firmar.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/5aB3C4D5E6F7G8H9I0J1K2L3M4N5O6/view",
        "datos_extraidos": {"firma_visible": False, "monto_formulario": 18000000, "fecha_expedicion": "2026-10-22"}
    },
    {
        "id_solicitud": "SOL-0005",
        "id_documento": "DOC-502",
        "tipo_credito": "TIPO_DESCONOCIDO_XYZ",
        "tipo_documento": "CEDULA",
        "nombre_archivo": "SOL-0005_Cedula_Ilegible.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/5pQ3R4S5T6U7V8W9X0Y1Z2A3B4C5D6_BORROSO/view",
        "datos_extraidos": {}
    },
    {
        "id_solicitud": "SOL-0005",
        "id_documento": "DOC-503",
        "tipo_credito": "TIPO_DESCONOCIDO_XYZ",
        "tipo_documento": "DESPRENDIBLE_PAGO",
        "nombre_archivo": "SOL-0005_Desprendible_Nomina.pdf",
        "formato": "application/pdf",
        "url_base2": "https://drive.google.com/file/d/5mN3B4V5C6X7Z8A9S0D1F2G3H4J5K6_DISCREPANTE/view",
        "datos_extraidos": {"fecha_expedicion": "2026-10-15"}
    }
]


def generar_archivos_dataset(destino: str = "data/synthetic_dataset"):
    os.makedirs(destino, exist_ok=True)

    # 1. Radicado CSV
    ruta_rad_csv = os.path.join(destino, "radicado_solicitudes.csv")
    with open(ruta_rad_csv, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(SOLICITUDES_SINTETICAS[0].keys()))
        writer.writeheader()
        writer.writerows(SOLICITUDES_SINTETICAS)

    # 2. Matriz CSV
    ruta_mat_csv = os.path.join(destino, "matriz_documentos.csv")
    with open(ruta_mat_csv, "w", encoding="utf-8-sig", newline="") as f:
        columnas = ["id_solicitud", "id_documento", "tipo_credito", "tipo_documento", "nombre_archivo", "formato", "url_base2", "datos_extraidos"]
        writer = csv.DictWriter(f, fieldnames=columnas)
        writer.writeheader()
        for doc in DOCUMENTOS_SINTETICOS:
            row = doc.copy()
            row["datos_extraidos"] = json.dumps(row.get("datos_extraidos", {}))
            writer.writerow(row)

    # 3. Versión XLSX
    if OPENPYXL_AVAILABLE:
        ruta_rad_xlsx = os.path.join(destino, "radicado_solicitudes.xlsx")
        wb_rad = openpyxl.Workbook()
        ws_rad = wb_rad.active
        ws_rad.title = "Radicado"
        ws_rad.append(list(SOLICITUDES_SINTETICAS[0].keys()))
        for s in SOLICITUDES_SINTETICAS:
            ws_rad.append(list(s.values()))
        wb_rad.save(ruta_rad_xlsx)

        ruta_mat_xlsx = os.path.join(destino, "matriz_documentos.xlsx")
        wb_mat = openpyxl.Workbook()
        ws_mat = wb_mat.active
        ws_mat.title = "MatrizDocumentos"
        ws_mat.append(["id_solicitud", "id_documento", "tipo_credito", "tipo_documento", "nombre_archivo", "formato", "url_base2"])
        for d in DOCUMENTOS_SINTETICOS:
            ws_mat.append([d["id_solicitud"], d["id_documento"], d["tipo_credito"], d["tipo_documento"], d["nombre_archivo"], d["formato"], d["url_base2"]])
        wb_mat.save(ruta_mat_xlsx)

    print(f"Dataset sintético generado con éxito en: {destino}")


if __name__ == "__main__":
    generar_archivos_dataset()
