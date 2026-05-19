import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bus_scheduling.db")
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    TIMEZONE = "Asia/Shanghai"
    
    SENSITIVE_FIELDS = {
        "parent_phone": {"mask": True, "pattern": r"(\d{3})\d{4}(\d{4})", "replace": r"\1****\2"},
        "driver_phone": {"mask": True, "pattern": r"(\d{3})\d{4}(\d{4})", "replace": r"\1****\2"},
        "student_name": {"mask": True, "pattern": r"(.{1}).*(.{1})", "replace": r"\1*\2"},
        "parent_name": {"mask": True, "pattern": r"(.{1}).*(.{1})", "replace": r"\1*\2"},
        "driver_name": {"mask": True, "pattern": r"(.{1}).*(.{1})", "replace": r"\1*\2"},
    }

settings = Settings()
