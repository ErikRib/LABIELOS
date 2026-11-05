/*
   Materiais de impressão disponíveis para doação.

   Uma mesma lógica atende duas páginas, escolhidas pelo atributo
   data-materiais-modo do <body>:

   - "consulta" (html/client/materiais.html — organização solicitante): vê o estoque que
     TODOS os parceiros ativos declararam disponível para produções
     doadas, com resumo por material e filtros.
   - "gestao" (html/fabricator/materiais.html — fabricante): vê e mantém
     o estoque da PRÓPRIA organização (adicionar, editar, remover).

   Quem decide o que cada organização enxerga é o back-end, a partir da
   sessão (GET /api/materiais). Contrato completo em docs/backend.md,
   seção "Materiais para doação".

   Depende de js/api.js e js/prototipo.js (sessão, menu, escaparHTML,
   badgeClass).
*/

const MATERIAL_TIPOS = ['Filamento', 'Resina', 'Pó', 'Outro'];
const MATERIAL_UNIDADES = ['kg', 'g', 'L', 'mL', 'un'];
const MATERIAL_SITUACOES = ['Disponível', 'Estoque baixo', 'Esgotado'];

let materiais = [];

function modoGestaoMateriais() {
  return document.body.dataset.materiaisModo === 'gestao';
}

// O back-end deve mandar "situacao" já calculada; este fallback usa a
// mesma regra para o caso de ela não vir na resposta.
function situacaoMaterial(m) {
  if (m.situacao) return m.situacao;
  const q = Number(m.quantidade) || 0;
  if (q <= 0) return 'Esgotado';
  if (m.estoque_minimo && q < Number(m.estoque_minimo)) return 'Estoque baixo';
  return 'Disponível';
}

function formatarQuantidade(valor, unidade) {
  const n = Number(valor) || 0;
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unidade || ''}`.trim();
}

// Aceita ISO 8601 (recomendado) ou um texto já formatado pelo servidor.
function formatarDataHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function badgeSituacao(situacao) {
  return `<span class="badge material-${badgeClass(situacao)}">${escaparHTML(situacao)}</span>`;
}

async function carregarMateriais() {
  materiais = await api('/api/materiais');
}


/* =========================
   RESUMO POR MATERIAL
========================= */

// Agrupa por nome do material e soma as quantidades por unidade
// (não converte g→kg para não misturar resina em L com filamento em kg).
function resumoPorMaterial(itens) {
  const grupos = new Map();
  itens.forEach(m => {
    const chave = m.material.trim().toLowerCase();
    if (!grupos.has(chave)) grupos.set(chave, { material: m.material.trim(), tipos: new Set(), totais: {}, parceiros: new Set() });
    const g = grupos.get(chave);
    g.tipos.add(m.tipo);
    if (Number(m.quantidade) > 0) {
      g.totais[m.unidade] = (g.totais[m.unidade] || 0) + Number(m.quantidade);
      if (m.parceiro) g.parceiros.add(m.parceiro);
    }
  });
  return [...grupos.values()].sort((a, b) => a.material.localeCompare(b.material, 'pt-BR'));
}

function renderResumoMateriais() {
  const area = document.querySelector('#resumoMateriais');
  if (!area) return;
  const grupos = resumoPorMaterial(materiais);

  if (!grupos.length) {
    area.innerHTML = modoGestaoMateriais()
      ? `<div class="estado-vazio-acao"><p>Sua organização ainda não registrou materiais para doação.</p>
           <p class="texto-apoio">Use o botão <strong>+ Registrar material</strong>, no topo da página, para começar.</p></div>`
      : '<p class="estado-vazio">Nenhum material cadastrado até o momento.</p>';
    return;
  }

  area.innerHTML = grupos.map(g => {
    const totais = Object.entries(g.totais).map(([u, q]) => formatarQuantidade(q, u)).join(' + ');
    const disponivel = Object.keys(g.totais).length > 0;
    return `
      <article class="material-card">
        <p class="eyebrow">${escaparHTML([...g.tipos].join(' / '))}</p>
        <h2>${escaparHTML(g.material)}</h2>
        <p class="material-card-total">${disponivel ? escaparHTML(totais) : 'Sem estoque'}</p>
        ${modoGestaoMateriais() ? '' : `<p class="material-card-parceiros">${g.parceiros.size} parceiro${g.parceiros.size === 1 ? '' : 's'} com estoque</p>`}
        ${badgeSituacao(disponivel ? 'Disponível' : 'Esgotado')}
      </article>`;
  }).join('');
}


/* =========================
   TABELA + FILTROS
========================= */

function filtrosMateriais() {
  return {
    busca: (document.querySelector('#buscaMaterial')?.value || '').trim().toLowerCase(),
    tipo: document.querySelector('#filtroTipoMaterial')?.value || '',
    situacao: document.querySelector('#filtroSituacaoMaterial')?.value || ''
  };
}

function materialCorresponde(m, f) {
  const texto = [m.material, m.cor, m.parceiro, m.cidade, m.observacoes].filter(Boolean).join(' ').toLowerCase();
  return (!f.busca || texto.includes(f.busca))
    && (!f.tipo || m.tipo === f.tipo)
    && (!f.situacao || situacaoMaterial(m) === f.situacao);
}

function linhaMaterial(m) {
  const e = escaparHTML;
  const gestao = modoGestaoMateriais();
  return `
    <tr>
      <td><strong>${e(m.material)}</strong>${m.observacoes ? `<br><small class="texto-apoio">${e(m.observacoes)}</small>` : ''}</td>
      <td>${e(m.tipo)}</td>
      <td>${e(m.cor || '—')}</td>
      <td>${e(formatarQuantidade(m.quantidade, m.unidade))}</td>
      ${gestao
        ? `<td>${m.estoque_minimo ? e(formatarQuantidade(m.estoque_minimo, m.unidade)) : '—'}</td>`
        : `<td>${e(m.parceiro || '—')}${m.cidade ? `<br><small class="texto-apoio">${e(m.cidade)}</small>` : ''}</td>`}
      <td>${badgeSituacao(situacaoMaterial(m))}</td>
      <td>${e(formatarDataHora(m.atualizado_em))}</td>
      ${gestao ? `
      <td class="celula-acoes">
        <div class="acoes-tabela">
          <button type="button" class="btn btn-acao-tabela btn-secundario" data-editar-material="${e(m.id)}">Editar</button>
          <button type="button" class="btn btn-acao-tabela btn-perigo" data-remover-material="${e(m.id)}">Remover</button>
        </div>
      </td>` : ''}
    </tr>`;
}

function renderTabelaMateriais() {
  const tbody = document.querySelector('#tabelaMateriais tbody');
  if (!tbody) return;
  const colunas = document.querySelectorAll('#tabelaMateriais thead th').length;
  const filtradas = materiais.filter(m => materialCorresponde(m, filtrosMateriais()));

  tbody.innerHTML = filtradas.length
    ? filtradas.map(linhaMaterial).join('')
    : `<tr><td colspan="${colunas}" class="estado-vazio">${materiais.length ? 'Nenhum material encontrado com os filtros informados.' : 'Nenhum material cadastrado até o momento.'}</td></tr>`;

  const contador = document.querySelector('#contadorMateriais');
  if (contador) contador.textContent = `${filtradas.length} de ${materiais.length} itens`;

  tbody.querySelectorAll('[data-editar-material]').forEach(b => b.addEventListener('click', () => abrirModalMaterial(b.dataset.editarMaterial)));
  tbody.querySelectorAll('[data-remover-material]').forEach(b => b.addEventListener('click', () => removerMaterial(b.dataset.removerMaterial)));
}

function prepararFiltrosMateriais() {
  const tipo = document.querySelector('#filtroTipoMaterial');
  const situacao = document.querySelector('#filtroSituacaoMaterial');
  if (tipo) tipo.innerHTML = '<option value="">Todos os tipos</option>' + MATERIAL_TIPOS.map(t => `<option>${t}</option>`).join('');
  if (situacao) situacao.innerHTML = '<option value="">Todas as situações</option>' + MATERIAL_SITUACOES.map(s => `<option>${s}</option>`).join('');

  ['#buscaMaterial', '#filtroTipoMaterial', '#filtroSituacaoMaterial'].forEach(sel =>
    document.querySelector(sel)?.addEventListener('input', renderTabelaMateriais));

  document.querySelector('#limparFiltrosMateriais')?.addEventListener('click', () => {
    ['#buscaMaterial', '#filtroTipoMaterial', '#filtroSituacaoMaterial'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    });
    renderTabelaMateriais();
  });
}


/* =========================
   GESTÃO (FABRICANTE)
========================= */

function mensagemMateriais(texto, erro = false) {
  const el = document.querySelector('#mensagemMateriais');
  if (!el) return;
  el.textContent = texto;
  el.classList.toggle('mensagem-erro', erro);
}

function abrirModalMaterial(id) {
  const modal = document.querySelector('#modalMaterial');
  const form = document.querySelector('#formMaterial');
  if (!modal || !form) return;
  const m = id ? materiais.find(x => String(x.id) === String(id)) : null;

  form.reset();
  form.dataset.id = m ? m.id : '';
  modal.querySelector('[data-modal-material-titulo]').textContent = m ? 'Editar material' : 'Registrar material';
  document.querySelector('#erroMaterial').textContent = '';
  if (m) {
    ['material', 'tipo', 'cor', 'quantidade', 'unidade', 'estoque_minimo', 'observacoes'].forEach(campo => {
      if (form.elements[campo]) form.elements[campo].value = m[campo] ?? '';
    });
  }
  modal.showModal();
  form.elements.material.focus();
}

async function salvarMaterial(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const d = new FormData(form);
  const corpo = {
    material: d.get('material').trim(),
    tipo: d.get('tipo'),
    cor: d.get('cor').trim(),
    quantidade: Number(d.get('quantidade')),
    unidade: d.get('unidade'),
    estoque_minimo: d.get('estoque_minimo') === '' ? null : Number(d.get('estoque_minimo')),
    observacoes: d.get('observacoes').trim()
  };
  const id = form.dataset.id;
  const botao = form.querySelector('[type="submit"]');
  botao.disabled = true;

  try {
    await api(id ? `/api/materiais/${encodeURIComponent(id)}` : '/api/materiais', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(corpo)
    });
    document.querySelector('#modalMaterial').close();
    await carregarMateriais();
    renderResumoMateriais();
    renderTabelaMateriais();
    mensagemMateriais(id ? 'Material atualizado.' : 'Material adicionado.');
  } catch (erro) {
    document.querySelector('#erroMaterial').textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

async function removerMaterial(id) {
  const m = materiais.find(x => String(x.id) === String(id));
  if (!m || !confirm(`Remover "${m.material}${m.cor ? ' — ' + m.cor : ''}" da lista de doação?`)) return;
  try {
    await api(`/api/materiais/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await carregarMateriais();
    renderResumoMateriais();
    renderTabelaMateriais();
    mensagemMateriais('Material removido.');
  } catch (erro) {
    mensagemMateriais(erro.message, true);
  }
}

function prepararGestaoMateriais() {
  if (!modoGestaoMateriais()) return;
  const form = document.querySelector('#formMaterial');
  if (!form) return;
  form.elements.tipo.innerHTML = MATERIAL_TIPOS.map(t => `<option>${t}</option>`).join('');
  form.elements.unidade.innerHTML = MATERIAL_UNIDADES.map(u => `<option>${u}</option>`).join('');
  form.addEventListener('submit', salvarMaterial);
  document.querySelector('#btnNovoMaterial')?.addEventListener('click', () => abrirModalMaterial(null));
}


/* =========================
   PONTO DE ENTRADA
========================= */

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('#tabelaMateriais')) return;
  try {
    await window.dadosIniciaisProntos;
  } catch {
    return; // sem sessão: prototipo.js já redirecionou para o login.
  }

  prepararFiltrosMateriais();
  prepararGestaoMateriais();

  try {
    await carregarMateriais();
  } catch (erro) {
    materiais = [];
    mensagemMateriais(`Não foi possível carregar os materiais: ${erro.message}`, true);
  }
  renderResumoMateriais();
  renderTabelaMateriais();

  // Atalho "+ Registrar material" (visão geral do fabricante) chega com ?novo=1.
  if (modoGestaoMateriais() && new URLSearchParams(location.search).get('novo') === '1') {
    history.replaceState(null, '', location.pathname);
    abrirModalMaterial(null);
  }
});
