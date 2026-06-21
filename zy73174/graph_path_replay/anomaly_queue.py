from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from .models import AnomalyItem, AnomalyStatus, ReplaySummary


class AnomalyQueue:
    def __init__(self, store_path: str = "./anomaly_queue.json"):
        self.store_path = Path(store_path)
        self.items: list[AnomalyItem] = []
        self._load()

    def _load(self) -> None:
        if self.store_path.exists():
            with open(self.store_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            existing_ids = {a["anomaly_id"] for a in raw}
            self.items = [AnomalyItem(**{**a, "status": AnomalyStatus(a["status"])}) for a in raw]
            self._existing_ids = existing_ids
        else:
            self._existing_ids = set()

    def _save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump([a.to_dict() for a in self.items], f, ensure_ascii=False, indent=2)

    def ingest_from_summary(self, summary: ReplaySummary) -> int:
        added = 0
        for anomaly in summary.anomalies:
            if anomaly.anomaly_id in self._existing_ids:
                continue
            self.items.append(anomaly)
            self._existing_ids.add(anomaly.anomaly_id)
            added += 1
        self._save()
        return added

    def mark_supplemented(self, anomaly_id: str, detail: str, operator: str = "duty") -> bool:
        return self._transition(anomaly_id, AnomalyStatus.SUPPLEMENTED, "补充信息", detail, operator)

    def mark_rejudged(self, anomaly_id: str, detail: str, operator: str = "duty") -> bool:
        return self._transition(anomaly_id, AnomalyStatus.REJUDGED, "改判", detail, operator)

    def mark_resolved(self, anomaly_id: str, detail: str, operator: str = "duty") -> bool:
        return self._transition(anomaly_id, AnomalyStatus.RESOLVED, "解决", detail, operator)

    def _transition(self, anomaly_id: str, target: AnomalyStatus, op_type: str, detail: str, operator: str) -> bool:
        for a in self.items:
            if a.anomaly_id == anomaly_id:
                a.status = target
                a.add_operation(op_type=op_type, detail=detail, operator=operator)
                self._save()
                return True
        return False

    def filter(self, predicate: Callable[[AnomalyItem], bool] | None = None) -> list[AnomalyItem]:
        if predicate is None:
            return list(self.items)
        return [a for a in self.items if predicate(a)]

    def count_by_status(self) -> dict[str, int]:
        counts = {s.value: 0 for s in AnomalyStatus}
        for a in self.items:
            counts[a.status.value] += 1
        return counts

    def print_duty_dashboard(self, stream=None) -> None:
        import sys
        out = stream or sys.stdout
        counts = self.count_by_status()
        sep = "=" * 70
        print(sep, file=out)
        print("  🔔 算法值班异常队列 (Anomaly Queue Dashboard)", file=out)
        print(sep, file=out)
        print(
            f"  🔴待处理:{counts['open']:<4d} "
            f"🟡已补充:{counts['supplemented']:<4d} "
            f"🔵已改判:{counts['rejudged']:<4d} "
            f"🟢已解决:{counts['resolved']:<4d} "
            f"| 总计:{len(self.items):<4d}",
            file=out,
        )
        print("-" * 70, file=out)
        print(
            f"  {'ID':<6s} {'状态':<10s} {'题目ID':<10s} "
            f"{'类型':<12s} {'标题(截取)':<22s} {'更新痕迹'}",
            file=out,
        )
        print("-" * 70, file=out)

        status_badge = {
            AnomalyStatus.OPEN: "🔴待处理",
            AnomalyStatus.SUPPLEMENTED: "🟡已补充",
            AnomalyStatus.REJUDGED: "🔵已改判",
            AnomalyStatus.RESOLVED: "🟢已解决",
        }

        for a in sorted(self.items, key=lambda x: (x.status.value, x.created_at)):
            ops = a.operation_log
            trace_parts = []
            if any(o["op_type"] == "补充信息" for o in ops):
                trace_parts.append("✅补过")
            else:
                trace_parts.append("  未补")
            if any(o["op_type"] == "改判" for o in ops):
                trace_parts.append("✅改判")
            else:
                trace_parts.append("  未判")
            if any(o["op_type"] == "解决" for o in ops):
                trace_parts.append("✅结")
            trace = " ".join(trace_parts)

            print(
                f"  {a.anomaly_id:<6s} {status_badge.get(a.status, '⚪?'):<10s} "
                f"{a.question_id:<10s} {a.anomaly_type:<12s} "
                f"{a.title[:20]:<22s} {trace}",
                file=out,
            )

        print("-" * 70, file=out)
        print("  图例说明: ", file=out)
        print("    ✅补过  = 已提交补充信息 (mark_supplemented)", file=out)
        print("    ✅改判  = 已人工改判原判定 (mark_rejudged)", file=out)
        print("    ✅结    = 值班人标记为已解决 (mark_resolved)", file=out)
        print("  操作指令（入口为 python3 -m graph_path_replay）: ", file=out)
        print("    $ python3 -m graph_path_replay queue supplement <ID> <说明> -w <工作目录>   # 提交补充", file=out)
        print("    $ python3 -m graph_path_replay queue rejudge   <ID> <说明> -w <工作目录>   # 人工改判", file=out)
        print("    $ python3 -m graph_path_replay queue resolve   <ID> <说明> -w <工作目录>   # 标记解决", file=out)
        print(sep, file=out)
