from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.database import engine, Base
from .api import resumes, jobs, export, statistics

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="简历解析复核系统",
    description="招聘简历解析复核全栈Web系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resumes.router, prefix="", tags=["resumes"])
app.include_router(jobs.router, prefix="", tags=["jobs"])
app.include_router(export.router, prefix="", tags=["export"])
app.include_router(statistics.router, prefix="", tags=["statistics"])


@app.get("/")
def root():
    return {
        "message": "欢迎使用简历解析复核系统API",
        "docs": "/docs",
        "redoc": "/redoc"
    }
