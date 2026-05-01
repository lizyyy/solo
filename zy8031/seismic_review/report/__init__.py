import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass

from .data_loader import Event, WaveformData
from .picker import ArrivalPick


@dataclass
class StationReport:
    station: str
    network: str
    is_anomaly: bool
    anomaly_reason: Optional[str]
    picks: List[ArrivalPick]
    gaps: List[Dict]


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_event_report(
        self,
        event: Event,
        anomalies: List[Dict],
        matched_stations: List[Dict],
        waveform_previews: Optional[Dict] = None
    ) -> str:
        event_dir = self.output_dir / f"event_{event.event_id}"
        event_dir.mkdir(parents=True, exist_ok=True)

        report_path = event_dir / "report.md"
        report_content = self._build_markdown(event, anomalies, matched_stations)

        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report_content)

        return str(report_path)

    def _build_markdown(
        self,
        event: Event,
        anomalies: List[Dict],
        matched_stations: List[Dict]
    ) -> str:
        lines = []
        lines.append(f"# 事件 {event.event_id} 复核报告")
        lines.append("")
        lines.append(f"**发震时间**: {event.origin_time}")
        lines.append(f"**震中位置**: {event.latitude:.4f}°N, {event.longitude:.4f}°E")
        lines.append(f"**震源深度**: {event.depth:.1f} km")
        lines.append(f"**震级**: M{event.magnitude:.1f}")
        lines.append("")
        lines.append("## 异常台站")
        lines.append("")

        if not anomalies:
            lines.append("*无明显异常台站*")
        else:
            lines.append(f"| 台站 | 异常类型 | 详情 |")
            lines.append("|------|----------|------|")
            for a in anomalies:
                reason = a.get("reason", "unknown")
                details = a.get("details", "")
                station = a.get("station", "")
                lines.append(f"| {station} | {reason} | {details} |")

        lines.append("")
        lines.append("## 匹配台站")
        lines.append("")

        if not matched_stations:
            lines.append("*无匹配台站*")
        else:
            lines.append(f"| 台站 | P波到时(相对) | SNR | 匹配状态 |")
            lines.append("|------|---------------|-----|----------|")
            for m in matched_stations:
                station = m.get("station", "")
                pick = m.get("pick")
                if pick:
                    pick_time_rel = f"{pick.time:.2f}s"
                    snr = f"{pick.snr:.1f}"
                else:
                    pick_time_rel = "N/A"
                    snr = "N/A"
                matches = m.get("matches", [])
                match_status = "✓" if any(x.get("is_match") for x in matches) else "✗"
                lines.append(f"| {station} | {pick_time_rel} | {snr} | {match_status} |")

        lines.append("")
        lines.append("## 人工到时表")
        lines.append("")

        if not event.arrivals:
            lines.append("*无人工到时数据*")
        else:
            lines.append("| 台站 | 震相 | 到时 |")
            lines.append("|------|------|------|")
            for arr in event.arrivals:
                lines.append(f"| {arr.get('station', 'N/A')} | {arr.get('phase', '?')} | {arr.get('time', 'N/A')} |")

        lines.append("")
        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

        return "\n".join(lines)

    def generate_anomalies_csv(self, anomalies: List[Dict], event: Event) -> str:
        event_dir = self.output_dir / f"event_{event.event_id}"
        event_dir.mkdir(parents=True, exist_ok=True)

        csv_path = event_dir / "anomalies.csv"

        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            f.write("station,network,event_id,anomaly_reason,details\n")
            for a in anomalies:
                station = a.get("station", "")
                parts = station.split(".")
                net = parts[0] if len(parts) > 1 else ""
                sta = parts[1] if len(parts) > 1 else station
                reason = a.get("reason", "unknown")
                details = str(a.get("details", "")).replace(",", ";").replace("\n", " ")
                f.write(f"{sta},{net},{event.event_id},{reason},{details}\n")

        return str(csv_path)


def plot_waveform_preview(
    waveform: WaveformData,
    picks: List[ArrivalPick],
    event_origin: float,
    output_path: str,
    title: Optional[str] = None,
    duration: float = 60.0
) -> str:
    import dateutil.parser

    if len(waveform.data) < 2:
        return ""

    origin_dt = dateutil.parser.parse(waveform.start_time).timestamp() if isinstance(waveform.start_time, str) else waveform.start_time

    fig, ax = plt.subplots(1, 1, figsize=(12, 4))

    times = np.arange(len(waveform.data)) / waveform.sampling_rate

    ax.plot(times, waveform.data, "b-", linewidth=0.5, alpha=0.8)

    event_rel = event_origin - origin_dt
    if 0 <= event_rel <= times[-1]:
        ax.axvline(x=event_rel, color="g", linestyle="--", linewidth=1, label="Event Origin")

    for pick in picks:
        pick_rel = pick.time - origin_dt
        if 0 <= pick_rel <= times[-1]:
            ax.axvline(x=pick_rel, color="r", linestyle="-", linewidth=1.5, alpha=0.7)
            ax.text(pick_rel, ax.get_ylim()[1] * 0.9, f"{pick.phase}\nSNR={pick.snr:.1f}",
                   fontsize=8, color="red", ha="center")

    if title:
        ax.set_title(title)
    else:
        ax.set_title(f"{waveform.network}.{waveform.station} - {waveform.channel}")

    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Amplitude")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="upper right")

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    return output_path


def generate_markdown_report(
    event: Event,
    anomalies: List[Dict],
    matched_stations: List[Dict],
    output_path: str
) -> str:
    gen = ReportGenerator(os.path.dirname(output_path))
    filename = os.path.basename(output_path)

    if not filename.endswith(".md"):
        filename += ".md"

    full_path = os.path.join(os.path.dirname(output_path), filename)

    lines = []
    lines.append(f"# 事件 {event.event_id} 复核报告")
    lines.append("")
    lines.append(f"**发震时间**: {event.origin_time}")
    lines.append(f"**震中位置**: {event.latitude:.4f}°N, {event.longitude:.4f}°E")
    lines.append(f"**震源深度**: {event.depth:.1f} km")
    lines.append(f"**震级**: M{event.magnitude:.1f}")
    lines.append("")
    lines.append("## 异常台站")
    lines.append("")

    if not anomalies:
        lines.append("*无明显异常台站*")
    else:
        lines.append("| 台站 | 异常类型 | 详情 |")
        lines.append("|------|----------|------|")
        for a in anomalies:
            reason = a.get("reason", "unknown")
            details = a.get("details", "")
            station = a.get("station", "")
            lines.append(f"| {station} | {reason} | {details} |")

    lines.append("")
    lines.append("---")
    lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

    content = "\n".join(lines)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)

    return full_path
