/*
   Administração da organização (html/admin.html).

   Quem acessa: usuários com vínculo role="admin" e
   membership_status="active" em pelo menos uma organização ativa (vem de
   GET /api/me → memberships). O back-end DEVE validar isso de novo em
   cada rota abaixo — esconder a tela aqui é só conveniência.

   Rotas usadas (contrato em docs/backend.md, seção "Administração de
   organizações"):
     GET    /api/organizations/{org_id}/requests
     POST   /api/organizations/{org_id}/requests/{membership_id}   {"approve": true|false}
     GET    /api/organizations/{org_id}/members
     PATCH  /api/organizations/{org_id}/members/{membership_id}    {"role": "admin"|"member"}
     DELETE /api/organizations/{org_id}/members/{membership_id}
     GET    /api/organizations/{org_id}                              (dados de cadastro)
     PATCH  /api/organizations/{org_id}                              (editar dados)
     DELETE /api/organizations/{org_id}                              (remover organização)
*/

const $a = seletor => document.querySelector(seletor);

let adminUsuario = null;
let adminOrganizacoes = [];
let adminOrgAtual = null;
let adminPedidos = [];
let adminMembros = [];

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatarData(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? valor : d.toLocaleDateString('pt-BR');
}

function nomeCompleto(p) {
  return `${p.nome || ''} ${p.sobrenome || ''}`.trim() || '—';
}

function mensagem(texto, erro = false) {
  const el = $a('#adminMensagem');
  el.textContent = texto;
  el.classList.toggle('mensagem-erro', erro);
}

const ROTULO_TIPO = { organizacao: 'Organização solicitante', fabricante: 'Parceiro de manufatura' };
const ROTULO_STATUS = { active: 'Ativa', pending: 'Aguardando verificação' };


/* =========================
   CARREGAMENTO
========================= */

async function iniciarAdmin() {
  let dados;
  try {
    dados = await api('/api/me');
  } catch {
    location.href = '/html/login.html';
    return;
  }

  adminUsuario = dados.user;
  adminOrganizacoes = (dados.memberships || []).filter(m => m.role === 'admin' && m.membership_status === 'active');
  $a('#adminCarregando').hidden = true;

  if (!adminOrganizacoes.length) {
    $a('#adminSemAcesso').hidden = false;
    return;
  }

  if (adminOrganizacoes.length > 1) {
    const seletor = $a('#seletorOrganizacao');
    seletor.innerHTML = adminOrganizacoes.map(m => `<option value="${esc(m.org_id)}">${esc(m.organization)}</option>`).join('');
    seletor.addEventListener('change', () => selecionarOrganizacao(seletor.value));
    $a('#seletorOrganizacaoWrap').hidden = false;
  }

  $a('#adminConteudo').hidden = false;
  await selecionarOrganizacao(adminOrganizacoes[0].org_id);
}

async function selecionarOrganizacao(orgId) {
  adminOrgAtual = adminOrganizacoes.find(m => String(m.org_id) === String(orgId));
  mensagem('');
  renderCabecalhoOrganizacao();
  await Promise.all([recarregarListas(), carregarDadosOrganizacao()]);
}

async function recarregarListas() {
  const base = `/api/organizations/${encodeURIComponent(adminOrgAtual.org_id)}`;
  try {
    [adminPedidos, adminMembros] = await Promise.all([api(`${base}/requests`), api(`${base}/members`)]);
  } catch (erro) {
    adminPedidos = []; adminMembros = [];
    mensagem(`Não foi possível carregar os dados: ${erro.message}`, true);
  }
  renderContadores();
  renderPedidos();
  renderMembros();
}


/* =========================
   RENDERIZAÇÃO
========================= */

function renderCabecalhoOrganizacao() {
  const o = adminOrgAtual;
  $a('[data-org="nome"]').textContent = o.organization;
  $a('[data-org="tipo"]').textContent = ROTULO_TIPO[o.organization_type] || 'Organização';
  const status = o.organization_status || 'active';
  $a('[data-org="status"]').innerHTML = `<span class="badge org-${esc(status)}">${esc(ROTULO_STATUS[status] || status)}</span>`;
}

function renderContadores() {
  const ativos = adminMembros.filter(m => m.membership_status === 'active');
  const valores = {
    pendentes: adminPedidos.length,
    membros: ativos.length,
    admins: ativos.filter(m => m.role === 'admin').length
  };
  document.querySelectorAll('[data-contador]').forEach(el => { el.textContent = valores[el.dataset.contador]; });
}

function renderPedidos() {
  const tbody = $a('#tabelaPedidos tbody');
  tbody.innerHTML = adminPedidos.length
    ? adminPedidos.map(p => `
      <tr>
        <td><strong>${esc(nomeCompleto(p))}</strong></td>
        <td>${esc(p.email)}</td>
        <td>${esc(p.job_title || '—')}</td>
        <td class="admin-justificativa">${esc(p.justification || '—')}</td>
        <td>${esc(formatarData(p.created_at))}</td>
        <td class="celula-acoes">
          <div class="acoes-tabela">
            <button type="button" class="btn btn-acao-tabela btn-principal" data-decidir="${esc(p.membership_id)}" data-aprovar="true">Aprovar</button>
            <button type="button" class="btn btn-acao-tabela btn-perigo" data-decidir="${esc(p.membership_id)}" data-aprovar="false">Recusar</button>
          </div>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="estado-vazio">Nenhum pedido de ingresso pendente.</td></tr>';

  tbody.querySelectorAll('[data-decidir]').forEach(b =>
    b.addEventListener('click', () => decidirPedido(b.dataset.decidir, b.dataset.aprovar === 'true', b)));
}

function renderMembros() {
  const tbody = $a('#tabelaMembros tbody');
  const busca = ($a('#buscaMembro').value || '').trim().toLowerCase();
  const lista = adminMembros
    .filter(m => m.membership_status === 'active')
    .filter(m => !busca || [nomeCompleto(m), m.email, m.job_title].join(' ').toLowerCase().includes(busca));

  tbody.innerHTML = lista.length
    ? lista.map(m => {
      const euMesmo = String(m.user_id) === String(adminUsuario.id);
      const admin = m.role === 'admin';
      return `
      <tr>
        <td><strong>${esc(nomeCompleto(m))}</strong>${euMesmo ? ' <small class="texto-apoio">(você)</small>' : ''}</td>
        <td>${esc(m.email)}</td>
        <td>${esc(m.job_title || '—')}</td>
        <td><span class="badge papel-${admin ? 'admin' : 'membro'}">${admin ? 'Administrador' : 'Membro'}</span></td>
        <td>${esc(formatarData(m.joined_at || m.created_at))}</td>
        <td class="celula-acoes">
          <div class="acoes-tabela">
            ${euMesmo ? '<span class="texto-apoio">—</span>' : `
            <button type="button" class="btn btn-acao-tabela btn-secundario" data-papel="${esc(m.membership_id)}" data-novo-papel="${admin ? 'member' : 'admin'}">${admin ? 'Remover admin' : 'Tornar admin'}</button>
            <button type="button" class="btn btn-acao-tabela btn-perigo" data-remover="${esc(m.membership_id)}">Remover</button>`}
          </div>
        </td>
      </tr>`;
    }).join('')
    : `<tr><td colspan="6" class="estado-vazio">${busca ? 'Nenhum membro encontrado.' : 'Nenhum membro ativo.'}</td></tr>`;

  tbody.querySelectorAll('[data-papel]').forEach(b => b.addEventListener('click', () => alterarPapel(b.dataset.papel, b.dataset.novoPapel, b)));
  tbody.querySelectorAll('[data-remover]').forEach(b => b.addEventListener('click', () => removerMembro(b.dataset.remover, b)));
}


/* =========================
   AÇÕES
========================= */

const baseOrg = () => `/api/organizations/${encodeURIComponent(adminOrgAtual.org_id)}`;

async function executar(botao, acao, sucesso) {
  botao.disabled = true;
  try {
    await acao();
    mensagem(sucesso);
    await recarregarListas();
    setTimeout(() => location.reload(), 700);
  } catch (erro) {
    mensagem(erro.message, true);
    botao.disabled = false;
  }
}

function decidirPedido(membershipId, aprovar, botao) {
  const p = adminPedidos.find(x => String(x.membership_id) === String(membershipId));
  if (!aprovar && !confirm(`Recusar o pedido de ${nomeCompleto(p)}?`)) return;
  executar(botao,
    () => api(`${baseOrg()}/requests/${encodeURIComponent(membershipId)}`, { method: 'POST', body: JSON.stringify({ approve: aprovar }) }),
    aprovar ? `${nomeCompleto(p)} agora é membro da organização.` : `Pedido de ${nomeCompleto(p)} recusado.`);
}

function alterarPapel(membershipId, papel, botao) {
  const m = adminMembros.find(x => String(x.membership_id) === String(membershipId));
  const texto = papel === 'admin'
    ? `Tornar ${nomeCompleto(m)} administrador? Essa pessoa poderá aprovar e remover membros.`
    : `Remover o papel de administrador de ${nomeCompleto(m)}?`;
  if (!confirm(texto)) return;
  executar(botao,
    () => api(`${baseOrg()}/members/${encodeURIComponent(membershipId)}`, { method: 'PATCH', body: JSON.stringify({ role: papel }) }),
    'Papel atualizado.');
}

function removerMembro(membershipId, botao) {
  const m = adminMembros.find(x => String(x.membership_id) === String(membershipId));
  if (!confirm(`Remover ${nomeCompleto(m)} da organização? O acesso aos painéis será revogado.`)) return;
  executar(botao,
    () => api(`${baseOrg()}/members/${encodeURIComponent(membershipId)}`, { method: 'DELETE' }),
    `Vínculo de ${nomeCompleto(m)} removido da organização.`);
}


/* =========================
   DADOS DA ORGANIZAÇÃO
========================= */

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CAMPOS_ENDERECO = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
let dadosOrganizacao = null;

function cnpjValido(valor) {
  const n = valor.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const dig = (base, pesos) => { const r = [...base].reduce((t, d, i) => t + Number(d) * pesos[i], 0) % 11; return r < 2 ? 0 : 11 - r; };
  const d1 = dig(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dig(n.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return n.endsWith(`${d1}${d2}`);
}

async function carregarDadosOrganizacao() {
  try {
    dadosOrganizacao = await api(baseOrg());
    preencherFormularioOrganizacao();
  } catch (erro) {
    $a('#mensagemDados').textContent = `Não foi possível carregar os dados: ${erro.message}`;
    $a('#mensagemDados').classList.add('mensagem-erro');
  }
}

function preencherFormularioOrganizacao() {
  const f = $a('#formDadosOrganizacao');
  const o = dadosOrganizacao;
  f.elements.nome.value = o.nome || '';
  f.elements.cnpj.value = o.cnpj || '';
  f.elements.email_institucional.value = o.email_institucional || '';
  f.elements.telefone_institucional.value = o.telefone_institucional || '';
  $a('#orgTipo').value = ROTULO_TIPO[o.tipo] || o.tipo;
  // Fabricante: pelo menos um endereço (local de produção e retirada).
  const fabricante = o.tipo === 'fabricante';
  // Organização solicitante não tem local de retirada: a seção some.
  $a('.admin-enderecos').hidden = !fabricante;
  $a('#orgEnderecoObrigatorio').hidden = !fabricante;
  $a('#ajudaEnderecos').textContent = fabricante
    ? 'Locais onde as peças podem ser retiradas. Ao concluir uma produção, você escolhe um deles. Obrigatório ter pelo menos um.'
    : 'Opcional para organizações solicitantes.';
  $a('#listaEnderecos').replaceChildren();
  (o.enderecos || []).forEach(e => adicionarCartaoEndereco(e));
  if (fabricante && !(o.enderecos || []).length) adicionarCartaoEndereco();
  atualizarRemocaoEnderecos();
  $a('[data-org="nome-confirmacao"]').textContent = o.nome;
  $a('#confirmarRemocao').value = '';
  $a('#btnRemoverOrganizacao').disabled = true;
}

async function salvarDadosOrganizacao(e) {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = $a('#mensagemDados');
  f.elements.cnpj.setCustomValidity(cnpjValido(f.elements.cnpj.value) ? '' : 'Informe um CNPJ válido.');
  if (!f.reportValidity()) return;
  const corpo = {
    nome: f.elements.nome.value.trim(),
    cnpj: f.elements.cnpj.value.trim(),
    email_institucional: f.elements.email_institucional.value.trim(),
    telefone_institucional: f.elements.telefone_institucional.value.trim(),
    // Só parceiros de manufatura têm endereços de retirada.
    ...(dadosOrganizacao.tipo === 'fabricante' ? { enderecos: lerEnderecos() } : {})
  };
  const botao = f.querySelector('[type="submit"]');
  botao.disabled = true;
  try {
    dadosOrganizacao = await api(baseOrg(), { method: 'PATCH', body: JSON.stringify(corpo) });
    // O nome pode ter mudado: atualiza cabeçalho, seletor e vínculo em memória.
    adminOrgAtual.organization = dadosOrganizacao.nome;
    const opcao = $a(`#seletorOrganizacao option[value="${CSS.escape(String(adminOrgAtual.org_id))}"]`);
    if (opcao) opcao.textContent = dadosOrganizacao.nome;
    renderCabecalhoOrganizacao();
    preencherFormularioOrganizacao();
    msg.textContent = 'Dados da organização atualizados.';
    msg.classList.remove('mensagem-erro');
    setTimeout(() => location.reload(), 700);
  } catch (erro) {
    msg.textContent = erro.message;
    msg.classList.add('mensagem-erro');
  } finally {
    botao.disabled = false;
  }
}

// Um cartão por endereço. Os campos não têm `name` (são lidos por
// data-campo), então vários cartões convivem no mesmo formulário.
let contadorEndereco = 0;
function adicionarCartaoEndereco(e = {}) {
  const n = ++contadorEndereco;
  const id = campo => `end${n}-${campo}`;
  const cartao = document.createElement('fieldset');
  cartao.className = 'admin-endereco';
  cartao.dataset.enderecoId = e.id || '';
  const campo = (c, rotulo, extra = '') => `<div class="campo campo-${c}"><label for="${id(c)}">${rotulo}</label>` +
    `<input id="${id(c)}" data-campo="${c}" value="${esc(e[c] || '')}" ${extra}></div>`;
  cartao.innerHTML = `
    <legend class="acess-item-screen-reader">Endereço</legend>
    <div class="admin-endereco-topo">
      <div class="campo campo-nome-local"><label for="${id('nome')}">Nome do local *</label>
        <input id="${id('nome')}" data-campo="nome" required maxlength="60" placeholder="Ex.: Sede, Unidade Centro" value="${esc(e.nome || '')}"></div>
      <button type="button" class="btn-texto btn-remover-endereco">Remover endereço</button>
    </div>
    <div class="form-grid endereco-grid-admin">
      ${campo('cep', 'CEP *', 'required inputmode="numeric" maxlength="9" placeholder="00000-000"')}
      ${campo('logradouro', 'Rua / avenida *', 'required maxlength="150"')}
      ${campo('numero', 'Número *', 'required maxlength="10"')}
      ${campo('complemento', 'Complemento', 'maxlength="80" placeholder="Opcional"')}
      ${campo('bairro', 'Bairro *', 'required maxlength="80"')}
      ${campo('cidade', 'Cidade *', 'required maxlength="80"')}
      <div class="campo campo-uf"><label for="${id('uf')}">UF *</label><select id="${id('uf')}" data-campo="uf" required>
        <option value="">—</option>${UFS.map(uf => `<option${uf === e.uf ? ' selected' : ''}>${uf}</option>`).join('')}</select></div>
    </div>
    <small class="campo-ajuda" data-status-cep role="status"></small>`;

  cartao.querySelector('.btn-remover-endereco').addEventListener('click', () => {
    cartao.remove();
    atualizarRemocaoEnderecos();
  });
  // CEP: máscara e preenchimento pelo ViaCEP (se falhar, preenche à mão).
  const cep = cartao.querySelector('[data-campo="cep"]');
  cep.addEventListener('input', async () => {
    const v = cep.value.replace(/\D/g, '').slice(0, 8);
    cep.value = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
    const status = cartao.querySelector('[data-status-cep]');
    status.textContent = '';
    if (v.length !== 8) return;
    status.textContent = 'Buscando endereço…';
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${v}/json/`)).json();
      if (d.erro) { status.textContent = 'CEP não encontrado. Preencha manualmente.'; return; }
      [['logradouro', d.logradouro], ['bairro', d.bairro], ['cidade', d.localidade], ['uf', d.uf]].forEach(([c, valor]) => {
        const el = cartao.querySelector(`[data-campo="${c}"]`);
        if (valor && !el.value) el.value = valor;
      });
      status.textContent = '';
      cartao.querySelector('[data-campo="numero"]').focus();
    } catch {
      status.textContent = 'Não foi possível consultar o CEP. Preencha manualmente.';
    }
  });
  $a('#listaEnderecos').appendChild(cartao);
  atualizarRemocaoEnderecos();
  return cartao;
}

// Fabricante não pode ficar sem endereço: esconde "Remover" do último.
function atualizarRemocaoEnderecos() {
  const cartoes = [...document.querySelectorAll('#listaEnderecos .admin-endereco')];
  const minimo = dadosOrganizacao?.tipo === 'fabricante' ? 1 : 0;
  cartoes.forEach(c => { c.querySelector('.btn-remover-endereco').hidden = cartoes.length <= minimo; });
}

function lerEnderecos() {
  return [...document.querySelectorAll('#listaEnderecos .admin-endereco')].map(cartao => {
    const e = Object.fromEntries(['nome', ...CAMPOS_ENDERECO].map(c => [c, cartao.querySelector(`[data-campo="${c}"]`).value.trim()]));
    if (cartao.dataset.enderecoId) e.id = cartao.dataset.enderecoId;
    return e;
  });
}

async function removerOrganizacao() {
  const msg = $a('#mensagemRemocao');
  if ($a('#confirmarRemocao').value.trim() !== dadosOrganizacao.nome) return;
  const botao = $a('#btnRemoverOrganizacao');
  botao.disabled = true;
  try {
    await api(baseOrg(), { method: 'DELETE' });
    // A API encerra todos os vínculos e sessões da organização.
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* sessão já revogada */ }
    location.href = '/index.html';
  } catch (erro) {
    msg.textContent = erro.message;   // ex.: 409 com solicitações em andamento
    botao.disabled = false;
  }
}

function prepararDadosOrganizacao() {
  $a('#btnAdicionarEndereco').addEventListener('click', () => adicionarCartaoEndereco().querySelector('input').focus());
  $a('#formDadosOrganizacao').addEventListener('submit', salvarDadosOrganizacao);
  $a('#formDadosOrganizacao').elements.cnpj.addEventListener('input', e => e.target.setCustomValidity(''));
  $a('#btnDescartarDados').addEventListener('click', () => { preencherFormularioOrganizacao(); $a('#mensagemDados').textContent = ''; });
  $a('#confirmarRemocao').addEventListener('input', e => {
    $a('#btnRemoverOrganizacao').disabled = e.target.value.trim() !== dadosOrganizacao?.nome;
    $a('#mensagemRemocao').textContent = '';
  });
  $a('#btnRemoverOrganizacao').addEventListener('click', removerOrganizacao);
}


/* =========================
   ABAS
========================= */

function prepararAbas() {
  const abas = [...document.querySelectorAll('.admin-abas [role="tab"]')];
  const ativar = aba => {
    abas.forEach(a => {
      const ativa = a === aba;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !ativa;
    });
  };
  // Link direto para uma aba: admin.html#pedidos, #membros ou #dados.
  const porHash = () => {
    const id = { '#pedidos': 'abaPedidos', '#membros': 'abaMembros', '#dados': 'abaDados' }[location.hash];
    if (id) ativar(document.getElementById(id));
  };
  porHash();
  window.addEventListener('hashchange', porHash);
  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => ativar(aba));
    aba.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const proxima = abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      ativar(proxima);
      proxima.focus();
    });
  });
}

prepararAbas();
prepararDadosOrganizacao();
$a('#buscaMembro').addEventListener('input', renderMembros);
iniciarAdmin();
