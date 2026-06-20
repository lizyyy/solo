"""图表解释引擎 - 支持参数变更追溯、除零边界处理、数据溯源"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import uuid4

import numpy as np
import pandas as pd

from .parameter_manager import ParameterManager, ParameterVersion, ParameterChange


@dataclass
class BoundaryIssue:
    """边界问题记录 - 如除零等"""
    issue_type: str
    severity: str
    location: str
    message: str
    suggestion: str
    param_name: Optional[str] = None
    param_value: Optional[Any] = None
    version_id: Optional[str] = None
    
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
        }


@dataclass
class CalculationStep:
    """计算步骤 - 用于解释数字从哪来"""
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
    
    def _safe_divide(
        self,
        numerator: float,
        denominator: float,
        param_name: str,
        version_id: str,
        epsilon: float = 1e-10,
    ) -> Tuple[float, Optional[BoundaryIssue]]:
        """
        安全除法 - 处理除零边界情况
        不仅警告，还要告诉接手的人该怎么处理
        """
        if abs(denominator) < epsilon:
            issue = BoundaryIssue(
                issue_type="除零错误",
                severity="high",
                location=f"参数 '{param_name}' 用于除法计算时",
                message=f"分母值为 {denominator}，接近或等于零，可能导致计算结果异常。",
                suggestion=(
                    f"处理建议：\n"
                    f"1. 检查参数 '{param_name}' 的来源数据是否正确\n"
                    f"2. 确认该值为零是否合理，若合理可使用一个极小值（如 {epsilon}）替代\n"
                    f"3. 若该值不应为零，请追溯参数来源：{version_id}\n"
                    f"4. 可设置合理的默认值或跳过该指标计算"
                ),
                param_name=param_name,
                param_value=denominator,
                version_id=version_id,
            )
            warnings.warn(issue.message)
            return np.nan, issue
        
        return numerator / denominator, None
    
    def _check_boundary_conditions(
        self,
        parameters: Dict[str, Any],
        version_id: str,
    ) -> List[BoundaryIssue]:
        """检查边界条件，如除零、负数开方等"""
        issues: List[BoundaryIssue] = []
        
        for param_name, value in parameters.items():
            if isinstance(value, (int, float)):
                if value == 0 and param_name in ["分母", "除数", "比例基数"]:
                    issues.append(BoundaryIssue(
                        issue_type="零值风险",
                        severity="medium",
                        location=f"参数 '{param_name}'",
                        message=f"参数 '{param_name}' 值为 0，可能在后续除法计算中导致问题。",
                        suggestion=(
                            f"处理建议：\n"
                            f"1. 确认该参数为0是否合理\n"
                            f"2. 若合理，考虑在计算时添加极小值偏移\n"
                            f"3. 追溯该参数的来源：{param_name}"
                        ),
                        param_name=param_name,
                        param_value=value,
                        version_id=version_id,
                    ))
                
                if value < 0 and param_name in ["样本量", "计数", "频率"]:
                    issues.append(BoundaryIssue(
                        issue_type="负值异常",
                        severity="high",
                        location=f"参数 '{param_name}'",
                        message=f"参数 '{param_name}' 为负值 ({value})，这类参数通常不应为负。",
                        suggestion=(
                            f"处理建议：\n"
                            f"1. 检查原始数据录入是否错误\n"
                            f"2. 追溯该参数来源，确认是否有符号错误\n"
                            f"3. 若为计算结果，检查上一步计算逻辑"
                        ),
                        param_name=param_name,
                        param_value=value,
                        version_id=version_id,
                    ))
        
        return issues
    
    def _create_calculation_step(
        self,
        step_name: str,
        description: str,
        formula: str,
        inputs: Dict[str, Any],
        output: Any,
        param_manager: ParameterManager,
    ) -> CalculationStep:
        """创建计算步骤，包含数据溯源"""
        data_lineage = []
        for input_name, input_value in inputs.items():
            if isinstance(input_value, str) and input_value in param_manager.get_active_version().parameters:
                origin = param_manager.trace_parameter_origin(input_value)
                if origin:
                    data_lineage.append({
                        "input_name": input_name,
                        "value": input_value,
                        "origin": origin,
                    })
        
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
        """计算图表指标，记录每一步"""
        steps: List[CalculationStep] = []
        issues: List[BoundaryIssue] = []
        
        params = version.parameters
        version_id = version.version_id
        
        boundary_issues = self._check_boundary_conditions(params, version_id)
        issues.extend(boundary_issues)
        
        if "分子" in params and "分母" in params:
            result, div_issue = self._safe_divide(
                params["分子"],
                params["分母"],
                "分母",
                version_id,
            )
            if div_issue:
                issues.append(div_issue)
            
            steps.append(self._create_calculation_step(
                step_name="计算比例",
                description="计算分子除以分母的比例值",
                formula="比例 = 分子 / 分母",
                inputs={"分子": params["分子"], "分母": params["分母"]},
                output=result,
                param_manager=self.parameter_manager,
            ))
        
        if "总数" in params and "样本量" in params:
            result, div_issue = self._safe_divide(
                params["总数"],
                params["样本量"],
                "样本量",
                version_id,
            )
            if div_issue:
                issues.append(div_issue)
            
            steps.append(self._create_calculation_step(
                step_name="计算均值",
                description="计算总数除以样本量的平均值",
                formula="均值 = 总数 / 样本量",
                inputs={"总数": params["总数"], "样本量": params["样本量"]},
                output=result,
                param_manager=self.parameter_manager,
            ))
        
        if "A值" in params and "B值" in params:
            steps.append(self._create_calculation_step(
                step_name="计算差值",
                description="计算A值与B值的差值",
                formula="差值 = A值 - B值",
                inputs={"A值": params["A值"], "B值": params["B值"]},
                output=params["A值"] - params["B值"],
                param_manager=self.parameter_manager,
            ))
            
            if params["B值"] != 0:
                growth_rate = ((params["A值"] - params["B值"]) / params["B值"]) * 100
                steps.append(self._create_calculation_step(
                    step_name="计算增长率",
                    description="计算相对B值的增长率百分比",
                    formula="增长率 = (A值 - B值) / B值 × 100%",
                    inputs={"A值": params["A值"], "B值": params["B值"]},
                    output=f"{growth_rate:.2f}%",
                    param_manager=self.parameter_manager,
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
            for step in steps:
                summary_parts.append(f"  - {step.description}：{step.formula}")
                summary_parts.append(f"    输入：{step.inputs}，结果：{step.output}")
        
        if issues:
            high_issues = [i for i in issues if i.severity == "high"]
            medium_issues = [i for i in issues if i.severity == "medium"]
            if high_issues:
                summary_parts.append(f"⚠️  发现 {len(high_issues)} 个严重问题需要注意：")
                for issue in high_issues:
                    summary_parts.append(f"  - {issue.message}")
                    summary_parts.append(f"    {issue.suggestion}")
            if medium_issues:
                summary_parts.append(f"⚡ 发现 {len(medium_issues)} 个潜在风险：")
                for issue in medium_issues:
                    summary_parts.append(f"  - {issue.message}")
        
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
                    findings.append(f"计算得出的比例为 {step.output:.4f}（{step.output*100:.2f}%）")
            elif "均值" in step.step_name:
                if isinstance(step.output, (int, float)) and not np.isnan(step.output):
                    findings.append(f"计算得出的均值为 {step.output:.4f}")
            elif "差值" in step.step_name:
                findings.append(f"两者差值为 {step.output}")
            elif "增长率" in step.step_name:
                findings.append(f"增长率为 {step.output}")
        
        if issues:
            findings.append(f"本次计算发现 {len(issues)} 个边界问题，详见问题列表")
        
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
            origin = self.parameter_manager.trace_parameter_origin(param_name)
            if origin:
                first = origin[0]
                source_key = (first["source_type"], first["source_id"])
                if source_key not in seen_sources:
                    seen_sources.add(source_key)
                    data_sources.append({
                        "source_type": first["source_type"],
                        "source_id": first["source_id"],
                        "source_name": first["source_name"],
                        "first_seen_at": first["created_at"],
                        "first_seen_by": first["created_by"],
                        "raw_data": first["raw_data"],
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
        追溯坏数据来源
        坏数据影响结果时，接手的人能顺着提示回到参数表的原始对象
        """
        history = self.parameter_manager.trace_parameter_origin(param_name)
        
        if not history:
            return {
                "param_name": param_name,
                "found": False,
                "message": f"未找到参数 '{param_name}' 的历史记录",
            }
        
        first_occurrence = history[0]
        
        return {
            "param_name": param_name,
            "found": True,
            "history": history,
            "first_occurrence": first_occurrence,
            "current_value": history[-1]["value"],
            "suggestion": (
                f"追溯路径：\n"
                f"1. 查看原始数据来源：{first_occurrence['source_name']} (ID: {first_occurrence['source_id']})\n"
                f"2. 检查首次导入时的原始数据：{first_occurrence['raw_data']}\n"
                f"3. 联系首次录入人：{first_occurrence['created_by']}\n"
                f"4. 查看该参数的所有变更记录，确认哪一步引入了问题"
            ),
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
                step_changes.append({
                    "step_name": step_name,
                    "change_type": "结果变化",
                    "description": f"步骤 '{step_name}' 结果从 {s1.output} 变为 {s2.output}",
                    "reason": "参数变更导致" if changes else "计算逻辑变更",
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
                diffs.append(f"  - {s['description']}")
        
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
