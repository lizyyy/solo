from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
from models.data_models import (
    SalesRecord,
    TrainInfo,
    MealItem,
    PredictionResult,
    SampleQuality,
    RecordStatus
)
import uuid
from collections import defaultdict

class DemandForecaster:
    def __init__(self):
        self.safety_margin = 1.2
        self.min_samples_threshold = 3
    
    def calculate_sell_through_rate(self, records: List[SalesRecord]) -> float:
        if not records:
            return 0.0
        
        total_stock = sum(r.initial_stock for r in records)
        total_sold = sum(r.units_sold for r in records)
        
        if total_stock == 0:
            return 0.0
        
        return total_sold / total_stock
    
    def calculate_passenger_demand_ratio(self, records: List[SalesRecord]) -> float:
        if not records:
            return 0.0
        
        ratios = []
        for r in records:
            if r.passenger_count > 0:
                ratio = r.units_sold / r.passenger_count
                ratios.append(ratio)
        
        if not ratios:
            return 0.0
        
        return sum(ratios) / len(ratios)
    
    def calculate_sold_out_rate(self, records: List[SalesRecord]) -> float:
        if not records:
            return 0.0
        
        sold_out_count = sum(1 for r in records if r.was_sold_out)
        return sold_out_count / len(records)
    
    def calculate_peak_segment(self, records: List[SalesRecord]) -> str:
        if not records:
            return "unknown"
        
        segment_sales = defaultdict(int)
        for r in records:
            segment_sales[r.segment] += r.units_sold
        
        if not segment_sales:
            return max(segment_sales, key=segment_sales.__getitem__)
        
        return "unknown"
    
    def assess_risk(self, sell_through: float, sold_out_rate: float, sample_count: int) -> str:
        if sample_count < self.min_samples_threshold:
            return "高风险：历史数据不足"
        
        if sold_out_rate > 0.5:
            return "高风险：频繁缺货风险较高"
        
        if sell_through > 0.85:
            return "中风险：售罄率较高"
        
        if sell_through < 0.3:
            return "中风险：需求波动较大"
        
        return "低风险：需求稳定"
    
    def calculate_confidence(self, sample_count: int, variability: float) -> float:
        base_confidence = min(0.9, 0.5 + 0.1 * sample_count)
        
        adjusted = base_confidence * (1 - variability * 0.5)
        return max(0.3, min(0.95, adjusted))
    
    def forecast_for_meal(
        self,
        train_id: str,
        meal_id: str,
        target_date: date,
        target_time: time,
        expected_passengers: int,
        historical_records: List[SalesRecord],
        train: Optional[TrainInfo],
        meal: Optional[MealItem],
        holiday: bool = False,
        weather_condition: Optional[str] = None
    ) -> Optional[PredictionResult]:
        
        relevant_records = [
            r for r in historical_records
            if r.train_id == train_id
            and r.meal_id == meal_id
            and r.status != RecordStatus.WITHDRAWN
            and r.quality == SampleQuality.NORMAL
        ]
        
        if not relevant_records:
            return None
        
        sample_count = len(relevant_records)
        sell_through = self.calculate_sell_through_rate(relevant_records)
        demand_ratio = self.calculate_passenger_demand_ratio(relevant_records)
        sold_out_rate = self.calculate_sold_out_rate(relevant_records)
        peak_segment = self.calculate_peak_segment(relevant_records)
        
        base_demand = expected_passengers * demand_ratio
        
        holiday_factor = 1.3 if holiday else 1.0
        weather_factor = 1.1 if weather_condition in ["rainy", "snowy"] else 1.0
        
        predicted_demand = base_demand * holiday_factor * weather_factor
        
        variability = 0.1
        if sample_count >= 2:
            ratios = [r.units_sold / r.passenger_count for r in relevant_records if r.passenger_count > 0]
            if len(ratios) >= 2:
                mean_ratio = sum(ratios) / len(ratios)
                variance = sum((r - mean_ratio) ** 2 for r in ratios) / len(ratios)
                if mean_ratio > 0:
                    variability = min(1.0, (variance ** 0.5) / mean_ratio)
        
        confidence = self.calculate_confidence(sample_count, variability)
        
        recommended_stock = int(predicted_demand * self.safety_margin)
        
        if sold_out_rate > 0.3:
            recommended_stock = int(recommended_stock * 1.15)
        
        safety_stock = int(recommended_stock * 0.9)
        max_stock = int(recommended_stock * 1.3)
        min_stock = int(recommended_stock * 0.7)
        
        if meal:
            recommended_stock = max(5, min(recommended_stock, 100))
            safety_stock = max(3, min(safety_stock, 80))
            max_stock = min(max_stock, 150)
        
        risk_assessment = self.assess_risk(sell_through, sold_out_rate, sample_count)
        
        factors = {
            "historical_samples": sample_count,
            "sell_through_rate": round(sell_through, 3),
            "demand_ratio": round(demand_ratio, 3),
            "sold_out_rate": round(sold_out_rate, 3),
            "holiday_factor": holiday_factor,
            "weather_factor": weather_factor,
            "variability": round(variability, 3)
        }
        
        return PredictionResult(
            prediction_id=str(uuid.uuid4())[:8],
            train_id=train_id,
            train_number=train.train_number if train else "unknown",
            meal_id=meal_id,
            meal_name=meal.name if meal else "unknown",
            date=target_date,
            departure_time=target_time,
            predicted_demand=round(predicted_demand, 2),
            recommended_stock=recommended_stock,
            confidence_score=round(confidence, 2),
            safety_stock=safety_stock,
            max_stock=max_stock,
            min_stock=min_stock,
            historical_sell_through_rate=round(sell_through, 3),
            peak_demand_segment=peak_segment,
            risk_assessment=risk_assessment,
            factors=factors
        )
    
    def forecast_all_meals(
        self,
        train_id: str,
        target_date: date,
        target_time: time,
        expected_passengers: int,
        historical_records: List[SalesRecord],
        trains: Dict[str, TrainInfo],
        meals: Dict[str, MealItem],
        holiday: bool = False,
        weather_condition: Optional[str] = None
    ) -> List[PredictionResult]:
        
        predictions = []
        
        meal_ids = set(r.meal_id for r in historical_records)
        
        for meal_id in meal_ids:
            prediction = self.forecast_for_meal(
                train_id=train_id,
                meal_id=meal_id,
                target_date=target_date,
                target_time=target_time,
                expected_passengers=expected_passengers,
                historical_records=historical_records,
                train=trains.get(train_id),
                meal=meals.get(meal_id),
                holiday=holiday,
                weather_condition=weather_condition
            )
            if prediction:
                predictions.append(prediction)
        
        return predictions
