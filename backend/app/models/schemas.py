"""
Pydantic models for request/response validation.
Strict validation prevents bad data from propagating.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


# ============================================
# Request Models
# ============================================

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20, max_length=500)

    @field_validator("refresh_token")
    @classmethod
    def validate_token_format(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r'^[A-Za-z0-9_\-]+$', v):
            raise ValueError("Invalid token format")
        return v


class TrackIdParam(BaseModel):
    """For validating track ID path parameters."""
    track_id: str

    @field_validator("track_id")
    @classmethod
    def validate_track_id(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r'^[A-Za-z0-9]{22}$', v):
            raise ValueError("Invalid Spotify track ID")
        return v


# ============================================
# Response Models
# ============================================

class TokenResponse(BaseModel):
    """Returned after successful auth - NO refresh token to frontend!"""
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class TrackInfo(BaseModel):
    id: str
    name: str
    artist: str
    album: str
    album_art: Optional[str] = None
    duration_ms: int = Field(..., gt=0)


class PlaybackState(BaseModel):
    is_playing: bool
    progress_ms: int = Field(..., ge=0)
    track: Optional[TrackInfo] = None


class BeatData(BaseModel):
    start: float = Field(..., ge=0)
    duration: float = Field(..., gt=0)
    confidence: float = Field(..., ge=0, le=1)


class SegmentData(BaseModel):
    start: float = Field(..., ge=0)
    duration: float = Field(..., gt=0)
    loudness: float
    pitches: list[float] = Field(..., min_length=12, max_length=12)
    timbre: list[float] = Field(..., min_length=12, max_length=12)


class SectionData(BaseModel):
    start: float = Field(..., ge=0)
    duration: float = Field(..., gt=0)
    tempo: float = Field(..., gt=0)
    key: int = Field(..., ge=-1, le=11)
    mode: int = Field(..., ge=0, le=1)
    loudness: float


class AudioFeatures(BaseModel):
    tempo: float = Field(..., gt=0)
    energy: float = Field(..., ge=0, le=1)
    danceability: float = Field(..., ge=0, le=1)
    valence: float = Field(..., ge=0, le=1)  # Musical positivity


class AnalysisResponse(BaseModel):
    """
    Processed audio analysis - only what the visualizer needs.
    Raw Spotify response is huge, we trim it down.
    """
    track_id: str
    duration: float
    tempo: float
    energy: float
    beats: list[BeatData]
    segments: list[SegmentData]
    sections: list[SectionData]

    class Config:
        # Limit response size
        max_anystr_length = 100


class HealthResponse(BaseModel):
    status: str = "ok"
    timestamp: str


class ErrorResponse(BaseModel):
    detail: str
