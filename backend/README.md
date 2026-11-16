# Backend do LABIELOS — guia de implementação

Este README explica **como o back-end foi implementado de fato**: a
arquitetura de pastas, como rodar localmente, o que cada rota faz, e quais
simplificações foram feitas em relação à especificação original.

> O contrato "oficial" que o front-end espera (formato exato de cada
> request/response) está em [`docs/integracao-backend.md`](../docs/integracao-backend.md),
> na raiz do projeto. Este arquivo aqui **não substitui** aquele — ele
> explica a implementação, supondo que você já deu uma olhada lá (ou vai
> consultá-lo quando precisar do formato exato de um payload).

Se você tem pouca experiência com back-end, veja a seção
["Para quem está começando"](#para-quem-está-começando-conceitos-usados-aqui)
no fim deste documento — ela explica, em termos simples, os conceitos que
aparecem aqui (API, rota, sessão, hash de senha, etc.).

---

## 1. Visão geral da arquitetura

```
backend/
├── app.py              ← o "app" de verdade: monta tudo (rotas + estáticos)
├── main.py              ← só reexporta app.py (compatibilidade com o comando antigo)
├── database.py           ← conexão com o MongoDB e as "coleções" (tabelas)
├── security.py           ← hash de senha
├── sessions.py           ← login por cookie (sessão)
├── contexto.py            ← "a que organização este usuário pertence?"
├── deps.py               ← checagens de permissão reutilizáveis (fabricante / solicitante / admin)
├── utilitarios.py         ← funções pequenas usadas em vários lugares
├── email_util.py          ← envio de e-mail opcional (usado só na recuperação de senha)
├── models/
│   └── schemas.py         ← formato de entrada de cada rota (validação automática)
├── routes/
│   ├── auth.py            ← login, cadastro, perfil, recuperação de senha
│   ├── organizations.py    ← organizações e administração
│   ├── solicitacoes.py     ← solicitações, fila global, fluxo de produção
│   ├── materiais.py        ← materiais para doação
│   ├── impressoras.py      ← impressoras dos fabricantes
│   └── parceiros.py        ← listagem "Parceiros de manufatura"
└── uploads/               ← arquivos enviados (fotos de perfil, arquivos 3D) — criado sozinho ao rodar
```

**Ideia geral:** o front-end (pasta `html/`, `css/`, `js/` na raiz do
projeto) e o back-end (esta pasta) rodam **juntos, na mesma porta**. Quando
você abre `http://127.0.0.1:8000/html/login.html`, quem está respondendo
essa página também é o FastAPI — ele serve tanto os arquivos estáticos
(HTML/CSS/JS) quanto as rotas `/api/...`. Isso está configurado no fim de
`app.py`, com `StaticFiles`.

## 2. Como rodar localmente

1. Instale as dependências (dentro da pasta `backend/`):
   ```bash
   pip install -r requirements.txt
   ```
2. Configure o `.env` (copie `.env.example` para `.env` e preencha):
   - `MONGO_URI`: string de conexão do MongoDB (Atlas ou local). Pegue a
     connection string **direto do botão "Connect" do seu cluster no
     Atlas** (Database → Clusters → Connect → Drivers → Python), em vez de
     montar ela à mão — evita erros de host/usuário/senha. Confira também
     se o seu IP está liberado em **Network Access** e se o usuário do
     banco tem o papel `readWriteAnyDatabase@admin` (ou equivalente) em
     **Database Access**.
   - `SMTP_*` (opcional): só é necessário se você quiser que a recuperação
     de senha mande e-mail de verdade. Sem isso, o código de recuperação
     aparece na própria resposta da API (ver seção 6).
3. Crie os índices do banco (só precisa rodar uma vez por cluster; é seguro
   rodar de novo a qualquer momento):
   ```bash
   python criar_indices.py
   ```
   Isso garante, por exemplo, que não dá para cadastrar dois usuários com o
   mesmo e-mail, que sessões expiradas (30 dias) e códigos de recuperação
   de senha (10 minutos) somem sozinhos do banco, e que a busca por
   solicitação/organização seja rápida. Ver a lista completa de coleções e
   índices nos comentários de `criar_indices.py`.
4. Rode o servidor, de dentro da pasta `backend/`:
   ```bash
   uvicorn main:app --reload
   ```
   Ou, da raiz do projeto (é o que `run.py` faz):
   ```bash
   uvicorn backend.app:app --reload
   ```
5. Acesse `http://127.0.0.1:8000/html/login.html` (ou a porta que o
   terminal mostrar).

Não precisa rodar nada separado para o front-end — ele é servido pela
mesma API (ver seção 1).

### "bad auth: authentication failed" ao conectar no Atlas

Se a API não sobe (ou dá erro 500 no cadastro/login) com esse erro,
quase sempre é um destes problemas, nessa ordem de probabilidade:

1. **A senha no `.env` não é a senha atual do usuário no Atlas** — ao
   trocar a senha em Database Access, é preciso rolar até o fim do painel e
   clicar em **"Update User"**; sem isso, a senha antiga continua valendo.
2. **A senha tem caractere especial** (`@ : / % + ( ) # & ! ? espaço`) e
   não foi codificada para URL (`urllib.parse.quote_plus`) antes de entrar
   na `MONGO_URI` — mais simples: gere uma senha só com letras e números.
3. **O host da `MONGO_URI` está desatualizado** — se o cluster foi
   recriado (ou você está olhando para outro projeto/organização do
   Atlas), o endereço muda. Pegue sempre a connection string atual pelo
   botão "Connect" do cluster, nunca reaproveite uma antiga.
4. Seu IP não está liberado em **Network Access** (esse caso costuma dar um
   erro de timeout, não de autenticação, mas vale conferir).

Para testar a conexão isolada, sem precisar subir o servidor nem passar
pela tela de cadastro:
```bash
python -c "from dotenv import load_dotenv; load_dotenv(); import os; from pymongo import MongoClient; c=MongoClient(os.environ['MONGO_URI'], serverSelectionTimeoutMS=10000); print(c.admin.command('ping'))"
```
`{'ok': 1}` significa que a conexão e a autenticação estão OK.

## 3. Autenticação e sessão (como "login" funciona aqui)

Não tem JWT, nem token no `localStorage`. É sessão por **cookie HttpOnly**:

1. `POST /api/auth/login` confere e-mail/senha e, se baterem, cria um
   "token" aleatório (`secrets.token_urlsafe`), salva esse token na coleção
   `sessoes` (junto com o `user_id` e uma validade de 30 dias) e manda esse
   token para o navegador como cookie `labielos_session` — `HttpOnly`
   significa que o JavaScript do front **não consegue ler** esse cookie,
   só o navegador manda ele de volta sozinho em toda requisição.
2. Em toda rota protegida, a dependência `usuario_atual` (em
   `sessions.py`) lê o cookie, procura o token na coleção `sessoes` e
   carrega o usuário dono dela. Se não achar (ou estiver expirado), devolve
   `401` — e é por isso que o front redireciona para a tela de login quando
   isso acontece.
3. `POST /api/auth/logout`, trocar a senha e trocar o e-mail **apagam** a(s)
   sessão(ões) daquele usuário — então, depois disso, ele precisa logar de
   novo em qualquer aba aberta.

A senha nunca é guardada em texto puro: `security.py` usa **PBKDF2** (uma
função de hash lenta, da biblioteca padrão do Python) para guardar só um
hash. Mesmo quem tiver acesso direto ao banco de dados não consegue ver a
senha original.

## 4. Quem pode fazer o quê (organizações e permissões)

Um usuário se cadastra e fica vinculado a uma **organização** (uma
"organização solicitante", tipo hospital/clínica, ou um "fabricante", tipo
um FabLab). Esse vínculo (`membership`) tem um `role` (`admin` ou `member`)
e um `status` (`pending`, `active`, `rejected`); quando a organização é
removida, o vínculo é **apagado de verdade** (ver nota logo abaixo sobre
`DELETE /api/organizations/{org_id}`), não marcado como `removed`.

- `contexto.py` responde "qual é a organização ativa deste usuário"
  (olhando os vínculos com `status="active"` e organização
  `status="active"`).
- `deps.py` tem três checagens prontas para usar em qualquer rota:
  - `exigir_fabricante` — só deixa passar quem tem vínculo ativo com um
    fabricante (usado em impressoras, materiais, fila, aceitar demanda...);
  - `exigir_organizacao_solicitante` — só quem tem vínculo ativo com uma
    organização solicitante (criar solicitação, aprovar peça...);
  - `exigir_admin` — só admin ativo *daquela organização específica*
    (`{org_id}` na URL) — usado nas rotas de administração.

**Simplificação:** o projeto assume que cada usuário pertence a **uma
organização só**, mesmo o banco permitindo mais de uma. Isso bate com como
o próprio front-end se comporta (`js/api.js` → `destinoAposEntrar()` só
olha a primeira organização ativa). Se um dia o projeto precisar de
usuários em várias organizações ao mesmo tempo, esse é o primeiro lugar a
revisar.

## 5. Solicitações e o fluxo de produção

Esse é o coração do sistema — veja o diagrama grande na seção 5 de
`docs/integracao-backend.md`. Em resumo, cada solicitação tem um `status`
que muda através de rotas específicas (nunca por um `PATCH` genérico):

```
Aberta (fila) → aceitar → Em análise → iniciar-producao → Em produção (ou Aguardando material → material-recebido → Em produção)
→ concluir-producao → Pronta para retirada → aprovar → Concluída
                                            → reprovar → volta para Em produção
```

Cada mudança de status também registra um evento no `historico` da
solicitação (lista dentro do próprio documento Mongo), com data, tipo,
título, descrição e autor — é isso que aparece na aba "Histórico" da tela
de detalhes.

**Atomicidade do "aceitar":** como qualquer fabricante pode tentar aceitar
a mesma solicitação da fila ao mesmo tempo, `aceitar_solicitacao` usa
`find_one_and_update` com o status esperado **dentro do filtro** — se outro
fabricante já tiver aceitado um instante antes, a atualização não encontra
o documento e a rota devolve `409`. Isso evita que dois fabricantes
"ganhem" a mesma solicitação por uma corrida de requisições.

**Status da impressora:** a impressora escolhida em `iniciar-producao`
fica `Em uso`; ao concluir a produção, ela volta para `Disponível` — a não
ser que esteja sendo usada em *outra* demanda que ainda está `Em
produção`. Se o solicitante devolve a peça para ajuste (`reprovar`), a
impressora volta para `Em uso`.

## 6. O que foi simplificado (e por quê)

Projeto de demonstração acadêmica não precisa (nem deveria, no tempo que
havia) reproduzir tudo que um sistema em produção teria. Aqui estão as
simplificações deliberadas:

| Área | O que o doc pedia | O que foi feito | Por quê |
|---|---|---|---|
| Envio de e-mail | Confirmar troca de e-mail e recuperar senha por e-mail de verdade | Sem `SMTP_*` configurado no `.env`, o "e-mail" só é escrito no console do servidor (troca de e-mail) ou devolvido na própria resposta da API (recuperação de senha, campo `codigo`) | Não há servidor de e-mail disponível neste ambiente de desenvolvimento. Com `SMTP_*` preenchido, `email_util.py` tenta mandar de verdade (e se falhar, cai automaticamente no modo demonstração) |
| Arquivo 3D e foto de perfil | O doc sugere GridFS (Mongo) | Salvos como arquivo comum em `backend/uploads/` (subpastas `arquivos3d/` e `fotos/`), com só a referência (nome do arquivo) guardada no Mongo | Mais simples de implementar e de inspecionar manualmente; para este volume de uso, não há vantagem real em GridFS |
| E-mail (validação) | — | Validação de formato "feita à mão" (regex simples), em vez do `EmailStr` do Pydantic | O `EmailStr` usa a biblioteca `email-validator`, que **rejeita** domínios de teste como `...@algo.test` — e tanto os exemplos do doc quanto os dados de teste deste projeto usam e-mails fictícios desse tipo |
| Um usuário, uma organização | O banco permite vínculos com várias organizações | As rotas sempre usam "a primeira organização ativa" do usuário | Ver seção 4 |
| Validação de permissão do `PATCH` de solicitação para fabricante | 409 se tentar mudar status, 403 para outros campos | A rota de edição (`PATCH /api/solicitacoes/{protocolo}`) é só para a organização solicitante; um fabricante autenticado recebe 403 ao tentar chamá-la (a mensagem é um pouco mais genérica que a do doc) | Simplifica a lógica sem mudar o resultado prático: fabricante nunca edita pelo PATCH |
| Recuperação de senha | — (funcionalidade nova, pedida depois) | Código de 6 dígitos guardado na coleção `codigos_recuperacao`, válido por 10 minutos; a rota de "esqueci minha senha" sempre responde `200`, mesmo se o e-mail não existir, e nesse caso nem grava nada no banco (só devolve um código "fake") | Não revelar se um e-mail está cadastrado é uma prática básica de segurança, mesmo em um protótipo |
| Hash de senha | O doc não especifica | PBKDF2 (`hashlib` da biblioteca padrão), em vez de bcrypt/argon2 | Evita depender de uma biblioteca com componente nativo (que às vezes dá problema para compilar no Windows); para este projeto, a robustez é equivalente na prática |
| Auditoria (quem aprovou o quê, quando) | Mencionada no doc | Implementada só nos campos básicos (`approved_by`, `approved_at`) — sem um log de auditoria separado | Fora do escopo de uma demonstração acadêmica |

## 7. Mapa rápido das rotas

Todas as rotas abaixo começam em `/api`. "Quem pode chamar" resume a
checagem feita pela rota — o formato exato de cada payload está em
`docs/integracao-backend.md`.

### Autenticação e perfil (`routes/auth.py`)
| Rota | Quem pode chamar |
|---|---|
| `POST /auth/login` | qualquer um |
| `POST /auth/register` | qualquer um |
| `POST /auth/logout` | logado |
| `GET /me`, `PATCH /me` | logado |
| `DELETE /me` | logado (exclui a própria conta — ver seção 10) |
| `POST /me/photo`, `GET /me/photo` | logado |
| `POST /me/email/start`, `POST /me/email/confirm` | logado |
| `POST /me/password` | logado |
| `POST /auth/password/forgot` | qualquer um (não precisa estar logado) |
| `POST /auth/password/verify` | qualquer um |
| `POST /auth/password/reset` | qualquer um |
| `POST /auth/email/verify/start`, `POST /auth/email/verify/confirm` | qualquer um (confirmação de e-mail antes do cadastro — ver seção 10) |

### Organizações (`routes/organizations.py`)
| Rota | Quem pode chamar |
|---|---|
| `GET /organizations` | qualquer um (busca para a tela de cadastro) |
| `GET/PATCH/DELETE /organizations/{org_id}` | admin ativo daquela organização |
| `GET /organizations/{org_id}/requests` | admin |
| `POST /organizations/{org_id}/requests/{membership_id}` | admin |
| `GET /organizations/{org_id}/members` | admin |
| `PATCH/DELETE /organizations/{org_id}/members/{membership_id}` | admin |
| `GET /organizacao/enderecos` | qualquer membro ativo da própria organização |

### Solicitações (`routes/solicitacoes.py`)
| Rota | Quem pode chamar |
|---|---|
| `POST /solicitacoes` | organização solicitante |
| `GET /solicitacoes` | solicitante (as suas) ou fabricante (as que aceitou) |
| `GET /fila` | fabricante |
| `GET/PATCH /solicitacoes/{protocolo}` | dono da solicitação (GET também libera para fabricante avaliar item da fila) |
| `POST .../aceitar`, `.../devolver` | fabricante |
| `POST .../iniciar-producao`, `.../material-recebido`, `.../concluir-producao` | fabricante responsável pela demanda |
| `POST .../aprovar`, `.../reprovar` | organização solicitante dona |
| `GET/POST .../historico` | quem pode ver a solicitação |
| `GET .../arquivo3d` | quem pode ver a solicitação |

### Materiais (`routes/materiais.py`) e Impressoras (`routes/impressoras.py`)
CRUD completo, restrito ao fabricante dono do item (`GET /materiais`
também é liberado para organizações solicitantes, só para consulta).

### Parceiros (`routes/parceiros.py`)
`GET /parceiros` — qualquer usuário logado.

## 8. Testando sem o MongoDB Atlas configurado

Se você quiser rodar os testes manuais sem depender da string de conexão
do Atlas, pode trocar as coleções por um banco Mongo "falso" em memória
(`pip install mongomock-motor`) antes de importar `app`. Foi assim que o
fluxo completo (cadastro → login → solicitação → fila → produção →
conclusão → aprovação, mais a recuperação de senha) foi validado durante o
desenvolvimento. Isso é só uma ferramenta de teste manual — **não** faz
parte do código do projeto.

## 9. Passos manuais que ainda faltam

- [ ] Preencher `MONGO_URI` no `.env` com uma string de conexão válida
      (Atlas ou um MongoDB local).
- [ ] Rodar `pip install -r requirements.txt` (inclui `python-multipart`,
      necessário para upload de arquivos, que foi adicionado agora).
- [ ] Cadastrar ao menos uma organização fabricante e uma solicitante pela
      própria tela de cadastro, para ter dados de teste (não há script de
      seed/popular banco).
- [ ] Se quiser e-mail de verdade na recuperação de senha, preencher as
      variáveis `SMTP_*` no `.env` (opcional).
- [ ] Testar cada tela do front manualmente pelo navegador (ver checklist
      da seção 9 de `docs/integracao-backend.md`).

## 10. Correções feitas depois do teste manual do fluxo completo

Depois de testar cadastro → login → organização → perfil pela tela, foram
encontrados e corrigidos 4 problemas:

**1. Recadastrar com um e-mail que já tem conta.** Antes, se a organização
de alguém fosse removida (`DELETE /api/organizations/{org_id}`, que não
apaga o usuário, só os vínculos) e essa pessoa tentasse se cadastrar de
novo com o mesmo e-mail, a API recusava com "e-mail já existe" — sem dar
nenhum jeito de continuar. Agora, em `POST /api/auth/register`, se o
e-mail já existe **e a senha enviada bate com a da conta**, a rota
reaproveita essa conta (não cria um usuário duplicado) e só cria a
organização/vínculo novo. Se a senha não bater, a mensagem agora é clara:
"Este e-mail já tem uma conta. Faça login...". Isso vale tanto para
organização nova quanto para pedido de ingresso em organização existente.

**2. Excluir a própria conta.** Não existia essa opção. Agora: `DELETE
/api/me` exclui a conta do usuário logado, mas recusa (`409`) se ele for
**o único administrador ativo** de alguma organização ainda ativa (mesma
regra que já existia para remover um membro em `routes/organizations.py`)
— nesse caso, o `detail` lista as organizações afetadas. Sem esse bloqueio,
encerra os vínculos, apaga a foto de perfil (se houver) e a conta, e
revoga as sessões. No front, `html/perfil.html` ganhou uma seção "Excluir
conta" com confirmação por e-mail digitado (mesmo padrão "zona de perigo"
de `html/admin.html`).

**3. Foto de perfil só aparecia na própria tela de configurações.** A causa
raiz: o menu de perfil no cabeçalho (`js/navbar-painel.js`, usado em
`perfil.html`/`admin.html`, e a navbar estática que `js/prototipo.js`
atualiza nas demais telas) nunca lia o campo `foto` de `GET /api/me` —
sempre mostrava o ícone padrão (`/content/img/user.png`), em código, sem
depender do usuário. Corrigido nos dois lugares. De quebra, `GET /api/me`
agora devolve a URL da foto já com cache-busting (`?v=<timestamp da última
troca>`, campo novo `foto_atualizada_em` gravado a cada upload) — sem
isso, o navegador podia continuar mostrando a foto antiga em cache mesmo
depois de trocar.

**4. Confirmação de e-mail antes do cadastro.** Pedido novo: antes de
escolher organização/vínculo, o cadastro agora tem uma etapa 0 (`html/
cadastro.html`) que pede só o e-mail, manda um código de 6 dígitos (`POST
/api/auth/email/verify/start`, mesmo padrão "modo demonstração" da
recuperação de senha: sem SMTP, o código vem na resposta) e só libera o
resto do formulário depois de confirmado (`POST /api/auth/email/verify/
confirm`). O e-mail confirmado preenche sozinho (e trava, com opção de
trocar) o campo de e-mail da etapa seguinte. `POST /api/auth/register`
passou a **exigir** esse código (campo novo `verificacao_codigo`): sem ele
(ou com um código errado/expirado), devolve `422` com uma mensagem clara.
Coleção nova: `codigos_verificacao_cadastro` (TTL de 10 minutos, igual
`codigos_recuperacao`). **Esta rota não está documentada em
`docs/integracao-backend.md`** (que é o contrato "oficial" vindo de fora)
— é uma extensão feita só neste back-end.

**E-mail em HTML.** Os e-mails de recuperação de senha e de confirmação de
cadastro agora saem formatados (card branco, código em destaque com fundo
`--cor-primaria`/`#0B2740`, igual à paleta do projeto), montados em
`email_util.montar_email_codigo()`. `tentar_enviar_email()` manda
`multipart/alternative` (texto simples + HTML) — um cliente de e-mail
antigo que não entende HTML cai automaticamente para o texto simples.
Testado enviando um e-mail de verdade (SMTP do Gmail já configurado) e
validando que o HTML gerado tem todas as tags balanceadas.

Todos os 4 itens (mais o envio de e-mail) foram testados de ponta a ponta
(via `curl` direto nas rotas, e o item 4 também pelo navegador) durante o
desenvolvimento.

## 11. `DELETE /api/organizations/{org_id}` apaga de verdade (hard delete)

`docs/integracao-backend.md` (o contrato original) descreve esta rota como
um **soft delete**: a organização fica marcada `status="removed"` para
preservar o nome dela no histórico de solicitações antigas já concluídas.
A pedido do usuário, a implementação real faz **hard delete**: o documento
da organização é apagado de `organizacoes_collection`, junto com todos os
`memberships`, `materiais` e `impressoras` dela — não só marcados como
removidos.

Isso é seguro porque o nome da organização **já é salvo junto da própria
solicitação** no momento da criação (`requerente_nome`/`atribuido_nome` em
`solicitacoes_collection`, ver `solicitacao_publica()` em
`routes/solicitacoes.py`) — não é resolvido ao vivo buscando a organização.
Então uma solicitação concluída continua mostrando o nome da organização
corretamente mesmo depois dela ser apagada de vez. Testado manualmente:
criada uma organização de teste, uma solicitação marcada como concluída,
a organização removida — confirmado que ela sumiu de
`organizacoes_collection` e `memberships_collection`, e que a solicitação
antiga continuou intacta com o nome certo.

O que isso tira: se você reabrir a tela de administração de uma
organização removida (por um link salvo, por exemplo), ela realmente não
existe mais — não tem como "desfazer" a remoção.

---

## Para quem está começando: conceitos usados aqui

- **API / rota:** o back-end é um programa que fica esperando pedidos
  (requisições HTTP) em um endereço, tipo `http://127.0.0.1:8000`. Cada
  "rota" é um caminho específico (`/api/auth/login`, por exemplo) que faz
  uma coisa — aqui, com o FastAPI, cada rota é só uma função Python
  marcada com `@router.post(...)` ou `@router.get(...)`.
- **GET vs. POST vs. PATCH vs. DELETE:** são os "verbos" de uma requisição
  HTTP. Por convenção (não é uma regra do Python, é um costume da web):
  `GET` busca dado sem mudar nada, `POST` cria algo novo ou faz uma ação,
  `PATCH` atualiza só alguns campos de algo que já existe, `DELETE` remove.
- **JSON:** o formato de texto que o front e o back usam para trocar
  dados — parece um dicionário do Python (`{"email": "...", "senha": "..."}`).
- **Pydantic (`models/schemas.py`):** uma biblioteca que valida o formato
  dos dados que chegam numa rota automaticamente. Se o front mandar um
  campo faltando, ou um tipo errado, o FastAPI já devolve erro `422` antes
  mesmo da função da rota rodar.
- **Dependência (`Depends(...)`)**: uma função que o FastAPI roda *antes*
  da rota, e cujo resultado é passado para ela. Usamos isso para checar
  "o usuário está logado?" (`usuario_atual`) e "ele pode fazer isso?"
  (`exigir_fabricante`, etc.) sem repetir esse código em cada rota.
- **`async`/`await`:** o FastAPI e o driver do Mongo (`motor`) são
  assíncronos — ou seja, enquanto uma requisição está esperando o banco de
  dados responder, o servidor pode atender outras requisições ao mesmo
  tempo, em vez de ficar travado esperando. Toda função que fala com o
  banco é declarada com `async def` e usa `await` para "esperar a resposta
  sem travar tudo".
- **MongoDB / coleção / documento:** o MongoDB é um banco "não relacional":
  em vez de tabelas com colunas fixas (como no SQL), ele guarda
  "documentos" (parecidos com objetos JSON) dentro de "coleções" (o
  equivalente a uma tabela). `database.py` define as coleções usadas
  (`usuarios`, `solicitacoes`, `organizacoes`, etc.).
- **Hash de senha:** nunca se guarda a senha "crua" no banco. Em vez
  disso, se guarda o resultado de uma função matemática de "mão única"
  aplicada à senha (dá para calcular o hash a partir da senha, mas não o
  contrário). No login, calcula-se o hash da senha digitada e compara com
  o hash guardado.
- **Cookie / sessão:** depois do login, o servidor precisa de um jeito de
  saber "quem é você" nas próximas requisições, sem pedir a senha de novo
  toda hora. A solução usada aqui é um cookie: um pedacinho de texto que o
  navegador guarda e manda de volta automaticamente em toda requisição
  para o mesmo site. Ver a seção 3 acima para os detalhes.
