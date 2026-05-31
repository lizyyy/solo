#!/usr/bin/env python3
"""
拍卖图录校对系统 - 完整演示脚本
================================

这个脚本演示了完整的工作流程：
1. 生成示例数据
2. 导入数据并执行校对
3. 处理发现的差异和冲突
4. 导出各种格式的报告

直接运行：python run_demo.py
"""

import os
import sys
import shutil
from datetime import datetime

# 确保能导入本地包
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auction_catalog_proof.models import CatalogProofSession
from auction_catalog_proof.data_import import (
    import_works_list,
    import_wall_layout,
    write_sample_data,
    ImportError,
)
from auction_catalog_proof.proof_engine import (
    run_proof,
    confirm_record,
    resolve_difference,
    resolve_lighting_conflict,
    mark_needs_info,
    get_statistics,
)
from auction_catalog_proof.report_generator import (
    generate_html_report,
    export_exhibition_list_csv,
    export_session_json,
)
from auction_catalog_proof.exporter import (
    export_corrected_works_list,
    export_wall_layout_with_proof,
    export_proof_summary,
    print_summary,
)


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "demo_data")
    output_dir = os.path.join(base_dir, "demo_output")

    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)

    print_separator("拍卖图录校对系统 - 完整流程演示")
    print(f"开始时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    step = 1

    print_separator(f"步骤 {step}：生成示例数据")
    step += 1
    write_sample_data(data_dir)
    works_list_path = os.path.join(data_dir, "sample_works_list.csv")
    wall_layout_path = os.path.join(data_dir, "sample_wall_layout.csv")

    print_separator(f"步骤 {step}：创建校对会话并导入数据")
    step += 1

    session_name = f"2026春季拍卖会_图录校对"
    session = CatalogProofSession(
        session_name=session_name,
        works_list_source=works_list_path,
        wall_layout_source=wall_layout_path,
    )

    print("📥 导入作品清单...")
    artworks, _ = import_works_list(works_list_path, session)
    print(f"   ✓ 成功导入 {len(artworks)} 件作品")

    print("📥 导入展墙图...")
    layouts, _ = import_wall_layout(wall_layout_path, session)
    print(f"   ✓ 成功导入 {len(layouts)} 条展墙记录")

    print_separator(f"步骤 {step}：执行校对，比对两边数据")
    step += 1

    print("🔍 正在比对作品清单和展墙图...")
    differences, lighting_conflicts = run_proof(session, operator="演示脚本")

    print(f"\n📊 校对结果：")
    print(f"   发现 {len(differences)} 处差异")
    print(f"   发现 {len(lighting_conflicts)} 个灯光方案冲突")

    print_summary(session)

    print_separator(f"步骤 {step}：处理发现的问题")
    step += 1

    pending_diffs = [
        (k, v) for k, v in session.differences.items()
        if v.status == "pending"
    ]
    pending_lighting = [
        (k, v) for k, v in session.lighting_conflicts.items()
        if v.status == "pending"
    ]

    if pending_diffs:
        print("\n🛠️  处理差异：")
        for i, (key, diff) in enumerate(pending_diffs):
            if i % 2 == 0:
                print(f"  ✓ {diff.lot_number} - {diff.field_label}：采用作品清单的值")
                resolve_difference(
                    session,
                    key,
                    use_works_list=True,
                    operator="张校对",
                    notes="与策展人确认，以作品清单为准",
                )
            else:
                print(f"  ✓ {diff.lot_number} - {diff.field_label}：采用展墙图的值")
                resolve_difference(
                    session,
                    key,
                    use_works_list=False,
                    operator="张校对",
                    notes="现场测量后确认展墙图正确",
                )

    if pending_lighting:
        print("\n💡 处理灯光冲突：")
        for lot, conflict in pending_lighting:
            if "UV" in (conflict.works_list_lighting or ""):
                print(f"  ✓ {lot}：采用作品清单（有UV防护要求，必须按策展人要求）")
                resolve_lighting_conflict(
                    session,
                    lot,
                    use_works_list=True,
                    operator="李灯光",
                    notes="丝绸材质需要UV防护，已与灯光设计师确认技术可行",
                )
            else:
                print(f"  ✓ {lot}：采用展墙图（现场条件限制）")
                resolve_lighting_conflict(
                    session,
                    lot,
                    use_works_list=False,
                    operator="李灯光",
                    notes="现场电路限制，与策展人沟通后同意调整",
                )

    print("\n✅ 标记 LOT002 为待补充（展览历史需要策展人确认）")
    mark_needs_info(
        session,
        "LOT002",
        notes="需要策展人确认展览历史的具体年份和场馆",
        operator="张校对",
    )

    print("\n✅ 确认 LOT001 无误")
    confirm_record(
        session,
        "LOT001",
        operator="张校对",
        notes="两边数据完全一致，无需修改",
    )

    print_separator(f"步骤 {step}：查看处理后的状态")
    step += 1
    print_summary(session)

    print_separator(f"步骤 {step}：导出所有报告")
    step += 1

    os.makedirs(output_dir, exist_ok=True)

    session_file = os.path.join(output_dir, f"{session_name}.json")
    export_session_json(session, session_file)
    print(f"💾 会话存档：{session_file}")

    html_file = os.path.join(output_dir, f"{session_name}_报告.html")
    generate_html_report(
        session,
        html_file,
        title=f"{session_name} - 拍卖图录校对报告",
    )
    print(f"📄 HTML报告：{html_file}")

    exhibition_file = os.path.join(output_dir, f"{session_name}_布展清单.csv")
    export_exhibition_list_csv(session, exhibition_file)
    print(f"📊 布展清单：{exhibition_file}")

    works_file = os.path.join(output_dir, f"{session_name}_校对后_作品清单.csv")
    export_corrected_works_list(session, works_file)
    print(f"📋 校对后作品清单：{works_file}")

    wall_file = os.path.join(output_dir, f"{session_name}_校对后_展墙图.csv")
    export_wall_layout_with_proof(session, wall_file)
    print(f"🖼️  校对后展墙图：{wall_file}")

    summary_file = os.path.join(output_dir, f"{session_name}_校对摘要.json")
    export_proof_summary(session, summary_file)
    print(f"📝 校对摘要：{summary_file}")

    print_separator("演示完成！")
    print(f"结束时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n🎉 所有文件都在：{os.path.abspath(output_dir)}")
    print(f"\n📌 建议打开 HTML 报告查看完整效果：")
    print(f"   {os.path.abspath(html_file)}")
    print(f"\n📌 也可以用命令行继续操作：")
    print(f"   查看状态：python -m auction_catalog_proof status {session_file}")
    print(f"   查看历史：python -m auction_catalog_proof history {session_file}")
    print(f"   重新导出：python -m auction_catalog_proof export {session_file}")

    print_separator()
    return 0


if __name__ == "__main__":
    sys.exit(main())
