"""
Generador de Plantilla Oficial de Excel (.xlsx) para Nuevos Análisis de Crédito.
Contiene hojas:
1. Radicado
2. Matriz_documentos
3. Guia_y_Catalogos
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

def crear_plantilla(ruta_salida="plantilla_solicitudes_credito.xlsx"):
    wb = openpyxl.Workbook()

    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    accent_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    accent_font = Font(name="Calibri", size=11, bold=True, color="0F172A")

    # HOJA 1: Radicado
    ws_rad = wb.active
    ws_rad.title = "Radicado"
    
    headers_rad = [
        "id_solicitud_origen",
        "tipo_credito_original",
        "fecha_registro_original",
        "hora_registro_original",
        "monto_solicitado_original",
        "estado_original",
        "canal_original",
        "cantidad_soportes_reportada",
        "observacion_original",
        "prioridad_asignada_por_taller",
        "tiempo_respuesta_objetivo_habiles",
        "fecha_hora_primera_respuesta",
        "resultado_prueba",
        "firma_solicitante_revisada_por_participante",
        "resultado_revision_firma"
    ]
    ws_rad.append(headers_rad)
    for col in range(1, len(headers_rad) + 1):
        cell = ws_rad.cell(1, col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    ejemplos_rad = [
        ["SOL-1001", "LIBRANZA_DOCENTE", "2026-10-25", "10:30", "$15.000.000 COP", "RADICADO", "PORTAL_WEB", 4, "Solicitud docente ordinaria", "ALTA", 3, "", "", "", "PENDIENTE_HUMANO"],
        ["SOL-1002", "LIBRE_INVERSION", "2026-10-26", "14:15", "$25.000.000", "EN_ESTUDIO", "AGENCIA_CENTRAL", 4, "Monto alto, requiere codeudor", "MEDIA", 5, "", "", "", "PENDIENTE_HUMANO"],
        ["SOL-1003", "VIVIENDA_URBANA", "2026-10-27", "11:00", "80000000", "RADICADO", "SUCURSAL", 5, "Crédito hipotecario con avalúo", "ALTA", 3, "", "", "", "PENDIENTE_HUMANO"]
    ]
    for fila in ejemplos_rad:
        ws_rad.append(fila)

    # HOJA 2: Matriz_documentos
    ws_mat = wb.create_sheet(title="Matriz_documentos")
    headers_mat = [
        "id_solicitud",
        "id_documento",
        "tipo_credito",
        "tipo_documento",
        "nombre_archivo",
        "formato",
        "url_base2"
    ]
    ws_mat.append(headers_mat)
    for col in range(1, len(headers_mat) + 1):
        cell = ws_mat.cell(1, col)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    ejemplos_mat = [
        ["SOL-1001", "DOC-01", "LIBRANZA", "FORMULARIO_SOLICITUD", "SOL-1001_Formulario.pdf", "application/pdf", "https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J1K2L3M4/view"],
        ["SOL-1001", "DOC-02", "LIBRANZA", "CEDULA", "SOL-1001_Cedula.pdf", "application/pdf", "https://drive.google.com/file/d/2B3C4D5E6F7G8H9I0J1K2L3M4N5/view"],
        ["SOL-1001", "DOC-03", "LIBRANZA", "DESPRENDIBLE_PAGO", "SOL-1001_Desprendible.pdf", "application/pdf", "https://drive.google.com/file/d/3C4D5E6F7G8H9I0J1K2L3M4N5O6/view"],
        ["SOL-1001", "DOC-04", "LIBRANZA", "CERTIFICADO_LABORAL", "SOL-1001_Laboral.pdf", "application/pdf", "https://drive.google.com/file/d/4D5E6F7G8H9I0J1K2L3M4N5O6P7/view"],
        ["SOL-1002", "DOC-05", "LIBRE_INVERSION", "FORMULARIO_SOLICITUD", "SOL-1002_Formulario.pdf", "application/pdf", "https://drive.google.com/file/d/5E6F7G8H9I0J1K2L3M4N5O6P7Q8/view"],
        ["SOL-1002", "DOC-06", "LIBRE_INVERSION", "CEDULA", "SOL-1002_Cedula.pdf", "application/pdf", "https://drive.google.com/file/d/6F7G8H9I0J1K2L3M4N5O6P7Q8R9/view"],
        ["SOL-1002", "DOC-07", "LIBRE_INVERSION", "DESPRENDIBLE_PAGO", "SOL-1002_Desprendible.pdf", "application/pdf", "https://drive.google.com/file/d/7G8H9I0J1K2L3M4N5O6P7Q8R9S0/view"],
        ["SOL-1002", "DOC-08", "LIBRE_INVERSION", "CODEUDOR_SOPORTE", "SOL-1002_Codeudor.pdf", "application/pdf", "https://drive.google.com/file/d/8H9I0J1K2L3M4N5O6P7Q8R9S0T1/view"],
        ["SOL-1003", "DOC-09", "VIVIENDA", "FORMULARIO_SOLICITUD", "SOL-1003_Formulario.pdf", "application/pdf", "https://drive.google.com/file/d/9I0J1K2L3M4N5O6P7Q8R9S0T1U2/view"],
        ["SOL-1003", "DOC-10", "VIVIENDA", "CEDULA", "SOL-1003_Cedula.pdf", "application/pdf", "https://drive.google.com/file/d/0J1K2L3M4N5O6P7Q8R9S0T1U2V3/view"],
        ["SOL-1003", "DOC-11", "VIVIENDA", "DESPRENDIBLE_PAGO", "SOL-1003_Desprendible.pdf", "application/pdf", "https://drive.google.com/file/d/1K2L3M4N5O6P7Q8R9S0T1U2V3W4/view"],
        ["SOL-1003", "DOC-12", "VIVIENDA", "CERTIFICADO_TRADICION", "SOL-1003_Tradicion.pdf", "application/pdf", "https://drive.google.com/file/d/2L3M4N5O6P7Q8R9S0T1U2V3W4X5/view"],
        ["SOL-1003", "DOC-13", "VIVIENDA", "AVALUO_COMERCIAL", "SOL-1003_Avaluo.pdf", "application/pdf", "https://drive.google.com/file/d/3M4N5O6P7Q8R9S0T1U2V3W4X5Y6/view"]
    ]
    for fila in ejemplos_mat:
        ws_mat.append(fila)

    # HOJA 3: Guia_y_Catalogos
    ws_guia = wb.create_sheet(title="Guia_y_Catalogos")
    ws_guia.append(["GUÍA DE CARGA DE DATOS PARA BACK OFFICE DE CRÉDITO"])
    ws_guia.cell(1, 1).font = Font(size=14, bold=True, color="1E3A8A")
    ws_guia.append([])
    ws_guia.append(["Regla", "Descripción", "Recomendación"])
    for col in range(1, 4):
        ws_guia.cell(3, col).fill = accent_fill
        ws_guia.cell(3, col).font = accent_font

    ws_guia.append(["Tipos de Crédito", "LIBRANZA, LIBRE_INVERSION, VIVIENDA, VEHICULO", "Usa los nombres canónicos o sinónimos habituales."])
    ws_guia.append(["Tipos de Documento", "FORMULARIO_SOLICITUD, CEDULA, DESPRENDIBLE_PAGO, CERTIFICADO_LABORAL, CERTIFICADO_TRADICION, AVALUO_COMERCIAL, COTIZACION_VEHICULO, CODEUDOR_SOPORTE", "Todos requieren FORMULARIO, CEDULA y DESPRENDIBLE."])
    ws_guia.append(["Formato de Fechas", "YYYY-MM-DD (ej: 2026-10-25) o DD-MES-AAAA", "Evita fechas ambiguas como 05/06/2026 para no generar observaciones."])
    ws_guia.append(["Montos", "Moneda colombiana COP (ej: 15000000 o $15.000.000)", "No uses monedas extranjeras (USD/EUR)."])
    ws_guia.append(["Enlaces Drive", "URLs completas o File IDs de 15+ caracteres", "Usa enlaces a archivos privados de la organización."])

    wb.save(ruta_salida)
    print(f"Plantilla generada exitosamente en: {ruta_salida}")

if __name__ == "__main__":
    crear_plantilla()
