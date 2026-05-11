"""异常检测模块"""

from typing import List

from .models import CancellationRecord, CancellationType
from .datastore import DataStore


class ExceptionDetector:
    def __init__(self, store: DataStore):
        self.store = store

    def detect(self, record: CancellationRecord) -> List[str]:
        exceptions = []

        booking = self.store.get_booking(record.booking_no)
        if booking:
            exceptions.extend(self._check_customer_mismatch(record, booking))
            exceptions.extend(self._check_cutoff_time_missing(booking))
            exceptions.extend(self._check_original_vessel_not_released(record))
            exceptions.extend(self._check_duplicate_import(record))
        else:
            exceptions.append("订舱记录不存在")

        return exceptions

    def _check_customer_mismatch(self, record: CancellationRecord, booking) -> List[str]:
        if record.customer_id != booking.customer_id:
            return [f"客户编号不一致：取消记录[{record.customer_id}] vs 订舱[{booking.customer_id}]"]
        return []

    def _check_cutoff_time_missing(self, booking) -> List[str]:
        schedule = self.store.get_schedule_rule(booking.vessel_name, booking.voyage_no)
        if not schedule:
            return [f"船期规则缺失：{booking.vessel_name} {booking.voyage_no}，无法获取截关时间"]
        return []

    def _check_original_vessel_not_released(self, record: CancellationRecord) -> List[str]:
        if record.cancellation_type == CancellationType.CHANGE and not record.original_vessel_released:
            return ["改船后原舱位未释放"]
        return []

    def _check_duplicate_import(self, record: CancellationRecord) -> List[str]:
        processed = self.store.get_processed_cancellations(record.booking_no, record.cancellation_type)
        if processed:
            return [f"存在已处理的取消/改船记录：{[p.id for p in processed]}，可能为重复导入"]
        return []

    def is_fatal_exception(self, exceptions: List[str]) -> bool:
        fatal_keywords = ["客户编号不一致", "订舱记录不存在", "船期规则缺失"]
        return any(any(k in e for e in exceptions) for k in fatal_keywords)
