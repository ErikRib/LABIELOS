/*
   Recursos de acessibilidade das páginas públicas: aumento/redução do
   tamanho da fonte e alternância de alto contraste (com a preferência
   de contraste salva no localStorage para persistir entre visitas).

   Nem toda página que carrega este script tem os três controles de
   acessibilidade no cabeçalho — por isso cada bloco só liga seu botão
   se ele realmente existir na página atual.
*/

// Tamanho da fonte do documento, em % do valor padrão do navegador.
let tamanhoFonte = 100;

const btnMenor = document.querySelector(".btn-acess-font-menor");

btnMenor?.addEventListener("click", function () {

    tamanhoFonte -= 10;

    document.body.style.fontSize = tamanhoFonte + "%";

    console.log(tamanhoFonte + "%");

});

const btnMaior = document.querySelector(".btn-acess-font-maior");

btnMaior?.addEventListener("click", function () {

    tamanhoFonte += 10;

    document.body.style.fontSize = tamanhoFonte + "%";

    console.log(tamanhoFonte + "%");

});

const btnContraste = document.querySelector(".btn-acess-contr");

const textoContraste = btnContraste?.querySelector(
    ".acess-item-screen-reader"
);

const contrasteSalvo =
    localStorage.getItem("altoContraste") === "true";

// Aplica (ou remove) a classe de alto contraste e mantém o botão
// (texto, title e aria-pressed) coerente com o estado atual.
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


if (btnContraste) {

    // Restaura o estado salvo assim que a página carrega.
    atualizarContraste(contrasteSalvo);

    // Alterna o alto contraste a cada clique e salva a nova preferência.
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

}
