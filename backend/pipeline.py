"""
Pipeline Orquestador de Procesamiento por Lote de Crédito.
Ejecuta de forma secuencial, trazable e idempotente los 8 pasos:
1. Lectura de fuentes
2. Inventario
3. Comprobación de links Drive
4. OCR / Extracción
5. Normalización
6. Evaluación de reglas
7. Generación de incidencias
8. Exportación y verificación
"""

import os
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional

from backend.models import (
    SolicitudCredito, DocumentoMatriz, Incidencia, LoteAnalisis, EventoAuditoria
)
from backend.normalizer import NormalizadorCredito
from backend.rules_engine import MotorReglasCredito
from backend.drive_service import ServicioGoogleDrive
from backend.exporter import ExportadorLote


class PipelineLoteCredito:
    def __init__(self, exportador: Optional[ExportadorLote] = None):
        self.normalizador = NormalizadorCredito()
        self.drive_service = ServicioGoogleDrive()
        self.exportador = exportador or ExportadorLote()

    def procesar_lote(
        self,
        id_lote: str,
        id_carpeta_drive: str,
        nombre_carpeta_drive: str,
        filas_radicado: List[Dict[str, Any]],
        filas_matriz: List[Dict[str, Any]],
        version_politica: str = "POL-2026.1",
        usuario_operador: str = "analista.backoffice@fondodeempleados.org.co"
    ) -> Dict[str, Any]:
        """
        Ejecuta el ciclo de vida completo del lote.
        """
        bitacora: List[Dict[str, Any]] = []
        def auditar(accion: str, detalles: str):
            bitacora.append({
                "timestamp": datetime.now().isoformat(),
                "actor": usuario_operador,
                "lote_id": id_lote,
                "accion": accion,
                "detalles": detalles
            })

        auditar("INICIO_LOTE", f"Iniciando análisis para carpeta Drive '{nombre_carpeta_drive}' (ID: {id_carpeta_drive})")

        # PASO 1: Lectura e ingesta de radicado
        solicitudes: List[SolicitudCredito] = []
        for r in filas_radicado:
            sol = SolicitudCredito(
                id_solicitud_origen=str(r.get("id_solicitud_origen", "")).strip(),
                tipo_credito_original=str(r.get("tipo_credito_original", "")).strip(),
                fecha_registro_original=str(r.get("fecha_registro_original", "")).strip(),
                hora_registro_original=str(r.get("hora_registro_original", "")).strip(),
                monto_solicitado_original=str(r.get("monto_solicitado_original", "")).strip(),
                estado_original=str(r.get("estado_original", "RADICADO")).strip(),
                canal_original=str(r.get("canal_original", "VIRTUAL")).strip(),
                cantidad_soportes_reportada=int(r.get("cantidad_soportes_reportada", 0)),
                observacion_original=str(r.get("observacion_original", "")).strip(),
                prioridad_asignada_por_taller=str(r.get("prioridad_asignada_por_taller", "MEDIA")).strip(),
                tiempo_respuesta_objetivo_habiles=int(r.get("tiempo_respuesta_objetivo_habiles", 5)),
                fecha_hora_primera_respuesta=r.get("fecha_hora_primera_respuesta"),
                resultado_prueba=r.get("resultado_prueba"),
                firma_solicitante_revisada_por_participante=r.get("firma_solicitante_revisada_por_participante"),
                resultado_revision_firma=r.get("resultado_revision_firma", "PENDIENTE_HUMANO")
            )
            solicitudes.append(sol)

        auditar("LECTURA_RADICADO", f"{len(solicitudes)} solicitudes leídas exitosamente.")

        # PASO 2: Lectura de matriz documental y comprobación de enlaces
        documentos: List[DocumentoMatriz] = []
        for m in filas_matriz:
            url_raw = str(m.get("url_base2", "")).strip()
            file_id = self.drive_service.extraer_file_id(url_raw)
            nom_arch = str(m.get("nombre_archivo", "")).strip()
            fmt = str(m.get("formato", "application/pdf")).strip()

            verif_drive = self.drive_service.verificar_archivo_drive(file_id, nom_arch, fmt)

            doc = DocumentoMatriz(
                id_solicitud=str(m.get("id_solicitud", "")).strip(),
                id_documento=str(m.get("id_documento", "")).strip(),
                tipo_credito=str(m.get("tipo_credito", "")).strip(),
                tipo_documento=str(m.get("tipo_documento", "")).strip(),
                nombre_archivo=nom_arch,
                formato=fmt,
                url_base2=url_raw,
                drive_file_id=file_id,
                drive_mime_type=verif_drive.get("mime_real"),
                drive_name=verif_drive.get("nombre_real"),
                estado_verificacion=verif_drive.get("estado", "PENDIENTE"),
                url_canonico_drive=verif_drive.get("canonico"),
                es_legible=verif_drive.get("legible", True),
                confianza_extraccion=0.95 if verif_drive.get("legible") else 0.35,
                datos_extraidos=m.get("datos_extraidos", {})
            )
            documentos.append(doc)

        auditar("COMPROBACION_LINKS", f"{len(documentos)} enlaces de Drive evaluados.")

        # PASO 3: Normalización trazable (lado a lado)
        for s in solicitudes:
            tc_norm, _ = self.normalizador.normalizar_tipo_credito(s.tipo_credito_original)
            s.tipo_credito_normalizado = tc_norm

            f_norm, _ = self.normalizador.normalizar_fecha(s.fecha_registro_original)
            s.fecha_registro_normalizada = f_norm

            h_norm, _ = self.normalizador.normalizar_hora(s.hora_registro_original)
            s.hora_registro_normalizada = h_norm

            m_norm, moneda, _ = self.normalizador.normalizar_monto(s.monto_solicitado_original)
            s.monto_solicitado_normalizado = m_norm
            s.moneda_confirmada = moneda

            est_norm, _ = self.normalizador.normalizar_estado(s.estado_original)
            s.estado_normalizado = est_norm

            cnl_norm, _ = self.normalizador.normalizar_canal(s.canal_original)
            s.canal_normalizado = cnl_norm

        auditar("NORMALIZACION", "Normalización completada preservando originales.")

        # PASO 4: Evaluación de Reglas de Política e Incidencias
        motor_reglas = MotorReglasCredito(version_politica=version_politica)
        todas_incidencias: List[Incidencia] = []

        for s in solicitudes:
            docs_sol = [d for d in documentos if d.id_solicitud == s.id_solicitud_origen]
            incs = motor_reglas.evaluar_solicitud(s, docs_sol)
            todas_incidencias.extend(incs)

        auditar("REGLAS_EVALUADAS", f"Evaluadas reglas {version_politica}. {len(todas_incidencias)} incidencias generadas.")

        # PASO 5: Generación de jerarquía Drive y exportación
        num_lote = 1
        try:
            num_lote = int(id_lote.replace("Lote_", ""))
        except Exception:
            pass

        jerarquia = self.drive_service.generar_jerarquia_salida(id_carpeta_drive, num_lote, solicitudes)
        entregables = self.exportador.generar_entregables_completos(
            lote_id=id_lote,
            solicitudes=solicitudes,
            documentos=documentos,
            incidencias=todas_incidencias,
            jerarquia_drive=jerarquia,
            bitacora=bitacora,
            politica_version=version_politica
        )

        auditar("FINALIZACION_LOTE", f"Artefactos generados exitosamente en {entregables['carpeta_lote']}.")

        lote_resumen = LoteAnalisis(
            id_lote=id_lote,
            nombre_carpeta_drive=nombre_carpeta_drive,
            id_carpeta_drive=id_carpeta_drive,
            version_politica=version_politica,
            creado_por=usuario_operador,
            fecha_creacion=datetime.now().isoformat(),
            estado="LISTO_CON_OBSERVACIONES" if any(i.severidad == "ALTA" for i in todas_incidencias) else "LISTO",
            solicitudes_total=len(solicitudes),
            documentos_total=len(documentos),
            incidencias_total=len(todas_incidencias),
            incidencias_pendientes_humanas=sum(1 for i in todas_incidencias if i.estado_revision == "PENDIENTE_HUMANO"),
            ruta_salida_drive=jerarquia["url_lote"],
            carpetas_generadas={k: v["url"] for k, v in jerarquia["subcarpetas"].items()},
            bitacora=bitacora
        )

        return {
            "lote": lote_resumen.__dict__,
            "solicitudes": [s.__dict__ for s in solicitudes],
            "documentos": [d.__dict__ for d in documentos],
            "incidencias": [i.__dict__ for i in todas_incidencias],
            "jerarquia": jerarquia,
            "entregables": entregables,
            "bitacora": bitacora
        }
