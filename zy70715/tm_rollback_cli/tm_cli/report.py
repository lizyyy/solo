import json
from typing import Dict, Any, List
from tabulate import tabulate


class ReportGenerator:
    @staticmethod
    def format_import_result(result: Dict[str, Any], output_format: str = "table") -> str:
        if output_format == "json":
            return json.dumps(result, ensure_ascii=False, indent=2)
        
        lines = []
        lines.append("=" * 60)
        lines.append("导入结果报告")
        lines.append("=" * 60)
        
        summary_data = [
            ["成功导入", result["success_count"]],
            ["重复跳过", result["duplicate_count"]],
            ["无效数据", result["invalid_count"]],
        ]
        lines.append(tabulate(summary_data, tablefmt="simple"))
        lines.append("")
        
        if result["imported_entries"]:
            lines.append("已导入词条:")
            lines.append("-" * 60)
            import_headers = ["Key", "源语言", "目标语言", "版本批次"]
            import_data = [
                [e["key"], e["source_lang"], e["target_lang"], e["version_batch"]]
                for e in result["imported_entries"]
            ]
            lines.append(tabulate(import_data, headers=import_headers, tablefmt="grid"))
            lines.append("")
        
        if result["skipped_entries"]:
            lines.append("已跳词条:")
            lines.append("-" * 60)
            skip_headers = ["序号", "Key", "跳过原因"]
            skip_data = []
            for i, s in enumerate(result["skipped_entries"], 1):
                key = s["entry"].get("key", "N/A") if isinstance(s["entry"], dict) else "N/A"
                skip_data.append([i, key, s["reason"]])
            lines.append(tabulate(skip_data, headers=skip_headers, tablefmt="grid"))
        
        return "\n".join(lines)

    @staticmethod
    def format_rollback_result(result: Dict[str, Any], output_format: str = "table") -> str:
        if output_format == "json":
            return json.dumps(result, ensure_ascii=False, indent=2)
        
        lines = []
        lines.append("=" * 60)
        lines.append("回滚结果报告")
        lines.append("=" * 60)
        
        summary_data = [
            ["成功回滚", result["rollback_count"]],
            ["未找到词条", result["not_found_count"]],
        ]
        lines.append(tabulate(summary_data, tablefmt="simple"))
        lines.append("")
        
        if result["rollbacked_entries"]:
            lines.append("已回滚词条:")
            lines.append("-" * 60)
            rb_headers = ["Key", "源语言", "目标语言", "版本批次", "回滚原因"]
            rb_data = [
                [
                    e["key"], 
                    e["source_lang"], 
                    e["target_lang"], 
                    e["version_batch"],
                    e.get("rollback_reason", "N/A")
                ]
                for e in result["rollbacked_entries"]
            ]
            lines.append(tabulate(rb_data, headers=rb_headers, tablefmt="grid"))
        
        return "\n".join(lines)

    @staticmethod
    def format_consistency_report(report: Dict[str, Any], output_format: str = "table") -> str:
        if output_format == "json":
            return json.dumps(report, ensure_ascii=False, indent=2)
        
        lines = []
        lines.append("=" * 80)
        lines.append("翻译记忆库一致性检查报告")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("一、总体统计")
        lines.append("-" * 80)
        stats_data = [
            ["词条总数", report["total_entries"]],
            ["活跃词条", report["active_entries"]],
            ["已回滚词条", report["rollbacked_entries"]],
            ["冲突词条数", report["conflict_count"]],
        ]
        lines.append(tabulate(stats_data, tablefmt="simple"))
        lines.append("")
        
        if report["conflicts"]:
            lines.append("二、冲突词条详情")
            lines.append("-" * 80)
            for i, conflict in enumerate(report["conflicts"], 1):
                lines.append(f"\n冲突 #{i}: {conflict['key']} ({conflict['source_lang']}->{conflict['target_lang']})")
                lines.append(f"   活跃版本数: {conflict['active_count']}")
                lines.append("   各版本详情:")
                for j, ver in enumerate(conflict["versions"], 1):
                    lines.append(f"     版本{j}: [{ver['version_batch']}] {ver['target_text']}")
            lines.append("")
        
        if report["rollbacked_summary"]:
            lines.append("三、回滚批次汇总")
            lines.append("-" * 80)
            rb_headers = ["回滚批次", "词条数量", "回滚原因"]
            rb_data = [
                [
                    s["rollback_batch"],
                    s["count"],
                    ", ".join(s["reasons"])
                ]
                for s in report["rollbacked_summary"]
            ]
            lines.append(tabulate(rb_data, headers=rb_headers, tablefmt="grid"))
        
        lines.append("")
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)

    @staticmethod
    def format_entry_history(history: List[Dict[str, Any]], output_format: str = "table") -> str:
        if output_format == "json":
            return json.dumps(history, ensure_ascii=False, indent=2)
        
        if not history:
            return "未找到该词条的历史记录"
        
        lines = []
        lines.append("=" * 80)
        lines.append(f"词条历史记录: {history[0]['key']} ({history[0]['source_lang']}->{history[0]['target_lang']})")
        lines.append("=" * 80)
        
        headers = ["版本批次", "源文本", "目标文本", "状态", "创建时间", "回滚说明"]
        data = []
        for e in history:
            rb_note = e.get("rollback_note", "")
            if e.get("rollback_reason"):
                rb_note = f"{e['rollback_reason']}: {rb_note}"
            data.append([
                e["version_batch"],
                e["source_text"][:30] + "..." if len(e["source_text"]) > 30 else e["source_text"],
                e["target_text"][:30] + "..." if len(e["target_text"]) > 30 else e["target_text"],
                e["status"],
                e["created_at"][:19],
                rb_note
            ])
        lines.append(tabulate(data, headers=headers, tablefmt="grid"))
        
        return "\n".join(lines)

    @staticmethod
    def format_search_results(results: List[Dict[str, Any]], output_format: str = "table") -> str:
        if output_format == "json":
            return json.dumps(results, ensure_ascii=False, indent=2)
        
        if not results:
            return "未找到匹配的词条"
        
        lines = []
        lines.append("=" * 80)
        lines.append(f"搜索结果 (共 {len(results)} 条)")
        lines.append("=" * 80)
        
        headers = ["Key", "源语言", "目标语言", "版本批次", "状态", "目标文本"]
        data = []
        for e in results:
            data.append([
                e["key"],
                e["source_lang"],
                e["target_lang"],
                e["version_batch"],
                e["status"],
                e["target_text"][:40] + "..." if len(e["target_text"]) > 40 else e["target_text"]
            ])
        lines.append(tabulate(data, headers=headers, tablefmt="grid"))
        
        return "\n".join(lines)
