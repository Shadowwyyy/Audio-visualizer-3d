"""
MongoDB connection and caching operations.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import Optional, Any
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

# Global client - initialized on startup
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> None:
    """Initialize database connection. Call on app startup."""
    global _client, _db

    settings = get_settings()

    try:
        _client = AsyncIOMotorClient(
            settings.mongodb_uri,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            maxPoolSize=10
        )
        # Verify connection works
        await _client.admin.command("ping")

        _db = _client.spotify_visualizer

        # Create indexes for efficient queries
        await _db.analysis_cache.create_index("track_id", unique=True)
        # 7 day TTL
        await _db.analysis_cache.create_index("cached_at", expireAfterSeconds=60*60*24*7)

        logger.info("Connected to MongoDB")

    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {type(e).__name__}")
        raise


async def close_db() -> None:
    """Close database connection. Call on app shutdown."""
    global _client
    if _client:
        _client.close()
        logger.info("Closed MongoDB connection")


def get_db() -> AsyncIOMotorDatabase:
    """Get database instance."""
    if _db is None:
        raise RuntimeError(
            "Database not initialized. Call connect_db() first.")
    return _db


# ============================================
# Cache Operations
# ============================================

async def get_cached_analysis(track_id: str) -> Optional[dict]:
    """
    Retrieve cached audio analysis for a track.
    Returns None if not found or expired.
    """
    db = get_db()

    try:
        doc = await db.analysis_cache.find_one(
            {"track_id": track_id},
            {"_id": 0, "analysis": 1}  # Only return what we need
        )

        if doc:
            logger.debug(f"Cache hit for track {track_id}")
            return doc.get("analysis")

        logger.debug(f"Cache miss for track {track_id}")
        return None

    except Exception as e:
        # Cache failures shouldn't break the app
        logger.warning(f"Cache read error: {type(e).__name__}")
        return None


async def cache_analysis(track_id: str, analysis: dict) -> bool:
    """
    Store audio analysis in cache.
    Returns True on success.
    """
    db = get_db()

    try:
        await db.analysis_cache.update_one(
            {"track_id": track_id},
            {
                "$set": {
                    "track_id": track_id,
                    "analysis": analysis,
                    "cached_at": datetime.utcnow()
                }
            },
            upsert=True
        )
        logger.debug(f"Cached analysis for track {track_id}")
        return True

    except Exception as e:
        # Log but don't fail - caching is nice-to-have
        logger.warning(f"Cache write error: {type(e).__name__}")
        return False


async def get_cache_stats() -> dict:
    """Get cache statistics for monitoring."""
    db = get_db()

    try:
        count = await db.analysis_cache.count_documents({})
        return {"cached_tracks": count}
    except Exception:
        return {"cached_tracks": -1}
