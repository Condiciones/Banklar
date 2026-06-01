// ---------- Modals ----------
function showOverlay() {
    const overlay = $('modal-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function hideOverlay() {
    const overlay = $('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function hideAllModals() {
    // Ocultar todos los modales conocidos
    const modalIds = [
        'setup-modal',
        'view-all-modal',
        'settings-modal',
        'budgets-modal',
        'export-modal',
        'expenses-report-modal',
        'portability-modal',
        'import-modal',
        'onboarding-modal',
        'privacy-modal',
        'investment-modal'
    ];

    modalIds.forEach(id => {
        const modal = $(id);
        if (modal) modal.classList.add('hidden');
    });

    hideOverlay();
    document.body.style.overflow = '';
}

// ---------- Setup (Legacy - redirige al onboarding) ----------
function showSetup() {
    if (isOnboardingCompleted()) {
        showDashboard();
        return;
    }
    showSetupScreen();
}

// ---------- Pantalla de Privacidad ----------
function showPrivacyScreen() {
    const screen = $('privacy-screen');
    if (screen) {
        navigateTo('privacy-screen');
    } else {
        // Si no existe la pantalla, crear modal
        showPrivacyModal();
    }
}

function showPrivacyModal() {
    showOverlay();
    const overlay = $('modal-overlay');
    if (!overlay) return;

    // Crear modal de privacidad dinámicamente si no existe
    let modal = $('privacy-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'privacy-modal';
        modal.className = 'modal';
        modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-primary);padding:32px;border-radius:16px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;z-index:1001;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="privacy-content">
            <div class="privacy-icon">🔒</div>
            <h2 style="text-align:center;margin-bottom:16px;">Privacidad y control de tus datos</h2>
            
            <p style="margin-bottom:12px;">Tu información es únicamente tuya.</p>
            
            <p style="margin-bottom:12px;">Todos los datos que registres en esta aplicación se almacenan localmente en tu dispositivo. Esto significa que la información permanece guardada dentro de la memoria de tu teléfono o tablet y no se envía automáticamente a servidores externos, servicios en la nube ni bases de datos de terceros.</p>
            
            <p style="margin-bottom:12px;">La aplicación no comparte tus movimientos financieros, saldos, cuentas, presupuestos o registros personales con ninguna entidad externa.</p>
            
            <p style="margin-bottom:12px;">Actualmente, la aplicación funciona de manera independiente y sin sincronización en línea. Tus datos permanecen exclusivamente en el dispositivo donde fueron creados.</p>
            
            <p style="margin-bottom:12px;">La aplicación no tiene acceso a tus cuentas bancarias reales, no puede consultar movimientos bancarios y tampoco puede realizar transacciones en tu nombre.</p>
            
            <div class="privacy-important" style="background:var(--bg-secondary);padding:16px;border-radius:12px;margin:16px 0;">
                <h4 style="margin-bottom:8px;">⚠️ IMPORTANTE</h4>
                <ul style="padding-left:20px;font-size:14px;line-height:1.8;">
                    <li>Tus datos pertenecen únicamente a ti.</li>
                    <li>La aplicación no conserva copias externas de tu información.</li>
                    <li>Si cambias de dispositivo, deberás exportar y trasladar manualmente tus datos al nuevo equipo utilizando las herramientas disponibles dentro de la aplicación.</li>
                    <li>Si eliminas los datos de la aplicación, borras su almacenamiento o la desinstalas sin haber exportado previamente tu información, todos los registros se perderán de forma permanente.</li>
                    <li>Una vez eliminados, los datos no podrán recuperarse porque no existen copias almacenadas en servidores externos.</li>
                </ul>
            </div>
            
            <p style="text-align:center;font-size:14px;color:var(--text-secondary);margin-bottom:20px;">
                Al continuar, confirmas que entiendes cómo se almacenan y gestionan tus datos dentro de la aplicación.
            </p>
            
            <button onclick="acceptPrivacyAndContinue()" class="btn-primary" style="width:100%;padding:14px;font-size:16px;">
                Entiendo y acepto
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function acceptPrivacyAndContinue() {
    acceptPrivacy();
    hideAllModals();
    showOnboardingScreen();
}

// ---------- Pantalla de Onboarding ----------
function showOnboardingScreen() {
    const screen = $('onboarding-screen');
    if (screen) {
        navigateTo('onboarding-screen');
        initOnboarding();
    } else {
        showOnboardingModal();
    }
}

function showOnboardingModal() {
    showOverlay();
    const overlay = $('modal-overlay');
    if (!overlay) return;

    let modal = $('onboarding-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'onboarding-modal';
        modal.className = 'modal';
        modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--bg-primary);padding:32px;border-radius:16px;max-width:500px;width:90%;max-height:85vh;overflow-y:auto;z-index:1001;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div id="onboarding-container">
            <div class="onboarding-step">
                <div class="step-indicator">
                    <span class="step-dot active"></span>
                    <span class="step-dot"></span>
                </div>
                <h2>Configuración inicial</h2>
                <p class="step-subtitle">Paso 1 de 2</p>
                
                <div class="form-group">
                    <label for="onboarding-name">¿Cómo te llamas?</label>
                    <input type="text" id="onboarding-name" class="form-input" placeholder="Tu nombre" required>
                </div>

                <div class="form-group">
                    <label for="onboarding-currency">Moneda principal</label>
                    <select id="onboarding-currency" class="form-input">
                        ${CURRENCIES.map(c => `<option value="${c.code}" ${c.code === 'COP' ? 'selected' : ''}>${c.symbol} ${c.name}</option>`).join('')}
                    </select>
                </div>

                <button onclick="handleSetupSubmit(event)" class="btn-primary" style="width:100%;margin-top:16px;">
                    Continuar →
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Reiniciar estado del onboarding
    onboardingStep = 1;
    onboardingData = {
        name: '',
        currency: 'COP',
        locale: 'es-CO',
        accountCount: 1,
        accounts: []
    };
}

// ---------- View All Transactions ----------
function showViewAll(filterType, filterAccount) {
    showOverlay();
    const modal = $('view-all-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const container = $('all-tx-container');
    if (!container) return;
    container.innerHTML = '';

    const typeFilter = filterType || ($('tx-filter-type') ? $('tx-filter-type').value : 'all');
    const accountFilter = filterAccount || ($('tx-filter-account') ? $('tx-filter-account').value : 'all');
    const searchFilter = $('tx-search') ? $('tx-search').value : '';

    // Poblar filtro de cuentas si existe
    const accountFilterSelect = $('tx-filter-account');
    if (accountFilterSelect && accountFilterSelect.options.length <= 1) {
        const accounts = getActiveAccounts();
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name;
            accountFilterSelect.appendChild(opt);
        });
    }

    const filtered = filterTransactions(typeFilter, accountFilter, searchFilter)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (filtered.length === 0) {
        container.innerHTML = '<div class="meta" style="text-align:center;padding:24px;">No hay transacciones que coincidan con los filtros.</div>';
        return;
    }

    const currency = state.settings.currency || 'COP';

    filtered.forEach(tx => {
        const div = document.createElement('div');
        let cssClass = 'tx-row';
        if (tx.type === 'transfer') cssClass += ' tx-transfer';
        else if (tx.type === 'cash-conversion') cssClass += ' tx-cash-conversion';
        else if (tx.type === 'investment_contribution' || tx.type === 'investment_return') cssClass += ' tx-investment';
        div.className = cssClass;

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

        div.innerHTML = `
            <div style="flex:1;">
                <div>
                    <strong>${icon}${amountDisplay}</strong> 
                    <span class="meta">| ${accountInfo}</span>
                </div>
                <div class="meta">${description}</div>
                <div class="meta" style="font-size:11px;color:var(--text-secondary);">${dateTimeDisplay}</div>
                ${tx.description && tx.type !== 'transfer' && tx.type !== 'cash-conversion' ? 
                    `<div class="meta" style="font-size:11px;color:var(--text-secondary);">${tx.description}</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
                <button class="btn-ghost" data-action="view" data-id="${tx.id}">Ver</button>
                <button class="btn-ghost" data-action="del" data-id="${tx.id}" style="color:var(--danger);">Eliminar</button>
            </div>`;

        container.appendChild(div);
    });
}

// ---------- Settings ----------
function showSettings() {
    showOverlay();
    const modal = $('settings-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Poblar valores actuales
    const lowThresholdInput = $('settings-low-threshold');
    if (lowThresholdInput) {
        if (lowThresholdInput.setValue) {
            lowThresholdInput.setValue(state.settings.lowThreshold || 20000);
        } else {
            lowThresholdInput.value = formatCurrency(state.settings.lowThreshold || 20000, state.settings.currency).replace(/[^0-9,]/g, '').trim();
        }
    }

    const currencySelect = $('settings-currency');
    if (currencySelect) {
        currencySelect.innerHTML = '';
        CURRENCIES.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = `${c.symbol} ${c.name}`;
            if (c.code === (state.settings.currency || 'COP')) opt.selected = true;
            currencySelect.appendChild(opt);
        });
    }

    const themeSelect = $('settings-theme');
    if (themeSelect) {
        themeSelect.value = getTheme();
    }

    initializeCurrencyMasks();
}

// ---------- Budgets ----------
function showBudgets() {
    showOverlay();
    const modal = $('budgets-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const list = $('budgets-form-list');
    if (!list) return;
    list.innerHTML = '';

    const keys = Object.keys(state.budgets || {});
    const cats = getCategories();
    const currency = state.settings.currency || 'COP';

    if (keys.length === 0) {
        const p = document.createElement('div');
        p.className = 'meta';
        p.style.cssText = 'text-align:center;padding:16px;';
        p.textContent = 'Aún no hay presupuestos. Agrega uno abajo.';
        list.appendChild(p);
    }

    let i = 0;
    keys.forEach(k => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';

        const selHtml = document.createElement('select');
        selHtml.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);';
        selHtml.dataset.idx = i;
        selHtml.className = 'budget-cat-select';

        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            if (c === k) opt.selected = true;
            selHtml.appendChild(opt);
        });

        // Si la categoría no está en la lista, agregarla
        if (!cats.includes(k)) {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            opt.selected = true;
            selHtml.appendChild(opt);
        }

        const amtInput = document.createElement('input');
        amtInput.type = 'text';
        amtInput.value = formatCurrency(state.budgets[k], currency);
        amtInput.style.cssText = 'width:140px;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);text-align:right;';
        amtInput.className = 'budget-amt-input currency-input';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'remove-budget';
        btn.dataset.key = k;
        btn.textContent = '✕';
        btn.style.cssText = 'background:none;border:none;color:var(--danger);cursor:pointer;font-size:18px;padding:4px 8px;';

        div.appendChild(selHtml);
        div.appendChild(amtInput);
        div.appendChild(btn);
        list.appendChild(div);
        i++;
    });

    // Botón para añadir nueva fila
    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.textContent = '+ Agregar presupuesto';
    addRowBtn.style.cssText = 'margin-top:8px;padding:10px;width:100%;background:var(--bg-secondary);border:1px dashed var(--border);border-radius:8px;cursor:pointer;color:var(--text);font-size:14px;';
    addRowBtn.onclick = handleAddBudgetRow;
    list.appendChild(addRowBtn);

    initializeCurrencyMasks();
}

// ---------- Export ----------
function showExportModal() {
    showOverlay();
    const modal = $('export-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// ---------- Data Portability ----------
function showPortabilityModal() {
    showOverlay();
    const modal = $('portability-modal');
    if (!modal) return;

    const textarea = $('data-export-text');
    if (textarea) {
        textarea.value = JSON.stringify(state, null, 2);
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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
    document.body.style.overflow = 'hidden';
}

// ---------- Investment Modal ----------
function showInvestmentModal() {
    showOverlay();
    const modal = $('investment-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    
    // Si ya existe el formulario, no regenerar
    if ($('investment-form')) return;
    
    const container = $('investment-form-container');
    if (!container) return;

    const entities = getFinancialEntities();
    const accounts = getActiveAccounts();
    const currency = state.settings.currency || 'COP';

    container.innerHTML = `
        <form id="investment-form" onsubmit="handleInvestmentSubmit(event)">
            <h3 style="margin-bottom:20px;">Nueva inversión</h3>
            
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
                <small style="color:var(--text-secondary);">Ingresa la cantidad exacta de días según las condiciones de tu producto financiero.</small>
            </div>

            <div class="form-group">
                <label for="investment-source-account">Cuenta de origen (opcional)</label>
                <select id="investment-source-account" class="form-input">
                    <option value="">No asociar cuenta</option>
                    ${accounts.map(a => `<option value="${a.id}">${a.name} (${formatCurrency(a.balance, currency)})</option>`).join('')}
                </select>
            </div>

            <div style="display:flex;gap:12px;margin-top:20px;">
                <button type="button" onclick="hideAllModals()" class="btn-secondary" style="flex:1;">Cancelar</button>
                <button type="submit" class="btn-primary" style="flex:1;">Crear inversión</button>
            </div>
        </form>
    `;

    initializeCurrencyMasks();
}

// ---------- Expenses Report Modal ----------
function showExpensesReportModal() {
    showOverlay();
    const modal = $('expenses-report-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// ---------- Setup Screen (navegación) ----------
function showSetupScreen() {
    const screen = $('setup-screen');
    if (screen) {
        navigateTo('setup-screen');
    } else {
        showSetupModal();
    }
}

function showSetupModal() {
    showOverlay();
    const modal = $('setup-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Si tiene datos previos, mostrarlos
    if (state.user) {
        if ($('user-name')) $('user-name').value = state.user.name || '';
    }
}

// ---------- Init ----------
function initModals() {
    // Cerrar modales al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-overlay')) {
            // No cerrar privacy ni onboarding haciendo clic fuera
            const privacyModal = $('privacy-modal');
            const onboardingModal = $('onboarding-modal');
            
            if (privacyModal && !privacyModal.classList.contains('hidden')) return;
            if (onboardingModal && !onboardingModal.classList.contains('hidden')) return;
            
            hideAllModals();
        }
    });

    // Cerrar con Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const privacyModal = $('privacy-modal');
            const onboardingModal = $('onboarding-modal');
            
            if (privacyModal && !privacyModal.classList.contains('hidden')) return;
            if (onboardingModal && !onboardingModal.classList.contains('hidden')) return;
            
            hideAllModals();
        }
    });

    // Inicializar filtros de view-all si existen
    const accountFilter = $('tx-filter-account');
    if (accountFilter) {
        const accounts = getActiveAccounts();
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc.id;
            opt.textContent = acc.name;
            accountFilter.appendChild(opt);
        });
    }
}

// Inicializar al cargar
window.addEventListener('load', () => {
    initModals();
});
