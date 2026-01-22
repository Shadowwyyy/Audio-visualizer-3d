"""
Spotify data endpoints for the visualizer.
"""
from fastapi import APIRouter, Path
from typing import Optional
import logging
import re

from app.dependencies import SpotifyToken, RateLimited, validate_track_id
from app.services.spotify_service import SpotifyService
from app.models.schemas import (
    PlaybackState, TrackInfo, AnalysisResponse,
    BeatData, SegmentData, SectionData, AudioFeatures
)
from app.db.mongodb import get_cached_analysis, cache_analysis
from app.exceptions import InvalidTrackError, NotFoundError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/spotify", tags=["Spotify"])


def validate_track_id_param(track_id: str) -> str:
    """Validate track ID format."""
    track_id = track_id.strip()
    if not re.match(r'^[A-Za-z0-9]{22}$', track_id):
        raise InvalidTrackError()
    return track_id


def extract_track_info(track_data: dict) -> TrackInfo:
    """Safely extract track info from Spotify response."""
    artists = track_data.get("artists", [])
    artist_name = artists[0]["name"] if artists else "Unknown Artist"

    album = track_data.get("album", {})
    images = album.get("images", [])
    album_art = images[0]["url"] if images else None

    return TrackInfo(
        id=track_data["id"],
        name=track_data.get("name", "Unknown Track"),
        artist=artist_name,
        album=album.get("name", "Unknown Album"),
        album_art=album_art,
        duration_ms=track_data.get("duration_ms", 0)
    )


@router.get("/playback", response_model=Optional[PlaybackState])
async def get_playback(
    _: RateLimited,
    token: SpotifyToken
) -> Optional[PlaybackState]:
    """
    Get current playback state.
    Returns null if nothing is playing.
    """
    service = SpotifyService(token)
    data = await service.get_current_playback()

    if not data or "item" not in data:
        return None

    track = data.get("item")
    if not track:
        return PlaybackState(
            is_playing=data.get("is_playing", False),
            progress_ms=data.get("progress_ms", 0),
            track=None
        )

    return PlaybackState(
        is_playing=data.get("is_playing", False),
        progress_ms=data.get("progress_ms", 0),
        track=extract_track_info(track)
    )


@router.get("/analysis/{track_id}", response_model=AnalysisResponse)
async def get_analysis(
    _: RateLimited,
    token: SpotifyToken,
    track_id: str = Path(..., min_length=22, max_length=22)
) -> AnalysisResponse:
    """
    Get processed audio analysis for visualizer.
    Results are cached to reduce API calls.
    """
    # Validate track ID format
    track_id = validate_track_id_param(track_id)

    # Check cache first
    cached = await get_cached_analysis(track_id)
    if cached:
        return AnalysisResponse(**cached)

    # Fetch from Spotify
    service = SpotifyService(token)

    # Get both analysis and features in parallel would be nice,
    # but let's keep it simple and sequential for clarity
    analysis = await service.get_audio_analysis(track_id)
    features = await service.get_audio_features(track_id)

    if not analysis:
        raise NotFoundError("Track analysis")

    # Process and trim the data
    # Raw analysis can be 500KB+, we only need what the visualizer uses
    processed = process_analysis(track_id, analysis, features)

    # Cache for future requests
    await cache_analysis(track_id, processed.model_dump())

    return processed


def process_analysis(
    track_id: str,
    analysis: dict,
    features: dict
) -> AnalysisResponse:
    """
    Transform raw Spotify analysis into visualizer-friendly format.
    Filters out low-confidence data and limits array sizes.
    """
    # Extract beats (filter low confidence)
    raw_beats = analysis.get("beats", [])
    beats = [
        BeatData(
            start=b["start"],
            duration=b["duration"],
            confidence=b["confidence"]
        )
        for b in raw_beats
        if b.get("confidence", 0) > 0.3  # Skip uncertain beats
    ]

    # Extract segments (these drive most visuals)
    raw_segments = analysis.get("segments", [])
    segments = [
        SegmentData(
            start=s["start"],
            duration=s["duration"],
            loudness=s.get("loudness_start", s.get("loudness", -60)),
            pitches=s.get("pitches", [0] * 12),
            timbre=s.get("timbre", [0] * 12)
        )
        for s in raw_segments[:2000]  # Cap at 2000 segments
    ]

    # Extract sections (song structure)
    raw_sections = analysis.get("sections", [])
    sections = [
        SectionData(
            start=s["start"],
            duration=s["duration"],
            tempo=s.get("tempo", 120),
            key=s.get("key", -1),
            mode=s.get("mode", 0),
            loudness=s.get("loudness", -10)
        )
        for s in raw_sections
    ]

    # Get track info
    track_info = analysis.get("track", {})

    return AnalysisResponse(
        track_id=track_id,
        duration=track_info.get("duration", 0),
        tempo=features.get("tempo", track_info.get("tempo", 120)),
        energy=features.get("energy", 0.5),
        beats=beats,
        segments=segments,
        sections=sections
    )


@router.get("/features/{track_id}", response_model=AudioFeatures)
async def get_features(
    _: RateLimited,
    token: SpotifyToken,
    track_id: str = Path(..., min_length=22, max_length=22)
) -> AudioFeatures:
    """
    Get high-level audio features for a track.
    Lighter weight than full analysis.
    """
    track_id = validate_track_id_param(track_id)

    service = SpotifyService(token)
    features = await service.get_audio_features(track_id)

    if not features:
        raise NotFoundError("Track features")

    return AudioFeatures(
        tempo=features.get("tempo", 120),
        energy=features.get("energy", 0.5),
        danceability=features.get("danceability", 0.5),
        valence=features.get("valence", 0.5)
    )
