from typing import Optional, Tuple, List
from datetime import datetime
from sqlalchemy.orm import Session
import hashlib
import json

from app.models.models import Batch, Inventory, OperationLog
from app.models.enums import BatchStatus, OperationType
from app.repositories.batch_repository import BatchRepository
from app.repositories.inventory_repository import InventoryRepository
from app.repositories.medicine_repository import MedicineRepository
from app.repositories.operation_log_repository import OperationLogRepository
from app.services.rule_engine import RuleEngine


class BatchService:
    def __init__(self):
        self.batch_repo = BatchRepository()
        self.inventory_repo = InventoryRepository()
        self.medicine_repo = MedicineRepository()
        self.operation_log_repo = OperationLogRepository()
        self.rule_engine = RuleEngine()

    def _generate_import_hash(self, batch_data: dict) -> str:
        data_str = json.dumps(batch_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(data_str.encode('utf-8')).hexdigest()

    def _get_batch_state(self, batch: Batch) -> str:
        return json.dumps({
            "id": batch.id,
            "batch_no": batch.batch_no,
            "status": batch.status.value,
            "quantity": batch.quantity,
            "arrival_temperature": batch.arrival_temperature,
            "damage_quantity": batch.damage_quantity
        }, ensure_ascii=False)

    def create_batch(
        self,
        db: Session,
        batch_no: str,
        medicine_id: int,
        quantity: int,
        arrival_temperature: Optional[float] = None,
        temperature_photo_path: Optional[str] = None,
        damage_photo_path: Optional[str] = None,
        damage_quantity: int = 0,
        damage_description: Optional[str] = None,
        production_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
        unit: str = "支",
        remarks: Optional[str] = None,
        operator_id: Optional[int] = None
    ) -> Tuple[Batch, bool, List[str]]:
        existing_batch = self.batch_repo.get_by_batch_no(db, batch_no)
        if existing_batch:
            return existing_batch, False, ["批号已存在，跳过创建"]

        batch = Batch(
            batch_no=batch_no,
            medicine_id=medicine_id,
            quantity=quantity,
            unit=unit,
            arrival_temperature=arrival_temperature,
            temperature_photo_path=temperature_photo_path,
            damage_photo_path=damage_photo_path,
            damage_quantity=damage_quantity,
            damage_description=damage_description,
            production_date=production_date,
            expiry_date=expiry_date,
            status=BatchStatus.PENDING,
            remarks=remarks
        )

        batch_data = {
            "batch_no": batch_no,
            "medicine_id": medicine_id,
            "quantity": quantity,
            "arrival_temperature": arrival_temperature
        }
        batch.import_hash = self._generate_import_hash(batch_data)

        db.add(batch)
        db.commit()
        db.refresh(batch)

        medicine = self.medicine_repo.get_by_id(db, medicine_id)
        _, passed = self.rule_engine.validate_all(db, batch, medicine)
        blocked_reasons = self.rule_engine.get_blocked_reasons(db, batch.id)

        if operator_id:
            self.operation_log_repo.log_operation(
                db,
                operation_type=OperationType.IMPORT,
                operator_id=operator_id,
                batch_id=batch.id,
                after_data=self._get_batch_state(batch),
                change_reason="创建批次记录"
            )

        return batch, passed, blocked_reasons

    def receive_batch(
        self,
        db: Session,
        batch_id: int,
        receiver_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[Optional[Batch], bool, List[str]]:
        batch = self.batch_repo.get_by_batch_no(db, str(batch_id)) or db.query(Batch).get(batch_id)
        if not batch:
            return None, False, ["批次不存在"]

        if batch.status not in [BatchStatus.PENDING, BatchStatus.RECEIVED]:
            return batch, False, [f"当前状态{batch.status.value}不允许签收"]

        before_state = self._get_batch_state(batch)

        medicine = self.medicine_repo.get_by_id(db, batch.medicine_id)
        _, passed = self.rule_engine.validate_all(db, batch, medicine)
        blocked_reasons = self.rule_engine.get_blocked_reasons(db, batch.id)

        if not passed:
            self.batch_repo.update_status(db, batch.id, BatchStatus.ISOLATED)
            batch.status = BatchStatus.ISOLATED

            self.operation_log_repo.log_operation(
                db,
                operation_type=OperationType.ISOLATE,
                operator_id=receiver_id,
                batch_id=batch.id,
                before_data=before_state,
                after_data=self._get_batch_state(batch),
                change_reason=f"规则校验不通过，自动隔离: {'; '.join(blocked_reasons)}",
                ip_address=ip_address,
                user_agent=user_agent
            )
            return batch, False, blocked_reasons

        batch.status = BatchStatus.RECEIVED
        batch.receiver_id = receiver_id
        batch.received_at = datetime.now()
        db.commit()
        db.refresh(batch)

        existing_inventory = self.inventory_repo.get_by_batch(db, batch.id)
        if not existing_inventory:
            net_quantity = batch.quantity - batch.damage_quantity
            inventory = Inventory(
                medicine_id=batch.medicine_id,
                batch_id=batch.id,
                quantity=batch.quantity,
                available_quantity=net_quantity,
                locked_quantity=0,
                damaged_quantity=batch.damage_quantity
            )
            self.inventory_repo.create(db, inventory)

        self.operation_log_repo.log_operation(
            db,
            operation_type=OperationType.RECEIVE,
            operator_id=receiver_id,
            batch_id=batch.id,
            before_data=before_state,
            after_data=self._get_batch_state(batch),
            change_reason="批次签收完成",
            ip_address=ip_address,
            user_agent=user_agent
        )

        return batch, True, []

    def isolate_batch(
        self,
        db: Session,
        batch_id: int,
        operator_id: int,
        reason: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[Optional[Batch], bool, List[str]]:
        batch = db.query(Batch).get(batch_id)
        if not batch:
            return None, False, ["批次不存在"]

        if batch.status == BatchStatus.ISOLATED:
            return batch, True, ["批次已处于隔离状态"]

        before_state = self._get_batch_state(batch)
        self.batch_repo.update_status(db, batch.id, BatchStatus.ISOLATED)
        batch.status = BatchStatus.ISOLATED

        inventory = self.inventory_repo.get_by_batch(db, batch.id)
        if inventory:
            self.inventory_repo.lock_quantity(db, inventory.id, inventory.available_quantity)

        self.operation_log_repo.log_operation(
            db,
            operation_type=OperationType.ISOLATE,
            operator_id=operator_id,
            batch_id=batch.id,
            before_data=before_state,
            after_data=self._get_batch_state(batch),
            change_reason=f"手动隔离: {reason}",
            ip_address=ip_address,
            user_agent=user_agent
        )

        return batch, True, []

    def review_batch(
        self,
        db: Session,
        batch_id: int,
        reviewer_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[Optional[Batch], bool, List[str]]:
        batch = db.query(Batch).get(batch_id)
        if not batch:
            return None, False, ["批次不存在"]

        if batch.status not in [BatchStatus.RECEIVED, BatchStatus.ISOLATED, BatchStatus.REVIEWING]:
            return batch, False, [f"当前状态{batch.status.value}不允许复核"]

        before_state = self._get_batch_state(batch)

        medicine = self.medicine_repo.get_by_id(db, batch.medicine_id)
        _, passed = self.rule_engine.validate_all(db, batch, medicine)
        blocked_reasons = self.rule_engine.get_blocked_reasons(db, batch.id)

        batch.status = BatchStatus.REVIEWING
        batch.reviewer_id = reviewer_id
        batch.reviewed_at = datetime.now()
        db.commit()
        db.refresh(batch)

        self.operation_log_repo.log_operation(
            db,
            operation_type=OperationType.REVIEW,
            operator_id=reviewer_id,
            batch_id=batch.id,
            before_data=before_state,
            after_data=self._get_batch_state(batch),
            change_reason=f"开始复核，规则校验{'通过' if passed else '不通过'}",
            ip_address=ip_address,
            user_agent=user_agent
        )

        return batch, passed, blocked_reasons

    def approve_batch(
        self,
        db: Session,
        batch_id: int,
        approver_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[Optional[Batch], bool, List[str]]:
        batch = db.query(Batch).get(batch_id)
        if not batch:
            return None, False, ["批次不存在"]

        if batch.status != BatchStatus.REVIEWING:
            return batch, False, [f"当前状态{batch.status.value}不允许核准"]

        before_state = self._get_batch_state(batch)

        blocked_reasons = self.rule_engine.get_blocked_reasons(db, batch.id)
        if blocked_reasons:
            self.batch_repo.update_status(db, batch.id, BatchStatus.REJECTED)
            batch.status = BatchStatus.REJECTED

            self.operation_log_repo.log_operation(
                db,
                operation_type=OperationType.REJECT,
                operator_id=approver_id,
                batch_id=batch.id,
                before_data=before_state,
                after_data=self._get_batch_state(batch),
                change_reason=f"核准不通过，规则拦截: {'; '.join(blocked_reasons)}",
                ip_address=ip_address,
                user_agent=user_agent
            )
            return batch, False, blocked_reasons

        batch.status = BatchStatus.APPROVED
        batch.approver_id = approver_id
        batch.approved_at = datetime.now()
        db.commit()
        db.refresh(batch)

        inventory = self.inventory_repo.get_by_batch(db, batch.id)
        if inventory:
            self.inventory_repo.unlock_quantity(db, inventory.id, inventory.locked_quantity)

        self.operation_log_repo.log_operation(
            db,
            operation_type=OperationType.APPROVE,
            operator_id=approver_id,
            batch_id=batch.id,
            before_data=before_state,
            after_data=self._get_batch_state(batch),
            change_reason="批次核准通过",
            ip_address=ip_address,
            user_agent=user_agent
        )

        return batch, True, []

    def release_batch(
        self,
        db: Session,
        batch_id: int,
        operator_id: int,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[Optional[Batch], bool, List[str]]:
        batch = db.query(Batch).get(batch_id)
        if not batch:
            return None, False, ["批次不存在"]

        if batch.status != BatchStatus.APPROVED:
            return batch, False, [f"当前状态{batch.status.value}不允许放行"]

        before_state = self._get_batch_state(batch)
        self.batch_repo.update_status(db, batch.id, BatchStatus.RELEASED)
        batch.status = BatchStatus.RELEASED

        self.operation_log_repo.log_operation(
            db,
            operation_type=OperationType.RELEASE,
            operator_id=operator_id,
            batch_id=batch.id,
            before_data=before_state,
            after_data=self._get_batch_state(batch),
            change_reason="批次放行，可正常出库使用",
            ip_address=ip_address,
            user_agent=user_agent
        )

        return batch, True, []

    def return_batch(
        self,
        db: Session,
        batch_id: int,
        operator_id: int,
        reason: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Tuple[Optional[Batch], bool, List[str]]:
        batch = db.query(Batch).get(batch_id)
        if not batch:
            return None, False, ["批次不存在"]

        if batch.status not in [BatchStatus.PENDING, BatchStatus.RECEIVED, BatchStatus.ISOLATED, BatchStatus.REVIEWING]:
            return batch, False, [f"当前状态{batch.status.value}不允许退回"]

        before_state = self._get_batch_state(batch)

        inventory = self.inventory_repo.get_by_batch(db, batch.id)
        if inventory:
            self.inventory_repo.lock_quantity(db, inventory.id, inventory.available_quantity)

        self.batch_repo.update_status(db, batch.id, BatchStatus.RETURNED)
        batch.status = BatchStatus.RETURNED

        self.operation_log_repo.log_operation(
            db,
            operation_type=OperationType.RETURN,
            operator_id=operator_id,
            batch_id=batch.id,
            before_data=before_state,
            after_data=self._get_batch_state(batch),
            change_reason=f"批次退回: {reason}",
            ip_address=ip_address,
            user_agent=user_agent
        )

        return batch, True, []

    def get_batch_by_hash(self, db: Session, import_hash: str) -> Optional[Batch]:
        return self.batch_repo.get_by_import_hash(db, import_hash)

    def get_batch_operation_logs(self, db: Session, batch_id: int) -> List[OperationLog]:
        return self.operation_log_repo.get_by_batch(db, batch_id)
