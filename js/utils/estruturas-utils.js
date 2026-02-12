// =========================
// FILE: js/utils/estruturas-utils.js
// =========================
export function normKey(v) {
    return String(v ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // 2–4 letras + 4 dígitos (TSZ8821 / RTB0292 / SEC5218 / TLM8264)
  export function extractElementoCode(el) {
    const s = normKey(el);
    const m = s.match(/([A-Z]{2,4}\d{4})/);
    return m ? m[1] : '';
  }
  
  // 2–4 letras + 2–4 dígitos (TLM82 / TLOB214 / FEW0665 etc)
  export function extractAlimBaseFlex(name) {
    const n = normKey(name);
    const m = n.match(/([A-Z]{2,4}\s?\d{2,4})/);
    return m ? m[1].replace(/\s+/g, '') : '';
  }
  