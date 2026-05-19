from fastapi import FastAPI
from app.database import engine, Base
from app.api import checklists_router, reports_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="发布清单核对缺项分级API",
    description="用于自动化检查发布清单中的制品、迁移脚本、回滚步骤等缺项并分级",
    version="1.0.0",
)

app.include_router(checklists_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")


@app.get("/health")
def health_check():
    return {"status": "healthy"}
