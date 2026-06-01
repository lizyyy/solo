import csv
import json
import os
from datetime import datetime
from typing import List, Optional, Tuple

from .models import RoyaltyResult, ConflictItem, AuditEntry
from .audit import AuditLogger


class ReportGenerator:
    def __init__(self, output_dir: str = "."):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _timestamp(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    def generate_detail(self, results: List[RoyaltyResult], conflicts: List[ConflictItem], audit_entries: List[AuditEntry]) -> str:
        ts = self._timestamp()
        path = os.path.join(self.output_dir, f"royalty_detail_{ts}.txt")
        lines = []
        lines.append("=" * 72)
        lines.append("音乐版权长尾收益 — 计算明细报告")
        lines.append(f"生成时间: {datetime.now().isoformat()}")
        lines.append("=" * 72)

        for r in results:
            lines.append("")
            lines.append("-" * 60)
            lines.append(f"记录ID: {r.record_id}  |  作品: {r.work_title}")
            lines.append(f"收益类型: {r.revenue_type}")
            if r.is_exception:
                lines.append(f"★ 例外记录: {r.exception_note}")
            lines.append("")

            lines.append("【标准化参数】")
            lines.append(f"  播放量: {r.play_count_normalized:,.0f} {r.play_count_unit_used}")
            lines.append(f"  单次收益: {r.per_play_revenue_normalized:.6f} {r.per_play_revenue_unit_used}")
            lines.append(f"  衰减系数: {r.decay_factor_used} (来源: {r.decay_source})")
            lines.append(f"  平台分成: {r.platform_share_used:.4f} (来源: {r.platform_share_source})")
            lines.append(f"  版权方分成: {r.rights_share_used:.4f} (来源: {r.rights_share_source})")
            lines.append(f"  距发行月数: {r.months_since_release}")
            lines.append("")

            lines.append("【计算过程】")
            for step in r.formula_steps:
                lines.append(f"  {step}")
            lines.append("")

            lines.append("【结果】")
            lines.append(f"  毛收益: {r.gross_revenue:,.2f} {r.revenue_currency}")
            lines.append(f"  净收益: {r.net_revenue:,.2f} {r.revenue_currency}")
            lines.append("")

            if r.boundary_warnings:
                lines.append("【边界值警告】")
                for w in r.boundary_warnings:
                    lines.append(f"  {w}")
                lines.append("")

            related_conflicts = [c for c in conflicts if c.record_id == r.record_id]
            if related_conflicts:
                lines.append("【参数冲突】")
                for c in related_conflicts:
                    lines.append(f"  字段: {c.field_name}")
                    lines.append(f"    参数表值: {c.param_value} (来源: {c.param_source})")
                    lines.append(f"    导入值: {c.data_value} (来源: {c.data_source})")
                    lines.append(f"    建议: {c.suggestion}")
                lines.append("")

            related_audit = [a for a in audit_entries if a.record_id == r.record_id]
            if related_audit:
                lines.append("【审计记录】")
                for a in related_audit:
                    lines.append(f"  [{a.timestamp}] {a.action}: {a.detail}")
                    lines.append(f"    原始来源: {a.original_source}")
                lines.append("")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return path

    def generate_summary(self, results: List[RoyaltyResult]) -> str:
        ts = self._timestamp()
        path = os.path.join(self.output_dir, f"royalty_summary_{ts}.txt")

        total_gross = 0.0
        total_net = 0.0
        by_type = {}
        exception_count = 0
        warning_count = 0

        for r in results:
            total_gross += r.gross_revenue
            total_net += r.net_revenue
            by_type.setdefault(r.revenue_type, {"gross": 0.0, "net": 0.0, "count": 0})
            by_type[r.revenue_type]["gross"] += r.gross_revenue
            by_type[r.revenue_type]["net"] += r.net_revenue
            by_type[r.revenue_type]["count"] += 1
            if r.is_exception:
                exception_count += 1
            if r.boundary_warnings:
                warning_count += 1

        lines = []
        lines.append("=" * 72)
        lines.append("音乐版权长尾收益 — 汇总报告")
        lines.append(f"生成时间: {datetime.now().isoformat()}")
        lines.append("=" * 72)
        lines.append("")
        lines.append(f"总记录数: {len(results)}")
        lines.append(f"例外记录数: {exception_count}")
        lines.append(f"有边界警告记录数: {warning_count}")
        lines.append("")
        lines.append("【汇总金额】")
        lines.append(f"  毛收益合计: {total_gross:,.2f} CNY")
        lines.append(f"  净收益合计: {total_net:,.2f} CNY")
        lines.append("")

        lines.append("【按收益类型】")
        for rtype, info in by_type.items():
            lines.append(f"  {rtype}: {info['count']}条 | 毛收益 {info['gross']:,.2f} | 净收益 {info['net']:,.2f}")
        lines.append("")

        lines.append("【各记录净收益一览】")
        for r in results:
            exc = " ★例外" if r.is_exception else ""
            warn = " ⚠边界" if r.boundary_warnings else ""
            lines.append(f"  {r.record_id} | {r.work_title} | {r.revenue_type} | 净收益 {r.net_revenue:,.2f} CNY{exc}{warn}")
        lines.append("")

        lines.append("【注意】")
        if exception_count > 0:
            lines.append(f"  汇总已包含 {exception_count} 条例外记录，例外不影响汇总计算但已标注。")
        lines.append("  汇总数字与明细报告一一对应，如不一致请以明细为准并联系核查。")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return path

    def generate_csv(self, results: List[RoyaltyResult]) -> str:
        ts = self._timestamp()
        path = os.path.join(self.output_dir, f"royalty_result_{ts}.csv")
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "记录ID", "作品名", "收益类型", "播放量(次)", "单次收益(元/次)",
                "衰减系数", "平台分成", "版权方分成", "距发行月数",
                "毛收益(CNY)", "净收益(CNY)", "是否例外", "例外备注",
                "边界警告"
            ])
            for r in results:
                writer.writerow([
                    r.record_id,
                    r.work_title,
                    r.revenue_type,
                    f"{r.play_count_normalized:,.0f}",
                    f"{r.per_play_revenue_normalized:.6f}",
                    r.decay_factor_used,
                    r.platform_share_used,
                    r.rights_share_used,
                    r.months_since_release,
                    f"{r.gross_revenue:,.2f}",
                    f"{r.net_revenue:,.2f}",
                    "是" if r.is_exception else "否",
                    r.exception_note,
                    "; ".join(r.boundary_warnings) if r.boundary_warnings else ""
                ])
        return path

    def generate_conflict_report(self, conflicts: List[ConflictItem]) -> str:
        ts = self._timestamp()
        path = os.path.join(self.output_dir, f"royalty_conflicts_{ts}.txt")
        lines = []
        lines.append("=" * 72)
        lines.append("音乐版权长尾收益 — 参数冲突清单")
        lines.append(f"生成时间: {datetime.now().isoformat()}")
        lines.append("=" * 72)
        lines.append("")

        if not conflicts:
            lines.append("无冲突。参数表与导入数据一致。")
        else:
            lines.append(f"共发现 {len(conflicts)} 处冲突：")
            lines.append("")
            for i, c in enumerate(conflicts, 1):
                lines.append(f"冲突 #{i}")
                lines.append(f"  记录ID: {c.record_id}")
                lines.append(f"  字段: {c.field_name}")
                lines.append(f"  参数表值: {c.param_value} (来源: {c.param_source})")
                lines.append(f"  导入值: {c.data_value} (来源: {c.data_source})")
                lines.append(f"  建议操作: {c.suggestion}")
                lines.append("")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return path
