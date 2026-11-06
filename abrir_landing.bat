@echo off
title Huellitas POS PRO - Landing Page Oficial
set "HTML_PATH=%~dp0landing.html"

echo ======================================================================
echo   Abriendo Landing Page de Huellitas POS PRO
echo ======================================================================
echo.

rem Asegurar que el servidor local este activo
start /b python "%~dp0local_sync_server.py" >nul 2>&1

rem Abrir landing en el navegador
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:5005/landing"
) else if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "http://localhost:5005/landing"
) else (
    start "" "%HTML_PATH%"
)

echo Landing Page abierta en tu navegador.
timeout /t 2 >nul
exit
