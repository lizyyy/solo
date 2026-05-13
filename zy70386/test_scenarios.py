#!/usr/bin/env python3
"""
会员标签冲突CLI - 完整测试场景
"""
import os
import sys
import subprocess
import json

DB_FILE = os.path.join(os.path.dirname(__file__), 'member_tags.db')
CLI = os.path.join(os.path.dirname(__file__), 'cli.py')


def run_cmd(cmd):
    print(f"\n$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=os.path.dirname(__file__),
                          capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0


def create_test_data():
    """创建测试数据"""
    marketing = [
        {"member_id": "T001", "name": "测试用户1", "tag_name": "高价值", "start_date": "2026-01-01", "end_date": "2026-12-31"},
        {"member_id": "T002", "name": "测试用户2", "tag_name": "活跃", "start_date": "2026-01-01", "end_date": "2026-06-30"},
        {"member_id": "T003", "name": "测试用户3", "tag_name": "VIP", "start_date": "2026-01-01", "end_date": "2026-12-31"},
    ]
    
    risk = [
        {"member_id": "T001", "name": "测试用户1", "tag_name": "疑似风险", "reason": "异常交易", "start_date": "2026-04-01", "end_date": "2026-10-01"},
        {"member_id": "T002", "name": "测试用户2", "tag_name": "活跃", "start_date": "2026-01-01", "end_date": "2026-09-30"},
        {"member_id": "T004", "name": "测试用户4", "tag_name": "人工风险", "start_date": "2026-05-01", "end_date": "2026-12-31"},
    ]
    
    customer_service = [
        {"member_id": "T003", "name": "测试用户3", "tag_name": "流失", "reason": "30天未登录", "start_date": "2026-04-01", "end_date": "2026-12-31"},
        {"member_id": "T005", "name": "测试用户5", "tag_name": "优质客户", "reason": "高消费", "start_date": "2026-01-01", "end_date": "2026-12-31"},
    ]
    
    with open('test_marketing.json', 'w', encoding='utf-8') as f:
        json.dump(marketing, f, ensure_ascii=False, indent=2)
    
    with open('test_risk.json', 'w', encoding='utf-8') as f:
        json.dump(risk, f, ensure_ascii=False, indent=2)
    
    with open('test_customer_service.json', 'w', encoding='utf-8') as f:
        json.dump(customer_service, f, ensure_ascii=False, indent=2)
    
    print("测试数据已创建")


def cleanup():
    """清理测试环境"""
    if os.path.exists(DB_FILE):
        os.remove(DB_FILE)
    for f in ['test_marketing.json', 'test_risk.json', 'test_customer_service.json']:
        if os.path.exists(f):
            os.remove(f)
    print("测试环境已清理")


def main():
    print("=" * 60)
    print("会员标签冲突CLI - 完整测试场景")
    print("=" * 60)
    
    cleanup()
    create_test_data()
    
    print("\n" + "=" * 60)
    print("场景1: 导入营销系统数据")
    print("=" * 60)
    run_cmd(f"python3 {CLI} imp -f test_marketing.json -s marketing -u tester --no-check")
    
    print("\n" + "=" * 60)
    print("场景2: 导入风控系统数据（应产生互斥和来源冲突）")
    print("=" * 60)
    run_cmd(f"python3 {CLI} imp -f test_risk.json -s risk_control -u tester --no-check")
    
    print("\n" + "=" * 60)
    print("场景3: 导入客服系统数据")
    print("=" * 60)
    run_cmd(f"python3 {CLI} imp -f test_customer_service.json -s customer_service -u tester")
    
    print("\n" + "=" * 60)
    print("场景4: 查看冲突详情（T001应该有高价值和疑似风险的互斥）")
    print("=" * 60)
    run_cmd(f"python3 {CLI} check -m T001")
    
    print("\n" + "=" * 60)
    print("场景5: 自动解决来源冲突（风控优先级高于营销）")
    print("=" * 60)
    run_cmd(f"python3 {CLI} resolve")
    run_cmd(f"python3 {CLI} resolve -c 3 --auto -u operator1")
    
    print("\n" + "=" * 60)
    print("场景6: 人工解决互斥冲突")
    print("=" * 60)
    run_cmd(f"python3 {CLI} resolve -c 1")
    run_cmd(f"python3 {CLI} resolve -c 1 -k 1 -u operator2 -r \"风控标签优先，营销高价值暂时冻结\"")
    
    print("\n" + "=" * 60)
    print("场景7: 查看处理历史")
    print("=" * 60)
    run_cmd(f"python3 {CLI} history")
    run_cmd(f"python3 {CLI} history -m T001")
    
    print("\n" + "=" * 60)
    print("场景8: 导出可投放名单和清洗报告")
    print("=" * 60)
    run_cmd(f"python3 {CLI} export -t report -f json")
    
    print("\n" + "=" * 60)
    print("场景9: 重新导入相同数据测试复发检测")
    print("=" * 60)
    run_cmd(f"python3 {CLI} imp -f test_marketing.json -s marketing -u tester")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)
    
    cleanup()


if __name__ == '__main__':
    main()
