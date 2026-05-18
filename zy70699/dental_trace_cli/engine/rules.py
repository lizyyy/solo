from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import uuid

from ..models import (
    MaterialBatch,
    SterilizationRecord,
    Patient,
    TreatmentItem,
    UsageRecord,
    TraceResult,
    AnomalyType
)


class TraceEngine:
    def __init__(self):
        self.batches: Dict[str, MaterialBatch] = {}
        self.sterilizations: Dict[str, SterilizationRecord] = {}
        self.patients: Dict[str, Patient] = {}
        self.treatments: Dict[str, TreatmentItem] = {}
        self.usages: Dict[str, UsageRecord] = {}
        
        self.batch_sterilizations: Dict[str, List[SterilizationRecord]] = defaultdict(list)
        self.batch_usages: Dict[str, List[UsageRecord]] = defaultdict(list)
        self.treatment_usages: Dict[str, List[UsageRecord]] = defaultdict(list)
        self.patient_treatments: Dict[str, List[TreatmentItem]] = defaultdict(list)

    def load_batch(self, batch: MaterialBatch) -> None:
        if batch.batch_id in self.batches:
            raise ValueError(f"批次号重复: {batch.batch_id}")
        self.batches[batch.batch_id] = batch

    def load_sterilization(self, sterilization: SterilizationRecord) -> None:
        if sterilization.sterilization_id in self.sterilizations:
            raise ValueError(f"灭菌记录ID重复: {sterilization.sterilization_id}")
        self.sterilizations[sterilization.sterilization_id] = sterilization
        self.batch_sterilizations[sterilization.batch_id].append(sterilization)

    def load_patient(self, patient: Patient) -> None:
        if patient.patient_id in self.patients:
            raise ValueError(f"患者ID重复: {patient.patient_id}")
        self.patients[patient.patient_id] = patient

    def load_treatment(self, treatment: TreatmentItem) -> None:
        if treatment.treatment_id in self.treatments:
            raise ValueError(f"治疗项目ID重复: {treatment.treatment_id}")
        self.treatments[treatment.treatment_id] = treatment
        self.patient_treatments[treatment.patient_id].append(treatment)

    def load_usage(self, usage: UsageRecord) -> None:
        if usage.usage_id in self.usages:
            raise ValueError(f"使用记录ID重复: {usage.usage_id}")
        self.usages[usage.usage_id] = usage
        self.batch_usages[usage.batch_id].append(usage)
        self.treatment_usages[usage.treatment_id].append(usage)

    def validate_sterilization_expiration(
        self,
        sterilization: SterilizationRecord,
        usage_date: datetime
    ) -> Tuple[bool, Optional[str]]:
        if usage_date > sterilization.expiration_date:
            return False, (
                f"灭菌已过期: 灭菌有效期至 {sterilization.expiration_date}, "
                f"使用时间 {usage_date}"
            )
        return True, None

    def validate_usage_date_order(
        self,
        sterilization: SterilizationRecord,
        usage_date: datetime
    ) -> Tuple[bool, Optional[str]]:
        if usage_date < sterilization.sterilization_date:
            return False, (
                f"使用时间早于灭菌时间: 灭菌时间 {sterilization.sterilization_date}, "
                f"使用时间 {usage_date}"
            )
        return True, None

    def validate_future_usage(self, usage_date: datetime) -> Tuple[bool, Optional[str]]:
        now = datetime.now()
        if usage_date > now:
            return False, f"使用时间在未来: {usage_date}"
        return True, None

    def find_sterilization_for_usage(
        self,
        batch_id: str,
        usage_date: datetime
    ) -> Optional[SterilizationRecord]:
        sterilizations = self.batch_sterilizations.get(batch_id, [])
        valid_sterilizations = []
        
        for ster in sterilizations:
            if ster.sterilization_date <= usage_date <= ster.expiration_date:
                valid_sterilizations.append(ster)
        
        if valid_sterilizations:
            valid_sterilizations.sort(key=lambda x: x.sterilization_date, reverse=True)
            return valid_sterilizations[0]
        
        return None

    def check_any_sterilization_before(
        self,
        batch_id: str,
        usage_date: datetime
    ) -> Tuple[bool, Optional[SterilizationRecord]]:
        sterilizations = self.batch_sterilizations.get(batch_id, [])
        
        expired_sterilizations = []
        for ster in sterilizations:
            if ster.expiration_date < usage_date:
                expired_sterilizations.append(ster)
        
        if expired_sterilizations:
            expired_sterilizations.sort(key=lambda x: x.expiration_date, reverse=True)
            return True, expired_sterilizations[0]
        
        return False, None

    def trace_batch(self, batch_id: str) -> List[TraceResult]:
        if batch_id not in self.batches:
            return []
        
        batch = self.batches[batch_id]
        usages = self.batch_usages.get(batch_id, [])
        results = []
        
        if not usages:
            anomalies = []
            anomaly_details = []
            sterilizations = self.batch_sterilizations.get(batch_id, [])
            
            if not sterilizations:
                anomalies.append(AnomalyType.NOT_STERILIZED)
                anomaly_details.append("该批次无灭菌记录")
            
            results.append(TraceResult(
                batch_id=batch_id,
                material_name=batch.material_name,
                sterilization_id=None,
                sterilization_date=None,
                sterilization_expiration=None,
                usage_id=None,
                usage_date=None,
                treatment_id=None,
                treatment_date=None,
                patient_id=None,
                patient_name=None,
                is_valid=len(anomalies) == 0,
                anomalies=anomalies,
                anomaly_details=anomaly_details,
                quantity_used=None
            ))
            return results
        
        for usage in usages:
            anomalies = []
            anomaly_details = []
            
            treatment = self.treatments.get(usage.treatment_id)
            patient = self.patients.get(treatment.patient_id) if treatment else None
            
            sterilization = self.find_sterilization_for_usage(batch_id, usage.usage_date)
            
            if not sterilization:
                has_expired, expired_ster = self.check_any_sterilization_before(batch_id, usage.usage_date)
                if has_expired and expired_ster:
                    anomalies.append(AnomalyType.EXPIRED)
                    anomaly_details.append(
                        f"使用已过期灭菌: 最近一次灭菌ID={expired_ster.sterilization_id}, "
                        f"有效期至 {expired_ster.expiration_date.strftime('%Y-%m-%d %H:%M:%S')}, "
                        f"使用时间 {usage.usage_date.strftime('%Y-%m-%d %H:%M:%S')}"
                    )
                else:
                    anomalies.append(AnomalyType.NOT_STERILIZED)
                    sterilizations = self.batch_sterilizations.get(batch_id, [])
                    if sterilizations:
                        anomaly_details.append(
                            f"无有效灭菌记录: 共有 {len(sterilizations)} 条灭菌记录，"
                            f"但使用时间 {usage.usage_date} 不在任何灭菌有效期内"
                        )
                    else:
                        anomaly_details.append("该批次无任何灭菌记录")
            else:
                valid, reason = self.validate_sterilization_expiration(sterilization, usage.usage_date)
                if not valid:
                    anomalies.append(AnomalyType.EXPIRED)
                    anomaly_details.append(reason)
                
                valid, reason = self.validate_usage_date_order(sterilization, usage.usage_date)
                if not valid:
                    anomalies.append(AnomalyType.INVALID_DATE)
                    anomaly_details.append(reason)
            
            valid, reason = self.validate_future_usage(usage.usage_date)
            if not valid:
                anomalies.append(AnomalyType.FUTURE_USAGE)
                anomaly_details.append(reason)
            
            if not treatment:
                anomalies.append(AnomalyType.MISSING_DATA)
                anomaly_details.append(f"关联治疗项目不存在: {usage.treatment_id}")
            
            if treatment and not patient:
                anomalies.append(AnomalyType.MISSING_DATA)
                anomaly_details.append(f"关联患者不存在: {treatment.patient_id}")
            
            results.append(TraceResult(
                batch_id=batch_id,
                material_name=batch.material_name,
                sterilization_id=sterilization.sterilization_id if sterilization else None,
                sterilization_date=sterilization.sterilization_date if sterilization else None,
                sterilization_expiration=sterilization.expiration_date if sterilization else None,
                usage_id=usage.usage_id,
                usage_date=usage.usage_date,
                treatment_id=treatment.treatment_id if treatment else None,
                treatment_date=treatment.treatment_date if treatment else None,
                patient_id=patient.patient_id if patient else None,
                patient_name=patient.name if patient else None,
                is_valid=len(anomalies) == 0,
                anomalies=anomalies,
                anomaly_details=anomaly_details,
                quantity_used=usage.quantity
            ))
        
        return results

    def trace_all(self) -> List[TraceResult]:
        all_results = []
        for batch_id in self.batches:
            all_results.extend(self.trace_batch(batch_id))
        return all_results

    def trace_patient(self, patient_id: str) -> List[TraceResult]:
        if patient_id not in self.patients:
            return []
        
        results = []
        treatments = self.patient_treatments.get(patient_id, [])
        
        for treatment in treatments:
            usages = self.treatment_usages.get(treatment.treatment_id, [])
            for usage in usages:
                batch_results = self.trace_batch(usage.batch_id)
                for result in batch_results:
                    if result.usage_id == usage.usage_id:
                        results.append(result)
        
        return results

    def get_anomalies(self) -> List[TraceResult]:
        return [r for r in self.trace_all() if not r.is_valid]

    def get_statistics(self) -> Dict:
        all_results = self.trace_all()
        valid_count = sum(1 for r in all_results if r.is_valid)
        invalid_count = len(all_results) - valid_count
        
        anomaly_counts = defaultdict(int)
        for result in all_results:
            for anomaly in result.anomalies:
                anomaly_counts[anomaly] += 1
        
        return {
            'total_traces': len(all_results),
            'valid_count': valid_count,
            'invalid_count': invalid_count,
            'anomaly_counts': dict(anomaly_counts),
            'total_batches': len(self.batches),
            'total_sterilizations': len(self.sterilizations),
            'total_patients': len(self.patients),
            'total_treatments': len(self.treatments),
            'total_usages': len(self.usages)
        }
