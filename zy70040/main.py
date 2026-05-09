from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app import models
from app.routers import deposit, scan, damage, refund, reconciliation, export


models.Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="循环包材押金归还服务",
    description="循环箱、保温袋和托盘押金归还管理服务",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(deposit.router)
app.include_router(scan.router)
app.include_router(damage.router)
app.include_router(refund.router)
app.include_router(reconciliation.router)
app.include_router(export.router)


@app.get("/")
def read_root():
    return {
        "name": "循环包材押金归还服务",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
