/**
 * excelParser.js
 * 
 * Servicio para lectura, inspección de hojas, extracción de encabezados,
 * sugerencia asistida de mapeo por sinónimos y pre-flight check.
 * Usa la librería XLSX (SheetJS) ejecutándose en memoria.
 */

// Definición de campos esperados y sus sinónimos para heurística
export const RADICADO_FIELDS = [
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

export const DOCUMENTO_FIELDS = [
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
export function inspectWorkbook(buffer, fileName) {
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
export function extractSheetData(workbook, sheetName) {
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
export function suggestColumnMapping(availableHeaders, schemaFields) {
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
export function runPreFlightCheck(radicadoData, radicadoMapping, documentoData, documentoMapping) {
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
