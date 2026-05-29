from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .api.v1.tasks import router as tasks_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="音频降噪对比台 API",
    description=(
        "用于视频团队比较不同降噪参数效果的对比平台。\n"
        "支持对比任务创建、数据导入、批量处理、片段试听、\n"
        "指标对比、版本保存、异常检测和报告导出等功能。\n\n"
        "核心特性：\n"
        "- 批量处理：多参数 × 多音频自动对比\n"
        "- 异常检测：过度降噪、静音误判、参数覆盖自动识别\n"
        "- 版本管理：参数修改自动生成新版本\n"
        "- 批次区分：报告文件名含日期和批次号，月底不混乱\n"
        "- 原始口径保留：手工备注和源数据不被覆盖"
    ),
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router, prefix="/api/v1")


@app.get("/health", summary="健康检查")
def health_check():
    return {"status": "healthy", "service": "audio_denoise_compare_api"}


@app.get("/", summary="根路径")
def root():
    return {
        "name": "音频降噪对比台 API",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": "/api/v1"
    }
