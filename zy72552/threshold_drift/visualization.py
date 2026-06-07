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
                .record-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
                .record-table th, .record-table td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
                .record-table th {{ background: #f0f0f0; }}
                .one-bucket {{ background: #fff3cd; }}
                .multi-bucket {{ background: #f8d7da; }}
                .status-badge {{ padding: 3px 8px; border-radius: 12px; font-size: 12px; color: white; }}
                .status-pending {{ background: #6c757d; }}
                .status-reviewed {{ background: #17a2b8; }}
                .status-supplemented {{ background: #ffc107; color: #333; }}
                .status-normal {{ background: #28a745; }}
                .status-investigate {{ background: #dc3545; }}
            </style>
        </head>
        <body>
            <h1>🔍 异常检测阈值漂移分析看板</h1>
            <p>点击图表中的数据点可查看对应记录详情，差1桶的样本需要评测运营复核。</p>

            <div class="card">
                <h2>📊 分桶差异分布</h2>
                <div id="chart3">{fig3.to_html(full_html=False, include_plotlyjs=False)}</div>
            </div>

            <div class="card">
                <h2>📈 离线vs线上分桶分布</h2>
                <p class="hint">💡 橙色点表示差1桶的样本，需要评测运营重点复核</p>
                <div id="chart1">{fig1.to_html(full_html=False, include_plotlyjs=False)}</div>
            </div>

            <div class="card">
                <h2>🧊 3D视图：分数×分桶差</h2>
                <div id="chart2">{fig2.to_html(full_html=False, include_plotlyjs=False)}</div>
            </div>

            <div class="card">
                <h2>📋 漂移记录详情（差1桶优先展示）</h2>
                <table class="record-table">
                    <thead>
                        <tr>
                            <th>样本ID</th>
                            <th>离线分桶</th>
                            <th>线上分桶</th>
                            <th>差异</th>
                            <th>状态</th>
                            <th>为什么留下</th>
                            <th>缺什么材料</th>
                            <th>下一步找谁</th>
                        </tr>
                    </thead>
                    <tbody>
                        {self._generate_record_rows(records)}
                    </tbody>
                </table>
            </div>

            <script>
                document.addEventListener('DOMContentLoaded', function() {{
                    const plotlyElements = document.querySelectorAll('.js-plotly-plot');
                    plotlyElements.forEach(function(plot) {{
                        plot.on('plotly_click', function(data) {{
                            const point = data.points[0];
                            const recordId = point.customdata;
                            alert('点击了记录: ' + recordId + '\\n可跳转到负样本列表或召回候选表查看详情');
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

        rows = []
        for r in sorted_records:
            status_class = f"status-{r.status.value.replace('_', '-')}"
            row_class = ""
            if r.bucket_diff == BucketDiff.ONE_BUCKET:
                row_class = "one-bucket"
            elif r.bucket_diff == BucketDiff.MULTI_BUCKET:
                row_class = "multi-bucket"

            missing = ", ".join(r.missing_materials) if r.missing_materials else "-"
            rows.append(
                f"""
                <tr class="{row_class}">
                    <td><a href="#sample-{r.sample_id}">{r.sample_id}</a></td>
                    <td>{r.offline_bucket}</td>
                    <td>{r.online_bucket}</td>
                    <td>{r.bucket_diff.value}</td>
                    <td><span class="status-badge {status_class}">{r.status.value}</span></td>
                    <td>{r.why_kept or '-'}</td>
                    <td>{missing}</td>
                    <td>{r.next_owner.value}</td>
                </tr>
                """
            )
        return "".join(rows)
