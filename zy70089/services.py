from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from fastapi import HTTPException
from datetime import datetime, date, timedelta
from models import (
    Permission, DetectionReport, OverlimitRecord, RectificationTask,
    ReviewReceipt, SupervisionReport, OverlimitStatus, RectificationStatus, DetectionStatus
)
from schemas import (
    PermissionCreate, PermissionUpdate, DetectionReportCreate,
    RectificationTaskCreate, RectificationTaskUpdate,
    ReviewReceiptCreate, SupervisionReportCreate
)
from concurrency import DistributedLock
import uuid


class OverlimitJudge:
    @staticmethod
    def check_overlimit(detection_value: float, limit_value: float, detection_unit: str, limit_unit: str) -> dict:
        if detection_unit != limit_unit:
            raise ValueError(f"单位不匹配: 检测单位{detection_unit} vs 许可单位{limit_unit}")
        
        is_overlimit = detection_value > limit_value
        
        result = {
            "is_overlimit": is_overlimit,
            "overlimit_value": detection_value - limit_value if is_overlimit else 0,
            "overlimit_ratio": (detection_value - limit_value) / limit_value * 100 if is_overlimit and limit_value > 0 else 0
        }
        return result

    @staticmethod
    def check_permission_validity(permission: Permission, detection_date: datetime) -> bool:
        detection_date_only = detection_date.date()
        return permission.effective_date <= detection_date_only <= permission.expiry_date


class PermissionService:
    @staticmethod
    def create(db: Session, data: PermissionCreate) -> Permission:
        if data.effective_date >= data.expiry_date:
            raise HTTPException(status_code=400, detail="生效日期必须早于到期日期")
        
        existing = db.query(Permission).filter(Permission.permit_no == data.permit_no).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"许可证编号 {data.permit_no} 已存在")
        
        permission = Permission(
            permit_no=data.permit_no,
            enterprise_name=data.enterprise_name,
            pollutant_type=data.pollutant_type,
            pollutant_name=data.pollutant_name,
            limit_value=data.limit_value,
            limit_unit=data.limit_unit,
            effective_date=data.effective_date,
            expiry_date=data.expiry_date
        )
        db.add(permission)
        db.commit()
        db.refresh(permission)
        return permission

    @staticmethod
    def update(db: Session, permit_id: int, data: PermissionUpdate) -> Permission:
        permission = db.query(Permission).filter(Permission.id == permit_id).first()
        if not permission:
            raise HTTPException(status_code=404, detail="许可证不存在")
        
        update_data = data.model_dump(exclude_unset=True)
        
        if "effective_date" in update_data and "expiry_date" in update_data:
            if update_data["effective_date"] >= update_data["expiry_date"]:
                raise HTTPException(status_code=400, detail="生效日期必须早于到期日期")
        
        for key, value in update_data.items():
            setattr(permission, key, value)
        
        db.commit()
        db.refresh(permission)
        return permission

    @staticmethod
    def get_by_permit_no(db: Session, permit_no: str) -> Permission:
        permission = db.query(Permission).filter(Permission.permit_no == permit_no).first()
        if not permission:
            raise HTTPException(status_code=404, detail=f"许可证 {permit_no} 不存在")
        return permission

    @staticmethod
    def list(
        db: Session,
        enterprise_name: str = None,
        pollutant_type: str = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = db.query(Permission)
        
        if enterprise_name:
            query = query.filter(Permission.enterprise_name.like(f"%{enterprise_name}%"))
        
        if pollutant_type:
            query = query.filter(Permission.pollutant_type == pollutant_type)
        
        return query.order_by(desc(Permission.created_at)).offset(skip).limit(limit).all()


class DetectionReportService:
    @staticmethod
    def create(db: Session, data: DetectionReportCreate) -> DetectionReport:
        permission = PermissionService.get_by_permit_no(db, data.permit_no)
        
        existing = db.query(DetectionReport).filter(DetectionReport.report_no == data.report_no).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"检测报告编号 {data.report_no} 已存在")
        
        if not OverlimitJudge.check_permission_validity(permission, data.detection_date):
            raise HTTPException(
                status_code=400,
                detail=f"检测日期 {data.detection_date.date()} 不在许可证有效期内 ({permission.effective_date} ~ {permission.expiry_date})"
            )
        
        judge_result = OverlimitJudge.check_overlimit(
            data.detection_value, permission.limit_value,
            data.detection_unit, permission.limit_unit
        )
        
        report = DetectionReport(
            report_no=data.report_no,
            permission_id=permission.id,
            detection_date=data.detection_date,
            detection_value=data.detection_value,
            detection_unit=data.detection_unit,
            detection_method=data.detection_method,
            lab_name=data.lab_name,
            operator=data.operator,
            status=DetectionStatus.COMPLETED,
            is_overlimit=judge_result["is_overlimit"],
            remark=data.remark
        )
        db.add(report)
        db.flush()
        
        if judge_result["is_overlimit"]:
            existing_overlimit = db.query(OverlimitRecord).filter(
                OverlimitRecord.detection_report_id == report.id
            ).first()
            
            if not existing_overlimit:
                overlimit = OverlimitRecord(
                    permission_id=permission.id,
                    detection_report_id=report.id,
                    overlimit_value=judge_result["overlimit_value"],
                    overlimit_ratio=judge_result["overlimit_ratio"],
                    detection_date=data.detection_date,
                    status=OverlimitStatus.IDENTIFIED,
                    description=f"{permission.enterprise_name} - {permission.pollutant_name}超标: 检测值{data.detection_value}{data.detection_unit} > 限值{permission.limit_value}{permission.limit_unit}"
                )
                db.add(overlimit)
        
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_by_report_no(db: Session, report_no: str) -> DetectionReport:
        report = db.query(DetectionReport).filter(DetectionReport.report_no == report_no).first()
        if not report:
            raise HTTPException(status_code=404, detail=f"检测报告 {report_no} 不存在")
        return report

    @staticmethod
    def list(
        db: Session,
        permit_no: str = None,
        is_overlimit: bool = None,
        start_date: datetime = None,
        end_date: datetime = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = db.query(DetectionReport)
        
        if permit_no:
            permission = db.query(Permission).filter(Permission.permit_no == permit_no).first()
            if permission:
                query = query.filter(DetectionReport.permission_id == permission.id)
        
        if is_overlimit is not None:
            query = query.filter(DetectionReport.is_overlimit == is_overlimit)
        
        if start_date:
            query = query.filter(DetectionReport.detection_date >= start_date)
        
        if end_date:
            query = query.filter(DetectionReport.detection_date <= end_date)
        
        return query.order_by(desc(DetectionReport.detection_date)).offset(skip).limit(limit).all()


class OverlimitRecordService:
    @staticmethod
    def get(db: Session, record_id: int) -> OverlimitRecord:
        record = db.query(OverlimitRecord).filter(OverlimitRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="超标记录不存在")
        return record

    @staticmethod
    def list(
        db: Session,
        status: OverlimitStatus = None,
        permit_no: str = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = db.query(OverlimitRecord).join(Permission)
        
        if status:
            query = query.filter(OverlimitRecord.status == status)
        
        if permit_no:
            query = query.filter(Permission.permit_no == permit_no)
        
        records = query.order_by(desc(OverlimitRecord.detection_date)).offset(skip).limit(limit).all()
        
        result = []
        for record in records:
            result.append({
                "id": record.id,
                "permission_id": record.permission_id,
                "detection_report_id": record.detection_report_id,
                "overlimit_value": record.overlimit_value,
                "overlimit_ratio": record.overlimit_ratio,
                "detection_date": record.detection_date,
                "identification_date": record.identification_date,
                "status": record.status,
                "description": record.description,
                "enterprise_name": record.permission.enterprise_name,
                "pollutant_name": record.permission.pollutant_name,
                "permit_no": record.permission.permit_no
            })
        return result


class RectificationTaskService:
    @staticmethod
    def generate_task_no() -> str:
        return f"RT{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    @staticmethod
    def create(db: Session, data: RectificationTaskCreate) -> RectificationTask:
        overlimit = db.query(OverlimitRecord).filter(
            OverlimitRecord.id == data.overlimit_record_id
        ).first()
        
        if not overlimit:
            raise HTTPException(status_code=404, detail="超标记录不存在")
        
        existing_task = db.query(RectificationTask).filter(
            RectificationTask.overlimit_record_id == data.overlimit_record_id
        ).first()
        
        if existing_task:
            raise HTTPException(status_code=400, detail="该超标记录已创建整改任务")
        
        if overlimit.status != OverlimitStatus.IDENTIFIED:
            raise HTTPException(status_code=400, detail=f"超标记录状态不允许创建整改任务: {overlimit.status}")
        
        task = RectificationTask(
            overlimit_record_id=data.overlimit_record_id,
            task_no=RectificationTaskService.generate_task_no(),
            deadline=data.deadline,
            rectification_measures=data.rectification_measures,
            responsible_person=data.responsible_person,
            contact_info=data.contact_info,
            status=RectificationStatus.PENDING,
            remark=data.remark
        )
        db.add(task)
        
        overlimit.status = OverlimitStatus.RECTIFYING
        
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def update(db: Session, task_id: int, data: RectificationTaskUpdate) -> RectificationTask:
        task = db.query(RectificationTask).filter(RectificationTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="整改任务不存在")
        
        update_data = data.model_dump(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(task, key, value)
        
        db.commit()
        db.refresh(task)
        return task

    @staticmethod
    def get(db: Session, task_id: int) -> RectificationTask:
        task = db.query(RectificationTask).filter(RectificationTask.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="整改任务不存在")
        return task

    @staticmethod
    def list(
        db: Session,
        status: RectificationStatus = None,
        overdue: bool = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = db.query(RectificationTask)
        
        if status:
            query = query.filter(RectificationTask.status == status)
        
        if overdue is not None:
            now = datetime.utcnow()
            if overdue:
                query = query.filter(
                    RectificationTask.deadline < now,
                    RectificationTask.status.in_([RectificationStatus.PENDING, RectificationStatus.IN_PROGRESS])
                )
            else:
                query = query.filter(
                    RectificationTask.deadline >= now,
                    RectificationTask.status.in_([RectificationStatus.PENDING, RectificationStatus.IN_PROGRESS])
                )
        
        return query.order_by(desc(RectificationTask.created_at)).offset(skip).limit(limit).all()


class ReviewReceiptService:
    @staticmethod
    def generate_receipt_no() -> str:
        return f"RR{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    @staticmethod
    def create(db: Session, data: ReviewReceiptCreate) -> ReviewReceipt:
        task = db.query(RectificationTask).filter(
            RectificationTask.id == data.rectification_task_id
        ).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="整改任务不存在")
        
        if task.status != RectificationStatus.SUBMITTED:
            raise HTTPException(status_code=400, detail=f"整改任务状态不允许复查: {task.status}")
        
        receipt = ReviewReceipt(
            rectification_task_id=data.rectification_task_id,
            receipt_no=ReviewReceiptService.generate_receipt_no(),
            review_date=data.review_date,
            reviewer=data.reviewer,
            review_organization=data.review_organization,
            review_result=data.review_result,
            review_comment=data.review_comment,
            redetection_value=data.redetection_value,
            redetection_unit=data.redetection_unit,
            is_qualified=data.is_qualified
        )
        db.add(receipt)
        
        if data.review_result and data.is_qualified:
            task.status = RectificationStatus.APPROVED
            
            overlimit = db.query(OverlimitRecord).filter(
                OverlimitRecord.id == task.overlimit_record_id
            ).first()
            if overlimit:
                overlimit.status = OverlimitStatus.RESOLVED
        else:
            task.status = RectificationStatus.REJECTED
        
        db.commit()
        db.refresh(receipt)
        return receipt

    @staticmethod
    def list_by_task(db: Session, task_id: int):
        return db.query(ReviewReceipt).filter(
            ReviewReceipt.rectification_task_id == task_id
        ).order_by(desc(ReviewReceipt.review_date)).all()


class SupervisionReportService:
    @staticmethod
    def generate_report_no() -> str:
        return f"SR{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    @staticmethod
    def create(db: Session, data: SupervisionReportCreate) -> SupervisionReport:
        task = db.query(RectificationTask).filter(
            RectificationTask.id == data.rectification_task_id
        ).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="整改任务不存在")
        
        report = SupervisionReport(
            rectification_task_id=data.rectification_task_id,
            report_no=SupervisionReportService.generate_report_no(),
            report_date=data.report_date,
            reporter=data.reporter,
            report_organization=data.report_organization,
            supervision_content=data.supervision_content,
            supervision_result=data.supervision_result,
            suggestion=data.suggestion
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def list_by_task(db: Session, task_id: int):
        return db.query(SupervisionReport).filter(
            SupervisionReport.rectification_task_id == task_id
        ).order_by(desc(SupervisionReport.report_date)).all()


class TraceService:
    @staticmethod
    def get_full_trace(db: Session, permit_no: str) -> dict:
        permission = db.query(Permission).filter(
            Permission.permit_no == permit_no
        ).first()
        
        if not permission:
            raise HTTPException(status_code=404, detail=f"许可证 {permit_no} 不存在")
        
        detection_reports = db.query(DetectionReport).filter(
            DetectionReport.permission_id == permission.id
        ).order_by(DetectionReport.detection_date).all()
        
        overlimit_records = db.query(OverlimitRecord).filter(
            OverlimitRecord.permission_id == permission.id
        ).all()
        
        rectification_tasks = []
        review_receipts = []
        supervision_reports = []
        
        for ol in overlimit_records:
            task = db.query(RectificationTask).filter(
                RectificationTask.overlimit_record_id == ol.id
            ).first()
            if task:
                rectification_tasks.append(task)
                
                receipts = db.query(ReviewReceipt).filter(
                    ReviewReceipt.rectification_task_id == task.id
                ).all()
                review_receipts.extend(receipts)
                
                reports = db.query(SupervisionReport).filter(
                    SupervisionReport.rectification_task_id == task.id
                ).all()
                supervision_reports.extend(reports)
        
        timeline = []
        
        timeline.append({
            "type": "permission",
            "id": permission.id,
            "no": permission.permit_no,
            "date": permission.effective_date,
            "status": "effective",
            "detail": f"排污许可证生效: {permission.pollutant_name} 限值 {permission.limit_value}{permission.limit_unit}"
        })
        
        for dr in detection_reports:
            timeline.append({
                "type": "detection",
                "id": dr.id,
                "no": dr.report_no,
                "date": dr.detection_date,
                "status": "overlimit" if dr.is_overlimit else "normal",
                "detail": f"检测报告: 检测值 {dr.detection_value}{dr.detection_unit} {'(超标)' if dr.is_overlimit else '(合格)'}"
            })
        
        for ol in overlimit_records:
            timeline.append({
                "type": "overlimit",
                "id": ol.id,
                "no": None,
                "date": ol.identification_date,
                "status": ol.status.value,
                "detail": f"超标判定: 超标 {ol.overlimit_value:.2f}{permission.limit_unit} ({ol.overlimit_ratio:.2f}%)"
            })
        
        for rt in rectification_tasks:
            timeline.append({
                "type": "rectification",
                "id": rt.id,
                "no": rt.task_no,
                "date": rt.created_at,
                "status": rt.status.value,
                "detail": f"整改任务: 截止日期 {rt.deadline.date()}"
            })
        
        for rr in review_receipts:
            timeline.append({
                "type": "review",
                "id": rr.id,
                "no": rr.receipt_no,
                "date": rr.review_date,
                "status": "passed" if rr.review_result else "failed",
                "detail": f"复查回执: {'通过' if rr.review_result else '未通过'}"
            })
        
        for sr in supervision_reports:
            timeline.append({
                "type": "supervision",
                "id": sr.id,
                "no": sr.report_no,
                "date": sr.report_date,
                "status": "submitted",
                "detail": f"监管报告: {sr.supervision_result or '已提交'}"
            })
        
        timeline.sort(key=lambda x: x["date"] if isinstance(x["date"], datetime) else datetime.combine(x["date"], datetime.min.time()))
        
        return {
            "permission": permission,
            "detection_reports": detection_reports,
            "overlimit_records": overlimit_records,
            "rectification_tasks": rectification_tasks,
            "review_receipts": review_receipts,
            "supervision_reports": supervision_reports,
            "timeline": timeline
        }
