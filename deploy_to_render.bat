@echo off
title Deploy Cloud 24/7 su Render - Casa & Spese (Marco ed Angela)
cd /d "%~dp0"

echo ========================================================
echo   🚀 CASA ^& SPESE - DEPLOY AUTOMATICO CLOUD 24/7
echo ========================================================
echo.

where agy-node >nul 2>nul
if %errorlevel% == 0 (
    agy-node deploy_to_render.js
    goto end
)

where node >nul 2>nul
if %errorlevel% == 0 (
    node deploy_to_render.js
    goto end
)

if exist "%APPDATA%\Antigravity\bin\agy-node.cmd" (
    "%APPDATA%\Antigravity\bin\agy-node.cmd" deploy_to_render.js
    goto end
)

echo [ERRORE] Node.js non trovato!
pause

:end
pause
