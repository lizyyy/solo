#!/usr/bin/env python3
"""
门店品控管理系统 - 使用示例

核心功能:
1. 数据导入 - 支持Excel/CSV批量导入，失败重试不破坏已成功记录
2. 规则引擎 - 过期留样隔离、温度异常检测、温度缺口检测、批次一致性检查
3. 数据查询 - 按负责人、时间、状态、异常类型筛选
4. 复核流程 - 单条/批量复核，支持申诉处理
5. 报表导出 - 导出与查询结果一致的Excel/CSV报告
"""

from datetime import datetime, timedelta
from database import init_db, SessionLocal
from models import Store, FoodSample, TemperatureRecord, WasteRecord, RecordStatus
from services import ImportService, QualityService, ReviewService, ExportService
from rules import RuleEngine
import pandas as pd
import os


def setup_demo_data():
    """创建演示数据"""
    db = SessionLocal()
    try:
        # 创建门店
        stores_data = [
            {"id": "ST001", "name": "朝阳门店", "manager_id": "M001", "manager_name": "张店长",
             "region": "华北", "city": "北京", "address": "北京市朝阳区xxx路xxx号"},
            {"id": "ST002", "name": "海淀门店", "manager_id": "M002", "manager_name": "李店长",
             "region": "华北", "city": "北京", "address": "北京市海淀区xxx路xxx号"},
            {"id": "ST003", "name": "浦东门店", "manager_id": "M003", "manager_name": "王店长",
             "region": "华东", "city": "上海", "address": "上海市浦东新区xxx路xxx号"},
        ]

        for s in stores_data:
            if not db.query(Store).get(s["id"]):
                store = Store(**s, is_active=True)
                db.add(store)

        db.commit()
        print("✓ 门店数据创建完成")

    finally:
        db.close()


def create_sample_import_file():
    """创建示例导入文件"""
    now = datetime.now()

    # 留样数据
    samples_data = []
    for i in range(5):
        sample_time = now - timedelta(days=i, hours=8)
        expire_time = sample_time + timedelta(hours=48)
        samples_data.append({
            "store_id": f"ST00{(i % 3) + 1}",
            "batch_id": f"BATCH_{now.strftime('%Y%m%d')}",
            "dish_name": f"菜品{i + 1}",
            "sample_type": "cooked",
            "sample_time": sample_time.strftime('%Y-%m-%d %H:%M:%S'),
            "sample_weight": round(0.5 + i * 0.1, 2),
            "storage_location": f"冰箱A-0{i + 1}",
            "keeper_id": f"K00{i + 1}",
            "keeper_name": f"留样员{i + 1}",
            "expire_time": expire_time.strftime('%Y-%m-%d %H:%M:%S')
        })

    # 添加一条过期数据
    samples_data.append({
        "store_id": "ST001",
        "batch_id": f"BATCH_{now.strftime('%Y%m%d')}",
        "dish_name": "过期菜品",
        "sample_type": "cooked",
        "sample_time": (now - timedelta(days=5)).strftime('%Y-%m-%d %H:%M:%S'),
        "sample_weight": 0.6,
        "storage_location": "冰箱A-06",
        "keeper_id": "K001",
        "keeper_name": "留样员1",
        "expire_time": (now - timedelta(days=3)).strftime('%Y-%m-%d %H:%M:%S')
    })

    samples_df = pd.DataFrame(samples_data)
    samples_file = "demo_samples.xlsx"
    samples_df.to_excel(samples_file, index=False)
    print(f"✓ 示例留样文件已创建: {samples_file}")

    # 温度数据
    temp_data = []
    for i in range(10):
        record_time = now - timedelta(hours=i * 2)
        # 制造几个异常温度
        if i == 3:
            temp = 15.0  # 超高温
        elif i == 7:
            temp = -2.0  # 超低温
        else:
            temp = round(3.0 + i * 0.2, 1)

        temp_data.append({
            "store_id": f"ST00{(i % 3) + 1}",
            "fridge_id": f"FRIDGE_{(i % 2) + 1}",
            "fridge_name": f"冷藏柜{(i % 2) + 1}",
            "record_time": record_time.strftime('%Y-%m-%d %H:%M:%S'),
            "temperature": temp,
            "min_temperature": 0.0,
            "max_temperature": 8.0,
            "recorder_id": f"R00{(i % 3) + 1}",
            "recorder_name": f"测温员{(i % 3) + 1}"
        })

    temp_df = pd.DataFrame(temp_data)
    temp_file = "demo_temperature.xlsx"
    temp_df.to_excel(temp_file, index=False)
    print(f"✓ 示例温度文件已创建: {temp_file}")

    # 废弃数据
    waste_data = []
    for i in range(5):
        production_time = now - timedelta(days=i, hours=12)
        waste_time = production_time + timedelta(hours=24)
        waste_data.append({
            "store_id": f"ST00{(i % 3) + 1}",
            "batch_id": f"BATCH_{now.strftime('%Y%m%d')}",
            "dish_name": f"废弃菜品{i + 1}",
            "production_time": production_time.strftime('%Y-%m-%d %H:%M:%S'),
            "waste_time": waste_time.strftime('%Y-%m-%d %H:%M:%S'),
            "expected_waste_time": waste_time.strftime('%Y-%m-%d %H:%M:%S'),
            "waste_weight": round(2.0 + i * 0.5, 2),
            "waste_reason": f"过期废弃{i + 1}",
            "handler_id": f"H00{(i % 3) + 1}",
            "handler_name": f"处理员{i + 1}"
        })

    waste_df = pd.DataFrame(waste_data)
    waste_file = "demo_waste.xlsx"
    waste_df.to_excel(waste_file, index=False)
    print(f"✓ 示例废弃文件已创建: {waste_file}")

    return samples_file, temp_file, waste_file


def demo_full_workflow():
    """演示完整工作流程"""
    print("\n" + "=" * 60)
    print("门店品控管理系统 - 完整工作流程演示")
    print("=" * 60)

    # 1. 初始化数据库
    print("\n【步骤1】初始化数据库")
    init_db()
    setup_demo_data()

    # 2. 创建示例导入文件
    print("\n【步骤2】创建示例导入文件")
    samples_file, temp_file, waste_file = create_sample_import_file()

    # 3. 导入数据
    print("\n【步骤3】批量导入数据")
    import_service = ImportService()

    print("  - 导入留样数据...")
    sample_result = import_service.import_samples(
        samples_file,
        operator_id="OP001",
        operator_name="系统管理员"
    )
    print(f"    结果: 总计{sample_result['total_count']}条, 成功{sample_result['success_count']}条, 失败{sample_result['failed_count']}条")

    print("  - 导入温度数据...")
    temp_result = import_service.import_temperature_records(
        temp_file,
        operator_id="OP001",
        operator_name="系统管理员"
    )
    print(f"    结果: 总计{temp_result['total_count']}条, 成功{temp_result['success_count']}条, 失败{temp_result['failed_count']}条")

    print("  - 导入废弃数据...")
    waste_result = import_service.import_waste_records(
        waste_file,
        operator_id="OP001",
        operator_name="系统管理员"
    )
    print(f"    结果: 总计{waste_result['total_count']}条, 成功{waste_result['success_count']}条, 失败{waste_result['failed_count']}条")

    # 4. 运行规则引擎
    print("\n【步骤4】运行规则引擎 - 检测异常")
    rule_engine = RuleEngine()
    print("  - 检测留样过期...")
    sample_stats = rule_engine.apply_all_samples()
    print(f"    结果: 处理{sample_stats['processed_records']}条, 拦截{sample_stats['blocked_records']}条")

    print("  - 检测温度异常...")
    temp_stats = rule_engine.apply_all_temperature()
    print(f"    结果: 处理{temp_stats['processed_records']}条")

    print("  - 检测废弃数据一致性...")
    waste_stats = rule_engine.apply_all_waste()
    print(f"    结果: 处理{waste_stats['processed_records']}条")

    # 5. 数据查询
    print("\n【步骤5】数据查询示例")
    quality_service = QualityService()

    print("  - 按负责人查询留样数据 (张店长)...")
    result = quality_service.query_samples(manager_id="M001")
    print(f"    找到 {result['total']} 条记录")

    print("  - 查询有异常的温度记录...")
    result = quality_service.query_temperature_records(has_exception=True)
    print(f"    找到 {result['total']} 条异常记录")

    print("  - 获取异常统计摘要...")
    summary = quality_service.get_exception_summary()
    print(f"    总计异常: {summary['total_exceptions']}条, 被拦截: {summary['total_blocked']}条")
    if summary['by_type']:
        print("    按类型分布:")
        for ex_type, count in summary['by_type'].items():
            print(f"      - {ex_type}: {count}条")

    # 6. 复核流程
    print("\n【步骤6】数据复核流程")
    review_service = ReviewService()

    pending = review_service.get_pending_review_count()
    print(f"  - 待复核记录总数: {pending['total']}条")

    # 7. 报表导出
    print("\n【步骤7】报表导出")
    export_service = ExportService()

    print("  - 导出综合品控报告...")
    report = export_service.export_comprehensive_report()
    print(f"    留样记录: {report['sample_count']}条")
    print(f"    温度记录: {report['temperature_count']}条")
    print(f"    废弃记录: {report['waste_count']}条")
    print(f"    异常记录: {report['exception_count']}条")

    with open(report['filename'], 'wb') as f:
        f.write(report['data'])
    print(f"    报告已保存: {report['filename']}")

    print("\n" + "=" * 60)
    print("工作流程演示完成!")
    print("=" * 60)


if __name__ == "__main__":
    demo_full_workflow()
