#!/usr/bin/env python3
import argparse
import sys
import os
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"


def generate_mock_data(count: int, operator: str):
    print(f"[造数] 生成 {count} 条测试数据...")
    response = requests.post(
        f"{BASE_URL}/replay/mock-data",
        params={"count": count, "operator": operator}
    )
    result = response.json()
    print(f"[造数] 完成: 新增 {result['created_count']} 条, 重复 {result['duplicate_count']} 条")


def reconcile(operator: str):
    print(f"[对账] 开始对账检查...")
    response = requests.post(
        f"{BASE_URL}/replay/reconcile",
        params={"operator": operator}
    )
    result = response.json()
    print(f"[对账] 完成: 检查 {result['total_checked']} 条, 发现 {result['exceptions_found']} 条异常")
    if result["exceptions"]:
        for exc in result["exceptions"]:
            print(f"  - 记录 {exc['record_no']}: {len(exc['issues'])} 个问题")


def import_excel(file_path: str, data_source: str, imported_by: str):
    print(f"[导入] 文件: {file_path}, 来源: {data_source}")
    
    if not os.path.exists(file_path):
        print(f"[错误] 文件不存在: {file_path}")
        return
    
    with open(file_path, 'rb') as f:
        files = {'file': (os.path.basename(file_path), f)}
        data = {
            'data_source': data_source,
            'imported_by': imported_by
        }
        response = requests.post(
            f"{BASE_URL}/import/excel",
            files=files,
            data=data
        )
    
    result = response.json()
    print(f"[导入] 完成: 成功 {result['success_count']}, 重复 {result['duplicate_count']}, 失败 {result['failed_count']}")


def export_records(output_file: str = None):
    print(f"[导出] 导出耗材记录...")
    response = requests.post(f"{BASE_URL}/export/consumable-records")
    result = response.json()
    filename = result['filename']
    
    print(f"[导出] 完成: {result['record_count']} 条记录")
    print(f"[导出] 文件名: {filename}")
    print(f"[导出] 下载地址: {BASE_URL}/export/download/{filename}")


def change_status(record_id: int, new_status: str, reason: str, operator: str):
    print(f"[状态变更] 记录 {record_id}: {new_status}")
    
    data = {
        "new_status": new_status,
        "change_reason": reason,
        "operator": operator
    }
    
    response = requests.post(
        f"{BASE_URL}/records/{record_id}/change-status",
        json=data
    )
    
    if response.status_code == 200:
        print(f"[状态变更] 成功")
    else:
        print(f"[状态变更] 失败: {response.text}")


def resolve_exception(exception_id: int, resolution: str, resolved_by: str):
    print(f"[异常处理] 解决异常 {exception_id}")
    
    data = {
        "resolution": resolution,
        "resolved_by": resolved_by
    }
    
    response = requests.post(
        f"{BASE_URL}/replay/exceptions/{exception_id}/resolve",
        json=data
    )
    
    if response.status_code == 200:
        print(f"[异常处理] 成功")
    else:
        print(f"[异常处理] 失败: {response.text}")


def show_record(record_id: int):
    print(f"[查询] 记录详情: {record_id}")
    
    response = requests.get(f"{BASE_URL}/records/{record_id}/history")
    result = response.json()
    
    print("\n=== 基本信息 ===")
    for k, v in result['record'].items():
        print(f"  {k}: {v}")
    
    print("\n=== 状态变更历史 ===")
    for sh in result['status_history']:
        print(f"  [{sh['change_time']}] {sh['from_status']} -> {sh['to_status']}")
        print(f"      操作者: {sh['operator']}, 原因: {sh['change_reason']}")
    
    print("\n=== 导入证据 ===")
    if result['import_evidence']:
        ev = result['import_evidence']
        print(f"  来源文件: {ev['source_file_name']}")
        print(f"  行号: {ev['source_row_number']}")
        print(f"  人工改判: {'是' if ev['is_manual_corrected'] else '否'}")


def full_workflow():
    print("=" * 50)
    print("完整回放链路演示")
    print("=" * 50)
    
    print("\n[步骤1] 造数 - 生成测试数据")
    generate_mock_data(100, "cli_demo")
    
    print("\n[步骤2] 对账 - 检查异常")
    reconcile("cli_demo")
    
    print("\n[步骤3] 导出 - 导出记录清单")
    export_records()
    
    print("\n[步骤4] 导出异常 - 导出异常报告")
    response = requests.post(f"{BASE_URL}/export/exceptions")
    result = response.json()
    print(f"[导出异常] 完成: {result['exception_count']} 条异常")
    
    print("\n" + "=" * 50)
    print("回放链路演示完成")
    print("=" * 50)


def main():
    parser = argparse.ArgumentParser(description="学校实验室耗材验收回放链路服务 CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    mock_parser = subparsers.add_parser("mock", help="生成测试数据")
    mock_parser.add_argument("--count", type=int, default=50, help="生成数量")
    mock_parser.add_argument("--operator", default="system", help="操作者")
    
    reconcile_parser = subparsers.add_parser("reconcile", help="对账检查")
    reconcile_parser.add_argument("--operator", default="system", help="操作者")
    
    import_parser = subparsers.add_parser("import", help="导入Excel")
    import_parser.add_argument("--file", required=True, help="Excel文件路径")
    import_parser.add_argument("--source", required=True, 
                              choices=["领用单", "采购到货表", "老师补签记录", "临时补录单", "班次记录"],
                              help="数据来源")
    import_parser.add_argument("--by", default="system", help="导入人")
    
    export_parser = subparsers.add_parser("export", help="导出记录")
    export_parser.add_argument("--output", help="输出文件名")
    
    status_parser = subparsers.add_parser("status", help="变更状态")
    status_parser.add_argument("--id", type=int, required=True, help="记录ID")
    status_parser.add_argument("--to", required=True, help="新状态")
    status_parser.add_argument("--reason", required=True, help="变更原因")
    status_parser.add_argument("--operator", default="system", help="操作者")
    
    resolve_parser = subparsers.add_parser("resolve", help="解决异常")
    resolve_parser.add_argument("--id", type=int, required=True, help="异常ID")
    resolve_parser.add_argument("--resolution", required=True, help="处理方案")
    resolve_parser.add_argument("--by", default="system", help="处理人")
    
    show_parser = subparsers.add_parser("show", help="查看记录详情")
    show_parser.add_argument("--id", type=int, required=True, help="记录ID")
    
    subparsers.add_parser("workflow", help="运行完整工作流演示")
    
    args = parser.parse_args()
    
    if args.command == "mock":
        generate_mock_data(args.count, args.operator)
    elif args.command == "reconcile":
        reconcile(args.operator)
    elif args.command == "import":
        import_excel(args.file, args.source, args.by)
    elif args.command == "export":
        export_records(args.output)
    elif args.command == "status":
        change_status(args.id, args.to, args.reason, args.operator)
    elif args.command == "resolve":
        resolve_exception(args.id, args.resolution, args.by)
    elif args.command == "show":
        show_record(args.id)
    elif args.command == "workflow":
        full_workflow()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
