# Guia de implementação do back-end (FastAPI + MongoDB)

Este arquivo é um ponteiro, não uma cópia. O guia completo da
implementação real do back-end — arquitetura de pastas, como rodar
localmente, autenticação/sessão, o que foi simplificado e por quê, mapa
de rotas, e as correções feitas depois do teste manual do fluxo completo
— está em **[`../backend/README.md`](../backend/README.md)**.

Ele ficou dentro de `backend/` (e não aqui em `docs/`) de propósito: é
referenciado por mais de dez comentários no próprio código-fonte
(`backend/*.py`), então mantê-lo ao lado do código evita que os
comentários apontem para um caminho errado. Esta página existe só para
que quem está navegando por `docs/` encontre o caminho certo.

Veja também:
- [`integracao-backend.md`](./integracao-backend.md) — o contrato que o
  front-end espera (pode ter pequenas divergências já anotadas em
  relação à implementação real; procure por "⚠️ Divergência").
- [`database.md`](./database.md) — modelo de dados (coleções e índices).
- [`variante-sqlite-local.md`](./variante-sqlite-local.md) — contexto
  sobre a outra implementação de back-end (FastAPI + SQLite) que existe
  numa branch separada, ainda não reconciliada com esta.
