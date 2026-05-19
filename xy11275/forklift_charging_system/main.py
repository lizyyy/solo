from fastapi import FastAPI
from app.database import engine, Base
from app.api import forklifts, charging_piles, tasks, logs, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="仓库叉车充电调度系统",
    description="夜班班长内部使用的叉车充电调度工具，支持低电量优先、跨班占用检查、重复锁桩幂等等规则",
    version="1.0.0"
)

app.include_router(forklifts.router)
app.include_router(charging_piles.router)
app.include_router(tasks.router)
app.include_router(logs.router)
app.include_router(reports.router)


@app.get("/", tags=["系统"])
def root():
    return {
        "message": "仓库叉车充电调度系统",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy"}
