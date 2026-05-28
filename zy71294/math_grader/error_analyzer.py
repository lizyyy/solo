"""错因分析与批改报告生成模块"""

from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

from .step_checker import StepCheckResult, StepStatus


class ErrorType(Enum):
    """错误类型"""
    SYNTAX_ERROR = "syntax_error"
    ALGEBRAIC_MISTAKE = "algebraic_mistake"
    DIVISION_BY_ZERO = "division_by_zero"
    DOMAIN_VIOLATION = "domain_violation"
    CONSTRAINT_VIOLATION = "constraint_violation"
    VARIABLE_MISMATCH = "variable_mismatch"
    UNKNOWN = "unknown"


@dataclass
class ErrorAnalysis:
    """错误分析结果"""
    error_type: ErrorType
    severity: str
    description: str
    suggestion: str
    location: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "error_type": self.error_type.value,
            "severity": self.severity,
            "description": self.description,
            "suggestion": self.suggestion,
            "location": self.location
        }


class ErrorAnalyzer:
    """错因分析器"""
    
    @staticmethod
    def analyze_step(step_result: StepCheckResult) -> List[ErrorAnalysis]:
        """分析单步错误原因"""
        errors = []
        
        for err_msg in step_result.error_messages:
            if "解析错误" in err_msg or "无效" in err_msg:
                errors.append(ErrorAnalysis(
                    error_type=ErrorType.SYNTAX_ERROR,
                    severity="error",
                    description=f"表达式语法错误: {err_msg}",
                    suggestion="请检查表达式的括号、运算符、函数名是否正确",
                    location=f"第{step_result.step_index}步"
                ))
        
        if not step_result.is_equivalent and not step_result.error_messages:
            errors.append(ErrorAnalysis(
                error_type=ErrorType.ALGEBRAIC_MISTAKE,
                severity="error",
                description=f"代数变形错误: {step_result.equivalence_reason}",
                suggestion="建议检查符号变化、分配律、合并同类项等基本运算规则",
                location=f"第{step_result.step_index}步: {step_result.from_expr} → {step_result.to_expr}"
            ))
        
        for violation in step_result.domain_violations:
            if "分母" in violation:
                errors.append(ErrorAnalysis(
                    error_type=ErrorType.DIVISION_BY_ZERO,
                    severity="warning",
                    description=f"定义域问题: {violation}",
                    suggestion="请注明分母不为零的条件，或检查是否存在除零风险",
                    location=f"第{step_result.step_index}步"
                ))
            elif "根号" in violation:
                errors.append(ErrorAnalysis(
                    error_type=ErrorType.DOMAIN_VIOLATION,
                    severity="warning",
                    description=f"定义域问题: {violation}",
                    suggestion="请注明根号内表达式非负的条件",
                    location=f"第{step_result.step_index}步"
                ))
            elif "对数" in violation:
                errors.append(ErrorAnalysis(
                    error_type=ErrorType.DOMAIN_VIOLATION,
                    severity="warning",
                    description=f"定义域问题: {violation}",
                    suggestion="请注明对数参数必须大于零的条件",
                    location=f"第{step_result.step_index}步"
                ))
        
        for constraint in step_result.constraint_violations:
            errors.append(ErrorAnalysis(
                error_type=ErrorType.CONSTRAINT_VIOLATION,
                severity="warning",
                description=f"违反变量约束: {constraint}",
                suggestion="请确保变形在题目给定的约束条件下进行",
                location=f"第{step_result.step_index}步"
            ))
        
        return errors


@dataclass
class GradeReport:
    """批改报告"""
    problem_id: str
    student_name: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    steps: List[str] = field(default_factory=list)
    standard_expression: str = ""
    student_answer: str = ""
    constraints: List[str] = field(default_factory=list)
    step_results: List[StepCheckResult] = field(default_factory=list)
    errors: List[ErrorAnalysis] = field(default_factory=list)
    overall_score: float = 0.0
    is_correct: bool = False
    summary: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "problem_id": self.problem_id,
            "student_name": self.student_name,
            "timestamp": self.timestamp,
            "steps": self.steps,
            "standard_expression": self.standard_expression,
            "student_answer": self.student_answer,
            "constraints": self.constraints,
            "step_results": [sr.to_dict() for sr in self.step_results],
            "errors": [e.to_dict() for e in self.errors],
            "overall_score": self.overall_score,
            "is_correct": self.is_correct,
            "summary": self.summary,
            "details": self.details
        }


class ReportGenerator:
    """报告生成器"""
    
    @staticmethod
    def generate_report(
        problem_id: str,
        student_answer: str,
        standard_expression: str,
        steps: List[str],
        constraints: Optional[List[str]] = None,
        student_name: str = ""
    ) -> GradeReport:
        """生成批改报告"""
        from .step_checker import StepChecker
        
        constraints = constraints or []
        
        all_steps = [standard_expression] + steps + [student_answer]
        
        checker = StepChecker()
        step_results = checker.check_all_steps(all_steps, constraints)
        
        all_errors = []
        for sr in step_results:
            all_errors.extend(ErrorAnalyzer.analyze_step(sr))
        
        critical_errors = [e for e in all_errors if e.severity == "error"]
        warnings = [e for e in all_errors if e.severity == "warning"]
        
        total_steps = len(step_results)
        correct_steps = sum(1 for sr in step_results if sr.status == StepStatus.CORRECT)
        is_correct = len(critical_errors) == 0
        
        if total_steps > 0:
            base_score = (correct_steps / total_steps) * 80
            warning_penalty = len(warnings) * 2
            overall_score = max(0, min(100, base_score - warning_penalty))
        else:
            overall_score = 100 if is_correct else 0
        
        summary_parts = []
        if is_correct:
            summary_parts.append("答案正确")
        else:
            summary_parts.append(f"存在{len(critical_errors)}处错误")
        if warnings:
            summary_parts.append(f"有{len(warnings)}个需要注意的问题")
        
        summary = "，".join(summary_parts) if summary_parts else "批改完成"
        
        report = GradeReport(
            problem_id=problem_id,
            student_name=student_name,
            steps=steps,
            standard_expression=standard_expression,
            student_answer=student_answer,
            constraints=constraints,
            step_results=step_results,
            errors=all_errors,
            overall_score=round(overall_score, 1),
            is_correct=is_correct,
            summary=summary,
            details={
                "correct_steps": correct_steps,
                "total_steps": total_steps,
                "warning_count": len(warnings),
                "error_count": len(critical_errors)
            }
        )
        
        return report
    
    @staticmethod
    def format_text_report(report: GradeReport, detailed: bool = True) -> str:
        """格式化文本报告"""
        lines = []
        lines.append("=" * 60)
        lines.append(f"数学作业批改报告")
        lines.append("=" * 60)
        lines.append(f"题号: {report.problem_id}")
        if report.student_name:
            lines.append(f"学生: {report.student_name}")
        lines.append(f"时间: {report.timestamp}")
        lines.append("-" * 60)
        lines.append(f"标准式: {report.standard_expression}")
        lines.append(f"学生答案: {report.student_answer}")
        lines.append(f"得分: {report.overall_score}/100")
        lines.append(f"结果: {'✓ 正确' if report.is_correct else '✗ 错误'}")
        lines.append(f"摘要: {report.summary}")
        lines.append("-" * 60)
        
        if detailed and report.step_results:
            lines.append("变形步骤检查:")
            for i, sr in enumerate(report.step_results):
                status_icon = "✓" if sr.status == StepStatus.CORRECT else "✗" if sr.status == StepStatus.INCORRECT else "⚠"
                lines.append(f"  [{status_icon}] 步骤{i+1}: {sr.from_expr} → {sr.to_expr}")
                lines.append(f"       {sr.equivalence_reason}")
                if sr.domain_violations:
                    for v in sr.domain_violations:
                        lines.append(f"       ⚠ {v}")
                if sr.constraint_violations:
                    for c in sr.constraint_violations:
                        lines.append(f"       ⚠ 违反约束: {c}")
        
        if detailed and report.errors:
            lines.append("-" * 60)
            lines.append("错因分析:")
            for i, err in enumerate(report.errors, 1):
                icon = "✗" if err.severity == "error" else "⚠"
                lines.append(f"  {i}. [{icon}] {err.description}")
                lines.append(f"     建议: {err.suggestion}")
                if err.location:
                    lines.append(f"     位置: {err.location}")
        
        lines.append("=" * 60)
        return "\n".join(lines)
    
    @staticmethod
    def format_markdown_report(report: GradeReport, detailed: bool = True) -> str:
        """格式化Markdown报告"""
        lines = []
        lines.append("# 数学作业批改报告\n")
        lines.append(f"**题号**: {report.problem_id}  ")
        if report.student_name:
            lines.append(f"**学生**: {report.student_name}  ")
        lines.append(f"**时间**: {report.timestamp}  ")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append(f"- **标准式**: `{report.standard_expression}`")
        lines.append(f"- **学生答案**: `{report.student_answer}`")
        lines.append(f"- **得分**: **{report.overall_score}**/100")
        lines.append(f"- **结果**: {'✅ 正确' if report.is_correct else '❌ 错误'}")
        lines.append(f"- **摘要**: {report.summary}")
        lines.append("")
        
        if report.constraints:
            lines.append("## 变量约束")
            for c in report.constraints:
                lines.append(f"- `{c}`")
            lines.append("")
        
        if detailed and report.step_results:
            lines.append("## 变形步骤检查")
            for i, sr in enumerate(report.step_results):
                status_icon = "✅" if sr.status == StepStatus.CORRECT else "❌" if sr.status == StepStatus.INCORRECT else "⚠️"
                lines.append(f"### {status_icon} 步骤{i+1}")
                lines.append(f"```")
                lines.append(f"{sr.from_expr} → {sr.to_expr}")
                lines.append(f"```")
                lines.append(f"- 等价性: {sr.equivalence_reason}")
                if sr.domain_violations:
                    lines.append("- **定义域问题**:")
                    for v in sr.domain_violations:
                        lines.append(f"  - ⚠️ {v}")
                if sr.constraint_violations:
                    lines.append("- **违反约束**:")
                    for c in sr.constraint_violations:
                        lines.append(f"  - ⚠️ {c}")
                lines.append("")
        
        if detailed and report.errors:
            lines.append("## 错因分析")
            for i, err in enumerate(report.errors, 1):
                icon = "❌" if err.severity == "error" else "⚠️"
                lines.append(f"### {icon} 问题{i}")
                lines.append(f"- **类型**: {err.error_type.value}")
                lines.append(f"- **描述**: {err.description}")
                lines.append(f"- **建议**: {err.suggestion}")
                if err.location:
                    lines.append(f"- **位置**: {err.location}")
                lines.append("")
        
        return "\n".join(lines)
