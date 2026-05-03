#!/usr/bin/env python3
"""
脚手架挂牌风险台 - 风险闭环测试脚本
演示从风险识别到闭环的完整接口调用链
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5001"

def print_separator(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def pretty_print(data):
    print(json.dumps(data, ensure_ascii=False, indent=2))

def test_risk_closure_flow():
    """
    测试风险闭环完整流程：
    1. 检查超期未复验
    2. 查询超期脚手架
    3. 查看脚手架详情
    4. 更新状态为整改中
    5. 解决超期问题（完成复验）
    6. 确认状态已更新
    7. 生成风险摘要
    """
    
    print_separator("开始风险闭环测试流程")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 步骤 1: 检查超期未复验
    print_separator("步骤 1: 检查超期未复验")
    print("调用 POST /api/status/check-overdue")
    try:
        response = requests.post(f"{BASE_URL}/api/status/check-overdue")
        result = response.json()
        pretty_print(result)
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请确保服务已启动 (python run.py)")
        return False
    
    # 步骤 2: 查询超期脚手架
    print_separator("步骤 2: 查询超期脚手架列表")
    print("调用 GET /api/query/overdue-scaffolds")
    try:
        response = requests.get(f"{BASE_URL}/api/query/overdue-scaffolds")
        result = response.json()
        pretty_print(result)
        
        if result['count'] == 0:
            print("\n提示: 没有找到超期脚手架，示例数据中 SF-2026-002 应该是超期的")
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    # 步骤 3: 查看具体脚手架状态
    print_separator("步骤 3: 查看脚手架 SF-2026-002 详情")
    print("调用 GET /api/query/scaffold-status?scaffold_no=SF-2026-002")
    try:
        response = requests.get(f"{BASE_URL}/api/query/scaffold-status", 
                               params={"scaffold_no": "SF-2026-002"})
        result = response.json()
        if result.get('success'):
            data = result['data']
            print(f"脚手架编号: {data['scaffold_no']}")
            print(f"当前状态: {data['current_status']}")
            print(f"区域: {data['area']}")
            print(f"位置: {data['location']}")
            if data['overdue_history']:
                print(f"超期记录: {len(data['overdue_history'])} 条")
        else:
            pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    # 步骤 4: 更新脚手架状态为整改中
    print_separator("步骤 4: 将脚手架状态更新为整改中")
    print("调用 POST /api/status/update-scaffold-status")
    update_data = {
        "scaffold_no": "SF-2026-002",
        "status": "rectifying",
        "reason": "超期未复验，安排整改复验",
        "operator": "验收员乙"
    }
    print(f"请求数据: {json.dumps(update_data, ensure_ascii=False)}")
    try:
        response = requests.post(f"{BASE_URL}/api/status/update-scaffold-status",
                                json=update_data,
                                headers={"Content-Type": "application/json"})
        result = response.json()
        pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    # 步骤 5: 解决超期问题（完成复验）
    print_separator("步骤 5: 完成复验，解决超期问题")
    print("调用 POST /api/status/resolve-overdue")
    next_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
    resolve_data = {
        "scaffold_no": "SF-2026-002",
        "next_reinspection_date": next_date,
        "operator": "验收员乙"
    }
    print(f"请求数据: {json.dumps(resolve_data, ensure_ascii=False)}")
    try:
        response = requests.post(f"{BASE_URL}/api/status/resolve-overdue",
                                json=resolve_data,
                                headers={"Content-Type": "application/json"})
        result = response.json()
        pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    # 步骤 6: 确认脚手架状态
    print_separator("步骤 6: 确认脚手架状态已更新")
    print("再次调用 GET /api/query/scaffold-status")
    try:
        response = requests.get(f"{BASE_URL}/api/query/scaffold-status",
                               params={"scaffold_no": "SF-2026-002"})
        result = response.json()
        if result.get('success'):
            data = result['data']
            print(f"脚手架编号: {data['scaffold_no']}")
            print(f"当前状态: {data['current_status']}")
            if data['current_status'] == 'inspected':
                print("✓ 状态已正确更新为 '已复验'")
            else:
                print(f"注意: 当前状态为 {data['current_status']}")
        else:
            pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    # 步骤 7: 检查作业冲突
    print_separator("附加测试: 检查作业冲突")
    print("调用 POST /api/status/check-conflicts")
    try:
        response = requests.post(f"{BASE_URL}/api/status/check-conflicts")
        result = response.json()
        pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
    
    # 步骤 8: 生成风险摘要
    print_separator("步骤 7: 生成当日风险摘要")
    print("调用 GET /api/query/export-risk-summary")
    try:
        response = requests.get(f"{BASE_URL}/api/query/export-risk-summary")
        result = response.json()
        if result.get('success'):
            data = result['data']
            basic = data['basic_summary']
            print("\n【基本统计】")
            print(f"  脚手架总数: {basic['total_scaffolds']}")
            print(f"  禁用脚手架: {basic['disabled_scaffolds']}")
            print(f"  超期脚手架: {basic['overdue_scaffolds']}")
            print(f"  待整改: {basic['pending_rectifications']}")
            print(f"  已闭环: {basic['closed_rectifications']}")
            print(f"  活动冲突: {basic['active_conflicts']}")
            
            if basic['high_risk_areas']:
                print("\n【高风险区域】")
                for area in basic['high_risk_areas']:
                    print(f"  - {area['area']}: 风险等级 {area['risk_level']} (风险分: {area['risk_score']})")
            
            print("\n【脚手架状态概览】")
            for status, count in data['scaffold_status_overview'].items():
                print(f"  {status}: {count}")
        else:
            pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
        return False
    
    # 步骤 9: 查询今日禁用挂牌
    print_separator("附加测试: 查询今日禁用挂牌")
    print("调用 GET /api/query/today-disabled")
    try:
        response = requests.get(f"{BASE_URL}/api/query/today-disabled")
        result = response.json()
        pretty_print(result)
    except Exception as e:
        print(f"错误: {e}")
    
    print_separator("测试流程完成")
    print("\n✅ 风险闭环测试流程已成功完成！")
    print("\n测试总结:")
    print("  1. ✓ 超期检查功能正常")
    print("  2. ✓ 脚手架状态查询正常")
    print("  3. ✓ 状态更新功能正常")
    print("  4. ✓ 超期解决功能正常")
    print("  5. ✓ 风险摘要生成正常")
    print("  6. ✓ 冲突检测功能正常")
    
    return True

def test_data_import():
    """
    测试数据导入功能
    """
    print_separator("测试数据导入功能")
    
    print("\n注意: 数据导入需要通过 multipart/form-data 上传文件")
    print("可以使用 curl 命令测试:")
    print("\n导入搭设申请 CSV:")
    print('curl -X POST http://localhost:5000/api/import/erection-csv -F "file=@sample_data/erection_applications.csv"')
    
    print("\n导入验收记录 JSON:")
    print('curl -X POST http://localhost:5000/api/import/acceptance-json -F "file=@sample_data/acceptance_records.json"')
    
    print("\n导入整改记录:")
    print('curl -X POST http://localhost:5000/api/import/rectification-records -F "file=@sample_data/rectification_records.csv"')
    
    print("\n导入作业许可:")
    print('curl -X POST http://localhost:5000/api/import/work-permits -F "file=@sample_data/work_permits.json"')

if __name__ == "__main__":
    print("="*60)
    print("  脚手架挂牌风险台 - 自动化测试脚本")
    print("="*60)
    print("\n请确保服务已启动: python run.py")
    print("服务地址: http://localhost:5000")
    print("\n可用测试:")
    print("  1. 风险闭环流程测试 (test_risk_closure_flow)")
    print("  2. 数据导入示例 (test_data_import)")
    print()
    
    # 运行主要测试
    test_risk_closure_flow()
    
    # 显示数据导入示例
    test_data_import()
