from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api import ad_plans, status_logs, pause_rules, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(title="广告投放预算API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ad_plans.router, prefix="/api/ad-plans", tags=["广告计划"])
app.include_router(status_logs.router, prefix="/api/status-logs", tags=["状态日志"])
app.include_router(pause_rules.router, prefix="/api/pause-rules", tags=["暂停规则"])
app.include_router(reports.router, prefix="/api/reports", tags=["投放报表"])

@app.get("/")
def root():
    return {"message": "广告投放预算API"}
