import hashlib
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass

from .models import (
    Database, InventoryRecord, RecordStatus,
    ProductType, AbnormalType
)


@dataclass
class OperationResult:
    success: bool
    record: Optional[InventoryRecord]
    message: str
    is_idempotent: bool = False


@dataclass
class BatchOperationResult:
    total_count: int
    success_count: int
    failed_count: int
    results: List[Tuple[int, bool, str, Optional[InventoryRecord]]]


class InventoryService:
    def __init__(self, db: Database = None):
        self.db = db or Database()

    def _generate_idempotency_key(self, operation: str, **kwargs) -> str:
        sorted_items = sorted(kwargs.items())
        key_string = f"{operation}:{':'.join(f'{k}={v}' for k, v in sorted_items)}"
        return hashlib.sha256(key_string.encode()).hexdigest()

    def _validate_temperature(self, product_type: str, temperature: float) -> Tuple[bool, str]:
        if product_type == ProductType.VACCINE.value:
            if 2 <= temperature <= 8:
                return True, ""
            return False, f"疫苗温度异常: {temperature}℃，应在2-8℃范围内"
        elif product_type == ProductType.INSULIN.value:
            if 2 <= temperature <= 8:
                return True, ""
            return False, f"胰岛素温度异常: {temperature}℃，应在2-8℃范围内"
        return True, ""

    def _get_abnormal_type(self, product_type: str, temperature: float, is_damaged: bool) -> str:
        temp_valid, _ = self._validate_temperature(product_type, temperature)
        if is_damaged:
            return AbnormalType.PACKAGE_DAMAGED.value
        if not temp_valid:
            return AbnormalType.TEMPERATURE_ABNORMAL.value
        return AbnormalType.NORMAL.value

    def receive_product(self, batch_no: str, product_type: str, product_name: str,
                        quantity: int, temperature: float, receiver: str,
                        receive_time: datetime = None, is_damaged: bool = False,
                        damage_description: str = "", idempotency_key: str = None) -> OperationResult:
        if idempotency_key is None:
            idempotency_key = self._generate_idempotency_key(
                "receive", batch_no=batch_no, product_type=product_type,
                quantity=quantity, temperature=temperature, receiver=receiver
            )

        existing_log = self.db.get_operation_log(idempotency_key)
        if existing_log:
            existing_record = self.db.get_record_by_batch(batch_no, product_type)
            return OperationResult(
                success=True,
                record=existing_record,
                message="签收操作已成功执行（幂等性保证）",
                is_idempotent=True
            )

        existing_record = self.db.get_record_by_batch(batch_no, product_type)
        if existing_record:
            self.db.log_operation(
                record_id=existing_record.id,
                operation="receive",
                operator=receiver,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"批次 {batch_no} 的 {product_type} 已存在",
                details={"batch_no": batch_no, "product_type": product_type}
            )
            return OperationResult(
                success=False,
                record=existing_record,
                message=f"签收失败：批次 {batch_no} 的 {product_type} 已存在"
            )

        if quantity <= 0:
            self.db.log_operation(
                record_id=None,
                operation="receive",
                operator=receiver,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"数量必须大于0: {quantity}",
                details={"batch_no": batch_no, "quantity": quantity}
            )
            return OperationResult(
                success=False,
                record=None,
                message=f"签收失败：数量必须大于0"
            )

        if receive_time is None:
            receive_time = datetime.now()

        abnormal_type = self._get_abnormal_type(product_type, temperature, is_damaged)

        record = InventoryRecord(
            id=None,
            batch_no=batch_no,
            product_type=product_type,
            product_name=product_name,
            quantity=quantity,
            temperature=temperature,
            receiver=receiver,
            receive_time=receive_time,
            is_damaged=is_damaged,
            damage_description=damage_description,
            status=RecordStatus.RECEIVED.value,
            abnormal_type=abnormal_type,
            handler=None,
            handle_time=None,
            handle_notes="",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            operation_idempotency_key=idempotency_key
        )

        created_record = self.db.create_record(record)
        self.db.log_operation(
            record_id=created_record.id,
            operation="receive",
            operator=receiver,
            idempotency_key=idempotency_key,
            success=True,
            details=created_record.to_dict()
        )

        return OperationResult(
            success=True,
            record=created_record,
            message="签收成功"
        )

    def isolate_product(self, batch_no: str, product_type: str, handler: str,
                        notes: str = "", idempotency_key: str = None) -> OperationResult:
        record = self.db.get_record_by_batch(batch_no, product_type)
        if not record:
            return OperationResult(
                success=False,
                record=None,
                message=f"隔离失败：找不到批次 {batch_no} 的 {product_type}"
            )

        if idempotency_key is None:
            idempotency_key = self._generate_idempotency_key(
                "isolate", batch_no=batch_no, product_type=product_type, handler=handler
            )

        existing_log = self.db.get_operation_log(idempotency_key)
        if existing_log:
            return OperationResult(
                success=True,
                record=record,
                message="隔离操作已成功执行（幂等性保证）",
                is_idempotent=True
            )

        if record.status == RecordStatus.ISOLATED.value:
            self.db.log_operation(
                record_id=record.id,
                operation="isolate",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message="产品已经处于隔离状态",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message="隔离失败：产品已经处于隔离状态"
            )

        if record.status not in [RecordStatus.RECEIVED.value, RecordStatus.REVIEWED.value]:
            self.db.log_operation(
                record_id=record.id,
                operation="isolate",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"无法从 {record.status} 状态隔离",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message=f"隔离失败：无法从 {record.status} 状态进行隔离"
            )

        success = self.db.update_record_status(
            record_id=record.id,
            status=RecordStatus.ISOLATED.value,
            handler=handler,
            notes=notes
        )

        if success:
            record.status = RecordStatus.ISOLATED.value
            self.db.log_operation(
                record_id=record.id,
                operation="isolate",
                operator=handler,
                idempotency_key=idempotency_key,
                success=True,
                details={"notes": notes}
            )
            return OperationResult(
                success=True,
                record=record,
                message="隔离成功"
            )

        return OperationResult(
            success=False,
            record=record,
            message="隔离失败：更新状态时出错"
        )

    def review_product(self, batch_no: str, product_type: str, handler: str,
                       notes: str = "", idempotency_key: str = None) -> OperationResult:
        record = self.db.get_record_by_batch(batch_no, product_type)
        if not record:
            return OperationResult(
                success=False,
                record=None,
                message=f"复核失败：找不到批次 {batch_no} 的 {product_type}"
            )

        if idempotency_key is None:
            idempotency_key = self._generate_idempotency_key(
                "review", batch_no=batch_no, product_type=product_type, handler=handler
            )

        existing_log = self.db.get_operation_log(idempotency_key)
        if existing_log:
            return OperationResult(
                success=True,
                record=record,
                message="复核操作已成功执行（幂等性保证）",
                is_idempotent=True
            )

        if record.status == RecordStatus.REVIEWED.value:
            self.db.log_operation(
                record_id=record.id,
                operation="review",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message="产品已经处于复核状态",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message="复核失败：产品已经处于复核状态"
            )

        if record.status not in [RecordStatus.RECEIVED.value, RecordStatus.ISOLATED.value]:
            self.db.log_operation(
                record_id=record.id,
                operation="review",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"无法从 {record.status} 状态复核",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message=f"复核失败：无法从 {record.status} 状态进行复核"
            )

        success = self.db.update_record_status(
            record_id=record.id,
            status=RecordStatus.REVIEWED.value,
            handler=handler,
            notes=notes
        )

        if success:
            record.status = RecordStatus.REVIEWED.value
            self.db.log_operation(
                record_id=record.id,
                operation="review",
                operator=handler,
                idempotency_key=idempotency_key,
                success=True,
                details={"notes": notes}
            )
            return OperationResult(
                success=True,
                record=record,
                message="复核成功"
            )

        return OperationResult(
            success=False,
            record=record,
            message="复核失败：更新状态时出错"
        )

    def release_product(self, batch_no: str, product_type: str, handler: str,
                        notes: str = "", idempotency_key: str = None) -> OperationResult:
        record = self.db.get_record_by_batch(batch_no, product_type)
        if not record:
            return OperationResult(
                success=False,
                record=None,
                message=f"放行失败：找不到批次 {batch_no} 的 {product_type}"
            )

        if idempotency_key is None:
            idempotency_key = self._generate_idempotency_key(
                "release", batch_no=batch_no, product_type=product_type, handler=handler
            )

        existing_log = self.db.get_operation_log(idempotency_key)
        if existing_log:
            return OperationResult(
                success=True,
                record=record,
                message="放行操作已成功执行（幂等性保证）",
                is_idempotent=True
            )

        if record.status == RecordStatus.RELEASED.value:
            self.db.log_operation(
                record_id=record.id,
                operation="release",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message="产品已经处于放行状态",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message="放行失败：产品已经处于放行状态"
            )

        if record.status != RecordStatus.REVIEWED.value:
            self.db.log_operation(
                record_id=record.id,
                operation="release",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"只有已复核的产品才能放行，当前状态: {record.status}",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message=f"放行失败：只有已复核的产品才能放行，当前状态: {record.status}"
            )

        if record.abnormal_type not in [AbnormalType.NORMAL.value, None]:
            self.db.log_operation(
                record_id=record.id,
                operation="release",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"存在异常的产品不能放行，异常类型: {record.abnormal_type}",
                details={"abnormal_type": record.abnormal_type}
            )
            return OperationResult(
                success=False,
                record=record,
                message=f"放行失败：存在异常的产品不能放行，异常类型: {record.abnormal_type}"
            )

        success = self.db.update_record_status(
            record_id=record.id,
            status=RecordStatus.RELEASED.value,
            handler=handler,
            notes=notes
        )

        if success:
            record.status = RecordStatus.RELEASED.value
            self.db.log_operation(
                record_id=record.id,
                operation="release",
                operator=handler,
                idempotency_key=idempotency_key,
                success=True,
                details={"notes": notes}
            )
            return OperationResult(
                success=True,
                record=record,
                message="放行成功"
            )

        return OperationResult(
            success=False,
            record=record,
            message="放行失败：更新状态时出错"
        )

    def return_product(self, batch_no: str, product_type: str, handler: str,
                       notes: str = "", idempotency_key: str = None) -> OperationResult:
        record = self.db.get_record_by_batch(batch_no, product_type)
        if not record:
            return OperationResult(
                success=False,
                record=None,
                message=f"退回失败：找不到批次 {batch_no} 的 {product_type}"
            )

        if idempotency_key is None:
            idempotency_key = self._generate_idempotency_key(
                "return", batch_no=batch_no, product_type=product_type, handler=handler
            )

        existing_log = self.db.get_operation_log(idempotency_key)
        if existing_log:
            return OperationResult(
                success=True,
                record=record,
                message="退回操作已成功执行（幂等性保证）",
                is_idempotent=True
            )

        if record.status == RecordStatus.RETURNED.value:
            self.db.log_operation(
                record_id=record.id,
                operation="return",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message="产品已经处于退回状态",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message="退回失败：产品已经处于退回状态"
            )

        if record.status not in [RecordStatus.RECEIVED.value, RecordStatus.ISOLATED.value, RecordStatus.REVIEWED.value]:
            self.db.log_operation(
                record_id=record.id,
                operation="return",
                operator=handler,
                idempotency_key=idempotency_key,
                success=False,
                error_message=f"无法从 {record.status} 状态退回",
                details={"current_status": record.status}
            )
            return OperationResult(
                success=False,
                record=record,
                message=f"退回失败：无法从 {record.status} 状态进行退回"
            )

        success = self.db.update_record_status(
            record_id=record.id,
            status=RecordStatus.RETURNED.value,
            handler=handler,
            notes=notes
        )

        if success:
            record.status = RecordStatus.RETURNED.value
            self.db.log_operation(
                record_id=record.id,
                operation="return",
                operator=handler,
                idempotency_key=idempotency_key,
                success=True,
                details={"notes": notes}
            )
            return OperationResult(
                success=True,
                record=record,
                message="退回成功"
            )

        return OperationResult(
            success=False,
            record=record,
            message="退回失败：更新状态时出错"
        )

    def batch_receive(self, items: List[Dict[str, Any]]) -> BatchOperationResult:
        results = []
        success_count = 0

        for idx, item in enumerate(items):
            try:
                result = self.receive_product(
                    batch_no=item['batch_no'],
                    product_type=item['product_type'],
                    product_name=item.get('product_name', ''),
                    quantity=item['quantity'],
                    temperature=item['temperature'],
                    receiver=item['receiver'],
                    receive_time=item.get('receive_time'),
                    is_damaged=item.get('is_damaged', False),
                    damage_description=item.get('damage_description', ''),
                    idempotency_key=item.get('idempotency_key')
                )
                if result.success or result.is_idempotent:
                    success_count += 1
                results.append((idx, result.success, result.message, result.record))
            except Exception as e:
                results.append((idx, False, str(e), None))

        return BatchOperationResult(
            total_count=len(items),
            success_count=success_count,
            failed_count=len(items) - success_count,
            results=results
        )

    def batch_operation(self, operation: str, items: List[Dict[str, Any]],
                        handler: str) -> BatchOperationResult:
        results = []
        success_count = 0

        operation_map = {
            'isolate': self.isolate_product,
            'review': self.review_product,
            'release': self.release_product,
            'return': self.return_product
        }

        if operation not in operation_map:
            raise ValueError(f"不支持的操作类型: {operation}")

        operation_func = operation_map[operation]

        for idx, item in enumerate(items):
            try:
                result = operation_func(
                    batch_no=item['batch_no'],
                    product_type=item['product_type'],
                    handler=handler,
                    notes=item.get('notes', ''),
                    idempotency_key=item.get('idempotency_key')
                )
                if result.success or result.is_idempotent:
                    success_count += 1
                results.append((idx, result.success, result.message, result.record))
            except Exception as e:
                results.append((idx, False, str(e), None))

        return BatchOperationResult(
            total_count=len(items),
            success_count=success_count,
            failed_count=len(items) - success_count,
            results=results
        )
