from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base
from app.api import router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="特征交叉泄漏检查系统",
    description="整合评测切片与特征快照的泄漏检查，支持三步工作流",
    version="1.0.0",
)

app.include_router(router)

try:
    app.mount("/static", StaticFiles(directory="static"), name="static")
except RuntimeError:
    pass


@app.get("/")
def read_root():
    try:
        return FileResponse("static/index.html")
    except Exception:
        return {
            "message": "特征交叉泄漏检查系统",
            "docs": "/docs",
        }


@app.get("/health")
def health_check():
    return {"status": "ok"}
