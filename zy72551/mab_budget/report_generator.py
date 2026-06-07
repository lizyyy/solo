"""报告生成器 - 生成异常样本页和汇总报告"""
import os
from typing import List, Optional
from datetime import datetime
from .models import AnomalySample, AuditRecord, RecallCandidate, ParamsConfig
from .store import DataStore


SEVERITY_STYLES = {
    "high": {"color": "#dc2626", "bg": "#fef2f2", "label": "高风险"},
    "medium": {"color": "#d97706", "bg": "#fffbeb", "label": "中风险"},
    "low": {"color": "#059669", "bg": "#ecfdf5", "label": "低风险"}
}

ANOMALY_TYPE_LABELS = {
    "time_window_cross": "时间窗穿越（效果虚高）",
    "ctr_outlier": "CTR异常偏高",
    "budget_overrun": "预算超支预警"
}


class ReportGenerator:
    def __init__(self, output_dir: str = "./output", store: Optional[DataStore] = None):
        self.output_dir = output_dir
        self.store = store
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, "anomalies"), exist_ok=True)

    def generate_anomaly_page(self, anomaly: AnomalySample) -> str:
        """生成单个异常样本的详情页（HTML）"""
        style = SEVERITY_STYLES.get(anomaly.severity, SEVERITY_STYLES["medium"])
        type_label = ANOMALY_TYPE_LABELS.get(anomaly.anomaly_type, anomaly.anomaly_type)

        candidate_html = ""
        if anomaly.candidate:
            c = anomaly.candidate
            candidate_html = f"""
            <div class="candidate-card">
                <h3>关联召回候选</h3>
                <table class="info-table">
                    <tr><th>候选ID</th><td>{c.candidate_id}</td></tr>
                    <tr><th>策略名称</th><td>{c.strategy_name}</td></tr>
                    <tr><th>臂ID</th><td>{c.arm_id}</td></tr>
                    <tr><th>曝光量</th><td>{c.impression:,}</td></tr>
                    <tr><th>点击量</th><td>{c.click:,}</td></tr>
                    <tr><th>CTR</th><td class="highlight">{c.ctr:.4f}</td></tr>
                    <tr><th>消耗</th><td>¥{c.cost:,.2f}</td></tr>
                    <tr><th>预算利用率</th><td>{c.budget_utilization:.2%}</td></tr>
                    <tr><th>时间窗口</th><td>{c.time_window_start}<br>~ {c.time_window_end}</td></tr>
                </table>
            </div>
            """

        missing_html = ""
        if anomaly.missing_materials:
            items = "".join(f"<li>{m}</li>" for m in anomaly.missing_materials)
            missing_html = f"""
            <div class="missing-section">
                <h3>🔍 还缺什么材料</h3>
                <ul class="missing-list">{items}</ul>
            </div>
            """

        correction_html = ""
        if anomaly.correction_history:
            items = []
            for idx, corr in enumerate(reversed(anomaly.correction_history)):
                items.append(
                    f"<li><span class='corr-time'>{corr.get('timestamp','')}</span> "
                    f"<span class='corr-operator'>{corr.get('operator','')}</span>: "
                    f"{corr.get('notes','')}</li>"
                )
            correction_html = f"""
            <div class="correction-section">
                <h3>📝 人工修正记录</h3>
                <ol class="correction-list">{"".join(items)}</ol>
            </div>
            """

        verified_badge = ""
        if anomaly.is_verified:
            verified_badge = f'<span class="verified-badge">✅ 已复核 by {anomaly.verified_by} at {anomaly.verified_at}</span>'

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>异常样本 - {anomaly.sample_id}</title>
    <style>
        body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 900px; margin: 0 auto; padding: 30px; background: #f8fafc; color: #1e293b; }}
        .header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }}
        .severity-badge {{ padding: 6px 14px; border-radius: 20px; font-weight: 600; color: {style['color']}; background: {style['bg']}; }}
        .verified-badge {{ padding: 6px 14px; border-radius: 20px; font-weight: 500; color: #059669; background: #ecfdf5; font-size: 14px; }}
        h1 {{ font-size: 24px; margin: 0; }}
        h2 {{ font-size: 18px; color: #334155; border-left: 4px solid #3b82f6; padding-left: 12px; margin-top: 28px; }}
        h3 {{ font-size: 16px; color: #475569; margin-top: 20px; }}
        .card {{ background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        .info-table {{ width: 100%; border-collapse: collapse; }}
        .info-table th {{ text-align: left; padding: 8px 12px; background: #f1f5f9; font-weight: 500; width: 140px; }}
        .info-table td {{ padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }}
        .highlight {{ font-weight: 600; color: #dc2626; }}
        .reason-text {{ white-space: pre-line; line-height: 1.8; background: #fffbeb; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; }}
        .missing-list, .correction-list {{ line-height: 2; color: #475569; }}
        .next-step {{ background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 16px; }}
        .next-step .owner {{ font-weight: 600; color: #1d4ed8; }}
        .meta {{ color: #94a3b8; font-size: 13px; margin-top: 8px; }}
        .type-label {{ display: inline-block; padding: 4px 10px; background: #f1f5f9; border-radius: 6px; font-size: 14px; margin-right: 10px; }}
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>异常样本详情</h1>
            <div class="meta">样本ID: {anomaly.sample_id} | 检测时间: {anomaly.detected_at}</div>
        </div>
        <div>
            <span class="type-label">{type_label}</span>
            <span class="severity-badge">{style['label']}</span>
            {verified_badge}
        </div>
    </div>

    <div class="card">
        <h2>❓ 为什么这条被留下</h2>
        <div class="reason-text">{anomaly.reason_description}</div>
    </div>

    {candidate_html}

    {missing_html}

    <div class="card next-step">
        <h3>🎯 下一步该找谁</h3>
        <p><span class="owner">负责人：{anomaly.next_step_owner}</span></p>
        <p>行动：{anomaly.next_step_action}</p>
        {anomaly.correction_notes and f'<p style="margin-top:12px;"><strong>修正备注：</strong>{anomaly.correction_notes}</p>' or ''}
    </div>

    {correction_html}

    <div class="meta" style="text-align:center; margin-top:40px;">
        多臂老虎机预算分流 · 异常样本页 · 生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    </div>
</body>
</html>"""

        path = os.path.join(self.output_dir, "anomalies", f"{anomaly.sample_id}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        return path

    def generate_summary_report(self, anomalies: List[AnomalySample],
                                candidates: List[RecallCandidate],
                                params: Optional[ParamsConfig],
                                audit_records: List[AuditRecord]) -> str:
        """生成汇总报告页"""
        stats = self._calc_stats(anomalies, candidates)

        anomaly_rows = ""
        for a in sorted(anomalies, key=lambda x: x.detected_at, reverse=True):
            style = SEVERITY_STYLES.get(a.severity, SEVERITY_STYLES["medium"])
            type_label = ANOMALY_TYPE_LABELS.get(a.anomaly_type, a.anomaly_type)
            verified = "✅" if a.is_verified else "⏳"
            cand_name = a.candidate.strategy_name if a.candidate else "-"
            anomaly_rows += f"""
            <tr>
                <td><a href="anomalies/{a.sample_id}.html" target="_blank">{a.sample_id}</a></td>
                <td>{type_label}</td>
                <td><span style="color:{style['color']};font-weight:500;">{style['label']}</span></td>
                <td>{cand_name}</td>
                <td>{verified}</td>
                <td>{a.next_step_owner}</td>
                <td>{a.detected_at}</td>
            </tr>"""

        audit_rows = ""
        for r in reversed(audit_records[-10:]):
            audit_rows += f"""
            <tr>
                <td>{r.timestamp}</td>
                <td><strong>{r.operator}</strong></td>
                <td>{r.action}</td>
                <td>{r.target_type}</td>
                <td>{r.reason}</td>
            </tr>"""

        params_html = ""
        if params:
            params_html = f"""
            <div class="card">
                <h3>📋 当前参数配置 (v{params.version})</h3>
                <table class="info-table">
                    <tr><th>时间窗口</th><td>{params.time_window_size_hours} 小时</td></tr>
                    <tr><th>最低曝光阈值</th><td>{params.min_impression_threshold:,}</td></tr>
                    <tr><th>CTR显著阈值</th><td>{params.ctr_significance_threshold:.4f}</td></tr>
                    <tr><th>负责人</th><td>{params.owner}</td></tr>
                </table>
            </div>"""

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>多臂老虎机预算分流 - 异常复核报告</title>
    <style>
        body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 1200px; margin: 0 auto; padding: 30px; background: #f8fafc; color: #1e293b; }}
        h1 {{ font-size: 28px; margin-bottom: 8px; }}
        h2 {{ font-size: 20px; color: #334155; border-left: 4px solid #3b82f6; padding-left: 12px; margin-top: 32px; }}
        h3 {{ font-size: 16px; color: #475569; }}
        .subtitle {{ color: #64748b; margin-bottom: 24px; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }}
        .stat-card {{ background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }}
        .stat-number {{ font-size: 32px; font-weight: 700; color: #1e293b; }}
        .stat-label {{ color: #64748b; margin-top: 4px; font-size: 14px; }}
        .stat-high {{ color: #dc2626; }}
        .card {{ background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
        th {{ text-align: left; padding: 12px; background: #f1f5f9; font-weight: 500; border-bottom: 2px solid #e2e8f0; }}
        td {{ padding: 12px; border-bottom: 1px solid #e2e8f0; }}
        tr:hover {{ background: #f8fafc; }}
        a {{ color: #3b82f6; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .info-table {{ width: 100%; border-collapse: collapse; }}
        .info-table th {{ text-align: left; padding: 8px 12px; background: #f1f5f9; font-weight: 500; width: 160px; }}
        .info-table td {{ padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }}
        .warning-box {{ background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 16px 0; }}
    </style>
</head>
<body>
    <h1>🎰 多臂老虎机预算分流</h1>
    <p class="subtitle">异常复核报告 · 生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

    <div class="warning-box">
        ⚠️ <strong>注意：</strong>标注为「时间窗穿越（效果虚高）」的样本结论不可直接发布，需实验平台负责人复核确认后再使用。
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number">{stats['total_candidates']}</div>
            <div class="stat-label">召回候选总数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number stat-high">{stats['total_anomalies']}</div>
            <div class="stat-label">异常样本数</div>
        </div>
        <div class="stat-card">
            <div class="stat-number stat-high">{stats['time_cross_count']}</div>
            <div class="stat-label">时间窗穿越</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">{stats['verified_count']}</div>
            <div class="stat-label">已复核</div>
        </div>
    </div>

    {params_html}

    <div class="card">
        <h2>🔍 异常样本列表</h2>
        <table>
            <tr>
                <th>样本ID</th>
                <th>异常类型</th>
                <th>严重程度</th>
                <th>关联策略</th>
                <th>复核状态</th>
                <th>下一步负责人</th>
                <th>检测时间</th>
            </tr>
            {anomaly_rows}
        </table>
    </div>

    <div class="card">
        <h2>📝 最近复核记录</h2>
        <table>
            <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>动作</th>
                <th>目标类型</th>
                <th>原因</th>
            </tr>
            {audit_rows}
        </table>
    </div>
</body>
</html>"""

        path = os.path.join(self.output_dir, "index.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        return path

    def _calc_stats(self, anomalies, candidates):
        return {
            "total_candidates": len(candidates),
            "total_anomalies": len(anomalies),
            "time_cross_count": sum(1 for a in anomalies if a.anomaly_type == "time_window_cross"),
            "verified_count": sum(1 for a in anomalies if a.is_verified)
        }

    def regenerate_all(self):
        """重新生成所有报告页"""
        if not self.store:
            return
        anomalies = self.store.load_anomalies()
        candidates = self.store.load_candidates()
        params = self.store.load_params()
        audit = self.store.load_audit_records()

        for a in anomalies:
            self.generate_anomaly_page(a)
        self.generate_summary_report(anomalies, candidates, params, audit)
