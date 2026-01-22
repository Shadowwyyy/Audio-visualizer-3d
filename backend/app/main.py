"""
FastAPI application entry point.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import time
from datetime import datetime

from app.config import get_settings
from app.db.mongodb import connect_db, close_db, get_cache_stats
from app.routers import auth, spotify
from app.exceptions import SpotifyAPIError, SpotifyAuthError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info("Starting up...")
    await connect_db()
    yield
    # Shutdown
    logger.info("Shutting down...")
    await close_db()


# Create app
settings = get_settings()

app = FastAPI(
    title="Spotify Visualizer API",
    description="Backend API for audio-reactive visualizer with Spotify integration",
    version="1.0.0",
    lifespan=lifespan,
    # Don't expose docs in production
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS - be specific about allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Only what we need
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,  # Cache preflight for 10 minutes
)


# ============================================
# Middleware
# ============================================

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Don't leak server info
    if "server" in response.headers:
        del response.headers["server"]

    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log request timing (exclude sensitive data)."""
    start = time.time()

    response = await call_next(request)

    duration = time.time() - start

    # Log without sensitive params
    logger.info(
        f"{request.method} {request.url.path} - "
        f"{response.status_code} - {duration:.3f}s"
    )

    return response


# ============================================
# Exception Handlers
# ============================================

@app.exception_handler(SpotifyAPIError)
async def spotify_api_error_handler(request: Request, exc: SpotifyAPIError):
    """Handle Spotify API errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(SpotifyAuthError)
async def spotify_auth_error_handler(request: Request, exc: SpotifyAuthError):
    """Handle authentication errors."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    """
    Catch-all error handler.
    Never expose internal errors to client.
    """
    logger.error(f"Unhandled error: {type(exc).__name__}: {exc}")

    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"}
    )


# ============================================
# Routes
# ============================================

app.include_router(auth.router)
app.include_router(spotify.router)


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    cache_stats = await get_cache_stats()

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "cache": cache_stats
    }


@app.get("/")
async def root():
    """Root endpoint - just confirms API is running."""
    return {
        "name": "Spotify Visualizer API",
        "version": "1.0.0",
        "docs": "/docs" if settings.debug else "disabled"
    }
