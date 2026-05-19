from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models import Forklift, ChargingPile, ChargingTask
from datetime import datetime
from app.schemas import RuleResult


class RulesEngine:
    def __init__(self, db: Session):
        self.db = db

    def check_all_rules(self, task_data) -> Tuple[bool, List[RuleResult]]:
        results = []
        
        result1 = self._check_idempotent_lock(task_data)
        results.append(result1)
        
        result2 = self._check_cross_shift_occupation(task_data)
        results.append(result2)
        
        result3 = self._check_low_battery_priority(task_data)
        results.append(result3)
        
        all_passed = all(r.passed for r in results)
        return all_passed, results

    def _check_idempotent_lock(self, task_data) -> RuleResult:
        existing_task = self.db.query(ChargingTask).filter(
            ChargingTask.forklift_id == task_data.forklift_id,
            ChargingTask.charging_pile_id == task_data.charging_pile_id,
            ChargingTask.shift == task_data.shift,
            ChargingTask.status.in_(["pending", "charging"])
        ).first()
        
        if existing_task:
            return RuleResult(
                passed=False,
                reason=f"幂等检查失败：叉车ID {task_data.forklift_id} 在班次 {task_data.shift} 已占用充电桩ID {task_data.charging_pile_id}",
                rule_name="重复锁桩幂等检查"
            )
        
        return RuleResult(
            passed=True,
            reason="幂等检查通过：无重复锁桩记录",
            rule_name="重复锁桩幂等检查"
        )

    def _check_cross_shift_occupation(self, task_data) -> RuleResult:
        overlapping_task = self.db.query(ChargingTask).filter(
            ChargingTask.charging_pile_id == task_data.charging_pile_id,
            ChargingTask.status.in_(["pending", "charging"]),
            ChargingTask.shift != task_data.shift
        ).first()
        
        if overlapping_task:
            return RuleResult(
                passed=False,
                reason=f"跨班占用检查失败：充电桩ID {task_data.charging_pile_id} 已被班次 {overlapping_task.shift} 占用",
                rule_name="跨班占用检查"
            )
        
        return RuleResult(
            passed=True,
            reason="跨班占用检查通过：充电桩可用",
            rule_name="跨班占用检查"
        )

    def _check_low_battery_priority(self, task_data) -> RuleResult:
        current_forklift = self.db.query(Forklift).filter(
            Forklift.id == task_data.forklift_id
        ).first()
        
        if not current_forklift:
            return RuleResult(
                passed=False,
                reason=f"叉车ID {task_data.forklift_id} 不存在",
                rule_name="低电量优先检查"
            )
        
        pending_tasks = self.db.query(ChargingTask).filter(
            ChargingTask.charging_pile_id == task_data.charging_pile_id,
            ChargingTask.status == "pending"
        ).all()
        
        for task in pending_tasks:
            other_forklift = self.db.query(Forklift).filter(
                Forklift.id == task.forklift_id
            ).first()
            
            if other_forklift and other_forklift.battery_level < current_forklift.battery_level:
                if current_forklift.battery_level > 30:
                    return RuleResult(
                        passed=False,
                        reason=f"低电量优先检查失败：叉车ID {other_forklift.id} 电量 {other_forklift.battery_level}% 低于当前叉车 {current_forklift.battery_level}%，享有优先充电权",
                        rule_name="低电量优先检查"
                    )
        
        return RuleResult(
            passed=True,
            reason="低电量优先检查通过",
            rule_name="低电量优先检查"
        )

    def get_rules_summary(self, results: List[RuleResult]) -> str:
        summary_lines = []
        for r in results:
            status = "✓ 通过" if r.passed else "✗ 拦截"
            summary_lines.append(f"[{status}] {r.rule_name}: {r.reason}")
        return "\n".join(summary_lines)
