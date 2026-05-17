from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
import pandas as pd
import io
import uuid
from enum import Enum

from database import (
    get_db, init_db,
    Supplier, Category, RejectionThreshold,
    ArrivalOrder, TemperatureRecord, InspectionReport
)

app = FastAPI(
    title="生鲜温度拒收阈值供应商统计后端API",
    description="生鲜采购到货温度检测与拒收管理系统",
    version="1.0.0"
)

class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    RESOURCE_NOT_FOUND = "resource_not_found"
    DUPLICATE_DATA = "duplicate_data"

class CustomHTTPException(HTTPException):
    def __init__(self, error_code: ErrorCode, message: str, detail: dict = None, status_code: int = 400):
        super().__init__(
            status_code=status_code,
            detail={
                "error_code": error_code.value,
                "message": message,
                "detail": detail or {}
            }
        )

@app.exception_handler(CustomHTTPException)
async def custom_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content=exc.detail
    )

@app.on_event("startup")
async def startup_event():
    init_db()

class SupplierCreate(BaseModel):
    code: str = Field(..., description="供应商编码")
    name: str = Field(..., description="供应商名称")
    contact: Optional[str] = None
    phone: Optional[str] = None

class SupplierResponse(BaseModel):
    id: int
    code: str
    name: str
    contact: Optional[str]
    phone: Optional[str]
    is_active: bool
    
    class Config:
        orm_mode = True

class CategoryCreate(BaseModel):
    code: str = Field(..., description="品类编码")
    name: str = Field(..., description="品类名称")
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    
    class Config:
        orm_mode = True

class ThresholdCreate(BaseModel):
    category_id: int = Field(..., description="品类ID")
    min_temperature: float = Field(..., description="最低温度阈值")
    max_temperature: float = Field(..., description="最高温度阈值")
    sample_size: int = Field(5, description="抽样数量")
    reject_count_threshold: int = Field(2, description="拒收异常数量阈值")

class ThresholdResponse(BaseModel):
    id: int
    category_id: int
    category_name: str
    min_temperature: float
    max_temperature: float
    sample_size: int
    reject_count_threshold: int
    is_active: bool
    
    class Config:
        orm_mode = True

class ArrivalOrderCreate(BaseModel):
    order_no: str = Field(..., description="到货单号")
    supplier_code: str = Field(..., description="供应商编码")
    category_code: str = Field(..., description="品类编码")
    arrival_date: datetime = Field(..., description="到货日期")
    batch_no: str = Field(..., description="批次号")
    quantity: float = Field(..., description="数量")
    unit: str = Field("kg", description="单位")
    vehicle_no: Optional[str] = None
    driver_name: Optional[str] = None

class ArrivalOrderResponse(BaseModel):
    id: int
    order_no: str
    supplier_name: str
    category_name: str
    arrival_date: datetime
    batch_no: str
    quantity: float
    unit: str
    status: str
    
    class Config:
        orm_mode = True

class TemperatureRecordCreate(BaseModel):
    order_no: str = Field(..., description="到货单号")
    record_no: str = Field(..., description="记录编号")
    measure_time: datetime = Field(..., description="测量时间")
    temperature: float = Field(..., description="温度值")
    measure_point: Optional[str] = None
    operator: Optional[str] = None

class TemperatureRecordResponse(BaseModel):
    id: int
    order_no: str
    record_no: str
    measure_time: datetime
    temperature: float
    measure_point: Optional[str]
    is_anomaly: bool
    is_reviewed: bool
    
    class Config:
        orm_mode = True

class InspectionReportResponse(BaseModel):
    id: int
    report_no: str
    order_no: str
    supplier_name: str
    category_name: str
    inspection_date: datetime
    total_samples: int
    anomaly_count: int
    threshold_violated: bool
    result: str
    is_processed: bool
    
    class Config:
        orm_mode = True

class SupplierStatsResponse(BaseModel):
    supplier_id: int
    supplier_code: str
    supplier_name: str
    total_arrivals: int
    total_rejections: int
    rejection_rate: float
    total_anomalies: int
    last_arrival_date: Optional[datetime]

@app.post("/suppliers/", response_model=SupplierResponse)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    existing = db.query(Supplier).filter(Supplier.code == supplier.code).first()
    if existing:
        raise CustomHTTPException(
            error_code=ErrorCode.DUPLICATE_DATA,
            message=f"供应商编码 {supplier.code} 已存在",
            detail={"code": supplier.code}
        )
    db_supplier = Supplier(**supplier.dict())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@app.get("/suppliers/", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()

@app.post("/categories/", response_model=CategoryResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Category).filter(Category.code == category.code).first()
    if existing:
        raise CustomHTTPException(
            error_code=ErrorCode.DUPLICATE_DATA,
            message=f"品类编码 {category.code} 已存在",
            detail={"code": category.code}
        )
    db_category = Category(**category.dict())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@app.get("/categories/", response_model=List[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).all()

@app.post("/thresholds/", response_model=ThresholdResponse)
def create_threshold(threshold: ThresholdCreate, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == threshold.category_id).first()
    if not category:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"品类ID {threshold.category_id} 不存在",
            status_code=404
        )
    db.query(RejectionThreshold).filter(
        RejectionThreshold.category_id == threshold.category_id
    ).update({"is_active": False})
    
    db_threshold = RejectionThreshold(**threshold.dict())
    db.add(db_threshold)
    db.commit()
    db.refresh(db_threshold)
    result = {
        "id": db_threshold.id,
        "category_id": db_threshold.category_id,
        "category_name": category.name,
        "min_temperature": db_threshold.min_temperature,
        "max_temperature": db_threshold.max_temperature,
        "sample_size": db_threshold.sample_size,
        "reject_count_threshold": db_threshold.reject_count_threshold,
        "is_active": db_threshold.is_active
    }
    return result

@app.get("/thresholds/", response_model=List[ThresholdResponse])
def list_thresholds(db: Session = Depends(get_db)):
    thresholds = db.query(RejectionThreshold).join(Category).all()
    result = []
    for t in thresholds:
        result.append({
            "id": t.id,
            "category_id": t.category_id,
            "category_name": t.category.name,
            "min_temperature": t.min_temperature,
            "max_temperature": t.max_temperature,
            "sample_size": t.sample_size,
            "reject_count_threshold": t.reject_count_threshold,
            "is_active": t.is_active
        })
    return result

@app.post("/arrival-orders/", response_model=ArrivalOrderResponse)
def create_arrival_order(order: ArrivalOrderCreate, db: Session = Depends(get_db)):
    existing = db.query(ArrivalOrder).filter(ArrivalOrder.order_no == order.order_no).first()
    if existing:
        raise CustomHTTPException(
            error_code=ErrorCode.DUPLICATE_DATA,
            message=f"到货单号 {order.order_no} 已存在",
            detail={"order_no": order.order_no}
        )
    
    supplier = db.query(Supplier).filter(Supplier.code == order.supplier_code).first()
    if not supplier:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"供应商编码 {order.supplier_code} 不存在",
            detail={"supplier_code": order.supplier_code}
        )
    
    category = db.query(Category).filter(Category.code == order.category_code).first()
    if not category:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"品类编码 {order.category_code} 不存在",
            detail={"category_code": order.category_code}
        )
    
    order_data = order.dict(exclude={"supplier_code", "category_code"})
    order_data["supplier_id"] = supplier.id
    order_data["category_id"] = category.id
    
    db_order = ArrivalOrder(**order_data)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    result = {
        "id": db_order.id,
        "order_no": db_order.order_no,
        "supplier_name": supplier.name,
        "category_name": category.name,
        "arrival_date": db_order.arrival_date,
        "batch_no": db_order.batch_no,
        "quantity": db_order.quantity,
        "unit": db_order.unit,
        "status": db_order.status
    }
    return result

@app.get("/arrival-orders/", response_model=List[ArrivalOrderResponse])
def list_arrival_orders(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ArrivalOrder).join(Supplier).join(Category)
    if status:
        query = query.filter(ArrivalOrder.status == status)
    orders = query.all()
    
    result = []
    for o in orders:
        result.append({
            "id": o.id,
            "order_no": o.order_no,
            "supplier_name": o.supplier.name,
            "category_name": o.category.name,
            "arrival_date": o.arrival_date,
            "batch_no": o.batch_no,
            "quantity": o.quantity,
            "unit": o.unit,
            "status": o.status
        })
    return result

@app.post("/temperature-records/", response_model=TemperatureRecordResponse)
def create_temperature_record(record: TemperatureRecordCreate, db: Session = Depends(get_db)):
    order = db.query(ArrivalOrder).filter(ArrivalOrder.order_no == record.order_no).first()
    if not order:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"到货单号 {record.order_no} 不存在",
            detail={"order_no": record.order_no}
        )
    
    record_data = record.dict(exclude={"order_no"})
    record_data["arrival_order_id"] = order.id
    
    db_record = TemperatureRecord(**record_data)
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    result = {
        "id": db_record.id,
        "order_no": order.order_no,
        "record_no": db_record.record_no,
        "measure_time": db_record.measure_time,
        "temperature": db_record.temperature,
        "measure_point": db_record.measure_point,
        "is_anomaly": db_record.is_anomaly,
        "is_reviewed": db_record.is_reviewed
    }
    return result

@app.post("/import/arrival-orders/csv")
def import_arrival_orders_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = file.file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        required_columns = ["order_no", "supplier_code", "category_code", "arrival_date", "batch_no", "quantity"]
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise CustomHTTPException(
                error_code=ErrorCode.MISSING_FIELD,
                message=f"CSV缺少必要字段",
                detail={"missing_columns": missing_cols}
            )
        
        success_count = 0
        failed_records = []
        
        for idx, row in df.iterrows():
            try:
                supplier = db.query(Supplier).filter(Supplier.code == str(row["supplier_code"])).first()
                if not supplier:
                    raise ValueError(f"供应商编码不存在: {row['supplier_code']}")
                
                category = db.query(Category).filter(Category.code == str(row["category_code"])).first()
                if not category:
                    raise ValueError(f"品类编码不存在: {row['category_code']}")
                
                existing = db.query(ArrivalOrder).filter(ArrivalOrder.order_no == str(row["order_no"])).first()
                if existing:
                    raise ValueError(f"到货单号已存在: {row['order_no']}")
                
                order = ArrivalOrder(
                    order_no=str(row["order_no"]),
                    supplier_id=supplier.id,
                    category_id=category.id,
                    arrival_date=pd.to_datetime(row["arrival_date"]).to_pydatetime(),
                    batch_no=str(row["batch_no"]),
                    quantity=float(row["quantity"]),
                    unit=str(row.get("unit", "kg")),
                    vehicle_no=str(row.get("vehicle_no", "")),
                    driver_name=str(row.get("driver_name", ""))
                )
                db.add(order)
                success_count += 1
            except Exception as e:
                failed_records.append({"row": idx + 2, "error": str(e)})
        
        db.commit()
        return {
            "success": True,
            "imported_count": success_count,
            "failed_count": len(failed_records),
            "failed_records": failed_records
        }
    except CustomHTTPException:
        raise
    except Exception as e:
        raise CustomHTTPException(
            error_code=ErrorCode.MISSING_FIELD,
            message=f"CSV文件解析失败: {str(e)}"
        )

@app.post("/import/temperature-records/csv")
def import_temperature_records_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = file.file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        required_columns = ["order_no", "record_no", "measure_time", "temperature"]
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise CustomHTTPException(
                error_code=ErrorCode.MISSING_FIELD,
                message=f"CSV缺少必要字段",
                detail={"missing_columns": missing_cols}
            )
        
        success_count = 0
        failed_records = []
        
        for idx, row in df.iterrows():
            try:
                order = db.query(ArrivalOrder).filter(ArrivalOrder.order_no == str(row["order_no"])).first()
                if not order:
                    raise ValueError(f"到货单号不存在: {row['order_no']}")
                
                record = TemperatureRecord(
                    arrival_order_id=order.id,
                    record_no=str(row["record_no"]),
                    measure_time=pd.to_datetime(row["measure_time"]).to_pydatetime(),
                    temperature=float(row["temperature"]),
                    measure_point=str(row.get("measure_point", "")),
                    operator=str(row.get("operator", ""))
                )
                db.add(record)
                success_count += 1
            except Exception as e:
                failed_records.append({"row": idx + 2, "error": str(e)})
        
        db.commit()
        return {
            "success": True,
            "imported_count": success_count,
            "failed_count": len(failed_records),
            "failed_records": failed_records
        }
    except CustomHTTPException:
        raise
    except Exception as e:
        raise CustomHTTPException(
            error_code=ErrorCode.MISSING_FIELD,
            message=f"CSV文件解析失败: {str(e)}"
        )

def check_temperature_anomaly(temperature: float, threshold: RejectionThreshold) -> bool:
    return temperature < threshold.min_temperature or temperature > threshold.max_temperature

@app.post("/inspection/generate/{order_no}", response_model=InspectionReportResponse)
def generate_inspection_report(order_no: str, db: Session = Depends(get_db)):
    order = db.query(ArrivalOrder).filter(ArrivalOrder.order_no == order_no).first()
    if not order:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"到货单号 {order_no} 不存在",
            status_code=404
        )
    
    if order.status == "completed":
        raise CustomHTTPException(
            error_code=ErrorCode.ALREADY_PROCESSED,
            message=f"到货单 {order_no} 已处理完成",
            detail={"order_no": order_no, "current_status": order.status}
        )
    
    existing_report = db.query(InspectionReport).filter(InspectionReport.arrival_order_id == order.id).first()
    if existing_report:
        raise CustomHTTPException(
            error_code=ErrorCode.ALREADY_PROCESSED,
            message=f"到货单 {order_no} 已生成质检报告",
            detail={"report_no": existing_report.report_no}
        )
    
    threshold = db.query(RejectionThreshold).filter(
        RejectionThreshold.category_id == order.category_id,
        RejectionThreshold.is_active == True
    ).first()
    
    if not threshold:
        raise CustomHTTPException(
            error_code=ErrorCode.NEEDS_MANUAL_REVIEW,
            message=f"品类 {order.category.name} 未配置拒收阈值，需要人工审核",
            detail={"category": order.category.name}
        )
    
    records = db.query(TemperatureRecord).filter(TemperatureRecord.arrival_order_id == order.id).all()
    if len(records) < threshold.sample_size:
        raise CustomHTTPException(
            error_code=ErrorCode.NEEDS_MANUAL_REVIEW,
            message=f"温度记录数量不足，需要抽样 {threshold.sample_size} 条，当前只有 {len(records)} 条",
            detail={"required": threshold.sample_size, "current": len(records)}
        )
    
    anomaly_count = 0
    for record in records:
        is_anomaly = check_temperature_anomaly(record.temperature, threshold)
        record.is_anomaly = is_anomaly
        if is_anomaly:
            anomaly_count += 1
    
    threshold_violated = anomaly_count >= threshold.reject_count_threshold
    result = "拒收" if threshold_violated else "通过"
    conclusion = f"抽检 {len(records)} 个样本，异常 {anomaly_count} 个，超过拒收阈值 {threshold.reject_count_threshold} 个，判定{result}" if threshold_violated else f"抽检 {len(records)} 个样本，异常 {anomaly_count} 个，未超过拒收阈值，判定{result}"
    
    report_no = f"RPT{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"
    
    report = InspectionReport(
        report_no=report_no,
        arrival_order_id=order.id,
        supplier_id=order.supplier_id,
        total_samples=len(records),
        anomaly_count=anomaly_count,
        threshold_violated=threshold_violated,
        result=result,
        conclusion=conclusion
    )
    db.add(report)
    
    order.status = "inspected"
    db.commit()
    db.refresh(report)
    
    result_data = {
        "id": report.id,
        "report_no": report.report_no,
        "order_no": order.order_no,
        "supplier_name": order.supplier.name,
        "category_name": order.category.name,
        "inspection_date": report.inspection_date,
        "total_samples": report.total_samples,
        "anomaly_count": report.anomaly_count,
        "threshold_violated": report.threshold_violated,
        "result": report.result,
        "is_processed": report.is_processed
    }
    return result_data

@app.post("/inspection/process/{report_no}")
def process_inspection_report(report_no: str, inspector: str, db: Session = Depends(get_db)):
    report = db.query(InspectionReport).filter(InspectionReport.report_no == report_no).first()
    if not report:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"质检报告 {report_no} 不存在",
            status_code=404
        )
    
    if report.is_processed:
        raise CustomHTTPException(
            error_code=ErrorCode.ALREADY_PROCESSED,
            message=f"质检报告 {report_no} 已处理",
            detail={"report_no": report_no}
        )
    
    report.is_processed = True
    report.inspector = inspector
    
    order = db.query(ArrivalOrder).filter(ArrivalOrder.id == report.arrival_order_id).first()
    order.status = "completed"
    
    db.commit()
    return {"success": True, "message": "报告处理完成"}

@app.get("/inspection-reports/", response_model=List[InspectionReportResponse])
def list_inspection_reports(
    result: Optional[str] = None,
    is_processed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionReport).join(ArrivalOrder).join(Supplier).join(Category)
    if result:
        query = query.filter(InspectionReport.result == result)
    if is_processed is not None:
        query = query.filter(InspectionReport.is_processed == is_processed)
    
    reports = query.all()
    result_data = []
    for r in reports:
        result_data.append({
            "id": r.id,
            "report_no": r.report_no,
            "order_no": r.arrival_order.order_no,
            "supplier_name": r.supplier.name,
            "category_name": r.arrival_order.category.name,
            "inspection_date": r.inspection_date,
            "total_samples": r.total_samples,
            "anomaly_count": r.anomaly_count,
            "threshold_violated": r.threshold_violated,
            "result": r.result,
            "is_processed": r.is_processed
        })
    return result_data

@app.get("/suppliers/stats", response_model=List[SupplierStatsResponse])
def get_supplier_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Supplier)
    suppliers = query.all()
    
    stats = []
    for supplier in suppliers:
        arrivals_query = db.query(ArrivalOrder).filter(ArrivalOrder.supplier_id == supplier.id)
        if start_date:
            arrivals_query = arrivals_query.filter(ArrivalOrder.arrival_date >= start_date)
        if end_date:
            arrivals_query = arrivals_query.filter(ArrivalOrder.arrival_date <= end_date)
        
        total_arrivals = arrivals_query.count()
        
        rejection_count = db.query(InspectionReport).filter(
            InspectionReport.supplier_id == supplier.id,
            InspectionReport.result == "拒收"
        ).count()
        
        total_anomalies = db.query(TemperatureRecord).join(ArrivalOrder).filter(
            ArrivalOrder.supplier_id == supplier.id,
            TemperatureRecord.is_anomaly == True
        ).count()
        
        last_arrival = db.query(func.max(ArrivalOrder.arrival_date)).filter(
            ArrivalOrder.supplier_id == supplier.id
        ).scalar()
        
        rejection_rate = (rejection_count / total_arrivals * 100) if total_arrivals > 0 else 0
        
        stats.append({
            "supplier_id": supplier.id,
            "supplier_code": supplier.code,
            "supplier_name": supplier.name,
            "total_arrivals": total_arrivals,
            "total_rejections": rejection_count,
            "rejection_rate": round(rejection_rate, 2),
            "total_anomalies": total_anomalies,
            "last_arrival_date": last_arrival
        })
    
    return stats

@app.get("/anomaly-records/")
def get_anomaly_records(db: Session = Depends(get_db)):
    records = db.query(TemperatureRecord).join(ArrivalOrder).filter(
        TemperatureRecord.is_anomaly == True
    ).all()
    
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "order_no": r.arrival_order.order_no,
            "record_no": r.record_no,
            "measure_time": r.measure_time,
            "temperature": r.temperature,
            "measure_point": r.measure_point,
            "operator": r.operator,
            "is_reviewed": r.is_reviewed,
            "review_note": r.review_note
        })
    return result

@app.put("/anomaly-records/{record_id}/review")
def review_anomaly_record(record_id: int, review_note: str, db: Session = Depends(get_db)):
    record = db.query(TemperatureRecord).filter(TemperatureRecord.id == record_id).first()
    if not record:
        raise CustomHTTPException(
            error_code=ErrorCode.RESOURCE_NOT_FOUND,
            message=f"温度记录 {record_id} 不存在",
            status_code=404
        )
    
    if not record.is_anomaly:
        raise CustomHTTPException(
            error_code=ErrorCode.INVALID_STATUS,
            message=f"该记录不是异常记录，无需审核",
            detail={"record_id": record_id}
        )
    
    record.is_reviewed = True
    record.review_note = review_note
    db.commit()
    return {"success": True, "message": "审核完成"}

@app.get("/export/inspection-reports")
def export_inspection_reports(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionReport).join(ArrivalOrder).join(Supplier).join(Category)
    if start_date:
        query = query.filter(InspectionReport.inspection_date >= start_date)
    if end_date:
        query = query.filter(InspectionReport.inspection_date <= end_date)
    
    reports = query.all()
    
    data = []
    for r in reports:
        data.append({
            "报告编号": r.report_no,
            "到货单号": r.arrival_order.order_no,
            "供应商": r.supplier.name,
            "品类": r.arrival_order.category.name,
            "批次号": r.arrival_order.batch_no,
            "到货日期": r.arrival_order.arrival_date.strftime("%Y-%m-%d"),
            "质检日期": r.inspection_date.strftime("%Y-%m-%d"),
            "抽样数量": r.total_samples,
            "异常数量": r.anomaly_count,
            "阈值超标": r.threshold_violated,
            "质检结果": r.result,
            "是否处理": "是" if r.is_processed else "否",
            "检验员": r.inspector or ""
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='质检报告')
    
    output.seek(0)
    filename = f"inspection_reports_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/export/supplier-stats")
def export_supplier_stats(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    stats = get_supplier_stats(start_date, end_date, db)
    
    data = []
    for s in stats:
        data.append({
            "供应商编码": s["supplier_code"],
            "供应商名称": s["supplier_name"],
            "到货总次数": s["total_arrivals"],
            "拒收次数": s["total_rejections"],
            "拒收率(%)": s["rejection_rate"],
            "异常记录总数": s["total_anomalies"],
            "最后到货日期": s["last_arrival_date"].strftime("%Y-%m-%d") if s["last_arrival_date"] else ""
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='供应商统计')
    
    output.seek(0)
    filename = f"supplier_stats_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "生鲜温度拒收阈值供应商统计API运行正常"}
