@echo off
title Huellitas POS - Punto de Venta & Inventario
set "HTML_PATH=%~dp0index.html"

echo ======================================================================
echo   Iniciando Huellitas POS (Punto de Venta & Inventario para Pet Shop)
echo ======================================================================

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%HTML_PATH%"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%HTML_PATH%"
) else (
    start "" "%HTML_PATH%"
)

echo.
echo Aplicacion iniciada correctamente en tu navegador.
echo ======================================================================
timeout /t 3 >nul
exit
