# Backend LABIELOS — implementação inicial

> **Vai implementar o back-end?** Comece por
> [`integracao-backend.md`](./integracao-backend.md): ele tem o formato
> exato (JSON de entrada e saída) de cada rota que o front-end chama,
> o mapa tela → rota e um checklist de entrega.

> **Nota:** a pasta `backend/` referenciada neste documento (com
> `app.py`, `requirements.txt`, `.env.example`, `approve.py` etc.) **não
> está incluída neste repositório** — este arquivo é só o contrato de
> referência (rotas, formatos de entrada/saída) para quem for implementar
> o back-end em FastAPI, não uma pasta que já existe aqui. Os nomes de
> rota e campos aqui descritos são o ponto de partida; ajuste conforme a
> implementação real avançar.

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
| POST | `/api/auth/register` | Cria conta e solicitação institucional pendente |
| POST | `/api/auth/login` | Cria sessão segura |
| POST | `/api/auth/logout` | Encerra sessão |
| GET | `/api/me` | Usuário autenticado e vínculos |
| PATCH | `/api/me` | Atualiza nome, sobrenome e telefone |
| POST / GET | `/api/me/photo` | Envia e recupera foto privada (até 2 MB) |
| POST | `/api/me/email/start` | Valida senha e envia código ao novo e-mail |
| POST | `/api/me/email/confirm` | Confirma código, atualiza e-mail, revoga sessões |
| POST | `/api/me/password` | Altera senha e revoga sessões |
| GET | `/api/organizations/{org_id}/requests` | Admin vê pedidos pendentes |
| POST | `/api/organizations/{org_id}/requests/{membership_id}` | Admin aprova/rejeita pedido (`{"approve":true}`) |
| GET | `/api/organizations/{org_id}/members` | Admin lista os membros ativos |
| PATCH | `/api/organizations/{org_id}/members/{membership_id}` | Admin altera o papel (`{"role":"admin"\|"member"}`) |
| DELETE | `/api/organizations/{org_id}/members/{membership_id}` | Admin remove o membro (revoga sessões) |
| GET | `/api/solicitacoes` | Lista as solicitações visíveis para a organização autenticada |
| GET | `/api/solicitacoes/{protocolo}` | Detalhe de uma solicitação |
| POST | `/api/solicitacoes` | Cria uma solicitação (organização solicitante) |
| PATCH | `/api/solicitacoes/{protocolo}` | Atualiza campos e/ou o status de uma solicitação |
| GET | `/api/solicitacoes/{protocolo}/historico` | Linha do tempo (eventos + registros manuais) |
| POST | `/api/solicitacoes/{protocolo}/historico` | Adiciona um registro (comentário ou anexo) à linha do tempo |
| GET | `/api/parceiros` | Lista os parceiros de manufatura credenciados |
| GET | `/api/materiais` | Materiais para doação (solicitante: de todos os parceiros; fabricante: os próprios) |
| POST | `/api/materiais` | Fabricante cadastra um material disponível para doação |
| PATCH / DELETE | `/api/materiais/{id}` | Fabricante atualiza/remove um material da própria organização |

### Solicitações, demandas, parceiros e histórico

Estas rotas substituem os dados simulados que viviam em `js/prototipo.js`
(array `solicitacoes`, `parceiros`, objeto `historicoSolicitacoes`). A
visibilidade é definida pelo back-end a partir da sessão autenticada:

- Uma organização do tipo `organizacao` (solicitante) vê, em `GET /api/solicitacoes`,
  as solicitações que ela mesma criou.
- Uma organização do tipo `fabricante` vê as solicitações em que o nome dela
  aparece em `atribuido` (equivalente ao que `demandasDoParceiro()` fazia
  localmente). O front-end não filtra mais isso no cliente — quem decide o
  que cada organização pode ver é o back-end.
- `PATCH /api/solicitacoes/{protocolo}` aceita um corpo parcial — por
  exemplo, `{"status": "Em análise"}` para as ações do fabricante
  (Aceitar/Recusar/Iniciar produção/Concluir), ou os campos editáveis da
  organização solicitante (`solicitacao`, `requerente`, `atribuido`, `prioridade`, `categoria`,
  `prazo`, `material`, `descricao`). Cada mudança de status deve gerar
  automaticamente um evento em `/historico` (como `registrarEventoDemanda`
  fazia localmente).
- O corpo de `solicitacao` (criação/edição) é JSON, exceto quando inclui um
  arquivo 3D — nesse caso, `multipart/form-data`, com o arquivo no campo
  `arquivo3d`, no mesmo espírito de `POST /api/me/photo`.
- `POST /api/solicitacoes/{protocolo}/historico` recebe `{"tipo": "Comentário"|"Anexo", "mensagem": "..."}` (ou `multipart/form-data` com um arquivo, se `tipo` for `"Anexo"`), e retorna o evento criado (com `data`, `autor` definidos pelo servidor a partir da sessão).
- Os formatos de objeto (campos de `solicitacao`, de evento do histórico, de
  parceiro) devem espelhar o que já está em `js/prototipo.js` hoje — ver
  esse arquivo como referência de schema enquanto o back-end não existe.

## Aprovação institucional

- Organização **nova**: `organizations.status=pending`, vínculo `requested_admin/pending`. **Não há promoção automática.**
- Após verificar CNPJ, identidade e autorização institucional por procedimento externo, o administrador da plataforma pode usar temporariamente `python backend/approve.py list organizations` e `python backend/approve.py approve ID_DA_ORGANIZACAO`. **O script é uma ferramenta administrativa local, não uma rota pública.**
- Organização **existente**: somente organizações `active` aparecem na busca. O usuário envia pedido `member/pending`, aprovado pelo administrador existente via endpoints autenticados. A interface administrativa já existe em `html/admin.html` (pedidos pendentes, membros, promoção/remoção de administradores) — contrato em `integracao-backend.md`, seção 6.1.
- Não existe fluxo de convite, recuperação de senha, exclusão de conta ou gerenciamento de endereços/unidades nesta versão.

## Alteração de e-mail

Defina `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` e `SMTP_STARTTLS` no `.env`. O código de seis dígitos expira em dez minutos, tem limite de cinco tentativas e intervalo mínimo de um minuto para reenvio. O backend armazena apenas HMAC do código, não o código em texto claro. Após confirmação, todas as sessões do usuário são revogadas.

Sem SMTP, a API retorna erro 503 explicando que o serviço não foi configurado. **Não existe código de confirmação fictício.**

## Segurança e limitações antes de produção

Esta entrega é um **MVP de desenvolvimento**, não um sistema pronto para dados reais de pacientes ou uso público. Antes da implantação, implementar: confirmação do e-mail no cadastro, recuperação segura de senha, rate limiting global para login/cadastro e busca, antifraude/antibot, auditoria de aprovações, controle de acesso aos painéis, política de privacidade/LGPD, verificação institucional robusta, tratamento transacional de criação de usuário e organização, revisão de CSRF com token dedicado, proteção de upload por decodificação real da imagem, observabilidade, backup e testes automatizados de integração com banco de testes.

A busca por organizações usa expressão regular escapada e retorna no máximo 15 resultados. A foto é armazenada no documento do usuário e limitada a 2 MB; futuramente recomenda-se storage privado de objetos. Nunca use dados de pacientes reais para testar.

Os painéis da organização solicitante e do fabricante (`js/prototipo.js`, `js/fabricator.js`) também já foram conectados às rotas `/api/solicitacoes`, `/api/solicitacoes/{protocolo}/historico` e `/api/parceiros` descritas acima — não usam mais dados fixos no código. A única tela que ainda mostra uma amostra estática é "Histórico" (solicitante), que depende de um endpoint agregado por organização ainda não definido no contrato.

As telas criadas depois (assistente de nova solicitação, administração da organização e materiais para doação) estão documentadas em [`integracao-backend.md`](./integracao-backend.md).
