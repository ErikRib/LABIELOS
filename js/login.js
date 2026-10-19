// Login real: o servidor cria uma sessão em cookie HttpOnly.
document.querySelector('#formLogin').addEventListener('submit', async event => {
    event.preventDefault();
    const aviso = document.querySelector('#mensagemLogin');
    aviso.textContent = 'Entrando...';
    try {
        await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#email').value, senha: document.querySelector('#senha').value }) });
        location.href = '/html/perfil.html';
    } catch (erro) { aviso.textContent = erro.message; }
});
