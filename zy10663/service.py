from datetime import datetime
from typing import List, Dict, Tuple, Optional
from models import TransferOrder, TransferStatus, ErrorType, ImportResult
from database import repository


class TransferService:
    def __init__(self, repo):
        self.repo = repo

    def _validate_transfer_data(self, data: Dict) -> Tuple[bool, Optional[str], Optional[ErrorType]]:
        if not data.get("source_warehouse"):
            return False, "源仓库编码不能为空", ErrorType.DATA_ERROR
        if not data.get("target_warehouse"):
            return False, "目标仓库编码不能为空", ErrorType.DATA_ERROR
        if not data.get("sku"):
            return False, "SKU编码不能为空", ErrorType.DATA_ERROR
        quantity = data.get("quantity")
        if quantity is None or not isinstance(quantity, int) or quantity <= 0:
            return False, "调拨数量必须是正整数", ErrorType.DATA_ERROR
        if data.get("source_warehouse") == data.get("target_warehouse"):
            return False, "源仓库和目标仓库不能相同", ErrorType.DATA_ERROR
        return True, None, None

    def _check_stock_conflict(self, sku: str, warehouse: str, quantity: int) -> Tuple[bool, str]:
        stock = self.repo.get_stock(sku, warehouse)
        if not stock:
            return False, f"SKU {sku} 在仓库 {warehouse} 不存在"
        available = stock.available_qty - stock.locked_qty
        if available < quantity:
            return False, f"库存不足: 可用 {available}, 需要 {quantity} (已锁定 {stock.locked_qty})"
        return True, ""

    def batch_import(self, import_data: List[Dict], operator: Optional[str] = None) -> ImportResult:
        success_count = 0
        failed_count = 0
        failed_rows = []
        success_ids = []

        for idx, row_data in enumerate(import_data):
            row_num = idx + 1
            try:
                is_valid, error_msg, error_type = self._validate_transfer_data(row_data)
                if not is_valid:
                    failed_rows.append({
                        "row": row_num,
                        "data": row_data,
                        "error_message": error_msg,
                        "error_type": error_type.value if error_type else ErrorType.DATA_ERROR.value,
                        "action": "补数据"
                    })
                    failed_count += 1
                    continue

                sku = row_data["sku"]
                source_warehouse = row_data["source_warehouse"]
                quantity = row_data["quantity"]

                has_stock, stock_msg = self._check_stock_conflict(sku, source_warehouse, quantity)
                if not has_stock:
                    transfer = TransferOrder(
                        transfer_id=self.repo.generate_id(),
                        source_warehouse=source_warehouse,
                        target_warehouse=row_data["target_warehouse"],
                        sku=sku,
                        sku_name=row_data.get("sku_name"),
                        quantity=quantity,
                        status=TransferStatus.NEED_MANUAL,
                        created_by=operator,
                        is_imported=True,
                        error_type=ErrorType.STOCK_CONFLICT,
                        error_message=stock_msg,
                        need_manual=True,
                        remark=row_data.get("remark", "")
                    )
                    self.repo.create_transfer(transfer)
                    failed_rows.append({
                        "row": row_num,
                        "transfer_id": transfer.transfer_id,
                        "data": row_data,
                        "error_message": stock_msg,
                        "error_type": ErrorType.STOCK_CONFLICT.value,
                        "action": "转人工"
                    })
                    success_ids.append(transfer.transfer_id)
                    success_count += 1
                    continue

                transfer = TransferOrder(
                    transfer_id=self.repo.generate_id(),
                    source_warehouse=source_warehouse,
                    target_warehouse=row_data["target_warehouse"],
                    sku=sku,
                    sku_name=row_data.get("sku_name"),
                    quantity=quantity,
                    status=TransferStatus.PENDING,
                    created_by=operator,
                    is_imported=True,
                    remark=row_data.get("remark", "")
                )
                self.repo.create_transfer(transfer)
                success_count += 1
                success_ids.append(transfer.transfer_id)

            except Exception as e:
                failed_rows.append({
                    "row": row_num,
                    "data": row_data,
                    "error_message": f"系统异常: {str(e)}",
                    "error_type": ErrorType.SYSTEM_ERROR.value,
                    "action": "转人工"
                })
                failed_count += 1

        return ImportResult(
            success_count=success_count,
            failed_count=failed_count,
            total_count=len(import_data),
            failed_rows=failed_rows,
            success_ids=success_ids
        )

    def create_single_transfer(self, data: Dict, operator: Optional[str] = None) -> TransferOrder:
        is_valid, error_msg, error_type = self._validate_transfer_data(data)
        if not is_valid:
            raise ValueError(f"{error_type.value}: {error_msg}")

        transfer = TransferOrder(
            transfer_id=self.repo.generate_id(),
            source_warehouse=data["source_warehouse"],
            target_warehouse=data["target_warehouse"],
            sku=data["sku"],
            sku_name=data.get("sku_name"),
            quantity=data["quantity"],
            status=TransferStatus.PENDING,
            created_by=operator,
            is_imported=False,
            remark=data.get("remark", "")
        )
        return self.repo.create_transfer(transfer)

    def audit_and_lock(self, transfer_id: str, operator: Optional[str] = None) -> TransferOrder:
        transfer = self.repo.get_transfer(transfer_id)
        if not transfer:
            raise ValueError("调拨单不存在")

        if transfer.status not in [TransferStatus.PENDING, TransferStatus.NEED_MANUAL]:
            raise ValueError(f"当前状态 {transfer.status} 不允许锁定")

        has_stock, stock_msg = self._check_stock_conflict(
            transfer.sku, transfer.source_warehouse, transfer.quantity
        )
        if not has_stock:
            self.repo.update_transfer_status(
                transfer_id, TransferStatus.NEED_MANUAL,
                operator=operator,
                remark=f"锁定失败: {stock_msg}",
                error_type=ErrorType.STOCK_CONFLICT,
                error_message=stock_msg,
                need_manual=True
            )
            raise ValueError(f"库存冲突: {stock_msg}, 请转人工处理")

        stock = self.repo.get_stock(transfer.sku, transfer.source_warehouse)
        self.repo.update_stock(
            transfer.sku, transfer.source_warehouse,
            locked_qty=stock.locked_qty + transfer.quantity
        )

        return self.repo.update_transfer_status(
            transfer_id, TransferStatus.LOCKED,
            operator=operator,
            remark="审核通过，库存锁定成功"
        )

    def mark_in_transit(self, transfer_id: str, operator: Optional[str] = None) -> TransferOrder:
        transfer = self.repo.get_transfer(transfer_id)
        if not transfer:
            raise ValueError("调拨单不存在")
        if transfer.status != TransferStatus.LOCKED:
            raise ValueError(f"当前状态 {transfer.status} 不允许标记在途")

        return self.repo.update_transfer_status(
            transfer_id, TransferStatus.IN_TRANSIT,
            operator=operator,
            remark="货物已发出，标记在途"
        )

    def complete_transfer(self, transfer_id: str, operator: Optional[str] = None) -> TransferOrder:
        transfer = self.repo.get_transfer(transfer_id)
        if not transfer:
            raise ValueError("调拨单不存在")
        if transfer.status != TransferStatus.IN_TRANSIT:
            raise ValueError(f"当前状态 {transfer.status} 不允许完成")

        source_stock = self.repo.get_stock(transfer.sku, transfer.source_warehouse)
        self.repo.update_stock(
            transfer.sku, transfer.source_warehouse,
            available_qty=source_stock.available_qty - transfer.quantity,
            locked_qty=source_stock.locked_qty - transfer.quantity
        )

        target_stock = self.repo.get_stock(transfer.sku, transfer.target_warehouse)
        if target_stock:
            self.repo.update_stock(
                transfer.sku, transfer.target_warehouse,
                available_qty=target_stock.available_qty + transfer.quantity
            )
        else:
            self.repo.update_stock(
                transfer.sku, transfer.target_warehouse,
                available_qty=transfer.quantity,
                locked_qty=0
            )

        return self.repo.update_transfer_status(
            transfer_id, TransferStatus.COMPLETED,
            operator=operator,
            remark="调拨完成，库存已更新"
        )

    def add_manual_remark(self, transfer_id: str, remark: str, operator: Optional[str] = None,
                          resolve_manual: bool = False) -> TransferOrder:
        transfer = self.repo.get_transfer(transfer_id)
        if not transfer:
            raise ValueError("调拨单不存在")

        result = self.repo.update_transfer_remark(transfer_id, remark, operator)

        if resolve_manual and transfer.status == TransferStatus.NEED_MANUAL:
            result = self.repo.update_transfer_status(
                transfer_id, TransferStatus.PENDING,
                operator=operator,
                remark=f"人工处理完成，恢复待调拨状态。备注: {remark}",
                need_manual=False
            )

        return result

    def export_transfers(self, status: Optional[TransferStatus] = None,
                         source_warehouse: Optional[str] = None,
                         target_warehouse: Optional[str] = None) -> List[Dict]:
        transfers = self.repo.list_transfers(status, source_warehouse, target_warehouse)
        result = []
        for t in transfers:
            result.append({
                "调拨单ID": t.transfer_id,
                "源仓库": t.source_warehouse,
                "目标仓库": t.target_warehouse,
                "SKU": t.sku,
                "SKU名称": t.sku_name or "",
                "调拨数量": t.quantity,
                "状态": t.status.value,
                "是否导入": "是" if t.is_imported else "否",
                "是否待人工": "是" if t.need_manual else "否",
                "错误类型": t.error_type.value if t.error_type else "",
                "错误信息": t.error_message or "",
                "锁定时间": t.lock_time.strftime("%Y-%m-%d %H:%M:%S") if t.lock_time else "",
                "完成时间": t.complete_time.strftime("%Y-%m-%d %H:%M:%S") if t.complete_time else "",
                "创建时间": t.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "创建人": t.created_by or "",
                "备注": t.remark or ""
            })
        return result

    def retry_failed_transfer(self, transfer_id: str, operator: Optional[str] = None) -> TransferOrder:
        transfer = self.repo.get_transfer(transfer_id)
        if not transfer:
            raise ValueError("调拨单不存在")
        if transfer.status != TransferStatus.NEED_MANUAL:
            raise ValueError(f"只有待人工处理的调拨单可以重试")

        has_stock, stock_msg = self._check_stock_conflict(
            transfer.sku, transfer.source_warehouse, transfer.quantity
        )
        if not has_stock:
            raise ValueError(f"重试失败，库存仍不足: {stock_msg}")

        return self.repo.update_transfer_status(
            transfer_id, TransferStatus.PENDING,
            operator=operator,
            remark="重试成功，恢复待调拨",
            need_manual=False
        )


transfer_service = TransferService(repository)
