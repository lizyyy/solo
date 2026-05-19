from typing import List, Optional
from dataclasses import asdict

from app.models.database import db, Forklift, ChargingStation, Driver


class ResourceService:
    def __init__(self):
        self.db = db
    
    def get_forklifts(self, status: Optional[str] = None) -> List[dict]:
        forklifts = list(self.db.forklifts.values())
        if status:
            forklifts = [f for f in forklifts if f.status == status]
        return [asdict(f) for f in forklifts]
    
    def get_forklift(self, forklift_id: str) -> Optional[dict]:
        forklift = self.db.forklifts.get(forklift_id)
        return asdict(forklift) if forklift else None
    
    def update_forklift_battery(self, forklift_id: str, battery_level: float) -> dict:
        if forklift_id not in self.db.forklifts:
            raise ValueError("叉车不存在")
        if battery_level < 0 or battery_level > 100:
            raise ValueError("电量必须在0-100之间")
        
        forklift = self.db.forklifts[forklift_id]
        forklift.battery_level = battery_level
        
        if battery_level < 20:
            forklift.status = "low_battery"
        
        return asdict(forklift)
    
    def get_charging_stations(self, status: Optional[str] = None) -> List[dict]:
        stations = list(self.db.charging_stations.values())
        if status:
            stations = [s for s in stations if s.status == status]
        return [asdict(s) for s in stations]
    
    def get_charging_station(self, station_id: str) -> Optional[dict]:
        station = self.db.charging_stations.get(station_id)
        return asdict(station) if station else None
    
    def start_charging(self, station_id: str, forklift_id: str) -> dict:
        if station_id not in self.db.charging_stations:
            raise ValueError("充电桩不存在")
        if forklift_id not in self.db.forklifts:
            raise ValueError("叉车不存在")
        
        station = self.db.charging_stations[station_id]
        if station.status == "charging":
            raise ValueError("充电桩正在使用中")
        
        forklift = self.db.forklifts[forklift_id]
        if forklift.battery_level >= 100:
            raise ValueError("叉车电量已满")
        
        station.status = "charging"
        station.current_forklift = forklift_id
        from datetime import datetime
        station.charging_start_time = datetime.now()
        
        return asdict(station)
    
    def stop_charging(self, station_id: str) -> dict:
        if station_id not in self.db.charging_stations:
            raise ValueError("充电桩不存在")
        
        station = self.db.charging_stations[station_id]
        if station.status != "charging" or not station.current_forklift:
            raise ValueError("充电桩未在充电")
        
        forklift = self.db.forklifts[station.current_forklift]
        charging_duration = 60
        forklift.battery_level = min(100, forklift.battery_level + charging_duration * 0.5)
        
        station.status = "available"
        station.current_forklift = None
        station.charging_start_time = None
        
        return asdict(forklift)
    
    def get_drivers(self, status: Optional[str] = None) -> List[dict]:
        drivers = list(self.db.drivers.values())
        if status:
            drivers = [d for d in drivers if d.status == status]
        return [asdict(d) for d in drivers]
    
    def get_driver(self, driver_id: str) -> Optional[dict]:
        driver = self.db.drivers.get(driver_id)
        return asdict(driver) if driver else None


resource_service = ResourceService()
