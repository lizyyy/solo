import argparse
import os
import sys
from datetime import datetime
from typing import Dict, List
from collections import defaultdict

from access_gate_cli.parser import (
    parse_personnel_csv,
    parse_access_requests_csv,
    parse_zone_rules_yaml,
    parse_device_clock_jsonl
)
from access_gate_cli.rules import RulesEngine, ValidationResult, Violation
from access_gate_cli.issuer import PackageIssuer, AccessEntry, AccessType
from access_gate_cli.reporter import (
    generate_audit_report,
    generate_violations_csv,
    AuditReportData
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="临时园区离线门禁控制器权限包签发工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python -m access_gate_cli --personnel samples/personnel.csv \\
                             --zone-rules samples/zone_rules.yaml \\
                             --device-clock samples/device_clock.jsonl \\
                             --access-requests samples/access_requests.csv \\
                             --output-dir ./output
        """
    )
    
    parser.add_argument(
        "--personnel", "-p",
        required=True,
        help="人员信息 CSV 文件路径"
    )
    parser.add_argument(
        "--zone-rules", "-z",
        required=True,
        help="门区规则 YAML 文件路径"
    )
    parser.add_argument(
        "--device-clock", "-c",
        required=True,
        help="设备时钟 JSONL 文件路径"
    )
    parser.add_argument(
        "--access-requests", "-r",
        required=True,
        help="权限申请 CSV 文件路径"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default="./output",
        help="输出目录路径 (默认: ./output)"
    )
    parser.add_argument(
        "--version", "-v",
        action="version",
        version="%(prog)s 0.1.0"
    )
    
    return parser.parse_args()


def ensure_output_dir(output_dir: str):
    packages_dir = os.path.join(output_dir, "device_packages")
    os.makedirs(packages_dir, exist_ok=True)
    return output_dir, packages_dir


def group_requests_by_device(
    valid_requests,
    zone_rules,
    personnel
) -> Dict[str, List[AccessEntry]]:
    device_entries = defaultdict(list)
    
    for request in valid_requests:
        zone = zone_rules.zones.get(request.zone_id)
        if not zone:
            continue
        
        person = personnel.get(request.personnel_id)
        if not person:
            continue
        
        access_type = AccessType.GRANT if request.request_type == 'grant' else AccessType.REVOKE
        
        entry = AccessEntry(
            personnel_id=person.personnel_id,
            name=person.name,
            card_id=person.card_id,
            role=person.role,
            zone_id=request.zone_id,
            access_type=access_type,
            start_time=request.start_time.isoformat(),
            end_time=request.end_time.isoformat(),
            request_id=request.request_id,
            priority=request.priority
        )
        
        for device_id in zone.device_ids:
            device_entries[device_id].append(entry)
    
    return dict(device_entries)


def run_cli():
    args = parse_args()
    
    print("=" * 70)
    print("临时园区离线门禁控制器权限包签发工具")
    print("=" * 70)
    print()
    
    output_dir, packages_dir = ensure_output_dir(args.output_dir)
    
    print("[步骤 1/5] 解析输入文件...")
    try:
        personnel = parse_personnel_csv(args.personnel)
        print(f"  ✓ 读取人员信息: {len(personnel)} 条记录")
        
        zone_rules = parse_zone_rules_yaml(args.zone_rules)
        print(f"  ✓ 读取门区规则: {len(zone_rules.zones)} 个门区, {len(zone_rules.devices)} 台设备")
        
        device_clocks = parse_device_clock_jsonl(args.device_clock)
        print(f"  ✓ 读取设备时钟: {len(device_clocks)} 台设备")
        
        access_requests = parse_access_requests_csv(args.access_requests)
        print(f"  ✓ 读取权限申请: {len(access_requests)} 条申请")
    except Exception as e:
        print(f"  ✗ 解析输入文件失败: {e}")
        sys.exit(1)
    
    print()
    print("[步骤 2/5] 规则引擎验证...")
    rules_engine = RulesEngine(
        zone_rules=zone_rules,
        personnel=personnel,
        device_clocks=device_clocks
    )
    
    validation_result = rules_engine.validate_all_requests(access_requests)
    
    if validation_result.is_valid:
        print("  ✓ 规则验证通过")
    else:
        print(f"  ⚠ 发现违规: {len(validation_result.violations)} 项违规, {len(validation_result.warnings)} 项警告")
    
    print()
    print("[步骤 3/5] 生成设备权限包...")
    
    hmac_keys = {
        device_id: device.hmac_key
        for device_id, device in zone_rules.devices.items()
    }
    
    issuer = PackageIssuer(hmac_keys=hmac_keys)
    
    valid_requests = [
        req for req in access_requests
        if _is_request_valid(req, validation_result)
    ]
    
    device_entries = group_requests_by_device(
        valid_requests,
        zone_rules,
        personnel
    )
    
    generated_packages = []
    for device_id, entries in device_entries.items():
        if device_id not in zone_rules.devices:
            print(f"  ⚠ 跳过未知设备: {device_id}")
            continue
        
        try:
            package = issuer.create_device_package(device_id, entries)
            
            output_path = os.path.join(packages_dir, f"{device_id}.json")
            issuer.export_package_to_file(package, output_path)
            
            generated_packages.append(package)
            print(f"  ✓ 生成权限包: {device_id}.json ({len(entries)} 条权限)")
        except Exception as e:
            print(f"  ✗ 生成权限包失败 {device_id}: {e}")
    
    if generated_packages:
        print()
        print("[步骤 4/5] 验证生成的权限包...")
        for pkg in generated_packages:
            is_valid = issuer.verify_device_package(pkg)
            status = "✓" if is_valid else "✗"
            print(f"  {status} HMAC 签名验证: {pkg.device_id}")
    
    print()
    print("[步骤 5/5] 生成审计报告...")
    
    all_violations = validation_result.violations + validation_result.warnings
    
    report_data = AuditReportData(
        generated_at=datetime.now().isoformat(),
        total_requests=len(access_requests),
        valid_requests=len(valid_requests),
        invalid_requests=len(access_requests) - len(valid_requests),
        total_violations=len(validation_result.violations),
        total_warnings=len(validation_result.warnings),
        violations=validation_result.violations,
        warnings=validation_result.warnings,
        device_packages=generated_packages,
        devices_processed=[pkg.device_id for pkg in generated_packages],
        personnel_count=len(personnel),
        zones_count=len(zone_rules.zones),
        devices_count=len(zone_rules.devices)
    )
    
    if all_violations:
        from collections import defaultdict
        severity_counts = defaultdict(int)
        for v in all_violations:
            severity_counts[v.severity.value] += 1
        report_data.summary_by_severity = dict(severity_counts)
    
    audit_report_path = os.path.join(output_dir, "audit_report.md")
    generate_audit_report(report_data, audit_report_path)
    print(f"  ✓ 生成审计报告: audit_report.md")
    
    violations_csv_path = os.path.join(output_dir, "violations.csv")
    generate_violations_csv(all_violations, violations_csv_path)
    print(f"  ✓ 生成违规记录: violations.csv")
    
    print()
    print("=" * 70)
    print("执行完成!")
    print("=" * 70)
    print()
    print(f"输出目录: {os.path.abspath(output_dir)}")
    print()
    print(f"权限包数量: {len(generated_packages)}")
    print(f"违规数量: {len(validation_result.violations)} (BLOCKING)")
    print(f"警告数量: {len(validation_result.warnings)} (NON-BLOCKING)")
    print()
    
    if generated_packages:
        print("成功生成的权限包:")
        for pkg in generated_packages:
            print(f"  - device_packages/{pkg.device_id}.json ({len(pkg.access_entries)} 条权限)")
    
    if validation_result.violations:
        print()
        print("检测到的违规 (需要关注):")
        for idx, v in enumerate(validation_result.violations[:5], 1):
            print(f"  {idx}. [{v.severity.value.upper()}] {v.message[:60]}...")
        if len(validation_result.violations) > 5:
            print(f"  ... 还有 {len(validation_result.violations) - 5} 项违规，请查看 violations.csv")
    
    return 0


def _is_request_valid(request, validation_result: ValidationResult) -> bool:
    for violation in validation_result.violations:
        if violation.request_id == request.request_id:
            return False
    return True


def main():
    try:
        sys.exit(run_cli())
    except KeyboardInterrupt:
        print("\n\n操作已取消")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
