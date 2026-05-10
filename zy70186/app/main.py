from fastapi import FastAPI
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routers import contracts, deposits, conditions, penalties, tasks


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="合同履约保证金管理系统 API",
    lifespan=lifespan
)

app.include_router(contracts.router, prefix=settings.API_PREFIX)
app.include_router(deposits.router, prefix=settings.API_PREFIX)
app.include_router(conditions.router, prefix=settings.API_PREFIX)
app.include_router(penalties.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}
