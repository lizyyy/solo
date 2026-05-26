import csv
import io
import json
from typing import List, Dict, Any
from datetime import datetime


def parse_job_csv(content: str) -> List[Dict[str, Any]]:
    jobs = []
    reader = csv.DictReader(io.StringIO(content))
    for row in reader:
        job = {
            "job_no": row.get("job_no", "").strip(),
            "site_name": row.get("site_name", "").strip(),
            "area_ha": float(row.get("area_ha", 0)) if row.get("area_ha") else 0.0,
            "target_pest": row.get("target_pest", "").strip(),
            "description": row.get("description", "").strip(),
        }
        if job["job_no"]:
            jobs.append(job)
    return jobs


def parse_chemical_json(content: str) -> List[Dict[str, Any]]:
    data = json.loads(content)
    if isinstance(data, dict):
        data = [data]
    chemicals = []
    for item in data:
        chem = {
            "name": item.get("name", "").strip(),
            "batch_no": item.get("batch_no", "").strip(),
            "manufacturer": item.get("manufacturer", "").strip(),
            "active_ingredient": item.get("active_ingredient", "").strip(),
            "concentration": float(item.get("concentration", 0)) if item.get("concentration") else None,
            "max_dosage_per_ha": float(item.get("max_dosage_per_ha", 0)),
            "safety_interval_hours": int(item.get("safety_interval_hours", 24)),
            "min_wind_speed": float(item.get("min_wind_speed", 0.0)),
            "max_wind_speed": float(item.get("max_wind_speed", 10.0)),
        }
        if chem["name"] and chem["batch_no"]:
            chemicals.append(chem)
    return chemicals


def parse_weather_json(content: str) -> List[Dict[str, Any]]:
    data = json.loads(content)
    if isinstance(data, dict):
        data = [data]
    records = []
    for item in data:
        record_time = item.get("record_time")
        if isinstance(record_time, str):
            try:
                record_time = datetime.fromisoformat(record_time)
            except ValueError:
                record_time = datetime.utcnow()

        window_start = item.get("weather_window_start")
        if isinstance(window_start, str):
            try:
                window_start = datetime.fromisoformat(window_start)
            except ValueError:
                window_start = None

        window_end = item.get("weather_window_end")
        if isinstance(window_end, str):
            try:
                window_end = datetime.fromisoformat(window_end)
            except ValueError:
                window_end = None

        record = {
            "record_time": record_time,
            "location": item.get("location", "").strip(),
            "wind_speed": float(item.get("wind_speed", 0)) if item.get("wind_speed") else None,
            "wind_direction": item.get("wind_direction", "").strip(),
            "temperature": float(item.get("temperature", 0)) if item.get("temperature") else None,
            "humidity": float(item.get("humidity", 0)) if item.get("humidity") else None,
            "rainfall": float(item.get("rainfall", 0)),
            "weather_window_start": window_start,
            "weather_window_end": window_end,
        }
        if record["location"]:
            records.append(record)
    return records
