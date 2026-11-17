# Guia de integração — Front-end ↔ API FastAPI

> **Para quem é este documento:** a equipe que vai implementar o back-end
> em **FastAPI + MongoDB Atlas**. Ele lista **tudo o que o front-end já
> chama**, com o formato exato de entrada e saída que cada tela espera.
> Se a API seguir este contrato, as telas funcionam sem mudanças no
> front-end.
>
> Complementa (não substitui) [`backend.md`](./backend.md) (instalação,
> segurança, aprovação institucional) e [`database.md`](./database.md)
> (coleções do MongoDB, para conferir contra o banco que já existe no Atlas).
>
> 🆕 marca o que é novo ou mudou em relação ao commit anterior
> (`734edc8`).

### Resumo do que mudou desde o último commit

| Área | Mudança | Onde |
|---|---|---|
| Cadastro | Organização nova entra direto (sem aprovação), com etapa de revisão; endereço **só para fabricante** | §4 |
| Organização | `GET/PATCH/DELETE /api/organizations/{org_id}`; `enderecos` (lista de locais de retirada) no lugar de `endereco` | §6.1 |
| Solicitações | Sem escolha de parceiro: **fila global** (`GET /api/fila`, `aceitar` atômico, `devolver`) | §5 |
| Fluxo | Novos status `Aguardando material` e `Pronta para retirada`. Cada transição tem rota própria (`iniciar-producao`, `material-recebido`, `concluir-producao`, `aprovar`, `reprovar`); o `PATCH` não muda mais status | §5 |
| Produção | Impressora e origem do material (doado ou do solicitante) em `producao`; baixa no estoque com `quantidade_usada` | §5 |
| Arquivos | `GET /api/solicitacoes/{protocolo}/arquivo3d` (visualizador 3D no navegador) | §5 |
| Parceiros | `GET /api/parceiros` com tudo calculado (impressoras, doação, locais, contato) | §5 |
| Impressoras | CRUD `/api/impressoras`; o status muda sozinho com a produção | §6.3 |
| Relatórios | Página nova do solicitante; usa `GET /api/solicitacoes` + `concluida_em` | §3 |

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
| **Multipart** | Com arquivo, os campos de texto chegam como partes de formulário (UTF-8). Hoje nenhum campo do front em multipart é lista. |
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
| **Nomes em vez de ids** | Em solicitações e parceiros, `requerente` e `atribuido` são **nomes** de organização (texto), não ids. A API resolve os ids para nomes na resposta. `atribuido` é `null` enquanto a solicitação está na fila global. |
| **Datas de solicitação** | `abertura` e `prazo` são exibidas como vêm. O front **envia** `prazo` como `"dd/mm/aaaa"` ou `"A definir"`. Datas de histórico (`data`) também são exibidas como texto. |
| **Datas novas** (materiais, admin) | **ISO 8601** (`"2026-11-01T14:30:00-03:00"`). O front formata em pt-BR. Recomenda-se migrar as de solicitação para ISO também, no futuro. |
| **Enums** | Strings em português, com acento, exatamente como na tabela da §5. O front gera classes CSS a partir delas (`"Em análise"` → `status-em-analise`). |
| **ids** | Strings (ex.: `str(ObjectId)`). Nunca devolver `_id` do Mongo cru. |

---

## 3. Mapa: tela → rotas

| Tela | Arquivo JS | Rotas |
|---|---|---|
| Login `html/login.html` | `login.js` | `POST /api/auth/login`, depois `GET /api/me` (decide se vai para `/html/client/` ou `/html/fabricator/`) |
| Cadastro `html/cadastro.html` | `cadastro.js` | `GET /api/organizations`, `POST /api/auth/register` e, se `acesso_liberado`, `GET /api/me` (vai direto para o painel) |
| Perfil `html/perfil.html` | `perfil.js` | `GET/PATCH /api/me`, `POST/GET /api/me/photo`, `POST /api/me/email/start`, `POST /api/me/email/confirm`, `POST /api/me/password`, `POST /api/auth/logout` |
| **Administração** `html/admin.html` 🆕 | `admin.js` | `GET /api/me`, `GET /api/organizations/{org_id}/requests`, `POST .../requests/{membership_id}`, `GET .../members`, `PATCH .../members/{membership_id}`, `DELETE .../members/{membership_id}`, `GET/PATCH/DELETE /api/organizations/{org_id}` 🆕 (aba "Dados da organização") |
| Solicitante — Início / Solicitações | `prototipo.js` | `GET /api/me`, `GET /api/solicitacoes`, `GET /api/parceiros` |
| **Solicitante — Nova solicitação** (modal em 4 etapas, sem escolha de parceiro) 🆕 | `nova-solicitacao.js` | `POST /api/solicitacoes`, `GET /api/materiais` (sugestões do campo Material) |
| Solicitante — Detalhes | `prototipo.js`, `visualizador-3d.js` | `GET /api/solicitacoes/{protocolo}`, `GET/POST .../historico`, `PATCH /api/solicitacoes/{protocolo}`, `GET .../arquivo3d` 🆕, `POST .../aprovar` 🆕, `POST .../reprovar` 🆕 |
| Solicitante — Parceiros (refeita) 🆕 | `prototipo.js` | `GET /api/parceiros` (formato novo, §5) |
| **Solicitante — Materiais para doação** 🆕 | `materiais.js` | `GET /api/materiais` |
| **Solicitante — Relatórios** 🆕 (`relatorios.html`, substitui o Histórico) | `relatorios.js` | `GET /api/solicitacoes` (todas, inclusive concluídas; usa `concluida_em`) |
| Fabricante — Visão geral | `fabricator.js` | `GET /api/solicitacoes`, `GET /api/fila` (contador "Novas na fila"), `GET /api/parceiros`, `GET /api/materiais` |
| **Fabricante — Novas solicitações** (fila global) 🆕 | `fabricator.js` | `GET /api/fila`, `POST /api/solicitacoes/{protocolo}/aceitar` |
| Fabricante — Demandas / Detalhe | `fabricator.js` | `GET /api/solicitacoes`, `GET /api/solicitacoes/{protocolo}` (também para itens da fila), `POST .../aceitar`, `POST .../devolver`, 🆕 `POST .../iniciar-producao`, `POST .../material-recebido`, `POST .../concluir-producao`, `GET /api/impressoras`, `GET /api/materiais`, `GET /api/organizacao/enderecos` |
| **Fabricante — Impressoras** 🆕 | `impressoras.js` | `GET /api/impressoras`, `POST /api/impressoras`, `PATCH /api/impressoras/{id}`, `DELETE /api/impressoras/{id}` |
| **Fabricante — Materiais** 🆕 | `materiais.js` | `GET /api/materiais`, `POST /api/materiais`, `PATCH /api/materiais/{id}`, `DELETE /api/materiais/{id}` |

🆕 = criado ou alterado nas duas últimas rodadas (nova solicitação, administração, materiais, fila global e impressoras).

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
{ "...": "...", "vinculo": "nova", "nome_organizacao": "FabLab X", "cnpj": "11.222.333/0001-81",
  "email_institucional": "contato@fablabx.org", "telefone_institucional": "(11) 0000-0000", "cargo": "Coordenadora",
  "endereco": { "cep": "01001-000", "logradouro": "Praça da Sé", "numero": "10", "complemento": "",
                "bairro": "Sé", "cidade": "São Paulo", "uf": "SP" } }
```

🆕 **`endereco`**: **só para `tipo="fabricante"`**, e obrigatório nesse caso
(todos os campos, exceto `complemento`), porque é onde as peças são
produzidas e retiradas. Organizações solicitantes **não têm endereço de
retirada**: a tela não mostra o bloco e manda `endereco: null`. Se vier
algo, o back ignora.
`cep` no formato `00000-000`; `uf` com a sigla de 2 letras. O front
preenche rua, bairro, cidade e UF pelo CEP (ViaCEP, direto do navegador).
O back não precisa consultar o CEP, só validar. 🆕 O back guarda esse
endereço como o **primeiro item** da lista `enderecos` da organização, com
`nome="Sede"` e um `id` gerado. A `cidade` mostrada em `GET /api/parceiros`
vem do primeiro endereço (`"São Paulo - SP"`).
Resposta `201`, conforme o tipo de vínculo:

| Vínculo | O que o back-end faz | Resposta |
|---|---|---|
| **`nova`** | Cria a organização **já ativa**, cria o vínculo `role="admin"`, `status="active"` e **abre a sessão** (mesmo cookie do login). Sem aprovação. | `{"message": "...", "acesso_liberado": true}` + `Set-Cookie` |
| **`existente`** | Cria o vínculo `role="member"`, `status="pending"`. O usuário **não** consegue entrar até um admin da organização aprovar (§6.1). | `{"message": "...", "acesso_liberado": false}` |

O front mostra antes uma **etapa de revisão** ("Revisar dados" / "Criar
organização" ou "Enviar solicitação") e só então chama esta rota. Na tela
de confirmação, com `acesso_liberado: true`, aparece o botão **"Acessar
plataforma"** (o front chama `GET /api/me` e vai para o painel do tipo da
organização). Com `false`, aparece `message` e o link para o login.

`justificativa` vira `memberships.justification`; `cargo` vira `memberships.job_title`.

Regras: e-mail único (`409`); CNPJ único entre organizações (`409`);
`termos` precisa ser `true` (`422`). Como não há mais verificação manual
de organizações novas, recomenda-se validar o CNPJ (dígitos verificadores,
o front já faz) e registrar auditoria de quem criou cada organização.

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

## 5. Solicitações, fila global e demandas

### Como funciona o fluxo 🆕

1. A organização solicitante cria a solicitação **sem escolher parceiro**.
   Ela nasce com `status="Aberta"` e sem fabricante: está na **fila global**.
2. **Todos** os fabricantes ativos veem a fila (`GET /api/fila`).
3. O primeiro fabricante que **aceitar** (`POST .../aceitar`) assume a
   solicitação: ela sai da fila, recebe `atribuido` = nome dele e vai para
   `status="Em análise"`. Agora só ele a vê em Demandas.
4. 🆕 O fabricante **inicia a produção** (`POST .../iniciar-producao`)
   escolhendo **a impressora** e **a origem do material**:
   - **doado pelo parceiro**: escolhe um item do próprio estoque de
     materiais para doação → `Em produção`;
   - **fornecido pelo solicitante**: diz o que precisa ser entregue e em
     qual endereço → `Aguardando material`. Quando o material chega, o
     fabricante confirma (`POST .../material-recebido`) → `Em produção`.

   Enquanto estiver `Em análise`, pode **devolver à fila**
   (`POST .../devolver`), e ela volta a ficar disponível para todos.
5. 🆕 Ao terminar, o fabricante **conclui a produção**
   (`POST .../concluir-producao`) informando **o endereço de retirada**,
   um dos endereços cadastrados da organização dele. O status vai para
   `Pronta para retirada`, e a API **gera sozinha** o evento
   "Disponível para retirada" no histórico, com o local e as instruções.
6. 🆕 A organização solicitante retira e **testa** a peça. Então:
   - **aprova** (`POST .../aprovar`): o status vai para `Concluída`. É o
     **único** caminho para `Concluída`;
   - ou **devolve para ajuste** (`POST .../reprovar` com o motivo): o status
     volta para `Em produção` e o motivo fica no histórico e em `ajuste`.

```
             criar                 aceitar (1º fabricante)
Solicitante ───────▶ Aberta / fila ─────────────────────────▶ Em análise ──┬─(material doado)──────────────────────▶ Em produção ──▶ Pronta para retirada ──▶ Concluída
                        ▲                                         │         └─(material do solicitante)▶ Aguardando material ─┘ ▲  concluir-producao  │    aprovar
                        └──────────────── devolver ───────────────┘                          material-recebido                └────── reprovar ─────┘ (solicitante)
```

### Enums

| Campo | Valores |
|---|---|
| `prioridade` | `Baixa`, `Média`, `Alta` |
| `status` | `Aberta`, `Em análise`, `Aguardando material` 🆕, `Em produção`, `Pronta para retirada` 🆕, `Concluída` |
| Status de parceiro | `Disponível`, `Capacidade limitada`, `Indisponível` |

`Aguardando aceite` e `Recusada` **deixaram de existir**: a recusa foi
substituída pela fila (quem não quer a solicitação simplesmente não a aceita).

### Objeto `Solicitacao` (resposta de `GET /api/solicitacoes`, `GET /api/fila` e `GET /api/solicitacoes/{protocolo}`)
```json
{
  "protocolo": "#0009",
  "solicitacao": "Mão mioelétrica infantil",
  "requerente": "Centro de Reabilitação Exemplo",
  "atribuido": null,
  "prioridade": "Alta",
  "status": "Aberta",
  "categoria": "Prótese",
  "abertura": "03/11/2026",
  "prazo": "A definir",
  "material": "PLA",
  "descricao": "Mão para criança de 8 anos.\nMedidas no anexo.",
  "arquivo3d": { "nome": "mao.stl", "tamanho": "34 KB", "formato": "STL",
                 "url": "/api/solicitacoes/%230007/arquivo3d" },
  "ultima_atualizacao": "03/11/2026 10:15"
}
```

- 🆕 `producao`: `null` até iniciar a produção; depois
  `{"impressora": {"id", "nome", "modelo", "tecnologia"}, "material": {...}}`. Em `material`:
  - doado: `{"origem": "doacao", "id": "m1", "nome": "PLA · Branco", "tipo": "Filamento"}`;
  - do solicitante: `{"origem": "solicitante", "nome": "500 g de TPU", "especificacao": "500 g de TPU 95A, preto",
    "entrega": {"local": "Sede", "endereco": "…texto…"}, "recebido_em": null | "dd/mm/aaaa hh:mm"}`.

  O front mostra isso no cartão "Impressora e material" do detalhe. Quando a
  origem é o solicitante, o fluxo ganha a etapa "Aguardando material".
- 🆕 `concluida_em`: `"dd/mm/aaaa hh:mm"` quando o solicitante aprova a peça,
  e `null` antes disso. Os Relatórios usam esse campo para calcular o tempo até a
  conclusão.
- 🆕 `retirada`: `null`, ou, quando `Pronta para retirada`, o local escolhido:
  `{"local": "Unidade Centro", "endereco": "Praça da Sé, 100 — Térreo, Sé, São Paulo/SP, CEP 01001-000",
  "instrucoes": "Seg a sex, 9h às 17h", "parceiro": "FabLab Exemplo", "telefone": "(11) 3000-2000",
  "data": "04/11/2026 18:41"}`. O endereço é guardado **como texto**
  (cópia), para não mudar se o endereço da organização for editado depois.
- 🆕 `ajuste`: `null`, ou, depois de uma devolução para ajuste e até a próxima
  conclusão da produção, `{"motivo": "...", "data": "...", "autor": "Marina Alves (Centro...)"}`.
  As duas telas mostram esse aviso no topo do detalhe.
- `atribuido`: **string** com o nome do fabricante que aceitou, ou `null`
  enquanto estiver na fila. A tela mostra "Aguardando parceiro" quando é `null`.
- `arquivo3d.tamanho` é **texto já formatado**; `null` quando não houver arquivo.
- 🆕 `arquivo3d.url` (opcional): endereço de download do arquivo. Se vier
  ausente, o front usa `GET /api/solicitacoes/{protocolo}/arquivo3d`
  (protocolo codificado: `#` → `%23`). O botão "Visualizar 3D" baixa o
  arquivo por essa URL e o desenha no navegador; "Baixar" usa a mesma URL.

Visibilidade (decidida pela sessão):

| Rota | Organização solicitante | Fabricante |
|---|---|---|
| `GET /api/solicitacoes` | as que **ela criou** (todas as etapas) | só as que **ele aceitou** (suas demandas) |
| `GET /api/fila` | `403` | todas com `status="Aberta"` e sem fabricante |
| `GET /api/solicitacoes/{protocolo}` | as que criou | as que aceitou **e** as que estão na fila (para avaliar antes de aceitar) |

Listas mais recentes primeiro. O dashboard mostra as 4 primeiras.

### `POST /api/solicitacoes` — assistente "Nova solicitação"

O modal tem 4 etapas (Informações da peça → Arquivo e especificações →
Revisão → Envio), mas **o envio é uma única requisição**, feita ao clicar
em "Enviar solicitação" na etapa 3.

Sem arquivo (`application/json`):
```json
{
  "solicitacao": "Mão mioelétrica infantil",
  "prioridade": "Alta",
  "categoria": "Prótese",
  "prazo": "30/11/2026",
  "material": "PLA",
  "descricao": "Mão para criança de 8 anos.\nMedidas no anexo."
}
```

Com arquivo (`multipart/form-data`): os mesmos campos como texto e o
arquivo no campo **`arquivo3d`**.

O que o back-end decide (o front **não** envia):

- `protocolo` (sequencial, `#NNNN`), `abertura`, `ultima_atualizacao`;
- `requerente` = organização da sessão (só organizações do tipo `organizacao`; fabricante recebe `403`);
- `status="Aberta"` e fabricante vazio (fila global);
- evento `Criação` no histórico ("... enviada para a fila de novas solicitações").

Se vier `atribuido` ou `status` no corpo, **ignore**. Esses campos não são
definidos pela organização solicitante.

Validações que o front já faz e que o back **deve repetir**:

| Campo | Regra |
|---|---|
| `solicitacao` | obrigatório, ≤ 120 caracteres |
| `categoria` | obrigatório |
| `descricao` | obrigatório, ≤ 4000 caracteres |
| `prazo` | `"A definir"` ou data `dd/mm/aaaa` não passada |
| `material` | opcional; `"A definir"` quando vazio |
| `arquivo3d` | opcional; extensões `stl, obj, 3mf, step, stp, iges, igs`; **≤ 50 MB** |

Resposta `201`: o objeto `Solicitacao` criado. O front usa **`protocolo`**
para mostrar "Solicitação #0009 enviada!" e montar o link "Ver solicitação".

Esboço FastAPI:

```python
from typing import Optional
from fastapi import Request, UploadFile

@app.post("/api/solicitacoes", status_code=201)
async def criar_solicitacao(request: Request, sessao=Depends(exigir_organizacao_solicitante)):
    if request.headers.get("content-type", "").startswith("multipart/form-data"):
        form = await request.form()
        dados = {k: v for k, v in form.items() if k != "arquivo3d"}
        arquivo: Optional[UploadFile] = form.get("arquivo3d")
    else:
        dados, arquivo = await request.json(), None
    entrada = NovaSolicitacao(**dados)   # modelo Pydantic com as validações acima
    ...  # salvar com status="Aberta", fabricante_id=None
```

### `GET /api/fila` — fila global 🆕
Só para fabricantes ativos. Lista de `Solicitacao` com `status="Aberta"` e
`atribuido=null`. O front ordena por prioridade e depois pela abertura
mais antiga, e filtra por texto e prioridade.

### `POST /api/solicitacoes/{protocolo}/aceitar` 🆕
Sem corpo. O fabricante da sessão assume a solicitação: grava o
fabricante, muda para `Em análise` e registra evento `Atribuição`
("Aceita por {fabricante}"). Resposta: a `Solicitacao` atualizada.

**Tem que ser atômico**: dois parceiros podem clicar ao mesmo tempo.
Faça o filtro e a escrita numa operação só e responda **`409`** a quem chegar
depois. O front mostra o `detail` e atualiza a fila.

```python
resultado = db.solicitacoes.find_one_and_update(
    {"protocolo": protocolo, "status": "Aberta", "fabricante_id": None},
    {"$set": {"fabricante_id": org_id, "status": "Em análise", "ultima_atualizacao": agora},
     "$push": {"historico": evento_aceite}},
    return_document=ReturnDocument.AFTER,
)
if resultado is None:
    raise HTTPException(409, "Esta solicitação já foi aceita por outro parceiro.")
```

### `POST /api/solicitacoes/{protocolo}/devolver` 🆕
Sem corpo. Só o fabricante que aceitou e só com `status="Em análise"`
(senão `409`). Volta para `Aberta`, limpa o fabricante e registra evento
`Atribuição` ("Devolvida à fila").

### `PATCH /api/solicitacoes/{protocolo}`
Corpo parcial. Usos atuais:

- **Fabricante**: 🆕 **não altera mais o status pelo `PATCH`** (`409`; outro
  campo: `403`). Todas as transições dele têm rota própria:
  `iniciar-producao`, `material-recebido`, `concluir-producao` e `devolver`.
- **Organização solicitante** (modal "Editar"): `{solicitacao, prioridade,
  categoria, prazo, material, descricao}`, em multipart se trocar o arquivo
  (mesmas regras do POST). **Não** altera `status`, `atribuido` nem `requerente`.

Mudança de status gera evento `Status`, e edição gera `Edição`. Resposta: o objeto atualizado.

### `POST /api/solicitacoes/{protocolo}/iniciar-producao` 🆕 (fabricante responsável)
Só quando o status é `Em análise` (senão `409`), e só pelo fabricante da demanda (senão `403`).
```json
{ "impressora_id": "i1", "origem_material": "doacao", "material_id": "m1" }
{ "impressora_id": "i1", "origem_material": "solicitante",
  "especificacao": "500 g de TPU 95A, cor preta", "endereco_id": "o2-sede" }
```
| Regra | Erro |
|---|---|
| `impressora_id` da própria organização, não `Inativa` nem `Em manutenção` | `422` |
| `origem_material` ∈ {`doacao`, `solicitante`} | `422` |
| doação: `material_id` do próprio estoque, com quantidade > 0 | `422` |
| solicitante: `especificacao` (≥ 3 caracteres) e `endereco_id` (pode ser omitido se só houver um endereço) | `422` |

Efeitos:
- **doação:** `status="Em produção"`, impressora com `status="Em uso"` e
  evento `Status` "Produção iniciada" (impressora + material).
- **solicitante:** `status="Aguardando material"` e evento "Aguardando
  material do solicitante" (o que entregar e onde). A impressora fica
  reservada em `producao` e passa a `Em uso` quando o material chega.
- Grava `producao` (ver o objeto). O estoque é descontado **ao concluir a
  produção**, com a quantidade realmente usada (ver `concluir-producao`).

### `POST /api/solicitacoes/{protocolo}/material-recebido` 🆕 (fabricante responsável)
Sem corpo. Só com `status="Aguardando material"` (senão `409`). Muda para
`Em produção`, grava `producao.material.recebido_em`, põe a impressora em
`Em uso` e gera o evento "Material recebido — produção iniciada".

> Impressora: ao **concluir a produção**, volte-a para `Disponível` se ela
> não estiver em outra demanda `Em produção`. Se a peça for devolvida para
> ajuste, ela volta para `Em uso`.

### `GET /api/organizacao/enderecos` — endereços da organização ativa 🆕
Qualquer membro ativo (não só admin) lê os endereços da **própria**
organização. É usado pelo modal "Concluir produção". Resposta: a lista
`enderecos` (ver `GET /api/organizations/{org_id}`).

### `POST /api/solicitacoes/{protocolo}/concluir-producao` 🆕 (fabricante responsável)
```json
{ "endereco_id": "o2-centro", "instrucoes": "Seg a sex, 9h às 17h", "quantidade_usada": 0.5 }
```
- Só quando o status é `Em produção` (senão `409`), e só pelo fabricante da demanda (senão `403`).
- `endereco_id`: um dos `enderecos` da organização do fabricante.
  **Obrigatório se ela tiver mais de um** (`422` sem ele). Com um só
  endereço, pode ser omitido. Sem nenhum endereço: `422` pedindo para
  cadastrar. O front sempre mostra a escolha e só libera o botão quando há
  endereço.
- `instrucoes`: opcional, ≤ 300 caracteres (horário, com quem falar).
- 🆕 `quantidade_usada`: **obrigatória quando `producao.material.origem="doacao"`**.
  É um número > 0 na unidade do item (`kg`, `g`, `L`...), não pode passar da
  `quantidade` em estoque (`422` com o estoque atual no `detail`) e é
  ignorada quando o material é do solicitante. A API desconta de
  `materiais.quantidade` do item `producao.material.id` e **soma** em
  `producao.material.quantidade_usada`, porque, numa nova conclusão depois
  de um ajuste, o gasto se acumula. O evento "Disponível para retirada"
  termina com "Material usado: 0,5 kg de PLA · Branco (baixado do estoque
  de doação)." Se o item tiver sido removido do estoque, só registre a
  quantidade.
- Efeito: `status="Pronta para retirada"`; grava `retirada` (cópia do
  endereço em texto) e limpa `ajuste`. Gera **automaticamente** o evento
  `{"tipo": "Retirada", "titulo": "Disponível para retirada", "descricao":
  "A produção foi concluída e a peça está disponível para retirada em
  Unidade Centro: Praça da Sé, 100 — Térreo, Sé, São Paulo/SP, CEP 01001-000.
  Instruções: ..."}`. Resposta: a solicitação.

### `POST /api/solicitacoes/{protocolo}/aprovar` 🆕 (organização solicitante)
Sem corpo. Só quando `Pronta para retirada` (senão `409`) e só pela
solicitante dona (senão `403`). `status="Concluída"` e evento
`{"tipo": "Aprovação", "titulo": "Peça aprovada"}`.

### `POST /api/solicitacoes/{protocolo}/reprovar` 🆕 (organização solicitante)
```json
{ "motivo": "O encaixe ficou apertado; aumentar 5 mm na circunferência." }
```
`motivo` obrigatório, com pelo menos 10 e no máximo 1000 caracteres
(`422`). Mesmas condições do `aprovar`. O status volta para `Em produção`,
`retirada=null` e `ajuste={motivo, data, autor}`; gera o evento
`{"tipo": "Devolução", "titulo": "Devolvida para ajuste", "descricao":
"Motivo: ..."}`. O fabricante conclui de novo quando terminar o ajuste.

> Faça as três transições de forma atômica (`find_one_and_update` com o
> status esperado no filtro), como no aceite.

### `GET /api/solicitacoes/{protocolo}/arquivo3d` — download do anexo 3D 🆕
Devolve os **bytes do arquivo** enviado no campo `arquivo3d` (não é JSON).
Mesma regra de visibilidade do `GET /api/solicitacoes/{protocolo}` (inclui
fabricantes vendo um item da fila). Use a sessão por cookie; o navegador
faz a requisição na mesma origem.

- `200` com `Content-Type: application/octet-stream` (ou o MIME do
  upload), `Content-Length` e
  `Content-Disposition: attachment; filename*=UTF-8''<nome>`;
- `404` se não houver arquivo, com `detail` em texto.

O visualizador (three.js) abre **STL, OBJ e 3MF**. Para STEP/STP/IGES/IGS
mostra um aviso e oferece só o download. Por isso o back **não** precisa
converter nada. Exemplo em FastAPI, com o arquivo salvo em GridFS:

```python
@router.get("/api/solicitacoes/{protocolo}/arquivo3d")
async def baixar_arquivo3d(protocolo: str, sessao=Depends(sessao_atual)):
    s = await buscar_visivel(protocolo, sessao)        # mesma checagem do GET do detalhe
    if not s.get("arquivo3d"):
        raise HTTPException(404, "Esta solicitação não tem arquivo 3D.")
    arquivo = await fs.open_download_stream(s["arquivo3d"]["file_id"])
    return StreamingResponse(arquivo, media_type="application/octet-stream", headers={
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(s['arquivo3d']['nome'])}"})
```

### `GET /api/solicitacoes/{protocolo}/historico`
Lista em **ordem cronológica** (o front inverte para mostrar o mais recente primeiro):
```json
[
  { "data": "03/11/2026 10:15", "tipo": "Criação", "titulo": "Solicitação criada",
    "descricao": "Solicitação registrada por Centro de Reabilitação Exemplo e enviada para a fila de novas solicitações.",
    "autor": "Marina Alves (Centro de Reabilitação Exemplo)" },
  { "data": "03/11/2026 11:02", "tipo": "Atribuição", "titulo": "Aceita por FabLab Exemplo",
    "descricao": "A solicitação saiu da fila e virou demanda do parceiro.", "autor": "Rafael Lima (FabLab Exemplo)" }
]
```
`tipo`: `Criação`, `Atribuição`, `Status`, `Edição`, `Comentário`, `Anexo`, `Retirada` 🆕, `Aprovação` 🆕, `Devolução` 🆕.

### `POST /api/solicitacoes/{protocolo}/historico`
`{"tipo": "Comentário" | "Anexo", "mensagem": "..."}` ou multipart com
`tipo`, `mensagem` e `arquivo`. 🆕 A tela não tem mais o seletor "Tipo de registro": o front manda `tipo="Anexo"` quando há arquivo e `"Comentário"` quando não há. O back pode até ignorar o campo e decidir pela presença do arquivo. `data` e `autor` vêm da sessão. Resposta: o evento criado.

🆕 Eventos com arquivo trazem também `"anexo": {"nome": "...", "url": "/api/solicitacoes/{protocolo}/anexos/{anexo_id}"}`
(em `GET .../historico` e na resposta do `POST`). A `url` baixa o arquivo
(mesma regra de visibilidade da solicitação); o front mostra um link
"Baixar anexo" no evento. Extensão deste back-end — ver `docs/backend.md`, seção 13.

### `POST /api/contato` 🆕 (formulário "Fale conosco", sem login)
`{"primeiroNome", "segundoNome", "email", "assunto", "mensagem"}` → `200 {"message": "..."}`.
Envia a mensagem por e-mail para a equipe. Erros: `422` (campo vazio/e-mail
inválido), `502` (falha no envio). Detalhes em `docs/backend.md`, seção 15.

### Página de detalhes: fluxo da solicitação
A linha e as bolinhas do "Fluxo da solicitação" são calculadas no front a
partir de `status`: `Aberta`=1, `Em análise`=2, `Em produção`=3 e
`Concluída` (tudo concluído). Basta o back mandar um dos quatro valores.

### `GET /api/parceiros` 🆕 (página "Parceiros de manufatura" refeita)
```json
[
  { "id": "o2", "nome": "FabLab Exemplo", "cidade": "São Paulo - SP",
    "status": "Disponível", "impressoras": 3, "impressoras_livres": 1,
    "tecnologias": "FDM, SLA", "materiais": "PLA, Resina padrão, TPU",
    "emProducao": 1, "concluidas": 1, "concluidas_com_voce": 1,
    "lista_impressoras": [ { "nome": "Bancada 1", "modelo": "Prusa MK4", "tecnologia": "FDM",
                             "volume": "250 × 210 × 220 mm", "materiais": "PLA, PETG, TPU", "status": "Disponível" } ],
    "materiais_doacao": [ { "material": "PLA", "tipo": "Filamento", "cor": "Branco", "quantidade": 12.5,
                            "unidade": "kg", "situacao": "Disponível" } ],
    "enderecos": [ { "nome": "Sede", "cidade": "São Paulo/SP", "endereco": "Avenida Paulista, 1000 — Sala 12, …" } ],
    "contato": { "email": "fablab@exemplo.test", "telefone": "(11) 3000-2000" } }
]
```
Tudo é **calculado**, não digitado pelo parceiro:
- `status`: `Disponível` se há impressora `Disponível`; `Capacidade limitada`
  se há impressoras ativas, mas todas ocupadas ou em manutenção;
  `Indisponível` se não há impressora ativa;
- `impressoras` / `impressoras_livres`: as que não estão `Inativa` / as que
  estão `Disponível`;
- `materiais`: materiais com quantidade > 0 no estoque de doação;
- `concluidas_com_voce`: concluídas para a organização da sessão.

Só aparecem fabricantes ativos.

---

## 6. Rotas novas desta rodada

### 6.1 Administração de organizações 🆕 (`html/admin.html`)

**Autorização (todas as rotas):** o usuário da sessão precisa ter, em
`{org_id}`, vínculo `role="admin"` **e** `status="active"`, e a
organização precisa estar `active`. Caso contrário, `403`. A tela só
aparece para admins, mas isso é conveniência — **a checagem é do back-end**.

#### `GET /api/organizations/{org_id}` — dados de cadastro 🆕
```json
{
  "id": "o2", "nome": "FabLab Exemplo", "tipo": "fabricante", "status": "active",
  "cnpj": "45.997.418/0001-53",
  "email_institucional": "fablab@exemplo.test", "telefone_institucional": "(11) 3000-2000",
  "enderecos": [
    { "id": "o2-sede", "nome": "Sede", "cep": "01310-100", "logradouro": "Avenida Paulista", "numero": "1000",
      "complemento": "Sala 12", "bairro": "Bela Vista", "cidade": "São Paulo", "uf": "SP" },
    { "id": "o2-centro", "nome": "Unidade Centro", "cep": "01001-000", "logradouro": "Praça da Sé", "numero": "100",
      "complemento": "Térreo", "bairro": "Sé", "cidade": "São Paulo", "uf": "SP" }
  ]
}
```

🆕 **`enderecos`** substitui o antigo `endereco` (objeto único). **Só
existe para fabricantes**: para `tipo="organizacao"` é sempre `[]`. O admin
da solicitante não vê essa seção, e o `PATCH` ignora o campo. Uma
organização pode ter vários locais de retirada. O fabricante escolhe um
deles ao concluir cada produção.

#### `PATCH /api/organizations/{org_id}` — editar dados 🆕
Corpo parcial com `nome`, `cnpj`, `email_institucional`,
`telefone_institucional` e/ou `enderecos` (🆕 **lista completa**, que
substitui a anterior). Itens com `id` existente são atualizados, itens sem
`id` são criados (o back gera o id) e os ausentes são removidos. Se um
endereço removido estiver em uma `retirada`, nada muda, porque a retirada
guarda uma cópia em texto. **`tipo` e `status` não são editáveis.** Resposta: o
objeto atualizado (o front atualiza o nome no cabeçalho).

| Regra | Erro |
|---|---|
| `nome` não vazio | `422` |
| `cnpj` com dígitos verificadores válidos | `422` |
| `cnpj` único entre organizações não removidas | `409` |
| `email_institucional` válido; `telefone_institucional` não vazio | `422` |
| cada item de `enderecos`: `nome` + CEP, rua, número, bairro, cidade e UF (complemento opcional) | `422` |
| `nome` dos endereços sem repetição | `422` |
| fabricante: pelo menos 1 endereço | `422` |

#### `DELETE /api/organizations/{org_id}` — remover organização 🆕
A tela exige que o admin digite o nome da organização para habilitar o botão.

> ⚠️ **Divergência da implementação real** (a pedido do usuário): em vez do
> soft delete descrito abaixo, a implementação atual apaga de verdade a
> organização e seus vínculos/materiais/impressoras (hard delete). Isso não
> quebra o histórico porque o nome da organização já é salvo junto de cada
> solicitação no momento da criação, não resolvido ao vivo. Ver
> `docs/backend.md`, seção 11, para os detalhes e o teste feito.

- **Bloqueio (`409`)** se houver trabalho em andamento. Para organização
  solicitante: solicitações com status diferente de `Concluída`. Para
  fabricante: demandas `Em análise`, `Em produção` ou `Pronta para retirada`. O `detail` deve
  dizer quantas e quais, por exemplo: *"Não é possível remover: há 2
  solicitação(ões) em andamento (#0007, #0006). Conclua ou devolva à fila
  antes."*
- **Sem bloqueio:** marque a organização como `status="removed"`
  (soft delete, para preservar o histórico das solicitações concluídas) e
  encerre **todos** os vínculos dela (`status="removed"`). Revogue as
  sessões dos usuários que ficarem sem outro vínculo ativo e remova as
  impressoras e os materiais dela. Resposta `204`.
- A organização removida some das buscas (`GET /api/organizations`), de
  `GET /api/parceiros` e da fila. Os membros não conseguem mais entrar
  (`403`, sem vínculo ativo).
- Depois do `204`, o front chama `POST /api/auth/logout` e vai para `/index.html`.

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

### 6.3 Impressoras 🆕 (`html/fabricator/impressoras.html`)

O fabricante registra o parque de impressoras da própria organização.
Esse cadastro alimenta `impressoras`/`tecnologias` de `GET /api/parceiros`.

#### Objeto `Impressora`
```json
{
  "id": "i1",
  "nome": "Bancada 1",
  "modelo": "Prusa MK4",
  "tecnologia": "FDM",
  "largura_mm": 250,
  "profundidade_mm": 210,
  "altura_mm": 220,
  "materiais": "PLA, PETG, TPU",
  "status": "Disponível",
  "observacoes": "Bico 0,4 mm",
  "atualizado_em": "2026-11-02T10:00:00-03:00"
}
```

| Campo | Regra |
|---|---|
| `nome` | obrigatório, ≤ 80 (identificação interna, ex.: "Bancada 1") |
| `modelo` | opcional, ≤ 80 |
| `tecnologia` | `FDM`, `SLA`, `DLP`, `SLS`, `Outra` |
| `largura_mm`, `profundidade_mm`, `altura_mm` | opcionais; inteiros de 1 a 5000 ou `null` |
| `materiais` | opcional, ≤ 200 (texto livre, ex.: "PLA, PETG") |
| `status` | `Disponível`, `Em uso`, `Em manutenção`, `Inativa` |
| `observacoes` | opcional, ≤ 500 |
| `atualizado_em` | definido pelo servidor a cada escrita (ISO 8601) |

#### Rotas (só membros ativos de organizações `fabricante`; outras recebem `403`)

| Método | Caminho | Comportamento |
|---|---|---|
| GET | `/api/impressoras` | Impressoras da organização da sessão. |
| POST | `/api/impressoras` | Cria. Resposta `201` + `Impressora`. |
| PATCH | `/api/impressoras/{id}` | Corpo parcial. `404` se for de outra organização. |
| DELETE | `/api/impressoras/{id}` | `204`. |

Pydantic:
```python
from typing import Literal, Optional
from pydantic import BaseModel, Field

Tecnologia = Literal["FDM", "SLA", "DLP", "SLS", "Outra"]
StatusImpressora = Literal["Disponível", "Em uso", "Em manutenção", "Inativa"]

class ImpressoraEntrada(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    modelo: str = Field(default="", max_length=80)
    tecnologia: Tecnologia
    largura_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    profundidade_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    altura_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    materiais: str = Field(default="", max_length=200)
    status: StatusImpressora = "Disponível"
    observacoes: str = Field(default="", max_length=500)
```
(Para o `PATCH`, use o mesmo modelo com todos os campos `Optional`.)

Coleção `impressoras`: ver [`database.md`](./database.md).

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

- **Histórico → Relatórios:** resolvido. `html/client/historico.html` só
  redireciona para `relatorios.html`, que usa `GET /api/solicitacoes`. Se o
  volume crescer, vale paginar ou criar `GET /api/relatorios?de=&ate=&status=`
  com os indicadores já calculados.
- **Baixa no estoque:** resolvido. Ao concluir uma produção com material
  doado, o front pede `quantidade_usada` e a API desconta de `materiais`
  (ver `concluir-producao`).
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
- **Notificação aos parceiros** quando uma solicitação entra na fila: a
  tela de envio diz que ela "já está visível para todos os parceiros", o
  que já é verdade pela regra da fila. Aviso por e-mail é opcional.
- **Prazo máximo na fila:** não há regra para solicitações que ninguém
  aceita. Vale combinar (ex.: alerta à organização solicitante depois de N dias).

---

## 9. Checklist de entrega do back-end

- [ ] `GET /api/me` com `user.id`, `user.organizacao` e `memberships[].{org_id, organization, organization_type, organization_status, role, membership_status}`
- [ ] Erros sempre com `detail` em string (inclusive 422 — §1.1)
- [ ] `POST /api/auth/register`: organização nova já ativa + vínculo admin + sessão aberta + `acesso_liberado: true`; organização existente com vínculo pendente + `acesso_liberado: false`
- [ ] `POST /api/solicitacoes` aceitando JSON **e** multipart (`arquivo3d`), criando com `status="Aberta"` e sem fabricante
- [ ] `GET /api/solicitacoes/{protocolo}/arquivo3d` devolvendo os bytes do anexo (mesma visibilidade do detalhe); `arquivo3d.url` opcional na resposta
- [ ] `GET /api/fila` para fabricantes e visibilidade da §5 (inclusive detalhe de itens da fila)
- [ ] `POST .../aceitar` **atômico** (`409` para quem chega depois) e `POST .../devolver`
- [ ] `PATCH /api/solicitacoes/{protocolo}` só para o solicitante editar campos; **nenhuma** mudança de status pelo `PATCH`
- [ ] `atribuido` como string ou `null` na resposta
- [ ] CRUD de `/api/impressoras` restrito ao fabricante dono
- [ ] Início da produção: `iniciar-producao` (impressora + origem do material), `Aguardando material` + `material-recebido`, `producao` na resposta e status da impressora acompanhando
- [ ] `concluida_em` na solicitação e `GET /api/parceiros` com todos os campos calculados (disponibilidade, impressoras livres, materiais, locais, contato, concluídas)
- [ ] Baixa no estoque: `concluir-producao` com `quantidade_usada` quando o material é doado (`422` se faltar ou passar do estoque) e soma em `producao.material.quantidade_usada`
- [ ] Fim do fluxo: `concluir-producao` (escolha do endereço e evento automático "Disponível para retirada"), `aprovar` (única forma de chegar a `Concluída`) e `reprovar` (motivo, volta para `Em produção`), além de `GET /api/organizacao/enderecos`
- [ ] Organização com **lista** `enderecos` (o cadastro cria a "Sede"; o PATCH substitui a lista)
- [ ] Cadastro com `endereco` (só fabricante, obrigatório; ignorado para solicitante) e `GET/PATCH/DELETE /api/organizations/{org_id}` só para admin ativo, com `409` ao remover se houver trabalho em andamento
- [ ] Rotas de administração com checagem de admin ativo, sem auto-alteração e sem deixar a organização sem admin
- [ ] `DELETE .../members/{id}` revogando as sessões do usuário removido
- [ ] CRUD de `/api/materiais` com visibilidade por tipo de organização e `situacao` calculada
- [ ] Estáticos servidos na mesma origem (§7)
- [ ] Testar cada tela da §3 no navegador com o servidor real
