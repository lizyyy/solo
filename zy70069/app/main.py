from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base
from app.routers import students, pre_review


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="毕业资格预审 API",
    description="学生毕业资格预审系统，支持学分检查、处分检查、论文状态检查、规则快照、人工复核、批量计算和报告生成",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(students.router, prefix=settings.API_V1_PREFIX)
app.include_router(pre_review.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {
        "service": "毕业资格预审 API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
