import json
import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any

from ..models import (
    CalibrationState,
    SolverResult,
    ValidationResult,
    SpeakerDelayResult,
    ValidationError,
    Speaker,
    MeasurementPoint,
    UnitSystem,
)


def generate_markdown_report(
    state: CalibrationState,
    solver_result: Optional[SolverResult] = None,
    validation_result: Optional[ValidationResult] = None,
    title: str = "声场延时校准报告",
) -> str:
    lines = [
        f"# {title}",
        "",
        f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**配置版本**: {state.config_version}",
        f"**单位制**: {state.unit_system.value}",
        "",
    ]

    lines.extend([
        "## 1. 系统概览",
        "",
        f"- **音箱总数**: {len(state.speakers)}",
        f"- **测点总数**: {len(state.points)}",
        f"- **测量数据组数**: {sum(len(p) for p in state.impulse_responses.values())}",
        "",
    ])

    if state.climate_data:
        lines.extend([
            "## 2. 环境参数",
            "",
            f"- **温度**: {state.climate_data.temperature_c:.1f} °C",
            f"- **相对湿度**: {state.climate_data.humidity_pct:.1f} %",
        ])
        if state.climate_data.pressure_kpa:
            lines.append(f"- **大气压**: {state.climate_data.pressure_kpa:.2f} kPa")
        if state.climate_data.note:
            lines.append(f"- **备注**: {state.climate_data.note}")
        lines.append("")

    if validation_result:
        lines.extend([
            "## 3. 数据校验结果",
            "",
            f"**校验状态**: {'✅ 通过' if validation_result.valid else '❌ 存在错误'}",
            "",
        ])

        if validation_result.errors:
            lines.extend([
                "### 错误",
                "",
                "| 类别 | 信息 | 详情 |",
                "|------|------|------|",
            ])
            for err in validation_result.errors:
                details = str(err.details) if err.details else "-"
                lines.append(f"| {err.category} | {err.message} | {details} |")
            lines.append("")

        if validation_result.warnings:
            lines.extend([
                "### 警告",
                "",
                "| 类别 | 信息 | 详情 |",
                "|------|------|------|",
            ])
            for warn in validation_result.warnings:
                details = str(warn.details) if warn.details else "-"
                lines.append(f"| {warn.category} | {warn.message} | {details} |")
            lines.append("")

    if solver_result:
        lines.extend([
            "## 4. 延时校准结果",
            "",
            f"**参考音箱**: {solver_result.reference_speaker_id}",
            f"**估算声速**: {solver_result.estimated_speed_of_sound:.2f} m/s",
            f"**声速置信度**: {solver_result.speed_of_sound_confidence:.2%}",
            "",
            "### 各音箱延时设置",
            "",
            "| 音箱ID | 建议延时(ms) | 相位风险 | 风险等级 | 使用测点 | 排除测点 | 置信度 |",
            "|--------|--------------|----------|----------|----------|----------|--------|",
        ])

        for spk_id, delay_result in sorted(solver_result.speaker_delays.items()):
            risk_icon = "🟢" if delay_result.phase_risk_level == "low" else (
                "🟡" if delay_result.phase_risk_level == "medium" else "🔴"
            )
            lines.append(
                f"| {spk_id} | {delay_result.delay_ms:.3f} | "
                f"{risk_icon} {delay_result.phase_risk_score:.2%} | "
                f"{delay_result.phase_risk_level} | "
                f"{len(delay_result.used_points)} | "
                f"{len(delay_result.excluded_points)} | "
                f"{delay_result.confidence:.2%} |"
            )

        lines.append("")

        high_risk_speakers = [
            (spk_id, dr)
            for spk_id, dr in solver_result.speaker_delays.items()
            if dr.phase_risk_level == "high"
        ]
        if high_risk_speakers:
            lines.extend([
                "### ⚠️ 高相位风险提示",
                "",
                "以下音箱存在较高的相位抵消风险，建议检查：",
                "",
            ])
            for spk_id, dr in high_risk_speakers:
                lines.append(
                    f"- **{spk_id}**: 延时差 {abs(dr.delta_ms):.3f}ms，"
                    f"风险分数 {dr.phase_risk_score:.2%}"
                )
            lines.append("")

        if solver_result.peak_details:
            lines.extend([
                "### 直达峰检测详情",
                "",
                "| 音箱 | 测点 | 到达时间(ms) | 置信度 |",
                "|------|------|--------------|--------|",
            ])
            for spk_id, points_data in sorted(solver_result.peak_details.items()):
                for pt_id, peak in sorted(points_data.items()):
                    lines.append(
                        f"| {spk_id} | {pt_id} | {peak.time_sec * 1000:.3f} | "
                        f"{peak.confidence:.2%} |"
                    )
            lines.append("")

    if state.overrides:
        lines.extend([
            "## 5. 人工覆盖配置",
            "",
            "| 测点ID | 音箱ID | 覆盖类型 | 原因 |",
            "|--------|--------|----------|------|",
        ])
        for override in state.overrides:
            spk_id = override.speaker_id or "全部"
            reason = override.reason or "-"
            lines.append(
                f"| {override.point_id} | {spk_id} | {override.override_type.value} | {reason} |"
            )
        lines.append("")

    lines.extend([
        "## 附录",
        "",
        "### A. 音箱配置",
        "",
        "| ID | 名称 | X | Y | Z | 组 | 通道 |",
        "|----|------|---|---|---|-----|------|",
    ])
    for spk_id, speaker in sorted(state.speakers.items()):
        group = speaker.group or "-"
        channel = speaker.channel if speaker.channel is not None else "-"
        lines.append(
            f"| {spk_id} | {speaker.name} | "
            f"{speaker.position.x:.3f} | {speaker.position.y:.3f} | {speaker.position.z:.3f} | "
            f"{group} | {channel} |"
        )

    lines.extend([
        "",
        "### B. 测点配置",
        "",
        "| ID | 名称 | X | Y | Z | 备注 |",
        "|----|------|---|---|---|------|",
    ])
    for pt_id, point in sorted(state.points.items()):
        note = point.note or "-"
        lines.append(
            f"| {pt_id} | {point.name} | "
            f"{point.position.x:.3f} | {point.position.y:.3f} | {point.position.z:.3f} | "
            f"{note} |"
        )

    lines.append("")
    lines.append(f"---")
    lines.append(f"*报告由声场延时校准助手生成 | {datetime.now().isoformat()}*")

    return "\n".join(lines)


def generate_delay_table(
    solver_result: SolverResult,
    speakers: Optional[Dict[str, Speaker]] = None,
) -> List[Dict[str, Any]]:
    rows = []

    for spk_id, delay_result in sorted(solver_result.speaker_delays.items()):
        speaker_name = spk_id
        speaker_channel = None
        speaker_group = None

        if speakers and spk_id in speakers:
            speaker = speakers[spk_id]
            speaker_name = speaker.name
            speaker_channel = speaker.channel
            speaker_group = speaker.group

        row = {
            "speaker_id": spk_id,
            "speaker_name": speaker_name,
            "is_reference": spk_id == solver_result.reference_speaker_id,
            "reference_speaker": solver_result.reference_speaker_id,
            "delay_ms": round(delay_result.delay_ms, 4),
            "reference_delay_ms": round(delay_result.reference_delay_ms, 4),
            "delta_ms": round(delay_result.delta_ms, 4),
            "phase_risk_score": round(delay_result.phase_risk_score, 4),
            "phase_risk_level": delay_result.phase_risk_level,
            "confidence": round(delay_result.confidence, 4),
            "used_points_count": len(delay_result.used_points),
            "excluded_points_count": len(delay_result.excluded_points),
            "locked_points_count": len(delay_result.locked_points),
            "used_points": ",".join(delay_result.used_points) if delay_result.used_points else "",
            "excluded_points": ",".join(delay_result.excluded_points) if delay_result.excluded_points else "",
            "locked_points": ",".join(delay_result.locked_points) if delay_result.locked_points else "",
        }

        if speaker_channel is not None:
            row["channel"] = speaker_channel
        if speaker_group is not None:
            row["group"] = speaker_group

        rows.append(row)

    return rows


def generate_audit_package(
    state: CalibrationState,
    solver_result: Optional[SolverResult] = None,
    validation_result: Optional[ValidationResult] = None,
) -> Dict[str, Any]:
    package: Dict[str, Any] = {
        "audit_version": "1.0",
        "generated_at": datetime.now().isoformat(),
        "calibration_state": {
            "config_version": state.config_version,
            "unit_system": state.unit_system.value,
            "created_at": state.created_at.isoformat() if state.created_at else None,
            "updated_at": state.updated_at.isoformat() if state.updated_at else None,
        },
    }

    speakers_dict = {}
    for spk_id, speaker in state.speakers.items():
        speakers_dict[spk_id] = {
            "id": speaker.id,
            "name": speaker.name,
            "position": speaker.position.to_list(),
            "group": speaker.group,
            "channel": speaker.channel,
        }
    package["speakers"] = speakers_dict

    points_dict = {}
    for pt_id, point in state.points.items():
        points_dict[pt_id] = {
            "id": point.id,
            "name": point.name,
            "position": point.position.to_list(),
            "note": point.note,
        }
    package["points"] = points_dict

    if state.climate_data:
        package["climate_data"] = {
            "timestamp": state.climate_data.timestamp.isoformat(),
            "temperature_c": state.climate_data.temperature_c,
            "humidity_pct": state.climate_data.humidity_pct,
            "pressure_kpa": state.climate_data.pressure_kpa,
            "note": state.climate_data.note,
        }

    ir_summary = {}
    for spk_id, points_data in state.impulse_responses.items():
        ir_summary[spk_id] = {}
        for pt_id, ir in points_data.items():
            ir_summary[spk_id][pt_id] = {
                "sample_rate": ir.sample_rate,
                "sample_count": len(ir.amplitude),
                "duration_sec": ir.duration,
                "metadata": ir.metadata,
            }
    package["impulse_response_summary"] = ir_summary

    package["overrides"] = [
        {
            "point_id": ov.point_id,
            "speaker_id": ov.speaker_id,
            "override_type": ov.override_type.value,
            "reason": ov.reason,
        }
        for ov in state.overrides
    ]

    if solver_result:
        package["solver_result"] = {
            "reference_speaker_id": solver_result.reference_speaker_id,
            "estimated_speed_of_sound": solver_result.estimated_speed_of_sound,
            "speed_of_sound_confidence": solver_result.speed_of_sound_confidence,
            "speaker_delays": {
                spk_id: {
                    "speaker_id": dr.speaker_id,
                    "delay_ms": dr.delay_ms,
                    "reference_delay_ms": dr.reference_delay_ms,
                    "delta_ms": dr.delta_ms,
                    "phase_risk_score": dr.phase_risk_score,
                    "phase_risk_level": dr.phase_risk_level,
                    "confidence": dr.confidence,
                    "used_points": dr.used_points,
                    "excluded_points": dr.excluded_points,
                    "locked_points": dr.locked_points,
                }
                for spk_id, dr in solver_result.speaker_delays.items()
            },
        }

    if validation_result:
        package["validation_result"] = {
            "valid": validation_result.valid,
            "errors": [
                {
                    "severity": e.severity,
                    "category": e.category,
                    "message": e.message,
                    "details": e.details,
                }
                for e in validation_result.errors
            ],
            "warnings": [
                {
                    "severity": w.severity,
                    "category": w.category,
                    "message": w.message,
                    "details": w.details,
                }
                for w in validation_result.warnings
            ],
        }

    return package


def write_markdown_report(
    output_path: Path,
    state: CalibrationState,
    solver_result: Optional[SolverResult] = None,
    validation_result: Optional[ValidationResult] = None,
) -> None:
    content = generate_markdown_report(state, solver_result, validation_result)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def write_delay_table_csv(
    output_path: Path,
    solver_result: SolverResult,
    speakers: Optional[Dict[str, Speaker]] = None,
) -> None:
    rows = generate_delay_table(solver_result, speakers)
    if not rows:
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = list(rows[0].keys())

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_audit_package_json(
    output_path: Path,
    state: CalibrationState,
    solver_result: Optional[SolverResult] = None,
    validation_result: Optional[ValidationResult] = None,
) -> None:
    package = generate_audit_package(state, solver_result, validation_result)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(package, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
