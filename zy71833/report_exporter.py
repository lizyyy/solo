from typing import List, Dict, Any, Optional
from models import BattleRecord, BattleResult, RECORD_STATUS
from datetime import datetime
import os
import json


STATUS_MAP = {
    "pending": "待处理",
    "processing": "处理中",
    "confirmed": "已确认",
    "on_hold": "已搁置",
}


class ReportExporter:
    def __init__(self, export_dir: str = "data/reports"):
        self.export_dir = export_dir
        os.makedirs(self.export_dir, exist_ok=True)

    def export_handover_report(
        self,
        records: List[BattleRecord],
        shift_info: Optional[Dict[str, str]] = None
    ) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"handover_report_{timestamp}.txt"
        filepath = os.path.join(self.export_dir, filename)

        shift_info = shift_info or {}
        on_duty = shift_info.get("on_duty", "未知")
        next_duty = shift_info.get("next_duty", "下一班")
        notes = shift_info.get("notes", "")

        pending_records = [r for r in records if r.status == "pending"]
        processing_records = [r for r in records if r.status == "processing"]
        confirmed_records = [r for r in records if r.status == "confirmed"]
        on_hold_records = [r for r in records if r.status == "on_hold"]

        lines = []
        lines.append("=" * 80)
        lines.append("  遗迹机关回合战 - 交接班复盘报告")
        lines.append("=" * 80)
        lines.append(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  交班人: {on_duty}")
        lines.append(f"  接班人: {next_duty}")
        if notes:
            lines.append(f"  交班备注: {notes}")
        lines.append("-" * 80)
        lines.append("")
        lines.append(f"📊 记录统计: 总数 {len(records)} | "
                     f"待处理 {len(pending_records)} | "
                     f"处理中 {len(processing_records)} | "
                     f"已确认 {len(confirmed_records)} | "
                     f"已搁置 {len(on_hold_records)}")
        lines.append("")

        if pending_records:
            lines.append("=" * 80)
            lines.append("🔴 待处理记录 (需要重点关注)")
            lines.append("=" * 80)
            for i, record in enumerate(pending_records, 1):
                lines.extend(self._format_record_summary(record, i, show_pending_reason=True))
                lines.append("")

        if processing_records:
            lines.append("=" * 80)
            lines.append("🟡 处理中记录")
            lines.append("=" * 80)
            for i, record in enumerate(processing_records, 1):
                lines.extend(self._format_record_summary(record, i))
                lines.append("")

        if confirmed_records:
            lines.append("=" * 80)
            lines.append("🟢 已确认记录")
            lines.append("=" * 80)
            for i, record in enumerate(confirmed_records, 1):
                lines.extend(self._format_record_summary(record, i))
                lines.append("")

        if on_hold_records:
            lines.append("=" * 80)
            lines.append("⚪ 已搁置记录")
            lines.append("=" * 80)
            for i, record in enumerate(on_hold_records, 1):
                lines.extend(self._format_record_summary(record, i))
                lines.append("")

        lines.append("=" * 80)
        lines.append("📋 最近变更历史 (最近10条)")
        lines.append("=" * 80)
        all_changes = []
        for record in records:
            for change in record.change_log:
                all_changes.append((record.record_id, change))
        all_changes.sort(key=lambda x: x[1].timestamp, reverse=True)
        for i, (rid, change) in enumerate(all_changes[:10], 1):
            lines.append(f"{i:2d}. [{change.timestamp}] {rid}")
            lines.append(f"    操作人: {change.operator} | 字段: {change.field_changed}")
            lines.append(f"    原因: {change.reason}")
            if change.field_changed == "status":
                lines.append(f"    {change.old_value} → {change.new_value}")
            lines.append("")

        lines.append("=" * 80)
        lines.append("💡 操作提示")
        lines.append("=" * 80)
        lines.append("  • 先处理所有 🔴 待处理 记录")
        lines.append("  • 对待处理记录，可以运行: python cli.py run <record_id>")
        lines.append("  • 查看单条记录详情: python cli.py show <record_id>")
        lines.append("  • 补传材料时系统会自动检测差异，不会静默覆盖")
        lines.append("  • 重复材料不会创建新记录，会匹配到已有记录")
        lines.append("")
        lines.append("=" * 80)
        lines.append("  报告结束 - 如需追溯详情，请使用 cli.py 工具查询")
        lines.append("=" * 80)

        content = "\n".join(lines)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        return filepath

    def export_detailed_report(
        self,
        record: BattleRecord,
        include_turn_log: bool = True
    ) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"record_{record.record_id}_{timestamp}.txt"
        filepath = os.path.join(self.export_dir, filename)

        lines = []
        lines.append("=" * 80)
        lines.append(f"  遗迹机关回合战 - 战斗记录详情")
        lines.append(f"  记录ID: {record.record_id}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("📌 基本信息")
        lines.append("-" * 40)
        lines.append(f"  状态: {STATUS_MAP.get(record.status, record.status)}")
        lines.append(f"  来源: {record.material.source}")
        lines.append(f"  材料版本: {record.material.version}")
        lines.append(f"  当前操作人: {record.operator}")
        lines.append(f"  创建时间: {record.created_at}")
        lines.append(f"  最后更新: {record.updated_at}")
        if record.pending_reason:
            lines.append(f"  待处理原因: {record.pending_reason}")
        if record.notes:
            lines.append(f"  备注: {record.notes}")
        lines.append("")

        lines.append("⚔️  战斗配置")
        lines.append("-" * 40)
        lines.append(f"  地形: {record.material.terrain}")
        lines.append(f"  天气: {record.material.weather}")
        lines.append(f"  回合顺序: {' → '.join(record.material.turn_order)}")
        if record.material.special_rules:
            lines.append(f"  特殊规则: {', '.join(record.material.special_rules)}")
        lines.append("")

        lines.append("👥 参战单位")
        lines.append("-" * 40)
        for unit in record.material.units:
            lines.append(f"  {unit.name} ({unit.unit_id}):")
            lines.append(f"    HP: {unit.hp} | 攻击: {unit.attack} | 防御: {unit.defense} | 速度: {unit.speed}")
            if unit.skills:
                lines.append(f"    技能: {', '.join(unit.skills)}")
        lines.append("")

        if record.result:
            lines.append("🏆 战斗结果")
            lines.append("-" * 40)
            res = record.result
            winner_name = next(
                (u.name for u in record.material.units if u.unit_id == res.winner),
                res.winner
            )
            lines.append(f"  胜者: {winner_name} ({res.winner})")
            lines.append(f"  总回合数: {res.total_turns}")
            lines.append(f"  平衡性评分: {res.balance_score}/100")
            lines.append(f"  最终血量: {res.final_hp}")
            if res.issues:
                lines.append("  ⚠️  问题提示:")
                for issue in res.issues:
                    lines.append(f"    - {issue}")
            lines.append("")

            if include_turn_log and res.turn_results:
                lines.append("📜 回合战报")
                lines.append("-" * 40)
                current_turn = 0
                for tr in res.turn_results:
                    if tr.turn_number != current_turn:
                        current_turn = tr.turn_number
                        lines.append(f")  第 {current_turn} 回合")
                    actor_name = next(
                        (u.name for u in record.material.units if u.unit_id == tr.acting_unit),
                        tr.acting_unit
                    )
                    target_name = next(
                        (u.name for u in record.material.units if u.unit_id == tr.target_unit),
                        tr.target_unit
                    )
                    lines.append(f"    {actor_name} → {target_name}: {tr.action} 造成 {tr.damage} 伤害")
                    if tr.notes:
                        lines.append(f"      备注: {tr.notes}")
                lines.append("")

        lines.append("📝 变更历史")
        lines.append("-" * 40)
        for i, change in enumerate(record.change_log, 1):
            lines.append(f"{i:2d}. [{change.timestamp}] 操作人: {change.operator}")
            lines.append(f"    字段: {change.field_changed} | 原因: {change.reason}")
            if change.field_changed == "status":
                lines.append(f"    状态变更: {STATUS_MAP.get(change.old_value, change.old_value)} "
                           f"→ {STATUS_MAP.get(change.new_value, change.new_value)}")
            else:
                lines.append(f"    旧值: {change.old_value}")
                lines.append(f"    新值: {change.new_value}")
            lines.append("")

        lines.append("🔍 材料版本历史")
        lines.append("-" * 40)
        for i, h in enumerate(record.material_hash_history, 1):
            lines.append(f"{i:2d}. {h}")
        lines.append("")

        content = "\n".join(lines)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

        return filepath

    def export_json_report(self, records: List[BattleRecord]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"report_{timestamp}.json"
        filepath = os.path.join(self.export_dir, filename)

        data = {
            "generated_at": datetime.now().isoformat(),
            "record_count": len(records),
            "status_summary": {
                status: len([r for r in records if r.status == status])
                for status in RECORD_STATUS
            },
            "records": [r.to_dict() for r in records],
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return filepath

    def _format_record_summary(
        self,
        record: BattleRecord,
        index: int,
        show_pending_reason: bool = False
    ) -> List[str]:
        lines = []
        status_emoji = {
            "pending": "🔴",
            "processing": "🟡",
            "confirmed": "🟢",
            "on_hold": "⚪",
        }.get(record.status, "⚪")

        lines.append(f"{index:2d}. {status_emoji} {record.record_id}")
        lines.append(f"    来源: {record.material.source} | 版本: {record.material.version}")
        lines.append(f"    状态: {STATUS_MAP.get(record.status, record.status)} | 操作人: {record.operator}")
        lines.append(f"    更新时间: {record.updated_at}")

        if record.result:
            winner_name = next(
                (u.name for u in record.material.units if u.unit_id == record.result.winner),
                record.result.winner
            )
            lines.append(f"    结果: {winner_name} 胜 | 回合数: {record.result.total_turns} | "
                        f"平衡分: {record.result.balance_score}")
            if record.result.issues:
                lines.append(f"    ⚠️  问题: {'; '.join(record.result.issues[:2])}")
        else:
            lines.append(f"    结果: 未运行")

        if show_pending_reason and record.pending_reason:
            lines.append(f"    ❗ 待处理原因: {record.pending_reason}")

        last_change = record.change_log[-1] if record.change_log else None
        if last_change:
            lines.append(f"    最后操作: [{last_change.timestamp}] {last_change.operator} "
                        f"- {last_change.reason}")

        return lines
