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
