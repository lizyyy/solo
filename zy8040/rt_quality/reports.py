import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from typing import Dict


def df_to_markdown(df: pd.DataFrame) -> str:
    """将DataFrame转换为Markdown表格，不依赖额外库"""
    if df.empty:
        return ""
    
    # 格式化数值列
    df_formatted = df.copy()
    for col in df_formatted.columns:
        if pd.api.types.is_numeric_dtype(df_formatted[col]):
            df_formatted[col] = df_formatted[col].apply(
                lambda x: f"{x:.2f}" if isinstance(x, float) else str(x)
            )
    
    # 获取所有值为字符串
    values = df_formatted.astype(str).values.tolist()
    headers = df_formatted.columns.tolist()
    
    # 计算每列宽度
    col_widths = [
        max(len(str(h)) for h in [header] + [row[i] for row in values])
        for i, header in enumerate(headers)
    ]
    
    # 构建表格
    lines = []
    
    # 表头
    header_line = "| " + " | ".join(
        f"{h:<{w}}" for h, w in zip(headers, col_widths)
    ) + " |"
    lines.append(header_line)
    
    # 分隔线
    sep_line = "| " + " | ".join("-" * w for w in col_widths) + " |"
    lines.append(sep_line)
    
    # 数据行
    for row in values:
        data_line = "| " + " | ".join(
            f"{v:<{w}}" for v, w in zip(row, col_widths)
        ) + " |"
        lines.append(data_line)
    
    return "\n".join(lines)


def generate_markdown_report(
    subjects_df: pd.DataFrame,
    exclusion_stats: Dict,
    condition_summary: pd.DataFrame,
    subject_stats: pd.DataFrame,
    output_dir: Path
) -> str:
    report = []
    report.append("# 反应时实验数据质检报告\n")
    report.append(f"生成时间: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    report.append("\n## 数据概览\n")
    report.append(f"- 被试数量: {len(subjects_df)}\n")
    report.append(f"- 原始 Trial 数: {exclusion_stats['total_original']}\n")
    report.append(f"- 清洗后 Trial 数: {exclusion_stats['total_cleaned']}\n")
    report.append(f"- 总剔除率: {exclusion_stats['exclusion_rate']:.2f}%\n")
    
    report.append("\n## 剔除原因统计\n")
    for reason, count in exclusion_stats['by_reason'].items():
        rate = (count / exclusion_stats['total_original']) * 100
        report.append(f"- {reason}: {count} ({rate:.2f}%)\n")
    
    report.append("\n## 条件汇总统计\n")
    report.append(df_to_markdown(condition_summary))
    
    report.append("\n## 被试统计（前10条）\n")
    report.append(df_to_markdown(subject_stats.head(10)))
    
    report_path = output_dir / "quality_report.md"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
    
    return str(report_path)


def generate_condition_plot(
    condition_summary: pd.DataFrame,
    output_dir: Path
) -> str:
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    sns.barplot(data=condition_summary, x='condition', y='mean_rt', ax=axes[0], color='steelblue')
    axes[0].errorbar(
        x=range(len(condition_summary)),
        y=condition_summary['mean_rt'],
        yerr=condition_summary['se_rt'],
        fmt='none',
        color='black',
        capsize=5
    )
    axes[0].set_title('各条件平均反应时')
    axes[0].set_ylabel('反应时 (ms)')
    
    sns.barplot(data=condition_summary, x='condition', y='mean_accuracy', ax=axes[1], color='seagreen')
    axes[1].errorbar(
        x=range(len(condition_summary)),
        y=condition_summary['mean_accuracy'],
        yerr=condition_summary['se_accuracy'],
        fmt='none',
        color='black',
        capsize=5
    )
    axes[1].set_title('各条件准确率')
    axes[1].set_ylabel('准确率 (%)')
    axes[1].set_ylim(0, 105)
    
    plt.tight_layout()
    plot_path = output_dir / "condition_comparison.png"
    plt.savefig(plot_path, dpi=150, bbox_inches='tight')
    plt.close()
    
    return str(plot_path)


def save_excluded_trials(excluded_df: pd.DataFrame, output_dir: Path) -> str:
    output_path = output_dir / "excluded_trials.csv"
    excluded_df.to_csv(output_path, index=False, encoding='utf-8-sig')
    return str(output_path)
