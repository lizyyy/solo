import csv
import json
from datetime import datetime
from collections import defaultdict

from data_models import (
    InspectionRecord, SensorRecord, EmptyingRecord, ComplaintRecord,
    ToiletInfo, RiskItem, RiskType, RiskLevel, ActionType
)
from risk_engine import RiskEngine


def load_sample_data():
    sample_dir = "sample_data"
    
    inspections = []
    with open(f"{sample_dir}/inspections.csv", 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                record = InspectionRecord.from_csv_row(row)
                inspections.append(record)
            except Exception as e:
                print(f"跳过无效巡检记录: {e}")
    
    sensors = []
    with open(f"{sample_dir}/sensors.jsonl", 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    record = SensorRecord.from_jsonl(line)
                    sensors.append(record)
                except Exception as e:
                    print(f"跳过无效传感器记录: {e}")
    
    emptyings = []
    with open(f"{sample_dir}/emptyings.json", 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, list):
            for item in data:
                try:
                    record = EmptyingRecord.from_dict(item)
                    emptyings.append(record)
                except Exception as e:
                    print(f"跳过无效清掏记录: {e}")
    
    complaints = []
    with open(f"{sample_dir}/complaints.json", 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, list):
            for item in data:
                try:
                    record = ComplaintRecord.from_dict(item)
                    complaints.append(record)
                except Exception as e:
                    print(f"跳过无效投诉记录: {e}")
    
    return inspections, sensors, emptyings, complaints


def run_test():
    print("=" * 60)
    print("景区公厕保洁风险管控系统 - 规则引擎测试")
    print("=" * 60)
    
    print("\n[1/6] 加载示例数据...")
    inspections, sensors, emptyings, complaints = load_sample_data()
    
    print(f"  - 巡检记录: {len(inspections)} 条")
    print(f"  - 传感器记录: {len(sensors)} 条")
    print(f"  - 清掏记录: {len(emptyings)} 条")
    print(f"  - 投诉记录: {len(complaints)} 条")
    
    toilets = {
        "T001": ToiletInfo(
            toilet_id="T001",
            name="东门入口公厕",
            location="景区东门入口处",
            total_stalls=12,
            inspection_interval_minutes=60,
            emptying_cycle_days=30,
            ammonia_threshold=25.0,
            peak_flow_threshold=50
        ),
        "T002": ToiletInfo(
            toilet_id="T002",
            name="中心广场公厕",
            location="景区中心广场东侧",
            total_stalls=20,
            inspection_interval_minutes=45,
            emptying_cycle_days=20,
            ammonia_threshold=25.0,
            peak_flow_threshold=80
        ),
        "T003": ToiletInfo(
            toilet_id="T003",
            name="北门停车场公厕",
            location="景区北门停车场",
            total_stalls=15,
            inspection_interval_minutes=60,
            emptying_cycle_days=30,
            ammonia_threshold=25.0,
            peak_flow_threshold=60
        ),
        "T004": ToiletInfo(
            toilet_id="T004",
            name="山顶观景台公厕",
            location="景区山顶观景台",
            total_stalls=8,
            inspection_interval_minutes=90,
            emptying_cycle_days=45,
            ammonia_threshold=25.0,
            peak_flow_threshold=30
        )
    }
    
    print("\n[2/6] 初始化风险引擎...")
    engine = RiskEngine(toilets)
    analysis_date = datetime(2026, 5, 5)
    engine.set_analysis_date(analysis_date)
    print(f"  - 分析日期: {analysis_date.strftime('%Y-%m-%d')}")
    
    print("\n[3/6] 执行风险分析...")
    risks = engine.analyze_all(inspections, sensors, emptyings, complaints)
    
    print(f"  - 总风险数: {len(risks)}")
    
    print("\n[4/6] 按风险类型统计...")
    by_type = defaultdict(int)
    for risk in risks:
        by_type[risk.risk_type.value] += 1
    
    for typ, count in by_type.items():
        print(f"  - {typ}: {count} 个")
    
    print("\n[5/6] 按风险等级统计...")
    by_level = defaultdict(int)
    for risk in risks:
        by_level[risk.risk_level.value] += 1
    
    for level, count in by_level.items():
        print(f"  - {level}: {count} 个")
    
    print("\n[6/6] 详细风险列表...")
    print("-" * 60)
    
    for i, risk in enumerate(risks, 1):
        print(f"\n风险 #{i}")
        print(f"  公厕: {risk.toilet_name} ({risk.toilet_id})")
        print(f"  类型: {risk.risk_type.value}")
        print(f"  等级: {risk.risk_level.value}")
        print(f"  时段: {risk.time_slot}")
        print(f"  描述: {risk.description}")
        print(f"  建议措施: {risk.suggested_action.value}")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    
    print("\n预期验证结果:")
    print("  1. 漏巡风险: 东门入口公厕 (T001) 10:00-12:30 间隔超时")
    print("  2. 异味超阈风险: T001 早高峰、午间、晚高峰各有连续超标")
    print("  3. 客流突增风险: T002 午间时段客流超过阈值")
    print("  4. 清掏逾期风险: T003 (逾期50天)、T004 (逾期93天)")
    print("  5. 重复投诉风险: T001、T002、T003 都有连续或单日多起投诉")
    
    return risks


if __name__ == "__main__":
    run_test()
