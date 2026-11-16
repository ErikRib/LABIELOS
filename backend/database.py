import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

# String de conexão do MongoDB Atlas fornecida
MONGO_DETAILS = os.getenv(
    "MONGO_URI",
    "mongodb+srv://<db_username>:<db_password>@cluster0.5o19og2.mongodb.net/?compressors=zlib"
)

client = AsyncIOMotorClient(MONGO_DETAILS)

# Banco de dados
database = client.labielos_db

# Coleções baseadas nos documentos do MongoDB
solicitacoes_collection = database.get_collection("solicitacoes")
materiais_collection = database.get_collection("materiais")
impressoras_collection = database.get_collection("impressoras")
organizacoes_collection = database.get_collection("organizacoes")
fornecedores_collection = database.get_collection("fornecedores")
usuarios_collection = database.get_collection("usuarios")

# Coleções novas, usadas pela autenticação/autorização (ver backend/README.md)
sessoes_collection = database.get_collection("sessoes")
memberships_collection = database.get_collection("memberships")
contadores_collection = database.get_collection("contadores")
codigos_recuperacao_collection = database.get_collection("codigos_recuperacao")

# Confirmação de e-mail antes de concluir o cadastro (ver backend/README.md).
codigos_verificacao_cadastro_collection = database.get_collection("codigos_verificacao_cadastro")
