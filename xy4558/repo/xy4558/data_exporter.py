#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
殡仪服务站数据导出器
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from models import DataStore, Deceased, Cabinet, TransportOrder, Document, ReviewRecord


class DataExporter:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
        self.export_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def export_markdown(self, file_path: str) -> None:
        markdown_content = self._generate_markdown_handover()
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
    
    def export_json_audit(self, file_path: str) -> None:
        audit_package = self._generate_audit_package()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
    
    def _generate_markdown_handover(self) -> str:
        lines = []
        
        lines.append("# 殡仪服务站交接单")
        lines.append("")
        lines.append(f"**生成时间**: {self.export_time}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、风险概览")
        lines.append("")
        risks = self._get_risk_summary()
        lines.append(f"- **高风险**: {risks['high']} 项")
        lines.append(f"- **中风险**: {risks['medium']} 项")
        lines.append(f"- **低风险**: {risks['low']} 项")
        lines.append(f"- **总计**: {risks['total']} 项")
        lines.append("")
        
        lines.append("## 二、当前风险明细")
        lines.append("")
        
        risk_details = self._get_risk_details()
        if risk_details:
            for risk in risk_details:
                level_marker = "🔴" if risk['level'] == '高' else ("🟡" if risk['level'] == '中' else "🟢")
                lines.append(f"### {level_marker} [{risk['type']}] {risk['deceased_name']}")
                lines.append("")
                lines.append(f"- **风险级别**: {risk['level']}")
                lines.append(f"- **相关信息**: {risk['info']}")
                lines.append(f"- **当前状态**: {risk['status']}")
                if risk.get('review_note'):
                    lines.append(f"- **复核意见**: {risk['review_note']}")
                lines.append("")
                lines.append(f"**详细描述**:")
                lines.append(f"> {risk['description']}")
                lines.append("")
        else:
            lines.append("无当前风险项。")
            lines.append("")
        
        lines.append("## 三、柜位使用情况")
        lines.append("")
        lines.append("| 柜位编号 | 逝者姓名 | 温度状态 | 证件状态 |")
        lines.append("|----------|----------|----------|----------|")
        
        cabinets = self.data_store.get_cabinet_data()
        for cab in cabinets:
            temp_style = "⚠️ 异常" if cab['temp_status'] == "异常" else "✅ 正常"
            doc_style = "⚠️ " + cab['document_status'] if cab['document_status'] != "完整" else "✅ 完整"
            lines.append(f"| {cab['cabinet_id']} | {cab['deceased_name']} | {temp_style} | {doc_style} |")
        lines.append("")
        
        lines.append("## 四、排期安排")
        lines.append("")
        lines.append("| 日期 | 时段 | 逝者姓名 | 服务类型 | 厅/炉号 | 状态 |")
        lines.append("|------|------|----------|----------|---------|------|")
        
        schedules = self.data_store.get_schedule_data()
        for sched in schedules:
            status_style = "⚠️ " + sched['status'] if sched['status'] != "已完成" else "✅ " + sched['status']
            lines.append(f"| {sched['date']} | {sched['time_slot']} | {sched['deceased_name']} | {sched['service_type']} | {sched['location']} | {status_style} |")
        lines.append("")
        
        lines.append("## 五、复核记录")
        lines.append("")
        
        reviews = self.data_store.get_reviews()
        if reviews:
            lines.append("| 时间 | 操作人员 | 风险类型 | 逝者姓名 | 复核意见 | 状态 |")
            lines.append("|------|----------|----------|----------|----------|------|")
            for rev in reviews:
                lines.append(f"| {rev['time']} | {rev['operator']} | {rev['risk_type']} | {rev['deceased_name']} | {rev['note']} | {rev['status']} |")
        else:
            lines.append("暂无复核记录。")
        lines.append("")
        
        lines.append("## 六、逝者信息汇总")
        lines.append("")
        lines.append("| 姓名 | 性别 | 年龄 | 死亡日期 | 柜位编号 | 联系人 | 联系电话 |")
        lines.append("|------|------|------|----------|----------|--------|----------|")
        
        for deceased in self.data_store.deceased.values():
            lines.append(f"| {deceased.name} | {deceased.gender} | {deceased.age} | {deceased.date_of_death} | {deceased.cabinet_id or '无'} | {deceased.contact_person} | {deceased.contact_phone} |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此交接单由系统自动生成，请仔细核对所有信息。*")
        
        return "\n".join(lines)
    
    def _generate_audit_package(self) -> Dict[str, Any]:
        audit = {
            'version': '1.0',
            'audit_time': self.export_time,
            'summary': {
                'total_deceased': len(self.data_store.deceased),
                'total_cabinets': len(self.data_store.cabinets),
                'total_transport_orders': len(self.data_store.transport_orders),
                'total_temperature_records': len(self.data_store.temperature_records),
                'total_farewell_bookings': len(self.data_store.farewell_bookings),
                'total_cremation_schedules': len(self.data_store.cremation_schedules),
                'total_documents': len(self.data_store.documents),
                'total_reviews': len(self.data_store.reviews)
            },
            'risks': {
                'summary': self._get_risk_summary(),
                'details': self._get_risk_details()
            },
            'deceased': [],
            'cabinets': [],
            'transport_orders': [],
            'temperature_records': [],
            'farewell_bookings': [],
            'cremation_schedules': [],
            'documents': [],
            'reviews': []
        }
        
        for deceased in self.data_store.deceased.values():
            audit['deceased'].append(deceased.to_dict())
        
        for cabinet in self.data_store.cabinets.values():
            audit['cabinets'].append(cabinet.to_dict())
        
        for order in self.data_store.transport_orders.values():
            audit['transport_orders'].append(order.to_dict())
        
        for record in self.data_store.temperature_records.values():
            audit['temperature_records'].append(record.to_dict())
        
        for booking in self.data_store.farewell_bookings.values():
            audit['farewell_bookings'].append(booking.to_dict())
        
        for schedule in self.data_store.cremation_schedules.values():
            audit['cremation_schedules'].append(schedule.to_dict())
        
        for doc in self.data_store.documents.values():
            audit['documents'].append(doc.to_dict())
        
        for review in self.data_store.reviews:
            audit['reviews'].append(review.to_dict())
        
        return audit
    
    def _get_risk_summary(self) -> Dict[str, int]:
        high = 0
        medium = 0
        low = 0
        
        for risk in self._get_risk_details():
            if risk['level'] == '高':
                high += 1
            elif risk['level'] == '中':
                medium += 1
            else:
                low += 1
        
        return {
            'total': high + medium + low,
            'high': high,
            'medium': medium,
            'low': low
        }
    
    def _get_risk_details(self) -> List[Dict[str, Any]]:
        risks = []
        
        for cabinet_id, names in self._detect_cabinet_conflicts().items():
            if len(names) > 1:
                risks.append({
                    'type': '柜位串号',
                    'deceased_name': ', '.join(names),
                    'info': f'柜位 {cabinet_id} 分配给 {len(names)} 位逝者',
                    'level': '高',
                    'description': f'柜位 {cabinet_id} 同时分配给以下逝者: {", ".join(names)}。请核实正确的柜位分配。',
                    'status': '待处理',
                    'review_note': ''
                })
        
        for temp_violation in self._detect_temperature_violations():
            risks.append(temp_violation)
        
        for timeout in self._detect_cold_storage_timeout():
            risks.append(timeout)
        
        for missing_docs in self._detect_missing_documents():
            risks.append(missing_docs)
        
        for conflict in self._detect_schedule_conflicts():
            risks.append(conflict)
        
        for unsigned in self._detect_unsigned_transfers():
            risks.append(unsigned)
        
        return risks
    
    def _detect_cabinet_conflicts(self) -> Dict[str, List[str]]:
        cabinet_to_deceased: Dict[str, List[str]] = {}
        
        for deceased in self.data_store.deceased.values():
            if deceased.cabinet_id:
                if deceased.cabinet_id not in cabinet_to_deceased:
                    cabinet_to_deceased[deceased.cabinet_id] = []
                cabinet_to_deceased[deceased.cabinet_id].append(deceased.name)
        
        return cabinet_to_deceased
    
    def _detect_temperature_violations(self) -> List[Dict[str, Any]]:
        violations = []
        
        for cabinet in self.data_store.cabinets.values():
            latest_temp = self.data_store.get_latest_temperature(cabinet.cabinet_id)
            if latest_temp:
                min_temp = cabinet.min_temp
                max_temp = cabinet.max_temp
                deceased = self.data_store.get_deceased_by_cabinet(cabinet.cabinet_id)
                
                if latest_temp.temperature > max_temp:
                    violations.append({
                        'type': '温度超限',
                        'deceased_name': deceased.name if deceased else '无逝者',
                        'info': f'柜位 {cabinet.cabinet_id}: {latest_temp.temperature}°C > {max_temp}°C',
                        'level': '高',
                        'description': f'柜位 {cabinet.cabinet_id} 温度过高！当前温度 {latest_temp.temperature}°C，正常范围应为 {min_temp}°C 至 {max_temp}°C。记录时间: {latest_temp.record_time}，记录人: {latest_temp.recorded_by}',
                        'status': '待处理',
                        'review_note': ''
                    })
                elif latest_temp.temperature < min_temp:
                    violations.append({
                        'type': '温度超限',
                        'deceased_name': deceased.name if deceased else '无逝者',
                        'info': f'柜位 {cabinet.cabinet_id}: {latest_temp.temperature}°C < {min_temp}°C',
                        'level': '中',
                        'description': f'柜位 {cabinet.cabinet_id} 温度过低！当前温度 {latest_temp.temperature}°C，正常范围应为 {min_temp}°C 至 {max_temp}°C。记录时间: {latest_temp.record_time}，记录人: {latest_temp.recorded_by}',
                        'status': '待处理',
                        'review_note': ''
                    })
        
        return violations
    
    def _detect_cold_storage_timeout(self) -> List[Dict[str, Any]]:
        timeouts = []
        max_days = 15
        
        for deceased in self.data_store.deceased.values():
            if deceased.cabinet_id:
                try:
                    death_date = datetime.strptime(deceased.date_of_death, "%Y-%m-%d")
                    today = datetime.now()
                    storage_days = (today - death_date).days
                    
                    if storage_days > max_days:
                        timeouts.append({
                            'type': '冷藏超时',
                            'deceased_name': deceased.name,
                            'info': f'已冷藏 {storage_days} 天 > 规定 {max_days} 天',
                            'level': '高',
                            'description': f'逝者 {deceased.name} 已冷藏 {storage_days} 天，超过规定的 {max_days} 天时限。死亡日期: {deceased.date_of_death}，柜位: {deceased.cabinet_id}',
                            'status': '待处理',
                            'review_note': ''
                        })
                    elif storage_days >= max_days - 2:
                        timeouts.append({
                            'type': '冷藏预警',
                            'deceased_name': deceased.name,
                            'info': f'即将超时: 已冷藏 {storage_days} 天',
                            'level': '中',
                            'description': f'逝者 {deceased.name} 已冷藏 {storage_days} 天，即将达到 {max_days} 天时限。死亡日期: {deceased.date_of_death}，柜位: {deceased.cabinet_id}',
                            'status': '待处理',
                            'review_note': ''
                        })
                except (ValueError, TypeError):
                    pass
        
        return timeouts
    
    def _detect_missing_documents(self) -> List[Dict[str, Any]]:
        missing_list = []
        
        for deceased in self.data_store.deceased.values():
            missing = self.data_store.get_missing_documents(deceased.deceased_id)
            if missing:
                missing_list.append({
                    'type': '证件缺失',
                    'deceased_name': deceased.name,
                    'info': f'缺失 {len(missing)} 项证件',
                    'level': '中',
                    'description': f'逝者 {deceased.name} 缺少以下证件: {", ".join(missing)}。请联系家属尽快补交。',
                    'status': '待处理',
                    'review_note': ''
                })
        
        return missing_list
    
    def _detect_schedule_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        conflicts.extend(self._detect_farewell_conflicts())
        conflicts.extend(self._detect_cremation_conflicts())
        conflicts.extend(self._detect_cross_service_conflicts())
        return conflicts
    
    def _detect_farewell_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        hall_to_bookings: Dict[str, List] = {}
        
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
                        if self._check_time_overlap(booking.start_time, booking.end_time, 
                                                    other_booking.start_time, other_booking.end_time):
                            conflicts.append({
                                'type': '排期冲突',
                                'deceased_name': f'{booking.deceased_name} & {other_booking.deceased_name}',
                                'info': f'告别厅 {hall_id} {booking.date} 时段冲突',
                                'level': '高',
                                'description': f'告别厅 {hall_id} 在 {booking.date} 存在时段冲突：\n- {booking.deceased_name}: {booking.start_time}-{booking.end_time}\n- {other_booking.deceased_name}: {other_booking.start_time}-{other_booking.end_time}',
                                'status': '待处理',
                                'review_note': ''
                            })
        
        return conflicts
    
    def _detect_cremation_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        furnace_to_schedules: Dict[str, List] = {}
        
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
                        if self._check_time_overlap(schedule.start_time, schedule.end_time,
                                                    other_schedule.start_time, other_schedule.end_time):
                            conflicts.append({
                                'type': '排期冲突',
                                'deceased_name': f'{schedule.deceased_name} & {other_schedule.deceased_name}',
                                'info': f'火化炉 {furnace_id} {schedule.date} 时段冲突',
                                'level': '高',
                                'description': f'火化炉 {furnace_id} 在 {schedule.date} 存在时段冲突：\n- {schedule.deceased_name}: {schedule.start_time}-{schedule.end_time}\n- {other_schedule.deceased_name}: {other_schedule.start_time}-{other_schedule.end_time}',
                                'status': '待处理',
                                'review_note': ''
                            })
        
        return conflicts
    
    def _detect_cross_service_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        
        for booking in self.data_store.farewell_bookings.values():
            if booking.status != '已预约':
                continue
            
            for schedule in self.data_store.cremation_schedules.values():
                if schedule.status != '已排期':
                    continue
                
                if booking.deceased_id == schedule.deceased_id and booking.date == schedule.date:
                    farewell_end = self._time_to_minutes(booking.end_time)
                    cremation_start = self._time_to_minutes(schedule.start_time)
                    
                    if cremation_start < farewell_end:
                        conflicts.append({
                            'type': '服务冲突',
                            'deceased_name': booking.deceased_name,
                            'info': f'{booking.date} 告别仪式与火化时间冲突',
                            'level': '高',
                            'description': f'逝者 {booking.deceased_name} 在 {booking.date} 的服务安排存在冲突：\n- 告别厅仪式: {booking.start_time}-{booking.end_time}\n- 火化炉排期: {schedule.start_time}-{schedule.end_time}\n火化时间早于告别仪式结束时间！',
                            'status': '待处理',
                            'review_note': ''
                        })
        
        return conflicts
    
    def _detect_unsigned_transfers(self) -> List[Dict[str, Any]]:
        unsigned = []
        
        for order in self.data_store.transport_orders.values():
            if order.signature_status == '未签收':
                unsigned.append({
                    'type': '交接漏签',
                    'deceased_name': order.deceased_name,
                    'info': f'接运单 {order.order_id} 未签收',
                    'level': '中',
                    'description': f'接运单 {order.order_id} 尚未完成交接签收。\n逝者: {order.deceased_name}\n接运人员: {order.transport_person} ({order.transport_phone})\n接运时间: {order.pickup_time}\n当前状态: {order.signature_status}',
                    'status': '待处理',
                    'review_note': ''
                })
            elif order.signature_status == '部分签收':
                unsigned.append({
                    'type': '交接漏签',
                    'deceased_name': order.deceased_name,
                    'info': f'接运单 {order.order_id} 部分签收',
                    'level': '低',
                    'description': f'接运单 {order.order_id} 为部分签收状态。\n逝者: {order.deceased_name}\n接收人: {order.received_by or "未填写"}\n接收时间: {order.received_time or "未填写"}',
                    'status': '待处理',
                    'review_note': ''
                })
        
        return unsigned
    
    def _check_time_overlap(self, start1: str, end1: str, start2: str, end2: str) -> bool:
        s1 = self._time_to_minutes(start1)
        e1 = self._time_to_minutes(end1)
        s2 = self._time_to_minutes(start2)
        e2 = self._time_to_minutes(end2)
        return s1 < e2 and s2 < e1
    
    def _time_to_minutes(self, time_str: str) -> int:
        try:
            h, m = map(int, time_str.split(':'))
            return h * 60 + m
        except (ValueError, IndexError):
            return 0
