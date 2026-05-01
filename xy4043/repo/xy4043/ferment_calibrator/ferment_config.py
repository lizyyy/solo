"""
发酵配置模块 - 管理传感器校准系数、实验阶段、异常阈值、补料配方
"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
import jsonschema


CONFIG_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
        "project_name": {"type": "string"},
        "sensor_calibration": {
            "type": "object",
            "properties": {
                "ph": {
                    "type": "object",
                    "properties": {
                        "offset": {"type": "number"},
                        "slope": {"type": "number"},
                        "drift_per_hour": {"type": "number"}
                    },
                    "required": ["offset", "slope", "drift_per_hour"]
                },
                "temperature": {
                    "type": "object",
                    "properties": {
                        "offset": {"type": "number"},
                        "drift_per_hour": {"type": "number"}
                    },
                    "required": ["offset", "drift_per_hour"]
                },
                "dissolved_oxygen": {
                    "type": "object",
                    "properties": {
                        "offset": {"type": "number"},
                        "slope": {"type": "number"},
                        "drift_per_hour": {"type": "number"}
                    },
                    "required": ["offset", "slope", "drift_per_hour"]
                }
            },
            "required": ["ph", "temperature", "dissolved_oxygen"]
        },
        "experiment_phases": {
            "type": "object",
            "properties": {
                "allowed_phases": {
                    "type": "array",
                    "items": {"type": "string"}
                },
                "default_phase": {"type": "string"}
            },
            "required": ["allowed_phases", "default_phase"]
        },
        "anomaly_thresholds": {
            "type": "object",
            "properties": {
                "ph": {
                    "type": "object",
                    "properties": {
                        "min": {"type": "number"},
                        "max": {"type": "number"},
                        "max_change_per_minute": {"type": "number"}
                    },
                    "required": ["min", "max", "max_change_per_minute"]
                },
                "temperature": {
                    "type": "object",
                    "properties": {
                        "min": {"type": "number"},
                        "max": {"type": "number"},
                        "max_change_per_minute": {"type": "number"}
                    },
                    "required": ["min", "max", "max_change_per_minute"]
                },
                "dissolved_oxygen": {
                    "type": "object",
                    "properties": {
                        "min": {"type": "number"},
                        "max": {"type": "number"},
                        "max_change_per_minute": {"type": "number"}
                    },
                    "required": ["min", "max", "max_change_per_minute"]
                },
                "od600": {
                    "type": "object",
                    "properties": {
                        "min": {"type": "number"},
                        "max": {"type": "number"}
                    },
                    "required": ["min", "max"]
                },
                "stirring_speed": {
                    "type": "object",
                    "properties": {
                        "min": {"type": "number"},
                        "max": {"type": "number"}
                    },
                    "required": ["min", "max"]
                }
            },
            "required": ["ph", "temperature", "dissolved_oxygen", "od600", "stirring_speed"]
        },
        "feed_formulations": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "components": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "concentration_g_per_l": {"type": "number"}
                            },
                            "required": ["name", "concentration_g_per_l"]
                        }
                    },
                    "description": {"type": "string"}
                },
                "required": ["name", "components"]
            }
        },
        "output_config": {
            "type": "object",
            "properties": {
                "data_directory": {"type": "string"},
                "reports_directory": {"type": "string"},
                "quarantine_directory": {"type": "string"},
                "history_directory": {"type": "string"}
            },
            "required": ["data_directory", "reports_directory", "quarantine_directory", "history_directory"]
        },
        "risk_rules": {
            "type": "object",
            "properties": {
                "contamination": {
                    "type": "object",
                    "properties": {
                        "ph_drop_threshold": {"type": "number"},
                        "od_spike_multiplier": {"type": "number"},
                        "temperature_spike_threshold": {"type": "number"}
                    },
                    "required": ["ph_drop_threshold", "od_spike_multiplier", "temperature_spike_threshold"]
                },
                "sensor_misalignment": {
                    "type": "object",
                    "properties": {
                        "drift_exceeds_threshold": {"type": "number"},
                        "constant_reading_duration_hours": {"type": "number"}
                    },
                    "required": ["drift_exceeds_threshold", "constant_reading_duration_hours"]
                },
                "feed_missing": {
                    "type": "object",
                    "properties": {
                        "expected_feed_interval_hours": {"type": "number"},
                        "tolerance_hours": {"type": "number"}
                    },
                    "required": ["expected_feed_interval_hours", "tolerance_hours"]
                }
            },
            "required": ["contamination", "sensor_misalignment", "feed_missing"]
        }
    },
    "required": [
        "project_name", "sensor_calibration", "experiment_phases", 
        "anomaly_thresholds", "output_config", "risk_rules"
    ]
}


DEFAULT_CONFIG = {
    "project_name": "default_fermentation_project",
    "sensor_calibration": {
        "ph": {
            "offset": 0.0,
            "slope": 1.0,
            "drift_per_hour": 0.01
        },
        "temperature": {
            "offset": 0.0,
            "drift_per_hour": 0.05
        },
        "dissolved_oxygen": {
            "offset": 0.0,
            "slope": 1.0,
            "drift_per_hour": 0.5
        }
    },
    "experiment_phases": {
        "allowed_phases": ["lag", "exponential", "stationary", "decline", "feed"],
        "default_phase": "lag"
    },
    "anomaly_thresholds": {
        "ph": {
            "min": 3.0,
            "max": 8.0,
            "max_change_per_minute": 0.1
        },
        "temperature": {
            "min": 15.0,
            "max": 45.0,
            "max_change_per_minute": 2.0
        },
        "dissolved_oxygen": {
            "min": 0.0,
            "max": 100.0,
            "max_change_per_minute": 10.0
        },
        "od600": {
            "min": 0.01,
            "max": 100.0
        },
        "stirring_speed": {
            "min": 0,
            "max": 1500
        }
    },
    "feed_formulations": {},
    "output_config": {
        "data_directory": "./data",
        "reports_directory": "./reports",
        "quarantine_directory": "./quarantine",
        "history_directory": "./history"
    },
    "risk_rules": {
        "contamination": {
            "ph_drop_threshold": 0.3,
            "od_spike_multiplier": 2.0,
            "temperature_spike_threshold": 1.5
        },
        "sensor_misalignment": {
            "drift_exceeds_threshold": 0.5,
            "constant_reading_duration_hours": 4.0
        },
        "feed_missing": {
            "expected_feed_interval_hours": 4.0,
            "tolerance_hours": 1.0
        }
    }
}


class FermentConfig:
    """发酵配置管理器"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = Path(config_path) if config_path else Path.cwd() / "ferment_config.json"
        self.config = None
        self._load_or_create()
    
    def _load_or_create(self) -> None:
        """加载配置或创建默认配置"""
        if self.config_path.exists():
            self._load()
        else:
            self.config = DEFAULT_CONFIG.copy()
            self._validate_config()
    
    def _load(self) -> None:
        """从文件加载配置"""
        with open(self.config_path, 'r', encoding='utf-8') as f:
            self.config = json.load(f)
        self._validate_config()
    
    def _validate_config(self) -> None:
        """验证配置符合 schema"""
        try:
            jsonschema.validate(instance=self.config, schema=CONFIG_SCHEMA)
        except jsonschema.ValidationError as e:
            raise ValueError(f"配置验证失败: {e.message}")
    
    def save(self, path: Optional[str] = None) -> None:
        """保存配置到文件"""
        save_path = Path(path) if path else self.config_path
        self._validate_config()
        
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
        self.config_path = save_path
    
    def get_project_name(self) -> str:
        """获取项目名称"""
        return self.config["project_name"]
    
    def get_sensor_calibration(self, sensor_type: str) -> Dict[str, float]:
        """获取传感器校准参数"""
        return self.config["sensor_calibration"].get(sensor_type, {})
    
    def get_allowed_phases(self) -> List[str]:
        """获取允许的实验阶段"""
        return self.config["experiment_phases"]["allowed_phases"]
    
    def get_anomaly_threshold(self, parameter: str) -> Dict[str, float]:
        """获取异常检测阈值"""
        return self.config["anomaly_thresholds"].get(parameter, {})
    
    def get_feed_formulation(self, name: str) -> Optional[Dict[str, Any]]:
        """获取补料配方"""
        return self.config["feed_formulations"].get(name)
    
    def add_feed_formulation(self, name: str, formulation: Dict[str, Any]) -> None:
        """添加补料配方"""
        self.config["feed_formulations"][name] = formulation
    
    def get_output_directory(self, directory_type: str) -> Path:
        """获取输出目录路径"""
        dir_path = Path(self.config["output_config"].get(directory_type, f"./{directory_type}"))
        return dir_path if dir_path.is_absolute() else self.config_path.parent / dir_path
    
    def get_risk_rules(self, risk_type: str) -> Dict[str, float]:
        """获取风险检测规则"""
        return self.config["risk_rules"].get(risk_type, {})
    
    def update_sensor_calibration(self, sensor_type: str, params: Dict[str, float]) -> None:
        """更新传感器校准参数"""
        if sensor_type not in self.config["sensor_calibration"]:
            raise ValueError(f"未知的传感器类型: {sensor_type}")
        self.config["sensor_calibration"][sensor_type].update(params)
    
    def update_anomaly_threshold(self, parameter: str, thresholds: Dict[str, float]) -> None:
        """更新异常检测阈值"""
        if parameter not in self.config["anomaly_thresholds"]:
            raise ValueError(f"未知的参数类型: {parameter}")
        self.config["anomaly_thresholds"][parameter].update(thresholds)
    
    def get_config_dict(self) -> Dict[str, Any]:
        """获取配置字典"""
        return self.config.copy()
    
    @classmethod
    def init_new_project(cls, project_path: str, project_name: str = "fermentation_project") -> 'FermentConfig':
        """初始化新项目"""
        project_dir = Path(project_path)
        project_dir.mkdir(parents=True, exist_ok=True)
        
        config = cls(project_dir / "ferment_config.json")
        config.config["project_name"] = project_name
        
        for dir_name in ["data_directory", "reports_directory", "quarantine_directory", "history_directory"]:
            dir_path = config.get_output_directory(dir_name)
            dir_path.mkdir(parents=True, exist_ok=True)
        
        config.save()
        return config
