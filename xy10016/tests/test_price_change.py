import pytest
from inventory.models import Store, Product, Inventory
from inventory.models import (
    PRICE_CHANGE_STATUS_DRAFT, PRICE_CHANGE_STATUS_PENDING,
    PRICE_CHANGE_STATUS_APPROVED, PRICE_CHANGE_STATUS_APPLIED
)
from inventory.services.price_service import PriceService
from inventory.services.inventory_service import InventoryService


class TestPriceService:
    def test_create_price_change(self, seeded_db):
        service = PriceService(seeded_db)

        pc = service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=100.0,
            reason='促销活动',
            created_by='test_user'
        )

        assert pc is not None
        assert pc.status == PRICE_CHANGE_STATUS_DRAFT
        assert pc.new_price == 100.0

    def test_submit_for_approval(self, seeded_db):
        service = PriceService(seeded_db)

        pc = service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=100.0,
            reason='促销活动',
            created_by='creator'
        )

        submitted = service.submit_for_approval(pc.change_no, 'submitter')

        assert submitted.status == PRICE_CHANGE_STATUS_PENDING

    def test_approve_price_change(self, seeded_db):
        service = PriceService(seeded_db)

        pc = service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=100.0,
            reason='促销活动',
            created_by='creator'
        )
        service.submit_for_approval(pc.change_no, 'submitter')

        approved = service.approve_price_change(pc.change_no, 'approver')

        assert approved.status == PRICE_CHANGE_STATUS_APPROVED
        assert approved.approved_by == 'approver'

    def test_apply_price_change(self, seeded_db):
        service = PriceService(seeded_db)
        inv_service = InventoryService(seeded_db)

        store = seeded_db.query(Store).filter(Store.code == 'ST001').first()
        product = seeded_db.query(Product).filter(Product.sku == 'P001').first()
        inv_service.adjust_quantity(store.id, product.id, 100, '入库', 'test')

        pc = service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=99.99,
            reason='促销活动',
            created_by='creator'
        )
        service.submit_for_approval(pc.change_no, 'submitter')
        service.approve_price_change(pc.change_no, 'approver')

        applied = service.apply_price_change(pc.change_no, 'applier')

        assert applied.status == PRICE_CHANGE_STATUS_APPLIED

        inventory = inv_service.get_or_create_inventory(store.id, product.id)
        assert inventory.sale_price == 99.99

    def test_apply_not_approved(self, seeded_db):
        service = PriceService(seeded_db)

        pc = service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=100.0,
            reason='促销活动',
            created_by='creator'
        )

        with pytest.raises(ValueError):
            service.apply_price_change(pc.change_no, 'applier')

    def test_cancel_price_change(self, seeded_db):
        service = PriceService(seeded_db)

        pc = service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=100.0,
            reason='促销活动',
            created_by='creator'
        )

        cancelled = service.cancel_price_change(pc.change_no, 'canceller', '不需要了')

        assert cancelled.status == 'cancelled'

    def test_get_price_changes_by_status(self, seeded_db):
        service = PriceService(seeded_db)

        service.create_price_change(
            store_code='ST001',
            sku='P001',
            new_price=100.0,
            reason='测试',
            created_by='test_user'
        )

        drafts = service.get_price_changes(status=PRICE_CHANGE_STATUS_DRAFT)
        assert len(drafts) >= 1
