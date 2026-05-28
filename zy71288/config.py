from pathlib import Path
from dataclasses import dataclass

@dataclass
class Config:
    BASE_DIR: Path = Path(__file__).parent
    DATA_DIR: Path = BASE_DIR / "data"
    RAW_DATA_DIR: Path = DATA_DIR / "raw"
    PROCESSED_DATA_DIR: Path = DATA_DIR / "processed"
    OUTPUT_DIR: Path = BASE_DIR / "output"
    CHARTS_DIR: Path = OUTPUT_DIR / "charts"
    REPORTS_DIR: Path = OUTPUT_DIR / "reports"
    LOG_DIR: Path = BASE_DIR / "logs"
    
    GALLERY_CAPACITY: int = 500
    SAFE_OCCUPANCY_RATE: float = 0.85
    PEAK_HOUR_START: int = 10
    PEAK_HOUR_END: int = 18
    
    FORECAST_HORIZON: int = 24
    HISTORY_WINDOW: int = 168
    
    REQUIRED_FIELDS = {
        "reservations": ["booking_id", "date", "hour", "people_count", "status"],
        "weather": ["date", "hour", "temperature", "rain_probability", "weather_condition"],
        "events": ["event_id", "date", "hour", "event_type", "expected_attendance"],
        "historical": ["date", "hour", "actual_visitors"],
        "capacity": ["area_id", "area_name", "max_capacity"]
    }
    
    ALLOWED_STATUSES = ["confirmed", "pending", "cancelled"]
    WEATHER_CONDITIONS = ["sunny", "cloudy", "rainy", "stormy"]
    
    def __post_init__(self):
        for dir_path in [
            self.DATA_DIR, self.RAW_DATA_DIR, self.PROCESSED_DATA_DIR,
            self.OUTPUT_DIR, self.CHARTS_DIR, self.REPORTS_DIR, self.LOG_DIR
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

config = Config()
