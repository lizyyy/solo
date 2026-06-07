import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from datetime import datetime

from .models import (
    EvalSlice,
    FeatureStatus,
    ExplainableSummary,
    YamlParams,
    ReviewStatus,
)


class Visualizer:
    def __init__(self, yaml_params: Optional[YamlParams] = None):
        self.yaml_params = yaml_params

    def set_yaml_params(self, yaml_params: YamlParams):
        self.yaml_params = yaml_params

    def create_3d_scatter(
        self,
        slices: List[EvalSlice],
        summaries: Dict[str, ExplainableSummary],
        x_feature: str = "reward_score",
        y_feature: str = "predicted_reward",
        z_feature: Optional[str] = None,
        highlight_missing: bool = True,
    ) -> go.Figure:
        df = self._slices_to_dataframe(slices, summaries)

        if z_feature is None:
            z_feature = "confidence_score" if "confidence_score" in df.columns else "reward_score"

        color_map = {
            "missing_with_default": "#FF6B6B",
            "missing_no_default": "#FF0000",
            "outlier": "#FFA500",
            "normal": "#4ECDC4",
        }

        if highlight_missing:
            df["color_group"] = df.apply(self._get_color_group, axis=1)
        else:
            df["color_group"] = "normal"

        hover_data = self._build_hover_data(df)

        fig = go.Figure()

        for status in ["missing_with_default", "missing_no_default", "outlier", "normal"]:
            subset = df[df["color_group"] == status]
            if len(subset) == 0:
                continue

            status_label = {
                "missing_with_default": "特征缺失(有默认值)",
                "missing_no_default": "特征缺失(无默认值)",
                "outlier": "异常值",
                "normal": "正常",
            }[status]

            fig.add_trace(go.Scatter3d(
                x=subset[x_feature],
                y=subset[y_feature],
                z=subset[z_feature],
                mode="markers",
                marker=dict(
                    size=8 if status == "normal" else 12,
                    color=color_map[status],
                    opacity=0.8 if status == "normal" else 1.0,
                    line=dict(width=2, color="DarkSlateGrey") if status != "normal" else None,
                ),
                name=status_label,
                text=subset["hover_text"],
                hoverinfo="text",
                customdata=subset["slice_id"].values,
            ))

        fig.update_layout(
            title="强化学习奖励回放 - 3D散点图",
            scene=dict(
                xaxis_title=x_feature,
                yaxis_title=y_feature,
                zaxis_title=z_feature,
            ),
            legend_title="特征状态",
            height=700,
            margin=dict(l=0, r=0, t=40, b=0),
        )

        return fig

    def create_reward_comparison_chart(
        self,
        slices: List[EvalSlice],
        summaries: Dict[str, ExplainableSummary],
    ) -> go.Figure:
        df = self._slices_to_dataframe(slices, summaries)
        df = df.sort_values("timestamp")

        fig = make_subplots(
            rows=2, cols=1,
            shared_xaxes=True,
            vertical_spacing=0.08,
            subplot_titles=("实际奖励 vs 预测奖励", "奖励偏差(实际-预测)"),
        )

        df["marker_color"] = df.apply(
            lambda r: "#FF6B6B" if r["has_missing"] else "#4ECDC4", axis=1
        )
        df["marker_size"] = df.apply(
            lambda r: 10 if r["has_missing"] else 6, axis=1
        )

        fig.add_trace(go.Scatter(
            x=df["timestamp"],
            y=df["reward_score"],
            mode="lines+markers",
            name="实际奖励",
            line=dict(color="#2C3E50", width=2),
            marker=dict(color=df["marker_color"], size=df["marker_size"]),
            text=df["hover_text"],
            hoverinfo="text",
            customdata=df["slice_id"].values,
        ), row=1, col=1)

        fig.add_trace(go.Scatter(
            x=df["timestamp"],
            y=df["predicted_reward"],
            mode="lines",
            name="预测奖励",
            line=dict(color="#3498DB", width=2, dash="dash"),
        ), row=1, col=1)

        df["reward_diff"] = df["reward_score"] - df["predicted_reward"]
        fig.add_trace(go.Bar(
            x=df["timestamp"],
            y=df["reward_diff"],
            name="奖励偏差",
            marker_color=df["marker_color"],
            text=df["hover_text"],
            hoverinfo="text",
            customdata=df["slice_id"].values,
        ), row=2, col=1)

        fig.update_layout(
            height=600,
            showlegend=True,
            legend_title="图例",
        )
        fig.update_yaxes(title_text="奖励值", row=1, col=1)
        fig.update_yaxes(title_text="偏差值", row=2, col=1)

        return fig

    def create_feature_missing_heatmap(
        self,
        slices: List[EvalSlice],
    ) -> go.Figure:
        if not slices:
            return go.Figure()

        feature_names = list(set(
            feat.name for s in slices for feat in s.features.values()
        ))
        feature_names.sort()

        data = []
        for s in slices:
            row = {"slice_id": s.slice_id}
            for feat_name in feature_names:
                feat = s.features.get(feat_name)
                if feat:
                    if feat.status == FeatureStatus.MISSING_WITH_DEFAULT:
                        row[feat_name] = 2
                    elif feat.status == FeatureStatus.MISSING_NO_DEFAULT:
                        row[feat_name] = 3
                    elif feat.status == FeatureStatus.OUTLIER:
                        row[feat_name] = 1
                    else:
                        row[feat_name] = 0
                else:
                    row[feat_name] = 0
            data.append(row)

        df = pd.DataFrame(data)
        df.set_index("slice_id", inplace=True)

        colorscale = [
            [0.0, "#4ECDC4"],
            [0.33, "#FFA500"],
            [0.66, "#FF6B6B"],
            [1.0, "#FF0000"],
        ]

        fig = go.Figure(data=go.Heatmap(
            z=df.values,
            x=df.columns,
            y=df.index,
            colorscale=colorscale,
            showscale=True,
            colorbar=dict(
                tickmode="array",
                tickvals=[0, 1, 2, 3],
                ticktext=["正常", "异常值", "缺失(有默认)", "缺失(无默认)"],
            ),
        ))

        fig.update_layout(
            title="特征缺失热力图",
            xaxis_title="特征名称",
            yaxis_title="评测切片",
            height=500,
        )

        return fig

    def create_dashboard(
        self,
        slices: List[EvalSlice],
        summaries: Dict[str, ExplainableSummary],
        output_path: Optional[str] = None,
    ) -> str:
        fig1 = self.create_3d_scatter(slices, summaries)
        fig2 = self.create_reward_comparison_chart(slices, summaries)
        fig3 = self.create_feature_missing_heatmap(slices)

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>强化学习奖励回放 - 服务复核看板</title>
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #f5f7fa; }}
                h1 {{ color: #2C3E50; text-align: center; }}
                h2 {{ color: #34495E; border-bottom: 2px solid #3498DB; padding-bottom: 8px; }}
                .card {{ background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .summary-stats {{ display: flex; gap: 20px; flex-wrap: wrap; }}
                .stat-box {{ flex: 1; min-width: 150px; padding: 15px; border-radius: 8px; text-align: center; }}
                .stat-box .num {{ font-size: 2em; font-weight: bold; }}
                .stat-box .label {{ color: #7f8c8d; }}
                .missing {{ background: #ffebee; }}
                .missing .num {{ color: #c62828; }}
                .normal {{ background: #e8f5e9; }}
                .normal .num {{ color: #2e7d32; }}
                .warning {{ background: #fff3e0; }}
                .warning .num {{ color: #ef6c00; }}
                .total {{ background: #e3f2fd; }}
                .total .num {{ color: #1565c0; }}
            </style>
        </head>
        <body>
            <h1>🎮 强化学习奖励回放 - 服务复核看板</h1>
            
            <div class="card">
                <h2>📊 概览统计</h2>
                {self._render_stats(slices)}
            </div>
            
            <div class="card">
                <h2>🎯 3D散点图（点击数据点查看详情）</h2>
                {fig1.to_html(full_html=False, include_plotlyjs='cdn')}
            </div>
            
            <div class="card">
                <h2>📈 奖励对比与偏差分析</h2>
                {fig2.to_html(full_html=False, include_plotlyjs=False)}
            </div>
            
            <div class="card">
                <h2>🔥 特征缺失热力图</h2>
                {fig3.to_html(full_html=False, include_plotlyjs=False)}
            </div>
            
            <div class="card">
                <h2>📝 有特征缺失的切片详情</h2>
                {self._render_missing_slices_table(slices, summaries)}
            </div>
        </body>
        </html>
        """

        if output_path:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(html_content)
            return output_path

        return html_content

    def _render_stats(self, slices: List[EvalSlice]) -> str:
        total = len(slices)
        has_missing = sum(1 for s in slices if s.has_missing_features)
        missing_default = sum(
            1 for s in slices
            if any(f.status == FeatureStatus.MISSING_WITH_DEFAULT for f in s.features.values())
        )
        normal = total - has_missing

        return f"""
        <div class="summary-stats">
            <div class="stat-box total">
                <div class="num">{total}</div>
                <div class="label">总切片数</div>
            </div>
            <div class="stat-box normal">
                <div class="num">{normal}</div>
                <div class="label">特征完整</div>
            </div>
            <div class="stat-box warning">
                <div class="num">{missing_default}</div>
                <div class="label">特征缺失(有默认分)</div>
            </div>
            <div class="stat-box missing">
                <div class="num">{has_missing - missing_default}</div>
                <div class="label">特征缺失(无默认)</div>
            </div>
        </div>
        """

    def _render_missing_slices_table(
        self,
        slices: List[EvalSlice],
        summaries: Dict[str, ExplainableSummary],
    ) -> str:
        missing_slices = [s for s in slices if s.has_missing_features]
        if not missing_slices:
            return "<p style='color: #2e7d32;'>✅ 所有切片特征完整，没有缺失问题</p>"

        rows = ""
        for s in missing_slices:
            summary = summaries.get(s.slice_id)
            missing_feats = ", ".join(
                f"{f.name}({'有默认' if f.status == FeatureStatus.MISSING_WITH_DEFAULT else '无默认'})"
                for f in s.missing_features
            )
            next_step = summary.next_step if summary else "待分析"
            responsible = summary.responsible_person.value if summary else "unknown"

            rows += f"""
            <tr>
                <td><code>{s.slice_id}</code></td>
                <td>{s.timestamp.strftime('%Y-%m-%d %H:%M')}</td>
                <td><span style="color: #e74c3c;">{missing_feats}</span></td>
                <td>{s.reward_score:.3f}</td>
                <td>{s.predicted_reward:.3f}</td>
                <td>{next_step}</td>
                <td><b>{responsible}</b></td>
            </tr>
            """

        return f"""
        <table style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #2C3E50; color: white;">
                    <th style="padding: 10px; text-align: left;">切片ID</th>
                    <th style="padding: 10px; text-align: left;">时间</th>
                    <th style="padding: 10px; text-align: left;">缺失特征</th>
                    <th style="padding: 10px; text-align: left;">实际奖励</th>
                    <th style="padding: 10px; text-align: left;">预测奖励</th>
                    <th style="padding: 10px; text-align: left;">下一步</th>
                    <th style="padding: 10px; text-align: left;">负责人</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        """

    def _slices_to_dataframe(
        self,
        slices: List[EvalSlice],
        summaries: Dict[str, ExplainableSummary],
    ) -> pd.DataFrame:
        data = []
        for s in slices:
            summary = summaries.get(s.slice_id)
            row = {
                "slice_id": s.slice_id,
                "timestamp": s.timestamp,
                "reward_score": s.reward_score,
                "predicted_reward": s.predicted_reward,
                "reward_diff": s.reward_score - s.predicted_reward,
                "has_missing": s.has_missing_features,
                "missing_count": len(s.missing_features),
                "review_status": s.review_status.value,
                "confidence_score": min(
                    (f.confidence_score for f in s.features.values()),
                    default=1.0,
                ),
                "summary_why_kept": summary.why_kept if summary else "",
                "summary_next_step": summary.next_step if summary else "",
                "summary_responsible": summary.responsible_person.value if summary else "",
            }

            for feat_name, feat in s.features.items():
                row[f"feat_{feat_name}"] = feat.actual_value
                row[f"feat_{feat_name}_status"] = feat.status.value

            row["hover_text"] = self._build_hover_text(s, summary)
            data.append(row)

        return pd.DataFrame(data)

    def _build_hover_text(self, s: EvalSlice, summary: Optional[ExplainableSummary]) -> str:
        lines = [
            f"<b>切片ID:</b> {s.slice_id}",
            f"<b>时间:</b> {s.timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            f"<b>实际奖励:</b> {s.reward_score:.4f}",
            f"<b>预测奖励:</b> {s.predicted_reward:.4f}",
            f"<b>偏差:</b> {s.reward_score - s.predicted_reward:.4f}",
            "",
        ]

        if s.has_missing_features:
            lines.append("<b>⚠️ 特征缺失:</b>")
            for feat in s.missing_features:
                status_text = "有默认值" if feat.status == FeatureStatus.MISSING_WITH_DEFAULT else "无默认值"
                lines.append(f"  - {feat.name}: {status_text}, 默认={feat.default_value}")
            lines.append("")

        if summary:
            lines.append(f"<b>为什么保留:</b> {summary.why_kept[:60]}...")
            lines.append(f"<b>下一步:</b> {summary.next_step[:60]}...")
            lines.append(f"<b>负责人:</b> {summary.responsible_person.value}")

        return "<br>".join(lines)

    def _get_color_group(self, row: pd.Series) -> str:
        if row.get("has_missing", False):
            for col in row.index:
                if col.endswith("_status"):
                    if row[col] == "missing_no_default":
                        return "missing_no_default"
                    if row[col] == "missing_with_default":
                        return "missing_with_default"
            return "missing_with_default"
        return "normal"

    def _build_hover_data(self, df: pd.DataFrame) -> List[str]:
        return df["hover_text"].tolist() if "hover_text" in df.columns else df["slice_id"].tolist()
