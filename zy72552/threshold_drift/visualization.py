import plotly.graph_objects as go
import plotly.express as px
from typing import List, Dict
from .models import DriftRecord, BucketDiff, BucketConfig


class Visualizer:
    def __init__(self, bucket_config: BucketConfig):
        self.bucket_config = bucket_config

    def create_bucket_scatter_plot(self, records: List[DriftRecord]) -> go.Figure:
        x = []
        y = []
        colors = []
        hover_texts = []
        custom_data = []

        for r in records:
            x.append(r.offline_bucket)
            y.append(r.online_bucket)
            if r.bucket_diff == BucketDiff.SAME:
                colors.append("green")
            elif r.bucket_diff == BucketDiff.ONE_BUCKET:
                colors.append("orange")
            else:
                colors.append("red")
            hover_texts.append(
                f"样本: {r.sample_id}<br>"
                f"离线分桶: {r.offline_bucket}<br>"
                f"线上分桶: {r.online_bucket}<br>"
                f"差异: {r.bucket_diff.value}<br>"
                f"状态: {r.status.value}<br>"
                f"点击查看详情→"
            )
            custom_data.append(r.record_id)

        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=x,
                y=y,
                mode="markers",
                marker=dict(color=colors, size=12, line=dict(width=1)),
                text=hover_texts,
                customdata=custom_data,
                hoverinfo="text",
                name="样本点",
            )
        )

        max_bucket = len(self.bucket_config.boundaries)
        fig.add_trace(
            go.Scatter(
                x=[-0.5, max_bucket + 0.5],
                y=[-0.5, max_bucket + 0.5],
                mode="lines",
                line=dict(color="gray", dash="dash"),
                name="y=x (无偏差)",
            )
        )

        fig.update_layout(
            title="离线vs线上分桶分布图（橙色=差1桶，红色=差多桶）",
            xaxis_title="离线分桶",
            yaxis_title="线上分桶",
            xaxis=dict(tickmode="linear", tick0=0, dtick=1),
            yaxis=dict(tickmode="linear", tick0=0, dtick=1),
            showlegend=True,
            clickmode="event+select",
        )

        return fig

    def create_3d_score_plot(self, records: List[DriftRecord]) -> go.Figure:
        x = []
        y = []
        z = []
        colors = []
        hover_texts = []
        custom_data = []

        for r in records:
            x.append(r.offline_score)
            y.append(r.online_score)
            z.append(abs(r.offline_bucket - r.online_bucket))
            if r.bucket_diff == BucketDiff.SAME:
                colors.append("green")
            elif r.bucket_diff == BucketDiff.ONE_BUCKET:
                colors.append("orange")
            else:
                colors.append("red")
            hover_texts.append(
                f"样本: {r.sample_id}<br>"
                f"离线分数: {r.offline_score:.3f}<br>"
                f"线上分数: {r.online_score:.3f}<br>"
                f"分桶差: {z[-1]}<br>"
                f"记录ID: {r.record_id}"
            )
            custom_data.append(r.record_id)

        fig = go.Figure(
            data=[
                go.Scatter3d(
                    x=x,
                    y=y,
                    z=z,
                    mode="markers",
                    marker=dict(size=6, color=colors, opacity=0.8),
                    text=hover_texts,
                    customdata=custom_data,
                    hoverinfo="text",
                )
            ]
        )

        fig.update_layout(
            title="3D视图：离线分数×线上分数×分桶差",
            scene=dict(
                xaxis_title="离线分数",
                yaxis_title="线上分数",
                zaxis_title="分桶差",
            ),
            clickmode="event+select",
        )

        return fig

    def create_bucket_diff_bar(self, records: List[DriftRecord]) -> go.Figure:
        counts = {
            "同桶": sum(1 for r in records if r.bucket_diff == BucketDiff.SAME),
            "差1桶": sum(1 for r in records if r.bucket_diff == BucketDiff.ONE_BUCKET),
            "差多桶": sum(1 for r in records if r.bucket_diff == BucketDiff.MULTI_BUCKET),
        }

        fig = go.Figure(
            data=[
                go.Bar(
                    x=list(counts.keys()),
                    y=list(counts.values()),
                    marker_color=["green", "orange", "red"],
                    text=list(counts.values()),
                    textposition="auto",
                )
            ]
        )

        fig.update_layout(
            title="分桶差异分布统计",
            yaxis_title="样本数量",
            bargap=0.4,
        )

        return fig

    def generate_html_dashboard(self, records: List[DriftRecord], output_path: str):
        fig1 = self.create_bucket_scatter_plot(records)
        fig2 = self.create_3d_score_plot(records)
        fig3 = self.create_bucket_diff_bar(records)

        records_json = []
        for r in records:
            recall_candidates = []
            for rc in r.recall_candidates:
                recall_candidates.append({
                    "candidate_id": rc.candidate_id,
                    "rank": rc.rank,
                    "score": rc.score,
                    "is_related": rc.is_related,
                    "reason": rc.reason,
                    "supplemented_by": rc.supplemented_by,
                })
            records_json.append({
                "record_id": r.record_id,
                "sample_id": r.sample_id,
                "offline_score": r.offline_score,
                "online_score": r.online_score,
                "offline_bucket": r.offline_bucket,
                "online_bucket": r.online_bucket,
                "bucket_diff": r.bucket_diff.value,
                "status": r.status.value,
                "why_kept": r.why_kept,
                "missing_materials": r.missing_materials,
                "next_owner": r.next_owner.value,
                "review_notes": r.review_notes,
                "recall_candidates": recall_candidates,
            })

        import json
        records_json_str = json.dumps(records_json, ensure_ascii=False)

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>异常检测阈值漂移分析看板</title>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
                .card {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                h1 {{ color: #333; }}
                h2 {{ color: #555; margin-top: 30px; }}
                h3 {{ color: #444; margin-top: 20px; }}
                .record-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
                .record-table th, .record-table td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; cursor: pointer; }}
                .record-table th {{ background: #f0f0f0; }}
                .record-table tr:hover {{ background: #eef5ff; }}
                .one-bucket {{ background: #fff3cd; }}
                .multi-bucket {{ background: #f8d7da; }}
                .highlighted {{ background: #b3d9ff !important; animation: pulse 1.5s ease-in-out infinite; }}
                @keyframes pulse {{
                    0%, 100% {{ box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.6); }}
                    50% {{ box-shadow: 0 0 0 8px rgba(0, 123, 255, 0); }}
                }}
                .status-badge {{ padding: 3px 8px; border-radius: 12px; font-size: 12px; color: white; }}
                .status-pending {{ background: #6c757d; }}
                .status-reviewed {{ background: #17a2b8; }}
                .status-supplemented {{ background: #ffc107; color: #333; }}
                .status-normal {{ background: #28a745; }}
                .status-investigate {{ background: #dc3545; }}
                .detail-panel {{
                    display: none;
                    background: #f8f9fa;
                    border-left: 4px solid #007bff;
                    padding: 15px 20px;
                    margin: 10px 0;
                    border-radius: 0 6px 6px 0;
                }}
                .detail-panel.open {{ display: block; }}
                .detail-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 15px; }}
                .detail-label {{ font-weight: bold; color: #555; display: block; font-size: 13px; }}
                .detail-value {{ color: #222; font-size: 15px; }}
                .score-box {{ display: inline-block; background: #e7f1ff; padding: 4px 10px; border-radius: 4px; font-family: monospace; font-size: 14px; }}
                .bucket-box {{ display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 14px; }}
                .bucket-same {{ background: #d4edda; color: #155724; }}
                .bucket-one {{ background: #fff3cd; color: #856404; }}
                .bucket-multi {{ background: #f8d7da; color: #721c24; }}
                .owner-tag {{ display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 13px; }}
                .owner-operation {{ background: #007bff; color: white; }}
                .owner-algorithm {{ background: #fd7e14; color: white; }}
                .owner-both {{ background: #6f42c1; color: white; }}
                .section-title {{ font-weight: bold; color: #007bff; margin: 15px 0 8px 0; font-size: 14px; border-bottom: 1px solid #dee2e6; padding-bottom: 4px; }}
                .material-list {{ margin: 5px 0; padding-left: 20px; }}
                .material-list li {{ margin: 3px 0; color: #dc3545; }}
                .material-list li.empty {{ color: #28a745; }}
                .recall-table {{ width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }}
                .recall-table th, .recall-table td {{ padding: 8px; border: 1px solid #dee2e6; text-align: left; }}
                .recall-table th {{ background: #e9ecef; }}
                .related-yes {{ color: #28a745; font-weight: bold; }}
                .related-no {{ color: #6c757d; }}
                .hint {{ background: #d1ecf1; padding: 10px; border-radius: 4px; margin: 10px 0; color: #0c5460; }}
                .alert-box {{ background: #fff3cd; border: 1px solid #ffc107; padding: 12px 16px; border-radius: 6px; margin: 10px 0; color: #856404; }}
                .alert-box strong {{ color: #721c24; }}
                .review-notes {{ background: #d1ecf1; padding: 10px; border-radius: 4px; margin-top: 8px; color: #0c5460; font-style: italic; }}
                .expand-hint {{ color: #007bff; font-size: 12px; margin-left: 8px; }}
                a.record-link {{ color: #007bff; text-decoration: none; font-weight: bold; }}
                a.record-link:hover {{ text-decoration: underline; }}
            </style>
        </head>
        <body>
            <h1>🔍 异常检测阈值漂移分析看板</h1>
            <div class="hint">
                💡 <strong>使用说明：</strong>
                点击下方散点图或3D图中的<strong>数据点</strong>可直接跳转到对应记录；
                点击表格中的<strong>样本ID</strong>可展开/收起该记录的完整详情（含负样本分数、召回候选表、为什么留给评测运营复核等）。
                橙色行 = 差1桶的记录，需要评测运营重点复核，别急着归正常。
            </div>

            <div class="card">
                <h2>📊 分桶差异分布</h2>
                <div id="chart3">{fig3.to_html(full_html=False, include_plotlyjs=False)}</div>
            </div>

            <div class="card">
                <h2>📈 离线vs线上分桶分布</h2>
                <div class="alert-box">
                    ⚠️ <strong>差1桶的橙色点需要评测运营复核</strong>：这些记录离线和线上分数刚好差了一个桶，别急着归为正常，
                    请点开查看详情，结合召回候选表判断是否需要进一步调查。
                </div>
                <div id="chart1">{fig1.to_html(full_html=False, include_plotlyjs=False)}</div>
            </div>

            <div class="card">
                <h2>🧊 3D视图：离线分数 × 线上分数 × 分桶差</h2>
                <p>Z轴为分桶差，越高表示偏差越大。点击数据点自动跳转到对应负样本记录。</p>
                <div id="chart2">{fig2.to_html(full_html=False, include_plotlyjs=False)}</div>
            </div>

            <div class="card">
                <h2>📋 漂移记录详情（差1桶优先展示）</h2>
                <p>点击 <span class="expand-hint">👉样本ID</span> 展开完整详情：负样本分数、为什么留下、缺什么材料、召回候选表……</p>
                <table class="record-table">
                    <thead>
                        <tr>
                            <th>样本ID</th>
                            <th>离线分数</th>
                            <th>线上分数</th>
                            <th>离线分桶</th>
                            <th>线上分桶</th>
                            <th>差异</th>
                            <th>状态</th>
                            <th>为什么留下</th>
                            <th>下一步找谁</th>
                        </tr>
                    </thead>
                    <tbody>
                        {self._generate_record_rows(records)}
                    </tbody>
                </table>
            </div>

            <script>
                const ALL_RECORDS = {records_json_str};

                function showRecordDetail(recordId) {{
                    const record = ALL_RECORDS.find(r => r.record_id === recordId);
                    if (!record) return;

                    document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('open'));
                    document.querySelectorAll('tr.highlighted').forEach(tr => tr.classList.remove('highlighted'));

                    const panel = document.getElementById('detail-' + recordId);
                    if (panel) panel.classList.add('open');

                    const row = document.getElementById('row-' + recordId);
                    if (row) {{
                        row.classList.add('highlighted');
                        row.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                    }}
                }}

                function toggleDetail(recordId) {{
                    const panel = document.getElementById('detail-' + recordId);
                    if (panel) panel.classList.toggle('open');
                    const row = document.getElementById('row-' + recordId);
                    if (row) row.classList.toggle('highlighted');
                }}

                document.addEventListener('DOMContentLoaded', function() {{
                    const plotlyElements = document.querySelectorAll('.js-plotly-plot');
                    plotlyElements.forEach(function(plot) {{
                        plot.on('plotly_click', function(data) {{
                            const point = data.points[0];
                            const recordId = point.customdata;
                            showRecordDetail(recordId);
                        }});
                    }});
                }});
            </script>
        </body>
        </html>
        """

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)

    def _generate_record_rows(self, records: List[DriftRecord]) -> str:
        sorted_records = sorted(
            records,
            key=lambda r: 0 if r.bucket_diff == BucketDiff.ONE_BUCKET else 1,
        )

        rows_html = []
        for r in sorted_records:
            status_class = f"status-{r.status.value.replace('_', '-')}"
            row_class = ""
            if r.bucket_diff == BucketDiff.ONE_BUCKET:
                row_class = "one-bucket"
            elif r.bucket_diff == BucketDiff.MULTI_BUCKET:
                row_class = "multi-bucket"

            if r.bucket_diff == BucketDiff.SAME:
                bucket_box_class = "bucket-same"
            elif r.bucket_diff == BucketDiff.ONE_BUCKET:
                bucket_box_class = "bucket-one"
            else:
                bucket_box_class = "bucket-multi"

            if r.next_owner.value == "operation":
                owner_class = "owner-operation"
                owner_text = "评测运营"
            elif r.next_owner.value == "algorithm":
                owner_class = "owner-algorithm"
                owner_text = "算法工程师小乔"
            else:
                owner_class = "owner-both"
                owner_text = "评测运营 + 小乔"

            material_items = ""
            if r.missing_materials:
                material_items = "".join(
                    f"<li>{m}</li>" for m in r.missing_materials
                )
            else:
                material_items = '<li class="empty">无缺失材料</li>'

            recall_rows_html = ""
            if r.recall_candidates:
                for rc in r.recall_candidates:
                    related_class = "related-yes" if rc.is_related else "related-no"
                    related_text = "相关" if rc.is_related else "不相关"
                    recall_rows_html += f"""
                    <tr>
                        <td>{rc.rank}</td>
                        <td>{rc.candidate_id}</td>
                        <td>{rc.score:.3f}</td>
                        <td class="{related_class}">{related_text}</td>
                        <td>{rc.reason or '-'}</td>
                        <td>{rc.supplemented_by or '-'}</td>
                    </tr>
                    """
                recall_table_html = f"""
                <table class="recall-table">
                    <thead>
                        <tr>
                            <th>排名</th>
                            <th>候选ID</th>
                            <th>分数</th>
                            <th>是否相关</th>
                            <th>原因</th>
                            <th>补录人</th>
                        </tr>
                    </thead>
                    <tbody>{recall_rows_html}</tbody>
                </table>
                """
            else:
                recall_table_html = "<p style='color:#6c757d;font-style:italic;'>暂无召回候选数据，需算法工程师小乔补录。</p>"

            review_notes_html = ""
            if r.review_notes:
                review_notes_html = f'<div class="review-notes">📝 评测运营复核备注：{r.review_notes}</div>'

            rows_html.append(
                f"""
                <tr id="row-{r.record_id}" class="{row_class}" onclick="toggleDetail('{r.record_id}')">
                    <td id="sample-{r.sample_id}">
                        <a class="record-link" href="#sample-{r.sample_id}" onclick="event.stopPropagation(); toggleDetail('{r.record_id}')">
                            {r.sample_id}
                        </a>
                        <span class="expand-hint">👆点我展开</span>
                    </td>
                    <td><span class="score-box">{r.offline_score:.3f}</span></td>
                    <td><span class="score-box">{r.online_score:.3f}</span></td>
                    <td>{r.offline_bucket}</td>
                    <td>{r.online_bucket}</td>
                    <td><span class="bucket-box {bucket_box_class}">{r.bucket_diff.value}</span></td>
                    <td><span class="status-badge {status_class}">{r.status.value}</span></td>
                    <td>{r.why_kept or '-'}</td>
                    <td><span class="owner-tag {owner_class}">{owner_text}</span></td>
                </tr>
                <tr>
                    <td colspan="9" style="padding:0;border:none;">
                        <div id="detail-{r.record_id}" class="detail-panel" onclick="event.stopPropagation()">
                            <h3>🔍 负样本详情 — {r.sample_id}</h3>

                            <div class="section-title">📊 离线 vs 线上分数对比</div>
                            <div class="detail-grid">
                                <div>
                                    <span class="detail-label">离线分数</span>
                                    <span class="detail-value"><span class="score-box">{r.offline_score:.3f}</span> → 分桶 {r.offline_bucket}</span>
                                </div>
                                <div>
                                    <span class="detail-label">线上分数</span>
                                    <span class="detail-value"><span class="score-box">{r.online_score:.3f}</span> → 分桶 {r.online_bucket}</span>
                                </div>
                                <div>
                                    <span class="detail-label">分桶差异</span>
                                    <span class="detail-value"><span class="bucket-box {bucket_box_class}">{r.bucket_diff.value}</span></span>
                                </div>
                                <div>
                                    <span class="detail-label">当前状态</span>
                                    <span class="detail-value"><span class="status-badge {status_class}">{r.status.value}</span></span>
                                </div>
                            </div>

                            <div class="section-title">❓ 为什么这条记录被留下</div>
                            <div class="detail-value" style="background:#fff3cd;padding:10px;border-radius:4px;">
                                {r.why_kept or '（未说明）'}
                            </div>

                            <div class="section-title">📋 还缺什么材料</div>
                            <ul class="material-list">{material_items}</ul>

                            <div class="section-title">👤 下一步该找谁</div>
                            <div class="detail-value">
                                <span class="owner-tag {owner_class}">{owner_text}</span>
                                {" → 评测运营需先进行复核确认（别急着归正常）" if r.next_owner.value in ("operation", "both") else ""}
                                {" → 算法工程师小乔需补查召回候选或特征日志" if r.next_owner.value in ("algorithm", "both") else ""}
                            </div>

                            {review_notes_html}

                            <div class="section-title">🔗 召回候选表（小乔补录）</div>
                            {recall_table_html}
                        </div>
                    </td>
                </tr>
                """
            )
        return "".join(rows_html)
