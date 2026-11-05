/**
 * validationEngine.js
 * 
 * Motor determinista de análisis y validación documental.
 * Cruza los Radicados vs. la Matriz Documental ejecutando las reglas estructurales
 * obligatorias y las reglas opcionales de política cuando estén configuradas.
 */

import { FINDING_CATEGORIES, FINDING_SEVERITY, REVIEW_STATES } from '../domain/types.js';
import { resolveDriveLink } from './driveLinkResolver.js';
import {
  normalizeCreditType,
  normalizeDate,
  normalizeTime,
  normalizeAmount,
  normalizeState,
  normalizeChannel,
  normalizeSupportCount,
  normalizeString
} from './normalizer.js';

let findingCounter = 0;
function nextFindingId(prefix = 'HLZ') {
  findingCounter++;
  return `${prefix}-${String(findingCounter).padStart(4, '0')}`;
}

export function resetFindingCounter() {
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
export function analyzeBatch(rawRadicados, radicadoMapping, rawDocumentos, documentoMapping, ruleConfig) {
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
