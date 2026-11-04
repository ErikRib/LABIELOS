# LABIELOS

O **LABIELOS** é uma plataforma desenvolvida como parte de um Projeto Integrador Interdisciplinar (PI).

O projeto tem como objetivo criar um hub digital para conectar **instituições de saúde e reabilitação** (organizações solicitantes) a parceiros de manufatura, como FabLabs, auxiliando no processo de solicitação, produção e acompanhamento de próteses produzidas por meio de manufatura aditiva.

> O projeto encontra-se atualmente em desenvolvimento.

## Status do projeto

Atualmente, o desenvolvimento está concentrado principalmente no **front-end da aplicação**.

Já foram desenvolvidas interfaces iniciais para:

- página pública do LABIELOS;
- autenticação;
- dashboard da organização solicitante;
- gerenciamento e acompanhamento de solicitações;
- visualização de parceiros;
- histórico de solicitações;
- nova solicitação em assistente de 4 etapas (informações, arquivo e especificações, revisão, envio);
- materiais de impressão disponíveis para doação (consulta pela organização solicitante e gestão pelo fabricante);
- administração da organização (aprovação de pedidos de ingresso e gestão de membros);
- recursos iniciais de acessibilidade.

Login, cadastro, perfil, administração, materiais e os painéis da organização solicitante/fabricante já chamam uma API real (contrato documentado em `docs/backend.md`/`docs/database.md`), mas o back-end em si ainda não foi implementado — por isso essas telas dependem de um servidor rodando para funcionar.

## Tecnologias

Atualmente o front-end utiliza:

- HTML5;
- CSS3;
- JavaScript.

Novas tecnologias serão adicionadas à documentação conforme a arquitetura da aplicação evoluir.

## Documentação

A documentação técnica do projeto está disponível no diretório [`docs/`](./docs/).

### Documentos disponíveis

- [`frontend.md`](./docs/frontend.md) — estrutura, páginas, componentes, funcionalidades e estado atual do front-end.
- [`design-system.md`](./docs/design-system.md) — Design System (Figma) aplicado ao projeto, painel do fabricante, filtros avançados e demais mudanças.
- [`integracao-backend.md`](./docs/integracao-backend.md) — **guia para a equipe do back-end**: JSON de entrada/saída de cada rota usada pelo front, mapa tela → rota e checklist.
- [`backend.md`](./docs/backend.md) — contrato de referência da API (FastAPI + MongoDB Atlas): endpoints, instalação e limitações.
- [`database.md`](./docs/database.md) — modelo de dados (coleções do MongoDB).

Novos documentos serão adicionados conforme outras partes da aplicação forem desenvolvidas.

## Estrutura

```text
LABIELOS/
├── content/
├── css/
├── docs/
├── html/
├── js/
├── index.html
└── README.md