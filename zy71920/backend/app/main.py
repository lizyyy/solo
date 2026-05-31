from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import artworks

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="青年艺术展挂墙管理系统",
    description="用于管理艺术展作品挂墙、灯光方案和版本历史的系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(artworks.router)


@app.get("/")
def root():
    return {
        "message": "青年艺术展挂墙管理系统 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
