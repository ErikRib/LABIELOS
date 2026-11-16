// Recuperação de senha em etapas: 1) e-mail → 2) código → 3) nova senha → concluído.
const $ = seletor => document.querySelector(seletor);
const TOTAL = 3;
const estado = { email: '', codigo: '' };
let contagem = null;

// Mostra a etapa pedida e atualiza o indicador de progresso.
function irPara(passo) {
    document.querySelectorAll('.rec-passo').forEach(el => { el.hidden = Number(el.dataset.passo) !== passo; });
    const atual = Math.min(passo, TOTAL);
    const concluido = passo > TOTAL;
    document.querySelectorAll('.rec-etapa').forEach(el => {
        const n = Number(el.dataset.etapa);
        el.classList.toggle('feita', n < passo);
        el.classList.toggle('ativa', n === passo);
        if (n === passo) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    $('#barraProgresso').style.width = `${concluido ? 100 : ((atual - 1) / (TOTAL - 1)) * 100}%`;
    $('.rec-barra').setAttribute('aria-valuenow', String(atual));
    $('#progressoTexto').textContent = concluido ? 'Concluído' : `Etapa ${atual} de ${TOTAL}`;
    document.querySelectorAll('.rec-mensagem').forEach(m => { m.textContent = ''; });
    const secao = $(`.rec-passo[data-passo="${passo}"]`);
    (secao.querySelector('input') || secao.querySelector('h1')).focus();
}

// Botão em estado de carregamento durante a requisição.
async function carregando(botao, texto, tarefa) {
    const original = botao.textContent;
    botao.disabled = true;
    botao.textContent = texto;
    try { return await tarefa(); } finally { botao.disabled = false; botao.textContent = original; }
}

// Bloqueia "Gerar novo código" por 60 s (mesmo limite do servidor).
function iniciarContagem() {
    const botao = $('#reenviar');
    let restante = 60;
    clearInterval(contagem);
    botao.disabled = true;
    botao.textContent = `Gerar novo código (${restante}s)`;
    contagem = setInterval(() => {
        restante -= 1;
        if (restante <= 0) {
            clearInterval(contagem);
            botao.disabled = false;
            botao.textContent = 'Gerar novo código';
        } else {
            botao.textContent = `Gerar novo código (${restante}s)`;
        }
    }, 1000);
}

async function pedirCodigo() {
    const resposta = await api('/api/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email: estado.email }) });
    $('#emailDestino').textContent = estado.email;
    $('#textoDestino').textContent = resposta.enviado ? 'Enviamos um código para' : 'Não conseguimos enviar o e-mail para';
    $('#dicaSpam').hidden = !resposta.enviado;
    $('#codigoDemo').textContent = resposta.codigo || '';
    $('#avisoCodigo').hidden = !resposta.codigo;
    iniciarContagem();
    return resposta;
}

// Etapa 1 — e-mail
$('#passo1').addEventListener('submit', async event => {
    event.preventDefault();
    const campo = $('#email');
    const mensagem = $('#msg1');
    if (!campo.checkValidity()) {
        mensagem.textContent = 'Informe um e-mail válido.';
        campo.focus();
        return;
    }
    estado.email = campo.value.trim();
    try {
        await carregando(event.submitter || event.target.querySelector('[type=submit]'), 'Enviando...', pedirCodigo);
        irPara(2);
    } catch (erro) { mensagem.textContent = erro.message; }
});

// Etapa 2 — código
$('#codigo').addEventListener('input', event => { event.target.value = event.target.value.replace(/\D/g, '').slice(0, 6); });

$('#passo2').addEventListener('submit', async event => {
    event.preventDefault();
    const codigo = $('#codigo').value;
    const mensagem = $('#msg2');
    if (!/^\d{6}$/.test(codigo)) {
        mensagem.textContent = 'O código tem 6 dígitos.';
        $('#codigo').focus();
        return;
    }
    try {
        await carregando(event.target.querySelector('[type=submit]'), 'Verificando...', () =>
            api('/api/auth/password/verify', { method: 'POST', body: JSON.stringify({ email: estado.email, codigo }) }));
        estado.codigo = codigo;
        irPara(3);
    } catch (erro) { mensagem.textContent = erro.message; }
});

$('#reenviar').addEventListener('click', async () => {
    const mensagem = $('#msg2');
    try {
        const resposta = await pedirCodigo();
        mensagem.textContent = resposta.enviado ? 'Novo código enviado para o seu e-mail.' : 'Novo código gerado.';
    } catch (erro) { mensagem.textContent = erro.message; }
});

// Etapa 3 — nova senha, com checagem ao vivo dos requisitos
function conferirRequisitos() {
    const senha = $('#novaSenha').value;
    const confirmacao = $('#confirmarSenha').value;
    const tamanho = senha.length >= 8;
    const iguais = tamanho && senha === confirmacao;
    $('#reqTamanho').classList.toggle('ok', tamanho);
    $('#reqIguais').classList.toggle('ok', iguais);
    return tamanho && iguais;
}
$('#novaSenha').addEventListener('input', conferirRequisitos);
$('#confirmarSenha').addEventListener('input', conferirRequisitos);

$('#passo3').addEventListener('submit', async event => {
    event.preventDefault();
    const mensagem = $('#msg3');
    if (!conferirRequisitos()) {
        mensagem.textContent = 'A senha precisa ter 8 caracteres ou mais e as duas devem ser iguais.';
        return;
    }
    try {
        await carregando(event.target.querySelector('[type=submit]'), 'Salvando...', () =>
            api('/api/auth/password/reset', { method: 'POST', body: JSON.stringify({ email: estado.email, codigo: estado.codigo, nova_senha: $('#novaSenha').value }) }));
        clearInterval(contagem);
        irPara(4);
    } catch (erro) { mensagem.textContent = erro.message; }
});

// Botões "Voltar" entre etapas
document.querySelectorAll('[data-voltar]').forEach(botao => botao.addEventListener('click', () => irPara(Number(botao.dataset.voltar))));
