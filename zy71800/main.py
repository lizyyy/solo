from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import credit_ledger, transaction_flow, writeoff, export

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="备用金占用冲销系统",
    description="风控运营早会用 — 授信台账导入、备用金占用冲销复核、风险检测、变更追踪、导出",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(credit_ledger.router)
app.include_router(transaction_flow.router)
app.include_router(writeoff.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {"system": "备用金占用冲销", "version": "1.0.0", "status": "running"}
