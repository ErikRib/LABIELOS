/*
   Motor de filtros avançados reutilizado pelas páginas de listagem
   (Solicitações da organização solicitante e Demandas do fabricante). Cada coluna filtrável
   declara um tipo ('texto' ou 'data'); os modos disponíveis mudam
   conforme o tipo.

   Interação: o campo de filtro funciona como um campo de texto comum
   (clicar e digitar já filtra, usando o modo padrão da coluna). Um
   botão com um ícone, dentro do próprio campo, abre um pequeno menu
   para trocar o modo (Contém / Igual a / Diferente de / Entre), no
   estilo do filtro do Deep Freeze Cloud (Faronics) — o ícone é opcional
   para quem só quer digitar e filtrar.
*/

const MODOS_TEXTO = [
  { valor: 'contem', label: 'Contém' },
  { valor: 'igual', label: 'Igual a' },
  { valor: 'diferente', label: 'Diferente de' }
];

const MODOS_DATA = [
  { valor: 'igual', label: 'Igual a' },
  { valor: 'diferente', label: 'Diferente de' },
  { valor: 'entre', label: 'Entre' }
];

function modosDoTipo(tipo) {
  return tipo === 'data' ? MODOS_DATA : MODOS_TEXTO;
}

function modoPadrao(tipo) {
  return tipo === 'data' ? 'igual' : 'contem';
}

// Gera o HTML de uma célula de filtro: campo principal (com o botão de
// modo embutido) e, escondido por padrão, o segundo campo usado só no
// modo "Entre" (intervalo de datas).
function criarCelulaFiltro(coluna) {
  const tipoInput = coluna.tipo === 'data' ? 'date' : 'text';
  const opcoesMenu = modosDoTipo(coluna.tipo)
    .map(m => `<button type="button" class="filtro-modo-opcao" data-valor="${m.valor}">${m.label}</button>`)
    .join('');

  return `
    <div class="filtro-coluna">
      <div class="filtro-campo" data-filtro-campo="${coluna.chave}" data-modo-atual="${modoPadrao(coluna.tipo)}">
        <input type="${tipoInput}" class="filtro-valor" data-filtro-valor="${coluna.chave}" data-indice="0"
          aria-label="Valor do filtro para ${coluna.label}" placeholder="${coluna.tipo === 'data' ? '' : 'Filtrar...'}">
        <button type="button" class="filtro-modo-botao" data-filtro-modo-botao="${coluna.chave}"
          aria-haspopup="true" aria-expanded="false" aria-label="Escolher modo de filtro para ${coluna.label}">
          <span aria-hidden="true">▾</span>
        </button>
        <div class="filtro-modo-menu" data-filtro-modo-menu="${coluna.chave}" hidden>
          ${opcoesMenu}
        </div>
      </div>
      <input type="${tipoInput}" class="filtro-valor filtro-valor-secundario" data-filtro-valor="${coluna.chave}"
        data-indice="1" aria-label="Segundo valor do filtro para ${coluna.label}" placeholder="até" hidden>
    </div>`;
}

function converterDataBr(valor) {
  if (!valor) return null;
  const partes = String(valor).split(' ')[0].split('/');
  if (partes.length !== 3) return null;
  const [dia, mes, ano] = partes.map(Number);
  if (!dia || !mes || !ano) return null;
  return new Date(ano, mes - 1, dia);
}

// Lê o estado atual de cada filtro diretamente do DOM (modo escolhido
// no menu + valor(es) digitado(s)) e descarta colunas sem valor.
function lerFiltros(colunas) {
  return colunas
    .map(coluna => {
      const campo = document.querySelector(`[data-filtro-campo="${coluna.chave}"]`);
      const modo = campo ? campo.dataset.modoAtual : modoPadrao(coluna.tipo);
      const valores = [...document.querySelectorAll(`[data-filtro-valor="${coluna.chave}"]`)]
        .sort((a, b) => Number(a.dataset.indice) - Number(b.dataset.indice))
        .map(input => input.value.trim());
      return { ...coluna, modo, valores };
    })
    .filter(f => f.valores.some(v => v));
}

function valorCorresponde(valorItem, filtro) {
  const [v1, v2] = filtro.valores;

  if (filtro.tipo === 'data') {
    const dataItem = converterDataBr(valorItem);
    if (!dataItem) return false;

    if (filtro.modo === 'entre') {
      if (v1 && dataItem < new Date(v1)) return false;
      if (v2 && dataItem > new Date(v2)) return false;
      return true;
    }

    if (!v1) return true;
    const igual = dataItem.toDateString() === new Date(v1).toDateString();
    return filtro.modo === 'diferente' ? !igual : igual;
  }

  const base = String(valorItem ?? '').toLowerCase();
  const alvo = (v1 || '').toLowerCase();
  if (!alvo) return true;
  if (filtro.modo === 'igual') return base === alvo;
  if (filtro.modo === 'diferente') return base !== alvo;
  return base.includes(alvo);
}

// Um item só passa se corresponder a TODOS os filtros preenchidos.
function itemCorrespondeFiltros(item, filtros, extrator) {
  return filtros.every(filtro => valorCorresponde(extrator(item, filtro.chave), filtro));
}

function fecharMenusDeFiltro() {
  document.querySelectorAll('.filtro-modo-menu').forEach(menu => menu.hidden = true);
  document.querySelectorAll('.filtro-modo-botao').forEach(botao => botao.setAttribute('aria-expanded', 'false'));
}

// Liga o comportamento de cada coluna: digitar no campo filtra
// normalmente; clicar no botão com o ícone abre um menu para trocar
// o modo sem precisar usar o campo de texto para isso.
function ativarFiltrosAvancados(colunas, onChange) {
  colunas.forEach(coluna => {
    const campo = document.querySelector(`[data-filtro-campo="${coluna.chave}"]`);
    const botao = document.querySelector(`[data-filtro-modo-botao="${coluna.chave}"]`);
    const menu = document.querySelector(`[data-filtro-modo-menu="${coluna.chave}"]`);
    const segundoValor = document.querySelector(`[data-filtro-valor="${coluna.chave}"][data-indice="1"]`);
    if (!campo || !botao || !menu) return;

    const atualizarSegundoValor = () => {
      if (segundoValor) segundoValor.hidden = campo.dataset.modoAtual !== 'entre';
    };
    atualizarSegundoValor();

    botao.addEventListener('click', e => {
      e.stopPropagation();
      const vaiAbrir = menu.hidden;
      fecharMenusDeFiltro();
      if (!vaiAbrir) return;
      menu.querySelectorAll('.filtro-modo-opcao').forEach(op => {
        op.classList.toggle('ativo', op.dataset.valor === campo.dataset.modoAtual);
      });
      menu.hidden = false;
      botao.setAttribute('aria-expanded', 'true');
    });

    menu.addEventListener('click', e => e.stopPropagation());

    menu.querySelectorAll('.filtro-modo-opcao').forEach(opcao => {
      opcao.addEventListener('click', () => {
        campo.dataset.modoAtual = opcao.dataset.valor;
        fecharMenusDeFiltro();
        atualizarSegundoValor();
        onChange();
      });
    });
  });

  document.addEventListener('click', fecharMenusDeFiltro);

  document.querySelectorAll('.filtro-valor').forEach(input => {
    input.addEventListener('input', onChange);
  });
}

function limparFiltrosAvancados(colunas) {
  colunas.forEach(coluna => {
    const campo = document.querySelector(`[data-filtro-campo="${coluna.chave}"]`);
    if (campo) campo.dataset.modoAtual = modoPadrao(coluna.tipo);
    document.querySelectorAll(`[data-filtro-valor="${coluna.chave}"]`).forEach(input => {
      input.value = '';
      if (input.dataset.indice === '1') input.hidden = true;
    });
  });
}
