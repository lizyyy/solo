from datetime import datetime, timedelta, date, time
from typing import List, Dict, Any, Optional, Tuple
import heapq

PRIORITY_MAP = {'紧急': 0, '高': 1, '中': 2, '低': 3}

class SchedulingEngine:
    def __init__(self):
        self.orders = []
        self.calendar = {}
        self.materials = {}
        self.changeover_matrix = {}
        self.schedule = []
        self.warnings = []
        self.stats = {}

    def load_data(self, orders: List[Dict], calendar: Dict, 
                  materials: Dict[str, datetime], matrix: Dict[str, Dict[str, int]]):
        self.orders = orders
        self.calendar = calendar
        self.materials = materials
        self.changeover_matrix = matrix
        self.schedule = []
        self.warnings = []
        self.stats = {}

    def get_next_available_time(self, current_time: datetime) -> datetime:
        work_periods = sorted(self.calendar['工作时段'], 
                            key=lambda x: (x['日期'], x['开始时间']))
        
        for period in work_periods:
            period_start = datetime.combine(period['日期'], period['开始时间'])
            period_end = datetime.combine(period['日期'], period['结束时间'])
            
            if period_end <= current_time:
                continue
            
            if current_time < period_start:
                return period_start
            
            return current_time
        
        return None

    def get_changeover_time(self, current_product: str, next_product: str) -> int:
        if current_product in self.changeover_matrix and next_product in self.changeover_matrix[current_product]:
            return self.changeover_matrix[current_product][next_product]
        return 60

    def can_fit_in_period(self, start_time: datetime, duration_minutes: int, 
                          period_start: datetime, period_end: datetime) -> Tuple[bool, int]:
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        if end_time <= period_end:
            return True, duration_minutes
        
        available = (period_end - start_time).total_seconds() / 60
        return False, max(0, int(available))

    def schedule_order(self, order: Dict[str, Any], current_time: datetime, 
                       last_product: str) -> Tuple[datetime, str, Dict[str, Any]]:
        product = order['产品型号']
        process_time = order['工艺时间(分钟)']
        material_ready_time = self.materials.get(product, current_time)
        
        changeover_time = self.get_changeover_time(last_product, product)
        
        start_time = max(current_time + timedelta(minutes=changeover_time), material_ready_time)
        start_time = self.get_next_available_time(start_time)
        
        if start_time is None:
            self.warnings.append(f"订单 {order['订单号']} 无法安排：无可用工作时间")
            return None, last_product, None

        schedule_entry = {
            '订单号': order['订单号'],
            '产品型号': product,
            '数量': order['数量'],
            '优先级': order['优先级'],
            '交货日期': order['交货日期'],
            '换线时间(分钟)': changeover_time,
            '工艺时间(分钟)': process_time,
            '排程开始时间': start_time,
            '排程结束时间': None,
            '实际结束时间': None,
            '延误时间(分钟)': 0,
            '加班时间(分钟)': 0,
            '跨天': False,
            '排程说明': []
        }

        if material_ready_time > current_time:
            schedule_entry['排程说明'].append(f"等待物料到齐: {material_ready_time.strftime('%Y-%m-%d %H:%M')}")

        work_periods = sorted(self.calendar['工作时段'], 
                            key=lambda x: (x['日期'], x['开始时间']))
        
        remaining_time = process_time
        current_start = start_time
        total_overtime = 0
        
        for period in work_periods:
            if remaining_time <= 0:
                break
                
            period_start = datetime.combine(period['日期'], period['开始时间'])
            period_end = datetime.combine(period['日期'], period['结束时间'])
            
            if current_start >= period_end:
                continue
            
            actual_start = max(current_start, period_start)
            
            if actual_start.date() != start_time.date():
                schedule_entry['跨天'] = True
                schedule_entry['排程说明'].append(f"跨天生产: {actual_start.date()}")
            
            can_fit, fit_time = self.can_fit_in_period(actual_start, remaining_time, period_start, period_end)
            
            if fit_time > 0:
                remaining_time -= fit_time
                current_start = actual_start + timedelta(minutes=fit_time)
                
                if current_start > period_end:
                    overtime = (current_start - period_end).total_seconds() / 60
                    total_overtime += overtime
                    schedule_entry['排程说明'].append(f"加班 {overtime:.0f} 分钟")
        
        schedule_entry['实际结束时间'] = current_start
        schedule_entry['加班时间(分钟)'] = total_overtime
        
        delivery_datetime = datetime.combine(order['交货日期'].date(), time(18, 0))
        if current_start > delivery_datetime:
            delay = (current_start - delivery_datetime).total_seconds() / 60
            schedule_entry['延误时间(分钟)'] = delay
            schedule_entry['排程说明'].append(f"预计延误 {delay:.0f} 分钟")
        
        schedule_entry['排程结束时间'] = current_start
        
        return current_start, product, schedule_entry

    def run_scheduling(self) -> Tuple[List[Dict], List[str], Dict]:
        sorted_orders = sorted(self.orders, key=lambda x: PRIORITY_MAP[x['优先级']])
        
        current_time = None
        work_periods = sorted(self.calendar['工作时段'], 
                            key=lambda x: (x['日期'], x['开始时间']))
        if work_periods:
            first_period = work_periods[0]
            current_time = datetime.combine(first_period['日期'], first_period['开始时间'])
        
        last_product = '开始'
        
        for order in sorted_orders:
            if current_time is None:
                break
                
            current_time, last_product, entry = self.schedule_order(order, current_time, last_product)
            if entry:
                self.schedule.append(entry)
        
        self.calculate_stats()
        
        return self.schedule, self.warnings, self.stats

    def calculate_stats(self):
        total_orders = len(self.schedule)
        delayed_orders = sum(1 for s in self.schedule if s['延误时间(分钟)'] > 0)
        total_overtime = sum(s['加班时间(分钟)'] for s in self.schedule)
        total_delay = sum(s['延误时间(分钟)'] for s in self.schedule)
        total_changeover = sum(s['换线时间(分钟)'] for s in self.schedule)
        total_process = sum(s['工艺时间(分钟)'] for s in self.schedule)
        cross_day_count = sum(1 for s in self.schedule if s['跨天'])
        
        self.stats = {
            '总订单数': total_orders,
            '延误订单数': delayed_orders,
            '延误率': (delayed_orders / total_orders * 100) if total_orders > 0 else 0,
            '总加班时间(分钟)': total_overtime,
            '总延误时间(分钟)': total_delay,
            '总换线时间(分钟)': total_changeover,
            '总工艺时间(分钟)': total_process,
            '跨天生产订单数': cross_day_count,
            '排程开始时间': self.schedule[0]['排程开始时间'] if self.schedule else None,
            '排程结束时间': self.schedule[-1]['实际结束时间'] if self.schedule else None
        }