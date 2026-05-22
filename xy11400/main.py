from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.auth import create_initial_users
from app.routers import auth, batches, exports, users

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    create_initial_users(db)
finally:
    db.close()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="冷链中转异常回执状态机 API",
    description="""
    冷链中转异常回执状态机服务，用于追踪冷链运输异常批次的处理状态。
    
    ## 功能特性
    
    - **批次管理**: 创建、查询、更新批次信息
    - **状态机**: 批次状态流转（创建→附件上传→复核→冻结→归档）
    - **材料上传**: 司机照片、WMS箱号表、温度记录仪片段、主管批注
    - **脏记录处理**: 缺字段、跨日、改名、金额/数量冲突识别与处理
    - **权限控制**: 录入、复核、主管、只读查看四级权限
    - **数据导出**: Excel导出，包含冻结前后状态、人工理由等关键信息
    
    ## 默认账号
    
    | 用户名 | 密码 | 角色 |
    |--------|------|------|
    | admin | admin123 | 主管 |
    | reviewer | reviewer123 | 复核员 |
    | operator | operator123 | 录入员 |
    | viewer | viewer123 | 只读 |
    """,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(batches.router, prefix=settings.API_V1_STR)
app.include_router(exports.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)


@app.get("/", tags=["系统"])
async def root():
    return {
        "message": "冷链中转异常回执状态机 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy"}
