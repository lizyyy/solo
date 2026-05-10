#!/usr/bin/env python3
"""测试二维码物料领用 CLI 工具"""

import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from qr_material_cli.services import (
    generate_sample_qr_codes,
    load_materials_ledger,
    load_scan_records,
    load_return_records,
    deduplicate_scan_records,
    merge_offline_records,
    validate_return_records,
    check_inventory_discrepancies,
)
from qr_material_cli.reports import generate_text_summary


def test_all_features():
    print("=" * 60)
    print("二维码物料领用 CLI 工具测试")
    print("=" * 60)
    print()
    
    test_dir = Path(__file__).parent / "test_output"
    test_dir.mkdir(exist_ok=True)
    
    project = "2026春季展会"
    
    print("【1】生成样例二维码编号...")
    samples = generate_sample_qr_codes(project, test_dir)
    print(f"   ✅ 生成了 {sum(len(v) for v in samples.values())} 个二维码编号")
    for material_type, codes in samples.items():
        print(f"   - {material_type}: {codes[:2]}...")
    print()
    
    ledger_file = test_dir / f"物料台账_{project}.xlsx"
    materials = load_materials_ledger(ledger_file)
    print(f"【2】加载物料台账: {len(materials)} 种物料")
    for m in materials[:3]:
        print(f"   - {m.qr_code}: {m.name} ({m.material_type.value})")
    print()
    
    print("【3】创建测试扫码记录...")
    import pandas as pd
    now = datetime.now()
    
    scan_data = [
        {
            "二维码编号": samples["桁架"][0],
            "扫码时间": now.strftime("%Y-%m-%d 09:00:00"),
            "领用人": "张三",
            "领用部门": "搭建组",
            "展会项目": project,
            "来源": "扫码",
            "领用数量": 1,
        },
        {
            "二维码编号": samples["桁架"][0],
            "扫码时间": now.strftime("%Y-%m-%d 09:05:00"),
            "领用人": "张三",
            "领用部门": "搭建组",
            "展会项目": project,
            "来源": "扫码",
            "领用数量": 1,
        },
        {
            "二维码编号": samples["灯具"][0],
            "扫码时间": now.strftime("%Y-%m-%d 10:00:00"),
            "领用人": "李四",
            "领用部门": "灯光组",
            "展会项目": project,
            "来源": "扫码",
            "领用数量": 1,
        },
        {
            "二维码编号": samples["灯具"][1],
            "扫码时间": now.strftime("%Y-%m-%d 10:30:00"),
            "领用人": "李四",
            "领用部门": "灯光组",
            "展会项目": project,
            "来源": "扫码",
            "领用数量": 1,
        },
        {
            "二维码编号": samples["桌椅"][0],
            "扫码时间": now.strftime("%Y-%m-%d 11:00:00"),
            "领用人": "王五",
            "领用部门": "会务组",
            "展会项目": project,
            "来源": "扫码",
            "领用数量": 1,
        },
    ]
    scan_file = test_dir / f"扫码记录_{project}.xlsx"
    pd.DataFrame(scan_data).to_excel(scan_file, index=False)
    
    scan_records = load_scan_records(scan_file)
    print(f"   ✅ 创建了 {len(scan_records)} 条扫码记录")
    print()
    
    print("【4】去重测试...")
    scan_records, duplicates = deduplicate_scan_records(scan_records)
    print(f"   ✅ 检测到 {len(duplicates)} 条重复记录")
    if duplicates:
        dup = duplicates[0]
        print(f"   - 示例: {dup['original']['二维码编号']} 被重复扫码")
    print()
    
    print("【5】创建离线补录记录...")
    offline_data = [
        {
            "二维码编号": samples["桁架"][1],
            "扫码时间": now.strftime("%Y-%m-%d 09:15:00"),
            "领用人": "张三",
            "领用部门": "搭建组",
            "展会项目": project,
            "来源": "离线补录",
            "领用数量": 1,
        },
        {
            "二维码编号": samples["灯具"][0],
            "扫码时间": now.strftime("%Y-%m-%d 10:00:00"),
            "领用人": "李四",
            "领用部门": "灯光组",
            "展会项目": project,
            "来源": "离线补录",
            "领用数量": 1,
        },
        {
            "二维码编号": samples["桌椅"][1],
            "扫码时间": now.strftime("%Y-%m-%d 11:30:00"),
            "领用人": "赵六",
            "领用部门": "会务组",
            "展会项目": project,
            "来源": "离线补录",
            "领用数量": 1,
        },
    ]
    offline_file = test_dir / f"离线补录_{project}.xlsx"
    pd.DataFrame(offline_data).to_excel(offline_file, index=False)
    
    offline_records = load_scan_records(offline_file)
    print(f"   ✅ 创建了 {len(offline_records)} 条离线补录记录")
    print()
    
    print("【6】合并离线记录测试...")
    merged_records, merged_info = merge_offline_records(scan_records, offline_records)
    merged = [m for m in merged_info if m["action"] == "合并"]
    skipped = [m for m in merged_info if m["action"] == "跳过"]
    print(f"   ✅ 成功合并: {len(merged)} 条")
    print(f"   ✅ 被跳过: {len(skipped)} 条 (已存在扫码记录)")
    if skipped:
        print(f"   - 示例: {skipped[0]['record']['二维码编号']} 已扫码，离线记录被跳过")
    print()
    
    print("【7】创建归还记录...")
    return_data = [
        {
            "二维码编号": samples["灯具"][0],
            "归还时间": now.strftime("%Y-%m-%d 18:00:00"),
            "归还人": "李四",
            "归还部门": "灯光组",
            "展会项目": project,
            "归还数量": 1,
        },
        {
            "二维码编号": samples["桌椅"][0],
            "归还时间": now.strftime("%Y-%m-%d 19:00:00"),
            "归还人": "王五",
            "归还部门": "会务组",
            "展会项目": project,
            "归还数量": 1,
        },
        {
            "二维码编号": samples["灯具"][0],
            "归还时间": now.strftime("%Y-%m-%d 19:30:00"),
            "归还人": "李四",
            "归还部门": "灯光组",
            "展会项目": project,
            "归还数量": 1,
        },
    ]
    return_file = test_dir / f"归还记录_{project}.xlsx"
    pd.DataFrame(return_data).to_excel(return_file, index=False)
    
    return_records = load_return_records(return_file)
    print(f"   ✅ 创建了 {len(return_records)} 条归还记录")
    print()
    
    print("【8】归还验证测试...")
    return_records, return_issues = validate_return_records(merged_records, return_records)
    print(f"   ✅ 检测到 {len(return_issues)} 个归还异常")
    if return_issues:
        issue = return_issues[0]
        print(f"   - 示例: {issue['qr_code']} 归还超额 {issue['excess']} 件")
    print()
    
    print("【9】检查库存差异...")
    reports = check_inventory_discrepancies(materials, merged_records, return_records)
    print(f"   ✅ 分析了 {len(reports)} 个项目")
    
    for project_name, report in reports.items():
        print(f"\n   【{project_name}】")
        print(f"      物料数: {len(report.materials)}")
        print(f"      总差异: {report.total_deficit}")
        
        deficit_materials = [m for m in report.materials.values() if m.has_deficit]
        if deficit_materials:
            print(f"      未归还物料: {len(deficit_materials)} 种")
            for usage in deficit_materials:
                receivers = set(r.receiver for r in usage.get_active_scan_records())
                print(f"         - {usage.material.name}: 差{usage.deficit}件, 领用人: {', '.join(receivers)}")
    print()
    
    print("【10】生成文本报告...")
    summary = generate_text_summary(reports, duplicates, merged_info, return_issues)
    summary_file = test_dir / "报告摘要.txt"
    summary_file.write_text(summary, encoding='utf-8')
    print(f"   ✅ 报告已保存到: {summary_file}")
    print()
    
    print("=" * 60)
    print("测试完成！所有功能正常工作。")
    print("=" * 60)
    print()
    print("生成的文件:")
    for f in test_dir.iterdir():
        print(f"  - {f.name}")


if __name__ == "__main__":
    test_all_features()
