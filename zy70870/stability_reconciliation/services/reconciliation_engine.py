import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from stability_reconciliation.models.database import (
    TestProtocol, Sample, ChamberRecord, ReconciliationRecord, AuditLog
)
from stability_reconciliation.schemas.reconciliation import DiscrepancyDetail


class ReconciliationEngine:
    def __init__(self, db: Session):
        self.db = db
        self.sampling_window_days = 3
        self.temp_tolerance = 2.0
        self.humidity_tolerance = 5.0

    def run_reconciliation(self, protocol_id: str) -> Tuple[str, List[ReconciliationRecord], Dict[str, Any]]:
        batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
        
        protocol = self.db.query(TestProtocol).filter(TestProtocol.id == protocol_id).first()
        if not protocol:
            raise ValueError(f"Protocol not found")
        
        samples = self.db.query(Sample).filter(Sample.protocol_id == protocol_id).all()
        
        reconciliation_records = []
        summary = {
            "total_samples": len(samples),
            "matched_samples": 0,
            "discrepancy_count": 0,
            "resolved_count": 0
        }
        
        for sample in samples:
            record, discrepancies = self._reconcile_sample(sample, protocol, batch_id)
            reconciliation_records.append(record)
            
            if discrepancies:
                summary["discrepancy_count"] += 1
            else:
                summary["matched_samples"] += 1
        
        self.db.commit()
        
        return batch_id, reconciliation_records, summary

    def _reconcile_sample(self, sample: Sample, protocol: TestProtocol, 
                          batch_id: str) -> Tuple[ReconciliationRecord, List[DiscrepancyDetail]]:
        record_id = f"RECON-{uuid.uuid4().hex[:8].upper()}"
        
        discrepancies = []
        
        discrepancies.extend(self._check_sampling_window(sample))
        discrepancies.extend(self._check_chamber_deviations(sample))
        discrepancies.extend(self._check_extension_approval(sample))
        
        status = "discrepancy" if discrepancies else "matched"
        
        calculation_details = self._generate_calculation_details(sample, protocol, discrepancies)
        
        record = ReconciliationRecord(
            id=record_id,
            protocol_id=protocol.id,
            sample_id=sample.id,
            reconciliation_batch_id=batch_id,
            status=status,
            discrepancy_type=discrepancies[0].type if discrepancies else None,
            discrepancy_source=discrepancies[0].source if discrepancies else None,
            discrepancy_description=discrepancies[0].description if discrepancies else None,
            is_resolved=False,
            calculation_details=calculation_details
        )
        
        self.db.add(record)
        
        return record, discrepancies

    def _check_sampling_window(self, sample: Sample) -> List[DiscrepancyDetail]:
        discrepancies = []
        
        if not sample.planned_sampling_date or not sample.actual_sampling_date:
            return discrepancies
        
        window_start = sample.planned_sampling_date - timedelta(days=self.sampling_window_days)
        window_end = sample.planned_sampling_date + timedelta(days=self.sampling_window_days)
        
        if not (window_start <= sample.actual_sampling_date <= window_end):
            days_diff = (sample.actual_sampling_date - sample.planned_sampling_date).days
            
            severity = "high" if abs(days_diff) > 7 else "medium" if abs(days_diff) > 3 else "low"
            
            discrepancies.append(DiscrepancyDetail(
                type="sampling_window",
                source="sampling_schedule",
                description=f"取样日期超出允许窗口{abs(days_diff)}天。计划日期: {sample.planned_sampling_date.strftime('%Y-%m-%d')}, 实际日期: {sample.actual_sampling_date.strftime('%Y-%m-%d')}",
                severity=severity,
                evidence={
                    "planned_date": sample.planned_sampling_date.isoformat(),
                    "actual_date": sample.actual_sampling_date.isoformat(),
                    "allowed_window_days": self.sampling_window_days,
                    "deviation_days": days_diff
                }
            ))
        
        return discrepancies

    def _check_chamber_deviations(self, sample: Sample) -> List[DiscrepancyDetail]:
        discrepancies = []
        
        if not sample.storage_location:
            return discrepancies
        
        start_date = sample.planned_sampling_date
        end_date = sample.actual_sampling_date or datetime.utcnow()
        
        chamber_records = self.db.query(ChamberRecord).filter(
            and_(
                ChamberRecord.chamber_name == sample.storage_location,
                ChamberRecord.record_time >= start_date,
                ChamberRecord.record_time <= end_date
            )
        ).all()
        
        if not chamber_records:
            return discrepancies
        
        alert_records = [r for r in chamber_records if r.is_alert]
        
        if alert_records:
            total_duration = self._calculate_deviation_duration(alert_records)
            
            severity = "high" if total_duration > 24 else "medium" if total_duration > 4 else "low"
            
            discrepancies.append(DiscrepancyDetail(
                type="chamber_deviation",
                source="environmental_control",
                description=f"存储期间检测到箱体超温/超湿，共{len(alert_records)}条告警记录，累计{total_duration:.1f}小时",
                severity=severity,
                evidence={
                    "alert_count": len(alert_records),
                    "total_duration_hours": total_duration,
                    "alert_periods": self._summarize_alert_periods(alert_records)
                }
            ))
        
        return discrepancies

    def _calculate_deviation_duration(self, alert_records: List[ChamberRecord]) -> float:
        if not alert_records:
            return 0
        
        sorted_records = sorted(alert_records, key=lambda x: x.record_time)
        
        total_hours = 0
        for i in range(len(sorted_records) - 1):
            delta = sorted_records[i + 1].record_time - sorted_records[i].record_time
            total_hours += delta.total_seconds() / 3600
        
        return max(1.0, total_hours)

    def _summarize_alert_periods(self, alert_records: List[ChamberRecord]) -> List[Dict[str, Any]]:
        sorted_records = sorted(alert_records, key=lambda x: x.record_time)
        
        periods = []
        current_period = None
        
        for record in sorted_records:
            if not current_period:
                current_period = {
                    "start": record.record_time.isoformat(),
                    "end": record.record_time.isoformat(),
                    "max_temp": record.temperature,
                    "min_temp": record.temperature,
                    "alerts": []
                }
            
            current_period["end"] = record.record_time.isoformat()
            current_period["max_temp"] = max(current_period["max_temp"], record.temperature)
            current_period["min_temp"] = min(current_period["min_temp"], record.temperature)
            if record.alert_type:
                current_period["alerts"].append(record.alert_type)
            
            periods.append(current_period)
            current_period = None
        
        if current_period:
            periods.append(current_period)
        
        return periods

    def _check_extension_approval(self, sample: Sample) -> List[DiscrepancyDetail]:
        discrepancies = []
        
        if sample.status == "extended" and not sample.test_results and "extension_approved" not in sample.test_results:
            discrepancies.append(DiscrepancyDetail(
                type="extension_unapproved",
                source="protocol_compliance",
                description="样品延期但未找到审批记录",
                severity="high",
                evidence={
                    "sample_status": sample.status
                }
            ))
        
        return discrepancies

    def _generate_calculation_details(self, sample: Sample, protocol: TestProtocol,
                                     discrepancies: List[DiscrepancyDetail]) -> Dict[str, Any]:
        return {
            "sample_info": {
                "sample_id": sample.sample_id,
                "sampling_point": sample.sampling_point,
                "condition": sample.condition
            },
            "protocol_info": {
                "protocol_name": protocol.protocol_name,
                "product_name": protocol.product_name
            },
            "discrepancy_summary": {
                "count": len(discrepancies),
                "types": [d.type for d in discrepancies],
                "sources": [d.source for d in discrepancies]
            },
            "calculation_timestamp": datetime.utcnow().isoformat(),
            "validity_assessment": self._assess_validity(discrepancies)
        }

    def _assess_validity(self, discrepancies: List[DiscrepancyDetail]) -> str:
        if not discrepancies:
            return "valid"
        
        high_count = sum(1 for d in discrepancies if d.severity == "high")
        if high_count > 0:
            return "questionable"
        
        return "needs_review"

    def recalculate_reconciliation(self, reconciliation_id: str, 
                               updated_params: Dict[str, Any]) -> ReconciliationRecord:
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == reconciliation_id
        ).first()
        
        if not record:
            raise ValueError(f"Reconciliation record not found")
        
        if "sampling_window_days" in updated_params:
            self.sampling_window_days = updated_params["sampling_window_days"]
        
        if "temp_tolerance" in updated_params:
            self.temp_tolerance = updated_params["temp_tolerance"]
        
        sample = self.db.query(Sample).filter(Sample.id == record.sample_id).first()
        protocol = self.db.query(TestProtocol).filter(TestProtocol.id == record.protocol_id).first()
        
        new_record, discrepancies = self._reconcile_sample(sample, protocol, record.reconciliation_batch_id)
        
        record.status = new_record.status
        record.discrepancy_type = new_record.discrepancy_type
        record.discrepancy_source = new_record.discrepancy_source
        record.discrepancy_description = new_record.discrepancy_description
        record.calculation_details = new_record.calculation_details
        record.updated_at = datetime.utcnow()
        
        self.db.commit()
        
        return record
