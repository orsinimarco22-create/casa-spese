@echo off
title Installa Avvio Automatico Windows - Casa ^& Spese
cd /d "%~dp0"

echo ========================================================
echo   🚀 INSTALLAZIONE AVVIO AUTOMATICO ALL'ACCENSIONE PC
echo ========================================================
echo.
echo Questa procedura crea un collegamento silenzioso nella cartella
echo di avvio di Windows per fare in modo che Casa ^& Spese e il Tunnel
echo permanente siano sempre attivi per Angela e Marco, anche se il PC
echo viene riavviato!
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set VBS_TARGET=%STARTUP_DIR%\CasaSpese_AutoStart.vbs
set BATCH_PATH=%~dp0start.bat

echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_TARGET%"
echo WshShell.CurrentDirectory = "%~dp0" >> "%VBS_TARGET%"
echo WshShell.Run "cmd.exe /c """"%BATCH_PATH%""""", 0, False >> "%VBS_TARGET%"

if exist "%VBS_TARGET%" (
    echo.
    echo ✅ Avvio automatico installato con successo in:
    echo    %VBS_TARGET%
    echo.
    echo D'ora in poi, all'accensione di Windows, Casa ^& Spese e il Tunnel
    echo si avvieranno silenziosamente in background.
) else (
    echo.
    echo ❌ Impossibile creare il file di avvio automatico.
)
echo.
