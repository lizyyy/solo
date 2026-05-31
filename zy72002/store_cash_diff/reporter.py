import os
import csv
from datetime import datetime
from typing import List, Dict, Any
from .models import TransactionRecord, DiffType
from .diff_engine import CashDiffEngine


class Reporter:
    def __init__(self, engine: CashDiffEngine):
        self.engine = engine
        self.terminal_lines: List[str] = []

    def _print(self, msg: str = ""):
        print(msg)
        self.terminal_lines.append(msg)

    def _color_text(self, text: str, color: str) -> str:
        colors = {
            "red": "\033[91m",
            "green": "\033[92m",
            "yellow": "\033[93m",
            "blue": "\033[94m",
            "purple": "\033[95m",
            "cyan": "\033[96m",
            "bold": "\033[1m",
            "reset": "\033[0m",
        }
        return f"{colors.get(color, '')}{text}{colors['reset']}"

    def _get_diff_color(self, diff_type: DiffType) -> str:
        color_map = {
            DiffType.NONE: "green",
            DiffType.AMOUNT_MISMATCH: "red",
            DiffType.DUPLICATE_CLAIM: "red",
            DiffType.MISSING_RECORD: "yellow",
            DiffType.NULL_VALUE: "yellow",
            DiffType.BOUNDARY_CASE: "cyan",
            DiffType.LATE_ATTACHMENT: "purple",
            DiffType.MANUAL_REMARK: "blue",
        }
        return color_map.get(diff_type, "reset")

    def print_header(self):
        self._print("=" * 80)
        self._print(self._color_text("  门店日结现金差异分析报告", "bold"))
        self._print(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self._print("=" * 80)
        self._print()

    def print_statistics(self):
        stats = self.engine.get_statistics()
        self._print(self._color_text("【统计摘要】", "bold"))
        self._print()
        self._print(f"  总记录数: {stats.get('总记录数', 0)}")
        self._print(f"  存在差异: {stats.get('已处理', 0)}")
        self._print(f"  无差异: {stats.get('无差异', 0)}")
        self._print()
        
        diff_summary = [(k, v) for k, v in stats.items() 
                       if k not in ["总记录数", "已处理", "无差异"] and v > 0]
        
        if diff_summary:
            self._print(self._color_text("  差异类型分布:", "cyan"))
            for diff_type, count in diff_summary:
                color = "red" if "不匹配" in diff_type or "重复" in diff_type else "yellow"
                self._print(f"    - {self._color_text(f'{diff_type}: {count}条', color)}")
        self._print()

    def print_duplicate_groups(self):
        groups = self.engine.get_duplicate_groups()
        if not groups:
            return
        
        self._print(self._color_text("【核心差异：重复认领明细】", "bold"))
        self._print(self._color_text("  (门店日结现金差异 - 同一笔钱被多个批次认走)", "red"))
        self._print()
        
        for i, group in enumerate(groups, 1):
            self._print(f"  第{i}组重复认领 (共{len(group)}条记录):")
            self._print("  " + "-" * 60)
            for rec in group:
                color = self._get_diff_color(rec.diff_type)
                self._print(f"    记录ID: {self._color_text(rec.id, color)}")
                self._print(f"      门店: {rec.store_name} ({rec.store_id})")
                self._print(f"      日期: {rec.trade_date}")
                self._print(f"      金额: {rec.amount} 元")
                self._print(f"      批次: {rec.batch_no or '无'}")
                self._print(f"      来源: {rec.source.value}")
                if rec.original_remark:
                    self._print(f"      原备注: {rec.original_remark}")
                self._print(f"      {self._color_text('差异原因: ' + (rec.diff_reason or ''), color)}")
                if rec.attachments:
                    self._print(f"      附件: {len(rec.attachments)}个")
                if rec.history:
                    self._print(f"      历史变更: {len(rec.history)}次")
            self._print()

    def print_null_and_boundary(self):
        diff_records = self.engine.get_diff_records()
        null_records = [r for r in diff_records if r.diff_type == DiffType.NULL_VALUE]
        boundary_records = [r for r in diff_records if r.diff_type == DiffType.BOUNDARY_CASE]
        
        if null_records:
            self._print(self._color_text("【空值异常记录】", "bold"))
            self._print()
            for rec in null_records:
                self._print(f"  {self._color_text(rec.id, 'yellow')}: {rec.store_name} - "
                           f"{self._color_text(rec.diff_reason or '', 'yellow')}")
            self._print()
        
        if boundary_records:
            self._print(self._color_text("【边界记录】", "bold"))
            self._print()
            for rec in boundary_records:
                self._print(f"  {self._color_text(rec.id, 'cyan')}: {rec.store_name} - "
                           f"{self._color_text(rec.diff_reason or '', 'cyan')}")
            self._print()

    def print_history_changes(self):
        diff_records = self.engine.get_diff_records()
        records_with_history = [r for r in diff_records if r.history]
        
        if not records_with_history:
            return
        
        self._print(self._color_text("【历史变更追踪】", "bold"))
        self._print()
        
        for rec in records_with_history:
            self._print(f"  记录 {self._color_text(rec.id, 'purple')} ({rec.store_name}):")
            for h in rec.history:
                self._print(f"    [{h.timestamp.strftime('%H:%M:%S')}] {h.operator} "
                           f"修改 {h.field_name}: {h.old_value} -> {h.new_value}")
                if h.reason:
                    self._print(f"      原因: {h.reason}")
            self._print()

    def print_processing_log(self):
        self._print(self._color_text("【处理日志】", "bold"))
        self._print()
        for log in self.engine.processing_log:
            self._print(f"  {log}")
        self._print()

    def print_terminal_summary(self):
        self.print_header()
        self.print_statistics()
        self.print_duplicate_groups()
        self.print_null_and_boundary()
        self.print_history_changes()
        self.print_processing_log()
        self._print("=" * 80)
        self._print(self._color_text("  门店日结现金差异分析完成", "bold"))
        self._print("=" * 80)

    def export_detail_csv(self, output_path: str) -> str:
        diff_records = self.engine.get_diff_records()
        
        all_records = self.engine.records
        all_dicts = [r.to_detail_dict() for r in all_records]
        
        if not all_dicts:
            return ""
        
        max_history = max((len(r.history) for r in all_records), default=0)
        
        base_fields = ["记录ID", "门店编号", "门店名称", "交易日期", "金额", "批次号", 
                      "数据来源", "原始备注", "当前备注", "差异类型", "差异原因", 
                      "是否已处理", "匹配记录ID", "重复认领ID", "附件列表", "晚到附件"]
        
        history_fields = []
        for i in range(1, max_history + 1):
            history_fields.extend([
                f"历史变更{i}_时间", f"历史变更{i}_字段", 
                f"历史变更{i}_原值", f"历史变更{i}_新值",
                f"历史变更{i}_操作人", f"历史变更{i}_原因"
            ])
        
        all_fields = base_fields + history_fields
        
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=all_fields)
            writer.writeheader()
            for d in all_dicts:
                row = {k: d.get(k, "") for k in all_fields}
                writer.writerow(row)
        
        return output_path

    def export_summary_csv(self, output_path: str) -> str:
        all_records = self.engine.records
        all_dicts = [r.to_summary_dict() for r in all_records]
        
        if not all_dicts:
            return ""
        
        fields = list(all_dicts[0].keys())
        
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows(all_dicts)
        
        return output_path

    def export_duplicate_groups_csv(self, output_path: str) -> str:
        groups = self.engine.get_duplicate_groups()
        if not groups:
            return ""
        
        rows = []
        for i, group in enumerate(groups, 1):
            for rec in group:
                row = {
                    "重复组号": i,
                    "组内记录数": len(group),
                    "记录ID": rec.id,
                    "门店编号": rec.store_id,
                    "门店名称": rec.store_name,
                    "交易日期": rec.trade_date,
                    "金额": rec.amount,
                    "批次号": rec.batch_no,
                    "数据来源": rec.source.value,
                    "差异类型": rec.diff_type.value,
                    "差异原因": rec.diff_reason,
                    "冲突记录ID": ",".join(rec.duplicate_with),
                    "备注": rec.current_remark,
                }
                rows.append(row)
        
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        
        return output_path

    def export_all(self, output_dir: str) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        os.makedirs(output_dir, exist_ok=True)
        
        results = {}
        
        detail_path = os.path.join(output_dir, f"门店日结现金差异_明细_{timestamp}.csv")
        results["明细报告"] = self.export_detail_csv(detail_path)
        
        summary_path = os.path.join(output_dir, f"门店日结现金差异_摘要_{timestamp}.csv")
        results["摘要报告"] = self.export_summary_csv(summary_path)
        
        dup_path = os.path.join(output_dir, f"门店日结现金差异_重复认领_{timestamp}.csv")
        results["重复认领报告"] = self.export_duplicate_groups_csv(dup_path)
        
        log_path = os.path.join(output_dir, f"门店日结现金差异_处理日志_{timestamp}.txt")
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(self.engine.processing_log))
        results["处理日志"] = log_path
        
        terminal_path = os.path.join(output_dir, f"门店日结现金差异_终端输出_{timestamp}.txt")
        with open(terminal_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(self.terminal_lines))
        results["终端输出"] = terminal_path
        
        return results
