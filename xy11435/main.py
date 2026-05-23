from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import batch, receipt, export, history

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="民宿保洁排班异常回执状态机 API",
    description="处理民宿保洁排班异常回执的完整状态机服务，支持批次创建、附件补传、复核改判、冻结结算、撤回归档等核心功能",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batch.router, prefix="/api/batch", tags=["批次管理"])
app.include_router(receipt.router, prefix="/api/receipt", tags=["回执管理"])
app.include_router(history.router, prefix="/api/history", tags=["历史回溯"])
app.include_router(export.router, prefix="/api/export", tags=["导出报表"])

@app.get("/")
def read_root():
    return {"message": "民宿保洁排班异常回执状态机 API", "version": "1.0.0"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "receipt-state-machine"}
