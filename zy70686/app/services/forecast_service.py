from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import List, Optional
from app.models import Material, SalesRecord, SafetyStock, Store
from app.schemas import ForecastRequest, ForecastResponse, ForecastItem


class ForecastService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_avg_daily_consumption(
        self,
        store_id: int,
        material_id: int,
        historical_days: int = 30
    ) -> float:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=historical_days)

        result = self.db.query(
            func.sum(SalesRecord.quantity).label("total_quantity")
        ).filter(
            and_(
                SalesRecord.store_id == store_id,
                SalesRecord.material_id == material_id,
                SalesRecord.sales_date >= start_date,
                SalesRecord.sales_date <= end_date
            )
        ).first()

        total_quantity = result.total_quantity or 0
        return total_quantity / historical_days if historical_days > 0 else 0

    def forecast_consumption(
        self,
        store_id: int,
        material_id: int,
        forecast_days: int = 7,
        historical_days: int = 30
    ) -> dict:
        avg_daily = self.calculate_avg_daily_consumption(
            store_id, material_id, historical_days
        )
        forecast_total = avg_daily * forecast_days

        material = self.db.query(Material).filter(Material.id == material_id).first()
        current_stock = material.current_stock if material else 0

        if avg_daily > 0 and current_stock > 0:
            estimated_runout_days = current_stock / avg_daily
        else:
            estimated_runout_days = None

        return {
            "avg_daily_consumption": avg_daily,
            "forecast_consumption": forecast_total,
            "estimated_runout_days": estimated_runout_days,
            "current_stock": current_stock
        }

    def get_safety_stock_level(self, store_id: int, material_id: int) -> dict:
        safety_stock = self.db.query(SafetyStock).filter(
            and_(
                SafetyStock.store_id == store_id,
                SafetyStock.material_id == material_id
            )
        ).first()

        if safety_stock:
            return {
                "min_stock": safety_stock.min_stock,
                "max_stock": safety_stock.max_stock,
                "reorder_point": safety_stock.reorder_point,
                "safety_factor": safety_stock.safety_factor
            }
        return {
            "min_stock": 0,
            "max_stock": 0,
            "reorder_point": 0,
            "safety_factor": 1.5
        }

    def suggest_replenishment(
        self,
        current_stock: float,
        forecast_consumption: float,
        reorder_point: float,
        max_stock: float,
        lead_time_days: int = 3,
        avg_daily_consumption: float = 0
    ) -> dict:
        lead_time_consumption = avg_daily_consumption * lead_time_days
        projected_stock = current_stock - forecast_consumption - lead_time_consumption

        need_replenishment = (current_stock <= reorder_point) or (projected_stock <= 0)

        if need_replenishment:
            suggested_quantity = max(max_stock - current_stock + forecast_consumption, 0)
        else:
            suggested_quantity = 0

        return {
            "need_replenishment": need_replenishment,
            "suggested_quantity": round(suggested_quantity, 2),
            "projected_stock": round(projected_stock, 2)
        }

    def generate_forecast(self, request: ForecastRequest) -> ForecastResponse:
        store = self.db.query(Store).filter(Store.id == request.store_id).first()
        if not store:
            raise ValueError(f"Store with id {request.store_id} not found")

        materials_query = self.db.query(Material).filter(Material.status == "active")
        if request.material_id:
            materials_query = materials_query.filter(Material.id == request.material_id)

        materials = materials_query.all()
        forecast_items: List[ForecastItem] = []

        for material in materials:
            forecast_data = self.forecast_consumption(
                request.store_id,
                material.id,
                request.forecast_days,
                request.historical_days
            )

            safety_stock_data = self.get_safety_stock_level(
                request.store_id,
                material.id
            )

            replenishment_data = self.suggest_replenishment(
                forecast_data["current_stock"],
                forecast_data["forecast_consumption"],
                safety_stock_data["reorder_point"],
                safety_stock_data["max_stock"],
                material.lead_time_days,
                forecast_data["avg_daily_consumption"]
            )

            forecast_items.append(ForecastItem(
                material_id=material.id,
                material_name=material.name,
                category=material.category,
                current_stock=forecast_data["current_stock"],
                unit=material.unit,
                avg_daily_consumption=round(forecast_data["avg_daily_consumption"], 4),
                forecast_consumption=round(forecast_data["forecast_consumption"], 2),
                estimated_runout_days=round(forecast_data["estimated_runout_days"], 1)
                if forecast_data["estimated_runout_days"] else None,
                safety_stock_level=safety_stock_data["min_stock"],
                reorder_point=safety_stock_data["reorder_point"],
                need_replenishment=replenishment_data["need_replenishment"],
                suggested_quantity=replenishment_data["suggested_quantity"]
            ))

        return ForecastResponse(
            store_id=store.id,
            store_name=store.name,
            forecast_date=datetime.utcnow(),
            forecast_days=request.forecast_days,
            items=forecast_items,
            generated_at=datetime.utcnow()
        )
