"""
FastAPI dependencies for auth, rate limiting, and validation.
"""
from fastapi import Depends, Header, Request
from typing import Annotated
import time
import re
import hashlib
import logging

from app.config import get_settings, Settings
from app.exceptions import InvalidTokenError, RateLimitError

logger = logging.getLogger(__name__)

# Simple in-memory rate limiter (use Redis in production)
_rate_limit_store: dict[str, list[float]] = {}


def get_client_ip(request: Request) -> str:
    """Extract client IP, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take first IP in chain
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_key(request: Request) -> str:
    """
    Generate rate limit key from IP.
    Hash it to avoid storing raw IPs.
    """
    ip = get_client_ip(request)
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


async def check_rate_limit(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)]
) -> None:
    """
    Simple sliding window rate limiter.
    For production, use Redis with proper TTL.
    """
    key = rate_limit_key(request)
    now = time.time()
    window = 60  # 1 minute window

    # Clean old entries
    if key in _rate_limit_store:
        _rate_limit_store[key] = [
            t for t in _rate_limit_store[key]
            if now - t < window
        ]
    else:
        _rate_limit_store[key] = []

    # Check limit
    if len(_rate_limit_store[key]) >= settings.rate_limit_per_minute:
        logger.warning(f"Rate limit exceeded for key {key}")
        raise RateLimitError(retry_after=window)

    # Record this request
    _rate_limit_store[key].append(now)


def validate_spotify_token_format(token: str) -> bool:
    """
    Basic validation of Spotify access token format.
    Tokens are base64-ish strings, typically 150-300 chars.
    """
    if not token or not isinstance(token, str):
        return False
    if len(token) < 50 or len(token) > 500:
        return False
    # Should only contain URL-safe base64 chars and maybe some punctuation
    if not re.match(r'^[A-Za-z0-9_\-]+$', token):
        return False
    return True


async def get_spotify_token(
    authorization: Annotated[str | None, Header()] = None
) -> str:
    """
    Extract and validate Spotify token from Authorization header.
    """
    if not authorization:
        raise InvalidTokenError()

    # Must be Bearer token
    if not authorization.startswith("Bearer "):
        raise InvalidTokenError()

    token = authorization[7:]  # Remove "Bearer "

    if not validate_spotify_token_format(token):
        logger.warning("Invalid token format received")
        raise InvalidTokenError()

    return token


def validate_track_id(track_id: str) -> str:
    """
    Validate Spotify track ID format.
    Track IDs are 22 character base62 strings.
    """
    if not track_id or not isinstance(track_id, str):
        raise ValueError("Track ID required")

    # Clean any whitespace
    track_id = track_id.strip()

    # Spotify IDs are exactly 22 base62 characters
    if not re.match(r'^[A-Za-z0-9]{22}$', track_id):
        raise ValueError("Invalid track ID format")

    return track_id


def validate_state_param(state: str | None) -> str | None:
    """
    Validate OAuth state parameter to prevent CSRF.
    """
    if state is None:
        return None

    # State should be alphanumeric, reasonable length
    if not re.match(r'^[A-Za-z0-9_\-]{16,64}$', state):
        return None

    return state


# Type aliases for cleaner dependency injection
SpotifyToken = Annotated[str, Depends(get_spotify_token)]
RateLimited = Annotated[None, Depends(check_rate_limit)]
