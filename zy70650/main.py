from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel, Field
import io
import csv

from database import get_db, init_db
from models import FuelTypeEnum
import crud
import analytics
import exporter

app = FastAPI(
    title="油耗异常GPS里程后端API",
    description="车队油卡流水和GPS里程异常检测系统API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

class ErrorCode:
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_VALUE = "INVALID_VALUE"
    NOT_FOUND = "NOT_FOUND"
    STATUS_NOT_ALLOWED = "STATUS_NOT_ALLOWED"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY"

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

class DriverCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    id_card: Optional[str] = None

class DriverResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    id_card: Optional[str] = None
    
    class Config:
        from_attributes = True

class VehicleCreate(BaseModel):
    plate_number: str
    vehicle_type: Optional[str] = None
    fuel_type: Optional[str] = "柴油"
    tank_capacity: Optional[float] = None
    standard_fuel_consumption: Optional[float] = None
    driver_id: Optional[int] = None

class VehicleResponse(BaseModel):
    id: int
    plate_number: str
    vehicle_type: Optional[str] = None
    fuel_type: Optional[str] = None
    tank_capacity: Optional[float] = None
    standard_fuel_consumption: Optional[float] = None
    driver_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class FuelRecordCreate(BaseModel):
    vehicle_id: int
    card_number: str
    fuel_date: datetime
    fuel_amount: float
    fuel_price: Optional[float] = None
    total_cost: Optional[float] = None
    odometer: Optional[float] = None
    station: Optional[str] = None

class FuelRecordResponse(BaseModel):
    id: int
    vehicle_id: int
    card_number: str
    fuel_date: datetime
    fuel_amount: float
    fuel_price: Optional[float] = None
    total_cost: Optional[float] = None
    odometer: Optional[float] = None
    station: Optional[str] = None
    
    class Config:
        from_attributes = True

class MileageRecordCreate(BaseModel):
    vehicle_id: int
    gps_device_id: Optional[str] = None
    record_date: datetime
    start_mileage: float
    end_mileage: float
    distance: float
    start_location: Optional[str] = None
    end_location: Optional[str] = None

class MileageRecordResponse(BaseModel):
    id: int
    vehicle_id: int
    gps_device_id: Optional[str] = None
    record_date: datetime
    start_mileage: float
    end_mileage: float
    distance: float
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    
    class Config:
        from_attributes = True

class AbnormalReportUpdate(BaseModel):
    status: str
    handler: Optional[str] = None
    comment: Optional[str] = None

class AbnormalReportResponse(BaseModel):
    id: int
    vehicle_id: int
    abnormal_type: str
    abnormal_level: str
    status: str
    start_date: datetime
    end_date: datetime
    actual_fuel_consumption: Optional[float] = None
    expected_fuel_consumption: Optional[float] = None
    deviation_rate: Optional[float] = None
    description: Optional[str] = None
    handler: Optional[str] = None
    handle_comment: Optional[str] = None
    
    class Config:
        from_attributes = True

@app.post("/api/drivers", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
def create_driver(driver: DriverCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_driver(db, driver.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message=f"创建司机失败: {str(e)}"
            ).model_dump()
        )

@app.post("/api/vehicles", response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def create_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    existing = crud.get_vehicle_by_plate(db, vehicle.plate_number)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.DUPLICATE_ENTRY,
                message=f"车牌号 {vehicle.plate_number} 已存在",
                details={"existing_id": existing.id}
            ).model_dump()
        )
    try:
        return crud.create_vehicle(db, vehicle.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message=f"创建车辆失败: {str(e)}"
            ).model_dump()
        )

@app.get("/api/vehicles", response_model=List[VehicleResponse])
def list_vehicles(db: Session = Depends(get_db)):
    return crud.get_all_vehicles(db)

@app.post("/api/fuel-records", response_model=FuelRecordResponse, status_code=status.HTTP_201_CREATED)
def create_fuel_record(record: FuelRecordCreate, db: Session = Depends(get_db)):
    if record.fuel_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message="加油量必须大于0"
            ).model_dump()
        )
    try:
        return crud.create_fuel_record(db, record.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message=f"创建加油记录失败: {str(e)}"
            ).model_dump()
        )

@app.get("/api/vehicles/{vehicle_id}/fuel-records", response_model=List[FuelRecordResponse])
def get_vehicle_fuel_records(vehicle_id: int, start_date: Optional[datetime] = None, 
                              end_date: Optional[datetime] = None, db: Session = Depends(get_db)):
    return crud.get_vehicle_fuel_records(db, vehicle_id, start_date, end_date)

@app.post("/api/mileage-records", response_model=MileageRecordResponse, status_code=status.HTTP_201_CREATED)
def create_mileage_record(record: MileageRecordCreate, db: Session = Depends(get_db)):
    if record.distance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message="行驶距离不能为负数"
            ).model_dump()
        )
    try:
        return crud.create_mileage_record(db, record.model_dump())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message=f"创建里程记录失败: {str(e)}"
            ).model_dump()
        )

@app.get("/api/vehicles/{vehicle_id}/mileage-records", response_model=List[MileageRecordResponse])
def get_vehicle_mileage_records(vehicle_id: int, start_date: Optional[datetime] = None,
                                 end_date: Optional[datetime] = None, db: Session = Depends(get_db)):
    return crud.get_vehicle_mileage_records(db, vehicle_id, start_date, end_date)

@app.post("/api/analyze/batch")
def batch_analyze(start_date: Optional[datetime] = None, 
                   end_date: Optional[datetime] = None, 
                   db: Session = Depends(get_db)):
    reports = analytics.generate_abnormal_reports(db, start_date, end_date)
    return {
        "message": f"分析完成，生成 {len(reports)} 条异常报告",
        "reports_count": len(reports)
    }

@app.post("/api/analyze/vehicle/{vehicle_id}")
def analyze_vehicle(vehicle_id: int, start_date: Optional[datetime] = None,
                     end_date: Optional[datetime] = None, db: Session = Depends(get_db)):
    results = analytics.analyze_vehicle_abnormal(db, vehicle_id, start_date, end_date)
    return {
        "vehicle_id": vehicle_id,
        "abnormal_count": len(results),
        "abnormal_list": results
    }

@app.get("/api/abnormal-reports", response_model=List[AbnormalReportResponse])
def list_abnormal_reports(status: Optional[str] = None, level: Optional[str] = None,
                           vehicle_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_abnormal_reports(db, status, level, vehicle_id)

@app.get("/api/abnormal-reports/{report_id}", response_model=AbnormalReportResponse)
def get_abnormal_report(report_id: int, db: Session = Depends(get_db)):
    report = crud.get_abnormal_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message="异常报告不存在"
            ).model_dump()
        )
    return report

@app.put("/api/abnormal-reports/{report_id}/status", response_model=AbnormalReportResponse)
def update_report_status(report_id: int, update: AbnormalReportUpdate, db: Session = Depends(get_db)):
    report = crud.get_abnormal_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message="异常报告不存在"
            ).model_dump()
        )
    
    if report.status in ["已处理", "已忽略"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message="该报告已处理，无法再次修改状态",
                details={"current_status": report.status}
            ).model_dump()
        )
    
    if update.status not in ["待处理", "复核中", "已处理", "已忽略"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.STATUS_NOT_ALLOWED,
                message="不允许的状态值",
                details={"allowed_statuses": ["待处理", "复核中", "已处理", "已忽略"]}
            ).model_dump()
        )
    
    if update.status == "已处理" and not update.handler:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.NEEDS_MANUAL_REVIEW,
                message="处理状态必须填写处理人",
                details={"required_fields": ["handler"]}
            ).model_dump()
        )
    
    return crud.update_abnormal_report_status(db, report_id, update.status, update.handler, update.comment)

@app.get("/api/export/fuel-records.csv")
def export_fuel_records_csv(vehicle_id: Optional[int] = None, 
                             start_date: Optional[datetime] = None,
                             end_date: Optional[datetime] = None,
                             db: Session = Depends(get_db)):
    csv_content = exporter.export_fuel_records_to_csv(db, vehicle_id, start_date, end_date)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=fuel_records_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/api/export/mileage-records.csv")
def export_mileage_records_csv(vehicle_id: Optional[int] = None,
                                start_date: Optional[datetime] = None,
                                end_date: Optional[datetime] = None,
                                db: Session = Depends(get_db)):
    csv_content = exporter.export_mileage_records_to_csv(db, vehicle_id, start_date, end_date)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=mileage_records_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/api/export/abnormal-reports.csv")
def export_abnormal_reports_csv(status: Optional[str] = None, level: Optional[str] = None,
                                 vehicle_id: Optional[int] = None, db: Session = Depends(get_db)):
    csv_content = exporter.export_abnormal_reports_to_csv(db, status, level, vehicle_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=abnormal_reports_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.get("/api/export/abnormal-reports.md")
def export_abnormal_reports_md(status: Optional[str] = None, level: Optional[str] = None,
                                vehicle_id: Optional[int] = None, db: Session = Depends(get_db)):
    md_content = exporter.export_abnormal_reports_to_markdown(db, status, level, vehicle_id)
    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=abnormal_reports_{datetime.now().strftime('%Y%m%d')}.md"}
    )

@app.post("/api/import/fuel-records")
async def import_fuel_records(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message="只支持CSV文件"
            ).model_dump()
        )
    
    content = await file.read()
    csv_file = io.StringIO(content.decode('utf-8'))
    reader = csv.DictReader(csv_file)
    
    records = []
    errors = []
    
    for row_num, row in enumerate(reader, 2):
        try:
            plate_number = row.get("车牌号", "").strip()
            vehicle = crud.get_vehicle_by_plate(db, plate_number)
            
            if not vehicle:
                errors.append(f"第 {row_num} 行: 车牌号 {plate_number} 不存在")
                continue
            
            record = {
                "vehicle_id": vehicle.id,
                "card_number": row.get("油卡号", "").strip(),
                "fuel_date": datetime.strptime(row.get("加油日期", "").strip(), "%Y-%m-%d %H:%M:%S"),
                "fuel_amount": float(row.get("加油量(L)", 0)),
                "fuel_price": float(row.get("单价(元)", 0)) if row.get("单价(元)") else None,
                "total_cost": float(row.get("总金额(元)", 0)) if row.get("总金额(元)") else None,
                "odometer": float(row.get("里程表读数", 0)) if row.get("里程表读数") else None,
                "station": row.get("加油站", "").strip() or None
            }
            records.append(record)
        except Exception as e:
            errors.append(f"第 {row_num} 行: {str(e)}")
    
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_VALUE,
                message=f"CSV文件解析错误，共 {len(errors)} 个错误",
                details={"errors": errors}
            ).model_dump()
        )
    
    success_count = 0
    for record in records:
        try:
            crud.create_fuel_record(db, record)
            success_count += 1
        except Exception:
            pass
    
    return {
        "message": f"导入完成，成功导入 {success_count} 条记录",
        "success_count": success_count,
        "total_count": len(records)
    }

@app.get("/api/statistics/summary")
def get_statistics_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    from models import FuelRecord, MileageRecord, AbnormalReport
    
    total_fuel = db.query(func.sum(FuelRecord.fuel_amount)).scalar() or 0
    total_mileage = db.query(func.sum(MileageRecord.distance)).scalar() or 0
    avg_consumption = analytics.calculate_fuel_consumption_per_100km(total_fuel, total_mileage)
    
    abnormal_pending = db.query(AbnormalReport).filter(AbnormalReport.status == "待处理").count()
    abnormal_reviewing = db.query(AbnormalReport).filter(AbnormalReport.status == "复核中").count()
    abnormal_resolved = db.query(AbnormalReport).filter(AbnormalReport.status == "已处理").count()
    
    return {
        "total_fuel_consumed": total_fuel,
        "total_mileage": total_mileage,
        "average_fuel_consumption": avg_consumption,
        "abnormal_statistics": {
            "pending": abnormal_pending,
            "reviewing": abnormal_reviewing,
            "resolved": abnormal_resolved
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
