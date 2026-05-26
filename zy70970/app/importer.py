import io
import csv
import json
from datetime import datetime, date
from typing import List, Dict, Any
import pandas as pd

from .models import Pesticide, WeatherRecord, SprayJob
from .store import store


class DataImporter:
    @staticmethod
    def import_pesticides_from_json(json_content: str) -> List[Pesticide]:
        data = json.loads(json_content)
        pesticides = []
        for item in data:
            pesticide = Pesticide(
                id=item["id"],
                name=item["name"],
                stock_quantity=float(item["stock_quantity"]),
                max_dosage_per_hectare=float(item["max_dosage_per_hectare"]),
                safety_interval_days=int(item["safety_interval_days"]),
                max_wind_speed=float(item["max_wind_speed"]),
                unit=item.get("unit", "L")
            )
            pesticides.append(pesticide)
        store.add_pesticides(pesticides)
        return pesticides

    @staticmethod
    def import_pesticides_from_file(file_path: str) -> List[Pesticide]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return DataImporter.import_pesticides_from_json(f.read())

    @staticmethod
    def import_weather_from_csv(csv_content: str) -> List[WeatherRecord]:
        records = []
        reader = csv.DictReader(io.StringIO(csv_content))
        for idx, row in enumerate(reader):
            record = WeatherRecord(
                id=f"weather_{idx}",
                date=datetime.strptime(row["date"], "%Y-%m-%d").date(),
                area=row["area"],
                wind_speed=float(row["wind_speed"]),
                temperature=float(row["temperature"]),
                humidity=float(row["humidity"]),
                rainfall=float(row["rainfall"])
            )
            records.append(record)
        store.add_weather_records(records)
        return records

    @staticmethod
    def import_weather_from_file(file_path: str) -> List[WeatherRecord]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return DataImporter.import_weather_from_csv(f.read())

    @staticmethod
    def import_jobs_from_csv(csv_content: str) -> List[SprayJob]:
        jobs = []
        reader = csv.DictReader(io.StringIO(csv_content))
        for idx, row in enumerate(reader):
            last_spray_date = None
            if row.get("last_spray_date") and row["last_spray_date"].strip():
                try:
                    last_spray_date = datetime.strptime(row["last_spray_date"], "%Y-%m-%d").date()
                except ValueError:
                    pass

            job = SprayJob(
                id=f"job_{idx}",
                job_date=datetime.strptime(row["job_date"], "%Y-%m-%d").date(),
                area=row["area"],
                area_size_hectares=float(row["area_size_hectares"]),
                pesticide_id=row["pesticide_id"],
                pesticide_name=row.get("pesticide_name", ""),
                dosage_used=float(row["dosage_used"]),
                operator=row["operator"],
                notes=row.get("notes", ""),
                last_spray_date=last_spray_date
            )
            jobs.append(job)
        store.add_spray_jobs(jobs)
        return jobs

    @staticmethod
    def import_jobs_from_file(file_path: str) -> List[SprayJob]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return DataImporter.import_jobs_from_csv(f.read())

    @staticmethod
    def import_jobs_from_dataframe(df: pd.DataFrame) -> List[SprayJob]:
        jobs = []
        for idx, row in df.iterrows():
            last_spray_date = None
            if pd.notna(row.get("last_spray_date")):
                last_spray_date = row["last_spray_date"]
                if isinstance(last_spray_date, datetime):
                    last_spray_date = last_spray_date.date()

            job = SprayJob(
                id=f"job_{idx}",
                job_date=row["job_date"].date() if isinstance(row["job_date"], datetime) else row["job_date"],
                area=row["area"],
                area_size_hectares=float(row["area_size_hectares"]),
                pesticide_id=row["pesticide_id"],
                pesticide_name=row.get("pesticide_name", ""),
                dosage_used=float(row["dosage_used"]),
                operator=row["operator"],
                notes=str(row.get("notes", "")),
                last_spray_date=last_spray_date
            )
            jobs.append(job)
        store.add_spray_jobs(jobs)
        return jobs
