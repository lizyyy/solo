import os
import json
import tempfile
import pytest

from inventory.services.import_export_service import ImportExportService


class TestImportExportService:
    def test_export_stores_json(self, seeded_db):
        service = ImportExportService(seeded_db)

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            temp_path = f.name

        try:
            result = service.export_stores(temp_path, format='json')
            assert os.path.exists(result)

            with open(result, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert isinstance(data, list)
            assert len(data) >= 1

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_export_products_json(self, seeded_db):
        service = ImportExportService(seeded_db)

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            temp_path = f.name

        try:
            result = service.export_products(temp_path, format='json')
            assert os.path.exists(result)

            with open(result, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert isinstance(data, list)
            assert len(data) >= 1

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_export_inventory_json(self, seeded_db):
        service = ImportExportService(seeded_db)

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            temp_path = f.name

        try:
            result = service.export_inventory(temp_path, format='json')
            assert os.path.exists(result)

            with open(result, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert isinstance(data, list)

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_import_products_json(self, seeded_db):
        service = ImportExportService(seeded_db)

        test_products = [
            {'sku': 'NEW001', 'name': '新产品1', 'category': '测试', 'cost_price': 10.0, 'base_sale_price': 15.0},
            {'sku': 'NEW002', 'name': '新产品2', 'category': '测试', 'cost_price': 20.0, 'base_sale_price': 30.0},
        ]

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8') as f:
            json.dump(test_products, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = service.import_products(temp_path)

            assert result['total'] == 2
            assert result['success'] == 2
            assert result['failed'] == 0
            assert result['created'] == ['NEW001', 'NEW002']

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_import_products_duplicate_no_overwrite(self, seeded_db):
        service = ImportExportService(seeded_db)

        test_products = [
            {'sku': 'P001', 'name': '已存在的商品', 'category': '测试', 'cost_price': 10.0, 'base_sale_price': 15.0},
        ]

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8') as f:
            json.dump(test_products, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = service.import_products(temp_path, overwrite=False)

            assert result['total'] == 1
            assert result['success'] == 0
            assert result['failed'] == 1

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_import_stores_json(self, seeded_db):
        service = ImportExportService(seeded_db)

        test_stores = [
            {'code': 'NEWST01', 'name': '新门店1', 'city': '成都', 'status': 'active'},
            {'code': 'NEWST02', 'name': '新门店2', 'city': '武汉', 'status': 'active'},
        ]

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8') as f:
            json.dump(test_stores, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = service.import_stores(temp_path)

            assert result['total'] == 2
            assert result['success'] == 2
            assert result['failed'] == 0

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_import_inventory_adjustments_json(self, seeded_db):
        service = ImportExportService(seeded_db)

        adjustments = [
            {'store_code': 'ST001', 'sku': 'P001', 'quantity_change': 100, 'reason': '测试入库'},
            {'store_code': 'ST002', 'sku': 'P001', 'quantity_change': 50, 'reason': '测试入库'},
        ]

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8') as f:
            json.dump(adjustments, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = service.import_inventory_adjustments(temp_path, reason='测试')

            assert result['total'] == 2
            assert result['success'] == 2
            assert result['failed'] == 0

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    def test_import_inventory_adjustments_with_errors(self, seeded_db):
        service = ImportExportService(seeded_db)

        adjustments = [
            {'store_code': 'ST001', 'sku': 'P001', 'quantity_change': 10, 'reason': '正常'},
            {'store_code': 'INVALID', 'sku': 'P001', 'quantity_change': 10, 'reason': '错误'},
        ]

        with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8') as f:
            json.dump(adjustments, f, ensure_ascii=False)
            temp_path = f.name

        try:
            result = service.import_inventory_adjustments(temp_path)

            assert result['total'] == 2
            assert result['success'] == 1
            assert result['failed'] == 1
            assert len(result['errors']) == 1

        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
