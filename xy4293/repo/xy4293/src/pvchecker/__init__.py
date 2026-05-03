#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
屋顶光伏串线校核器 - PV String Checker

县域光伏安装队专用本地计算工具，用于屋顶光伏系统的串线方案校核与优化。

功能特性：
- 多源数据导入：屋面分区、组件参数、逆变器MPPT、遮挡系数
- 核心计算：温度修正、遮挡损失、线缆压降、逆变器匹配
- 方案优化：自动生成2-3个优化方案
- 风险检测：电压超限、电流不匹配、线损过高
- 报告导出：支持Markdown/CSV/JSON格式
- 方案存储：保存和加载方案配置

版本: 1.0.0
"""

__version__ = "1.0.0"
__author__ = "PV String Checker Team"
__email__ = "pvchecker@example.com"
__license__ = "MIT"

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field


@dataclass
class PVModule:
    """光伏组件参数模型"""
    model: str
    p_max: float
    v_mp: float
    i_mp: float
    voc: float
    isc: float
    temp_coeff_voc: float
    temp_coeff_isc: float
    temp_coeff_pmax: float
    noct: float = 45.0
    area: float = 1.6
    efficiency: float = 0.21


@dataclass
class RoofZone:
    """屋面分区模型"""
    zone_id: str
    area: float
    tilt: float
    azimuth: float
    module_count: int
    shading_profile: str = "standard"
    notes: str = ""


@dataclass
class InverterMPPT:
    """逆变器MPPT参数模型"""
    inverter_model: str
    mppt_id: str
    v_min: float
    v_max: float
    v_nom: float
    p_max: float
    i_max: float
    efficiency: float = 0.98
    v_start: Optional[float] = None


@dataclass
class StringConfig:
    """组串配置模型"""
    config_id: str
    modules_per_string: int
    strings_in_parallel: int
    total_modules: int
    estimated_voc_stc: float
    estimated_vmp_stc: float
    estimated_isc_stc: float
    estimated_imp_stc: float
    cable_length: float = 50.0
    cable_cross_section: float = 6.0


@dataclass
class RiskItem:
    """风险项模型"""
    rule_name: str
    severity: str
    message: str
    affected_components: List[str]
    suggested_action: str
    risk_score: float


@dataclass
class AnalysisResult:
    """分析结果模型"""
    result_id: str
    timestamp: str
    module_params: PVModule
    roof_zones: List[RoofZone]
    inverter_params: InverterMPPT
    configs: List[StringConfig]
    risks: List[RiskItem]
    total_estimated_power: float
    estimated_shading_loss: float
    estimated_cable_loss: float
    notes: str = ""


# 导出主要类
from pvchecker.dataparser import (
    DataParser,
    RoofZoneParser,
    ModuleParser,
    InverterParser,
    ShadingParser,
)

from pvchecker.pvcalc import (
    TemperatureCorrector,
    IVCalculator,
    ShadingCalculator,
    CableLossCalculator,
)

from pvchecker.solver import (
    ConfigurationSolver,
    Optimizer,
)

from pvchecker.risk import (
    RiskRule,
    VoltageLimitRule,
    CurrentMismatchRule,
    CableLossRule,
    RiskAssessor,
)

from pvchecker.storage import (
    SchemeStorage,
)

from pvchecker.exporter import (
    ReportExporter,
    MarkdownExporter,
    CSVExporter,
    JSONExporter,
)

__all__ = [
    # 数据模型
    "PVModule",
    "RoofZone",
    "InverterMPPT",
    "StringConfig",
    "RiskItem",
    "AnalysisResult",
    # 数据解析
    "DataParser",
    "RoofZoneParser",
    "ModuleParser",
    "InverterParser",
    "ShadingParser",
    # 核心计算
    "TemperatureCorrector",
    "IVCalculator",
    "ShadingCalculator",
    "CableLossCalculator",
    # 方案搜索
    "ConfigurationSolver",
    "Optimizer",
    # 风险规则
    "RiskRule",
    "VoltageLimitRule",
    "CurrentMismatchRule",
    "CableLossRule",
    "RiskAssessor",
    # 状态存储
    "SchemeStorage",
    # 导出
    "ReportExporter",
    "MarkdownExporter",
    "CSVExporter",
    "JSONExporter",
]
