from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.database import engine, Base
from backend.app.api.components import router as components_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="低代码组件注册中心",
    description="组件schema到兼容报告的处理链管理系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(components_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "低代码组件注册中心 API",
        "docs": "/docs",
        "version": "1.0.0"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
