// =========================
// NAVEGAÇÃO DO CADASTRO
// =========================

// Mostra apenas a etapa solicitada, sem apagar os campos preenchidos.
function mostrarEtapa(numero) {
    document.querySelectorAll('.cadastro-pagina > .cadastro-container').forEach(secao => {
        secao.hidden = true;
    });
    const etapa = document.querySelector(`#cadastroPage${numero}`);
    etapa.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Vincula a navegação de retorno aos botões existentes.
[2, 3, 4, 5].forEach(numero => {
    document.querySelector(`#btnBackCadastro${numero}`).addEventListener('click', () => mostrarEtapa(numero === 5 ? 3 : numero - 1));
});

// Etapa 1: valida senhas e campos pessoais.
const senha = document.querySelector('#senha');
const confirmeSenha = document.querySelector('#confirmeSenha');
[senha, confirmeSenha].forEach(campo => campo.addEventListener('input', () => confirmeSenha.setCustomValidity('')));

document.querySelector('#cadastroPage1 form').addEventListener('submit', event => {
    event.preventDefault();
    confirmeSenha.setCustomValidity(senha.value === confirmeSenha.value ? '' : 'As senhas não coincidem.');
    if (!confirmeSenha.reportValidity()) return;
    mostrarEtapa(2);
});

// Etapa 2: registra o tipo de organização escolhido.
document.querySelector('#cadastroPage2 form').addEventListener('submit', event => {
    event.preventDefault();
    mostrarEtapa(3);
});

// Etapa 3: direciona para organização existente ou nova.
document.querySelector('#formCadastro3').addEventListener('submit', event => {
    event.preventDefault();
    const vinculo = document.querySelector('#formCadastro3 input[name="vinculo"]:checked')?.value;
    if (vinculo === 'existente') mostrarEtapa(4);
    if (vinculo === 'nova') {
        ajustarObrigatoriedadeEndereco();
        mostrarEtapa(5);
    }
});

// =========================
// ORGANIZAÇÃO EXISTENTE
// =========================

// Busca organizações ativas no MongoDB via API.
const busca = document.querySelector('#buscarOrganizacao');
const resultados = document.querySelector('#resultadoOrganizacoes');
let organizacaoSelecionada = null;
let buscaAtual = 0;
function mensagemBusca(texto) {
    const p = document.createElement('p');
    p.textContent = texto;
    resultados.replaceChildren(p);
}
busca.addEventListener('input', async () => {
    const numeroBusca = ++buscaAtual;
    organizacaoSelecionada = null;
    const termo = busca.value.trim();
    if (termo.length < 2) return mensagemBusca('Digite pelo menos 2 caracteres.');
    const tipo = document.querySelector('#cadastroPage2 input[name="identificacao"]:checked')?.value;
    try {
        const data = await api(`/api/organizations?q=${encodeURIComponent(termo)}&tipo=${encodeURIComponent(tipo)}`);
        if (numeroBusca !== buscaAtual) return;
        resultados.replaceChildren();
        if (!data.items.length) return mensagemBusca('Nenhuma organização ativa encontrada.');
        data.items.forEach(org => {
            const label = document.createElement('label');
            label.className = 'opcao-perfil';
            const radio = document.createElement('input');
            radio.type = 'radio'; radio.name = 'organizacaoEncontrada'; radio.value = org.id;
            const nome = document.createElement('span'); nome.textContent = org.nome;
            label.append(radio, nome);
            radio.addEventListener('change', () => { organizacaoSelecionada = org; });
            resultados.append(label);
        });
    } catch (erro) { if (numeroBusca === buscaAtual) mensagemBusca(erro.message); }
});

// =========================
// REVISÃO E ENVIO
// =========================

// Monta o corpo de POST /api/auth/register a partir de todas as etapas.
function montarPayload(vinculo) {
    const tipo = document.querySelector('#cadastroPage2 input[name="identificacao"]:checked').value;
    const payload = {
        nome: document.querySelector('#nome').value.trim(),
        sobrenome: document.querySelector('#segundoNome').value.trim(),
        email: document.querySelector('#email').value.trim(),
        senha: senha.value, tipo, vinculo,
        termos: document.querySelector('#cadastroPage1 input[name="termos"]').checked
    };
    if (vinculo === 'existente') {
        payload.organizacao_id = organizacaoSelecionada.id;
        payload.justificativa = document.querySelector('#justificativaIngresso').value.trim();
    } else {
        payload.nome_organizacao = document.querySelector('#nomeOrganizacaoNova').value.trim();
        payload.cnpj = document.querySelector('#cnpjOrganizacao').value.trim();
        payload.email_institucional = document.querySelector('#emailInstitucional').value.trim();
        payload.telefone_institucional = document.querySelector('#telefoneInstitucional').value.trim();
        payload.cargo = document.querySelector('#cargoResponsavel').value.trim();
        payload.endereco = lerEndereco();
    }
    return payload;
}

// Etapa 7: mostra o resumo antes de enviar. "Revisar dados" volta para a
// etapa de origem (4 = organização existente, 5 = organização nova).
let vinculoEmRevisao = null;
function mostrarRevisao(vinculo) {
    vinculoEmRevisao = vinculo;
    const p = montarPayload(vinculo);
    const linhas = [
        ['Nome', `${p.nome} ${p.sobrenome}`.trim()],
        ['E-mail', p.email],
        ['Perfil', p.tipo === 'fabricante' ? 'Parceiro de manufatura (fabricante)' : 'Organização solicitante']
    ];
    if (vinculo === 'existente') {
        linhas.push(['Organização', organizacaoSelecionada.nome]);
        if (p.justificativa) linhas.push(['Justificativa', p.justificativa]);
    } else {
        linhas.push(['Nova organização', p.nome_organizacao], ['CNPJ', p.cnpj],
            ['E-mail institucional', p.email_institucional], ['Telefone institucional', p.telefone_institucional],
            ['Seu cargo', p.cargo]);
        if (p.tipo === 'fabricante') linhas.push(['Endereço de retirada', textoEndereco(p.endereco)]);
    }
    const resumo = document.querySelector('#resumoCadastro');
    resumo.replaceChildren(...linhas.flatMap(([rotulo, valor]) => {
        const div = document.createElement('div');
        const dt = document.createElement('dt'); dt.textContent = rotulo;
        const dd = document.createElement('dd'); dd.textContent = valor;
        div.append(dt, dd);
        return div;
    }));

    const nova = vinculo === 'nova';
    document.querySelector('#textoRevisao').textContent = nova
        ? 'Confira os dados antes de criar a organização.'
        : 'Confira os dados antes de enviar o pedido de ingresso.';
    document.querySelector('#avisoRevisao').textContent = nova
        ? 'Ao confirmar, a organização é criada e você entra na plataforma como administrador dela.'
        : `Ao confirmar, seu pedido vai para os administradores de ${organizacaoSelecionada.nome}. O acesso é liberado quando um deles aprovar.`;
    document.querySelector('#btnConfirmarCadastro').textContent = nova ? 'Criar organização' : 'Enviar solicitação';
    document.querySelector('#mensagemCadastro7').textContent = '';
    mostrarEtapa(7);
}

document.querySelector('#btnRevisarCadastro').addEventListener('click', () => mostrarEtapa(vinculoEmRevisao === 'nova' ? 5 : 4));

document.querySelector('#btnConfirmarCadastro').addEventListener('click', async event => {
    const botao = event.currentTarget;
    botao.disabled = true;
    try {
        const resultado = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(montarPayload(vinculoEmRevisao)) });
        mostrarConfirmacao(resultado);
    } catch (erro) {
        document.querySelector('#mensagemCadastro7').textContent = erro.message;
    } finally {
        botao.disabled = false;
    }
});

// Etapa 6: resultado do envio.
//  - organização nova: a API já abriu a sessão (acesso_liberado), então
//    oferece "Acessar plataforma";
//  - organização existente: o acesso depende do admin, então oferece o login.
function mostrarConfirmacao(resultado) {
    const liberado = !!resultado.acesso_liberado;
    document.querySelector('#titulo-cadastro-6').textContent = liberado ? 'Organização criada' : 'Solicitação enviada';
    document.querySelector('#mensagemConfirmacao').textContent = resultado.message;
    document.querySelector('#avisoConfirmacao').textContent = liberado
        ? 'Você já está conectado como administrador. Pelo menu de perfil, em "Administração", você aprova quem pedir para entrar na sua organização.'
        : 'Você receberá acesso assim que um administrador da organização aprovar seu pedido. Depois disso, é só entrar com seu e-mail e senha.';
    document.querySelector('#btnAcessarPlataforma').hidden = !liberado;
    document.querySelector('#linkIrLogin').hidden = liberado;
    mostrarEtapa(6);
}

document.querySelector('#btnAcessarPlataforma').addEventListener('click', async () => {
    location.href = await destinoAposEntrar();
});

document.querySelector('#formCadastro4').addEventListener('submit', event => {
    event.preventDefault();
    const aviso = document.querySelector('#mensagemCadastro4');
    if (!organizacaoSelecionada) { aviso.textContent = 'Selecione uma organização nos resultados.'; return; }
    aviso.textContent = '';
    mostrarRevisao('existente');
});

// Valida o formato e os dígitos verificadores do CNPJ.
function cnpjValido(valor) {
    const numeros = valor.replace(/\D/g, '');
    if (numeros.length !== 14 || /^(\d)\1{13}$/.test(numeros)) return false;
    const digito = (base, pesos) => {
        const soma = [...base].reduce((total, n, i) => total + Number(n) * pesos[i], 0);
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };
    const d1 = digito(numeros.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
    const d2 = digito(numeros.slice(0, 12) + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
    return numeros.endsWith(`${d1}${d2}`);
}

const cnpj = document.querySelector('#cnpjOrganizacao');
cnpj.addEventListener('input', () => cnpj.setCustomValidity(''));

// =========================
// ENDEREÇO DA ORGANIZAÇÃO NOVA
// =========================

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const CAMPOS_ENDERECO = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];
const campoEndereco = nome => document.querySelector(`#formCadastro5 [name="${nome}"]`);
document.querySelector('#ufOrganizacao').innerHTML = '<option value="">—</option>' + UFS.map(uf => `<option>${uf}</option>`).join('');

// Fabricante: endereço obrigatório (é onde as peças são produzidas e
// retiradas). Organização solicitante: opcional.
function ajustarObrigatoriedadeEndereco() {
    const fabricante = document.querySelector('#cadastroPage2 input[name="identificacao"]:checked')?.value === 'fabricante';
    // Organização solicitante não tem local de retirada: o bloco nem aparece.
    ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'].forEach(n => { campoEndereco(n).required = fabricante; });
    document.querySelector('#grupoEndereco').hidden = !fabricante;
}
document.querySelectorAll('#cadastroPage2 input[name="identificacao"]').forEach(r => r.addEventListener('change', ajustarObrigatoriedadeEndereco));
ajustarObrigatoriedadeEndereco();

function lerEndereco() {
    if (document.querySelector('#grupoEndereco').hidden) return null;
    const e = Object.fromEntries(CAMPOS_ENDERECO.map(n => [n, campoEndereco(n).value.trim()]));
    return Object.values(e).some(Boolean) ? e : null;
}

// Preenche rua, bairro, cidade e UF pelo CEP (ViaCEP). Se a consulta
// falhar, o usuário continua preenchendo à mão.
const cep = campoEndereco('cep');
cep.addEventListener('input', async () => {
    let v = cep.value.replace(/\D/g, '').slice(0, 8);
    cep.value = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
    const status = document.querySelector('#statusCep');
    status.textContent = '';
    if (v.length !== 8) return;
    status.textContent = 'Buscando endereço…';
    try {
        const r = await fetch(`https://viacep.com.br/ws/${v}/json/`);
        const d = await r.json();
        if (d.erro) { status.textContent = 'CEP não encontrado. Preencha manualmente.'; return; }
        [['logradouro', d.logradouro], ['bairro', d.bairro], ['cidade', d.localidade], ['uf', d.uf]]
            .forEach(([n, valor]) => { if (valor && !campoEndereco(n).value) campoEndereco(n).value = valor; });
        status.textContent = '';
        campoEndereco('numero').focus();
    } catch {
        status.textContent = 'Não foi possível consultar o CEP. Preencha manualmente.';
    }
});

function textoEndereco(e) {
    if (!e) return '';
    const linha1 = [e.logradouro, e.numero].filter(Boolean).join(', ') + (e.complemento ? ` — ${e.complemento}` : '');
    const linha2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(', ');
    return [linha1, linha2, e.cep && `CEP ${e.cep}`].filter(Boolean).join(' · ');
}

// Etapa 5: valida o CNPJ e vai para a revisão.
document.querySelector('#formCadastro5').addEventListener('submit', event => {
    event.preventDefault();
    cnpj.setCustomValidity(cnpjValido(cnpj.value) ? '' : 'Informe um CNPJ válido.');
    if (!cnpj.reportValidity()) return;
    mostrarRevisao('nova');
});
