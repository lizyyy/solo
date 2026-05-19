from fastapi import FastAPI
from app.core.database import engine
from app.models import Base
from app.api import packages, files, rules, violations

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Monorepo Package Boundary Checker API",
    description="后端 API 用于检测 Monorepo 中包之间的边界违规情况",
    version="1.0.0"
)

app.include_router(packages.router)
app.include_router(files.router)
app.include_router(rules.router)
app.include_router(violations.router)


@app.get("/")
def root():
    return {
        "message": "Monorepo Package Boundary Checker API",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
