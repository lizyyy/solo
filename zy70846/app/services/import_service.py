import csv
import json
from datetime import datetime, date
from io import StringIO, TextIOWrapper
from typing import List, Dict, Any, Optional, Tuple
from pydantic import ValidationError

from app.schemas.inventory import InventoryRecord, InventoryItem
from app.schemas.sales import SalesRecord, SalesItem
from app.schemas.replenishment import ReplenishmentRecord, ReplenishmentItem
from app.storage.memory import storage


class DataImportService:
    @staticmethod
    def _parse_date(date_str: str) -> date:
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d-%m-%Y', '%d/%m/%Y']:
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except (ValueError, TypeError):
                continue
        return date.today()
    
    @staticmethod
    def _parse_int(value: str, default: int = 0) -> int:
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def _parse_float(value: str, default: float = 0.0) -> float:
        try:
            return float(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def _normalize_sku(sku_name: str) -> str:
        mapped_sku = storage.get_sku_by_alias(sku_name)
        if mapped_sku:
            return mapped_sku
        return sku_name
    
    def import_inventory_csv(self, file_content: bytes, store_id: str, store_name: str, operator: str) -> InventoryRecord:
        content = file_content.decode('utf-8-sig')
        reader = csv.DictReader(StringIO(content))
        
        items: List[InventoryItem] = []
        record_date = date.today()
        
        for row in reader:
            sku = row.get('sku', row.get('SKU', '')).strip()
            sku_name = row.get('sku_name', row.get('商品名称', row.get('name', ''))).strip()
            
            if not sku:
                sku = self._normalize_sku(sku_name)
            
            qty = self._parse_int(row.get('quantity', row.get('数量', '0')))
            if qty <= 0:
                continue
            
            expiry_str = row.get('expiry_date', row.get('过期日期', row.get('有效期', '')))
            expiry_date = self._parse_date(expiry_str) if expiry_str else None
            
            item = InventoryItem(
                sku=sku,
                sku_name=sku_name,
                quantity=qty,
                unit=row.get('unit', row.get('单位', '个')).strip() or '个',
                unit_price=self._parse_float(row.get('unit_price', row.get('单价', '0'))),
                expiry_date=expiry_date,
                shelf_position=row.get('shelf_position', row.get('货架位置', '')).strip(),
                category=row.get('category', row.get('分类', '')).strip(),
                batch_no=row.get('batch_no', row.get('批次号', '')).strip()
            )
            items.append(item)
        
        record = InventoryRecord(
            id=storage.generate_id(),
            store_id=store_id,
            store_name=store_name,
            record_date=record_date,
            operator=operator,
            items=items,
            total_items=sum(item.quantity for item in items),
            total_value=sum((item.unit_price or 0) * item.quantity for item in items)
        )
        
        return storage.save_inventory(record)
    
    def import_sales_json(self, file_content: bytes, store_id: str, store_name: str, operator: str) -> SalesRecord:
        data = json.loads(file_content.decode('utf-8'))
        
        items: List[SalesItem] = []
        sales_data = data.get('sales', data.get('items', []))
        
        for item_data in sales_data:
            sku = item_data.get('sku', '').strip()
            sku_name = item_data.get('sku_name', item_data.get('name', '')).strip()
            
            if not sku:
                sku = self._normalize_sku(sku_name)
            
            qty = self._parse_int(str(item_data.get('quantity', 0)))
            unit_price = self._parse_float(str(item_data.get('unit_price', 0)))
            total_amount = self._parse_float(str(item_data.get('total_amount', str(qty * unit_price))))
            
            item = SalesItem(
                sku=sku,
                sku_name=sku_name,
                quantity=qty,
                unit_price=unit_price,
                total_amount=total_amount,
                unit=item_data.get('unit', '个'),
                category=item_data.get('category', '').strip()
            )
            items.append(item)
        
        start_date = self._parse_date(data.get('start_date', data.get('date', '')))
        end_date = self._parse_date(data.get('end_date', data.get('date', '')))
        
        record = SalesRecord(
            id=storage.generate_id(),
            store_id=store_id,
            store_name=store_name,
            start_date=start_date,
            end_date=end_date,
            items=items,
            total_items=sum(item.quantity for item in items),
            total_amount=sum(item.total_amount for item in items),
            total_transactions=data.get('total_transactions', len(items))
        )
        
        return storage.save_sales(record)
    
    def import_replenishment_csv(self, file_content: bytes, store_id: str, store_name: str, operator: str, supplier: str = "") -> ReplenishmentRecord:
        content = file_content.decode('utf-8-sig')
        reader = csv.DictReader(StringIO(content))
        
        items: List[ReplenishmentItem] = []
        replenishment_date = date.today()
        
        for row in reader:
            sku = row.get('sku', row.get('SKU', '')).strip()
            sku_name = row.get('sku_name', row.get('商品名称', row.get('name', ''))).strip()
            
            if not sku:
                sku = self._normalize_sku(sku_name)
            
            requested = self._parse_int(row.get('requested_quantity', row.get('申请数量', '0')))
            actual = self._parse_int(row.get('actual_quantity', row.get('实际数量', row.get('quantity', '0'))))
            
            if requested <= 0 and actual <= 0:
                continue
            
            item = ReplenishmentItem(
                sku=sku,
                sku_name=sku_name,
                requested_quantity=requested,
                actual_quantity=actual,
                unit=row.get('unit', row.get('单位', '个')).strip() or '个',
                unit_price=self._parse_float(row.get('unit_price', row.get('单价', '0'))),
                category=row.get('category', row.get('分类', '')).strip(),
                remark=row.get('remark', row.get('备注', '')).strip()
            )
            items.append(item)
        
        record = ReplenishmentRecord(
            id=storage.generate_id(),
            store_id=store_id,
            store_name=store_name,
            replenishment_date=replenishment_date,
            supplier=supplier,
            operator=operator,
            items=items,
            total_requested=sum(item.requested_quantity for item in items),
            total_actual=sum(item.actual_quantity for item in items),
            total_value=sum((item.unit_price or 0) * item.actual_quantity for item in items)
        )
        
        return storage.save_replenishment(record)


import_service = DataImportService()
