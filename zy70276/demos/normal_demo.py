#!/usr/bin/env python3
"""
最短演示路径：正常路径

演示完整的铁路餐车备货预测流程：
1. 注册车次和餐品
2. 添加历史销售记录
3. 质量检查（自动分类正常/缺失/疑似样本）
4. 生成备货预测
5. 生成复核报告
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
    print("铁路餐车备货预测器 - 正常路径演示")
    print("=" * 60)

    processor = DataProcessor()
    pipeline = DataPipeline()
    forecaster = DemandForecaster()
    reporter = ReviewReporter()

    print("\n【步骤 1】注册车次信息")
    print("-" * 40)
    
    train_g1234 = TrainInfo(
        train_number="G1234",
        route="北京南-上海虹桥",
        departure_station="北京南",
        arrival_station="上海虹桥",
        departure_time=time(8, 0),
        arrival_time=time(12, 30),
        total_capacity=1200,
        operation_days=[1, 2, 3, 4, 5, 6, 7]
    )
    processor.register_train(train_g1234)
    print(f"✓ 已注册车次: {train_g1234.train_number} ({train_g1234.route})")
    print(f"  车次ID: {train_g1234.train_id}")

    print("\n【步骤 2】注册餐品信息")
    print("-" * 40)
    
    meals = [
        MealItem(meal_id="ML001", name="宫保鸡丁套餐", category="热食", price=45.0, shelf_life_hours=4),
        MealItem(meal_id="ML002", name="红烧牛肉面", category="面食", price=38.0, shelf_life_hours=3),
        MealItem(meal_id="ML003", name="番茄鸡蛋套餐", category="热食", price=35.0, shelf_life_hours=4),
    ]
    for meal in meals:
        processor.register_meal(meal)
        print(f"✓ 已注册餐品: {meal.name} (¥{meal.price})")

    print("\n【步骤 3】添加历史销售记录")
    print("-" * 40)
    
    historical_records = [
        SalesRecord(
            record_id="REC001",
            train_id=train_g1234.train_id,
            train_number="G1234",
            meal_id="ML001",
            meal_name="宫保鸡丁套餐",
            date=date(2026, 5, 1),
            departure_time=time(8, 0),
            segment="北京南-天津南",
            passenger_count=850,
            units_sold=42,
            initial_stock=50,
            was_sold_out=True,
            sold_out_time=time(9, 30)
        ),
        SalesRecord(
            record_id="REC002",
            train_id=train_g1234.train_id,
            train_number="G1234",
            meal_id="ML001",
            meal_name="宫保鸡丁套餐",
            date=date(2026, 5, 2),
            departure_time=time(8, 0),
            segment="天津南-济南西",
            passenger_count=920,
            units_sold=38,
            initial_stock=50,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="REC003",
            train_id=train_g1234.train_id,
            train_number="G1234",
            meal_id="ML001",
            meal_name="宫保鸡丁套餐",
            date=date(2026, 5, 3),
            departure_time=time(8, 0),
            segment="济南西-徐州东",
            passenger_count=780,
            units_sold=35,
            initial_stock=50,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="REC004",
            train_id=train_g1234.train_id,
            train_number="G1234",
            meal_id="ML002",
            meal_name="红烧牛肉面",
            date=date(2026, 5, 1),
            departure_time=time(8, 0),
            segment="北京南-天津南",
            passenger_count=850,
            units_sold=28,
            initial_stock=40,
            was_sold_out=False
        ),
        SalesRecord(
            record_id="REC005",
            train_id=train_g1234.train_id,
            train_number="G1234",
            meal_id="ML002",
            meal_name="红烧牛肉面",
            date=date(2026, 5, 2),
            departure_time=time(8, 0),
            segment="天津南-济南西",
            passenger_count=920,
            units_sold=35,
            initial_stock=40,
            was_sold_out=True,
            sold_out_time=time(10, 0)
        ),
        SalesRecord(
            record_id="REC006",
            train_id=train_g1234.train_id,
            train_number="G1234",
            meal_id="ML003",
            meal_name="番茄鸡蛋套餐",
            date=date(2026, 5, 1),
            departure_time=time(8, 0),
            segment="北京南-天津南",
            passenger_count=850,
            units_sold=25,
            initial_stock=30,
            was_sold_out=False
        )
    ]
    
    for record in historical_records:
        processor.add_sales_record(record, actor="乘务员_001", reason="日常销售记录录入")
        print(f"✓ 已添加记录: {record.record_id} - {record.meal_name} ({record.date})")

    print("\n【步骤 4】质量检查 - 样本分类")
    print("-" * 40)
    
    all_records = processor.get_all_records()
    pipeline_result = pipeline.process(all_records)
    quality_report = pipeline_result['quality_report']
    
    print(f"总记录数: {quality_report.total_records}")
    print(f"正常样本: {quality_report.normal_samples}")
    print(f"缺失样本: {quality_report.missing_samples}")
    print(f"疑似误录: {quality_report.suspicious_samples}")
    
    if quality_report.recommendations:
        print("\n质量检查建议:")
        for rec in quality_report.recommendations:
            print(f"  - {rec}")
    else:
        print("✓ 所有样本质量正常，无异常")

    print("\n【步骤 5】生成备货预测")
    print("-" * 40)
    
    target_date = date(2026, 5, 10)
    target_time = time(8, 0)
    expected_passengers = 900
    holiday = False
    
    print(f"预测目标: {train_g1234.train_number}")
    print(f"预测日期: {target_date}")
    print(f"发车时间: {target_time}")
    print(f"预期客流: {expected_passengers} 人")
    print(f"是否节假日: {'是' if holiday else '否'}")
    
    predictions = forecaster.forecast_all_meals(
        train_id=train_g1234.train_id,
        target_date=target_date,
        target_time=target_time,
        expected_passengers=expected_passengers,
        historical_records=all_records,
        trains=processor.trains,
        meals=processor.meals,
        holiday=holiday
    )
    
    print(f"\n✓ 生成了 {len(predictions)} 个餐品预测结果:")
    for p in predictions:
        print(f"\n  {p.meal_name}:")
        print(f"    预测需求: {p.predicted_demand:.1f} 份")
        print(f"    建议备货: {p.recommended_stock} 份")
        print(f"    安全库存: {p.safety_stock} 份")
        print(f"    最高库存: {p.max_stock} 份")
        print(f"    最低库存: {p.min_stock} 份")
        print(f"    置信度: {p.confidence_score * 100:.0f}%")
        print(f"    历史售罄率: {p.historical_sell_through_rate * 100:.1f}%")
        print(f"    风险评估: {p.risk_assessment}")

    print("\n【步骤 6】生成复核报告")
    print("-" * 40)
    
    review_report = reporter.generate_report(
        records=all_records,
        predictions=predictions,
        quality_report=quality_report,
        trains=processor.trains,
        meals=processor.meals
    )
    
    formatted_report = reporter.format_report_for_reviewer(review_report)
    print(formatted_report)

    print("\n" + "=" * 60)
    print("正常路径演示完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
