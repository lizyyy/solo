from fastapi import FastAPI
from app.database import engine, Base
from app.routers import code_router, batch_router, query_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="农产品溯源码发放服务",
    description="合作社给农户发溯源码、采摘批次和检测报告管理系统",
    version="1.0.0"
)

app.include_router(code_router)
app.include_router(batch_router)
app.include_router(query_router)


@app.get("/")
def root():
    return {
        "name": "农产品溯源码发放服务",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health():
    return {"status": "ok"}
