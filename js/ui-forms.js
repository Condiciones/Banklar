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

// ---------- Initialize ----------
window.addEventListener('load', () => {
    const migrated = migrateFromOldVersions();

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
