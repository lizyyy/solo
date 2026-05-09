import pytest
from inventory.models import Store, Product, Inventory, InventoryHistory
from inventory.services.inventory_service import InventoryService


class TestInventoryService:
    def test_get_or_create_inventory(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()
        product = seeded_db.query(Product).first()

        inventory = service.get_or_create_inventory(store.id, product.id, 'test_user')

        assert inventory is not None
        assert inventory.store_id == store.id
        assert inventory.product_id == product.id

    def test_adjust_quantity_positive(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()

        test_product = Product(
            sku='TEST_SKU_001',
            name='测试商品',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        initial_inventory = service.get_or_create_inventory(store.id, test_product.id, 'test_user')
        initial_qty = initial_inventory.quantity
        initial_version = initial_inventory.version

        adjusted = service.adjust_quantity(
            store.id, test_product.id,
            quantity_change=10,
            reason='测试入库',
            username='test_user'
        )

        assert adjusted.quantity == initial_qty + 10
        assert adjusted.version == initial_version + 1

    def test_adjust_quantity_negative(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()

        test_product = Product(
            sku='TEST_SKU_002',
            name='测试商品2',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        inventory = service.adjust_quantity(
            store.id, test_product.id,
            quantity_change=100,
            reason='测试入库',
            username='test_user'
        )
        qty_after_first = inventory.quantity

        adjusted = service.adjust_quantity(
            store.id, test_product.id,
            quantity_change=-20,
            reason='测试出库',
            username='test_user'
        )

        assert adjusted.quantity == qty_after_first - 20

    def test_update_price(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()
        product = seeded_db.query(Product).first()

        service.adjust_quantity(
            store.id, product.id,
            quantity_change=10,
            reason='入库',
            username='test_user'
        )

        updated = service.update_price(
            store.id, product.id,
            new_price=99.99,
            reason='测试调价',
            username='test_user'
        )

        assert updated.sale_price == 99.99

    def test_reserve_quantity_success(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()

        test_product = Product(
            sku='TEST_SKU_003',
            name='测试商品3',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        service.adjust_quantity(
            store.id, test_product.id,
            quantity_change=100,
            reason='入库',
            username='test_user'
        )

        success = service.reserve_quantity(store.id, test_product.id, 30, 'test_user')
        assert success is True

        inventory = service.get_or_create_inventory(store.id, test_product.id)
        assert inventory.available_quantity == 70
        assert inventory.reserved_quantity == 30

    def test_reserve_quantity_insufficient(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()

        test_product = Product(
            sku='TEST_SKU_004',
            name='测试商品4',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        service.adjust_quantity(
            store.id, test_product.id,
            quantity_change=10,
            reason='入库',
            username='test_user'
        )

        success = service.reserve_quantity(store.id, test_product.id, 100, 'test_user')
        assert success is False

    def test_release_reserved(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()

        test_product = Product(
            sku='TEST_SKU_005',
            name='测试商品5',
            category='测试',
            cost_price=10.0,
            base_sale_price=15.0
        )
        seeded_db.add(test_product)
        seeded_db.flush()

        service.adjust_quantity(
            store.id, test_product.id,
            quantity_change=100,
            reason='入库',
            username='test_user'
        )
        service.reserve_quantity(store.id, test_product.id, 30, 'test_user')

        success = service.release_reserved(store.id, test_product.id, 10, 'test_user')
        assert success is True

        inventory = service.get_or_create_inventory(store.id, test_product.id)
        assert inventory.available_quantity == 80
        assert inventory.reserved_quantity == 20

    def test_history_recording(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()
        product = seeded_db.query(Product).first()

        inventory = service.get_or_create_inventory(store.id, product.id, 'test_user')
        inv_id = inventory.id

        for i in range(5):
            service.adjust_quantity(
                store.id, product.id,
                quantity_change=10,
                reason=f'入库 {i+1}',
                username='test_user'
            )

        history = service.get_history(inv_id, limit=10)
        assert len(history) >= 5

    def test_low_stock_detection(self, seeded_db):
        service = InventoryService(seeded_db)
        store = seeded_db.query(Store).first()
        product = seeded_db.query(Product).first()

        inventory = service.get_or_create_inventory(store.id, product.id, 'test_user')
        inventory.min_stock = 50
        inventory.quantity = 100
        inventory.available_quantity = 100
        seeded_db.flush()

        service.adjust_quantity(
            store.id, product.id,
            quantity_change=-80,
            reason='出库',
            username='test_user'
        )

        low_stock = service.get_low_stock(store.id)
        assert len(low_stock) >= 1
