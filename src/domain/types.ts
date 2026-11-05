/**
 * Definiciones de Tipos de Dominio para el Sistema de Revisión Documental de Créditos
 * 
 * Cumple estrictamente con los Guardrails:
 * - Trazabilidad Dual (raw vs normalized)
 * - Honestidad en enlaces externos (MISSING, INVALID_FORMAT, PLAUSIBLE_URL, PLAUSIBLE_DRIVE_ID, MANUAL_VERIFIED)
 * - Estados de revisión exclusivamente documentales (Verificado, No verificable, Por revisar, Requiere acción)
 */

export type DualStatus = 'valid' | 'ambiguous' | 'empty' | 'unmapped';

export interface DualValue<T> {
  raw: string | number | null;
  normalized: T | null;
  status: DualStatus;
  mappingNote?: string;
}

export type ReviewState = 'Por revisar' | 'Verificado' | 'No verificable' | 'Requiere acción';

export type DocumentReviewStatus = 
  | 'Sin revisar'
  | 'Abierto y legible'
  | 'Enlace sin permisos / roto'
  | 'Ilegible o incompleto';

export type LinkStatus = 
  | 'MISSING'                // Sin enlace / Vacío
  | 'INVALID_FORMAT'         // Formato de enlace inválido (ej. ruta local, http:// inseguro)
  | 'PLAUSIBLE_URL'          // Enlace plausible (Acceso no verificado) - URL https:// bien formada
  | 'PLAUSIBLE_DRIVE_ID'     // ID de Google Drive plausible (construido de forma segura)
  | 'MANUAL_VERIFIED';       // Verificado manualmente en sesión por la analista

export interface DriveLinkResolution {
  status: LinkStatus;
  label: string;
  originalValue: string | null;
  resolvedUrl: string | null;
  isConstructed: boolean;
  canOpen: boolean;
  notes?: string;
}

export interface RadicadoRecord {
  solicitudId: DualValue<string>;
  tipoCredito: DualValue<string>;
  fechaRegistro: DualValue<string>;
  horaRegistro?: DualValue<string>;
  montoSolicitado: DualValue<number>;
  estado: DualValue<string>;
  canal?: DualValue<string>;
  cantidadSoportesReportada: DualValue<number>;
  observaciones?: DualValue<string>;
  _rowIndex: number;
}

export interface DocumentoRecord {
  solicitudId: DualValue<string>;
  documentoId: DualValue<string>;
  tipoCredito?: DualValue<string>;
  tipoDocumento: DualValue<string>;
  nombreArchivo?: DualValue<string>;
  urlOIdFuente: DualValue<string>;
  linkResolution: DriveLinkResolution;
  userReviewStatus: DocumentReviewStatus;
  _rowIndex: number;
}

export type FindingSeverity = 'Bloqueante / Alta' | 'Advertencia / Media' | 'Informativa';

export type FindingCategory = 
  | 'Faltante'
  | 'Discrepancia'
  | 'Dato fuera de vigencia según regla configurada'
  | 'Enlace no disponible'
  | 'Dato ambiguo'
  | 'Posible duplicado'
  | 'Revisión humana';

export interface Finding {
  id: string;
  solicitudId: string;
  documentoId?: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  ruleCompared: string;
  explanation: string;
  exactEvidence: string;
  suggestedAction: string;
  isSimulationRule?: boolean;
  documentLink?: string | null;
  documentLinkCanOpen?: boolean;
  reviewState: ReviewState;
  reviewNote?: string;
}

export interface SolicitudAnalysis {
  solicitud: RadicadoRecord;
  solicitudId: string;
  documentos: DocumentoRecord[];
  conteoReportado: number | null;
  conteoEncontrado: number;
  diferenciaConteo: number;
  hallazgos: Finding[];
  severidadMaxima: FindingSeverity | 'Sin hallazgos';
  reviewState: ReviewState;
  reviewNote?: string;
}

export interface OrphanDocument {
  documento: DocumentoRecord;
  motivo: string;
}

export interface BatchSummary {
  totalSolicitudes: number;
  solicitudesUnicas: number;
  solicitudesConIdRepetido: number;
  totalDocumentos: number;
  documentosHuerfanos: number;
  solicitudesConDiscrepanciaSoportes: number;
  documentosConEnlacePlausible: number;
  documentosSinEnlaceOInvalido: number;
  hallazgosPorSeveridad: {
    bloqueante: number;
    advertencia: number;
    informativa: number;
    total: number;
  };
  revisionesPendientes: number;
  revisionesVerificadas: number;
  revisionesRequiereAccion: number;
  revisionesNoVerificable: number;
}

export interface RuleConfig {
  modoSimulacionActivo: boolean;
  vigenciaDocumentosActiva: boolean;
  vigenciaDiasMax: number;
  documentosObligatoriosActivo: boolean;
  documentosObligatoriosPorTipo: Record<string, string[]>;
  slaAtencionActivo: boolean;
  slaHorasMax: number;
}
