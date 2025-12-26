(function () {
  // ---------- Helpers ----------
  const $ = id => document.getElementById(id);
  const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
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
      const formattedInt = integer === "" 
          ? "0"
          : parseInt(integer).toLocaleString("es-CO");
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
      setTimeout(() => { if (toast.parentNode) container.removeChild(toast); }, 300);
    }, duration);
  }

  // ---------- Storage ----------
  const STORAGE_KEY = 'banklar_finances_v6'; // Nueva versión
  function saveState(s) {
    try { 
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); 
      return true; 
    }
    catch (e) { 
      showToast('Error al guardar datos', 'error'); 
      console.error(e); 
      return false; 
    }
  }
  
  function loadState() {
    try { 
      const raw = localStorage.getItem(STORAGE_KEY); 
      return raw ? JSON.parse(raw) : null; 
    }
    catch (e) { 
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
      
      // Validar estructura básica
      if (!imported.user || !imported.transactions) {
        showToast('Datos inválidos', 'error');
        return;
      }
      
      // Confirmar sobreescritura
      if (!confirm('⚠️ ¿Estás seguro de importar estos datos? Se perderán todos los datos actuales.')) {
        return;
      }
      
      // Actualizar estado
      state = imported;
      
      // Migrar transacciones antiguas si es necesario
      if (!state.transactions[0]?.timestamp) {
        state.transactions.forEach(tx => {
          if (tx.date && !tx.timestamp) {
            tx.timestamp = new Date(tx.date).getTime();
            tx.hour = new Date(tx.date).getHours();
            tx.minute = new Date(tx.date).getMinutes();
          }
        });
      }
      
      // Asegurar que exista nequi2 en el usuario
      if (!state.user.nequi2 && state.user.nequi2 !== 0) {
        state.user.nequi2 = 0;
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

  function showPortabilityModal() {
    showOverlay();
    const modal = $('portability-modal');
    if (!modal) return;
    
    // Generar datos actualizados
    const exportData = {
      ...state,
      meta: {
        ...state.meta,
        exportedAt: nowISO(),
        version: 'v6'
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
    settings: { lowThreshold: 20000, currency: 'COP' },
    meta: { 
      lastUpdated: nowISO(),
      version: 'v6'
    }
  };

  const DEFAULT_CATEGORIES = ['Transporte', 'Skincare', 'Salud', 'Entretenimiento', 'Comida', 'Efectivo', 'Otros'];

  // ---------- Cached elements ----------
  const el = {
    greeting: $('greeting'),
    balanceNu: $('balance-nu'),
    balanceNequi: $('balance-nequi'),
    balanceNequi2: $('balance-nequi2'),
    balanceCash: $('balance-cash'),
    balanceTotal: $('balance-total'),
    balanceStatus: $('balance-status'),
    nuInterestInfo: $('nu-interest-info'),
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
    novaklarTransactions: $('novaklar-transactions'),
    budgetsList: $('budgets-list'),
    btnSettings: $('btn-settings'),
    modalOverlay: $('modal-overlay'),
    setupModal: $('setup-modal'),
    viewAllModal: $('view-all-modal'),
    settingsModal: $('settings-modal'),
    budgetsModal: $('budgets-modal'),
    refreshBalances: $('refresh-balances'),
    btnExpensesReport: $('btn-expenses-report'),
    expensesReportModal: $('expenses-report-modal')
  };

  // ---------- Categories ----------
  function getCategories() {
    const fromTx = (state.transactions || []).filter(t => t.type === 'expense' && t.category).map(t => String(t.category).trim());
    const fromBudgets = Object.keys(state.budgets || {});
    const all = [...DEFAULT_CATEGORIES, ...fromTx, ...fromBudgets];
    const seen = new Set(); const res = [];
    all.forEach(c => { if (c && !seen.has(c)) { seen.add(c); res.push(c); } });
    return res;
  }

  function populateCategorySelects() {
    const cats = getCategories();
    const expSel = $('expense-category');
    if (expSel) {
      const prev = expSel.value;
      expSel.innerHTML = '';
      cats.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; expSel.appendChild(opt); });
      if (cats.includes(prev)) expSel.value = prev;
    }
    const budgetSel = $('new-budget-name');
    if (budgetSel) {
      const prev = budgetSel.value;
      budgetSel.innerHTML = '<option value="" disabled selected>Seleccionar categoría</option>';
      cats.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; budgetSel.appendChild(opt); });
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
        const c = t.category || 'Otros'; map[c] = (map[c] || 0) + Number(t.amount);
      }
    });
    return map;
  }

  function addTransaction(tx) {
    // Agregar timestamp y hora exacta
    const now = new Date();
    tx.timestamp = now.getTime();
    tx.hour = now.getHours();
    tx.minute = now.getMinutes();
    tx.date = now.toISOString().split('T')[0]; // Mantener compatibilidad
    
    // Si es ingreso de novaklar a Nequi 2
    if (tx.type === 'income' && tx.source === 'novaklar' && tx.account === 'nequi2') {
      tx.description = tx.description || `Ingreso Novaklar ${formatTime(now)}`;
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
      populateCategorySelects(); renderAll();
    }
  }

  // ---------- Balances ----------
  function computeBalances() {
    let nu = state.user ? Number(state.user.nu || 0) : 0;
    let nequi = state.user ? Number(state.user.nequi || 0) : 0;
    let nequi2 = state.user ? Number(state.user.nequi2 || 0) : 0;
    let cash = state.user ? Number(state.user.cash || 0) : 0;
    
    const txs = (state.transactions || []).slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    txs.forEach(tx => {
      if (tx.type === 'income') {
        if (tx.nuAllocated && tx.nuAllocated > 0) {
          nu += Number(tx.nuAllocated);
          const rest = Number(tx.amount) - Number(tx.nuAllocated);
          if (rest > 0) {
            if (tx.account === 'nequi') nequi += rest;
            else if (tx.account === 'nequi2') nequi2 += rest;
            else if (tx.account === 'cash') cash += rest;
          }
        } else { 
          if (tx.account === 'nu') nu += Number(tx.amount);
          else if (tx.account === 'nequi') nequi += Number(tx.amount);
          else if (tx.account === 'nequi2') nequi2 += Number(tx.amount);
          else if (tx.account === 'cash') cash += Number(tx.amount);
        }
      } else if (tx.type === 'expense') {
        if (tx.account === 'nu') nu -= Number(tx.amount);
        else if (tx.account === 'nequi') nequi -= Number(tx.amount);
        else if (tx.account === 'nequi2') nequi2 -= Number(tx.amount);
        else if (tx.account === 'cash') cash -= Number(tx.amount);
      } else if (tx.type === 'transfer') {
        // Todas las combinaciones de transferencias
        const amount = Number(tx.amount);
        
        if (tx.from === 'nu' && tx.to === 'nequi') {
          nu -= amount;
          nequi += amount;
        } else if (tx.from === 'nequi' && tx.to === 'nu') {
          nequi -= amount;
          nu += amount;
        } else if (tx.from === 'nu' && tx.to === 'nequi2') {
          nu -= amount;
          nequi2 += amount;
        } else if (tx.from === 'nequi2' && tx.to === 'nu') {
          nequi2 -= amount;
          nu += amount;
        } else if (tx.from === 'nequi' && tx.to === 'nequi2') {
          nequi -= amount;
          nequi2 += amount;
        } else if (tx.from === 'nequi2' && tx.to === 'nequi') {
          nequi2 -= amount;
          nequi += amount;
        } else if (tx.from === 'cash' && tx.to === 'nu') {
          cash -= amount;
          nu += amount;
        } else if (tx.from === 'cash' && tx.to === 'nequi') {
          cash -= amount;
          nequi += amount;
        } else if (tx.from === 'cash' && tx.to === 'nequi2') {
          cash -= amount;
          nequi2 += amount;
        } else if (tx.from === 'nu' && tx.to === 'cash') {
          nu -= amount;
          cash += amount;
        } else if (tx.from === 'nequi' && tx.to === 'cash') {
          nequi -= amount;
          cash += amount;
        } else if (tx.from === 'nequi2' && tx.to === 'cash') {
          nequi2 -= amount;
          cash += amount;
        }
      } else if (tx.type === 'cash-conversion') {
        // Conversiones de efectivo
        const amount = Number(tx.amount);
        
        if (tx.conversionType === 'to_cash') {
          // Digital → Efectivo
          if (tx.from === 'nu') {
            nu -= amount;
            cash += amount;
          } else if (tx.from === 'nequi') {
            nequi -= amount;
            cash += amount;
          } else if (tx.from === 'nequi2') {
            nequi2 -= amount;
            cash += amount;
          }
        } else if (tx.conversionType === 'from_cash') {
          // Efectivo → Digital
          if (tx.to === 'nu') {
            cash -= amount;
            nu += amount;
          } else if (tx.to === 'nequi') {
            cash -= amount;
            nequi += amount;
          } else if (tx.to === 'nequi2') {
            cash -= amount;
            nequi2 += amount;
          }
        }
      }
    });
    
    return { 
      nu: Math.max(0, nu), 
      nequi: Math.max(0, nequi), 
      nequi2: Math.max(0, nequi2),
      cash: Math.max(0, cash), 
      total: Math.max(0, nu + nequi + nequi2 + cash) 
    };
  }

  // ---------- Novaklar Functions ----------
  function getNovaklarTransactions() {
    return state.transactions.filter(tx => 
      (tx.type === 'income' && tx.source === 'novaklar') ||
      (tx.account === 'nequi2')
    ).length;
  }

  function formatTime(date) {
    return date.toLocaleTimeString('es-CO', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString('es-CO')} ${formatTime(date)}`;
  }

  // ---------- Rendering ----------
  function renderAll() {
    if (!state.user) { showSetup(); populateCategorySelects(); return; }
    hideAllModals();
    if (el.greeting) el.greeting.textContent = `Hola, ${state.user.name}`;
    const balances = computeBalances(), currency = state.settings.currency || 'COP';
    
    // Actualizar balances en UI
    if (el.balanceNu) el.balanceNu.textContent = formatCurrency(balances.nu, currency);
    if (el.balanceNequi) el.balanceNequi.textContent = formatCurrency(balances.nequi, currency);
    if (el.balanceNequi2) el.balanceNequi2.textContent = formatCurrency(balances.nequi2, currency);
    if (el.balanceCash) el.balanceCash.textContent = formatCurrency(balances.cash, currency);
    if (el.balanceTotal) el.balanceTotal.textContent = formatCurrency(balances.total, currency);
    
    // Mostrar información sin interés
    if (el.nuInterestInfo) {
      el.nuInterestInfo.textContent = `Sin interés`;
    }
    
    // Mostrar estado del saldo
    const low = Number(state.settings.lowThreshold || 0);
    if (el.balanceStatus) {
      el.balanceStatus.textContent = balances.total < low ? 'Saldo bajo' : 'Estable';
      el.balanceStatus.style.color = balances.total < low ? '#ef4444' : '#10b981';
    }

    // Transacciones Novaklar
    if (el.novaklarTransactions) {
      el.novaklarTransactions.textContent = getNovaklarTransactions();
    }

    // Últimas transacciones
    if (el.lastTxList) {
      el.lastTxList.innerHTML = '';
      const sorted = (state.transactions || []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const last5 = sorted.slice(0, 5);
      if (last5.length === 0) {
        const li = document.createElement('li'); li.className = 'tx-item'; li.innerHTML = '<div class="meta">No hay transacciones recientes</div>'; el.lastTxList.appendChild(li);
      } else {
        last5.forEach(tx => {
          const li = document.createElement('li'); 
          let cssClass = 'tx-item';
          
          if (tx.type === 'transfer') {
            cssClass += ' tx-transfer';
          } else if (tx.type === 'cash-conversion') {
            cssClass += ' tx-cash-conversion';
          } else if (tx.type === 'income' && tx.source === 'novaklar') {
            cssClass += ' tx-novaklar';
          }
          
          li.className = cssClass;
          
          let description = '';
          let icon = '';
          let amountDisplay = '';
          
          if (tx.type === 'transfer') {
            const fromName = tx.from === 'nu' ? 'Nu' : tx.from === 'nequi' ? 'Nequi 1' : tx.from === 'nequi2' ? 'Nequi 2' : 'Efectivo';
            const toName = tx.to === 'nu' ? 'Nu' : tx.to === 'nequi' ? 'Nequi 1' : tx.to === 'nequi2' ? 'Nequi 2' : 'Efectivo';
            description = `${fromName} → ${toName}`;
            icon = '🔄 ';
            amountDisplay = `↔ ${formatCurrency(tx.amount, currency)}`;
          } else if (tx.type === 'cash-conversion') {
            if (tx.conversionType === 'to_cash') {
              const fromName = tx.from === 'nu' ? 'Nu' : tx.from === 'nequi' ? 'Nequi 1' : 'Nequi 2';
              description = `${fromName} → Efectivo`;
              icon = '💵 ';
            } else {
              const toName = tx.to === 'nu' ? 'Nu' : tx.to === 'nequi' ? 'Nequi 1' : 'Nequi 2';
              description = `Efectivo → ${toName}`;
              icon = '🏦 ';
            }
            amountDisplay = `↔ ${formatCurrency(tx.amount, currency)}`;
          } else if (tx.type === 'income') {
            description = tx.source || 'Ingreso';
            icon = tx.source === 'novaklar' ? '💰 ' : '⬆️ ';
            amountDisplay = `+ ${formatCurrency(tx.amount, currency)}`;
          } else {
            description = tx.category || 'Gasto';
            icon = '⬇️ ';
            amountDisplay = `- ${formatCurrency(tx.amount, currency)}`;
          }
          
          // Determinar cuenta para mostrar
          let accountInfo = '';
          if (tx.type === 'income' || tx.type === 'expense') {
            accountInfo = tx.account === 'nu' ? 'Nu' : 
                         tx.account === 'nequi' ? 'Nequi 1' : 
                         tx.account === 'nequi2' ? 'Nequi 2' : 
                         'Efectivo';
          } else if (tx.type === 'transfer') {
            accountInfo = 'Transferencia';
          } else if (tx.type === 'cash-conversion') {
            accountInfo = 'Conversión';
          }
          
          // Mostrar hora exacta
          const timeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
          
          li.innerHTML = `
            <div>
              <div><strong>${icon}${amountDisplay}</strong> <span class="meta">| ${accountInfo} | ${timeDisplay}</span></div>
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

    // Estadísticas
    const totals = calcTotals();
    if (el.totalIncomes) el.totalIncomes.textContent = formatCurrency(totals.incomes, currency);
    if (el.totalExpenses) el.totalExpenses.textContent = formatCurrency(totals.expenses, currency);
    
    const rec = suggestSavings(totals); 
    if (el.suggestedSavings) el.suggestedSavings.textContent = rec.text;

    // Renderizar alertas, presupuestos, etc.
    renderAlerts(balances, totals);
    renderBudgets(balances, totals);
    renderExpensesPie();
    populateCategorySelects();

    state.meta.lastUpdated = nowISO(); 
    saveState(state);
  }

  function renderAlerts(balances, totals) {
    if (!el.alerts) return;
    el.alerts.innerHTML = '';
    
    // Alerta de saldo bajo en efectivo
    if (balances.cash < 10000 && balances.cash > 0) {
      const d = document.createElement('div'); 
      d.className = 'alert warning'; 
      d.textContent = `⚠️ Poco efectivo: ${formatCurrency(balances.cash, state.settings.currency)}. Considera hacer un retiro.`;
      el.alerts.appendChild(d);
    }
    
    // Alerta de saldo total bajo
    if (balances.total < Number(state.settings.lowThreshold || 0)) {
      const d = document.createElement('div'); d.className = 'alert danger'; d.textContent = `Alerta: tu saldo total es bajo (${formatCurrency(balances.total, state.settings.currency)}). Revisa tu presupuesto.`; el.alerts.appendChild(d);
    } else {
      const d = document.createElement('div'); d.className = 'alert good'; d.textContent = `Saldo OK. Total disponible ${formatCurrency(balances.total, state.settings.currency)}.`; el.alerts.appendChild(d);
    }
    
    // Alerta de gastos mayores que ingresos
    if (totals.expenses > totals.incomes) {
      const d = document.createElement('div'); d.className = 'alert danger'; d.textContent = `Estás gastando más de lo que ingresas (Gastos ${formatCurrency(totals.expenses, state.settings.currency)} > Ingresos ${formatCurrency(totals.incomes, state.settings.currency)}).`; el.alerts.appendChild(d);
    } else {
      const ratio = totals.incomes > 0 ? (totals.expenses / totals.incomes) : 0;
      if (ratio > 0.8) { 
        const d = document.createElement('div'); d.className = 'alert info'; d.textContent = `Atención: tus gastos están en ${Math.round(ratio * 100)}% de tus ingresos.`; el.alerts.appendChild(d); 
      }
    }

    // Alertas de presupuesto
    const spentByCat = calcExpensesByCategory();
    Object.keys(state.budgets).forEach(cat => {
      const spent = spentByCat[cat] || 0, budget = state.budgets[cat] || 0;
      if (budget > 0 && spent > budget) {
        const d = document.createElement('div'); d.className = 'alert danger'; d.textContent = `Has excedido el presupuesto en ${cat}: gastado ${formatCurrency(spent, state.settings.currency)} / presupuesto ${formatCurrency(budget, state.settings.currency)}.`; el.alerts.appendChild(d);
      }
    });
  }

  function renderBudgets() {
    if (!el.budgetsList) return;
    el.budgetsList.innerHTML = '';
    const spentByCat = calcExpensesByCategory();
    const keys = Object.keys(state.budgets);
    if (keys.length === 0) { el.budgetsList.innerHTML = '<div class="meta">No hay presupuestos. Crea uno desde "Editar / Crear presupuestos".</div>'; return; }
    keys.forEach(cat => {
      const budget = Number(state.budgets[cat] || 0), spent = Number(spentByCat[cat] || 0);
      const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
      const div = document.createElement('div');
      div.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${cat}</div><div class="meta">${formatCurrency(spent, state.settings.currency)} / ${formatCurrency(budget, state.settings.currency)}</div></div><div class="progress"><i style="width:${percent}%;"></i></div>`;
      el.budgetsList.appendChild(div);
    });
  }

  // ---------- Pie chart ----------
  function renderExpensesPie() {
    const canvas = $('expenses-pie');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(220, Math.floor(rect.width)); 
    canvas.height = 160; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const data = calcExpensesByCategory(); 
    const entries = Object.entries(data).filter(e => e[1] > 0);
    
    if (entries.length === 0) {
      ctx.fillStyle = 'rgba(15,9,55,0.04)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height); 
      ctx.fillStyle = '#6b7280'; 
      ctx.font = '12px Inter'; 
      ctx.textAlign = 'center'; 
      ctx.fillText('Sin gastos registrados', canvas.width / 2, 80); 
      return;
    }
    
    const total = entries.reduce((s, e) => s + e[1], 0); 
    let start = -Math.PI / 2;
    const colors = ['#7c3aed', '#a78bfa', '#c084fc', '#f472b6', '#d946ef', '#c026d3', '#8b5cf6', '#f59e0b', '#10b981'];
    
    entries.forEach((e, i) => {
      const slice = e[1] / total * (Math.PI * 2);
      ctx.beginPath(); 
      ctx.moveTo(canvas.width * 0.33, 80); 
      ctx.arc(canvas.width * 0.33, 80, 60, start, start + slice); 
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; 
      ctx.fill();
      start += slice;
    });
    
    ctx.font = '12px Inter'; 
    ctx.textAlign = 'left'; 
    let y = 12;
    entries.forEach((e, i) => {
      ctx.fillStyle = colors[i % colors.length]; 
      ctx.fillRect(canvas.width * 0.66, y, 10, 10); 
      ctx.fillStyle = '#374151';
      const percent = Math.round((e[1] / total) * 100); 
      ctx.fillText(`${e[0]} (${percent}%)`, canvas.width * 0.66 + 16, y + 10); 
      y += 18;
    });
  }

  // ---------- Reports ----------
  function showExpensesReport() {
    showOverlay();
    const modal = $('expenses-report-modal'); if (!modal) return; modal.classList.remove('hidden');
    const container = $('expenses-report-container'); if (!container) return; container.innerHTML = '';
    const entries = Object.entries(calcExpensesByCategory()).filter(e => e[1] > 0); if (entries.length === 0) { container.innerHTML = '<div class="meta">No hay gastos registrados.</div>'; return; }
    entries.sort((a, b) => b[1] - a[1]); const total = entries.reduce((s, e) => s + e[1], 0);
    entries.forEach(([cat, amt]) => {
      const percent = total > 0 ? (amt / total) * 100 : 0; const div = document.createElement('div'); div.className = 'tx-row';
      div.innerHTML = `<div style="font-size:14px;color:var(--text)">${cat}</div><div style="font-weight:700">${Math.round(percent)}% &nbsp;&nbsp; ${formatCurrency(amt, state.settings.currency)}</div>`;
      container.appendChild(div);
    });
    const footer = document.createElement('div'); footer.style.marginTop = '8px'; footer.className = 'meta'; footer.textContent = `Total gastado: ${formatCurrency(total, state.settings.currency)}`; container.appendChild(footer);
  }

  // ---------- Recommendations ----------
  function suggestSavings(totals) {
    if (totals.incomes <= 0) return { text: 'Registra tus ingresos para recomendaciones.' };
    const recentSalary = state.transactions.find(t => t.type === 'income' && (String(t.source) === 'Salario' || String(t.source).toLowerCase() === 'novaklar'));
    const ratio = totals.incomes > 0 ? (totals.expenses / totals.incomes) : 0;
    if (ratio > 0.9) return { text: 'Muy alto gasto. Reduce gastos inmediatos (≥10%).' };
    if (recentSalary) {
      let recommendedPercent = 20; if (ratio < 0.4) recommendedPercent = 30; else if (ratio < 0.6) recommendedPercent = 25;
      const savingsAmount = totals.incomes * (recommendedPercent / 100);
      return { text: `${recommendedPercent}% de tus ingresos (${formatCurrency(savingsAmount, state.settings.currency)}) como ahorro.` };
    }
    return { text: 'Considera ahorrar 15-20% de tus ingresos.' };
  }

  // ---------- Form Handling ----------
  function updateFormVisibility() {
    const type = el.txType.value;
    const isIncome = type === 'income';
    const isExpense = type === 'expense';
    const isTransfer = type === 'transfer';
    const isCashConversion = type === 'cash-conversion';
    
    // Mostrar/ocultar filas según el tipo de transacción
    if (el.incomeSourceRow) el.incomeSourceRow.style.display = isIncome ? 'block' : 'none';
    if (el.expenseCategoryRow) el.expenseCategoryRow.style.display = isExpense ? 'block' : 'none';
    if (el.transferFromRow) el.transferFromRow.style.display = isTransfer ? 'block' : 'none';
    if (el.cashConversionRow) el.cashConversionRow.style.display = isCashConversion ? 'block' : 'none';
    if (el.cashConversionDetailsRow) el.cashConversionDetailsRow.style.display = isCashConversion ? 'block' : 'none';
    
    // Mostrar fila de cuenta para ingresos y gastos
    if (el.txAccountRow) {
      el.txAccountRow.style.display = (isIncome || isExpense) ? 'block' : 'none';
    }
    
    // Mostrar opción de depósito en Nu solo para ingresos
    if (el.depositToNu && el.depositToNu.parentElement) {
      el.depositToNu.parentElement.style.display = isIncome ? 'block' : 'none';
    }
    
    // Mostrar split de Nu si está marcado
    if (el.nuSplitRow) {
      el.nuSplitRow.style.display = (isIncome && el.depositToNu && el.depositToNu.checked) ? 'block' : 'none';
    }
    
    // Actualizar opciones de cuenta según el tipo
    if (el.txAccount) {
      const currentValue = el.txAccount.value;
      el.txAccount.innerHTML = '';
      
      if (isIncome) {
        el.txAccount.innerHTML = `
          <option value="nequi">Nequi 1</option>
          <option value="nequi2">Nequi 2 (novaklar)</option>
          <option value="nu">Caja Nu</option>
          <option value="cash">Efectivo</option>
        `;
      } else if (isExpense) {
        el.txAccount.innerHTML = `
          <option value="nequi">Nequi 1</option>
          <option value="nequi2">Nequi 2 (novaklar)</option>
          <option value="nu">Caja Nu</option>
          <option value="cash">Efectivo</option>
        `;
      }
      
      // Mantener el valor anterior si existe
      if (currentValue && Array.from(el.txAccount.options).some(opt => opt.value === currentValue)) {
        el.txAccount.value = currentValue;
      }
    }
    
    // Actualizar opciones de conversión de efectivo
    if (el.cashConversionDetails) {
      const conversionType = el.cashConversionType ? el.cashConversionType.value : 'to_cash';
      el.cashConversionDetails.innerHTML = '';
      
      if (conversionType === 'to_cash') {
        // Digital → Efectivo
        el.cashConversionDetails.innerHTML = `
          <option value="nu_to_cash">Caja Nu → Efectivo</option>
          <option value="nequi_to_cash">Nequi 1 → Efectivo</option>
          <option value="nequi2_to_cash">Nequi 2 → Efectivo</option>
        `;
      } else {
        // Efectivo → Digital
        el.cashConversionDetails.innerHTML = `
          <option value="cash_to_nu">Efectivo → Caja Nu</option>
          <option value="cash_to_nequi">Efectivo → Nequi 1</option>
          <option value="cash_to_nequi2">Efectivo → Nequi 2</option>
        `;
      }
    }
  }

  // ---------- Modals ----------
  function showOverlay() { if (el.modalOverlay) el.modalOverlay.classList.remove('hidden'); }
  function hideOverlay() { if (el.modalOverlay) el.modalOverlay.classList.add('hidden'); }
  function hideAllModals() {
    [el.setupModal, el.viewAllModal, el.settingsModal, el.budgetsModal, $('export-modal'), $('expenses-report-modal'), $('portability-modal'), $('import-modal')].forEach(m => { if (m) m.classList.add('hidden'); });
    hideOverlay();
  }
  
  function showSetup() { 
    showOverlay(); 
    if (el.setupModal) el.setupModal.classList.remove('hidden'); 
    if ($('user-nu')) $('user-nu').value = state.user ? state.user.nu.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'; 
    if ($('user-nequi')) $('user-nequi').value = state.user ? state.user.nequi.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'; 
    if ($('user-nequi2')) $('user-nequi2').value = state.user ? (state.user.nequi2 || 0).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'; 
    if ($('user-cash')) $('user-cash').value = state.user ? state.user.cash.toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0,00'; 
  }
  
  function showViewAll() { 
    showOverlay(); 
    if (el.viewAllModal) el.viewAllModal.classList.remove('hidden'); 
    const container = $('all-tx-container'); if (!container) return; container.innerHTML = ''; 
    const typeFilter = $('tx-filter-type') ? $('tx-filter-type').value : 'all'; 
    const accountFilter = $('tx-filter-account') ? $('tx-filter-account').value : 'all'; 
    const searchFilter = $('tx-search') ? $('tx-search').value : ''; 
    const filtered = filterTransactions(typeFilter, accountFilter, searchFilter).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 
    if (filtered.length === 0) { container.innerHTML = '<div class="meta">No hay transacciones que coincidan con los filtros.</div>'; return; } 
    filtered.forEach(tx => { 
      const div = document.createElement('div'); 
      div.className = `tx-row ${tx.type === 'transfer' ? 'tx-transfer' : tx.type === 'cash-conversion' ? 'tx-cash-conversion' : tx.type === 'income' && tx.source === 'novaklar' ? 'tx-novaklar' : ''}`;
      
      let description = '';
      let icon = '';
      let amountDisplay = '';
      
      if (tx.type === 'transfer') {
        const fromName = tx.from === 'nu' ? 'Nu' : tx.from === 'nequi' ? 'Nequi 1' : tx.from === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        const toName = tx.to === 'nu' ? 'Nu' : tx.to === 'nequi' ? 'Nequi 1' : tx.to === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        description = `${fromName} → ${toName}`;
        icon = '🔄 ';
        amountDisplay = `↔ ${formatCurrency(tx.amount, state.settings.currency)}`;
      } else if (tx.type === 'cash-conversion') {
        if (tx.conversionType === 'to_cash') {
          const fromName = tx.from === 'nu' ? 'Nu' : tx.from === 'nequi' ? 'Nequi 1' : 'Nequi 2';
          description = `${fromName} → Efectivo`;
          icon = '💵 ';
        } else {
          const toName = tx.to === 'nu' ? 'Nu' : tx.to === 'nequi' ? 'Nequi 1' : 'Nequi 2';
          description = `Efectivo → ${toName}`;
          icon = '🏦 ';
        }
        amountDisplay = `↔ ${formatCurrency(tx.amount, state.settings.currency)}`;
      } else if (tx.type === 'income') {
        description = tx.source || 'Ingreso';
        icon = tx.source === 'novaklar' ? '💰 ' : '⬆️ ';
        amountDisplay = `+ ${formatCurrency(tx.amount, state.settings.currency)}`;
      } else {
        description = tx.category || 'Gasto';
        icon = '⬇️ ';
        amountDisplay = `- ${formatCurrency(tx.amount, state.settings.currency)}`;
      }
      
      let accountInfo = '';
      if (tx.type === 'income' || tx.type === 'expense') {
        accountInfo = tx.account === 'nu' ? 'Nu' : 
                     tx.account === 'nequi' ? 'Nequi 1' : 
                     tx.account === 'nequi2' ? 'Nequi 2' : 
                     'Efectivo';
      } else if (tx.type === 'transfer') {
        accountInfo = 'Transferencia';
      } else if (tx.type === 'cash-conversion') {
        accountInfo = 'Conversión';
      }
      
      // Mostrar hora exacta
      const timeDisplay = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
      
      div.innerHTML = `
        <div>
          <div><strong>${icon}${amountDisplay}</strong> <span class="meta">| ${accountInfo} | ${timeDisplay}</span></div>
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
    showOverlay(); if (!el.budgetsModal) return; el.budgetsModal.classList.remove('hidden');
    const list = $('budgets-form-list'); if (!list) return; list.innerHTML = ''; const keys = Object.keys(state.budgets); const cats = getCategories();
    if (keys.length === 0) { const p = document.createElement('div'); p.className = 'meta'; p.textContent = 'Aún no hay presupuestos. Agrega uno abajo.'; list.appendChild(p); }
    let i = 0;
    keys.forEach(k => {
      const div = document.createElement('div'); div.className = 'row'; div.style.display = 'flex'; div.style.gap = '8px'; div.style.alignItems = 'center';
      const selHtml = document.createElement('select'); selHtml.style.flex = '1'; selHtml.style.padding = '8px'; selHtml.style.borderRadius = '8px'; selHtml.style.border = '1px solid rgba(0,0,0,0.06)'; selHtml.dataset.idx = i; selHtml.className = 'budget-cat-select';
      const used = new Set();
      cats.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; if (c === k) opt.selected = true; selHtml.appendChild(opt); used.add(c); });
      if (!used.has(k)) { const opt = document.createElement('option'); opt.value = k; opt.textContent = k; opt.selected = true; selHtml.appendChild(opt); }
      const amtInput = document.createElement('input'); amtInput.type = 'text'; amtInput.value = state.budgets[k].toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2}); amtInput.style.width = '120px'; amtInput.style.padding = '8px'; amtInput.style.borderRadius = '8px'; amtInput.style.border = '1px solid rgba(0,0,0,0.06)'; amtInput.className = 'budget-amt-input currency-input';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn-ghost remove-budget'; btn.dataset.key = k; btn.textContent = 'Eliminar';
      div.appendChild(selHtml); div.appendChild(amtInput); div.appendChild(btn); list.appendChild(div); i++;
    });
    initializeCurrencyMasks();
  }
  
  function showExportModal() { showOverlay(); const m = $('export-modal'); if (m) m.classList.remove('hidden'); }

  // ---------- Filter transactions ----------
  function filterTransactions(typeFilter, accountFilter, searchFilter) {
    return (state.transactions || []).filter(tx => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      
      if (accountFilter !== 'all') {
        if (tx.type === 'transfer') {
          // Para transferencias, verificar si involucra la cuenta seleccionada
          if (accountFilter === 'nu' && !(tx.from === 'nu' || tx.to === 'nu')) return false;
          if (accountFilter === 'nequi' && !(tx.from === 'nequi' || tx.to === 'nequi')) return false;
          if (accountFilter === 'nequi2' && !(tx.from === 'nequi2' || tx.to === 'nequi2')) return false;
          if (accountFilter === 'cash' && !(tx.from === 'cash' || tx.to === 'cash')) return false;
        } else if (tx.type === 'cash-conversion') {
          // Para conversiones, verificar según el tipo
          if (accountFilter === 'nu' && !((tx.conversionType === 'to_cash' && tx.from === 'nu') || (tx.conversionType === 'from_cash' && tx.to === 'nu'))) return false;
          if (accountFilter === 'nequi' && !((tx.conversionType === 'to_cash' && tx.from === 'nequi') || (tx.conversionType === 'from_cash' && tx.to === 'nequi'))) return false;
          if (accountFilter === 'nequi2' && !((tx.conversionType === 'to_cash' && tx.from === 'nequi2') || (tx.conversionType === 'from_cash' && tx.to === 'nequi2'))) return false;
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

  // ---------- Event Listeners ----------
  function initializeEventListeners() {
    // Cambios en el tipo de transacción
    if (el.txType) {
      el.txType.addEventListener('change', updateFormVisibility);
    }
    
    // Cambios en el tipo de conversión de efectivo
    if (el.cashConversionType) {
      el.cashConversionType.addEventListener('change', updateFormVisibility);
    }
    
    // Checkbox de depósito en Nu
    if (el.depositToNu) {
      el.depositToNu.addEventListener('change', updateFormVisibility);
    }
    
    // Formulario principal de transacción
    if (el.txForm) {
      el.txForm.addEventListener('submit', handleTransactionSubmit);
    }
    
    // Event delegation para acciones en transacciones
    document.addEventListener('click', handleTransactionActions);
    
    // Botones de vista
    if (el.btnViewAll) el.btnViewAll.addEventListener('click', showViewAll);
    if (el.btnViewAll2) el.btnViewAll2.addEventListener('click', showViewAll);
    
    // Filtros en vista completa
    if ($('tx-filter-type')) { 
      $('tx-filter-type').addEventListener('change', showViewAll); 
      $('tx-filter-account').addEventListener('change', showViewAll); 
      $('tx-search').addEventListener('input', debounce(showViewAll, 300)); 
    }
    
    // Cerrar modales
    on('close-all-tx', 'click', hideAllModals);
    if (el.modalOverlay) el.modalOverlay.addEventListener('click', hideAllModals);
    
    // Ajustes
    if (el.btnSettings) el.btnSettings.addEventListener('click', showSettings);
    
    // Formulario de ajustes
    on('settings-form', 'submit', handleSettingsSubmit);
    
    // Presupuestos
    on('btn-edit-budgets', 'click', showBudgets); 
    on('btn-close-budgets', 'click', hideAllModals);
    
    // Portabilidad de datos
    on('btn-data-portability', 'click', showPortabilityModal);
    on('btn-copy-data', 'click', copyDataToClipboard);
    on('btn-close-portability', 'click', hideAllModals);
    
    // Importar datos
    on('btn-import-data', 'click', showImportModal);
    on('btn-import-confirm', 'click', importDataFromClipboard);
    on('btn-close-import', 'click', hideAllModals);
    
    // Exportar
    on('btn-export', 'click', showExportModal); 
    on('btn-close-export', 'click', hideAllModals);
    on('btn-export-csv', 'click', () => exportData('csv')); 
    on('btn-export-json', 'click', () => exportData('json'));
    
    // Agregar presupuesto
    on('btn-add-budget', 'click', handleAddBudget);
    
    // Eliminar presupuesto
    const budgetsListEl = $('budgets-form-list');
    if (budgetsListEl) budgetsListEl.addEventListener('click', handleBudgetRemoval);
    
    // Guardar presupuestos
    if ($('budgets-form')) $('budgets-form').addEventListener('submit', handleBudgetsSubmit);
    
    // Setup inicial
    if ($('setup-form')) $('setup-form').addEventListener('submit', handleSetupSubmit);
    
    // Refrescar balances
    if (el.refreshBalances) el.refreshBalances.addEventListener('click', () => { 
      renderAll(); 
      showToast('Balances actualizados', 'success'); 
    });
    
    // Reporte de gastos
    if (el.btnExpensesReport) el.btnExpensesReport.addEventListener('click', showExpensesReport);
    
    // Cerrar reporte de gastos
    const closeExpBtn = $('close-expenses-report'); 
    if (closeExpBtn) closeExpBtn.addEventListener('click', hideAllModals);
  }
  
  // ---------- Handlers de Eventos ----------
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
    
    // Resetear formulario y actualizar UI
    el.txForm.reset(); 
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
    
    // Si es novaklar, forzar a Nequi 2
    const finalAccount = source === 'novaklar' ? 'nequi2' : account;
    
    const tx = { 
      id: uid(), 
      type: 'income', 
      amount: Number(amount.toFixed(2)), 
      source, 
      account: finalAccount,
      nuAllocated: nuAllocated > 0 ? Number(nuAllocated.toFixed(2)) : 0,
      description: source === 'novaklar' ? `Ingreso Novaklar ${formatTime(new Date())}` : undefined
    };
    addTransaction(tx);
  }
  
  function handleExpenseTransaction(amount) {
    const category = el.expenseCategory ? el.expenseCategory.value : 'Otros';
    const account = el.txAccount.value;
    
    // Verificar saldo suficiente
    const balances = computeBalances();
    const accountBalance = account === 'nu' ? balances.nu : 
                          account === 'nequi' ? balances.nequi : 
                          account === 'nequi2' ? balances.nequi2 : 
                          balances.cash;
    
    if (amount > accountBalance) {
      const accountName = account === 'nu' ? 'Caja Nu' : 
                         account === 'nequi' ? 'Nequi 1' : 
                         account === 'nequi2' ? 'Nequi 2' : 
                         'Efectivo';
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
    
    // Determinar cuentas según la opción seleccionada
    switch (transferOption) {
      case 'nu':
        fromAccount = 'nu';
        toAccount = 'nequi';
        description = 'Caja Nu → Nequi 1';
        break;
      case 'nequi':
        fromAccount = 'nequi';
        toAccount = 'nu';
        description = 'Nequi 1 → Caja Nu';
        break;
      case 'nequi_to_nequi2':
        fromAccount = 'nequi';
        toAccount = 'nequi2';
        description = 'Nequi 1 → Nequi 2';
        break;
      case 'nequi2_to_nequi':
        fromAccount = 'nequi2';
        toAccount = 'nequi';
        description = 'Nequi 2 → Nequi 1';
        break;
      case 'nu_to_nequi2':
        fromAccount = 'nu';
        toAccount = 'nequi2';
        description = 'Caja Nu → Nequi 2';
        break;
      case 'nequi2_to_nu':
        fromAccount = 'nequi2';
        toAccount = 'nu';
        description = 'Nequi 2 → Caja Nu';
        break;
      case 'cash_to_nu':
        fromAccount = 'cash';
        toAccount = 'nu';
        description = 'Efectivo → Caja Nu';
        break;
      case 'cash_to_nequi':
        fromAccount = 'cash';
        toAccount = 'nequi';
        description = 'Efectivo → Nequi 1';
        break;
      case 'cash_to_nequi2':
        fromAccount = 'cash';
        toAccount = 'nequi2';
        description = 'Efectivo → Nequi 2';
        break;
      case 'nu_to_cash':
        fromAccount = 'nu';
        toAccount = 'cash';
        description = 'Caja Nu → Efectivo';
        break;
      case 'nequi_to_cash':
        fromAccount = 'nequi';
        toAccount = 'cash';
        description = 'Nequi 1 → Efectivo';
        break;
      case 'nequi2_to_cash':
        fromAccount = 'nequi2';
        toAccount = 'cash';
        description = 'Nequi 2 → Efectivo';
        break;
      default:
        showToast('Opción de transferencia no válida', 'error');
        return;
    }
    
    // Verificar saldo suficiente en cuenta de origen
    const balances = computeBalances();
    const sourceBalance = fromAccount === 'nu' ? balances.nu : 
                         fromAccount === 'nequi' ? balances.nequi : 
                         fromAccount === 'nequi2' ? balances.nequi2 : 
                         balances.cash;
    
    if (amount > sourceBalance) {
      const accountName = fromAccount === 'nu' ? 'Caja Nu' : 
                         fromAccount === 'nequi' ? 'Nequi 1' : 
                         fromAccount === 'nequi2' ? 'Nequi 2' : 
                         'Efectivo';
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
    
    // Determinar cuentas según los detalles
    if (conversionType === 'to_cash') {
      // Digital → Efectivo
      if (conversionDetails === 'nu_to_cash') {
        fromAccount = 'nu';
        toAccount = 'cash';
        conversionDescription = 'Caja Nu → Efectivo';
      } else if (conversionDetails === 'nequi_to_cash') {
        fromAccount = 'nequi';
        toAccount = 'cash';
        conversionDescription = 'Nequi 1 → Efectivo';
      } else {
        fromAccount = 'nequi2';
        toAccount = 'cash';
        conversionDescription = 'Nequi 2 → Efectivo';
      }
    } else {
      // Efectivo → Digital
      if (conversionDetails === 'cash_to_nu') {
        fromAccount = 'cash';
        toAccount = 'nu';
        conversionDescription = 'Efectivo → Caja Nu';
      } else if (conversionDetails === 'cash_to_nequi') {
        fromAccount = 'cash';
        toAccount = 'nequi';
        conversionDescription = 'Efectivo → Nequi 1';
      } else {
        fromAccount = 'cash';
        toAccount = 'nequi2';
        conversionDescription = 'Efectivo → Nequi 2';
      }
    }
    
    // Verificar saldo suficiente
    const balances = computeBalances();
    const sourceBalance = fromAccount === 'nu' ? balances.nu : 
                         fromAccount === 'nequi' ? balances.nequi : 
                         fromAccount === 'nequi2' ? balances.nequi2 : 
                         balances.cash;
    
    if (amount > sourceBalance) {
      const accountName = fromAccount === 'nu' ? 'Caja Nu' : 
                         fromAccount === 'nequi' ? 'Nequi 1' : 
                         fromAccount === 'nequi2' ? 'Nequi 2' : 
                         'Efectivo';
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
    const action = e.target.dataset.action, id = e.target.dataset.id;
    if (!action) return;
    
    if (action === 'del' || action === 'revert') {
      if (confirm('¿Eliminar transacción? Esto revertirá su efecto.')) {
        removeTransactionById(id); 
        if (action === 'revert') showViewAll();
      }
    } else if (action === 'view') {
      const tx = state.transactions.find(t => t.id === id); 
      if (!tx) return;
      
      let message = `Transacción:\nID: ${tx.id}\nTipo: ${tx.type}\nMonto: ${formatCurrency(tx.amount, state.settings.currency)}\nFecha: ${formatDateTime(tx.timestamp)}`;
      
      if (tx.type === 'transfer') {
        const fromName = tx.from === 'nu' ? 'Caja Nu' : tx.from === 'nequi' ? 'Nequi 1' : tx.from === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        const toName = tx.to === 'nu' ? 'Caja Nu' : tx.to === 'nequi' ? 'Nequi 1' : tx.to === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        message += `\nDe: ${fromName}\nA: ${toName}`;
      } else if (tx.type === 'cash-conversion') {
        message += `\nTipo: ${tx.conversionType === 'to_cash' ? 'Digital → Efectivo' : 'Efectivo → Digital'}`;
        const fromName = tx.from === 'nu' ? 'Caja Nu' : tx.from === 'nequi' ? 'Nequi 1' : tx.from === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        const toName = tx.to === 'nu' ? 'Caja Nu' : tx.to === 'nequi' ? 'Nequi 1' : tx.to === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        message += `\nDe: ${fromName}\nA: ${toName}`;
      } else {
        const accountName = tx.account === 'nu' ? 'Caja Nu' : 
                           tx.account === 'nequi' ? 'Nequi 1' : 
                           tx.account === 'nequi2' ? 'Nequi 2' : 
                           'Efectivo';
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
    
    if (!name) { showToast('Selecciona una categoría válida', 'error'); return; }
    if (amt <= 0) { showToast('Ingresa monto mayor a 0', 'error'); return; }
    
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
    const list = $('budgets-form-list'); if (!list) return;
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
    const nequi2 = parseCurrencyFormatted($('user-nequi2').value || '0'); 
    const cash = parseCurrencyFormatted($('user-cash').value || '0');
    
    state.user = { name, nu, nequi, nequi2, cash, createdAt: nowISO() }; 
    
    if (saveState(state)) showToast('Configuración inicial guardada', 'success'); 
    hideAllModals(); 
    populateCategorySelects(); 
    renderAll();
  }

  // ---------- Export Data ----------
  function exportData(format = 'json') {
    const s = state;
    if (!s) { showToast('No hay datos para exportar', 'error'); return; }
    let data, mimeType, filename;
    if (format === 'json') {
      data = JSON.stringify(s, null, 2); mimeType = 'application/json';
      filename = `banklar-backup-${new Date().toISOString().split('T')[0]}.json`;
    } else {
      // csv
      const headers = ['Fecha', 'Hora', 'Tipo', 'Monto', 'Cuenta/Origen', 'Destino', 'Categoría/Origen', 'Descripción'];
      const rows = (s.transactions || []).map(tx => {
        let account = '';
        let destination = '';
        
        if (tx.type === 'transfer') {
          account = tx.from === 'nu' ? 'Caja Nu' : tx.from === 'nequi' ? 'Nequi 1' : tx.from === 'nequi2' ? 'Nequi 2' : 'Efectivo';
          destination = tx.to === 'nu' ? 'Caja Nu' : tx.to === 'nequi' ? 'Nequi 1' : tx.to === 'nequi2' ? 'Nequi 2' : 'Efectivo';
        } else if (tx.type === 'cash-conversion') {
          if (tx.conversionType === 'to_cash') {
            account = tx.from === 'nu' ? 'Caja Nu' : tx.from === 'nequi' ? 'Nequi 1' : 'Nequi 2';
            destination = 'Efectivo';
          } else {
            account = 'Efectivo';
            destination = tx.to === 'nu' ? 'Caja Nu' : tx.to === 'nequi' ? 'Nequi 1' : 'Nequi 2';
          }
        } else {
          account = tx.account === 'nu' ? 'Caja Nu' : 
                   tx.account === 'nequi' ? 'Nequi 1' : 
                   tx.account === 'nequi2' ? 'Nequi 2' : 
                   'Efectivo';
        }
        
        const dateTime = tx.timestamp ? formatDateTime(tx.timestamp) : tx.date;
        
        return [
          dateTime.split(' ')[0],
          tx.timestamp ? formatTime(new Date(tx.timestamp)) : '',
          tx.type === 'income' ? 'Ingreso' : tx.type === 'transfer' ? 'Transferencia' : tx.type === 'cash-conversion' ? 'Conversión' : 'Gasto',
          tx.amount,
          account,
          destination,
          tx.type === 'income' ? (tx.source || 'Ingreso') : tx.type === 'transfer' ? 'Transferencia' : tx.type === 'cash-conversion' ? 'Conversión' : (tx.category || 'Gasto'),
          tx.description || ''
        ];
      });
      data = [headers, ...rows].map(row => row.map(f => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
      mimeType = 'text/csv';
      filename = `banklar-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    }
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    showToast(`Datos exportados como ${format.toUpperCase()}`, 'success');
  }

  // ---------- Utilities ----------
  function debounce(func, wait) { 
    let timeout; 
    return function (...args) { 
      clearTimeout(timeout); 
      timeout = setTimeout(() => func(...args), wait); 
    }; 
  }

  // ---------- Initialize ----------
  window.addEventListener('load', () => { 
    // Migrar datos antiguos si es necesario
    const oldState = localStorage.getItem('banklar_finances_v5');
    if (oldState && !state.user) {
      try {
        const parsed = JSON.parse(oldState);
        if (parsed.user) {
          // Migrar a nueva estructura
          state.user = {
            ...parsed.user,
            nequi2: 0 // Agregar Nequi 2
          };
          state.transactions = parsed.transactions || [];
          state.budgets = parsed.budgets || {};
          state.settings = { ...parsed.settings };
          delete state.settings.nuEA; // Eliminar interés
          state.meta = { 
            ...parsed.meta,
            version: 'v6',
            migratedFrom: 'v5'
          };
          
          // Agregar timestamps a transacciones antiguas
          state.transactions.forEach(tx => {
            if (!tx.timestamp && tx.date) {
              tx.timestamp = new Date(tx.date).getTime();
            }
          });
          
          saveState(state);
          showToast('Datos migrados de versión anterior', 'info');
        }
      } catch (e) {
        console.error('Error migrating data:', e);
      }
    }
    
    // Configurar UI
    populateCategorySelects(); 
    initializeCurrencyMasks();
    updateFormVisibility();
    initializeEventListeners();
    
    // Renderizar UI
    renderAll(); 
    
    // Verificar cuando la página gana foco
    window.addEventListener('focus', () => {
      setTimeout(() => {
        renderAll();
      }, 500);
    });
  });

  // ---------- Public API for debugging ----------
  window._banklar_state = state;
  window._banklar_exportData = exportData;
  window._banklar_computeBalances = computeBalances;
  window._banklar_copyData = copyDataToClipboard;
  window._banklar_importData = importDataFromClipboard;
})();
