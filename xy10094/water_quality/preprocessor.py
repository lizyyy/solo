"""数据预处理模块 - 处理缺失值、重复值、单位不一致"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np
from .config import QCConfig


@dataclass
class PreprocessIssue:
    """预处理问题记录"""
    type: str
    severity: str
    message: str
    affected_rows: List[int] = field(default_factory=list)
    affected_columns: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PreprocessResult:
    """预处理结果"""
    data: pd.DataFrame
    original_rows: int
    cleaned_rows: int
    issues: List[PreprocessIssue] = field(default_factory=list)
    actions: List[Dict[str, Any]] = field(default_factory=list)

    def to_summary(self) -> Dict[str, Any]:
        return {
            "original_rows": self.original_rows,
            "cleaned_rows": self.cleaned_rows,
            "removed_rows": self.original_rows - self.cleaned_rows,
            "issue_count": len(self.issues),
            "issues_by_type": self._count_by_type(),
        }

    def _count_by_type(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in self.issues:
            counts[issue.type] = counts.get(issue.type, 0) + 1
        return counts


class DataPreprocessor:
    """数据预处理器"""

    def __init__(self, config: QCConfig):
        self.config = config

    def preprocess(self, df: pd.DataFrame) -> PreprocessResult:
        """完整预处理流程"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict[str, Any]] = []
        original_rows = len(df)
        result_df = df.copy()

        standard_issues, standard_actions, result_df = self._standardize_columns(result_df)
        issues.extend(standard_issues)
        actions.extend(standard_actions)

        type_issues, type_actions, result_df = self._ensure_numeric_values(result_df)
        issues.extend(type_issues)
        actions.extend(type_actions)

        missing_issues, missing_actions, result_df = self._handle_missing_values(result_df)
        issues.extend(missing_issues)
        actions.extend(missing_actions)

        duplicate_issues, duplicate_actions, result_df = self._handle_duplicates(result_df)
        issues.extend(duplicate_issues)
        actions.extend(duplicate_actions)

        unit_issues, unit_actions, result_df = self._standardize_units(result_df)
        issues.extend(unit_issues)
        actions.extend(unit_actions)

        sample_issues, sample_actions, result_df = self._standardize_sample_types(result_df)
        issues.extend(sample_issues)
        actions.extend(sample_actions)

        return PreprocessResult(
            data=result_df,
            original_rows=original_rows,
            cleaned_rows=len(result_df),
            issues=issues,
            actions=actions,
        )

    def _standardize_columns(self, df: pd.DataFrame) -> Tuple[List[PreprocessIssue], List[Dict], pd.DataFrame]:
        """标准化列名"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict] = []
        result_df = df.copy()

        column_mapping = {}
        for col in result_df.columns:
            normalized = str(col).strip().lower()
            if normalized in ["样本编号", "样品编号", "id", "sample id", "sample_id"]:
                column_mapping[col] = "sample_id"
            elif normalized in ["样品类型", "类型", "type", "sample type", "sample_type"]:
                column_mapping[col] = "sample_type"
            elif normalized in ["检测项目", "指标", "参数", "parameter", "item"]:
                column_mapping[col] = "parameter"
            elif normalized in ["检测值", "数值", "结果", "value", "result"]:
                column_mapping[col] = "value"
            elif normalized in ["单位", "unit"]:
                column_mapping[col] = "unit"
            elif normalized in ["加标量", "spike", "spike amount", "spike_amount"]:
                column_mapping[col] = "spike_amount"
            elif normalized in ["加标浓度", "spike concentration", "spike_conc"]:
                column_mapping[col] = "spike_concentration"
            elif normalized in ["原始浓度", "original", "original_conc"]:
                column_mapping[col] = "original_concentration"

        if column_mapping:
            result_df = result_df.rename(columns=column_mapping)
            actions.append({
                "action": "rename_columns",
                "mapping": column_mapping
            })

        if "sample_id" not in result_df.columns:
            issues.append(PreprocessIssue(
                type="missing_required_column",
                severity="error",
                message="缺少必要列: sample_id (样本编号)",
                affected_columns=["sample_id"]
            ))
        if "value" not in result_df.columns:
            issues.append(PreprocessIssue(
                type="missing_required_column",
                severity="error",
                message="缺少必要列: value (检测值)",
                affected_columns=["value"]
            ))

        return issues, actions, result_df

    def _handle_missing_values(self, df: pd.DataFrame) -> Tuple[List[PreprocessIssue], List[Dict], pd.DataFrame]:
        """处理缺失值"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict] = []
        result_df = df.copy()

        for col in result_df.columns:
            missing_mask = result_df[col].isna()
            missing_count = missing_mask.sum()
            if missing_count > 0:
                affected_rows = result_df.index[missing_mask].tolist()
                issues.append(PreprocessIssue(
                    type="missing_value",
                    severity="warning",
                    message=f"列 '{col}' 有 {missing_count} 个缺失值",
                    affected_rows=affected_rows[:20],
                    affected_columns=[col],
                    details={"total": missing_count}
                ))

        critical_cols = ["sample_id", "value"]
        for col in critical_cols:
            if col in result_df.columns:
                drop_mask = result_df[col].isna()
                drop_count = drop_mask.sum()
                if drop_count > 0:
                    drop_indices = result_df.index[drop_mask].tolist()
                    result_df = result_df[~drop_mask].reset_index(drop=True)
                    issues.append(PreprocessIssue(
                        type="dropped_missing_critical",
                        severity="warning",
                        message=f"因 '{col}' 缺失，已移除 {drop_count} 行数据",
                        affected_rows=drop_indices[:20],
                        affected_columns=[col],
                        details={"removed_count": drop_count}
                    ))
                    actions.append({
                        "action": "drop_rows",
                        "reason": f"missing_{col}",
                        "removed_count": drop_count,
                        "removed_indices": drop_indices
                    })

        return issues, actions, result_df

    def _handle_duplicates(self, df: pd.DataFrame) -> Tuple[List[PreprocessIssue], List[Dict], pd.DataFrame]:
        """处理重复值"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict] = []
        result_df = df.copy()

        if "sample_id" in result_df.columns and "parameter" in result_df.columns:
            dup_keys = ["sample_id", "parameter"]
            if "sample_type" in result_df.columns:
                dup_keys.append("sample_type")
            
            dup_mask = result_df.duplicated(subset=dup_keys, keep=False)
            dup_count = dup_mask.sum()

            if dup_count > 0:
                dup_groups = result_df[dup_mask].groupby(dup_keys).size()
                issues.append(PreprocessIssue(
                    type="duplicate_rows",
                    severity="warning",
                    message=f"发现 {dup_count} 行重复数据（按 {dup_keys} 判断）",
                    affected_rows=result_df.index[dup_mask].tolist()[:20],
                    details={"duplicate_groups": {str(k): int(v) for k, v in dup_groups.items()}}
                ))

                if "value" in result_df.columns:
                    aggregated = result_df.groupby(dup_keys, as_index=False).agg({
                        "value": "mean",
                    })
                    
                    other_cols = [c for c in result_df.columns if c not in dup_keys and c != "value"]
                    first_vals = result_df.groupby(dup_keys, as_index=False)[other_cols].first()
                    
                    merged = aggregated.merge(first_vals, on=dup_keys, how="left")
                    merged["_value_source"] = "mean_of_duplicates"
                    
                    result_df = merged
                    
                    actions.append({
                        "action": "resolve_duplicates",
                        "method": "group_mean",
                        "keys": dup_keys,
                        "original_duplicates": int(dup_count)
                    })
                    issues.append(PreprocessIssue(
                        type="duplicate_resolved",
                        severity="info",
                        message=f"重复数据已合并，使用平均值",
                        details={"method": "mean"}
                    ))

        return issues, actions, result_df

    def _standardize_units(self, df: pd.DataFrame) -> Tuple[List[PreprocessIssue], List[Dict], pd.DataFrame]:
        """标准化单位"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict] = []
        result_df = df.copy()

        if "unit" not in result_df.columns or "parameter" not in result_df.columns:
            return issues, actions, result_df

        result_df["unit"] = result_df["unit"].astype(str).str.strip()
        result_df["unit"] = result_df["unit"].replace({"nan": "", "None": "", "NaN": ""})

        for param, target_unit in self.config.target_units.items():
            if not target_unit:
                continue

            param_mask = result_df["parameter"].astype(str).str.strip() == param
            if not param_mask.any():
                continue

            current_units = result_df.loc[param_mask, "unit"].unique()
            non_target = [u for u in current_units if u and u != target_unit]

            if non_target:
                issues.append(PreprocessIssue(
                    type="unit_inconsistency",
                    severity="warning",
                    message=f"指标 '{param}' 存在单位不一致: {list(current_units)}，目标单位: {target_unit}",
                    affected_columns=["unit", "parameter"],
                    details={"parameter": param, "current_units": list(current_units), "target": target_unit}
                ))

                for from_unit in non_target:
                    conversion = self.config.unit_conversion.get(from_unit, {})
                    factor = conversion.get(target_unit)

                    if factor is not None:
                        unit_mask = param_mask & (result_df["unit"] == from_unit)
                        affected_rows = result_df.index[unit_mask].tolist()
                        
                        result_df.loc[unit_mask, "value"] = result_df.loc[unit_mask, "value"] * factor
                        result_df.loc[unit_mask, "unit"] = target_unit
                        result_df.loc[unit_mask, "_unit_converted_from"] = from_unit
                        result_df.loc[unit_mask, "_unit_conversion_factor"] = factor

                        actions.append({
                            "action": "unit_conversion",
                            "parameter": param,
                            "from": from_unit,
                            "to": target_unit,
                            "factor": factor,
                            "affected_rows": len(affected_rows)
                        })
                        issues.append(PreprocessIssue(
                            type="unit_converted",
                            severity="info",
                            message=f"'{param}' 从 {from_unit} 转换为 {target_unit} (因子: {factor})",
                            affected_rows=affected_rows[:20],
                            details={"factor": factor}
                        ))
                    else:
                        unit_mask = param_mask & (result_df["unit"] == from_unit)
                        affected_rows = result_df.index[unit_mask].tolist()
                        issues.append(PreprocessIssue(
                            type="unit_conversion_missing",
                            severity="error",
                            message=f"无法转换 '{param}': 从 {from_unit} 到 {target_unit} 无转换因子",
                            affected_rows=affected_rows[:20],
                            details={"missing_conversion": f"{from_unit}->{target_unit}"}
                        ))

        return issues, actions, result_df

    def _ensure_numeric_values(self, df: pd.DataFrame) -> Tuple[List[PreprocessIssue], List[Dict], pd.DataFrame]:
        """确保数值列为数值类型"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict] = []
        result_df = df.copy()

        if "value" not in result_df.columns:
            return issues, actions, result_df

        converted = pd.to_numeric(result_df["value"], errors="coerce")
        non_numeric_mask = result_df["value"].notna() & converted.isna()
        non_numeric_count = non_numeric_mask.sum()

        if non_numeric_count > 0:
            affected_rows = result_df.index[non_numeric_mask].tolist()
            bad_values = result_df.loc[non_numeric_mask, "value"].tolist()
            issues.append(PreprocessIssue(
                type="non_numeric_value",
                severity="warning",
                message=f"发现 {non_numeric_count} 个非数值检测值，已转换为 NaN",
                affected_rows=affected_rows[:20],
                affected_columns=["value"],
                details={"bad_values": bad_values[:10]}
            ))
            actions.append({
                "action": "coerce_numeric",
                "affected_count": non_numeric_count,
                "sample_bad_values": bad_values[:10]
            })

        result_df["value"] = converted

        nan_after = result_df["value"].isna().sum()
        if nan_after > 0:
            drop_indices = result_df.index[result_df["value"].isna()].tolist()
            result_df = result_df[result_df["value"].notna()].reset_index(drop=True)
            if len(drop_indices) > 0:
                issues.append(PreprocessIssue(
                    type="dropped_invalid_value",
                    severity="warning",
                    message=f"因 value 无效，已移除 {len(drop_indices)} 行",
                    affected_rows=drop_indices[:20]
                ))
                actions.append({
                    "action": "drop_rows",
                    "reason": "invalid_value",
                    "removed_count": len(drop_indices)
                })

        return issues, actions, result_df

    def _standardize_sample_types(self, df: pd.DataFrame) -> Tuple[List[PreprocessIssue], List[Dict], pd.DataFrame]:
        """标准化样品类型"""
        issues: List[PreprocessIssue] = []
        actions: List[Dict] = []
        result_df = df.copy()

        if self.config.sample_type_column not in result_df.columns:
            return issues, actions, result_df

        result_df["_original_sample_type"] = result_df[self.config.sample_type_column].copy()

        def map_type(val):
            if pd.isna(val):
                return None
            key = str(val).strip()
            if key in self.config.sample_type_map:
                return self.config.sample_type_map[key]
            lower_key = key.lower()
            for k, v in self.config.sample_type_map.items():
                if k.lower() == lower_key:
                    return v
            return None

        result_df["sample_type_normalized"] = result_df[self.config.sample_type_column].apply(map_type)

        unmapped = result_df[result_df["sample_type_normalized"].isna() & 
                             result_df[self.config.sample_type_column].notna()]
        if len(unmapped) > 0:
            unique_unmapped = unmapped[self.config.sample_type_column].unique().tolist()
            issues.append(PreprocessIssue(
                type="unknown_sample_type",
                severity="warning",
                message=f"发现未知样品类型: {unique_unmapped}",
                affected_rows=unmapped.index.tolist()[:20],
                details={"unmapped_types": unique_unmapped}
            ))

        result_df[self.config.sample_type_column] = result_df["sample_type_normalized"]
        if "sample_type_normalized" in result_df.columns:
            result_df = result_df.drop(columns=["sample_type_normalized"])

        return issues, actions, result_df
