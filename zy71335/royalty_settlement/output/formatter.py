import json
import csv
import io
import os
from typing import Dict, Any, List
from datetime import datetime

from ..models import SettlementResult, Issue, IssueSeverity


class OutputFormatter:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def format_summary(self, result: SettlementResult) -> str:
        lines = []
        separator = "=" * 80

        lines.append(separator)
        lines.append(" 版 权 分 账 演 出 单 - 结 算 摘 要 ")
        lines.append(separator)
        lines.append(f"演出名称: {result.performance_name}")
        lines.append(f"演出日期: {result.performance_date}")
        lines.append(f"演出ID: {result.performance_id}")
        lines.append(f"操作员: {result.operator}")
        lines.append(f"生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(separator)

        lines.append("【收入概览】")
        lines.append(f"  票房总收入:   ¥{result.total_box_office:>12,.2f}")
        lines.append(f"  平台扣费合计: ¥{result.total_fees:>12,.2f}")
        lines.append(f"  可分配收入:   ¥{result.net_distributable:>12,.2f}")
        lines.append(f"  演出总时长:   {result.total_duration_seconds}秒 ({result.total_duration_seconds/60:.1f}分钟)")
        lines.append(f"  参与曲目:     {len(set(item.track_name for item in result.items))}首")
        lines.append(f"  参与作者:     {len(result.author_summary)}位")
        lines.append("")

        if result.fee_breakdown:
            lines.append("【扣费明细】")
            for fee_type, amount in sorted(result.fee_breakdown.items()):
                lines.append(f"  {fee_type:<25} ¥{amount:>12,.2f}")
            lines.append("")

        lines.append("【作者分账汇总】")
        lines.append(f"  {'作者姓名':<15} {'曲目数':<8} {'税前收入':>14} {'扣费':>12} {'税后收入':>14}")
        lines.append(f"  {'-'*15} {'-'*8} {'-'*14} {'-'*12} {'-'*14}")
        for author, summary in sorted(result.author_summary.items()):
            lines.append(f"  {author:<15} {summary['track_count']:<8} ¥{summary['gross_amount']:>12,.2f}  ¥{summary['fee_deduction']:>10,.2f}  ¥{summary['net_amount']:>12,.2f}")
        lines.append("")

        issues = [i for i in result.issues if i.severity != IssueSeverity.INFO]
        if issues:
            lines.append("【重要问题】")
            for idx, issue in enumerate(issues, 1):
                severity_icon = {"warning": "⚠", "error": "✖", "critical": "★"}.get(issue.severity.value, "•")
                lines.append(f"  {idx}. [{severity_icon}] {issue.message}")
                lines.append(f"     原因: {issue.reason}")
                lines.append(f"     影响: {issue.impact}")
                lines.append(f"     下一步: {'; '.join(issue.next_steps)}")
            lines.append("")

        infos = [i for i in result.issues if i.severity == IssueSeverity.INFO]
        if infos:
            lines.append("【处理说明】")
            for idx, info in enumerate(infos, 1):
                lines.append(f"  {idx}. {info.message}")
                if info.reason:
                    lines.append(f"     说明: {info.reason}")
            lines.append("")

        lines.append(separator)
        lines.append(f"* 详细明细请查看同期生成的JSON和CSV文件")
        lines.append(separator)

        return "\n".join(lines)

    def format_structured(self, result: SettlementResult) -> Dict[str, Any]:
        return result.to_dict()

    def save_all(self, result: SettlementResult) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"settlement_{result.performance_id}_{timestamp}"

        paths = {}

        summary_path = os.path.join(self.output_dir, f"{base_name}_summary.txt")
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(self.format_summary(result))
        paths["summary"] = summary_path

        json_path = os.path.join(self.output_dir, f"{base_name}_detail.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(self.format_structured(result), f, ensure_ascii=False, indent=2)
        paths["json"] = json_path

        csv_path = os.path.join(self.output_dir, f"{base_name}_detail.csv")
        self._save_csv(result, csv_path)
        paths["csv"] = csv_path

        return paths

    def _save_csv(self, result: SettlementResult, csv_path: str):
        with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "曲目ID", "曲目名称", "是否串烧子曲目", "串烧父曲目",
                "作者ID", "作者姓名", "作者角色",
                "曲目时长(秒)", "曲目录入占比", "作者分成比例", "最终分成比例",
                "税前金额", "扣费金额", "税后金额",
                "备注"
            ])
            for item in result.items:
                writer.writerow([
                    item.track_id,
                    item.track_name,
                    "是" if item.is_medley else "否",
                    item.medley_parent or "",
                    item.author_id,
                    item.author_name,
                    item.author_role,
                    item.track_duration_seconds,
                    f"{item.track_ratio:.6f}",
                    f"{item.author_ratio:.6f}",
                    f"{item.final_ratio:.6f}",
                    f"{item.gross_amount:.2f}",
                    f"{item.fee_deduction:.2f}",
                    f"{item.net_amount:.2f}",
                    item.notes,
                ])
