# LABIELOS

O **LABIELOS** é uma plataforma desenvolvida como parte de um Projeto Integrador Interdisciplinar (PI).

O projeto tem como objetivo criar um hub digital para conectar **instituições de saúde e reabilitação** (organizações solicitantes) a parceiros de manufatura, como FabLabs, auxiliando no processo de solicitação, produção e acompanhamento de próteses produzidas por meio de manufatura aditiva.

## Tecnologias

- **Front-end:** HTML5, CSS3 e JavaScript puro (sem frameworks).
- **Back-end:** Python com FastAPI.
- **Banco de dados:** MongoDB Atlas (não relacional), incluindo GridFS para os arquivos enviados (fotos de perfil, arquivos 3D e anexos do histórico).

Front-end e back-end rodam juntos, na mesma porta — a própria API serve os arquivos estáticos (HTML/CSS/JS).

## Funcionalidades

- Cadastro (com confirmação de e-mail por código), login, recuperação de senha e perfil (dados pessoais, foto, troca de e-mail/senha, exclusão de conta);
- Administração da organização (pedidos de ingresso, membros, dados de cadastro, endereços de retirada, remoção da organização); quem cria uma organização nova entra direto como administrador;
- Nova solicitação em assistente de etapas (informações, arquivo e especificações, revisão, envio), que entra numa fila global vista por todos os fabricantes;
- Fila global de novas solicitações para os fabricantes (o primeiro que aceitar assume a demanda), com edição da solicitação também em etapas;
- Fluxo completo de produção: impressora e origem do material (doado pelo parceiro, com baixa no estoque, ou fornecido pelo solicitante, com a etapa "Aguardando material"), conclusão com local e contato de retirada, aprovação da peça ou devolução para ajuste;
- Visualizador 3D dos arquivos anexados (STL, OBJ e 3MF, com three.js);
- Registro de impressoras e materiais de impressão disponíveis para doação (consulta pela organização solicitante e gestão pelo fabricante);
- Parceiros de manufatura (impressoras livres, materiais para doação, locais de retirada e contato) e relatórios da organização solicitante (indicadores, gráficos e exportação);
- Formulário de contato com envio de e-mail;
- Paginação em todas as listas do sistema;
- Recursos de acessibilidade.

## Documentação

A documentação técnica do projeto está no diretório [`docs/`](./docs/):

- [`backend.md`](./docs/backend.md) — arquitetura do back-end (FastAPI + MongoDB Atlas), como rodar, rotas, configuração de e-mail e decisões tomadas.
- [`database.md`](./docs/database.md) — modelo de dados (coleções, campos e índices do MongoDB).
- [`integracao-backend.md`](./docs/integracao-backend.md) — contrato entre front-end e back-end (formato de cada requisição/resposta).
- [`frontend.md`](./docs/frontend.md) — estrutura, páginas, componentes e funcionalidades do front-end.
- [`design-system.md`](./docs/design-system.md) — Design System aplicado ao projeto.
- [`uso-ia.md`](./docs/uso-ia.md) — divulgação do uso de IA generativa no desenvolvimento, por área.

## Estrutura

```text
LABIELOS/
├── backend/
├── content/
├── css/
├── docs/
├── html/
├── js/
├── index.html
└── README.md
```

## Como rodar localmente

Veja o passo a passo completo em [`docs/backend.md`](./docs/backend.md). Resumo:

```bash
cd backend
pip install -r requirements.txt
```

Configure `backend/.env` (copie `.env.example`) com a `MONGO_URI` do MongoDB Atlas, depois:

```bash
uvicorn main:app --reload
```

Acesse `http://127.0.0.1:8000/html/login.html`.
