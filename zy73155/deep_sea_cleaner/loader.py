import csv
import os
import uuid
from typing import List
from .models import RawSampleRecord


def load_from_csv(file_path: str) -> List[RawSampleRecord]:
    records = []
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            rec_id = row.get("record_id") or f"rec_{uuid.uuid4().hex[:8]}"
            temp_val = None
            if row.get("temperature"):
                try:
                    temp_val = float(row["temperature"])
                except (ValueError, TypeError):
                    temp_val = None

            sal_val = None
            if row.get("salinity"):
                try:
                    sal_val = float(row["salinity"])
                except (ValueError, TypeError):
                    sal_val = None

            depth_val = None
            if row.get("depth_m"):
                try:
                    depth_val = float(row["depth_m"])
                except (ValueError, TypeError):
                    depth_val = None

            records.append(RawSampleRecord(
                record_id=rec_id,
                station=row.get("station", ""),
                bottle_id=row.get("bottle_id", ""),
                depth_m=depth_val,
                depth_raw=row.get("depth_raw"),
                temperature=temp_val,
                temperature_unit=row.get("temperature_unit") or "°C",
                salinity=sal_val,
                salinity_unit=row.get("salinity_unit") or "PSU",
                latitude_raw=row.get("latitude"),
                longitude_raw=row.get("longitude"),
                sample_time=row.get("sample_time"),
                notes=row.get("notes"),
                raw_data=dict(row),
            ))
    return records


def list_sample_packs(samples_dir: str = "samples") -> List[str]:
    if not os.path.exists(samples_dir):
        return []
    return sorted([
        f for f in os.listdir(samples_dir)
        if f.endswith(".csv")
    ])
