from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import projects, packages, patients, queue

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="体检中心空腹项目排队 API",
    description="""
    体检中心空腹项目排队管理系统 API

    ## 核心规则

    ### 项目类型
    - **空腹项目 (fasting)**: 如抽血、B超等需要空腹的项目
    - **餐后项目 (post_meal)**: 如餐后血糖等需要进食后才能做的项目
    - **无限制项目 (unrestricted)**: 不受空腹/餐后限制

    ### 关键业务规则
    1. **餐后项目必须在所有空腹项目完成后才能开始**
       - 否则会影响检查结果准确性
       - 系统会拒绝创建并记录到问题列表

    2. **空腹项目不能在餐后项目完成后进行**
       - 顺序错误会影响检查结果
       - 系统会拒绝并记录到问题列表

    3. **项目依赖必须按顺序完成**
       - 可以配置项目间的依赖关系
       - 依赖未完成时无法创建后续项目排队号

    4. **状态流转规则**
       - pending -> in_progress / cancelled / rescheduled / invalid
       - in_progress -> completed / cancelled / rescheduled
       - rescheduled -> pending (重新激活)
       - completed / cancelled / invalid -> 不可转换

    ### 问题记录
    - 所有违反规则的请求都会被记录到问题列表
    - 保留来源数据、错误消息和错误类型
    - 可通过 `/api/queue-numbers/problems/` 查询
    """,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(packages.router)
app.include_router(patients.router)
app.include_router(queue.router)


@app.get("/", summary="健康检查")
def health_check():
    return {
        "status": "ok",
        "service": "体检中心空腹项目排队 API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/rules-summary", summary="获取规则摘要")
def get_rules_summary():
    return {
        "title": "体检中心空腹项目排队规则摘要",
        "core_rules": [
            "空腹抽血、B超 等空腹项目必须在餐后项目之前进行",
            "餐后血糖 等餐后项目必须在空腹项目完成后才能开始",
            "项目依赖必须按顺序完成",
            "顺序错误会影响检查结果",
        ],
        "error_handling": [
            "违反规则的请求会被拒绝",
            "所有错误请求会记录到问题列表",
            "问题列表保留原始数据和错误原因",
        ],
        "status_flow": {
            "pending": ["in_progress", "cancelled", "rescheduled", "invalid"],
            "in_progress": ["completed", "cancelled", "rescheduled"],
            "completed": [],
            "rescheduled": ["pending"],
            "cancelled": [],
            "invalid": [],
        }
    }
