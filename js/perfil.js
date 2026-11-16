// Perfil autenticado: carrega e atualiza os dados no backend.
const $ = seletor => document.querySelector(seletor);
const aviso = (seletor, texto) => { $(seletor).textContent = texto; };
let emailUsuario = '';

// Traduz os status "crus" do back-end para um texto natural, sem jargão.
const textoStatusOrganizacao = status => ({ active: 'ativa' }[status] || status);
const textoStatusVinculo = status => ({
  active: 'ativo',
  pending: 'aguardando aprovação',
  rejected: 'recusado',
  removed: 'encerrado',
}[status] || status);

// O link "voltar" e a navbar do painel certo vêm de js/navbar-painel.js.
async function carregarPerfil() {
  try {
    const { user, memberships } = await api('/api/me');
    $('#nomePerfil').value = user.nome;
    $('#sobrenomePerfil').value = user.sobrenome;
    $('#telefonePerfil').value = user.telefone || '';
    $('#emailAtual').textContent = user.email;
    if (user.foto) $('#fotoPreview').src = user.foto + '?v=' + Date.now();
    renderizarOrganizacoes(memberships);
    // Atalho para html/admin.html só para administradores ativos.
    $('#linkAdmin').hidden = !memberships.some(m => m.role === 'admin' && m.membership_status === 'active');
    $('#emailConfirmacaoConta').textContent = user.email;
    emailUsuario = user.email;
  } catch { location.href = '/html/login.html'; }
}
// Lista "Organização": uma linha por vínculo, com o cargo editável
// (o cargo é por vínculo — a mesma pessoa pode ter cargos diferentes
// em organizações diferentes, por isso não fica em "Dados pessoais").
function renderizarOrganizacoes(memberships) {
  const lista = $('#minhasOrganizacoes');
  lista.innerHTML = '';
  if (!memberships.length) {
    const li = document.createElement('li');
    li.className = 'texto-detalhe';
    li.textContent = 'Nenhum vínculo institucional cadastrado.';
    lista.append(li);
    return;
  }
  memberships.forEach(m => {
    const li = document.createElement('li');
    li.className = 'organizacao-item';

    const info = document.createElement('p');
    info.className = 'texto-detalhe';
    info.textContent = `${m.organization} (organização ${textoStatusOrganizacao(m.organization_status)}, vínculo ${textoStatusVinculo(m.membership_status)})`;
    li.append(info);

    const linhaCargo = document.createElement('div');
    linhaCargo.className = 'organizacao-cargo';

    const textoCargo = document.createElement('span');
    textoCargo.textContent = m.job_title ? `Cargo: ${m.job_title}` : 'Cargo não informado';
    linhaCargo.append(textoCargo);

    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'btn-texto';
    btnEditar.textContent = 'Editar cargo';
    linhaCargo.append(btnEditar);

    btnEditar.addEventListener('click', () => iniciarEdicaoCargo(linhaCargo, m, textoCargo, btnEditar));

    li.append(linhaCargo);
    lista.append(li);
  });
}

function iniciarEdicaoCargo(linhaCargo, membership, textoCargo, btnEditar) {
  linhaCargo.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 80;
  input.value = membership.job_title || '';
  input.placeholder = 'Ex.: Fisioterapeuta, Técnico de laboratório...';
  input.setAttribute('aria-label', `Cargo em ${membership.organization}`);

  const btnSalvar = document.createElement('button');
  btnSalvar.type = 'button';
  btnSalvar.className = 'btn btn-principal btn-pequeno';
  btnSalvar.textContent = 'Salvar';

  const btnCancelar = document.createElement('button');
  btnCancelar.type = 'button';
  btnCancelar.className = 'btn btn-secundario btn-pequeno';
  btnCancelar.textContent = 'Cancelar';

  const erro = document.createElement('p');
  erro.className = 'organizacao-cargo-erro';

  linhaCargo.append(input, btnSalvar, btnCancelar, erro);
  input.focus();

  const restaurar = (novoCargo) => {
    if (novoCargo !== undefined) membership.job_title = novoCargo;
    linhaCargo.innerHTML = '';
    const textoAtualizado = document.createElement('span');
    textoAtualizado.textContent = membership.job_title ? `Cargo: ${membership.job_title}` : 'Cargo não informado';
    linhaCargo.append(textoAtualizado, btnEditar);
  };

  btnCancelar.addEventListener('click', () => restaurar());
  btnSalvar.addEventListener('click', async () => {
    const cargo = input.value.trim();
    if (!cargo) { erro.textContent = 'Informe o cargo.'; return; }
    btnSalvar.disabled = true;
    try {
      await api(`/api/me/memberships/${membership.membership_id}/cargo`, {
        method: 'PATCH', body: JSON.stringify({ cargo }),
      });
      restaurar(cargo);
    } catch (e) {
      erro.textContent = e.message;
      btnSalvar.disabled = false;
    }
  });
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
    setTimeout(() => location.reload(), 700);
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
// Requisitos da nova senha com feedback ao vivo (mesmo padrão de recuperar-senha.html).
function conferirRequisitosPerfil() {
  const senha = $('#novaSenha').value;
  const confirmacao = $('#confirmarNovaSenha').value;
  const tamanho = senha.length >= 8;
  const iguais = tamanho && senha === confirmacao;
  $('#perfilReqTamanho').classList.toggle('ok', tamanho);
  $('#perfilReqIguais').classList.toggle('ok', iguais);
  return tamanho && iguais;
}
$('#novaSenha').addEventListener('input', conferirRequisitosPerfil);
$('#confirmarNovaSenha').addEventListener('input', conferirRequisitosPerfil);

$('#formSenha').addEventListener('submit', async event => {
  event.preventDefault();
  if (!conferirRequisitosPerfil()) {
    aviso('#mensagemSeguranca', 'A senha precisa ter 8 caracteres ou mais e as duas devem ser iguais.');
    return;
  }
  try {
    const result = await api('/api/me/password', { method: 'POST', body: JSON.stringify({ senha_atual: $('#senhaAtual').value, nova_senha: $('#novaSenha').value }) });
    alert(result.message); location.href = '/html/login.html';
  } catch (erro) { aviso('#mensagemSeguranca', erro.message); }
});

// Excluir conta: só libera o botão quando o e-mail digitado bate com o da conta.
$('#confirmarExclusaoConta').addEventListener('input', e => {
  $('#btnExcluirConta').disabled = e.target.value.trim() !== emailUsuario;
});
$('#btnExcluirConta').addEventListener('click', async () => {
  if ($('#confirmarExclusaoConta').value.trim() !== emailUsuario) return;
  const botao = $('#btnExcluirConta');
  botao.disabled = true;
  try {
    await api('/api/me', { method: 'DELETE' });
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* sessão já encerrada */ }
    location.href = '/index.html';
  } catch (erro) {
    aviso('#mensagemExclusaoConta', erro.message);   // ex.: 409 sendo único admin de uma organização
    botao.disabled = false;
  }
});

