from fastapi import FastAPI
from api import gateway, replay, approval, reports
from database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="事件重放审批服务", version="1.0.0")

app.include_router(gateway.router, prefix="/api/gateway", tags=["网关错误摘录"])
app.include_router(replay.router, prefix="/api/replay", tags=["事件重放"])
app.include_router(approval.router, prefix="/api/approval", tags=["审批管理"])
app.include_router(reports.router, prefix="/api/reports", tags=["报告生成"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "事件重放审批服务"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
