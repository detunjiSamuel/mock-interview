from httpx import AsyncClient


async def test_register_happy_path(async_client: AsyncClient) -> None:
    resp = await async_client.post(
        "/api/auth/register",
        json={"email": "user@example.com", "password": "secret123"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "user@example.com"
    assert "token" in body


async def test_register_duplicate_email(async_client: AsyncClient) -> None:
    payload = {"email": "dup@example.com", "password": "secret123"}
    await async_client.post("/api/auth/register", json=payload)
    resp = await async_client.post("/api/auth/register", json=payload)
    assert resp.status_code == 409


async def test_login_success(async_client: AsyncClient) -> None:
    await async_client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "secret123"},
    )
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "secret123"},
    )
    assert resp.status_code == 200
    assert "token" in resp.json()


async def test_login_wrong_password(async_client: AsyncClient) -> None:
    await async_client.post(
        "/api/auth/register",
        json={"email": "wp@example.com", "password": "correct"},
    )
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "wp@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401


async def test_login_unknown_email(async_client: AsyncClient) -> None:
    resp = await async_client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "anything"},
    )
    assert resp.status_code == 401


async def test_profile_authenticated(async_client: AsyncClient) -> None:
    email = "profile@example.com"
    reg = await async_client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123"},
    )
    token = reg.json()["token"]
    resp = await async_client.get(
        "/api/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == email
    assert "id" in body


async def test_profile_unauthenticated(async_client: AsyncClient) -> None:
    resp = await async_client.get("/api/auth/profile")
    assert resp.status_code == 401
