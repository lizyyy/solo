"""配置管理模块"""

import json
import os
from pathlib import Path
from typing import Optional

from nickel_plating_calculator.models.data_models import ProcessParameters


DEFAULT_CONFIG = {
    "process_parameters": {
        "nickel_sulfate_target_g_l": 250.0,
        "nickel_sulfate_min_g_l": 220.0,
        "nickel_sulfate_max_g_l": 280.0,
        "nickel_chloride_target_g_l": 45.0,
        "nickel_chloride_min_g_l": 35.0,
        "nickel_chloride_max_g_l": 55.0,
        "boric_acid_target_g_l": 40.0,
        "boric_acid_min_g_l": 30.0,
        "boric_acid_max_g_l": 50.0,
        "ph_target": 4.2,
        "ph_min": 4.0,
        "ph_max": 4.5,
        "temperature_target_c": 50.0,
        "temperature_min_c": 45.0,
        "temperature_max_c": 55.0,
        "nickel_sulfate_purity": 0.98,
        "nickel_chloride_purity": 0.97,
        "boric_acid_purity": 0.99,
        "sulfuric_acid_concentration": 0.98,
        "sodium_hydroxide_concentration": 0.30,
    },
    "titration": {
        "sample_volume_ml": 2.0,
        "edta_concentration_mol_l": 0.05,
        "naoh_concentration_mol_l": 0.1,
        "nickel_sulfate_molar_mass": 262.85,
        "nickel_chloride_molar_mass": 237.69,
        "boric_acid_molar_mass": 61.83,
    },
    "output": {
        "default_output_dir": "./output",
        "precision": 4,
        "cost_per_kg": {
            "nickel_sulfate": 25.0,
            "nickel_chloride": 30.0,
            "boric_acid": 15.0,
        },
    },
    "risk_thresholds": {
        "nickel_sulfate_deviation_warning_pct": 10.0,
        "nickel_sulfate_deviation_critical_pct": 20.0,
        "nickel_chloride_deviation_warning_pct": 15.0,
        "nickel_chloride_deviation_critical_pct": 25.0,
        "boric_acid_deviation_warning_pct": 20.0,
        "boric_acid_deviation_critical_pct": 35.0,
        "ph_deviation_warning": 0.3,
        "ph_deviation_critical": 0.5,
        "inventory_warning_days": 3,
        "inventory_critical_days": 1,
    },
}


class ConfigManager:
    """配置管理器"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = Path(config_path) if config_path else self._get_default_config_path()
        self._config = self._load_config()
    
    def _get_default_config_path(self) -> Path:
        """获取默认配置文件路径"""
        home = Path.home()
        config_dir = home / ".nickel_plating_calculator"
        config_dir.mkdir(parents=True, exist_ok=True)
        return config_dir / "config.json"
    
    def _load_config(self) -> dict:
        """加载配置文件"""
        if self.config_path.exists():
            with open(self.config_path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            return self._merge_defaults(loaded)
        else:
            self._save_config(DEFAULT_CONFIG)
            return DEFAULT_CONFIG.copy()
    
    def _merge_defaults(self, loaded: dict) -> dict:
        """合并默认配置"""
        result = DEFAULT_CONFIG.copy()
        for key, value in loaded.items():
            if key in result and isinstance(result[key], dict):
                result[key].update(value)
            else:
                result[key] = value
        return result
    
    def _save_config(self, config: dict) -> None:
        """保存配置文件"""
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
    
    def get_process_parameters(self) -> ProcessParameters:
        """获取工艺参数"""
        params = self._config["process_parameters"]
        return ProcessParameters(
            nickel_sulfate_target_g_l=params.get("nickel_sulfate_target_g_l", 250.0),
            nickel_sulfate_min_g_l=params.get("nickel_sulfate_min_g_l", 220.0),
            nickel_sulfate_max_g_l=params.get("nickel_sulfate_max_g_l", 280.0),
            nickel_chloride_target_g_l=params.get("nickel_chloride_target_g_l", 45.0),
            nickel_chloride_min_g_l=params.get("nickel_chloride_min_g_l", 35.0),
            nickel_chloride_max_g_l=params.get("nickel_chloride_max_g_l", 55.0),
            boric_acid_target_g_l=params.get("boric_acid_target_g_l", 40.0),
            boric_acid_min_g_l=params.get("boric_acid_min_g_l", 30.0),
            boric_acid_max_g_l=params.get("boric_acid_max_g_l", 50.0),
            ph_target=params.get("ph_target", 4.2),
            ph_min=params.get("ph_min", 4.0),
            ph_max=params.get("ph_max", 4.5),
            temperature_target_c=params.get("temperature_target_c", 50.0),
            temperature_min_c=params.get("temperature_min_c", 45.0),
            temperature_max_c=params.get("temperature_max_c", 55.0),
            nickel_sulfate_purity=params.get("nickel_sulfate_purity", 0.98),
            nickel_chloride_purity=params.get("nickel_chloride_purity", 0.97),
            boric_acid_purity=params.get("boric_acid_purity", 0.99),
            sulfuric_acid_concentration=params.get("sulfuric_acid_concentration", 0.98),
            sodium_hydroxide_concentration=params.get("sodium_hydroxide_concentration", 0.30),
        )
    
    def get_titration_config(self) -> dict:
        """获取滴定配置"""
        return self._config.get("titration", DEFAULT_CONFIG["titration"])
    
    def get_output_config(self) -> dict:
        """获取输出配置"""
        return self._config.get("output", DEFAULT_CONFIG["output"])
    
    def get_risk_thresholds(self) -> dict:
        """获取风险阈值"""
        return self._config.get("risk_thresholds", DEFAULT_CONFIG["risk_thresholds"])
    
    def update_process_parameters(self, params: dict) -> None:
        """更新工艺参数"""
        self._config["process_parameters"].update(params)
        self._save_config(self._config)
    
    def reset_to_default(self) -> None:
        """重置为默认配置"""
        self._config = DEFAULT_CONFIG.copy()
        self._save_config(self._config)
    
    @property
    def config(self) -> dict:
        """获取完整配置"""
        return self._config.copy()
