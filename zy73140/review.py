from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from models import SeagrassRecord, CleaningResult, RecordStatus, QualityFlag, SIDE_NOTES


class ReviewManager:
    def __init__(self, cleaning_result: CleaningResult):
        self.result = cleaning_result
        self.pending_deadline_days = 7

    def get_records_by_status(self, status: RecordStatus) -> List[SeagrassRecord]:
        return [r for r in self.result.cleaned_data if r.status == status]

    def get_summary(self) -> Dict[str, Any]:
        confirmed = self.get_records_by_status(RecordStatus.CONFIRMED)
        pending = self.get_records_by_status(RecordStatus.PENDING)
        rejected = self.get_records_by_status(RecordStatus.REJECTED)

        return {
            "月底复核状态汇总": {
                "已确认数": len(confirmed),
                "待补件数": len(pending),
                "退回数": len(rejected),
                "云遮挡退回数": len(self.result.cloud_cover_records)
            },
            "待补件截止日期提醒": SIDE_NOTES["PENDING_FLOW"],
            "待处理优先级": self._get_priority_list(pending)
        }

    def _get_priority_list(self, pending_records: List[SeagrassRecord]) -> List[Dict[str, Any]]:
        priority = []
        for r in pending_records:
            reasons = []
            if QualityFlag.MISSING_BOTTLE in r.quality_flags:
                reasons.append("采样瓶缺失 - 高优")
            if QualityFlag.TIME_MISMATCH in r.quality_flags:
                reasons.append("时间不匹配 - 中优")
            if QualityFlag.BOUNDARY in r.quality_flags:
                reasons.append("边界样本 - 低优")

            priority.append({
                "record_id": r.record_id,
                "bottle_id": r.bottle_id,
                "reasons": reasons,
                "notes": r.notes,
                "deadline": (datetime.now() + timedelta(days=self.pending_deadline_days)).strftime("%Y-%m-%d")
            })

        priority.sort(key=lambda x: (
            0 if "采样瓶缺失" in str(x["reasons"]) else 1 if "时间不匹配" in str(x["reasons"]) else 2
        ))
        return priority

    def confirm_record(self, record_id: str) -> Optional[SeagrassRecord]:
        for r in self.result.cleaned_data:
            if r.record_id == record_id:
                r.status = RecordStatus.CONFIRMED
                r.notes = "人工复核通过，已确认"
                return r
        return None

    def reject_record(self, record_id: str, reason: str = "") -> Optional[SeagrassRecord]:
        for r in self.result.cleaned_data:
            if r.record_id == record_id:
                r.status = RecordStatus.REJECTED
                r.notes = f"退回 - {reason}" if reason else "退回"
                return r
        return None

    def request_more_info(self, record_id: str, info_request: str) -> Optional[SeagrassRecord]:
        for r in self.result.cleaned_data:
            if r.record_id == record_id:
                r.status = RecordStatus.PENDING
                r.notes = f"待补件 - 需补充: {info_request}"
                return r
        return None

    def auto_expire_pending(self) -> List[SeagrassRecord]:
        expired = []
        for r in self.get_records_by_status(RecordStatus.PENDING):
            if QualityFlag.MISSING_BOTTLE in r.quality_flags:
                r.status = RecordStatus.REJECTED
                r.notes = "退回 - 采样瓶缺失超期未补"
                expired.append(r)
        return expired

    def export_for_monthly_review(self) -> Dict[str, Any]:
        return {
            "复核日期": datetime.now().strftime("%Y-%m-%d"),
            "状态汇总": self.get_summary(),
            "已确认记录": [
                {
                    "record_id": r.record_id,
                    "bottle_id": r.bottle_id,
                    "coverage": r.seagrass_coverage,
                    "quality_flags": [f.value for f in r.quality_flags]
                }
                for r in self.get_records_by_status(RecordStatus.CONFIRMED)
            ],
            "待补件记录": [
                {
                    "record_id": r.record_id,
                    "bottle_id": r.bottle_id,
                    "notes": r.notes,
                    "quality_flags": [f.value for f in r.quality_flags]
                }
                for r in self.get_records_by_status(RecordStatus.PENDING)
            ],
            "退回记录": [
                {
                    "record_id": r.record_id,
                    "bottle_id": r.bottle_id,
                    "notes": r.notes,
                    "quality_flags": [f.value for f in r.quality_flags]
                }
                for r in self.get_records_by_status(RecordStatus.REJECTED)
            ],
            "云遮挡单独记录": self.result.cloud_cover_records,
            "边界样本影响分析": self.result.boundary_analysis
        }

    def rerun_cleaning(self, records: List[SeagrassRecord],
                       time_threshold: int = 2) -> CleaningResult:
        from cleaner import clean_seagrass_data
        return clean_seagrass_data(records, time_threshold=time_threshold)
