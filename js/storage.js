// ---------- Storage ----------
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

// ---------- Model / State ----------
let state = loadState() || {
    user: null,
    accounts: [],
    financialEntities: [],
    investments: [],
    rateHistory: [],
    returns: [],
    investmentMovements: [],
    transactions: [],
    budgets: {},
    settings: {
        currency: 'COP',
        locale: 'es-CO',
        theme: 'system',
        lowThreshold: 20000
    },
    meta: {
        lastUpdated: nowISO(),
        version: 'v11'
    }
};

// ---------- Reset All Data ----------
function resetAllData() {
    if (!confirm('⚠️ ¿Estás completamente seguro?\n\nEsta acción borrará TODOS tus datos:\n• Cuentas bancarias\n• Inversiones\n• Transacciones\n• Presupuestos\n• Configuración\n\nNo se puede deshacer.')) {
        return;
    }
    
    if (!confirm('🚨 ÚLTIMA ADVERTENCIA\n\n¿Realmente deseas eliminar todos tus datos financieros de forma permanente?')) {
        return;
    }
    
    try {
        localStorage.removeItem(STORAGE_KEY);
        showToast('Todos los datos han sido eliminados correctamente', 'success');
        setTimeout(() => {
            location.reload();
        }, 1500);
    } catch (e) {
        console.error('Error resetting data:', e);
        showToast('Error al resetear los datos', 'error');
    }
}

// ---------- Utilidades de cuenta ----------
function getActiveAccounts() {
    return (state.accounts || []).filter(a => a.isActive !== false);
}

function getAccountById(id) {
    return (state.accounts || []).find(a => a.id === id);
}

function getPrincipalAccount() {
    return (state.accounts || []).find(a => a.type === 'principal' && a.isActive !== false) || null;
}

function getActiveInvestments() {
    return (state.investments || []).filter(i => i.status === 'active');
}

function getInvestmentById(id) {
    return (state.investments || []).find(i => i.id === id);
}

function calculateTotalPatrimony() {
    const accountsBalance = getActiveAccounts().reduce((sum, a) => sum + (a.balance || 0), 0);
    const investmentsValue = getActiveInvestments().reduce((sum, i) => sum + (i.currentValue || 0), 0);
    return {
        bankBalance: accountsBalance,
        investmentsValue: investmentsValue,
        total: accountsBalance + investmentsValue
    };
}

function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// ---------- Migración de versiones anteriores ----------
function migrateFromOldVersions() {
    const oldStateV10 = localStorage.getItem(STORAGE_KEY);
    const oldStateV9 = localStorage.getItem('banklar_finances_v9');
    const oldStateV8 = localStorage.getItem('banklar_finances_v8');
    const oldStateV7 = localStorage.getItem('banklar_finances_v7');
    let migrated = false;

    // Migrar desde v10 a v11 (cuentas fijas → dinámicas)
    if (oldStateV10 && !state.accounts) {
        try {
            const parsed = JSON.parse(oldStateV10);
            
            // Solo migrar si tiene estructura v10 (user con campos fijos)
            if (parsed.user && (parsed.user.nu !== undefined || parsed.user.nequi !== undefined || parsed.user.davivienda !== undefined || parsed.user.cash !== undefined)) {
                
                state.user = {
                    name: parsed.user.name || '',
                    createdAt: parsed.user.createdAt || nowISO(),
                    onboardingCompleted: true // Ya tenía datos, asumimos onboarding completado
                };

                state.accounts = [];
                state.financialEntities = [];
                let order = 0;

                // Migrar Davivienda
                if (parsed.user.davivienda !== undefined) {
                    const entityId = generateId();
                    state.financialEntities.push({
                        id: entityId,
                        name: 'Davivienda',
                        createdAt: nowISO()
                    });
                    state.accounts.push({
                        id: generateId(),
                        name: 'Davivienda',
                        entityId: entityId,
                        entityName: 'Davivienda',
                        type: 'principal',
                        balance: parsed.user.davivienda || 0,
                        isActive: true,
                        displayOrder: order++,
                        createdAt: parsed.user.createdAt || nowISO(),
                        updatedAt: nowISO()
                    });
                }

                // Migrar Nu
                if (parsed.user.nu !== undefined) {
                    const entityId = generateId();
                    state.financialEntities.push({
                        id: entityId,
                        name: 'Nu',
                        createdAt: nowISO()
                    });
                    state.accounts.push({
                        id: generateId(),
                        name: 'Nu',
                        entityId: entityId,
                        entityName: 'Nu',
                        type: order === 0 ? 'principal' : 'secondary',
                        balance: parsed.user.nu || 0,
                        isActive: true,
                        displayOrder: order++,
                        createdAt: parsed.user.createdAt || nowISO(),
                        updatedAt: nowISO()
                    });
                }

                // Migrar Nequi
                if (parsed.user.nequi !== undefined) {
                    const entityId = generateId();
                    state.financialEntities.push({
                        id: entityId,
                        name: 'Nequi',
                        createdAt: nowISO()
                    });
                    state.accounts.push({
                        id: generateId(),
                        name: 'Nequi',
                        entityId: entityId,
                        entityName: 'Nequi',
                        type: order === 0 ? 'principal' : 'additional',
                        balance: parsed.user.nequi || 0,
                        isActive: true,
                        displayOrder: order++,
                        createdAt: parsed.user.createdAt || nowISO(),
                        updatedAt: nowISO()
                    });
                }

                // Migrar Efectivo
                if (parsed.user.cash !== undefined) {
                    const entityId = generateId();
                    state.financialEntities.push({
                        id: entityId,
                        name: 'Efectivo',
                        createdAt: nowISO()
                    });
                    state.accounts.push({
                        id: generateId(),
                        name: 'Efectivo',
                        entityId: entityId,
                        entityName: 'Efectivo',
                        type: 'additional',
                        balance: parsed.user.cash || 0,
                        isActive: true,
                        displayOrder: order++,
                        createdAt: parsed.user.createdAt || nowISO(),
                        updatedAt: nowISO()
                    });
                }

                // Si no hay cuenta principal, promover la primera
                if (!state.accounts.some(a => a.type === 'principal') && state.accounts.length > 0) {
                    state.accounts[0].type = 'principal';
                }

                // Migrar transacciones
                state.transactions = (parsed.transactions || []).map(tx => {
                    let accountName = tx.account;
                    if (accountName === 'bancolombia') accountName = 'davivienda';
                    
                    const matchingAccount = state.accounts.find(a => 
                        a.name.toLowerCase() === (accountName || '').toLowerCase()
                    );
                    
                    return {
                        ...tx,
                        accountId: matchingAccount ? matchingAccount.id : null,
                        relatedInvestmentId: tx.relatedInvestmentId || null
                    };
                });

                state.budgets = parsed.budgets || {};
                
                state.settings = {
                    currency: (parsed.settings && parsed.settings.currency) || 'COP',
                    locale: 'es-CO',
                    theme: 'system',
                    lowThreshold: (parsed.settings && parsed.settings.lowThreshold) || 20000
                };

                state.investments = [];
                state.rateHistory = [];
                state.returns = [];
                state.investmentMovements = [];

                state.meta = {
                    lastUpdated: nowISO(),
                    version: 'v11',
                    migratedFrom: 'v10',
                    _oldUserFields: {
                        nu: parsed.user.nu,
                        nequi: parsed.user.nequi,
                        davivienda: parsed.user.davivienda,
                        cash: parsed.user.cash
                    }
                };

                migrated = true;
            }
        } catch (e) {
            console.error('Error migrating v10 data:', e);
        }
    }

    // Migrar desde v9 a v10/v11
    if (oldStateV9 && !state.user) {
        try {
            const parsed = JSON.parse(oldStateV9);
            if (parsed.user) {
                state.user = {
                    name: parsed.user.name,
                    createdAt: parsed.user.createdAt || nowISO(),
                    onboardingCompleted: true
                };

                state.accounts = [];
                state.financialEntities = [];
                let order = 0;

                const accountsMap = [
                    { key: 'davivienda', fallbackKey: 'bancolombia', name: 'Davivienda', type: 'principal' },
                    { key: 'nu', name: 'Nu', type: 'secondary' },
                    { key: 'nequi', name: 'Nequi', type: 'additional' },
                    { key: 'cash', name: 'Efectivo', type: 'additional' }
                ];

                accountsMap.forEach(accDef => {
                    let value = parsed.user[accDef.key];
                    if (value === undefined && accDef.fallbackKey) {
                        value = parsed.user[accDef.fallbackKey];
                    }
                    if (value !== undefined) {
                        const entityId = generateId();
                        state.financialEntities.push({
                            id: entityId,
                            name: accDef.name,
                            createdAt: nowISO()
                        });
                        state.accounts.push({
                            id: generateId(),
                            name: accDef.name,
                            entityId: entityId,
                            entityName: accDef.name,
                            type: accDef.type,
                            balance: value || 0,
                            isActive: true,
                            displayOrder: order++,
                            createdAt: parsed.user.createdAt || nowISO(),
                            updatedAt: nowISO()
                        });
                    }
                });

                if (!state.accounts.some(a => a.type === 'principal') && state.accounts.length > 0) {
                    state.accounts[0].type = 'principal';
                }

                state.transactions = (parsed.transactions || []).map(tx => {
                    if (tx.account === 'bancolombia') tx.account = 'davivienda';
                    if (tx.from === 'bancolombia') tx.from = 'davivienda';
                    if (tx.to === 'bancolombia') tx.to = 'davivienda';
                    
                    const matchingAccount = state.accounts.find(a =>
                        a.name.toLowerCase() === (tx.account || '').toLowerCase()
                    );
                    
                    return {
                        ...tx,
                        accountId: matchingAccount ? matchingAccount.id : null,
                        relatedInvestmentId: tx.relatedInvestmentId || null
                    };
                });

                state.budgets = parsed.budgets || {};
                state.settings = {
                    currency: (parsed.settings && parsed.settings.currency) || 'COP',
                    locale: 'es-CO',
                    theme: 'system',
                    lowThreshold: (parsed.settings && parsed.settings.lowThreshold) || 20000
                };
                state.investments = [];
                state.rateHistory = [];
                state.returns = [];
                state.investmentMovements = [];

                state.meta = {
                    lastUpdated: nowISO(),
                    version: 'v11',
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
                    createdAt: parsed.user.createdAt || nowISO(),
                    onboardingCompleted: true
                };

                state.accounts = [];
                state.financialEntities = [];
                let order = 0;

                const accountsMap = [
                    { key: 'davivienda', fallbackKey: 'bancolombia', name: 'Davivienda', type: 'principal' },
                    { key: 'nu', name: 'Nu', type: 'secondary' },
                    { key: 'nequi', name: 'Nequi', type: 'additional' },
                    { key: 'cash', name: 'Efectivo', type: 'additional' }
                ];

                accountsMap.forEach(accDef => {
                    let value = parsed.user[accDef.key];
                    if (value === undefined && accDef.fallbackKey) {
                        value = parsed.user[accDef.fallbackKey];
                    }
                    if (value !== undefined) {
                        const entityId = generateId();
                        state.financialEntities.push({
                            id: entityId,
                            name: accDef.name,
                            createdAt: nowISO()
                        });
                        state.accounts.push({
                            id: generateId(),
                            name: accDef.name,
                            entityId: entityId,
                            entityName: accDef.name,
                            type: accDef.type,
                            balance: value || 0,
                            isActive: true,
                            displayOrder: order++,
                            createdAt: parsed.user.createdAt || nowISO(),
                            updatedAt: nowISO()
                        });
                    }
                });

                if (!state.accounts.some(a => a.type === 'principal') && state.accounts.length > 0) {
                    state.accounts[0].type = 'principal';
                }

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

                    const matchingAccount = state.accounts.find(a =>
                        a.name.toLowerCase() === (tx.account || '').toLowerCase()
                    );

                    return {
                        ...tx,
                        accountId: matchingAccount ? matchingAccount.id : null,
                        relatedInvestmentId: tx.relatedInvestmentId || null
                    };
                });

                state.budgets = parsed.budgets || {};
                state.settings = {
                    currency: (parsed.settings && parsed.settings.currency) || 'COP',
                    locale: 'es-CO',
                    theme: 'system',
                    lowThreshold: (parsed.settings && parsed.settings.lowThreshold) || 20000
                };
                state.investments = [];
                state.rateHistory = [];
                state.returns = [];
                state.investmentMovements = [];

                state.meta = {
                    lastUpdated: nowISO(),
                    version: 'v11',
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
                    createdAt: parsed.user.createdAt || nowISO(),
                    onboardingCompleted: true
                };

                state.accounts = [];
                state.financialEntities = [];
                let order = 0;

                const accountsMap = [
                    { key: 'davivienda', fallbackKey: 'bancolombia', name: 'Davivienda', type: 'principal' },
                    { key: 'nu', name: 'Nu', type: 'secondary' },
                    { key: 'nequi', name: 'Nequi', type: 'additional' },
                    { key: 'cash', name: 'Efectivo', type: 'additional' }
                ];

                accountsMap.forEach(accDef => {
                    let value = parsed.user[accDef.key];
                    if (value === undefined && accDef.fallbackKey) {
                        value = parsed.user[accDef.fallbackKey];
                    }
                    if (value !== undefined) {
                        const entityId = generateId();
                        state.financialEntities.push({
                            id: entityId,
                            name: accDef.name,
                            createdAt: nowISO()
                        });
                        state.accounts.push({
                            id: generateId(),
                            name: accDef.name,
                            entityId: entityId,
                            entityName: accDef.name,
                            type: accDef.type,
                            balance: value || 0,
                            isActive: true,
                            displayOrder: order++,
                            createdAt: parsed.user.createdAt || nowISO(),
                            updatedAt: nowISO()
                        });
                    }
                });

                if (!state.accounts.some(a => a.type === 'principal') && state.accounts.length > 0) {
                    state.accounts[0].type = 'principal';
                }

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

                    const matchingAccount = state.accounts.find(a =>
                        a.name.toLowerCase() === (tx.account || '').toLowerCase()
                    );

                    return {
                        ...tx,
                        accountId: matchingAccount ? matchingAccount.id : null,
                        relatedInvestmentId: tx.relatedInvestmentId || null
                    };
                });

                state.budgets = parsed.budgets || {};
                state.settings = {
                    currency: (parsed.settings && parsed.settings.currency) || 'COP',
                    locale: 'es-CO',
                    theme: 'system',
                    lowThreshold: (parsed.settings && parsed.settings.lowThreshold) || 20000
                };
                if (parsed.settings && parsed.settings.nuEA !== undefined) {
                    delete state.settings.nuEA;
                }
                state.investments = [];
                state.rateHistory = [];
                state.returns = [];
                state.investmentMovements = [];

                state.meta = {
                    lastUpdated: nowISO(),
                    version: 'v11',
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

    return migrated;
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
        
        // Validar estructura mínima
        if (!imported.user && !imported.accounts) {
            showToast('Datos inválidos: falta información de usuario o cuentas', 'error');
            return;
        }

        if (!confirm('⚠️ ¿Estás seguro de importar estos datos? Se perderán todos los datos actuales.')) {
            return;
        }

        // Asegurar estructura v11
        if (!imported.accounts && imported.user) {
            // Es una versión antigua, intentar migrar
            state = {
                user: {
                    name: imported.user.name || '',
                    createdAt: imported.user.createdAt || nowISO(),
                    onboardingCompleted: true
                },
                accounts: [],
                financialEntities: [],
                investments: imported.investments || [],
                rateHistory: imported.rateHistory || [],
                returns: imported.returns || [],
                investmentMovements: imported.investmentMovements || [],
                transactions: imported.transactions || [],
                budgets: imported.budgets || {},
                settings: {
                    currency: (imported.settings && imported.settings.currency) || 'COP',
                    locale: (imported.settings && imported.settings.locale) || 'es-CO',
                    theme: (imported.settings && imported.settings.theme) || 'system',
                    lowThreshold: (imported.settings && imported.settings.lowThreshold) || 20000
                },
                meta: {
                    lastUpdated: nowISO(),
                    version: 'v11',
                    migratedFrom: 'import'
                }
            };

            // Intentar extraer cuentas de user antiguo
            let order = 0;
            const oldAccounts = [
                { key: 'davivienda', fallback: 'bancolombia', name: 'Davivienda' },
                { key: 'nu', name: 'Nu' },
                { key: 'nequi', name: 'Nequi' },
                { key: 'cash', name: 'Efectivo' }
            ];

            oldAccounts.forEach(accDef => {
                let value = imported.user[accDef.key];
                if (value === undefined && accDef.fallback) {
                    value = imported.user[accDef.fallback];
                }
                if (value !== undefined) {
                    const entityId = generateId();
                    state.financialEntities.push({
                        id: entityId,
                        name: accDef.name,
                        createdAt: nowISO()
                    });
                    state.accounts.push({
                        id: generateId(),
                        name: accDef.name,
                        entityId: entityId,
                        entityName: accDef.name,
                        type: order === 0 ? 'principal' : 'additional',
                        balance: value || 0,
                        isActive: true,
                        displayOrder: order++,
                        createdAt: imported.user.createdAt || nowISO(),
                        updatedAt: nowISO()
                    });
                }
            });

            // Actualizar referencias en transacciones
            state.transactions = state.transactions.map(tx => {
                let accountName = tx.account;
                if (accountName === 'bancolombia') accountName = 'davivienda';
                const matchingAccount = state.accounts.find(a =>
                    a.name.toLowerCase() === (accountName || '').toLowerCase()
                );
                return {
                    ...tx,
                    accountId: matchingAccount ? matchingAccount.id : tx.accountId || null,
                    relatedInvestmentId: tx.relatedInvestmentId || null
                };
            });

            if (!tx.timestamp && tx.date) {
                const dateTime = tx.date.includes('T') ? tx.date : `${tx.date}T12:00`;
                const dateObj = new Date(dateTime);
                tx.timestamp = dateObj.getTime();
                tx.hour = dateObj.getHours();
                tx.minute = dateObj.getMinutes();
            }
        } else {
            // Ya es estructura v11 o similar
            state = {
                user: imported.user || { name: '', createdAt: nowISO(), onboardingCompleted: true },
                accounts: imported.accounts || [],
                financialEntities: imported.financialEntities || [],
                investments: imported.investments || [],
                rateHistory: imported.rateHistory || [],
                returns: imported.returns || [],
                investmentMovements: imported.investmentMovements || [],
                transactions: imported.transactions || [],
                budgets: imported.budgets || {},
                settings: {
                    currency: (imported.settings && imported.settings.currency) || 'COP',
                    locale: (imported.settings && imported.settings.locale) || 'es-CO',
                    theme: (imported.settings && imported.settings.theme) || 'system',
                    lowThreshold: (imported.settings && imported.settings.lowThreshold) || 20000
                },
                meta: {
                    lastUpdated: nowISO(),
                    version: 'v11'
                }
            };
        }

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

            // Usar accountId para obtener nombre de cuenta
            const txAccount = tx.accountId ? getAccountById(tx.accountId) : null;
            const txFrom = tx.fromAccountId ? getAccountById(tx.fromAccountId) : null;
            const txTo = tx.toAccountId ? getAccountById(tx.toAccountId) : null;

            if (tx.type === 'transfer') {
                account = txFrom ? txFrom.name : (tx.from || '');
                destination = txTo ? txTo.name : (tx.to || '');
            } else if (tx.type === 'cash-conversion') {
                if (tx.conversionType === 'to_cash') {
                    account = txFrom ? txFrom.name : (tx.from || '');
                    destination = 'Efectivo';
                } else {
                    account = 'Efectivo';
                    destination = txTo ? txTo.name : (tx.to || '');
                }
            } else if (tx.type === 'investment_contribution' || tx.type === 'investment_return') {
                account = txAccount ? txAccount.name : (tx.account || '');
                destination = 'Inversión';
            } else {
                account = txAccount ? txAccount.name : (tx.account || '');
            }

            const dateTime = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
            const [datePart, timePart] = dateTime.split(' ');

            return [
                datePart || '',
                timePart || formatTime(tx.hour || 0, tx.minute || 0),
                tx.type === 'income' ? 'Ingreso' :
                tx.type === 'transfer' ? 'Transferencia' :
                tx.type === 'cash-conversion' ? 'Conversión' :
                tx.type === 'investment_contribution' ? 'Aporte inversión' :
                tx.type === 'investment_return' ? 'Rendimiento inversión' : 'Gasto',
                tx.amount,
                account,
                destination,
                tx.type === 'income' ? (tx.source || 'Ingreso') :
                tx.type === 'transfer' ? 'Transferencia' :
                tx.type === 'cash-conversion' ? 'Conversión' :
                tx.type === 'investment_contribution' ? 'Inversión' :
                tx.type === 'investment_return' ? 'Inversión' : (tx.category || 'Gasto'),
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
