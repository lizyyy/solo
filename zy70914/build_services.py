#!/usr/bin/env python3
# -*- coding: utf-8 -*-

def build_services():
    parts = []
    
    parts.append('''from typing import Dict, List, Optional
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

    def update_claim(self, claim_id: str, **kwargs):
        if claim_id in self.claims:
            claim_data = self.claims[claim_id].model_dump()
            claim_data.update(kwargs)
            self.claims[claim_id] = ClaimRecord(**claim_data)

    def delete_claim(self, claim_id: str) -> bool:
        if claim_id in self.claims:
            del self.claims[claim_id]
            return True
        return False

    def add_flight(self, flight: FlightInfo):
        key = f"{flight.flight_no}_{flight.flight_date}"
        self.flights[key] = flight

    def get_flight(self, flight_no: str, flight_date: date) -> Optional[FlightInfo]:
        key = f"{flight_no}_{flight_date}"
        return self.flights.get(key)

    def get_all_flights(self) -> List[FlightInfo]:
        return list(self.flights.values())

    def add_photo(self, photo: PhotoIndex):
        self.photos[photo.photo_id] = photo

    def get_photo(self, photo_id: str) -> Optional[PhotoIndex]:
        return self.photos.get(photo_id)

    def get_photos_for_claim(self, claim_id: str) -> List[PhotoIndex]:
        return [p for p in self.photos.values() if p.claim_id == claim_id]

    def add_rule(self, rule: CompensationRule):
        self.rules[rule.rule_id] = rule

    def get_rule(self, rule_id: str) -> Optional[CompensationRule]:
        return self.rules.get(rule_id)

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


''')
    
    parts.append('''class DataImporter:
    def __init__(self, store: DataStore):
        self.store = store

    def _parse_date(self, value):
        if pd.isna(value) or value is None or str(value).strip() == '':
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
                    photo_ids = str(row.get('photo_ids', '')).split(',') if row.get('photo_ids') else []
                    photo_ids = [pid.strip() for pid in photo_ids if pid.strip()]
                    
                    claim = ClaimRecord(
                        claim_id=str(row.get('claim_id', f'CLAIM_{idx}')),
                        passenger_name=str(row.get('passenger_name', '')),
                        id_card=str(row.get('id_card', '')),
                        phone=str(row.get('phone', '')),
                        flight_no=str(row.get('flight_no', '')),
                        flight_date=self._parse_date(row.get('flight_date')),
                        segment=str(row.get('segment', '')),
                        claim_type=str(row.get('claim_type', '')),
                        claim_amount=float(row.get('claim_amount', 0)),
                        declaration_time=self._parse_datetime(row.get('declaration_time')),
                        incident_description=str(row.get('incident_description', '')),
                        photo_ids=photo_ids,
                        remarks=str(row.get('remarks', '')) if row.get('remarks') else None,
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
            claims = data if isinstance(data, list) else data.get("claims", [])
            imported = 0
            errors = []
            for idx, claim_data in enumerate(claims):
                try:
                    claim = ClaimRecord(**claim_data)
                    self.store.add_claim(claim)
                    imported += 1
                except Exception as e:
                    errors.append(f"Claim {idx}: {str(e)}")
            return {"success": True, "imported": imported, "total": len(claims), "errors": errors}
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
                        flight_no=str(row.get('flight_no', '')),
                        flight_date=self._parse_date(row.get('flight_date')),
                        departure=str(row.get('departure', '')),
                        arrival=str(row.get('arrival', '')),
                        scheduled_departure=self._parse_datetime(row.get('scheduled_departure')),
                        actual_departure=self._parse_datetime(row.get('actual_departure')),
                        scheduled_arrival=self._parse_datetime(row.get('scheduled_arrival')),
                        actual_arrival=self._parse_datetime(row.get('actual_arrival')),
                        aircraft_type=str(row.get('aircraft_type', '')) if row.get('aircraft_type') else None,
                        is_canceled=bool(row.get('is_canceled', False)),
                        is_diverted=bool(row.get('is_diverted', False)),
                        responsible_airline=str(row.get('responsible_airline', '')) if row.get('responsible_airline') else None,
                        delay_minutes=int(row.get('delay_minutes', 0)),
                        reason_code=str(row.get('reason_code', '')) if row.get('reason_code') else None,
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
            flights = data if isinstance(data, list) else data.get("flights", [])
            imported = 0
            errors = []
            for idx, flight_data in enumerate(flights):
                try:
                    flight = FlightInfo(**flight_data)
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

    def import_rules_json(self, json_content: str):
        try:
            data = json.loads(json_content)
            rules = data if isinstance(data, list) else data.get("rules", [])
            imported = 0
            errors = []
            for idx, rule_data in enumerate(rules):
                try:
                    rule = CompensationRule(**rule_data)
                    self.store.add_rule(rule)
                    imported += 1
                except Exception as e:
                    errors.append(f"Rule {idx}: {str(e)}")
            return {"success": True, "imported": imported, "total": len(rules), "errors": errors}
        except Exception as e:
            return {"success": False, "error": str(e)}


''')
    
    parts.append('''class ComparisonEngine:
    def __init__(self, store: DataStore):
        self.store = store
        self.declaration_timeout_hours = 72
        self.min_required_photos = 2

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
        discrepancies = []
        applicable_rules = []

        matched_flight = self.store.get_flight(claim.flight_no, claim.flight_date)
        matched_photos = self.store.get_photos_for_claim(claim.claim_id)

        if matched_flight:
            result.matched_flight = matched_flight
        else:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.FLIGHT_MISMATCH,
                severity="high",
                field="flight_info",
                expected=f"{claim.flight_no} on {claim.flight_date}",
                actual=None,
                description="未找到匹配的航班信息",
                suggestion="请核对航班号和日期是否正确"
            ))

        valid_photos = [p for p in matched_photos if p.is_valid]
        result.matched_photos = matched_photos
        if len(valid_photos) < self.min_required_photos:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.MISSING_PHOTO,
                severity="medium",
                field="photos",
                expected=f"至少{self.min_required_photos}张有效照片",
                actual=f"{len(valid_photos)}张",
                description="照片数量不足",
                suggestion="请补充事件凭证、登机牌等证明材料"
            ))

        self._check_overtime_declaration(claim, matched_flight, discrepancies)
        self._check_responsible_segment(claim, matched_flight, discrepancies)
        suggested_amount = self._calculate_compensation(claim, matched_flight, discrepancies, applicable_rules)

        result.suggested_amount = suggested_amount
        result.discrepancies = discrepancies
        result.applicable_rules = applicable_rules
        result.auto_status = self._determine_auto_status(discrepancies)
        result.final_amount = suggested_amount

        return result

    def _check_overtime_declaration(self, claim, matched_flight, discrepancies):
        if not matched_flight:
            return
        flight_end_time = matched_flight.actual_arrival or matched_flight.scheduled_arrival
        if not flight_end_time:
            return
        time_diff = claim.declaration_time - flight_end_time
        hours_diff = time_diff.total_seconds() / 3600
        if hours_diff > self.declaration_timeout_hours:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.OVERTIME_DECLARATION,
                severity="high",
                field="declaration_time",
                expected=f"航班到达后{self.declaration_timeout_hours}小时内",
                actual=f"{round(hours_diff, 1)}小时后",
                description="超出申报时限",
                suggestion=f"旅客应在航班到达后{self.declaration_timeout_hours}小时内申报，此申请已超时"
            ))

    def _check_responsible_segment(self, claim, matched_flight, discrepancies):
        if not matched_flight:
            return
        claim_segment = claim.segment.upper() if claim.segment else ""
        flight_segment = (matched_flight.departure + "-" + matched_flight.arrival).upper()
        if claim_segment and claim_segment not in flight_segment and flight_segment not in claim_segment:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.RESPONSIBLE_SEGMENT,
                severity="medium",
                field="segment",
                expected=flight_segment,
                actual=claim_segment,
                description="责任航段不匹配",
                suggestion="申诉航段与实际飞行航段不符，请确认是否为联程航班责任"
            ))

    def _calculate_compensation(self, claim, matched_flight, discrepancies, applicable_rules):
        suggested_amount = 0
        if not matched_flight:
            return suggested_amount
        
        delay_minutes = matched_flight.delay_minutes
        
        rules = self.store.get_all_rules()
        for rule in rules:
            if rule.claim_type != claim.claim_type:
                continue
            if rule.min_delay_minutes <= delay_minutes:
                if rule.max_delay_minutes is None or delay_minutes <= rule.max_delay_minutes:
                    suggested_amount = rule.compensation_amount
                    applicable_rules.append(rule)
                    break
        
        if not applicable_rules:
            if delay_minutes >= 240:
                suggested_amount = 400
            elif delay_minutes >= 120:
                suggested_amount = 200

        if claim.claim_amount > suggested_amount > 0:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.COMPENSATION_LIMIT,
                severity="medium",
                field="claim_amount",
                expected=f"{suggested_amount}元",
                actual=f"{claim.claim_amount}元",
                description="超出赔付标准上限",
                suggestion=f"根据延误{delay_minutes}分钟，标准赔付为{suggested_amount}元"
            ))
        elif claim.claim_amount < suggested_amount and claim.claim_amount > 0:
            discrepancies.append(DiscrepancyItem(
                type=DiscrepancyType.AMOUNT_MISMATCH,
                severity="low",
                field="claim_amount",
                expected=f"{suggested_amount}元",
                actual=f"{claim.claim_amount}元",
                description="申报金额低于标准赔付",
                suggestion=f"根据延误{delay_minutes}分钟，标准赔付为{suggested_amount}元，可按标准赔付"
            ))
        
        return suggested_amount

    def _determine_auto_status(self, discrepancies):
        if not discrepancies:
            return ReviewStatus.APPROVED
        
        high_severity = [d for d in discrepancies if d.severity == "high"]
        medium_severity = [d for d in discrepancies if d.severity == "medium"]
        
        if len(high_severity) >= 2:
            return ReviewStatus.REJECTED
        if len(high_severity) == 1 or len(medium_severity) >= 2:
            return ReviewStatus.NEED_MORE_INFO
        return ReviewStatus.PENDING


''')
    
    parts.append('''class ExplanationGenerator:
    def __init__(self):
        self.type_templates = {
            DiscrepancyType.OVERTIME_DECLARATION: self._overtime_template,
            DiscrepancyType.RESPONSIBLE_SEGMENT: self._segment_template,
            DiscrepancyType.COMPENSATION_LIMIT: self._compensation_template,
            DiscrepancyType.MISSING_PHOTO: self._photo_template,
            DiscrepancyType.FLIGHT_MISMATCH: self._flight_template,
            DiscrepancyType.AMOUNT_MISMATCH: self._amount_template,
            DiscrepancyType.INVALID_DOCUMENT: self._document_template,
            DiscrepancyType.DUPLICATE_CLAIM: self._duplicate_template
        }
        self.status_text = {
            ReviewStatus.PENDING: "待复核",
            ReviewStatus.APPROVED: "自动通过",
            ReviewStatus.REJECTED: "建议拒绝",
            ReviewStatus.NEED_MORE_INFO: "需补充材料",
            ReviewStatus.RECALCULATED: "已重新计算"
        }

    def generate_explanation(self, result: ComparisonResult) -> str:
        parts = []
        status_text = self.status_text.get(result.auto_status, str(result.auto_status))
        parts.append(f"【预审结果】{status_text}")
        parts.append(f"申报金额：{result.claimed_amount}元，建议金额：{result.suggested_amount}元")
        
        if result.matched_flight:
            flight = result.matched_flight
            parts.append(f"【航班信息】{flight.flight_no} {flight.flight_date} {flight.departure}-{flight.arrival}")
            if flight.delay_minutes > 0:
                parts.append(f"延误时间：{flight.delay_minutes}分钟")
        
        if result.discrepancies:
            parts.append("")
            parts.append("【差异说明】")
            for i, disc in enumerate(result.discrepancies, 1):
                template = self.type_templates.get(disc.type, self._default_template)
                parts.append(f"{i}. {template(disc)}")
        else:
            parts.append("")
            parts.append("【差异说明】无差异，符合自动放行条件")
        
        if result.applicable_rules:
            parts.append("")
            parts.append("【适用规则】")
            for rule in result.applicable_rules:
                parts.append(f"- {rule.rule_name}: {rule.description}")
        
        if result.review_record:
            parts.append("")
            parts.append("【人工复核】")
            parts.append(f"复核人：{result.review_record.reviewer}")
            parts.append(f"复核状态：{self.status_text.get(result.review_record.status, str(result.review_record.status))}")
            parts.append(f"复核金额：{result.review_record.reviewed_amount}元")
            parts.append(f"复核意见：{result.review_record.review_notes}")
            if result.review_record.adjustment_reason:
                parts.append(f"调整原因：{result.review_record.adjustment_reason}")
        
        return "\\n".join(parts)

    def _overtime_template(self, disc):
        return f"超时申报 - {disc.description}。预期：{disc.expected}，实际：{disc.actual}。建议：{disc.suggestion}"

    def _segment_template(self, disc):
        return f"责任航段不匹配 - {disc.description}。航班实际航段：{disc.expected}，申诉航段：{disc.actual}。建议：{disc.suggestion}"

    def _compensation_template(self, disc):
        return f"赔付超限 - {disc.description}。标准赔付：{disc.expected}，申诉金额：{disc.actual}。建议：{disc.suggestion}"

    def _photo_template(self, disc):
        return f"材料不足 - {disc.description}。需要：{disc.expected}，提供：{disc.actual}。建议：{disc.suggestion}"

    def _flight_template(self, disc):
        return f"航班信息缺失 - {disc.description}。申诉航班：{disc.expected}。建议：{disc.suggestion}"

    def _amount_template(self, disc):
        return f"金额不符 - {disc.description}。预期：{disc.expected}，实际：{disc.actual}。建议：{disc.suggestion}"

    def _document_template(self, disc):
        return f"凭证无效 - {disc.description}。建议：{disc.suggestion}"

    def _duplicate_template(self, disc):
        return f"重复申诉 - {disc.description}。该旅客已存在相同申诉记录"

    def _default_template(self, disc):
        return f"{disc.description} - 建议：{disc.suggestion or '请人工核实'}"

    def generate_short_summary(self, result: ComparisonResult) -> str:
        if not result.discrepancies:
            return "无差异"
        types = [d.description for d in result.discrepancies[:3]]
        summary = "、".join(types)
        if len(result.discrepancies) > 3:
            summary += f"等共{len(result.discrepancies)}项差异"
        return summary


''')
    
    parts.append('''class ReviewService:
    def __init__(self, store: DataStore):
        self.store = store

    def review_claim(self, claim_id: str, reviewer: str, status: ReviewStatus, 
                     reviewed_amount: float, review_notes: str, adjustment_reason: str = None):
        result = self.store.get_comparison_result(claim_id)
        if not result:
            return {"success": False, "error": "未找到该申诉记录"}
        
        claim = self.store.get_claim(claim_id)
        if not claim:
            return {"success": False, "error": "未找到该申诉的原始记录"}
        
        previous_status = result.review_record.status if result.review_record else result.auto_status
        previous_amount = result.review_record.reviewed_amount if result.review_record else result.suggested_amount
        
        review = ReviewRecord(
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
        
        self.store.add_review(claim_id, review)
        updated_result = self.store.get_comparison_result(claim_id)
        
        return {"success": True, "result": updated_result}

    def batch_review(self, claim_ids: List[str], reviewer: str, status: ReviewStatus, 
                     review_notes: str, reviewed_amount: float = None):
        results = []
        for claim_id in claim_ids:
            result = self.store.get_comparison_result(claim_id)
            amount = reviewed_amount if reviewed_amount is not None else (result.suggested_amount if result else 0)
            review_result = self.review_claim(claim_id, reviewer, status, amount, review_notes)
            results.append(review_result)
        return results

    def get_pending_reviews(self) -> List[ComparisonResult]:
        pending_statuses = [ReviewStatus.PENDING, ReviewStatus.NEED_MORE_INFO]
        pending = []
        for result in self.store.get_all_comparison_results():
            current_status = result.review_record.status if result.review_record else result.auto_status
            if current_status in pending_statuses:
                pending.append(result)
        return sorted(pending, key=lambda x: x.created_at)

    def get_review_history(self, claim_id: str) -> Optional[ReviewRecord]:
        result = self.store.get_comparison_result(claim_id)
        if result and result.review_record:
            return result.review_record
        return None


''')
    
    parts.append('''class RecalculationService:
    def __init__(self, store: DataStore, engine: ComparisonEngine):
        self.store = store
        self.engine = engine

    def recalculate_claim(self, claim_id: str, reason: str = "重新计算"):
        claim = self.store.get_claim(claim_id)
        if not claim:
            return {"success": False, "error": "未找到该申诉记录"}
        
        old_result = self.store.get_comparison_result(claim_id)
        new_result = self.engine.compare_claim(claim)
        
        new_result.auto_status = ReviewStatus.RECALCULATED
        new_result.updated_at = datetime.now()
        
        self.store.add_comparison_result(new_result)
        
        return {
            "success": True,
            "result": new_result,
            "previous_suggested_amount": old_result.suggested_amount if old_result else 0,
            "new_suggested_amount": new_result.suggested_amount,
            "previous_discrepancies": len(old_result.discrepancies) if old_result else 0,
            "new_discrepancies": len(new_result.discrepancies)
        }

    def recalculate_all(self, reason: str = "批量重新计算"):
        results = []
        for claim_id in list(self.store.claims.keys()):
            result = self.recalculate_claim(claim_id, reason)
            results.append(result)
        return results

    def recalculate_by_status(self, status: ReviewStatus, reason: str = "按状态重新计算"):
        results = []
        for result in self.store.get_all_comparison_results():
            current_status = result.review_record.status if result.review_record else result.auto_status
            if current_status == status:
                recalc_result = self.recalculate_claim(result.claim_id, reason)
                results.append(recalc_result)
        return results

    def recalculate_with_updated_flight(self, flight_no: str, flight_date: date):
        affected_claims = [
            claim for claim in self.store.get_all_claims()
            if claim.flight_no == flight_no and claim.flight_date == flight_date
        ]
        results = []
        for claim in affected_claims:
            result = self.recalculate_claim(claim.claim_id, f"航班信息更新: {flight_no} {flight_date}")
            results.append(result)
        return results


''')
    
    parts.append('''class ReportGenerator:
    def __init__(self, store: DataStore, explainer: ExplanationGenerator):
        self.store = store
        self.explainer = explainer

    def generate_detail_report(self, claim_id: str):
        result = self.store.get_comparison_result(claim_id)
        if not result:
            return {"success": False, "error": "未找到该申诉记录"}
        
        claim = self.store.get_claim(claim_id)
        explanation = self.explainer.generate_explanation(result)
        
        return {
            "success": True,
            "claim_id": claim_id,
            "passenger_name": claim.passenger_name,
            "flight_no": claim.flight_no,
            "flight_date": str(claim.flight_date),
            "claimed_amount": result.claimed_amount,
            "suggested_amount": result.suggested_amount,
            "final_amount": result.final_amount,
            "auto_status": result.auto_status.value,
            "review_status": result.review_record.status.value if result.review_record else None,
            "explanation": explanation,
            "discrepancies": [d.model_dump() for d in result.discrepancies],
            "review_record": result.review_record.model_dump() if result.review_record else None,
            "flight_info": result.matched_flight.model_dump() if result.matched_flight else None,
            "photo_count": len(result.matched_photos),
            "created_at": result.created_at,
            "updated_at": result.updated_at
        }

    def generate_summary(self) -> ReconciliationSummary:
        total_claims = len(self.store.comparison_results)
        discrepancy_breakdown = {}
        total_claimed = 0.0
        total_approved = 0.0
        total_suggested = 0.0
        
        status_counts = {
            "pending": 0,
            "approved": 0,
            "rejected": 0,
            "need_more_info": 0,
            "recalculated": 0
        }
        
        for result in self.store.comparison_results.values():
            status = result.review_record.status.value if result.review_record else result.auto_status.value
            if status in status_counts:
                status_counts[status] += 1
            
            total_claimed += result.claimed_amount
            total_suggested += result.suggested_amount
            
            if result.review_record and result.review_record.status == ReviewStatus.APPROVED:
                total_approved += result.review_record.reviewed_amount
            elif result.auto_status == ReviewStatus.APPROVED:
                total_approved += result.suggested_amount
            
            for disc in result.discrepancies:
                disc_type = disc.type.value
                discrepancy_breakdown[disc_type] = discrepancy_breakdown.get(disc_type, 0) + 1
        
        return ReconciliationSummary(
            batch_id=self.store.batch_id,
            total_claims=total_claims,
            approved_count=status_counts.get("approved", 0),
            rejected_count=status_counts.get("rejected", 0),
            pending_count=status_counts.get("pending", 0),
            need_more_info_count=status_counts.get("need_more_info", 0),
            total_claimed_amount=total_claimed,
            total_approved_amount=total_approved,
            total_suggested_amount=total_suggested,
            discrepancy_breakdown=discrepancy_breakdown,
            generated_at=datetime.now(),
            generated_by="system"
        )

    def generate_discrepancy_report(self):
        all_discrepancies = []
        for result in self.store.get_all_comparison_results():
            for disc in result.discrepancies:
                all_discrepancies.append({
                    "claim_id": result.claim_id,
                    "type": disc.type.value,
                    "severity": disc.severity,
                    "field": disc.field,
                    "description": disc.description,
                    "suggestion": disc.suggestion
                })
        return {
            "total_discrepancies": len(all_discrepancies),
            "discrepancies": all_discrepancies
        }

    def export_to_csv(self, output_path: str):
        try:
            data = []
            for result in self.store.comparison_results.values():
                claim = self.store.get_claim(result.claim_id)
                explanation = self.explainer.generate_explanation(result)
                status = result.review_record.status.value if result.review_record else result.auto_status.value
                short_summary = self.explainer.generate_short_summary(result)
                
                data.append({
                    "申诉ID": result.claim_id,
                    "旅客姓名": claim.passenger_name,
                    "身份证号": claim.id_card,
                    "联系电话": claim.phone,
                    "航班号": result.flight_no,
                    "航班日期": str(result.flight_date),
                    "申报金额": result.claimed_amount,
                    "建议金额": result.suggested_amount,
                    "最终金额": result.final_amount,
                    "状态": status,
                    "差异数量": len(result.discrepancies),
                    "差异摘要": short_summary,
                    "完整说明": explanation
                })
            
            df = pd.DataFrame(data)
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
            return {"success": True, "path": output_path, "count": len(data)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def export_to_excel(self, output_path: str):
        try:
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                detail_data = []
                for result in self.store.comparison_results.values():
                    claim = self.store.get_claim(result.claim_id)
                    status = result.review_record.status.value if result.review_record else result.auto_status.value
                    short_summary = self.explainer.generate_short_summary(result)
                    
                    detail_data.append({
                        "申诉ID": result.claim_id,
                        "旅客姓名": claim.passenger_name,
                        "航班号": result.flight_no,
                        "航班日期": str(result.flight_date),
                        "申报金额": result.claimed_amount,
                        "建议金额": result.suggested_amount,
                        "最终金额": result.final_amount,
                        "状态": status,
                        "差异数量": len(result.discrepancies),
                        "差异摘要": short_summary
                    })
                
                df_detail = pd.DataFrame(detail_data)
                df_detail.to_excel(writer, sheet_name='申诉明细', index=False)
                
                summary = self.generate_summary()
                summary_data = {
                    "指标": [
                        "批次ID", "总申诉数", "通过数", "拒绝数", "待复核数", "需补充材料数",
                        "总申报金额", "总通过金额", "总建议金额", "生成时间", "生成人"
                    ],
                    "数值": [
                        summary.batch_id,
                        summary.total_claims,
                        summary.approved_count,
                        summary.rejected_count,
                        summary.pending_count,
                        summary.need_more_info_count,
                        summary.total_claimed_amount,
                        summary.total_approved_amount,
                        summary.total_suggested_amount,
                        summary.generated_at,
                        summary.generated_by
                    ]
                }
                df_summary = pd.DataFrame(summary_data)
                df_summary.to_excel(writer, sheet_name='汇总统计', index=False)
                
                if summary.discrepancy_breakdown:
                    disc_data = {
                        "差异类型": list(summary.discrepancy_breakdown.keys()),
                        "数量": list(summary.discrepancy_breakdown.values())
                    }
                    df_disc = pd.DataFrame(disc_data)
                    df_disc.to_excel(writer, sheet_name='差异统计', index=False)
            
            return {"success": True, "path": output_path, "count": len(detail_data)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def generate_json_report(self):
        summary = self.generate_summary()
        details = []
        for result in self.store.get_all_comparison_results():
            detail = self.generate_detail_report(result.claim_id)
            if detail.get("success"):
                details.append(detail)
        
        return {
            "summary": summary.model_dump(),
            "details": details,
            "generated_at": datetime.now().isoformat()
        }
''')
    
    content = ''.join(parts)
    
    with open('app/services.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"services.py 创建成功，共 {len(parts)} 个部分")

if __name__ == '__main__':
    build_services()
