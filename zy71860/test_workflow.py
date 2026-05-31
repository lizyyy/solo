#!/usr/bin/env python3
import sys
import json
from pathlib import Path

print("=" * 60)
print("错题等价判分系统 - 工作流测试")
print("=" * 60)

try:
    from equivalent_scoring.manager import ScoringManager
    from equivalent_scoring.export import ExportManager
    from equivalent_scoring.scoring import EquivalentScorer
    print("✓ 模块导入成功")
except Exception as e:
    print(f"✗ 模块导入失败: {e}")
    sys.exit(1)

print("\n【1/6】初始化管理器...")
try:
    manager = ScoringManager()
    manager.clear_all_data()
    print("✓ 管理器初始化成功")
except Exception as e:
    print(f"✗ 初始化失败: {e}")
    sys.exit(1)

print("\n【2/6】导入示例数据...")
try:
    sample_file = Path(__file__).parent / 'data' / 'sample_questions.json'
    with open(sample_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    count = manager.import_questions(data)
    print(f"✓ 成功导入 {count} 条错题记录")
except Exception as e:
    print(f"✗ 导入失败: {e}")
    sys.exit(1)

print("\n【3/6】执行等价判分...")
try:
    total, controversial = manager.run_scoring()
    print(f"✓ 判分完成")
    print(f"  - 总记录数: {total}")
    print(f"  - 争议记录: {controversial}")
    print(f"  - 争议率: {controversial/total*100:.1f}%")
except Exception as e:
    print(f"✗ 判分失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n【4/6】查看统计信息...")
try:
    stats = manager.get_statistics()
    print("✓ 统计信息:")
    print(f"  - 总记录数: {stats['total_records']}")
    print(f"  - 等价答案: {stats['equivalent_count']}")
    print(f"  - 非等价答案: {stats['non_equivalent_count']}")
    print(f"  - 争议记录: {stats['controversial_count']}")
    print(f"  - 平均相似度: {stats['average_similarity']:.2%}")
except Exception as e:
    print(f"✗ 统计失败: {e}")
    sys.exit(1)

print("\n【5/6】复核争议记录...")
try:
    controversial_details = manager.get_controversial_details()
    print(f"✓ 找到 {len(controversial_details)} 条争议记录")
    
    if controversial_details:
        first_record = controversial_details[0]
        record_id = first_record['record_id']
        print(f"  - 正在复核记录 ID: {record_id}")
        
        record = manager.review_record(
            record_id=record_id,
            reviewer="张老师",
            is_equivalent=True,
            final_score=5.0,
            reason="人工确认答案等价，虽然表述不同但核心正确"
        )
        print(f"  - 复核完成: 等价={record.is_equivalent}, 分数={record.final_score}")
        
        history = manager.get_record_history(record_id)
        print(f"  - 历史记录数: {len(history)}")
except Exception as e:
    print(f"✗ 复核失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n【6/6】导出所有数据...")
try:
    exporter = ExportManager()
    files = exporter.export_all(manager, prefix="测试")
    print("✓ 导出完成，生成文件:")
    for key, path in files.items():
        print(f"  - {key}: {Path(path).name}")
except Exception as e:
    print(f"✗ 导出失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("测试完成 ✓")
print("=" * 60)

print("\n生成的讲评稿预览:")
try:
    report_file = files['report']
    with open(report_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for line in lines[:25]:
            print(line.rstrip())
    print("...")
except:
    pass

print("\n争议点复核文件预览:")
try:
    controversy_file = files['controversy']
    with open(controversy_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        for line in lines[:40]:
            print(line.rstrip())
    print("...")
except:
    pass
