#!/usr/bin/env python3
"""
共享单车潮汐调度 - 完整流程演示

按照 README 从样例跑到报告的三步曲：
1. 网格员巡查表第一次导入
2. 坡道补录（评分无变化 → 转交通协管复核）
3. 社区书记周姐补看施工告示 → 整改建议更新
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from bike_dispatch import (
    create_case, import_grid_inspection, supplement_ramp,
    import_construction_notice, generate_report, review_ramp,
    GridInspection, ConstructionNotice, ReviewStatus
)


def main():
    print("=" * 60)
    print("🚲 共享单车潮汐调度 - 完整流程演示")
    print("=" * 60)
    print()

    # 第一步：创建案件
    print("📌 第一步：创建调度案件")
    print("-" * 40)
    case = create_case("东门社区早高峰共享单车潮汐调度")
    print(f"✅ 案件已创建")
    print(f"   案件ID：{case.id}")
    print(f"   案件标题：{case.title}")
    print()

    # 第二步：网格员巡查表导入
    print("📌 第二步：网格员巡查表第一次导入")
    print("-" * 40)
    inspection = GridInspection(
        id="",
        inspector_name="小李",
        inspection_date=datetime.now(),
        location="东门社区入口坡道",
        bike_overflow=True,
        blocked_access=True,
        damaged_facilities=False,
        notes="早上8点巡查发现，共享单车堆积约30辆，挡住了无障碍坡道入口，行人通行困难。"
    )
    case = import_grid_inspection(case, inspection)
    print(f"✅ 巡查表已导入")
    print(f"   网格员：{inspection.inspector_name}")
    print(f"   地点：{inspection.location}")
    print(f"   巡查评分：{inspection.score:.1f}")
    print(f"   生成坡道数：{len(case.ramps)}")
    for ramp in case.ramps:
        print(f"   - 坡道 [{ramp.id}]: {ramp.location}")
        print(f"     问题：{', '.join(ramp.issues)}")
    print()

    # 第三步：坡道补录（评分无变化 → 转交通协管）
    print("📌 第三步：坡道补录（评分没变化 → 别急着归正常，留给交通协管）")
    print("-" * 40)
    ramp_id = case.ramps[0].id
    ramp = supplement_ramp(
        case, ramp_id,
        note="社区书记周姐现场复核，发现确实仍有堆积，但暂时没有更好的停放点",
        is_accessible=True,
        has_bike_parking=False
    )
    print(f"✅ 坡道补录完成")
    print(f"   坡道：{ramp.location}")
    print(f"   评分变化：{ramp.score_before:.1f} → {ramp.score_after:.1f}")
    print(f"   评分是否变化：{'是' if ramp.score_changed else '否'}")
    print(f"   复核状态：{ramp.review_status.value}")
    if not ramp.score_changed:
        print(f"   ⚠️  评分无变化，已自动转交通协管复核，不归为正常！")
    print()

    # 第四步：查看当前整改建议
    print("📌 第四步：查看当前整改建议（还没看施工告示）")
    print("-" * 40)
    for s in case.suggestions:
        print(f"   针对坡道 {s.ramp_id}")
        print(f"   问题：{s.issue_description}")
        print(f"   为什么留下：{s.why_kept}")
        print(f"   缺材料：{', '.join(s.missing_materials)}")
        print(f"   下一步找：{s.responsible_role.value}")
        print(f"   具体行动：{s.next_step}")
    print()

    # 第五步：社区书记周姐补看施工告示
    print("📌 第五步：社区书记周姐补看施工告示 → 整改建议跟着变")
    print("-" * 40)
    notice = ConstructionNotice(
        id="",
        title="东门片区污水管道改造工程",
        location="东门社区入口",
        start_date=datetime.now(),
        end_date=datetime.now(),
        impact_description="施工占用了原有的非机动车停放区域约20平米",
        site_statement="施工方承诺每天下午6点清理一次通道，保证晚高峰通行。临时堆放点已协调在50米外的空地上。"
    )
    case = import_construction_notice(case, notice, reviewed_by_secretary=True)
    print(f"✅ 施工告示已导入（社区书记周姐已审阅）")
    print(f"   告示标题：{notice.title}")
    print(f"   现场说法：{notice.site_statement}")
    print()

    # 第六步：查看更新后的整改建议
    print("📌 第六步：查看更新后的整改建议（施工告示已补看）")
    print("-" * 40)
    for s in case.suggestions:
        print(f"   针对坡道 {s.ramp_id}")
        print(f"   问题：{s.issue_description}")
        print(f"   为什么留下：{s.why_kept}")
        print(f"   缺材料：{', '.join(s.missing_materials)}")
        print(f"   下一步找：{s.responsible_role.value}")
        print(f"   具体行动：{s.next_step}")
    print()

    # 第七步：生成报告
    print("📌 第七步：生成完整报告")
    print("-" * 40)
    report = generate_report(case, output_format="text")
    print(report)
    print()

    # 保存报告
    report_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(report_dir, exist_ok=True)
    
    text_report_path = os.path.join(report_dir, f"report_{case.id}.txt")
    with open(text_report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"📄 文本报告已保存：{text_report_path}")
    
    html_report = generate_report(case, output_format="html")
    html_report_path = os.path.join(report_dir, f"report_{case.id}.html")
    with open(html_report_path, 'w', encoding='utf-8') as f:
        f.write(html_report)
    print(f"🌐 HTML报告已保存：{html_report_path}")
    print()

    print("=" * 60)
    print("✅ 演示完成！")
    print("=" * 60)
    print()
    print("💡 关键验证点：")
    print("   1. ✅ 网格员巡查表第一次导入 → 生成坡道和初步建议")
    print("   2. ✅ 坡道补录后评分没变化 → 自动转交通协管，不归正常")
    print("   3. ✅ 社区书记周姐补看施工告示 → 整改建议自动更新")
    print("   4. ✅ 整改建议说明：为什么留下、缺什么材料、该找谁")
    print("   5. ✅ 报告有温度，不是冷冰冰的系统日志")
    print()


if __name__ == "__main__":
    main()
