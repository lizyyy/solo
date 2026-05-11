#!/usr/bin/env python3
"""
异常路径演示

演示：
1. 异常数据录入（触发质量检查告警）
2. 记录撤回、补录、修改操作
3. 历史记录追踪（查看前后变化）
4. 处理异常后的预测生成
"""

import sys
from datetime import date, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.data_models import (
    TrainInfo,
    MealItem,
    SalesRecord,
    RecordStatus
)
from pipeline.data_processor import DataProcessor
from pipeline.quality_checker import DataPipeline, QualityChecker
from prediction.demand_forecaster import DemandForecaster
from reports.review_reporter import ReviewReporter


def main():
    print("=" * 60)
    print("铁路餐车备货预测器 - 异常路径演示")
    print("=" * 60)

    processor = DataProcessor()
    pipeline = DataPipeline()
    forecaster = DemandForecaster()
    reporter = ReviewReporter()

    print("\n【步骤 1】注册基础信息")
    print("-" * 40)
    
    train_g5678 = TrainInfo(
        train_number="G5678",
        route="上海虹桥-杭州东",
        departure_station="上海虹桥",
        arrival_station="杭州东",
        departure_time=time(10, 0),
        arrival_time=time(11, 15),
        total_capacity=800,
        operation_days=[1, 2, 3, 4, 5, 6, 7]
    )
    processor.register_train(train_g5678)
    print(f"✓ 已注册车次: {train_g5678.train_number}")

    meal_rice = MealItem(
        meal_id="ML004", 
        name="香菇滑鸡饭", 
        category="热食", 
        price=42.0, 
        shelf_life_hours=4
    )
    processor.register_meal(meal_rice)
    print(f"✓ 已注册餐品: {meal_rice.name}")

    print("\n【步骤 2】添加正常历史记录（3条）")
    print("-" * 40)
    
    normal_records = [
        SalesRecord(
            record_id="ABN001",
            train_id=train_g5678.train_id,
            train_number="G5678",
            meal_id="ML004",
            meal_name="香菇滑鸡饭",
            date=date(2026, 5, 1),
            departure_time=time(10, 0),
            segment="上海虹桥-嘉兴南",
            passenger_count=600,
            units_sold=25,
            initial_stock=35,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="ABN002",
            train_id=train_g5678.train_id,
            train_number="G5678",
            meal_id="ML004",
            meal_name="香菇滑鸡饭",
            date=date(2026, 5, 2),
            departure_time=time(10, 0),
            segment="嘉兴南-杭州东",
            passenger_count=650,
            units_sold=30,
            initial_stock=35,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="ABN003",
            train_id=train_g5678.train_id,
            train_number="G5678",
            meal_id="ML004",
            meal_name="香菇滑鸡饭",
            date=date(2026, 5, 3),
            departure_time=time(10, 0),
            segment="上海虹桥-嘉兴南",
            passenger_count=580,
            units_sold=28,
            initial_stock=35,
            was_sold_out=True,
            sold_out_time=time(10, 45)
        )
    ]
    
    for record in normal_records:
        processor.add_sales_record(record, actor="乘务员_002")
        print(f"✓ 已添加记录: {record.record_id}")

    print("\n【步骤 3】添加异常数据（触发质量检查告警）")
    print("-" * 40)
    
    anomalous_records = [
        SalesRecord(
            record_id="ABN004",
            train_id=train_g5678.train_id,
            train_number="G5678",
            meal_id="ML004",
            meal_name="香菇滑鸡饭",
            date=date(2026, 5, 4),
            departure_time=time(10, 0),
            segment="上海虹桥-杭州东",
            passenger_count=-50,
            units_sold=5,
            initial_stock=50,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="ABN005",
            train_id=train_g5678.train_id,
            train_number="G5678",
            meal_id="ML004",
            meal_name="香菇滑鸡饭",
            date=date(2026, 5, 5),
            departure_time=time(10, 0),
            segment="上海虹桥-杭州东",
            passenger_count=550,
            units_sold=60,
            initial_stock=50,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="ABN006",
            train_id=train_g5678.train_id,
            train_number="G5678",
            meal_id="ML004",
            meal_name="香菇滑鸡饭",
            date=date(2026, 5, 6),
            departure_time=time(10, 0),
            segment="上海虹桥-杭州东",
            passenger_count=520,
            units_sold=48,
            initial_stock=50,
            was_sold_out=False
        )
    ]
    
    for record in anomalous_records:
        processor.add_sales_record(record, actor="乘务员_002")
        print(f"✓ 已添加异常记录: {record.record_id}")
    
    print("\n【步骤 4】执行质量检查")
    print("-" * 40)
    
    all_records = processor.get_all_records()
    pipeline_result = pipeline.process(all_records)
    quality_report = pipeline_result['quality_report']
    
    print(f"总记录数: {quality_report.total_records}")
    print(f"正常样本: {quality_report.normal_samples}")
    print(f"缺失样本: {quality_report.missing_samples}")
    print(f"疑似误录: {quality_report.suspicious_samples}")
    
    if quality_report.suspicious_details:
        print("\n⚠️  发现疑似误录记录详情:")
        for detail in quality_report.suspicious_details:
            print(f"  - {detail['record_id']}: {detail['meal_name']} ({detail['date']})")
            for issue in detail['issues']:
                print(f"      问题: {issue}")

    print("\n【步骤 5】撤回无效记录")
    print("-" * 40)
    
    withdrawn_record = processor.withdraw_record(
        record_id="ABN004",
        actor="复核员_001",
        reason="客流数据为负数，明显录入错误"
    )
    print(f"✓ 已撤回记录: {withdrawn_record.record_id}")
    print(f"  状态: {withdrawn_record.status.value}")
    print(f"  撤回原因: {withdrawn_record.notes}")

    print("\n【步骤 6】补录被撤回的记录")
    print("-" * 40)
    
    supplemented_record = processor.supplement_record(
        record_id="ABN004",
        updates={
            "passenger_count": 550,
            "units_sold": 28,
            "initial_stock": 35
        },
        actor="复核员_001",
        reason="修正客流数据为正确值"
    )
    print(f"✓ 已补录记录: {supplemented_record.record_id}")
    print(f"  状态: {supplemented_record.status.value}")
    print(f"  新客流: {supplemented_record.passenger_count}")
    print(f"  新版本: {supplemented_record.version}")

    print("\n【步骤 7】修改异常记录（销量大于库存）")
    print("-" * 40)
    
    modified_record = processor.modify_record(
        record_id="ABN005",
        updates={
            "units_sold": 28,
            "was_sold_out": False
        },
        actor="复核员_001",
        reason="修正销量数据，原数据超出库存"
    )
    print(f"✓ 已修改记录: {modified_record.record_id}")
    print(f"  状态: {modified_record.status.value}")
    print(f"  新销量: {modified_record.units_sold}")
    print(f"  新版本: {modified_record.version}")

    print("\n【步骤 8】查看历史记录变更")
    print("-" * 40)
    
    print(f"\n记录 ABN004 的历史变更:")
    history = processor.get_record_history("ABN004")
    for i, entry in enumerate(history, 1):
        print(f"\n  变更 #{i}:")
        print(f"    操作类型: {entry.action}")
        print(f"    操作人: {entry.actor}")
        print(f"    时间: {entry.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"    原因: {entry.reason}")
        if entry.before:
            print(f"    变更前: 客流={entry.before.get('passenger_count')}, 销量={entry.before.get('units_sold')}")
        if entry.after:
            print(f"    变更后: 客流={entry.after.get('passenger_count')}, 销量={entry.after.get('units_sold')}")

    print("\n【步骤 9】重新执行质量检查（修正后）")
    print("-" * 40)
    
    all_records_updated = processor.get_all_records()
    pipeline_result2 = pipeline.process(all_records_updated)
    quality_report2 = pipeline_result2['quality_report']
    
    print(f"总记录数: {quality_report2.total_records}")
    print(f"正常样本: {quality_report2.normal_samples}")
    print(f"缺失样本: {quality_report2.missing_samples}")
    print(f"疑似误录: {quality_report2.suspicious_samples}")
    
    if quality_report2.suspicious_details:
        print("\n⚠️  仍有疑似误录记录:")
        for detail in quality_report2.suspicious_details:
            print(f"  - {detail['record_id']}: {', '.join(detail['issues'])}")
    else:
        print("✓ 所有记录质量正常！")

    print("\n【步骤 10】生成预测（基于修正后的数据）")
    print("-" * 40)
    
    predictions = forecaster.forecast_all_meals(
        train_id=train_g5678.train_id,
        target_date=date(2026, 5, 15),
        target_time=time(10, 0),
        expected_passengers=600,
        historical_records=all_records_updated,
        trains=processor.trains,
        meals=processor.meals,
        holiday=False
    )
    
    if predictions:
        print(f"✓ 生成预测结果:")
        for p in predictions:
            print(f"\n  {p.meal_name}:")
            print(f"    预测需求: {p.predicted_demand:.1f} 份")
            print(f"    建议备货: {p.recommended_stock} 份")
            print(f"    置信度: {p.confidence_score * 100:.0f}%")
            print(f"    风险评估: {p.risk_assessment}")

    print("\n【步骤 11】生成复核报告")
    print("-" * 40)
    
    review_report = reporter.generate_report(
        records=all_records_updated,
        predictions=predictions,
        quality_report=quality_report2,
        trains=processor.trains,
        meals=processor.meals
    )
    
    formatted_report = reporter.format_report_for_reviewer(review_report)
    print(formatted_report)

    print("\n" + "=" * 60)
    print("异常路径演示完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
