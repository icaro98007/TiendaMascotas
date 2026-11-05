@echo off
title Revision Documental de Solicitudes de Credito
set "HTML_PATH=%~dp0index.html"

echo ======================================================================
echo   Abriendo Revision Documental de Creditos en el Navegador...
echo ======================================================================

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%HTML_PATH%"
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%HTML_PATH%"
) else (
    start "" "%HTML_PATH%"
)

echo.
echo Aplicacion iniciada en el navegador.
echo Puedes cargar tus archivos Excel o usar el boton "Cargar Lote de Demostracion".
echo ======================================================================
timeout /t 3 >nul
exit
