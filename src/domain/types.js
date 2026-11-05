/**
 * Implementación de Tipos y Fábricas de Dominio en ESM
 */

export const REVIEW_STATES = {
  POR_REVISAR: 'Por revisar',
  VERIFICADO: 'Verificado',
  NO_VERIFICABLE: 'No verificable',
  REQUIERE_ACCION: 'Requiere acción'
};

export const DOCUMENT_REVIEW_STATUS = {
  SIN_REVISAR: 'Sin revisar',
  ABIERTO_LEGIBLE: 'Abierto y legible',
  ENLACE_ROTO: 'Enlace sin permisos / roto',
  ILEGIBLE_INCOMPLETO: 'Ilegible o incompleto'
};

export const LINK_STATUS = {
  MISSING: 'MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PLAUSIBLE_URL: 'PLAUSIBLE_URL',
  PLAUSIBLE_DRIVE_ID: 'PLAUSIBLE_DRIVE_ID',
  MANUAL_VERIFIED: 'MANUAL_VERIFIED'
};

export const FINDING_SEVERITY = {
  BLOQUEANTE: 'Bloqueante / Alta',
  ADVERTENCIA: 'Advertencia / Media',
  INFORMATIVA: 'Informativa'
};

export const FINDING_CATEGORIES = {
  FALTANTE: 'Faltante',
  DISCREPANCIA: 'Discrepancia',
  VIGENCIA: 'Dato fuera de vigencia según regla configurada',
  ENLACE_NO_DISPONIBLE: 'Enlace no disponible',
  DATO_AMBIGUO: 'Dato ambiguo',
  POSIBLE_DUPLICADO: 'Posible duplicado',
  REVISION_HUMANA: 'Revisión humana'
};

/**
 * Fábrica para DualValue<T>
 */
export function createDualValue(raw, normalized, status = 'valid', mappingNote = '') {
  return {
    raw: raw === undefined ? null : raw,
    normalized: normalized === undefined ? null : normalized,
    status: status,
    mappingNote: mappingNote || undefined
  };
}

/**
 * Configuración de reglas por defecto (Todas apagadas)
 */
export function getDefaultRuleConfig() {
  return {
    modoSimulacionActivo: false,
    vigenciaDocumentosActiva: false,
    vigenciaDiasMax: 60,
    documentosObligatoriosActivo: false,
    documentosObligatoriosPorTipo: {
      'LIBRE_INVERSION': ['Pagaré', 'Desprendible de nómina', 'Cédula de ciudadanía'],
      'LIBRANZA': ['Pagaré', 'Autorización de libranza', 'Desprendible de nómina'],
      'VIVIENDA': ['Pagaré', 'Certificado de tradición y libertad', 'Desprendible de nómina'],
      'VEHICULO': ['Pagaré', 'Factura o promesa de compraventa', 'Desprendible de nómina']
    },
    slaAtencionActivo: false,
    slaHorasMax: 48
  };
}
