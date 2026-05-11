// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const on = (sel, ev, fn) => {
    const el = $(sel);
    if (el) el.addEventListener(ev, fn);
};
const nowISO = () => new Date().toISOString();
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : ('id-' + Date.now() + '-' + Math.floor(Math.random() * 10000));

// ---------- Constants ----------
const STORAGE_KEY = 'banklar_finances_v10';
const DEFAULT_CATEGORIES = [
    'Alquiler', 'Cocina', 'Hogar', 'Cuotas', 'facturas', '4thiago',
    'Transporte', 'Pet', 'Skincare', 'Salud', 'Entretenimiento',
    'Comida', 'Impuestos', 'Efectivo', 'Otros'
];

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
        const formattedInt = integer === "" ? "0" : parseInt(integer).toLocaleString("es-CO");
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
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
