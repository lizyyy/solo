import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid

from ..models import DJShow


class ShowStorage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.shows_dir = os.path.join(data_dir, "shows")
        os.makedirs(self.shows_dir, exist_ok=True)

    def _get_show_path(self, show_id: str) -> str:
        return os.path.join(self.shows_dir, f"{show_id}.json")

    def save_show(self, show: DJShow) -> str:
        path = self._get_show_path(show.id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(show.dict(), f, ensure_ascii=False, indent=2, default=str)
        return path

    def load_show(self, show_id: str) -> Optional[DJShow]:
        path = self._get_show_path(show_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return DJShow.parse_obj(data)

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

        lines = []

        def add(s):
            lines.append(s)

        add("#!/usr/bin/env python3")
        add(f'# 复盘脚本: {show.name} - {show.date.strftime("%Y-%m-%d")}')
        add(f'# 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
        add("# 此脚本可完整复现该场次的所有操作和最终状态")
        add("# 运行后可得到与原场次一致的: 批次、票数、能量曲线、工作流阶段、审核记录")
        add("")
        add("import sys")
        add("sys.path.insert(0, '.')")
        add("")
        add("from datetime import datetime")
        add("from src.models import *")
        add("from src.importer import ImportEngine")
        add("from src.rules import BoundaryRuleEngine")
        add("from src.workflow import WorkflowEngine")
        add("from src.history import HistoryEngine")
        add("from src.storage import ShowStorage")
        add("")
        add("storage = ShowStorage()")
        add("results = []")
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

        for i, imp in enumerate(show.rehearsal_imports):
            safe_content = imp.raw_content.replace('"""', '\\"\\"\\"')
            add(f"# ========== 第2.{i+1}步: 导入排练群接龙 ==========")
            add("print()")
            add(f'print("👉 第2.{i+1}步: 导入排练群接龙 {imp.source_filename}")')
            add(f'raw_content_{i} = """{safe_content}"""')
            add("result = ImportEngine.import_rehearsal(")
            add("    show=show,")
            add(f'    source_filename="{imp.source_filename}",')
            add(f"    raw_content=raw_content_{i},")
            add(f'    imported_by="{imp.imported_by}",')
            add(")")
            add("results.append(('导入接龙', result.success, str(result.batches_created) + '批次 ' + str(result.tickets_imported) + '票'))")
            add("if result.is_duplicate:")
            add('    print("⚠️  重复导入，已自动去重，票数未翻倍")')
            add('    print("   首次导入时间:", result.existing_import_time)')
            add('    print("   首次导入人:", result.existing_imported_by)')
            add('    print("   复用记录ID:", result.existing_import_id)')
            add('    print()')
            add('    print("📋 复用记录明细:")')
            add('    print("   复用批次数:", result.batches_reused)')
            add('    print("   复用票数:", result.tickets_reused)')
            add('    for name in result.reused_batch_names:')
            add('        print("     -", name)')
            add("else:")
            add('    print("✅ 导入成功:", result.batches_created, "批次,", result.tickets_imported, "票")')
            add('    print("   新增批次:")')
            add('    for name in result.new_batch_names:')
            add('        print("     -", name)')
            add("if result.mixed_batches_found:")
            add('    print()')
            add('    print("⚠️  发现混票批次（赠票售票混在一个批次）:")')
            add("    for m in result.mixed_batches_found:")
            add('        print("   -", m)')
            add('    print("   → 这些批次别急着归正常，留给录音师复核")')
            add("")

        for i, screenshot in enumerate(show.contract_screenshots):
            ocr_text_code = repr(screenshot.ocr_text) if screenshot.ocr_text else "None"
            note_code = repr(screenshot.note) if screenshot.note else "None"
            add(f"# ========== 第3.{i+1}步: 上传合同页截图 ==========")
            add("print()")
            add(f'print("👉 第3.{i+1}步: 上传合同页截图 {screenshot.image_path}")')
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

        for i, decision in enumerate(show.review_decisions):
            batch = next((b for b in show.batches if b.id == decision.batch_id), None)
            batch_name = batch.name if batch else decision.batch_id
            resolution_code = repr(decision.resolution) if decision.resolution else '""'
            add(f"# ========== 第4.{i+1}步: 送审 + 录音师复核 ==========")
            add("print()")
            add(f'print("👉 第4.{i+1}步: 送审并复核批次 {batch_name}")')
            add(f'review_batch = next((b for b in show.batches if b.name == "{batch_name}"), None)')
            add("if review_batch:")
            add("    batch = WorkflowEngine.flag_batch_for_audio_engineer_review(")
            add("        show=show,")
            add("        batch_id=review_batch.id,")
            add('        operator="复盘脚本",')
            add('        review_note="复盘自动送审",')
            add("    )")
            add('    print("✅ 已标记为待录音师复核")')
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
            add('        print("✅ 复核完成:", status)')
            add("else:")
            add(f'    print("❌ 未找到批次: {batch_name}")')
            add("")

        if show.energy_curve:
            add("# ========== 第5步: 设置能量曲线 ==========")
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
            add("results.append(('设置能量曲线', True, str(len(show.energy_curve.points)) + ' 首曲目'))")
            add('print("✅ 能量曲线已设置，共", len(show.energy_curve.points), "首曲目")')
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

        add("# ========== 修改记录审计 ==========")
        add("# 以下是该场次发生的所有修改，供复盘时核对")
        add(f"# 共 {len(show.modification_history)} 条修改记录:")
        for i, mod in enumerate(show.modification_history):
            reason_str = f" ({mod.reason})" if mod.reason else ""
            add(f"# [{i+1}] {mod.modified_at} - {mod.modified_by} - "
                f"{mod.entity_type}.{mod.field_name}: {mod.old_value} → {mod.new_value}{reason_str}")

        add("")
        add("# ========== 第7步: 保存并输出复盘结果 ==========")
        add("print()")
        add('print("=" * 60)')
        add('print("📋 复盘结果汇总")')
        add('print("=" * 60)')
        add("summary = WorkflowEngine.get_workflow_summary(show)")
        add("for k, v in summary.items():")
        add("    if isinstance(v, list) and v:")
        add('        print(f"{k}:")')
        add("        for item in v:")
        add('            print(f"  - {item}")')
        add("    elif v:")
        add('        print(f"{k}: {v}")')
        add("")
        add("storage.save_show(show)")
        add("print()")
        add('print("✅ 复盘完成! 所有状态已重放并保存")')
        add('print("   场次ID:", show.id)')
        add('print("   最终阶段:", WorkflowEngine.get_stage_description(show.workflow_stage))')
        add("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        os.chmod(output_path, 0o755)
        return output_path
