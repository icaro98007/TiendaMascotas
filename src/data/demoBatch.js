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

export const DEMO_RADICADOS_DATA = [
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

export const DEMO_DOCUMENTOS_DATA = [
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
export function generateDemoWorkbooks() {
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
