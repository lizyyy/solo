from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routes import device, inspection, quote, review, report

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="设备质检报价冻结复核扣减后端API",
    description="回收门店二手设备质检、报价冻结、复核扣减管理系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(device.router, prefix="/api/device", tags=["设备管理"])
app.include_router(inspection.router, prefix="/api/inspection", tags=["检测项管理"])
app.include_router(quote.router, prefix="/api/quote", tags=["报价管理"])
app.include_router(review.router, prefix="/api/review", tags=["复核管理"])
app.include_router(report.router, prefix="/api/report", tags=["质检报告"])


@app.get("/")
def root():
    return {"message": "设备质检报价冻结复核扣减系统API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
