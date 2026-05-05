from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.config import init_db
from app.routes import import_routes, query_routes, action_routes

app = FastAPI(
    title="现金中心清分核对系统",
    description="县域银行支行现金中心下班前清分结果核对系统",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_routes.router)
app.include_router(query_routes.router)
app.include_router(action_routes.router)


@app.on_event("startup")
async def startup_event():
    init_db()
    print("数据库初始化完成")


@app.get("/", summary="系统状态")
async def root():
    return {
        "status": "running",
        "name": "现金中心清分核对系统",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", summary="健康检查")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
