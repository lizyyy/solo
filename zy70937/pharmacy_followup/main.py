from fastapi import FastAPI
from contextlib import asynccontextmanager

from database import engine, Base, SessionLocal
from api import router
from rules import init_default_rules


def create_tables():
    Base.metadata.create_all(bind=engine)


def init_rules():
    db = SessionLocal()
    try:
        init_default_rules(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    init_rules()
    yield


app = FastAPI(
    title="药店慢病随访提醒API",
    description="用于处理药店慢病顾客购药记录、生成随访提醒的API服务",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "药店慢病随访提醒API服务已启动",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
