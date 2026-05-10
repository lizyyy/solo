from datetime import date, timedelta
from typing import List, Dict, Optional, Tuple
from .models import Prop, BorrowRecord, ProblemRecord, PropStatus, BorrowStatus, DamageLevel
from .config import RULES
from .storage import Storage


class PropDepositManager:
    def __init__(self, storage: Storage):
        self.storage = storage
    
    def validate_prop_data(self, data: Dict) -> Tuple[bool, List[str]]:
        errors = []
        required_fields = ['prop_id', 'name', 'category', 'value', 'deposit_rate']
        
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"缺少必需字段: {field}")
        
        if 'value' in data and data['value'] is not None:
            try:
                value = float(data['value'])
                if value <= 0:
                    errors.append(f"道具价值必须大于0: {data['value']}")
            except (ValueError, TypeError):
                errors.append(f"道具价值必须是数字: {data['value']}")
        
        if 'deposit_rate' in data and data['deposit_rate'] is not None:
            try:
                rate = float(data['deposit_rate'])
                if rate < 0 or rate > 2:
                    errors.append(f"押金比例应在0-2之间: {data['deposit_rate']}")
            except (ValueError, TypeError):
                errors.append(f"押金比例必须是数字: {data['deposit_rate']}")
        
        if 'status' in data and data['status']:
            try:
                PropStatus(data['status'])
            except ValueError:
                errors.append(f"无效的道具状态: {data['status']}")
        
        return len(errors) == 0, errors
    
    def create_prop(self, data: Dict) -> Prop:
        valid, errors = self.validate_prop_data(data)
        if not valid:
            raise ValueError("; ".join(errors))
        
        existing = self.storage.get_prop(str(data['prop_id']))
        if existing:
            raise ValueError(f"道具ID {data['prop_id']} 已存在")
        
        prop = Prop(
            prop_id=str(data['prop_id']),
            name=str(data['name']),
            category=str(data['category']),
            value=float(data['value']),
            deposit_rate=float(data['deposit_rate']),
            status=PropStatus(data.get('status', 'available')) if data.get('status') else PropStatus.AVAILABLE,
            location=str(data.get('location', '')),
            description=str(data.get('description', ''))
        )
        
        return self.storage.add_prop(prop)
    
    def validate_borrow_data(self, data: Dict) -> Tuple[bool, List[str]]:
        errors = []
        required_fields = ['borrow_id', 'prop_id', 'crew_name', 'borrow_date', 'scheduled_return_date']
        
        for field in required_fields:
            if field not in data or not data[field]:
                errors.append(f"缺少必需字段: {field}")
        
        if 'prop_id' in data and data['prop_id']:
            prop = self.storage.get_prop(str(data['prop_id']))
            if not prop:
                errors.append(f"道具不存在: {data['prop_id']}")
            elif prop.status == PropStatus.BORROWED:
                errors.append(f"道具已被借用: {data['prop_id']}")
        
        if 'borrow_date' in data and 'scheduled_return_date' in data:
            try:
                borrow_date = date.fromisoformat(str(data['borrow_date']))
                scheduled = date.fromisoformat(str(data['scheduled_return_date']))
                if scheduled < borrow_date:
                    errors.append("计划归还日期不能早于借用日期")
            except ValueError as e:
                errors.append(f"日期格式错误: {e}")
        
        if 'deposit_paid' in data and data['deposit_paid'] is not None:
            try:
                deposit = float(data['deposit_paid'])
                if deposit < 0:
                    errors.append(f"押金金额不能为负: {data['deposit_paid']}")
            except (ValueError, TypeError):
                errors.append(f"押金金额必须是数字: {data['deposit_paid']}")
        
        return len(errors) == 0, errors
    
    def create_borrow(self, data: Dict) -> BorrowRecord:
        valid, errors = self.validate_borrow_data(data)
        if not valid:
            raise ValueError("; ".join(errors))
        
        existing = self.storage.get_borrow(str(data['borrow_id']))
        if existing:
            raise ValueError(f"借用单ID {data['borrow_id']} 已存在")
        
        prop = self.storage.get_prop(str(data['prop_id']))
        if not prop:
            raise ValueError(f"道具不存在: {data['prop_id']}")
        
        borrow_date = date.fromisoformat(str(data['borrow_date']))
        scheduled_return = date.fromisoformat(str(data['scheduled_return_date']))
        
        required_deposit = prop.required_deposit()
        deposit_paid = float(data.get('deposit_paid', 0.0))
        
        borrow = BorrowRecord(
            borrow_id=str(data['borrow_id']),
            prop_id=str(data['prop_id']),
            crew_name=str(data['crew_name']),
            borrow_date=borrow_date,
            scheduled_return_date=scheduled_return,
            required_deposit=required_deposit,
            deposit_paid=deposit_paid,
            status=BorrowStatus.PENDING if deposit_paid < required_deposit else BorrowStatus.ACTIVE
        )
        
        if borrow.status == BorrowStatus.ACTIVE:
            prop.status = PropStatus.BORROWED
            self.storage.update_prop(prop)
        
        return self.storage.add_borrow(borrow)
    
    def calculate_delay_fee(self, borrow: BorrowRecord, actual_return: date) -> float:
        if actual_return <= borrow.scheduled_return_date:
            return 0.0
        
        delay_days = (actual_return - borrow.scheduled_return_date).days
        fee = borrow.required_deposit * RULES.DELAY_FEE_RATE * delay_days
        return fee
    
    def process_return(self, borrow_id: str, actual_return_date: date, 
                      damage_level: DamageLevel = DamageLevel.NONE, 
                      damage_fee_override: Optional[float] = None,
                      delay_fee_override: Optional[float] = None) -> BorrowRecord:
        borrow = self.storage.get_borrow(borrow_id)
        if not borrow:
            raise ValueError(f"借用单不存在: {borrow_id}")
        
        if borrow.status in [BorrowStatus.SETTLED, BorrowStatus.RETURNED]:
            raise ValueError(f"借用单已处理: {borrow_id}")
        
        prop = self.storage.get_prop(borrow.prop_id)
        if not prop:
            raise ValueError(f"道具不存在: {borrow.prop_id}")
        
        borrow.actual_return_date = actual_return_date
        
        delay_fee = delay_fee_override if delay_fee_override is not None else self.calculate_delay_fee(borrow, actual_return_date)
        borrow.delay_fee = delay_fee
        
        damage_fee = damage_fee_override if damage_fee_override is not None else prop.calculate_damage_fee(damage_level)
        borrow.damage_level = damage_level
        borrow.damage_fee = damage_fee
        
        total_fees = delay_fee + damage_fee
        borrow.refund_amount = max(0, borrow.deposit_paid - total_fees)
        
        if borrow.deposit_paid >= total_fees:
            borrow.status = BorrowStatus.RETURNED
        else:
            borrow.status = BorrowStatus.RETURNED
        
        if damage_level in [DamageLevel.MAJOR, DamageLevel.TOTAL]:
            prop.status = PropStatus.MAINTENANCE
        else:
            prop.status = PropStatus.AVAILABLE
        
        self.storage.update_prop(prop)
        return self.storage.update_borrow(borrow)
    
    def settle_borrow(self, borrow_id: str, additional_payment: float = 0.0) -> BorrowRecord:
        borrow = self.storage.get_borrow(borrow_id)
        if not borrow:
            raise ValueError(f"借用单不存在: {borrow_id}")
        
        if borrow.status != BorrowStatus.RETURNED:
            raise ValueError(f"借用单未归还: {borrow_id}")
        
        borrow.deposit_paid += additional_payment
        total_fees = borrow.delay_fee + borrow.damage_fee
        borrow.refund_amount = max(0, borrow.deposit_paid - total_fees)
        borrow.status = BorrowStatus.SETTLED
        
        return self.storage.update_borrow(borrow)
    
    def check_overdue_borrows(self, check_date: Optional[date] = None) -> List[BorrowRecord]:
        check_date = check_date or date.today()
        overdue = []
        
        for borrow in self.storage.get_all_borrows():
            if borrow.status in [BorrowStatus.ACTIVE, BorrowStatus.PENDING]:
                if check_date > borrow.scheduled_return_date:
                    borrow.status = BorrowStatus.OVERDUE
                    self.storage.update_borrow(borrow)
                    overdue.append(borrow)
        
        return overdue
    
    def run_consistency_check(self) -> Dict:
        results = {
            'prop_issues': [],
            'borrow_issues': [],
            'deposit_issues': [],
            'state_inconsistencies': []
        }
        
        for prop in self.storage.get_all_props():
            active_borrows = [
                b for b in self.storage.get_borrows_by_prop(prop.prop_id)
                if b.status in [BorrowStatus.ACTIVE, BorrowStatus.PENDING, BorrowStatus.OVERDUE]
            ]
            
            if prop.status == PropStatus.BORROWED and not active_borrows:
                results['state_inconsistencies'].append({
                    'type': 'prop_state_mismatch',
                    'prop_id': prop.prop_id,
                    'message': f"道具 {prop.name} 状态为已借用但无活动借用单"
                })
            
            if prop.status != PropStatus.BORROWED and active_borrows:
                results['state_inconsistencies'].append({
                    'type': 'borrow_state_mismatch',
                    'prop_id': prop.prop_id,
                    'message': f"道具 {prop.name} 有活动借用单但状态不是已借用"
                })
        
        for borrow in self.storage.get_all_borrows():
            prop = self.storage.get_prop(borrow.prop_id)
            if not prop:
                results['borrow_issues'].append({
                    'type': 'missing_prop',
                    'borrow_id': borrow.borrow_id,
                    'message': f"借用单 {borrow.borrow_id} 引用不存在的道具 {borrow.prop_id}"
                })
                continue
            
            expected_deposit = prop.required_deposit()
            if borrow.required_deposit != expected_deposit:
                results['deposit_issues'].append({
                    'type': 'deposit_mismatch',
                    'borrow_id': borrow.borrow_id,
                    'message': f"借用单 {borrow.borrow_id} 押金金额不符: 预期 {expected_deposit}, 实际 {borrow.required_deposit}"
                })
            
            if borrow.status == BorrowStatus.RETURNED and borrow.actual_return_date:
                total_fees = borrow.delay_fee + borrow.damage_fee
                expected_refund = max(0, borrow.deposit_paid - total_fees)
                if borrow.refund_amount != expected_refund:
                    results['deposit_issues'].append({
                        'type': 'refund_mismatch',
                        'borrow_id': borrow.borrow_id,
                        'message': f"借用单 {borrow.borrow_id} 退款金额计算错误"
                    })
        
        return results
    
    def get_deposit_summary(self) -> Dict:
        summary = {
            'total_props': 0,
            'total_borrows': 0,
            'active_borrows': 0,
            'overdue_borrows': 0,
            'total_deposit_frozen': 0.0,
            'total_damage_fees': 0.0,
            'total_delay_fees': 0.0,
            'total_refunds': 0.0,
            'pending_settlements': 0
        }
        
        summary['total_props'] = len(self.storage.get_all_props())
        summary['total_borrows'] = len(self.storage.get_all_borrows())
        
        for borrow in self.storage.get_all_borrows():
            if borrow.status in [BorrowStatus.ACTIVE, BorrowStatus.PENDING, BorrowStatus.OVERDUE]:
                summary['active_borrows'] += 1
                summary['total_deposit_frozen'] += borrow.deposit_paid
            
            if borrow.status == BorrowStatus.OVERDUE:
                summary['overdue_borrows'] += 1
            
            if borrow.status in [BorrowStatus.RETURNED, BorrowStatus.SETTLED]:
                summary['total_damage_fees'] += borrow.damage_fee
                summary['total_delay_fees'] += borrow.delay_fee
                summary['total_refunds'] += borrow.refund_amount
            
            if borrow.status == BorrowStatus.RETURNED:
                summary['pending_settlements'] += 1
        
        return summary
