"""
Motor de Reglas de Calidad y Validación Documental de Crédito.
Implementa políticas versionadas, cálculo de vigencias, comprobación de completitud,
detección de discrepancias y encolado riguroso a revisión humana.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.models import SolicitudCredito, DocumentoMatriz, Incidencia


class MotorReglasCredito:
    VERSION_POLITICA = "POL-2026.1"
    FECHA_POLITICA = "2026-01-15"

    REQUISITOS_COMUNES = ["FORMULARIO_SOLICITUD", "CEDULA", "DESPRENDIBLE_PAGO"]

    REQUISITOS_CONDICIONALES = {
        "LIBRANZA": [
            {"tipo": "CERTIFICADO_LABORAL", "vigencia_dias": 30, "condicion": "Siempre para libranza"}
        ],
        "VIVIENDA": [
            {"tipo": "CERTIFICADO_TRADICION", "vigencia_dias": 30, "condicion": "Siempre para vivienda"},
            {"tipo": "AVALUO_COMERCIAL", "vigencia_dias": 180, "condicion": "Monto > $50.000.000 COP", "umbral_monto": 50000000}
        ],
        "VEHICULO": [
            {"tipo": "COTIZACION_VEHICULO", "vigencia_dias": 30, "condicion": "Siempre para vehículo"}
        ],
        "LIBRE_INVERSION": [
            {"tipo": "CODEUDOR_SOPORTE", "vigencia_dias": 60, "condicion": "Monto > $20.000.000 COP", "umbral_monto": 20000000}
        ]
    }

    VIGENCIAS_GENERALES = {
        "DESPRENDIBLE_PAGO": 60,  # Máximo 60 días
        "CERTIFICADO_LABORAL": 30,
        "CERTIFICADO_TRADICION": 30,
        "COTIZACION_VEHICULO": 30,
        "AVALUO_COMERCIAL": 180,
    }

    def __init__(self, version_politica: Optional[str] = None):
        self.politica_activa = version_politica or self.VERSION_POLITICA
        self.politica_disponible = (self.politica_activa == self.VERSION_POLITICA)

    def evaluar_solicitud(
        self,
        solicitud: SolicitudCredito,
        documentos: List[DocumentoMatriz]
    ) -> List[Incidencia]:
        incidencias: List[Incidencia] = []
        doc_counter = 1

        if not self.politica_disponible:
            incidencias.append(Incidencia(
                id_incidencia=f"INC-{solicitud.id_solicitud_origen}-POL-01",
                id_solicitud=solicitud.id_solicitud_origen,
                id_documento=None,
                tipo_incidencia="POLITICA_NO_DISPONIBLE",
                severidad="ALTA",
                impacto="No es posible emitir dictamen documental con reglas no auditadas.",
                detalle=f"La política '{self.politica_activa}' no está cargada o no es verificable.",
                evidencia_fuente="Configuración de lote",
                accion_sugerida="Cargar y mapear versión oficial de política antes de continuar.",
                estado_revision="PENDIENTE_HUMANO"
            ))
            return incidencias

        tipos_docs_presentes = [d.tipo_documento.strip().upper() for d in documentos]
        solicitud.documentos_presentes_count = len(documentos)

        # 1. Comprobación conteo reportado vs encontrado en matriz
        if len(documentos) != solicitud.cantidad_soportes_reportada:
            solicitud.conteo_matriz_vs_reportado_coincide = False
            incidencias.append(Incidencia(
                id_incidencia=f"INC-{solicitud.id_solicitud_origen}-CNT-01",
                id_solicitud=solicitud.id_solicitud_origen,
                id_documento=None,
                tipo_incidencia="CONTEO_SOPORTES_DISCREPANTE",
                severidad="MEDIA",
                impacto="Posible extravío de soporte o registro erróneo en radicado.",
                detalle=f"Radicado reporta {solicitud.cantidad_soportes_reportada} soportes pero en matriz figuran {len(documentos)}.",
                evidencia_fuente=f"Radicado: {solicitud.cantidad_soportes_reportada} vs Matriz: {len(documentos)}",
                accion_sugerida="Confirmar con el canal si faltó anexar algún archivo a la carpeta Drive.",
                estado_revision="PENDIENTE_HUMANO"
            ))
        else:
            solicitud.conteo_matriz_vs_reportado_coincide = True

        # 2. Requisitos comunes
        faltantes = []
        for req in self.REQUISITOS_COMUNES:
            if req not in tipos_docs_presentes:
                faltantes.append(req)
                incidencias.append(Incidencia(
                    id_incidencia=f"INC-{solicitud.id_solicitud_origen}-REQ-{req[:3]}",
                    id_solicitud=solicitud.id_solicitud_origen,
                    id_documento=None,
                    tipo_incidencia="FALTANTE_DOCUMENTAL",
                    severidad="ALTA",
                    impacto="Expediente incompleto para tramitación de crédito.",
                    detalle=f"Falta requisito obligatorio general: {req}.",
                    evidencia_fuente="Matriz de documentos del lote",
                    accion_sugerida=f"Solicitar al asociado o canal el documento {req}.",
                    estado_revision="PENDIENTE_HUMANO"
                ))

        # 3. Requisitos condicionales por tipo de crédito y monto
        tipo_credito = solicitud.tipo_credito_normalizado or solicitud.tipo_credito_original
        reglas_tipo = self.REQUISITOS_CONDICIONALES.get(tipo_credito, [])
        monto = solicitud.monto_solicitado_normalizado or 0

        for regla in reglas_tipo:
            tipo_req = regla["tipo"]
            umbral = regla.get("umbral_monto", 0)
            aplica = True
            if umbral > 0 and monto <= umbral:
                aplica = False

            if aplica and tipo_req not in tipos_docs_presentes:
                faltantes.append(tipo_req)
                incidencias.append(Incidencia(
                    id_incidencia=f"INC-{solicitud.id_solicitud_origen}-COND-{tipo_req[:3]}",
                    id_solicitud=solicitud.id_solicitud_origen,
                    id_documento=None,
                    tipo_incidencia="FALTANTE_CONDICIONAL",
                    severidad="ALTA",
                    impacto=f"Requisito condicional por tipo {tipo_credito} y monto ${monto:,} COP.",
                    detalle=f"Falta soporte requerido: {tipo_req} ({regla['condicion']}).",
                    evidencia_fuente=f"Regla {self.politica_activa} para producto {tipo_credito}",
                    accion_sugerida=f"Solicitar {tipo_req} correspondiente a la política de {tipo_credito}.",
                    estado_revision="PENDIENTE_HUMANO"
                ))

        solicitud.documentos_faltantes = faltantes

        # 4. Evaluación de cada documento individual
        for doc in documentos:
            # 4.1 Accesibilidad y verificación de enlace Drive
            if doc.estado_verificacion in ["NO_ACCESIBLE", "ID_INVALIDO"]:
                incidencias.append(Incidencia(
                    id_incidencia=f"INC-{solicitud.id_solicitud_origen}-DRV-{doc.id_documento}",
                    id_solicitud=solicitud.id_solicitud_origen,
                    id_documento=doc.id_documento,
                    tipo_incidencia="ENLACE_DRIVE_INACCESIBLE",
                    severidad="ALTA",
                    impacto="El archivo no puede ser auditado ni abierto por el equipo de back office.",
                    detalle=f"Archivo '{doc.nombre_archivo}' con ID '{doc.drive_file_id}': {doc.estado_verificacion}.",
                    evidencia_fuente=f"URL: {doc.url_base2}",
                    accion_sugerida="Verificar permisos en carpeta origen o corregir ID en matriz.",
                    estado_revision="PENDIENTE_HUMANO"
                ))
                continue

            if doc.estado_verificacion == "ENLACE_DISCREPANTE":
                incidencias.append(Incidencia(
                    id_incidencia=f"INC-{solicitud.id_solicitud_origen}-DISC-{doc.id_documento}",
                    id_solicitud=solicitud.id_solicitud_origen,
                    id_documento=doc.id_documento,
                    tipo_incidencia="DISCREPANCIA_METADATOS",
                    severidad="MEDIA",
                    impacto="El enlace de la matriz apunta a un archivo con nombre o tipo MIME distinto.",
                    detalle=f"Nombre matriz: '{doc.nombre_archivo}' vs Drive: '{doc.drive_name}'.",
                    evidencia_fuente=f"Drive API Metadata (ID: {doc.drive_file_id})",
                    accion_sugerida="Confirmar si hubo renombrado o sustitución del archivo.",
                    estado_revision="PENDIENTE_HUMANO"
                ))

            # 4.2 Legibilidad y OCR
            if not doc.es_legible:
                incidencias.append(Incidencia(
                    id_incidencia=f"INC-{solicitud.id_solicitud_origen}-OCR-{doc.id_documento}",
                    id_solicitud=solicitud.id_solicitud_origen,
                    id_documento=doc.id_documento,
                    tipo_incidencia="DOCUMENTO_NO_LEGIBLE",
                    severidad="ALTA",
                    impacto="No se pueden extraer datos indispensables del documento.",
                    detalle=f"El archivo '{doc.nombre_archivo}' está borroso, dañado o sin texto legible.",
                    evidencia_fuente="Análisis visual / OCR de documento",
                    accion_sugerida="Solicitar al solicitante reenvío de copia escaneada legible.",
                    estado_revision="PENDIENTE_HUMANO"
                ))

            # 4.3 Vigencia documental
            tipo_doc_u = doc.tipo_documento.strip().upper()
            dias_max = self.VIGENCIAS_GENERALES.get(tipo_doc_u)
            if dias_max and "fecha_expedicion" in doc.datos_extraidos:
                fecha_exp_str = doc.datos_extraidos["fecha_expedicion"]
                try:
                    fecha_exp = datetime.strptime(fecha_exp_str, "%Y-%m-%d").date()
                    fecha_ref = datetime.strptime(solicitud.fecha_registro_normalizada or "2026-10-15", "%Y-%m-%d").date()
                    delta_dias = (fecha_ref - fecha_exp).days
                    if delta_dias > dias_max:
                        incidencias.append(Incidencia(
                            id_incidencia=f"INC-{solicitud.id_solicitud_origen}-VIG-{doc.id_documento}",
                            id_solicitud=solicitud.id_solicitud_origen,
                            id_documento=doc.id_documento,
                            tipo_incidencia="VIGENCIA_EXPIRADA",
                            severidad="MEDIA",
                            impacto=f"Vigencia máxima permitida es de {dias_max} días; soporte tiene {delta_dias} días de emitido.",
                            detalle=f"{doc.tipo_documento} emitido el {fecha_exp_str} excede el límite de {dias_max} días.",
                            evidencia_fuente=f"Fecha expedición extraída: {fecha_exp_str} vs Radicación: {fecha_ref}",
                            accion_sugerida="Solicitar soporte con fecha de expedición actualizada.",
                            estado_revision="PENDIENTE_HUMANO"
                        ))
                except Exception as e:
                    pass

            # 4.4 Discrepancia de datos en Formulario
            if tipo_doc_u == "FORMULARIO_SOLICITUD":
                # Verificación de firma: NUNCA asegurar autenticidad
                firma_detectada = doc.datos_extraidos.get("firma_visible", False)
                if not firma_detectada:
                    incidencias.append(Incidencia(
                        id_incidencia=f"INC-{solicitud.id_solicitud_origen}-FIRMA-01",
                        id_solicitud=solicitud.id_solicitud_origen,
                        id_documento=doc.id_documento,
                        tipo_incidencia="FIRMA_NO_VISIBLE",
                        severidad="ALTA",
                        impacto="Formulario sin firma física o digital visible no puede ser tramitado.",
                        detalle="No se visualizó rúbrica ni estampa digital en la sección de firma del formulario.",
                        evidencia_fuente=f"Página 1 de {doc.nombre_archivo}",
                        accion_sugerida="Revisar manualmente el documento para verificar existencia de firma.",
                        estado_revision="PENDIENTE_HUMANO"
                    ))
                else:
                    # Rúbrica detectada pero SIEMPRE requiere revisión humana de autenticidad
                    incidencias.append(Incidencia(
                        id_incidencia=f"INC-{solicitud.id_solicitud_origen}-FIRMA-REV",
                        id_solicitud=solicitud.id_solicitud_origen,
                        id_documento=doc.id_documento,
                        tipo_incidencia="REVISION_FIRMA_REQUERIDA",
                        severidad="MEDIA",
                        impacto="La IA no autentica firmas ni consentimiento legal.",
                        detalle="Rúbrica visible detectada. Corresponde al analista validar concordancia con cédula y vigencia de poderes.",
                        evidencia_fuente=f"Firma en {doc.nombre_archivo}",
                        accion_sugerida="Analista debe contrastar firma con cédula y marcar 'Confirmado' con su usuario auditado.",
                        estado_revision="PENDIENTE_HUMANO"
                    ))

                # Discrepancia de monto entre formulario y radicado
                monto_form = doc.datos_extraidos.get("monto_formulario")
                if monto_form and solicitud.monto_solicitado_normalizado:
                    if monto_form != solicitud.monto_solicitado_normalizado:
                        incidencias.append(Incidencia(
                            id_incidencia=f"INC-{solicitud.id_solicitud_origen}-DISC-MONTO",
                            id_solicitud=solicitud.id_solicitud_origen,
                            id_documento=doc.id_documento,
                            tipo_incidencia="DISCREPANCIA_VALORES",
                            severidad="ALTA",
                            impacto="Conflicto entre la cifra solicitada en radicado y la firmada en formulario.",
                            detalle=f"Radicado indica ${solicitud.monto_solicitado_normalizado:,} COP pero formulario dice ${monto_form:,} COP.",
                            evidencia_fuente=f"Formulario {doc.nombre_archivo} vs Radicado origen",
                            accion_sugerida="Aclarar con el analista comercial y el asociado la cifra real del préstamo.",
                            estado_revision="PENDIENTE_HUMANO"
                        ))

        # Determinar estado documental
        tiene_alta = any(i.severidad == "ALTA" for i in incidencias)
        tiene_media = any(i.severidad == "MEDIA" for i in incidencias)

        if tiene_alta:
            solicitud.estado_analisis_documental = "REQUIERE_REVISION_HUMANA"
        elif tiene_media:
            solicitud.estado_analisis_documental = "CON_OBSERVACIONES"
        else:
            solicitud.estado_analisis_documental = "COMPLETO_CONFORME"

        return incidencias
