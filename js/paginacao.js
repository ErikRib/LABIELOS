/* =========================================================================
   PAGINAÇÃO (componente compartilhado)
   -------------------------------------------------------------------------
   Qualquer tabela que pode crescer bastante (solicitações, demandas, fila,
   materiais, impressoras, relatórios, membros, pedidos...) usa isto em vez
   de desenhar a lista inteira de uma vez: mostra só um pedaço (15 linhas
   por padrão, o usuário pode mudar) e desenha os controles de página
   logo depois da tabela.

   Uso: em vez de `tbody.innerHTML = itens.map(renderLinha).join('')`,
   chame:

     renderComPaginacao({
       chave: 'tabelaMateriais',   // identifica esta tabela (guarda a página/limite atual)
       tbody,                      // o <tbody> onde as linhas vão
       itens,                      // a lista já filtrada, pronta pra desenhar
       renderLinhas: lista => lista.map(renderLinhaMaterial).join(''),
       vazio: '<tr><td colspan="6">Nenhum item encontrado.</td></tr>',
     });

   A página some sozinha quando a lista cabe inteira num limite (ex.: 8
   itens com limite 15 não mostra nenhum controle). Ao trocar de página,
   o topo da tabela recebe foco/scroll, pra quem navega por teclado não
   perder a posição.
========================================================================= */

(() => {
  const LIMITES = [15, 30, 50, 'Todos'];
  const estado = new Map(); // chave -> { pagina, limite, totalAnterior }

  function estadoDe(chave) {
    if (!estado.has(chave)) estado.set(chave, { pagina: 1, limite: 15, totalAnterior: null });
    return estado.get(chave);
  }

  function limparControles(tbody) {
    const wrap = tbody.closest('.tabela-wrap') || tbody.closest('table')?.parentElement || tbody;
    wrap.parentElement?.querySelector(`[data-paginacao-de="${tbody.id || ''}"]`)?.remove();
  }

  function renderComPaginacao({ chave, tbody, itens, renderLinhas, vazio }) {
    const dados = estadoDe(chave);

    // Lista mudou de tamanho desde a última vez (reload, filtro aplicado,
    // item criado/removido) — melhor recomeçar da página 1 do que arriscar
    // mostrar uma página vazia.
    if (dados.totalAnterior !== null && dados.totalAnterior !== itens.length) dados.pagina = 1;
    dados.totalAnterior = itens.length;

    const limite = dados.limite === 'Todos' ? itens.length || 1 : dados.limite;
    const totalPaginas = Math.max(1, Math.ceil(itens.length / limite));
    if (dados.pagina > totalPaginas) dados.pagina = totalPaginas;

    const inicio = (dados.pagina - 1) * limite;
    const pagina = itens.slice(inicio, inicio + limite);

    tbody.innerHTML = itens.length ? renderLinhas(pagina) : (vazio || '<tr><td>Nenhum item encontrado.</td></tr>');

    desenharControles({ chave, tbody, totalItens: itens.length, totalPaginas, dados });
  }

  function desenharControles({ chave, tbody, totalItens, totalPaginas, dados }) {
    const tabela = tbody.closest('table');
    const ancora = tabela?.closest('.tabela-wrap') || tabela;
    if (!ancora) return;

    let barra = ancora.parentElement?.querySelector(`.paginacao[data-paginacao-de="${chave}"]`);

    // Sem necessidade de paginação (cabe tudo num limite "Todos" ou a
    // lista é menor que o menor limite): não mostra controle nenhum.
    if (totalPaginas <= 1 && dados.limite === 'Todos') {
      barra?.remove();
      return;
    }
    if (totalPaginas <= 1 && totalItens <= 15 && dados.limite === 15) {
      barra?.remove();
      return;
    }

    if (!barra) {
      barra = document.createElement('div');
      barra.className = 'paginacao';
      barra.dataset.paginacaoDe = chave;
      ancora.insertAdjacentElement('afterend', barra);
    }

    const inicio = totalItens === 0 ? 0 : (dados.pagina - 1) * (dados.limite === 'Todos' ? totalItens : dados.limite) + 1;
    const fim = Math.min(inicio + (dados.limite === 'Todos' ? totalItens : dados.limite) - 1, totalItens);

    barra.innerHTML = `
      <p class="paginacao-resumo">${totalItens === 0 ? 'Nenhum item' : `${inicio}–${fim} de ${totalItens}`}</p>
      <div class="paginacao-controles">
        <label class="paginacao-limite">Mostrar
          <select aria-label="Itens por página">
            ${LIMITES.map(l => `<option value="${l}" ${l === dados.limite ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
        <nav class="paginacao-paginas" aria-label="Navegação de páginas">
          <button type="button" class="btn-pagina" data-pag-ir="anterior" ${dados.pagina <= 1 ? 'disabled' : ''} aria-label="Página anterior">‹</button>
          <span class="paginacao-indicador" aria-live="polite">Página ${dados.pagina} de ${totalPaginas}</span>
          <button type="button" class="btn-pagina" data-pag-ir="proxima" ${dados.pagina >= totalPaginas ? 'disabled' : ''} aria-label="Próxima página">›</button>
        </nav>
      </div>`;

    barra.querySelector('select').addEventListener('change', e => {
      const v = e.target.value;
      dados.limite = v === 'Todos' ? 'Todos' : Number(v);
      dados.pagina = 1;
      irParaTopo(tbody);
      tbody.dispatchEvent(new CustomEvent('paginacao-mudou', { bubbles: true }));
    });
    barra.querySelector('[data-pag-ir="anterior"]').addEventListener('click', () => {
      if (dados.pagina > 1) { dados.pagina -= 1; irParaTopo(tbody); tbody.dispatchEvent(new CustomEvent('paginacao-mudou', { bubbles: true })); }
    });
    barra.querySelector('[data-pag-ir="proxima"]').addEventListener('click', () => {
      if (dados.pagina < totalPaginas) { dados.pagina += 1; irParaTopo(tbody); tbody.dispatchEvent(new CustomEvent('paginacao-mudou', { bubbles: true })); }
    });
  }

  function irParaTopo(tbody) {
    const tabela = tbody.closest('table') || tbody;
    tabela.setAttribute('tabindex', '-1');
    tabela.scrollIntoView({ block: 'nearest' });
    tabela.focus({ preventScroll: true });
  }

  // Cada tela chama renderComPaginacao() de novo quando o usuário troca de
  // página/limite (reage ao evento "paginacao-mudou" disparado no tbody).
  window.renderComPaginacao = renderComPaginacao;
})();
