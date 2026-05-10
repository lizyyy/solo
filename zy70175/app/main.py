from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.exceptions import BusinessException
from app.routers import receipts, contracts, claims, refunds, reports, logs

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="合同收款认领 API",
    description="收款流水、合同匹配、认领审批、发票核销、退款退回、财务报表后端闭环",
    version="1.0.0",
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
        status_code=exc.http_status,
        content={
            "code": exc.code,
            "message": exc.message,
            "detail": exc.detail,
        },
    )


@app.get("/")
def root():
    return {
        "service": "合同收款认领 API",
        "version": "1.0.0",
        "docs": "/docs",
    }


app.include_router(contracts.router)
app.include_router(receipts.router)
app.include_router(claims.router)
app.include_router(refunds.router)
app.include_router(reports.router)
app.include_router(logs.router)
