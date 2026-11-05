/* =========================================================================
   CAMPO COM SUGESTÕES (substitui o <datalist> nativo)
   -------------------------------------------------------------------------
   O <datalist> do navegador tem visual próprio (no Edge, uma caixa preta)
   e parece uma lista fechada, embora aceite qualquer texto. Este script
   troca cada <input list="..."> por um campo de texto com uma lista de
   sugestões no estilo da plataforma: dá para escolher uma sugestão OU
   digitar outro valor, e a ajuda abaixo do campo diz isso.

   As opções continuam vindo do <datalist> (lido a cada abertura), então
   quem atualiza o datalist (ex.: materiais em estoque) não muda nada.

   Uso: automático no carregamento; para HTML criado depois, chame
   window.ativarSugestoes(elementoRaiz).
   Acessibilidade: padrão ARIA "combobox" com listbox (setas, Enter, Esc).
========================================================================= */

(() => {
  let contador = 0;
  const normalizar = t => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function ativar(input) {
    const lista = document.getElementById(input.getAttribute('list'));
    if (!lista || input.dataset.sugestoes) return;
    input.dataset.sugestoes = lista.id;
    input.removeAttribute('list'); // desliga o datalist nativo

    const n = ++contador;
    const idLista = `sugestoes-${n}`;
    const wrap = document.createElement('div');
    wrap.className = 'campo-sugestoes';
    input.replaceWith(wrap);
    wrap.innerHTML = `
      <button type="button" class="sugestoes-abrir" tabindex="-1" aria-label="Mostrar sugestões">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <ul class="sugestoes-lista" id="${idLista}" role="listbox" hidden></ul>`;
    wrap.prepend(input);

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', idLista);
    input.autocomplete = 'off';

    // Ajuda visível: deixa claro que é texto livre com sugestões.
    if (!input.dataset.semAjuda) {
      const ajuda = document.createElement('small');
      ajuda.className = 'campo-ajuda';
      ajuda.id = `ajuda-sugestoes-${n}`;
      ajuda.textContent = 'Escolha uma sugestão ou digite outro valor.';
      wrap.after(ajuda);
      input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), ajuda.id].filter(Boolean).join(' '));
    }

    const ul = wrap.querySelector('ul');
    const botao = wrap.querySelector('.sugestoes-abrir');
    let ativo = -1;

    const opcoes = () => [...lista.options].map(o => o.value).filter(Boolean);
    const itens = () => [...ul.querySelectorAll('[role="option"]')];

    function abrir(filtrar = true) {
      const termo = filtrar ? normalizar(input.value.trim()) : '';
      const valores = opcoes().filter(v => !termo || normalizar(v).includes(termo));
      ul.innerHTML = valores.length
        ? valores.map((v, i) => `<li role="option" id="${idLista}-${i}" aria-selected="false" data-valor="${v.replace(/"/g, '&quot;')}">${v.replace(/</g, '&lt;')}</li>`).join('')
        : '<li class="sugestoes-vazio" aria-disabled="true">Nenhuma sugestão. O valor digitado será usado.</li>';
      ul.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      wrap.classList.add('aberto');
      marcar(-1);
    }

    function fechar() {
      ul.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      wrap.classList.remove('aberto');
    }

    function marcar(i) {
      const lis = itens();
      ativo = i < 0 || !lis.length ? -1 : i % lis.length;
      lis.forEach((li, k) => li.setAttribute('aria-selected', String(k === ativo)));
      if (ativo >= 0) {
        input.setAttribute('aria-activedescendant', lis[ativo].id);
        lis[ativo].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }

    let escolhendo = false;
    function escolher(valor) {
      input.value = valor;
      escolhendo = true; // o 'input' abaixo avisa quem ouve o campo, sem reabrir a lista
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      escolhendo = false;
      fechar();
    }

    input.addEventListener('input', () => { if (!escolhendo && document.activeElement === input) abrir(); });
    input.addEventListener('focus', () => abrir(false));
    input.addEventListener('blur', () => setTimeout(fechar, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (ul.hidden) abrir(false);
        const baixo = e.key === 'ArrowDown';
        marcar(ativo < 0 ? (baixo ? 0 : itens().length - 1) : ativo + (baixo ? 1 : -1));
      } else if (e.key === 'Enter' && !ul.hidden && ativo >= 0) {
        e.preventDefault();
        escolher(itens()[ativo].dataset.valor);
      } else if (e.key === 'Escape' && !ul.hidden) {
        e.preventDefault();
        e.stopPropagation(); // não fecha o modal junto
        fechar();
      }
    });
    ul.addEventListener('mousedown', e => {
      e.preventDefault(); // mantém o foco no campo
      const li = e.target.closest('[role="option"]');
      if (li) escolher(li.dataset.valor);
    });
    botao.addEventListener('mousedown', e => e.preventDefault());
    botao.addEventListener('click', () => {
      if (ul.hidden) { input.focus(); abrir(false); } else fechar();
    });
  }

  window.ativarSugestoes = (raiz = document) => raiz.querySelectorAll('input[list]').forEach(ativar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.ativarSugestoes());
  else window.ativarSugestoes();
})();
