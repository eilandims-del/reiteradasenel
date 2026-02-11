// =========================
// FILE: js/components/modal-alimentadores-catalog.js
// =========================

import {
    getConjuntosByRegional,
    getAlimentadoresByConjunto,
    getAllAlimentadoresRegional
  } from '../services/alimentadores-catalog.js';
  
  function norm(v) {
    return String(v ?? '').trim().toUpperCase();
  }
  
  function $(id) {
    return document.getElementById(id);
  }
  
  export function openAlimentadoresCatalogModal(regional, preSelected = []) {
    const reg = norm(regional);
    if (!reg) return;
  
    const modal = $('modalAlimentadores');
    const listEl = $('alimListModal');
    const hintEl = $('alimHintModal');
  
    const btnTodos = $('btnAlimAllModal');
    const btnLimpar = $('btnAlimClearModal');
    const btnConfirmar = $('btnConfirmarAlimModal');
  
    if (!modal || !listEl) {
      console.error('Modal alimentadores não encontrado.');
      return;
    }
  
    let selected = new Set(preSelected.map(norm));
  
    const conjuntos = getConjuntosByRegional(reg);
  
    function updateHint() {
      const total = getAllAlimentadoresRegional(reg).length;
  
      if (selected.size === 0) {
        hintEl.innerHTML = `Selecione <b>1+</b> alimentadores ou <b>TODOS</b>.`;
        return;
      }
  
      if (selected.size === total) {
        hintEl.innerHTML = `Modo: <b>TODOS</b> • Total: ${total}`;
        return;
      }
  
      hintEl.innerHTML = `Selecionados: <b>${selected.size}</b> • Total: ${total}`;
    }
  
    function render() {
      listEl.innerHTML = '';
  
      conjuntos.forEach(conjunto => {
        const wrapper = document.createElement('div');
        wrapper.className = 'conjunto-wrapper';
  
        const header = document.createElement('div');
        header.className = 'conjunto-header';
  
        const conjuntoCheckbox = document.createElement('input');
        conjuntoCheckbox.type = 'checkbox';
  
        const alimentadores = getAlimentadoresByConjunto(reg, conjunto);
  
        const allSelected = alimentadores.every(a => selected.has(norm(a)));
        conjuntoCheckbox.checked = allSelected;
  
        header.appendChild(conjuntoCheckbox);
  
        const title = document.createElement('strong');
        title.textContent = conjunto;
        header.appendChild(title);
  
        wrapper.appendChild(header);
  
        const alimentadoresDiv = document.createElement('div');
        alimentadoresDiv.className = 'alimentadores-list';
  
        alimentadores.forEach(alim => {
          const key = norm(alim);
  
          const label = document.createElement('label');
          label.className = 'alim-item';
  
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = selected.has(key);
  
          checkbox.onchange = () => {
            if (checkbox.checked) selected.add(key);
            else selected.delete(key);
  
            render();
            updateHint();
          };
  
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(alim));
  
          alimentadoresDiv.appendChild(label);
        });
  
        conjuntoCheckbox.onchange = () => {
          if (conjuntoCheckbox.checked) {
            alimentadores.forEach(a => selected.add(norm(a)));
          } else {
            alimentadores.forEach(a => selected.delete(norm(a)));
          }
  
          render();
          updateHint();
        };
  
        wrapper.appendChild(alimentadoresDiv);
        listEl.appendChild(wrapper);
      });
  
      updateHint();
    }
  
    // BOTÃO TODOS
    btnTodos.onclick = () => {
      selected = new Set(getAllAlimentadoresRegional(reg).map(norm));
      render();
    };
  
    // BOTÃO LIMPAR
    btnLimpar.onclick = () => {
      selected.clear();
      render();
    };
  
    // CONFIRMAR
    btnConfirmar.onclick = () => {
      if (selected.size === 0) {
        alert('Selecione pelo menos um alimentador.');
        return;
      }
  
      document.dispatchEvent(new CustomEvent('alimentadores:changed', {
        detail: {
          regional: reg,
          alimentadores: Array.from(selected)
        }
      }));
  
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };
  
    render();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  