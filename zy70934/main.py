from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api import projects, import_api, reconciliation_api, reports_api

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="装修监理对账服务",
    description="装修工程节点验收对账系统 - 支持导入、自动比对、人工复核、重新计算和报告下载",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(import_api.router)
app.include_router(reconciliation_api.router)
app.include_router(reports_api.router)


@app.get("/", tags=["根路径"])
def root():
    return {
        "service": "装修监理对账服务",
        "version": "1.0.0",
        "endpoints": {
            "项目管理": "/api/projects",
            "数据导入": "/api/import",
            "对账管理": "/api/reconciliation",
            "报告管理": "/api/reports"
        },
        "docs": "/docs"
    }


@app.get("/health", tags=["健康检查"])
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
