"""
社区助餐点服务半径 - 重传不撑大专项清单 完整验证

严格覆盖以下步骤：
1. 打开样例 sample_points.xlsx
2. 第一次导入
3. 同一批文件重传
4. 负责人（周姐）补看投诉编号 + 修改施工备注
5. 保存、刷新重算
6. 导出去重版
7. 逐项核对：
   - 服务半径明细行数（应为4，不是8或10）
   - 施工改道专项清单数量（应为2：社区助餐点B + 夜间采样点1，不是4）
   - 社区助餐点B的重复批次处理（应合并为1条，含2个批次追溯）
   - 夜间采样点1的重复批次处理（应合并为1条，含2个批次追溯）
   - 施工备注变更历史（应聚合全部批次内容）
   - 报告和导出内容的一致性
"""

import sys
import os
from pathlib import Path

from storage import DataStore, store
from workflow import WorkflowService
from self_check import SelfChecker
from exporter import UnifiedDataExporter
from models import PointStatus, AbnormalType


def reset():
    DataStore._instance = None


def print_step(title, n=72):
    print()
    print("=" * n)
    print(f"  {title}")
    print("=" * n)


def print_sub(title, n=72):
    print()
    print("-" * n)
    print(f"  {title}")
    print("-" * n)


def check(name, expected, actual, detail=""):
    ok = expected == actual
    icon = "✅" if ok else "❌"
    print(f"  {icon} {name}")
    print(f"      期望: {expected}")
    print(f"      实际: {actual}")
    if detail:
        print(f"      说明: {detail}")
    if not ok:
        print(f"      ❌❌❌ 不通过！")
    return ok


def run_full_verification():
    reset()
    all_ok = True

    operator_zhoujie = "社区书记周姐"
    operator_resident = "居民代表李阿姨"
    sample_file = "sample_points.xlsx"

    print_step("【步骤 1/7】打开样例文件 sample_points.xlsx")
    import pandas as pd
    df_raw = pd.read_excel(sample_file).fillna("")
    print(f"  文件: {sample_file}")
    print(f"  行数: {len(df_raw)}")
    print(f"  点位名称列表: {list(df_raw['点位名称'])}")
    print()
    print("  原始内容预览：")
    for idx, row in df_raw.iterrows():
        note = row.get("施工备注") or ""
        print(f"    行{idx+2} | {row['点位名称']:<10} | {row['地址']:<10} | 备注: {note or '(空)'}")

    # =================================================================
    print_step("【步骤 2/7】第一次导入 sample_points.xlsx")
    # =================================================================
    batch1 = WorkflowService.step1_import_night_sampling_points(sample_file, operator_zhoujie)
    total_after_1 = len(store.get_all_points())
    construction_report_1 = UnifiedDataExporter.get_construction_detour_report(deduped=True)
    detail_rows_1 = construction_report_1["details"]

    print(f"  批次ID: {batch1.batch_id}")
    print(f"  导入数: {batch1.total_count}")
    print(f"  全量总数: {total_after_1}")
    print(f"  去重后点位数: {len(UnifiedDataExporter._get_deduped_points())}")
    print(f"  施工改道专项清单（去重后）行数: {construction_report_1['total_points_under_rule']}")
    print(f"  其中施工未同步到地图数: {construction_report_1['total_not_synced']}")

    print("\n  施工改道专项清单明细（第一次导入后）：")
    for d in detail_rows_1:
        print(
            f"    [{d['点位名称']}] 批次数={d['重复批次数']} | "
            f"初始备注={d['初始施工备注(最早批次首次导入)']} | "
            f"当前备注={d['当前施工备注(最新批次)']} | "
            f"未同步={d['是否触发施工未同步(最新状态)']}"
        )

    check1 = check(
        "第一次导入后施工改道专项清单行数",
        expected=2,
        actual=construction_report_1["total_points_under_rule"],
        detail="社区助餐点B + 夜间采样点1，共2个真实点位",
    )
    all_ok = all_ok and check1

    check2 = check(
        "第一次导入后施工未同步到地图数",
        expected=2,
        actual=construction_report_1["total_not_synced"],
    )
    all_ok = all_ok and check2

    # =================================================================
    print_step("【步骤 3/7】同一批 sample_points.xlsx 重传（关键测试点）")
    # =================================================================
    batch2 = WorkflowService.step1_import_night_sampling_points(sample_file, operator_zhoujie)
    total_after_2 = len(store.get_all_points())
    deduped_count = len(UnifiedDataExporter._get_deduped_points())

    construction_report_2_deduped = UnifiedDataExporter.get_construction_detour_report(deduped=True)
    construction_report_2_full = UnifiedDataExporter.get_construction_detour_report(deduped=False)

    print(f"  重传批次ID: {batch2.batch_id}")
    print(f"  重传后全量总数: {total_after_2} (第一次{batch1.total_count} + 第二次{batch2.total_count})")
    print(f"  去重后的点位数量: {deduped_count} (应保持4，不因重传增加)")
    print()
    print(f"  ---- 全量口径（未去重）----")
    print(f"  施工改道专项清单行数(全量): {construction_report_2_full['total_points_under_rule']} (重传后翻倍=4)")
    print(f"  全量口径下施工未同步数: {construction_report_2_full['total_not_synced']}")
    print()
    print(f"  ---- 去重口径（居民实际看到的）----")
    print(f"  施工改道专项清单行数(去重): {construction_report_2_deduped['total_points_under_rule']} (关键: 应保持2)")
    print(f"  去重口径下施工未同步数: {construction_report_2_deduped['total_not_synced']} (关键: 应保持2)")
    print(f"  被合并掉的重传批次: {construction_report_2_deduped['total_duplicate_batches_across_points']}")

    detail_rows_2 = construction_report_2_deduped["details"]
    print("\n  施工改道专项清单（去重后，重传后）：")
    for d in detail_rows_2:
        print(
            f"    [{d['点位名称']}] "
            f"重复批次数={d['重复批次数']} (应=2，因为重传过1次) | "
            f"当前备注={d['当前施工备注(最新批次)']} | "
            f"未同步={d['是否触发施工未同步(最新状态)']} | "
            f"涉及批次={d['涉及批次列表'][:50]}..."
        )

    check3 = check(
        "重传后全量点数翻倍",
        expected=10,
        actual=total_after_2,
        detail="证明重传确实发生了",
    )
    all_ok = all_ok and check3

    check4 = check(
        "重传后去重后点位数量不翻倍（关键）",
        expected=4,
        actual=deduped_count,
        detail="同一名称+地址的点位应合并",
    )
    all_ok = all_ok and check4

    check5 = check(
        "重传后施工改道专项清单（去重）行数不翻倍（核心）",
        expected=2,
        actual=construction_report_2_deduped["total_points_under_rule"],
        detail="社区助餐点B + 夜间采样点1，重传前后都是2条，不应被撑大到4",
    )
    all_ok = all_ok and check5

    check6 = check(
        "重传后施工未同步到地图数（去重）不翻倍（核心）",
        expected=2,
        actual=construction_report_2_deduped["total_not_synced"],
        detail="居民看到的施工问题数量不因为重传翻倍",
    )
    all_ok = all_ok and check6

    # 核对社区助餐点B和夜间采样点1各自的重复批次数
    point_b = next(d for d in detail_rows_2 if d["点位名称"] == "社区助餐点B")
    point_night = next(d for d in detail_rows_2 if "夜间采样点" in d["点位名称"])
    check7 = check(
        "社区助餐点B的重复批次数=2",
        expected=2,
        actual=point_b["重复批次数"],
        detail="重传后同一名称+地址的批次数应可追溯",
    )
    all_ok = all_ok and check7

    check8 = check(
        "夜间采样点1的重复批次数=2",
        expected=2,
        actual=point_night["重复批次数"],
    )
    all_ok = all_ok and check8

    # =================================================================
    print_step("【步骤 4/7】负责人补看/补录操作（周姐）")
    # =================================================================
    all_points_now = store.get_all_points()
    night_point_sample = next(p for p in all_points_now if "夜间采样点" in p.name)
    b_point_sample = next(p for p in all_points_now if p.name == "社区助餐点B")

    print_sub("4a. 周姐补看居民投诉编号 - 夜间采样点1")
    night_point_deduped = next(
        p for p in UnifiedDataExporter._get_deduped_points()
        if "夜间采样点" in p.name
    )
    complaint = "TS20260620001"
    updated_night = WorkflowService.step2_add_complaint_id(
        night_point_deduped.id, complaint, operator_zhoujie
    )
    print(f"  点位: {updated_night.name}")
    print(f"  投诉编号已补: {updated_night.complaint_id}")
    print(f"  是否人工改动: {updated_night.is_manual_modified}")

    print_sub("4b. 周姐修改施工备注 - 社区助餐点B（记录改前/改后/原因）")
    b_point_deduped = next(
        p for p in UnifiedDataExporter._get_deduped_points()
        if p.name == "社区助餐点B"
    )
    old_note_b = b_point_deduped.construction_note
    new_note_b = "幸福路改道工程已完成验收，地图位置已同步"
    reason_b = "接居民投诉编号TS20260620002后现场核实，施工队于今日完成改道收尾"
    updated_b = WorkflowService.update_construction_note(
        b_point_deduped.id, new_note_b, operator_zhoujie, reason_b
    )
    print(f"  点位: {updated_b.name}")
    print(f"  改前备注: {old_note_b}")
    print(f"  改后备注: {updated_b.construction_note}")
    print(f"  修改原因: {reason_b}")

    # =================================================================
    print_step("【步骤 5/7】保存、刷新重算、自检")
    # =================================================================
    SelfChecker.check_duplicate_import()
    construction_issues = SelfChecker.check_all_construction_issues()
    export_ok, export_issues = SelfChecker.check_export_consistency()
    full_report = SelfChecker.run_full_check()

    print(f"  重复导入自检问题数: {full_report['summary']['duplicate_count']}")
    print(f"  施工改道自检问题数: {full_report['summary']['construction_count']}")
    print(f"  导出一致性自检: {'通过' if export_ok else '不通过'}")
    if export_issues:
        for i in export_issues:
            print(f"    - {i}")

    print("\n  补录+修改后的施工改道专项清单（去重）：")
    report_after_edit = UnifiedDataExporter.get_construction_detour_report(deduped=True)
    for d in report_after_edit["details"]:
        print(
            f"    [{d['点位名称']}] "
            f"批次数={d['重复批次数']} | "
            f"初始→当前备注: {d['初始施工备注(最早批次首次导入)']} → {d['当前施工备注(最新批次)']} | "
            f"未同步={d['是否触发施工未同步(最新状态)']}"
        )

    # =================================================================
    print_step("【步骤 6/7】导出去重版 Excel")
    # =================================================================
    export_path = "重传不撑大验证_去重版导出.xlsx"
    UnifiedDataExporter.export_to_excel(export_path, deduped=True)
    print(f"  导出路径: {Path(export_path).absolute()}")

    xls = pd.ExcelFile(export_path)
    print(f"  包含的sheet: {xls.sheet_names}")

    df_detail = pd.read_excel(export_path, sheet_name="服务半径明细(去重)")
    df_construction = pd.read_excel(export_path, sheet_name="施工改道专项清单")
    df_history = pd.read_excel(export_path, sheet_name="施工备注变更历史(含全部批次)")
    df_audit = pd.read_excel(export_path, sheet_name="审计追踪(聚合全部批次)")
    df_dup = pd.read_excel(export_path, sheet_name="重复批次明细(可追回重传)")
    df_summary = pd.read_excel(export_path, sheet_name="导出汇总与口径")

    # =================================================================
    print_step("【步骤 7/7】逐项核对导出内容（核心验证）")
    # =================================================================

    print_sub("7a. 服务半径明细行数（去重后）")
    check9 = check(
        "服务半径明细(去重)行数",
        expected=4,
        actual=len(df_detail),
        detail="4个不重复的点位名称+地址",
    )
    all_ok = all_ok and check9
    print(f"  明细中的点位: {list(df_detail['点位名称'])}")

    print_sub("7b. 施工改道专项清单行数 - 重点证明不被重传撑大")
    check10 = check(
        "施工改道专项清单行数",
        expected=2,
        actual=len(df_construction),
        detail="关键：社区助餐点B和夜间采样点1各1条，即使重传过也不应变成4条",
    )
    all_ok = all_ok and check10

    print(f"  清单中的点位: {list(df_construction['点位名称'])}")
    if "重复批次数" in df_construction.columns:
        for _, r in df_construction.iterrows():
            print(f"    {r['点位名称']}: 重复批次数={r['重复批次数']}")
    if "涉及批次列表" in df_construction.columns:
        for _, r in df_construction.iterrows():
            print(f"    {r['点位名称']}: 涉及批次={r['涉及批次列表']}")

    print_sub("7c. 社区助餐点B的重复批次处理")
    b_row = df_construction[df_construction["点位名称"] == "社区助餐点B"].iloc[0]
    check11 = check(
        "社区助餐点B在专项清单中仅出现1次",
        expected=1,
        actual=len(df_construction[df_construction["点位名称"] == "社区助餐点B"]),
        detail="不能因为重传出现2行社区助餐点B",
    )
    all_ok = all_ok and check11

    check12 = check(
        "社区助餐点B的重复批次数=2（重传可追溯）",
        expected=2,
        actual=int(b_row["重复批次数"]) if "重复批次数" in df_construction.columns else -1,
    )
    all_ok = all_ok and check12

    check13 = check(
        "社区助餐点B的初始施工备注(最早批次首次导入)=幸福路施工临时改道",
        expected="幸福路施工临时改道",
        actual=str(b_row.get("初始施工备注(最早批次首次导入)", "")).strip(),
    )
    all_ok = all_ok and check13

    check14 = check(
        "社区助餐点B的当前施工备注(最新批次)=改后文本",
        expected=new_note_b,
        actual=str(b_row.get("当前施工备注(最新批次)", "")).strip(),
    )
    all_ok = all_ok and check14

    print_sub("7d. 夜间采样点1的重复批次处理")
    night_row = df_construction[df_construction["点位名称"].str.contains("夜间采样点")].iloc[0]
    check15 = check(
        "夜间采样点1在专项清单中仅出现1次",
        expected=1,
        actual=len(df_construction[df_construction["点位名称"].str.contains("夜间采样点")]),
    )
    all_ok = all_ok and check15

    check16 = check(
        "夜间采样点1的重复批次数=2",
        expected=2,
        actual=int(night_row["重复批次数"]) if "重复批次数" in df_construction.columns else -1,
    )
    all_ok = all_ok and check16

    check17 = check(
        "夜间采样点1的初始施工备注=前方修路请绕行",
        expected="前方修路请绕行",
        actual=str(night_row.get("初始施工备注(最早批次首次导入)", "")).strip(),
    )
    all_ok = all_ok and check17

    print_sub("7e. 施工备注变更历史记录（聚合全部批次 + 补录内容）")
    history_b = df_history[df_history["点位名称"] == "社区助餐点B"]
    history_night = df_history[df_history["点位名称"].str.contains("夜间采样点")]
    print(f"  社区助餐点B的变更历史记录数: {len(history_b)}")
    print(f"  夜间采样点1的变更历史记录数: {len(history_night)}")

    if len(history_b) > 0:
        print("  社区助餐点B的变更历史详情：")
        for _, r in history_b.iterrows():
            print(
                f"    批次{r.get('所属批次','')[:20]}... | "
                f"{r.get('操作动作','')} | "
                f"改前: {str(r.get('施工备注_改前',''))[:15]} | "
                f"改后: {str(r.get('施工备注_改后',''))[:20]}"
            )

    check18 = check(
        "社区助餐点B的施工备注变更历史至少包含改前和改后记录",
        expected=True,
        actual=any(
            "改前" in str(r.get("备注说明", "")) or str(r.get("施工备注_改后", "")) == new_note_b
            for _, r in history_b.iterrows()
        ),
        detail="能从历史记录反查改前文本、改后文本、修改原因",
    )
    all_ok = all_ok and check18

    print_sub("7f. 报告 vs 导出内容一致性")
    check19 = check(
        "报告中专项清单行数 == 导出专项清单sheet行数",
        expected=report_after_edit["total_points_under_rule"],
        actual=len(df_construction),
    )
    all_ok = all_ok and check19

    check20 = check(
        "报告中去重后点数 == 导出明细sheet行数",
        expected=len(UnifiedDataExporter._get_deduped_points()),
        actual=len(df_detail),
    )
    all_ok = all_ok and check20

    print_sub("7g. 重复批次明细sheet（可追回重传）")
    dup_groups_count = df_dup["去重键(名称+地址)"].nunique() if "去重键(名称+地址)" in df_dup.columns else 0
    print(f"  重复批次数组数: {dup_groups_count}")
    print(f"  重复明细总行数: {len(df_dup)}")
    dup_a_count = -1
    target_key = "社区助餐点A||幸福路100号"
    if "去重键(名称+地址)" in df_dup.columns:
        dup_a_count = len(df_dup[df_dup["去重键(名称+地址)"] == target_key])
    check21 = check(
        "重复批次明细中社区助餐点A出现4次（同批重复2条 × 重传2批 = 4条）",
        expected=4,
        actual=dup_a_count,
        detail="社区助餐点A在同批Excel里本身就重复了2行（行2和行5），重传后×2倍，共4条",
    )
    all_ok = all_ok and check21

    print_sub("7h. 导出汇总与口径sheet")
    print("  导出汇总内容：")
    for _, r in df_summary.iterrows():
        print(f"    {r['项目']}: {r['数值']}")

    # =================================================================
    print_step("【从施工改道记录反查完整链路】")
    # =================================================================
    print_sub("夜间采样点1 - get_audit_evidence 完整证据反查")
    evidence = UnifiedDataExporter.get_audit_evidence(night_point_deduped.id)
    print(f"  点位名称: {evidence['point_name']}")
    print(f"  去重键: {evidence['dedup_key']}")
    print(f"  含重传批次数: {evidence['group_size(含重传批次数)']}")
    print(f"  初始施工备注: {evidence['initial_construction_note']}")
    print(f"  当前施工备注: {evidence['current_construction_note']}")
    print(f"  初始服务半径: {evidence['initial_service_radius']}")
    print(f"  当前服务半径: {evidence['current_service_radius']}")

    print(f"\n  batch_trace（可追回每次重传）：")
    for b in evidence["batch_trace"]:
        print(
            f"    批次{b['batch_id'][:20]}... | "
            f"行{b['original_excel_row']} | "
            f"导入备注: {b['construction_note_on_import']} | "
            f"状态: {b['status']} | "
            f"是否最新: {'是' if b['is_latest'] else '否'}"
        )

    print(f"\n  施工备注变更历史（聚合全部批次）：")
    for h in evidence["construction_history_all_batches"]:
        print(
            f"    {h['操作时间']} | {h['操作人']} | {h['操作动作']}\n"
            f"      改前: {h['施工备注_改前']}\n"
            f"      改后: {h['施工备注_改后']}\n"
            f"      状态: {h['状态_改前']} → {h['状态_改后']}\n"
            f"      说明: {h['备注说明']}"
        )

    # =================================================================
    print_step("【最终核对总结】")
    # =================================================================
    print(f"\n  共 {21} 项检查，{'全部通过 ✅' if all_ok else '存在未通过项 ❌'}")
    print()
    print("  核心结论：")
    print("  1. 服务半径明细（去重）行数 = 4，不翻倍")
    print(f"  2. 施工改道专项清单行数 = {len(df_construction)}（实际值），居民看到的数量不被重传撑大")
    print(f"  3. 社区助餐点B在专项清单中仅出现1次，重复批次数={b_row.get('重复批次数') if '重复批次数' in df_construction.columns else 'N/A'}可追溯")
    print(f"  4. 夜间采样点1在专项清单中仅出现1次，重复批次数={night_row.get('重复批次数') if '重复批次数' in df_construction.columns else 'N/A'}可追溯")
    print("  5. 施工备注变更历史聚合了全部批次内容，可追回改前/改后/原因")
    print("  6. 报告与导出共用同一去重口径")
    print(f"\n  导出文件已保存: {export_path}")
    return all_ok


if __name__ == "__main__":
    success = run_full_verification()
    sys.exit(0 if success else 1)
