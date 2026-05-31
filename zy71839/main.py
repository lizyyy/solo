#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
峡谷风向决策系统 - 主入口
处理混合输入数据，检测异常，生成可追溯的决策报告
"""

import sys
import os
from pathlib import Path

from data_loader import DataLoader
from anomaly_detector import AnomalyDetector, CanyonMap
from boundary_analyzer import BoundaryAnalyzer
from decision_engine import DecisionEngine
from models import ConfirmationStatus, AnomalyType


def main():
    print("=" * 60)
    print("峡谷风向决策系统 v1.0")
    print("=" * 60)
    print()

    data_dir = Path(__file__).parent / "data"
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    print("[1/5] 正在加载混合数据源...")
    loader = DataLoader(data_dir=str(data_dir))
    records, units, settlements = loader.load_all()
    print(f"  ✓ 加载战报记录: {len(records)} 条")
    print(f"    - 正常记录: {sum(1 for r in records if r.source == 'normal')}")
    print(f"    - 晚到附件: {sum(1 for r in records if r.source == 'late_attachment')}")
    print(f"    - 重复记录: {sum(1 for r in records if r.source == 'duplicate')}")
    print(f"    - 人工更正: {sum(1 for r in records if r.source == 'manual_correction')}")
    print(f"  ✓ 加载单位数据: {len(units)} 个")
    print(f"  ✓ 加载结算数据: {len(settlements)} 条")
    print()

    print("[2/5] 正在检测异常...")
    detector = AnomalyDetector(units)
    detector.detect_all(records, settlements)

    total_anomalies = sum(len(r.anomalies) for r in records)
    anomaly_by_type = {}
    for r in records:
        for a in r.anomalies:
            anomaly_by_type[a.anomaly_type] = anomaly_by_type.get(a.anomaly_type, 0) + 1

    print(f"  ✓ 检测到异常: {total_anomalies} 处")
    for atype, count in anomaly_by_type.items():
        print(f"    - {atype.value}: {count} 处")
    print(f"  ✓ 标记待确认记录: {sum(1 for r in records if r.confirmation_status == ConfirmationStatus.PENDING)} 条")
    print(f"  ✓ 标记作废记录: {sum(1 for r in records if r.confirmation_status == ConfirmationStatus.REJECTED)} 条")
    print()

    print("[3/5] 正在进行边界穿越专项分析...")
    canyon_map = CanyonMap()
    boundary_analyzer = BoundaryAnalyzer(canyon_map, units)

    for record in records:
        if record.confirmation_status != ConfirmationStatus.REJECTED:
            boundary_analyzer.analyze_record(record)

    boundary_summary = boundary_analyzer.get_summary()
    print(f"  ✓ 边界穿越待复核: {boundary_summary['pending_review']} 条")
    if boundary_summary['by_zone']:
        print("    按区域分布:")
        for zone, count in boundary_summary['by_zone'].items():
            print(f"      - {zone}: {count} 处")
    print()

    print("[4/5] 正在生成决策结论...")
    engine = DecisionEngine(records, units, settlements, boundary_analyzer)
    decisions = engine.generate_decisions()
    print(f"  ✓ 生成决策条目: {len(decisions)} 条")
    print(f"    - 已确认: {sum(1 for d in decisions if d.confirmation_status == ConfirmationStatus.CONFIRMED)}")
    print(f"    - 待确认: {sum(1 for d in decisions if d.confirmation_status == ConfirmationStatus.PENDING)}")
    avg_conf = sum(d.confidence_score for d in decisions) / len(decisions) if decisions else 0
    print(f"    - 平均置信度: {avg_conf:.0%}")
    print()

    print("[5/5] 正在导出报告...")
    html_file = output_dir / "decision_report.html"
    json_file = output_dir / "decision_report.json"
    md_file = output_dir / "decision_report.md"
    boundary_file = output_dir / "boundary_analyses.json"

    engine.export_decision_table(str(html_file), format='html')
    engine.export_decision_table(str(json_file), format='json')
    engine.export_decision_table(str(md_file), format='markdown')
    boundary_analyzer.export_analyses_for_review(str(boundary_file))
    print()

    print("=" * 60)
    print("处理完成！报告已生成到 output/ 目录")
    print("=" * 60)
    print()
    print("关键文件说明:")
    print(f"  • decision_report.html  - 可视化决策表（推荐主策查看）")
    print(f"  • decision_report.json  - 结构化决策数据")
    print(f"  • decision_report.md    - Markdown格式报告")
    print(f"  • boundary_analyses.json - 边界穿越专项分析（玩法策划复核用）")
    print()
    print("追溯链接说明:")
    print("  • file://...            - 点击跳转原始数据文件")
    print("  • boundary_review://... - 点击查看边界穿越复核报告")
    print()

    if boundary_analyzer.analyses:
        print("边界穿越复核示例:")
        first_id = list(boundary_analyzer.analyses.keys())[0]
        report = boundary_analyzer.get_analysis_report(first_id)
        print(report)
        print()

    print("异常记录详情:")
    pending_records = [r for r in records if r.confirmation_status == ConfirmationStatus.PENDING]
    for r in pending_records[:3]:
        print(f"\n  记录 {r.record_id} (来源: {r.source.value}):")
        for a in r.anomalies:
            print(f"    - [{a.anomaly_type.value}] {a.description}")
            print(f"      原因: {a.review_reason}")
            print(f"      证据: {a.evidence_refs[:2]}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
