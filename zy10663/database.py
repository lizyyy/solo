import uuid
from datetime import datetime
from typing import List, Optional, Dict
from models import TransferOrder, TransferHistory, TransferStatus, StockInfo, ErrorType


class TransferRepository:
    def __init__(self):
        self._transfers: Dict[str, TransferOrder] = {}
        self._histories: List[TransferHistory] = []
        self._stocks: Dict[str, StockInfo] = {}
        self._init_mock_data()

    def _init_mock_data(self):
        self._stocks = {
            "WH001:SKU001": StockInfo(sku="SKU001", warehouse="WH001", available_qty=100, locked_qty=0, last_updated=datetime.now()),
            "WH001:SKU002": StockInfo(sku="SKU002", warehouse="WH001", available_qty=50, locked_qty=0, last_updated=datetime.now()),
            "WH002:SKU001": StockInfo(sku="SKU001", warehouse="WH002", available_qty=20, locked_qty=0, last_updated=datetime.now()),
        }

    def generate_id(self) -> str:
        return str(uuid.uuid4())

    def create_transfer(self, transfer: TransferOrder) -> TransferOrder:
        self._transfers[transfer.transfer_id] = transfer
        self._add_history(transfer.transfer_id, "创建", None, transfer.status, transfer.created_by, transfer.remark)
        return transfer

    def get_transfer(self, transfer_id: str) -> Optional[TransferOrder]:
        return self._transfers.get(transfer_id)

    def list_transfers(self, status: Optional[TransferStatus] = None, 
                       source_warehouse: Optional[str] = None,
                       target_warehouse: Optional[str] = None,
                       sku: Optional[str] = None,
                       need_manual: Optional[bool] = None) -> List[TransferOrder]:
        transfers = list(self._transfers.values())
        if status:
            transfers = [t for t in transfers if t.status == status]
        if source_warehouse:
            transfers = [t for t in transfers if t.source_warehouse == source_warehouse]
        if target_warehouse:
            transfers = [t for t in transfers if t.target_warehouse == target_warehouse]
        if sku:
            transfers = [t for t in transfers if t.sku == sku]
        if need_manual is not None:
            transfers = [t for t in transfers if t.need_manual == need_manual]
        return sorted(transfers, key=lambda x: x.created_at, reverse=True)

    def update_transfer_status(self, transfer_id: str, new_status: TransferStatus, 
                               operator: Optional[str] = None, remark: Optional[str] = None,
                               error_type: Optional[ErrorType] = None, error_message: Optional[str] = None,
                               need_manual: bool = False) -> Optional[TransferOrder]:
        transfer = self._transfers.get(transfer_id)
        if not transfer:
            return None
        old_status = transfer.status
        transfer.status = new_status
        transfer.updated_at = datetime.now()
        transfer.need_manual = need_manual
        if error_type:
            transfer.error_type = error_type
        if error_message:
            transfer.error_message = error_message
        if new_status == TransferStatus.LOCKED:
            transfer.lock_time = datetime.now()
        if new_status == TransferStatus.COMPLETED:
            transfer.complete_time = datetime.now()
        self._add_history(transfer_id, "状态变更", old_status, new_status, operator, remark)
        return transfer

    def update_transfer_remark(self, transfer_id: str, remark: str, operator: Optional[str] = None) -> Optional[TransferOrder]:
        transfer = self._transfers.get(transfer_id)
        if not transfer:
            return None
        old_remark = transfer.remark
        transfer.remark = remark
        transfer.updated_at = datetime.now()
        self._add_history(transfer_id, "更新备注", None, None, operator, 
                         f"旧备注: {old_remark}, 新备注: {remark}")
        return transfer

    def _add_history(self, transfer_id: str, operation_type: str,
                     old_status: Optional[TransferStatus], new_status: Optional[TransferStatus],
                     operator: Optional[str], remark: Optional[str],
                     extra_info: Optional[dict] = None):
        history = TransferHistory(
            history_id=self.generate_id(),
            transfer_id=transfer_id,
            operation_type=operation_type,
            old_status=old_status,
            new_status=new_status,
            operator=operator,
            remark=remark,
            extra_info=extra_info
        )
        self._histories.append(history)

    def get_transfer_history(self, transfer_id: str) -> List[TransferHistory]:
        return [h for h in self._histories if h.transfer_id == transfer_id]

    def get_stock(self, sku: str, warehouse: str) -> Optional[StockInfo]:
        key = f"{warehouse}:{sku}"
        return self._stocks.get(key)

    def update_stock(self, sku: str, warehouse: str, available_qty: int = None, locked_qty: int = None):
        key = f"{warehouse}:{sku}"
        stock = self._stocks.get(key)
        if not stock:
            stock = StockInfo(sku=sku, warehouse=warehouse, available_qty=0, locked_qty=0, last_updated=datetime.now())
            self._stocks[key] = stock
        if available_qty is not None:
            stock.available_qty = available_qty
        if locked_qty is not None:
            stock.locked_qty = locked_qty
        stock.last_updated = datetime.now()
        return stock


repository = TransferRepository()
