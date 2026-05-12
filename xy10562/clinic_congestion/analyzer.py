import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from enum import Enum

from clinic_congestion.models import Database, AppointmentStatus, DoctorStatus


class CongestionReason(Enum):
    PATIENT_CONCENTRATION = 'patient_concentration'
    DOCTOR_SUSPENSION = 'doctor_suspension'
    OVERCALL_REQUEUE = 'overcall_requeue'
    WALKIN_SURGE = 'walkin_surge'
    LATE_ARRIVAL = 'late_arrival'
    UNKNOWN = 'unknown'


class CongestionAnalyzer:
    def __init__(self, db: Database):
        self.db = db

    def analyze_department_congestion(self, dept_id: str, appt_date: str) -> Dict[str, Any]:
        depts = self.db.get_all_departments()
        dept = next((d for d in depts if d['id'] == dept_id), None)
        if not dept:
            return {'error': '科室不存在'}

        appointments = self.db.get_appointments_by_date(appt_date, dept_id)
        if not appointments:
            return {'error': '该日期无预约数据'}

        result = {
            'department': dept,
            'date': appt_date,
            'summary': {},
            'congestion_points': [],
            'reason_analysis': [],
            'impacted_patients': [],
            'recommendations': []
        }

        pending_count = 0
        arrived_count = 0
        called_count = 0
        completed_count = 0
        overcall_count = 0

        for appt in appointments:
            status = appt['status']
            if status == AppointmentStatus.PENDING.value:
                pending_count += 1
            elif status == AppointmentStatus.ARRIVED.value:
                arrived_count += 1
            elif status == AppointmentStatus.CALLED.value:
                called_count += 1
            elif status == AppointmentStatus.COMPLETED.value:
                completed_count += 1
            elif status == AppointmentStatus.OVERCALLED.value:
                overcall_count += 1

        total_appointments = len(appointments)
        waiting_count = arrived_count + overcall_count + pending_count

        result['summary'] = {
            'total_appointments': total_appointments,
            'completed': completed_count,
            'waiting': waiting_count,
            'arrived': arrived_count,
            'pending_arrival': pending_count,
            'overcalled': overcall_count,
            'congestion_level': self._calculate_congestion_level(waiting_count, total_appointments)
        }

        reasons = self._detect_congestion_reasons(appointments, dept_id, appt_date)
        result['reason_analysis'] = reasons

        congestion_points = self._detect_congestion_points(appointments, dept_id)
        result['congestion_points'] = congestion_points

        impacted = self._find_impacted_patients(appointments, dept_id)
        result['impacted_patients'] = impacted

        result['recommendations'] = self._generate_recommendations(result)

        return result

    def _calculate_congestion_level(self, waiting: int, total: int) -> str:
        if total == 0:
            return 'normal'
        ratio = waiting / total
        if ratio > 0.6:
            return 'severe'
        elif ratio > 0.4:
            return 'moderate'
        elif ratio > 0.2:
            return 'mild'
        return 'normal'

    def _detect_congestion_reasons(self, appointments: List[Dict], dept_id: str,
                                     appt_date: str) -> List[Dict]:
        reasons = []

        doctors = self.db.get_all_doctors()
        dept_doctors = [d for d in doctors if d['department_id'] == dept_id]
        suspended_doctors = []
        for doc in dept_doctors:
            status = self.db.get_current_doctor_status(doc['id'])
            if status and status['status'] in [DoctorStatus.TEMP_SUSPENDED.value,
                                               DoctorStatus.PERM_SUSPENDED.value]:
                suspended_doctors.append({
                    'doctor_id': doc['id'],
                    'doctor_name': doc['name'],
                    'status': status['status'],
                    'reason': status.get('reason'),
                    'operator': status.get('operator'),
                    'change_time': status['change_time']
                })

        if suspended_doctors:
            reasons.append({
                'reason': CongestionReason.DOCTOR_SUSPENSION.value,
                'description': '医生临时停诊',
                'details': suspended_doctors,
                'severity': 'high' if len(suspended_doctors) >= len(dept_doctors) * 0.5 else 'medium'
            })

        overcall_patients = []
        for appt in appointments:
            if appt['status'] == AppointmentStatus.OVERCALLED.value:
                overcall_count = self.db.get_overcall_count(appt['id'])
                overcall_patients.append({
                    'appointment_id': appt['id'],
                    'patient_name': appt['patient_name'],
                    'queue_number': appt['queue_number'],
                    'requeue_count': overcall_count
                })

        if overcall_patients:
            reasons.append({
                'reason': CongestionReason.OVERCALL_REQUEUE.value,
                'description': '过号患者重新排队',
                'details': overcall_patients,
                'count': len(overcall_patients),
                'severity': 'high' if len(overcall_patients) > 5 else 'medium'
            })

        walkin_count = sum(1 for a in appointments if a['source_type'] == 'walkin')
        booked_count = sum(1 for a in appointments if a['source_type'] == 'booking')
        if walkin_count > booked_count * 0.3:
            reasons.append({
                'reason': CongestionReason.WALKIN_SURGE.value,
                'description': '现场号激增',
                'details': {
                    'walkin_count': walkin_count,
                    'booked_count': booked_count,
                    'ratio': round(walkin_count / max(booked_count, 1), 2)
                },
                'severity': 'medium'
            })

        if not reasons:
            reasons.append({
                'reason': CongestionReason.PATIENT_CONCENTRATION.value,
                'description': '患者集中到达',
                'details': {
                    'arrived_patients': sum(1 for a in appointments if a['status'] == 'arrived')
                },
                'severity': 'low'
            })

        return reasons

    def _detect_congestion_points(self, appointments: List[Dict], dept_id: str) -> List[Dict]:
        points = []

        by_hour = defaultdict(int)
        for appt in appointments:
            arrival = self.db.get_arrival_by_appointment(appt['id'])
            if arrival:
                try:
                    arrival_time = datetime.fromisoformat(arrival['arrival_time'])
                    hour_key = f"{arrival_time.hour}:00-{arrival_time.hour + 1}:00"
                    by_hour[hour_key] += 1
                except:
                    pass

        if by_hour:
            max_hour = max(by_hour.items(), key=lambda x: x[1])
            avg_count = sum(by_hour.values()) / len(by_hour)
            if max_hour[1] > avg_count * 1.5:
                points.append({
                    'type': 'peak_hour',
                    'time_range': max_hour[0],
                    'patient_count': max_hour[1],
                    'is_peak': True
                })

        queue_numbers = []
        for a in appointments:
            if a['queue_number']:
                num_str = ''.join(c for c in a['queue_number'] if c.isdigit())
                if num_str:
                    queue_numbers.append(int(num_str))
        queue_numbers = sorted(queue_numbers)
        if queue_numbers:
            continuous_gaps = []
            for i in range(len(queue_numbers) - 1):
                if queue_numbers[i + 1] - queue_numbers[i] > 2:
                    continuous_gaps.append({
                        'from': queue_numbers[i],
                        'to': queue_numbers[i + 1],
                        'gap': queue_numbers[i + 1] - queue_numbers[i] - 1
                    })

            if continuous_gaps:
                points.append({
                    'type': 'queue_gap',
                    'gaps': continuous_gaps,
                    'description': '存在跳号或未叫号'
                })

        return points

    def _find_impacted_patients(self, appointments: List[Dict], dept_id: str) -> List[Dict]:
        impacted = []
        waiting_statuses = [AppointmentStatus.ARRIVED.value,
                           AppointmentStatus.OVERCALLED.value,
                           AppointmentStatus.PENDING.value]

        for appt in appointments:
            if appt['status'] in waiting_statuses:
                arrival = self.db.get_arrival_by_appointment(appt['id'])
                overcall_count = self.db.get_overcall_count(appt['id'])
                call_logs = self.db.get_call_logs_by_appointment(appt['id'])

                impacted.append({
                    'appointment_id': appt['id'],
                    'patient_name': appt['patient_name'],
                    'queue_number': appt['queue_number'],
                    'status': appt['status'],
                    'source_type': appt['source_type'],
                    'arrival_time': arrival['arrival_time'] if arrival else None,
                    'call_count': len(call_logs),
                    'overcall_count': overcall_count,
                    'doctor_id': appt.get('doctor_id')
                })

        return sorted(impacted, key=lambda x: x['queue_number'])

    def _generate_recommendations(self, analysis_result: Dict) -> List[Dict]:
        recommendations = []
        summary = analysis_result['summary']
        reasons = analysis_result['reason_analysis']

        level = summary['congestion_level']

        if level == 'severe':
            recommendations.append({
                'priority': 'high',
                'action': '立即增开临时窗口',
                'details': '当前拥堵严重，建议立即协调其他科室医生支援'
            })

        for reason in reasons:
            if reason['reason'] == CongestionReason.DOCTOR_SUSPENSION.value:
                recommendations.append({
                    'priority': 'high',
                    'action': '协调其他医生顶替',
                    'details': f"有{len(reason['details'])}位医生停诊，需安排其他医生顶替"
                })
            elif reason['reason'] == CongestionReason.OVERCALL_REQUEUE.value:
                recommendations.append({
                    'priority': 'medium',
                    'action': '优化过号处理流程',
                    'details': f"有{reason['count']}位过号患者，建议优先处理这些患者"
                })
            elif reason['reason'] == CongestionReason.WALKIN_SURGE.value:
                recommendations.append({
                    'priority': 'medium',
                    'action': '增加预诊分诊力量',
                    'details': '现场号患者较多，建议增加预诊分诊人员'
                })

        if summary['waiting'] > 10:
            recommendations.append({
                'priority': 'medium',
                'action': '加强候诊区管理',
                'details': '候诊人数较多，建议加强秩序维护和患者沟通'
            })

        if not recommendations:
            recommendations.append({
                'priority': 'low',
                'action': '保持现状',
                'details': '当前拥堵情况在正常范围内'
            })

        return recommendations

    def analyze_all_departments(self, appt_date: str) -> Dict[str, Any]:
        depts = self.db.get_all_departments()
        results = {}

        for dept in depts:
            dept_result = self.analyze_department_congestion(dept['id'], appt_date)
            if 'error' not in dept_result:
                results[dept['id']] = dept_result

        overall = {
            'total_depts': len(depts),
            'analyzed_depts': len(results),
            'date': appt_date,
            'by_congestion': defaultdict(int),
            'total_patients': 0,
            'total_waiting': 0
        }

        for dept_id, result in results.items():
            level = result['summary']['congestion_level']
            overall['by_congestion'][level] += 1
            overall['total_patients'] += result['summary']['total_appointments']
            overall['total_waiting'] += result['summary']['waiting']

        overall['by_congestion'] = dict(overall['by_congestion'])

        return {
            'overall': overall,
            'departments': results
        }


class DataValidator:
    def __init__(self, db: Database):
        self.db = db
        self.errors = []
        self.warnings = []

    def validate_appointment_data(self, data: Dict) -> Tuple[bool, List[str]]:
        errors = []

        if 'id' not in data or not data['id']:
            errors.append('预约ID不能为空')
        if 'patient_name' not in data or not data['patient_name']:
            errors.append('患者姓名不能为空')
        if 'department_id' not in data or not data['department_id']:
            errors.append('科室ID不能为空')
        if 'appointment_date' not in data or not data['appointment_date']:
            errors.append('预约日期不能为空')
        if 'queue_number' not in data or not data['queue_number']:
            errors.append('排队号不能为空')
        if 'source_type' not in data or not data['source_type']:
            errors.append('号源类型不能为空')
        elif data['source_type'] not in ['booking', 'walkin']:
            errors.append('号源类型只能是 booking 或 walkin')

        depts = self.db.get_all_departments()
        dept_ids = [d['id'] for d in depts]
        if 'department_id' in data and data['department_id'] not in dept_ids:
            errors.append(f"科室 {data['department_id']} 不存在")

        return len(errors) == 0, errors

    def validate_arrival_data(self, data: Dict) -> Tuple[bool, List[str]]:
        errors = []

        if 'appointment_id' not in data or not data['appointment_id']:
            errors.append('预约ID不能为空')
        if 'arrival_time' not in data or not data['arrival_time']:
            errors.append('到诊时间不能为空')

        return len(errors) == 0, errors

    def validate_call_log_data(self, data: Dict) -> Tuple[bool, List[str]]:
        errors = []

        if 'appointment_id' not in data or not data['appointment_id']:
            errors.append('预约ID不能为空')
        if 'call_time' not in data or not data['call_time']:
            errors.append('叫号时间不能为空')
        if 'queue_number' not in data or not data['queue_number']:
            errors.append('排队号不能为空')

        return len(errors) == 0, errors

    def validate_overcall_data(self, data: Dict) -> Tuple[bool, List[str]]:
        errors = []

        if 'appointment_id' not in data or not data['appointment_id']:
            errors.append('预约ID不能为空')
        if 'overcall_time' not in data or not data['overcall_time']:
            errors.append('过号时间不能为空')

        return len(errors) == 0, errors
