from fastapi import FastAPI
from app.database import engine
from app import models
from app.api import compensation, base_data

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="支付订单补建补偿券处理留痕后端API",
    description="处理小程序支付成功但订单未生成的补偿流程",
    version="1.0.0"
)

app.include_router(base_data.router, prefix="/api/v1", tags=["基础数据"])
app.include_router(compensation.router, prefix="/api/v1", tags=["补偿流程"])


@app.get("/")
def root():
    return {
        "message": "支付订单补建补偿券处理留痕后端API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
