// seed_demo.js - Setup dati reali per Marco ed Angela
const DatabaseManager = require('./database');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'spese_coppia.db');

// Rimuoviamo il vecchio DB per applicare lo schema pulito con Marco ed Angela
if (fs.existsSync(DB_FILE)) {
  try {
    fs.unlinkSync(DB_FILE);
    console.log('Database precedente rimosso per reset con i nuovi dati di Marco ed Angela.');
  } catch (e) {
    console.log('Impossibile rimuovere il file (sarà aggiornato in-place):', e.message);
  }
}

const db = new DatabaseManager(DB_FILE);

// Reset tabelle per stato pulito iniziale
db.db.exec('DELETE FROM expenses');
db.db.exec('DELETE FROM settlements');

// 1. Aggiorna Impostazioni con i nomi e stipendi reali
db.updateSettings({
  partner1_name: 'Marco',
  partner2_name: 'Angela',
  default_income_p1: 2700,
  default_income_p2: 2200,
  split_preference: '50_50',
  currency_symbol: '€'
});

const month = '2026-09';
const nextMonth = '2026-10';

// 2. Stipendi netti di partenza per Settembre 2026
db.updateMonthlyIncomes(month, 2700, 2200, 0, 'Stipendi netti base Marco ed Angela');

// 3. Spese iniziali di Settembre 2026: ESCLUSIVAMENTE L'AFFITTO DI TURNO (940 €)
const realExpenses = [
  // Affitto: 940 € pagato da Marco a Settembre (Turno Affitto, include acqua e riscaldamento)
  {
    month,
    date: '2026-09-01',
    title: 'Affitto Appartamento (include Acqua & Riscaldamento)',
    amount: 940.00,
    category_id: 'affitto',
    paid_by: 'partner1', // Marco
    split_type: 'turn_rent', // Turno di Marco per Settembre!
    is_fixed: 1,
    notes: 'Turno di Marco per Settembre 2026. Ad Ottobre 2026 toccherà ad Angela.'
  }
];

for (const exp of realExpenses) {
  db.addExpense(exp);
}

// 4. Preimposta Ottobre 2026 con gli stipendi base
db.updateMonthlyIncomes(nextMonth, 2700, 2200, 0, 'Stipendi netti Ottobre');

console.log('✅ Configurazione Marco & Angela completata con successo!');
const summary = db.calculateMonthSummary(month);
console.log('\n--- RIEPILOGO SETTEMBRE 2026 ---');
console.log('Entrate Totali:', summary.incomes.total, '€');
console.log('Spese Totali:', summary.expenses.total, '€');
console.log('Risparmio Totale:', summary.savings.total, '€ (' + summary.savings.rate + '%)');
console.log('Marco - Spese:', summary.partners.partner1.shareDue.toFixed(2), '€ | Risparmio:', summary.partners.partner1.savings.toFixed(2), '€');
console.log('Angela - Spese:', summary.partners.partner2.shareDue.toFixed(2), '€ | Risparmio:', summary.partners.partner2.savings.toFixed(2), '€');
console.log('Bilancio:', summary.balance.explanation);

db.close();
