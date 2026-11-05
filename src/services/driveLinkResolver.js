/**
 * driveLinkResolver.js
 * 
 * Validador y constructor seguro de enlaces hacia documentos fuente.
 * Cumple estrictamente con el Guardrail de Honestidad Documental:
 * Jamás afirma que un documento fue "verificado" o "abierto" automáticamente sin inspección.
 */

import { LINK_STATUS } from '../domain/types.js';

const GOOGLE_DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{25,50}$/;

/**
 * Resuelve y valida el valor de urlOIdFuente
 * @param {string|number|null} rawValue 
 * @returns {import('../domain/types').DriveLinkResolution}
 */
export function resolveDriveLink(rawValue) {
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
