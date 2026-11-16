"""Hash de senha com PBKDF2 (biblioteca padrão do Python, sem depender de
bcrypt/passlib — evita problemas de compilação nativa no Windows)."""
import hashlib
import hmac
import secrets

ITERACOES = 200_000


def hash_senha(senha: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), bytes.fromhex(salt), ITERACOES)
    return f"pbkdf2${salt}${digest.hex()}"


def verificar_senha(senha: str, hash_armazenado: str) -> bool:
    try:
        _, salt, hash_hex = hash_armazenado.split("$")
    except (ValueError, AttributeError):
        return False
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), bytes.fromhex(salt), ITERACOES)
    return hmac.compare_digest(digest.hex(), hash_hex)
