from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models.session import init_db
from .api.diagnosis import router as diagnosis_router

app = FastAPI(
    title="消息队列积压诊断后端",
    description="针对消息队列积压场景的智能诊断系统，支持指标对齐、积压归因、告警分层、处理建议和报告导出。",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnosis_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "queue-diagnosis-backend",
        "version": "1.0.0"
    }


@app.get("/")
def root():
    return {
        "name": "消息队列积压诊断后端",
        "docs": "/docs",
        "api_prefix": "/api/diagnosis",
        "features": [
            "指标对齐 - 处理时间窗错位问题",
            "积压归因 - 识别生产暴涨/消费变慢/死信堆积/消费者掉线",
            "告警分层 - P0/CRITICAL/WARNING/INFO 四级告警",
            "处理建议 - 基于根因生成可执行建议",
            "特殊检测 - 时间窗错位/死信重复计/消费者掉线未识别",
            "报告导出 - 支持JSON和Excel格式",
            "可解释性 - 每个评分都有详细推导过程"
        ]
    }
