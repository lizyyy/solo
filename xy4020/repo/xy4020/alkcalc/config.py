# -*- coding: utf-8 -*-
"""
配置管理模块
负责项目初始化、配置文件读写和参数维护
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


DEFAULT_CONFIG = {
    "project_name": "未命名项目",
    "created_at": "",
    "sampling_points": {},
    "blank_samples": {},
    "standard_solution": {
        "concentration_mol_l": None,
        "name": "盐酸标准溶液",
        "batch_number": ""
    },
    "qc_thresholds": {
        "duplicate_rpd_limit": 10.0,
        "min_readings": 5,
        "ph_monotonic_tolerance": 0.05
    }
}


@dataclass
class SamplingPoint:
    """采样点配置"""
    id: str
    name: str
    description: str = ""


@dataclass
class BlankSample:
    """空白样配置"""
    id: str
    name: str
    description: str = ""
    expected_volume_ml: Optional[float] = None


@dataclass
class StandardSolution:
    """标准液配置"""
    concentration_mol_l: Optional[float]
    name: str = "盐酸标准溶液"
    batch_number: str = ""


@dataclass
class QCThresholds:
    """质控阈值"""
    duplicate_rpd_limit: float = 10.0
    min_readings: int = 5
    ph_monotonic_tolerance: float = 0.05


@dataclass
class ProjectConfig:
    """项目配置"""
    project_name: str
    created_at: str
    sampling_points: Dict[str, SamplingPoint] = field(default_factory=dict)
    blank_samples: Dict[str, BlankSample] = field(default_factory=dict)
    standard_solution: Optional[StandardSolution] = None
    qc_thresholds: QCThresholds = field(default_factory=QCThresholds)


class ConfigManager:
    """配置管理器"""

    CONFIG_FILENAME = "alkcalc_config.json"
    DATA_DIRNAME = "alkcalc_data"

    def __init__(self, working_dir: Optional[str] = None):
        """
        初始化配置管理器
        
        Args:
            working_dir: 工作目录，默认为当前目录
        """
        self.working_dir = Path(working_dir) if working_dir else Path.cwd()
        self.config_path = self.working_dir / self.CONFIG_FILENAME
        self.data_dir = self.working_dir / self.DATA_DIRNAME
        self._config: Optional[ProjectConfig] = None

    def is_project_initialized(self) -> bool:
        """检查项目是否已初始化"""
        return self.config_path.exists()

    def init_project(self, project_name: str = "碱度分析项目") -> ProjectConfig:
        """
        初始化新项目
        
        Args:
            project_name: 项目名称
            
        Returns:
            项目配置对象
        """
        from datetime import datetime
        
        if self.is_project_initialized():
            raise FileExistsError(f"项目已存在: {self.config_path}")

        # 创建数据目录
        self.data_dir.mkdir(exist_ok=True)

        # 创建默认配置
        config = ProjectConfig(
            project_name=project_name,
            created_at=datetime.now().isoformat(),
            standard_solution=StandardSolution(concentration_mol_l=None),
            qc_thresholds=QCThresholds()
        )

        self._save_config(config)
        self._config = config
        return config

    def load_config(self) -> ProjectConfig:
        """
        加载现有配置
        
        Returns:
            项目配置对象
            
        Raises:
            FileNotFoundError: 配置文件不存在
        """
        if not self.is_project_initialized():
            raise FileNotFoundError(
                f"项目未初始化，请先运行 'init' 命令。\n"
                f"期望配置文件位置: {self.config_path}"
            )

        with open(self.config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        config = ProjectConfig(
            project_name=data.get("project_name", "未命名项目"),
            created_at=data.get("created_at", "")
        )

        # 解析采样点
        for sp_id, sp_data in data.get("sampling_points", {}).items():
            config.sampling_points[sp_id] = SamplingPoint(
                id=sp_id,
                name=sp_data.get("name", sp_id),
                description=sp_data.get("description", "")
            )

        # 解析空白样
        for blank_id, blank_data in data.get("blank_samples", {}).items():
            config.blank_samples[blank_id] = BlankSample(
                id=blank_id,
                name=blank_data.get("name", blank_id),
                description=blank_data.get("description", ""),
                expected_volume_ml=blank_data.get("expected_volume_ml")
            )

        # 解析标准液
        ss_data = data.get("standard_solution", {})
        if ss_data:
            config.standard_solution = StandardSolution(
                concentration_mol_l=ss_data.get("concentration_mol_l"),
                name=ss_data.get("name", "盐酸标准溶液"),
                batch_number=ss_data.get("batch_number", "")
            )

        # 解析质控阈值
        qc_data = data.get("qc_thresholds", {})
        config.qc_thresholds = QCThresholds(
            duplicate_rpd_limit=qc_data.get("duplicate_rpd_limit", 10.0),
            min_readings=qc_data.get("min_readings", 5),
            ph_monotonic_tolerance=qc_data.get("ph_monotonic_tolerance", 0.05)
        )

        self._config = config
        return config

    def _save_config(self, config: ProjectConfig) -> None:
        """保存配置到文件"""
        data = {
            "project_name": config.project_name,
            "created_at": config.created_at,
            "sampling_points": {
                sp.id: {
                    "name": sp.name,
                    "description": sp.description
                }
                for sp in config.sampling_points.values()
            },
            "blank_samples": {
                blank.id: {
                    "name": blank.name,
                    "description": blank.description,
                    "expected_volume_ml": blank.expected_volume_ml
                }
                for blank in config.blank_samples.values()
            },
            "standard_solution": {
                "concentration_mol_l": config.standard_solution.concentration_mol_l
                if config.standard_solution else None,
                "name": config.standard_solution.name
                if config.standard_solution else "盐酸标准溶液",
                "batch_number": config.standard_solution.batch_number
                if config.standard_solution else ""
            },
            "qc_thresholds": {
                "duplicate_rpd_limit": config.qc_thresholds.duplicate_rpd_limit,
                "min_readings": config.qc_thresholds.min_readings,
                "ph_monotonic_tolerance": config.qc_thresholds.ph_monotonic_tolerance
            }
        }

        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_sampling_point(self, point_id: str, name: str, description: str = "") -> SamplingPoint:
        """
        添加采样点
        
        Args:
            point_id: 采样点ID
            name: 采样点名称
            description: 采样点描述
            
        Returns:
            新增的采样点对象
        """
        config = self._config or self.load_config()
        
        if point_id in config.sampling_points:
            raise ValueError(f"采样点 '{point_id}' 已存在")
        
        sp = SamplingPoint(id=point_id, name=name, description=description)
        config.sampling_points[point_id] = sp
        self._save_config(config)
        return sp

    def update_sampling_point(self, point_id: str, name: Optional[str] = None, 
                              description: Optional[str] = None) -> SamplingPoint:
        """
        更新采样点信息
        
        Args:
            point_id: 采样点ID
            name: 新名称（可选）
            description: 新描述（可选）
            
        Returns:
            更新后的采样点对象
        """
        config = self._config or self.load_config()
        
        if point_id not in config.sampling_points:
            raise ValueError(f"采样点 '{point_id}' 不存在")
        
        sp = config.sampling_points[point_id]
        if name is not None:
            sp.name = name
        if description is not None:
            sp.description = description
        
        self._save_config(config)
        return sp

    def remove_sampling_point(self, point_id: str) -> None:
        """
        删除采样点
        
        Args:
            point_id: 采样点ID
        """
        config = self._config or self.load_config()
        
        if point_id not in config.sampling_points:
            raise ValueError(f"采样点 '{point_id}' 不存在")
        
        del config.sampling_points[point_id]
        self._save_config(config)

    def add_blank_sample(self, blank_id: str, name: str, description: str = "",
                         expected_volume_ml: Optional[float] = None) -> BlankSample:
        """
        添加空白样
        
        Args:
            blank_id: 空白样ID
            name: 空白样名称
            description: 空白样描述
            expected_volume_ml: 预期滴定体积（ml）
            
        Returns:
            新增的空白样对象
        """
        config = self._config or self.load_config()
        
        if blank_id in config.blank_samples:
            raise ValueError(f"空白样 '{blank_id}' 已存在")
        
        blank = BlankSample(
            id=blank_id, 
            name=name, 
            description=description,
            expected_volume_ml=expected_volume_ml
        )
        config.blank_samples[blank_id] = blank
        self._save_config(config)
        return blank

    def update_blank_sample(self, blank_id: str, name: Optional[str] = None,
                           description: Optional[str] = None,
                           expected_volume_ml: Optional[float] = None) -> BlankSample:
        """
        更新空白样信息
        
        Args:
            blank_id: 空白样ID
            name: 新名称（可选）
            description: 新描述（可选）
            expected_volume_ml: 新预期体积（可选）
            
        Returns:
            更新后的空白样对象
        """
        config = self._config or self.load_config()
        
        if blank_id not in config.blank_samples:
            raise ValueError(f"空白样 '{blank_id}' 不存在")
        
        blank = config.blank_samples[blank_id]
        if name is not None:
            blank.name = name
        if description is not None:
            blank.description = description
        if expected_volume_ml is not None:
            blank.expected_volume_ml = expected_volume_ml
        
        self._save_config(config)
        return blank

    def remove_blank_sample(self, blank_id: str) -> None:
        """
        删除空白样
        
        Args:
            blank_id: 空白样ID
        """
        config = self._config or self.load_config()
        
        if blank_id not in config.blank_samples:
            raise ValueError(f"空白样 '{blank_id}' 不存在")
        
        del config.blank_samples[blank_id]
        self._save_config(config)

    def set_standard_solution(self, concentration_mol_l: float, name: str = "盐酸标准溶液",
                              batch_number: str = "") -> StandardSolution:
        """
        设置标准液配置
        
        Args:
            concentration_mol_l: 标准液浓度（mol/L）
            name: 标准液名称
            batch_number: 批号
            
        Returns:
            标准液配置对象
        """
        config = self._config or self.load_config()
        
        if concentration_mol_l <= 0:
            raise ValueError("标准液浓度必须大于0")
        
        config.standard_solution = StandardSolution(
            concentration_mol_l=concentration_mol_l,
            name=name,
            batch_number=batch_number
        )
        
        self._save_config(config)
        return config.standard_solution

    def set_qc_threshold(self, duplicate_rpd_limit: Optional[float] = None,
                        min_readings: Optional[int] = None,
                        ph_monotonic_tolerance: Optional[float] = None) -> QCThresholds:
        """
        设置质控阈值
        
        Args:
            duplicate_rpd_limit: 平行样相对偏差限值（%）
            min_readings: 最小读数点数
            ph_monotonic_tolerance: pH单调性容差
            
        Returns:
            更新后的质控阈值对象
        """
        config = self._config or self.load_config()
        
        if duplicate_rpd_limit is not None:
            if duplicate_rpd_limit <= 0:
                raise ValueError("相对偏差限值必须大于0")
            config.qc_thresholds.duplicate_rpd_limit = duplicate_rpd_limit
        
        if min_readings is not None:
            if min_readings < 3:
                raise ValueError("最小读数点数至少为3")
            config.qc_thresholds.min_readings = min_readings
        
        if ph_monotonic_tolerance is not None:
            if ph_monotonic_tolerance < 0:
                raise ValueError("pH单调性容差不能为负")
            config.qc_thresholds.ph_monotonic_tolerance = ph_monotonic_tolerance
        
        self._save_config(config)
        return config.qc_thresholds

    def get_config(self) -> ProjectConfig:
        """获取当前配置（确保已加载）"""
        if self._config is None:
            self.load_config()
        return self._config

    def get_data_dir(self) -> Path:
        """获取数据目录路径"""
        return self.data_dir
