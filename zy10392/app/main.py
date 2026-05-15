from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as batches_router


app = FastAPI(
    title="接口批量关闭计划 API",
    description="用于管理接口分批下线、指标观察、局部恢复和结论归档的系统",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches_router)


@app.get("/")
async def root():
    return {
        "message": "接口批量关闭计划 API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
