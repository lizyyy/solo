from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.models.models import (
    User, Order, ColorMeasurement, ReworkRecord, QCReport,
    ReviewRecord, ImportErrorRecord, QCRule, QCStatus, ImportSource
)
from app.schemas.schemas import (
    UserCreate, OrderCreate, ColorMeasurementCreate,
    ReworkRecordCreate, QCReportCreate, ReviewRecordCreate,
    ImportErrorRecordCreate, QCRuleCreate
)
from app.core.security import get_password_hash


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, user: UserCreate, created_by: str = None) -> User:
        db_user = User(
            username=user.username,
            hashed_password=get_password_hash(user.password),
            full_name=user.full_name,
            role=user.role,
            created_by=created_by
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        return self.db.query(User).offset(skip).limit(limit).all()


class OrderRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, order: OrderCreate, created_by: str = None) -> Order:
        db_order = Order(**order.dict(), created_by=created_by)
        self.db.add(db_order)
        self.db.commit()
        self.db.refresh(db_order)
        return db_order

    def get_by_order_no(self, order_no: str) -> Optional[Order]:
        return self.db.query(Order).filter(Order.order_no == order_no).first()

    def get_by_id(self, order_id: int) -> Optional[Order]:
        return self.db.query(Order).filter(Order.id == order_id).first()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Order]:
        return self.db.query(Order).order_by(desc(Order.created_at)).offset(skip).limit(limit).all()

    def update_status(self, order_id: int, status: QCStatus) -> Optional[Order]:
        order = self.get_by_id(order_id)
        if order:
            order.status = status
            self.db.commit()
            self.db.refresh(order)
        return order

    def get_by_paper_batch(self, paper_batch: str) -> List[Order]:
        return self.db.query(Order).filter(Order.paper_batch == paper_batch).all()


class ColorMeasurementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, measurement: ColorMeasurementCreate, created_by: str = None) -> ColorMeasurement:
        data = measurement.dict()
        order_no = data.pop("order_no")
        order = self.db.query(Order).filter(Order.order_no == order_no).first()
        if order:
            data["order_id"] = order.id
            if order.target_l is not None:
                data["delta_l"] = data["l_value"] - order.target_l
                data["delta_a"] = data["a_value"] - order.target_a
                data["delta_b"] = data["b_value"] - order.target_b
                data["delta_e"] = (data["delta_l"]**2 + data["delta_a"]**2 + data["delta_b"]**2)**0.5
                data["is_pass"] = (
                    abs(data["delta_l"]) <= order.tolerance_l and
                    abs(data["delta_a"]) <= order.tolerance_a and
                    abs(data["delta_b"]) <= order.tolerance_b
                )
        db_measurement = ColorMeasurement(order_no=order_no, **data, created_by=created_by)
        self.db.add(db_measurement)
        self.db.commit()
        self.db.refresh(db_measurement)
        return db_measurement

    def get_by_id(self, measurement_id: int) -> Optional[ColorMeasurement]:
        return self.db.query(ColorMeasurement).filter(ColorMeasurement.id == measurement_id).first()

    def get_by_order_no(self, order_no: str) -> List[ColorMeasurement]:
        return self.db.query(ColorMeasurement).filter(ColorMeasurement.order_no == order_no).all()

    def get_by_order_id(self, order_id: int) -> List[ColorMeasurement]:
        return self.db.query(ColorMeasurement).filter(ColorMeasurement.order_id == order_id).all()

    def get_by_paper_batch(self, paper_batch: str) -> List[ColorMeasurement]:
        return self.db.query(ColorMeasurement).filter(ColorMeasurement.paper_batch == paper_batch).all()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ColorMeasurement]:
        return self.db.query(ColorMeasurement).order_by(desc(ColorMeasurement.created_at)).offset(skip).limit(limit).all()

    def get_stats_by_order(self, order_id: int) -> Dict[str, Any]:
        measurements = self.get_by_order_id(order_id)
        if not measurements:
            return {"total": 0, "pass_count": 0, "fail_count": 0}
        
        pass_count = sum(1 for m in measurements if m.is_pass)
        delta_e_values = [m.delta_e for m in measurements if m.delta_e is not None]
        
        return {
            "total": len(measurements),
            "pass_count": pass_count,
            "fail_count": len(measurements) - pass_count,
            "pass_rate": pass_count / len(measurements) if measurements else 0,
            "avg_delta_e": sum(delta_e_values) / len(delta_e_values) if delta_e_values else None,
            "max_delta_e": max(delta_e_values) if delta_e_values else None,
            "min_delta_e": min(delta_e_values) if delta_e_values else None
        }


class ReworkRecordRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, record: ReworkRecordCreate, created_by: str = None) -> ReworkRecord:
        data = record.dict()
        order_no = data.pop("order_no")
        order = self.db.query(Order).filter(Order.order_no == order_no).first()
        if order:
            data["order_id"] = order.id
            data["before_status"] = order.status
        db_record = ReworkRecord(order_no=order_no, **data, created_by=created_by)
        self.db.add(db_record)
        self.db.commit()
        self.db.refresh(db_record)
        return db_record

    def get_by_id(self, record_id: int) -> Optional[ReworkRecord]:
        return self.db.query(ReworkRecord).filter(ReworkRecord.id == record_id).first()

    def get_by_order_no(self, order_no: str) -> List[ReworkRecord]:
        return self.db.query(ReworkRecord).filter(ReworkRecord.order_no == order_no).all()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ReworkRecord]:
        return self.db.query(ReworkRecord).order_by(desc(ReworkRecord.created_at)).offset(skip).limit(limit).all()

    def count_by_order(self, order_id: int) -> int:
        return self.db.query(ReworkRecord).filter(ReworkRecord.order_id == order_id).count()


class QCReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, report: QCReportCreate, created_by: str = None) -> QCReport:
        report_no = f"QC{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return self.create_with_report_no(report, report_no, created_by)

    def create_with_report_no(self, report: QCReportCreate, report_no: str, created_by: str = None) -> QCReport:
        data = report.dict()
        order_no = data.pop("order_no")
        order = self.db.query(Order).filter(Order.order_no == order_no).first()
        if order:
            data["order_id"] = order.id
        db_report = QCReport(report_no=report_no, order_no=order_no, **data, created_by=created_by)
        self.db.add(db_report)
        self.db.commit()
        self.db.refresh(db_report)
        return db_report

    def get_by_id(self, report_id: int) -> Optional[QCReport]:
        return self.db.query(QCReport).filter(QCReport.id == report_id).first()

    def get_by_report_no(self, report_no: str) -> Optional[QCReport]:
        return self.db.query(QCReport).filter(QCReport.report_no == report_no).first()

    def get_by_order_no(self, order_no: str) -> List[QCReport]:
        return self.db.query(QCReport).filter(QCReport.order_no == order_no).all()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[QCReport]:
        return self.db.query(QCReport).order_by(desc(QCReport.created_at)).offset(skip).limit(limit).all()

    def update_conclusion(self, report_id: int, conclusion: QCStatus, reviewer: str) -> Optional[QCReport]:
        report = self.get_by_id(report_id)
        if report:
            report.conclusion = conclusion
            report.reviewer = reviewer
            report.review_date = datetime.now()
            self.db.commit()
            self.db.refresh(report)
        return report


class ReviewRecordRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, record: ReviewRecordCreate, reviewer: str) -> ReviewRecord:
        qc_report = self.db.query(QCReport).filter(QCReport.id == record.qc_report_id).first()
        if qc_report:
            before_status = qc_report.conclusion
        else:
            before_status = None
        db_record = ReviewRecord(
            **record.dict(),
            reviewer=reviewer,
            before_status=before_status
        )
        self.db.add(db_record)
        self.db.commit()
        self.db.refresh(db_record)
        return db_record

    def get_by_report_id(self, report_id: int) -> List[ReviewRecord]:
        return self.db.query(ReviewRecord).filter(ReviewRecord.qc_report_id == report_id).all()


class ImportErrorRecordRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, error: ImportErrorRecordCreate, created_by: str = None) -> ImportErrorRecord:
        db_error = ImportErrorRecord(**error.dict(), created_by=created_by)
        self.db.add(db_error)
        self.db.commit()
        self.db.refresh(db_error)
        return db_error

    def get_by_id(self, error_id: int) -> Optional[ImportErrorRecord]:
        return self.db.query(ImportErrorRecord).filter(ImportErrorRecord.id == error_id).first()

    def get_unresolved(self, import_source: ImportSource = None) -> List[ImportErrorRecord]:
        query = self.db.query(ImportErrorRecord).filter(ImportErrorRecord.is_resolved == False)
        if import_source:
            query = query.filter(ImportErrorRecord.import_source == import_source)
        return query.order_by(desc(ImportErrorRecord.created_at)).all()

    def get_all(self, skip: int = 0, limit: int = 100) -> List[ImportErrorRecord]:
        return self.db.query(ImportErrorRecord).order_by(desc(ImportErrorRecord.created_at)).offset(skip).limit(limit).all()

    def mark_resolved(self, error_id: int, resolved_by: str, correction_note: str) -> Optional[ImportErrorRecord]:
        error = self.get_by_id(error_id)
        if error:
            error.is_resolved = True
            error.resolved_by = resolved_by
            error.resolved_at = datetime.now()
            error.correction_note = correction_note
            self.db.commit()
            self.db.refresh(error)
        return error


class QCRuleRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, rule: QCRuleCreate, created_by: str = None) -> QCRule:
        db_rule = QCRule(**rule.dict(), created_by=created_by)
        self.db.add(db_rule)
        self.db.commit()
        self.db.refresh(db_rule)
        return db_rule

    def get_active_rules(self) -> List[QCRule]:
        return self.db.query(QCRule).filter(QCRule.is_active == True).order_by(QCRule.priority).all()

    def get_all(self) -> List[QCRule]:
        return self.db.query(QCRule).order_by(QCRule.priority).all()


class TrendAnalysisRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_daily_trend(self, paper_batch: str = None, days: int = 30) -> List[Dict[str, Any]]:
        start_date = datetime.now() - timedelta(days=days)
        
        measurements = self.db.query(ColorMeasurement).filter(ColorMeasurement.created_at >= start_date)
        if paper_batch:
            measurements = measurements.filter(ColorMeasurement.paper_batch == paper_batch)
        
        measurements = measurements.all()
        
        daily_data = {}
        for m in measurements:
            date_key = m.created_at.date().isoformat()
            if date_key not in daily_data:
                daily_data[date_key] = {
                    "total_count": 0,
                    "pass_count": 0,
                    "delta_e_sum": 0,
                    "delta_e_count": 0
                }
            daily_data[date_key]["total_count"] += 1
            if m.is_pass:
                daily_data[date_key]["pass_count"] += 1
            if m.delta_e is not None:
                daily_data[date_key]["delta_e_sum"] += m.delta_e
                daily_data[date_key]["delta_e_count"] += 1
        
        results = []
        for date, data in sorted(daily_data.items()):
            results.append({
                "date": date,
                "total_count": data["total_count"],
                "pass_rate": data["pass_count"] / data["total_count"] if data["total_count"] > 0 else 0,
                "avg_delta_e": data["delta_e_sum"] / data["delta_e_count"] if data["delta_e_count"] > 0 else 0
            })
        
        return results

    def get_paper_batch_list(self) -> List[str]:
        result = self.db.query(ColorMeasurement.paper_batch).distinct().filter(ColorMeasurement.paper_batch.isnot(None)).all()
        return [r[0] for r in result]
