const usuarioLogado = { nome: 'Lucas Romano', organizacao: 'AACD' };

const solicitacoes = [
  {
    protocolo: '#0001',
    solicitacao: 'Colete ortopédico',
    requerente: 'AACD',
    atribuido: ['Instituto Mauá de Tecnologia'],
    prioridade: 'Alta',
    status: 'Em produção',
    categoria: 'Órtese',
    abertura: '08/09/2026 10:32',
    prazo: '18/09/2026',
    material: 'PLA / TPU',
    descricao: 'Produção de colete ortopédico personalizado conforme requisitos e arquivo 3D anexado. O modelo está em produção pelo parceiro atribuído.',
    arquivo3d: { nome: 'colete-ortopedico-v3.stl', tamanho: '4,2 MB', formato: 'STL' },
    ultimaAtualizacao: '09/09/2026 16:40'
  },
  {
    protocolo: '#0002',
    solicitacao: 'Órtese craniana',
    requerente: 'AACD',
    atribuido: ['Instituto Mauá de Tecnologia'],
    prioridade: 'Média',
    status: 'Em análise',
    categoria: 'Órtese',
    abertura: '09/09/2026 09:15',
    prazo: '22/09/2026',
    material: 'A definir',
    descricao: 'Solicitação para produção de órtese craniana personalizada. O arquivo 3D foi anexado e está em análise técnica pelo parceiro atribuído.',
    arquivo3d: { nome: 'ortese-craniana.3mf', tamanho: '3,7 MB', formato: '3MF' },
    ultimaAtualizacao: '10/09/2026 08:10'
  }
];

const parceiros = [
  { nome: 'Instituto Mauá de Tecnologia', cidade: 'São Caetano do Sul - SP', status: 'Disponível', impressoras: 12, tecnologias: 'FDM, SLA', materiais: 'PLA, PETG, ABS, TPU', emProducao: 2 },
  { nome: 'Centro Universitário FEI', cidade: 'São Bernardo do Campo - SP', status: 'Disponível', impressoras: 8, tecnologias: 'FDM, SLA', materiais: 'PLA, PETG, TPU', emProducao: 1 },
  { nome: 'Universidade Presbiteriana Mackenzie', cidade: 'São Paulo - SP', status: 'Capacidade limitada', impressoras: 6, tecnologias: 'FDM', materiais: 'PLA, ABS', emProducao: 3 },
  { nome: 'Laboratório Parceiro Demo', cidade: 'São Paulo - SP', status: 'Indisponível', impressoras: 4, tecnologias: 'FDM', materiais: 'PLA, PETG', emProducao: 0 }
];

function textoAtribuidos(valor) {
  return Array.isArray(valor) ? valor.join(', ') : (valor || 'Não atribuído');
}

function badgeClass(valor) {
  return String(valor).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

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

function renderTabelaInicio() {
  const tbody = document.querySelector('#tabelaRecentes tbody');
  if (!tbody) return;
  tbody.innerHTML = solicitacoes.slice(0, 4).map(linhaSolicitacao).join('');
  ativarLinhasClicaveis(tbody);
}

function renderTabelaSolicitacoes() {
  const tbody = document.querySelector('#tabelaSolicitacoes tbody');
  if (!tbody) return;

  const filtros = [...document.querySelectorAll('[data-filtro]')];
  const filtradas = solicitacoes.filter(s => filtros.every(f => {
    const valor = f.value.trim().toLowerCase();
    if (!valor) return true;
    const dado = f.dataset.filtro === 'atribuido' ? textoAtribuidos(s.atribuido) : String(s[f.dataset.filtro] ?? '');
    return dado.toLowerCase().includes(valor);
  }));

  tbody.innerHTML = filtradas.length
    ? filtradas.map(linhaSolicitacao).join('')
    : '<tr><td colspan="6" class="estado-vazio">Nenhuma solicitação encontrada com os filtros informados.</td></tr>';

  const contador = document.querySelector('#contadorSolicitacoes');
  if (contador) contador.textContent = `${filtradas.length} de ${solicitacoes.length} solicitações`;
  ativarLinhasClicaveis(tbody);
}

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

const historicoSolicitacoes = {
  '#0001': [
    { data: '08/09/2026 10:32', tipo: 'Criação', autor: 'Lucas Romano (AACD)', titulo: 'Solicitação criada', descricao: 'Solicitação de colete ortopédico registrada com arquivo 3D anexado.' },
    { data: '08/09/2026 11:05', tipo: 'Atribuição', autor: 'Equipe AACD', titulo: 'Parceiro atribuído', descricao: 'Instituto Mauá de Tecnologia selecionado para avaliar a produção.' },
    { data: '08/09/2026 16:20', tipo: 'Status', autor: 'Instituto Mauá de Tecnologia', titulo: 'Status alterado para Em análise', descricao: 'Arquivo 3D e requisitos recebidos para validação técnica.' },
    { data: '09/09/2026 09:10', tipo: 'Comentário', autor: 'Instituto Mauá de Tecnologia', titulo: 'Validação técnica concluída', descricao: 'Requisitos validados e produção liberada.' },
    { data: '09/09/2026 16:40', tipo: 'Status', autor: 'Instituto Mauá de Tecnologia', titulo: 'Status alterado para Em produção', descricao: 'Produção do colete ortopédico iniciada.' }
  ],
  '#0002': [
    { data: '09/09/2026 09:15', tipo: 'Criação', autor: 'Lucas Romano (AACD)', titulo: 'Solicitação criada', descricao: 'Solicitação de órtese craniana registrada com arquivo 3D anexado.' },
    { data: '09/09/2026 10:00', tipo: 'Atribuição', autor: 'Equipe AACD', titulo: 'Parceiro atribuído', descricao: 'Instituto Mauá de Tecnologia selecionado para análise da solicitação.' },
    { data: '10/09/2026 08:10', tipo: 'Status', autor: 'Instituto Mauá de Tecnologia', titulo: 'Status alterado para Em análise', descricao: 'Arquivo 3D e requisitos da órtese craniana estão em validação técnica.' }
  ]
};

function renderDetalheSolicitacao() {
  const pagina = document.querySelector('#paginaDetalheSolicitacao');
  if (!pagina) return;

  const params = new URLSearchParams(window.location.search);
  const protocolo = params.get('protocolo') || '#0001';
  const s = solicitacoes.find(item => item.protocolo === protocolo) || solicitacoes[0];

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
    const eventos = historicoSolicitacoes[s.protocolo] || [];
    lista.innerHTML = eventos.slice().reverse().map(evento => `
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
}


function formatarTamanhoArquivo(bytes) {
  if (!bytes) return 'Tamanho não informado';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function metadadosArquivo(file) {
  if (!file || !file.name) return null;
  const ext = file.name.split('.').pop()?.toUpperCase() || '3D';
  return { nome: file.name, tamanho: formatarTamanhoArquivo(file.size), formato: ext };
}

function abrirVisualizadorArquivo(arquivo) {
  const modal = document.querySelector('#modalVisualizarArquivo');
  if (!modal || !arquivo) return;
  modal.querySelector('[data-viewer="nome"]').textContent = arquivo.nome;
  modal.querySelector('[data-viewer="nome-info"]').textContent = arquivo.nome;
  modal.querySelector('[data-viewer="meta"]').textContent = `${arquivo.formato} · ${arquivo.tamanho}`;
  modal.showModal();
}

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
    form.addEventListener('submit', e => {
      e.preventDefault();
      const atribuidos = validarAtribuidos(form, 'erroAtribuidosEdicao');
      if (!atribuidos) return;
      const dados = new FormData(form);
      const statusAnterior = s.status;
      const arquivo = form.elements.arquivo3d.files[0];
      s.solicitacao = dados.get('solicitacao');
      s.requerente = dados.get('requerente');
      s.atribuido = atribuidos;
      s.prioridade = dados.get('prioridade');
      s.status = dados.get('status');
      s.categoria = dados.get('categoria');
      s.prazo = dados.get('prazo') ? dados.get('prazo').split('-').reverse().join('/') : 'A definir';
      s.material = dados.get('material') || 'A definir';
      s.descricao = dados.get('descricao');
      if (arquivo) s.arquivo3d = metadadosArquivo(arquivo);
      s.ultimaAtualizacao = new Date().toLocaleString('pt-BR');
      if (!historicoSolicitacoes[s.protocolo]) historicoSolicitacoes[s.protocolo] = [];
      historicoSolicitacoes[s.protocolo].push({
        data: s.ultimaAtualizacao,
        tipo: 'Edição',
        autor: `${usuarioLogado.nome} (${usuarioLogado.organizacao})`,
        titulo: statusAnterior !== s.status ? `Solicitação editada · ${statusAnterior} → ${s.status}` : 'Informações da solicitação atualizadas',
        descricao: arquivo ? `Dados atualizados e arquivo 3D substituído por ${arquivo.name}.` : 'Dados cadastrais da solicitação atualizados.'
      });
      modal.close();
      renderDetalheSolicitacao();
    });
  }
}

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

    form.addEventListener('submit', e => {
      e.preventDefault();
      const atribuidos = validarAtribuidos(form, 'erroAtribuidos');
      if (!atribuidos) return;
      const dados = new FormData(form);
      const numero = String(Math.max(...solicitacoes.map(s => Number(s.protocolo.replace('#','')))) + 1).padStart(4,'0');
      const agora = new Date().toLocaleString('pt-BR');
      const arquivo = form.elements.arquivo3d.files[0];
      const nova = {
        protocolo: `#${numero}`,
        solicitacao: dados.get('solicitacao'),
        requerente: usuarioLogado.organizacao,
        atribuido: atribuidos,
        prioridade: dados.get('prioridade'),
        status: 'Aberta',
        categoria: dados.get('categoria'),
        abertura: agora,
        prazo: dados.get('prazo') ? dados.get('prazo').split('-').reverse().join('/') : 'A definir',
        material: dados.get('material') || 'A definir',
        descricao: dados.get('descricao'),
        arquivo3d: metadadosArquivo(arquivo),
        ultimaAtualizacao: agora
      };
      solicitacoes.unshift(nova);
      historicoSolicitacoes[nova.protocolo] = [{ data: agora, tipo: 'Criação', autor: `${usuarioLogado.nome} (${usuarioLogado.organizacao})`, titulo: 'Solicitação criada', descricao: arquivo ? `Solicitação registrada com o arquivo 3D ${arquivo.name}.` : 'Solicitação registrada no sistema.' }];
      form.reset();
      form.querySelector('[data-arquivo-selecionado]')?.setAttribute('hidden','');
      document.querySelector('#modalNovaSolicitacao')?.close();
      preencherResumo();
      renderTabelaSolicitacoes();
      renderTabelaInicio();
      alert(`Solicitação #${numero} criada no protótipo.`);
    });
  }
}

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

function renderHistorico() {
  const tbody = document.querySelector('#tabelaHistorico tbody');
  if (!tbody) return;
  const eventos = [
    ['10/09/2026 08:10','#0002','Status alterado','Órtese craniana','Em análise','Instituto Mauá de Tecnologia'],
    ['09/09/2026 16:40','#0001','Status alterado','Colete ortopédico','Em produção','Instituto Mauá de Tecnologia'],
    ['09/09/2026 10:00','#0002','Parceiro atribuído','Órtese craniana','Em análise','Instituto Mauá de Tecnologia'],
    ['08/09/2026 11:05','#0001','Parceiro atribuído','Colete ortopédico','Em análise','Instituto Mauá de Tecnologia'],
    ['08/09/2026 10:32','#0001','Solicitação criada','Colete ortopédico','Aberta','Não atribuído']
  ];
  tbody.innerHTML = eventos.map(e => `<tr><td>${e[0]}</td><td>${e[1]}</td><td>${e[2]}</td><td>${e[3]}</td><td><span class="badge status-${badgeClass(e[4])}">${e[4]}</span></td><td>${e[5]}</td></tr>`).join('');
}


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
}

function marcarPaginaAtiva() {
  const pagina = document.body.dataset.pagina;
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.dataset.pagina === pagina) {
      a.classList.add('ativo');
      a.setAttribute('aria-current','page');
    }
  });
}

function botaoTopo() {
  const btn = document.querySelector('#btnTopo');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visivel', window.scrollY > 300));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

document.addEventListener('DOMContentLoaded', () => {
  marcarPaginaAtiva();
  prepararMenuPerfil();
  preencherResumo();
  renderTabelaInicio();
  renderTabelaSolicitacoes();
  renderParceiros();
  renderHistorico();
  renderDetalheSolicitacao();
  prepararModais();
  botaoTopo();

  document.querySelectorAll('[data-filtro]').forEach(f => f.addEventListener('input', renderTabelaSolicitacoes));
  document.querySelector('#limparFiltros')?.addEventListener('click', () => {
    document.querySelectorAll('[data-filtro]').forEach(f => f.value = '');
    renderTabelaSolicitacoes();
  });
});
