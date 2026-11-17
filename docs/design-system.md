# Design System e Painel do Fabricante — Documentação

## 1. Objetivo deste documento

Este documento registra, em um único lugar:

- o que o **Design System do LABIELOS** (feito no Figma, para a disciplina
  TTI2003 — Interface e Experiência do Usuário) define;
- como o front-end do projeto foi **adaptado com base nele** (não é uma
  cópia 1:1 — o Figma foi usado como referência, com algumas decisões
  de engenharia documentadas abaixo);
- o que foi **construído de novo** nesta sessão de trabalho: o painel do
  fabricante (parceiro de manufatura), o motor de filtros avançados, o
  seletor de colunas e o registro de histórico estilo "chamado" (GLPI);
- os **ajustes de acessibilidade/HTML semântico** e as **correções de bugs**
  encontradas no caminho;
- o que **ainda não foi feito** e fica para as próximas etapas.

Esta documentação complementa, e não substitui, [`frontend.md`](./frontend.md)
(que descreve a estrutura geral do front-end) e o `README.md` do projeto.

---

## 2. O Design System (Figma) — resumo do que foi definido

Arquivo Figma: **"Design System LABIELOS"**, protótipo público, organizado em
7 quadros: Capa, 01 Fundamentos Visuais (Cores + Tipografia), 02 Inventário
de Signos, 03 Componentes, 04 Telas do Protótipo, 05 Microinterações, 06
Referências.

### 2.1 Paleta de cores

| Token | Hex | Uso definido no Figma |
|---|---|---|
| Primária | `#0B2740` | Cabeçalhos, navegação e ações de destaque |
| Secundária | `#174C68` | Apoio visual e ações operacionais |
| Neutra | `#EDF6F8` | Fundos e áreas de suporte |
| Sucesso | `#2E9A7B` | Confirmação e operação concluída |
| Erro | `#C94B4B` | Falha ou correção necessária |
| Alerta | `#C5BA27` | Aviso e atenção |
| "Gestalt" azul médio | `#3B82A0` | Acento usado nos cartões de contraste do protótipo (não é um token "oficial" da paleta principal) |

O Figma também documenta razões de contraste (WCAG 2.2) para cada cor contra
fundo branco. O ponto mais importante: **`#3B82A0` falha o contraste mínimo
de texto normal (4,30:1 < 4,5:1)** — só é seguro para texto grande ou para
componentes de interface (bordas, ícones, indicadores de foco), nunca como
fundo de texto pequeno em branco.

### 2.2 Tipografia

O Figma define **uma única família tipográfica: Inter** (Regular para corpo
e legendas, Semi Bold para títulos e destaques). Uma escala de tamanhos é
dada para desktop e mobile (Headline 1–4, Body 1–3, tamanhos de botão e de
campo).

### 2.3 Espaçamento / raio de borda

**Não documentado no Figma.** Não há uma escala de espaçamento ou um valor
de `border-radius` especificado no arquivo — por isso o projeto manteve os
valores que já tinha (`--borda-radius: 12px`).

### 2.4 Componentes

O Figma mostra uma matriz de estados de **botões** (Default/Hover/Disabled/
Click, em Desktop e Mobile) e de **campos de formulário** (Default/Hover/
Focus/Typing/Loading/Warning/Error/Success/Disabled), mas **sem os valores
hexadecimais exatos de cada estado** — só a aparência visual. Por isso, os
estados de hover/active dos botões neste projeto foram implementados com
`color-mix()` a partir dos tokens oficiais (ver seção 3.2), em vez de tentar
adivinhar um hex que o Figma nunca declarou.

A tela de exemplo do protótipo ("Tela 1") mostra como os tokens se combinam
em uma aplicação real (navbar, hero escuro, cartões, tabela com badges de
status, rodapé) — foi usada como referência para os ajustes nas páginas da
organização solicitante.

---

## 3. Como o Design System foi aplicado ao código

### 3.1 Decisão importante: "baseado em", não "idêntico a"

Conforme combinado, o projeto **não precisa ser pixel-perfect ao Figma**.
As decisões abaixo privilegiaram consistência visual, acessibilidade e o
código que já existia, usando o Figma como fonte de verdade sempre que ele
era explícito (cores, família tipográfica) e usando bom senso de
desenvolvimento onde o Figma deixava lacunas (estados de botão, espaçamento).

### 3.2 Tokens de cor (`css/style.css`)

```css
--cor-primaria: #0B2740;     /* era #102A43 */
--cor-secundaria: #174C68;   /* era #7CC4DA — o papel de "cor secundária"
                                 mudou de "destaque claro" para o tom
                                 escuro definido no Figma */
--cor-acento: #3B82A0;       /* novo: o "Gestalt azul médio" do Figma,
                                 usado só em hover/foco/bordas — nunca
                                 como fundo de texto pequeno branco */

--cor-fundo-secundario: #EDF6F8;  /* era #f5f7f9 — token "Neutra" do Figma */

--cor-sucesso / --cor-erro / --cor-alerta (+ *-fundo e *-texto)
    /* tokens novos, usados pelos badges de prioridade/status/parceiro */

--fonte-titulo / --fonte-texto: "Inter", sans-serif;
    /* antes, os títulos usavam "Plus Jakarta Sans" — trocado para Inter
       em todas as páginas (ver observação abaixo) */
```

> **Observação para revisão com a professora:** o Figma define Inter como
> família única. O projeto antes usava Plus Jakarta Sans nos títulos. Essa
> troca foi feita para seguir o Design System à risca nesse ponto — se a
> intenção for manter as duas fontes, é só reverter `--fonte-titulo` em
> `css/style.css` e os links do Google Fonts nas páginas HTML.

Como consequência de `--cor-secundaria` ter mudado de um tom claro para um
tom escuro, todo lugar que usava essa variável como "destaque claro" (hover
de botão flutuante, sublinhado de link ativo, contorno de foco, barra de
rolagem) foi revisado e trocado para `--cor-acento` (o novo azul Gestalt),
que mantém contraste visível sem reintroduzir uma cor fora da paleta.

### 3.3 Badges (`css/components/badges.css`)

As cores fixas que existiam (hex "soltos", sem relação com nenhuma paleta)
foram trocadas pelos tokens semânticos (sucesso/erro/alerta), e os nomes de
classe de status foram corrigidos (ver seção 5.1 — bug encontrado).

### 3.4 Botões (`css/components/buttons.css`)

- **Primário**: fundo `--cor-primaria` (ação de destaque, como o Figma
  define), hover `--cor-secundaria` (contraste 9,25:1 confirmado no
  próprio Figma), active mais escuro via `color-mix()`, disabled em tom
  neutro.
- **Secundário**: borda/texto `--cor-secundaria` ("apoio visual e ações
  operacionais"), preenche com a mesma cor no hover.

### 3.5 O que ficou igual de propósito

- `--borda-radius: 12px` e a escala de espaçamento existente — o Figma não
  dá motivo para mudar.
- Grande parte do layout das páginas públicas (home, login, cadastro) —
  já estava bem construído; só as cores/fontes/sombras foram realinhadas.

---

## 4. Painel do Fabricante (novo)

A organização solicitante já tinha um painel completo (`html/client/`). O fabricante (parceiro
de manufatura) ainda não tinha uma área própria terminada — esta sessão
construiu uma base completa para ele em `html/fabricator/`, reaproveitando
ao máximo os componentes e os dados simulados já existentes em
`js/prototipo.js` (a mesma lista de `solicitacoes`, por exemplo, aparece
nos dois painéis, de dois pontos de vista diferentes).

> `html/prod/index.html` — um rascunho antigo de estrutura para essa tela —
> foi removido pelo aluno durante esta sessão, já que o painel do
> fabricante novo o torna desnecessário.

| Página | Arquivo | O que mostra |
|---|---|---|
| Visão geral | `html/fabricator/index.html` | Resumo (Aguardando aceite / Em análise / Em produção / Concluídas), demandas recentes e card de capacidade produtiva |
| Demandas | `html/fabricator/demandas.html` | Lista completa, com filtros avançados e colunas configuráveis |
| Detalhes da demanda | `html/fabricator/detalhe-demanda.html` | Fluxo de status, linha do tempo completa e ações de status |

### 4.1 Fluxo de status simulado

```
Aguardando aceite ──Aceitar──▶ Em análise ──Iniciar produção──▶ Em produção ──Concluir──▶ Concluída
        │
        └──Recusar──▶ Recusada
```

Cada ação (`js/fabricator.js`, função `aplicarAcaoDemanda`) faz um `PATCH`
em `/api/solicitacoes/{protocolo}` com o novo status; é o back-end quem
registra o evento correspondente na linha do tempo dessa solicitação (ver
seção 10). Por isso, uma ação tomada no painel do fabricante aparece
também no histórico que a organização solicitante vê — é a mesma solicitação, no mesmo
back-end, não mais um objeto local compartilhado entre os dois arquivos.

Uma terceira solicitação simulada (`#0003`, "Prótese de mão transradial",
status inicial "Aguardando aceite") foi adicionada para que o fluxo de
aceite/recusa tivesse algo para demonstrar.

### 4.2 Linha do tempo com registro manual (estilo GLPI)

Na página de detalhes (tanto da organização solicitante quanto do fabricante), a linha do
tempo agora tem um formulário **"Adicionar registro"**: tipo (Comentário ou
Anexo), mensagem e arquivo opcional. Ao enviar, um novo evento é adicionado
ao topo do histórico, assinado automaticamente por quem está "logado" na
página (`autorAtual()`, em `js/prototipo.js`). É a mesma ideia de um sistema
de chamados: cada atualização vira um novo registro, sem apagar os
anteriores.

### 4.3 Dados vindos da API

Quando esta seção foi escrita, `js/prototipo.js` e `js/fabricator.js`
ainda guardavam os dados em memória (reiniciando a cada recarregamento da
página). Isso **não é mais o caso**: os dois arquivos foram conectados à
API real nesta mesma sessão — ver seção 10 para os detalhes dessa
conversão.

---

## 5. Filtros avançados e colunas configuráveis

### 5.1 Bug encontrado e corrigido: badges de status "sem cor"

Antes desta sessão, os badges de **status** (coluna "Status" nas tabelas de
solicitações) não apareciam coloridos — só o texto puro, sem o fundo do
badge. Causa: a função `badgeClass()` transforma "Em produção" em
`em-producao`, mas a classe CSS esperada era `.status-producao` (faltava o
`em-`). O mesmo valia para "Em análise". Corrigido renomeando as classes CSS
para `.status-em-producao` e `.status-em-analise`.

### 5.2 Motor de filtros (`js/filtros.js`)

Cada coluna filtrável declara um **tipo** (`texto` ou `data`). O campo de
filtro funciona como uma caixa de texto normal — digitar já filtra, usando
o modo padrão da coluna (Contém, para texto; Igual a, para data). Um botão
com um ícone (▾), embutido no próprio campo, abre um menu pequeno para
trocar o modo:

- **Texto**: Contém / Igual a / Diferente de.
- **Data**: Igual a / Diferente de / Entre (mostra um segundo campo de
  data só quando "Entre" está selecionado).

A interação foi inspirada no filtro do **Deep Freeze Cloud** (Faronics): o
ícone é só um atalho — quem só quer digitar e filtrar não precisa nem
reparar que ele existe.

Esse motor é usado em dois lugares:

- `html/client/solicitacoes.html` (solicitante) — colunas fixas (Protocolo,
  Solicitação, Requerente, Atribuído, Prioridade, Status), todas do tipo
  texto.
- `html/fabricator/demandas.html` (fabricante) — colunas fixas mais colunas
  opcionais do tipo data (Abertura, Prazo), que só aparecem quando
  marcadas no seletor de colunas (ver 5.3). É aí que o modo "Entre" entra
  em ação de verdade, filtrando um intervalo de datas.

### 5.3 Seletor de colunas (só na página Demandas do fabricante)

Um botão **"Colunas"** abre um painel com checkboxes — Protocolo, Demanda e
Status são fixas (não podem ser escondidas); as demais (Requerente,
Categoria, Material, Prioridade, Abertura, Prazo) podem ser ligadas ou
desligadas. A escolha é salva no `localStorage` do navegador
(`labielosFabricanteColunas`), então persiste entre visitas naquele
computador.

---

## 6. HTML semântico e acessibilidade

A pedido explícito, o HTML foi revisado em busca de `<div>`s genéricas que
tinham um equivalente semântico mais correto. O projeto já estava bem
cuidado nesse aspecto (header/nav/main/footer/article/aside já eram usados
corretamente); os ajustes feitos foram:

- **`index.html`**: a sequência "Como funciona" (5 passos numerados) virou
  uma lista ordenada (`<ol class="fluxo">` com `<li class="etapa">`) em vez
  de `<div>`/`<article>` soltos — é uma sequência real, não um grupo de
  cartões independentes.
- **`html/client/historico.html`**: os "chips" de categoria de evento
  viraram uma lista (`<ul class="historico-resumo">` / `<li
  class="historico-chip">`).
- **`html/login.html`**: o botão "Criar conta" (que só navegava para
  `cadastro.html` via `onclick`) virou um link de verdade (`<a href=...>`),
  para funcionar com "abrir em nova aba", leitores de tela e crawlers.
- **`html/cadastro.html`**: as três etapas do cadastro tinham o mesmo `id`
  duplicado no `<h1>` (`titulo-cadastro`), quebrando o `aria-labelledby`
  das etapas 2 e 3. Corrigido com ids únicos (`titulo-cadastro-1/-2/-3`).
- **Modais e cartões** (`modal-cabecalho`, `modal-acoes`, `bloco-cabecalho`):
  trocados de `<div>` para `<header>`/`<footer>`, já que estão sempre
  dentro de um `<dialog>` ou `<article>` (conteúdo de seccionamento, onde
  header/footer são válidos e mais corretos).
- **`index.html`**: removida uma tag `</script>` duplicada (erro de digitação
  pré-existente, sem relação com o Design System, encontrado durante a
  validação).

---

## 7. Mapa de arquivos alterados/criados nesta sessão

```
css/
├── style.css                      — tokens de cor/tipografia (Design System)
├── components/
│   ├── buttons.css                — estados de botão (hover/active/disabled)
│   ├── badges.css                 — cores semânticas, correção de classes
│   ├── navbar.css                 — acento em hover/foco
│   ├── modal.css                  — acento em foco
│   ├── accessibility.css          — acento em foco, alto contraste
│   ├── forms.css                  — glow de foco + correção do [hidden]
│   ├── table.css                  — filtros avançados + seletor de colunas
│   └── cards.css                  — [novo] .painel-bloco/.bloco-cabecalho/
│                                     .eyebrow/.detalhes-lista/.voltar-link,
│                                     extraído para reuso por 3 páginas
└── pages/
    ├── fabricator.css             — layout das páginas do fabricante
    ├── detalhes-solicitacao.css   — formulário de novo registro na timeline
    ├── perfil.css                 — [novo/reescrito] só o que é específico
    │                                 da página "Meu perfil"
    ├── historico.css              — lista de chips
    ├── home.css                   — lista ordenada "Como funciona"
    ├── solicitacoes.css           — limpeza (filtros migraram p/ table.css)
    ├── cadastro.css               — estilos movidos do <style> embutido
    └── contato.css, login.css     — glow de foco realinhado

html/
├── index.html                         — paleta, fontes, lista ordenada, bug de script
├── login.html                         — botão → link, fontes, conectado à API
├── cadastro.html                      — ids únicos, fontes, conectado à API,
│                                         <style> embutido removido
├── perfil.html                        — [novo/reescrito] conectado à API
├── contato.html                       — fontes
├── client/
│   ├── index.html, solicitacoes.html,
│   │   parceiros.html, historico.html — fontes, header/footer semânticos
│   └── detalhes-solicitacao.html      — formulário de novo registro, header/footer
└── fabricator/                        — index.html, demandas.html,
                                          detalhe-demanda.html

js/
├── prototipo.js   — nova solicitação #0003, filtros da organização solicitante, registro de timeline
├── fabricator.js  — toda a lógica do painel do fabricante
├── filtros.js     — motor de filtros avançados (reutilizável)
├── api.js         — [novo] wrapper de fetch para a API real
├── login.js       — [novo] login conectado à API
├── perfil.js      — [novo] perfil conectado à API
├── cadastro.js    — cadastro conectado à API (etapas 4-6: busca de
│                     organização, nova organização, confirmação)
├── acessibilidade.js, interface.js — comentários explicativos

docs/
├── design-system.md   — este arquivo
└── backend.md, database.md — contrato de referência da API (FastAPI +
                                MongoDB Atlas, confirmado como a stack
                                real do back-end — ver seção 11)
```

---

## 8. Login, cadastro e perfil "de verdade" (conectados a uma API)

As telas **Login** (`html/login.html`), **Cadastro** (`html/cadastro.html`)
e **Meu perfil** (`html/perfil.html`) foram as primeiras a deixar de usar
dados simulados: foram conectadas a uma API real, via `js/api.js` (um
wrapper fino de `fetch`, com `credentials: 'same-origin'` e sessão por
cookie). Os painéis da organização solicitante e do fabricante seguiram o mesmo caminho logo
depois (ver seção 10) — hoje nenhuma das áreas autenticadas usa mais dados
fixos no código.

Essa integração foi desenhada em conjunto com o ChatGPT, lado a lado com
um back-end de referência em FastAPI + MongoDB Atlas (documentado em
`docs/backend.md`/`docs/database.md`). **A implementação de back-end que o
ChatGPT escreveu foi descartada** — só o front-end (HTML/CSS/JS) foi
aproveitado — mas o contrato de endpoints descrito nesses dois arquivos
ainda serve como referência do que o front-end espera (rotas, formato de
entrada/saída em JSON), e a stack real do back-end (FastAPI + MongoDB
Atlas) já foi confirmada — ver seção 11. Vale revisar esses dois arquivos
com calma antes de começar a implementação real, já que os nomes de
rota/campo podem precisar de ajuste fino.

**Importante:** diferente das telas de prototipagem (solicitante/fabricante),
estas três páginas **não funcionam sem um back-end no ar** — ao abrir
`perfil.html` sem a API rodando, a página redireciona direto para
`login.html` (é o comportamento esperado de `js/perfil.js`, não um bug).
Não dá para demonstrar essas telas "soltas" como o resto do protótipo.

### O que foi revisado/ajustado nesta rodada

- `html/perfil.html` foi **reconstruída do zero**: a versão anterior não
  reaproveitava o cabeçalho/navegação dos outros painéis (`.painel-header`
  `.painel-nav`), nem os cartões (`.painel-bloco`/`.bloco-cabecalho`), nem
  `forms.css` — por isso teve que reinventar esses estilos localmente,
  com pequenas diferenças (cores, foco, espaçamento) do resto do site.
  A nova versão reaproveita tudo isso; `css/pages/perfil.css` ficou só com
  o que é mesmo específico da página (foto de perfil, layout, etc).
- Como `.painel-bloco`/`.bloco-cabecalho`/`.eyebrow`/`.detalhes-lista`/
  `.voltar-link` agora são usados por duas páginas de detalhe diferentes
  (`detalhes-solicitacao.html`, `fabricator/detalhe-demanda.html`) **e**
  por `perfil.html`, essas classes foram extraídas para um componente
  novo, `css/components/cards.css`, em vez de ficarem presas a
  `detalhes-solicitacao.css`.
- Como a página é compartilhada pelos dois painéis, o link "← Voltar ao
  painel" é ajustado em `js/perfil.js` a partir de `document.referrer`
  (volta para `fabricator/index.html` ou `client/index.html` conforme de
  onde o usuário veio).
- Corrigido: o botão "Criar conta" do login tinha voltado a ser um
  `<button onclick="location.href=...">` (regressão da correção já feita
  nesta sessão) — voltou a ser um `<a href>`.
- Corrigido um bug de CSS que já tinha aparecido duas vezes antes nesta
  sessão: `.form-grid[hidden]` e `.cadastro-container[hidden]` precisaram
  de uma regra explícita de `display: none`, porque a classe já definia
  `display: grid`/`flex` com a mesma especificidade do `[hidden]` do
  navegador — sem isso, o formulário "Confirmar novo e-mail" aparecia
  mesmo escondido.
- `html/cadastro.html` tinha dois blocos `<style>` embutidos no
  `<head>` — movidos para `css/pages/cadastro.css`, no mesmo padrão do
  resto do arquivo.
- Alguns `alert()` de erro em `js/cadastro.js` foram trocados por
  parágrafos de status (`role="status"`), consistente com o padrão já
  usado em `login.js`/`perfil.js` para as demais mensagens.
- Confirmado (sem alterações necessárias): o link "Meu perfil" foi
  adicionado de forma consistente no menu de perfil de todas as páginas
  autenticadas (solicitante e fabricante).

---

## 10. Painéis da organização solicitante e do fabricante conectados à API

Depois do login/cadastro/perfil, os dois painéis que antes eram 100%
simulados (`js/prototipo.js` e `js/fabricator.js`) também foram conectados
à API real, usando as mesmas convenções de `js/api.js`. O arquivo
`js/prototipo.js` passou a:

- Buscar o usuário autenticado em `GET /api/me` ao carregar qualquer
  página (redireciona para o login se a sessão não for válida — essas
  páginas agora exigem estar logado, assim como `perfil.html`).
- Buscar `solicitacoes` (`GET /api/solicitacoes`) e `parceiros`
  (`GET /api/parceiros`) em vez de usar arrays fixos no código.
- Fazer `POST`/`PATCH` reais para criar e editar uma solicitação, e
  `POST .../historico` para um novo registro na linha do tempo — nenhuma
  dessas ações mexe mais em um array local, todas esperam a resposta da
  API antes de atualizar a tela.

`js/fabricator.js` foi ajustado para não filtrar mais "quais demandas são
minhas" no cliente — quem decide isso agora é o back-end (ver
`docs/backend.md`), a partir da organização autenticada. As ações
Aceitar/Recusar/Iniciar produção/Concluir viraram um único `PATCH
/api/solicitacoes/{protocolo}` com `{"status": "..."}`; o back-end é quem
registra o evento correspondente na linha do tempo.

### Duas pendências desta conversão

- **Página "Histórico" da organização solicitante** continua com uma lista estática de
  amostra — o contrato da API ainda não tem um endpoint agregado
  ("todos os eventos de todas as solicitações da organização"), só o
  histórico de uma solicitação específica. Fica para quando esse endpoint
  for definido.
- **`js/prototipo.js`/`js/fabricator.js` não puderam ser testados contra
  o back-end real** (ele ainda não existe/não foi incluído neste
  repositório). Para validar a integração ponta a ponta, foi usado um
  mock local só para esta sessão de trabalho (servindo os mesmos
  arquivos estáticos e respondendo nas rotas do contrato) — não faz parte
  do projeto, só serviu para confirmar que o front-end chama as rotas
  certas, no formato certo, e trata certo a resposta.

---

## 11. O que fica para depois

- **Páginas de Termos e Privacidade**: a página de Privacidade existe mas
  está vazia; a de Termos ainda nem foi criada — conteúdo pendente de
  definição.
- **Fluxo completo do painel do fabricante**: o que existe hoje (Visão
  geral, Demandas, Detalhes) é uma base demonstrável, não a IA final — o
  aluno ainda está definindo como esse painel deve se comportar por
  completo.
- **Valores exatos de hex por estado de botão**: o Figma não os declara;
  se a professora pedir essa precisão, vale abrir o Figma e usar o
  conta-gotas (eyedropper) diretamente nos componentes.
- **Contrato da API**: os endpoints em `docs/backend.md` foram pensados
  e já confirmados para FastAPI (não Flask, como havia sido cogitado
  antes) — ainda assim, nomes de rota e de campo podem precisar de ajuste
  fino conforme a implementação real do back-end avançar.
- **Endpoint agregado de histórico** para a página "Histórico" da organização solicitante
  (ver seção 10).

---

## 12. Rodada de novembro/2026 — assistente, administração e materiais

- **Nova solicitação em 4 etapas** (`js/nova-solicitacao.js`,
  `css/components/stepper.css`), seguindo o protótipo do Figma: stepper
  numerado (atual em `--cor-secundaria`, concluídas com ✓ em tom de
  sucesso), conteúdo em cartão claro, "Cancelar" contornado e
  "Continuar →" em `--cor-primaria`. O modal deixou de ser copiado em
  três HTMLs e passou a ser gerado pelo script.
- **Parceiros atribuídos dinâmicos**: os checkboxes da nova solicitação e
  da edição vêm de `GET /api/parceiros` (antes eram três nomes fixos).
- **Materiais para doação**: `html/client/materiais.html` (consulta) e
  `html/fabricator/materiais.html` (gestão), com badges
  `material-disponivel` / `material-estoque-baixo` / `material-esgotado`
  reaproveitando os tokens de sucesso/alerta/erro.
- **Administração da organização**: `html/admin.html`, com abas
  acessíveis (`role="tablist"`, setas do teclado) para pedidos e membros.
- **`index.html`**: novos cards, fluxo atualizado, seção "Para quem" e
  bloco de privacidade (o CSS `.privacidade` já existia sem uso).
- **Correção**: `td.celula-acoes` tinha `display:flex`, o que desalinhava
  a célula de ações das demais colunas (afetava também a tabela de
  Demandas do fabricante). O espaçamento foi movido para os botões.

Contrato de todas essas telas para o back-end:
[`integracao-backend.md`](./integracao-backend.md).

---

## 13. Rodada de novembro/2026 (2) — fila global, impressoras e cadastro direto

> Substitui o fluxo da seção 4.1: os status `Aguardando aceite` e
> `Recusada` deixaram de existir.

```
criar ──▶ Aberta (fila global) ──Aceitar (1º parceiro)──▶ Em análise ──Iniciar produção──▶ Em produção ──Concluir──▶ Concluída
                 ▲                                              │
                 └────────────── Devolver à fila ───────────────┘
```

- **Fila global** (`html/fabricator/fila.html`): a organização solicitante
  não escolhe mais parceiros. Toda solicitação nova fica visível para todos
  os fabricantes, e quem aceitar primeiro a leva para as próprias Demandas.
- **Impressoras** (`html/fabricator/impressoras.html`): mesmo padrão visual
  de Materiais, com badges `impressora-disponivel`, `-em-uso`,
  `-em-manutencao` e `-inativa`.
- **Cadastro de organização nova** entra direto na plataforma, com o
  usuário como administrador. Só o ingresso em organização existente
  passa por aprovação.
- **Fluxo da solicitação** (detalhes): a linha agora vai exatamente até a
  etapa atual (`--progresso`), em vez de 2/3 fixo.
- Navegação do fabricante: Visão geral · Novas solicitações · Demandas ·
  Impressoras · Materiais.

## 14. Rodada de novembro/2026 (3) — botões, visualizador 3D e navbar compartilhada

- **Ações em tabelas:** os botões ficam num wrapper `div.acoes-tabela`
  dentro do `td.celula-acoes`. O wrapper é flex, sem quebra de linha e com
  `gap: 6px`. A célula continua `table-cell` para não perder o alinhamento
  da linha. Os botões `.btn-acao-tabela` têm a mesma altura (32px) e não
  quebram o texto; numa tabela estreita, ela rola na horizontal
  (`.tabela-wrap`) em vez de empilhar botões.
- **Ações do topo do detalhe:** `.detalhe-acoes` é flex com `gap: 10px`.
  A ação principal usa `.btn-principal` e a secundária, como "Devolver à
  fila", usa `.btn-secundario`.
- **Botões de cabeçalho:** `.pagina-acoes .btn` usa `white-space: nowrap`,
  para que "+ Registrar impressora" e similares nunca quebrem em duas linhas.
- **Cartão de anexo:** o nome e o formato ficam em cima. Embaixo, dois botões do mesmo
  tamanho: "Visualizar 3D" (principal) e "Baixar" (secundário com fundo
  branco, porque o cartão tem fundo azulado).
- **Visualizador 3D:** o canvas fica sobre um degradê
  `--cor-fundo` → `--cor-fundo-secundario`. O modelo usa a cor
  `--cor-acento` e há uma grade de apoio. Os controles "Centralizar" e
  "Ver malha" são pílulas (`.btn-viewer`, com `aria-pressed`) no canto do
  canvas. As dimensões em mm e os triângulos aparecem abaixo. Há estilos de
  alto contraste.
- **Navbar de perfil/admin:** é a mesma navbar dos painéis
  (`js/navbar-painel.js`), no lugar do cabeçalho mínimo que só tinha
  "Sair".
- **Admin no celular:** as abas rolam na horizontal sem quebrar o texto, e
  os três contadores ficam lado a lado, em tamanho compacto.

## 15. Rodada de novembro/2026 (4) — visão geral do fabricante, botões e retirada

- **Visão geral do fabricante:** cinco cartões de resumo
  (`grid auto-fit, minmax(170px, 1fr)`). Abaixo, "Demandas recentes" ocupa
  a **largura total**, porque a tabela ficava espremida. Depois vêm
  "Capacidade produtiva" e "Seu estoque" lado a lado, com a mesma altura
  (`.painel-fabricante-cartoes`).
- **`.btn-sm`** (novo): para atalhos dentro de cartões e barras ("Ver
  todas", "+ Registrar impressora", "Ver estoque"...). Tem 7×14 px de
  padding, 0,85rem de fonte e não quebra o texto.
- **`.btn-ferramenta`** (novo): para ações utilitárias com ícone SVG
  inline ("Colunas", "Atualizar fila"). Tem borda neutra e, no hover ou
  aberto (`aria-expanded`), fundo `--cor-fundo-secundario`. Em
  `.carregando`, o ícone gira; com `prefers-reduced-motion`, não.
- **Campo com sugestões:** a seta indica a lista, que é um listbox
  branco com sombra e opção ativa em `--cor-fundo-secundario`, como os
  outros menus. A ajuda abaixo do campo deixa claro que o texto é livre.
- **Status "Pronta para retirada":** badge verde em contorno
  (`.status-pronta-para-retirada`); a "Concluída" é verde cheio.
- **Retirada:** o cartão "Retirada da peça" e a faixa de avaliação do
  solicitante usam `--cor-sucesso-fundo`, com borda `--cor-sucesso`. O
  aviso "Devolvida para ajuste" usa as cores de alerta, com borda à
  esquerda.
- **Modal de ação** (`abrirModalAcao`): o mesmo layout dos modais
  existentes, com o erro da API exibido dentro do próprio modal. As opções
  de endereço são cartões clicáveis com rádio, destacados quando
  selecionados (`:has(input:checked)`).

## 16. Rodada de novembro/2026 (5) — produção, relatórios e parceiros

- **Um botão de registro por página:** em Materiais e Impressoras, o estado
  vazio só aponta para o botão do topo ("+ Registrar …"), sem um segundo
  botão.
- **Listas (`select`):** seta própria (chevron SVG em
  `--cor-texto-secundario`) a 14 px da borda, com `padding-right: 42px`.
  Vale para todos os `.campo select`, inclusive no cadastro.
- **Filtros com busca e um filtro só** (`.filtros-busca-e-um`): o filtro
  fica encostado à direita (ex.: Prioridade na fila).
- **Badges novos:** `status-aguardando-material` (alerta), `origem-doacao`
  (sucesso) e `origem-solicitante` (info). Os badges de impressora e de
  material foram para `css/components/badges.css`.
- **Relatórios:** barras horizontais de uma série só, num único tom
  (`--cor-secundaria`), com trilho `--cor-borda`, ponta arredondada de 4 px
  e o valor escrito ao lado em cor de texto. Clicar filtra a tabela, e a
  tabela completa fica logo abaixo. Têm estilo de alto contraste.
