from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api.tasks import router as tasks_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="图片转码任务控制台 API",
    description="图片转码任务管理系统 - 包含任务创建、审批、重试、回滚、导出等功能",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)


@app.get("/")
def root():
    return {
        "message": "图片转码任务控制台 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)