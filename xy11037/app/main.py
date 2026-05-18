from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.handover import router as handover_router

app = FastAPI(
    title="母婴护理站护理员夜班交接 API",
    description="""
    母婴护理站护理员夜班交接管理系统 API
    
    ## 功能特点
    
    * 从列表进入详情页
    * 详情页查看完整修改历史
    * 支持提交、撤回、签字、人工处理流程
    * 业务字段真实反映母婴护理场景
    * 导出支持业务语言字段名
    
    ## 业务流程
    
    1. 创建交接记录（草稿状态）
    2. 提交交接记录
    3. 交接班双方签字确认
    4. 如需修改可撤回后重新提交
    5. 异常情况可标记人工处理
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(handover_router)


@app.get("/", summary="API根路径")
async def root():
    return {
        "message": "母婴护理站护理员夜班交接 API",
        "version": "1.0.0",
        "docs": "/docs",
        "api_endpoints": {
            "列表": "GET /api/handover/",
            "创建": "POST /api/handover/",
            "详情": "GET /api/handover/{record_id}",
            "历史": "GET /api/handover/{record_id}/history",
            "导出": "GET /api/handover/{record_id}/export"
        }
    }
