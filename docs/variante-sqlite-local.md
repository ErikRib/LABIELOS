# LABIELOS — variante local (FastAPI + SQLite)

> Este arquivo era `README_API.md`, na raiz do projeto. Movido para cá
> durante uma arrumação de documentação (ver `../README.md`, seção
> "Documentação"). O texto original tinha duas frases que se
> contradiziam ("sem MongoDB" logo seguida de "conecta... ao MongoDB
> Atlas") — resolvido abaixo: são duas implementações diferentes, de
> branches diferentes, não uma só.

Existem **duas implementações de back-end** neste projeto, em momentos
diferentes de maturidade:

1. **FastAPI + MongoDB Atlas** — a que está em uso em `backend/` na
   branch `main` hoje. Documentada em [`backend.md`](./backend.md),
   [`database.md`](./database.md) e, com mais detalhe de implementação,
   em [`backend.md`](./backend.md).
2. **FastAPI + SQLite** — uma versão local, sem dependência de nuvem,
   pensada para apresentação/demonstração offline, com pacote portátil
   (`../dist/*.zip`) e quatro contas de teste prontas. Documentada em
   [`apresentacao.md`](./apresentacao.md).

⚠️ **Essas duas vieram de branches diferentes e não foram unificadas.**
A SQLite foi desenvolvida em `feature/backend-gustavo` (nunca mesclada à
`main`); o `backend/app.py` que está de fato rodando hoje é o da
implementação MongoDB. Ver `backend.md`, seção 11, para
mais contexto. Antes de seguir qualquer um dos dois guias, confirme com
a equipe qual implementação vocês querem levar adiante.

**Comece em [`backend.md`](./backend.md)** para instalação, configuração, endpoints e limitações da versão MongoDB. Consulte [`database.md`](./database.md) para o modelo de dados.

Esta versão conecta **cadastro, login e perfil** à API FastAPI + MongoDB Atlas. Inclui solicitação de ingresso em organização existente, solicitação de nova organização e confirmação de troca de e-mail via SMTP configurado.

**Atualização:** os painéis da organização solicitante e do fabricante também deixaram de usar dados fixos no código — ver [`design-system.md`](./design-system.md), seção 10. Esta versão não está pronta para produção ou dados reais de saúde.
