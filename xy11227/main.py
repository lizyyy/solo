from fastapi import FastAPI
from app.config import get_settings
from app.database import init_db
from app.routers import auth, events, orders, export
from app.auth import get_password_hash
from app.models import User, UserRole
from app.database import SessionLocal

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="换电运营工单系统 - 用于处理柜门打不开、扫码失败、空仓误报等问题的内部工单系统",
    version="1.0.0"
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(events.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(export.router, prefix=settings.API_V1_STR)


@app.on_event("startup")
async def startup_event():
    init_db()
    
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                hashed_password=get_password_hash("admin123"),
                full_name="系统管理员",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
        
        operator = db.query(User).filter(User.username == "operator").first()
        if not operator:
            operator = User(
                username="operator",
                hashed_password=get_password_hash("operator123"),
                full_name="值班员",
                role=UserRole.OPERATOR,
                is_active=True
            )
            db.add(operator)
        
        engineer = db.query(User).filter(User.username == "engineer").first()
        if not engineer:
            engineer = User(
                username="engineer",
                hashed_password=get_password_hash("engineer123"),
                full_name="维修工程师",
                role=UserRole.ENGINEER,
                is_active=True
            )
            db.add(engineer)
        
        auditor = db.query(User).filter(User.username == "auditor").first()
        if not auditor:
            auditor = User(
                username="auditor",
                hashed_password=get_password_hash("auditor123"),
                full_name="审核员",
                role=UserRole.AUDITOR,
                is_active=True
            )
            db.add(auditor)
        
        db.commit()
    finally:
        db.close()


@app.get("/")
async def root():
    return {
        "message": "欢迎使用换电运营工单系统",
        "docs": "/docs",
        "api_prefix": settings.API_V1_STR
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}