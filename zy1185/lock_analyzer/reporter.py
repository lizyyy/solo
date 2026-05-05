from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .simulator import SimulationResult, TimelineEvent


class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o: Any) -> Any:
        if isinstance(o, datetime):
            return o.isoformat()
        if hasattr(o, "value"):
            return o.value
        if is_dataclass(o):
            return asdict(o)
        return super().default(o)


class Reporter:
    @staticmethod
    def to_json(result: SimulationResult, pretty: bool = True) -> str:
        data = {
            "success": result.success,
            "start_time": result.start_time.isoformat() if result.start_time else None,
            "end_time": result.end_time.isoformat() if result.end_time else None,
            "summary": {
                "total_events": result.total_events,
                "completed_events": result.completed_events,
                "blocked_events": result.blocked_events,
                "timeout_events": result.timeout_events,
                "has_deadlocks": len(result.deadlocks) > 0,
                "deadlock_count": len(result.deadlocks),
                "has_starvation_risk": len(result.starvation_risks) > 0,
                "starvation_risk_count": len(result.starvation_risks),
            },
            "deadlocks": [
                {
                    "connections": d.connections,
                    "detected_at": d.detected_at.isoformat(),
                    "waiting_graph": {k: list(v) for k, v in d.waiting_graph.items()},
                }
                for d in result.deadlocks
            ],
            "starvation_risks": [
                {
                    "connection_id": s.connection_id,
                    "waiting_since": s.waiting_since.isoformat(),
                    "wait_time_ms": s.wait_time_ms,
                    "blocked_by": s.blocked_by,
                    "threshold_ms": s.threshold_ms,
                }
                for s in result.starvation_risks
            ],
            "timeline": [
                {
                    "event_id": e.event_id,
                    "connection_id": e.connection_id,
                    "operation": e.operation.value,
                    "start_time": e.start_time.isoformat(),
                    "end_time": e.end_time.isoformat() if e.end_time else None,
                    "duration_ms": e.duration_ms,
                    "status": e.status.value,
                    "lock_type": e.lock_type.value if e.lock_type else None,
                    "blocking_reason": e.blocking_reason,
                    "blocked_by": e.blocked_by,
                    "details": e.details,
                }
                for e in result.timeline
            ],
            "lock_history": [
                {
                    "event_type": e.event_type,
                    "connection_id": e.connection_id,
                    "lock_type": e.lock_type.value,
                    "from_type": e.from_type.value if e.from_type else None,
                    "timestamp": e.timestamp.isoformat(),
                    "reason": e.reason,
                }
                for e in result.lock_history
            ],
            "errors": result.errors,
        }
        
        if pretty:
            return json.dumps(data, indent=2, default=str)
        return json.dumps(data, default=str)

    @staticmethod
    def to_markdown(result: SimulationResult, include_timeline: bool = True) -> str:
        lines = []
        
        lines.append("# 锁冲突复盘报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().isoformat()}")
        lines.append(f"**模拟结果**: {'✅ 成功' if result.success else '❌ 检测到问题'}")
        lines.append("")
        
        lines.append("## 摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总事件数 | {result.total_events} |")
        lines.append(f"| 已完成 | {result.completed_events} |")
        lines.append(f"| 被阻塞 | {result.blocked_events} |")
        lines.append(f"| 超时 | {result.timeout_events} |")
        lines.append(f"| 死锁数 | {len(result.deadlocks)} |")
        lines.append(f"| 饿死风险 | {len(result.starvation_risks)} |")
        lines.append("")
        
        if result.deadlocks:
            lines.append("## 🔴 死锁检测")
            lines.append("")
            for i, deadlock in enumerate(result.deadlocks, 1):
                lines.append(f"### 死锁 #{i}")
                lines.append("")
                lines.append(f"- **检测时间**: {deadlock.detected_at.isoformat()}")
                lines.append(f"- **涉及连接**: {', '.join(deadlock.connections)}")
                lines.append("")
                lines.append("**等待图**:")
                lines.append("")
                lines.append("```")
                for conn, waiting in deadlock.waiting_graph.items():
                    if waiting:
                        lines.append(f"  {conn} → {', '.join(waiting)}")
                lines.append("```")
                lines.append("")
        
        if result.starvation_risks:
            lines.append("## 🟡 饿死风险")
            lines.append("")
            for i, risk in enumerate(result.starvation_risks, 1):
                lines.append(f"### 风险 #{i}")
                lines.append("")
                lines.append(f"- **连接**: {risk.connection_id}")
                lines.append(f"- **等待时间**: {risk.wait_time_ms:.0f}ms (阈值: {risk.threshold_ms}ms)")
                lines.append(f"- **被阻塞者**: {', '.join(risk.blocked_by)}")
                lines.append("")
        
        lines.append("## 锁历史")
        lines.append("")
        lines.append("| 时间 | 事件类型 | 连接 | 锁类型 | 原因 |")
        lines.append("|------|----------|------|--------|------|")
        for event in result.lock_history:
            from_type = f" ({event.from_type.value})" if event.from_type else ""
            lines.append(
                f"| {event.timestamp.strftime('%H:%M:%S.%f')[:-3]} | "
                f"{event.event_type:10} | "
                f"{event.connection_id:10} | "
                f"{event.lock_type.value + from_type:15} | "
                f"{event.reason} |"
            )
        lines.append("")
        
        if include_timeline and result.timeline:
            lines.append("## 时间线")
            lines.append("")
            lines.append("| 事件ID | 时间 | 连接 | 操作 | 状态 | 锁类型 | 阻塞原因 |")
            lines.append("|--------|------|------|------|------|--------|----------|")
            for event in result.timeline:
                status_icon = Reporter._get_status_icon(event.status.value)
                lock_type = event.lock_type.value if event.lock_type else "-"
                blocking_reason = event.blocking_reason or "-"
                lines.append(
                    f"| {event.event_id} | "
                    f"{event.start_time.strftime('%H:%M:%S.%f')[:-3]} | "
                    f"{event.connection_id} | "
                    f"{event.operation.value} | "
                    f"{status_icon} {event.status.value} | "
                    f"{lock_type} | "
                    f"{blocking_reason} |"
                )
            lines.append("")
        
        if result.errors:
            lines.append("## 错误")
            lines.append("")
            for error in result.errors:
                lines.append(f"- {error}")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 锁类型说明")
        lines.append("")
        lines.append("| 锁类型 | 缩写 | 说明 |")
        lines.append("|--------|------|------|")
        lines.append("| **共享锁** | S | 多个读事务可同时持有，不阻塞其他读 |")
        lines.append("| **保留锁** | R | 写事务先获取，表示想写但不阻塞读 |")
        lines.append("| **等待锁** | P | 等待升级为排他锁，阻止新的共享锁 |")
        lines.append("| **排他锁** | X | 写事务最终持有，阻塞所有其他操作 |")
        lines.append("")
        
        lines.append("### 兼容性矩阵")
        lines.append("")
        lines.append("| 请求锁 \\ 持有锁 | 无锁 | 共享锁(S) | 保留锁(R) | 等待锁(P) | 排他锁(X) |")
        lines.append("|-----------------|------|-----------|-----------|-----------|-----------|")
        lines.append("| **共享锁(S)**   | ✅   | ✅        | ✅        | ❌        | ❌        |")
        lines.append("| **保留锁(R)**   | ✅   | ✅        | ❌        | ❌        | ❌        |")
        lines.append("| **排他锁(X)**   | ✅   | ❌        | ❌        | ❌        | ❌        |")
        lines.append("")
        
        return "\n".join(lines)

    @staticmethod
    def _get_status_icon(status: str) -> str:
        icons = {
            "pending": "⏳",
            "running": "▶️",
            "completed": "✅",
            "blocked": "🔴",
            "timeout": "⏰",
            "aborted": "❌",
        }
        return icons.get(status, "❓")

    @staticmethod
    def export_json(result: SimulationResult, file_path: Path, pretty: bool = True):
        content = Reporter.to_json(result, pretty=pretty)
        file_path.write_text(content, encoding="utf-8")

    @staticmethod
    def export_markdown(result: SimulationResult, file_path: Path, include_timeline: bool = True):
        content = Reporter.to_markdown(result, include_timeline=include_timeline)
        file_path.write_text(content, encoding="utf-8")

    @staticmethod
    def export_both(result: SimulationResult, base_path: Path, include_timeline: bool = True):
        Reporter.export_json(result, base_path.with_suffix(".json"))
        Reporter.export_markdown(result, base_path.with_suffix(".md"), include_timeline=include_timeline)


def format_timeline_console(result: SimulationResult) -> str:
    from rich.console import Console
    from rich.table import Table
    from rich.text import Text

    console = Console(force_terminal=True)
    
    table = Table(title="时间线")
    table.add_column("时间", style="cyan")
    table.add_column("连接", style="magenta")
    table.add_column("操作", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("锁类型", style="blue")
    table.add_column("阻塞原因", style="red")

    for event in result.timeline:
        status_color = {
            "completed": "green",
            "running": "yellow",
            "blocked": "red",
            "timeout": "bold red",
            "pending": "dim",
        }.get(event.status.value, "white")
        
        lock_text = event.lock_type.value if event.lock_type else "-"
        reason_text = event.blocking_reason if event.blocking_reason else "-"
        
        table.add_row(
            event.start_time.strftime("%H:%M:%S.%f")[:-3],
            event.connection_id,
            event.operation.value,
            Text(event.status.value, style=status_color),
            lock_text,
            reason_text,
        )

    with console.capture() as capture:
        console.print(table)
    
    return capture.get()
