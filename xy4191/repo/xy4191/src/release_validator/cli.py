import argparse
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

from . import __version__
from .indexer import FileIndexer
from .parsers import ChecksumParser
from .rules import RuleEngine, VerificationResult


def get_project_root() -> Path:
    return Path(__file__).parent.parent.parent.parent


def cmd_scan(args) -> int:
    target_path = Path(args.path).resolve()
    
    if not target_path.exists():
        print(f"错误: 路径不存在: {target_path}", file=sys.stderr)
        return 1
    
    print(f"正在扫描目录: {target_path}")
    print("-" * 60)
    
    indexer = FileIndexer(target_path)
    entries = indexer.scan()
    
    print(f"\n扫描完成，共找到 {len(entries)} 个文件")
    print()
    
    summary = indexer.get_index_summary()
    print("文件类型统计:")
    for file_type, count in summary.get("files_by_type", {}).items():
        print(f"  {file_type}: {count} 个文件")
    
    if summary.get("versions_detected"):
        print(f"\n检测到的版本号: {', '.join(summary['versions_detected'])}")
    
    if args.output:
        output_path = Path(args.output)
        index_data = {
            "summary": summary,
            "files": {
                path: {
                    "filename": entry.filename,
                    "file_type": entry.file_type,
                    "size": entry.size,
                    "sha256": entry.sha256,
                    "version": entry.version,
                    "scan_time": entry.scan_time,
                }
                for path, entry in entries.items()
            }
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n索引已保存到: {output_path}")
    
    if args.verbose:
        print("\n文件详情:")
        for path, entry in entries.items():
            print(f"\n  {entry.filename}")
            print(f"    路径: {entry.path}")
            print(f"    类型: {entry.file_type}")
            print(f"    大小: {entry.size} 字节")
            print(f"    SHA256: {entry.sha256}")
            if entry.version:
                print(f"    版本: {entry.version}")
    
    return 0


def cmd_verify(args) -> int:
    target_path = Path(args.path).resolve()
    
    if not target_path.exists():
        print(f"错误: 路径不存在: {target_path}", file=sys.stderr)
        return 1
    
    print(f"正在验证目录: {target_path}")
    print("-" * 60)
    
    indexer = FileIndexer(target_path)
    indexer.scan()
    
    engine = RuleEngine(indexer)
    
    if args.disable_rules:
        for rule_id in args.disable_rules:
            engine.disable_rule(rule_id)
            print(f"已禁用规则: {rule_id}")
    
    if args.enable_rules:
        for rule_id in engine.rules:
            engine.disable_rule(rule_id)
        for rule_id in args.enable_rules:
            engine.enable_rule(rule_id)
            print(f"已启用规则: {rule_id}")
    
    print("\n执行验证规则...")
    
    result = engine.verify({})
    
    print("\n" + "=" * 60)
    print(f"验证结果: {'通过' if result.overall_passed else '失败'}")
    print(f"总违规数: {result.total_violations}")
    
    critical_count = len(result.critical_violations)
    if critical_count > 0:
        print(f"严重违规: {critical_count}")
    
    print("=" * 60)
    
    for rule_result in result.results:
        status = "通过" if rule_result.passed else "失败"
        symbol = "✓" if rule_result.passed else "✗"
        
        print(f"\n{symbol} {rule_result.rule_name} [{status}]")
        
        if rule_result.violations:
            for violation in rule_result.violations:
                print(f"   - [{violation.severity.value}] {violation.message}")
                if violation.file:
                    print(f"     文件: {violation.file}")
                    if violation.line:
                        print(f"     行号: {violation.line}")
                if violation.expected is not None:
                    print(f"     期望: {violation.expected}")
                    print(f"     实际: {violation.actual}")
        
        if rule_result.warnings:
            for warning in rule_result.warnings:
                print(f"   ⚠ [{warning.severity.value}] {warning.message}")
    
    if args.output:
        output_path = Path(args.output)
        
        result_data = {
            "overall_passed": result.overall_passed,
            "total_violations": result.total_violations,
            "critical_violations_count": len(result.critical_violations),
            "scan_time": result.scan_time,
            "target_path": result.target_path,
            "results": [],
        }
        
        for rule_result in result.results:
            rule_data = {
                "rule_id": rule_result.rule_id,
                "rule_name": rule_result.rule_name,
                "passed": rule_result.passed,
                "duration_ms": rule_result.duration_ms,
                "violations": [
                    {
                        "rule_id": v.rule_id,
                        "rule_name": v.rule_name,
                        "severity": v.severity.value,
                        "message": v.message,
                        "file": v.file,
                        "line": v.line,
                        "expected": v.expected,
                        "actual": v.actual,
                        "details": v.details,
                    }
                    for v in rule_result.violations
                ],
                "warnings": [
                    {
                        "rule_id": w.rule_id,
                        "rule_name": w.rule_name,
                        "severity": w.severity.value,
                        "message": w.message,
                        "file": w.file,
                        "line": w.line,
                    }
                    for w in rule_result.warnings
                ],
                "metadata": rule_result.metadata,
            }
            result_data["results"].append(rule_data)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
        
        print(f"\n验证结果已保存到: {output_path}")
    
    return 0 if result.overall_passed else 1


def cmd_quarantine(args) -> int:
    target_path = Path(args.path).resolve()
    
    if not target_path.exists():
        print(f"错误: 路径不存在: {target_path}", file=sys.stderr)
        return 1
    
    quarantine_dir = Path(args.quarantine_dir) if args.quarantine_dir else target_path / ".quarantine"
    quarantine_dir = quarantine_dir.resolve()
    
    print(f"隔离区路径: {quarantine_dir}")
    print(f"目标路径: {target_path}")
    print("-" * 60)
    
    from .quarantine import QuarantineManager
    
    qm = QuarantineManager(quarantine_base=quarantine_dir)
    
    indexer = FileIndexer(target_path)
    indexer.scan()
    
    checksum_entries = indexer.get_by_type("checksum")
    if not checksum_entries:
        print("警告: 未找到checksums文件，无法执行哈希校验隔离")
        print("       请先运行 'verify' 命令获取验证结果")
        return 1
    
    base_path = indexer.base_path
    parser = ChecksumParser()
    
    quarantined_files = []
    
    for cs_entry in checksum_entries:
        cs_path = base_path / cs_entry.path
        parser.parse(cs_path)
        
        for filename, cs_hash_entry in parser.filename_to_entry.items():
            actual_entry = None
            for path, entry in indexer.entries.items():
                if entry.filename == filename or path.endswith(filename):
                    actual_entry = entry
                    break
            
            if actual_entry:
                if actual_entry.sha256.lower() != cs_hash_entry.hash_value.lower():
                    source_path = base_path / actual_entry.path
                    reason = f"哈希不匹配 (期望: {cs_hash_entry.hash_value[:16]}..., 实际: {actual_entry.sha256[:16]}...)"
                    
                    print(f"隔离: {actual_entry.path}")
                    print(f"  原因: {reason}")
                    
                    quarantined = qm.quarantine(
                        source_path=source_path,
                        reason=reason,
                        category="hash_mismatch",
                        original_base=target_path,
                    )
                    
                    if quarantined:
                        quarantined_files.append({
                            "original": actual_entry.path,
                            "quarantined": str(quarantined),
                            "reason": reason,
                        })
    
    if args.force and args.violations_json:
        violations_path = Path(args.violations_json)
        if violations_path.exists():
            with open(violations_path, 'r', encoding='utf-8') as f:
                violations_data = json.load(f)
            
            for result in violations_data.get("results", []):
                for violation in result.get("violations", []):
                    file_path = violation.get("file")
                    if file_path:
                        full_path = target_path / file_path
                        if full_path.exists():
                            reason = violation.get("message", "验证失败")
                            category = violation.get("rule_id", "unknown")
                            
                            print(f"隔离: {file_path}")
                            print(f"  原因: {reason}")
                            
                            quarantined = qm.quarantine(
                                source_path=full_path,
                                reason=reason,
                                category=category,
                                original_base=target_path,
                            )
                            
                            if quarantined:
                                quarantined_files.append({
                                    "original": file_path,
                                    "quarantined": str(quarantined),
                                    "reason": reason,
                                })
    
    print("\n" + "=" * 60)
    print(f"隔离完成: {len(quarantined_files)} 个文件")
    print(f"隔离区: {quarantine_dir}")
    
    if quarantined_files:
        manifest_path = qm.get_manifest_path()
        print(f"隔离清单: {manifest_path}")
    
    return 0


def cmd_report(args) -> int:
    from .reporter import Reporter
    
    target_path = Path(args.path).resolve() if args.path else None
    output_dir = Path(args.output_dir) if args.output_dir else Path.cwd() / "reports"
    output_dir = output_dir.resolve()
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"生成报告...")
    print(f"输出目录: {output_dir}")
    print("-" * 60)
    
    indexer = None
    verification_result = None
    
    if target_path and target_path.exists():
        indexer = FileIndexer(target_path)
        indexer.scan()
        
        engine = RuleEngine(indexer)
        verification_result = engine.verify({})
    
    reporter = Reporter(output_dir=output_dir)
    
    files = []
    if indexer:
        for path, entry in indexer.entries.items():
            files.append({
                "path": entry.path,
                "filename": entry.filename,
                "file_type": entry.file_type,
                "size": entry.size,
                "sha256": entry.sha256,
                "version": entry.version,
            })
    
    issues = []
    if verification_result:
        for rule_result in verification_result.results:
            for violation in rule_result.violations:
                issues.append({
                    "rule_id": violation.rule_id,
                    "rule_name": violation.rule_name,
                    "severity": violation.severity.value,
                    "message": violation.message,
                    "file": violation.file,
                    "line": violation.line,
                    "expected": str(violation.expected) if violation.expected else None,
                    "actual": str(violation.actual) if violation.actual else None,
                })
    
    report_data = {
        "title": "发布证据包验收报告",
        "generated_at": reporter.generated_at,
        "target_path": str(target_path) if target_path else None,
        "summary": {
            "total_files": len(files),
            "total_issues": len(issues),
            "passed": verification_result.overall_passed if verification_result else None,
        },
        "files": files,
        "issues": issues,
    }
    
    if verification_result:
        report_data["verification"] = {
            "overall_passed": verification_result.overall_passed,
            "total_violations": verification_result.total_violations,
            "results": [],
        }
        for rule_result in verification_result.results:
            report_data["verification"]["results"].append({
                "rule_id": rule_result.rule_id,
                "rule_name": rule_result.rule_name,
                "passed": rule_result.passed,
                "violation_count": len(rule_result.violations),
                "warnings_count": len(rule_result.warnings),
            })
    
    formats = args.format or ["markdown", "csv", "json"]
    
    generated_files = []
    
    if "markdown" in formats:
        md_path = reporter.export_markdown(report_data)
        generated_files.append(str(md_path))
        print(f"✓ Markdown报告: {md_path.name}")
    
    if "csv" in formats:
        csv_path = reporter.export_csv(report_data)
        generated_files.append(str(csv_path))
        print(f"✓ CSV报告: {csv_path.name}")
    
    if "json" in formats:
        json_path = reporter.export_json(report_data)
        generated_files.append(str(json_path))
        print(f"✓ JSON审计包: {json_path.name}")
    
    print("\n" + "=" * 60)
    print("报告生成完成!")
    print(f"输出目录: {output_dir}")
    print("生成的文件:")
    for f in generated_files:
        print(f"  - {f}")
    
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="release-validator",
        description="发布证据包验收员 - 开源项目发布自动化验证工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    
    subparsers = parser.add_subparsers(
        title="子命令",
        dest="subcommand",
        help="可用的子命令",
    )
    
    scan_parser = subparsers.add_parser(
        "scan",
        help="扫描目录，建立文件索引并计算SHA256哈希",
    )
    scan_parser.add_argument("path", help="要扫描的目录路径")
    scan_parser.add_argument("-o", "--output", help="输出索引JSON文件路径")
    scan_parser.add_argument("-v", "--verbose", action="store_true", help="显示详细输出")
    scan_parser.set_defaults(func=cmd_scan)
    
    verify_parser = subparsers.add_parser(
        "verify",
        help="验证包名、语义版本、哈希、SBOM组件和许可证",
    )
    verify_parser.add_argument("path", help="要验证的目录路径")
    verify_parser.add_argument("-o", "--output", help="输出验证结果JSON文件路径")
    verify_parser.add_argument(
        "--disable",
        dest="disable_rules",
        action="append",
        help="禁用指定的规则（可多次使用）",
    )
    verify_parser.add_argument(
        "--enable-only",
        dest="enable_rules",
        action="append",
        help="仅启用指定的规则（可多次使用）",
    )
    verify_parser.set_defaults(func=cmd_verify)
    
    quarantine_parser = subparsers.add_parser(
        "quarantine",
        help="隔离不符合规范的文件和缺失证据项",
    )
    quarantine_parser.add_argument("path", help="目标目录路径")
    quarantine_parser.add_argument(
        "-d", "--quarantine-dir",
        help="隔离区目录路径（默认: .quarantine）",
    )
    quarantine_parser.add_argument(
        "--violations-json",
        help="验证结果JSON文件路径（用于隔离所有违规项）",
    )
    quarantine_parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="强制隔离所有违规项",
    )
    quarantine_parser.set_defaults(func=cmd_quarantine)
    
    report_parser = subparsers.add_parser(
        "report",
        help="导出Markdown验收单、CSV问题表和JSON审计包",
    )
    report_parser.add_argument(
        "path",
        nargs="?",
        help="要扫描和验证的目录路径",
    )
    report_parser.add_argument(
        "-o", "--output-dir",
        help="报告输出目录（默认: ./reports）",
    )
    report_parser.add_argument(
        "-f", "--format",
        action="append",
        choices=["markdown", "csv", "json", "all"],
        help="输出格式（可多次使用，默认: 全部）",
    )
    report_parser.set_defaults(func=cmd_report)
    
    args = parser.parse_args()
    
    if not args.subcommand:
        parser.print_help()
        return 1
    
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
