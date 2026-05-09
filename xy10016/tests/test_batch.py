import pytest
from inventory.services.batch_service import BatchService
from inventory.services.transfer_service import TransferService
from inventory.services.price_service import PriceService


class TestBatchService:
    def test_batch_create_transfers(self, seeded_db):
        service = BatchService(seeded_db)

        transfers_data = [
            {
                'from_store': 'ST001',
                'to_store': 'ST002',
                'items': [
                    {'sku': 'P001', 'quantity': 5},
                    {'sku': 'P002', 'quantity': 3},
                ]
            },
            {
                'from_store': 'ST001',
                'to_store': 'ST003',
                'items': [
                    {'sku': 'P001', 'quantity': 10},
                ]
            }
        ]

        result = service.batch_create_transfers(transfers_data, 'test_user')

        assert result['total'] == 2
        assert result['success'] == 2
        assert result['failed'] == 0

        tf_service = TransferService(seeded_db)
        all_tfs = tf_service.get_transfers()
        assert len(all_tfs) >= 2

    def test_batch_create_transfers_with_errors(self, seeded_db):
        service = BatchService(seeded_db)

        transfers_data = [
            {
                'from_store': 'ST001',
                'to_store': 'ST002',
                'items': [{'sku': 'P001', 'quantity': 5}]
            },
            {
                'from_store': 'INVALID_STORE',
                'to_store': 'ST003',
                'items': [{'sku': 'P001', 'quantity': 10}]
            }
        ]

        result = service.batch_create_transfers(transfers_data, 'test_user')

        assert result['total'] == 2
        assert result['success'] == 1
        assert result['failed'] == 1

    def test_batch_create_price_changes(self, seeded_db):
        service = BatchService(seeded_db)

        prices_data = [
            {
                'store': 'ST001',
                'sku': 'P001',
                'new_price': 10.5,
                'reason': '促销'
            },
            {
                'store': 'ST001',
                'sku': 'P002',
                'new_price': 15.0,
                'reason': '调价'
            },
            {
                'store': 'ST002',
                'sku': 'P001',
                'new_price': 9.5,
                'reason': '区域价格'
            }
        ]

        result = service.batch_create_price_changes(prices_data, 'test_user')

        assert result['total'] == 3
        assert result['success'] == 3
        assert result['failed'] == 0

    def test_batch_adjust_inventory(self, seeded_db):
        service = BatchService(seeded_db)

        adjustments = [
            {
                'store': 'ST001',
                'sku': 'P001',
                'quantity_change': 50,
                'reason': '到货入库'
            },
            {
                'store': 'ST002',
                'sku': 'P001',
                'quantity_change': -10,
                'reason': '销售出库'
            }
        ]

        result = service.batch_adjust_inventory(adjustments, 'test_user')

        assert result['total'] == 2
        assert result['success'] == 2
        assert result['failed'] == 0

    def test_batch_adjust_inventory_with_errors(self, seeded_db):
        service = BatchService(seeded_db)

        adjustments = [
            {
                'store': 'ST001',
                'sku': 'P001',
                'quantity_change': 10,
                'reason': '测试'
            },
            {
                'store': 'ST001',
                'sku': 'INVALID_SKU',
                'quantity_change': 10,
                'reason': '测试'
            }
        ]

        result = service.batch_adjust_inventory(adjustments, 'test_user')

        assert result['total'] == 2
        assert result['success'] == 1
        assert result['failed'] == 1
