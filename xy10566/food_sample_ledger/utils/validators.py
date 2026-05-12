from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from ..models import FoodSample, Batch, FridgeLocation, SampleBox


class ValidationResult:
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, message: str):
        self.errors.append(message)

    def add_warning(self, message: str):
        self.warnings.append(message)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


class BusinessRules:
    MIN_SAMPLE_WEIGHT = 200.0
    DEFAULT_RETENTION_HOURS = 48
    MAX_RETENTION_HOURS = 72

    @staticmethod
    def validate_sample_weight(weight: float) -> ValidationResult:
        result = ValidationResult()
        if weight <= 0:
            result.add_error(f"留样重量必须大于0，当前重量: {weight}g")
        elif weight < BusinessRules.MIN_SAMPLE_WEIGHT:
            result.add_error(
                f"留样重量不足，要求至少{BusinessRules.MIN_SAMPLE_WEIGHT}g，实际{weight}g"
            )
        return result

    @staticmethod
    def check_duplicate_sample(
        new_sample: FoodSample, existing_samples: List[FoodSample]
    ) -> ValidationResult:
        result = ValidationResult()
        for sample in existing_samples:
            if (
                sample.dish_id == new_sample.dish_id
                and sample.batch_id == new_sample.batch_id
                and not sample.is_destroyed
            ):
                result.add_error(
                    f"同一菜品同一批次重复留样：菜品={new_sample.dish_name}, "
                    f"批次={new_sample.batch_number}"
                )
        return result

    @staticmethod
    def check_fridge_location_available(
        location: FridgeLocation,
    ) -> ValidationResult:
        result = ValidationResult()
        if location.is_occupied:
            result.add_error(
                f"冰箱位置已被占用：{location.fridge_name}/{location.compartments}/{location.shelf}/{location.position}"
            )
        return result

    @staticmethod
    def check_sample_box_available(
        sample_box: SampleBox,
    ) -> ValidationResult:
        result = ValidationResult()
        if not sample_box.is_available:
            result.add_error(f"留样盒已被占用：{sample_box.box_code}")
        return result

    @staticmethod
    def check_retention_period_overdue(
        sample: FoodSample, current_time: Optional[str] = None
    ) -> ValidationResult:
        result = ValidationResult()
        if current_time is None:
            current_time = datetime.now().isoformat()
        if not sample.is_destroyed and current_time > sample.scheduled_destruction_time:
            result.add_warning(
                f"留样已超过保存时限：菜品={sample.dish_name}, 批次={sample.batch_number}, "
                f"应销毁时间={sample.scheduled_destruction_time}"
            )
        return result

    @staticmethod
    def calculate_scheduled_destruction_time(
        sampling_time: str, retention_hours: Optional[int] = None
    ) -> str:
        if retention_hours is None:
            retention_hours = BusinessRules.DEFAULT_RETENTION_HOURS
        elif retention_hours > BusinessRules.MAX_RETENTION_HOURS:
            retention_hours = BusinessRules.MAX_RETENTION_HOURS

        sampling_dt = datetime.fromisoformat(sampling_time)
        destruction_dt = sampling_dt + timedelta(hours=retention_hours)
        return destruction_dt.isoformat()

    @staticmethod
    def check_batch_locked(batch: Batch) -> ValidationResult:
        result = ValidationResult()
        if batch.is_locked:
            result.add_error(
                f"批次已被锁定，无法操作：批次号={batch.batch_number}, 原因={batch.lock_reason}"
            )
        return result

    @staticmethod
    def check_destruction_permission(
        sample: FoodSample, current_time: Optional[str] = None
    ) -> ValidationResult:
        result = ValidationResult()
        if current_time is None:
            current_time = datetime.now().isoformat()
        if sample.is_destroyed:
            result.add_warning(f"留样已被销毁：{sample.dish_name}")
        elif current_time < sample.scheduled_destruction_time:
            result.add_warning(
                f"留样未到销毁时间：{sample.dish_name}, "
                f"应销毁时间={sample.scheduled_destruction_time}"
            )
        return result
