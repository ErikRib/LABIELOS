"""Modelos Pydantic de entrada/saída, seguindo o contrato de
docs/integracao-backend.md. Nomes de campo em português, como o front espera."""
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, Field

# Validação de e-mail simples (só formato, sem checar se o domínio existe).
# Não usamos o EmailStr do pydantic (biblioteca email-validator) porque ela
# rejeita domínios de teste como "...@algo.test" ou "...@exemplo" — e tanto
# os dados de exemplo do doc quanto os testes deste projeto usam esse tipo
# de e-mail fictício. Ver docs/backend.md.
Email = Annotated[str, Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", min_length=3, max_length=200)]

# ---------------------------------------------------------------------------
# Autenticação e perfil (doc §4)
# ---------------------------------------------------------------------------


class LoginEntrada(BaseModel):
    email: Email
    senha: str
    lembrar: bool = False


class EnderecoEntrada(BaseModel):
    cep: str = Field(min_length=1)
    logradouro: str = Field(min_length=1)
    numero: str = Field(min_length=1)
    complemento: str = ""
    bairro: str = Field(min_length=1)
    cidade: str = Field(min_length=1)
    uf: str = Field(min_length=2, max_length=2)


class RegistroEntrada(BaseModel):
    nome: str = Field(min_length=1)
    sobrenome: str = Field(min_length=1)
    email: Email
    senha: str = Field(min_length=6)
    tipo: Literal["organizacao", "fabricante"]
    vinculo: Literal["existente", "nova"]
    termos: bool
    # Código de 6 dígitos confirmado em POST /auth/email/verify/confirm antes
    # de chegar aqui (rota não documentada em docs/integracao-backend.md —
    # ver docs/backend.md). Validado manualmente na rota, não aqui, para
    # devolver uma mensagem de erro específica.
    verificacao_codigo: Optional[str] = None
    # vínculo == "existente"
    organizacao_id: Optional[str] = None
    justificativa: Optional[str] = None
    # vínculo == "nova"
    nome_organizacao: Optional[str] = None
    cnpj: Optional[str] = None
    email_institucional: Optional[Email] = None
    telefone_institucional: Optional[str] = None
    cargo: Optional[str] = None
    endereco: Optional[EnderecoEntrada] = None


class PerfilParcial(BaseModel):
    nome: Optional[str] = None
    sobrenome: Optional[str] = None
    telefone: Optional[str] = None


class AtualizarCargo(BaseModel):
    cargo: str = Field(min_length=1, max_length=80)


class IniciarTrocaEmail(BaseModel):
    novo_email: Email
    senha_atual: str


class ConfirmarTrocaEmail(BaseModel):
    codigo: str


class TrocarSenha(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=6)


class IniciarVerificacaoEmail(BaseModel):
    email: Email


class ConfirmarVerificacaoEmail(BaseModel):
    email: Email
    codigo: str = Field(pattern=r"^\d{6}$")


class EsqueciSenhaEntrada(BaseModel):
    email: Email


class VerificarCodigoEntrada(BaseModel):
    email: Email
    codigo: str = Field(pattern=r"^\d{6}$")


class RedefinirSenhaEntrada(BaseModel):
    email: Email
    codigo: str = Field(pattern=r"^\d{6}$")
    nova_senha: str = Field(min_length=8)


# ---------------------------------------------------------------------------
# Organizações e administração (doc §6.1)
# ---------------------------------------------------------------------------


class EnderecoOrganizacao(EnderecoEntrada):
    id: Optional[str] = None
    nome: str = Field(default="Sede", min_length=1)


class OrganizacaoParcial(BaseModel):
    nome: Optional[str] = None
    cnpj: Optional[str] = None
    email_institucional: Optional[Email] = None
    telefone_institucional: Optional[str] = None
    enderecos: Optional[List[EnderecoOrganizacao]] = None


class DecisaoPedido(BaseModel):
    approve: bool


class AlterarPapel(BaseModel):
    role: Literal["admin", "member"]


# ---------------------------------------------------------------------------
# Solicitações e fila (doc §5)
# ---------------------------------------------------------------------------

Prioridade = Literal["Baixa", "Média", "Alta"]


class SolicitacaoEntrada(BaseModel):
    solicitacao: str = Field(min_length=1, max_length=120)
    prioridade: Prioridade
    categoria: str = Field(min_length=1)
    prazo: str = "A definir"
    material: str = "A definir"
    descricao: str = Field(min_length=1, max_length=4000)


class SolicitacaoParcial(BaseModel):
    solicitacao: Optional[str] = Field(default=None, min_length=1, max_length=120)
    prioridade: Optional[Prioridade] = None
    categoria: Optional[str] = None
    prazo: Optional[str] = None
    material: Optional[str] = None
    descricao: Optional[str] = Field(default=None, min_length=1, max_length=4000)


class IniciarProducaoEntrada(BaseModel):
    impressora_id: str
    origem_material: Literal["doacao", "solicitante"]
    material_id: Optional[str] = None
    especificacao: Optional[str] = None
    endereco_id: Optional[str] = None


class ConcluirProducaoEntrada(BaseModel):
    endereco_id: Optional[str] = None
    instrucoes: str = Field(default="", max_length=300)
    quantidade_usada: Optional[float] = Field(default=None, gt=0)


class ReprovarEntrada(BaseModel):
    motivo: str = Field(min_length=10, max_length=1000)


class HistoricoEntrada(BaseModel):
    tipo: Literal["Comentário", "Anexo"] = "Comentário"
    mensagem: str = ""


# ---------------------------------------------------------------------------
# Materiais para doação (doc §6.2)
# ---------------------------------------------------------------------------

TipoMaterial = Literal["Filamento", "Resina", "Pó", "Outro"]
UnidadeMaterial = Literal["kg", "g", "L", "mL", "un"]


class MaterialEntrada(BaseModel):
    material: str = Field(min_length=1, max_length=60)
    tipo: TipoMaterial
    cor: str = Field(default="", max_length=40)
    quantidade: float = Field(ge=0)
    unidade: UnidadeMaterial
    estoque_minimo: Optional[float] = Field(default=None, ge=0)
    observacoes: str = Field(default="", max_length=500)


class MaterialParcial(BaseModel):
    material: Optional[str] = Field(default=None, min_length=1, max_length=60)
    tipo: Optional[TipoMaterial] = None
    cor: Optional[str] = Field(default=None, max_length=40)
    quantidade: Optional[float] = Field(default=None, ge=0)
    unidade: Optional[UnidadeMaterial] = None
    estoque_minimo: Optional[float] = Field(default=None, ge=0)
    observacoes: Optional[str] = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# Impressoras (doc §6.3)
# ---------------------------------------------------------------------------

Tecnologia = Literal["FDM", "SLA", "DLP", "SLS", "Outra"]
StatusImpressora = Literal["Disponível", "Em uso", "Em manutenção", "Inativa"]


class ImpressoraEntrada(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    modelo: str = Field(default="", max_length=80)
    tecnologia: Tecnologia
    largura_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    profundidade_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    altura_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    materiais: str = Field(default="", max_length=200)
    status: StatusImpressora = "Disponível"
    observacoes: str = Field(default="", max_length=500)


class ImpressoraParcial(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=80)
    modelo: Optional[str] = Field(default=None, max_length=80)
    tecnologia: Optional[Tecnologia] = None
    largura_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    profundidade_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    altura_mm: Optional[int] = Field(default=None, ge=1, le=5000)
    materiais: Optional[str] = Field(default=None, max_length=200)
    status: Optional[StatusImpressora] = None
    observacoes: Optional[str] = Field(default=None, max_length=500)
