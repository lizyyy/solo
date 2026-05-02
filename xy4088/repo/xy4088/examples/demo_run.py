#!/usr/bin/env python3
"""
素材授权包巡检员 - 演示脚本
运行此脚本可以测试完整的工作流程
"""

import os
import sys
from pathlib import Path
from datetime import datetime

project_root = Path(__file__).parent.parent
src_dir = project_root / "src"
sys.path.insert(0, str(src_dir))

from license_scanner.models import ProjectState
from license_scanner.scanner import DirectoryScanner
from license_scanner.parser import parse_license_file
from license_scanner.matcher import match_assets_and_licenses
from license_scanner.checker import check_risks, get_risk_summary
from license_scanner.storage import ProjectStorage
from license_scanner.reporter import (
    generate_markdown_report,
    export_assets_csv,
    export_risks_csv,
    export_audit_json,
)


def main():
    print("=" * 60)
    print("素材授权包巡检员 - 完整演示")
    print("=" * 60)
    print()

    examples_dir = Path(__file__).parent
    test_project = examples_dir / "test_project"
    output_dir = test_project / "output"
    output_dir.mkdir(exist_ok=True)

    print(f"📂 测试项目目录: {test_project}")
    print(f"📤 输出目录: {output_dir}")
    print()

    print("-" * 60)
    print("步骤 1: 扫描项目目录中的素材文件")
    print("-" * 60)
    print()

    scanner = DirectoryScanner()
    assets = scanner.scan_directory(str(test_project))

    print(f"✅ 扫描完成! 发现 {len(assets)} 个文件")
    print()
    print("📊 扫描结果:")
    for asset in assets:
        print(f"   - {asset.file_name} ({asset.asset_type.value}, {asset.file_size} bytes)")
        print(f"     哈希: {asset.file_hash[:16]}...")
    print()

    print("-" * 60)
    print("步骤 2: 导入授权清单")
    print("-" * 60)
    print()

    license_file = test_project / "licenses_for_import.csv"
    licenses = parse_license_file(str(license_file))

    print(f"✅ 导入完成! 从 {license_file.name} 提取 {len(licenses)} 条授权")
    print()
    print("📋 授权清单:")
    for lic in licenses:
        expiry = lic.expiry_date.strftime('%Y-%m-%d') if lic.expiry_date else "永久"
        seats = str(lic.seats) if lic.seats else "不限"
        print(f"   - {lic.license_id}: {lic.asset_name}")
        print(f"     供应商: {lic.vendor or '未知'}, 有效期: {expiry}, 人数: {seats}")
    print()

    print("-" * 60)
    print("步骤 3: 匹配素材和授权")
    print("-" * 60)
    print()

    state = ProjectState(
        project_name="Demo Project",
        scan_date=datetime.now(),
        assets=assets,
        licenses=licenses
    )

    matches, unmatched = match_assets_and_licenses(assets, licenses, min_confidence=0.3)
    state.matches = [m.to_dict() for m in matches]

    print(f"✅ 匹配完成!")
    print(f"   成功匹配: {len(matches)} 个素材")
    print(f"   未匹配: {len(unmatched.get('unmatched', []))} 个素材")
    print()

    if matches:
        print("🔗 匹配详情:")
        for m in matches:
            print(f"   - {m.asset.file_name} <-> {m.license.asset_name}")
            print(f"     强度: {m.strength.value}, 置信度: {m.confidence:.2f}")
    print()

    print("-" * 60)
    print("步骤 4: 风险检查")
    print("-" * 60)
    print()

    risks = check_risks(
        assets, licenses, state.matches,
        required_usage=["商业使用"],
        min_required_seats=5
    )
    state.risks = risks

    summary = get_risk_summary(risks)

    print(f"✅ 检查完成! 发现 {len(risks)} 个风险")
    print()
    print("📊 风险统计:")
    for level, count in summary['by_level'].items():
        print(f"   - {level.upper()}: {count} 个")
    print()

    if risks:
        print("⚠️  风险详情 (按严重程度排序):")
        sorted_risks = sorted(
            risks,
            key=lambda r: {
                'critical': 0,
                'high': 1,
                'medium': 2,
                'low': 3
            }.get(r.risk_level.value, 4)
        )
        for risk in sorted_risks:
            icon = "🔴" if risk.risk_level.value == "critical" else \
                   "🟠" if risk.risk_level.value == "high" else \
                   "🟡" if risk.risk_level.value == "medium" else "🔵"
            print(f"   {icon} [{risk.risk_type.value}] {risk.message}")
    print()

    print("-" * 60)
    print("步骤 5: 保存项目状态")
    print("-" * 60)
    print()

    storage = ProjectStorage(str(test_project))
    saved_path = storage.save_state(state)
    print(f"✅ 状态已保存到: {saved_path}")
    print()

    print("-" * 60)
    print("步骤 6: 导出报告")
    print("-" * 60)
    print()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    md_path = output_dir / f"report_{timestamp}.md"
    generate_markdown_report(state, str(md_path))
    print(f"✅ Markdown 报告: {md_path}")

    assets_csv = output_dir / f"assets_{timestamp}.csv"
    export_assets_csv(state, str(assets_csv))
    print(f"✅ 素材台账 CSV: {assets_csv}")

    risks_csv = output_dir / f"risks_{timestamp}.csv"
    export_risks_csv(state, str(risks_csv))
    print(f"✅ 风险清单 CSV: {risks_csv}")

    json_path = output_dir / f"audit_{timestamp}.json"
    export_audit_json(state, str(json_path))
    print(f"✅ 审计包 JSON: {json_path}")

    print()
    print("=" * 60)
    print("演示完成!")
    print("=" * 60)
    print()
    print(f"📊 输出文件位置: {output_dir}")
    print()
    print("你也可以使用 CLI 命令执行相同的操作:")
    print("  1. license-scanner scan -p examples/test_project")
    print("  2. license-scanner import-license examples/test_project/licenses_for_import.csv")
    print("  3. license-scanner match")
    print("  4. license-scanner check --usage \"商业使用\" --seats 5")
    print("  5. license-scanner export")
    print()


if __name__ == "__main__":
    main()
