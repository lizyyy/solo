from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, get_db
from app.api.auth import router as auth_router
from app.api.ledger import router as ledger_router
from app.services.auth_service import create_initial_users

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="生鲜分拣损耗权限追责台账 API",
    description="从供应商送货单、称重记录、退筐照片和二次确认单建账，支持草稿、提交、驳回、二次确认、只读审计、脱敏导出全流程状态管理",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(ledger_router)


@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    create_initial_users(db)
    db.close()


@app.get("/", tags=["根路径"])
async def root():
    return {
        "message": "生鲜分拣损耗权限追责台账 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["健康检查"])
async def health_check():
    return {"status": "healthy"}
