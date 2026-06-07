import json
import os
from typing import Dict, List, Optional
from .models import Point, Street, Complaint, ReviewStatus, PointType


class DataStore:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(__file__), 'data')
        self.data_dir = data_dir
        self.points_file = os.path.join(data_dir, 'points.json')
        self.streets_file = os.path.join(data_dir, 'streets.json')
        self.complaints_file = os.path.join(data_dir, 'complaints.json')
        self._ensure_files()

    def _ensure_files(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for f in [self.points_file, self.streets_file, self.complaints_file]:
            if not os.path.exists(f):
                with open(f, 'w', encoding='utf-8') as fp:
                    json.dump([], fp, ensure_ascii=False, indent=2)

    def _load_json(self, filepath: str) -> List[Dict]:
        with open(filepath, 'r', encoding='utf-8') as fp:
            return json.load(fp)

    def _save_json(self, filepath: str, data: List[Dict]):
        with open(filepath, 'w', encoding='utf-8') as fp:
            json.dump(data, fp, ensure_ascii=False, indent=2)

    def save_point(self, point: Point):
        points = self._load_json(self.points_file)
        point_dict = self._point_to_dict(point)
        for i, p in enumerate(points):
            if p['id'] == point.id:
                points[i] = point_dict
                break
        else:
            points.append(point_dict)
        self._save_json(self.points_file, points)

    def get_point(self, point_id: str) -> Optional[Point]:
        points = self._load_json(self.points_file)
        for p in points:
            if p['id'] == point_id:
                return self._dict_to_point(p)
        return None

    def get_all_points(self) -> List[Point]:
        points = self._load_json(self.points_file)
        return [self._dict_to_point(p) for p in points]

    def save_street(self, street: Street):
        streets = self._load_json(self.streets_file)
        street_dict = self._street_to_dict(street)
        for i, s in enumerate(streets):
            if s['id'] == street.id:
                streets[i] = street_dict
                break
        else:
            streets.append(street_dict)
        self._save_json(self.streets_file, streets)

    def get_all_streets(self) -> List[Street]:
        streets = self._load_json(self.streets_file)
        return [self._dict_to_street(s) for s in streets]

    def get_street(self, street_id: str) -> Optional[Street]:
        streets = self._load_json(self.streets_file)
        for s in streets:
            if s['id'] == street_id:
                return self._dict_to_street(s)
        return None

    def save_complaint(self, complaint: Complaint):
        complaints = self._load_json(self.complaints_file)
        complaint_dict = self._complaint_to_dict(complaint)
        for i, c in enumerate(complaints):
            if c['id'] == complaint.id:
                complaints[i] = complaint_dict
                break
        else:
            complaints.append(complaint_dict)
        self._save_json(self.complaints_file, complaints)

    def get_complaint(self, complaint_id: str) -> Optional[Complaint]:
        complaints = self._load_json(self.complaints_file)
        for c in complaints:
            if c['id'] == complaint_id:
                return self._dict_to_complaint(c)
        return None

    def get_complaint_by_no(self, complaint_no: str) -> Optional[Complaint]:
        complaints = self._load_json(self.complaints_file)
        for c in complaints:
            if c['complaint_no'] == complaint_no:
                return self._dict_to_complaint(c)
        return None

    def get_all_complaints(self) -> List[Complaint]:
        complaints = self._load_json(self.complaints_file)
        return [self._dict_to_complaint(c) for c in complaints]

    def clear_all(self):
        for f in [self.points_file, self.streets_file, self.complaints_file]:
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump([], fp, ensure_ascii=False, indent=2)

    def _point_to_dict(self, point: Point) -> Dict:
        return {
            'id': point.id,
            'name': point.name,
            'lng': point.lng,
            'lat': point.lat,
            'address': point.address,
            'point_type': point.point_type.value,
            'street_ids': point.street_ids,
            'is_on_boundary': point.is_on_boundary,
            'status': point.status.value,
            'complaint_id': point.complaint_id,
            'notes': point.notes,
            'review_records': [self._record_to_dict(r) for r in point.review_records],
            'created_at': point.created_at,
            'service_radius': point.service_radius
        }

    def _dict_to_point(self, d: Dict) -> Point:
        return Point(
            id=d['id'],
            name=d['name'],
            lng=d['lng'],
            lat=d['lat'],
            address=d['address'],
            point_type=PointType(d['point_type']),
            street_ids=d.get('street_ids', []),
            is_on_boundary=d.get('is_on_boundary', False),
            status=ReviewStatus(d['status']),
            complaint_id=d.get('complaint_id'),
            notes=d.get('notes', []),
            review_records=[self._dict_to_record(r) for r in d.get('review_records', [])],
            created_at=d.get('created_at', ''),
            service_radius=d.get('service_radius', 500.0)
        )

    def _street_to_dict(self, street: Street) -> Dict:
        return {
            'id': street.id,
            'name': street.name,
            'boundary': street.boundary,
            'color': street.color
        }

    def _dict_to_street(self, d: Dict) -> Street:
        return Street(
            id=d['id'],
            name=d['name'],
            boundary=[tuple(p) for p in d['boundary']],
            color=d.get('color', '#3498db')
        )

    def _complaint_to_dict(self, complaint: Complaint) -> Dict:
        return {
            'id': complaint.id,
            'complaint_no': complaint.complaint_no,
            'point_id': complaint.point_id,
            'description': complaint.description,
            'reporter': complaint.reporter,
            'report_date': complaint.report_date,
            'source': complaint.source
        }

    def _dict_to_complaint(self, d: Dict) -> Complaint:
        return Complaint(
            id=d['id'],
            complaint_no=d['complaint_no'],
            point_id=d['point_id'],
            description=d['description'],
            reporter=d['reporter'],
            report_date=d['report_date'],
            source=d.get('source', '12345热线')
        )

    def _record_to_dict(self, record) -> Dict:
        return {
            'id': record.id,
            'point_id': record.point_id,
            'action': record.action,
            'operator': record.operator,
            'timestamp': record.timestamp,
            'note': record.note,
            'before_status': record.before_status,
            'after_status': record.after_status
        }

    def _dict_to_record(self, d: Dict):
        from .models import ReviewRecord
        return ReviewRecord(
            id=d['id'],
            point_id=d['point_id'],
            action=d['action'],
            operator=d['operator'],
            timestamp=d['timestamp'],
            note=d.get('note', ''),
            before_status=d.get('before_status'),
            after_status=d.get('after_status')
        )
