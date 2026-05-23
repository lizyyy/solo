from typing import Dict, List, Optional
from datetime import datetime, date
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

    def get_all_claims(self) -> List[ClaimRecord]:
        return list(self.claims.values())

    def add_flight(self, flight: FlightInfo):
        key = flight.flight_no + "_" + str(flight.flight_date)
        self.flights[key] = flight

    def get_flight(self, flight_no: str, flight_date: date) -> Optional[FlightInfo]:
        key = flight_no + "_" + str(flight_date)
        return self.flights.get(key)

    def get_all_flights(self) -> List[FlightInfo]:
        return list(self.flights.values())

    def add_photo(self, photo: PhotoIndex):
        self.photos[photo.photo_id] = photo

    def get_photos_for_claim(self, claim_id: str) -> List[PhotoIndex]:
        return [p for p in self.photos.values() if p.claim_id == claim_id]

    def add_rule(self, rule: CompensationRule):
        self.rules[rule.rule_id] = rule

    def get_all_rules(self) -> List[CompensationRule]:
        return list(self.rules.values())

    def add_comparison_result(self, result: ComparisonResult):
        self.comparison_results[result.claim_id] = result

    def get_comparison_result(self, claim_id: str) -> Optional[ComparisonResult]:
        return self.comparison_results.get(claim_id)

    def get_all_comparison_results(self) -> List[ComparisonResult]:
        return list(self.comparison_results.values())

    def add_review(self, claim_id: str, review: ReviewRecord):
        result = self.comparison_results.get(claim_id)
        if result:
            result.review_record = review
            if review.reviewed_amount > 0:
                result.final_amount = review.reviewed_amount

    def clear_all(self):
        self.claims.clear()
        self.flights.clear()
        self.photos.clear()
        self.rules.clear()
        self.comparison_results.clear()


class DataImporter:
    def __init__(self, store: DataStore):
        self.store = store

    def _parse_date(self, value):
        if pd.isna(value) or value is None or str(value).strip() == "":
            return date.today()
        if isinstance(value, date):
            return value
        return pd.to_datetime(value).date()

    def _parse_datetime(self, value):
        if pd.isna(value) or value is None or str(value).strip() == "":
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
                    photo_ids = []
                    if pd.notna(row.get('photo_ids')):
                        photo_str = str(row['photo_ids'])
                        photo_ids = [p.strip() for p in photo_str.split(',') if p.strip()]
                    
                    claim = ClaimRecord(
                        claim_id=str(row['claim_id']),
                        passenger_name=str(row['passenger_name']),
                        id_card=str(row['id_card']),
                        phone=str(row['phone']),
                        flight_no=str(row['flight_no']),
                        flight_date=self._parse_date(row['flight_date']),
                        segment=str(row['segment']),
                        claim_type=str(row['claim_type']),
                        claim_amount=float(row['claim_amount']),
                        declaration_time=self._parse_datetime(row['declaration_time']),
                        incident_description=str(row['incident_description']),
                        photo_ids=photo_ids,
                        remarks=str(row['remarks']) if pd.notna(row.get('remarks')) else None,
                        raw_data=row.to_dict()
                    )
                    self.store.add_claim(claim)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx}: {str(e)}")
            
            return {"success": True, "imported": imported, "total": len(df), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_claims_json(self, json_content: str):
        try:
            data = json.loads(json_content)
            if not isinstance(data, list):
                data = [data]
            
            imported = 0
            errors = []
            
            for idx, item in enumerate(data):
                try:
                    claim = ClaimRecord(**item)
                    self.store.add_claim(claim)
                    imported += 1
                except Exception as e:
                    errors.append(f"Item {idx}: {str(e)}")
            
            return {"success": True, "imported": imported, "total": len(data), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_flights_csv(self, csv_content: str):
        try:
            df = pd.read_csv(StringIO(csv_content))
            imported = 0
            errors = []
            
            for idx, row in df.iterrows():
                try:
                    flight = FlightInfo(
                        flight_no=str(row['flight_no']),
                        flight_date=self._parse_date(row['flight_date']),
                        departure=str(row.get('departure', '')),
                        arrival=str(row.get('arrival', '')),
                        scheduled_departure=self._parse_datetime(row.get('scheduled_departure')),
                        actual_departure=self._parse_datetime(row.get('actual_departure')),
                        scheduled_arrival=self._parse_datetime(row.get('scheduled_arrival')),
                        actual_arrival=self._parse_datetime(row.get('actual_arrival')),
                        aircraft_type=str(row.get('aircraft_type')),
                        is_canceled=bool(row.get('is_canceled', False)),
                        is_diverted=bool(row.get('is_diverted', False)),
                        responsible_airline=str(row.get('responsible_airline')),
                        delay_minutes=int(row.get('delay_minutes', 0)),
                        reason_code=str(row.get('reason_code')),
                        raw_data=row.to_dict()
                    )
                    self.store.add_flight(flight)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx}: {str(e)}")
            
            return {"success": True, "imported": imported, "total": len(df), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_flights_json(self, json_content: str):
        try:
            data = json.loads(json_content)
            if not isinstance(data, list):
                data = [data]
            
            imported = 0
            errors = []
            
            for idx, item in enumerate(data):
                try:
                    if 'flight_date' in item:
                        item['flight_date'] = self._parse_date(item['flight_date'])
                    if 'scheduled_departure' in item:
                        item['scheduled_departure'] = self._parse_datetime(item['scheduled_departure'])
                    if 'actual_departure' in item:
                        item['actual_departure'] = self._parse_datetime(item['actual_departure'])
                    if 'scheduled_arrival' in item:
                        item['scheduled_arrival'] = self._parse_datetime(item['scheduled_arrival'])
                    if 'actual_arrival' in item:
                        item['actual_arrival'] = self._parse_datetime(item['actual_arrival'])
                        
                    flight = FlightInfo(**item)
                    self.store.add_flight(flight)
                    imported += 1
                except Exception as e:
                    errors.append(f"Item {idx}: {str(e)}")
            
            return {"success": True, "imported": imported, "total": len(data), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_photos_index(self, json_content: str):
        try:
            data = json.loads(json_content)
            if not isinstance(data, list):
                data = [data]
            
            imported = 0
            errors = []
            
            for idx, item in enumerate(data):
                try:
                    if 'upload_time' in item:
                        item['upload_time'] = self._parse_datetime(item['upload_time'])
                    
                    photo = PhotoIndex(**item)
                    self.store.add_photo(photo)
                    imported += 1
                except Exception as e:
                    errors.append(f"Item {idx}: {str(e)}")
            
            return {"success": True, "imported": imported, "total": len(data), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def import_rules_json(self, json_content: str):
        try:
            data = json.loads(json_content)
            if not isinstance(data, list):
                data = [data]
            
            imported = 0
            errors = []
            
            for idx, item in enumerate(data):
                try:
                    if 'valid_from' in item:
                        item['valid_from'] = self._parse_date(item['valid_from'])
                    if 'valid_to' in item and item['valid_to']:
                        item['valid_to'] = self._parse_date(item['valid_to'])
                    
                    rule = CompensationRule(**item)
                    self.store.add_rule(rule)
                    imported += 1
                except Exception as e:
                    errors.append(f"Item {idx}: {str(e)}")
            
            return {"success": True, "imported": imported, "total": len(data), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}


class ComparisonEngine:
    def __init__(self, store: DataStore):
        self.store = store

    def compare_all(self):
        results = []
        for claim in self.store.claims.values():
            result = self.compare_claim(claim)
            self.store.add_comparison_result(result)
            results.append(result)
        return results

    def compare_claim(self, claim: ClaimRecord) -> ComparisonResult:
        result = ComparisonResult(
            claim_id=claim.claim_id,
            flight_no=claim.flight_no,
            flight_date=claim.flight_date,
            auto_status=ReviewStatus.PENDING,
            suggested_amount=0.0,
            claimed_amount=claim.claim_amount,
            final_amount=0.0
        )
        return result


class ExplanationGenerator:
    def __init__(self):
        self.type_templates = {}

    def generate_explanation(self, result: ComparisonResult) -> str:
        return ""

    def generate_short_summary(self, result: ComparisonResult) -> str:
        if not result.discrepancies:
            return "No discrepancies"
        return f"{len(result.discrepancies)} discrepancy items"


class ReviewService:
    def __init__(self, store: DataStore):
        self.store = store

    def review_claim(self, claim_id: str, reviewer: str, status: ReviewStatus, reviewed_amount: float, review_notes: str, adjustment_reason: str = None):
        result = self.store.get_comparison_result(claim_id)
        if not result:
            return {"success": False, "error": "Claim not found"}
        return {"success": True, "result": result}

    def get_pending_reviews(self):
        return []


class RecalculationService:
    def __init__(self, store: DataStore, engine: ComparisonEngine):
        self.store = store
        self.engine = engine

    def recalculate_claim(self, claim_id: str, reason: str = "Recalculation"):
        return {"success": True}

    def recalculate_all(self, reason: str = "Batch recalculation"):
        return []


class ReportGenerator:
    def __init__(self, store: DataStore, explainer: ExplanationGenerator):
        self.store = store
        self.explainer = explainer

    def generate_detail_report(self, claim_id: str):
        claim = self.store.get_claim(claim_id)
        if not claim:
            return {"success": False, "error": "Claim not found"}
        
        result = self.store.get_comparison_result(claim_id)
        return {
            "success": True,
            "claim": claim.model_dump(),
            "comparison_result": result.model_dump() if result else None
        }

    def generate_summary(self):
        summary = ReconciliationSummary(batch_id=self.store.batch_id)
        
        for result in self.store.comparison_results.values():
            summary.total_claims += 1
            summary.total_claimed_amount += result.claimed_amount
            summary.total_suggested_amount += result.suggested_amount
            summary.total_approved_amount += result.final_amount

            status = result.review_record.status if result.review_record else result.auto_status

            if status == ReviewStatus.APPROVED:
                summary.approved_count += 1
            elif status == ReviewStatus.REJECTED:
                summary.rejected_count += 1
            elif status == ReviewStatus.NEED_MORE_INFO:
                summary.need_more_info_count += 1
            else:
                summary.pending_count += 1

            for disc in result.discrepancies:
                key = disc.type.value
                summary.discrepancy_breakdown[key] = summary.discrepancy_breakdown.get(key, 0) + 1

        return summary

    def export_to_csv(self, output_path: str):
        return {"success": True}

    def export_to_excel(self, output_path: str):
        return {"success": True}

    def generate_json_report(self):
        return {}
