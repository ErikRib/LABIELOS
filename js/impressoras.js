/*
   Impressoras do fabricante (html/fabricator/impressoras.html).

   O parceiro registra o parque de impressoras da própria organização:
   identificação, modelo, tecnologia, volume de impressão, materiais
   compatíveis e status. A capacidade mostrada para as organizações
   solicitantes (GET /api/parceiros → impressoras, tecnologias) é
   calculada pelo back-end a partir deste cadastro.

   Rotas (contrato em docs/integracao-backend.md, seção "Impressoras"):
     GET    /api/impressoras          → impressoras da organização da sessão
     POST   /api/impressoras
     PATCH  /api/impressoras/{id}
     DELETE /api/impressoras/{id}

   Depende de js/api.js e js/prototipo.js (sessão, menu, escaparHTML, badgeClass).
*/

const IMPRESSORA_TECNOLOGIAS = ['FDM', 'SLA', 'DLP', 'SLS', 'Outra'];
const IMPRESSORA_STATUS = ['Disponível', 'Em uso', 'Em manutenção', 'Inativa'];

let impressoras = [];

function badgeImpressora(status) {
  return `<span class="badge impressora-${badgeClass(status)}">${escaparHTML(status)}</span>`;
}

function textoVolume(i) {
  const dims = [i.largura_mm, i.profundidade_mm, i.altura_mm];
  return dims.every(d => Number(d) > 0) ? `${dims.map(Number).join(' × ')} mm` : '—';
}

function dataHora(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? valor : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function avisoImpressoras(texto, erro = false) {
  const el = document.querySelector('#mensagemImpressoras');
  if (!el) return;
  el.textContent = texto;
  el.classList.toggle('mensagem-erro', erro);
}

async function carregarImpressoras() {
  impressoras = await api('/api/impressoras');
}


/* =========================
   RESUMO E TABELA
========================= */

function renderResumoImpressoras() {
  const area = document.querySelector('#resumoImpressoras');
  if (!area) return;
  if (!impressoras.length) {
    area.innerHTML = `<div class="estado-vazio-acao"><p>Sua organização ainda não registrou impressoras.
      Elas formam a capacidade produtiva que as organizações solicitantes enxergam.</p>
      <p class="texto-apoio">Use o botão <strong>+ Registrar impressora</strong>, no topo da página, para começar.</p></div>`;
    return;
  }
  const contar = st => impressoras.filter(i => i.status === st).length;
  const cards = [
    ['Total', impressoras.length, ''],
    ['Disponíveis', contar('Disponível'), 'Disponível'],
    ['Em uso', contar('Em uso'), 'Em uso'],
    ['Em manutenção', contar('Em manutenção'), 'Em manutenção']
  ];
  area.innerHTML = cards.map(([rotulo, n, st]) => `
    <article class="material-card">
      <p class="eyebrow">${rotulo}</p>
      <p class="material-card-total">${n}</p>
      ${st ? badgeImpressora(st) : '<span class="texto-apoio">impressoras registradas</span>'}
    </article>`).join('');
}

function filtrosImpressoras() {
  return {
    busca: (document.querySelector('#buscaImpressora')?.value || '').trim().toLowerCase(),
    tecnologia: document.querySelector('#filtroTecnologia')?.value || '',
    status: document.querySelector('#filtroStatusImpressora')?.value || ''
  };
}

function renderTabelaImpressoras() {
  const tbody = document.querySelector('#tabelaImpressoras tbody');
  if (!tbody) return;
  const f = filtrosImpressoras();
  const lista = impressoras.filter(i =>
    (!f.busca || [i.nome, i.modelo, i.materiais, i.observacoes].filter(Boolean).join(' ').toLowerCase().includes(f.busca))
    && (!f.tecnologia || i.tecnologia === f.tecnologia)
    && (!f.status || i.status === f.status));

  const e = escaparHTML;
  tbody.innerHTML = lista.length
    ? lista.map(i => `
      <tr>
        <td><strong>${e(i.nome)}</strong>${i.modelo ? `<br><small class="texto-apoio">${e(i.modelo)}</small>` : ''}</td>
        <td>${e(i.tecnologia)}</td>
        <td>${e(textoVolume(i))}</td>
        <td>${e(i.materiais || '—')}</td>
        <td>${badgeImpressora(i.status)}${i.observacoes ? `<br><small class="texto-apoio">${e(i.observacoes)}</small>` : ''}</td>
        <td>${e(dataHora(i.atualizado_em))}</td>
        <td class="celula-acoes">
          <div class="acoes-tabela">
            <button type="button" class="btn btn-acao-tabela btn-secundario" data-editar-impressora="${e(i.id)}">Editar</button>
            <button type="button" class="btn btn-acao-tabela btn-perigo" data-remover-impressora="${e(i.id)}">Remover</button>
          </div>
        </td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="estado-vazio">${impressoras.length ? 'Nenhuma impressora encontrada com os filtros.' : 'Nenhuma impressora registrada.'}</td></tr>`;

  const contador = document.querySelector('#contadorImpressoras');
  if (contador) contador.textContent = `${lista.length} de ${impressoras.length} impressoras`;

  tbody.querySelectorAll('[data-editar-impressora]').forEach(b => b.addEventListener('click', () => abrirModalImpressora(b.dataset.editarImpressora)));
  tbody.querySelectorAll('[data-remover-impressora]').forEach(b => b.addEventListener('click', () => removerImpressora(b.dataset.removerImpressora)));
}

function prepararFiltrosImpressoras() {
  const tec = document.querySelector('#filtroTecnologia');
  const st = document.querySelector('#filtroStatusImpressora');
  tec.innerHTML = '<option value="">Todas as tecnologias</option>' + IMPRESSORA_TECNOLOGIAS.map(t => `<option>${t}</option>`).join('');
  st.innerHTML = '<option value="">Todos os status</option>' + IMPRESSORA_STATUS.map(s => `<option>${s}</option>`).join('');
  ['#buscaImpressora', '#filtroTecnologia', '#filtroStatusImpressora'].forEach(sel =>
    document.querySelector(sel).addEventListener('input', renderTabelaImpressoras));
  document.querySelector('#limparFiltrosImpressoras').addEventListener('click', () => {
    ['#buscaImpressora', '#filtroTecnologia', '#filtroStatusImpressora'].forEach(sel => { document.querySelector(sel).value = ''; });
    renderTabelaImpressoras();
  });
}


/* =========================
   REGISTRAR / EDITAR / REMOVER
========================= */

const CAMPOS_IMPRESSORA = ['nome', 'modelo', 'tecnologia', 'largura_mm', 'profundidade_mm', 'altura_mm', 'materiais', 'status', 'observacoes'];

function abrirModalImpressora(id) {
  const modal = document.querySelector('#modalImpressora');
  const form = document.querySelector('#formImpressora');
  const i = id ? impressoras.find(x => String(x.id) === String(id)) : null;
  form.reset();
  form.dataset.id = i ? i.id : '';
  modal.querySelector('[data-modal-impressora-titulo]').textContent = i ? 'Editar impressora' : 'Registrar impressora';
  document.querySelector('#erroImpressora').textContent = '';
  if (i) CAMPOS_IMPRESSORA.forEach(c => { form.elements[c].value = i[c] ?? ''; });
  modal.showModal();
  form.elements.nome.focus();
}

async function salvarImpressora(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (!form.reportValidity()) return;
  const d = new FormData(form);
  const numero = nome => (d.get(nome) === '' ? null : Number(d.get(nome)));
  const corpo = {
    nome: d.get('nome').trim(),
    modelo: d.get('modelo').trim(),
    tecnologia: d.get('tecnologia'),
    largura_mm: numero('largura_mm'),
    profundidade_mm: numero('profundidade_mm'),
    altura_mm: numero('altura_mm'),
    materiais: d.get('materiais').trim(),
    status: d.get('status'),
    observacoes: d.get('observacoes').trim()
  };
  const id = form.dataset.id;
  const botao = form.querySelector('[type="submit"]');
  botao.disabled = true;
  try {
    await api(id ? `/api/impressoras/${encodeURIComponent(id)}` : '/api/impressoras', {
      method: id ? 'PATCH' : 'POST', body: JSON.stringify(corpo)
    });
    document.querySelector('#modalImpressora').close();
    await carregarImpressoras();
    renderResumoImpressoras();
    renderTabelaImpressoras();
    avisoImpressoras(id ? 'Impressora atualizada.' : 'Impressora registrada.');
    setTimeout(() => location.reload(), 700);
  } catch (erro) {
    document.querySelector('#erroImpressora').textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

async function removerImpressora(id) {
  const i = impressoras.find(x => String(x.id) === String(id));
  if (!i || !confirm(`Remover a impressora "${i.nome}"? Ela deixa de contar na capacidade produtiva.`)) return;
  try {
    await api(`/api/impressoras/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await carregarImpressoras();
    renderResumoImpressoras();
    renderTabelaImpressoras();
    avisoImpressoras('Impressora removida.');
    setTimeout(() => location.reload(), 700);
  } catch (erro) {
    avisoImpressoras(erro.message, true);
  }
}


/* =========================
   PONTO DE ENTRADA
========================= */

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.querySelector('#tabelaImpressoras')) return;
  try { await window.dadosIniciaisProntos; } catch { return; }

  const form = document.querySelector('#formImpressora');
  form.elements.tecnologia.innerHTML = IMPRESSORA_TECNOLOGIAS.map(t => `<option>${t}</option>`).join('');
  form.elements.status.innerHTML = IMPRESSORA_STATUS.map(s => `<option>${s}</option>`).join('');
  form.addEventListener('submit', salvarImpressora);
  document.querySelector('#btnNovaImpressora').addEventListener('click', () => abrirModalImpressora(null));
  prepararFiltrosImpressoras();

  try {
    await carregarImpressoras();
  } catch (erro) {
    impressoras = [];
    avisoImpressoras(`Não foi possível carregar as impressoras: ${erro.message}`, true);
  }
  renderResumoImpressoras();
  renderTabelaImpressoras();

  // Atalho "Registrar impressora" (visão geral) chega com ?nova=1.
  if (new URLSearchParams(location.search).get('nova') === '1') {
    history.replaceState(null, '', location.pathname);
    abrirModalImpressora(null);
  }
});
