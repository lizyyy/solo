from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import io
from openpyxl import Workbook

from database import get_db, init_db
from schemas import (
    Customer, CustomerCreate, CustomerUpdate,
    Bucket, BucketCreate,
    Delivery, DeliveryCreate,
    BucketReturn, BucketReturnCreate,
    DepositRecord,
    DepositReport,
    ErrorCode, ErrorResponse
)
from services import (
    CustomerService, BucketService, DeliveryService, ReturnService,
    DepositService, ReportService, BusinessException
)

app = FastAPI(
    title="水桶押金退桶抵扣流转追踪API",
    description="桶装水配送站押金管理系统，支持客户管理、桶流转、押金冻结与抵扣、退桶管理、报告导出等功能",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(BusinessException)
async def business_exception_handler(request, exc: BusinessException):
    status_code = status.HTTP_400_BAD_REQUEST
    if exc.code == ErrorCode.CUSTOMER_NOT_FOUND or exc.code == ErrorCode.BUCKET_NOT_FOUND:
        status_code = status.HTTP_404_NOT_FOUND
    elif exc.code == ErrorCode.NEEDS_MANUAL_REVIEW:
        status_code = status.HTTP_409_CONFLICT
    
    return JSONResponse(
        status_code=status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "detail": exc.detail
        }
    )
@app.get("/")
async def root():
    return {"message": "水桶押金退桶抵扣流转追踪API", "version": "1.0.0"}


@app.post("/api/customers/", response_model=Customer, status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    return CustomerService.create_customer(db, customer)


@app.get("/api/customers/", response_model=List[Customer])
def list_customers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return CustomerService.list_customers(db, skip, limit)


@app.get("/api/customers/{customer_id}", response_model=Customer)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = CustomerService.get_customer(db, customer_id)
    if not customer:
        raise BusinessException(
            ErrorCode.CUSTOMER_NOT_FOUND,
            "客户不存在",
            {"customer_id": customer_id}
        )
    return customer


@app.get("/api/customers/phone/{phone}", response_model=Customer)
def get_customer_by_phone(phone: str, db: Session = Depends(get_db)):
    customer = CustomerService.get_customer_by_phone(db, phone)
    if not customer:
        raise BusinessException(
            ErrorCode.CUSTOMER_NOT_FOUND,
            "客户不存在",
            {"phone": phone}
        )
    return customer


@app.put("/api/customers/{customer_id}", response_model=Customer)
def update_customer(customer_id: int, customer_update: CustomerUpdate, db: Session = Depends(get_db)):
    return CustomerService.update_customer(db, customer_id, customer_update)


@app.post("/api/buckets/", response_model=Bucket, status_code=status.HTTP_201_CREATED)
def create_bucket(bucket: BucketCreate, db: Session = Depends(get_db)):
    return BucketService.create_bucket(db, bucket)


@app.get("/api/buckets/", response_model=List[Bucket])
def list_buckets(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return BucketService.list_buckets(db, status, skip, limit)


@app.get("/api/buckets/{bucket_id}", response_model=Bucket)
def get_bucket(bucket_id: int, db: Session = Depends(get_db)):
    bucket = BucketService.get_bucket(db, bucket_id)
    if not bucket:
        raise BusinessException(
            ErrorCode.BUCKET_NOT_FOUND,
            "桶不存在",
            {"bucket_id": bucket_id}
        )
    return bucket


@app.get("/api/buckets/number/{bucket_number}", response_model=Bucket)
def get_bucket_by_number(bucket_number: str, db: Session = Depends(get_db)):
    bucket = BucketService.get_bucket_by_number(db, bucket_number)
    if not bucket:
        raise BusinessException(
            ErrorCode.BUCKET_NOT_FOUND,
            "桶不存在",
            {"bucket_number": bucket_number}
        )
    return bucket


@app.post("/api/deliveries/", response_model=Delivery, status_code=status.HTTP_201_CREATED)
def create_delivery(delivery: DeliveryCreate, db: Session = Depends(get_db)):
    return DeliveryService.create_delivery(db, delivery)


@app.get("/api/deliveries/", response_model=List[Delivery])
def list_deliveries(customer_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return DeliveryService.list_deliveries(db, customer_id, skip, limit)


@app.get("/api/deliveries/{delivery_id}", response_model=Delivery)
def get_delivery(delivery_id: int, db: Session = Depends(get_db)):
    delivery = DeliveryService.get_delivery(db, delivery_id)
    if not delivery:
        raise HTTPException(status_code=404, detail="配送单不存在")
    return delivery


@app.post("/api/returns/", response_model=BucketReturn, status_code=status.HTTP_201_CREATED)
def create_return(return_data: BucketReturnCreate, db: Session = Depends(get_db)):
    return ReturnService.create_return(db, return_data)


@app.get("/api/returns/", response_model=List[BucketReturn])
def list_returns(customer_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return ReturnService.list_returns(db, customer_id, skip, limit)


@app.get("/api/returns/{return_id}", response_model=BucketReturn)
def get_return(return_id: int, db: Session = Depends(get_db)):
    return_record = ReturnService.get_return(db, return_id)
    if not return_record:
        raise HTTPException(status_code=404, detail="退桶记录不存在")
    return return_record


@app.get("/api/deposit-records/", response_model=List[DepositRecord])
def list_deposit_records(customer_id: int = None, record_type: str = None, 
                          skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return DepositService.list_deposit_records(db, customer_id, record_type, skip, limit)


@app.get("/api/reports/deposit", response_model=DepositReport)
def get_deposit_report(db: Session = Depends(get_db)):
    return ReportService.generate_deposit_report(db)


@app.get("/api/reports/deposit/export")
def export_deposit_report(db: Session = Depends(get_db)):
    report = ReportService.generate_deposit_report(db)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "押金报告汇总"
    
    ws.append(["生成时间", report["generated_at"].strftime("%Y-%m-%d %H:%M:%S")])
    ws.append(["客户总数", report["total_customers"]])
    ws.append(["在外桶总数", report["total_pending_buckets"]])
    ws.append(["押金总额", report["total_deposit_amount"]])
    ws.append(["可用押金总额", report["total_available_deposit"]])
    ws.append([])
    
    headers = ["客户ID", "客户姓名", "手机号", "欠桶数量", "押金总额", "已用押金", "可用押金", "配送次数", "退桶次数"]
    ws.append(headers)
    
    for item in report["items"]:
        ws.append([
            item["customer_id"],
            item["customer_name"],
            item["customer_phone"],
            item["pending_buckets"],
            item["total_deposit"],
            item["used_deposit"],
            item["available_deposit"],
            item["total_deliveries"],
            item["total_returns"]
        ])
    
    for column in ws.columns:
        max_length = 0
        column_letter = column[0].column_letter
        for cell in column:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 2)
        ws.column_dimensions[column_letter].width = adjusted_width
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"deposit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
