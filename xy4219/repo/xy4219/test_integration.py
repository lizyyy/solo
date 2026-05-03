#!/usr/bin/env python3
# -*- coding: utf-8 -*-

print('=== 开始集成测试 ===\n')

# 1. 生成示例数据
from sample_data import SampleDataGenerator
generator = SampleDataGenerator()
sample_data = generator.get_all_sample_data()
print(f'1. 生成示例数据:')
for platform, df in sample_data.items():
    print(f'   - {platform}: {len(df)} 条记录')

# 2. 解析数据
from data_parser import DataParser
parser = DataParser()

ad_data_list = []
for platform in ['抖音', '小红书', '视频号']:
    if platform in sample_data:
        df = sample_data[platform]
        ad_data_list.append((platform, df))
        print(f'\n2. 准备 {platform} 数据:')
        print(f'   - 原始字段: {list(df.columns)}')

transaction_df = sample_data.get('成交数据')
combined, _ = parser.merge_all_data(ad_data_list, transaction_df)
print(f'\n3. 合并数据完成: 共 {len(combined)} 条记录')
print(f'   - 合并后字段: {list(combined.columns)}')

# 3. 计算指标
from metrics_calculator import MetricsCalculator
calculator = MetricsCalculator()
combined_with_metrics = calculator.calculate_basic_metrics(combined)
daily_metrics = calculator.aggregate_by_date(combined_with_metrics)
material_metrics = calculator.aggregate_by_material(combined_with_metrics)
material_metrics = calculator.calculate_fatigue(combined_with_metrics, material_metrics)
summary = calculator.get_overall_summary(combined_with_metrics)

print(f'\n4. 指标计算完成:')
print(f'   - 每日指标: {len(daily_metrics)} 条')
print(f'   - 素材指标: {len(material_metrics)} 条')
print(f'   - 总花费: ¥{summary["total_spend"]:,.2f}')
print(f'   - 总转化: {summary["total_conversion"]:,}')
print(f'   - 平均ROI: {summary["avg_roi"]:.2f}')

# 4. 异常检测
from rule_engine import RuleEngine
rule_engine = RuleEngine()
anomalies = rule_engine.detect_all_anomalies(daily_metrics, material_metrics)

total_anomalies = sum(len(v) for v in anomalies.values())
print(f'\n5. 异常检测完成:')
print(f'   - 共发现 {total_anomalies} 个异常')
for anomaly_type, anomaly_list in anomalies.items():
    if anomaly_list:
        print(f'   - {anomaly_type}: {len(anomaly_list)} 个')

# 5. 导出测试
from exporter import Exporter
exporter = Exporter()
markdown = exporter.generate_markdown_report(daily_metrics, material_metrics, anomalies)
csv_outputs = exporter.generate_summary_csv(daily_metrics, material_metrics)

print(f'\n6. 导出功能测试:')
print(f'   - Markdown报告: {len(markdown)} 字符')
for filename, csv_content in csv_outputs.items():
    print(f'   - {filename}: {len(csv_content)} 字符')

# 6. 可视化测试
from visualization import Visualizer
visualizer = Visualizer()
spend_chart = visualizer.create_spend_trend_chart(daily_metrics)
roi_chart = visualizer.create_roi_trend_chart(daily_metrics)
material_chart = visualizer.create_material_ranking_chart(material_metrics, 'total_spend')

print(f'\n7. 可视化测试:')
print(f'   - 花费趋势图: 成功生成')
print(f'   - ROI趋势图: 成功生成')
print(f'   - 素材排名图: 成功生成')

# 8. 显示素材数据
print(f'\n8. 素材数据预览:')
print(material_metrics[['material_id', 'platform', 'total_spend', 'total_conversion', 
                         'avg_roi', 'fatigue_score', 'is_fatigued']].head(10))

# 9. 显示异常详细
if total_anomalies > 0:
    print(f'\n9. 异常明细:')
    anomaly_df = rule_engine.anomalies_to_dataframe(anomalies)
    print(anomaly_df)

print('\n=== 集成测试完成，所有功能正常！ ===')
