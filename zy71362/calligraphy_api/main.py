import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import homework, comments, comparison, export
from image_processor import generate_sample_image
from config import UPLOAD_DIR


app = FastAPI(
    title="书法作业章法评分 API",
    description="书法作业图片的章法分析评分系统，支持图像校正、版面测量、评分、评语、班级对比和报告导出",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(homework.router)
app.include_router(comments.router)
app.include_router(comparison.router)
app.include_router(export.router)


@app.on_event("startup")
def startup():
    init_db()
    sample_path = os.path.join(UPLOAD_DIR, "sample_calligraphy.jpg")
    if not os.path.exists(sample_path):
        img = generate_sample_image()
        img.save(sample_path)


@app.get("/")
def root():
    return {
        "service": "书法作业章法评分 API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "创建作业": "POST /api/homework",
            "查询作业列表": "GET /api/homework",
            "查询作业详情": "GET /api/homework/{id}",
            "图像校正": "POST /api/homework/{id}/correct-image",
            "版面测量": "POST /api/homework/{id}/measure",
            "获取测量结果": "GET /api/homework/{id}/measurement",
            "调整测量数据": "PUT /api/homework/{id}/measurement",
            "获取评分": "GET /api/homework/{id}/score",
            "修正评分": "PUT /api/homework/{id}/score",
            "推进状态": "POST /api/homework/{id}/advance",
            "问题列表": "GET /api/homework/{id}/issues",
            "解决问题": "PUT /api/homework/{id}/issues/{issue_id}",
            "添加评语": "POST /api/homework/{id}/comments",
            "评语历史": "GET /api/homework/{id}/comments",
            "班级对比": "GET /api/class-comparison",
            "学生排名": "GET /api/class-comparison/student-rank",
            "导出报告": "GET /api/homework/{id}/export",
        },
    }


@app.get("/health")
def health():
    return {"status": "ok"}
