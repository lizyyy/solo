from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import csv
import json
from io import StringIO, BytesIO
from typing import Optional, List
from pydantic import BaseModel
import os

DATABASE_URL = "sqlite:///./inspection.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="地下泵房巡检管理系统")

class InspectionRecord(Base):
    __tablename__ = "inspection_records"
    id = Column(Integer, primary_key=True, index=True)
    inspection_time = Column(DateTime, nullable=False)
    location = Column(String(200), nullable=False)
    inspector = Column(String(100), nullable=False)
    equipment_name = Column(String(200), nullable=False)
    status = Column(String(50), nullable=False)
    abnormal_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class AbnormalRecord(Base):
    __tablename__ = "abnormal_records"
    id = Column(Integer, primary_key=True, index=True)
    inspection_record_id = Column(Integer, nullable=True)
    record_time = Column(DateTime, nullable=False)
    location = Column(String(200), nullable=False)
    responsible_person = Column(String(100), nullable=False)
    equipment_name = Column(String(200), nullable=False)
    abnormal_type = Column(String(100), nullable=False)
    severity = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="待处理")
    handled_at = Column(DateTime, nullable=True)
    handler = Column(String(100), nullable=True)
    handle_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

class ImportErrorRecord(Base):
    __tablename__ = "import_error_records"
    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String(50), nullable=False)
    original_position = Column(String(200), nullable=False)
    original_data = Column(Text, nullable=False)
    error_reason = Column(Text, nullable=False)
    suggestion = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.now)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class InspectionRecordResponse(BaseModel):
    id: int
    inspection_time: datetime
    location: str
    inspector: str
    equipment_name: str
    status: str
    abnormal_type: Optional[str]
    description: Optional[str]
    remarks: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True

class AbnormalRecordResponse(BaseModel):
    id: int
    record_time: datetime
    location: str
    responsible_person: str
    equipment_name: str
    abnormal_type: str
    severity: str
    description: str
    status: str
    created_at: datetime

    class Config:
        orm_mode = True

class ImportErrorResponse(BaseModel):
    id: int
    import_type: str
    original_position: str
    error_reason: str
    suggestion: str
    created_at: datetime

    class Config:
        orm_mode = True

@app.post("/import/inspection/csv", summary="导入巡检表CSV")
async def import_inspection_csv(file: UploadFile = File(...)):
    db = next(get_db())
    content = await file.read()
    csv_content = content.decode('utf-8')
    reader = csv.DictReader(StringIO(csv_content))
    
    normal_count = 0
    abnormal_count = 0
    error_count = 0
    errors = []
    
    for row_num, row in enumerate(reader, start=2):
        try:
            if not row.get('巡检时间'):
                raise ValueError("缺少巡检时间字段")
            if not row.get('位置'):
                raise ValueError("缺少位置字段")
            if not row.get('巡检人'):
                raise ValueError("缺少巡检人字段")
            if not row.get('设备名称'):
                raise ValueError("缺少设备名称字段")
            
            try:
                inspection_time = datetime.strptime(row['巡检时间'], '%Y-%m-%d %H:%M:%S')
            except ValueError:
                raise ValueError(f"巡检时间格式错误，应为'YYYY-MM-DD HH:MM:SS'，实际为'{row.get('巡检时间')}'")
            
            status = row.get('状态', '').strip() or '正常'
            abnormal_type = row.get('异常类型', '').strip() or None
            
            record = InspectionRecord(
                inspection_time=inspection_time,
                location=row['位置'].strip(),
                inspector=row['巡检人'].strip(),
                equipment_name=row['设备名称'].strip(),
                status=status,
                abnormal_type=abnormal_type,
                description=row.get('描述', '').strip() or None,
                remarks=row.get('备注', '').strip() or None
            )
            db.add(record)
            
            if status != '正常' or abnormal_type:
                abnormal_count += 1
                abnormal = AbnormalRecord(
                    inspection_record_id=None,
                    record_time=inspection_time,
                    location=row['位置'].strip(),
                    responsible_person=row['巡检人'].strip(),
                    equipment_name=row['设备名称'].strip(),
                    abnormal_type=abnormal_type or '未分类异常',
                    severity=row.get('严重程度', '中等').strip(),
                    description=row.get('描述', '').strip() or '巡检发现异常',
                    status='待处理'
                )
                db.add(abnormal)
            else:
                normal_count += 1
                
        except Exception as e:
            error_count += 1
            error_record = ImportErrorRecord(
                import_type='巡检表CSV',
                original_position=f"第{row_num}行",
                original_data=json.dumps(row, ensure_ascii=False),
                error_reason=str(e),
                suggestion="请检查字段是否完整、日期格式是否正确"
            )
            db.add(error_record)
            errors.append({
                'row': row_num,
                'error': str(e)
            })
    
    db.commit()
    return {
        'message': '导入完成',
        'summary': {
            '正常记录': normal_count,
            '异常记录': abnormal_count,
            '错误记录': error_count
        },
        'errors': errors
    }

@app.post("/import/sensor/json", summary="导入传感器告警JSON")
async def import_sensor_json(file: UploadFile = File(...)):
    db = next(get_db())
    content = await file.read()
    data = json.loads(content.decode('utf-8'))
    
    if not isinstance(data, list):
        data = [data]
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, item in enumerate(data):
        try:
            if not item.get('timestamp'):
                raise ValueError("缺少timestamp字段")
            if not item.get('location'):
                raise ValueError("缺少location字段")
            if not item.get('sensor_name'):
                raise ValueError("缺少sensor_name字段")
            
            try:
                record_time = datetime.strptime(item['timestamp'], '%Y-%m-%d %H:%M:%S')
            except ValueError:
                raise ValueError(f"时间格式错误，应为'YYYY-MM-DD HH:MM:SS'")
            
            abnormal = AbnormalRecord(
                inspection_record_id=None,
                record_time=record_time,
                location=item['location'],
                responsible_person=item.get('responsible_person', '系统自动'),
                equipment_name=item['sensor_name'],
                abnormal_type=item.get('alarm_type', '传感器告警'),
                severity=item.get('severity', '高'),
                description=item.get('description', f"传感器告警值: {item.get('value', '未知')}"),
                status='待处理'
            )
            db.add(abnormal)
            success_count += 1
            
        except Exception as e:
            error_count += 1
            error_record = ImportErrorRecord(
                import_type='传感器JSON',
                original_position=f"数组索引{idx}",
                original_data=json.dumps(item, ensure_ascii=False),
                error_reason=str(e),
                suggestion="请检查必填字段是否存在、时间格式是否正确"
            )
            db.add(error_record)
            errors.append({
                'index': idx,
                'error': str(e)
            })
    
    db.commit()
    return {
        'message': '导入完成',
        'summary': {
            '成功导入': success_count,
            '失败记录': error_count
        },
        'errors': errors
    }

@app.get("/records/inspection", summary="查询巡检记录", response_model=List[InspectionRecordResponse])
async def get_inspection_records(
    inspector: Optional[str] = Query(None, description="负责人筛选"),
    start_time: Optional[str] = Query(None, description="开始时间 YYYY-MM-DD"),
    end_time: Optional[str] = Query(None, description="结束时间 YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="状态筛选"),
    abnormal_type: Optional[str] = Query(None, description="异常类型筛选"),
    skip: int = 0,
    limit: int = 100
):
    db = next(get_db())
    query = db.query(InspectionRecord)
    
    if inspector:
        query = query.filter(InspectionRecord.inspector == inspector)
    if status:
        query = query.filter(InspectionRecord.status == status)
    if abnormal_type:
        query = query.filter(InspectionRecord.abnormal_type == abnormal_type)
    if start_time:
        try:
            start = datetime.strptime(start_time, '%Y-%m-%d')
            query = query.filter(InspectionRecord.inspection_time >= start)
        except ValueError:
            pass
    if end_time:
        try:
            end = datetime.strptime(end_time + ' 23:59:59', '%Y-%m-%d %H:%M:%S')
            query = query.filter(InspectionRecord.inspection_time <= end)
        except ValueError:
            pass
    
    records = query.order_by(InspectionRecord.inspection_time.desc()).offset(skip).limit(limit).all()
    return records

@app.get("/records/abnormal", summary="查询异常记录", response_model=List[AbnormalRecordResponse])
async def get_abnormal_records(
    responsible_person: Optional[str] = Query(None, description="负责人筛选"),
    start_time: Optional[str] = Query(None, description="开始时间 YYYY-MM-DD"),
    end_time: Optional[str] = Query(None, description="结束时间 YYYY-MM-DD"),
    status: Optional[str] = Query(None, description="状态筛选"),
    abnormal_type: Optional[str] = Query(None, description="异常类型筛选"),
    skip: int = 0,
    limit: int = 100
):
    db = next(get_db())
    query = db.query(AbnormalRecord)
    
    if responsible_person:
        query = query.filter(AbnormalRecord.responsible_person == responsible_person)
    if status:
        query = query.filter(AbnormalRecord.status == status)
    if abnormal_type:
        query = query.filter(AbnormalRecord.abnormal_type == abnormal_type)
    if start_time:
        try:
            start = datetime.strptime(start_time, '%Y-%m-%d')
            query = query.filter(AbnormalRecord.record_time >= start)
        except ValueError:
            pass
    if end_time:
        try:
            end = datetime.strptime(end_time + ' 23:59:59', '%Y-%m-%d %H:%M:%S')
            query = query.filter(AbnormalRecord.record_time <= end)
        except ValueError:
            pass
    
    records = query.order_by(AbnormalRecord.record_time.desc()).offset(skip).limit(limit).all()
    return records

@app.get("/records/import-errors", summary="查询导入错误记录", response_model=List[ImportErrorResponse])
async def get_import_errors(
    import_type: Optional[str] = Query(None, description="导入类型筛选"),
    skip: int = 0,
    limit: int = 100
):
    db = next(get_db())
    query = db.query(ImportErrorRecord)
    
    if import_type:
        query = query.filter(ImportErrorRecord.import_type == import_type)
    
    records = query.order_by(ImportErrorRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records

@app.get("/export/inspection", summary="导出巡检记录")
async def export_inspection(
    inspector: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    status: Optional[str] = None,
    abnormal_type: Optional[str] = None
):
    db = next(get_db())
    query = db.query(InspectionRecord)
    
    if inspector:
        query = query.filter(InspectionRecord.inspector == inspector)
    if status:
        query = query.filter(InspectionRecord.status == status)
    if abnormal_type:
        query = query.filter(InspectionRecord.abnormal_type == abnormal_type)
    if start_time:
        try:
            start = datetime.strptime(start_time, '%Y-%m-%d')
            query = query.filter(InspectionRecord.inspection_time >= start)
        except ValueError:
            pass
    if end_time:
        try:
            end = datetime.strptime(end_time + ' 23:59:59', '%Y-%m-%d %H:%M:%S')
            query = query.filter(InspectionRecord.inspection_time <= end)
        except ValueError:
            pass
    
    records = query.order_by(InspectionRecord.inspection_time.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['巡检时间', '位置', '巡检人', '设备名称', '状态', '异常类型', '描述', '备注'])
    
    for r in records:
        writer.writerow([
            r.inspection_time.strftime('%Y-%m-%d %H:%M:%S'),
            r.location,
            r.inspector,
            r.equipment_name,
            r.status,
            r.abnormal_type or '',
            r.description or '',
            r.remarks or ''
        ])
    
    output.seek(0)
    return StreamingResponse(
        BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inspection_records.csv"}
    )

@app.get("/export/abnormal", summary="导出异常记录")
async def export_abnormal(
    responsible_person: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    status: Optional[str] = None,
    abnormal_type: Optional[str] = None
):
    db = next(get_db())
    query = db.query(AbnormalRecord)
    
    if responsible_person:
        query = query.filter(AbnormalRecord.responsible_person == responsible_person)
    if status:
        query = query.filter(AbnormalRecord.status == status)
    if abnormal_type:
        query = query.filter(AbnormalRecord.abnormal_type == abnormal_type)
    if start_time:
        try:
            start = datetime.strptime(start_time, '%Y-%m-%d')
            query = query.filter(AbnormalRecord.record_time >= start)
        except ValueError:
            pass
    if end_time:
        try:
            end = datetime.strptime(end_time + ' 23:59:59', '%Y-%m-%d %H:%M:%S')
            query = query.filter(AbnormalRecord.record_time <= end)
        except ValueError:
            pass
    
    records = query.order_by(AbnormalRecord.record_time.desc()).all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(['记录时间', '位置', '负责人', '设备名称', '异常类型', '严重程度', '描述', '状态'])
    
    for r in records:
        writer.writerow([
            r.record_time.strftime('%Y-%m-%d %H:%M:%S'),
            r.location,
            r.responsible_person,
            r.equipment_name,
            r.abnormal_type,
            r.severity,
            r.description,
            r.status
        ])
    
    output.seek(0)
    return StreamingResponse(
        BytesIO(output.getvalue().encode('utf-8-sig')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=abnormal_records.csv"}
    )

@app.get("/summary", summary="获取系统摘要")
async def get_summary():
    db = next(get_db())
    
    total_inspection = db.query(InspectionRecord).count()
    total_abnormal = db.query(AbnormalRecord).count()
    pending_abnormal = db.query(AbnormalRecord).filter(AbnormalRecord.status == '待处理').count()
    total_errors = db.query(ImportErrorRecord).count()
    
    return {
        '巡检记录总数': total_inspection,
        '异常记录总数': total_abnormal,
        '待处理异常': pending_abnormal,
        '导入错误总数': total_errors
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)