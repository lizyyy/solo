"""Report exporters for analysis results."""

import json
from abc import ABC, abstractmethod
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from decorator_analyzer.models import (
    AnalysisResult,
    CallEvent,
    DecoratedFunction,
    DecoratorType,
    Risk,
    RiskLevel,
    RiskType,
)


class EnhancedJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles dataclasses, enums, and datetime."""

    def default(self, obj: Any) -> Any:
        if is_dataclass(obj):
            return asdict(obj)
        if isinstance(obj, (DecoratorType, RiskLevel, RiskType)):
            return obj.value
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, set):
            return list(obj)
        return super().default(obj)


class ReportExporter(ABC):
    """Base class for report exporters."""

    @abstractmethod
    def export(self, result: AnalysisResult, output_path: Path) -> None:
        """Export the analysis result to a file."""
        pass

    @abstractmethod
    def export_compare(
        self, results: list[AnalysisResult], output_path: Path, labels: Optional[list[str]] = None
    ) -> None:
        """Export a comparison of multiple analysis results."""
        pass


class JsonExporter(ReportExporter):
    """Export analysis results to JSON format."""

    def export(self, result: AnalysisResult, output_path: Path) -> None:
        """Export a single analysis result to JSON."""
        data = {
            "analysis_id": result.id,
            "timestamp": result.timestamp.isoformat(),
            "summary": self._generate_summary(result),
            "decorated_functions": [
                self._function_to_dict(func) for func in result.decorated_functions
            ],
            "call_events": [self._event_to_dict(event) for event in result.call_events],
            "risks": [self._risk_to_dict(risk) for risk in result.risks],
            "signature_checks": [asdict(c) for c in result.signature_checks],
            "metadata_checks": [asdict(c) for c in result.metadata_checks],
        }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=EnhancedJSONEncoder, indent=2, ensure_ascii=False)

    def export_compare(
        self, results: list[AnalysisResult], output_path: Path, labels: Optional[list[str]] = None
    ) -> None:
        """Export a comparison of multiple analysis results to JSON."""
        comparison_data = {
            "comparison_timestamp": datetime.now().isoformat(),
            "results": [],
        }
        
        for idx, result in enumerate(results):
            label = labels[idx] if labels and idx < len(labels) else f"result_{idx + 1}"
            comparison_data["results"].append({
                "label": label,
                "analysis_id": result.id,
                "timestamp": result.timestamp.isoformat(),
                "summary": self._generate_summary(result),
            })
        
        comparison_data["differences"] = self._find_differences(results)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(comparison_data, f, cls=EnhancedJSONEncoder, indent=2, ensure_ascii=False)

    def _generate_summary(self, result: AnalysisResult) -> dict[str, Any]:
        """Generate a summary of the analysis result."""
        risk_by_level: dict[str, int] = {}
        risk_by_type: dict[str, int] = {}
        
        for risk in result.risks:
            level = risk.level.value
            risk_by_level[level] = risk_by_level.get(level, 0) + 1
            
            rtype = risk.risk_type.value
            risk_by_type[rtype] = risk_by_type.get(rtype, 0) + 1
        
        return {
            "total_functions": len(result.decorated_functions),
            "total_events": len(result.call_events),
            "total_risks": len(result.risks),
            "risks_by_level": risk_by_level,
            "risks_by_type": risk_by_type,
            "decorator_types": self._count_decorator_types(result),
        }

    def _count_decorator_types(self, result: AnalysisResult) -> dict[str, int]:
        """Count decorator types in the result."""
        counts: dict[str, int] = {}
        for func in result.decorated_functions:
            for dec in func.decorators:
                dtype = dec.decorator_type.value
                counts[dtype] = counts.get(dtype, 0) + 1
        return counts

    def _function_to_dict(self, func: DecoratedFunction) -> dict[str, Any]:
        """Convert a DecoratedFunction to a dict."""
        return {
            "id": func.id,
            "function": {
                "name": func.function.name,
                "module": func.function.module,
                "signature": func.function.signature,
                "docstring": func.function.docstring,
                "is_async": func.function.is_async,
                "is_method": func.function.is_method,
                "annotations": func.function.annotations,
            },
            "decorators": [
                {
                    "id": d.id,
                    "name": d.name,
                    "type": d.decorator_type.value,
                    "module": d.module,
                    "line_number": d.line_number,
                    "has_wraps": d.has_wraps,
                    "parameters": d.parameters,
                    "source_code": d.source_code,
                }
                for d in func.decorators
            ],
            "decorator_order": func.decorator_order,
        }

    def _event_to_dict(self, event: CallEvent) -> dict[str, Any]:
        """Convert a CallEvent to a dict."""
        return {
            "id": event.id,
            "function_id": event.function_id,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "caller": event.caller,
            "args": list(event.args),
            "kwargs": event.kwargs,
            "return_value": event.return_value,
            "exception": event.exception,
            "decorator_stack": event.decorator_stack,
            "duration_ms": event.duration_ms,
        }

    def _risk_to_dict(self, risk: Risk) -> dict[str, Any]:
        """Convert a Risk to a dict."""
        return {
            "id": risk.id,
            "function_id": risk.function_id,
            "decorator_id": risk.decorator_id,
            "risk_type": risk.risk_type.value,
            "level": risk.level.value,
            "description": risk.description,
            "location": risk.location,
            "suggestion": risk.suggestion,
        }

    def _find_differences(self, results: list[AnalysisResult]) -> dict[str, Any]:
        """Find differences between multiple analysis results."""
        if len(results) < 2:
            return {}
        
        differences: dict[str, Any] = {
            "function_count_changes": [],
            "risk_count_changes": [],
            "new_risks": [],
            "resolved_risks": [],
        }
        
        baseline = results[0]
        for idx, result in enumerate(results[1:], 1):
            func_diff = len(result.decorated_functions) - len(baseline.decorated_functions)
            risk_diff = len(result.risks) - len(baseline.risks)
            
            if func_diff != 0:
                differences["function_count_changes"].append({
                    "from_result": idx,
                    "change": func_diff,
                })
            
            if risk_diff != 0:
                differences["risk_count_changes"].append({
                    "from_result": idx,
                    "change": risk_diff,
                })
        
        return differences


class MarkdownExporter(ReportExporter):
    """Export analysis results to Markdown format."""

    RISK_ICONS = {
        RiskLevel.CRITICAL: "🔴",
        RiskLevel.HIGH: "🟠",
        RiskLevel.MEDIUM: "🟡",
        RiskLevel.LOW: "🟢",
    }

    RISK_TYPE_NAMES = {
        RiskType.EXCEPTION_SWALLOW: "异常吞掉",
        RiskType.METADATA_LOSS: "元数据丢失",
        RiskType.SIGNATURE_CHANGE: "签名变更",
        RiskType.RETURN_VALUE_ALTERED: "返回值变更",
        RiskType.ORDER_DEPENDENCY: "顺序依赖",
        RiskType.ASYNC_MISMATCH: "异步不匹配",
        RiskType.DESCRIPTOR_BINDING: "描述符绑定",
    }

    def export(self, result: AnalysisResult, output_path: Path) -> None:
        """Export a single analysis result to Markdown."""
        lines: list[str] = []
        
        lines.append("# 装饰器分析报告")
        lines.append("")
        lines.append(f"- **分析ID**: {result.id}")
        lines.append(f"- **分析时间**: {result.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 被装饰函数 | {len(result.decorated_functions)} |")
        lines.append(f"| 调用事件 | {len(result.call_events)} |")
        lines.append(f"| 风险数量 | {len(result.risks)} |")
        lines.append("")
        
        if result.risks:
            lines.append("## 风险分析")
            lines.append("")
            
            risk_by_level: dict[RiskLevel, list[Risk]] = {}
            for risk in result.risks:
                if risk.level not in risk_by_level:
                    risk_by_level[risk.level] = []
                risk_by_level[risk.level].append(risk)
            
            for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
                if level in risk_by_level:
                    risks = risk_by_level[level]
                    icon = self.RISK_ICONS.get(level, "⚪")
                    lines.append(f"### {icon} {level.value.upper()} ({len(risks)} 个)")
                    lines.append("")
                    
                    for risk in risks:
                        risk_name = self.RISK_TYPE_NAMES.get(risk.risk_type, risk.risk_type.value)
                        lines.append(f"#### {risk_name}")
                        lines.append("")
                        lines.append(f"- **位置**: {risk.location}")
                        lines.append(f"- **描述**: {risk.description}")
                        lines.append(f"- **建议**: {risk.suggestion}")
                        lines.append("")
        
        lines.append("## 被装饰函数详情")
        lines.append("")
        
        for func in result.decorated_functions:
            lines.append(f"### `{func.function.name}`")
            lines.append("")
            lines.append(f"- **模块**: {func.function.module}")
            lines.append(f"- **签名**: `{func.function.signature}`")
            lines.append(f"- **异步**: {'是' if func.function.is_async else '否'}")
            lines.append(f"- **方法**: {'是' if func.function.is_method else '否'}")
            lines.append("")
            
            if func.decorators:
                lines.append("#### 装饰器列表 (从内到外)")
                lines.append("")
                for idx, dec in enumerate(func.decorators, 1):
                    lines.append(f"{idx}. **`{dec.name}`**")
                    lines.append(f"   - 类型: {dec.decorator_type.value}")
                    lines.append(f"   - 行号: {dec.line_number}")
                    lines.append(f"   - 使用 wraps: {'是' if dec.has_wraps else '否'}")
                    if dec.parameters:
                        lines.append(f"   - 参数: {json.dumps(dec.parameters, ensure_ascii=False)}")
                lines.append("")
        
        if result.call_events:
            lines.append("## 调用时间线")
            lines.append("")
            lines.append("| 时间 | 函数 | 调用者 | 异常 | 耗时(ms) |")
            lines.append("|------|------|--------|------|----------|")
            
            sorted_events = sorted(result.call_events, key=lambda e: e.timestamp)
            for event in sorted_events[:50]:
                ts = event.timestamp.strftime('%H:%M:%S.%f')[:-3] if event.timestamp else "-"
                caller = event.caller or "-"
                exception = event.exception or "-"
                duration = f"{event.duration_ms:.2f}" if event.duration_ms else "-"
                lines.append(f"| {ts} | {event.function_id} | {caller} | {exception} | {duration} |")
            
            if len(sorted_events) > 50:
                lines.append("")
                lines.append(f"*仅显示前 50 条，共 {len(sorted_events)} 条记录*")
            lines.append("")
        
        if result.signature_checks:
            lines.append("## 签名保真检查")
            lines.append("")
            for check in result.signature_checks:
                status = "✅ 匹配" if check.matches else "❌ 不匹配"
                lines.append(f"### {check.function_id}: {status}")
                lines.append("")
                if check.differences:
                    lines.append("**差异**:")
                    for diff in check.differences:
                        lines.append(f"- {diff}")
                lines.append("")
        
        if result.metadata_checks:
            lines.append("## 元数据保真检查")
            lines.append("")
            lines.append("| 函数 | 名称保留 | 文档保留 | 使用 wraps |")
            lines.append("|------|----------|----------|------------|")
            for check in result.metadata_checks:
                name_ok = "✅" if check.name_preserved else "❌"
                doc_ok = "✅" if check.docstring_preserved else "❌"
                wraps_ok = "✅" if check.uses_wraps else "❌"
                lines.append(f"| {check.function_id} | {name_ok} | {doc_ok} | {wraps_ok} |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 Decorator Analyzer 生成*")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def export_compare(
        self, results: list[AnalysisResult], output_path: Path, labels: Optional[list[str]] = None
    ) -> None:
        """Export a comparison of multiple analysis results to Markdown."""
        lines: list[str] = []
        
        lines.append("# 装饰器分析对比报告")
        lines.append("")
        lines.append(f"- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"- **对比数量**: {len(results)} 个分析结果")
        lines.append("")
        
        lines.append("## 对比概览")
        lines.append("")
        
        headers = ["指标"]
        for idx, _ in enumerate(results):
            label = labels[idx] if labels and idx < len(labels) else f"结果 {idx + 1}"
            headers.append(label)
        
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        
        metrics = [
            ("被装饰函数", lambda r: len(r.decorated_functions)),
            ("调用事件", lambda r: len(r.call_events)),
            ("风险总数", lambda r: len(r.risks)),
        ]
        
        for metric_name, getter in metrics:
            row = [metric_name]
            for result in results:
                row.append(str(getter(result)))
            lines.append("| " + " | ".join(row) + " |")
        
        lines.append("")
        
        lines.append("## 风险对比")
        lines.append("")
        
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            level_counts = []
            for result in results:
                count = sum(1 for r in result.risks if r.level == level)
                level_counts.append(count)
            
            icon = self.RISK_ICONS.get(level, "⚪")
            lines.append(f"### {icon} {level.value.upper()} 级风险")
            lines.append("")
            
            for idx, count in enumerate(level_counts):
                label = labels[idx] if labels and idx < len(labels) else f"结果 {idx + 1}"
                lines.append(f"- **{label}**: {count} 个")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 Decorator Analyzer 生成*")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
