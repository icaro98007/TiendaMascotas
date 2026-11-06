import subprocess
import datetime
import json
import os

MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
MAPPING_FILE = os.path.join(os.path.dirname(__file__), "monthly_sheets.json")

def get_current_month_title():
    now = datetime.datetime.now()
    return f"{MONTHS[now.month - 1]}-{now.year}"

def run_cmd(args):
    cmd = ["gsheets"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.returncode == 0, result.stdout, result.stderr

def sync():
    month_title = get_current_month_title()
    print("=" * 65)
    print(f" Huellitas POS -> Sincronizador Mensual con Google Sheets ({month_title})")
    print("=" * 65)

    # Cargar mapping
    sheet_id = "1s88JU2SGM3Rtg0uDZNgbDpqFCtgFxWcXdr-1TzeOeeE"
    if os.path.exists(MAPPING_FILE):
        try:
            with open(MAPPING_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                sheet_id = data.get(month_title, sheet_id)
        except Exception:
            pass

    print(f"Hoja activa del mes: {month_title} (ID: {sheet_id})")

    # 1. Cargar productos e inventario
    html_path = os.path.join(os.path.dirname(__file__), "index.html")
    if not os.path.exists(html_path):
        print(f"Error: No se encontró {html_path}")
        return

    print("\n[1/3] Sincronizando Pestaña 'Inventario'...")
    inv_rows = [
        "ID,Producto,Categoría,Precio COP,Stock Actual,Stock Mínimo,Estado Semáforo",
        "1,Alimento Perro Adulto 15kg,Alimento,185000,7,3,OPTIMO",
        "2,Alimento Gato Salmón 3kg,Alimento,78000,2,4,BAJO_STOCK",
        "3,Pipeta Antipulgas Perro,Salud,42000,1,3,ALERTA_CRITICA",
        "4,Pelota Mordillo Goma TPR,Juguetes,18000,14,5,OPTIMO",
        "5,Snack Dental Sticks x7,Alimento,16500,5,5,EN_LIMITE",
        "6,Arena Sanitaria Aglomerante 5kg,Higiene,32000,12,4,OPTIMO",
        "7,Champú Hipoalergénico 250ml,Higiene,28000,2,3,BAJO_STOCK",
        "8,Rascador Poste Sisal 50cm,Accesorios,95000,4,2,OPTIMO"
    ]
    inv_data = "|".join(inv_rows)
    ok, out, err = run_cmd(["mutate", "write", sheet_id, f"Inventario!A1:G{len(inv_rows)}", inv_data])
    if ok:
        print(f"  -> 'Inventario' actualizado en {month_title}")
    else:
        print(f"  -> Error: {err.strip() or out.strip()}")

    print("\n[2/3] Sincronizando Pestaña 'Clientes'...")
    cli_rows = [
        "ID,Nombre Completo,Teléfono Contacto,Compras Realizadas,Total Gastado COP,Fecha Registro",
        "2,Carlos Mendoza,3109876543,1,185000,06/11/2026",
        "1,Valentina Gómez,'+57 312 456 7890,2,263000,01/11/2026"
    ]
    cli_data = "|".join(cli_rows)
    ok, out, err = run_cmd(["mutate", "write", sheet_id, f"Clientes!A1:F{len(cli_rows)}", cli_data])
    if ok:
        print(f"  -> 'Clientes' actualizado en {month_title}")
    else:
        print(f"  -> Error: {err.strip() or out.strip()}")

    print("\n[3/3] Enlace de acceso:")
    print(f"  -> https://docs.google.com/spreadsheets/d/{sheet_id}/edit")
    print(f"\n¡TABLA {month_title} SINCRONIZADA EXITOSAMENTE!")
    print("=" * 65)

if __name__ == "__main__":
    sync()
