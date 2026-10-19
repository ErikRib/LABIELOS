/*
   Comportamento geral da interface pública: exibe o botão "voltar ao
   topo" depois de rolar a página e rola suavemente até o topo ao clicar.
   Só faz algo se a página atual tiver o botão (#btnTopo).
*/

const btnTopo = document.querySelector("#btnTopo");

if (btnTopo) {

    // Só mostra o botão depois de uma rolagem significativa.
    window.addEventListener("scroll", () => {

        if (window.scrollY > 400) {
            btnTopo.classList.add("visivel");
        } else {
            btnTopo.classList.remove("visivel");
        }

    });

    btnTopo.addEventListener("click", () => {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

}
