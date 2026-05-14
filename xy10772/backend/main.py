from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import gray, approval, stats, release
from app.core.database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="移动端版本灰度后台", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gray.router, prefix="/api/gray", tags=["灰度管理"])
app.include_router(approval.router, prefix="/api/approval", tags=["审批流程"])
app.include_router(stats.router, prefix="/api/stats", tags=["统计数据"])
app.include_router(release.router, prefix="/api/release", tags=["发布记录"])

@app.get("/")
def root():
    return {"message": "灰度后台API服务运行中"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
