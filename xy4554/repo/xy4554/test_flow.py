import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db, reset_db
from csv_importer import CSVImporter
from rules_engine import RulesEngine

def test_full_flow():
    print("=" * 60)
    print("测试流程开始")
    print("=" * 60)
    
    print("\n[1/5] 重置并初始化数据库...")
    reset_db()
    init_db()
    print("    数据库重置并初始化成功")
    
    print("\n[2/5] 导入示例CSV数据...")
    sample_dir = os.path.join(os.path.dirname(__file__), 'samples')
    importer = CSVImporter()
    results = importer.import_all(sample_dir)
    
    print("    导入结果:")
    for r in results:
        if 'error' in r:
            print(f"      - {r['filename']}: 错误 - {r['error']}")
        else:
            print(f"      - {r['filename']}: 成功导入 {r['count']} 条记录到 {r['table']}")
    
    print("\n[3/5] 验证导入数据...")
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM sand_mold_orders')
    mold_count = cursor.fetchone()[0]
    print(f"    砂型工单: {mold_count} 条")
    
    cursor.execute('SELECT COUNT(*) FROM oven_temperature_logs')
    oven_count = cursor.fetchone()[0]
    print(f"    烘干炉日志: {oven_count} 条")
    
    cursor.execute('SELECT COUNT(*) FROM moisture_inspections')
    moisture_count = cursor.fetchone()[0]
    print(f"    水分抽检: {moisture_count} 条")
    
    cursor.execute('SELECT COUNT(*) FROM pouring_schedules')
    schedule_count = cursor.fetchone()[0]
    print(f"    浇注排程: {schedule_count} 条")
    
    cursor.execute('SELECT COUNT(*) FROM quality_notes')
    quality_count = cursor.fetchone()[0]
    print(f"    质检备注: {quality_count} 条")
    
    conn.close()
    
    print("\n[4/5] 运行规则检测...")
    engine = RulesEngine()
    violations = engine.run_all_rules()
    result = engine.save_results(violations)
    
    print(f"    总违规数: {result['total_violations']}")
    print(f"    按规则类型分布:")
    for rule_type, count in result['by_rule_type'].items():
        rule_names = {
            'undried': '未烘透',
            'moisture_rebound': '复潮',
            'furnace_mismatch': '炉次串号',
            'time_conflict': '开浇时间冲突',
            'reinspection_needed': '需复检砂型'
        }
        print(f"      - {rule_names.get(rule_type, rule_type)}: {count} 项")
    
    print("\n[5/5] 详细违规列表...")
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT mold_no, rule_name, severity, description 
        FROM rule_results 
        ORDER BY severity DESC, mold_no
    ''')
    
    print("    违规明细:")
    for row in cursor.fetchall():
        mold_no = row[0]
        rule_name = row[1]
        severity = row[2]
        desc = row[3][:50] + ('...' if len(row[3]) > 50 else '')
        
        severity_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(severity, '⚪')
        print(f"      {severity_icon} {mold_no} - {rule_name}: {desc}")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("测试流程完成！")
    print("=" * 60)
    print("\n验证要点:")
    print("  1. MOLD-2024-001 应有 未烘透、炉次串号、开浇时间冲突 三项违规")
    print("  2. MOLD-2024-002 应有 未烘透、复潮、炉次串号 三项违规")
    print("  3. MOLD-2024-003 应有 需复检砂型 一项违规")
    print("  4. MOLD-2024-004 应有 复潮 一项违规")
    print("  5. MOLD-2024-005 应有 未烘透 一项违规")
    print("\n接下来可以运行: python3 app.py 启动Web服务")
    print("然后访问 http://localhost:5000 进行复核和导出测试")

if __name__ == '__main__':
    test_full_flow()
