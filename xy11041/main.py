from fastapi import FastAPI
from app.api import repair_orders
from app.models import database

app = FastAPI(
    title="充电桩运维站故障派修API",
    description="充电桩运维站充电桩故障派修管理系统，支持重复接单检测和故障闭环一致性校验",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    await database.init_db()
    await database.seed_data()

app.include_router(repair_orders.router, tags=["故障派修"])

@app.get("/")
async def root():
    return {"message": "充电桩运维站故障派修API", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
