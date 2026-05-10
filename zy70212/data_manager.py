import json
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import pandas as pd

from config import config


@dataclass
class TrajectoryPoint:
    timestamp: datetime
    latitude: float
    longitude: float
    speed: float = 0.0
    accuracy: float = 10.0
    driver_id: str = ""
    order_id: str = ""
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class Order:
    order_id: str
    driver_id: str
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    planned_distance: float
    expected_duration: int
    pickup_time: datetime
    delivery_time: datetime
    status: str = "pending"
    assigned_vehicle: str = ""
    cargo_type: str = ""
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "pickup_time": self.pickup_time.isoformat(),
            "delivery_time": self.delivery_time.isoformat()
        }


@dataclass
class ChangeRecord:
    change_id: str
    timestamp: datetime
    action: str
    record_type: str
    record_id: str
    old_value: Optional[Dict]
    new_value: Optional[Dict]
    reason: str = ""
    
    def to_dict(self) -> Dict:
        return {
            **asdict(self),
            "timestamp": self.timestamp.isoformat()
        }


class DataManager:
    def __init__(self):
        self.trajectories: List[TrajectoryPoint] = []
        self.orders: Dict[str, Order] = {}
        self.history: List[ChangeRecord] = []
        self._load_history()
    
    def _load_history(self):
        history_file = config.HISTORY_DIR / "changes.json"
        if history_file.exists():
            try:
                with open(history_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.history = [
                        ChangeRecord(
                            change_id=item["change_id"],
                            timestamp=datetime.fromisoformat(item["timestamp"]),
                            action=item["action"],
                            record_type=item["record_type"],
                            record_id=item["record_id"],
                            old_value=item.get("old_value"),
                            new_value=item.get("new_value"),
                            reason=item.get("reason", "")
                        )
                        for item in data
                    ]
            except Exception as e:
                print(f"Warning: Failed to load history: {e}")
    
    def _save_history(self):
        history_file = config.HISTORY_DIR / "changes.json"
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump([h.to_dict() for h in self.history], f, ensure_ascii=False, indent=2)
    
    def _record_change(self, action: str, record_type: str, record_id: str, 
                       old_value: Optional[Dict], new_value: Optional[Dict], reason: str = ""):
        record = ChangeRecord(
            change_id=f"CHG_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            timestamp=datetime.now(),
            action=action,
            record_type=record_type,
            record_id=record_id,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        self.history.append(record)
        self._save_history()
    
    def import_trajectories(self, file_path: str) -> int:
        df = pd.read_csv(file_path)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        
        new_points = []
        for _, row in df.iterrows():
            point = TrajectoryPoint(
                timestamp=row["timestamp"].to_pydatetime(),
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                speed=float(row.get("speed", 0)),
                accuracy=float(row.get("accuracy", 10.0)),
                driver_id=str(row.get("driver_id", "")),
                order_id=str(row.get("order_id", ""))
            )
            new_points.append(point)
        
        self.trajectories.extend(new_points)
        self._record_change(
            action="import",
            record_type="trajectory",
            record_id=Path(file_path).name,
            old_value=None,
            new_value={"count": len(new_points)},
            reason=f"导入轨迹文件: {file_path}"
        )
        return len(new_points)
    
    def import_orders(self, file_path: str) -> int:
        df = pd.read_csv(file_path)
        df["pickup_time"] = pd.to_datetime(df["pickup_time"])
        df["delivery_time"] = pd.to_datetime(df["delivery_time"])
        
        count = 0
        for _, row in df.iterrows():
            order = Order(
                order_id=str(row["order_id"]),
                driver_id=str(row.get("driver_id", "")),
                origin_lat=float(row["origin_lat"]),
                origin_lng=float(row["origin_lng"]),
                dest_lat=float(row["dest_lat"]),
                dest_lng=float(row["dest_lng"]),
                planned_distance=float(row.get("planned_distance", 0)),
                expected_duration=int(row.get("expected_duration", 0)),
                pickup_time=row["pickup_time"].to_pydatetime(),
                delivery_time=row["delivery_time"].to_pydatetime(),
                status=str(row.get("status", "pending")),
                assigned_vehicle=str(row.get("assigned_vehicle", "")),
                cargo_type=str(row.get("cargo_type", ""))
            )
            old_value = self.orders.get(order.order_id)
            self.orders[order.order_id] = order
            self._record_change(
                action="import" if not old_value else "update",
                record_type="order",
                record_id=order.order_id,
                old_value=old_value.to_dict() if old_value else None,
                new_value=order.to_dict(),
                reason=f"导入/更新订单: {order.order_id}"
            )
            count += 1
        return count
    
    def update_order(self, order_id: str, updates: Dict, reason: str = "手动修改") -> bool:
        if order_id not in self.orders:
            return False
        
        old_value = self.orders[order_id].to_dict()
        new_order = self.orders[order_id]
        
        for key, value in updates.items():
            if hasattr(new_order, key):
                if key in ["pickup_time", "delivery_time"]:
                    value = datetime.fromisoformat(value)
                setattr(new_order, key, value)
        
        self._record_change(
            action="update",
            record_type="order",
            record_id=order_id,
            old_value=old_value,
            new_value=new_order.to_dict(),
            reason=reason
        )
        return True
    
    def delete_order(self, order_id: str, reason: str = "撤回记录") -> bool:
        if order_id not in self.orders:
            return False
        
        old_value = self.orders[order_id].to_dict()
        del self.orders[order_id]
        
        self._record_change(
            action="delete",
            record_type="order",
            record_id=order_id,
            old_value=old_value,
            new_value=None,
            reason=reason
        )
        return True
    
    def get_history(self, record_type: str = None, record_id: str = None) -> List[ChangeRecord]:
        results = self.history
        if record_type:
            results = [h for h in results if h.record_type == record_type]
        if record_id:
            results = [h for h in results if h.record_id == record_id]
        return results
    
    def get_trajectories_by_driver(self, driver_id: str, start_time: datetime = None, 
                                    end_time: datetime = None) -> List[TrajectoryPoint]:
        points = [t for t in self.trajectories if t.driver_id == driver_id]
        if start_time:
            points = [t for t in points if t.timestamp >= start_time]
        if end_time:
            points = [t for t in points if t.timestamp <= end_time]
        return sorted(points, key=lambda x: x.timestamp)
    
    def get_order(self, order_id: str) -> Optional[Order]:
        return self.orders.get(order_id)
    
    def get_all_orders(self) -> List[Order]:
        return list(self.orders.values())
