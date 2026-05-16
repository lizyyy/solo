from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import subscriptions, notifications, reports
import uvicorn

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="数据血缘订阅API",
    description="报表字段变更血缘影响订阅通知服务",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(subscriptions.router, prefix="/api/subscriptions", tags=["订阅管理"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["通知管理"])
app.include_router(reports.router, prefix="/api/reports", tags=["影响报告"])

@app.get("/")
def root():
    return {"message": "数据血缘订阅API服务", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
