from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
import yaml

from ..utils.helpers import generate_id, get_current_time


@dataclass
class ThresholdConfig:
    """阈值配置"""
    name: str
    value: float
    description: str = ""
    updated_at: datetime = field(default_factory=get_current_time)
    updated_by: str = ""


@dataclass
class ParamYAML:
    """参数YAML配置"""
    yaml_id: str = field(default_factory=lambda: generate_id("py"))
    name: str = ""
    thresholds: Dict[str, ThresholdConfig] = field(default_factory=dict)
    other_params: Dict = field(default_factory=dict)
    created_at: datetime = field(default_factory=get_current_time)
    updated_at: datetime = field(default_factory=get_current_time)
    version: int = 1
    loaded_by: str = ""
    raw_content: str = ""

    @classmethod
    def from_yaml_content(cls, content: str, name: str = "", loaded_by: str = "") -> "ParamYAML":
        """从YAML内容加载"""
        data = yaml.safe_load(content)
        param = cls(name=name, loaded_by=loaded_by, raw_content=content)

        if "thresholds" in data and isinstance(data["thresholds"], dict):
            for t_name, t_info in data["thresholds"].items():
                if isinstance(t_info, dict):
                    param.thresholds[t_name] = ThresholdConfig(
                        name=t_name,
                        value=float(t_info.get("value", 0)),
                        description=t_info.get("description", ""),
                    )
                else:
                    param.thresholds[t_name] = ThresholdConfig(
                        name=t_name,
                        value=float(t_info),
                    )

        for key, value in data.items():
            if key != "thresholds":
                param.other_params[key] = value

        return param

    def get_threshold(self, name: str) -> Optional[ThresholdConfig]:
        """获取指定阈值"""
        return self.thresholds.get(name)

    def get_threshold_value(self, name: str, default: float = 0.0) -> float:
        """获取指定阈值的数值"""
        threshold = self.get_threshold(name)
        return threshold.value if threshold else default

    def update_threshold(self, name: str, value: float, updated_by: str = "", description: str = "") -> ThresholdConfig:
        """更新阈值"""
        if name in self.thresholds:
            self.thresholds[name].value = value
            self.thresholds[name].updated_at = get_current_time()
            self.thresholds[name].updated_by = updated_by
            if description:
                self.thresholds[name].description = description
        else:
            self.thresholds[name] = ThresholdConfig(
                name=name,
                value=value,
                description=description,
                updated_by=updated_by,
            )
        self.updated_at = get_current_time()
        self.version += 1
        return self.thresholds[name]
