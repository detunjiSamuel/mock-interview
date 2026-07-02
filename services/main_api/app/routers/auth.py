from fastapi import APIRouter, Depends, HTTPException, status

from ..config import settings
from ..dependencies import get_current_user
from ..models.user import User
from ..schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from ..services.auth import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> TokenResponse:
    existing = await User.find_one(User.email == body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    await user.insert()
    token = create_token(
        body.email,
        settings.jwt_secret,
        settings.jwt_algorithm,
        settings.jwt_expire_days,
    )
    return TokenResponse(email=body.email, token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    user = await User.find_one(User.email == body.email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_token(
        user.email,
        settings.jwt_secret,
        settings.jwt_algorithm,
        settings.jwt_expire_days,
    )
    return TokenResponse(email=user.email, token=token)


@router.get("/profile", response_model=UserResponse)
async def profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=str(current_user.id), email=current_user.email)
