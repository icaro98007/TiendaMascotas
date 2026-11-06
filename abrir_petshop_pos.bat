@echo off
title Huellitas POS - Punto de Venta & Inventario
set "HTML_PATH=%~dp0index.html"

echo ======================================================================
echo   Iniciando Huellitas POS (Punto de Venta & Inventario para Pet Shop)
echo ======================================================================
echo.

rem Iniciar puente de sincronizacion con Google Drive en segundo plano
start /b python "%~dp0local_sync_server.py" >nul 2>&1

rem Abrir aplicacion en el navegador
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%HTML_PATH%"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%HTML_PATH%"
) else (
    start "" "%HTML_PATH%"
)

echo Aplicacion y sincronizador con Google Drive iniciados correctamente.
echo ======================================================================
timeout /t 2 >nul
exit
