"""
Configuration management with validation.
Never log or expose these values.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import re


class Settings(BaseSettings):
    # Spotify credentials - NEVER log these
    spotify_client_id: str
    spotify_client_secret: str
    spotify_redirect_uri: str

    # Database
    mongodb_uri: str

    # App settings
    frontend_url: str
    secret_key: str  # For session signing

    # Security settings
    allowed_origins: list[str] = ["http://localhost:3000"]
    rate_limit_per_minute: int = 60
    max_cache_age_hours: int = 24 * 7  # Analysis cache TTL

    # Environment
    debug: bool = False

    @field_validator("spotify_client_id")
    @classmethod
    def validate_client_id(cls, v: str) -> str:
        # Spotify client IDs are 32 hex characters
        if not re.match(r"^[a-f0-9]{32}$", v.lower()):
            raise ValueError("Invalid Spotify client ID format")
        return v

    @field_validator("spotify_client_secret")
    @classmethod
    def validate_client_secret(cls, v: str) -> str:
        if len(v) < 20:
            raise ValueError("Client secret appears invalid")
        return v

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("Secret key must be at least 32 characters")
        return v

    @field_validator("frontend_url")
    @classmethod
    def validate_frontend_url(cls, v: str) -> str:
        # Remove trailing slash for consistency
        return v.rstrip("/")

    class Config:
        env_file = ".env"
        # Prevent secrets from appearing in repr/str
        json_schema_extra = {
            "hidden_fields": {"spotify_client_secret", "secret_key", "mongodb_uri"}
        }


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings instance.
    Only created once per process.
    """
    return Settings()


# .env.example content:
"""
SPOTIFY_CLIENT_ID=your_32_char_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:8000/auth/callback
MONGODB_URI=mongodb://localhost:27017
FRONTEND_URL=http://localhost:3000
SECRET_KEY=generate_a_random_32_plus_char_string_here
ALLOWED_ORIGINS=["http://localhost:3000"]
DEBUG=false
"""
