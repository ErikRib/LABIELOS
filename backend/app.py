
# LABIELOS - BACK-END
#
# Este arquivo é responsável por iniciar nossa API.
# Através dele, criamos rotas que recebem solicitações,
# processam informações e devolvem respostas.
#
# Por enquanto, estamos apenas TESTANDO essas funcionalidades
# sem salvar nenhuma informação no banco de dados.


# Importamos o FastAPI para criar as rotas da nossa API.
from fastapi import FastAPI

# Importamos ferramentas para definir e validar os dados
# que serão enviados pelos usuários.
from pydantic import BaseModel, EmailStr, Field


# Permite limitar um campo a valores específicos.
from typing import Literal



# Criamos a aplicação principal do LABIELOS.
# É através da variável "app" que configuramos nossa API.
app = FastAPI()

# O MODELO DE DADOS:

# Este modelo define quais informações precisamos receber
# quando alguém enviar uma solicitação de teste.
class SolicitacaoTeste(BaseModel):
    descricao: str  
    prioridade: str  


# Este modelo define os dados necessários para testar
# o cadastro de um novo usuário no LABIELOS.

class CadastroTeste(BaseModel):

    # EXIGÊNCIAS : 

    nome: str = Field(min_length=2) #Minimo 2 caracteres no nome.
    sobrenome: str = Field(min_length=2) # Minimo 2 caracteres no sobrenome
    
    email: EmailStr # Verifica se o e-mail possui um formato válido.
    
    senha: str = Field(min_length=8) # Minimo de 8 caracteres na senha

    # Identifica o tipo de organização do usuário.
    # ACEITA SOMENTE DOIS TIPO! :
    tipo: Literal["organizacao", "fabricante"]

    # Identifica se a organização já existe ou é nova.
    vinculo: Literal["existente", "nova"]

    # Exige que o usuário tenha aceitado os termos.
    termos: Literal[True]


# ROTAS GET - CONSULTA DE INFORMAÇÕES PRA VER SE TA TUDO FUNCIONANDO:

# Esta rota permite verificar se nossa API está funcionando.
# Quando acessamos /api/health, ela devolve o status do sistema.
@app.get("/api/health")
def verificar_status():

    # Envia uma resposta indicando que a API está ativa.
    return {"status": "ok", "projeto": "LABIELOS"}


# Esta rota apresenta informações básicas do projeto.
# O GET é utilizado aqui porque estamos apenas consultando dados.
@app.get("/api/info")
def obter_informacoes():

    # Devolve o nome do projeto e seu estágio atual.
    return {
        "nome": "LABIELOS",
        "mensagem": "API em desenvolvimento"
    }

# ROTAS POST - ENVIO DE INFORMAÇÕES


# Esta rota recebe uma solicitação fictícia enviada em JSON.
# O FastAPI verifica os dados usando o modelo SolicitacaoTeste.

@app.post("/api/teste/solicitacao")
def receber_solicitacao(dados: SolicitacaoTeste):

    # Devolve as informações recebidas para confirmar o envio.
    # Nenhuma solicitação é salva no banco de dados.

    return {
        "mensagem": "Solicitação recebida para teste",
        "descricao": dados.descricao,
        "prioridade": dados.prioridade
    }


# Esta rota simula a primeira etapa do cadastro de usuários.
# Ela recebe os dados e verifica se atendem às regras
# que definimos anteriormente no modelo CadastroTeste.
@app.post("/api/teste/cadastro")
def testar_cadastro(dados: CadastroTeste):

    # Se os dados forem válidos, devolvemos uma confirmação.
    # A senha não é incluída na resposta por segurança.


    # Devolve uma confirmação sem expor a senha.
    # Os dados ainda não são salvos no banco.
    return {
        "mensagem": "Dados validados. Nenhuma conta foi criada.",
        "nome": dados.nome,
        "email": dados.email,
        "tipo": dados.tipo,
        "vinculo": dados.vinculo
    }