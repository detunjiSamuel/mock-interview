import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest")
os.environ.setdefault("INTERNAL_API_SECRET", "test-internal-secret")
os.environ.setdefault("RABBITMQ_URI", "amqp://guest:guest@localhost/")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-fake-key-for-pytest")

# passlib 1.7.x is incompatible with bcrypt >= 4.0: the library now raises ValueError
# instead of silently truncating passwords > 72 bytes, which breaks passlib's internal
# wrap-bug detection. Patch hashpw to restore the old truncation behavior for tests.
import bcrypt as _bcrypt

_orig_hashpw = _bcrypt.hashpw
_bcrypt.hashpw = lambda pwd, salt: _orig_hashpw(pwd[:72], salt)

# mongomock-motor's AsyncMongoMockCollection.aggregate() returns the cursor directly
# but Beanie (fetch_links=True path) does `await collection.aggregate(...)`.
# In real motor, aggregate() is awaitable. Make it async here so Beanie can await it.
from mongomock_motor import AsyncMongoMockCollection as _AsyncMongoMockCollection

_orig_aggregate = _AsyncMongoMockCollection.aggregate


async def _async_aggregate(self, *args, **kwargs):
    return _orig_aggregate(self, *args, **kwargs)


_AsyncMongoMockCollection.aggregate = _async_aggregate  # type: ignore[method-assign]

# mongomock's get_value_by_dot cannot navigate into bson.DBRef objects.
# Beanie stores Link fields as DBRef and its $lookup pipeline uses "field.$id" as
# localField. Without this patch, the lookup returns no rows and link fetching fails.
from bson import DBRef as _DBRef
import mongomock.helpers as _mmh

_orig_gvbd = _mmh.get_value_by_dot


def _dbref_aware_gvbd(doc, key, can_generate_array=False):
    try:
        return _orig_gvbd(doc, key, can_generate_array)
    except KeyError:
        parts = key.split(".")
        if parts[-1] == "$id":
            parent_key = ".".join(parts[:-1])
            try:
                parent = _orig_gvbd(doc, parent_key)
                if isinstance(parent, _DBRef):
                    return parent.id
            except (KeyError, AttributeError):
                pass
        raise


_mmh.get_value_by_dot = _dbref_aware_gvbd

import pytest_asyncio
from unittest.mock import AsyncMock, patch
from mongomock_motor import AsyncMongoMockClient
from httpx import AsyncClient, ASGITransport


async def _patched_load_cached_info(self) -> None:
    # Beanie calls db.command("buildInfo") and db.list_collection_names(authorizedCollections=True)
    # but mongomock supports neither. Supply safe defaults so init_beanie completes.
    self._database_major_version = 6
    self._existing_collections = []


@pytest_asyncio.fixture
async def init_db():
    import beanie
    from beanie.odm.utils.init import Initializer
    from app.models.user import User
    from app.models.question import Question
    from app.models.interview import Interview

    client = AsyncMongoMockClient()
    with patch.object(Initializer, "_load_cached_info", _patched_load_cached_info):
        await beanie.init_beanie(database=client["testdb"], document_models=[User, Question, Interview])
    yield
    await User.find_all().delete()
    await Question.find_all().delete()
    await Interview.find_all().delete()


@pytest_asyncio.fixture
async def async_client(init_db):
    mock_mq = AsyncMock()
    mock_channel = AsyncMock()
    mock_channel.default_exchange = AsyncMock()
    mock_mq.channel = AsyncMock(return_value=mock_channel)

    with (
        patch("app.main.AsyncIOMotorClient", return_value=AsyncMongoMockClient()),
        patch("beanie.init_beanie", new=AsyncMock()),
        patch("app.main.get_connection", return_value=mock_mq),
        patch("app.main.declare_queues", new=AsyncMock()),
    ):
        from app.main import app

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            app.state.mq_connection = mock_mq
            app.state.mock_channel = mock_channel
            yield client


def make_auth_headers(email: str) -> dict[str, str]:
    from app.services.auth import create_token

    token = create_token(email, "test-secret-key-for-pytest", "HS256", 2)
    return {"Authorization": f"Bearer {token}"}
