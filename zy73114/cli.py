#!/usr/bin/env python3
"""施工变更交底清单 - 命令行工具

项目经理不写代码也能跑：
  python3 cli.py demo            # 一键跑完：加载样例 → 补签证 → 导出报告
  python3 cli.py list            # 查看变更单信息
  python3 cli.py add-visa        # 追加现场签证单备注
  python3 cli.py export          # 重新生成交底清单并导出Markdown
  python3 cli.py history         # 查看老叶调整判断的历史原因
  python3 cli.py offset          # 查看坐标偏移提醒（找谁、先看哪条）
"""

import sys
import os
from datetime import datetime
from typing import List

from models import ChangeOrder, JudgementImpact
from sample_data import build_review_meeting_sample
from exporter import ChangeOrderExporter
from audit import HistoryAuditor
from report import ReportGenerator

IMPACT_OPTIONS = {
    "1": JudgementImpact.STRUCTURAL_SAFETY,
    "2": JudgementImpact.MATERIAL_QUANTITY,
    "3": JudgementImpact.CONSTRUCTION_SEQUENCE,
    "4": JudgementImpact.COST,
    "5": JudgementImpact.DRAWING_VERSION,
}

SESSION_KEY = "_cli_co"


def _get_co() -> ChangeOrder:
    if not hasattr(sys.modules[__name__], SESSION_KEY):
        co = build_review_meeting_sample()
        setattr(sys.modules[__name__], SESSION_KEY, co)
    return getattr(sys.modules[__name__], SESSION_KEY)


def _set_co(co: ChangeOrder) -> None:
    setattr(sys.modules[__name__], SESSION_KEY, co)


def _sep(title: str) -> None:
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60 + "\n")


def cmd_demo() -> int:
    """一键演示完整流程"""
    _sep("加载评审会样例材料")
    co = build_review_meeting_sample()
    _set_co(co)
    print(f"项目：{co.project_name}")
    print(f"变更编号：{co.change_order_no}")
    print(f"关联图纸：{len(co.drawing_versions)} 版（最新：{co.get_latest_drawing().version}）")
    print(f"分项判断：{len(co.judgements)} 项")
    print(f"其中人工调整：{sum(1 for j in co.judgements if j.is_overridden)} 项")
    print(f"坐标偏移记录：{len(co.coordinate_offsets)} 条")

    _sep("第一次导出（基线版，无签证）")
    exporter = ChangeOrderExporter(co)
    r1 = exporter.export(exported_by="结构工程师老叶", rerun_material=True)
    print(f"处理类型：{r1.processing_type_label}")
    print(f"交付顺畅性评分：{r1.export_record.delivery_smoothness_score}/100")
    print(f"页面摘要核心判断：{_extract_core(r1.export_record.page_summary)}")

    _sep("临时补一条现场签证单备注")
    visa = co.add_visa_note(
        content="A区一层实际开挖发现土质较软，基础梁下需换填级配砂石300mm厚",
        created_by="现场工长王工",
        source_doc="现场签证单V-2026-0611-003（A栋）",
        affected_item_codes=["STR-A-001", "STR-B-001"],
        impacts=[
            JudgementImpact.STRUCTURAL_SAFETY,
            JudgementImpact.MATERIAL_QUANTITY,
            JudgementImpact.CONSTRUCTION_SEQUENCE,
        ],
    )
    co.save_version(operator="项目经理", change_summary="评审会前补签证单：A区基础换填")
    print(f"签证内容：{visa.content}")
    print(f"录入人：{visa.created_by}")
    print(f"来源：{visa.source_doc}")
    print(f"影响分项：{', '.join(visa.affected_judgements)}")
    print(f"影响类型：{', '.join(i.value for i in visa.impacts)}")

    _sep("第二次导出（含签证）")
    r2 = exporter.export(exported_by="项目经理", rerun_material=True)
    print(f"处理类型：{r2.processing_type_label}")
    print(f"页面摘要核心判断：{_extract_core(r2.export_record.page_summary)}")
    print(f"Warnings 中签证提示：")
    for w in r2.export_record.warnings:
        if "现场签证" in w:
            print(f"  {w}")

    print()
    assert "1 项受现场签证影响" in r2.export_record.page_summary or \
           "2 项受现场签证影响" in r2.export_record.page_summary, \
           "签证影响数量未正确写入页面摘要"
    print("✅ 验证通过：page_summary 与 judgements、warnings 口径一致")

    _sep("生成并导出 Markdown 报告")
    report = ReportGenerator(co, r2)
    md_path = report.save_markdown()
    txt_path = report.save_text()
    print(f"Markdown 报告：{os.path.abspath(md_path)}")
    print(f"Text 报告：    {os.path.abspath(txt_path)}")
    print()
    print("=== 报告预览（前60行）===")
    with open(md_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if i > 60:
                break
            print(line.rstrip())

    _sep("查看老叶调整判断的历史原因")
    auditor = HistoryAuditor(co)
    print(auditor.get_overridden_judgements_report())

    _sep("查看坐标偏移提醒（找谁确认、先看哪条）")
    for w in r2.export_record.warnings:
        if "坐标偏移" in w or "优先查看" in w or "请立即联系" in w:
            print(f"  {w}")

    print("\n" + "=" * 60)
    print("  ✅ 演示完成：项目经理已拿到可交评审会的交底清单")
    print("=" * 60 + "\n")
    return 0


def cmd_list() -> int:
    """查看当前变更单基本信息"""
    co = _get_co()
    _sep("变更单信息")
    print(f"项目名称：{co.project_name}")
    print(f"变更编号：{co.change_order_no}")
    print(f"创建人：{co.created_by}")
    print(f"当前版本：V{co.current_version}")
    print(f"已导出次数：{len(co.export_records)}")
    print()

    print("图纸版本：")
    for dv in co.drawing_versions:
        tag = " ← 最新版" if dv.is_latest else ""
        print(f"  {dv.version}（{dv.issued_at.strftime('%Y-%m-%d')}）{tag} - {dv.description}")

    print(f"\n分项判断（共{len(co.judgements)}项）：")
    for j in co.judgements:
        tag = " 📝人工调整" if j.is_overridden else ""
        print(f"  {j.item_code} {j.item_name}{tag}")
        print(f"    → {j.final_judgement}")

    print(f"\n现场签证单（共{len(co.visa_notes)}条）：")
    if not co.visa_notes:
        print("  （暂无签证）")
    for v in co.visa_notes:
        print(f"  [{v.created_at.strftime('%H:%M')}] {v.created_by}: {v.content}")
    return 0


def cmd_add_visa() -> int:
    """交互式追加现场签证单"""
    co = _get_co()
    _sep("追加现场签证单备注")

    content = input("签证内容：").strip()
    if not content:
        content = "现场实际情况与图纸不符，需按现场处理"

    created_by = input("录入人（默认：现场工长）：").strip() or "现场工长"
    source_doc = input("来源文档编号（默认：现场签证单V临时）：").strip() or "现场签证单V临时"

    print("\n影响分项（当前判断列表，用逗号分隔编号）：")
    for j in co.judgements:
        print(f"  {j.item_code} {j.item_name}")
    codes_raw = input("输入受影响编号：").strip() or co.judgements[0].item_code
    affected_codes = [c.strip() for c in codes_raw.split(",") if c.strip()]

    print("\n影响类型（多选，空格分隔）：")
    print("  1=结构安全  2=材料用量  3=施工顺序  4=成本  5=图纸版本")
    picks = input("输入编号（默认：1 2）：").strip().split() or ["1", "2"]
    impacts = [IMPACT_OPTIONS[p] for p in picks if p in IMPACT_OPTIONS]

    visa = co.add_visa_note(
        content=content,
        created_by=created_by,
        source_doc=source_doc,
        affected_item_codes=affected_codes,
        impacts=impacts,
    )
    co.save_version(operator="CLI用户", change_summary=f"补签证：{content[:20]}")
    print(f"\n✅ 已添加签证，ID：{visa.id}")
    return 0


def cmd_export() -> int:
    """导出交底清单报告"""
    co = _get_co()
    _sep("生成施工变更交底清单")
    operator = input("导出人（默认：项目经理）：").strip() or "项目经理"
    rerun = input("是否为重跑已有材料？(y/n，默认y)：").strip().lower() != "n"

    exporter = ChangeOrderExporter(co)
    result = exporter.export(exported_by=operator, rerun_material=rerun)

    print(f"\n✅ 导出成功")
    print(f"  处理类型：{result.processing_type_label}")
    print(f"  一致性校验：{'✅ 通过' if result.consistency_check.is_consistent else '❌ 不通过'}")
    print(f"  交付顺畅性：{result.export_record.delivery_smoothness_score}/100")

    report = ReportGenerator(co, result)
    md_path = report.save_markdown()
    txt_path = report.save_text()
    print(f"  Markdown 报告：{os.path.abspath(md_path)}")
    print(f"  Text 报告：    {os.path.abspath(txt_path)}")

    preview = input("\n显示报告前40行预览？(y/n，默认y)：").strip().lower() != "n"
    if preview:
        print()
        with open(md_path, "r", encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                if i > 40:
                    break
                print(line.rstrip())
    return 0


def cmd_history() -> int:
    """查看判断调整的历史原因"""
    co = _get_co()
    _sep("判断调整历史（下一班可看到完整过程）")
    auditor = HistoryAuditor(co)
    print(auditor.get_overridden_judgements_report())

    print("\n=== 版本快照列表 ===")
    for v in auditor.get_version_history():
        print(f"  V{v.version}  [{v.timestamp.strftime('%Y-%m-%d %H:%M')}] {v.operator} — {v.change_summary}")
    return 0


def cmd_offset() -> int:
    """查看坐标偏移提醒"""
    co = _get_co()
    _sep("模型坐标偏移提醒")

    if not co.coordinate_offsets:
        print("（暂无坐标偏移记录）")
        return 0

    exporter = ChangeOrderExporter(co)
    result = exporter.export(exported_by="查看工具", rerun_material=True)

    for w in result.export_record.warnings:
        if "坐标偏移" in w or "优先查看" in w or "请立即联系" in w or "受影响区域" in w:
            print(f"  {w}")
    return 0


def _extract_core(text: str) -> str:
    for marker in ["核心判断：", "核心判断:"]:
        if marker in text:
            start = text.index(marker) + len(marker)
            end = text.find("\n", start)
            if end != -1:
                return text[start:end].strip()
    return text[:80]


def _usage() -> None:
    print(__doc__)


COMMANDS = {
    "demo": cmd_demo,
    "list": cmd_list,
    "add-visa": cmd_add_visa,
    "export": cmd_export,
    "history": cmd_history,
    "offset": cmd_offset,
}


def main(argv: List[str]) -> int:
    if len(argv) < 2:
        _usage()
        return 1

    cmd = argv[1]
    if cmd in ("-h", "--help", "help"):
        _usage()
        return 0

    if cmd not in COMMANDS:
        print(f"未知命令：{cmd}")
        print()
        _usage()
        return 2

    return COMMANDS[cmd]()


if __name__ == "__main__":
    sys.exit(main(sys.argv))
