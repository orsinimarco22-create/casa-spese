// app.js - Logica Client-Side Reattiva per Casa & Spese
(function () {
  'use strict';

  // Identificativo univoco del client per evitare echo di notifiche sulle proprie azioni
  const CLIENT_ID = (function() {
    let id = sessionStorage.getItem('casa_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem('casa_client_id', id);
    }
    return id;
  })();

  // --- STATO DELL'APPLICAZIONE ---
  const state = {
    currentMonth: getInitialMonthString(), // "YYYY-MM" (con persistenza localStorage)
    data: null,
    categories: [],
    settings: {},
    activeTab: 'tabExpenses',
    searchQuery: '',
    filterCategory: 'ALL',
    filterPayer: 'ALL',
    networkInfo: null
  };

  // --- ELEMENTI DOM ---
  const DOM = {
    // Header
    btnPrevMonth: document.getElementById('btnPrevMonth'),
    btnNextMonth: document.getElementById('btnNextMonth'),
    btnCurrentMonth: document.getElementById('btnCurrentMonth'),
    monthNameText: document.getElementById('monthNameText'),
    monthYearText: document.getElementById('monthYearText'),
    liveStatus: document.getElementById('liveStatus'),
    headerTunnelStatus: document.getElementById('headerTunnelStatus'),
    btnToggleNotifications: document.getElementById('btnToggleNotifications'),
    btnSharePhone: document.getElementById('btnSharePhone'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),

    // Hero Cards
    totalIncomeDisplay: document.getElementById('totalIncomeDisplay'),
    incomesBreakdownText: document.getElementById('incomesBreakdownText'),
    btnEditIncomes: document.getElementById('btnEditIncomes'),

    totalExpensesDisplay: document.getElementById('totalExpensesDisplay'),
    expenseCountBadge: document.getElementById('expenseCountBadge'),
    expensesSplitText: document.getElementById('expensesSplitText'),

    totalSavingsDisplay: document.getElementById('totalSavingsDisplay'),
    savingsRateBadge: document.getElementById('savingsRateBadge'),
    savingsProgressBar: document.getElementById('savingsProgressBar'),
    savingsGoalText: document.getElementById('savingsGoalText'),

    // Partners
    partner1NameDisplay: document.getElementById('partner1NameDisplay'),
    partner1RatioDisplay: document.getElementById('partner1RatioDisplay'),
    partner1BaseIncomeDisplay: document.getElementById('partner1BaseIncomeDisplay'),
    partner1BaseIncomeRow: document.getElementById('partner1BaseIncomeRow'),
    btnEditIncomeP1: document.getElementById('btnEditIncomeP1'),
    partner1RentRow: document.getElementById('partner1RentRow'),
    partner1RentDeduction: document.getElementById('partner1RentDeduction'),
    partner1BillsDeduction: document.getElementById('partner1BillsDeduction'),
    partner1FoodDeduction: document.getElementById('partner1FoodDeduction'),
    partner1OtherRow: document.getElementById('partner1OtherRow'),
    partner1OtherDeduction: document.getElementById('partner1OtherDeduction'),
    partner1SavingsDisplay: document.getElementById('partner1SavingsDisplay'),

    partner2NameDisplay: document.getElementById('partner2NameDisplay'),
    partner2RatioDisplay: document.getElementById('partner2RatioDisplay'),
    partner2BaseIncomeDisplay: document.getElementById('partner2BaseIncomeDisplay'),
    partner2BaseIncomeRow: document.getElementById('partner2BaseIncomeRow'),
    btnEditIncomeP2: document.getElementById('btnEditIncomeP2'),
    partner2RentRow: document.getElementById('partner2RentRow'),
    partner2RentDeduction: document.getElementById('partner2RentDeduction'),
    partner2BillsDeduction: document.getElementById('partner2BillsDeduction'),
    partner2FoodDeduction: document.getElementById('partner2FoodDeduction'),
    partner2OtherRow: document.getElementById('partner2OtherRow'),
    partner2OtherDeduction: document.getElementById('partner2OtherDeduction'),
    partner2SavingsDisplay: document.getElementById('partner2SavingsDisplay'),
    cardIncomeHero: document.getElementById('cardIncomeHero'),

    // Next Rent Ticker & Badges
    nextRentTicker: document.getElementById('nextRentTicker'),
    nextRentTickerText: document.getElementById('nextRentTickerText'),
    nextRentBadge: document.getElementById('nextRentBadge'),

    // Rent Turn
    rentTurnBanner: document.getElementById('rentTurnBanner'),
    rentTurnTitle: document.getElementById('rentTurnTitle'),
    rentTurnDesc: document.getElementById('rentTurnDesc'),
    rentTurnBadge: document.getElementById('rentTurnBadge'),
    rentDeadlineBadge: document.getElementById('rentDeadlineBadge'),

    // Budget Limit Card
    budgetLimitCard: document.getElementById('budgetLimitCard'),
    budgetPercentBadge: document.getElementById('budgetPercentBadge'),
    btnEditBudgetLimit: document.getElementById('btnEditBudgetLimit'),
    budgetSpentDisplay: document.getElementById('budgetSpentDisplay'),
    budgetCapDisplay: document.getElementById('budgetCapDisplay'),
    budgetRemainingDisplay: document.getElementById('budgetRemainingDisplay'),
    budgetProgressBar: document.getElementById('budgetProgressBar'),
    budgetStatusTip: document.getElementById('budgetStatusTip'),
    otherBudgetsSection: document.getElementById('otherBudgetsSection'),
    otherBudgetsGrid: document.getElementById('otherBudgetsGrid'),
    btnAddCategoryBudget: document.getElementById('btnAddCategoryBudget'),

    // Settlement
    settlementBanner: document.getElementById('settlementBanner'),
    settlementIcon: document.getElementById('settlementIcon'),
    settlementTitle: document.getElementById('settlementTitle'),
    settlementDesc: document.getElementById('settlementDesc'),
    btnSettleBalance: document.getElementById('btnSettleBalance'),
    btnUndoSettlement: document.getElementById('btnUndoSettlement'),

    // Quick Chips
    quickChipsBar: document.getElementById('quickChipsBar'),

    // Toolbar & Filtri
    btnOpenNewExpenseModal: document.getElementById('btnOpenNewExpenseModal'),
    fabMobileAdd: document.getElementById('fabMobileAdd'),
    btnCopyFixedModal: document.getElementById('btnCopyFixedModal'),
    searchInput: document.getElementById('searchInput'),
    filterCategory: document.getElementById('filterCategory'),
    filterPayer: document.getElementById('filterPayer'),
    tabCountSpan: document.getElementById('tabCountSpan'),

    // Tabs & Containers
    tabsNav: document.querySelectorAll('.tab-btn'),
    tabExpenses: document.getElementById('tabExpenses'),
    tabCharts: document.getElementById('tabCharts'),
    tabHistory: document.getElementById('tabHistory'),
    expensesListContainer: document.getElementById('expensesListContainer'),

    // Charts
    donutChartSvg: document.getElementById('donutChartSvg'),
    chartLegendContainer: document.getElementById('chartLegendContainer'),
    fixedBarAmount: document.getElementById('fixedBarAmount'),
    variableBarAmount: document.getElementById('variableBarAmount'),
    fixedMeterBar: document.getElementById('fixedMeterBar'),
    variableMeterBar: document.getElementById('variableMeterBar'),
    historyBarChartContainer: document.getElementById('historyBarChartContainer'),
    historyTableBody: document.getElementById('historyTableBody'),

    // Modale Spesa
    modalExpense: document.getElementById('modalExpense'),
    modalExpenseTitle: document.getElementById('modalExpenseTitle'),
    expenseForm: document.getElementById('expenseForm'),
    expenseEditId: document.getElementById('expenseEditId'),
    expenseAmount: document.getElementById('expenseAmount'),
    expenseTitle: document.getElementById('expenseTitle'),
    expenseCategory: document.getElementById('expenseCategory'),
    expenseDate: document.getElementById('expenseDate'),
    expenseIsFixed: document.getElementById('expenseIsFixed'),
    expenseNotes: document.getElementById('expenseNotes'),
    btnCloseExpenseModal: document.getElementById('btnCloseExpenseModal'),
    btnCancelExpense: document.getElementById('btnCancelExpense'),

    // Modale Stipendi
    modalIncomes: document.getElementById('modalIncomes'),
    incomesModalMonth: document.getElementById('incomesModalMonth'),
    incomesForm: document.getElementById('incomesForm'),
    inputIncomeP1: document.getElementById('inputIncomeP1'),
    inputIncomeP2: document.getElementById('inputIncomeP2'),
    inputIncomeExtra: document.getElementById('inputIncomeExtra'),
    checkSaveAsDefaultSalaries: document.getElementById('checkSaveAsDefaultSalaries'),
    btnCloseIncomesModal: document.getElementById('btnCloseIncomesModal'),
    btnCancelIncomes: document.getElementById('btnCancelIncomes'),

    // Modale QR Code
    modalShare: document.getElementById('modalShare'),
    btnCloseShareModal: document.getElementById('btnCloseShareModal'),
    qrCodeWrapper: document.getElementById('qrCodeWrapper'),
    shareUrlInput: document.getElementById('shareUrlInput'),
    btnCopyShareUrl: document.getElementById('btnCopyShareUrl'),
    shareTypeBadge: document.getElementById('shareTypeBadge'),
    btnToggleShareType: document.getElementById('btnToggleShareType'),
    btnBroadcastTestNotif: document.getElementById('btnBroadcastTestNotif'),
    btnShareWhatsApp: document.getElementById('btnShareWhatsApp'),
    headerFixedConfigToggle: document.getElementById('headerFixedConfigToggle'),
    btnToggleFixedConfig: document.getElementById('btnToggleFixedConfig'),
    fixedConfigContent: document.getElementById('fixedConfigContent'),
    inputTunnelToken: document.getElementById('inputTunnelToken'),
    inputFixedUrl: document.getElementById('inputFixedUrl'),
    btnSaveTunnelConfig: document.getElementById('btnSaveTunnelConfig'),
    btnTestTunnelReachability: document.getElementById('btnTestTunnelReachability'),
    btnResetTunnelConfig: document.getElementById('btnResetTunnelConfig'),
    tunnelConfigStatusMsg: document.getElementById('tunnelConfigStatusMsg'),

    // PWA & Banners
    offlineIndicator: document.getElementById('offlineIndicator'),
    pwaInstallBanner: document.getElementById('pwaInstallBanner'),
    btnInstallPwa: document.getElementById('btnInstallPwa'),
    btnDismissInstall: document.getElementById('btnDismissInstall'),

    // Modale Conguaglio
    modalSettlement: document.getElementById('modalSettlement'),
    settlementForm: document.getElementById('settlementForm'),
    settlementPromptText: document.getElementById('settlementPromptText'),
    settlementAmount: document.getElementById('settlementAmount'),
    settlementNotes: document.getElementById('settlementNotes'),
    btnCloseSettlementModal: document.getElementById('btnCloseSettlementModal'),
    btnCancelSettlement: document.getElementById('btnCancelSettlement'),

    // Modale Impostazioni
    modalSettings: document.getElementById('modalSettings'),
    settingsForm: document.getElementById('settingsForm'),
    settingP1Name: document.getElementById('settingP1Name'),
    settingP2Name: document.getElementById('settingP2Name'),
    settingDefIncomeP1: document.getElementById('settingDefIncomeP1'),
    settingDefIncomeP2: document.getElementById('settingDefIncomeP2'),
    settingSplitPref: document.getElementById('settingSplitPref'),
    settingFoodBudget: document.getElementById('settingFoodBudget'),
    settingRestaurantBudget: document.getElementById('settingRestaurantBudget'),
    settingCleaningBudget: document.getElementById('settingCleaningBudget'),
    btnSettingsTestNotif: document.getElementById('btnSettingsTestNotif'),
    btnSettingsOpenFixedTunnel: document.getElementById('btnSettingsOpenFixedTunnel'),
    settingsTunnelBadgeText: document.getElementById('settingsTunnelBadgeText'),
    settingsStorageBadge: document.getElementById('settingsStorageBadge'),
    btnTriggerRestore: document.getElementById('btnTriggerRestore'),
    inputRestoreFile: document.getElementById('inputRestoreFile'),
    btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
    btnCancelSettings: document.getElementById('btnCancelSettings'),

    // Toast
    toast: document.getElementById('toastNotification')
  };

  // --- UTILITY ---
  function getTodayMonthString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function getInitialMonthString() {
    try {
      const saved = localStorage.getItem('casa_selected_month');
      if (saved && /^\d{4}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch (e) {}
    return getTodayMonthString();
  }

  function getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatMoney(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  function getMonthName(yearMonthStr) {
    const [year, month] = yearMonthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const name = date.toLocaleString('it-IT', { month: 'long' });
    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      year: year
    };
  }

  function showToast(message, duration = 3000) {
    DOM.toast.textContent = message;
    DOM.toast.classList.add('show');
    setTimeout(() => {
      DOM.toast.classList.remove('show');
    }, duration);
  }

  function updateOnlineStatus() {
    try {
      if (navigator.onLine) {
        if (DOM.offlineIndicator) DOM.offlineIndicator.style.display = 'none';
      } else {
        if (DOM.offlineIndicator) DOM.offlineIndicator.style.display = 'flex';
      }
    } catch (e) {}
  }

  // --- API CALLS ---
  async function fetchMonthState(month) {
    try {
      const res = await fetch(`/api/state?month=${encodeURIComponent(month)}&_t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        showToast('⚠️ Modalità offline: impossibile caricare nuovi dati');
        return null;
      }
      const data = await res.json();
      if (!data || !data.summary) {
        showToast('⚠️ Dati mese non disponibili');
        return null;
      }
      return data;
    } catch (err) {
      console.error(err);
      showToast('⚠️ Errore di connessione al server');
      return null;
    }
  }

  async function fetchNetworkInfo() {
    try {
      const res = await fetch('/api/network-info');
      if (res.ok) {
        state.networkInfo = await res.json();
      }
    } catch (e) {
      console.warn('Network info non disponibile', e);
    }
  }

  // --- NOTIFICHE NATIVE / PWA ---
  let swRegistration = null;

  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        swRegistration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('✅ Service Worker registrato per le notifiche');
      } catch (err) {
        console.warn('Registrazione Service Worker non riuscita', err);
      }
    }
  }

  function playNotificationChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
  }

  function updateNotificationButtonUI() {
    if (!DOM.btnToggleNotifications) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!('Notification' in window)) {
      DOM.btnToggleNotifications.style.display = 'inline-flex';
      if (isIOS) {
        DOM.btnToggleNotifications.innerHTML = '🔔 <span class="btn-label-desktop">Notifiche iOS</span>';
        DOM.btnToggleNotifications.classList.remove('active-notification');
        DOM.btnToggleNotifications.title = 'Tocca per attivare le notifiche su iPhone (richiede aggiunta alla Home)';
      } else {
        DOM.btnToggleNotifications.innerHTML = '🔔 <span class="btn-label-desktop">Notifiche</span>';
        DOM.btnToggleNotifications.classList.remove('active-notification');
        DOM.btnToggleNotifications.title = 'Tocca per info notifiche';
      }
      return;
    }

    DOM.btnToggleNotifications.style.display = 'inline-flex';
    if (Notification.permission === 'granted') {
      DOM.btnToggleNotifications.innerHTML = '🔔 <span class="btn-label-desktop">Notifiche Attive</span>';
      DOM.btnToggleNotifications.classList.add('active-notification');
      DOM.btnToggleNotifications.title = 'Notifiche attive! Tocca per inviare una notifica di prova.';
    } else if (Notification.permission === 'denied') {
      DOM.btnToggleNotifications.innerHTML = '🔕 <span class="btn-label-desktop">Notifiche Bloccate</span>';
      DOM.btnToggleNotifications.classList.remove('active-notification');
      DOM.btnToggleNotifications.title = 'Notifiche bloccate nelle impostazioni del browser. Tocca per aiuto.';
    } else {
      DOM.btnToggleNotifications.innerHTML = '🔔 <span class="btn-label-desktop">Attiva Notifiche</span>';
      DOM.btnToggleNotifications.classList.remove('active-notification');
      DOM.btnToggleNotifications.title = 'Tocca per attivare le notifiche istantanee per spese e affitto';
    }
  }

  function requestNotificationPermission() {
    return new Promise((resolve) => {
      try {
        const res = Notification.requestPermission(resolve);
        if (res && typeof res.then === 'function') {
          res.then(resolve).catch(() => resolve(Notification.permission));
        }
      } catch (e) {
        resolve(Notification.permission);
      }
    });
  }

  async function handleToggleNotifications() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Se connesso tramite HTTP non sicuro e non su localhost
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      alert('⚠️ Connessione non protetta (HTTP):\n\nPer abilitare le notifiche su smartphone è indispensabile usare la connessione protetta HTTPS di Cloudflare.\n\nTocca "Collega Telefono" e usa il link protetto Cloudflare!');
      openShareModal();
      return;
    }

    if (!('Notification' in window)) {
      if (isIOS) {
        alert('📲 Come attivare le notifiche su iPhone / iPad:\n\n1. In Safari, tocca il tasto Condividi in basso (l\'icona con il quadrato e la freccia verso l\'alto ⎋)\n2. Seleziona "Aggiungi a schermata Home"\n3. Apri l\'app dall\'icona creata sulla tua Home Screen\n4. Tocca "Attiva Notifiche"!\n\n(Apple abilita le notifiche web solo per le app salvate sulla schermata Home).');
      } else {
        alert('Il browser attuale non supporta le notifiche native. Prova ad aprire l\'app con Chrome o Edge.');
      }
      return;
    }

    if (Notification.permission === 'granted') {
      showToast('🔔 Notifiche attive! Invio notifica di prova...');
      sendAppNotification('🏡 Casa & Spese', 'Le notifiche sono regolarmente attive su questo dispositivo! Riceverai avvisi istantanei per ogni spesa e per la scadenza dell\'affitto.');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('Le notifiche risultano disattivate o bloccate nel browser.\n\nPer abilitarle:\n- Su Chrome Android: tocca il lucchetto accanto alla barra indirizzi > Autorizzazioni > Notifiche > Consenti.\n- Su iPhone: vai in Impostazioni iPhone > Notifiche > Casa & Spese e consenti le notifiche.');
      return;
    }

    try {
      const perm = await requestNotificationPermission();
      updateNotificationButtonUI();
      if (perm === 'granted') {
        showToast('🔔 Notifiche attivate con successo!');
        sendAppNotification('🏡 Casa & Spese', 'Notifiche attivate! Riceverai un avviso quando vengono aggiunte spese e per la scadenza dell\'affitto entro il 5 del mese.');
      } else {
        showToast('ℹ️ Permesso notifiche non accordato');
      }
    } catch (err) {
      console.error('Errore richiesta permessi notifiche', err);
    }
  }

  async function sendAppNotification(title, body, options = {}) {
    playNotificationChime();
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notifOptions = {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: options.tag || ('casa-spese-' + Date.now()),
      renotify: true,
      data: { url: window.location.href, ...(options.data || {}) },
      ...options
    };

    // 1. Prova con Service Worker Registration attiva (nativa PWA iOS & Android)
    try {
      if (swRegistration && typeof swRegistration.showNotification === 'function') {
        await swRegistration.showNotification(title, notifOptions);
        return;
      }
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, notifOptions);
          return;
        }
      }
    } catch (e) {
      console.warn('showNotification su ServiceWorker non riuscito, fallback:', e);
    }

    // 2. Fallback tramite postMessage al Service Worker se controller presente
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          options: notifOptions
        });
        return;
      } catch (e) {}
    }

    // 3. Fallback notifica diretta finestra browser
    tryDirectNotification(title, notifOptions);
  }

  function tryDirectNotification(title, notifOptions) {
    try {
      new Notification(title, notifOptions);
    } catch (e) {
      console.warn('Impossibile mostrare notifica diretta', e);
    }
  }

  function checkAndSendRentReminder(payerName, monthName, daysLeft, isOverdue = false) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reminderKey = isOverdue
      ? `rent_overdue_sent_${state.currentMonth}`
      : `rent_reminder_sent_${state.currentMonth}_d${daysLeft}`;

    if (localStorage.getItem(reminderKey)) return;
    localStorage.setItem(reminderKey, 'true');

    let title, msg;
    if (isOverdue) {
      title = `🚨 Affitto ${monthName} Non Ancora Registrato`;
      msg = `L'affitto di 940,00 € andava versato entro il 5 ${monthName} a cura di ${payerName}. Registralo appena possibile!`;
    } else if (daysLeft === 0) {
      title = `🏠 Scadenza Affitto OGGI (5 ${monthName})`;
      msg = `Oggi è il 5 ${monthName}! Tocca a ${payerName} pagare l'affitto (940,00 €).`;
    } else {
      title = `🏠 Promemoria Scadenza Affitto (${monthName})`;
      msg = `Mancano ${daysLeft} giorni alla scadenza del 5 ${monthName} per l'affitto (940,00 € a carico di ${payerName}).`;
    }

    sendAppNotification(title, msg);
  }

  function updateTunnelUI() {
    if (!DOM.headerTunnelStatus) return;
    const tunnel = state.networkInfo;
    const status = tunnel ? tunnel.tunnelStatus : 'starting';
    const url = tunnel ? tunnel.tunnelUrl : null;
    const isPermanent = tunnel ? !!tunnel.isPermanent : false;

    DOM.headerTunnelStatus.className = 'tunnel-status-pill';
    const mode = tunnel ? tunnel.mode : 'quick';

    if (url && (status === 'online' || !status)) {
      if (mode === 'cloud') {
        DOM.headerTunnelStatus.classList.add('permanent');
        DOM.headerTunnelStatus.innerHTML = '☁️ Cloud 24/7 Attivo';
        DOM.headerTunnelStatus.title = `Applicazione attiva nel Cloud 24/7: ${url}. Funziona anche a computer completamente spento! Tocca per QR e info.`;
      } else if (isPermanent) {
        DOM.headerTunnelStatus.classList.add('permanent');
        DOM.headerTunnelStatus.innerHTML = '🔒 Link Fisso Attivo';
        DOM.headerTunnelStatus.title = `Link fisso permanente attivo: ${url}. Sopravvive ai riavvii del PC! Tocca per QR e info.`;
      } else {
        DOM.headerTunnelStatus.classList.add('temporary');
        DOM.headerTunnelStatus.innerHTML = '⚠️ Link Provvisorio';
        DOM.headerTunnelStatus.title = `Link trycloudflare attivo: ${url}. Tocca per impostare un link fisso permanente.`;
      }
    } else if (status === 'starting') {
      DOM.headerTunnelStatus.classList.add('starting');
      DOM.headerTunnelStatus.innerHTML = '🟡 Connessione...';
      DOM.headerTunnelStatus.title = 'Attivazione tunnel in corso...';
    } else {
      DOM.headerTunnelStatus.classList.add('offline');
      DOM.headerTunnelStatus.innerHTML = '⚪ Solo Wi-Fi Locale';
      DOM.headerTunnelStatus.title = 'Tunnel non attivo. Accesso limitato alla rete locale Wi-Fi.';
    }

    if (DOM.settingsTunnelBadgeText) {
      if (mode === 'cloud') {
        DOM.settingsTunnelBadgeText.className = 'badge badge-success';
        DOM.settingsTunnelBadgeText.textContent = '☁️ Cloud 24/7 Attivo (Render / Permanente)';
      } else if (isPermanent) {
        DOM.settingsTunnelBadgeText.className = 'badge badge-success';
        DOM.settingsTunnelBadgeText.textContent = '🔒 Link Fisso Permanente Attivo';
      } else {
        DOM.settingsTunnelBadgeText.className = 'badge badge-warning';
        DOM.settingsTunnelBadgeText.textContent = '⚠️ Link Provvisorio (TryCloudflare)';
      }
    }
  }

  // --- INIZIALIZZAZIONE REAL-TIME (SSE) ---
  let activeEventSource = null;

  function initRealtimeSync() {
    if (!window.EventSource) return;
    if (activeEventSource) {
      try { activeEventSource.close(); } catch (e) {}
    }

    const es = new EventSource(`/api/events?clientId=${encodeURIComponent(CLIENT_ID)}`);
    activeEventSource = es;

    es.onopen = () => {
      DOM.liveStatus.innerHTML = '<span class="status-dot"></span> Sincronizzato in tempo reale';
      loadMonthData(state.currentMonth, false);
      fetchNetworkInfo().then(updateTunnelUI);
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('⚡ Ricevuto aggiornamento real-time:', payload.type);

        if (payload.type === 'TUNNEL_UPDATED') {
          if (!state.networkInfo) state.networkInfo = {};
          if (payload.data) {
            state.networkInfo.tunnelUrl = payload.data.tunnelUrl;
            state.networkInfo.tunnelStatus = payload.data.tunnelStatus;
            state.networkInfo.isPermanent = payload.data.isPermanent;
            state.networkInfo.mode = payload.data.mode;
          }
          updateTunnelUI();
          if (DOM.modalShare && DOM.modalShare.classList.contains('open')) {
            updateShareModalContent();
          }
          return;
        }

        if (payload.type === 'TEST_NOTIFICATION') {
          const title = payload.data?.title || '🔔 Test Notifica';
          const body = payload.data?.body || 'Le notifiche in tempo reale funzionano alla perfezione!';
          showToast(title);
          sendAppNotification(title, body);
          return;
        }

        if (payload.type === 'RENT_REMINDER') {
          const notif = payload.data?.notification;
          if (notif) {
            showToast(notif.title);
            sendAppNotification(notif.title, notif.body);
          }
          return;
        }

        // Se l'evento riguarda il mese attivo, ricarica lo stato
        if (!payload.data || !payload.data.month || payload.data.month === state.currentMonth) {
          loadMonthData(state.currentMonth, false);

          // Se l'azione è stata scatenata da questa specifica sessione/tab, non riprodurre notifiche OS o chimes
          const isOwnAction = payload.senderClientId && (payload.senderClientId === CLIENT_ID);

          if (payload.type === 'EXPENSE_ADDED') {
            const notif = payload.data ? payload.data.notification : null;
            const toastTitle = notif ? notif.title : '🔔 Nuova spesa aggiunta dal partner!';
            const notifBody = notif ? notif.body : 'Una nuova spesa è stata inserita nel bilancio di casa.';
            if (!isOwnAction) {
              showToast(toastTitle);
              sendAppNotification(toastTitle, notifBody);
            }
            if (payload.data && payload.data.budgetAlert) {
              showToast(payload.data.budgetAlert.title);
              if (!isOwnAction) {
                sendAppNotification(payload.data.budgetAlert.title, payload.data.budgetAlert.body);
              }
            }
          } else if (payload.type === 'EXPENSE_UPDATED') {
            const notif = payload.data ? payload.data.notification : null;
            const toastTitle = notif ? notif.title : '✏️ Una spesa è stata modificata';
            const notifBody = notif ? notif.body : '';
            if (!isOwnAction) {
              showToast(toastTitle);
              sendAppNotification(toastTitle, notifBody);
            }
            if (payload.data && payload.data.budgetAlert) {
              showToast(payload.data.budgetAlert.title);
              if (!isOwnAction) {
                sendAppNotification(payload.data.budgetAlert.title, payload.data.budgetAlert.body);
              }
            }
          } else if (payload.type === 'SETTLEMENT_RECORDED') {
            if (!isOwnAction) {
              showToast('🤝 Pareggio conti registrato!');
              sendAppNotification('🤝 Pareggio Conti Registrato', 'I conti del mese sono stati saldati con successo!');
            }
          } else if (payload.type === 'SETTLEMENT_DELETED') {
            if (!isOwnAction) {
              showToast('↩️ Pareggio annullato!');
            }
          }
        }
      } catch (err) {
        console.error('Errore parsing SSE', err);
      }
    };

    es.onerror = () => {
      DOM.liveStatus.innerHTML = '<span class="status-dot" style="background:#ef4444;box-shadow:none;"></span> Riconnessione in corso...';
    };
  }

  // --- CARICAMENTO E RENDERING STATO ---
  async function loadMonthData(month, updateUI = true) {
    state.currentMonth = month;
    try {
      localStorage.setItem('casa_selected_month', month);
    } catch (e) {}
    const res = await fetchMonthState(month);
    if (!res) return;

    state.data = res;
    state.categories = res.categories || [];
    state.settings = res.settings || {};

    updateMonthHeaderDisplay();
    updatePartnerLabels();
    renderHeroSummary();
    renderCategoryFilters();
    renderExpensesList();
    renderCharts();
    if (state.activeTab === 'tabHistory') {
      loadAndRenderHistory();
    }
  }

  function updateMonthHeaderDisplay() {
    const { name, year } = getMonthName(state.currentMonth);
    DOM.monthNameText.textContent = name;
    DOM.monthYearText.textContent = year;
  }

  function updatePartnerLabels() {
    const p1 = state.settings.partner1_name || 'Marco';
    const p2 = state.settings.partner2_name || 'Angela';

    DOM.partner1NameDisplay.textContent = p1;
    DOM.partner2NameDisplay.textContent = p2;

    document.querySelectorAll('.lbl-p1').forEach(el => el.textContent = p1);
    document.querySelectorAll('.lbl-p2').forEach(el => el.textContent = p2);

    if (DOM.filterPayer && DOM.filterPayer.options.length >= 3) {
      DOM.filterPayer.options[1].text = `Solo ${p1}`;
      DOM.filterPayer.options[2].text = `Solo ${p2}`;
    }
  }

  function renderHeroSummary() {
    const summary = state.data.summary;
    const p1Name = summary.partners.partner1.name || 'Marco';
    const p2Name = summary.partners.partner2.name || 'Angela';

    // 1. Entrate Totali
    DOM.totalIncomeDisplay.textContent = formatMoney(summary.incomes.total);
    DOM.incomesBreakdownText.textContent = `${p1Name}: ${formatMoney(summary.incomes.partner1)} | ${p2Name}: ${formatMoney(summary.incomes.partner2)}${summary.incomes.extra > 0 ? ` | Extra: ${formatMoney(summary.incomes.extra)}` : ''}`;

    // 2. Spese Totali
    DOM.totalExpensesDisplay.textContent = formatMoney(summary.expenses.total);
    DOM.expenseCountBadge.textContent = `${summary.expenses.count} spese`;
    DOM.expensesSplitText.textContent = `🏠 Fisse: ${formatMoney(summary.expenses.fixed)} | 🛒 Var: ${formatMoney(summary.expenses.variable)}`;

    // 3. Risparmio di Coppia
    const totalSavings = summary.savings.total;
    DOM.totalSavingsDisplay.textContent = formatMoney(totalSavings);
    DOM.totalSavingsDisplay.style.color = totalSavings >= 0 ? 'var(--primary)' : 'var(--danger)';

    const rate = summary.savings.rate;
    DOM.savingsRateBadge.textContent = `${rate}%`;
    DOM.savingsRateBadge.className = `badge ${rate >= 20 ? 'badge-success' : rate > 0 ? 'badge-subtle' : 'badge-danger'}`;

    const clampedPercent = Math.max(0, Math.min(100, rate));
    DOM.savingsProgressBar.style.width = `${clampedPercent}%`;
    DOM.savingsProgressBar.style.background = totalSavings >= 0 ? 'linear-gradient(90deg, #10b981, #059669)' : '#ef4444';
    DOM.savingsGoalText.textContent = totalSavings >= 0
      ? `Riuscite a mettere da parte il ${rate}% del vostro budget!`
      : `Attenzione: le spese superano le entrate di questo mese!`;

    // 4. Partner 1 (Marco) - Scontrino Sottrazione Dettagliato
    const p1 = summary.partners.partner1;
    DOM.partner1NameDisplay.textContent = p1.name;
    DOM.partner1RatioDisplay.textContent = `Stipendio: ${formatMoney(p1.income)} (${Math.round(p1.ratio * 100)}%)`;
    if (DOM.partner1BaseIncomeDisplay) DOM.partner1BaseIncomeDisplay.textContent = `+ ${formatMoney(p1.income)}`;

    if (DOM.partner1RentDeduction) {
      if (p1.rentShare > 0) {
        DOM.partner1RentDeduction.textContent = `- ${formatMoney(p1.rentShare)}`;
        DOM.partner1RentDeduction.className = 'text-deduction';
      } else {
        DOM.partner1RentDeduction.textContent = `0,00 € (Tocca ad ${p2Name})`;
        DOM.partner1RentDeduction.className = 'text-muted-ok';
      }
    }

    if (DOM.partner1BillsDeduction) {
      if (p1.billsShare > 0) {
        DOM.partner1BillsDeduction.textContent = `- ${formatMoney(p1.billsShare)}`;
        DOM.partner1BillsDeduction.className = 'text-deduction';
      } else {
        DOM.partner1BillsDeduction.textContent = `0,00 €`;
        DOM.partner1BillsDeduction.className = 'text-muted-ok';
      }
    }
    if (DOM.partner1FoodDeduction) {
      if (p1.foodShare > 0) {
        DOM.partner1FoodDeduction.textContent = `- ${formatMoney(p1.foodShare)}`;
        DOM.partner1FoodDeduction.className = 'text-deduction';
      } else {
        DOM.partner1FoodDeduction.textContent = `0,00 €`;
        DOM.partner1FoodDeduction.className = 'text-muted-ok';
      }
    }
    if (DOM.partner1OtherDeduction) {
      if (p1.otherShare > 0) {
        DOM.partner1OtherDeduction.textContent = `- ${formatMoney(p1.otherShare)}`;
        DOM.partner1OtherDeduction.className = 'text-deduction';
      } else {
        DOM.partner1OtherDeduction.textContent = `0,00 €`;
        DOM.partner1OtherDeduction.className = 'text-muted-ok';
      }
    }
    DOM.partner1SavingsDisplay.textContent = formatMoney(p1.savings);
    DOM.partner1SavingsDisplay.style.color = p1.savings >= 0 ? 'var(--primary)' : 'var(--danger)';

    // 5. Partner 2 (Angela) - Scontrino Sottrazione Dettagliato
    const p2 = summary.partners.partner2;
    DOM.partner2NameDisplay.textContent = p2.name;
    DOM.partner2RatioDisplay.textContent = `Stipendio: ${formatMoney(p2.income)} (${Math.round(p2.ratio * 100)}%)`;
    if (DOM.partner2BaseIncomeDisplay) DOM.partner2BaseIncomeDisplay.textContent = `+ ${formatMoney(p2.income)}`;

    if (DOM.partner2RentDeduction) {
      if (p2.rentShare > 0) {
        DOM.partner2RentDeduction.textContent = `- ${formatMoney(p2.rentShare)}`;
        DOM.partner2RentDeduction.className = 'text-deduction';
      } else {
        DOM.partner2RentDeduction.textContent = `0,00 € (Tocca a ${p1Name})`;
        DOM.partner2RentDeduction.className = 'text-muted-ok';
      }
    }

    if (DOM.partner2BillsDeduction) {
      if (p2.billsShare > 0) {
        DOM.partner2BillsDeduction.textContent = `- ${formatMoney(p2.billsShare)}`;
        DOM.partner2BillsDeduction.className = 'text-deduction';
      } else {
        DOM.partner2BillsDeduction.textContent = `0,00 €`;
        DOM.partner2BillsDeduction.className = 'text-muted-ok';
      }
    }
    if (DOM.partner2FoodDeduction) {
      if (p2.foodShare > 0) {
        DOM.partner2FoodDeduction.textContent = `- ${formatMoney(p2.foodShare)}`;
        DOM.partner2FoodDeduction.className = 'text-deduction';
      } else {
        DOM.partner2FoodDeduction.textContent = `0,00 €`;
        DOM.partner2FoodDeduction.className = 'text-muted-ok';
      }
    }
    if (DOM.partner2OtherDeduction) {
      if (p2.otherShare > 0) {
        DOM.partner2OtherDeduction.textContent = `- ${formatMoney(p2.otherShare)}`;
        DOM.partner2OtherDeduction.className = 'text-deduction';
      } else {
        DOM.partner2OtherDeduction.textContent = `0,00 €`;
        DOM.partner2OtherDeduction.className = 'text-muted-ok';
      }
    }
    DOM.partner2SavingsDisplay.textContent = formatMoney(p2.savings);
    DOM.partner2SavingsDisplay.style.color = p2.savings >= 0 ? 'var(--primary)' : 'var(--danger)';

    // 6. Card Tetto Spesa Alimentare (in primis) & Altri Tetti
    if (DOM.budgetLimitCard && summary.budget) {
      const food = summary.budget.food || summary.budget;
      if (DOM.budgetSpentDisplay) DOM.budgetSpentDisplay.textContent = formatMoney(food.spent);
      if (DOM.budgetCapDisplay) DOM.budgetCapDisplay.textContent = formatMoney(food.limit);

      if (food.isOver) {
        if (DOM.budgetRemainingDisplay) {
          DOM.budgetRemainingDisplay.textContent = `+ ${formatMoney(food.overAmount)} (Superato)`;
          DOM.budgetRemainingDisplay.className = 'text-deduction';
        }
        if (DOM.budgetPercentBadge) {
          DOM.budgetPercentBadge.className = 'badge badge-danger';
          DOM.budgetPercentBadge.textContent = `${food.percent}% (Oltre tetto!)`;
        }
        if (DOM.budgetProgressBar) {
          DOM.budgetProgressBar.style.width = '100%';
          DOM.budgetProgressBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        }
        if (DOM.budgetStatusTip) {
          DOM.budgetStatusTip.innerHTML = `⚠️ <strong>Attenzione:</strong> Avete superato il tetto mensile concordato per la spesa cibo di <strong>${formatMoney(food.overAmount)}</strong>.`;
          DOM.budgetStatusTip.style.color = 'var(--danger)';
        }
      } else {
        if (DOM.budgetRemainingDisplay) {
          DOM.budgetRemainingDisplay.textContent = formatMoney(food.remaining);
          DOM.budgetRemainingDisplay.className = 'text-success';
        }
        const clampedPct = Math.min(100, food.percent);
        if (DOM.budgetPercentBadge) {
          DOM.budgetPercentBadge.textContent = `${food.percent}%`;
        }

        if (food.percent >= 75) {
          if (DOM.budgetPercentBadge) DOM.budgetPercentBadge.className = 'badge badge-warning';
          if (DOM.budgetProgressBar) {
            DOM.budgetProgressBar.style.width = `${clampedPct}%`;
            DOM.budgetProgressBar.style.background = 'linear-gradient(90deg, #10b981, #f59e0b)';
          }
          if (DOM.budgetStatusTip) {
            DOM.budgetStatusTip.innerHTML = `Avete utilizzato il <strong>${food.percent}%</strong> del tetto spesa cibo. Rimangono <strong>${formatMoney(food.remaining)}</strong>.`;
            DOM.budgetStatusTip.style.color = '#b45309';
          }
        } else {
          if (DOM.budgetPercentBadge) DOM.budgetPercentBadge.className = 'badge badge-success';
          if (DOM.budgetProgressBar) {
            DOM.budgetProgressBar.style.width = `${clampedPct}%`;
            DOM.budgetProgressBar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
          }
          if (DOM.budgetStatusTip) {
            DOM.budgetStatusTip.innerHTML = `Ottimo! Siete nei limiti prefissati per il cibo (speso il <strong>${food.percent}%</strong>). Rimangono <strong>${formatMoney(food.remaining)}</strong>.`;
            DOM.budgetStatusTip.style.color = 'var(--text-muted)';
          }
        }
      }

      // Render altri tetti configurati
      if (DOM.otherBudgetsGrid && summary.budget.otherBudgets) {
        if (summary.budget.otherBudgets.length === 0) {
          DOM.otherBudgetsGrid.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted);">Nessun altro tetto attivo. Clicca su "➕ Imposta / Modifica Tetti" per aggiungerne altri!</span>';
        } else {
          DOM.otherBudgetsGrid.innerHTML = summary.budget.otherBudgets.map(ob => `
            <div class="other-budget-chip">
              <div class="other-budget-top">
                <span class="other-budget-name">${ob.icon} ${escapeHtml(ob.name)}</span>
                <span class="badge ${ob.isOver ? 'badge-danger' : ob.percent >= 75 ? 'badge-warning' : 'badge-subtle'}">${ob.percent}%</span>
              </div>
              <div class="other-budget-meter">
                <div class="other-budget-fill" style="width:${Math.min(100, ob.percent)}%;background:${ob.isOver ? '#ef4444' : ob.percent >= 75 ? '#f59e0b' : '#10b981'};"></div>
              </div>
              <div class="other-budget-sub">
                <span>Spesi: ${formatMoney(ob.spent)}</span>
                <span>Tetto: ${formatMoney(ob.limit)}</span>
              </div>
            </div>
          `).join('');
        }
      }
    }

    // 7. Banner & Promemoria Prossimo Turno Affitto (Scadenza entro il 5 del mese)
    const [curYear, curMonthNum] = state.currentMonth.split('-').map(Number);
    const nextDate = new Date(curYear, curMonthNum, 1);
    const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    const nextMonthName = getMonthName(nextMonthStr).name;
    const curMonthName = getMonthName(state.currentMonth).name;

    // Determina chi ha l'affitto questo mese
    let thisMonthPayer = (curMonthNum % 2 !== 0) ? p1Name : p2Name;
    const rentExp = (state.data.expenses || []).find(e => e.category_id === 'affitto' || e.split_type === 'turn_rent');
    if (rentExp) {
      thisMonthPayer = rentExp.paid_by === 'partner2' ? p2Name : p1Name;
    }
    const nextMonthPayer = (thisMonthPayer === p1Name) ? p2Name : p1Name;

    // Calcolo scadenza affitto (entro il 5 del mese corrente)
    const todayStr = getTodayDateString();
    const [todayYear, todayMonthNum, todayDay] = todayStr.split('-').map(Number);
    const isActualCurrentMonth = (curYear === todayYear && curMonthNum === todayMonthNum);

    if (DOM.rentDeadlineBadge) {
      if (rentExp) {
        DOM.rentDeadlineBadge.textContent = '✅ Affitto Pagato';
        DOM.rentDeadlineBadge.className = 'badge badge-success';
      } else if (isActualCurrentMonth) {
        if (todayDay <= 5) {
          const daysLeft = 5 - todayDay;
          DOM.rentDeadlineBadge.textContent = daysLeft === 0
            ? '⚠️ Scade OGGI (entro il 5)'
            : `⏳ Scade tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'} (5 ${curMonthName})`;
          DOM.rentDeadlineBadge.className = 'badge badge-warning';
          checkAndSendRentReminder(thisMonthPayer, curMonthName, daysLeft);
        } else {
          DOM.rentDeadlineBadge.textContent = `🚨 Scaduto il 5 ${curMonthName}`;
          DOM.rentDeadlineBadge.className = 'badge badge-danger';
          checkAndSendRentReminder(thisMonthPayer, curMonthName, 0, true);
        }
      } else if (state.currentMonth < todayStr.slice(0, 7)) {
        DOM.rentDeadlineBadge.textContent = `🚨 Non registrato (scaduto)`;
        DOM.rentDeadlineBadge.className = 'badge badge-danger';
        checkAndSendRentReminder(thisMonthPayer, curMonthName, 0, true);
      } else {
        DOM.rentDeadlineBadge.textContent = `🗓️ Entro il 5 ${curMonthName}`;
        DOM.rentDeadlineBadge.className = 'badge badge-subtle';
      }
    }

    if (DOM.nextRentTickerText) {
      if (isActualCurrentMonth && !rentExp) {
        DOM.nextRentTickerText.innerHTML = `⚠️ <strong>Affitto ${curMonthName} (940 €):</strong> scadenza <strong>entro il 5 ${curMonthName}</strong> a cura di <strong>${escapeHtml(thisMonthPayer)}</strong>!`;
      } else {
        DOM.nextRentTickerText.innerHTML = `Prossimo affitto (entro il 5 ${nextMonthName}): tocca ad <strong>${escapeHtml(nextMonthPayer)}</strong> (940,00 €)`;
      }
    }

    if (DOM.rentTurnBanner) {
      DOM.rentTurnTitle.textContent = `Turno Affitto (940 €) - Scadenza entro il 5 ${curMonthName}`;
      if (rentExp) {
        DOM.rentTurnDesc.innerHTML = `✅ L'affitto di ${curMonthName} (${formatMoney(rentExp.amount)}) è stato <strong>regolarmente pagato da ${escapeHtml(thisMonthPayer)}</strong>. Il prossimo mese (entro il 5 ${nextMonthName}) toccherà ad <strong>${escapeHtml(nextMonthPayer)}</strong>.`;
      } else if (isActualCurrentMonth) {
        if (todayDay <= 5) {
          const daysLeft = 5 - todayDay;
          const scadTxt = daysLeft === 0 ? 'OGGI' : `tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}`;
          DOM.rentTurnDesc.innerHTML = `⚠️ <strong>Promemoria:</strong> L'affitto di ${curMonthName} (940,00 €) <strong>va pagato entro il 5 ${curMonthName} (${scadTxt})</strong> a carico di <strong>${escapeHtml(thisMonthPayer)}</strong>. Il mese successivo toccherà ad <strong>${escapeHtml(nextMonthPayer)}</strong>.`;
        } else {
          DOM.rentTurnDesc.innerHTML = `🚨 <strong>Attenzione:</strong> L'affitto di ${curMonthName} (940,00 €) andava pagato <strong>entro il 5 ${curMonthName}</strong> a cura di <strong>${escapeHtml(thisMonthPayer)}</strong> e non risulta ancora registrato!`;
        }
      } else {
        DOM.rentTurnDesc.innerHTML = `A ${curMonthName} l'affitto (940,00 €) va pagato <strong>entro il giorno 5</strong> da <strong>${escapeHtml(thisMonthPayer)}</strong>. Il prossimo mese (entro il 5 ${nextMonthName}) toccherà ad <strong>${escapeHtml(nextMonthPayer)}</strong>.`;
      }

      if (DOM.rentTurnBadge) {
        DOM.rentTurnBadge.textContent = `${curMonthName}: ${thisMonthPayer}`;
        DOM.rentTurnBadge.className = 'badge badge-subtle';
      }
      if (DOM.nextRentBadge) {
        DOM.nextRentBadge.textContent = `🗓️ Prossimo: ${nextMonthPayer} (entro 5 ${nextMonthName.slice(0, 3)})`;
        DOM.nextRentBadge.className = 'badge badge-success';
      }
    }

    // 8. Settlement / Pareggio Conti
    if (DOM.settlementTitle && summary.balance.title) {
      DOM.settlementTitle.textContent = summary.balance.title;
    }
    if (DOM.settlementDesc && summary.balance.explanation) {
      DOM.settlementDesc.innerHTML = summary.balance.explanation;
    }

    if (summary.balance.isSettled) {
      if (DOM.settlementIcon) DOM.settlementIcon.textContent = '🎉';
      DOM.settlementBanner.style.borderColor = '#10b981';
      DOM.settlementBanner.style.background = '#f0fdf4';

      if (summary.settlements && summary.settlements.length > 0) {
        DOM.btnSettleBalance.style.display = 'none';
        if (DOM.btnUndoSettlement) {
          DOM.btnUndoSettlement.style.display = 'inline-flex';
          DOM.btnUndoSettlement.dataset.settlementId = summary.settlements[0].id;
        }
      } else {
        DOM.btnSettleBalance.style.display = 'none';
        if (DOM.btnUndoSettlement) DOM.btnUndoSettlement.style.display = 'none';
      }
    } else {
      if (DOM.settlementIcon) DOM.settlementIcon.textContent = '⚖️';
      DOM.settlementBanner.style.borderColor = '#f59e0b';
      DOM.settlementBanner.style.background = '#fffbeb';
      DOM.btnSettleBalance.style.display = 'inline-flex';
      DOM.btnSettleBalance.innerHTML = `🤝 Pareggia i conti`;
      if (DOM.btnUndoSettlement) DOM.btnUndoSettlement.style.display = 'none';
    }
  }

  function renderCategoryFilters() {
    // Dropdown filtro categoria
    const currentVal = DOM.filterCategory.value;
    let html = '<option value="ALL">Tutte le categorie</option>';
    for (const cat of state.categories) {
      html += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    }
    DOM.filterCategory.innerHTML = html;
    DOM.filterCategory.value = currentVal || 'ALL';

    // Dropdown modal spesa
    let modalOptions = '';
    for (const cat of state.categories) {
      modalOptions += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    }
    DOM.expenseCategory.innerHTML = modalOptions;
  }

  function renderExpensesList() {
    const expenses = state.data.expenses || [];
    const p1Name = state.settings.partner1_name || 'Marco';
    const p2Name = state.settings.partner2_name || 'Angela';

    // Filtra spese
    const filtered = expenses.filter(exp => {
      if (state.filterCategory !== 'ALL' && exp.category_id !== state.filterCategory) return false;
      if (state.filterPayer !== 'ALL' && exp.paid_by !== state.filterPayer) return false;
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matchesTitle = exp.title.toLowerCase().includes(q);
        const matchesCat = (exp.category_name || '').toLowerCase().includes(q);
        const matchesNotes = (exp.notes || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCat && !matchesNotes) return false;
      }
      return true;
    });

    DOM.tabCountSpan.textContent = filtered.length;

    if (filtered.length === 0) {
      DOM.expensesListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <h3>Nessuna spesa trovata per questo mese</h3>
          <p>Clicca su "Aggiungi Spesa" o copia le spese fisse (come affitto e bollette) dal mese scorso!</p>
        </div>
      `;
      return;
    }

    // Raggruppa per data
    const groups = {};
    for (const exp of filtered) {
      if (!groups[exp.date]) groups[exp.date] = [];
      groups[exp.date].push(exp);
    }

    let html = '';
    for (const date of Object.keys(groups)) {
      const formattedDate = formatDateHeading(date);
      html += `
        <div class="expense-day-group">
          <div class="expense-day-title">${formattedDate}</div>
          <div class="expense-day-items">
      `;

      for (const exp of groups[date]) {
        let payerLabel = '';
        let payerClass = '';
        if (exp.paid_by === 'partner1') {
          payerLabel = p1Name;
          payerClass = 'payer-p1';
        } else if (exp.paid_by === 'partner2') {
          payerLabel = p2Name;
          payerClass = 'payer-p2';
        } else {
          payerLabel = 'Conto Comune';
          payerClass = 'payer-joint';
        }

        let splitLabel = '50/50';
        if (exp.split_type === '60_40') splitLabel = `60% ${p1Name} / 40% ${p2Name}`;
        else if (exp.split_type === 'turn_rent') splitLabel = `🏠 Turno Affitto (1 mese per uno)`;
        else if (exp.split_type === 'proportional') splitLabel = 'Proporzionale';
        else if (exp.split_type === '100_p1') splitLabel = `100% ${p1Name}`;
        else if (exp.split_type === '100_p2') splitLabel = `100% ${p2Name}`;

        html += `
          <div class="expense-row-card" data-id="${exp.id}">
            <div class="expense-left">
              <div class="cat-icon-badge" style="background: ${exp.category_color}1a; color: ${exp.category_color}">
                ${exp.category_icon || '📦'}
              </div>
              <div class="expense-meta-info">
                <div class="expense-title-text">
                  <span>${escapeHtml(exp.title)}</span>
                  ${exp.is_fixed ? '<span class="fixed-tag">🏠 Fissa</span>' : ''}
                </div>
                <div class="expense-tags-line">
                  <span class="payer-badge ${payerClass}">Pagato da: ${escapeHtml(payerLabel)}</span>
                  <span class="split-detail">(${splitLabel})</span>
                  ${exp.notes ? `<span>• <em>${escapeHtml(exp.notes)}</em></span>` : ''}
                </div>
              </div>
            </div>

            <div class="expense-right">
              <div class="expense-amount-number">${formatMoney(exp.amount)}</div>
              <div class="expense-actions-menu">
                <button class="btn-icon-action edit-expense" data-id="${exp.id}" title="Modifica">✏️</button>
                <button class="btn-icon-action delete delete-expense" data-id="${exp.id}" title="Elimina">🗑️</button>
              </div>
            </div>
          </div>
        `;
      }

      html += `
          </div>
        </div>
      `;
    }

    DOM.expensesListContainer.innerHTML = html;

    // Collega listener modifica / elimina
    DOM.expensesListContainer.querySelectorAll('.edit-expense').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = Number(e.currentTarget.dataset.id);
        openEditExpenseModal(id);
      });
    });

    DOM.expensesListContainer.querySelectorAll('.delete-expense').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        if (confirm('Sei sicuro di voler eliminare questa spesa?')) {
          await deleteExpense(id);
        }
      });
    });
  }

  function formatDateHeading(dateStr) {
    const today = getTodayDateString();
    if (dateStr === today) return 'Oggi';

    const d = new Date(dateStr);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return d.toLocaleDateString('it-IT', options).toUpperCase();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- RENDERING GRAFICI ---
  function renderCharts() {
    const summary = state.data.summary;
    const categories = summary.categories || [];
    const totalSpent = summary.expenses.total;

    // 1. Spese Fisse vs Variabili
    DOM.fixedBarAmount.textContent = formatMoney(summary.expenses.fixed);
    DOM.variableBarAmount.textContent = formatMoney(summary.expenses.variable);

    const fixedPct = totalSpent > 0 ? (summary.expenses.fixed / totalSpent) * 100 : 0;
    const varPct = totalSpent > 0 ? (summary.expenses.variable / totalSpent) * 100 : 0;

    DOM.fixedMeterBar.style.width = `${fixedPct}%`;
    DOM.variableMeterBar.style.width = `${varPct}%`;

    // 2. SVG Donut Chart per Categorie
    if (categories.length === 0 || totalSpent === 0) {
      DOM.donutChartSvg.innerHTML = `
        <circle cx="160" cy="160" r="100" fill="none" stroke="#e2e8f0" stroke-width="40"></circle>
        <text x="160" y="165" text-anchor="middle" font-family="Inter" font-size="14" fill="#94a3b8">Nessuna spesa</text>
      `;
      DOM.chartLegendContainer.innerHTML = '';
      return;
    }

    const radius = 100;
    const center = 160;
    const circumference = 2 * Math.PI * radius;
    let accumulatedAngle = 0;

    let svgHtml = '';
    let legendHtml = '';

    for (const cat of categories) {
      const percentage = (cat.total / totalSpent);
      const strokeLength = percentage * circumference;
      const strokeDashoffset = circumference - strokeLength;
      const rotation = (accumulatedAngle * 360) - 90;

      svgHtml += `
        <circle cx="${center}" cy="${center}" r="${radius}"
          fill="none"
          stroke="${cat.color}"
          stroke-width="36"
          stroke-dasharray="${strokeLength} ${circumference}"
          transform="rotate(${rotation} ${center} ${center})"
          style="transition: stroke-dasharray 0.5s ease;"
        ></circle>
      `;

      accumulatedAngle += percentage;

      const isFixedCat = ['affitto', 'bollette', 'internet', 'condominio', 'tari'].includes(cat.id);
      legendHtml += `
        <div class="legend-item">
          <div class="legend-left">
            <span class="legend-color-dot" style="background: ${cat.color};"></span>
            <span>${cat.icon} ${escapeHtml(cat.name)} ${isFixedCat ? '<span class="badge badge-subtle" style="font-size:0.7rem;padding:2px 6px;margin-left:4px;">Fissa</span>' : ''}</span>
          </div>
          <div class="legend-right">
            <strong>${formatMoney(cat.total)}</strong>
            <span style="color: var(--text-muted); font-size: 0.8rem;">(${Math.round(percentage * 100)}%)</span>
          </div>
        </div>
      `;
    }

    // Aggiungi centro con totale
    svgHtml += `
      <text x="${center}" y="${center - 6}" text-anchor="middle" font-family="Outfit" font-size="22" font-weight="800" fill="#0f172a">${formatMoney(totalSpent)}</text>
      <text x="${center}" y="${center + 18}" text-anchor="middle" font-family="Inter" font-size="12" font-weight="600" fill="#64748b">Totale Spese</text>
    `;

    DOM.donutChartSvg.innerHTML = svgHtml;
    DOM.chartLegendContainer.innerHTML = legendHtml;
  }

  // --- RENDERING STORICO ---
  async function loadAndRenderHistory() {
    try {
      const res = await fetch('/api/history?limit=12');
      if (!res.ok) return;
      const history = await res.json();

      let tableRows = '';
      let chartBars = '';

      const maxIncome = Math.max(...history.map(h => h.income), 1000);

      for (const item of history) {
        const { name } = getMonthName(item.month);
        const shortLabel = `${name.slice(0, 3)} ${item.month.split('-')[0].slice(2)}`;

        const incomeH = Math.round((item.income / maxIncome) * 120);
        const expenseH = Math.round((item.expenses / maxIncome) * 120);
        const savingsRateClamped = Math.max(0, item.savingsRate);

        tableRows += `
          <tr>
            <td><strong>${name} ${item.month.split('-')[0]}</strong></td>
            <td>${formatMoney(item.income)}</td>
            <td>${formatMoney(item.expenses)}</td>
            <td style="color: ${item.savings >= 0 ? 'var(--primary)' : 'var(--danger)'}; font-weight: 700;">
              ${formatMoney(item.savings)}
            </td>
            <td><span class="badge ${item.savingsRate >= 20 ? 'badge-success' : 'badge-subtle'}">${item.savingsRate}%</span></td>
          </tr>
        `;

        chartBars += `
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1;">
            <div style="height: 130px; display: flex; align-items: flex-end; gap: 4px;">
              <div style="width: 14px; height: ${incomeH}px; background: #94a3b8; border-radius: 3px;" title="Entrate: ${formatMoney(item.income)}"></div>
              <div style="width: 14px; height: ${expenseH}px; background: ${item.savings >= 0 ? '#10b981' : '#ef4444'}; border-radius: 3px;" title="Spese: ${formatMoney(item.expenses)}"></div>
            </div>
            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600;">${shortLabel}</span>
          </div>
        `;
      }

      DOM.historyTableBody.innerHTML = tableRows || '<tr><td colspan="5">Nessuno storico disponibile</td></tr>';
      DOM.historyBarChartContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; height: 160px; padding: 10px 0; border-bottom: 1px solid var(--border-color); overflow-x: auto;">
          ${chartBars}
        </div>
        <div style="display: flex; gap: 16px; justify-content: center; margin-top: 10px; font-size: 0.8rem;">
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: #94a3b8; border-radius: 2px;"></span> Entrate</span>
          <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: #10b981; border-radius: 2px;"></span> Spese</span>
        </div>
      `;
    } catch (e) {
      console.error('Errore caricamento storico', e);
    }
  }

  function applyCategoryDefaultSplit(catId) {
    const cat = state.categories.find(c => c.id === catId);
    let defaultSplit = cat ? cat.default_split : '50_50';
    if (!defaultSplit) {
      if (catId === 'spesa' || catId === 'arredo' || catId === 'pulizie') defaultSplit = '60_40';
      else if (catId === 'affitto') defaultSplit = 'turn_rent';
      else defaultSplit = '50_50';
    }

    const splitRadio = DOM.expenseForm.querySelector(`input[name="splitType"][value="${defaultSplit}"]`);
    if (splitRadio) splitRadio.checked = true;

    // Se categoria casa fissa (affitto, bollette, internet, condominio, tari), imposta is_fixed
    if (['affitto', 'bollette', 'internet', 'condominio', 'tari'].includes(catId)) {
      DOM.expenseIsFixed.checked = true;
    } else {
      DOM.expenseIsFixed.checked = false;
    }

    // Se affitto, preimposta il pagatore in base al mese: Settembre Marco, Ottobre Angela
    if (catId === 'affitto') {
      const isSept = state.currentMonth === '2026-09';
      const targetPayer = isSept ? 'partner1' : 'partner2';
      const pRadio = DOM.expenseForm.querySelector(`input[name="paidBy"][value="${targetPayer}"]`);
      if (pRadio) pRadio.checked = true;
    }
  }

  // --- GESTIONE SPESA (MODALE, SALVATAGGIO, ELIMINAZIONE) ---
  function openNewExpenseModal() {
    DOM.expenseEditId.value = '';
    DOM.modalExpenseTitle.textContent = 'Aggiungi Nuova Spesa';
    DOM.expenseForm.reset();
    
    // Se il mese visualizzato è il mese corrente (oggi), usa la data di oggi;
    // se l'utente sta visualizzando un altro mese, pre-compila con il 1° di quel mese.
    const today = getTodayDateString();
    if (today.slice(0, 7) === state.currentMonth) {
      DOM.expenseDate.value = today;
    } else {
      DOM.expenseDate.value = `${state.currentMonth}-01`;
    }
    DOM.expenseIsFixed.checked = false;

    // Assicurati che le opzioni siano presenti
    if (DOM.expenseCategory.options.length === 0 && state.categories.length > 0) {
      renderCategoryFilters();
    }

    // Seleziona categoria predefinita e applica le regole intelligenti (es. 60/40 su spesa e arredo, turno su affitto)
    if (state.categories.length > 0) {
      DOM.expenseCategory.value = state.categories[0].id;
      applyCategoryDefaultSplit(state.categories[0].id);
    } else if (DOM.expenseCategory.value) {
      applyCategoryDefaultSplit(DOM.expenseCategory.value);
    }

    DOM.modalExpense.classList.add('open');
    setTimeout(() => DOM.expenseAmount.focus(), 100);
  }

  function openEditExpenseModal(id) {
    const expense = (state.data.expenses || []).find(e => e.id === id);
    if (!expense) return;

    DOM.expenseEditId.value = expense.id;
    DOM.modalExpenseTitle.textContent = 'Modifica Spesa';
    DOM.expenseAmount.value = expense.amount;
    DOM.expenseTitle.value = expense.title;
    DOM.expenseCategory.value = expense.category_id;
    DOM.expenseDate.value = expense.date;
    DOM.expenseIsFixed.checked = Boolean(expense.is_fixed);
    DOM.expenseNotes.value = expense.notes || '';

    // Radios pagatore
    const paidByRadio = DOM.expenseForm.querySelector(`input[name="paidBy"][value="${expense.paid_by}"]`);
    if (paidByRadio) paidByRadio.checked = true;

    // Radios split
    const splitRadio = DOM.expenseForm.querySelector(`input[name="splitType"][value="${expense.split_type}"]`);
    if (splitRadio) splitRadio.checked = true;

    DOM.modalExpense.classList.add('open');
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();
    const id = DOM.expenseEditId.value;
    const amount = parseFloat(DOM.expenseAmount.value);
    const title = DOM.expenseTitle.value.trim();
    const category_id = DOM.expenseCategory.value;
    const date = DOM.expenseDate.value;
    const is_fixed = DOM.expenseIsFixed.checked ? 1 : 0;
    const paid_by = DOM.expenseForm.querySelector('input[name="paidBy"]:checked').value;
    const split_type = DOM.expenseForm.querySelector('input[name="splitType"]:checked').value;
    const notes = DOM.expenseNotes.value.trim();

    const month = date.slice(0, 7); // Mese ricavato dalla data della spesa

    const payload = {
      month,
      date,
      title,
      amount,
      category_id,
      paid_by,
      split_type,
      is_fixed,
      notes
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/expenses/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) throw new Error('Errore nel salvataggio spesa');
      DOM.modalExpense.classList.remove('open');
      showToast(id ? '✅ Spesa aggiornata!' : '✅ Spesa aggiunta!');
      
      // Assicura che l'interfaccia rimanga o si posizioni sul mese della spesa inserita
      state.currentMonth = month;
      try {
        localStorage.setItem('casa_selected_month', month);
      } catch (err) {}
      await loadMonthData(state.currentMonth);
    } catch (err) {
      console.error(err);
      alert('Impossibile salvare la spesa: ' + err.message);
    }
  }

  async function deleteExpense(id) {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'DELETE',
        headers: { 'X-Client-Id': CLIENT_ID }
      });
      if (!res.ok) throw new Error('Errore durante eliminazione');
      showToast('🗑️ Spesa eliminata');
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore eliminazione: ' + err.message);
    }
  }

  // --- GESTIONE STIPENDI & ENTRATE ---
  function openIncomesModal(focusPartner = null) {
    const incomes = (state.data && state.data.incomes) ? state.data.incomes : {};
    const settings = state.settings || {};
    const { name, year } = getMonthName(state.currentMonth);
    DOM.incomesModalMonth.textContent = `${name} ${year}`;

    // Popola con i valori del mese corrente oppure fallback su impostazioni predefinite
    const p1Val = (incomes.income_partner1 !== undefined && incomes.income_partner1 !== null && incomes.income_partner1 !== '')
      ? incomes.income_partner1
      : (parseFloat(settings.default_income_p1) || 2700);
    const p2Val = (incomes.income_partner2 !== undefined && incomes.income_partner2 !== null && incomes.income_partner2 !== '')
      ? incomes.income_partner2
      : (parseFloat(settings.default_income_p2) || 2200);

    DOM.inputIncomeP1.value = p1Val;
    DOM.inputIncomeP2.value = p2Val;
    DOM.inputIncomeExtra.value = incomes.extra_income || '';

    // Aggiorna etichette partner nel modale
    const p1Name = settings.partner1_name || 'Marco';
    const p2Name = settings.partner2_name || 'Angela';
    document.querySelectorAll('.lbl-p1').forEach(el => el.textContent = p1Name);
    document.querySelectorAll('.lbl-p2').forEach(el => el.textContent = p2Name);

    DOM.modalIncomes.classList.add('open');

    setTimeout(() => {
      if (focusPartner === 'partner2') {
        if (DOM.inputIncomeP2) {
          DOM.inputIncomeP2.focus();
          DOM.inputIncomeP2.select();
        }
      } else {
        if (DOM.inputIncomeP1) {
          DOM.inputIncomeP1.focus();
          DOM.inputIncomeP1.select();
        }
      }
    }, 150);
  }

  async function handleIncomesSubmit(e) {
    e.preventDefault();
    const p1 = parseFloat(DOM.inputIncomeP1.value) || 0;
    const p2 = parseFloat(DOM.inputIncomeP2.value) || 0;
    const extra = parseFloat(DOM.inputIncomeExtra.value) || 0;
    const saveDefault = DOM.checkSaveAsDefaultSalaries ? DOM.checkSaveAsDefaultSalaries.checked : true;

    try {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
        body: JSON.stringify({
          month: state.currentMonth,
          income_partner1: p1,
          income_partner2: p2,
          extra_income: extra,
          saveAsDefault: saveDefault
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Errore aggiornamento stipendi');
      }

      const resData = await res.json();
      if (resData && resData.summary) {
        state.data.summary = resData.summary;
        if (resData.incomes) state.data.incomes = resData.incomes;
        if (resData.settings) state.settings = resData.settings;
        updatePartnerLabels();
        renderHeroSummary();
        renderExpensesList();
        renderCharts();
      }

      DOM.modalIncomes.classList.remove('open');
      showToast('💰 Stipendi e budget aggiornati con successo!');
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  // --- COPIA SPESE FISSE DAL MESE SCORSO ---
  async function handleCopyFixedExpenses() {
    const { name } = getMonthName(state.currentMonth);
    if (!confirm(`Vuoi importare le spese fisse (come affitto, bollette ricorrenti e condominio) dal mese scorso in ${name}?`)) {
      return;
    }

    try {
      const res = await fetch('/api/month/copy-fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: state.currentMonth })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore nella copia');

      if (data.copiedCount > 0) {
        showToast(`📋 Copiate ${data.copiedCount} spese fisse!`);
      } else {
        showToast(`ℹ️ Le spese fisse per questo mese sono già presenti.`);
      }
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore nella copia delle spese fisse: ' + err.message);
    }
  }

  // --- PRESET RAPIDI SPESE FREQUENTI ---
  const PRESETS = {
    spesa: {
      title: 'Spesa Supermercato',
      category: 'spesa',
      split: '60_40',
      fixed: false
    },
    bollette: {
      title: 'Bolletta Utenze (Luce/Gas/Acqua)',
      category: 'bollette',
      split: '50_50',
      fixed: true
    },
    pulizie: {
      title: 'Detergenti & Cura Casa',
      category: 'pulizie',
      split: '60_40',
      fixed: false
    },
    ristoranti: {
      title: 'Cena Fuori / Asporto',
      category: 'ristoranti',
      split: '50_50',
      fixed: false
    },
    salute: {
      title: 'Farmacia & Salute',
      category: 'salute',
      split: '50_50',
      fixed: false
    }
  };

  function applyQuickPreset(presetKey, openModal = false) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    if (openModal) {
      openNewExpenseModal();
    }

    if (DOM.expenseTitle) DOM.expenseTitle.value = preset.title;
    if (DOM.expenseCategory) DOM.expenseCategory.value = preset.category;
    if (DOM.expenseIsFixed) DOM.expenseIsFixed.checked = preset.fixed;

    const splitRadio = DOM.expenseForm ? DOM.expenseForm.querySelector(`input[name="splitType"][value="${preset.split}"]`) : null;
    if (splitRadio) splitRadio.checked = true;

    // Evidenzia visivamente il preset attivo se dentro il modale
    document.querySelectorAll('.preset-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.preset === presetKey);
    });

    setTimeout(() => {
      if (DOM.expenseAmount) DOM.expenseAmount.focus();
    }, 150);
  }

  // --- PAREGGIO CONTI / SALDO ---
  function openSettlementModal() {
    const summary = state.data ? state.data.summary : null;
    if (!summary || !summary.balance) return;

    const balance = summary.balance.current;
    if (Math.abs(balance) < 0.01) {
      showToast('🎉 I conti sono già perfettamente in pari!');
      return;
    }

    const p1Name = summary.partners.partner1.name;
    const p2Name = summary.partners.partner2.name;
    const amt = Math.abs(balance);
    const payerName = balance > 0 ? p2Name : p1Name;
    const recipientName = balance > 0 ? p1Name : p2Name;

    if (DOM.settlementPromptText) {
      DOM.settlementPromptText.innerHTML = `Registra il rimborso di <strong>${formatMoney(amt)}</strong> da <strong>${escapeHtml(payerName)}</strong> a <strong>${escapeHtml(recipientName)}</strong> per pareggiare le spese di ${getMonthName(state.currentMonth).name}.`;
    }
    if (DOM.settlementAmount) {
      DOM.settlementAmount.value = amt.toFixed(2);
    }
    if (DOM.settlementNotes) {
      DOM.settlementNotes.value = `Pareggio spese ${getMonthName(state.currentMonth).name} effettuato`;
    }

    DOM.modalSettlement.classList.add('open');
  }

  async function handleSettlementSubmit(e) {
    e.preventDefault();
    const summary = state.data ? state.data.summary : null;
    if (!summary || !summary.balance) return;

    const balance = summary.balance.current;
    const amt = parseFloat(DOM.settlementAmount ? DOM.settlementAmount.value : 0);
    if (!amt || amt <= 0) {
      alert('Inserisci un importo valido superiore a 0 €.');
      return;
    }

    const from_partner = balance > 0 ? 'partner2' : 'partner1';
    const to_partner = balance > 0 ? 'partner1' : 'partner2';
    const notes = DOM.settlementNotes ? DOM.settlementNotes.value.trim() : '';

    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
        body: JSON.stringify({
          month: state.currentMonth,
          amount: amt,
          from_partner,
          to_partner,
          notes: notes || `Pareggio spese ${getMonthName(state.currentMonth).name} effettuato`
        })
      });

      if (!res.ok) throw new Error('Errore durante la registrazione del pareggio');

      DOM.modalSettlement.classList.remove('open');
      showToast(`🤝 Pareggio registrato con successo! Conti saldati.`);
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  async function handleUndoSettlement() {
    const summary = state.data.summary;
    if (!summary.settlements || summary.settlements.length === 0) return;
    const s = summary.settlements[0];
    const confirmed = confirm(`Vuoi annullare la registrazione del rimborso di ${formatMoney(s.amount)} e riaprire il saldo di questo mese?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/settlements/${s.id}`, {
        method: 'DELETE',
        headers: { 'X-Client-Id': CLIENT_ID }
      });
      if (!res.ok) throw new Error('Errore annullamento pareggio');
      showToast('↩️ Pareggio annullato. Saldo riaperto.');
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  // --- GESTIONE TETTO SPESA ALIMENTARE (QUOTA LIMITE) ---
  function handleEditBudgetLimit() {
    const currentFoodLimit = (state.data && state.data.summary && state.data.summary.budget && state.data.summary.budget.food)
      ? state.data.summary.budget.food.limit
      : (parseFloat(state.settings.budget_food) || 400);

    const input = prompt(
      '🛒 Inserisci la nuova quota limite mensile (€) per la Spesa Alimentare (Supermercato):',
      currentFoodLimit
    );
    if (input === null) return;
    const cleanInput = input.replace(',', '.').trim();
    const newLimit = parseFloat(cleanInput);
    if (isNaN(newLimit) || newLimit <= 0) {
      alert('Inserisci un importo valido superiore a 0 €.');
      return;
    }

    saveBudgetLimit(newLimit);
  }

  async function saveBudgetLimit(limit) {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget_food: limit })
      });
      if (!res.ok) throw new Error('Errore salvataggio quota limite');
      showToast(`🛒 Tetto Spesa Alimentare impostato a ${formatMoney(limit)}!`);
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  // --- MODALE IMPOSTAZIONI ---
  function openSettingsModal() {
    const s = state.settings || {};
    DOM.settingP1Name.value = s.partner1_name || 'Marco';
    DOM.settingP2Name.value = s.partner2_name || 'Angela';
    DOM.settingDefIncomeP1.value = (s.default_income_p1 !== undefined && s.default_income_p1 !== null) ? s.default_income_p1 : '2700';
    DOM.settingDefIncomeP2.value = (s.default_income_p2 !== undefined && s.default_income_p2 !== null) ? s.default_income_p2 : '2200';
    DOM.settingSplitPref.value = s.split_preference || '50_50';

    if (DOM.settingFoodBudget) {
      DOM.settingFoodBudget.value = s.budget_food || '400';
    }

    let catBudgets = {};
    try {
      if (s.category_budgets) catBudgets = JSON.parse(s.category_budgets);
    } catch (e) {}

    if (DOM.settingRestaurantBudget) {
      DOM.settingRestaurantBudget.value = catBudgets.ristoranti !== undefined ? catBudgets.ristoranti : '150';
    }
    if (DOM.settingCleaningBudget) {
      DOM.settingCleaningBudget.value = catBudgets.pulizie !== undefined ? catBudgets.pulizie : '100';
    }

    if (DOM.settingsStorageBadge) {
      const storage = state.networkInfo && state.networkInfo.storage;
      if (storage) {
        DOM.settingsStorageBadge.textContent = `💾 ${storage.storageType || 'Archivio'} (${Math.round((storage.sizeBytes || 0) / 1024)} KB)`;
        DOM.settingsStorageBadge.className = storage.isPersistentDisk ? 'badge badge-success' : 'badge badge-info';
      }
    }

    DOM.modalSettings.classList.add('open');
  }

  async function handleSettingsSubmit(e) {
    e.preventDefault();

    const catBudgets = {
      ristoranti: parseFloat(DOM.settingRestaurantBudget ? DOM.settingRestaurantBudget.value : 150) || 0,
      pulizie: parseFloat(DOM.settingCleaningBudget ? DOM.settingCleaningBudget.value : 100) || 0
    };

    const p1Raw = DOM.settingDefIncomeP1 ? DOM.settingDefIncomeP1.value.trim() : '';
    const p2Raw = DOM.settingDefIncomeP2 ? DOM.settingDefIncomeP2.value.trim() : '';
    const p1Def = p1Raw !== '' ? (parseFloat(p1Raw) || 0) : 2700;
    const p2Def = p2Raw !== '' ? (parseFloat(p2Raw) || 0) : 2200;

    const payload = {
      partner1_name: DOM.settingP1Name.value.trim() || 'Marco',
      partner2_name: DOM.settingP2Name.value.trim() || 'Angela',
      default_income_p1: p1Def,
      default_income_p2: p2Def,
      split_preference: DOM.settingSplitPref.value,
      budget_food: parseFloat(DOM.settingFoodBudget ? DOM.settingFoodBudget.value : 400) || 400,
      category_budgets: JSON.stringify(catBudgets),
      month: state.currentMonth,
      apply_to_current_month: true
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Client-Id': CLIENT_ID },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Errore aggiornamento impostazioni');
      const updated = await res.json();
      if (updated && updated._summary) {
        state.data.summary = updated._summary;
        state.settings = updated;
        updatePartnerLabels();
        renderHeroSummary();
        renderExpensesList();
        renderCharts();
      }
      DOM.modalSettings.classList.remove('open');
      showToast('⚙️ Impostazioni salvate e bilancio aggiornato!');
      await loadMonthData(state.currentMonth);
    } catch (err) {
      alert('Errore: ' + err.message);
    }
  }

  // --- MODALE CONDIVISIONE SMARTPHONE, LINK FISSO & GENERATORE QR CODE ---
  state.shareMode = 'tunnel';

  function updateShareModalContent() {
    const tunnel = state.networkInfo;
    const tunnelUrl = tunnel ? tunnel.tunnelUrl : null;
    const isPermanent = tunnel ? !!tunnel.isPermanent : false;
    const localUrl = (tunnel && tunnel.mobileUrl) || `${window.location.protocol}//${window.location.hostname}:3000`;

    let activeUrl = '';
    if (state.shareMode === 'tunnel' && tunnelUrl) {
      activeUrl = tunnelUrl;
      if (DOM.shareTypeBadge) {
        if (isPermanent) {
          DOM.shareTypeBadge.className = 'badge badge-success';
          DOM.shareTypeBadge.innerHTML = '🔒 LINK FISSO PERMANENTE (Non cambia mai al riavvio)';
        } else {
          DOM.shareTypeBadge.className = 'badge badge-warning';
          DOM.shareTypeBadge.innerHTML = '⚠️ LINK PROVVISORIO (TryCloudflare: cambia al riavvio)';
        }
      }
      if (DOM.btnToggleShareType) {
        DOM.btnToggleShareType.textContent = '🏠 Mostra Wi-Fi Locale';
      }
    } else {
      activeUrl = localUrl;
      if (DOM.shareTypeBadge) {
        DOM.shareTypeBadge.className = 'badge badge-warning';
        DOM.shareTypeBadge.innerHTML = '🏠 Wi-Fi di Casa (Solo stessa rete locale)';
      }
      if (DOM.btnToggleShareType) {
        DOM.btnToggleShareType.textContent = tunnelUrl ? (isPermanent ? '🔒 Mostra Link Fisso Permanente' : '🌍 Mostra Link Cloudflare') : '🔄 Attesa Cloudflare...';
      }
    }

    if (DOM.shareUrlInput) {
      DOM.shareUrlInput.value = activeUrl;
    }
    renderQrCode(activeUrl);

    if (DOM.inputFixedUrl && tunnel && tunnel.fixedUrl) {
      DOM.inputFixedUrl.value = tunnel.fixedUrl;
    }
  }

  async function openShareModal() {
    await fetchNetworkInfo();
    state.shareMode = (state.networkInfo && state.networkInfo.tunnelUrl) ? 'tunnel' : 'local';
    updateShareModalContent();
    DOM.modalShare.classList.add('open');
  }

  function toggleFixedConfigPanel() {
    if (!DOM.fixedConfigContent) return;
    const isHidden = (DOM.fixedConfigContent.style.display === 'none' || !DOM.fixedConfigContent.style.display);
    DOM.fixedConfigContent.style.display = isHidden ? 'block' : 'none';
    if (DOM.btnToggleFixedConfig) {
      DOM.btnToggleFixedConfig.textContent = isHidden ? 'Comprimi' : 'Espandi';
    }
  }

  async function handleSaveTunnelConfig() {
    const token = DOM.inputTunnelToken ? DOM.inputTunnelToken.value.trim() : '';
    let fixedUrl = DOM.inputFixedUrl ? DOM.inputFixedUrl.value.trim() : '';

    if (!token && !fixedUrl) {
      alert('Inserisci il Token di Cloudflare Tunnel o un URL fisso (es. https://spese.tuodominio.it).');
      return;
    }

    if (fixedUrl && !fixedUrl.startsWith('http://') && !fixedUrl.startsWith('https://')) {
      fixedUrl = 'https://' + fixedUrl;
      if (DOM.inputFixedUrl) DOM.inputFixedUrl.value = fixedUrl;
    }

    if (DOM.tunnelConfigStatusMsg) {
      DOM.tunnelConfigStatusMsg.style.display = 'block';
      DOM.tunnelConfigStatusMsg.style.color = '#3b82f6';
      DOM.tunnelConfigStatusMsg.textContent = '🔄 Salvataggio configurazione e riavvio tunnel in corso...';
    }

    try {
      const res = await fetch('/api/tunnel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, fixedUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore configurazione tunnel');

      await fetchNetworkInfo();
      updateTunnelUI();
      updateShareModalContent();

      if (DOM.tunnelConfigStatusMsg) {
        DOM.tunnelConfigStatusMsg.style.color = '#10b981';
        DOM.tunnelConfigStatusMsg.textContent = '✅ Link fisso permanente salvato e collegato!';
      }
      showToast('🔒 Link Fisso Permanente attivato!');
    } catch (err) {
      if (DOM.tunnelConfigStatusMsg) {
        DOM.tunnelConfigStatusMsg.style.color = '#ef4444';
        DOM.tunnelConfigStatusMsg.textContent = `❌ Errore: ${err.message}`;
      }
      showToast('❌ Errore configurazione link fisso');
    }
  }

  async function handleResetTunnelConfig() {
    if (!confirm('Vuoi ripristinare la modalità provvisoria Quick Tunnel (trycloudflare)?')) {
      return;
    }

    if (DOM.tunnelConfigStatusMsg) {
      DOM.tunnelConfigStatusMsg.style.display = 'block';
      DOM.tunnelConfigStatusMsg.style.color = '#3b82f6';
      DOM.tunnelConfigStatusMsg.textContent = '🔄 Ripristino modalità Quick Tunnel in corso...';
    }

    try {
      const res = await fetch('/api/tunnel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'quick', token: '', fixedUrl: '' })
      });
      if (!res.ok) throw new Error('Errore ripristino configurazione');

      if (DOM.inputTunnelToken) DOM.inputTunnelToken.value = '';
      if (DOM.inputFixedUrl) DOM.inputFixedUrl.value = '';

      await fetchNetworkInfo();
      updateTunnelUI();
      updateShareModalContent();

      if (DOM.tunnelConfigStatusMsg) {
        DOM.tunnelConfigStatusMsg.style.color = '#10b981';
        DOM.tunnelConfigStatusMsg.textContent = '✅ Ripristinata modalità Quick Tunnel provvisoria.';
      }
      showToast('🔄 Quick Tunnel ripristinato');
    } catch (err) {
      if (DOM.tunnelConfigStatusMsg) {
        DOM.tunnelConfigStatusMsg.style.color = '#ef4444';
        DOM.tunnelConfigStatusMsg.textContent = `❌ Errore: ${err.message}`;
      }
      showToast('❌ Errore ripristino');
    }
  }

  async function handleTestTunnelReachability() {
    const targetUrl = (DOM.inputFixedUrl && DOM.inputFixedUrl.value.trim()) || (state.networkInfo && state.networkInfo.tunnelUrl);
    if (!targetUrl) {
      alert('Nessun URL da verificare.');
      return;
    }

    if (DOM.tunnelConfigStatusMsg) {
      DOM.tunnelConfigStatusMsg.style.display = 'block';
      DOM.tunnelConfigStatusMsg.style.color = '#3b82f6';
      DOM.tunnelConfigStatusMsg.textContent = `🧪 Verifica connettività esterna verso ${targetUrl}...`;
    }

    try {
      const res = await fetch('/api/tunnel/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });
      const result = await res.json();
      if (result.success) {
        if (DOM.tunnelConfigStatusMsg) {
          DOM.tunnelConfigStatusMsg.style.color = '#10b981';
          DOM.tunnelConfigStatusMsg.textContent = `✅ Server raggiungibile da internet! (Status: ${result.statusCode})`;
        }
        showToast('✅ Connettività esterna verificata con successo!');
      } else {
        if (DOM.tunnelConfigStatusMsg) {
          DOM.tunnelConfigStatusMsg.style.color = '#ef4444';
          DOM.tunnelConfigStatusMsg.textContent = `⚠️ Non raggiungibile: ${result.error || 'Nessuna risposta'}`;
        }
      }
    } catch (e) {
      if (DOM.tunnelConfigStatusMsg) {
        DOM.tunnelConfigStatusMsg.style.color = '#ef4444';
        DOM.tunnelConfigStatusMsg.textContent = `❌ Errore test: ${e.message}`;
      }
    }
  }

  // --- GESTIONE PWA INSTALL PROMPT & OFFLINE ---
  let deferredInstallPrompt = null;

  function initPwaInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (DOM.pwaInstallBanner) {
        DOM.pwaInstallBanner.style.display = 'flex';
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (DOM.pwaInstallBanner) DOM.pwaInstallBanner.style.display = 'none';
      showToast('🎉 Casa & Spese installata con successo sulla schermata Home!');
    });

    if (DOM.btnInstallPwa) {
      DOM.btnInstallPwa.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          openShareModal();
          return;
        }
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('📲 Installazione avviata!');
        }
        deferredInstallPrompt = null;
        if (DOM.pwaInstallBanner) DOM.pwaInstallBanner.style.display = 'none';
      });
    }

    if (DOM.btnDismissInstall) {
      DOM.btnDismissInstall.addEventListener('click', () => {
        if (DOM.pwaInstallBanner) DOM.pwaInstallBanner.style.display = 'none';
      });
    }
    window.addEventListener('online', () => {
      updateOnlineStatus();
      showToast('🟢 Connessione internet ripristinata!');
      loadMonthData(state.currentMonth, false);
      fetchNetworkInfo().then(updateTunnelUI);
    });

    window.addEventListener('offline', () => {
      updateOnlineStatus();
      showToast('⚠️ Connessione internet assente: modalità offline attiva');
    });
  }

  async function triggerBroadcastTestNotification() {
    try {
      showToast('🚀 Invio notifica di prova su tutti i telefoni...');
      const res = await fetch('/api/notifications/test', { method: 'POST' });
      if (res.ok) {
        showToast('🔔 Notifica inviata! Verifica lo smartphone.');
      } else {
        showToast('⚠️ Errore durante l\'invio della notifica');
      }
    } catch (e) {
      showToast('⚠️ Impossibile contattare il server');
    }
  }

  // Semplice e robusto generatore QR Code SVG (client-side standalone)
  function renderQrCode(text) {
    if (!DOM.qrCodeWrapper) return;
    if (!text) {
      DOM.qrCodeWrapper.innerHTML = '<div style="padding:20px;font-size:0.85rem;color:#64748b">In attesa dell\'indirizzo di connessione...</div>';
      return;
    }
    const encoded = encodeURIComponent(text);
    DOM.qrCodeWrapper.innerHTML = `
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}" 
           alt="QR Code per smartphone" 
           style="width: 200px; height: 200px; border-radius: 8px; display: block;"
           onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding:20px;font-size:0.85rem;color:#64748b\\'>Apri questo link dal telefono:<br><strong style=\\'color:#0f172a\\'>${escapeHtml(text)}</strong></div>';">
    `;
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Navigazione Mese
    DOM.btnPrevMonth.addEventListener('click', () => {
      const [year, month] = state.currentMonth.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      loadMonthData(prevMonthStr);
    });

    DOM.btnNextMonth.addEventListener('click', () => {
      const [year, month] = state.currentMonth.split('-').map(Number);
      const nextDate = new Date(year, month, 1);
      const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      loadMonthData(nextMonthStr);
    });

    DOM.btnCurrentMonth.addEventListener('click', () => {
      loadMonthData(getTodayMonthString());
    });

    // Modali Trigger & Azioni
    DOM.btnOpenNewExpenseModal.addEventListener('click', openNewExpenseModal);
    DOM.fabMobileAdd.addEventListener('click', openNewExpenseModal);
    DOM.btnEditIncomes.addEventListener('click', () => openIncomesModal());

    // Trigger modifica stipendi dedicati per partner
    if (DOM.btnEditIncomeP1) {
      DOM.btnEditIncomeP1.addEventListener('click', (e) => {
        e.stopPropagation();
        openIncomesModal('partner1');
      });
    }
    if (DOM.btnEditIncomeP2) {
      DOM.btnEditIncomeP2.addEventListener('click', (e) => {
        e.stopPropagation();
        openIncomesModal('partner2');
      });
    }
    if (DOM.partner1RatioDisplay) {
      DOM.partner1RatioDisplay.addEventListener('click', () => openIncomesModal('partner1'));
    }
    if (DOM.partner2RatioDisplay) {
      DOM.partner2RatioDisplay.addEventListener('click', () => openIncomesModal('partner2'));
    }
    if (DOM.partner1BaseIncomeRow) {
      DOM.partner1BaseIncomeRow.addEventListener('click', () => openIncomesModal('partner1'));
    }
    if (DOM.partner2BaseIncomeRow) {
      DOM.partner2BaseIncomeRow.addEventListener('click', () => openIncomesModal('partner2'));
    }
    if (DOM.incomesBreakdownText) {
      DOM.incomesBreakdownText.style.cursor = 'pointer';
      DOM.incomesBreakdownText.addEventListener('click', () => openIncomesModal());
    }
    if (DOM.totalIncomeDisplay) {
      DOM.totalIncomeDisplay.style.cursor = 'pointer';
      DOM.totalIncomeDisplay.addEventListener('click', () => openIncomesModal());
    }
    if (DOM.cardIncomeHero) {
      DOM.cardIncomeHero.style.cursor = 'pointer';
      DOM.cardIncomeHero.addEventListener('click', (e) => {
        if (!e.target.closest('#btnEditIncomes')) {
          openIncomesModal();
        }
      });
    }

    DOM.btnCopyFixedModal.addEventListener('click', handleCopyFixedExpenses);
    DOM.btnSettleBalance.addEventListener('click', openSettlementModal);
    if (DOM.btnUndoSettlement) {
      DOM.btnUndoSettlement.addEventListener('click', handleUndoSettlement);
    }
    if (DOM.btnEditBudgetLimit) {
      DOM.btnEditBudgetLimit.addEventListener('click', handleEditBudgetLimit);
    }
    if (DOM.btnAddCategoryBudget) {
      DOM.btnAddCategoryBudget.addEventListener('click', openSettingsModal);
    }
    if (DOM.btnToggleNotifications) {
      DOM.btnToggleNotifications.addEventListener('click', handleToggleNotifications);
    }
    DOM.btnSharePhone.addEventListener('click', openShareModal);
    DOM.btnOpenSettings.addEventListener('click', openSettingsModal);

    // Scorciatoie Spese Frequenti (Quick Chips Bar & Modal Presets)
    document.querySelectorAll('.quick-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyQuickPreset(btn.dataset.preset, true);
      });
    });

    document.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        applyQuickPreset(btn.dataset.preset, false);
      });
    });

    // Chiusura Modali
    const modals = [
      { el: DOM.modalExpense, close: [DOM.btnCloseExpenseModal, DOM.btnCancelExpense] },
      { el: DOM.modalIncomes, close: [DOM.btnCloseIncomesModal, DOM.btnCancelIncomes] },
      { el: DOM.modalSettlement, close: [DOM.btnCloseSettlementModal, DOM.btnCancelSettlement] },
      { el: DOM.modalSettings, close: [DOM.btnCloseSettingsModal, DOM.btnCancelSettings] },
      { el: DOM.modalShare, close: [DOM.btnCloseShareModal] }
    ];

    for (const m of modals) {
      for (const btn of m.close) {
        if (btn) btn.addEventListener('click', () => m.el.classList.remove('open'));
      }
      // Click sullo sfondo
      m.el.addEventListener('click', (e) => {
        if (e.target === m.el) m.el.classList.remove('open');
      });
    }

    // Form Submits
    DOM.expenseForm.addEventListener('submit', handleExpenseSubmit);
    DOM.incomesForm.addEventListener('submit', handleIncomesSubmit);
    DOM.settlementForm.addEventListener('submit', handleSettlementSubmit);
    DOM.settingsForm.addEventListener('submit', handleSettingsSubmit);

    // Filtri e Ricerca
    DOM.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderExpensesList();
    });

    DOM.expenseCategory.addEventListener('change', (e) => {
      applyCategoryDefaultSplit(e.target.value);
    });

    DOM.filterCategory.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderExpensesList();
    });

    DOM.filterPayer.addEventListener('change', (e) => {
      state.filterPayer = e.target.value;
      renderExpensesList();
    });

    // Navigazione Tab
    DOM.tabsNav.forEach(btn => {
      btn.addEventListener('click', (e) => {
        DOM.tabsNav.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        const tabId = e.currentTarget.dataset.tab;
        state.activeTab = tabId;

        DOM.tabExpenses.classList.remove('active');
        DOM.tabCharts.classList.remove('active');
        DOM.tabHistory.classList.remove('active');

        document.getElementById(tabId).classList.add('active');

        if (tabId === 'tabCharts') renderCharts();
        if (tabId === 'tabHistory') loadAndRenderHistory();
      });
    });

    // Copia Link Share con fallback per browser mobili o contesti non-HTTPS
    DOM.btnCopyShareUrl.addEventListener('click', async () => {
      DOM.shareUrlInput.select();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(DOM.shareUrlInput.value);
        } else {
          document.execCommand('copy');
        }
        showToast('📋 Link copiato negli appunti!');
      } catch (e) {
        document.execCommand('copy');
        showToast('📋 Link copiato negli appunti!');
      }
    });

    // Sincronizzazione automatica al ripristino dell'app da background (sblocco smartphone o switch 4G/Wi-Fi)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadMonthData(state.currentMonth, false);
        fetchNetworkInfo().then(updateTunnelUI);
      }
    });
    window.addEventListener('online', () => {
      loadMonthData(state.currentMonth, false);
      fetchNetworkInfo().then(updateTunnelUI);
    });

    // Cloudflare Tunnel & Notifiche Test
    if (DOM.headerTunnelStatus) {
      DOM.headerTunnelStatus.addEventListener('click', openShareModal);
    }
    if (DOM.btnToggleShareType) {
      DOM.btnToggleShareType.addEventListener('click', () => {
        state.shareMode = (state.shareMode === 'tunnel') ? 'local' : 'tunnel';
        updateShareModalContent();
      });
    }
    if (DOM.btnBroadcastTestNotif) {
      DOM.btnBroadcastTestNotif.addEventListener('click', triggerBroadcastTestNotification);
    }
    if (DOM.btnSettingsTestNotif) {
      DOM.btnSettingsTestNotif.addEventListener('click', triggerBroadcastTestNotification);
    }

    // Condivisione WhatsApp per Angela & Marco
    if (DOM.btnShareWhatsApp) {
      DOM.btnShareWhatsApp.addEventListener('click', () => {
        const url = DOM.shareUrlInput ? DOM.shareUrlInput.value : '';
        if (!url) return;
        const text = encodeURIComponent(`🏡 Ciao! Ecco il link per Casa & Spese sul telefono:\n${url}\n\nAggiungilo alla schermata Home del telefono per usarlo comodamente come un'app!`);
        window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
      });
    }

    // Toggle Pannello Configurazione Link Fisso
    if (DOM.headerFixedConfigToggle) {
      DOM.headerFixedConfigToggle.addEventListener('click', toggleFixedConfigPanel);
    }
    if (DOM.btnToggleFixedConfig) {
      DOM.btnToggleFixedConfig.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFixedConfigPanel();
      });
    }

    // Azioni Configurazione Link Fisso
    if (DOM.btnSaveTunnelConfig) {
      DOM.btnSaveTunnelConfig.addEventListener('click', handleSaveTunnelConfig);
    }
    if (DOM.btnTestTunnelReachability) {
      DOM.btnTestTunnelReachability.addEventListener('click', handleTestTunnelReachability);
    }
    if (DOM.btnResetTunnelConfig) {
      DOM.btnResetTunnelConfig.addEventListener('click', handleResetTunnelConfig);
    }
    if (DOM.btnSettingsOpenFixedTunnel) {
      DOM.btnSettingsOpenFixedTunnel.addEventListener('click', () => {
        DOM.modalSettings.classList.remove('open');
        openShareModal();
        toggleFixedConfigPanel();
      });
    }

    // Gestione Ripristino Backup (JSON)
    if (DOM.btnTriggerRestore && DOM.inputRestoreFile) {
      DOM.btnTriggerRestore.addEventListener('click', () => {
        DOM.inputRestoreFile.click();
      });

      DOM.inputRestoreFile.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        try {
          const text = await file.text();
          const json = JSON.parse(text);
          if (!json.data) {
            alert('File non valido: assicurati che sia un file di backup JSON esportato da Casa & Spese.');
            return;
          }

          if (!confirm(`Sei sicuro di voler ripristinare il backup "${file.name}"? I dati attuali verranno sostituiti con quelli del backup.`)) {
            DOM.inputRestoreFile.value = '';
            return;
          }

          const res = await fetch('/api/backup/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
          });
          const result = await res.json();
          if (res.ok && result.success) {
            showToast('✅ Dati ripristinati con successo!');
            await loadMonthData(state.currentMonth, false);
          } else {
            alert('Errore nel ripristino: ' + (result.error || 'Errore sconosciuto'));
          }
        } catch (err) {
          alert('Errore nella lettura del file di backup: ' + err.message);
        } finally {
          DOM.inputRestoreFile.value = '';
        }
      });
    }
  }

  // --- AVVIO APP ---
  async function init() {
    try {
      setupEventListeners();
    } catch (e) {
      console.warn('Errore setupEventListeners:', e);
    }

    try {
      updateOnlineStatus();
    } catch (e) {
      console.warn('Errore updateOnlineStatus:', e);
    }

    try {
      initPwaInstallPrompt();
    } catch (e) {
      console.warn('Errore initPwaInstallPrompt:', e);
    }

    try {
      await registerServiceWorker();
    } catch (e) {
      console.warn('Errore registerServiceWorker:', e);
    }

    try {
      updateNotificationButtonUI();
    } catch (e) {
      console.warn('Errore updateNotificationButtonUI:', e);
    }

    try {
      await fetchNetworkInfo();
      updateTunnelUI();
    } catch (e) {
      console.warn('Errore fetchNetworkInfo:', e);
    }

    try {
      const catRes = await fetch('/api/categories');
      if (catRes.ok) {
        state.categories = await catRes.json();
        renderCategoryFilters();
      }
    } catch (e) {
      console.warn('Errore precaricamento categorie', e);
    }

    // Caricamento prioritario e protetto dello stato del mese
    try {
      await loadMonthData(state.currentMonth);
    } catch (e) {
      console.error('Errore critico caricamento dati mese:', e);
    }

    try {
      initRealtimeSync();
    } catch (e) {
      console.warn('Errore initRealtimeSync:', e);
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
