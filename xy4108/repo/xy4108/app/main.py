from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import init_db
from .routers import (
    children,
    menu,
    ingredients,
    substitutions,
    meal_plan,
    import_router,
    export_router,
    audit
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="幼儿园后厨过敏原配餐审校站 - 本地纯后端API服务",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(children.router, prefix="/api/v1")
app.include_router(menu.router, prefix="/api/v1")
app.include_router(ingredients.router, prefix="/api/v1")
app.include_router(substitutions.router, prefix="/api/v1")
app.include_router(meal_plan.router, prefix="/api/v1")
app.include_router(import_router.router, prefix="/api/v1")
app.include_router(export_router.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
