import json
from datetime import datetime
from typing import List, Dict, Any
from app.models.schemas import (
    ReportData, ComparisonItem, BatchRecord,
    DetectionResult, LakePartition, RuleType
)
from app.models.store import store


class ReportGenerator:
    def generate_report(self, batch_id: str) -> ReportData:
        batch = store.get_batch(batch_id)
        if not batch:
            raise Exception(f"批次{batch_id}不存在")
        
        results = store.get_results(batch_id)
        failed_items = store.get_failed_items(batch_id)
        partitions = store.get_partitions()
        
        rule = store.get_rule_by_version(batch.rule_version)
        
        execution_time = (batch.end_time - batch.start_time).total_seconds() if batch.end_time else 0
        
        before_summary = self._get_before_summary(partitions)
        after_summary = self._get_after_summary(results, batch)
        comparisons = self._generate_comparisons(before_summary, after_summary, batch)
        suggestions = self._generate_suggestions(results, failed_items, rule)
        
        report = ReportData(
            batch_id=batch_id,
            rule_version=batch.rule_version,
            rule_type=batch.rule_type,
            execution_time_seconds=execution_time,
            before_summary=before_summary,
            after_summary=after_summary,
            comparisons=comparisons,
            suggestions=suggestions,
            failed_items_count=len(failed_items)
        )
        
        return report
    
    def _get_before_summary(self, partitions: List[LakePartition]) -> Dict[str, Any]:
        total_records = sum(p.record_count for p in partitions)
        total_size = sum(p.file_size for p in partitions)
        environments = set(p.environment for p in partitions)
        
        return {
            "total_partitions": len(partitions),
            "total_records": total_records,
            "total_size_mb": round(total_size, 2),
            "environments_count": len(environments),
            "environments": list(environments)
        }
    
    def _get_after_summary(self, results: List[DetectionResult], batch: BatchRecord) -> Dict[str, Any]:
        pass_rate = round(batch.pass_count / batch.total_count * 100, 2) if batch.total_count > 0 else 0
        
        return {
            "total_processed": batch.total_count,
            "pass_count": batch.pass_count,
            "fail_count": batch.fail_count,
            "warning_count": batch.warning_count,
            "pass_rate": f"{pass_rate}%",
            "status": batch.status
        }
    
    def _generate_comparisons(self, before: Dict, after: Dict, batch: BatchRecord) -> List[ComparisonItem]:
        comparisons = []
        
        comparisons.append(ComparisonItem(
            field_name="总分区数",
            before=before["total_partitions"],
            after=after["total_processed"],
            changed=before["total_partitions"] != after["total_processed"]
        ))
        
        comparisons.append(ComparisonItem(
            field_name="通过检测数",
            before="-",
            after=after["pass_count"],
            changed=True
        ))
        
        comparisons.append(ComparisonItem(
            field_name="失败检测数",
            before="-",
            after=after["fail_count"],
            changed=True
        ))
        
        comparisons.append(ComparisonItem(
            field_name="警告数",
            before="-",
            after=after["warning_count"],
            changed=True
        ))
        
        comparisons.append(ComparisonItem(
            field_name="使用规则版本",
            before="-",
            after=batch.rule_version,
            changed=True
        ))
        
        return comparisons
    
    def _generate_suggestions(self, results: List[DetectionResult], failed_items: List, rule) -> List[str]:
        suggestions = []
        
        fail_results = [r for r in results if r.status == "fail"]
        warning_results = [r for r in results if r.status == "warning"]
        
        if fail_results:
            suggestions.append(f"共有{len(fail_results)}个分区检测失败，请优先处理失败项")
            for r in fail_results[:3]:
                suggestions.extend(r.suggestions)
        
        if warning_results:
            suggestions.append(f"共有{len(warning_results)}个分区存在警告，请关注相关异常")
        
        if failed_items:
            suggestions.append(f"存在{len(failed_items)}个处理失败的项目，请查看failed_items目录下的失败记录")
        
        if rule:
            suggestions.append(f"本次检测使用规则版本{rule.version}，规则类型为{rule.rule_type}")
        
        suggestions.append("建议定期执行检测，关注数据质量变化")
        suggestions.append("对于连续失败的分区，建议检查数据源同步情况")
        
        return suggestions
    
    def to_json(self, report: ReportData) -> str:
        return json.dumps(report.model_dump(), ensure_ascii=False, indent=2, default=str)
    
    def to_markdown(self, report: ReportData) -> str:
        md = []
        
        md.append(f"# 版本提醒器检测报告 - 批次 {report.batch_id}")
        md.append("")
        md.append(f"**生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        md.append(f"**规则版本**: {report.rule_version}")
        md.append(f"**规则类型**: {report.rule_type}")
        md.append(f"**执行时间**: {report.execution_time_seconds:.2f} 秒")
        md.append(f"**失败项数量**: {report.failed_items_count}")
        md.append("")
        
        md.append("## 处理前后对比")
        md.append("")
        md.append("| 字段 | 处理前 | 处理后 | 是否变更 |")
        md.append("|------|--------|--------|----------|")
        for comp in report.comparisons:
            changed = "是" if comp.changed else "否"
            md.append(f"| {comp.field_name} | {comp.before} | {comp.after} | {changed} |")
        md.append("")
        
        md.append("## 处理前汇总")
        md.append("")
        for key, value in report.before_summary.items():
            md.append(f"- **{key}**: {value}")
        md.append("")
        
        md.append("## 处理后汇总")
        md.append("")
        for key, value in report.after_summary.items():
            md.append(f"- **{key}**: {value}")
        md.append("")
        
        md.append("## 下一步建议")
        md.append("")
        for i, suggestion in enumerate(report.suggestions, 1):
            md.append(f"{i}. {suggestion}")
        md.append("")
        
        md.append("---")
        md.append("*报告由版本提醒器服务自动生成*")
        
        return "\n".join(md)


report_generator = ReportGenerator()
