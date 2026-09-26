// test_app.js - Suite di Test Automatizzati per Casa & Spese (Marco ed Angela)
const DatabaseManager = require('./database');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(__dirname, 'test_spese.db');
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

console.log('🧪 AVVIO TEST FUNZIONALI PER CASA & SPESE (MARCO ED ANGELA)...');

const db = new DatabaseManager(TEST_DB);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLITO: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ SUPERATO: ${message}`);
  }
}

// 1. Verifica Impostazioni e Nomi di Default
const settings = db.getSettings();
assert(settings.partner1_name === 'Marco', 'Partner 1 inizializzato come Marco');
assert(settings.partner2_name === 'Angela', 'Partner 2 inizializzato come Angela');
assert(settings.default_income_p1 === '2700', 'Stipendio base Marco corretto (2700)');
assert(settings.default_income_p2 === '2200', 'Stipendio base Angela corretto (2200)');

// 2. Verifica Categorie Predefinite
const cats = db.getCategories();
assert(cats.length >= 10, `Inizializzate ${cats.length} categorie predefinite`);
assert(cats.some(c => c.id === 'affitto'), 'Categoria Affitto presente');
assert(cats.some(c => c.id === 'bollette'), 'Categoria Bollette presente');
assert(cats.some(c => c.id === 'spesa'), 'Categoria Spesa presente');
assert(cats.some(c => c.id === 'arredo'), 'Categoria Mobili & Arredo presente');

// Verifica default_split delle categorie
const spesaCat = cats.find(c => c.id === 'spesa');
assert(spesaCat.default_split === '60_40', 'Categoria Spesa ha default_split 60_40');
const affittoCat = cats.find(c => c.id === 'affitto');
assert(affittoCat.default_split === 'turn_rent', 'Categoria Affitto ha default_split turn_rent');

// 3. Inizializzazione Entrate Settembre 2026
const month = '2026-09';
const incomes = db.updateMonthlyIncomes(month, 2700, 2200, 0, 'Stipendi netti base Marco ed Angela');
assert(incomes.income_partner1 === 2700 && incomes.income_partner2 === 2200, 'Entrate registrate correttamente');

// 4. Inserimento Spese Reali
// - Affitto (940 €, Marco, turn_rent, fissa)
const expAffitto = db.addExpense({
  month,
  date: '2026-09-01',
  title: 'Affitto Appartamento',
  amount: 940.00,
  category_id: 'affitto',
  paid_by: 'partner1',
  split_type: 'turn_rent',
  is_fixed: 1,
  notes: 'Turno Marco per Settembre'
});
assert(expAffitto.id > 0, 'Spesa Affitto creata');

// - Gas ENGIE (27.20 €, Marco, 50/50, fissa)
const expGas = db.addExpense({
  month,
  date: '2026-09-03',
  title: 'Bolletta Gas ENGIE',
  amount: 27.20,
  category_id: 'bollette',
  paid_by: 'partner1',
  split_type: '50_50',
  is_fixed: 1
});
assert(expGas.id > 0, 'Spesa Gas ENGIE creata');

// - Luce (55.00 €, Marco, 50/50, fissa)
const expLuce = db.addExpense({
  month,
  date: '2026-09-04',
  title: 'Bolletta Luce Stima Milano',
  amount: 55.00,
  category_id: 'bollette',
  paid_by: 'partner1',
  split_type: '50_50',
  is_fixed: 1
});
assert(expLuce.id > 0, 'Spesa Bolletta Luce creata');

// - Wifi (20.90 €, Marco, 50/50, fissa)
const expWifi = db.addExpense({
  month,
  date: '2026-09-04',
  title: 'Internet Fibra Ottica Casa',
  amount: 20.90,
  category_id: 'internet',
  paid_by: 'partner1',
  split_type: '50_50',
  is_fixed: 1
});
assert(expWifi.id > 0, 'Spesa Wifi a 20.90 creata');

// - Spesa Alimentare (142.50 €, Angela, 60/40)
const expSpesa = db.addExpense({
  month,
  date: '2026-09-05',
  title: 'Spesa Alimentare Supermercato',
  amount: 142.50,
  category_id: 'spesa',
  paid_by: 'partner2',
  split_type: '60_40',
  is_fixed: 0
});
assert(expSpesa.id > 0, 'Spesa Supermercato creata con split 60/40');

// - Accessori Casa (78.00 €, Angela, 60/40)
const expArredo = db.addExpense({
  month,
  date: '2026-09-06',
  title: 'Accessoristica & Utensili Casa',
  amount: 78.00,
  category_id: 'arredo',
  paid_by: 'partner2',
  split_type: '60_40',
  is_fixed: 0
});
assert(expArredo.id > 0, 'Spesa Accessori creata con split 60/40');

// 5. Verifica Calcoli Finanziari
const summary = db.calculateMonthSummary(month);
const expectedTotalExpenses = 940 + 27.20 + 55.00 + 20.90 + 142.50 + 78.00; // 1263.60
const expectedTotalIncome = 4900;
const expectedSavings = expectedTotalIncome - expectedTotalExpenses; // 3636.40

assert(Math.abs(summary.incomes.total - expectedTotalIncome) < 0.01, 'Totale Entrate esatto (4.900 €)');
assert(Math.abs(summary.expenses.total - expectedTotalExpenses) < 0.01, `Totale Spese esatto (${expectedTotalExpenses.toFixed(2)} €)`);
assert(Math.abs(summary.savings.total - expectedSavings) < 0.01, `Risparmio Totale esatto (${expectedSavings.toFixed(2)} €)`);

// Verifica Quote Spettanza:
// Marco: 940 (affitto) + 13.60 (gas) + 27.50 (luce) + 10.45 (wifi) + 85.50 (spesa 60%) + 46.80 (arredo 60%) = 1123.85 €
const expectedMarcoDue = 940 + 13.60 + 27.50 + 10.45 + (142.50 * 0.6) + (78 * 0.6);
assert(Math.abs(summary.partners.partner1.shareDue - expectedMarcoDue) < 0.01, `Quota Marco corretta: ${expectedMarcoDue.toFixed(2)} €`);

// Angela: 0 (affitto) + 13.60 (gas) + 27.50 (luce) + 10.45 (wifi) + 57.00 (spesa 40%) + 31.20 (arredo 40%) = 139.75 €
const expectedAngelaDue = 13.60 + 27.50 + 10.45 + (142.50 * 0.4) + (78 * 0.4);
assert(Math.abs(summary.partners.partner2.shareDue - expectedAngelaDue) < 0.01, `Quota Angela corretta: ${expectedAngelaDue.toFixed(2)} €`);

// Verifica Risparmio Netto Individuale:
const expectedMarcoSavings = 2700 - expectedMarcoDue; // 1576.15 €
const expectedAngelaSavings = 2200 - expectedAngelaDue; // 2060.25 €
assert(Math.abs(summary.partners.partner1.savings - expectedMarcoSavings) < 0.01, `Risparmio Marco corretto: ${expectedMarcoSavings.toFixed(2)} €`);
assert(Math.abs(summary.partners.partner2.savings - expectedAngelaSavings) < 0.01, `Risparmio Angela corretto: ${expectedAngelaSavings.toFixed(2)} €`);

// Verifica Conguaglio / Bilancio:
// Marco ha anticipato: 940 + 27.20 + 55.00 + 20.90 = 1043.10 €
// Differenza Marco: 1043.10 - 1123.85 = -80.75 € (ha pagato 80.75 € in meno della sua quota di spettanza)
// Angela ha anticipato: 142.50 + 78.00 = 220.50 €
// Differenza Angela: 220.50 - 139.75 = +80.75 € (ha pagato 80.75 € in più della sua quota)
// Quindi: Marco deve ad Angela: 80.75 €
assert(summary.balance.title.includes('Marco deve rimborsare 80.75 € ad Angela'), `Conguaglio corretto: ${summary.balance.title}`);

// 6. Test Copia Spese Fisse per Ottobre 2026
const nextMonth = '2026-10';
const copyResult = db.copyFixedExpensesFromPreviousMonth(nextMonth);
assert(copyResult.copiedCount === 4, `Copiate esattamente 4 spese fisse in Ottobre (copiate: ${copyResult.copiedCount})`);

const octExpenses = db.getExpenses(nextMonth);
const octAffitto = octExpenses.find(e => e.category_id === 'affitto');
assert(octAffitto && octAffitto.paid_by === 'partner2', 'Ad Ottobre l\'affitto è correttamente a carico di Angela (partner2)!');

// Pulizia DB di test
db.close();
fs.unlinkSync(TEST_DB);

console.log('\n🎉 TUTTI I TEST PER MARCO ED ANGELA SONO STATI SUPERATI CON SUCCESSO!');
