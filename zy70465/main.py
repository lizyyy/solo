from fastapi import FastAPI
from app.database import engine
from app.models.ticket import Base
from app.api.tickets import router as tickets_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="工单附件扫描服务",
    description="处理工单附件扫描、版本冲突检测、人工审核、清理回滚等功能",
    version="1.0.0"
)

app.include_router(tickets_router)


@app.get("/")
def read_root():
    return {
        "message": "工单附件扫描服务",
        "docs": "/docs",
        "api_prefix": "/api/tickets"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
