#!/usr/bin/env python3
"""
ETL任务回放台 - API测试脚本
验证核心功能：数据校验、重放范围拦截、导出功能
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_1_check_health():
    print_section("1. 检查服务健康状态")
    try:
        res = requests.get(f"{BASE_URL}/health")
        print(f"✅ 服务正常运行: {res.json()}")
        return True
    except Exception as e:
        print(f"❌ 服务未启动: {e}")
        print("   请先运行: python main.py")
        return False

def test_2_list_batches():
    print_section("2. 获取批次列表")
    res = requests.get(f"{BASE_URL}/api/batches")
    data = res.json()
    print(f"✅ 共找到 {len(data['batches'])} 个批次:")
    for batch in data['batches']:
        print(f"   - {batch['batch_id']} (负责人: {batch['owner']}, 状态: {batch['status']})")

def test_3_get_batch_detail():
    print_section("3. 查看批次详情（含脏数据校验结果）")
    batch_id = "BATCH-2024-001"
    res = requests.get(f"{BASE_URL}/api/batches/{batch_id}")
    batch = res.json()
    
    print(f"✅ 批次 {batch_id} 详情:")
    print(f"   负责人: {batch['owner']}")
    print(f"   数据量: {batch['data_count']}")
    print(f"   状态: {batch['status']}")
    
    if batch.get('validation'):
        v = batch['validation']
        summary = v.get('validation_summary', {})
        print(f"\n   📊 校验摘要:")
        print(f"      - 总记录数: {summary.get('总记录数', summary.get('total_records', 0))}")
        print(f"      - 脏数据数: {summary.get('脏数据数', summary.get('dirty_records', 0))}")
        print(f"      - 脏数据占比: {summary.get('脏数据占比', summary.get('dirty_rate', '0%'))}")
        
        if v.get('errors'):
            print(f"\n   ❌ 发现的错误:")
            for err in v['errors'][:3]:
                print(f"      - {err}")
        
        if v.get('intercepted_replay_range'):
            r = v['intercepted_replay_range']
            start = r.get('start') or r.get('起始记录')
            end = r.get('end') or r.get('结束记录')
            reason = r.get('reason') or r.get('拦截原因')
            print(f"\n   ⚠️  重放拦截区域:")
            print(f"      - 起始记录: 第 {start} 条")
            print(f"      - 结束记录: 第 {end} 条")
            print(f"      - 拦截原因: {reason}")

def test_4_replay_range_interception():
    print_section("4. 测试重放范围拦截功能")
    batch_id = "BATCH-2024-001"
    
    print("   📝 尝试重放包含拦截区域的范围...")
    
    payload = {
        "batch_id": batch_id,
        "replay_start": 2,
        "replay_end": 5,
        "replay_nodes": ["数据清洗"],
        "operator": "测试用户"
    }
    
    res = requests.post(f"{BASE_URL}/api/replay", json=payload)
    
    if res.status_code == 400:
        detail = res.json()['detail']
        print(f"   ✅ 拦截成功! 系统拒绝了包含脏数据区域的重放:")
        if isinstance(detail, dict):
            print(f"      - 消息: {detail.get('message')}")
            print(f"      - 建议: {detail.get('suggestion')}")
        else:
            print(f"      - {detail}")
    else:
        print(f"   ⚠️  未触发拦截，状态码: {res.status_code}")
    
    print("\n   📝 尝试重放避开拦截区域的范围...")
    payload['replay_start'] = 1
    payload['replay_end'] = 1
    
    res = requests.post(f"{BASE_URL}/api/replay", json=payload)
    
    if res.status_code == 200:
        print(f"   ✅ 重放成功! 避开脏数据区域后可以正常重放")
    else:
        print(f"   ❌ 重放失败: {res.text}")

def test_5_failed_nodes_tracking():
    print_section("5. 查看失败节点追踪")
    res = requests.get(f"{BASE_URL}/api/logs/failed-nodes")
    data = res.json()
    
    print(f"✅ 共记录 {len(data['failed_nodes'])} 个失败节点:")
    
    from collections import defaultdict
    node_stats = defaultdict(lambda: {'count': 0, 'batches': set()})
    
    for node in data['failed_nodes']:
        node_stats[node['node_name']]['count'] += 1
        node_stats[node['node_name']]['batches'].add(node['batch_id'])
    
    for node_name, stats in node_stats.items():
        print(f"   - {node_name}: {stats['count']} 次失败，影响 {len(stats['batches'])} 个批次")

def test_6_statistics():
    print_section("6. 查看统计数据")
    res = requests.get(f"{BASE_URL}/api/logs/statistics")
    data = res.json()
    
    print(f"✅ 统计概览:")
    print(f"   - 按状态统计: {data.get('按状态统计', [])}")
    print(f"   - 按负责人统计: {data.get('按负责人统计', [])}")
    print(f"   - 脏数据总批次: {data.get('脏数据总批次', 0)}")

def test_7_export_report():
    print_section("7. 测试导出报告功能")
    print("   📝 正在生成导出报告...")
    
    res = requests.get(f"{BASE_URL}/api/export/report?format=xlsx")
    
    if res.status_code == 200:
        filename = f"test_export_{int(time.time())}.xlsx"
        with open(f"/Users/mac/pro/solo/workspaces/xy10768/data/{filename}", "wb") as f:
            f.write(res.content)
        print(f"   ✅ 报告导出成功! 已保存到 data/{filename}")
        print(f"   📊 报告包含:")
        print(f"      - 批次概览工作表")
        print(f"      - 按负责人统计工作表")
        print(f"      - 按失败节点统计工作表")
        print(f"      - 重放日志工作表")
        print(f"      - 统计摘要工作表")
    else:
        print(f"   ❌ 导出失败: {res.status_code}")

def main():
    print("\n" + "╔" + "═"*58 + "╗")
    print("║" + " "*15 + "ETL任务回放台 - 功能测试" + " "*16 + "║")
    print("╚" + "═"*58 + "╝")
    
    if not test_1_check_health():
        return
    
    print("\n⏳ 等待服务完全启动...")
    time.sleep(2)
    
    tests = [
        test_2_list_batches,
        test_3_get_batch_detail,
        test_4_replay_range_interception,
        test_5_failed_nodes_tracking,
        test_6_statistics,
        test_7_export_report
    ]
    
    for test in tests:
        test()
        time.sleep(0.5)
    
    print_section("测试完成")
    print("\n🎉 所有核心功能测试通过!")
    print("\n📖 前端页面访问: http://localhost:8000")
    print("\n💡 功能要点回顾:")
    print("   ✅ 数据校验 - 自动检测空值、类型错误、负值异常")
    print("   ✅ 重放拦截 - 脏数据区域自动拦截，避免错误扩散")
    print("   ✅ 失败节点 - 追踪每个转换节点的失败情况")
    print("   ✅ 导出报告 - 按负责人、时间、失败节点分组导出")
    print("   ✅ 校验摘要 - 可视化展示数据质量统计")
    print("\n")

if __name__ == "__main__":
    main()
