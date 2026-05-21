from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, SessionLocal
from app import models
from app.routers import router
from app.services import init_default_rules

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="文档脱敏任务 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api", tags=["documents"])

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        init_default_rules(db)
    finally:
        db.close()

@app.get("/")
def root():
    return {"message": "文档脱敏任务 API 服务运行中", "docs": "/docs"}
