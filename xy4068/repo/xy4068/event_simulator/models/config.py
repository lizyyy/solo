from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class InitConfig(BaseModel):
    version: str = "0.1.0"
    created_at: datetime = Field(default_factory=datetime.now)
    scenarios_dir: str = "scenarios"
    data_dir: str = "data"
    reports_dir: str = "reports"
    state_dir: str = "state"
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AppConfig(BaseModel):
    init: InitConfig = Field(default_factory=InitConfig)
    metadata: Dict[str, str] = Field(default_factory=dict)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
