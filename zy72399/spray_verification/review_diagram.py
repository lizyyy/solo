import os
from datetime import datetime
from typing import List, Optional
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from .models import (
    VerificationRecord,
    ReviewDiagramData,
    RecordStatus,
    WorkflowState,
)


def to_diagram_data(record: VerificationRecord) -> ReviewDiagramData:
    return ReviewDiagramData(
        record_id=record.record_id,
        sensor_id=record.sensor_record.sensor_id,
        status=record.status,
        coverage_rate=record.sensor_record.coverage_rate,
        sample_time=record.sensor_record.sample_time,
        caliber=record.sensor_record.caliber,
        has_photo=record.photo_record is not None,
        has_conflict=len(record.conflicts) > 0,
        is_supplemented=record.sensor_record.source == "photo_supplement",
    )


def generate_review_table(records: List[VerificationRecord]) -> pd.DataFrame:
    diagram_data = [to_diagram_data(r) for r in records]
    data = []
    for d in diagram_data:
        data.append({
            "记录ID": d.record_id,
            "传感器编号": d.sensor_id,
            "采样时间": d.sample_time,
            "覆盖率(%)": d.coverage_rate,
            "口径": d.caliber.value,
            "状态": d.status.value,
            "有工况照片": "是" if d.has_photo else "否",
            "有冲突": "是" if d.has_conflict else "否",
            "补录数据": "是" if d.is_supplemented else "否",
        })
    return pd.DataFrame(data)


def generate_coverage_chart(
    records: List[VerificationRecord],
    output_path: str = "review_chart.png",
) -> str:
    diagram_data = [to_diagram_data(r) for r in records]

    fig, axes = plt.subplots(2, 1, figsize=(12, 10))

    status_colors = {
        "normal": "#2ecc71",
        "missing_half_hour": "#f39c12",
        "supplemented": "#3498db",
        "pending_review": "#e74c3c",
        "conflict": "#9b59b6",
        "confirmed": "#1abc9c",
        "rejected": "#7f8c8d",
    }

    ax1 = axes[0]
    for d in diagram_data:
        color = status_colors.get(d.status.value, "#95a5a6")
        marker = "D" if d.is_supplemented else "o"
        size = 100 if d.has_conflict else 60
        ax1.scatter(
            d.sample_time,
            d.coverage_rate,
            color=color,
            marker=marker,
            s=size,
            label=f"{d.sensor_id} ({d.status.value})",
            zorder=5,
        )
        ax1.annotate(
            d.sensor_id,
            (d.sample_time, d.coverage_rate),
            xytext=(5, 5),
            textcoords="offset points",
            fontsize=9,
        )

    ax1.axhline(y=90, color="green", linestyle="--", alpha=0.7, label="优秀线 (90%)")
    ax1.axhline(y=85, color="orange", linestyle="--", alpha=0.7, label="合格线 (85%)")
    ax1.set_xlabel("采样时间")
    ax1.set_ylabel("覆盖率 (%)")
    ax1.set_title("高压喷淋覆盖校验 - 覆盖率时间分布")
    ax1.legend(bbox_to_anchor=(1.05, 1), loc="upper left", fontsize=8)
    ax1.grid(True, alpha=0.3)
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d %H:%M"))
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45)

    ax2 = axes[1]
    status_counts = {}
    for d in diagram_data:
        s = d.status.value
        status_counts[s] = status_counts.get(s, 0) + 1

    labels = list(status_counts.keys())
    values = list(status_counts.values())
    colors = [status_colors.get(l, "#95a5a6") for l in labels]

    bars = ax2.bar(labels, values, color=colors, alpha=0.8)
    for bar, val in zip(bars, values):
        ax2.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.05,
            str(val),
            ha="center",
            va="bottom",
        )

    ax2.set_xlabel("记录状态")
    ax2.set_ylabel("数量")
    ax2.set_title("高压喷淋覆盖校验 - 状态分布")
    ax2.tick_params(axis="x", rotation=45)
    ax2.grid(True, alpha=0.3, axis="y")

    plt.tight_layout()
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    return os.path.abspath(output_path)


def export_history_report(
    state: WorkflowState,
    output_path: str = "history_report.md",
) -> str:
    lines = []
    lines.append("# 高压喷淋覆盖校验 - 复盘记录")
    lines.append("")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**当前阶段**: {state.current_step.value}")
    lines.append("")
    lines.append("## 处理历史")
    lines.append("")

    for i, entry in enumerate(state.history, 1):
        lines.append(f"### {i}. {entry['action']}")
        lines.append(f"- 时间: {entry['timestamp']}")
        for key, value in entry["details"].items():
            lines.append(f"- {key}: {value}")
        lines.append("")

    lines.append("## 记录详情")
    lines.append("")

    for record in state.records:
        lines.append(f"### 记录 {record.record_id}")
        lines.append(f"- 传感器: {record.sensor_record.sensor_id}")
        lines.append(f"- 采样时间: {record.sensor_record.sample_time}")
        lines.append(f"- 覆盖率: {record.sensor_record.coverage_rate}%")
        lines.append(f"- 口径: {record.sensor_record.caliber.value}")
        lines.append(f"- 状态: {record.status.value}")
        lines.append(f"- 数据来源: {record.sensor_record.source}")

        if record.conflicts:
            lines.append("- 冲突证据:")
            for c in record.conflicts:
                lines.append(f"  - [{c.conflict_type}] {c.description}")
                lines.append(f"    - 传感器值: {c.sensor_value}")
                lines.append(f"    - 照片值: {c.photo_value}")

        if record.reviewer:
            lines.append(f"- 复核人: {record.reviewer}")
        if record.review_comments:
            lines.append(f"- 复核意见: {record.review_comments}")

        lines.append("")

    lines.append("## 重新运行命令")
    lines.append("")
    lines.append("```bash")
    lines.append("# 运行完整校验流程")
    lines.append("python -m spray_verification.cli run-full")
    lines.append("")
    lines.append("# 仅运行正常材料校验")
    lines.append("python -m spray_verification.cli run-normal")
    lines.append("")
    lines.append("# 仅运行错口径材料校验")
    lines.append("python -m spray_verification.cli run-conflict")
    lines.append("")
    lines.append("# 仅运行补录材料校验")
    lines.append("python -m spray_verification.cli run-supplement")
    lines.append("```")

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return os.path.abspath(output_path)


def print_conflict_evidence(record: VerificationRecord):
    print(f"\n{'='*60}")
    print(f"发现冲突 - 记录: {record.record_id}")
    print(f"{'='*60}")
    print(f"传感器编号: {record.sensor_record.sensor_id}")
    print(f"采样时间: {record.sensor_record.sample_time}")
    print(f"\n冲突证据:")
    for i, conflict in enumerate(record.conflicts, 1):
        print(f"  {i}. 类型: {conflict.conflict_type}")
        print(f"     描述: {conflict.description}")
        print(f"     传感器值: {conflict.sensor_value}")
        print(f"     照片值: {conflict.photo_value}")
    print(f"\n请训练教练老唐选择:")
    print(f"  [1] 确认 - 以照片为准")
    print(f"  [2] 驳回 - 以传感器为准")
    print(f"{'='*60}\n")
