from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from .models import (
    BedInfo, PatientFlow, CleaningOrder,
    BedStatus, PatientFlowType, CleaningOrderStatus,
    ResultItem
)


CLEANING_TIMEOUT_HOURS = 2


class BedManagementRules:
    def __init__(self):
        self.bed_cache: Dict[str, BedInfo] = {}
        self.processed_batches: set[str] = set()

    def is_batch_processed(self, batch_id: str) -> bool:
        return batch_id in self.processed_batches

    def mark_batch_processed(self, batch_id: str):
        self.processed_batches.add(batch_id)

    def check_duplicate_occupation(self, bed_info: BedInfo, patient_flow: PatientFlow) -> Tuple[bool, str]:
        bed_key = f"{bed_info.ward_code}-{str(bed_info.bed_number).zfill(3)}"
        if bed_key in self.bed_cache:
            existing = self.bed_cache[bed_key]
            if (existing.status == BedStatus.OCCUPIED and 
                existing.patient_id and 
                existing.patient_id != patient_flow.patient_id):
                return True, (f"床位 {bed_info.bed_number} 已被患者 {existing.patient_name} "
                            f"({existing.patient_id}) 占用，无法重复占床")
        return False, ""

    def check_transfer_lock(self, bed_info: BedInfo) -> tuple[bool, str]:
        if bed_info.is_locked and bed_info.lock_reason == "transfer":
            return True, f"床位 {bed_info.bed_number} 因转科被锁定，暂无法操作"
        return False, ""

    def check_cleaning_timeout(self, cleaning_order: CleaningOrder) -> tuple[bool, str]:
        if cleaning_order.status in [CleaningOrderStatus.PENDING, CleaningOrderStatus.IN_PROGRESS]:
            timeout_threshold = datetime.now() - timedelta(hours=CLEANING_TIMEOUT_HOURS)
            if cleaning_order.create_time < timeout_threshold:
                return True, (f"床位 {cleaning_order.bed_number} 保洁超时（超过 {CLEANING_TIMEOUT_HOURS} 小时），"
                            f"请确认保洁状态")
        return False, ""

    def validate_bed_info(self, bed_info: BedInfo, original_data: Dict[str, Any]) -> Tuple[str, Optional[ResultItem]]:
        if bed_info.status == BedStatus.OCCUPIED and not bed_info.patient_id:
            return "failed", ResultItem(
                record_type="bed",
                record_id=f"{bed_info.ward_code}-{bed_info.bed_number}",
                original_data=original_data,
                suggestion="占用状态的床位必须填写患者ID，请核对患者信息"
            )

        if bed_info.status == BedStatus.VACANT and bed_info.patient_id:
            return "pending", ResultItem(
                record_type="bed",
                record_id=f"{bed_info.ward_code}-{bed_info.bed_number}",
                original_data=original_data,
                suggestion="空闲床位存在患者信息，请确认是否需要清除患者信息或更新床位状态"
            )

        is_locked, lock_msg = self.check_transfer_lock(bed_info)
        if is_locked:
            return "pending", ResultItem(
                record_type="bed",
                record_id=f"{bed_info.ward_code}-{bed_info.bed_number}",
                original_data=original_data,
                suggestion=lock_msg
            )

        return "success", None

    def validate_patient_flow(self, patient_flow: PatientFlow, original_data: Dict[str, Any]) -> Tuple[str, Optional[ResultItem]]:
        if patient_flow.flow_type == PatientFlowType.ADMISSION:
            if not patient_flow.to_bed or not patient_flow.to_ward:
                return "failed", ResultItem(
                    record_type="patient_flow",
                    record_id=patient_flow.flow_id,
                    original_data=original_data,
                    suggestion="入院记录必须包含目标病区和床位信息"
                )

            temp_bed = BedInfo(
                batch_id=patient_flow.batch_id,
                ward_code=patient_flow.to_ward or "",
                bed_number=patient_flow.to_bed or "",
                status=BedStatus.OCCUPIED,
                patient_id=patient_flow.patient_id,
                last_updated=patient_flow.event_time
            )
            is_dup, dup_msg = self.check_duplicate_occupation(temp_bed, patient_flow)
            if is_dup:
                return "failed", ResultItem(
                    record_type="patient_flow",
                    record_id=patient_flow.flow_id,
                    original_data=original_data,
                    suggestion=dup_msg
                )

        if patient_flow.flow_type == PatientFlowType.TRANSFER:
            if not patient_flow.from_bed or not patient_flow.to_bed:
                return "failed", ResultItem(
                    record_type="patient_flow",
                    record_id=patient_flow.flow_id,
                    original_data=original_data,
                    suggestion="转科记录必须包含转出床位和转入床位信息"
                )

            if patient_flow.from_ward == patient_flow.to_ward and patient_flow.from_bed == patient_flow.to_bed:
                return "failed", ResultItem(
                    record_type="patient_flow",
                    record_id=patient_flow.flow_id,
                    original_data=original_data,
                    suggestion="转出床位与转入床位相同，请核对接转科信息"
                )

            temp_bed = BedInfo(
                batch_id=patient_flow.batch_id,
                ward_code=patient_flow.to_ward or "",
                bed_number=patient_flow.to_bed or "",
                status=BedStatus.OCCUPIED,
                patient_id=patient_flow.patient_id,
                last_updated=patient_flow.event_time,
                is_locked=True,
                lock_reason="transfer"
            )
            is_dup, dup_msg = self.check_duplicate_occupation(temp_bed, patient_flow)
            if is_dup:
                return "failed", ResultItem(
                    record_type="patient_flow",
                    record_id=patient_flow.flow_id,
                    original_data=original_data,
                    suggestion=dup_msg
                )

        if patient_flow.flow_type == PatientFlowType.DISCHARGE and not patient_flow.from_bed:
            return "pending", ResultItem(
                record_type="patient_flow",
                record_id=patient_flow.flow_id,
                original_data=original_data,
                suggestion="出院记录缺少转出床位信息，请补充床位号以便更新床位状态"
            )

        return "success", None

    def validate_cleaning_order(self, cleaning_order: CleaningOrder, original_data: Dict[str, Any]) -> Tuple[str, Optional[ResultItem]]:
        is_timeout, timeout_msg = self.check_cleaning_timeout(cleaning_order)
        if is_timeout:
            return "pending", ResultItem(
                record_type="cleaning",
                record_id=cleaning_order.order_id,
                original_data=original_data,
                suggestion=timeout_msg
            )

        if (cleaning_order.status == CleaningOrderStatus.COMPLETED and 
            not cleaning_order.complete_time):
            return "failed", ResultItem(
                record_type="cleaning",
                record_id=cleaning_order.order_id,
                original_data=original_data,
                suggestion="已完成的保洁工单必须填写完成时间"
            )

        if (cleaning_order.status == CleaningOrderStatus.IN_PROGRESS and 
            not cleaning_order.start_time):
            return "pending", ResultItem(
                record_type="cleaning",
                record_id=cleaning_order.order_id,
                original_data=original_data,
                suggestion="进行中的保洁工单缺少开始时间，请核对"
            )

        return "success", None

    def update_bed_cache(self, bed_info: BedInfo):
        bed_key = f"{bed_info.ward_code}-{str(bed_info.bed_number).zfill(3)}"
        self.bed_cache[bed_key] = bed_info
