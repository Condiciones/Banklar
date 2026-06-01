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
        const monthNumber = date.getMonth();
        const monthName = getMonthName(monthNumber + 1);
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

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const sortedEntries = Object.entries(data).sort((a, b) => {
        const yearA = parseInt(a[0].match(/\d{4}/)?.[0] || '0');
        const yearB = parseInt(b[0].match(/\d{4}/)?.[0] || '0');
        if (yearA !== yearB) return yearB - yearA;
        
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

// ---------- Main Rendering ----------
function renderAll() {
    if (!state.user || !isOnboardingCompleted()) {
        showSetup();
        populateCategorySelects();
        return;
    }

    hideAllModals();

    if (el.greeting) el.greeting.textContent = `Hola, ${state.user.name}`;

    const balances = computeBalances();
    const currency = state.settings.currency || 'COP';
    const activeAccounts = getActiveAccounts();

    // Renderizar balances dinámicos de cuentas
    renderAccountBalances(activeAccounts, balances, currency);

    // Balance total (incluye inversiones)
    const patrimony = calculateTotalPatrimony();
    if (el.balanceTotal) el.balanceTotal.textContent = formatCurrency(patrimony.total, currency);

    const low = Number(state.settings.lowThreshold || 0);
    if (el.balanceStatus) {
        el.balanceStatus.textContent = patrimony.total < low ? 'Saldo bajo' : 'Estable';
        el.balanceStatus.style.color = patrimony.total < low ? '#ef4444' : '#10b981';
    }

    if (el.totalTransactions) {
        el.totalTransactions.textContent = state.transactions.length;
    }

    // Renderizar últimas transacciones
    renderLastTransactions(currency);

    // Totales
    const totals = calcTotals();
    if (el.totalIncomes) el.totalIncomes.textContent = formatCurrency(totals.incomes, currency);
    if (el.totalExpenses) el.totalExpenses.textContent = formatCurrency(totals.expenses, currency);

    // Recomendaciones
    const rec = suggestSavings(totals);
    if (el.suggestedSavings) el.suggestedSavings.textContent = rec.text;

    // Alertas, presupuestos, resumen de gastos
    renderAlerts(balances, totals);
    renderBudgets();
    renderExpensesSummary();
    renderInvestmentsSummary();

    populateCategorySelects();
    state.meta.lastUpdated = nowISO();
    saveState(state);
}

// ---------- Account Balances Rendering ----------
function renderAccountBalances(accounts, balances, currency) {
    // Buscar contenedor de cuentas
    const accountsContainer = $('accounts-container');
    
    // Compatibilidad con elementos antiguos (si existen)
    accounts.forEach(acc => {
        const nameLower = acc.name.toLowerCase();
        
        // Mapeo de compatibilidad con IDs antiguos
        if (nameLower === 'nu' && el.balanceNu) {
            el.balanceNu.textContent = formatCurrency(balances.accounts[acc.id] || 0, currency);
        } else if (nameLower === 'nequi' && el.balanceNequi) {
            el.balanceNequi.textContent = formatCurrency(balances.accounts[acc.id] || 0, currency);
        } else if ((nameLower === 'davivienda' || nameLower === 'bancolombia') && el.balanceDavivienda) {
            el.balanceDavivienda.textContent = formatCurrency(balances.accounts[acc.id] || 0, currency);
        } else if (nameLower === 'efectivo' && el.balanceCash) {
            el.balanceCash.textContent = formatCurrency(balances.accounts[acc.id] || 0, currency);
        }
    });
    
    // Renderizar en contenedor dinámico si existe
    if (accountsContainer) {
        accountsContainer.innerHTML = '';
        
        accounts.forEach(acc => {
            const balance = balances.accounts[acc.id] || 0;
            const card = document.createElement('div');
            card.className = 'account-card';
            card.setAttribute('data-account-id', acc.id);
            
            let typeBadge = '';
            if (acc.type === 'principal') {
                typeBadge = '<span class="badge badge-principal">Principal</span>';
            } else if (acc.type === 'secondary') {
                typeBadge = '<span class="badge badge-secondary">Secundaria</span>';
            }
            
            card.innerHTML = `
                <div class="account-card-header">
                    <div class="account-icon">🏦</div>
                    <div class="account-info">
                        <span class="account-name">${acc.name}</span>
                        ${typeBadge}
                    </div>
                </div>
                <div class="account-balance">${formatCurrency(balance, currency)}</div>
                <div class="account-entity">${acc.entityName || acc.name}</div>
            `;
            
            accountsContainer.appendChild(card);
        });
    }
}

// ---------- Last Transactions Rendering ----------
function renderLastTransactions(currency) {
    if (!el.lastTxList) return;
    
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
        return;
    }

    last5.forEach(tx => {
        const li = document.createElement('li');
        let cssClass = 'tx-item';
        if (tx.type === 'transfer') {
            cssClass += ' tx-transfer';
        } else if (tx.type === 'cash-conversion') {
            cssClass += ' tx-cash-conversion';
        } else if (tx.type === 'investment_contribution' || tx.type === 'investment_return') {
            cssClass += ' tx-investment';
        }
        li.className = cssClass;

        let description = '';
        let icon = '';
        let amountDisplay = '';
        let accountInfo = '';

        if (tx.type === 'transfer') {
            const fromAcc = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
            const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : null;
            const fromName = fromAcc ? fromAcc.name : (tx.from || '?');
            const toName = toAcc ? toAcc.name : (tx.to || '?');
            description = `${fromName} → ${toName}`;
            icon = '🔄 ';
            amountDisplay = `↔ ${formatCurrency(tx.amount, currency)}`;
            accountInfo = 'Transferencia';
        } else if (tx.type === 'cash-conversion') {
            if (tx.conversionType === 'to_cash') {
                const fromAcc = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
                const fromName = fromAcc ? fromAcc.name : (tx.from || '?');
                description = `${fromName} → Efectivo`;
                icon = '💵 ';
            } else {
                const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : null;
                const toName = toAcc ? toAcc.name : (tx.to || '?');
                description = `Efectivo → ${toName}`;
                icon = '🏦 ';
            }
            amountDisplay = `↔ ${formatCurrency(tx.amount, currency)}`;
            accountInfo = 'Conversión';
        } else if (tx.type === 'investment_contribution') {
            description = tx.description || 'Aporte a inversión';
            icon = '📈 ';
            amountDisplay = `↗ ${formatCurrency(tx.amount, currency)}`;
            const acc = tx.accountId ? getAccountById(tx.accountId) : null;
            accountInfo = acc ? acc.name : 'Inversión';
        } else if (tx.type === 'investment_return') {
            description = tx.description || 'Rendimiento';
            icon = '✨ ';
            amountDisplay = `+ ${formatCurrency(tx.amount, currency)}`;
            const acc = tx.accountId ? getAccountById(tx.accountId) : null;
            accountInfo = acc ? acc.name : 'Inversión';
        } else if (tx.type === 'income') {
            description = tx.source || 'Ingreso';
            icon = '⬆️ ';
            amountDisplay = `+ ${formatCurrency(tx.amount, currency)}`;
            const acc = tx.accountId ? getAccountById(tx.accountId) : null;
            accountInfo = acc ? acc.name : (tx.account || '');
        } else {
            description = tx.category || 'Gasto';
            icon = '⬇️ ';
            amountDisplay = `- ${formatCurrency(tx.amount, currency)}`;
            const acc = tx.accountId ? getAccountById(tx.accountId) : null;
            accountInfo = acc ? acc.name : (tx.account || '');
        }

        const dateTimeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;

        li.innerHTML = `
            <div>
                <div><strong>${icon}${amountDisplay}</strong> 
                    <span class="meta">| ${accountInfo}</span>
                    <span class="date-badge">${dateTimeDisplay}</span>
                </div>
                <div class="meta">${description}</div>
                ${tx.description && tx.type !== 'transfer' && tx.type !== 'cash-conversion' ? 
                    `<div class="meta" style="font-size:11px;color:var(--text-secondary);">${tx.description}</div>` : ''}
            </div>
            <div class="actions">
                <button class="btn-ghost" data-id="${tx.id}" data-action="view">Ver</button>
                <button class="delete" data-id="${tx.id}" data-action="del">Eliminar</button>
            </div>`;

        el.lastTxList.appendChild(li);
    });
}

// ---------- Investments Summary Rendering ----------
function renderInvestmentsSummary() {
    const container = $('investments-summary-container');
    if (!container) return;
    
    container.innerHTML = '';
    const investments = getActiveInvestments();
    
    if (investments.length === 0) {
        container.innerHTML = '<div class="meta" style="padding:16px;text-align:center;">No tienes inversiones activas</div>';
        return;
    }
    
    const currency = state.settings.currency || 'COP';
    
    investments.forEach(inv => {
        const summary = getInvestmentSummary(inv.id);
        const card = document.createElement('div');
        card.className = 'investment-summary-card';
        
        const typeName = inv.customTypeName || getInvestmentTypeName(inv.typeId);
        const entity = (state.financialEntities || []).find(e => e.id === inv.entityId);
        const entityName = entity ? entity.name : 'Entidad';
        
        card.innerHTML = `
            <div class="inv-card-header">
                <div class="inv-icon">📊</div>
                <div class="inv-title">
                    <span class="inv-name">${inv.name}</span>
                    <span class="inv-type">${typeName} · ${entityName}</span>
                </div>
            </div>
            <div class="inv-card-body">
                <div class="inv-amount">
                    <span class="inv-label">Valor actual</span>
                    <span class="inv-value">${formatCurrency(inv.currentValue, currency)}</span>
                </div>
                <div class="inv-details">
                    <div class="inv-detail">
                        <span>Capital inicial</span>
                        <span>${formatCurrency(inv.initialAmount, currency)}</span>
                    </div>
                    <div class="inv-detail">
                        <span>Rendimientos</span>
                        <span class="positive">+${formatCurrency(summary.totalReturns, currency)}</span>
                    </div>
                    <div class="inv-detail">
                        <span>Tasa EA</span>
                        <span>${inv.annualRate}%</span>
                    </div>
                    <div class="inv-detail">
                        <span>Rentabilidad</span>
                        <span class="positive">+${formatPercentage(summary.profitability)}</span>
                    </div>
                </div>
                <div class="inv-progress">
                    <div class="inv-progress-bar" style="width:${Math.min(100, summary.profitability)}%;"></div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
    
    // Total inversiones
    const totalValue = investments.reduce((sum, inv) => sum + Number(inv.currentValue || 0), 0);
    const totalReturns = investments.reduce((sum, inv) => {
        const s = getInvestmentSummary(inv.id);
        return sum + s.totalReturns;
    }, 0);
    
    const totalDiv = document.createElement('div');
    totalDiv.className = 'investment-total';
    totalDiv.innerHTML = `
        <div class="inv-total-row">
            <span>Total invertido</span>
            <span class="inv-total-value">${formatCurrency(totalValue, currency)}</span>
        </div>
        <div class="inv-total-row positive">
            <span>Rendimientos totales</span>
            <span>+${formatCurrency(totalReturns, currency)}</span>
        </div>
    `;
    container.appendChild(totalDiv);
}

// ---------- Alerts ----------
function renderAlerts(balances, totals) {
    if (!el.alerts) return;
    el.alerts.innerHTML = '';

    const currency = state.settings.currency || 'COP';
    const patrimony = calculateTotalPatrimony();
    const lowThreshold = Number(state.settings.lowThreshold || 0);

    // Alerta de saldo bajo
    if (patrimony.total < lowThreshold) {
        const d = document.createElement('div');
        d.className = 'alert danger';
        d.textContent = `⚠️ Alerta: tu patrimonio total es bajo (${formatCurrency(patrimony.total, currency)}). Revisa tu presupuesto.`;
        el.alerts.appendChild(d);
    } else {
        const d = document.createElement('div');
        d.className = 'alert good';
        d.textContent = `✅ Patrimonio estable. Total disponible: ${formatCurrency(patrimony.total, currency)}.`;
        el.alerts.appendChild(d);
    }

    // Alerta de gastos vs ingresos
    if (totals.expenses > totals.incomes) {
        const d = document.createElement('div');
        d.className = 'alert danger';
        d.textContent = `🔴 Estás gastando más de lo que ingresas (Gastos: ${formatCurrency(totals.expenses, currency)} > Ingresos: ${formatCurrency(totals.incomes, currency)}).`;
        el.alerts.appendChild(d);
    } else {
        const ratio = totals.incomes > 0 ? (totals.expenses / totals.incomes) : 0;
        if (ratio > 0.8) {
            const d = document.createElement('div');
            d.className = 'alert warning';
            d.textContent = `🟡 Atención: tus gastos están en ${Math.round(ratio * 100)}% de tus ingresos.`;
            el.alerts.appendChild(d);
        }
    }

    // Alertas de presupuestos excedidos
    const spentByCat = calcExpensesByCategory();
    Object.keys(state.budgets || {}).forEach(cat => {
        const spent = spentByCat[cat] || 0;
        const budget = state.budgets[cat] || 0;
        if (budget > 0 && spent > budget) {
            const d = document.createElement('div');
            d.className = 'alert danger';
            d.textContent = `🔴 Presupuesto excedido en "${cat}": gastado ${formatCurrency(spent, currency)} de ${formatCurrency(budget, currency)}.`;
            el.alerts.appendChild(d);
        }
    });
}

// ---------- Budgets ----------
function renderBudgets() {
    if (!el.budgetsList) return;
    el.budgetsList.innerHTML = '';

    const spentByCat = calcExpensesByCategory();
    const keys = Object.keys(state.budgets || {});

    if (keys.length === 0) {
        el.budgetsList.innerHTML = '<div class="meta" style="padding:16px;text-align:center;">No hay presupuestos. Crea uno desde "Editar / Crear presupuestos".</div>';
        return;
    }

    const currency = state.settings.currency || 'COP';

    keys.forEach(cat => {
        const budget = Number(state.budgets[cat] || 0);
        const spent = Number(spentByCat[cat] || 0);
        const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
        const overBudget = spent > budget;
        
        const div = document.createElement('div');
        div.className = 'budget-item';
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <span style="font-weight:500;">${cat}</span>
                    ${overBudget ? '<span style="color:#ef4444;font-size:11px;margin-left:8px;">⚠️ Excedido</span>' : ''}
                </div>
                <div class="meta">${formatCurrency(spent, currency)} / ${formatCurrency(budget, currency)}</div>
            </div>
            <div class="progress">
                <div class="progress-fill ${overBudget ? 'progress-danger' : ''}" style="width:${percent}%;"></div>
            </div>`;
        el.budgetsList.appendChild(div);
    });
}

// ---------- Reports ----------
function showExpensesReport() {
    showModal('expenses-report-modal');
    const container = $('expenses-report-container');
    if (!container) return;
    container.innerHTML = '';

    const entries = Object.entries(calcExpensesByCategory()).filter(e => e[1] > 0);

    if (entries.length === 0) {
        container.innerHTML = '<div class="meta" style="text-align:center;padding:16px;">No hay gastos registrados.</div>';
        return;
    }

    const currency = state.settings.currency || 'COP';
    entries.sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, e) => s + e[1], 0);

    entries.forEach(([cat, amt]) => {
        const percent = total > 0 ? (amt / total) * 100 : 0;
        const div = document.createElement('div');
        div.className = 'tx-row';
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <div class="report-bar" style="width:${Math.max(2, percent)}%;background:var(--accent);height:4px;border-radius:2px;"></div>
                <span style="font-size:14px;">${cat}</span>
            </div>
            <div style="font-weight:700;text-align:right;">
                <span style="font-size:12px;color:var(--text-secondary);">${Math.round(percent)}%</span>
                &nbsp;&nbsp;
                <span>${formatCurrency(amt, currency)}</span>
            </div>`;
        container.appendChild(div);
    });

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-weight:700;text-align:right;';
    footer.textContent = `Total gastado: ${formatCurrency(total, currency)}`;
    container.appendChild(footer);
}

// ---------- View All Transactions ----------
function showViewAll(filterType = 'all', filterAccount = 'all') {
    showModal('view-all-modal');
    const container = $('view-all-container');
    if (!container) return;
    container.innerHTML = '';

    const currency = state.settings.currency || 'COP';
    const filtered = filterTransactions(filterType, filterAccount, '');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="meta" style="text-align:center;padding:24px;">No hay transacciones que mostrar</div>';
        return;
    }

    // Ordenar por fecha descendente
    filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    filtered.forEach(tx => {
        const div = document.createElement('div');
        div.className = 'tx-row';

        let typeLabel = '';
        let icon = '';
        let amountDisplay = '';

        if (tx.type === 'income') {
            typeLabel = 'Ingreso';
            icon = '⬆️';
            amountDisplay = `+${formatCurrency(tx.amount, currency)}`;
        } else if (tx.type === 'expense') {
            typeLabel = 'Gasto';
            icon = '⬇️';
            amountDisplay = `-${formatCurrency(tx.amount, currency)}`;
        } else if (tx.type === 'transfer') {
            typeLabel = 'Transferencia';
            icon = '🔄';
            amountDisplay = formatCurrency(tx.amount, currency);
        } else if (tx.type === 'cash-conversion') {
            typeLabel = 'Conversión';
            icon = '💵';
            amountDisplay = formatCurrency(tx.amount, currency);
        } else if (tx.type === 'investment_contribution') {
            typeLabel = 'Aporte';
            icon = '📈';
            amountDisplay = formatCurrency(tx.amount, currency);
        } else if (tx.type === 'investment_return') {
            typeLabel = 'Rendimiento';
            icon = '✨';
            amountDisplay = `+${formatCurrency(tx.amount, currency)}`;
        }

        const dateTimeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : (tx.date || '');
        const description = tx.description || tx.source || tx.category || '';

        div.innerHTML = `
            <div class="tx-main">
                <span class="tx-icon">${icon}</span>
                <div class="tx-info">
                    <div class="tx-type">${typeLabel}</div>
                    <div class="tx-desc">${description}</div>
                    <div class="tx-date">${dateTimeDisplay}</div>
                </div>
            </div>
            <div class="tx-amount ${tx.type === 'income' || tx.type === 'investment_return' ? 'positive' : tx.type === 'expense' ? 'negative' : ''}">
                ${amountDisplay}
            </div>
            <button class="btn-ghost btn-delete-tx" data-id="${tx.id}" title="Eliminar">🗑️</button>
        `;

        container.appendChild(div);
    });
}

// ---------- Setup Screen (Onboarding) ----------
function showSetup() {
    navigateTo('setup-screen');
    renderSetupStep();
}

function renderSetupStep(step = 1) {
    // Esta función se completa en ui-forms.js
    // Aquí dejamos la referencia para que ui-forms.js la sobrescriba
    if (typeof renderOnboardingStep === 'function') {
        renderOnboardingStep(step);
    }
}

// ---------- Privacy Screen ----------
function showPrivacyScreen() {
    navigateTo('privacy-screen');
}

function hidePrivacyScreen() {
    acceptPrivacy();
    navigateTo('onboarding-screen');
    if (typeof initOnboarding === 'function') {
        initOnboarding();
    }
}

// ---------- Dashboard Screen ----------
function showDashboard() {
    navigateTo('dashboard-screen');
    renderAll();
}

// ---------- Account Select Populator ----------
function populateAccountSelects() {
    const accounts = getActiveAccounts();
    const currency = state.settings.currency || 'COP';
    
    // Poblar select de cuenta para transacciones
    const selectors = ['tx-account', 'transfer-from', 'transfer-to', 'cash-conversion-from', 'cash-conversion-to'];
    
    selectors.forEach(selId => {
        const select = $(selId);
        if (!select) return;
        
        const prevValue = select.value;
        select.innerHTML = '';
        
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `${acc.name} (${formatCurrency(acc.balance, currency)})`;
            select.appendChild(opt);
        });
        
        // Restaurar selección previa si existe
        if (accounts.some(a => a.id === prevValue)) {
            select.value = prevValue;
        }
    });
    
    // Poblar filtros en view-all
    const filterSelect = $('view-all-account-filter');
    if (filterSelect) {
        const prevValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">Todas las cuentas</option>';
        
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name;
            filterSelect.appendChild(opt);
        });
        
        if (prevValue) filterSelect.value = prevValue;
    }
    
    // Poblar select de cuenta en formulario de inversión
    const invAccountSelect = $('investment-source-account');
    if (invAccountSelect) {
        const prevValue = invAccountSelect.value;
        invAccountSelect.innerHTML = '<option value="">Seleccionar cuenta</option>';
        
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `${acc.name} (${formatCurrency(acc.balance, currency)})`;
            invAccountSelect.appendChild(opt);
        });
        
        if (prevValue) invAccountSelect.value = prevValue;
    }
    
    // Poblar select de entidades financieras en inversión
    const entitySelect = $('investment-entity');
    if (entitySelect) {
        const prevValue = entitySelect.value;
        const entities = getFinancialEntities();
        
        entitySelect.innerHTML = '<option value="">Seleccionar entidad</option>';
        
        entities.forEach(entity => {
            const opt = document.createElement('option');
            opt.value = entity.id;
            opt.textContent = entity.name;
            entitySelect.appendChild(opt);
        });
        
        // Opción para nueva entidad
        const newOpt = document.createElement('option');
        newOpt.value = 'new';
        newOpt.textContent = '+ Registrar nueva entidad financiera';
        entitySelect.appendChild(newOpt);
        
        if (prevValue) entitySelect.value = prevValue;
    }
}

// ---------- Init Rendering ----------
function initRender() {
    // Verificar privacidad
    if (!hasAcceptedPrivacy()) {
        showPrivacyScreen();
        return;
    }
    
    // Verificar onboarding
    if (!isOnboardingCompleted()) {
        showSetup();
        return;
    }
    
    // Mostrar dashboard
    showDashboard();
    populateAccountSelects();
}
