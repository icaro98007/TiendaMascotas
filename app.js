/**
 * app.js - Bundle autocontenido para ejecución directa (file:// y http://)
 * Generado para compatibilidad total con doble clic en navegador.
 */
(function() {
  'use strict';


  // ==========================================
  // Módulo: domain/types.js
  // ==========================================

/**
 * Implementación de Tipos y Fábricas de Dominio en ESM
 */

const REVIEW_STATES = {
  POR_REVISAR: 'Por revisar',
  VERIFICADO: 'Verificado',
  NO_VERIFICABLE: 'No verificable',
  REQUIERE_ACCION: 'Requiere acción'
};

const DOCUMENT_REVIEW_STATUS = {
  SIN_REVISAR: 'Sin revisar',
  ABIERTO_LEGIBLE: 'Abierto y legible',
  ENLACE_ROTO: 'Enlace sin permisos / roto',
  ILEGIBLE_INCOMPLETO: 'Ilegible o incompleto'
};

const LINK_STATUS = {
  MISSING: 'MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PLAUSIBLE_URL: 'PLAUSIBLE_URL',
  PLAUSIBLE_DRIVE_ID: 'PLAUSIBLE_DRIVE_ID',
  MANUAL_VERIFIED: 'MANUAL_VERIFIED'
};

const FINDING_SEVERITY = {
  BLOQUEANTE: 'Bloqueante / Alta',
  ADVERTENCIA: 'Advertencia / Media',
  INFORMATIVA: 'Informativa'
};

const FINDING_CATEGORIES = {
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
function createDualValue(raw, normalized, status = 'valid', mappingNote = '') {
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
function getDefaultRuleConfig() {
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



  // ==========================================
  // Módulo: services/driveLinkResolver.js
  // ==========================================

/**
 * driveLinkResolver.js
 * 
 * Validador y constructor seguro de enlaces hacia documentos fuente.
 * Cumple estrictamente con el Guardrail de Honestidad Documental:
 * Jamás afirma que un documento fue "verificado" o "abierto" automáticamente sin inspección.
 */


const GOOGLE_DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{25,50}$/;

/**
 * Resuelve y valida el valor de urlOIdFuente
 * @param {string|number|null} rawValue 
 * @returns {import('../domain/types').DriveLinkResolution}
 */
function resolveDriveLink(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return {
      status: LINK_STATUS.MISSING,
      label: 'Sin enlace de documento fuente',
      originalValue: null,
      resolvedUrl: null,
      isConstructed: false,
      canOpen: false,
      notes: 'No se reportó enlace ni identificador en la matriz documental.'
    };
  }

  const trimmed = String(rawValue).trim();

  if (trimmed === '') {
    return {
      status: LINK_STATUS.MISSING,
      label: 'Sin enlace de documento fuente',
      originalValue: '',
      resolvedUrl: null,
      isConstructed: false,
      canOpen: false,
      notes: 'Campo de enlace vacío en la matriz documental.'
    };
  }

  // Caso 2: URL https:// bien formada
  if (trimmed.startsWith('https://')) {
    try {
      const parsedUrl = new URL(trimmed);
      if (parsedUrl.protocol === 'https:' && parsedUrl.hostname.length > 3) {
        return {
          status: LINK_STATUS.PLAUSIBLE_URL,
          label: 'Enlace plausible (Acceso no verificado)',
          originalValue: trimmed,
          resolvedUrl: trimmed,
          isConstructed: false,
          canOpen: true,
          notes: 'URL HTTPS sintácticamente válida. Acceso y permisos no verificados automáticamente.'
        };
      }
    } catch {
      // Cayó en URL inválida
    }
  }

  // Caso 3: ID de Google Drive alfanumérico estricto
  // Pattern: ^[a-zA-Z0-9_-]{25,50}$ sin espacios ni barras
  if (GOOGLE_DRIVE_ID_REGEX.test(trimmed)) {
    const constructedUrl = `https://drive.google.com/file/d/${trimmed}/view`;
    return {
      status: LINK_STATUS.PLAUSIBLE_DRIVE_ID,
      label: 'ID de Drive reconstruido (Acceso no verificado)',
      originalValue: trimmed,
      resolvedUrl: constructedUrl,
      isConstructed: true,
      canOpen: true,
      notes: `Enlace construido a partir del ID reportado: ${trimmed}. Acceso no verificado.`
    };
  }

  // Caso 4: Cualquier otro caso (http:// inseguro, rutas locales C:\..., texto libre, etc.)
  let reason = 'Formato de enlace no reconocido como URL HTTPS ni ID de Drive válido.';
  if (trimmed.startsWith('http://')) {
    reason = 'Protocolo HTTP no seguro no admitido por política de seguridad web.';
  } else if (/^[a-zA-Z]:\\/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    reason = 'Ruta local no accesible vía web ni enlace de nube.';
  }

  return {
    status: LINK_STATUS.INVALID_FORMAT,
    label: 'Formato de enlace inválido',
    originalValue: trimmed,
    resolvedUrl: null,
    canOpen: false,
    isConstructed: false,
    notes: reason
  };
}



  // ==========================================
  // Módulo: services/normalizer.js
  // ==========================================

/**
 * normalizer.js
 * 
 * Funciones puras para normalizar fechas, horas, montos y catálogos
 * manteniendo intacto el valor original (raw) en una estructura DualValue<T>.
 */


/**
 * Normaliza fechas sin adivinar formatos ambiguos.
 * @param {any} rawValue 
 * @returns {import('../domain/types').DualValue<string>}
 */
function normalizeDate(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Valor de fecha ausente');
  }

  // 1. Número serial de Excel (ej: 45678)
  if (typeof rawValue === 'number' && rawValue > 1000 && rawValue < 100000) {
    try {
      // Excel epoch inicia en 1899-12-30 debido al bug del año bisiesto de 1900
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + rawValue * 86400000);
      const iso = date.toISOString().split('T')[0];
      return createDualValue(rawValue, iso, 'valid', `Convertido desde número serial Excel (${rawValue})`);
    } catch {
      return createDualValue(rawValue, null, 'ambiguous', 'Error al interpretar serial numérico de fecha');
    }
  }

  const str = String(rawValue).trim();

  // 2. Formato ISO ya estandarizado: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n) => String(n).padStart(2, '0');
      const isoFormatted = `${year}-${pad(month)}-${pad(day)}`;
      return createDualValue(rawValue, isoFormatted, 'valid', 'Formato ISO YYYY-MM-DD inequívoco');
    }
  }

  // 3. Formato DD/MM/YYYY o MM/DD/YYYY
  const partsMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s].*)?$/);
  if (partsMatch) {
    const num1 = parseInt(partsMatch[1], 10);
    const num2 = parseInt(partsMatch[2], 10);
    const year = parseInt(partsMatch[3], 10);
    const pad = (n) => String(n).padStart(2, '0');

    // Inequívoco porque num1 > 12, por lo tanto DEBE ser DD/MM/YYYY
    if (num1 > 12 && num1 <= 31 && num2 >= 1 && num2 <= 12) {
      const isoFormatted = `${year}-${pad(num2)}-${pad(num1)}`;
      return createDualValue(rawValue, isoFormatted, 'valid', 'Formato DD/MM/YYYY inequívoco (día > 12)');
    }

    // Inequívoco si num2 > 12, por lo tanto DEBE ser MM/DD/YYYY
    if (num2 > 12 && num2 <= 31 && num1 >= 1 && num1 <= 12) {
      const isoFormatted = `${year}-${pad(num1)}-${pad(num2)}`;
      return createDualValue(rawValue, isoFormatted, 'valid', 'Formato MM/DD/YYYY inequívoco (día > 12)');
    }

    // Si num1 y num2 son ambos <= 12 (ej. 04/05/2025 o 03/04/2025)
    // Es estrictamente ambiguo según guardrails.
    return createDualValue(
      rawValue,
      null,
      'ambiguous',
      `Fecha ambigua (${num1} y ${num2} son ≤ 12). No es posible determinar si es DD/MM o MM/DD con certeza.`
    );
  }

  // Si tiene texto o mes en letras (ej: 15 de marzo de 2025)
  const meses = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
  };
  const textoMatch = str.toLowerCase().match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})/);
  if (textoMatch && meses[textoMatch[2]]) {
    const day = String(textoMatch[1]).padStart(2, '0');
    const month = meses[textoMatch[2]];
    const year = textoMatch[3];
    return createDualValue(rawValue, `${year}-${month}-${day}`, 'valid', 'Convertido desde texto con nombre de mes');
  }

  return createDualValue(rawValue, null, 'ambiguous', 'Formato de fecha no reconocido');
}

/**
 * Normaliza valores de hora a HH:mm:ss
 */
function normalizeTime(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Hora no reportada');
  }

  // Serial decimal de hora en Excel (fracción de día, ej: 0.5 = 12:00:00)
  if (typeof rawValue === 'number' && rawValue >= 0 && rawValue < 1) {
    const totalSeconds = Math.round(rawValue * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return createDualValue(rawValue, `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, 'valid', 'Convertido desde fracción horaria Excel');
  }

  const str = String(rawValue).trim();
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const pad = (n) => String(n).padStart(2, '0');
    return createDualValue(rawValue, `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, 'valid', 'Hora normalizada');
  }

  return createDualValue(rawValue, null, 'ambiguous', 'Formato de hora no reconocido');
}

/**
 * Normaliza montos numéricos conservando decimales y detectando ambigüedades.
 * No redondea ni convierte divisas.
 * @param {any} rawValue 
 * @returns {import('../domain/types').DualValue<number>}
 */
function normalizeAmount(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Monto ausente');
  }

  // Ya es número
  if (typeof rawValue === 'number') {
    if (isNaN(rawValue)) {
      return createDualValue(rawValue, null, 'ambiguous', 'Valor numérico NaN');
    }
    return createDualValue(rawValue, rawValue, 'valid', 'Valor numérico nativo conservado');
  }

  const str = String(rawValue).trim();

  // Limpiar moneda o prefijos pero retener para nota
  const hasCurrencySign = /[$]|COP|USD|EUR/.test(str);
  let clean = str.replace(/[$]|COP|USD|EUR/gi, '').trim();

  // Si contiene caracteres extraños además de dígitos, puntos, comas, espacios y guion
  if (/[^0-9.,\s-]/.test(clean)) {
    return createDualValue(rawValue, null, 'ambiguous', 'Contiene caracteres no numéricos inválidos');
  }

  // Detectar formato de separadores (Colombiano 15.000.000,00 vs Anglosajón 15,000,000.00)
  const hasDots = clean.includes('.');
  const hasCommas = clean.includes(',');

  let parsedNumber = null;

  if (hasDots && hasCommas) {
    const lastDot = clean.lastIndexOf('.');
    const lastComma = clean.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato colombiano / europeo: 15.000.000,50
      const standardStr = clean.replace(/\./g, '').replace(',', '.');
      parsedNumber = parseFloat(standardStr);
    } else {
      // Formato anglosajón: 15,000,000.50
      const standardStr = clean.replace(/,/g, '');
      parsedNumber = parseFloat(standardStr);
    }
  } else if (hasDots && !hasCommas) {
    // Podría ser 15.000.000 (miles) o 1500000.50 (decimal)
    const dotCount = (clean.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Múltiples puntos son separadores de miles
      parsedNumber = parseFloat(clean.replace(/\./g, ''));
    } else {
      const parts = clean.split('.');
      if (parts[1].length === 3 && parts[0].length >= 1) {
        // Probable separador de miles (ej: 15.000)
        parsedNumber = parseFloat(clean.replace(/\./g, ''));
      } else {
        // Decimal estándar
        parsedNumber = parseFloat(clean);
      }
    }
  } else if (hasCommas && !hasDots) {
    const commaCount = (clean.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Múltiples comas (separadores de miles anglosajones)
      parsedNumber = parseFloat(clean.replace(/,/g, ''));
    } else {
      const parts = clean.split(',');
      if (parts[1].length === 3 && parts[0].length >= 1) {
        parsedNumber = parseFloat(clean.replace(/,/g, ''));
      } else {
        // Coma decimal: 15000,50
        parsedNumber = parseFloat(clean.replace(',', '.'));
      }
    }
  } else {
    // Solo dígitos y espacios
    parsedNumber = parseFloat(clean.replace(/\s+/g, ''));
  }

  if (isNaN(parsedNumber)) {
    return createDualValue(rawValue, null, 'ambiguous', 'No se pudo interpretar el número');
  }

  const note = hasCurrencySign 
    ? 'Monto extraído preservando magnitud y decimales (símbolo de moneda retenido en raw)'
    : 'Monto extraído preservando magnitud y decimales';

  return createDualValue(rawValue, parsedNumber, 'valid', note);
}

/**
 * Normaliza catálogo de Tipo de Crédito homologando variantes sin perder el original.
 */
function normalizeCreditType(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Tipo de crédito ausente');
  }

  const rawStr = String(rawValue).trim();
  const clean = rawStr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover tildes
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');

  const catalogMap = {
    'libre inversion': 'LIBRE_INVERSION',
    'libre inv': 'LIBRE_INVERSION',
    'credito personal': 'LIBRE_INVERSION',
    'libranza': 'LIBRANZA',
    'credito libranza': 'LIBRANZA',
    'vivienda': 'VIVIENDA',
    'credito vivienda': 'VIVIENDA',
    'hipotecario': 'VIVIENDA',
    'vehiculo': 'VEHICULO',
    'credito vehiculo': 'VEHICULO',
    'automovil': 'VEHICULO',
    'educativo': 'EDUCATIVO',
    'calamidad': 'CALAMIDAD',
    'crediaporte': 'CREDIAPORTE'
  };

  const matched = catalogMap[clean];
  if (matched) {
    const isExact = rawStr === matched;
    return createDualValue(
      rawValue,
      matched,
      'valid',
      isExact ? 'Coincidencia canónica' : `Homologado desde '${rawStr}' hacia categoría canónica '${matched}'`
    );
  }

  return createDualValue(
    rawValue,
    'Por revisar',
    'ambiguous',
    `Valor '${rawStr}' no coincide con el catálogo estándar de tipos de crédito. Requiere revisión.`
  );
}

/**
 * Normaliza estado del radicado
 */
function normalizeState(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Estado ausente');
  }

  const rawStr = String(rawValue).trim();
  const clean = rawStr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');

  const stateMap = {
    'radicado': 'RADICADO',
    'radicada': 'RADICADO',
    'ingresado': 'RADICADO',
    'en revision': 'EN_REVISION',
    'revision documental': 'EN_REVISION',
    'pendiente revision': 'EN_REVISION',
    'subsanacion': 'SUBSANACION',
    'subsanacion documental': 'SUBSANACION',
    'en subsanacion': 'SUBSANACION',
    'suspendido': 'SUSPENDIDO',
    'anulado': 'ANULADO'
  };

  const matched = stateMap[clean];
  if (matched) {
    return createDualValue(
      rawValue,
      matched,
      'valid',
      `Estado homologado a '${matched}' desde '${rawStr}'`
    );
  }

  return createDualValue(
    rawValue,
    'Por revisar',
    'ambiguous',
    `Estado origen '${rawStr}' no catalogado. Asignado a 'Por revisar'`
  );
}

/**
 * Normaliza canal de radicación
 */
function normalizeChannel(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Canal no especificado');
  }

  const rawStr = String(rawValue).trim();
  const clean = rawStr.toLowerCase();

  if (clean.includes('web') || clean.includes('portal') || clean.includes('online')) {
    return createDualValue(rawValue, 'WEB', 'valid', `Homologado a WEB desde '${rawStr}'`);
  }
  if (clean.includes('correo') || clean.includes('email') || clean.includes('mail')) {
    return createDualValue(rawValue, 'CORREO', 'valid', `Homologado a CORREO desde '${rawStr}'`);
  }
  if (clean.includes('presencial') || clean.includes('oficina') || clean.includes('sede')) {
    return createDualValue(rawValue, 'PRESENCIAL', 'valid', `Homologado a PRESENCIAL desde '${rawStr}'`);
  }
  if (clean.includes('movil') || clean.includes('app')) {
    return createDualValue(rawValue, 'APP_MOVIL', 'valid', `Homologado a APP_MOVIL desde '${rawStr}'`);
  }

  return createDualValue(rawValue, rawStr.toUpperCase(), 'valid', 'Canal conservado');
}

/**
 * Normaliza texto de identificación o tipo de documento
 */
function normalizeString(rawValue, fieldName = 'campo') {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', `${fieldName} ausente o vacío`);
  }
  const clean = String(rawValue).trim();
  return createDualValue(rawValue, clean, 'valid', 'Texto limpio');
}

/**
 * Normaliza cantidad de soportes reportados (número entero >= 0)
 */
function normalizeSupportCount(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Cantidad de soportes ausente');
  }

  const num = parseInt(rawValue, 10);
  if (isNaN(num) || num < 0) {
    return createDualValue(rawValue, null, 'ambiguous', 'Valor de cantidad de soportes inválido (debe ser entero ≥ 0)');
  }

  return createDualValue(rawValue, num, 'valid', 'Entero normalizado');
}



  // ==========================================
  // Módulo: services/excelParser.js
  // ==========================================

/**
 * excelParser.js
 * 
 * Servicio para lectura, inspección de hojas, extracción de encabezados,
 * sugerencia asistida de mapeo por sinónimos y pre-flight check.
 * Usa la librería XLSX (SheetJS) ejecutándose en memoria.
 */

// Definición de campos esperados y sus sinónimos para heurística
const RADICADO_FIELDS = [
  {
    key: 'solicitudId',
    label: 'ID de Solicitud / Radicado',
    required: true,
    description: 'Identificador único de la solicitud',
    synonyms: ['id solicitud', 'solicitud', 'radicado', 'nro_solicitud', 'numero radicado', 'no_solicitud', 'num_solicitud', 'id_radicado', 'codigo radicado', 'radicado_id', 'solicitud_id', 'id']
  },
  {
    key: 'tipoCredito',
    label: 'Tipo de Crédito / Modalidad',
    required: true,
    description: 'Línea o modalidad de crédito solicitada',
    synonyms: ['tipo credito', 'tipo_credito', 'linea', 'modalidad', 'linea de credito', 'producto', 'tipo_producto', 'tipo de credito']
  },
  {
    key: 'fechaRegistro',
    label: 'Fecha de Registro / Radicación',
    required: true,
    description: 'Fecha en que se radicó la solicitud',
    synonyms: ['fecha registro', 'fecha_registro', 'fecha radicacion', 'fecha_radicacion', 'fecha solicitud', 'fecha_solicitud', 'fecha']
  },
  {
    key: 'horaRegistro',
    label: 'Hora de Registro (Opcional)',
    required: false,
    description: 'Hora exacta en que se registró la solicitud',
    synonyms: ['hora registro', 'hora_registro', 'hora radicacion', 'hora', 'hora_solicitud', 'time']
  },
  {
    key: 'montoSolicitado',
    label: 'Monto Solicitado',
    required: true,
    description: 'Valor numérico solicitado por el asociado',
    synonyms: ['monto solicitado', 'monto_solicitado', 'monto', 'valor', 'valor solicitado', 'valor_solicitado', 'importe', 'cuantia']
  },
  {
    key: 'estado',
    label: 'Estado en Sistema Origen',
    required: true,
    description: 'Estado inicial reportado del radicado',
    synonyms: ['estado', 'estado solicitud', 'estado_solicitud', 'estado actual', 'status']
  },
  {
    key: 'canal',
    label: 'Canal de Ingreso (Opcional)',
    required: false,
    description: 'Canal de radicación (Web, Presencial, etc.)',
    synonyms: ['canal', 'canal radicación', 'canal_ingreso', 'medio', 'canal_solicitud']
  },
  {
    key: 'cantidadSoportesReportada',
    label: 'Cantidad Soportes Reportada',
    required: true,
    description: 'Número de documentos que el radicado afirma adjuntar',
    synonyms: ['cantidad soportes', 'cantidad_soportes', 'cantidad soportes reportada', 'cant soportes', 'num documentos', 'total soportes', 'docs adjuntos', 'soportes reportados', 'adjuntos']
  },
  {
    key: 'observaciones',
    label: 'Observaciones / Notas (Opcional)',
    required: false,
    description: 'Comentarios o notas de radicación',
    synonyms: ['observaciones', 'observacion', 'notas', 'comentarios', 'detalle', 'descripcion']
  }
];

const DOCUMENTO_FIELDS = [
  {
    key: 'solicitudId',
    label: 'ID Solicitud Asociada',
    required: true,
    description: 'ID de la solicitud padre del soporte',
    synonyms: ['id solicitud', 'solicitud', 'radicado', 'nro_solicitud', 'solicitud_id', 'id_radicado', 'id']
  },
  {
    key: 'documentoId',
    label: 'ID Único del Documento / Fila',
    required: true,
    description: 'Identificador único de este soporte o fila',
    synonyms: ['id documento', 'documento_id', 'doc id', 'id soporte', 'doc_id', 'identificador', 'codigo documento', 'id_archivo']
  },
  {
    key: 'tipoCredito',
    label: 'Tipo de Crédito en Soporte (Opcional)',
    required: false,
    description: 'Modalidad de crédito anotada en la fila documental',
    synonyms: ['tipo credito', 'tipo_credito', 'linea', 'modalidad', 'producto']
  },
  {
    key: 'tipoDocumento',
    label: 'Tipo de Documento / Soporte',
    required: true,
    description: 'Categoría documental (Pagaré, Cédula, etc.)',
    synonyms: ['tipo documento', 'tipo_documento', 'documento', 'categoria soporte', 'soporte', 'nombre soporte', 'tipo']
  },
  {
    key: 'nombreArchivo',
    label: 'Nombre Original de Archivo (Opcional)',
    required: false,
    description: 'Nombre del archivo adjunto (ej. pagare.pdf)',
    synonyms: ['nombre archivo', 'nombre_archivo', 'archivo', 'file name', 'adjunto', 'nombre_adjunto', 'file']
  },
  {
    key: 'urlOIdFuente',
    label: 'URL o ID Fuente (Google Drive / Web)',
    required: true,
    description: 'URL completa o ID alfanumérico de Google Drive',
    synonyms: ['url', 'enlace', 'link', 'id drive', 'google drive', 'url / id fuente', 'urloidfuente', 'fuente', 'url_fuente', 'link drive', 'archivo_url']
  }
];

/**
 * Lee un archivo Excel o CSV (ArrayBuffer) y retorna información de hojas y workbook de SheetJS.
 * @param {ArrayBuffer} buffer 
 * @param {string} fileName 
 */
function inspectWorkbook(buffer, fileName) {
  if (typeof XLSX === 'undefined') {
    throw new Error('Librería SheetJS (XLSX) no disponible en el entorno.');
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error(`El archivo ${fileName} no contiene hojas de cálculo legibles.`);
  }

  return {
    workbook,
    fileName,
    sheetNames,
    activeSheetName: sheetNames[0]
  };
}

/**
 * Extrae filas en formato JSON de la hoja especificada, detectando encabezados y limpiando filas vacías.
 * @param {any} workbook 
 * @param {string} sheetName 
 */
function extractSheetData(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { headers: [], rows: [], rawRowCount: 0, emptyRowsCount: 0 };
  }

  // Convertir a matriz de arreglos para inspeccionar encabezados
  const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  if (rawMatrix.length === 0) {
    return { headers: [], rows: [], rawRowCount: 0, emptyRowsCount: 0 };
  }

  // Buscar la fila de encabezados (primera fila con más de 1 celda con texto)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 10); i++) {
    const row = rawMatrix[i] || [];
    const textCells = row.filter(c => c !== null && String(c).trim() !== '');
    if (textCells.length >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  const headerRow = rawMatrix[headerRowIndex] || [];
  const headers = headerRow.map((h, idx) => {
    const val = (h !== null && h !== undefined) ? String(h).trim() : '';
    return val || `Columna_${idx + 1}`;
  });

  // Extraer filas como objetos
  const dataRows = [];
  let emptyRowsCount = 0;

  for (let i = headerRowIndex + 1; i < rawMatrix.length; i++) {
    const rowArray = rawMatrix[i] || [];
    const isCompletelyEmpty = rowArray.every(c => c === null || c === undefined || String(c).trim() === '');
    
    if (isCompletelyEmpty) {
      emptyRowsCount++;
      continue;
    }

    const rowObj = { _excelRowNumber: i + 1 };
    headers.forEach((header, colIdx) => {
      rowObj[header] = rowArray[colIdx] !== undefined ? rowArray[colIdx] : null;
    });
    dataRows.push(rowObj);
  }

  return {
    headers,
    rows: dataRows,
    rawRowCount: rawMatrix.length - (headerRowIndex + 1),
    emptyRowsCount,
    headerRowIndex
  };
}

/**
 * Normaliza una cadena para comparación heurística (minúsculas, sin tildes, sin signos)
 */
function cleanStringForMatch(str) {
  return String(str || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sugiere el mapeo automático de columnas con base en heurísticas de sinónimos.
 * Marca `isAmbiguous: true` cuando la coincidencia es parcial o débil para que la usuaria confirme.
 * @param {string[]} availableHeaders 
 * @param {typeof RADICADO_FIELDS} schemaFields 
 * @returns {Record<string, { selectedColumn: string|null, isAmbiguous: boolean, confidence: number }>}
 */
function suggestColumnMapping(availableHeaders, schemaFields) {
  const mapping = {};
  const usedHeaders = new Set();

  schemaFields.forEach(field => {
    let bestMatch = null;
    let highestConfidence = 0;
    let isAmbiguous = false;

    const cleanedSynonyms = field.synonyms.map(cleanStringForMatch);

    availableHeaders.forEach(header => {
      const cleanedHeader = cleanStringForMatch(header);

      // Coincidencia exacta con la clave o etiqueta
      if (cleanedHeader === cleanStringForMatch(field.key) || cleanedHeader === cleanStringForMatch(field.label)) {
        if (1.0 > highestConfidence) {
          highestConfidence = 1.0;
          bestMatch = header;
          isAmbiguous = false;
        }
        return;
      }

      // Coincidencia exacta con algún sinónimo
      for (const syn of cleanedSynonyms) {
        if (cleanedHeader === syn) {
          if (0.95 > highestConfidence) {
            highestConfidence = 0.95;
            bestMatch = header;
            isAmbiguous = false;
          }
          return;
        }
      }

      // Coincidencia parcial contenida (ej: "No. Solicitud 2026" contiene "solicitud")
      for (const syn of cleanedSynonyms) {
        if (cleanedHeader.includes(syn) || syn.includes(cleanedHeader)) {
          const confidence = syn.length / Math.max(cleanedHeader.length, syn.length) * 0.8;
          if (confidence > highestConfidence && confidence >= 0.45) {
            highestConfidence = confidence;
            bestMatch = header;
            // Si la confianza es menor a 0.85, se considera con duda / ámbar
            isAmbiguous = confidence < 0.85;
          }
        }
      }
    });

    if (bestMatch && !usedHeaders.has(bestMatch)) {
      usedHeaders.add(bestMatch);
      mapping[field.key] = {
        selectedColumn: bestMatch,
        isAmbiguous: isAmbiguous,
        confidence: highestConfidence
      };
    } else {
      mapping[field.key] = {
        selectedColumn: null,
        isAmbiguous: field.required, // Requiere atención si es obligatorio
        confidence: 0
      };
    }
  });

  return mapping;
}

/**
 * Realiza el chequeo pre-vuelo (Pre-flight check) antes de analizar el lote.
 */
function runPreFlightCheck(radicadoData, radicadoMapping, documentoData, documentoMapping) {
  const errors = [];
  const warnings = [];

  // 1. Chequeo de columnas obligatorias en Radicados
  RADICADO_FIELDS.forEach(field => {
    if (field.required) {
      const map = radicadoMapping[field.key];
      if (!map || !map.selectedColumn) {
        errors.push(`Campo obligatorio sin mapear en Radicados: "${field.label}"`);
      }
    }
  });

  // 2. Chequeo de columnas obligatorias en Matriz Documental
  DOCUMENTO_FIELDS.forEach(field => {
    if (field.required) {
      const map = documentoMapping[field.key];
      if (!map || !map.selectedColumn) {
        errors.push(`Campo obligatorio sin mapear en Matriz Documental: "${field.label}"`);
      }
    }
  });

  // 3. Chequeo de conteo de filas
  const totalRadicados = radicadoData.rows.length;
  const totalDocumentos = documentoData.rows.length;

  if (totalRadicados === 0) {
    errors.push('El archivo de Radicados no contiene filas de datos para procesar.');
  }
  if (totalDocumentos === 0) {
    warnings.push('La Matriz Documental no contiene filas de datos (todas las solicitudes figurarán sin soportes).');
  }

  if (radicadoData.emptyRowsCount > 0) {
    warnings.push(`Se ignoraron ${radicadoData.emptyRowsCount} filas vacías en el archivo de Radicados.`);
  }
  if (documentoData.emptyRowsCount > 0) {
    warnings.push(`Se ignoraron ${documentoData.emptyRowsCount} filas vacías en la Matriz Documental.`);
  }

  // 4. Verificación de mapeos ambiguos
  let ambiguousMappingsCount = 0;
  Object.values(radicadoMapping).forEach(m => { if (m.isAmbiguous && m.selectedColumn) ambiguousMappingsCount++; });
  Object.values(documentoMapping).forEach(m => { if (m.isAmbiguous && m.selectedColumn) ambiguousMappingsCount++; });

  if (ambiguousMappingsCount > 0) {
    warnings.push(`Hay ${ambiguousMappingsCount} columna(s) mapeada(s) por coincidencia parcial. Por favor confirma la selección.`);
  }

  return {
    canProcess: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalRadicados,
      totalDocumentos,
      emptyRowsIgnored: radicadoData.emptyRowsCount + documentoData.emptyRowsCount
    }
  };
}



  // ==========================================
  // Módulo: services/validationEngine.js
  // ==========================================

/**
 * validationEngine.js
 * 
 * Motor determinista de análisis y validación documental.
 * Cruza los Radicados vs. la Matriz Documental ejecutando las reglas estructurales
 * obligatorias y las reglas opcionales de política cuando estén configuradas.
 */


let findingCounter = 0;
function nextFindingId(prefix = 'HLZ') {
  findingCounter++;
  return `${prefix}-${String(findingCounter).padStart(4, '0')}`;
}

function resetFindingCounter() {
  findingCounter = 0;
}

/**
 * Procesa y valida el lote completo de Radicados y Documentos
 * @param {Array<object>} rawRadicados 
 * @param {Record<string, {selectedColumn: string|null}>} radicadoMapping 
 * @param {Array<object>} rawDocumentos 
 * @param {Record<string, {selectedColumn: string|null}>} documentoMapping 
 * @param {import('../domain/types').RuleConfig} ruleConfig 
 */
function analyzeBatch(rawRadicados, radicadoMapping, rawDocumentos, documentoMapping, ruleConfig) {
  resetFindingCounter();

  // 1. Normalizar y parsear todos los Radicados
  const radicadosList = [];
  const radicadoIdCounts = new Map();

  rawRadicados.forEach((row, idx) => {
    const getVal = (fieldKey) => {
      const col = (radicadoMapping[fieldKey] ? radicadoMapping[fieldKey].selectedColumn : null);
      return col ? row[col] : null;
    };

    const radicado = {
      solicitudId: normalizeString(getVal('solicitudId'), 'ID Solicitud'),
      tipoCredito: normalizeCreditType(getVal('tipoCredito')),
      fechaRegistro: normalizeDate(getVal('fechaRegistro')),
      horaRegistro: normalizeTime(getVal('horaRegistro')),
      montoSolicitado: normalizeAmount(getVal('montoSolicitado')),
      estado: normalizeState(getVal('estado')),
      canal: normalizeChannel(getVal('canal')),
      cantidadSoportesReportada: normalizeSupportCount(getVal('cantidadSoportesReportada')),
      observaciones: normalizeString(getVal('observaciones'), 'Observaciones'),
      _rowIndex: idx + 1
    };

    radicadosList.push(radicado);

    const sId = radicado.solicitudId.normalized;
    if (sId) {
      radicadoIdCounts.set(sId, (radicadoIdCounts.get(sId) || 0) + 1);
    }
  });

  // 2. Normalizar y parsear todos los Documentos
  const documentosList = [];
  const documentoIdCounts = new Map();

  rawDocumentos.forEach((row, idx) => {
    const getVal = (fieldKey) => {
      const col = (documentoMapping[fieldKey] ? documentoMapping[fieldKey].selectedColumn : null);
      return col ? row[col] : null;
    };

    const rawUrl = getVal('urlOIdFuente');
    const linkResolution = resolveDriveLink(rawUrl);

    const documento = {
      solicitudId: normalizeString(getVal('solicitudId'), 'ID Solicitud'),
      documentoId: normalizeString(getVal('documentoId'), 'ID Documento'),
      tipoCredito: getVal('tipoCredito') ? normalizeCreditType(getVal('tipoCredito')) : undefined,
      tipoDocumento: normalizeString(getVal('tipoDocumento'), 'Tipo de Documento'),
      nombreArchivo: normalizeString(getVal('nombreArchivo'), 'Nombre Archivo'),
      urlOIdFuente: normalizeString(rawUrl, 'URL o ID Fuente'),
      linkResolution: linkResolution,
      userReviewStatus: 'Sin revisar',
      _rowIndex: idx + 1
    };

    documentosList.push(documento);

    const dId = documento.documentoId.normalized;
    if (dId) {
      documentoIdCounts.set(dId, (documentoIdCounts.get(dId) || 0) + 1);
    }
  });

  // 3. Agrupar Documentos por Solicitud
  const docsBySolicitud = new Map();
  const orphanDocuments = [];
  const knownSolicitudIds = new Set(
    radicadosList.map(r => r.solicitudId.normalized).filter(Boolean)
  );

  documentosList.forEach(doc => {
    const sId = doc.solicitudId.normalized;
    if (!sId || !knownSolicitudIds.has(sId)) {
      orphanDocuments.push({
        documento: doc,
        motivo: !sId ? 'Documento no tiene solicitudId especificado' : `El solicitudId "${sId}" no existe en el libro de Radicados`
      });
    } else {
      if (!docsBySolicitud.has(sId)) {
        docsBySolicitud.set(sId, []);
      }
      docsBySolicitud.get(sId).push(doc);
    }
  });

  // 4. Analizar cada Solicitud individualmente
  const analyzedSolicitudes = [];

  radicadosList.forEach(radicado => {
    const sId = radicado.solicitudId.normalized || `FILA-${radicado._rowIndex}`;
    const docs = docsBySolicitud.get(sId) || [];
    const findings = [];

    // ----------------------------------------------------
    // REGLA 1: Discrepancia de Conteo de Soportes
    // ----------------------------------------------------
    const conteoReportado = radicado.cantidadSoportesReportada.normalized;
    const conteoEncontrado = docs.length;
    const diferencia = (conteoReportado !== null) ? (conteoEncontrado - conteoReportado) : 0;

    if (conteoEncontrado === 0) {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.FALTANTE,
        severity: FINDING_SEVERITY.BLOQUEANTE,
        title: 'Faltante total de soportes en Matriz Documental',
        ruleCompared: 'Integridad: Toda solicitud debe contar con al menos un soporte registrado en la matriz.',
        explanation: 'La solicitud no tiene ninguna fila de soporte asociada en el archivo de Matriz Documental.',
        exactEvidence: `Soportes reportados en radicado: ${conteoReportado !== null ? conteoReportado : "No especificado"} | Filas encontradas en matriz: 0`,
        suggestedAction: 'Verificar si los documentos fueron radicados en una matriz separada o si la solicitud fue ingresada sin anexos.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    } else if (conteoReportado !== null && conteoReportado !== conteoEncontrado) {
      const faltaSoportes = conteoEncontrado < conteoReportado;
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.DISCREPANCIA,
        severity: FINDING_SEVERITY.ADVERTENCIA,
        title: `Discrepancia en conteo de soportes (${conteoReportado} rep. vs ${conteoEncontrado} enc.)`,
        ruleCompared: 'Conteo de Soportes: La cantidad de documentos reportada debe coincidir exactamente con el número de filas en la matriz documental.',
        explanation: faltaSoportes 
          ? `El radicado reporta adjuntar ${conteoReportado} documentos, pero en la matriz documental solo se identificaron ${conteoEncontrado} filas (${Math.abs(diferencia)} faltante(s)).`
          : `El radicado reporta adjuntar ${conteoReportado} documentos, pero en la matriz documental se encontraron ${conteoEncontrado} filas (${diferencia} soporte(s) adicional(es)).`,
        exactEvidence: `Reportado: ${conteoReportado} | Encontrado en matriz: ${conteoEncontrado} | Diferencia neta: ${diferencia}`,
        suggestedAction: 'Revisar la lista de documentos en el detalle para determinar si falta indexar soportes o si se adjuntaron anexos complementarios.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    }

    // ----------------------------------------------------
    // REGLA 3: Inconsistencia de Tipo de Crédito entre Radicado y Soporte
    // ----------------------------------------------------
    const tipoRadicado = radicado.tipoCredito.normalized;
    docs.forEach(doc => {
      if (doc.tipoCredito && doc.tipoCredito.normalized) {
        const tipoDoc = doc.tipoCredito.normalized;
        if (tipoRadicado && tipoDoc !== tipoRadicado && tipoDoc !== 'Por revisar') {
          findings.push({
            id: nextFindingId(),
            solicitudId: sId,
            documentoId: doc.documentoId.normalized || `Doc_Fila_${doc._rowIndex}`,
            category: FINDING_CATEGORIES.DISCREPANCIA,
            severity: FINDING_SEVERITY.ADVERTENCIA,
            title: `Inconsistencia de Tipo de Crédito en soporte ${doc.documentoId.raw || ''}`,
            ruleCompared: 'Consistencia Cruzada: El tipo de crédito del documento soporte debe coincidir con el radicado.',
            explanation: `El radicado indica tipo de crédito "${tipoRadicado}", pero el soporte registra "${tipoDoc}".`,
            exactEvidence: `Radicado tipoCredito: "${radicado.tipoCredito.raw}" (normalizado: ${tipoRadicado}) | Soporte tipoCredito: "${doc.tipoCredito.raw}" (normalizado: ${tipoDoc})`,
            suggestedAction: 'Verificar si el documento corresponde a una solicitud anterior o si fue mal catalogado en la matriz.',
            documentLink: doc.linkResolution.resolvedUrl,
            documentLinkCanOpen: doc.linkResolution.canOpen,
            reviewState: REVIEW_STATES.POR_REVISAR
          });
        }
      }
    });

    // ----------------------------------------------------
    // REGLA 4: IDs Repetidos y Posibles Duplicados
    // ----------------------------------------------------
    if (radicado.solicitudId.normalized && (radicadoIdCounts.get(radicado.solicitudId.normalized) || 0) > 1) {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.POSIBLE_DUPLICADO,
        severity: FINDING_SEVERITY.BLOQUEANTE,
        title: `ID de Solicitud duplicado en Radicados ("${sId}")`,
        ruleCompared: 'Unicidad Estructural: Todo solicitudId debe figurar exactamente una sola vez en el libro de radicados.',
        explanation: `El identificador de solicitud "${sId}" aparece repetido en ${radicadoIdCounts.get(radicado.solicitudId.normalized)} filas del libro de radicados.`,
        exactEvidence: `solicitudId = "${radicado.solicitudId.raw}" repetido ${radicadoIdCounts.get(radicado.solicitudId.normalized)} veces`,
        suggestedAction: 'Inspeccionar las filas repetidas en el origen para verificar si es un reintento, una renegociación o un error de duplicación.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    }

    // Posibles duplicados entre documentos de la misma solicitud
    for (let i = 0; i < docs.length; i++) {
      for (let j = i + 1; j < docs.length; j++) {
        const d1 = docs[i];
        const d2 = docs[j];

        const sameType = d1.tipoDocumento.normalized && d2.tipoDocumento.normalized && 
          d1.tipoDocumento.normalized.toLowerCase() === d2.tipoDocumento.normalized.toLowerCase();

        const sameFile = (d1.nombreArchivo && d1.nombreArchivo.normalized) && (d2.nombreArchivo && d2.nombreArchivo.normalized) &&
          d1.nombreArchivo.normalized.toLowerCase() === d2.nombreArchivo.normalized.toLowerCase();

        const sameUrl = (d1.urlOIdFuente && d1.urlOIdFuente.raw) && (d2.urlOIdFuente && d2.urlOIdFuente.raw) &&
          String(d1.urlOIdFuente.raw).trim() === String(d2.urlOIdFuente.raw).trim();

        if (sameType && (sameFile || sameUrl)) {
          findings.push({
            id: nextFindingId(),
            solicitudId: sId,
            documentoId: `${d1.documentoId.normalized || d1._rowIndex} y ${d2.documentoId.normalized || d2._rowIndex}`,
            category: FINDING_CATEGORIES.POSIBLE_DUPLICADO,
            severity: FINDING_SEVERITY.ADVERTENCIA,
            title: `Posible documento duplicado: ${d1.tipoDocumento.raw}`,
            ruleCompared: 'Inspección de Duplicidad: Múltiples soportes con idéntico tipo y archivo/enlace requieren verificación visual de contenido.',
            explanation: `Se detectaron 2 filas documentales con el mismo tipo ("${d1.tipoDocumento.raw}") e idéntico ${sameFile ? 'nombre de archivo' : 'enlace'}.`,
            exactEvidence: `Doc 1: [ID ${d1.documentoId.raw}] Archivo: "${(d1.nombreArchivo ? d1.nombreArchivo.raw : "N/A") || 'N/A'}" | Doc 2: [ID ${d2.documentoId.raw}] Archivo: "${(d2.nombreArchivo ? d2.nombreArchivo.raw : "N/A") || 'N/A'}"`,
            suggestedAction: 'Abrir ambos documentos fuente y comparar manualmente si corresponden a versiones distintas (ej. corregido) o a un doble cargue.',
            documentLink: d1.linkResolution.resolvedUrl || d2.linkResolution.resolvedUrl,
            documentLinkCanOpen: d1.linkResolution.canOpen || d2.linkResolution.canOpen,
            reviewState: REVIEW_STATES.POR_REVISAR
          });
        }
      }
    }

    // ----------------------------------------------------
    // REGLA 5: Validación de Enlaces Fuente
    // ----------------------------------------------------
    docs.forEach(doc => {
      const lr = doc.linkResolution;
      if (lr.status === 'MISSING') {
        findings.push({
          id: nextFindingId(),
          solicitudId: sId,
          documentoId: doc.documentoId.normalized || `Doc_Fila_${doc._rowIndex}`,
          category: FINDING_CATEGORIES.ENLACE_NO_DISPONIBLE,
          severity: FINDING_SEVERITY.BLOQUEANTE,
          title: `Sin enlace de documento fuente (${doc.tipoDocumento.raw || 'Soporte'})`,
          ruleCompared: 'Trazabilidad Fuente: Todo documento soporte debe proporcionar una URL web o un ID de Google Drive válido.',
          explanation: `El soporte documental "${doc.documentoId.raw || ''}" no tiene ninguna URL ni ID en la columna correspondiente.`,
          exactEvidence: `Campo urlOIdFuente = [VACÍO / NULO]`,
          suggestedAction: 'Requerir al área de radicación la provisión del enlace al expediente digital del asociado.',
          reviewState: REVIEW_STATES.POR_REVISAR
        });
      } else if (lr.status === 'INVALID_FORMAT') {
        findings.push({
          id: nextFindingId(),
          solicitudId: sId,
          documentoId: doc.documentoId.normalized || `Doc_Fila_${doc._rowIndex}`,
          category: FINDING_CATEGORIES.ENLACE_NO_DISPONIBLE,
          severity: FINDING_SEVERITY.ADVERTENCIA,
          title: `Formato de enlace inválido en soporte ${doc.documentoId.raw || ''}`,
          ruleCompared: 'Seguridad y Formato: Solo se admiten URLs HTTPS bien formadas o IDs de Google Drive válidos.',
          explanation: `El valor reportado "${lr.originalValue}" no cumple con el estándar de URL HTTPS accesible ni ID de Drive alfanumérico. (${lr.notes})`,
          exactEvidence: `Valor crudo: "${lr.originalValue}"`,
          suggestedAction: 'Verificar si se colocó una ruta de disco local del operador o un enlace que requiere prefijo seguro.',
          reviewState: REVIEW_STATES.POR_REVISAR
        });
      }
    });

    // ----------------------------------------------------
    // REGLA 6: Campos Obligatorios Vacíos o Datos Ambiguos
    // ----------------------------------------------------
    // Fecha ambigua
    if (radicado.fechaRegistro.status === 'ambiguous') {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.DATO_AMBIGUO,
        severity: FINDING_SEVERITY.ADVERTENCIA,
        title: 'Fecha de registro ambigua (no es posible determinar orden día/mes)',
        ruleCompared: 'Precisión Temporal: Las fechas deben ser inequívocas para evitar distorsiones en términos legales y vigencias.',
        explanation: radicado.fechaRegistro.mappingNote || 'La fecha no puede interpretarse de forma determinista.',
        exactEvidence: `Valor original en celda: "${radicado.fechaRegistro.raw}"`,
        suggestedAction: 'Confirmar con el equipo emisor si el estándar utilizado en el libro fue DD/MM/YYYY o MM/DD/YYYY.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    } else if (radicado.fechaRegistro.status === 'empty') {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.FALTANTE,
        severity: FINDING_SEVERITY.BLOQUEANTE,
        title: 'Fecha de registro ausente',
        ruleCompared: 'Completitud Obligatoria: La fecha de registro es obligatoria.',
        explanation: 'La solicitud no contiene fecha de registro en el archivo de radicados.',
        exactEvidence: 'fechaRegistro = [VACÍO]',
        suggestedAction: 'Completar la fecha de radicación oficial.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    }

    // Monto solicitado
    if (radicado.montoSolicitado.status === 'ambiguous') {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.DATO_AMBIGUO,
        severity: FINDING_SEVERITY.ADVERTENCIA,
        title: 'Monto solicitado ambiguo o con formato no numérico',
        ruleCompared: 'Integridad Numérica: El monto solicitado debe ser una cifra determinista con separadores claros.',
        explanation: radicado.montoSolicitado.mappingNote || 'El valor no pudo ser interpretado numéricamente.',
        exactEvidence: `Valor original en celda: "${radicado.montoSolicitado.raw}"`,
        suggestedAction: 'Revisar la celda original del Excel para corregir caracteres especiales o separadores contradictorios.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    } else if (radicado.montoSolicitado.status === 'empty') {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.FALTANTE,
        severity: FINDING_SEVERITY.BLOQUEANTE,
        title: 'Monto solicitado ausente',
        ruleCompared: 'Completitud Obligatoria: El monto solicitado es indispensable para dimensionar el crédito.',
        explanation: 'La celda de monto solicitado se encuentra vacía.',
        exactEvidence: 'montoSolicitado = [VACÍO]',
        suggestedAction: 'Revisar el formulario o soporte físico para ingresar el valor de la solicitud.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    }

    // Tipo de crédito ambiguo
    if (radicado.tipoCredito.status === 'ambiguous') {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.DATO_AMBIGUO,
        severity: FINDING_SEVERITY.ADVERTENCIA,
        title: 'Tipo de crédito no homologado en catálogo',
        ruleCompared: 'Homologación de Catálogo: Toda modalidad debe pertenecer al catálogo institucional.',
        explanation: radicado.tipoCredito.mappingNote || 'Tipo de crédito no reconocido.',
        exactEvidence: `Valor original en celda: "${radicado.tipoCredito.raw}"`,
        suggestedAction: 'Homologar manualmente el tipo de crédito a una línea autorizada del fondo de empleados.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    }

    // ----------------------------------------------------
    // REGLA 7: Alertas de Firma, Identidad o Consentimiento en Observaciones
    // ----------------------------------------------------
    const obsText = ((radicado.observaciones && radicado.observaciones.raw) ? radicado.observaciones.raw : "").toLowerCase();
    const alertKeywords = [
      'sin firma', 'pendiente firma', 'falta firma', 'borrador', 
      'ilegible', 'falta huella', 'sin huella', 'no legible', 'firma incompleta'
    ];

    const matchedKeywords = alertKeywords.filter(kw => obsText.includes(kw));

    // También revisar en nombres de archivos de soportes
    docs.forEach(doc => {
      const fileName = ((doc.nombreArchivo && doc.nombreArchivo.raw) ? doc.nombreArchivo.raw : "").toLowerCase();
      alertKeywords.forEach(kw => {
        if (fileName.includes(kw) && !matchedKeywords.includes(kw)) {
          matchedKeywords.push(`${kw} (en archivo: ${((doc.nombreArchivo && doc.nombreArchivo.raw) ? doc.nombreArchivo.raw : "")})`);
        }
      });
    });

    if (matchedKeywords.length > 0) {
      findings.push({
        id: nextFindingId(),
        solicitudId: sId,
        category: FINDING_CATEGORIES.REVISION_HUMANA,
        severity: FINDING_SEVERITY.ADVERTENCIA,
        title: 'Alerta documental en observaciones / archivos (Requiere inspección visual)',
        ruleCompared: 'Integridad Formal: Menciones a firmas faltantes, borradores o documentos ilegibles obligan a una revisión humana minuciosa.',
        explanation: `Se detectaron términos de alerta en los textos asociados a la solicitud: "${matchedKeywords.join(', ')}". El sistema no asume autenticidad de firmas.`,
        exactEvidence: `Texto detectado: "${matchedKeywords.join(', ')}" | Observaciones: "${((radicado.observaciones && radicado.observaciones.raw) ? radicado.observaciones.raw : "N/A")}"`,
        suggestedAction: 'Abrir los documentos fuente, verificar ocularmente la presencia y legibilidad de firmas y huellas, y registrar el resultado en el control de revisión.',
        reviewState: REVIEW_STATES.POR_REVISAR
      });
    }

    // ----------------------------------------------------
    // REGLAS CONFIGURABLES (Apagadas por defecto)
    // ----------------------------------------------------
    if (ruleConfig.documentosObligatoriosActivo && tipoRadicado) {
      const requiredDocs = ruleConfig.documentosObligatoriosPorTipo[tipoRadicado] || [];
      const presentDocTypes = docs.map(d => (d.tipoDocumento.raw || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

      requiredDocs.forEach(reqDoc => {
        const cleanReq = reqDoc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isPresent = presentDocTypes.some(p => p.includes(cleanReq) || cleanReq.includes(p));

        if (!isPresent) {
          findings.push({
            id: nextFindingId(),
            solicitudId: sId,
            category: FINDING_CATEGORIES.FALTANTE,
            severity: FINDING_SEVERITY.ADVERTENCIA,
            title: `Documento obligatorio faltante por política: ${reqDoc}`,
            ruleCompared: `Política Documental: La modalidad ${tipoRadicado} exige adjuntar "${reqDoc}".`,
            explanation: `No se encontró ningún soporte clasificado como "${reqDoc}" entre los adjuntos registrados para esta solicitud.`,
            exactEvidence: `Tipo de crédito: ${tipoRadicado} | Soportes existentes: [${docs.map(d => d.tipoDocumento.raw).join(', ') || 'Ninguno'}]`,
            suggestedAction: `Solicitar al asociado el soporte faltante (${reqDoc}).`,
            isSimulationRule: ruleConfig.modoSimulacionActivo,
            reviewState: REVIEW_STATES.POR_REVISAR
          });
        }
      });
    }

    // Calcular severidad máxima de la solicitud
    let severidadMaxima = 'Sin hallazgos';
    if (findings.some(f => f.severity === FINDING_SEVERITY.BLOQUEANTE)) {
      severidadMaxima = FINDING_SEVERITY.BLOQUEANTE;
    } else if (findings.some(f => f.severity === FINDING_SEVERITY.ADVERTENCIA)) {
      severidadMaxima = FINDING_SEVERITY.ADVERTENCIA;
    } else if (findings.some(f => f.severity === FINDING_SEVERITY.INFORMATIVA)) {
      severidadMaxima = FINDING_SEVERITY.INFORMATIVA;
    }

    analyzedSolicitudes.push({
      solicitud: radicado,
      solicitudId: sId,
      documentos: docs,
      conteoReportado,
      conteoEncontrado,
      diferenciaConteo: diferencia,
      hallazgos: findings,
      severidadMaxima,
      reviewState: REVIEW_STATES.POR_REVISAR,
      reviewNote: ''
    });
  });

  // 5. Hallazgos sobre documentos huérfanos
  const orphanFindings = [];
  orphanDocuments.forEach(orphan => {
    const doc = orphan.documento;
    const fId = nextFindingId('HLZ-ORF');
    orphanFindings.push({
      id: fId,
      solicitudId: doc.solicitudId.raw ? String(doc.solicitudId.raw) : 'SIN_RADICADO',
      documentoId: doc.documentoId.raw ? String(doc.documentoId.raw) : `Doc_Fila_${doc._rowIndex}`,
      category: FINDING_CATEGORIES.DISCREPANCIA,
      severity: FINDING_SEVERITY.ADVERTENCIA,
      title: `Documento huérfano en Matriz Documental: "${doc.documentoId.raw || ''}"`,
      ruleCompared: 'Consistencia Estructural: Todo soporte en la matriz debe tener un solicitudId que exista en radicados.',
      explanation: orphan.motivo,
      exactEvidence: `Fila matriz #${doc._rowIndex} | solicitudId reportado: "${doc.solicitudId.raw || ''}" | tipoDocumento: "${doc.tipoDocumento.raw || ''}"`,
      suggestedAction: 'Verificar si el ID de solicitud fue mal digitado o si corresponde a un radicado de otro lote.',
      documentLink: doc.linkResolution.resolvedUrl,
      documentLinkCanOpen: doc.linkResolution.canOpen,
      reviewState: REVIEW_STATES.POR_REVISAR
    });
  });

  // 6. Resumen del lote
  const totalSolicitudes = analyzedSolicitudes.length;
  const solicitudesUnicas = new Set(analyzedSolicitudes.map(s => s.solicitudId)).size;
  const solicitudesConIdRepetido = totalSolicitudes - solicitudesUnicas;
  const totalDocumentos = documentosList.length;

  let solicitudesConDiscrepanciaSoportes = 0;
  analyzedSolicitudes.forEach(s => {
    if (s.diferenciaConteo !== 0 || s.conteoEncontrado === 0) {
      solicitudesConDiscrepanciaSoportes++;
    }
  });

  let documentosConEnlacePlausible = 0;
  let documentosSinEnlaceOInvalido = 0;
  documentosList.forEach(d => {
    if (d.linkResolution.status === 'PLAUSIBLE_URL' || d.linkResolution.status === 'PLAUSIBLE_DRIVE_ID') {
      documentosConEnlacePlausible++;
    } else {
      documentosSinEnlaceOInvalido++;
    }
  });

  let totalBloqueantes = 0;
  let totalAdvertencias = 0;
  let totalInformativas = 0;

  analyzedSolicitudes.forEach(s => {
    s.hallazgos.forEach(h => {
      if (h.severity === FINDING_SEVERITY.BLOQUEANTE) totalBloqueantes++;
      if (h.severity === FINDING_SEVERITY.ADVERTENCIA) totalAdvertencias++;
      if (h.severity === FINDING_SEVERITY.INFORMATIVA) totalInformativas++;
    });
  });

  orphanFindings.forEach(h => {
    if (h.severity === FINDING_SEVERITY.BLOQUEANTE) totalBloqueantes++;
    if (h.severity === FINDING_SEVERITY.ADVERTENCIA) totalAdvertencias++;
    if (h.severity === FINDING_SEVERITY.INFORMATIVA) totalInformativas++;
  });

  const summary = {
    totalSolicitudes,
    solicitudesUnicas,
    solicitudesConIdRepetido,
    totalDocumentos,
    documentosHuerfanos: orphanDocuments.length,
    solicitudesConDiscrepanciaSoportes,
    documentosConEnlacePlausible,
    documentosSinEnlaceOInvalido,
    hallazgosPorSeveridad: {
      bloqueante: totalBloqueantes,
      advertencia: totalAdvertencias,
      informativa: totalInformativas,
      total: totalBloqueantes + totalAdvertencias + totalInformativas
    },
    revisionesPendientes: totalSolicitudes,
    revisionesVerificadas: 0,
    revisionesRequiereAccion: 0,
    revisionesNoVerificable: 0
  };

  return {
    solicitudes: analyzedSolicitudes,
    orphanDocuments,
    orphanFindings,
    summary,
    ruleConfig
  };
}



  // ==========================================
  // Módulo: services/exportAdapter.js
  // ==========================================

/**
 * exportAdapter.js
 * Adaptador nulo desacoplado para futuros módulos (sin botones en UI).
 */

class NullExportAdapter {
  constructor() {
    this.id = 'null-adapter';
    this.name = 'Adaptador Nulo (En Pantalla Exclusivo)';
    this.format = 'json';
  }

  async exportBatch() {
    return {
      success: true,
      message: 'Operación desacoplada: No se generan archivos externos por política de privacidad.'
    };
  }
}



  // ==========================================
  // Módulo: data/demoBatch.js
  // ==========================================

/**
 * demoBatch.js
 * 
 * Generador de datos de demostración 100% ficticios y sintéticos en memoria.
 * Cubre todos los casos de borde definidos en el requerimiento:
 * 1. Solicitud consistente con enlaces plausibles (RAD-2025-001).
 * 2. Solicitud con discrepancia en conteo: 3 reportados vs 2 encontrados (RAD-2025-002).
 * 3. Solicitud con 0 soportes en matriz (RAD-2025-003).
 * 4. Documento huérfano en matriz con solicitud inexistente (RAD-9999).
 * 5. Documentos con enlace vacío y enlace de ruta local inválida (RAD-2025-004).
 * 6. Documento con solo ID de Google Drive para reconstrucción segura (RAD-2025-005).
 * 7. Solicitud con fecha ambigua y variante tipográfica en tipo de crédito (RAD-2025-006).
 * 8. Documentos potencialmente duplicados en la misma solicitud (RAD-2025-007).
 * 9. Solicitud con alerta de firma / borrador / huella en observaciones (RAD-2025-008).
 */

const DEMO_RADICADOS_DATA = [
  {
    'ID Solicitud': 'RAD-2025-001',
    'Tipo Credito': 'LIBRANZA',
    'Fecha Radicacion': '2025-10-15',
    'Hora Radicacion': '09:30:00',
    'Monto Solicitado': '$ 12.500.000',
    'Estado Solicitud': 'Radicado',
    'Canal': 'Web Transaccional',
    'Cantidad Soportes': 3,
    'Observaciones': 'Solicitud completa recibida vía portal web del asociado.'
  },
  {
    'ID Solicitud': 'RAD-2025-002',
    'Tipo Credito': 'Libre Inversión',
    'Fecha Radicacion': '2025-10-16',
    'Hora Radicacion': '14:15:00',
    'Monto Solicitado': '$ 25.000.000',
    'Estado Solicitud': 'En revision',
    'Canal': 'Presencial Sede Principal',
    'Cantidad Soportes': 3, // Pero en matriz solo habrá 2 -> Discrepancia
    'Observaciones': 'Asociado presentó soportes en ventanilla.'
  },
  {
    'ID Solicitud': 'RAD-2025-003',
    'Tipo Credito': 'VIVIENDA',
    'Fecha Radicacion': '2025-10-17',
    'Hora Radicacion': '11:00:00',
    'Monto Solicitado': '$ 85.000.000',
    'Estado Solicitud': 'Radicado',
    'Canal': 'Web Transaccional',
    'Cantidad Soportes': 4, // En matriz habrá 0 -> Faltante total
    'Observaciones': 'Solicitud registrada en línea pendiente de adjuntar expedientes.'
  },
  {
    'ID Solicitud': 'RAD-2025-004',
    'Tipo Credito': 'Vehículo',
    'Fecha Radicacion': '2025-10-18',
    'Hora Radicacion': '16:45:00',
    'Monto Solicitado': '$ 42.000.000',
    'Estado Solicitud': 'En revision',
    'Canal': 'Correo Electronico',
    'Cantidad Soportes': 2,
    'Observaciones': 'Remitido por correo con adjuntos comprimidos.'
  },
  {
    'ID Solicitud': 'RAD-2025-005',
    'Tipo Credito': 'LIBRANZA',
    'Fecha Radicacion': '2025-10-19',
    'Hora Radicacion': '08:20:00',
    'Monto Solicitado': '$ 8.000.000',
    'Estado Solicitud': 'Radicado',
    'Canal': 'Presencial',
    'Cantidad Soportes': 2,
    'Observaciones': 'Ingreso regular por libranza comercial.'
  },
  {
    'ID Solicitud': 'RAD-2025-006',
    'Tipo Credito': 'libre inversion ', // Variante con minúscula y espacio
    'Fecha Radicacion': '03/04/2025', // Fecha ambigua (3 de abril vs 4 de marzo)
    'Hora Radicacion': '10:05:00',
    'Monto Solicitado': '$ 15.000.000',
    'Estado Solicitud': 'Radicado',
    'Canal': 'Web',
    'Cantidad Soportes': 2,
    'Observaciones': 'Fecha con formato ambiguo de origen.'
  },
  {
    'ID Solicitud': 'RAD-2025-007',
    'Tipo Credito': 'EDUCATIVO',
    'Fecha Radicacion': '2025-10-20',
    'Hora Radicacion': '15:10:00',
    'Monto Solicitado': '$ 6.500.000',
    'Estado Solicitud': 'Radicado',
    'Canal': 'Web',
    'Cantidad Soportes': 2,
    'Observaciones': 'Crédito para matrícula universitaria.'
  },
  {
    'ID Solicitud': 'RAD-2025-008',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Fecha Radicacion': '2025-10-21',
    'Hora Radicacion': '17:30:00',
    'Monto Solicitado': '$ 18.000.000',
    'Estado Solicitud': 'Subsanacion documental',
    'Canal': 'Presencial',
    'Cantidad Soportes': 2,
    'Observaciones': 'Documento borrador sin firma, pendiente firma y falta huella en pagaré.' // Alerta para revisión humana
  }
];

const DEMO_DOCUMENTOS_DATA = [
  // RAD-2025-001 (Consistente, 3 de 3)
  {
    'ID Solicitud': 'RAD-2025-001',
    'ID Documento': 'DOC-001-A',
    'Tipo Credito': 'LIBRANZA',
    'Tipo Documento': 'Pagaré',
    'Nombre Archivo': 'pagare_libranza_001.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7/view'
  },
  {
    'ID Solicitud': 'RAD-2025-001',
    'ID Documento': 'DOC-001-B',
    'Tipo Credito': 'LIBRANZA',
    'Tipo Documento': 'Desprendible de nómina',
    'Nombre Archivo': 'desprendible_septiembre_001.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7/view'
  },
  {
    'ID Solicitud': 'RAD-2025-001',
    'ID Documento': 'DOC-001-C',
    'Tipo Credito': 'LIBRANZA',
    'Tipo Documento': 'Cédula de ciudadanía',
    'Nombre Archivo': 'cedula_asociado_001.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1C2d3E4f5G6h7I8j9K0l1M2n3O4p5Q6r7/view'
  },

  // RAD-2025-002 (Reporta 3, pero solo hay 2 -> Falta 1)
  {
    'ID Solicitud': 'RAD-2025-002',
    'ID Documento': 'DOC-002-A',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Pagaré',
    'Nombre Archivo': 'pagare_firmado_002.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1D2e3F4g5H6i7J8k9L0m1N2o3P4q5R6s7/view'
  },
  {
    'ID Solicitud': 'RAD-2025-002',
    'ID Documento': 'DOC-002-B',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Certificado laboral',
    'Nombre Archivo': 'certificado_laboral_002.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1E2f3G4h5I6j7K8l9M0n1O2p3Q4r5S6t7/view'
  },

  // RAD-2025-003: No tiene ningún documento en matriz (0 filas) -> Probado

  // RAD-9999: Documento huérfano (No existe en radicados)
  {
    'ID Solicitud': 'RAD-9999',
    'ID Documento': 'DOC-HUERF-99',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Desprendible adicional',
    'Nombre Archivo': 'desprendible_desconocido.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1F2g3H4i5J6k7L8m9N0o1P2q3R4s5T6u7/view'
  },

  // RAD-2025-004: Documento con URL vacía y documento con URL local inválida
  {
    'ID Solicitud': 'RAD-2025-004',
    'ID Documento': 'DOC-004-A',
    'Tipo Credito': 'VEHICULO',
    'Tipo Documento': 'Factura proforma vehículo',
    'Nombre Archivo': 'factura_concesionario.pdf',
    'URL / ID Fuente': '' // Vacío -> Sin enlace de documento fuente
  },
  {
    'ID Solicitud': 'RAD-2025-004',
    'ID Documento': 'DOC-004-B',
    'Tipo Credito': 'VEHICULO',
    'Tipo Documento': 'Pagaré vehículo',
    'Nombre Archivo': 'pagare_auto.pdf',
    'URL / ID Fuente': 'C:\\Users\\operador\\Desktop\\docs\\pagare_auto.pdf' // Inválido -> Formato inválido
  },

  // RAD-2025-005: Trae solo un ID alfanumérico estricto de Google Drive
  {
    'ID Solicitud': 'RAD-2025-005',
    'ID Documento': 'DOC-005-A',
    'Tipo Credito': 'LIBRANZA',
    'Tipo Documento': 'Pagaré libranza',
    'Nombre Archivo': 'pagare_libranza_005.pdf',
    'URL / ID Fuente': '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' // ID puro
  },
  {
    'ID Solicitud': 'RAD-2025-005',
    'ID Documento': 'DOC-005-B',
    'Tipo Credito': 'LIBRANZA',
    'Tipo Documento': 'Desprendible de pago',
    'Nombre Archivo': 'desprendible_005.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1H2i3J4k5L6m7N8o9P0q1R2s3T4u5V6w7/view'
  },

  // RAD-2025-006: Radicado con fecha ambigua
  {
    'ID Solicitud': 'RAD-2025-006',
    'ID Documento': 'DOC-006-A',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Pagaré',
    'Nombre Archivo': 'pagare_006.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1I2j3K4l5M6n7O8p9Q0r1S2t3U4v5W6x7/view'
  },
  {
    'ID Solicitud': 'RAD-2025-006',
    'ID Documento': 'DOC-006-B',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Desprendible nómina',
    'Nombre Archivo': 'desprendible_006.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1J2k3L4m5N6o7P8q9R0s1T2u3V4w5X6y7/view'
  },

  // RAD-2025-007: Posibles documentos duplicados (mismo tipo y nombre de archivo)
  {
    'ID Solicitud': 'RAD-2025-007',
    'ID Documento': 'DOC-007-A',
    'Tipo Credito': 'EDUCATIVO',
    'Tipo Documento': 'Recibo de matrícula',
    'Nombre Archivo': 'recibo_matricula_semestre_1.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1K2l3M4n5O6p7Q8r9S0t1U2v3W4x5Y6z7/view'
  },
  {
    'ID Solicitud': 'RAD-2025-007',
    'ID Documento': 'DOC-007-B',
    'Tipo Credito': 'EDUCATIVO',
    'Tipo Documento': 'Recibo de matrícula', // Mismo tipo de documento
    'Nombre Archivo': 'recibo_matricula_semestre_1.pdf', // Mismo nombre de archivo -> Posible duplicado
    'URL / ID Fuente': 'https://drive.google.com/file/d/1L2m3N4o5P6q7R8s9T0u1V2w3X4y5Z6a7/view'
  },

  // RAD-2025-008: Alerta de firmas / borrador
  {
    'ID Solicitud': 'RAD-2025-008',
    'ID Documento': 'DOC-008-A',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Pagaré',
    'Nombre Archivo': 'pagare_borrador_sin_firma.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1M2n3O4p5Q6r7S8t9U0v1W2x3Y4z5A6b7/view'
  },
  {
    'ID Solicitud': 'RAD-2025-008',
    'ID Documento': 'DOC-008-B',
    'Tipo Credito': 'LIBRE_INVERSION',
    'Tipo Documento': 'Desprendible nómina',
    'Nombre Archivo': 'desprendible_008.pdf',
    'URL / ID Fuente': 'https://drive.google.com/file/d/1N2o3P4q5R6s7T8u9V0w1X2y3Z4a5B6c7/view'
  }
];

/**
 * Crea libros XLSX sintéticos en memoria
 */
function generateDemoWorkbooks() {
  if (typeof XLSX === 'undefined') {
    throw new Error('Librería XLSX no disponible');
  }

  // Libro 1: Radicados
  const wbRadicados = XLSX.utils.book_new();
  const wsRadicados = XLSX.utils.json_to_sheet(DEMO_RADICADOS_DATA);
  XLSX.utils.book_append_sheet(wbRadicados, wsRadicados, 'Radicados_Octubre_2025');
  const bufferRadicados = XLSX.write(wbRadicados, { type: 'array', bookType: 'xlsx' });

  // Libro 2: Matriz Documental
  const wbDocumentos = XLSX.utils.book_new();
  const wsDocumentos = XLSX.utils.json_to_sheet(DEMO_DOCUMENTOS_DATA);
  XLSX.utils.book_append_sheet(wbDocumentos, wsDocumentos, 'Matriz_Soportes_Drive');
  const bufferDocumentos = XLSX.write(wbDocumentos, { type: 'array', bookType: 'xlsx' });

  return {
    radicados: {
      fileName: 'Lote_Demostracion_Radicados.xlsx',
      buffer: bufferRadicados,
      workbook: wbRadicados,
      activeSheet: 'Radicados_Octubre_2025',
      rowsCount: DEMO_RADICADOS_DATA.length
    },
    documentos: {
      fileName: 'Lote_Demostracion_Matriz_Documentos.xlsx',
      buffer: bufferDocumentos,
      workbook: wbDocumentos,
      activeSheet: 'Matriz_Soportes_Drive',
      rowsCount: DEMO_DOCUMENTOS_DATA.length
    }
  };
}



  // ==========================================
  // Módulo: tests/unitTests.js
  // ==========================================

/**
 * unitTests.js
 * 
 * Suite de pruebas unitarias deterministas ejecutable tanto en navegador
 * como en entornos modulares.
 * Verifica los 100% de criterios de aceptación del prompt maestro.
 */


function runAllUnitTests() {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, passed: true, error: null });
    } catch (err) {
      results.push({ name, passed: false, error: err.message || String(err) });
    }
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Failed'}: Esperado "${expected}", recibido "${actual}"`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. Pruebas de driveLinkResolver
  // -------------------------------------------------------------------------
  test('driveLinkResolver: detecta enlace vacío o nulo como MISSING', () => {
    const resNull = resolveDriveLink(null);
    assertEqual(resNull.status, 'MISSING', 'Null debe ser MISSING');
    assertEqual(resNull.canOpen, false, 'No debe ser clickable');

    const resEmpty = resolveDriveLink('   ');
    assertEqual(resEmpty.status, 'MISSING', 'Espacios vacíos debe ser MISSING');
  });

  test('driveLinkResolver: reconoce URL https válida como PLAUSIBLE_URL sin modificarla', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view';
    const res = resolveDriveLink(url);
    assertEqual(res.status, 'PLAUSIBLE_URL', 'URL https debe ser PLAUSIBLE_URL');
    assertEqual(res.resolvedUrl, url, 'La URL no debe ser modificada');
    assertEqual(res.canOpen, true, 'Debe permitir abrir');
    assertEqual(res.isConstructed, false, 'No fue construida');
  });

  test('driveLinkResolver: reconstruye ID de Google Drive alfanumérico estricto', () => {
    const driveId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const res = resolveDriveLink(driveId);
    assertEqual(res.status, 'PLAUSIBLE_DRIVE_ID', 'ID de Drive debe ser PLAUSIBLE_DRIVE_ID');
    assertEqual(res.isConstructed, true, 'Debe marcarse como construida');
    assertEqual(res.resolvedUrl, `https://drive.google.com/file/d/${driveId}/view`, 'URL construida correcta');
    assertEqual(res.canOpen, true, 'Debe ser clickable');
  });

  test('driveLinkResolver: rechaza rutas locales y protocolos http inseguros como INVALID_FORMAT', () => {
    const local = 'C:\\Users\\analista\\Desktop\\doc.pdf';
    const resLocal = resolveDriveLink(local);
    assertEqual(resLocal.status, 'INVALID_FORMAT', 'Ruta local debe ser INVALID_FORMAT');
    assertEqual(resLocal.canOpen, false, 'No debe abrirse');

    const http = 'http://sitio-inseguro.org/doc.pdf';
    const resHttp = resolveDriveLink(http);
    assertEqual(resHttp.status, 'INVALID_FORMAT', 'HTTP debe ser INVALID_FORMAT');
  });

  // -------------------------------------------------------------------------
  // 2. Pruebas de normalizer
  // -------------------------------------------------------------------------
  test('normalizer: fecha ISO inequívoca normalizada a YYYY-MM-DD', () => {
    const res = normalizeDate('2025-10-15');
    assertEqual(res.status, 'valid', 'ISO debe ser válido');
    assertEqual(res.normalized, '2025-10-15');
    assertEqual(res.raw, '2025-10-15');
  });

  test('normalizer: fecha DD/MM/YYYY con día > 12 es inequívoca', () => {
    const res = normalizeDate('25/08/2025');
    assertEqual(res.status, 'valid', '25/08 debe ser válido');
    assertEqual(res.normalized, '2025-08-25');
  });

  test('normalizer: fecha ambigua (día ≤ 12 y mes ≤ 12) se marca como ambiguous', () => {
    const res = normalizeDate('03/04/2025');
    assertEqual(res.status, 'ambiguous', '03/04/2025 debe ser ambiguo');
    assertEqual(res.normalized, null, 'Normalized debe ser null');
    assert(res.mappingNote && res.mappingNote.includes('ambigua'), 'Debe incluir nota de ambigüedad');
  });

  test('normalizer: montos extraen valor numérico preservando decimales y símbolo en raw', () => {
    const res = normalizeAmount('$ 12.500.000,50 COP');
    assertEqual(res.status, 'valid');
    assertEqual(res.normalized, 12500000.5);
    assertEqual(res.raw, '$ 12.500.000,50 COP');
  });

  test('normalizer: montos ambiguos o inválidos se marcan como ambiguous', () => {
    const res = normalizeAmount('Monto a convenir');
    assertEqual(res.status, 'ambiguous');
    assertEqual(res.normalized, null);
  });

  test('normalizer: homologación de catálogo de tipo de crédito preserva raw', () => {
    const res = normalizeCreditType('  libre inversion  ');
    assertEqual(res.status, 'valid');
    assertEqual(res.normalized, 'LIBRE_INVERSION');
    assertEqual(res.raw, '  libre inversion  ');
    assert(res.mappingNote.includes('Homologado'), 'Debe registrar nota de mapeo');
  });

  test('normalizer: tipo de crédito no catalogado asigna "Por revisar"', () => {
    const res = normalizeCreditType('CREDITO_EXTRATERRESTRE');
    assertEqual(res.status, 'ambiguous');
    assertEqual(res.normalized, 'Por revisar');
  });

  // -------------------------------------------------------------------------
  // 3. Pruebas de validationEngine con Lote de Demostración
  // -------------------------------------------------------------------------
  test('validationEngine: procesa lote de demostración y detecta todos los casos de borde', () => {
    const radMapping = {
      solicitudId: { selectedColumn: 'ID Solicitud' },
      tipoCredito: { selectedColumn: 'Tipo Credito' },
      fechaRegistro: { selectedColumn: 'Fecha Radicacion' },
      horaRegistro: { selectedColumn: 'Hora Radicacion' },
      montoSolicitado: { selectedColumn: 'Monto Solicitado' },
      estado: { selectedColumn: 'Estado Solicitud' },
      canal: { selectedColumn: 'Canal' },
      cantidadSoportesReportada: { selectedColumn: 'Cantidad Soportes' },
      observaciones: { selectedColumn: 'Observaciones' }
    };

    const docMapping = {
      solicitudId: { selectedColumn: 'ID Solicitud' },
      documentoId: { selectedColumn: 'ID Documento' },
      tipoCredito: { selectedColumn: 'Tipo Credito' },
      tipoDocumento: { selectedColumn: 'Tipo Documento' },
      nombreArchivo: { selectedColumn: 'Nombre Archivo' },
      urlOIdFuente: { selectedColumn: 'URL / ID Fuente' }
    };

    const config = getDefaultRuleConfig();
    const result = analyzeBatch(DEMO_RADICADOS_DATA, radMapping, DEMO_DOCUMENTOS_DATA, docMapping, config);

    // Verificación 1: Solicitudes procesadas
    assertEqual(result.solicitudes.length, 8, 'Deben procesarse 8 solicitudes');

    // Verificación 2: RAD-2025-001 (Consistente, 3 de 3, sin hallazgos bloqueantes)
    const rad1 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-001');
    assert(rad1, 'RAD-2025-001 debe existir');
    assertEqual(rad1.conteoEncontrado, 3);
    assertEqual(rad1.diferenciaConteo, 0);

    // Verificación 3: RAD-2025-002 (Discrepancia en conteo: 3 rep vs 2 enc)
    const rad2 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-002');
    assert(rad2, 'RAD-2025-002 debe existir');
    assertEqual(rad2.conteoReportado, 3);
    assertEqual(rad2.conteoEncontrado, 2);
    assertEqual(rad2.diferenciaConteo, -1);
    const hasDiscrepancy = rad2.hallazgos.some(h => h.category === 'Discrepancia');
    assert(hasDiscrepancy, 'RAD-2025-002 debe tener hallazgo de Discrepancia');

    // Verificación 4: RAD-2025-003 (0 soportes en matriz -> Faltante total bloqueante)
    const rad3 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-003');
    assert(rad3, 'RAD-2025-003 debe existir');
    assertEqual(rad3.conteoEncontrado, 0);
    const hasFaltante = rad3.hallazgos.some(h => h.category === 'Faltante' && h.severity === 'Bloqueante / Alta');
    assert(hasFaltante, 'RAD-2025-003 debe tener Faltante Bloqueante');

    // Verificación 5: Documento huérfano (RAD-9999)
    assertEqual(result.orphanDocuments.length, 1, 'Debe haber 1 documento huérfano');
    assertEqual(result.orphanDocuments[0].documento.solicitudId.raw, 'RAD-9999');

    // Verificación 6: RAD-2025-004 (Enlace vacío y ruta local inválida)
    const rad4 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-004');
    const hasEnlaceNoDisp = rad4.hallazgos.filter(h => h.category === 'Enlace no disponible');
    assert(hasEnlaceNoDisp.length >= 2, 'RAD-2025-004 debe registrar al menos 2 hallazgos de enlace');

    // Verificación 7: RAD-2025-005 (ID Drive alfanumérico reconstruido)
    const rad5 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-005');
    const docDriveId = rad5.documentos.find(d => d.documentoId.raw === 'DOC-005-A');
    assert(docDriveId, 'DOC-005-A debe existir');
    assertEqual(docDriveId.linkResolution.status, 'PLAUSIBLE_DRIVE_ID');
    assert(docDriveId.linkResolution.resolvedUrl.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'), 'URL construida');

    // Verificación 8: RAD-2025-006 (Fecha ambigua)
    const rad6 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-006');
    const hasDatoAmbiguo = rad6.hallazgos.some(h => h.category === 'Dato ambiguo');
    assert(hasDatoAmbiguo, 'RAD-2025-006 debe tener hallazgo de Dato ambiguo por fecha');

    // Verificación 9: RAD-2025-007 (Posible duplicado)
    const rad7 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-007');
    const hasDuplicado = rad7.hallazgos.some(h => h.category === 'Posible duplicado');
    assert(hasDuplicado, 'RAD-2025-007 debe tener hallazgo de Posible duplicado');

    // Verificación 10: RAD-2025-008 (Revisión humana por firma / borrador)
    const rad8 = result.solicitudes.find(s => s.solicitudId === 'RAD-2025-008');
    const hasRevisionHumana = rad8.hallazgos.some(h => h.category === 'Revisión humana');
    assert(hasRevisionHumana, 'RAD-2025-008 debe generar hallazgo de Revisión humana');
  });

  // -------------------------------------------------------------------------
  // 4. Guardrail de Lenguaje Normativo
  // -------------------------------------------------------------------------
  test('guardrail: el motor jamás emite términos crediticios prohibidos', () => {
    const radMapping = {
      solicitudId: { selectedColumn: 'ID Solicitud' },
      tipoCredito: { selectedColumn: 'Tipo Credito' },
      fechaRegistro: { selectedColumn: 'Fecha Radicacion' },
      horaRegistro: { selectedColumn: 'Hora Radicacion' },
      montoSolicitado: { selectedColumn: 'Monto Solicitado' },
      estado: { selectedColumn: 'Estado Solicitud' },
      canal: { selectedColumn: 'Canal' },
      cantidadSoportesReportada: { selectedColumn: 'Cantidad Soportes' },
      observaciones: { selectedColumn: 'Observaciones' }
    };
    const docMapping = {
      solicitudId: { selectedColumn: 'ID Solicitud' },
      documentoId: { selectedColumn: 'ID Documento' },
      tipoCredito: { selectedColumn: 'Tipo Credito' },
      tipoDocumento: { selectedColumn: 'Tipo Documento' },
      nombreArchivo: { selectedColumn: 'Nombre Archivo' },
      urlOIdFuente: { selectedColumn: 'URL / ID Fuente' }
    };

    const config = getDefaultRuleConfig();
    const result = analyzeBatch(DEMO_RADICADOS_DATA, radMapping, DEMO_DOCUMENTOS_DATA, docMapping, config);

    const serialized = JSON.stringify(result).toLowerCase();
    const prohibited = ['aprobado', 'rechazado', 'solvencia crediticia', 'puntaje crediticio', 'score crediticio'];

    prohibited.forEach(term => {
      assert(!serialized.includes(term), `Guardrail violado: se encontró el término prohibido "${term}" en el análisis.`);
    });
  });

  return results;
}



  // ==========================================
  // Módulo: ui/icons.js
  // ==========================================

/**
 * icons.js
 * Conjunto de iconos SVG inspirados en Lucide, renderizables inline sin dependencias externas.
 */

function getIcon(name, className = 'w-4 h-4', extraAttrs = '') {
  const icons = {
    checkCircle: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    alertTriangle: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    xCircle: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    helpCircle: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    externalLink: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>`,
    fileText: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
    layers: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`,
    settings: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
    trash: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`,
    play: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    arrowRight: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`,
    chevronRight: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`,
    search: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
    filter: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>`,
    shield: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
    lock: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>`,
    refreshCw: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>`,
    eye: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`,
    info: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    upload: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>`,
    check: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    x: `<svg class="${className}" ${extraAttrs} fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`
  };

  return icons[name] || icons.info;
}



  // ==========================================
  // Módulo: ui/app.js
  // ==========================================

/**
 * app.js
 * 
 * Controlador Principal y Renderizador de la Aplicación de Revisión Documental de Créditos.
 * Arquitectura 100% modular, reactiva en memoria y con cero dependencias de salida.
 */


// Estado global de la sesión (exclusivamente en memoria)
const state = {
  step: 1, // 1: Carga, 2: Mapeo, 3: Dashboard
  radicadoFile: null,
  documentoFile: null,
  radicadoMapping: {},
  documentoMapping: {},
  ruleConfig: getDefaultRuleConfig(),
  batchAnalysis: null,
  selectedSolicitudId: null,
  activeTab: 'todas',
  filterCreditType: 'all',
  filterCategory: 'all',
  filterSeverity: 'all',
  filterReviewState: 'all',
  searchQuery: '',
  modals: {
    configOpen: false,
    resetOpen: false,
    testsOpen: false
  },
  testResults: []
};

/**
 * Inicialización al cargar el DOM
 */
function initApp() {
  render();
  setupGlobalKeyListeners();
}

function setupGlobalKeyListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.selectedSolicitudId) {
        state.selectedSolicitudId = null;
        render();
      } else if (state.modals.configOpen || state.modals.resetOpen || state.modals.testsOpen) {
        state.modals.configOpen = false;
        state.modals.resetOpen = false;
        state.modals.testsOpen = false;
        render();
      }
    }
  });
}

/**
 * Renderizador maestro
 */
function render() {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    ${renderHeader()}
    ${state.ruleConfig.modoSimulacionActivo ? renderSimulationBar() : ''}
    <main class="main-content">
      ${renderStepper()}
      ${state.step === 1 ? renderStep1Upload() : ''}
      ${state.step === 2 ? renderStep2Mapping() : ''}
      ${state.step === 3 ? renderStep3Dashboard() : ''}
    </main>
    ${renderDrawer()}
    ${renderConfigModal()}
    ${renderResetModal()}
    ${renderTestsModal()}
  `;

  attachEventHandlers();
}

/**
 * ---------------------------------------------------------------------------
 * Componentes de Encabezado y Navegación
 * ---------------------------------------------------------------------------
 */
function renderHeader() {
  return `
    <header class="app-header">
      <div class="header-container">
        <div class="brand-section">
          <div class="brand-icon-box">
            ${getIcon('fileText', 'w-5 h-5')}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h1 class="brand-title">Revisión de solicitudes de crédito</h1>
              <span class="brand-badge">SISTEMA PRIVADO</span>
            </div>
            <p style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">Fondo de Empleados · Control Documental & Trazabilidad Dual</p>
          </div>
        </div>

        <div class="privacy-banner" role="status">
          <span class="pulse-dot"></span>
          <span style="font-weight: 600;">🔒 Entorno privado local:</span>
          <span>Tus datos se procesan 100% en memoria en este navegador.</span>
        </div>

        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-open-tests" title="Verificar suite de pruebas unitarias">
            ${getIcon('checkCircle', 'w-3.5 h-3.5 text-emerald-600')}
            <span>Suite de Pruebas</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-open-config" title="Configurar reglas de políticas y SLA">
            ${getIcon('settings', 'w-3.5 h-3.5 text-slate-500')}
            <span>Reglas y SLA</span>
          </button>
          <button class="btn btn-primary btn-sm" id="btn-load-demo" title="Cargar lote sintético de prueba instantáneamente">
            ${getIcon('play', 'w-3.5 h-3.5 text-white')}
            <span>Cargar Lote Demo</span>
          </button>
          <button class="btn btn-danger btn-sm" id="btn-open-reset" title="Destruir datos en memoria y reiniciar">
            ${getIcon('trash', 'w-3.5 h-3.5')}
            <span>Limpiar</span>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderSimulationBar() {
  return `
    <div class="simulation-bar" role="alert">
      ${getIcon('alertTriangle', 'w-4 h-4')}
      <span>MODO SIMULACIÓN: Reglas ficticias / no operativas activas para ejercicio de taller</span>
    </div>
  `;
}

function renderStepper() {
  return `
    <nav class="stepper-nav" aria-label="Etapas del proceso">
      <button class="step-btn ${state.step === 1 ? 'active' : ''} ${state.step > 1 ? 'completed' : ''}" id="nav-step-1">
        <span class="step-badge">${state.step > 1 ? '✓' : '1'}</span>
        <span>Paso 1: Carga de Lote (Dos Archivos Excel)</span>
      </button>
      ${getIcon('chevronRight', 'w-4 h-4 text-slate-400')}
      <button class="step-btn ${state.step === 2 ? 'active' : ''} ${state.step > 2 ? 'completed' : ''}" id="nav-step-2" ${!state.radicadoFile || !state.documentoFile ? 'disabled' : ''}>
        <span class="step-badge">${state.step > 2 ? '✓' : '2'}</span>
        <span>Paso 2: Inspección de Hojas y Mapeo</span>
      </button>
      ${getIcon('chevronRight', 'w-4 h-4 text-slate-400')}
      <button class="step-btn ${state.step === 3 ? 'active' : ''}" id="nav-step-3" ${!state.batchAnalysis ? 'disabled' : ''}>
        <span class="step-badge">3</span>
        <span>Paso 3: Panel de Resultados y Hallazgos</span>
      </button>
    </nav>
  `;
}

/**
 * ---------------------------------------------------------------------------
 * Paso 1: Carga de Lote (Dos Libros Excel)
 * ---------------------------------------------------------------------------
 */
function renderStep1Upload() {
  const hasBoth = state.radicadoFile && state.documentoFile;

  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          ${getIcon('layers', 'w-5 h-5 text-blue-600')}
          <span>Paso 1: Cargar los dos archivos Excel del Lote</span>
        </h2>
        <span class="badge badge-neutral">Memoria Local Segura (Sin persistencia en disco)</span>
      </div>

      <p style="color: var(--text-muted); margin-bottom: 20px;">
        Para iniciar el análisis documental, carga el archivo de <strong>Radicados</strong> (1 fila = 1 solicitud) y el archivo de <strong>Matriz Documental</strong> (1 fila = 1 soporte enlazado a Google Drive o web).
      </p>

      <div class="upload-grid">
        <!-- Tarjeta 1: Radicados -->
        <div class="dropzone ${state.radicadoFile ? 'dropzone-loaded' : ''}" id="dropzone-radicados">
          <input type="file" id="input-file-radicados" accept=".xlsx,.xls,.csv" style="display: none;" />
          <div style="margin-bottom: 12px;">
            ${getIcon(state.radicadoFile ? 'checkCircle' : 'upload', 'w-10 h-10', 'style="margin: 0 auto; color: ' + (state.radicadoFile ? '#059669' : '#2563eb') + ';"')}
          </div>
          <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Archivo 1: Excel de Radicados</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Formatos admitidos: .xlsx, .xls, .csv (Máx. 25 MB)</p>
          
          ${state.radicadoFile ? `
            <div class="file-info-box">
              <div style="text-align: left;">
                <div style="font-weight: 600; color: #0f172a;">${state.radicadoFile.name}</div>
                <div style="font-size: 11px; color: #64748b;">${formatFileSize(state.radicadoFile.size)} · ${state.radicadoFile.sheetNames.length} hoja(s) detectada(s)</div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-replace-radicados" title="Reemplazar archivo">Cambiar</button>
            </div>
          ` : `
            <button class="btn btn-secondary btn-sm" id="btn-select-radicados">Seleccionar Archivo</button>
          `}
        </div>

        <!-- Tarjeta 2: Matriz Documental -->
        <div class="dropzone ${state.documentoFile ? 'dropzone-loaded' : ''}" id="dropzone-documentos">
          <input type="file" id="input-file-documentos" accept=".xlsx,.xls,.csv" style="display: none;" />
          <div style="margin-bottom: 12px;">
            ${getIcon(state.documentoFile ? 'checkCircle' : 'upload', 'w-10 h-10', 'style="margin: 0 auto; color: ' + (state.documentoFile ? '#059669' : '#2563eb') + ';"')}
          </div>
          <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Archivo 2: Excel de Matriz Documental</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Soportes con URLs o IDs de Google Drive</p>

          ${state.documentoFile ? `
            <div class="file-info-box">
              <div style="text-align: left;">
                <div style="font-weight: 600; color: #0f172a;">${state.documentoFile.name}</div>
                <div style="font-size: 11px; color: #64748b;">${formatFileSize(state.documentoFile.size)} · ${state.documentoFile.sheetNames.length} hoja(s) detectada(s)</div>
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-replace-documentos" title="Reemplazar archivo">Cambiar</button>
            </div>
          ` : `
            <button class="btn btn-secondary btn-sm" id="btn-select-documentos">Seleccionar Archivo</button>
          `}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 18px;">
        <button class="btn btn-secondary" id="btn-quick-demo">
          ${getIcon('play', 'w-4 h-4 text-blue-600')}
          <span>Probar con Lote de Demostración Sintético</span>
        </button>

        <button class="btn btn-primary" id="btn-go-step-2" ${!hasBoth ? 'disabled' : ''}>
          <span>Continuar a Inspección y Mapeo de Columnas</span>
          ${getIcon('arrowRight', 'w-4 h-4')}
        </button>
      </div>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------------
 * Paso 2: Inspección de Hojas y Mapeo Asistido
 * ---------------------------------------------------------------------------
 */
function renderStep2Mapping() {
  const radSheetData = extractSheetData(state.radicadoFile.workbook, state.radicadoFile.activeSheet);
  const docSheetData = extractSheetData(state.documentoFile.workbook, state.documentoFile.activeSheet);

  const preFlight = runPreFlightCheck(radSheetData, state.radicadoMapping, docSheetData, state.documentoMapping);

  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">
          ${getIcon('settings', 'w-5 h-5 text-blue-600')}
          <span>Paso 2: Inspección de Hojas y Mapeo Asistido de Columnas</span>
        </h2>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" id="btn-back-step-1">← Volver a Carga</button>
          <button class="btn btn-primary btn-sm" id="btn-analyze-batch" ${!preFlight.canProcess ? 'disabled' : ''}>
            ${getIcon('play', 'w-4 h-4')}
            <span>Procesar y Analizar Lote</span>
          </button>
        </div>
      </div>

      <p style="color: var(--text-muted); margin-bottom: 20px;">
        Verifica las hojas seleccionadas y confirma la correspondencia de columnas. Las columnas sugeridas con coincidencia parcial aparecen resaltadas en color ámbar para tu validación.
      </p>

      <!-- Sección Mapeo Radicados -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <strong style="font-size: 14px;">Archivo 1 (Radicados): ${state.radicadoFile.name}</strong>
            <span class="badge badge-neutral">${radSheetData.rows.length} filas detectadas</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="select-sheet-radicados" style="font-size: 12px; font-weight: 500;">Hoja activa:</label>
            <select id="select-sheet-radicados" class="form-select">
              ${state.radicadoFile.sheetNames.map(name => `
                <option value="${name}" ${name === state.radicadoFile.activeSheet ? 'selected' : ''}>${name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="table-container" style="margin-bottom: 14px;">
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Campo Esperado</th>
                <th style="width: 15%;">Obligatoriedad</th>
                <th style="width: 35%;">Columna en tu Archivo Excel</th>
                <th style="width: 25%;">Estado de Detección</th>
              </tr>
            </thead>
            <tbody>
              ${RADICADO_FIELDS.map(field => {
                const mapInfo = state.radicadoMapping[field.key] || { selectedColumn: null, isAmbiguous: false };
                const isMapped = Boolean(mapInfo.selectedColumn);
                const isAmbiguous = mapInfo.isAmbiguous;

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${field.label}</div>
                      <div style="font-size: 11px; color: #64748b;">${field.description}</div>
                    </td>
                    <td>
                      ${field.required 
                        ? `<span class="badge badge-rose">Obligatorio</span>`
                        : `<span class="badge badge-neutral">Opcional</span>`
                      }
                    </td>
                    <td>
                      <select class="form-select mapping-select-rad ${isAmbiguous ? 'mapping-ambiguous' : ''}" data-field="${field.key}" style="width: 100%;">
                        <option value="">${field.required ? '-- Seleccionar columna obligatoria --' : 'No disponible (Columna opcional)'}</option>
                        ${radSheetData.headers.map(h => `
                          <option value="${h}" ${h === mapInfo.selectedColumn ? 'selected' : ''}>${h}</option>
                        `).join('')}
                      </select>
                    </td>
                    <td>
                      ${isMapped 
                        ? (isAmbiguous 
                            ? `<span class="badge badge-amber">${getIcon('alertTriangle', 'w-3 h-3')} Coincidencia parcial (Confirmar)</span>`
                            : `<span class="badge badge-emerald">${getIcon('checkCircle', 'w-3 h-3')} Mapeo confirmado</span>`)
                        : (field.required
                            ? `<span class="badge badge-rose">${getIcon('xCircle', 'w-3 h-3')} Pendiente de mapear</span>`
                            : `<span class="badge badge-neutral">Omitido</span>`)
                      }
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Vista previa 3 filas Radicados -->
        <details style="margin-top: 10px; font-size: 12px; color: #475569;">
          <summary style="cursor: pointer; font-weight: 600; padding: 4px 0;">👁 Ver vista previa de las primeras 3 filas de Radicados</summary>
          <div class="table-container" style="margin-top: 8px;">
            <table>
              <thead>
                <tr>
                  ${radSheetData.headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${radSheetData.rows.slice(0, 3).map(row => `
                  <tr>
                    ${radSheetData.headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : '<em style="color:#94a3b8;">vacío</em>'}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <!-- Sección Mapeo Matriz Documental -->
      <div style="margin-bottom: 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: #f8fafc; padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <strong style="font-size: 14px;">Archivo 2 (Matriz Documental): ${state.documentoFile.name}</strong>
            <span class="badge badge-neutral">${docSheetData.rows.length} filas detectadas</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="select-sheet-documentos" style="font-size: 12px; font-weight: 500;">Hoja activa:</label>
            <select id="select-sheet-documentos" class="form-select">
              ${state.documentoFile.sheetNames.map(name => `
                <option value="${name}" ${name === state.documentoFile.activeSheet ? 'selected' : ''}>${name}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="table-container" style="margin-bottom: 14px;">
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Campo Esperado</th>
                <th style="width: 15%;">Obligatoriedad</th>
                <th style="width: 35%;">Columna en tu Archivo Excel</th>
                <th style="width: 25%;">Estado de Detección</th>
              </tr>
            </thead>
            <tbody>
              ${DOCUMENTO_FIELDS.map(field => {
                const mapInfo = state.documentoMapping[field.key] || { selectedColumn: null, isAmbiguous: false };
                const isMapped = Boolean(mapInfo.selectedColumn);
                const isAmbiguous = mapInfo.isAmbiguous;

                return `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${field.label}</div>
                      <div style="font-size: 11px; color: #64748b;">${field.description}</div>
                    </td>
                    <td>
                      ${field.required 
                        ? `<span class="badge badge-rose">Obligatorio</span>`
                        : `<span class="badge badge-neutral">Opcional</span>`
                      }
                    </td>
                    <td>
                      <select class="form-select mapping-select-doc ${isAmbiguous ? 'mapping-ambiguous' : ''}" data-field="${field.key}" style="width: 100%;">
                        <option value="">${field.required ? '-- Seleccionar columna obligatoria --' : 'No disponible (Columna opcional)'}</option>
                        ${docSheetData.headers.map(h => `
                          <option value="${h}" ${h === mapInfo.selectedColumn ? 'selected' : ''}>${h}</option>
                        `).join('')}
                      </select>
                    </td>
                    <td>
                      ${isMapped 
                        ? (isAmbiguous 
                            ? `<span class="badge badge-amber">${getIcon('alertTriangle', 'w-3 h-3')} Coincidencia parcial (Confirmar)</span>`
                            : `<span class="badge badge-emerald">${getIcon('checkCircle', 'w-3 h-3')} Mapeo confirmado</span>`)
                        : (field.required
                            ? `<span class="badge badge-rose">${getIcon('xCircle', 'w-3 h-3')} Pendiente de mapear</span>`
                            : `<span class="badge badge-neutral">Omitido</span>`)
                      }
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Vista previa 3 filas Matriz -->
        <details style="margin-top: 10px; font-size: 12px; color: #475569;">
          <summary style="cursor: pointer; font-weight: 600; padding: 4px 0;">👁 Ver vista previa de las primeras 3 filas de la Matriz Documental</summary>
          <div class="table-container" style="margin-top: 8px;">
            <table>
              <thead>
                <tr>
                  ${docSheetData.headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${docSheetData.rows.slice(0, 3).map(row => `
                  <tr>
                    ${docSheetData.headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : '<em style="color:#94a3b8;">vacío</em>'}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </details>
      </div>

      <!-- Resumen Pre-vuelo (Pre-flight Check) -->
      <div class="preflight-box">
        <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          ${preFlight.canProcess ? getIcon('checkCircle', 'w-5 h-5 text-emerald-600') : getIcon('alertTriangle', 'w-5 h-5 text-rose-600')}
          <span>Resumen Pre-vuelo del Lote</span>
        </h3>

        <div style="font-size: 13px; line-height: 1.6; margin-bottom: 12px;">
          <div>• <strong>Total de solicitudes en Radicados:</strong> ${preFlight.stats.totalRadicados} filas útiles.</div>
          <div>• <strong>Total de soportes en Matriz Documental:</strong> ${preFlight.stats.totalDocumentos} filas útiles.</div>
          ${preFlight.stats.emptyRowsIgnored > 0 ? `<div>• <strong>Filas vacías omitidas:</strong> ${preFlight.stats.emptyRowsIgnored} filas en blanco ignoradas sin afectar conteos.</div>` : ''}
        </div>

        ${preFlight.errors.length > 0 ? `
          <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 10px; margin-bottom: 12px; color: #9f1239; font-size: 13px;">
            <strong>Campos obligatorios requeridos antes de continuar:</strong>
            <ul style="margin-left: 20px; margin-top: 4px;">
              ${preFlight.errors.map(err => `<li>${err}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${preFlight.warnings.length > 0 ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; margin-bottom: 12px; color: #92400e; font-size: 13px;">
            <strong>Advertencias a tener en cuenta:</strong>
            <ul style="margin-left: 20px; margin-top: 4px;">
              ${preFlight.warnings.map(w => `<li>${w}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="text-align: right; margin-top: 14px;">
          <button class="btn btn-primary" id="btn-preflight-analyze" ${!preFlight.canProcess ? 'disabled' : ''}>
            ${getIcon('play', 'w-4 h-4')}
            <span>Procesar y Analizar Lote</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------------
 * Paso 3: Dashboard de Resultados y Tabla Principal
 * ---------------------------------------------------------------------------
 */
function renderStep3Dashboard() {
  if (!state.batchAnalysis) return '';

  const summary = state.batchAnalysis.summary;
  const filteredSolicitudes = getFilteredSolicitudes();

  return `
    <!-- Tarjetas de Indicadores (KPIs con denominadores explícitos) -->
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top: 3px solid #2563eb;">
        <div class="kpi-header">
          <span>Solicitudes Procesadas</span>
          <span style="padding: 5px; background: #eff6ff; border-radius: 6px;">
            ${getIcon('fileText', 'w-4 h-4 text-blue-600')}
          </span>
        </div>
        <div class="kpi-value">${summary.totalSolicitudes}</div>
        <div class="kpi-subtext">
          <strong>${summary.solicitudesUnicas}</strong> únicas${summary.solicitudesConIdRepetido > 0 ? ` · <span class="badge badge-rose" style="font-size: 10px; padding: 1px 5px;">${summary.solicitudesConIdRepetido} repetidas</span>` : ' · 0 duplicadas'}
        </div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #f59e0b;">
        <div class="kpi-header">
          <span>Cruce de Soportes</span>
          <span style="padding: 5px; background: #fffbeb; border-radius: 6px;">
            ${getIcon('layers', 'w-4 h-4 text-amber-600')}
          </span>
        </div>
        <div class="kpi-value">${summary.solicitudesConDiscrepanciaSoportes} <span style="font-size: 14px; font-weight: 500; color: #64748b;">/ ${summary.totalSolicitudes}</span></div>
        <div class="kpi-subtext">
          ${summary.solicitudesConDiscrepanciaSoportes > 0 ? `<span class="badge badge-amber" style="font-size: 10px; padding: 1px 5px;">Discrepancia en conteo</span>` : '<span class="badge badge-emerald" style="font-size: 10px; padding: 1px 5px;">Conteos exactos</span>'}
        </div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #10b981;">
        <div class="kpi-header">
          <span>Enlaces Fuente</span>
          <span style="padding: 5px; background: #ecfdf5; border-radius: 6px;">
            ${getIcon('externalLink', 'w-4 h-4 text-emerald-600')}
          </span>
        </div>
        <div class="kpi-value">${summary.documentosConEnlacePlausible} <span style="font-size: 14px; font-weight: 500; color: #64748b;">/ ${summary.totalDocumentos}</span></div>
        <div class="kpi-subtext">
          ${summary.documentosSinEnlaceOInvalido > 0 ? `<span class="badge badge-rose" style="font-size: 10px; padding: 1px 5px;">${summary.documentosSinEnlaceOInvalido} sin enlace o inválido</span>` : '<span class="badge badge-emerald" style="font-size: 10px; padding: 1px 5px;">100% enlaces plausibles</span>'}
        </div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #e11d48;">
        <div class="kpi-header">
          <span>Novedades Detectadas</span>
          <span style="padding: 5px; background: #fff1f2; border-radius: 6px;">
            ${getIcon('alertTriangle', 'w-4 h-4 text-rose-600')}
          </span>
        </div>
        <div class="kpi-value">${summary.hallazgosPorSeveridad.total}</div>
        <div class="kpi-subtext" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;">
          <span class="badge badge-rose" style="padding: 1px 6px; font-size: 10px;">${summary.hallazgosPorSeveridad.bloqueante} Bloqueantes</span>
          <span class="badge badge-amber" style="padding: 1px 6px; font-size: 10px;">${summary.hallazgosPorSeveridad.advertencia} Advertencias</span>
        </div>
      </div>

      <div class="kpi-card" style="border-top: 3px solid #6366f1;">
        <div class="kpi-header">
          <span>Revisiones Pendientes</span>
          <span style="padding: 5px; background: #eef2ff; border-radius: 6px;">
            ${getIcon('helpCircle', 'w-4 h-4 text-indigo-600')}
          </span>
        </div>
        <div class="kpi-value">${summary.revisionesPendientes} <span style="font-size: 14px; font-weight: 500; color: #64748b;">/ ${summary.totalSolicitudes}</span></div>
        <div class="kpi-subtext">
          <span class="badge ${summary.revisionesPendientes > 0 ? 'badge-amber' : 'badge-emerald'}" style="font-size: 10px; padding: 1px 5px;">
            ${summary.revisionesPendientes > 0 ? `${summary.revisionesPendientes} por verificar` : 'Todas revisadas'}
          </span>
        </div>
      </div>
    </div>

    <!-- Pestañas de Vista Rápida -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; flex-wrap: wrap;">
      <button class="btn ${state.activeTab === 'todas' ? 'btn-primary' : 'btn-secondary'} btn-sm tab-btn" data-tab="todas">
        Todas (${state.batchAnalysis.solicitudes.length})
      </button>
      <button class="btn ${state.activeTab === 'discrepancia' ? 'btn-primary' : 'btn-secondary'} btn-sm tab-btn" data-tab="discrepancia">
        Con Discrepancia de Soportes (${summary.solicitudesConDiscrepanciaSoportes})
      </button>
      <button class="btn ${state.activeTab === 'enlaces_invalidos' ? 'btn-primary' : 'btn-secondary'} btn-sm tab-btn" data-tab="enlaces_invalidos">
        Con Enlace No Disponible (${getSolicitudesWithMissingLinksCount()})
      </button>
      <button class="btn ${state.activeTab === 'pendientes' ? 'btn-primary' : 'btn-secondary'} btn-sm tab-btn" data-tab="pendientes">
        Pendientes (${summary.revisionesPendientes})
      </button>
      <button class="btn ${state.activeTab === 'verificados' ? 'btn-primary' : 'btn-secondary'} btn-sm tab-btn" data-tab="verificados">
        Verificados (${summary.revisionesVerificadas})
      </button>
      <button class="btn ${state.activeTab === 'huerfanos' ? 'btn-primary' : 'btn-secondary'} btn-sm tab-btn" data-tab="huerfanos">
        Documentos Huérfanos (${state.batchAnalysis.orphanDocuments.length})
      </button>
    </div>

    <!-- Filtros y Búsqueda -->
    <div class="card" style="padding: 14px; margin-bottom: 16px;">
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 240px; position: relative;">
          <input 
            type="text" 
            id="search-input" 
            placeholder="Buscar por ID Solicitud, monto u observaciones..." 
            value="${state.searchQuery}"
            class="form-select"
            style="width: 100%; padding-left: 32px;"
          />
          <div style="position: absolute; left: 10px; top: 8px; color: #94a3b8; pointer-events: none;">
            ${getIcon('search', 'w-4 h-4')}
          </div>
        </div>

        <select id="filter-credit-type" class="form-select">
          <option value="all">Todos los Tipos de Crédito</option>
          ${getUniqueCreditTypes().map(t => `<option value="${t}" ${state.filterCreditType === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>

        <select id="filter-severity" class="form-select">
          <option value="all">Todas las Severidades</option>
          <option value="Bloqueante / Alta" ${state.filterSeverity === 'Bloqueante / Alta' ? 'selected' : ''}>Bloqueante / Alta</option>
          <option value="Advertencia / Media" ${state.filterSeverity === 'Advertencia / Media' ? 'selected' : ''}>Advertencia / Media</option>
          <option value="Informativa" ${state.filterSeverity === 'Informativa' ? 'selected' : ''}>Informativa</option>
          <option value="Sin hallazgos" ${state.filterSeverity === 'Sin hallazgos' ? 'selected' : ''}>Sin hallazgos</option>
        </select>

        <select id="filter-review-state" class="form-select">
          <option value="all">Todos los Estados de Revisión</option>
          <option value="Por revisar" ${state.filterReviewState === 'Por revisar' ? 'selected' : ''}>Por revisar</option>
          <option value="Verificado" ${state.filterReviewState === 'Verificado' ? 'selected' : ''}>Verificado</option>
          <option value="No verificable" ${state.filterReviewState === 'No verificable' ? 'selected' : ''}>No verificable</option>
          <option value="Requiere acción" ${state.filterReviewState === 'Requiere acción' ? 'selected' : ''}>Requiere acción</option>
        </select>

        <button class="btn btn-secondary btn-sm" id="btn-clear-filters" title="Limpiar todos los filtros">
          ${getIcon('refreshCw', 'w-4 h-4')}
          <span>Restablecer</span>
        </button>
      </div>
    </div>

    <!-- Vista de Documentos Huérfanos si la pestaña está activa -->
    ${state.activeTab === 'huerfanos' ? renderOrphanDocumentsSection() : `
      <!-- Tabla Principal de Solicitudes -->
      <div class="card" style="padding: 0; overflow: hidden;">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="width: 12%;">ID Solicitud</th>
                <th style="width: 14%;">Tipo de Crédito</th>
                <th style="width: 11%;">Fecha Registro</th>
                <th style="width: 13%;">Monto Solicitado</th>
                <th style="width: 13%;">Soportes (Rep. / Enc.)</th>
                <th style="width: 15%;">Hallazgos</th>
                <th style="width: 14%;">Acceso a Novedades</th>
                <th style="width: 8%; text-align: center;">Acción</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSolicitudes.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No se encontraron solicitudes con los filtros aplicados.
                  </td>
                </tr>
              ` : filteredSolicitudes.map(item => {
                const s = item.solicitud;
                const hasCountDiff = item.diferenciaConteo !== 0 || item.conteoEncontrado === 0;
                const docsWithIssue = item.hallazgos.filter(h => h.documentLink && h.documentLinkCanOpen);

                return `
                  <tr style="cursor: pointer;" class="solicitud-row" data-id="${item.solicitudId}">
                    <td>
                      <div style="font-weight: 700; color: #1e293b;">${item.solicitudId}</div>
                      <div style="font-size: 11px; color: #64748b;">Fila #${s._rowIndex}</div>
                    </td>
                    <td>
                      <div class="tooltip-container">
                        <span style="font-weight: 600;">${s.tipoCredito.normalized || 'Por revisar'}</span>
                        <span class="tooltip-text">Original: "${s.tipoCredito.raw}"</span>
                      </div>
                    </td>
                    <td>
                      <div>${s.fechaRegistro.normalized || '<span style="color:#d97706;">Ambigua</span>'}</div>
                      ${s.fechaRegistro.status === 'ambiguous' ? `<div style="font-size: 10px; color: #d97706;">(${s.fechaRegistro.raw})</div>` : ''}
                    </td>
                    <td>
                      <div style="font-weight: 600;">${formatCurrency(s.montoSolicitado.normalized)}</div>
                    </td>
                    <td>
                      <span class="badge ${hasCountDiff ? (item.conteoEncontrado === 0 ? 'badge-rose' : 'badge-amber') : 'badge-emerald'}">
                        ${(item.conteoReportado !== null && item.conteoReportado !== undefined ? item.conteoReportado : '?')} rep. / ${item.conteoEncontrado} enc.
                      </span>
                    </td>
                    <td>
                      ${item.hallazgos.length === 0 ? `
                        <span class="badge badge-emerald">${getIcon('checkCircle', 'w-3 h-3')} Sin hallazgos</span>
                      ` : `
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                          <span class="badge ${item.severidadMaxima === 'Bloqueante / Alta' ? 'badge-rose' : 'badge-amber'}">
                            ${item.hallazgos.length} novedad(es)
                          </span>
                        </div>
                      `}
                    </td>
                    <td onclick="event.stopPropagation();">
                      ${docsWithIssue.length > 0 ? `
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                          ${docsWithIssue.slice(0, 2).map(d => `
                            <a href="${d.documentLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 2px 6px;" title="Abrir soporte ${d.documentoId} en pestaña nueva">
                              ${getIcon('externalLink', 'w-3 h-3 text-blue-600')}
                              <span>${d.documentoId}</span>
                            </a>
                          `).join('')}
                          ${docsWithIssue.length > 2 ? `<span style="font-size: 10px; color: #64748b;">+${docsWithIssue.length - 2} más</span>` : ''}
                        </div>
                      ` : `<span style="color: #94a3b8; font-size: 12px;">—</span>`}
                    </td>
                    <td style="text-align: center;" onclick="event.stopPropagation();">
                      <button class="btn btn-secondary btn-sm btn-open-drawer" data-id="${item.solicitudId}" title="Ver detalle exhaustivo de la solicitud">
                        ${getIcon('eye', 'w-3 h-3')}
                        <span>Ver detalle</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;
}

function renderOrphanDocumentsSection() {
  const orphans = state.batchAnalysis.orphanDocuments;
  return `
    <div class="card" style="padding: 20px;">
      <div class="card-header">
        <h3 class="card-title">
          ${getIcon('alertTriangle', 'w-5 h-5 text-amber-600')}
          <span>Documentos Huérfanos en Matriz Documental (${orphans.length})</span>
        </h3>
        <span class="badge badge-amber">Requiere verificación de radicado</span>
      </div>
      <p style="color: var(--text-muted); margin-bottom: 16px;">
        Los siguientes registros se encuentran en el archivo de Matriz Documental, pero su <code>solicitudId</code> no existe en el libro de Radicados.
      </p>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fila Matriz</th>
              <th>ID Solicitud Reportado</th>
              <th>ID Documento</th>
              <th>Tipo de Documento</th>
              <th>Nombre de Archivo</th>
              <th>Estado de Enlace</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${orphans.map(item => {
              const d = item.documento;
              return `
                <tr>
                  <td>#${d._rowIndex}</td>
                  <td><strong style="color: #e11d48;">${d.solicitudId.raw || 'N/A'}</strong></td>
                  <td><strong>${d.documentoId.raw || 'N/A'}</strong></td>
                  <td>${d.tipoDocumento.raw || 'N/A'}</td>
                  <td>${((d.nombreArchivo && d.nombreArchivo.raw) ? d.nombreArchivo.raw : "N/A")}</td>
                  <td>
                    <span class="badge ${d.linkResolution.canOpen ? 'badge-emerald' : 'badge-rose'}">
                      ${d.linkResolution.label}
                    </span>
                  </td>
                  <td>
                    ${d.linkResolution.canOpen ? `
                      <a href="${d.linkResolution.resolvedUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                        ${getIcon('externalLink', 'w-3 h-3 text-blue-600')}
                        <span>Abrir fuente ↗</span>
                      </a>
                    ` : `
                      <span class="badge badge-neutral">Sin enlace</span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------------
 * Panel Lateral (Slide-over / Drawer)
 * ---------------------------------------------------------------------------
 */
function renderDrawer() {
  const sId = state.selectedSolicitudId;
  const isOpen = Boolean(sId);
  const solicitudAnalysis = isOpen ? state.batchAnalysis.solicitudes.find(s => s.solicitudId === sId) : null;

  if (!isOpen || !solicitudAnalysis) {
    return `<div class="drawer-backdrop" id="drawer-backdrop"><div class="drawer-panel"></div></div>`;
  }

  const s = solicitudAnalysis.solicitud;
  const docs = solicitudAnalysis.documentos;
  const findings = solicitudAnalysis.hallazgos;

  return `
    <div class="drawer-backdrop open" id="drawer-backdrop">
      <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        
        <!-- Header Drawer -->
        <div class="drawer-header">
          <div>
            <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Detalle de Solicitud</div>
            <h2 id="drawer-title" style="font-size: 18px; font-weight: 700; color: #0f172a;">${solicitudAnalysis.solicitudId}</h2>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px;">
            <select class="form-select form-select-sm" id="drawer-review-state-select" data-id="${solicitudAnalysis.solicitudId}">
              <option value="Por revisar" ${solicitudAnalysis.reviewState === 'Por revisar' ? 'selected' : ''}>Por revisar</option>
              <option value="Verificado" ${solicitudAnalysis.reviewState === 'Verificado' ? 'selected' : ''}>Verificado</option>
              <option value="Requiere acción" ${solicitudAnalysis.reviewState === 'Requiere acción' ? 'selected' : ''}>Requiere acción</option>
              <option value="No verificable" ${solicitudAnalysis.reviewState === 'No verificable' ? 'selected' : ''}>No verificable</option>
            </select>
            <button class="btn btn-secondary btn-sm" id="btn-close-drawer" title="Cerrar panel (Esc)">
              ${getIcon('x', 'w-4 h-4')}
            </button>
          </div>
        </div>

        <!-- Cuerpo Drawer -->
        <div class="drawer-body">
          
          <!-- SECCIÓN A: Comparativa Dual de Datos del Radicado -->
          <div style="margin-bottom: 28px;">
            <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              ${getIcon('fileText', 'w-4 h-4 text-blue-600')}
              <span>Sección A: Comparativa de Datos del Radicado (Original vs. Normalizado)</span>
            </h3>

            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Valor Original (Excel)</th>
                    <th>Valor Normalizado</th>
                    <th>Nota de Trazabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>ID Solicitud</strong></td>
                    <td>${(s.solicitudId.raw !== null && s.solicitudId.raw !== undefined ? s.solicitudId.raw : '—')}</td>
                    <td><code>${(s.solicitudId.normalized !== null && s.solicitudId.normalized !== undefined ? s.solicitudId.normalized : '—')}</code></td>
                    <td><span class="badge badge-emerald">Validado</span></td>
                  </tr>
                  <tr>
                    <td><strong>Tipo de Crédito</strong></td>
                    <td>${(s.tipoCredito.raw !== null && s.tipoCredito.raw !== undefined ? s.tipoCredito.raw : '—')}</td>
                    <td><strong style="color: #2563eb;">${(s.tipoCredito.normalized !== null && s.tipoCredito.normalized !== undefined ? s.tipoCredito.normalized : '—')}</strong></td>
                    <td><span style="font-size: 11px; color: #475569;">${s.tipoCredito.mappingNote || 'Directo'}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Fecha Registro</strong></td>
                    <td>${(s.fechaRegistro.raw !== null && s.fechaRegistro.raw !== undefined ? s.fechaRegistro.raw : '—')}</td>
                    <td><code>${(s.fechaRegistro.normalized !== null && s.fechaRegistro.normalized !== undefined ? s.fechaRegistro.normalized : 'No determinado')}</code></td>
                    <td>
                      <span class="badge ${s.fechaRegistro.status === 'valid' ? 'badge-emerald' : 'badge-amber'}">
                        ${s.fechaRegistro.mappingNote || s.fechaRegistro.status}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Hora Registro</strong></td>
                    <td>${(s.horaRegistro && s.horaRegistro.raw !== null ? s.horaRegistro.raw : '—')}</td>
                    <td><code>${(s.horaRegistro && s.horaRegistro.normalized !== null ? s.horaRegistro.normalized : 'No registrada')}</code></td>
                    <td><span style="font-size: 11px; color: #64748b;">${((s.horaRegistro && s.horaRegistro.mappingNote) ? s.horaRegistro.mappingNote : "Opcional")}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Monto Solicitado</strong></td>
                    <td>${(s.montoSolicitado.raw !== null && s.montoSolicitado.raw !== undefined ? s.montoSolicitado.raw : '—')}</td>
                    <td><strong style="color: #059669;">${formatCurrency(s.montoSolicitado.normalized)}</strong></td>
                    <td><span style="font-size: 11px; color: #64748b;">${s.montoSolicitado.mappingNote || 'Exacto'}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Estado Origen</strong></td>
                    <td>${(s.estado.raw !== null && s.estado.raw !== undefined ? s.estado.raw : '—')}</td>
                    <td><span class="badge badge-neutral">${(s.estado.normalized !== null && s.estado.normalized !== undefined ? s.estado.normalized : '—')}</span></td>
                    <td><span style="font-size: 11px; color: #64748b;">${s.estado.mappingNote || 'Directo'}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Canal</strong></td>
                    <td>${(s.canal && s.canal.raw !== null ? s.canal.raw : '—')}</td>
                    <td>${(s.canal && s.canal.normalized !== null ? s.canal.normalized : 'No especificado')}</td>
                    <td><span style="font-size: 11px; color: #64748b;">${((s.canal && s.canal.mappingNote) ? s.canal.mappingNote : "Opcional")}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Cantidad Soportes Reportada</strong></td>
                    <td>${(s.cantidadSoportesReportada.raw !== null && s.cantidadSoportesReportada.raw !== undefined ? s.cantidadSoportesReportada.raw : '—')}</td>
                    <td><strong style="font-size: 14px;">${(s.cantidadSoportesReportada.normalized !== null && s.cantidadSoportesReportada.normalized !== undefined ? s.cantidadSoportesReportada.normalized : 0)}</strong></td>
                    <td><span style="font-size: 11px; color: #64748b;">En matriz se encontraron: ${docs.length}</span></td>
                  </tr>
                  <tr>
                    <td><strong>Observaciones</strong></td>
                    <td colspan="3"><em style="color: #334155;">${((s.observaciones && s.observaciones.raw) ? s.observaciones.raw : "Sin observaciones registradas.")}</em></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- SECCIÓN B: Soportes en Matriz Documental -->
          <div style="margin-bottom: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px;">
                ${getIcon('layers', 'w-4 h-4 text-emerald-600')}
                <span>Sección B: Soportes en Matriz Documental (${docs.length})</span>
              </h3>
              <span class="badge ${solicitudAnalysis.diferenciaConteo === 0 && docs.length > 0 ? 'badge-emerald' : 'badge-amber'}">
                ${s.cantidadSoportesReportada.normalized} reportados vs ${docs.length} encontrados
              </span>
            </div>

            ${docs.length === 0 ? `
              <div style="padding: 18px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; color: #9f1239;">
                <strong>Faltante Crítico:</strong> Esta solicitud no tiene ninguna fila de soporte registrada en la Matriz Documental.
              </div>
            ` : docs.map(doc => {
              const lr = doc.linkResolution;
              return `
                <div class="support-card">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <div>
                      <div style="font-weight: 700; color: #0f172a; font-size: 14px;">
                        ${doc.tipoDocumento.raw || 'Soporte sin categoría'}
                      </div>
                      <div style="font-size: 12px; color: #64748b;">
                        ID: <code>${doc.documentoId.raw || 'N/A'}</code> · Archivo: <em>${((doc.nombreArchivo && doc.nombreArchivo.raw) ? doc.nombreArchivo.raw : "No especificado")}</em>
                      </div>
                    </div>

                    <span class="badge ${lr.status === 'PLAUSIBLE_URL' ? 'badge-emerald' : (lr.status === 'PLAUSIBLE_DRIVE_ID' ? 'badge-indigo' : 'badge-rose')}">
                      ${lr.label}
                    </span>
                  </div>

                  <div style="font-size: 11px; color: #64748b; margin-bottom: 10px;">
                    ${lr.notes}
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <div>
                      ${lr.canOpen ? `
                        <a href="${lr.resolvedUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                          ${getIcon('externalLink', 'w-3 h-3')}
                          <span>Abrir documento fuente ↗</span>
                        </a>
                      ` : `
                        <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.6;">
                          Sin enlace de documento fuente
                        </button>
                      `}
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px;">
                      <label style="font-size: 11px; font-weight: 500; color: #475569;">Verificación en sesión:</label>
                      <select class="form-select doc-review-select" data-doc-id="${doc.documentoId.raw}" style="font-size: 11px; padding: 3px 6px;">
                        <option value="Sin revisar" ${doc.userReviewStatus === 'Sin revisar' ? 'selected' : ''}>Sin revisar</option>
                        <option value="Abierto y legible" ${doc.userReviewStatus === 'Abierto y legible' ? 'selected' : ''}>Abierto y legible</option>
                        <option value="Enlace sin permisos / roto" ${doc.userReviewStatus === 'Enlace sin permisos / roto' ? 'selected' : ''}>Enlace sin permisos / roto</option>
                        <option value="Ilegible o incompleto" ${doc.userReviewStatus === 'Ilegible o incompleto' ? 'selected' : ''}>Ilegible o incompleto</option>
                      </select>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- SECCIÓN C: Hallazgos y Novedades Detectadas -->
          <div>
            <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 12px; color: #0f172a; display: flex; align-items: center; gap: 8px;">
              ${getIcon('alertTriangle', 'w-4 h-4 text-rose-600')}
              <span>Sección C: Hallazgos y Novedades Detectadas (${findings.length})</span>
            </h3>

            ${findings.length === 0 ? `
              <div style="padding: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; color: #065f46;">
                ${getIcon('checkCircle', 'w-5 h-5 text-emerald-600')}
                <span>No se identificaron novedades ni discrepancias estructurales para esta solicitud.</span>
              </div>
            ` : findings.map(f => {
              const sevClass = f.severity === 'Bloqueante / Alta' ? 'bloqueante' : (f.severity === 'Advertencia / Media' ? 'advertencia' : 'informativa');

              return `
                <div class="finding-card ${sevClass}">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <div>
                      <span class="badge ${f.severity === 'Bloqueante / Alta' ? 'badge-rose' : 'badge-amber'}" style="margin-bottom: 4px;">
                        ${f.severity}
                      </span>
                      <strong style="display: block; font-size: 14px; color: #0f172a;">${f.title}</strong>
                    </div>
                    <span class="badge badge-neutral">${f.category}</span>
                  </div>

                  <div style="font-size: 12px; color: #334155; margin-bottom: 8px;">
                    <strong>Regla evaluada:</strong> ${f.ruleCompared}
                  </div>

                  <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
                    <strong>Explicación:</strong> ${f.explanation}
                  </div>

                  <div style="font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px;">
                    <strong>Evidencia exacta:</strong> <code>${f.exactEvidence}</code>
                  </div>

                  <div style="font-size: 12px; color: #0369a1; margin-bottom: 12px;">
                    <strong>Acción sugerida:</strong> ${f.suggestedAction}
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div>
                      ${f.documentLink && f.documentLinkCanOpen ? `
                        <a href="${f.documentLink}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
                          ${getIcon('externalLink', 'w-3 h-3 text-blue-600')}
                          <span>Abrir documento de esta novedad ↗</span>
                        </a>
                      ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px;">
                      <label style="font-size: 11px; font-weight: 500;">Estado hallazgo:</label>
                      <select class="form-select form-select-sm finding-review-select" data-finding-id="${f.id}" style="font-size: 11px;">
                        <option value="Por revisar" ${f.reviewState === 'Por revisar' ? 'selected' : ''}>Por revisar</option>
                        <option value="Verificado" ${f.reviewState === 'Verificado' ? 'selected' : ''}>Verificado</option>
                        <option value="Requiere acción" ${f.reviewState === 'Requiere acción' ? 'selected' : ''}>Requiere acción</option>
                      </select>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

        </div>
      </div>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------------
 * Modales de Políticas, Limpieza y Pruebas
 * ---------------------------------------------------------------------------
 */
function renderConfigModal() {
  if (!state.modals.configOpen) return '';

  const cfg = state.ruleConfig;

  return `
    <div class="modal-backdrop open" id="modal-config-backdrop">
      <div class="modal-card" role="dialog" aria-labelledby="modal-config-title">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
          <h3 id="modal-config-title" style="font-size: 16px; font-weight: 700;">Configuración de Reglas del Fondo y SLA</h3>
          <button class="btn btn-secondary btn-sm" id="btn-close-config">${getIcon('x', 'w-4 h-4')}</button>
        </div>

        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
          Por defecto, todas las reglas de negocio dependientes de políticas internas se encuentran <strong>apagadas</strong> para evitar falsos positivos.
        </p>

        <!-- Toggle Modo Simulación -->
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600; color: #92400e;">
            <input type="checkbox" id="cfg-modo-simulacion" ${cfg.modoSimulacionActivo ? 'checked' : ''} />
            <span>Activar Modo Simulación / Taller (Reglas Ficticias)</span>
          </label>
          <div style="font-size: 11px; color: #b45309; margin-top: 4px; margin-left: 24px;">
            Muestra una barra superior visible de advertencia y etiqueta los hallazgos como [Regla de simulación].
          </div>
        </div>

        <!-- Toggle Documentos Obligatorios -->
        <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-bottom: 14px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600;">
            <input type="checkbox" id="cfg-doc-obligatorios" ${cfg.documentosObligatoriosActivo ? 'checked' : ''} />
            <span>Exigir Documentos Obligatorios por Tipo de Crédito</span>
          </label>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; margin-left: 24px;">
            Requiere Pagaré y Desprendible para Libranza y Libre Inversión.
          </div>
        </div>

        <!-- Toggle SLA -->
        <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; margin-bottom: 20px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; font-weight: 600;">
            <input type="checkbox" id="cfg-sla" ${cfg.slaAtencionActivo ? 'checked' : ''} />
            <span>Monitorear SLA de Atención (Horas máximas: 48h)</span>
          </label>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn-secondary" id="btn-cancel-config">Cancelar</button>
          <button class="btn btn-primary" id="btn-save-config">Guardar y Aplicar Reglas</button>
        </div>
      </div>
    </div>
  `;
}

function renderResetModal() {
  if (!state.modals.resetOpen) return '';

  return `
    <div class="modal-backdrop open" id="modal-reset-backdrop">
      <div class="modal-card" role="dialog" aria-labelledby="modal-reset-title">
        <h3 id="modal-reset-title" style="font-size: 16px; font-weight: 700; color: #9f1239; margin-bottom: 12px;">
          ¿Cerrar y Limpiar Lote Actual?
        </h3>
        <p style="font-size: 13px; color: #475569; margin-bottom: 16px;">
          Esta acción destruirá de forma segura todos los datos procesados en memoria (archivos subidos, mapeos y revisiones de sesión) y reiniciará la aplicación a su estado inicial.
        </p>

        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn-secondary" id="btn-cancel-reset">Cancelar</button>
          <button class="btn btn-danger" id="btn-confirm-reset">Sí, Destruir Datos y Reiniciar</button>
        </div>
      </div>
    </div>
  `;
}

function renderTestsModal() {
  if (!state.modals.testsOpen) return '';

  return `
    <div class="modal-backdrop open" id="modal-tests-backdrop">
      <div class="modal-card" style="max-width: 640px;" role="dialog" aria-labelledby="modal-tests-title">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
          <h3 id="modal-tests-title" style="font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            ${getIcon('checkCircle', 'w-5 h-5 text-emerald-600')}
            <span>Suite de Pruebas Unitarias Automatizadas</span>
          </h3>
          <button class="btn btn-secondary btn-sm" id="btn-close-tests">${getIcon('x', 'w-4 h-4')}</button>
        </div>

        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">
          Verificación exhaustiva de reglas deterministas, resolución de enlaces Google Drive, ambigüedad de fechas y guardrails normativos en el motor:
        </p>

        <div style="max-height: 380px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; background: #f8fafc; font-size: 12px; margin-bottom: 16px;">
          ${state.testResults.map(t => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">
              <span style="font-weight: 500;">${t.name}</span>
              ${t.passed 
                ? `<span class="badge badge-emerald">${getIcon('check', 'w-3 h-3')} PASÓ</span>`
                : `<span class="badge badge-rose">${getIcon('x', 'w-3 h-3')} FALLÓ: ${t.error}</span>`
              }
            </div>
          `).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; font-weight: 600; color: #065f46;">
            ${state.testResults.filter(t => t.passed).length} de ${state.testResults.length} pruebas superadas exitosamente.
          </span>
          <button class="btn btn-secondary" id="btn-close-tests-footer">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * ---------------------------------------------------------------------------
 * Gestión de Eventos y Manejadores
 * ---------------------------------------------------------------------------
 */
function addEventById(id, event, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

function attachEventHandlers() {
  // Botones de encabezado
  addEventById('btn-open-config', 'click', () => {
    state.modals.configOpen = true;
    render();
  });

  addEventById('btn-open-reset', 'click', () => {
    state.modals.resetOpen = true;
    render();
  });

  addEventById('btn-open-tests', 'click', () => {
    state.testResults = runAllUnitTests();
    state.modals.testsOpen = true;
    render();
  });

  addEventById('btn-load-demo', 'click', handleLoadDemo);
  addEventById('btn-quick-demo', 'click', handleLoadDemo);

  // Stepper navegación
  addEventById('nav-step-1', 'click', () => {
    state.step = 1;
    render();
  });
  addEventById('nav-step-2', 'click', () => {
    if (state.radicadoFile && state.documentoFile) {
      state.step = 2;
      render();
    }
  });
  addEventById('nav-step-3', 'click', () => {
    if (state.batchAnalysis) {
      state.step = 3;
      render();
    }
  });

  // Paso 1: Carga de archivos
  setupDropzone('dropzone-radicados', 'input-file-radicados', 'btn-select-radicados', 'btn-replace-radicados', handleRadicadosFile);
  setupDropzone('dropzone-documentos', 'input-file-documentos', 'btn-select-documentos', 'btn-replace-documentos', handleDocumentosFile);

  addEventById('btn-go-step-2', 'click', () => {
    state.step = 2;
    render();
  });

  // Paso 2: Hojas y mapeos
  addEventById('btn-back-step-1', 'click', () => {
    state.step = 1;
    render();
  });

  addEventById('select-sheet-radicados', 'change', (e) => {
    state.radicadoFile.activeSheet = e.target.value;
    const sheetData = extractSheetData(state.radicadoFile.workbook, state.radicadoFile.activeSheet);
    state.radicadoMapping = suggestColumnMapping(sheetData.headers, RADICADO_FIELDS);
    render();
  });

  addEventById('select-sheet-documentos', 'change', (e) => {
    state.documentoFile.activeSheet = e.target.value;
    const sheetData = extractSheetData(state.documentoFile.workbook, state.documentoFile.activeSheet);
    state.documentoMapping = suggestColumnMapping(sheetData.headers, DOCUMENTO_FIELDS);
    render();
  });

  document.querySelectorAll('.mapping-select-rad').forEach(select => {
    select.addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      const val = e.target.value || null;
      state.radicadoMapping[field] = {
        selectedColumn: val,
        isAmbiguous: false,
        confidence: 1.0
      };
      render();
    });
  });

  document.querySelectorAll('.mapping-select-doc').forEach(select => {
    select.addEventListener('change', (e) => {
      const field = e.target.dataset.field;
      const val = e.target.value || null;
      state.documentoMapping[field] = {
        selectedColumn: val,
        isAmbiguous: false,
        confidence: 1.0
      };
      render();
    });
  });

  addEventById('btn-analyze-batch', 'click', triggerBatchAnalysis);
  addEventById('btn-preflight-analyze', 'click', triggerBatchAnalysis);

  // Paso 3: Dashboard y Filtros
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.activeTab = e.currentTarget.dataset.tab;
      render();
    });
  });

  addEventById('search-input', 'input', (e) => {
    state.searchQuery = e.target.value;
    render();
  });

  addEventById('filter-credit-type', 'change', (e) => {
    state.filterCreditType = e.target.value;
    render();
  });

  addEventById('filter-severity', 'change', (e) => {
    state.filterSeverity = e.target.value;
    render();
  });

  addEventById('filter-review-state', 'change', (e) => {
    state.filterReviewState = e.target.value;
    render();
  });

  addEventById('btn-clear-filters', 'click', () => {
    state.searchQuery = '';
    state.filterCreditType = 'all';
    state.filterSeverity = 'all';
    state.filterReviewState = 'all';
    state.activeTab = 'todas';
    render();
  });

  document.querySelectorAll('.solicitud-row').forEach(row => {
    row.addEventListener('click', (e) => {
      state.selectedSolicitudId = e.currentTarget.dataset.id;
      render();
    });
  });

  document.querySelectorAll('.btn-open-drawer').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedSolicitudId = e.currentTarget.dataset.id;
      render();
    });
  });

  // Drawer handlers
  addEventById('btn-close-drawer', 'click', () => {
    state.selectedSolicitudId = null;
    render();
  });

  addEventById('drawer-backdrop', 'click', (e) => {
    if (e.target.id === 'drawer-backdrop') {
      state.selectedSolicitudId = null;
      render();
    }
  });

  addEventById('drawer-review-state-select', 'change', (e) => {
    const sId = e.target.dataset.id;
    const sol = state.batchAnalysis.solicitudes.find(s => s.solicitudId === sId);
    if (sol) {
      sol.reviewState = e.target.value;
      recalculateSummary();
      render();
    }
  });

  document.querySelectorAll('.doc-review-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const docId = e.target.dataset.docId;
      const sId = state.selectedSolicitudId;
      const sol = state.batchAnalysis.solicitudes.find(s => s.solicitudId === sId);
      if (sol) {
        const doc = sol.documentos.find(d => d.documentoId.raw === docId);
        if (doc) {
          doc.userReviewStatus = e.target.value;
        }
      }
    });
  });

  document.querySelectorAll('.finding-review-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const fId = e.target.dataset.findingId;
      const sId = state.selectedSolicitudId;
      const sol = state.batchAnalysis.solicitudes.find(s => s.solicitudId === sId);
      if (sol) {
        const f = sol.hallazgos.find(h => h.id === fId);
        if (f) {
          f.reviewState = e.target.value;
        }
      }
    });
  });

  // Modal Configuración
  addEventById('btn-close-config', 'click', () => {
    state.modals.configOpen = false;
    render();
  });
  addEventById('btn-cancel-config', 'click', () => {
    state.modals.configOpen = false;
    render();
  });
  addEventById('btn-save-config', 'click', () => {
    state.ruleConfig.modoSimulacionActivo = (document.getElementById('cfg-modo-simulacion') ? document.getElementById('cfg-modo-simulacion').checked : false);
    state.ruleConfig.documentosObligatoriosActivo = (document.getElementById('cfg-doc-obligatorios') ? document.getElementById('cfg-doc-obligatorios').checked : false);
    state.ruleConfig.slaAtencionActivo = (document.getElementById('cfg-sla') ? document.getElementById('cfg-sla').checked : false);
    state.modals.configOpen = false;

    // Si ya hay un lote analizado, reanalizar con las nuevas reglas
    if (state.batchAnalysis) {
      triggerBatchAnalysis();
    } else {
      render();
    }
  });

  // Modal Limpiar
  addEventById('btn-close-reset', 'click', () => {
    state.modals.resetOpen = false;
    render();
  });
  addEventById('btn-cancel-reset', 'click', () => {
    state.modals.resetOpen = false;
    render();
  });
  addEventById('btn-confirm-reset', 'click', handleResetSession);

  // Modal Tests
  addEventById('btn-close-tests', 'click', () => {
    state.modals.testsOpen = false;
    render();
  });
  addEventById('btn-close-tests-footer', 'click', () => {
    state.modals.testsOpen = false;
    render();
  });
}

function setupDropzone(dropzoneId, inputId, selectBtnId, replaceBtnId, fileHandler) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  const selectBtn = document.getElementById(selectBtnId);
  const replaceBtn = document.getElementById(replaceBtnId);

  if (!dropzone || !input) return;

  const openPicker = () => input.click();
  if (selectBtn) selectBtn.addEventListener('click', openPicker);
  if (replaceBtn) replaceBtn.addEventListener('click', openPicker);

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      fileHandler(e.dataTransfer.files[0]);
    }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileHandler(e.target.files[0]);
    }
  });
}

function handleRadicadosFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    alert('El archivo excede el tamaño máximo permitido de 25 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    const inspected = inspectWorkbook(buffer, file.name);
    state.radicadoFile = {
      name: file.name,
      size: file.size,
      buffer: buffer,
      workbook: inspected.workbook,
      sheetNames: inspected.sheetNames,
      activeSheet: inspected.activeSheetName
    };
    const sheetData = extractSheetData(inspected.workbook, inspected.activeSheetName);
    state.radicadoMapping = suggestColumnMapping(sheetData.headers, RADICADO_FIELDS);
    render();
  };
  reader.readAsArrayBuffer(file);
}

function handleDocumentosFile(file) {
  if (file.size > 25 * 1024 * 1024) {
    alert('El archivo excede el tamaño máximo permitido de 25 MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const buffer = e.target.result;
    const inspected = inspectWorkbook(buffer, file.name);
    state.documentoFile = {
      name: file.name,
      size: file.size,
      buffer: buffer,
      workbook: inspected.workbook,
      sheetNames: inspected.sheetNames,
      activeSheet: inspected.activeSheetName
    };
    const sheetData = extractSheetData(inspected.workbook, inspected.activeSheetName);
    state.documentoMapping = suggestColumnMapping(sheetData.headers, DOCUMENTO_FIELDS);
    render();
  };
  reader.readAsArrayBuffer(file);
}

function handleLoadDemo() {
  const demo = generateDemoWorkbooks();

  state.radicadoFile = {
    name: demo.radicados.fileName,
    size: demo.radicados.buffer.byteLength,
    buffer: demo.radicados.buffer,
    workbook: demo.radicados.workbook,
    sheetNames: [demo.radicados.activeSheet],
    activeSheet: demo.radicados.activeSheet
  };

  state.documentoFile = {
    name: demo.documentos.fileName,
    size: demo.documentos.buffer.byteLength,
    buffer: demo.documentos.buffer,
    workbook: demo.documentos.workbook,
    sheetNames: [demo.documentos.activeSheet],
    activeSheet: demo.documentos.activeSheet
  };

  const radSheetData = extractSheetData(state.radicadoFile.workbook, state.radicadoFile.activeSheet);
  state.radicadoMapping = suggestColumnMapping(radSheetData.headers, RADICADO_FIELDS);

  const docSheetData = extractSheetData(state.documentoFile.workbook, state.documentoFile.activeSheet);
  state.documentoMapping = suggestColumnMapping(docSheetData.headers, DOCUMENTO_FIELDS);

  // Analizar automáticamente el lote demo y pasar al dashboard
  triggerBatchAnalysis();
}

function triggerBatchAnalysis() {
  const radSheetData = extractSheetData(state.radicadoFile.workbook, state.radicadoFile.activeSheet);
  const docSheetData = extractSheetData(state.documentoFile.workbook, state.documentoFile.activeSheet);

  state.batchAnalysis = analyzeBatch(
    radSheetData.rows,
    state.radicadoMapping,
    docSheetData.rows,
    state.documentoMapping,
    state.ruleConfig
  );

  state.step = 3;
  render();
}

function handleResetSession() {
  // Destrucción estricta de variables en memoria
  state.step = 1;
  state.radicadoFile = null;
  state.documentoFile = null;
  state.radicadoMapping = {};
  state.documentoMapping = {};
  state.batchAnalysis = null;
  state.selectedSolicitudId = null;
  state.activeTab = 'todas';
  state.searchQuery = '';
  state.modals.resetOpen = false;
  state.modals.configOpen = false;
  state.modals.testsOpen = false;
  render();
}

function recalculateSummary() {
  if (!state.batchAnalysis) return;
  const sols = state.batchAnalysis.solicitudes;
  let pendientes = 0;
  let verificadas = 0;
  let requiereAccion = 0;
  let noVerificables = 0;

  sols.forEach(s => {
    if (s.reviewState === REVIEW_STATES.POR_REVISAR) pendientes++;
    else if (s.reviewState === REVIEW_STATES.VERIFICADO) verificadas++;
    else if (s.reviewState === REVIEW_STATES.REQUIERE_ACCION) requiereAccion++;
    else if (s.reviewState === REVIEW_STATES.NO_VERIFICABLE) noVerificables++;
  });

  state.batchAnalysis.summary.revisionesPendientes = pendientes;
  state.batchAnalysis.summary.revisionesVerificadas = verificadas;
  state.batchAnalysis.summary.revisionesRequiereAccion = requiereAccion;
  state.batchAnalysis.summary.revisionesNoVerificable = noVerificables;
}

/**
 * ---------------------------------------------------------------------------
 * Filtros y Helpers
 * ---------------------------------------------------------------------------
 */
function getFilteredSolicitudes() {
  if (!state.batchAnalysis) return [];
  let list = state.batchAnalysis.solicitudes;

  // Filtro por pestaña rápida
  if (state.activeTab === 'discrepancia') {
    list = list.filter(s => s.diferenciaConteo !== 0 || s.conteoEncontrado === 0);
  } else if (state.activeTab === 'enlaces_invalidos') {
    list = list.filter(s => s.hallazgos.some(h => h.category === 'Enlace no disponible'));
  } else if (state.activeTab === 'pendientes') {
    list = list.filter(s => s.reviewState === REVIEW_STATES.POR_REVISAR);
  } else if (state.activeTab === 'verificados') {
    list = list.filter(s => s.reviewState === REVIEW_STATES.VERIFICADO);
  }

  // Filtro por texto
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase().trim();
    list = list.filter(item => {
      const idMatch = item.solicitudId.toLowerCase().includes(q);
      const obsMatch = ((item.solicitud.observaciones && item.solicitud.observaciones.raw) ? item.solicitud.observaciones.raw : "").toLowerCase().includes(q);
      const tipoMatch = (item.solicitud.tipoCredito.normalized || '').toLowerCase().includes(q);
      const montoMatch = String(item.solicitud.montoSolicitado.raw || '').toLowerCase().includes(q);
      return idMatch || obsMatch || tipoMatch || montoMatch;
    });
  }

  // Filtro por tipo de crédito
  if (state.filterCreditType !== 'all') {
    list = list.filter(item => item.solicitud.tipoCredito.normalized === state.filterCreditType);
  }

  // Filtro por severidad máxima
  if (state.filterSeverity !== 'all') {
    list = list.filter(item => item.severidadMaxima === state.filterSeverity);
  }

  // Filtro por estado de revisión
  if (state.filterReviewState !== 'all') {
    list = list.filter(item => item.reviewState === state.filterReviewState);
  }

  return list;
}

function getUniqueCreditTypes() {
  if (!state.batchAnalysis) return [];
  const types = new Set();
  state.batchAnalysis.solicitudes.forEach(s => {
    if (s.solicitud.tipoCredito.normalized) {
      types.add(s.solicitud.tipoCredito.normalized);
    }
  });
  return Array.from(types).sort();
}

function getSolicitudesWithMissingLinksCount() {
  if (!state.batchAnalysis) return 0;
  return state.batchAnalysis.solicitudes.filter(s => 
    s.hallazgos.some(h => h.category === 'Enlace no disponible')
  ).length;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return '$ ' + Number(amount).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}



  // Inicialización automática al cargar el documento con captura de errores
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  } catch (err) {
    console.error('Error en inicialización:', err);
    var root = document.getElementById('app-root');
    if (root) {
      root.innerHTML = '<div style="padding: 30px; font-family: sans-serif; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; margin: 20px;"><h2 style="color: #9f1239;">Error al inicializar la aplicación</h2><p style="color: #475569;">' + (err.message || String(err)) + '</p></div>';
    }
  }
})();
