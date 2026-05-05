import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from config import get_settings
from database import init_db
from routers import import_router, analysis_router, comparison_router, confirmation_router, report_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Redis Structure Audit API...")
    await init_db()
    logger.info("Database initialized successfully")
    yield
    logger.info("Shutting down Redis Structure Audit API...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Redis Data Structure Selection Health Check API Service",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc) if settings.debug else "An error occurred"}
    )


app.include_router(import_router.router, prefix="/api/v1")
app.include_router(analysis_router.router, prefix="/api/v1")
app.include_router(comparison_router.router, prefix="/api/v1")
app.include_router(confirmation_router.router, prefix="/api/v1")
app.include_router(report_router.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": asyncio.get_event_loop().time()
    }


@app.get("/api/v1/stats")
async def get_stats():
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "database": settings.database_url,
        "upload_dir": settings.upload_dir,
        "reports_dir": settings.reports_dir,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
