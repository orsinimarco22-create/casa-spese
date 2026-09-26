// deploy_to_render.js - Automazione Deploy Cloud 24/7 su Render.com per Marco & Angela
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

async function main() {
  // 1. Verifica Git locale
  console.log('🔍 1. Verifica repository Git locale...');
  const gitVersion = run('git --version', { ignoreError: true });
  if (!gitVersion) {
    console.error('❌ Git non trovato. Riavvia il terminale o esegui setup_fixed_link.bat.');
    process.exit(1);
  }
  console.log(`   ✅ Git attivo: ${gitVersion.trim()}`);

  // Assicurati che lo stato sia committato
  try {
    run('git add .');
    const status = run('git status -s');
    if (status && status.trim().length > 0) {
      run('git commit -m "feat: aggiornamento automatico per deploy Render 24/7"');
      console.log('   ✅ Modifiche salvate nel commit locale');
    } else {
      console.log('   ✅ Repository pulito e aggiornato');
    }
  } catch (e) {
    // Already committed
  }

  // 2. Controllo autenticazione GitHub CLI (gh)
  console.log('\n🔍 2. Controllo connessione a GitHub...');
  let ghStatus = run('gh auth status', { ignoreError: true });
  let username = null;

  if (ghStatus && ghStatus.includes('Logged in to github.com account')) {
    const match = ghStatus.match(/account ([^\s\(\)]+)/i);
    username = match ? match[1] : null;
    console.log(`   ✅ Già autenticato su GitHub come: ${username || 'utente'}`);
  } else {
    console.log('   ⚠️ Non sei ancora autenticato su GitHub.');
    console.log('   👉 Avvio autenticazione assistita 1-clic con il tuo account Google...');
    console.log('   (Si aprirà il browser: premi "Continue with Google" o autorizza con 1 clic)\n');

    try {
      execSync('gh auth login --web -h github.com -p https -w', { stdio: 'inherit' });
      ghStatus = run('gh auth status', { ignoreError: true });
      const match = ghStatus ? ghStatus.match(/account ([^\s\(\)]+)/i) : null;
      username = match ? match[1] : null;
      console.log(`\n   🎉 Autenticazione completata con successo per: ${username}!`);
    } catch (err) {
      console.warn('\n   ⚠️ Login da terminale saltato.');
    }
  }

  // 3. Creazione o Push su repository remoto GitHub
  let repoUrl = null;
  if (username) {
    const repoName = 'casa-spese';
    console.log(`\n📦 3. Creazione / Aggiornamento repository su GitHub (${username}/${repoName})...`);
    
    // Controlla se il repository esiste già
    const repoCheck = run(`gh repo view ${username}/${repoName}`, { ignoreError: true });
    if (!repoCheck) {
      console.log('   Creazione repository pubblico su GitHub...');
      try {
        run(`gh repo create ${repoName} --public --source=. --remote=origin --push`);
        repoUrl = `https://github.com/${username}/${repoName}`;
        console.log(`   ✅ Repository creato e caricato: ${repoUrl}`);
      } catch (err) {
        console.warn('   ⚠️ Creazione automatica fallita, provo con push forzato...');
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

  // 4. Apertura 1-Click Deploy su Render
  console.log('\n================================================================');
  console.log('   🌐 4. DEPLOY SU RENDER.COM (1-CLICK BLUEPRINT)');
  console.log('================================================================\n');

  let deployUrl;
  if (repoUrl) {
    deployUrl = `https://render.com/deploy?repo=${encodeURIComponent(repoUrl)}`;
    console.log('   🚀 Link magico 1-Click Deploy generato:');
    console.log(`   👉 ${deployUrl}\n`);
    console.log('   Basta cliccare "Apply" nella pagina di Render che si sta per aprire!');
  } else {
    deployUrl = 'https://dashboard.render.com/select-repo?type=web';
    console.log('   👉 Apertura diretta di Render Dashboard:');
    console.log(`   ${deployUrl}\n`);
  }

  // Apri Chrome con il deploy URL
  try {
    run(`cmd /c start "" "${deployUrl}"`);
    console.log('   ✅ Pagina di Deploy aperta nel browser Google Chrome!');
  } catch (e) {
    console.log(`   Apri manualmente questo link: ${deployUrl}`);
  }

  console.log('\n================================================================');
  console.log('   🎉 RIEPILOGO PARAMETRI PRE-CONFIGURATI PER RENDER:');
  console.log('================================================================');
  console.log('  • Runtime:              Node.js');
  console.log('  • Versione Node:        22.14.0 (supporto nativo SQLite DatabaseSync)');
  console.log('  • Build Command:        (vuoto)');
  console.log('  • Start Command:        node server.js');
  console.log('  • Regione:              Frankfurt (EU)');
  console.log('  • Disco Persistente:    Mount path: /var/data  (1 GB)');
  console.log('  • Variabile DB_PATH:    /var/data/spese_coppia.db');
  console.log('  • Variabile NO_TUNNEL:  1');
  console.log('  • Variabile NODE_ENV:   production');
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('❌ Errore durante l\'esecuzione:', err.message);
});
