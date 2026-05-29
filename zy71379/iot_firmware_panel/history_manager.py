"""历史数据管理与复盘入口

功能：
1. 自动保存每次灰度任务的完整快照
2. 支持按任务ID、时间范围查询历史任务
3. 复盘入口：重新展示历史任务的报告和决策过程
4. 支持对比不同任务的结果
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict

from .models import GrayscaleTask, Device, Batch
from .report_exporter import ReportExporter
from .rollback_engine import RollbackEngine


DEFAULT_HISTORY_DIR = os.path.join(os.path.expanduser("~"), ".iot_firmware_panel", "history")


@dataclass
class HistoryRecord:
    """历史记录元数据"""
    task_id: str
    task_name: str
    target_version: str
    snapshot_file: str
    decision_log_file: Optional[str]
    created_at: datetime
    total_devices: int
    success_count: int
    failed_count: int
    rollback_count: int
    pending_confirm_count: int
    conclusion_level: str
    conclusion_message: str
    tags: List[str] = field(default_factory=list)
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        for k, v in data.items():
            if isinstance(v, datetime):
                data[k] = v.isoformat()
        return data


class HistoryManager:
    """历史数据管理器"""

    def __init__(self, history_dir: str = DEFAULT_HISTORY_DIR):
        self.history_dir = history_dir
        self.index_file = os.path.join(history_dir, "index.json")
        self._ensure_dirs()
        self._index: Dict[str, HistoryRecord] = self._load_index()

    def _ensure_dirs(self):
        os.makedirs(self.history_dir, exist_ok=True)
        os.makedirs(os.path.join(self.history_dir, "snapshots"), exist_ok=True)
        os.makedirs(os.path.join(self.history_dir, "decision_logs"), exist_ok=True)

    def _load_index(self) -> Dict[str, HistoryRecord]:
        if not os.path.exists(self.index_file):
            return {}

        try:
            with open(self.index_file, "r", encoding="utf-8") as f:
                raw_data = json.load(f)

            index = {}
            for task_id, record_data in raw_data.items():
                record_data["created_at"] = datetime.fromisoformat(record_data["created_at"])
                index[task_id] = HistoryRecord(**record_data)
            return index
        except Exception as e:
            print(f"[警告] 加载历史索引失败: {e}")
            return {}

    def _save_index(self):
        data = {k: v.to_dict() for k, v in self._index.items()}
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_snapshot(self, task: GrayscaleTask,
                      rollback_engine: Optional[RollbackEngine] = None,
                      decision_logs: Optional[List[str]] = None,
                      tags: Optional[List[str]] = None,
                      notes: Optional[str] = None) -> str:
        """保存任务快照"""
        snapshot_id = f"{task.original_task_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        snapshot_file = os.path.join(self.history_dir, "snapshots", f"{snapshot_id}.json")

        report_data = ReportExporter.build_unified_data(task, rollback_engine, decision_logs)

        with open(snapshot_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        decision_log_file = None
        if decision_logs:
            decision_log_file = os.path.join(self.history_dir, "decision_logs", f"{snapshot_id}.log")
            with open(decision_log_file, "w", encoding="utf-8") as f:
                f.write("\n".join(decision_logs))

        stats = report_data["summary"]["statistics"]
        conclusion = report_data["conclusion"]

        record = HistoryRecord(
            task_id=task.original_task_id,
            task_name=task.original_task_name,
            target_version=task.original_target_version,
            snapshot_file=snapshot_file,
            decision_log_file=decision_log_file,
            created_at=datetime.now(),
            total_devices=report_data["summary"]["total_devices"],
            success_count=stats["success"],
            failed_count=stats["failed"],
            rollback_count=stats["rollback"],
            pending_confirm_count=stats["pending_confirm"],
            conclusion_level=conclusion["level"],
            conclusion_message=conclusion["message"],
            tags=tags or [],
            notes=notes
        )

        self._index[task.original_task_id] = record
        self._save_index()

        return snapshot_file

    def list_history(self,
                     task_id_pattern: Optional[str] = None,
                     start_time: Optional[datetime] = None,
                     end_time: Optional[datetime] = None,
                     conclusion_level: Optional[str] = None,
                     tags: Optional[List[str]] = None) -> List[HistoryRecord]:
        """查询历史记录"""
        results = list(self._index.values())

        if task_id_pattern:
            results = [r for r in results if task_id_pattern in r.task_id]

        if start_time:
            results = [r for r in results if r.created_at >= start_time]

        if end_time:
            results = [r for r in results if r.created_at <= end_time]

        if conclusion_level:
            results = [r for r in results if r.conclusion_level == conclusion_level]

        if tags:
            results = [r for r in results if any(tag in r.tags for tag in tags)]

        results.sort(key=lambda r: r.created_at, reverse=True)
        return results

    def load_snapshot(self, task_id: str) -> Optional[Dict[str, Any]]:
        """加载历史快照数据"""
        if task_id not in self._index:
            return None

        record = self._index[task_id]
        if not os.path.exists(record.snapshot_file):
            return None

        with open(record.snapshot_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def replay(self, task_id: str, format_type: str = "terminal") -> Optional[str]:
        """复盘入口 - 重新生成历史报告"""
        data = self.load_snapshot(task_id)
        if data is None:
            return None

        if format_type == "json":
            return ReportExporter.export_json(data)
        elif format_type == "markdown":
            return ReportExporter.export_markdown(data)
        else:
            return ReportExporter.export_terminal(data)

    def replay_all(self, task_id: str) -> Optional[Dict[str, str]]:
        """复盘入口 - 生成所有格式的历史报告"""
        data = self.load_snapshot(task_id)
        if data is None:
            return None

        return {
            "json": ReportExporter.export_json(data),
            "terminal": ReportExporter.export_terminal(data),
            "markdown": ReportExporter.export_markdown(data),
        }

    def explain(self, task_id: str) -> Optional[str]:
        """解释历史结论 - 给出决策过程回顾"""
        record = self._index.get(task_id)
        data = self.load_snapshot(task_id)
        if not record or not data:
            return None

        lines = []
        lines.append("=" * 70)
        lines.append(f"  决策复盘: {record.task_name} ({record.task_id})")
        lines.append("=" * 70)
        lines.append("")
        lines.append(f"任务时间: {record.created_at.isoformat()}")
        lines.append(f"目标版本: {record.target_version}")
        lines.append("")
        lines.append("-" * 70)
        lines.append("  最终结论")
        lines.append("-" * 70)
        level_emoji = {
            "success": "✅",
            "warning": "⚠️",
            "error": "❌",
            "info": "ℹ️",
        }.get(record.conclusion_level, "•")
        lines.append(f"  {level_emoji} [{record.conclusion_level.upper()}] {record.conclusion_message}")
        lines.append("")

        lines.append("-" * 70)
        lines.append("  统计数据")
        lines.append("-" * 70)
        lines.append(f"  设备总数: {record.total_devices}")
        lines.append(f"  成功: {record.success_count}  失败: {record.failed_count}  "
                     f"回滚: {record.rollback_count}  待确认: {record.pending_confirm_count}")
        lines.append("")

        if data.get("warnings"):
            lines.append("-" * 70)
            lines.append(f"  关键警告 ({len(data['warnings'])})")
            lines.append("-" * 70)
            for w in data["warnings"]:
                lines.append(f"  • [{w['type']}] {w['message']}")
            lines.append("")

        if data.get("decision_logs"):
            lines.append("-" * 70)
            lines.append("  关键决策点")
            lines.append("-" * 70)
            key_logs = [l for l in data["decision_logs"]
                        if any(k in l for k in ["待确认", "失败", "回滚", "成功", "暂停", "阈值"])]
            for log in key_logs[:30]:
                lines.append(f"  {log}")
            if len(key_logs) > 30:
                lines.append(f"  ... 还有 {len(key_logs) - 30} 条日志，详见决策日志文件")
            lines.append("")

        if data.get("pending_confirm_devices"):
            lines.append("-" * 70)
            lines.append(f"  待确认设备 ({len(data['pending_confirm_devices'])})")
            lines.append("-" * 70)
            for item in data["pending_confirm_devices"]:
                reasons = ", ".join(item["reasons"])
                lines.append(f"  • {item['device_id']} ({item['batch']}): {reasons}")
            lines.append("")

        if record.notes:
            lines.append("-" * 70)
            lines.append("  备注")
            lines.append("-" * 70)
            lines.append(f"  {record.notes}")
            lines.append("")

        if record.decision_log_file and os.path.exists(record.decision_log_file):
            lines.append("-" * 70)
            lines.append(f"  完整决策日志: {record.decision_log_file}")
            lines.append(f"  快照文件: {record.snapshot_file}")
            lines.append("-" * 70)

        lines.append("")
        lines.append("  提示: 使用 replay(task_id, format='markdown') 可重新生成完整报告")
        lines.append("=" * 70)

        return "\n".join(lines)

    def compare(self, task_id_1: str, task_id_2: str) -> Optional[str]:
        """对比两个历史任务"""
        data1 = self.load_snapshot(task_id_1)
        data2 = self.load_snapshot(task_id_2)
        rec1 = self._index.get(task_id_1)
        rec2 = self._index.get(task_id_2)

        if not data1 or not data2 or not rec1 or not rec2:
            return None

        lines = []
        lines.append("=" * 70)
        lines.append(f"  任务对比: {rec1.task_name} vs {rec2.task_name}")
        lines.append("=" * 70)
        lines.append("")

        lines.append(f"{'项目':<20} {rec1.task_id:<30} {rec2.task_id:<30}")
        lines.append("-" * 80)
        lines.append(f"{'目标版本':<20} {rec1.target_version:<30} {rec2.target_version:<30}")
        lines.append(f"{'时间':<20} {rec1.created_at.strftime('%Y-%m-%d %H:%M'):<30} {rec2.created_at.strftime('%Y-%m-%d %H:%M'):<30}")
        lines.append(f"{'设备总数':<20} {rec1.total_devices:<30} {rec2.total_devices:<30}")
        lines.append(f"{'成功数':<20} {rec1.success_count:<30} {rec2.success_count:<30}")
        lines.append(f"{'失败数':<20} {rec1.failed_count:<30} {rec2.failed_count:<30}")
        lines.append(f"{'回滚数':<20} {rec1.rollback_count:<30} {rec2.rollback_count:<30}")
        lines.append(f"{'待确认':<20} {rec1.pending_confirm_count:<30} {rec2.pending_confirm_count:<30}")

        rate1 = rec1.success_count / rec1.total_devices * 100 if rec1.total_devices else 0
        rate2 = rec2.success_count / rec2.total_devices * 100 if rec2.total_devices else 0
        lines.append(f"{'成功率':<20} {rate1:.1f}%{'':<27} {rate2:.1f}%")

        diff = rate2 - rate1
        trend = "↑" if diff > 0 else "↓" if diff < 0 else "="
        lines.append(f"{'变化趋势':<20} {trend} {abs(diff):.1f}%")
        lines.append("")

        lines.append(f"结论1: [{rec1.conclusion_level.upper()}] {rec1.conclusion_message}")
        lines.append(f"结论2: [{rec2.conclusion_level.upper()}] {rec2.conclusion_message}")
        lines.append("")

        lines.append("=" * 70)

        return "\n".join(lines)

    def delete(self, task_id: str) -> bool:
        """删除历史记录"""
        if task_id not in self._index:
            return False

        record = self._index[task_id]

        if os.path.exists(record.snapshot_file):
            os.remove(record.snapshot_file)

        if record.decision_log_file and os.path.exists(record.decision_log_file):
            os.remove(record.decision_log_file)

        del self._index[task_id]
        self._save_index()
        return True

    def update_notes(self, task_id: str, notes: str) -> bool:
        """更新历史记录备注"""
        if task_id not in self._index:
            return False

        self._index[task_id].notes = notes
        self._save_index()
        return True

    def add_tags(self, task_id: str, tags: List[str]) -> bool:
        """添加标签"""
        if task_id not in self._index:
            return False

        for tag in tags:
            if tag not in self._index[task_id].tags:
                self._index[task_id].tags.append(tag)

        self._save_index()
        return True
