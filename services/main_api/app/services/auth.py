from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError  # noqa: F401 — re-exported for callers

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_token(email: str, secret: str, algorithm: str, expire_days: int) -> str:
    expire = datetime.utcnow() + timedelta(days=expire_days)
    payload = {"sub": email, "email": email, "exp": expire}
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_token(token: str, secret: str, algorithm: str) -> dict:
    # Raises jose.JWTError if invalid / expired
    return jwt.decode(token, secret, algorithms=[algorithm])
