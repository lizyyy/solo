#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
端到端演示脚本：在同一个进程里走完所有步骤，
演示 confirm-unit / revise 的历史留存和筛选导出流程。
CLI 也会通过 output/变更历史.json 在多次调用之间回放状态。
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

from core.weight_curve import WeightCurveManager
from core.anomaly_engine import AnomalyEngine
from core.data_loader import DataLoader
from core.exporter import Exporter
from core.models import ProcessingStatus


def main():
    print("\n" + "=" * 70)
    print("【流浪动物救助异常提醒】端到端演示")
    print("=" * 70)

    curve_mgr = WeightCurveManager()
    loader = DataLoader(curve_mgr)
    engine = AnomalyEngine(curve_mgr)
    exporter = Exporter()

    # ==== 第 1 步：加载 ====
    print("\n▶️  第 1 步：加载运营主管交来的材料（目录 data_incoming/）")
    results = loader.load_directory(os.path.join(BASE, "data_incoming"))
    for fn, (ok, tot) in results.items():
        print(f"   · {fn}: {ok}/{tot} 条成功")
    print(f"   合计：{len(curve_mgr.records)} 条记录，{len(curve_mgr.records_by_pet)} 只宠物")

    # ==== 第 2 步：异常检测 ====
    print("\n▶️  第 2 步：异常检测")
    anomalies = engine.detect_all()
    from collections import Counter
    by_tp = Counter(a.anomaly_type.value for a in anomalies)
    by_st = Counter(a.status.value for a in anomalies)
    print(f"   异常总数：{len(anomalies)}")
    print(f"   按类型：{dict(by_tp)}")
    print(f"   按状态：{dict(by_st)}")

    # 保存首版产物
    engine.save_anomaly_queue(os.path.join(exporter.output_dir, "异常队列_初版.json"))
    curve_mgr.save_curves_json(os.path.join(exporter.output_dir, "体重曲线.json"))
    exporter.export_records_debug(curve_mgr.records, "体重记录明细.csv")

    # ==== 第 3 步：打印橘座(P001)的异常 ====
    print("\n▶️  第 3 步：点异常 → 回到曲线 + 计算口径（以 P001 橘座为例）")
    p001_anoms = [a for a in anomalies if a.pet_id == "P001"]
    print(f"   P001 橘座 异常数：{len(p001_anoms)}")
    for a in p001_anoms:
        print(f"     [{a.anomaly_type.value}] {a.status.value}")
        print(f"       卡住原因：{a.block_reason}")
        print(f"       下一步：  {a.next_step}")
        print(f"       责任人：  {a.responsible_role} / {a.responsible_contact}")
        print(f"       曲线索引：{a.weight_curve_ref}")
        print(f"       计算口径：{a.calc_formula}")

    # 打印 P001 曲线
    snap = curve_mgr.build_curve("P001")
    print(f"\n   📈  P001 橘座 体重曲线（{len(snap.points)}点）：趋势={snap.trend}，{snap.calc_note}")
    for i, p in enumerate(snap.points):
        involved = any(p["record_id"] in a.involved_record_ids for a in p001_anoms)
        tag = "  ⚠️ 关联异常" if involved else ""
        st_mark = "✅" if p["status"] == "已确认" else ("❓" if p["status"] == "需确认单位" else "❌")
        print(f"      [{p['date'][:10]}] {p['weight_kg']}kg {st_mark} 来源:{p['source_file']}:{p['source_row']} {tag}")

    # ==== 第 4 步：处理 P001 4/30 的单位缺失 ====
    print("\n▶️  第 4 步：人工确认单位 —— 找运营主管核完 P001 那条主人回忆 4.5 的单位")
    unit_anom = next(a for a in p001_anoms
                     if a.anomaly_type.value == "单位混写" and "4.5" in a.description)
    print(f"   原卡住：{unit_anom.block_reason}")
    result = engine.confirm_unit(unit_anom.anomaly_id, "kg", "阿岑",
                                  "已和运营主管核对：主人回忆时口头说的是 kg，实际和现场对得上")
    print(f"   处理后状态：{result.status.value}，解决人：{result.resolved_by}")

    # 打印变更历史
    h = engine.get_history_for_anomaly(unit_anom.anomaly_id)[0]
    print(f"   📝 变更历史留存：")
    print(f"      动作：{h.action} | 改判原因：{h.revision_reason}")
    print(f"      原结论 → 新结论：{h.previous_conclusion} → {h.new_conclusion}")
    print(f"      旧值→新值（首条涉及记录）：{json.dumps(list(h.old_values.values())[0], ensure_ascii=False)} → {json.dumps(list(h.new_values.values())[0], ensure_ascii=False)}")

    # ==== 第 5 步：改判 P001 体重骤变（主人补充 2.5斤 实际上是1.25kg但主人又改口说自己记错了单位，实际是5.0斤=2.5kg？不对，5.0斤是2.5kg和基线差太多。这里处理 P004 的大跳 ====
    print("\n▶️  第 5 步：改判结论 —— 处理 P004 毛豆 5/5 的 6.0kg 骤降（现场复核是录入错误，实际13.0kg）")
    p004_anoms = [a for a in anomalies if a.pet_id == "P004"]
    jump = next(a for a in p004_anoms if a.anomaly_type.value == "体重骤变" and "6.0" in a.description)
    print(f"   原卡住：{jump.block_reason}")
    print(f"   计算口径：{jump.calc_formula}")
    revised = engine.revise_conclusion(
        anomaly_id=jump.anomaly_id,
        new_conclusion="确认录入错误，原始单据是13.0kg不是6.0kg",
        revision_reason="现场复核原始电子秤记录，对照5/5当日操作日志和监控，录入员小数点少按一位",
        operator="阿岑",
        new_remark="2026-06-09 现场复核：电子秤log显示13.0kg，6.0为笔误",
        override_values={"weight_kg": 13.0},
    )
    print(f"   处理后状态：{revised.status.value}，解决人：{revised.resolved_by}")
    h2 = engine.get_history_for_anomaly(jump.anomaly_id)[0]
    print(f"   📝 历史留存（包含旧材料+改判原因+新备注）：")
    print(f"      改判原因：{h2.revision_reason}")
    print(f"      原结论→新结论：{h2.previous_conclusion} → {h2.new_conclusion}")
    print(f"      旧备注→新备注：{h2.old_remark[:40]} → {h2.new_remark[:40]}")
    print(f"      源材料引用记录数：{len(h2.source_materials_ref)} 条")

    # ==== 第 6 步：重新跑一次异常检测看剩下多少 ====
    print("\n▶️  第 6 步：处理后重新统计（看看少了几条）")
    anomalies2 = engine.detect_all()
    by_tp2 = Counter(a.anomaly_type.value for a in anomalies2)
    by_st2 = Counter(a.status.value for a in anomalies2)
    unresolved = [a for a in anomalies2 if a.status.value not in ("已解决", "已改判", "已确认", "已归档")]
    print(f"   异常：处理前 {len(anomalies)} → 处理后 {len(anomalies2)}")
    print(f"   未解决：{len(unresolved)} 条，按状态：{dict(by_st2)}")
    print(f"   历史变更记录数：{len(engine.history)} 条")

    # ==== 第 7 步：全量导出（筛选口径=屏幕筛选）====
    print("\n▶️  第 7 步：导出（屏幕筛选口径=文件口径）")
    filter_a = {"status": "需确认单位"}
    q1 = engine.anomaly_queue_to_dicts(filter_a)
    path_csv = exporter.export_anomaly_queue_csv(q1, "异常队列_筛选_需确认单位.csv", filter_a)
    print(f"   筛选 status=需确认单位 → 屏幕 {len(q1)} 条，导出 {path_csv}")
    print(f"   筛选元信息（.filters.json）写了当时条件，别另起一套")

    filter_b = {"responsible_role": "宠物训练师"}
    q2 = engine.anomaly_queue_to_dicts(filter_b)
    path_csv2 = exporter.export_anomaly_queue_csv(q2, "异常队列_筛选_阿岑待办.csv", filter_b)
    print(f"   筛选 责任人=宠物训练师（阿岑你）→ 屏幕 {len(q2)} 条，导出 {path_csv2}")

    # 全量 + 曲线 + 历史
    all_q = engine.anomaly_queue_to_dicts()
    exporter.export_anomaly_queue_csv(all_q, "异常队列.csv")
    exporter.export_anomaly_queue_xlsx(all_q, "异常队列.xlsx")
    engine.save_anomaly_queue(os.path.join(exporter.output_dir, "异常队列.json"))
    engine.save_history(os.path.join(exporter.output_dir, "变更历史.json"))
    exporter.export_history_csv(engine.history, "变更历史.csv")
    curve_mgr.save_curves_json(os.path.join(exporter.output_dir, "体重曲线_最终版.json"))

    # 打印 P004 最终曲线
    snap_final = curve_mgr.build_curve("P004")
    print(f"\n   📈  P004 毛豆 最终曲线：{snap_final.calc_note}")
    for p in snap_final.points:
        st_mark = "✅" if p["status"] in ("已确认",) else ("♻️" if p["status"] == "已改判" else "❓")
        print(f"      [{p['date'][:10]}] {p['weight_kg']}kg {st_mark} 状态:{p['status']} 来源:{p['source_file']}:{p['source_row']}")

    print("\n" + "=" * 70)
    print("✅ 演示完成。所有产物在 output/ 目录：")
    for fn in sorted(os.listdir(exporter.output_dir)):
        print(f"   · {os.path.join(exporter.output_dir, fn)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
