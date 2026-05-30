from datetime import datetime, date
from typing import List, Dict, Any, Optional
import os
import json
import pandas as pd
from pathlib import Path

from app import models, schemas


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_batch_report(self, batch_id: str, batch_name: str,
                               schedules: List[Dict], conflicts: List[Dict],
                               algorithm_summary: Dict[str, Any],
                               bookings: List[models.BookingRequest],
                               rooms: List[models.Room]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{batch_id}_{timestamp}_排期报告.xlsx"
        filepath = self.output_dir / filename

        writer = pd.ExcelWriter(filepath, engine='openpyxl')

        self._write_sheet_overview(writer, batch_id, batch_name, algorithm_summary,
                                    len(schedules), len(conflicts), len(bookings))
        self._write_sheet_schedules(writer, schedules, bookings, rooms)
        self._write_sheet_conflicts(writer, conflicts, bookings)
        self._write_sheet_algorithm_details(writer, algorithm_summary)
        self._write_sheet_audit_trail(writer, batch_id, schedules, conflicts)

        writer.close()

        self._write_json_summary(batch_id, batch_name, schedules, conflicts, algorithm_summary)

        return str(filepath)

    def _write_sheet_overview(self, writer, batch_id: str, batch_name: str,
                               algorithm_summary: Dict[str, Any],
                               scheduled_count: int, conflict_count: int,
                               total_requests: int):
        data = {
            '项目': [
                '批次ID',
                '批次名称',
                '生成时间',
                '预约申请总数',
                '成功排期数',
                '冲突数量',
                '成功率',
                '算法类型',
                '求解器',
                '求解状态',
                '目标函数值',
                '排期日期'
            ],
            '内容': [
                batch_id,
                batch_name,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                total_requests,
                scheduled_count,
                conflict_count,
                f"{(scheduled_count / total_requests * 100):.1f}%" if total_requests > 0 else "0%",
                algorithm_summary.get('algorithm', 'N/A'),
                algorithm_summary.get('solver', 'N/A'),
                algorithm_summary.get('status', 'N/A'),
                algorithm_summary.get('objective_value', 0),
                algorithm_summary.get('scheduling_date', 'N/A')
            ]
        }
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='概览', index=False)

    def _write_sheet_schedules(self, writer, schedules: List[Dict],
                                bookings: List[models.BookingRequest],
                                rooms: List[models.Room]):
        rows = []
        booking_map = {b.id: b for b in bookings}
        room_map = {r.id: r for r in rooms}

        for idx, s in enumerate(schedules, 1):
            booking = booking_map.get(s['booking_id'])
            room = room_map.get(s['room_id'])

            equipment_list = []
            if booking:
                for eq in booking.equipment:
                    equipment_list.append(f"{eq.equipment.name if hasattr(eq, 'equipment') and eq.equipment else eq.equipment_id} x{eq.quantity}")

            rows.append({
                '序号': idx,
                '预约ID': s['booking_id'],
                '预约标题': booking.title if booking else 'N/A',
                '乐队': booking.band.name if booking and booking.band else 'N/A',
                '人数': booking.participant_count if booking else 0,
                '优先级': booking.priority if booking else 'normal',
                '房间ID': s['room_id'],
                '房间名称': room.name if room else 'N/A',
                '房间容量': room.capacity if room else 0,
                '排期日期': str(s['scheduled_date']),
                '开始时间': s['start_time'],
                '结束时间': s['end_time'],
                '设备需求': '; '.join(equipment_list),
                '分配来源': s.get('source_note', 'N/A'),
                '批次ID': s['batch_id']
            })

        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name='排期结果', index=False)

    def _write_sheet_conflicts(self, writer, conflicts: List[Dict],
                                bookings: List[models.BookingRequest]):
        rows = []
        booking_map = {b.id: b for b in bookings}

        for idx, c in enumerate(conflicts, 1):
            booking = booking_map.get(c['booking_id'])
            details = c.get('conflict_details', {})

            rows.append({
                '序号': idx,
                '预约ID': c['booking_id'],
                '预约标题': booking.title if booking else 'N/A',
                '冲突类型': c.get('conflict_type', 'unknown'),
                '严重程度': c.get('severity', 'warning'),
                '请求日期': details.get('requested_date', 'N/A'),
                '请求时间': details.get('requested_time', 'N/A'),
                '人数': details.get('participants', 0),
                '优先级': details.get('priority', 'normal'),
                '问题描述': '\n'.join(details.get('issues', [])),
                '替代方案建议': self._format_alternatives(details.get('alternative_suggestions', [])),
                '批次ID': c['batch_id'],
                '是否已解决': '否',
                '解决备注': ''
            })

        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name='冲突记录', index=False)

    def _write_sheet_algorithm_details(self, writer, algorithm_summary: Dict[str, Any]):
        rows = []
        for key, value in algorithm_summary.items():
            if isinstance(value, dict):
                for sub_key, sub_value in value.items():
                    rows.append({
                        '参数': f"{key}.{sub_key}",
                        '值': str(sub_value)
                    })
            else:
                rows.append({
                    '参数': key,
                    '值': str(value)
                })

        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name='算法详情', index=False)

    def _write_sheet_audit_trail(self, writer, batch_id: str,
                                  schedules: List[Dict], conflicts: List[Dict]):
        rows = []
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        rows.append({
            '时间': timestamp,
            '操作类型': '批次创建',
            '批次ID': batch_id,
            '关联对象': 'N/A',
            '对象类型': 'N/A',
            '操作描述': f"创建排期批次，包含{len(schedules)}个排期和{len(conflicts)}个冲突记录",
            '操作人员': 'system'
        })

        for s in schedules:
            rows.append({
                '时间': timestamp,
                '操作类型': '排期分配',
                '批次ID': batch_id,
                '关联对象': f"booking_{s['booking_id']}",
                '对象类型': 'schedule',
                '操作描述': f"为预约{s['booking_id']}分配房间{s['room_id']}，时间{s['scheduled_date']} {s['start_time']}-{s['end_time']}",
                '操作人员': 'algorithm'
            })

        for c in conflicts:
            rows.append({
                '时间': timestamp,
                '操作类型': '冲突记录',
                '批次ID': batch_id,
                '关联对象': f"booking_{c['booking_id']}",
                '对象类型': 'conflict',
                '操作描述': f"预约{c['booking_id']}存在{c.get('conflict_type', 'unknown')}冲突",
                '操作人员': 'algorithm'
            })

        df = pd.DataFrame(rows)
        df.to_excel(writer, sheet_name='审计追踪', index=False)

    def _format_alternatives(self, alternatives: List[Dict]) -> str:
        if not alternatives:
            return '无可用替代方案'

        parts = []
        for alt in alternatives:
            rooms = ', '.join(map(str, alt.get('rooms', [])))
            parts.append(f"日期:{alt.get('date', 'N/A')}, 可用房间:[{rooms}]")

        return '\n'.join(parts)

    def _json_serialize(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

    def _write_json_summary(self, batch_id: str, batch_name: str,
                            schedules: List[Dict], conflicts: List[Dict],
                            algorithm_summary: Dict[str, Any]):
        summary = {
            'batch_id': batch_id,
            'batch_name': batch_name,
            'generated_at': datetime.now().isoformat(),
            'algorithm_summary': algorithm_summary,
            'schedules': schedules,
            'conflicts': conflicts,
            'statistics': {
                'total': len(schedules) + len(conflicts),
                'scheduled': len(schedules),
                'conflicts': len(conflicts),
                'success_rate': len(schedules) / (len(schedules) + len(conflicts)) if (len(schedules) + len(conflicts)) > 0 else 0
            }
        }

        json_filename = f"{batch_id}_summary.json"
        json_filepath = self.output_dir / json_filename

        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2, default=self._json_serialize)
