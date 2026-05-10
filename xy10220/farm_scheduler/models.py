from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import date, time
import json


@dataclass
class Plot:
    plot_id: str
    village: str
    area: float
    crop_type: str
    ripening_start: date
    ripening_end: date
    priority: int = 1
    
    def to_dict(self):
        d = asdict(self)
        d['ripening_start'] = self.ripening_start.isoformat()
        d['ripening_end'] = self.ripening_end.isoformat()
        return d
    
    @classmethod
    def from_dict(cls, d):
        return cls(
            plot_id=d['plot_id'],
            village=d['village'],
            area=d['area'],
            crop_type=d['crop_type'],
            ripening_start=date.fromisoformat(d['ripening_start']),
            ripening_end=date.fromisoformat(d['ripening_end']),
            priority=d.get('priority', 1)
        )


@dataclass
class MaintenanceWindow:
    start_date: date
    end_date: date
    reason: str = "例行维护"
    
    def to_dict(self):
        return {
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'reason': self.reason
        }
    
    @classmethod
    def from_dict(cls, d):
        return cls(
            start_date=date.fromisoformat(d['start_date']),
            end_date=date.fromisoformat(d['end_date']),
            reason=d.get('reason', '例行维护')
        )


@dataclass
class DriverRestRule:
    max_daily_hours: float = 8.0
    rest_between_trips_minutes: int = 30
    
    def to_dict(self):
        return asdict(self)
    
    @classmethod
    def from_dict(cls, d):
        return cls(**d)


@dataclass
class Harvester:
    harvester_id: str
    model: str
    driver_name: str
    efficiency_ha_per_day: float
    maintenance_windows: List[MaintenanceWindow] = field(default_factory=list)
    rest_rule: DriverRestRule = field(default_factory=DriverRestRule)
    
    def to_dict(self):
        return {
            'harvester_id': self.harvester_id,
            'model': self.model,
            'driver_name': self.driver_name,
            'efficiency_ha_per_day': self.efficiency_ha_per_day,
            'maintenance_windows': [mw.to_dict() for mw in self.maintenance_windows],
            'rest_rule': self.rest_rule.to_dict()
        }
    
    @classmethod
    def from_dict(cls, d):
        return cls(
            harvester_id=d['harvester_id'],
            model=d['model'],
            driver_name=d['driver_name'],
            efficiency_ha_per_day=d['efficiency_ha_per_day'],
            maintenance_windows=[MaintenanceWindow.from_dict(mw) for mw in d.get('maintenance_windows', [])],
            rest_rule=DriverRestRule.from_dict(d.get('rest_rule', {}))
        )


@dataclass
class Schedule:
    schedule_id: str
    plot_id: str
    harvester_id: str
    scheduled_date: date
    start_time: time
    end_time: time
    status: str = "pending"
    
    def to_dict(self):
        return {
            'schedule_id': self.schedule_id,
            'plot_id': self.plot_id,
            'harvester_id': self.harvester_id,
            'scheduled_date': self.scheduled_date.isoformat(),
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat(),
            'status': self.status
        }
    
    @classmethod
    def from_dict(cls, d):
        return cls(
            schedule_id=d['schedule_id'],
            plot_id=d['plot_id'],
            harvester_id=d['harvester_id'],
            scheduled_date=date.fromisoformat(d['scheduled_date']),
            start_time=time.fromisoformat(d['start_time']),
            end_time=time.fromisoformat(d['end_time']),
            status=d.get('status', 'pending')
        )
