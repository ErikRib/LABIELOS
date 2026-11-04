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
  ajustarLinkVoltar(dados.memberships || []);
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

// Volta para o painel certo: pelo referenciador ou pelo tipo da organização.
function ajustarLinkVoltar(memberships) {
  const link = $a('#linkVoltar');
  const fabricante = document.referrer.includes('/html/fabricator/')
    || (!document.referrer.includes('/html/client/') && memberships.some(m => m.organization_type === 'fabricante'));
  if (fabricante) link.href = '/html/fabricator/index.html';
}

async function selecionarOrganizacao(orgId) {
  adminOrgAtual = adminOrganizacoes.find(m => String(m.org_id) === String(orgId));
  mensagem('');
  renderCabecalhoOrganizacao();
  await recarregarListas();
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
          <button type="button" class="btn btn-acao-tabela btn-principal" data-decidir="${esc(p.membership_id)}" data-aprovar="true">Aprovar</button>
          <button type="button" class="btn btn-acao-tabela btn-perigo" data-decidir="${esc(p.membership_id)}" data-aprovar="false">Recusar</button>
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
          ${euMesmo ? '<span class="texto-apoio">—</span>' : `
          <button type="button" class="btn btn-acao-tabela btn-secundario" data-papel="${esc(m.membership_id)}" data-novo-papel="${admin ? 'member' : 'admin'}">${admin ? 'Remover admin' : 'Tornar admin'}</button>
          <button type="button" class="btn btn-acao-tabela btn-perigo" data-remover="${esc(m.membership_id)}">Remover</button>`}
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
$a('#buscaMembro').addEventListener('input', renderMembros);
$a('#btnSair').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* segue para o login */ }
  location.href = '/html/login.html';
});
iniciarAdmin();
