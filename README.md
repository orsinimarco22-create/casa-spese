# 🏡 Casa & Spese - Gestione Finanze e Risparmio di Coppia

Un'applicazione web progressiva (PWA) collaborativa in tempo reale, installabile come vera applicazione su smartphone (iOS / Android) e desktop, per gestire le finanze domestiche di Marco ed Angela.

---

## ⚡ Avvio Rapido

Per avviare l'applicazione in qualsiasi momento:
- Fai doppio clic sul file **`start.bat`**.
- L'app si aprirà automaticamente nel browser all'indirizzo **`http://localhost:3000`**.

---

## 📱 Link Fisso Permanente & Installazione come App Mobile (PWA)

Perché Angela (che ha poca dimestichezza con la tecnologia) e Marco possano installare l'applicazione **una sola volta** sulla schermata Home dello smartphone senza che il link cambi o smetta di funzionare al riavvio del PC:

### 1. Come funziona il Link Fisso Permanente:
- L'app supporta la tecnologia **Cloudflare Named Tunnel** (gratuita al 100% per sempre tramite Cloudflare Zero Trust).
- A differenza dei link provvisori `trycloudflare.com` che cambiano ogni volta che si riavvia il computer, un Named Tunnel assegna un link HTTPS fisso permanente (es. `https://spese.tuodominio.it` o tramite tunnel dedicato).
- Il link fisso rimane **inalterato per sempre**, anche dopo il riavvio del PC Windows, del modem/router o cambi di indirizzo IP!

### 2. Configurazione del Link Fisso in 2 minuti:
Puoi configurarlo comodamente in due modi:
- **Dall'App Web**: Clicca su **"📱 Collega Telefono"** o su **⚙️ Impostazioni** -> espandi **"🔒 Configura Link Fisso Permanente"**, incolla il tuo **Cloudflare Tunnel Token** e l'**URL Fisso**, poi clicca **"Salva e Connetti"**.
- **Da Terminale**: Fai doppio clic sul file **`setup_fixed_link.bat`** e segui le istruzioni a schermo.
- **Ripristino rapido**: Puoi tornare in qualsiasi momento alla modalità provvisoria cliccando su *"🔄 Ripristina Quick Tunnel"*.

*Procedura gratuita per ottenere il Token Cloudflare:*
1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) (account gratuito) -> **Zero Trust** -> **Networks** -> **Tunnels**.
2. Clicca **"Add a Tunnel"**, scegli **Cloudflare Tunnel**, nominalo `casa-spese`.
3. Sotto **"Public Hostnames"**, assegna il tuo sottodominio (es. `spese.iltuodominio.it`) al servizio locale `HTTP://localhost:3000`.
4. Copia il token generato per Windows e incollalo nell'app.

### 3. Avvio Automatico all'Accensione del PC (24/7 per Angela):
Per garantire che l'app sul telefono di Angela funzioni sempre, anche se il computer viene riavviato o spento:
- Fai doppio clic sul file **`installa_avvio_automatico_windows.bat`** (oppure usa l'opzione 4 in `setup_fixed_link.bat`).
- All'accesso a Windows, Casa & Spese e il Tunnel permanente si avvieranno automaticamente e silenziosamente in background.
- Per rimuovere l'avvio automatico: fai doppio clic su **`disinstalla_avvio_automatico_windows.bat`**.

---

## 📲 Installazione su Smartphone (PWA) per Angela e Marco

Una volta aperto il link sullo smartphone, l'applicazione funziona a schermo intero come una vera app nativa:

### 🍎 Su iPhone (Safari) per Angela:
1. Apri il link con **Safari**.
2. Tocca l'icona **Condividi** in basso (il quadrato con freccia verso l'alto: ⎋ / 📤).
3. Scorri e tocca **"Aggiungi alla schermata Home"** (➕).
4. Tocca **"Aggiungi"** in alto a destra.
5. L'icona **🏡 Casa & Spese** comparirà sulla schermata principale: Angela tocca l'icona e l'app si apre subito a schermo intero senza barre del browser!
6. Tocca **"Attiva Notifiche"** per abilitare i promemoria di spese e affitto.

### 🤖 Su Android (Chrome) per Marco:
1. Apri il link con **Google Chrome**.
2. Tocca il banner **"Installa Casa & Spese"** in basso (oppure tocca i 3 puntini in alto a destra e seleziona **"Installa app"**).
3. L'icona viene aggiunta alla Home e nel cassetto delle applicazioni.

### 🌐 Funzionamento Offline:
- Grazie al **Service Worker** integrato con cache avanzata, se la connessione è assente o ballerina l'applicazione apre comunque la schermata principale (Offline Shell) permettendo di consultare spese e bilancio salvati in precedenza.

---

## 🎯 Funzionalità Finanziarie

1. **Stipendi Netti & Calcolo Sottrazione Visivo**:
   - Marco: **2.700,00 €**
   - Angela: **2.200,00 €**
   - Scontrino di sottrazione riga per riga per ciascun partner:
     - `+ Stipendio iniziale`
     - `- Affitto di turno`
     - `- Quota Bollette & Utenze (50%)`
     - `- Quota Spesa Alimentare & Accessori (60% Marco / 40% Angela)`
     - `= 🎯 RISPARMIO NETTO RIMASTO`
2. **Spese Fisse & Utenze**:
   - **Affitto**: 940,00 € (include acqua e riscaldamento) alternato mensilmente.
   - **Gas ENGIE**: 27,20 € / mese.
   - **Luce**: 55,00 € / mese.
   - **Internet Fibra (WiFi)**: 20,90 € / mese.
3. **Copia Spese Fisse Intelligente**:
   - Cliccando su *"📋 Copia Spese Fisse"*, l'app copia le spese fisse e scambia automaticamente il turno dell'affitto tra Marco ed Angela.
4. **Bilancio & Pareggio (Conguaglio)**:
   - Calcolo automatico delle anticipazioni e pareggio conguaglio con 1 clic.
5. **Promemoria Scadenza Affitto (940 € entro il 5 del mese)**:
   - Notifiche push e ticker dinamico di promemoria.
6. **Tetti di Spesa & Alert Budget Cibo**:
   - Alert istantanei al superamento della soglia (default 400 €).
