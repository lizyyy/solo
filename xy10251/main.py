import os
import sys
import argparse
from datetime import datetime

from data_model import BinManager, DropRecord
from holiday_feature import enrich_records_with_holiday_features
from anomaly_detector import run_all_anomaly_checks, apply_anomaly_flags
from predictor import run_full_prediction
from report_generator import generate_full_report


def run_complete_pipeline(records_csv_path, prediction_date, output_dir='output'):
    print('=' * 60)
    print('   社区垃圾分类桶满溢预测器')
    print('   预测基准日期:', prediction_date)
    print('=' * 60)

    print('\n[1/5] 加载数据模型和投放记录...')
    bin_manager = BinManager()
    print(f'      - 已加载 {len(bin_manager.get_all_bins())} 个垃圾桶元数据')

    records = DropRecord()
    if os.path.exists(records_csv_path):
        record_count = records.load_from_csv(records_csv_path)
        print(f'      - 已加载 {record_count} 条投放记录')
    else:
        print(f'      [警告] 记录文件不存在: {records_csv_path}')
        return None

    print('\n[2/5] 提取节假日特征...')
    enriched_df = enrich_records_with_holiday_features(records.df)
    holiday_count = len(enriched_df[enriched_df['date_type'] == 'holiday'])
    weekend_count = len(enriched_df[enriched_df['date_type'] == 'weekend'])
    workday_count = len(enriched_df[enriched_df['date_type'] == 'workday'])
    print(f'      - 节假日记录: {holiday_count} 条')
    print(f'      - 周末记录: {weekend_count} 条')
    print(f'      - 工作日记录: {workday_count} 条')

    print('\n[3/5] 异常检测（重复提交/状态冲突/记录缺失）...')
    start_date = enriched_df['date_only'].min() if len(enriched_df) > 0 else None
    end_date = enriched_df['date_only'].max() if len(enriched_df) > 0 else None

    anomaly_results = run_all_anomaly_checks(
        enriched_df, bin_manager, start_date, end_date
    )

    dup_count = len(anomaly_results.get('duplicates', []))
    conflict_count = len(anomaly_results.get('conflicts', []))
    missing_count = len(anomaly_results.get('missing', []))

    print(f'      - 检测到重复提交: {dup_count} 对')
    print(f'      - 检测到状态冲突: {conflict_count} 条')
    print(f'      - 检测到记录缺失: {missing_count} 个桶/天')

    cleaned_df = apply_anomaly_flags(enriched_df, anomaly_results)
    valid_count = len(cleaned_df[cleaned_df['status'] == 'valid'])
    total_count = len(cleaned_df)
    print(f'      - 有效记录: {valid_count}/{total_count} ({valid_count/total_count*100:.1f}%)')

    print('\n[4/5] 满溢预测与清运优先级计算...')
    prediction_df = run_full_prediction(bin_manager, cleaned_df, prediction_date)

    critical = len(prediction_df[prediction_df['priority'] == 'critical'])
    high = len(prediction_df[prediction_df['priority'] == 'high'])
    medium = len(prediction_df[prediction_df['priority'] == 'medium'])
    low = len(prediction_df[prediction_df['priority'] == 'low'])

    print(f'      - 紧急 (Critical): {critical} 个')
    print(f'      - 高 (High): {high} 个')
    print(f'      - 中 (Medium): {medium} 个')
    print(f'      - 低 (Low): {low} 个')

    print('\n[5/5] 生成报表...')
    outputs = generate_full_report(
        prediction_df, anomaly_results, output_dir, prediction_date
    )

    print('\n' + '=' * 60)
    print('   分析完成！输出文件：')
    print('=' * 60)
    print(f'   详细报告: {outputs["report"]}')
    print(f'   优先级表格: {outputs["priority_table"]}')
    print(f'   分析图表: {outputs["chart"]}')
    if outputs['anomaly_summary']:
        print(f'   异常汇总: {outputs["anomaly_summary"]}')

    print('\n' + '=' * 60)
    print('   【清运优先级 Top 3】')
    print('=' * 60)
    top3 = prediction_df.head(3)
    for idx, row in top3.iterrows():
        priority_label = {
            'critical': '紧急',
            'high': '高',
            'medium': '中',
            'low': '低'
        }.get(row['priority'], row['priority'])

        status = '即将满溢' if row['will_overflow_in_window'] else '当前安全'
        overflow_info = f"（预计 {row['first_overflow_date']} {row['first_overflow_day_name']} 满溢）" if row['will_overflow_in_window'] else ''

        print(f'   {idx + 1}. {row["bin_id"]} [{row["garbage_type"]}]')
        print(f'      位置: {row["community"]} - {row["zone"]}')
        print(f'      优先级: {priority_label} ({row["priority_score"]}分)')
        print(f'      当前填充率: {row["current_ratio"] * 100:.1f}%')
        print(f'      状态: {status}{overflow_info}')
        print()

    return outputs


def main():
    parser = argparse.ArgumentParser(description='社区垃圾分类桶满溢预测器')
    parser.add_argument('--records', default='data/sample_records.csv',
                        help='投放记录CSV文件路径')
    parser.add_argument('--date', default='2026-05-01',
                        help='预测基准日期 (YYYY-MM-DD)')
    parser.add_argument('--output', default='output',
                        help='输出目录')
    parser.add_argument('--generate-sample', action='store_true',
                        help='先生成样例数据再运行')

    args = parser.parse_args()

    if args.generate_sample:
        print('生成样例数据...')
        from generate_sample_data import generate_sample_records
        os.makedirs('data', exist_ok=True)
        count = generate_sample_records('data/sample_records.csv')
        print(f'已生成 {count} 条样例记录\n')

    run_complete_pipeline(args.records, args.date, args.output)


if __name__ == '__main__':
    main()
