from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime
from io import BytesIO
from database import get_db
from models import Permission, DetectionReport
from schemas import (
    DetectionReportCreate, DetectionReportResponse,
    DetectionReportImportItem, ImportResult
)
from services import DetectionReportService, PermissionService, OverlimitJudge
from concurrency import DistributedLock
import pandas as pd

router = APIRouter(prefix="/api/v1/detection", tags=["检测报告"])


@router.post("", summary="创建检测报告")
def create_detection_report(data: DetectionReportCreate, db: Session = Depends(get_db)):
    report = DetectionReportService.create(db, data)
    return {
        "id": report.id,
        "report_no": report.report_no,
        "permit_no": data.permit_no,
        "permission_id": report.permission_id,
        "detection_date": report.detection_date,
        "detection_value": report.detection_value,
        "detection_unit": report.detection_unit,
        "detection_method": report.detection_method,
        "lab_name": report.lab_name,
        "operator": report.operator,
        "status": report.status,
        "is_overlimit": report.is_overlimit,
        "remark": report.remark,
        "created_at": report.created_at,
        "updated_at": report.updated_at
    }


def _format_report(report: DetectionReport, permit_no: str):
    return {
        "id": report.id,
        "report_no": report.report_no,
        "permit_no": permit_no,
        "permission_id": report.permission_id,
        "detection_date": report.detection_date,
        "detection_value": report.detection_value,
        "detection_unit": report.detection_unit,
        "detection_method": report.detection_method,
        "lab_name": report.lab_name,
        "operator": report.operator,
        "status": report.status,
        "is_overlimit": report.is_overlimit,
        "remark": report.remark,
        "created_at": report.created_at,
        "updated_at": report.updated_at
    }


@router.get("/{report_id}", summary="获取检测报告详情")
def get_detection_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(DetectionReport).filter(DetectionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="检测报告不存在")
    from models import Permission
    perm = db.query(Permission).filter(Permission.id == report.permission_id).first()
    return _format_report(report, perm.permit_no if perm else "")


@router.get("/no/{report_no}", summary="按报告编号获取")
def get_by_report_no(report_no: str, db: Session = Depends(get_db)):
    report = DetectionReportService.get_by_report_no(db, report_no)
    from models import Permission
    perm = db.query(Permission).filter(Permission.id == report.permission_id).first()
    return _format_report(report, perm.permit_no if perm else "")


@router.get("", summary="查询检测报告列表")
def list_detection_reports(
    permit_no: Optional[str] = None,
    is_overlimit: Optional[bool] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from models import Permission
    reports = DetectionReportService.list(db, permit_no, is_overlimit, start_date, end_date, skip, limit)
    result = []
    for r in reports:
        perm = db.query(Permission).filter(Permission.id == r.permission_id).first()
        result.append(_format_report(r, perm.permit_no if perm else ""))
    return result


@router.post("/import", response_model=ImportResult, summary="批量导入检测报告")
def import_detection_reports(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="仅支持 Excel 或 CSV 文件")
    
    lock = DistributedLock(db, f"import:detection:{file.filename}")
    if not lock.acquire():
        raise HTTPException(status_code=429, detail="检测报告导入正在进行中，请稍后再试")
    
    try:
        content = file.file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(BytesIO(content))
        else:
            df = pd.read_excel(BytesIO(content))
        
        total = len(df)
        success = 0
        failed = 0
        failed_records = []
        overlimit_count = 0
        
        permission_cache = {}
        
        for idx, row in df.iterrows():
            try:
                permit_no = str(row.get('permit_no', '')).strip()
                if not permit_no:
                    raise ValueError("许可证编号不能为空")
                
                if permit_no not in permission_cache:
                    permission = db.query(Permission).filter(
                        Permission.permit_no == permit_no
                    ).first()
                    if not permission:
                        raise ValueError(f"许可证 {permit_no} 不存在")
                    permission_cache[permit_no] = permission
                
                permission = permission_cache[permit_no]
                
                report_no = str(row.get('report_no', '')).strip()
                if not report_no:
                    raise ValueError("检测报告编号不能为空")
                
                detection_date_str = str(row.get('detection_date', ''))
                try:
                    detection_date = pd.to_datetime(detection_date_str).to_pydatetime()
                except:
                    raise ValueError(f"无效的检测日期格式: {detection_date_str}")
                
                try:
                    detection_value = float(row.get('detection_value', 0))
                except:
                    raise ValueError(f"无效的检测值: {row.get('detection_value')}")
                
                detection_unit = str(row.get('detection_unit', '')).strip()
                if not detection_unit:
                    raise ValueError("检测单位不能为空")
                
                if not OverlimitJudge.check_permission_validity(permission, detection_date):
                    raise ValueError(f"检测日期不在许可证有效期内")
                
                judge_result = OverlimitJudge.check_overlimit(
                    detection_value, permission.limit_value,
                    detection_unit, permission.limit_unit
                )
                
                existing = db.query(DetectionReport).filter(
                    DetectionReport.report_no == report_no
                ).first()
                
                if existing:
                    raise ValueError(f"检测报告编号 {report_no} 已存在")
                
                report = DetectionReport(
                    report_no=report_no,
                    permission_id=permission.id,
                    detection_date=detection_date,
                    detection_value=detection_value,
                    detection_unit=detection_unit,
                    detection_method=str(row.get('detection_method', '')) or None,
                    lab_name=str(row.get('lab_name', '')) or None,
                    operator=str(row.get('operator', '')) or None,
                    is_overlimit=judge_result["is_overlimit"],
                    remark=str(row.get('remark', '')) or None
                )
                db.add(report)
                db.flush()
                
                if judge_result["is_overlimit"]:
                    from models import OverlimitRecord, OverlimitStatus
                    existing_overlimit = db.query(OverlimitRecord).filter(
                        OverlimitRecord.detection_report_id == report.id
                    ).first()
                    
                    if not existing_overlimit:
                        overlimit = OverlimitRecord(
                            permission_id=permission.id,
                            detection_report_id=report.id,
                            overlimit_value=judge_result["overlimit_value"],
                            overlimit_ratio=judge_result["overlimit_ratio"],
                            detection_date=detection_date,
                            status=OverlimitStatus.IDENTIFIED,
                            description=f"{permission.enterprise_name} - {permission.pollutant_name}超标: 检测值{detection_value}{detection_unit} > 限值{permission.limit_value}{permission.limit_unit}"
                        )
                        db.add(overlimit)
                        overlimit_count += 1
                
                db.commit()
                success += 1
                
            except Exception as e:
                db.rollback()
                failed += 1
                failed_records.append({
                    "row": idx + 2,
                    "report_no": str(row.get('report_no', '')),
                    "permit_no": str(row.get('permit_no', '')),
                    "error": str(e)
                })
        
        return ImportResult(
            total=total,
            success=success,
            failed=failed,
            failed_records=failed_records,
            overlimit_count=overlimit_count
        )
        
    finally:
        lock.release()


@router.delete("/{report_id}", summary="删除检测报告")
def delete_detection_report(report_id: int, db: Session = Depends(get_db)):
    from models import OverlimitRecord, RectificationTask
    
    report = db.query(DetectionReport).filter(DetectionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="检测报告不存在")
    
    overlimit = db.query(OverlimitRecord).filter(
        OverlimitRecord.detection_report_id == report_id
    ).first()
    
    if overlimit:
        task = db.query(RectificationTask).filter(
            RectificationTask.overlimit_record_id == overlimit.id
        ).first()
        if task:
            raise HTTPException(status_code=400, detail="该检测报告关联整改任务，无法删除")
        
        db.delete(overlimit)
    
    db.delete(report)
    db.commit()
    return {"message": "删除成功"}
