#!/usr/bin/env python3
import requests
import json

BASE_URL = "http://localhost:8000"

def print_separator(title=""):
    print(f"\n{'='*60}")
    if title:
        print(f"  {title}")
    print('='*60)

def step1_submit_batch():
    print_separator("步骤1: 提交第一个批次材料")
    
    batch_data = {
        "batch_name": "2024年秋季研究生导师分配",
        "submitted_by": "张秘书",
        "description": "计算机学院第一批",
        "materials": [
            {
                "student_id": "S2024001",
                "student_name": "张三",
                "department": "计算机学院",
                "major": "计算机科学与技术",
                "gpa": 3.8,
                "research_interest": "人工智能",
                "preferred_tutors": "张教授"
            },
            {
                "student_id": "S2024002",
                "student_name": "李四",
                "department": "计算机学院",
                "major": "软件工程",
                "gpa": 3.6,
                "research_interest": "大数据",
                "preferred_tutors": "李教授"
            },
            {
                "student_id": "S2024003",
                "student_name": "王五",
                "department": "数学学院",
                "major": "应用数学",
                "gpa": 3.9,
                "research_interest": "数值计算",
                "preferred_tutors": "王教授"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/api/batches", json=batch_data)
    result = response.json()
    print(f"状态: {result['message']}")
    print(f"批次ID: {result['batch_id']}")
    print(f"是否重复: {result['is_duplicate']}")
    print("\n分配结果:")
    for r in result["allocation_results"]:
        print(f"  {r['student_name']} ({r['student_id']}) -> {r['tutor_name']} ({r['tutor_id']})")
    
    return result["batch_id"], result["allocation_results"][0]["id"]

def step2_duplicate_submit():
    print_separator("步骤2: 重复提交相同材料（验证重复检测）")
    
    batch_data = {
        "batch_name": "重复提交测试",
        "submitted_by": "李秘书",
        "description": "测试重复提交",
        "materials": [
            {
                "student_id": "S2024001",
                "student_name": "张三",
                "department": "计算机学院",
                "major": "计算机科学与技术",
                "gpa": 3.8,
                "research_interest": "人工智能",
                "preferred_tutors": "张教授"
            },
            {
                "student_id": "S2024002",
                "student_name": "李四",
                "department": "计算机学院",
                "major": "软件工程",
                "gpa": 3.6,
                "research_interest": "大数据",
                "preferred_tutors": "李教授"
            },
            {
                "student_id": "S2024003",
                "student_name": "王五",
                "department": "数学学院",
                "major": "应用数学",
                "gpa": 3.9,
                "research_interest": "数值计算",
                "preferred_tutors": "王教授"
            }
        ]
    }
    
    response = requests.post(f"{BASE_URL}/api/batches", json=batch_data)
    result = response.json()
    print(f"状态: {result['message']}")
    print(f"批次ID: {result['batch_id']}")
    print(f"是否重复: {result['is_duplicate']}")
    if result['is_duplicate']:
        print("✓ 重复提交检测成功！系统返回了原有结果而不是创建新记录")

def step3_modify_result(batch_id, result_id):
    print_separator("步骤3: 修改分配结论")
    
    update_data = {
        "modified_by": "王主任",
        "change_reason": "学生研究方向更匹配陈教授的课题",
        "tutor_id": "CS003",
        "tutor_name": "陈教授",
        "allocation_reason": "根据学生人工智能研究方向，调整至陈教授课题组"
    }
    
    response = requests.put(f"{BASE_URL}/api/results/{result_id}", json=update_data)
    result = response.json()
    print(f"状态: {result['message']}")
    print(f"更新字段: {result['updated_fields']}")
    print(f"当前值: {json.dumps(result['current_value'], ensure_ascii=False, indent=2)}")

def step4_query_audit_logs(batch_id):
    print_separator("步骤4: 查询修改记录（审计日志）")
    
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}/audit-logs")
    logs = response.json()
    print(f"批次: {logs['batch_name']} (ID: {logs['batch_id']})")
    print("\n修改记录:")
    if not logs["audit_logs"]:
        print("  (暂无修改记录)")
    for log in logs["audit_logs"]:
        print(f"\n  修改人: {log['modified_by']}")
        print(f"  修改时间: {log['modified_at']}")
        print(f"  修改原因: {log['change_reason']}")
        print(f"  修改字段: {log['field_name']}")
        print(f"  修改前: {log['old_value']}")
        print(f"  修改后: {log['new_value']}")

def step5_download_report(batch_id):
    print_separator("步骤5: 下载完整报告（包含完整追溯信息）")
    
    response = requests.get(f"{BASE_URL}/api/batches/{batch_id}/report")
    report = response.json()
    
    print(f"报告生成时间: {report['report_generated_at']}")
    print(f"批次信息: {report['batch_info']['batch_name']}")
    print(f"提交人: {report['batch_info']['submitted_by']}")
    print(f"学生总数: {report['total_students']}")
    print(f"修改次数: {report['total_modifications']}")
    
    print("\n完整追溯数据:")
    for data in report["data"]:
        print(f"\n{'-'*40}")
        print(f"学生: {data['student_name']} ({data['student_id']})")
        print(f"学院/专业: {data['department']}/{data['major']}")
        print(f"GPA: {data['gpa']}")
        print(f"研究方向: {data['research_interest']}")
        print(f"意向导师: {data['preferred_tutors']}")
        print(f"\n分配导师: {data['tutor_name']} ({data['tutor_id']})")
        print(f"分配理由: {data['allocation_reason']}")
        if data["modification_history"]:
            print(f"\n修改历史 ({len(data['modification_history'])} 次):")
            for h in data["modification_history"]:
                print(f"  - {h['modified_by']} 于 {h['modified_at']}")
                print(f"    原因: {h['change_reason']}")
                print(f"    {h['field_name']}: {h['old_value']} → {h['new_value']}")

def main():
    print("高校导师名额分配 API 服务 - 完整演示脚本")
    print("请确保已启动服务: uvicorn main:app --reload")
    
    try:
        response = requests.get(f"{BASE_URL}/api/batches")
        response.raise_for_status()
    except:
        print("\n错误: 无法连接到服务，请先启动服务！")
        print("运行命令: uvicorn main:app --reload")
        return
    
    batch_id, result_id = step1_submit_batch()
    step2_duplicate_submit()
    step3_modify_result(batch_id, result_id)
    step4_query_audit_logs(batch_id)
    step5_download_report(batch_id)
    
    print_separator("演示完成！")
    print(f"\n访问 Swagger 文档: http://localhost:8000/docs")
    print(f"访问报告: http://localhost:8000/api/batches/{batch_id}/report")

if __name__ == "__main__":
    main()
