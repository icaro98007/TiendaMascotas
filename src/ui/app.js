/**
 * app.js
 * 
 * Controlador Principal y Renderizador de la Aplicación de Revisión Documental de Créditos.
 * Arquitectura 100% modular, reactiva en memoria y con cero dependencias de salida.
 */

import { getIcon } from './icons.js';
import {
  RADICADO_FIELDS,
  DOCUMENTO_FIELDS,
  inspectWorkbook,
  extractSheetData,
  suggestColumnMapping,
  runPreFlightCheck
} from '../services/excelParser.js';
import { analyzeBatch } from '../services/validationEngine.js';
import { generateDemoWorkbooks } from '../data/demoBatch.js';
import { getDefaultRuleConfig, REVIEW_STATES, DOCUMENT_REVIEW_STATUS } from '../domain/types.js';
import { runAllUnitTests } from '../tests/unitTests.js';

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
export function initApp() {
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
export function render() {
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
