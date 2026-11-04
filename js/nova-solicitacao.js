/*
   Assistente "Nova solicitação" (solicitante) — modal em 4 etapas:

     1. Informações da peça      (solicitação, requerente, prioridade,
                                  categoria, prazo, material)
     2. Arquivo e especificações (descrição, arquivo 3D, parceiros)
     3. Revisão                  (resumo de tudo, com atalho para editar)
     4. Envio                    (POST /api/solicitacoes + resultado)

   O HTML do modal é gerado aqui (e não copiado em cada página), então
   basta a página ter um botão .btn-nova-solicitacao e carregar, nesta
   ordem: js/api.js, js/prototipo.js e este arquivo.

   Depende de prototipo.js para: usuarioLogado, parceiros,
   opcoesParceirosHTML(), escaparHTML(), formatarTamanhoArquivo(),
   carregarSolicitacoes() e as funções de re-renderização das tabelas.

   Contrato do envio: ver docs/backend.md, "POST /api/solicitacoes".
*/

const NOVA_ETAPAS = [
  { titulo: 'Informações da peça', rotulo: 'Informações <br>da peça', subtitulo: 'Preencha as informações básicas da solicitação.' },
  { titulo: 'Arquivo e especificações', rotulo: 'Arquivo e <br>especificações', subtitulo: 'Descreva os requisitos, anexe o arquivo 3D e escolha os parceiros.' },
  { titulo: 'Revisão', rotulo: 'Revisão', subtitulo: 'Confira os dados antes de enviar a solicitação.' },
  { titulo: 'Envio', rotulo: 'Envio', subtitulo: '' }
];

// Formatos aceitos e tamanho máximo do arquivo 3D (o back-end deve
// validar os mesmos limites — ver docs/backend.md).
const NOVA_FORMATOS_3D = ['stl', 'obj', '3mf', 'step', 'stp', 'iges', 'igs'];
const NOVA_TAMANHO_MAX_3D = 50 * 1024 * 1024; // 50 MB

const NOVA_CATEGORIAS = ['Órtese', 'Prótese', 'Adaptação', 'Dispositivo assistivo', 'Peça de reposição'];
const NOVA_MATERIAIS_PADRAO = ['PLA', 'PETG', 'TPU', 'ABS', 'Nylon', 'Resina'];

let novaEtapaAtual = 0;
let novaArquivo = null;
let novaEnviando = false;

function templateNovaSolicitacao() {
  const passos = NOVA_ETAPAS.map((e, i) => `
    <li class="stepper-etapa" data-etapa-indicador="${i}">
      <button type="button" class="stepper-ponto" data-ir-etapa="${i}" disabled aria-label="Etapa ${i + 1}: ${e.titulo}">${i + 1}</button>
      <span class="stepper-rotulo">${e.rotulo}</span>
    </li>`).join('');

  return `
  <dialog class="modal modal-assistente" id="modalNovaSolicitacao" data-fechar-fora="false" aria-labelledby="tituloNovaSolicitacao">
    <header class="modal-cabecalho assistente-cabecalho">
      <div>
        <p>Cadastro</p>
        <h2 id="tituloNovaSolicitacao">Nova solicitação</h2>
      </div>
      <button class="modal-fechar modal-fechar-contorno" type="button" data-nova-cancelar aria-label="Fechar">×</button>
    </header>

    <ol class="stepper" aria-label="Etapas da nova solicitação">${passos}</ol>
    <p class="visualmente-oculto stepper-legenda" aria-live="polite" data-nova-anuncio></p>

    <form id="formNovaSolicitacao" novalidate>
      <div class="modal-corpo assistente-corpo">

        <!-- ETAPA 1 -->
        <section class="assistente-painel" data-etapa="0">
          <h3>Informações da peça</h3>
          <p class="assistente-subtitulo">${NOVA_ETAPAS[0].subtitulo}</p>
          <div class="form-grid">
            <div class="campo">
              <label for="novaSolicitacaoTitulo">Solicitação</label>
              <input id="novaSolicitacaoTitulo" name="solicitacao" required maxlength="120" placeholder="Ex.: Colete ortopédico">
            </div>
            <div class="campo">
              <label for="novaRequerente">Requerente</label>
              <input id="novaRequerente" name="requerente" readonly aria-readonly="true" aria-describedby="ajudaRequerente">
              <small class="campo-ajuda" id="ajudaRequerente">Preenchido automaticamente pela organização autenticada.</small>
            </div>
            <div class="campo">
              <label for="novaPrioridade">Prioridade</label>
              <select id="novaPrioridade" name="prioridade" required>
                <option>Baixa</option>
                <option selected>Média</option>
                <option>Alta</option>
              </select>
            </div>
            <div class="campo">
              <label for="novaCategoria">Categoria</label>
              <input id="novaCategoria" name="categoria" required list="listaNovaCategorias" placeholder="Ex.: Órtese">
              <datalist id="listaNovaCategorias">${NOVA_CATEGORIAS.map(c => `<option value="${c}">`).join('')}</datalist>
            </div>
            <div class="campo">
              <label for="novaPrazo">Prazo desejado</label>
              <input id="novaPrazo" name="prazo" type="date" aria-describedby="ajudaPrazo">
              <small class="campo-ajuda" id="ajudaPrazo">Opcional. Em branco, fica "A definir".</small>
            </div>
            <div class="campo">
              <label for="novaMaterial">Material</label>
              <input id="novaMaterial" name="material" list="listaNovaMateriais" placeholder="Ex.: PLA / TPU">
              <datalist id="listaNovaMateriais">${NOVA_MATERIAIS_PADRAO.map(m => `<option value="${m}">`).join('')}</datalist>
            </div>
          </div>
        </section>

        <!-- ETAPA 2 -->
        <section class="assistente-painel" data-etapa="1" hidden>
          <h3>Arquivo e especificações</h3>
          <p class="assistente-subtitulo">${NOVA_ETAPAS[1].subtitulo}</p>
          <div class="form-grid">
            <div class="campo amplo">
              <label for="novaDescricao">Descrição e especificações</label>
              <textarea id="novaDescricao" name="descricao" required maxlength="4000"
                placeholder="Descreva a necessidade, medidas, requisitos de acabamento e demais informações relevantes."></textarea>
            </div>

            <div class="campo amplo">
              <span class="campo-rotulo" id="rotuloArquivo3d">Arquivo 3D</span>
              <label class="dropzone" for="novaArquivo3d" data-dropzone>
                <input id="novaArquivo3d" name="arquivo3d" type="file" class="visualmente-oculto"
                  accept="${NOVA_FORMATOS_3D.map(f => '.' + f).join(',')}" aria-describedby="ajudaArquivo3d">
                <span class="dropzone-icone" aria-hidden="true">3D</span>
                <span class="dropzone-texto"><strong>Clique para escolher</strong> ou arraste o arquivo aqui</span>
                <small class="campo-ajuda" id="ajudaArquivo3d">Opcional. STL, OBJ, 3MF, STEP/STP ou IGES/IGS — até 50 MB.</small>
              </label>
              <div class="arquivo-escolhido" data-arquivo-escolhido hidden>
                <span class="anexo-icone" aria-hidden="true">3D</span>
                <span class="arquivo-escolhido-info"><strong data-arquivo-nome></strong><small data-arquivo-meta></small></span>
                <button type="button" class="btn-texto" data-remover-arquivo>Remover</button>
              </div>
              <p class="erro-campo" data-erro="arquivo3d" role="alert"></p>
            </div>

            <fieldset class="campo amplo campo-atribuicoes">
              <legend>Parceiros atribuídos</legend>
              <p class="campo-ajuda">Selecione uma ou mais instituições que receberão a solicitação.</p>
              <div class="opcoes-atribuicao" data-opcoes-parceiros></div>
              <p class="erro-campo" data-erro="atribuido" role="alert"></p>
            </fieldset>
          </div>
        </section>

        <!-- ETAPA 3 -->
        <section class="assistente-painel" data-etapa="2" hidden>
          <h3>Revisão</h3>
          <p class="assistente-subtitulo">${NOVA_ETAPAS[2].subtitulo}</p>
          <div data-revisao></div>
        </section>

        <!-- ETAPA 4 -->
        <section class="assistente-painel assistente-envio" data-etapa="3" hidden>
          <div data-envio-estado="enviando">
            <span class="envio-spinner" aria-hidden="true"></span>
            <h3>Enviando solicitação…</h3>
            <p class="assistente-subtitulo">Aguarde enquanto registramos a solicitação e notificamos os parceiros.</p>
          </div>
          <div data-envio-estado="sucesso" hidden>
            <span class="envio-icone envio-icone-sucesso" aria-hidden="true">✓</span>
            <h3>Solicitação <span data-envio-protocolo></span> enviada!</h3>
            <p class="assistente-subtitulo">Os parceiros selecionados já podem visualizar a demanda. Acompanhe o andamento pela página de detalhes.</p>
          </div>
          <div data-envio-estado="erro" hidden>
            <span class="envio-icone envio-icone-erro" aria-hidden="true">!</span>
            <h3>Não foi possível enviar</h3>
            <p class="assistente-subtitulo" data-envio-erro></p>
          </div>
        </section>
      </div>

      <footer class="modal-acoes assistente-acoes">
        <button type="button" class="btn btn-secundario btn-acao" data-nova-voltar>Cancelar</button>
        <button type="button" class="btn btn-principal btn-acao" data-nova-avancar>Continuar <span aria-hidden="true">→</span></button>
      </footer>
    </form>
  </dialog>`;
}

const novaQ = seletor => document.querySelector(`#modalNovaSolicitacao ${seletor}`);


/* =========================
   NAVEGAÇÃO ENTRE ETAPAS
========================= */

function irParaEtapa(indice) {
  novaEtapaAtual = indice;
  const dialog = document.querySelector('#modalNovaSolicitacao');

  dialog.querySelectorAll('[data-etapa]').forEach(p => { p.hidden = Number(p.dataset.etapa) !== indice; });
  dialog.querySelectorAll('[data-etapa-indicador]').forEach(li => {
    const i = Number(li.dataset.etapaIndicador);
    li.classList.toggle('concluida', i < indice);
    li.classList.toggle('atual', i === indice);
    const ponto = li.querySelector('.stepper-ponto');
    ponto.textContent = i < indice ? '✓' : String(i + 1);
    // Só permite voltar para etapas já concluídas (e nunca depois do envio).
    ponto.disabled = !(i < indice && indice < 3);
    if (i === indice) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });

  if (indice === 1) renderParceirosNova();
  if (indice === 2) renderRevisao();

  atualizarBotoesNova();
  novaQ('[data-nova-anuncio]').textContent = `Etapa ${indice + 1} de 4: ${NOVA_ETAPAS[indice].titulo}`;
  novaQ('.assistente-corpo').scrollTop = 0;
  novaQ(`[data-etapa="${indice}"]`).querySelector('input:not([readonly]):not([type=file]), select, textarea')?.focus();
}

function atualizarBotoesNova(estadoEnvio) {
  const voltar = novaQ('[data-nova-voltar]');
  const avancar = novaQ('[data-nova-avancar]');
  voltar.hidden = false;
  avancar.hidden = false;
  avancar.disabled = false;

  if (novaEtapaAtual === 0) {
    voltar.textContent = 'Cancelar';
    avancar.innerHTML = 'Continuar <span aria-hidden="true">→</span>';
  } else if (novaEtapaAtual === 1) {
    voltar.innerHTML = '<span aria-hidden="true">←</span> Voltar';
    avancar.innerHTML = 'Continuar <span aria-hidden="true">→</span>';
  } else if (novaEtapaAtual === 2) {
    voltar.innerHTML = '<span aria-hidden="true">←</span> Voltar';
    avancar.textContent = 'Enviar solicitação';
  } else if (estadoEnvio === 'sucesso') {
    voltar.textContent = 'Concluir';
    avancar.textContent = 'Ver solicitação';
  } else if (estadoEnvio === 'erro') {
    voltar.innerHTML = '<span aria-hidden="true">←</span> Voltar à revisão';
    avancar.textContent = 'Tentar novamente';
  } else {
    voltar.hidden = true;
    avancar.hidden = true;
  }
}

// Valida só os campos da etapa visível (o resto ainda não foi preenchido).
function validarEtapa(indice) {
  const painel = novaQ(`[data-etapa="${indice}"]`);
  const campos = [...painel.querySelectorAll('input:not([type=checkbox]):not([type=file]), select, textarea')];
  for (const campo of campos) {
    if (campo.value.trim() === '' && campo.required) campo.value = '';
    if (!campo.checkValidity()) { campo.reportValidity(); campo.focus(); return false; }
  }

  if (indice === 0) {
    const prazo = novaQ('[name="prazo"]');
    if (prazo.value && prazo.value < hojeISO()) {
      prazo.setCustomValidity('O prazo não pode ser uma data passada.');
      prazo.reportValidity();
      prazo.setCustomValidity('');
      return false;
    }
  }

  if (indice === 1) {
    const erro = novaQ('[data-erro="atribuido"]');
    if (!parceirosMarcados().length) {
      erro.textContent = 'Selecione pelo menos um parceiro.';
      novaQ('[data-opcoes-parceiros] input')?.focus();
      return false;
    }
    erro.textContent = '';
  }
  return true;
}

function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parceirosMarcados() {
  return [...document.querySelectorAll('#modalNovaSolicitacao input[name="atribuido"]:checked')].map(i => i.value);
}


/* =========================
   ETAPA 2 — PARCEIROS E ARQUIVO
========================= */

function renderParceirosNova() {
  const area = novaQ('[data-opcoes-parceiros]');
  const marcados = parceirosMarcados();
  area.innerHTML = opcoesParceirosHTML(marcados);
  area.querySelectorAll('input').forEach(i => i.addEventListener('change', () => {
    if (parceirosMarcados().length) novaQ('[data-erro="atribuido"]').textContent = '';
  }));
}

function definirArquivo(arquivo) {
  const erro = novaQ('[data-erro="arquivo3d"]');
  erro.textContent = '';
  if (arquivo) {
    const ext = arquivo.name.split('.').pop().toLowerCase();
    if (!NOVA_FORMATOS_3D.includes(ext)) { erro.textContent = 'Formato não suportado. Use STL, OBJ, 3MF, STEP/STP ou IGES/IGS.'; return; }
    if (arquivo.size > NOVA_TAMANHO_MAX_3D) { erro.textContent = 'Arquivo maior que 50 MB.'; return; }
  }
  novaArquivo = arquivo || null;
  const escolhido = novaQ('[data-arquivo-escolhido]');
  escolhido.hidden = !novaArquivo;
  novaQ('[data-dropzone]').hidden = !!novaArquivo;
  if (novaArquivo) {
    novaQ('[data-arquivo-nome]').textContent = novaArquivo.name;
    novaQ('[data-arquivo-meta]').textContent = `${novaArquivo.name.split('.').pop().toUpperCase()} · ${formatarTamanhoArquivo(novaArquivo.size)}`;
  } else {
    novaQ('[name="arquivo3d"]').value = '';
  }
}

function prepararDropzone() {
  const zona = novaQ('[data-dropzone]');
  const input = novaQ('[name="arquivo3d"]');
  input.addEventListener('change', () => definirArquivo(input.files[0]));
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('arrastando'); }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('arrastando'); }));
  zona.addEventListener('drop', e => definirArquivo(e.dataTransfer.files[0]));
  novaQ('[data-remover-arquivo]').addEventListener('click', () => definirArquivo(null));
}


/* =========================
   ETAPA 3 — REVISÃO
========================= */

function camposNovaSolicitacao() {
  const form = document.querySelector('#formNovaSolicitacao');
  const v = nome => form.elements[nome].value.trim();
  return {
    solicitacao: v('solicitacao'),
    atribuido: parceirosMarcados(),
    prioridade: v('prioridade'),
    categoria: v('categoria'),
    prazo: v('prazo') ? v('prazo').split('-').reverse().join('/') : 'A definir',
    material: v('material') || 'A definir',
    descricao: v('descricao')
  };
}

function renderRevisao() {
  const c = camposNovaSolicitacao();
  const item = (rotulo, valor, amplo) => `<div class="detalhe${amplo ? ' amplo' : ''}"><dt>${rotulo}</dt><dd>${valor}</dd></div>`;
  const e = escaparHTML;

  novaQ('[data-revisao]').innerHTML = `
    <article class="revisao-bloco">
      <header><h4>Informações da peça</h4><button type="button" class="btn-texto" data-ir-etapa="0">Editar</button></header>
      <dl class="detalhes-grid">
        ${item('Solicitação', e(c.solicitacao))}
        ${item('Requerente', e(novaQ('[name="requerente"]').value))}
        ${item('Prioridade', `<span class="badge prioridade-${badgeClass(c.prioridade)}">${e(c.prioridade)}</span>`)}
        ${item('Categoria', e(c.categoria))}
        ${item('Prazo desejado', e(c.prazo))}
        ${item('Material', e(c.material))}
      </dl>
    </article>
    <article class="revisao-bloco">
      <header><h4>Arquivo e especificações</h4><button type="button" class="btn-texto" data-ir-etapa="1">Editar</button></header>
      <dl class="detalhes-grid">
        ${item('Descrição', `<span class="texto-preformatado">${e(c.descricao)}</span>`, true)}
        ${item('Arquivo 3D', novaArquivo ? `${e(novaArquivo.name)} · ${formatarTamanhoArquivo(novaArquivo.size)}` : 'Nenhum arquivo anexado', true)}
        ${item('Parceiros atribuídos', c.atribuido.map(e).join(', '), true)}
      </dl>
    </article>`;

  novaQ('[data-revisao]').querySelectorAll('[data-ir-etapa]').forEach(b =>
    b.addEventListener('click', () => irParaEtapa(Number(b.dataset.irEtapa))));
}


/* =========================
   ETAPA 4 — ENVIO
========================= */

function mostrarEstadoEnvio(estado) {
  novaQ('[data-etapa="3"]').querySelectorAll('[data-envio-estado]').forEach(el => {
    el.hidden = el.dataset.envioEstado !== estado;
  });
  atualizarBotoesNova(estado);
}

async function enviarNovaSolicitacao() {
  if (novaEnviando) return;
  novaEnviando = true;
  irParaEtapa(3);
  mostrarEstadoEnvio('enviando');

  const campos = camposNovaSolicitacao();
  let corpo;
  if (novaArquivo) {
    // multipart/form-data: listas vão como JSON em texto (ver docs/backend.md).
    corpo = new FormData();
    Object.entries(campos).forEach(([chave, valor]) => corpo.append(chave, Array.isArray(valor) ? JSON.stringify(valor) : valor));
    corpo.append('arquivo3d', novaArquivo);
  } else {
    corpo = JSON.stringify(campos);
  }

  try {
    const nova = await api('/api/solicitacoes', { method: 'POST', body: corpo });
    novaQ('[data-envio-protocolo]').textContent = nova.protocolo || '';
    novaQ('[data-nova-avancar]').dataset.protocolo = nova.protocolo || '';
    mostrarEstadoEnvio('sucesso');
    atualizarListasAposCriacao();
  } catch (erro) {
    novaQ('[data-envio-erro]').textContent = erro.message;
    mostrarEstadoEnvio('erro');
  } finally {
    novaEnviando = false;
  }
}

// Recarrega a lista e redesenha o que existir na página atual.
async function atualizarListasAposCriacao() {
  try {
    await carregarSolicitacoes();
    if (typeof preencherResumo === 'function') preencherResumo();
    if (typeof renderTabelaSolicitacoes === 'function') renderTabelaSolicitacoes();
    if (typeof renderTabelaInicio === 'function') renderTabelaInicio();
  } catch { /* a criação já deu certo; a tabela atualiza no próximo carregamento */ }
}


/* =========================
   ABRIR / FECHAR / RESETAR
========================= */

function formularioNovaAlterado() {
  const form = document.querySelector('#formNovaSolicitacao');
  return ['solicitacao', 'categoria', 'prazo', 'material', 'descricao'].some(n => form.elements[n].value.trim())
    || !!novaArquivo || parceirosMarcados().length > 0;
}

function resetarNovaSolicitacao() {
  const form = document.querySelector('#formNovaSolicitacao');
  form.reset();
  definirArquivo(null);
  novaQ('[data-opcoes-parceiros]').innerHTML = '';
  form.querySelectorAll('.erro-campo').forEach(e => { e.textContent = ''; });
}

// Pede confirmação antes de descartar um preenchimento em andamento
// (não pergunta depois do envio, nem com o formulário vazio).
function fecharNovaSolicitacao() {
  const dialog = document.querySelector('#modalNovaSolicitacao');
  if (novaEnviando) return;
  if (novaEtapaAtual < 3 && formularioNovaAlterado()
    && !confirm('Descartar o preenchimento desta solicitação?')) return;
  dialog.close();
}

function abrirNovaSolicitacao() {
  const dialog = document.querySelector('#modalNovaSolicitacao');
  resetarNovaSolicitacao();
  novaQ('[name="requerente"]').value = (typeof usuarioLogado !== 'undefined' && usuarioLogado?.organizacao) || '';
  irParaEtapa(0);
  dialog.showModal();
  carregarSugestoesMateriais();
}

// Sugere, no campo "Material", os materiais que os parceiros declararam
// ter disponíveis para doação (GET /api/materiais). Falhar aqui não
// atrapalha nada — a lista padrão continua lá.
async function carregarSugestoesMateriais() {
  try {
    const itens = await api('/api/materiais');
    const nomes = new Set([...NOVA_MATERIAIS_PADRAO, ...itens.filter(i => Number(i.quantidade) > 0).map(i => i.material)]);
    novaQ('#listaNovaMateriais').innerHTML = [...nomes].map(m => `<option value="${escaparHTML(m)}">`).join('');
  } catch { /* mantém as sugestões padrão */ }
}

function prepararNovaSolicitacao() {
  if (!document.querySelector('.btn-nova-solicitacao') || document.querySelector('#modalNovaSolicitacao')) return;
  document.body.insertAdjacentHTML('beforeend', templateNovaSolicitacao());

  const dialog = document.querySelector('#modalNovaSolicitacao');
  prepararDropzone();

  document.querySelectorAll('.btn-nova-solicitacao').forEach(b => b.addEventListener('click', abrirNovaSolicitacao));
  novaQ('[data-nova-cancelar]').addEventListener('click', fecharNovaSolicitacao);
  dialog.addEventListener('cancel', e => { e.preventDefault(); fecharNovaSolicitacao(); });
  dialog.querySelectorAll('.stepper [data-ir-etapa]').forEach(b =>
    b.addEventListener('click', () => irParaEtapa(Number(b.dataset.irEtapa))));

  // Enter num campo de texto avança a etapa em vez de enviar tudo.
  document.querySelector('#formNovaSolicitacao').addEventListener('submit', e => {
    e.preventDefault();
    novaQ('[data-nova-avancar]').click();
  });

  novaQ('[data-nova-voltar]').addEventListener('click', () => {
    if (novaEtapaAtual === 0) return fecharNovaSolicitacao();
    if (novaEtapaAtual === 3) {
      const sucesso = !novaQ('[data-envio-estado="sucesso"]').hidden;
      return sucesso ? dialog.close() : irParaEtapa(2);
    }
    irParaEtapa(novaEtapaAtual - 1);
  });

  novaQ('[data-nova-avancar]').addEventListener('click', () => {
    if (novaEtapaAtual < 2) {
      if (validarEtapa(novaEtapaAtual)) irParaEtapa(novaEtapaAtual + 1);
    } else if (novaEtapaAtual === 2) {
      enviarNovaSolicitacao();
    } else if (!novaQ('[data-envio-estado="sucesso"]').hidden) {
      const protocolo = novaQ('[data-nova-avancar]').dataset.protocolo;
      location.href = `/html/client/detalhes-solicitacao.html?protocolo=${encodeURIComponent(protocolo)}`;
    } else {
      enviarNovaSolicitacao();
    }
  });
}

// Roda antes do DOMContentLoaded de prototipo.js? Não importa: o modal
// não usa os handlers genéricos de prepararModais() (tem os próprios).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', prepararNovaSolicitacao);
} else {
  prepararNovaSolicitacao();
}
