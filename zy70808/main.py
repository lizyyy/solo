from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import batches, records, export, import_data

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="楼宇维保管理系统",
    description="设备台账、巡检照片、合同管理一体化后端服务",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(batches.router, prefix="/api/batches", tags=["批次管理"])
app.include_router(records.router, prefix="/api/records", tags=["记录管理"])
app.include_router(export.router, prefix="/api/export", tags=["数据导出"])
app.include_router(import_data.router, prefix="/api/import", tags=["数据导入"])


@app.get("/")
def root():
    return {"message": "楼宇维保管理系统 API 服务运行中", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "maintenance-system"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
