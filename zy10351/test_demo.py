#!/usr/bin/env python3
"""
任务输出归档 API 演示脚本
演示完整的任务生命周期和时间线追踪
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def demo():
    print_section("任务输出归档 API - 完整流程演示")
    
    task_number = f"TASK-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    print_section("1. 创建任务")
    create_data = {
        "task_number": task_number,
        "task_name": "月度数据报表生成",
        "description": "2024年5月销售数据汇总报表",
        "archive_strategy": "delayed",
        "access_level": "read",
        "owner": "zhangsan",
        "expire_days": 90
    }
    resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
    print(f"创建任务 {task_number}:")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    print_section("2. 登记任务输出文件")
    register_data = {
        "output_file_path": "/data/output/report_202405.xlsx",
        "output_file_name": "report_202405.xlsx",
        "output_file_size": 2048576,
        "output_file_hash": "abc123def456xyz789",
        "operator": "zhangsan"
    }
    resp = requests.post(f"{BASE_URL}/tasks/{task_number}/register", json=register_data)
    print("登记输出文件:")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    print_section("3. 重复提交相同文件测试（应幂等，不产生脏数据）")
    resp = requests.post(f"{BASE_URL}/tasks/{task_number}/register", json=register_data)
    print("重复提交相同文件:")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    print_section("4. 归档任务")
    archive_data = {
        "target_location": "/archive/tasks/202405/report_202405.xlsx",
        "operator": "zhangsan"
    }
    resp = requests.post(f"{BASE_URL}/tasks/{task_number}/archive", json=archive_data)
    print("归档任务:")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    print_section("5. 查看任务时间线（排查问题专用）")
    resp = requests.get(f"{BASE_URL}/tasks/{task_number}/timelines")
    timelines = resp.json()
    print("任务时间线记录:")
    for idx, tl in enumerate(timelines, 1):
        print(f"\n  {idx}. 动作: {tl['action']}")
        print(f"     时间: {tl['timestamp']}")
        print(f"     操作人: {tl['operator']}")
        print(f"     状态变更: {tl['status_before']} -> {tl['status_after']}")
        print(f"     描述: {tl['description']}")
    
    print_section("6. 获取任务完整详情")
    resp = requests.get(f"{BASE_URL}/tasks/{task_number}")
    print("任务完整详情:")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    print_section("7. 撤销任务演示（创建新任务演示）")
    task_number2 = f"TASK-REVOKE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    create_data2 = {
        "task_number": task_number2,
        "task_name": "临时测试任务",
        "description": "用于演示撤销功能",
        "archive_strategy": "manual",
        "access_level": "admin",
        "owner": "lisi",
        "expire_days": 7
    }
    resp = requests.post(f"{BASE_URL}/tasks", json=create_data2)
    print(f"创建任务 {task_number2} 成功")
    
    revoke_data = {
        "reason": "任务重复创建，不需要执行",
        "operator": "lisi"
    }
    resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/revoke", json=revoke_data)
    print("撤销任务结果:")
    print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
    
    print_section("8. 查看所有任务列表")
    resp = requests.get(f"{BASE_URL}/tasks")
    data = resp.json()
    print(f"任务总数: {data['total']}")
    for task in data['items']:
        print(f"  - {task['task_number']}: {task['task_name']} [{task['status']}]")
    
    print_section("9. 导出归档汇总报告（Excel）")
    export_data = {
        "include_timelines": True,
        "include_archive_records": True,
        "include_cleanup_records": True
    }
    resp = requests.post(f"{BASE_URL}/export", json=export_data)
    if resp.status_code == 200:
        filename = resp.headers.get('Content-Disposition', '').split('filename=')[-1]
        print(f"导出成功！文件名: {filename}")
        with open(filename, 'wb') as f:
            f.write(resp.content)
        print(f"报告已保存到: {filename}")
    else:
        print("导出失败:", resp.text)
    
    print_section("演示完成！")
    print(f"任务编号 {task_number} 的完整生命周期已记录在时间线中")
    print("访问 http://localhost:8000/docs 查看完整 API 文档")


if __name__ == "__main__":
    try:
        demo()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到 API 服务")
        print("请先启动服务: python main.py")
