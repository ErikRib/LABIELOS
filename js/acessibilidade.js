let tamanhoFonte = 100;

const btnMenor = document.querySelector(".btn-acess-font-menor");

btnMenor.addEventListener("click", function () {

    tamanhoFonte -= 10;

    document.body.style.fontSize = tamanhoFonte + "%";

    console.log(tamanhoFonte + "%");

});

const btnMaior = document.querySelector(".btn-acess-font-maior");

btnMaior.addEventListener("click", function () {

    tamanhoFonte += 10;

    document.body.style.fontSize = tamanhoFonte + "%";

    console.log(tamanhoFonte + "%");

});

const btnContraste = document.querySelector(".btn-acess-contr");

const textoContraste = btnContraste.querySelector(
    ".acess-item-screen-reader"
);

const contrasteSalvo =
    localStorage.getItem("altoContraste") === "true";


function atualizarContraste(ativo) {

    document.body.classList.toggle(
        "alto-contraste",
        ativo
    );

    btnContraste.setAttribute(
        "aria-pressed",
        ativo.toString()
    );

    btnContraste.setAttribute(
        "title",
        ativo
            ? "Desativar alto contraste"
            : "Ativar alto contraste"
    );

    textoContraste.textContent =
        ativo
            ? "Desativar alto contraste"
            : "Ativar alto contraste";
}


atualizarContraste(contrasteSalvo);


btnContraste.addEventListener("click", () => {

    const novoEstado =
        !document.body.classList.contains(
            "alto-contraste"
        );

    atualizarContraste(novoEstado);

    localStorage.setItem(
        "altoContraste",
        novoEstado.toString()
    );

});