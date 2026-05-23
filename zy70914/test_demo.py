import sys
import os
import json
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services import (
    DataStore, DataImporter, ComparisonEngine, ExplanationGenerator,
    ReviewService, RecalculationService, ReportGenerator
)
from app.models import ReviewStatus


def print_sep(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
    print("=" * 70)


def main():
    print_sep("航班申诉对账系统 - 流程演示")

    store = DataStore()
    importer = DataImporter(store)
    engine = ComparisonEngine(store)
    explainer = ExplanationGenerator()
    reviewer = ReviewService(store)
    recalc = RecalculationService(store, engine)
    reporter = ReportGenerator(store, explainer)

    print_sep("步骤1: 数据导入")

    claims_df = pd.DataFrame({
        "claim_id": ["CLAIM001", "CLAIM002", "CLAIM003", "CLAIM004", "CLAIM005"],
        "passenger_name": ["张三", "李四", "王五", "赵六", "孙七"],
        "id_card": ["310101198001011234", "310101198002025678", "310101198003039012", "310101198004043456", "310101198005057890"],
        "phone": ["13800138001", "13800138002", "13800138003", "13800138004", "13800138005"],
        "flight_no": ["CA1234", "CA5678", "MU9876", "CA4321", "CA8765"],
        "flight_date": ["2024-01-15", "2024-01-16", "2024-01-17", "2024-01-18", "2024-01-19"],
        "segment": ["PEK-SHA", "SHA-CAN", "CAN-PEK", "PEK-WUH", "SHA-PEK"],
        "claim_type": ["delay", "delay", "cancel", "delay", "baggage"],
        "claim_amount": [500, 300, 600, 200, 400],
        "declaration_time": ["2024-01-15 18:30:00", "2024-01-19 10:00:00", "2024-01-17 09:00:00", "2024-01-18 14:00:00", "2024-01-19 20:00:00"],
        "incident_description": ["延误4小时", "超时申报", "航班取消", "延误2小时", "行李延误"],
        "photo_ids": ["PHOTO001,PHOTO002", "PHOTO003,PHOTO004", "PHOTO005,PHOTO006", "PHOTO007", "PHOTO008,PHOTO009"],
        "remarks": ["正常", "超时", "取消", "金额低", "行李"]
    })
    csv_content = claims_df.to_csv(index=False)
    result = importer.import_claims_csv(csv_content)
    print(f"申诉数据: 导入 {result['imported']}/{result['total']} 条")

    flights = [
        {"flight_no": "CA1234", "flight_date": "2024-01-15", "departure": "PEK", "arrival": "SHA",
         "scheduled_departure": "2024-01-15 08:00:00", "actual_departure": "2024-01-15 12:30:00",
         "scheduled_arrival": "2024-01-15 10:30:00", "actual_arrival": "2024-01-15 15:00:00",
         "delay_minutes": 270},
        {"flight_no": "CA5678", "flight_date": "2024-01-16", "departure": "SHA", "arrival": "CAN",
         "scheduled_departure": "2024-01-16 14:00:00", "actual_departure": "2024-01-16 14:30:00",
         "scheduled_arrival": "2024-01-16 16:30:00", "actual_arrival": "2024-01-16 17:00:00",
         "delay_minutes": 30},
        {"flight_no": "MU9876", "flight_date": "2024-01-17", "departure": "CAN", "arrival": "PEK",
         "scheduled_departure": "2024-01-17 10:00:00", "scheduled_arrival": "2024-01-17 13:00:00",
         "is_canceled": True, "delay_minutes": 0},
        {"flight_no": "CA4321", "flight_date": "2024-01-18", "departure": "PEK", "arrival": "WUH",
         "scheduled_departure": "2024-01-18 09:00:00", "actual_departure": "2024-01-18 11:15:00",
         "scheduled_arrival": "2024-01-18 11:30:00", "actual_arrival": "2024-01-18 13:45:00",
         "delay_minutes": 135},
        {"flight_no": "CA8765", "flight_date": "2024-01-19", "departure": "SHA", "arrival": "PEK",
         "scheduled_departure": "2024-01-19 16:00:00", "actual_departure": "2024-01-19 19:00:00",
         "scheduled_arrival": "2024-01-19 18:30:00", "actual_arrival": "2024-01-19 21:30:00",
         "delay_minutes": 180}
    ]
    result = importer.import_flights_json(json.dumps(flights))
    print(f"航班数据: 导入 {result['imported']}/{result['total']} 条")

    photos = [
        {"photo_id": "PHOTO001", "claim_id": "CLAIM001", "file_name": "a.jpg", "file_path": "/a.jpg",
         "upload_time": "2024-01-15 18:35:00", "photo_type": "bp", "is_valid": True},
        {"photo_id": "PHOTO002", "claim_id": "CLAIM001", "file_name": "b.jpg", "file_path": "/b.jpg",
         "upload_time": "2024-01-15 18:36:00", "photo_type": "proof", "is_valid": True},
        {"photo_id": "PHOTO003", "claim_id": "CLAIM002", "file_name": "c.jpg", "file_path": "/c.jpg",
         "upload_time": "2024-01-19 10:05:00", "photo_type": "bp", "is_valid": True},
        {"photo_id": "PHOTO004", "claim_id": "CLAIM002", "file_name": "d.jpg", "file_path": "/d.jpg",
         "upload_time": "2024-01-19 10:06:00", "photo_type": "id", "is_valid": True},
        {"photo_id": "PHOTO005", "claim_id": "CLAIM003", "file_name": "e.jpg", "file_path": "/e.jpg",
         "upload_time": "2024-01-17 09:10:00", "photo_type": "cancel", "is_valid": True},
        {"photo_id": "PHOTO006", "claim_id": "CLAIM003", "file_name": "f.jpg", "file_path": "/f.jpg",
         "upload_time": "2024-01-17 09:11:00", "photo_type": "ticket", "is_valid": True},
        {"photo_id": "PHOTO007", "claim_id": "CLAIM004", "file_name": "g.jpg", "file_path": "/g.jpg",
         "upload_time": "2024-01-18 14:10:00", "photo_type": "bp", "is_valid": True},
        {"photo_id": "PHOTO008", "claim_id": "CLAIM005", "file_name": "h.jpg", "file_path": "/h.jpg",
         "upload_time": "2024-01-19 20:10:00", "photo_type": "baggage", "is_valid": True},
        {"photo_id": "PHOTO009", "claim_id": "CLAIM005", "file_name": "i.jpg", "file_path": "/i.jpg",
         "upload_time": "2024-01-19 20:11:00", "photo_type": "proof", "is_valid": True}
    ]
    result = importer.import_photos_index(json.dumps(photos))
    print(f"照片数据: 导入 {result['imported']}/{result['total']} 条")

    rules = [
        {"rule_id": "R001", "rule_name": "延误4小时+", "claim_type": "delay", "flight_type": "domestic",
         "min_delay_minutes": 240, "max_delay_minutes": None, "compensation_amount": 400,
         "valid_from": "2024-01-01", "description": "延误4小时以上赔400", "conditions": {}},
        {"rule_id": "R002", "rule_name": "延误2-4小时", "claim_type": "delay", "flight_type": "domestic",
         "min_delay_minutes": 120, "max_delay_minutes": 240, "compensation_amount": 200,
         "valid_from": "2024-01-01", "description": "延误2-4小时赔200", "conditions": {}}
    ]
    result = importer.import_rules_json(json.dumps(rules))
    print(f"规则数据: 导入 {result['imported']}/{result['total']} 条")

    print_sep("步骤2: 自动比对")
    results = engine.compare_all()
    print(f"完成比对: {len(results)} 条记录")
    print("-" * 60)
    for r in results:
        status = r.auto_status.value
        print(f"  {r.claim_id}: {status} | 申报:{r.claimed_amount} | 建议:{r.suggested_amount} | 差异:{len(r.discrepancies)}")

    print_sep("步骤3: 差异解释")
    print("CLAIM001 差异解释:")
    print(explainer.generate_explanation(store.get_comparison_result("CLAIM001")))

    print("\nCLAIM002 差异解释:")
    print(explainer.generate_explanation(store.get_comparison_result("CLAIM002")))

    print_sep("步骤4: 人工复核")
    print("复核 CLAIM001 (通过)...")
    r = reviewer.review_claim("CLAIM001", "张经理", ReviewStatus.APPROVED, 400.0, "材料齐全")
    print(f"  结果: 成功，最终金额 {r['result'].final_amount}")

    print("复核 CLAIM002 (拒绝)...")
    r = reviewer.review_claim("CLAIM002", "张经理", ReviewStatus.REJECTED, 0.0, "超时申报", "超时")
    print(f"  结果: 成功，状态 {r['result'].review_record.status.value}")

    print_sep("步骤5: 重新计算")
    r = recalc.recalculate_claim("CLAIM004", "测试")
    print(f"CLAIM004 重算: {r['previous_suggested_amount']} -> {r['new_suggested_amount']}")

    print_sep("步骤6: 生成报告")
    s = reporter.generate_summary()
    print(f"批次: {s.batch_id}")
    print(f"总数: {s.total_claims} | 通过: {s.approved_count} | 拒绝: {s.rejected_count}")
    print(f"总申报: {s.total_claimed_amount} | 总建议: {s.total_suggested_amount} | 总通过: {s.total_approved_amount}")

    csv_path = os.path.join(os.getcwd(), "reconciliation_report.csv")
    r = reporter.export_to_csv(csv_path)
    print(f"\nCSV报告: {r['path']} ({r['count']}条)")

    json_path = os.path.join(os.getcwd(), "reconciliation_report.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(reporter.generate_json_report(), f, ensure_ascii=False, indent=2, default=str)
    print(f"JSON报告: {json_path}")

    print_sep("演示完成")


if __name__ == "__main__":
    main()
