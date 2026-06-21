import unittest
import os
import tempfile
from datetime import datetime

from models import JudgementImpact, ProcessingType
from sample_data import build_review_meeting_sample
from exporter import ChangeOrderExporter
from audit import HistoryAuditor
from report import ReportGenerator
from core_logic import ConsistencyValidator, VersionClassifier


class TestEndToEndFlow(unittest.TestCase):
    """端到端真实流程验证：加载样例 -> 补现场签证 -> 重跑导出 -> 检查摘要判断一致 -> 查看历史原因"""

    def setUp(self):
        self.co = build_review_meeting_sample()
        self.exporter = ChangeOrderExporter(self.co)

    def test_full_review_meeting_flow(self):
        # =========================================================
        # 1. 加载样例数据：检查基线是否完整
        # =========================================================
        self.assertEqual(self.co.project_name, "A栋写字楼（主体结构阶段）")
        self.assertEqual(self.co.change_order_no, "CO-2026-0611-A栋-003")
        self.assertEqual(len(self.co.drawing_versions), 3)
        self.assertEqual(self.co.get_latest_drawing().version, "V3.0")
        self.assertEqual(len(self.co.judgements), 4)
        self.assertEqual(len(self.co.coordinate_offsets), 1)

        overridden = [j for j in self.co.judgements if j.is_overridden]
        self.assertEqual(len(overridden), 1)
        self.assertEqual(overridden[0].item_code, "STR-B-002")
        self.assertIn("老叶", overridden[0].modified_by)
        self.assertIn("地下水位高于勘测报告", overridden[0].modification_reason)

        # =========================================================
        # 2. 第一次导出（旧处理，基线版）
        # =========================================================
        r1 = self.exporter.export(exported_by="结构工程师老叶", rerun_material=True)
        self.assertEqual(r1.export_record.processing_type, ProcessingType.ORIGINAL)
        self.assertIn("旧处理", r1.processing_type_label)
        self.assertTrue(r1.consistency_check.is_consistent)

        core1 = r1.export_record.page_summary
        self.assertIn("本次交底共 4 项分项判断", core1)
        self.assertIn("1 项经结构工程师人工调整", core1)
        self.assertIn("0 项受现场签证影响", core1)
        self.assertIn("V3.0", core1)

        warnings1_text = " ".join(r1.export_record.warnings)
        self.assertNotIn("现场签证单改变了", warnings1_text)
        self.assertIn("图纸版本较多", warnings1_text)
        self.assertIn("V1.0", warnings1_text)
        self.assertIn("V2.0", warnings1_text)

        # =========================================================
        # 3. 评审会前临时补一条现场签证单备注
        # =========================================================
        visa = self.co.add_visa_note(
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
        self.co.save_version(
            operator="项目经理",
            change_summary="评审会前补签证单：A区基础换填300mm级配砂石"
        )

        self.assertEqual(len(visa.affected_judgements), 2)
        self.assertIn(
            self.co.get_judgement_by_code("STR-A-001").id,
            visa.affected_judgements
        )
        self.assertIn(
            self.co.get_judgement_by_code("STR-B-001").id,
            visa.affected_judgements
        )

        # =========================================================
        # 4. 第二次导出（后补备注版）
        #    —— 关键验证：page_summary、warnings、judgements 三者口径一致
        # =========================================================
        r2 = self.exporter.export(exported_by="项目经理", rerun_material=True)
        self.assertEqual(r2.export_record.processing_type, ProcessingType.SUPPLEMENTARY)
        self.assertIn("后补备注", r2.processing_type_label)

        # (a) page_summary 必须正确反映签证影响数量
        core2 = r2.export_record.page_summary
        self.assertIn("本次交底共 4 项分项判断", core2)
        self.assertIn("1 项经结构工程师人工调整", core2)
        self.assertIn("2 项受现场签证影响", core2,
                      "Bug验证：摘要应显示2项受签证影响，不能仍是0项")

        # (b) warnings 也要说清"改变了2项判断"
        warnings2_text = " ".join(r2.export_record.warnings)
        self.assertIn("现场签证单改变了 2 项判断", warnings2_text)
        self.assertIn("STR-A-001", warnings2_text)
        self.assertIn("STR-B-001", warnings2_text)
        self.assertIn("现场签证单V-2026-0611-003", warnings2_text)

        # (c) judgements 列表里对应项的 final_judgement 已被签证修改
        ja = next(j for j in r2.export_record.judgements if j.item_code == "STR-A-001")
        jb = next(j for j in r2.export_record.judgements if j.item_code == "STR-B-001")
        jc = next(j for j in r2.export_record.judgements if j.item_code == "STR-A-002")
        self.assertIn("需复核结构安全", ja.final_judgement)
        self.assertIn("需调整材料用量", ja.final_judgement)
        self.assertIn("需调整施工顺序", ja.final_judgement)
        self.assertIn("依据现场签证", ja.final_judgement)
        self.assertIn("需复核结构安全", jb.final_judgement)
        self.assertNotIn("依据现场签证", jc.final_judgement,
                         "STR-A-002不受签证影响，不应出现签证字样")

        # (d) 场景标注、侧边说明、页面摘要的"核心判断"字段值必须完全一致
        scene_core = ConsistencyValidator._extract_field_values(
            r2.export_record.scene_annotation, ["核心判断"]
        )["核心判断"]
        sidebar_core = ConsistencyValidator._extract_field_values(
            r2.export_record.sidebar_note, ["核心判断"]
        )["核心判断"]
        summary_core = ConsistencyValidator._extract_field_values(
            r2.export_record.page_summary, ["核心判断"]
        )["核心判断"]
        self.assertEqual(scene_core, sidebar_core, "场景标注与侧边说明核心判断不一致")
        self.assertEqual(sidebar_core, summary_core, "侧边说明与页面摘要核心判断不一致")
        self.assertIn("2 项受现场签证影响", summary_core)

        # (e) 一致性校验必须通过
        self.assertTrue(r2.consistency_check.is_consistent,
                        f"一致性失败：{r2.consistency_check.details}")

        # =========================================================
        # 5. 再追加一个新判断 + 重跑 → 最新导出
        # =========================================================
        from models import Judgement
        self.co.judgements.append(Judgement(
            item_code="STR-C-001",
            item_name="C区屋面防水构造",
            original_judgement="4mm厚SBS改性沥青防水卷材",
            final_judgement="4mm厚SBS改性沥青防水卷材",
            basis=["DWG-V3.0-STRUCT-C-01"],
        ))
        self.co.save_version(operator="老叶", change_summary="补C区屋面防水判断")

        r3 = self.exporter.export(exported_by="老叶", rerun_material=True)
        self.assertEqual(r3.export_record.processing_type, ProcessingType.LATEST)

        # 导出记录里要能分清【旧处理】/【后补备注】/【最新导出】
        markers = r3.component_markers
        self.assertIn("【旧处理】", markers)
        self.assertIn("【后补备注】", markers)
        self.assertIn("【最新导出】", markers)
        orig_codes = [s.split()[0] for s in markers["【旧处理】"]]
        new_codes = [s.split()[0] for s in markers["【最新导出】"]]
        self.assertIn("STR-A-001", orig_codes)
        self.assertIn("STR-C-001", new_codes)

        # =========================================================
        # 6. 查看老叶调整判断的历史原因（下一班不该只看到最终值）
        # =========================================================
        auditor = HistoryAuditor(self.co)
        report = auditor.get_overridden_judgements_report()

        self.assertIn("老叶", report)
        self.assertIn("STR-B-002", report)
        self.assertIn("B区地下室外墙", report)
        self.assertIn("地下水位高于勘测报告", report)
        self.assertIn("墙厚300mm", report)
        self.assertIn("墙厚350mm", report)
        self.assertIn("下一班查看时", report)
        self.assertIn("完整调整过程", report)
        self.assertIn("历史变更轨迹", report)

        # 单条判断的历史轨迹：至少包含初始值和覆盖值两个版本
        hist = auditor.get_judgement_history("STR-B-002")
        self.assertGreaterEqual(len(hist), 2)
        final_values = [h[2] for h in hist]
        self.assertTrue(any("墙厚300mm" in v for v in final_values),
                        "历史中找不到原始判断值")
        self.assertTrue(any("墙厚350mm" in v for v in final_values),
                        "历史中找不到最终判断值")
        self.assertTrue(any("地下水位高于勘测报告" in (h[4] or "") for h in hist),
                        "历史中找不到调整原因")

        # 全量审计追踪要能看到"人工调整判断"动作
        trail = auditor.get_full_audit_trail()
        override_actions = [t for t in trail if t.action == "人工调整判断"]
        self.assertGreaterEqual(len(override_actions), 1)
        self.assertEqual(override_actions[0].operator, "老叶")
        self.assertEqual(override_actions[0].item_code, "STR-B-002")
        self.assertIn("地下水位高于勘测报告", override_actions[0].reason)

        # =========================================================
        # 7. 坐标偏移提醒要写清：找谁确认、先看哪条来源
        # =========================================================
        offset_warnings = [w for w in r3.export_record.warnings if "坐标偏移" in w or "优先查看" in w or "请立即联系" in w]
        self.assertGreaterEqual(len(offset_warnings), 3)

        offset_text = " ".join(r3.export_record.warnings)
        self.assertIn("结构工程师", offset_text)
        self.assertIn("老叶", offset_text)
        self.assertIn("请立即联系", offset_text)
        self.assertIn("优先查看", offset_text)
        self.assertIn("A栋主体结构BIM模型6月10日校准记录", offset_text)
        self.assertIn("BIM-CALIBRATE-2026-0610-A栋", offset_text)
        self.assertIn("受影响区域", offset_text)
        self.assertIn("A区", offset_text)
        self.assertIn("B区", offset_text)

        # =========================================================
        # 8. 导出可读报告（Markdown + Text）并验证内容完整
        # =========================================================
        report_gen = ReportGenerator(self.co, r3)
        md = report_gen.render_markdown()
        txt = report_gen.render_text()

        # 核心字段都要出现在最终报告里
        for required in [
            "施工变更交底清单",
            "一、页面摘要",
            "二、场景标注",
            "三、侧边说明",
            "四、分项判断清单",
            "五、现场签证单记录",
            "六、风险与提醒",
            "七、模型坐标偏移",
            "八、历史调整原因",
            "九、材料存放位置指引",
            "STR-A-001",
            "STR-B-002",
            "现场签证单V-2026-0611-003",
            "老叶",
            "地下水位高于勘测报告",
            "优先查看",
            "交付顺畅性评分",
        ]:
            self.assertIn(required, md, f"报告缺失关键内容：{required}")

        with tempfile.TemporaryDirectory() as tmpdir:
            md_path = os.path.join(tmpdir, "test_report.md")
            txt_path = os.path.join(tmpdir, "test_report.txt")
            saved_md = report_gen.save_markdown(md_path)
            saved_txt = report_gen.save_text(txt_path)
            self.assertTrue(os.path.exists(saved_md))
            self.assertTrue(os.path.exists(saved_txt))
            self.assertGreater(os.path.getsize(saved_md), 500)

            with open(saved_md, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn("施工变更交底清单", content)
            self.assertIn("2 项受现场签证影响", content)

        # =========================================================
        # 9. 交付顺畅性检查：评分 ≥ 70，材料位置清晰
        # =========================================================
        self.assertGreaterEqual(r3.export_record.delivery_smoothness_score, 70)
        self.assertIsNotNone(r3.export_record.material_location_hint)
        self.assertIn("会议资料夹", r3.export_record.material_location_hint)
        self.assertIn("协同平台", r3.export_record.material_location_hint)
        self.assertIn("BIM模型平台", r3.export_record.material_location_hint)
        self.assertIn("资料室", r3.export_record.material_location_hint)

        # =========================================================
        # 10. 版本对比：V1（最原始基线，B区外墙还是300mm）vs 最新版
        # =========================================================
        diff = auditor.compare_versions(1, self.co.current_version)
        self.assertIsNotNone(diff)
        changed_codes = {jd.item_code for jd in diff.judgement_diffs}
        self.assertIn("STR-B-002", changed_codes)
        self.assertIn("STR-C-001", changed_codes)
        self.assertEqual(len(diff.visa_notes_added), 1)
        self.assertIn("土质较软", diff.visa_notes_added[0].content)


if __name__ == "__main__":
    unittest.main()
