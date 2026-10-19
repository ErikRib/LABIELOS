# Banco de dados — MongoDB Atlas

## Coleções

**users**: `nome`, `sobrenome`, `email` (índice único), `password_hash` (Argon2), `telefone`, `photo` (opcional), `photo_mime`, `created_at`.

**organizations**: `name`, `cnpj` (único, se presente), `type` (`organizacao` ou `fabricante`), `institutional_email`, `phone`, `status` (`pending` ou `active`), `requested_by`, `created_at`.

**memberships**: `user_id`, `org_id` (índice composto único), `role` (`requested_admin`, `admin`, `member`), `status` (`pending`, `active`, `rejected`), `justification`, `job_title`, `created_at`.

**sessions**: `user_id`, `token_hash`, `expires_at` (índice TTL). O cookie contém um token aleatório; o banco armazena somente seu hash SHA-256.

**email_codes**: `user_id`, `email`, `code_hash`, `created_at`, `expires_at` (TTL), `attempts`. Um pedido por usuário.

## Relações

Um usuário pode ter vários vínculos, cada um associado a uma organização. Um administrador de organização só aprova membros da própria organização. Uma nova organização aguarda verificação externa antes de ativação.

## Endereços e unidades — etapa futura

Planejado: coleção **locations** com `organization_id`, `label`, `type` (administrativo, fabricação, retirada), endereço estruturado, coordenadas opcionais, horário e estado ativo. Isso evita limitar um FabLab a um único endereço e permite diferentes pontos de retirada.

## Notas

Índices são criados na inicialização da API. Em produção, aplicar migrações controladas e backups. Não armazenar senhas, tokens ou códigos de confirmação em texto puro.
