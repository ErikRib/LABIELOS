/*
   Área autenticada da AACD (painel do solicitante).
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

// Junta a lista de instituições atribuídas em um texto legível.
function textoAtribuidos(valor) {
  return Array.isArray(valor) ? valor.join(', ') : (valor || 'Não atribuído');
}

// Converte um valor (ex.: "Em análise") no sufixo de classe CSS do
// badge correspondente (ex.: "em-analise"), removendo acentos.
function badgeClass(valor) {
  return String(valor).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
    const { user } = await api('/api/me');
    usuarioLogado = { nome: `${user.nome} ${user.sobrenome}`.trim(), organizacao: user.organizacao || '' };
    atualizarIdentidadeNav(usuarioLogado);
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
  { chave: 'atribuido', tipo: 'texto', label: 'Atribuído' },
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
  const mapa = { abertas, analise, producao, concluidas };
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
  tbody.innerHTML = solicitacoes.slice(0, 4).map(linhaSolicitacao).join('');
  ativarLinhasClicaveis(tbody);
}

// Tabela completa da página "Solicitações", já aplicando os filtros ativos.
function renderTabelaSolicitacoes() {
  const tbody = document.querySelector('#tabelaSolicitacoes tbody');
  if (!tbody) return;

  const filtros = lerFiltros(COLUNAS_SOLICITACOES);
  const filtradas = solicitacoes.filter(s => itemCorrespondeFiltros(s, filtros, extratorSolicitacao));

  tbody.innerHTML = filtradas.length
    ? filtradas.map(linhaSolicitacao).join('')
    : '<tr><td colspan="6" class="estado-vazio">Nenhuma solicitação encontrada com os filtros informados.</td></tr>';

  const contador = document.querySelector('#contadorSolicitacoes');
  if (contador) contador.textContent = `${filtradas.length} de ${solicitacoes.length} solicitações`;
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

// Preenche toda a página de detalhes (AACD ou fabricante) a partir do
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

  const etapas = ['Aberta', 'Em análise', 'Em produção', 'Concluída'];
  const indiceAtual = Math.max(0, etapas.indexOf(s.status));
  const fluxo = document.querySelector('#fluxoSolicitacao');
  if (fluxo) {
    fluxo.innerHTML = etapas.map((etapa, i) => {
      const classe = i < indiceAtual ? 'concluida' : i === indiceAtual ? 'atual' : '';
      return `<li class="fluxo-etapa ${classe}"><span class="fluxo-ponto">${i < indiceAtual ? '✓' : i + 1}</span><span>${etapa}</span></li>`;
    }).join('');
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
      anexo.innerHTML = `<div class="anexo-icone">3D</div><div class="anexo-info"><strong>${s.arquivo3d.nome}</strong><span>${s.arquivo3d.formato} · ${s.arquivo3d.tamanho}</span></div><button type="button" class="btn btn-secundario btn-visualizar-arquivo">Visualizar</button>`;
      anexo.querySelector('.btn-visualizar-arquivo')?.addEventListener('click', () => abrirVisualizadorArquivo(s.arquivo3d));
    } else {
      anexo.innerHTML = '<p class="texto-detalhe">Nenhum arquivo 3D anexado.</p>';
    }
  }

  prepararEdicaoSolicitacao(s);
  prepararRegistroTimeline();
}

// Abre o modal de pré-visualização 3D (wireframe ilustrativo) do arquivo anexado.
function abrirVisualizadorArquivo(arquivo) {
  const modal = document.querySelector('#modalVisualizarArquivo');
  if (!modal || !arquivo) return;
  modal.querySelector('[data-viewer="nome"]').textContent = arquivo.nome;
  modal.querySelector('[data-viewer="nome-info"]').textContent = arquivo.nome;
  modal.querySelector('[data-viewer="meta"]').textContent = `${arquivo.formato} · ${arquivo.tamanho}`;
  modal.showModal();
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
    const tipo = dados.get('tipo');
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

// Garante que pelo menos um parceiro foi marcado em "Atribuídos".
function validarAtribuidos(form, erroId) {
  const selecionados = [...form.querySelectorAll('input[name="atribuido"]:checked')].map(i => i.value);
  const erro = document.querySelector(`#${erroId}`);
  if (!selecionados.length) {
    if (erro) erro.textContent = 'Selecione pelo menos um atribuído.';
    return null;
  }
  if (erro) erro.textContent = '';
  return selecionados;
}

// Liga o modal "Editar solicitação" (só existe na área da AACD): abre
// preenchido com os dados atuais e, ao salvar, envia as mudanças para a
// API (PATCH) e recarrega a página de detalhes.
function prepararEdicaoSolicitacao(s) {
  const modal = document.querySelector('#modalEditarSolicitacao');
  const form = document.querySelector('#formEditarSolicitacao');
  const btn = document.querySelector('#btnEditarSolicitacao');
  if (!modal || !form || !btn) return;

  const preencher = () => {
    form.elements.solicitacao.value = s.solicitacao;
    form.elements.requerente.value = s.requerente;
    form.elements.prioridade.value = s.prioridade;
    form.elements.status.value = s.status;
    form.elements.categoria.value = s.categoria;
    form.elements.prazo.value = /^\d{2}\/\d{2}\/\d{4}$/.test(s.prazo || '') ? s.prazo.split('/').reverse().join('-') : '';
    form.elements.material.value = s.material === 'A definir' ? '' : s.material;
    form.elements.descricao.value = s.descricao;
    form.querySelectorAll('input[name="atribuido"]').forEach(c => c.checked = (s.atribuido || []).includes(c.value));
  };

  if (!btn.dataset.configurado) {
    btn.dataset.configurado = 'true';
    btn.addEventListener('click', () => { preencher(); modal.showModal(); });
  }

  if (!form.dataset.configurado) {
    form.dataset.configurado = 'true';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const atribuidos = validarAtribuidos(form, 'erroAtribuidosEdicao');
      if (!atribuidos) return;
      const dados = new FormData(form);
      const arquivo = form.elements.arquivo3d.files[0];

      const campos = {
        solicitacao: dados.get('solicitacao'),
        requerente: dados.get('requerente'),
        atribuido: atribuidos,
        prioridade: dados.get('prioridade'),
        status: dados.get('status'),
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
      } catch (erro) {
        alert(erro.message);
      }
    });
  }
}


/* =========================
   MODAIS GENÉRICOS E NOVA SOLICITAÇÃO
========================= */

// Comportamento genérico de todos os <dialog class="modal">: fechar
// pelo "×", pelo clique fora, e abrir/enviar o modal "Nova solicitação".
function prepararModais() {
  document.querySelectorAll('[data-fechar-modal]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('dialog')?.close());
  });

  document.querySelectorAll('.btn-nova-solicitacao').forEach(btn => {
    btn.addEventListener('click', () => document.querySelector('#modalNovaSolicitacao')?.showModal());
  });

  document.querySelectorAll('dialog.modal').forEach(dialog => {
    dialog.addEventListener('click', e => {
      const rect = dialog.getBoundingClientRect();
      const fora = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      if (fora) dialog.close();
    });
  });

  const form = document.querySelector('#formNovaSolicitacao');
  if (form && !form.dataset.configurado) {
    form.dataset.configurado = 'true';
    const arquivoInput = form.querySelector('input[name="arquivo3d"]');
    arquivoInput?.addEventListener('change', () => {
      const area = form.querySelector('[data-arquivo-selecionado]');
      const arquivo = arquivoInput.files[0];
      if (!area) return;
      if (!arquivo) { area.hidden = true; area.textContent = ''; return; }
      area.hidden = false;
      area.textContent = `${arquivo.name} · ${formatarTamanhoArquivo(arquivo.size)}`;
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const atribuidos = validarAtribuidos(form, 'erroAtribuidos');
      if (!atribuidos) return;
      const dados = new FormData(form);
      const arquivo = form.elements.arquivo3d.files[0];

      const campos = {
        solicitacao: dados.get('solicitacao'),
        atribuido: atribuidos,
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
        const nova = await api('/api/solicitacoes', { method: 'POST', body: corpo });

        form.reset();
        form.querySelector('[data-arquivo-selecionado]')?.setAttribute('hidden', '');
        document.querySelector('#modalNovaSolicitacao')?.close();

        await carregarSolicitacoes();
        preencherResumo();
        renderTabelaSolicitacoes();
        renderTabelaInicio();
        alert(`Solicitação ${nova.protocolo} criada.`);
      } catch (erro) {
        alert(erro.message);
      }
    });
  }
}


/* =========================
   PARCEIROS
========================= */

// Grade de cards da página "Parceiros", com modal de capacidade por parceiro.
function renderParceiros() {
  const grid = document.querySelector('#gridParceiros');
  if (!grid) return;
  grid.innerHTML = parceiros.map(p => `
    <article class="parceiro-card">
      <div class="parceiro-card-topo">
        <div>
          <p class="eyebrow">Parceiro credenciado</p>
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
      </dl>
      <button class="btn btn-secundario btn-ver-parceiro" type="button" data-parceiro="${p.nome}">Ver capacidade</button>
    </article>`).join('');

  grid.querySelectorAll('.btn-ver-parceiro').forEach(btn => btn.addEventListener('click', () => {
    const p = parceiros.find(x => x.nome === btn.dataset.parceiro);
    const modal = document.querySelector('#modalParceiro');
    if (!p || !modal) return;
    modal.querySelector('[data-parceiro-detalhe="nome"]').textContent = p.nome;
    modal.querySelector('[data-parceiro-detalhe="cidade"]').textContent = p.cidade;
    modal.querySelector('[data-parceiro-detalhe="status"]').textContent = p.status;
    modal.querySelector('[data-parceiro-detalhe="impressoras"]').textContent = p.impressoras;
    modal.querySelector('[data-parceiro-detalhe="tecnologias"]').textContent = p.tecnologias;
    modal.querySelector('[data-parceiro-detalhe="materiais"]').textContent = p.materiais;
    modal.showModal();
  }));
}


/* =========================
   HISTÓRICO (AMOSTRA)
========================= */

// Tabela da página "Histórico". Ainda é uma amostra estática — o
// contrato da API (docs/backend.md) por enquanto só cobre a linha do
// tempo de uma solicitação específica, não um feed agregado de toda a
// organização. Ver "O que fica para depois" em docs/design-system.md.
function renderHistorico() {
  const tbody = document.querySelector('#tabelaHistorico tbody');
  if (!tbody) return;
  const eventos = [
    ['10/09/2026 08:10', '#0002', 'Status alterado', 'Órtese craniana', 'Em análise', 'Instituto Mauá de Tecnologia'],
    ['09/09/2026 16:40', '#0001', 'Status alterado', 'Colete ortopédico', 'Em produção', 'Instituto Mauá de Tecnologia'],
    ['09/09/2026 10:00', '#0002', 'Parceiro atribuído', 'Órtese craniana', 'Em análise', 'Instituto Mauá de Tecnologia'],
    ['08/09/2026 11:05', '#0001', 'Parceiro atribuído', 'Colete ortopédico', 'Em análise', 'Instituto Mauá de Tecnologia'],
    ['08/09/2026 10:32', '#0001', 'Solicitação criada', 'Colete ortopédico', 'Aberta', 'Não atribuído']
  ];
  tbody.innerHTML = eventos.map(e => `<tr><td>${e[0]}</td><td>${e[1]}</td><td>${e[2]}</td><td>${e[3]}</td><td><span class="badge status-${badgeClass(e[4])}">${e[4]}</span></td><td>${e[5]}</td></tr>`).join('');
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
  renderHistorico();
  await renderDetalheSolicitacao();

  document.querySelector('#limparFiltros')?.addEventListener('click', () => {
    limparFiltrosAvancados(COLUNAS_SOLICITACOES);
    renderTabelaSolicitacoes();
  });
});
