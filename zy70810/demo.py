#!/usr/bin/env python3
"""
楼宇维保对账服务 - 演示脚本
"""

import requests
import os
import time

BASE_URL = "http://localhost:8001"


def print_separator(title=""):
    print(f"\n{'='*60}")
    if title:
        print(f"  {title}")
        print('='*60)


def demo():
    print("""
╔══════════════════════════════════════════════════════════╗
║              楼宇维保对账服务 - 完整流程演示                   ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    try:
        print_separator("步骤1: 生成样例Excel文件")
        response = requests.get(f"{BASE_URL}/sample/generate")
        result = response.json()
        print("✓ 样例文件已生成:", result['files'])
        
        time.sleep(0.5)
        
        print_separator("步骤2: 导入设备台账")
        with open('sample_devices.xlsx', 'rb') as f:
            response = requests.post(f"{BASE_URL}/import/devices", files={'file': f})
        print("✓", response.json()['message'])
        
        print_separator("步骤3: 导入合同数据")
        with open('sample_contracts.xlsx', 'rb') as f:
            response = requests.post(f"{BASE_URL}/import/contracts", files={'file': f})
        print("✓", response.json()['message'])
        
        print_separator("步骤4: 导入照片清单")
        with open('sample_photos.xlsx', 'rb') as f:
            response = requests.post(f"{BASE_URL}/import/photos", files={'file': f})
        print("✓", response.json()['message'])
        
        time.sleep(0.5)
        
        print_separator("步骤5: 查看设备统计")
        response = requests.get(f"{BASE_URL}/stats/devices")
        stats = response.json()
        print(f"  设备总数: {stats['total']}")
        print(f"  按类型分布: {stats['by_type']}")
        print(f"  按楼层分布: {stats['by_floor']}")
        
        print_separator("步骤6: 创建对账任务")
        response = requests.post(f"{BASE_URL}/tasks/create?task_name=2024年5月维保对账")
        task_id = response.json()['task_id']
        task_code = response.json()['task_code']
        print(f"✓ 任务已创建 - ID: {task_id}, 编号: {task_code}")
        
        time.sleep(0.5)
        
        print_separator("步骤7: 执行对账计算")
        response = requests.post(f"{BASE_URL}/tasks/{task_id}/run")
        summary = response.json()['summary']
        print("✓ 对账完成!")
        print(f"  设备总数: {summary['total']}")
        print(f"  正常设备: {summary['normal']}")
        print(f"  维保过期: {summary['maintenance_overdue']} 台")
        print(f"  多合同设备: {summary['multiple_contracts']} 台")
        print(f"  照片缺失: {summary['photo_missing']} 台")
        print(f"  合同过期: {summary['contract_expired']} 台")
        print(f"  待复核: {summary['needs_review']} 台")
        
        time.sleep(0.5)
        
        print_separator("步骤8: 获取对账明细（待复核记录）")
        response = requests.get(f"{BASE_URL}/tasks/{task_id}/records?filter=needs_review")
        records = response.json()['records']
        print(f"  找到 {len(records)} 条待复核记录:")
        for r in records[:3]:
            print(f"    - {r['device_code']} ({r['floor']} {r['area']}): {r['issues']}")
        
        if records:
            print_separator("步骤9: 人工复核一条记录")
            record_id = records[0]['id']
            device_code = records[0]['device_code']
            review_data = {
                "review_notes": "已核实，维保已完成，照片后续补充。合同是与永安消防新签，有效期至2025年。",
                "corrections": {
                    "overall_status": "normal",
                    "photo_status": "normal",
                    "photo_count": 1
                }
            }
            response = requests.post(
                f"{BASE_URL}/records/{record_id}/review",
                json=review_data
            )
            print(f"✓ 已复核设备 {device_code}")
            
            time.sleep(0.5)
            
            print_separator("步骤10: 复核后查看更新的汇总数据")
            response = requests.get(f"{BASE_URL}/tasks/{task_id}/summary")
            summary = response.json()['summary']
            print(f"  待复核: {summary['needs_review']} 台")
            print(f"  已复核: {summary['reviewed']} 台")
        
        time.sleep(0.5)
        
        print_separator("步骤11: 生成对账报告")
        response = requests.get(f"{BASE_URL}/tasks/{task_id}/report/text")
        text_summary = response.json()['summary']
        print(text_summary)
        
        print_separator("步骤12: 下载Excel报告")
        response = requests.get(f"{BASE_URL}/tasks/{task_id}/report/excel")
        filename = f"对账报告_{task_code}.xlsx"
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"✓ Excel报告已保存: {filename}")
        
        print_separator("演示完成!")
        print(f"\n📋 已生成文件:")
        print(f"  - sample_devices.xlsx (设备台账样例)")
        print(f"  - sample_contracts.xlsx (合同数据样例)")
        print(f"  - sample_photos.xlsx (照片清单样例)")
        print(f"  - {filename} (对账结果报告)")
        print(f"\n🌐 API文档地址: http://localhost:8000/docs")
        
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先运行: python main.py")
    except Exception as e:
        print(f"❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    demo()
