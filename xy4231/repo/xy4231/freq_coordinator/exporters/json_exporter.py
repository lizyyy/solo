import json
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

from freq_coordinator.models import (
    CommunicationPlan,
    RiskItem,
    ScheduleEntry,
    SupplyStation,
    RepeaterStation,
    VolunteerShift,
    Device,
    AssignedChannel,
)


class JSONExporter:
    def __init__(self, plan: CommunicationPlan):
        self.plan = plan
    
    def export_audit_package(self, output_path: str) -> str:
        package = self._generate_audit_package()
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, "w", encoding="utf-8") as f:
            json.dump(package, f, ensure_ascii=False, indent=2, default=self._json_default)
        
        return output_path
    
    def export(self, output_path: str = None) -> str:
        return self.export_audit_package(output_path)
    
    def _generate_audit_package(self) -> Dict[str, Any]:
        return {
            "metadata": {
                "generated_at": datetime.now(),
                "version": "1.0",
                "event_name": self.plan.event_name,
                "schema_version": "2024-01",
            },
            "input_data": {
                "supply_stations": [
                    self._supply_station_to_dict(s) for s in self.plan.supply_stations
                ],
                "repeater_stations": [
                    self._repeater_station_to_dict(r) for r in self.plan.repeater_stations
                ],
                "volunteer_shifts": [
                    self._volunteer_shift_to_dict(s) for s in self.plan.volunteer_shifts
                ],
                "devices": [
                    self._device_to_dict(d) for d in self.plan.devices
                ],
            },
            "output_plan": {
                "schedule": [
                    self._schedule_entry_to_dict(e) for e in self.plan.schedule
                ],
                "channel_plan": {
                    station_id: [self._assigned_channel_to_dict(ch) for ch in channels]
                    for station_id, channels in self.plan.channel_plan.items()
                },
            },
            "risk_assessment": {
                "summary": self._get_risk_summary(),
                "risks": [
                    self._risk_item_to_dict(r) for r in self.plan.risks
                ],
            },
            "audit_trail": {
                "checks_performed": [
                    "coverage_gap_detection",
                    "frequency_conflict_detection",
                    "handover_gap_detection",
                    "battery_risk_detection",
                ],
                "rules_applied": {
                    "min_frequency_step_khz": 25.0,
                    "min_handover_minutes": 10,
                    "battery_safety_margin_hours": 1.0,
                },
            },
        }
    
    def _get_risk_summary(self) -> Dict[str, Any]:
        summary = {
            "total": len(self.plan.risks),
            "by_severity": {
                "critical": 0,
                "high": 0,
                "medium": 0,
                "low": 0,
            },
            "by_type": {
                "coverage_gap": 0,
                "frequency_conflict": 0,
                "handover_gap": 0,
                "battery_risk": 0,
            },
        }
        
        for risk in self.plan.risks:
            if risk.severity in summary["by_severity"]:
                summary["by_severity"][risk.severity] += 1
            if risk.type in summary["by_type"]:
                summary["by_type"][risk.type] += 1
        
        return summary
    
    def _supply_station_to_dict(self, station: SupplyStation) -> Dict[str, Any]:
        return {
            "id": station.id,
            "name": station.name,
            "latitude": station.latitude,
            "longitude": station.longitude,
            "distance_from_start_km": station.distance_from_start,
            "elevation_m": station.elevation,
            "criticality": station.criticality,
            "required_coverage": station.required_coverage,
            "contact_person": station.contact_person,
        }
    
    def _repeater_station_to_dict(self, repeater: RepeaterStation) -> Dict[str, Any]:
        return {
            "id": repeater.id,
            "name": repeater.name,
            "latitude": repeater.latitude,
            "longitude": repeater.longitude,
            "elevation_m": repeater.elevation,
            "tx_frequency_mhz": repeater.tx_frequency,
            "rx_frequency_mhz": repeater.rx_frequency,
            "power_w": repeater.power,
            "antenna_gain_dbi": repeater.antenna_gain,
            "coverage_radius_km": repeater.coverage_radius_km,
            "height_agl_m": repeater.height_agl,
            "coverage_polygon": repeater.coverage_polygon,
        }
    
    def _volunteer_shift_to_dict(self, shift: VolunteerShift) -> Dict[str, Any]:
        return {
            "id": shift.id,
            "volunteer_name": shift.volunteer_name,
            "volunteer_id": shift.volunteer_id,
            "station_id": shift.station_id,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
            "duration_hours": shift.duration.total_seconds() / 3600,
            "role": shift.role,
            "skills": shift.skills,
            "phone": shift.phone,
            "assigned_device": shift.assigned_device,
        }
    
    def _device_to_dict(self, device: Device) -> Dict[str, Any]:
        return {
            "id": device.id,
            "type": device.type,
            "model": device.model,
            "status": device.status,
            "battery_capacity_mah": device.battery_capacity_mah,
            "current_charge_percent": device.current_charge_percent,
            "power_consumption_ma": device.power_consumption_ma,
            "standby_current_ma": device.standby_current_ma,
            "estimated_runtime_hours": device.estimated_runtime_hours,
            "estimated_standby_hours": device.estimated_standby_hours,
            "frequencies_supported": device.frequencies,
            "assigned_to": device.assigned_to,
            "last_charged": device.last_charged,
        }
    
    def _schedule_entry_to_dict(self, entry: ScheduleEntry) -> Dict[str, Any]:
        return {
            "shift_id": entry.shift_id,
            "volunteer_name": entry.volunteer_name,
            "station_id": entry.station_id,
            "station_name": entry.station_name,
            "start_time": entry.start_time,
            "end_time": entry.end_time,
            "device_id": entry.device_id,
            "assigned_channels": [
                self._assigned_channel_to_dict(ch) for ch in entry.assigned_channels
            ],
        }
    
    def _assigned_channel_to_dict(self, channel: AssignedChannel) -> Dict[str, Any]:
        return {
            "frequency_mhz": channel.frequency,
            "channel_number": channel.channel_number,
            "station_id": channel.station_id,
            "shift_id": channel.shift_id,
            "is_repeater": channel.is_repeater,
            "repeater_id": channel.repeater_id,
            "purpose": channel.purpose,
            "priority": channel.priority,
        }
    
    def _risk_item_to_dict(self, risk: RiskItem) -> Dict[str, Any]:
        return {
            "id": risk.id,
            "type": risk.type,
            "severity": risk.severity,
            "title": risk.title,
            "description": risk.description,
            "affected_entities": risk.affected_entities,
            "location": risk.location,
            "time_window": {
                "start": risk.time_window.get("start") if risk.time_window else None,
                "end": risk.time_window.get("end") if risk.time_window else None,
            } if risk.time_window else None,
            "recommendation": risk.recommendation,
            "confidence": risk.confidence,
        }
    
    def _json_default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")
