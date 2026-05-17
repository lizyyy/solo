from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from database import engine
from models import Base
from routes import device, inspection, quote, review, report
from schemas import ErrorCode

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


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    missing_fields = []
    for error in errors:
        if error.get("type") == "missing":
            loc = error.get("loc", [])
            if len(loc) > 1:
                missing_fields.append(str(loc[-1]))
            elif len(loc) == 1:
                missing_fields.append(str(loc[0]))
    
    if missing_fields:
        return JSONResponse(
            status_code=400,
            content={
                "code": ErrorCode.MISSING_FIELD,
                "message": f"缺少必填字段: {', '.join(missing_fields)}",
                "details": {"fields": missing_fields}
            }
        )
    
    return JSONResponse(
        status_code=400,
        content={
            "code": ErrorCode.VALIDATION_ERROR,
            "message": "请求参数校验失败",
            "details": {"errors": errors}
        }
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
