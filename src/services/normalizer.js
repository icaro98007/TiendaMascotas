/**
 * normalizer.js
 * 
 * Funciones puras para normalizar fechas, horas, montos y catálogos
 * manteniendo intacto el valor original (raw) en una estructura DualValue<T>.
 */

import { createDualValue } from '../domain/types.js';

/**
 * Normaliza fechas sin adivinar formatos ambiguos.
 * @param {any} rawValue 
 * @returns {import('../domain/types').DualValue<string>}
 */
export function normalizeDate(rawValue) {
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
export function normalizeTime(rawValue) {
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
export function normalizeAmount(rawValue) {
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
export function normalizeCreditType(rawValue) {
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
export function normalizeState(rawValue) {
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
export function normalizeChannel(rawValue) {
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
export function normalizeString(rawValue, fieldName = 'campo') {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', `${fieldName} ausente o vacío`);
  }
  const clean = String(rawValue).trim();
  return createDualValue(rawValue, clean, 'valid', 'Texto limpio');
}

/**
 * Normaliza cantidad de soportes reportados (número entero >= 0)
 */
export function normalizeSupportCount(rawValue) {
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return createDualValue(rawValue, null, 'empty', 'Cantidad de soportes ausente');
  }

  const num = parseInt(rawValue, 10);
  if (isNaN(num) || num < 0) {
    return createDualValue(rawValue, null, 'ambiguous', 'Valor de cantidad de soportes inválido (debe ser entero ≥ 0)');
  }

  return createDualValue(rawValue, num, 'valid', 'Entero normalizado');
}
