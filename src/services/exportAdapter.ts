/**
 * exportAdapter.ts
 * 
 * Interfaz interna desacoplada para futuros adaptadores de salida.
 * 
 * GUARDRAIL ESTRICTO:
 * La aplicación NO genera ni descarga informes, PDF, Word, Excel ni CSV.
 * Este archivo define exclusivamente la firma de contrato arquitectónico sin
 * exponer ningún botón, evento ni ejecución activa en la interfaz de usuario.
 */

export interface ExportAdapter {
  id: string;
  name: string;
  format: 'json' | 'parquet' | 'database';
  exportBatch(batchData: any): Promise<{ success: boolean; message: string }>;
}

export class NullExportAdapter implements ExportAdapter {
  id = 'null-adapter';
  name = 'Adaptador Nulo (En Pantalla Exclusivo)';
  format: 'json' = 'json';

  async exportBatch(_batchData: any) {
    // Por diseño estricto de guardrail, los datos residen exclusivamente en memoria de pantalla.
    return {
      success: true,
      message: 'Operación desacoplada: No se generan archivos externos por política de privacidad.'
    };
  }
}
