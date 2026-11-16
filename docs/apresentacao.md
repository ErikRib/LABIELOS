# LABIELOS — demonstração com FastAPI e SQLite

Esta é a versão local para apresentação acadêmica. O HTML, CSS, JavaScript e as imagens originais foram preservados. A API implementa o contrato que o front-end já utiliza. Não precisa de MongoDB, Docker, Git, conta na nuvem ou instalação de banco.

> ⚠️ **Nota de estado (ver [`backend-implementacao.md`](./backend-implementacao.md), seção 11, e o README raiz):** esta via SQLite foi desenvolvida numa branch separada (`feature/backend-gustavo`) e nunca foi integrada ao `backend/` que está em uso hoje na `main` — o `backend/app.py` atual é a implementação em FastAPI + MongoDB Atlas, não a SQLite descrita aqui. Os arquivos citados abaixo (`backend/db.py`, `data/labielos.sqlite3`, o ZIP em `dist/`, `tests/test_api.py`, `scripts/build_portable.py`) correspondem a essa via alternativa e podem estar desatualizados ou incompatíveis com o `backend/` atual. Antes de usar este guia, confirme com a equipe qual das duas implementações é a vigente.

## Levar para uma máquina limpa

Pacote pronto: `../dist/LABIELOS-APRESENTACAO-Windows-x64.zip`.

1. Copie o ZIP para um pendrive ou para o computador da apresentação.
2. No Windows 10/11 de 64 bits (Intel/AMD), clique em **Extrair tudo**. Não execute dentro do ZIP. Evite pastas de rede, somente leitura ou protegidas; Documentos ou Área de Trabalho são boas opções.
3. Abra a pasta extraída `LABIELOS` e dê dois cliques em **INICIAR.bat**.
4. O navegador padrão abre em `http://127.0.0.1:8000/html/login.html`. Se a porta estiver ocupada, o programa escolhe outra entre as 20 seguintes. Se o navegador não abrir, digite o endereço exibido na janela do servidor.
5. Mantenha a janela do servidor aberta. Para encerrar, pressione **Ctrl+C** nela ou feche a janela.

O ZIP já inclui Python 3.13.12 para Windows x64, todas as dependências e suas licenças. Não exige administrador nem downloads ao iniciar. Use um navegador atual (Edge, Chrome ou Firefox). O pacote não foi testado em uma segunda máquina física; foi verificado extraído em outra pasta, usando seu próprio Python e sem depender de uma instalação global.

**Internet:** login, banco, cadastros, solicitações, produção, estoque e relatórios funcionam localmente. O front-end original utiliza serviços externos para fontes Google, acessibilidade, consulta ViaCEP, mapas e a biblioteca three.js do visualizador 3D. Esses recursos precisam de internet; sem ela, o navegador usa fontes alternativas, e o visualizador 3D pode não abrir. O download de modelos continua local. As referências externas foram preservadas conforme solicitado.

**Outro sistema:** este ZIP é para Windows x64. Para Linux/macOS, instale Python 3.11+ e siga a execução pelo código-fonte abaixo. Windows ARM e Windows 32 bits não foram validados.

## Quatro contas prontas

Senha das quatro: **`Demo@12345`**.

| Perfil | E-mail |
|---|---|
| Administrador da fábrica | `admin.fabrica@labielos.test` |
| Funcionário da fábrica | `funcionario.fabrica@labielos.test` |
| Administrador do solicitante | `admin.solicitante@labielos.test` |
| Funcionário do solicitante | `funcionario.solicitante@labielos.test` |

Administradores gerenciam dados da organização, aprovação de ingresso e papéis de membros. Funcionários executam as atividades da sua organização, sem acesso administrativo. Os dois usuários da fábrica pertencem à mesma fábrica; os dois solicitantes, ao mesmo centro solicitante.

O primeiro início cria exatamente essas quatro contas, duas impressoras, três materiais e três solicitações fictícias abertas. Não restaura os exemplos a cada reinício: alterações e novos cadastros são persistentes.

## Roteiro de apresentação

1. Entre como administrador solicitante e mostre o painel, as solicitações e os parceiros.
2. Crie uma solicitação pelo botão da tela. Opcionalmente anexe um STL/OBJ/3MF (até 50 MB). É possível usar também uma das solicitações prontas.
3. Saia e entre como funcionário da fábrica. Em **Novas solicitações**, aceite a solicitação e abra a demanda.
4. Inicie a produção escolhendo **Bancada 1**, **material doado** e **PLA**.
5. Conclua a produção, informe `0,5` na quantidade de material utilizado (ou o formato aceito pelo navegador) e escolha **Sede**. Confira a baixa no estoque e a impressora disponível.
6. Saia e entre como funcionário solicitante. Abra a solicitação pronta, veja o local de retirada e aprove. A solicitação fica **Concluída**, com histórico e indicadores atualizados.
7. Para demonstrar ajuste, reprove antes da aprovação e informe um motivo. A fábrica recebe a demanda em produção de novo. Cada nova conclusão desconta o material adicional informado.
8. Para demonstrar a segunda origem de material, crie outra solicitação e escolha **material do solicitante** ao iniciar a produção. Informe especificação e local de entrega, confirme o recebimento e conclua.
9. Entre com um administrador para mostrar **Administração**. Cadastros de pessoas em organização existente precisam ser aprovados nessa tela. Organizações novas recebem acesso imediato com administrador.

Para manter duas contas abertas ao mesmo tempo, use um navegador normal e uma janela anônima, ou navegadores diferentes. Abas do mesmo perfil compartilham a sessão. Não há envio de e-mail nesta demonstração: ao solicitar mudança de e-mail, o código temporário aparece na própria mensagem de resposta da tela. Isso é exclusivo da versão de apresentação.

## Banco, backup e reinício

- Banco: `../data/labielos.sqlite3`, ao lado de `INICIAR.bat`. Inclui usuários, sessões, solicitações, anexos, fotos, estoque e histórico.
- Senhas são armazenadas como PBKDF2 com sal aleatório; sessões usam cookie HttpOnly e tokens aleatórios com hash no SQLite, válidos por oito horas.
- Para transferir o estado atual, feche o servidor e copie a **pasta extraída inteira**, incluindo `data`, para a outra máquina.
- Para backup, feche o servidor e copie a pasta `data`.
- Para começar outra demonstração do zero, extraia o ZIP em uma pasta nova. Para restaurar na mesma pasta, feche o servidor e renomeie `data` para `data-backup`; o próximo início cria um banco novo. O ZIP sempre começa com dados novos, sem as mudanças feitas na máquina de desenvolvimento.
- O servidor aceita conexões somente na própria máquina (`127.0.0.1`), sem expor a demonstração na rede.
- Se a porta 8000 estiver ocupada, o programa escolhe automaticamente a próxima porta livre. Também é possível definir `LABIELOS_PORT=8001` no terminal antes de iniciar.

## Executar pelo código-fonte

Para quem clonou apenas o Git (a pasta `.runtime` e o ZIP não entram no Git):

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-lock.txt
.\.venv\Scripts\python.exe run.py
```

Em Linux/macOS, use `python3 -m venv .venv` e `.venv/bin/python` nos comandos seguintes. A instalação das dependências precisa de internet. O FastAPI serve o front-end e a API na mesma porta; não use Live Server nem abra os HTML pelo sistema de arquivos.

Documentação da API: `http://127.0.0.1:8000/docs` (a interface Swagger usa CDN). O JSON do contrato em `/openapi.json` é local. Saúde da API e conexão SQLite: `/api/health`.

Os documentos antigos em [`backend.md`](./backend.md) e [`database.md`](./database.md) descrevem o planejamento original em MongoDB; **esta implementação de demonstração usa SQLite**. A referência de campos das telas é [`integracao-backend.md`](./integracao-backend.md).

## Testes e empacotamento

```powershell
.\.runtime\python\python.exe tests/test_api.py
.\.runtime\python\python.exe scripts/build_portable.py
.\.runtime\python\python.exe scripts/check_portable.py
```

Ou use o Python do ambiente virtual com as dependências travadas. Os testes usam um SQLite temporário e não alteram os dados da apresentação. Cobrem quatro perfis, permissões, cadastro/aprovação, isolamento entre organizações, aceite concorrente, as duas origens de material, ajustes, estoque, arquivos e histórico, persistência, perfil e proteção dos arquivos privados.

`scripts/build_portable.py` exige `.runtime/python` preparado. Ele inclui os arquivos públicos originais, backend, inicializador e runtime, sem `.git`, banco de desenvolvimento, caminhos absolutos ou caches Python. Gera também um arquivo SHA-256 ao lado do ZIP.

Verificação realizada nesta entrega: 10 testes de integração aprovados; ZIP extraído em outro diretório e iniciado com o Python incluído, com login dos quatro perfis, criação de solicitação e persistência após reiniciar. Os arquivos do front-end foram comparados com o Git e com os arquivos extraídos. A ferramenta de controle do navegador estava indisponível, portanto a conferência visual das telas deve ser feita pelo apresentador antes da aula.

## Limites desta versão

É uma demonstração acadêmica com contas e dados fictícios, não uma implantação de produção. Troca de e-mail tem código exibido localmente; não há SMTP, recuperação de senha, verificação institucional, cópia automática de segurança nem proteção completa contra abuso de tentativas de login. Use dados fictícios. As permissões e regras de fluxo são verificadas pela API, mesmo quando a interface oculta os botões.
