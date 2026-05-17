import pandas as pd
import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class DiffType(Enum):
    LONG = "长款"
    SHORT = "短款"
    IMPREST_ADJUST = "备用金调整"
    MIXED = "混合"
    UNKNOWN = "未知"


class DiffLevel(Enum):
    TRIVIAL = "轻微"
    NORMAL = "一般"
    SERIOUS = "重大"
    CRITICAL = "特大"


@dataclass
class RemarkAnalysis:
    has_long_keyword: bool
    has_short_keyword: bool
    has_imprest_keyword: bool
    has_imprest_adjust_keyword: bool
    extracted_amounts: List[float]
    raw_remark: str


@dataclass
class ProcessedRecord:
    网点编号: str
    网点名称: str
    日期: str
    账面金额: float
    盘点金额: float
    备用金余额: float
    备注: str
    原始差异: float
    备用金调整额: float
    调整后差异: float
    差异类型: DiffType
    差异级别: DiffLevel
    备注分析: RemarkAnalysis
    来源文件: str
    来源行号: int
    来源工作表: Optional[str] = None


class RuleEngine:
    def __init__(self, rule_config):
        self.config = rule_config

    def process_dataframe(self, df: pd.DataFrame) -> List[ProcessedRecord]:
        records = []
        for _, row in df.iterrows():
            record = self._process_row(row)
            records.append(record)
        return records

    def _process_row(self, row: pd.Series) -> ProcessedRecord:
        原始差异 = row['盘点金额'] - row['账面金额']
        备注分析 = self._analyze_remark(str(row.get('备注', '')))
        
        备用金调整额 = self._calculate_imprest_adjust(原始差异, 备注分析)
        调整后差异 = 原始差异 - 备用金调整额
        
        差异类型 = self._determine_diff_type(原始差异, 备用金调整额, 备注分析)
        差异级别 = self._determine_diff_level(abs(调整后差异))
        
        return ProcessedRecord(
            网点编号=str(row.get('网点编号', '')),
            网点名称=str(row.get('网点名称', '')),
            日期=str(row.get('日期', '')),
            账面金额=float(row.get('账面金额', 0)),
            盘点金额=float(row.get('盘点金额', 0)),
            备用金余额=float(row.get('备用金余额', 0)),
            备注=str(row.get('备注', '')),
            原始差异=原始差异,
            备用金调整额=备用金调整额,
            调整后差异=调整后差异,
            差异类型=差异类型,
            差异级别=差异级别,
            备注分析=备注分析,
            来源文件=str(row.get('_source_file', '')),
            来源行号=int(row.get('_original_row', 0)),
            来源工作表=str(row.get('_source_sheet', '')) if row.get('_source_sheet') else None
        )

    def _analyze_remark(self, remark: str) -> RemarkAnalysis:
        remark_lower = remark.lower()
        
        has_long = any(kw in remark_lower for kw in self.config.long_short_keywords["长款"])
        has_short = any(kw in remark_lower for kw in self.config.long_short_keywords["短款"])
        has_imprest = any(kw in remark_lower for kw in self.config.imprest_keywords)
        has_imprest_adjust = any(kw in remark_lower for kw in self.config.imprest_adjust_keywords)
        
        amounts = self._extract_amounts(remark)
        
        return RemarkAnalysis(
            has_long_keyword=has_long,
            has_short_keyword=has_short,
            has_imprest_keyword=has_imprest,
            has_imprest_adjust_keyword=has_imprest_adjust,
            extracted_amounts=amounts,
            raw_remark=remark
        )

    def _extract_amounts(self, text: str) -> List[float]:
        amounts = []
        pattern = r'(\d+(?:\.\d+)?)'
        matches = re.findall(pattern, text)
        for match in matches:
            try:
                amounts.append(float(match))
            except ValueError:
                continue
        return amounts

    def _calculate_imprest_adjust(self, raw_diff: float, analysis: RemarkAnalysis) -> float:
        if not analysis.has_imprest_keyword or not analysis.has_imprest_adjust_keyword:
            return 0.0
        
        if analysis.extracted_amounts:
            amount = analysis.extracted_amounts[0]
            return amount if raw_diff > 0 else -amount
        
        return raw_diff if analysis.has_imprest_keyword else 0.0

    def _determine_diff_type(self, raw_diff: float, imprest_adjust: float, analysis: RemarkAnalysis) -> DiffType:
        has_long_short = analysis.has_long_keyword or analysis.has_short_keyword
        has_imprest = analysis.has_imprest_keyword or abs(imprest_adjust) > 1e-6
        
        if has_long_short and has_imprest:
            return DiffType.MIXED
        elif has_imprest:
            return DiffType.IMPREST_ADJUST
        elif analysis.has_long_keyword or raw_diff > 1e-6:
            return DiffType.LONG
        elif analysis.has_short_keyword or raw_diff < -1e-6:
            return DiffType.SHORT
        else:
            return DiffType.UNKNOWN

    def _determine_diff_level(self, diff_abs: float) -> DiffLevel:
        levels = sorted(self.config.diff_levels.items(), key=lambda x: x[1])
        for level_name, threshold in levels:
            if diff_abs <= threshold:
                return DiffLevel(level_name)
        return DiffLevel.CRITICAL
