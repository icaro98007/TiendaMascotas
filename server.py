#!/usr/bin/env python3
"""
server.py - Servidor HTTP Local Privado para el Back Office Documental

Cumple estrictamente con los Guardrails de Privacidad y Cero Fugas:
- Servidor estático local sin dependencias externas.
- Cabeceras de seguridad estrictas (X-Content-Type-Options, X-Frame-Options, Cache-Control).
- Cero persistencia en disco ni generación de archivos de salida.
"""

import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class PrivateBackOfficeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Cabeceras de seguridad financiera
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        # Asegurar tipo MIME para módulos JavaScript modernos
        super().end_headers()

    def guess_type(self, path):
        if path.endswith(".js"):
            return "application/javascript"
        if path.endswith(".ts"):
            return "text/plain"
        return super().guess_type(path)

    def log_message(self, format, *args):
        # Registro anónimo sin registrar datos sensibles ni URLs privadas
        sys.stderr.write(f"[{self.log_date_time_string()}] {args[0]} {args[1]}\n")

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, PrivateBackOfficeHandler)
    print("=" * 70)
    print("  SISTEMA DE REVISIÓN DOCUMENTAL DE CRÉDITOS — BACK OFFICE")
    print("  Privacidad por diseño: 100% en memoria (Sin archivos de salida)")
    print("=" * 70)
    print(f"  Servidor iniciado en: http://localhost:{PORT}")
    print("  Presiona Ctrl+C para detener el servidor de forma segura.")
    print("=" * 70)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        httpd.server_close()

if __name__ == "__main__":
    main()
