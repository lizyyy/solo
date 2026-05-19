from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="多语言文案发布台 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from database import engine, Base
from routers import translation, version, report

Base.metadata.create_all(bind=engine)

app.include_router(translation.router)
app.include_router(version.router)
app.include_router(report.router)


@app.get("/")
async def root():
    return {"message": "多语言文案发布台 API 服务运行中"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
