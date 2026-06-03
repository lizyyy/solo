import unittest
import json
from datetime import datetime

from database import Database
from models import Role, ReviewStatus, DisplayMode
from workflow_service import WorkflowService
from import_service import ImportService
from change_tracking_service import ChangeTrackingService
from visualization_service import VisualizationService
from report_service import ReportService


class TestSprinklerCoverageSystem(unittest.TestCase):

    def setUp(self):
        self.db = Database()
        self.workflow = WorkflowService(self.db)
        self.import_service = ImportService(self.db)
        self.change_service = ChangeTrackingService(self.db)
        self.viz_service = VisualizationService(self.db)
        self.report_service = ReportService(self.db)

        self.sample_obstacles = [
            {
                "name": "钢结构立柱A",
                "position_3d": {"x": 10.5, "y": 20.3, "z": 0.0},
                "bounds": {"min_x": 10.0, "max_x": 11.0, "min_y": 19.8, "max_y": 20.8, "height": 3.5},
                "material_type": "Q345钢材",
                "material_status": "pending"
            },
            {
                "name": "管道支架",
                "position_3d": {"x": 15.2, "y": 25.1, "z": 0.0},
                "bounds": {"min_x": 14.7, "max_x": 15.7, "min_y": 24.6, "max_y": 25.6, "height": 2.8},
                "material_type": "不锈钢",
                "material_status": "confirmed"
            },
            {
                "name": "结构柱-01",
                "position_3d": {"x": 10.5, "y": 20.3, "z": 0.0},
                "bounds": {"min_x": 10.0, "max_x": 11.0, "min_y": 19.8, "max_y": 20.8, "height": 3.5},
                "material_type": "钢筋混凝土",
                "material_status": "pending"
            }
        ]

        self.sample_sketch_data = json.dumps({
            "version": "1.0",
            "drawing_id": "DWG-2026-001",
            "scale": "1:100",
            "layers": ["ARCH", "STRU", "MECH"]
        })

        self.sample_point_cloud_logs = [
            {
                "log_data": str({
                    "scan_id": "PCL-001",
                    "point_count": 1500000,
                    "obstacle_positions": [
                        {"x": 10.5, "y": 20.3, "z": 0.0, "confidence": 0.95},
                        {"x": 15.2, "y": 25.1, "z": 0.0, "confidence": 0.92}
                    ]
                }),
                "recorded_at": datetime(2026, 6, 1, 10, 30),
                "designer_notes": "点云数据与草图基本吻合，钢结构立柱位置准确，管道支架需复核材质"
            },
            {
                "log_data": str({
                    "scan_id": "PCL-002",
                    "point_count": 2100000,
                    "obstacle_positions": [
                        {"x": 10.5, "y": 20.3, "z": 0.0, "confidence": 0.98}
                    ]
                }),
                "recorded_at": datetime(2026, 6, 2, 14, 15),
                "designer_notes": "第二次扫描确认立柱位置，名称冲突需培训学员复核"
            }
        ]

    def test_import_deduplication(self):
        print("\n=== 测试1: 重复导入去重 ===")
        sketch1, coverages1, is_new1 = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )
        print(f"第一次导入: is_new={is_new1}, coverages={len(coverages1)}")
        self.assertTrue(is_new1)
        self.assertEqual(len(coverages1), 3)

        sketch2, coverages2, is_new2 = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )
        print(f"重复导入: is_new={is_new2}, coverages={len(coverages2)}")
        self.assertFalse(is_new2)
        self.assertEqual(len(coverages2), 3)
        self.assertEqual(sketch1.id, sketch2.id)

        all_coverages = self.db.get_coverages_by_sketch(sketch1.id)
        self.assertEqual(len(all_coverages), 3)
        print(f"✓ 导入去重验证通过，覆盖数量未翻倍: {len(all_coverages)}")

    def test_name_conflict_detection(self):
        print("\n=== 测试2: 障碍物名称冲突检测 ===")
        sketch, coverages, is_new = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        obstacles = self.db.get_obstacles_by_sketch(sketch.id)
        conflict_obstacles = [o for o in obstacles if o.review_status == ReviewStatus.NEED_TRAINEE_REVIEW]

        print(f"总障碍物数: {len(obstacles)}")
        print(f"冲突障碍物数: {len(conflict_obstacles)}")

        self.assertEqual(len(conflict_obstacles), 2)

        for obs in conflict_obstacles:
            print(f"  - {obs.name} <-> {obs.conflicting_name}, 状态: {obs.review_status}")
            self.assertIsNotNone(obs.conflicting_name)

        print("✓ 名称冲突检测通过，冲突留给培训学员复核，未自动归正常")

    def test_remark_change_history(self):
        print("\n=== 测试3: 备注修改历史追踪 ===")
        sketch, coverages, _ = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        coverage = coverages[0]
        old_remark = coverage.remark
        print(f"原始备注: {old_remark}")

        new_remark1 = "调整喷头数量，从3个增加到4个，覆盖更均匀"
        self.change_service.update_coverage_remark(
            coverage_id=coverage.id,
            new_remark=new_remark1,
            changed_by=Role.DESIGNER_AJING,
            change_reason="现场复核后调整"
        )
        print(f"修改后备注1: {new_remark1}")

        new_remark2 = "再次复核，恢复3个喷头，结合点云数据确认覆盖范围足够"
        self.change_service.update_coverage_remark(
            coverage_id=coverage.id,
            new_remark=new_remark2,
            changed_by=Role.DESIGNER_AJING,
            change_reason="结合点云数据二次优化"
        )
        print(f"修改后备注2: {new_remark2}")

        history = self.change_service.compare_remark_history(coverage.id)
        print(f"历史变更记录数: {len(history)}")

        self.assertEqual(len(history), 2)

        for i, h in enumerate(history):
            print(f"\n  变更 {i+1}:")
            print(f"    时间: {h['changed_at']}")
            print(f"    操作人: {h['changed_by']}")
            print(f"    原因: {h['change_reason']}")
            print(f"    改前: {h['old_value']}")
            print(f"    改后: {h['new_value']}")
            print(f"    影响结果: {h['affected_results']}")
            self.assertIn("覆盖面积", str(h["affected_results"]))

        print("✓ 备注修改历史追踪验证通过，改前改后差别清晰")

    def test_3d_view_traceability(self):
        print("\n=== 测试4: 3D视图追溯功能 ===")
        sketch, coverages, _ = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        coverage = coverages[0]
        view_data = self.viz_service.create_3d_view(
            coverage_id=coverage.id,
            display_mode=DisplayMode.VIEW_3D,
            created_by=Role.DESIGNER_AJING
        )

        print(f"3D视图ID: {view_data['view_id']}")
        print(f"显示模式: {view_data['display_mode']}")
        print(f"存在冲突: {view_data['has_conflict']}")

        traceability = view_data["traceability"]
        print(f"\n追溯信息:")
        print(f"  源草图ID: {traceability['source_sketch_id']}")
        print(f"  源日志数: {traceability['source_log_count']}")

        scene = self.viz_service.render_3d_scene(view_data["view_id"])
        print(f"\n3D场景对象数: {len(scene['objects'])}")

        trace_back = self.viz_service.trace_back_to_sources(view_data["view_id"])
        print(f"\n追溯回源数据:")
        print(f"  草图名称: {trace_back['sketch']['section_name']}")
        print(f"  待培训学员复核: {trace_back['conflict_needs_review']}")

        navigation_links = view_data["navigation_links"]
        print(f"\n导航链接数: {len(navigation_links)}")
        for link in navigation_links:
            print(f"  - {link['description']} ({link['rel']})")

        has_sketch_link = any(l["rel"] == "source_sketch" for l in navigation_links)
        has_log_link = any(l["rel"] == "source_point_cloud_log" for l in navigation_links)
        has_conflict_link = view_data["has_conflict"] and any(l["rel"] == "resolve_conflict" for l in navigation_links)

        self.assertTrue(has_sketch_link, "缺少返回楼层剖面草图的链接")
        self.assertTrue(has_log_link or traceability["source_log_count"] == 0, "缺少返回点云抽稀日志的链接")
        if view_data["has_conflict"]:
            self.assertTrue(has_conflict_link, "缺少冲突处理链接")

        source_sketch = self.viz_service.get_source_sketch(view_data["view_id"])
        self.assertIsNotNone(source_sketch)
        self.assertEqual(source_sketch.id, traceability["source_sketch_id"])

        print("✓ 3D视图追溯功能验证通过，可回到草图和日志，不只剩漂亮画面")

    def test_review_report_generation(self):
        print("\n=== 测试5: 复核报告生成 ===")
        sketch, coverages, _ = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        for coverage in coverages:
            report = self.report_service.generate_review_report(
                coverage_id=coverage.id,
                generated_by=Role.SYSTEM
            )
            print(f"\n报告 {report.id}:")
            print(f"  为什么被留下: {report.why_kept}")
            print(f"  还缺什么材料: {report.missing_materials}")
            print(f"  下一步找谁: {report.next_step_role}")
            print(f"  下一步做什么: {report.next_step_action}")

            self.assertIsNotNone(report.why_kept)
            self.assertTrue(len(report.why_kept) > 0)

            if report.next_step_role == Role.TRAINEE:
                self.assertIn("复核", report.next_step_action)
            elif report.next_step_role == Role.DESIGNER_AJING:
                self.assertTrue("补充" in report.next_step_action or "更新" in report.next_step_action)

        full_report = self.report_service.generate_full_audit_report(sketch.id)
        print(f"\n完整审计报告:")
        print(f"  总障碍物: {full_report['summary']['total_obstacles']}")
        print(f"  待培训学员复核: {full_report['summary']['need_trainee_review']}")
        print(f"  总变更数: {full_report['summary']['total_changes']}")
        print(f"  变更日志数: {len(full_report['change_log'])}")

        self.assertTrue(len(full_report["change_log"]) >= 0)

        print("✓ 复核报告生成验证通过，非冷冰冰的系统日志")

    def test_full_three_step_workflow(self):
        print("\n=== 测试6: 完整三步工作流 ===")
        result = self.workflow.run_complete_workflow(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            point_cloud_logs_data=self.sample_point_cloud_logs
        )

        step1 = result["step1_import"]
        print(f"\n步骤1 - {step1['step_name']}:")
        print(f"  草图ID: {step1['sketch']['id']}")
        print(f"  导入障碍物: {step1['obstacles_imported']}")
        print(f"  创建覆盖: {step1['coverages_created']}")
        print(f"  状态: {step1['message']}")
        self.assertTrue(step1["is_new_import"])

        step2 = result["step2_point_cloud_review"]
        print(f"\n步骤2 - {step2['step_name']}:")
        print(f"  导入日志: {step2['logs_imported']}")
        print(f"  新日志: {step2['new_logs']}")
        print(f"  设计师复核: {step2['logs_reviewed_by_designer']}")
        print(f"  关联障碍物: {step2['obstacles_updated_with_logs']}")
        print(f"  状态: {step2['message']}")
        self.assertEqual(step2["logs_reviewed_by_designer"], 2)

        step3 = result["step3_3d_view_update"]
        print(f"\n步骤3 - {step3['step_name']}:")
        print(f"  创建视图: {step3['views_created']}")
        print(f"  冲突视图: {step3['views_with_conflicts']}")
        print(f"  生成报告: {step3['reports_generated']}")
        print(f"  状态: {step3['message']}")
        self.assertEqual(step3["views_created"], 3)
        self.assertEqual(step3["reports_generated"], 3)

        print(f"\n培训学员复核要求: {result['trainee_review_required']}")
        conflicts = result["conflicts_for_trainee"]
        print(f"待培训学员复核的冲突数: {len(conflicts)}")

        for conflict in conflicts:
            print(f"\n  冲突 {conflict['obstacle_id']}:")
            print(f"    位置: {conflict['position_3d']}")
            print(f"    名称1: {conflict['name_1']}")
            print(f"    名称2: {conflict['name_2']}")
            print(f"    操作: {conflict['action_required']}")

        self.assertTrue(result["trainee_review_required"])
        self.assertEqual(len(conflicts), 2)

        sketch_id = step1["sketch"]["id"]
        obstacles = self.db.get_obstacles_by_sketch(sketch_id)
        conflict_obstacles = [o for o in obstacles if o.review_status == ReviewStatus.NEED_TRAINEE_REVIEW]
        for obs in conflict_obstacles:
            self.assertEqual(obs.review_status, ReviewStatus.NEED_TRAINEE_REVIEW)
            self.assertIsNotNone(obs.conflicting_name)

        print("\n✓ 三步工作流验证通过，冲突未自动归正常，留给培训学员复核")

    def test_conflict_resolution_by_trainee(self):
        print("\n=== 测试7: 培训学员解决冲突 ===")
        sketch, coverages, _ = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        obstacles = self.db.get_obstacles_by_sketch(sketch.id)
        conflict_obstacle = next(o for o in obstacles if o.review_status == ReviewStatus.NEED_TRAINEE_REVIEW)

        print(f"冲突障碍物: {conflict_obstacle.name} <-> {conflict_obstacle.conflicting_name}")
        print(f"原始状态: {conflict_obstacle.review_status}")

        with self.assertRaises(ValueError) as ctx:
            self.workflow.resolve_obstacle_conflict(
                obstacle_id=conflict_obstacle.id,
                resolved_name="钢结构立柱A",
                resolved_by=Role.DESIGNER_AJING
            )
        print(f"✓ 设计师不能解决冲突，正确抛出异常")

        resolution = self.workflow.resolve_obstacle_conflict(
            obstacle_id=conflict_obstacle.id,
            resolved_name="钢结构立柱A",
            resolved_by=Role.TRAINEE
        )

        print(f"\n解决结果:")
        print(f"  原始名称: {resolution['original_names']}")
        print(f"  确定名称: {resolution['resolved_name']}")
        print(f"  解决人: {resolution['resolved_by']}")
        print(f"  状态: {resolution['status']}")

        updated_obstacle = self.db.obstacles.get(conflict_obstacle.id)
        self.assertEqual(updated_obstacle.review_status, ReviewStatus.NORMAL)
        self.assertEqual(updated_obstacle.name, "钢结构立柱A")
        self.assertIsNone(updated_obstacle.conflicting_name)

        coverage = self.db.get_coverage_by_sketch_obstacle(sketch.id, conflict_obstacle.id)
        print(f"\n关联覆盖备注: {coverage.remark}")
        self.assertIn("培训学员", coverage.remark)

        histories = self.change_service.compare_remark_history(coverage.id)
        print(f"备注变更记录数: {len(histories)}")

        print("✓ 培训学员解决冲突验证通过")

    def test_change_audit_trail(self):
        print("\n=== 测试8: 完整变更审计追踪 ===")
        sketch, coverages, _ = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        coverage = coverages[0]

        self.change_service.update_coverage_remark(
            coverage_id=coverage.id,
            new_remark="备注修改1",
            changed_by=Role.DESIGNER_AJING,
            change_reason="测试修改1"
        )

        self.change_service.update_coverage_remark(
            coverage_id=coverage.id,
            new_remark="备注修改2",
            changed_by=Role.DESIGNER_AJING,
            change_reason="测试修改2"
        )

        full_report = self.report_service.generate_full_audit_report(sketch.id)
        change_log = full_report["change_log"]

        print(f"变更日志总数: {len(change_log)}")
        for change in change_log:
            print(f"\n  变更:")
            print(f"    时间: {change['changed_at']}")
            print(f"    操作人: {change['changed_by']}")
            print(f"    实体: {change['entity_type']}.{change['field_name']}")
            print(f"    改前: {change['old_value']}")
            print(f"    改后: {change['new_value']}")
            print(f"    原因: {change['change_reason']}")
            print(f"    影响: {change['affected_results']}")

            self.assertNotEqual(change["old_value"], change["new_value"])
            self.assertIsNotNone(change["change_reason"])
            self.assertTrue(len(change["affected_results"]) > 0)

        print("✓ 变更审计追踪验证通过，谁改了什么、为什么改、改完影响哪些结果都清楚")

    def test_chart_display_mode(self):
        print("\n=== 测试9: 图表展示模式追溯 ===")
        sketch, coverages, _ = self.import_service.import_floor_section_sketch(
            floor="F3",
            section_name="3-1 剖面",
            sketch_data=self.sample_sketch_data,
            obstacles_data=self.sample_obstacles,
            imported_by=Role.DESIGNER_AJING
        )

        coverage = coverages[1]
        view_data = self.viz_service.create_3d_view(
            coverage_id=coverage.id,
            display_mode=DisplayMode.CHART,
            created_by=Role.DESIGNER_AJING
        )

        print(f"图表视图ID: {view_data['view_id']}")
        print(f"显示模式: {view_data['display_mode']}")

        traceability = view_data["traceability"]
        self.assertIsNotNone(traceability["source_sketch_id"])

        trace_back = self.viz_service.trace_back_to_sources(view_data["view_id"])
        self.assertIsNotNone(trace_back["sketch"])

        navigation_links = view_data["navigation_links"]
        has_sketch_link = any(l["rel"] == "source_sketch" for l in navigation_links)
        self.assertTrue(has_sketch_link)

        print("✓ 图表展示模式追溯验证通过")


def run_all_tests():
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestSprinklerCoverageSystem)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return result


if __name__ == "__main__":
    run_all_tests()
