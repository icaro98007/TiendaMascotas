@echo off
title NEXUS-IoT Telemetry Dashboard
cd /d "%~dp0"
echo ======================================================================
echo   Iniciando Servidor Local para el Dashboard IoT...
echo ======================================================================
echo.
python server_iot.py
pause
