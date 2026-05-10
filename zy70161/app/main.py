from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .database import engine, Base
from .routers import (
    libraries_router,
    rules_router,
    reviews_router,
    gray_release_router,
    match_router,
    export_router,
    audit_router
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    搜索词黑白名单 API
    
    ## 核心功能
    - 词库版本管理
    - 规则管理与命中检测
    - 审核流程
    - 灰度发布与效果回查
    - 数据导出
    - 审计日志
    
    ## 状态工作流
    草稿 → 待审核 → 审核通过/驳回 → 待灰度 → 灰度中 → 生产生效/灰度不通过/回滚 → 已回滚 → 草稿/重新审核/废弃
    """
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_ERROR",
            "error_message": str(exc),
            "details": "请联系管理员或查看服务器日志"
        }
    )


@app.get("/", tags=["系统"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy"}


@app.get("/api/workflow", tags=["系统"], summary="获取完整工作流说明")
async def get_workflow():
    return {
        "statuses": {
            "draft": {"name": "草稿", "description": "规则处于编辑状态，可自由修改"},
            "pending_review": {"name": "待审核", "description": "规则已提交审核，等待审核人处理"},
            "review_rejected": {"name": "审核驳回", "description": "审核未通过，需修改后重新提交"},
            "pending_gray": {"name": "待灰度", "description": "审核通过，等待开始灰度发布"},
            "in_gray": {"name": "灰度中", "description": "正在灰度发布，部分流量可见"},
            "gray_rejected": {"name": "灰度不通过", "description": "灰度效果验证不通过"},
            "production": {"name": "生产生效", "description": "规则已全量发布到生产环境"},
            "rolled_back": {"name": "已回滚", "description": "规则已从生产或灰度回滚"},
            "deprecated": {"name": "已废弃", "description": "规则已废弃，不再使用"}
        },
        "transitions": [
            {"from": "draft", "to": "pending_review", "action": "提交审核", "description": "将草稿规则提交审核"},
            {"from": "draft", "to": "deprecated", "action": "废弃", "description": "废弃草稿规则"},
            {"from": "pending_review", "to": "pending_gray", "action": "审核通过", "description": "审核通过，进入待灰度状态"},
            {"from": "pending_review", "to": "review_rejected", "action": "审核驳回", "description": "审核驳回，返回修改"},
            {"from": "review_rejected", "to": "draft", "action": "修改后重新提交", "description": "修改后返回草稿状态"},
            {"from": "review_rejected", "to": "deprecated", "action": "废弃", "description": "废弃被驳回的规则"},
            {"from": "pending_gray", "to": "in_gray", "action": "开始灰度", "description": "开始灰度发布"},
            {"from": "pending_gray", "to": "deprecated", "action": "废弃", "description": "废弃待灰度的规则"},
            {"from": "in_gray", "to": "production", "action": "灰度通过", "description": "灰度效果验证通过，全量发布"},
            {"from": "in_gray", "to": "gray_rejected", "action": "灰度不通过", "description": "灰度效果验证不通过"},
            {"from": "in_gray", "to": "rolled_back", "action": "回滚", "description": "停止灰度发布"},
            {"from": "gray_rejected", "to": "draft", "action": "修改后重新提交", "description": "修改后返回草稿状态"},
            {"from": "gray_rejected", "to": "deprecated", "action": "废弃", "description": "废弃灰度不通过的规则"},
            {"from": "production", "to": "rolled_back", "action": "回滚", "description": "从生产环境回滚"},
            {"from": "production", "to": "deprecated", "action": "废弃", "description": "废弃生产规则"},
            {"from": "rolled_back", "to": "draft", "action": "修改后重新提交", "description": "修改后返回草稿状态"},
            {"from": "rolled_back", "to": "pending_review", "action": "重新提交审核", "description": "直接重新提交审核"},
            {"from": "rolled_back", "to": "deprecated", "action": "废弃", "description": "废弃已回滚的规则"}
        ],
        "business_rules": {
            "repeat_submit_protection": "已处理的审核请求或已停止的灰度发布不允许重复操作",
            "edit_restrictions": "待审核、灰度中、生产状态的规则不允许直接修改",
            "gray_requirements": "灰度通过前必须添加效果回查且全部通过",
            "duplicate_protection": "同一词库中不允许存在相同类型和搜索词的活跃规则"
        }
    }


app.include_router(libraries_router)
app.include_router(rules_router)
app.include_router(reviews_router)
app.include_router(gray_release_router)
app.include_router(match_router)
app.include_router(export_router)
app.include_router(audit_router)
