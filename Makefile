.PHONY: dev test lint build

dev:
	cd services/main_api && uv sync --group dev
	cd services/transcript_service && uv sync --group dev
	cd services/feedback_service && uv sync --group dev

test:
	cd services/main_api && uv run pytest
	cd services/transcript_service && uv run pytest
	cd services/feedback_service && uv run pytest

lint:
	cd services/main_api && uv run ruff check . && uv run black --check .
	cd services/transcript_service && uv run ruff check . && uv run black --check .
	cd services/feedback_service && uv run ruff check . && uv run black --check .

build:
	docker compose build
