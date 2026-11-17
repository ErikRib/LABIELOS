/* =========================================================================
   RELATÓRIOS (html/client/relatorios.html) — organização solicitante
   -------------------------------------------------------------------------
   Substitui a antiga página "Histórico". Mostra TODAS as solicitações da
   organização (inclusive as concluídas, que saem da página Solicitações),
   com filtros, indicadores, dois gráficos de barras e exportação CSV.

   Dados: a lista `solicitacoes` já carregada por js/prototipo.js
   (GET /api/solicitacoes). Campos usados além dos de sempre:
   `concluida_em` ("dd/mm/aaaa hh:mm" ou null), preenchido quando o
   solicitante aprova a peça.
========================================================================= */

const ORDEM_STATUS_REL = ['Aberta', 'Em análise', 'Aguardando material', 'Em produção', 'Pronta para retirada', 'Concluída'];
const $r = sel => document.querySelector(sel);

// "dd/mm/aaaa[ hh:mm]" → Date (ou null)
function dataBR(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto || '');
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function diasEntre(a, b) {
  return a && b ? Math.max(0, Math.round((b - a) / 86400000)) : null;
}

function filtrosRel() {
  return {
    busca: $r('#relBusca').value.trim().toLowerCase(),
    status: $r('#relStatus').value,
    categoria: $r('#relCategoria').value,
    parceiro: $r('#relParceiro').value,
    de: $r('#relDe').value ? new Date(`${$r('#relDe').value}T00:00`) : null,
    ate: $r('#relAte').value ? new Date(`${$r('#relAte').value}T23:59`) : null
  };
}

function aplicarFiltrosRel(lista, f, ignorar = '') {
  return lista.filter(s => {
    const abertura = dataBR(s.abertura);
    if (f.busca && ![s.protocolo, s.solicitacao, s.descricao].some(v => String(v || '').toLowerCase().includes(f.busca))) return false;
    if (ignorar !== 'status' && f.status && s.status !== f.status) return false;
    if (f.categoria && s.categoria !== f.categoria) return false;
    if (ignorar !== 'parceiro' && f.parceiro && (s.atribuido || '') !== f.parceiro) return false;
    if (f.de && (!abertura || abertura < f.de)) return false;
    if (f.ate && (!abertura || abertura > f.ate)) return false;
    return true;
  });
}

function preencherOpcoes(select, valores) {
  const atual = select.value;
  select.querySelectorAll('option:not(:first-child)').forEach(o => o.remove());
  valores.forEach(v => select.insertAdjacentHTML('beforeend', `<option>${escaparHTML(v)}</option>`));
  select.value = valores.includes(atual) ? atual : '';
}

// Barras horizontais de uma série só (contagem), em um tom, com o valor
// escrito ao lado; clicar filtra a tabela. Os dados completos estão na
// tabela logo abaixo.
function renderBarras(ul, pares, aoClicar, selecionado) {
  const max = Math.max(1, ...pares.map(([, n]) => n));
  ul.innerHTML = pares.length
    ? pares.map(([rotulo, n]) => `
      <li>
        <button type="button" class="barra-item${rotulo === selecionado ? ' ativa' : ''}" data-valor="${escaparHTML(rotulo)}"
          aria-pressed="${rotulo === selecionado}" title="${escaparHTML(rotulo)}: ${n} solicitação(ões)">
          <span class="barra-rotulo">${escaparHTML(rotulo)}</span>
          <span class="barra-trilho"><span class="barra-valor" style="width:${(n / max) * 100}%"></span></span>
          <span class="barra-numero">${n}</span>
        </button>
      </li>`).join('')
    : '<li class="texto-apoio">Nada no período escolhido.</li>';
  ul.querySelectorAll('.barra-item').forEach(b => b.addEventListener('click', () => aoClicar(b.dataset.valor)));
}

function linhasRelatorio(lista) {
  return lista.map(s => {
    const conclusao = s.status === 'Concluída' ? (s.concluida_em || s.ultima_atualizacao || '') : '';
    const fim = conclusao ? dataBR(conclusao) : new Date();
    return { s, conclusao: conclusao.slice(0, 10), dias: diasEntre(dataBR(s.abertura), fim) };
  });
}

function renderRelatorio() {
  const f = filtrosRel();
  const lista = aplicarFiltrosRel(solicitacoes, f);
  const linhas = linhasRelatorio(lista);

  // Indicadores
  const concluidas = linhas.filter(l => l.s.status === 'Concluída');
  const tempos = concluidas.map(l => l.dias).filter(d => d !== null);
  $r('[data-rel="total"]').textContent = lista.length;
  $r('[data-rel="andamento"]').textContent = lista.length - concluidas.length;
  $r('[data-rel="concluidas"]').textContent = concluidas.length;
  $r('[data-rel="tempo"]').textContent = tempos.length
    ? `${Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)} dias`
    : '—';
  $r('#relContador').textContent = `${lista.length} de ${solicitacoes.length} solicitações`;

  // Gráficos: cada um ignora o próprio filtro, para mostrar as alternativas.
  const porStatus = aplicarFiltrosRel(solicitacoes, f, 'status');
  renderBarras($r('#graficoStatus'),
    ORDEM_STATUS_REL.map(st => [st, porStatus.filter(s => s.status === st).length]).filter(([, n]) => n),
    v => { $r('#relStatus').value = $r('#relStatus').value === v ? '' : v; $r('#relStatus').dispatchEvent(new Event('change')); renderRelatorio(); }, f.status);
  const porParceiro = aplicarFiltrosRel(solicitacoes, f, 'parceiro').filter(s => s.atribuido);
  const contagem = {};
  porParceiro.forEach(s => { contagem[s.atribuido] = (contagem[s.atribuido] || 0) + 1; });
  renderBarras($r('#graficoParceiro'),
    Object.entries(contagem).sort((a, b) => b[1] - a[1]),
    v => { $r('#relParceiro').value = $r('#relParceiro').value === v ? '' : v; $r('#relParceiro').dispatchEvent(new Event('change')); renderRelatorio(); }, f.parceiro);

  // Tabela
  const tbody = $r('#tabelaRelatorio tbody');
  renderComPaginacao({
    chave: 'tabelaRelatorio', tbody, itens: linhas,
    vazio: '<tr><td colspan="8" class="estado-vazio">Nenhuma solicitação com os filtros escolhidos.</td></tr>',
    renderLinhas: pagina => pagina.map(({ s, conclusao, dias }) => `
      <tr class="linha-clicavel" tabindex="0" data-protocolo="${escaparHTML(s.protocolo)}" aria-label="Abrir detalhes da solicitação ${escaparHTML(s.protocolo)}">
        <td>${escaparHTML(s.protocolo)}</td>
        <td>${escaparHTML(s.solicitacao)}</td>
        <td>${escaparHTML(s.categoria)}</td>
        <td>${escaparHTML(textoAtribuidos(s.atribuido))}</td>
        <td><span class="badge status-${badgeClass(s.status)}">${escaparHTML(s.status)}</span></td>
        <td>${escaparHTML(s.abertura)}</td>
        <td>${escaparHTML(conclusao || '—')}</td>
        <td>${dias ?? '—'}${s.status !== 'Concluída' && dias !== null ? ' <small class="texto-apoio">(em aberto)</small>' : ''}</td>
      </tr>`).join(''),
  });
  ativarLinhasClicaveis(tbody);
  if (!tbody.dataset.pagOuvinte) { tbody.dataset.pagOuvinte = '1'; tbody.addEventListener('paginacao-mudou', renderRelatorio); }
}

// CSV com ";" (abre direto no Excel em português) e BOM para os acentos.
function exportarRelatorio() {
  const linhas = linhasRelatorio(aplicarFiltrosRel(solicitacoes, filtrosRel()));
  const cab = ['Protocolo', 'Solicitação', 'Categoria', 'Material', 'Prioridade', 'Parceiro', 'Status', 'Abertura', 'Prazo', 'Conclusão', 'Dias'];
  const celula = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const corpo = linhas.map(({ s, conclusao, dias }) => [s.protocolo, s.solicitacao, s.categoria, s.material, s.prioridade,
    s.atribuido || 'Aguardando parceiro', s.status, s.abertura, s.prazo, conclusao, dias ?? ''].map(celula).join(';'));
  const blob = new Blob(['﻿' + [cab.map(celula).join(';'), ...corpo].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio-solicitacoes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!$r('#tabelaRelatorio')) return;
  try { await window.dadosIniciaisProntos; } catch { return; }

  const presentes = ORDEM_STATUS_REL.filter(st => solicitacoes.some(s => s.status === st));
  preencherOpcoes($r('#relStatus'), presentes);
  preencherOpcoes($r('#relCategoria'), [...new Set(solicitacoes.map(s => s.categoria).filter(Boolean))].sort());
  preencherOpcoes($r('#relParceiro'), [...new Set(solicitacoes.map(s => s.atribuido).filter(Boolean))].sort());
  // Só agora, com as opções já populadas, troca a aparência dos <select>
  // pelo mesmo visual das listas de sugestão do resto do site.
  window.ativarSelectsEstilizados?.();

  ['#relBusca', '#relStatus', '#relCategoria', '#relParceiro', '#relDe', '#relAte'].forEach(sel =>
    $r(sel).addEventListener(sel === '#relBusca' ? 'input' : 'change', renderRelatorio));
  $r('#relLimpar').addEventListener('click', () => {
    ['#relBusca', '#relStatus', '#relCategoria', '#relParceiro', '#relDe', '#relAte'].forEach(sel => {
      $r(sel).value = '';
      $r(sel).dispatchEvent(new Event('change'));
    });
    renderRelatorio();
  });
  $r('#exportarRelatorio').addEventListener('click', exportarRelatorio);
  renderRelatorio();
});
