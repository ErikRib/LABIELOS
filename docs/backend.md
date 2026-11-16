# Backend LABIELOS — implementação inicial

> **Vai implementar o back-end?** Comece por
> [`integracao-backend.md`](./integracao-backend.md): ele tem o formato
> exato (JSON de entrada e saída) de cada rota que o front-end chama,
> o mapa tela → rota e um checklist de entrega.

> ⚠️ **Este documento está desatualizado.** Ele foi escrito como
> planejamento, antes da implementação existir — inclusive dizia que a
> pasta `backend/` "não está incluída neste repositório", o que não é
> mais verdade: ela existe, está implementada e funcionando. Vários
> detalhes abaixo também não batem mais com a implementação real (ex.:
> variáveis de ambiente `MONGODB_URI`/`MONGODB_DB`/`SESSION_SECRET` vs. o
> `MONGO_URI` único usado hoje; hash de senha com Argon2 vs. bcrypt na
> implementação real). **Para a instalação e a arquitetura reais, use
> [`backend-implementacao.md`](./backend-implementacao.md)** (que aponta
> para `backend/README.md`). O resto deste arquivo pode ainda servir como
> referência histórica do contrato de rotas, mas prefira
> `integracao-backend.md` para o contrato oficial.

## Tecnologias

- Python 3.11+ e FastAPI; MongoDB Atlas com PyMongo.
- Senhas com Argon2; sessões aleatórias em cookies HttpOnly; API e frontend servidos pela **mesma origem**.
- HTML/CSS/JS sem framework. Documentação interativa em `/docs`.

## Instalação local (Windows / PowerShell)

1. No diretório raiz do projeto, crie um ambiente virtual: `py -m venv .venv`.
2. Ative: `.\.venv\Scripts\Activate.ps1` (ou use `.venv\Scripts\python.exe` diretamente).
3. Instale: `pip install -r backend/requirements.txt`.
4. Copie `backend/.env.example` para `backend/.env` e configure `MONGODB_URI`, `MONGODB_DB` e uma chave aleatória forte em `SESSION_SECRET` (32 caracteres ou mais). **Nunca envie `.env` ao GitHub.**
5. No MongoDB Atlas, crie o cluster e um usuário com permissão restrita ao banco escolhido. Configure o acesso de rede para o IP de desenvolvimento; não abra para todos os IPs em produção.
6. Execute **a partir da raiz**: `uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000`.
7. Acesse `http://127.0.0.1:8000/html/cadastro.html`, `.../html/login.html`, `.../html/perfil.html` e `.../docs`. **Não use Live Server ou Vite em outra porta para testar esta integração**, pois cookies e rotas `/api` usam a mesma origem.

Em produção, configure `COOKIE_SECURE=true`, HTTPS, `PUBLIC_BASE_URL=https://seu-dominio`, segredos no gerenciador de segredos, SMTP e regras de rede restritas. Reinicie o servidor após mudar `.env`.

## Endpoints

| Método | Caminho | Função |
|---|---|---|
| GET | `/api/organizations?q=...&tipo=...` | Busca organizações **ativas** por nome e tipo |
| POST | `/api/auth/register` | Cria conta. Organização nova: já ativa, usuário admin e sessão aberta. Organização existente: pedido pendente |
| POST | `/api/auth/login` | Cria sessão segura |
| POST | `/api/auth/logout` | Encerra sessão |
| GET | `/api/me` | Usuário autenticado e vínculos |
| PATCH | `/api/me` | Atualiza nome, sobrenome e telefone |
| POST / GET | `/api/me/photo` | Envia e recupera foto privada (até 2 MB) |
| POST | `/api/me/email/start` | Valida senha e envia código ao novo e-mail |
| POST | `/api/me/email/confirm` | Confirma código, atualiza e-mail, revoga sessões |
| POST | `/api/me/password` | Altera senha e revoga sessões |
| GET / PATCH | `/api/organizations/{org_id}` | Admin vê/edita os dados de cadastro (nome, CNPJ, contato e, se fabricante, a lista `enderecos`) |
| GET | `/api/organizacao/enderecos` | Endereços de retirada da organização ativa (qualquer membro; usado nos modais do fabricante) |
| DELETE | `/api/organizations/{org_id}` | Admin remove a organização (`409` se houver solicitações/demandas em andamento) |
| GET | `/api/organizations/{org_id}/requests` | Admin vê pedidos pendentes |
| POST | `/api/organizations/{org_id}/requests/{membership_id}` | Admin aprova/rejeita pedido (`{"approve":true}`) |
| GET | `/api/organizations/{org_id}/members` | Admin lista os membros ativos |
| PATCH | `/api/organizations/{org_id}/members/{membership_id}` | Admin altera o papel (`{"role":"admin"\|"member"}`) |
| DELETE | `/api/organizations/{org_id}/members/{membership_id}` | Admin remove o membro (revoga sessões) |
| GET | `/api/solicitacoes` | Solicitante: as que criou. Fabricante: as que aceitou (demandas) |
| GET | `/api/fila` | Fila global: solicitações `Aberta` ainda sem fabricante (só fabricantes) |
| POST | `/api/solicitacoes/{protocolo}/aceitar` | Fabricante assume a solicitação da fila (atômico; `409` se outro aceitou antes) |
| POST | `/api/solicitacoes/{protocolo}/devolver` | Fabricante devolve à fila uma demanda ainda `Em análise` |
| POST | `/api/solicitacoes/{protocolo}/iniciar-producao` | Fabricante escolhe impressora e origem do material → `Em produção` (doado) ou `Aguardando material` (do solicitante) |
| POST | `/api/solicitacoes/{protocolo}/material-recebido` | Fabricante confirma que recebeu o material do solicitante → `Em produção` |
| POST | `/api/solicitacoes/{protocolo}/concluir-producao` | Fabricante informa local de retirada (e quantidade de material doado usada, com baixa no estoque) → `Pronta para retirada` |
| POST | `/api/solicitacoes/{protocolo}/aprovar` | Solicitante aprova a peça → `Concluída` |
| POST | `/api/solicitacoes/{protocolo}/reprovar` | Solicitante devolve para ajuste com motivo → `Em produção` |
| GET | `/api/solicitacoes/{protocolo}` | Detalhe de uma solicitação |
| GET | `/api/solicitacoes/{protocolo}/arquivo3d` | Download do arquivo 3D anexado (bytes) |
| POST | `/api/solicitacoes` | Cria uma solicitação (organização solicitante) |
| PATCH | `/api/solicitacoes/{protocolo}` | Solicitante edita os campos da solicitação (não altera status) |
| GET | `/api/solicitacoes/{protocolo}/historico` | Linha do tempo (eventos + registros manuais) |
| POST | `/api/solicitacoes/{protocolo}/historico` | Adiciona um registro (comentário ou anexo) à linha do tempo |
| GET | `/api/parceiros` | Parceiros de manufatura com disponibilidade, impressoras, materiais para doação, locais e contato (tudo calculado) |
| GET | `/api/materiais` | Materiais para doação (solicitante: de todos os parceiros; fabricante: os próprios) |
| POST | `/api/materiais` | Fabricante cadastra um material disponível para doação |
| PATCH / DELETE | `/api/materiais/{id}` | Fabricante atualiza/remove um material da própria organização |
| GET / POST | `/api/impressoras` | Fabricante lista/registra impressoras da própria organização |
| PATCH / DELETE | `/api/impressoras/{id}` | Fabricante atualiza/remove uma impressora da própria organização |

### Solicitações, demandas, parceiros e histórico

Estas rotas substituem os dados simulados que viviam em `js/prototipo.js`
(array `solicitacoes`, `parceiros`, objeto `historicoSolicitacoes`). A
visibilidade é definida pelo back-end a partir da sessão autenticada:

- Uma organização do tipo `organizacao` vê, em `GET /api/solicitacoes`,
  as solicitações que ela mesma criou. Ela **não escolhe parceiro**: toda
  solicitação nova entra na fila global (`status="Aberta"`, sem fabricante).
- Todo fabricante ativo vê a fila em `GET /api/fila`. O primeiro que chamar
  `POST /api/solicitacoes/{protocolo}/aceitar` assume a solicitação, e ela
  passa a aparecer só em `GET /api/solicitacoes` desse fabricante. Detalhes
  e esboço da operação atômica em `integracao-backend.md`, seção 5.
- **Status só muda pelas rotas de ação** (`aceitar`, `devolver`,
  `iniciar-producao`, `material-recebido`, `concluir-producao`, `aprovar`,
  `reprovar`), nunca pelo `PATCH`. Cada uma confere o status atual de forma
  atômica, atualiza impressora e estoque quando for o caso e **gera o evento
  no `/historico`**. O fluxo completo, com os corpos e os erros, está em
  `integracao-backend.md`, seção 5.
- `PATCH /api/solicitacoes/{protocolo}` é só para a organização solicitante
  editar `solicitacao`, `prioridade`, `categoria`, `prazo`, `material` e
  `descricao` (gera evento `Edição`).
- O corpo de `solicitacao` (criação/edição) é JSON, exceto quando inclui um
  arquivo 3D — nesse caso, `multipart/form-data`, com o arquivo no campo
  `arquivo3d`, no mesmo espírito de `POST /api/me/photo`.
- `POST /api/solicitacoes/{protocolo}/historico` recebe `{"tipo": "Comentário"|"Anexo", "mensagem": "..."}` (ou `multipart/form-data` com um arquivo; o front manda `"Anexo"` quando há arquivo) e retorna o evento criado (com `data`, `autor` definidos pelo servidor a partir da sessão).
- Os formatos de objeto (solicitação, evento, parceiro, impressora,
  material) estão em `integracao-backend.md`; o que é **guardado** no
  MongoDB está em [`database.md`](./database.md).

## Aprovação institucional

- **Organização nova:** quem cadastra entra **na hora**. A organização é criada já `active`, o vínculo do usuário nasce `admin/active` e a API abre a sessão na própria resposta do cadastro (`acesso_liberado: true`). Não há verificação manual nem script de aprovação. Recomenda-se validar o CNPJ, impedir CNPJ repetido e registrar quem criou cada organização.
- **Organização existente:** só organizações `active` aparecem na busca. O usuário envia o pedido `member/pending`, e um administrador da organização aprova ou recusa em `html/admin.html` (rotas `/api/organizations/{org_id}/requests`). Até lá, o login é recusado com `403`.
- Não existe fluxo de convite, recuperação de senha ou exclusão de conta nesta versão. Os endereços de retirada do fabricante são gerenciados pelo admin em Administração → Dados da organização.

## Alteração de e-mail

Defina `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` e `SMTP_STARTTLS` no `.env`. O código de seis dígitos expira em dez minutos, tem limite de cinco tentativas e intervalo mínimo de um minuto para reenvio. O backend armazena apenas HMAC do código, não o código em texto claro. Após confirmação, todas as sessões do usuário são revogadas.

Sem SMTP, a API retorna erro 503 explicando que o serviço não foi configurado. **Não existe código de confirmação fictício.**

## Segurança e limitações antes de produção

Esta entrega é um **MVP de desenvolvimento**, não um sistema pronto para dados reais de pacientes ou uso público. Antes da implantação, implementar: confirmação do e-mail no cadastro, recuperação segura de senha, rate limiting global para login/cadastro e busca, antifraude/antibot, auditoria de aprovações, controle de acesso aos painéis, política de privacidade/LGPD, verificação institucional robusta, tratamento transacional de criação de usuário e organização, revisão de CSRF com token dedicado, proteção de upload por decodificação real da imagem, observabilidade, backup e testes automatizados de integração com banco de testes.

A busca por organizações usa expressão regular escapada e retorna no máximo 15 resultados. A foto é armazenada no documento do usuário e limitada a 2 MB; futuramente recomenda-se storage privado de objetos. Nunca use dados de pacientes reais para testar.

Todas as telas autenticadas já usam as rotas acima e não têm mais dados fixos no código. Isso inclui Relatórios, que substituiu o antigo "Histórico" e usa `GET /api/solicitacoes`. O mapa completo tela → rota e o checklist de entrega estão em [`integracao-backend.md`](./integracao-backend.md).
