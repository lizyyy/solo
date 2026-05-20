from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="实验环境重置 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.reset_requests import router as reset_requests_router
from app.api.lab_spaces import router as lab_spaces_router
from app.api.snapshots import router as snapshots_router
from app.api.logs import router as logs_router

app.include_router(reset_requests_router, prefix="/api/reset-requests", tags=["重置申请"])
app.include_router(lab_spaces_router, prefix="/api/lab-spaces", tags=["实验空间"])
app.include_router(snapshots_router, prefix="/api/snapshots", tags=["快照"])
app.include_router(logs_router, prefix="/api/logs", tags=["日志"])


@app.get("/")
def root():
    return {"message": "实验环境重置 API 运行中", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)