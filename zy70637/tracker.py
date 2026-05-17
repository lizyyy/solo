from typing import List, Dict, Any, Set, Tuple
from collections import defaultdict
import hashlib

from models import (
    Order, Material, OutboundRecord, ReturnRecord, CompensationRecord,
    BadRecord, MaterialInventory, stable_hash
)


class SourceTracker:
    def __init__(self):
        self.source_map: Dict[str, List[str]] = defaultdict(list)
        self.order_sources: Dict[str, str] = {}
        self.material_sources: Dict[str, str] = {}
        self.outbound_sources: Dict[str, str] = {}
        self.return_sources: Dict[str, str] = {}
        self.compensation_sources: Dict[str, str] = {}

    def track_order(self, order: Order):
        source_info = f"{order.source.file_path}:{order.source.row_number}"
        self.order_sources[order.order_id] = source_info
        self.source_map[order.order_id].append(source_info)

    def track_material(self, material: Material):
        source_info = f"{material.source.file_path}:{material.source.row_number}"
        self.material_sources[material.material_id] = source_info
        self.source_map[material.material_id].append(source_info)

    def track_outbound(self, outbound: OutboundRecord):
        source_info = f"{outbound.source.file_path}:{outbound.source.row_number}"
        self.outbound_sources[outbound.outbound_id] = source_info
        self.source_map[outbound.order_id].append(source_info)
        self.source_map[outbound.material_id].append(source_info)

    def track_return(self, return_record: ReturnRecord):
        source_info = f"{return_record.source.file_path}:{return_record.source.row_number}"
        self.return_sources[return_record.return_id] = source_info
        self.source_map[return_record.order_id].append(source_info)
        self.source_map[return_record.material_id].append(source_info)

    def track_compensation(self, comp: CompensationRecord):
        source_info = f"{comp.source.file_path}:{comp.source.row_number}"
        self.compensation_sources[comp.compensation_id] = source_info
        self.source_map[comp.order_id].append(source_info)
        self.source_map[comp.material_id].append(source_info)

    def get_sources(self, entity_id: str) -> List[str]:
        return self.source_map.get(entity_id, [])

    def get_order_source(self, order_id: str) -> str:
        return self.order_sources.get(order_id, "未知来源")

    def get_material_source(self, material_id: str) -> str:
        return self.material_sources.get(material_id, "未知来源")


class DataDiffer:
    def __init__(self):
        self.previous_checksums: Dict[str, str] = {}

    def calculate_checksum(self, data: Any) -> str:
        return stable_hash(data)

    def calculate_dataset_checksum(self,
                                   orders: List[Order],
                                   materials: List[Material],
                                   outbounds: List[OutboundRecord],
                                   returns: List[ReturnRecord],
                                   compensations: List[CompensationRecord]) -> str:
        sorted_order_ids = sorted([o.order_id for o in orders])
        sorted_material_ids = sorted([m.material_id for m in materials])
        sorted_outbound_ids = sorted([o.outbound_id for o in outbounds])
        sorted_return_ids = sorted([r.return_id for r in returns])
        sorted_comp_ids = sorted([c.compensation_id for c in compensations])

        combined_data = {
            'orders': sorted_order_ids,
            'materials': sorted_material_ids,
            'outbounds': sorted_outbound_ids,
            'returns': sorted_return_ids,
            'compensations': sorted_comp_ids
        }

        return self.calculate_checksum(combined_data)

    def check_consistency(self, dataset_name: str, current_checksum: str) -> Tuple[bool, str]:
        if dataset_name not in self.previous_checksums:
            self.previous_checksums[dataset_name] = current_checksum
            return True, "首次检查，无历史数据对比"

        previous_checksum = self.previous_checksums[dataset_name]
        if previous_checksum == current_checksum:
            return True, "数据一致性验证通过"
        return False, f"数据发生变化: 旧校验和{previous_checksum}, 新校验和{current_checksum}"


class CrossReferenceValidator:
    def __init__(self):
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def validate_references(self,
                           orders: List[Order],
                           materials: List[Material],
                           outbounds: List[OutboundRecord],
                           returns: List[ReturnRecord],
                           compensations: List[CompensationRecord]):

        order_ids = set(o.order_id for o in orders)
        material_ids = set(m.material_id for m in materials)

        for outbound in outbounds:
            if outbound.order_id not in order_ids:
                self.warnings.append(f"出库{outbound.outbound_id}: 关联订单{outbound.order_id}不存在")
            if outbound.material_id not in material_ids:
                self.warnings.append(f"出库{outbound.outbound_id}: 关联物料{outbound.material_id}不存在")

        for return_record in returns:
            if return_record.order_id not in order_ids:
                self.warnings.append(f"归还{return_record.return_id}: 关联订单{return_record.order_id}不存在")
            if return_record.material_id not in material_ids:
                self.warnings.append(f"归还{return_record.return_id}: 关联物料{return_record.material_id}不存在")

        for comp in compensations:
            if comp.order_id not in order_ids:
                self.warnings.append(f"赔付{comp.compensation_id}: 关联订单{comp.order_id}不存在")
            if comp.material_id not in material_ids:
                self.warnings.append(f"赔付{comp.compensation_id}: 关联物料{comp.material_id}不存在")

    def get_warnings(self) -> List[str]:
        return sorted(self.warnings)

    def get_errors(self) -> List[str]:
        return sorted(self.errors)
