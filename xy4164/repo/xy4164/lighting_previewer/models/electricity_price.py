"""电价数据模型"""

from dataclasses import dataclass, field
from datetime import time
from typing import Dict, List, Optional


@dataclass
class PriceTier:
    tier_name: str
    price_per_kwh: float
    start_time: time
    end_time: time
    
    def to_dict(self) -> Dict:
        return {
            "tier_name": self.tier_name,
            "price_per_kwh": self.price_per_kwh,
            "start_time": self.start_time.strftime("%H:%M"),
            "end_time": self.end_time.strftime("%H:%M")
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "PriceTier":
        return cls(
            tier_name=data["tier_name"],
            price_per_kwh=data["price_per_kwh"],
            start_time=time.fromisoformat(data["start_time"]),
            end_time=time.fromisoformat(data["end_time"])
        )
    
    def validate(self) -> List[str]:
        errors = []
        if self.price_per_kwh < 0:
            errors.append("电价不能为负值")
        return errors
    
    def contains_hour(self, hour: int) -> bool:
        start_hour = self.start_time.hour
        end_hour = self.end_time.hour
        
        if start_hour <= end_hour:
            return start_hour <= hour < end_hour
        else:
            return hour >= start_hour or hour < end_hour
    
    @property
    def duration_hours(self) -> float:
        start_seconds = self.start_time.hour * 3600 + self.start_time.minute * 60
        end_seconds = self.end_time.hour * 3600 + self.end_time.minute * 60
        
        if end_seconds < start_seconds:
            end_seconds += 24 * 3600
        
        return (end_seconds - start_seconds) / 3600


@dataclass
class ElectricityPrice:
    price_id: str
    price_name: str
    region: str
    effective_date: str
    tiers: List[PriceTier] = field(default_factory=list)
    notes: str = ""
    custom_attributes: Dict[str, str] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "price_id": self.price_id,
            "price_name": self.price_name,
            "region": self.region,
            "effective_date": self.effective_date,
            "tiers": [t.to_dict() for t in self.tiers],
            "notes": self.notes,
            "custom_attributes": self.custom_attributes
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ElectricityPrice":
        return cls(
            price_id=data["price_id"],
            price_name=data.get("price_name", ""),
            region=data.get("region", ""),
            effective_date=data.get("effective_date", ""),
            tiers=[PriceTier.from_dict(t) for t in data.get("tiers", [])],
            notes=data.get("notes", ""),
            custom_attributes=data.get("custom_attributes", {})
        )
    
    def validate(self) -> List[str]:
        errors = []
        if not self.price_id or not self.price_id.strip():
            errors.append("电价方案ID不能为空")
        
        covered_hours = set()
        for tier in self.tiers:
            errors.extend(tier.validate())
            
            start_hour = tier.start_time.hour
            end_hour = tier.end_time.hour
            
            if start_hour <= end_hour:
                for h in range(start_hour, end_hour):
                    covered_hours.add(h)
            else:
                for h in range(start_hour, 24):
                    covered_hours.add(h)
                for h in range(0, end_hour):
                    covered_hours.add(h)
        
        for h in range(24):
            if h not in covered_hours:
                errors.append(f"小时 {h}:00 没有对应的电价时段")
        
        return errors
    
    def get_price_for_hour(self, hour: int) -> float:
        for tier in self.tiers:
            if tier.contains_hour(hour):
                return tier.price_per_kwh
        return 0.0
    
    def get_tier_for_hour(self, hour: int) -> Optional[PriceTier]:
        for tier in self.tiers:
            if tier.contains_hour(hour):
                return tier
        return None
    
    @property
    def peak_price(self) -> float:
        if not self.tiers:
            return 0.0
        return max(t.price_per_kwh for t in self.tiers)
    
    @property
    def off_peak_price(self) -> float:
        if not self.tiers:
            return 0.0
        return min(t.price_per_kwh for t in self.tiers)
    
    @property
    def average_price(self) -> float:
        if not self.tiers:
            return 0.0
        total_price = 0.0
        total_hours = 0.0
        for tier in self.tiers:
            total_price += tier.price_per_kwh * tier.duration_hours
            total_hours += tier.duration_hours
        return total_price / total_hours if total_hours > 0 else 0.0
