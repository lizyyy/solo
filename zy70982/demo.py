#!/usr/bin/env python3
"""
市政运维对账服务演示脚本
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def health_check():
    print_section("1. 健康检查")
    response = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def import_sample_data():
    print_section("2. 导入示例数据")
    
    print("导入告警CSV...")
    with open("sample_data/alarms.csv", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/import/alarms/csv",
            files={"file": ("alarms.csv", f, "text/csv")}
        )
    print(f"  告警导入结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    print("导入巡查JSON...")
    with open("sample_data/inspections.json", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/import/inspections/json",
            files={"file": ("inspections.json", f, "application/json")}
        )
    print(f"  巡查导入结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    print("导入维修单CSV...")
    with open("sample_data/work_orders.csv", "rb") as f:
        response = requests.post(
            f"{BASE_URL}/import/work-orders/csv",
            files={"file": ("work_orders.csv", f, "text/csv")}
        )
    print(f"  维修单导入结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")


def create_and_run_reconciliation():
    print_section("3. 创建并执行对账批次")
    
    print("创建对账批次...")
    batch_data = {
        "batch_id": "BATCH_202401",
        "name": "2024年1月路灯故障对账",
        "description": "1月份智慧路灯故障派修对账",
        "created_by": "市政运维管理员"
    }
    response = requests.post(f"{BASE_URL}/reconciliation/start", json=batch_data)
    print(f"  批次创建结果: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    print("\n执行自动比对...")
    response = requests.post(f"{BASE_URL}/reconciliation/BATCH_202401/run")
    result = response.json()
    print(f"  比对完成!")
    print(f"  总记录数: {result['total_records']}")
    print(f"  匹配成功: {result['matched_count']}")
    print(f"  存在差异: {result['discrepancy_count']}")
    print(f"  待复核: {result['pending_review']}")
    
    return result


def view_discrepancies():
    print_section("4. 查看差异记录")
    
    response = requests.get(f"{BASE_URL}/reconciliation/BATCH_202401/records?status=discrepancy")
    records = response.json()
    
    print(f"发现 {len(records)} 条差异记录:\n")
    
    for i, record in enumerate(records[:3], 1):
        print(f"--- 差异记录 #{i} ---")
        print(f"  对账ID: {record['reconciliation_id']}")
        print(f"  灯杆/灯具: {record['pole_id']}/{record['light_id']}")
        print(f"  状态: {record['status']}")
        
        if record['discrepancies']:
            print(f"  差异详情:")
            for disc in record['discrepancies']:
                print(f"    - {disc['type']}: {disc['description']}")
        print()


def review_record():
    print_section("5. 人工复核")
    
    response = requests.get(f"{BASE_URL}/reconciliation/BATCH_202401/records?status=discrepancy")
    records = response.json()
    
    if not records:
        print("没有待复核的记录")
        return
    
    record = records[0]
    record_id = record['id']
    
    print(f"复核记录 ID: {record_id}")
    print(f"灯杆/灯具: {record['pole_id']}/{record['light_id']}")
    
    resolve_discs = [disc['id'] for disc in record['discrepancies']]
    
    review_data = {
        "record_id": record_id,
        "reviewer": "张工",
        "status": "approved",
        "comment": "已核实，数据无误",
        "explanation": "告警与维修单时间匹配，现场巡查确认故障属实，同意放行",
        "resolve_discrepancies": resolve_discs
    }
    
    response = requests.post(f"{BASE_URL}/review", json=review_data)
    result = response.json()
    
    print(f"\n复核完成!")
    print(f"  复核状态: {result['review_status']}")
    print(f"  复核人: {result['review_histories'][0]['reviewer']}")
    print(f"  复核意见: {result['review_histories'][0]['comment']}")
    print(f"  说明: {result['review_histories'][0]['explanation']}")


def trace_work_order():
    print_section("6. 全链路追踪 - 维修单 WO001")
    
    response = requests.get(f"{BASE_URL}/trace/work-order/WO001")
    trace = response.json()
    
    print(f"对账记录ID: {trace['record_id']}")
    print(f"灯杆/灯具: {trace['pole_id']}/{trace['light_id']}")
    print(f"状态: {trace['status']} / 复核状态: {trace['review_status']}\n")
    
    if trace['alarm']:
        print("--- 告警信息 ---")
        print(f"  告警ID: {trace['alarm']['alarm_id']}")
        print(f"  类型: {trace['alarm']['alarm_type']}")
        print(f"  时间: {trace['alarm']['alarm_time']}")
        print(f"  描述: {trace['alarm']['description']}")
    
    if trace['inspection']:
        print("\n--- 巡查信息 ---")
        print(f"  巡查ID: {trace['inspection']['inspection_id']}")
        print(f"  巡查人: {trace['inspection']['inspector']}")
        print(f"  时间: {trace['inspection']['inspection_time']}")
        print(f"  发现问题: {trace['inspection']['issues_found']}")
    
    if trace['work_order']:
        print("\n--- 维修单信息 ---")
        print(f"  单号: {trace['work_order']['order_id']}")
        print(f"  维修类型: {trace['work_order']['repair_type']}")
        print(f"  派单时间: {trace['work_order']['report_time']}")
        print(f"  维修人: {trace['work_order']['repairer']}")
        print(f"  状态: {trace['work_order']['status']}")
    
    if trace['discrepancies']:
        print("\n--- 差异记录 ---")
        for disc in trace['discrepancies']:
            status = "已解决" if disc['is_resolved'] else "未解决"
            print(f"  [{status}] {disc['type']}: {disc['description']}")


def generate_report():
    print_section("7. 生成报告")
    
    print("获取报告汇总...")
    response = requests.get(f"{BASE_URL}/report/BATCH_202401/summary")
    summary = response.json()
    
    print(f"\n对账汇总:")
    print(f"  批次: {summary['batch_name']}")
    print(f"  总记录数: {summary['total_records']}")
    print(f"  匹配成功: {summary['matched_count']}")
    print(f"  存在差异: {summary['discrepancy_count']}")
    print(f"  已复核: {summary['reviewed_count']}")
    print(f"  已放行: {summary['approved_count']}")
    print(f"  已退回: {summary['rejected_count']}")
    print(f"  需补材料: {summary['needs_more_info_count']}")
    
    print(f"\n差异类型统计:")
    for dtype, data in summary['discrepancy_by_type'].items():
        print(f"  {dtype}: 总数{data['total']}, 已解决{data['resolved']}, 未解决{data['unresolved']}")
    
    print(f"\n下载Excel报告...")
    response = requests.get(f"{BASE_URL}/report/BATCH_202401/download/excel")
    with open("reconciliation_report_BATCH_202401.xlsx", "wb") as f:
        f.write(response.content)
    print("  报告已保存为: reconciliation_report_BATCH_202401.xlsx")


def main():
    print("\n" + "="*60)
    print("  市政运维对账服务 - 完整演示")
    print("="*60)
    
    try:
        health_check()
        import_sample_data()
        create_and_run_reconciliation()
        view_discrepancies()
        review_record()
        trace_work_order()
        generate_report()
        
        print_section("演示完成!")
        print(f"API文档地址: {BASE_URL}/docs")
        print(f"报告文件: reconciliation_report_BATCH_202401.xlsx")
        
    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到服务")
        print("请先启动服务: ./start.sh")
    except Exception as e:
        print(f"\n❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
