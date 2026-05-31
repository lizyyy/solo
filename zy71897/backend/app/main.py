from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import os

from .database import engine, Base
from .api import import_, diagnosis, records, export

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="空压机能耗诊断系统",
    description="空压机能耗诊断API服务 - 支持数据导入、诊断、复核、修正、历史查询、导出",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

app.include_router(import_.router)
app.include_router(diagnosis.router)
app.include_router(records.router)
app.include_router(export.router)


@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            return f.read()
    return HTMLResponse(content="""
    <html>
        <head><title>空压机能耗诊断系统</title></head>
        <body>
            <h1>空压机能耗诊断系统 API</h1>
            <p>请访问 <a href="/docs">/docs</a> 查看API文档</p>
            <p>前端界面未找到，请将前端文件放置在 backend/frontend/ 目录下</p>
        </body>
    </html>
    """)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "空压机能耗诊断系统"}


@app.get("/api/info")
async def get_system_info():
    return {
        "name": "空压机能耗诊断系统",
        "version": "1.0.0",
        "features": [
            "数据导入（能耗/振动）",
            "能耗诊断",
            "阈值跨档检测",
            "振动曲线分析",
            "异常检测与解释",
            "诊断复核",
            "人工修正",
            "历史查询",
            "审计追踪",
            "巡检报告导出（一致性保证）",
            "批量处理（幂等性）",
        ],
        "api_docs": "/docs",
    }
