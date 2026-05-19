from fastapi import FastAPI
from app.database import engine, Base
from app.routers import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="跨境电商关务系统",
    description="支持申报单CSV导入、税则JSON导入、退单回执处理、补税凭证追踪等功能",
    version="1.0.0"
)

app.include_router(router)


@app.get("/")
async def root():
    return {
        "message": "跨境电商关务系统",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
