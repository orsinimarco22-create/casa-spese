// test_new_features.js - Test delle nuove funzionalità 2, 3, 4 e 6
const DatabaseManager = require('./database');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TEST_DB = path.join(__dirname, 'test_features.db');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

console.log('🧪 AVVIO TEST DELLE NUOVE FUNZIONALITA...');

const db = new DatabaseManager(TEST_DB);

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FALLITO:', msg);
    process.exit(1);
  } else {
    console.log('✅ SUPERATO:', msg);
  }
}

// 1. Verifica default setting budget_food
const settings = db.getSettings();
assert(settings.budget_food === '400', `budget_food default a 400 (trovato: ${settings.budget_food})`);

// Modifica setting tetto spesa cibo
db.updateSettings({ budget_food: '500' });
const updatedSettings = db.getSettings();
assert(updatedSettings.budget_food === '500', 'budget_food aggiornato con successo a 500');

// 2. Verifica calcolo Budget nel Summary
const month = '2026-09';
db.updateMonthlyIncomes(month, 2700, 2200, 0, 'Test');

// Aggiungiamo affitto (fissa: non deve intaccare il budget variabile)
db.addExpense({
  month,
  date: '2026-09-01',
  title: 'Affitto Appartamento',
  amount: 940.00,
  category_id: 'affitto',
  paid_by: 'partner1',
  split_type: 'turn_rent',
  is_fixed: 1
});

// Aggiungiamo spesa supermercato (alimentare: 150 €)
db.addExpense({
  month,
  date: '2026-09-05',
  title: 'Spesa Esselunga',
  amount: 150.00,
  category_id: 'spesa',
  paid_by: 'partner2',
  split_type: '60_40',
  is_fixed: 0
});

// Aggiungiamo cena fuori (ristoranti: 80 €)
db.addExpense({
  month,
  date: '2026-09-06',
  title: 'Pizzeria',
  amount: 80.00,
  category_id: 'ristoranti',
  paid_by: 'partner1',
  split_type: '50_50',
  is_fixed: 0
});

let summary = db.calculateMonthSummary(month);
assert(summary.budget !== undefined, 'Oggetto budget presente in calculateMonthSummary');
assert(summary.budget.food !== undefined, 'Oggetto budget.food presente');
assert(summary.budget.food.limit === 500, 'Budget cibo limit corretto (500 €)');
assert(summary.budget.food.spent === 150, `Budget cibo spent corretto: 150 € (trovato: ${summary.budget.food.spent})`);
assert(summary.budget.food.remaining === 350, `Budget cibo remaining corretto: 350 € (trovato: ${summary.budget.food.remaining})`);
assert(summary.budget.food.isOver === false, 'Budget cibo isOver è false');
assert(summary.budget.food.percent === 30, `Budget cibo percent corretto: 30% (trovato: ${summary.budget.food.percent})`);

// Verifica suddivisione scontrino partner (spesa cibo vs altre spese)
const p1 = summary.partners.partner1;
const p2 = summary.partners.partner2;
assert(p1.foodShare === 90, `p1.foodShare corretto: 90 € (trovato: ${p1.foodShare})`);
assert(p1.otherShare === 40, `p1.otherShare corretto: 40 € (trovato: ${p1.otherShare})`);
assert(p2.foodShare === 60, `p2.foodShare corretto: 60 € (trovato: ${p2.foodShare})`);
assert(p2.otherShare === 40, `p2.otherShare corretto: 40 € (trovato: ${p2.otherShare})`);

// Verifica altri tetti (altre categorie)
assert(Array.isArray(summary.budget.otherBudgets), 'summary.budget.otherBudgets è array');
const ristoBudget = summary.budget.otherBudgets.find(b => b.categoryId === 'ristoranti');
assert(ristoBudget && ristoBudget.spent === 80, `ristoBudget monitora correttamente 80 € (trovato: ${ristoBudget ? ristoBudget.spent : 'non trovato'})`);

// Test superamento budget cibo
db.updateSettings({ budget_food: '100' });
summary = db.calculateMonthSummary(month);
assert(summary.budget.food.isOver === true, 'Budget cibo isOver diventa true quando spesi > limite');
assert(summary.budget.food.overAmount === 50, `overAmount corretto: 50 € (trovato: ${summary.budget.food.overAmount})`);

// 3. Test Pareggio Conti e Annullamento (Settlement & Delete)
// Calcolo saldo attuale
const currentBal = summary.balance.current;
assert(Math.abs(currentBal) > 0, `Saldo aperto presente: ${currentBal.toFixed(2)} €`);
assert(summary.balance.isSettled === false, 'Saldo non ancora saldato');

// Registra settlement
const fromP = currentBal > 0 ? 'partner2' : 'partner1';
const toP = currentBal > 0 ? 'partner1' : 'partner2';
const settlement = db.addSettlement(month, Math.abs(currentBal), fromP, toP, 'Rimborso test');
assert(settlement.id > 0, `Settlement creato con ID: ${settlement.id}`);

summary = db.calculateMonthSummary(month);
assert(summary.balance.isSettled === true, 'Dopo settlement, il mese risulta saldato!');
assert(Math.abs(summary.balance.current) < 0.01, 'currentBalance azzerato a 0.00 €');

// Elimina settlement (annulla pareggio)
const deleted = db.deleteSettlement(settlement.id);
assert(deleted && deleted.id === settlement.id, 'Settlement eliminato correttamente con deleteSettlement');

summary = db.calculateMonthSummary(month);
assert(summary.balance.isSettled === false, 'Dopo cancellazione settlement, il saldo è riaperto!');
assert(Math.abs(summary.balance.current - currentBal) < 0.01, 'currentBalance è tornato al valore precedente');

// 4. Test API HTTP tramite server live
function testHttpEndpoints() {
  return new Promise((resolve) => {
    http.get('http://localhost:3000/api/state?month=2026-09', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          assert(res.statusCode === 200, 'GET /api/state restituisce 200');
          assert(json.summary.budget !== undefined, 'Live API include summary.budget');
          assert(typeof json.summary.budget.limit === 'number', 'summary.budget.limit è number');
          assert(json.summary.balance.isSettled !== undefined, 'Live API include summary.balance.isSettled');
          resolve();
        } catch (e) {
          console.error('Errore parsing API live', e);
          process.exit(1);
        }
      });
    }).on('error', (e) => {
      console.error('Errore HTTP:', e.message);
      process.exit(1);
    });
  });
}

testHttpEndpoints().then(() => {
  db.close();
  fs.unlinkSync(TEST_DB);
  console.log('\n🎉 TUTTI I TEST DELLE NUOVE FUNZIONALITA HANNO AVUTO SUCCESSO!');
});
