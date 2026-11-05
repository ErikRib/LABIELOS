# Documentação do Front-end --- LABIELOS

## 1. Objetivo

Este documento descreve o estado atual do front-end do **LABIELOS**,
apresentando sua organização, páginas, componentes visuais, recursos de
acessibilidade e funcionalidades já representadas no protótipo.

A documentação considera somente o que existe atualmente no front-end.
Funcionalidades de back-end, banco de dados, autenticação real e
integrações futuras não são tratadas como recursos concluídos.

> **Atualização:** partes deste documento (principalmente a seção 5,
> sobre a área autenticada da organização solicitante) foram escritas antes da conexão com
> uma API real. Login, cadastro, perfil e os painéis da organização solicitante/fabricante
> já consomem dados de uma API — ver
> [`design-system.md`](./design-system.md), seções 8 e 10, para o estado
> atual. Os trechos abaixo que mencionam "dados simulados" descrevem o
> estágio anterior do projeto.

------------------------------------------------------------------------

## 2. Tecnologias utilizadas

O front-end atual foi desenvolvido utilizando:

-   **HTML5** para estruturação das páginas;
-   **CSS3** para estilização, responsividade e organização visual;
-   **JavaScript** para interações da interface e funcionamento do
    protótipo;
-   **Google Fonts**, utilizando principalmente as famílias *Plus
    Jakarta Sans* e *Inter*;
-   **VLibras**, referenciado nas páginas públicas como recurso de
    acessibilidade.

Atualmente não é utilizado um framework de front-end. A aplicação é
estruturada com HTML, CSS e JavaScript nativos.

------------------------------------------------------------------------

## 3. Estrutura do front-end

A estrutura principal do projeto está organizada da seguinte forma:

``` text
LABIELOS/
├── content/
│   └── img/
├── css/
│   ├── components/
│   ├── pages/
│   └── style.css
├── docs/
├── html/
│   ├── client/          (index, solicitacoes, detalhes-solicitacao, parceiros,
│   │                     materiais, relatorios; historico.html só redireciona)
│   ├── fabricator/      (index, fila, demandas, detalhe-demanda, impressoras, materiais)
│   ├── admin.html       (administração da organização)
│   ├── cadastro.html
│   ├── contato.html
│   ├── login.html
│   ├── perfil.html
│   ├── privacidade.html
│   └── termos.html
├── js/
│   ├── acessibilidade.js
│   ├── interface.js
│   ├── legal.js
│   ├── api.js
│   ├── login.js
│   ├── cadastro.js
│   ├── perfil.js
│   ├── prototipo.js
│   ├── nova-solicitacao.js
│   ├── materiais.js
│   ├── impressoras.js
│   ├── relatorios.js
│   ├── admin.js
│   ├── fabricator.js
│   ├── navbar-painel.js
│   ├── sugestoes.js
│   ├── visualizador-3d.js
│   └── filtros.js
├── index.html
└── README.md
```

### `content/img/`

Armazena os recursos gráficos utilizados pela interface, como logotipos,
favicon e imagem de usuário. A pasta `old/` mantém arquivos gráficos
anteriores à identidade atual do LABIELOS.

### `css/`

Os estilos foram separados entre estilos globais, componentes
reutilizáveis e páginas específicas.

O arquivo `style.css` concentra definições globais do projeto.

Em `css/components/` encontram-se estilos reutilizáveis, incluindo:

-   acessibilidade;
-   badges;
-   botões;
-   footer;
-   formulários;
-   modal;
-   assistente em etapas (`stepper.css`, usado pela nova solicitação);
-   barra de navegação;
-   tabelas.

Em `css/pages/` encontram-se estilos específicos das diferentes páginas
e áreas da aplicação.

### `html/`

Contém as páginas complementares da aplicação.

A pasta `client/` representa atualmente o protótipo da área autenticada
utilizada pela organização solicitante.

A pasta `fabricator/` representa o protótipo da área autenticada utilizada
pelo parceiro de manufatura (ver
[`design-system.md`](./design-system.md) para os detalhes).

### `js/`

Contém os scripts responsáveis pelas interações atualmente existentes na
interface.

------------------------------------------------------------------------

## 4. Área pública

### 4.1 Página inicial

O arquivo `index.html` representa a página pública inicial do LABIELOS.

Atualmente a página apresenta:

-   identidade visual do LABIELOS;
-   apresentação resumida da plataforma, com atalhos para login e
    cadastro de organização;
-   seção "Sobre" com quatro frentes: solicitações guiadas, parceiros
    conectados, materiais para doação e acompanhamento;
-   fluxo da plataforma em cinco etapas (cadastro e aprovação da
    organização → solicitação em 4 etapas → escolha de parceiros →
    produção → acompanhamento);
-   seção "Para quem" com os três perfis de acesso (instituições solicitantes, parceiros de
    manufatura e administradores de organização);
-   bloco de privacidade e segurança com link para a Política de
    Privacidade;
-   recursos de acessibilidade.

A página apresenta o LABIELOS como um hub digital destinado a conectar
instituições de saúde e reabilitação aos parceiros responsáveis pela manufatura aditiva, centralizando
solicitações, informações e acompanhamento do processo.

### 4.2 Login

A página `html/login.html` contém a interface de autenticação.

Neste estágio, ela deve ser considerada uma **interface de front-end**.
A autenticação real ainda dependerá da implementação posterior da lógica
da aplicação e do back-end.

### 4.3 Contato

A página `html/contato.html` representa a interface destinada ao contato
com o projeto.

------------------------------------------------------------------------

## 5. Área autenticada --- protótipo da organização solicitante

A pasta `html/client/` contém a área atualmente desenvolvida para
representar a utilização da plataforma pela organização solicitante.

As informações exibidas nessa área são buscadas em uma API real por meio
do arquivo `js/prototipo.js` (ver seção 7 e
[`design-system.md`](./design-system.md), seção 10). O back-end que
atende a essa API ainda não foi implementado, então essas páginas só
funcionam com um servidor respondendo ao contrato documentado em
[`backend.md`](./backend.md) e [`integracao-backend.md`](./integracao-backend.md).
Não há mais nenhuma tela com dados fixos no código.

### 5.1 Dashboard

O arquivo `html/client/index.html` apresenta o painel inicial.

Atualmente são representados:

-   identificação do usuário e da organização;
-   resumo das solicitações;
-   quantidade de solicitações abertas;
-   solicitações em análise;
-   solicitações em produção;
-   solicitações prontas para retirada;
-   solicitações concluídas;
-   tabela de solicitações recentes **em andamento**;
-   acesso à criação de uma nova solicitação.

### 5.2 Solicitações

A página `html/client/solicitacoes.html` apresenta a listagem das
solicitações.

Mostra só as solicitações **em andamento**, com filtros por coluna e
acesso aos detalhes. As concluídas ficam em Relatórios (seção 5.5).

### 5.2.1 Nova solicitação (assistente em 4 etapas)

O botão "+ Nova solicitação" (Início, Solicitações e Detalhes) abre um
modal em etapas, implementado em `js/nova-solicitacao.js` +
`css/components/stepper.css`. O HTML do modal é **gerado pelo script**
(antes estava copiado em três páginas): basta a página ter um botão
`.btn-nova-solicitacao` e carregar `api.js`, `prototipo.js` e
`nova-solicitacao.js`, nessa ordem.

| Etapa | Conteúdo |
|---|---|
| 1. Informações da peça | Solicitação, requerente (automático, só leitura), prioridade, categoria (com sugestões), prazo desejado (opcional, não aceita data passada) e material (sugere os materiais com estoque em `GET /api/materiais`). |
| 2. Arquivo e especificações | Descrição/especificações e arquivo 3D (clique ou arraste; STL, OBJ, 3MF, STEP/STP, IGES/IGS até 50 MB). **Não há escolha de parceiro**: a solicitação vai para a fila global (ver 5A). |
| 3. Revisão | Resumo de tudo, com "Editar" para voltar a uma etapa sem perder o preenchimento. |
| 4. Envio | `POST /api/solicitacoes`; mostra o protocolo criado com "Ver solicitação"/"Concluir", ou o erro da API com "Tentar novamente". |

Comportamentos:

-   cada etapa valida só os próprios campos antes de avançar;
-   os círculos do stepper de etapas já concluídas são clicáveis;
-   clicar fora do modal **não** fecha (evita perder o preenchimento);
    fechar pelo "×", "Cancelar" ou Esc pede confirmação se houver algo
    preenchido;
-   no celular, os rótulos do stepper dão lugar à legenda "Etapa X de 4";
-   a legenda também é anunciada para leitores de tela (`aria-live`).

O formato da requisição está em
[`integracao-backend.md`](./integracao-backend.md), seção 5.

### 5.3 Detalhes da solicitação

O arquivo `html/client/detalhes-solicitacao.html` apresenta informações
detalhadas de uma solicitação.

A interface contempla:

-   informações gerais;
-   status e fluxo da solicitação;
-   histórico;
-   descrição;
-   dados do arquivo 3D anexado;
-   opções de edição representadas no protótipo;
-   **visualizador 3D real** do anexo (botão "Visualizar 3D") e botão "Baixar".

#### Visualizador 3D

-   Biblioteca: **three.js 0.169.0** (licença MIT, gratuita), carregada do
    CDN jsDelivr pelo `<script type="importmap">` no `<head>` de
    `html/client/detalhes-solicitacao.html` e
    `html/fabricator/detalhe-demanda.html`.
-   Código em `js/visualizador-3d.js` (módulo ES). O módulo e o arquivo
    só são baixados quando o usuário clica em "Visualizar 3D", por meio de
    `import()` em `abrirVisualizadorArquivo()` de `js/prototipo.js`.
-   Formatos: **STL, OBJ e 3MF**. STEP e IGES são formatos CAD que o
    navegador não abre: o modal avisa e oferece o download.
-   Recursos: girar, aproximar e mover (OrbitControls); os botões
    "Centralizar" e "Ver malha" (wireframe); dimensões em mm (X × Y × Z) e
    número de triângulos. O modelo fica apoiado numa grade, e STL/3MF usam
    Z para cima, como os fatiadores.
-   O arquivo vem de `arquivo3d.url` ou, sem ela, de
    `GET /api/solicitacoes/{protocolo}/arquivo3d`
    (ver `docs/integracao-backend.md`). Ao fechar o modal, o WebGL é
    descartado.
-   Sem internet ou com o CDN bloqueado, o modal mostra o erro e o botão
    "Baixar" continua funcionando. Para rodar sem CDN, copie os mesmos
    arquivos para `js/vendor/three/` e troque os endereços do importmap.

### 5.4 Parceiros de manufatura

A página `html/client/parceiros.html` lista os fabricantes ativos com
dados calculados pela API (`GET /api/parceiros`):

-   disponibilidade, calculada pelas impressoras (Disponível, Capacidade
    limitada ou Indisponível);
-   impressoras livres/total e tecnologias;
-   materiais para doação em estoque;
-   quantas solicitações o parceiro já concluiu para a organização;
-   filtros: busca, tecnologia, "com impressora livre agora" e "com material
    para doação";
-   modal de detalhes com as impressoras (volume e status), os materiais
    para doação, os locais de retirada e o contato.

### 5.5 Relatórios

`html/client/relatorios.html` (`js/relatorios.js`, `css/pages/relatorios.css`)
substitui o antigo "Histórico"; `historico.html` só redireciona. A página
traz:

-   todas as solicitações da organização, em qualquer etapa;
-   filtros de busca, status, categoria, parceiro e período de abertura;
-   indicadores: total, em andamento, concluídas e tempo médio até
    concluir (a partir de `concluida_em`);
-   gráficos de barras por etapa e por parceiro; clicar numa barra filtra a
    tabela;
-   tabela com data de conclusão e dias;
-   o botão **Exportar CSV**.

### 5.6 Materiais para doação

A página `html/client/materiais.html` mostra os insumos de impressão 3D
(filamentos, resinas etc.) que os parceiros declararam disponíveis para
produções doadas (`GET /api/materiais`):

-   resumo por material (total por unidade, quantos parceiros têm
    estoque);
-   tabela com material, tipo, cor, quantidade, parceiro, situação
    (Disponível / Estoque baixo / Esgotado) e data de atualização;
-   busca por texto e filtros por tipo e situação.

------------------------------------------------------------------------

## 5A. Área do fabricante --- fila global, impressoras e materiais

### Fila global de novas solicitações

Toda solicitação criada entra em `status="Aberta"`, sem parceiro, na
**fila global** (`html/fabricator/fila.html`, menu "Novas solicitações").
Todos os fabricantes veem a mesma fila, ordenada por prioridade e depois
pela abertura mais antiga, com busca e filtro de prioridade. Ali dá para
ver os detalhes (inclusive o arquivo 3D) e **aceitar**.

- Quem aceita primeiro assume a solicitação, que sai da fila e vai para
  "Demandas" desse fabricante (`Em análise`). Se outro parceiro aceitou
  antes, aparece o aviso e a fila se atualiza.
- Em "Em análise", o fabricante pode **devolver à fila** ou **iniciar
  produção**. Depois disso, ele **marca como concluída**.
- Na área da organização solicitante, a coluna "Parceiro" mostra
  "Aguardando parceiro" até alguém aceitar. O modal "Editar solicitação"
  não altera mais parceiro nem status.
- A Visão geral do fabricante mostra o contador "Novas na fila", com link
  para a fila.

### Impressoras

`html/fabricator/impressoras.html` (`js/impressoras.js`,
`css/pages/impressoras.css`) segue o mesmo padrão de Materiais:

- resumo (total, disponíveis, em uso, em manutenção);
- busca e filtros por tecnologia e status;
- tabela com identificação, modelo, tecnologia, volume de impressão
  (X × Y × Z mm), materiais compatíveis e status;
- registrar, editar e remover pelo formulário.

O cartão "Capacidade produtiva" da Visão geral tem os atalhos
"+ Registrar impressora" (abre `impressoras.html?nova=1` com o formulário
aberto) e "Ver impressoras". A contagem de impressoras e as tecnologias
mostradas às organizações solicitantes vêm desse cadastro.

### Fluxo da solicitação (página de detalhes)

O fluxo tem **5 etapas** (`ETAPAS_FLUXO` em `js/prototipo.js`): Aberta,
Em análise, Em produção, Pronta para retirada e Concluída. A linha é
preenchida **até a bolinha da etapa atual**: o JS define `--etapas` e
`--progresso` (de 0 a 1), e o CSS anima até esse ponto. As etapas
anteriores ficam com ✓, e em "Concluída" o fluxo inteiro fica concluído.

### Faixa "Próxima etapa" (página de detalhes)

Logo abaixo do cabeçalho, nas duas telas, a faixa `.barra-etapa`
(`renderBarraEtapa` em `js/prototipo.js`) mostra:
-   a etapa ("Etapa 3 de 5 · Em produção");
-   o que acontece agora, em uma frase;
-   **os botões daquela etapa**, à direita, com a ação principal por último:
    no fabricante, Aceitar / Devolver à fila + Iniciar produção / Concluir
    produção; no solicitante, Devolver para ajuste + Aprovar peça.

O tom da faixa indica de quem é a vez: `-acao` (azul) quando quem está
vendo precisa agir, `-info` (neutro) quando é só acompanhar e `-fim`
(verde) quando a solicitação foi concluída. O retorno de cada ação
("Solicitação aceita…") aparece num aviso logo acima da faixa
(`.mensagem-fabricante`, em `css/style.css`), e não mais ao lado dos
botões. O formulário do histórico não tem mais "Tipo de registro": com
arquivo, o registro é "Anexo"; sem arquivo, "Comentário".

### Início da produção (impressora e material)

-   **"Iniciar produção"** (`iniciarProducao` em `js/fabricator.js`) abre um
    modal com:
    -   as impressoras da organização (as em manutenção aparecem bloqueadas;
        as inativas não aparecem);
    -   a origem do material: **doado pelo parceiro**, com a escolha do item
        do estoque (os esgotados ficam bloqueados), ou **fornecido pelo
        solicitante**, com o que entregar e o endereço de entrega.
-   **Material do solicitante:** a demanda fica em **"Aguardando
    material"**. O fluxo ganha essa etapa (`etapasDe(s)` em
    `js/prototipo.js`), e a faixa do solicitante mostra o que entregar e
    onde. O parceiro clica em "Confirmar recebimento do material" para
    começar a produzir.
-   **Cartão "Impressora e material"** (`#producaoSolicitacao`), nas duas
    telas de detalhe: mostra a impressora, o material, a origem e a
    entrega ou o recebimento.

### Retirada, aprovação e devolução para ajuste

-   **Fabricante:** em "Em produção", o botão **"Concluir produção"** abre
    um modal (`abrirModalAcao` em `js/prototipo.js`, chamado por
    `concluirProducao` em `js/fabricator.js`). O modal lista os endereços da
    organização (`GET /api/organizacao/enderecos`). Com mais de um
    endereço, nenhum vem marcado e é preciso escolher; com um só, ele já
    vem marcado. Há também um campo opcional de instruções. Sem endereço, o
    modal pede para cadastrar um em Administração. A API gera o registro
    "Disponível para retirada" no histórico.
-   **Solicitante:** em "Pronta para retirada", aparece a faixa
    `#acoesSolicitante` com **"Aprovar peça"** (confirmação) e **"Devolver
    para ajuste"** (motivo obrigatório, com pelo menos 10 caracteres).
-   **As duas telas:** o cartão **"Retirada da peça"**
    (`#retiradaSolicitacao`) mostra o local, o endereço, as instruções, o
    contato e um link "Abrir no mapa". Já o aviso **"Devolvida para
    ajuste"** (`#ajusteSolicitacao`) mostra o motivo enquanto a peça está
    em ajuste.
-   **Resumo dos painéis:** ganhou o cartão "Prontas para retirada" (no
    solicitante) e "Aguardando retirada" (no fabricante).

### Solicitações, Relatórios e Parceiros (solicitante)

-   **Solicitações** e "Solicitações recentes" do início mostram só as
    **em andamento**. As concluídas ficam em Relatórios.
-   **Relatórios** (`html/client/relatorios.html` + `js/relatorios.js` +
    `css/pages/relatorios.css`) substitui o antigo "Histórico";
    `historico.html` só redireciona. A página traz:
    -   todas as solicitações, com filtros de busca, status, categoria,
        parceiro e período de abertura;
    -   indicadores: total, em andamento, concluídas e tempo médio até
        concluir;
    -   dois gráficos de barras (por etapa e por parceiro; clicar numa
        barra filtra a tabela);
    -   a tabela com conclusão e dias;
    -   o botão **Exportar CSV** (`;` e BOM, abre direto no Excel).
-   **Parceiros de manufatura** (`html/client/parceiros.html`, refeita):
    -   filtros de busca e tecnologia e as opções "com impressora livre
        agora" e "com material para doação";
    -   cartões com impressoras livres/total, tecnologias, material para
        doação e quantas solicitações o parceiro concluiu para vocês;
    -   um modal com as tabelas de impressoras e de materiais, os locais
        de retirada e o contato.

### Campos com sugestões (`js/sugestoes.js`)

Todo `<input list="...">` vira um campo de texto com uma lista de
sugestões no estilo da plataforma, no lugar do `<datalist>` nativo, que no
Edge aparece como uma caixa preta e parece uma lista fechada. A ajuda
"Escolha uma sugestão ou digite outro valor." aparece abaixo do campo.
As opções continuam no `<datalist>`. O componente segue o padrão ARIA
combobox (setas, Enter, Esc). Para HTML criado depois do carregamento,
chame `window.ativarSugestoes(raiz)`, como faz o assistente de nova
solicitação.

### Materiais

`html/fabricator/materiais.html` usa o mesmo script (`js/materiais.js`,
modo `data-materiais-modo="gestao"`) para o parceiro **manter o próprio
estoque**: adicionar, editar e remover itens (material, tipo, cor,
quantidade + unidade, estoque mínimo e observações). Abaixo do estoque
mínimo o item aparece como "Estoque baixo" para a organização solicitante.

Para facilitar o acesso, a **Visão geral** do fabricante tem o cartão
"Materiais para doação", com o resumo do estoque (itens registrados, com
estoque baixo e esgotados) e os botões "+ Registrar material" e "Ver
estoque". O primeiro abre `materiais.html?novo=1`, que já mostra o
formulário de registro aberto. Com o estoque vazio, a página mostra um
convite com o botão "+ Registrar primeiro material".

------------------------------------------------------------------------

## 5B. Administração da organização

`html/admin.html` (+ `js/admin.js`, `css/pages/admin.css`) é compartilhada
pelos dois painéis, como `perfil.html`. Só aparece para quem tem vínculo
de **administrador ativo** — o item "Administração" é inserido no menu de
perfil por `prototipo.js`, e `perfil.html` mostra o botão "Administrar
organização".

**Navbar das páginas compartilhadas** (`perfil.html` e `admin.html`):
`js/navbar-painel.js` desenha a mesma navbar dos painéis (links + menu de
perfil com "Meu perfil", "Administração" e "Sair"). Escolhe o painel pela
página de origem (`/html/client/` ou `/html/fabricator/`) ou, sem
origem, pelo tipo da primeira organização ativa. O link "← Voltar ao
painel" segue a mesma escolha. Depende só de `js/api.js`.

-   cartão da organização (tipo, status, contadores de pedidos
    pendentes, membros e administradores) e seletor quando o usuário
    administra mais de uma;
-   aba **Pedidos de ingresso**: nome, e-mail, cargo, justificativa e
    data, com Aprovar / Recusar;
-   aba **Membros**: busca, papel (Administrador/Membro), "Tornar admin" /
    "Remover admin" e "Remover" — sem ações sobre o próprio usuário;
-   aba **Dados da organização** (link direto `admin.html#dados`): edita
    nome, CNPJ (com validação dos dígitos), e-mail e telefone
    institucionais e endereço (obrigatório para fabricante). O tipo não
    pode ser alterado;
-   **Remover organização** (zona de perigo): o botão só é habilitado
    depois de digitar o nome exato da organização. Se a API recusar por
    haver solicitações em andamento, a mensagem aparece na própria área.
    Se remover, o usuário sai da conta e vai para a página inicial;
-   sem permissão, mostra um aviso em vez do conteúdo.

### Cadastro (`html/cadastro.html`)

-   Organização nova de **fabricante**: além dos dados institucionais, tem o
    **endereço de retirada** (CEP, rua, número, complemento, bairro, cidade
    e UF), que é obrigatório. Para organização solicitante o bloco não
    aparece, porque ela não tem local de retirada. O CEP preenche o resto
    automaticamente (ViaCEP). Se a consulta falhar, o preenchimento é manual.
-   Antes de enviar, há a etapa **Revisão** com o resumo de tudo e os
    botões "Revisar dados" e "Criar organização" ou "Enviar solicitação".
-   Confirmação: com organização nova, o botão **"Acessar plataforma"**.
    Com ingresso em organização existente, aparece o aviso de que o acesso
    depende do admin e o link para o login.

------------------------------------------------------------------------

## 6. Componentes reutilizáveis

O projeto separa parte da estilização em componentes para evitar a
concentração de todos os estilos em um único arquivo.

Entre os componentes atualmente existentes estão:

-   barra de navegação;
-   botões;
-   formulários;
-   tabelas;
-   badges de prioridade e status;
-   modais;
-   footer;
-   controles de acessibilidade.

Essa organização permite reutilizar padrões visuais em diferentes
páginas e facilita a manutenção do front-end.

------------------------------------------------------------------------

## 7. JavaScript atual

### `acessibilidade.js`

Responsável pelos controles de acessibilidade existentes nas páginas
públicas.

Atualmente implementa:

-   aumento do tamanho da fonte;
-   redução do tamanho da fonte;
-   ativação e desativação do alto contraste;
-   armazenamento da preferência de alto contraste no `localStorage`.

### `interface.js`

Implementa comportamentos gerais da interface pública, como o botão para
retorno ao topo da página.

### `api.js`

Wrapper fino de `fetch` (`credentials: 'same-origin'`, JSON por padrão,
`FormData` quando o corpo exige multipart) usado por todos os outros
scripts para chamar a API — é o único ponto do front-end que sabe como
montar uma requisição HTTP.

### `login.js`, `cadastro.js`, `perfil.js`

Implementam as telas de autenticação e perfil conectadas à API real
(`POST /api/auth/login`, `POST /api/auth/register`, `GET`/`PATCH
/api/me`, troca de e-mail e senha etc. — ver
[`backend.md`](./backend.md)). Essas três páginas não funcionam sem um
back-end no ar: sem sessão válida, `perfil.html` redireciona para
`login.html`.

### `prototipo.js`

Apesar do nome (mantido por não valer a pena renomear o arquivo neste
estágio), este script **não simula mais dados localmente** — ele busca o
usuário autenticado, as solicitações e os parceiros na API real (`GET
/api/me`, `/api/solicitacoes`, `/api/parceiros`) e envia as alterações
(nova solicitação, edição, mudança de status, registro de linha do tempo)
de volta via `POST`/`PATCH`, usando `js/api.js`. Também implementa a
renderização das tabelas, filtros, modais, detalhes das solicitações e o
menu de perfil da área da organização solicitante.

Também concentra o que as duas páginas de detalhe compartilham:
- o fluxo de etapas (`etapasDe`) e a faixa "Próxima etapa"
  (`renderBarraEtapa`);
- os cartões de produção e de retirada;
- as ações do solicitante (aprovar e devolver para ajuste);
- o modal de ação reutilizável (`abrirModalAcao`);
- o visualizador 3D;
- a página Parceiros.

### `relatorios.js`

Página Relatórios do solicitante (seção 5.5).

### `sugestoes.js`

Campo de texto com sugestões no lugar do `<datalist>` nativo (seção 5A).

### `navbar-painel.js`

Navbar das páginas compartilhadas pelos dois painéis (`perfil.html` e
`admin.html`).

### `visualizador-3d.js`

Visualizador 3D (three.js, módulo ES carregado sob demanda).

### `nova-solicitacao.js`

Assistente "Nova solicitação" em 4 etapas (ver seção 5.2.1). Gera o
próprio HTML do modal, valida etapa a etapa e envia um único
`POST /api/solicitacoes` (JSON, ou `multipart/form-data` quando há
arquivo 3D).

### `materiais.js`

Materiais para doação: consulta (solicitante) e gestão do estoque (fabricante),
conforme `data-materiais-modo` no `<body>`. Ver seções 5.6 e 5A.

### `impressoras.js`

Registro das impressoras do fabricante (ver seção 5A).

### `admin.js`

Administração da organização: pedidos de ingresso, membros e dados da
organização (com a lista de endereços de retirada, só para fabricante).
Ver seção 5B.

### `fabricator.js`

Equivalente a `prototipo.js` para a área do fabricante (`html/fabricator/`):
- a fila global e as demandas;
- os modais de ação: Aceitar, Devolver à fila, **Iniciar produção**
  (impressora e origem do material), **Confirmar recebimento do
  material** e **Concluir produção** (local de retirada e quantidade de
  material doado usada, com baixa no estoque).

Cada ação chama a sua rota `POST /api/solicitacoes/{protocolo}/...`; o
status nunca muda pelo `PATCH`.

### `filtros.js`

Motor de filtros avançados por coluna (texto e data, com modos como
"contém", "igual", "entre"), reutilizado pelas tabelas de solicitações e
de demandas.

------------------------------------------------------------------------

## 8. Acessibilidade

O front-end já possui iniciativas voltadas à acessibilidade.

Entre os recursos atualmente presentes estão:

-   controles para aumento e redução da fonte;
-   modo de alto contraste;
-   atributos ARIA em elementos da interface;
-   textos alternativos em imagens;
-   navegação por teclado em determinados elementos interativos;
-   referência ao VLibras nas páginas públicas.

Esses recursos ainda poderão ser revisados e ampliados durante o
desenvolvimento e os testes da aplicação.

------------------------------------------------------------------------

## 9. Estado atual

O front-end está **completo para a integração**. Todas as telas da área
pública, do solicitante, do fabricante e da administração chamam o
contrato de API descrito em [`integracao-backend.md`](./integracao-backend.md),
e não há dados fixos no código.

Ele foi validado contra uma API simulada local, com testes automáticos de
todas as telas. O próximo passo é validar contra o back-end real
(FastAPI + MongoDB Atlas), conferindo o
[checklist de entrega](./integracao-backend.md). As telas só funcionam com
um servidor respondendo a esse contrato na **mesma origem** (seção 7 de
`integracao-backend.md`).

## 10. Próximos passos sugeridos

-   **Mapa do local de retirada:** hoje o cartão de retirada tem o link
    "Abrir no mapa" (Google Maps). Um mapa embutido pode vir depois.
-   **Notificações:** os avisos de cada etapa (aceite, material a
    entregar, peça pronta) aparecem no histórico e na faixa "Próxima
    etapa". Enviá-los por e-mail é uma evolução natural no back-end.
-   **Relatórios do fabricante:** a versão atual de Relatórios é do
    solicitante.

------------------------------------------------------------------------

## 11. Observações

Esta documentação representa o estado do front-end no estágio atual de
desenvolvimento do LABIELOS e deverá ser atualizada conforme novas
páginas, componentes e funcionalidades forem implementados.

As informações presentes no protótipo, principalmente usuários,
solicitações, parceiros, históricos e demais dados utilizados pelo
JavaScript, possuem finalidade de demonstração e validação da interface.
