import json
import os
from enum import Enum
from typing import List, Dict, Any
from datetime import datetime
from dataclasses import asdict
from tabulate import tabulate

from .models import (
    AnalysisResult,
    MeasureAnalysis,
    BeatDeviation,
    DeviationType,
    EventSeverity,
    TimelineEventType,
)


class ReportGenerator:
    @staticmethod
    def generate_terminal_summary(result: AnalysisResult) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("🥁 鼓手节拍偏差分析 - 终端摘要")
        lines.append("=" * 70)
        lines.append("")

        lines.append(f"📁 音频文件: {os.path.basename(result.audio_file)}")
        lines.append(f"⏱️  分析时间: {result.analyzed_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(
            f"🎼 拍号: {result.time_signature[0]}/{result.time_signature[1]}"
        )
        lines.append(f"🎯 参考 BPM: {result.reference_bpm:.1f}")
        lines.append(f"🔍 检测 BPM: {result.detected_bpm:.1f}")
        lines.append("")

        lines.append("-" * 70)
        lines.append("📊 总体统计")
        lines.append("-" * 70)
        lines.append(f"  总小节数: {result.total_measures}")
        lines.append(f"  总节拍数: {result.total_beats}")
        lines.append(f"  平均偏差: {result.overall_avg_deviation_ms:.1f} ms")
        lines.append(f"  偏差标准差: {result.overall_deviation_std_ms:.1f} ms")
        lines.append("")

        if result.lag_measures:
            lines.append(
                f"⚠️  拖拍小节 ({len(result.lag_measures)} 个): 第 {ReportGenerator._format_measure_list(result.lag_measures)} 小节"
            )
        if result.lead_measures:
            lines.append(
                f"⚠️  抢拍小节 ({len(result.lead_measures)} 个): 第 {ReportGenerator._format_measure_list(result.lead_measures)} 小节"
            )
        if result.missed_beat_measures:
            lines.append(
                f"❌ 漏拍小节 ({len(result.missed_beat_measures)} 个): 第 {ReportGenerator._format_measure_list(result.missed_beat_measures)} 小节"
            )
        if not result.lag_measures and not result.lead_measures and not result.missed_beat_measures:
            lines.append("✅ 所有小节节拍准确！")
        lines.append("")

        if result.problem_measures_summary:
            lines.append("-" * 70)
            lines.append("🎯 问题摘要")
            lines.append("-" * 70)
            for summary in result.problem_measures_summary:
                lines.append(f"  • {summary}")
            lines.append("")

        if result.consistency_check:
            lines.append("-" * 70)
            lines.append("🔍 一致性检查")
            lines.append("-" * 70)
            lines.append(f"  录音结论: {result.consistency_check.audio_conclusion}")
            lines.append(f"  参考结论: {result.consistency_check.reference_conclusion}")
            lines.append(
                f"  一致性: {'✅ 一致' if result.consistency_check.is_consistent else '⚠️  不一致'}"
            )
            lines.append(f"  判断理由: {result.consistency_check.resolution_reason}")
            lines.append("")

        if result.progress and result.progress.has_previous:
            lines.append("-" * 70)
            lines.append("📈 进步分析")
            lines.append("-" * 70)
            lines.append(f"  {result.progress.human_reason}")
            lines.append("")

        lines.append("-" * 70)
        lines.append("💬 综合评价")
        lines.append("-" * 70)
        lines.append(f"  {result.human_summary}")
        lines.append("")

        if result.bpm_evidences:
            lines.append("-" * 70)
            lines.append("📐 BPM 证据链")
            lines.append("-" * 70)
            for evidence in result.bpm_evidences:
                lines.append(
                    f"  [{evidence.source}] BPM={evidence.bpm:.1f}, "
                    f"置信度={evidence.confidence:.2f}, "
                    f"覆盖 {evidence.time_range[0]:.1f}s-{evidence.time_range[1]:.1f}s"
                )
                lines.append(f"      → {evidence.support_reason}")
            lines.append("")

        lines.append("-" * 70)
        lines.append("⏱️  关键事件时序（前 10 条）")
        lines.append("-" * 70)
        important_events = [
            e
            for e in result.timeline
            if e.severity in (EventSeverity.WARNING, EventSeverity.ERROR)
        ]
        for event in important_events[:10]:
            severity_icon = "❌" if event.severity == EventSeverity.ERROR else "⚠️ "
            lines.append(
                f"  {severity_icon} [{event.time:.2f}s] 第 {event.measure:>3} 小节 | {event.description}"
            )
        if len(important_events) > 10:
            lines.append(f"  ... 还有 {len(important_events) - 10} 条事件，详见详细报告")
        lines.append("")

        lines.append("=" * 70)
        return "\n".join(lines)

    @staticmethod
    def generate_detailed_report(
        result: AnalysisResult, output_dir: str
    ) -> str:
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(result.audio_file))[0]
        report_path = os.path.join(output_dir, f"{base_name}_detailed_report.html")

        html = ReportGenerator._generate_html_report(result)

        with open(report_path, "w", encoding="utf-8") as f:
            f.write(html)

        return report_path

    @staticmethod
    def generate_json_result(result: AnalysisResult, output_dir: str) -> str:
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(result.audio_file))[0]
        json_path = os.path.join(output_dir, f"{base_name}_analysis_result.json")

        result_dict = ReportGenerator._result_to_dict(result)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(result_dict, f, ensure_ascii=False, indent=2, default=str)

        return json_path

    @staticmethod
    def generate_measure_details_table(measures: List[MeasureAnalysis]) -> str:
        table_data = []
        for measure in measures:
            lag_count = sum(
                1 for d in measure.deviations if d.deviation_type == DeviationType.LAG
            )
            lead_count = sum(
                1 for d in measure.deviations if d.deviation_type == DeviationType.LEAD
            )
            missed_count = sum(
                1 for d in measure.deviations if d.deviation_type == DeviationType.MISSED
            )

            status = "✅"
            if measure.has_missed:
                status = "❌"
            elif measure.has_lag or measure.has_lead:
                status = "⚠️"

            table_data.append(
                [
                    measure.measure_number,
                    status,
                    f"{measure.start_time:.2f}s-{measure.end_time:.2f}s",
                    f"{measure.avg_deviation_ms:.1f} ms",
                    lag_count,
                    lead_count,
                    missed_count,
                    measure.problem_summary,
                ]
            )

        return tabulate(
            table_data,
            headers=[
                "小节",
                "状态",
                "时间范围",
                "平均偏差",
                "拖拍",
                "抢拍",
                "漏拍",
                "问题说明",
            ],
            tablefmt="grid",
        )

    @staticmethod
    def generate_deviation_details_table(deviations: List[BeatDeviation]) -> str:
        table_data = []
        for dev in deviations:
            type_icon = {
                DeviationType.LAG: "🐢",
                DeviationType.LEAD: "🐇",
                DeviationType.ON_TIME: "✅",
                DeviationType.MISSED: "❌",
                DeviationType.NOISE: "🔊",
            }.get(dev.deviation_type, "?")

            severity_icon = {
                EventSeverity.ERROR: "🔴",
                EventSeverity.WARNING: "🟡",
                EventSeverity.INFO: "🟢",
            }.get(dev.severity, "⚪")

            table_data.append(
                [
                    f"{dev.beat_event.measure}-{dev.beat_event.beat_in_measure}",
                    type_icon,
                    severity_icon,
                    f"{dev.expected_time:.3f}s",
                    f"{dev.actual_time:.3f}s",
                    f"{dev.deviation_ms:+.0f} ms",
                    dev.beat_event.beat_type.value,
                    f"{dev.beat_event.confidence:.2f}",
                ]
            )

        return tabulate(
            table_data,
            headers=[
                "小节-拍",
                "类型",
                "严重度",
                "期望时间",
                "实际时间",
                "偏差",
                "节拍类型",
                "置信度",
            ],
            tablefmt="grid",
        )

    @staticmethod
    def _generate_html_report(result: AnalysisResult) -> str:
        measures_html = ""
        for measure in result.measures:
            deviations_html = ""
            for dev in measure.deviations:
                dev_class = {
                    DeviationType.LAG: "deviation-lag",
                    DeviationType.LEAD: "deviation-lead",
                    DeviationType.ON_TIME: "deviation-ontime",
                    DeviationType.MISSED: "deviation-missed",
                    DeviationType.NOISE: "deviation-noise",
                }.get(dev.deviation_type, "")

                severity_class = {
                    EventSeverity.ERROR: "severity-error",
                    EventSeverity.WARNING: "severity-warning",
                    EventSeverity.INFO: "severity-info",
                }.get(dev.severity, "")

                deviations_html += f"""
                <tr class="{dev_class} {severity_class}">
                    <td>{dev.beat_event.measure}-{dev.beat_event.beat_in_measure}</td>
                    <td>{dev.beat_event.beat_type.value}</td>
                    <td>{dev.expected_time:.3f}s</td>
                    <td>{dev.actual_time:.3f}s</td>
                    <td class="deviation-value">{dev.deviation_ms:+.0f} ms</td>
                    <td>{dev.deviation_type.value}</td>
                    <td>{dev.severity.value}</td>
                    <td>{dev.beat_event.confidence:.2f}</td>
                </tr>
                """

            measure_status = "measure-ok"
            if measure.has_missed:
                measure_status = "measure-error"
            elif measure.has_lag or measure.has_lead:
                measure_status = "measure-warning"

            measures_html += f"""
            <div class="measure-section {measure_status}">
                <h3>第 {measure.measure_number} 小节 <span class="time-range">({measure.start_time:.2f}s - {measure.end_time:.2f}s)</span></h3>
                <div class="measure-summary">
                    <span class="avg-deviation">平均偏差: {measure.avg_deviation_ms:.1f} ms</span>
                    <span class="problem">{measure.problem_summary}</span>
                </div>
                <table class="deviations-table">
                    <thead>
                        <tr>
                            <th>位置</th>
                            <th>节拍类型</th>
                            <th>期望时间</th>
                            <th>实际时间</th>
                            <th>偏差</th>
                            <th>偏差类型</th>
                            <th>严重度</th>
                            <th>置信度</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deviations_html}
                    </tbody>
                </table>
            </div>
            """

        timeline_html = ""
        for event in result.timeline:
            event_class = {
                TimelineEventType.BPM_CHANGE: "event-bpm",
                TimelineEventType.WEAK_BEAT_MISS: "event-miss",
                TimelineEventType.NOISE_FALSE_POSITIVE: "event-noise",
                TimelineEventType.MEASURE_START: "event-measure",
                TimelineEventType.SIGNIFICANT_DEVIATION: "event-deviation",
            }.get(event.event_type, "")

            severity_class = {
                EventSeverity.ERROR: "severity-error",
                EventSeverity.WARNING: "severity-warning",
                EventSeverity.INFO: "severity-info",
            }.get(event.severity, "")

            details_html = ""
            if event.details:
                details_html = "<div class='event-details'>"
                for k, v in event.details.items():
                    if isinstance(v, float):
                        v = f"{v:.3f}"
                    details_html += f"<span class='detail-item'><strong>{k}:</strong> {v}</span>"
                details_html += "</div>"

            timeline_html += f"""
            <div class="timeline-item {event_class} {severity_class}">
                <div class="timeline-time">[{event.time:.2f}s]</div>
                <div class="timeline-content">
                    <div class="timeline-header">
                        <span class="event-type">{event.event_type.value}</span>
                        <span class="event-measure">第 {event.measure} 小节</span>
                        <span class="event-order">#{event.order}</span>
                    </div>
                    <div class="timeline-description">{event.description}</div>
                    {details_html}
                </div>
            </div>
            """

        bpm_evidence_html = ""
        for evidence in result.bpm_evidences:
            bpm_evidence_html += f"""
            <div class="bpm-evidence">
                <div class="bpm-source">{evidence.source}</div>
                <div class="bpm-value">BPM: <strong>{evidence.bpm:.1f}</strong></div>
                <div class="bpm-confidence">置信度: {evidence.confidence:.2f}</div>
                <div class="bpm-range">时间范围: {evidence.time_range[0]:.1f}s - {evidence.time_range[1]:.1f}s</div>
                <div class="bpm-beats">节拍数: {evidence.beat_count}</div>
                <div class="bpm-reason">💡 {evidence.support_reason}</div>
            </div>
            """

        consistency_html = ""
        if result.consistency_check:
            bpm_evidence_for_consistency = ""
            for evidence in result.consistency_check.bpm_evidences:
                bpm_evidence_for_consistency += f"""
                <div class="bpm-evidence-mini">
                    <strong>{evidence.source}:</strong> BPM={evidence.bpm:.1f}, 置信度={evidence.confidence:.2f}
                    <div class="support-reason">→ {evidence.support_reason}</div>
                </div>
                """

            consistency_html = f"""
            <div class="section">
                <h2>🔍 一致性检查</h2>
                <div class="consistency-check">
                    <div class="consistency-item">
                        <span class="label">录音分析结论:</span>
                        <span class="value">{result.consistency_check.audio_conclusion}</span>
                    </div>
                    <div class="consistency-item">
                        <span class="label">参考节拍结论:</span>
                        <span class="value">{result.consistency_check.reference_conclusion}</span>
                    </div>
                    <div class="consistency-item">
                        <span class="label">一致性:</span>
                        <span class="value {'consistent' if result.consistency_check.is_consistent else 'inconsistent'}">
                            {'✅ 一致' if result.consistency_check.is_consistent else '⚠️  不一致'}
                        </span>
                    </div>
                    <div class="consistency-item">
                        <span class="label">判断理由:</span>
                        <span class="value reason">{result.consistency_check.resolution_reason}</span>
                    </div>
                    <div class="bpm-evidences-section">
                        <h4>📐 补充 BPM 证据</h4>
                        {bpm_evidence_for_consistency}
                    </div>
                </div>
            </div>
            """

        progress_html = ""
        if result.progress and result.progress.has_previous:
            progress_html = f"""
            <div class="section">
                <h2>📈 进步分析</h2>
                <div class="progress-comparison">
                    <div class="progress-item">
                        <span class="label">上次平均偏差:</span>
                        <span class="value">{result.progress.previous_avg_deviation:.1f} ms</span>
                    </div>
                    <div class="progress-item">
                        <span class="label">本次平均偏差:</span>
                        <span class="value">{result.progress.current_avg_deviation:.1f} ms</span>
                    </div>
                    <div class="progress-item">
                        <span class="label">改善程度:</span>
                        <span class="value {'positive' if result.progress.improvement_percent > 0 else 'negative'}">
                            {result.progress.improvement_percent:+.1f}%
                        </span>
                    </div>
                    <div class="progress-item">
                        <span class="label">问题小节变化:</span>
                        <span class="value">{'减少' if result.progress.problem_measures_reduced >= 0 else '增加'} {abs(result.progress.problem_measures_reduced)} 个</span>
                    </div>
                    <div class="progress-human">
                        💬 {result.progress.human_reason}
                    </div>
                </div>
            </div>
            """

        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>鼓手节拍偏差分析 - 详细报告</title>
    <style>
        {{css}}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🥁 鼓手节拍偏差分析</h1>
            <div class="subtitle">详细分析报告</div>
        </header>

        <div class="section">
            <h2>📋 基本信息</h2>
            <div class="info-grid">
                <div class="info-item">
                    <span class="label">音频文件:</span>
                    <span class="value">{os.path.basename(result.audio_file)}</span>
                </div>
                <div class="info-item">
                    <span class="label">分析时间:</span>
                    <span class="value">{result.analyzed_at.strftime('%Y-%m-%d %H:%M:%S')}</span>
                </div>
                <div class="info-item">
                    <span class="label">拍号:</span>
                    <span class="value">{result.time_signature[0]}/{result.time_signature[1]}</span>
                </div>
                <div class="info-item">
                    <span class="label">参考 BPM:</span>
                    <span class="value">{result.reference_bpm:.1f}</span>
                </div>
                <div class="info-item">
                    <span class="label">检测 BPM:</span>
                    <span class="value">{result.detected_bpm:.1f}</span>
                </div>
                <div class="info-item">
                    <span class="label">总小节数:</span>
                    <span class="value">{result.total_measures}</span>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📊 总体统计</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">{result.overall_avg_deviation_ms:.1f}</div>
                    <div class="stat-label">平均偏差 (ms)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{result.overall_deviation_std_ms:.1f}</div>
                    <div class="stat-label">偏差标准差 (ms)</div>
                </div>
                <div class="stat-card lag">
                    <div class="stat-value">{len(result.lag_measures)}</div>
                    <div class="stat-label">拖拍小节</div>
                </div>
                <div class="stat-card lead">
                    <div class="stat-value">{len(result.lead_measures)}</div>
                    <div class="stat-label">抢拍小节</div>
                </div>
                <div class="stat-card missed">
                    <div class="stat-value">{len(result.missed_beat_measures)}</div>
                    <div class="stat-label">漏拍小节</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>💬 综合评价</h2>
            <div class="human-summary">{result.human_summary}</div>
        </div>

        {progress_html}

        {consistency_html}

        <div class="section">
            <h2>📐 BPM 多源证据链</h2>
            <div class="bpm-evidences">
                {bpm_evidence_html}
            </div>
        </div>

        <div class="section">
            <h2>⏱️  事件时序追踪</h2>
            <div class="timeline-legend">
                <span class="legend-item"><span class="dot event-bpm"></span>BPM 变化</span>
                <span class="legend-item"><span class="dot event-miss"></span>弱拍漏检</span>
                <span class="legend-item"><span class="dot event-noise"></span>噪声误判</span>
                <span class="legend-item"><span class="dot event-deviation"></span>显著偏差</span>
                <span class="legend-item"><span class="dot event-measure"></span>小节开始</span>
            </div>
            <div class="timeline">
                {timeline_html}
            </div>
        </div>

        <div class="section">
            <h2>🎵 逐小节分析</h2>
            {measures_html}
        </div>

        <footer>
            <p>鼓手节拍偏差分析工具 | 生成于 {result.analyzed_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
        </footer>
    </div>
</body>
</html>
""".replace(
            "{{css}}", ReportGenerator._get_css()
        )

    @staticmethod
    def _get_css() -> str:
        return """
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background: #f5f7fa;
            color: #333;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        header {
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 12px;
            margin-bottom: 30px;
        }

        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .section {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .section h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
            font-size: 1.5em;
        }

        .section h3 {
            color: #34495e;
            margin-bottom: 15px;
            font-size: 1.2em;
        }

        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .info-item .label {
            color: #7f8c8d;
            font-weight: 500;
        }

        .info-item .value {
            color: #2c3e50;
            font-weight: 600;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }

        .stat-card {
            text-align: center;
            padding: 20px;
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }

        .stat-card.lag {
            background: linear-gradient(135deg, #f39c1215 0%, #e67e2215 100%);
            border-left-color: #f39c12;
        }

        .stat-card.lead {
            background: linear-gradient(135deg, #e74c3c15 0%, #c0392b15 100%);
            border-left-color: #e74c3c;
        }

        .stat-card.missed {
            background: linear-gradient(135deg, #95a5a615 0%, #7f8c8d15 100%);
            border-left-color: #95a5a6;
        }

        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }

        .stat-label {
            color: #7f8c8d;
            font-size: 0.9em;
        }

        .human-summary {
            padding: 20px;
            background: linear-gradient(135deg, #11998e15 0%, #38ef7d15 100%);
            border-radius: 8px;
            border-left: 4px solid #11998e;
            font-size: 1.1em;
            line-height: 1.8;
        }

        .bpm-evidences {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 15px;
        }

        .bpm-evidence {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .bpm-evidence-mini {
            padding: 10px 15px;
            background: #f8f9fa;
            border-radius: 6px;
            margin-bottom: 10px;
            font-size: 0.95em;
        }

        .bpm-evidence-mini .support-reason {
            margin-top: 5px;
            color: #7f8c8d;
            font-size: 0.9em;
            padding-left: 10px;
        }

        .bpm-source {
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 8px;
        }

        .bpm-value, .bpm-confidence, .bpm-range, .bpm-beats {
            margin-bottom: 4px;
            font-size: 0.95em;
        }

        .bpm-reason {
            margin-top: 10px;
            padding: 8px;
            background: #fff9e6;
            border-radius: 4px;
            font-size: 0.9em;
            color: #7d6608;
        }

        .timeline-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            margin-bottom: 20px;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.9em;
        }

        .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
        }

        .dot.event-bpm { background: #9b59b6; }
        .dot.event-miss { background: #e74c3c; }
        .dot.event-noise { background: #f39c12; }
        .dot.event-deviation { background: #e67e22; }
        .dot.event-measure { background: #3498db; }

        .timeline {
            position: relative;
            padding-left: 30px;
        }

        .timeline::before {
            content: '';
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #ddd;
        }

        .timeline-item {
            position: relative;
            margin-bottom: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .timeline-item::before {
            content: '';
            position: absolute;
            left: -24px;
            top: 20px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #3498db;
            border: 2px solid white;
            box-shadow: 0 0 0 2px #3498db;
        }

        .timeline-item.event-bpm::before { background: #9b59b6; box-shadow: 0 0 0 2px #9b59b6; }
        .timeline-item.event-miss::before { background: #e74c3c; box-shadow: 0 0 0 2px #e74c3c; }
        .timeline-item.event-noise::before { background: #f39c12; box-shadow: 0 0 0 2px #f39c12; }
        .timeline-item.event-deviation::before { background: #e67e22; box-shadow: 0 0 0 2px #e67e22; }
        .timeline-item.event-measure::before { background: #3498db; box-shadow: 0 0 0 2px #3498db; }

        .timeline-item.severity-error {
            border-left: 4px solid #e74c3c;
            background: #fdf0ef;
        }

        .timeline-item.severity-warning {
            border-left: 4px solid #f39c12;
            background: #fdf8e6;
        }

        .timeline-time {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }

        .timeline-header {
            display: flex;
            gap: 15px;
            margin-bottom: 8px;
            font-size: 0.9em;
        }

        .event-type {
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.85em;
        }

        .event-measure {
            color: #7f8c8d;
        }

        .event-order {
            color: #bdc3c7;
            font-size: 0.85em;
        }

        .timeline-description {
            color: #2c3e50;
            font-weight: 500;
        }

        .event-details {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
        }

        .detail-item {
            display: inline-block;
            margin-right: 15px;
            font-size: 0.9em;
            color: #7f8c8d;
        }

        .measure-section {
            margin-bottom: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #11998e;
        }

        .measure-section.measure-warning {
            border-left-color: #f39c12;
            background: #fdf8e6;
        }

        .measure-section.measure-error {
            border-left-color: #e74c3c;
            background: #fdf0ef;
        }

        .time-range {
            font-size: 0.7em;
            color: #7f8c8d;
            font-weight: normal;
        }

        .measure-summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding: 10px;
            background: white;
            border-radius: 6px;
        }

        .avg-deviation {
            font-weight: bold;
            color: #667eea;
        }

        .problem {
            color: #e74c3c;
        }

        .deviations-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 6px;
            overflow: hidden;
        }

        .deviations-table th,
        .deviations-table td {
            padding: 10px 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }

        .deviations-table th {
            background: #667eea;
            color: white;
            font-weight: 600;
        }

        .deviations-table tr.deviation-lag {
            background: #fff5e6;
        }

        .deviations-table tr.deviation-lead {
            background: #ffebee;
        }

        .deviations-table tr.deviation-missed {
            background: #f5f5f5;
        }

        .deviations-table tr.deviation-noise {
            background: #fffde7;
        }

        .deviation-value {
            font-family: 'Courier New', monospace;
            font-weight: bold;
        }

        .deviation-lag .deviation-value {
            color: #f39c12;
        }

        .deviation-lead .deviation-value {
            color: #e74c3c;
        }

        .deviation-missed .deviation-value {
            color: #95a5a6;
        }

        .consistency-check, .progress-comparison {
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .consistency-item, .progress-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }

        .consistency-item:last-child, .progress-item:last-child {
            border-bottom: none;
        }

        .consistency-item .label, .progress-item .label {
            color: #7f8c8d;
            font-weight: 500;
        }

        .consistency-item .value, .progress-item .value {
            color: #2c3e50;
            font-weight: 600;
        }

        .consistency-item .value.consistent {
            color: #11998e;
        }

        .consistency-item .value.inconsistent {
            color: #f39c12;
        }

        .consistency-item .value.reason {
            max-width: 70%;
            text-align: right;
            line-height: 1.6;
        }

        .value.positive {
            color: #11998e;
        }

        .value.negative {
            color: #e74c3c;
        }

        .bpm-evidences-section {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
        }

        .bpm-evidences-section h4 {
            margin-bottom: 10px;
            color: #34495e;
        }

        .progress-human {
            margin-top: 15px;
            padding: 15px;
            background: linear-gradient(135deg, #11998e15 0%, #38ef7d15 100%);
            border-radius: 6px;
            border-left: 4px solid #11998e;
            font-size: 1.05em;
        }

        footer {
            text-align: center;
            padding: 20px;
            color: #7f8c8d;
            font-size: 0.9em;
        }

        @media (max-width: 768px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }

            .info-grid {
                grid-template-columns: 1fr;
            }

            .timeline-header {
                flex-wrap: wrap;
            }
        }
        """

    @staticmethod
    def _format_measure_list(measures: List[int]) -> str:
        if not measures:
            return ""
        if len(measures) <= 5:
            return "、".join(str(m) for m in measures)
        else:
            return (
                "、".join(str(m) for m in measures[:5])
                + f" 等 {len(measures)} 个"
            )

    @staticmethod
    def _result_to_dict(result: AnalysisResult) -> Dict[str, Any]:
        def convert(obj):
            if isinstance(obj, Enum):
                return obj.value
            if isinstance(obj, datetime):
                return obj.isoformat()
            if hasattr(obj, "__dict__") and not isinstance(obj, (str, bytes)):
                return {k: convert(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
            if isinstance(obj, list):
                return [convert(item) for item in obj]
            if isinstance(obj, tuple):
                return list(obj)
            return obj

        return convert(result)
