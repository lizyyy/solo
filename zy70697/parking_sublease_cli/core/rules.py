from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from collections import defaultdict

from .models import SubleaseRecord, ValidationResult, LeaseStatus, AccessStatus


class RuleEngine:
    def __init__(self):
        self.validation_results: List[ValidationResult] = []
        self.fee_summary: Dict[str, Dict] = {}
        self.access_summary: Dict[str, Dict] = {}
    
    def validate_lease_dates(self, record: SubleaseRecord, check_date: datetime = None) -> ValidationResult:
        check_date = check_date or datetime.now()
        result = ValidationResult(
            record_id=record.record_id,
            is_valid=True,
            source=record.source
        )
        
        if record.start_date > record.end_date:
            result.add_error("开始日期晚于结束日期")
            record.status = LeaseStatus.INVALID_DATE
        
        effective_end = record.actual_terminate_date or record.end_date
        if record.start_date > effective_end:
            result.add_error("租期无效：实际结束日期早于开始日期")
            record.status = LeaseStatus.INVALID_DATE
        
        if effective_end < check_date:
            result.add_warning("租期已过期")
            if record.status == LeaseStatus.VALID:
                record.status = LeaseStatus.EXPIRED
        
        if record.actual_terminate_date:
            if record.actual_terminate_date < record.start_date:
                result.add_error("提前终止日期早于开始日期")
            elif record.actual_terminate_date > record.end_date:
                result.add_warning("提前终止日期晚于原结束日期，按原结束日期计算")
        
        return result
    
    def check_overlapping(self, records: List[SubleaseRecord]) -> Dict[str, List[str]]:
        space_records = defaultdict(list)
        for record in records:
            space_records[record.space_id].append(record)
        
        overlaps = defaultdict(list)
        
        for space_id, space_record_list in space_records.items():
            sorted_records = sorted(space_record_list, key=lambda r: r.start_date)
            
            for i in range(len(sorted_records)):
                for j in range(i + 1, len(sorted_records)):
                    r1 = sorted_records[i]
                    r2 = sorted_records[j]
                    
                    r1_end = r1.actual_terminate_date or r1.end_date
                    r2_end = r2.actual_terminate_date or r2.end_date
                    
                    if not (r1_end < r2.start_date or r2_end < r1.start_date):
                        overlap_msg = f"与记录 {r2.record_id} 租期重叠"
                        overlaps[r1.record_id].append(overlap_msg)
                        overlap_msg2 = f"与记录 {r1.record_id} 租期重叠"
                        overlaps[r2.record_id].append(overlap_msg2)
                        
                        if r1.status == LeaseStatus.VALID:
                            r1.status = LeaseStatus.OVERLAPPING
                        if r2.status == LeaseStatus.VALID:
                            r2.status = LeaseStatus.OVERLAPPING
        
        return overlaps
    
    def calculate_fee_split(self, record: SubleaseRecord, 
                            property_fee_rate: float = 0.1) -> Dict[str, float]:
        total_fee = record.total_fee
        property_fee = round(total_fee * property_fee_rate, 2)
        owner_income = round(total_fee - property_fee, 2)
        
        fee_detail = {
            "record_id": record.record_id,
            "monthly_fee": record.monthly_fee,
            "lease_days": record.lease_days,
            "total_fee": total_fee,
            "property_fee": property_fee,
            "owner_income": owner_income,
            "property_rate": property_fee_rate
        }
        
        self.fee_summary[record.record_id] = fee_detail
        return fee_detail
    
    def manage_access_control(self, record: SubleaseRecord, 
                              check_date: datetime = None) -> Dict[str, any]:
        check_date = check_date or datetime.now()
        effective_end = record.actual_terminate_date or record.end_date
        
        has_revoke = record.access_revoke_date is not None
        has_grant = record.access_grant_date is not None
        
        revoke_effective = has_revoke and record.access_revoke_date <= check_date
        grant_effective = has_grant and record.access_grant_date <= check_date
        lease_active = check_date <= effective_end
        lease_expired = check_date > effective_end
        
        if revoke_effective:
            record.access_status = AccessStatus.REVOKED
        elif grant_effective:
            if lease_active:
                record.access_status = AccessStatus.GRANTED
            else:
                record.access_status = AccessStatus.EXPIRED
        else:
            record.access_status = AccessStatus.NOT_GRANTED
        
        access_detail = {
            "record_id": record.record_id,
            "access_status": record.access_status.value,
            "access_grant_date": record.access_grant_date.strftime("%Y-%m-%d") if record.access_grant_date else None,
            "access_revoke_date": record.access_revoke_date.strftime("%Y-%m-%d") if record.access_revoke_date else None,
            "can_access": record.access_status == AccessStatus.GRANTED,
            "check_date": check_date.strftime("%Y-%m-%d"),
            "lease_end_date": effective_end.strftime("%Y-%m-%d")
        }
        
        self.access_summary[record.record_id] = access_detail
        return access_detail
    
    def process_early_termination(self, record: SubleaseRecord, 
                                   terminate_date: datetime) -> Dict[str, any]:
        if terminate_date < record.start_date:
            raise ValueError("终止日期不能早于开始日期")
        
        original_end = record.end_date
        record.actual_terminate_date = terminate_date
        record.status = LeaseStatus.EARLY_TERMINATED
        
        original_days = (original_end - record.start_date).days + 1
        actual_days = (terminate_date - record.start_date).days + 1
        refund_days = max(0, original_days - actual_days)
        
        daily_fee = record.monthly_fee / 30.0
        refund_amount = round(daily_fee * refund_days, 2)
        
        termination_detail = {
            "record_id": record.record_id,
            "original_end_date": original_end.strftime("%Y-%m-%d"),
            "actual_terminate_date": terminate_date.strftime("%Y-%m-%d"),
            "original_days": original_days,
            "actual_days": actual_days,
            "refund_days": refund_days,
            "refund_amount": refund_amount,
            "status": record.status.value
        }
        
        return termination_detail
    
    def process_all_records(self, records: List[SubleaseRecord], 
                            property_fee_rate: float = 0.1,
                            check_date: datetime = None) -> Dict[str, any]:
        check_date = check_date or datetime.now()
        self.validation_results = []
        self.fee_summary = {}
        self.access_summary = {}
        
        records.sort(key=lambda r: r.record_id)
        
        for record in records:
            date_result = self.validate_lease_dates(record, check_date)
            self.validation_results.append(date_result)
        
        overlaps = self.check_overlapping(records)
        for result in self.validation_results:
            if result.record_id in overlaps:
                for msg in overlaps[result.record_id]:
                    result.add_error(msg)
        
        for record in records:
            self.calculate_fee_split(record, property_fee_rate)
            self.manage_access_control(record, check_date)
        
        valid_records = [r for r in records if r.status == LeaseStatus.VALID]
        invalid_records = [r for r in records if r.status != LeaseStatus.VALID]
        
        total_fee = sum(r.total_fee for r in records)
        total_property_fee = sum(self.fee_summary.get(r.record_id, {}).get("property_fee", 0) for r in records)
        total_owner_income = sum(self.fee_summary.get(r.record_id, {}).get("owner_income", 0) for r in records)
        
        granted_access = sum(1 for r in records if r.access_status == AccessStatus.GRANTED)
        
        summary = {
            "total_records": len(records),
            "valid_records": len(valid_records),
            "invalid_records": len(invalid_records),
            "total_fee": total_fee,
            "total_property_fee": total_property_fee,
            "total_owner_income": total_owner_income,
            "granted_access": granted_access,
            "check_date": check_date.strftime("%Y-%m-%d"),
            "property_fee_rate": property_fee_rate
        }
        
        return {
            "records": records,
            "validation_results": self.validation_results,
            "fee_summary": self.fee_summary,
            "access_summary": self.access_summary,
            "summary": summary
        }
