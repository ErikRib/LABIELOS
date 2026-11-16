/*
   Área do fabricante (parceiro de manufatura). Reaproveita de
   prototipo.js os dados vindos da API (solicitacoes, parceiros,
   usuarioLogado), as funções utilitárias (badgeClass, textoAtribuidos) e
   a promessa compartilhada "window.dadosIniciaisProntos", já que os dois
   arquivos têm cada um seu próprio listener de DOMContentLoaded.

   Fluxo: toda solicitação nova entra na FILA GLOBAL (GET /api/fila),
   vista por todos os fabricantes. Quem aceitar primeiro
   (POST /api/solicitacoes/{protocolo}/aceitar) assume a demanda, que sai
   da fila e passa a aparecer só em "Demandas" desse fabricante
   (GET /api/solicitacoes). A visibilidade é decidida pelo back-end.
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

// Fila global: solicitações "Aberta" que nenhum fabricante aceitou
// ainda (GET /api/fila). Todos os fabricantes veem a mesma fila.
let filaGlobal = [];

// As demandas (solicitações já aceitas por esta organização) vêm
// filtradas pela API — esta função só mantém o nome descritivo.
function demandasDoParceiro() {
  return solicitacoes;
}

async function carregarFila() {
  filaGlobal = await api('/api/fila');
}

// Botões de ação de uma solicitação, conforme o status:
//   Aberta (na fila)  → Aceitar
//   Em análise        → Iniciar produção (impressora + origem do material) / Devolver à fila
//   Aguardando material → Confirmar recebimento (material do solicitante)
//   Em produção       → Concluir produção (pede o local de retirada)
//   Pronta p/ retirada → nada: aguarda a aprovação do solicitante
function acaoDaDemanda(s) {
  switch (s.status) {
    case 'Aberta':
      return [{ acao: 'aceitar', label: 'Aceitar', classe: 'btn-principal' }];
    case 'Em análise':
      return [
        { acao: 'iniciar-producao', label: 'Iniciar produção', classe: 'btn-principal' },
        { acao: 'devolver', label: 'Devolver à fila', classe: 'btn-secundario' }
      ];
    case 'Aguardando material':
      return [{ acao: 'material-recebido', label: 'Confirmar recebimento do material', classe: 'btn-principal' }];
    case 'Em produção':
      return [{ acao: 'concluir-producao', label: 'Concluir produção', classe: 'btn-principal' }];
    default:
      return [];
  }
}

function botoesAcao(s, classeBase = 'btn-acao-tabela') {
  return acaoDaDemanda(s)
    .map(a => `<button type="button" class="btn ${classeBase} ${a.classe}" data-protocolo="${escaparHTML(s.protocolo)}" data-acao="${a.acao}">${a.label}</button>`)
    .join('');
}

// Mensagem de retorno: usa a área de status da página (#mensagemFabricante).
function avisoFabricante(texto, erro = false) {
  const el = document.querySelector('#mensagemFabricante');
  if (!el) { if (erro) alert(texto); return; }
  el.textContent = texto;
  el.classList.toggle('mensagem-erro', erro);
}

// Executa a ação escolhida e redesenha tudo que depende dela.
//   aceitar  → POST /api/solicitacoes/{protocolo}/aceitar  (sai da fila e vira demanda desta organização)
//   devolver → POST /api/solicitacoes/{protocolo}/devolver (volta para a fila global)
//   demais   → PATCH /api/solicitacoes/{protocolo} {"status": ...}
// O back-end registra o evento correspondente na linha do tempo.
async function aplicarAcaoDemanda(protocolo, acao) {
  const url = `/api/solicitacoes/${encodeURIComponent(protocolo)}`;
  if (acao === 'devolver' && !confirm(`Devolver ${protocolo} para a fila? Outro parceiro poderá assumi-la.`)) return;
  // Ações com modal próprio (pedem dados antes de chamar a API).
  const comModal = {
    'iniciar-producao': [iniciarProducao, r => r === 'aguardando'
      ? `${protocolo} aguardando o material do solicitante. Ele foi avisado de onde entregar.`
      : `Produção de ${protocolo} iniciada.`],
    'material-recebido': [confirmarMaterialRecebido, () => `Material recebido. Produção de ${protocolo} iniciada.`],
    'concluir-producao': [concluirProducao, () => `Produção de ${protocolo} concluída. O solicitante foi avisado do local de retirada.`]
  };
  if (comModal[acao]) {
    const [abrir, mensagem] = comModal[acao];
    const resultado = await abrir(protocolo);
    if (resultado) {
      avisoFabricante(mensagem(resultado));
      await atualizarTelasFabricante();
      setTimeout(() => location.reload(), 700);
    }
    return;
  }

  try {
    if (acao === 'aceitar') await api(`${url}/aceitar`, { method: 'POST' });
    else if (acao === 'devolver') await api(`${url}/devolver`, { method: 'POST' });
    else return;

    avisoFabricante({
      'aceitar': `Solicitação ${protocolo} aceita. Ela agora está em Demandas.`,
      'devolver': `Solicitação ${protocolo} devolvida à fila.`
    }[acao]);
    await atualizarTelasFabricante();
    setTimeout(() => location.reload(), 700);
  } catch (erro) {
    // 409 = outro parceiro aceitou primeiro (ou o status já mudou).
    avisoFabricante(erro.message, true);
    await atualizarTelasFabricante();
  }
}

// Texto curto de um endereço (rua, número · bairro, cidade/UF · CEP).
function textoEnderecoCurto(e) {
  return [`${e.logradouro}, ${e.numero}${e.complemento ? ` — ${e.complemento}` : ''}`, `${e.bairro}, ${e.cidade}/${e.uf}`, `CEP ${e.cep}`].join(' · ');
}

// Cartões de rádio para escolher um endereço (retirada ou entrega).
function opcoesEndereco(enderecos, nome) {
  return enderecos.map(e => `
    <label class="opcao-endereco">
      <input type="radio" name="${nome}" value="${escaparHTML(e.id)}" required ${enderecos.length === 1 ? 'checked' : ''}>
      <span><strong>${escaparHTML(e.nome)}</strong><small>${escaparHTML(textoEnderecoCurto(e))}</small></span>
    </label>`).join('');
}

// "Iniciar produção": escolhe a impressora e de onde vem o material.
//  - doado pelo parceiro: escolhe o item do estoque → Em produção;
//  - fornecido pelo solicitante: diz o que precisa ser entregue e onde →
//    Aguardando material (o parceiro confirma o recebimento depois).
// Resolve 'producao' | 'aguardando' | false.
async function iniciarProducao(protocolo) {
  const [impressorasOrg, materiaisOrg, enderecos] = await Promise.all([
    api('/api/impressoras').catch(() => []),
    api('/api/materiais').catch(() => []),
    api('/api/organizacao/enderecos').catch(() => [])
  ]);
  const usaveis = impressorasOrg.filter(i => i.status !== 'Inativa');
  const opcoesImpressora = usaveis.map(i => {
    const bloqueada = i.status === 'Em manutenção';
    return `<label class="opcao-endereco${bloqueada ? ' opcao-bloqueada' : ''}">
      <input type="radio" name="impressora_id" value="${escaparHTML(i.id)}" required ${bloqueada ? 'disabled' : ''} ${usaveis.length === 1 && !bloqueada ? 'checked' : ''}>
      <span><strong>${escaparHTML(i.nome)}</strong><small>${escaparHTML([i.modelo, i.tecnologia, `${i.largura_mm}×${i.profundidade_mm}×${i.altura_mm} mm`].filter(Boolean).join(' · '))}</small></span>
      <span class="badge impressora-${badgeClass(i.status)}">${escaparHTML(i.status)}</span>
    </label>`;
  }).join('');
  const estoque = materiaisOrg.map(m => {
    const esgotado = Number(m.quantidade) <= 0;
    return `<option value="${escaparHTML(m.id)}" ${esgotado ? 'disabled' : ''}>${escaparHTML([m.material, m.cor].filter(Boolean).join(' · '))} — ${escaparHTML(String(m.quantidade).replace('.', ','))} ${escaparHTML(m.unidade || '')}${esgotado ? ' (esgotado)' : ''}</option>`;
  }).join('');

  const corpo = !usaveis.length
    ? `<p class="aviso-sem-endereco">Sua organização não tem impressoras ativas. Registre uma em
         <a href="/html/fabricator/impressoras.html?nova=1">Impressoras</a> para iniciar a produção.</p>`
    : `<fieldset class="grupo-enderecos">
         <legend>Impressora que vai produzir *</legend>
         ${opcoesImpressora}
       </fieldset>
       <fieldset class="grupo-enderecos">
         <legend>Material *</legend>
         <label class="opcao-endereco">
           <input type="radio" name="origem_material" value="doacao" required ${materiaisOrg.length ? '' : 'disabled'}>
           <span><strong>Doado pelo parceiro</strong><small>${materiaisOrg.length ? 'Sai do estoque de materiais para doação da sua organização.' : 'Nenhum material registrado no seu estoque.'}</small></span>
         </label>
         <label class="opcao-endereco">
           <input type="radio" name="origem_material" value="solicitante" required>
           <span><strong>Fornecido pelo solicitante</strong><small>A demanda fica em "Aguardando material" até você confirmar o recebimento.</small></span>
         </label>
       </fieldset>
       <div class="campo" data-origem="doacao" hidden>
         <label for="materialDoado">Material do estoque *</label>
         <select id="materialDoado" name="material_id"><option value="">Escolha…</option>${estoque}</select>
       </div>
       <div data-origem="solicitante" hidden>
         <div class="campo">
           <label for="especificacaoMaterial">O que o solicitante precisa entregar *</label>
           <input id="especificacaoMaterial" name="especificacao" maxlength="200" placeholder="Ex.: 1 kg de PETG 1,75 mm, cor branca">
         </div>
         <fieldset class="grupo-enderecos">
           <legend>Onde entregar o material *</legend>
           ${enderecos.length ? opcoesEndereco(enderecos, 'endereco_id') : '<p class="aviso-sem-endereco">Cadastre um endereço em Administração → Dados da organização.</p>'}
         </fieldset>
       </div>`;

  let origemEscolhida = null;
  const ok = await abrirModalAcao({
    eyebrow: protocolo,
    titulo: 'Iniciar produção',
    corpo,
    confirmar: 'Iniciar',
    preparar: (form, enviar) => {
      if (!usaveis.length) { enviar.disabled = true; return; }
      // Campos de um bloco escondido não podem ser obrigatórios (travariam a validação).
      const ajustarObrigatorios = origem => {
        form.querySelectorAll('[data-origem]').forEach(bloco => {
          const visivel = bloco.dataset.origem === origem;
          bloco.hidden = !visivel;
          bloco.querySelectorAll('select, input').forEach(c => { c.required = visivel; });
        });
      };
      ajustarObrigatorios(null);
      form.querySelectorAll('[name="origem_material"]').forEach(r => r.addEventListener('change', () => {
        ajustarObrigatorios(r.value);
        enviar.textContent = r.value === 'solicitante' ? 'Avisar o solicitante' : 'Iniciar produção';
      }));
    },
    aoConfirmar: async form => {
      const marcado = nome => form.querySelector(`[name="${nome}"]:checked`)?.value;
      origemEscolhida = marcado('origem_material');
      const corpoApi = { impressora_id: marcado('impressora_id'), origem_material: origemEscolhida };
      if (origemEscolhida === 'doacao') corpoApi.material_id = form.elements.material_id.value;
      else {
        corpoApi.especificacao = form.elements.especificacao.value.trim();
        corpoApi.endereco_id = marcado('endereco_id');
      }
      await api(`/api/solicitacoes/${encodeURIComponent(protocolo)}/iniciar-producao`, { method: 'POST', body: JSON.stringify(corpoApi) });
    }
  });
  return ok && (origemEscolhida === 'solicitante' ? 'aguardando' : 'producao');
}

// Material do solicitante chegou: confirma e a produção começa.
function confirmarMaterialRecebido(protocolo) {
  return abrirModalAcao({
    eyebrow: protocolo,
    titulo: 'Confirmar recebimento do material',
    corpo: '<p>Confirme que o material entregue pelo solicitante chegou e está em condições de uso. A demanda passa para <strong>Em produção</strong>.</p>',
    confirmar: 'Material recebido',
    aoConfirmar: async () => {
      await api(`/api/solicitacoes/${encodeURIComponent(protocolo)}/material-recebido`, { method: 'POST' });
    }
  });
}

// "Concluir produção": escolhe o local de retirada entre os endereços da
// organização (GET /api/organizacao/enderecos). Com um endereço só, ele já
// vem marcado; com mais de um, o fabricante precisa escolher antes de
// confirmar. A API registra "Disponível para retirada" no histórico.
async function concluirProducao(protocolo) {
  const [enderecos, s, estoque] = await Promise.all([
    api('/api/organizacao/enderecos').catch(() => []),
    buscarSolicitacao(protocolo).catch(() => null),
    api('/api/materiais').catch(() => [])
  ]);
  const opcoes = opcoesEndereco(enderecos, 'endereco_id');
  // Material doado: pede a quantidade usada para dar baixa no estoque.
  const doado = s?.producao?.material?.origem === 'doacao' ? s.producao.material : null;
  const item = doado && estoque.find(m => m.id === doado.id);
  const unidade = item?.unidade || doado?.unidade || '';
  const campoBaixa = doado ? `
       <div class="campo campo-baixa">
         <label for="quantidadeUsada">Quantidade de ${escaparHTML(doado.nome)} usada *</label>
         <div class="campo-com-unidade">
           <input id="quantidadeUsada" name="quantidade_usada" type="number" min="0.001" step="any" required
             ${item ? `max="${Number(item.quantidade)}"` : ''} inputmode="decimal" placeholder="Ex.: 0,35">
           <span>${escaparHTML(unidade)}</span>
         </div>
         <small class="campo-ajuda">${item ? `Estoque atual: ${String(item.quantidade).replace('.', ',')} ${escaparHTML(unidade)}. A quantidade será baixada do estoque de doação.` : 'O item não está mais no estoque; a quantidade só fica registrada.'}</small>
       </div>` : '';
  const corpo = enderecos.length
    ? `<p>A demanda passa para <strong>Pronta para retirada</strong> e o solicitante recebe no histórico o local abaixo.</p>
       ${campoBaixa}
       <fieldset class="grupo-enderecos">
         <legend>${enderecos.length > 1 ? 'Onde a peça será retirada? *' : 'Local de retirada'}</legend>
         ${opcoes}
       </fieldset>
       <div class="campo"><label for="instrucoesRetirada">Instruções para retirada <span class="texto-apoio">(opcional)</span></label>
         <textarea id="instrucoesRetirada" name="instrucoes" maxlength="300" rows="3"
           placeholder="Ex.: segunda a sexta, das 9h às 17h. Procurar a recepção do laboratório."></textarea></div>`
    : `<p class="aviso-sem-endereco">Sua organização ainda não tem endereço de retirada. Peça a um administrador para cadastrar em
       <a href="/html/admin.html#dados">Administração → Dados da organização</a>.</p>`;
  return abrirModalAcao({
    eyebrow: protocolo,
    titulo: 'Concluir produção',
    corpo,
    confirmar: 'Concluir e avisar o solicitante',
    preparar: (form, enviar) => { if (!enderecos.length) enviar.disabled = true; },
    aoConfirmar: async form => {
      await api(`/api/solicitacoes/${encodeURIComponent(protocolo)}/concluir-producao`, {
        method: 'POST',
        body: JSON.stringify({
          endereco_id: form.querySelector('[name="endereco_id"]:checked')?.value,
          instrucoes: form.elements.instrucoes.value.trim(),
          ...(doado ? { quantidade_usada: Number(form.elements.quantidade_usada.value) } : {})
        })
      });
    }
  });
}

async function atualizarTelasFabricante() {
  await Promise.all([
    carregarSolicitacoes().catch(() => {}),
    precisaDaFila() ? carregarFila().catch(() => { filaGlobal = []; }) : null
  ]);
  preencherResumoFabricante();
  renderDemandasRecentes();
  renderDemandasFabricante();
  renderFila();
  await renderAcoesDemandaDetalhe();
  if (document.querySelector('#paginaDetalheSolicitacao') && typeof renderDetalheSolicitacao === 'function') await renderDetalheSolicitacao();
}

function precisaDaFila() {
  return !!document.querySelector('#tabelaFila, [data-resumo-fabricante="fila"]');
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
        <div class="acoes-tabela">
          <a class="btn btn-acao-tabela btn-secundario" href="/html/fabricator/detalhe-demanda.html?protocolo=${encodeURIComponent(s.protocolo)}">Ver detalhes</a>
          ${botoesAcao(s)}
        </div>
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
    fila: filaGlobal.length,
    analise: demandas.filter(s => s.status === 'Em análise').length,
    producao: demandas.filter(s => s.status === 'Em produção').length,
    retirada: demandas.filter(s => s.status === 'Pronta para retirada').length,
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
    : '<tr><td colspan="6" class="estado-vazio">Nenhuma demanda ainda. Aceite uma solicitação em <a href="/html/fabricator/fila.html">Novas solicitações</a>.</td></tr>';
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
    </dl>
    <div class="cartao-materiais-acoes capacidade-acoes">
      <a href="/html/fabricator/impressoras.html?nova=1" class="btn btn-principal btn-sm">+ Registrar impressora</a>
      <a href="/html/fabricator/impressoras.html" class="btn btn-secundario btn-sm">Ver impressoras</a>
    </div>`;
}


// Cartão "Materiais para doação" da visão geral: resumo do estoque da
// própria organização (GET /api/materiais) com atalho para registrar.
async function renderResumoMateriaisFabricante() {
  const el = document.querySelector('#resumoMateriaisFabricante');
  if (!el) return;
  try {
    const itens = await api('/api/materiais');
    if (!itens.length) {
      el.textContent = 'Nenhum material registrado. Registre os insumos que sua organização pode usar em produções doadas.';
      return;
    }
    const situacao = m => m.situacao || (Number(m.quantidade) <= 0 ? 'Esgotado' : 'Disponível');
    const baixo = itens.filter(m => situacao(m) === 'Estoque baixo').length;
    const esgotado = itens.filter(m => situacao(m) === 'Esgotado').length;
    const alertas = [baixo && `${baixo} com estoque baixo`, esgotado && `${esgotado} esgotado${esgotado > 1 ? 's' : ''}`].filter(Boolean);
    el.innerHTML = `<strong>${itens.length} ${itens.length === 1 ? 'item registrado' : 'itens registrados'}</strong>`
      + (alertas.length ? ` · ${alertas.join(' · ')}` : ' · todos disponíveis');
  } catch {
    el.textContent = 'Não foi possível carregar o estoque agora.';
  }
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
  const acoes = botoesAcao(s);

  return `
    <tr>
      ${celulas}
      <td class="celula-acoes">
        <div class="acoes-tabela">
          <a class="btn btn-acao-tabela btn-secundario" href="/html/fabricator/detalhe-demanda.html?protocolo=${encodeURIComponent(s.protocolo)}">Ver detalhes</a>
          ${acoes}
        </div>
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

  const definir = aberto => { painel.hidden = !aberto; botao.setAttribute('aria-expanded', String(aberto)); };
  botao.addEventListener('click', e => {
    e.stopPropagation();
    definir(painel.hidden);
  });
  painel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => definir(false));
}


/* =========================
   PÁGINA DE DETALHE DA DEMANDA
========================= */

// Faixa "Próxima etapa" da página de detalhe: o que o parceiro faz agora
// e os botões da etapa. A solicitação é buscada pelo protocolo porque pode
// ainda estar na fila global (fora da lista de demandas desta organização).
async function renderAcoesDemandaDetalhe() {
  const container = document.querySelector('#acoesDemanda');
  if (!container) return;

  const protocolo = new URLSearchParams(window.location.search).get('protocolo');
  let s;
  try { s = await buscarSolicitacao(protocolo); } catch { container.hidden = true; return; }

  const etapa = textoEtapa(s);
  const m = s.producao?.material;
  const estados = {
    'Aguardando material': { tom: 'info', titulo: 'Aguardando o material do solicitante',
      texto: `O solicitante precisa entregar <strong>${escaparHTML(m?.especificacao || 'o material')}</strong> em ${escaparHTML(m?.entrega?.local || 'sua organização')}. Quando chegar, confirme o recebimento para iniciar a produção.` },
    'Aberta': { tom: 'acao', titulo: 'Disponível na fila', texto: 'Nenhum parceiro aceitou ainda. Ao aceitar, ela vira uma demanda da sua organização e sai da fila dos outros parceiros.' },
    'Em análise': { tom: 'acao', titulo: 'Analise e inicie a produção', texto: 'Confira a descrição, o arquivo 3D e o prazo. Ao iniciar, você escolhe a impressora e se o material será doado por vocês ou fornecido pelo solicitante. Se não puder atender, devolva à fila.' },
    'Em produção': { tom: 'acao', titulo: s.ajuste ? 'Ajuste solicitado' : 'Produção em andamento',
      texto: s.ajuste ? 'O solicitante devolveu a peça (motivo logo abaixo). Faça o ajuste e conclua a produção de novo.' : 'Ao terminar, conclua a produção e informe onde a peça será retirada. O solicitante recebe o aviso no histórico.' },
    'Pronta para retirada': { titulo: 'Aguardando o solicitante', texto: 'A peça está disponível para retirada. O solicitante vai testar e então aprovar ou devolver para ajuste.' },
    'Concluída': { tom: 'fim', titulo: 'Demanda concluída', texto: 'O solicitante testou e aprovou a peça. Obrigado pela doação!' }
  };
  // Ordem: ação secundária primeiro, principal por último (à direita).
  const botoes = acaoDaDemanda(s).slice().reverse();
  renderBarraEtapa(container, { etapa, ...(estados[s.status] || { titulo: s.status, texto: '' }),
    botoes: botoes.map(a => `<button type="button" class="btn btn-acao ${a.classe}" data-protocolo="${escaparHTML(s.protocolo)}" data-acao="${a.acao}">${a.label}</button>`).join('') });
  ativarAcoesDemanda(container);
}


/* =========================
   FILA GLOBAL DE NOVAS SOLICITAÇÕES
========================= */

const PESO_PRIORIDADE = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };

// "dd/mm/aaaa" → número comparável (aaaammdd); "A definir" vai para o fim.
function chaveData(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto || '');
  return m ? Number(m[3] + m[2] + m[1]) : 99999999;
}

// Tabela da fila: mais urgentes primeiro, depois as mais antigas.
function renderFila() {
  const tbody = document.querySelector('#tabelaFila tbody');
  if (!tbody) return;
  const busca = (document.querySelector('#buscaFila')?.value || '').trim().toLowerCase();
  const prioridade = document.querySelector('#filtroPrioridadeFila')?.value || '';

  const lista = filaGlobal
    .filter(s => !prioridade || s.prioridade === prioridade)
    .filter(s => !busca || [s.protocolo, s.solicitacao, s.requerente, s.categoria, s.material].join(' ').toLowerCase().includes(busca))
    .sort((a, b) => (PESO_PRIORIDADE[a.prioridade] ?? 3) - (PESO_PRIORIDADE[b.prioridade] ?? 3) || chaveData(a.abertura) - chaveData(b.abertura));

  const e = escaparHTML;
  tbody.innerHTML = lista.length
    ? lista.map(s => `
      <tr>
        <td>${e(s.protocolo)}</td>
        <td><a class="link-detalhe" href="/html/fabricator/detalhe-demanda.html?protocolo=${encodeURIComponent(s.protocolo)}">${e(s.solicitacao)}</a>${s.arquivo3d ? '<br><small class="texto-apoio">Com arquivo 3D</small>' : ''}</td>
        <td>${e(s.requerente)}</td>
        <td>${e(s.categoria)}</td>
        <td>${e(s.material)}</td>
        <td><span class="badge prioridade-${badgeClass(s.prioridade)}">${e(s.prioridade)}</span></td>
        <td>${e(s.prazo)}</td>
        <td>${e(s.abertura)}</td>
        <td class="celula-acoes">
          <div class="acoes-tabela">
            ${botoesAcao(s)}
          </div>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="9" class="estado-vazio">${filaGlobal.length ? 'Nenhuma solicitação encontrada com os filtros.' : 'Nenhuma solicitação nova na fila no momento.'}</td></tr>`;

  const contador = document.querySelector('#contadorFila');
  if (contador) contador.textContent = `${lista.length} de ${filaGlobal.length} solicitações na fila`;
  ativarAcoesDemanda(tbody);
}

function prepararFiltrosFila() {
  ['#buscaFila', '#filtroPrioridadeFila'].forEach(sel => document.querySelector(sel)?.addEventListener('input', renderFila));
  document.querySelector('#limparFiltrosFila')?.addEventListener('click', () => {
    document.querySelector('#buscaFila').value = '';
    document.querySelector('#filtroPrioridadeFila').value = '';
    renderFila();
  });
  document.querySelector('#atualizarFila')?.addEventListener('click', async e => {
    const botao = e.currentTarget;
    botao.classList.add('carregando');
    botao.disabled = true;
    await carregarFila().catch(erro => avisoFabricante(erro.message, true));
    renderFila();
    preencherResumoFabricante();
    botao.classList.remove('carregando');
    botao.disabled = false;
  });
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

  if (precisaDaFila()) {
    try { await carregarFila(); } catch (erro) { filaGlobal = []; avisoFabricante(`Não foi possível carregar a fila: ${erro.message}`, true); }
  }

  preencherResumoFabricante();
  renderDemandasRecentes();
  renderFila();
  prepararFiltrosFila();
  renderCabecalhoDemandas();
  renderDemandasFabricante();
  renderCapacidadeParceiro();
  renderResumoMateriaisFabricante();
  await renderAcoesDemandaDetalhe();
  prepararSeletorColunas();

  document.querySelector('#limparFiltrosFabricante')?.addEventListener('click', () => {
    limparFiltrosAvancados(colunasAtivas());
    renderDemandasFabricante();
  });
});
