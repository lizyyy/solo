import uuid
import json
from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session
from models import MaterialImport, Inventory, Vehicle, ProcessedBatch


class ValidationRule:
    def validate(self, item: Dict, inventory: Dict, vehicles: Dict) -> Tuple[str, str]:
        raise NotImplementedError


class EmergencyUsageRule(ValidationRule):
    def validate(self, item: Dict, inventory: Dict, vehicles: Dict) -> Tuple[str, str]:
        if item.get('is_emergency', False):
            if item['operation_type'] == '领用':
                material_code = item['material_code']
                if material_code in inventory:
                    inv_qty = inventory[material_code]['quantity']
                    if inv_qty >= item['quantity']:
                        return 'success', '紧急领用审批通过，库存充足'
                    else:
                        return 'pending', f'紧急领用，库存不足（当前{inv_qty}，需求{item["quantity"]}），需人工确认'
                else:
                    return 'pending', '紧急领用，物料未在库存系统登记，需人工确认'
        return None, None


class ReturnDifferenceRule(ValidationRule):
    def validate(self, item: Dict, inventory: Dict, vehicles: Dict) -> Tuple[str, str]:
        if item['operation_type'] == '归还':
            material_code = item['material_code']
            if material_code in inventory:
                current_qty = inventory[material_code]['quantity']
                return_qty = item['quantity']
                if return_qty > 0 and return_qty <= current_qty * 0.5:
                    return 'pending', f'归还数量异常（{return_qty}），与常规领用数量差异较大，需核实'
                elif return_qty <= 0:
                    return 'failed', '归还数量必须大于0，请修正数据'
            else:
                return 'failed', '归还物料不存在，请检查物料编码'
        return None, None


class NegativeInventoryRule(ValidationRule):
    def validate(self, item: Dict, inventory: Dict, vehicles: Dict) -> Tuple[str, str]:
        if item['operation_type'] == '领用' and not item.get('is_emergency', False):
            material_code = item['material_code']
            if material_code in inventory:
                inv_qty = inventory[material_code]['quantity']
                if inv_qty < item['quantity']:
                    return 'failed', f'库存不足（当前{inv_qty}，需求{item["quantity"]}），无法领用，需补料'
                elif inv_qty - item['quantity'] < 0:
                    return 'failed', '领用后库存将为负数，禁止操作'
            else:
                return 'failed', '物料编码不存在，请检查物料信息'
        return None, None


class VehicleValidationRule(ValidationRule):
    def validate(self, item: Dict, inventory: Dict, vehicles: Dict) -> Tuple[str, str]:
        vehicle_id = item['vehicle_id']
        if vehicle_id not in vehicles:
            return 'failed', f'车辆ID {vehicle_id} 未登记，请先录入车辆信息'
        vehicle = vehicles[vehicle_id]
        if vehicle['status'] != '正常':
            return 'pending', f'车辆状态为{vehicle["status"]}，需确认是否可用'
        return None, None


class RepairOrderRule(ValidationRule):
    def validate(self, item: Dict, inventory: Dict, vehicles: Dict) -> Tuple[str, str]:
        repair_order_no = item.get('repair_order_no', '')
        if not repair_order_no:
            return 'failed', '抢修单号不能为空，请补充'
        if len(repair_order_no) < 5:
            return 'pending', '抢修单号格式异常，需人工确认'
        return None, None


class MaterialImportService:
    def __init__(self, db: Session):
        self.db = db
        self.rules = [
            RepairOrderRule(),
            VehicleValidationRule(),
            NegativeInventoryRule(),
            EmergencyUsageRule(),
            ReturnDifferenceRule(),
        ]

    def _load_inventory(self) -> Dict:
        inventories = self.db.query(Inventory).all()
        return {
            inv.material_code: {
                'material_code': inv.material_code,
                'material_name': inv.material_name,
                'quantity': inv.quantity,
                'unit': inv.unit,
                'warehouse': inv.warehouse
            }
            for inv in inventories
        }

    def _load_vehicles(self) -> Dict:
        vehicles = self.db.query(Vehicle).all()
        return {
            v.vehicle_id: {
                'vehicle_id': v.vehicle_id,
                'vehicle_plate': v.vehicle_plate,
                'driver': v.driver,
                'team': v.team,
                'status': v.status
            }
            for v in vehicles
        }

    def is_batch_processed(self, batch_id: str) -> bool:
        return self.db.query(ProcessedBatch).filter(ProcessedBatch.batch_id == batch_id).first() is not None

    def process_import(self, items: List[Dict], batch_id: str = None) -> Dict:
        if batch_id and self.is_batch_processed(batch_id):
            batch_record = self.db.query(ProcessedBatch).filter(ProcessedBatch.batch_id == batch_id).first()
            return {
                'batch_id': batch_id,
                'message': '该批次已处理，重复提交不生效',
                'total_count': batch_record.total_count,
                'success_count': batch_record.success_count,
                'pending_count': batch_record.pending_count,
                'failed_count': batch_record.failed_count,
                'success_items': [],
                'pending_items': [],
                'failed_items': []
            }

        if not batch_id:
            batch_id = str(uuid.uuid4())

        inventory = self._load_inventory()
        vehicles = self._load_vehicles()

        success_items = []
        pending_items = []
        failed_items = []

        for item in items:
            status = 'success'
            suggestion = '校验通过'
            final_suggestion = None

            for rule in self.rules:
                rule_status, rule_suggestion = rule.validate(item, inventory, vehicles)
                if rule_status == 'failed':
                    status = 'failed'
                    final_suggestion = rule_suggestion
                    break
                elif rule_status == 'pending' and status == 'success':
                    status = 'pending'
                    final_suggestion = rule_suggestion

            if status == 'success' and not final_suggestion:
                final_suggestion = '校验通过，已正常入库'

            processed_item = {
                'item': item,
                'status': status,
                'suggestion': final_suggestion,
                'raw_data': item.copy()
            }

            material_import = MaterialImport(
                batch_id=batch_id,
                repair_order_no=item['repair_order_no'],
                material_code=item['material_code'],
                material_name=item['material_name'],
                quantity=item['quantity'],
                unit=item['unit'],
                vehicle_id=item['vehicle_id'],
                operator=item['operator'],
                operation_type=item['operation_type'],
                status=status,
                suggestion=final_suggestion,
                raw_data=json.dumps(item, ensure_ascii=False)
            )
            self.db.add(material_import)

            if status == 'success':
                success_items.append(processed_item)
                if item['operation_type'] == '领用':
                    self._update_inventory(item['material_code'], -item['quantity'])
                elif item['operation_type'] == '归还':
                    self._update_inventory(item['material_code'], item['quantity'])
            elif status == 'pending':
                pending_items.append(processed_item)
            else:
                failed_items.append(processed_item)

        batch_record = ProcessedBatch(
            batch_id=batch_id,
            total_count=len(items),
            success_count=len(success_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items)
        )
        self.db.add(batch_record)
        self.db.commit()

        return {
            'batch_id': batch_id,
            'total_count': len(items),
            'success_count': len(success_items),
            'pending_count': len(pending_items),
            'failed_count': len(failed_items),
            'success_items': success_items,
            'pending_items': pending_items,
            'failed_items': failed_items
        }

    def _update_inventory(self, material_code: str, quantity_change: float):
        inventory = self.db.query(Inventory).filter(Inventory.material_code == material_code).first()
        if inventory:
            inventory.quantity += quantity_change
