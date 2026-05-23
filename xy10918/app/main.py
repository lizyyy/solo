from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import uuid
import os

from app.database import get_db, engine, Base
from app.schemas import (
    CustomerCreate, CustomerResponse, CustomerUpdate,
    CreditOrderCreate, CreditOrderResponse,
    ReturnRecordCreate, ReturnRecordResponse,
    PaymentCreate, PaymentResponse,
    DebtReportRequest, DebtReportResponse,
    ManualCorrectionRequest,
    ExceptionLogResponse,
    ApiResponse
)
from app.services import (
    CustomerService, CreditOrderService, ReturnService,
    PaymentService, ReportService, CorrectionService,
    ExceptionService, log_exception
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="农资赊销回款API",
    description="乡镇农资店赊销管理系统后端API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.get("/", response_model=ApiResponse)
async def root():
    return ApiResponse(
        success=True,
        message="农资赊销回款API服务运行中",
        data={"version": "1.0.0", "docs": "/docs"}
    )


@app.post("/api/customers", response_model=ApiResponse)
async def create_customer(
    customer: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        db_customer = CustomerService.create(db, customer)
        return ApiResponse(
            success=True,
            message="客户创建成功",
            data={"customer": CustomerResponse.from_orm(db_customer).dict()},
            request_id=request.state.request_id
        )
    except Exception as e:
        log_exception(
            db, request.state.request_id, "/api/customers", "POST",
            customer.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/customers", response_model=ApiResponse)
async def list_customers(
    skip: int = 0,
    limit: int = 100,
    only_active: bool = True,
    db: Session = Depends(get_db)
):
    customers = CustomerService.get_all(db, skip, limit, only_active)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "customers": [CustomerResponse.from_orm(c).dict() for c in customers],
            "total": len(customers)
        }
    )


@app.get("/api/customers/{customer_id}", response_model=ApiResponse)
async def get_customer(
    customer_id: int,
    db: Session = Depends(get_db)
):
    customer = CustomerService.get_by_id(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")
    return ApiResponse(
        success=True,
        message="查询成功",
        data={"customer": CustomerResponse.from_orm(customer).dict()}
    )


@app.put("/api/customers/{customer_id}", response_model=ApiResponse)
async def update_customer(
    customer_id: int,
    customer_update: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        customer = CustomerService.update(db, customer_id, customer_update)
        if not customer:
            raise HTTPException(status_code=404, detail="客户不存在")
        return ApiResponse(
            success=True,
            message="客户更新成功",
            data={"customer": CustomerResponse.from_orm(customer).dict()},
            request_id=request.state.request_id
        )
    except HTTPException:
        raise
    except Exception as e:
        log_exception(
            db, request.state.request_id, f"/api/customers/{customer_id}", "PUT",
            customer_update.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/credit-orders", response_model=ApiResponse)
async def create_credit_order(
    order: CreditOrderCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        db_order, created = CreditOrderService.create(db, order, request.state.request_id)
        message = "赊销单创建成功" if created else "赊销单已存在（幂等返回）"
        return ApiResponse(
            success=True,
            message=message,
            data={
                "order": CreditOrderResponse.from_orm(db_order).dict(),
                "created": created
            },
            request_id=request.state.request_id
        )
    except Exception as e:
        log_exception(
            db, request.state.request_id, "/api/credit-orders", "POST",
            order.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/credit-orders", response_model=ApiResponse)
async def list_credit_orders(
    skip: int = 0,
    limit: int = 100,
    customer_id: int = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    orders = CreditOrderService.get_all(db, skip, limit, customer_id, status)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "orders": [CreditOrderResponse.from_orm(o).dict() for o in orders],
            "total": len(orders)
        }
    )


@app.get("/api/credit-orders/{order_id}", response_model=ApiResponse)
async def get_credit_order(
    order_id: int,
    db: Session = Depends(get_db)
):
    order = CreditOrderService.get_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="赊销单不存在")
    return ApiResponse(
        success=True,
        message="查询成功",
        data={"order": CreditOrderResponse.from_orm(order).dict()}
    )


@app.post("/api/returns", response_model=ApiResponse)
async def create_return(
    return_record: ReturnRecordCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        db_return, created = ReturnService.create(db, return_record)
        message = "退货记录创建成功" if created else "退货记录已存在（幂等返回）"
        return ApiResponse(
            success=True,
            message=message,
            data={
                "return": ReturnRecordResponse.from_orm(db_return).dict(),
                "created": created
            },
            request_id=request.state.request_id
        )
    except Exception as e:
        log_exception(
            db, request.state.request_id, "/api/returns", "POST",
            return_record.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/returns", response_model=ApiResponse)
async def list_returns(
    skip: int = 0,
    limit: int = 100,
    order_id: int = None,
    db: Session = Depends(get_db)
):
    returns = ReturnService.get_all(db, skip, limit, order_id)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "returns": [ReturnRecordResponse.from_orm(r).dict() for r in returns],
            "total": len(returns)
        }
    )


@app.post("/api/payments", response_model=ApiResponse)
async def create_payment(
    payment: PaymentCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        db_payment, created = PaymentService.create(db, payment)
        message = "回款记录创建成功" if created else "回款记录已存在（幂等返回）"
        return ApiResponse(
            success=True,
            message=message,
            data={
                "payment": PaymentResponse.from_orm(db_payment).dict(),
                "created": created
            },
            request_id=request.state.request_id
        )
    except Exception as e:
        log_exception(
            db, request.state.request_id, "/api/payments", "POST",
            payment.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/payments", response_model=ApiResponse)
async def list_payments(
    skip: int = 0,
    limit: int = 100,
    customer_id: int = None,
    order_id: int = None,
    db: Session = Depends(get_db)
):
    payments = PaymentService.get_all(db, skip, limit, customer_id, order_id)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "payments": [PaymentResponse.from_orm(p).dict() for p in payments],
            "total": len(payments)
        }
    )


@app.post("/api/reports/generate", response_model=ApiResponse)
async def generate_report(
    report_request: DebtReportRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        report = ReportService.generate_debt_report(
            db, report_request.customer_id,
            report_request.start_date, report_request.end_date
        )
        return ApiResponse(
            success=True,
            message="报告生成成功",
            data={"report": DebtReportResponse.from_orm(report).dict()},
            request_id=request.state.request_id
        )
    except Exception as e:
        log_exception(
            db, request.state.request_id, "/api/reports/generate", "POST",
            report_request.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reports/{report_id}/export", response_model=ApiResponse)
async def export_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    try:
        file_path = ReportService.export_to_excel(db, report_id)
        return ApiResponse(
            success=True,
            message="报告导出成功",
            data={"file_path": file_path}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/reports/{report_id}/download")
async def download_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    report = ReportService.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(status_code=400, detail="报告文件不存在，请先调用导出接口")
    return FileResponse(
        report.file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"{report.report_no}.xlsx"
    )


@app.get("/api/reports", response_model=ApiResponse)
async def list_reports(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    reports = ReportService.get_all_reports(db, skip, limit)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "reports": [DebtReportResponse.from_orm(r).dict() for r in reports],
            "total": len(reports)
        }
    )


@app.post("/api/corrections/manual", response_model=ApiResponse)
async def manual_correction(
    correction_request: ManualCorrectionRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    try:
        order = CorrectionService.manual_correct(db, correction_request)
        return ApiResponse(
            success=True,
            message="人工修正成功",
            data={"order": CreditOrderResponse.from_orm(order).dict()},
            request_id=request.state.request_id
        )
    except Exception as e:
        log_exception(
            db, request.state.request_id, "/api/corrections/manual", "POST",
            correction_request.dict(), str(e), type(e).__name__
        )
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/exceptions", response_model=ApiResponse)
async def list_exceptions(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: Session = Depends(get_db)
):
    exceptions = ExceptionService.get_all(db, skip, limit, status)
    return ApiResponse(
        success=True,
        message="查询成功",
        data={
            "exceptions": [ExceptionLogResponse.from_orm(e).dict() for e in exceptions],
            "total": len(exceptions)
        }
    )


@app.put("/api/exceptions/{exception_id}/resolve", response_model=ApiResponse)
async def resolve_exception(
    exception_id: int,
    resolution: str,
    resolved_by: str,
    db: Session = Depends(get_db)
):
    exception = ExceptionService.resolve(db, exception_id, resolution, resolved_by)
    if not exception:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return ApiResponse(
        success=True,
        message="异常已处理",
        data={"exception": ExceptionLogResponse.from_orm(exception).dict()}
    )


def run(host: str = "0.0.0.0", port: int = 8000, reload: bool = False):
    """
    启动API服务的入口函数
    支持通过命令行: agri-credit-api 直接启动
    """
    import uvicorn
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)


if __name__ == "__main__":
    run(host="0.0.0.0", port=8000, reload=True)
