import json
from datetime import datetime
from sqlalchemy.orm import Session
from .models import (
    House, CommonMeterBill, BillDetail, Dispute, AuditLog, DataIssue,
    RecordStatus, DisputeStatus
)
from .calculator import EnergyShareCalculator, DataValidator


class BillingService:
    """账单管理服务"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def trial_calculate(self, billing_month: str) -> dict:
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        validator = DataValidator(self.session, billing_month)
        issues = validator.validate_all()
        
        for issue in issues:
            self.session.add(issue)
        
        calculator = EnergyShareCalculator(self.session, billing_month)
        result = calculator.calculate()
        
        result["issues"] = [
            {
                "type": i.issue_type,
                "entity": i.related_entity,
                "key": i.related_key,
                "description": i.description
            } for i in issues
        ]
        
        self.session.query(BillDetail).filter_by(billing_month=billing_month).delete()
        
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        bill.record_status = RecordStatus.TRIAL.value
        
        for r in result["results"]:
            has_issue = any(i.related_key == r["room_number"] for i in issues)
            issue_desc = next(
                (i.description for i in issues if i.related_key == r["room_number"]),
                None
            )
            
            detail = BillDetail(
                common_bill_id=bill.id,
                house_id=r["house_id"],
                billing_month=billing_month,
                original_share_amount=r["original_share_amount"],
                reduction_amount=r["reduction_amount"],
                final_amount=r["final_amount"],
                area=r["area"],
                area_weight=r["area_weight"],
                is_vacant=r["is_vacant"],
                vacant_days_ratio=r["vacant_ratio"],
                reduction_detail=json.dumps(r["reduction_details"], ensure_ascii=False),
                calculation_note=r["calculation_note"],
                has_issue=has_issue,
                issue_description=issue_desc,
                version=1
            )
            self.session.add(detail)
        
        old_status = "draft"
        new_status = "trial"
        log = AuditLog(
            bill_id=bill.id,
            operation="trial_calculate",
            old_status=old_status,
            new_status=new_status,
            operated_by="system",
            reason="试算生成"
        )
        self.session.add(log)
        
        self.session.commit()
        return result
    
    def confirm_bill(self, billing_month: str, operator: str = "operator") -> dict:
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        if bill.record_status == RecordStatus.CONFIRMED.value:
            raise ValueError(f"账单 {billing_month} 已确认，不能重复确认")
        
        old_status = bill.record_status
        bill.record_status = RecordStatus.CONFIRMED.value
        
        log = AuditLog(
            bill_id=bill.id,
            operation="confirm",
            old_status=old_status,
            new_status=RecordStatus.CONFIRMED.value,
            operated_by=operator,
            reason="账单确认"
        )
        self.session.add(log)
        self.session.commit()
        
        return {
            "billing_month": billing_month,
            "old_status": old_status,
            "new_status": RecordStatus.CONFIRMED.value
        }
    
    def revise_bill(self, billing_month: str, operator: str = "operator", reason: str = "") -> dict:
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        if bill.record_status != RecordStatus.CONFIRMED.value:
            raise ValueError(f"只有已确认的账单才能修改")
        
        old_status = bill.record_status
        bill.record_status = RecordStatus.REVISED.value
        
        old_details = self.session.query(BillDetail).filter_by(
            billing_month=billing_month
        ).all()
        
        for detail in old_details:
            log = AuditLog(
                bill_id=bill.id,
                operation="revise_detail",
                old_status=old_status,
                new_status=RecordStatus.REVISED.value,
                old_data=json.dumps({
                    "version": detail.version,
                    "original": detail.original_share_amount,
                    "final": detail.final_amount,
                    "reduction": detail.reduction_amount
                }, ensure_ascii=False),
                operated_by=operator,
                reason=reason or "账单修订"
            )
            self.session.add(log)
        
        bill.record_status = RecordStatus.DRAFT.value
        self.session.commit()
        
        return {
            "billing_month": billing_month,
            "old_status": old_status,
            "new_status": RecordStatus.DRAFT.value,
            "reason": reason
        }
    
    def cancel_bill(self, billing_month: str, operator: str = "operator", reason: str = "") -> dict:
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        old_status = bill.record_status
        bill.record_status = RecordStatus.CANCELLED.value
        
        log = AuditLog(
            bill_id=bill.id,
            operation="cancel",
            old_status=old_status,
            new_status=RecordStatus.CANCELLED.value,
            operated_by=operator,
            reason=reason or "账单撤销"
        )
        self.session.add(log)
        self.session.commit()
        
        return {
            "billing_month": billing_month,
            "old_status": old_status,
            "new_status": RecordStatus.CANCELLED.value
        }
    
    def list_bills(self, status: str = None) -> list:
        query = self.session.query(CommonMeterBill)
        if status:
            query = query.filter_by(record_status=status)
        bills = query.order_by(CommonMeterBill.billing_month.desc()).all()
        
        return [
            {
                "billing_month": b.billing_month,
                "total_amount": b.total_amount,
                "electricity_kwh": b.electricity_kwh,
                "water_tons": b.water_tons,
                "status": b.record_status,
                "created_at": b.created_at
            } for b in bills
        ]


class DisputeService:
    """争议管理服务"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def record_dispute(
        self, billing_month: str, room_number: str,
        disputed_amount: float, objection: str, created_by: str = "customer"
    ) -> dict:
        house = self.session.query(House).filter_by(room_number=room_number.strip()).first()
        if not house:
            raise ValueError(f"房号 {room_number} 不存在")
        
        bill_detail = self.session.query(BillDetail).filter(
            BillDetail.billing_month == billing_month,
            BillDetail.house_id == house.id
        ).first()
        
        if not bill_detail:
            raise ValueError(f"未找到 {billing_month} 月 {room_number} 的账单明细")
        
        dispute = Dispute(
            bill_detail_id=bill_detail.id,
            house_id=house.id,
            billing_month=billing_month,
            disputed_amount=disputed_amount,
            customer_objection=objection,
            status=DisputeStatus.PENDING.value,
            created_by=created_by
        )
        self.session.add(dispute)
        self.session.commit()
        
        return {
            "dispute_id": dispute.id,
            "billing_month": billing_month,
            "room_number": room_number,
            "disputed_amount": disputed_amount,
            "status": DisputeStatus.PENDING.value
        }
    
    def list_disputes(self, status: str = None, billing_month: str = None) -> list:
        query = self.session.query(Dispute)
        if status:
            query = query.filter_by(status=status)
        if billing_month:
            query = query.filter_by(billing_month=billing_month)
        
        disputes = query.order_by(Dispute.created_at.desc()).all()
        
        result = []
        for d in disputes:
            house = self.session.query(House).filter_by(id=d.house_id).first()
            result.append({
                "id": d.id,
                "billing_month": d.billing_month,
                "room_number": house.room_number if house else "",
                "disputed_amount": d.disputed_amount,
                "objection": d.customer_objection,
                "status": d.status,
                "resolution": d.resolution,
                "created_at": d.created_at
            })
        return result
    
    def resolve_dispute(
        self, dispute_id: int, resolution: str,
        resolved_by: str = "operator"
    ) -> dict:
        dispute = self.session.query(Dispute).filter_by(id=dispute_id).first()
        if not dispute:
            raise ValueError(f"争议记录 {dispute_id} 不存在")
        
        dispute.status = DisputeStatus.RESOLVED.value
        dispute.resolution = resolution
        dispute.resolved_at = datetime.utcnow()
        self.session.commit()
        
        return {
            "dispute_id": dispute_id,
            "billing_month": dispute.billing_month,
            "status": DisputeStatus.RESOLVED.value,
            "resolution": resolution
        }


class AuditService:
    """审计日志服务"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def get_bill_history(self, billing_month: str) -> list:
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        logs = self.session.query(AuditLog).filter_by(
            bill_id=bill.id
        ).order_by(AuditLog.operated_at.asc()).all()
        
        return [
            {
                "id": log.id,
                "operation": log.operation,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "old_data": log.old_data,
                "new_data": log.new_data,
                "operated_by": log.operated_by,
                "operated_at": log.operated_at,
                "reason": log.reason
            } for log in logs
        ]
    
    def compare_versions(self, billing_month: str) -> list:
        bill = self.session.query(CommonMeterBill).filter_by(
            billing_month=billing_month
        ).first()
        
        if not bill:
            raise ValueError(f"未找到 {billing_month} 的账单")
        
        details = self.session.query(BillDetail).filter_by(
            billing_month=billing_month
        ).all()
        
        logs = self.session.query(AuditLog).filter(
            AuditLog.bill_id == bill.id,
            AuditLog.operation == "revise_detail"
        ).order_by(AuditLog.operated_at.asc()).all()
        
        result = []
        for log in logs:
            if log.old_data:
                old = json.loads(log.old_data)
                result.append({
                    "operated_at": log.operated_at,
                    "operated_by": log.operated_by,
                    "reason": log.reason,
                    "old_version": old.get("version"),
                    "old_final": old.get("final"),
                    "old_reduction": old.get("reduction")
                })
        
        return result
