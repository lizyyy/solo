from fastapi import FastAPI
from app.database import Base, engine
from app.routes import router as index_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="向量索引重建 API",
    description="处理知识库向量索引重建后，文档版本和召回结果一致性的专业后端服务",
    version="1.0.0"
)

app.include_router(index_router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "服务运行正常"}
