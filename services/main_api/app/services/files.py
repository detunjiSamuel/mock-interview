import uuid
from pathlib import Path
from typing import Protocol

from fastapi import UploadFile


class FileStorage(Protocol):
    async def save(self, file: UploadFile) -> str: ...
    def resolve(self, filename: str) -> str: ...


class LocalFileStorage:
    def __init__(self, base_path: str) -> None:
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def save(self, file: UploadFile) -> str:
        ext = Path(file.filename or "audio").suffix or ".webm"
        filename = f"{uuid.uuid4()}{ext}"
        dest = self.base_path / filename
        content = await file.read()
        dest.write_bytes(content)
        return filename

    def resolve(self, filename: str) -> str:
        return str(self.base_path / filename)
