@echo off
title Servidor Local Privado - Revision Documental de Creditos
echo ======================================================================
echo   Iniciando Servidor Local Privado (100%% en Memoria)
echo ======================================================================
echo.
echo Abriendo http://localhost:8080 en tu navegador...

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "http://localhost:8080"
) else (
    start "" "http://localhost:8080"
)

echo Servidor en ejecucion. Para detenerlo presiona Ctrl+C.
python server.py 8080
pause
