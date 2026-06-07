"""图表生成模块 - 支持从图表点回对应明细"""
import json
import uuid
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

from .config import CHARTS_DIR
from .database import get_db, CHARTS_TABLE

plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


class ChartGenerator:
    """图表生成器 - 每个图表都支持下钻到明细"""

    def __init__(self, batch_id: str):
        self.db = get_db()
        self.batch_id = batch_id
        self.charts: List[Dict] = []

    def _record_chart(self, chart_type: str, chart_title: str, file_path: str,
                      data_query: str, drilldown_config: Dict) -> str:
        """记录图表元数据到数据库"""
        chart_id = str(uuid.uuid4())
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"INSERT INTO {CHARTS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                chart_id,
                self.batch_id,
                chart_type,
                chart_title,
                file_path,
                data_query,
                json.dumps(drilldown_config, ensure_ascii=False),
                datetime.now().isoformat()
            )
        )
        self.db.conn.commit()
        chart = {
            "id": chart_id,
            "chart_type": chart_type,
            "chart_title": chart_title,
            "file_path": file_path,
            "drilldown_config": drilldown_config
        }
        self.charts.append(chart)
        return chart_id

    def _get_chart_path(self, name: str) -> str:
        return str(CHARTS_DIR / f"{self.batch_id}_{name}_{datetime.now().strftime('%H%M%S')}.png")

    def generate_section_score_chart(self, section_metrics: pd.DataFrame,
                                     personal_df: pd.DataFrame) -> str:
        """生成声部平均分对比图 - 支持点击声部查看人员明细"""
        fig, ax = plt.subplots(figsize=(10, 6))
        sections = section_metrics["声部"].tolist()
        avg_scores = section_metrics["声部平均分"].tolist()
        pass_rates = section_metrics["声部达标率"].tolist()
        priorities = section_metrics["排练优先级"].tolist()
        colors = []
        for p in priorities:
            if p == "优先排练":
                colors.append("#e74c3c")
            elif p == "加强排练":
                colors.append("#f39c12")
            elif p == "正常排练":
                colors.append("#3498db")
            else:
                colors.append("#2ecc71")
        bars = ax.bar(sections, avg_scores, color=colors, alpha=0.7)
        for bar, rate in zip(bars, pass_rates):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2., height + 0.5,
                   f'{height:.1f}分\n达标率{rate:.0f}%',
                   ha='center', va='bottom', fontsize=10)
        ax.set_ylabel('平均分')
        ax.set_title('各声部排练综合得分对比')
        ax.axhline(y=80, color='red', linestyle='--', alpha=0.5, label='达标线(80分)')
        ax.axhline(y=90, color='green', linestyle='--', alpha=0.5, label='优秀线(90分)')
        legend_patches = [
            mpatches.Patch(color='#e74c3c', label='优先排练'),
            mpatches.Patch(color='#f39c12', label='加强排练'),
            mpatches.Patch(color='#3498db', label='正常排练'),
            mpatches.Patch(color='#2ecc71', label='保持状态')
        ]
        ax.legend(handles=legend_patches, loc='upper right')
        plt.tight_layout()
        file_path = self._get_chart_path("section_scores")
        plt.savefig(file_path, dpi=150, bbox_inches='tight')
        plt.close()
        drilldown_config = {
            "type": "by_section",
            "click_field": "声部",
            "query": "SELECT 人员, 个人综合分, 音准得分, 节奏得分, 合声得分, 音量平衡, 情感表达 FROM personal_df WHERE 声部 = ?",
            "detail_columns": ["人员", "个人综合分", "音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达"]
        }
        chart_id = self._record_chart(
            chart_type="bar",
            chart_title="各声部排练综合得分对比",
            file_path=file_path,
            data_query="section_metrics",
            drilldown_config=drilldown_config
        )
        return chart_id

    def generate_radar_chart(self, section_metrics: pd.DataFrame,
                             personal_df: pd.DataFrame) -> str:
        """生成声部能力雷达图 - 支持查看各项能力维度"""
        sections = section_metrics["声部"].tolist()
        if len(sections) > 4:
            sections = sections[:4]
        categories = ["音准得分", "节奏得分", "合声得分", "音量平衡", "情感表达"]
        N = len(categories)
        angles = [n / float(N) * 2 * 3.14159 for n in range(N)]
        angles += angles[:1]
        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))
        colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']
        for i, section in enumerate(sections):
            section_data = personal_df[personal_df["声部"] == section]
            values = []
            for cat in categories:
                if cat in section_data.columns:
                    values.append(section_data[cat].mean())
                else:
                    values.append(0)
            values += values[:1]
            ax.plot(angles, values, 'o-', linewidth=2, label=section, color=colors[i % len(colors)])
            ax.fill(angles, values, alpha=0.1, color=colors[i % len(colors)])
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories)
        ax.set_ylim(0, 100)
        ax.set_title('各声部能力维度雷达图')
        ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))
        plt.tight_layout()
        file_path = self._get_chart_path("radar")
        plt.savefig(file_path, dpi=150, bbox_inches='tight')
        plt.close()
        drilldown_config = {
            "type": "by_category",
            "click_field": "能力维度",
            "query": "SELECT 声部, 人员, {field} FROM personal_df ORDER BY {field} DESC",
            "detail_columns": ["声部", "人员", "{field}"]
        }
        chart_id = self._record_chart(
            chart_type="radar",
            chart_title="各声部能力维度雷达图",
            file_path=file_path,
            data_query="personal_df_means",
            drilldown_config=drilldown_config
        )
        return chart_id

    def generate_attendance_chart(self, attendance_df: pd.DataFrame) -> Optional[str]:
        """生成出勤率堆叠柱状图"""
        if attendance_df.empty or "声部" not in attendance_df.columns:
            return None
        fig, ax = plt.subplots(figsize=(10, 6))
        sections = attendance_df["声部"].tolist()
        出勤 = attendance_df["出勤"].tolist() if "出勤" in attendance_df.columns else [0] * len(sections)
        迟到 = attendance_df["迟到"].tolist() if "迟到" in attendance_df.columns else [0] * len(sections)
        请假 = attendance_df["请假"].tolist() if "请假" in attendance_df.columns else [0] * len(sections)
        缺勤 = attendance_df["缺勤"].tolist() if "缺勤" in attendance_df.columns else [0] * len(sections)
        bar_width = 0.6
        p1 = ax.bar(sections, 出勤, bar_width, label='出勤', color='#2ecc71')
        p2 = ax.bar(sections, 迟到, bar_width, bottom=出勤, label='迟到', color='#f39c12')
        p3 = ax.bar(sections, 请假, bar_width, bottom=[a + b for a, b in zip(出勤, 迟到)], label='请假', color='#3498db')
        p4 = ax.bar(sections, 缺勤, bar_width, bottom=[a + b + c for a, b, c in zip(出勤, 迟到, 请假)], label='缺勤', color='#e74c3c')
        if "出勤率" in attendance_df.columns:
            rates = attendance_df["出勤率"].tolist()
            for i, rate in enumerate(rates):
                total = 出勤[i] + 迟到[i] + 请假[i] + 缺勤[i]
                ax.text(i, total + 0.2, f'{rate:.0f}%', ha='center', fontsize=10)
        ax.set_ylabel('人数')
        ax.set_title('各声部出勤情况')
        ax.legend()
        plt.tight_layout()
        file_path = self._get_chart_path("attendance")
        plt.savefig(file_path, dpi=150, bbox_inches='tight')
        plt.close()
        drilldown_config = {
            "type": "by_section",
            "click_field": "声部",
            "query": "SELECT 人员, 出勤状态 FROM personal_df WHERE 声部 = ?",
            "detail_columns": ["人员", "出勤状态"]
        }
        chart_id = self._record_chart(
            chart_type="stacked_bar",
            chart_title="各声部出勤情况",
            file_path=file_path,
            data_query="attendance_metrics",
            drilldown_config=drilldown_config
        )
        return chart_id

    def generate_personal_scatter(self, personal_df: pd.DataFrame) -> str:
        """生成个人得分散点图 - 支持点击异常点查看详情"""
        fig, ax = plt.subplots(figsize=(12, 7))
        sections = personal_df["声部"].unique().tolist()
        colors = plt.cm.tab10(range(len(sections)))
        for i, section in enumerate(sections):
            section_data = personal_df[personal_df["声部"] == section]
            x = range(len(section_data))
            y = section_data["个人综合分"].tolist()
            labels = section_data["人员"].tolist()
            record_ids = section_data["_record_id"].tolist() if "_record_id" in section_data.columns else [""] * len(labels)
            ax.scatter(x, y, c=[colors[i]], label=section, s=100, alpha=0.7, edgecolors='black')
            for xi, yi, label, rid in zip(x, y, labels, record_ids):
                ax.annotate(label, (xi, yi), textcoords="offset points",
                           xytext=(0, 10), ha='center', fontsize=8)
        ax.axhline(y=80, color='red', linestyle='--', alpha=0.5, label='达标线')
        ax.axhline(y=70, color='orange', linestyle='--', alpha=0.5, label='及格线')
        ax.set_xticks([])
        ax.set_xlabel('人员（按声部排列）')
        ax.set_ylabel('个人综合分')
        ax.set_title('个人综合得分分布')
        ax.legend()
        plt.tight_layout()
        file_path = self._get_chart_path("personal_scatter")
        plt.savefig(file_path, dpi=150, bbox_inches='tight')
        plt.close()
        drilldown_config = {
            "type": "by_record",
            "click_field": "人员",
            "query": "SELECT * FROM personal_df WHERE 人员 = ? AND 声部 = ?",
            "record_id_field": "_record_id"
        }
        chart_id = self._record_chart(
            chart_type="scatter",
            chart_title="个人综合得分分布",
            file_path=file_path,
            data_query="personal_scores",
            drilldown_config=drilldown_config
        )
        return chart_id

    def generate_trend_chart(self, trend_df: pd.DataFrame) -> Optional[str]:
        """生成排练时间趋势图"""
        if trend_df.empty or "排练日期" not in trend_df.columns:
            return None
        fig, ax = plt.subplots(figsize=(10, 6))
        sections = trend_df["声部"].unique().tolist()
        for section in sections:
            section_data = trend_df[trend_df["声部"] == section].sort_values("排练日期")
            ax.plot(section_data["排练日期"], section_data["当日平均分"],
                   'o-', label=section, linewidth=2, markersize=8)
            for _, row in section_data.iterrows():
                if pd.notna(row.get("环比变化率")) and row["环比变化率"] < -10:
                    ax.annotate(f'▼{row["环比变化率"]:.0f}%',
                               (row["排练日期"], row["当日平均分"]),
                               textcoords="offset points", xytext=(0, -15),
                               ha='center', fontsize=9, color='red')
        ax.set_xlabel('排练日期')
        ax.set_ylabel('当日平均分')
        ax.set_title('各声部排练得分趋势')
        ax.legend()
        plt.xticks(rotation=45)
        plt.tight_layout()
        file_path = self._get_chart_path("trend")
        plt.savefig(file_path, dpi=150, bbox_inches='tight')
        plt.close()
        drilldown_config = {
            "type": "by_date_section",
            "click_field": "日期+声部",
            "query": "SELECT 人员, 个人综合分 FROM personal_df WHERE 排练日期 = ? AND 声部 = ?",
            "detail_columns": ["人员", "个人综合分"]
        }
        chart_id = self._record_chart(
            chart_type="line",
            chart_title="各声部排练得分趋势",
            file_path=file_path,
            data_query="trend_metrics",
            drilldown_config=drilldown_config
        )
        return chart_id

    def generate_anomaly_chart(self, anomaly_summary: Dict) -> str:
        """生成异常分布饼图 - 确保例外不会消失"""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
        type_data = anomaly_summary.get("by_type", {})
        if type_data:
            labels = [v["name"] for v in type_data.values()]
            sizes = [v["count"] for v in type_data.values()]
            colors = ['#e74c3c', '#f39c12', '#3498db', '#2ecc71', '#9b59b6', '#1abc9c']
            wedges, texts, autotexts = ax1.pie(sizes, labels=labels, autopct='%1.0f%%',
                                               colors=colors[:len(labels)], startangle=90)
            for autotext in autotexts:
                autotext.set_color('white')
                autotext.set_fontsize(10)
            ax1.set_title('异常类型分布')
        severity_data = anomaly_summary.get("by_severity", {})
        if severity_data:
            labels = ["高", "中", "低"]
            sizes = [severity_data.get("high", 0), severity_data.get("medium", 0), severity_data.get("low", 0)]
            colors = ['#e74c3c', '#f39c12', '#2ecc71']
            if sum(sizes) > 0:
                wedges, texts, autotexts = ax2.pie(sizes, labels=labels, autopct='%1.0f%%',
                                                   colors=colors, startangle=90)
                for autotext in autotexts:
                    autotext.set_color('white')
                    autotext.set_fontsize(10)
            ax2.set_title('异常严重程度分布')
        fig.suptitle(f'异常检测汇总（共{anomaly_summary.get("total", 0)}个异常）', fontsize=14)
        plt.tight_layout()
        file_path = self._get_chart_path("anomalies")
        plt.savefig(file_path, dpi=150, bbox_inches='tight')
        plt.close()
        drilldown_config = {
            "type": "by_anomaly_type",
            "click_field": "异常类型",
            "query": "SELECT anomaly_type, severity, description, anomaly_values FROM anomalies WHERE anomaly_type = ?",
            "detail_columns": ["异常类型", "严重程度", "描述", "相关数值"]
        }
        chart_id = self._record_chart(
            chart_type="pie",
            chart_title="异常检测汇总",
            file_path=file_path,
            data_query="anomaly_summary",
            drilldown_config=drilldown_config
        )
        return chart_id

    def generate_all_charts(self, calc_results: Dict[str, Any],
                            anomaly_summary: Dict) -> Dict[str, Any]:
        """生成所有图表"""
        charts_generated = {}
        section_metrics = calc_results.get("section_metrics", pd.DataFrame())
        personal_df = calc_results.get("personal_scores", pd.DataFrame())
        attendance_df = calc_results.get("attendance_metrics", pd.DataFrame())
        trend_df = calc_results.get("trend_metrics", pd.DataFrame())
        if not section_metrics.empty:
            charts_generated["section_scores"] = self.generate_section_score_chart(section_metrics, personal_df)
            charts_generated["radar"] = self.generate_radar_chart(section_metrics, personal_df)
        if not personal_df.empty:
            charts_generated["personal_scatter"] = self.generate_personal_scatter(personal_df)
        if not attendance_df.empty:
            chart_id = self.generate_attendance_chart(attendance_df)
            if chart_id:
                charts_generated["attendance"] = chart_id
        if not trend_df.empty:
            chart_id = self.generate_trend_chart(trend_df)
            if chart_id:
                charts_generated["trend"] = chart_id
        charts_generated["anomalies"] = self.generate_anomaly_chart(anomaly_summary)
        self.db.log_audit(
            "generate_charts",
            {"chart_count": len(charts_generated), "chart_types": list(charts_generated.keys())},
            batch_id=self.batch_id
        )
        return {
            "chart_ids": charts_generated,
            "chart_list": self.charts,
            "count": len(self.charts)
        }

    def get_chart_drilldown(self, chart_id: str, click_value: str,
                            personal_df: pd.DataFrame) -> pd.DataFrame:
        """获取图表下钻的明细数据"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT drilldown_config FROM {CHARTS_TABLE} WHERE id = ?",
            (chart_id,)
        )
        row = cursor.fetchone()
        if not row:
            return pd.DataFrame()
        config = json.loads(row['drilldown_config'])
        drilldown_type = config.get("type", "")
        if drilldown_type == "by_section":
            return personal_df[personal_df["声部"] == click_value]
        elif drilldown_type == "by_record":
            return personal_df[personal_df["人员"] == click_value]
        elif drilldown_type == "by_category":
            field = click_value
            if field in personal_df.columns:
                return personal_df[["声部", "人员", field]].sort_values(field, ascending=False)
        elif drilldown_type == "by_date_section":
            parts = click_value.split("|")
            if len(parts) == 2:
                return personal_df[
                    (personal_df["排练日期"] == parts[0]) &
                    (personal_df["声部"] == parts[1])
                ]
        return pd.DataFrame()

    def load_charts_from_db(self) -> List[Dict]:
        """从数据库加载本批次的图表数据"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT * FROM {CHARTS_TABLE} WHERE batch_id = ? ORDER BY created_at",
            (self.batch_id,)
        )
        rows = cursor.fetchall()
        charts = []
        for row in rows:
            charts.append({
                "id": row["id"],
                "chart_type": row["chart_type"],
                "chart_title": row["chart_title"],
                "file_path": row["file_path"],
                "drilldown_config": json.loads(row["drilldown_config"]) if row["drilldown_config"] else {}
            })
        self.charts = charts
        return charts

    def export_charts_data(self, output_dir: Optional[str] = None) -> str:
        """导出图表数据和下钻配置，用于复查"""
        import json
        if output_dir is None:
            from .config import EXPORTS_DIR
            output_dir = str(EXPORTS_DIR)
        if not self.charts:
            self.load_charts_from_db()
        output_path = Path(output_dir) / f"{self.batch_id}_charts_data.json"
        export_data = {
            "batch_id": self.batch_id,
            "generated_at": datetime.now().isoformat(),
            "charts": []
        }
        for chart in self.charts:
            export_data["charts"].append({
                "id": chart["id"],
                "type": chart["chart_type"],
                "title": chart["chart_title"],
                "file_path": chart["file_path"],
                "drilldown_config": chart["drilldown_config"]
            })
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        return str(output_path)
