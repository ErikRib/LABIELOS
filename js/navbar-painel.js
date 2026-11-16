/* =========================================================================
   NAVBAR DAS PÁGINAS COMPARTILHADAS (perfil.html e admin.html)
   -------------------------------------------------------------------------
   Estas páginas servem aos dois painéis, então não têm um menu fixo no
   HTML. Este script desenha no <header class="painel-header"> a mesma
   navbar dos painéis (links + menu de perfil), escolhendo o painel:
     1. pela página de onde o usuário veio (/html/client/ ou /html/fabricator/);
     2. senão, pelo tipo da primeira organização ativa do usuário.
   Depende só de js/api.js (não carrega js/prototipo.js).
========================================================================= */

const NAV_PAINEIS = {
  organizacao: {
    inicio: '/html/client/index.html',
    links: [
      ['Início', '/html/client/index.html'],
      ['Solicitações', '/html/client/solicitacoes.html'],
      ['Parceiros', '/html/client/parceiros.html'],
      ['Materiais', '/html/client/materiais.html'],
      ['Relatórios', '/html/client/relatorios.html']
    ]
  },
  fabricante: {
    inicio: '/html/fabricator/index.html',
    links: [
      ['Visão geral', '/html/fabricator/index.html'],
      ['Novas solicitações', '/html/fabricator/fila.html'],
      ['Demandas', '/html/fabricator/demandas.html'],
      ['Impressoras', '/html/fabricator/impressoras.html'],
      ['Materiais', '/html/fabricator/materiais.html']
    ]
  }
};

function escNav(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function painelDoUsuario(memberships) {
  if (document.referrer.includes('/html/fabricator/')) return 'fabricante';
  if (document.referrer.includes('/html/client/')) return 'organizacao';
  const ativa = (memberships || []).find(m => m.membership_status === 'active');
  return ativa?.organization_type === 'fabricante' ? 'fabricante' : 'organizacao';
}

function desenharNavbar(user, memberships) {
  const header = document.querySelector('.painel-header');
  if (!header) return;
  const painel = NAV_PAINEIS[painelDoUsuario(memberships)];
  const nome = `${user.nome || ''} ${user.sobrenome || ''}`.trim();
  const org = user.organizacao || (memberships || []).find(m => m.membership_status === 'active')?.organization || '';
  const admin = (memberships || []).some(m => m.role === 'admin' && m.membership_status === 'active');
  const aqui = location.pathname;
  const atual = href => (aqui === href ? ' aria-current="page"' : '');

  header.innerHTML = `
    <nav class="nav-principal painel-nav" aria-label="Navegação principal">
      <a href="${painel.inicio}" title="LABIELOS" class="nav-logo"><img src="/content/img/logo-simples.png" alt="Logo do LABIELOS"></a>
      <ul class="nav-links" id="navLinks">
        ${painel.links.map(([texto, href]) => `<li><a href="${href}">${texto}</a></li>`).join('')}
      </ul>
      <div class="nav-acoes">
        <div class="nav-perfil-wrap">
          <button class="nav-perfil" type="button" aria-expanded="false" aria-haspopup="true">
            <img src="${user.foto || '/content/img/user.png'}" alt="Foto de perfil do usuário">
            <span class="nav-identidade"><strong>${escNav(nome)}</strong><small>${escNav(org)}</small></span>
            <span class="nav-seta" aria-hidden="true">▾</span>
          </button>
          <div class="perfil-menu" hidden>
            <div class="perfil-menu-identidade"><strong>${escNav(nome)}</strong><span>${escNav(org)}</span></div>
            <a href="/html/perfil.html" class="perfil-menu-item"${atual('/html/perfil.html')}>Meu perfil</a>
            ${admin ? `<a href="/html/admin.html" class="perfil-menu-item perfil-menu-admin"${atual('/html/admin.html')}>Administração</a>` : ''}
            <a href="/index.html" class="perfil-menu-item perfil-sair">Sair</a>
          </div>
        </div>
      </div>
    </nav>`;

  const botao = header.querySelector('.nav-perfil');
  const menu = header.querySelector('.perfil-menu');
  const fechar = () => { menu.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
  botao.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    botao.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', fechar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { fechar(); botao.focus(); } });
  header.querySelector('.perfil-sair').addEventListener('click', async e => {
    e.preventDefault();
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* segue para o login */ }
    location.href = '/html/login.html';
  });

  // "← Voltar ao painel" acompanha o painel escolhido.
  const voltar = document.querySelector('#linkVoltar');
  if (voltar) voltar.href = painel.inicio;
}

(async () => {
  try {
    const { user, memberships = [] } = await api('/api/me');
    desenharNavbar(user, memberships);
  } catch {
    // Sem sessão: a própria página (perfil.js / admin.js) trata o redirecionamento.
  }
})();
