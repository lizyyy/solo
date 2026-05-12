import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import asdict
from src.utils.storage import storage
from src.models.base import (
    ShipmentRecord, ReturnRecord, ReissueTask, 
    InventoryOperation, AuditLog
)
from src.models.enums import GiftStatus, InventoryOperationType, ActionType


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def timestamp_now() -> str:
    return datetime.now().isoformat()


def deepcopy_dict(d: Dict) -> Dict:
    import copy
    return copy.deepcopy(d)


class FulfillmentEngine:
    def __init__(self):
        self.storage = storage
    
    def init_system(self, operator: str = "system") -> Dict:
        state = self.storage.load_state()
        before = deepcopy_dict(state)
        state['initialized'] = True
        state['version'] = state.get('version', 0) + 1
        state['last_action'] = ActionType.INIT.value
        state['last_action_time'] = timestamp_now()
        state['data_dir'] = self.storage.data_dir
        self.storage.save_state(state)
        
        self._create_audit_log(
            entity_type="system",
            entity_id="system_state",
            action=ActionType.INIT.value,
            before=before,
            after=deepcopy_dict(state),
            operator=operator,
            reason="系统初始化"
        )
        
        return {
            "success": True,
            "message": "系统初始化完成",
            "state": state
        }
    
    def check_init_required(self) -> Optional[Dict]:
        state = self.storage.load_state()
        if not state.get('initialized', False):
            return {
                "success": False,
                "error": "系统未初始化",
                "suggestion": "请先执行 `gift init` 命令初始化系统"
            }
        return None
    
    def import_data(self, data_type: str, data: Dict, operator: str = "system") -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        before_data = None
        
        if data_type == "order":
            orders = self.storage.load_orders()
            order_id = data['order_id']
            if order_id in orders:
                return {
                    "success": False,
                    "error": f"订单 {order_id} 已存在",
                    "reason": "重复导入订单",
                    "action": "如需更新请使用 manual-fix 命令"
                }
            before_data = None
            orders[order_id] = data
            self.storage.save_orders(orders)
            entity_type = "order"
            entity_id = order_id
            after_data = deepcopy_dict(data)
        
        elif data_type == "activity":
            rules = self.storage.load_rules()
            activity_id = data['activity_id']
            if activity_id in rules:
                return {
                    "success": False,
                    "error": f"活动 {activity_id} 已存在",
                    "reason": "重复导入活动规则"
                }
            rules[activity_id] = data
            self.storage.save_rules(rules)
            entity_type = "activity"
            entity_id = activity_id
            after_data = deepcopy_dict(data)
        
        elif data_type == "inventory":
            inventory = self.storage.load_inventory()
            sku = data['sku']
            if sku in inventory:
                return {
                    "success": False,
                    "error": f"库存 SKU {sku} 已存在",
                    "reason": "重复导入库存"
                }
            inventory[sku] = data
            self.storage.save_inventory(inventory)
            entity_type = "inventory"
            entity_id = sku
            after_data = deepcopy_dict(data)
        
        elif data_type == "shipment":
            result = self._process_shipment(data, operator)
            return result
        
        elif data_type == "return":
            result = self._process_return(data, operator)
            return result
        
        else:
            return {
                "success": False,
                "error": f"未知的数据类型: {data_type}",
                "supported_types": ["order", "activity", "inventory", "shipment", "return"]
            }
        
        self._create_audit_log(
            entity_type=entity_type,
            entity_id=entity_id,
            action=ActionType.IMPORT.value,
            before=before_data or {},
            after=after_data,
            operator=operator,
            reason=f"导入{entity_type}"
        )
        
        self._update_last_action(ActionType.IMPORT.value, operator)
        
        return {
            "success": True,
            "message": f"成功导入 {data_type} 数据",
            "id": entity_id
        }
    
    def check_rules(self, order_id: Optional[str] = None, operator: str = "system") -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        orders = self.storage.load_orders()
        rules = self.storage.load_rules()
        inventory = self.storage.load_inventory()
        
        if order_id:
            if order_id not in orders:
                return {
                    "success": False,
                    "error": f"订单 {order_id} 不存在"
                }
            order_ids_to_check = [order_id]
        else:
            order_ids_to_check = list(orders.keys())
        
        results = []
        processed_count = 0
        
        for oid in order_ids_to_check:
            order = orders[oid]
            original_order = deepcopy_dict(order)
            check_result = self._check_single_order(order, rules, inventory)
            results.append(check_result)
            
            if order != original_order:
                self._create_audit_log(
                    entity_type="order",
                    entity_id=oid,
                    action=ActionType.CHECK.value,
                    before=original_order,
                    after=deepcopy_dict(order),
                    operator=operator,
                    reason="规则校验更新"
                )
                orders[oid] = order
            
            if check_result.get('changed', False):
                processed_count += 1
        
        self.storage.save_orders(orders)
        self._update_last_action(ActionType.CHECK.value, operator)
        
        return {
            "success": True,
            "message": f"完成规则校验，共检查 {len(order_ids_to_check)} 个订单，{processed_count} 个订单状态有变化",
            "results": results,
            "summary": self._summarize_check_results(results)
        }
    
    def _check_single_order(self, order: Dict, rules: Dict, inventory: Dict) -> Dict:
        changes = []
        activity_id = order.get('activity_id')
        
        if not activity_id:
            order['gift_status'] = GiftStatus.NOT_ELIGIBLE.value
            order['remarks'] = "无关联活动"
            return {
                "order_id": order['order_id'],
                "changed": False,
                "status": GiftStatus.NOT_ELIGIBLE.value,
                "reason": "无关联活动",
                "changes": changes
            }
        
        if activity_id not in rules:
            order['gift_status'] = GiftStatus.NOT_ELIGIBLE.value
            order['remarks'] = "关联活动不存在"
            return {
                "order_id": order['order_id'],
                "changed": False,
                "status": GiftStatus.NOT_ELIGIBLE.value,
                "reason": "关联活动不存在",
                "changes": changes
            }
        
        rule = rules[activity_id]
        
        if not rule.get('is_active', True):
            order['gift_status'] = GiftStatus.NOT_ELIGIBLE.value
            order['remarks'] = "活动已结束"
            return {
                "order_id": order['order_id'],
                "changed": False,
                "status": GiftStatus.NOT_ELIGIBLE.value,
                "reason": "活动已结束",
                "changes": changes
            }
        
        actual_amount = order.get('paid_amount', 0) - order.get('returned_amount', 0)
        threshold = rule.get('threshold_amount', 0)
        
        is_split_order = bool(order.get('parent_order_id'))
        parent_order = None
        sibling_orders = []
        
        if is_split_order:
            parent_order_id = order['parent_order_id']
            all_orders = self.storage.load_orders()
            parent_order = all_orders.get(parent_order_id)
            if parent_order:
                sibling_orders = [
                    o for o in all_orders.values() 
                    if o.get('parent_order_id') == parent_order_id and o['order_id'] != order['order_id']
                ]
                
                split_total = actual_amount
                for sib in sibling_orders:
                    sib_paid = sib.get('paid_amount', 0) - sib.get('returned_amount', 0)
                    split_total += sib_paid
                actual_amount = split_total
        
        eligible = actual_amount >= threshold
        
        current_status = order.get('gift_status', GiftStatus.PENDING.value)
        
        if eligible:
            new_status = GiftStatus.ELIGIBLE.value
            reason = f"实付金额 {actual_amount} >= 门槛 {threshold}"
            order['gift_sku'] = rule['gift_sku']
            order['gift_qty'] = rule.get('gift_qty_per_order', 1)
        else:
            new_status = GiftStatus.NOT_ELIGIBLE.value
            reason = f"实付金额 {actual_amount} < 门槛 {threshold}"
            
            if current_status in [GiftStatus.ALLOCATED.value, GiftStatus.SHIPPED.value]:
                new_status = GiftStatus.DEDUCTED.value
                order['gift_deducted'] = True
                deduct_amount = self._calculate_deduct_amount(order, rule)
                order['gift_deduct_amount'] = deduct_amount
                reason = f"退货后金额不足，已扣费 {deduct_amount} 元"
        
        changed = current_status != new_status
        if changed:
            changes.append({
                "field": "gift_status",
                "from": current_status,
                "to": new_status
            })
        
        order['gift_status'] = new_status
        order['remarks'] = reason
        
        return {
            "order_id": order['order_id'],
            "changed": changed,
            "status": new_status,
            "reason": reason,
            "amount_actual": actual_amount,
            "threshold": threshold,
            "eligible": eligible,
            "changes": changes
        }
    
    def allocate_gifts(self, order_id: Optional[str] = None, operator: str = "system") -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        orders = self.storage.load_orders()
        inventory = self.storage.load_inventory()
        
        if order_id:
            if order_id not in orders:
                return {"success": False, "error": f"订单 {order_id} 不存在"}
            order_ids = [order_id]
        else:
            order_ids = [
                oid for oid, o in orders.items()
                if o.get('gift_status') == GiftStatus.ELIGIBLE.value
                and o.get('gift_allocated_qty', 0) < o.get('gift_qty', 0)
            ]
        
        results = []
        
        for oid in order_ids:
            order = orders[oid]
            original_order = deepcopy_dict(order)
            result = self._allocate_single_order(order, inventory, operator)
            results.append(result)
            
            if result.get('changed', False):
                self._create_audit_log(
                    entity_type="order",
                    entity_id=oid,
                    action=ActionType.ALLOCATE.value,
                    before=original_order,
                    after=deepcopy_dict(order),
                    operator=operator,
                    reason=result.get('reason', '赠品分配')
                )
                orders[oid] = order
        
        self.storage.save_orders(orders)
        self.storage.save_inventory(inventory)
        
        return {
            "success": True,
            "message": f"完成赠品分配，处理 {len(results)} 个订单",
            "results": results
        }
    
    def _allocate_single_order(self, order: Dict, inventory: Dict, operator: str) -> Dict:
        sku = order.get('gift_sku')
        if not sku or sku not in inventory:
            return {
                "order_id": order['order_id'],
                "success": False,
                "changed": False,
                "error": "赠品SKU不存在或无库存记录"
            }
        
        inv = inventory[sku]
        qty_needed = order.get('gift_qty', 0) - order.get('gift_allocated_qty', 0)
        
        if qty_needed <= 0:
            return {
                "order_id": order['order_id'],
                "success": True,
                "changed": False,
                "reason": "赠品已全部分配"
            }
        
        if inv.get('available_qty', 0) < qty_needed:
            return {
                "order_id": order['order_id'],
                "success": False,
                "changed": False,
                "error": "库存不足",
                "available": inv.get('available_qty', 0),
                "needed": qty_needed
            }
        
        before_avail = inv.get('available_qty', 0)
        before_alloc = inv.get('allocated_qty', 0)
        
        inv['available_qty'] -= qty_needed
        inv['allocated_qty'] += qty_needed
        
        order['gift_allocated_qty'] += qty_needed
        order['gift_status'] = GiftStatus.ALLOCATED.value
        
        self._create_inventory_operation(
            sku=sku,
            op_type=InventoryOperationType.ALLOCATE.value,
            qty_change=qty_needed,
            before=before_avail,
            after=inv['available_qty'],
            order_id=order['order_id'],
            operator=operator,
            reason="订单赠品分配"
        )
        
        return {
            "order_id": order['order_id'],
            "success": True,
            "changed": True,
            "allocated": qty_needed,
            "remaining_available": inv['available_qty']
        }
    
    def _process_shipment(self, data: Dict, operator: str) -> Dict:
        orders = self.storage.load_orders()
        order_id = data['order_id']
        
        if order_id not in orders:
            return {
                "success": False,
                "error": f"订单 {order_id} 不存在"
            }
        
        order = orders[order_id]
        original_order = deepcopy_dict(order)
        
        sku = data.get('gift_sku') or order.get('gift_sku')
        qty = data.get('gift_qty', order.get('gift_qty', 0) - order.get('gift_shipped_qty', 0))
        
        existing_shipments = [
            s for s in self.storage.load_shipments()
            if s.get('order_id') == order_id and s.get('gift_sku') == sku
        ]
        
        if existing_shipments:
            return {
                "success": False,
                "error": "重复发货回调",
                "reason": f"订单 {order_id} 的赠品 {sku} 已发货",
                "idempotent": True,
                "existing_shipments": existing_shipments
            }
        
        shipment = ShipmentRecord(
            shipment_id=generate_id("SHIP"),
            order_id=order_id,
            gift_sku=sku,
            gift_qty=qty,
            shipped_at=timestamp_now(),
            operator=operator,
            tracking_no=data.get('tracking_no')
        )
        self.storage.append_shipment(asdict(shipment))
        
        order['gift_shipped_qty'] = order.get('gift_shipped_qty', 0) + qty
        
        if order['gift_shipped_qty'] >= order.get('gift_qty', 0):
            order['gift_status'] = GiftStatus.SHIPPED.value
        
        orders[order_id] = order
        self.storage.save_orders(orders)
        
        inventory = self.storage.load_inventory()
        if sku in inventory:
            inv = inventory[sku]
            before_alloc = inv.get('allocated_qty', 0)
            before_shipped = inv.get('shipped_qty', 0)
            inv['allocated_qty'] -= qty
            inv['shipped_qty'] += qty
            self.storage.save_inventory(inventory)
        
        self._create_audit_log(
            entity_type="order",
            entity_id=order_id,
            action=ActionType.SHIP.value,
            before=original_order,
            after=deepcopy_dict(order),
            operator=operator,
            reason="赠品发货"
        )
        
        self._update_last_action(ActionType.SHIP.value, operator)
        
        return {
            "success": True,
            "message": "发货记录已处理",
            "shipment_id": shipment.shipment_id
        }
    
    def _process_return(self, data: Dict, operator: str) -> Dict:
        orders = self.storage.load_orders()
        order_id = data['order_id']
        
        if order_id not in orders:
            return {
                "success": False,
                "error": f"订单 {order_id} 不存在"
            }
        
        order = orders[order_id]
        original_order = deepcopy_dict(order)
        
        return_amount = data.get('returned_amount', 0)
        return_id = generate_id("RET")
        
        existing_returns = [
            r for r in self.storage.load_returns()
            if r.get('order_id') == order_id 
            and abs(r.get('returned_amount', 0) - return_amount) < 0.01
            and r.get('created_at') == data.get('returned_at')
        ]
        
        if existing_returns:
            return {
                "success": False,
                "error": "重复退货回调",
                "reason": f"订单 {order_id} 的退货记录已存在",
                "idempotent": True,
                "existing_returns": existing_returns
            }
        
        return_record = ReturnRecord(
            return_id=return_id,
            order_id=order_id,
            returned_amount=return_amount,
            returned_at=data.get('returned_at', timestamp_now()),
            reason=data.get('reason', ''),
            operator=operator
        )
        self.storage.append_return(asdict(return_record))
        
        order['returned_amount'] = order.get('returned_amount', 0) + return_amount
        
        rules = self.storage.load_rules()
        inventory = self.storage.load_inventory()
        
        check_result = self._check_single_order(order, rules, inventory)
        
        orders[order_id] = order
        self.storage.save_orders(orders)
        
        self._create_audit_log(
            entity_type="order",
            entity_id=order_id,
            action=ActionType.RETURN.value,
            before=original_order,
            after=deepcopy_dict(order),
            operator=operator,
            reason=f"退货处理，金额 {return_amount}"
        )
        
        self._update_last_action(ActionType.RETURN.value, operator)
        
        return {
            "success": True,
            "message": "退货记录已处理",
            "return_id": return_id,
            "gift_status_change": check_result
        }
    
    def create_reissue(self, order_id: str, reason: str, operator: str = "system") -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        orders = self.storage.load_orders()
        
        if order_id not in orders:
            return {"success": False, "error": f"订单 {order_id} 不存在"}
        
        order = orders[order_id]
        original_order = deepcopy_dict(order)
        rules = self.storage.load_rules()
        
        activity_id = order.get('activity_id')
        if not activity_id or activity_id not in rules:
            return {
                "success": False,
                "error": "订单无有效活动规则"
            }
        
        rule = rules[activity_id]
        max_reissue = rule.get('max_reissue_count', 1)
        
        if order.get('reissue_count', 0) >= max_reissue:
            return {
                "success": False,
                "error": f"已超过最大补发次数 {max_reissue} 次",
                "current_count": order.get('reissue_count', 0)
            }
        
        task = ReissueTask(
            task_id=generate_id("REISSUE"),
            order_id=order_id,
            gift_sku=order.get('gift_sku', ''),
            qty=order.get('gift_qty', 0) - order.get('gift_shipped_qty', 0),
            reason=reason
        )
        self.storage.append_reissue(asdict(task))
        
        order['reissue_count'] = order.get('reissue_count', 0) + 1
        order['gift_status'] = GiftStatus.REISSUE_PENDING.value
        
        orders[order_id] = order
        self.storage.save_orders(orders)
        
        self._create_audit_log(
            entity_type="order",
            entity_id=order_id,
            action=ActionType.REISSUE.value,
            before=original_order,
            after=deepcopy_dict(order),
            operator=operator,
            reason=f"创建补发任务: {reason}"
        )
        
        self._update_last_action(ActionType.REISSUE.value, operator)
        
        return {
            "success": True,
            "message": "补发任务已创建",
            "task_id": task.task_id
        }
    
    def process_reissue(self, task_id: str, operator: str = "system") -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        reissues = self.storage.load_reissues()
        task = None
        task_index = None
        
        for i, t in enumerate(reissues):
            if t['task_id'] == task_id:
                task = t
                task_index = i
                break
        
        if not task:
            return {"success": False, "error": f"补发任务 {task_id} 不存在"}
        
        if task.get('status') != "待处理":
            return {
                "success": False,
                "error": "重复处理补发任务",
                "idempotent": True,
                "current_status": task.get('status')
            }
        
        inventory = self.storage.load_inventory()
        sku = task['gift_sku']
        
        if sku not in inventory or inventory[sku].get('available_qty', 0) < task['qty']:
            return {
                "success": False,
                "error": "库存不足，无法补发"
            }
        
        inv = inventory[sku]
        before_avail = inv.get('available_qty', 0)
        inv['available_qty'] -= task['qty']
        inv['reissued_qty'] = inv.get('reissued_qty', 0) + task['qty']
        self.storage.save_inventory(inventory)
        
        task['status'] = "已完成"
        task['operator'] = operator
        task['completed_at'] = timestamp_now()
        reissues[task_index] = task
        self.storage.save('reissue_tasks', reissues)
        
        orders = self.storage.load_orders()
        order = orders.get(task['order_id'])
        if order:
            original_order = deepcopy_dict(order)
            order['reissued'] = True
            order['gift_shipped_qty'] = order.get('gift_shipped_qty', 0) + task['qty']
            order['gift_status'] = GiftStatus.REISSUED.value
            orders[task['order_id']] = order
            self.storage.save_orders(orders)
            
            self._create_audit_log(
                entity_type="order",
                entity_id=task['order_id'],
                action=ActionType.REISSUE.value,
                before=original_order,
                after=deepcopy_dict(order),
                operator=operator,
                reason="补发任务已完成"
            )
        
        self._create_inventory_operation(
            sku=sku,
            op_type=InventoryOperationType.REISSUE.value,
            qty_change=task['qty'],
            before=before_avail,
            after=inv['available_qty'],
            order_id=task['order_id'],
            operator=operator,
            reason=f"补发完成: {task['reason']}"
        )
        
        self._update_last_action(ActionType.REISSUE.value, operator)
        
        return {
            "success": True,
            "message": "补发任务已完成",
            "task_id": task_id
        }
    
    def manual_fix(self, entity_type: str, entity_id: str, 
                   updates: Dict, reason: str, operator: str) -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        if entity_type == "order":
            data = self.storage.load_orders()
        elif entity_type == "inventory":
            data = self.storage.load_inventory()
        elif entity_type == "activity":
            data = self.storage.load_rules()
        else:
            return {
                "success": False,
                "error": f"不支持的实体类型: {entity_type}"
            }
        
        if entity_id not in data:
            return {
                "success": False,
                "error": f"{entity_type} {entity_id} 不存在"
            }
        
        before = deepcopy_dict(data[entity_id])
        data[entity_id].update(updates)
        after = deepcopy_dict(data[entity_id])
        
        if entity_type == "order":
            self.storage.save_orders(data)
        elif entity_type == "inventory":
            self.storage.save_inventory(data)
        elif entity_type == "activity":
            self.storage.save_rules(data)
        
        self._create_audit_log(
            entity_type=entity_type,
            entity_id=entity_id,
            action=ActionType.MANUAL_FIX.value,
            before=before,
            after=after,
            operator=operator,
            reason=reason
        )
        
        self._update_last_action(ActionType.MANUAL_FIX.value, operator)
        
        diff = self._compute_diff(before, after)
        
        return {
            "success": True,
            "message": "人工修正已记录",
            "operator": operator,
            "reason": reason,
            "diff": diff
        }
    
    def get_order_detail(self, order_id: str) -> Dict:
        orders = self.storage.load_orders()
        
        if order_id not in orders:
            return {
                "success": False,
                "error": f"订单 {order_id} 不存在"
            }
        
        order = orders[order_id]
        rules = self.storage.load_rules()
        shipments = [s for s in self.storage.load_shipments() if s['order_id'] == order_id]
        returns = [r for r in self.storage.load_returns() if r['order_id'] == order_id]
        reissues = [r for r in self.storage.load_reissues() if r['order_id'] == order_id]
        inv_ops = [op for op in self.storage.load_inventory_ops() if op.get('order_id') == order_id]
        audits = [a for a in self.storage.load_audits() 
                  if a['entity_type'] == 'order' and a['entity_id'] == order_id]
        
        rule = None
        if order.get('activity_id') in rules:
            rule = rules[order['activity_id']]
        
        actual_amount = order.get('paid_amount', 0) - order.get('returned_amount', 0)
        threshold = rule.get('threshold_amount', 0) if rule else 0
        
        return {
            "success": True,
            "order": order,
            "activity_rule": rule,
            "shipments": shipments,
            "returns": returns,
            "reissues": reissues,
            "inventory_operations": inv_ops,
            "audit_logs": audits,
            "calculation": {
                "actual_amount": actual_amount,
                "threshold": threshold,
                "eligible": actual_amount >= threshold if rule else False,
                "remaining_to_threshold": max(0, threshold - actual_amount)
            }
        }
    
    def generate_report(self) -> Dict:
        check = self.check_init_required()
        if check:
            return check
        
        orders = self.storage.load_orders()
        inventory = self.storage.load_inventory()
        shipments = self.storage.load_shipments()
        returns = self.storage.load_returns()
        reissues = self.storage.load_reissues()
        inv_ops = self.storage.load_inventory_ops()
        rules = self.storage.load_rules()
        state = self.storage.load_state()
        
        order_list = list(orders.values())
        
        gift_status_counts = {}
        for o in order_list:
            status = o.get('gift_status', '未知')
            gift_status_counts[status] = gift_status_counts.get(status, 0) + 1
        
        abnormal_orders = [
            o for o in order_list
            if o.get('gift_status') in [
                GiftStatus.DEDUCTED.value,
                GiftStatus.REISSUE_PENDING.value
            ] or (
                o.get('gift_status') == GiftStatus.ELIGIBLE.value
                and o.get('gift_allocated_qty', 0) < o.get('gift_qty', 0)
            )
        ]
        
        inventory_summary = []
        for sku, inv in inventory.items():
            inventory_summary.append({
                "sku": sku,
                "name": inv.get('name', ''),
                "total": inv.get('total_qty', 0),
                "available": inv.get('available_qty', 0),
                "allocated": inv.get('allocated_qty', 0),
                "shipped": inv.get('shipped_qty', 0),
                "returned": inv.get('returned_qty', 0),
                "reissued": inv.get('reissued_qty', 0)
            })
        
        pending_reissues = [r for r in reissues if r.get('status') == '待处理']
        
        total_deducted = sum(
            o.get('gift_deduct_amount', 0) 
            for o in order_list 
            if o.get('gift_deducted', False)
        )
        
        gifts_by_status = {}
        for status, count in gift_status_counts.items():
            gifts_by_status[status] = count
        
        self._update_last_action(ActionType.REPORT.value, "system")
        
        return {
            "success": True,
            "system_state": state,
            "summary": {
                "total_orders": len(order_list),
                "total_activities": len(rules),
                "total_shipments": len(shipments),
                "total_returns": len(returns),
                "total_reissues": len(reissues),
                "total_inventory_ops": len(inv_ops)
            },
            "gift_status_distribution": gifts_by_status,
            "inventory": inventory_summary,
            "abnormal_orders": abnormal_orders,
            "pending_reissues": pending_reissues,
            "financial": {
                "total_deducted_amount": total_deducted
            }
        }
    
    def _calculate_deduct_amount(self, order: Dict, rule: Dict) -> float:
        actual = order.get('paid_amount', 0) - order.get('returned_amount', 0)
        threshold = rule.get('threshold_amount', 0)
        return max(0, threshold - actual)
    
    def _create_inventory_operation(self, sku: str, op_type: str, qty_change: int,
                                   before: int, after: int, order_id: Optional[str],
                                   operator: str, reason: str):
        op = InventoryOperation(
            operation_id=generate_id("INVOP"),
            sku=sku,
            operation_type=op_type,
            qty_change=qty_change,
            before_qty=before,
            after_qty=after,
            order_id=order_id,
            operator=operator,
            reason=reason
        )
        self.storage.append_inventory_op(asdict(op))
    
    def _create_audit_log(self, entity_type: str, entity_id: str, action: str,
                         before: Dict, after: Dict, operator: str, reason: str):
        log = AuditLog(
            log_id=generate_id("AUDIT"),
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before=before,
            after=after,
            operator=operator,
            reason=reason
        )
        self.storage.append_audit(asdict(log))
    
    def _compute_diff(self, before: Dict, after: Dict) -> Dict:
        diff = {}
        all_keys = set(before.keys()) | set(after.keys())
        for key in all_keys:
            b = before.get(key)
            a = after.get(key)
            if b != a:
                diff[key] = {"before": b, "after": a}
        return diff
    
    def _summarize_check_results(self, results: List[Dict]) -> Dict:
        status_counts = {}
        changed_count = 0
        for r in results:
            status = r.get('status', '未知')
            status_counts[status] = status_counts.get(status, 0) + 1
            if r.get('changed', False):
                changed_count += 1
        return {
            "total": len(results),
            "changed": changed_count,
            "status_distribution": status_counts
        }
    
    def _update_last_action(self, action: str, operator: str):
        state = self.storage.load_state()
        state['last_action'] = action
        state['last_action_time'] = timestamp_now()
        state['last_operator'] = operator
        self.storage.save_state(state)


engine = FulfillmentEngine()
