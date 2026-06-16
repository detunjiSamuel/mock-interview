FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /workspace

# Mirror the local path structure so the ../../shared relative source in uv.lock resolves
COPY shared/ shared/
COPY services/transcript_service/ services/transcript_service/

WORKDIR /workspace/services/transcript_service

RUN uv sync --frozen --no-dev

CMD ["uv", "run", "python", "main.py"]
