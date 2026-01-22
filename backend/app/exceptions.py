"""
Custom exceptions with safe error messages.
Never expose internal details to clients.
"""
from fastapi import HTTPException, status


class SpotifyAPIError(HTTPException):
    """Spotify API returned an error."""

    def __init__(self, detail: str = "Spotify service temporarily unavailable"):
        # Log the real error internally, return generic message to client
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail
        )


class SpotifyAuthError(HTTPException):
    """Authentication with Spotify failed."""

    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )


class RateLimitError(HTTPException):
    """Too many requests."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down.",
            headers={"Retry-After": str(retry_after)}
        )


class InvalidTokenError(HTTPException):
    """Token validation failed."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )


class InvalidTrackError(HTTPException):
    """Invalid track ID format."""

    def __init__(self):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid track ID format"
        )


class NotFoundError(HTTPException):
    """Resource not found."""

    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found"
        )
