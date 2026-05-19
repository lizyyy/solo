from fastapi import FastAPI
from app.core.database import engine
from app.models.models import Base
from app.api.routes import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API客户端重试策略差异退避校验后端API",
    description="用于校验多语言SDK重试配置一致性的后端服务",
    version="1.0.0"
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "API Client Retry Policy Discrepancy Backend",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)