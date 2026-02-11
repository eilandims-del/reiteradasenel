// =========================
// FILE: js/components/modal-alimentadores-catalog.js
// =========================
import {
    getConjuntosByRegional,
    getAlimentadoresByConjunto,
    getAllAlimentadoresRegional
  } from '../services/alimentadores-catalog.js';
  
  function $(id) { return document.getElementById(id); }
  
  function normUp(v) {
    return String(v ?? '').trim().toUpperCase();
  }
  
  export function setupAlimentadoresCatalogModal(getRegional) {
    const badge = $('badgeOpenAlimentadores');
    if (!badge) return;
  
    badge.addEventListener('click', () => {
      const reg = normUp(getRegional?.() || '');
      if (!reg) return;
  
      // abre o modal já existente no index.html
      const modal = $('modalAlimentadores');
      if (!modal) {
        console.error('[MODAL] modalAlimentadores não existe no index.html');
        return;
      }
  
      renderModal(reg);
      modal.style.display = 'flex';
    });
  
    // fechar
    $('fecharModalAlim')?.addEventListener('click', () => {
      $('modalAlimentadores').style.display = 'none';
    });
  }
  
  function renderModal(regional) {
    const listEl = $('alimListModal');
    const hintEl = $('alimHintModal');
    const searchEl = $('alimSearchModal');
  
    const btnTodos = $('btnAlimAllModal');
    const btnLimpar = $('btnAlimClearModal');
    const btnConfirmar = $('btnConfirmarAlimModal');
  
    if (!listEl || !hintEl || !btnTodos || !btnLimpar || !btnConfirmar) {
      console.error('[MODAL] IDs do modal não encontrados no index.html');
      return;
    }
  
    if (searchEl) searchEl.value = '';
  
    const conjuntos = getConjuntosByRegional(regional);
    const allAlims = getAllAlimentadoresRegional(regional);
  
    // estado local do modal
    let selectedConj = new Set();
    let selectedAlim = new Set();
    let mode = 'CUSTOM'; // 'ALL' | 'CUSTOM'
  
    function setHint() {
      if (mode === 'ALL') {
        hintEl.innerHTML = `Modo: <b>TODOS</b> • Catálogo: <b>${allAlims.length}</b>`;
        return;
      }
      const c = selectedConj.size;
      const a = selectedAlim.size;
      hintEl.innerHTML = `Selecionados: <b>${c}</b> conjunto(s) • <b>${a}</b> alimentador(es)`;
    }
  
    function emitChanged() {
      const detail = {
        mode,
        regional,
        conjuntos: Array.from(selectedConj),
        alimentadores: Array.from(selectedAlim)
      };
      document.dispatchEvent(new CustomEvent('alimentadores:changed', { detail }));
    }
  
    function renderList() {
      listEl.innerHTML = '';
  
      // monta blocos por conjunto
      conjuntos.forEach(conj => {
        const block = document.createElement('div');
        block.style.border = '1px solid rgba(0,0,0,0.10)';
        block.style.borderRadius = '12px';
        block.style.padding = '10px';
        block.style.marginBottom = '10px';
        block.style.background = 'rgba(255,255,255,0.75)';
  
        const head = document.createElement('div');
        head.style.display = 'flex';
        head.style.alignItems = 'center';
        head.style.gap = '10px';
  
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = selectedConj.has(conj);
  
        const title = document.createElement('div');
        title.style.fontWeight = '900';
        title.textContent = `📍 ${conj}`;
  
        head.appendChild(chk);
        head.appendChild(title);
  
        const alims = getAlimentadoresByConjunto(regional, conj);
  
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
        grid.style.gap = '8px';
        grid.style.marginTop = '10px';
  
        alims.forEach(a => {
          const row = document.createElement('label');
          row.className = 'alim-chip';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
  
          const left = document.createElement('span');
          left.className = 'alim-left';
  
          const chkA = document.createElement('input');
          chkA.type = 'checkbox';
          chkA.checked = selectedAlim.has(a);
  
          const name = document.createElement('span');
          name.className = 'alim-name';
          name.textContent = a;
  
          left.appendChild(chkA);
          left.appendChild(name);
  
          row.appendChild(left);
          grid.appendChild(row);
  
          chkA.onchange = () => {
            mode = 'CUSTOM';
            if (chkA.checked) selectedAlim.add(a);
            else selectedAlim.delete(a);
            setHint();
          };
        });
  
        chk.onchange = () => {
          mode = 'CUSTOM';
          if (chk.checked) selectedConj.add(conj);
          else selectedConj.delete(conj);
          setHint();
        };
  
        block.appendChild(head);
        block.appendChild(grid);
        listEl.appendChild(block);
      });
  
      setHint();
    }
  
    // ações
    btnTodos.onclick = (e) => {
      e.preventDefault();
      mode = 'ALL';
      selectedConj = new Set();
      selectedAlim = new Set();
      setHint();
      emitChanged();
      $('modalAlimentadores').style.display = 'none';
    };
  
    btnLimpar.onclick = (e) => {
      e.preventDefault();
      mode = 'CUSTOM';
      selectedConj = new Set();
      selectedAlim = new Set();
      renderList();
    };
  
    btnConfirmar.onclick = (e) => {
      e.preventDefault();
      // valida: precisa ter 1+ conj ou 1+ alim, ou ALL
      if (mode !== 'ALL' && selectedConj.size === 0 && selectedAlim.size === 0) {
        setHint();
        return;
      }
      emitChanged();
      $('modalAlimentadores').style.display = 'none';
    };
  
    // busca (filtra visualmente por texto dentro do listEl)
    if (searchEl) {
      searchEl.oninput = (e) => {
        const term = normUp(e.target.value || '');
        Array.from(listEl.querySelectorAll('.alim-chip')).forEach(chip => {
          const text = normUp(chip.textContent);
          chip.style.display = text.includes(term) ? '' : 'none';
        });
      };
    }
  
    renderList();
  }
  