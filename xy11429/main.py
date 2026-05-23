from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import auth, ledger, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="园区访客通行权限追责台账 API",
    description="用于管理园区访客通行权限的追责台账系统，支持从访客预约表、闸机记录、临时车牌截图等数据源建账，完整工作流追踪和审计导出功能。",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ledger.router)
app.include_router(reports.router)


@app.get("/", tags=["系统"])
async def root():
    return {
        "message": "园区访客通行权限追责台账 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
