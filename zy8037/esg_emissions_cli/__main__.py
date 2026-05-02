#!/usr/bin/env python3
"""
ESG Emissions CLI - Carbon Emission Verification Tool
Monthly emission reconciliation for ESG teams
"""

import argparse
import sys
from pathlib import Path
import json
import csv
import yaml
from datetime import datetime
from typing import Dict, List, Optional, Any

from .models.data_models import EnergyBill, OrganizationBoundary, EmissionFactor, AdjustmentItem
from .models.validator import InputValidator
from .calculators.emission_calculator import EmissionCalculator
from .validators.business_rules import BusinessRuleValidator


def load_json(path: Path) -> Any:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_yaml(path: Path) -> Any:
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_csv(path: Path) -> List[Dict]:
    with open(path, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))


def save_csv(path: Path, data: List[Dict], fieldnames: List[str]) -> None:
    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)


def generate_markdown_report(
    summary: Dict,
    anomalies: List[Dict],
    output_path: Path
) -> None:
    report_lines = [
        "# ESG 碳排放月度汇总报告",
        f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## 一、总体概况",
        f"- 复核月份: {summary.get('month', 'N/A')}",
        f"- 站点数量: {summary.get('site_count', 0)}",
        f"- 总排放量 (tCO2e): {summary.get('total_emissions', 0):.4f}",
        "",
        "## 二、按范围统计",
        f"| 范围 | 排放量 (tCO2e) | 占比 |",
        f"|------|---------------|------|",
    ]

    scope_data = summary.get('by_scope', {})
    total = summary.get('total_emissions', 1)
    for scope in ['Scope 1', 'Scope 2', 'Scope 3']:
        val = scope_data.get(scope, 0)
        pct = (val / total * 100) if total > 0 else 0
        report_lines.append(f"| {scope} | {val:.4f} | {pct:.1f}% |")

    report_lines.extend([
        "",
        "## 三、按站点统计",
        "| 站点 | 范围 | 月份 | 排放量 (tCO2e) |",
        "|------|------|------|---------------|",
    ])

    for site_item in summary.get('by_site', []):
        report_lines.append(
            f"| {site_item['site']} | {site_item['scope']} | "
            f"{site_item['month']} | {site_item['emissions']:.4f} |"
        )

    report_lines.extend([
        "",
        "## 四、异常清单",
    ])

    if anomalies:
        report_lines.extend([
            "| 异常类型 | 站点 | 描述 |",
            "|----------|------|------|",
        ])
        for anom in anomalies:
            report_lines.append(
                f"| {anom['type']} | {anom.get('site', 'N/A')} | {anom['description']} |"
            )
    else:
        report_lines.append("* 无异常 *")

    report_lines.extend([
        "",
        "## 五、数据质量说明",
        f"- 因子缺失记录数: {summary.get('missing_factors', 0)}",
        f"- 重复账单识别数: {summary.get('duplicate_bills', 0)}",
        f"- 跨月调整识别数: {summary.get('cross_month_adjustments', 0)}",
    ])

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))


def run_cli():
    parser = argparse.ArgumentParser(
        description='ESG 碳排放月度复核工具',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--energy-bills', required=True, help='能源账单 CSV 文件路径')
    parser.add_argument('--org-boundary', required=True, help='组织边界 JSON 文件路径')
    parser.add_argument('--factors', required=True, help='排放因子 YAML 文件路径')
    parser.add_argument('--adjustments', required=True, help='调整事项 CSV 文件路径')
    parser.add_argument('--output-dir', default='output', help='输出目录 (默认: output)')
    parser.add_argument('--month', help='复核月份 YYYY-MM (默认从账单推断)')

    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        bills_data = load_csv(Path(args.energy_bills))
        org_boundary = load_json(Path(args.org_boundary))
        factors_data = load_yaml(Path(args.factors))
        adjustments_data = load_csv(Path(args.adjustments))

        validator = InputValidator()
        factors_raw = factors_data.get('factors', factors_data)
        validator.validate_all(bills_data, org_boundary, factors_raw, adjustments_data)

        energy_bills = [EnergyBill.from_dict(b) for b in bills_data]
        org = OrganizationBoundary.from_dict(org_boundary)
        factors = [EmissionFactor.from_dict(f) for f in factors_raw]
        adjustments = [AdjustmentItem.from_dict(a) for a in adjustments_data]

        anomalies = []

        calculator = EmissionCalculator(factors, org)
        results = calculator.calculate(energy_bills, adjustments, anomalies)

        summary = calculator.generate_summary(results, args.month)

        emissions_rows = []
        for r in results:
            emissions_rows.append({
                'site': r['site'],
                'scope': r['scope'],
                'month': r['month'],
                'energy_type': r['energy_type'],
                'consumption': r['consumption'],
                'unit': r['unit'],
                'emission_factor': r['factor_value'],
                'emissions_tCO2e': r['emissions'],
                'factor_version': r.get('factor_version', 'N/A')
            })

        emissions_fieldnames = [
            'site', 'scope', 'month', 'energy_type', 'consumption',
            'unit', 'emission_factor', 'emissions_tCO2e', 'factor_version'
        ]
        save_csv(output_dir / 'emissions.csv', emissions_rows, emissions_fieldnames)

        anomaly_fieldnames = ['type', 'site', 'severity', 'description']
        save_csv(output_dir / 'anomalies.csv', anomalies, anomaly_fieldnames)

        summary['missing_factors'] = sum(1 for a in anomalies if a['type'] == '因子缺失')
        summary['duplicate_bills'] = sum(1 for a in anomalies if a['type'] == '重复账单')
        summary['cross_month_adjustments'] = sum(1 for a in anomalies if a['type'] == '跨月调整')

        generate_markdown_report(
            summary, anomalies, output_dir / 'report.md'
        )

        print(f"✅ 复核完成！")
        print(f"   - 排放清单: {output_dir / 'emissions.csv'}")
        print(f"   - 异常清单: {output_dir / 'anomalies.csv'}")
        print(f"   - 汇总报告: {output_dir / 'report.md'}")

        if anomalies:
            print(f"\n⚠️  发现 {len(anomalies)} 条异常，请查看异常清单")

    except Exception as e:
        print(f"❌ 错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    run_cli()
