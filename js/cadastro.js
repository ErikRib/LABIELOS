// Script para alternar entre as páginas do cadastro.
const btnNextPageCadastro = document.querySelector("#btnNextCadastro")
btnNextPageCadastro.addEventListener("click", function (event) {
    event.preventDefault()
    document.querySelector("#cadastroPage1").style.display = "none"
    document.querySelector("#cadastroPage2").style.display = "block"
}
)

// Script para o botão de cadastro.
const btnCadastrarUser = document.querySelector("#btnCadastrar")
btnCadastrarUser.addEventListener("click", function (event) {
    event.preventDefault()
    document.querySelector("#cadastroPage2").style.display = "none"
    // Adicione aqui a lógica para o cadastro
})