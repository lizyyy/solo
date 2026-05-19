from dataclasses import dataclass
from typing import Optional, List

from models import (
    Application,
    ApplicationItem,
    Reagent,
    ReagentInventory,
    ApprovalRecord,
    OutboundRecord,
    ReturnRecord,
    InventoryRecord,
)


@dataclass
class ApplicationContext:
    application: Application
    items: List[ApplicationItem]
    reagents: List[Reagent]
    inventories: List[ReagentInventory]


@dataclass
class ApprovalContext:
    application: Application
    approval_record: ApprovalRecord
    existing_approvals: List[ApprovalRecord]
    requires_double_approval: bool = False


@dataclass
class OutboundContext:
    outbound: OutboundRecord
    items: List[ReagentInventory]
    application: Optional[Application] = None


@dataclass
class ReturnContext:
    return_record: ReturnRecord
    outbound: Optional[OutboundRecord] = None
    inventories: List[ReagentInventory] = None


@dataclass
class InventoryContext:
    inventory_record: InventoryRecord
    inventories: List[ReagentInventory]
