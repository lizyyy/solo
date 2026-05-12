from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from ..models import (
    FoodSample,
    Dish,
    Batch,
    FridgeLocation,
    SampleBox,
    InspectionRecord,
    ManualCorrection,
)
from ..utils.storage import Storage
from ..utils.validators import BusinessRules, ValidationResult


class OperationResult:
    def __init__(self, success: bool, message: str, data: Optional[Any] = None):
        self.success = success
        self.message = message
        self.data = data
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, error: str):
        self.errors.append(error)

    def add_warning(self, warning: str):
        self.warnings.append(warning)


class SampleService:
    def __init__(self, storage: Storage):
        self.storage = storage
        self._operation_history: List[Dict[str, Any]] = []

    def create_sample(
        self,
        dish_id: str,
        batch_id: str,
        sample_weight: float,
        sample_box_code: str,
        fridge_location_id: str,
        sampler: str,
        sampling_time: Optional[str] = None,
        retention_period_hours: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> OperationResult:
        if sampling_time is None:
            sampling_time = datetime.now().isoformat()

        dish = self.storage.load(Dish, dish_id)
        if not dish:
            result = OperationResult(False, "创建留样失败")
            result.add_error(f"菜品不存在: {dish_id}")
            return result

        batch = self.storage.load(Batch, batch_id)
        if not batch:
            result = OperationResult(False, "创建留样失败")
            result.add_error(f"批次不存在: {batch_id}")
            return result

        batch_check = BusinessRules.check_batch_locked(batch)
        if not batch_check.is_valid:
            result = OperationResult(False, "创建留样失败")
            result.errors.extend(batch_check.errors)
            return result

        weight_check = BusinessRules.validate_sample_weight(sample_weight)
        if not weight_check.is_valid:
            result = OperationResult(False, "创建留样失败")
            result.errors.extend(weight_check.errors)
            return result

        sample_boxes = self.storage.load_all(SampleBox)
        sample_box = next(
            (sb for sb in sample_boxes if sb.box_code == sample_box_code), None
        )
        if not sample_box:
            result = OperationResult(False, "创建留样失败")
            result.add_error(f"留样盒不存在: {sample_box_code}")
            return result

        box_check = BusinessRules.check_sample_box_available(sample_box)
        if not box_check.is_valid:
            result = OperationResult(False, "创建留样失败")
            result.errors.extend(box_check.errors)
            return result

        fridge_location = self.storage.load(FridgeLocation, fridge_location_id)
        if not fridge_location:
            result = OperationResult(False, "创建留样失败")
            result.add_error(f"冰箱位置不存在: {fridge_location_id}")
            return result

        fridge_check = BusinessRules.check_fridge_location_available(fridge_location)
        if not fridge_check.is_valid:
            result = OperationResult(False, "创建留样失败")
            result.errors.extend(fridge_check.errors)
            return result

        scheduled_destruction = BusinessRules.calculate_scheduled_destruction_time(
            sampling_time, retention_period_hours
        )

        existing_samples = self.storage.load_all(FoodSample)
        active_samples = [s for s in existing_samples if not s.is_destroyed]

        temp_sample = FoodSample(
            dish_id=dish.id,
            dish_name=dish.name,
            batch_id=batch.id,
            batch_number=batch.batch_number,
            sample_weight=sample_weight,
            sample_box_code=sample_box.box_code,
            fridge_location_id=fridge_location.id,
            fridge_full_location=f"{fridge_location.fridge_name}/{fridge_location.compartment}/{fridge_location.shelf}/{fridge_location.position}",
            sampling_time=sampling_time,
            sampler=sampler,
            retention_period_hours=retention_period_hours
            or BusinessRules.DEFAULT_RETENTION_HOURS,
            scheduled_destruction_time=scheduled_destruction,
            status="active",
            notes=notes,
        )

        duplicate_check = BusinessRules.check_duplicate_sample(
            temp_sample, active_samples
        )
        if not duplicate_check.is_valid:
            result = OperationResult(False, "创建留样失败")
            result.errors.extend(duplicate_check.errors)
            self._log_operation("create_sample", "failed", {"dish_name": dish.name})
            return result

        created_sample = self.storage.save(temp_sample)

        sample_box.is_available = False
        sample_box.current_sample_id = created_sample.id
        self.storage.save(sample_box)

        fridge_location.is_occupied = True
        fridge_location.current_sample_id = created_sample.id
        self.storage.save(fridge_location)

        result = OperationResult(True, "留样创建成功", created_sample)
        self._log_operation(
            "create_sample", "success", {"sample_id": created_sample.id}
        )
        return result

    def destroy_sample(
        self,
        sample_id: str,
        destroyer: str,
        destruction_reason: str = "正常到期销毁",
    ) -> OperationResult:
        sample = self.storage.load(FoodSample, sample_id)
        if not sample:
            result = OperationResult(False, "销毁留样失败")
            result.add_error(f"留样不存在: {sample_id}")
            return result

        if sample.is_destroyed:
            result = OperationResult(True, "留样已被销毁，无需重复操作（幂等处理）", sample)
            self._log_operation(
                "destroy_sample", "idempotent", {"sample_id": sample.id}
            )
            return result

        destruction_check = BusinessRules.check_destruction_permission(sample)
        if not destruction_check.is_valid:
            result = OperationResult(False, "销毁留样失败")
            result.errors.extend(destruction_check.errors)
            return result

        sample.is_destroyed = True
        sample.destruction_time = datetime.now().isoformat()
        sample.destroyer = destroyer
        sample.destruction_reason = destruction_reason
        sample.status = "destroyed"

        destroyed_sample = self.storage.save(sample)

        sample_boxes = self.storage.load_all(SampleBox)
        for sb in sample_boxes:
            if sb.current_sample_id == sample.id:
                sb.is_available = True
                sb.current_sample_id = None
                self.storage.save(sb)

        fridge_locations = self.storage.load_all(FridgeLocation)
        for fl in fridge_locations:
            if fl.current_sample_id == sample.id:
                fl.is_occupied = False
                fl.current_sample_id = None
                self.storage.save(fl)

        result = OperationResult(True, "留样销毁成功", destroyed_sample)
        result.warnings.extend(destruction_check.warnings)
        self._log_operation(
            "destroy_sample", "success", {"sample_id": destroyed_sample.id}
        )
        return result

    def create_inspection(
        self,
        sample_id: str,
        inspector: str,
        result: str = "正常",
        is_abnormal: bool = False,
        abnormal_details: Optional[str] = None,
        inspection_type: str = "常规抽检",
        corrective_actions: Optional[str] = None,
        follow_up_required: bool = False,
    ) -> OperationResult:
        sample = self.storage.load(FoodSample, sample_id)
        if not sample:
            op_result = OperationResult(False, "创建抽检记录失败")
            op_result.add_error(f"留样不存在: {sample_id}")
            return op_result

        if sample.is_destroyed:
            op_result = OperationResult(False, "创建抽检记录失败")
            op_result.add_error(f"留样已被销毁，无法抽检: {sample.dish_name}")
            return op_result

        inspection = InspectionRecord(
            sample_id=sample.id,
            dish_name=sample.dish_name,
            batch_number=sample.batch_number,
            inspection_time=datetime.now().isoformat(),
            inspector=inspector,
            inspection_type=inspection_type,
            result=result,
            is_abnormal=is_abnormal,
            abnormal_details=abnormal_details,
            corrective_actions=corrective_actions,
            follow_up_required=follow_up_required,
        )

        if is_abnormal:
            batch = self.storage.load(Batch, sample.batch_id)
            if batch and not batch.is_locked:
                batch.is_locked = True
                batch.lock_reason = abnormal_details or "抽检异常"
                batch.locked_at = datetime.now().isoformat()
                self.storage.save(batch)
                inspection.notes = f"批次 {batch.batch_number} 已被锁定"

        created_inspection = self.storage.save(inspection)

        op_result = OperationResult(True, "抽检记录创建成功", created_inspection)
        self._log_operation(
            "create_inspection",
            "success",
            {"inspection_id": created_inspection.id, "is_abnormal": is_abnormal},
        )
        return op_result

    def check_all_status(self) -> Dict[str, Any]:
        current_time = datetime.now().isoformat()
        samples = self.storage.load_all(FoodSample)
        active_samples = [s for s in samples if not s.is_destroyed]
        destroyed_samples = [s for s in samples if s.is_destroyed]

        overdue_samples = []
        normal_samples = []
        for sample in active_samples:
            status = sample.get_status(current_time)
            if status == "overdue":
                overdue_samples.append(sample)
            else:
                normal_samples.append(sample)

        inspections = self.storage.load_all(InspectionRecord)
        abnormal_inspections = [
            i for i in inspections if i.is_abnormal
        ]

        batches = self.storage.load_all(Batch)
        locked_batches = [b for b in batches if b.is_locked]

        dishes = self.storage.load_all(Dish)
        responsible_persons = set(d.responsible_person for d in dishes if d.responsible_person)

        return {
            "current_time": current_time,
            "summary": {
                "total_samples": len(samples),
                "active_samples": len(active_samples),
                "destroyed_samples": len(destroyed_samples),
                "overdue_samples": len(overdue_samples),
                "abnormal_inspections": len(abnormal_inspections),
                "locked_batches": len(locked_batches),
                "responsible_persons_count": len(responsible_persons),
            },
            "details": {
                "normal_active_samples": normal_samples,
                "overdue_samples": overdue_samples,
                "destroyed_samples": destroyed_samples,
                "abnormal_inspections": abnormal_inspections,
                "locked_batches": locked_batches,
            },
        }

    def manual_correct(
        self,
        target_type: str,
        target_id: str,
        updates: Dict[str, Any],
        operator: str,
        correction_reason: str,
    ) -> OperationResult:
        model_mapping = {
            "FoodSample": FoodSample,
            "Dish": Dish,
            "Batch": Batch,
            "FridgeLocation": FridgeLocation,
            "SampleBox": SampleBox,
            "InspectionRecord": InspectionRecord,
        }

        if target_type not in model_mapping:
            result = OperationResult(False, "人工修正失败")
            result.add_error(f"不支持的目标类型: {target_type}")
            return result

        model_class = model_mapping[target_type]
        entity = self.storage.load(model_class, target_id)

        if not entity:
            result = OperationResult(False, "人工修正失败")
            result.add_error(f"目标实体不存在: {target_id}")
            return result

        before_data = entity.to_dict()
        changed_fields = []

        for field, new_value in updates.items():
            if hasattr(entity, field) and field not in ["id", "created_at"]:
                old_value = getattr(entity, field)
                if old_value != new_value:
                    setattr(entity, field, new_value)
                    changed_fields.append(field)

        if not changed_fields:
            result = OperationResult(True, "没有需要修改的字段，操作幂等", entity)
            self._log_operation(
                "manual_correct",
                "idempotent",
                {"target_type": target_type, "target_id": target_id},
            )
            return result

        corrected_entity = self.storage.save(entity)
        after_data = corrected_entity.to_dict()

        correction = ManualCorrection(
            target_type=target_type,
            target_id=target_id,
            operator=operator,
            correction_reason=correction_reason,
            before_data=before_data,
            after_data=after_data,
            changed_fields=changed_fields,
        )
        self.storage.save(correction)

        result = OperationResult(True, "人工修正成功", corrected_entity)
        self._log_operation(
            "manual_correct",
            "success",
            {"target_type": target_type, "target_id": target_id, "changed_fields": changed_fields},
        )
        return result

    def get_history(self) -> List[Dict[str, Any]]:
        return self._operation_history.copy()

    def _log_operation(
        self, operation: str, status: str, details: Dict[str, Any]
    ):
        self._operation_history.append(
            {
                "timestamp": datetime.now().isoformat(),
                "operation": operation,
                "status": status,
                "details": details,
            }
        )
