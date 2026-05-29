from fastapi import FastAPI
from fastapi.responses import JSONResponse
from app.database import engine, Base, get_db
from app.models import (
    Stage, Artist, ArtistAvailability, ChangeoverRule,
    NoiseRestriction, Schedule, ScheduleHistory, Conflict, Notification,
)
from app.routers import stages, artists, schedules, conflicts, notifications, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="音乐节舞台排程系统",
    description="排程约束、冲突提示、改动历史、通知清单、报告导出",
    version="1.0.0",
)

app.include_router(stages.router)
app.include_router(artists.router)
app.include_router(schedules.router)
app.include_router(conflicts.router)
app.include_router(notifications.router)
app.include_router(reports.router)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "服务内部错误", "detail": str(exc)},
    )


@app.on_event("startup")
def startup_seed():
    from app.seed import seed_if_empty
    db = next(get_db())
    try:
        seed_if_empty(db)
    finally:
        db.close()
