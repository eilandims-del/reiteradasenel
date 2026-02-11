// =========================
// FILE: js/components/modal-alimentadores-catalog.js
// =========================
import { openModal, closeModal } from './modal.js';
import {
  getCatalogForRegional,
  getBlocosForRegional,
  getMunicipiosForBloco,
  getAlimentadoresByMunicipio,
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
 * ✅ Modal: Regional -> Bloco -> Município -> Alimentadores
 * IDs (index.html):
 *  modalAlimentadores, alimListModal, alimHintModal, alimSearchModal,
 *  btnAlimAllModal, btnAlimClearModal, btnConfirmarAlimModal
 *
 * Dispara:
 *  alimentadores:changed { regional, mode, blocos, municipios, alimentadores }
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

  let selected = new Set(); // normKey(alimentador)
  let lastRegional = '';

  function matchesSearch(text, term) {
    if (!term) return true;
    return normKey(text).includes(normKey(term));
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

  function dispatchChanged(regional, mode) {
    const all = getAllAlimentadoresForRegional(regional);

    const blocosSelecionados = new Set();
    const municipiosSelecionados = new Set();

    getBlocosForRegional(regional).forEach(bl => {
      const municipios = getMunicipiosForBloco(regional, bl);
      municipios.forEach(m => {
        const alims = getAlimentadoresByMunicipio(regional, bl, m);
        const hasAny = alims.some(a => selected.has(normKey(a)));
        if (hasAny) {
          blocosSelecionados.add(bl);
          municipiosSelecionados.add(m);
        }
      });
    });

    document.dispatchEvent(
      new CustomEvent('alimentadores:changed', {
        detail: {
          regional,
          mode, // 'TODOS' | 'CUSTOM'
          blocos: Array.from(blocosSelecionados),
          municipios: Array.from(municipiosSelecionados),
          alimentadores: mode === 'TODOS' ? all : Array.from(selected)
        }
      })
    );
  }

  function renderList(regional) {
    listEl.innerHTML = '';

    const catalog = getCatalogForRegional(regional);
    const blocos = (catalog && Array.isArray(catalog.blocos)) ? catalog.blocos : [];

    if (!blocos.length) {
      listEl.innerHTML =
        `<div style="padding:12px; color:#666; font-weight:800;">Catálogo não encontrado para esta regional.</div>`;
      renderHint(regional);
      return;
    }

    const term = String(searchEl?.value || '').trim();

    blocos.forEach(bloco => {
      const municipios = getMunicipiosForBloco(regional, bloco);
      if (!municipios.length) return;

      // se nada do bloco passa na busca, não mostra o bloco
      const anyBlockVisible = municipios.some(m => {
        const alims = getAlimentadoresByMunicipio(regional, bloco, m);
        return alims.some(a => matchesSearch(`${bloco} ${m} ${a}`, term));
      });
      if (!anyBlockVisible) return;

      // ---- Card do Bloco ----
      const card = document.createElement('div');
      card.style.border = '1px solid rgba(0,0,0,0.10)';
      card.style.borderRadius = '14px';
      card.style.padding = '12px';
      card.style.background = 'rgba(255,255,255,0.95)';
      card.style.marginTop = '12px';

      const blocoHeader = document.createElement('div');
      blocoHeader.style.display = 'flex';
      blocoHeader.style.alignItems = 'center';
      blocoHeader.style.justifyContent = 'space-between';
      blocoHeader.style.gap = '10px';

      const blocoTitle = document.createElement('div');
      blocoTitle.style.fontWeight = '950';
      blocoTitle.style.fontSize = '0.95rem';
      blocoTitle.innerHTML = `🔷 <span>${bloco}</span>`;

      // checkbox: selecionar tudo do bloco
      const blocoToggle = document.createElement('input');
      blocoToggle.type = 'checkbox';

      const allBlocoAlims = [];
      municipios.forEach(m => {
        getAlimentadoresByMunicipio(regional, bloco, m).forEach(a => allBlocoAlims.push(a));
      });
      const allBlocoSelected = allBlocoAlims.length > 0 && allBlocoAlims.every(a => selected.has(normKey(a)));
      blocoToggle.checked = allBlocoSelected;

      blocoToggle.onchange = () => {
        if (blocoToggle.checked) {
          allBlocoAlims.forEach(a => selected.add(normKey(a)));
        } else {
          allBlocoAlims.forEach(a => selected.delete(normKey(a)));
        }
        renderList(regional);
      };

      blocoHeader.appendChild(blocoTitle);
      blocoHeader.appendChild(blocoToggle);
      card.appendChild(blocoHeader);

      // ---- Municípios ----
      municipios.forEach(municipio => {
        const alims = getAlimentadoresByMunicipio(regional, bloco, municipio);
        if (!alims.length) return;

        const anyMunicipioVisible = alims.some(a => matchesSearch(`${bloco} ${municipio} ${a}`, term));
        if (!anyMunicipioVisible) return;

        const muniWrap = document.createElement('div');
        muniWrap.style.marginTop = '12px';

        const muniTitle = document.createElement('div');
        muniTitle.style.fontWeight = '900';
        muniTitle.style.color = 'var(--medium-gray)';
        muniTitle.style.marginBottom = '8px';
        muniTitle.innerHTML = `📍 <span>${municipio}</span>`;
        muniWrap.appendChild(muniTitle);

        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        grid.style.gap = '8px';

        // checkbox: selecionar tudo do município
        // (fica no topo da grid como "chip" especial)
        const muniAllChip = document.createElement('label');
        muniAllChip.style.display = 'flex';
        muniAllChip.style.alignItems = 'center';
        muniAllChip.style.justifyContent = 'space-between';
        muniAllChip.style.padding = '8px 10px';
        muniAllChip.style.borderRadius = '10px';
        muniAllChip.style.border = '1px dashed rgba(0,0,0,0.25)';
        muniAllChip.style.background = 'rgba(0,0,0,0.03)';
        muniAllChip.style.cursor = 'pointer';
        muniAllChip.style.fontWeight = '900';
        muniAllChip.innerHTML = `<span>Selecionar ${municipio}</span>`;

        const muniToggle = document.createElement('input');
        muniToggle.type = 'checkbox';
        muniToggle.style.transform = 'scale(1.05)';

        const allMuniSelected = alims.every(a => selected.has(normKey(a)));
        muniToggle.checked = allMuniSelected;

        muniToggle.onchange = () => {
          if (muniToggle.checked) alims.forEach(a => selected.add(normKey(a)));
          else alims.forEach(a => selected.delete(normKey(a)));
          renderList(regional);
        };

        muniAllChip.appendChild(muniToggle);
        grid.appendChild(muniAllChip);

        alims.forEach(a => {
          if (!matchesSearch(`${bloco} ${municipio} ${a}`, term)) return;

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
            // atualiza toggles sem rerender parcial (força rerender total por consistência)
            // (simples e seguro)
            // blocoToggle/muniToggle recalculam no renderList
          };

          chip.onclick = (e) => {
            if (e.target?.tagName?.toLowerCase() === 'input') return;
            input.checked = !input.checked;
            input.dispatchEvent(new Event('change'));
            renderList(regional);
          };

          grid.appendChild(chip);
        });

        muniWrap.appendChild(grid);
        card.appendChild(muniWrap);
      });

      listEl.appendChild(card);
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
    if (!catalog || !Array.isArray(catalog.blocos) || !catalog.blocos.length) {
      listEl.innerHTML =
        `<div style="padding:12px; color:#666; font-weight:800;">Catálogo não encontrado para ${regional}.</div>`;
      hintEl.innerHTML = '';
      openModal(modalId);
      return;
    }

    // ao trocar regional, zera seleção (não vaza)
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
