# Banco de dados — MongoDB Atlas

> O banco **já existe no MongoDB Atlas**. Este documento descreve o que o
> front-end precisa que a API consiga ler e gravar. Use-o como **checklist
> de conferência** contra as coleções atuais: o que estiver aqui e não
> existir lá (coleção, campo ou índice) precisa ser criado ou migrado.
> Os formatos que a API devolve (JSON) estão em
> [`integracao-backend.md`](./integracao-backend.md). Aqui está o que é
> **guardado**.
>
> Convenções: `_id` é `ObjectId`, e as referências (`*_id`) também. Datas
> são `datetime` em UTC; o front recebe `"dd/mm/aaaa"` ou
> `"dd/mm/aaaa hh:mm"`, e a formatação é feita na API. Campos marcados
> **derivado** não são guardados: a API calcula na resposta.

## Visão geral

| Coleção | Para quê | Novidade desde o último commit |
|---|---|---|
| `users` | contas | — |
| `organizations` | organizações solicitantes e fabricantes | `enderecos` (lista) no lugar de `endereco`; `status="removed"` |
| `memberships` | vínculo usuário ↔ organização (papel e aprovação) | — |
| `sessions` | sessões de login | — |
| `email_codes` | troca de e-mail | — |
| `solicitacoes` | solicitações, com o `historico` embutido | status novos, `producao`, `retirada`, `ajuste`, `concluida_em` |
| `impressoras` | impressoras de cada fabricante | coleção nova |
| `materiais` | estoque de materiais para doação de cada fabricante | coleção nova |
| GridFS `arquivos` (ou storage de objetos) | arquivos 3D e anexos do histórico | download por `GET .../arquivo3d` |

---

## `users`

| Campo | Tipo | Observação |
|---|---|---|
| `nome`, `sobrenome` | string | |
| `email` | string | **índice único** (guardar em minúsculas) |
| `password_hash` | string | Argon2, nunca a senha |
| `telefone` | string | opcional |
| `photo`, `photo_mime` | binário, string | opcional, até 2 MB |
| `created_at` | datetime | |

## `organizations`

| Campo | Tipo | Observação |
|---|---|---|
| `name` | string | |
| `cnpj` | string | dígitos verificadores válidos; **único entre organizações não removidas** (índice único parcial com `status != "removed"`) |
| `type` | `"organizacao"` \| `"fabricante"` | **não editável** |
| `institutional_email`, `phone` | string | |
| `enderecos` | lista | **só fabricante** (pelo menos 1). Solicitante: sempre `[]`. Ver abaixo |
| `status` | `"active"` \| `"removed"` | `removed` = soft delete (o admin removeu). `pending` só em dados legados |
| `created_by` | ObjectId → `users` | quem cadastrou (vira admin) |
| `created_at`, `updated_at` | datetime | |

Cada item de `enderecos` é um **local de retirada** (e de entrega de
material):

```json
{ "id": "string única dentro da org", "nome": "Sede", "cep": "01310-100", "logradouro": "Avenida Paulista",
  "numero": "1000", "complemento": "Sala 12", "bairro": "Bela Vista", "cidade": "São Paulo", "uf": "SP" }
```

- O endereço do cadastro vira o primeiro item, com `nome="Sede"`.
- `nome` é obrigatório e não pode se repetir dentro da organização. Os
  outros campos são obrigatórios, exceto `complemento`.
- A "cidade" exibida em Parceiros vem do **primeiro** endereço
  (`"São Paulo - SP"`).

**Derivados** (não guardar): disponibilidade do parceiro, impressoras
livres, tecnologias e materiais disponíveis. São calculados a partir de
`impressoras` e `materiais` (ver `GET /api/parceiros`).

## `memberships`

| Campo | Tipo | Observação |
|---|---|---|
| `user_id`, `org_id` | ObjectId | **índice composto único** |
| `role` | `"admin"` \| `"member"` | quem cria a organização nasce `admin` |
| `status` | `"pending"` \| `"active"` \| `"rejected"` \| `"removed"` | organização nova: `active` na hora; ingresso em existente: `pending` até um admin aprovar |
| `job_title`, `justification` | string | do cadastro |
| `created_at` | datetime | |
| `approved_by`, `approved_at` | ObjectId, datetime | `approved_at` é devolvido como `joined_at` |
| `updated_by`, `updated_at` | ObjectId, datetime | última mudança de papel ou remoção (auditoria) |

Remover um membro, ou remover a organização, marca `status="removed"`; não
apaga o documento. A organização não pode ficar sem nenhum admin ativo.

## `sessions` e `email_codes`

- `sessions`: `user_id`, `token_hash` (SHA-256 do token do cookie) e
  `expires_at`, com **índice TTL**. Revogue as sessões ao trocar a senha ou
  o e-mail, ao remover o membro e ao remover a organização.
- `email_codes`: `user_id`, `email`, `code_hash` (HMAC), `created_at`,
  `expires_at` (TTL) e `attempts`. Um pedido por usuário.

## `solicitacoes`

| Campo | Tipo | Observação |
|---|---|---|
| `protocolo` | string `"#NNNN"` | **índice único**; sequencial (contador em coleção `counters` ou similar) |
| `solicitacao` | string | título |
| `requerente_id` | ObjectId → `organizations` (`organizacao`) | |
| `fabricante_id` | ObjectId → `organizations` (`fabricante`) ou `null` | `null` = na fila global; preenchido no aceite |
| `prioridade` | `"Baixa"` \| `"Média"` \| `"Alta"` | |
| `status` | ver fluxo abaixo | |
| `categoria`, `material`, `descricao` | string | `material` é o desejado pelo solicitante (texto livre) |
| `abertura` | datetime | |
| `prazo` | datetime ou `null` | `null` aparece como "A definir" |
| `arquivo3d` | objeto ou `null` | `{nome, tamanho_bytes, formato, file_id}`; `file_id` aponta para GridFS ou storage |
| `producao` | objeto ou `null` | preenchido em "Iniciar produção" (ver abaixo) |
| `retirada` | objeto ou `null` | preenchido em "Concluir produção" |
| `ajuste` | objeto ou `null` | última devolução para ajuste |
| `concluida_em` | datetime ou `null` | quando o solicitante aprova a peça |
| `ultima_atualizacao` | datetime | |
| `historico` | lista embutida | ver abaixo |

**Fluxo de `status`:**

```
Aberta (fila) → Em análise → [Aguardando material] → Em produção → Pronta para retirada → Concluída
                     │ devolver à fila                    ▲ reprovar (ajuste) ─┘   aprovar (só o solicitante)
                     ▼
                  Aberta
```

`Aguardando material` só existe quando o material é fornecido pelo
solicitante. Cada transição tem rota própria e deve ser **atômica**:
`find_one_and_update` com o status esperado no filtro.

**`producao`:**

```json
{ "impressora": { "id": "<ObjectId impressora>", "nome": "Bancada 1", "modelo": "Prusa MK4", "tecnologia": "FDM" },
  "material": { "origem": "doacao", "id": "<ObjectId material>", "nome": "PLA · Branco", "tipo": "Filamento",
                "unidade": "kg", "quantidade_usada": 0.5 } }
```

```json
{ "impressora": { ... },
  "material": { "origem": "solicitante", "nome": "500 g de TPU 95A, preto", "especificacao": "500 g de TPU 95A, preto",
                "entrega": { "local": "Sede", "endereco": "<texto>" }, "recebido_em": null } }
```

- Impressora e material ficam como **cópia resumida** (além do id), para o
  histórico não mudar se a impressora ou o material forem editados ou
  removidos.
- `quantidade_usada` acumula cada conclusão. Se a peça voltar para ajuste e
  for concluída de novo, soma.

**`retirada`:**
`{local, endereco (texto copiado do endereço escolhido), instrucoes, parceiro, telefone, data}`.

**`ajuste`:**
`{motivo, data, autor}`. Fica até a próxima conclusão da produção.

**`historico`:** um item por evento, em ordem cronológica:

| Campo | Observação |
|---|---|
| `data` | datetime |
| `tipo` | `Criação`, `Atribuição`, `Status`, `Edição`, `Comentário`, `Anexo`, `Retirada`, `Aprovação`, `Devolução` |
| `titulo`, `descricao` | texto mostrado na linha do tempo |
| `autor_id`, `autor` | usuário + texto "Nome (Organização)" copiado no momento |
| `anexo` | opcional, mesmo formato de `arquivo3d` |

Os eventos de status (aceite, produção iniciada, aguardando material,
material recebido, disponível para retirada, aprovação, devolução) são
gerados **pela API**. Comentários e anexos vêm de
`POST .../historico`.

**Índices recomendados:**
- `{protocolo: 1}`, único;
- `{status: 1, fabricante_id: 1}`, para a fila e as demandas;
- `{requerente_id: 1, abertura: -1}`, para a lista e os relatórios do solicitante;
- `{fabricante_id: 1, status: 1}`, para os contadores do parceiro.

## `impressoras`

| Campo | Tipo | Observação |
|---|---|---|
| `organization_id` | ObjectId → `organizations` (`fabricante`) | índice |
| `nome`, `modelo` | string | |
| `tecnologia` | `FDM` \| `SLA` \| `DLP` \| `SLS` \| `Outra` | |
| `largura_mm`, `profundidade_mm`, `altura_mm` | int ou `null` | volume de impressão |
| `materiais` | string | materiais compatíveis (texto livre) |
| `status` | `Disponível` \| `Em uso` \| `Em manutenção` \| `Inativa` | a API muda para `Em uso` ao iniciar a produção e volta para `Disponível` ao concluir (se não houver outra produção nela) |
| `observacoes` | string | |
| `created_at`, `updated_at`, `updated_by` | | |

## `materiais` (estoque para doação)

| Campo | Tipo | Observação |
|---|---|---|
| `organization_id` | ObjectId → `organizations` (`fabricante`) | índice |
| `material` | string (≤ 60) | ex.: PLA, PETG |
| `tipo` | `Filamento` \| `Resina` \| `Pó` \| `Outro` | |
| `cor` | string | |
| `quantidade` | número ≥ 0 | **baixada pela API** ao concluir uma produção com material doado (`quantidade_usada`) |
| `unidade` | `kg` \| `g` \| `L` \| `mL` \| `un` | |
| `estoque_minimo` | número ou `null` | |
| `observacoes` | string | |
| `created_at`, `updated_at`, `updated_by` | | |

`situacao` (`Disponível`, `Estoque baixo` ou `Esgotado`) é **derivada** de
`quantidade` e `estoque_minimo`. A solicitante lê os itens de todos os
fabricantes ativos; o fabricante lê e escreve só os seus.

## Arquivos

Os arquivos 3D (`stl, obj, 3mf, step, stp, iges, igs`, até 50 MB) e os anexos
do histórico ficam em GridFS (bucket `arquivos`) ou em storage de objetos
privado. O documento guarda só a referência (`file_id`). O download passa
pela API (`GET /api/solicitacoes/{protocolo}/arquivo3d`), que confere a
visibilidade.

## Remoção de organização (soft delete)

Remover uma organização faz o seguinte:
- marca `organizations.status="removed"`;
- marca todos os `memberships` dela como `removed`;
- revoga as sessões de quem ficou sem vínculo ativo;
- remove os itens dela em `impressoras` e `materiais`;
- mantém `solicitacoes`, para preservar o histórico.

É bloqueada (`409`) se houver trabalho em andamento:
- solicitante: qualquer status diferente de `Concluída`;
- fabricante: `Em análise`, `Aguardando material`, `Em produção` ou
  `Pronta para retirada`.

## Notas

- Crie os índices na inicialização da API, ou por migração.
- Em produção, aplique migrações controladas e mantenha backups.
- Não guarde senhas, tokens ou códigos em texto puro.
- Se no Atlas ainda houver `organizations.endereco` (objeto único), migre-o
  para `enderecos: [{id, nome: "Sede", ...endereco}]` nos fabricantes e
  `[]` nas solicitantes.
