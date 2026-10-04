const btnTopo = document.querySelector("#btnTopo");

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