# Documentação do Front-end --- LABIELOS

## 1. Objetivo

Este documento descreve o estado atual do front-end do **LABIELOS**,
apresentando sua organização, páginas, componentes visuais, recursos de
acessibilidade e funcionalidades já representadas no protótipo.

A documentação considera somente o que existe atualmente no front-end.
Funcionalidades de back-end, banco de dados, autenticação real e
integrações futuras não são tratadas como recursos concluídos.

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
│   ├── client/
│   ├── prod/
│   ├── contato.html
│   └── login.html
├── js/
│   ├── acessibilidade.js
│   ├── interface.js
│   └── prototipo.js
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
-   barra de navegação;
-   tabelas.

Em `css/pages/` encontram-se estilos específicos das diferentes páginas
e áreas da aplicação.

### `html/`

Contém as páginas complementares da aplicação.

A pasta `client/` representa atualmente o protótipo da área autenticada
utilizada pela AACD.

A pasta `prod/` contém uma versão da página inicial utilizada durante o
desenvolvimento.

### `js/`

Contém os scripts responsáveis pelas interações atualmente existentes na
interface.

------------------------------------------------------------------------

## 4. Área pública

### 4.1 Página inicial

O arquivo `index.html` representa a página pública inicial do LABIELOS.

Atualmente a página apresenta:

-   identidade visual do LABIELOS;
-   apresentação resumida da plataforma;
-   seção sobre o projeto;
-   explicação do fluxo da plataforma;
-   informações relacionadas à privacidade e segurança;
-   navegação para a página de login;
-   recursos de acessibilidade.

A página apresenta o LABIELOS como um hub digital destinado a conectar a
AACD aos parceiros responsáveis pela manufatura aditiva, centralizando
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

## 5. Área autenticada --- protótipo da AACD

A pasta `html/client/` contém a área atualmente desenvolvida para
representar a utilização da plataforma pela AACD.

As informações exibidas nessa área ainda utilizam dados simulados no
arquivo `js/prototipo.js`. Portanto, seu comportamento atual serve para
demonstrar e validar a interface e os fluxos previstos, não
representando ainda uma integração com banco de dados ou back-end.

### 5.1 Dashboard

O arquivo `html/client/index.html` apresenta o painel inicial.

Atualmente são representados:

-   identificação do usuário e da organização;
-   resumo das solicitações;
-   quantidade de solicitações abertas;
-   solicitações em análise;
-   solicitações em produção;
-   solicitações concluídas;
-   tabela de solicitações recentes;
-   acesso à criação de uma nova solicitação.

### 5.2 Solicitações

A página `html/client/solicitacoes.html` apresenta a listagem das
solicitações.

O protótipo possui recursos de filtragem e acesso aos detalhes das
solicitações existentes.

Também existe uma interface para cadastro de nova solicitação, contendo
informações como:

-   nome da solicitação;
-   requerente;
-   instituições atribuídas;
-   prioridade;
-   categoria;
-   prazo desejado;
-   material;
-   descrição;
-   arquivo 3D.

Os formatos de arquivo apresentados no protótipo incluem STL, OBJ, 3MF,
STEP/STP e IGES/IGS.

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
-   visualização das informações relacionadas ao anexo.

### 5.4 Parceiros

A página `html/client/parceiros.html` representa a consulta aos
parceiros de manufatura cadastrados na plataforma.

No protótipo atual são exibidos dados simulados, como:

-   nome da instituição;
-   localização;
-   disponibilidade;
-   quantidade de impressoras;
-   tecnologias disponíveis;
-   materiais suportados;
-   quantidade de itens em produção.

### 5.5 Histórico

A página `html/client/historico.html` representa o histórico das
solicitações e suas alterações ao longo do processo.

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

### `prototipo.js`

Este arquivo é utilizado para simular o funcionamento da área
autenticada durante o desenvolvimento do front-end.

Ele contém dados temporários de:

-   usuário autenticado;
-   solicitações;
-   parceiros;
-   histórico das solicitações.

Também implementa comportamentos do protótipo, como renderização das
tabelas, filtros, modais, detalhes das solicitações, menu de perfil e
interações entre as páginas.

**Importante:** o conteúdo desse arquivo não deve ser interpretado como
a implementação definitiva da lógica da aplicação. O JavaScript da
aplicação será reestruturado posteriormente conforme forem desenvolvidos
o back-end, o banco de dados e as regras definitivas do sistema.

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

O front-end encontra-se **em desenvolvimento**.

Já existe uma base visual significativa para a área pública e para a
experiência da AACD, permitindo demonstrar o funcionamento esperado da
plataforma e validar os principais fluxos de interface.

Entretanto, algumas funcionalidades ainda são apenas representações de
protótipo. Não existe, nesta etapa, integração definitiva entre a
interface, autenticação, back-end e banco de dados.

------------------------------------------------------------------------

## 10. Desenvolvimentos planejados

Entre os próximos desenvolvimentos previstos para o front-end estão:

### Área dos parceiros / FabLabs

Será desenvolvida uma interface específica para os parceiros
responsáveis pela produção das próteses.

Essa área deverá permitir que os produtores interajam com as
solicitações encaminhadas pela AACD e acompanhem as etapas relacionadas
à produção.

Também está prevista a utilização do endereço cadastrado pelo parceiro
para apresentar à AACD o **ponto de retirada da prótese em um mapa**. A
implementação técnica desse recurso ainda será definida durante o
desenvolvimento.

### Cadastro de usuários

Será desenvolvida uma tela de cadastro, complementando a página de login
já existente.

Os campos e regras definitivas dependerão da definição dos tipos de
usuários e da estrutura de autenticação da aplicação.

### JavaScript definitivo

O arquivo `prototipo.js` atualmente utilizado será substituído ou
reestruturado.

A lógica definitiva deverá ser desenvolvida de acordo com a arquitetura
futura do sistema, removendo a dependência de dados simulados e
integrando a interface às informações reais fornecidas pela aplicação.

### Integrações futuras

Com a evolução do projeto, o front-end deverá ser integrado ao back-end
e ao banco de dados. Essas integrações serão documentadas separadamente
quando suas tecnologias, estruturas e regras estiverem definidas.

------------------------------------------------------------------------

## 11. Observações

Esta documentação representa o estado do front-end no estágio atual de
desenvolvimento do LABIELOS e deverá ser atualizada conforme novas
páginas, componentes e funcionalidades forem implementados.

As informações presentes no protótipo, principalmente usuários,
solicitações, parceiros, históricos e demais dados utilizados pelo
JavaScript, possuem finalidade de demonstração e validação da interface.
