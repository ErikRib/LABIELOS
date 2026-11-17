// Formulário de contato: envia para POST /api/contato, que repassa por e-mail.
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formContato');
  const status = document.getElementById('contatoStatus');
  if (!form) return;
  const botao = form.querySelector('button[type="submit"]');

  function mostrar(texto, tipo) {
    status.textContent = texto;
    status.dataset.tipo = tipo;
    status.hidden = false;
  }

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!form.reportValidity()) return;

    const dados = Object.fromEntries(new FormData(form));
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Enviando...';
    status.hidden = true;
    try {
      const resposta = await api('/api/contato', { method: 'POST', body: JSON.stringify(dados) });
      mostrar(resposta.message, 'sucesso');
      form.reset();
    } catch (erro) {
      mostrar(erro.message, 'erro');
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  });
});
