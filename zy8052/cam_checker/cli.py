#!/usr/bin/env python3
import argparse
import sys
import os

from .parsers import parse_orders, parse_stl_files, parse_material_rules
from .validators import validate_case
from .generators import generate_manifest
from .exporters import export_risk_report, export_missing_files, export_cam_manifest


def main():
    parser = argparse.ArgumentParser(
        description="义齿技工所 CAM 派单预检工具"
    )
    parser.add_argument(
        "--orders",
        required=True,
        help="病例订单 CSV 文件路径"
    )
    parser.add_argument(
        "--stls",
        required=True,
        help="STL 文件清单 JSON 文件路径"
    )
    parser.add_argument(
        "--rules",
        required=True,
        help="材料与牙位规则 YAML 文件路径"
    )
    parser.add_argument(
        "--output-dir",
        default=".",
        help="输出目录 (默认: 当前目录)"
    )

    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    print("正在读取数据...")
    orders = parse_orders(args.orders)
    stl_files = parse_stl_files(args.stls)
    material_rules = parse_material_rules(args.rules)

    print("正在校验规则...")
    validation_result = validate_case(orders, stl_files, material_rules)

    print("正在生成派单清单...")
    manifest = generate_manifest(validation_result)

    print("正在导出报告...")
    risk_report_path = os.path.join(args.output_dir, "risk_report.md")
    missing_files_path = os.path.join(args.output_dir, "missing_files.csv")
    cam_manifest_path = os.path.join(args.output_dir, "cam_manifest.json")

    export_risk_report(validation_result, risk_report_path)
    export_missing_files(validation_result.missing_files, missing_files_path)
    export_cam_manifest(manifest, cam_manifest_path)

    print("\n✅ 预检完成!")
    print(f"📊 风险报告: {risk_report_path}")
    print(f"📋 缺失文件: {missing_files_path}")
    print(f"📦 CAM清单: {cam_manifest_path}")

    if not validation_result.valid:
        print("\n⚠️  发现问题，需要处理后再派单")
        sys.exit(1)


if __name__ == "__main__":
    main()
