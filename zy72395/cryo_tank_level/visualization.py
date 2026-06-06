from typing import List, Dict, Any, Optional
from .models import LevelConversionRecord, Sensor, InspectionNote, SafetyThreshold
from .core import CryoTankLevelSystem


class VisualizationService:
    def __init__(self, system: CryoTankLevelSystem):
        self.system = system

    def generate_chart_data(self, tank_name: Optional[str] = None) -> Dict[str, Any]:
        records = self.system.storage.get_all_level_records()
        if tank_name:
            filtered = []
            for r in records:
                sensor = self.system.storage.get_sensor(r.sensor_id)
                if sensor and sensor.tank_name == tank_name:
                    filtered.append(r)
            records = filtered

        chart_points = []
        for record in records:
            note = self.system.storage.get_inspection_note(record.original_note_id)
            sensor = self.system.storage.get_sensor(record.sensor_id)
            threshold = None
            if record.threshold_id:
                threshold = self.system.storage.get_safety_threshold(record.threshold_id)

            point = {
                "record_id": record.record_id,
                "sensor_id": record.sensor_id,
                "sensor_location": sensor.physical_location if sensor else "未知位置",
                "tank_name": sensor.tank_name if sensor else "未知罐区",
                "raw_level": record.raw_level,
                "converted_level": record.converted_level,
                "recorded_at": note.recorded_at.isoformat() if note else None,
                "status": record.status.value,
                "is_pending_review": record.status.value == "pending_review",
                "drilldown_target": {
                    "type": "note",
                    "note_id": record.original_note_id,
                    "threshold_id": record.threshold_id,
                },
            }
            chart_points.append(point)

        chart_points.sort(key=lambda x: x["recorded_at"] or "")

        threshold = None
        if tank_name:
            threshold = self.system.storage.get_threshold_by_tank(tank_name)

        return {
            "chart_type": "液位趋势图",
            "tank_name": tank_name or "全部罐区",
            "data_points": chart_points,
            "threshold_reference": threshold.to_dict() if threshold else None,
            "y_axis_label": "液位 (%)",
            "x_axis_label": "记录时间",
            "warning_zones": self._get_warning_zones(threshold),
        }

    def generate_3d_view_data(self) -> Dict[str, Any]:
        sensors = self.system.storage.get_all_sensors()
        tanks = {}

        for sensor in sensors:
            if sensor.tank_name not in tanks:
                tanks[sensor.tank_name] = {
                    "tank_name": sensor.tank_name,
                    "sensors": [],
                    "threshold": None,
                }
            threshold = self.system.storage.get_threshold_by_tank(sensor.tank_name)
            tanks[sensor.tank_name]["threshold"] = threshold.to_dict() if threshold else None

            latest_record = None
            records = self.system.storage.get_level_records_by_sensor(sensor.sensor_id)
            if records:
                latest_record = records[-1]

            sensor_info = {
                "sensor_id": sensor.sensor_id,
                "physical_location": sensor.physical_location,
                "is_active": sensor.is_active,
                "current_level": latest_record.converted_level if latest_record else None,
                "status": latest_record.status.value if latest_record else "no_data",
                "latest_record_id": latest_record.record_id if latest_record else None,
                "is_pending_review": latest_record.status.value == "pending_review" if latest_record else False,
                "drilldown_target": {
                    "type": "sensor",
                    "sensor_id": sensor.sensor_id,
                    "threshold_id": threshold.threshold_id if threshold else None,
                },
            }
            tanks[sensor.tank_name]["sensors"].append(sensor_info)

        return {
            "view_type": "3D罐区总览",
            "tanks": list(tanks.values()),
            "total_sensors": len(sensors),
            "pending_review_count": sum(
                1 for t in tanks.values()
                for s in t["sensors"]
                if s["is_pending_review"]
            ),
        }

    def drilldown(self, target_type: str, target_id: str) -> Dict[str, Any]:
        if target_type == "note":
            return self._drilldown_to_note(target_id)
        elif target_type == "sensor":
            return self._drilldown_to_sensor(target_id)
        elif target_type == "threshold":
            return self._drilldown_to_threshold(target_id)
        elif target_type == "record":
            return self.system.get_record_with_context(target_id)
        return {}

    def _drilldown_to_note(self, note_id: str) -> Dict[str, Any]:
        note = self.system.storage.get_inspection_note(note_id)
        if not note:
            return {"found": False, "message": "找不到该巡检备注"}

        record = None
        for r in self.system.storage.get_all_level_records():
            if r.original_note_id == note_id:
                record = r
                break

        sensor = self.system.storage.get_sensor(note.sensor_id)
        threshold = None
        if sensor:
            threshold = self.system.storage.get_threshold_by_tank(sensor.tank_name)

        note_history = self.system.storage.get_history_for_record(note_id)

        return {
            "found": True,
            "source_type": "手写巡检备注",
            "note": note.to_dict(),
            "sensor": sensor.to_dict() if sensor else None,
            "tank_name": sensor.tank_name if sensor else "未知罐区",
            "related_record": record.to_dict() if record else None,
            "related_threshold": threshold.to_dict() if threshold else None,
            "change_history": [h.to_dict() for h in note_history],
            "handwritten_content": note.handwritten_note,
            "recorded_at": note.recorded_at.isoformat(),
            "imported_by": note.imported_by,
        }

    def _drilldown_to_sensor(self, sensor_id: str) -> Dict[str, Any]:
        sensor = self.system.storage.get_sensor(sensor_id)
        if not sensor:
            return {"found": False, "message": "找不到该传感器"}

        records = self.system.storage.get_level_records_by_sensor(sensor_id)
        threshold = self.system.storage.get_threshold_by_tank(sensor.tank_name)

        pending_mappings = []
        for m in self.system.storage.get_sensor_mappings_pending():
            if m.new_sensor_id == sensor_id or m.old_sensor_id == sensor_id:
                pending_mappings.append(m.to_dict())

        return {
            "found": True,
            "source_type": "传感器详情",
            "sensor": sensor.to_dict(),
            "tank_name": sensor.tank_name,
            "threshold": threshold.to_dict() if threshold else None,
            "recent_records": [r.to_dict() for r in records[-10:]],
            "record_count": len(records),
            "pending_mappings": pending_mappings,
            "has_id_change_issue": len(pending_mappings) > 0,
        }

    def _drilldown_to_threshold(self, threshold_id: str) -> Dict[str, Any]:
        threshold = self.system.storage.get_safety_threshold(threshold_id)
        if not threshold:
            return {"found": False, "message": "找不到该安全阈值表"}

        return {
            "found": True,
            "source_type": "安全阈值表",
            "threshold": threshold.to_dict(),
            "tank_name": threshold.tank_name,
            "safe_range": f"{threshold.min_safe_level}% - {threshold.max_safe_level}%",
            "warning_range": f"{threshold.warning_low}% - {threshold.warning_high}%",
            "version": threshold.version,
        }

    def _get_warning_zones(self, threshold: Optional[SafetyThreshold]) -> List[Dict[str, Any]]:
        if not threshold:
            return []
        return [
            {
                "zone": "高风险区（过高）",
                "start": threshold.warning_high,
                "end": 100,
                "color": "#ff4444",
            },
            {
                "zone": "高风险区（过低）",
                "start": 0,
                "end": threshold.warning_low,
                "color": "#ff4444",
            },
            {
                "zone": "安全区",
                "start": threshold.min_safe_level,
                "end": threshold.max_safe_level,
                "color": "#44ff44",
            },
        ]
