"""
Modelos de datos para el Back Office de Solicitudes de Crédito.
Garantiza trazabilidad original -> normalizado y no almacena credenciales ni PII innecesaria.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime


@dataclass
class DocumentoMatriz:
    id_solicitud: str
    id_documento: str
    tipo_credito: str
    tipo_documento: str
    nombre_archivo: str
    formato: str
    url_base2: str
    # Campos verificados en Drive:
    drive_file_id: Optional[str] = None
    drive_mime_type: Optional[str] = None
    drive_name: Optional[str] = None
    estado_verificacion: str = "PENDIENTE"  # ACCESIBLE, NO_ACCESIBLE, ID_INVALIDO, ENLACE_DISCREPANTED
    url_canonico_drive: Optional[str] = None
    es_legible: bool = True
    confianza_extraccion: float = 1.0
    datos_extraidos: Dict[str, Any] = field(default_factory=dict)
    hallazgos_documento: List[str] = field(default_factory=list)


@dataclass
class Incidencia:
    id_incidencia: str
    id_solicitud: str
    id_documento: Optional[str]
    tipo_incidencia: str  # FALTANTE_DOCUMENTAL, VIGENCIA_EXPIRADA, DISCREPANCIA_VALORES, ENLACE_ROTO, FIRMA_DUDOSA, etc.
    severidad: str  # ALTA (Bloqueante documental), MEDIA (Revisión obligatoria), BAJA (Informativa)
    impacto: str
    detalle: str
    evidencia_fuente: str
    accion_sugerida: str
    estado_revision: str = "PENDIENTE_HUMANO"  # PENDIENTE_HUMANO, CONFIRMADO, CORREGIDO, PEDIR_SOPORTE, ESCALADO
    revisado_por: Optional[str] = None
    fecha_revision: Optional[str] = None
    comentario_revisor: Optional[str] = None


@dataclass
class SolicitudCredito:
    # Datos originales inmutables
    id_solicitud_origen: str
    tipo_credito_original: str
    fecha_registro_original: str
    hora_registro_original: str
    monto_solicitado_original: str
    estado_original: str
    canal_original: str
    cantidad_soportes_reportada: int
    observacion_original: str
    prioridad_asignada_por_taller: str
    tiempo_respuesta_objetivo_habiles: int
    fecha_hora_primera_respuesta: Optional[str] = None
    resultado_prueba: Optional[str] = None
    firma_solicitante_revisada_por_participante: Optional[str] = None
    resultado_revision_firma: str = "PENDIENTE_HUMANO"

    # Datos normalizados (lado a lado con trazabilidad)
    tipo_credito_normalizado: Optional[str] = None
    fecha_registro_normalizada: Optional[str] = None  # YYYY-MM-DD
    hora_registro_normalizada: Optional[str] = None   # HH:MM 24h
    monto_solicitado_normalizado: Optional[int] = None  # Entero en COP
    moneda_confirmada: str = "COP"
    estado_normalizado: Optional[str] = None
    canal_normalizado: Optional[str] = None
    
    # Metadatos del análisis documental
    documentos_presentes_count: int = 0
    documentos_faltantes: List[str] = field(default_factory=list)
    documentos_adicionales: List[str] = field(default_factory=list)
    conteo_matriz_vs_reportado_coincide: bool = False
    estado_analisis_documental: str = "EN_REVISION"  # COMPLETO_CONFORME, CON_OBSERVACIONES, REQUIERE_REVISION_HUMANA, INCOMPLETO
    
    # Nota estricta: NO se calcula aprobación o rechazo financiero.
    nota_legal: str = "Este resultado es exclusivamente documental. No constituye aprobación, rechazo ni scoring crediticio."


@dataclass
class EventoAuditoria:
    timestamp: str
    lote_id: str
    actor: str  # Usuario o 'SISTEMA_PIPELINE'
    accion: str
    detalles: str
    ip_origen: str = "127.0.0.1"


@dataclass
class LoteAnalisis:
    id_lote: str  # Ej: Lote_001
    nombre_carpeta_drive: str
    id_carpeta_drive: str
    version_politica: str
    creado_por: str
    fecha_creacion: str
    estado: str = "PENDIENTE"  # PENDIENTE, PROCESANDO, LISTO, LISTO_CON_OBSERVACIONES, ERROR_PARCIAL
    solicitudes_total: int = 0
    documentos_total: int = 0
    incidencias_total: int = 0
    incidencias_pendientes_humanas: int = 0
    ruta_salida_drive: Optional[str] = None
    carpetas_generadas: Dict[str, str] = field(default_factory=dict)
    bitacora: List[Dict[str, Any]] = field(default_factory=list)
