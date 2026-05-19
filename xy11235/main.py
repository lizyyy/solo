from fastapi import FastAPI
from app.database import engine, Base
from app.api import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="高校实验室试剂管理系统",
    description="用于管理实验室试剂的领用、审批、库存和危险等级校验",
    version="1.0.0"
)

app.include_router(api_router, prefix="/api", tags=["api"])


@app.get("/")
def root():
    return {
        "message": "高校实验室试剂管理系统 API",
        "docs": "/docs",
        "redoc": "/redoc"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
