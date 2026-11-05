"""
Módulo de Normalización Trazable para Datos de Crédito.
Reglas:
- Fechas inequívocas -> YYYY-MM-DD
- Horas -> HH:MM 24h
- Montos -> Enteros en moneda confirmada
- No adivina fechas ambiguas ni montos con moneda dudosa.
- Preserva valores originales lado a lado.
- Catálogos versionados con sinónimos auditables.
"""

import re
from datetime import datetime
from typing import Tuple, Optional, Dict, Any


# Catálogos canónicos con versión
CATALOGO_VERSION = "CAT-2026.1"

CATALOGO_TIPO_CREDITO = {
    # Canónico: [Sinónimos normalizables]
    "LIBRE_INVERSION": ["LIBRE_INVERSION", "LIBRE INVERSION", "CONSUMO_PERSONAL", "PRESTAMO_PERSONAL", "LIBRE INV"],
    "LIBRANZA": ["LIBRANZA", "LIBRANZA_DOCENTE", "LIBRANZA DOCENTE", "DESCUENTO_NOMINA", "CONVENIO_LIBRANZA"],
    "VIVIENDA": ["VIVIENDA", "VIVIENDA_URBANA", "HIPOTECARIO", "COMPRA_VIVIENDA", "CREDITO_VIVIENDA"],
    "VEHICULO": ["VEHICULO", "AUTO", "VEHICULO_NUEVO", "VEHICULO_USADO", "COMPRA_VEHICULO"],
}

CATALOGO_CANAL = {
    "VIRTUAL": ["VIRTUAL_PORTAL", "PORTAL_WEB", "APP_MOVIL", "ONLINE", "VIRTUAL"],
    "PRESENCIAL": ["AGENCIA_CENTRAL", "SUCURSAL", "VENTANILLA", "PRESENCIAL", "OFICINA"],
    "CORREO": ["EMAIL", "CORREO_ELECTRONICO", "BUZON_RADICACION"],
}

CATALOGO_ESTADO = {
    "RADICADO": ["RADICADO", "RECIBIDO", "INGRESADO", "NUEVO"],
    "EN_ESTUDIO": ["EN_ESTUDIO", "EN_TRAMITE", "EN_REVISION", "PROCESO"],
    "PENDIENTE_DOCUMENTOS": ["PENDIENTE_DOCUMENTOS", "DOCUMENTACION_PENDIENTE", "INCOMPLETO"],
}


class NormalizadorCredito:
    def __init__(self):
        self.mapeo_auditoria = []

    def normalizar_tipo_credito(self, valor_original: str) -> Tuple[Optional[str], Optional[str]]:
        if not valor_original:
            return None, "Tipo de crédito ausente"
        
        limpio = valor_original.strip().upper()
        for canonico, sinonimos in CATALOGO_TIPO_CREDITO.items():
            if limpio == canonico or limpio in sinonimos:
                return canonico, None
        
        return None, f"Tipo de crédito '{valor_original}' desconocido en catálogo {CATALOGO_VERSION}"

    def normalizar_canal(self, valor_original: str) -> Tuple[Optional[str], Optional[str]]:
        if not valor_original:
            return "NO_ESPECIFICADO", None
        
        limpio = valor_original.strip().upper()
        for canonico, sinonimos in CATALOGO_CANAL.items():
            if limpio == canonico or limpio in sinonimos:
                return canonico, None
        
        return valor_original.strip(), f"Canal '{valor_original}' no estándar; se preserva literal."

    def normalizar_estado(self, valor_original: str) -> Tuple[Optional[str], Optional[str]]:
        if not valor_original:
            return "RADICADO", None
        
        limpio = valor_original.strip().upper()
        for canonico, sinonimos in CATALOGO_ESTADO.items():
            if limpio == canonico or limpio in sinonimos:
                return canonico, None
        
        return valor_original.strip(), f"Estado '{valor_original}' fuera de catálogo canónico."

    def normalizar_monto(self, valor_original: Any) -> Tuple[Optional[int], str, Optional[str]]:
        """
        Normaliza montos a enteros positivos en COP.
        Detecta símbolos, comas, puntos y descarta ambigüedad.
        """
        if valor_original is None:
            return None, "COP", "Monto ausente"
        
        s = str(valor_original).strip()
        if not s:
            return None, "COP", "Monto vacío"
        
        # Detectar moneda
        moneda = "COP"
        if "USD" in s or "EUR" in s:
            return None, "DESCONOCIDA", f"Moneda no admitida o ambigua en '{valor_original}'. Solo se admite COP."
        
        # Eliminar $ y palabras como 'COP', 'pesos'
        limpio = re.sub(r'[\$a-zA-Z\s]', '', s)
        
        # Manejo de separadores: formato Colombia habitual ej: 15.000.000 o 15,000,000.00
        # Si tiene punto como separador de miles y no hay decimales
        if "." in limpio and "," in limpio:
            # ej 15.000.000,00 o 15,000,000.00
            ultimo_punto = limpio.rfind(".")
            ultima_coma = limpio.rfind(",")
            if ultima_coma > ultimo_punto:
                # 15.000.000,00 -> parte entera antes de la coma
                parte_entera = limpio[:ultima_coma].replace(".", "")
            else:
                # 15,000,000.00 -> parte entera antes del punto
                parte_entera = limpio[:ultimo_punto].replace(",", "")
        elif "." in limpio:
            partes = limpio.split(".")
            if len(partes) > 1 and all(len(p) == 3 for p in partes[1:]):
                # 15.000.000 (miles con puntos)
                parte_entera = "".join(partes)
            elif len(partes) == 2 and len(partes[1]) == 2:
                # 15000000.00 (decimal)
                parte_entera = partes[0]
            else:
                parte_entera = "".join(partes)
        elif "," in limpio:
            partes = limpio.split(",")
            if len(partes) > 1 and all(len(p) == 3 for p in partes[1:]):
                parte_entera = "".join(partes)
            elif len(partes) == 2 and len(partes[1]) == 2:
                parte_entera = partes[0]
            else:
                parte_entera = "".join(partes)
        else:
            parte_entera = limpio

        try:
            monto_int = int(parte_entera)
            if monto_int <= 0:
                return None, moneda, f"Monto debe ser mayor a cero: {monto_int}"
            return monto_int, moneda, None
        except ValueError:
            return None, moneda, f"Formato de monto ininteligible: '{valor_original}'"

    def normalizar_fecha(self, valor_original: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Convierte a YYYY-MM-DD.
        No adivina fechas ambiguas (ej: 05/06/2026 puede ser 5 de junio o 6 de mayo).
        """
        if not valor_original:
            return None, "Fecha ausente"
        
        s = str(valor_original).strip()
        
        # Si ya está en YYYY-MM-DD
        if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
            try:
                datetime.strptime(s, "%Y-%m-%d")
                return s, None
            except ValueError:
                return None, f"Fecha inválida en calendario: '{s}'"
        
        # Formatos inequívocos con mes en texto (ej. 15-OCT-2026, 15 de Octubre de 2026)
        meses_es = {
            "ene": "01", "feb": "02", "mar": "03", "abr": "04", "may": "05", "jun": "06",
            "jul": "07", "ago": "08", "sep": "09", "oct": "10", "nov": "11", "dic": "12"
        }
        for mes_str, mes_num in meses_es.items():
            if mes_str in s.lower():
                partes = re.findall(r'\d+', s)
                if len(partes) == 2:  # día y año
                    dia, anio = partes[0], partes[1]
                    if len(anio) == 2:
                        anio = "20" + anio
                    if len(dia) == 1:
                        dia = "0" + dia
                    return f"{anio}-{mes_num}-{dia}", None

        # Si viene en DD/MM/YYYY o MM/DD/YYYY
        match = re.match(r'^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$', s)
        if match:
            n1, n2, anio = int(match.group(1)), int(match.group(2)), match.group(3)
            # Si uno es > 12, es inequívoco que ese es el día
            if n1 > 12 and n2 <= 12:
                return f"{anio}-{n2:02d}-{n1:02d}", None
            elif n2 > 12 and n1 <= 12:
                return f"{anio}-{n1:02d}-{n2:02d}", None
            elif n1 == n2:
                # 05/05/2026
                return f"{anio}-{n1:02d}-{n2:02d}", None
            else:
                # AMBIGUO: día y mes ambos <= 12 (ej. 03/04/2026)
                return None, f"Fecha ambigua '{s}': no es posible determinar si es día/mes o mes/día sin confirmación humana."

        return None, f"Formato de fecha no reconocido: '{s}'"

    def normalizar_hora(self, valor_original: str) -> Tuple[Optional[str], Optional[str]]:
        """Convierte hora a HH:MM formato 24h."""
        if not valor_original:
            return None, "Hora ausente"
        
        s = str(valor_original).strip()
        
        # 14:30 o 14:30:15
        m24 = re.match(r'^(\d{1,2}):(\d{2})(?::\d{2})?$', s)
        if m24:
            hh, mm = int(m24.group(1)), int(m24.group(2))
            if 0 <= hh < 24 and 0 <= mm < 60:
                return f"{hh:02d}:{mm:02d}", None
            return None, f"Hora fuera de rango: {s}"
        
        # 2:30 PM o 02:30 AM
        m_ampm = re.match(r'^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$', s)
        if m_ampm:
            hh, mm, ampm = int(m_ampm.group(1)), int(m_ampm.group(2)), m_ampm.group(3).upper()
            if 1 <= hh <= 12 and 0 <= mm < 60:
                if ampm == "PM" and hh != 12:
                    hh += 12
                elif ampm == "AM" and hh == 12:
                    hh = 0
                return f"{hh:02d}:{mm:02d}", None
            return None, f"Hora AM/PM fuera de rango: {s}"
        
        return None, f"Formato de hora no reconocido: '{s}'"
