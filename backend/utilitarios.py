"""Funções pequenas usadas por mais de uma rota."""
from datetime import datetime, timedelta, timezone

# Horário de Brasília fixo (sem horário de verão) — simplificação para o
# projeto; ver docs/backend.md.
FUSO_BRASILIA = timezone(timedelta(hours=-3))


def agora_utc_naive() -> datetime:
    """UTC sem tzinfo. O driver do MongoDB (motor/pymongo) sempre devolve
    datetimes "naive" em UTC ao ler do banco — mesmo que a gente grave um
    datetime "aware" (com tzinfo) — porque o BSON não guarda fuso horário.
    Comparar um datetime "aware" (ex.: datetime.now(timezone.utc)) com um
    "naive" vindo do banco derruba a API (TypeError). Por isso, qualquer
    data que vá ser comparada depois (expiração de sessão, de código etc.)
    deve ser gravada e comparada sempre com esta função, nunca com
    datetime.now(timezone.utc)."""
    return datetime.utcnow()


def calcular_situacao(quantidade: float, estoque_minimo) -> str:
    if quantidade is not None and quantidade <= 0:
        return "Esgotado"
    if estoque_minimo and quantidade is not None and quantidade < estoque_minimo:
        return "Estoque baixo"
    return "Disponível"


def endereco_texto(endereco: dict) -> str:
    linha1 = ", ".join(filter(None, [endereco.get("logradouro"), endereco.get("numero")]))
    if endereco.get("complemento"):
        linha1 += f" — {endereco['complemento']}"
    cidade_uf = "/".join(filter(None, [endereco.get("cidade"), endereco.get("uf")]))
    linha2 = ", ".join(filter(None, [endereco.get("bairro"), cidade_uf]))
    partes = [p for p in [linha1, linha2, f"CEP {endereco['cep']}" if endereco.get("cep") else None] if p]
    return " · ".join(partes)


def formatar_tamanho(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.0f} KB"
    return f"{num_bytes / (1024 * 1024):.1f} MB"
