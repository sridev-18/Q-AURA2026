// ═══════════════════════════════════════════════════════════════════
// Q-AURA 2026 — Configuration File
// School of Quantum Sciences, Computing & AI, Rathinam Global University
// ═══════════════════════════════════════════════════════════════════

const QAURA_CONFIG = {
  // Always use the active host origin if served over HTTP/HTTPS, otherwise fallback to localhost
  API_BASE_URL: (typeof window !== 'undefined' && window.location && window.location.protocol && window.location.protocol.startsWith('http'))
    ? window.location.origin
    : 'http://localhost:5000',

  // Google Apps Script Backup URL
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyEGSAQK6nMohIoB9PXH4n7jF7SKU8-6XfgufRw1-KAY95I9rmIJE2d-pwl6MzX4K6W/exec"
};
