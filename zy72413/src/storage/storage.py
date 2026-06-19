import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid

from ..models import DJShow


def get_default_data_dir() -> str:
    env_dir = os.environ.get("DJ_ENERGY_DATA_DIR")
    replay_dir = os.environ.get("REPLAY_DATA_DIR")
    if replay_dir:
        return replay_dir
    if env_dir:
        return env_dir
    return "data"


class ShowStorage:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = get_default_data_dir()
        self.data_dir = data_dir
        self.shows_dir = os.path.join(data_dir, "shows")
        self.reports_dir = os.path.join(data_dir, "reports")
        os.makedirs(self.shows_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)

    def _get_show_path(self, show_id: str) -> str:
        return os.path.join(self.shows_dir, f"{show_id}.json")

    def save_show(self, show: DJShow) -> str:
        path = self._get_show_path(show.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(show.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        return path

    def load_show(self, show_id: str) -> Optional[DJShow]:
        path = self._get_show_path(show_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DJShow.model_validate(data)

    def list_shows(self) -> List[Dict[str, Any]]:
        shows = []
        for filename in os.listdir(self.shows_dir):
            if filename.endswith(".json"):
                show_id = filename[:-5]
                show = self.load_show(show_id)
                if show:
                    shows.append({
                        "id": show.id,
                        "name": show.name,
                        "date": show.date.strftime("%Y-%m-%d") if show.date else "",
                        "venue": show.venue,
                        "dj_name": show.dj_name,
                        "workflow_stage": show.workflow_stage.value,
                        "batches": len(show.batches),
                    })
        return sorted(shows, key=lambda x: x["date"], reverse=True)

    def delete_show(self, show_id: str) -> bool:
        path = self._get_show_path(show_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def export_replay_script(self, show_id: str, output_path: str) -> str:
        show = self.load_show(show_id)
        if not show:
            raise ValueError(f"未找到场次: {show_id}")

        replay_dir_name = f"data_replay_{show_id}"
        lines = []

        def add(s):
            lines.append(s)

        add("#!/usr/bin/env python3")
        add(f"# 复盘脚本: {show.name} - {show.date.strftime('%Y-%m-%d')}")
        add(f"# 场次ID: {show.id}")
        add(f"# 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        add("#")
        add("# 🔒 数据隔离: 本脚本通过 REPLAY_DATA_DIR 环境变量把重放数据")
        add(f"#          写入 {replay_dir_name}/ 目录，绝不污染主数据 data/")
        add("#")
        add("# 此脚本可完整复现该场次的所有操作和最终状态，包括:")
        add("#   - 排练群接龙导入（支持幂等去重）")
        add("#   - 合同页截图补录")
        add("#   - 备注修改（改前/改后/原因 通过真实业务动作写入审计链）")
        add("#   - 送审 + 录音师复核（状态真实变化）")
        add("#   - 能量曲线（每首曲目绑定 source_ref 可反查原始材料）")
        add("#   - 工作流阶段推进")
        add("#")
        add("# 验证方式:")
        add(f"#   python3 {output_path}")
        add(f"#   查看 {replay_dir_name}/reports/replay_report_{show.id}.txt")
        add("")
        add("import sys")
        add("import os")
        add("import json")
        add(f"REPLAY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '{replay_dir_name}')")
        add("os.environ['REPLAY_DATA_DIR'] = REPLAY_DIR")
        add("os.makedirs(REPLAY_DIR, exist_ok=True)")
        add("sys.path.insert(0, '.')")
        add("")
        add("from datetime import datetime")
        add("from src.models import *")
        add("from src.importer import ImportEngine")
        add("from src.rules import BoundaryRuleEngine")
        add("from src.workflow import WorkflowEngine")
        add("from src.history import HistoryEngine")
        add("from src.storage import ShowStorage, get_default_data_dir")
        add("")
        add("print()")
        add('print("=" * 60)')
        add('print("🔒 复盘隔离目录:", REPLAY_DIR)')
        add('print("=" * 60)')
        add('print("   重放过程不会污染主数据目录 data/")')
        add("print()")
        add("")
        add("storage = ShowStorage()")
        add("results = []")
        add("replay_evidence = {}")
        add("")
        add("# ========== 第1步: 创建场次 ==========")
        add("show = DJShow(")
        add(f'    id="{show.id}",')
        add(f'    name="{show.name}",')
        add(f'    date=datetime.fromisoformat("{show.date.isoformat()}"),')
        add(f'    venue="{show.venue}",')
        add(f'    dj_name="{show.dj_name}",')
        add(")")
        add("results.append(('创建场次', True, show.id))")
        add("print('✅ 第1步: 创建场次', show.id)")
        add("")

        last_import_idx = 0
        for i, imp in enumerate(show.rehearsal_imports):
            last_import_idx = i
            safe_content = imp.raw_content.replace('"""', '\\"\\"\\"')
            add(f"# ========== 第2.{i+1}步: 导入排练群接龙 ==========")
            add("print()")
            add(f'print("👉 第2.{i+1}步: 导入排练群接龙 {imp.source_filename}")')
            add(f"raw_content_{i} = \"\"\"{safe_content}\"\"\"")
            add("result = ImportEngine.import_rehearsal(")
            add("    show=show,")
            add(f'    source_filename="{imp.source_filename}",')
            add(f"    raw_content=raw_content_{i},")
            add(f'    imported_by="{imp.imported_by}",')
            add(")")
            add("results.append(('导入接龙', result.success, str(result.batches_created) + '批次 ' + str(result.tickets_imported) + '票'))")
            add("replay_evidence['import_result'] = result.model_dump()")
            add("if result.is_duplicate:")
            add('    print("⚠️  重复导入，已自动去重，票数未翻倍")')
            add('    print("   首次导入时间:", result.existing_import_time)')
            add('    print("   首次导入人:", result.existing_imported_by)')
            add('    print("   复用记录ID:", result.existing_import_id)')
            add("    print()")
            add('    print("📋 复用记录明细:")')
            add('    print("   复用批次数:", result.batches_reused)')
            add('    print("   复用票数:", result.tickets_reused)')
            add('    for name in result.reused_batch_names:')
            add('        print("     -", name)')
            add("    print()")
            add('    print("📋 真新增记录:")')
            add('    for name in result.new_batch_names:')
            add('        print("     -", name)')
            add("else:")
            add('    print("✅ 导入成功:", result.batches_created, "批次,", result.tickets_imported, "票")')
            add('    print("   新增批次:")')
            add('    for name in result.new_batch_names:')
            add('        print("     -", name)')
            add("if result.mixed_batches_found:")
            add("    print()")
            add('    print("⚠️  发现混票批次（赠票售票混在一个批次）:")')
            add("    for m in result.mixed_batches_found:")
            add('        print("   -", m)')
            add('    print("   → 这些批次别急着归正常，留给录音师复核")')
            add("")

        note_mods = [
            m for m in show.modification_history
            if m.entity_type == "rehearsal_import" and m.field_name == "note"
        ]
        if note_mods:
            for j, mod in enumerate(note_mods):
                orig_imp = next((x for x in show.rehearsal_imports if x.id == mod.entity_id), None)
                if not orig_imp:
                    continue
                match_filename = orig_imp.source_filename
                step_idx = last_import_idx + 1 + j + 1
                add(f"# ========== 第2.{step_idx}步: 修改导入备注（巡演统筹阿梅，走真实业务动作） ==========")
                add("print()")
                add(f'print("👉 第2.{step_idx}步: 巡演统筹阿梅修改导入记录备注")')
                add(f"print('   改前: ' + repr({repr(mod.old_value)}))")
                add(f"print('   改后: ' + repr({repr(mod.new_value)}))")
                add(f"print('   原因: ' + repr({repr(mod.reason)}))")
                add(f"target_imp = next((x for x in show.rehearsal_imports if x.source_filename == '{match_filename}'), None)")
                add("if target_imp:")
                add("    ok, updated = ImportEngine.update_import_note(")
                add("        show=show,")
                add("        import_id=target_imp.id,")
                add(f"        new_note={repr(mod.new_value)},")
                add(f"        modified_by={repr(mod.modified_by)},")
                add(f"        reason={repr(mod.reason)},")
                add("    )")
                add("    if ok:")
                add("        print('✅ 备注已更新: 导入明细[' + target_imp.source_filename + '].note =', repr(updated.note))")
                add("        print('   修改记录已写入审计链，改前/改后/原因可查')")
                add("        results.append(('更新备注', True, target_imp.id))")
                add("    else:")
                add("        print('❌ 备注更新失败')")
                add("else:")
                add(f"    print('❌ 未找到导入记录文件: {match_filename}')")
                add("")

        for si, screenshot in enumerate(show.contract_screenshots):
            ocr_text_code = repr(screenshot.ocr_text) if screenshot.ocr_text else "None"
            note_code = repr(screenshot.note) if screenshot.note else "None"
            add(f"# ========== 第3.{si+1}步: 上传合同页截图 ==========")
            add("print()")
            add(f'print("👉 第3.{si+1}步: 上传合同页截图 {screenshot.image_path}")')
            add("screenshot = WorkflowEngine.upload_contract_screenshot(")
            add("    show=show,")
            add(f'    image_path="{screenshot.image_path}",')
            add(f'    uploaded_by="{screenshot.uploaded_by}",')
            add(f"    ocr_text={ocr_text_code},")
            add(f"    linked_batch_ids={screenshot.linked_batch_ids},")
            add(f"    note={note_code},")
            add(")")
            add("results.append(('上传合同', True, screenshot.id))")
            add('print("✅ 合同截图已上传:", screenshot.id)')
            add("")

        for di, decision in enumerate(show.review_decisions):
            batch = next((b for b in show.batches if b.id == decision.batch_id), None)
            batch_name = batch.name if batch else decision.batch_id
            resolution_code = repr(decision.resolution) if decision.resolution else '""'
            add(f"# ========== 第4.{di+1}步: 送审 + 录音师复核 ==========")
            add("print()")
            add(f'print("👉 第4.{di+1}步: 送审并复核批次 {batch_name}")')
            add(f'review_batch = next((b for b in show.batches if b.name == "{batch_name}"), None)')
            add("if review_batch:")
            add("    print('   当前状态(送审前):', review_batch.status.value)")
            add("    batch = WorkflowEngine.flag_batch_for_audio_engineer_review(")
            add("        show=show,")
            add("        batch_id=review_batch.id,")
            add(f'        operator="{decision.decided_by}",')
            add(f'        review_note="复盘自动送审，来自批次[{batch_name}]的真实混票检测",')
            add("    )")
            add('    print("✅ 已标记为待录音师复核，状态:", batch.status.value if batch else "N/A")')
            add("    decision = WorkflowEngine.audio_engineer_review(")
            add("        show=show,")
            add("        batch_id=review_batch.id,")
            add(f'        reviewer="{decision.decided_by}",')
            add(f"        is_approved={decision.is_approved},")
            add(f"        resolution={resolution_code},")
            add("    )")
            add(f"    results.append(('录音师复核', {decision.is_approved}, '{batch_name}'))")
            add("    if decision:")
            add(f'        status = "通过" if {decision.is_approved} else "待处理"')
            add('        print("✅ 复核完成:", status, "→ 新状态:", review_batch.status.value)')
            add("else:")
            add(f'    print("❌ 未找到批次: {batch_name}")')
            add("")

        if show.energy_curve:
            add("# ========== 第5步: 设置能量曲线（每首曲目绑定 source_ref 可溯源） ==========")
            add("print()")
            add('print("👉 第5步: 设置 DJ 场次曲目能量曲线")')
            add("curve = EnergyCurve(")
            add(f'    id="curve_replay_{show.id}",')
            add(f'    show_id="{show.id}",')
            add("    points=[")
            for pt in show.energy_curve.points:
                pt_args = [
                    f'track_name="{pt.track_name}"',
                    f"track_order={pt.track_order}",
                    f"energy_level={pt.energy_level}",
                ]
                if pt.bpm:
                    pt_args.append(f"bpm={pt.bpm}")
                if pt.mood:
                    pt_args.append(f'mood="{pt.mood}"')
                if pt.note:
                    pt_args.append(f'note="{pt.note}"')
                if pt.source_ref:
                    pt_args.append(f'source_ref="{pt.source_ref}"')
                add(f"        EnergyPoint({', '.join(pt_args)}),")
            add("    ],")
            add(f'    modified_by="{show.energy_curve.modified_by}",')
            add(f"    version={show.energy_curve.version},")
            add(")")
            add("show.energy_curve = curve")
            pts_for_history = "、".join([
                f"{p.track_name}={p.energy_level}(source={p.source_ref or '未绑定'})"
                for p in show.energy_curve.points
            ])
            add("HistoryEngine.record_modification(")
            add("    show=show,")
            add('    entity_type="energy_curve",')
            add("    entity_id=curve.id,")
            add('    field_name="points",')
            add('    old_value="(未设置)",')
            add(f'    new_value={repr(pts_for_history)},')
            add(f'    modified_by={repr(show.energy_curve.modified_by)},')
            add('    reason="设置能量曲线，每首曲目绑定原始材料来源",')
            add(")")
            add("results.append(('设置能量曲线', True, str(len(show.energy_curve.points)) + ' 首曲目'))")
            add('print("✅ 能量曲线已设置，共", len(show.energy_curve.points), "首曲目")')
            add("for p in show.energy_curve.points:")
            add('    src = f"  来源: {p.source_ref}" if p.source_ref else "  来源: 未绑定"')
            add('    print(f"   {p.track_order}. {p.track_name} - 能量:{p.energy_level}{src}")')
            add("replay_evidence['energy_points'] = [p.model_dump() for p in show.energy_curve.points]")
            add("")

        add("# ========== 第6步: 推进工作流到最终阶段 ==========")
        add("print()")
        add('print("👉 第6步: 推进工作流阶段")')
        add(f"target_stage = WorkflowStage.{show.workflow_stage.name}")
        add("current_stage = show.workflow_stage")
        add("stage_order = [")
        add("    WorkflowStage.STAGE_1_IMPORTED,")
        add("    WorkflowStage.STAGE_2_CONTRACT_REVIEWED,")
        add("    WorkflowStage.STAGE_3_AUTHORIZED,")
        add("]")
        add("target_idx = stage_order.index(target_stage)")
        add("current_idx = stage_order.index(current_stage)")
        add("for _ in range(target_idx - current_idx):")
        add("    success, blockers, new_stage = WorkflowEngine.advance_stage(")
        add('        show=show, operator="复盘脚本", reason="复盘自动推进"')
        add("    )")
        add("    if success:")
        add('        print("✅ 推进到:", WorkflowEngine.get_stage_description(new_stage))')
        add("    else:")
        add('        print("❌ 推进受阻:")')
        add("        for b in blockers:")
        add('            print("   -", b)')
        add("        break")
        add("results.append(('工作流推进', show.workflow_stage == target_stage, show.workflow_stage.value))")
        add("")

        add("# ========== 第7步: 生成独立复盘报告 ==========")
        add("storage.save_show(show)")
        add("")
        add("print()")
        add('print("👉 第7步: 生成复盘报告")')
        add("report = {")
        add(f'    "show_id": "{show.id}",')
        add(f'    "show_name": "{show.name}",')
        add(f'    "replay_generated_at": {repr(datetime.now().isoformat())},')
        add(f'    "replay_data_dir": REPLAY_DIR,')
        add(f'    "isolation_note": "本报告来自隔离目录 {replay_dir_name}/，不影响主数据 data/",')
        add('    "evidence": {')
        add('        "workflow_stage": show.workflow_stage.value,')
        add('        "workflow_stage_desc": WorkflowEngine.get_stage_description(show.workflow_stage),')
        add('        "total_batches": len(show.batches),')
        add('        "total_tickets": sum(len(b.tickets) for b in show.batches),')
        add('        "mixed_batch_count": sum(1 for b in show.batches if b.status in (BatchStatus.MIXED, BatchStatus.PENDING_REVIEW, BatchStatus.RESOLVED)),')
        add('        "review_decisions_count": len(show.review_decisions),')
        add('        "rehearsal_imports_count": len(show.rehearsal_imports),')
        add('        "contract_screenshots_count": len(show.contract_screenshots),')
        add('        "energy_points_count": len(show.energy_curve.points) if show.energy_curve else 0,')
        add('        "modification_history_count": len(show.modification_history),')
        add('    },')
        add('    "batches": [')
        add('        {"name": b.name, "status": b.status.value, "ticket_count": len(b.tickets), "has_mixed": b.has_mixed_types}')
        add('        for b in show.batches')
        add('    ],')
        add('    "energy_points": [')
        add('        {"track_order": p.track_order, "track_name": p.track_name, "energy_level": p.energy_level, "source_ref": p.source_ref, "mood": p.mood, "bpm": p.bpm, "note": p.note}')
        add('        for p in (show.energy_curve.points if show.energy_curve else [])')
        add('    ],')
        add('    "modification_history": [')
        add('        {"time": m.modified_at.isoformat(), "modified_by": m.modified_by, "entity_type": m.entity_type, "entity_id": m.entity_id, "field_name": m.field_name, "old_value": m.old_value, "new_value": m.new_value, "reason": m.reason}')
        add('        for m in show.modification_history')
        add('    ],')
        add('    "replay_import_result": replay_evidence.get("import_result"),')
        add('    "step_results": [{"step": r[0], "ok": r[1], "detail": r[2]} for r in results],')
        add("}")
        add("")
        add("reports_dir = os.path.join(REPLAY_DIR, 'reports')")
        add("os.makedirs(reports_dir, exist_ok=True)")
        add(f"json_report_path = os.path.join(reports_dir, 'replay_report_{show.id}.json')")
        add(f"text_report_path = os.path.join(reports_dir, 'replay_report_{show.id}.txt')")
        add("")
        add("with open(json_report_path, 'w', encoding='utf-8') as f:")
        add("    json.dump(report, f, ensure_ascii=False, indent=2, default=str)")
        add('print("✅ JSON 复盘报告已生成:", json_report_path)')
        add("")
        add("with open(text_report_path, 'w', encoding='utf-8') as f:")
        add("    f.write('=' * 60 + '\\n')")
        add("    f.write('DJ 场次能量曲线复盘报告\\n')")
        add("    f.write('=' * 60 + '\\n')")
        add(f"    f.write('场次ID: {show.id}\\n')")
        add(f"    f.write('场次名称: {show.name}\\n')")
        add(f"    f.write('演出日期: {show.date.strftime('%Y-%m-%d')}\\n')")
        add(f"    f.write('复盘生成时间: ' + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '\\n')")
        add("    f.write('隔离数据目录: ' + REPLAY_DIR + '\\n')")
        add("    f.write('\\n')")
        add("    f.write('----- 关键数字证据 -----\\n')")
        add("    f.write(f'工作流阶段: {report[\"evidence\"][\"workflow_stage\"]} ({report[\"evidence\"][\"workflow_stage_desc\"]})\\n')")
        add("    f.write(f'批次数: {report[\"evidence\"][\"total_batches\"]}\\n')")
        add("    f.write(f'总票数: {report[\"evidence\"][\"total_tickets\"]}\\n')")
        add("    f.write(f'混票批次数: {report[\"evidence\"][\"mixed_batch_count\"]}\\n')")
        add("    f.write(f'审核决定数: {report[\"evidence\"][\"review_decisions_count\"]}\\n')")
        add("    f.write(f'导入记录数: {report[\"evidence\"][\"rehearsal_imports_count\"]}\\n')")
        add("    f.write(f'合同截图数: {report[\"evidence\"][\"contract_screenshots_count\"]}\\n')")
        add("    f.write(f'能量曲目数: {report[\"evidence\"][\"energy_points_count\"]}\\n')")
        add("    f.write(f'修改审计记录数: {report[\"evidence\"][\"modification_history_count\"]}\\n')")
        add("    f.write('\\n')")
        add("    f.write('----- 批次明细 -----\\n')")
        add("    for b in report['batches']:")
        add("        f.write(f'  - {b[\"name\"]}: 状态={b[\"status\"]} 票数={b[\"ticket_count\"]} 混票={b[\"has_mixed\"]}\\n')")
        add("    f.write('\\n')")
        add("    f.write('----- 能量曲线明细（含原始材料来源） -----\\n')")
        add("    for p in report['energy_points']:")
        add("        src = p['source_ref'] if p['source_ref'] else '未绑定'")
        add("        f.write(f'  {p[\"track_order\"]}. {p[\"track_name\"]} - 能量:{p[\"energy_level\"]}  来源:{src}\\n')")
        add("    f.write('\\n')")
        add("    f.write('----- 修改审计链（改前/改后/原因） -----\\n')")
        add("    for idx, m in enumerate(report['modification_history'], 1):")
        add("        f.write(f'  [{idx}] {m[\"time\"]} - {m[\"modified_by\"]}\\n')")
        add("        f.write(f'      对象: {m[\"entity_type\"]} ({m[\"entity_id\"]}) - {m[\"field_name\"]}\\n')")
        add("        f.write(f'      改前: {m[\"old_value\"] if m[\"old_value\"] else \"(空)\"}\\n')")
        add("        f.write(f'      改后: {m[\"new_value\"] if m[\"new_value\"] else \"(空)\"}\\n')")
        add("        f.write(f'      原因: {m[\"reason\"] if m[\"reason\"] else \"(无)\"}\\n')")
        add("        f.write('\\n')")
        add("    f.write('----- 步骤结果 -----\\n')")
        add("    for r in report['step_results']:")
        add("        ok = 'OK' if r['ok'] else 'FAIL'")
        add("        f.write(f'  [{ok}] {r[\"step\"]}: {r[\"detail\"]}\\n')")
        add("")
        add('print("✅ 文本复盘报告已生成:", text_report_path)')
        add("")
        add("print()")
        add('print("=" * 60)')
        add('print("复盘结果汇总")')
        add('print("=" * 60)')
        add("summary = WorkflowEngine.get_workflow_summary(show)")
        add("for k, v in summary.items():")
        add("    if isinstance(v, list) and v:")
        add("        print(f\"{k}:\")")
        add("        for item in v:")
        add("            print(f\"  - {item}\")")
        add("    elif v:")
        add("        print(f\"{k}: {v}\")")
        add("")
        add("print()")
        add('print("=" * 60)')
        add('print("证据链汇总（所有数字来自隔离目录重放）")')
        add('print("=" * 60)')
        add("for k, v in report['evidence'].items():")
        add('    print(f"   {k}: {v}")')
        add("")
        add("print()")
        add('print("复盘完成!")')
        add('print("   场次ID:", show.id)')
        add('print("   最终阶段:", WorkflowEngine.get_stage_description(show.workflow_stage))')
        add("print('   隔离目录: ' + REPLAY_DIR)")
        add("print('   复盘报告: ' + text_report_path)")
        add("")
        add("print()")
        add('print("验证指南（3 步自证可信）:")')
        add("print('   1) 查看报告: cat ' + text_report_path)")
        add('print("   2) 核对审计链: 备注/送审/授权/能量曲线都有改前/改后/原因")')
        add("print('   3) 检查不污染主数据: ls data/shows/ (应与运行前一致)')")
        add("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        os.chmod(output_path, 0o755)
        return output_path
