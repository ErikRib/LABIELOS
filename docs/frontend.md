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
│   ├── client/          (inclui materiais.html)
│   ├── fabricator/      (inclui materiais.html)
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
│   ├── api.js
│   ├── login.js
│   ├── cadastro.js
│   ├── perfil.js
│   ├── prototipo.js
│   ├── nova-solicitacao.js
│   ├── materiais.js
│   ├── admin.js
│   ├── fabricator.js
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
[`backend.md`](./backend.md) — a exceção é a página "Histórico", que
ainda mostra uma amostra estática (ver seção 10 deste documento).

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
| 2. Arquivo e especificações | Descrição/especificações, arquivo 3D (clique ou arraste; STL, OBJ, 3MF, STEP/STP, IGES/IGS até 50 MB) e parceiros atribuídos — lista vinda de `GET /api/parceiros`, com cidade, materiais e disponibilidade. |
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
-   visualização das informações relacionadas ao anexo.

### 5.4 Parceiros

A página `html/client/parceiros.html` representa a consulta aos
parceiros de manufatura cadastrados na plataforma.

São exibidos dados vindos da API (`GET /api/parceiros`), como:

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

## 5A. Área do fabricante --- materiais

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

-   cartão da organização (tipo, status, contadores de pedidos
    pendentes, membros e administradores) e seletor quando o usuário
    administra mais de uma;
-   aba **Pedidos de ingresso**: nome, e-mail, cargo, justificativa e
    data, com Aprovar / Recusar;
-   aba **Membros**: busca, papel (Administrador/Membro), "Tornar admin" /
    "Remover admin" e "Remover" — sem ações sobre o próprio usuário;
-   sem permissão, mostra um aviso em vez do conteúdo.

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

A única exceção é a página "Histórico": ela ainda mostra uma amostra
estática, porque o contrato da API não tem (ainda) um endpoint agregado
por organização — ver [`design-system.md`](./design-system.md), seção 10.

### `nova-solicitacao.js`

Assistente "Nova solicitação" em 4 etapas (ver seção 5.2.1). Gera o
próprio HTML do modal, valida etapa a etapa e envia um único
`POST /api/solicitacoes` (JSON, ou `multipart/form-data` quando há
arquivo 3D).

### `materiais.js`

Materiais para doação: consulta (solicitante) e gestão do estoque (fabricante),
conforme `data-materiais-modo` no `<body>`. Ver seções 5.6 e 5A.

### `admin.js`

Administração da organização: pedidos de ingresso e membros. Ver seção 5B.

### `fabricator.js`

Equivalente a `prototipo.js` para a área autenticada do fabricante
(`html/fabricator/`): lista as demandas atribuídas ao parceiro logado
(a filtragem é feita pelo back-end, não no cliente), e as ações
Aceitar/Recusar/Iniciar produção/Concluir fazem um `PATCH
/api/solicitacoes/{protocolo}` real.

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

O front-end encontra-se **em desenvolvimento**.

Já existe uma base visual significativa para a área pública e para as
experiências da organização solicitante e do fabricante, permitindo demonstrar o
funcionamento esperado da plataforma e validar os principais fluxos de
interface.

A interface já está conectada a um contrato de API real (login, cadastro,
perfil e os dois painéis autenticados — ver
[`design-system.md`](./design-system.md), seções 8 e 10), mas o back-end
e o banco de dados em si ainda não foram implementados. Enquanto isso não
acontece, essas telas só funcionam com um servidor respondendo a esse
contrato — não dá mais para abri-las "soltas" sem back-end, como era
possível na etapa anterior do projeto.

------------------------------------------------------------------------

## 10. Desenvolvimentos planejados

Entre os próximos desenvolvimentos previstos para o front-end estão:

### Área dos parceiros / FabLabs

Uma primeira versão desta área já foi desenvolvida em `html/fabricator/`
(Visão geral, Demandas e Detalhes da demanda) — ver
[`design-system.md`](./design-system.md) para os detalhes. Essa versão é
uma base demonstrável, não o fluxo definitivo: o comportamento completo do
painel do fabricante ainda está sendo definido.

Essa área deverá continuar evoluindo para permitir que os produtores
interajam com as solicitações encaminhadas pela organização solicitante e acompanhem as
etapas relacionadas à produção.

Também está prevista a utilização do endereço cadastrado pelo parceiro
para apresentar à organização solicitante o **ponto de retirada da prótese em um mapa**. A
implementação técnica desse recurso ainda será definida durante o
desenvolvimento.

### Endpoint agregado de histórico

A página "Histórico" da organização solicitante (`html/client/historico.html`) ainda mostra
uma amostra estática porque falta definir, no contrato da API, um
endpoint que agregue os eventos de todas as solicitações de uma
organização (hoje só existe o histórico de uma solicitação específica —
ver [`backend.md`](./backend.md)).

### Integração com o back-end real

O contrato completo que o front-end espera (inclusive das telas novas) e
um checklist para a equipe do back-end estão em
[`integracao-backend.md`](./integracao-backend.md).


`js/prototipo.js` e `js/fabricator.js` já chamam a API descrita em
[`backend.md`](./backend.md)/[`database.md`](./database.md), mas só
foram testados contra um mock local — a próxima etapa é validá-los contra
a implementação real do back-end (FastAPI + MongoDB Atlas) assim que ela
existir.

------------------------------------------------------------------------

## 11. Observações

Esta documentação representa o estado do front-end no estágio atual de
desenvolvimento do LABIELOS e deverá ser atualizada conforme novas
páginas, componentes e funcionalidades forem implementados.

As informações presentes no protótipo, principalmente usuários,
solicitações, parceiros, históricos e demais dados utilizados pelo
JavaScript, possuem finalidade de demonstração e validação da interface.
