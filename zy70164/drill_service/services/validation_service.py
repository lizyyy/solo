from typing import Dict, List, Tuple, Optional
from datetime import datetime

from drill_service.storage import Storage
from drill_service.models import (
    Region,
    RegionStatus,
    DrillPlan,
    DrillPlanStatus,
)


class ValidationService:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def validate_readonly_mode(self, region_name: str) -> Tuple[bool, str]:
        region = self.storage.get_region(region_name)
        if region is None:
            return False, f"区域 {region_name} 不存在"
        
        if not region.is_read_only:
            return False, f"区域 {region_name} 未设置为只读模式"
        
        if region.status == RegionStatus.OFFLINE:
            return False, f"区域 {region_name} 已离线"
        
        return True, f"区域 {region_name} 只读模式校验通过"
    
    def validate_traffic_weights(self) -> Tuple[bool, str]:
        regions = self.storage.list_regions()
        total_weight = sum(r.traffic_weight for r in regions)
        
        if total_weight != 100:
            return False, f"流量权重总和为 {total_weight}，应为 100"
        
        active_count = sum(1 for r in regions if r.status == RegionStatus.ACTIVE)
        if active_count > 1:
            return False, f"存在多个活跃区域: {[r.name for r in regions if r.status == RegionStatus.ACTIVE]}"
        
        if active_count == 0:
            return False, "没有活跃区域"
        
        return True, "流量权重校验通过"
    
    def validate_plan_prerequisites(self, plan: DrillPlan) -> Tuple[bool, str]:
        source_region = self.storage.get_region(plan.source_region)
        target_region = self.storage.get_region(plan.target_region)
        
        if source_region is None:
            return False, f"源区域 {plan.source_region} 不存在"
        
        if target_region is None:
            return False, f"目标区域 {plan.target_region} 不存在"
        
        if target_region.status == RegionStatus.OFFLINE:
            return False, f"目标区域 {plan.target_region} 已离线"
        
        if source_region.traffic_weight == 0:
            return False, f"源区域 {plan.source_region} 当前无流量，无法进行切换"
        
        return True, "演练计划前置条件校验通过"
    
    def validate_rollback_preconditions(self, plan: DrillPlan) -> Tuple[bool, str]:
        if plan.status not in [DrillPlanStatus.SWITCHED, DrillPlanStatus.SWITCHING]:
            return False, f"当前状态 {plan.status.value} 不支持回切"
        
        source_region = self.storage.get_region(plan.source_region)
        if source_region is None:
            return False, f"源区域 {plan.source_region} 不存在"
        
        if source_region.status == RegionStatus.OFFLINE:
            return False, f"源区域 {plan.source_region} 已离线，无法回切"
        
        return True, "回切前置条件校验通过"
    
    def validate_switch_sequence(self, plan: DrillPlan, next_step: int) -> Tuple[bool, str]:
        if next_step <= plan.current_step:
            return False, f"步骤 {next_step} 已执行，当前进度为 {plan.current_step}"
        
        if next_step > plan.total_steps:
            return False, f"步骤 {next_step} 超出总步数 {plan.total_steps}"
        
        if next_step != plan.current_step + 1:
            return False, f"步骤顺序错误，应执行步骤 {plan.current_step + 1}，请求执行 {next_step}"
        
        return True, "步骤顺序校验通过"
    
    def check_all_validations(self, plan: DrillPlan) -> Dict[str, bool]:
        results = {}
        
        ok, msg = self.validate_plan_prerequisites(plan)
        results["plan_prerequisites"] = {
            "passed": ok,
            "message": msg,
        }
        
        ok, msg = self.validate_traffic_weights()
        results["traffic_weights"] = {
            "passed": ok,
            "message": msg,
        }
        
        return results
