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
