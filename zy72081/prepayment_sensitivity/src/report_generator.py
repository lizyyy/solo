import os
import json
from typing import Dict, List
from datetime import datetime
from .models import RunHistory, SensitivityResult, DataConflict, ParameterVersion


class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _get_risk_color(self, risk_level: str) -> str:
        return {
            "high": "#dc2626",
            "medium": "#f59e0b",
            "low": "#10b981",
        }.get(risk_level, "#6b7280")

    def _get_risk_label(self, risk_level: str) -> str:
        return {
            "high": "高风险",
            "medium": "中风险",
            "low": "低风险",
        }.get(risk_level, "未知")

    def _get_severity_color(self, severity: str) -> str:
        return {
            "critical": "#dc2626",
            "warning": "#f59e0b",
        }.get(severity, "#6b7280")

    def generate(
        self,
        run_history: RunHistory,
        parameter_version: ParameterVersion,
        anomaly_summary: Dict,
        conflict_summary: Dict,
        manual_notes: Dict[str, List[str]],
        history_summary: Dict,
    ) -> str:
        results = run_history.results
        conflicts = run_history.conflicts

        high_risk = sum(1 for r in results if r.risk_level == "high")
        medium_risk = sum(1 for r in results if r.risk_level == "medium")
        low_risk = sum(1 for r in results if r.risk_level == "low")
        needs_review = sum(1 for r in results if r.needs_manual_review)

        chart_data = self._generate_chart_data(results)
        detail_sections = self._generate_detail_sections(
            results, conflicts, manual_notes
        )

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>贷款提前还款敏感性分析报告</title>
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 24px; }}
        .header {{ background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 32px; border-radius: 12px; margin-bottom: 24px; }}
        .header h1 {{ font-size: 28px; margin-bottom: 8px; }}
        .header .meta {{ opacity: 0.9; font-size: 14px; }}
        .section {{ background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        .section-title {{ font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1e293b; display: flex; align-items: center; gap: 8px; }}
        .section-title::before {{ content: ''; width: 4px; height: 20px; background: #3b82f6; border-radius: 2px; }}
        .kpi-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }}
        .kpi-card {{ background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6; }}
        .kpi-card .label {{ font-size: 13px; color: #64748b; margin-bottom: 8px; }}
        .kpi-card .value {{ font-size: 28px; font-weight: 700; color: #1e293b; }}
        .kpi-card.high {{ border-left-color: #dc2626; }}
        .kpi-card.medium {{ border-left-color: #f59e0b; }}
        .kpi-card.low {{ border-left-color: #10b981; }}
        .kpi-card.review {{ border-left-color: #8b5cf6; }}
        .chart-container {{ position: relative; height: 350px; margin: 24px 0; }}
        .bar-chart {{ display: flex; align-items: flex-end; justify-content: space-around; height: 280px; padding: 20px; background: #f8fafc; border-radius: 8px; }}
        .bar {{ width: 50px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: all 0.3s; position: relative; }}
        .bar:hover {{ transform: translateY(-4px); }}
        .bar-fill {{ width: 100%; border-radius: 4px 4px 0 0; transition: all 0.3s; }}
        .bar-label {{ margin-top: 8px; font-size: 11px; color: #64748b; text-align: center; }}
        .bar-value {{ position: absolute; top: -24px; font-size: 12px; font-weight: 600; }}
        .bar-tooltip {{ position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #1e293b; color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 10; }}
        .bar:hover .bar-tooltip {{ opacity: 1; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }}
        th {{ background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; }}
        tr:hover {{ background: #f8fafc; }}
        .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }}
        .badge-high {{ background: #fef2f2; color: #dc2626; }}
        .badge-medium {{ background: #fffbeb; color: #f59e0b; }}
        .badge-low {{ background: #f0fdf4; color: #10b981; }}
        .badge-review {{ background: #faf5ff; color: #8b5cf6; }}
        .badge-critical {{ background: #fef2f2; color: #dc2626; }}
        .badge-warning {{ background: #fffbeb; color: #f59e0b; }}
        .detail-section {{ margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; }}
        .detail-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; cursor: pointer; padding: 12px; background: #f1f5f9; border-radius: 8px; }}
        .detail-header:hover {{ background: #e2e8f0; }}
        .detail-content {{ display: none; padding: 16px; background: #f8fafc; border-radius: 8px; margin-top: 8px; }}
        .detail-content.active {{ display: block; }}
        .calc-step {{ background: white; padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #3b82f6; }}
        .calc-step .step-name {{ font-weight: 600; color: #1e40af; margin-bottom: 4px; }}
        .calc-step .formula {{ font-family: 'Courier New', monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 13px; }}
        .calc-step .result {{ font-weight: 600; color: #059669; }}
        .anomaly-item {{ padding: 12px; background: #fef2f2; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid #dc2626; }}
        .anomaly-item.warning {{ background: #fffbeb; border-left-color: #f59e0b; }}
        .conflict-item {{ padding: 16px; background: #faf5ff; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #8b5cf6; }}
        .conflict-evidence {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0; }}
        .evidence-box {{ background: white; padding: 12px; border-radius: 6px; }}
        .evidence-label {{ font-size: 12px; color: #64748b; margin-bottom: 4px; }}
        .evidence-value {{ font-weight: 600; }}
        .suggestion {{ background: #eff6ff; padding: 12px; border-radius: 6px; border-left: 3px solid #3b82f6; }}
        .note-item {{ padding: 8px 12px; background: #fef3c7; border-radius: 6px; margin-bottom: 6px; font-size: 13px; border-left: 3px solid #f59e0b; }}
        .params-table {{ font-size: 13px; }}
        .params-table td {{ padding: 8px 12px; }}
        .param-modified {{ background: #fef3c7; }}
        .expand-icon {{ transition: transform 0.3s; }}
        .expand-icon.active {{ transform: rotate(90deg); }}
        .nav-links {{ display: flex; gap: 16px; flex-wrap: wrap; margin-top: 16px; }}
        .nav-link {{ color: #3b82f6; text-decoration: none; font-size: 14px; cursor: pointer; }}
        .nav-link:hover {{ text-decoration: underline; }}
        .history-note {{ background: #f0fdf4; padding: 12px; border-radius: 6px; margin-top: 12px; border-left: 3px solid #10b981; font-size: 13px; }}
        .sample-type {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; }}
        .type-smooth {{ background: #d1fae5; color: #065f46; }}
        .type-review {{ background: #fef3c7; color: #92400e; }}
        .type-old {{ background: #e0e7ff; color: #3730a3; }}
        .scroll-top {{ position: fixed; bottom: 24px; right: 24px; width: 48px; height: 48px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4); }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏦 贷款提前还款敏感性分析报告</h1>
            <div class="meta">
                运行ID: {run_history.run_id} | 运行时间: {run_history.timestamp} | 参数版本: {run_history.parameter_version_id}
            </div>
            <div class="nav-links">
                <a class="nav-link" href="#summary">📊 概览</a>
                <a class="nav-link" href="#distribution">📈 风险分布</a>
                <a class="nav-link" href="#anomalies">⚠️ 异常检测</a>
                <a class="nav-link" href="#conflicts">⚔️ 数据冲突</a>
                <a class="nav-link" href="#parameters">⚙️ 参数版本</a>
                <a class="nav-link" href="#details">📋 明细数据</a>
                <a class="nav-link" href="#history">📜 历史记录</a>
            </div>
        </div>

        <div id="summary" class="kpi-grid">
            <div class="kpi-card">
                <div class="label">总样本数</div>
                <div class="value">{run_history.sample_count}</div>
            </div>
            <div class="kpi-card high">
                <div class="label">高风险</div>
                <div class="value">{high_risk}</div>
            </div>
            <div class="kpi-card medium">
                <div class="label">中风险</div>
                <div class="value">{medium_risk}</div>
            </div>
            <div class="kpi-card low">
                <div class="label">低风险</div>
                <div class="value">{low_risk}</div>
            </div>
            <div class="kpi-card review">
                <div class="label">需人工复核</div>
                <div class="value">{needs_review}</div>
            </div>
            <div class="kpi-card">
                <div class="label">异常检测数</div>
                <div class="value">{anomaly_summary.get('total_anomalies', 0)}</div>
            </div>
            <div class="kpi-card">
                <div class="label">数据冲突数</div>
                <div class="value">{conflict_summary.get('total_conflicts', 0)}</div>
            </div>
            <div class="kpi-card">
                <div class="label">历史运行次数</div>
                <div class="value">{history_summary.get('total_runs', 1)}</div>
            </div>
        </div>

        <div id="distribution" class="section">
            <h2 class="section-title">敏感性得分分布图（点击柱子跳转到对应明细）</h2>
            <div class="chart-container">
                <div class="bar-chart">
                    {chart_data}
                </div>
            </div>
            <p style="font-size: 13px; color: #64748b; text-align: center;">
                💡 提示：将鼠标悬停在柱子上可查看详情，点击跳转到对应样本的完整计算明细
            </p>
        </div>

        <div id="anomalies" class="section">
            <h2 class="section-title">异常检测结果</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
                <div><strong>异常样本率:</strong> {anomaly_summary.get('anomaly_rate', 0)}%</div>
                <div><strong>严重异常:</strong> <span style="color: #dc2626;">{anomaly_summary.get('critical_anomalies', 0)}</span> 个</div>
                <div><strong>警告异常:</strong> <span style="color: #f59e0b;">{anomaly_summary.get('warning_anomalies', 0)}</span> 个</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>样本ID</th>
                        <th>贷款ID</th>
                        <th>异常字段</th>
                        <th>期望值范围</th>
                        <th>实际值</th>
                        <th>严重程度</th>
                        <th>说明</th>
                    </tr>
                </thead>
                <tbody>
                    {self._generate_anomaly_table(results)}
                </tbody>
            </table>
        </div>

        <div id="conflicts" class="section">
            <h2 class="section-title">数据冲突检测（复盘图表 vs 导入数据）</h2>
            <div style="margin-bottom: 16px;">
                <strong>待处理冲突:</strong> {conflict_summary.get('unresolved_conflicts', 0)} 项
            </div>
            {self._generate_conflict_sections(conflicts)}
        </div>

        <div id="parameters" class="section">
            <h2 class="section-title">参数版本详情 (版本号: {parameter_version.version_id})</h2>
            <p style="margin-bottom: 16px; color: #64748b;">
                创建时间: {parameter_version.created_at} | 创建人: {parameter_version.created_by} | 备注: {parameter_version.note}
            </p>
            <table class="params-table">
                <thead>
                    <tr>
                        <th>参数名称</th>
                        <th>参数值</th>
                        <th>权重</th>
                        <th>说明</th>
                        <th>来源</th>
                        <th>最后修改</th>
                        <th>修改人</th>
                    </tr>
                </thead>
                <tbody>
                    {self._generate_parameter_table(parameter_version)}
                </tbody>
            </table>
            <div class="history-note">
                <strong>📌 版本追溯：</strong>所有参数修改都会创建新版本，历史版本永不覆盖。
                如需查看参数变更历史，请联系系统管理员或查看 <code>parameter_versions.json</code> 文件。
            </div>
        </div>

        <div id="details" class="section">
            <h2 class="section-title">样本计算明细</h2>
            <p style="color: #64748b; margin-bottom: 16px;">
                👇 点击任意样本展开查看完整计算过程、异常标记和人工备注
            </p>
            {detail_sections}
        </div>

        <div id="history" class="section">
            <h2 class="section-title">历史处理记录</h2>
            <div class="history-note">
                <strong>📜 处理追踪：</strong>本系统保留完整的处理历史，包括：
                <ul style="margin-top: 8px; padding-left: 20px;">
                    <li>所有参数版本及其变更记录（永不覆盖）</li>
                    <li>每次运行的完整计算结果</li>
                    <li>所有人工备注和复核意见</li>
                    <li>待处理事项列表</li>
                </ul>
            </div>
            <table style="margin-top: 16px;">
                <thead>
                    <tr>
                        <th>统计项</th>
                        <th>数值</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>累计运行次数</td><td>{history_summary.get('total_runs', 1)}</td></tr>
                    <tr><td>累计处理样本</td><td>{history_summary.get('total_samples_processed', run_history.sample_count)}</td></tr>
                    <tr><td>累计检测异常</td><td>{history_summary.get('total_anomalies_detected', anomaly_summary.get('total_anomalies', 0))}</td></tr>
                    <tr><td>累计检测冲突</td><td>{history_summary.get('total_conflicts_detected', conflict_summary.get('total_conflicts', 0))}</td></tr>
                    <tr><td>待人工复核</td><td><span class="badge badge-review">{history_summary.get('pending_reviews', needs_review)}</span></td></tr>
                    <tr><td>已完成复核</td><td>{history_summary.get('completed_reviews', 0)}</td></tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2 class="section-title">使用说明</h2>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
                <p style="margin-bottom: 8px;"><strong>🔄 重复运行：</strong>再次运行时，系统会自动保留之前的人工备注和复核状态，不会被默认值覆盖。</p>
                <p style="margin-bottom: 8px;"><strong>🔍 计算追溯：</strong>每笔样本的计算过程完整记录，包括使用的参数、公式、每一步结果，可直接复核。</p>
                <p style="margin-bottom: 8px;"><strong>⚔️ 冲突处理：</strong>当复盘图表与导入数据冲突时，系统仅展示证据和建议，不替您做决定。</p>
                <p><strong>📝 交接友好：</strong>所有人工备注完整保留，后续接手的同事可以看到每笔样本之前是如何判断的。</p>
            </div>
        </div>
    </div>

    <div class="scroll-top" onclick="scrollToTop()" title="返回顶部">↑</div>

    <script>
        function toggleDetail(id) {{
            const content = document.getElementById('content-' + id);
            const icon = document.getElementById('icon-' + id);
            content.classList.toggle('active');
            icon.classList.toggle('active');
        }}

        function scrollToSample(sampleId) {{
            const element = document.getElementById('detail-' + sampleId);
            if (element) {{
                element.scrollIntoView({{ behavior: 'smooth', block: 'start' }});
                const content = document.getElementById('content-' + sampleId);
                const icon = document.getElementById('icon-' + sampleId);
                content.classList.add('active');
                icon.classList.add('active');
            }}
        }}

        function scrollToTop() {{
            window.scrollTo({{ top: 0, behavior: 'smooth' }});
        }}

        document.addEventListener('DOMContentLoaded', function() {{
            const hash = window.location.hash.substring(1);
            if (hash && hash.startsWith('sample-')) {{
                const sampleId = hash.replace('sample-', '');
                setTimeout(() => scrollToSample(sampleId), 100);
            }}
        }});
    </script>
</body>
</html>"""

        filename = f"prepayment_sensitivity_report_{run_history.run_id}.html"
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)

        return filepath

    def _generate_chart_data(self, results: List[SensitivityResult]) -> str:
        bars = []
        for result in results:
            sample_id_short = result.sample_id[-8:]
            score = result.sensitivity_score
            height = int(score * 250)
            color = self._get_risk_color(result.risk_level)
            risk_label = self._get_risk_label(result.risk_level)

            sample_type = ""
            if result.sample_id.endswith("clean_001") or "clean" in result.sample_id:
                sample_type = '<span class="sample-type type-smooth">顺利</span>'
            elif result.needs_manual_review:
                sample_type = '<span class="sample-type type-review">待复核</span>'
            elif "old" in result.sample_id or "backfill" in result.sample_id:
                sample_type = '<span class="sample-type type-old">旧口径</span>'

            anomaly_count = len(result.anomalies)
            anomaly_info = f", {anomaly_count}个异常" if anomaly_count > 0 else ""

            tooltip = (
                f"贷款ID: {sample_id_short}\\n"
                f"敏感性得分: {score:.4f}\\n"
                f"风险等级: {risk_label}{anomaly_info}\\n"
                f"点击查看详细计算过程"
            )

            bars.append(f"""
                <div class="bar" onclick="scrollToSample('{result.sample_id}')">
                    <span class="bar-value" style="color: {color};">{score:.3f}</span>
                    <div class="bar-tooltip">{tooltip}</div>
                    <div class="bar-fill" style="height: {height}px; background: {color};"></div>
                    <div class="bar-label">{sample_id_short}{sample_type}</div>
                </div>
            """)

        return "\n".join(bars)

    def _generate_anomaly_table(self, results: List[SensitivityResult]) -> str:
        rows = []
        for result in results:
            for anomaly in result.anomalies:
                severity_badge = (
                    f'<span class="badge badge-{anomaly.severity}">'
                    f'{"严重" if anomaly.severity == "critical" else "警告"}'
                    f'</span>'
                )
                rows.append(f"""
                    <tr onclick="scrollToSample('{result.sample_id}')" style="cursor: pointer;">
                        <td>{result.sample_id[-12:]}</td>
                        <td>{anomaly.sample_id[:12] if len(anomaly.sample_id) > 12 else anomaly.sample_id}</td>
                        <td><strong>{anomaly.field_name}</strong></td>
                        <td>{anomaly.expected_range}</td>
                        <td style="color: #dc2626; font-weight: 600;">{anomaly.actual_value}</td>
                        <td>{severity_badge}</td>
                        <td>{anomaly.description}</td>
                    </tr>
                """)
        return "\n".join(rows) if rows else '<tr><td colspan="7" style="text-align: center; color: #64748b;">暂无异常数据</td></tr>'

    def _generate_conflict_sections(self, conflicts: List[DataConflict]) -> str:
        if not conflicts:
            return '<div style="color: #64748b; text-align: center; padding: 24px;">暂无数据冲突</div>'

        sections = []
        for conflict in conflicts:
            field_label = {
                "sensitivity_score": "敏感性得分",
                "risk_level": "风险等级",
                "principal": "贷款本金",
            }.get(conflict.field_name, conflict.field_name)

            status_badge = (
                '<span class="badge badge-low">已解决</span>'
                if conflict.resolved
                else '<span class="badge badge-review">待处理</span>'
            )

            sample_value_str = (
                f"{conflict.sample_value:.4f}"
                if isinstance(conflict.sample_value, float)
                else str(conflict.sample_value)
            )
            chart_value_str = (
                f"{conflict.chart_value:.4f}"
                if isinstance(conflict.chart_value, float)
                else str(conflict.chart_value)
            )

            sections.append(f"""
                <div class="conflict-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <strong>字段: {field_label}</strong>
                        {status_badge}
                    </div>
                    <div class="conflict-evidence">
                        <div class="evidence-box">
                            <div class="evidence-label">📊 系统计算结果</div>
                            <div class="evidence-value" style="color: #1e40af;">{sample_value_str}</div>
                            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">{conflict.sample_source}</div>
                        </div>
                        <div class="evidence-box">
                            <div class="evidence-label">📈 复盘图表记录</div>
                            <div class="evidence-value" style="color: #7c2d12;">{chart_value_str}</div>
                            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">{conflict.chart_source}</div>
                        </div>
                    </div>
                    {f'<div style="margin-bottom: 12px;"><strong>差异:</strong> <span style="color: #dc2626;">{conflict.difference:.2f}%</span></div>' if conflict.difference > 0 else ''}
                    <div class="suggestion">
                        <strong>💡 建议动作：</strong>{conflict.suggested_action}
                    </div>
                    {f'<div class="history-note" style="margin-top: 12px;"><strong>✅ 处理结果：</strong>{conflict.resolution_note}</div>' if conflict.resolution_note else ''}
                </div>
            """)

        return "\n".join(sections)

    def _generate_parameter_table(self, parameter_version: ParameterVersion) -> str:
        rows = []
        for name, param in parameter_version.parameters.items():
            modified_class = "param-modified" if param.source == "manual" else ""
            source_label = "人工调整" if param.source == "manual" else "系统默认"

            rows.append(f"""
                <tr class="{modified_class}">
                    <td><strong>{name}</strong></td>
                    <td>{param.value:.4f}</td>
                    <td>{param.weight:.4f}</td>
                    <td>{param.description}</td>
                    <td><span class="badge {'badge-warning' if param.source == 'manual' else 'badge-low'}">{source_label}</span></td>
                    <td>{param.last_modified}</td>
                    <td>{param.modified_by}</td>
                </tr>
            """)
        return "\n".join(rows)

    def _generate_detail_sections(
        self,
        results: List[SensitivityResult],
        conflicts: List[DataConflict],
        manual_notes: Dict[str, List[str]],
    ) -> str:
        sections = []

        sample_conflicts = {}
        for c in conflicts:
            if c.loan_id not in sample_conflicts:
                sample_conflicts[c.loan_id] = []
            sample_conflicts[c.loan_id].append(c)

        for result in results:
            sample_id = result.sample_id
            short_id = sample_id[-12:]
            risk_color = self._get_risk_color(result.risk_level)
            risk_label = self._get_risk_label(result.risk_level)
            risk_badge = f'<span class="badge badge-{result.risk_level}">{risk_label}</span>'

            review_badge = ""
            if result.needs_manual_review:
                review_badge = '<span class="badge badge-review">需人工复核</span>'

            sample_type = ""
            if "clean" in sample_id:
                sample_type = '<span class="sample-type type-smooth">顺利记录</span>'
            elif result.needs_manual_review:
                sample_type = '<span class="sample-type type-review">需人工确认</span>'
            elif "old" in sample_id or "backfill" in sample_id:
                sample_type = '<span class="sample-type type-old">旧口径补录</span>'

            anomalies_html = ""
            if result.anomalies:
                anomaly_items = []
                for a in result.anomalies:
                    severity_class = "warning" if a.severity == "warning" else ""
                    anomaly_items.append(f"""
                        <div class="anomaly-item {severity_class}">
                            <strong>{a.field_name}</strong>: 期望值范围 {a.expected_range}，实际值 <span style="color: #dc2626; font-weight: 600;">{a.actual_value}</span>
                            <br><span style="font-size: 12px; color: #64748b;">{a.description}</span>
                        </div>
                    """)
                anomalies_html = f"""
                    <div style="margin-top: 16px;">
                        <h4 style="color: #dc2626; margin-bottom: 12px;">⚠️ 异常标记 ({len(result.anomalies)}项)</h4>
                        {''.join(anomaly_items)}
                    </div>
                """

            calc_steps_html = ""
            if result.calculation_steps:
                step_items = []
                for step in result.calculation_steps:
                    param_str = (
                        ", ".join(f"{k}={v}" for k, v in step.parameter_used.items())
                        if step.parameter_used else "无"
                    )
                    input_str = ", ".join(f"{k}={v}" for k, v in step.input_values.items())
                    step_items.append(f"""
                        <div class="calc-step">
                            <div class="step-name">{step.step_name}</div>
                            <div style="font-size: 12px; color: #64748b; margin: 4px 0;">输入: {input_str}</div>
                            <div style="font-size: 12px; color: #64748b; margin: 4px 0;">参数: {param_str}</div>
                            <div class="formula">公式: {step.formula}</div>
                            <div style="margin-top: 4px;">结果: <span class="result">{step.result:.6f}</span></div>
                        </div>
                    """)
                calc_steps_html = f"""
                    <div style="margin-top: 16px;">
                        <h4 style="color: #1e40af; margin-bottom: 12px;">🔢 完整计算过程 ({len(result.calculation_steps)}步)</h4>
                        {''.join(step_items)}
                    </div>
                """

            conflicts_html = ""
            loan_id = ""
            loan_id_map = {}
            for i, r in enumerate(results):
                import re
                match = re.search(r'LOAN-\d+', str(r.sample_id))
                if match:
                    loan_id_map[r.sample_id] = match.group()
                else:
                    loan_id_map[r.sample_id] = f"LOAN-{str(i+1).zfill(3)}"
            loan_id = loan_id_map.get(sample_id, "")

            if loan_id and loan_id in sample_conflicts:
                conflict_items = []
                for c in sample_conflicts[loan_id]:
                    field_label = {
                        "sensitivity_score": "敏感性得分",
                        "risk_level": "风险等级",
                        "principal": "贷款本金",
                    }.get(c.field_name, c.field_name)
                    conflict_items.append(f"""
                        <div class="conflict-item" style="padding: 12px; margin-bottom: 8px;">
                            <strong>{field_label}</strong> 冲突
                            <div style="font-size: 13px; margin-top: 8px;">
                                系统: {c.sample_value} vs 复盘: {c.chart_value}
                            </div>
                            <div class="suggestion" style="margin-top: 8px; font-size: 12px;">
                                {c.suggested_action}
                            </div>
                        </div>
                    """)
                conflicts_html = f"""
                    <div style="margin-top: 16px;">
                        <h4 style="color: #8b5cf6; margin-bottom: 12px;">⚔️ 数据冲突 ({len(sample_conflicts[loan_id])}项)</h4>
                        {''.join(conflict_items)}
                    </div>
                """

            notes_html = ""
            if loan_id and loan_id in manual_notes:
                note_items = []
                for note in manual_notes[loan_id]:
                    note_items.append(f'<div class="note-item">📝 {note}</div>')
                notes_html = f"""
                    <div style="margin-top: 16px;">
                        <h4 style="color: #92400e; margin-bottom: 12px;">📝 历史人工备注 ({len(manual_notes[loan_id])}条)</h4>
                        {''.join(note_items)}
                    </div>
                """

            review_note_html = ""
            if result.review_note:
                review_note_html = f"""
                    <div class="history-note" style="margin-top: 16px;">
                        <strong>✅ 上次复核意见：</strong>{result.review_note}
                    </div>
                """

            sections.append(f"""
                <div id="detail-{sample_id}" class="detail-section">
                    <div class="detail-header" onclick="toggleDetail('{sample_id}')">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span id="icon-{sample_id}" class="expand-icon">▶</span>
                            <strong>样本 {short_id}</strong>
                            {sample_type}
                            {risk_badge}
                            {review_badge}
                        </div>
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <span>得分: <strong style="color: {risk_color};">{result.sensitivity_score:.4f}</strong></span>
                            <span style="font-size: 12px; color: #64748b;">{result.calculated_at}</span>
                        </div>
                    </div>
                    <div id="content-{sample_id}" class="detail-content">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
                            <div><strong>贷款ID:</strong> {loan_id}</div>
                            <div><strong>参数版本:</strong> {result.parameter_version_id}</div>
                            <div><strong>数据来源:</strong> {result.sample_id}</div>
                            <div><strong>计算时间:</strong> {result.calculated_at}</div>
                        </div>

                        <h4 style="color: #374151; margin: 16px 0 8px 0;">📊 成分贡献度</h4>
                        {self._generate_contribution_chart(result)}

                        {calc_steps_html}
                        {anomalies_html}
                        {conflicts_html}
                        {notes_html}
                        {review_note_html}

                        <div class="history-note" style="margin-top: 16px;">
                            <strong>🔗 追溯链接：</strong>
                            可分享此链接直接定位到该样本：
                            <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 12px;">
                                #sample-{sample_id}
                            </code>
                        </div>
                    </div>
                </div>
            """)

        return "\n".join(sections)

    def _generate_contribution_chart(self, result: SensitivityResult) -> str:
        contributions = {}
        for step in result.calculation_steps:
            if step.step_name.endswith("_weighted"):
                component = step.step_name.replace("_weighted", "")
                contributions[component] = step.result

        total = sum(contributions.values())
        if total == 0:
            return '<div style="color: #64748b;">暂无贡献度数据</div>'

        labels = {
            "rate": "利率",
            "term": "期限",
            "fico": "FICO",
            "dti": "DTI",
            "ltv": "LTV",
            "age": "年龄",
            "history": "还款历史",
        }

        bars = []
        for comp, value in contributions.items():
            pct = value / total * 100
            bars.append(f"""
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px;">
                        <span>{labels.get(comp, comp)}</span>
                        <span>{pct:.1f}%</span>
                    </div>
                    <div style="height: 20px; background: #e2e8f0; border-radius: 10px; overflow: hidden;">
                        <div style="height: 100%; width: {pct}%; background: linear-gradient(90deg, #3b82f6, #1d4ed8); border-radius: 10px;"></div>
                    </div>
                </div>
            """)

        return f'<div style="max-width: 400px;">{"".join(bars)}</div>'
