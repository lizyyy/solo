import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, date
from io import BytesIO, StringIO


class Exporter:
    def __init__(self):
        pass

    def export_csv(self, df: pd.DataFrame) -> str:
        if df.empty:
            return ''
        return df.to_csv(index=False, encoding='utf-8-sig')

    def generate_markdown_report(
        self,
        daily_df: pd.DataFrame,
        material_df: pd.DataFrame,
        anomalies: Dict,
        report_date: Optional[date] = None,
        report_title: str = "短视频投放复盘报告"
    ) -> str:
        if report_date is None:
            report_date = datetime.now().date()
        
        lines = []
        
        lines.append(f"# {report_title}")
        lines.append(f"**生成时间**: {report_date}")
        lines.append("")
        
        lines.append("## 一、数据概览")
        lines.append("")
        
        if not daily_df.empty:
            total_spend = daily_df['spend'].sum()
            total_impression = daily_df['impression'].sum()
            total_click = daily_df['click'].sum()
            total_conversion = daily_df['conversion'].sum()
            total_revenue = daily_df.get('revenue', pd.Series([0])).sum()
            
            avg_ctr = total_click / total_impression * 100 if total_impression > 0 else 0
            avg_cpc = total_spend / total_click if total_click > 0 else 0
            avg_cpa = total_spend / total_conversion if total_conversion > 0 else 0
            avg_roi = total_revenue / total_spend if total_spend > 0 else 0
            
            lines.append("### 整体指标")
            lines.append("")
            lines.append("| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 总花费 | ¥{total_spend:,.2f} |")
            lines.append(f"| 总曝光 | {total_impression:,} |")
            lines.append(f"| 总点击 | {total_click:,} |")
            lines.append(f"| 总转化 | {total_conversion:,} |")
            lines.append(f"| 总成交金额 | ¥{total_revenue:,.2f} |")
            lines.append(f"| 平均CTR | {avg_ctr:.2f}% |")
            lines.append(f"| 平均CPC | ¥{avg_cpc:.2f} |")
            lines.append(f"| 平均CPA | ¥{avg_cpa:.2f} |")
            lines.append(f"| 平均ROI | {avg_roi:.2f} |")
            lines.append("")
            
            lines.append("### 平台分布")
            lines.append("")
            
            platform_summary = daily_df.groupby('platform').agg({
                'spend': 'sum',
                'impression': 'sum',
                'click': 'sum',
                'conversion': 'sum',
                'revenue': 'sum'
            }).reset_index()
            
            platform_summary['ctr'] = np.where(
                platform_summary['impression'] > 0,
                platform_summary['click'] / platform_summary['impression'] * 100,
                0
            )
            platform_summary['cpc'] = np.where(
                platform_summary['click'] > 0,
                platform_summary['spend'] / platform_summary['click'],
                0
            )
            platform_summary['cpa'] = np.where(
                platform_summary['conversion'] > 0,
                platform_summary['spend'] / platform_summary['conversion'],
                0
            )
            platform_summary['roi'] = np.where(
                platform_summary['spend'] > 0,
                platform_summary['revenue'] / platform_summary['spend'],
                0
            )
            
            lines.append("| 平台 | 花费 | 转化 | CTR | CPC | CPA | ROI |")
            lines.append("|------|------|------|-----|-----|-----|-----|")
            for _, row in platform_summary.iterrows():
                lines.append(f"| {row['platform']} | ¥{row['spend']:,.2f} | {row['conversion']:,} | {row['ctr']:.2f}% | ¥{row['cpc']:.2f} | ¥{row['cpa']:.2f} | {row['roi']:.2f} |")
            lines.append("")
        else:
            lines.append("暂无数据")
            lines.append("")
        
        lines.append("## 二、素材分析")
        lines.append("")
        
        if not material_df.empty:
            lines.append("### Top 5 高花费素材")
            lines.append("")
            top_spend = material_df.nlargest(5, 'total_spend')
            lines.append("| 素材ID | 平台 | 总花费 | 总转化 | ROI | 投放天数 | 疲劳度 |")
            lines.append("|--------|------|--------|--------|-----|----------|--------|")
            for _, row in top_spend.iterrows():
                fatigue_status = "已疲劳" if row.get('is_fatigued', False) else "正常"
                lines.append(f"| {row['material_id']} | {row['platform']} | ¥{row['total_spend']:,.2f} | {row['total_conversion']:,} | {row['avg_roi']:.2f} | {row['days_active']}天 | {fatigue_status} |")
            lines.append("")
            
            lines.append("### Top 5 高ROI素材")
            lines.append("")
            top_roi = material_df[material_df['total_spend'] > 0].nlargest(5, 'avg_roi')
            lines.append("| 素材ID | 平台 | 总花费 | 总转化 | ROI | 投放天数 |")
            lines.append("|--------|------|--------|--------|-----|----------|")
            for _, row in top_roi.iterrows():
                lines.append(f"| {row['material_id']} | {row['platform']} | ¥{row['total_spend']:,.2f} | {row['total_conversion']:,} | {row['avg_roi']:.2f} | {row['days_active']}天 |")
            lines.append("")
            
            if 'fatigue_score' in material_df.columns:
                fatigued = material_df[material_df.get('is_fatigued', False)]
                if not fatigued.empty:
                    lines.append("### 疲劳素材预警")
                    lines.append("")
                    lines.append(f"**发现 {len(fatigued)} 个疲劳素材**")
                    lines.append("")
                    lines.append("| 素材ID | 平台 | 疲劳度得分 | 投放天数 |")
                    lines.append("|--------|------|------------|----------|")
                    for _, row in fatigued.iterrows():
                        lines.append(f"| {row['material_id']} | {row['platform']} | {row['fatigue_score']:.2f} | {row['days_active']}天 |")
                    lines.append("")
        else:
            lines.append("暂无素材数据")
            lines.append("")
        
        lines.append("## 三、异常检测")
        lines.append("")
        
        anomaly_count = sum(len(v) for v in anomalies.values())
        if anomaly_count > 0:
            lines.append(f"**共发现 {anomaly_count} 个异常情况**")
            lines.append("")
            
            if anomalies.get('spend_surge'):
                lines.append("### 花费突增")
                lines.append("")
                lines.append("| 日期 | 平台 | 当前花费 | 基准花费 | 变化率 | 严重程度 |")
                lines.append("|------|------|----------|----------|--------|----------|")
                for a in anomalies['spend_surge']:
                    lines.append(f"| {a.date} | {a.platform} | ¥{a.current_value:,.2f} | ¥{a.baseline_value:,.2f} | {a.change_pct:+.2f}% | {a.severity} |")
                lines.append("")
            
            if anomalies.get('conversion_cliff'):
                lines.append("### 转化断崖")
                lines.append("")
                lines.append("| 日期 | 平台 | 当前转化 | 基准转化 | 变化率 | 严重程度 |")
                lines.append("|------|------|----------|----------|--------|----------|")
                for a in anomalies['conversion_cliff']:
                    lines.append(f"| {a.date} | {a.platform} | {a.current_value:,} | {a.baseline_value:,} | {a.change_pct:+.2f}% | {a.severity} |")
                lines.append("")
            
            if anomalies.get('low_roi'):
                lines.append("### ROI过低")
                lines.append("")
                lines.append("| 素材ID | 平台 | 当前ROI | 阈值 | 花费 |")
                lines.append("|--------|------|---------|------|------|")
                for a in anomalies['low_roi']:
                    lines.append(f"| {a.material_id} | {a.platform} | {a.current_value:.2f} | {a.baseline_value:.2f} | ¥{a.details.get('total_spend', 0):,.2f} |")
                lines.append("")
            
            if anomalies.get('high_cpa'):
                lines.append("### CPA过高")
                lines.append("")
                lines.append("| 素材ID | 平台 | 当前CPA | 阈值 | 花费 | 转化 |")
                lines.append("|--------|------|---------|------|------|------|")
                for a in anomalies['high_cpa']:
                    lines.append(f"| {a.material_id} | {a.platform} | ¥{a.current_value:.2f} | ¥{a.baseline_value:.2f} | ¥{a.details.get('total_spend', 0):,.2f} | {a.details.get('total_conversion', 0):,} |")
                lines.append("")
            
            if anomalies.get('cross_platform_diff'):
                lines.append("### 跨平台表现差异")
                lines.append("")
                lines.append("| 素材ID | 较差平台 | 较好平台 | 当前ROI | 较好ROI | 差异率 |")
                lines.append("|--------|----------|----------|---------|---------|--------|")
                seen = set()
                for a in anomalies['cross_platform_diff']:
                    key = f"{a.material_id}_{a.platform}_{a.details.get('better_platform')}"
                    if key not in seen:
                        seen.add(key)
                        lines.append(f"| {a.material_id} | {a.platform} | {a.details.get('better_platform')} | {a.current_value:.2f} | {a.baseline_value:.2f} | {a.change_pct:+.2f}% |")
                lines.append("")
        else:
            lines.append("未发现异常情况")
            lines.append("")
        
        lines.append("## 四、复盘建议")
        lines.append("")
        
        suggestions = []
        
        if anomalies.get('spend_surge'):
            suggestions.append("- 关注花费突增的平台和日期，检查是否是预算设置问题或素材流量异常")
        
        if anomalies.get('conversion_cliff'):
            suggestions.append("- 转化断崖的日期需要重点关注，可能是页面问题、库存问题或目标人群变化")
        
        if material_df.empty is False and 'fatigue_score' in material_df.columns:
            fatigued_count = len(material_df[material_df.get('is_fatigued', False)])
            if fatigued_count > 0:
                suggestions.append(f"- 有 {fatigued_count} 个素材已疲劳，建议及时更换或优化素材创意")
        
        if anomalies.get('low_roi'):
            suggestions.append("- ROI过低的素材建议暂停投放或优化着陆页转化能力")
        
        if anomalies.get('cross_platform_diff'):
            suggestions.append("- 同一素材在不同平台表现差异大，建议针对性调整投放策略，或将预算向表现好的平台倾斜")
        
        if suggestions:
            for s in suggestions:
                lines.append(s)
        else:
            lines.append("- 整体表现稳定，建议继续观察并逐步优化投放策略")
        
        lines.append("")
        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)

    def generate_summary_csv(
        self,
        daily_df: pd.DataFrame,
        material_df: pd.DataFrame
    ) -> Dict[str, str]:
        outputs = {}
        
        if not daily_df.empty:
            daily_export = daily_df.copy()
            if 'date' in daily_export.columns:
                daily_export['date'] = pd.to_datetime(daily_export['date']).dt.strftime('%Y-%m-%d')
            outputs['daily_metrics.csv'] = daily_export.to_csv(index=False, encoding='utf-8-sig')
        
        if not material_df.empty:
            outputs['material_metrics.csv'] = material_df.to_csv(index=False, encoding='utf-8-sig')
        
        if not daily_df.empty:
            platform_summary = daily_df.groupby('platform').agg({
                'spend': 'sum',
                'impression': 'sum',
                'click': 'sum',
                'conversion': 'sum',
                'revenue': 'sum'
            }).reset_index()
            
            platform_summary['ctr'] = np.where(
                platform_summary['impression'] > 0,
                (platform_summary['click'] / platform_summary['impression'] * 100).round(2),
                0
            )
            platform_summary['cpc'] = np.where(
                platform_summary['click'] > 0,
                (platform_summary['spend'] / platform_summary['click']).round(2),
                0
            )
            platform_summary['cpa'] = np.where(
                platform_summary['conversion'] > 0,
                (platform_summary['spend'] / platform_summary['conversion']).round(2),
                0
            )
            platform_summary['roi'] = np.where(
                platform_summary['spend'] > 0,
                (platform_summary['revenue'] / platform_summary['spend']).round(2),
                0
            )
            
            outputs['platform_summary.csv'] = platform_summary.to_csv(index=False, encoding='utf-8-sig')
        
        return outputs
