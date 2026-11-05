/* =========================================================================
   VISUALIZADOR 3D (STL, OBJ e 3MF)
   -------------------------------------------------------------------------
   Usa a biblioteca three.js (licença MIT, gratuita), carregada do CDN
   jsDelivr com versão fixa. O mapa de importação ("three" e
   "three/addons/") fica no <head> das páginas de detalhe.

   Este arquivo é um módulo ES e só é baixado quando o usuário clica em
   "Visualizar" (import() dinâmico em js/prototipo.js), para não pesar no
   carregamento da página.

   API:
     const v = criarVisualizador(elementoContainer);
     const info = v.carregar(arrayBuffer, 'STL');  // { dimensoes: {x,y,z}, triangulos }
     v.reenquadrar(); v.alternarMalha(); v.destruir();
========================================================================= */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';

export const FORMATOS_SUPORTADOS = ['STL', 'OBJ', '3MF'];

// Cores lidas das variáveis CSS do projeto, para o modelo combinar com o
// tema (inclusive o alto contraste).
function corCss(nome, padrao) {
  const valor = getComputedStyle(document.body).getPropertyValue(nome).trim();
  try { return new THREE.Color(valor || padrao); } catch { return new THREE.Color(padrao); }
}

// Converte o arquivo em um Object3D. STL e 3MF usam Z para cima (padrão
// dos fatiadores); OBJ normalmente usa Y para cima, como o three.js.
function montarObjeto(buffer, formato, material) {
  if (formato === 'STL') {
    const geometria = new STLLoader().parse(buffer);
    geometria.computeVertexNormals();
    const malha = new THREE.Mesh(geometria, material);
    malha.rotation.x = -Math.PI / 2;
    return malha;
  }
  if (formato === 'OBJ') {
    const objeto = new OBJLoader().parse(new TextDecoder().decode(buffer));
    objeto.traverse(filho => { if (filho.isMesh) filho.material = material; });
    return objeto;
  }
  if (formato === '3MF') {
    const objeto = new ThreeMFLoader().parse(buffer);
    objeto.traverse(filho => {
      if (filho.isMesh) {
        filho.geometry.computeVertexNormals();
        filho.material = material;
      }
    });
    objeto.rotation.x = -Math.PI / 2;
    return objeto;
  }
  throw new Error(`Formato ${formato} não suportado pelo visualizador.`);
}

export function criarVisualizador(container) {
  const largura = () => container.clientWidth || 640;
  const altura = () => container.clientHeight || 400;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(largura(), altura());
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Modelo 3D do arquivo anexado. Arraste para girar e use a rolagem para aproximar.');
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, largura() / altura(), 0.1, 10000);

  cena.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
  const luz = new THREE.DirectionalLight(0xffffff, 1.8);
  cena.add(camera);
  camera.add(luz); // a luz acompanha a câmera: o lado visto está sempre iluminado
  luz.position.set(1, 1, 2);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.1;

  const material = new THREE.MeshStandardMaterial({
    color: corCss('--cor-acento', '#3B82A0'),
    metalness: 0.05,
    roughness: 0.55,
    flatShading: false
  });

  let objeto = null;
  let grade = null;
  let enquadramento = null;
  let quadro = 0;

  function animar() {
    quadro = requestAnimationFrame(animar);
    controles.update();
    renderer.render(cena, camera);
  }
  animar();

  const observador = new ResizeObserver(() => {
    camera.aspect = largura() / altura();
    camera.updateProjectionMatrix();
    renderer.setSize(largura(), altura());
  });
  observador.observe(container);

  function reenquadrar() {
    if (!enquadramento) return;
    const { centro, raio } = enquadramento;
    const distancia = raio / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;
    camera.position.copy(centro).add(new THREE.Vector3(1, 0.75, 1.2).normalize().multiplyScalar(distancia));
    camera.near = distancia / 100;
    camera.far = distancia * 100;
    camera.updateProjectionMatrix();
    controles.target.copy(centro);
    controles.update();
  }

  function carregar(buffer, formato) {
    if (objeto) { cena.remove(objeto); }
    objeto = montarObjeto(buffer, String(formato).toUpperCase(), material);
    cena.add(objeto);

    // Apoia o modelo sobre a "mesa" (y = 0) e centraliza em X/Z.
    objeto.updateMatrixWorld(true);
    let caixa = new THREE.Box3().setFromObject(objeto);
    const centro = caixa.getCenter(new THREE.Vector3());
    objeto.position.sub(new THREE.Vector3(centro.x, caixa.min.y, centro.z));
    objeto.updateMatrixWorld(true);
    caixa = new THREE.Box3().setFromObject(objeto);

    const tamanho = caixa.getSize(new THREE.Vector3());
    const esfera = caixa.getBoundingSphere(new THREE.Sphere());
    enquadramento = { centro: esfera.center, raio: esfera.radius || 1 };

    if (grade) cena.remove(grade);
    const lado = Math.ceil(Math.max(tamanho.x, tamanho.z) * 1.6 / 10) * 10 || 100;
    grade = new THREE.GridHelper(lado, Math.max(4, Math.round(lado / 10)),
      corCss('--cor-texto-secundario', '#667788'), corCss('--cor-borda', '#d5dde5'));
    cena.add(grade);

    reenquadrar();

    let triangulos = 0;
    objeto.traverse(filho => {
      if (!filho.isMesh) return;
      const g = filho.geometry;
      triangulos += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    });

    // Em STL/3MF, Z (altura) do arquivo virou Y na cena.
    return {
      dimensoes: { x: tamanho.x, y: tamanho.z, z: tamanho.y },
      triangulos: Math.round(triangulos)
    };
  }

  function alternarMalha() {
    material.wireframe = !material.wireframe;
    return material.wireframe;
  }

  function destruir() {
    cancelAnimationFrame(quadro);
    observador.disconnect();
    controles.dispose();
    cena.traverse(filho => { if (filho.isMesh || filho.isLineSegments) filho.geometry?.dispose(); });
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { carregar, reenquadrar, alternarMalha, destruir };
}
