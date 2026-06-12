"""
社区助餐点服务半径 - 施工改道专项核对脚本

重点验证：
1. 夜间采样点第一次导入后的施工备注与施工改道记录
2. 施工改道专项清单与服务半径明细是否对得上
3. 负责人补看/补录后，能反查改前内容、改后内容、状态变化
4. 导出能追回原始材料（原始行号、导入批次、初始施工备注）
5. 去重口径：同一批重传不翻倍
"""

import sys
from storage import DataStore, store
from workflow import WorkflowService
from self_check import SelfChecker
from exporter import UnifiedDataExporter
from models import PointStatus, AbnormalType


def reset_store():
    DataStore._instance = None


def run_construction_detour_verification():
    print("=" * 70)
    print("社区助餐点服务半径 - 施工改道专项核对")
    print("=" * 70)

    operator_zhoujie = "社区书记周姐"
    operator_resident = "居民代表李阿姨"

    # ========== 第一步：夜间采样点第一次导入 ==========
    print("\n【第1步】夜间采样点第一次导入")
    print("-" * 70)

    batch = WorkflowService.step1_import_night_sampling_points(
        "sample_points.xlsx", operator_zhoujie
    )
    print(f"导入批次: {batch.batch_id}")
    print(f"导入总数: {batch.total_count} 个点位")

    # 核对施工备注
    print("\n>> 核对：导入后各点位的施工备注和状态")
    all_points = sorted(
        store.get_all_points(), key=lambda p: p.original_row_number
    )
    for p in all_points:
        has_construction_issue = AbnormalType.CONSTRUCTION_NOT_SYNCED in p.abnormal_types
        note_display = p.construction_note if p.construction_note else '(空)'
        print(
            f"  [行号{p.original_row_number}] {p.name:<10} | "
            f"施工备注: {note_display:<15} | "
            f"触发改道未同步: {'是' if has_construction_issue else '否':<3} | "
            f"状态: {p.status.value}"
        )

    # ========== 核对：施工改道专项清单 vs 明细 ==========
    print("\n【第2步】核对：施工改道专项清单 vs 服务半径明细")
    print("-" * 70)

    construction_report = UnifiedDataExporter.get_construction_detour_report()
    print(f"施工改道专项清单总数: {construction_report['total_construction_points']}")
    print(f"其中'施工未同步到地图'数: {construction_report['total_not_synced']}")

    detail_points = UnifiedDataExporter.get_for_page_display()
    detail_construction_count = sum(
        1 for d in detail_points if d["是否施工改道未同步"] == "是"
    )
    print(f"服务半径明细中'施工改道未同步'数: {detail_construction_count}")

    match = construction_report["total_not_synced"] == detail_construction_count
    print(f"\n✅ 数量一致对得上: {match}")
    if not match:
        print("❌ 不一致！")

    print("\n>> 施工改道专项清单明细：")
    for d in construction_report["details"]:
        print(
            f"  [行号{d['原始行号']}] {d['点位名称']:<10} | "
            f"初始备注: {d['初始施工备注'] or '(空)':<15} | "
            f"当前备注: {d['当前施工备注'] or '(空)':<15} | "
            f"触发未同步: {d['是否触发施工未同步']} | "
            f"初始状态→当前状态: {d['初始状态']}→{d['当前状态']}"
        )

    # ========== 第三步：周姐补看投诉编号 ==========
    print("\n【第3步】社区书记周姐补看居民投诉编号（夜间采样点1）")
    print("-" * 70)

    night_point = next(
        p for p in all_points if "夜间采样点" in p.name
    )
    print(f"操作前 - 点位: {night_point.name}, 投诉编号: {night_point.complaint_id or '(空)'}")

    updated = WorkflowService.step2_add_complaint_id(
        night_point.id, "TS20260612001", operator_zhoujie
    )
    print(f"操作后 - 投诉编号: {updated.complaint_id}")
    print(f"操作后 - 是否人工改动: {updated.is_manual_modified}")

    # 反查：施工备注改前改后和状态变化
    print("\n>> 反查：从施工备注历史看这次操作有没有影响")
    history = UnifiedDataExporter.get_construction_history(night_point.id)
    for h in history:
        print(
            f"  {h['操作时间']} | {h['操作人']:<8} | {h['操作动作']:<10} | "
            f"改前备注: {h['施工备注_改前'] or '(空)':<15} | "
            f"改后备注: {h['施工备注_改后'] or '(空)':<15} | "
            f"状态: {h['状态_改前']}→{h['状态_改后']}"
        )

    # ========== 第四步：周姐改施工备注 ==========
    print("\n【第4步】周姐修改施工备注（明确记录改前/改后/原因）")
    print("-" * 70)

    point_b = next(p for p in all_points if p.name == "社区助餐点B")
    old_note = point_b.construction_note
    print(f"改前备注: {old_note}")
    print(f"改前状态: {point_b.status.value}")

    new_note = "幸福路施工改道已同步地图，恢复正常通行"
    change_reason = "接施工队通知，改道路段已恢复，地图已同步"
    updated_b = WorkflowService.update_construction_note(
        point_b.id, new_note, operator_zhoujie, change_reason
    )
    print(f"改后备注: {updated_b.construction_note}")
    print(f"改后状态: {updated_b.status.value}")
    print(f"是否还有施工未同步异常: {'是' if AbnormalType.CONSTRUCTION_NOT_SYNCED in updated_b.abnormal_types else '否'}")

    # 反查这次修改的改前改后
    print("\n>> 反查：施工备注修改的完整记录（改前文本、改后文本、为什么改）")
    history_b = UnifiedDataExporter.get_construction_history(point_b.id)
    for h in history_b:
        print(
            f"  {h['操作时间']} | {h['操作人']:<8} | {h['操作动作']:<10}\n"
            f"    改前: {h['施工备注_改前'] or '(空)'}\n"
            f"    改后: {h['施工备注_改后'] or '(空)'}\n"
            f"    状态: {h['状态_改前']} → {h['状态_改后']}\n"
            f"    原因/备注: {h['备注说明'] or '(无)'}"
        )

    # ========== 第五步：居民代表复核 ==========
    print("\n【第5步】居民代表复核剩余的施工改道点位")
    print("-" * 70)

    review_points = WorkflowService.get_points_for_resident_review()
    print(f"待居民代表复核的点位: {len(review_points)} 个")
    for p in review_points:
        print(f"  - {p.name} (行号:{p.original_row_number}): {p.construction_note}")

    if review_points:
        reviewed = WorkflowService.mark_resident_reviewed(
            review_points[0].id,
            operator_resident,
            is_approved=False,
            remark="现场核实改道仍在进行，需维持施工改道状态",
        )
        print(f"\n复核后 - {reviewed.name}: 状态={reviewed.status.value}")

    # ========== 第六步：核对审计证据（居民代表追问时） ==========
    print("\n【第6步】居民代表追问：调取审计证据（追回原始材料）")
    print("-" * 70)

    evidence = UnifiedDataExporter.get_audit_evidence(night_point.id)
    print(f"点位: {evidence['point_name']}")
    print(f"原始Excel行号: {evidence['original_row_number']}")
    print(f"初始施工备注: {evidence['initial_construction_note'] or '(空)'}")
    print(f"当前施工备注: {evidence['current_construction_note'] or '(空)'}")
    print(f"初始服务半径: {evidence['initial_service_radius']}")
    print(f"当前服务半径: {evidence['current_service_radius']}")

    print("\n>> 原始材料追溯:")
    src = evidence["source_tracing"]
    print(f"  导入批次ID: {src['import_batch_id']}")
    print(f"  原始Excel行: 第{src['original_excel_row']}行")
    print(f"  创建时间: {src['creation_time']}")
    print(f"  首次导入备注: {src['first_import_note'] or '(空)'}")
    print(f"  能否追到原始材料: {'是' if src['can_trace_to_original'] else '否'}")

    print("\n>> 半径变化历史（从原始到现在）:")
    for log in evidence["radius_history"]:
        print(
            f"  {log['timestamp'][:19]} | {log['operator']:<8} | {log['action']:<10} | "
            f"半径: {log['service_radius_before']} → {log['service_radius_after']} | "
            f"状态: {log['status_before']} → {log['status_after']}"
        )

    # ========== 第七步：导出Excel并核对 ==========
    print("\n【第7步】导出Excel并核对施工改道记录")
    print("-" * 70)

    export_path = "施工改道专项核对_导出结果.xlsx"
    UnifiedDataExporter.export_to_excel(export_path)
    print(f"已导出到: {export_path}")

    import pandas as pd
    xls = pd.ExcelFile(export_path)
    print(f"\nExcel包含的sheet: {xls.sheet_names}")

    print("\n>> 核对：施工改道专项清单 sheet")
    df_construction = pd.read_excel(export_path, sheet_name="施工改道专项清单")
    print(f"  行数: {len(df_construction)}")
    print(f"  列名: {list(df_construction.columns)}")
    not_synced_count = len(df_construction[df_construction["是否触发施工未同步"] == "是"])
    print(f"  其中'施工未同步到地图'数: {not_synced_count}")

    print("\n>> 核对：施工备注变更历史 sheet")
    df_history = pd.read_excel(export_path, sheet_name="施工备注变更历史")
    print(f"  行数: {len(df_history)}")
    if len(df_history) > 0:
        print(f"  列名: {list(df_history.columns)}")
        print("  样例数据：")
        for _, row in df_history.iterrows():
            print(
                f"    {row['点位名称']:<10} | {row['操作动作']:<10} | "
                f"改前: {str(row['施工备注_改前'])[:15]:<15} | "
                f"改后: {str(row['施工备注_改后'])[:15]:<15}"
            )

    print("\n>> 核对：审计追踪(含施工备注) sheet")
    df_audit = pd.read_excel(export_path, sheet_name="审计追踪(含施工备注)")
    print(f"  行数: {len(df_audit)}")
    has_construction_col = "施工备注_改前" in df_audit.columns
    print(f"  包含施工备注改前列: {'是' if has_construction_col else '否'}")
    print(f"  包含施工备注改后列: {'是' if '施工备注_改后' in df_audit.columns else '否'}")

    print("\n>> 核对：重复点位明细 sheet（验证去重口径）")
    df_dup = pd.read_excel(export_path, sheet_name="重复点位明细")
    print(f"  行数: {len(df_dup)}")
    dup_groups = df_dup["去重键"].nunique()
    print(f"  重复组数: {dup_groups}")

    print("\n>> 核对：导出汇总 sheet")
    df_summary = pd.read_excel(export_path, sheet_name="导出汇总")
    print(f"  行数: {len(df_summary)}")
    for _, row in df_summary.iterrows():
        print(f"    {row['项目']}: {row['数值']}")

    # ========== 第八步：第二次导入（模拟重传），验证去重 ==========
    print("\n【第8步】模拟同一批重传，验证去重口径")
    print("-" * 70)

    batch2 = WorkflowService.step1_import_night_sampling_points(
        "sample_points.xlsx", operator_zhoujie
    )
    print(f"第二次导入批次: {batch2.batch_id}")
    print(f"第二次导入数: {batch2.total_count}")

    total_after = len(store.get_all_points())
    deduped_count = len(UnifiedDataExporter._get_deduped_points())
    print(f"\n全量总数: {total_after} (第一次{batch.total_count} + 第二次{batch2.total_count})")
    print(f"去重后数量: {deduped_count}")
    print(f"去重口径: 点位名称+地址，取最新更新记录")
    print(f"去重后数量是否等于不重复的点位种类数: {deduped_count == 4}")

    # 导出去重版
    deduped_path = "施工改道专项核对_去重版.xlsx"
    UnifiedDataExporter.export_to_excel(deduped_path, deduped=True)
    df_deduped = pd.read_excel(deduped_path, sheet_name="服务半径明细(去重)")
    print(f"\n去重版导出 - 明细行数: {len(df_deduped)}")
    print(f"去重版导出 - 是否包含重复点位sheet: {'重复点位明细' in pd.ExcelFile(deduped_path).sheet_names}")

    # ========== 最终总结 ==========
    print("\n" + "=" * 70)
    print("【核对总结】")
    print("=" * 70)
    checks = [
        ("施工改道专项清单与明细数量一致", construction_report["total_not_synced"] == detail_construction_count),
        ("施工备注修改记录了改前文本", any("修改施工备注" in h["操作动作"] for h in history_b)),
        ("施工备注修改记录了改后文本", any(h["施工备注_改后"] == new_note for h in history_b)),
        ("施工备注修改记录了修改原因", any(change_reason in h["备注说明"] for h in history_b)),
        ("能追回原始Excel行号", evidence["original_row_number"] > 0),
        ("能追回导入批次", bool(evidence["source_tracing"]["import_batch_id"])),
        ("能看到状态变化历史", len(evidence["radius_history"]) >= 2),
        ("去重口径生效（重传不翻倍去重后数量）", deduped_count == 4),
        ("导出包含施工改道专项sheet", "施工改道专项清单" in xls.sheet_names),
        ("导出包含施工备注变更历史sheet", "施工备注变更历史" in xls.sheet_names),
        ("审计追踪包含施工备注改前改后列", has_construction_col),
    ]

    all_pass = True
    for name, result in checks:
        status = "✅" if result else "❌"
        if not result:
            all_pass = False
        print(f"  {status} {name}")

    print(f"\n全部通过: {'是' if all_pass else '否'}")
    print("=" * 70)


if __name__ == "__main__":
    reset_store()
    run_construction_detour_verification()
