from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import Forklift, BatteryStatus, ChargingStation, Task
from app.schemas.schemas import BatteryPredictionResponse

class BatteryService:
    def __init__(self, db: Session):
        self.db = db

    def predict_charging_time(
        self,
        forklift_code: str,
        current_percent: float,
        target_percent: float,
        station_code: str = None
    ) -> BatteryPredictionResponse:
        forklift = self.db.query(Forklift).filter(
            Forklift.forklift_code == forklift_code,
            Forklift.is_deleted == False
        ).first()

        if not forklift:
            raise ValueError(f"叉车 {forklift_code} 不存在")

        if current_percent >= target_percent:
            raise ValueError("当前电量已达到或超过目标电量")

        station = None
        if station_code:
            station = self.db.query(ChargingStation).filter(
                ChargingStation.station_code == station_code
            ).first()
            if not station:
                raise ValueError(f"充电位 {station_code} 不存在")

        percent_to_charge = target_percent - current_percent
        energy_required = (forklift.battery_capacity * percent_to_charge) / 100

        charging_rate = station.charging_power if station else forklift.charging_rate
        charging_hours = energy_required / charging_rate

        estimated_completion = datetime.utcnow() + timedelta(hours=charging_hours)

        battery_status = self.db.query(BatteryStatus).filter(
            BatteryStatus.forklift_id == forklift.id
        ).first()

        validation_details = {
            "forklift_found": True,
            "forklift_status": forklift.status.value,
            "battery_capacity_matches": True,
            "current_percent_matches": None,
            "target_percent_valid": target_percent <= forklift.max_battery_percent,
            "station_found": station is not None if station_code else True
        }

        if battery_status:
            validation_details["current_percent_matches"] = abs(
                battery_status.current_percent - current_percent
            ) < 0.1
            validation_details["battery_health_ok"] = battery_status.health_percent >= 80

        validation_result = "PASS" if all([
            validation_details["forklift_found"],
            validation_details["target_percent_valid"],
            validation_details["station_found"]
        ]) else "NEEDS_REVIEW"

        return BatteryPredictionResponse(
            forklift_code=forklift_code,
            current_percent=current_percent,
            target_percent=target_percent,
            estimated_charging_hours=round(charging_hours, 2),
            estimated_completion_time=estimated_completion,
            charging_rate_kwh=charging_rate,
            energy_required_kwh=round(energy_required, 2),
            validation_result=validation_result,
            validation_details=validation_details
        )

    def check_task_battery_requirement(
        self,
        forklift_id: int,
        task_required_percent: float
    ) -> dict:
        forklift = self.db.query(Forklift).filter(Forklift.id == forklift_id).first()
        if not forklift:
            raise ValueError("叉车不存在")

        battery_status = self.db.query(BatteryStatus).filter(
            BatteryStatus.forklift_id == forklift_id
        ).first()

        if not battery_status:
            raise ValueError("未找到电池状态记录")

        current_percent = battery_status.current_percent
        deficit = max(0, task_required_percent - current_percent)

        return {
            "forklift_id": forklift_id,
            "forklift_code": forklift.forklift_code,
            "current_battery_percent": current_percent,
            "task_required_percent": task_required_percent,
            "has_sufficient_battery": current_percent >= task_required_percent,
            "deficit_percent": deficit,
            "needs_charging": deficit > 0,
            "min_operating_violation": current_percent < forklift.min_operating_percent
        }
