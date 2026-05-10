import uuid
from datetime import datetime
from typing import Optional, Dict, List, Tuple

from drill_service.storage import Storage
from drill_service.models import (
    DrillPlan,
    DrillPlanStatus,
    OperationType,
    RegionStatus,
)
from drill_service.services.traffic_service import TrafficService
from drill_service.services.validation_service import ValidationService
from drill_service.services.history_service import HistoryService
from drill_service.services.report_service import ReportService


class DrillService:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.traffic_service = TrafficService(storage)
        self.validation_service = ValidationService(storage)
        self.history_service = HistoryService(storage)
        self.report_service = ReportService(storage)
    
    def create_plan(
        self,
        name: str,
        source_region: str,
        target_region: str,
        operator: str,
        description: str = "",
    ) -> DrillPlan:
        source = self.traffic_service.get_region(source_region)
        if source is None:
            raise ValueError(f"源区域 {source_region} 不存在")
        
        target = self.traffic_service.get_region(target_region)
        if target is None:
            raise ValueError(f"目标区域 {target_region} 不存在")
        
        now = self._now()
        plan = DrillPlan(
            plan_id=str(uuid.uuid4()),
            name=name,
            source_region=source_region,
            target_region=target_region,
            current_step=0,
            total_steps=6,
            status=DrillPlanStatus.DRAFT,
            created_at=now,
            updated_at=now,
            operator=operator,
            description=description,
        )
        
        self.storage.save_plan(plan)
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.CREATE_PLAN,
            operator=operator,
            details=f"创建演练计划: {name}, 源区域: {source_region}, 目标区域: {target_region}",
        )
        
        return plan
    
    def get_plan(self, plan_id: str) -> Optional[DrillPlan]:
        return self.storage.get_plan(plan_id)
    
    def list_plans(self) -> List[DrillPlan]:
        return self.storage.list_plans()
    
    def start_drill(self, plan_id: str, operator: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        
        if plan.status not in [DrillPlanStatus.DRAFT, DrillPlanStatus.PENDING]:
            raise ValueError(f"当前状态 {plan.status.value} 无法启动演练")
        
        ok, msg = self.validation_service.validate_plan_prerequisites(plan)
        if not ok:
            raise ValueError(msg)
        
        plan.status = DrillPlanStatus.IN_PROGRESS
        plan.current_step = 1
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.START_DRILL,
            operator=operator,
            details=f"开始演练，当前进度: 步骤 1/6",
        )
        
        return plan
    
    def advance_to_traffic_warmup(self, plan_id: str, operator: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        self._validate_step(plan, 2, [DrillPlanStatus.IN_PROGRESS])
        
        plan.current_step = 2
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.UPDATE_PLAN,
            operator=operator,
            details=f"目标区域准备完成，当前进度: 步骤 2/6",
        )
        
        return plan
    
    def execute_traffic_warmup(
        self,
        plan_id: str,
        operator: str,
        warmup_percent: int = 10,
    ) -> Tuple[DrillPlan, Dict]:
        plan = self._require_plan(plan_id)
        self._validate_step(plan, 3, [DrillPlanStatus.IN_PROGRESS])
        
        if warmup_percent < 1 or warmup_percent > 50:
            raise ValueError(f"预热流量应在 1-50% 之间，当前为 {warmup_percent}%")
        
        weights = {
            plan.source_region: 100 - warmup_percent,
            plan.target_region: warmup_percent,
        }
        
        traffic_switch = self.traffic_service.switch_traffic(
            plan_id=plan.plan_id,
            step_index=3,
            target_weights=weights,
            operator=operator,
        )
        
        plan.current_step = 3
        plan.status = DrillPlanStatus.SWITCHING
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.SWITCH_TRAFFIC,
            operator=operator,
            details=f"流量预热完成，分配: {plan.source_region}={100 - warmup_percent}%, {plan.target_region}={warmup_percent}%",
        )
        
        return plan, traffic_switch.to_dict()
    
    def validate_readonly(self, plan_id: str, operator: str) -> Tuple[bool, str]:
        plan = self._require_plan(plan_id)
        
        if plan.current_step < 3:
            raise ValueError(f"请先完成流量预热步骤，当前进度: {plan.current_step}/6")
        
        ok, msg = self.validation_service.validate_readonly_mode(plan.source_region)
        
        if ok:
            plan.current_step = 4
            plan.status = DrillPlanStatus.READONLY_CHECKING
            plan.updated_at = self._now()
            self.storage.save_plan(plan)
            
            self.history_service.record_operation(
                plan_id=plan.plan_id,
                operation_type=OperationType.READONLY_CHECK,
                operator=operator,
                details=f"源区域 {plan.source_region} 只读校验通过",
            )
        
        return ok, msg
    
    def execute_full_switch(self, plan_id: str, operator: str) -> Tuple[DrillPlan, Dict]:
        plan = self._require_plan(plan_id)
        self._validate_step(plan, 5, [DrillPlanStatus.READONLY_CHECKING])
        
        weights = {
            plan.source_region: 0,
            plan.target_region: 100,
        }
        
        traffic_switch = self.traffic_service.switch_traffic(
            plan_id=plan.plan_id,
            step_index=5,
            target_weights=weights,
            operator=operator,
        )
        
        self.traffic_service.set_region_readonly(plan.source_region, True)
        
        plan.current_step = 5
        plan.status = DrillPlanStatus.SWITCHED
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.SWITCH_TRAFFIC,
            operator=operator,
            details=f"流量完全切换，{plan.target_region}=100%, {plan.source_region}=0%，源区域已设为只读",
        )
        
        return plan, traffic_switch.to_dict()
    
    def complete_switch(self, plan_id: str, operator: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        self._validate_step(plan, 6, [DrillPlanStatus.SWITCHED])
        
        plan.current_step = 6
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.SWITCH_COMPLETE,
            operator=operator,
            details="切换流程完成，准备回切确认",
        )
        
        return plan
    
    def request_rollback(self, plan_id: str, operator: str, reason: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        
        ok, msg = self.validation_service.validate_rollback_preconditions(plan)
        if not ok:
            raise ValueError(msg)
        
        plan.status = DrillPlanStatus.ROLLBACK_PENDING
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.ROLLBACK_REQUEST,
            operator=operator,
            details=f"请求回切，原因: {reason}",
        )
        
        return plan
    
    def execute_rollback(self, plan_id: str, operator: str) -> Tuple[DrillPlan, Dict]:
        plan = self._require_plan(plan_id)
        
        if plan.status != DrillPlanStatus.ROLLBACK_PENDING:
            raise ValueError(f"当前状态 {plan.status.value} 无法执行回切，请先请求回切")
        
        weights = {
            plan.source_region: 100,
            plan.target_region: 0,
        }
        
        traffic_switch = self.traffic_service.switch_traffic(
            plan_id=plan.plan_id,
            step_index=0,
            target_weights=weights,
            operator=operator,
        )
        
        self.traffic_service.set_region_readonly(plan.source_region, False)
        
        plan.status = DrillPlanStatus.ROLLBACKING
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.ROLLBACK_EXECUTE,
            operator=operator,
            details=f"执行回切，流量恢复: {plan.source_region}=100%, {plan.target_region}=0%",
        )
        
        return plan, traffic_switch.to_dict()
    
    def confirm_rollback(self, plan_id: str, operator: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        
        if plan.status != DrillPlanStatus.ROLLBACKING:
            raise ValueError(f"当前状态 {plan.status.value} 无法确认回切")
        
        ok, msg = self.validation_service.validate_traffic_weights()
        if not ok:
            raise ValueError(f"回切确认失败: {msg}")
        
        plan.status = DrillPlanStatus.COMPLETED
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.ROLLBACK_CONFIRM,
            operator=operator,
            details="回切确认完成，演练结束",
        )
        
        return plan
    
    def complete_drill(self, plan_id: str, operator: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        
        if plan.status not in [DrillPlanStatus.SWITCHED, DrillPlanStatus.ROLLBACK_PENDING]:
            raise ValueError(f"当前状态 {plan.status.value} 无法完成演练")
        
        plan.status = DrillPlanStatus.COMPLETED
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.COMPLETE_DRILL,
            operator=operator,
            details="演练完成（不回切模式）",
        )
        
        return plan
    
    def supplement_info(
        self,
        plan_id: str,
        operator: str,
        info: str,
    ):
        plan = self._require_plan(plan_id)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.SUPPLEMENT,
            operator=operator,
            details=f"补录信息: {info}",
        )
    
    def withdraw_operation(
        self,
        plan_id: str,
        history_id: str,
        operator: str,
        reason: str,
    ):
        history = self.storage.get_history(history_id)
        if history is None:
            raise ValueError(f"操作记录 {history_id} 不存在")
        
        if history.plan_id != plan_id:
            raise ValueError(f"操作记录 {history_id} 不属于计划 {plan_id}")
        
        self.history_service.withdraw_operation(history_id, operator, reason)
    
    def cancel_drill(self, plan_id: str, operator: str, reason: str) -> DrillPlan:
        plan = self._require_plan(plan_id)
        
        if plan.status in [DrillPlanStatus.COMPLETED, DrillPlanStatus.CANCELLED]:
            raise ValueError(f"演练已结束，无法取消")
        
        plan.status = DrillPlanStatus.CANCELLED
        plan.updated_at = self._now()
        self.storage.save_plan(plan)
        
        self.history_service.record_operation(
            plan_id=plan.plan_id,
            operation_type=OperationType.CANCEL_DRILL,
            operator=operator,
            details=f"取消演练，原因: {reason}",
        )
        
        return plan
    
    def generate_report(self, plan_id: str):
        plan = self._require_plan(plan_id)
        return self.report_service.generate_report(plan)
    
    def get_plan_history(self, plan_id: str) -> List[Dict]:
        histories = self.history_service.get_plan_history(plan_id)
        return [h.to_dict() for h in histories]
    
    def get_current_traffic(self) -> Dict:
        return self.traffic_service.get_current_traffic_state()
    
    def _require_plan(self, plan_id: str) -> DrillPlan:
        plan = self.storage.get_plan(plan_id)
        if plan is None:
            raise ValueError(f"演练计划 {plan_id} 不存在")
        return plan
    
    def _validate_step(self, plan: DrillPlan, target_step: int, allowed_statuses: List[DrillPlanStatus]):
        if plan.status not in allowed_statuses:
            raise ValueError(f"当前状态 {plan.status.value} 不允许执行此操作")
        
        expected_step = plan.current_step + 1
        if target_step != expected_step:
            raise ValueError(f"步骤顺序错误，应执行步骤 {expected_step}，请求执行 {target_step}")
    
    def _now(self) -> str:
        return datetime.now().isoformat()
