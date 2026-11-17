// Requisições para a API na mesma origem do site.
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Não foi possível concluir a operação.');
  return data;
}

// Painel de destino depois de entrar (login ou cadastro de organização
// nova): o tipo da primeira organização ativa decide entre a área da
// organização solicitante e a do fabricante.
async function destinoAposEntrar() {
  try {
    const { memberships = [] } = await api('/api/me');
    const ativo = memberships.find(m => m.membership_status === 'active' && m.organization_status === 'active');
    if (!ativo) return '/html/perfil.html';
    return ativo.organization_type === 'fabricante' ? '/html/fabricator/index.html' : '/html/client/index.html';
  } catch {
    return '/html/perfil.html';
  }
}

// Campos de código de 6 dígitos: ao colar, descarta espaços e qualquer
// outro caractere que venha junto (ex.: "4 7 7 4 9 1" copiado de um e-mail),
// para que o maxlength não corte o código no meio.
document.addEventListener('paste', (evento) => {
  const campo = evento.target;
  if (!(campo instanceof HTMLInputElement) || campo.getAttribute('pattern') !== '[0-9]{6}') return;
  const texto = (evento.clipboardData || window.clipboardData).getData('text');
  const digitos = texto.replace(/\D/g, '').slice(0, 6);
  if (!digitos) return;
  evento.preventDefault();
  campo.value = digitos;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
});
