// =========================
// NAVEGAÇÃO ENTRE ETAPAS
// =========================

// Primeira etapa: dados pessoais
const btnNextPageCadastro1 = document.querySelector("#btnNextCadastro1");

btnNextPageCadastro1.addEventListener("click", function (event) {
    event.preventDefault();

    const formulario = document.querySelector("#cadastroPage1 form");

    // Verifica os campos obrigatórios
    if (!formulario.reportValidity()) {
        return;
    }

    // Verifica se as senhas coincidem
    const senha = document.querySelector("#senha");
    const confirmeSenha = document.querySelector("#confirmeSenha");

    if (senha.value !== confirmeSenha.value) {
        confirmeSenha.setCustomValidity("As senhas não coincidem.");
        confirmeSenha.reportValidity();
        return;
    }

    confirmeSenha.setCustomValidity("");

    // Avança para a segunda etapa
    document.querySelector("#cadastroPage1").style.display = "none";
    document.querySelector("#cadastroPage2").style.display = "block";
});


// Segunda etapa: identificação
const btnNextPageCadastro2 = document.querySelector("#btnNextCadastro2");

btnNextPageCadastro2.addEventListener("click", function (event) {
    event.preventDefault();

    const formulario = document.querySelector("#cadastroPage2 form");

    // Verifica se um perfil foi selecionado
    if (!formulario.reportValidity()) {
        return;
    }

    const perfilSelecionado = document.querySelector(
        '#cadastroPage2 input[name="identificacao"]:checked'
    );

    console.log("Perfil selecionado:", perfilSelecionado.value);

    // Avança para a terceira etapa
    document.querySelector("#cadastroPage2").style.display = "none";
    document.querySelector("#cadastroPage3").style.display = "block";
});

// =========================
// BOTÕES DE VOLTAR
// =========================

// Voltar da etapa 2 para a etapa 1
const btnBackCadastro2 = document.querySelector("#btnBackCadastro2");

btnBackCadastro2.addEventListener("click", function () {
    document.querySelector("#cadastroPage2").style.display = "none";
    document.querySelector("#cadastroPage1").style.display = "block";
});


// Voltar da etapa 3 para a etapa 2
const btnBackCadastro3 = document.querySelector("#btnBackCadastro3");

btnBackCadastro3.addEventListener("click", function () {
    document.querySelector("#cadastroPage3").style.display = "none";
    document.querySelector("#cadastroPage2").style.display = "block";
});