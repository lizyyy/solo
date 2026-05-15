from fastapi import FastAPI
from app.models.database import init_db
from app.api.routes import router as api_router

app = FastAPI(
    title="超时预算分配器",
    description="过期审批催办列表预算分配系统，支持版本冻结、人工修正备注、统一查询入口",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


app.include_router(api_router, prefix="/api/v1", tags=["budget"])


@app.get("/")
def root():
    return {
        "message": "超时预算分配器",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
