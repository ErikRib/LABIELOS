// Perfil autenticado: carrega e atualiza os dados no backend.
const $ = seletor => document.querySelector(seletor);
const aviso = (seletor, texto) => { $(seletor).textContent = texto; };

// Esta página é compartilhada pelos dois painéis (AACD e fabricante), então
// o link de "voltar" é ajustado conforme de onde o usuário veio.
const linkVoltar = $('#linkVoltar');
if (linkVoltar && document.referrer.includes('/html/fabricante/')) {
  linkVoltar.href = '/html/fabricante/index.html';
}
async function carregarPerfil() {
  try {
    const { user, memberships } = await api('/api/me');
    $('#nomePerfil').value = user.nome;
    $('#sobrenomePerfil').value = user.sobrenome;
    $('#telefonePerfil').value = user.telefone || '';
    $('#emailAtual').textContent = user.email;
    if (user.foto) $('#fotoPreview').src = user.foto + '?v=' + Date.now();
    $('#minhasOrganizacoes').textContent = memberships.length
      ? memberships.map(m => `${m.organization} — organização: ${m.organization_status}; vínculo: ${m.membership_status}`).join(' | ')
      : 'Nenhum vínculo institucional cadastrado.';
  } catch { location.href = '/html/login.html'; }
}
carregarPerfil();

$('#formPerfil').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api('/api/me', { method: 'PATCH', body: JSON.stringify({ nome: $('#nomePerfil').value, sobrenome: $('#sobrenomePerfil').value, telefone: $('#telefonePerfil').value }) });
    const arquivo = $('#foto').files[0];
    if (arquivo) {
      if (arquivo.size > 2*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(arquivo.type)) throw new Error('Imagem inválida. Use JPG, PNG ou WebP até 2 MB.');
      const dados = new FormData(); dados.append('photo', arquivo);
      await api('/api/me/photo', { method: 'POST', body: dados });
      $('#fotoPreview').src = '/api/me/photo?v=' + Date.now();
    }
    aviso('#mensagemPerfil', 'Alterações salvas.');
  } catch (erro) { aviso('#mensagemPerfil', erro.message); }
});

$('#formEmail').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await api('/api/me/email/start', { method: 'POST', body: JSON.stringify({ novo_email: $('#novoEmail').value, senha_atual: $('#senhaAtualEmail').value }) });
    $('#formConfirmarEmail').hidden = false;
    aviso('#mensagemSeguranca', result.message);
  } catch (erro) { aviso('#mensagemSeguranca', erro.message); }
});
$('#formConfirmarEmail').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await api('/api/me/email/confirm', { method: 'POST', body: JSON.stringify({ codigo: $('#codigoEmail').value }) });
    alert(result.message); location.href = '/html/login.html';
  } catch (erro) { aviso('#mensagemSeguranca', erro.message); }
});
$('#formSenha').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const result = await api('/api/me/password', { method: 'POST', body: JSON.stringify({ senha_atual: $('#senhaAtual').value, nova_senha: $('#novaSenha').value }) });
    alert(result.message); location.href = '/html/login.html';
  } catch (erro) { aviso('#mensagemSeguranca', erro.message); }
});
$('#btnSair').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); location.href = '/html/login.html'; }
  catch (erro) { aviso('#mensagemSeguranca', erro.message); }
});
