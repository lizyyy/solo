import uuid
from datetime import datetime
from typing import Dict, List, Optional
from copy import deepcopy

from drill_service.storage import Storage
from drill_service.models import (
    Region,
    RegionStatus,
    TrafficSwitch,
    TrafficWeight,
)


class TrafficService:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def initialize_regions(self, region_names: List[str]) -> List[Region]:
        regions = []
        for i, name in enumerate(region_names):
            region = Region(
                name=name,
                status=RegionStatus.ACTIVE if i == 0 else RegionStatus.STANDBY,
                traffic_weight=100 if i == 0 else 0,
                is_read_only=False,
                description=f"{name} 区域",
            )
            self.storage.save_region(region)
            regions.append(region)
        return regions
    
    def get_region(self, name: str) -> Optional[Region]:
        return self.storage.get_region(name)
    
    def list_regions(self) -> List[Region]:
        return self.storage.list_regions()
    
    def set_region_readonly(self, region_name: str, readonly: bool) -> Region:
        region = self.storage.get_region(region_name)
        if region is None:
            raise ValueError(f"区域 {region_name} 不存在")
        
        region.is_read_only = readonly
        self.storage.save_region(region)
        return region
    
    def switch_traffic(
        self,
        plan_id: str,
        step_index: int,
        target_weights: Dict[str, int],
        operator: str,
    ) -> TrafficSwitch:
        total_weight = sum(target_weights.values())
        if total_weight != 100:
            raise ValueError(f"流量权重总和必须为100，当前为 {total_weight}")
        
        for region_name, weight in target_weights.items():
            region = self.storage.get_region(region_name)
            if region is None:
                raise ValueError(f"区域 {region_name} 不存在")
            if weight < 0 or weight > 100:
                raise ValueError(f"权重必须在0-100之间，{region_name} 为 {weight}")
        
        current_regions = self.storage.list_regions()
        for region in current_regions:
            if region.name in target_weights:
                region.traffic_weight = target_weights[region.name]
                if target_weights[region.name] == 100:
                    region.status = RegionStatus.ACTIVE
                elif target_weights[region.name] > 0:
                    region.status = RegionStatus.DRAINING
                else:
                    region.status = RegionStatus.STANDBY
            self.storage.save_region(region)
        
        traffic_switch = TrafficSwitch(
            switch_id=str(uuid.uuid4()),
            plan_id=plan_id,
            step_index=step_index,
            traffic_weights=[
                TrafficWeight(region_name=name, weight=weight)
                for name, weight in target_weights.items()
            ],
            timestamp=self._now(),
            operator=operator,
        )
        self.storage.save_traffic_switch(traffic_switch)
        return traffic_switch
    
    def get_traffic_switch_history(self, plan_id: str) -> List[TrafficSwitch]:
        return self.storage.list_traffic_switches_by_plan(plan_id)
    
    def get_current_traffic_state(self) -> Dict[str, int]:
        regions = self.storage.list_regions()
        return {r.name: r.traffic_weight for r in regions}
    
    def _now(self) -> str:
        return datetime.now().isoformat()
