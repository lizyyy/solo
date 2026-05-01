import argparse
from pathlib import Path
from .data_loader import load_all
from .cleaning import clean_trials
from .stats import (
    compute_subject_stats,
    compute_condition_stats,
    compute_condition_summary,
    compute_exclusion_rates
)
from .reports import (
    generate_markdown_report,
    generate_condition_plot,
    save_excluded_trials
)


def main():
    parser = argparse.ArgumentParser(
        description="心理学反应时实验数据质检与统计报告工具"
    )
    parser.add_argument(
        "--subjects",
        required=True,
        help="被试信息CSV文件路径"
    )
    parser.add_argument(
        "--trials",
        required=True,
        help="Trial级反应时CSV文件路径"
    )
    parser.add_argument(
        "--design",
        required=True,
        help="实验设计YAML文件路径"
    )
    parser.add_argument(
        "--output-dir",
        default="output",
        help="输出目录 (默认: output)"
    )
    
    args = parser.parse_args()
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)
    
    print("=" * 60)
    print("反应时实验数据质检与统计报告工具")
    print("=" * 60)
    
    print("\n[1/5] 读取数据文件...")
    subjects_df, trials_df, design = load_all(
        args.subjects, args.trials, args.design
    )
    print(f"✓ 读取完成: {len(subjects_df)} 名被试, {len(trials_df)} 个 trial")
    
    print("\n[2/5] 数据清洗...")
    cleaned_trials, excluded_trials = clean_trials(trials_df, design)
    print(f"✓ 清洗完成: 保留 {len(cleaned_trials)} 个 trial")
    
    print("\n[3/5] 统计计算...")
    subject_stats = compute_subject_stats(cleaned_trials)
    condition_stats = compute_condition_stats(cleaned_trials)
    condition_summary = compute_condition_summary(cleaned_trials)
    exclusion_stats = compute_exclusion_rates(trials_df, cleaned_trials, excluded_trials)
    print("✓ 统计计算完成")
    
    print("\n[4/5] 生成报告和图表...")
    report_path = generate_markdown_report(
        subjects_df, exclusion_stats, condition_summary, subject_stats, output_dir
    )
    plot_path = generate_condition_plot(condition_summary, output_dir)
    excluded_path = save_excluded_trials(excluded_trials, output_dir)
    print("✓ 报告和图表生成完成")
    
    print("\n[5/5] 保存结果...")
    condition_stats_path = output_dir / "condition_stats.csv"
    subject_stats_path = output_dir / "subject_stats.csv"
    condition_summary_path = output_dir / "condition_summary.csv"
    
    condition_stats.to_csv(condition_stats_path, index=False, encoding='utf-8-sig')
    subject_stats.to_csv(subject_stats_path, index=False, encoding='utf-8-sig')
    condition_summary.to_csv(condition_summary_path, index=False, encoding='utf-8-sig')
    
    print("\n" + "=" * 60)
    print("处理完成! 输出文件:")
    print("=" * 60)
    print(f"  📄 质检报告: {report_path}")
    print(f"  📊 条件对比图: {plot_path}")
    print(f"  📋 剔除 trial: {excluded_path}")
    print(f"  📈 条件统计: {condition_stats_path}")
    print(f"  📉 被试统计: {subject_stats_path}")
    print(f"  📊 条件汇总: {condition_summary_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()
