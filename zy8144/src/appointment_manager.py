import json
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import os


class AppointmentManager:
    def __init__(self, appointments: List[Dict[str, Any]] = None):
        self.appointments = appointments or []
        self._time_overlaps: Dict[str, List[str]] = {}

    def load_from_json(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            self.appointments = json.load(f)
        return self.appointments

    def parse_time(self, time_str: str) -> datetime:
        return datetime.fromisoformat(time_str)

    def is_cross_midnight(self, appointment: Dict[str, Any]) -> bool:
        start = self.parse_time(appointment['scheduled_start_time'])
        end = self.parse_time(appointment['scheduled_end_time'])
        return start.date() != end.date()

    def get_appointment_dates(self, appointment: Dict[str, Any]) -> List[datetime]:
        start = self.parse_time(appointment['scheduled_start_time'])
        end = self.parse_time(appointment['scheduled_end_time'])

        dates = []
        current = start.date()
        end_date = end.date()

        while current <= end_date:
            dates.append(datetime.combine(current, datetime.min.time()))
            current += timedelta(days=1)

        return dates

    def check_time_overlap(self, apt1: Dict[str, Any], apt2: Dict[str, Any]) -> bool:
        start1 = self.parse_time(apt1['scheduled_start_time'])
        end1 = self.parse_time(apt1['scheduled_end_time'])
        start2 = self.parse_time(apt2['scheduled_start_time'])
        end2 = self.parse_time(apt2['scheduled_end_time'])

        return (start1 < end2) and (start2 < end1)

    def find_overlapping_appointments(self, appointment: Dict[str, Any]) -> List[str]:
        overlapping = []
        for other in self.appointments:
            if other['appointment_id'] != appointment['appointment_id']:
                if self.check_time_overlap(appointment, other):
                    overlapping.append(other['appointment_id'])
        return overlapping

    def get_appointments_summary(self) -> Dict[str, Any]:
        if not self.appointments:
            return {}

        df = pd.DataFrame(self.appointments)

        summary = {
            'total_appointments': len(df),
            'total_required_volume_ml': int(df['required_volume_ml'].sum()),
            'by_urgency': df.groupby('urgency')['required_volume_ml'].sum().to_dict(),
            'by_campus': df.groupby('campus')['required_volume_ml'].sum().to_dict(),
            'by_blood_type': df.groupby('required_blood_type')['required_volume_ml'].sum().to_dict(),
            'cross_midnight_count': sum(1 for apt in self.appointments if self.is_cross_midnight(apt))
        }

        return summary

    def get_appointments_by_campus(self, campus: str) -> List[Dict[str, Any]]:
        return [apt for apt in self.appointments if apt['campus'] == campus]

    def get_appointments_by_blood_type(self, blood_type: str) -> List[Dict[str, Any]]:
        return [apt for apt in self.appointments if apt['required_blood_type'] == blood_type]

    def get_appointment_by_id(self, apt_id: str) -> Optional[Dict[str, Any]]:
        for apt in self.appointments:
            if apt['appointment_id'] == apt_id:
                return apt
        return None

    def filter_appointments(self, campuses: List[str] = None,
                            blood_types: List[str] = None,
                            urgencies: List[str] = None,
                            start_date: datetime = None,
                            end_date: datetime = None) -> List[Dict[str, Any]]:
        filtered = self.appointments.copy()

        if campuses:
            filtered = [apt for apt in filtered if apt['campus'] in campuses]

        if blood_types:
            filtered = [apt for apt in filtered if apt['required_blood_type'] in blood_types]

        if urgencies:
            filtered = [apt for apt in filtered if apt['urgency'] in urgencies]

        if start_date or end_date:
            date_filtered = []
            for apt in filtered:
                apt_start = self.parse_time(apt['scheduled_start_time'])
                apt_end = self.parse_time(apt['scheduled_end_time'])

                if start_date and end_date:
                    if (apt_start >= start_date and apt_start <= end_date) or \
                       (apt_end >= start_date and apt_end <= end_date):
                        date_filtered.append(apt)
                elif start_date:
                    if apt_start >= start_date:
                        date_filtered.append(apt)
                elif end_date:
                    if apt_end <= end_date:
                        date_filtered.append(apt)

            filtered = date_filtered

        return filtered

    def get_cross_midnight_appointments(self) -> List[Dict[str, Any]]:
        return [apt for apt in self.appointments if self.is_cross_midnight(apt)]

    def get_emergency_appointments(self) -> List[Dict[str, Any]]:
        return [apt for apt in self.appointments if apt.get('urgency') == 'emergency']

    def sort_appointments_by_priority(self, appointments: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        if appointments is None:
            appointments = self.appointments

        def priority_key(apt):
            urgency_priority = 0 if apt.get('urgency') == 'emergency' else 1
            start_time = self.parse_time(apt['scheduled_start_time'])
            return (urgency_priority, start_time)

        return sorted(appointments, key=priority_key)
