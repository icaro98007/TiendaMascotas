from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import os

SPREADSHEET_ID = "1s88JU2SGM3Rtg0uDZNgbDpqFCtgFxWcXdr-1TzeOeeE"

def run_cmd(args):
    cmd = ["gsheets"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.returncode == 0, result.stdout, result.stderr

class SyncHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "online", "sheetId": SPREADSHEET_ID}).encode())

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            print("Datos recibidos para sincronizar...")
            
            # 1. Sincronizar Inventario
            if "tables" in data and "inventario" in data["tables"]:
                prods = data["tables"]["inventario"]
                inv_rows = ["ID,Producto,Categoría,Precio COP,Stock Actual,Stock Mínimo,Estado Semáforo"]
                for p in prods:
                    nombre = str(p.get("nombre", "")).replace(",", " ")
                    cat = str(p.get("categoria", "")).replace(",", " ")
                    inv_rows.append(f"{p.get('id')},{nombre},{cat},{p.get('precio')},{p.get('stock_actual')},{p.get('stock_minimo')},{p.get('estado')}")
                
                inv_data = "|".join(inv_rows)
                end_row = len(inv_rows)
                run_cmd(["mutate", "write", SPREADSHEET_ID, f"Inventario!A1:G{end_row}", inv_data])
                print(f" -> Inventario actualizado ({len(prods)} productos)")

            # 2. Sincronizar Clientes
            if "tables" in data and "clientes" in data["tables"]:
                clis = data["tables"]["clientes"]
                cli_rows = ["ID,Nombre Completo,Teléfono Contacto,Compras Realizadas,Total Gastado COP,Fecha Registro"]
                for c in clis:
                    nombre = str(c.get("nombre", "")).replace(",", " ")
                    tel = str(c.get("contacto", "")).replace(",", " ")
                    cli_rows.append(f"{c.get('id')},{nombre},'{tel},{c.get('tickets_totales')},{c.get('gasto_total')},{c.get('fecha_registro')}")
                
                cli_data = "|".join(cli_rows)
                end_row = len(cli_rows)
                run_cmd(["mutate", "write", SPREADSHEET_ID, f"Clientes!A1:F{end_row}", cli_data])
                print(f" -> Clientes actualizados ({len(clis)} clientes)")

            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode())
        except Exception as e:
            print("Error en sincronización:", e)
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

def run_server(port=5005):
    server = HTTPServer(('127.0.0.1', port), SyncHandler)
    print(f"Servidor de Sincronización Huellitas POS iniciado en http://127.0.0.1:{port}")
    server.serve_forever()

if __name__ == "__main__":
    run_server()
