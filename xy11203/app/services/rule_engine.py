from typing import List, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import Batch, RuleResult, Medicine
from app.models.enums import RuleType, RuleResultStatus
from app.repositories.rule_result_repository import RuleResultRepository
from app.repositories.batch_repository import BatchRepository


class RuleEngine:
    def __init__(self):
        self.rule_result_repo = RuleResultRepository()
        self.batch_repo = BatchRepository()

    def validate_temperature(self, db: Session, batch: Batch, medicine: Optional[Medicine] = None) -> RuleResult:
        temp_min = settings.TEMPERATURE_MIN
        temp_max = settings.TEMPERATURE_MAX

        if medicine and medicine.temperature_min is not None:
            temp_min = medicine.temperature_min
        if medicine and medicine.temperature_max is not None:
            temp_max = medicine.temperature_max

        actual_temp = batch.arrival_temperature
        if actual_temp is None:
            status = RuleResultStatus.WARNING
            reason = "未提供到店温度数据"
        elif actual_temp < temp_min or actual_temp > temp_max:
            status = RuleResultStatus.BLOCKED
            reason = f"温度超出范围：实际{actual_temp}℃，要求范围{temp_min}℃~{temp_max}℃"
        else:
            status = RuleResultStatus.PASSED
            reason = f"温度正常：{actual_temp}℃，在范围{temp_min}℃~{temp_max}℃内"

        rule_result = RuleResult(
            batch_id=batch.id,
            rule_type=RuleType.TEMPERATURE,
            status=status,
            reason=reason,
            actual_value=str(actual_temp) if actual_temp is not None else None,
            expected_value=f"{temp_min}~{temp_max}"
        )
        return self.rule_result_repo.create(db, rule_result)

    def validate_duplicate_batch(self, db: Session, batch: Batch) -> RuleResult:
        duplicates = self.batch_repo.get_duplicate_batches(db, batch.batch_no, exclude_id=batch.id)

        if duplicates:
            status = RuleResultStatus.BLOCKED
            duplicate_ids = ", ".join([str(d.id) for d in duplicates])
            reason = f"批号重复：已存在相同批号的记录（ID: {duplicate_ids}）"
        else:
            status = RuleResultStatus.PASSED
            reason = "批号唯一，无重复"

        rule_result = RuleResult(
            batch_id=batch.id,
            rule_type=RuleType.BATCH_DUPLICATE,
            status=status,
            reason=reason,
            actual_value=batch.batch_no,
            expected_value="唯一批号"
        )
        return self.rule_result_repo.create(db, rule_result)

    def validate_photos(self, db: Session, batch: Batch) -> RuleResult:
        has_temp_photo = bool(batch.temperature_photo_path)
        has_damage_photo = bool(batch.damage_photo_path)
        has_damage = batch.damage_quantity and batch.damage_quantity > 0

        missing_photos = []
        if not has_temp_photo:
            missing_photos.append("温度照片")
        if has_damage and not has_damage_photo:
            missing_photos.append("破损照片")

        if missing_photos:
            status = RuleResultStatus.BLOCKED
            reason = f"缺少必要照片：{', '.join(missing_photos)}"
        else:
            status = RuleResultStatus.PASSED
            reason = "所有必要照片已上传"

        rule_result = RuleResult(
            batch_id=batch.id,
            rule_type=RuleType.MISSING_PHOTO,
            status=status,
            reason=reason,
            actual_value=None if missing_photos else "全部存在",
            expected_value="温度照片" + (", 破损照片" if has_damage else "")
        )
        return self.rule_result_repo.create(db, rule_result)

    def validate_expiry_date(self, db: Session, batch: Batch, days_warning: int = 90) -> RuleResult:
        if not batch.expiry_date:
            status = RuleResultStatus.WARNING
            reason = "未提供有效期信息"
            actual_value = None
        else:
            days_to_expiry = (batch.expiry_date - datetime.now()).days
            if days_to_expiry <= 0:
                status = RuleResultStatus.BLOCKED
                reason = f"药品已过期：有效期至{batch.expiry_date.strftime('%Y-%m-%d')}"
            elif days_to_expiry <= days_warning:
                status = RuleResultStatus.WARNING
                reason = f"药品即将过期：剩余{days_to_expiry}天，有效期至{batch.expiry_date.strftime('%Y-%m-%d')}"
            else:
                status = RuleResultStatus.PASSED
                reason = f"有效期正常：剩余{days_to_expiry}天"
            actual_value = str(days_to_expiry)

        rule_result = RuleResult(
            batch_id=batch.id,
            rule_type=RuleType.EXPIRY_DATE,
            status=status,
            reason=reason,
            actual_value=actual_value,
            expected_value=f">{days_warning}天"
        )
        return self.rule_result_repo.create(db, rule_result)

    def validate_inventory_change(self, db: Session, batch: Batch, new_quantity: int) -> RuleResult:
        from app.repositories.inventory_repository import InventoryRepository
        inventory_repo = InventoryRepository()
        inventory = inventory_repo.get_by_batch(db, batch.id)

        if not inventory:
            status = RuleResultStatus.WARNING
            reason = "该批次暂无库存记录"
            actual_value = None
        else:
            quantity_diff = new_quantity - inventory.quantity
            if quantity_diff != 0:
                status = RuleResultStatus.WARNING
                reason = f"库存数量变更：原{inventory.quantity}{batch.unit}，新{new_quantity}{batch.unit}，差额{quantity_diff}{batch.unit}"
            else:
                status = RuleResultStatus.PASSED
                reason = f"库存数量无变更：{new_quantity}{batch.unit}"
            actual_value = str(new_quantity)

        rule_result = RuleResult(
            batch_id=batch.id,
            rule_type=RuleType.INVENTORY_CHANGE,
            status=status,
            reason=reason,
            actual_value=actual_value,
            expected_value=str(inventory.quantity) if inventory else None
        )
        return self.rule_result_repo.create(db, rule_result)

    def validate_all(self, db: Session, batch: Batch, medicine: Optional[Medicine] = None) -> Tuple[List[RuleResult], bool]:
        results = []
        results.append(self.validate_temperature(db, batch, medicine))
        results.append(self.validate_duplicate_batch(db, batch))
        results.append(self.validate_photos(db, batch))
        results.append(self.validate_expiry_date(db, batch))

        has_blocked = any(r.status == RuleResultStatus.BLOCKED for r in results)
        return results, not has_blocked

    def get_blocked_reasons(self, db: Session, batch_id: int) -> List[str]:
        return self.rule_result_repo.get_blocked_reasons(db, batch_id)
