from typing import Optional, List
from datetime import datetime

from .base import BaseRepository, IdempotentRepository
from models import (
    Reagent,
    ReagentInventory,
    Application,
    ApplicationItem,
    ApprovalRecord,
    OutboundRecord,
    OutboundItem,
    ReturnRecord,
    ReturnItem,
    InventoryRecord,
    InventoryItem,
    OperationLog,
    QueryFilter,
    ApplicationStatus,
    ExceptionType,
)


class ReagentRepository(BaseRepository[Reagent]):
    def __init__(self, storage_path: str = "data/reagents"):
        super().__init__(storage_path, Reagent)

    def find_by_name(self, name: str) -> List[Reagent]:
        return self.find_by(lambda r: name in r.name)

    def find_dangerous(self) -> List[Reagent]:
        return self.find_by(lambda r: r.is_dangerous)


class ReagentInventoryRepository(BaseRepository[ReagentInventory]):
    def __init__(self, storage_path: str = "data/inventory"):
        super().__init__(storage_path, ReagentInventory)

    def find_by_reagent_id(self, reagent_id: str) -> List[ReagentInventory]:
        return self.find_by(lambda inv: inv.reagent_id == reagent_id)

    def find_by_batch_no(self, batch_no: str) -> Optional[ReagentInventory]:
        return self.find_one(lambda inv: inv.batch_no == batch_no)

    def get_total_quantity(self, reagent_id: str) -> float:
        inventories = self.find_by_reagent_id(reagent_id)
        return sum(inv.quantity for inv in inventories)

    def get_available_quantity(self, reagent_id: str) -> float:
        inventories = self.find_by_reagent_id(reagent_id)
        return sum(inv.available_quantity for inv in inventories)


class ApplicationRepository(IdempotentRepository[Application]):
    def __init__(self, storage_path: str = "data/applications"):
        super().__init__(storage_path, Application)

    def find_by_applicant(self, applicant_id: str) -> List[Application]:
        return self.find_by(lambda a: a.applicant_id == applicant_id)

    def find_by_status(self, status: ApplicationStatus) -> List[Application]:
        return self.find_by(lambda a: a.status == status)

    def find_pending_approvals(self) -> List[Application]:
        return self.find_by(lambda a: a.status in [ApplicationStatus.PENDING, ApplicationStatus.APPROVING])

    def query(self, filter: QueryFilter) -> List[Application]:
        def predicate(a: Application) -> bool:
            if filter.applicant_id and a.applicant_id != filter.applicant_id:
                return False
            if filter.applicant_name and filter.applicant_name not in a.applicant_name:
                return False
            if filter.department and a.department != filter.department:
                return False
            if filter.status and a.status != filter.status:
                return False
            if filter.exception_type and a.exception_type != filter.exception_type:
                return False
            if filter.start_date and a.created_at < filter.start_date:
                return False
            if filter.end_date and a.created_at > filter.end_date:
                return False
            if filter.contains_dangerous_goods is not None:
                if a.contains_dangerous_goods != filter.contains_dangerous_goods:
                    return False
            return True
        return self.find_by(predicate)


class ApplicationItemRepository(IdempotentRepository[ApplicationItem]):
    def __init__(self, storage_path: str = "data/application_items"):
        super().__init__(storage_path, ApplicationItem)

    def find_by_application_id(self, application_id: str) -> List[ApplicationItem]:
        return self.find_by(lambda item: item.application_id == application_id)


class ApprovalRecordRepository(IdempotentRepository[ApprovalRecord]):
    def __init__(self, storage_path: str = "data/approvals"):
        super().__init__(storage_path, ApprovalRecord)

    def find_by_application_id(self, application_id: str) -> List[ApprovalRecord]:
        return self.find_by(lambda r: r.application_id == application_id)

    def find_by_approver(self, approver_id: str) -> List[ApprovalRecord]:
        return self.find_by(lambda r: r.approver_id == approver_id)


class OutboundRecordRepository(IdempotentRepository[OutboundRecord]):
    def __init__(self, storage_path: str = "data/outbounds"):
        super().__init__(storage_path, OutboundRecord)

    def find_by_application_id(self, application_id: str) -> List[OutboundRecord]:
        return self.find_by(lambda r: r.application_id == application_id)

    def find_by_operator(self, operator_id: str) -> List[OutboundRecord]:
        return self.find_by(lambda r: r.operator_id == operator_id)

    def query(self, filter: QueryFilter) -> List[OutboundRecord]:
        def predicate(r: OutboundRecord) -> bool:
            if filter.operator_id and r.operator_id != filter.operator_id:
                return False
            if filter.operator_name and filter.operator_name not in r.operator_name:
                return False
            if filter.exception_type and r.exception_type != filter.exception_type:
                return False
            if filter.start_date and r.created_at < filter.start_date:
                return False
            if filter.end_date and r.created_at > filter.end_date:
                return False
            return True
        return self.find_by(predicate)


class ReturnRecordRepository(IdempotentRepository[ReturnRecord]):
    def __init__(self, storage_path: str = "data/returns"):
        super().__init__(storage_path, ReturnRecord)

    def find_by_application_id(self, application_id: str) -> List[ReturnRecord]:
        return self.find_by(lambda r: r.application_id == application_id)

    def find_by_outbound_id(self, outbound_id: str) -> List[ReturnRecord]:
        return self.find_by(lambda r: r.outbound_id == outbound_id)


class InventoryRecordRepository(IdempotentRepository[InventoryRecord]):
    def __init__(self, storage_path: str = "data/inventories"):
        super().__init__(storage_path, InventoryRecord)

    def find_by_date_range(self, start_date: datetime, end_date: datetime) -> List[InventoryRecord]:
        return self.find_by(lambda r: start_date <= r.inventory_date <= end_date)


class OperationLogRepository(IdempotentRepository[OperationLog]):
    def __init__(self, storage_path: str = "data/logs"):
        super().__init__(storage_path, OperationLog)

    def find_by_target(self, target_id: str, target_type: str) -> List[OperationLog]:
        return self.find_by(lambda l: l.target_id == target_id and l.target_type == target_type)

    def find_by_exception_type(self, exception_type: ExceptionType) -> List[OperationLog]:
        return self.find_by(lambda l: l.exception_type == exception_type)
