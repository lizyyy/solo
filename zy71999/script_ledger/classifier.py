from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from datetime import datetime

from .ledger import ScriptRecord, Ledger
from .detector import Issue, Detector


class Classification:
    CATEGORY_OK = "ok"
    CATEGORY_RERUN = "rerun"
    CATEGORY_ASK_DEV = "ask_dev"

    def __init__(self, record_id: str, category: str,
                 reasons: List[str], issues: List[Issue]):
        self.record_id = record_id
        self.category = category
        self.reasons = reasons
        self.issues = issues

    def to_dict(self) -> Dict:
        return {
            "record_id": self.record_id,
            "category": self.category,
            "category_label": self._category_label(),
            "reasons": self.reasons,
            "issues": [i.to_dict() for i in self.issues]
        }

    def _category_label(self) -> str:
        labels = {
            self.CATEGORY_OK: "不用动",
            self.CATEGORY_RERUN: "要补跑",
            self.CATEGORY_ASK_DEV: "找研发确认"
        }
        return labels.get(self.category, "未知")

    def __str__(self) -> str:
        return f"[{self._category_label()}] {self.record_id}: {'; '.join(self.reasons)}"


class Classifier:
    def __init__(self, ledger: Ledger):
        self.ledger = ledger
        self.detector = Detector(ledger)

    def classify_all(self, records: Optional[List[ScriptRecord]] = None) -> Tuple[List[Classification], List[Issue]]:
        if records is None:
            records = self.ledger.get_all_records(reverse=False)
        
        all_issues = self.detector.detect_all(records)
        issues_by_record: Dict[str, List[Issue]] = defaultdict(list)
        
        for issue in all_issues:
            issues_by_record[issue.record_id].append(issue)
        
        classifications = []
        for record in records:
            record_issues = issues_by_record.get(record.id, [])
            classification = self._classify_record(record, record_issues)
            classifications.append(classification)
        
        return classifications, all_issues

    def _classify_record(self, record: ScriptRecord, issues: List[Issue]) -> Classification:
        reasons = []
        category = Classification.CATEGORY_OK
        
        if record.is_rerun:
            if record.exit_code == 0:
                reasons.append("补跑成功，已标记为重跑")
                category = Classification.CATEGORY_OK
            else:
                reasons.append("补跑仍然失败")
                category = Classification.CATEGORY_ASK_DEV
            return Classification(record.id, category, reasons, issues)
        
        has_error = any(i.severity in (Issue.SEVERITY_ERROR, Issue.SEVERITY_CRITICAL) for i in issues)
        has_warning = any(i.severity == Issue.SEVERITY_WARNING for i in issues)
        has_info = any(i.severity == Issue.SEVERITY_INFO for i in issues)
        
        error_types = [i.issue_type for i in issues if i.severity in (Issue.SEVERITY_ERROR, Issue.SEVERITY_CRITICAL)]
        warning_types = [i.issue_type for i in issues if i.severity == Issue.SEVERITY_WARNING]
        all_issue_types = error_types + warning_types
        
        if record.exit_code == 0:
            if not has_error and not has_warning:
                reasons.append("脚本执行成功，无异常")
                category = Classification.CATEGORY_OK
            elif has_error:
                if "missing_output" in error_types:
                    reasons.append("脚本退出码为0但输出文件缺失")
                    category = Classification.CATEGORY_RERUN
                elif "rollback_output_mismatch" in error_types:
                    reasons.append("回滚后输出文件未恢复")
                    category = Classification.CATEGORY_ASK_DEV
                else:
                    reasons.append("脚本表面成功但有错误级问题")
                    category = Classification.CATEGORY_ASK_DEV
            elif has_warning:
                if "space_in_path" in warning_types and len(warning_types) == 1:
                    reasons.append("路径有空格但脚本执行成功，建议后续修复路径")
                    category = Classification.CATEGORY_OK
                elif "suspicious_success" in warning_types:
                    reasons.append("之前有失败记录，本次成功未标记为补跑")
                    category = Classification.CATEGORY_RERUN
                elif "old_script_version" in warning_types:
                    reasons.append("使用旧版本脚本执行成功，建议确认是否需要更新")
                    category = Classification.CATEGORY_ASK_DEV
                elif "duplicate_run" in warning_types:
                    reasons.append("短时间内重复执行成功，确认是否误操作")
                    category = Classification.CATEGORY_OK
                else:
                    reasons.append("执行成功但有警告")
                    category = Classification.CATEGORY_OK
        else:
            if "script_failed" in all_issue_types:
                if record.failure_reason:
                    if self._is_retriable_failure(record.failure_reason):
                        reasons.append(f"失败原因已知：{record.failure_reason}，可尝试补跑")
                        category = Classification.CATEGORY_RERUN
                    else:
                        reasons.append(f"失败原因已知：{record.failure_reason}，建议研发确认")
                        category = Classification.CATEGORY_ASK_DEV
                else:
                    reasons.append("脚本执行失败，未记录失败原因")
                    category = Classification.CATEGORY_RERUN
            
            if "missing_output" in error_types:
                reasons.append("输出文件缺失")
                category = Classification.CATEGORY_RERUN
            
            if "rollback_output_mismatch" in error_types:
                reasons.append("回滚操作不完整")
                category = Classification.CATEGORY_ASK_DEV
        
        if has_info:
            info_issues = [i for i in issues if i.severity == Issue.SEVERITY_INFO]
            for i in info_issues:
                if i.issue_type == "rollback_detected":
                    reasons.append("已确认回滚操作")
        
        if not reasons:
            reasons.append("无明确判定依据")
        
        return Classification(record.id, category, reasons, issues)

    def _is_retriable_failure(self, reason: str) -> bool:
        retriable_keywords = [
            "网络超时", "timeout", "连接超时", "connection timeout",
            "临时文件", "磁盘满", "no space", "out of memory",
            "资源不足", "资源繁忙", "锁冲突", "lock",
            "重试", "retry", "临时", "temporary"
        ]
        
        reason_lower = reason.lower()
        for kw in retriable_keywords:
            if kw.lower() in reason_lower:
                return True
        
        non_retriable_keywords = [
            "语法错误", "syntax error", "syntaxerror", "权限拒绝", "permission denied",
            "文件不存在", "no such file", "配置错误", "config error",
            "参数错误", "invalid argument", "代码错误", "exception",
            "空指针", "nullpointer", "索引越界", "index out of range",
            "typeerror", "nameerror", "attributeerror"
        ]
        
        for kw in non_retriable_keywords:
            if kw.lower() in reason_lower:
                return False
        
        return True

    def generate_report(self, output_prefix: str = "ledger_report",
                        records: Optional[List[ScriptRecord]] = None) -> Tuple[str, str]:
        classifications, issues = self.classify_all(records)
        
        by_category: Dict[str, List[Classification]] = defaultdict(list)
        for c in classifications:
            by_category[c.category].append(c)
        
        ok_count = len(by_category.get(Classification.CATEGORY_OK, []))
        rerun_count = len(by_category.get(Classification.CATEGORY_RERUN, []))
        ask_dev_count = len(by_category.get(Classification.CATEGORY_ASK_DEV, []))
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ledger_file = f"{output_prefix}_{timestamp}.json"
        issues_file = f"{output_prefix}_issues_{timestamp}.txt"
        
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total": len(classifications),
                "ok": ok_count,
                "rerun": rerun_count,
                "ask_dev": ask_dev_count
            },
            "classifications": [c.to_dict() for c in classifications],
            "all_issues": [i.to_dict() for i in issues]
        }
        
        import json
        with open(ledger_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)
        
        with open(issues_file, 'w', encoding='utf-8') as f:
            f.write(self._format_text_report(classifications, issues, ok_count, rerun_count, ask_dev_count))
        
        return ledger_file, issues_file

    def _format_text_report(self, classifications: List[Classification],
                            issues: List[Issue], ok_count: int,
                            rerun_count: int, ask_dev_count: int) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("脚本运行账本 - 问题清单")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"总计: {len(classifications)} 条记录")
        lines.append(f"  ✓ 不用动: {ok_count}")
        lines.append(f"  ⚠ 要补跑: {rerun_count}")
        lines.append(f"  ✗ 找研发确认: {ask_dev_count}")
        lines.append("")
        
        by_category: Dict[str, List[Classification]] = defaultdict(list)
        for c in classifications:
            by_category[c.category].append(c)
        
        for category, label in [
            (Classification.CATEGORY_ASK_DEV, "【找研发确认】"),
            (Classification.CATEGORY_RERUN, "【要补跑】"),
            (Classification.CATEGORY_OK, "【不用动】")
        ]:
            items = by_category.get(category, [])
            if not items:
                continue
            
            lines.append("-" * 60)
            lines.append(f"{label} ({len(items)} 条)")
            lines.append("-" * 60)
            
            for c in items:
                record = self.ledger.find_by_id(c.record_id)
                if not record:
                    continue
                
                start_str = datetime.fromtimestamp(record.start_time).strftime('%Y-%m-%d %H:%M:%S')
                lines.append("")
                lines.append(f"记录ID: {record.id}")
                lines.append(f"执行时间: {start_str}")
                lines.append(f"工作目录: {record.cwd}")
                lines.append(f"执行命令: {record.command}")
                if record.args:
                    lines.append(f"参数: {' '.join(record.args)}")
                lines.append(f"退出码: {record.exit_code}")
                
                if record.is_rerun:
                    lines.append(f"补跑记录: 是 (原记录: {record.rerun_of})")
                
                if record.note:
                    lines.append(f"备注: {record.note}")
                
                if record.failure_reason:
                    lines.append(f"失败原因: {record.failure_reason}")
                
                lines.append(f"判定原因: {'; '.join(c.reasons)}")
                
                if c.issues:
                    lines.append("  问题列表:")
                    for issue in c.issues:
                        lines.append(f"    - {issue}")
                
                if record.output_files:
                    lines.append(f"输出文件: {', '.join(record.output_files)}")
        
        lines.append("")
        lines.append("=" * 60)
        lines.append("操作建议")
        lines.append("=" * 60)
        
        if rerun_count > 0:
            lines.append("")
            lines.append("【要补跑】的脚本可以尝试重新执行:")
            for c in by_category.get(Classification.CATEGORY_RERUN, []):
                record = self.ledger.find_by_id(c.record_id)
                if record:
                    lines.append(f"  - {record.id}: cd {record.cwd} && {record.command}")
        
        if ask_dev_count > 0:
            lines.append("")
            lines.append("【找研发确认】的脚本请联系相关研发人员:")
            for c in by_category.get(Classification.CATEGORY_ASK_DEV, []):
                record = self.ledger.find_by_id(c.record_id)
                if record:
                    lines.append(f"  - {record.id}: {record.command}")
                    for reason in c.reasons:
                        lines.append(f"    原因: {reason}")
        
        lines.append("")
        lines.append("=" * 60)
        
        return "\n".join(lines)
