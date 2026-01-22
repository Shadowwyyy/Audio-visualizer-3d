"""
OAuth authentication endpoints.
Handles Spotify login flow securely.
"""
from fastapi import APIRouter, HTTPException, Query, Response, Depends
from fastapi.responses import RedirectResponse
from urllib.parse import urlencode
import secrets
import logging

from app.config import get_settings, Settings
from app.dependencies import validate_state_param, RateLimited
from app.services.spotify_service import exchange_code_for_token, refresh_access_token
from app.models.schemas import RefreshTokenRequest, TokenResponse
from app.exceptions import SpotifyAuthError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Required Spotify scopes
SCOPES = " ".join([
    "user-read-playback-state",
    "user-read-currently-playing",
    "streaming",  # For Web Playback SDK
    "user-read-email",  # Optional: for user identification
])

# In-memory state store (use Redis in production)
# Maps state -> timestamp for CSRF protection
_pending_states: dict[str, float] = {}


@router.get("/login")
async def login(
    _: RateLimited,
    settings: Settings = Depends(get_settings)
) -> RedirectResponse:
    """
    Initiate Spotify OAuth flow.
    Redirects user to Spotify's authorization page.
    """
    # Generate CSRF state token
    state = secrets.token_urlsafe(32)

    # Store state (with timestamp for cleanup)
    import time
    _pending_states[state] = time.time()

    # Clean old states (older than 10 minutes)
    cutoff = time.time() - 600
    for s, ts in list(_pending_states.items()):
        if ts < cutoff:
            del _pending_states[s]

    params = urlencode({
        "client_id": settings.spotify_client_id,
        "response_type": "code",
        "redirect_uri": settings.spotify_redirect_uri,
        "scope": SCOPES,
        "state": state,
        "show_dialog": "false",  # Don't force re-consent if already authorized
    })

    return RedirectResponse(
        url=f"https://accounts.spotify.com/authorize?{params}",
        status_code=302
    )


@router.get("/callback")
async def callback(
    code: str = Query(None, min_length=10, max_length=500),
    state: str = Query(None),
    error: str = Query(None),
    settings: Settings = Depends(get_settings)
) -> RedirectResponse:
    """
    Handle OAuth callback from Spotify.
    Exchanges code for tokens and redirects to frontend.
    """
    # Check for Spotify errors
    if error:
        logger.warning(f"OAuth error from Spotify: {error}")
        return RedirectResponse(
            url=f"{settings.frontend_url}?error=auth_denied",
            status_code=302
        )

    # Validate required params
    if not code:
        logger.warning("Missing authorization code in callback")
        return RedirectResponse(
            url=f"{settings.frontend_url}?error=missing_code",
            status_code=302
        )

    # Validate state (CSRF protection)
    validated_state = validate_state_param(state)
    if validated_state is None or validated_state not in _pending_states:
        logger.warning("Invalid or missing state parameter")
        return RedirectResponse(
            url=f"{settings.frontend_url}?error=invalid_state",
            status_code=302
        )

    # Remove used state
    del _pending_states[validated_state]

    # Exchange code for tokens
    try:
        token_data = await exchange_code_for_token(code)
    except SpotifyAuthError:
        return RedirectResponse(
            url=f"{settings.frontend_url}?error=token_exchange_failed",
            status_code=302
        )

    # Redirect to frontend with access token only
    # Refresh token should be stored server-side in production
    params = urlencode({
        "access_token": token_data["access_token"],
        "expires_in": token_data["expires_in"],
    })

    # In production, set refresh token in httpOnly cookie instead
    response = RedirectResponse(
        url=f"{settings.frontend_url}/callback?{params}",
        status_code=302
    )

    # Set refresh token as httpOnly cookie (more secure than URL param)
    if "refresh_token" in token_data:
        response.set_cookie(
            key="spotify_refresh",
            value=token_data["refresh_token"],
            httponly=True,
            secure=True,  # HTTPS only
            samesite="lax",
            max_age=60 * 60 * 24 * 30  # 30 days
        )

    return response


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    _: RateLimited,
    request: RefreshTokenRequest
) -> TokenResponse:
    """
    Refresh an expired access token.
    """
    token_data = await refresh_access_token(request.refresh_token)

    return TokenResponse(
        access_token=token_data["access_token"],
        token_type="Bearer",
        expires_in=token_data.get("expires_in", 3600)
    )


@router.post("/logout")
async def logout(response: Response) -> dict:
    """
    Clear auth cookies.
    Note: This doesn't revoke Spotify access - user must do that in Spotify settings.
    """
    response.delete_cookie("spotify_refresh")
    return {"message": "Logged out"}
