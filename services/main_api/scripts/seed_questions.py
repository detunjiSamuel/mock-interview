"""
Seed questions from the XLSX datasheet into MongoDB.

Usage:
    cd services/main_api
    uv run python scripts/seed_questions.py
"""

import asyncio
import sys
from pathlib import Path

import openpyxl

# Allow running from repo root or from services/main_api/
_repo_root = Path(__file__).resolve().parents[3]
_datasheet = _repo_root / "data-sheet" / "QUESTIONS DATASHEET - 1.xlsx"

# Ensure the app package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import beanie  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.models.question import Question  # noqa: E402
from mock_interview_shared.schemas.enums import Category, Difficulty  # noqa: E402


def _slug(text: str, suffix: str = "") -> str:
    base = text.strip().lower().replace(" ", "-")
    return f"{base}-{suffix}" if suffix else base


def _coerce_difficulty(raw: str) -> Difficulty:
    mapping = {
        "easy": Difficulty.EASY,
        "medium": Difficulty.MEDIUM,
        "hard": Difficulty.HARD,
    }
    return mapping.get(raw.strip().lower(), Difficulty.MEDIUM)


def _coerce_category(raw: str) -> Category:
    mapping = {
        "behavioral": Category.BEHAVIORAL,
        "technical": Category.TECHNICAL,
        "situational": Category.SITUATIONAL,
        "general": Category.GENERAL,
    }
    return mapping.get(raw.strip().lower(), Category.GENERAL)


def _load_rows() -> list[dict]:
    if not _datasheet.exists():
        raise FileNotFoundError(f"Datasheet not found: {_datasheet}")

    wb = openpyxl.load_workbook(_datasheet)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    # First row is the header
    header = [str(h).strip().lower() if h else "" for h in rows[0]]
    print(f"Columns detected: {header}")

    questions = []
    for i, row in enumerate(rows[1:], start=2):
        cell = dict(zip(header, row))

        topic_raw = cell.get("topic") or cell.get("question topic") or ""
        text_raw = cell.get("text") or cell.get("question") or cell.get("question text") or ""
        difficulty_raw = str(cell.get("difficulty") or "medium")
        category_raw = str(cell.get("category") or "general")
        helpful_tip = cell.get("helpful tip") or cell.get("helpful_tip") or cell.get("tip")
        video_url = cell.get("video_url") or cell.get("video url")

        if not topic_raw or not text_raw:
            print(f"  Row {i}: skipping — missing topic or text")
            continue

        questions.append(
            {
                "topic": str(topic_raw).strip(),
                "text": str(text_raw).strip(),
                "base_slug": _slug(str(topic_raw)),
                "difficulty": _coerce_difficulty(difficulty_raw),
                "category": _coerce_category(category_raw),
                "helpful_tip": str(helpful_tip).strip() if helpful_tip else None,
                "video_url": str(video_url).strip() if video_url else None,
            }
        )

    # Resolve slug collisions by appending a counter
    seen: dict[str, int] = {}
    for row in questions:
        base = row.pop("base_slug")
        count = seen.get(base, 0)
        row["slug"] = base if count == 0 else f"{base}-{count}"
        seen[base] = count + 1

    return questions


async def main() -> None:
    motor_client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongo_uri)
    db_name = settings.mongo_uri.rsplit("/", 1)[-1].split("?")[0]
    await beanie.init_beanie(
        database=motor_client[db_name],
        document_models=[Question],
    )

    rows = _load_rows()
    print(f"\nLoaded {len(rows)} question(s) from datasheet\n")

    upserted = 0
    for row in rows:
        slug = row["slug"]
        existing = await Question.find_one(Question.slug == slug)
        if existing:
            # Update in place
            for field, value in row.items():
                setattr(existing, field, value)
            await existing.save()
            print(f"  Updated : {slug}")
        else:
            await Question(**row).insert()
            print(f"  Inserted: {slug}")
            upserted += 1

    print(f"\nDone — {upserted} inserted, {len(rows) - upserted} updated")
    motor_client.close()


if __name__ == "__main__":
    asyncio.run(main())
