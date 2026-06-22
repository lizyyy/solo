"""图表解释引擎 - 支持参数变更追溯、除零边界处理、数据溯源"""

from __future__ import annotations

import json
import warnings
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import uuid4

import numpy as np
import pandas as pd

from .parameter_manager import ParameterManager, ParameterVersion, ParameterChange


@dataclass
class ParamOrigin:
    """参数来源详情 - 能回到原始参数对象"""
    param_name: str
    param_value: Any
    version_id: str
    version_name: str
    source_type: str
    source_id: str
    source_name: str
    created_by: str
    created_at: str
    raw_value: Any
    raw_data: Dict[str, Any]
    row_hint: str = ""
    cleaned: bool = False
    change_from_previous: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "param_name": self.param_name,
            "param_value": self.param_value,
            "version_id": self.version_id,
            "version_name": self.version_name,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "source_name": self.source_name,
            "created_by": self.created_by,
            "created_at": self.created_at,
            "raw_value": self.raw_value,
            "raw_data": self.raw_data,
            "row_hint": self.row_hint,
            "cleaned": self.cleaned,
            "change_from_previous": self.change_from_previous,
        }


@dataclass
class BoundaryIssue:
    """边界问题记录 - 如除零等，直接定位到原始对象"""
    issue_type: str
    severity: str
    location: str
    message: str
    suggestion: str
    param_name: Optional[str] = None
    param_value: Optional[Any] = None
    version_id: Optional[str] = None
    affected_calculations: List[str] = field(default_factory=list)
    param_origin: Optional[ParamOrigin] = None
    fallback_version_hint: str = ""
    fallback_version_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type,
            "severity": self.severity,
            "location": self.location,
            "message": self.message,
            "suggestion": self.suggestion,
            "param_name": self.param_name,
            "param_value": self.param_value,
            "version_id": self.version_id,
            "affected_calculations": self.affected_calculations,
            "param_origin": self.param_origin.to_dict() if self.param_origin else None,
            "fallback_version_hint": self.fallback_version_hint,
            "fallback_version_id": self.fallback_version_id,
        }


@dataclass
class CalculationStep:
    """计算步骤 - 用于解释数字从哪来，每一步都带溯源链路"""
    step_id: str
    step_name: str
    description: str
    formula: str
    inputs: Dict[str, Any]
    output: Any
    data_lineage: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "step_id": self.step_id,
            "step_name": self.step_name,
            "description": self.description,
            "formula": self.formula,
            "inputs": self.inputs,
            "output": self.output,
            "data_lineage": self.data_lineage,
        }


@dataclass
class ChartExplanation:
    """图表解释 - 供非技术人员理解"""
    explanation_id: str
    version_id: str
    version_name: str
    title: str
    plain_language_summary: str
    key_findings: List[str]
    calculation_steps: List[CalculationStep]
    boundary_issues: List[BoundaryIssue]
    data_sources: List[Dict[str, Any]]
    parameter_changes: List[Dict[str, Any]]
    generated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "explanation_id": self.explanation_id,
            "version_id": self.version_id,
            "version_name": self.version_name,
            "title": self.title,
            "plain_language_summary": self.plain_language_summary,
            "key_findings": self.key_findings,
            "calculation_steps": [s.to_dict() for s in self.calculation_steps],
            "boundary_issues": [i.to_dict() for i in self.boundary_issues],
            "data_sources": self.data_sources,
            "parameter_changes": self.parameter_changes,
            "generated_at": self.generated_at.isoformat(),
        }


class ChartExplainer:
    """图表解释器 - 核心类"""
    
    def __init__(self, parameter_manager: ParameterManager):
        self.parameter_manager = parameter_manager
        self._explanations: Dict[str, ChartExplanation] = {}
    
    def _build_param_origin(
        self,
        param_name: str,
        version: ParameterVersion,
    ) -> ParamOrigin:
        """为参数构建完整的来源对象，能回到原始表格行"""
        history = self.parameter_manager.trace_parameter_origin(param_name)
        current_entry = history[-1] if history else None
        first_entry = history[0] if history else None
        
        raw_value = version.source.raw_data.get(param_name, version.parameters.get(param_name))
        current_value = version.parameters.get(param_name)
        cleaned = raw_value != current_value
        
        row_hint = ""
        if version.source.source_type == "excel":
            row_hint = f"Excel文件 '{version.source.source_name}' (ID: {version.source.source_id})，参数 '{param_name}' 所在单元格"
        elif version.source.source_type == "manual":
            row_hint = f"手动录入记录 '{version.source.source_name}' (ID: {version.source.source_id})，录入人 {version.created_by}"
        elif version.source.source_type == "api":
            row_hint = f"API数据源 '{version.source.source_name}' (ID: {version.source.source_id})，字段 '{param_name}'"
        else:
            row_hint = f"来源 '{version.source.source_name}' (ID: {version.source.source_id})，参数 '{param_name}'"
        
        change_from_previous = None
        if len(history) >= 2:
            prev = history[-2]
            if prev["value"] != current_value:
                change_from_previous = {
                    "from_value": prev["value"],
                    "to_value": current_value,
                    "from_version": prev["version_name"],
                    "to_version": current_entry["version_name"] if current_entry else version.version_name,
                    "changed_by": current_entry["created_by"] if current_entry else version.created_by,
                }
        
        return ParamOrigin(
            param_name=param_name,
            param_value=current_value,
            version_id=version.version_id,
            version_name=version.version_name,
            source_type=version.source.source_type,
            source_id=version.source.source_id,
            source_name=version.source.source_name,
            created_by=version.created_by,
            created_at=version.created_at.isoformat(),
            raw_value=raw_value,
            raw_data=version.source.raw_data,
            row_hint=row_hint,
            cleaned=cleaned,
            change_from_previous=change_from_previous,
        )
    
    def _find_last_valid_version(
        self,
        param_name: str,
        current_version_id: str,
        is_valid_fn,
    ) -> Tuple[Optional[str], Optional[str]]:
        """找到参数最后一个有效值所在的版本"""
        history = self.parameter_manager.trace_parameter_origin(param_name)
        for entry in reversed(history):
            if entry["version_id"] == current_version_id:
                continue
            if is_valid_fn(entry["value"]):
                return entry["version_id"], entry["version_name"]
        return None, None
    
    def _safe_divide(
        self,
        numerator: float,
        denominator: float,
        param_name: str,
        version: ParameterVersion,
        epsilon: float = 1e-10,
    ) -> Tuple[float, Optional[BoundaryIssue]]:
        """
        安全除法 - 处理除零边界情况
        不仅警告，还要告诉接手的人：
        - 这个参数来自哪个原始对象/表格行
        - 影响了哪些计算
        - 建议回退到哪个有效版本
        - 找谁补录确认
        """
        if abs(denominator) < epsilon:
            param_origin = self._build_param_origin(param_name, version)
            
            fallback_id, fallback_name = self._find_last_valid_version(
                param_name,
                version.version_id,
                lambda v: isinstance(v, (int, float)) and abs(v) >= epsilon,
            )
            
            fallback_hint = ""
            if fallback_name:
                fallback_hint = f"建议回退到版本 '{fallback_name}'，该版本中 {param_name}={self.parameter_manager.get_version(fallback_id).parameters.get(param_name)}"
            else:
                fallback_hint = f"暂无有效历史版本，请联系 {param_origin.created_by} 补录确认"
            
            issue = BoundaryIssue(
                issue_type="除零错误",
                severity="high",
                location=f"参数 '{param_name}' 在版本 '{version.version_name}' 中",
                message=(
                    f"参数 '{param_name}' 值为 {denominator}，接近或等于零，无法执行除法运算。\n"
                    f"该值来自：{param_origin.row_hint}\n"
                    f"录入人：{param_origin.created_by}，录入时间：{version.created_at.strftime('%Y-%m-%d %H:%M')}"
                ),
                suggestion=(
                    f"处理步骤：\n"
                    f"1. 【定位来源】请检查 {param_origin.row_hint}\n"
                    f"   原始数据: {param_origin.raw_data}\n"
                    f"   录入人: {param_origin.created_by}，请与其确认该值是否正确\n"
                    f"2. 【影响评估】该异常会导致需要 '{param_name}' 作为分母的计算全部失效\n"
                    f"3. 【修复建议】{fallback_hint}\n"
                    f"4. 【临时方案】若业务允许，可使用极小值 {epsilon} 作为分母替代，或标记该指标为 '数据待复核'\n"
                    f"5. 【命令追溯】运行: python -m src.cli trace --param {param_name}"
                ),
                param_name=param_name,
                param_value=denominator,
                version_id=version.version_id,
                affected_calculations=["计算比例", "计算均值", "计算增长率"],
                param_origin=param_origin,
                fallback_version_hint=fallback_hint,
                fallback_version_id=fallback_id,
            )
            warnings.warn(issue.message)
            return np.nan, issue
        
        return numerator / denominator, None
    
    def _check_boundary_conditions(
        self,
        version: ParameterVersion,
    ) -> List[BoundaryIssue]:
        """检查边界条件，如除零、负数开方等，直接定位原始对象"""
        issues: List[BoundaryIssue] = []
        params = version.parameters
        
        for param_name, value in params.items():
            if isinstance(value, (int, float)):
                if value == 0 and param_name in ["分母", "除数", "比例基数"]:
                    param_origin = self._build_param_origin(param_name, version)
                    fallback_id, fallback_name = self._find_last_valid_version(
                        param_name,
                        version.version_id,
                        lambda v: isinstance(v, (int, float)) and v != 0,
                    )
                    fallback_hint = f"可参考版本 '{fallback_name}'" if fallback_name else "请联系录入人确认"
                    
                    issues.append(BoundaryIssue(
                        issue_type="零值风险",
                        severity="medium",
                        location=f"参数 '{param_name}' 在版本 '{version.version_name}' 中",
                        message=(
                            f"参数 '{param_name}' 值为 0，可能在后续除法计算中导致问题。\n"
                            f"来源：{param_origin.row_hint}"
                        ),
                        suggestion=(
                            f"处理建议：\n"
                            f"1. 检查来源：{param_origin.row_hint}\n"
                            f"2. 确认该值为0是否合理，录入人：{param_origin.created_by}\n"
                            f"3. {fallback_hint}\n"
                            f"4. 若合理，可在计算时添加极小值偏移避免除零"
                        ),
                        param_name=param_name,
                        param_value=value,
                        version_id=version.version_id,
                        param_origin=param_origin,
                        fallback_version_hint=fallback_hint,
                        fallback_version_id=fallback_id,
                    ))
                
                if value < 0 and param_name in ["样本量", "计数", "频率"]:
                    param_origin = self._build_param_origin(param_name, version)
                    fallback_id, fallback_name = self._find_last_valid_version(
                        param_name,
                        version.version_id,
                        lambda v: isinstance(v, (int, float)) and v >= 0,
                    )
                    fallback_hint = f"可回退到版本 '{fallback_name}'" if fallback_name else "请联系录入人确认"
                    
                    issues.append(BoundaryIssue(
                        issue_type="负值异常",
                        severity="high",
                        location=f"参数 '{param_name}' 在版本 '{version.version_name}' 中",
                        message=(
                            f"参数 '{param_name}' 为负值 ({value})，这类参数通常不应为负。\n"
                            f"来源：{param_origin.row_hint}"
                        ),
                        suggestion=(
                            f"处理建议：\n"
                            f"1. 检查原始数据录入是否错误：{param_origin.row_hint}\n"
                            f"2. 联系录入人 {param_origin.created_by} 确认是否有符号错误\n"
                            f"3. {fallback_hint}\n"
                            f"4. 若为计算结果，检查上一步计算逻辑"
                        ),
                        param_name=param_name,
                        param_value=value,
                        version_id=version.version_id,
                        param_origin=param_origin,
                        fallback_version_hint=fallback_hint,
                        fallback_version_id=fallback_id,
                    ))
        
        return issues
    
    def _create_calculation_step(
        self,
        step_name: str,
        description: str,
        formula: str,
        inputs: Dict[str, Any],
        output: Any,
        version: ParameterVersion,
    ) -> CalculationStep:
        """
        创建计算步骤，包含完整数据溯源链路
        每个输入都要说明：来自哪份参数表、哪一行/哪个对象、哪个版本、谁录入、原始值、清洗变化
        """
        data_lineage = []
        
        for input_name, input_value in inputs.items():
            if input_name in version.parameters:
                origin = self._build_param_origin(input_name, version)
                lineage_entry = {
                    "input_name": input_name,
                    "input_value": input_value,
                    "origin": {
                        "param_name": origin.param_name,
                        "param_value": origin.param_value,
                        "version_id": origin.version_id,
                        "version_name": origin.version_name,
                        "source_type": origin.source_type,
                        "source_id": origin.source_id,
                        "source_name": origin.source_name,
                        "source_location": origin.row_hint,
                        "created_by": origin.created_by,
                        "created_at": origin.created_at,
                        "raw_value": origin.raw_value,
                        "raw_data_snapshot": origin.raw_data,
                        "was_cleaned": origin.cleaned,
                        "cleaning_note": "原始值与当前值不同，可能经过清洗或修正" if origin.cleaned else "原始值与当前值一致",
                        "change_from_previous": origin.change_from_previous,
                    },
                }
                data_lineage.append(lineage_entry)
        
        return CalculationStep(
            step_id=str(uuid4()),
            step_name=step_name,
            description=description,
            formula=formula,
            inputs=inputs,
            output=output,
            data_lineage=data_lineage,
        )
    
    def _calculate_chart_metrics(
        self,
        version: ParameterVersion,
    ) -> Tuple[List[CalculationStep], List[BoundaryIssue]]:
        """计算图表指标，记录每一步，带上完整溯源"""
        steps: List[CalculationStep] = []
        issues: List[BoundaryIssue] = []
        
        params = version.parameters
        
        boundary_issues = self._check_boundary_conditions(version)
        issues.extend(boundary_issues)
        
        if "分子" in params and "分母" in params:
            result, div_issue = self._safe_divide(
                params["分子"],
                params["分母"],
                "分母",
                version,
            )
            if div_issue:
                div_issue.affected_calculations = ["计算比例"]
                issues.append(div_issue)
            
            steps.append(self._create_calculation_step(
                step_name="计算比例",
                description="计算分子除以分母的比例值，用于展示占比或通过率等指标",
                formula="比例 = 分子 / 分母",
                inputs={"分子": params["分子"], "分母": params["分母"]},
                output=result,
                version=version,
            ))
        
        if "总数" in params and "样本量" in params:
            result, div_issue = self._safe_divide(
                params["总数"],
                params["样本量"],
                "样本量",
                version,
            )
            if div_issue:
                div_issue.affected_calculations = ["计算均值"]
                issues.append(div_issue)
            
            steps.append(self._create_calculation_step(
                step_name="计算均值",
                description="计算总数除以样本量的平均值，用于展示单位均值",
                formula="均值 = 总数 / 样本量",
                inputs={"总数": params["总数"], "样本量": params["样本量"]},
                output=result,
                version=version,
            ))
        
        if "A值" in params and "B值" in params:
            steps.append(self._create_calculation_step(
                step_name="计算差值",
                description="计算A值与B值的差值，用于展示两者绝对差异",
                formula="差值 = A值 - B值",
                inputs={"A值": params["A值"], "B值": params["B值"]},
                output=params["A值"] - params["B值"],
                version=version,
            ))
            
            if params["B值"] != 0:
                growth_rate = ((params["A值"] - params["B值"]) / params["B值"]) * 100
                steps.append(self._create_calculation_step(
                    step_name="计算增长率",
                    description="计算相对B值的增长率百分比，用于展示相对变化幅度",
                    formula="增长率 = (A值 - B值) / B值 × 100%",
                    inputs={"A值": params["A值"], "B值": params["B值"]},
                    output=f"{growth_rate:.2f}%",
                    version=version,
                ))
            elif params["B值"] == 0:
                param_origin = self._build_param_origin("B值", version)
                fallback_id, fallback_name = self._find_last_valid_version(
                    "B值", version.version_id,
                    lambda v: isinstance(v, (int, float)) and v != 0,
                )
                fallback_hint = f"可回退到版本 '{fallback_name}'" if fallback_name else "请联系录入人确认"
                issues.append(BoundaryIssue(
                    issue_type="除零错误",
                    severity="high",
                    location=f"参数 'B值' 在版本 '{version.version_name}' 中",
                    message=(
                        f"参数 'B值' 为 0，无法计算增长率。\n"
                        f"来源：{param_origin.row_hint}"
                    ),
                    suggestion=(
                        f"处理建议：\n"
                        f"1. 检查来源：{param_origin.row_hint}\n"
                        f"2. 联系录入人 {param_origin.created_by} 确认\n"
                        f"3. {fallback_hint}"
                    ),
                    param_name="B值",
                    param_value=0,
                    version_id=version.version_id,
                    affected_calculations=["计算增长率"],
                    param_origin=param_origin,
                    fallback_version_hint=fallback_hint,
                    fallback_version_id=fallback_id,
                ))
        
        return steps, issues
    
    def _generate_plain_language_summary(
        self,
        version: ParameterVersion,
        steps: List[CalculationStep],
        issues: List[BoundaryIssue],
        changes: List[ParameterChange],
    ) -> str:
        """生成通俗易懂的解释，给不看代码的人听"""
        summary_parts = [
            f"本次计算使用的是版本 '{version.version_name}'，由 {version.created_by} 在 {version.created_at.strftime('%Y年%m月%d日 %H:%M')} 创建。",
            f"数据来源于 '{version.source.source_name}'。",
        ]
        
        if version.change_reason:
            summary_parts.append(f"本次调参原因：{version.change_reason}")
        
        if version.change_description:
            summary_parts.append(f"调整内容：{version.change_description}")
        
        if changes:
            summary_parts.append(f"本次相比上一版本共有 {len(changes)} 处参数变更：")
            for change in changes:
                summary_parts.append(f"  - {change.description}")
        
        if steps:
            summary_parts.append("计算过程如下：")
            for i, step in enumerate(steps, 1):
                summary_parts.append(f"  {i}. {step.description}")
                summary_parts.append(f"     公式：{step.formula}")
                summary_parts.append(f"     输入值：{step.inputs}")
                if isinstance(step.output, float) and np.isnan(step.output):
                    summary_parts.append(f"     结果：⚠️ 无法计算（存在异常数据）")
                else:
                    summary_parts.append(f"     结果：{step.output}")
                
                if step.data_lineage:
                    for dl in step.data_lineage:
                        o = dl["origin"]
                        cleaned_note = "（经过清洗修正）" if o["was_cleaned"] else ""
                        summary_parts.append(
                            f"       ↳ 参数 '{dl['input_name']}' = {o['param_value']}{cleaned_note}，"
                            f"来自 {o['source_location']}，录入人 {o['created_by']}"
                        )
        
        if issues:
            high_issues = [i for i in issues if i.severity == "high"]
            medium_issues = [i for i in issues if i.severity == "medium"]
            if high_issues:
                summary_parts.append(f"\n⚠️  发现 {len(high_issues)} 个严重问题需要注意：")
                for issue in high_issues:
                    summary_parts.append(f"  🔴 {issue.message}")
                    if issue.param_origin:
                        summary_parts.append(f"     定位：{issue.param_origin.row_hint}")
                    if issue.fallback_version_hint:
                        summary_parts.append(f"     建议：{issue.fallback_version_hint}")
            if medium_issues:
                summary_parts.append(f"\n⚡ 发现 {len(medium_issues)} 个潜在风险：")
                for issue in medium_issues:
                    summary_parts.append(f"  🟡 {issue.message}")
        
        return "\n".join(summary_parts)
    
    def _generate_key_findings(
        self,
        steps: List[CalculationStep],
        issues: List[BoundaryIssue],
    ) -> List[str]:
        """生成关键结论"""
        findings = []
        
        for step in steps:
            if "比例" in step.step_name:
                if isinstance(step.output, (int, float)) and not np.isnan(step.output):
                    findings.append(f"比例为 {step.output:.4f}（即 {step.output*100:.2f}%）")
                else:
                    findings.append(f"比例：无法计算（分母异常，请检查数据来源）")
            elif "均值" in step.step_name:
                if isinstance(step.output, (int, float)) and not np.isnan(step.output):
                    findings.append(f"均值为 {step.output:.4f}")
                else:
                    findings.append(f"均值：无法计算（样本量异常，请检查数据来源）")
            elif "差值" in step.step_name:
                findings.append(f"差值为 {step.output}")
            elif "增长率" in step.step_name:
                findings.append(f"增长率为 {step.output}")
        
        if issues:
            findings.append(f"共发现 {len(issues)} 个边界问题，其中 {len([i for i in issues if i.severity=='high'])} 个严重")
        
        return findings
    
    def explain(
        self,
        version_id: Optional[str] = None,
        title: str = "优化调参图表解释",
    ) -> ChartExplanation:
        """
        生成图表解释
        社区公示前要能讲给不看代码的人听
        """
        if version_id is None:
            version = self.parameter_manager.get_active_version()
            if version is None:
                raise ValueError("没有可用的参数版本，请先导入参数")
        else:
            version = self.parameter_manager.get_version(version_id)
            if version is None:
                raise ValueError(f"版本不存在: {version_id}")
        
        changes: List[ParameterChange] = []
        if version.parent_version_id:
            changes = self.parameter_manager.compare_versions(
                version.parent_version_id,
                version.version_id,
            )
        
        steps, issues = self._calculate_chart_metrics(version)
        
        data_sources = []
        seen_sources = set()
        for param_name in version.parameters.keys():
            origin = self._build_param_origin(param_name, version)
            source_key = (origin.source_type, origin.source_id)
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                data_sources.append({
                    "source_type": origin.source_type,
                    "source_id": origin.source_id,
                    "source_name": origin.source_name,
                    "first_seen_at": origin.created_at,
                    "first_seen_by": origin.created_by,
                    "raw_data": origin.raw_data,
                })
        
        explanation = ChartExplanation(
            explanation_id=str(uuid4()),
            version_id=version.version_id,
            version_name=version.version_name,
            title=title,
            plain_language_summary=self._generate_plain_language_summary(version, steps, issues, changes),
            key_findings=self._generate_key_findings(steps, issues),
            calculation_steps=steps,
            boundary_issues=issues,
            data_sources=data_sources,
            parameter_changes=[c.__dict__ for c in changes],
        )
        
        self._explanations[explanation.explanation_id] = explanation
        return explanation
    
    def trace_bad_data(
        self,
        param_name: str,
        explanation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        追溯坏数据来源 - 校准版
        区分：首次出现、首次异常、最后一次变更、导致结果变化的关键变更
        定位到具体的原始对象/表格行，而不是版本编号
        """
        history = self.parameter_manager.trace_parameter_origin(param_name)
        
        if not history:
            return {
                "param_name": param_name,
                "found": False,
                "message": f"未找到参数 '{param_name}' 的历史记录",
            }
        
        def is_abnormal(value):
            if not isinstance(value, (int, float)):
                return False
            if param_name in ["分母", "除数", "比例基数", "B值"]:
                return abs(value) < 1e-10
            if param_name in ["样本量", "计数", "频率"]:
                return value < 0
            return False
        
        first_occurrence = history[0]
        
        first_abnormal = None
        for entry in history:
            if is_abnormal(entry["value"]):
                first_abnormal = entry
                break
        
        last_change = None
        if len(history) >= 2:
            for i in range(len(history) - 1, 0, -1):
                if history[i]["value"] != history[i-1]["value"]:
                    last_change = {
                        "from_value": history[i-1]["value"],
                        "to_value": history[i]["value"],
                        "from_version": history[i-1]["version_name"],
                        "to_version": history[i]["version_name"],
                        "changed_by": history[i]["created_by"],
                        "source_name": history[i]["source_name"],
                        "source_id": history[i]["source_id"],
                        "row_hint": f"来源 '{history[i]['source_name']}' (ID: {history[i]['source_id']})，参数 '{param_name}'",
                        "description": f"{history[i-1]['version_name']} ({history[i-1]['value']}) → {history[i]['version_name']} ({history[i]['value']})",
                    }
                    break
        
        critical_changes = []
        for i in range(1, len(history)):
            prev_normal = not is_abnormal(history[i-1]["value"])
            curr_abnormal = is_abnormal(history[i]["value"])
            if prev_normal and curr_abnormal:
                critical_changes.append({
                    "step": i,
                    "description": f"正常值 → 异常值：从 {history[i-1]['value']} 变为 {history[i]['value']}",
                    "from_version": history[i-1]["version_name"],
                    "to_version": history[i]["version_name"],
                    "changed_by": history[i]["created_by"],
                    "source_name": history[i]["source_name"],
                    "source_id": history[i]["source_id"],
                    "raw_data": history[i]["raw_data"],
                    "row_hint": f"来源 '{history[i]['source_name']}' (ID: {history[i]['source_id']})，参数 '{param_name}'，录入人 {history[i]['created_by']}",
                })
            elif is_abnormal(history[i-1]["value"]) and not is_abnormal(history[i]["value"]):
                critical_changes.append({
                    "step": i,
                    "description": f"异常值 → 正常值：从 {history[i-1]['value']} 变为 {history[i]['value']}（已修复）",
                    "from_version": history[i-1]["version_name"],
                    "to_version": history[i]["version_name"],
                    "changed_by": history[i]["created_by"],
                    "source_name": history[i]["source_name"],
                    "source_id": history[i]["source_id"],
                    "raw_data": history[i]["raw_data"],
                    "row_hint": f"来源 '{history[i]['source_name']}' (ID: {history[i]['source_id']})，参数 '{param_name}'，录入人 {history[i]['created_by']}",
                })
        
        current_value = history[-1]["value"]
        current_is_abnormal = is_abnormal(current_value)
        
        suggestion_parts = []
        suggestion_parts.append(f"📌 参数 '{param_name}' 追溯报告：")
        suggestion_parts.append(f"")
        suggestion_parts.append(f"1. 【首次出现】")
        suggestion_parts.append(f"   版本: {first_occurrence['version_name']}")
        suggestion_parts.append(f"   初始值: {first_occurrence['value']}")
        suggestion_parts.append(f"   来源: {first_occurrence['source_name']} (ID: {first_occurrence['source_id']})")
        suggestion_parts.append(f"   录入人: {first_occurrence['created_by']}，时间: {first_occurrence['created_at']}")
        suggestion_parts.append(f"   原始数据: {json.dumps(first_occurrence['raw_data'], ensure_ascii=False)}")
        
        if first_abnormal:
            suggestion_parts.append(f"")
            suggestion_parts.append(f"2. 【首次异常】⚠️")
            suggestion_parts.append(f"   版本: {first_abnormal['version_name']}")
            suggestion_parts.append(f"   异常值: {first_abnormal['value']}")
            suggestion_parts.append(f"   来源: {first_abnormal['source_name']} (ID: {first_abnormal['source_id']})")
            suggestion_parts.append(f"   录入人: {first_abnormal['created_by']}，时间: {first_abnormal['created_at']}")
            suggestion_parts.append(f"   定位: '{first_abnormal['source_name']}' 中参数 '{param_name}' 的值为 {first_abnormal['value']}")
            suggestion_parts.append(f"   建议: 联系 {first_abnormal['created_by']} 确认该条记录是否正确")
        
        if last_change:
            suggestion_parts.append(f"")
            suggestion_parts.append(f"3. 【最后一次变更】")
            suggestion_parts.append(f"   {last_change['description']}")
            suggestion_parts.append(f"   {last_change['row_hint']}")
            suggestion_parts.append(f"   变更人: {last_change['changed_by']}")
        
        if critical_changes:
            suggestion_parts.append(f"")
            suggestion_parts.append(f"4. 【导致异常的关键变更】")
            for j, cc in enumerate(critical_changes, 1):
                suggestion_parts.append(f"   {j}. {cc['description']}")
                suggestion_parts.append(f"      定位: {cc['row_hint']}")
                suggestion_parts.append(f"      原始数据: {json.dumps(cc['raw_data'], ensure_ascii=False)}")
        
        suggestion_parts.append(f"")
        suggestion_parts.append(f"5. 【当前状态】")
        if current_is_abnormal:
            suggestion_parts.append(f"   ⚠️ 当前值 {current_value} 仍为异常")
            valid_versions = [h for h in history if not is_abnormal(h["value"])]
            if valid_versions:
                last_valid = valid_versions[-1]
                suggestion_parts.append(f"   建议: 回退到版本 '{last_valid['version_name']}'，该版本值为 {last_valid['value']}")
                suggestion_parts.append(f"         或联系录入人 {history[-1]['created_by']} 补录确认")
            else:
                suggestion_parts.append(f"   建议: 联系录入人 {history[-1]['created_by']} 补录有效数据")
        else:
            suggestion_parts.append(f"   ✓ 当前值 {current_value} 正常")
        
        suggestion_parts.append(f"")
        suggestion_parts.append(f"6. 【命令快速定位】")
        suggestion_parts.append(f"   python -m src.cli trace --param {param_name}")
        suggestion_parts.append(f"   python -m src.cli explain --version {history[-1]['version_name']}")
        
        return {
            "param_name": param_name,
            "found": True,
            "current_value": current_value,
            "current_is_abnormal": current_is_abnormal,
            "history": history,
            "first_occurrence": first_occurrence,
            "first_abnormal": first_abnormal,
            "last_change": last_change,
            "critical_changes": critical_changes,
            "valid_versions": [
                {"version_name": h["version_name"], "value": h["value"]}
                for h in history if not is_abnormal(h["value"])
            ],
            "suggestion": "\n".join(suggestion_parts),
        }
    
    def compare_explanations(
        self,
        explanation_id1: str,
        explanation_id2: str,
    ) -> Dict[str, Any]:
        """比较两个解释，看出哪一步让结果变化"""
        e1 = self._explanations.get(explanation_id1)
        e2 = self._explanations.get(explanation_id2)
        
        if e1 is None or e2 is None:
            raise ValueError("解释不存在")
        
        changes = self.parameter_manager.compare_versions(e1.version_id, e2.version_id)
        
        step_changes = []
        all_steps = set()
        for s in e1.calculation_steps:
            all_steps.add(s.step_name)
        for s in e2.calculation_steps:
            all_steps.add(s.step_name)
        
        for step_name in sorted(all_steps):
            s1 = next((s for s in e1.calculation_steps if s.step_name == step_name), None)
            s2 = next((s for s in e2.calculation_steps if s.step_name == step_name), None)
            
            if s1 is None:
                step_changes.append({
                    "step_name": step_name,
                    "change_type": "新增",
                    "description": f"新增计算步骤 '{step_name}'，结果为 {s2.output}",
                })
            elif s2 is None:
                step_changes.append({
                    "step_name": step_name,
                    "change_type": "删除",
                    "description": f"删除计算步骤 '{step_name}'，原结果为 {s1.output}",
                })
            elif s1.output != s2.output:
                causing_params = []
                for c in changes:
                    if c.param_name in s2.inputs:
                        causing_params.append(c.param_name)
                step_changes.append({
                    "step_name": step_name,
                    "change_type": "结果变化",
                    "description": f"步骤 '{step_name}' 结果从 {s1.output} 变为 {s2.output}",
                    "caused_by": causing_params if causing_params else ["计算逻辑变更"],
                })
        
        return {
            "version1": e1.version_name,
            "version2": e2.version_name,
            "parameter_changes": [c.description for c in changes],
            "step_changes": step_changes,
            "key_differences": self._generate_comparison_summary(changes, step_changes),
        }
    
    def _generate_comparison_summary(
        self,
        param_changes: List[ParameterChange],
        step_changes: List[Dict[str, Any]],
    ) -> List[str]:
        """生成比较总结"""
        diffs = []
        
        if param_changes:
            diffs.append(f"参数变更 {len(param_changes)} 处：")
            for c in param_changes:
                diffs.append(f"  - {c.description}")
        
        if step_changes:
            diffs.append(f"计算结果变化 {len(step_changes)} 处：")
            for s in step_changes:
                desc = f"  - {s['description']}"
                if "caused_by" in s:
                    desc += f"（由参数 {', '.join(s['caused_by'])} 变更导致）"
                diffs.append(desc)
        
        if not diffs:
            diffs.append("两个版本的参数和计算结果完全一致")
        
        return diffs
    
    def list_explanations(self) -> List[Dict[str, Any]]:
        """列出所有解释"""
        return [
            {
                "explanation_id": eid,
                "version_name": exp.version_name,
                "title": exp.title,
                "generated_at": exp.generated_at.isoformat(),
                "issues_count": len(exp.boundary_issues),
            }
            for eid, exp in self._explanations.items()
        ]
