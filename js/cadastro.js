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
    if (vinculo === 'nova') mostrarEtapa(5);
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

// Envia os dados de todas as etapas para criar conta e solicitação institucional.
let etapaOrigem = 4;
async function cadastrar(vinculo) {
    const tipo = document.querySelector('#cadastroPage2 input[name="identificacao"]:checked').value;
    const payload = {
        nome: document.querySelector('#nome').value.trim(),
        sobrenome: document.querySelector('#segundoNome').value.trim(),
        email: document.querySelector('#email').value.trim(),
        senha: senha.value, tipo, vinculo,
        termos: document.querySelector('#cadastroPage1 input[name="termos"]').checked
    };
    if (vinculo === 'existente') {
        if (!organizacaoSelecionada) throw new Error('Selecione uma organização nos resultados.');
        payload.organizacao_id = organizacaoSelecionada.id;
        payload.justificativa = document.querySelector('#justificativaIngresso').value.trim();
    } else {
        payload.nome_organizacao = document.querySelector('#nomeOrganizacaoNova').value.trim();
        payload.cnpj = document.querySelector('#cnpjOrganizacao').value.trim();
        payload.email_institucional = document.querySelector('#emailInstitucional').value.trim();
        payload.telefone_institucional = document.querySelector('#telefoneInstitucional').value.trim();
        payload.cargo = document.querySelector('#cargoResponsavel').value.trim();
    }
    const resultado = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    etapaOrigem = vinculo === 'existente' ? 4 : 5;
    document.querySelector('#mensagemConfirmacao').textContent = resultado.message;
    document.querySelector('#titulo-cadastro-6').textContent = 'Solicitação recebida';
    document.querySelector('#btnRevisarCadastro').hidden = true;
    mostrarEtapa(6);
}

document.querySelector('#formCadastro4').addEventListener('submit', async event => {
    event.preventDefault();
    try { await cadastrar('existente'); } catch (erro) { document.querySelector('#mensagemCadastro4').textContent = erro.message; }
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

// Etapa 5: valida CNPJ e registra a solicitação.
document.querySelector('#formCadastro5').addEventListener('submit', async event => {
    event.preventDefault();
    cnpj.setCustomValidity(cnpjValido(cnpj.value) ? '' : 'Informe um CNPJ válido.');
    if (!cnpj.reportValidity()) return;
    try { await cadastrar('nova'); } catch (erro) { document.querySelector('#mensagemCadastro5').textContent = erro.message; }
});

document.querySelector('#btnRevisarCadastro').addEventListener('click', () => mostrarEtapa(etapaOrigem));
