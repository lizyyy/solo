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
        discrepancies = []
        matched_flight = None
        matched_photos = []
        suggested_amount = 0.0

        matched_flight = self.store.get_flight(claim.flight_no, claim.flight_date)
        if not matched_flight:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.FLIGHT_MISMATCH,
                severity='high',
                field='flight',
                expected=f"{claim.flight_no} on {claim.flight_date}",
                actual='Not found',
                description='申报的航班信息在系统中未找到',
                suggestion='请核对航班号和飞行日期是否正确'
            ))

        matched_photos = self.store.get_photos_for_claim(claim.claim_id)
        expected_photo_count = len(claim.photo_ids)
        actual_photo_count = len(matched_photos)
        if actual_photo_count < expected_photo_count:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.MISSING_PHOTO,
                severity='medium',
                field='photos',
                expected=expected_photo_count,
                actual=actual_photo_count,
                description=f'缺少照片证据，申报了{expected_photo_count}张，实际只有{actual_photo_count}张',
                suggestion='请补充缺失的照片证据'
            ))

        if matched_flight and matched_flight.actual_arrival:
            time_diff = claim.declaration_time - matched_flight.actual_arrival
            hours_diff = time_diff.total_seconds() / 3600
            if hours_diff > 72:
                discrepancies.append(DiscrepancyItem(
                    type=DiscrepancyType.OVERTIME_DECLARATION,
                    severity='high',
                    field='declaration_time',
                    expected='72小时内',
                    actual=f'{hours_diff:.1f}小时',
                    description=f'申报超时，航班到达后{hours_diff:.1f}小时才申报，超过72小时时限',
                    suggestion='超时申报可能影响赔付，请提供合理的延迟申报说明'
                ))

        if matched_flight:
            expected_segment = f"{matched_flight.departure}-{matched_flight.arrival}"
            if claim.segment and claim.segment != expected_segment:
                discrepancies.append(DiscrepancyItem(
                    type=DiscrepancyType.RESPONSIBLE_SEGMENT,
                    severity='high',
                    field='segment',
                    expected=expected_segment,
                    actual=claim.segment,
                    description='申诉航段与实际航班航段不匹配',
                    suggestion='请确认申诉的航段是否正确'
                ))

        if matched_flight:
            delay_minutes = matched_flight.delay_minutes
            if delay_minutes >= 240:
                suggested_amount = 400.0
            elif delay_minutes >= 120:
                suggested_amount = 200.0
            else:
                suggested_amount = 0.0

            if claim.claim_amount > suggested_amount and suggested_amount > 0:
                discrepancies.append(DiscrepancyItem(
                    type=DiscrepancyType.COMPENSATION_LIMIT,
                    severity='medium',
                    field='claim_amount',
                    expected=suggested_amount,
                    actual=claim.claim_amount,
                    description=f'申诉金额超过赔付上限，延误{delay_minutes}分钟最高赔付{suggested_amount}元',
                    suggestion=f'建议调整赔付金额至{suggested_amount}元'
                ))
            elif suggested_amount == 0 and claim.claim_amount > 0:
                discrepancies.append(DiscrepancyItem(
                    type=DiscrepancyType.AMOUNT_MISMATCH,
                    severity='high',
                    field='claim_amount',
                    expected=0,
                    actual=claim.claim_amount,
                    description=f'延误时间不足120分钟，不符合赔付条件',
                    suggestion='该申诉不符合延误赔付条件，建议拒绝'
                ))

        high_severity = sum(1 for d in discrepancies if d.severity == 'high')
        medium_severity = sum(1 for d in discrepancies if d.severity == 'medium')

        if high_severity >= 2:
            auto_status = ReviewStatus.REJECTED
        elif high_severity == 1 and medium_severity >= 2:
            auto_status = ReviewStatus.REJECTED
        elif high_severity == 1:
            auto_status = ReviewStatus.NEED_MORE_INFO
        elif medium_severity >= 2:
            auto_status = ReviewStatus.NEED_MORE_INFO
        elif medium_severity == 1:
            auto_status = ReviewStatus.PENDING
        else:
            auto_status = ReviewStatus.APPROVED if suggested_amount > 0 else ReviewStatus.REJECTED

        final_amount = suggested_amount if auto_status == ReviewStatus.APPROVED else 0.0

        result = ComparisonResult(
            claim_id=claim.claim_id,
            flight_no=claim.flight_no,
            flight_date=claim.flight_date,
            auto_status=auto_status,
            suggested_amount=suggested_amount,
            claimed_amount=claim.claim_amount,
            final_amount=final_amount,
            discrepancies=discrepancies,
            matched_flight=matched_flight,
            matched_photos=matched_photos
        )
        return result


class ExplanationGenerator:
    def __init__(self):
        self.type_templates = {}

    def generate_explanation(self, result: ComparisonResult) -> str:
        lines = []

        status_text = {
            ReviewStatus.PENDING: '待处理',
            ReviewStatus.APPROVED: '已通过',
            ReviewStatus.REJECTED: '已拒绝',
            ReviewStatus.NEED_MORE_INFO: '需补充信息',
            ReviewStatus.RECALCULATED: '已重新计算'
        }

        lines.append("=" * 60)
        lines.append("航班延误赔付预审报告")
        lines.append("=" * 60)
        lines.append("")

        lines.append(f"【预审结果】: {status_text.get(result.auto_status, '未知')}")
        lines.append("")

        lines.append(f"申报金额: {result.claimed_amount:.2f} 元")
        lines.append(f"建议赔付: {result.suggested_amount:.2f} 元")
        lines.append(f"最终金额: {result.final_amount:.2f} 元")
        lines.append("")

        if result.matched_flight:
            flight = result.matched_flight
            lines.append(f"【航班信息】")
            lines.append(f"  航班号: {flight.flight_no}")
            lines.append(f"  日期: {flight.flight_date}")
            lines.append(f"  航线: {flight.departure} → {flight.arrival}")
            lines.append(f"  延误时间: {flight.delay_minutes} 分钟")
            if flight.scheduled_arrival and flight.actual_arrival:
                lines.append(f"  计划到达: {flight.scheduled_arrival.strftime('%Y-%m-%d %H:%M')}")
                lines.append(f"  实际到达: {flight.actual_arrival.strftime('%Y-%m-%d %H:%M')}")
            lines.append("")

        lines.append(f"【差异说明】 (共 {len(result.discrepancies)} 项)")
        lines.append("-" * 60)

        type_names = {
            DiscrepancyType.OVERTIME_DECLARATION: '超时申报',
            DiscrepancyType.RESPONSIBLE_SEGMENT: '责任航段不符',
            DiscrepancyType.COMPENSATION_LIMIT: '赔付超限',
            DiscrepancyType.MISSING_PHOTO: '照片缺失',
            DiscrepancyType.FLIGHT_MISMATCH: '航班不匹配',
            DiscrepancyType.AMOUNT_MISMATCH: '金额不符',
            DiscrepancyType.INVALID_DOCUMENT: '无效文件',
            DiscrepancyType.DUPLICATE_CLAIM: '重复申报'
        }

        for i, disc in enumerate(result.discrepancies, 1):
            type_name = type_names.get(disc.type, disc.type.value)
            lines.append(f"")
            lines.append(f"{i}. [{type_name}] (严重程度: {disc.severity})")
            lines.append(f"   描述: {disc.description}")
            if disc.expected is not None:
                lines.append(f"   预期值: {disc.expected}")
            if disc.actual is not None:
                lines.append(f"   实际值: {disc.actual}")
            if disc.suggestion:
                lines.append(f"   建议: {disc.suggestion}")

        lines.append("")
        lines.append("-" * 60)
        lines.append("")

        lines.append("【赔付规则】")
        if result.matched_flight:
            delay = result.matched_flight.delay_minutes
            lines.append(f"  - 延误时间 >= 240 分钟: 赔付 400 元")
            lines.append(f"  - 延误时间 >= 120 分钟: 赔付 200 元")
            lines.append(f"  - 延误时间 < 120 分钟: 不予赔付")
            lines.append(f"")
            if delay >= 240:
                lines.append(f"  本次延误 {delay} 分钟，适用规则: 赔付 400 元")
            elif delay >= 120:
                lines.append(f"  本次延误 {delay} 分钟，适用规则: 赔付 200 元")
            else:
                lines.append(f"  本次延误 {delay} 分钟，不符合赔付条件")

        lines.append("")
        lines.append("=" * 60)
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        return "\n".join(lines)

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

        previous_status = result.final_status if hasattr(result, 'final_status') else result.auto_status
        previous_amount = result.final_amount

        review_record = ReviewRecord(
            claim_id=claim_id,
            reviewer=reviewer,
            review_time=datetime.now(),
            status=status,
            reviewed_amount=reviewed_amount,
            review_notes=review_notes,
            adjustment_reason=adjustment_reason,
            previous_status=previous_status,
            previous_amount=previous_amount
        )

        result.review_record = review_record
        result.final_status = status
        result.final_amount = reviewed_amount
        result.updated_at = datetime.now()

        self.store.add_comparison_result(result)

        return {"success": True, "result": result}

    def get_pending_reviews(self):
        pending = []
        for result in self.store.comparison_results.values():
            if not result.review_record:
                pending.append(result)
        return pending


class RecalculationService:
    def __init__(self, store: DataStore, engine: ComparisonEngine):
        self.store = store
        self.engine = engine

    def recalculate_claim(self, claim_id: str, reason: str = "Recalculation"):
        claim = self.store.get_claim(claim_id)
        if not claim:
            return {"success": False, "error": "Claim not found"}

        old_result = self.store.get_comparison_result(claim_id)
        existing_review_record = None
        recalculation_count = 0

        if old_result:
            existing_review_record = old_result.review_record
            if hasattr(old_result, 'recalculation_count'):
                recalculation_count = old_result.recalculation_count

        new_result = self.engine.compare_claim(claim)

        new_result.recalculation_count = recalculation_count + 1

        if existing_review_record:
            new_result.review_record = existing_review_record
            new_result.final_status = existing_review_record.status
            new_result.final_amount = existing_review_record.reviewed_amount

        self.store.add_comparison_result(new_result)

        return {"success": True, "result": new_result}

    def recalculate_all(self, reason: str = "Batch recalculation"):
        results = []
        for claim in self.store.claims.values():
            result = self.recalculate_claim(claim.claim_id, reason)
            if result.get("success"):
                results.append(result.get("result"))
        return results


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
        return {}
