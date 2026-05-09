import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime
from config import OVERFLOW_THRESHOLD, PREDICTION_WINDOW_DAYS, HOLIDAY_MULTIPLIER, WEEKEND_MULTIPLIER, WORKDAY_MULTIPLIER


def generate_priority_table(prediction_df):
    table_df = prediction_df[[
        'bin_id', 'garbage_type', 'community', 'zone',
        'current_ratio', 'will_overflow_in_window',
        'first_overflow_date', 'first_overflow_day_name',
        'days_until_overflow', 'priority', 'priority_score', 'priority_reason'
    ]].copy()

    table_df['current_ratio_pct'] = (table_df['current_ratio'] * 100).round(1).astype(str) + '%'
    table_df['priority_score'] = table_df['priority_score'].round(1)

    def format_priority(p):
        if p == 'critical':
            return '紧急'
        elif p == 'high':
            return '高'
        elif p == 'medium':
            return '中'
        else:
            return '低'

    table_df['priority_label'] = table_df['priority'].apply(format_priority)

    return table_df


def generate_priority_chart(prediction_df, output_path):
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle('垃圾桶满溢预测与清运优先级分析', fontsize=16, fontweight='bold')

    ax1 = axes[0, 0]
    priority_order = ['critical', 'high', 'medium', 'low']
    priority_labels = ['紧急', '高', '中', '低']
    priority_colors = ['#e74c3c', '#e67e22', '#f39c12', '#27ae60']

    priority_counts = []
    for p in priority_order:
        count = len(prediction_df[prediction_df['priority'] == p])
        priority_counts.append(count)

    bars = ax1.bar(priority_labels, priority_counts, color=priority_colors)
    ax1.set_title('清运优先级分布')
    ax1.set_ylabel('垃圾桶数量')
    for bar, count in zip(bars, priority_counts):
        ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1,
                 str(count), ha='center', va='bottom')

    ax2 = axes[0, 1]
    overflow_bins = prediction_df[prediction_df['will_overflow_in_window']].copy()
    if len(overflow_bins) > 0:
        overflow_bins = overflow_bins.sort_values('days_until_overflow')
        x_labels = [f"{row['bin_id']}\n{row['garbage_type']}"
                    for _, row in overflow_bins.iterrows()]
        ax2.barh(x_labels, overflow_bins['days_until_overflow'], color='#e74c3c', alpha=0.7)
        ax2.set_xlabel('距离满溢天数')
        ax2.set_title('预测满溢时间线（天数越少越紧急）')
        ax2.invert_yaxis()
    else:
        ax2.text(0.5, 0.5, '预测窗口内无满溢风险', ha='center', va='center', fontsize=12)
        ax2.set_title('预测满溢时间线')

    ax3 = axes[1, 0]
    scatter = ax3.scatter(
        prediction_df['current_ratio'] * 100,
        prediction_df['priority_score'],
        c=prediction_df['priority_score'],
        cmap='RdYlGn_r',
        s=100,
        alpha=0.8
    )
    ax3.axvline(x=OVERFLOW_THRESHOLD * 100, color='red', linestyle='--', alpha=0.5, label='满溢阈值')
    ax3.set_xlabel('当前填充率 (%)')
    ax3.set_ylabel('优先级得分')
    ax3.set_title('填充率与优先级关系')
    ax3.legend()
    plt.colorbar(scatter, ax=ax3, label='优先级得分')

    ax4 = axes[1, 1]
    community_stats = prediction_df.groupby('community').agg({
        'bin_id': 'count',
        'will_overflow_in_window': 'sum'
    }).reset_index()
    community_stats.columns = ['community', 'total_bins', 'overflow_bins']
    community_stats['safe_bins'] = community_stats['total_bins'] - community_stats['overflow_bins']

    x_pos = np.arange(len(community_stats))
    width = 0.35
    ax4.bar(x_pos - width / 2, community_stats['safe_bins'], width,
            label='安全', color='#27ae60', alpha=0.7)
    ax4.bar(x_pos + width / 2, community_stats['overflow_bins'], width,
            label='预测满溢', color='#e74c3c', alpha=0.7)
    ax4.set_xticks(x_pos)
    ax4.set_xticklabels(community_stats['community'])
    ax4.set_ylabel('桶数量')
    ax4.set_title('各社区满溢风险分布')
    ax4.legend()

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close()

    return output_path


def generate_methodology_section():
    methodology = """
==================== 计算口径说明 ====================

【1. 节假日特征提取】
- 工作日基线：基于历史工作日日均投放量计算
- 日期乘数：
  * 法定节假日: x{HOLIDAY_MULTIPLIER}
  * 周末: x{WEEKEND_MULTIPLIER}
  * 工作日: x{WORKDAY_MULTIPLIER}

【2. 满溢预测模型】
- 预测窗口：未来{PREDICTION_WINDOW_DAYS}天
- 满溢阈值：填充率 >= {OVERFLOW_THRESHOLD_PCT}%
- 当前填充量 = 上次清运后所有有效记录之和
- 预测填充量 = 当前填充量 + Σ(工作日基线 × 当日乘数)

【3. 清运优先级评分（0-100分）】
- 紧急度分量：max(0, 30 - 距离满溢天数 × 10)
- 严重度分量：当前填充率 × 50
- 时间加成：节假日+20分，周末+10分

【4. 异常检测规则】
- 重复提交：同桶、同量、5分钟内出现
- 状态冲突：累计投放量超过桶容量的120%
- 记录缺失：某桶单日有效记录 < 3条

【5. 复核说明】
- 所有预测基于历史数据的统计特征
- 节假日乘数为经验值，建议根据实际情况微调
- 异常记录已从预测计算中排除，可在异常报告中详细审查
""".format(
        HOLIDAY_MULTIPLIER=HOLIDAY_MULTIPLIER,
        WEEKEND_MULTIPLIER=WEEKEND_MULTIPLIER,
        WORKDAY_MULTIPLIER=WORKDAY_MULTIPLIER,
        PREDICTION_WINDOW_DAYS=PREDICTION_WINDOW_DAYS,
        OVERFLOW_THRESHOLD_PCT=int(OVERFLOW_THRESHOLD * 100)
    )

    return methodology


def generate_full_report(prediction_df, anomaly_results, output_dir, prediction_date):
    import os
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    priority_table = generate_priority_table(prediction_df)
    table_path = os.path.join(output_dir, f'priority_table_{timestamp}.csv')
    priority_table.to_csv(table_path, index=False, encoding='utf-8-sig')

    chart_path = os.path.join(output_dir, f'priority_chart_{timestamp}.png')
    generate_priority_chart(prediction_df, chart_path)

    from anomaly_detector import generate_anomaly_summary
    anomaly_summary = generate_anomaly_summary(anomaly_results)
    anomaly_summary_path = os.path.join(output_dir, f'anomaly_summary_{timestamp}.csv')
    if len(anomaly_summary) > 0:
        anomaly_summary.to_csv(anomaly_summary_path, index=False, encoding='utf-8-sig')

    for key, df in anomaly_results.items():
        if len(df) > 0:
            detail_path = os.path.join(output_dir, f'anomaly_{key}_{timestamp}.csv')
            df.to_csv(detail_path, index=False, encoding='utf-8-sig')

    methodology = generate_methodology_section()

    report_content = f"""
================================================================================
                    社区垃圾分类桶满溢预测报告
                    预测基准日期：{prediction_date}
                    报告生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
================================================================================

{methodology}

================================================================================
                    【一、清运优先级汇总】
================================================================================

优先级分布：
  - 紧急 (Critical): {len(prediction_df[prediction_df['priority'] == 'critical'])} 个桶
  - 高 (High): {len(prediction_df[prediction_df['priority'] == 'high'])} 个桶
  - 中 (Medium): {len(prediction_df[prediction_df['priority'] == 'medium'])} 个桶
  - 低 (Low): {len(prediction_df[prediction_df['priority'] == 'low'])} 个桶

预测将满溢的桶（按优先级排序 Top 5）：
"""

    overflow_df = prediction_df[prediction_df['will_overflow_in_window']].head(5)
    for _, row in overflow_df.iterrows():
        report_content += f"""
  - {row['bin_id']} [{row['garbage_type']}] | {row['community']}-{row['zone']}
    优先级: {row['priority'].upper()} ({row['priority_score']}分)
    当前填充率: {row['current_ratio'] * 100:.1f}%
    预计满溢: {row['first_overflow_date']} ({row['first_overflow_day_name']})
    距离满溢: {row['days_until_overflow']} 天
"""

    report_content += """
================================================================================
                    【二、异常来源汇总】
================================================================================
"""

    if len(anomaly_summary) == 0:
        report_content += "  [OK] 本次分析未检测到异常记录\n"
    else:
        for _, row in anomaly_summary.iterrows():
            severity_icon = "!!!" if row['severity'] == 'high' else "!"
            report_content += f"  {severity_icon} {row['type_cn']}: {row['count']} 条 (严重度: {row['severity'].upper()})\n"

    report_content += f"""
================================================================================
                    【三、输出文件清单】
================================================================================

优先级表格（详细）: {table_path}
分析图表: {chart_path}
异常汇总: {anomaly_summary_path if len(anomaly_summary) > 0 else '无异常'}

================================================================================
                    【四、行动建议】
================================================================================

1. 立即关注【紧急】优先级的桶，建议在 24 小时内安排清运
2. 【高】优先级的桶纳入未来 2 天的清运计划
3. 节假日期间密切关注厨余垃圾桶（通常增量最大）
4. 复核异常记录，修正或删除后可重新运行预测

================================================================================
"""

    report_path = os.path.join(output_dir, f'full_report_{timestamp}.txt')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report_content)

    return {
        'priority_table': table_path,
        'chart': chart_path,
        'report': report_path,
        'anomaly_summary': anomaly_summary_path if len(anomaly_summary) > 0 else None
    }
