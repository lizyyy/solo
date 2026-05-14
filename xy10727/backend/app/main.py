from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from app.models.database import init_db, get_db, User
from app.api.addresses import router as addresses_router

app = FastAPI(title="地址解析纠偏服务", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(addresses_router)


@app.on_event("startup")
async def startup_event():
    init_db()
    db = next(get_db())
    if not db.query(User).filter(User.username == "sre_admin").first():
        admin = User(
            username="sre_admin",
            email="sre@example.com",
            hashed_password="fake_hash",
            role="admin"
        )
        db.add(admin)
        db.commit()


@app.get("/")
def root():
    return {"message": "地址解析纠偏服务 API", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
