@echo off
chcp 65001 >nul
title Huellitas POS - Sincronizar con Google Drive
color 0A
echo ==============================================================
echo    HUELLITAS POS - SINCRONIZADOR CON GOOGLE SHEETS
echo ==============================================================
echo.
python "%~dp0sync_to_sheets.py"
echo.
echo Presiona cualquier tecla para salir...
pause >nul
