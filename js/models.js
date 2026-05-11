// ---------- Cached elements ----------
const el = {
    greeting: $('greeting'),
    balanceNu: $('balance-nu'),
    balanceNequi: $('balance-nequi'),
    balanceDavivienda: $('balance-davivienda'),
    balanceCash: $('balance-cash'),
    balanceTotal: $('balance-total'),
    balanceStatus: $('balance-status'),
    txForm: $('tx-form'),
    txType: $('tx-type'),
    incomeSourceRow: $('income-source-row'),
    expenseCategoryRow: $('expense-category-row'),
    transferFromRow: $('transfer-from-row'),
    cashConversionRow: $('cash-conversion-row'),
    cashConversionDetailsRow: $('cash-conversion-details-row'),
    incomeSource: $('income-source'),
    expenseCategory: $('expense-category'),
    transferFrom: $('transfer-from'),
    cashConversionType: $('cash-conversion-type'),
    cashConversionDetails: $('cash-conversion-details'),
    txAmount: $('tx-amount'),
    txDate: $('tx-date'),
    txAccount: $('tx-account'),
    txAccountRow: $('tx-account-row'),
    depositToNu: $('deposit-to-nu'),
    nuSplitRow: $('nu-split-row'),
    nuSplitAmount: $('nu-split-amount'),
    lastTxList: $('last-tx-list'),
    btnViewAll: $('btn-view-all'),
    btnViewAll2: $('btn-view-all-2'),
    alerts: $('alerts'),
    totalIncomes: $('total-incomes'),
    totalExpenses: $('total-expenses'),
    suggestedSavings: $('suggested-savings'),
    totalTransactions: $('total-transactions'),
    budgetsList: $('budgets-list'),
    btnSettings: $('btn-settings'),
    modalOverlay: $('modal-overlay'),
    setupModal: $('setup-modal'),
    viewAllModal: $('view-all-modal'),
    settingsModal: $('settings-modal'),
    budgetsModal: $('budgets-modal'),
    refreshBalances: $('refresh-balances'),
    btnExpensesReport: $('btn-expenses-report'),
    expensesReportModal: $('expenses-report-modal'),
    expensesSummaryList: $('expenses-summary-list'),
    summaryMonthly: $('summary-monthly'),
    summaryBiweekly: $('summary-biweekly')
};

// ---------- Categories ----------
function getCategories() {
    const fromTx = (state.transactions || [])
        .filter(t => t.type === 'expense' && t.category)
        .map(t => String(t.category).trim());
    const fromBudgets = Object.keys(state.budgets || {});
    const all = [...DEFAULT_CATEGORIES, ...fromTx, ...fromBudgets];
    const seen = new Set();
    const res = [];

    all.forEach(c => {
        if (c && !seen.has(c)) {
            seen.add(c);
            res.push(c);
        }
    });

    return res;
}

function populateCategorySelects() {
    const cats = getCategories();
    const expSel = $('expense-category');
    if (expSel) {
        const prev = expSel.value;
        expSel.innerHTML = '';
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            expSel.appendChild(opt);
        });
        if (cats.includes(prev)) expSel.value = prev;
    }

    const budgetSel = $('new-budget-name');
    if (budgetSel) {
        const prev = budgetSel.value;
        budgetSel.innerHTML = '<option value="" disabled selected>Seleccionar categoría</option>';
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            budgetSel.appendChild(opt);
        });
        if (cats.includes(prev)) budgetSel.value = prev;
    }
}

// ---------- Transactions / totals ----------
function calcTotals() {
    let incomes = 0, expenses = 0, transfers = 0, conversions = 0;
    (state.transactions || []).forEach(t => {
        if (t.type === 'income') incomes += Number(t.amount);
        else if (t.type === 'expense') expenses += Number(t.amount);
        else if (t.type === 'transfer') transfers += Number(t.amount);
        else if (t.type === 'cash-conversion') conversions += Number(t.amount);
    });
    return { incomes, expenses, transfers, conversions };
}

function calcExpensesByCategory() {
    const map = {};
    (state.transactions || []).forEach(t => {
        if (t.type === 'expense') {
            const c = t.category || 'Otros';
            map[c] = (map[c] || 0) + Number(t.amount);
        }
    });
    return map;
}

function addTransaction(tx) {
    const selectedDateTime = el.txDate ? el.txDate.value : null;
    
    if (selectedDateTime) {
        const dateObj = new Date(selectedDateTime);
        tx.timestamp = dateObj.getTime();
        tx.hour = dateObj.getHours();
        tx.minute = dateObj.getMinutes();
        tx.date = selectedDateTime.split('T')[0];
    } else {
        const dateObj = new Date();
        tx.timestamp = dateObj.getTime();
        tx.hour = dateObj.getHours();
        tx.minute = dateObj.getMinutes();
        tx.date = dateObj.toISOString().split('T')[0];
    }
    
    state.transactions.push(tx);
    if (saveState(state)) showToast('Transacción registrada correctamente', 'success');
    populateCategorySelects();
    renderAll();
}

function removeTransactionById(id) {
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx >= 0) {
        state.transactions.splice(idx, 1);
        if (saveState(state)) showToast('Transacción eliminada', 'success');
        populateCategorySelects();
        renderAll();
    }
}

// ---------- Balances ----------
function computeBalances() {
    let nu = state.user ? Number(state.user.nu || 0) : 0;
    let nequi = state.user ? Number(state.user.nequi || 0) : 0;
    let davivienda = state.user ? Number(state.user.davivienda || 0) : 0;
    let cash = state.user ? Number(state.user.cash || 0) : 0;

    const txs = (state.transactions || [])
        .slice()
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    txs.forEach(tx => {
        if (tx.account === 'bancolombia') tx.account = 'davivienda';
        if (tx.from === 'bancolombia') tx.from = 'davivienda';
        if (tx.to === 'bancolombia') tx.to = 'davivienda';
        
        if (tx.type === 'income') {
            if (tx.nuAllocated && tx.nuAllocated > 0) {
                nu += Number(tx.nuAllocated);
                const rest = Number(tx.amount) - Number(tx.nuAllocated);
                if (rest > 0) {
                    if (tx.account === 'nequi') nequi += rest;
                    else if (tx.account === 'davivienda') davivienda += rest;
                    else if (tx.account === 'cash') cash += rest;
                }
            } else {
                if (tx.account === 'nu') nu += Number(tx.amount);
                else if (tx.account === 'nequi') nequi += Number(tx.amount);
                else if (tx.account === 'davivienda') davivienda += Number(tx.amount);
                else if (tx.account === 'cash') cash += Number(tx.amount);
            }
        } else if (tx.type === 'expense') {
            if (tx.account === 'nu') nu -= Number(tx.amount);
            else if (tx.account === 'nequi') nequi -= Number(tx.amount);
            else if (tx.account === 'davivienda') davivienda -= Number(tx.amount);
            else if (tx.account === 'cash') cash -= Number(tx.amount);
        } else if (tx.type === 'transfer') {
            const amount = Number(tx.amount);
            if (tx.from === 'nu' && tx.to === 'nequi') {
                nu -= amount;
                nequi += amount;
            } else if (tx.from === 'nequi' && tx.to === 'nu') {
                nequi -= amount;
                nu += amount;
            } else if (tx.from === 'nu' && tx.to === 'davivienda') {
                nu -= amount;
                davivienda += amount;
            } else if (tx.from === 'davivienda' && tx.to === 'nu') {
                davivienda -= amount;
                nu += amount;
            } else if (tx.from === 'nequi' && tx.to === 'davivienda') {
                nequi -= amount;
                davivienda += amount;
            } else if (tx.from === 'davivienda' && tx.to === 'nequi') {
                davivienda -= amount;
                nequi += amount;
            } else if (tx.from === 'cash' && tx.to === 'nu') {
                cash -= amount;
                nu += amount;
            } else if (tx.from === 'cash' && tx.to === 'nequi') {
                cash -= amount;
                nequi += amount;
            } else if (tx.from === 'cash' && tx.to === 'davivienda') {
                cash -= amount;
                davivienda += amount;
            } else if (tx.from === 'nu' && tx.to === 'cash') {
                nu -= amount;
                cash += amount;
            } else if (tx.from === 'nequi' && tx.to === 'cash') {
                nequi -= amount;
                cash += amount;
            } else if (tx.from === 'davivienda' && tx.to === 'cash') {
                davivienda -= amount;
                cash += amount;
            }
        } else if (tx.type === 'cash-conversion') {
            const amount = Number(tx.amount);
            if (tx.conversionType === 'to_cash') {
                if (tx.from === 'nu') {
                    nu -= amount;
                    cash += amount;
                } else if (tx.from === 'nequi') {
                    nequi -= amount;
                    cash += amount;
                } else if (tx.from === 'davivienda') {
                    davivienda -= amount;
                    cash += amount;
                }
            } else if (tx.conversionType === 'from_cash') {
                if (tx.to === 'nu') {
                    cash -= amount;
                    nu += amount;
                } else if (tx.to === 'nequi') {
                    cash -= amount;
                    nequi += amount;
                } else if (tx.to === 'davivienda') {
                    cash -= amount;
                    davivienda += amount;
                }
            }
        }
    });

    return {
        nu: Math.max(0, nu),
        nequi: Math.max(0, nequi),
        davivienda: Math.max(0, davivienda),
        cash: Math.max(0, cash),
        total: Math.max(0, nu + nequi + davivienda + cash)
    };
}

// ---------- Filter transactions ----------
function filterTransactions(typeFilter, accountFilter, searchFilter) {
    return (state.transactions || []).filter(tx => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

        if (accountFilter !== 'all') {
            if (tx.type === 'transfer') {
                if (accountFilter === 'nu' && !(tx.from === 'nu' || tx.to === 'nu')) return false;
                if (accountFilter === 'nequi' && !(tx.from === 'nequi' || tx.to === 'nequi')) return false;
                if (accountFilter === 'davivienda' && !(tx.from === 'davivienda' || tx.to === 'davivienda')) return false;
                if (accountFilter === 'cash' && !(tx.from === 'cash' || tx.to === 'cash')) return false;
            } else if (tx.type === 'cash-conversion') {
                if (accountFilter === 'nu' && !((tx.conversionType === 'to_cash' && tx.from === 'nu') || (tx.conversionType === 'from_cash' && tx.to === 'nu'))) return false;
                if (accountFilter === 'nequi' && !((tx.conversionType === 'to_cash' && tx.from === 'nequi') || (tx.conversionType === 'from_cash' && tx.to === 'nequi'))) return false;
                if (accountFilter === 'davivienda' && !((tx.conversionType === 'to_cash' && tx.from === 'davivienda') || (tx.conversionType === 'from_cash' && tx.to === 'davivienda'))) return false;
                if (accountFilter === 'cash' && !((tx.conversionType === 'to_cash') || (tx.conversionType === 'from_cash'))) return false;
            } else if (tx.account !== accountFilter) {
                return false;
            }
        }

        if (searchFilter) {
            const searchLower = searchFilter.toLowerCase();
            const desc = (tx.description || '').toLowerCase();
            const source = (tx.source || '').toLowerCase();
            const category = (tx.category || '').toLowerCase();

            if (!desc.includes(searchLower) && !source.includes(searchLower) && !category.includes(searchLower)) return false;
        }

        return true;
    });
}

// ---------- Recommendations ----------
function suggestSavings(totals) {
    if (totals.incomes <= 0) return { text: 'Registra tus ingresos para recomendaciones.' };

    const ratio = totals.incomes > 0 ? (totals.expenses / totals.incomes) : 0;

    if (ratio > 0.9) return { text: 'Muy alto gasto. Reduce gastos inmediatos (≥10%).' };

    let recommendedPercent = 20;
    if (ratio < 0.4) recommendedPercent = 30;
    else if (ratio < 0.6) recommendedPercent = 25;

    const savingsAmount = totals.incomes * (recommendedPercent / 100);
    return { text: `${recommendedPercent}% de tus ingresos (${formatCurrency(savingsAmount, state.settings.currency)}) como ahorro.` };
}
