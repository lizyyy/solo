from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.inventory import Inventory, InventoryProcessingRecord
from app.models.recall import RecallNotice

class InventoryRulesEngine:
    def __init__(self, db: Session):
        self.db = db
        self.WARNING_DAYS = 90

    def check_recall_batch(self, batch_number: str, material_name: str) -> Tuple[bool, str]:
        active_recalls = self.db.query(RecallNotice).filter(RecallNotice.is_active == 1).all()
        
        for recall in active_recalls:
            affected_batches = [b.strip() for b in recall.affected_batches.split(',') if b.strip()]
            if batch_number in affected_batches and material_name in recall.affected_material:
                return True, f"该批次在召回范围内：{recall.title}，原因：{recall.reason}"
        return False, ""

    def check_near_expiry(self, expiry_date: datetime) -> Tuple[bool, str]:
        if not expiry_date:
            return False, ""
        days_until_expiry = (expiry_date - datetime.now()).days
        if days_until_expiry <= 0:
            return True, f"已过期（过期{abs(days_until_expiry)}天）"
        elif days_until_expiry <= self.WARNING_DAYS:
            return True, f"近效期预警：剩余{days_until_expiry}天过期"
        return False, ""

    def check_cross_store_transfer(self, batch_number: str, current_store_id: str) -> Tuple[bool, str]:
        existing = self.db.query(Inventory).filter(
            Inventory.batch_number == batch_number,
            Inventory.store_id != current_store_id,
            Inventory.is_processed == True,
            Inventory.process_status == "normal"
        ).first()
        
        if existing:
            return True, f"跨门店调拨：该批次已在门店{existing.store_name}（{existing.store_id}）入库，请确认调拨手续"
        return False, ""

    def check_duplicate_submission(self, batch_number: str, store_id: str) -> Tuple[bool, str]:
        existing = self.db.query(InventoryProcessingRecord).filter(
            InventoryProcessingRecord.batch_number == batch_number,
            InventoryProcessingRecord.store_id == store_id,
            InventoryProcessingRecord.status == "normal"
        ).first()
        
        if existing:
            return True, f"该批次已在本店处理过，请勿重复提交（处理时间：{existing.process_date.strftime('%Y-%m-%d %H:%M')}）"
        return False, ""

    def check_replacement_trace(self, replaced_batch: str) -> Tuple[bool, str, List[Dict[str, Any]]]:
        if not replaced_batch:
            return False, "", []
        
        history = []
        current_batch = replaced_batch
        max_depth = 10
        depth = 0
        
        while current_batch and depth < max_depth:
            record = self.db.query(Inventory).filter(
                Inventory.batch_number == current_batch
            ).first()
            
            if record:
                history.append({
                    'batch_number': record.batch_number,
                    'material_name': record.material_name,
                    'store_id': record.store_id,
                    'store_name': record.store_name,
                    'created_at': record.created_at.strftime('%Y-%m-%d %H:%M'),
                    'original_source': record.original_source
                })
                
                if record.replaced_batch:
                    current_batch = record.replaced_batch
                    depth += 1
                else:
                    break
            else:
                break
        
        if history:
            return True, f"该替代耗材可追溯{len(history)}条历史记录", history
        return False, "未找到该替代耗材的历史来源记录", []

    def process_inventory_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            'batch_number': item['batch_number'],
            'material_name': item['material_name'],
            'store_id': item['store_id'],
            'original_data': item.copy(),
            'status': 'normal',
            'suggestion': '',
            'failure_reason': None
        }
        
        failure_reasons = []
        suggestions = []
        
        is_duplicate, msg = self.check_duplicate_submission(item['batch_number'], item['store_id'])
        if is_duplicate:
            result['status'] = 'failed'
            failure_reasons.append(msg)
            suggestions.append("请核对该批次是否已在本店系统中存在")
        
        is_recall, msg = self.check_recall_batch(item['batch_number'], item['material_name'])
        if is_recall:
            if result['status'] == 'normal':
                result['status'] = 'pending'
            failure_reasons.append(f"召回预警：{msg}")
            suggestions.append("立即停止使用，联系供应商处理召回事宜")
        
        if 'expiry_date' in item:
            is_near_expiry, msg = self.check_near_expiry(item['expiry_date'])
            if is_near_expiry:
                if result['status'] == 'normal':
                    result['status'] = 'pending'
                failure_reasons.append(f"效期预警：{msg}")
                if "已过期" in msg:
                    suggestions.append("立即隔离并做报废处理")
                else:
                    suggestions.append("优先安排使用，避免过期损失")
        
        is_cross_store, msg = self.check_cross_store_transfer(item['batch_number'], item['store_id'])
        if is_cross_store:
            if result['status'] == 'normal':
                result['status'] = 'pending'
            failure_reasons.append(f"调拨预警：{msg}")
            suggestions.append("请确认跨门店调拨单据，完善流转记录")
        
        if item.get('is_replacement') and item.get('replaced_batch'):
            has_trace, msg, history = self.check_replacement_trace(item['replaced_batch'])
            if has_trace:
                suggestions.append(f"替代耗材追溯：{msg}，历史来源：{[h['batch_number'] for h in history]}")
                result['original_data']['replacement_history'] = history
            else:
                suggestions.append(f"替代耗材提示：{msg}")
        
        result['suggestion'] = '；'.join(suggestions) if suggestions else "正常入库"
        result['failure_reason'] = '；'.join(failure_reasons) if failure_reasons else None
        
        return result

    def process_batch(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        normal_items = []
        pending_items = []
        failed_items = []
        
        for item in items:
            result = self.process_inventory_item(item)
            
            record = InventoryProcessingRecord(
                batch_number=result['batch_number'],
                material_name=result['material_name'],
                store_id=result['store_id'],
                status=result['status'],
                original_data=str(result['original_data']),
                suggestion=result['suggestion'],
                failure_reason=result['failure_reason']
            )
            self.db.add(record)
            
            if result['status'] == 'normal':
                inventory = Inventory(
                    batch_number=item['batch_number'],
                    material_name=item['material_name'],
                    material_type=item.get('material_type'),
                    spec=item.get('spec'),
                    quantity=item['quantity'],
                    unit=item['unit'],
                    production_date=item.get('production_date'),
                    expiry_date=item.get('expiry_date'),
                    supplier=item.get('supplier'),
                    store_id=item['store_id'],
                    store_name=item.get('store_name'),
                    is_replacement=item.get('is_replacement', False),
                    replaced_batch=item.get('replaced_batch'),
                    original_source=item.get('original_source'),
                    is_processed=True,
                    process_status='normal'
                )
                self.db.add(inventory)
                normal_items.append(result)
            elif result['status'] == 'pending':
                pending_items.append(result)
            else:
                failed_items.append(result)
        
        self.db.commit()
        
        return {
            'normal_items': normal_items,
            'pending_items': pending_items,
            'failed_items': failed_items,
            'total_count': len(items),
            'normal_count': len(normal_items),
            'pending_count': len(pending_items),
            'failed_count': len(failed_items)
        }
