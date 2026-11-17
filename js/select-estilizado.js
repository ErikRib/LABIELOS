/* =========================================================================
   SELECT ESTILIZADO (substitui a aparência do <select> nativo)
   -------------------------------------------------------------------------
   O <select> nativo abre uma lista com o visual do sistema operacional,
   diferente da lista usada pelos campos com sugestões (js/sugestoes.js).
   Este script troca a aparência por um botão + lista no mesmo estilo,
   mantendo o <select> original no DOM — só ele importa pro valor e pra
   validação do formulário, a interação do usuário passa a ser pelo botão.

   Diferença para o campo de sugestões: aqui não dá pra digitar um valor
   livre, só escolher uma das opções do <select> original.

   Uso: automático no carregamento, em todo <select data-select-estilizado>;
   para HTML criado depois, chame window.ativarSelectsEstilizados(raiz).
========================================================================= */

(() => {
  const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let contador = 0;

  function ativar(select) {
    if (select.dataset.selectEstilizado) return;
    select.dataset.selectEstilizado = '1';

    const wrap = document.createElement('div');
    wrap.className = 'campo-sugestoes';
    select.replaceWith(wrap);
    wrap.append(select);

    select.classList.add('select-estilizado-nativo');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    const n = ++contador;
    const idLista = `select-estilizado-${n}`;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'select-estilizado-botao';
    botao.setAttribute('role', 'combobox');
    botao.setAttribute('aria-haspopup', 'listbox');
    botao.setAttribute('aria-expanded', 'false');
    botao.setAttribute('aria-controls', idLista);
    const rotulo = document.querySelector(`label[for="${select.id}"]`);
    if (rotulo) {
      if (!rotulo.id) rotulo.id = `rotulo-${idLista}`;
      botao.setAttribute('aria-labelledby', rotulo.id);
    }
    const textoAtual = document.createElement('span');
    const iconeSeta = document.createElement('span');
    iconeSeta.innerHTML = SETA;
    botao.append(textoAtual, iconeSeta);
    wrap.append(botao);

    const ul = document.createElement('ul');
    ul.id = idLista;
    ul.className = 'sugestoes-lista';
    ul.hidden = true;
    ul.setAttribute('role', 'listbox');
    wrap.append(ul);

    let ativo = -1;
    const opcoes = () => [...select.options];
    const itens = () => [...ul.querySelectorAll('[role="option"]')];

    function atualizarTexto() {
      textoAtual.textContent = select.options[select.selectedIndex]?.textContent.trim() || '';
    }
    atualizarTexto();
    // Sincroniza o texto do botão quando o valor é trocado por fora (ex.:
    // `select.value = 'x'; select.dispatchEvent(new Event('change'))`,
    // como filtros que também reagem a clique num badge da própria tela).
    select.addEventListener('change', atualizarTexto);

    function render() {
      ul.innerHTML = opcoes().map((o, i) => {
        const selecionada = o.index === select.selectedIndex;
        return `<li role="option" id="${idLista}-${i}" data-valor="${o.value.replace(/"/g, '&quot;')}" aria-selected="${selecionada}">${o.textContent}</li>`;
      }).join('');
      ativo = select.selectedIndex;
    }

    function marcar(i) {
      const lis = itens();
      ativo = i < 0 || !lis.length ? -1 : ((i % lis.length) + lis.length) % lis.length;
      lis.forEach((li, k) => li.setAttribute('aria-selected', String(k === ativo)));
      if (ativo >= 0) {
        botao.setAttribute('aria-activedescendant', lis[ativo].id);
        lis[ativo].scrollIntoView({ block: 'nearest' });
      } else {
        botao.removeAttribute('aria-activedescendant');
      }
    }

    // A lista flutua por cima de tudo (escapa de modais com rolagem
    // interna) — mesma técnica de js/sugestoes.js.
    function reposicionar() {
      const r = botao.getBoundingClientRect();
      Object.assign(ul.style, {
        position: 'fixed',
        top: `${r.bottom + 4}px`,
        left: `${r.left}px`,
        width: `${r.width}px`,
        right: 'auto',
      });
    }
    function escaparRolagem() {
      const destino = botao.closest('dialog') || document.body;
      if (ul.parentElement !== destino) destino.appendChild(ul);
      reposicionar();
      requestAnimationFrame(reposicionar);
    }
    function voltarAoLugar() {
      if (ul.parentElement !== wrap) wrap.append(ul);
      ['position', 'top', 'left', 'width', 'right'].forEach(p => { ul.style[p] = ''; });
    }
    window.addEventListener('scroll', () => { if (!ul.hidden) reposicionar(); }, true);
    window.addEventListener('resize', () => { if (!ul.hidden) reposicionar(); });

    function abrir() {
      render();
      ul.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
      wrap.classList.add('aberto');
      escaparRolagem();
      marcar(ativo);
    }
    function fechar() {
      ul.hidden = true;
      botao.setAttribute('aria-expanded', 'false');
      botao.removeAttribute('aria-activedescendant');
      wrap.classList.remove('aberto');
      voltarAoLugar();
    }
    function escolher(valor) {
      if (select.value !== valor) {
        select.value = valor;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      atualizarTexto();
      fechar();
      botao.focus();
    }

    botao.addEventListener('click', () => (ul.hidden ? abrir() : fechar()));
    botao.addEventListener('blur', () => setTimeout(fechar, 120));
    botao.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (ul.hidden) { abrir(); return; }
        marcar(ativo + (e.key === 'ArrowDown' ? 1 : -1));
      } else if ((e.key === 'Enter' || e.key === ' ') && !ul.hidden && ativo >= 0) {
        e.preventDefault();
        escolher(itens()[ativo].dataset.valor);
      } else if (e.key === 'Escape' && !ul.hidden) {
        e.preventDefault();
        e.stopPropagation();
        fechar();
      }
    });
    ul.addEventListener('mousedown', e => {
      e.preventDefault();
      const li = e.target.closest('[role="option"]');
      if (li) escolher(li.dataset.valor);
    });
  }

  window.ativarSelectsEstilizados = (raiz = document) => raiz.querySelectorAll('select[data-select-estilizado]').forEach(ativar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.ativarSelectsEstilizados());
  else window.ativarSelectsEstilizados();
})();
