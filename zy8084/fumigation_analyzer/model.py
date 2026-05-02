"""
Decay and ventilation models for fumigation analysis.
Implements first-order decay model for PH3 concentration and ventilation coverage calculation.
Handles cross-midnight timeline construction.
"""

from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo


class DecayModel:
    FIRST_ORDER_K = 0.023

    def __init__(self, warehouses: list[dict], sensor_data: list[dict], timezone: str = "Asia/Shanghai"):
        self.warehouses = {w["warehouse_id"]: w for w in warehouses}
        self.sensor_data = sensor_data
        self.tz = ZoneInfo(timezone)

    def build_timeline(self) -> list[dict[str, Any]]:
        events = []

        for record in self.sensor_data:
            wh_id = record["warehouse_id"]
            wh = self.warehouses.get(wh_id)
            if not wh:
                continue

            ts = self._parse_timestamp(record["timestamp"])
            events.append({
                "timestamp": ts,
                "warehouse_id": wh_id,
                "sensor_id": record["sensor_id"],
                "event_type": "sensor_reading",
                "concentration_ppm": record["concentration_ppm"],
                "decay_rate": self._calc_decay_rate(
                    record["concentration_ppm"],
                    wh["volume_m3"],
                    wh["ventilation_rate"]
                ),
                "predicted_next": None,
            })

        events.sort(key=lambda e: e["timestamp"])

        for i in range(len(events) - 1):
            events[i]["predicted_next"] = events[i + 1]["concentration_ppm"]

        return events

    def _calc_decay_rate(self, concentration: float, volume_m3: float, vent_rate: float) -> float:
        if vent_rate <= 0 or concentration <= 0:
            return 0.0
        air_changes_per_hour = vent_rate / volume_m3
        k = self.FIRST_ORDER_K + (air_changes_per_hour * 0.1)
        return k * concentration

    def _parse_timestamp(self, ts: str) -> datetime:
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"]:
            try:
                return datetime.strptime(ts, fmt).replace(tzinfo=self.tz)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间戳: {ts}")


class VentilationModel:
    def __init__(self, vent_records: list[dict], timezone: str = "Asia/Shanghai"):
        self.vent_records = vent_records
        self.tz = ZoneInfo(timezone)

    def annotate_timeline(self, timeline: list[dict[str, Any]]):
        for event in timeline:
            wh_id = event.get("warehouse_id")
            ts = event.get("timestamp")
            if not wh_id or not ts:
                continue

            active_vents = []
            total_flow = 0.0

            for record in self.vent_records:
                if record["warehouse_id"] != wh_id:
                    continue

                start = self._parse_time(record["start_time"])
                end = self._parse_time(record["end_time"])

                if start <= ts <= end:
                    active_vents.append(record["vent_id"])
                    total_flow += record["flow_rate_m3h"]

            event["ventilation_active"] = len(active_vents) > 0
            event["active_vents"] = active_vents
            event["total_vent_flow_m3h"] = total_flow

            wh = None
            for w in [event]:
                pass

    def _parse_time(self, t: str) -> datetime:
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"]:
            try:
                return datetime.strptime(t, fmt).replace(tzinfo=self.tz)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间: {t}")
