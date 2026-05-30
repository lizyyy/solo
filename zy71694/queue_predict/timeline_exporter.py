from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional

from .models import PipelineContext, TimelineEvent, AnomalyType


class TimelineExporter:
    def export_json(self, ctx: PipelineContext, output_path: str) -> str:
        data = []
        for event in ctx.timeline_events:
            data.append({
                "event_type": event.event_type,
                "time": event.time_point.isoformat() if event.time_point else None,
                "label": event.label,
                "duration_minutes": event.duration_minutes,
                "reg_id": event.reg_id,
                "doctor_id": event.doctor_id,
                "is_anomaly": event.is_anomaly,
                "detail": event.detail,
            })

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return output_path

    def export_csv(self, ctx: PipelineContext, output_path: str) -> str:
        lines = ["event_type,time,label,duration_minutes,reg_id,doctor_id,is_anomaly,detail"]
        for event in ctx.timeline_events:
            time_str = event.time_point.isoformat() if event.time_point else ""
            detail = event.detail.replace('"', '""')
            is_anomaly = "1" if event.is_anomaly else "0"
            lines.append(
                f'{event.event_type},{time_str},{event.label},'
                f'{event.duration_minutes},{event.reg_id},{event.doctor_id},'
                f'{is_anomaly},"{detail}"'
            )

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return output_path

    def export_matplotlib(self, ctx: PipelineContext, output_path: str) -> str:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            import matplotlib.dates as mdates
            from matplotlib.patches import FancyBboxPatch
        except ImportError:
            raise ImportError("需要安装 matplotlib: pip install matplotlib")

        plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "SimHei", "PingFang SC", "Heiti TC", "sans-serif"]
        plt.rcParams["axes.unicode_minus"] = False

        fig, ax = plt.subplots(figsize=(16, 8))

        schedule_map: Dict[str, Any] = {}
        for s in ctx.schedules:
            schedule_map[s.doctor_id] = s

        doctor_y: Dict[str, int] = {}
        y_pos = 0
        for s in ctx.schedules:
            if s.doctor_id not in doctor_y:
                doctor_y[s.doctor_id] = y_pos
                y_pos += 1

        colors = {
            "registration": "#4CAF50",
            "skip": "#FF9800",
            "addon": "#2196F3",
            "suspension": "#F44336",
        }

        for event in ctx.timeline_events:
            if event.time_point is None:
                continue
            y = doctor_y.get(event.doctor_id, 0)
            color = colors.get(event.event_type, "#9E9E9E")
            if event.is_anomaly:
                color = "#FF0000"

            ax.barh(
                y,
                width=0.005,
                left=event.time_point,
                color=color,
                alpha=0.7,
                edgecolor="red" if event.is_anomaly else "black",
                linewidth=2 if event.is_anomaly else 0.5,
            )

        ax.set_yticks(list(doctor_y.values()))
        ax.set_yticklabels(list(doctor_y.keys()))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
        ax.set_xlabel("时间")
        ax.set_ylabel("医生")
        ax.set_title(f"排队叫号时间轴 (参数快照: {ctx.param_snapshot_id})")

        from matplotlib.lines import Line2D
        legend_elements = [
            Line2D([0], [0], marker="s", color="w", markerfacecolor=colors["registration"], markersize=10, label="挂号"),
            Line2D([0], [0], marker="s", color="w", markerfacecolor=colors["skip"], markersize=10, label="过号"),
            Line2D([0], [0], marker="s", color="w", markerfacecolor=colors["addon"], markersize=10, label="加号"),
            Line2D([0], [0], marker="s", color="w", markerfacecolor=colors["suspension"], markersize=10, label="停诊"),
            Line2D([0], [0], marker="s", color="w", markerfacecolor="#FF0000", markersize=10, label="异常"),
        ]
        ax.legend(handles=legend_elements, loc="upper right")

        plt.tight_layout()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        plt.savefig(output_path, dpi=150)
        plt.close()
        return output_path

    def export_waiting_chart(self, ctx: PipelineContext, output_path: str) -> str:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
        except ImportError:
            raise ImportError("需要安装 matplotlib: pip install matplotlib")

        plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "SimHei", "PingFang SC", "Heiti TC", "sans-serif"]
        plt.rcParams["axes.unicode_minus"] = False

        fig, ax = plt.subplots(figsize=(14, 7))

        normal_ids = []
        normal_waits = []
        anomaly_ids = []
        anomaly_waits = []

        for reg in ctx.registrations:
            pred = ctx.prediction_results.get(reg.reg_id)
            if pred is None or pred.predicted_wait_minutes < 0:
                continue
            is_anomaly = (
                len(reg.anomaly_types) > 0
                and AnomalyType.NONE not in reg.anomaly_types
            )
            if is_anomaly:
                anomaly_ids.append(f"{reg.queue_number}号")
                anomaly_waits.append(pred.predicted_wait_minutes)
            else:
                normal_ids.append(f"{reg.queue_number}号")
                normal_waits.append(pred.predicted_wait_minutes)

        x_normal = range(len(normal_ids))
        x_anomaly = range(len(normal_ids), len(normal_ids) + len(anomaly_ids))

        if normal_waits:
            ax.bar(x_normal, normal_waits, color="#4CAF50", alpha=0.8, label="正常")
        if anomaly_waits:
            ax.bar(x_anomaly, anomaly_waits, color="#F44336", alpha=0.8, label="异常")

        for i, pred in enumerate([ctx.prediction_results.get(rid) for rid in [r.reg_id for r in ctx.registrations]]):
            if pred is None or pred.predicted_wait_minutes < 0:
                continue
            ax.errorbar(
                i,
                pred.predicted_wait_minutes,
                yerr=[[pred.predicted_wait_minutes - pred.confidence_low], [pred.confidence_high - pred.predicted_wait_minutes]],
                fmt="none",
                ecolor="black",
                capsize=3,
            )

        all_labels = normal_ids + anomaly_ids
        ax.set_xticks(range(len(all_labels)))
        ax.set_xticklabels(all_labels, rotation=45, ha="right")
        ax.set_xlabel("排队号")
        ax.set_ylabel("预估等待时间(分钟)")
        ax.set_title(f"等待时间预测 (参数快照: {ctx.param_snapshot_id})")
        ax.legend()

        plt.tight_layout()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        plt.savefig(output_path, dpi=150)
        plt.close()
        return output_path
