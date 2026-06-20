from typing import Dict, List, Optional
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from pathlib import Path

from .models import DataStatus


class Visualizer:
    CLICK_JS = """<script>
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        var plots = document.querySelectorAll('.js-plotly-plot');
        plots.forEach(function(plot) {
            plot.on('plotly_click', function(data) {
                if (data.points && data.points.length > 0) {
                    var point = data.points[0];
                    if (point.customdata && point.customdata.length >= 2) {
                        var batchId = point.customdata[0];
                        var itemId = point.customdata[1];
                        window.location.href = 'index.html#dup_' + batchId + '_' + itemId;
                    }
                }
            });
        });
    }, 500);
});
</script>"""

    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _inject_js(self, html_path: str) -> None:
        path = Path(html_path)
        if not path.exists():
            return

        content = path.read_text(encoding="utf-8")

        if self.CLICK_JS in content:
            return

        if "</body>" in content:
            content = content.replace("</body>", self.CLICK_JS + "</body>")
        elif "</html>" in content:
            content = content.replace("</html>", self.CLICK_JS + "</html>")
        else:
            content = content + self.CLICK_JS

        path.write_text(content, encoding="utf-8")

    def create_status_distribution_chart(
        self,
        df: pd.DataFrame,
        title: str = "数据状态分布",
        filename: str = "status_distribution.html",
    ) -> str:
        if "status" not in df.columns:
            raise ValueError("DataFrame 必须包含 'status' 列")

        status_counts = df["status"].value_counts().reset_index()
        status_counts.columns = ["状态", "数量"]

        color_map = {
            "待复核": "#FFA500",
            "正常": "#00CC96",
            "重复训练": "#EF553B",
            "材料不足": "#AB63FA",
            "待策略产品复核": "#FF6B6B",
            "已确认": "#19D3F3",
        }

        fig = px.pie(
            status_counts,
            values="数量",
            names="状态",
            title=title,
            color="状态",
            color_discrete_map=color_map,
            hole=0.4,
        )

        fig.update_traces(
            textinfo="label+percent+value",
            hovertemplate="<b>%{label}</b><br>数量: %{value}<br>占比: %{percent}<extra></extra>",
        )

        output_path = self.output_dir / filename
        fig.write_html(str(output_path), include_plotlyjs="cdn")
        self._inject_js(str(output_path))
        return str(output_path)

    def create_duplicate_bar_chart(
        self,
        duplicate_groups: List[Dict],
        title: str = "重复训练数据分组统计",
        filename: str = "duplicate_bar_chart.html",
    ) -> str:
        if not duplicate_groups:
            return ""

        data = []
        for g in duplicate_groups:
            dup_type = "跨表交叉" if g.get("is_cross", False) else "表内重复"
            data.append(
                {
                    "批次-商品": f"{g['batch_id']}-{g['item_id']}",
                    "重复次数": g["count"],
                    "batch_id": g["batch_id"],
                    "item_id": g["item_id"],
                    "类型": dup_type,
                }
            )

        df = pd.DataFrame(data)

        color_map = {
            "跨表交叉": "#EF553B",
            "表内重复": "#FFA500",
        }

        fig = px.bar(
            df,
            x="批次-商品",
            y="重复次数",
            color="类型",
            color_discrete_map=color_map,
            title=title,
            text="重复次数",
            custom_data=["batch_id", "item_id", "类型"],
        )

        fig.update_layout(
            xaxis_tickangle=-45,
            hovermode="x unified",
        )

        fig.update_traces(
            hovertemplate="<b>%{x}</b><br>批次: %{customdata[0]}<br>商品: %{customdata[1]}<br>类型: %{customdata[2]}<br>重复次数: %{y}<br>(点击跳转到明细)<extra></extra>",
        )

        output_path = self.output_dir / filename
        fig.write_html(str(output_path), include_plotlyjs="cdn")
        self._inject_js(str(output_path))
        return str(output_path)

    def create_3d_scatter_chart(
        self,
        df: pd.DataFrame,
        x_col: str = "batch_id",
        y_col: str = "item_id",
        z_col: str = "recall_score",
        color_col: str = "status",
        title: str = "3D 数据分布视图",
        filename: str = "3d_scatter.html",
    ) -> str:
        required_cols = [x_col, y_col, z_col, color_col]
        for col in required_cols:
            if col not in df.columns:
                df[col] = "未知" if col != z_col else 0

        df_sample = df.copy()
        df_sample[x_col] = pd.Categorical(df_sample[x_col]).codes
        df_sample[y_col] = pd.Categorical(df_sample[y_col]).codes

        color_map = {
            "待复核": "#FFA500",
            "正常": "#00CC96",
            "重复训练": "#EF553B",
            "材料不足": "#AB63FA",
            "待策略产品复核": "#FF6B6B",
            "已确认": "#19D3F3",
        }

        traces = []
        for status in df[color_col].unique():
            status_df = df[df[color_col] == status]
            status_df_sample = df_sample[df_sample[color_col] == status]

            customdata = []
            hover_texts = []
            for _, row in status_df.iterrows():
                batch_id = str(row.get(x_col, ""))
                item_id = str(row.get(y_col, ""))
                score = row.get(z_col, "")

                if "sample_id" in status_df.columns and pd.notna(row.get("sample_id", None)):
                    record_id = str(row["sample_id"])
                    src_type = "负样本"
                elif "candidate_id" in status_df.columns and pd.notna(row.get("candidate_id", None)):
                    record_id = str(row["candidate_id"])
                    src_type = "召回候选"
                else:
                    record_id = ""
                    src_type = "未知"

                customdata.append([batch_id, item_id, record_id, src_type])
                hover_texts.append(
                    f"批次: {batch_id}<br>商品: {item_id}<br>分数: {score}<br>ID: {record_id}<br>(点击跳转到明细)"
                )

            traces.append(
                go.Scatter3d(
                    x=status_df_sample[x_col],
                    y=status_df_sample[y_col],
                    z=status_df_sample[z_col],
                    mode="markers",
                    marker=dict(
                        size=5,
                        opacity=0.8,
                        color=color_map.get(status, "#636EFA"),
                    ),
                    name=status,
                    text=hover_texts,
                    hoverinfo="text",
                    customdata=customdata,
                )
            )

        fig = go.Figure(data=traces)

        fig.update_layout(
            title=title,
            scene=dict(
                xaxis_title="批次",
                yaxis_title="商品",
                zaxis_title="召回分数",
            ),
            legend_title="状态",
            width=900,
            height=700,
        )

        output_path = self.output_dir / filename
        fig.write_html(str(output_path), include_plotlyjs="cdn")
        self._inject_js(str(output_path))
        return str(output_path)

    def create_workflow_timeline(
        self,
        step_results: Dict[str, Dict],
        title: str = "评估流程时间线",
        filename: str = "workflow_timeline.html",
    ) -> str:
        steps = []
        for step_name, result in step_results.items():
            if result:
                steps.append(
                    {
                        "步骤": step_name.replace("_", " ").title(),
                        "处理数量": result.get("total_imported", result.get("total_versions", 0)),
                        "异常数量": result.get("duplicate_groups", 0)
                        + result.get("cross_duplicates", 0),
                    }
                )

        if not steps:
            return ""

        df = pd.DataFrame(steps)
        df["步骤顺序"] = range(1, len(df) + 1)

        fig = make_subplots(specs=[[{"secondary_y": True}]])

        fig.add_trace(
            go.Bar(
                x=df["步骤"],
                y=df["处理数量"],
                name="处理数量",
                marker_color="#636EFA",
                text=df["处理数量"],
                textposition="auto",
            ),
            secondary_y=False,
        )

        fig.add_trace(
            go.Scatter(
                x=df["步骤"],
                y=df["异常数量"],
                name="异常数量",
                mode="lines+markers",
                marker=dict(color="#EF553B", size=10),
                line=dict(width=3),
                text=df["异常数量"],
                textposition="top center",
            ),
            secondary_y=True,
        )

        fig.update_layout(
            title=title,
            xaxis_title="评估步骤",
            barmode="group",
            hovermode="x unified",
        )

        fig.update_yaxes(title_text="处理数量", secondary_y=False)
        fig.update_yaxes(title_text="异常数量", secondary_y=True)

        output_path = self.output_dir / filename
        fig.write_html(str(output_path), include_plotlyjs="cdn")
        self._inject_js(str(output_path))
        return str(output_path)

    def create_batch_comparison_chart(
        self,
        df: pd.DataFrame,
        title: str = "各批次数据质量对比",
        filename: str = "batch_comparison.html",
    ) -> str:
        if "batch_id" not in df.columns or "status" not in df.columns:
            return ""

        batch_status = pd.crosstab(df["batch_id"], df["status"]).reset_index()
        batch_status_melt = batch_status.melt(
            id_vars=["batch_id"], var_name="状态", value_name="数量"
        )

        color_map = {
            "待复核": "#FFA500",
            "正常": "#00CC96",
            "重复训练": "#EF553B",
            "材料不足": "#AB63FA",
            "待策略产品复核": "#FF6B6B",
            "已确认": "#19D3F3",
        }

        fig = px.bar(
            batch_status_melt,
            x="batch_id",
            y="数量",
            color="状态",
            color_discrete_map=color_map,
            title=title,
            barmode="stack",
        )

        fig.update_layout(
            xaxis_title="批次ID",
            yaxis_title="数据量",
            xaxis_tickangle=-45,
        )

        output_path = self.output_dir / filename
        fig.write_html(str(output_path), include_plotlyjs="cdn")
        self._inject_js(str(output_path))
        return str(output_path)

    def generate_all_charts(
        self, dataframes: Dict[str, pd.DataFrame], duplicate_summary: Dict
    ) -> Dict[str, str]:
        charts = {}

        if "negative_samples" in dataframes:
            charts["负样本状态分布"] = self.create_status_distribution_chart(
                dataframes["negative_samples"],
                title="负样本状态分布",
                filename="negative_status_distribution.html",
            )

        if "recall_candidates" in dataframes:
            charts["召回候选状态分布"] = self.create_status_distribution_chart(
                dataframes["recall_candidates"],
                title="召回候选表状态分布",
                filename="recall_status_distribution.html",
            )

            if "recall_score" in dataframes["recall_candidates"].columns:
                charts["3D数据分布"] = self.create_3d_scatter_chart(
                    dataframes["recall_candidates"],
                    x_col="batch_id",
                    y_col="item_id",
                    z_col="recall_score",
                    color_col="status",
                    title="召回候选数据 3D 分布",
                    filename="recall_3d_scatter.html",
                )

            charts["批次对比"] = self.create_batch_comparison_chart(
                dataframes["recall_candidates"],
                title="各批次召回数据质量对比",
                filename="batch_comparison.html",
            )

        if duplicate_summary.get("duplicate_groups"):
            charts["重复训练分组"] = self.create_duplicate_bar_chart(
                duplicate_summary["duplicate_groups"],
                title="重复训练数据分组统计",
                filename="duplicate_bar_chart.html",
            )

        if "feature_versions" in dataframes:
            charts["特征版本状态分布"] = self.create_status_distribution_chart(
                dataframes["feature_versions"],
                title="特征版本表状态分布",
                filename="feature_status_distribution.html",
            )

        return charts
