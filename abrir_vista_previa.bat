@echo off
title Backoffice de Creditos - Dark Mode
set "FILE_PATH=%~dp0backoffice_creditos_dark.html"

echo ======================================================================
echo   Abriendo Backoffice de Creditos (Dark Mode) en el Navegador...
echo ======================================================================

start "" "%FILE_PATH%"

echo.
echo Vista previa abierta exitosamente.
timeout /t 3 >nul
exit