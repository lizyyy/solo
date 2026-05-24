from enum import Enum
from typing import Tuple, Optional
from sqlalchemy.orm import Session
import models


class ToppingStatus(str, Enum):
    PENDING = "pending"
    INSPECTION_REQUIRED = "inspection_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    CLOSED = "closed"


class InspectionStatus(str, Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"


class StateTransition:
    ALLOWED_TRANSITIONS = {
        ToppingStatus.PENDING: [
            ToppingStatus.INSPECTION_REQUIRED,
            ToppingStatus.BLOCKED
        ],
        ToppingStatus.INSPECTION_REQUIRED: [
            ToppingStatus.APPROVED,
            ToppingStatus.REJECTED
        ],
        ToppingStatus.APPROVED: [
            ToppingStatus.COMPLETED,
            ToppingStatus.CLOSED
        ],
        ToppingStatus.REJECTED: [
            ToppingStatus.PENDING,
            ToppingStatus.CLOSED
        ],
        ToppingStatus.BLOCKED: [
            ToppingStatus.PENDING,
            ToppingStatus.CLOSED
        ],
        ToppingStatus.COMPLETED: [
            ToppingStatus.CLOSED
        ]
    }

    @classmethod
    def can_transition(cls, current_status: str, target_status: str) -> bool:
        allowed = cls.ALLOWED_TRANSITIONS.get(current_status, [])
        return target_status in allowed


class BatchValidator:
    @staticmethod
    def validate_barrel_batch_match(db: Session, barrel_id: int, batch_id: int) -> Tuple[bool, str]:
        active_batch_record = db.query(models.BatchRecord).filter(
            models.BatchRecord.barrel_id == barrel_id,
            models.BatchRecord.is_active == True
        ).first()

        if not active_batch_record:
            return False, f"橡木桶没有活跃的酒液批次记录"

        if active_batch_record.batch_id != batch_id:
            return False, f"添酒批次不匹配：桶内批次 ID {active_batch_record.batch_id}，添酒批次 ID {batch_id}"

        return True, "批次匹配验证通过"

    @staticmethod
    def validate_batch_volume(db: Session, batch_id: int, required_volume: float) -> Tuple[bool, str]:
        batch = db.query(models.WineBatch).filter(models.WineBatch.id == batch_id).first()
        if not batch:
            return False, "酒液批次不存在"

        if batch.remaining_volume < required_volume:
            return False, f"批次剩余酒量不足：需要 {required_volume}L，剩余 {batch.remaining_volume}L"

        return True, "批次酒量验证通过"

    @staticmethod
    def validate_barrel_capacity(db: Session, barrel_id: int, topping_volume: float) -> Tuple[bool, str]:
        barrel = db.query(models.OakBarrel).filter(models.OakBarrel.id == barrel_id).first()
        if not barrel:
            return False, "橡木桶不存在"

        new_volume = barrel.current_volume + topping_volume
        if new_volume > barrel.capacity:
            return False, f"橡木桶容量不足：当前 {barrel.current_volume}L，添酒 {topping_volume}L，将超过容量 {barrel.capacity}L"

        return True, "桶容量验证通过"


class InspectionInterceptor:
    @staticmethod
    def check_inspection_before_approval(db: Session, topping_record_id: int) -> Tuple[bool, str]:
        record = db.query(models.ToppingRecord).filter(
            models.ToppingRecord.id == topping_record_id
        ).first()

        if not record:
            return False, "添酒记录不存在"

        if record.inspection_status != InspectionStatus.PASSED:
            return False, f"检验未通过，当前状态：{record.inspection_status}"

        if not record.inspection:
            return False, "未找到检验结果"

        if not record.inspection.passed:
            return False, "检验结果为不通过，无法放行"

        return True, "检验验证通过"

    @staticmethod
    def validate_inspection_score(overall_score: float, min_score: float = 70.0) -> Tuple[bool, str]:
        if overall_score < min_score:
            return False, f"综合评分 {overall_score} 低于最低要求 {min_score} 分"
        return True, "评分验证通过"


class BarrelTracker:
    @staticmethod
    def update_barrel_volume(db: Session, barrel_id: int, volume_change: float) -> Tuple[bool, str]:
        barrel = db.query(models.OakBarrel).filter(models.OakBarrel.id == barrel_id).first()
        if not barrel:
            return False, "橡木桶不存在"

        new_volume = barrel.current_volume + volume_change
        if new_volume < 0:
            return False, "桶内酒量不能为负数"

        barrel.current_volume = new_volume
        db.commit()
        return True, f"桶容量已更新：{barrel.current_volume}L"

    @staticmethod
    def update_batch_volume(db: Session, batch_id: int, volume_change: float) -> Tuple[bool, str]:
        batch = db.query(models.WineBatch).filter(models.WineBatch.id == batch_id).first()
        if not batch:
            return False, "酒液批次不存在"

        new_volume = batch.remaining_volume + volume_change
        if new_volume < 0:
            return False, "批次剩余酒量不能为负数"

        batch.remaining_volume = new_volume
        db.commit()
        return True, f"批次剩余酒量已更新：{batch.remaining_volume}L"


class DuplicateHandler:
    @staticmethod
    def check_duplicate(db: Session, barrel_id: int, source_batch_id: int, topping_date) -> Tuple[bool, Optional[models.ToppingRecord], str]:
        existing = db.query(models.ToppingRecord).filter(
            models.ToppingRecord.barrel_id == barrel_id,
            models.ToppingRecord.source_batch_id == source_batch_id,
            models.ToppingRecord.topping_date == topping_date,
            models.ToppingRecord.is_valid == True
        ).first()

        if existing:
            return True, existing, f"发现重复记录：桶 {barrel_id}，批次 {source_batch_id}，日期 {topping_date}"

        return False, None, "无重复记录"

    @staticmethod
    def get_validity_explanation(record: models.ToppingRecord) -> str:
        if record.is_valid:
            if record.version > 1:
                return f"第 {record.version} 版有效记录（补录版本）"
            return "原始有效记录"
        else:
            return f"已被第 {record.version + 1} 版补录记录替代"
