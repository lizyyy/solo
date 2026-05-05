"""报告导出模块 - 支持 Markdown/JSON/CSV 格式"""

import json
import csv
import io
from typing import Dict, Any, List, Optional
from datetime import datetime
from .models import AnalysisResult, SimulationResult


class Reporter:
    def __init__(self, results: Dict[str, Any]):
        self.results = results
        self.generated_at = datetime.now()
    
    def export(self, filepath: str, format: str = "markdown") -> None:
        content = ""
        if format == "markdown":
            content = self.generate_markdown()
        elif format == "json":
            content = self.generate_json()
        elif format == "csv":
            content = self.generate_csv()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def generate_markdown(self) -> str:
        lines = []
        
        lines.append("# SQLite 诊断报告")
        lines.append(f"> 生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if "basic_info" in self.results:
            lines.append("## 基本信息")
            lines.append("")
            
            basic = self.results["basic_info"]
            
            if "database" in basic and basic["database"]:
                lines.append("### 数据库信息")
                lines.append("")
                lines.append("| 项目 | 值 |")
                lines.append("|------|-----|")
                db = basic["database"]
                lines.append(f"| 路径 | {db.get('path', 'N/A')} |")
                lines.append(f"| 大小 | {db.get('size_mb', 0)} MB ({db.get('size_bytes', 0)} 字节) |")
                lines.append(f"| WAL 大小 | {db.get('wal_size_mb', 0)} MB |")
                lines.append(f"| 页大小 | {db.get('page_size', 0)} 字节 |")
                lines.append(f"| 页数 | {db.get('page_count', 0)} |")
                lines.append("")
            
            if "pragma" in basic and basic["pragma"]:
                lines.append("### PRAGMA 配置")
                lines.append("")
                lines.append("| 配置项 | 值 |")
                lines.append("|--------|-----|")
                pragma = basic["pragma"]
                lines.append(f"| journal_mode | {pragma.get('journal_mode', 'N/A')} |")
                lines.append(f"| synchronous | {pragma.get('synchronous', 'N/A')} |")
                lines.append(f"| busy_timeout | {pragma.get('busy_timeout_ms', 'N/A')} ms |")
                lines.append(f"| foreign_keys | {'启用' if pragma.get('foreign_keys_enabled') else '禁用'} |")
                lines.append(f"| wal_autocheckpoint | {pragma.get('wal_autocheckpoint', 'N/A')} 页 |")
                lines.append(f"| cache_size | {pragma.get('cache_size', 'N/A')} |")
                lines.append(f"| temp_store | {pragma.get('temp_store', 'N/A')} |")
                lines.append(f"| locking_mode | {pragma.get('locking_mode', 'N/A')} |")
                lines.append("")
            
            if "statistics" in basic:
                lines.append("### 统计信息")
                lines.append("")
                lines.append("| 项目 | 数量 |")
                lines.append("|------|------|")
                stats = basic["statistics"]
                lines.append(f"| Trace 事件 | {stats.get('trace_events_count', 0)} |")
                lines.append(f"| 迁移文件 | {stats.get('migrations_count', 0)} |")
                lines.append(f"| 事务 | {stats.get('workload_transactions_count', 0)} |")
                lines.append(f"| 操作 | {stats.get('workload_operations_count', 0)} |")
                lines.append("")
        
        if "analyses" in self.results and self.results["analyses"]:
            lines.append("## 问题分析")
            lines.append("")
            
            analyses = self.results["analyses"]
            
            high_severity = [a for a in analyses if a.severity == "high"]
            medium_severity = [a for a in analyses if a.severity == "medium"]
            
            if high_severity:
                lines.append("### 🔴 高优先级问题")
                lines.append("")
                for analysis in high_severity:
                    lines.extend(self._format_analysis_markdown(analysis))
                lines.append("")
            
            if medium_severity:
                lines.append("### 🟡 中优先级问题")
                lines.append("")
                for analysis in medium_severity:
                    lines.extend(self._format_analysis_markdown(analysis))
                lines.append("")
        
        if "simulation" in self.results:
            lines.append("## 模拟结果")
            lines.append("")
            
            sim = self.results["simulation"]
            
            if "baseline" in sim:
                lines.append("### 基准测试")
                lines.append("")
                baseline = sim["baseline"]
                lines.append("| 指标 | 值 |")
                lines.append("|------|-----|")
                lines.append(f"| 总操作数 | {baseline.total_operations} |")
                lines.append(f"| 成功 | {baseline.successful_operations} |")
                lines.append(f"| 失败 | {baseline.failed_operations} |")
                lines.append(f"| 总耗时 | {baseline.total_duration_ms:.2f} ms |")
                lines.append(f"| 平均耗时 | {baseline.avg_duration_ms:.2f} ms |")
                lines.append(f"| 锁冲突 | {baseline.lock_conflicts} |")
                lines.append(f"| WAL 增长 | {baseline.wal_growth_pages} 页 |")
                lines.append(f"| Checkpoint 次数 | {baseline.checkpoint_count} |")
                lines.append(f"| Busy Timeout | {baseline.busy_timeouts} |")
                lines.append("")
            
            if "comparisons" in sim and sim["comparisons"]:
                lines.append("### 参数对比")
                lines.append("")
                
                for comparison in sim["comparisons"]:
                    param_name = comparison.get("parameter", "Unknown")
                    results = comparison.get("results", [])
                    
                    lines.append(f"#### {param_name}")
                    lines.append("")
                    
                    headers = ["值", "平均耗时(ms)", "锁冲突", "WAL增长(页)", "失败数"]
                    lines.append("| " + " | ".join(headers) + " |")
                    lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
                    
                    for r in results:
                        lines.append(f"| {r.parameter_value} | {r.avg_duration_ms:.2f} | {r.lock_conflicts} | {r.wal_growth_pages} | {r.failed_operations} |")
                    
                    lines.append("")
            
            if "recommendations" in sim and sim["recommendations"]:
                lines.append("### 优化建议")
                lines.append("")
                
                for rec in sim["recommendations"]:
                    lines.append(f"**{rec.get('parameter', 'Unknown')}**")
                    lines.append("")
                    lines.append(f"- 推荐值: `{rec.get('recommended_value')}`")
                    lines.append(f"- 相比最差值提升: {rec.get('improvement_percent', 0)}%")
                    lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 SQLite Diagnostic CLI 生成*")
        
        return "\n".join(lines)
    
    def _format_analysis_markdown(self, analysis: AnalysisResult) -> List[str]:
        lines = []
        
        lines.append(f"#### {analysis.title}")
        lines.append("")
        lines.append(f"**类别**: {analysis.category} | **严重程度**: {analysis.severity}")
        lines.append("")
        lines.append(f"**描述**: {analysis.description}")
        lines.append("")
        lines.append("**建议**:")
        lines.append("")
        for line in analysis.recommendation.split("\n"):
            if line.strip():
                lines.append(line)
        lines.append("")
        
        if analysis.evidence:
            lines.append("**证据**:")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(analysis.evidence[:5], indent=2, default=str))
            if len(analysis.evidence) > 5:
                lines.append(f"... 还有 {len(analysis.evidence) - 5} 条记录")
            lines.append("```")
            lines.append("")
        
        if analysis.stats:
            lines.append("**统计**:")
            lines.append("")
            lines.append("| 指标 | 值 |")
            lines.append("|------|-----|")
            for key, value in analysis.stats.items():
                lines.append(f"| {key} | {value} |")
            lines.append("")
        
        return lines
    
    def generate_json(self) -> str:
        def convert_to_dict(obj):
            if hasattr(obj, '__dict__'):
                return {k: convert_to_dict(v) for k, v in obj.__dict__.items()}
            elif isinstance(obj, list):
                return [convert_to_dict(item) for item in obj]
            elif isinstance(obj, dict):
                return {k: convert_to_dict(v) for k, v in obj.items()}
            elif isinstance(obj, datetime):
                return obj.isoformat()
            else:
                return obj
        
        output = {
            "generated_at": self.generated_at.isoformat(),
            "results": convert_to_dict(self.results)
        }
        
        return json.dumps(output, indent=2, ensure_ascii=False)
    
    def generate_csv(self) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["SQLite 诊断报告", f"生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}"])
        writer.writerow([])
        
        if "analyses" in self.results and self.results["analyses"]:
            writer.writerow(["问题分析"])
            writer.writerow(["严重程度", "类别", "标题", "描述", "建议"])
            
            for analysis in self.results["analyses"]:
                writer.writerow([
                    analysis.severity,
                    analysis.category,
                    analysis.title,
                    analysis.description,
                    analysis.replacement[:1000] if len(analysis.replacement) > 1000 else analysis.replacement
                ])
            
            writer.writerow([])
        
        if "simulation" in self.results:
            writer.writerow(["模拟结果"])
            
            sim = self.results["simulation"]
            
            if "comparisons" in sim:
                for comparison in sim["comparisons"]:
                    param_name = comparison.get("parameter", "Unknown")
                    writer.writerow([f"参数: {param_name}"])
                    writer.writerow(["值", "平均耗时(ms)", "锁冲突", "WAL增长(页)", "失败数"])
                    
                    for r in comparison.get("results", []):
                        writer.writerow([
                            r.parameter_value,
                            r.avg_duration_ms,
                            r.lock_conflicts,
                            r.wal_growth_pages,
                            r.failed_operations
                        ])
                    
                    writer.writerow([])
        
        return output.getvalue()
