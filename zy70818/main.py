from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import inventory, recall, consumption, reconciliation, report

app = FastAPI(title="口腔连锁采购对账服务", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(inventory.router, prefix="/api/inventory", tags=["库存管理"])
app.include_router(recall.router, prefix="/api/recall", tags=["召回公告"])
app.include_router(consumption.router, prefix="/api/consumption", tags=["门店消耗"])
app.include_router(reconciliation.router, prefix="/api/reconciliation", tags=["对账核对"])
app.include_router(report.router, prefix="/api/report", tags=["报告下载"])


@app.get("/")
async def root():
    return {"message": "口腔连锁采购对账服务", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
