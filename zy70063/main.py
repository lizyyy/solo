from fastapi import FastAPI
from app.database import engine, Base
from app.routers import applications, eligibility, reschedule, scores, audit, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="考试缓考审批 API",
    description="面向学生缓考、补考和成绩锁定跨系统处理的后端 API",
    version="1.0.0"
)

app.include_router(applications.router)
app.include_router(eligibility.router)
app.include_router(reschedule.router)
app.include_router(scores.router)
app.include_router(audit.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {
        "name": "考试缓考审批 API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }
