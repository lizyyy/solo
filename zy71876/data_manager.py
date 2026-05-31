import csv
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional
from models import (
    Workspace, Constraint, Parameter, Material, 
    DemandPoint, AllocationRecord, RecordStatus, 
    AllocationType, ImportBatch
)


class DataManager:
    EXPORT_FIELDS = [
        '记录ID', '物资ID', '物资名称', '需求点ID', 
        '需求点名称', '分配数量', '单位', '分配类型', 
        '状态', '判断理由', '下一步', '应用约束', 
        '是否人工修改', '原分配数量', '修改人', '修改时间', 
        '版本', '导入批次', '创建时间'
    ]

    def __init__(self, workspace: Workspace):
        self.workspace = workspace

    def import_constraints(self, filepath: str, data_format: str = 'csv') -> int:
        batch_id = str(uuid.uuid4())[:8]
        count = 0
        
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                c = Constraint(
                    id=row.get('约束ID', str(uuid.uuid4())[:8]),
                    name=row.get('名称', ''),
                    description=row.get('说明', ''),
                    rule_type=row.get('类型', ''),
                    rule_expression=row.get('规则', ''),
                    priority=int(row.get('优先级', 1)),
                    is_active=row.get('启用', '是') == '是'
                )
                self.workspace.constraints[c.id] = c
                count += 1
        
        batch = ImportBatch(
            id=batch_id,
            filename=filepath,
            import_time=datetime.now(),
            record_count=count
        )
        self.workspace.import_batches[batch_id] = batch
        return count

    def import_materials(self, filepath: str) -> int:
        batch_id = str(uuid.uuid4())[:8]
        count = 0
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                m = Material(
                    id=row.get('物资ID', str(uuid.uuid4())[:8]),
                    name=row.get('物资名称', ''),
                    category=row.get('类别', ''),
                    total_quantity=float(row.get('总数量', 0)),
                    unit=row.get('单位', ''),
                    specs=row.get('规格', '')
                )
                self.workspace.materials[m.id] = m
                count += 1
        
        batch = ImportBatch(
            id=batch_id,
            filename=filepath,
            import_time=datetime.now(),
            record_count=count
        )
        self.workspace.import_batches[batch_id] = batch
        return count

    def import_demand_points(self, filepath: str) -> int:
        batch_id = str(uuid.uuid4())[:8]
        count = 0
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                demand_items = {}
                for key, val in row.items():
                    if key.startswith('需求_'):
                        mat_id = key.replace('需求_', '')
                        demand_items[mat_id] = float(val) if val else 0
                
                dp = DemandPoint(
                    id=row.get('需求点ID', str(uuid.uuid4())[:8]),
                    name=row.get('需求点名称', ''),
                    location=row.get('位置', ''),
                    priority_level=int(row.get('优先级', 1)),
                    population=int(row.get('人口', 0)),
                    demand_items=demand_items
                )
                self.workspace.demand_points[dp.id] = dp
                count += 1
        
        batch = ImportBatch(
            id=batch_id,
            filename=filepath,
            import_time=datetime.now(),
            record_count=count
        )
        self.workspace.import_batches[batch_id] = batch
        return count

    def import_allocations(self, filepath: str) -> int:
        batch_id = str(uuid.uuid4())[:8]
        count = 0
        skipped = 0
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                existing = self._find_existing_allocation(row)
                if existing:
                    skipped += 1
                    continue
                
                alloc = self._row_to_allocation(row, batch_id)
                self.workspace.allocations[alloc.id] = alloc
                count += 1
        
        batch = ImportBatch(
            id=batch_id,
            filename=filepath,
            import_time=datetime.now(),
            record_count=count
        )
        self.workspace.import_batches[batch_id] = batch
        return count

    def _find_existing_allocation(self, row: Dict) -> Optional[AllocationRecord]:
        mat_id = row.get('物资ID', '')
        dp_id = row.get('需求点ID', '')
        
        for alloc in self.workspace.allocations.values():
            if alloc.material_id == mat_id and alloc.demand_point_id == dp_id:
                return alloc
        return None

    def _row_to_allocation(self, row: Dict, batch_id: str) -> AllocationRecord:
        status_map = {
            '已确认': RecordStatus.CONFIRMED,
            '待补': RecordStatus.PENDING,
            '人工修改': RecordStatus.MANUAL_MODIFIED
        }
        type_map = {
            '自动分配': AllocationType.AUTO,
            '人工调整': AllocationType.MANUAL
        }
        
        return AllocationRecord(
            id=row.get('记录ID', str(uuid.uuid4())[:8]),
            material_id=row.get('物资ID', ''),
            material_name=row.get('物资名称', ''),
            demand_point_id=row.get('需求点ID', ''),
            demand_point_name=row.get('需求点名称', ''),
            allocated_quantity=float(row.get('分配数量', 0)),
            unit=row.get('单位', ''),
            allocation_type=type_map.get(row.get('分配类型', '自动分配'), AllocationType.AUTO),
            status=status_map.get(row.get('状态', '待补'), RecordStatus.PENDING),
            judgment_reason=row.get('判断理由', ''),
            next_step=row.get('下一步', ''),
            constraints_applied=row.get('应用约束', '').split('|') if row.get('应用约束') else [],
            manual_modified=row.get('是否人工修改', '否') == '是',
            import_batch=batch_id
        )

    def export_allocations(
        self, 
        filepath: str, 
        status_filter: Optional[List[RecordStatus]] = None
    ) -> int:
        records = list(self.workspace.allocations.values())
        
        if status_filter:
            records = [r for r in records if r.status in status_filter]
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=self.EXPORT_FIELDS)
            writer.writeheader()
            
            for alloc in records:
                writer.writerow(self._allocation_to_row(alloc))
        
        return len(records)

    def _allocation_to_row(self, alloc: AllocationRecord) -> Dict:
        return {
            '记录ID': alloc.id,
            '物资ID': alloc.material_id,
            '物资名称': alloc.material_name,
            '需求点ID': alloc.demand_point_id,
            '需求点名称': alloc.demand_point_name,
            '分配数量': alloc.allocated_quantity,
            '单位': alloc.unit,
            '分配类型': alloc.allocation_type.value,
            '状态': alloc.status.value,
            '判断理由': alloc.judgment_reason,
            '下一步': alloc.next_step,
            '应用约束': '|'.join(alloc.constraints_applied),
            '是否人工修改': '是' if alloc.manual_modified else '否',
            '原分配数量': alloc.original_quantity if alloc.original_quantity is not None else '',
            '修改人': alloc.modified_by,
            '修改时间': alloc.modified_at.strftime('%Y-%m-%d %H:%M:%S') if alloc.modified_at else '',
            '版本': alloc.version,
            '导入批次': alloc.import_batch,
            '创建时间': alloc.created_at.strftime('%Y-%m-%d %H:%M:%S'),
        }

    def revoke_batch(self, batch_id: str) -> int:
        batch = self.workspace.import_batches.get(batch_id)
        if batch:
            batch.is_active = False
        
        count = 0
        to_delete = []
        for alloc_id, alloc in self.workspace.allocations.items():
            if alloc.import_batch == batch_id:
                to_delete.append(alloc_id)
                count += 1
        
        for alloc_id in to_delete:
            del self.workspace.allocations[alloc_id]
        
        return count

    def save_workspace(self, filepath: str):
        data = {
            'name': self.workspace.name,
            'constraints': {k: v.__dict__ for k, v in self.workspace.constraints.items()},
            'parameters': {k: v.__dict__ for k, v in self.workspace.parameters.items()},
            'materials': {k: v.__dict__ for k, v in self.workspace.materials.items()},
            'demand_points': {k: v.__dict__ for k, v in self.workspace.demand_points.items()},
            'allocations': {k: v.__dict__ for k, v in self.workspace.allocations.items()},
            'import_batches': {k: v.__dict__ for k, v in self.workspace.import_batches.items()}
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def load_workspace(self, filepath: str):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.workspace.name = data['name']
        
        for c_id, c_data in data.get('constraints', {}).items():
            self.workspace.constraints[c_id] = Constraint(**c_data)
        
        for p_id, p_data in data.get('parameters', {}).items():
            self.workspace.parameters[p_id] = Parameter(**p_data)
        
        for m_id, m_data in data.get('materials', {}).items():
            self.workspace.materials[m_id] = Material(**m_data)
        
        for dp_id, dp_data in data.get('demand_points', {}).items():
            self.workspace.demand_points[dp_id] = DemandPoint(**dp_data)
        
        for a_id, a_data in data.get('allocations', {}).items():
            self.workspace.allocations[a_id] = AllocationRecord(**a_data)
        
        for b_id, b_data in data.get('import_batches', {}).items():
            self.workspace.import_batches[b_id] = ImportBatch(**b_data)
