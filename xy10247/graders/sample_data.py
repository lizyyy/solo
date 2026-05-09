import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

from graders.config import DATA_DIR
from graders.models import Sample


def generate_sample_data() -> List[Sample]:
    base_time = datetime(2026, 5, 10, 10, 0, 0)
    samples = [
        Sample(
            sample_id="WH20260510001",
            leaf_area_cm2=45.0,
            lesion_area_cm2=1.2,
            lesion_color="黄色",
            collected_at=(base_time - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH001",
            field_id="FIELD_A",
            metadata={"position": "上部", "weather": "晴朗"}
        ),
        Sample(
            sample_id="WH20260510002",
            leaf_area_cm2=52.0,
            lesion_area_cm2=4.5,
            lesion_color="黄褐色",
            collected_at=(base_time - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH001",
            field_id="FIELD_A",
            metadata={"position": "中部", "weather": "多云"}
        ),
        Sample(
            sample_id="WH20260510003",
            leaf_area_cm2=38.0,
            lesion_area_cm2=8.2,
            lesion_color="褐色",
            collected_at=(base_time - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH002",
            field_id="FIELD_B",
            metadata={"position": "下部", "weather": "阴天"}
        ),
        Sample(
            sample_id="WH20260510004",
            leaf_area_cm2=60.0,
            lesion_area_cm2=2.5,
            lesion_color="浅褐色",
            collected_at=(base_time - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH002",
            field_id="FIELD_B",
            metadata={"position": "上部", "weather": "晴朗"}
        ),
        Sample(
            sample_id="WH20260510005",
            leaf_area_cm2=48.0,
            lesion_area_cm2=18.5,
            lesion_color="褐色",
            collected_at=(base_time - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH003",
            field_id="FIELD_C",
            metadata={"position": "中部", "weather": "小雨"}
        ),
        Sample(
            sample_id="WH20260510006",
            leaf_area_cm2=55.0,
            lesion_area_cm2=0.8,
            lesion_color="枯黄",
            collected_at=(base_time - timedelta(hours=7)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH003",
            field_id="FIELD_C",
            metadata={"position": "下部", "weather": "多云"}
        ),
        Sample(
            sample_id="WH20260510007",
            leaf_area_cm2=42.0,
            lesion_area_cm2=6.8,
            lesion_color="黄褐色",
            collected_at=(base_time - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH001",
            field_id="FIELD_A",
            metadata={"position": "中部", "weather": "晴朗"}
        ),
        Sample(
            sample_id="WH20260510008",
            leaf_area_cm2=50.0,
            lesion_area_cm2=16.0,
            lesion_color="褐色",
            collected_at=(base_time - timedelta(hours=9)).strftime("%Y-%m-%d %H:%M:%S"),
            technician_id="TECH002",
            field_id="FIELD_B",
            metadata={"position": "下部", "weather": "阴天"}
        ),
    ]
    return samples


def save_sample_data_to_csv(samples: List[Sample], batch_id: str) -> str:
    csv_path = DATA_DIR / f"samples_{batch_id}.csv"
    
    fieldnames = [
        "sample_id", "leaf_area_cm2", "lesion_area_cm2", "lesion_color",
        "collected_at", "technician_id", "field_id"
    ]
    
    with open(csv_path, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for sample in samples:
            writer.writerow({
                "sample_id": sample.sample_id,
                "leaf_area_cm2": sample.leaf_area_cm2,
                "lesion_area_cm2": sample.lesion_area_cm2,
                "lesion_color": sample.lesion_color,
                "collected_at": sample.collected_at,
                "technician_id": sample.technician_id,
                "field_id": sample.field_id,
            })
    
    return str(csv_path)


def get_sample_file_path(batch_id: str) -> str:
    csv_path = DATA_DIR / f"samples_{batch_id}.csv"
    if csv_path.exists():
        return str(csv_path)
    return ""
