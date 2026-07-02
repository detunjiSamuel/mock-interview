FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /workspace

COPY shared/ shared/
COPY services/main_api/ services/main_api/

WORKDIR /workspace/services/main_api

RUN uv sync --frozen --no-dev

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
