from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api.samples import router as samples_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="农产品农残检测送样管理系统",
    description="检测站接样管理API - 处理送样批次、检测项目、复检规则",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(samples_router)

@app.get("/")
async def root():
    return {
        "name": "农产品农残检测送样管理系统",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
