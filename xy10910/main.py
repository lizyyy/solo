from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import device, inspection, quote, review, report

Base.metadata.create_all(bind=engine)

app = FastAPI(title="二手设备质检 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(device.router, prefix="/api/devices", tags=["设备管理"])
app.include_router(inspection.router, prefix="/api/inspections", tags=["检测管理"])
app.include_router(quote.router, prefix="/api/quotes", tags=["报价管理"])
app.include_router(review.router, prefix="/api/reviews", tags=["复核管理"])
app.include_router(report.router, prefix="/api/reports", tags=["报告管理"])


@app.get("/")
def root():
    return {"message": "二手设备质检 API 服务运行中", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
