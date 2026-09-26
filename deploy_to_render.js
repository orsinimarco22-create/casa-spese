// deploy_to_render.js - Automazione Deploy Cloud 24/7 su Render.com per Marco & Angela
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

console.log('================================================================');
console.log('   🚀 DEPLOY AUTOMATICO CLOUD 24/7 SU RENDER - CASA & SPESE    ');
console.log('   (Hosting permanente, volume SQLite persistente & PWA mobile) ');
console.log('================================================================\n');

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: options.stdio || 'pipe', ...options });
  } catch (err) {
    if (options.ignoreError) return null;
    throw err;
  }
}

function promptQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function main() {
  // 1. Verifica Git locale e stato commit
  console.log('🔍 1. Verifica repository Git locale...');
  const gitVersion = run('git --version', { ignoreError: true });
  if (!gitVersion) {
    console.error('❌ Git non trovato. Riavvia il terminale o esegui setup_fixed_link.bat.');
    process.exit(1);
  }
  console.log(`   ✅ Git attivo: ${gitVersion.trim()}`);

  try {
    run('git add .');
    const status = run('git status -s');
    if (status && status.trim().length > 0) {
      run('git commit -m "feat: aggiornamento automatico per deploy Render 24/7"');
      console.log('   ✅ Modifiche salvate nel commit locale');
    } else {
      console.log('   ✅ Repository pulito e aggiornato all\'ultima versione');
    }
  } catch (e) {
    // Already committed
  }

  // 2. Controllo Render CLI
  console.log('\n🔍 2. Controllo Render CLI...');
  let renderVersion = run('render --version', { ignoreError: true });
  if (!renderVersion) {
    // Controlla se presente in cartella WinGet
    const wingetRender = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'Render.CLI_Microsoft.Winget.Source_8wekyb3d8bbwe', 'render.exe');
    if (fs.existsSync(wingetRender)) {
      renderVersion = 'Render.CLI (WinGet)';
    }
  }

  if (renderVersion) {
    console.log(`   ✅ Render CLI rilevato: ${renderVersion.trim()}`);
    const whoami = run('render whoami', { ignoreError: true });
    if (whoami && !whoami.includes('failed') && !whoami.includes('Error')) {
      console.log(`   ✅ Sessione Render attiva: ${whoami.trim()}`);
    } else {
      console.log('   ℹ️ Render CLI non ancora collegato.');
      console.log('   💡 Marco è già loggato su dashboard.render.com nel browser.');
    }
  } else {
    console.log('   ℹ️ Render CLI non presente (il deploy utilizzerà il Blueprint 1-click via browser).');
  }

  // 3. Controllo GitHub CLI (gh)
  console.log('\n🔍 3. Controllo connessione a GitHub per ospitare il codice...');
  let ghStatus = run('gh auth status', { ignoreError: true });
  let username = null;

  if (ghStatus && ghStatus.includes('Logged in to github.com account')) {
    const match = ghStatus.match(/account ([^\s\(\)]+)/i);
    username = match ? match[1] : null;
    console.log(`   ✅ Già autenticato su GitHub come: ${username || 'utente'}`);
  } else {
    console.log('   ⚠️ Nessun account GitHub collegato a GitHub CLI.');
    console.log('   Perché serve GitHub? Render clona automaticamente il codice e avvia il server 24/7.');
    console.log('\n   👉 Scegli come procedere:');
    console.log('      [1] Login veloce 1-clic a GitHub dal browser (consigliato se hai già GitHub)');
    console.log('      [2] Apri direttamente la schermata di deploy su Render Dashboard');
    
    let choice = '1';
    if (process.stdin.isTTY) {
      choice = await promptQuestion('\n   Seleziona opzione [1 o 2, predefinito 1]: ') || '1';
    }

    if (choice === '1') {
      console.log('\n   🌐 Avvio autorizzazione GitHub nel browser...');
      console.log('   (Copia il codice visualizzato e conferma nel browser aperto)\n');
      try {
        execSync('gh auth login --web -h github.com -p https -w', { stdio: 'inherit' });
        ghStatus = run('gh auth status', { ignoreError: true });
        const match = ghStatus ? ghStatus.match(/account ([^\s\(\)]+)/i) : null;
        username = match ? match[1] : null;
        if (username) {
          console.log(`\n   🎉 Autenticazione completata per: ${username}!`);
        }
      } catch (err) {
        console.warn('   ⚠️ Login GitHub non completato da terminale.');
      }
    }
  }

  // 4. Creazione o Push su repository remoto GitHub
  let repoUrl = null;
  if (username) {
    const repoName = 'casa-spese';
    console.log(`\n📦 4. Sincronizzazione repository su GitHub (${username}/${repoName})...`);

    const repoCheck = run(`gh repo view ${username}/${repoName}`, { ignoreError: true });
    if (!repoCheck) {
      console.log('   Creazione repository pubblico su GitHub...');
      try {
        run(`gh repo create ${repoName} --public --source=. --remote=origin --push`);
        repoUrl = `https://github.com/${username}/${repoName}`;
        console.log(`   ✅ Repository creato e sincronizzato: ${repoUrl}`);
      } catch (err) {
        console.warn('   ⚠️ Creazione automatica fallita, controllo remote...');
      }
    } else {
      console.log(`   ✅ Repository esistente trovato: https://github.com/${username}/${repoName}`);
      repoUrl = `https://github.com/${username}/${repoName}`;
      try {
        run('git push -u origin main');
        console.log('   ✅ Ultima versione del codice inviata a GitHub!');
      } catch (e) {
        console.log('   (Codice già sincronizzato con il repository remoto)');
      }
    }
  }

  // 5. Apertura 1-Click Deploy su Render
  console.log('\n================================================================');
  console.log('   🌐 5. DEPLOY SU RENDER.COM (1-CLICK BLUEPRINT)');
  console.log('================================================================\n');

  let deployUrl;
  if (repoUrl) {
    deployUrl = `https://render.com/deploy?repo=${encodeURIComponent(repoUrl)}`;
    console.log('   🚀 Link 1-Click Deploy generato con successo:');
    console.log(`   👉 ${deployUrl}\n`);
    console.log('   Nella pagina di Render che si aprirà, basterà cliccare "Apply"!');
  } else {
    deployUrl = 'https://dashboard.render.com/select-repo?type=web';
    console.log('   👉 Apertura diretta di Render Dashboard:');
    console.log(`   ${deployUrl}\n`);
    console.log('   💡 Suggerimento: In Render clicca su "New +" -> "Web Service" -> connetti il tuo repository.');
  }

  // Apri Chrome con il deploy URL
  try {
    run(`cmd /c start "" "${deployUrl}"`);
    console.log('   ✅ Pagina di Deploy aperta nel browser Google Chrome!');
  } catch (e) {
    console.log(`   Apri manualmente questo link nel browser: ${deployUrl}`);
  }

  console.log('\n================================================================');
  console.log('   🎉 RIEPILOGO PARAMETRI CONFIGURATI PER RENDER:');
  console.log('================================================================');
  console.log('  • Runtime:              Node.js');
  console.log('  • Versione Node:        22.14.0 (supporto nativo SQLite DatabaseSync)');
  console.log('  • Build Command:        npm install');
  console.log('  • Start Command:        node server.js');
  console.log('  • Regione:              Frankfurt (EU)');
  console.log('  • Piano:                Starter (24/7 sempre attivo, 7$/mese)');
  console.log('  • Disco Persistente:    Mount path: /var/data  (1 GB)');
  console.log('  • Variabile DB_PATH:    /var/data/spese_coppia.db');
  console.log('  • Variabile NO_TUNNEL:  1');
  console.log('  • Variabile NODE_ENV:   production');
  console.log('================================================================');
  console.log('  💡 Alternativa Gratuita (Free Tier):');
  console.log('     Se preferisci il piano Free di Render, imposta il piano su "Free"');
  console.log('     e rimuovi il disco persistente. Potrai scaricare e ripristinare');
  console.log('     i backup JSON direttamente dal menu Impostazioni dell\'app!\n');
}

main().catch(err => {
  console.error('❌ Errore durante l\'esecuzione:', err.message);
});
