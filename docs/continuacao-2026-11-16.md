# LABIELOS — Retomada da sessão (16/11/2026)

> **Para quem abrir isso numa sessão nova do Claude Code, em outro
> computador:** leia este arquivo primeiro. Ele resume tudo que foi feito
> numa sessão longa de implementação do back-end e ajustes finos de
> front-end, pra você continuar sem precisar reconstruir o contexto do
> zero. Complementa `backend/README.md` (arquitetura/rotas) e
> `docs/integracao-backend.md` (contrato original do front).

## ⚠️ Antes de qualquer coisa: commit pendente

Tem uma quantidade grande de arquivos alterados **sem commit** (back-end
inteiro reescrito + vários ajustes de front). Rode isto antes de sair
mexendo em outro lugar, pra não arriscar perder trabalho ao copiar a pasta
pra outro PC:

```bash
cd "S:\Projeto Integrador\OUTROS\LABIELOS"
git add -A
git commit -m "Ajustes de UX, correção de nomes no histórico e lembrar de mim"
```

(Isso é só um commit local — não faz push a lugar nenhum.)

## O que é o projeto

Hub de manufatura aditiva (impressão 3D) conectando organizações que
precisam de peças (ex.: clínicas de reabilitação) a fabricantes parceiros.
Back-end **FastAPI + MongoDB Atlas**, front-end **HTML/CSS/JS puro**,
servidos juntos na mesma porta (a API serve os estáticos). Veja
`backend/README.md` pra arquitetura completa.

## Estado do banco (MongoDB Atlas)

- O cluster **antigo** (`cluster0.5o19og2.mongodb.net`) só tinha acesso de
  leitura — foi abandonado. O projeto usa agora um cluster **novo**,
  `LabielosCluster`, criado do zero nesta sessão, com `MONGO_URI` já
  configurada em `backend/.env` (não versionado, fica só na sua máquina —
  se for mexer em outro PC, **copie o `.env` junto**, ou configure de novo
  lá com a mesma `MONGO_URI`).
- **Network Access** do Atlas está em `0.0.0.0/0` (permite de qualquer
  IP) — necessário pro pacote portátil funcionar em outro computador/rede.
- Todas as solicitações de teste foram apagadas e o contador de protocolo
  foi zerado — a próxima solicitação criada nasce como `#0001`.

## O que foi implementado/corrigido nesta sessão (ordem cronológica)

1. **Back-end inteiro implementado do zero** (antes só havia um CRUD
   básico): autenticação por cookie, cadastro com confirmação de e-mail
   por código, recuperação de senha, perfil (editar dados, foto, trocar
   e-mail/senha, excluir conta), administração de organizações, fluxo
   completo de solicitações (fila global, aceitar, produção, retirada,
   aprovar/reprovar), materiais, impressoras, parceiros. Ver
   `backend/README.md` pra lista completa de rotas e simplificações
   assumidas (ex.: upload em disco em vez de GridFS, SMTP opcional com
   modo demonstração).
2. **Hard-delete de organização**: `DELETE /api/organizations/{id}` apaga
   de verdade (organização + memberships + materiais + impressoras), em
   vez de só marcar como removida.
3. **E-mails em HTML** (recuperação de senha e confirmação de cadastro).
4. **Reorganização de documentação**: só sobrou `README.md` solto na raiz
   do projeto; todo o resto consolidado em `docs/`.
5. **Bugs de UI corrigidos**:
   - Lista de sugestões (Material/Categoria) abrindo sozinha ao abrir
     modais (foco automático indevido).
   - Lista de sugestões cortada/desalinhada dentro de modais com rolagem
     interna (agora "escapa" com `position: fixed`, recalculada ao vivo).
   - Descrição longa na tela de detalhes ocupando a tela toda (agora
     recolhe com "Ver mais").
   - "Prioridade" com visual de `<select>` nativo, diferente das demais
     listas — criado `js/select-estilizado.js`, um componente que reveste
     qualquer `<select>` com o mesmo visual das listas de sugestão.
   - Navbar esticando com nome de usuário grande — agora trunca com
     reticências; o menu dropdown passou a ter a largura do botão.
   - Layout da tela de perfil com espaço em branco sobrando — nova
     3ª coluna em telas largas (≥1240px): "Organização" e "Excluir conta"
     saem de baixo de "Dados pessoais" e vão pro meio, ao lado de
     "Segurança da conta"; botão "Salvar alterações" fica ancorado no
     fim do card.
   - Status "organização: active; vínculo: active" (jargão técnico em
     inglês) virou texto natural: "organização ativa, vínculo ativo".
6. **Recarregamento automático da página** depois de qualquer ação que
   muda dados (perfil, organização, materiais, impressoras, aprovar
   solicitação, aceitar/devolver, etc.) — antes só "Dados pessoais" tinha
   isso.
7. **Nomes desatualizados no histórico**: antes, o nome de quem fez uma
   ação ficava "congelado" pra sempre no evento do histórico. Agora
   resolve **ao vivo** (busca o nome atual do usuário/organização), com o
   texto antigo servindo de respaldo só se o usuário/organização forem
   apagados depois. **Só vale pra eventos criados a partir de agora** —
   eventos antigos (de antes dessa correção) não têm como ser atualizados
   retroativamente, porque nunca gravaram o id de quem os criou.
8. **"Lembrar de mim" no login**: existia só visualmente, não fazia nada.
   Agora: marcado → cookie de 30 dias; desmarcado → cookie de sessão
   (some ao fechar o navegador). Testado e confirmado funcionando — se
   parecer que não funciona, confira se não é teste em janela anônima
   (cada "sessão" anônima nova pode isolar cookies, dependendo do
   navegador) ou se a porta do servidor mudou entre o login e o teste (o
   `run.py` escolhe a porta automaticamente, e cookie é por
   endereço+porta).
9. **Checklist de requisitos de senha** ("Pelo menos 8 caracteres" / "As
   duas senhas coincidem", com feedback ao vivo em verde) adicionada no
   cadastro e em "Alterar senha" do perfil — igual ao que já existia em
   "Esqueci minha senha". Componente CSS compartilhado:
   `.requisitos-senha` (em `css/components/forms.css`, duplicado em
   `css/pages/cadastro.css` porque a tela de cadastro não carrega
   `forms.css`).

## Pacote portátil

`dist/LABIELOS-portatil-2026-11-16.zip` (~45 MB) — Python embutido +
projeto completo + `.env` com a `MONGO_URI` real embutida (decisão
consciente, aceita pelo usuário, pra rodar sem configuração no PC do
professor). Só precisa de internet (banco é na nuvem). Para usar: extrair
em qualquer pasta e abrir `INICIAR.bat`. **Esse zip já está atualizado com
tudo da lista acima** — foi reconstruído a cada rodada de correção.

Se continuar mexendo no projeto a partir daqui, lembre de regenerar esse
zip antes de usar de novo (copiar os arquivos atualizados pra dentro dele,
ou gerar um novo).

## Pendências conhecidas / não resolvidas

- `tests/test_api.py`, `scripts/build_portable.py` e companhia pertencem a
  uma variante abandonada do projeto (FastAPI+SQLite, de outro membro da
  equipe, branch `origin/feature/backend-gustavo`) — não fazem parte do
  projeto atual (FastAPI+MongoDB) e não foram atualizados.
- Itens do checklist compartilhado com a equipe (ver o doc "LABIELOS —
  Checklist do Back-end" nos artifacts do Claude, se ainda acessível) que
  não foram todos resolvidos — vale reconferir.
- Nenhum teste automatizado novo foi escrito pro back-end atual.

## Como retomar

1. Rode o commit pendente (topo deste arquivo).
2. Confirme que `backend/.env` existe no computador novo com a
   `MONGO_URI` certa (não é versionado no git).
3. `cd backend && pip install -r requirements.txt` se for um ambiente
   Python novo.
4. `uvicorn main:app --reload` (de dentro de `backend/`) ou
   `python run.py` (da raiz do projeto).
5. Se for continuar pedindo ajustes à IA, pode apontar essa conversa ou
   só este arquivo — ele cobre o essencial do que já foi decidido e por
   quê.
