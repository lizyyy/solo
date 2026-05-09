import os
import json
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from datetime import datetime

try:
    import pandas as pd
    from openpyxl import Workbook
except ImportError:
    pd = None

from sqlalchemy.orm import Session

from inventory.models import (
    Store, Product, Inventory, Transfer, PriceChange, AuditLog,
    InventoryHistory
)
from inventory.services.inventory_service import InventoryService
from inventory.services.audit_service import AuditService


class ImportExportService:
    INVENTORY_COLUMNS = ['store_code', 'store_name', 'sku', 'product_name', 'quantity',
                         'available_quantity', 'reserved_quantity', 'sale_price', 'min_stock', 'max_stock', 'status']
    TRANSFER_COLUMNS = ['transfer_no', 'from_store', 'to_store', 'sku', 'product_name',
                        'requested_quantity', 'shipped_quantity', 'received_quantity', 'unit_price', 'status', 'created_by']
    PRICE_CHANGE_COLUMNS = ['change_no', 'store_code', 'sku', 'product_name', 'old_price',
                            'new_price', 'reason', 'status', 'created_by', 'applied_at']
    PRODUCT_COLUMNS = ['sku', 'barcode', 'name', 'category', 'unit', 'cost_price', 'base_sale_price', 'status']
    STORE_COLUMNS = ['code', 'name', 'address', 'city', 'phone', 'manager', 'status']

    REQUIRED_IMPORT_FIELDS = {
        'inventory': ['store_code', 'sku', 'quantity'],
        'product': ['sku', 'name'],
        'store': ['code', 'name'],
        'price_change': ['store_code', 'sku', 'new_price'],
        'inventory_adjust': ['store_code', 'sku', 'quantity_change']
    }

    def __init__(self, db_session: Session):
        self.db = db_session
        self.audit = AuditService(db_session)
        self.inventory_service = InventoryService(db_session)

    def export_inventory(
        self,
        file_path: str,
        store_code: Optional[str] = None,
        status: Optional[str] = None,
        format: str = 'xlsx'
    ) -> str:
        query = self.db.query(Inventory)

        if store_code:
            store = self.db.query(Store).filter(Store.code == store_code).first()
            if store:
                query = query.filter(Inventory.store_id == store.id)
        if status:
            query = query.filter(Inventory.status == status)

        inventories = query.all()

        data = []
        for inv in inventories:
            data.append({
                'store_code': inv.store.code if inv.store else None,
                'store_name': inv.store.name if inv.store else None,
                'sku': inv.product.sku if inv.product else None,
                'product_name': inv.product.name if inv.product else None,
                'quantity': inv.quantity,
                'available_quantity': inv.available_quantity,
                'reserved_quantity': inv.reserved_quantity,
                'sale_price': inv.sale_price,
                'min_stock': inv.min_stock,
                'max_stock': inv.max_stock,
                'status': inv.status
            })

        return self._write_to_file(data, self.INVENTORY_COLUMNS, file_path, format)

    def export_transfers(
        self,
        file_path: str,
        status: Optional[str] = None,
        format: str = 'xlsx'
    ) -> str:
        query = self.db.query(Transfer)
        if status:
            query = query.filter(Transfer.status == status)
        transfers = query.all()

        data = []
        for tf in transfers:
            for item in tf.items:
                data.append({
                    'transfer_no': tf.transfer_no,
                    'from_store': tf.from_store.code if tf.from_store else None,
                    'to_store': tf.to_store.code if tf.to_store else None,
                    'sku': item.product.sku if item.product else None,
                    'product_name': item.product.name if item.product else None,
                    'requested_quantity': item.requested_quantity,
                    'shipped_quantity': item.shipped_quantity,
                    'received_quantity': item.received_quantity,
                    'unit_price': item.unit_price,
                    'status': tf.status,
                    'created_by': tf.created_by
                })

        return self._write_to_file(data, self.TRANSFER_COLUMNS, file_path, format)

    def export_price_changes(
        self,
        file_path: str,
        status: Optional[str] = None,
        format: str = 'xlsx'
    ) -> str:
        query = self.db.query(PriceChange)
        if status:
            query = query.filter(PriceChange.status == status)
        price_changes = query.all()

        data = []
        for pc in price_changes:
            data.append({
                'change_no': pc.change_no,
                'store_code': pc.store.code if pc.store else None,
                'sku': pc.product.sku if pc.product else None,
                'product_name': pc.product.name if pc.product else None,
                'old_price': pc.old_price,
                'new_price': pc.new_price,
                'reason': pc.reason,
                'status': pc.status,
                'created_by': pc.created_by,
                'applied_at': pc.applied_at.isoformat() if pc.applied_at else None
            })

        return self._write_to_file(data, self.PRICE_CHANGE_COLUMNS, file_path, format)

    def export_products(
        self,
        file_path: str,
        format: str = 'xlsx'
    ) -> str:
        products = self.db.query(Product).all()

        data = []
        for p in products:
            data.append({
                'sku': p.sku,
                'barcode': p.barcode,
                'name': p.name,
                'category': p.category,
                'unit': p.unit,
                'cost_price': p.cost_price,
                'base_sale_price': p.base_sale_price,
                'status': p.status
            })

        return self._write_to_file(data, self.PRODUCT_COLUMNS, file_path, format)

    def export_stores(
        self,
        file_path: str,
        format: str = 'xlsx'
    ) -> str:
        stores = self.db.query(Store).all()

        data = []
        for s in stores:
            data.append({
                'code': s.code,
                'name': s.name,
                'address': s.address,
                'city': s.city,
                'phone': s.phone,
                'manager': s.manager,
                'status': s.status
            })

        return self._write_to_file(data, self.STORE_COLUMNS, file_path, format)

    def import_products(
        self,
        file_path: str,
        created_by: str = 'system',
        overwrite: bool = False
    ) -> Dict[str, Any]:
        data = self._read_from_file(file_path)
        results = {
            'total': len(data),
            'success': 0,
            'failed': 0,
            'errors': [],
            'created': [],
            'updated': []
        }

        for i, row in enumerate(data, 1):
            try:
                row = {k: (v if v is not None else '') for k, v in row.items()}

                if not row.get('sku') or not row.get('name'):
                    raise ValueError(f"Missing required fields: sku, name")

                sku = str(row['sku']).strip()
                existing = self.db.query(Product).filter(Product.sku == sku).first()

                if existing:
                    if not overwrite:
                        results['errors'].append(f"Row {i}: SKU '{sku}' already exists")
                        results['failed'] += 1
                        continue
                    else:
                        existing.barcode = str(row.get('barcode', existing.barcode) or '')
                        existing.name = str(row['name'])
                        existing.category = str(row.get('category', existing.category) or '')
                        existing.unit = str(row.get('unit', existing.unit) or '件')
                        existing.cost_price = float(row.get('cost_price', existing.cost_price) or 0)
                        existing.base_sale_price = float(row.get('base_sale_price', existing.base_sale_price) or 0)
                        existing.status = str(row.get('status', existing.status) or 'active')
                        results['updated'].append(sku)
                else:
                    product = Product(
                        sku=sku,
                        barcode=str(row.get('barcode', '') or ''),
                        name=str(row['name']),
                        category=str(row.get('category', '') or ''),
                        unit=str(row.get('unit', '件') or '件'),
                        cost_price=float(row.get('cost_price', 0) or 0),
                        base_sale_price=float(row.get('base_sale_price', 0) or 0),
                        status=str(row.get('status', 'active') or 'active')
                    )
                    self.db.add(product)
                    results['created'].append(sku)

                results['success'] += 1

            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Row {i}: {str(e)}")

        return results

    def import_stores(
        self,
        file_path: str,
        created_by: str = 'system',
        overwrite: bool = False
    ) -> Dict[str, Any]:
        data = self._read_from_file(file_path)
        results = {
            'total': len(data),
            'success': 0,
            'failed': 0,
            'errors': [],
            'created': [],
            'updated': []
        }

        for i, row in enumerate(data, 1):
            try:
                row = {k: (v if v is not None else '') for k, v in row.items()}

                if not row.get('code') or not row.get('name'):
                    raise ValueError(f"Missing required fields: code, name")

                code = str(row['code']).strip()
                existing = self.db.query(Store).filter(Store.code == code).first()

                if existing:
                    if not overwrite:
                        results['errors'].append(f"Row {i}: Store code '{code}' already exists")
                        results['failed'] += 1
                        continue
                    else:
                        existing.name = str(row['name'])
                        existing.address = str(row.get('address', existing.address) or '')
                        existing.city = str(row.get('city', existing.city) or '')
                        existing.phone = str(row.get('phone', existing.phone) or '')
                        existing.manager = str(row.get('manager', existing.manager) or '')
                        existing.status = str(row.get('status', existing.status) or 'active')
                        results['updated'].append(code)
                else:
                    store = Store(
                        code=code,
                        name=str(row['name']),
                        address=str(row.get('address', '') or ''),
                        city=str(row.get('city', '') or ''),
                        phone=str(row.get('phone', '') or ''),
                        manager=str(row.get('manager', '') or ''),
                        status=str(row.get('status', 'active') or 'active')
                    )
                    self.db.add(store)
                    results['created'].append(code)

                results['success'] += 1

            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Row {i}: {str(e)}")

        return results

    def import_inventory_adjustments(
        self,
        file_path: str,
        reason: str = 'Batch import adjustment',
        adjusted_by: str = 'system'
    ) -> Dict[str, Any]:
        data = self._read_from_file(file_path)
        results = {
            'total': len(data),
            'success': 0,
            'failed': 0,
            'errors': []
        }

        for i, row in enumerate(data, 1):
            try:
                row = {k: (v if v is not None else '') for k, v in row.items()}

                if not row.get('store_code') or not row.get('sku') or row.get('quantity_change') is None:
                    raise ValueError(f"Missing required fields: store_code, sku, quantity_change")

                store = self.db.query(Store).filter(Store.code == str(row['store_code'])).first()
                if not store:
                    raise ValueError(f"Store not found: {row['store_code']}")

                product = self.db.query(Product).filter(Product.sku == str(row['sku'])).first()
                if not product:
                    raise ValueError(f"Product not found: {row['sku']}")

                qty_change = int(float(row['quantity_change']))

                self.inventory_service.adjust_quantity(
                    store_id=store.id,
                    product_id=product.id,
                    quantity_change=qty_change,
                    reason=row.get('reason', reason),
                    username=adjusted_by
                )

                results['success'] += 1

            except Exception as e:
                results['failed'] += 1
                results['errors'].append(f"Row {i}: {str(e)}")

        return results

    def _write_to_file(self, data: List[Dict], columns: List[str], file_path: str, format: str) -> str:
        path = Path(file_path)
        format = format.lower()

        if not data:
            data = []

        if format == 'csv':
            if pd is None:
                raise ImportError("pandas is required for CSV export")
            df = pd.DataFrame(data, columns=columns)
            df.to_csv(path, index=False, encoding='utf-8-sig')
        elif format == 'json':
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        elif format == 'xlsx':
            if pd is None:
                raise ImportError("pandas and openpyxl are required for Excel export")
            df = pd.DataFrame(data, columns=columns)
            df.to_excel(path, index=False)
        else:
            raise ValueError(f"Unsupported format: {format}")

        return str(path)

    def _read_from_file(self, file_path: str) -> List[Dict]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        suffix = path.suffix.lower()

        if pd is None:
            raise ImportError("pandas is required for import operations")

        if suffix == '.csv':
            df = pd.read_csv(path)
        elif suffix in ['.xlsx', '.xls']:
            df = pd.read_excel(path)
        elif suffix == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data if isinstance(data, list) else [data]
        else:
            raise ValueError(f"Unsupported file format: {suffix}")

        return df.to_dict('records')
