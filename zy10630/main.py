from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import appeal, batch

Base.metadata.create_all(bind=engine)

app = FastAPI(title="图像审核服务误封样本申诉 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(appeal.router, prefix="/api/appeal", tags=["申诉管理"])
app.include_router(batch.router, prefix="/api/batch", tags=["批量管理"])


@app.get("/health")
def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
