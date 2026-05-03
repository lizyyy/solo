"""
维修工单解析器
处理阀门关闭、维修计划等工单数据
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
import csv


@dataclass
class RepairOrder:
    """维修工单"""
    id: str
    order_type: str
    status: str
    target_id: str
    target_type: str
    created_at: datetime
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    description: str = ""


class RepairOrdersParser:
    """维修工单数据解析器"""
    
    def __init__(self):
        self.orders: List[RepairOrder] = []
        self._date_format = "%Y-%m-%d %H:%M:%S"
    
    def parse(self, file_path: str) -> 'RepairOrdersParser':
        """解析CSV文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                self._process_row(row)
        
        return self
    
    def _process_row(self, row: Dict):
        """处理单行数据"""
        created_at = datetime.strptime(row['created_at'], self._date_format)
        
        scheduled_start = None
        if row.get('scheduled_start'):
            scheduled_start = datetime.strptime(row['scheduled_start'], self._date_format)
        
        scheduled_end = None
        if row.get('scheduled_end'):
            scheduled_end = datetime.strptime(row['scheduled_end'], self._date_format)
        
        actual_start = None
        if row.get('actual_start'):
            actual_start = datetime.strptime(row['actual_start'], self._date_format)
        
        actual_end = None
        if row.get('actual_end'):
            actual_end = datetime.strptime(row['actual_end'], self._date_format)
        
        order = RepairOrder(
            id=str(row['order_id']),
            order_type=row.get('order_type', 'repair'),
            status=row.get('status', 'pending'),
            target_id=str(row['target_id']),
            target_type=row.get('target_type', 'pipe'),
            created_at=created_at,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            actual_start=actual_start,
            actual_end=actual_end,
            description=row.get('description', '')
        )
        
        self.orders.append(order)
    
    def validate(self) -> List[str]:
        """验证数据完整性"""
        errors = []
        
        for order in self.orders:
            if not order.target_id:
                errors.append(f"工单 {order.id}: 未指定目标设备")
            
            if order.order_type not in ['valve_close', 'repair', 'inspection', 'pressure_test']:
                errors.append(f"工单 {order.id}: 未知的工单类型 {order.order_type}")
            
            if order.status not in ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled']:
                errors.append(f"工单 {order.id}: 未知的工单状态 {order.status}")
            
            if order.scheduled_start and order.scheduled_end:
                if order.scheduled_end < order.scheduled_start:
                    errors.append(f"工单 {order.id}: 计划结束时间早于开始时间")
            
            if order.actual_start and order.actual_end:
                if order.actual_end < order.actual_start:
                    errors.append(f"工单 {order.id}: 实际结束时间早于开始时间")
        
        return errors
    
    def get_active_valve_closures(self, check_time: datetime) -> List[RepairOrder]:
        """获取指定时间点的活跃阀门关闭工单"""
        active_closures = []
        
        for order in self.orders:
            if order.order_type != 'valve_close':
                continue
            
            if order.status == 'cancelled':
                continue
            
            if order.actual_start and order.actual_end:
                if order.actual_start <= check_time <= order.actual_end:
                    active_closures.append(order)
            elif order.actual_start and not order.actual_end:
                if order.actual_start <= check_time and order.status == 'in_progress':
                    active_closures.append(order)
            elif order.scheduled_start and order.scheduled_end:
                if order.scheduled_start <= check_time <= order.scheduled_end:
                    active_closures.append(order)
        
        return active_closures
    
    def get_closed_valves_during(self, start_time: datetime, end_time: datetime) -> Dict[str, List[tuple]]:
        """获取指定时间段内关闭的阀门"""
        closed_valves = {}
        
        for order in self.orders:
            if order.order_type != 'valve_close':
                continue
            
            if order.status == 'cancelled':
                continue
            
            effective_start = order.actual_start or order.scheduled_start
            effective_end = order.actual_end or order.scheduled_end
            
            if not effective_start:
                continue
            
            if effective_end is None:
                effective_end = end_time
            
            if (effective_start <= end_time and effective_end >= start_time):
                valve_id = order.target_id
                if valve_id not in closed_valves:
                    closed_valves[valve_id] = []
                closed_valves[valve_id].append((effective_start, effective_end))
        
        return closed_valves
    
    def is_valve_closed_at(self, valve_id: str, check_time: datetime) -> bool:
        """检查指定阀门在指定时间是否关闭"""
        for order in self.orders:
            if order.order_type != 'valve_close':
                continue
            
            if order.target_id != valve_id:
                continue
            
            if order.status == 'cancelled':
                continue
            
            effective_start = order.actual_start or order.scheduled_start
            effective_end = order.actual_end or order.scheduled_end
            
            if effective_start is None:
                continue
            
            if effective_end is None:
                if effective_start <= check_time and order.status == 'in_progress':
                    return True
            else:
                if effective_start <= check_time <= effective_end:
                    return True
        
        return False
