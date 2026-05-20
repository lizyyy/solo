#!/usr/bin/env python3
"""
床位周转API服务完整测试脚本
运行方式: python test_api.py
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def print_separator(title=""):
    print("\n" + "="*60)
    if title:
        print(f"  {title}")
        print("="*60)

def test_submit_batch():
    print_separator("1. 提交床位周转批次")
    
    data = {
        "submitted_by": "王护士长",
        "remark": "2024年5月第二周床位周转材料",
        "records": [
            {
                "department": "内科",
                "bed_number": "A-101",
                "patient_id": "P20240501001",
                "patient_name": "张三",
                "admission_date": "2024-05-01T08:00:00",
                "discharge_date": "2024-05-07T14:30:00",
                "diagnosis": "冠心病",
                "surgeon": "李医生"
            },
            {
                "department": "外科",
                "bed_number": "B-203",
                "patient_id": "P20240502002",
                "patient_name": "李四",
                "admission_date": "2024-05-02T09:15:00",
                "discharge_date": "2024-05-10T10:00:00",
                "diagnosis": "急性阑尾炎",
                "surgeon": "王医生"
            },
            {
                "department": "内科",
                "bed_number": "A-105",
                "patient_id": "P20240503003",
                "patient_name": "王五",
                "admission_date": "2024-05-03T14:00:00",
                "discharge_date": None,
                "diagnosis": "高血压",
                "surgeon": "赵医生"
            }
        ]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/batches", json=data)
        response.raise_for_status()
        result = response.json()
        print(f"✅ 提交成功!")
        print(f"   批次ID: {result['batch_id']}")
        print(f"   提交人: {result['submitted_by']}")
        print(f"   记录数: {result['record_count']}")
        print(f"   是否重复: {result['is_duplicate']}")
        return result['batch_id']
    except Exception as e:
        print(f"❌ 提交失败: {e}")
        return None

def test_duplicate_submit():
    print_separator("2. 验证去重机制（再次提交相同批次）")
    
    data = {
        "submitted_by": "王护士长",
        "remark": "2024年5月第二周床位周转材料",
        "records": [
            {
                "department": "内科",
                "bed_number": "A-101",
                "patient_id": "P20240501001",
                "patient_name": "张三",
                "admission_date": "2024-05-01T08:00:00",
                "discharge_date": "2024-05-07T14:30:00",
                "diagnosis": "冠心病",
                "surgeon": "李医生"
            },
            {
                "department": "外科",
                "bed_number": "B-203",
                "patient_id": "P20240502002",
                "patient_name": "李四",
                "admission_date": "2024-05-02T09:15:00",
                "discharge_date": "2024-05-10T10:00:00",
                "diagnosis": "急性阑尾炎",
                "surgeon": "王医生"
            },
            {
                "department": "内科",
                "bed_number": "A-105",
                "patient_id": "P20240503003",
                "patient_name": "王五",
                "admission_date": "2024-05-03T14:00:00",
                "discharge_date": None,
                "diagnosis": "高血压",
                "surgeon": "赵医生"
            }
        ]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/batches", json=data)
        response.raise_for_status()
        result = response.json()
        if result['is_duplicate']:
            print(f"✅ 去重机制正常!")
            print(f"   消息: {result['message']}")
            print(f"   原有批次ID: {result['batch_id']}")
            return True
        else:
            print(f"❌ 去重机制失败: 未检测到重复")
            return False
    except Exception as e:
        print(f"❌ 请求失败: {e}")
        return False

def test_get_batch_detail(batch_id):
    print_separator("3. 获取批次详情")
    
    try:
        response = requests.get(f"{BASE_URL}/api/batches/{batch_id}")
        response.raise_for_status()
        result = response.json()
        print(f"✅ 获取成功!")
        print(f"   批次ID: {result['batch_id']}")
        print(f"   提交人: {result['submitted_by']}")
        print(f"   状态: {result['status']}")
        print(f"   记录数: {len(result['records'])}")
        print("\n   记录列表:")
        for rec in result['records']:
            print(f"     - ID:{rec['id']} {rec['patient_name']}({rec['patient_id']}) {rec['department']} {rec['bed_number']}")
        return result['records'][0]['id']
    except Exception as e:
        print(f"❌ 获取失败: {e}")
        return None

def test_update_record(record_id):
    print_separator("4. 修改床位周转记录")
    
    data = {
        "operator": "李主任",
        "reason": "患者诊断信息更正，经核实为高血压3级",
        "updates": {
            "diagnosis": "高血压3级",
            "discharge_date": "2024-05-15T09:00:00"
        }
    }
    
    try:
        response = requests.put(f"{BASE_URL}/api/records/{record_id}", json=data)
        response.raise_for_status()
        result = response.json()
        print(f"✅ 修改成功!")
        print(f"   记录ID: {result['record_id']}")
        print(f"   消息: {result['message']}")
        return True
    except Exception as e:
        print(f"❌ 修改失败: {e}")
        return False

def test_get_audit_logs(record_id):
    print_separator("5. 查询单条记录审计日志")
    
    try:
        response = requests.get(f"{BASE_URL}/api/audit/record/{record_id}")
        response.raise_for_status()
        logs = response.json()
        print(f"✅ 查询成功! 共 {len(logs)} 条日志:")
        for log in logs:
            if log['field_name']:
                print(f"\n   操作人: {log['operator']}")
                print(f"   操作时间: {log['operation_time']}")
                print(f"   修改字段: {log['field_name']}")
                print(f"   修改前: {log['old_value']}")
                print(f"   修改后: {log['new_value']}")
                print(f"   修改原因: {log['reason']}")
        return True
    except Exception as e:
        print(f"❌ 查询失败: {e}")
        return False

def test_traceability(record_id):
    print_separator("6. 关键字段追溯（从原始输入到最终报告）")
    
    try:
        response = requests.get(f"{BASE_URL}/api/trace/{record_id}")
        response.raise_for_status()
        result = response.json()
        print(f"✅ 追溯成功!")
        print(f"   记录ID: {result['record_id']}")
        print("\n   字段追溯详情:")
        for field in result['traceability']:
            status = "🔄 有修改" if field['change_count'] > 0 else "✅ 无修改"
            print(f"\n   {status} 字段: {field['field_name']}")
            print(f"      原始值: {field['original_value']}")
            print(f"      当前值: {field['current_value']}")
            if field['change_count'] > 0:
                print(f"      修改次数: {field['change_count']}")
        return True
    except Exception as e:
        print(f"❌ 追溯失败: {e}")
        return False

def test_generate_report(batch_id):
    print_separator("7. 生成床位周转统计报告")
    
    try:
        response = requests.get(f"{BASE_URL}/api/reports/{batch_id}")
        response.raise_for_status()
        result = response.json()
        print(f"✅ 报告生成成功!")
        print(f"   批次ID: {result['batch_id']}")
        print(f"   生成时间: {result['generated_at']}")
        print("\n   汇总统计:")
        print(f"     总记录数: {result['summary']['total_records']}")
        print(f"     已出院: {result['summary']['effective_records']}")
        print(f"     科室数: {result['summary']['total_departments']}")
        print(f"     平均住院天数: {result['summary']['avg_admission_days']}")
        print(f"     床位周转率: {result['summary']['turnover_rate']}")
        print("\n   各科室统计:")
        for dept in result['department_statistics']:
            print(f"     - {dept['department']}: 总数{dept['total_records']}, 出院{dept['discharged_records']}, 平均{dept['avg_admission_days']}天, 周转率{dept['turnover_rate']}")
        return True
    except Exception as e:
        print(f"❌ 报告生成失败: {e}")
        return False

def test_download_report(batch_id):
    print_separator("8. 下载Excel报告")
    
    try:
        response = requests.get(f"{BASE_URL}/api/reports/{batch_id}/download")
        response.raise_for_status()
        filename = "床位周转报告_测试.xlsx"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"✅ 报告下载成功!")
        print(f"   文件名: {filename}")
        print(f"   文件大小: {len(response.content)} 字节")
        return True
    except Exception as e:
        print(f"❌ 下载失败: {e}")
        return False

def main():
    print("\n" + "🚀"*20)
    print("     公立医院床位周转API服务 - 完整测试")
    print("🚀"*20)
    
    print(f"\n服务地址: {BASE_URL}")
    print(f"API文档: {BASE_URL}/docs")
    
    batch_id = test_submit_batch()
    if not batch_id:
        print("\n❌ 测试终止: 无法获取批次ID")
        return
    
    test_duplicate_submit()
    record_id = test_get_batch_detail(batch_id)
    
    if record_id:
        test_update_record(record_id)
        test_get_audit_logs(record_id)
        test_traceability(record_id)
    
    test_generate_report(batch_id)
    test_download_report(batch_id)
    
    print_separator("测试完成!")
    print("\n✅ 所有核心功能测试通过!")
    print("\n接下来你可以:")
    print("  1. 查看下载的Excel报告: 床位周转报告_测试.xlsx")
    print(f"  2. 访问API文档: {BASE_URL}/docs")
    print("  3. 使用curl命令进行更多测试（参考README.md）")
    print("\n")

if __name__ == "__main__":
    main()
