# -*- coding: utf-8 -*-
"""
数据导入导出模块
"""

import csv
import json
from datetime import datetime, date, time
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    Ship, WorkOrder, DockSlot, LiftResource, CraftSchedule, TideWindow,
    DockType, LiftType, CraftType
)


class DataImporter:
    """数据导入器"""
    
    def __init__(self):
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
    
    def _parse_datetime(self, value: str) -> Optional[datetime]:
        """解析日期时间"""
        if not value:
            return None
        formats = [
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y-%m-%d'
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        return None
    
    def _parse_date(self, value: str) -> Optional[date]:
        """解析日期"""
        if not value:
            return None
        formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt).date()
            except ValueError:
                continue
        return None
    
    def _parse_time(self, value: str) -> Optional[time]:
        """解析时间"""
        if not value:
            return None
        formats = ['%H:%M', '%H:%M:%S', '%H%M']
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt).time()
            except ValueError:
                continue
        return None
    
    def _parse_dock_type(self, value: str) -> Optional[DockType]:
        """解析坞位类型"""
        if not value:
            return None
        value = value.strip()
        mapping = {
            '干船坞': DockType.GRAVING,
            'GRAVING': DockType.GRAVING,
            '浮船坞': DockType.FLOATING,
            'FLOATING': DockType.FLOATING,
            '船台': DockType.SLIPWAY,
            'SLIPWAY': DockType.SLIPWAY
        }
        return mapping.get(value)
    
    def _parse_lift_type(self, value: str) -> Optional[LiftType]:
        """解析吊装类型"""
        if not value:
            return None
        value = value.strip()
        mapping = {
            '龙门吊': LiftType.GANTRY,
            'GANTRY': LiftType.GANTRY,
            '浮吊': LiftType.FLOATING,
            'FLOATING': LiftType.FLOATING,
            '移动吊': LiftType.TRAVELING,
            'TRAVELING': LiftType.TRAVELING
        }
        return mapping.get(value)
    
    def _parse_craft_type(self, value: str) -> Optional[CraftType]:
        """解析工种类型"""
        if not value:
            return None
        value = value.strip()
        mapping = {
            '电工': CraftType.ELECTRICIAN,
            'ELECTRICIAN': CraftType.ELECTRICIAN,
            '焊工': CraftType.WELDER,
            'WELDER': CraftType.WELDER,
            '钳工': CraftType.FITTER,
            'FITTER': CraftType.FITTER,
            '油漆工': CraftType.PAINTER,
            'PAINTER': CraftType.PAINTER,
            '起重工': CraftType.RIGGER,
            'RIGGER': CraftType.RIGGER,
            '机修工': CraftType.MECHANIC,
            'MECHANIC': CraftType.MECHANIC
        }
        return mapping.get(value)
    
    def import_work_orders_csv(
        self,
        file_path: str
    ) -> Tuple[List[WorkOrder], List[Dict[str, Any]]]:
        """从CSV导入工单"""
        work_orders = []
        bad_rows = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    ship = Ship(
                        name=row.get('ship_name', '').strip(),
                        imo_number=row.get('imo_number', '').strip(),
                        length=float(row.get('ship_length', 0) or 0),
                        width=float(row.get('ship_width', 0) or 0),
                        depth=float(row.get('ship_depth', 0) or 0),
                        vessel_type=row.get('vessel_type', '').strip()
                    )
                    
                    required_lift_types = []
                    lift_types_str = row.get('required_lift_types', '').strip()
                    for t in lift_types_str.split(';'):
                        lift_type = self._parse_lift_type(t)
                        if lift_type:
                            required_lift_types.append(lift_type)
                    
                    required_crafts = []
                    crafts_str = row.get('required_crafts', '').strip()
                    for c in crafts_str.split(';'):
                        craft = self._parse_craft_type(c)
                        if craft:
                            required_crafts.append(craft)
                    
                    work_types = [w.strip() for w in row.get('work_types', '').split(';') if w.strip()]
                    
                    order = WorkOrder(
                        order_id=row.get('order_id', '').strip(),
                        ship=ship,
                        work_description=row.get('work_description', '').strip(),
                        work_types=work_types,
                        priority=int(row.get('priority', 1) or 1),
                        estimated_duration_hours=float(row.get('estimated_duration_hours', 8) or 8),
                        required_dock_type=self._parse_dock_type(row.get('required_dock_type', '')) or DockType.GRAVING,
                        required_lift_types=required_lift_types,
                        required_crafts=required_crafts,
                        earliest_start=self._parse_datetime(row.get('earliest_start', '')),
                        latest_deadline=self._parse_datetime(row.get('latest_deadline', ''))
                    )
                    
                    if not order.order_id or not ship.name:
                        bad_rows.append({
                            'row': row_num,
                            'order_id': order.order_id,
                            'reason': '工单ID或船名不能为空'
                        })
                        continue
                    
                    work_orders.append(order)
                    
                except Exception as e:
                    bad_rows.append({
                        'row': row_num,
                        'order_id': row.get('order_id', '未知'),
                        'reason': f'解析错误: {str(e)}'
                    })
        
        return work_orders, bad_rows
    
    def import_dock_slots_csv(
        self,
        file_path: str
    ) -> Tuple[List[DockSlot], List[Dict[str, Any]]]:
        """从CSV导入坞位"""
        dock_slots = []
        bad_rows = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    dock_type = self._parse_dock_type(row.get('dock_type', ''))
                    if not dock_type:
                        bad_rows.append({
                            'row': row_num,
                            'dock_id': row.get('dock_id', '未知'),
                            'reason': '无效的坞位类型'
                        })
                        continue
                    
                    start_time = self._parse_datetime(row.get('start_time', ''))
                    end_time = self._parse_datetime(row.get('end_time', ''))
                    
                    if not start_time or not end_time:
                        bad_rows.append({
                            'row': row_num,
                            'dock_id': row.get('dock_id', '未知'),
                            'reason': '开始时间或结束时间不能为空'
                        })
                        continue
                    
                    slot = DockSlot(
                        dock_id=row.get('dock_id', '').strip(),
                        dock_name=row.get('dock_name', '').strip(),
                        dock_type=dock_type,
                        max_length=float(row.get('max_length', 0) or 0),
                        max_width=float(row.get('max_width', 0) or 0),
                        start_time=start_time,
                        end_time=end_time,
                        capacity=int(row.get('capacity', 1) or 1)
                    )
                    
                    dock_slots.append(slot)
                    
                except Exception as e:
                    bad_rows.append({
                        'row': row_num,
                        'dock_id': row.get('dock_id', '未知'),
                        'reason': f'解析错误: {str(e)}'
                    })
        
        return dock_slots, bad_rows
    
    def import_lift_resources_csv(
        self,
        file_path: str
    ) -> Tuple[List[LiftResource], List[Dict[str, Any]]]:
        """从CSV导入吊装资源"""
        lifts = []
        bad_rows = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    lift_type = self._parse_lift_type(row.get('lift_type', ''))
                    if not lift_type:
                        bad_rows.append({
                            'row': row_num,
                            'lift_id': row.get('lift_id', '未知'),
                            'reason': '无效的吊装类型'
                        })
                        continue
                    
                    lift = LiftResource(
                        lift_id=row.get('lift_id', '').strip(),
                        lift_name=row.get('lift_name', '').strip(),
                        lift_type=lift_type,
                        capacity_ton=float(row.get('capacity_ton', 0) or 0)
                    )
                    
                    lifts.append(lift)
                    
                except Exception as e:
                    bad_rows.append({
                        'row': row_num,
                        'lift_id': row.get('lift_id', '未知'),
                        'reason': f'解析错误: {str(e)}'
                    })
        
        return lifts, bad_rows
    
    def import_craft_schedules_csv(
        self,
        file_path: str
    ) -> Tuple[Dict[CraftType, CraftSchedule], List[Dict[str, Any]]]:
        """从CSV导入工种排班"""
        schedules: Dict[CraftType, CraftSchedule] = {}
        bad_rows = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    craft_type = self._parse_craft_type(row.get('craft_type', ''))
                    if not craft_type:
                        bad_rows.append({
                            'row': row_num,
                            'craft_type': row.get('craft_type', '未知'),
                            'reason': '无效的工种类型'
                        })
                        continue
                    
                    if craft_type not in schedules:
                        schedules[craft_type] = CraftSchedule(craft_type=craft_type)
                    
                    worker_id = row.get('worker_id', '').strip()
                    if worker_id:
                        schedules[craft_type].workers.append({
                            'id': worker_id,
                            'name': row.get('worker_name', '').strip()
                        })
                    
                except Exception as e:
                    bad_rows.append({
                        'row': row_num,
                        'craft_type': row.get('craft_type', '未知'),
                        'reason': f'解析错误: {str(e)}'
                    })
        
        return schedules, bad_rows
    
    def import_tide_windows_csv(
        self,
        file_path: str
    ) -> Tuple[List[TideWindow], List[Dict[str, Any]]]:
        """从CSV导入潮汐窗口"""
        tides = []
        bad_rows = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    tide_date = self._parse_date(row.get('date', ''))
                    if not tide_date:
                        bad_rows.append({
                            'row': row_num,
                            'reason': '日期格式无效'
                        })
                        continue
                    
                    high_tide = self._parse_time(row.get('high_tide_time', ''))
                    low_tide = self._parse_time(row.get('low_tide_time', ''))
                    
                    if not high_tide or not low_tide:
                        bad_rows.append({
                            'row': row_num,
                            'date': row.get('date', ''),
                            'reason': '高潮时间或低潮时间不能为空'
                        })
                        continue
                    
                    tide = TideWindow(
                        date=tide_date,
                        high_tide_time=high_tide,
                        low_tide_time=low_tide,
                        min_depth_for_entry=float(row.get('min_depth_for_entry', 8) or 8),
                        min_depth_for_exit=float(row.get('min_depth_for_exit', 8) or 8)
                    )
                    
                    tides.append(tide)
                    
                except Exception as e:
                    bad_rows.append({
                        'row': row_num,
                        'reason': f'解析错误: {str(e)}'
                    })
        
        return tides, bad_rows


class DataExporter:
    """数据导出器"""
    
    def export_schedule_csv(
        self,
        result,
        output_path: str
    ) -> str:
        """导出排程结果到CSV"""
        from .models import WorkOrderStatus
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '工单ID', '船名', 'IMO编号', '工作描述',
                '状态', '优先级', '预计工时(h)',
                '坞位', '吊装资源', '工种分配',
                '计划开始', '计划结束', '冲突说明'
            ])
            
            for assignment in result.successful_assignments:
                lift_str = ';'.join(assignment.lift_ids)
                craft_str = ';'.join([
                    f"{k}:{','.join(v)}"
                    for k, v in assignment.craft_assignments.items()
                ])
                writer.writerow([
                    assignment.order_id,
                    '', '', '',
                    '已排程', '', '',
                    assignment.dock_name,
                    lift_str,
                    craft_str,
                    assignment.start_time.strftime('%Y-%m-%d %H:%M'),
                    assignment.end_time.strftime('%Y-%m-%d %H:%M'),
                    ''
                ])
            
            for conflict in result.conflicts:
                writer.writerow([
                    conflict['order_id'],
                    conflict['ship_name'],
                    '', '',
                    '冲突', '', '',
                    '', '', '',
                    '', '',
                    ';'.join(conflict['conflicts'])
                ])
            
            for review in result.need_review_rows:
                writer.writerow([
                    review['order_id'],
                    review['ship_name'],
                    '', '',
                    '待人工确认', '', '',
                    '', '', '',
                    '', '',
                    review['reason']
                ])
        
        return output_path
    
    def export_json(
        self,
        data: Dict[str, Any],
        output_path: str
    ) -> str:
        """导出JSON"""
        def default(obj):
            if isinstance(obj, datetime):
                return obj.strftime('%Y-%m-%d %H:%M:%S')
            if isinstance(obj, date):
                return obj.strftime('%Y-%m-%d')
            if isinstance(obj, time):
                return obj.strftime('%H:%M:%S')
            raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=default)
        
        return output_path
