FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /workspace

COPY shared/ shared/
COPY services/feedback_service/ services/feedback_service/

WORKDIR /workspace/services/feedback_service

RUN uv sync --frozen --no-dev

EXPOSE 8002

CMD ["uv", "run", "python", "-m", "app.worker"]
