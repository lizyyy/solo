from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from .models import (
    SensorRecord,
    WorkingConditionPhoto,
    VerificationRecord,
    WorkflowState,
    WorkflowStep,
    RecordStatus,
)
from .verifier import (
    create_verification_record,
    apply_supplement_from_photo,
    confirm_conflict_resolution,
    approve_pending_review,
)


class SprayVerificationWorkflow:
    def __init__(self):
        self.state: Optional[WorkflowState] = None

    def _add_history(self, action: str, details: Dict[str, Any]):
        if self.state is not None:
            self.state.history.append({
                "timestamp": datetime.now().isoformat(),
                "action": action,
                "details": details,
            })

    def step1_import_sensor_records(
        self,
        sensor_records: List[SensorRecord],
        photo_records: Optional[List[WorkingConditionPhoto]] = None,
    ) -> WorkflowState:
        photo_map = {}
        if photo_records:
            for photo in photo_records:
                photo_map[photo.sensor_id] = photo

        verification_records = []
        for sensor in sensor_records:
            photo = photo_map.get(sensor.sensor_id)
            record = create_verification_record(sensor, photo)
            verification_records.append(record)

        self.state = WorkflowState(
            current_step=WorkflowStep.STEP1_IMPORT,
            records=verification_records,
        )

        self._add_history(
            "step1_import",
            {
                "sensor_count": len(sensor_records),
                "photo_count": len(photo_records) if photo_records else 0,
                "record_count": len(verification_records),
            },
        )

        return self.state

    def step2_laotang_review_photos(
        self,
        photo_records: List[WorkingConditionPhoto],
        conflict_resolver: Optional[Callable[[VerificationRecord], bool]] = None,
    ) -> WorkflowState:
        if self.state is None:
            raise ValueError("请先执行第一步：导入传感器记录")

        photo_map = {photo.sensor_id: photo for photo in photo_records}

        for i, record in enumerate(self.state.records):
            photo = photo_map.get(record.sensor_record.sensor_id)
            if photo is not None:
                if record.photo_record is None:
                    self.state.records[i].photo_record = photo

                if photo.supplement_note and record.status in [RecordStatus.PENDING_REVIEW, RecordStatus.NORMAL]:
                    self.state.records[i] = apply_supplement_from_photo(record, photo)

                if record.status == RecordStatus.CONFLICT and conflict_resolver is not None:
                    confirmed = conflict_resolver(record)
                    self.state.records[i] = confirm_conflict_resolution(
                        record, confirmed=confirmed, reviewer="老唐"
                    )

        self.state.current_step = WorkflowStep.STEP2_PHOTO_REVIEW

        self._add_history(
            "step2_photo_review",
            {
                "photo_count": len(photo_records),
                "reviewer": "老唐",
            },
        )

        return self.state

    def step3_update_review_diagram(
        self,
        quality_inspector_review: Optional[Dict[str, bool]] = None,
    ) -> WorkflowState:
        if self.state is None:
            raise ValueError("请先执行第一步：导入传感器记录")

        if quality_inspector_review:
            for record_id, approved in quality_inspector_review.items():
                for i, record in enumerate(self.state.records):
                    if record.record_id == record_id and record.status == RecordStatus.PENDING_REVIEW:
                        if approved:
                            self.state.records[i] = approve_pending_review(
                                record, reviewer="质检员"
                            )

        self.state.current_step = WorkflowStep.STEP3_DIAGRAM_UPDATE

        self._add_history(
            "step3_diagram_update",
            {
                "quality_review_count": len(quality_inspector_review) if quality_inspector_review else 0,
            },
        )

        return self.state

    def get_conflict_records(self) -> List[VerificationRecord]:
        if self.state is None:
            return []
        return [r for r in self.state.records if r.status == RecordStatus.CONFLICT]

    def get_pending_review_records(self) -> List[VerificationRecord]:
        if self.state is None:
            return []
        return [r for r in self.state.records if r.status == RecordStatus.PENDING_REVIEW]

    def get_summary(self) -> Dict[str, Any]:
        if self.state is None:
            return {}

        status_counts = {}
        for record in self.state.records:
            status = record.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "current_step": self.state.current_step.value,
            "total_records": len(self.state.records),
            "status_distribution": status_counts,
            "history_length": len(self.state.history),
        }
