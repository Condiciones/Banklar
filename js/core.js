// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const on = (sel, ev, fn) => {
    const el = $(sel);
    if (el) el.addEventListener(ev, fn);
};
const nowISO = () => new Date().toISOString();
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('id-' + Date.now() + '-' + Math.floor(Math.random() * 10000));

// ---------- Constants ----------
const STORAGE_KEY = 'banklar_finances_v11';
const DEFAULT_CATEGORIES = [
    'Alquiler', 'Cocina', 'Hogar', 'Cuotas', 'Facturas', '4thiago',
    'Transporte', 'Pet', 'Skincare', 'Salud', 'Entretenimiento',
    'Comida', 'Impuestos', 'Efectivo', 'Otros'
];

const ACCREDITATION_FREQUENCIES = [
    { id: 'daily', name: 'Diariamente', days: 1 },
    { id: 'weekly', name: 'Semanalmente', days: 7 },
    { id: 'monthly', name: 'Mensualmente', days: 30 },
    { id: 'quarterly', name: 'Trimestralmente', days: 90 },
    { id: 'semiannually', name: 'Semestralmente', days: 180 },
    { id: 'annually', name: 'Anualmente', days: 365 },
    { id: 'custom', name: 'Personalizado', days: null }
];

const INVESTMENT_TYPES = [
    { id: 'cajita_rendimiento', name: 'Cajita con rendimiento' },
    { id: 'bolsillo_rendimiento', name: 'Bolsillo con rendimiento' },
    { id: 'cuenta_ahorro_rendimiento', name: 'Cuenta de ahorro con rendimiento' },
    { id: 'cdt', name: 'CDT' },
    { id: 'cdat', name: 'CDAT' },
    { id: 'fiduenta', name: 'Fiduenta' },
    { id: 'fic', name: 'Fondo de inversión colectiva' },
    { id: 'fondo_liquidez', name: 'Fondo de liquidez' },
    { id: 'fondo_renta_fija', name: 'Fondo de renta fija' },
    { id: 'custom', name: 'Personalizado', isCustom: true }
];

const CURRENCIES = [
    { code: 'COP', name: 'Peso colombiano', locale: 'es-CO', symbol: '$' },
    { code: 'USD', name: 'Dólar estadounidense', locale: 'en-US', symbol: 'US$' },
    { code: 'EUR', name: 'Euro', locale: 'de-DE', symbol: '€' },
    { code: 'MXN', name: 'Peso mexicano', locale: 'es-MX', symbol: 'MX$' },
    { code: 'ARS', name: 'Peso argentino', locale: 'es-AR', symbol: 'AR$' },
    { code: 'PEN', name: 'Sol peruano', locale: 'es-PE', symbol: 'S/' },
    { code: 'CLP', name: 'Peso chileno', locale: 'es-CL', symbol: 'CL$' }
];

// ---------- Currency Formatting ----------
function formatCurrency(value, currency = 'COP') {
    const code = currency || (state.settings && state.settings.currency) || 'COP';
    const locale = (state.settings && state.settings.locale) || 'es-CO';
    const amount = Number(value || 0);
    
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (e) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

function formatCurrencyWithDecimals(value, currency = 'COP') {
    const code = currency || (state.settings && state.settings.currency) || 'COP';
    const locale = (state.settings && state.settings.locale) || 'es-CO';
    const amount = Number(value || 0);
    
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch (e) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

function parseCurrencyFormatted(formattedValue) {
    if (!formattedValue) return 0;
    const cleanValue = String(formattedValue)
        .replace(/[^\d,.\-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const parsed = parseFloat(cleanValue || 0);
    return isNaN(parsed) ? 0 : parsed;
}

// ---------- Currency Input (Nu Bank style) ----------
function createCurrencyMask(inputElement) {
    let rawCents = 0;
    let displayElement = null;
    
    // Buscar si hay un elemento de display asociado
    const displayId = inputElement.getAttribute('data-currency-display');
    if (displayId) {
        displayElement = $(displayId);
    }
    
    function updateDisplay() {
        const value = rawCents / 100;
        const formatted = formatCurrencyInputStyle(value);
        
        if (displayElement) {
            displayElement.textContent = formatted;
        }
        inputElement.setAttribute('data-raw-value', rawCents);
        inputElement.setAttribute('data-display-value', value);
    }
    
    inputElement.addEventListener('keydown', function(e) {
        // Solo permitir números
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            rawCents = rawCents * 10 + parseInt(e.key);
            updateDisplay();
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            rawCents = Math.floor(rawCents / 10);
            updateDisplay();
        } else if (e.key === 'Delete') {
            e.preventDefault();
            rawCents = 0;
            updateDisplay();
        } else if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') {
            // Permitir navegación
            return;
        } else {
            e.preventDefault();
        }
    });
    
    // Prevenir pegado de texto
    inputElement.addEventListener('paste', function(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const numbers = pasted.replace(/\D/g, '');
        if (numbers) {
            rawCents = parseInt(numbers);
            updateDisplay();
        }
    });
    
    // Permitir obtener y establecer el valor
    inputElement.getValue = function() {
        return rawCents / 100;
    };
    
    inputElement.setValue = function(value) {
        rawCents = Math.round(Number(value) * 100);
        updateDisplay();
    };
    
    inputElement.clearValue = function() {
        rawCents = 0;
        updateDisplay();
    };
    
    return inputElement;
}

function formatCurrencyInputStyle(value) {
    const locale = (state.settings && state.settings.locale) || 'es-CO';
    return new Intl.NumberFormat(locale, {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function initializeCurrencyMasks() {
    document.querySelectorAll('.currency-input').forEach(input => {
        if (!input._currencyMasked) {
            createCurrencyMask(input);
            input._currencyMasked = true;
        }
    });
}

// ---------- Toast ----------
function showToast(message, type = 'info', duration = 5000) {
    const container = $('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            ${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}
        </div>
        <div class="toast-message">${message}</div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        if (!toast.parentNode) return;
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) container.removeChild(toast);
        }, 300);
    }, duration);
}

// ---------- Debounce ----------
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
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
    
    const locale = (state.settings && state.settings.locale) || 'es-CO';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Formato según locale
    if (locale === 'en-US') {
        return `${month}/${day}/${year} ${hours}:${minutes}`;
    }
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const locale = (state.settings && state.settings.locale) || 'es-CO';
        if (locale === 'en-US') {
            return `${parts[1]}/${parts[2]}/${parts[0]}`;
        }
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// ---------- Modal Helpers ----------
function hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (m && m.style) m.style.display = 'none';
    });
    document.body.style.overflow = '';
}

function showModal(modalId) {
    hideAllModals();
    const modal = $(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// ---------- Date Helpers ----------
function getTodayDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
    return new Date().getMonth() + 1;
}

function getCurrentYear() {
    return new Date().getFullYear();
}

function getMonthName(monthNumber) {
    const locale = (state.settings && state.settings.locale) || 'es-CO';
    const lang = locale.split('-')[0] || 'es';
    const months = {
        es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
        en: ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December']
    };
    return (months[lang] || months.es)[monthNumber - 1] || '';
}

// ---------- Investment Types Helpers ----------
function getInvestmentTypeName(typeId) {
    const found = INVESTMENT_TYPES.find(t => t.id === typeId);
    return found ? found.name : (typeId || 'Desconocido');
}

function getAccreditationFrequencyName(frequencyId) {
    const found = ACCREDITATION_FREQUENCIES.find(f => f.id === frequencyId);
    return found ? found.name : (frequencyId || 'Desconocido');
}

function getAccreditationDays(frequencyId, customDays) {
    if (frequencyId === 'custom') {
        return customDays || 30;
    }
    const found = ACCREDITATION_FREQUENCIES.find(f => f.id === frequencyId);
    return found ? found.days : 30;
}

// ---------- Privacy Screen ----------
let privacyAccepted = false;

function hasAcceptedPrivacy() {
    return localStorage.getItem('banklar_privacy_accepted') === 'true';
}

function acceptPrivacy() {
    localStorage.setItem('banklar_privacy_accepted', 'true');
    privacyAccepted = true;
}

function resetPrivacy() {
    localStorage.removeItem('banklar_privacy_accepted');
    privacyAccepted = false;
}

// ---------- Onboarding ----------
function isOnboardingCompleted() {
    return state.user && state.user.onboardingCompleted === true;
}

function completeOnboarding(userData) {
    state.user = {
        name: userData.name,
        createdAt: userData.createdAt || nowISO(),
        onboardingCompleted: true
    };
    
    state.settings = {
        currency: userData.currency || 'COP',
        locale: userData.locale || 'es-CO',
        theme: userData.theme || 'system',
        lowThreshold: userData.lowThreshold || 20000
    };
    
    state.accounts = userData.accounts || [];
    state.financialEntities = userData.financialEntities || [];
    
    saveState(state);
    return true;
}

// ---------- Theme Helpers ----------
function getPreferredTheme() {
    const saved = (state.settings && state.settings.theme) || 'system';
    if (saved === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return saved;
}

// ---------- Account Type Helpers ----------
function getAccountTypeLabel(type) {
    const labels = {
        'principal': 'Principal',
        'secondary': 'Secundaria',
        'additional': 'Adicional'
    };
    return labels[type] || 'Adicional';
}

function getAccountTypeSubtitle(type, index) {
    switch (type) {
        case 'principal':
            return 'Cuenta nómina o cuenta donde recibes la mayor parte de tus ingresos.';
        case 'secondary':
            return 'Cuenta que utilizas frecuentemente para pagos, transferencias o ahorro.';
        case 'additional':
            return 'Otra cuenta, billetera digital o medio donde conserves dinero.';
        default:
            return '';
    }
}

// ---------- Generator Helpers ----------
function generateAccountForms(quantity) {
    const forms = [];
    
    for (let i = 0; i < quantity; i++) {
        let type, title, subtitle;
        
        if (i === 0) {
            type = 'principal';
            title = 'Cuenta principal';
            subtitle = 'Cuenta nómina o cuenta donde recibes la mayor parte de tus ingresos.';
        } else if (i === 1) {
            type = 'secondary';
            title = 'Cuenta secundaria';
            subtitle = 'Cuenta que utilizas frecuentemente para pagos, transferencias o ahorro.';
        } else {
            type = 'additional';
            title = 'Cuenta adicional';
            subtitle = 'Otra cuenta, billetera digital o medio donde conserves dinero.';
        }
        
        forms.push({
            index: i,
            type: type,
            title: title,
            subtitle: subtitle,
            required: i === 0,
            fields: {
                name: { value: '', placeholder: 'Ejemplo: Davivienda' },
                balance: { value: 0, placeholder: 'Ejemplo: 500.000' }
            }
        });
    }
    
    return forms;
}

// ---------- Navigation Helpers ----------
function navigateTo(screenId) {
    // Ocultar todas las pantallas
    document.querySelectorAll('.screen').forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
    });
    
    // Mostrar la pantalla deseada
    const screen = $(screenId);
    if (screen) {
        screen.classList.add('active');
        screen.style.display = 'block';
    }
    
    // Scroll al inicio
    window.scrollTo(0, 0);
}

// ---------- Percentage Helpers ----------
function calculatePercentage(value, total) {
    if (!total || total === 0) return 0;
    return (value / total) * 100;
}

function formatPercentage(value, decimals = 1) {
    return Number(value).toFixed(decimals) + '%';
}

// ---------- Validation Helpers ----------
function isValidNumber(value) {
    return !isNaN(Number(value)) && Number(value) > 0;
}

function isValidName(value) {
    return value && String(value).trim().length > 0;
}

// ---------- Event Delegation ----------
function delegateEvent(parentSelector, childSelector, eventType, callback) {
    document.addEventListener(eventType, function(e) {
        const parent = document.querySelector(parentSelector);
        if (!parent) return;
        
        let target = e.target;
        while (target && target !== document) {
            if (target.matches(childSelector)) {
                callback.call(target, e);
                return;
            }
            target = target.parentNode;
        }
    });
}

// ---------- Init ----------
function initCore() {
    // Migrar datos antiguos si es necesario
    migrateFromOldVersions();
    
    // Inicializar tema
    initTheme();
    
    // Inicializar máscaras de moneda existentes
    initializeCurrencyMasks();
    
    // Procesar inversiones al iniciar
    if (isOnboardingCompleted()) {
        processAllInvestmentsOnStartup();
    }
    
    console.log('Banklar core inicializado - v11');
}
