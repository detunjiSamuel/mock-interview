import asyncio
import json
import sys
from pathlib import Path

# Ensure the app package is importable when run as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.question import Question

_SEED_FILE = Path(__file__).resolve().parent / "seed" / "questions.json"


def _load_rows() -> list[dict]:
    with open(_SEED_FILE) as f:
        return json.load(f)


async def main() -> None:
    motor_client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongo_uri)
    db_name = settings.mongo_uri.rsplit("/", 1)[-1].split("?")[0]
    await beanie.init_beanie(
        database=motor_client[db_name],
        document_models=[Question],
    )

    rows = _load_rows()
    print(f"\nLoaded {len(rows)} question(s) from seed file\n")

    upserted = 0
    for row in rows:
        slug = row["slug"]
        existing = await Question.find_one(Question.slug == slug)
        if existing:
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
