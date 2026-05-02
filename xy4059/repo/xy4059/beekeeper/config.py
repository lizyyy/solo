"""配置模型模块"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any


@dataclass
class Drug:
    """药物配置"""
    name: str
    safety_interval_days: int
    description: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "safety_interval_days": self.safety_interval_days,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Drug":
        return cls(
            name=data["name"],
            safety_interval_days=data["safety_interval_days"],
            description=data.get("description"),
        )


@dataclass
class Hive:
    """蜂箱配置"""
    hive_number: str
    apiary: str
    queen_year: int
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hive_number": self.hive_number,
            "apiary": self.apiary,
            "queen_year": self.queen_year,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Hive":
        return cls(
            hive_number=data["hive_number"],
            apiary=data["apiary"],
            queen_year=data["queen_year"],
            notes=data.get("notes"),
        )


@dataclass
class Apiary:
    """蜂场配置"""
    name: str
    location: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "location": self.location,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Apiary":
        return cls(
            name=data["name"],
            location=data.get("location"),
            notes=data.get("notes"),
        )


@dataclass
class Config:
    """主配置类"""
    config_version: str = "1.0"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    
    apiaries: List[Apiary] = field(default_factory=list)
    hives: List[Hive] = field(default_factory=list)
    drugs: List[Drug] = field(default_factory=list)
    
    output_dir: str = "./output"
    moisture_threshold: float = 20.0
    default_inspection_interval_days: int = 7
    
    _hive_cache: Dict[str, Hive] = field(default_factory=dict, repr=False)
    _drug_cache: Dict[str, Drug] = field(default_factory=dict, repr=False)
    _apiary_cache: Dict[str, Apiary] = field(default_factory=dict, repr=False)

    def __post_init__(self):
        self._build_caches()

    def _build_caches(self) -> None:
        self._hive_cache = {h.hive_number: h for h in self.hives}
        self._drug_cache = {d.name: d for d in self.drugs}
        self._apiary_cache = {a.name: a for a in self.apiaries}

    def add_apiary(self, name: str, location: Optional[str] = None, notes: Optional[str] = None) -> Apiary:
        if name in self._apiary_cache:
            raise ValueError(f"蜂场 '{name}' 已存在")
        apiary = Apiary(name=name, location=location, notes=notes)
        self.apiaries.append(apiary)
        self._apiary_cache[name] = apiary
        self._touch_updated()
        return apiary

    def add_hive(self, hive_number: str, apiary: str, queen_year: int, notes: Optional[str] = None) -> Hive:
        if hive_number in self._hive_cache:
            raise ValueError(f"箱号 '{hive_number}' 已存在")
        if apiary not in self._apiary_cache:
            raise ValueError(f"蜂场 '{apiary}' 不存在，请先添加蜂场")
        hive = Hive(hive_number=hive_number, apiary=apiary, queen_year=queen_year, notes=notes)
        self.hives.append(hive)
        self._hive_cache[hive_number] = hive
        self._touch_updated()
        return hive

    def add_drug(self, name: str, safety_interval_days: int, description: Optional[str] = None) -> Drug:
        if name in self._drug_cache:
            raise ValueError(f"药物 '{name}' 已存在")
        drug = Drug(name=name, safety_interval_days=safety_interval_days, description=description)
        self.drugs.append(drug)
        self._drug_cache[name] = drug
        self._touch_updated()
        return drug

    def get_hive(self, hive_number: str) -> Optional[Hive]:
        return self._hive_cache.get(hive_number)

    def get_drug(self, name: str) -> Optional[Drug]:
        return self._drug_cache.get(name)

    def get_apiary(self, name: str) -> Optional[Apiary]:
        return self._apiary_cache.get(name)

    def get_hives_by_apiary(self, apiary: str) -> List[Hive]:
        return [h for h in self.hives if h.apiary == apiary]

    def hive_exists(self, hive_number: str) -> bool:
        return hive_number in self._hive_cache

    def drug_exists(self, name: str) -> bool:
        return name in self._drug_cache

    def apiary_exists(self, name: str) -> bool:
        return name in self._apiary_cache

    def _touch_updated(self) -> None:
        self.updated_at = datetime.now().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "config_version": self.config_version,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "apiaries": [a.to_dict() for a in self.apiaries],
            "hives": [h.to_dict() for h in self.hives],
            "drugs": [d.to_dict() for d in self.drugs],
            "output_dir": self.output_dir,
            "moisture_threshold": self.moisture_threshold,
            "default_inspection_interval_days": self.default_inspection_interval_days,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Config":
        apiaries = [Apiary.from_dict(a) for a in data.get("apiaries", [])]
        hives = [Hive.from_dict(h) for h in data.get("hives", [])]
        drugs = [Drug.from_dict(d) for d in data.get("drugs", [])]
        
        return cls(
            config_version=data.get("config_version", "1.0"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            apiaries=apiaries,
            hives=hives,
            drugs=drugs,
            output_dir=data.get("output_dir", "./output"),
            moisture_threshold=data.get("moisture_threshold", 20.0),
            default_inspection_interval_days=data.get("default_inspection_interval_days", 7),
        )


class ConfigManager:
    """配置管理器"""
    
    DEFAULT_CONFIG_FILENAME = "beekeeper.json"
    
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or Path.cwd() / self.DEFAULT_CONFIG_FILENAME
        self._config: Optional[Config] = None

    def init_config(self) -> Config:
        """初始化新配置"""
        config = Config()
        self._config = config
        self.save_config()
        return config

    def load_config(self) -> Config:
        """加载配置"""
        if not self.config_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        self._config = Config.from_dict(data)
        return self._config

    def save_config(self) -> None:
        """保存配置"""
        if self._config is None:
            raise ValueError("没有要保存的配置")
        
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self._config.to_dict(), f, ensure_ascii=False, indent=2)

    @property
    def config(self) -> Config:
        """获取当前配置"""
        if self._config is None:
            self.load_config()
        return self._config

    @config.setter
    def config(self, value: Config) -> None:
        self._config = value

    def config_exists(self) -> bool:
        """检查配置文件是否存在"""
        return self.config_path.exists()
