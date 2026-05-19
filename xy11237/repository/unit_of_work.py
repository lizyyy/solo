from contextlib import contextmanager
from typing import Generator

from .repositories import (
    ReagentRepository,
    ReagentInventoryRepository,
    ApplicationRepository,
    ApplicationItemRepository,
    ApprovalRecordRepository,
    OutboundRecordRepository,
    ReturnRecordRepository,
    InventoryRecordRepository,
    OperationLogRepository,
)


class UnitOfWork:
    def __init__(self, base_path: str = "data"):
        self.base_path = base_path
        self._reagents: Optional[ReagentRepository] = None
        self._inventory: Optional[ReagentInventoryRepository] = None
        self._applications: Optional[ApplicationRepository] = None
        self._application_items: Optional[ApplicationItemRepository] = None
        self._approvals: Optional[ApprovalRecordRepository] = None
        self._outbounds: Optional[OutboundRecordRepository] = None
        self._returns: Optional[ReturnRecordRepository] = None
        self._inventories: Optional[InventoryRecordRepository] = None
        self._logs: Optional[OperationLogRepository] = None

    @property
    def reagents(self) -> ReagentRepository:
        if self._reagents is None:
            self._reagents = ReagentRepository(f"{self.base_path}/reagents")
        return self._reagents

    @property
    def inventory(self) -> ReagentInventoryRepository:
        if self._inventory is None:
            self._inventory = ReagentInventoryRepository(f"{self.base_path}/inventory")
        return self._inventory

    @property
    def applications(self) -> ApplicationRepository:
        if self._applications is None:
            self._applications = ApplicationRepository(f"{self.base_path}/applications")
        return self._applications

    @property
    def application_items(self) -> ApplicationItemRepository:
        if self._application_items is None:
            self._application_items = ApplicationItemRepository(f"{self.base_path}/application_items")
        return self._application_items

    @property
    def approvals(self) -> ApprovalRecordRepository:
        if self._approvals is None:
            self._approvals = ApprovalRecordRepository(f"{self.base_path}/approvals")
        return self._approvals

    @property
    def outbounds(self) -> OutboundRecordRepository:
        if self._outbounds is None:
            self._outbounds = OutboundRecordRepository(f"{self.base_path}/outbounds")
        return self._outbounds

    @property
    def returns(self) -> ReturnRecordRepository:
        if self._returns is None:
            self._returns = ReturnRecordRepository(f"{self.base_path}/returns")
        return self._returns

    @property
    def inventories(self) -> InventoryRecordRepository:
        if self._inventories is None:
            self._inventories = InventoryRecordRepository(f"{self.base_path}/inventories")
        return self._inventories

    @property
    def logs(self) -> OperationLogRepository:
        if self._logs is None:
            self._logs = OperationLogRepository(f"{self.base_path}/logs")
        return self._logs

    def reload_all(self):
        self._reagents = None
        self._inventory = None
        self._applications = None
        self._application_items = None
        self._approvals = None
        self._outbounds = None
        self._returns = None
        self._inventories = None
        self._logs = None


@contextmanager
def unit_of_work(base_path: str = "data") -> Generator[UnitOfWork, None, None]:
    uow = UnitOfWork(base_path)
    try:
        yield uow
    except Exception:
        uow.reload_all()
        raise
