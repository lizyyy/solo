from datetime import timedelta
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class CabinetConfig(BaseModel):
    cabinet_id: str
    name: str
    location: str = ""


class SKUConfig(BaseModel):
    sku_id: str
    name: str
    price: float = 0.0
    weight_per_unit: float = 0.0


class ChannelConfig(BaseModel):
    channel_id: str
    sku_id: str
    capacity: int
    initial_quantity: int = 0


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
    )

    cabinets: List[CabinetConfig] = Field(default_factory=list)
    skus: List[SKUConfig] = Field(default_factory=list)
    channels: List[ChannelConfig] = Field(default_factory=list)

    deduplication_window_seconds: int = 3600
    max_clock_drift_seconds: int = 300
    abnormal_weight_threshold_percent: float = 20.0

    data_dir: Path = Field(default_factory=lambda: Path("./data"))
    output_dir: Path = Field(default_factory=lambda: Path("./output"))

    def get_cabinet(self, cabinet_id: str) -> Optional[CabinetConfig]:
        for cab in self.cabinets:
            if cab.cabinet_id == cabinet_id:
                return cab
        return None

    def get_sku(self, sku_id: str) -> Optional[SKUConfig]:
        for sku in self.skus:
            if sku.sku_id == sku_id:
                return sku
        return None

    def get_channel(self, cabinet_id: str, channel_id: str) -> Optional[ChannelConfig]:
        for ch in self.channels:
            if ch.channel_id.startswith(f"{cabinet_id}_") or ch.channel_id == channel_id:
                return ch
        return None

    def get_channels_for_cabinet(self, cabinet_id: str) -> List[ChannelConfig]:
        return [
            ch
            for ch in self.channels
            if ch.channel_id.startswith(f"{cabinet_id}_")
        ]

    def deduplication_window(self) -> timedelta:
        return timedelta(seconds=self.deduplication_window_seconds)

    def max_clock_drift(self) -> timedelta:
        return timedelta(seconds=self.max_clock_drift_seconds)
