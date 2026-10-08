// database.js - Gestione del Database SQLite per Gestione Spese di Coppia
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_FILE = path.join(__dirname, 'spese_coppia.db');
const RESOLVED_DB_FILE = process.env.DB_PATH || (fs.existsSync('/var/data') ? '/var/data/spese_coppia.db' : DEFAULT_DB_FILE);

class DatabaseManager {
  constructor(filePath = RESOLVED_DB_FILE) {
    this.filePath = filePath;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.warn(`[DB] Impossibile creare cartella ${dir}:`, e.message);
      }
    }

    // Se il target è un disco persistente di produzione (es. /var/data o indicato esplicitamente da DB_PATH) e non esiste ancora,
    // copiamo il file pre-popolato per non perdere i dati esistenti di Marco ed Angela!
    const isExplicitPersistentTarget = (process.env.DB_PATH && path.resolve(this.filePath) === path.resolve(process.env.DB_PATH)) || this.filePath.startsWith('/var/data');
    if (isExplicitPersistentTarget && !fs.existsSync(this.filePath) && fs.existsSync(DEFAULT_DB_FILE) && path.resolve(this.filePath) !== path.resolve(DEFAULT_DB_FILE)) {
      try {
        fs.copyFileSync(DEFAULT_DB_FILE, this.filePath);
        console.log(`[DB] Inizializzazione completata: database di coppia copiato in archivio persistente (${this.filePath})`);
      } catch (err) {
        console.warn(`[DB] Errore copia database iniziale:`, err.message);
      }
    }

    this.db = new DatabaseSync(this.filePath);
    try {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
    } catch (e) {
      console.warn('[DB] Impossibile abilitare WAL mode:', e.message);
    }
    this.initTables();
    this.seedDefaultData();
  }

  initTables() {
    // 1. Tabella Impostazioni Generali
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // 2. Tabella Categorie Spesa
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        is_default INTEGER DEFAULT 1
      );
    `);

    // 3. Tabella Entrate / Stipendi Mensili (per mese YYYY-MM)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS monthly_incomes (
        month TEXT PRIMARY KEY, -- formato "YYYY-MM"
        income_partner1 REAL DEFAULT 0,
        income_partner2 REAL DEFAULT 0,
        extra_income REAL DEFAULT 0,
        notes TEXT
      );
    `);

    // 4. Tabella Spese
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL, -- formato "YYYY-MM"
        date TEXT NOT NULL,  -- formato "YYYY-MM-DD"
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id TEXT NOT NULL,
        paid_by TEXT NOT NULL, -- "partner1", "partner2", "joint"
        split_type TEXT NOT NULL, -- "50_50", "proportional", "100_p1", "100_p2"
        is_fixed INTEGER DEFAULT 0, -- 1 per affitto, utenze fisse
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );
    `);

    // 5. Tabella Saldi / Conguagli registrati
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL,
        settled_at TEXT DEFAULT (datetime('now', 'localtime')),
        amount REAL NOT NULL,
        from_partner TEXT NOT NULL,
        to_partner TEXT NOT NULL,
        notes TEXT
      );
    `);
  }

  seedDefaultData() {
    // Impostazioni di base fisse per Marco ed Angela
    const defaultSettings = [
      ['partner1_name', 'Marco'],
      ['partner2_name', 'Angela'],
      ['default_income_p1', '2700'],
      ['default_income_p2', '2200'],
      ['split_preference', '50_50'],
      ['currency_symbol', '€'],
      ['monthly_budget_limit', '600'],
      ['budget_food', '400'],
      ['category_budgets', JSON.stringify({ 'ristoranti': 150, 'pulizie': 100 })]
    ];

    const setSetting = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, val] of defaultSettings) {
      setSetting.run(key, val);
    }

    // Categorie predefinite intelligenti
    const defaultCategories = [
      { id: 'affitto', name: 'Affitto & Casa', icon: '🏠', color: '#3b82f6' },
      { id: 'condominio', name: 'Spese Condominiali', icon: '🏢', color: '#6366f1' },
      { id: 'bollette', name: 'Luce, Gas & Acqua', icon: '⚡', color: '#f59e0b' },
      { id: 'internet', name: 'Internet & Telefonia', icon: '🌐', color: '#06b6d4' },
      { id: 'tari', name: 'Tassa Rifiuti (TARI)', icon: '🗑️', color: '#64748b' },
      { id: 'spesa', name: 'Spesa & Supermercato', icon: '🛒', color: '#10b981' },
      { id: 'arredo', name: 'Mobili & Arredi Casa', icon: '🛋️', color: '#ec4899' },
      { id: 'manutenzione', name: 'Manutenzione & Fai-da-te', icon: '🔧', color: '#84cc16' },
      { id: 'pulizie', name: 'Cura Casa & Detersivi', icon: '🧹', color: '#14b8a6' },
      { id: 'trasporti', name: 'Auto, Benzina & Trasporti', icon: '🚗', color: '#f97316' },
      { id: 'ristoranti', name: 'Cene Fuori & Uscite', icon: '🍕', color: '#ef4444' },
      { id: 'svago', name: 'Svago, Cinema & Viaggi', icon: '🎬', color: '#8b5cf6' },
      { id: 'salute', name: 'Salute & Farmacia', icon: '💊', color: '#0ea5e9' },
      { id: 'animali', name: 'Animali Domestici', icon: '🐾', color: '#d97706' },
      { id: 'imprevisti', name: 'Imprevisti & Varie', icon: '⚠️', color: '#a855f7' }
    ];

    const getCat = this.db.prepare('SELECT id FROM categories WHERE id = ?');
    const insertCat = this.db.prepare('INSERT INTO categories (id, name, icon, color, is_default) VALUES (?, ?, ?, ?, 1)');

    for (const cat of defaultCategories) {
      if (!getCat.get(cat.id)) {
        insertCat.run(cat.id, cat.name, cat.icon, cat.color);
      }
    }
  }

  // --- IMPOSTAZIONI ---
  getSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  updateSettings(newSettings, targetMonth = null) {
    const curSettings = this.getSettings();
    const oldP1 = curSettings.default_income_p1 !== undefined ? Number(curSettings.default_income_p1) : null;
    const oldP2 = curSettings.default_income_p2 !== undefined ? Number(curSettings.default_income_p2) : null;

    const update = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, val] of Object.entries(newSettings)) {
      if (key === 'month' || key === 'apply_to_current_month') continue;
      update.run(key, String(val));
    }

    const hasP1 = newSettings.default_income_p1 !== undefined && newSettings.default_income_p1 !== null && !isNaN(Number(newSettings.default_income_p1));
    const hasP2 = newSettings.default_income_p2 !== undefined && newSettings.default_income_p2 !== null && !isNaN(Number(newSettings.default_income_p2));

    const p1Val = hasP1 ? Number(newSettings.default_income_p1) : null;
    const p2Val = hasP2 ? Number(newSettings.default_income_p2) : null;

    const salariesActuallyChanged = (p1Val !== null && p1Val !== oldP1) || (p2Val !== null && p2Val !== oldP2) || !!newSettings.apply_to_current_month;

    if (salariesActuallyChanged && (hasP1 || hasP2)) {
      const monthToUpdate = targetMonth || newSettings.month || new Date().toISOString().slice(0, 7);

      // Aggiorna o crea il record nel mese target
      const cur = this.db.prepare('SELECT * FROM monthly_incomes WHERE month = ?').get(monthToUpdate);
      const curP1 = cur ? Number(cur.income_partner1) : 0;
      const curP2 = cur ? Number(cur.income_partner2) : 0;
      const finalP1 = p1Val !== null ? p1Val : curP1;
      const finalP2 = p2Val !== null ? p2Val : curP2;
      const extra = cur ? (Number(cur.extra_income) || 0) : 0;
      const notes = cur ? (cur.notes || '') : 'Aggiornato da impostazioni stipendi predefiniti';

      this.updateMonthlyIncomes(monthToUpdate, finalP1, finalP2, extra, notes);

      // Aggiorna anche tutti i mesi correnti e successivi (MAI mesi storici passati!)
      if (p1Val !== null && p2Val !== null) {
        this.db.prepare(`
          UPDATE monthly_incomes 
          SET income_partner1 = ?, income_partner2 = ?
          WHERE month >= ?
        `).run(p1Val, p2Val, monthToUpdate);
      } else if (p1Val !== null) {
        this.db.prepare(`
          UPDATE monthly_incomes 
          SET income_partner1 = ?
          WHERE month >= ?
        `).run(p1Val, monthToUpdate);
      } else if (p2Val !== null) {
        this.db.prepare(`
          UPDATE monthly_incomes 
          SET income_partner2 = ?
          WHERE month >= ?
        `).run(p2Val, monthToUpdate);
      }
    }

    return this.getSettings();
  }

  // --- CATEGORIE ---
  getCategories() {
    const cats = this.db.prepare('SELECT * FROM categories ORDER BY is_default DESC, name ASC').all();
    return cats.map(c => {
      let default_split = '50_50';
      if (c.id === 'spesa' || c.id === 'arredo' || c.id === 'pulizie') {
        default_split = '60_40';
      } else if (c.id === 'affitto') {
        default_split = 'turn_rent';
      }
      return { ...c, default_split };
    });
  }

  addCategory(id, name, icon, color) {
    const safeId = id || name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    this.db.prepare('INSERT OR REPLACE INTO categories (id, name, icon, color, is_default) VALUES (?, ?, ?, ?, 0)')
      .run(safeId, name, icon || '📦', color || '#6b7280');
    return this.getCategories();
  }

  // --- ENTRATE MENSILI ---
  getMonthlyIncomes(month) {
    let data = this.db.prepare('SELECT * FROM monthly_incomes WHERE month = ?').get(month);
    if (!data) {
      // Se non esiste ancora per questo mese, prendiamo i default da settings
      const settings = this.getSettings();
      const p1 = parseFloat(settings.default_income_p1) || 0;
      const p2 = parseFloat(settings.default_income_p2) || 0;
      this.db.prepare('INSERT INTO monthly_incomes (month, income_partner1, income_partner2, extra_income, notes) VALUES (?, ?, ?, 0, ?)')
        .run(month, p1, p2, 'Creato automaticamente da stipendi predefiniti');
      data = this.db.prepare('SELECT * FROM monthly_incomes WHERE month = ?').get(month);
    }
    return data;
  }

  updateMonthlyIncomes(month, incomeP1, incomeP2, extraIncome = 0, notes = '', saveAsDefault = false) {
    const p1 = Number(incomeP1) || 0;
    const p2 = Number(incomeP2) || 0;
    const extra = Number(extraIncome) || 0;

    this.db.prepare(`
      INSERT INTO monthly_incomes (month, income_partner1, income_partner2, extra_income, notes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET
        income_partner1 = excluded.income_partner1,
        income_partner2 = excluded.income_partner2,
        extra_income = excluded.extra_income,
        notes = excluded.notes
    `).run(month, p1, p2, extra, notes || '');

    if (saveAsDefault) {
      const updateSetting = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      updateSetting.run('default_income_p1', String(p1));
      updateSetting.run('default_income_p2', String(p2));

      // Aggiorna anche tutti i mesi successivi (MAI mesi storici passati!)
      this.db.prepare(`
        UPDATE monthly_incomes 
        SET income_partner1 = ?, income_partner2 = ?
        WHERE month > ?
      `).run(p1, p2, month);
    }

    return this.getMonthlyIncomes(month);
  }

  // --- SPESE ---
  getExpenses(month) {
    return this.db.prepare(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.month = ?
      ORDER BY e.date DESC, e.id DESC
    `).all(month);
  }

  addExpense(expense) {
    const { month, date, title, amount, category_id, paid_by, split_type, is_fixed, notes } = expense;
    const isFixedCategory = ['affitto', 'bollette', 'internet', 'condominio', 'tari'].includes(category_id);
    const fixedVal = (is_fixed || isFixedCategory) ? 1 : 0;
    const info = this.db.prepare(`
      INSERT INTO expenses (month, date, title, amount, category_id, paid_by, split_type, is_fixed, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      month,
      date,
      title,
      Number(amount),
      category_id,
      paid_by || 'partner1',
      split_type || '50_50',
      fixedVal,
      notes || ''
    );
    return this.getExpenseById(info.lastInsertRowid);
  }

  getExpenseById(id) {
    return this.db.prepare(`
      SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM expenses e
      LEFT JOIN categories c ON e.category_id = c.id
      WHERE e.id = ?
    `).get(id);
  }

  updateExpense(id, expense) {
    const { date, title, amount, category_id, paid_by, split_type, is_fixed, notes } = expense;
    const isFixedCategory = ['affitto', 'bollette', 'internet', 'condominio', 'tari'].includes(category_id);
    const fixedVal = (is_fixed || isFixedCategory) ? 1 : 0;
    this.db.prepare(`
      UPDATE expenses
      SET date = ?, title = ?, amount = ?, category_id = ?, paid_by = ?, split_type = ?, is_fixed = ?, notes = ?
      WHERE id = ?
    `).run(
      date,
      title,
      Number(amount),
      category_id,
      paid_by,
      split_type,
      fixedVal,
      notes || '',
      id
    );
    return this.getExpenseById(id);
  }

  deleteExpense(id) {
    return this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
  }

  // Copia spese fisse (affitto, bollette ricorrenti, abbonamenti) dal mese precedente
  copyFixedExpensesFromPreviousMonth(targetMonth) {
    // Calcola il mese precedente
    const [year, m] = targetMonth.split('-').map(Number);
    const prevDate = new Date(year, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    let fixedExpenses = this.db.prepare(`
      SELECT * FROM expenses WHERE month = ? AND (is_fixed = 1 OR category_id IN ('affitto', 'bollette', 'internet', 'condominio', 'tari'))
    `).all(prevMonth);

    // Se il mese precedente non ha spese fisse (es. primo utilizzo a Settembre), prepara l'affitto
    if (fixedExpenses.length === 0) {
      const monthNum = parseInt(targetMonth.split('-')[1], 10);
      const isSept = targetMonth === '2026-09';
      const rentPayer = (isSept || monthNum % 2 !== 0) ? 'partner1' : 'partner2';
      fixedExpenses = [
        {
          date: `${targetMonth}-01`,
          title: 'Affitto Appartamento (include Acqua & Riscaldamento)',
          amount: 940.00,
          category_id: 'affitto',
          paid_by: rentPayer,
          split_type: 'turn_rent',
          is_fixed: 1,
          notes: 'Spesa fissa affitto (include acqua e riscaldamento)'
        }
      ];
    }

    // Spese fisse già presenti nel mese target per evitare duplicati
    const existingRows = this.db.prepare('SELECT category_id, title FROM expenses WHERE month = ?').all(targetMonth);
    const existingTitles = new Set(existingRows.map(e => e.title.toLowerCase().trim()));
    const existingCategories = new Set(existingRows.map(e => e.category_id));

    const insert = this.db.prepare(`
      INSERT INTO expenses (month, date, title, amount, category_id, paid_by, split_type, is_fixed, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    let copiedCount = 0;
    for (const exp of fixedExpenses) {
      // Se è affitto ed esiste già un affitto in questo mese, evita duplicazione
      if (exp.category_id === 'affitto' && existingCategories.has('affitto')) {
        continue;
      }
      if (existingTitles.has(exp.title.toLowerCase().trim())) {
        continue; // Non duplicare spese già presenti con lo stesso nome
      }

      const day = (exp.date && exp.date.split('-')[2]) ? exp.date.split('-')[2] : '01';
      const newDate = `${targetMonth}-${day}`;

      let payer = exp.paid_by;
      // Per l'affitto: se si copia dal mese precedente, alterna automaticamente chi paga il turno!
      if (exp.category_id === 'affitto' || exp.split_type === 'turn_rent') {
        payer = exp.paid_by === 'partner1' ? 'partner2' : 'partner1';
      }

      insert.run(targetMonth, newDate, exp.title, exp.amount, exp.category_id, payer, exp.split_type, `Copiato da ${prevMonth}`);
      copiedCount++;
    }

    return { copiedCount, prevMonth };
  }

  // --- CONGUAGLI / SALDI ---
  getSettlements(month) {
    return this.db.prepare('SELECT * FROM settlements WHERE month = ? ORDER BY settled_at DESC').all(month);
  }

  addSettlement(month, amount, from_partner, to_partner, notes = '') {
    const info = this.db.prepare(`
      INSERT INTO settlements (month, amount, from_partner, to_partner, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(month, Number(amount), from_partner, to_partner, notes);
    return this.db.prepare('SELECT * FROM settlements WHERE id = ?').get(info.lastInsertRowid);
  }

  deleteSettlement(id) {
    const row = this.db.prepare('SELECT * FROM settlements WHERE id = ?').get(id);
    if (row) {
      this.db.prepare('DELETE FROM settlements WHERE id = ?').run(id);
    }
    return row;
  }

  clearMonthSettlements(month) {
    return this.db.prepare('DELETE FROM settlements WHERE month = ?').run(month);
  }

  // --- CALCOLO STATISTICHE E BILANCIO ---
  calculateMonthSummary(month) {
    const settings = this.getSettings();
    const incomes = this.getMonthlyIncomes(month);
    const expenses = this.getExpenses(month);
    const settlements = this.getSettlements(month);

    const p1Name = settings.partner1_name || 'Marco';
    const p2Name = settings.partner2_name || 'Angela';

    const incP1 = Number(incomes.income_partner1) || 0;
    const incP2 = Number(incomes.income_partner2) || 0;
    const incExtra = Number(incomes.extra_income) || 0;
    const totalIncome = incP1 + incP2 + incExtra;

    // Calcolo proporzione stipendi (se base stipendi > 0)
    const baseSalaries = incP1 + incP2;
    const ratioP1 = baseSalaries > 0 ? (incP1 / baseSalaries) : 0.5;
    const ratioP2 = baseSalaries > 0 ? (incP2 / baseSalaries) : 0.5;

    let totalExpenses = 0;
    let totalFixed = 0;
    let totalVariable = 0;

    // Chi ha pagato di tasca propria
    let paidByP1 = 0;
    let paidByP2 = 0;
    let paidByJoint = 0;
    let paidExRentP1 = 0;
    let paidExRentP2 = 0;

    // Quota dovuta da ciascuno
    let shareDueP1 = 0;
    let shareDueP2 = 0;

    // Categorie aggregate
    const categoryTotals = {};
    // Tracciamento per tipologia (affitto, bollette, spesa alimentare, altre varie)
    let rentShareP1 = 0, rentShareP2 = 0;
    let billsShareP1 = 0, billsShareP2 = 0;
    let foodShareP1 = 0, foodShareP2 = 0;
    let otherShareP1 = 0, otherShareP2 = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      totalExpenses += amt;

      if (exp.is_fixed) {
        totalFixed += amt;
      } else {
        totalVariable += amt;
      }

      const isRent = exp.category_id === 'affitto' || exp.split_type === 'turn_rent';

      // Tracciamento chi ha sborsato
      if (exp.paid_by === 'partner1') {
        paidByP1 += amt;
        if (!isRent) paidExRentP1 += amt;
      } else if (exp.paid_by === 'partner2') {
        paidByP2 += amt;
        if (!isRent) paidExRentP2 += amt;
      } else if (exp.paid_by === 'joint') {
        paidByJoint += amt;
      }

      // Tracciamento quota di spettanza
      let p1Share = 0;
      let p2Share = 0;

      if (exp.split_type === '50_50') {
        p1Share = amt / 2;
        p2Share = amt / 2;
      } else if (exp.split_type === '60_40') {
        p1Share = amt * 0.60;
        p2Share = amt * 0.40;
      } else if (exp.split_type === 'turn_rent') {
        // Chi ha pagato sostiene l'affitto per il suo mese di turno, senza debito/conguaglio verso l'altro
        if (exp.paid_by === 'partner1') {
          p1Share = amt;
          p2Share = 0;
        } else if (exp.paid_by === 'partner2') {
          p1Share = 0;
          p2Share = amt;
        } else {
          p1Share = amt / 2;
          p2Share = amt / 2;
        }
      } else if (exp.split_type === 'proportional') {
        p1Share = amt * ratioP1;
        p2Share = amt * ratioP2;
      } else if (exp.split_type === '100_p1') {
        p1Share = amt;
        p2Share = 0;
      } else if (exp.split_type === '100_p2') {
        p1Share = 0;
        p2Share = amt;
      }

      shareDueP1 += p1Share;
      shareDueP2 += p2Share;

      // Ripartizione specifica per tipologia
      const catId = exp.category_id;
      if (catId === 'affitto') {
        rentShareP1 += p1Share;
        rentShareP2 += p2Share;
      } else if (['bollette', 'internet', 'condominio', 'tari'].includes(catId)) {
        billsShareP1 += p1Share;
        billsShareP2 += p2Share;
      } else if (catId === 'spesa') {
        // Spesa Alimentare (Supermercato): voce unica isolata
        foodShareP1 += p1Share;
        foodShareP2 += p2Share;
      } else {
        // Altre spese (arredo, cura casa/detersivi, ristoranti, salute, svago, imprevisti)
        otherShareP1 += p1Share;
        otherShareP2 += p2Share;
      }

      // Aggregazione per categoria
      if (!categoryTotals[catId]) {
        categoryTotals[catId] = {
          id: catId,
          name: exp.category_name || catId,
          icon: exp.category_icon || '📦',
          color: exp.category_color || '#6b7280',
          total: 0,
          count: 0
        };
      }
      categoryTotals[catId].total += amt;
      categoryTotals[catId].count += 1;
    }

    // Risparmio totale e individuale
    const totalSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0;

    const savingsP1 = incP1 - shareDueP1;
    const savingsP2 = incP2 - shareDueP2;

    // Bilancio / Conguaglio tra i due partner:
    let rawBalance = paidByP1 - shareDueP1; // Positivo = P1 in credito da P2, Negativo = P2 in credito da P1

    // Aggiungi eventuali conguagli già registrati
    let totalSettledP2ToP1 = 0;
    for (const s of settlements) {
      if (s.from_partner === 'partner2' && s.to_partner === 'partner1') {
        totalSettledP2ToP1 += s.amount;
      } else if (s.from_partner === 'partner1' && s.to_partner === 'partner2') {
        totalSettledP2ToP1 -= s.amount;
      }
    }

    const currentBalance = rawBalance - totalSettledP2ToP1;

    // Nel pareggio conti escludiamo l'affitto a turno alternato, altrimenti sbilancia sempre il confronto
    const paidDiffExRent = paidExRentP1 - paidExRentP2;
    let balanceTitle = '';
    if (Math.abs(currentBalance) < 0.01) {
      balanceTitle = 'I conti sono perfettamente in pari! 🎉';
    } else if (currentBalance > 0) {
      balanceTitle = `${p2Name} deve rimborsare ${currentBalance.toFixed(2)} € a ${p1Name}`;
    } else {
      balanceTitle = `${p1Name} deve rimborsare ${Math.abs(currentBalance).toFixed(2)} € ad ${p2Name}`;
    }

    const totalSharedExRent = paidExRentP1 + paidExRentP2;
    let debtExplanation = '';
    const breakdownText = `Spese anticipate (escluso affitto): ${p1Name} ${paidExRentP1.toFixed(2)} € • ${p2Name} ${paidExRentP2.toFixed(2)} € (totale: ${totalSharedExRent.toFixed(2)} €)`;

    if (Math.abs(currentBalance) < 0.01) {
      if (paidExRentP1 === 0 && paidExRentP2 === 0) {
        debtExplanation = `Nessuna spesa comune da pareggiare (l'affitto di questo mese era a turno a carico di ${rentShareP1 > 0 ? p1Name : p2Name}). 🎉`;
      } else {
        debtExplanation = `${breakdownText}.<br>I conti sono perfettamente in pari con le quote concordate! 🎉`;
      }
    } else if (currentBalance > 0) {
      debtExplanation = `${breakdownText}.<br>👉 Quota spettante: ${p1Name} ${(shareDueP1 - rentShareP1).toFixed(2)} € • ${p2Name} ${(shareDueP2 - rentShareP2).toFixed(2)} €. Per pareggiare, ${p2Name} rimborsa <strong>${currentBalance.toFixed(2)} €</strong> a ${p1Name}.`;
    } else {
      debtExplanation = `${breakdownText}.<br>👉 Quota spettante: ${p1Name} ${(shareDueP1 - rentShareP1).toFixed(2)} € • ${p2Name} ${(shareDueP2 - rentShareP2).toFixed(2)} €. Per pareggiare, ${p1Name} rimborsa <strong>${Math.abs(currentBalance).toFixed(2)} €</strong> ad ${p2Name}.`;
    }

    // 1. Tetto Spesa Alimentare (in primis: categoria spesa)
    const foodLimit = parseFloat(settings.budget_food || settings.monthly_budget_limit) || 400;
    const foodSpent = categoryTotals['spesa'] ? categoryTotals['spesa'].total : 0;
    const foodRemaining = Math.max(0, foodLimit - foodSpent);
    const foodOver = Math.max(0, foodSpent - foodLimit);
    const foodPercent = foodLimit > 0 ? Math.round((foodSpent / foodLimit) * 100) : 0;

    // 2. Tetti altre categorie configurabili
    let parsedCategoryBudgets = {};
    try {
      if (settings.category_budgets) {
        parsedCategoryBudgets = typeof settings.category_budgets === 'string'
          ? JSON.parse(settings.category_budgets)
          : settings.category_budgets;
      }
    } catch (e) {
      parsedCategoryBudgets = {};
    }

    if (!parsedCategoryBudgets['ristoranti']) {
      parsedCategoryBudgets['ristoranti'] = 150;
    }
    if (!parsedCategoryBudgets['pulizie']) {
      parsedCategoryBudgets['pulizie'] = 100;
    }

    const categoriesList = this.getCategories();
    const otherBudgets = [];
    for (const [cId, limVal] of Object.entries(parsedCategoryBudgets)) {
      if (cId === 'spesa') continue;
      const limit = parseFloat(limVal) || 0;
      if (limit <= 0) continue;
      const catInfo = categoriesList.find(c => c.id === cId) || { name: cId, icon: '📦' };
      const spent = categoryTotals[cId] ? categoryTotals[cId].total : 0;
      otherBudgets.push({
        categoryId: cId,
        name: catInfo.name,
        icon: catInfo.icon,
        limit,
        spent,
        remaining: Math.max(0, limit - spent),
        overAmount: Math.max(0, spent - limit),
        isOver: spent > limit,
        percent: limit > 0 ? Math.round((spent / limit) * 100) : 0
      });
    }

    // Valutazione Turno e Scadenza Affitto (940 € entro il 5 del mese)
    const rentExp = expenses.find(e => e.category_id === 'affitto' || e.split_type === 'turn_rent');
    const isSept = (month === '2026-09');
    const monthNum = parseInt(month.slice(5, 7), 10);
    const expectedPayerId = (isSept || monthNum % 2 !== 0) ? 'partner1' : 'partner2';
    const expectedPayerName = expectedPayerId === 'partner1' ? p1Name : p2Name;

    const [tYear, tMonth] = month.split('-').map(Number);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const curDay = now.getDate();

    let rentStatus = 'UPCOMING';
    let daysLeft = null;
    const isActualMonth = (tYear === curYear && tMonth === curMonth);
    const isPastMonth = (tYear < curYear || (tYear === curYear && tMonth < curMonth));

    if (rentExp) {
      rentStatus = 'PAID';
    } else if (isActualMonth) {
      if (curDay <= 5) {
        daysLeft = 5 - curDay;
        rentStatus = (daysLeft === 0) ? 'DUE_TODAY' : 'DUE_SOON';
      } else {
        rentStatus = 'OVERDUE';
        daysLeft = -(curDay - 5);
      }
    } else if (isPastMonth) {
      rentStatus = 'OVERDUE';
    }

    return {
      month,
      partners: {
        partner1: {
          name: p1Name,
          income: incP1,
          paid: paidByP1,
          paidExRent: paidExRentP1,
          shareDue: shareDueP1,
          rentShare: rentShareP1,
          billsShare: billsShareP1,
          foodShare: foodShareP1,
          groceriesShare: foodShareP1,
          otherShare: otherShareP1,
          extraShare: otherShareP1,
          savings: savingsP1,
          ratio: ratioP1
        },
        partner2: {
          name: p2Name,
          income: incP2,
          paid: paidByP2,
          paidExRent: paidExRentP2,
          shareDue: shareDueP2,
          rentShare: rentShareP2,
          billsShare: billsShareP2,
          foodShare: foodShareP2,
          groceriesShare: foodShareP2,
          otherShare: otherShareP2,
          extraShare: otherShareP2,
          savings: savingsP2,
          ratio: ratioP2
        },
        joint: {
          paid: paidByJoint
        }
      },
      incomes: {
        partner1: incP1,
        partner2: incP2,
        extra: incExtra,
        total: totalIncome
      },
      expenses: {
        total: totalExpenses,
        fixed: totalFixed,
        variable: totalVariable,
        count: expenses.length
      },
      rent: {
        amount: rentExp ? Number(rentExp.amount) : 940.00,
        isPaid: !!rentExp,
        expenseId: rentExp ? rentExp.id : null,
        paidBy: rentExp ? rentExp.paid_by : null,
        paidByName: rentExp ? (rentExp.paid_by === 'partner1' ? p1Name : (rentExp.paid_by === 'partner2' ? p2Name : 'Conto Comune')) : null,
        expectedPayer: expectedPayerId,
        expectedPayerName,
        status: rentStatus, // 'PAID', 'DUE_TODAY', 'DUE_SOON', 'OVERDUE', 'UPCOMING'
        daysLeft,
        dueDay: 5
      },
      savings: {
        total: totalSavings,
        rate: savingsRate,
        partner1: savingsP1,
        partner2: savingsP2
      },
      budget: {
        food: {
          limit: foodLimit,
          spent: foodSpent,
          remaining: foodRemaining,
          overAmount: foodOver,
          isOver: foodSpent > foodLimit,
          percent: foodPercent
        },
        limit: foodLimit,
        spent: foodSpent,
        remaining: foodRemaining,
        overAmount: foodOver,
        isOver: foodSpent > foodLimit,
        percent: foodPercent,
        otherBudgets,
        totalVariable
      },
      balance: {
        raw: rawBalance,
        current: currentBalance,
        paidDiff: paidDiffExRent,
        paidExRentP1: paidExRentP1,
        paidExRentP2: paidExRentP2,
        title: balanceTitle,
        explanation: debtExplanation,
        isSettled: Math.abs(currentBalance) < 0.01,
        settlementsCount: settlements.length,
        lastSettlement: settlements[0] || null
      },
      categories: Object.values(categoryTotals).sort((a, b) => b.total - a.total),
      settlements
    };
  }

  // --- STORICO MULTI-MESE ---
  getHistory(limit = 12) {
    // Trova tutti i mesi presenti in monthly_incomes o expenses
    const monthsRows = this.db.prepare(`
      SELECT DISTINCT month FROM (
        SELECT month FROM monthly_incomes
        UNION
        SELECT month FROM expenses
      ) ORDER BY month DESC LIMIT ?
    `).all(limit);

    const history = [];
    for (const row of monthsRows.reverse()) {
      const summary = this.calculateMonthSummary(row.month);
      history.push({
        month: row.month,
        income: summary.incomes.total,
        expenses: summary.expenses.total,
        savings: summary.savings.total,
        savingsRate: summary.savings.rate,
        fixed: summary.expenses.fixed,
        variable: summary.expenses.variable
      });
    }
    return history;
  }

  getStorageInfo() {
    let sizeBytes = 0;
    try {
      if (fs.existsSync(this.filePath)) {
        sizeBytes = fs.statSync(this.filePath).size;
      }
    } catch (e) {}

    const isCloud = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_URL || process.env.NODE_ENV === 'production');
    const isPersistentDisk = this.filePath.startsWith('/var/data') || (isCloud && !!process.env.DB_PATH);

    return {
      filePath: this.filePath,
      sizeBytes,
      isCloud,
      isPersistentDisk,
      storageType: isPersistentDisk ? 'Volume Persistente Cloud (/var/data)' : (isCloud ? 'Filesystem Cloud Standard' : 'Locale (PC)')
    };
  }

  exportAllData() {
    const settings = this.db.prepare('SELECT * FROM settings').all();
    const categories = this.db.prepare('SELECT * FROM categories').all();
    const monthly_incomes = this.db.prepare('SELECT * FROM monthly_incomes').all();
    const expenses = this.db.prepare('SELECT * FROM expenses').all();
    const settlements = this.db.prepare('SELECT * FROM settlements').all();

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: 'Casa & Spese',
      data: {
        settings,
        categories,
        monthly_incomes,
        expenses,
        settlements
      }
    };
  }

  importAllData(payload) {
    if (!payload || !payload.data) {
      throw new Error('Formato backup non valido (manca payload.data)');
    }
    const { settings, categories, monthly_incomes, expenses, settlements } = payload.data;

    this.db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Svuotamento tabelle figlie prima delle tabelle madri (rispetta i vincoli di Foreign Key)
      if (Array.isArray(settlements)) {
        this.db.exec('DELETE FROM settlements;');
      }
      if (Array.isArray(expenses)) {
        this.db.exec('DELETE FROM expenses;');
      }
      if (Array.isArray(monthly_incomes)) {
        this.db.exec('DELETE FROM monthly_incomes;');
      }
      if (Array.isArray(categories)) {
        this.db.exec('DELETE FROM categories;');
      }
      if (Array.isArray(settings)) {
        this.db.exec('DELETE FROM settings;');
      }

      // 2. Inserimento tabelle madri
      if (Array.isArray(settings) && settings.length > 0) {
        const ins = this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
        for (const s of settings) {
          ins.run(s.key, s.value == null ? '' : String(s.value));
        }
      }

      if (Array.isArray(categories) && categories.length > 0) {
        const ins = this.db.prepare('INSERT INTO categories (id, name, icon, color, is_default) VALUES (?, ?, ?, ?, ?)');
        for (const c of categories) {
          ins.run(c.id, c.name, c.icon, c.color, c.is_default ? 1 : 0);
        }
      }

      if (Array.isArray(monthly_incomes) && monthly_incomes.length > 0) {
        const ins = this.db.prepare('INSERT INTO monthly_incomes (month, income_partner1, income_partner2, extra_income, notes) VALUES (?, ?, ?, ?, ?)');
        for (const m of monthly_incomes) {
          ins.run(m.month, m.income_partner1 || 0, m.income_partner2 || 0, m.extra_income || 0, m.notes || '');
        }
      }

      // 3. Inserimento tabelle figlie
      if (Array.isArray(expenses) && expenses.length > 0) {
        const ins = this.db.prepare('INSERT INTO expenses (id, month, date, title, amount, category_id, paid_by, split_type, is_fixed, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const e of expenses) {
          ins.run(e.id || null, e.month, e.date, e.title, e.amount, e.category_id, e.paid_by, e.split_type, e.is_fixed ? 1 : 0, e.notes || '', e.created_at || new Date().toISOString());
        }
      }

      if (Array.isArray(settlements) && settlements.length > 0) {
        const ins = this.db.prepare('INSERT INTO settlements (id, month, settled_at, amount, from_partner, to_partner, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const s of settlements) {
          ins.run(s.id || null, s.month, s.settled_at || new Date().toISOString(), s.amount, s.from_partner, s.to_partner, s.notes || '');
        }
      }

      this.db.exec('COMMIT;');
      this.seedDefaultData();
      return { success: true, countExpenses: (expenses || []).length };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  close() {
    if (this.db && typeof this.db.close === 'function') {
      this.db.close();
    }
  }
}

module.exports = DatabaseManager;
