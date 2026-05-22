from sqlalchemy.orm import Session
from typing import List, Dict, Any
import random
from datetime import datetime, timedelta
import json

from app.models import AcceptanceRecord, ReconciliationResult, User
from app.models.audit import SourceType, RecordStatus
from app.schemas import AcceptanceRecordCreate
from app.services import AuditService


class ReplayService:
    @staticmethod
    def generate_sample_data(db: Session, user_id: int, count: int = 10) -> List[AcceptanceRecord]:
        pharmacies = [
            ("康益大药房", "华东区-浙江省-杭州市"),
            ("仁安堂药房", "华东区-江苏省-南京市"),
            ("百姓药店", "华北区-北京市-朝阳区"),
            ("健康源药房", "华南区-广东省-广州市"),
            ("福寿堂药店", "西南区-四川省-成都市"),
            ("万民药房", "华东区-浙江省-宁波市"),
            ("康复药店", "华北区-天津市-和平区"),
        ]

        medicines = [
            ("阿莫西林胶囊", "AMX001", "盒"),
            ("布洛芬缓释片", "BFL002", "盒"),
            ("感冒灵颗粒", "GML003", "袋"),
            ("维生素C片", "VTC004", "瓶"),
            ("甲硝唑片", "JZX005", "瓶"),
            ("头孢克肟分散片", "TBK006", "盒"),
            ("奥美拉唑肠溶胶囊", "AML007", "盒"),
            ("硝苯地平缓释片", "XBD008", "盒"),
        ]

        source_types = list(SourceType)
        records = []

        for i in range(count):
            pharmacy = random.choice(pharmacies)
            medicine = random.choice(medicines)
            source_type = random.choice(source_types)

            batch_no = f"B{datetime.now().strftime('%Y%m')}{random.randint(1000, 9999)}"
            expiry_month = random.randint(1, 12)
            expiry_year = random.randint(2024, 2026)
            expiry_date = f"{expiry_year}-{expiry_month:02d}-{random.randint(1, 28):02d}"

            near_expiry_days = random.randint(5, 90)
            quantity = random.randint(10, 500)

            record_no = f"ACC{datetime.now().strftime('%Y%m%d')}{random.randint(10000, 99999)}"

            record_in = AcceptanceRecordCreate(
                record_no=record_no,
                pharmacy_name=pharmacy[0],
                pharmacy_region=pharmacy[1],
                source_type=source_type,
                source_ref=f"REF{random.randint(10000, 99999)}",
                medicine_name=medicine[0],
                medicine_code=medicine[1],
                batch_no=batch_no,
                expiry_date=expiry_date,
                quantity=quantity,
                unit=medicine[2],
                near_expiry_days=near_expiry_days,
                notes=f"乡镇药房近效期药品验收记录 - 第{i+1}条",
                external_data=json.dumps({"source": "sample_generator", "version": "1.0"})
            )

            record = AuditService.create_record(db, record_in, user_id)
            AuditService.change_status(db, record.id, RecordStatus.SUBMITTED, "系统自动提交", user_id)
            records.append(record)

        return records

    @staticmethod
    def generate_bad_data(db: Session, user_id: int) -> Dict[str, Any]:
        results = {
            "missing_attachment": None,
            "duplicate_submit": None,
            "manual_fix": None
        }

        record1 = ReplayService._create_missing_attachment_record(db, user_id)
        results["missing_attachment"] = record1

        record2 = ReplayService._create_duplicate_submit_record(db, user_id)
        results["duplicate_submit"] = record2

        record3 = ReplayService._create_manual_fix_record(db, user_id)
        results["manual_fix"] = record3

        return results

    @staticmethod
    def _create_missing_attachment_record(db: Session, user_id: int) -> AcceptanceRecord:
        record_in = AcceptanceRecordCreate(
            record_no=f"ACC{datetime.now().strftime('%Y%m%d')}BAD001",
            pharmacy_name="康宁大药房",
            pharmacy_region="华东区-安徽省-合肥市",
            source_type=SourceType.RETURN_PHOTO,
            source_ref="RET202400123",
            medicine_name="罗红霉素胶囊",
            medicine_code="LMS009",
            batch_no="B2024011234",
            expiry_date="2024-12-31",
            quantity=50,
            unit="盒",
            near_expiry_days=30,
            notes="退货照片验收-缺少附件",
            external_data=json.dumps({"requires_attachment": True})
        )
        record = AuditService.create_record(db, record_in, user_id)
        AuditService.change_status(db, record.id, RecordStatus.SUBMITTED, "提交验收", user_id)
        AuditService.mark_as_bad_data(
            db,
            record.id,
            error_type="MISSING_ATTACHMENT",
            error_message="退货照片来源必须上传照片附件",
            error_details={"required": "photo", "missing_count": 1},
            raw_data=record_in.model_dump()
        )
        return record

    @staticmethod
    def _create_duplicate_submit_record(db: Session, user_id: int) -> AcceptanceRecord:
        record_no = f"ACC{datetime.now().strftime('%Y%m%d')}BAD002"
        record_in = AcceptanceRecordCreate(
            record_no=record_no,
            pharmacy_name="益康药店",
            pharmacy_region="华南区-广东省-深圳市",
            source_type=SourceType.INVENTORY_EXPORT,
            source_ref="INV202405678",
            medicine_name="复方甘草片",
            medicine_code="FFG010",
            batch_no="B2024025678",
            expiry_date="2025-06-30",
            quantity=100,
            unit="瓶",
            near_expiry_days=60,
            notes="进销存导出验收-重复提交检测",
            external_data=json.dumps({"duplicate_check": True})
        )
        record = AuditService.create_record(db, record_in, user_id)
        AuditService.change_status(db, record.id, RecordStatus.SUBMITTED, "首次提交", user_id)
        AuditService.change_status(db, record.id, RecordStatus.UNDER_REVIEW, "复核中", user_id)

        AuditService.mark_as_bad_data(
            db,
            record.id,
            error_type="DUPLICATE_SUBMISSION",
            error_message="检测到同一批次药品重复提交验收",
            error_details={
                "duplicate_record_nos": [record_no, f"{record_no}_DUP"],
                "batch_no": "B2024025678",
                "medicine_code": "FFG010"
            },
            raw_data=record_in.model_dump()
        )
        return record

    @staticmethod
    def _create_manual_fix_record(db: Session, user_id: int) -> AcceptanceRecord:
        record_in = AcceptanceRecordCreate(
            record_no=f"ACC{datetime.now().strftime('%Y%m%d')}BAD003",
            pharmacy_name="天安堂大药房",
            pharmacy_region="华北区-山东省-济南市",
            source_type=SourceType.EXTERNAL_RECEIPT,
            source_ref="EXT202400999",
            medicine_name="盐酸二甲双胍片",
            medicine_code="EJS011",
            batch_no="B2024039999",
            expiry_date="2025-03-15",
            quantity=200,
            unit="盒",
            near_expiry_days=45,
            notes="外部回执验收-待人工改判",
            external_data=json.dumps({"manual_review_required": True})
        )
        record = AuditService.create_record(db, record_in, user_id)
        AuditService.change_status(db, record.id, RecordStatus.SUBMITTED, "提交验收", user_id)
        AuditService.mark_as_bad_data(
            db,
            record.id,
            error_type="EXTERNAL_DATA_MISMATCH",
            error_message="外部回执数据与系统记录不匹配，需人工核实",
            error_details={
                "system_qty": 200,
                "external_qty": 180,
                "mismatch_fields": ["quantity"]
            },
            raw_data=record_in.model_dump()
        )
        return record

    @staticmethod
    def reconcile_records(db: Session, operator_id: int) -> Dict[str, Any]:
        pending_records = db.query(AcceptanceRecord).filter(
            AcceptanceRecord.status == RecordStatus.SUBMITTED,
            AcceptanceRecord.is_valid == True,
            AcceptanceRecord.is_bad_data == False
        ).all()

        results = {
            "total_processed": len(pending_records),
            "matched": 0,
            "unmatched": 0,
            "details": []
        }

        for record in pending_records:
            is_matched = random.random() > 0.3
            match_score = random.uniform(0.6, 1.0) if is_matched else random.uniform(0.2, 0.6)

            reconciliation = ReconciliationResult(
                record_id=record.id,
                is_matched=is_matched,
                match_score=round(match_score, 2),
                matched_with=f"SYS-{random.randint(10000, 99999)}" if is_matched else None,
                reconciliation_notes="自动对账完成" if is_matched else "对账不通过，需人工核实"
            )
            db.add(reconciliation)

            new_status = RecordStatus.RECONCILED if is_matched else RecordStatus.NEEDS_FIX
            AuditService.change_status(
                db,
                record.id,
                new_status,
                f"自动对账: {'通过' if is_matched else '不通过'}，匹配度: {match_score:.2%}",
                operator_id
            )

            if is_matched:
                results["matched"] += 1
            else:
                results["unmatched"] += 1

            results["details"].append({
                "record_id": record.id,
                "record_no": record.record_no,
                "is_matched": is_matched,
                "match_score": round(match_score, 2)
            })

        db.commit()
        return results

    @staticmethod
    def replay_failed_record(db: Session, failed_id: int, operator_id: int) -> Dict[str, Any]:
        from app.models import FailedRecord
        failed = db.query(FailedRecord).filter(FailedRecord.id == failed_id).first()
        if not failed:
            return {"success": False, "message": "失败记录不存在"}

        record = AuditService.get_record(db, failed.record_id)
        if not record:
            return {"success": False, "message": "关联验收记录不存在"}

        success = random.random() > 0.5

        if success:
            failed.resolved = True
            failed.resolved_by = operator_id
            failed.resolved_at = datetime.now()
            failed.resolution_notes = "回放成功，数据验证通过"

            record.is_bad_data = False
            record.is_valid = True
            record.status = RecordStatus.UNDER_REVIEW

            AuditService.change_status(
                db,
                record.id,
                RecordStatus.UNDER_REVIEW,
                "回放验证通过，进入复核流程",
                operator_id
            )
            db.commit()

            return {
                "success": True,
                "message": "回放成功",
                "new_status": RecordStatus.UNDER_REVIEW.value
            }
        else:
            return {
                "success": False,
                "message": "回放失败，数据仍存在问题",
                "error_type": failed.error_type,
                "error_message": failed.error_message
            }
