(function () {
    // ---------- Helpers ----------
    const $ = id => document.getElementById(id);
    const on = (sel, ev, fn) => {
        const el = $(sel);
        if (el) el.addEventListener(ev, fn);
    };
    const nowISO = () => new Date().toISOString();
    const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('id-' + Date.now() + '-' + Math.floor(Math.random() * 10000));

    // ---------- Currency Formatting ----------
    function formatCurrency(value, currency = 'COP') {
        return Number(value || 0).toLocaleString('es-CO', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function parseCurrencyFormatted(formattedValue) {
        const cleanValue = String(formattedValue)
            .replace(/[^\d,]/g, '')
            .replace(/\./g, '')
            .replace(',', '.');
        const parsed = parseFloat(cleanValue || 0);
        return isNaN(parsed) ? 0 : parsed;
    }

    // Real-time currency masking
    function createCurrencyMask(inputElement) {
        inputElement.addEventListener("input", (e) => {
            let value = e.target.value;
            value = value.replace(/\D/g, "");
            if (value === "") {
                e.target.value = "";
                return;
            }
            if (value.length === 1) {
                value = "0" + value;
            }
            const cents = value.slice(-2);
            const integer = value.slice(0, -2);
            const formattedInt = integer === "" ? "0" : parseInt(integer).toLocaleString("es-CO");
            e.target.value = `${formattedInt},${cents}`;
        });

        inputElement.addEventListener("blur", (e) => {
            const value = parseCurrencyFormatted(e.target.value);
            e.target.value = value.toLocaleString('es-CO', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        });

        inputElement.addEventListener("focus", (e) => {
            const value = parseCurrencyFormatted(e.target.value);
            e.target.value = value === 0 ? "" : value.toString();
        });
    }

    function initializeCurrencyMasks() {
        document.querySelectorAll('.currency-input').forEach(input => {
            createCurrencyMask(input);
        });
    }

    // ---------- Toast ----------
    function showToast(message, type = 'info', duration = 5000) {
        const container = $('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<div class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</div><div class="toast-message">${message}</div>`;
        container.appendChild(toast);

        setTimeout(() => {
            if (!toast.parentNode) return;
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) container.removeChild(toast);
            }, 300);
        }, duration);
    }

    // ---------- Storage ----------
    const STORAGE_KEY = 'banklar_finances_v10';

    function saveState(s) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
            return true;
        } catch (e) {
            showToast('Error al guardar datos', 'error');
            console.error(e);
            return false;
        }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.error('Error loading state', e);
            return null;
        }
    }

    // ---------- Data Portability ----------
    function copyDataToClipboard() {
        const data = JSON.stringify(state, null, 2);
        const textarea = $('data-export-text');
        if (textarea) {
            textarea.value = data;
            textarea.select();
            document.execCommand('copy');
            showToast('Datos copiados al portapapeles', 'success');
        }
    }

    function importDataFromClipboard() {
        const textarea = $('data-import-text');
        if (!textarea || !textarea.value.trim()) {
            showToast('No hay datos para importar', 'error');
            return;
        }

        try {
            const imported = JSON.parse(textarea.value);
            if (!imported.user || !imported.transactions) {
                showToast('Datos inválidos', 'error');
                return;
            }

            if (!confirm('⚠️ ¿Estás seguro de importar estos datos? Se perderán todos los datos actuales.')) {
                return;
            }

            state = imported;

            // Migrar datos antiguos: convertir bancolombia a davivienda
            if (state.user.bancolombia !== undefined && state.user.davivienda === undefined) {
                state.user.davivienda = state.user.bancolombia;
                delete state.user.bancolombia;
            }
            
            // Migrar transacciones antiguas
            state.transactions.forEach(tx => {
                if (tx.account === 'bancolombia') tx.account = 'davivienda';
                if (tx.from === 'bancolombia') tx.from = 'davivienda';
                if (tx.to === 'bancolombia') tx.to = 'davivienda';
                
                if (!tx.timestamp && tx.date) {
                    const dateTime = tx.date.includes('T') ? tx.date : `${tx.date}T12:00`;
                    const dateObj = new Date(dateTime);
                    tx.timestamp = dateObj.getTime();
                    tx.hour = dateObj.getHours();
                    tx.minute = dateObj.getMinutes();
                }
            });

            if (saveState(state)) {
                showToast('Datos importados correctamente', 'success');
                hideAllModals();
                renderAll();
                location.reload();
            }
        } catch (e) {
            console.error('Error importing data:', e);
            showToast('Error al importar datos: formato inválido', 'error');
        }
    }

    function showPortabilityModal() {
        showOverlay();
        const modal = $('portability-modal');
        if (!modal) return;

        const exportData = {
            ...state,
            meta: {
                ...state.meta,
                exportedAt: nowISO(),
                version: 'v10'
            }
        };
        const textarea = $('data-export-text');
        if (textarea) {
            textarea.value = JSON.stringify(exportData, null, 2);
        }

        modal.classList.remove('hidden');
    }

    function showImportModal() {
        showOverlay();
        const modal = $('import-modal');
        if (!modal) return;

        const textarea = $('data-import-text');
        if (textarea) {
            textarea.value = '';
        }

        modal.classList.remove('hidden');
    }

    // ---------- Model / State ----------
    let state = loadState() || {
        user: null,
        transactions: [],
        budgets: {},
        settings: {
            lowThreshold: 20000,
            currency: 'COP'
        },
        meta: {
            lastUpdated: nowISO(),
            version: 'v10'
        }
    };

    const DEFAULT_CATEGORIES = [
        'Alquiler', 'Cocina', 'Hogar', 'Cuotas', 'facturas', '4thiago',
        'Transporte', 'Pet', 'Skincare', 'Salud', 'Entretenimiento',
        'Comida', 'Impuestos', 'Efectivo', 'Otros'
    ];

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
            // Migración automática de transacciones antiguas
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

    // ---------- Formatting Functions ----------
    function formatTime(hour, minute) {
        if (hour === undefined || minute === undefined) return '';
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function formatDateTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Fecha inválida';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    // ---------- Expenses Summary ----------
    let currentSummaryPeriod = 'monthly';

    function calcExpensesByPeriod() {
        const expenses = (state.transactions || [])
            .filter(t => t.type === 'expense' && t.timestamp);
        
        const monthly = {};
        const biweekly = {};

        expenses.forEach(t => {
            if (!t.timestamp) return;
            
            const date = new Date(t.timestamp);
            if (isNaN(date.getTime())) return;
            
            const year = date.getFullYear();
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const monthName = monthNames[date.getMonth()];
            const day = date.getDate();
            
            const monthKey = `${monthName} ${year}`;
            if (!monthly[monthKey]) monthly[monthKey] = 0;
            monthly[monthKey] += Number(t.amount);

            const quincena = day <= 15 ? 1 : 2;
            const biweeklyKey = `${monthName} ${year} - ${quincena}ª Quincena`;
            if (!biweekly[biweeklyKey]) biweekly[biweeklyKey] = 0;
            biweekly[biweeklyKey] += Number(t.amount);
        });

        return { monthly, biweekly };
    }

    function renderExpensesSummary() {
        if (!el.expensesSummaryList) return;

        const { monthly, biweekly } = calcExpensesByPeriod();
        const data = currentSummaryPeriod === 'monthly' ? monthly : biweekly;

        el.expensesSummaryList.innerHTML = '';

        if (el.summaryMonthly) {
            el.summaryMonthly.classList.toggle('active', currentSummaryPeriod === 'monthly');
        }
        if (el.summaryBiweekly) {
            el.summaryBiweekly.classList.toggle('active', currentSummaryPeriod === 'biweekly');
        }

        if (Object.keys(data).length === 0) {
            el.expensesSummaryList.innerHTML = '<div class="summary-placeholder">No hay gastos registrados en este período</div>';
            return;
        }

        const sortedEntries = Object.entries(data).sort((a, b) => {
            const yearA = parseInt(a[0].match(/\d{4}/)?.[0] || '0');
            const yearB = parseInt(b[0].match(/\d{4}/)?.[0] || '0');
            if (yearA !== yearB) return yearB - yearA;
            
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const monthA = monthNames.findIndex(m => a[0].includes(m));
            const monthB = monthNames.findIndex(m => b[0].includes(m));
            return monthB - monthA;
        });

        sortedEntries.forEach(([period, amount]) => {
            const div = document.createElement('div');
            div.className = 'summary-item';
            div.innerHTML = `
                <span class="summary-period">${period}</span>
                <span class="summary-amount">${formatCurrency(amount, state.settings.currency)}</span>
            `;
            el.expensesSummaryList.appendChild(div);
        });

        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        const totalDiv = document.createElement('div');
        totalDiv.className = 'summary-item';
        totalDiv.style.background = 'linear-gradient(90deg, rgba(124,58,237,0.1), rgba(124,58,237,0.05))';
        totalDiv.style.borderTop = '2px solid var(--accent)';
        totalDiv.innerHTML = `
            <span class="summary-period" style="font-weight:700;">Total</span>
            <span class="summary-amount" style="background:var(--accent); color:white;">${formatCurrency(total, state.settings.currency)}</span>
        `;
        el.expensesSummaryList.appendChild(totalDiv);
    }

    function setSummaryPeriod(period) {
        currentSummaryPeriod = period;
        renderExpensesSummary();
    }

    // ---------- Rendering ----------
    function renderAll() {
        if (!state.user) {
            showSetup();
            populateCategorySelects();
            return;
        }

        hideAllModals();

        if (el.greeting) el.greeting.textContent = `Hola, ${state.user.name}`;

        const balances = computeBalances(),
              currency = state.settings.currency || 'COP';

        if (el.balanceNu) el.balanceNu.textContent = formatCurrency(balances.nu, currency);
        if (el.balanceNequi) el.balanceNequi.textContent = formatCurrency(balances.nequi, currency);
        if (el.balanceDavivienda) el.balanceDavivienda.textContent = formatCurrency(balances.davivienda, currency);
        if (el.balanceCash) el.balanceCash.textContent = formatCurrency(balances.cash, currency);
        if (el.balanceTotal) el.balanceTotal.textContent = formatCurrency(balances.total, currency);

        const low = Number(state.settings.lowThreshold || 0);
        if (el.balanceStatus) {
            el.balanceStatus.textContent = balances.total < low ? 'Saldo bajo' : 'Estable';
            el.balanceStatus.style.color = balances.total < low ? '#ef4444' : '#10b981';
        }

        if (el.totalTransactions) {
            el.totalTransactions.textContent = state.transactions.length;
        }

        if (el.lastTxList) {
            el.lastTxList.innerHTML = '';
            const sorted = (state.transactions || [])
                .slice()
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            const last5 = sorted.slice(0, 5);

            if (last5.length === 0) {
                const li = document.createElement('li');
                li.className = 'tx-item';
                li.innerHTML = '<div class="meta">No hay transacciones recientes</div>';
                el.lastTxList.appendChild(li);
            } else {
                last5.forEach(tx => {
                    const li = document.createElement('li');
                    let cssClass = 'tx-item';
                    if (tx.type === 'transfer') {
                        cssClass += ' tx-transfer';
                    } else if (tx.type === 'cash-conversion') {
                        cssClass += ' tx-cash-conversion';
                    }
                    li.className = cssClass;

                    let description = '';
                    let icon = '';
                    let amountDisplay = '';

                    if (tx.type === 'transfer') {
                        const fromName = tx.from === 'nu' ? 'Nu' : 
                                        tx.from === 'nequi' ? 'Nequi' : 
                                        tx.from === 'davivienda' ? 'Davivienda' : 'Efectivo';
                        const toName = tx.to === 'nu' ? 'Nu' : 
                                      tx.to === 'nequi' ? 'Nequi' : 
                                      tx.to === 'davivienda' ? 'Davivienda' : 'Efectivo';
                        description = `${fromName} → ${toName}`;
                        icon = '🔄 ';
                        amountDisplay = `↔ ${formatCurrency(tx.amount, currency)}`;
                    } else if (tx.type === 'cash-conversion') {
                        if (tx.conversionType === 'to_cash') {
                            const fromName = tx.from === 'nu' ? 'Nu' : 
                                            tx.from === 'nequi' ? 'Nequi' : 'Davivienda';
                            description = `${fromName} → Efectivo`;
                            icon = '💵 ';
                        } else {
                            const toName = tx.to === 'nu' ? 'Nu' : 
                                          tx.to === 'nequi' ? 'Nequi' : 'Davivienda';
                            description = `Efectivo → ${toName}`;
                            icon = '🏦 ';
                        }
                        amountDisplay = `↔ ${formatCurrency(tx.amount, currency)}`;
                    } else if (tx.type === 'income') {
                        description = tx.source || 'Ingreso';
                        icon = '⬆️ ';
                        amountDisplay = `+ ${formatCurrency(tx.amount, currency)}`;
                    } else {
                        description = tx.category || 'Gasto';
                        icon = '⬇️ ';
                        amountDisplay = `- ${formatCurrency(tx.amount, currency)}`;
                    }

                    let accountInfo = '';
                    if (tx.type === 'income' || tx.type === 'expense') {
                        accountInfo = tx.account === 'nu' ? 'Nu' : 
                                     tx.account === 'nequi' ? 'Nequi' : 
                                     tx.account === 'davivienda' ? 'Davivienda' : 'Efectivo';
                    } else if (tx.type === 'transfer') {
                        accountInfo = 'Transferencia';
                    } else if (tx.type === 'cash-conversion') {
                        accountInfo = 'Conversión';
                    }

                    const dateTimeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
                    const timeDisplay = tx.hour !== undefined && tx.minute !== undefined ? 
                                       formatTime(tx.hour, tx.minute) : '';

                    li.innerHTML = `
                        <div>
                            <div><strong>${icon}${amountDisplay}</strong> 
                                <span class="meta">| ${accountInfo}</span>
                                <span class="date-badge">${dateTimeDisplay}</span>
                            </div>
                            <div class="meta">${description}</div>
                            ${tx.description ? `<div class="meta" style="font-size:11px;color:#666;">${tx.description}</div>` : ''}
                        </div>
                        <div class="actions">
                            <button class="btn-ghost" data-id="${tx.id}" data-action="view">Ver</button>
                            <button class="delete" data-id="${tx.id}" data-action="del">Eliminar</button>
                        </div>`;

                    el.lastTxList.appendChild(li);
                });
            }
        }

        const totals = calcTotals();
        if (el.totalIncomes) el.totalIncomes.textContent = formatCurrency(totals.incomes, currency);
        if (el.totalExpenses) el.totalExpenses.textContent = formatCurrency(totals.expenses, currency);

        const rec = suggestSavings(totals);
        if (el.suggestedSavings) el.suggestedSavings.textContent = rec.text;

        renderAlerts(balances, totals);
        renderBudgets();
        renderExpensesSummary();

        populateCategorySelects();
        state.meta.lastUpdated = nowISO();
        saveState(state);
    }

    function renderAlerts(balances, totals) {
        if (!el.alerts) return;
        el.alerts.innerHTML = '';

        if (balances.cash < 10000 && balances.cash > 0) {
            const d = document.createElement('div');
            d.className = 'alert warning';
            d.textContent = `⚠️ Poco efectivo: ${formatCurrency(balances.cash, state.settings.currency)}. Considera hacer un retiro.`;
            el.alerts.appendChild(d);
        }

        if (balances.total < Number(state.settings.lowThreshold || 0)) {
            const d = document.createElement('div');
            d.className = 'alert danger';
            d.textContent = `Alerta: tu saldo total es bajo (${formatCurrency(balances.total, state.settings.currency)}). Revisa tu presupuesto.`;
            el.alerts.appendChild(d);
        } else {
            const d = document.createElement('div');
            d.className = 'alert good';
            d.textContent = `Saldo OK. Total disponible ${formatCurrency(balances.total, state.settings.currency)}.`;
            el.alerts.appendChild(d);
        }

        if (totals.expenses > totals.incomes) {
            const d = document.createElement('div');
            d.className = 'alert danger';
            d.textContent = `Estás gastando más de lo que ingresas (Gastos ${formatCurrency(totals.expenses, state.settings.currency)} > Ingresos ${formatCurrency(totals.incomes, state.settings.currency)}).`;
            el.alerts.appendChild(d);
        } else {
            const ratio = totals.incomes > 0 ? (totals.expenses / totals.incomes) : 0;
            if (ratio > 0.8) {
                const d = document.createElement('div');
                d.className = 'alert info';
                d.textContent = `Atención: tus gastos están en ${Math.round(ratio * 100)}% de tus ingresos.`;
                el.alerts.appendChild(d);
            }
        }

        const spentByCat = calcExpensesByCategory();
        Object.keys(state.budgets).forEach(cat => {
            const spent = spentByCat[cat] || 0,
                  budget = state.budgets[cat] || 0;
            if (budget > 0 && spent > budget) {
                const d = document.createElement('div');
                d.className = 'alert danger';
                d.textContent = `Has excedido el presupuesto en ${cat}: gastado ${formatCurrency(spent, state.settings.currency)} / presupuesto ${formatCurrency(budget, state.settings.currency)}.`;
                el.alerts.appendChild(d);
            }
        });
    }

    function renderBudgets() {
        if (!el.budgetsList) return;
        el.budgetsList.innerHTML = '';

        const spentByCat = calcExpensesByCategory();
        const keys = Object.keys(state.budgets);

        if (keys.length === 0) {
            el.budgetsList.innerHTML = '<div class="meta">No hay presupuestos. Crea uno desde "Editar / Crear presupuestos".</div>';
            return;
        }

        keys.forEach(cat => {
            const budget = Number(state.budgets[cat] || 0),
                  spent = Number(spentByCat[cat] || 0);
            const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            
            const div = document.createElement('div');
            div.innerHTML = `
                <div style="display:flex;justify-content:space-between">
                    <div>${cat}</div>
                    <div class="meta">${formatCurrency(spent, state.settings.currency)} / ${formatCurrency(budget, state.settings.currency)}</div>
                </div>
                <div class="progress"><i style="width:${percent}%;"></i></div>`;
            el.budgetsList.appendChild(div);
        });
    }

    // ---------- Reports ----------
    function showExpensesReport() {
        showOverlay();
        const modal = $('expenses-report-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        const container = $('expenses-report-container');
        if (!container) return;
        container.innerHTML = '';

        const entries = Object.entries(calcExpensesByCategory()).filter(e => e[1] > 0);

        if (entries.length === 0) {
            container.innerHTML = '<div class="meta">No hay gastos registrados.</div>';
            return;
        }

        entries.sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((s, e) => s + e[1], 0);

        entries.forEach(([cat, amt]) => {
            const percent = total > 0 ? (amt / total) * 100 : 0;
            const div = document.createElement('div');
            div.className = 'tx-row';
            div.innerHTML = `
                <div style="font-size:14px;color:var(--text)">${cat}</div>
                <div style="font-weight:700">${Math.round(percent)}% &nbsp;&nbsp; ${formatCurrency(amt, state.settings.currency)}</div>`;
            container.appendChild(div);
        });

        const footer = document.createElement('div');
        footer.style.marginTop = '8px';
        footer.className = 'meta';
        footer.textContent = `Total gastado: ${formatCurrency(total, state.settings.currency)}`;
        container.appendChild(footer);
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

    // ---------- Form Handling ----------
    function updateFormVisibility() {
        const type = el.txType.value;
        const isIncome = type === 'income';
        const isExpense = type === 'expense';
        const isTransfer = type === 'transfer';
        const isCashConversion = type === 'cash-conversion';

        if (el.incomeSourceRow) el.incomeSourceRow.style.display = isIncome ? 'block' : 'none';
        if (el.expenseCategoryRow) el.expenseCategoryRow.style.display = isExpense ? 'block' : 'none';
        if (el.transferFromRow) el.transferFromRow.style.display = isTransfer ? 'block' : 'none';
        if (el.cashConversionRow) el.cashConversionRow.style.display = isCashConversion ? 'block' : 'none';
        if (el.cashConversionDetailsRow) el.cashConversionDetailsRow.style.display = isCashConversion ? 'block' : 'none';

        if (el.txAccountRow) {
            el.txAccountRow.style.display = (isIncome || isExpense) ? 'block' : 'none';
        }

        if (el.depositToNu && el.depositToNu.parentElement) {
            el.depositToNu.parentElement.style.display = isIncome ? 'block' : 'none';
        }

        if (el.nuSplitRow) {
            el.nuSplitRow.style.display = (isIncome && el.depositToNu && el.depositToNu.checked) ? 'block' : 'none';
        }

        if (el.txAccount) {
            const currentValue = el.txAccount.value;
            el.txAccount.innerHTML = '';

            if (isIncome || isExpense) {
                el.txAccount.innerHTML = `
                    <option value="nu">Nu</option>
                    <option value="nequi">Nequi</option>
                    <option value="davivienda">Davivienda</option>
                    <option value="cash">Efectivo</option>
                `;
            }

            if (currentValue && Array.from(el.txAccount.options).some(opt => opt.value === currentValue)) {
                el.txAccount.value = currentValue;
            }
        }

        if (el.cashConversionDetails) {
            const conversionType = el.cashConversionType ? el.cashConversionType.value : 'to_cash';
            el.cashConversionDetails.innerHTML = '';

            if (conversionType === 'to_cash') {
                el.cashConversionDetails.innerHTML = `
                    <option value="nu_to_cash">Nu → Efectivo</option>
                    <option value="nequi_to_cash">Nequi → Efectivo</option>
                    <option value="davivienda_to_cash">Davivienda → Efectivo</option>
                `;
            } else {
                el.cashConversionDetails.innerHTML = `
                    <option value="cash_to_nu">Efectivo → Nu</option>
                    <option value="cash_to_nequi">Efectivo → Nequi</option>
                    <option value="cash_to_davivienda">Efectivo → Davivienda</option>
                `;
            }
        }
    }

    // ---------- Modals ----------
    function showOverlay() {
        if (el.modalOverlay) el.modalOverlay.classList.remove('hidden');
    }

    function hideOverlay() {
        if (el.modalOverlay) el.modalOverlay.classList.add('hidden');
    }

    function hideAllModals() {
        [
            el.setupModal,
            el.viewAllModal,
            el.settingsModal,
            el.budgetsModal,
            $('export-modal'),
            $('expenses-report-modal'),
            $('portability-modal'),
            $('import-modal')
        ].forEach(m => {
            if (m) m.classList.add('hidden');
        });
        hideOverlay();
    }

    function showSetup() {
        showOverlay();
        if (el.setupModal) el.setupModal.classList.remove('hidden');
        if ($('user-nu')) $('user-nu').value = state.user ? state.user.nu.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00';
        if ($('user-nequi')) $('user-nequi').value = state.user ? state.user.nequi.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00';
        if ($('user-davivienda')) $('user-davivienda').value = state.user ? (state.user.davivienda || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00';
        if ($('user-cash')) $('user-cash').value = state.user ? state.user.cash.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00';
    }

    function showViewAll() {
        showOverlay();
        if (el.viewAllModal) el.viewAllModal.classList.remove('hidden');

        const container = $('all-tx-container');
        if (!container) return;
        container.innerHTML = '';

        const typeFilter = $('tx-filter-type') ? $('tx-filter-type').value : 'all';
        const accountFilter = $('tx-filter-account') ? $('tx-filter-account').value : 'all';
        const searchFilter = $('tx-search') ? $('tx-search').value : '';

        const filtered = filterTransactions(typeFilter, accountFilter, searchFilter)
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (filtered.length === 0) {
            container.innerHTML = '<div class="meta">No hay transacciones que coincidan con los filtros.</div>';
            return;
        }

        filtered.forEach(tx => {
            const div = document.createElement('div');
            div.className = `tx-row ${tx.type === 'transfer' ? 'tx-transfer' : tx.type === 'cash-conversion' ? 'tx-cash-conversion' : ''}`;

            let description = '';
            let icon = '';
            let amountDisplay = '';

            if (tx.type === 'transfer') {
                const fromName = tx.from === 'nu' ? 'Nu' : 
                                tx.from === 'nequi' ? 'Nequi' : 
                                tx.from === 'davivienda' ? 'Davivienda' : 'Efectivo';
                const toName = tx.to === 'nu' ? 'Nu' : 
                              tx.to === 'nequi' ? 'Nequi' : 
                              tx.to === 'davivienda' ? 'Davivienda' : 'Efectivo';
                description = `${fromName} → ${toName}`;
                icon = '🔄 ';
                amountDisplay = `↔ ${formatCurrency(tx.amount, state.settings.currency)}`;
            } else if (tx.type === 'cash-conversion') {
                if (tx.conversionType === 'to_cash') {
                    const fromName = tx.from === 'nu' ? 'Nu' : 
                                    tx.from === 'nequi' ? 'Nequi' : 'Davivienda';
                    description = `${fromName} → Efectivo`;
                    icon = '💵 ';
                } else {
                    const toName = tx.to === 'nu' ? 'Nu' : 
                                  tx.to === 'nequi' ? 'Nequi' : 'Davivienda';
                    description = `Efectivo → ${toName}`;
                    icon = '🏦 ';
                }
                amountDisplay = `↔ ${formatCurrency(tx.amount, state.settings.currency)}`;
            } else if (tx.type === 'income') {
                description = tx.source || 'Ingreso';
                icon = '⬆️ ';
                amountDisplay = `+ ${formatCurrency(tx.amount, state.settings.currency)}`;
            } else {
                description = tx.category || 'Gasto';
                icon = '⬇️ ';
                amountDisplay = `- ${formatCurrency(tx.amount, state.settings.currency)}`;
            }

            let accountInfo = '';
            if (tx.type === 'income' || tx.type === 'expense') {
                accountInfo = tx.account === 'nu' ? 'Nu' : 
                             tx.account === 'nequi' ? 'Nequi' : 
                             tx.account === 'davivienda' ? 'Davivienda' : 'Efectivo';
            } else if (tx.type === 'transfer') {
                accountInfo = 'Transferencia';
            } else if (tx.type === 'cash-conversion') {
                accountInfo = 'Conversión';
            }

            const dateTimeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;

            div.innerHTML = `
                <div>
                    <div><strong>${icon}${amountDisplay}</strong> 
                        <span class="meta">| ${accountInfo} | ${dateTimeDisplay}</span>
                    </div>
                    <div class="meta">${description}</div>
                    ${tx.description ? `<div class="meta" style="font-size:11px;color:#666;">${tx.description}</div>` : ''}
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                    <button class="btn-ghost" data-action="revert" data-id="${tx.id}">Eliminar</button>
                </div>`;

            container.appendChild(div);
        });
    }

    function showSettings() {
        showOverlay();
        if (el.settingsModal) el.settingsModal.classList.remove('hidden');
        if ($('settings-low-threshold')) $('settings-low-threshold').value = formatCurrency(state.settings.lowThreshold || 20000, state.settings.currency).replace('$', '').trim();
        if ($('settings-currency')) $('settings-currency').value = state.settings.currency || 'COP';
    }

    function showBudgets() {
        showOverlay();
        if (!el.budgetsModal) return;
        el.budgetsModal.classList.remove('hidden');

        const list = $('budgets-form-list');
        if (!list) return;
        list.innerHTML = '';

        const keys = Object.keys(state.budgets);
        const cats = getCategories();

        if (keys.length === 0) {
            const p = document.createElement('div');
            p.className = 'meta';
            p.textContent = 'Aún no hay presupuestos. Agrega uno abajo.';
            list.appendChild(p);
        }

        let i = 0;
        keys.forEach(k => {
            const div = document.createElement('div');
            div.className = 'row';
            div.style.display = 'flex';
            div.style.gap = '8px';
            div.style.alignItems = 'center';

            const selHtml = document.createElement('select');
            selHtml.style.flex = '1';
            selHtml.style.padding = '8px';
            selHtml.style.borderRadius = '8px';
            selHtml.style.border = '1px solid rgba(0,0,0,0.06)';
            selHtml.dataset.idx = i;
            selHtml.className = 'budget-cat-select';

            const used = new Set();
            cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                if (c === k) opt.selected = true;
                selHtml.appendChild(opt);
                used.add(c);
            });

            if (!used.has(k)) {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = k;
                opt.selected = true;
                selHtml.appendChild(opt);
            }

            const amtInput = document.createElement('input');
            amtInput.type = 'text';
            amtInput.value = state.budgets[k].toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            amtInput.style.width = '120px';
            amtInput.style.padding = '8px';
            amtInput.style.borderRadius = '8px';
            amtInput.style.border = '1px solid rgba(0,0,0,0.06)';
            amtInput.className = 'budget-amt-input currency-input';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn-ghost remove-budget';
            btn.dataset.key = k;
            btn.textContent = 'Eliminar';

            div.appendChild(selHtml);
            div.appendChild(amtInput);
            div.appendChild(btn);
            list.appendChild(div);
            i++;
        });

        initializeCurrencyMasks();
    }

    function showExportModal() {
        showOverlay();
        const m = $('export-modal');
        if (m) m.classList.remove('hidden');
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

    // ---------- Event Handlers ----------
    function handleTransactionSubmit(e) {
        e.preventDefault();

        const type = el.txType.value;
        const amount = parseCurrencyFormatted(el.txAmount.value || '0');

        if (amount <= 0) {
            showToast('El monto debe ser mayor a 0', 'error');
            return;
        }

        if (type === 'income') {
            handleIncomeTransaction(amount);
        } else if (type === 'expense') {
            handleExpenseTransaction(amount);
        } else if (type === 'transfer') {
            handleTransferTransaction(amount);
        } else if (type === 'cash-conversion') {
            handleCashConversionTransaction(amount);
        }

        el.txForm.reset();
        if (el.txDate) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            el.txDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        updateFormVisibility();
        initializeCurrencyMasks();
    }

    function handleIncomeTransaction(amount) {
        const source = el.incomeSource.value;
        const depositNU = el.depositToNu && el.depositToNu.checked;

        let nuAllocated = 0;
        if (depositNU) {
            const split = parseCurrencyFormatted(el.nuSplitAmount.value || '0');
            nuAllocated = (split > 0 && split < amount) ? split : amount;
        }

        const account = el.txAccount.value;

        const tx = {
            id: uid(),
            type: 'income',
            amount: Number(amount.toFixed(2)),
            source,
            account,
            nuAllocated: nuAllocated > 0 ? Number(nuAllocated.toFixed(2)) : 0,
            description: ''
        };

        addTransaction(tx);
    }

    function handleExpenseTransaction(amount) {
        const category = el.expenseCategory ? el.expenseCategory.value : 'Otros';
        const account = el.txAccount.value;

        const balances = computeBalances();
        const accountBalance = account === 'nu' ? balances.nu :
                              account === 'nequi' ? balances.nequi :
                              account === 'davivienda' ? balances.davivienda :
                              balances.cash;

        if (amount > accountBalance) {
            const accountName = account === 'nu' ? 'Nu' :
                               account === 'nequi' ? 'Nequi' :
                               account === 'davivienda' ? 'Davivienda' : 'Efectivo';
            showToast(`Saldo insuficiente en ${accountName}`, 'error');
            return;
        }

        const tx = {
            id: uid(),
            type: 'expense',
            amount: Number(amount.toFixed(2)),
            account,
            category
        };

        addTransaction(tx);
    }

    function handleTransferTransaction(amount) {
        const transferOption = el.transferFrom.value;
        let fromAccount, toAccount, description;

        switch (transferOption) {
            case 'nu':
                fromAccount = 'nu';
                toAccount = 'nequi';
                description = 'Nu → Nequi';
                break;
            case 'nequi':
                fromAccount = 'nequi';
                toAccount = 'nu';
                description = 'Nequi → Nu';
                break;
            case 'nequi_to_davivienda':
                fromAccount = 'nequi';
                toAccount = 'davivienda';
                description = 'Nequi → Davivienda';
                break;
            case 'davivienda_to_nequi':
                fromAccount = 'davivienda';
                toAccount = 'nequi';
                description = 'Davivienda → Nequi';
                break;
            case 'nu_to_davivienda':
                fromAccount = 'nu';
                toAccount = 'davivienda';
                description = 'Nu → Davivienda';
                break;
            case 'davivienda_to_nu':
                fromAccount = 'davivienda';
                toAccount = 'nu';
                description = 'Davivienda → Nu';
                break;
            case 'cash_to_nu':
                fromAccount = 'cash';
                toAccount = 'nu';
                description = 'Efectivo → Nu';
                break;
            case 'cash_to_nequi':
                fromAccount = 'cash';
                toAccount = 'nequi';
                description = 'Efectivo → Nequi';
                break;
            case 'cash_to_davivienda':
                fromAccount = 'cash';
                toAccount = 'davivienda';
                description = 'Efectivo → Davivienda';
                break;
            case 'nu_to_cash':
                fromAccount = 'nu';
                toAccount = 'cash';
                description = 'Nu → Efectivo';
                break;
            case 'nequi_to_cash':
                fromAccount = 'nequi';
                toAccount = 'cash';
                description = 'Nequi → Efectivo';
                break;
            case 'davivienda_to_cash':
                fromAccount = 'davivienda';
                toAccount = 'cash';
                description = 'Davivienda → Efectivo';
                break;
            default:
                showToast('Opción de transferencia no válida', 'error');
                return;
        }

        const balances = computeBalances();
        const sourceBalance = fromAccount === 'nu' ? balances.nu :
                             fromAccount === 'nequi' ? balances.nequi :
                             fromAccount === 'davivienda' ? balances.davivienda :
                             balances.cash;

        if (amount > sourceBalance) {
            const accountName = fromAccount === 'nu' ? 'Nu' :
                               fromAccount === 'nequi' ? 'Nequi' :
                               fromAccount === 'davivienda' ? 'Davivienda' : 'Efectivo';
            showToast(`Saldo insuficiente en ${accountName}`, 'error');
            return;
        }

        const tx = {
            id: uid(),
            type: 'transfer',
            amount: Number(amount.toFixed(2)),
            from: fromAccount,
            to: toAccount,
            description: `Transferencia: ${description}`
        };

        addTransaction(tx);
        showToast(`Transferencia de ${formatCurrency(amount, state.settings.currency)} realizada`, 'success');
    }

    function handleCashConversionTransaction(amount) {
        const conversionType = el.cashConversionType.value;
        const conversionDetails = el.cashConversionDetails.value;
        let fromAccount, toAccount, conversionDescription;

        if (conversionType === 'to_cash') {
            if (conversionDetails === 'nu_to_cash') {
                fromAccount = 'nu';
                toAccount = 'cash';
                conversionDescription = 'Nu → Efectivo';
            } else if (conversionDetails === 'nequi_to_cash') {
                fromAccount = 'nequi';
                toAccount = 'cash';
                conversionDescription = 'Nequi → Efectivo';
            } else {
                fromAccount = 'davivienda';
                toAccount = 'cash';
                conversionDescription = 'Davivienda → Efectivo';
            }
        } else {
            if (conversionDetails === 'cash_to_nu') {
                fromAccount = 'cash';
                toAccount = 'nu';
                conversionDescription = 'Efectivo → Nu';
            } else if (conversionDetails === 'cash_to_nequi') {
                fromAccount = 'cash';
                toAccount = 'nequi';
                conversionDescription = 'Efectivo → Nequi';
            } else {
                fromAccount = 'cash';
                toAccount = 'davivienda';
                conversionDescription = 'Efectivo → Davivienda';
            }
        }

        const balances = computeBalances();
        const sourceBalance = fromAccount === 'nu' ? balances.nu :
                             fromAccount === 'nequi' ? balances.nequi :
                             fromAccount === 'davivienda' ? balances.davivienda :
                             balances.cash;

        if (amount > sourceBalance) {
            const accountName = fromAccount === 'nu' ? 'Nu' :
                               fromAccount === 'nequi' ? 'Nequi' :
                               fromAccount === 'davivienda' ? 'Davivienda' : 'Efectivo';
            showToast(`Saldo insuficiente en ${accountName}`, 'error');
            return;
        }

        const tx = {
            id: uid(),
            type: 'cash-conversion',
            amount: Number(amount.toFixed(2)),
            conversionType,
            from: fromAccount,
            to: toAccount,
            description: `Conversión: ${conversionDescription}`
        };

        addTransaction(tx);
        showToast(`Conversión de ${formatCurrency(amount, state.settings.currency)} realizada`, 'success');
    }

    function handleTransactionActions(e) {
        const action = e.target.dataset.action,
              id = e.target.dataset.id;

        if (!action) return;

        if (action === 'del' || action === 'revert') {
            if (confirm('¿Eliminar transacción? Esto revertirá su efecto.')) {
                removeTransactionById(id);
                if (action === 'revert') showViewAll();
            }
        } else if (action === 'view') {
            const tx = state.transactions.find(t => t.id === id);
            if (!tx) return;

            const dateTimeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
            let message = `Transacción:\nID: ${tx.id}\nTipo: ${tx.type}\nMonto: ${formatCurrency(tx.amount, state.settings.currency)}\nFecha y Hora: ${dateTimeDisplay}`;

            if (tx.type === 'transfer') {
                const fromName = tx.from === 'nu' ? 'Nu' :
                                tx.from === 'nequi' ? 'Nequi' :
                                tx.from === 'davivienda' ? 'Davivienda' : 'Efectivo';
                const toName = tx.to === 'nu' ? 'Nu' :
                              tx.to === 'nequi' ? 'Nequi' :
                              tx.to === 'davivienda' ? 'Davivienda' : 'Efectivo';
                message += `\nDe: ${fromName}\nA: ${toName}`;
            } else if (tx.type === 'cash-conversion') {
                message += `\nTipo: ${tx.conversionType === 'to_cash' ? 'Digital → Efectivo' : 'Efectivo → Digital'}`;
                const fromName = tx.from === 'nu' ? 'Nu' :
                                tx.from === 'nequi' ? 'Nequi' :
                                tx.from === 'davivienda' ? 'Davivienda' : 'Efectivo';
                const toName = tx.to === 'nu' ? 'Nu' :
                              tx.to === 'nequi' ? 'Nequi' :
                              tx.to === 'davivienda' ? 'Davivienda' : 'Efectivo';
                message += `\nDe: ${fromName}\nA: ${toName}`;
            } else {
                const accountName = tx.account === 'nu' ? 'Nu' :
                                   tx.account === 'nequi' ? 'Nequi' :
                                   tx.account === 'davivienda' ? 'Davivienda' : 'Efectivo';
                message += `\nCuenta: ${accountName}`;
                if (tx.type === 'income') {
                    message += `\nOrigen: ${tx.source}`;
                    if (tx.nuAllocated > 0) message += `\nAsignado a Nu: ${formatCurrency(tx.nuAllocated, state.settings.currency)}`;
                } else {
                    message += `\nCategoría: ${tx.category}`;
                }
            }

            if (tx.description) {
                message += `\nDescripción: ${tx.description}`;
            }

            alert(message);
        }
    }

    function handleSettingsSubmit(e) {
        e.preventDefault();

        state.settings.lowThreshold = parseCurrencyFormatted($('settings-low-threshold').value || '0');
        state.settings.currency = $('settings-currency').value || 'COP';

        if (saveState(state)) {
            showToast('Configuración guardada correctamente', 'success');
        }

        hideAllModals();
        renderAll();
    }

    function handleAddBudget() {
        const sel = $('new-budget-name');
        const name = sel ? sel.value : '';
        const amt = parseCurrencyFormatted($('new-budget-amt').value || '0');

        if (!name) {
            showToast('Selecciona una categoría válida', 'error');
            return;
        }

        if (amt <= 0) {
            showToast('Ingresa monto mayor a 0', 'error');
            return;
        }

        state.budgets[name] = amt;

        if (saveState(state)) showToast('Presupuesto agregado', 'success');

        if (sel) sel.value = '';
        $('new-budget-amt').value = '';

        populateCategorySelects();
        showBudgets();
        renderAll();
    }

    function handleBudgetRemoval(e) {
        if (e.target.classList.contains('remove-budget')) {
            const key = e.target.dataset.key;
            if (confirm(`¿Eliminar presupuesto ${key}?`)) {
                delete state.budgets[key];
                if (saveState(state)) showToast('Presupuesto eliminado', 'success');
                populateCategorySelects();
                showBudgets();
                renderAll();
            }
        }
    }

    function handleBudgetsSubmit(e) {
        e.preventDefault();

        const list = $('budgets-form-list');
        if (!list) return;

        const selects = list.querySelectorAll('.budget-cat-select');
        const amtInputs = list.querySelectorAll('.budget-amt-input');

        const newBudgets = {};

        for (let i = 0; i < selects.length; i++) {
            const name = selects[i].value && String(selects[i].value).trim();
            const amt = parseCurrencyFormatted((amtInputs[i] && amtInputs[i].value) || '0');

            if (name && amt > 0) newBudgets[name] = amt;
        }

        state.budgets = newBudgets;

        if (saveState(state)) showToast('Presupuestos guardados correctamente', 'success');

        populateCategorySelects();
        hideAllModals();
        renderAll();
    }

    function handleSetupSubmit(e) {
        e.preventDefault();

        const name = $('user-name').value.trim();
        const nu = parseCurrencyFormatted($('user-nu').value || '0');
        const nequi = parseCurrencyFormatted($('user-nequi').value || '0');
        const davivienda = parseCurrencyFormatted($('user-davivienda').value || '0');
        const cash = parseCurrencyFormatted($('user-cash').value || '0');

        state.user = {
            name,
            nu,
            nequi,
            davivienda,
            cash,
            createdAt: nowISO()
        };

        if (saveState(state)) showToast('Configuración inicial guardada', 'success');

        hideAllModals();
        populateCategorySelects();
        renderAll();
    }

    // ---------- Export Data ----------
    function exportData(format = 'json') {
        const s = state;
        if (!s) {
            showToast('No hay datos para exportar', 'error');
            return;
        }

        let data, mimeType, filename;

        if (format === 'json') {
            data = JSON.stringify(s, null, 2);
            mimeType = 'application/json';
            filename = `banklar-backup-${new Date().toISOString().split('T')[0]}.json`;
        } else {
            const headers = ['Fecha', 'Hora', 'Tipo', 'Monto', 'Cuenta/Origen', 'Destino', 'Categoría/Origen', 'Descripción'];
            const rows = (s.transactions || []).map(tx => {
                let account = '';
                let destination = '';

                if (tx.type === 'transfer') {
                    account = tx.from === 'nu' ? 'Nu' :
                             tx.from === 'nequi' ? 'Nequi' :
                             tx.from === 'davivienda' ? 'Davivienda' : 'Efectivo';
                    destination = tx.to === 'nu' ? 'Nu' :
                                 tx.to === 'nequi' ? 'Nequi' :
                                 tx.to === 'davivienda' ? 'Davivienda' : 'Efectivo';
                } else if (tx.type === 'cash-conversion') {
                    if (tx.conversionType === 'to_cash') {
                        account = tx.from === 'nu' ? 'Nu' :
                                 tx.from === 'nequi' ? 'Nequi' : 'Davivienda';
                        destination = 'Efectivo';
                    } else {
                        account = 'Efectivo';
                        destination = tx.to === 'nu' ? 'Nu' :
                                     tx.to === 'nequi' ? 'Nequi' : 'Davivienda';
                    }
                } else {
                    account = tx.account === 'nu' ? 'Nu' :
                             tx.account === 'nequi' ? 'Nequi' :
                             tx.account === 'davivienda' ? 'Davivienda' : 'Efectivo';
                }

                const dateTime = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
                const [datePart, timePart] = dateTime.split(' ');

                return [
                    datePart || '',
                    timePart || formatTime(tx.hour || 0, tx.minute || 0),
                    tx.type === 'income' ? 'Ingreso' :
                    tx.type === 'transfer' ? 'Transferencia' :
                    tx.type === 'cash-conversion' ? 'Conversión' : 'Gasto',
                    tx.amount,
                    account,
                    destination,
                    tx.type === 'income' ? (tx.source || 'Ingreso') :
                    tx.type === 'transfer' ? 'Transferencia' :
                    tx.type === 'cash-conversion' ? 'Conversión' : (tx.category || 'Gasto'),
                    tx.description || ''
                ];
            });

            data = [headers, ...rows]
                .map(row => row.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))
                .join('\n');
            mimeType = 'text/csv';
            filename = `banklar-transactions-${new Date().toISOString().split('T')[0]}.csv`;
        }

        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        showToast(`Datos exportados como ${format.toUpperCase()}`, 'success');
    }

    // ---------- Event Listeners ----------
    function initializeEventListeners() {
        if (el.txType) {
            el.txType.addEventListener('change', updateFormVisibility);
        }

        if (el.cashConversionType) {
            el.cashConversionType.addEventListener('change', updateFormVisibility);
        }

        if (el.depositToNu) {
            el.depositToNu.addEventListener('change', updateFormVisibility);
        }

        if (el.txForm) {
            el.txForm.addEventListener('submit', handleTransactionSubmit);
        }

        document.addEventListener('click', handleTransactionActions);

        if (el.btnViewAll) el.btnViewAll.addEventListener('click', showViewAll);
        if (el.btnViewAll2) el.btnViewAll2.addEventListener('click', showViewAll);

        if ($('tx-filter-type')) {
            $('tx-filter-type').addEventListener('change', showViewAll);
            $('tx-filter-account').addEventListener('change', showViewAll);
            $('tx-search').addEventListener('input', debounce(showViewAll, 300));
        }

        on('close-all-tx', 'click', hideAllModals);
        if (el.modalOverlay) el.modalOverlay.addEventListener('click', hideAllModals);

        if (el.btnSettings) el.btnSettings.addEventListener('click', showSettings);
        on('settings-form', 'submit', handleSettingsSubmit);

        on('btn-edit-budgets', 'click', showBudgets);
        on('btn-close-budgets', 'click', hideAllModals);

        on('btn-data-portability', 'click', showPortabilityModal);
        on('btn-copy-data', 'click', copyDataToClipboard);
        on('btn-close-portability', 'click', hideAllModals);

        on('btn-import-data', 'click', showImportModal);
        on('btn-import-confirm', 'click', importDataFromClipboard);
        on('btn-close-import', 'click', hideAllModals);

        on('btn-export', 'click', showExportModal);
        on('btn-close-export', 'click', hideAllModals);
        on('btn-export-csv', 'click', () => exportData('csv'));
        on('btn-export-json', 'click', () => exportData('json'));

        on('btn-add-budget', 'click', handleAddBudget);

        const budgetsListEl = $('budgets-form-list');
        if (budgetsListEl) budgetsListEl.addEventListener('click', handleBudgetRemoval);

        if ($('budgets-form')) $('budgets-form').addEventListener('submit', handleBudgetsSubmit);

        if ($('setup-form')) $('setup-form').addEventListener('submit', handleSetupSubmit);

        if (el.refreshBalances) el.refreshBalances.addEventListener('click', () => {
            renderAll();
            showToast('Balances actualizados', 'success');
        });

        if (el.btnExpensesReport) el.btnExpensesReport.addEventListener('click', showExpensesReport);

        const closeExpBtn = $('close-expenses-report');
        if (closeExpBtn) closeExpBtn.addEventListener('click', hideAllModals);

        if (el.summaryMonthly) {
            el.summaryMonthly.addEventListener('click', () => setSummaryPeriod('monthly'));
        }
        if (el.summaryBiweekly) {
            el.summaryBiweekly.addEventListener('click', () => setSummaryPeriod('biweekly'));
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // ---------- Initialize ----------
    window.addEventListener('load', () => {
        // Migración de versiones anteriores
        const oldStateV9 = localStorage.getItem('banklar_finances_v9');
        const oldStateV8 = localStorage.getItem('banklar_finances_v8');
        const oldStateV7 = localStorage.getItem('banklar_finances_v7');
        let migrated = false;

        // Migrar desde v9 a v10 (cambio de Bancolombia a Davivienda)
        if (oldStateV9 && !state.user) {
            try {
                const parsed = JSON.parse(oldStateV9);
                if (parsed.user) {
                    state.user = {
                        name: parsed.user.name,
                        nu: parsed.user.nu || 0,
                        nequi: parsed.user.nequi || 0,
                        davivienda: parsed.user.bancolombia || 0,
                        cash: parsed.user.cash || 0,
                        createdAt: parsed.user.createdAt || nowISO()
                    };
                    
                    state.transactions = (parsed.transactions || []).map(tx => {
                        if (tx.account === 'bancolombia') tx.account = 'davivienda';
                        if (tx.from === 'bancolombia') tx.from = 'davivienda';
                        if (tx.to === 'bancolombia') tx.to = 'davivienda';
                        return tx;
                    });
                    
                    state.budgets = parsed.budgets || {};
                    state.settings = { ...parsed.settings };
                    
                    state.meta = {
                        ...parsed.meta,
                        version: 'v10',
                        migratedFrom: 'v9'
                    };
                    
                    migrated = true;
                }
            } catch (e) {
                console.error('Error migrating v9 data:', e);
            }
        } else if (oldStateV8 && !state.user) {
            try {
                const parsed = JSON.parse(oldStateV8);
                if (parsed.user) {
                    state.user = {
                        name: parsed.user.name,
                        nu: parsed.user.nu || 0,
                        nequi: parsed.user.nequi || 0,
                        davivienda: parsed.user.bancolombia || 0,
                        cash: parsed.user.cash || 0,
                        createdAt: parsed.user.createdAt || nowISO()
                    };
                    
                    state.transactions = (parsed.transactions || []).map(tx => {
                        if (tx.account === 'bancolombia') tx.account = 'davivienda';
                        if (tx.from === 'bancolombia') tx.from = 'davivienda';
                        if (tx.to === 'bancolombia') tx.to = 'davivienda';
                        
                        if (!tx.timestamp && tx.date) {
                            const [year, month, day] = tx.date.split('-').map(Number);
                            const dateObj = new Date(year, month - 1, day, 12, 0, 0);
                            tx.timestamp = dateObj.getTime();
                            tx.hour = 12;
                            tx.minute = 0;
                        }
                        return tx;
                    });
                    
                    state.budgets = parsed.budgets || {};
                    state.settings = { ...parsed.settings };
                    
                    state.meta = {
                        ...parsed.meta,
                        version: 'v10',
                        migratedFrom: 'v8'
                    };
                    
                    migrated = true;
                }
            } catch (e) {
                console.error('Error migrating v8 data:', e);
            }
        } else if (oldStateV7 && !state.user) {
            try {
                const parsed = JSON.parse(oldStateV7);
                if (parsed.user) {
                    state.user = {
                        name: parsed.user.name,
                        nu: parsed.user.nu || 0,
                        nequi: parsed.user.nequi || 0,
                        davivienda: parsed.user.bancolombia || 0,
                        cash: parsed.user.cash || 0,
                        createdAt: parsed.user.createdAt || nowISO()
                    };
                    
                    state.transactions = (parsed.transactions || []).map(tx => {
                        if (tx.source === 'nova') tx.source = 'Salario';
                        if (tx.account === 'nequi1') tx.account = 'nequi';
                        if (tx.account === 'caja_nu') tx.account = 'nu';
                        if (tx.account === 'bancolombia') tx.account = 'davivienda';
                        if (tx.from === 'bancolombia') tx.from = 'davivienda';
                        if (tx.to === 'bancolombia') tx.to = 'davivienda';
                        
                        if (!tx.timestamp && tx.date) {
                            const [year, month, day] = tx.date.split('-').map(Number);
                            const dateObj = new Date(year, month - 1, day, 12, 0, 0);
                            tx.timestamp = dateObj.getTime();
                            tx.hour = 12;
                            tx.minute = 0;
                        }
                        return tx;
                    });
                    
                    state.budgets = parsed.budgets || {};
                    state.settings = { ...parsed.settings };
                    delete state.settings.nuEA;
                    
                    state.meta = {
                        ...parsed.meta,
                        version: 'v10',
                        migratedFrom: 'v7'
                    };
                    
                    migrated = true;
                }
            } catch (e) {
                console.error('Error migrating v7 data:', e);
            }
        }

        if (migrated) {
            saveState(state);
            showToast('Datos migrados a nueva versión', 'info');
        }

        populateCategorySelects();
        initializeCurrencyMasks();
        updateFormVisibility();
        initializeEventListeners();

        if (el.txDate) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            el.txDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
        }

        renderAll();

        window.addEventListener('focus', () => {
            setTimeout(() => {
                renderAll();
            }, 500);
        });
    });

    window._banklar_state = state;
    window._banklar_exportData = exportData;
    window._banklar_computeBalances = computeBalances;
    window._banklar_copyData = copyDataToClipboard;
    window._banklar_importData = importDataFromClipboard;
})();
