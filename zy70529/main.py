from fastapi import FastAPI
from app.database import init_db
from app.api import compensation_router, health_router

app = FastAPI(title="队列消费补偿API", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    init_db()

app.include_router(compensation_router, prefix="/api/v1/compensation", tags=["补偿管理"])
app.include_router(health_router, prefix="/api/v1/health", tags=["健康检查"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
