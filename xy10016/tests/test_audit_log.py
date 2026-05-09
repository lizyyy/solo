import pytest
from inventory.models import Store, Product
from inventory.services.audit_service import AuditService
from inventory.services.inventory_service import InventoryService


class TestAuditService:
    def test_log_create_action(self, seeded_db):
        audit = AuditService(seeded_db)

        log = audit.log_create(
            resource_type='PRODUCT',
            new_value={'sku': 'TEST001', 'name': 'Test Product'},
            username='test_user'
        )

        assert log is not None
        assert log.action == 'CREATE'
        assert log.resource_type == 'PRODUCT'
        assert log.status == 'success'
        assert log.username == 'test_user'

    def test_log_update_action(self, seeded_db):
        audit = AuditService(seeded_db)

        log = audit.log_update(
            resource_type='INVENTORY',
            resource_id='ST001-P001',
            old_value={'quantity': 100},
            new_value={'quantity': 150},
            username='test_user'
        )

        assert log is not None
        assert log.action == 'UPDATE'
        assert log.old_value is not None
        assert log.new_value is not None

    def test_log_delete_action(self, seeded_db):
        audit = AuditService(seeded_db)

        log = audit.log_delete(
            resource_type='PRODUCT',
            resource_id='123',
            old_value={'sku': 'TEST', 'name': 'Test'},
            username='test_user'
        )

        assert log.action == 'DELETE'

    def test_log_error(self, seeded_db):
        audit = AuditService(seeded_db)

        log = audit.log_error(
            action='TRANSFER_SHIP',
            resource_type='TRANSFER',
            error_message='Insufficient stock',
            resource_id='TF001',
            username='test_user'
        )

        assert log.status == 'error'
        assert 'Insufficient stock' in log.error_message

    def test_get_logs_by_resource_type(self, seeded_db):
        audit = AuditService(seeded_db)

        audit.log_create(resource_type='PRODUCT', new_value={}, username='test')
        audit.log_create(resource_type='STORE', new_value={}, username='test')
        audit.log_update(resource_type='PRODUCT', resource_id='1', old_value={}, new_value={}, username='test')

        product_logs = audit.get_logs(resource_type='PRODUCT')
        assert len(product_logs) >= 2

    def test_get_logs_by_action(self, seeded_db):
        audit = AuditService(seeded_db)

        audit.log_create(resource_type='PRODUCT', new_value={}, username='test')
        audit.log_update(resource_type='PRODUCT', resource_id='1', old_value={}, new_value={}, username='test')
        audit.log_delete(resource_type='PRODUCT', resource_id='2', old_value={}, username='test')

        create_logs = audit.get_logs(action='CREATE')
        assert len(create_logs) >= 1

    def test_get_logs_by_username(self, seeded_db):
        audit = AuditService(seeded_db)

        audit.log_create(resource_type='PRODUCT', new_value={}, username='user_a')
        audit.log_create(resource_type='PRODUCT', new_value={}, username='user_b')

        user_a_logs = audit.get_logs(username='user_a')
        assert len(user_a_logs) >= 1

    def test_audit_log_generated_on_inventory_change(self, seeded_db):
        inv_service = InventoryService(seeded_db)
        audit = AuditService(seeded_db)

        store = seeded_db.query(Store).filter(Store.code == 'ST001').first()
        product = seeded_db.query(Product).filter(Product.sku == 'P001').first()

        inv_service.adjust_quantity(
            store.id, product.id,
            quantity_change=10,
            reason='测试入库',
            username='test_operator'
        )

        logs = audit.get_logs(resource_type='INVENTORY')
        assert len(logs) >= 1

    def test_audit_log_has_correlation_id(self, seeded_db):
        audit = AuditService(seeded_db)

        log = audit.log_create(
            resource_type='PRODUCT',
            new_value={'sku': 'TEST'},
            username='test'
        )

        assert log.correlation_id is not None
        assert len(log.correlation_id) == 8
