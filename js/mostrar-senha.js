// Botão "mostrar/ocultar senha" para todo campo de senha da página.
// Basta incluir este script: ele encontra os campos (inclusive os que forem
// criados depois, como em modais) e adiciona o botão com o ícone de olho.
(function () {
  const OLHO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OLHO_FECHADO = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>';

  const estilo = document.createElement('style');
  estilo.textContent = `
    .campo-senha { position: relative; display: block; width: 100%; }
    .campo-senha > input { width: 100%; padding-right: 48px !important; }
    .btn-ver-senha {
      position: absolute; top: 50%; right: 6px; transform: translateY(-50%);
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; padding: 0;
      border: 0; border-radius: 6px; background: transparent; cursor: pointer;
      color: var(--cor-texto-secundario, #5b6472);
    }
    .btn-ver-senha:hover { color: var(--cor-primaria, #0b2740); background: rgba(11, 39, 64, 0.06); }
    .btn-ver-senha:focus-visible { outline: 2px solid var(--cor-primaria, #0b2740); outline-offset: 1px; }
    .btn-ver-senha svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  `;
  document.head.appendChild(estilo);

  function preparar(input) {
    if (input.dataset.verSenha) return;
    input.dataset.verSenha = '1';
    const caixa = document.createElement('span');
    caixa.className = 'campo-senha';
    input.parentNode.insertBefore(caixa, input);
    caixa.appendChild(input);

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-ver-senha';
    const atualizar = () => {
      const visivel = input.type === 'text';
      botao.innerHTML = visivel ? OLHO_FECHADO : OLHO;
      botao.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
      botao.setAttribute('aria-pressed', String(visivel));
      botao.title = visivel ? 'Ocultar senha' : 'Mostrar senha';
    };
    botao.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      atualizar();
      input.focus();
    });
    // Ao enviar o formulário, volta a ocultar (o navegador não salva como texto).
    input.form?.addEventListener('submit', () => { input.type = 'password'; atualizar(); });
    atualizar();
    caixa.appendChild(botao);
  }

  const varrer = raiz => raiz.querySelectorAll?.('input[type="password"]').forEach(preparar);
  const iniciar = () => {
    varrer(document);
    new MutationObserver(lista => lista.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches('input[type="password"]')) preparar(n); else varrer(n);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
