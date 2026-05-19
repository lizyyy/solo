from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api.delivery import router as delivery_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="社区药房冷链药品管理系统",
    description="疫苗和胰岛素到货管理、温度记录、异常追踪和报告导出系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(delivery_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "社区药房冷链药品管理系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
