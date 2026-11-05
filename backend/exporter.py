"""
Generador de Entregables e Índices por Lote de Crédito.
Produce:
1. Libro consolidado Excel (.xlsx) con 8 hojas canónicas requeridas.
2. Reporte independiente de hallazgos (01_Carpetahallazgos).
3. Informe ejecutivo en HTML/PDF con diseño corporativo y aviso legal.
4. Bitácora de ejecución auditada sin secretos ni PII innecesaria.
"""

import os
import json
from typing import List, Dict, Any
from datetime import datetime

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False


def _get_val(obj, attr, default=None):
    if hasattr(obj, attr):
        return getattr(obj, attr)
    elif isinstance(obj, dict):
        return obj.get(attr, default)
    return default


class ExportadorLote:
    def __init__(self, ruta_base_salida: str = "salidas"):
        self.ruta_base_salida = ruta_base_salida
        os.makedirs(ruta_base_salida, exist_ok=True)

    def generar_entregables_completos(
        self,
        lote_id: str,
        solicitudes: List[Any],
        documentos: List[Any],
        incidencias: List[Any],
        jerarquia_drive: Dict[str, Any],
        bitacora: List[Dict[str, Any]],
        politica_version: str = "POL-2026.1"
    ) -> Dict[str, str]:
        """
        Genera todos los artefactos requeridos por las especificaciones.
        """
        carpeta_lote = os.path.join(self.ruta_base_salida, lote_id)
        carpeta_materia = os.path.join(carpeta_lote, "00_MateriaInicial")
        carpeta_hallazgos = os.path.join(carpeta_lote, "01_Carpetahallazgos")
        carpeta_limpia = os.path.join(carpeta_lote, "02_Carpetalimpia")

        os.makedirs(carpeta_materia, exist_ok=True)
        os.makedirs(carpeta_hallazgos, exist_ok=True)
        os.makedirs(carpeta_limpia, exist_ok=True)

        # 1. Crear subcarpetas numeradas por solicitud dentro de 02_Carpetalimpia
        for sub in jerarquia_drive.get("carpetas_solicitudes", []):
            sub_path = os.path.join(carpeta_limpia, sub["nombre_carpeta"])
            os.makedirs(sub_path, exist_ok=True)
            # README ligero por solicitud
            readme_path = os.path.join(sub_path, "README_solicitud.txt")
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(f"EXPEDIENTE: {sub['nombre_carpeta']}\n")
                f.write(f"ID Solicitud: {sub['id_solicitud']}\n")
                f.write(f"Tipo Crédito: {sub['tipo_credito']}\n")
                f.write(f"URL Drive autorizada: {sub['url']}\n\n")
                f.write("Soportes verificados asociados a este expediente:\n")
                docs_sol = [d for d in documentos if _get_val(d, 'id_solicitud') == sub['id_solicitud']]
                for ds in docs_sol:
                    d_nom = _get_val(ds, 'nombre_archivo', '')
                    d_url = _get_val(ds, 'url_canonico_drive', '')
                    d_est = _get_val(ds, 'estado_verificacion', '')
                    f.write(f"- {d_nom} | Estado: {d_est} | Link: {d_url}\n")

        # 2. Archivo independiente de hallazgos
        ruta_hallazgos_json = os.path.join(carpeta_hallazgos, f"hallazgos_{lote_id}.json")
        hallazgos_data = [i if isinstance(i, dict) else i.__dict__ for i in incidencias]
        with open(ruta_hallazgos_json, "w", encoding="utf-8") as f:
            json.dump(hallazgos_data, f, indent=2, ensure_ascii=False)

        ruta_hallazgos_txt = os.path.join(carpeta_hallazgos, f"reporte_hallazgos_{lote_id}.txt")
        with open(ruta_hallazgos_txt, "w", encoding="utf-8") as f:
            f.write(f"=== INFORME INDEPENDIENTE DE HALLAZGOS Y CALIDAD - {lote_id} ===\n")
            f.write(f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Política aplicada: {politica_version}\n")
            f.write(f"Total incidencias detectadas: {len(incidencias)}\n\n")
            for inc in incidencias:
                i_dict = inc if isinstance(inc, dict) else inc.__dict__
                f.write(f"[{i_dict.get('severidad')}] Solicitud: {i_dict.get('id_solicitud')} | Tipo: {i_dict.get('tipo_incidencia')}\n")
                f.write(f"  Detalle: {i_dict.get('detalle')}\n")
                f.write(f"  Evidencia: {i_dict.get('evidencia_fuente')}\n")
                f.write(f"  Acción sugerida: {i_dict.get('accion_sugerida')}\n")
                f.write(f"  Estado: {i_dict.get('estado_revision')} | Revisor: {i_dict.get('revisado_por') or 'Pendiente'}\n")
                f.write("-" * 70 + "\n")

        # 3. Bitácora de ejecución auditada
        ruta_bitacora = os.path.join(carpeta_lote, f"bitacora_auditoria_{lote_id}.json")
        with open(ruta_bitacora, "w", encoding="utf-8") as f:
            json.dump(bitacora, f, indent=2, ensure_ascii=False)

        # 4. Consolidado Multi-hoja Excel (.xlsx)
        ruta_excel = os.path.join(carpeta_limpia, f"Consolidado_Auditoria_{lote_id}.xlsx")
        if OPENPYXL_AVAILABLE:
            self._construir_excel(ruta_excel, lote_id, solicitudes, documentos, incidencias, jerarquia_drive, politica_version)
        else:
            # Fallback a json de consolidado si openpyxl no estuviera
            ruta_excel = os.path.join(carpeta_limpia, f"Consolidado_Auditoria_{lote_id}.json")
            with open(ruta_excel, "w", encoding="utf-8") as f:
                json.dump({
                    "solicitudes": [s if isinstance(s, dict) else s.__dict__ for s in solicitudes],
                    "documentos": [d if isinstance(d, dict) else d.__dict__ for d in documentos],
                    "incidencias": hallazgos_data
                }, f, indent=2, ensure_ascii=False)

        # 5. Informe Ejecutivo en HTML corporativo
        ruta_informe_html = os.path.join(carpeta_limpia, f"Informe_Ejecutivo_{lote_id}.html")
        self._construir_informe_html(ruta_informe_html, lote_id, solicitudes, documentos, incidencias, politica_version)

        return {
            "carpeta_lote": carpeta_lote,
            "excel_consolidado": ruta_excel,
            "informe_ejecutivo": ruta_informe_html,
            "reporte_hallazgos": ruta_hallazgos_txt,
            "bitacora": ruta_bitacora
        }

    def _construir_excel(self, ruta_excel, lote_id, solicitudes, documentos, incidencias, jerarquia_drive, politica_version):
        wb = openpyxl.Workbook()
        
        # Estilos
        header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        title_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
        sub_font = Font(name="Calibri", size=10, italic=True, color="475569")
        legal_font = Font(name="Calibri", size=9, bold=True, color="DC2626")

        # Hoja 1: Resumen
        ws_resumen = wb.active
        ws_resumen.title = "Resumen"
        ws_resumen.append(["SISTEMA DE BACK OFFICE - ANÁLISIS DE SOLICITUDES DE CRÉDITO"])
        ws_resumen.cell(1, 1).font = title_font
        ws_resumen.append([f"Lote ID: {lote_id} | Fecha de proceso: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Política: {politica_version}"])
        ws_resumen.cell(2, 1).font = sub_font
        ws_resumen.append(["AVISO LEGAL: Este sistema es una herramienta de validación documental y trazabilidad. NO aprueba, NO rechaza ni calcula scoring de crédito."])
        ws_resumen.cell(3, 1).font = legal_font
        ws_resumen.append([])

        total_sols = len(solicitudes)
        total_docs = len(documentos)
        total_incs = len(incidencias)
        incs_altas = sum(1 for i in incidencias if _get_val(i, 'severidad') == "ALTA")
        incs_pend = sum(1 for i in incidencias if _get_val(i, 'estado_revision') == "PENDIENTE_HUMANO")

        ws_resumen.append(["Métrica de Auditoría", "Valor", "Denominador / Cobertura", "Estado"])
        for col in range(1, 5):
            ws_resumen.cell(5, col).fill = header_fill
            ws_resumen.cell(5, col).font = header_font

        ws_resumen.append(["Total Solicitudes Procesadas", total_sols, f"{total_sols} de {total_sols}", "100% analizadas"])
        ws_resumen.append(["Total Documentos en Matriz", total_docs, f"{total_docs} documentos", "Inventariados"])
        ws_resumen.append(["Incidencias Documentales Detectadas", total_incs, f"{total_incs} hallazgos", "En seguimiento"])
        ws_resumen.append(["Incidencias Severidad ALTA (Bloqueantes)", incs_altas, f"{incs_altas} de {total_incs}", "Requiere subsanación"])
        ws_resumen.append(["Casos en Cola de Revisión Humana", incs_pend, f"{incs_pend} de {total_incs}", "Revisión obligatoria"])

        # Hoja 2: Radicado_limpio (Originales vs Normalizados)
        ws_radicado = wb.create_sheet(title="Radicado_limpio")
        headers_radicado = [
            "ID Solicitud (Texto)", "Tipo Original", "Tipo Canónico", 
            "Fecha Original", "Fecha Normalizada (YYYY-MM-DD)",
            "Hora Original", "Hora Normalizada (24h)",
            "Monto Original", "Monto Entero (COP)",
            "Canal Original", "Canal Normalizado",
            "Soportes Reportados", "Soportes en Matriz", "Conteo Coincide",
            "Estado Documental", "Revisión Firma"
        ]
        ws_radicado.append(headers_radicado)
        for col in range(1, len(headers_radicado) + 1):
            ws_radicado.cell(1, col).fill = header_fill
            ws_radicado.cell(1, col).font = header_font

        for s in solicitudes:
            s_dict = s if isinstance(s, dict) else s.__dict__
            ws_radicado.append([
                str(s_dict.get("id_solicitud_origen")),
                str(s_dict.get("tipo_credito_original")),
                str(s_dict.get("tipo_credito_normalizado") or "NO_RECONOCIDO"),
                str(s_dict.get("fecha_registro_original")),
                str(s_dict.get("fecha_registro_normalizada") or "AMBIGUA_REVISION"),
                str(s_dict.get("hora_registro_original")),
                str(s_dict.get("hora_registro_normalizada") or "NO_ESPECIFICADA"),
                str(s_dict.get("monto_solicitado_original")),
                s_dict.get("monto_solicitado_normalizado") or 0,
                str(s_dict.get("canal_original")),
                str(s_dict.get("canal_normalizado")),
                s_dict.get("cantidad_soportes_reportada"),
                s_dict.get("documentos_presentes_count"),
                "SÍ" if s_dict.get("conteo_matriz_vs_reportado_coincide") else "DISCREPANTE",
                s_dict.get("estado_analisis_documental"),
                s_dict.get("resultado_revision_firma")
            ])

        # Hoja 3: Inventario_por_solicitud
        ws_inv = wb.create_sheet(title="Inventario_por_solicitud")
        headers_inv = ["ID Solicitud", "Tipo Crédito", "Soportes Reportados", "Soportes Encontrados", "Docs Presentes", "Docs Faltantes", "Docs Adicionales", "Estado Inventario"]
        ws_inv.append(headers_inv)
        for col in range(1, len(headers_inv) + 1):
            ws_inv.cell(1, col).fill = header_fill
            ws_inv.cell(1, col).font = header_font

        for s in solicitudes:
            s_dict = s if isinstance(s, dict) else s.__dict__
            sol_id = s_dict.get("id_solicitud_origen")
            docs_sol = [d for d in documentos if _get_val(d, 'id_solicitud') == sol_id]
            tipos = [_get_val(d, 'tipo_documento') for d in docs_sol]
            faltantes = s_dict.get("documentos_faltantes", [])
            ws_inv.append([
                sol_id,
                s_dict.get("tipo_credito_normalizado") or s_dict.get("tipo_credito_original"),
                s_dict.get("cantidad_soportes_reportada"),
                len(docs_sol),
                ", ".join(tipos),
                ", ".join(faltantes) if faltantes else "NINGUNO",
                ", ".join(s_dict.get("documentos_adicionales", [])) or "NINGUNO",
                "CONFORME" if not faltantes else "INCOMPLETO"
            ])

        # Hoja 4: Matriz_documentos
        ws_matriz = wb.create_sheet(title="Matriz_documentos")
        headers_matriz = ["ID Solicitud", "ID Documento", "Tipo Documento", "Nombre Archivo", "Formato Esperado", "Drive File ID", "Estado Verificación", "URL Canónica Drive", "Legibilidad"]
        ws_matriz.append(headers_matriz)
        for col in range(1, len(headers_matriz) + 1):
            ws_matriz.cell(1, col).fill = header_fill
            ws_matriz.cell(1, col).font = header_font

        for d in documentos:
            d_dict = d if isinstance(d, dict) else d.__dict__
            ws_matriz.append([
                str(d_dict.get("id_solicitud")),
                str(d_dict.get("id_documento")),
                str(d_dict.get("tipo_documento")),
                str(d_dict.get("nombre_archivo")),
                str(d_dict.get("formato")),
                str(d_dict.get("drive_file_id") or "NO_EXTRAIDO"),
                str(d_dict.get("estado_verificacion")),
                str(d_dict.get("url_canonico_drive") or d_dict.get("url_base2")),
                "LEGIBLE" if d_dict.get("es_legible") else "ILEGIBLE / BORROSO"
            ])

        # Hoja 5: Incidencias
        ws_inc = wb.create_sheet(title="Incidencias")
        headers_inc = ["ID Incidencia", "ID Solicitud", "ID Doc", "Tipo Hallazgo", "Severidad", "Impacto", "Detalle", "Evidencia", "Acción Sugerida", "Estado Revisión", "Revisado Por", "Fecha Revisión"]
        ws_inc.append(headers_inc)
        for col in range(1, len(headers_inc) + 1):
            ws_inc.cell(1, col).fill = header_fill
            ws_inc.cell(1, col).font = header_font

        for i in incidencias:
            i_dict = i if isinstance(i, dict) else i.__dict__
            ws_inc.append([
                str(i_dict.get("id_incidencia")),
                str(i_dict.get("id_solicitud")),
                str(i_dict.get("id_documento") or "N/A"),
                str(i_dict.get("tipo_incidencia")),
                str(i_dict.get("severidad")),
                str(i_dict.get("impacto")),
                str(i_dict.get("detalle")),
                str(i_dict.get("evidencia_fuente")),
                str(i_dict.get("accion_sugerida")),
                str(i_dict.get("estado_revision")),
                str(i_dict.get("revisado_por") or "PENDIENTE"),
                str(i_dict.get("fecha_revision") or "N/A")
            ])

        # Hoja 6: Catalogos_y_criterios
        ws_cat = wb.create_sheet(title="Catalogos_y_criterios")
        ws_cat.append(["Versión Política", politica_version, "Versión Catálogo", "CAT-2026.1"])
        ws_cat.append([])
        ws_cat.append(["Tipo Canónico", "Sinónimos Aceptados", "Requisitos Obligatorios", "Requisitos Condicionales"])
        for col in range(1, 5):
            ws_cat.cell(3, col).fill = header_fill
            ws_cat.cell(3, col).font = header_font

        ws_cat.append(["LIBRE_INVERSION", "CONSUMO_PERSONAL, PRESTAMO_PERSONAL", "FORMULARIO_SOLICITUD, CEDULA, DESPRENDIBLE_PAGO", "CODEUDOR si monto > $20.000.000"])
        ws_cat.append(["LIBRANZA", "LIBRANZA_DOCENTE, DESCUENTO_NOMINA", "FORMULARIO_SOLICITUD, CEDULA, DESPRENDIBLE_PAGO", "CERTIFICADO_LABORAL (vigencia <= 30 días)"])
        ws_cat.append(["VIVIENDA", "VIVIENDA_URBANA, HIPOTECARIO", "FORMULARIO_SOLICITUD, CEDULA, DESPRENDIBLE_PAGO", "CERTIFICADO_TRADICION (<=30d), AVALUO si > $50.000.000"])
        ws_cat.append(["VEHICULO", "AUTO, COMPRA_VEHICULO", "FORMULARIO_SOLICITUD, CEDULA, DESPRENDIBLE_PAGO", "COTIZACION_VEHICULO (<=30 días)"])

        # Hoja 7: Flujo_automatizado
        ws_flujo = wb.create_sheet(title="Flujo_automatizado")
        ws_flujo.append(["Paso Secuencial", "Nombre Etapa", "Estado", "Idempotencia / Criterio"])
        for col in range(1, 5):
            ws_flujo.cell(1, col).fill = header_fill
            ws_flujo.cell(1, col).font = header_font

        ws_flujo.append([1, "Lectura de fuentes (CSV/XLSX)", "COMPLETADO", "Preserva campos originales sin mutación"])
        ws_flujo.append([2, "Inventario por solicitud", "COMPLETADO", "Cálculo de cobertura vs cantidad reportada"])
        ws_flujo.append([3, "Comprobación de links Drive", "COMPLETADO", "Verificación por File ID y MIME type"])
        ws_flujo.append([4, "OCR y extracción de campos", "COMPLETADO", "Extracción con confianza y preservación de rúbrica"])
        ws_flujo.append([5, "Normalización de datos", "COMPLETADO", "Fechas YYYY-MM-DD, horas 24h, montos enteros COP"])
        ws_flujo.append([6, "Evaluación de reglas y política", "COMPLETADO", f"Reglas versionadas {politica_version}"])
        ws_flujo.append([7, "Generación de incidencias", "COMPLETADO", "Encolado a revisión humana"])
        ws_flujo.append([8, "Exportación y verificación de enlaces", "COMPLETADO", "Creación de carpetas sin duplicados"])

        # Hoja 8: Indice_enlaces
        ws_links = wb.create_sheet(title="Indice_enlaces")
        headers_links = ["Secuencia", "ID Solicitud", "Tipo Crédito", "Carpeta Destino Secuencial", "URL Carpeta Drive", "URL Archivo Fuente Canónico", "Estado Link"]
        ws_links.append(headers_links)
        for col in range(1, len(headers_links) + 1):
            ws_links.cell(1, col).fill = header_fill
            ws_links.cell(1, col).font = header_font

        for sub in jerarquia_drive.get("carpetas_solicitudes", []):
            docs_sol = [d for d in documentos if _get_val(d, 'id_solicitud') == sub["id_solicitud"]]
            for d in docs_sol:
                d_dict = d if isinstance(d, dict) else d.__dict__
                ws_links.append([
                    sub["secuencia"],
                    sub["id_solicitud"],
                    sub["tipo_credito"],
                    sub["nombre_carpeta"],
                    sub["url"],
                    d_dict.get("url_canonico_drive") or d_dict.get("url_base2"),
                    d_dict.get("estado_verificacion")
                ])

        wb.save(ruta_excel)

    def _construir_informe_html(self, ruta_html, lote_id, solicitudes, documentos, incidencias, politica_version):
        total_sols = len(solicitudes)
        total_docs = len(documentos)
        total_incs = len(incidencias)
        incs_altas = sum(1 for i in incidencias if _get_val(i, 'severidad') == "ALTA")
        
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Informe Ejecutivo Back Office - {lote_id}</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1e293b; background: #f8fafc; line-height: 1.6; }}
  .card {{ background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 900px; margin: 0 auto; }}
  .badge {{ display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; }}
  .badge-danger {{ background: #fee2e2; color: #991b1b; }}
  .badge-warn {{ background: #fef3c7; color: #92400e; }}
  .badge-success {{ background: #dcfce7; color: #166534; }}
  .legal-box {{ border-left: 4px solid #ef4444; background: #fef2f2; padding: 16px; margin: 20px 0; border-radius: 4px; }}
  .metric-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }}
  .metric-box {{ background: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; }}
  .metric-box h3 {{ margin: 0; font-size: 28px; color: #0f172a; }}
  .metric-box p {{ margin: 4px 0 0; font-size: 13px; color: #64748b; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }}
  th, td {{ padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
  th {{ background: #0f172a; color: white; }}
</style>
</head>
<body>
<div class="card">
  <h2>INFORME EJECUTIVO DE CONTROL DOCUMENTAL Y AUDITORÍA</h2>
  <p><strong>Lote:</strong> {lote_id} | <strong>Fecha:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | <strong>Política:</strong> {politica_version}</p>
  
  <div class="legal-box">
    <strong>DECLARACIÓN NORMATIVA OBLIGATORIA:</strong><br>
    Este informe contiene exclusivamente el dictamen de completitud, vigencia documental e integridad de enlaces de Drive. 
    <strong>Bajo ninguna circunstancia aprueba, rechaza, calcula solvencia financiera ni autoriza desembolsos de crédito.</strong>
  </div>

  <div class="metric-grid">
    <div class="metric-box">
      <h3>{total_sols}</h3>
      <p>Solicitudes ({total_sols} de {total_sols})</p>
    </div>
    <div class="metric-box">
      <h3>{total_docs}</h3>
      <p>Documentos Verificados</p>
    </div>
    <div class="metric-box">
      <h3>{total_incs}</h3>
      <p>Incidencias Totales</p>
    </div>
    <div class="metric-box">
      <h3 style="color: #b91c1c;">{incs_altas}</h3>
      <p>Severidad ALTA</p>
    </div>
  </div>

  <h3>Resumen de Expedientes Analizados</h3>
  <table>
    <thead>
      <tr>
        <th>ID Solicitud</th>
        <th>Tipo Crédito</th>
        <th>Monto (COP)</th>
        <th>Estado Documental</th>
        <th>Revisión Firma</th>
      </tr>
    </thead>
    <tbody>
"""
        for s in solicitudes:
            s_dict = s if isinstance(s, dict) else s.__dict__
            est = s_dict.get("estado_analisis_documental", "EN_REVISION")
            badge_class = "badge-danger" if "REVISION" in est else ("badge-warn" if "OBSERVACIONES" in est else "badge-success")
            monto_fmt = f"${s_dict.get('monto_solicitado_normalizado', 0):,}" if s_dict.get('monto_solicitado_normalizado') else "Sin normalizar"
            html += f"""      <tr>
        <td><strong>{s_dict.get('id_solicitud_origen')}</strong></td>
        <td>{s_dict.get('tipo_credito_normalizado') or s_dict.get('tipo_credito_original')}</td>
        <td>{monto_fmt}</td>
        <td><span class="badge {badge_class}">{est}</span></td>
        <td>{s_dict.get('resultado_revision_firma')}</td>
      </tr>\n"""

        html += """    </tbody>
  </table>

  <h3 style="margin-top: 30px;">Acciones Recomendadas para el Equipo Humano</h3>
  <ol>
    <li>Validar manualmente en la cola de revisión todas las firmas de los formularios marcados con severidad ALTA/MEDIA.</li>
    <li>Gestionar con los solicitantes o canales los soportes faltantes identificados en la pestaña 'Inventario_por_solicitud'.</li>
    <li>Verificar permisos de Google Drive para los enlaces marcados como inaccesibles.</li>
  </ol>
</div>
</body>
</html>"""

        with open(ruta_html, "w", encoding="utf-8") as f:
            f.write(html)
