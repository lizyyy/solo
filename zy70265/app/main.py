from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base, SessionLocal
from app.routers import router
from app.config import API_PREFIX
from app.services import BusinessException

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="实验室气瓶余量预警系统 API",
    description="用于管理实验室气瓶余量、借用登记、危险分类联动预警和换瓶申请的系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )

app.include_router(router, prefix=API_PREFIX, tags=["cylinders"])

@app.get("/")
def root():
    return {
        "name": "实验室气瓶余量预警系统",
        "version": "1.0.0",
        "docs": "/docs",
        "api_prefix": API_PREFIX
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}
