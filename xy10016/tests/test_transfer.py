import pytest
from inventory.models import Store, Product, Inventory, Transfer, TransferItem
from inventory.models import (
    TRANSFER_STATUS_PENDING, TRANSFER_STATUS_APPROVED,
    TRANSFER_STATUS_IN_TRANSIT, TRANSFER_STATUS_COMPLETED
)
from inventory.services.transfer_service import TransferService
from inventory.services.inventory_service import InventoryService


class TestTransferService:
    def test_create_transfer_success(self, seeded_db):
        service = TransferService(seeded_db)

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[
                {'sku': 'P001', 'quantity': 10},
                {'sku': 'P002', 'quantity': 5},
            ],
            created_by='test_user'
        )

        assert transfer is not None
        assert transfer.status == TRANSFER_STATUS_PENDING
        assert len(transfer.items) == 2
        assert transfer.total_quantity == 15

    def test_create_transfer_insufficient_stock(self, seeded_db):
        service = TransferService(seeded_db)
        inv_service = InventoryService(seeded_db)

        store = seeded_db.query(Store).filter(Store.code == 'ST001').first()
        product = seeded_db.query(Product).filter(Product.sku == 'P001').first()

        inventory = inv_service.get_or_create_inventory(store.id, product.id)
        inventory.quantity = 5
        inventory.available_quantity = 5
        seeded_db.flush()

        with pytest.raises(ValueError) as excinfo:
            service.create_transfer(
                from_store_code='ST001',
                to_store_code='ST002',
                items=[{'sku': 'P001', 'quantity': 100}],
                created_by='test_user'
            )

        assert 'Insufficient stock' in str(excinfo.value)

    def test_approve_transfer(self, seeded_db):
        service = TransferService(seeded_db)

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'P001', 'quantity': 5}],
            created_by='creator'
        )

        approved = service.approve_transfer(transfer.transfer_no, 'approver')

        assert approved.status == TRANSFER_STATUS_APPROVED
        assert approved.approved_by == 'approver'

    def test_approve_transfer_wrong_status(self, seeded_db):
        service = TransferService(seeded_db)

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'P001', 'quantity': 5}],
            created_by='creator'
        )

        service.approve_transfer(transfer.transfer_no, 'approver')

        with pytest.raises(ValueError):
            service.approve_transfer(transfer.transfer_no, 'approver')

    def test_ship_transfer(self, seeded_db):
        service = TransferService(seeded_db)
        inv_service = InventoryService(seeded_db)

        test_product = Product(
            sku='TF_TEST_SKU_001',
            name='调拨测试商品',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        store = seeded_db.query(Store).filter(Store.code == 'ST001').first()
        inv_service.adjust_quantity(
            store.id, test_product.id, 100, '初始化库存', 'test'
        )
        seeded_db.flush()

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'TF_TEST_SKU_001', 'quantity': 5}],
            created_by='creator'
        )
        service.approve_transfer(transfer.transfer_no, 'approver')

        shipped = service.ship_transfer(transfer.transfer_no, 'shipper')

        assert shipped.status == TRANSFER_STATUS_IN_TRANSIT

        from_store = shipped.from_store
        inv = inv_service.get_or_create_inventory(from_store.id, test_product.id)
        assert inv.quantity == 95

    def test_receive_transfer(self, seeded_db):
        service = TransferService(seeded_db)
        inv_service = InventoryService(seeded_db)

        test_product = Product(
            sku='TF_TEST_SKU_002',
            name='调拨测试商品2',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        from_store = seeded_db.query(Store).filter(Store.code == 'ST001').first()
        inv_service.adjust_quantity(
            from_store.id, test_product.id, 100, '初始化库存', 'test'
        )

        to_store = seeded_db.query(Store).filter(Store.code == 'ST002').first()
        initial_to_qty = inv_service.get_or_create_inventory(to_store.id, test_product.id).quantity

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'TF_TEST_SKU_002', 'quantity': 5}],
            created_by='creator'
        )
        service.approve_transfer(transfer.transfer_no, 'approver')
        service.ship_transfer(transfer.transfer_no, 'shipper')

        received = service.receive_transfer(transfer.transfer_no, 'receiver')

        assert received.status == TRANSFER_STATUS_COMPLETED

        inv = inv_service.get_or_create_inventory(to_store.id, test_product.id)
        assert inv.quantity == initial_to_qty + 5

    def test_cancel_transfer(self, seeded_db):
        service = TransferService(seeded_db)

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'P001', 'quantity': 5}],
            created_by='creator'
        )

        cancelled = service.cancel_transfer(transfer.transfer_no, 'canceller', '不需要了')

        assert cancelled.status == 'cancelled'

    def test_cannot_cancel_completed_transfer(self, seeded_db):
        service = TransferService(seeded_db)

        transfer = service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'P001', 'quantity': 5}],
            created_by='creator'
        )
        service.approve_transfer(transfer.transfer_no, 'approver')
        service.ship_transfer(transfer.transfer_no, 'shipper')
        service.receive_transfer(transfer.transfer_no, 'receiver')

        with pytest.raises(ValueError):
            service.cancel_transfer(transfer.transfer_no, 'canceller')

    def test_get_transfers_by_status(self, seeded_db):
        service = TransferService(seeded_db)

        service.create_transfer(
            from_store_code='ST001',
            to_store_code='ST002',
            items=[{'sku': 'P001', 'quantity': 5}],
            created_by='test_user'
        )

        pending = service.get_transfers(status=TRANSFER_STATUS_PENDING)
        assert len(pending) >= 1
