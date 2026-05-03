import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional
from .config_loader import ConfigLoader
from .compatibility_checker import CompatibilityChecker
from .inventory_manager import InventoryManager
from .appointment_manager import AppointmentManager
from .allocation_engine import AllocationEngine


class IssueDetector:
    ISSUE_TYPES = {
        'DUPLICATE_ASSIGNMENT': 'duplicate_assignment',
        'INCOMPATIBLE_BLOOD': 'incompatible_blood',
        'CROSS_MIDNIGHT': 'cross_midnight',
        'EXPIRING_SOON': 'expiring_soon',
        'RARE_SHORTAGE': 'rare_shortage',
        'UNMET_DEMAND': 'unmet_demand',
        'TIME_OVERLAP': 'time_overlap'
    }

    def __init__(self, config_loader: ConfigLoader,
                 compatibility_checker: CompatibilityChecker,
                 inventory_manager: InventoryManager,
                 appointment_manager: AppointmentManager,
                 allocation_engine: AllocationEngine):
        self.config = config_loader
        self.compatibility = compatibility_checker
        self.inventory = inventory_manager
        self.appointments = appointment_manager
        self.allocation = allocation_engine
        self.issues: List[Dict[str, Any]] = []

    def detect_all_issues(self, current_date: datetime = None) -> List[Dict[str, Any]]:
        if current_date is None:
            current_date = datetime.now()

        self.issues = []

        self._detect_duplicate_assignments()
        self._detect_incompatible_assignments()
        self._detect_cross_midnight_appointments()
        self._detect_expiring_bags(current_date)
        self._detect_rare_blood_shortage()
        self._detect_unmet_demand()
        self._detect_time_overlaps()

        return self.issues

    def _detect_duplicate_assignments(self):
        assigned_bags = self.inventory.get_all_assigned_bags()

        for bag_id, appointments in assigned_bags.items():
            if len(appointments) > 1:
                bag = self.inventory.get_bag_by_id(bag_id)
                self.issues.append({
                    'issue_type': self.ISSUE_TYPES['DUPLICATE_ASSIGNMENT'],
                    'severity': 'critical',
                    'bag_id': bag_id,
                    'blood_type': bag.get('blood_type', '') if bag else '',
                    'campus': bag.get('campus', '') if bag else '',
                    'appointments': appointments,
                    'appointment_count': len(appointments),
                    'description': f"血袋 {bag_id} 被分配给多个预约: {', '.join(appointments)}",
                    'recommendation': '请确认分配冲突，每个血袋只能分配给一个预约'
                })

    def _detect_incompatible_assignments(self):
        for result in self.allocation.allocation_results:
            for bag in result.get('assigned_bags', []):
                appointment = self.appointments.get_appointment_by_id(result['appointment_id'])
                if not appointment:
                    continue

                compat_check = self.compatibility.check_appointment_compatibility(
                    appointment,
                    {'blood_type': bag['blood_type']}
                )

                if not compat_check['is_compatible']:
                    self.issues.append({
                        'issue_type': self.ISSUE_TYPES['INCOMPATIBLE_BLOOD'],
                        'severity': 'critical',
                        'appointment_id': result['appointment_id'],
                        'patient_name': result.get('patient_name', ''),
                        'bag_id': bag['bag_id'],
                        'donor_type': bag['blood_type'],
                        'recipient_type': result['required_blood_type'],
                        'reason': compat_check['reason'],
                        'description': f"预约 {result['appointment_id']} 分配了不相容血液: {bag['blood_type']} → {result['required_blood_type']}",
                        'recommendation': '请更换相容血型的血袋'
                    })

    def _detect_cross_midnight_appointments(self):
        cross_midnight = self.appointments.get_cross_midnight_appointments()

        for apt in cross_midnight:
            overlapping = self.appointments.find_overlapping_appointments(apt)
            self.issues.append({
                'issue_type': self.ISSUE_TYPES['CROSS_MIDNIGHT'],
                'severity': 'warning',
                'appointment_id': apt['appointment_id'],
                'patient_name': apt.get('patient_name', ''),
                'start_time': apt['scheduled_start_time'],
                'end_time': apt['scheduled_end_time'],
                'overlapping_appointments': overlapping,
                'description': f"预约 {apt['appointment_id']} 跨午夜，时间: {apt['scheduled_start_time']} - {apt['scheduled_end_time']}",
                'recommendation': '注意库存分配和人员安排，确保跨午夜用血需求'
            })

    def _detect_expiring_bags(self, current_date: datetime):
        expiring = self.inventory.get_expiring_bags(current_date=current_date, days_threshold=5)

        for _, bag in expiring.iterrows():
            risk_level = 'critical' if bag['days_until_expiry'] <= 2 else 'warning'
            self.issues.append({
                'issue_type': self.ISSUE_TYPES['EXPIRING_SOON'],
                'severity': risk_level,
                'bag_id': bag['blood_bag_id'],
                'blood_type': bag['blood_type'],
                'campus': bag['campus'],
                'days_until_expiry': bag['days_until_expiry'],
                'expiry_date': str(bag['expiry_date'].date()) if hasattr(bag['expiry_date'], 'date') else str(bag['expiry_date']),
                'description': f"血袋 {bag['blood_bag_id']} 即将过期，剩余 {bag['days_until_expiry']} 天",
                'recommendation': '优先分配给近期手术，考虑跨院调拨或紧急使用'
            })

    def _detect_rare_blood_shortage(self):
        inventory_summary = self.inventory.get_inventory_summary()
        appointment_summary = self.appointments.get_appointments_summary()

        by_type = inventory_summary.get('by_blood_type', {})
        demand_by_type = appointment_summary.get('by_blood_type', {})

        for blood_type, supply_ml in by_type.items():
            if self.config.is_rare_blood_type(blood_type):
                demand_ml = demand_by_type.get(blood_type, 0)
                supply_bags = supply_ml // 450
                demand_bags = (demand_ml + 449) // 450

                if supply_bags < demand_bags or supply_bags <= 2:
                    self.issues.append({
                        'issue_type': self.ISSUE_TYPES['RARE_SHORTAGE'],
                        'severity': 'critical' if supply_bags < demand_bags else 'warning',
                        'blood_type': blood_type,
                        'supply_bags': supply_bags,
                        'supply_ml': supply_ml,
                        'demand_bags': demand_bags,
                        'demand_ml': demand_ml,
                        'description': f"稀有血型 {blood_type} 库存短缺: 供应 {supply_bags} 袋, 需求 {demand_bags} 袋",
                        'recommendation': '启动稀有血型应急机制，联系血站或启动跨院调拨'
                    })

    def _detect_unmet_demand(self):
        for result in self.allocation.unmet_appointments:
            if result['unmet_volume_ml'] > 0:
                self.issues.append({
                    'issue_type': self.ISSUE_TYPES['UNMET_DEMAND'],
                    'severity': 'critical' if result['urgency'] == 'emergency' else 'warning',
                    'appointment_id': result['appointment_id'],
                    'patient_name': result.get('patient_name', ''),
                    'required_blood_type': result['required_blood_type'],
                    'required_volume_ml': result['required_volume_ml'],
                    'assigned_volume_ml': result['total_assigned_volume_ml'],
                    'unmet_volume_ml': result['unmet_volume_ml'],
                    'campus': result['campus'],
                    'urgency': result['urgency'],
                    'description': f"预约 {result['appointment_id']} 需求未满足: 需要 {result['required_volume_ml']}ml, 已分配 {result['total_assigned_volume_ml']}ml",
                    'recommendation': '检查同型库存，考虑相容血型替代或跨院调拨'
                })

    def _detect_time_overlaps(self):
        for apt in self.appointments.appointments:
            overlapping = self.appointments.find_overlapping_appointments(apt)
            if overlapping:
                self.issues.append({
                    'issue_type': self.ISSUE_TYPES['TIME_OVERLAP'],
                    'severity': 'warning',
                    'appointment_id': apt['appointment_id'],
                    'patient_name': apt.get('patient_name', ''),
                    'start_time': apt['scheduled_start_time'],
                    'end_time': apt['scheduled_end_time'],
                    'overlapping_with': overlapping,
                    'description': f"预约 {apt['appointment_id']} 与其他预约时间重叠: {', '.join(overlapping)}",
                    'recommendation': '检查是否有足够库存，可能需要调整手术时间或增加库存'
                })

    def get_issues_by_type(self, issue_type: str) -> List[Dict[str, Any]]:
        return [i for i in self.issues if i.get('issue_type') == issue_type]

    def get_issues_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        return [i for i in self.issues if i.get('severity') == severity]

    def get_issues_dataframe(self) -> pd.DataFrame:
        if not self.issues:
            return pd.DataFrame()

        rows = []
        for idx, issue in enumerate(self.issues):
            row = {
                'issue_id': f"ISS{idx+1:04d}",
                'issue_type': issue.get('issue_type', ''),
                'severity': issue.get('severity', ''),
                'description': issue.get('description', ''),
                'recommendation': issue.get('recommendation', '')
            }

            for key in ['bag_id', 'appointment_id', 'blood_type', 'campus',
                       'patient_name', 'days_until_expiry', 'urgency']:
                if key in issue:
                    row[key] = issue[key]

            rows.append(row)

        return pd.DataFrame(rows)

    def get_issue_statistics(self) -> Dict[str, Any]:
        stats = {
            'total_issues': len(self.issues),
            'by_severity': {
                'critical': len(self.get_issues_by_severity('critical')),
                'warning': len(self.get_issues_by_severity('warning'))
            },
            'by_type': {}
        }

        for issue_type in self.ISSUE_TYPES.values():
            stats['by_type'][issue_type] = len(self.get_issues_by_type(issue_type))

        return stats
