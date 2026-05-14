from fastapi import FastAPI
from .database import engine, Base
from .models import models
from .routers import batches, rules, reports, manual

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="并发冲突模拟器后端服务",
    description="边缘节点清册并发冲突检测与分析系统",
    version="1.0.0"
)

app.include_router(batches.router)
app.include_router(rules.router)
app.include_router(reports.router)
app.include_router(manual.router)


@app.get("/")
def read_root():
    return {"message": "并发冲突模拟器后端服务运行中", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
