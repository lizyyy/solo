from typing import List, Optional, Tuple

from repository import UnitOfWork
from models import (
    Application,
    OutboundRecord,
    OutboundItem,
    ReturnRecord,
    ReturnItem,
    InventoryRecord,
    InventoryItem,
    ApplicationStatus,
    OperationType,
    ExceptionType,
    OperationLog,
)
from rules import (
    OutboundContext,
    ReturnContext,
    InventoryContext,
    RuleEngine,
    create_outbound_rules,
    create_return_rules,
    create_inventory_rules,
    RuleResult,
)


class OutboundService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        self.rule_engine = RuleEngine[OutboundContext]()
        self.rule_engine.register_all(create_outbound_rules())

    def create_outbound(
        self,
        operator_id: str,
        operator_name: str,
        receiver_id: str,
        receiver_name: str,
        items_data: List[dict],
        application_id: Optional[str] = None,
        department: Optional[str] = None,
        purpose: Optional[str] = None,
    ) -> Tuple[OutboundRecord, List[RuleResult], bool]:
        outbound = OutboundRecord(
            application_id=application_id,
            operator_id=operator_id,
            operator_name=operator_name,
            receiver_id=receiver_id,
            receiver_name=receiver_name,
            department=department,
            purpose=purpose,
        )

        for item_data in items_data:
            item = OutboundItem(
                outbound_id=outbound.id,
                reagent_id=item_data["reagent_id"],
                reagent_name=item_data["reagent_name"],
                specification=item_data.get("specification", ""),
                batch_no=item_data["batch_no"],
                quantity=item_data["quantity"],
                unit=item_data.get("unit", ""),
                location=item_data.get("location"),
            )
            outbound.items.append(item)

        inventories = []
        for item in outbound.items:
            inv = self.uow.inventory.find_by_batch_no(item.batch_no)
            if inv:
                inventories.append(inv)

        application = None
        if application_id:
            application = self.uow.applications.get_by_id(application_id)

        context = OutboundContext(
            outbound=outbound,
            items=inventories,
            application=application,
        )

        results, all_passed = self.rule_engine.execute(context)

        if not all_passed:
            for r in results:
                if not r.passed:
                    outbound.exception_type = r.exception_type
                    outbound.exception_message = r.message
                    break
            self.uow.outbounds.create(outbound)
            return outbound, results, False

        for item in outbound.items:
            inv = self.uow.inventory.find_by_batch_no(item.batch_no)
            if inv:
                inv.subtract_quantity(item.quantity)
                self.uow.inventory.update(inv)

        if application:
            application.status = ApplicationStatus.COMPLETED
            self.uow.applications.update(application)

        self.uow.outbounds.create(outbound)
        self._log_operation(outbound.id, "Outbound", OperationType.OUTBOUND, operator_id, operator_name)

        return outbound, results, True

    def get_outbound(self, outbound_id: str) -> Optional[OutboundRecord]:
        return self.uow.outbounds.get_by_id(outbound_id)

    def get_outbounds_by_application(self, application_id: str) -> List[OutboundRecord]:
        return self.uow.outbounds.find_by_application_id(application_id)

    def _log_operation(
        self,
        target_id: str,
        target_type: str,
        operation_type: OperationType,
        operator_id: str,
        operator_name: str,
    ):
        log = OperationLog(
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            target_id=target_id,
            target_type=target_type,
        )
        self.uow.logs.create(log)


class ReturnService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        self.rule_engine = RuleEngine[ReturnContext]()
        self.rule_engine.register_all(create_return_rules())

    def create_return(
        self,
        operator_id: str,
        operator_name: str,
        returner_id: str,
        returner_name: str,
        items_data: List[dict],
        application_id: Optional[str] = None,
        outbound_id: Optional[str] = None,
    ) -> Tuple[ReturnRecord, List[RuleResult], bool]:
        return_record = ReturnRecord(
            application_id=application_id,
            outbound_id=outbound_id,
            operator_id=operator_id,
            operator_name=operator_name,
            returner_id=returner_id,
            returner_name=returner_name,
        )

        for item_data in items_data:
            item = ReturnItem(
                return_id=return_record.id,
                reagent_id=item_data["reagent_id"],
                reagent_name=item_data["reagent_name"],
                specification=item_data.get("specification", ""),
                batch_no=item_data["batch_no"],
                quantity=item_data["quantity"],
                unit=item_data.get("unit", ""),
                remaining_quantity=item_data.get("remaining_quantity", item_data["quantity"]),
                condition=item_data.get("condition", "正常"),
                location=item_data.get("location"),
            )
            return_record.items.append(item)

        outbound = None
        if outbound_id:
            outbound = self.uow.outbounds.get_by_id(outbound_id)

        inventories = []
        for item in return_record.items:
            inv = self.uow.inventory.find_by_batch_no(item.batch_no)
            if inv:
                inventories.append(inv)

        context = ReturnContext(
            return_record=return_record,
            outbound=outbound,
            inventories=inventories,
        )

        results, all_passed = self.rule_engine.execute(context)

        if not all_passed:
            for r in results:
                if not r.passed:
                    return_record.exception_type = r.exception_type
                    return_record.exception_message = r.message
                    break
            self.uow.returns.create(return_record)
            return return_record, results, False

        for item in return_record.items:
            inv = self.uow.inventory.find_by_batch_no(item.batch_no)
            if inv:
                inv.add_quantity(item.quantity)
                self.uow.inventory.update(inv)
            else:
                reagent = self.uow.reagents.get_by_id(item.reagent_id)
                new_inv = InventoryRecord(
                    reagent_id=item.reagent_id,
                    batch_no=item.batch_no,
                    quantity=item.quantity,
                    available_quantity=item.quantity,
                    unit=item.unit,
                    location=item.location,
                )
                self.uow.inventory.create(new_inv)

        self.uow.returns.create(return_record)
        self._log_operation(return_record.id, "Return", OperationType.RETURN, operator_id, operator_name)

        return return_record, results, True

    def get_return(self, return_id: str) -> Optional[ReturnRecord]:
        return self.uow.returns.get_by_id(return_id)

    def _log_operation(
        self,
        target_id: str,
        target_type: str,
        operation_type: OperationType,
        operator_id: str,
        operator_name: str,
    ):
        log = OperationLog(
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            target_id=target_id,
            target_type=target_type,
        )
        self.uow.logs.create(log)


class InventoryService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        self.rule_engine = RuleEngine[InventoryContext]()
        self.rule_engine.register_all(create_inventory_rules())

    def create_inventory(
        self,
        operator_id: str,
        operator_name: str,
        items_data: List[dict],
        remark: Optional[str] = None,
    ) -> Tuple[InventoryRecord, List[RuleResult], bool]:
        inventory_record = InventoryRecord(
            operator_id=operator_id,
            operator_name=operator_name,
            remark=remark,
        )

        for item_data in items_data:
            diff = item_data["actual_quantity"] - item_data["system_quantity"]
            item = InventoryItem(
                inventory_id=inventory_record.id,
                reagent_id=item_data["reagent_id"],
                reagent_name=item_data["reagent_name"],
                specification=item_data.get("specification", ""),
                batch_no=item_data["batch_no"],
                system_quantity=item_data["system_quantity"],
                actual_quantity=item_data["actual_quantity"],
                unit=item_data.get("unit", ""),
                difference=diff,
                difference_reason=item_data.get("difference_reason"),
                location=item_data.get("location"),
            )
            inventory_record.items.append(item)
            inventory_record.total_difference += diff

        inventories = []
        for item in inventory_record.items:
            inv = self.uow.inventory.find_by_batch_no(item.batch_no)
            if inv:
                inventories.append(inv)

        context = InventoryContext(
            inventory_record=inventory_record,
            inventories=inventories,
        )

        results, all_passed = self.rule_engine.execute(context)

        if not all_passed:
            for r in results:
                if not r.passed:
                    inventory_record.exception_type = r.exception_type
                    inventory_record.exception_message = r.message
                    break
            self.uow.inventories.create(inventory_record)
            return inventory_record, results, False

        for item in inventory_record.items:
            inv = self.uow.inventory.find_by_batch_no(item.batch_no)
            if inv:
                inv.quantity = item.actual_quantity
                inv.available_quantity = item.actual_quantity
                self.uow.inventory.update(inv)

        self.uow.inventories.create(inventory_record)
        self._log_operation(inventory_record.id, "Inventory", OperationType.INVENTORY, operator_id, operator_name)

        return inventory_record, results, True

    def get_inventory(self, inventory_id: str) -> Optional[InventoryRecord]:
        return self.uow.inventories.get_by_id(inventory_id)

    def _log_operation(
        self,
        target_id: str,
        target_type: str,
        operation_type: OperationType,
        operator_id: str,
        operator_name: str,
    ):
        log = OperationLog(
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            target_id=target_id,
            target_type=target_type,
        )
        self.uow.logs.create(log)
