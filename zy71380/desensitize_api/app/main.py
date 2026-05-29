from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database import init_db
from app.routers import rules, scan, exceptions, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="日志脱敏一致性API",
    description="检查日志、JSON导出和客服截图里的手机号是否都按同一规则脱敏",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(rules.router)
app.include_router(scan.router)
app.include_router(exceptions.router)
app.include_router(reports.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "日志脱敏一致性API"}
