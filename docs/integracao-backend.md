# Guia de integração — Front-end ↔ API FastAPI

> **Para quem é este documento:** a equipe que vai implementar o back-end
> em **FastAPI + MongoDB Atlas**. Ele lista **tudo o que o front-end já
> chama**, com o formato exato de entrada e saída que cada tela espera.
> Se a API seguir este contrato, as telas funcionam sem mudanças no
> front-end.
>
> Complementa (não substitui) [`backend.md`](./backend.md) (instalação,
> segurança, aprovação institucional) e [`database.md`](./database.md)
> (coleções do MongoDB).

---

## 1. Como o front-end fala com a API

Toda chamada passa por **um único wrapper**, [`js/api.js`](../js/api.js):

```js
fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ... })
```

O que isso implica para o back-end:

| Regra | Detalhe |
|---|---|
| **Mesma origem** | O front chama caminhos relativos (`/api/...`). A API deve servir os arquivos estáticos do repositório na mesma porta (ver §7). Sem CORS. |
| **Sessão por cookie** | Cookie HttpOnly criado em `POST /api/auth/login`. O front nunca lê o token. |
| **JSON por padrão** | Corpo `application/json`. Quando há arquivo, o front envia `multipart/form-data` (sem `Content-Type` manual). |
| **Listas em multipart** | Em `multipart/form-data`, campos que são listas (ex.: `atribuido`) chegam como **texto JSON**: `'["FabLab Exemplo"]'` → fazer `json.loads`. |
| **Erros** | Em qualquer status ≥ 400, o front mostra `response.detail` **se for string**. Use `HTTPException(status_code=..., detail="Mensagem para o usuário")`. Ver §1.1 para erros 422. |
| **401** | Nas páginas autenticadas, se `GET /api/me` falhar, o front redireciona para `/html/login.html`. |
| **204** | Respostas sem corpo (ex.: `DELETE`) são aceitas. |

### 1.1 Erros de validação (422)

O 422 padrão do FastAPI devolve `detail` como **lista** — o front então
mostra só "Não foi possível concluir a operação.". Recomendado achatar
para uma string legível:

```python
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validacao_legivel(request: Request, exc: RequestValidationError):
    erro = exc.errors()[0]
    campo = ".".join(str(p) for p in erro["loc"] if p != "body")
    return JSONResponse(status_code=422, content={"detail": f"Campo '{campo}': {erro['msg']}"})
```

---

## 2. Convenções de dados

| Item | Convenção atual do front |
|---|---|
| **Protocolo** | String `"#0001"` (com `#`). Na URL vai codificado: `/api/solicitacoes/%230001` — o FastAPI já decodifica no parâmetro de rota. |
| **Nomes em vez de ids** | Em solicitações e parceiros, `requerente` e `atribuido` são **nomes** de organização (texto), não ids. A API resolve os ids para nomes na resposta e de nomes para ids na escrita. |
| **Datas de solicitação** | `abertura` e `prazo` são exibidas como vêm. O front **envia** `prazo` como `"dd/mm/aaaa"` ou `"A definir"`. Datas de histórico (`data`) também são exibidas como texto. |
| **Datas novas** (materiais, admin) | **ISO 8601** (`"2026-11-01T14:30:00-03:00"`). O front formata em pt-BR. Recomenda-se migrar as de solicitação para ISO também, no futuro. |
| **Enums** | Strings em português, com acento, exatamente como na tabela da §5. O front gera classes CSS a partir delas (`"Em análise"` → `status-em-analise`). |
| **ids** | Strings (ex.: `str(ObjectId)`). Nunca devolver `_id` do Mongo cru. |

---

## 3. Mapa: tela → rotas

| Tela | Arquivo JS | Rotas |
|---|---|---|
| Login `html/login.html` | `login.js` | `POST /api/auth/login`, depois `GET /api/me` (decide se vai para `/html/client/` ou `/html/fabricator/`) |
| Cadastro `html/cadastro.html` | `cadastro.js` | `GET /api/organizations`, `POST /api/auth/register` |
| Perfil `html/perfil.html` | `perfil.js` | `GET/PATCH /api/me`, `POST/GET /api/me/photo`, `POST /api/me/email/start`, `POST /api/me/email/confirm`, `POST /api/me/password`, `POST /api/auth/logout` |
| **Administração** `html/admin.html` 🆕 | `admin.js` | `GET /api/me`, `GET /api/organizations/{org_id}/requests`, `POST .../requests/{membership_id}`, `GET .../members` 🆕, `PATCH .../members/{membership_id}` 🆕, `DELETE .../members/{membership_id}` 🆕 |
| Solicitante — Início / Solicitações | `prototipo.js` | `GET /api/me`, `GET /api/solicitacoes`, `GET /api/parceiros` |
| **Solicitante — Nova solicitação** (modal em 4 etapas) 🆕 | `nova-solicitacao.js` | `POST /api/solicitacoes`, `GET /api/materiais` (sugestões do campo Material) |
| Solicitante — Detalhes | `prototipo.js` | `GET /api/solicitacoes/{protocolo}`, `GET/POST .../historico`, `PATCH /api/solicitacoes/{protocolo}` |
| Solicitante — Parceiros | `prototipo.js` | `GET /api/parceiros` |
| **Solicitante — Materiais para doação** 🆕 | `materiais.js` | `GET /api/materiais` |
| Solicitante — Histórico | `prototipo.js` | *(amostra estática — endpoint agregado pendente, ver §8)* |
| Fabricante — Visão geral / Demandas / Detalhe | `fabricator.js` | `GET /api/solicitacoes`, `GET /api/parceiros`, `PATCH /api/solicitacoes/{protocolo}`, `GET /api/materiais` (cartão "Materiais para doação" da visão geral) |
| **Fabricante — Materiais** 🆕 | `materiais.js` | `GET /api/materiais`, `POST /api/materiais`, `PATCH /api/materiais/{id}`, `DELETE /api/materiais/{id}` |

🆕 = criado nesta rodada.

---

## 4. Autenticação, sessão e perfil

### `POST /api/auth/login`
```json
{ "email": "lucas@reabilitacao.exemplo", "senha": "..." }
```
Resposta: qualquer JSON 200 + cookie de sessão. Erro: `401 {"detail": "E-mail ou senha inválidos."}`.

### `POST /api/auth/register`
Organização **existente**:
```json
{ "nome": "Beatriz", "sobrenome": "Lima", "email": "beatriz@reabilitacao.exemplo", "senha": "...",
  "tipo": "organizacao", "vinculo": "existente", "termos": true,
  "organizacao_id": "o1", "justificativa": "Atendo pacientes da unidade Ibirapuera." }
```
Organização **nova** (troca os dois últimos campos por):
```json
{ "...": "...", "vinculo": "nova", "nome_organizacao": "FabLab X", "cnpj": "00.000.000/0001-00",
  "email_institucional": "contato@fablabx.org", "telefone_institucional": "(11) 0000-0000", "cargo": "Coordenadora" }
```
Resposta: `{ "message": "Texto mostrado ao usuário na tela de confirmação." }`.

`justificativa` vira `memberships.justification`; `cargo` vira `memberships.job_title`.

### `GET /api/organizations?q=...&tipo=organizacao|fabricante`
```json
{ "items": [ { "id": "o1", "nome": "Centro de Reabilitação Exemplo" } ] }
```

### `GET /api/me` — usado por **todas** as páginas autenticadas
```json
{
  "user": {
    "id": "u1",
    "nome": "Lucas", "sobrenome": "Romano",
    "email": "lucas@reabilitacao.exemplo", "telefone": "",
    "foto": "/api/me/photo",
    "organizacao": "Centro de Reabilitação Exemplo"
  },
  "memberships": [
    {
      "org_id": "o1",
      "organization": "Centro de Reabilitação Exemplo",
      "organization_type": "organizacao",
      "organization_status": "active",
      "role": "admin",
      "membership_status": "active"
    }
  ]
}
```

Campos que o front **passou a exigir** nesta rodada:

- `user.id` — a tela de administração esconde as ações sobre o próprio usuário.
- `memberships[].org_id`, `role`, `organization_type` — decidem se aparece o
  item **"Administração"** no menu de perfil e qual organização é gerida.
- `user.organizacao` — nome da organização ativa; preenche o campo
  "Requerente" da nova solicitação e a identificação no cabeçalho.

`foto` é opcional (omitir quando não houver foto).

### Demais rotas de perfil
| Rota | Corpo | Resposta |
|---|---|---|
| `PATCH /api/me` | `{nome, sobrenome, telefone}` | qualquer 200 |
| `POST /api/me/photo` | multipart, campo `photo` (PNG/JPEG/WebP ≤ 2 MB) | qualquer 200 |
| `POST /api/me/email/start` | `{novo_email, senha_atual}` | `{message}` |
| `POST /api/me/email/confirm` | `{codigo}` | `{message}` (revoga sessões) |
| `POST /api/me/password` | `{senha_atual, nova_senha}` | `{message}` (revoga sessões) |
| `POST /api/auth/logout` | — | qualquer 200 |

---

## 5. Solicitações (solicitante) e demandas (fabricante)

### Enums

| Campo | Valores |
|---|---|
| `prioridade` | `Baixa`, `Média`, `Alta` |
| `status` | `Aberta`, `Aguardando aceite`, `Em análise`, `Em produção`, `Concluída`, `Recusada` |
| Status de parceiro | `Disponível`, `Capacidade limitada`, `Indisponível` |

### Objeto `Solicitacao` (resposta de `GET /api/solicitacoes` e `GET /api/solicitacoes/{protocolo}`)
```json
{
  "protocolo": "#0002",
  "solicitacao": "Mão mioelétrica infantil",
  "requerente": "Centro de Reabilitação Exemplo",
  "atribuido": ["FabLab Exemplo"],
  "prioridade": "Alta",
  "status": "Aguardando aceite",
  "categoria": "Prótese",
  "abertura": "03/11/2026",
  "prazo": "A definir",
  "material": "PLA",
  "descricao": "Mão para criança de 8 anos.\nMedidas no anexo.",
  "arquivo3d": { "nome": "mao.stl", "tamanho": "34 KB", "formato": "STL" },
  "ultima_atualizacao": "03/11/2026 10:15"
}
```

- `GET /api/solicitacoes` → **lista**, mais recentes primeiro (o dashboard
  mostra as 4 primeiras).
- Visibilidade decidida pela sessão: `organizacao` vê as que criou;
  `fabricante` vê as que têm sua organização em `atribuido`.
- `arquivo3d.tamanho` é **texto já formatado**; `null` quando não houver arquivo.

### `POST /api/solicitacoes` — assistente "Nova solicitação" 🆕

O modal agora tem 4 etapas (Informações da peça → Arquivo e especificações
→ Revisão → Envio), mas **o envio continua sendo uma única requisição**,
feita ao clicar em "Enviar solicitação" na etapa 3.

Sem arquivo (`application/json`):
```json
{
  "solicitacao": "Mão mioelétrica infantil",
  "atribuido": ["FabLab Exemplo"],
  "prioridade": "Alta",
  "categoria": "Prótese",
  "prazo": "30/11/2026",
  "material": "PLA",
  "descricao": "Mão para criança de 8 anos.\nMedidas no anexo."
}
```

Com arquivo (`multipart/form-data`): os mesmos campos como texto, com
`atribuido` em JSON (`'["FabLab Exemplo"]'`) e o arquivo no
campo **`arquivo3d`**.

O que o back-end decide (o front **não** envia):

- `protocolo` (sequencial, `#NNNN`), `abertura`, `ultima_atualizacao`;
- `requerente` = organização da sessão (o campo na tela é só leitura);
- `status` inicial — recomendado **`"Aguardando aceite"`**, já que a
  solicitação nasce com parceiros atribuídos e o painel do fabricante
  mostra os botões Aceitar/Recusar nesse status;
- evento `Criação` (e `Atribuição`) no histórico.

Validações que o front já faz e que o back **deve repetir**:

| Campo | Regra |
|---|---|
| `solicitacao` | obrigatório, ≤ 120 caracteres |
| `categoria` | obrigatório |
| `descricao` | obrigatório, ≤ 4000 caracteres |
| `atribuido` | ≥ 1 item; cada nome deve ser um parceiro `fabricante` ativo |
| `prazo` | `"A definir"` ou data `dd/mm/aaaa` não passada |
| `material` | opcional; `"A definir"` quando vazio |
| `arquivo3d` | opcional; extensões `stl, obj, 3mf, step, stp, iges, igs`; **≤ 50 MB** |

Resposta `201`: o objeto `Solicitacao` criado — o front usa
**`protocolo`** para mostrar "Solicitação #0002 enviada!" e montar o
link "Ver solicitação".

Esboço FastAPI:

```python
import json
from typing import Optional
from fastapi import Request, UploadFile

@app.post("/api/solicitacoes", status_code=201)
async def criar_solicitacao(request: Request, sessao=Depends(exigir_organizacao_solicitante)):
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        form = await request.form()
        dados = {k: v for k, v in form.items() if k != "arquivo3d"}
        dados["atribuido"] = json.loads(dados.get("atribuido", "[]"))
        arquivo: Optional[UploadFile] = form.get("arquivo3d")
    else:
        dados, arquivo = await request.json(), None
    entrada = NovaSolicitacao(**dados)   # modelo Pydantic com as validações acima
    ...
```

### `PATCH /api/solicitacoes/{protocolo}`
Corpo parcial. Usos atuais:

- Fabricante: `{"status": "Em análise" | "Recusada" | "Em produção" | "Concluída"}`.
- Organização solicitante (modal "Editar"): `{solicitacao, requerente, atribuido, prioridade, status, categoria, prazo, material, descricao}` — multipart se trocar o arquivo (mesmas regras do POST).

Toda mudança de status gera evento `Status` no histórico. Resposta: o objeto atualizado.

### `GET /api/solicitacoes/{protocolo}/historico`
Lista em **ordem cronológica** (o front inverte para mostrar o mais recente primeiro):
```json
[
  { "data": "03/11/2026 10:15", "tipo": "Criação", "titulo": "Solicitação criada",
    "descricao": "Solicitação registrada pela organização solicitante.", "autor": "Lucas Romano (Centro de Reabilitação Exemplo)" }
]
```
`tipo`: `Criação`, `Atribuição`, `Status`, `Edição`, `Comentário`, `Anexo`.

### `POST /api/solicitacoes/{protocolo}/historico`
`{"tipo": "Comentário" | "Anexo", "mensagem": "..."}` ou multipart com
`tipo`, `mensagem` e `arquivo`. `data` e `autor` vêm da sessão. Resposta: o evento criado.

### `GET /api/parceiros`
```json
[
  { "nome": "FabLab Exemplo", "cidade": "São Caetano do Sul - SP",
    "status": "Disponível", "impressoras": 8, "tecnologias": "FDM, SLA",
    "materiais": "PLA, PETG, TPU", "emProducao": 1 }
]
```
🆕 Agora alimenta também os **checkboxes "Parceiros atribuídos"** da nova
solicitação e da edição (antes eram três nomes fixos no HTML). O `nome`
aqui é o mesmo valor que vai em `atribuido`.

---

## 6. Rotas novas desta rodada

### 6.1 Administração de organizações 🆕 (`html/admin.html`)

**Autorização (todas as rotas):** o usuário da sessão precisa ter, em
`{org_id}`, vínculo `role="admin"` **e** `status="active"`, e a
organização precisa estar `active`. Caso contrário, `403`. A tela só
aparece para admins, mas isso é conveniência — **a checagem é do back-end**.

#### `GET /api/organizations/{org_id}/requests` — pedidos pendentes
Vínculos `status="pending"` da organização:
```json
[
  { "membership_id": "ms10", "user_id": "u10",
    "nome": "Beatriz", "sobrenome": "Lima", "email": "beatriz@reabilitacao.exemplo",
    "job_title": "Fisioterapeuta",
    "justification": "Atendo pacientes da unidade Ibirapuera.",
    "role": "member",
    "created_at": "2026-11-02T10:00:00-03:00" }
]
```

#### `POST /api/organizations/{org_id}/requests/{membership_id}`
`{"approve": true}` → vínculo `active` (+ gravar `approved_by`, `approved_at`).
`{"approve": false}` → vínculo `rejected`. Resposta: qualquer 200.
`404` se o pedido não existir ou não for dessa organização.

#### `GET /api/organizations/{org_id}/members` 🆕
Vínculos `status="active"` da organização:
```json
[
  { "membership_id": "ms1", "user_id": "u1",
    "nome": "Lucas", "sobrenome": "Romano", "email": "lucas@reabilitacao.exemplo",
    "job_title": "Coordenador",
    "role": "admin", "membership_status": "active",
    "joined_at": "2026-03-01T10:00:00-03:00" }
]
```
`joined_at` = data da aprovação (o front usa `created_at` se `joined_at` faltar).

#### `PATCH /api/organizations/{org_id}/members/{membership_id}` 🆕
`{"role": "admin" | "member"}` → resposta: o membro atualizado.

#### `DELETE /api/organizations/{org_id}/members/{membership_id}` 🆕
Remove o vínculo (recomendado: marcar `status="removed"` em vez de apagar,
para auditoria) e **revoga as sessões** daquele usuário. Resposta `204`.

Regras obrigatórias em `PATCH`/`DELETE`:

- o admin **não pode** alterar nem remover o **próprio** vínculo (`400`) — a tela já esconde esses botões;
- **nunca** deixar a organização sem administrador ativo (`409 {"detail": "A organização precisa de pelo menos um administrador."}`);
- registrar quem fez a mudança e quando (auditoria).

Pydantic:
```python
from typing import Literal
from pydantic import BaseModel

class DecisaoPedido(BaseModel):
    approve: bool

class AlterarPapel(BaseModel):
    role: Literal["admin", "member"]
```

### 6.2 Materiais para doação 🆕

Os parceiros (fabricantes) informam quais insumos têm disponíveis para
produções **doadas**; a organização solicitante consulta esse estoque antes de abrir uma
solicitação (e o campo "Material" da nova solicitação sugere os materiais com estoque).

#### Objeto `Material`
```json
{
  "id": "m1",
  "material": "PLA",
  "tipo": "Filamento",
  "cor": "Branco",
  "quantidade": 12.5,
  "unidade": "kg",
  "estoque_minimo": 2,
  "observacoes": "Bobinas de 1 kg",
  "situacao": "Disponível",
  "parceiro": "FabLab Exemplo",
  "cidade": "São Caetano do Sul - SP",
  "atualizado_em": "2026-11-01T14:30:00-03:00"
}
```

| Campo | Regra |
|---|---|
| `material` | obrigatório, ≤ 60 caracteres (texto livre; o front sugere PLA, PETG, TPU, ABS, Nylon, Resina…) |
| `tipo` | `Filamento`, `Resina`, `Pó`, `Outro` |
| `cor` | opcional, ≤ 40 |
| `quantidade` | número ≥ 0 |
| `unidade` | `kg`, `g`, `L`, `mL`, `un` |
| `estoque_minimo` | número ≥ 0 ou `null` |
| `observacoes` | opcional, ≤ 500 |
| `situacao` | **calculada pelo back-end**: `quantidade == 0` → `Esgotado`; `estoque_minimo` e `quantidade < estoque_minimo` → `Estoque baixo`; senão `Disponível` |
| `parceiro`, `cidade` | resolvidos a partir da organização dona do item |
| `atualizado_em` | definido pelo servidor a cada escrita (ISO 8601) |

#### Rotas

| Método | Caminho | Quem | Comportamento |
|---|---|---|---|
| GET | `/api/materiais` | qualquer sessão | `organizacao` (solicitante): itens de **todos** os fabricantes ativos. `fabricante`: só os **da própria organização**. |
| POST | `/api/materiais` | membro ativo de `fabricante` | Cria item na organização da sessão. Corpo: campos editáveis abaixo. Resposta `201` + `Material`. |
| PATCH | `/api/materiais/{id}` | membro ativo da organização dona | Corpo parcial. Resposta: `Material`. `404` se o item for de outra organização. |
| DELETE | `/api/materiais/{id}` | idem | `204`. |

Corpo enviado pelo front em POST/PATCH:
```json
{ "material": "PETG", "tipo": "Filamento", "cor": "Azul",
  "quantidade": 4, "unidade": "kg", "estoque_minimo": 5, "observacoes": "" }
```

Pydantic:
```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

class MaterialEntrada(BaseModel):
    material: str = Field(min_length=1, max_length=60)
    tipo: Literal["Filamento", "Resina", "Pó", "Outro"]
    cor: str = Field(default="", max_length=40)
    quantidade: float = Field(ge=0)
    unidade: Literal["kg", "g", "L", "mL", "un"]
    estoque_minimo: Optional[float] = Field(default=None, ge=0)
    observacoes: str = Field(default="", max_length=500)

class MaterialParcial(BaseModel):          # PATCH
    material: Optional[str] = Field(default=None, min_length=1, max_length=60)
    tipo: Optional[Literal["Filamento", "Resina", "Pó", "Outro"]] = None
    cor: Optional[str] = Field(default=None, max_length=40)
    quantidade: Optional[float] = Field(default=None, ge=0)
    unidade: Optional[Literal["kg", "g", "L", "mL", "un"]] = None
    estoque_minimo: Optional[float] = Field(default=None, ge=0)
    observacoes: Optional[str] = Field(default=None, max_length=500)

def situacao(quantidade: float, estoque_minimo: Optional[float]) -> str:
    if quantidade <= 0:
        return "Esgotado"
    if estoque_minimo and quantidade < estoque_minimo:
        return "Estoque baixo"
    return "Disponível"
```

Coleção `materiais`: ver [`database.md`](./database.md).

---

## 7. Servindo o front-end pela própria API

Monte os estáticos **depois** de registrar as rotas `/api`, para não
"engolir" as rotas da API:

```python
from fastapi.staticfiles import StaticFiles

app.include_router(api_router)                       # todas as rotas /api/...
app.mount("/", StaticFiles(directory=".", html=True), name="site")
```

Rodando da raiz do repositório:
`uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000` →
`http://127.0.0.1:8000/index.html`. Dependência para multipart:
`python-multipart`.

---

## 8. Pendências conhecidas (para alinhar com o front)

- **Histórico agregado (solicitante):** `html/client/historico.html` ainda é uma
  amostra estática. Sugestão: `GET /api/historico` → lista de
  `{data, protocolo, tipo, titulo, solicitacao, status, autor}` de todas as
  solicitações visíveis para a organização.
- **Redirecionamento pós-login:** já resolvido no front — `login.js`
  chama `GET /api/me` logo após o login e vai para `/html/client/` ou
  `/html/fabricator/` conforme o `organization_type` do primeiro vínculo
  ativo (sem vínculo ativo, vai para o perfil). Por isso o login deve
  **recusar** (`403` com `detail` explicando) contas cujo vínculo ainda
  está pendente.
- **Formato de datas das solicitações:** hoje texto `dd/mm/aaaa`. Se o
  back preferir ISO 8601, avisar o front para ajustar a formatação
  (`prototipo.js`, `fabricator.js`) e o envio de `prazo`
  (`nova-solicitacao.js`, `prototipo.js`).
- **Notificação aos parceiros** quando uma solicitação for criada: a tela
  de envio diz "os parceiros selecionados já podem visualizar a demanda" —
  isso já é verdade pela regra de visibilidade; e-mail é opcional.

---

## 9. Checklist de entrega do back-end

- [ ] `GET /api/me` com `user.id`, `user.organizacao` e `memberships[].{org_id, organization, organization_type, organization_status, role, membership_status}`
- [ ] Erros sempre com `detail` em string (inclusive 422 — §1.1)
- [ ] `POST /api/solicitacoes` aceitando JSON **e** multipart (`arquivo3d`, `atribuido` em JSON)
- [ ] Status inicial `Aguardando aceite` + eventos `Criação`/`Atribuição` no histórico
- [ ] `GET /api/parceiros` com `nome` idêntico ao usado em `atribuido`
- [ ] Rotas de administração com checagem de admin ativo, sem auto-alteração e sem deixar a organização sem admin
- [ ] `DELETE .../members/{id}` revogando as sessões do usuário removido
- [ ] CRUD de `/api/materiais` com visibilidade por tipo de organização e `situacao` calculada
- [ ] Estáticos servidos na mesma origem (§7)
- [ ] Testar cada tela da §3 no navegador com o servidor real
