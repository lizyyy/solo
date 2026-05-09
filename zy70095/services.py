from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

import models
import schemas

MAX_ALLOWED_DEVIATION = 10.0
SOC_WARNING_MARGIN = 5.0

class PlanService:
    @staticmethod
    def validate_soc_transition(
        segments: List[schemas.PlanSegmentCreate],
        soc_constraint: models.SOCConstraint
    ) -> Tuple[bool, str]:
        if not segments:
            return False, "计划时段不能为空"
        
        sorted_segments = sorted(segments, key=lambda s: s.start_time)
        
        for i, segment in enumerate(sorted_segments):
            if segment.expected_soc < soc_constraint.min_soc:
                return False, f"时段 {i+1} 结束时 SOC ({segment.expected_soc:.2f}%) 低于最小限制 ({soc_constraint.min_soc}%)"
            
            if segment.expected_soc > soc_constraint.max_soc:
                return False, f"时段 {i+1} 结束时 SOC ({segment.expected_soc:.2f}%) 超过最大限制 ({soc_constraint.max_soc}%)"
        
        return True, "SOC 校验通过"

    @staticmethod
    def validate_time_overlap(segments: List[schemas.PlanSegmentCreate]) -> Tuple[bool, str]:
        if len(segments) < 2:
            return True, "无时段重叠"
        
        sorted_segments = sorted(segments, key=lambda s: s.start_time)
        
        for i in range(len(sorted_segments) - 1):
            current = sorted_segments[i]
            next_seg = sorted_segments[i + 1]
            
            if current.end_time > next_seg.start_time:
                return False, f"时段 {i+1} 与时段 {i+2} 存在时间重叠"
        
        return True, "时间连续性校验通过"

    @staticmethod
    def create_version_snapshot(
        db: Session,
        plan: models.ChargePlan,
        reason: str,
        changed_by: Optional[str] = None
    ) -> models.PlanVersion:
        snapshot_data = {
            "plan_name": plan.plan_name,
            "description": plan.description,
            "status": plan.status,
            "segments": [
                {
                    "start_time": seg.start_time.isoformat(),
                    "end_time": seg.end_time.isoformat(),
                    "operation_type": seg.operation_type,
                    "power_kw": seg.power_kw,
                    "energy_kwh": seg.energy_kwh,
                    "expected_soc": seg.expected_soc
                }
                for seg in plan.segments
            ]
        }
        
        version = models.PlanVersion(
            plan_id=plan.id,
            version_number=plan.version,
            status=plan.status,
            change_reason=reason,
            changed_by=changed_by,
            snapshot_data=snapshot_data
        )
        db.add(version)
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def record_history(
        db: Session,
        plan: models.ChargePlan,
        action: str,
        new_status: str,
        operator: Optional[str] = None,
        reason: Optional[str] = None
    ):
        history = models.PlanHistory(
            plan_id=plan.id,
            action=action,
            old_status=plan.status,
            new_status=new_status,
            operator=operator,
            reason=reason
        )
        db.add(history)

    @staticmethod
    def create_plan(
        db: Session,
        plan_data: schemas.ChargePlanCreate,
        created_by: Optional[str] = None
    ) -> models.ChargePlan:
        soc_constraint = db.query(models.SOCConstraint).filter(
            models.SOCConstraint.id == plan_data.soc_constraint_id
        ).first()
        if not soc_constraint:
            raise ValueError("SOC 约束不存在")
        
        is_valid, msg = PlanService.validate_soc_transition(plan_data.segments, soc_constraint)
        if not is_valid:
            raise ValueError(f"SOC 校验失败: {msg}")
        
        is_valid, msg = PlanService.validate_time_overlap(plan_data.segments)
        if not is_valid:
            raise ValueError(f"时间校验失败: {msg}")
        
        existing_plan = db.query(models.ChargePlan).filter(
            models.ChargePlan.station_id == plan_data.station_id,
            models.ChargePlan.plan_date == plan_data.plan_date
        ).first()
        
        if existing_plan:
            if existing_plan.status == schemas.PlanStatus.COMPLETED.value:
                raise ValueError("该日期的计划已完成，不能创建新计划")
            if existing_plan.status in [
                schemas.PlanStatus.APPROVED.value,
                schemas.PlanStatus.EXECUTING.value
            ]:
                raise ValueError("该日期的计划已审批或执行中，请使用版本更新")
        
        if existing_plan and existing_plan.status in [
            schemas.PlanStatus.DRAFT.value,
            schemas.PlanStatus.PENDING.value,
            schemas.PlanStatus.MANUALLY_CORRECTED.value
        ]:
            PlanService.create_version_snapshot(
                db, existing_plan, "创建新版本替换旧计划", created_by
            )
            db.delete(existing_plan)
            db.commit()
        
        plan = models.ChargePlan(
            station_id=plan_data.station_id,
            plan_date=plan_data.plan_date,
            plan_name=plan_data.plan_name,
            description=plan_data.description,
            soc_constraint_id=plan_data.soc_constraint_id,
            load_forecast_data=plan_data.load_forecast_data,
            created_by=created_by,
            status=schemas.PlanStatus.DRAFT.value
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        
        for segment_data in plan_data.segments:
            segment = models.PlanSegment(
                plan_id=plan.id,
                start_time=segment_data.start_time,
                end_time=segment_data.end_time,
                operation_type=segment_data.operation_type.value,
                power_kw=segment_data.power_kw,
                energy_kwh=segment_data.energy_kwh,
                expected_soc=segment_data.expected_soc,
                price_window_id=segment_data.price_window_id
            )
            db.add(segment)
        
        db.commit()
        db.refresh(plan)
        
        PlanService.record_history(db, plan, "创建计划", schemas.PlanStatus.DRAFT.value, created_by)
        PlanService.create_version_snapshot(db, plan, "初始版本", created_by)
        db.commit()
        
        return plan

    @staticmethod
    def submit_plan_for_approval(
        db: Session,
        plan_id: int,
        operator: Optional[str] = None
    ) -> models.ChargePlan:
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        if not plan:
            raise ValueError("计划不存在")
        
        if plan.status != schemas.PlanStatus.DRAFT.value:
            raise ValueError("只有草稿状态的计划可以提交审批")
        
        PlanService.record_history(
            db, plan, "提交审批", schemas.PlanStatus.PENDING.value, operator
        )
        plan.status = schemas.PlanStatus.PENDING.value
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def approve_plan(
        db: Session,
        plan_id: int,
        operator: Optional[str] = None
    ) -> models.ChargePlan:
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        if not plan:
            raise ValueError("计划不存在")
        
        if plan.status != schemas.PlanStatus.PENDING.value:
            raise ValueError("只有待审批状态的计划可以审批")
        
        PlanService.record_history(
            db, plan, "审批通过", schemas.PlanStatus.APPROVED.value, operator
        )
        plan.status = schemas.PlanStatus.APPROVED.value
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def start_execution(
        db: Session,
        plan_id: int,
        operator: Optional[str] = None
    ) -> models.ChargePlan:
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        if not plan:
            raise ValueError("计划不存在")
        
        if plan.status == schemas.PlanStatus.EXECUTING.value:
            raise ValueError("计划已在执行中，重复操作")
        
        if plan.status not in [
            schemas.PlanStatus.APPROVED.value,
            schemas.PlanStatus.MANUALLY_CORRECTED.value
        ]:
            raise ValueError("只有已审批或人工修正状态的计划可以开始执行")
        
        PlanService.record_history(
            db, plan, "开始执行", schemas.PlanStatus.EXECUTING.value, operator
        )
        plan.status = schemas.PlanStatus.EXECUTING.value
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def cancel_plan(
        db: Session,
        plan_id: int,
        reason: str,
        operator: Optional[str] = None
    ) -> models.ChargePlan:
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        if not plan:
            raise ValueError("计划不存在")
        
        if plan.status == schemas.PlanStatus.COMPLETED.value:
            raise ValueError("已完成的计划不能取消")
        
        if plan.status == schemas.PlanStatus.CANCELLED.value:
            raise ValueError("计划已取消，重复操作")
        
        PlanService.record_history(
            db, plan, "取消计划", schemas.PlanStatus.CANCELLED.value, operator, reason
        )
        PlanService.create_version_snapshot(db, plan, f"取消计划: {reason}", operator)
        plan.status = schemas.PlanStatus.CANCELLED.value
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def manual_correct(
        db: Session,
        correction_data: schemas.ManualCorrectionCreate
    ) -> models.ChargePlan:
        plan = db.query(models.ChargePlan).filter(
            models.ChargePlan.id == correction_data.plan_id
        ).first()
        if not plan:
            raise ValueError("计划不存在")
        
        if plan.status == correction_data.target_status.value:
            raise ValueError("计划已是目标状态")
        
        valid_transitions = {
            schemas.PlanStatus.EXECUTING.value: [
                schemas.PlanStatus.MANUALLY_CORRECTED.value,
                schemas.PlanStatus.COMPLETED.value
            ],
            schemas.PlanStatus.APPROVED.value: [
                schemas.PlanStatus.MANUALLY_CORRECTED.value
            ],
            schemas.PlanStatus.MANUALLY_CORRECTED.value: [
                schemas.PlanStatus.APPROVED.value,
                schemas.PlanStatus.EXECUTING.value,
                schemas.PlanStatus.COMPLETED.value
            ]
        }
        
        if plan.status in valid_transitions:
            if correction_data.target_status.value not in valid_transitions[plan.status]:
                raise ValueError(f"不允许从 {plan.status} 转换到 {correction_data.target_status.value}")
        
        PlanService.create_version_snapshot(
            db, plan, f"人工修正: {correction_data.reason}", correction_data.corrected_by
        )
        
        PlanService.record_history(
            db, plan, "人工修正", correction_data.target_status.value,
            correction_data.corrected_by, correction_data.reason
        )
        
        plan.status = correction_data.target_status.value
        plan.version += 1
        db.commit()
        db.refresh(plan)
        return plan

    @staticmethod
    def get_plan_history(
        db: Session,
        plan_id: int
    ) -> List[models.PlanHistory]:
        return db.query(models.PlanHistory).filter(
            models.PlanHistory.plan_id == plan_id
        ).order_by(models.PlanHistory.created_at.asc()).all()


class ExecutionService:
    @staticmethod
    def check_deviation(
        planned: float,
        actual: float,
        threshold: float = MAX_ALLOWED_DEVIATION
    ) -> Tuple[bool, float]:
        if abs(planned) < 0.001:
            if abs(actual) > 0.001:
                return True, 100.0
            return False, 0.0
        
        deviation = abs((actual - planned) / planned) * 100
        return deviation > threshold, deviation

    @staticmethod
    def create_receipt(
        db: Session,
        receipt_data: schemas.ExecutionReceiptCreate
    ) -> models.ExecutionReceipt:
        plan = db.query(models.ChargePlan).filter(
            models.ChargePlan.id == receipt_data.plan_id
        ).first()
        if not plan:
            raise ValueError("计划不存在")
        
        if plan.status != schemas.PlanStatus.EXECUTING.value:
            raise ValueError("只有执行中的计划可以提交执行回执")
        
        segment = db.query(models.PlanSegment).filter(
            models.PlanSegment.id == receipt_data.segment_id,
            models.PlanSegment.plan_id == receipt_data.plan_id
        ).first()
        if not segment:
            raise ValueError("计划时段不存在")
        
        existing_receipt = db.query(models.ExecutionReceipt).filter(
            models.ExecutionReceipt.segment_id == receipt_data.segment_id
        ).first()
        if existing_receipt:
            raise ValueError("该时段已有执行回执，重复操作")
        
        soc_constraint = plan.soc_constraint
        if receipt_data.actual_soc < soc_constraint.min_soc:
            alert = models.DeviationAlert(
                plan_id=plan.id,
                segment_id=segment.id,
                alert_type="SOC_BELOW_LIMIT",
                alert_level=schemas.AlertLevel.CRITICAL.value,
                message=f"SOC ({receipt_data.actual_soc}%) 低于最小限制 ({soc_constraint.min_soc}%)",
                deviation_value=receipt_data.actual_soc - soc_constraint.min_soc,
                threshold_value=soc_constraint.min_soc
            )
            db.add(alert)
        
        if receipt_data.actual_soc > soc_constraint.max_soc:
            alert = models.DeviationAlert(
                plan_id=plan.id,
                segment_id=segment.id,
                alert_type="SOC_ABOVE_LIMIT",
                alert_level=schemas.AlertLevel.CRITICAL.value,
                message=f"SOC ({receipt_data.actual_soc}%) 超过最大限制 ({soc_constraint.max_soc}%)",
                deviation_value=receipt_data.actual_soc - soc_constraint.max_soc,
                threshold_value=soc_constraint.max_soc
            )
            db.add(alert)
        
        has_energy_deviation, energy_deviation = ExecutionService.check_deviation(
            segment.energy_kwh, receipt_data.actual_energy_kwh
        )
        if has_energy_deviation:
            level = schemas.AlertLevel.WARNING.value
            if energy_deviation > 20.0:
                level = schemas.AlertLevel.CRITICAL.value
            alert = models.DeviationAlert(
                plan_id=plan.id,
                segment_id=segment.id,
                alert_type="ENERGY_DEVIATION",
                alert_level=level,
                message=f"充放电电量偏差 {energy_deviation:.2f}%，超过允许范围",
                deviation_value=energy_deviation,
                threshold_value=MAX_ALLOWED_DEVIATION
            )
            db.add(alert)
        
        has_power_deviation, power_deviation = ExecutionService.check_deviation(
            segment.power_kw, receipt_data.actual_power_kw
        )
        if has_power_deviation:
            alert = models.DeviationAlert(
                plan_id=plan.id,
                segment_id=segment.id,
                alert_type="POWER_DEVIATION",
                alert_level=schemas.AlertLevel.WARNING.value,
                message=f"功率偏差 {power_deviation:.2f}%",
                deviation_value=power_deviation,
                threshold_value=MAX_ALLOWED_DEVIATION
            )
            db.add(alert)
        
        if receipt_data.equipment_status == schemas.EquipmentStatus.FAULT.value:
            alert = models.DeviationAlert(
                plan_id=plan.id,
                segment_id=segment.id,
                alert_type="EQUIPMENT_FAULT",
                alert_level=schemas.AlertLevel.CRITICAL.value,
                message="设备故障，请检查设备状态",
                deviation_value=None,
                threshold_value=None
            )
            db.add(alert)
        elif receipt_data.equipment_status == schemas.EquipmentStatus.LIMITED.value:
            alert = models.DeviationAlert(
                plan_id=plan.id,
                segment_id=segment.id,
                alert_type="EQUIPMENT_LIMITED",
                alert_level=schemas.AlertLevel.WARNING.value,
                message="设备受限",
                deviation_value=None,
                threshold_value=None
            )
            db.add(alert)
        
        receipt = models.ExecutionReceipt(
            plan_id=receipt_data.plan_id,
            segment_id=receipt_data.segment_id,
            actual_start_time=receipt_data.actual_start_time,
            actual_end_time=receipt_data.actual_end_time,
            actual_power_kw=receipt_data.actual_power_kw,
            actual_energy_kwh=receipt_data.actual_energy_kwh,
            actual_soc=receipt_data.actual_soc,
            equipment_status=receipt_data.equipment_status.value,
            remarks=receipt_data.remarks
        )
        db.add(receipt)
        db.commit()
        db.refresh(receipt)
        
        all_segments = db.query(models.PlanSegment).filter(
            models.PlanSegment.plan_id == plan.id
        ).all()
        all_receipts = db.query(models.ExecutionReceipt).filter(
            models.ExecutionReceipt.plan_id == plan.id
        ).all()
        
        if len(all_receipts) >= len(all_segments):
            plan.status = schemas.PlanStatus.COMPLETED.value
            PlanService.record_history(
                db, plan, "自动完成", schemas.PlanStatus.COMPLETED.value
            )
            db.commit()
            db.refresh(plan)
            
            RevenueService.generate_report(db, plan.id)
        
        return receipt

    @staticmethod
    def resolve_alert(
        db: Session,
        alert_id: int,
        resolved_by: str
    ) -> models.DeviationAlert:
        alert = db.query(models.DeviationAlert).filter(
            models.DeviationAlert.id == alert_id
        ).first()
        if not alert:
            raise ValueError("告警不存在")
        
        if alert.is_resolved:
            raise ValueError("告警已处理，重复操作")
        
        alert.is_resolved = True
        alert.resolved_by = resolved_by
        alert.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)
        return alert


class RevenueService:
    @staticmethod
    def calculate_revenue(
        db: Session,
        plan: models.ChargePlan
    ) -> Dict[str, float]:
        receipts = plan.execution_receipts
        segments = plan.segments
        
        total_charge_kwh = 0.0
        total_discharge_kwh = 0.0
        charge_cost = 0.0
        discharge_revenue = 0.0
        
        segment_map = {seg.id: seg for seg in segments}
        
        for receipt in receipts:
            segment = segment_map.get(receipt.segment_id)
            if not segment:
                continue
            
            price_window = segment.price_window
            price = price_window.price_per_kwh if price_window else 0.5
            
            if receipt.actual_energy_kwh > 0:
                total_charge_kwh += receipt.actual_energy_kwh
                charge_cost += receipt.actual_energy_kwh * price
            elif receipt.actual_energy_kwh < 0:
                discharge_amount = abs(receipt.actual_energy_kwh)
                total_discharge_kwh += discharge_amount
                discharge_revenue += discharge_amount * price
        
        net_profit = discharge_revenue - charge_cost
        
        total_planned_energy = sum(abs(s.energy_kwh) for s in segments)
        total_actual_energy = sum(abs(r.actual_energy_kwh) for r in receipts)
        deviation_rate = 0.0
        if total_planned_energy > 0:
            deviation_rate = (abs(total_actual_energy - total_planned_energy) / total_planned_energy) * 100
        
        efficiency_rate = 0.0
        if total_charge_kwh > 0:
            efficiency_rate = (total_discharge_kwh / total_charge_kwh) * 100
        
        return {
            "total_charge_kwh": total_charge_kwh,
            "total_discharge_kwh": total_discharge_kwh,
            "charge_cost": charge_cost,
            "discharge_revenue": discharge_revenue,
            "net_profit": net_profit,
            "efficiency_rate": min(efficiency_rate, 100.0),
            "deviation_rate": deviation_rate
        }

    @staticmethod
    def generate_report(
        db: Session,
        plan_id: int
    ) -> models.RevenueReport:
        plan = db.query(models.ChargePlan).filter(models.ChargePlan.id == plan_id).first()
        if not plan:
            raise ValueError("计划不存在")
        
        existing_report = db.query(models.RevenueReport).filter(
            models.RevenueReport.plan_id == plan_id
        ).first()
        if existing_report:
            db.delete(existing_report)
            db.commit()
        
        metrics = RevenueService.calculate_revenue(db, plan)
        
        report = models.RevenueReport(
            plan_id=plan.id,
            station_id=plan.station_id,
            report_date=plan.plan_date,
            **metrics
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def update_report_with_alerts(
        db: Session,
        report: models.RevenueReport
    ) -> models.RevenueReport:
        alerts = db.query(models.DeviationAlert).filter(
            models.DeviationAlert.plan_id == report.plan_id,
            models.DeviationAlert.alert_level == schemas.AlertLevel.CRITICAL.value,
            models.DeviationAlert.is_resolved == False
        ).all()
        
        penalty = len(alerts) * 100.0
        report.net_profit -= penalty
        db.commit()
        db.refresh(report)
        return report
