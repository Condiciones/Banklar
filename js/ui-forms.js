// ---------- Onboarding State ----------
let onboardingStep = 1;
let onboardingData = {
    name: '',
    currency: 'COP',
    locale: 'es-CO',
    accountCount: 1,
    accounts: []
};

// ---------- Form Visibility ----------
function updateFormVisibility() {
    if (!el.txType) return;
    
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

    // Depositar a cuenta principal (nuevo)
    if (el.depositToPrincipal && el.depositToPrincipal.parentElement) {
        el.depositToPrincipal.parentElement.style.display = isIncome ? 'block' : 'none';
    }

    if (el.principalSplitRow) {
        el.principalSplitRow.style.display = (isIncome && el.depositToPrincipal && el.depositToPrincipal.checked) ? 'block' : 'none';
    }

    // Poblar select de cuenta según tipo
    populateTxAccountSelect(isIncome, isExpense, isTransfer, isCashConversion);
    
    // Poblar transferencias y conversiones
    if (isTransfer) populateTransferSelects();
    if (isCashConversion) populateCashConversionSelects();
}

function populateTxAccountSelect(isIncome, isExpense, isTransfer, isCashConversion) {
    if (!el.txAccount) return;
    
    const accounts = getActiveAccounts();
    const currency = state.settings.currency || 'COP';
    const currentValue = el.txAccount.value;

    el.txAccount.innerHTML = '';

    if (isIncome || isExpense) {
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `${acc.name} (${formatCurrency(acc.balance, currency)})`;
            el.txAccount.appendChild(opt);
        });
    }

    // Restaurar selección si es válida
    if (currentValue && accounts.some(a => a.id === currentValue)) {
        el.txAccount.value = currentValue;
    } else if (accounts.length > 0) {
        // Preseleccionar cuenta principal
        const principal = getPrincipalAccount();
        if (principal) el.txAccount.value = principal.id;
    }
}

function populateTransferSelects() {
    if (!el.transferFrom) return;
    
    const accounts = getActiveAccounts();
    const currency = state.settings.currency || 'COP';
    const currentValue = el.transferFrom.value;

    el.transferFrom.innerHTML = '<option value="">Seleccionar origen</option>';

    accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = `${acc.name} (${formatCurrency(acc.balance, currency)})`;
        el.transferFrom.appendChild(opt);
    });

    if (currentValue && accounts.some(a => a.id === currentValue)) {
        el.transferFrom.value = currentValue;
    }

    // Poblar destino también si existe
    const transferTo = $('transfer-to');
    if (transferTo) {
        const toCurrentValue = transferTo.value;
        transferTo.innerHTML = '<option value="">Seleccionar destino</option>';
        
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `${acc.name} (${formatCurrency(acc.balance, currency)})`;
            transferTo.appendChild(opt);
        });

        if (toCurrentValue && accounts.some(a => a.id === toCurrentValue)) {
            transferTo.value = toCurrentValue;
        }
    }
}

function populateCashConversionSelects() {
    if (!el.cashConversionDetails) return;
    
    const conversionType = el.cashConversionType ? el.cashConversionType.value : 'to_cash';
    const accounts = getActiveAccounts();
    const currency = state.settings.currency || 'COP';
    const currentValue = el.cashConversionDetails.value;

    el.cashConversionDetails.innerHTML = '';

    if (conversionType === 'to_cash') {
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `${acc.name} → Efectivo (${formatCurrency(acc.balance, currency)})`;
            el.cashConversionDetails.appendChild(opt);
        });
    } else {
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = `Efectivo → ${acc.name} (${formatCurrency(acc.balance, currency)})`;
            el.cashConversionDetails.appendChild(opt);
        });
    }

    if (currentValue && accounts.some(a => a.id === currentValue)) {
        el.cashConversionDetails.value = currentValue;
    }
}

// ---------- Transaction Handlers ----------
function handleTransactionSubmit(e) {
    e.preventDefault();

    const type = el.txType.value;
    const amountInput = el.txAmount;
    let amount = 0;

    // Usar currency input Nu Bank si está configurado
    if (amountInput && amountInput.getValue) {
        amount = amountInput.getValue();
    } else {
        amount = parseCurrencyFormatted(amountInput ? amountInput.value : '0');
    }

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

    // Resetear formulario
    el.txForm.reset();
    resetCurrencyInputs();
    setDefaultDateTime();
    updateFormVisibility();
    initializeCurrencyMasks();
}

function handleIncomeTransaction(amount) {
    const source = el.incomeSource ? el.incomeSource.value : 'Ingreso';
    const accountId = el.txAccount ? el.txAccount.value : null;
    const depositPrincipal = el.depositToPrincipal && el.depositToPrincipal.checked;
    const toAccountId = depositPrincipal ? getPrincipalAccountId() : null;

    let principalAllocated = 0;
    if (depositPrincipal && el.principalSplitAmount) {
        if (el.principalSplitAmount.getValue) {
            principalAllocated = el.principalSplitAmount.getValue();
        } else {
            principalAllocated = parseCurrencyFormatted(el.principalSplitAmount.value || '0');
        }
        if (principalAllocated <= 0 || principalAllocated >= amount) {
            principalAllocated = amount;
        }
    }

    // Verificar que la cuenta existe
    if (!accountId) {
        showToast('Selecciona una cuenta válida', 'error');
        return;
    }

    const tx = {
        id: uid(),
        type: 'income',
        amount: Number(amount.toFixed(2)),
        source,
        accountId,
        toAccountId: depositPrincipal ? toAccountId : null,
        principalAllocated: depositPrincipal ? Number(principalAllocated.toFixed(2)) : 0,
        description: ''
    };

    addTransaction(tx);
}

function handleExpenseTransaction(amount) {
    const category = el.expenseCategory ? el.expenseCategory.value : 'Otros';
    const accountId = el.txAccount ? el.txAccount.value : null;

    if (!accountId) {
        showToast('Selecciona una cuenta válida', 'error');
        return;
    }

    // Verificar saldo
    const balance = getBalanceForAccount(accountId);
    const account = getAccountById(accountId);

    if (amount > balance) {
        showToast(`Saldo insuficiente en ${account ? account.name : 'la cuenta seleccionada'}`, 'error');
        return;
    }

    const tx = {
        id: uid(),
        type: 'expense',
        amount: Number(amount.toFixed(2)),
        accountId,
        category,
        description: ''
    };

    addTransaction(tx);
}

function handleTransferTransaction(amount) {
    const fromAccountId = el.transferFrom ? el.transferFrom.value : null;
    const transferTo = $('transfer-to');
    const toAccountId = transferTo ? transferTo.value : null;

    if (!fromAccountId || !toAccountId) {
        showToast('Selecciona cuenta origen y destino', 'error');
        return;
    }

    if (fromAccountId === toAccountId) {
        showToast('Origen y destino no pueden ser la misma cuenta', 'error');
        return;
    }

    // Verificar saldo
    const balance = getBalanceForAccount(fromAccountId);
    if (amount > balance) {
        const account = getAccountById(fromAccountId);
        showToast(`Saldo insuficiente en ${account ? account.name : 'la cuenta origen'}`, 'error');
        return;
    }

    const fromAccount = getAccountById(fromAccountId);
    const toAccount = getAccountById(toAccountId);

    const tx = {
        id: uid(),
        type: 'transfer',
        amount: Number(amount.toFixed(2)),
        fromAccountId,
        toAccountId,
        from: fromAccount ? fromAccount.name : '',
        to: toAccount ? toAccount.name : '',
        description: `Transferencia: ${fromAccount ? fromAccount.name : '?'} → ${toAccount ? toAccount.name : '?'}`
    };

    addTransaction(tx);
    showToast(`Transferencia de ${formatCurrency(amount, state.settings.currency)} realizada`, 'success');
}

function handleCashConversionTransaction(amount) {
    const conversionType = el.cashConversionType ? el.cashConversionType.value : 'to_cash';
    const accountId = el.cashConversionDetails ? el.cashConversionDetails.value : null;

    if (!accountId) {
        showToast('Selecciona una cuenta para la conversión', 'error');
        return;
    }

    const cashAccount = getAccountByName('efectivo');
    let fromAccountId, toAccountId, conversionDescription;
    const account = getAccountById(accountId);
    const accountName = account ? account.name : '?';

    if (conversionType === 'to_cash') {
        fromAccountId = accountId;
        toAccountId = cashAccount ? cashAccount.id : null;
        conversionDescription = `${accountName} → Efectivo`;
    } else {
        fromAccountId = cashAccount ? cashAccount.id : null;
        toAccountId = accountId;
        conversionDescription = `Efectivo → ${accountName}`;
    }

    // Verificar saldo
    const balance = getBalanceForAccount(fromAccountId);
    if (amount > balance) {
        const fromAcc = getAccountById(fromAccountId);
        showToast(`Saldo insuficiente en ${fromAcc ? fromAcc.name : 'la cuenta origen'}`, 'error');
        return;
    }

    const tx = {
        id: uid(),
        type: 'cash-conversion',
        amount: Number(amount.toFixed(2)),
        conversionType,
        fromAccountId,
        toAccountId,
        from: conversionType === 'to_cash' ? accountName : 'Efectivo',
        to: conversionType === 'to_cash' ? 'Efectivo' : accountName,
        description: `Conversión: ${conversionDescription}`
    };

    addTransaction(tx);
    showToast(`Conversión de ${formatCurrency(amount, state.settings.currency)} realizada`, 'success');
}

// ---------- Transaction Actions (ver/eliminar) ----------
function handleTransactionActions(e) {
    const action = e.target.dataset.action;
    const id = e.target.dataset.id;

    if (!action) return;

    if (action === 'del') {
        if (confirm('¿Eliminar transacción? Esto revertirá su efecto.')) {
            removeTransactionById(id);
        }
    } else if (action === 'view') {
        const tx = state.transactions.find(t => t.id === id);
        if (!tx) return;

        const currency = state.settings.currency || 'COP';
        const dateTimeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
        let message = `📋 Transacción\n\n` +
            `ID: ${tx.id}\n` +
            `Tipo: ${getTransactionTypeLabel(tx.type)}\n` +
            `Monto: ${formatCurrency(tx.amount, currency)}\n` +
            `Fecha: ${dateTimeDisplay}\n`;

        if (tx.type === 'transfer') {
            const fromAcc = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
            const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : null;
            message += `De: ${fromAcc ? fromAcc.name : (tx.from || '?')}\n`;
            message += `A: ${toAcc ? toAcc.name : (tx.to || '?')}\n`;
        } else if (tx.type === 'cash-conversion') {
            const fromAcc = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
            const toAcc = tx.toAccountId ? getAccountById(tx.toAccountId) : null;
            message += `Tipo: ${tx.conversionType === 'to_cash' ? 'Digital → Efectivo' : 'Efectivo → Digital'}\n`;
            message += `De: ${fromAcc ? fromAcc.name : (tx.from || '?')}\n`;
            message += `A: ${toAcc ? toAcc.name : (tx.to || '?')}\n`;
        } else {
            const acc = tx.accountId ? getAccountById(tx.accountId) : null;
            message += `Cuenta: ${acc ? acc.name : (tx.account || '?')}\n`;
            if (tx.type === 'income') {
                message += `Origen: ${tx.source || 'Ingreso'}\n`;
                if (tx.principalAllocated > 0) {
                    message += `Asignado a cuenta principal: ${formatCurrency(tx.principalAllocated, currency)}\n`;
                }
            } else {
                message += `Categoría: ${tx.category || 'Gasto'}\n`;
            }
        }

        if (tx.description) {
            message += `Descripción: ${tx.description}\n`;
        }

        alert(message);
    }
}

function getTransactionTypeLabel(type) {
    const labels = {
        'income': 'Ingreso',
        'expense': 'Gasto',
        'transfer': 'Transferencia',
        'cash-conversion': 'Conversión',
        'investment_contribution': 'Aporte a inversión',
        'investment_return': 'Rendimiento'
    };
    return labels[type] || type;
}

// ---------- Settings ----------
function handleSettingsSubmit(e) {
    e.preventDefault();

    const lowThresholdInput = $('settings-low-threshold');
    const currencySelect = $('settings-currency');
    const themeSelect = $('settings-theme');

    if (lowThresholdInput) {
        if (lowThresholdInput.getValue) {
            state.settings.lowThreshold = lowThresholdInput.getValue();
        } else {
            state.settings.lowThreshold = parseCurrencyFormatted(lowThresholdInput.value || '0');
        }
    }

    if (currencySelect) {
        const newCurrency = currencySelect.value;
        const currencyDef = CURRENCIES.find(c => c.code === newCurrency);
        
        state.settings.currency = newCurrency;
        if (currencyDef) {
            state.settings.locale = currencyDef.locale;
        }
    }

    if (themeSelect) {
        setTheme(themeSelect.value);
    }

    if (saveState(state)) {
        showToast('Configuración guardada correctamente', 'success');
    }

    hideAllModals();
    renderAll();
    populateAccountSelects();
}

function showSettings() {
    showModal('settings-modal');
    
    // Poblar valores actuales
    const lowThresholdInput = $('settings-low-threshold');
    if (lowThresholdInput) {
        if (lowThresholdInput.setValue) {
            lowThresholdInput.setValue(state.settings.lowThreshold || 0);
        } else {
            lowThresholdInput.value = (state.settings.lowThreshold || 0).toString();
        }
    }

    const currencySelect = $('settings-currency');
    if (currencySelect) {
        currencySelect.innerHTML = '';
        CURRENCIES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = `${c.symbol} ${c.name}`;
            currencySelect.appendChild(opt);
        });
        currencySelect.value = state.settings.currency || 'COP';
    }

    const themeSelect = $('settings-theme');
    if (themeSelect) {
        themeSelect.value = getTheme();
    }
}

// ---------- Budgets ----------
function handleAddBudget() {
    const sel = $('new-budget-name');
    const name = sel ? sel.value : '';
    const amtInput = $('new-budget-amt');
    let amt = 0;

    if (amtInput && amtInput.getValue) {
        amt = amtInput.getValue();
    } else {
        amt = parseCurrencyFormatted(amtInput ? amtInput.value : '0');
    }

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
    if (amtInput) {
        if (amtInput.clearValue) {
            amtInput.clearValue();
        } else {
            amtInput.value = '';
        }
    }

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
        let amt = 0;
        
        if (amtInputs[i] && amtInputs[i].getValue) {
            amt = amtInputs[i].getValue();
        } else {
            amt = parseCurrencyFormatted((amtInputs[i] && amtInputs[i].value) || '0');
        }

        if (name && amt > 0) newBudgets[name] = amt;
    }

    state.budgets = newBudgets;

    if (saveState(state)) showToast('Presupuestos guardados correctamente', 'success');

    populateCategorySelects();
    hideAllModals();
    renderAll();
}

function showBudgets() {
    showModal('budgets-modal');
    
    const list = $('budgets-form-list');
    if (!list) return;

    list.innerHTML = '';

    const cats = getCategories();
    const currency = state.settings.currency || 'COP';

    Object.entries(state.budgets || {}).forEach(([key, val]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
        div.innerHTML = `
            <select class="budget-cat-select" style="flex:1;">
                ${cats.map(c => `<option value="${c}" ${c === key ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <input type="text" class="budget-amt-input currency-input" value="${formatCurrency(val, currency)}" style="flex:1;text-align:right;">
            <button type="button" class="remove-budget" data-key="${key}" style="color:var(--danger);">✕</button>
        `;
        list.appendChild(div);
        initializeCurrencyMasks();
    });

    // Botón para añadir nueva fila
    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.textContent = '+ Agregar presupuesto';
    addRowBtn.style.cssText = 'margin-top:8px;padding:8px;width:100%;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:8px;cursor:pointer;color:var(--text);';
    addRowBtn.onclick = handleAddBudgetRow;
    list.appendChild(addRowBtn);
}

function handleAddBudgetRow() {
    const list = $('budgets-form-list');
    if (!list) return;

    const cats = getCategories();
    const addRowBtn = list.querySelector('button:last-child');

    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
    div.innerHTML = `
        <select class="budget-cat-select" style="flex:1;">
            <option value="" disabled selected>Seleccionar categoría</option>
            ${cats.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <input type="text" class="budget-amt-input currency-input" placeholder="Monto" style="flex:1;text-align:right;">
        <button type="button" class="remove-budget-row" style="color:var(--danger);">✕</button>
    `;

    list.insertBefore(div, addRowBtn);
    initializeCurrencyMasks();

    // Evento para eliminar fila
    div.querySelector('.remove-budget-row').addEventListener('click', () => {
        div.remove();
    });
}

// ---------- Onboarding / Setup ----------
function handleSetupSubmit(e) {
    e.preventDefault();

    if (onboardingStep === 1) {
        handleOnboardingStep1();
    } else if (onboardingStep === 2) {
        handleOnboardingStep2();
    }
}

function handleOnboardingStep1() {
    const nameInput = $('onboarding-name');
    const currencySelect = $('onboarding-currency');
    
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        showToast('Por favor ingresa tu nombre', 'error');
        return;
    }

    onboardingData.name = name;
    onboardingData.currency = currencySelect ? currencySelect.value : 'COP';
    
    // Establecer locale según moneda
    const currencyDef = CURRENCIES.find(c => c.code === onboardingData.currency);
    onboardingData.locale = currencyDef ? currencyDef.locale : 'es-CO';

    onboardingStep = 2;
    renderOnboardingStep(2);
}

function handleOnboardingStep2() {
    const accountCountInput = $('onboarding-account-count');
    const accountCount = accountCountInput ? parseInt(accountCountInput.value) : 1;
    
    if (accountCount < 1 || accountCount > 10) {
        showToast('Selecciona entre 1 y 10 cuentas', 'error');
        return;
    }

    onboardingData.accountCount = accountCount;
    onboardingData.accounts = [];

    // Recoger datos de cada cuenta
    for (let i = 0; i < accountCount; i++) {
        const nameInput = $(`onboarding-account-name-${i}`);
        const balanceInput = $(`onboarding-account-balance-${i}`);
        
        const accountName = nameInput ? nameInput.value.trim() : '';
        let balance = 0;
        
        if (balanceInput && balanceInput.getValue) {
            balance = balanceInput.getValue();
        } else {
            balance = parseCurrencyFormatted(balanceInput ? balanceInput.value : '0');
        }

        if (!accountName) {
            showToast(`Ingresa el nombre de la cuenta ${i + 1}`, 'error');
            return;
        }

        let type = 'additional';
        if (i === 0) type = 'principal';
        else if (i === 1) type = 'secondary';

        onboardingData.accounts.push({
            name: accountName,
            balance: balance,
            type: type
        });
    }

    // Completar onboarding
    completeOnboardingProcess();
}

function completeOnboardingProcess() {
    // Crear entidades financieras
    const entities = [];
    const accounts = [];

    onboardingData.accounts.forEach((accData, index) => {
        // Verificar si la entidad ya existe
        let entity = entities.find(e => e.name.toLowerCase() === accData.name.toLowerCase());
        if (!entity) {
            entity = {
                id: generateId(),
                name: accData.name,
                createdAt: nowISO()
            };
            entities.push(entity);
        }

        accounts.push({
            id: generateId(),
            name: accData.name,
            entityId: entity.id,
            entityName: entity.name,
            type: accData.type,
            balance: accData.balance,
            isActive: true,
            displayOrder: index,
            createdAt: nowISO(),
            updatedAt: nowISO()
        });
    });

    // Guardar todo
    const userData = {
        name: onboardingData.name,
        currency: onboardingData.currency,
        locale: onboardingData.locale,
        theme: 'system',
        lowThreshold: 20000,
        accounts: accounts,
        financialEntities: entities,
        createdAt: nowISO()
    };

    completeOnboarding(userData);

    // Calcular patrimonio inicial
    const patrimony = calculateTotalPatrimony();

    showToast(`¡Bienvenido ${onboardingData.name}! Patrimonio inicial: ${formatCurrency(patrimony.total, onboardingData.currency)}`, 'success');

    hideAllModals();
    populateCategorySelects();
    populateAccountSelects();
    showDashboard();
}

// ---------- Render Onboarding Steps ----------
function renderOnboardingStep(step) {
    const container = $('onboarding-container');
    if (!container) return;

    onboardingStep = step;
    const currency = onboardingData.currency || 'COP';

    if (step === 1) {
        container.innerHTML = `
            <div class="onboarding-step">
                <div class="step-indicator">
                    <span class="step-dot active"></span>
                    <span class="step-dot"></span>
                </div>
                <h2>Configuración inicial</h2>
                <p class="step-subtitle">Paso 1 de 2</p>
                
                <div class="form-group">
                    <label for="onboarding-name">¿Cómo te llamas?</label>
                    <input type="text" id="onboarding-name" class="form-input" placeholder="Tu nombre" value="${onboardingData.name}" required>
                </div>

                <div class="form-group">
                    <label for="onboarding-currency">Moneda principal</label>
                    <select id="onboarding-currency" class="form-input">
                        ${CURRENCIES.map(c => `<option value="${c.code}" ${c.code === onboardingData.currency ? 'selected' : ''}>${c.symbol} ${c.name}</option>`).join('')}
                    </select>
                </div>

                <button onclick="handleSetupSubmit(event)" class="btn-primary" style="width:100%;margin-top:16px;">
                    Continuar →
                </button>
            </div>
        `;
    } else if (step === 2) {
        const countOptions = '';
        for (let i = 1; i <= 10; i++) {
            countOptions += `<option value="${i}" ${i === onboardingData.accountCount ? 'selected' : ''}>${i} cuenta${i > 1 ? 's' : ''}</option>`;
        }

        container.innerHTML = `
            <div class="onboarding-step">
                <div class="step-indicator">
                    <span class="step-dot completed"></span>
                    <span class="step-dot active"></span>
                </div>
                <h2>Tus cuentas</h2>
                <p class="step-subtitle">Paso 2 de 2</p>

                <div class="form-group">
                    <label for="onboarding-account-count">¿Cuántas cuentas deseas registrar?</label>
                    <select id="onboarding-account-count" class="form-input" onchange="renderAccountForms()">
                        ${countOptions}
                    </select>
                </div>

                <div id="onboarding-accounts-forms"></div>

                <button onclick="handleSetupSubmit(event)" class="btn-primary" style="width:100%;margin-top:16px;">
                    Completar configuración ✓
                </button>
            </div>
        `;

        renderAccountForms();
    }
}

function renderAccountForms() {
    const formsContainer = $('onboarding-accounts-forms');
    const countInput = $('onboarding-account-count');
    if (!formsContainer || !countInput) return;

    const count = parseInt(countInput.value) || 1;
    const forms = generateAccountForms(count);

    formsContainer.innerHTML = '';

    forms.forEach((form, i) => {
        const formDiv = document.createElement('div');
        formDiv.className = 'account-form-card';
        formDiv.innerHTML = `
            <div class="account-form-header">
                <span class="account-form-type ${form.type}">${getAccountTypeLabel(form.type)}</span>
                <h3>${form.title}</h3>
            </div>
            <p class="account-form-subtitle">${form.subtitle}</p>
            
            <div class="form-group">
                <label for="onboarding-account-name-${i}">Nombre de la cuenta o banco</label>
                <input type="text" id="onboarding-account-name-${i}" class="form-input" placeholder="${form.fields.name.placeholder}" ${form.required ? 'required' : ''}>
            </div>

            <div class="form-group">
                <label for="onboarding-account-balance-${i}">Saldo actual</label>
                <input type="text" id="onboarding-account-balance-${i}" class="form-input currency-input" placeholder="${form.fields.balance.placeholder}" data-currency-display="balance-display-${i}">
                <span id="balance-display-${i}" class="currency-display">$0,00</span>
            </div>
        `;

        formsContainer.appendChild(formDiv);
    });

    // Inicializar máscaras de moneda en los nuevos inputs
    initializeCurrencyMasks();
}

function initOnboarding() {
    onboardingStep = 1;
    onboardingData = {
        name: '',
        currency: 'COP',
        locale: 'es-CO',
        accountCount: 1,
        accounts: []
    };
    renderOnboardingStep(1);
}

// ---------- Investment Form ----------
function showNewInvestmentForm() {
    showModal('investment-modal');
    
    const container = $('investment-form-container');
    if (!container) return;

    const entities = getFinancialEntities();
    const accounts = getActiveAccounts();
    const currency = state.settings.currency || 'COP';

    container.innerHTML = `
        <form id="investment-form" onsubmit="handleInvestmentSubmit(event)">
            <div class="form-group">
                <label for="investment-type">Tipo de inversión</label>
                <select id="investment-type" class="form-input" onchange="handleInvestmentTypeChange()">
                    ${INVESTMENT_TYPES.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
            </div>

            <div id="investment-custom-name-group" class="form-group" style="display:none;">
                <label for="investment-custom-name">Nombre personalizado</label>
                <input type="text" id="investment-custom-name" class="form-input" placeholder="Ej: Fondo de inversión propio">
            </div>

            <div class="form-group">
                <label for="investment-entity">Entidad financiera</label>
                <select id="investment-entity" class="form-input" onchange="handleInvestmentEntityChange()">
                    <option value="">Seleccionar entidad</option>
                    ${entities.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
                    <option value="new">+ Registrar nueva entidad financiera</option>
                </select>
            </div>

            <div id="investment-new-entity-group" class="form-group" style="display:none;">
                <label for="investment-new-entity-name">Nombre de la nueva entidad</label>
                <input type="text" id="investment-new-entity-name" class="form-input" placeholder="Ej: Banco Popular">
            </div>

            <div class="form-group">
                <label for="investment-name">Nombre de la inversión</label>
                <input type="text" id="investment-name" class="form-input" placeholder="Ej: Fondo de emergencia" required>
            </div>

            <div class="form-group">
                <label for="investment-initial-amount">Capital inicial</label>
                <input type="text" id="investment-initial-amount" class="form-input currency-input" placeholder="Monto inicial" data-currency-display="inv-amount-display" required>
                <span id="inv-amount-display" class="currency-display">$0,00</span>
            </div>

            <div class="form-group">
                <label for="investment-annual-rate">Tasa Efectiva Anual (EA) %</label>
                <input type="number" id="investment-annual-rate" class="form-input" placeholder="Ej: 8, 10, 12.5" step="0.01" min="0" max="100" required>
            </div>

            <div class="form-group">
                <label for="investment-frequency">¿Cada cuánto se reflejan los rendimientos?</label>
                <select id="investment-frequency" class="form-input" onchange="handleInvestmentFrequencyChange()">
                    ${ACCREDITATION_FREQUENCIES.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
                </select>
            </div>

            <div id="investment-custom-days-group" class="form-group" style="display:none;">
                <label for="investment-custom-days">¿Cada cuántos días se reflejan los rendimientos?</label>
                <input type="number" id="investment-custom-days" class="form-input" placeholder="Ej: 15, 45, 90" min="1" max="365">
                <small>Ingresa la cantidad exacta de días según las condiciones de tu producto financiero.</small>
            </div>

            <div class="form-group">
                <label for="investment-source-account">Cuenta de origen (opcional)</label>
                <select id="investment-source-account" class="form-input">
                    <option value="">No asociar cuenta</option>
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance, currency)})</option>`).join('')}
                </select>
            </div>

            <button type="submit" class="btn-primary" style="width:100%;margin-top:16px;">
                Crear inversión
            </button>
        </form>
    `;

    initializeCurrencyMasks();
}

function handleInvestmentTypeChange() {
    const typeSelect = $('investment-type');
    const customNameGroup = $('investment-custom-name-group');
    
    if (typeSelect && customNameGroup) {
        const selectedType = INVESTMENT_TYPES.find(t => t.id === typeSelect.value);
        customNameGroup.style.display = (selectedType && selectedType.isCustom) ? 'block' : 'none';
    }
}

function handleInvestmentEntityChange() {
    const entitySelect = $('investment-entity');
    const newEntityGroup = $('investment-new-entity-group');
    
    if (entitySelect && newEntityGroup) {
        newEntityGroup.style.display = entitySelect.value === 'new' ? 'block' : 'none';
    }
}

function handleInvestmentFrequencyChange() {
    const freqSelect = $('investment-frequency');
    const customDaysGroup = $('investment-custom-days-group');
    
    if (freqSelect && customDaysGroup) {
        customDaysGroup.style.display = freqSelect.value === 'custom' ? 'block' : 'none';
    }
}

function handleInvestmentSubmit(e) {
    e.preventDefault();

    const typeId = $('investment-type').value;
    const customTypeName = $('investment-custom-name') ? $('investment-custom-name').value.trim() : null;
    const entitySelectValue = $('investment-entity').value;
    const investmentName = $('investment-name').value.trim();
    const initialAmountInput = $('investment-initial-amount');
    const annualRate = parseFloat($('investment-annual-rate').value);
    const frequencyId = $('investment-frequency').value;
    const customDays = frequencyId === 'custom' ? parseInt($('investment-custom-days').value) : null;
    const sourceAccountId = $('investment-source-account').value || null;

    let initialAmount = 0;
    if (initialAmountInput && initialAmountInput.getValue) {
        initialAmount = initialAmountInput.getValue();
    } else {
        initialAmount = parseCurrencyFormatted(initialAmountInput ? initialAmountInput.value : '0');
    }

    // Validaciones
    if (!investmentName) {
        showToast('Ingresa un nombre para la inversión', 'error');
        return;
    }

    if (initialAmount <= 0) {
        showToast('El capital inicial debe ser mayor a 0', 'error');
        return;
    }

    if (isNaN(annualRate) || annualRate <= 0 || annualRate > 100) {
        showToast('La tasa EA debe estar entre 0 y 100', 'error');
        return;
    }

    if (frequencyId === 'custom' && (!customDays || customDays < 1)) {
        showToast('Ingresa una cantidad de días válida', 'error');
        return;
    }

    // Manejar entidad financiera
    let entityId;
    if (entitySelectValue === 'new') {
        const newEntityName = $('investment-new-entity-name').value.trim();
        if (!newEntityName) {
            showToast('Ingresa el nombre de la nueva entidad', 'error');
            return;
        }
        const entity = addFinancialEntity(newEntityName);
        entityId = entity.id;
    } else if (entitySelectValue) {
        entityId = entitySelectValue;
    } else {
        showToast('Selecciona una entidad financiera', 'error');
        return;
    }

    const accreditationDays = frequencyId === 'custom' ? customDays : getAccreditationDays(frequencyId);

    // Crear inversión
    const investment = createInvestment({
        typeId,
        customTypeName,
        entityId,
        sourceAccountId,
        name: investmentName,
        initialAmount,
        annualRate,
        accreditationFrequency: frequencyId,
        accreditationDays
    });

    if (investment) {
        showToast(`Inversión "${investmentName}" creada exitosamente`, 'success');
        hideAllModals();
        renderAll();
    }
}

// ---------- Data Portability Modals ----------
function showPortabilityModal() {
    showModal('portability-modal');
    const textarea = $('data-export-text');
    if (textarea) {
        textarea.value = JSON.stringify(state, null, 2);
    }
}

function showImportModal() {
    showModal('import-modal');
}

function showExportModal() {
    showModal('export-modal');
}

// ---------- Currency Input Helpers ----------
function resetCurrencyInputs() {
    document.querySelectorAll('.currency-input').forEach(input => {
        if (input.clearValue) {
            input.clearValue();
        } else {
            input.value = '';
        }
    });
}

function setDefaultDateTime() {
    if (el.txDate) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        el.txDate.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}

function getPrincipalAccountId() {
    const principal = getPrincipalAccount();
    return principal ? principal.id : null;
}

// ---------- Event Listeners ----------
function initializeEventListeners() {
    // Formulario de transacción
    if (el.txType) {
        el.txType.addEventListener('change', updateFormVisibility);
    }

    if (el.cashConversionType) {
        el.cashConversionType.addEventListener('change', updateFormVisibility);
    }

    if (el.depositToPrincipal) {
        el.depositToPrincipal.addEventListener('change', updateFormVisibility);
    }

    // Compatibilidad con nombre antiguo
    if (el.depositToNu) {
        el.depositToNu.addEventListener('change', updateFormVisibility);
    }

    if (el.txForm) {
        el.txForm.addEventListener('submit', handleTransactionSubmit);
    }

    // Acciones en transacciones (ver/eliminar)
    document.addEventListener('click', handleTransactionActions);

    // Botones ver todo
    if (el.btnViewAll) el.btnViewAll.addEventListener('click', () => showViewAll());
    if (el.btnViewAll2) el.btnViewAll2.addEventListener('click', () => showViewAll());

    // Filtros en view-all
    const txFilterType = $('tx-filter-type');
    const txFilterAccount = $('tx-filter-account');
    const txSearch = $('tx-search');

    if (txFilterType) txFilterType.addEventListener('change', () => showViewAll(txFilterType.value, txFilterAccount ? txFilterAccount.value : 'all'));
    if (txFilterAccount) txFilterAccount.addEventListener('change', () => showViewAll(txFilterType ? txFilterType.value : 'all', txFilterAccount.value));
    if (txSearch) txSearch.addEventListener('input', debounce(() => showViewAll(
        txFilterType ? txFilterType.value : 'all',
        txFilterAccount ? txFilterAccount.value : 'all'
    ), 300));

    // Cerrar modales
    on('close-all-tx', 'click', hideAllModals);
    if (el.modalOverlay) el.modalOverlay.addEventListener('click', hideAllModals);

    // Settings
    if (el.btnSettings) el.btnSettings.addEventListener('click', showSettings);
    on('settings-form', 'submit', handleSettingsSubmit);

    // Budgets
    on('btn-edit-budgets', 'click', showBudgets);
    on('btn-close-budgets', 'click', hideAllModals);
    on('btn-add-budget', 'click', handleAddBudget);
    
    const budgetsListEl = $('budgets-form-list');
    if (budgetsListEl) budgetsListEl.addEventListener('click', handleBudgetRemoval);
    if ($('budgets-form')) $('budgets-form').addEventListener('submit', handleBudgetsSubmit);

    // Data portability
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

    // Setup / Onboarding
    if ($('setup-form')) $('setup-form').addEventListener('submit', handleSetupSubmit);

    // Reset data
    on('btn-reset-data', 'click', resetAllData);

    // Refresh
    if (el.refreshBalances) el.refreshBalances.addEventListener('click', () => {
        processAllInvestmentsOnStartup();
        renderAll();
        showToast('Balances actualizados', 'success');
    });

    // Expenses report
    if (el.btnExpensesReport) el.btnExpensesReport.addEventListener('click', showExpensesReport);
    const closeExpBtn = $('close-expenses-report');
    if (closeExpBtn) closeExpBtn.addEventListener('click', hideAllModals);

    // Summary period
    if (el.summaryMonthly) el.summaryMonthly.addEventListener('click', () => setSummaryPeriod('monthly'));
    if (el.summaryBiweekly) el.summaryBiweekly.addEventListener('click', () => setSummaryPeriod('biweekly'));

    // Nueva inversión
    on('btn-new-investment', 'click', showNewInvestmentForm);
    on('btn-close-investment', 'click', hideAllModals);

    // Cerrar modales con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideAllModals();
    });
}

// ---------- Initialize ----------
window.addEventListener('load', () => {
    // Migrar datos antiguos
    migrateFromOldVersions();

    // Inicializar core
    initCore();

    // Poblar categorías
    populateCategorySelects();

    // Inicializar máscaras de moneda
    initializeCurrencyMasks();

    // Actualizar visibilidad del formulario
    updateFormVisibility();

    // Configurar fecha/hora por defecto
    setDefaultDateTime();

    // Inicializar event listeners
    initializeEventListeners();

    // Inicializar renderizado
    initRender();

    // Refrescar al volver a la ventana
    window.addEventListener('focus', () => {
        setTimeout(() => {
            processAllInvestmentsOnStartup();
            renderAll();
        }, 500);
    });
});

// ---------- Exports ----------
window._banklar_state = state;
window._banklar_exportData = exportData;
window._banklar_computeBalances = computeBalances;
window._banklar_copyData = copyDataToClipboard;
window._banklar_importData = importDataFromClipboard;
window._banklar_showNewInvestment = showNewInvestmentForm;
