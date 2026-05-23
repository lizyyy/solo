from fastapi import FastAPI
from app.database import engine, Base
from app.routers import auth, records, retry, reports, logs

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="民宿保洁排班重试补偿队列 API",
    description="处理订单日历、保洁群消息、维修备注和手工改价表的重试补偿系统",
    version="1.0.0"
)

app.include_router(auth.router)
app.include_router(records.router)
app.include_router(retry.router)
app.include_router(reports.router)
app.include_router(logs.router)


@app.get("/", tags=["系统"])
async def root():
    return {
        "service": "民宿保洁排班重试补偿队列服务",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy"}
