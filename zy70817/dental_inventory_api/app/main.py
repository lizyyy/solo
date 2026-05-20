from fastapi import FastAPI
from app.api import inventory, recall, consumption
from app.utils.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="口腔连锁采购库存管理API",
    description="处理库存CSV、召回公告、门店消耗表，进行库存追踪和召回管理",
    version="1.0.0"
)

app.include_router(inventory.router, prefix="/api/inventory", tags=["库存管理"])
app.include_router(recall.router, prefix="/api/recall", tags=["召回管理"])
app.include_router(consumption.router, prefix="/api/consumption", tags=["门店消耗"])

@app.get("/")
def root():
    return {"message": "口腔连锁采购库存管理API已启动", "version": "1.0.0"}
