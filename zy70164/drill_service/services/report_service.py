import uuid
from datetime import datetime
from typing import List, Optional

from drill_service.storage import Storage
from drill_service.models import (
    DrillReport,
    ReportStep,
    DrillPlan,
    TrafficSwitch,
    OperationHistory,
    OperationType,
)


class ReportService:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def generate_report(self, plan: DrillPlan) -> DrillReport:
        traffic_switches = self.storage.list_traffic_switches_by_plan(plan.plan_id)
        history = self.storage.list_history_by_plan(plan.plan_id)
        
        steps = self._build_steps(plan, traffic_switches, history)
        
        overall_status = self._determine_overall_status(steps)
        conclusion = self._generate_conclusion(plan, steps, overall_status)
        recommendations = self._generate_recommendations(plan, steps, history)
        
        report = DrillReport(
            report_id=str(uuid.uuid4()),
            plan_id=plan.plan_id,
            plan_name=plan.name,
            source_region=plan.source_region,
            target_region=plan.target_region,
            started_at=plan.created_at,
            completed_at=self._now(),
            overall_status=overall_status,
            steps=steps,
            conclusion=conclusion,
            recommendations=recommendations,
        )
        
        self.storage.save_report(report)
        return report
    
    def get_report(self, report_id: str) -> Optional[DrillReport]:
        return self.storage.get_report(report_id)
    
    def get_report_by_plan(self, plan_id: str) -> Optional[DrillReport]:
        return self.storage.get_report_by_plan(plan_id)
    
    def _build_steps(
        self,
        plan: DrillPlan,
        traffic_switches: List[TrafficSwitch],
        history: List[OperationHistory],
    ) -> List[ReportStep]:
        steps = []
        
        step_definitions = [
            (1, "演练启动", OperationType.START_DRILL),
            (2, "目标区域准备", None),
            (3, "流量预热", OperationType.SWITCH_TRAFFIC),
            (4, "只读校验", OperationType.READONLY_CHECK),
            (5, "流量切换", OperationType.SWITCH_TRAFFIC),
            (6, "切换完成", OperationType.SWITCH_COMPLETE),
        ]
        
        for step_index, step_name, expected_operation in step_definitions:
            step_history = [
                h for h in history
                if h.operation_type == expected_operation or (step_index <= plan.current_step)
            ]
            step_switches = [
                s for s in traffic_switches if s.step_index == step_index
            ]
            
            started_at = None
            completed_at = None
            status = "not_started"
            result = "未执行"
            notes = ""
            
            for h in history:
                if step_index <= plan.current_step:
                    if started_at is None:
                        started_at = h.timestamp
                    completed_at = h.timestamp
            
            if step_index <= plan.current_step:
                status = "completed"
                result = "成功"
                if step_switches:
                    weights = ", ".join(
                        f"{tw.region_name}: {tw.weight}%"
                        for tw in step_switches[-1].traffic_weights
                    )
                    notes = f"流量分配: {weights}"
            elif step_index == plan.current_step + 1:
                status = "in_progress"
                result = "进行中"
            
            steps.append(ReportStep(
                step_index=step_index,
                name=step_name,
                status=status,
                started_at=started_at,
                completed_at=completed_at,
                result=result,
                notes=notes,
            ))
        
        return steps
    
    def _determine_overall_status(self, steps: List[ReportStep]) -> str:
        failed_steps = [s for s in steps if s.status == "failed"]
        if failed_steps:
            return "failed"
        
        in_progress_steps = [s for s in steps if s.status == "in_progress"]
        if in_progress_steps:
            return "in_progress"
        
        completed_steps = [s for s in steps if s.status == "completed"]
        if len(completed_steps) == len(steps):
            return "completed"
        
        return "partial"
    
    def _generate_conclusion(
        self,
        plan: DrillPlan,
        steps: List[ReportStep],
        overall_status: str,
    ) -> str:
        completed_count = sum(1 for s in steps if s.status == "completed")
        
        if overall_status == "completed":
            return f"演练计划「{plan.name}」已成功完成。所有 {len(steps)} 个步骤均已通过，从 {plan.source_region} 到 {plan.target_region} 的切换演练成功。"
        
        if overall_status == "in_progress":
            return f"演练计划「{plan.name}」正在进行中。已完成 {completed_count}/{len(steps)} 个步骤，当前进度正常。"
        
        if overall_status == "failed":
            failed = [s for s in steps if s.status == "failed"]
            return f"演练计划「{plan.name}」存在失败步骤。失败步骤: {', '.join(s.name for s in failed)}"
        
        return f"演练计划「{plan.name}」部分完成。已完成 {completed_count}/{len(steps)} 个步骤。"
    
    def _generate_recommendations(
        self,
        plan: DrillPlan,
        steps: List[ReportStep],
        history: List[OperationHistory],
    ) -> List[str]:
        recommendations = []
        
        withdrawn_ops = [h for h in history if h.is_withdrawn]
        if withdrawn_ops:
            recommendations.append(f"注意: 本次演练中有 {len(withdrawn_ops)} 个操作被撤回，请审查相关操作记录。")
        
        effective_history = [h for h in history if not h.is_withdrawn]
        supplements = [h for h in effective_history if h.operation_type == OperationType.SUPPLEMENT]
        if supplements:
            recommendations.append(f"本次演练包含 {len(supplements)} 条补录信息，请确认补录内容的准确性。")
        
        if plan.status.value != "completed":
            recommendations.append("建议在后续演练中验证完整的切换和回切流程。")
        
        if not recommendations:
            recommendations.append("演练流程顺畅，建议定期重复演练以保持团队熟练度。")
        
        return recommendations
    
    def _now(self) -> str:
        return datetime.now().isoformat()
