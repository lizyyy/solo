from datetime import datetime
from typing import List, Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.store import Store, Product
from app.models.inventory import (
    Inventory, InventoryAdjustment, InventoryHistory,
    PriceChange, PriceChangeHistory,
    InventoryTransfer, InventoryTransferItem, InventoryTransferHistory
)
from app.services.audit_service import AuditService
from app.services.retry_service import RetryContext
from app.config import get_settings

settings = get_settings()


PRICE_CHANGE_STATUS_FLOW = {
    "pending": ["approving", "cancelled"],
    "approving": ["approved", "rejected"],
    "approved": ["processing", "cancelled"],
    "processing": ["completed", "failed"],
    "completed": [],
    "failed": ["processing", "cancelled"],
    "cancelled": []
}

TRANSFER_STATUS_FLOW = {
    "pending": ["approving", "cancelled"],
    "approving": ["approved", "rejected"],
    "approved": ["processing", "cancelled"],
    "processing": ["in_transit", "failed"],
    "in_transit": ["completed", "failed"],
    "completed": [],
    "failed": ["processing", "cancelled"],
    "cancelled": []
}


def generate_code(prefix: str) -> str:
    return f"{prefix}{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"


class InventoryService:
    @staticmethod
    def get_or_create_inventory(db: Session, store_id: int, product_id: int, user_id: int = None) -> Inventory:
        inventory = db.query(Inventory).filter(
            Inventory.store_id == store_id,
            Inventory.product_id == product_id,
            Inventory.is_deleted == False
        ).first()

        if not inventory:
            product = db.query(Product).filter(Product.id == product_id, Product.is_deleted == False).first()
            if not product:
                raise HTTPException(status_code=404, detail="商品不存在")

            inventory = Inventory(
                store_id=store_id,
                product_id=product_id,
                quantity=0,
                reserved_quantity=0,
                available_quantity=0,
                cost_price=product.default_cost,
                sale_price=product.default_sale_price,
                created_by=user_id
            )
            db.add(inventory)
            db.commit()
            db.refresh(inventory)

        return inventory

    @staticmethod
    def adjust_quantity(
        db: Session,
        store_id: int,
        product_id: int,
        new_quantity: int,
        adjustment_type: str,
        reason: str,
        user_id: int,
        reference: str = None
    ) -> Inventory:
        if new_quantity < 0:
            raise HTTPException(status_code=400, detail="库存数量不能为负数")

        inventory = InventoryService.get_or_create_inventory(db, store_id, product_id, user_id)
        old_quantity = inventory.quantity

        if adjustment_type == "increase":
            new_total = old_quantity + new_quantity
        elif adjustment_type == "decrease":
            new_total = old_quantity - new_quantity
            if new_total < 0:
                raise HTTPException(status_code=400, detail="库存不足")
        elif adjustment_type == "set":
            new_total = new_quantity
        else:
            raise HTTPException(status_code=400, detail="无效的调整类型")

        adjustment = InventoryAdjustment(
            code=generate_code("ADJ"),
            store_id=store_id,
            product_id=product_id,
            old_quantity=old_quantity,
            new_quantity=new_total,
            adjustment_type=adjustment_type,
            reason=reason,
            reference=reference,
            status="completed",
            created_by=user_id
        )
        db.add(adjustment)

        inventory.quantity = new_total
        inventory.available_quantity = new_total - inventory.reserved_quantity
        inventory.last_adjusted_at = datetime.utcnow()
        inventory.last_adjusted_by = user_id
        inventory.updated_by = user_id

        history = InventoryHistory(
            inventory_id=inventory.id,
            store_id=store_id,
            product_id=product_id,
            old_quantity=old_quantity,
            new_quantity=new_total,
            old_cost_price=inventory.cost_price,
            new_cost_price=inventory.cost_price,
            old_sale_price=inventory.sale_price,
            new_sale_price=inventory.sale_price,
            change_type=f"adjustment_{adjustment_type}",
            reference_type="adjustment",
            reference_id=adjustment.id,
            note=reason,
            created_by=user_id
        )
        db.add(history)

        db.commit()
        db.refresh(inventory)
        return inventory

    @staticmethod
    def update_prices(
        db: Session,
        inventory_id: int,
        cost_price: Optional[Decimal] = None,
        sale_price: Optional[Decimal] = None,
        user_id: int = None
    ) -> Inventory:
        inventory = db.query(Inventory).filter(
            Inventory.id == inventory_id,
            Inventory.is_deleted == False
        ).first()
        if not inventory:
            raise HTTPException(status_code=404, detail="库存记录不存在")

        old_cost = inventory.cost_price
        old_sale = inventory.sale_price

        if cost_price is not None:
            inventory.cost_price = cost_price
        if sale_price is not None:
            inventory.sale_price = sale_price
        inventory.updated_by = user_id

        if cost_price != old_cost or sale_price != old_sale:
            history = InventoryHistory(
                inventory_id=inventory.id,
                store_id=inventory.store_id,
                product_id=inventory.product_id,
                old_quantity=inventory.quantity,
                new_quantity=inventory.quantity,
                old_cost_price=old_cost,
                new_cost_price=inventory.cost_price,
                old_sale_price=old_sale,
                new_sale_price=inventory.sale_price,
                change_type="price_update",
                note="手动更新价格",
                created_by=user_id
            )
            db.add(history)

        db.commit()
        db.refresh(inventory)
        return inventory

    @staticmethod
    def get_inventory_history(
        db: Session,
        inventory_id: int,
        limit: int = 50
    ) -> List[InventoryHistory]:
        return db.query(InventoryHistory).filter(
            InventoryHistory.inventory_id == inventory_id
        ).order_by(InventoryHistory.created_at.desc()).limit(limit).all()


class PriceChangeService:
    @staticmethod
    def create_price_change(
        db: Session,
        store_id: int,
        product_id: int,
        new_cost_price: Decimal,
        new_sale_price: Decimal,
        reason: str,
        user_id: int,
        effective_date: Optional[datetime] = None
    ) -> PriceChange:
        inventory = InventoryService.get_or_create_inventory(db, store_id, product_id, user_id)

        price_change = PriceChange(
            code=generate_code("PC"),
            store_id=store_id,
            product_id=product_id,
            old_cost_price=inventory.cost_price,
            new_cost_price=new_cost_price if new_cost_price is not None else inventory.cost_price,
            old_sale_price=inventory.sale_price,
            new_sale_price=new_sale_price if new_sale_price is not None else inventory.sale_price,
            reason=reason,
            status="pending",
            retry_count=0,
            max_retries=settings.MAX_RETRY_COUNT,
            effective_date=effective_date,
            created_by=user_id
        )
        db.add(price_change)

        history = PriceChangeHistory(
            price_change_id=price_change.id,
            from_status=None,
            to_status="pending",
            action="create",
            note=reason,
            created_by=user_id
        )
        db.add(history)

        db.commit()
        db.refresh(price_change)
        return price_change

    @staticmethod
    def update_status(
        db: Session,
        price_change_id: int,
        new_status: str,
        user_id: int,
        note: str = None
    ) -> PriceChange:
        price_change = db.query(PriceChange).filter(
            PriceChange.id == price_change_id,
            PriceChange.is_deleted == False
        ).first()
        if not price_change:
            raise HTTPException(status_code=404, detail="改价单不存在")

        if new_status not in PRICE_CHANGE_STATUS_FLOW.get(price_change.status, []):
            raise HTTPException(
                status_code=400,
                detail=f"无法从 {price_change.status} 状态转换到 {new_status}"
            )

        old_status = price_change.status
        price_change.status = new_status
        price_change.updated_by = user_id

        if new_status == "completed":
            price_change.executed_at = datetime.utcnow()

        history = PriceChangeHistory(
            price_change_id=price_change.id,
            from_status=old_status,
            to_status=new_status,
            action=f"status_change_{new_status}",
            note=note,
            created_by=user_id
        )
        db.add(history)

        db.commit()
        db.refresh(price_change)
        return price_change

    @staticmethod
    def execute_price_change(db: Session, price_change_id: int, user_id: int) -> PriceChange:
        price_change = db.query(PriceChange).filter(
            PriceChange.id == price_change_id,
            PriceChange.is_deleted == False
        ).first()
        if not price_change:
            raise HTTPException(status_code=404, detail="改价单不存在")

        if price_change.status not in ["approved", "failed"]:
            raise HTTPException(status_code=400, detail="改价单未审核通过")

        PriceChangeService.update_status(db, price_change_id, "processing", user_id, "开始执行改价")

        try:
            inventory = InventoryService.get_or_create_inventory(
                db, price_change.store_id, price_change.product_id, user_id
            )

            old_cost = inventory.cost_price
            old_sale = inventory.sale_price

            inventory.cost_price = price_change.new_cost_price
            inventory.sale_price = price_change.new_sale_price
            inventory.updated_by = user_id

            history = InventoryHistory(
                inventory_id=inventory.id,
                store_id=price_change.store_id,
                product_id=price_change.product_id,
                old_quantity=inventory.quantity,
                new_quantity=inventory.quantity,
                old_cost_price=old_cost,
                new_cost_price=price_change.new_cost_price,
                old_sale_price=old_sale,
                new_sale_price=price_change.new_sale_price,
                change_type="price_change",
                reference_type="price_change",
                reference_id=price_change.id,
                note=price_change.reason,
                created_by=user_id
            )
            db.add(history)

            PriceChangeService.update_status(db, price_change_id, "completed", user_id, "改价执行成功")

            AuditService.log_action(
                db=db,
                user_id=user_id,
                username=None,
                action="execute_price_change",
                module="price_change",
                resource_type="price_change",
                resource_id=price_change.id,
                status="success"
            )

        except Exception as e:
            db.rollback()
            price_change.retry_count += 1
            price_change.error_message = str(e)
            price_change.status = "failed"
            price_change.updated_by = user_id

            history = PriceChangeHistory(
                price_change_id=price_change.id,
                from_status="processing",
                to_status="failed",
                action="execution_failed",
                note=str(e),
                created_by=user_id
            )
            db.add(history)
            db.commit()

            raise HTTPException(status_code=500, detail=f"改价执行失败: {str(e)}")

        return price_change

    @staticmethod
    def retry_price_change(db: Session, price_change_id: int, user_id: int) -> PriceChange:
        price_change = db.query(PriceChange).filter(
            PriceChange.id == price_change_id,
            PriceChange.is_deleted == False
        ).first()
        if not price_change:
            raise HTTPException(status_code=404, detail="改价单不存在")

        if price_change.status != "failed":
            raise HTTPException(status_code=400, detail="只有失败的改价单可以重试")

        if price_change.retry_count >= price_change.max_retries:
            raise HTTPException(status_code=400, detail="已达到最大重试次数")

        return PriceChangeService.execute_price_change(db, price_change_id, user_id)


class InventoryTransferService:
    @staticmethod
    def create_transfer(
        db: Session,
        source_store_id: int,
        target_store_id: int,
        items: List[dict],
        reason: str,
        user_id: int,
        expected_arrival_date: Optional[datetime] = None
    ) -> InventoryTransfer:
        if source_store_id == target_store_id:
            raise HTTPException(status_code=400, detail="源门店和目标门店不能相同")

        total_qty = sum(item.get("quantity", 0) for item in items)

        transfer = InventoryTransfer(
            code=generate_code("TRF"),
            source_store_id=source_store_id,
            target_store_id=target_store_id,
            total_quantity=total_qty,
            reason=reason,
            status="pending",
            retry_count=0,
            max_retries=settings.MAX_RETRY_COUNT,
            expected_arrival_date=expected_arrival_date,
            created_by=user_id
        )
        db.add(transfer)
        db.flush()

        for item in items:
            transfer_item = InventoryTransferItem(
                transfer_id=transfer.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                created_by=user_id
            )
            db.add(transfer_item)

        history = InventoryTransferHistory(
            transfer_id=transfer.id,
            from_status=None,
            to_status="pending",
            action="create",
            note=reason,
            created_by=user_id
        )
        db.add(history)

        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def update_status(
        db: Session,
        transfer_id: int,
        new_status: str,
        user_id: int,
        note: str = None
    ) -> InventoryTransfer:
        transfer = db.query(InventoryTransfer).filter(
            InventoryTransfer.id == transfer_id,
            InventoryTransfer.is_deleted == False
        ).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="调拨单不存在")

        if new_status not in TRANSFER_STATUS_FLOW.get(transfer.status, []):
            raise HTTPException(
                status_code=400,
                detail=f"无法从 {transfer.status} 状态转换到 {new_status}"
            )

        old_status = transfer.status
        transfer.status = new_status
        transfer.updated_by = user_id

        if new_status == "completed":
            transfer.executed_at = datetime.utcnow()

        history = InventoryTransferHistory(
            transfer_id=transfer.id,
            from_status=old_status,
            to_status=new_status,
            action=f"status_change_{new_status}",
            note=note,
            created_by=user_id
        )
        db.add(history)

        db.commit()
        db.refresh(transfer)
        return transfer

    @staticmethod
    def execute_transfer(db: Session, transfer_id: int, user_id: int) -> InventoryTransfer:
        transfer = db.query(InventoryTransfer).filter(
            InventoryTransfer.id == transfer_id,
            InventoryTransfer.is_deleted == False
        ).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="调拨单不存在")

        if transfer.status not in ["approved", "failed"]:
            raise HTTPException(status_code=400, detail="调拨单未审核通过")

        transfer_items = db.query(InventoryTransferItem).filter(
            InventoryTransferItem.transfer_id == transfer_id
        ).all()

        for item in transfer_items:
            source_inv = db.query(Inventory).filter(
                Inventory.store_id == transfer.source_store_id,
                Inventory.product_id == item.product_id,
                Inventory.is_deleted == False
            ).first()

            if not source_inv or source_inv.available_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"商品ID {item.product_id} 源门店库存不足"
                )

        InventoryTransferService.update_status(db, transfer_id, "processing", user_id, "开始执行调拨")

        try:
            for item in transfer_items:
                source_inv = InventoryService.get_or_create_inventory(
                    db, transfer.source_store_id, item.product_id, user_id
                )
                target_inv = InventoryService.get_or_create_inventory(
                    db, transfer.target_store_id, item.product_id, user_id
                )

                item.source_quantity_before = source_inv.quantity
                item.target_quantity_before = target_inv.quantity

                source_old_qty = source_inv.quantity
                target_old_qty = target_inv.quantity

                source_inv.quantity -= item.quantity
                source_inv.available_quantity -= item.quantity
                source_inv.updated_by = user_id

                target_inv.quantity += item.quantity
                target_inv.available_quantity += item.quantity
                target_inv.updated_by = user_id

                item.source_quantity_after = source_inv.quantity
                item.target_quantity_after = target_inv.quantity

                source_history = InventoryHistory(
                    inventory_id=source_inv.id,
                    store_id=transfer.source_store_id,
                    product_id=item.product_id,
                    old_quantity=source_old_qty,
                    new_quantity=source_inv.quantity,
                    old_cost_price=source_inv.cost_price,
                    new_cost_price=source_inv.cost_price,
                    old_sale_price=source_inv.sale_price,
                    new_sale_price=source_inv.sale_price,
                    change_type="transfer_out",
                    reference_type="transfer",
                    reference_id=transfer.id,
                    note=f"调拨出库到门店 {transfer.target_store_id}",
                    created_by=user_id
                )
                db.add(source_history)

                target_history = InventoryHistory(
                    inventory_id=target_inv.id,
                    store_id=transfer.target_store_id,
                    product_id=item.product_id,
                    old_quantity=target_old_qty,
                    new_quantity=target_inv.quantity,
                    old_cost_price=target_inv.cost_price,
                    new_cost_price=target_inv.cost_price,
                    old_sale_price=target_inv.sale_price,
                    new_sale_price=target_inv.sale_price,
                    change_type="transfer_in",
                    reference_type="transfer",
                    reference_id=transfer.id,
                    note=f"从门店 {transfer.source_store_id} 调拨入库",
                    created_by=user_id
                )
                db.add(target_history)

            InventoryTransferService.update_status(db, transfer_id, "completed", user_id, "调拨执行成功")

            AuditService.log_action(
                db=db,
                user_id=user_id,
                username=None,
                action="execute_transfer",
                module="transfer",
                resource_type="transfer",
                resource_id=transfer.id,
                status="success"
            )

        except Exception as e:
            db.rollback()
            transfer.retry_count += 1
            transfer.error_message = str(e)
            transfer.status = "failed"
            transfer.updated_by = user_id

            history = InventoryTransferHistory(
                transfer_id=transfer.id,
                from_status="processing",
                to_status="failed",
                action="execution_failed",
                note=str(e),
                created_by=user_id
            )
            db.add(history)
            db.commit()

            raise HTTPException(status_code=500, detail=f"调拨执行失败: {str(e)}")

        return transfer

    @staticmethod
    def create_compensating_transfer(
        db: Session,
        transfer_id: int,
        user_id: int,
        reason: str = "补偿调拨"
    ) -> InventoryTransfer:
        original_transfer = db.query(InventoryTransfer).filter(
            InventoryTransfer.id == transfer_id,
            InventoryTransfer.is_deleted == False
        ).first()
        if not original_transfer:
            raise HTTPException(status_code=404, detail="原调拨单不存在")

        if original_transfer.status != "completed":
            raise HTTPException(status_code=400, detail="只有已完成的调拨单可以创建补偿调拨")

        if original_transfer.compensating_transfer_id:
            raise HTTPException(status_code=400, detail="该调拨单已存在补偿调拨")

        original_items = db.query(InventoryTransferItem).filter(
            InventoryTransferItem.transfer_id == transfer_id
        ).all()

        compensating = InventoryTransfer(
            code=generate_code("CTF"),
            source_store_id=original_transfer.target_store_id,
            target_store_id=original_transfer.source_store_id,
            total_quantity=original_transfer.total_quantity,
            reason=reason,
            status="pending",
            retry_count=0,
            max_retries=settings.MAX_RETRY_COUNT,
            is_compensating=True,
            created_by=user_id
        )
        db.add(compensating)
        db.flush()

        for item in original_items:
            comp_item = InventoryTransferItem(
                transfer_id=compensating.id,
                product_id=item.product_id,
                quantity=item.quantity,
                created_by=user_id
            )
            db.add(comp_item)

        original_transfer.compensating_transfer_id = compensating.id
        db.add(original_transfer)

        history = InventoryTransferHistory(
            transfer_id=compensating.id,
            from_status=None,
            to_status="pending",
            action="create_compensating",
            note=f"补偿调拨，原单号: {original_transfer.code}",
            created_by=user_id
        )
        db.add(history)

        db.commit()
        db.refresh(compensating)
        return compensating

    @staticmethod
    def retry_transfer(db: Session, transfer_id: int, user_id: int) -> InventoryTransfer:
        transfer = db.query(InventoryTransfer).filter(
            InventoryTransfer.id == transfer_id,
            InventoryTransfer.is_deleted == False
        ).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="调拨单不存在")

        if transfer.status != "failed":
            raise HTTPException(status_code=400, detail="只有失败的调拨单可以重试")

        if transfer.retry_count >= transfer.max_retries:
            raise HTTPException(status_code=400, detail="已达到最大重试次数")

        return InventoryTransferService.execute_transfer(db, transfer_id, user_id)
