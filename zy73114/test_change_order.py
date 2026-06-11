import unittest
from datetime import datetime, timedelta

from models import (
    ChangeOrder,
    DrawingVersion,
    Judgement,
    CoordinateOffset,
    JudgementImpact,
    ProcessingType,
)
from core_logic import (
    ConsistencyValidator,
    ImpactTracker,
    VersionClassifier,
)
from exporter import ChangeOrderExporter, UnifiedAnnotation
from audit import HistoryAuditor


class TestDrawingVersionConfusion(unittest.TestCase):
    """测试：图纸版本一多没人敢确认最新版"""

    def setUp(self):
        self.co = ChangeOrder(
            project_name="A栋写字楼结构变更",
            change_order_no="CO-2026-0611-001",
            created_by="系统",
        )
        self.co.drawing_versions.extend([
            DrawingVersion(
                version="V1.0",
                issued_at=datetime(2026, 6, 1),
                issued_by="设计院",
                is_latest=False,
                description="初版施工图"
            ),
            DrawingVersion(
                version="V2.0",
                issued_at=datetime(2026, 6, 5),
                issued_by="设计院",
                is_latest=False,
                description="调整梁柱节点"
            ),
            DrawingVersion(
                version="V3.0",
                issued_at=datetime(2026, 6, 10),
                issued_by="设计院",
                is_latest=True,
                description="优化剪力墙配筋"
            ),
        ])
        self.co.judgements.extend([
            Judgement(
                item_code="STR-001",
                item_name="一层梁配筋",
                original_judgement="按V2.0图纸配筋",
                final_judgement="按V3.0图纸配筋",
                basis=["DWG-V3.0-STRUCT-001"],
            ),
            Judgement(
                item_code="STR-002",
                item_name="二层柱截面",
                original_judgement="柱截面600x600",
                final_judgement="柱截面700x700",
                basis=["DWG-V3.0-STRUCT-002"],
            ),
        ])

    def test_latest_drawing_identified(self):
        latest = self.co.get_latest_drawing()
        self.assertIsNotNone(latest)
        self.assertEqual(latest.version, "V3.0")

    def test_export_warns_about_multiple_versions(self):
        exporter = ChangeOrderExporter(self.co)
        result = exporter.export(exported_by="老叶", rerun_material=False)

        warning_text = " ".join(result.export_record.warnings)
        self.assertIn("V3.0", warning_text)
        self.assertIn("V1.0", warning_text)
        self.assertIn("V2.0", warning_text)
        self.assertIn("最新版", warning_text)
        self.assertIn("图纸版本较多", warning_text)


class TestAnnotationConsistency(unittest.TestCase):
    """测试：场景标注、侧边说明和页面摘要不能变成三套话"""

    def test_consistency_check_detects_inconsistency(self):
        scene = "项目名称：测试项目\n变更编号：CO-001\n图纸版本：V1.0\n核心判断：按图施工"
        sidebar = "项目名称：测试项目\n变更编号：CO-001\n图纸版本：V1.0\n核心判断：按图施工，注意安全"
        summary = "项目名称：测试项目\n变更编号：CO-002\n图纸版本：V1.0\n核心判断：按图施工"

        result = ConsistencyValidator.check_annotation_consistency(scene, sidebar, summary)

        self.assertFalse(result.is_consistent)
        self.assertIn("核心判断", result.inconsistent_fields)
        self.assertIn("变更编号", result.inconsistent_fields)

    def test_auto_correct_fixes_inconsistency(self):
        co = ChangeOrder(
            project_name="测试项目",
            change_order_no="CO-001",
            created_by="测试员",
        )
        co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))
        co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项",
            original_judgement="正常",
            final_judgement="正常",
            basis=["test"],
        ))

        exporter = ChangeOrderExporter(co)
        bad_annotation = UnifiedAnnotation(
            scene_annotation="项目名称：测试项目\n变更编号：CO-001\n核心判断：正常处理",
            sidebar_note="项目名称：测试项目\n变更编号：CO-001\n核心判断：特殊处理",
            page_summary="项目名称：测试项目\n变更编号：CO-001\n核心判断：正常处理",
            core_judgement="本次交底共1项分项判断",
        )

        result = exporter.export(
            exported_by="测试员",
            custom_annotation=bad_annotation,
        )

        self.assertTrue(result.consistency_check.is_consistent)

        scene_core = bad_annotation.scene_annotation.split("核心判断：")[1].split("\n")[0]
        sidebar_core = bad_annotation.sidebar_note.split("核心判断：")[1].split("\n")[0]
        summary_core = bad_annotation.page_summary.split("核心判断：")[1].split("\n")[0]
        self.assertEqual(scene_core, sidebar_core)
        self.assertEqual(sidebar_core, summary_core)

    def test_export_generates_consistent_annotation(self):
        co = ChangeOrder(
            project_name="测试项目",
            change_order_no="CO-001",
            created_by="测试员",
        )
        co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))
        co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项",
            original_judgement="正常",
            final_judgement="正常",
            basis=["test"],
        ))

        exporter = ChangeOrderExporter(co)
        result = exporter.export(exported_by="测试员")

        self.assertTrue(result.consistency_check.is_consistent)
        self.assertIn("项目名称", result.export_record.scene_annotation)
        self.assertIn("项目名称", result.export_record.sidebar_note)
        self.assertIn("项目名称", result.export_record.page_summary)

        scene_core = ConsistencyValidator._extract_core_judgement(
            result.export_record.scene_annotation
        )
        sidebar_core = ConsistencyValidator._extract_core_judgement(
            result.export_record.sidebar_note
        )
        summary_core = ConsistencyValidator._extract_core_judgement(
            result.export_record.page_summary
        )
        self.assertEqual(scene_core, sidebar_core)
        self.assertEqual(sidebar_core, summary_core)


class TestVisaNoteImpact(unittest.TestCase):
    """测试：临时补一条现场签证单备注，要说清它改变了哪些判断"""

    def setUp(self):
        self.co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        self.co.judgements.extend([
            Judgement(
                item_code="STR-001",
                item_name="一层梁配筋",
                original_judgement="配4根25钢筋",
                final_judgement="配4根25钢筋",
                basis=["DWG-001"],
            ),
            Judgement(
                item_code="STR-002",
                item_name="二层柱混凝土",
                original_judgement="C30混凝土",
                final_judgement="C30混凝土",
                basis=["DWG-002"],
            ),
            Judgement(
                item_code="STR-003",
                item_name="三层板厚",
                original_judgement="板厚120mm",
                final_judgement="板厚120mm",
                basis=["DWG-003"],
            ),
        ])

    def test_visa_note_changes_judgements(self):
        visa = self.co.add_visa_note(
            content="现场实际开挖发现土质较软，需加强基础梁配筋",
            created_by="现场工长",
            source_doc="现场签证单V-2026-0611",
            affected_item_codes=["STR-001", "STR-003"],
            impacts=[
                JudgementImpact.STRUCTURAL_SAFETY,
                JudgementImpact.MATERIAL_QUANTITY,
            ],
        )

        impact = ImpactTracker.analyze_visa_impact(self.co, visa)

        self.assertEqual(len(impact.affected_judgement_ids), 2)
        self.assertEqual(len(impact.changed_judgements), 2)

        j1 = self.co.get_judgement_by_code("STR-001")
        self.assertIn("需复核结构安全", j1.final_judgement)
        self.assertIn("需调整材料用量", j1.final_judgement)
        self.assertIn("现场签证单V-2026-0611", j1.basis)

        j2 = self.co.get_judgement_by_code("STR-002")
        self.assertNotIn("需复核结构安全", j2.final_judgement)

        self.assertIn("改变了 2 项判断", impact.summary)
        self.assertIn("STR-001", impact.summary)
        self.assertIn("STR-003", impact.summary)
        self.assertIn("现场签证单V-2026-0611", impact.summary)

    def test_visa_impact_in_export_warnings(self):
        self.co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))

        self.co.add_visa_note(
            content="现场签证：土质问题需加强",
            created_by="工长",
            source_doc="V-001",
            affected_item_codes=["STR-001"],
            impacts=[JudgementImpact.STRUCTURAL_SAFETY],
        )

        exporter = ChangeOrderExporter(self.co)
        result = exporter.export(exported_by="老叶")

        warning_text = " ".join(result.export_record.warnings)
        self.assertIn("现场签证单改变了", warning_text)
        self.assertIn("STR-001", warning_text)
        self.assertIn("V-001", warning_text)


class TestCoordinateOffsetWarning(unittest.TestCase):
    """测试：模型坐标偏移影响结果时，提醒里要写清该找谁确认、先看哪条来源"""

    def setUp(self):
        self.co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        self.co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))
        self.co.judgements.extend([
            Judgement(
                item_code="STR-001",
                item_name="A区一层梁",
                original_judgement="正常",
                final_judgement="正常",
                basis=["DWG-001"],
            ),
            Judgement(
                item_code="STR-002",
                item_name="B区二层板",
                original_judgement="正常",
                final_judgement="正常",
                basis=["DWG-002"],
            ),
        ])
        self.co.coordinate_offsets.append(CoordinateOffset(
            offset_x=0.05,
            offset_y=-0.03,
            offset_z=0.02,
            detected_at=datetime(2026, 6, 11, 14, 30),
            source_record_id="BIM-MODEL-2026-0610-001",
            source_record_title="A栋主体结构BIM模型校准记录",
            affected_regions=["A区", "B区"],
        ))

    def test_coordinate_offset_warning_includes_confirmer(self):
        warnings = ImpactTracker.analyze_coordinate_offset_impact(
            self.co, self.co.coordinate_offsets[0]
        )

        warning_text = " ".join(warnings)
        self.assertIn("老叶", warning_text)
        self.assertIn("结构工程师", warning_text)
        self.assertIn("请立即联系", warning_text)

    def test_coordinate_offset_warning_includes_source(self):
        warnings = ImpactTracker.analyze_coordinate_offset_impact(
            self.co, self.co.coordinate_offsets[0]
        )

        warning_text = " ".join(warnings)
        self.assertIn("优先查看", warning_text)
        self.assertIn("A栋主体结构BIM模型校准记录", warning_text)
        self.assertIn("BIM-MODEL-2026-0610-001", warning_text)
        self.assertIn("2026-06-11 14:30", warning_text)

    def test_coordinate_offset_warning_includes_affected_items(self):
        warnings = ImpactTracker.analyze_coordinate_offset_impact(
            self.co, self.co.coordinate_offsets[0]
        )

        warning_text = " ".join(warnings)
        self.assertIn("A区一层梁", warning_text)
        self.assertIn("B区二层板", warning_text)
        self.assertIn("STR-001", warning_text)
        self.assertIn("STR-002", warning_text)

    def test_coordinate_offset_in_export(self):
        exporter = ChangeOrderExporter(self.co)
        result = exporter.export(exported_by="老叶")

        warning_text = " ".join(result.export_record.warnings)
        self.assertIn("模型坐标偏移检测", warning_text)
        self.assertIn("X=0.05, Y=-0.03, Z=0.02", warning_text)
        self.assertIn("老叶", warning_text)
        self.assertIn("优先查看", warning_text)


class TestRerunMaterialClassification(unittest.TestCase):
    """测试：同样的材料重跑时，工具要分清旧处理、后补备注和最新导出"""

    def setUp(self):
        self.co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        self.co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))

    def test_first_run_is_original(self):
        self.co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项1",
            original_judgement="旧处理判断",
            final_judgement="旧处理判断",
            basis=["test"],
        ))

        exporter = ChangeOrderExporter(self.co)
        result1 = exporter.export(exported_by="老叶", rerun_material=True)

        self.assertEqual(
            result1.export_record.processing_type,
            ProcessingType.ORIGINAL
        )
        self.assertIn("【旧处理】", result1.export_record.scene_annotation)
        self.assertIn("STR-001", result1.component_markers["【旧处理】"][0])

    def test_second_run_with_visa_is_supplementary(self):
        self.co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项1",
            original_judgement="旧处理判断",
            final_judgement="旧处理判断",
            basis=["test"],
        ))

        exporter = ChangeOrderExporter(self.co)
        exporter.export(exported_by="老叶", rerun_material=True)

        self.co.add_visa_note(
            content="后补签证内容",
            created_by="工长",
            source_doc="V-001",
            affected_item_codes=["STR-001"],
            impacts=[JudgementImpact.MATERIAL_QUANTITY],
        )

        result2 = exporter.export(exported_by="老叶", rerun_material=True)
        self.assertEqual(
            result2.export_record.processing_type,
            ProcessingType.SUPPLEMENTARY
        )
        self.assertIn("【后补备注】", result2.export_record.scene_annotation)

    def test_third_run_with_new_judgement_is_latest(self):
        self.co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项1",
            original_judgement="旧处理判断",
            final_judgement="旧处理判断",
            basis=["test"],
        ))

        exporter = ChangeOrderExporter(self.co)
        exporter.export(exported_by="老叶", rerun_material=True)

        self.co.add_visa_note(
            content="后补签证内容",
            created_by="工长",
            source_doc="V-001",
            affected_item_codes=["STR-001"],
            impacts=[JudgementImpact.MATERIAL_QUANTITY],
        )
        exporter.export(exported_by="老叶", rerun_material=True)

        self.co.judgements.append(Judgement(
            item_code="STR-002",
            item_name="测试项2",
            original_judgement="新增判断",
            final_judgement="新增判断",
            basis=["test2"],
        ))

        result3 = exporter.export(exported_by="老叶", rerun_material=True)
        self.assertEqual(
            result3.export_record.processing_type,
            ProcessingType.LATEST
        )

        markers = result3.component_markers
        self.assertIn("【旧处理】", markers)
        self.assertIn("【后补备注】", markers)
        self.assertIn("【最新导出】", markers)
        self.assertIn("STR-001", markers["【旧处理】"][0])
        self.assertIn("STR-002", markers["【最新导出】"][0])


class TestOverrideHistory(unittest.TestCase):
    """测试：结构工程师老叶临时改过判断时，历史里要留原因，下一班不该只有能看到一个最终值"""

    def setUp(self):
        self.co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        self.co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))
        self.co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="关键梁配筋",
            original_judgement="配4根25钢筋",
            final_judgement="配4根25钢筋",
            basis=["DWG-001"],
        ))

    def test_override_saves_reason(self):
        self.co.save_version(operator="小张", change_summary="初始化判断")

        j = self.co.override_judgement(
            item_code="STR-001",
            new_judgement="配6根25钢筋",
            operator="老叶",
            reason="现场实测荷载比设计值大20%，需加强配筋",
        )

        self.co.save_version(
            operator="老叶",
            change_summary="老叶调整STR-001配筋判断"
        )

        self.assertIsNotNone(j)
        self.assertTrue(j.is_overridden)
        self.assertEqual(j.modified_by, "老叶")
        self.assertEqual(j.modification_reason, "现场实测荷载比设计值大20%，需加强配筋")
        self.assertEqual(j.final_judgement, "配6根25钢筋")

    def test_audit_trail_shows_history(self):
        self.co.save_version(operator="小张", change_summary="初始化判断")

        self.co.override_judgement(
            item_code="STR-001",
            new_judgement="配6根25钢筋",
            operator="老叶",
            reason="现场实测荷载比设计值大20%",
        )
        self.co.save_version(operator="老叶", change_summary="调整STR-001")

        auditor = HistoryAuditor(self.co)
        trail = auditor.get_full_audit_trail()

        self.assertGreaterEqual(len(trail), 2)

        override_entries = [
            t for t in trail
            if t.action == "人工调整判断" and t.item_code == "STR-001"
        ]
        self.assertEqual(len(override_entries), 1)
        self.assertEqual(override_entries[0].operator, "老叶")
        self.assertEqual(override_entries[0].before, "配4根25钢筋")
        self.assertEqual(override_entries[0].after, "配6根25钢筋")
        self.assertEqual(override_entries[0].reason, "现场实测荷载比设计值大20%")

    def test_judgement_history_shows_trajectory(self):
        self.co.save_version(operator="小张", change_summary="初始化")

        self.co.override_judgement(
            item_code="STR-001",
            new_judgement="配5根25钢筋",
            operator="老叶",
            reason="第一次调整",
        )
        self.co.save_version(operator="老叶", change_summary="V2")

        self.co.override_judgement(
            item_code="STR-001",
            new_judgement="配6根25钢筋",
            operator="老叶",
            reason="第二次调整，复核后确认需再加",
        )
        self.co.save_version(operator="老叶", change_summary="V3")

        auditor = HistoryAuditor(self.co)
        history = auditor.get_judgement_history("STR-001")

        self.assertGreaterEqual(len(history), 3)
        judgements = [h[2] for h in history]
        self.assertIn("配4根25钢筋", judgements)
        self.assertIn("配5根25钢筋", judgements)
        self.assertIn("配6根25钢筋", judgements)

        reasons = [h[4] for h in history if h[4]]
        self.assertIn("第一次调整", reasons)
        self.assertTrue(any("第二次调整" in r for r in reasons),
                       f"Expected '第二次调整' in any of: {reasons}")

    def test_overridden_report(self):
        self.co.save_version(operator="小张", change_summary="初始化")

        self.co.override_judgement(
            item_code="STR-001",
            new_judgement="配6根25钢筋",
            operator="老叶",
            reason="现场实测荷载比设计值大20%",
        )
        self.co.save_version(operator="老叶", change_summary="调整")

        auditor = HistoryAuditor(self.co)
        report = auditor.get_overridden_judgements_report()

        self.assertIn("老叶", report)
        self.assertIn("配4根25钢筋", report)
        self.assertIn("配6根25钢筋", report)
        self.assertIn("现场实测荷载比设计值大20%", report)
        self.assertIn("下一班查看时", report)
        self.assertIn("完整调整过程", report)
        self.assertIn("历史变更轨迹", report)


class TestDeliverySmoothness(unittest.TestCase):
    """测试：项目经理跑一遍如果还要问材料放哪，就说明交付不够顺"""

    def test_complete_data_has_high_score(self):
        co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))
        co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项",
            original_judgement="正常",
            final_judgement="正常",
            basis=["DWG-001"],
        ))

        exporter = ChangeOrderExporter(co)
        result = exporter.export(exported_by="老叶")

        self.assertEqual(result.export_record.delivery_smoothness_score, 100)
        self.assertIsNotNone(result.export_record.material_location_hint)
        self.assertIn("材料存放位置指引", result.export_record.material_location_hint)
        self.assertIn("纸质版", result.export_record.material_location_hint)
        self.assertIn("电子版", result.export_record.material_location_hint)
        self.assertIn("BIM模型平台", result.export_record.material_location_hint)

    def test_incomplete_data_has_low_score(self):
        co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )

        exporter = ChangeOrderExporter(co)
        result = exporter.export(exported_by="老叶")

        self.assertLess(result.export_record.delivery_smoothness_score, 70)
        self.assertIn("缺少分项判断列表", result.export_record.material_location_hint)
        self.assertIn("未确认最新图纸版本", result.export_record.material_location_hint)
        self.assertIn("交付不够顺", result.export_record.material_location_hint)

    def test_material_hint_lists_all_locations(self):
        co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        co.drawing_versions.append(DrawingVersion(
            version="V1.0",
            issued_at=datetime.now(),
            issued_by="设计院",
            is_latest=True,
        ))
        co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="测试项",
            original_judgement="正常",
            final_judgement="正常",
            basis=["DWG-001"],
        ))

        exporter = ChangeOrderExporter(co)
        result = exporter.export(exported_by="老叶")

        hint = result.export_record.material_location_hint
        self.assertIn("会议资料夹", hint)
        self.assertIn("协同平台", hint)
        self.assertIn("BIM模型平台", hint)
        self.assertIn("资料室", hint)
        self.assertIn("施工变更分类", hint)
        self.assertIn("变更管理", hint)
        self.assertIn("版本对比视图", hint)
        self.assertIn("签证档案盒", hint)


class TestVersionComparison(unittest.TestCase):
    """测试：多版本对比功能"""

    def setUp(self):
        self.co = ChangeOrder(
            project_name="A栋写字楼",
            change_order_no="CO-001",
            created_by="系统",
        )
        self.co.judgements.append(Judgement(
            item_code="STR-001",
            item_name="梁配筋",
            original_judgement="4根25",
            final_judgement="4根25",
            basis=["DWG-001"],
        ))
        self.co.save_version(operator="小张", change_summary="初始化V1")

    def test_compare_versions_shows_override(self):
        self.co.override_judgement(
            item_code="STR-001",
            new_judgement="6根25",
            operator="老叶",
            reason="荷载增加",
        )
        self.co.save_version(operator="老叶", change_summary="调整V2")

        auditor = HistoryAuditor(self.co)
        diff = auditor.compare_versions(1, 2)

        self.assertIsNotNone(diff)
        self.assertEqual(diff.version_from, 1)
        self.assertEqual(diff.version_to, 2)
        self.assertEqual(diff.operator_to, "老叶")
        self.assertEqual(len(diff.judgement_diffs), 1)
        self.assertEqual(diff.judgement_diffs[0].previous_final, "4根25")
        self.assertEqual(diff.judgement_diffs[0].current_final, "6根25")
        self.assertEqual(diff.judgement_diffs[0].modification_reason, "荷载增加")
        self.assertEqual(diff.judgement_diffs[0].modified_by, "老叶")

    def test_compare_versions_shows_visa_added(self):
        self.co.save_version(operator="小张", change_summary="V1")

        self.co.add_visa_note(
            content="土质问题",
            created_by="工长",
            source_doc="V-001",
            affected_item_codes=["STR-001"],
            impacts=[JudgementImpact.STRUCTURAL_SAFETY],
        )
        self.co.save_version(operator="工长", change_summary="V2加签证")

        auditor = HistoryAuditor(self.co)
        diff = auditor.compare_versions(2, 3)

        self.assertIsNotNone(diff)
        self.assertEqual(len(diff.visa_notes_added), 1)
        self.assertEqual(diff.visa_notes_added[0].content, "土质问题")
        self.assertEqual(diff.visa_notes_added[0].source_doc, "V-001")

    def test_compare_versions_shows_coordinate_change(self):
        self.co.save_version(operator="小张", change_summary="V1")

        self.co.coordinate_offsets.append(CoordinateOffset(
            offset_x=0.05,
            offset_y=0.0,
            offset_z=0.0,
            detected_at=datetime.now(),
            source_record_id="TEST-001",
            source_record_title="测试校准记录",
        ))
        self.co.save_version(operator="小张", change_summary="V2加坐标偏移")

        auditor = HistoryAuditor(self.co)
        diff = auditor.compare_versions(2, 3)

        self.assertIsNotNone(diff)
        self.assertIsNotNone(diff.coordinate_offset_changed)
        old, new = diff.coordinate_offset_changed
        self.assertIsNone(old)
        self.assertIsNotNone(new)
        self.assertEqual(new.offset_x, 0.05)


if __name__ == "__main__":
    unittest.main()
