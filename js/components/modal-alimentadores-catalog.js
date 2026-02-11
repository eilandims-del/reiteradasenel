// =========================
// FILE: js/components/modal-alimentadores-catalog.js
// =========================

import { openModal, closeModal } from './modal.js';
import {
  getCatalogForRegional,
  getConjuntosForRegional,
  getAlimentadoresByConjunto,
  getAllAlimentadoresForRegional
} from '../services/alimentadores-catalog.js';

function normKey(v) {
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

/**
 * ✅ Setup do modal de catálogo de alimentadores (por Conjunto)
 * - Compatível com seu index.html atual:
 *   modalAlimentadores, alimListModal, alimHintModal, alimSearchModal,
 *   btnAlimAllModal, btnAlimClearModal, btnConfirmarAlimModal
 *
 * - Dispara evento:
 *   document.dispatchEvent(new CustomEvent('alimentadores:changed', { detail: {...} }))
 */
export function setupAlimentadoresCatalogModal(opts = {}) {
  const {
    getSelectedRegional = () => '',
    onMissingRegional = null
  } = opts;

  const modalId = 'modalAlimentadores';
  const listEl = document.getElementById('alimListModal');
  const hintEl = document.getElementById('alimHintModal');
  const searchEl = document.getElementById('alimSearchModal');

  const btnAll = document.getElementById('btnAlimAllModal');
  const btnClear = document.getElementById('btnAlimClearModal');
  const btnApply = document.getElementById('btnConfirmarAlimModal');

  if (!listEl || !hintEl || !btnAll || !btnClear || !btnApply) {
    console.error('[ALIM-CAT] IDs do modal não encontrados no index.html.');
    return { open: () => console.warn('[ALIM-CAT] modal não inicializado (IDs faltando).') };
  }

  let selected = new Set();   // normKey(alimentador)
  let lastRegional = '';

  function dispatchChanged(regional, mode) {
    const all = getAllAlimentadoresForRegional(regional);
    const selectedArr = Array.from(selected);

    // conjuntos selecionados = os que têm pelo menos 1 alim selecionado
    const conjSet = new Set();
    const conjList = getConjuntosForRegional(regional);
    conjList.forEach(conj => {
      const alims = getAlimentadoresByConjunto(regional, conj);
      if (alims.some(a => selected.has(normKey(a)))) conjSet.add(conj);
    });

    document.dispatchEvent(
      new CustomEvent('alimentadores:changed', {
        detail: {
          regional,
          mode, // 'TODOS' | 'CUSTOM'
          conjuntos: Array.from(conjSet),
          alimentadores: mode === 'TODOS' ? all : selectedArr
        }
      })
    );
  }

  function renderHint(regional) {
    const all = getAllAlimentadoresForRegional(regional);
    const total = all.length;

    if (!total) {
      hintEl.innerHTML = `Catálogo: <b>0</b>`;
      return;
    }

    if (selected.size === total) {
      hintEl.innerHTML = `Modo: <b>TODOS</b> • Catálogo: <b>${total}</b>`;
      return;
    }

    if (selected.size > 0) {
      hintEl.innerHTML = `Selecionados: <b>${selected.size}</b> • Catálogo: <b>${total}</b>`;
      return;
    }

    hintEl.innerHTML = `Escolha <b>TODOS</b> ou selecione <b>1+</b> alimentadores.`;
  }

  function matchesSearch(text, term) {
    if (!term) return true;
    return normKey(text).includes(normKey(term));
  }

  function renderList(regional) {
    listEl.innerHTML = '';

    const catalog = getCatalogForRegional(regional);
    const conjuntos = (catalog && Array.isArray(catalog.conjuntos)) ? catalog.conjuntos : [];

    if (!conjuntos.length) {
      listEl.innerHTML = `<div style="padding:12px; color:#666; font-weight:800;">Catálogo não encontrado para esta regional.</div>`;
      renderHint(regional);
      return;
    }

    const term = String(searchEl?.value || '').trim();

    conjuntos.forEach(conj => {
      const alims = getAlimentadoresByConjunto(regional, conj);
      if (!alims.length) return;

      const anyVisible = alims.some(a => matchesSearch(`${conj} ${a}`, term));
      if (!anyVisible) return;

      const block = document.createElement('div');
      block.className = 'alim-block';
      block.style.border = '1px solid rgba(0,0,0,0.08)';
      block.style.borderRadius = '12px';
      block.style.padding = '10px';
      block.style.background = 'rgba(255,255,255,0.92)';
      block.style.marginTop = '10px';

      // header do conjunto + checkbox "selecionar tudo do conjunto"
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.style.gap = '10px';
      header.style.marginBottom = '8px';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';
      left.innerHTML = `📍 <strong>${conj}</strong>`;

      const conjToggle = document.createElement('input');
      conjToggle.type = 'checkbox';

      const allInConjSelected = alims.every(a => selected.has(normKey(a)));
      conjToggle.checked = allInConjSelected;

      conjToggle.onchange = () => {
        if (conjToggle.checked) {
          alims.forEach(a => selected.add(normKey(a)));
        } else {
          alims.forEach(a => selected.delete(normKey(a)));
        }
        renderList(regional);
      };

      header.appendChild(left);
      header.appendChild(conjToggle);

      // grid dos alimentadores
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
      grid.style.gap = '8px';

      alims.forEach(a => {
        if (!matchesSearch(`${conj} ${a}`, term)) return;

        const key = normKey(a);
        const checked = selected.has(key);

        const chip = document.createElement('label');
        chip.className = 'alim-chip';
        chip.style.display = 'flex';
        chip.style.alignItems = 'center';
        chip.style.justifyContent = 'space-between';
        chip.style.padding = '8px 10px';
        chip.style.borderRadius = '10px';
        chip.style.border = checked ? '2px solid #0A4A8C' : '1px solid rgba(0,0,0,0.12)';
        chip.style.background = checked ? 'rgba(10,74,140,0.10)' : '#fff';
        chip.style.cursor = 'pointer';
        chip.style.fontWeight = '900';

        chip.innerHTML = `
          <span style="display:flex; align-items:center; gap:8px;">
            <input type="checkbox" ${checked ? 'checked' : ''} style="transform:scale(1.05);" />
            <span>${a}</span>
          </span>
        `;

        const input = chip.querySelector('input');

        input.onchange = () => {
          if (input.checked) selected.add(key);
          else selected.delete(key);
          renderHint(regional);
          // atualiza o checkbox do conjunto sem rerender total
          conjToggle.checked = alims.every(x => selected.has(normKey(x)));
        };

        chip.onclick = (e) => {
          if (e.target?.tagName?.toLowerCase() === 'input') return;
          input.checked = !input.checked;
          input.dispatchEvent(new Event('change'));
        };

        grid.appendChild(chip);
      });

      block.appendChild(header);
      block.appendChild(grid);
      listEl.appendChild(block);
    });

    renderHint(regional);
  }

  function open() {
    const regional = String(getSelectedRegional() || '').trim().toUpperCase();

    if (!regional) {
      if (typeof onMissingRegional === 'function') onMissingRegional();
      else console.warn('[ALIM-CAT] Nenhuma regional selecionada.');
      return;
    }

    const catalog = getCatalogForRegional(regional);
    if (!catalog || !Array.isArray(catalog.conjuntos) || !catalog.conjuntos.length) {
      listEl.innerHTML = `<div style="padding:12px; color:#666; font-weight:800;">Catálogo não encontrado para ${regional}.</div>`;
      hintEl.innerHTML = '';
      openModal(modalId);
      return;
    }

    if (regional !== lastRegional) {
      selected = new Set();
      lastRegional = regional;
      if (searchEl) searchEl.value = '';
    }

    renderList(regional);
    openModal(modalId);
  }

  // ====== eventos ======
  btnAll.onclick = (e) => {
    e.preventDefault();
    const regional = String(getSelectedRegional() || '').trim().toUpperCase();
    if (!regional) return;

    const all = getAllAlimentadoresForRegional(regional);
    selected = new Set(all.map(normKey));

    renderList(regional);
    dispatchChanged(regional, 'TODOS');
    closeModal(modalId);
  };

  btnClear.onclick = (e) => {
    e.preventDefault();
    const regional = String(getSelectedRegional() || '').trim().toUpperCase();
    if (!regional) return;

    selected = new Set();
    renderList(regional);
  };

  if (searchEl) {
    searchEl.oninput = () => {
      const regional = String(getSelectedRegional() || '').trim().toUpperCase();
      if (!regional) return;
      renderList(regional);
    };
  }

  btnApply.onclick = (e) => {
    e.preventDefault();
    const regional = String(getSelectedRegional() || '').trim().toUpperCase();
    if (!regional) return;

    const all = getAllAlimentadoresForRegional(regional);
    const total = all.length;

    if (selected.size === 0) {
      renderHint(regional);
      return;
    }

    const mode = selected.size === total ? 'TODOS' : 'CUSTOM';
    dispatchChanged(regional, mode);
    closeModal(modalId);
  };

  return { open };
}
