from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import batches_router, points_router, balance_router, review_router, export_router
from app.core.database import engine, Base
from app.models.models import PointBatch, FrozenBalance, PointTransaction, BalanceSnapshot, ReviewRecord

Base.metadata.create_all(bind=engine)

app = FastAPI(title="会员积分账本API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches_router, prefix="/api/batches", tags=["积分批次"])
app.include_router(points_router, prefix="/api/points", tags=["积分操作"])
app.include_router(balance_router, prefix="/api/balance", tags=["余额快照"])
app.include_router(review_router, prefix="/api/review", tags=["比对复核"])
app.include_router(export_router, prefix="/api/export", tags=["导出"])

@app.get("/")
def root():
    return {"message": "会员积分账本API服务运行中", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
