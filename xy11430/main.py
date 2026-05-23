from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import Base, engine
from app.api import auth, batches, imports, receipts, reports

settings = get_settings()

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="学校实验室耗材异常回执状态机 API - 管理领用单、采购到货表、老师补签记录的异常状态追踪",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(batches.router, prefix="/api")
app.include_router(imports.router, prefix="/api")
app.include_router(receipts.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(reports.router_health, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.on_event("startup")
async def startup_event():
    from app.core.database import SessionLocal
    from app.models.models import User, UserRole
    from app.utils.security import get_password_hash

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(
                username="admin",
                real_name="系统管理员",
                hashed_password=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                email="admin@school.edu",
                is_active=True
            )
            db.add(admin)
            db.commit()

        secretary = db.query(User).filter(User.username == "secretary").first()
        if not secretary:
            secretary = User(
                username="secretary",
                real_name="学院秘书",
                hashed_password=get_password_hash("secretary123"),
                role=UserRole.COLLEGE_SECRETARY,
                college="计算机学院",
                email="secretary@school.edu",
                is_active=True
            )
            db.add(secretary)
            db.commit()
    finally:
        db.close()
