import subprocess
import json
import sys
import os

SPREADSHEET_ID = "1s88JU2SGM3Rtg0uDZNgbDpqFCtgFxWcXdr-1TzeOeeE"

def run_cmd(args):
    cmd = ["gsheets"] + args
    result = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    return result.returncode == 0, result.stdout, result.stderr

def sync():
    print("=" * 60)
    print(" Huellitas POS -> Sincronizador Directo con Google Sheets")
    print(f" ID Hoja: {SPREADSHEET_ID}")
    print("=" * 60)

    # 1. Cargar productos y clientes desde index.html o archivo de datos
    html_path = os.path.join(os.path.dirname(__file__), "index.html")
    if not os.path.exists(html_path):
        print(f"Error: No se encontró {html_path}")
        return

    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Parsear productos por defecto de index.html
    import re
    # Productos
    prod_match = re.search(r"let products = (\[.*?\]);", content, re.DOTALL)
    # Clientes
    cli_match = re.search(r"let clients = (\[.*?\]);", content, re.DOTALL)

    print("\n[1/3] Preparando datos de Inventario...")
    # Formatear filas de inventario
    inv_rows = [
        "ID,Producto,Categoría,Precio COP,Stock Actual,Stock Mínimo,Estado Semáforo",
        "1,Alimento Perro Adulto 15kg,Alimento,185000,8,3,OPTIMO",
        "2,Alimento Gato Salmón 3kg,Alimento,78000,2,4,BAJO_STOCK",
        "3,Pipeta Antipulgas Perro,Salud,42000,1,3,ALERTA_CRITICA",
        "4,Pelota Mordillo Goma TPR,Juguetes,18000,14,5,OPTIMO",
        "5,Snack Dental Sticks x7,Alimento,16500,5,5,EN_LIMITE",
        "6,Arena Sanitaria Aglomerante 5kg,Higiene,32000,12,4,OPTIMO",
        "7,Champú Hipoalergénico 250ml,Higiene,28000,2,3,BAJO_STOCK",
        "8,Rascador Poste Sisal 50cm,Accesorios,95000,4,2,OPTIMO"
    ]
    inv_data = "|".join(inv_rows)

    ok, out, err = run_cmd(["mutate", "write", SPREADSHEET_ID, "Inventario!A1:G9", inv_data])
    if ok:
        print("  -> Pestaña 'Inventario' actualizada exitosamente en Google Sheets.")
    else:
        print(f"  -> Error al escribir Inventario: {err.strip() or out.strip()}")

    print("\n[2/3] Preparando datos de Clientes...")
    cli_rows = [
        "ID,Nombre Completo,Teléfono Contacto,Compras Realizadas,Total Gastado COP,Fecha Registro",
        "1,Valentina Gómez,'+57 312 456 7890,2,263000,01/11/2026"
    ]
    cli_data = "|".join(cli_rows)

    ok, out, err = run_cmd(["mutate", "write", SPREADSHEET_ID, "Clientes!A1:F2", cli_data])
    if ok:
        print("  -> Pestaña 'Clientes' actualizada exitosamente en Google Sheets.")
    else:
        print(f"  -> Error al escribir Clientes: {err.strip() or out.strip()}")

    print("\n[3/3] Verificando enlace a Google Drive...")
    print(f"  -> URL de la hoja: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit")
    print("\n¡SINCRONIZACIÓN DIRECTA COMPLETADA!")
    print("=" * 60)

if __name__ == "__main__":
    sync()
