# Sistema de Revisión Documental de Solicitudes de Crédito
## Herramienta Privada de Back Office para Fondos de Empleados

> [!IMPORTANT]
> **DECLARACIÓN DE ALCANCE Y GUARDRAILS NORMATIVOS:**
> 1. **Cero archivos de salida:** La aplicación **no genera ni descarga informes, PDF, Word, Excel ni CSV**. Todo el resultado vive exclusivamente en pantalla durante la sesión activa.
> 2. **Alcance estrictamente documental (No decisión crediticia):** Esta herramienta evalúa integridad, trazabilidad y soportes documentales. **No calcula scoring de solvencia ni emite veredictos financieros (Aprobado/Rechazado)**. Utiliza exclusivamente estados de revisión documental: `Verificado`, `No verificable`, `Por revisar` y `Requiere acción`.
> 3. **Trazabilidad Dual Inmutable:** Almacena lado a lado el valor original (`raw`) y el valor tipado (`normalized`) con notas de interpretación y estado.
> 4. **Honestidad en enlaces externos:** No afirma verificación automática de archivos en Google Drive; distingue explícitamente entre `Sin enlace / Vacío`, `Formato inválido`, `Enlace plausible (Acceso no verificado)` y `Verificado manualmente en sesión`.
> 5. **Privacidad por diseño (100 % en memoria):** Los datos no salen del navegador hacia APIs externas ni modelos de IA. Cero persistencia en disco de datos de clientes.

---

## 🚀 Inicio Rápido (En 1 Clic)

El sistema es completamente autónomo y no requiere compilación previa obligatoria:

### Opción 1: Servidor Local Privado (Recomendado)
Abre PowerShell o terminal en esta carpeta y ejecuta:
```powershell
python server.py 8080
```
Luego abre tu navegador en: **[http://localhost:8080](http://localhost:8080)**

### Opción 2: Ejecución Directa en Navegador
Haz doble clic sobre [`index.html`](file:///c:/Users/hge12/OneDrive/Escritorio/antigravity/index.html) para abrirlo directamente en Chrome, Edge o Firefox.

### Opción 3: Entorno Node / Vite
Si cuentas con Node.js instalado:
```bash
npm install
npm run dev
```

---

## 🧪 Pruebas Automatizadas

El proyecto incluye dos suites de pruebas para garantizar el 100 % de determinismo:

1. **Suite de Pruebas Unitarias Integrada en la UI:**
   Haz clic en el botón superior **"Suite de Pruebas"** en la barra de navegación para ejecutar en vivo las pruebas unitarias de `driveLinkResolver`, `normalizer`, `validationEngine` y verificar los guardrails normativos.

2. **Suite de Pruebas en Python:**
   ```powershell
   python -m unittest tests/test_documental_backoffice.py
   ```

---

## 🏛️ Arquitectura Modular (`src/`)

```
src/
├── domain/
│   ├── types.ts              # Interfaces TypeScript (DualValue<T>, Finding, RadicadoRecord, etc.)
│   └── types.js              # Fábricas y constantes en ESM
├── services/
│   ├── excelParser.js        # Motor de lectura SheetJS, detección de hojas y mapeo asistido
│   ├── normalizer.js         # Normalización prudente de fechas, montos y catálogos
│   ├── driveLinkResolver.js  # Validación y reconstrucción segura de enlaces Google Drive
│   ├── validationEngine.js   # Motor determinista de cruce y reglas estructurales
│   ├── exportAdapter.ts      # Interfaz arquitectónica desacoplada (sin botones en UI)
│   └── exportAdapter.js      # Adaptador nulo en ESM
├── data/
│   └── demoBatch.js          # Generador de lote sintético con los 8 casos de borde
├── ui/
│   ├── app.js                # Controlador UX interactivo, KPIs, filtros y Drawer
│   └── icons.js              # Iconografía SVG tipo Lucide accesible
└── tests/
    └── unitTests.js          # Suite de pruebas unitarias automáticas
```

---

## 📋 Catálogo de Reglas Deterministas Evaluadas

1. **Discrepancia de Conteo de Soportes:** Compara soportes reportados en radicado vs. filas encontradas en la matriz documental.
2. **Documentos Huérfanos:** Identifica filas en la matriz documental cuyo `solicitudId` no existe en radicados.
3. **Inconsistencia de Tipo de Crédito:** Detecta diferencias entre la línea de crédito del radicado y la anotada en el soporte.
4. **IDs Repetidos y Posibles Duplicados:** Alerta solicitudes repetidas o documentos con mismo tipo y nombre de archivo.
5. **Validación de Enlaces Fuente:** Clasifica enlaces vacíos, URLs inválidas o rutas locales inseguras.
6. **Campos Vacíos y Fechas/Montos Ambiguos:** Detecta fechas donde no puede determinarse si el formato es DD/MM o MM/DD.
7. **Alertas de Firma, Identidad o Borradores:** Identifica palabras clave como *"sin firma"*, *"borrador"*, *"ilegible"* o *"falta huella"* para remitir obligatoriamente a revisión humana.
8. **Políticas Configurables y SLA:** Permite activar reglas opcionales del fondo y modo simulación de taller con distintivo ámbar visible.
