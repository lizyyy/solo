import os
from pathlib import Path
from dataclasses import dataclass
from typing import List, Optional
from enum import Enum


class TaskStatus(Enum):
    TO_PACK = "待装箱"
    IN_TRANSIT = "运输中"
    TO_SIGN = "待签收"
    NEED_REVIEW = "需复核"
    ARCHIVED = "已归档"


@dataclass
class AppConfig:
    app_name: str = "冷藏药品交接温控追溯台"
    version: str = "1.0.0"
    
    base_dir: Path = None
    data_dir: Path = None
    db_path: Path = None
    attachments_dir: Path = None
    quarantine_dir: Path = None
    exports_dir: Path = None
    samples_dir: Path = None
    
    temperature_min: float = 2.0
    temperature_max: float = 8.0
    consecutive_overtemp_count: int = 3
    low_battery_threshold: float = 20.0
    
    csv_encoding: str = "utf-8"
    date_formats: List[str] = None
    
    allowed_attachment_types: List[str] = None
    
    def __post_init__(self):
        if self.base_dir is None:
            self.base_dir = Path(__file__).parent.resolve()
        
        if self.data_dir is None:
            self.data_dir = self.base_dir / "data"
        
        if self.db_path is None:
            self.db_path = self.data_dir / "app.db"
        
        if self.attachments_dir is None:
            self.attachments_dir = self.data_dir / "attachments"
        
        if self.quarantine_dir is None:
            self.quarantine_dir = self.data_dir / "quarantine"
        
        if self.exports_dir is None:
            self.exports_dir = self.data_dir / "exports"
        
        if self.samples_dir is None:
            self.samples_dir = self.base_dir / "samples"
        
        if self.date_formats is None:
            self.date_formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y/%m/%d %H:%M:%S",
                "%Y-%m-%d %H:%M",
                "%Y/%m/%d %H:%M",
                "%d-%m-%Y %H:%M:%S",
                "%d/%m/%Y %H:%M:%S",
            ]
        
        if self.allowed_attachment_types is None:
            self.allowed_attachment_types = [
                ".jpg", ".jpeg", ".png", ".gif", ".bmp",
                ".pdf", ".doc", ".docx", ".xls", ".xlsx"
            ]
    
    def ensure_directories(self):
        for path in [
            self.data_dir,
            self.attachments_dir,
            self.quarantine_dir,
            self.exports_dir,
            self.samples_dir,
        ]:
            path.mkdir(parents=True, exist_ok=True)
    
    def is_temperature_normal(self, temp: float) -> bool:
        return self.temperature_min <= temp <= self.temperature_max
    
    def is_temperature_over(self, temp: float) -> bool:
        return temp > self.temperature_max or temp < self.temperature_min
    
    def is_low_battery(self, battery: float) -> bool:
        return battery <= self.low_battery_threshold


CONFIG = AppConfig()
