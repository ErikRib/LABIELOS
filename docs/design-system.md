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
AACD.

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

A AACD já tinha um painel completo (`html/client/`). O fabricante (parceiro
de manufatura) ainda não tinha uma área própria terminada — esta sessão
construiu uma base completa para ele em `html/fabricante/`, reaproveitando
ao máximo os componentes e os dados simulados já existentes em
`js/prototipo.js` (a mesma lista de `solicitacoes`, por exemplo, aparece
nos dois painéis, de dois pontos de vista diferentes).

> `html/prod/index.html` — um rascunho antigo de estrutura para essa tela —
> foi removido pelo aluno durante esta sessão, já que o painel do
> fabricante novo o torna desnecessário.

| Página | Arquivo | O que mostra |
|---|---|---|
| Visão geral | `html/fabricante/index.html` | Resumo (Aguardando aceite / Em análise / Em produção / Concluídas), demandas recentes e card de capacidade produtiva |
| Demandas | `html/fabricante/demandas.html` | Lista completa, com filtros avançados e colunas configuráveis |
| Detalhes da demanda | `html/fabricante/detalhe-demanda.html` | Fluxo de status, linha do tempo completa e ações de status |

### 4.1 Fluxo de status simulado

```
Aguardando aceite ──Aceitar──▶ Em análise ──Iniciar produção──▶ Em produção ──Concluir──▶ Concluída
        │
        └──Recusar──▶ Recusada
```

Cada ação (`js/fabricante.js`, função `aplicarAcaoDemanda`) muda o status da
solicitação e registra automaticamente um evento na linha do tempo
(`historicoSolicitacoes`, de `js/prototipo.js`) — o mesmo objeto que
alimenta a página de detalhes da AACD. Por isso, uma ação tomada no painel
do fabricante aparece também no histórico que a AACD vê.

Uma terceira solicitação simulada (`#0003`, "Prótese de mão transradial",
status inicial "Aguardando aceite") foi adicionada para que o fluxo de
aceite/recusa tivesse algo para demonstrar.

### 4.2 Linha do tempo com registro manual (estilo GLPI)

Na página de detalhes (tanto da AACD quanto do fabricante), a linha do
tempo agora tem um formulário **"Adicionar registro"**: tipo (Comentário ou
Anexo), mensagem e arquivo opcional. Ao enviar, um novo evento é adicionado
ao topo do histórico, assinado automaticamente por quem está "logado" na
página (`autorAtual()`, em `js/prototipo.js`). É a mesma ideia de um sistema
de chamados: cada atualização vira um novo registro, sem apagar os
anteriores.

### 4.3 Dados simulados (sem back-end)

Assim como o resto do protótipo, não há back-end nem banco de dados — tudo
vive em memória (`js/prototipo.js` e `js/fabricante.js`) e **reinicia a
cada recarregamento da página**. Isso é intencional nesta fase (ver
`frontend.md`), só documentando para não ser confundido com um bug.

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

- `html/client/solicitacoes.html` (AACD) — colunas fixas (Protocolo,
  Solicitação, Requerente, Atribuído, Prioridade, Status), todas do tipo
  texto.
- `html/fabricante/demandas.html` (fabricante) — colunas fixas mais colunas
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
│   ├── forms.css                  — glow de foco realinhado à paleta
│   └── table.css                  — [novo] filtros avançados + seletor de colunas
└── pages/
    ├── fabricante.css             — [novo] layout das páginas do fabricante
    ├── detalhes-solicitacao.css   — formulário de novo registro na timeline
    ├── historico.css              — lista de chips
    ├── home.css                   — lista ordenada "Como funciona"
    ├── solicitacoes.css           — limpeza (filtros migraram p/ table.css)
    └── cadastro.css, contato.css, login.css — glow de foco realinhado

html/
├── index.html                         — paleta, fontes, lista ordenada, bug de script
├── login.html                         — botão → link, fontes
├── cadastro.html                      — ids únicos, fontes
├── contato.html                       — fontes
├── client/
│   ├── index.html, solicitacoes.html,
│   │   parceiros.html, historico.html — fontes, header/footer semânticos
│   └── detalhes-solicitacao.html      — formulário de novo registro, header/footer
└── fabricante/                        — [novo] index.html, demandas.html,
                                          detalhe-demanda.html

js/
├── prototipo.js   — nova solicitação #0003, filtros da AACD, registro de timeline
├── fabricante.js  — [novo] toda a lógica do painel do fabricante
├── filtros.js     — [novo] motor de filtros avançados (reutilizável)
├── acessibilidade.js, interface.js, cadastro.js — comentários explicativos

docs/
└── design-system.md   — este arquivo
```

---

## 8. O que fica para depois (não mexido nesta sessão)

- **Cadastro — seção "Organização"** (`html/cadastro.html`, etapa 3): o
  aluno está desenhando essa parte com outra ferramenta; não foi alterada.
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
