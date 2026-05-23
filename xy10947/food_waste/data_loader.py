import os
import pandas as pd
from typing import List, Tuple, Dict, Any
from pathlib import Path
from .models import (
    Material, Store, PurchaseItem, UsageItem, WasteItem,
    ValidationErrorItem
)


class DataLoader:
    def __init__(self):
        self.validation_errors: List[ValidationErrorItem] = []

    def _detect_file_type(self, file_path: str) -> str:
        ext = Path(file_path).suffix.lower()
        if ext in ['.csv']:
            return 'csv'
        elif ext in ['.xlsx', '.xls']:
            return 'excel'
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def _read_file(self, file_path: str) -> pd.DataFrame:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        file_type = self._detect_file_type(file_path)
        if file_type == 'csv':
            return pd.read_csv(file_path, dtype=str, keep_default_na=False)
        else:
            return pd.read_excel(file_path, dtype=str, keep_default_na=False)

    def _normalize_columns(self, df: pd.DataFrame, expected_columns: List[str]) -> pd.DataFrame:
        df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
        missing_cols = [c for c in expected_columns if c not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必要列: {', '.join(missing_cols)}")
        return df

    def load_materials(self, file_path: str) -> Tuple[Dict[str, Material], List[ValidationErrorItem]]:
        errors = []
        materials = {}
        
        try:
            df = self._read_file(file_path)
            df = self._normalize_columns(df, ['material_id', 'material_name', 'category', 'unit', 'price_per_unit'])
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                try:
                    data = {
                        'material_id': str(row.get('material_id', '')).strip(),
                        'material_name': str(row.get('material_name', '')).strip(),
                        'category': str(row.get('category', '')).strip(),
                        'unit': str(row.get('unit', '')).strip(),
                        'unit_conversion': str(row.get('unit_conversion', '')).strip(),
                        'price_per_unit': float(str(row.get('price_per_unit', 0)).strip() or 0)
                    }
                    material = Material(**data)
                    materials[material.material_id] = material
                except Exception as e:
                    errors.append(ValidationErrorItem(
                        row_number=row_num,
                        error_type='原料数据错误',
                        error_message=str(e),
                        raw_data=dict(row)
                    ))
        except Exception as e:
            raise RuntimeError(f"加载原料文件失败: {e}")
        
        self.validation_errors.extend(errors)
        return materials, errors

    def load_stores(self, file_path: str) -> Tuple[Dict[str, Store], List[ValidationErrorItem]]:
        errors = []
        stores = {}
        
        try:
            df = self._read_file(file_path)
            df = self._normalize_columns(df, ['store_id', 'store_name'])
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                try:
                    data = {
                        'store_id': str(row.get('store_id', '')).strip(),
                        'store_name': str(row.get('store_name', '')).strip(),
                        'region': str(row.get('region', '')).strip() or None,
                        'manager': str(row.get('manager', '')).strip() or None
                    }
                    store = Store(**data)
                    stores[store.store_id] = store
                except Exception as e:
                    errors.append(ValidationErrorItem(
                        row_number=row_num,
                        error_type='门店数据错误',
                        error_message=str(e),
                        raw_data=dict(row)
                    ))
        except Exception as e:
            raise RuntimeError(f"加载门店文件失败: {e}")
        
        self.validation_errors.extend(errors)
        return stores, errors

    def load_purchases(self, file_path: str) -> Tuple[List[PurchaseItem], List[ValidationErrorItem]]:
        errors = []
        purchases = []
        
        try:
            df = self._read_file(file_path)
            df = self._normalize_columns(df, ['purchase_id', 'store_id', 'material_id', 'purchase_date', 'quantity', 'unit', 'total_price'])
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                try:
                    data = {
                        'purchase_id': str(row.get('purchase_id', '')).strip(),
                        'store_id': str(row.get('store_id', '')).strip(),
                        'material_id': str(row.get('material_id', '')).strip(),
                        'purchase_date': str(row.get('purchase_date', '')).strip(),
                        'quantity': float(str(row.get('quantity', 0)).strip() or 0),
                        'unit': str(row.get('unit', '')).strip(),
                        'total_price': float(str(row.get('total_price', 0)).strip() or 0)
                    }
                    purchase = PurchaseItem(**data)
                    purchases.append(purchase)
                except Exception as e:
                    errors.append(ValidationErrorItem(
                        row_number=row_num,
                        error_type='采购单数据错误',
                        error_message=str(e),
                        raw_data=dict(row)
                    ))
        except Exception as e:
            raise RuntimeError(f"加载采购单文件失败: {e}")
        
        self.validation_errors.extend(errors)
        return purchases, errors

    def load_usages(self, file_path: str) -> Tuple[List[UsageItem], List[ValidationErrorItem]]:
        errors = []
        usages = []
        
        try:
            df = self._read_file(file_path)
            df = self._normalize_columns(df, ['usage_id', 'store_id', 'material_id', 'usage_date', 'quantity', 'unit'])
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                try:
                    data = {
                        'usage_id': str(row.get('usage_id', '')).strip(),
                        'store_id': str(row.get('store_id', '')).strip(),
                        'material_id': str(row.get('material_id', '')).strip(),
                        'usage_date': str(row.get('usage_date', '')).strip(),
                        'quantity': float(str(row.get('quantity', 0)).strip() or 0),
                        'unit': str(row.get('unit', '')).strip(),
                        'department': str(row.get('department', '')).strip() or None
                    }
                    usage = UsageItem(**data)
                    usages.append(usage)
                except Exception as e:
                    errors.append(ValidationErrorItem(
                        row_number=row_num,
                        error_type='领用单数据错误',
                        error_message=str(e),
                        raw_data=dict(row)
                    ))
        except Exception as e:
            raise RuntimeError(f"加载领用单文件失败: {e}")
        
        self.validation_errors.extend(errors)
        return usages, errors

    def load_wastes(self, file_path: str) -> Tuple[List[WasteItem], List[ValidationErrorItem]]:
        errors = []
        wastes = []
        
        try:
            df = self._read_file(file_path)
            df = self._normalize_columns(df, ['waste_id', 'store_id', 'material_id', 'waste_date', 'quantity', 'unit'])
            
            for idx, row in df.iterrows():
                row_num = idx + 2
                try:
                    data = {
                        'waste_id': str(row.get('waste_id', '')).strip(),
                        'store_id': str(row.get('store_id', '')).strip(),
                        'material_id': str(row.get('material_id', '')).strip(),
                        'waste_date': str(row.get('waste_date', '')).strip(),
                        'quantity': float(str(row.get('quantity', 0)).strip() or 0),
                        'unit': str(row.get('unit', '')).strip(),
                        'reason': str(row.get('reason', '')).strip() or None
                    }
                    waste = WasteItem(**data)
                    wastes.append(waste)
                except Exception as e:
                    errors.append(ValidationErrorItem(
                        row_number=row_num,
                        error_type='报损单数据错误',
                        error_message=str(e),
                        raw_data=dict(row)
                    ))
        except Exception as e:
            raise RuntimeError(f"加载报损单文件失败: {e}")
        
        self.validation_errors.extend(errors)
        return wastes, errors

    def get_all_errors(self) -> List[ValidationErrorItem]:
        return self.validation_errors
