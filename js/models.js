// ---------- Cached elements ----------
const el = {
    greeting: $('greeting'),
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
    depositToPrincipal: $('deposit-to-principal'),
    principalSplitRow: $('principal-split-row'),
    principalSplitAmount: $('principal-split-amount'),
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

// ---------- Currency Input (Nu Bank style) ----------
let currencyInputRaw = 0;

function currencyInputPush(digit) {
    currencyInputRaw = currencyInputRaw * 10 + digit;
    return currencyInputRaw / 100;
}

function currencyInputBackspace() {
    currencyInputRaw = Math.floor(currencyInputRaw / 10);
    return currencyInputRaw / 100;
}

function currencyInputClear() {
    currencyInputRaw = 0;
}

function currencyInputGetValue() {
    return currencyInputRaw / 100;
}

function currencyInputSetValue(value) {
    currencyInputRaw = Math.round(value * 100);
}

function formatCurrencyInput() {
    const value = currencyInputRaw / 100;
    return new Intl.NumberFormat(state.settings.locale || 'es-CO', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

// ---------- Formatting ----------
function formatCurrency(amount, currencyCode) {
    const code = currencyCode || (state.settings && state.settings.currency) || 'COP';
    const locale = (state.settings && state.settings.locale) || 'es-CO';
    
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (e) {
        // Fallback si el locale/currency no es soportado
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

function formatDateTime(timestamp) {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatTime(hour, minute) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function nowISO() {
    return new Date().toISOString();
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
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
    
    // Asignar ID único
    if (!tx.id) {
        tx.id = generateId();
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

// ---------- Balances (dinámicos, basados en accounts[]) ----------
function computeBalances() {
    const accounts = getActiveAccounts();
    const balances = {};
    
    // Inicializar saldos desde el estado guardado de las cuentas
    accounts.forEach(acc => {
        balances[acc.id] = Number(acc.balance || 0);
    });
    
    // Ordenar transacciones cronológicamente
    const txs = (state.transactions || [])
        .slice()
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    txs.forEach(tx => {
        const amount = Number(tx.amount);
        
        if (tx.type === 'income') {
            // Ingreso con posible reparto a cuenta principal
            if (tx.principalAllocated && tx.principalAllocated > 0 && tx.toAccountId) {
                if (balances[tx.toAccountId] !== undefined) {
                    balances[tx.toAccountId] += Number(tx.principalAllocated);
                }
                const rest = amount - Number(tx.principalAllocated);
                if (rest > 0 && tx.accountId && balances[tx.accountId] !== undefined) {
                    balances[tx.accountId] += rest;
                }
            } else {
                if (tx.accountId && balances[tx.accountId] !== undefined) {
                    balances[tx.accountId] += amount;
                }
            }
        } else if (tx.type === 'expense') {
            if (tx.accountId && balances[tx.accountId] !== undefined) {
                balances[tx.accountId] -= amount;
            }
        } else if (tx.type === 'transfer') {
            const fromId = tx.fromAccountId;
            const toId = tx.toAccountId;
            
            if (fromId && balances[fromId] !== undefined) {
                balances[fromId] -= amount;
            }
            if (toId && balances[toId] !== undefined) {
                balances[toId] += amount;
            }
        } else if (tx.type === 'cash-conversion') {
            if (tx.conversionType === 'to_cash') {
                const fromId = tx.fromAccountId;
                const cashAccount = accounts.find(a => a.name.toLowerCase() === 'efectivo');
                if (fromId && balances[fromId] !== undefined) {
                    balances[fromId] -= amount;
                }
                if (cashAccount && balances[cashAccount.id] !== undefined) {
                    balances[cashAccount.id] += amount;
                }
            } else if (tx.conversionType === 'from_cash') {
                const toId = tx.toAccountId;
                const cashAccount = accounts.find(a => a.name.toLowerCase() === 'efectivo');
                if (cashAccount && balances[cashAccount.id] !== undefined) {
                    balances[cashAccount.id] -= amount;
                }
                if (toId && balances[toId] !== undefined) {
                    balances[toId] += amount;
                }
            }
        }
    });
    
    // Asegurar valores no negativos
    Object.keys(balances).forEach(id => {
        balances[id] = Math.max(0, balances[id]);
    });
    
    // Calcular total
    let total = 0;
    Object.values(balances).forEach(v => { total += v; });
    
    return {
        accounts: balances,
        total: Math.max(0, total)
    };
}

function getBalanceForAccount(accountId) {
    const balances = computeBalances();
    return balances.accounts[accountId] || 0;
}

// ---------- Obtener cuenta por nombre (para compatibilidad) ----------
function getAccountByName(name) {
    const nameLower = (name || '').toLowerCase();
    const accounts = getActiveAccounts();
    
    // Buscar por nombre exacto
    let found = accounts.find(a => a.name.toLowerCase() === nameLower);
    
    // Compatibilidad con nombres antiguos
    if (!found) {
        const legacyMap = {
            'nu': 'nu',
            'nequi': 'nequi',
            'davivienda': 'davivienda',
            'bancolombia': 'davivienda',
            'efectivo': 'efectivo',
            'cash': 'efectivo'
        };
        const mappedName = legacyMap[nameLower];
        if (mappedName) {
            found = accounts.find(a => a.name.toLowerCase() === mappedName);
        }
    }
    
    return found || null;
}

function getAccountIdByName(name) {
    const account = getAccountByName(name);
    return account ? account.id : null;
}

// ---------- Filter transactions ----------
function filterTransactions(typeFilter, accountFilter, searchFilter) {
    const activeAccounts = getActiveAccounts();
    
    return (state.transactions || []).filter(tx => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;

        if (accountFilter !== 'all') {
            const account = getAccountById(accountFilter);
            if (!account) return false;
            
            const accountName = account.name.toLowerCase();
            
            if (tx.type === 'transfer') {
                const fromAcc = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
                const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : null;
                const fromName = fromAcc ? fromAcc.name.toLowerCase() : '';
                const toName = toAcc ? toAcc.name.toLowerCase() : '';
                
                if (fromName !== accountName && toName !== accountName) return false;
            } else if (tx.type === 'cash-conversion') {
                const fromAcc = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
                const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : null;
                const fromName = fromAcc ? fromAcc.name.toLowerCase() : '';
                const toName = toAcc ? toAcc.name.toLowerCase() : '';
                const cashName = 'efectivo';
                
                if (tx.conversionType === 'to_cash') {
                    if (fromName !== accountName && cashName !== accountName) return false;
                } else {
                    if (toName !== accountName && cashName !== accountName) return false;
                }
            } else {
                const txAcc = tx.accountId ? getAccountById(tx.accountId) : null;
                const txAccName = txAcc ? txAcc.name.toLowerCase() : '';
                if (txAccName !== accountName) return false;
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

// ---------- Investment Engine ----------
function getDailyRate(annualRate) {
    // Tasa diaria = (1 + EA)^(1/365) - 1
    const rate = Number(annualRate) / 100;
    return Math.pow(1 + rate, 1 / 365) - 1;
}

function calculateInvestmentFutureValue(principal, dailyRate, days) {
    return principal * Math.pow(1 + dailyRate, days);
}

function processAllInvestmentsOnStartup() {
    const investments = getActiveInvestments();
    if (investments.length === 0) return;
    
    const now = new Date();
    let anyUpdate = false;
    
    investments.forEach(inv => {
        const lastUpdate = inv.lastAccreditationDate ? new Date(inv.lastAccreditationDate) : new Date(inv.createdAt);
        const elapsedMs = now.getTime() - lastUpdate.getTime();
        const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
        
        if (elapsedDays <= 0) return;
        
        // Calcular rendimientos acumulados desde la última actualización
        let currentValue = Number(inv.currentValue || inv.initialAmount);
        let totalYield = 0;
        let processDate = new Date(lastUpdate);
        
        // Revisar cambios de tasa en el período
        const rateChanges = (state.rateHistory || [])
            .filter(r => r.investmentId === inv.id && new Date(r.changeDate) > lastUpdate && new Date(r.changeDate) <= now)
            .sort((a, b) => new Date(a.changeDate).getTime() - new Date(b.changeDate).getTime());
        
        if (rateChanges.length > 0) {
            rateChanges.forEach(change => {
                const changeDate = new Date(change.changeDate);
                const segmentDays = Math.floor((changeDate.getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (segmentDays > 0) {
                    const dailyRate = getDailyRate(change.oldRate);
                    const newValue = calculateInvestmentFutureValue(currentValue, dailyRate, segmentDays);
                    totalYield += newValue - currentValue;
                    currentValue = newValue;
                }
                processDate = changeDate;
            });
        }
        
        // Tramo final con tasa actual
        const finalDays = Math.floor((now.getTime() - processDate.getTime()) / (1000 * 60 * 60 * 24));
        if (finalDays > 0) {
            const dailyRate = getDailyRate(inv.annualRate);
            const newValue = calculateInvestmentFutureValue(currentValue, dailyRate, finalDays);
            totalYield += newValue - currentValue;
            currentValue = newValue;
        }
        
        // Verificar si toca acreditar
        const shouldAccredit = checkAccreditationDue(inv, elapsedDays);
        
        if (shouldAccredit && totalYield > 0) {
            accreditInvestmentYield(inv, totalYield);
        }
        
        // Actualizar valor actual
        inv.currentValue = currentValue;
        inv.lastAccreditationDate = nowISO();
        inv.updatedAt = nowISO();
        
        // Guardar en state
        const idx = state.investments.findIndex(i => i.id === inv.id);
        if (idx >= 0) {
            state.investments[idx] = inv;
        }
        
        anyUpdate = true;
    });
    
    if (anyUpdate) {
        saveState(state);
    }
}

function checkAccreditationDue(investment, elapsedDays) {
    let accreditationDays;
    
    if (investment.accreditationFrequency === 'custom') {
        accreditationDays = investment.accreditationDays || 30;
    } else {
        const freqMap = {
            'daily': 1,
            'weekly': 7,
            'monthly': 30,
            'quarterly': 90,
            'semiannually': 180,
            'annually': 365
        };
        accreditationDays = freqMap[investment.accreditationFrequency] || 30;
    }
    
    const lastAccreditation = investment.lastAccreditationDate 
        ? new Date(investment.lastAccreditationDate) 
        : new Date(investment.createdAt);
    const now = new Date();
    const daysSinceLastAccreditation = Math.floor((now.getTime() - lastAccreditation.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysSinceLastAccreditation >= accreditationDays;
}

function accreditInvestmentYield(investment, yieldAmount) {
    // Registrar rendimiento
    state.returns.push({
        id: generateId(),
        investmentId: investment.id,
        date: nowISO(),
        amount: yieldAmount,
        type: 'compound'
    });
    
    // Registrar movimiento
    state.investmentMovements.push({
        id: generateId(),
        investmentId: investment.id,
        type: 'accreditation',
        amount: yieldAmount,
        date: nowISO(),
        description: `Acreditación de rendimientos: ${investment.name}`
    });
}

function addCapitalToInvestment(investmentId, amount) {
    const inv = getInvestmentById(investmentId);
    if (!inv) return false;
    
    inv.currentValue = Number(inv.currentValue) + Number(amount);
    inv.initialAmount = Number(inv.initialAmount) + Number(amount);
    inv.updatedAt = nowISO();
    
    state.investmentMovements.push({
        id: generateId(),
        investmentId: investmentId,
        type: 'contribution',
        amount: Number(amount),
        date: nowISO(),
        description: `Aporte a: ${inv.name}`
    });
    
    saveState(state);
    return true;
}

function withdrawFromInvestment(investmentId, amount) {
    const inv = getInvestmentById(investmentId);
    if (!inv) return false;
    if (Number(amount) > Number(inv.currentValue)) return false;
    
    inv.currentValue = Number(inv.currentValue) - Number(amount);
    inv.updatedAt = nowISO();
    
    state.investmentMovements.push({
        id: generateId(),
        investmentId: investmentId,
        type: 'withdrawal',
        amount: -Number(amount),
        date: nowISO(),
        description: `Retiro de: ${inv.name}`
    });
    
    saveState(state);
    return true;
}

function updateInvestmentRate(investmentId, newRate) {
    const inv = getInvestmentById(investmentId);
    if (!inv) return false;
    
    const oldRate = inv.annualRate;
    
    state.rateHistory.push({
        id: generateId(),
        investmentId: investmentId,
        oldRate: oldRate,
        newRate: Number(newRate),
        changeDate: nowISO()
    });
    
    inv.annualRate = Number(newRate);
    inv.updatedAt = nowISO();
    
    state.investmentMovements.push({
        id: generateId(),
        investmentId: investmentId,
        type: 'rate_change',
        amount: 0,
        date: nowISO(),
        description: `Cambio de tasa: ${oldRate}% → ${newRate}%`
    });
    
    saveState(state);
    return true;
}

function cancelInvestment(investmentId) {
    const inv = getInvestmentById(investmentId);
    if (!inv) return false;
    
    inv.status = 'cancelled';
    inv.updatedAt = nowISO();
    
    state.investmentMovements.push({
        id: generateId(),
        investmentId: investmentId,
        type: 'cancellation',
        amount: inv.currentValue,
        date: nowISO(),
        description: `Cancelación de inversión: ${inv.name}`
    });
    
    saveState(state);
    return true;
}

function getInvestmentSummary(investmentId) {
    const inv = getInvestmentById(investmentId);
    if (!inv) return null;
    
    const returns = (state.returns || []).filter(r => r.investmentId === investmentId);
    const totalReturns = returns.reduce((sum, r) => sum + Number(r.amount), 0);
    const profitability = Number(inv.initialAmount) > 0 
        ? (totalReturns / Number(inv.initialAmount)) * 100 
        : 0;
    
    return {
        ...inv,
        totalReturns,
        profitability,
        returns
    };
}

// ---------- Account Management ----------
function addAccount(accountData) {
    const newAccount = {
        id: generateId(),
        name: accountData.name,
        entityId: accountData.entityId || null,
        entityName: accountData.entityName || accountData.name,
        type: accountData.type || 'additional',
        balance: Number(accountData.balance) || 0,
        isActive: true,
        displayOrder: (state.accounts || []).length,
        createdAt: nowISO(),
        updatedAt: nowISO()
    };
    
    state.accounts.push(newAccount);
    saveState(state);
    return newAccount;
}

function updateAccount(accountId, updates) {
    const idx = state.accounts.findIndex(a => a.id === accountId);
    if (idx < 0) return false;
    
    state.accounts[idx] = {
        ...state.accounts[idx],
        ...updates,
        updatedAt: nowISO()
    };
    
    saveState(state);
    return true;
}

function deleteAccount(accountId) {
    const account = getAccountById(accountId);
    if (!account) return false;
    
    // No permitir eliminar la cuenta principal si hay otras activas
    if (account.type === 'principal') {
        const otherAccounts = getActiveAccounts().filter(a => a.id !== accountId);
        if (otherAccounts.length > 0) {
            // Promover otra cuenta a principal
            otherAccounts[0].type = 'principal';
            updateAccount(otherAccounts[0].id, { type: 'principal' });
        }
    }
    
    // Soft delete
    state.accounts = state.accounts.map(a => {
        if (a.id === accountId) {
            return { ...a, isActive: false, updatedAt: nowISO() };
        }
        return a;
    });
    
    // Actualizar transacciones huérfanas
    state.transactions = state.transactions.map(tx => {
        const newTx = { ...tx };
        if (tx.accountId === accountId) {
            newTx.accountId = null;
            newTx._orphanedAccount = account.name;
        }
        if (tx.fromAccountId === accountId) {
            newTx.fromAccountId = null;
            newTx._orphanedFrom = account.name;
        }
        if (tx.toAccountId === accountId) {
            newTx.toAccountId = null;
            newTx._orphanedTo = account.name;
        }
        return newTx;
    });
    
    // Pausar inversiones vinculadas
    state.investments = state.investments.map(inv => {
        if (inv.sourceAccountId === accountId && inv.status === 'active') {
            return {
                ...inv,
                status: 'paused',
                notes: (inv.notes || '') + ` | Cuenta origen "${account.name}" eliminada el ${new Date().toLocaleDateString('es-CO')}`,
                updatedAt: nowISO()
            };
        }
        return inv;
    });
    
    saveState(state);
    return true;
}

function addFinancialEntity(name) {
    const existing = (state.financialEntities || []).find(
        e => e.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing;
    
    const entity = {
        id: generateId(),
        name: name,
        createdAt: nowISO()
    };
    
    state.financialEntities.push(entity);
    saveState(state);
    return entity;
}

function getFinancialEntities() {
    return state.financialEntities || [];
}

// ---------- Investment Creation ----------
function createInvestment(data) {
    const inv = {
        id: generateId(),
        userId: state.user ? state.user.name : '',
        typeId: data.typeId,
        customTypeName: data.customTypeName || null,
        entityId: data.entityId,
        sourceAccountId: data.sourceAccountId || null,
        name: data.name,
        initialAmount: Number(data.initialAmount),
        currentValue: Number(data.initialAmount),
        annualRate: Number(data.annualRate),
        accreditationFrequency: data.accreditationFrequency,
        accreditationDays: Number(data.accreditationDays) || 30,
        status: 'active',
        notes: data.notes || '',
        createdAt: nowISO(),
        updatedAt: nowISO(),
        lastAccreditationDate: nowISO()
    };
    
    state.investments.push(inv);
    
    // Registrar movimiento de creación
    state.investmentMovements.push({
        id: generateId(),
        investmentId: inv.id,
        type: 'creation',
        amount: Number(data.initialAmount),
        date: nowISO(),
        description: `Creación de inversión: ${inv.name}`
    });
    
    saveState(state);
    return inv;
}

// ---------- Theme Management ----------
function getTheme() {
    return (state.settings && state.settings.theme) || 'system';
}

function setTheme(theme) {
    state.settings.theme = theme;
    saveState(state);
    applyTheme(theme);
}

function applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
    }
    
    root.setAttribute('data-theme', theme);
}

function initTheme() {
    const savedTheme = getTheme();
    applyTheme(savedTheme);
    
    // Escuchar cambios del sistema si está en modo 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (getTheme() === 'system') {
            applyTheme('system');
        }
    });
}
