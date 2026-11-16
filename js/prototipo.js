/*
   Área autenticada da organização solicitante (painel do solicitante).
   Diferente da versão anterior deste arquivo, os dados aqui vêm de uma
   API real (ver js/api.js e docs/backend.md — seção "Solicitações,
   demandas, parceiros e histórico"), não de arrays fixos no código.

   js/fabricator.js reaproveita as funções definidas aqui (badgeClass,
   textoAtribuidos, carregarSolicitacoes, etc.) para a área do fabricante/
   parceiro de manufatura.

   Como toda página autenticada depende de uma sessão válida, qualquer
   chamada à API que volte 401 redireciona para o login — ver
   `carregarUsuarioAtual()` e `exigirSessao()`.
*/

// Estado em memória desta página: preenchido por carregarDadosIniciais()
// e atualizado conforme o usuário cria/edita solicitações ou troca o
// status de uma demanda. Os demais arquivos (fabricator.js) leem essas
// mesmas variáveis.
let usuarioLogado = null;
let solicitacoes = [];
let parceiros = [];

// Parceiro que assumiu a solicitação. Vazio = ainda na fila global,
// esperando um fabricante aceitar. (Aceita string ou lista por
// compatibilidade com respostas antigas.)
function textoAtribuidos(valor) {
  const texto = Array.isArray(valor) ? valor.join(', ') : (valor || '');
  return texto || 'Aguardando parceiro';
}

// Converte um valor (ex.: "Em análise") no sufixo de classe CSS do
// badge correspondente (ex.: "em-analise"), removendo acentos.
function badgeClass(valor) {
  return String(valor).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Recolhe uma descrição longa até uma altura razoável, com botão "Ver mais"
// (só aparece quando o texto realmente ultrapassa essa altura).
function ativarDescricaoColapsavel(el) {
  el.classList.add('texto-colapsavel');
  requestAnimationFrame(() => {
    if (el.scrollHeight <= el.clientHeight + 2) { el.classList.remove('texto-colapsavel'); return; }
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-ver-mais';
    botao.textContent = 'Ver descrição completa';
    botao.addEventListener('click', () => {
      const expandida = el.classList.toggle('expandida');
      botao.textContent = expandida ? 'Mostrar menos' : 'Ver descrição completa';
    });
    el.after(botao);
  });
}

// Formata um tamanho em bytes como "123 KB" ou "4,2 MB".
function formatarTamanhoArquivo(bytes) {
  if (!bytes) return 'Tamanho não informado';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

// Extrai nome/tamanho/formato de um File escolhido em um input[type=file].
function metadadosArquivo(file) {
  if (!file || !file.name) return null;
  const ext = file.name.split('.').pop()?.toUpperCase() || '3D';
  return { nome: file.name, tamanho: formatarTamanhoArquivo(file.size), formato: ext };
}


/* =========================
   CARREGAMENTO DE DADOS (API)
========================= */

// Busca o usuário autenticado. Se não houver sessão válida, manda para
// o login — nenhuma página deste painel faz sentido sem estar logado.
async function carregarUsuarioAtual() {
  try {
    const { user, memberships = [] } = await api('/api/me');
    usuarioLogado = {
      id: user.id,
      nome: `${user.nome} ${user.sobrenome}`.trim(),
      organizacao: user.organizacao || '',
      foto: user.foto || '',
      memberships
    };
    atualizarIdentidadeNav(usuarioLogado);
    adicionarLinkAdministracao(memberships);
  } catch {
    location.href = '/html/login.html';
    throw new Error('Sessão inválida, redirecionando para o login.');
  }
}

// Reflete nome/organização do usuário logado no cabeçalho (botão de
// perfil e menu), nos lugares em que essa informação aparece estática
// no HTML.
function atualizarIdentidadeNav(usuario) {
  document.querySelectorAll('.nav-identidade, .perfil-menu-identidade').forEach(bloco => {
    const nome = bloco.querySelector('strong');
    const org = bloco.querySelector('small, span');
    if (nome) nome.textContent = usuario.nome;
    if (org) org.textContent = usuario.organizacao;
  });
  document.querySelectorAll('.perfil-name').forEach(el => { el.textContent = usuario.nome; });
  document.querySelectorAll('.perfil-org').forEach(el => { if (usuario.organizacao) el.textContent = usuario.organizacao; });
  if (usuario.foto) {
    document.querySelectorAll('.nav-perfil img').forEach(img => { img.src = usuario.foto; });
  }
}

// Se o usuário for administrador ativo de alguma organização, adiciona
// o atalho "Administração" no menu de perfil (antes de "Sair").
function adicionarLinkAdministracao(memberships) {
  if (!usuarioAdministra(memberships)) return;
  document.querySelectorAll('.perfil-menu').forEach(menu => {
    if (menu.querySelector('.perfil-menu-admin')) return;
    const link = document.createElement('a');
    link.href = '/html/admin.html';
    link.className = 'perfil-menu-item perfil-menu-admin';
    link.textContent = 'Administração';
    menu.insertBefore(link, menu.querySelector('.perfil-sair'));
  });
}

// true se algum vínculo for de administrador ativo.
function usuarioAdministra(memberships) {
  return (memberships || []).some(m => m.role === 'admin' && m.membership_status === 'active');
}

// Busca a lista de solicitações visíveis para a organização autenticada
// (a própria API decide o que cada organização pode ver).
async function carregarSolicitacoes() {
  solicitacoes = await api('/api/solicitacoes');
}

// Busca os parceiros de manufatura credenciados.
async function carregarParceiros() {
  parceiros = await api('/api/parceiros');
}

// Busca uma única solicitação pelo protocolo (usado na página de
// detalhes, que não depende da lista completa já estar carregada).
async function buscarSolicitacao(protocolo) {
  return api(`/api/solicitacoes/${encodeURIComponent(protocolo)}`);
}

// Busca a linha do tempo de uma solicitação.
async function buscarHistorico(protocolo) {
  return api(`/api/solicitacoes/${encodeURIComponent(protocolo)}/historico`);
}


/* =========================
   FILTROS DA TABELA DE SOLICITAÇÕES
========================= */

// Colunas filtráveis da tabela de Solicitações (ver js/filtros.js).
const COLUNAS_SOLICITACOES = [
  { chave: 'protocolo', tipo: 'texto', label: 'Protocolo' },
  { chave: 'solicitacao', tipo: 'texto', label: 'Solicitação' },
  { chave: 'requerente', tipo: 'texto', label: 'Requerente' },
  { chave: 'atribuido', tipo: 'texto', label: 'Parceiro' },
  { chave: 'prioridade', tipo: 'texto', label: 'Prioridade' },
  { chave: 'status', tipo: 'texto', label: 'Status' }
];

// Lê o valor de uma solicitação pela chave da coluna, tratando o caso
// especial de "atribuido" (lista) exigido pelo motor de filtros.
function extratorSolicitacao(item, chave) {
  return chave === 'atribuido' ? textoAtribuidos(item.atribuido) : item[chave];
}

// Desenha a linha de filtros avançados da tabela de Solicitações.
function renderFiltrosSolicitacoes() {
  const linha = document.querySelector('#linhaFiltrosSolicitacoes');
  if (!linha) return;
  linha.innerHTML = COLUNAS_SOLICITACOES.map(c => `<th>${criarCelulaFiltro(c)}</th>`).join('');
  ativarFiltrosAvancados(COLUNAS_SOLICITACOES, renderTabelaSolicitacoes);
}


/* =========================
   DASHBOARD E LISTAGEM
========================= */

// Atualiza os cartões numéricos do dashboard (abertas/análise/produção/concluídas).
function preencherResumo() {
  const abertas = solicitacoes.filter(s => s.status !== 'Concluída').length;
  const analise = solicitacoes.filter(s => s.status === 'Em análise').length;
  const producao = solicitacoes.filter(s => s.status === 'Em produção').length;
  const concluidas = solicitacoes.filter(s => s.status === 'Concluída').length;
  const retirada = solicitacoes.filter(s => s.status === 'Pronta para retirada').length;
  const mapa = { abertas, analise, producao, retirada, concluidas };
  Object.entries(mapa).forEach(([id, valor]) => {
    const el = document.querySelector(`[data-resumo="${id}"]`);
    if (el) el.textContent = valor;
  });
}

// Gera o HTML de uma linha da tabela (dashboard e listagem completa).
function linhaSolicitacao(s) {
  return `
    <tr class="linha-clicavel" tabindex="0" data-protocolo="${s.protocolo}" aria-label="Abrir detalhes da solicitação ${s.protocolo}">
      <td>${s.protocolo}</td>
      <td>${s.solicitacao}</td>
      <td>${s.requerente}</td>
      <td>${textoAtribuidos(s.atribuido)}</td>
      <td><span class="badge prioridade-${badgeClass(s.prioridade)}">${s.prioridade}</span></td>
      <td><span class="badge status-${badgeClass(s.status)}">${s.status}</span></td>
    </tr>`;
}

// Tabela "Solicitações recentes" do dashboard (as 4 últimas, sem filtro).
function renderTabelaInicio() {
  const tbody = document.querySelector('#tabelaRecentes tbody');
  if (!tbody) return;
  const emAndamento = solicitacoes.filter(s => s.status !== 'Concluída');
  tbody.innerHTML = emAndamento.length
    ? emAndamento.slice(0, 4).map(linhaSolicitacao).join('')
    : '<tr><td colspan="6" class="estado-vazio">Nenhuma solicitação em andamento. As concluídas ficam em <a href="/html/client/relatorios.html">Relatórios</a>.</td></tr>';
  ativarLinhasClicaveis(tbody);
}

// Tabela completa da página "Solicitações", já aplicando os filtros ativos.
function renderTabelaSolicitacoes() {
  const tbody = document.querySelector('#tabelaSolicitacoes tbody');
  if (!tbody) return;

  const filtros = lerFiltros(COLUNAS_SOLICITACOES);
  // Concluídas saem desta lista e ficam em Relatórios (html/client/relatorios.html).
  const emAndamento = solicitacoes.filter(s => s.status !== 'Concluída');
  const filtradas = emAndamento.filter(s => itemCorrespondeFiltros(s, filtros, extratorSolicitacao));

  tbody.innerHTML = filtradas.length
    ? filtradas.map(linhaSolicitacao).join('')
    : '<tr><td colspan="6" class="estado-vazio">Nenhuma solicitação encontrada com os filtros informados.</td></tr>';

  const contador = document.querySelector('#contadorSolicitacoes');
  if (contador) contador.textContent = `${filtradas.length} de ${emAndamento.length} solicitações em andamento`;
  ativarLinhasClicaveis(tbody);
}

// Torna cada linha de solicitação clicável (mouse e teclado), levando
// para a página de detalhes do protocolo correspondente.
function ativarLinhasClicaveis(container) {
  container.querySelectorAll('.linha-clicavel').forEach(linha => {
    const abrir = () => {
      const protocolo = linha.dataset.protocolo;
      window.location.href = `/html/client/detalhes-solicitacao.html?protocolo=${encodeURIComponent(protocolo)}`;
    };

    linha.addEventListener('click', abrir);
    linha.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrir();
      }
    });
  });
}


/* =========================
   PÁGINA DE DETALHES
========================= */

// Preenche toda a página de detalhes (solicitante ou fabricante) a partir do
// protocolo na URL: dados gerais, fluxo de status, linha do tempo e
// anexo. Reaproveitada pelas duas áreas do site.
async function renderDetalheSolicitacao() {
  const pagina = document.querySelector('#paginaDetalheSolicitacao');
  if (!pagina) return;

  const params = new URLSearchParams(window.location.search);
  const protocolo = params.get('protocolo');
  if (!protocolo) return;

  let s, eventos;
  try {
    [s, eventos] = await Promise.all([buscarSolicitacao(protocolo), buscarHistorico(protocolo)]);
  } catch (erro) {
    pagina.innerHTML = `<p class="estado-vazio">Não foi possível carregar esta solicitação: ${erro.message}</p>`;
    return;
  }

  document.title = `${s.protocolo} - ${s.solicitacao} | LABIELOS`;
  document.querySelectorAll('[data-detalhe]').forEach(el => {
    const campo = el.dataset.detalhe;
    if (campo === 'prioridade' || campo === 'status') {
      el.innerHTML = `<span class="badge ${campo}-${badgeClass(s[campo])}">${s[campo]}</span>`;
    } else if (campo === 'atribuido') {
      el.textContent = textoAtribuidos(s.atribuido);
    } else if (s[campo] !== undefined) {
      el.textContent = s[campo];
    }
  });

  const descricaoEl = document.querySelector('[data-detalhe="descricao"]');
  if (descricaoEl) ativarDescricaoColapsavel(descricaoEl);

  // Fluxo: a linha é preenchida até a bolinha da etapa atual (--progresso
  // vai de 0 a 1) e as etapas anteriores ficam com ✓. Em "Concluída" o
  // fluxo inteiro fica concluído. Status fora da sequência (ex.: legado
  // "Aguardando aceite") contam como a primeira etapa.
  const etapas = etapasDe(s);
  const indiceAtual = Math.max(0, etapas.indexOf(s.status));
  const finalizada = s.status === 'Concluída';
  const fluxo = document.querySelector('#fluxoSolicitacao');
  if (fluxo) {
    fluxo.style.setProperty('--etapas', String(etapas.length));
    fluxo.style.setProperty('--progresso', String(indiceAtual / (etapas.length - 1)));
    fluxo.innerHTML = etapas.map((etapa, i) => {
      const feita = i < indiceAtual || finalizada;
      const classe = feita ? 'concluida' : i === indiceAtual ? 'atual' : '';
      return `<li class="fluxo-etapa ${classe}"${i === indiceAtual ? ' aria-current="step"' : ''}><span class="fluxo-ponto">${feita ? '✓' : i + 1}</span><span>${etapa}</span></li>`;
    }).join('');
    // Reinicia a animação quando o status muda sem recarregar a página.
    fluxo.classList.remove('animar');
    void fluxo.offsetWidth;
    fluxo.classList.add('animar');
  }

  const lista = document.querySelector('#timelineSolicitacao');
  if (lista) {
    lista.innerHTML = (eventos || []).slice().reverse().map(evento => `
      <article class="timeline-item">
        <div class="timeline-marcador"></div>
        <div class="timeline-conteudo">
          <div class="timeline-topo">
            <div><span class="timeline-tipo">${evento.tipo}</span><h3>${evento.titulo}</h3></div>
            <time>${evento.data}</time>
          </div>
          <p>${evento.descricao}</p>
          <span class="timeline-autor">Por ${evento.autor}</span>
        </div>
      </article>`).join('');
  }

  const anexo = document.querySelector('#anexoSolicitacao');
  if (anexo) {
    if (s.arquivo3d) {
      const arquivo = { ...s.arquivo3d, url: urlArquivo3d(s) };
      anexo.innerHTML = `
        <div class="anexo-icone" aria-hidden="true">3D</div>
        <div class="anexo-info"><strong title="${escaparHTML(arquivo.nome)}">${escaparHTML(arquivo.nome)}</strong><span>${escaparHTML(arquivo.formato)} · ${escaparHTML(arquivo.tamanho)}</span></div>
        <div class="anexo-acoes">
          <button type="button" class="btn btn-principal btn-anexo btn-visualizar-arquivo">Visualizar 3D</button>
          <a class="btn btn-secundario btn-anexo" href="${escaparHTML(arquivo.url)}" download="${escaparHTML(arquivo.nome)}">Baixar</a>
        </div>`;
      anexo.querySelector('.btn-visualizar-arquivo')?.addEventListener('click', () => abrirVisualizadorArquivo(arquivo));
    } else {
      anexo.innerHTML = '<p class="texto-detalhe">Nenhum arquivo 3D anexado.</p>';
    }
  }

  renderRetiradaEAjuste(s);
  renderAcoesSolicitante(s);
  prepararEdicaoSolicitacao(s);
  prepararRegistroTimeline();
}

// Ordem do fluxo de uma solicitação (também usada pelo resumo dos painéis).
//   Aberta → Em análise → Em produção → Pronta para retirada → Concluída
// "Pronta para retirada": o parceiro concluiu a produção e informou o local
// de retirada; a organização solicitante retira, testa e então aprova
// (Concluída) ou devolve para ajuste (volta para Em produção).
const ETAPAS_FLUXO = ['Aberta', 'Em análise', 'Em produção', 'Pronta para retirada', 'Concluída'];

// Quando o material é fornecido pelo solicitante, entra a etapa
// "Aguardando material" entre a análise e a produção.
function etapasDe(s) {
  const comEntrega = s.status === 'Aguardando material' || s.producao?.material?.origem === 'solicitante';
  return comEntrega ? ['Aberta', 'Em análise', 'Aguardando material', 'Em produção', 'Pronta para retirada', 'Concluída'] : ETAPAS_FLUXO;
}

function textoEtapa(s) {
  const etapas = etapasDe(s);
  return `Etapa ${etapas.indexOf(s.status) + 1} de ${etapas.length} · ${s.status}`;
}

// Cartão "Produção": impressora usada e de onde veio o material.
function renderProducao(s) {
  const cartao = document.querySelector('#producaoSolicitacao');
  if (!cartao) return;
  const p = s.producao;
  cartao.hidden = !p;
  if (!p) return;
  const m = p.material || {};
  const origem = m.origem === 'doacao' ? 'Doado pelo parceiro' : 'Fornecido pelo solicitante';
  const entrega = m.origem === 'solicitante'
    ? (m.recebido_em ? `Recebido em ${m.recebido_em}` : (m.entrega ? `Entregar em ${m.entrega.local}: ${m.entrega.endereco}` : ''))
    : '';
  cartao.querySelector('[data-producao="conteudo"]').innerHTML = `
    <dl class="retirada-dados">
      ${p.impressora ? `<div><dt>Impressora</dt><dd>${escaparHTML(p.impressora.nome)} · ${escaparHTML([p.impressora.modelo, p.impressora.tecnologia].filter(Boolean).join(' · '))}</dd></div>` : ''}
      <div><dt>Material</dt><dd>${escaparHTML(m.nome || m.especificacao || '—')}${m.quantidade_usada ? ` · ${String(m.quantidade_usada).replace('.', ',')} ${escaparHTML(m.unidade || '')} usados` : ''}</dd></div>
      <div><dt>Origem do material</dt><dd><span class="badge origem-${m.origem === 'doacao' ? 'doacao' : 'solicitante'}">${origem}</span></dd></div>
      ${entrega ? `<div><dt>Entrega do material</dt><dd>${escaparHTML(entrega)}</dd></div>` : ''}
    </dl>`;
}

// Cartão "Retirada" (local e instruções) e aviso de "Devolvida para ajuste".
function renderRetiradaEAjuste(s) {
  renderProducao(s);
  const cartao = document.querySelector('#retiradaSolicitacao');
  if (cartao) {
    const r = s.retirada;
    cartao.hidden = !r;
    if (r) {
      cartao.querySelector('[data-retirada="conteudo"]').innerHTML = `
        <dl class="retirada-dados">
          <div><dt>Local</dt><dd>${escaparHTML(r.local)} · ${escaparHTML(r.parceiro || '')}</dd></div>
          <div><dt>Endereço</dt><dd>${escaparHTML(r.endereco)}</dd></div>
          ${r.instrucoes ? `<div><dt>Instruções</dt><dd>${escaparHTML(r.instrucoes)}</dd></div>` : ''}
          ${r.telefone ? `<div><dt>Contato</dt><dd>${escaparHTML(r.telefone)}</dd></div>` : ''}
        </dl>
        <a class="btn btn-secundario btn-sm" target="_blank" rel="noopener"
           href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.endereco)}">Abrir no mapa</a>`;
    }
  }
  const aviso = document.querySelector('#ajusteSolicitacao');
  if (aviso) {
    const a = s.status === 'Em produção' ? s.ajuste : null;
    aviso.hidden = !a;
    if (a) {
      aviso.innerHTML = `<strong>Devolvida para ajuste em ${escaparHTML(a.data)}</strong>
        <p>${escaparHTML(a.motivo)}</p><span>Por ${escaparHTML(a.autor)}</span>`;
    }
  }
}

// Faixa "Próxima etapa" (as duas páginas de detalhe): diz em que etapa a
// solicitação está, o que acontece agora e mostra os botões da etapa.
// `tom`: "acao" quando é a vez de quem está vendo agir, "info" quando é
// só para acompanhar, "fim" quando acabou.
function renderBarraEtapa(container, { etapa, titulo, texto, botoes = '', tom = 'info' }) {
  container.hidden = false;
  container.className = `barra-etapa barra-etapa-${tom}`;
  container.innerHTML = `
    <div class="barra-etapa-texto">
      <p class="eyebrow">${escaparHTML(etapa)}</p>
      <strong>${escaparHTML(titulo)}</strong>
      <p>${texto}</p>
    </div>
    ${botoes ? `<div class="barra-etapa-botoes">${botoes}</div>` : ''}`;
}

// Mensagem de retorno de uma ação, acima da faixa (some ao trocar de página).
function avisoDetalhe(seletor, texto, erro = false) {
  const el = document.querySelector(seletor);
  if (!el) return;
  el.textContent = texto;
  el.classList.toggle('mensagem-erro', erro);
}

// Solicitante: acompanha as etapas e, com a peça "Pronta para retirada",
// aprova (conclui) ou devolve para ajuste informando o motivo.
function renderAcoesSolicitante(s) {
  const area = document.querySelector('#acoesSolicitante');
  if (!area) return;
  const etapa = textoEtapa(s);
  const parceiro = s.atribuido ? escaparHTML(s.atribuido) : 'o parceiro';
  const estados = {
    'Aberta': { titulo: 'Aguardando um parceiro', texto: 'A solicitação está na fila de novas solicitações, visível para todos os parceiros de manufatura. Você será avisado no histórico quando alguém aceitar.' },
    'Aguardando material': { tom: 'acao', titulo: 'Entregue o material ao parceiro',
      texto: `${parceiro} vai produzir com material fornecido por vocês. Entregue <strong>${escaparHTML(s.producao?.material?.especificacao || 'o material combinado')}</strong> em <strong>${escaparHTML(s.producao?.material?.entrega?.local || '')}</strong>: ${escaparHTML(s.producao?.material?.entrega?.endereco || '')}. A produção começa quando o parceiro confirmar o recebimento.` },
    'Em análise': { titulo: `${parceiro} está analisando`, texto: 'O parceiro aceitou e está avaliando a descrição e os arquivos. Use o histórico abaixo para tirar dúvidas ou enviar arquivos.' },
    'Em produção': { titulo: s.ajuste ? 'Em ajuste pelo parceiro' : 'A peça está sendo produzida', texto: s.ajuste ? 'O parceiro está ajustando a peça conforme o motivo da devolução. Quando terminar, você recebe o novo aviso de retirada.' : `${parceiro} está produzindo a peça. Quando terminar, o local de retirada aparece aqui e no histórico.` },
    'Pronta para retirada': { tom: 'acao', titulo: 'A peça está pronta para retirada', texto: 'Retire no local indicado ao lado e faça os testes. Depois, aprove para concluir ou devolva para ajuste dizendo o que precisa mudar.',
      botoes: `<button type="button" class="btn btn-secundario btn-acao" data-avaliar="reprovar">Devolver para ajuste</button>
               <button type="button" class="btn btn-principal btn-acao" data-avaliar="aprovar">Aprovar peça</button>` },
    'Concluída': { tom: 'fim', titulo: 'Solicitação concluída', texto: 'A peça foi testada e aprovada. Obrigado por usar a rede LABIELOS!' }
  };
  renderBarraEtapa(area, { etapa, ...(estados[s.status] || { titulo: s.status, texto: '' }) });
  if (s.status !== 'Pronta para retirada') return;

  const url = `/api/solicitacoes/${encodeURIComponent(s.protocolo)}`;
  area.querySelector('[data-avaliar="aprovar"]').addEventListener('click', () => abrirModalAcao({
    eyebrow: s.protocolo,
    titulo: 'Aprovar peça',
    corpo: '<p>Confirme que a peça foi retirada e testada e atende ao que foi solicitado. A solicitação será <strong>concluída</strong>.</p>',
    confirmar: 'Aprovar e concluir',
    aoConfirmar: async () => { await api(`${url}/aprovar`, { method: 'POST' }); }
  }).then(async ok => {
    if (!ok) return;
    avisoDetalhe('#mensagemSolicitante', `Peça aprovada. A solicitação ${s.protocolo} foi concluída.`);
    await renderDetalheSolicitacao();
    setTimeout(() => location.reload(), 700);
  }));
  area.querySelector('[data-avaliar="reprovar"]').addEventListener('click', () => abrirModalAcao({
    eyebrow: s.protocolo,
    titulo: 'Devolver para ajuste',
    corpo: `<p>A demanda volta para o parceiro, em produção, com o motivo registrado no histórico.</p>
      <div class="campo"><label for="motivoDevolucao">Motivo da devolução *</label>
      <textarea id="motivoDevolucao" name="motivo" required minlength="10" maxlength="1000" rows="4"
        placeholder="Ex.: o encaixe do punho ficou apertado; aumentar 5 mm na circunferência."></textarea></div>`,
    confirmar: 'Devolver para ajuste',
    aoConfirmar: async form => {
      const motivo = form.elements.motivo.value.trim();
      if (motivo.length < 10) throw new Error('Descreva o motivo da devolução (pelo menos 10 caracteres).');
      await api(`${url}/reprovar`, { method: 'POST', body: JSON.stringify({ motivo }) });
    }
  }).then(async ok => {
    if (!ok) return;
    avisoDetalhe('#mensagemSolicitante', `Solicitação ${s.protocolo} devolvida para ajuste. O parceiro vê o motivo no topo da demanda.`);
    await renderDetalheSolicitacao();
    setTimeout(() => location.reload(), 700);
  }));
}

// Modal de confirmação reutilizável (um <dialog> criado sob demanda).
// `corpo` é HTML com os campos; `aoConfirmar(form)` faz a chamada à API e,
// se lançar erro, a mensagem aparece no próprio modal. Resolve true quando
// a ação foi feita e false quando o usuário cancela.
function abrirModalAcao({ eyebrow = '', titulo, corpo, confirmar = 'Confirmar', aoConfirmar, preparar }) {
  let dialog = document.querySelector('#modalAcao');
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'modal modal-acao';
    dialog.id = 'modalAcao';
    dialog.setAttribute('aria-labelledby', 'tituloModalAcao');
    document.body.appendChild(dialog);
  }
  dialog.innerHTML = `
    <header class="modal-cabecalho">
      <div><p>${escaparHTML(eyebrow)}</p><h2 id="tituloModalAcao">${escaparHTML(titulo)}</h2></div>
      <button class="modal-fechar" type="button" data-cancelar aria-label="Fechar">×</button>
    </header>
    <form method="dialog" novalidate>
      <div class="modal-corpo">${corpo}<p class="erro-campo modal-acao-erro" role="alert"></p></div>
      <footer class="modal-acoes">
        <button type="button" class="btn btn-secundario btn-acao" data-cancelar>Cancelar</button>
        <button type="submit" class="btn btn-principal btn-acao">${escaparHTML(confirmar)}</button>
      </footer>
    </form>`;
  const form = dialog.querySelector('form');
  const erro = dialog.querySelector('.modal-acao-erro');
  const enviar = dialog.querySelector('[type="submit"]');
  preparar?.(form, enviar);

  return new Promise(resolve => {
    let feito = false;
    dialog.querySelectorAll('[data-cancelar]').forEach(b => b.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => resolve(feito), { once: true });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      enviar.disabled = true;
      erro.textContent = '';
      try {
        await aoConfirmar(form);
        feito = true;
        dialog.close();
      } catch (falha) {
        erro.textContent = falha.message;
      } finally {
        enviar.disabled = false;
      }
    });
    dialog.showModal();
  });
}

// Endereço de download do arquivo 3D: a API manda `arquivo3d.url`; se não
// mandar, usa a rota padrão GET /api/solicitacoes/{protocolo}/arquivo3d.
function urlArquivo3d(s) {
  return s.arquivo3d?.url || `/api/solicitacoes/${encodeURIComponent(s.protocolo)}/arquivo3d`;
}

// Abre o modal do visualizador 3D (three.js, em js/visualizador-3d.js).
// O módulo e o arquivo só são baixados aqui, ao clicar em "Visualizar".
let visualizador3d = null;
async function abrirVisualizadorArquivo(arquivo) {
  const modal = document.querySelector('#modalVisualizarArquivo');
  if (!modal || !arquivo) return;
  const $v = nome => modal.querySelector(`[data-viewer="${nome}"]`);
  const formato = String(arquivo.formato || arquivo.nome.split('.').pop()).toUpperCase();

  $v('nome').textContent = arquivo.nome;
  $v('nome-info').textContent = arquivo.nome;
  $v('meta').textContent = `${formato} · ${arquivo.tamanho}`;
  $v('baixar').href = arquivo.url;
  $v('baixar').setAttribute('download', arquivo.nome);
  $v('dados').hidden = true;
  $v('ferramentas').hidden = true;
  $v('dica').hidden = true;
  $v('malha').setAttribute('aria-pressed', 'false');
  const estado = $v('estado');
  const mostrarEstado = (texto, erro = false) => {
    estado.hidden = !texto;
    estado.textContent = texto;
    estado.classList.toggle('viewer-erro', erro);
  };

  if (!modal.dataset.viewerPreparado) {
    modal.dataset.viewerPreparado = 'true';
    modal.addEventListener('close', () => { visualizador3d?.destruir(); visualizador3d = null; });
    $v('reenquadrar').addEventListener('click', () => visualizador3d?.reenquadrar());
    $v('malha').addEventListener('click', e => {
      if (visualizador3d) e.currentTarget.setAttribute('aria-pressed', String(visualizador3d.alternarMalha()));
    });
  }

  visualizador3d?.destruir();
  visualizador3d = null;
  modal.showModal();

  if (!['STL', 'OBJ', '3MF'].includes(formato)) {
    mostrarEstado(`A pré-visualização não abre arquivos ${formato} (formato CAD). Baixe o arquivo para abrir no seu software de modelagem.`);
    return;
  }

  mostrarEstado('Carregando modelo…');
  try {
    const [modulo, buffer] = await Promise.all([
      import('/js/visualizador-3d.js').catch(() => {
        throw new Error('Não foi possível carregar o visualizador 3D. Verifique sua conexão com a internet e tente de novo.');
      }),
      fetch(arquivo.url, { credentials: 'same-origin' }).then(r => {
        if (!r.ok) throw new Error(r.status === 404 ? 'O arquivo não está disponível no servidor.' : `Não foi possível baixar o arquivo (erro ${r.status}).`);
        return r.arrayBuffer();
      })
    ]);
    if (!modal.open) return; // fechou enquanto carregava
    visualizador3d = modulo.criarVisualizador($v('area'));
    const info = visualizador3d.carregar(buffer, formato);
    const mm = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    $v('dimensoes').textContent = `${mm(info.dimensoes.x)} × ${mm(info.dimensoes.y)} × ${mm(info.dimensoes.z)} mm`;
    $v('triangulos').textContent = info.triangulos.toLocaleString('pt-BR');
    $v('dados').hidden = false;
    $v('ferramentas').hidden = false;
    $v('dica').hidden = false;
    mostrarEstado('');
  } catch (erro) {
    visualizador3d?.destruir();
    visualizador3d = null;
    mostrarEstado(erro.message.startsWith('Não') || erro.message.startsWith('O arquivo')
      ? erro.message
      : 'Não foi possível abrir este arquivo. Ele pode estar corrompido ou em um formato inesperado; tente baixá-lo.', true);
  }
}

// Liga o formulário "Adicionar registro" da página de detalhes: ao
// enviar, cria um novo item na linha do tempo (comentário ou anexo) via
// API, no estilo de um sistema de chamados (ex.: GLPI).
function prepararRegistroTimeline() {
  const form = document.querySelector('#formRegistroTimeline');
  if (!form || form.dataset.configurado) return;
  form.dataset.configurado = 'true';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);
    const protocolo = params.get('protocolo');
    const dados = new FormData(form);
    // Sem seletor de tipo: com arquivo é "Anexo", sem arquivo é "Comentário".
    const tipo = form.elements.arquivo?.files[0] ? 'Anexo' : 'Comentário';
    const mensagem = dados.get('mensagem')?.trim();
    const arquivo = form.elements.arquivo?.files[0];
    if (!mensagem && !arquivo) return;

    try {
      const corpo = arquivo
        ? (() => { const fd = new FormData(); fd.append('tipo', tipo); fd.append('mensagem', mensagem || ''); fd.append('arquivo', arquivo); return fd; })()
        : JSON.stringify({ tipo, mensagem });
      await api(`/api/solicitacoes/${encodeURIComponent(protocolo)}/historico`, { method: 'POST', body: corpo });
      form.reset();
      await renderDetalheSolicitacao();
    } catch (erro) {
      alert(erro.message);
    }
  });
}

// Escapa texto vindo da API antes de interpolar em innerHTML.
function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Liga o modal "Editar solicitação" (só existe na área da organização solicitante): abre
// preenchido com os dados atuais e, ao salvar, envia as mudanças para a
// API (PATCH) e recarrega a página de detalhes. Parceiro e status não
// são editáveis aqui: o parceiro vem do aceite na fila global e o status
// é conduzido por ele.
function prepararEdicaoSolicitacao(s) {
  const modal = document.querySelector('#modalEditarSolicitacao');
  const form = document.querySelector('#formEditarSolicitacao');
  const btn = document.querySelector('#btnEditarSolicitacao');
  if (!modal || !form || !btn) return;

  const preencher = () => {
    form.elements.solicitacao.value = s.solicitacao;
    form.elements.requerente.value = s.requerente;
    form.elements.prioridade.value = s.prioridade;
    form.elements.categoria.value = s.categoria;
    form.elements.prazo.value = /^\d{2}\/\d{2}\/\d{4}$/.test(s.prazo || '') ? s.prazo.split('/').reverse().join('-') : '';
    form.elements.material.value = s.material === 'A definir' ? '' : s.material;
    form.elements.descricao.value = s.descricao;
  };

  if (!btn.dataset.configurado) {
    btn.dataset.configurado = 'true';
    btn.addEventListener('click', () => { preencher(); modal.showModal(); });
  }

  if (!form.dataset.configurado) {
    form.dataset.configurado = 'true';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const dados = new FormData(form);
      const arquivo = form.elements.arquivo3d.files[0];

      const campos = {
        solicitacao: dados.get('solicitacao'),
        prioridade: dados.get('prioridade'),
        categoria: dados.get('categoria'),
        prazo: dados.get('prazo') ? dados.get('prazo').split('-').reverse().join('/') : 'A definir',
        material: dados.get('material') || 'A definir',
        descricao: dados.get('descricao')
      };

      try {
        let corpo;
        if (arquivo) {
          corpo = new FormData();
          Object.entries(campos).forEach(([chave, valor]) => {
            corpo.append(chave, Array.isArray(valor) ? JSON.stringify(valor) : valor);
          });
          corpo.append('arquivo3d', arquivo);
        } else {
          corpo = JSON.stringify(campos);
        }
        await api(`/api/solicitacoes/${encodeURIComponent(s.protocolo)}`, { method: 'PATCH', body: corpo });
        modal.close();
        await renderDetalheSolicitacao();
        setTimeout(() => location.reload(), 700);
      } catch (erro) {
        alert(erro.message);
      }
    });
  }
}


/* =========================
   MODAIS GENÉRICOS
========================= */

// Comportamento genérico de todos os <dialog class="modal">: fechar
// pelo "×" e pelo clique fora. O modal "Nova solicitação" (assistente em
// 4 etapas) tem lógica própria em js/nova-solicitacao.js e marca
// data-fechar-fora="false" para não perder o preenchimento num clique
// acidental fora da caixa.
function prepararModais() {
  document.querySelectorAll('[data-fechar-modal]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });

  document.querySelectorAll('dialog.modal').forEach(dialog => {
    if (dialog.dataset.fecharFora === 'false') return;
    dialog.addEventListener('click', e => {
      const rect = dialog.getBoundingClientRect();
      const fora = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      if (fora) dialog.close();
    });
  });
}


/* =========================
   PARCEIROS
========================= */

// Página "Parceiros de manufatura" (organização solicitante). Tudo vem de
// GET /api/parceiros: disponibilidade calculada pelas impressoras, a lista
// de impressoras, os materiais para doação, os locais de retirada, o
// contato e quantas solicitações de vocês o parceiro já concluiu.
function renderParceiros() {
  const grid = document.querySelector('#gridParceiros');
  if (!grid) return;

  const selTec = document.querySelector('#filtroTecnologiaParceiro');
  if (selTec && selTec.options.length === 1) {
    const tecs = [...new Set(parceiros.flatMap(p => String(p.tecnologias || '').split(',').map(t => t.trim())).filter(t => t && t !== '—'))].sort();
    tecs.forEach(t => selTec.insertAdjacentHTML('beforeend', `<option>${escaparHTML(t)}</option>`));
    ['#buscaParceiro', '#filtroTecnologiaParceiro', '#soLivres', '#soDoacao'].forEach(sel =>
      document.querySelector(sel).addEventListener(sel === '#buscaParceiro' ? 'input' : 'change', renderParceiros));
  }

  const busca = (document.querySelector('#buscaParceiro')?.value || '').trim().toLowerCase();
  const tec = selTec?.value || '';
  const soLivres = document.querySelector('#soLivres')?.checked;
  const soDoacao = document.querySelector('#soDoacao')?.checked;
  const doacaoDisponivel = p => (p.materiais_doacao || []).filter(m => m.situacao !== 'Esgotado');

  const lista = parceiros.filter(p => {
    const texto = [p.nome, p.cidade, p.tecnologias, p.materiais].join(' ').toLowerCase();
    if (busca && !texto.includes(busca)) return false;
    if (tec && !String(p.tecnologias).split(',').map(t => t.trim()).includes(tec)) return false;
    if (soLivres && !p.impressoras_livres) return false;
    if (soDoacao && !doacaoDisponivel(p).length) return false;
    return true;
  });

  const contador = document.querySelector('#contadorParceiros');
  if (contador) contador.textContent = `${lista.length} de ${parceiros.length} parceiros`;

  grid.innerHTML = lista.length ? lista.map(p => {
    const doacao = doacaoDisponivel(p);
    return `
    <article class="parceiro-card">
      <div class="parceiro-card-topo">
        <div>
          <p class="eyebrow">${escaparHTML(p.cidade || 'Parceiro de manufatura')}</p>
          <h2>${escaparHTML(p.nome)}</h2>
        </div>
        <span class="badge parceiro-${badgeClass(p.status)}">${escaparHTML(p.status)}</span>
      </div>
      <dl class="parceiro-dados">
        <div><dt>Impressoras livres</dt><dd>${p.impressoras_livres ?? '—'} de ${p.impressoras}</dd></div>
        <div><dt>Tecnologias</dt><dd>${escaparHTML(p.tecnologias)}</dd></div>
        <div><dt>Material para doação</dt><dd>${doacao.length ? escaparHTML([...new Set(doacao.map(m => m.material))].join(', ')) : 'Nenhum no momento'}</dd></div>
        <div><dt>Concluídas para vocês</dt><dd>${p.concluidas_com_voce ?? 0}</dd></div>
      </dl>
      <button class="btn btn-secundario btn-sm btn-ver-parceiro" type="button" data-parceiro="${escaparHTML(p.nome)}">Ver impressoras, materiais e retirada</button>
    </article>`;
  }).join('') : '<p class="estado-vazio">Nenhum parceiro com esses filtros.</p>';

  grid.querySelectorAll('.btn-ver-parceiro').forEach(btn => btn.addEventListener('click', () => abrirParceiro(btn.dataset.parceiro)));
}

function abrirParceiro(nome) {
  const p = parceiros.find(x => x.nome === nome);
  const modal = document.querySelector('#modalParceiro');
  if (!p || !modal) return;
  const e = escaparHTML;
  modal.querySelector('[data-parceiro-detalhe="nome"]').textContent = p.nome;
  modal.querySelector('[data-parceiro-detalhe="cidade"]').textContent = `${p.cidade || ''} · ${p.status}`;
  const impressoras = (p.lista_impressoras || []).map(i => `
    <tr><td><strong>${e(i.nome)}</strong><br><small class="texto-apoio">${e(i.modelo)}</small></td><td>${e(i.tecnologia)}</td>
      <td>${e(i.volume)}</td><td>${e(i.materiais || '—')}</td><td><span class="badge impressora-${badgeClass(i.status)}">${e(i.status)}</span></td></tr>`).join('');
  const materiais = (p.materiais_doacao || []).map(m => `
    <tr><td><strong>${e(m.material)}</strong></td><td>${e(m.tipo)}</td><td>${e(m.cor || '—')}</td>
      <td>${e(String(m.quantidade).replace('.', ','))} ${e(m.unidade)}</td><td><span class="badge material-${badgeClass(m.situacao)}">${e(m.situacao)}</span></td></tr>`).join('');
  const locais = (p.enderecos || []).map(l => `<li><strong>${e(l.nome)}</strong><span>${e(l.endereco)}</span></li>`).join('');
  modal.querySelector('[data-parceiro-detalhe="corpo"]').innerHTML = `
    <dl class="parceiro-resumo-modal">
      <div><dt>Impressoras ativas</dt><dd>${p.impressoras} (${p.impressoras_livres ?? 0} livre${p.impressoras_livres === 1 ? '' : 's'})</dd></div>
      <div><dt>Em produção agora</dt><dd>${p.emProducao}</dd></div>
      <div><dt>Concluídas (total)</dt><dd>${p.concluidas ?? '—'}</dd></div>
      <div><dt>Concluídas para vocês</dt><dd>${p.concluidas_com_voce ?? 0}</dd></div>
    </dl>
    <h3 class="modal-secao">Impressoras</h3>
    ${impressoras ? `<div class="tabela-wrap"><table><thead><tr><th>Impressora</th><th>Tecnologia</th><th>Volume</th><th>Materiais</th><th>Status</th></tr></thead><tbody>${impressoras}</tbody></table></div>` : '<p class="texto-apoio">Nenhuma impressora ativa registrada.</p>'}
    <h3 class="modal-secao">Materiais para doação</h3>
    ${materiais ? `<div class="tabela-wrap"><table><thead><tr><th>Material</th><th>Tipo</th><th>Cor</th><th>Quantidade</th><th>Situação</th></tr></thead><tbody>${materiais}</tbody></table></div>` : '<p class="texto-apoio">Este parceiro não registrou materiais para doação. As peças podem ser feitas com material fornecido por vocês.</p>'}
    <h3 class="modal-secao">Locais de retirada</h3>
    ${locais ? `<ul class="lista-locais">${locais}</ul>` : '<p class="texto-apoio">Nenhum endereço cadastrado.</p>'}
    <h3 class="modal-secao">Contato</h3>
    <p>${e(p.contato?.email || '—')} · ${e(p.contato?.telefone || '—')}</p>`;
  modal.showModal();
}


/* =========================
   NAVEGAÇÃO E INTERFACE
========================= */

// Abre/fecha o menu "Meu perfil / Sair" do cabeçalho e fecha ao clicar fora.
function prepararMenuPerfil() {
  document.querySelectorAll('.nav-perfil-wrap').forEach(wrap => {
    const botao = wrap.querySelector('.nav-perfil');
    const menu = wrap.querySelector('.perfil-menu');
    if (!botao || !menu) return;

    botao.addEventListener('click', (e) => {
      e.stopPropagation();
      const vaiAbrir = menu.hidden;
      document.querySelectorAll('.perfil-menu').forEach(m => m.hidden = true);
      document.querySelectorAll('.nav-perfil').forEach(b => b.setAttribute('aria-expanded', 'false'));
      menu.hidden = !vaiAbrir;
      botao.setAttribute('aria-expanded', String(vaiAbrir));
    });

    menu.addEventListener('click', e => e.stopPropagation());
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.perfil-menu').forEach(m => m.hidden = true);
    document.querySelectorAll('.nav-perfil').forEach(b => b.setAttribute('aria-expanded', 'false'));
  });

  // "Sair" chama a mesma rota de logout usada no perfil.
  document.querySelectorAll('.perfil-sair').forEach(link => {
    link.addEventListener('click', async e => {
      e.preventDefault();
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* segue para o login de qualquer forma */ }
      location.href = '/html/login.html';
    });
  });
}

// Destaca o item de navegação da página atual (via data-pagina no <body>).
function marcarPaginaAtiva() {
  const pagina = document.body.dataset.pagina;
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.dataset.pagina === pagina) {
      a.classList.add('ativo');
      a.setAttribute('aria-current', 'page');
    }
  });
}

// Mostra/esconde o botão "voltar ao topo" dos painéis internos.
function botaoTopo() {
  const btn = document.querySelector('#btnTopo');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visivel', window.scrollY > 300));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}


/* =========================
   PONTO DE ENTRADA
========================= */

// Carrega o essencial (usuário + solicitações + parceiros) antes de
// desenhar qualquer coisa que dependa deles. A página de detalhes busca
// a própria solicitação separadamente (não depende da lista completa).
async function carregarDadosIniciais() {
  await carregarUsuarioAtual();
  await Promise.all([
    carregarSolicitacoes().catch(() => { solicitacoes = []; }),
    carregarParceiros().catch(() => { parceiros = []; })
  ]);
}

// Exposta globalmente (em vez de só chamada dentro do DOMContentLoaded
// abaixo) para que js/fabricator.js — carregado depois deste arquivo,
// mas com seu próprio listener de DOMContentLoaded — possa aguardar o
// mesmo carregamento antes de renderizar, sem duplicar a chamada.
window.dadosIniciaisProntos = carregarDadosIniciais();

document.addEventListener('DOMContentLoaded', async () => {
  marcarPaginaAtiva();
  prepararMenuPerfil();
  prepararModais();
  botaoTopo();

  try {
    await window.dadosIniciaisProntos;
  } catch {
    return; // carregarUsuarioAtual() já redirecionou para o login.
  }

  preencherResumo();
  renderTabelaInicio();
  renderFiltrosSolicitacoes();
  renderTabelaSolicitacoes();
  renderParceiros();
  await renderDetalheSolicitacao();

  document.querySelector('#limparFiltros')?.addEventListener('click', () => {
    limparFiltrosAvancados(COLUNAS_SOLICITACOES);
    renderTabelaSolicitacoes();
  });
});
