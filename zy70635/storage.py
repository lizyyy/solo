import json
from datetime import date, time
from typing import List
from models import (
    Student, PickupPerson, Authorization, LeaveRecord,
    LatePickupEvent, PickupReport
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, time):
            return obj.strftime("%H:%M:%S")
        return super().default(obj)


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir

    @staticmethod
    def _parse_date(date_str: str) -> date:
        return date.fromisoformat(date_str)

    @staticmethod
    def _parse_time(time_str: str) -> time:
        return time(*map(int, time_str.split(':')))

    def save_students(self, students: List[Student], filename: str = "students.json"):
        data = [s.__dict__ for s in students]
        with open(f"{self.data_dir}/{filename}", 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)

    def load_students(self, filename: str = "students.json") -> List[Student]:
        with open(f"{self.data_dir}/{filename}", 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [Student(**s) for s in data]

    def save_pickup_persons(self, persons: List[PickupPerson], filename: str = "pickup_persons.json"):
        data = [p.__dict__ for p in persons]
        with open(f"{self.data_dir}/{filename}", 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)

    def load_pickup_persons(self, filename: str = "pickup_persons.json") -> List[PickupPerson]:
        with open(f"{self.data_dir}/{filename}", 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [PickupPerson(**p) for p in data]

    def save_authorizations(self, auths: List[Authorization], filename: str = "authorizations.json"):
        data = [a.__dict__ for a in auths]
        with open(f"{self.data_dir}/{filename}", 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)

    def load_authorizations(self, filename: str = "authorizations.json") -> List[Authorization]:
        with open(f"{self.data_dir}/{filename}", 'r', encoding='utf-8') as f:
            data = json.load(f)
        for d in data:
            d['start_date'] = self._parse_date(d['start_date'])
            d['end_date'] = self._parse_date(d['end_date'])
            d['start_time'] = self._parse_time(d['start_time'])
            d['end_time'] = self._parse_time(d['end_time'])
        return [Authorization(**a) for a in data]

    def save_leave_records(self, leaves: List[LeaveRecord], filename: str = "leave_records.json"):
        data = [l.__dict__ for l in leaves]
        with open(f"{self.data_dir}/{filename}", 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, ensure_ascii=False, indent=2)

    def load_leave_records(self, filename: str = "leave_records.json") -> List[LeaveRecord]:
        with open(f"{self.data_dir}/{filename}", 'r', encoding='utf-8') as f:
            data = json.load(f)
        for d in data:
            d['leave_date'] = self._parse_date(d['leave_date'])
        return [LeaveRecord(**l) for l in data]

    def save_reports(self, reports: List[PickupReport], filename: str):
        data = []
        for r in reports:
            d = r.__dict__.copy()
            d['report_date'] = d['report_date'].isoformat()
            if d['pickup_time']:
                d['pickup_time'] = d['pickup_time'].strftime("%H:%M:%S")
            data.append(d)
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
