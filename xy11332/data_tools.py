#!/usr/bin/env python3
"""
门诊服务台陪检调度系统 - 数据导入脚本
支持批量导入患者、陪检员、任务数据
"""

import json
import sys
import requests
from typing import List, Dict

BASE_URL = "http://localhost:8000"


def import_escorts(escorts_data: List[Dict]):
    """批量导入陪检员数据"""
    print(f"\n=== 开始导入 {len(escorts_data)} 名陪检员 ===")
    success = 0
    failed = 0

    for escort in escorts_data:
        try:
            response = requests.post(
                f"{BASE_URL}/api/escorts/",
                json=escort
            )
            if response.status_code == 200:
                print(f"  ✓ 导入成功: {escort['name']} ({escort['employee_id']})")
                success += 1
            else:
                print(f"  ✗ 导入失败: {escort['name']} - {response.text}")
                failed += 1
        except Exception as e:
            print(f"  ✗ 导入异常: {escort['name']} - {str(e)}")
            failed += 1

    print(f"陪检员导入完成: 成功 {success}, 失败 {failed}")
    return success, failed


def import_patients(patients_data: List[Dict]):
    """批量导入患者数据"""
    print(f"\n=== 开始导入 {len(patients_data)} 名患者 ===")
    success = 0
    failed = 0

    for patient in patients_data:
        try:
            response = requests.post(
                f"{BASE_URL}/api/patients/",
                json=patient
            )
            if response.status_code == 200:
                print(f"  ✓ 导入成功: {patient['name']} ({patient['medical_record_no']})")
                success += 1
            else:
                print(f"  ✗ 导入失败: {patient['name']} - {response.text}")
                failed += 1
        except Exception as e:
            print(f"  ✗ 导入异常: {patient['name']} - {str(e)}")
            failed += 1

    print(f"患者导入完成: 成功 {success}, 失败 {failed}")
    return success, failed


def import_tasks(tasks_data: List[Dict]):
    """批量导入任务数据"""
    print(f"\n=== 开始导入 {len(tasks_data)} 个任务 ===")

    try:
        response = requests.post(
            f"{BASE_URL}/api/tasks/batch/create",
            json={"tasks": tasks_data}
        )
        if response.status_code == 200:
            result = response.json()
            print(f"批量导入结果: 总数 {result['total_count']}, 成功 {result['success_count']}, 失败 {result['failed_count']}")
            for item in result['results']:
                if item['success']:
                    print(f"  ✓ 任务创建成功: {item['task_no']}")
                else:
                    print(f"  ✗ 任务创建失败: {item['error_message']}")
            return result['success_count'], result['failed_count']
        else:
            print(f"批量导入请求失败: {response.text}")
            return 0, len(tasks_data)
    except Exception as e:
        print(f"批量导入异常: {str(e)}")
        return 0, len(tasks_data)


def export_data(output_file: str = "export_data.json"):
    """导出所有数据"""
    print(f"\n=== 开始导出数据到 {output_file} ===")

    try:
        escorts_resp = requests.get(f"{BASE_URL}/api/escorts/")
        patients_resp = requests.get(f"{BASE_URL}/api/patients/")
        tasks_resp = requests.get(f"{BASE_URL}/api/tasks/")
        stats_resp = requests.get(f"{BASE_URL}/api/tasks/statistics/overview")

        data = {
            "export_time": __import__('datetime').datetime.now().isoformat(),
            "statistics": stats_resp.json() if stats_resp.status_code == 200 else {},
            "escorts": escorts_resp.json() if escorts_resp.status_code == 200 else [],
            "patients": patients_resp.json() if patients_resp.status_code == 200 else [],
            "tasks": tasks_resp.json() if tasks_resp.status_code == 200 else []
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"数据导出成功！共导出:")
        print(f"  - 陪检员: {len(data['escorts'])} 名")
        print(f"  - 患者: {len(data['patients'])} 名")
        print(f"  - 任务: {len(data['tasks'])} 个")
        print(f"\n输出文件: {output_file}")

    except Exception as e:
        print(f"导出异常: {str(e)}")


def review_task(task_id: int):
    """复核任务详情和审计日志"""
    print(f"\n=== 复核任务 ID {task_id} ===")

    try:
        task_resp = requests.get(f"{BASE_URL}/api/tasks/{task_id}")
        if task_resp.status_code != 200:
            print(f"任务不存在或查询失败: {task_resp.text}")
            return

        task = task_resp.json()
        print(f"\n任务基本信息:")
        print(f"  任务编号: {task['task_no']}")
        print(f"  优先级: {task['priority']}")
        print(f"  状态: {task['status']}")
        print(f"  检查类型: {task['examination_type']}")
        print(f"  创建时间: {task['created_at']}")

        audit_resp = requests.get(f"{BASE_URL}/api/tasks/{task_id}/audit-logs")
        if audit_resp.status_code == 200:
            audit_logs = audit_resp.json()
            print(f"\n流转记录 ({len(audit_logs)} 条):")
            for log in audit_logs:
                print(f"  [{log['created_at']}] {log['action']}: {log['reason']}")
                if log['old_status'] or log['new_status']:
                    print(f"    状态变更: {log['old_status']} -> {log['new_status']}")

        print("\n复核完成！")

    except Exception as e:
        print(f"复核异常: {str(e)}")


def main():
    if len(sys.argv) < 2:
        print("""
门诊服务台陪检调度系统 - 数据导入/导出/复核工具

用法:
  python data_tools.py import <数据文件.json>    - 导入数据
  python data_tools.py export [输出文件.json]     - 导出数据
  python data_tools.py review <任务ID>            - 复核任务
  python data_tools.py sample                     - 生成样例数据文件

数据文件格式 (JSON):
{
  "escorts": [{"name": "...", "employee_id": "...", ...}],
  "patients": [{"name": "...", "medical_record_no": "...", ...}],
  "tasks": [{"patient_id": 1, "priority": "normal", ...}]
}
        """)
        return

    command = sys.argv[1]

    if command == "import":
        if len(sys.argv) < 3:
            print("请指定数据文件路径")
            return
        file_path = sys.argv[2]
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if "escorts" in data:
            import_escorts(data["escorts"])
        if "patients" in data:
            import_patients(data["patients"])
        if "tasks" in data:
            import_tasks(data["tasks"])

    elif command == "export":
        output_file = sys.argv[2] if len(sys.argv) > 2 else "export_data.json"
        export_data(output_file)

    elif command == "review":
        if len(sys.argv) < 3:
            print("请指定任务ID")
            return
        task_id = int(sys.argv[2])
        review_task(task_id)

    elif command == "sample":
        sample_data = {
            "escorts": [
                {"name": "张三", "employee_id": "ESC001", "phone": "13800138001", "max_tasks": 3},
                {"name": "李四", "employee_id": "ESC002", "phone": "13800138002", "max_tasks": 2}
            ],
            "patients": [
                {"name": "赵小明", "medical_record_no": "MR001", "age": 45, "gender": "男", "department": "内科"},
                {"name": "钱小红", "medical_record_no": "MR002", "age": 32, "gender": "女", "department": "急诊科"}
            ],
            "tasks": [
                {"patient_id": 1, "priority": "normal", "examination_type": "CT检查", "from_location": "内科病房", "to_location": "CT室"},
                {"patient_id": 2, "priority": "emergency", "examination_type": "急诊抢救", "from_location": "急诊科", "to_location": "抢救室"}
            ]
        }
        with open("sample_data.json", 'w', encoding='utf-8') as f:
            json.dump(sample_data, f, ensure_ascii=False, indent=2)
        print("样例数据文件已生成: sample_data.json")


if __name__ == "__main__":
    main()