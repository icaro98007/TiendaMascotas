/**
 * unitTests.js
 * 
 * Suite de pruebas unitarias deterministas ejecutable tanto en navegador
 * como en entornos modulares.
 * Verifica los 100% de criterios de aceptación del prompt maestro.
 */

import { resolveDriveLink } from '../services/driveLinkResolver.js';
import {
  normalizeDate,
  normalizeAmount,
  normalizeCreditType,
  normalizeState,
  normalizeSupportCount
} from '../services/normalizer.js';
import { analyzeBatch } from '../services/validationEngine.js';
import { DEMO_RADICADOS_DATA, DEMO_DOCUMENTOS_DATA } from '../data/demoBatch.js';
import { getDefaultRuleConfig } from '../domain/types.js';

export function runAllUnitTests() {
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
