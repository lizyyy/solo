services_content = '''from typing import Dict, List, Optional
from datetime import datetime, date, timedelta
import uuid
import pandas as pd
import json
from io import StringIO
from app.models import (
    ClaimRecord, FlightInfo, PhotoIndex, CompensationRule,
    ComparisonResult, ReviewRecord, ReconciliationSummary,
    ReviewStatus, DiscrepancyType, DiscrepancyItem
)


class DataStore:
    def __init__(self):
        self.claims: Dict[str, ClaimRecord] = {}
        self.flights: Dict[str, FlightInfo] = {}
        self.photos: Dict[str, PhotoIndex] = {}
        self.rules: Dict[str, CompensationRule] = {}
        self.comparison_results: Dict[str, ComparisonResult] = {}
        self.batch_id: str = str(uuid.uuid4())[:8]

    def add_claim(self, claim: ClaimRecord):
        self.claims[claim.claim_id] = claim

    def get_claim(self, claim_id: str) -> Optional[ClaimRecord]:
        return self.claims.get(claim_id)

    def add_flight(self, flight: FlightInfo):
        key = f"{flight.flight_no}_{flight.flight_date}"
        self.flights[key] = flight

    def get_flight(self, flight_no: str, flight_date: date) -> Optional[FlightInfo]:
        key = f"{flight_no}_{flight_date}"
        return self.flights.get(key)

    def add_photo(self, photo: PhotoIndex):
        self.photos[photo.photo_id] = photo

    def get_photos_for_claim(self, claim_id: str) -> List[PhotoIndex]:
        return [p for p in self.photos.values() if p.claim_id == claim_id]

    def add_comparison_result(self, result: ComparisonResult):
        self.comparison_results[result.claim_id] = result

    def get_comparison_result(self, claim_id: str) -> Optional[ComparisonResult]:
        return self.comparison_results.get(claim_id)

    def add_review(self, claim_id: str, review: ReviewRecord):
        result = self.comparison_results.get(claim_id)
        if result:
            result.review_record = review
            result.final_status = review.status
            if review.reviewed_amount > 0:
                result.final_amount = review.reviewed_amount


class DataImporter:
    def __init__(self, store: DataStore):
        self.store = store

    def _parse_date(self, value):
        if pd.isna(value):
            return date.today()
        if isinstance(value, date):
            return value
        return pd.to_datetime(value).date()

    def _parse_datetime(self, value):
        if pd.isna(value) or value is None or str(value).strip() == '':
            return datetime.now()
        if isinstance(value, datetime):
            return value
        return pd.to_datetime(value).to_pydatetime()

    def import_claims_csv(self, csv_content: str):
        try:
            df = pd.read_csv(StringIO(csv_content))
            imported = 0
            errors = []
            for idx, row in df.iterrows():
                try:
                    claim = ClaimRecord(
                        claim_id=str(row.get('claim_id', f'CLAIM_{idx}')),
                        passenger_name=str(row.get('passenger_name', '')),
                        passenger_id=str(row.get('passenger_id', '')),
                        flight_no=str(row.get('flight_no', '')),
                        flight_date=self._parse_date(row.get('flight_date')),
                        segment=str(row.get('segment', '')),
                        claim_amount=float(row.get('claim_amount', 0)),
                        claim_type=str(row.get('claim_type', '')),
                        declaration_time=self._parse_datetime(row.get('declaration_time')),
                        incident_description=str(row.get('incident_description', ''))
                    )
                    self.store.add_claim(claim)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx}: {str(e)}")
            return {"success": True, "imported": imported, "total": len(df), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_flights_json(self, json_content: str):
        try:
            data = json.loads(json_content)
            flights = data if isinstance(data, list) else data.get("flights", [])
            imported = 0
            errors = []
            for idx, flight_data in enumerate(flights):
                try:
                    flight = FlightInfo(
                        flight_no=str(flight_data.get("flight_no", "")),
                        flight_date=self._parse_date(flight_data.get("flight_date")),
                        departure=str(flight_data.get("departure", "")),
                        arrival=str(flight_data.get("arrival", "")),
                        scheduled_departure=self._parse_datetime(flight_data.get("scheduled_departure")),
                        scheduled_arrival=self._parse_datetime(flight_data.get("scheduled_arrival")),
                        actual_departure=self._parse_datetime(flight_data.get("actual_departure")),
                        actual_arrival=self._parse_datetime(flight_data.get("actual_arrival")),
                        delay_minutes=int(flight_data.get("delay_minutes", 0)),
                        aircraft_type=str(flight_data.get("aircraft_type", "")),
                        is_regional=bool(flight_data.get("is_regional", False))
                    )
                    self.store.add_flight(flight)
                    imported += 1
                except Exception as e:
                    errors.append(f"Flight {idx}: {str(e)}")
            return {"success": True, "imported": imported, "total": len(flights), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_photos_index(self, json_content: str):
        try:
            data = json.loads(json_content)
            photos = data if isinstance(data, list) else data.get("photos", [])
            imported = 0
            errors = []
            for idx, photo_data in enumerate(photos):
                try:
                    photo = PhotoIndex(
                        photo_id=str(photo_data.get("photo_id", "")),
                        claim_id=str(photo_data.get("claim_id", "")),
                        file_name=str(photo_data.get("file_name", "")),
                        file_path=str(photo_data.get("file_path", "")),
                        upload_time=self._parse_datetime(photo_data.get("upload_time")),
                        photo_type=str(photo_data.get("photo_type", "")),
                        is_valid=bool(photo_data.get("is_valid", True)),
                        ocr_text=str(photo_data.get("ocr_text", "")) if photo_data.get("ocr_text") else None
                    )
                    self.store.add_photo(photo)
                    imported += 1
                except Exception as e:
                    errors.append(f"Photo {idx}: {str(e)}")
            return {"success": True, "imported": imported, "total": len(photos), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}
'''

with open('app/services.py', 'w') as f:
    f.write(services_content)
print('Part 1 completed')
