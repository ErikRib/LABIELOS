// Login real: o servidor cria uma sessão em cookie HttpOnly.
document.querySelector('#formLogin').addEventListener('submit', async event => {
    event.preventDefault();
    const aviso = document.querySelector('#mensagemLogin');
    aviso.textContent = 'Entrando...';
    try {
        await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#email').value, senha: document.querySelector('#senha').value }) });
        location.href = await painelDoUsuario();
    } catch (erro) { aviso.textContent = erro.message; }
});

// Depois do login, vai para o painel do tipo da organização ativa do
// usuário (solicitante → /html/client/, fabricante → /html/fabricator/).
async function painelDoUsuario() {
    try {
        const { memberships = [] } = await api('/api/me');
        const ativo = memberships.find(m => m.membership_status === 'active' && m.organization_status === 'active');
        if (!ativo) return '/html/perfil.html';
        return ativo.organization_type === 'fabricante' ? '/html/fabricator/index.html' : '/html/client/index.html';
    } catch {
        return '/html/perfil.html';
    }
}
