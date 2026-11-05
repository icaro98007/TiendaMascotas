/**
 * exportAdapter.js
 * Adaptador nulo desacoplado para futuros módulos (sin botones en UI).
 */

export class NullExportAdapter {
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
