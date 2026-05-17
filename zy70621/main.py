from fastapi import FastAPI
from app.database import engine, Base
from app.routers import buildings, handlers, repairs, export

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="物业催办外包派单完工复核后端API",
    description="小区业主报修管理系统，支持超时提醒、重复催办合并、外包派单、完工复核等功能",
    version="1.0.0"
)

app.include_router(buildings.router)
app.include_router(handlers.router)
app.include_router(repairs.router)
app.include_router(export.router)


@app.get("/")
def read_root():
    return {
        "message": "物业催办外包派单完工复核后端API",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
