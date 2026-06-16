.PHONY: dev test lint build

dev:
	cd services/transcript_service && uv sync --group dev
	cd services/feedback_service && uv sync --group dev

test:
	cd services/transcript_service && uv run pytest
	cd services/feedback_service && uv run pytest

lint:
	cd services/transcript_service && uv run ruff check . && uv run black --check .
	cd services/feedback_service && uv run ruff check . && uv run black --check .

build:
	docker compose build
