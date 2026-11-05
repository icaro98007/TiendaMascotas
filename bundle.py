#!/usr/bin/env python3
"""
bundle.py - Empaquetador autónomo de cero dependencias.
Convierte los módulos ES de src/ en un único archivo app.js autocontenido (IIFE)
para que funcione inmediatamente al hacer doble clic sobre index.html (protocolo file://)
sin sufrir bloqueo por CORS del navegador.
"""

import os
import re

SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

FILES_IN_ORDER = [
    'domain/types.js',
    'services/driveLinkResolver.js',
    'services/normalizer.js',
    'services/excelParser.js',
    'services/validationEngine.js',
    'services/exportAdapter.js',
    'data/demoBatch.js',
    'tests/unitTests.js',
    'ui/icons.js',
    'ui/app.js'
]

def clean_module_code(code: str) -> str:
    # Remover declaraciones de import (tanto de una línea como multilínea)
    code = re.sub(r'import\s+[\s\S]*?from\s+[\'"].*?[\'"];?\n?', '', code)
    code = re.sub(r'import\s+[\'"].*?[\'"];?\n?', '', code)
    # Reemplazar export function / export const / export let por function / const / let
    code = re.sub(r'export\s+(const|let|var|function|class)\s+', r'\1 ', code)
    # Remover export default
    code = re.sub(r'export\s+default\s+.*?;?\n?', '', code)
    # Remover export { ... }
    code = re.sub(r'export\s*\{[\s\S]*?\};?\n?', '', code)
    return code

def main():
    combined_parts = []
    combined_parts.append("/**\n * app.js - Bundle autocontenido para ejecución directa (file:// y http://)\n * Generado para compatibilidad total con doble clic en navegador.\n */\n(function() {\n  'use strict';\n")

    for rel_path in FILES_IN_ORDER:
        full_path = os.path.join(SRC_DIR, rel_path)
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        cleaned = clean_module_code(content)
        combined_parts.append(f"\n  // ==========================================\n  // Módulo: {rel_path}\n  // ==========================================\n")
        # Indentar ligeramente para claridad
        combined_parts.append(cleaned + "\n")

    combined_parts.append("""
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
""")

    output_path = os.path.join(ROOT_DIR, 'app.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(combined_parts))
    
    print(f"Bundle generado con éxito en: {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == '__main__':
    main()
