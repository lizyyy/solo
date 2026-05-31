from typing import List, Dict, Tuple, Optional
from models import (
    Workspace, Constraint, Parameter, Material, 
    DemandPoint, AllocationRecord, RecordStatus, AllocationType
)
from datetime import datetime


class AllocationEngine:
    def __init__(self, workspace: Workspace):
        self.workspace = workspace
        self.constraint_coverage = set()

    def allocate_all(self) -> List[AllocationRecord]:
        all_allocations = []
        
        for material_id, material in self.workspace.materials.items():
            allocations = self._allocate_material(material)
            all_allocations.extend(allocations)
        
        for alloc in all_allocations:
            self.workspace.allocations[alloc.id] = alloc
        
        return all_allocations

    def _allocate_material(self, material: Material) -> List[AllocationRecord]:
        allocations = []
        remaining = material.total_quantity
        
        sorted_demands = sorted(
            self.workspace.demand_points.items(),
            key=lambda x: (-x[1].priority_level, -x[1].population)
        )
        
        for dp_id, dp in sorted_demands:
            if remaining <= 0:
                break
            
            demand_qty = dp.demand_items.get(material.id, 0)
            if demand_qty <= 0:
                continue
            
            reason, next_step, constraints_used = self._calculate_allocation(
                material, dp, demand_qty, remaining
            )
            
            allocate_qty = min(demand_qty, remaining)
            
            alloc = AllocationRecord(
                material_id=material.id,
                material_name=material.name,
                demand_point_id=dp_id,
                demand_point_name=dp.name,
                allocated_quantity=allocate_qty,
                unit=material.unit,
                allocation_type=AllocationType.AUTO,
                status=self._determine_status(allocate_qty, demand_qty),
                judgment_reason=reason,
                next_step=next_step,
                constraints_applied=constraints_used
            )
            
            allocations.append(alloc)
            remaining -= allocate_qty
        
        return allocations

    def _calculate_allocation(
        self, 
        material: Material, 
        dp: DemandPoint, 
        demand_qty: float, 
        remaining: float
    ) -> Tuple[str, str, List[str]]:
        
        reasons = []
        next_steps = []
        constraints_used = []
        
        priority_rule = self._get_constraint_by_name("优先级")
        if priority_rule and priority_rule.is_active:
            reasons.append(f"需求点[{dp.name}]优先级{dp.priority_level}级")
            constraints_used.append(priority_rule.id)
            self.constraint_coverage.add(priority_rule.id)
        
        pop_factor = min(dp.population / 1000, 1.0) if dp.population > 0 else 0.5
        reasons.append(f"覆盖人口{dp.population}人")
        
        if demand_qty > remaining:
            reasons.append(f"需求{demand_qty}{material.unit} > 库存{remaining}{material.unit}")
            next_steps.append("待物资补充后重分配")
        else:
            next_steps.append("分配完成可确认")
        
        return " | ".join(reasons), " | ".join(next_steps) if next_steps else "无", constraints_used

    def _determine_status(self, allocated: float, demanded: float) -> RecordStatus:
        if allocated >= demanded:
            return RecordStatus.CONFIRMED
        else:
            return RecordStatus.PENDING

    def _get_constraint_by_name(self, name: str) -> Optional[Constraint]:
        for c in self.workspace.constraints.values():
            if name in c.name:
                return c
        return None

    def manual_adjust(
        self, 
        record_id: str, 
        new_quantity: float, 
        reason: str,
        operator: str = "教练"
    ) -> AllocationRecord:
        
        record = self.workspace.allocations.get(record_id)
        if not record:
            raise ValueError(f"记录{record_id}不存在")
        
        record.original_quantity = record.allocated_quantity
        record.allocated_quantity = new_quantity
        record.manual_modified = True
        record.allocation_type = AllocationType.MANUAL
        record.status = RecordStatus.MANUAL_MODIFIED
        record.judgment_reason = f"【人工调整】{reason} | 原由：{record.judgment_reason}"
        record.next_step = "已人工修改，请确认"
        record.modified_by = operator
        record.modified_at = datetime.now()
        record.version += 1
        
        return record

    def confirm_record(self, record_id: str) -> AllocationRecord:
        record = self.workspace.allocations.get(record_id)
        if not record:
            raise ValueError(f"记录{record_id}不存在")
        
        record.status = RecordStatus.CONFIRMED
        record.next_step = "已确认"
        return record

    def get_constraint_coverage(self) -> Dict[str, bool]:
        return {
            c_id: c_id in self.constraint_coverage
            for c_id in self.workspace.constraints
        }
