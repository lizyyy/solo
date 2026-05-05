import csv
import json
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

from tree_patrol.models import (
    TreeRecord,
    PatrolRecord,
    WeatherAlert,
    PruningOrder,
    Complaint
)


class DataLoader:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            self.data_dir = Path(__file__).parent.parent / "data"
        else:
            self.data_dir = Path(data_dir)

    def load_tree_ledger(self, file_path: str = None) -> List[TreeRecord]:
        if file_path is None:
            file_path = self.data_dir / "trees_ledger.csv"
        
        trees = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                tree = TreeRecord(
                    id=row['id'],
                    name=row['name'],
                    location=row['location'],
                    age=int(row['age']),
                    species=row['species'],
                    status=row['status'],
                    last_inspection=datetime.strptime(row['last_inspection'], '%Y-%m-%d') if row['last_inspection'] else None,
                    notes=row['notes'] if row['notes'] else None
                )
                trees.append(tree)
        return trees

    def load_patrol_records(self, file_path: str = None) -> List[PatrolRecord]:
        if file_path is None:
            file_path = self.data_dir / "patrol_records.json"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        records = []
        for item in data:
            record = PatrolRecord(
                id=item['id'],
                tree_id=item['tree_id'],
                inspector=item['inspector'],
                date=datetime.strptime(item['date'], '%Y-%m-%d %H:%M:%S'),
                photos=item.get('photos', []),
                notes=item['notes'],
                issues_found=item.get('issues_found', [])
            )
            records.append(record)
        return records

    def load_weather_alerts(self, file_path: str = None) -> List[WeatherAlert]:
        if file_path is None:
            file_path = self.data_dir / "weather_alerts.json"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        alerts = []
        for item in data:
            alert = WeatherAlert(
                id=item['id'],
                date=datetime.strptime(item['date'], '%Y-%m-%d %H:%M:%S'),
                alert_type=item['alert_type'],
                severity=item['severity'],
                affected_areas=item['affected_areas'],
                description=item['description']
            )
            alerts.append(alert)
        return alerts

    def load_pruning_orders(self, file_path: str = None) -> List[PruningOrder]:
        if file_path is None:
            file_path = self.data_dir / "pruning_orders.csv"
        
        orders = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                order = PruningOrder(
                    id=row['id'],
                    tree_id=row['tree_id'],
                    order_date=datetime.strptime(row['order_date'], '%Y-%m-%d'),
                    scheduled_date=datetime.strptime(row['scheduled_date'], '%Y-%m-%d'),
                    status=row['status'],
                    reason=row['reason'],
                    assigned_to=row['assigned_to']
                )
                orders.append(order)
        return orders

    def load_complaints(self, file_path: str = None) -> List[Complaint]:
        if file_path is None:
            file_path = self.data_dir / "complaints.json"
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        complaints = []
        for item in data:
            complaint = Complaint(
                id=item['id'],
                tree_id=item['tree_id'],
                date=datetime.strptime(item['date'], '%Y-%m-%d %H:%M:%S'),
                reporter=item['reporter'],
                complaint_type=item['complaint_type'],
                description=item['description'],
                status=item.get('status', '待处理')
            )
            complaints.append(complaint)
        return complaints

    def load_all_data(self) -> Dict[str, Any]:
        return {
            'trees': self.load_tree_ledger(),
            'patrols': self.load_patrol_records(),
            'alerts': self.load_weather_alerts(),
            'pruning_orders': self.load_pruning_orders(),
            'complaints': self.load_complaints()
        }
