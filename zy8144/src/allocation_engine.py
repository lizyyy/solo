import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from .config_loader import ConfigLoader
from .compatibility_checker import CompatibilityChecker
from .inventory_manager import InventoryManager
from .appointment_manager import AppointmentManager


class AllocationEngine:
    def __init__(self, config_loader: ConfigLoader,
                 compatibility_checker: CompatibilityChecker,
                 inventory_manager: InventoryManager,
                 appointment_manager: AppointmentManager):
        self.config = config_loader
        self.compatibility = compatibility_checker
        self.inventory = inventory_manager
        self.appointments = appointment_manager
        self.allocation_results: List[Dict[str, Any]] = []
        self.unmet_appointments: List[Dict[str, Any]] = []

    def allocate_blood_for_appointment(self, appointment: Dict[str, Any],
                                        current_date: datetime = None) -> Dict[str, Any]:
        if current_date is None:
            current_date = datetime.now()

        required_type = appointment['required_blood_type']
        required_volume = appointment['required_volume_ml']
        appointment_campus = appointment['campus']

        compatible_types = self.compatibility.get_compatible_blood_types_for_recipient(required_type)

        result = {
            'appointment_id': appointment['appointment_id'],
            'patient_name': appointment.get('patient_name', ''),
            'required_blood_type': required_type,
            'required_volume_ml': required_volume,
            'campus': appointment_campus,
            'urgency': appointment.get('urgency', 'routine'),
            'assigned_bags': [],
            'total_assigned_volume_ml': 0,
            'unmet_volume_ml': required_volume,
            'needs_transfer': False,
            'transfer_suggestions': [],
            'compatibility_issues': [],
            'status': 'pending'
        }

        remaining_volume = required_volume
        assigned_bags = []

        same_campus_bags = self._get_priority_bags(appointment_campus, compatible_types, current_date)

        for _, bag in same_campus_bags.iterrows():
            if remaining_volume <= 0:
                break

            bag_id = bag['blood_bag_id']
            if self.inventory.is_bag_assigned(bag_id):
                continue

            compat_check = self.compatibility.check_appointment_compatibility(appointment, bag.to_dict())

            if compat_check['is_compatible']:
                assigned_bags.append({
                    'bag_id': bag_id,
                    'blood_type': bag['blood_type'],
                    'volume_ml': bag['volume_ml'],
                    'campus': bag['campus'],
                    'days_until_expiry': (pd.Timestamp(bag['expiry_date']) - pd.Timestamp(current_date)).days,
                    'compatibility_level': compat_check['compatibility_level'],
                    'compatibility_label': self.compatibility.get_priority_label(compat_check['compatibility_level']),
                    'transfer_needed': False
                })

                self.inventory.mark_bag_assigned(bag_id, appointment['appointment_id'])
                remaining_volume -= bag['volume_ml']
            else:
                result['compatibility_issues'].append({
                    'bag_id': bag_id,
                    'issue': compat_check['reason']
                })

        if remaining_volume > 0:
            all_campuses = [c['id'] for c in self.config.get_all_campuses() if c['id'] != appointment_campus]
            all_campuses.sort(key=lambda c: self.config.get_campus_distance(appointment_campus, c))

            for other_campus in all_campuses:
                if remaining_volume <= 0:
                    break

                other_bags = self._get_priority_bags(other_campus, compatible_types, current_date)

                for _, bag in other_bags.iterrows():
                    if remaining_volume <= 0:
                        break

                    bag_id = bag['blood_bag_id']
                    if self.inventory.is_bag_assigned(bag_id):
                        continue

                    compat_check = self.compatibility.check_appointment_compatibility(appointment, bag.to_dict())

                    if compat_check['is_compatible']:
                        distance = self.config.get_campus_distance(other_campus, appointment_campus)

                        if distance <= self.config.get_max_transfer_time():
                            assigned_bags.append({
                                'bag_id': bag_id,
                                'blood_type': bag['blood_type'],
                                'volume_ml': bag['volume_ml'],
                                'campus': bag['campus'],
                                'days_until_expiry': (pd.Timestamp(bag['expiry_date']) - pd.Timestamp(current_date)).days,
                                'compatibility_level': compat_check['compatibility_level'],
                                'compatibility_label': self.compatibility.get_priority_label(compat_check['compatibility_level']),
                                'transfer_needed': True,
                                'transfer_from_campus': other_campus,
                                'transfer_distance_minutes': distance
                            })

                            self.inventory.mark_bag_assigned(bag_id, appointment['appointment_id'])
                            remaining_volume -= bag['volume_ml']
                            result['needs_transfer'] = True
                        else:
                            result['transfer_suggestions'].append({
                                'bag_id': bag_id,
                                'blood_type': bag['blood_type'],
                                'from_campus': other_campus,
                                'distance_minutes': distance,
                                'volume_ml': bag['volume_ml'],
                                'note': '距离过远，不建议调拨'
                            })

        result['assigned_bags'] = assigned_bags
        result['total_assigned_volume_ml'] = required_volume - remaining_volume
        result['unmet_volume_ml'] = remaining_volume

        if remaining_volume <= 0:
            result['status'] = 'fully_allocated'
        elif result['total_assigned_volume_ml'] > 0:
            result['status'] = 'partially_allocated'
        else:
            result['status'] = 'unallocated'

        return result

    def _get_priority_bags(self, campus: str, compatible_types: List[str],
                            current_date: datetime) -> pd.DataFrame:
        available = self.inventory.get_available_bags(campus=campus)

        if available.empty:
            return available

        compatible = available[available['blood_type'].isin(compatible_types)].copy()

        if compatible.empty:
            return compatible

        compatible['days_until_expiry'] = (compatible['expiry_date'] - pd.Timestamp(current_date)).dt.days

        def sort_key(row):
            compat_level = self.compatibility.get_compatibility_level(
                row['blood_type'],
                compatible_types[0] if compatible_types else row['blood_type']
            )
            return (compat_level, row['days_until_expiry'])

        return compatible.sort_values('days_until_expiry', ascending=True)

    def run_allocation(self, current_date: datetime = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        if current_date is None:
            current_date = datetime.now()

        self.allocation_results = []
        self.unmet_appointments = []

        sorted_appointments = self.appointments.sort_appointments_by_priority()

        for appointment in sorted_appointments:
            result = self.allocate_blood_for_appointment(appointment, current_date)
            self.allocation_results.append(result)

            if result['status'] != 'fully_allocated':
                self.unmet_appointments.append(result)

        return self.allocation_results, self.unmet_appointments

    def get_cross_campus_transfer_suggestions(self) -> List[Dict[str, Any]]:
        transfers = []

        for result in self.allocation_results:
            if result.get('needs_transfer', False):
                for bag in result['assigned_bags']:
                    if bag.get('transfer_needed', False):
                        transfers.append({
                            'appointment_id': result['appointment_id'],
                            'patient_name': result['patient_name'],
                            'bag_id': bag['bag_id'],
                            'blood_type': bag['blood_type'],
                            'from_campus': bag['transfer_from_campus'],
                            'to_campus': result['campus'],
                            'distance_minutes': bag['transfer_distance_minutes'],
                            'volume_ml': bag['volume_ml'],
                            'urgency': result['urgency']
                        })

        return transfers

    def get_expiring_priority_list(self, current_date: datetime = None) -> pd.DataFrame:
        if current_date is None:
            current_date = datetime.now()

        expiring = self.inventory.get_expiring_bags(current_date=current_date)

        if expiring.empty:
            return expiring

        priority_data = []
        for _, bag in expiring.iterrows():
            bag_dict = bag.to_dict()
            compatible_recipients = self.compatibility.get_compatible_blood_types_for_recipient(
                bag['blood_type']
            )

            matching_appointments = []
            for apt in self.appointments.appointments:
                if apt['required_blood_type'] in compatible_recipients:
                    compat_check = self.compatibility.check_appointment_compatibility(apt, bag_dict)
                    if compat_check['is_compatible']:
                        matching_appointments.append({
                            'appointment_id': apt['appointment_id'],
                            'patient_name': apt.get('patient_name', ''),
                            'urgency': apt.get('urgency', 'routine'),
                            'campus': apt['campus']
                        })

            priority_data.append({
                'blood_bag_id': bag['blood_bag_id'],
                'blood_type': bag['blood_type'],
                'campus': bag['campus'],
                'days_until_expiry': bag['days_until_expiry'],
                'expiry_risk': bag['expiry_risk'],
                'matching_appointments_count': len(matching_appointments),
                'matching_appointments': matching_appointments,
                'priority_score': 1.0 / (bag['days_until_expiry'] + 1) * (1 + len(matching_appointments) * 0.1)
            })

        priority_df = pd.DataFrame(priority_data)
        return priority_df.sort_values('priority_score', ascending=False)
