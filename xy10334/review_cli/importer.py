import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from dateutil import parser as date_parser

from .database import Database


class DataImporter:
    def __init__(self, db: Database):
        self.db = db

    def _parse_datetime(self, value: Any) -> Optional[str]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value.isoformat()
        try:
            dt = date_parser.parse(str(value))
            return dt.isoformat()
        except:
            return str(value)

    def _parse_int(self, value: Any) -> Optional[int]:
        if not value or value == '':
            return None
        try:
            return int(value)
        except:
            return None

    def _parse_float(self, value: Any) -> float:
        if not value or value == '':
            return 0.0
        try:
            return float(value)
        except:
            return 0.0

    def import_orders_from_csv(self, file_path: str) -> Dict[str, int]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Order file not found: {file_path}")

        imported = 0
        skipped = 0

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                order_data = {
                    'order_id': row.get('order_id', '').strip(),
                    'platform': row.get('platform', '').strip(),
                    'store_name': row.get('store_name', '').strip(),
                    'order_time': self._parse_datetime(row.get('order_time')),
                    'order_amount': self._parse_float(row.get('order_amount')),
                    'items': row.get('items', '').strip(),
                    'customer_name': row.get('customer_name', '').strip(),
                    'customer_phone': row.get('customer_phone', '').strip(),
                    'address': row.get('address', '').strip(),
                    'kitchen_start_time': self._parse_datetime(row.get('kitchen_start_time')),
                    'kitchen_finish_time': self._parse_datetime(row.get('kitchen_finish_time')),
                    'kitchen_duration_seconds': self._parse_int(row.get('kitchen_duration_seconds')),
                    'rider_pickup_time': self._parse_datetime(row.get('rider_pickup_time')),
                    'delivery_arrive_time': self._parse_datetime(row.get('delivery_arrive_time')),
                    'delivery_duration_seconds': self._parse_int(row.get('delivery_duration_seconds')),
                }

                if not order_data['order_id'] or not order_data['order_time']:
                    skipped += 1
                    continue

                if self.db.insert_order(order_data):
                    imported += 1
                else:
                    skipped += 1

        return {'imported': imported, 'skipped': skipped}

    def import_reviews_from_csv(self, file_path: str) -> Dict[str, int]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Review file not found: {file_path}")

        imported = 0
        skipped = 0

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                review_data = {
                    'order_id': row.get('order_id', '').strip(),
                    'rating': self._parse_int(row.get('rating')) or 0,
                    'review_time': self._parse_datetime(row.get('review_time')),
                    'review_content': row.get('review_content', '').strip(),
                }

                if not review_data['order_id'] or not review_data['review_time']:
                    skipped += 1
                    continue

                if self.db.insert_review(review_data):
                    imported += 1
                else:
                    skipped += 1

        return {'imported': imported, 'skipped': skipped}

    def import_compensations_from_csv(self, file_path: str) -> Dict[str, int]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Compensation file not found: {file_path}")

        imported = 0
        skipped = 0

        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                comp_data = {
                    'order_id': row.get('order_id', '').strip(),
                    'compensation_time': self._parse_datetime(row.get('compensation_time')),
                    'amount': self._parse_float(row.get('amount')),
                    'reason': row.get('reason', '').strip(),
                    'handler': row.get('handler', '').strip(),
                }

                if not comp_data['order_id'] or not comp_data['compensation_time']:
                    skipped += 1
                    continue

                if self.db.insert_compensation(comp_data):
                    imported += 1
                else:
                    skipped += 1

        return {'imported': imported, 'skipped': skipped}

    def import_from_json(self, file_path: str, data_type: str) -> Dict[str, int]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if not isinstance(data, list):
            raise ValueError("JSON file must contain an array of objects")

        imported = 0
        skipped = 0

        for item in data:
            if data_type == 'orders':
                order_data = {
                    'order_id': str(item.get('order_id', '')),
                    'platform': str(item.get('platform', '')),
                    'store_name': str(item.get('store_name', '')),
                    'order_time': self._parse_datetime(item.get('order_time')),
                    'order_amount': self._parse_float(item.get('order_amount')),
                    'items': str(item.get('items', '')),
                    'customer_name': str(item.get('customer_name', '')),
                    'customer_phone': str(item.get('customer_phone', '')),
                    'address': str(item.get('address', '')),
                    'kitchen_start_time': self._parse_datetime(item.get('kitchen_start_time')),
                    'kitchen_finish_time': self._parse_datetime(item.get('kitchen_finish_time')),
                    'kitchen_duration_seconds': self._parse_int(item.get('kitchen_duration_seconds')),
                    'rider_pickup_time': self._parse_datetime(item.get('rider_pickup_time')),
                    'delivery_arrive_time': self._parse_datetime(item.get('delivery_arrive_time')),
                    'delivery_duration_seconds': self._parse_int(item.get('delivery_duration_seconds')),
                }
                if self.db.insert_order(order_data):
                    imported += 1
                else:
                    skipped += 1
            elif data_type == 'reviews':
                review_data = {
                    'order_id': str(item.get('order_id', '')),
                    'rating': self._parse_int(item.get('rating')) or 0,
                    'review_time': self._parse_datetime(item.get('review_time')),
                    'review_content': str(item.get('review_content', '')),
                }
                if self.db.insert_review(review_data):
                    imported += 1
                else:
                    skipped += 1
            elif data_type == 'compensations':
                comp_data = {
                    'order_id': str(item.get('order_id', '')),
                    'compensation_time': self._parse_datetime(item.get('compensation_time')),
                    'amount': self._parse_float(item.get('amount')),
                    'reason': str(item.get('reason', '')),
                    'handler': str(item.get('handler', '')),
                }
                if self.db.insert_compensation(comp_data):
                    imported += 1
                else:
                    skipped += 1

        return {'imported': imported, 'skipped': skipped}
