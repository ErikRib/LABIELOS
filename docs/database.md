# Banco de dados — MongoDB Atlas

## Coleções

**users**: `nome`, `sobrenome`, `email` (índice único), `password_hash` (Argon2), `telefone`, `photo` (opcional), `photo_mime`, `created_at`.

**organizations**: `name`, `cnpj` (único, se presente), `type` (`organizacao` ou `fabricante`), `institutional_email`, `phone`, `status` (`pending` ou `active`), `requested_by`, `created_at`.

**memberships**: `user_id`, `org_id` (índice composto único), `role` (`requested_admin`, `admin`, `member`), `status` (`pending`, `active`, `rejected`, `removed`), `justification`, `job_title`, `created_at`, `approved_by` e `approved_at` (preenchidos na aprovação — `approved_at` é devolvido como `joined_at` na lista de membros), `updated_by`/`updated_at` (última mudança de papel ou remoção, para auditoria). Remoção pela tela de administração marca `status=removed` em vez de apagar o documento.

**sessions**: `user_id`, `token_hash`, `expires_at` (índice TTL). O cookie contém um token aleatório; o banco armazena somente seu hash SHA-256.

**email_codes**: `user_id`, `email`, `code_hash`, `created_at`, `expires_at` (TTL), `attempts`. Um pedido por usuário.

**solicitacoes**: `protocolo` (string, formato `#NNNN`, sequencial, único — pode ser gerado por um contador ou pelo próprio `_id`, mas o front-end espera esse formato), `solicitacao` (título), `requerente_id` (ref. `organizations`, tipo `organizacao`), `atribuido` (array de `organization_id`, tipo `fabricante` — uma solicitação pode ter mais de um parceiro atribuído), `prioridade` (`Baixa`\|`Média`\|`Alta`), `status` (`Aberta`\|`Aguardando aceite`\|`Em análise`\|`Em produção`\|`Concluída`\|`Recusada`), `categoria`, `abertura` (datetime), `prazo` (datetime ou `"A definir"`), `material`, `descricao`, `arquivo3d` (objeto `{nome, tamanho, formato, storage_path}` ou `null`), `ultima_atualizacao` (datetime), `historico` (array embutido — ver abaixo).

A API (`GET /api/solicitacoes`) deve **resolver** `requerente_id`/`atribuido` para os nomes das organizações na resposta (o front-end espera `requerente`/`atribuido` como texto, não como ids — ver `js/prototipo.js`), e decidir a visibilidade a partir da sessão: uma organização `organizacao` só vê as que ela criou; uma `fabricante` só vê as que têm seu `organization_id` em `atribuido`.

**Histórico (dentro de `solicitacoes.historico`, array embutido — mais simples que uma coleção separada, já que sempre é lido/gravado por protocolo)**: cada item tem `data` (datetime), `tipo` (`Criação`\|`Atribuição`\|`Status`\|`Edição`\|`Comentário`\|`Anexo`), `autor` (resolvido a partir da sessão no momento do registro — nome + organização, como já aparece hoje em `js/prototipo.js`), `titulo`, `descricao`, e `anexo` (opcional, mesmo formato de `arquivo3d`, quando `tipo` for `Anexo`).

**parceiros**: pode ser modelado como uma extensão de `organizations` (quando `type=fabricante` e `status=active`) com os campos de capacidade que faltam: `cidade`, `impressoras` (int), `tecnologias`, `materiais`. O campo `emProducao` (quantas solicitações desse parceiro estão com `status="Em produção"`) é dado derivado — recomenda-se calculá-lo numa agregação em vez de guardá-lo solto, para não ficar desatualizado.

**materiais** (materiais de impressão disponíveis para doação): `organization_id` (ref. `organizations`, tipo `fabricante` — índice), `material` (texto, ≤ 60), `tipo` (`Filamento`\|`Resina`\|`Pó`\|`Outro`), `cor`, `quantidade` (número ≥ 0), `unidade` (`kg`\|`g`\|`L`\|`mL`\|`un`), `estoque_minimo` (número ou `null`), `observacoes`, `created_at`, `updated_at`, `updated_by`.

`situacao` (`Disponível`\|`Estoque baixo`\|`Esgotado`) é **derivada** de `quantidade` e `estoque_minimo` — calcular na resposta, não guardar. `parceiro` e `cidade` na resposta vêm da organização dona (`organization_id`). A organização solicitante lê os itens de todos os fabricantes ativos; um fabricante só lê e escreve os seus. Formato da API em [`integracao-backend.md`](./integracao-backend.md), seção 6.2.

## Relações

Um usuário pode ter vários vínculos, cada um associado a uma organização. Um administrador de organização só aprova, promove ou remove membros da própria organização, não altera o próprio vínculo e não pode deixar a organização sem nenhum administrador ativo. Cada fabricante tem zero ou mais itens em `materiais`. Uma nova organização aguarda verificação externa antes de ativação.

## Endereços e unidades — etapa futura

Planejado: coleção **locations** com `organization_id`, `label`, `type` (administrativo, fabricação, retirada), endereço estruturado, coordenadas opcionais, horário e estado ativo. Isso evita limitar um FabLab a um único endereço e permite diferentes pontos de retirada.

## Notas

Índices são criados na inicialização da API. Em produção, aplicar migrações controladas e backups. Não armazenar senhas, tokens ou códigos de confirmação em texto puro.
