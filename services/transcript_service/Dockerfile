FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /workspace

COPY shared/ shared/
COPY services/transcript_service/ services/transcript_service/

WORKDIR /workspace/services/transcript_service

RUN uv sync --frozen --no-dev

EXPOSE 8001

CMD ["uv", "run", "python", "-m", "app.worker"]
