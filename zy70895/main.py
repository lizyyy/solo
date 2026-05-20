from fastapi import FastAPI
from app.database import engine
from app import models
from app.api import batches, materials, review, export

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="制造工单返修归因系统",
    description="工厂质量工程师可以提交材料、触发复核流程、查询处理轨迹和导出数据",
    version="1.0.0"
)

app.include_router(batches.router)
app.include_router(materials.router)
app.include_router(review.router)
app.include_router(export.router)


@app.get("/")
def root():
    return {
        "message": "制造工单返修归因系统API服务",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
