from fastapi import FastAPI
from app.database import engine
from app.models import Base
from app.api import router as samples_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API 异常样本库",
    description="标准化的 API 异常样本管理系统，支持脱敏、分类、复现、关联修复和历史追溯",
    version="1.0.0"
)

app.include_router(samples_router)


@app.get("/", tags=["root"])
def root():
    return {
        "name": "API 异常样本库",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
