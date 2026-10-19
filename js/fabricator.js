/*
   Área do fabricante (parceiro de manufatura). Reaproveita de
   prototipo.js os dados vindos da API (solicitacoes, parceiros,
   usuarioLogado), as funções utilitárias (badgeClass, textoAtribuidos) e
   a promessa compartilhada "window.dadosIniciaisProntos", já que os dois
   arquivos têm cada um seu próprio listener de DOMContentLoaded.

   A visibilidade de quais solicitações aparecem aqui é decidida pelo
   back-end (ver docs/backend.md): a API só retorna, para uma organização
   do tipo fabricante, as solicitações atribuídas a ela — este arquivo não
   filtra mais isso no cliente.
*/

const CHAVE_COLUNAS_DEMANDAS = 'labielosFabricanteColunas';

const COLUNAS_DEMANDAS = [
  { chave: 'protocolo', tipo: 'texto', label: 'Protocolo', fixa: true },
  { chave: 'solicitacao', tipo: 'texto', label: 'Demanda', fixa: true },
  { chave: 'requerente', tipo: 'texto', label: 'Requerente' },
  { chave: 'categoria', tipo: 'texto', label: 'Categoria' },
  { chave: 'material', tipo: 'texto', label: 'Material' },
  { chave: 'prioridade', tipo: 'texto', label: 'Prioridade' },
  { chave: 'status', tipo: 'texto', label: 'Status', fixa: true },
  { chave: 'abertura', tipo: 'data', label: 'Abertura' },
  { chave: 'prazo', tipo: 'data', label: 'Prazo' }
];

const COLUNAS_PADRAO = ['protocolo', 'solicitacao', 'requerente', 'prioridade', 'status'];

// As solicitações já vêm filtradas pela API para esta organização —
// esta função só existe para manter o nome descritivo nos lugares que a
// chamam.
function demandasDoParceiro() {
  return solicitacoes;
}

// Define quais botões de ação (Aceitar/Recusar/Iniciar produção/Concluir)
// aparecem para uma demanda, de acordo com o status atual dela.
function acaoDaDemanda(status) {
  switch (status) {
    case 'Aguardando aceite':
      return [
        { acao: 'aceitar', label: 'Aceitar', classe: 'btn-principal' },
        { acao: 'recusar', label: 'Recusar', classe: 'btn-secundario' }
      ];
    case 'Em análise':
      return [{ acao: 'iniciar-producao', label: 'Iniciar produção', classe: 'btn-principal' }];
    case 'Em produção':
      return [{ acao: 'concluir', label: 'Marcar concluída', classe: 'btn-principal' }];
    default:
      return [];
  }
}

// Executa a transição de status escolhida (Aceitar/Recusar/Iniciar
// produção/Concluir) via PATCH na API — o back-end é quem registra o
// evento correspondente na linha do tempo — e re-renderiza tudo que
// depende da demanda: resumo, tabelas, ações da página de detalhe e o
// próprio detalhe.
async function aplicarAcaoDemanda(protocolo, acao) {
  const mapaStatus = {
    'aceitar': 'Em análise',
    'recusar': 'Recusada',
    'iniciar-producao': 'Em produção',
    'concluir': 'Concluída'
  };
  const novoStatus = mapaStatus[acao];
  if (!novoStatus) return;

  try {
    await api(`/api/solicitacoes/${encodeURIComponent(protocolo)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: novoStatus })
    });
    await carregarSolicitacoes();

    preencherResumoFabricante();
    renderDemandasRecentes();
    renderDemandasFabricante();
    renderAcoesDemandaDetalhe();
    if (typeof renderDetalheSolicitacao === 'function') await renderDetalheSolicitacao();
  } catch (erro) {
    alert(erro.message);
  }
}

// Linha com colunas fixas, usada só na tabela "Demandas recentes" do
// dashboard (a tabela completa usa linhaDemandaTabela, com colunas configuráveis).
function linhaDemandaResumo(s) {
  return `
    <tr>
      <td>${s.protocolo}</td>
      <td>${s.solicitacao}</td>
      <td>${s.requerente}</td>
      <td><span class="badge prioridade-${badgeClass(s.prioridade)}">${s.prioridade}</span></td>
      <td><span class="badge status-${badgeClass(s.status)}">${s.status}</span></td>
      <td class="celula-acoes">
        <a class="btn btn-acao-tabela btn-secundario" href="/html/fabricator/detalhe-demanda.html?protocolo=${encodeURIComponent(s.protocolo)}">Ver detalhes</a>
        ${acaoDaDemanda(s.status).map(a => `<button type="button" class="btn btn-acao-tabela ${a.classe}" data-protocolo="${s.protocolo}" data-acao="${a.acao}">${a.label}</button>`).join('')}
      </td>
    </tr>`;
}

// Liga os botões de ação (data-acao) de uma tabela/lista de demandas.
function ativarAcoesDemanda(container) {
  container.querySelectorAll('[data-acao]').forEach(btn => {
    btn.addEventListener('click', () => aplicarAcaoDemanda(btn.dataset.protocolo, btn.dataset.acao));
  });
}

// Atualiza os cartões numéricos do dashboard do fabricante.
function preencherResumoFabricante() {
  const demandas = demandasDoParceiro();
  const mapa = {
    aceite: demandas.filter(s => s.status === 'Aguardando aceite').length,
    analise: demandas.filter(s => s.status === 'Em análise').length,
    producao: demandas.filter(s => s.status === 'Em produção').length,
    concluidas: demandas.filter(s => s.status === 'Concluída').length
  };
  Object.entries(mapa).forEach(([id, valor]) => {
    const el = document.querySelector(`[data-resumo-fabricante="${id}"]`);
    if (el) el.textContent = valor;
  });
}

// Tabela "Demandas recentes" do dashboard (as 4 últimas deste parceiro).
function renderDemandasRecentes() {
  const tbody = document.querySelector('#tabelaDemandasRecentes tbody');
  if (!tbody) return;
  const demandas = demandasDoParceiro();
  tbody.innerHTML = demandas.length
    ? demandas.slice(0, 4).map(linhaDemandaResumo).join('')
    : '<tr><td colspan="6" class="estado-vazio">Nenhuma demanda atribuída até o momento.</td></tr>';
  ativarAcoesDemanda(tbody);
}

// Card de capacidade produtiva do parceiro logado, no dashboard
// (reaproveita os dados de "parceiros", já carregados por prototipo.js).
function renderCapacidadeParceiro() {
  const bloco = document.querySelector('#capacidadeParceiro');
  if (!bloco) return;
  const p = parceiros.find(item => item.nome === usuarioLogado.organizacao);
  if (!p) return;

  bloco.innerHTML = `
    <div class="parceiro-card-topo">
      <div>
        <p class="eyebrow">Capacidade produtiva</p>
        <h2>${p.nome}</h2>
      </div>
      <span class="badge parceiro-${badgeClass(p.status)}">${p.status}</span>
    </div>
    <p class="parceiro-local">${p.cidade}</p>
    <dl class="parceiro-dados">
      <div><dt>Impressoras</dt><dd>${p.impressoras}</dd></div>
      <div><dt>Em produção</dt><dd>${p.emProducao}</dd></div>
      <div><dt>Tecnologias</dt><dd>${p.tecnologias}</dd></div>
      <div><dt>Materiais</dt><dd>${p.materiais}</dd></div>
    </dl>`;
}


/* =========================
   PÁGINA DE DEMANDAS - COLUNAS CONFIGURÁVEIS
========================= */

// Lê do localStorage quais colunas (além das fixas) o usuário escolheu
// mostrar na tabela de Demandas; usa COLUNAS_PADRAO se nunca escolheu.
function colunasVisiveisSalvas() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_COLUNAS_DEMANDAS));
    if (Array.isArray(salvo) && salvo.length) return salvo;
  } catch (e) { /* ignora e usa o padrão */ }
  return COLUNAS_PADRAO.slice();
}

// Salva a escolha de colunas do usuário para a próxima visita.
function salvarColunasVisiveis(chaves) {
  try { localStorage.setItem(CHAVE_COLUNAS_DEMANDAS, JSON.stringify(chaves)); } catch (e) { /* localStorage indisponível */ }
}

// Lista final de colunas a exibir: as fixas (sempre) + as marcadas pelo usuário.
function colunasAtivas() {
  const salvas = new Set(colunasVisiveisSalvas());
  return COLUNAS_DEMANDAS.filter(c => c.fixa || salvas.has(c.chave));
}

// Conteúdo de uma célula: badge para prioridade/status, texto simples nas demais.
function valorCelula(s, coluna) {
  if (coluna.chave === 'prioridade') return `<span class="badge prioridade-${badgeClass(s.prioridade)}">${s.prioridade}</span>`;
  if (coluna.chave === 'status') return `<span class="badge status-${badgeClass(s.status)}">${s.status}</span>`;
  return s[coluna.chave] ?? '—';
}

// Linha da tabela completa de Demandas, com as colunas configuráveis pelo usuário.
function linhaDemandaTabela(s, colunas) {
  const celulas = colunas.map(c => `<td>${valorCelula(s, c)}</td>`).join('');
  const acoes = acaoDaDemanda(s.status)
    .map(a => `<button type="button" class="btn btn-acao-tabela ${a.classe}" data-protocolo="${s.protocolo}" data-acao="${a.acao}">${a.label}</button>`)
    .join('');

  return `
    <tr>
      ${celulas}
      <td class="celula-acoes">
        <a class="btn btn-acao-tabela btn-secundario" href="/html/fabricator/detalhe-demanda.html?protocolo=${encodeURIComponent(s.protocolo)}">Ver detalhes</a>
        ${acoes}
      </td>
    </tr>`;
}

// Monta o cabeçalho (nomes das colunas) e a linha de filtros avançados
// da tabela de Demandas, de acordo com as colunas ativas no momento.
function renderCabecalhoDemandas() {
  const theadLinha = document.querySelector('#linhaColunasDemandas');
  const linhaFiltros = document.querySelector('#linhaFiltrosDemandas');
  if (!theadLinha || !linhaFiltros) return;

  const colunas = colunasAtivas();
  theadLinha.innerHTML = colunas.map(c => `<th>${c.label}</th>`).join('') + '<th>Ações</th>';
  linhaFiltros.innerHTML = colunas.map(c => `<th>${criarCelulaFiltro(c)}</th>`).join('') + '<th></th>';

  ativarFiltrosAvancados(colunas, renderDemandasFabricante);
}

// Corpo da tabela completa de Demandas, aplicando os filtros avançados ativos.
function renderDemandasFabricante() {
  const tbody = document.querySelector('#tabelaDemandasFabricante tbody');
  if (!tbody) return;

  const colunas = colunasAtivas();
  const demandas = demandasDoParceiro();
  const filtros = lerFiltros(colunas);
  const filtradas = demandas.filter(s => itemCorrespondeFiltros(s, filtros, (item, chave) => item[chave]));

  tbody.innerHTML = filtradas.length
    ? filtradas.map(s => linhaDemandaTabela(s, colunas)).join('')
    : `<tr><td colspan="${colunas.length + 1}" class="estado-vazio">Nenhuma demanda encontrada com os filtros informados.</td></tr>`;

  const contador = document.querySelector('#contadorDemandas');
  if (contador) contador.textContent = `${filtradas.length} de ${demandas.length} demandas`;

  ativarAcoesDemanda(tbody);
}

// Desenha a lista de checkboxes do seletor "Colunas" e liga cada um
// para salvar a escolha e atualizar a tabela assim que é marcado/desmarcado.
function renderPainelColunas() {
  const painel = document.querySelector('#colunasPainel');
  if (!painel) return;
  const visiveis = new Set(colunasVisiveisSalvas());

  painel.innerHTML = COLUNAS_DEMANDAS.map(c => `
    <label class="colunas-painel-item">
      <input type="checkbox" data-coluna-toggle="${c.chave}" ${c.fixa || visiveis.has(c.chave) ? 'checked' : ''} ${c.fixa ? 'disabled' : ''}>
      <span>${c.label}${c.fixa ? ' (fixa)' : ''}</span>
    </label>`).join('');

  painel.querySelectorAll('[data-coluna-toggle]').forEach(input => {
    input.addEventListener('change', () => {
      const ativasNaoFixas = COLUNAS_DEMANDAS.filter(c => !c.fixa).map(c => c.chave)
        .filter(chave => painel.querySelector(`[data-coluna-toggle="${chave}"]`).checked);
      salvarColunasVisiveis(ativasNaoFixas);
      renderCabecalhoDemandas();
      renderDemandasFabricante();
    });
  });
}

// Abre/fecha o painel do botão "Colunas" (clique fora fecha, clique dentro não).
function prepararSeletorColunas() {
  const botao = document.querySelector('#botaoColunas');
  const painelWrap = document.querySelector('#colunasWrap');
  const painel = document.querySelector('#colunasPainel');
  if (!botao || !painel || !painelWrap) return;

  renderPainelColunas();

  botao.addEventListener('click', e => {
    e.stopPropagation();
    painel.hidden = !painel.hidden;
  });
  painel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { painel.hidden = true; });
}


/* =========================
   PÁGINA DE DETALHE DA DEMANDA
========================= */

// Desenha os botões de ação no topo da página de detalhe da demanda
// (equivalente, do lado do fabricante, ao "Editar solicitação" da AACD).
function renderAcoesDemandaDetalhe() {
  const container = document.querySelector('#acoesDemanda');
  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const protocolo = params.get('protocolo');
  const s = solicitacoes.find(item => item.protocolo === protocolo);
  if (!s) return;

  const acoes = acaoDaDemanda(s.status);
  container.innerHTML = acoes.length
    ? acoes.map(a => `<button type="button" class="btn btn-acao ${a.classe}" data-protocolo="${s.protocolo}" data-acao="${a.acao}">${a.label}</button>`).join('')
    : '<p class="texto-detalhe">Nenhuma ação disponível para o status atual.</p>';

  ativarAcoesDemanda(container);
}

// Ponto de entrada: espera prototipo.js terminar de carregar usuário,
// solicitações e parceiros (window.dadosIniciaisProntos) antes de
// renderizar qualquer coisa — cada função abaixo só age se os elementos
// da página atual existirem, então este arquivo pode ser carregado em
// qualquer página da área do fabricante.
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.dadosIniciaisProntos;
  } catch {
    return; // já foi redirecionado para o login.
  }

  preencherResumoFabricante();
  renderDemandasRecentes();
  renderCabecalhoDemandas();
  renderDemandasFabricante();
  renderCapacidadeParceiro();
  renderAcoesDemandaDetalhe();
  prepararSeletorColunas();

  document.querySelector('#limparFiltrosFabricante')?.addEventListener('click', () => {
    limparFiltrosAvancados(colunasAtivas());
    renderDemandasFabricante();
  });
});
