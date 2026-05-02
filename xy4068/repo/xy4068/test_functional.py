#!/usr/bin/env python3
"""功能测试脚本：验证所有 CLI 命令"""

import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

test_dir = project_root / "test_workspace"

def setup_test_workspace():
    """创建测试工作目录"""
    if test_dir.exists():
        shutil.rmtree(test_dir)
    test_dir.mkdir(parents=True, exist_ok=True)
    print(f"✅ 创建测试工作目录: {test_dir}")

def generate_test_data():
    """生成测试数据文件"""
    data_dir = test_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    
    csv_file = data_dir / "footfall_10min.csv"
    json_file = data_dir / "shelf_events.json"
    
    print(f"\n📦 生成测试数据...")
    
    start_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    
    import csv
    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow([
            "id", "event_type", "timestamp", "camera_id", "area_id",
            "severity", "confidence", "payload"
        ])
        
        for i in range(40):
            event_time = start_time + timedelta(seconds=i * 15)
            event_type = "person_enter" if i % 2 == 0 else "person_exit"
            camera_id = "cam_entrance"
            
            payload = {
                "person_count": 1 if i % 3 != 0 else 2,
                "direction": "in" if event_type == "person_enter" else "out",
            }
            
            writer.writerow([
                f"evt_csv_{i:04d}",
                event_type,
                event_time.isoformat(),
                camera_id,
                "area_entrance",
                "info",
                f"{0.85 + (i % 15) * 0.01:.2f}",
                str(payload).replace("'", '"'),
            ])
    
    print(f"   ✅ 生成 CSV: {csv_file} ({40} 条事件)")
    
    json_events = []
    for i in range(20):
        event_time = start_time + timedelta(seconds=i * 30 + 5)
        
        if i % 5 == 0:
            event_type = "shelf_out_of_stock"
            camera_id = "cam_shelf_a"
            area_id = "area_shelf_a_drinks"
            severity = "high"
            confidence = 0.88
            payload = {
                "sku": f"DRK_{1000 + i}",
                "product_name": "矿泉水",
                "stock_level": 0,
                "threshold": 5,
            }
        else:
            event_type = "shelf_low_stock"
            camera_id = "cam_shelf_a"
            area_id = "area_shelf_a_drinks"
            severity = "medium"
            confidence = 0.75
            payload = {
                "sku": f"DRK_{2000 + i}",
                "product_name": "可乐",
                "stock_level": 2 + (i % 3),
                "threshold": 5,
            }
        
        json_events.append({
            "id": f"evt_json_{i:04d}",
            "event_type": event_type,
            "timestamp": event_time.isoformat(),
            "camera_id": camera_id,
            "area_id": area_id,
            "severity": severity,
            "confidence": confidence,
            "payload": payload,
        })
    
    with open(json_file, "w", encoding="utf-8") as f:
        json.dump({"events": json_events}, f, indent=2, ensure_ascii=False)
    
    print(f"   ✅ 生成 JSON: {json_file} ({20} 条事件)")
    
    return csv_file, json_file

def test_scenario_parser(csv_file: Path, json_file: Path):
    """测试场景解析器"""
    print(f"\n🔍 测试场景解析器...")
    
    from event_simulator.scenario_parser.parser import ScenarioParser
    
    parser = ScenarioParser(test_dir)
    
    csv_events = parser.parse_file(csv_file)
    print(f"   ✅ CSV 解析: {len(csv_events)} 条事件")
    
    json_events = parser.parse_file(json_file)
    print(f"   ✅ JSON 解析: {len(json_events)} 条事件")
    
    all_events = csv_events + json_events
    sorted_events = parser.sort_events(all_events)
    
    time_range = parser.get_time_range(sorted_events)
    duration = (time_range["end"] - time_range["start"]).total_seconds()
    print(f"   ✅ 合并共 {len(sorted_events)} 条事件")
    print(f"   ✅ 时间范围: {time_range['start']} ~ {time_range['end']}")
    print(f"   ✅ 持续时间: {duration:.1f} 秒")
    
    return sorted_events

def test_validation(events: List):
    """测试验证器"""
    print(f"\n✅ 测试校验器...")
    
    from event_simulator.validation.validator import Validator
    from event_simulator.validation.rules import OutOfOrderRule, DuplicateRule, MissingFieldRule
    
    validator = Validator()
    
    result = validator.validate(events)
    
    print(f"   状态: {'✅ 通过' if result.valid else '❌ 失败'}")
    print(f"   事件总数: {result.total_events}")
    print(f"   错误数: {result.total_errors}")
    print(f"   警告数: {result.total_warnings}")
    print(f"   执行规则: {', '.join(result.rules_executed)}")
    
    if result.errors:
        print("\n   ❌ 发现错误:")
        for e in result.errors[:5]:
            print(f"      - [{e.rule_name}] {e.message}")
    
    if result.warnings:
        print("\n   ⚠️ 发现警告:")
        for w in result.warnings[:3]:
            print(f"      - [{w.rule_name}] {w.message}")
    
    return result

def test_replay_scheduler(events: List):
    """测试回放调度器 (快速模式)"""
    print(f"\n⏯️  测试回放调度器...")
    
    from event_simulator.replay_scheduler.scheduler import ReplayScheduler, ReplayStatus
    
    emitted_events = []
    
    def on_event(event):
        emitted_events.append(event)
    
    scheduler = ReplayScheduler(
        events=events[:10],
        on_event=on_event,
    )
    
    print(f"   事件数: {len(events[:10])}")
    
    scheduler.start(speed=100.0)
    scheduler.wait(timeout=5.0)
    
    progress = scheduler.get_progress()
    print(f"   状态: {progress['status']}")
    print(f"   进度: {progress['progress_percent']}%")
    print(f"   已处理: {len(emitted_events)} 条事件")
    
    return emitted_events

def test_report_generator(events: List, validation_result):
    """测试报告生成器"""
    print(f"\n📄 测试报告生成器...")
    
    from event_simulator.reporter.generator import ReportGenerator
    
    reports_dir = test_dir / "reports"
    generator = ReportGenerator(reports_dir)
    
    paths = generator.generate(
        report_id=f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        events=events,
        validation_result=validation_result,
        scenario_info={
            "id": "test_scenario",
            "name": "功能测试场景",
            "description": "用于验证报告生成功能",
            "tags": ["测试", "验收"],
        },
    )
    
    print(f"   ✅ JSON 报告: {paths['json']}")
    print(f"   ✅ Markdown 报告: {paths['markdown']}")
    
    if paths['json'].exists():
        with open(paths['json'], 'r', encoding='utf-8') as f:
            report_data = json.load(f)
        print(f"   ✅ 报告摘要:")
        print(f"      - 状态: {report_data['summary']['status']}")
        print(f"      - 事件数: {report_data['summary']['event_count']}")
        print(f"      - 摄像头数: {report_data['summary']['camera_count']}")
        print(f"      - 事件类型数: {report_data['summary']['event_type_count']}")
    
    return paths

def test_state_storage():
    """测试状态存储"""
    print(f"\n💾 测试状态存储...")
    
    from event_simulator.state_storage.storage import StateStorage, ReplayCheckpoint
    from datetime import datetime
    
    state_dir = test_dir / "state"
    storage = StateStorage(state_dir)
    
    checkpoint = ReplayCheckpoint(
        checkpoint_id="chk_test_001",
        scenario_id="test_scenario",
        created_at=datetime.now(),
        current_index=50,
        total_events=100,
        processed_events=50,
        elapsed_seconds=120.5,
        speed=2.0,
    )
    
    path = storage.save_checkpoint(checkpoint)
    print(f"   ✅ 保存检查点: {path}")
    
    loaded = storage.load_checkpoint("chk_test_001")
    assert loaded is not None
    assert loaded.checkpoint_id == "chk_test_001"
    assert loaded.current_index == 50
    print(f"   ✅ 加载检查点: checkpoint_id={loaded.checkpoint_id}, progress={loaded.current_index}/{loaded.total_events}")
    
    checkpoints = storage.list_checkpoints()
    print(f"   ✅ 检查点列表: {len(checkpoints)} 个")
    
    return storage

def run_all_tests():
    """运行所有功能测试"""
    print("="*70)
    print("🧪 边缘 AI 摄像头事件流仿真器 - 功能测试")
    print("="*70)
    
    setup_test_workspace()
    
    csv_file, json_file = generate_test_data()
    
    events = test_scenario_parser(csv_file, json_file)
    
    validation_result = test_validation(events)
    
    test_replay_scheduler(events)
    
    test_report_generator(events, validation_result)
    
    test_state_storage()
    
    print("\n" + "="*70)
    print("🎉 所有功能测试完成!")
    print("="*70)
    
    print(f"\n📂 测试工作目录: {test_dir}")
    print("   包含:")
    print("   - data/          测试数据文件 (CSV/JSON)")
    print("   - reports/       生成的报告")
    print("   - state/         状态存储")
    
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
