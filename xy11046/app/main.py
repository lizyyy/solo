from fastapi import FastAPI
from app.api.v1 import router

app = FastAPI(
    title="公益助餐点助餐券资格核验API",
    description="支持批量补录和单条人工处理的助餐券资格核验系统",
    version="1.0.0"
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "message": "公益助餐点助餐券资格核验API",
        "version": "1.0.0",
        "docs": "/docs"
    }
