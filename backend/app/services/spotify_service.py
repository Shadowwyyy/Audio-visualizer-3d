"""
Spotify API service with proper error handling and caching.
"""
import httpx
import logging
from typing import Any
from datetime import datetime, timedelta

from app.config import get_settings
from app.exceptions import SpotifyAPIError, SpotifyAuthError, NotFoundError

logger = logging.getLogger(__name__)

SPOTIFY_AUTH_URL = "https://accounts.spotify.com"
SPOTIFY_API_URL = "https://api.spotify.com/v1"

# Request timeout - don't hang forever
REQUEST_TIMEOUT = 10.0


class SpotifyService:
    """
    Handles all Spotify API interactions.
    Each instance is tied to a user's access token.
    """

    def __init__(self, access_token: str):
        self._access_token = access_token
        self._headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

    async def _make_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> dict | None:
        """
        Central request handler with error handling.
        Never exposes raw API errors to caller.
        """
        url = f"{SPOTIFY_API_URL}{endpoint}"

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=self._headers,
                    **kwargs
                )

                # Handle specific status codes
                if response.status_code == 204:
                    return None

                if response.status_code == 401:
                    logger.warning("Spotify token expired or invalid")
                    raise SpotifyAuthError(
                        "Token expired. Please re-authenticate.")

                if response.status_code == 404:
                    raise NotFoundError("Track")

                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After", "60")
                    logger.warning(
                        f"Spotify rate limit hit, retry after {retry_after}s")
                    raise SpotifyAPIError(
                        "Rate limited by Spotify. Try again shortly.")

                if response.status_code >= 500:
                    logger.error(
                        f"Spotify server error: {response.status_code}")
                    raise SpotifyAPIError()

                if response.status_code >= 400:
                    # Log for debugging but don't expose details
                    logger.error(
                        f"Spotify API error {response.status_code}: {response.text[:200]}")
                    raise SpotifyAPIError("Request failed")

                return response.json()

        except httpx.TimeoutException:
            logger.error("Spotify API timeout")
            raise SpotifyAPIError("Spotify is not responding. Try again.")

        except httpx.RequestError as e:
            # Network errors, DNS failures, etc.
            logger.error(f"Network error calling Spotify: {type(e).__name__}")
            raise SpotifyAPIError()

    async def get_current_playback(self) -> dict | None:
        """Get user's current playback state."""
        return await self._make_request("GET", "/me/player/currently-playing")

    async def get_audio_analysis(self, track_id: str) -> dict:
        """
        Get detailed audio analysis for a track.
        This is the heavy endpoint - contains beats, segments, sections.
        """
        return await self._make_request("GET", f"/audio-analysis/{track_id}")

    async def get_audio_features(self, track_id: str) -> dict:
        """Get high-level audio features (tempo, energy, etc.)."""
        return await self._make_request("GET", f"/audio-features/{track_id}")

    async def get_track(self, track_id: str) -> dict:
        """Get track metadata."""
        return await self._make_request("GET", f"/tracks/{track_id}")


# ============================================
# Token Exchange Functions (no user token needed)
# ============================================

async def exchange_code_for_token(code: str) -> dict:
    """
    Exchange authorization code for access/refresh tokens.
    Called during OAuth callback.
    """
    settings = get_settings()

    if not code or len(code) < 10:
        raise SpotifyAuthError("Invalid authorization code")

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{SPOTIFY_AUTH_URL}/api/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.spotify_redirect_uri,
                    "client_id": settings.spotify_client_id,
                    "client_secret": settings.spotify_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            data = response.json()

            if "error" in data:
                logger.warning(f"Token exchange failed: {data.get('error')}")
                raise SpotifyAuthError(
                    "Authorization failed. Please try again.")

            if "access_token" not in data:
                logger.error("No access_token in Spotify response")
                raise SpotifyAuthError()

            return data

    except httpx.RequestError as e:
        logger.error(
            f"Network error during token exchange: {type(e).__name__}")
        raise SpotifyAPIError()


async def refresh_access_token(refresh_token: str) -> dict:
    """
    Get new access token using refresh token.
    """
    settings = get_settings()

    if not refresh_token or len(refresh_token) < 20:
        raise SpotifyAuthError("Invalid refresh token")

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.post(
                f"{SPOTIFY_AUTH_URL}/api/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": settings.spotify_client_id,
                    "client_secret": settings.spotify_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            data = response.json()

            if "error" in data:
                logger.warning(f"Token refresh failed: {data.get('error')}")
                raise SpotifyAuthError("Session expired. Please log in again.")

            return data

    except httpx.RequestError as e:
        logger.error(f"Network error during token refresh: {type(e).__name__}")
        raise SpotifyAPIError()
