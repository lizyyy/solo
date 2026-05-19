from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app import models
from app.routers import books, logs, export

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="公益书库管理系统 API",
    description="管理书籍入库、批量导入、敏感数据导出、操作日志审计系统",
    version="1.0.0",
    contact={
        "name": "公益书库志愿者团队",
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router, prefix=f"{settings.API_V1_STR}/books", tags=["书籍管理"])
app.include_router(logs.router, prefix=f"{settings.API_V1_STR}/logs", tags=["日志管理"])
app.include_router(export.router, prefix=f"{settings.API_V1_STR}/export", tags=["数据导出"])


@app.get("/", summary="健康检查")
def health_check():
    return {
        "status": "healthy",
        "message": "公益书库管理系统运行正常",
        "api_version": settings.API_V1_STR,
        "docs_url": "/docs"
    }


@app.get(f"{settings.API_V1_STR}/meta/allowed-values", summary="获取允许的品相和年级值")
def get_allowed_values():
    from app.utils import ALLOWED_CONDITIONS, ALLOWED_GRADES
    return {
        "allowed_conditions": ALLOWED_CONDITIONS,
        "allowed_grades": ALLOWED_GRADES
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
