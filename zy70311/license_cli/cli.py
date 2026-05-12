import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

from .fingerprint import FingerprintGenerator
from .license import LicenseManager


def main():
    parser = argparse.ArgumentParser(
        description="离线许可证激活 CLI - 用于管理私有化部署的软件许可证",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 客户：生成机器指纹
  license-cli generate-fingerprint --output customerA_machine1.json
  
  # 售后：签发许可证
  license-cli issue --customer-id CUST001 --customer-name "客户A公司" \
      --features "基础功能,高级分析,报表导出" --max-machines 2 --validity-days 365
  
  # 客户：离线激活
  license-cli activate --license LIC-XXXXXXXX.json --fingerprint customerA_machine1.json
  
  # 查看授权状态
  license-cli status --license activated_license.json
  
  # 售后：续期许可证
  license-cli renew --license activated_license.json --additional-days 365
  
  # 售后：吊销许可证
  license-cli revoke --license-id LIC-XXXXXXXX --reason "客户违约"
  
  # 导出审计报告
  license-cli export-audit --output audit_report.json
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    parser_gen_fp = subparsers.add_parser("generate-fingerprint", help="生成机器指纹")
    parser_gen_fp.add_argument("--output", "-o", help="输出文件路径", default=None)
    parser_gen_fp.add_argument("--machine-id", help="指定机器ID（用于测试环境）", default=None)
    parser_gen_fp.add_argument("--output-dir", help="输出目录", default="./fingerprints")
    
    parser_issue = subparsers.add_parser("issue", help="售后签发许可证")
    parser_issue.add_argument("--customer-id", required=True, help="客户ID")
    parser_issue.add_argument("--customer-name", required=True, help="客户名称")
    parser_issue.add_argument("--features", required=True, help="授权功能列表，用逗号分隔")
    parser_issue.add_argument("--max-machines", type=int, required=True, help="最大授权机器数量")
    parser_issue.add_argument("--validity-days", type=int, required=True, help="有效天数")
    parser_issue.add_argument("--license-type", default="standard", help="许可证类型")
    parser_issue.add_argument("--output", help="输出文件路径", default=None)
    parser_issue.add_argument("--license-dir", help="许可证存储目录", default="./licenses")
    parser_issue.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    parser_activate = subparsers.add_parser("activate", help="客户离线激活许可证")
    parser_activate.add_argument("--license", required=True, help="许可证文件路径")
    parser_activate.add_argument("--fingerprint", required=True, help="机器指纹文件路径")
    parser_activate.add_argument("--output", help="激活后许可证输出路径", default=None)
    parser_activate.add_argument("--license-dir", help="许可证存储目录", default="./licenses")
    parser_activate.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    parser_status = subparsers.add_parser("status", help="查看授权状态")
    parser_status.add_argument("--license", required=True, help="许可证文件路径")
    parser_status.add_argument("--fingerprint", help="机器指纹文件路径（可选，用于验证绑定关系）", default=None)
    parser_status.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    parser_renew = subparsers.add_parser("renew", help="售后续期许可证")
    parser_renew.add_argument("--license", required=True, help="许可证文件路径")
    parser_renew.add_argument("--additional-days", type=int, required=True, help="续期天数")
    parser_renew.add_argument("--output", help="续期后许可证输出路径", default=None)
    parser_renew.add_argument("--license-dir", help="许可证存储目录", default="./licenses")
    parser_renew.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    parser_revoke = subparsers.add_parser("revoke", help="售后吊销许可证")
    parser_revoke.add_argument("--license-id", required=True, help="许可证ID")
    parser_revoke.add_argument("--reason", default="未提供原因", help="吊销原因")
    parser_revoke.add_argument("--license-dir", help="许可证存储目录", default="./licenses")
    parser_revoke.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    parser_export = subparsers.add_parser("export-audit", help="导出审计报告")
    parser_export.add_argument("--output", help="输出文件路径", default=None)
    parser_export.add_argument("--license-dir", help="许可证存储目录", default="./licenses")
    parser_export.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    parser_list = subparsers.add_parser("list", help="列出所有许可证")
    parser_list.add_argument("--customer-id", help="按客户ID筛选", default=None)
    parser_list.add_argument("--status", help="按状态筛选", default=None)
    parser_list.add_argument("--license-dir", help="许可证存储目录", default="./licenses")
    parser_list.add_argument("--key-dir", help="密钥目录", default="./keys")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    try:
        if args.command == "generate-fingerprint":
            return cmd_generate_fingerprint(args)
        elif args.command == "issue":
            return cmd_issue(args)
        elif args.command == "activate":
            return cmd_activate(args)
        elif args.command == "status":
            return cmd_status(args)
        elif args.command == "renew":
            return cmd_renew(args)
        elif args.command == "revoke":
            return cmd_revoke(args)
        elif args.command == "export-audit":
            return cmd_export_audit(args)
        elif args.command == "list":
            return cmd_list(args)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


def cmd_generate_fingerprint(args):
    output_dir = Path(args.output_dir)
    gen = FingerprintGenerator(output_dir)
    file_path, fp_data = gen.save_fingerprint(args.output, args.machine_id)
    print(json.dumps({
        "success": True,
        "message": "机器指纹生成成功",
        "file": str(file_path),
        "machine_id": fp_data["machine_id"],
        "fingerprint": fp_data["fingerprint"]
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_issue(args):
    license_dir = Path(args.license_dir)
    key_dir = Path(args.key_dir)
    manager = LicenseManager(license_dir, key_dir)
    
    features = [f.strip() for f in args.features.split(",")]
    
    signed_license = manager.issue_license(
        customer_id=args.customer_id,
        customer_name=args.customer_name,
        features=features,
        max_machines=args.max_machines,
        validity_days=args.validity_days,
        license_type=args.license_type
    )
    
    file_path = manager.save_license(signed_license, args.output)
    
    print(json.dumps({
        "success": True,
        "message": "许可证签发成功，请将此文件发送给客户进行离线激活",
        "file": str(file_path),
        "license_id": signed_license["data"]["license_id"],
        "customer_id": signed_license["data"]["customer_id"],
        "customer_name": signed_license["data"]["customer_name"],
        "valid_from": signed_license["data"]["valid_from"],
        "valid_until": signed_license["data"]["valid_until"],
        "features": signed_license["data"]["features"],
        "max_machines": signed_license["data"]["max_machines"]
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_activate(args):
    license_dir = Path(args.license_dir)
    key_dir = Path(args.key_dir)
    manager = LicenseManager(license_dir, key_dir)
    
    with open(args.fingerprint, 'r', encoding='utf-8') as f:
        fp_data = json.load(f)
    
    with open(args.license, 'r', encoding='utf-8') as f:
        signed_license = json.load(f)
    
    activated = manager.activate_license(
        signed_license,
        machine_fingerprint=fp_data["fingerprint"],
        machine_id=fp_data["machine_id"]
    )
    
    if not args.output:
        license_id = activated["data"]["license_id"]
        args.output = f"{license_id}_activated.json"
    
    output_path = license_dir / args.output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(activated, f, indent=2, ensure_ascii=False)
    
    print(json.dumps({
        "success": True,
        "message": "许可证激活成功",
        "file": str(output_path),
        "license_id": activated["data"]["license_id"],
        "status": activated["data"]["status"],
        "activated_at": activated["data"]["activated_at"],
        "machine_id": activated["data"]["activated_machine_id"],
        "valid_until": activated["data"]["valid_until"]
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_status(args):
    key_dir = Path(args.key_dir)
    license_dir = Path("./licenses")
    manager = LicenseManager(license_dir, key_dir)
    
    with open(args.license, 'r', encoding='utf-8') as f:
        signed_license = json.load(f)
    
    machine_fp = None
    if args.fingerprint:
        with open(args.fingerprint, 'r', encoding='utf-8') as f:
            fp_data = json.load(f)
            machine_fp = fp_data["fingerprint"]
    
    status = manager.check_license_status(signed_license, machine_fp)
    
    print(json.dumps({
        "success": status["status"] not in ["invalid", "revoked", "expired", "fingerprint_mismatch"],
        "status": status,
        "message": f"许可证状态: {status['status']}"
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_renew(args):
    license_dir = Path(args.license_dir)
    key_dir = Path(args.key_dir)
    manager = LicenseManager(license_dir, key_dir)
    
    with open(args.license, 'r', encoding='utf-8') as f:
        signed_license = json.load(f)
    
    renewed = manager.renew_license(signed_license, args.additional_days)
    
    if not args.output:
        license_id = renewed["data"]["license_id"]
        args.output = f"{license_id}_renewed.json"
    
    output_path = license_dir / args.output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(renewed, f, indent=2, ensure_ascii=False)
    
    print(json.dumps({
        "success": True,
        "message": f"许可证续期成功，延长了 {args.additional_days} 天",
        "file": str(output_path),
        "license_id": renewed["data"]["license_id"],
        "new_valid_until": renewed["data"]["valid_until"],
        "version": renewed["data"]["version"],
        "renewal_history": renewed["data"]["renewal_history"]
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_revoke(args):
    license_dir = Path(args.license_dir)
    key_dir = Path(args.key_dir)
    manager = LicenseManager(license_dir, key_dir)
    
    revoked = manager.revoke_license(args.license_id, args.reason)
    
    print(json.dumps({
        "success": True,
        "message": "许可证已成功吊销，该许可证将无法再激活或续期",
        "license_id": revoked["license_id"],
        "customer_id": revoked["customer_id"],
        "customer_name": revoked["customer_name"],
        "revoked_at": revoked["revoked_at"],
        "reason": revoked["revocation_reason"]
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_export_audit(args):
    license_dir = Path(args.license_dir)
    key_dir = Path(args.key_dir)
    manager = LicenseManager(license_dir, key_dir)
    
    report_path = manager.export_audit_report(args.output)
    
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    print(json.dumps({
        "success": True,
        "message": "审计报告导出成功",
        "file": str(report_path),
        "summary": report["summary"]
    }, indent=2, ensure_ascii=False))
    return 0


def cmd_list(args):
    license_dir = Path(args.license_dir)
    key_dir = Path(args.key_dir)
    manager = LicenseManager(license_dir, key_dir)
    
    licenses = manager.list_licenses(args.customer_id, args.status)
    
    result = []
    for lic in licenses:
        result.append({
            "license_id": lic["license_id"],
            "customer_id": lic["customer_id"],
            "customer_name": lic["customer_name"],
            "status": lic.get("status", "inactive"),
            "valid_from": lic["valid_from"],
            "valid_until": lic["valid_until"],
            "activated_machine_id": lic.get("activated_machine_id")
        })
    
    print(json.dumps({
        "success": True,
        "total": len(result),
        "licenses": result
    }, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
