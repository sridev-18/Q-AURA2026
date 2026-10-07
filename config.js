// ═══════════════════════════════════════════════════════════════════
// Q-AURA 2026 — Configuration File
// School of Quantum Sciences, Computing & AI, Rathinam Global University
// ═══════════════════════════════════════════════════════════════════

const QAURA_CONFIG = {
  API_BASE_URL: (() => {
    if (typeof window === 'undefined' || !window.location) return 'http://localhost:5000';
    const host = window.location.hostname;
    const port = window.location.port;
    if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '5000') {
      return 'http://localhost:5000';
    }
    if (window.location.protocol && window.location.protocol.startsWith('http')) {
      return window.location.origin;
    }
    return 'http://localhost:5000';
  })(),

  // Google Apps Script Backup URL
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyEGSAQK6nMohIoB9PXH4n7jF7SKU8-6XfgufRw1-KAY95I9rmIJE2d-pwl6MzX4K6W/exec"
};
