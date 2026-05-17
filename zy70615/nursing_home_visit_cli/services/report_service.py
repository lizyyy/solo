from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import json
import os

from tabulate import tabulate

from ..models import Appointment, AppointmentStatus, Elder, Visitor, Room
from .storage import StorageService


class ReportService:
    def __init__(self, storage: StorageService, reports_dir: str = "reports"):
        self.storage = storage
        self.reports_dir = reports_dir
        os.makedirs(reports_dir, exist_ok=True)

    def generate_daily_report(self, date: Optional[datetime] = None) -> Dict[str, Any]:
        if date is None:
            date = datetime.now()

        start_of_day = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)

        appointments = self.storage.get_all_appointments()
        day_appointments = [
            apt for apt in appointments
            if start_of_day <= apt.scheduled_start < end_of_day
        ]

        stats = defaultdict(int)
        for apt in day_appointments:
            stats[apt.status.value] += 1
            stats['total'] += 1

        room_usage = defaultdict(list)
        for apt in day_appointments:
            room_usage[apt.room_number].append(apt)

        report = {
            'report_type': 'daily',
            'report_date': start_of_day.isoformat(),
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_appointments': stats['total'],
                'by_status': dict(stats)
            },
            'appointments': [self._appointment_to_dict(apt) for apt in day_appointments],
            'room_usage': {
                room: len(apts) for room, apts in room_usage.items()
            }
        }

        return report

    def generate_appointment_detail_report(self, appointment_id: str) -> Dict[str, Any]:
        appointment = self.storage.get_appointment(appointment_id)
        if not appointment:
            return {'error': 'Appointment not found'}

        elder = self.storage.get_elder(appointment.elder_id)
        visitors = [self.storage.get_visitor(vid) for vid in appointment.visitor_ids]
        visitors = [v for v in visitors if v]

        health_declarations = [
            self.storage.health_declarations.get(hid)
            for hid in appointment.health_declaration_ids
        ]
        health_declarations = [h for h in health_declarations if h]

        return {
            'report_type': 'appointment_detail',
            'generated_at': datetime.now().isoformat(),
            'appointment': self._appointment_to_dict(appointment),
            'elder': self._elder_to_dict(elder) if elder else None,
            'visitors': [self._visitor_to_dict(v) for v in visitors],
            'health_declarations': [
                self._health_declaration_to_dict(h)
                for h in health_declarations
            ],
            'change_history': [
                self._change_log_to_dict(log)
                for log in appointment.change_history
            ]
        }

    def _appointment_to_dict(self, apt: Appointment) -> Dict[str, Any]:
        return {
            'id': apt.id,
            'elder_id': apt.elder_id,
            'visitor_ids': apt.visitor_ids,
            'room_number': apt.room_number,
            'scheduled_start': apt.scheduled_start.isoformat(),
            'scheduled_end': apt.scheduled_end.isoformat(),
            'status': apt.status.value,
            'operator': apt.operator,
            'notes': apt.notes,
            'created_at': apt.created_at.isoformat()
        }

    def _elder_to_dict(self, elder: Elder) -> Dict[str, Any]:
        return {
            'id': elder.id,
            'name': elder.name,
            'id_card': elder.id_card,
            'room_number': elder.room_number,
            'bed_number': elder.bed_number,
            'health_status': elder.health_status
        }

    def _visitor_to_dict(self, visitor: Visitor) -> Dict[str, Any]:
        return {
            'id': visitor.id,
            'name': visitor.name,
            'id_card': visitor.id_card,
            'phone': visitor.phone,
            'relation': visitor.relation
        }

    def _health_declaration_to_dict(self, h: Any) -> Dict[str, Any]:
        return {
            'id': h.id,
            'visitor_id': h.visitor_id,
            'temperature': h.temperature,
            'has_fever': h.has_fever,
            'has_cough': h.has_cough,
            'has_other_symptoms': h.has_other_symptoms,
            'symptoms_detail': h.symptoms_detail,
            'is_passed': h.is_passed,
            'declaration_time': h.declaration_time.isoformat()
        }

    def _change_log_to_dict(self, log: Any) -> Dict[str, Any]:
        return {
            'changed_at': log.changed_at.isoformat(),
            'changed_by': log.changed_by,
            'old_status': log.old_status.value if log.old_status else None,
            'new_status': log.new_status.value,
            'old_time': log.old_time.isoformat() if log.old_time else None,
            'new_time': log.new_time.isoformat() if log.new_time else None,
            'reason': log.reason
        }

    def save_report_json(self, report: Dict[str, Any], filename: str) -> str:
        file_path = os.path.join(self.reports_dir, f"{filename}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return file_path

    def format_report_human_readable(self, report: Dict[str, Any]) -> str:
        lines = []

        if report.get('report_type') == 'daily':
            lines.append("=" * 60)
            lines.append(f"养老院探访预约日报 - {report['report_date'][:10]}")
            lines.append("=" * 60)
            lines.append(f"生成时间: {report['generated_at'][:19]}")
            lines.append("")
            lines.append("📊 预约统计:")
            lines.append(f"  总预约数: {report['summary']['total_appointments']}")
            for status, count in report['summary']['by_status'].items():
                if status != 'total':
                    lines.append(f"  {status}: {count}")
            lines.append("")
            lines.append("🏠 房间使用情况:")
            for room, count in report['room_usage'].items():
                lines.append(f"  房间 {room}: {count} 个预约")
            lines.append("")
            lines.append("📋 预约详情:")
            if report['appointments']:
                table_data = []
                for apt in report['appointments']:
                    table_data.append([
                        apt['id'],
                        apt['elder_id'],
                        len(apt['visitor_ids']),
                        apt['room_number'],
                        apt['scheduled_start'][11:16],
                        apt['scheduled_end'][11:16],
                        apt['status']
                    ])
                lines.append(tabulate(
                    table_data,
                    headers=['预约ID', '老人ID', '探访人数', '房间', '开始', '结束', '状态'],
                    tablefmt='simple'
                ))
            else:
                lines.append("  无预约记录")

        elif report.get('report_type') == 'appointment_detail':
            lines.append("=" * 60)
            lines.append(f"预约详情报告 - {report['appointment']['id']}")
            lines.append("=" * 60)
            lines.append(f"生成时间: {report['generated_at'][:19]}")
            lines.append("")

            apt = report['appointment']
            lines.append("📋 预约信息:")
            lines.append(f"  预约ID: {apt['id']}")
            lines.append(f"  状态: {apt['status']}")
            lines.append(f"  房间: {apt['room_number']}")
            lines.append(f"  开始时间: {apt['scheduled_start']}")
            lines.append(f"  结束时间: {apt['scheduled_end']}")
            lines.append(f"  操作员: {apt['operator']}")
            lines.append(f"  备注: {apt['notes'] or '无'}")
            lines.append("")

            if report['elder']:
                e = report['elder']
                lines.append("👴 老人信息:")
                lines.append(f"  姓名: {e['name']}")
                lines.append(f"  房间: {e['room_number']} 床位: {e['bed_number']}")
                lines.append(f"  健康状态: {e['health_status']}")
                lines.append("")

            if report['visitors']:
                lines.append("👥 探访人信息:")
                for v in report['visitors']:
                    lines.append(f"  - {v['name']} ({v['relation']})")
                    lines.append(f"    电话: {v['phone']}")
                lines.append("")

            if report['health_declarations']:
                lines.append("🏥 健康申报:")
                for h in report['health_declarations']:
                    status = "✅ 通过" if h['is_passed'] else "❌ 未通过"
                    lines.append(f"  - {h['visitor_id']}: {h['temperature']}℃ {status}")
                    if h['has_fever'] or h['has_cough'] or h['has_other_symptoms']:
                        lines.append(f"    症状: 发热{'是' if h['has_fever'] else '否'} "
                                   f"咳嗽{'是' if h['has_cough'] else '否'} "
                                   f"其他: {h['symptoms_detail'] or '无'}")
                lines.append("")

            if report['change_history']:
                lines.append("📝 变更历史:")
                for log in report['change_history']:
                    old = f"{log['old_status']} -> " if log['old_status'] else ""
                    lines.append(f"  [{log['changed_at'][:19]}] {log['changed_by']} "
                               f"{old}{log['new_status']}")
                    if log['reason']:
                        lines.append(f"    原因: {log['reason']}")
                    if log['old_time'] and log['new_time']:
                        lines.append(f"    时间变更: {log['old_time'][:19]} -> {log['new_time'][:19]}")

        else:
            lines.append(json.dumps(report, ensure_ascii=False, indent=2))

        return "\n".join(lines)

    def save_report_text(self, report: Dict[str, Any], filename: str) -> str:
        file_path = os.path.join(self.reports_dir, f"{filename}.txt")
        content = self.format_report_human_readable(report)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return file_path
