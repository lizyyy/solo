from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import projects, calculations, exports
from app.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="屋顶光伏排布和收益模拟工具",
    description="一个用于屋顶光伏系统设计、发电量计算和收益分析的工具",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["项目管理"])
app.include_router(calculations.router, prefix="/api/calculations", tags=["计算分析"])
app.include_router(exports.router, prefix="/api/exports", tags=["报告导出"])

@app.get("/")
def root():
    return {"message": "屋顶光伏排布和收益模拟工具 API 服务运行中"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
