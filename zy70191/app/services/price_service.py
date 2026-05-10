from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import PriceSnapshot, ExceptionType
from app.schemas import PriceComparison
from app.services.supplier_service import SupplierService


class PriceService:
    def __init__(self, db: Session):
        self.db = db
        self.supplier_service = SupplierService(db)

    def compare_prices(
        self,
        primary_supplier_id: int,
        alternative_supplier_id: int,
        product_code: str
    ) -> Optional[PriceComparison]:
        primary_price = self.supplier_service.get_current_price(primary_supplier_id, product_code)
        alternative_price = self.supplier_service.get_current_price(alternative_supplier_id, product_code)

        if not primary_price or not alternative_price:
            return None

        price_difference = alternative_price.unit_price - primary_price.unit_price
        price_difference_percent = (price_difference / primary_price.unit_price * 100) if primary_price.unit_price > 0 else 0

        return PriceComparison(
            product_code=product_code,
            product_name=primary_price.product_name,
            primary_price=primary_price.unit_price,
            alternative_price=alternative_price.unit_price,
            price_difference=price_difference,
            price_difference_percent=round(price_difference_percent, 2)
        )

    def get_price_history(self, supplier_id: int, product_code: str, limit: int = 10) -> List[PriceSnapshot]:
        return self.db.query(PriceSnapshot).filter(
            PriceSnapshot.supplier_id == supplier_id,
            PriceSnapshot.product_code == product_code
        ).order_by(PriceSnapshot.effective_date.desc()).limit(limit).all()

    def check_price_abnormal(
        self,
        primary_supplier_id: int,
        alternative_supplier_id: int,
        product_code: str,
        max_increase_percent: float = 20.0
    ) -> dict:
        comparison = self.compare_prices(
            primary_supplier_id,
            alternative_supplier_id,
            product_code
        )

        if not comparison:
            return {
                "is_abnormal": True,
                "reason": "价格信息不完整",
                "details": None
            }

        if comparison.price_difference_percent > max_increase_percent:
            return {
                "is_abnormal": True,
                "reason": f"价格涨幅超过阈值({max_increase_percent}%)",
                "details": comparison.model_dump()
            }

        return {
            "is_abnormal": False,
            "reason": "价格在合理范围内",
            "details": comparison.model_dump()
        }

    def find_best_alternative(
        self,
        primary_supplier_id: int,
        product_code: str
    ) -> Optional[dict]:
        from app.models import Supplier, SupplierType, SupplierStatus
        
        alternatives = self.db.query(Supplier).filter(
            Supplier.type == SupplierType.ALTERNATIVE,
            Supplier.status == SupplierStatus.ACTIVE,
            Supplier.id != primary_supplier_id
        ).all()

        primary_price = self.supplier_service.get_current_price(primary_supplier_id, product_code)
        if not primary_price:
            return None

        best_option = None
        best_price = float('inf')

        for alt in alternatives:
            alt_price = self.supplier_service.get_current_price(alt.id, product_code)
            if alt_price and alt_price.unit_price < best_price:
                best_price = alt_price.unit_price
                best_option = {
                    "supplier_id": alt.id,
                    "supplier_name": alt.name,
                    "supplier_code": alt.code,
                    "unit_price": alt_price.unit_price,
                    "price_difference": alt_price.unit_price - primary_price.unit_price,
                    "price_difference_percent": round(
                        (alt_price.unit_price - primary_price.unit_price) / primary_price.unit_price * 100, 2
                    ) if primary_price.unit_price > 0 else 0
                }

        return best_option
