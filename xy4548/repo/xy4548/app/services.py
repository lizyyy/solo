from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Tuple, Dict
from datetime import datetime
import json
from . import models, schemas
from .models import FlyAshBatch, TonBag, InspectionRecord, LandfillReservation, ReviewNote, AuditLog

LEACHING_LIMITS = {
    'pb': 0.25,
    'cd': 0.15,
    'cr': 0.3,
    'hg': 0.05,
    'as': 0.3,
    'zn': 100.0,
    'cu': 40.0,
    'ni': 0.5
}

class AuditService:
    @staticmethod
    def log_operation(
        db: Session,
        operation_type: str,
        module: str,
        resource_type: str,
        resource_id: str,
        operator: str,
        operation_detail: str,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        is_successful: bool = True,
        failure_reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        audit_log = AuditLog(
            operation_type=operation_type,
            module=module,
            resource_type=resource_type,
            resource_id=resource_id,
            operator=operator,
            ip_address=ip_address,
            operation_detail=operation_detail,
            old_value=old_value,
            new_value=new_value,
            is_successful=is_successful,
            failure_reason=failure_reason
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log

class InspectionService:
    @staticmethod
    def check_inspection_qualified(inspection: InspectionRecord) -> Tuple[bool, List[str]]:
        violations = []
        
        for metal, limit in LEACHING_LIMITS.items():
            attr_name = f'leaching_{metal}'
            value = getattr(inspection, attr_name, None)
            
            if value is not None and value > limit:
                violations.append(f"{metal.upper()} 浸出浓度 {value} mg/L 超过限值 {limit} mg/L")
        
        return len(violations) == 0, violations

    @staticmethod
    def update_inspection_status(db: Session, inspection: InspectionRecord, is_qualified: bool):
        inspection.is_qualified = is_qualified
        db.commit()
        db.refresh(inspection)
        
        if inspection.bag_id:
            bag = db.query(TonBag).filter(TonBag.id == inspection.bag_id).first()
            if bag:
                latest_inspection = db.query(InspectionRecord).filter(
                    InspectionRecord.bag_id == bag.id,
                    InspectionRecord.is_qualified == True
                ).order_by(InspectionRecord.inspection_date.desc()).first()
                
                if latest_inspection:
                    bag.is_qualified = True
                    bag.inspection_status = "passed"
                else:
                    failed_inspection = db.query(InspectionRecord).filter(
                        InspectionRecord.bag_id == bag.id,
                        InspectionRecord.is_qualified == False
                    ).order_by(InspectionRecord.inspection_date.desc()).first()
                    
                    if failed_inspection:
                        bag.is_qualified = False
                        bag.inspection_status = "failed"
                
                db.commit()
                db.refresh(bag)

class RiskCalculationService:
    @staticmethod
    def calculate_risk_level(db: Session, bag: TonBag) -> Tuple[str, List[str]]:
        risk_factors = []
        risk_score = 0
        
        if not bag.is_qualified:
            risk_factors.append("未通过浸出检测")
            risk_score += 100
        
        inspections = db.query(InspectionRecord).filter(
            InspectionRecord.bag_id == bag.id
        ).all()
        
        for inspection in inspections:
            for metal, limit in LEACHING_LIMITS.items():
                attr_name = f'leaching_{metal}'
                value = getattr(inspection, attr_name, None)
                
                if value is not None:
                    ratio = value / limit
                    if ratio > 0.8:
                        risk_factors.append(f"{metal.upper()} 接近限值 ({ratio*100:.1f}%)")
                        risk_score += 30
                    if ratio > 0.5:
                        risk_score += 10
        
        batch = db.query(FlyAshBatch).filter(FlyAshBatch.id == bag.batch_id).first()
        if batch:
            if batch.chelating_agent_dosage is not None and batch.chelating_agent_dosage < 2.0:
                risk_factors.append("螯合剂投加量偏低")
                risk_score += 20
        
        if risk_score >= 100:
            return "critical", risk_factors
        elif risk_score >= 60:
            return "high", risk_factors
        elif risk_score >= 30:
            return "medium", risk_factors
        elif risk_score > 0:
            return "low", risk_factors
        else:
            return "unknown", []

    @staticmethod
    def recalculate_bag_risk(db: Session, bag: TonBag, operator: str) -> schemas.RiskRecalculationResult:
        old_risk_level = bag.risk_level
        
        new_risk_level, risk_factors = RiskCalculationService.calculate_risk_level(db, bag)
        
        if old_risk_level != new_risk_level:
            bag.risk_level = new_risk_level
            db.commit()
            db.refresh(bag)
            
            AuditService.log_operation(
                db=db,
                operation_type="RISK_RECALCULATION",
                module="risk_management",
                resource_type="ton_bag",
                resource_id=str(bag.id),
                operator=operator,
                operation_detail=f"风险等级从 {old_risk_level} 变更为 {new_risk_level}",
                old_value=old_risk_level,
                new_value=new_risk_level
            )
        
        return schemas.RiskRecalculationResult(
            bag_id=bag.id,
            bag_number=bag.bag_number,
            old_risk_level=old_risk_level,
            new_risk_level=new_risk_level,
            risk_factors=risk_factors
        )

class OutboundValidationService:
    @staticmethod
    def validate_outbound(
        db: Session,
        reservation_id: int,
        bag_ids: List[int]
    ) -> schemas.OutboundValidationResult:
        errors = []
        warnings = []
        unqualified_bags = []
        duplicate_bags = []
        
        reservation = db.query(LandfillReservation).filter(
            LandfillReservation.id == reservation_id
        ).first()
        
        if not reservation:
            return schemas.OutboundValidationResult(
                is_valid=False,
                errors=["预约不存在"],
                unqualified_bags=[],
                duplicate_bags=[],
                weight_mismatch=False
            )
        
        total_weight = 0.0
        seen_bag_numbers = set()
        
        for bag_id in bag_ids:
            bag = db.query(TonBag).filter(TonBag.id == bag_id).first()
            
            if not bag:
                errors.append(f"吨袋 ID {bag_id} 不存在")
                continue
            
            if not bag.is_qualified:
                unqualified_bags.append(bag.bag_number)
                errors.append(f"吨袋 {bag.bag_number} 未通过检测，禁止出库")
            
            if bag.is_outbound:
                duplicate_bags.append(bag.bag_number)
                errors.append(f"吨袋 {bag.bag_number} 已出库，禁止重复出库")
            
            if bag.bag_number in seen_bag_numbers:
                duplicate_bags.append(bag.bag_number)
                errors.append(f"吨袋 {bag.bag_number} 在出库列表中重复")
            
            seen_bag_numbers.add(bag.bag_number)
            total_weight += bag.weight
        
        weight_mismatch = False
        weight_difference = None
        if reservation.reserved_weight > 0:
            weight_difference = total_weight - reservation.reserved_weight
            weight_mismatch_ratio = abs(weight_difference) / reservation.reserved_weight
            
            if weight_mismatch_ratio > 0.1:
                weight_mismatch = True
                warnings.append(
                    f"出库重量 {total_weight:.2f} 吨与预约重量 {reservation.reserved_weight:.2f} 吨差异较大"
                )
            elif weight_mismatch_ratio > 0.05:
                warnings.append(
                    f"出库重量 {total_weight:.2f} 吨与预约重量 {reservation.reserved_weight:.2f} 吨存在差异"
                )
        
        is_valid = len(errors) == 0
        
        return schemas.OutboundValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            unqualified_bags=unqualified_bags,
            duplicate_bags=duplicate_bags,
            weight_mismatch=weight_mismatch,
            weight_difference=weight_difference
        )

class ManualOverrideService:
    @staticmethod
    def manual_override_qualification(
        db: Session,
        bag_id: int,
        new_is_qualified: bool,
        override_reason: str,
        operator: str,
        approval_required: bool = False
    ) -> schemas.ManualOverrideResult:
        bag = db.query(TonBag).filter(TonBag.id == bag_id).first()
        
        if not bag:
            return schemas.ManualOverrideResult(
                is_successful=False,
                message="吨袋不存在",
                bag_number="",
                old_is_qualified=False,
                new_is_qualified=False
            )
        
        old_is_qualified = bag.is_qualified
        
        if old_is_qualified == new_is_qualified:
            return schemas.ManualOverrideResult(
                is_successful=True,
                message="吨袋状态无需变更",
                bag_number=bag.bag_number,
                old_is_qualified=old_is_qualified,
                new_is_qualified=new_is_qualified
            )
        
        bag.is_qualified = new_is_qualified
        if new_is_qualified:
            bag.inspection_status = "passed"
        else:
            bag.inspection_status = "failed"
        
        db.commit()
        db.refresh(bag)
        
        review_note = ReviewNote(
            bag_id=bag_id,
            reviewer=operator,
            risk_assessment="high" if new_is_qualified else "medium",
            note_content=f"人工改判: 合格状态从 {old_is_qualified} 改为 {new_is_qualified}。原因: {override_reason}",
            is_exception=True,
            exception_reason=override_reason
        )
        db.add(review_note)
        db.commit()
        
        AuditService.log_operation(
            db=db,
            operation_type="MANUAL_OVERRIDE",
            module="qualification",
            resource_type="ton_bag",
            resource_id=str(bag.id),
            operator=operator,
            operation_detail=f"人工改判合格状态: 从 {old_is_qualified} 改为 {new_is_qualified}",
            old_value=str(old_is_qualified),
            new_value=str(new_is_qualified)
        )
        
        return schemas.ManualOverrideResult(
            is_successful=True,
            message="人工改判成功",
            bag_number=bag.bag_number,
            old_is_qualified=old_is_qualified,
            new_is_qualified=new_is_qualified
        )

class ExportService:
    @staticmethod
    def generate_handover_markdown(
        db: Session,
        reservation_id: int
    ) -> str:
        reservation = db.query(LandfillReservation).filter(
            LandfillReservation.id == reservation_id
        ).first()
        
        if not reservation:
            return "# 交接单\n\n预约不存在"
        
        batch = None
        if reservation.batch_id:
            batch = db.query(FlyAshBatch).filter(
                FlyAshBatch.id == reservation.batch_id
            ).first()
        
        bags = db.query(TonBag).filter(
            TonBag.reservation_id == reservation.id
        ).all()
        
        md_lines = []
        
        md_lines.append("# 飞灰螯合出库交接单")
        md_lines.append(f"\n**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"\n---")
        
        md_lines.append(f"\n## 预约信息")
        md_lines.append(f"\n| 项目 | 内容 |")
        md_lines.append(f"|------|------|")
        md_lines.append(f"| 预约编号 | {reservation.reservation_number} |")
        md_lines.append(f"| 预约日期 | {reservation.reservation_date.strftime('%Y-%m-%d') if reservation.reservation_date else '-'} |")
        md_lines.append(f"| 计划出库日期 | {reservation.planned_outbound_date.strftime('%Y-%m-%d') if reservation.planned_outbound_date else '-'} |")
        md_lines.append(f"| 填埋场 | {reservation.landfill_site or '-'} |")
        md_lines.append(f"| 运输公司 | {reservation.transport_company or '-'} |")
        md_lines.append(f"| 车牌号 | {reservation.vehicle_number or '-'} |")
        md_lines.append(f"| 司机 | {reservation.driver_name or '-'} |")
        md_lines.append(f"| 司机电话 | {reservation.driver_phone or '-'} |")
        md_lines.append(f"| 预约重量 | {reservation.reserved_weight:.2f} 吨 |")
        md_lines.append(f"| 实际重量 | {reservation.actual_weight:.2f} 吨 |" if reservation.actual_weight else f"| 实际重量 | - |")
        md_lines.append(f"| 状态 | {reservation.status} |")
        
        if batch:
            md_lines.append(f"\n## 批次信息")
            md_lines.append(f"\n| 项目 | 内容 |")
            md_lines.append(f"|------|------|")
            md_lines.append(f"| 批次编号 | {batch.batch_number} |")
            md_lines.append(f"| 批次日期 | {batch.batch_date.strftime('%Y-%m-%d') if batch.batch_date else '-'} |")
            md_lines.append(f"| 飞灰来源 | {batch.ash_source or '-'} |")
            md_lines.append(f"| 总重量 | {batch.total_weight:.2f} 吨 |")
            md_lines.append(f"| 吨袋数量 | {batch.bag_count} |")
            md_lines.append(f"| 螯合剂类型 | {batch.chelating_agent_type or '-'} |")
            md_lines.append(f"| 螯合剂投加量 | {batch.chelating_agent_dosage:.2f} kg/吨 |" if batch.chelating_agent_dosage else f"| 螯合剂投加量 | - |")
            md_lines.append(f"| 混合时间 | {batch.mixing_duration:.1f} 分钟 |" if batch.mixing_duration else f"| 混合时间 | - |")
            md_lines.append(f"| 操作员 | {batch.operator or '-'} |")
        
        md_lines.append(f"\n## 吨袋明细")
        md_lines.append(f"\n| 序号 | 吨袋编号 | 重量(吨) | RFID标签 | 存储位置 | 检测状态 | 是否合格 | 风险等级 |")
        md_lines.append(f"|------|----------|----------|----------|----------|----------|----------|----------|")
        
        for idx, bag in enumerate(bags, 1):
            md_lines.append(
                f"| {idx} | {bag.bag_number} | {bag.weight:.2f} | "
                f"{bag.rfid_tag or '-'} | {bag.storage_location or '-'} | "
                f"{bag.inspection_status} | {'是' if bag.is_qualified else '否'} | {bag.risk_level} |"
            )
        
        review_notes = db.query(ReviewNote).filter(
            or_(
                ReviewNote.reservation_id == reservation.id,
                ReviewNote.batch_id == reservation.batch_id
            )
        ).all()
        
        if review_notes:
            md_lines.append(f"\n## 复核备注")
            for note in review_notes:
                md_lines.append(f"\n### 复核记录 ({note.review_time.strftime('%Y-%m-%d %H:%M:%S') if note.review_time else '-'})")
                md_lines.append(f"\n- **复核人**: {note.reviewer}")
                md_lines.append(f"- **风险评估**: {note.risk_assessment}")
                md_lines.append(f"- **备注内容**: {note.note_content}")
                if note.is_exception:
                    md_lines.append(f"- **异常标记**: 是")
                    if note.exception_reason:
                        md_lines.append(f"- **异常原因**: {note.exception_reason}")
                if note.approved_by:
                    md_lines.append(f"- **批准人**: {note.approved_by}")
        
        md_lines.append(f"\n---")
        md_lines.append(f"\n**本交接单由系统自动生成，具有追溯效力。**")
        
        return "\n".join(md_lines)

    @staticmethod
    def generate_audit_package(
        db: Session,
        reservation_id: int
    ) -> dict:
        reservation = db.query(LandfillReservation).filter(
            LandfillReservation.id == reservation_id
        ).first()
        
        if not reservation:
            return {"error": "预约不存在"}
        
        batch = None
        if reservation.batch_id:
            batch = db.query(FlyAshBatch).filter(
                FlyAshBatch.id == reservation.batch_id
            ).first()
        
        bags = db.query(TonBag).filter(
            TonBag.reservation_id == reservation.id
        ).all()
        
        bag_ids = [bag.id for bag in bags]
        
        inspections = db.query(InspectionRecord).filter(
            or_(
                InspectionRecord.batch_id == reservation.batch_id,
                InspectionRecord.bag_id.in_(bag_ids) if bag_ids else False
            )
        ).all()
        
        review_notes = db.query(ReviewNote).filter(
            or_(
                ReviewNote.reservation_id == reservation.id,
                ReviewNote.batch_id == reservation.batch_id
            )
        ).all()
        
        audit_logs = db.query(AuditLog).filter(
            and_(
                AuditLog.resource_type == "landfill_reservation",
                AuditLog.resource_id == str(reservation.id)
            )
        ).order_by(AuditLog.log_time.desc()).all()
        
        def model_to_dict(obj):
            if not obj:
                return None
            result = {}
            for column in obj.__table__.columns:
                value = getattr(obj, column.name)
                if isinstance(value, datetime):
                    result[column.name] = value.isoformat()
                else:
                    result[column.name] = value
            return result
        
        package = {
            "package_generated_at": datetime.now().isoformat(),
            "package_version": "1.0",
            "reservation": model_to_dict(reservation),
            "batch": model_to_dict(batch),
            "ton_bags": [model_to_dict(bag) for bag in bags],
            "inspections": [model_to_dict(ins) for ins in inspections],
            "review_notes": [model_to_dict(note) for note in review_notes],
            "audit_trail": [model_to_dict(log) for log in audit_logs],
            "summary": {
                "total_bags": len(bags),
                "qualified_bags": len([b for b in bags if b.is_qualified]),
                "unqualified_bags": len([b for b in bags if not b.is_qualified]),
                "total_weight": sum(b.weight for b in bags),
                "reserved_weight": reservation.reserved_weight,
                "weight_difference": sum(b.weight for b in bags) - reservation.reserved_weight if reservation.reserved_weight else None
            }
        }
        
        return package
