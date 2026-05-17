from typing import List, Dict, Set, Tuple
from collections import defaultdict

from models import (
    Order, Material, OutboundRecord, ReturnRecord, CompensationRecord,
    MaterialInventory, DamageLevel, CompensationStatus, stable_hash
)


class DuplicateReturnInterceptor:
    def __init__(self):
        self._returned_keys: Set[str] = set()

    def _make_key(self, return_record: ReturnRecord) -> str:
        return stable_hash({
            'order_id': return_record.order_id,
            'material_id': return_record.material_id,
            'return_id': return_record.return_id
        })

    def check_duplicate(self, return_record: ReturnRecord) -> Tuple[bool, str]:
        key = self._make_key(return_record)
        if key in self._returned_keys:
            return True, f"归还记录重复: 订单{return_record.order_id}-物料{return_record.material_id}"
        self._returned_keys.add(key)
        return False, ""

    def reset(self):
        self._returned_keys.clear()


class InventoryManager:
    def __init__(self):
        self.inventories: Dict[Tuple[str, str], MaterialInventory] = {}

    def _get_key(self, order_id: str, material_id: str) -> Tuple[str, str]:
        return (order_id, material_id)

    def add_outbound(self, outbound: OutboundRecord):
        key = self._get_key(outbound.order_id, outbound.material_id)
        if key not in self.inventories:
            self.inventories[key] = MaterialInventory(
                material_id=outbound.material_id,
                order_id=outbound.order_id
            )
        self.inventories[key].outbound_quantity += outbound.quantity

    def add_return(self, return_record: ReturnRecord) -> Tuple[bool, str]:
        key = self._get_key(return_record.order_id, return_record.material_id)
        if key not in self.inventories:
            return False, f"物料未出库: 订单{return_record.order_id}-物料{return_record.material_id}"

        inventory = self.inventories[key]
        if inventory.returned_quantity + return_record.quantity > inventory.outbound_quantity:
            return False, (f"归还数量超出: 订单{return_record.order_id}-物料{return_record.material_id} "
                          f"已归还{inventory.returned_quantity}, 本次{return_record.quantity}, "
                          f"出库总数{inventory.outbound_quantity}")

        inventory.returned_quantity += return_record.quantity

        if return_record.damage_level in [DamageLevel.MINOR, DamageLevel.MAJOR]:
            inventory.damaged_quantity += return_record.quantity

        return True, ""

    def calculate_loss(self):
        for inventory in self.inventories.values():
            inventory.lost_quantity = inventory.outbound_quantity - inventory.returned_quantity

    def get_inventory(self, order_id: str, material_id: str) -> MaterialInventory:
        key = self._get_key(order_id, material_id)
        return self.inventories.get(key, MaterialInventory(material_id=material_id, order_id=order_id))

    def get_all_inventories(self) -> List[MaterialInventory]:
        return sorted(self.inventories.values(), key=lambda x: (x.order_id, x.material_id))


class CompensationStateMachine:
    VALID_TRANSITIONS = {
        CompensationStatus.PENDING: [CompensationStatus.IN_PROGRESS, CompensationStatus.COMPLETED, CompensationStatus.WAIVED],
        CompensationStatus.IN_PROGRESS: [CompensationStatus.COMPLETED, CompensationStatus.WAIVED],
        CompensationStatus.COMPLETED: [],
        CompensationStatus.WAIVED: []
    }

    def can_transition(self, from_status: CompensationStatus, to_status: CompensationStatus) -> bool:
        return to_status in self.VALID_TRANSITIONS.get(from_status, [])

    def transition(self, record: CompensationRecord, new_status: CompensationStatus) -> Tuple[bool, str]:
        if self.can_transition(record.status, new_status):
            record.status = new_status
            return True, ""
        return False, f"无法从{record.status.value}转换到{new_status.value}"

    def calculate_compensation(self, damage_level: DamageLevel, unit_price: float, quantity: int) -> float:
        if damage_level == DamageLevel.LOST:
            return unit_price * quantity
        elif damage_level == DamageLevel.MAJOR:
            return unit_price * quantity * 0.7
        elif damage_level == DamageLevel.MINOR:
            return unit_price * quantity * 0.3
        return 0.0


class DamageValidator:
    def validate_damage(self, return_record: ReturnRecord) -> List[str]:
        errors = []

        if return_record.damage_level != DamageLevel.NONE and not return_record.damage_description:
            errors.append(f"归还{return_record.return_id}: 有损坏但缺少损坏描述")

        if return_record.quantity <= 0:
            errors.append(f"归还{return_record.return_id}: 归还数量必须大于0")

        return errors


class RuleEngine:
    def __init__(self):
        self.duplicate_interceptor = DuplicateReturnInterceptor()
        self.inventory_manager = InventoryManager()
        self.compensation_sm = CompensationStateMachine()
        self.damage_validator = DamageValidator()
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def process_outbounds(self, outbounds: List[OutboundRecord]):
        sorted_outbounds = sorted(outbounds, key=lambda x: (x.order_id, x.material_id, x.outbound_id))
        for outbound in sorted_outbounds:
            if outbound.quantity <= 0:
                self.errors.append(f"出库{outbound.outbound_id}: 出库数量必须大于0")
                continue
            self.inventory_manager.add_outbound(outbound)

    def process_returns(self, returns: List[ReturnRecord]) -> List[ReturnRecord]:
        valid_returns = []
        sorted_returns = sorted(returns, key=lambda x: (x.order_id, x.material_id, x.return_id))

        for return_record in sorted_returns:
            is_duplicate, dup_msg = self.duplicate_interceptor.check_duplicate(return_record)
            if is_duplicate:
                self.warnings.append(f"重复归还拦截: {dup_msg} (来源: {return_record.source.file_path} 第{return_record.source.row_number}行)")
                continue

            damage_errors = self.damage_validator.validate_damage(return_record)
            for error in damage_errors:
                self.warnings.append(f"损坏验证警告: {error}")

            success, msg = self.inventory_manager.add_return(return_record)
            if not success:
                self.errors.append(f"归还失败: {msg} (来源: {return_record.source.file_path} 第{return_record.source.row_number}行)")
                continue

            valid_returns.append(return_record)

        return valid_returns

    def process_compensations(self, compensations: List[CompensationRecord],
                             materials: Dict[str, Material]) -> List[CompensationRecord]:
        valid_compensations = []
        sorted_compensations = sorted(compensations, key=lambda x: (x.order_id, x.material_id, x.compensation_id))

        for comp in sorted_compensations:
            if comp.material_id in materials:
                material = materials[comp.material_id]
                expected_amount = self.compensation_sm.calculate_compensation(
                    comp.damage_level, material.unit_price, 1
                )
                if abs(comp.compensation_amount - expected_amount) > 0.01:
                    self.warnings.append(
                        f"赔付{comp.compensation_id}: 金额异常, 预期{expected_amount:.2f}, 实际{comp.compensation_amount:.2f}"
                    )

            valid_compensations.append(comp)

        return valid_compensations

    def finalize(self):
        self.inventory_manager.calculate_loss()

    def get_pending_returns(self) -> List[MaterialInventory]:
        pending = []
        for inv in self.inventory_manager.get_all_inventories():
            if inv.pending_quantity > 0:
                pending.append(inv)
        return pending

    def get_loss_summary(self) -> Dict[str, int]:
        summary = defaultdict(int)
        for inv in self.inventory_manager.get_all_inventories():
            summary['total_outbound'] += inv.outbound_quantity
            summary['total_returned'] += inv.returned_quantity
            summary['total_lost'] += inv.lost_quantity
            summary['total_damaged'] += inv.damaged_quantity
        return dict(summary)
