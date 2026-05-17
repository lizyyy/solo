import pandas as pd
from pathlib import Path
from typing import List, Dict, Any, Tuple
from datetime import datetime
import logging
from pydantic import ValidationError

from .models import Material, PurchaseOrder, UsageOrder, DamageReport, Store, Unit
from .unit_converter import UnitConverter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataValidationError(Exception):
    pass


class DataLoader:
    def __init__(self):
        self.warnings: List[str] = []
        self.errors: List[str] = []

    def load_data(
        self,
        materials_path: Path,
        purchases_path: Path,
        usages_path: Path,
        damages_path: Path,
        stores_path: Path,
    ) -> Dict[str, List[Any]]:
        self.warnings = []
        self.errors = []

        try:
            materials = self._load_materials(materials_path)
            purchases = self._load_purchases(purchases_path)
            usages = self._load_usages(usages_path)
            damages = self._load_damages(damages_path)
            stores = self._load_stores(stores_path)

            self._validate_referential_integrity(materials, purchases, usages, damages, stores)

            return {
                "materials": materials,
                "purchases": purchases,
                "usages": usages,
                "damages": damages,
                "stores": stores,
            }
        except Exception as e:
            logger.error(f"数据加载失败: {str(e)}")
            raise

    def _read_file(self, path: Path) -> pd.DataFrame:
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {path}")

        if path.stat().st_size == 0:
            return pd.DataFrame()

        suffix = path.suffix.lower()
        if suffix in [".xlsx", ".xls"]:
            return pd.read_excel(path)
        elif suffix == ".csv":
            try:
                return pd.read_csv(path)
            except pd.errors.EmptyDataError:
                return pd.DataFrame()
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _clean_string(self, value: Any) -> str:
        if pd.isna(value):
            return ""
        return str(value).strip()

    def _clean_float(self, value: Any) -> float:
        if pd.isna(value):
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        s = str(value).strip()
        s = s.replace(",", "").replace("，", "")
        try:
            return float(s)
        except ValueError:
            return 0.0

    def _parse_unit(self, value: Any) -> Unit:
        if pd.isna(value):
            raise ValueError("单位不能为空")
        s = str(value).strip()
        unit_map = {
            "克": Unit.G,
            "g": Unit.G,
            "G": Unit.G,
            "千克": Unit.KG,
            "kg": Unit.KG,
            "KG": Unit.KG,
            "斤": Unit.JIN,
            "个": Unit.PIECE,
            "袋": Unit.BAG,
            "箱": Unit.BOX,
        }
        if s not in unit_map:
            raise ValueError(f"未知的单位: {s}")
        return unit_map[s]

    def _parse_date(self, value: Any) -> datetime.date:
        if pd.isna(value):
            raise ValueError("日期不能为空")
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, pd.Timestamp):
            return value.date()
        s = str(value).strip()
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%d-%m-%Y", "%d/%m/%Y"]:
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {s}")

    def _load_materials(self, path: Path) -> List[Material]:
        df = self._read_file(path)
        materials = []
        for idx, row in df.iterrows():
            try:
                material = Material(
                    material_id=self._clean_string(row.get("material_id", row.get("原料ID", ""))),
                    material_name=self._clean_string(row.get("material_name", row.get("原料名称", ""))),
                    category=self._clean_string(row.get("category", row.get("类别", ""))),
                    unit=self._parse_unit(row.get("unit", row.get("单位", ""))),
                    unit_price=self._clean_float(row.get("unit_price", row.get("单价", 0))),
                )
                materials.append(material)
            except ValidationError as e:
                self.warnings.append(f"原料行 {idx+2} 验证失败: {str(e)}")
            except Exception as e:
                self.warnings.append(f"原料行 {idx+2} 解析失败: {str(e)}")

        if not materials:
            self.errors.append("没有有效的原料数据")

        logger.info(f"加载原料数据: {len(materials)} 条有效记录")
        return materials

    def _load_purchases(self, path: Path) -> List[PurchaseOrder]:
        df = self._read_file(path)
        orders = []
        for idx, row in df.iterrows():
            try:
                order = PurchaseOrder(
                    order_id=self._clean_string(row.get("order_id", row.get("采购单ID", ""))),
                    material_id=self._clean_string(row.get("material_id", row.get("原料ID", ""))),
                    store_id=self._clean_string(row.get("store_id", row.get("门店ID", ""))),
                    purchase_date=self._parse_date(row.get("purchase_date", row.get("采购日期", ""))),
                    quantity=self._clean_float(row.get("quantity", row.get("数量", 0))),
                    unit=self._parse_unit(row.get("unit", row.get("单位", ""))),
                )
                orders.append(order)
            except ValidationError as e:
                self.warnings.append(f"采购单行 {idx+2} 验证失败: {str(e)}")
            except Exception as e:
                self.warnings.append(f"采购单行 {idx+2} 解析失败: {str(e)}")

        logger.info(f"加载采购数据: {len(orders)} 条有效记录")
        return orders

    def _load_usages(self, path: Path) -> List[UsageOrder]:
        df = self._read_file(path)
        orders = []
        for idx, row in df.iterrows():
            try:
                order = UsageOrder(
                    order_id=self._clean_string(row.get("order_id", row.get("领用单ID", ""))),
                    material_id=self._clean_string(row.get("material_id", row.get("原料ID", ""))),
                    store_id=self._clean_string(row.get("store_id", row.get("门店ID", ""))),
                    usage_date=self._parse_date(row.get("usage_date", row.get("领用日期", ""))),
                    quantity=self._clean_float(row.get("quantity", row.get("数量", 0))),
                    unit=self._parse_unit(row.get("unit", row.get("单位", ""))),
                )
                orders.append(order)
            except ValidationError as e:
                self.warnings.append(f"领用单行 {idx+2} 验证失败: {str(e)}")
            except Exception as e:
                self.warnings.append(f"领用单行 {idx+2} 解析失败: {str(e)}")

        logger.info(f"加载领用数据: {len(orders)} 条有效记录")
        return orders

    def _load_damages(self, path: Path) -> List[DamageReport]:
        df = self._read_file(path)
        reports = []
        for idx, row in df.iterrows():
            try:
                report = DamageReport(
                    report_id=self._clean_string(row.get("report_id", row.get("报损单ID", ""))),
                    material_id=self._clean_string(row.get("material_id", row.get("原料ID", ""))),
                    store_id=self._clean_string(row.get("store_id", row.get("门店ID", ""))),
                    damage_date=self._parse_date(row.get("damage_date", row.get("报损日期", ""))),
                    quantity=self._clean_float(row.get("quantity", row.get("数量", 0))),
                    unit=self._parse_unit(row.get("unit", row.get("单位", ""))),
                    reason=self._clean_string(row.get("reason", row.get("报损原因", ""))),
                )
                reports.append(report)
            except ValidationError as e:
                self.warnings.append(f"报损单行 {idx+2} 验证失败: {str(e)}")
            except Exception as e:
                self.warnings.append(f"报损单行 {idx+2} 解析失败: {str(e)}")

        logger.info(f"加载报损数据: {len(reports)} 条有效记录")
        return reports

    def _load_stores(self, path: Path) -> List[Store]:
        df = self._read_file(path)
        stores = []
        for idx, row in df.iterrows():
            try:
                store = Store(
                    store_id=self._clean_string(row.get("store_id", row.get("门店ID", ""))),
                    store_name=self._clean_string(row.get("store_name", row.get("门店名称", ""))),
                    region=self._clean_string(row.get("region", row.get("区域", ""))),
                )
                stores.append(store)
            except ValidationError as e:
                self.warnings.append(f"门店行 {idx+2} 验证失败: {str(e)}")
            except Exception as e:
                self.warnings.append(f"门店行 {idx+2} 解析失败: {str(e)}")

        logger.info(f"加载门店数据: {len(stores)} 条有效记录")
        return stores

    def _validate_referential_integrity(
        self,
        materials: List[Material],
        purchases: List[PurchaseOrder],
        usages: List[UsageOrder],
        damages: List[DamageReport],
        stores: List[Store],
    ):
        material_ids = {m.material_id for m in materials}
        store_ids = {s.store_id for s in stores}

        for order in purchases:
            if order.material_id not in material_ids:
                self.warnings.append(f"采购单 {order.order_id} 引用不存在的原料: {order.material_id}")
            if order.store_id not in store_ids:
                self.warnings.append(f"采购单 {order.order_id} 引用不存在的门店: {order.store_id}")

        for order in usages:
            if order.material_id not in material_ids:
                self.warnings.append(f"领用单 {order.order_id} 引用不存在的原料: {order.material_id}")
            if order.store_id not in store_ids:
                self.warnings.append(f"领用单 {order.order_id} 引用不存在的门店: {order.store_id}")

        for report in damages:
            if report.material_id not in material_ids:
                self.warnings.append(f"报损单 {report.report_id} 引用不存在的原料: {report.material_id}")
            if report.store_id not in store_ids:
                self.warnings.append(f"报损单 {report.report_id} 引用不存在的门店: {report.store_id}")

    def get_report(self) -> Dict[str, Any]:
        return {
            "warnings": self.warnings,
            "errors": self.errors,
            "has_errors": len(self.errors) > 0,
            "has_warnings": len(self.warnings) > 0,
        }
