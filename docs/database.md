# Banco de dados — MongoDB Atlas

Este documento descreve as coleções que a API (`backend/`) lê e grava no
banco `labielos_db` do MongoDB Atlas. Os nomes de coleção e de campo abaixo
são os usados no código ([`backend/database.py`](../backend/database.py) e
rotas em `backend/routes/`). Os formatos que a API devolve (JSON) estão em
[`integracao-backend.md`](./integracao-backend.md); aqui está o que é
**guardado**.

Convenções: `_id` é `ObjectId`, e as referências (`*_id`) também, salvo
indicação contrária. Datas são `datetime` em UTC; o front recebe
`"dd/mm/aaaa"` ou `"dd/mm/aaaa hh:mm"`, e a formatação é feita na API.
Campos marcados **derivado** não são guardados: a API calcula na resposta.

## Visão geral

| Coleção | Para quê |
|---|---|
| `usuarios` | contas (identidade pessoal) |
| `organizacoes` | organizações solicitantes e fabricantes |
| `memberships` | vínculo usuário ↔ organização (papel e aprovação) |
| `sessoes` | sessões de login (cookie `labielos_session`) |
| `codigos_verificacao_cadastro` | código de confirmação de e-mail no cadastro |
| `codigos_recuperacao` | código de recuperação de senha |
| `solicitacoes` | solicitações, com o `historico` embutido |
| `contadores` | sequência que gera o protocolo público (`#0001`) |
| `impressoras` | impressoras de cada fabricante |
| `materiais` | estoque de materiais para doação de cada fabricante |
| `fotos_perfil` | foto de perfil de cada usuário |
| GridFS `arquivos` (`arquivos.files` + `arquivos.chunks`) | modelos 3D e anexos do histórico |

## Índices

Criados por [`backend/criar_indices.py`](../backend/criar_indices.py)
(pode ser executado mais de uma vez sem duplicar nada):

| Coleção | Índice | Motivo |
|---|---|---|
| `usuarios` | `email` (único) | login por e-mail |
| `organizacoes` | `cnpj` (único, parcial `status = "active"`) | CNPJ não se repete entre organizações ativas |
| `memberships` | `user_id`; `org_id` | vínculos de um usuário / de uma organização |
| `solicitacoes` | `protocolo` (único); `requerente_org_id`; `atribuido_org_id` | identificador público e filtros por organização |
| `materiais`, `impressoras` | `org_id` | recursos sempre filtrados pela organização dona |
| `sessoes` | `expira_em` (TTL) | sessão vencida some sozinha |
| `codigos_recuperacao`, `codigos_verificacao_cadastro` | `expira_em` (TTL) | código vencido some sozinho |

## `usuarios`

| Campo | Tipo | Observação |
|---|---|---|
| `nome`, `sobrenome` | string | |
| `email` | string | **índice único**, guardado em minúsculas |
| `senha_hash` | string | PBKDF2-SHA256 com sal individual (`pbkdf2$<sal>$<hash>`), nunca a senha |
| `telefone` | string | opcional |
| `foto_arquivo`, `foto_atualizada_em` | string, datetime | referência à foto em `fotos_perfil`; a data serve de cache-busting |
| `pendente_novo_email`, `pendente_codigo_email`, `pendente_codigo_expira` | string, string, datetime | só durante a troca de e-mail (código vale 15 min); removidos ao confirmar |
| `criado_em` | datetime | |

## `organizacoes`

| Campo | Tipo | Observação |
|---|---|---|
| `nome` | string | |
| `cnpj` | string | 14 dígitos; **único entre organizações ativas** |
| `tipo` | `"organizacao"` \| `"fabricante"` | `organizacao` = solicitante; **não editável** |
| `email_institucional`, `telefone_institucional` | string | |
| `enderecos` | lista | **só fabricante** (pelo menos 1). Solicitante: sempre `[]`. Ver abaixo |
| `status` | `"active"` | a remoção apaga o documento (ver "Remoção de organização") |
| `criado_em` | datetime | |

Cada item de `enderecos` é um **local de retirada** (e de entrega de
material):

```json
{ "id": "uuid", "nome": "Sede", "cep": "01310-100", "logradouro": "Avenida Paulista",
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
| `user_id`, `org_id` | ObjectId | indexados separadamente |
| `role` | `"admin"` \| `"member"` | quem cria a organização nasce `admin` |
| `status` | `"pending"` \| `"active"` \| `"rejected"` \| `"removed"` | organização nova: `active` na hora; ingresso em existente: `pending` até um admin aprovar |
| `job_title`, `justification` | string | do cadastro |
| `created_at`, `joined_at` | datetime | |
| `approved_by`, `approved_at` | ObjectId, datetime | quem aprovou ou recusou o ingresso |

Remover um membro, ou excluir a própria conta, marca `status="removed"`;
não apaga o documento. A organização não pode ficar sem nenhum admin ativo.

## `sessoes`

| Campo | Tipo | Observação |
|---|---|---|
| `_id` | string | o próprio token aleatório do cookie HttpOnly |
| `user_id` | ObjectId | |
| `criado_em`, `expira_em` | datetime | validade de 30 dias, **índice TTL** em `expira_em` |

As sessões são revogadas ao trocar a senha ou o e-mail e quando o usuário
fica sem nenhum vínculo ativo.

## `codigos_verificacao_cadastro` e `codigos_recuperacao`

| Campo | Tipo | Observação |
|---|---|---|
| `_id` | string | o e-mail (um código por e-mail) |
| `codigo` | string | 6 dígitos |
| `expira_em` | datetime | 10 minutos, **índice TTL** |
| `verificado` | bool | `true` depois que o código é conferido |

## `contadores`

Um documento `{_id: "solicitacoes", seq: <int>}`. Cada nova solicitação
incrementa `seq` de forma atômica (`find_one_and_update` com `$inc`) e o
valor vira o protocolo (`#0007`).

## `solicitacoes`

| Campo | Tipo | Observação |
|---|---|---|
| `protocolo` | string `"#NNNN"` | **índice único**; sequencial (coleção `contadores`) |
| `solicitacao` | string | título |
| `requerente_org_id`, `requerente_nome` | ObjectId → `organizacoes` (`organizacao`), string | o nome é cópia de respaldo; a API resolve o nome atual pelo id |
| `atribuido_org_id`, `atribuido_nome` | ObjectId → `organizacoes` (`fabricante`) ou `null`, string ou `null` | `null` = na fila global; preenchido no aceite |
| `prioridade` | `"Baixa"` \| `"Média"` \| `"Alta"` | |
| `status` | ver fluxo abaixo | |
| `categoria`, `material`, `descricao` | string | `material` é o desejado pelo solicitante (texto livre; `"A definir"` se vazio) |
| `abertura` | string `"dd/mm/aaaa"` | horário de Brasília |
| `prazo` | string `"dd/mm/aaaa"` ou `"A definir"` | |
| `arquivo3d` | objeto ou `null` | `{nome, formato, tamanho (texto, ex. "2.4 MB"), arquivo_id, content_type}`; `arquivo_id` aponta para o GridFS `arquivos` |
| `producao` | objeto ou `null` | preenchido em "Iniciar produção" (ver abaixo) |
| `retirada` | objeto ou `null` | preenchido em "Concluir produção" |
| `ajuste` | objeto ou `null` | última devolução para ajuste |
| `concluida_em` | string `"dd/mm/aaaa hh:mm"` ou `null` | quando o solicitante aprova a peça |
| `ultima_atualizacao` | string `"dd/mm/aaaa hh:mm"` | |
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
| `data` | string `"dd/mm/aaaa hh:mm"` (Brasília) |
| `tipo` | `Criação`, `Atribuição`, `Status`, `Edição`, `Comentário`, `Anexo`, `Retirada`, `Aprovação`, `Devolução` |
| `titulo`, `descricao` | texto mostrado na linha do tempo |
| `autor_user_id`, `autor_org_id`, `autor` | ids do autor + texto "Nome (Organização)" copiado como respaldo |
| `anexo` | opcional, `{id, nome, content_type}` (arquivo no GridFS) |

Os eventos de status (aceite, produção iniciada, aguardando material,
material recebido, disponível para retirada, aprovação, devolução) são
gerados **pela API**. Comentários e anexos vêm de
`POST .../historico`.

Índices: ver a seção "Índices" no início deste documento.

## `impressoras`

| Campo | Tipo | Observação |
|---|---|---|
| `org_id` | ObjectId → `organizacoes` (`fabricante`) | índice |
| `nome`, `modelo` | string | |
| `tecnologia` | `FDM` \| `SLA` \| `DLP` \| `SLS` \| `Outra` | |
| `largura_mm`, `profundidade_mm`, `altura_mm` | int ou `null` | volume de impressão |
| `materiais` | string | materiais compatíveis (texto livre) |
| `status` | `Disponível` \| `Em uso` \| `Em manutenção` \| `Inativa` | a API muda para `Em uso` ao iniciar a produção e volta para `Disponível` ao concluir (se não houver outra produção nela) |
| `observacoes` | string | |
| `atualizado_em` | string ISO 8601 (UTC) | |

## `materiais` (estoque para doação)

| Campo | Tipo | Observação |
|---|---|---|
| `org_id` | ObjectId → `organizacoes` (`fabricante`) | índice |
| `material` | string (≤ 60) | ex.: PLA, PETG |
| `tipo` | `Filamento` \| `Resina` \| `Pó` \| `Outro` | |
| `cor` | string | |
| `quantidade` | número ≥ 0 | **baixada pela API** ao concluir uma produção com material doado (`quantidade_usada`) |
| `unidade` | `kg` \| `g` \| `L` \| `mL` \| `un` | |
| `estoque_minimo` | número ou `null` | |
| `observacoes` | string | |
| `atualizado_em` | string ISO 8601 (UTC) | |

`situacao` (`Disponível`, `Estoque baixo` ou `Esgotado`) é **derivada** de
`quantidade` e `estoque_minimo`. A solicitante lê os itens de todos os
fabricantes ativos; o fabricante lê e escreve só os seus.

## Arquivos

Os arquivos 3D (`stl, obj, 3mf, step, stp, iges, igs`, até 200 MB cada) e os anexos
do histórico ficam em **GridFS, bucket `arquivos`** (coleções
`arquivos.files` e `arquivos.chunks`). A solicitação guarda a referência em
`arquivo3d.arquivo_id`; cada evento com anexo guarda
`anexo: {id, nome, content_type}`. O download passa pela API
(`GET /api/solicitacoes/{protocolo}/arquivo3d` e
`GET /api/solicitacoes/{protocolo}/anexos/{anexo_id}`), que confere a
visibilidade.

A foto de perfil (até 2 MB) fica na coleção **`fotos_perfil`**
(`_id` = id do usuário, `conteudo` em bytes, `mime`); o usuário guarda só
`foto_arquivo` e `foto_atualizada_em` (usado para cache-busting).

Nada é gravado em disco no servidor — assim, todas as máquinas que usam o
mesmo banco enxergam os mesmos arquivos (ver [`backend.md`](./backend.md),
seção 13). Registros antigos com `arquivo_disco` ainda são lidos de
`backend/uploads/` como respaldo.

## Remoção de organização (hard delete)

Remover uma organização (`DELETE /api/organizations/{org_id}`, só admin):
- **apaga** o documento em `organizacoes`;
- apaga todos os `memberships`, `impressoras` e `materiais` dela;
- revoga as sessões de quem ficou sem vínculo ativo;
- mantém `solicitacoes`, para preservar o histórico. Como a solicitação
  guarda os ids, o nome passa a aparecer como "Organização removida".

É bloqueada (`409`) se houver trabalho em andamento:
- solicitante: qualquer status diferente de `Concluída`;
- fabricante: `Em análise`, `Aguardando material`, `Em produção` ou
  `Pronta para retirada`.

## Notas

- Crie os índices na inicialização da API, ou por migração.
- Em produção, aplique migrações controladas e mantenha backups.
- Não guarde senhas, tokens ou códigos em texto puro.
- Registros antigos com `organizacoes.endereco` (objeto único) devem ser
  migrados para `enderecos: [{id, nome: "Sede", ...endereco}]` nos
  fabricantes e `[]` nas solicitantes.
