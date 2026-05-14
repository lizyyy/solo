import argparse
import sys
from datetime import datetime
from pathlib import Path

from .models import Dependency, SourceLocation, ManualStatus
from .storage import Storage
from .detector import LicenseDetector
from .reporter import Reporter


def cmd_scan(args):
    storage = Storage()
    detector = LicenseDetector()
    reporter = Reporter(storage)

    input_file = args.input
    if not Path(input_file).exists():
        print(f"错误: 输入文件不存在: {input_file}")
        sys.exit(1)

    import json

    with open(input_file, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    dependencies = []
    for i, item in enumerate(raw_data):
        dep = Dependency(
            name=item.get("name", ""),
            version=item.get("version", ""),
            license=item.get("license", ""),
            source=item.get("source", ""),
            environment_name=item.get("environment_name", "default"),
            source_location=SourceLocation(
                file_path=input_file,
                line_number=i + 1,
                raw_context=json.dumps(item, ensure_ascii=False),
            ),
            raw_input=item,
        )
        dependencies.append(dep)

    result_name = args.name or f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    storage.save_dependencies(dependencies, result_name)

    use_overbroad = args.overbroad or False
    result = detector.audit(dependencies, use_overbroad_rules=use_overbroad)

    storage.save_audit_records(result.records, result_name)
    storage.save_evidences(result.evidences, result_name)
    storage.save_result(result, result_name)

    report_path = f"reports/{result_name}_report.txt"
    reporter.generate_text_report(result, report_path)
    print(f"报告已生成: {report_path}")

    audit_dir_path = f"reports/{result_name}_audit_directory.txt"
    reporter.generate_audit_directory_report(result, audit_dir_path)
    print(f"审计取证目录已生成: {audit_dir_path}")

    print(f"\n扫描完成:")
    print(f"  总依赖数: {result.total_dependencies}")
    print(f"  通过: {result.pass_count}")
    print(f"  失败: {result.fail_count}")
    print(f"  警告: {result.warning_count}")
    print(f"  待处理: {result.pending_count}")


def cmd_list(args):
    storage = Storage()
    results = storage.list_results()
    if not results:
        print("没有找到扫描结果")
        return

    print("扫描结果列表:")
    for name in results:
        result = storage.load_result(name)
        if result:
            print(f"\n  {name}")
            print(f"    生成时间: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    总依赖: {result.total_dependencies}, 通过: {result.pass_count}, 失败: {result.fail_count}")


def cmd_query(args):
    storage = Storage()
    reporter = Reporter(storage)

    if args.environment:
        print(reporter.query_by_environment(args.environment))
    else:
        print("请指定查询条件: --environment")


def cmd_correct(args):
    storage = Storage()

    result_name = args.result
    record_id = args.record_id
    status = args.status
    remark = args.remark
    operator = args.operator or "unknown"
    rule_filter = args.rule
    fail_only = args.fail_only

    records = storage.load_audit_records(result_name)
    
    matched_records = []
    for record in records:
        if record.id == record_id or record.dependency_name == record_id:
            matched_records.append(record)

    if not matched_records:
        print(f"错误: 未找到记录: {record_id}")
        sys.exit(1)

    if rule_filter:
        matched_records = [r for r in matched_records if r.detection_rule_name == rule_filter]
        if not matched_records:
            print(f"错误: 在规则 '{rule_filter}' 下未找到匹配记录")
            sys.exit(1)

    if fail_only:
        from .models import DetectionStatus
        matched_records = [r for r in matched_records if r.system_status == DetectionStatus.FAIL]
        if not matched_records:
            print(f"错误: 未找到失败状态的匹配记录")
            sys.exit(1)

    target_record = None
    if len(matched_records) == 1:
        target_record = matched_records[0]
    else:
        print(f"找到 {len(matched_records)} 条匹配记录，请选择要修正的记录:")
        for i, record in enumerate(matched_records, 1):
            has_manual = " [已人工审核]" if record.manual_status else ""
            print(f"  [{i}] 记录ID: {record.id}")
            print(f"      依赖: {record.dependency_name}")
            print(f"      规则: {record.detection_rule_name}")
            print(f"      系统状态: {record.system_status.value}{has_manual}")
            if record.field_errors:
                print(f"      字段错误: {len(record.field_errors)} 个")
        
        while True:
            try:
                choice = int(input(f"\n请输入序号 (1-{len(matched_records)}): ")) - 1
                if 0 <= choice < len(matched_records):
                    target_record = matched_records[choice]
                    break
                else:
                    print(f"请输入 1 到 {len(matched_records)} 之间的数字")
            except ValueError:
                print("请输入有效的数字")

    manual_status = ManualStatus(status)
    target_record.manual_status = manual_status
    target_record.manual_remark = remark
    target_record.operator = operator
    target_record.updated_at = datetime.now()

    storage.update_audit_record(target_record, result_name)

    print(f"\n人工修正已保存:")
    print(f"  记录ID: {target_record.id}")
    print(f"  依赖: {target_record.dependency_name}")
    print(f"  规则: {target_record.detection_rule_name}")
    print(f"  系统状态: {target_record.system_status.value}")
    print(f"  人工状态: {manual_status.value}")
    print(f"  备注: {remark}")
    print(f"  操作人: {operator}")


def cmd_rules(args):
    detector = LicenseDetector()
    rules = detector.get_rules(include_overbroad=True)

    print("检测规则列表:")
    for rule in rules:
        overbroad_mark = "[过宽规则]" if rule.is_overbroad else "[正常规则]"
        print(f"\n  {rule.name} {overbroad_mark}")
        print(f"    描述: {rule.description}")
        print(f"    模式: {rule.pattern}")
        print(f"    严重程度: {rule.severity}")


def main():
    parser = argparse.ArgumentParser(description="依赖许可证巡检工具")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    scan_parser = subparsers.add_parser("scan", help="扫描依赖许可证")
    scan_parser.add_argument("--input", required=True, help="输入JSON文件路径")
    scan_parser.add_argument("--name", help="扫描结果名称")
    scan_parser.add_argument("--overbroad", action="store_true", help="使用过宽规则进行检测")

    list_parser = subparsers.add_parser("list", help="列出所有扫描结果")

    query_parser = subparsers.add_parser("query", help="查询审计记录")
    query_parser.add_argument("--environment", help="按环境名称查询")

    correct_parser = subparsers.add_parser("correct", help="人工修正审计记录")
    correct_parser.add_argument("--result", required=True, help="扫描结果名称")
    correct_parser.add_argument("--record-id", required=True, help="记录ID或依赖名称")
    correct_parser.add_argument("--status", required=True, choices=["confirmed", "rejected", "needs_review"], help="人工状态")
    correct_parser.add_argument("--remark", required=True, help="修正备注")
    correct_parser.add_argument("--operator", help="操作人")
    correct_parser.add_argument("--rule", help="指定要修正的规则名称")
    correct_parser.add_argument("--fail-only", action="store_true", help="只匹配失败状态的记录")

    rules_parser = subparsers.add_parser("rules", help="查看检测规则")

    args = parser.parse_args()

    if args.command == "scan":
        cmd_scan(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "query":
        cmd_query(args)
    elif args.command == "correct":
        cmd_correct(args)
    elif args.command == "rules":
        cmd_rules(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
