from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.database import Base, engine
from app.routers import (
    contracts,
    deliveries,
    acceptances,
    payments,
    penalties,
    warnings,
    compensations,
    reports,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    lifespan=lifespan,
)


app.include_router(contracts.router, prefix=settings.API_V1_STR)
app.include_router(deliveries.router, prefix=settings.API_V1_STR)
app.include_router(acceptances.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(penalties.router, prefix=settings.API_V1_STR)
app.include_router(warnings.router, prefix=settings.API_V1_STR)
app.include_router(compensations.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": "0.1.0",
        "docs_url": "/docs",
        "api_prefix": settings.API_V1_STR,
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
