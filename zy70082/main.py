from fastapi import FastAPI
from api.routes import router as api_router

app = FastAPI(
    title="政务材料预审 API",
    description="一个用于政务材料预审的 API 服务，支持材料目录管理、预审规则配置、补正任务处理和办件状态流转",
    version="1.0.0"
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {
        "message": "政务材料预审 API 服务已启动",
        "docs": "/docs",
        "openapi": "/openapi.json"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
