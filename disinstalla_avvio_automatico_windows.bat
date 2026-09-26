@echo off
title Disinstalla Avvio Automatico Windows - Casa ^& Spese
cd /d "%~dp0"

echo ========================================================
echo   🛑 RIMOZIONE AVVIO AUTOMATICO WINDOWS
echo ========================================================
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_TARGET=%STARTUP_DIR%\CasaSpese_AutoStart.vbs

if exist "%VBS_TARGET%" (
    del /f /q "%VBS_TARGET%"
    echo ✅ Avvio automatico rimosso con successo da:
    echo    %VBS_TARGET%
) else (
    echo [INFO] Nessun avvio automatico trovato nella cartella Startup.
)
echo.
