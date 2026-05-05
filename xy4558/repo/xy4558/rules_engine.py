#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站规则引擎
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from models import DataStore, Deceased, Cabinet, TransportOrder, TemperatureRecord, FarewellBooking, CremationSchedule
import uuid


class RulesEngine:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
        self.risks: List[Dict[str, Any]] = []
        
        self.config = {
            'max_cold_storage_days': 15,
            'min_temp': -18.0,
            'max_temp': -15.0,
            'required_documents': ['死亡证明', '身份证复印件', '火化申请表', '委托书']
        }
    
    def reset(self):
        self.risks = []
    
    def check_all(self):
        self.check_cabinet_conflicts()
        self.check_temperature_violations()
        self.check_cold_storage_timeout()
        self.check_missing_documents()
        self.check_schedule_conflicts()
        self.check_unsigned_transfers()
    
    def add_risk(self, risk_type: str, deceased_name: str, info: str, level: str,
                  description: str = "") -> str:
        risk_id = str(uuid.uuid4())[:8]
        risk = {
            'id': risk_id,
            'type': risk_type,
            'deceased_name': deceased_name,
            'info': info,
            'level': level,
            'description': description,
            'status': '待处理',
            'review_note': '',
            'detected_time': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.risks.append(risk)
        return risk_id
    
    def check_cabinet_conflicts(self):
        cabinet_to_deceased: Dict[str, List[str]] = {}
        
        for deceased in self.data_store.deceased.values():
            if deceased.cabinet_id:
                if deceased.cabinet_id not in cabinet_to_deceased:
                    cabinet_to_deceased[deceased.cabinet_id] = []
                cabinet_to_deceased[deceased.cabinet_id].append(deceased.name)
        
        for cabinet_id, names in cabinet_to_deceased.items():
            if len(names) > 1:
                self.add_risk(
                    risk_type='柜位串号',
                    deceased_name=', '.join(names),
                    info=f'柜位 {cabinet_id} 分配给 {len(names)} 位逝者',
                    level='高',
                    description=f'柜位 {cabinet_id} 同时分配给以下逝者: {", ".join(names)}。请核实正确的柜位分配。'
                )
    
    def check_temperature_violations(self):
        for cabinet in self.data_store.cabinets.values():
            latest_temp = self.data_store.get_latest_temperature(cabinet.cabinet_id)
            if latest_temp:
                min_temp = cabinet.min_temp
                max_temp = cabinet.max_temp
                
                if latest_temp.temperature > max_temp:
                    deceased = self.data_store.get_deceased_by_cabinet(cabinet.cabinet_id)
                    self.add_risk(
                        risk_type='温度超限',
                        deceased_name=deceased.name if deceased else '无逝者',
                        info=f'柜位 {cabinet.cabinet_id}: {latest_temp.temperature}°C > {max_temp}°C',
                        level='高',
                        description=f'柜位 {cabinet.cabinet_id} 温度过高！当前温度 {latest_temp.temperature}°C，'
                                   f'正常范围应为 {min_temp}°C 至 {max_temp}°C。'
                                   f'记录时间: {latest_temp.record_time}，记录人: {latest_temp.recorded_by}'
                    )
                elif latest_temp.temperature < min_temp:
                    deceased = self.data_store.get_deceased_by_cabinet(cabinet.cabinet_id)
                    self.add_risk(
                        risk_type='温度超限',
                        deceased_name=deceased.name if deceased else '无逝者',
                        info=f'柜位 {cabinet.cabinet_id}: {latest_temp.temperature}°C < {min_temp}°C',
                        level='中',
                        description=f'柜位 {cabinet.cabinet_id} 温度过低！当前温度 {latest_temp.temperature}°C，'
                                   f'正常范围应为 {min_temp}°C 至 {max_temp}°C。'
                                   f'记录时间: {latest_temp.record_time}，记录人: {latest_temp.recorded_by}'
                    )
    
    def check_cold_storage_timeout(self):
        max_days = self.config['max_cold_storage_days']
        
        for deceased in self.data_store.deceased.values():
            if deceased.cabinet_id:
                try:
                    death_date = datetime.strptime(deceased.date_of_death, "%Y-%m-%d")
                    today = datetime.now()
                    storage_days = (today - death_date).days
                    
                    if storage_days > max_days:
                        self.add_risk(
                            risk_type='冷藏超时',
                            deceased_name=deceased.name,
                            info=f'已冷藏 {storage_days} 天 > 规定 {max_days} 天',
                            level='高',
                            description=f'逝者 {deceased.name} 已冷藏 {storage_days} 天，'
                                       f'超过规定的 {max_days} 天时限。'
                                       f'死亡日期: {deceased.date_of_death}，柜位: {deceased.cabinet_id}'
                        )
                    elif storage_days >= max_days - 2:
                        self.add_risk(
                            risk_type='冷藏预警',
                            deceased_name=deceased.name,
                            info=f'即将超时: 已冷藏 {storage_days} 天',
                            level='中',
                            description=f'逝者 {deceased.name} 已冷藏 {storage_days} 天，'
                                       f'即将达到 {max_days} 天时限。'
                                       f'死亡日期: {deceased.date_of_death}，柜位: {deceased.cabinet_id}'
                        )
                except (ValueError, TypeError):
                    pass
    
    def check_missing_documents(self):
        for deceased in self.data_store.deceased.values():
            missing = self.data_store.get_missing_documents(deceased.deceased_id)
            if missing:
                self.add_risk(
                    risk_type='证件缺失',
                    deceased_name=deceased.name,
                    info=f'缺失 {len(missing)} 项证件',
                    level='中',
                    description=f'逝者 {deceased.name} 缺少以下证件: {", ".join(missing)}。'
                               f'请联系家属尽快补交。'
                )
    
    def check_schedule_conflicts(self):
        self.check_farewell_conflicts()
        self.check_cremation_conflicts()
        self.check_cross_service_conflicts()
    
    def check_farewell_conflicts(self):
        hall_to_bookings: Dict[str, List[FarewellBooking]] = {}
        
        for booking in self.data_store.farewell_bookings.values():
            if booking.status == '已预约':
                if booking.hall_id not in hall_to_bookings:
                    hall_to_bookings[booking.hall_id] = []
                hall_to_bookings[booking.hall_id].append(booking)
        
        for hall_id, bookings in hall_to_bookings.items():
            bookings.sort(key=lambda x: (x.date, x.start_time))
            for i, booking in enumerate(bookings):
                for j, other_booking in enumerate(bookings):
                    if i >= j:
                        continue
                    
                    if booking.date == other_booking.date:
                        conflict = self.check_time_overlap(
                            booking.start_time, booking.end_time,
                            other_booking.start_time, other_booking.end_time
                        )
                        
                        if conflict:
                            self.add_risk(
                                risk_type='排期冲突',
                                deceased_name=f'{booking.deceased_name} & {other_booking.deceased_name}',
                                info=f'告别厅 {hall_id} {booking.date} 时段冲突',
                                level='高',
                                description=f'告别厅 {hall_id} 在 {booking.date} 存在时段冲突：\n'
                                           f'- {booking.deceased_name}: {booking.start_time}-{booking.end_time}\n'
                                           f'- {other_booking.deceased_name}: {other_booking.start_time}-{other_booking.end_time}'
                            )
    
    def check_cremation_conflicts(self):
        furnace_to_schedules: Dict[str, List[CremationSchedule]] = {}
        
        for schedule in self.data_store.cremation_schedules.values():
            if schedule.status == '已排期':
                if schedule.furnace_id not in furnace_to_schedules:
                    furnace_to_schedules[schedule.furnace_id] = []
                furnace_to_schedules[schedule.furnace_id].append(schedule)
        
        for furnace_id, schedules in furnace_to_schedules.items():
            schedules.sort(key=lambda x: (x.date, x.start_time))
            for i, schedule in enumerate(schedules):
                for j, other_schedule in enumerate(schedules):
                    if i >= j:
                        continue
                    
                    if schedule.date == other_schedule.date:
                        conflict = self.check_time_overlap(
                            schedule.start_time, schedule.end_time,
                            other_schedule.start_time, other_schedule.end_time
                        )
                        
                        if conflict:
                            self.add_risk(
                                risk_type='排期冲突',
                                deceased_name=f'{schedule.deceased_name} & {other_schedule.deceased_name}',
                                info=f'火化炉 {furnace_id} {schedule.date} 时段冲突',
                                level='高',
                                description=f'火化炉 {furnace_id} 在 {schedule.date} 存在时段冲突：\n'
                                           f'- {schedule.deceased_name}: {schedule.start_time}-{schedule.end_time}\n'
                                           f'- {other_schedule.deceased_name}: {other_schedule.start_time}-{other_schedule.end_time}'
                            )
    
    def check_cross_service_conflicts(self):
        for booking in self.data_store.farewell_bookings.values():
            if booking.status != '已预约':
                continue
            
            for schedule in self.data_store.cremation_schedules.values():
                if schedule.status != '已排期':
                    continue
                
                if booking.deceased_id == schedule.deceased_id and booking.date == schedule.date:
                    farewell_end = self.time_to_minutes(booking.end_time)
                    cremation_start = self.time_to_minutes(schedule.start_time)
                    
                    if cremation_start < farewell_end:
                        self.add_risk(
                            risk_type='服务冲突',
                            deceased_name=booking.deceased_name,
                            info=f'{booking.date} 告别仪式与火化时间冲突',
                            level='高',
                            description=f'逝者 {booking.deceased_name} 在 {booking.date} 的服务安排存在冲突：\n'
                                       f'- 告别厅仪式: {booking.start_time}-{booking.end_time}\n'
                                       f'- 火化炉排期: {schedule.start_time}-{schedule.end_time}\n'
                                       f'火化时间早于告别仪式结束时间！'
                        )
    
    def check_time_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        s1 = self.time_to_minutes(start1)
        e1 = self.time_to_minutes(end1)
        s2 = self.time_to_minutes(start2)
        e2 = self.time_to_minutes(end2)
        
        return s1 < e2 and s2 < e1
    
    def time_to_minutes(self, time_str: str) -> int:
        try:
            h, m = map(int, time_str.split(':'))
            return h * 60 + m
        except (ValueError, IndexError):
            return 0
    
    def check_unsigned_transfers(self):
        for order in self.data_store.transport_orders.values():
            if order.signature_status == '未签收':
                self.add_risk(
                    risk_type='交接漏签',
                    deceased_name=order.deceased_name,
                    info=f'接运单 {order.order_id} 未签收',
                    level='中',
                    description=f'接运单 {order.order_id} 尚未完成交接签收。\n'
                               f'逝者: {order.deceased_name}\n'
                               f'接运人员: {order.transport_person} ({order.transport_phone})\n'
                               f'接运时间: {order.pickup_time}\n'
                               f'当前状态: {order.signature_status}'
                )
            elif order.signature_status == '部分签收':
                self.add_risk(
                    risk_type='交接漏签',
                    deceased_name=order.deceased_name,
                    info=f'接运单 {order.order_id} 部分签收',
                    level='低',
                    description=f'接运单 {order.order_id} 为部分签收状态。\n'
                               f'逝者: {order.deceased_name}\n'
                               f'接收人: {order.received_by or "未填写"}\n'
                               f'接收时间: {order.received_time or "未填写"}'
                )
    
    def get_risks(self) -> List[Dict[str, Any]]:
        return sorted(self.risks, key=lambda x: {
            '高': 0,
            '中': 1,
            '低': 2
        }.get(x['level'], 3))
    
    def get_risk_by_id(self, risk_id: str) -> Optional[Dict[str, Any]]:
        for risk in self.risks:
            if risk['id'] == risk_id:
                return risk
        return None
    
    def update_risk_review(self, risk_id: str, note: str, status: str) -> bool:
        risk = self.get_risk_by_id(risk_id)
        if risk:
            risk['review_note'] = note
            risk['status'] = status
            return True
        return False
    
    def get_config(self) -> Dict[str, Any]:
        return self.config.copy()
    
    def update_config(self, key: str, value: Any) -> bool:
        if key in self.config:
            self.config[key] = value
            return True
        return False
    
    def get_risk_statistics(self) -> Dict[str, Any]:
        stats = {
            'total': len(self.risks),
            'by_level': {
                '高': 0,
                '中': 0,
                '低': 0
            },
            'by_type': {},
            'by_status': {
                '待处理': 0,
                '处理中': 0,
                '已处理': 0,
                '无需处理': 0
            }
        }
        
        for risk in self.risks:
            level = risk['level']
            if level in stats['by_level']:
                stats['by_level'][level] += 1
            
            risk_type = risk['type']
            if risk_type not in stats['by_type']:
                stats['by_type'][risk_type] = 0
            stats['by_type'][risk_type] += 1
            
            status = risk['status']
            if status in stats['by_status']:
                stats['by_status'][status] += 1
        
        return stats
