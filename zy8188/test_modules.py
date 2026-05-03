#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from modules.data_loader import DataLoader
from modules.quality_analyzer import QualityAnalyzer
from modules.data_cleaner import DataCleaner
from modules.exporter import Exporter, ReviewManager

print("=" * 50)
print("测试模块导入...")
print("=" * 50)

print("✓ 所有模块导入成功!")

print("\n" + "=" * 50)
print("测试数据加载...")
print("=" * 50)

loader = DataLoader()
loader.load_batch_pages('sample_data/batch_pages.csv')
loader.load_ocr_tokens('sample_data/ocr_tokens.jsonl')
loader.load_template_rules('sample_data/template_rules.yaml')

print(f"✓ 数据加载成功!")
print(f"  - 案卷数: {len(loader.get_all_archive_ids())}")
print(f"  - 总页数: {len(loader.pages_df)}")
print(f"  - 总Token数: {len(loader.tokens_df)}")
print(f"  - 模板名称: {loader.template_rule.template_name}")
print(f"  - 关键字段数: {len(loader.template_rule.key_fields)}")

print("\n" + "=" * 50)
print("测试质量分析...")
print("=" * 50)

analyzer = QualityAnalyzer(loader)
analyzer.analyze_all()

quality_summary = analyzer.get_quality_summary()

print(f"✓ 质量分析完成!")
print(f"  - 问题案卷数: {quality_summary['archives_with_issues']}/{quality_summary['total_archives']}")
print(f"  - 问题页数: {quality_summary['pages_with_issues']}/{quality_summary['total_pages']}")
print(f"  - 需复核页数: {quality_summary['review_pages_count']}")
print(f"  - 缺页总数: {quality_summary['missing_pages_total']}")
print(f"  - 低置信度Token: {quality_summary['low_confidence_tokens']}")
print(f"  - 极低置信度Token: {quality_summary['critical_confidence_tokens']}")

print("\n" + "=" * 50)
print("测试脏数据清理...")
print("=" * 50)

cleaner = DataCleaner(loader)
cleaner.clean_all()

cleaning_summary = cleaner.get_cleaning_summary()

print(f"✓ 脏数据清理完成!")
print(f"  - 总问题数: {cleaning_summary['total_issues']}")
print(f"  - 缺页: {cleaning_summary['missing_pages_total']}")
print(f"  - 旋转页: {cleaning_summary['rotated_pages_total']}")
print(f"  - 坐标越界Token: {cleaning_summary['out_of_bounds_tokens_total']}")

if cleaning_summary['issue_types']:
    print(f"\n  问题类型分布:")
    for issue_type, count in cleaning_summary['issue_types'].items():
        print(f"    - {issue_type}: {count}")

print("\n" + "=" * 50)
print("测试复核管理器...")
print("=" * 50)

review_manager = ReviewManager()

review_manager.add_decision(
    archive_id='AJ2024_001',
    page_num=1,
    reviewed_by='测试员',
    decision='通过',
    comments='测试复核',
    corrected_fields={'日期': '2024-01-15'}
)

review_stats = review_manager.get_statistics()
print(f"✓ 复核管理器测试成功!")
print(f"  - 已复核页数: {review_stats['total_reviewed']}")

print("\n" + "=" * 50)
print("测试导出功能...")
print("=" * 50)

exporter = Exporter(loader, analyzer, cleaner, review_manager)

import os
os.makedirs('output', exist_ok=True)

report_path = exporter.export_review_report('output/review_report.md')
csv_path = exporter.export_issues_csv('output/issues.csv')

print(f"✓ 导出成功!")
print(f"  - 报告: {report_path}")
print(f"  - 问题清单: {csv_path}")

print("\n" + "=" * 50)
print("所有测试通过! ✓")
print("=" * 50)
