import http.server
import socketserver
import os
import sys

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_FILE = os.path.join(DIRECTORY, "dashboard_iot.html")

class UniversalDashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        clean_path = self.path.split('?')[0].lstrip('/')
        target_path = os.path.join(DIRECTORY, clean_path)

        # Si piden la raíz o un archivo que no existe, responder con dashboard_iot.html
        if not clean_path or not os.path.exists(target_path) or os.path.isdir(target_path):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            with open(DASHBOARD_FILE, "rb") as f:
                data = f.read()
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        return super().do_GET()

if __name__ == '__main__':
    selected_port = 3000
    server = None
    for port in [3000, 5000, 8080, 8000, 5050]:
        try:
            # Reusar dirección para evitar esperas TIME_WAIT
            socketserver.TCPServer.allow_reuse_address = True
            server = socketserver.TCPServer(("0.0.0.0", port), UniversalDashboardHandler)
            selected_port = port
            break
        except OSError as e:
            continue

    if not server:
        print("ERROR: No se pudo enlazar ningún puerto.", file=sys.stderr)
        sys.exit(1)

    print("=" * 60)
    print(f"SERVIDOR LOCAL IOT ACTIVO EN: http://localhost:{selected_port}")
    print("=" * 60)
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()
        sys.exit(0)
