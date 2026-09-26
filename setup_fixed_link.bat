@echo off
title Configurazione Link Fisso Permanente - Casa ^& Spese
cd /d "%~dp0"

echo ========================================================
echo   🔒 CONFIGURAZIONE LINK FISSO PERMANENTE (CLOUDFLARE)
echo ========================================================
echo.
echo Questa procedura consente di impostare un link HTTPS permanente
echo per Angela e Marco, in modo che l'app installata su smartphone
echo continui a funzionare per sempre anche dopo i riavvii del PC!
echo.
echo --------------------------------------------------------
echo OPZIONI DISPONIBILI:
echo  [1] Inserisci Token Cloudflare Zero Trust e URL Fisso
echo  [2] Visualizza configurazione corrente
echo  [3] Ripristina modalita provvisoria (Quick Tunnel)
echo  [4] Installa avvio automatico all'accensione di Windows
echo  [5] Rimuovi avvio automatico Windows
echo  [6] Esci
echo --------------------------------------------------------
echo.
set /p choice="Scegli un'opzione (1-6): "

if "%choice%"=="1" goto set_token
if "%choice%"=="2" goto view_config
if "%choice%"=="3" goto reset_quick
if "%choice%"=="4" goto install_startup
if "%choice%"=="5" goto uninstall_startup
if "%choice%"=="6" goto end

:set_token
echo.
echo Istruzioni veloci per il Token Cloudflare:
echo  1. Vai su https://dash.cloudflare.com -> Zero Trust -> Networks -> Tunnels
echo  2. Crea un tunnel denominato 'casa-spese'
echo  3. Assegna il tuo dominio (es. https://spese.tuodominio.it) verso http://localhost:3000
echo  4. Copia il token visualizzato.
echo.
set /p token="Incolla il Cloudflare Tunnel Token: "
set /p fixedUrl="Inserisci il tuo URL HTTPS permanente (es. https://spese.tuodominio.it): "

where agy-node >nul 2>nul
if %errorlevel% == 0 (
    agy-node -e "const fs = require('fs'); const [,, t, u] = process.argv; let fixed = (u || '').trim(); if (fixed && !fixed.startsWith('http://') && !fixed.startsWith('https://')) fixed = 'https://' + fixed; fixed = fixed.replace(/\/+$/, ''); const token = (t || '').trim(); const mode = (token.length > 10) ? 'token' : (fixed ? 'custom' : 'quick'); const cfg = { mode, token, fixedUrl: fixed, updatedAt: new Date().toISOString() }; fs.writeFileSync('tunnel_config.json', JSON.stringify(cfg, null, 2)); if (fixed) fs.writeFileSync('cloudflare_url.txt', fixed); console.log('\n✅ Configurazione salvata con successo in tunnel_config.json!');" "%token%" "%fixedUrl%"
    goto finish
)

where node >nul 2>nul
if %errorlevel% == 0 (
    node -e "const fs = require('fs'); const [,, t, u] = process.argv; let fixed = (u || '').trim(); if (fixed && !fixed.startsWith('http://') && !fixed.startsWith('https://')) fixed = 'https://' + fixed; fixed = fixed.replace(/\/+$/, ''); const token = (t || '').trim(); const mode = (token.length > 10) ? 'token' : (fixed ? 'custom' : 'quick'); const cfg = { mode, token, fixedUrl: fixed, updatedAt: new Date().toISOString() }; fs.writeFileSync('tunnel_config.json', JSON.stringify(cfg, null, 2)); if (fixed) fs.writeFileSync('cloudflare_url.txt', fixed); console.log('\n✅ Configurazione salvata con successo in tunnel_config.json!');" "%token%" "%fixedUrl%"
    goto finish
)
goto finish

:view_config
echo.
if exist tunnel_config.json (
    type tunnel_config.json
) else (
    echo [INFO] Nessun file tunnel_config.json presente. Modalita predefinita: Quick Tunnel.
)
echo.
pause
goto end

:reset_quick
where agy-node >nul 2>nul
if %errorlevel% == 0 (
    agy-node -e "const fs = require('fs'); const cfg = { mode: 'quick', token: '', fixedUrl: '', updatedAt: new Date().toISOString() }; fs.writeFileSync('tunnel_config.json', JSON.stringify(cfg, null, 2)); try { fs.unlinkSync('cloudflare_url.txt'); } catch(e){} console.log('\n🔄 Ripristinata modalita Quick Tunnel.');"
    goto finish
)

where node >nul 2>nul
if %errorlevel% == 0 (
    node -e "const fs = require('fs'); const cfg = { mode: 'quick', token: '', fixedUrl: '', updatedAt: new Date().toISOString() }; fs.writeFileSync('tunnel_config.json', JSON.stringify(cfg, null, 2)); try { fs.unlinkSync('cloudflare_url.txt'); } catch(e){} console.log('\n🔄 Ripristinata modalita Quick Tunnel.');"
    goto finish
)
goto finish

:install_startup
call "%~dp0installa_avvio_automatico_windows.bat"
pause
goto end

:uninstall_startup
call "%~dp0disinstalla_avvio_automatico_windows.bat"
pause
goto end

:finish
echo.
echo [COMPLETATO] Riavvia il server con start.bat per applicare immediatamente le modifiche.
pause

:end
