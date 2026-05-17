from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import (
    BatchInventory, InventoryFreeze, ReleaseVoucher, 
    InventorySnapshot, InventoryConflict, OperationHistory,
    FreezeReason, Sku, ImportExportLog, generate_id
)

INVENTORY_STATUS = {
    'AVAILABLE': '可用',
    'FROZEN': '冻结中',
    'RELEASE_AUDIT': '释放审核',
    'RELEASED': '已释放'
}

QUALITY_STATUS = {
    'PENDING': '待质检',
    'PASSED': '已通过',
    'FAILED': '已失败'
}

FREEZE_STATUS = {
    'FROZEN': '冻结中',
    'RELEASE_AUDIT': '释放审核中',
    'RELEASED': '已释放',
    'PARTIAL_RELEASED': '部分释放'
}

CONFLICT_TYPE = {
    'QUALITY_SALES': '质检未完成被销售单占用',
    'INVENTORY_SHORTAGE': '库存不足',
    'DOUBLE_FREEZE': '重复冻结'
}

HANDLE_RESULT = {
    'PENDING': '待处理',
    'RESOLVED': '已解决',
    'IGNORED': '已忽略'
}

class InventoryService:
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_order_no(self, prefix: str) -> str:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f'{prefix}{timestamp}'
    
    def _create_snapshot(self, batch: BatchInventory, action_type: str, 
                        action_id: str, action_no: str, operator: str, 
                        remark: str = None, before_data: Dict = None):
        if before_data is None:
            before_data = {
                'total_qty': float(batch.total_qty),
                'available_qty': float(batch.available_qty),
                'frozen_qty': float(batch.frozen_qty),
                'released_qty': float(batch.released_qty),
                'inventory_status': batch.inventory_status
            }
        
        after_data = {
            'total_qty': float(batch.total_qty),
            'available_qty': float(batch.available_qty),
            'frozen_qty': float(batch.frozen_qty),
            'released_qty': float(batch.released_qty),
            'inventory_status': batch.inventory_status
        }
        
        snapshot = InventorySnapshot(
            batch_id=batch.batch_id,
            sku_id=batch.sku_id,
            batch_no=batch.batch_no,
            warehouse_code=batch.warehouse_code,
            total_qty=batch.total_qty,
            available_qty=batch.available_qty,
            frozen_qty=batch.frozen_qty,
            released_qty=batch.released_qty,
            inventory_status=batch.inventory_status,
            action_type=action_type,
            action_id=action_id,
            action_no=action_no,
            operator=operator,
            action_time=datetime.now(),
            action_remark=remark,
            before_snapshot=before_data,
            after_snapshot=after_data
        )
        self.db.add(snapshot)
    
    def _create_operation_history(self, business_type: str, business_id: str,
                                 business_no: str, action: str, operator: str,
                                 before_data: Dict = None, after_data: Dict = None,
                                 remark: str = None):
        history = OperationHistory(
            business_type=business_type,
            business_id=business_id,
            business_no=business_no,
            action=action,
            before_data=before_data,
            after_data=after_data,
            operator=operator,
            operate_time=datetime.now(),
            remark=remark
        )
        self.db.add(history)
    
    def _create_conflict(self, conflict_type: str, sku_id: str, batch_id: str,
                        batch_no: str, warehouse_code: str, conflict_qty: float,
                        quality_status: str = None, related_order_no: str = None,
                        related_order_type: str = None, conflict_detail: str = None,
                        operator: str = None) -> InventoryConflict:
        conflict = InventoryConflict(
            conflict_no=self._generate_order_no('CNF'),
            conflict_type=conflict_type,
            sku_id=sku_id,
            batch_id=batch_id,
            batch_no=batch_no,
            warehouse_code=warehouse_code,
            related_order_no=related_order_no,
            related_order_type=related_order_type,
            conflict_qty=conflict_qty,
            quality_status=quality_status,
            conflict_detail=conflict_detail
        )
        self.db.add(conflict)
        self.db.flush()
        
        batch = self.db.query(BatchInventory).filter(BatchInventory.batch_id == batch_id).first()
        if batch:
            self._create_snapshot(batch, 'CONFLICT', conflict.conflict_id, 
                                 conflict.conflict_no, operator, conflict_detail)
        
        return conflict
    
    def check_conflict_before_freeze(self, batch_id: str, freeze_qty: float,
                                    sales_order_no: str = None) -> List[InventoryConflict]:
        conflicts = []
        batch = self.db.query(BatchInventory).filter(BatchInventory.batch_id == batch_id).first()
        
        if not batch:
            return conflicts
        
        if batch.quality_status != 'PASSED' and sales_order_no:
            conflict_detail = f'批次 {batch.batch_no} 质检状态为 {QUALITY_STATUS.get(batch.quality_status, batch.quality_status)}，' \
                            f'被销售单 {sales_order_no} 占用，不能按普通冻结处理'
            conflict = self._create_conflict(
                conflict_type='QUALITY_SALES',
                sku_id=batch.sku_id,
                batch_id=batch.batch_id,
                batch_no=batch.batch_no,
                warehouse_code=batch.warehouse_code,
                conflict_qty=freeze_qty,
                quality_status=batch.quality_status,
                related_order_no=sales_order_no,
                related_order_type='SALES_ORDER',
                conflict_detail=conflict_detail,
                operator='system'
            )
            conflicts.append(conflict)
        
        if batch.available_qty < freeze_qty:
            conflict_detail = f'批次 {batch.batch_no} 可用库存 {batch.available_qty} 不足，冻结数量 {freeze_qty}'
            conflict = self._create_conflict(
                conflict_type='INVENTORY_SHORTAGE',
                sku_id=batch.sku_id,
                batch_id=batch.batch_id,
                batch_no=batch.batch_no,
                warehouse_code=batch.warehouse_code,
                conflict_qty=freeze_qty,
                quality_status=batch.quality_status,
                conflict_detail=conflict_detail,
                operator='system'
            )
            conflicts.append(conflict)
        
        return conflicts
    
    def freeze_inventory(self, sku_id: str, batch_id: str, warehouse_code: str,
                        reason_code: str, freeze_qty: float, operator: str,
                        freeze_remark: str = None, evidence_attachments: List = None,
                        sales_order_no: str = None) -> Dict[str, Any]:
        batch = self.db.query(BatchInventory).filter(
            BatchInventory.batch_id == batch_id,
            BatchInventory.sku_id == sku_id,
            BatchInventory.warehouse_code == warehouse_code
        ).first()
        
        if not batch:
            return {'success': False, 'message': '批次库存不存在'}
        
        before_data = {
            'available_qty': float(batch.available_qty),
            'frozen_qty': float(batch.frozen_qty),
            'inventory_status': batch.inventory_status
        }
        
        conflicts = self.check_conflict_before_freeze(batch_id, freeze_qty, sales_order_no)
        if conflicts:
            return {
                'success': False,
                'message': '存在冲突，无法冻结',
                'conflicts': [{'conflict_no': c.conflict_no, 'detail': c.conflict_detail} for c in conflicts]
            }
        
        reason = self.db.query(FreezeReason).filter(FreezeReason.reason_code == reason_code).first()
        
        freeze = InventoryFreeze(
            freeze_no=self._generate_order_no('FRZ'),
            sku_id=sku_id,
            batch_id=batch_id,
            batch_no=batch.batch_no,
            warehouse_code=warehouse_code,
            reason_code=reason_code,
            reason_name=reason.reason_name if reason else None,
            freeze_qty=freeze_qty,
            freeze_operator=operator,
            freeze_time=datetime.now(),
            freeze_remark=freeze_remark,
            evidence_attachments=evidence_attachments or [],
            status='FROZEN'
        )
        self.db.add(freeze)
        self.db.flush()
        
        batch.available_qty -= freeze_qty
        batch.frozen_qty += freeze_qty
        batch.inventory_status = 'FROZEN'
        
        self._create_snapshot(batch, 'FREEZE', freeze.freeze_id, freeze.freeze_no, 
                             operator, freeze_remark, before_data)
        
        self._create_operation_history(
            business_type='FREEZE',
            business_id=freeze.freeze_id,
            business_no=freeze.freeze_no,
            action='CREATE_FREEZE',
            operator=operator,
            before_data=before_data,
            after_data={
                'available_qty': float(batch.available_qty),
                'frozen_qty': float(batch.frozen_qty),
                'inventory_status': batch.inventory_status,
                'freeze_qty': float(freeze_qty)
            },
            remark=freeze_remark
        )
        
        self.db.commit()
        return {
            'success': True,
            'message': '冻结成功',
            'freeze_no': freeze.freeze_no,
            'freeze_id': freeze.freeze_id
        }
    
    def submit_release_audit(self, freeze_id: str, operator: str, 
                           audit_remark: str = None) -> Dict[str, Any]:
        freeze = self.db.query(InventoryFreeze).filter(InventoryFreeze.freeze_id == freeze_id).first()
        if not freeze:
            return {'success': False, 'message': '冻结记录不存在'}
        
        if freeze.status not in ['FROZEN', 'PARTIAL_RELEASED']:
            return {'success': False, 'message': '当前状态不允许提交释放审核'}
        
        before_data = {'status': freeze.status}
        
        freeze.status = 'RELEASE_AUDIT'
        freeze.release_audit_operator = operator
        freeze.release_audit_time = datetime.now()
        freeze.release_audit_remark = audit_remark
        
        batch = self.db.query(BatchInventory).filter(BatchInventory.batch_id == freeze.batch_id).first()
        if batch:
            batch.inventory_status = 'RELEASE_AUDIT'
        
        self._create_operation_history(
            business_type='FREEZE',
            business_id=freeze.freeze_id,
            business_no=freeze.freeze_no,
            action='SUBMIT_RELEASE_AUDIT',
            operator=operator,
            before_data=before_data,
            after_data={'status': freeze.status},
            remark=audit_remark
        )
        
        self.db.commit()
        return {
            'success': True,
            'message': '释放审核提交成功',
            'freeze_no': freeze.freeze_no
        }
    
    def release_inventory(self, freeze_id: str, release_qty: float, operator: str,
                         release_reason: str = None, release_remark: str = None,
                         evidence_attachments: List = None, related_order_no: str = None,
                         related_order_type: str = None) -> Dict[str, Any]:
        freeze = self.db.query(InventoryFreeze).filter(InventoryFreeze.freeze_id == freeze_id).first()
        if not freeze:
            return {'success': False, 'message': '冻结记录不存在'}
        
        if freeze.status != 'RELEASE_AUDIT':
            return {'success': False, 'message': '请先提交释放审核'}
        
        batch = self.db.query(BatchInventory).filter(BatchInventory.batch_id == freeze.batch_id).first()
        if not batch:
            return {'success': False, 'message': '批次库存不存在'}
        
        remaining_frozen = freeze.freeze_qty - self._get_released_qty(freeze_id)
        if release_qty > remaining_frozen:
            return {'success': False, 'message': f'释放数量超过可释放数量 {remaining_frozen}'}
        
        before_batch_data = {
            'available_qty': float(batch.available_qty),
            'frozen_qty': float(batch.frozen_qty),
            'released_qty': float(batch.released_qty),
            'inventory_status': batch.inventory_status
        }
        
        release_type = 'FULL' if release_qty == remaining_frozen else 'PARTIAL'
        
        voucher = ReleaseVoucher(
            voucher_no=self._generate_order_no('REL'),
            freeze_id=freeze_id,
            freeze_no=freeze.freeze_no,
            sku_id=freeze.sku_id,
            batch_id=freeze.batch_id,
            release_qty=release_qty,
            release_type=release_type,
            release_reason=release_reason,
            release_operator=operator,
            release_time=datetime.now(),
            release_remark=release_remark,
            evidence_attachments=evidence_attachments or [],
            related_order_no=related_order_no,
            related_order_type=related_order_type,
            status='COMPLETED'
        )
        self.db.add(voucher)
        self.db.flush()
        
        batch.available_qty += release_qty
        batch.frozen_qty -= release_qty
        batch.released_qty += release_qty
        
        if release_type == 'FULL':
            freeze.status = 'RELEASED'
            batch.inventory_status = 'RELEASED'
        else:
            freeze.status = 'PARTIAL_RELEASED'
            batch.inventory_status = 'FROZEN'
        
        self._create_snapshot(batch, 'RELEASE', voucher.voucher_id, voucher.voucher_no,
                             operator, release_remark, before_batch_data)
        
        self._create_operation_history(
            business_type='RELEASE',
            business_id=voucher.voucher_id,
            business_no=voucher.voucher_no,
            action='CREATE_RELEASE',
            operator=operator,
            before_data=before_batch_data,
            after_data={
                'available_qty': float(batch.available_qty),
                'frozen_qty': float(batch.frozen_qty),
                'released_qty': float(batch.released_qty),
                'release_qty': float(release_qty)
            },
            remark=release_remark
        )
        
        self.db.commit()
        return {
            'success': True,
            'message': '释放成功',
            'voucher_no': voucher.voucher_no,
            'voucher_id': voucher.voucher_id
        }
    
    def _get_released_qty(self, freeze_id: str) -> float:
        result = self.db.query(
            func.sum(ReleaseVoucher.release_qty)
        ).filter(
            ReleaseVoucher.freeze_id == freeze_id,
            ReleaseVoucher.status == 'COMPLETED'
        ).scalar()
        return float(result or 0)
    
    def get_freeze_list(self, sku_id: str = None, batch_no: str = None,
                       status: str = None, warehouse_code: str = None) -> List[Dict]:
        query = self.db.query(InventoryFreeze, Sku).join(
            Sku, InventoryFreeze.sku_id == Sku.sku_id
        )
        
        if sku_id:
            query = query.filter(InventoryFreeze.sku_id == sku_id)
        if batch_no:
            query = query.filter(InventoryFreeze.batch_no == batch_no)
        if status:
            query = query.filter(InventoryFreeze.status == status)
        if warehouse_code:
            query = query.filter(InventoryFreeze.warehouse_code == warehouse_code)
        
        results = []
        for freeze, sku in query.all():
            results.append({
                'freeze_id': freeze.freeze_id,
                'freeze_no': freeze.freeze_no,
                'sku_id': freeze.sku_id,
                'sku_name': sku.sku_name,
                'batch_no': freeze.batch_no,
                'warehouse_code': freeze.warehouse_code,
                'reason_code': freeze.reason_code,
                'reason_name': freeze.reason_name,
                'freeze_qty': float(freeze.freeze_qty),
                'freeze_operator': freeze.freeze_operator,
                'freeze_time': freeze.freeze_time.strftime('%Y-%m-%d %H:%M:%S') if freeze.freeze_time else None,
                'status': freeze.status,
                'status_name': FREEZE_STATUS.get(freeze.status, freeze.status)
            })
        return results
    
    def get_freeze_detail(self, freeze_id: str) -> Optional[Dict]:
        freeze = self.db.query(InventoryFreeze).filter(InventoryFreeze.freeze_id == freeze_id).first()
        if not freeze:
            return None
        
        sku = self.db.query(Sku).filter(Sku.sku_id == freeze.sku_id).first()
        batch = self.db.query(BatchInventory).filter(BatchInventory.batch_id == freeze.batch_id).first()
        
        return {
            'freeze_id': freeze.freeze_id,
            'freeze_no': freeze.freeze_no,
            'sku_id': freeze.sku_id,
            'sku_name': sku.sku_name if sku else None,
            'batch_id': freeze.batch_id,
            'batch_no': freeze.batch_no,
            'warehouse_code': freeze.warehouse_code,
            'warehouse_name': batch.warehouse_name if batch else None,
            'reason_code': freeze.reason_code,
            'reason_name': freeze.reason_name,
            'freeze_qty': float(freeze.freeze_qty),
            'released_qty': self._get_released_qty(freeze_id),
            'freeze_operator': freeze.freeze_operator,
            'freeze_time': freeze.freeze_time.strftime('%Y-%m-%d %H:%M:%S') if freeze.freeze_time else None,
            'freeze_remark': freeze.freeze_remark,
            'evidence_attachments': freeze.evidence_attachments,
            'status': freeze.status,
            'status_name': FREEZE_STATUS.get(freeze.status, freeze.status),
            'release_audit_operator': freeze.release_audit_operator,
            'release_audit_time': freeze.release_audit_time.strftime('%Y-%m-%d %H:%M:%S') if freeze.release_audit_time else None,
            'release_audit_remark': freeze.release_audit_remark
        }
    
    def get_operation_history(self, business_type: str = None, business_id: str = None,
                             business_no: str = None) -> List[Dict]:
        query = self.db.query(OperationHistory)
        if business_type:
            query = query.filter(OperationHistory.business_type == business_type)
        if business_id:
            query = query.filter(OperationHistory.business_id == business_id)
        if business_no:
            query = query.filter(OperationHistory.business_no == business_no)
        
        query = query.order_by(OperationHistory.operate_time.desc())
        
        results = []
        for history in query.all():
            results.append({
                'history_id': history.history_id,
                'business_type': history.business_type,
                'business_no': history.business_no,
                'action': history.action,
                'operator': history.operator,
                'operate_time': history.operate_time.strftime('%Y-%m-%d %H:%M:%S'),
                'remark': history.remark,
                'before_data': history.before_data,
                'after_data': history.after_data
            })
        return results
    
    def get_conflict_list(self, status: str = None, conflict_type: str = None,
                         handle_result: str = None) -> List[Dict]:
        query = self.db.query(InventoryConflict, Sku).join(
            Sku, InventoryConflict.sku_id == Sku.sku_id
        )
        
        if status:
            query = query.filter(InventoryConflict.status == status)
        if conflict_type:
            query = query.filter(InventoryConflict.conflict_type == conflict_type)
        if handle_result:
            query = query.filter(InventoryConflict.handle_result == handle_result)
        
        query = query.order_by(InventoryConflict.created_at.desc())
        
        results = []
        for conflict, sku in query.all():
            results.append({
                'conflict_id': conflict.conflict_id,
                'conflict_no': conflict.conflict_no,
                'conflict_type': conflict.conflict_type,
                'conflict_type_name': CONFLICT_TYPE.get(conflict.conflict_type, conflict.conflict_type),
                'sku_id': conflict.sku_id,
                'sku_name': sku.sku_name,
                'batch_no': conflict.batch_no,
                'warehouse_code': conflict.warehouse_code,
                'related_order_no': conflict.related_order_no,
                'related_order_type': conflict.related_order_type,
                'conflict_qty': float(conflict.conflict_qty) if conflict.conflict_qty else None,
                'quality_status': conflict.quality_status,
                'quality_status_name': QUALITY_STATUS.get(conflict.quality_status, conflict.quality_status) if conflict.quality_status else None,
                'conflict_detail': conflict.conflict_detail,
                'handle_result': conflict.handle_result,
                'handle_result_name': HANDLE_RESULT.get(conflict.handle_result, conflict.handle_result),
                'handler': conflict.handler,
                'handle_time': conflict.handle_time.strftime('%Y-%m-%d %H:%M:%S') if conflict.handle_time else None,
                'handle_remark': conflict.handle_remark,
                'status': conflict.status,
                'created_at': conflict.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        return results
    
    def handle_conflict(self, conflict_id: str, handler: str, handle_result: str,
                       handle_remark: str = None) -> Dict[str, Any]:
        conflict = self.db.query(InventoryConflict).filter(InventoryConflict.conflict_id == conflict_id).first()
        if not conflict:
            return {'success': False, 'message': '冲突记录不存在'}
        
        conflict.handler = handler
        conflict.handle_time = datetime.now()
        conflict.handle_result = handle_result
        conflict.handle_remark = handle_remark
        conflict.status = 'CLOSED'
        
        self._create_operation_history(
            business_type='CONFLICT',
            business_id=conflict.conflict_id,
            business_no=conflict.conflict_no,
            action='HANDLE_CONFLICT',
            operator=handler,
            before_data={'handle_result': 'PENDING', 'status': 'OPEN'},
            after_data={'handle_result': handle_result, 'status': 'CLOSED'},
            remark=handle_remark
        )
        
        self.db.commit()
        return {'success': True, 'message': '冲突处理成功'}
