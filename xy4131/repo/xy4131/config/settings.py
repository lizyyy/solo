import os
from pathlib import Path

class Settings:
    BASE_DIR = Path(__file__).resolve().parent.parent
    DATA_DIR = BASE_DIR / "data"
    SESSIONS_DIR = BASE_DIR / "sessions"
    EXPORTS_DIR = BASE_DIR / "exports"
    
    POWER_OUTAGE_THRESHOLD_MINUTES = 30
    TIMEZONE = "Asia/Shanghai"
    
    YARD_BLOCKS = ["A01", "A02", "A03", "B01", "B02", "B03", "C01", "C02", "C03"]
    YARD_ROWS = 10
    YARD_BAYS = 6
    YARD_TIERS = 4
    
    @classmethod
    def ensure_dirs(cls):
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
        cls.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        (cls.DATA_DIR / "raw").mkdir(parents=True, exist_ok=True)
        (cls.DATA_DIR / "processed").mkdir(parents=True, exist_ok=True)
