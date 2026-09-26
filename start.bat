@echo off
title Casa ^& Spese - Gestione Finanze di Coppia (Marco ed Angela)
cd /d "%~dp0"

echo ========================================================
echo         🏡 CASA ^& SPESE - GESTIONE FINANZE COPPIA
echo ========================================================
echo.
echo Avvio del server in corso...
echo.
echo [PWA ^& MOBILE]
echo  - Supporto installazione come App nativa per smartphone (iOS / Android)
echo  - Supporto Link Fisso Permanente (Cloudflare Tunnel)
echo  - Notifiche in tempo reale ^& sincronizzazione istantanea
echo.

:: Avvia il browser locale dopo un piccolo intervallo per consentire l'avvio del server
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Controlla se agy-node esiste in PATH o usa la cartella Antigravity
where agy-node >nul 2>nul
if %errorlevel% == 0 (
    agy-node server.js
    goto end
)

where node >nul 2>nul
if %errorlevel% == 0 (
    node server.js
    goto end
)

:: Fallback sul percorso diretto Antigravity
if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    "%APPDATA%\Antigravity\bin\agy-node.cmd" server.js
    goto end
)

echo [ERRORE] Node.js o agy-node non trovato nel sistema!
pause

:end
