#!/usr/bin/env python3
"""快速验证 CLI 功能"""

import sys
import os
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from contract_drift.parser import SampleParser, ContractParser
from contract_drift.detector import DriftDetector
from contract_drift.store import DataStore


def test_contract_parser():
    print("\n=== 测试契约解析 ===")
    parser = ContractParser()
    contracts = parser.parse_openapi_file("examples/openapi.yaml")
    print(f"解析到 {len(contracts)} 个契约")
    for c in contracts:
        print(f"  - {c.method} {c.api_path}: {len(c.fields)} 个字段")
        for f in c.fields[:3]:
            print(f"    * {f.path}: {f.type.value}")
    return contracts


def test_sample_parser():
    print("\n=== 测试样例解析 ===")
    parser = SampleParser()

    contract_id = "test-contract-1"
    sample1 = parser.parse_file("examples/sample1.json", contract_id)
    print(f"样例1: {sample1.name} - {len(sample1.fields)} 个字段")

    sample2 = parser.parse_file("examples/sample2-drift.json", contract_id)
    print(f"样例2: {sample2.name} - {len(sample2.fields)} 个字段")

    return [sample1, sample2]


def test_drift_detection():
    print("\n=== 测试漂移检测 ===")
    contracts = test_contract_parser()
    samples = test_sample_parser()

    detector = DriftDetector()
    drifts = detector.detect_drifts(contracts[0], samples)

    print(f"检测到 {len(drifts)} 处漂移:")
    for d in drifts:
        source_info = f" (文件: {d.sample_source.file_path}:{d.sample_source.line_start})" if d.sample_source else ""
        print(f"  - {d.field_path}: {d.diff_type.value} - {d.message}{source_info}")

    return drifts


def test_store():
    print("\n=== 测试数据存储 ===")
    store = DataStore()

    contracts = test_contract_parser()
    result = store.import_contracts(contracts)
    print(f"导入契约: {result.imported_count} 个, 跳过 {result.skipped_count} 个")

    samples = test_sample_parser()
    for s in samples:
        s.contract_id = contracts[0].id
    result = store.import_samples(samples)
    print(f"导入样例: {result.imported_count} 个, 跳过 {result.skipped_count} 个")

    result2 = store.import_samples(samples)
    print(f"重复导入样例: {result2.imported_count} 个, 跳过 {result2.skipped_count} 个")

    assert result2.skipped_count > 0, "幂等性测试失败"
    print("✓ 幂等性测试通过")

    return store


def main():
    print("=" * 50)
    print("契约漂移 CLI 工具验证")
    print("=" * 50)

    try:
        test_contract_parser()
        test_sample_parser()
        test_drift_detection()
        test_store()

        print("\n" + "=" * 50)
        print("✓ 所有测试通过!")
        print("=" * 50)
        print("\n安装工具: pip install -e .")
        print("查看帮助: contract-drift --help")
        print("\n快速开始:")
        print("  contract-drift contract import examples/openapi.yaml")
        print("  contract-drift contract list")
        print("  contract-drift sample import examples/sample*.json --contract-id <ID>")
        print("  contract-drift drift detect --contract-id <ID> --export html")
        print("  contract-drift dashboard")

    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
