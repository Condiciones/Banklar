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

// ---------- Reset All Data ----------
function resetAllData() {
    if (!confirm('⚠️ ¿Estás completamente seguro?\n\nEsta acción borrará TODOS tus datos:\n• Transacciones\n• Presupuestos\n• Balances\n• Configuración\n\nNo se puede deshacer.')) {
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

// ---------- Migración de versiones anteriores ----------
function migrateFromOldVersions() {
    const oldStateV9 = localStorage.getItem('banklar_finances_v9');
    const oldStateV8 = localStorage.getItem('banklar_finances_v8');
    const oldStateV7 = localStorage.getItem('banklar_finances_v7');
    let migrated = false;

    // Migrar desde v9 a v10
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
        if (!imported.user || !imported.transactions) {
            showToast('Datos inválidos', 'error');
            return;
        }

        if (!confirm('⚠️ ¿Estás seguro de importar estos datos? Se perderán todos los datos actuales.')) {
            return;
        }

        state = imported;

        if (state.user.bancolombia !== undefined && state.user.davivienda === undefined) {
            state.user.davivienda = state.user.bancolombia;
            delete state.user.bancolombia;
        }
        
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
