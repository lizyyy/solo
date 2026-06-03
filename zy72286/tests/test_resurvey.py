"""
老旧小区楼间距复测系统 - 测试用例

覆盖所有核心功能：
1. 数据模型测试
2. 路线长度计算测试
3. 导入与重复检测测试
4. 补录路线未重算处理测试
5. 四项自检测试
6. 统一数据源一致性测试
7. 三步流程测试
8. 导出功能测试
"""

import os
import sys
import tempfile
import json
import pytest
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from resurvey.models import (
    ResurveyProject,
    MeasurementRecord,
    ObstacleRemark,
    FloorProfileSketch,
    ProcessingStatus,
)
from resurvey.processor import DataProcessor, RouteLengthCalculator, generate_id
from resurvey.self_check import SelfChecker
from resurvey.exporter import DataExporter, UnifiedDataSource
from resurvey.workflow import ThreeStepWorkflow


@pytest.fixture
def sample_csv():
    """创建样例CSV文件"""
    content = """小区名称,楼栋A,楼栋B,测量间距,障碍物备注,路线点
阳光花园,1号楼,2号楼,18.5,"楼间有绿化带","[{""x"":0,""y"":0},{""x"":10,""y"":0},{""x"":10,""y"":5},{""x"":18.5,""y"":5}]"
阳光花园,2号楼,3号楼,22.3,"老旧围墙阻挡","[{""x"":0,""y"":0},{""x"":15,""y"":0}]"
阳光花园,3号楼,4号楼,15.8,"无障碍","[{""x"":0,""y"":0},{""x"":15.8,""y"":0}]"
阳光花园,2号楼,3号楼,22.3,"重复记录","[{""x"":0,""y"":0},{""x"":15,""y"":0}]"
"""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write(content)
        temp_path = f.name
    yield temp_path
    os.unlink(temp_path)


@pytest.fixture
def sample_project():
    """创建测试项目"""
    return ResurveyProject(project_id=generate_id("PRJ"))


@pytest.fixture
def processor(sample_project):
    """创建数据处理器"""
    return DataProcessor(sample_project)


class TestModels:
    def test_obstacle_remark_creation(self):
        remark = ObstacleRemark(
            record_id="REC_001",
            original_line_number=3,
            original_content="老旧围墙阻挡",
        )
        assert remark.original_line_number == 3
        assert remark.original_content == "老旧围墙阻挡"
        assert remark.processing_status == ProcessingStatus.PENDING
        assert len(remark.manual_changes) == 0

    def test_obstacle_remark_add_manual_change(self):
        remark = ObstacleRemark(
            record_id="REC_001",
            original_line_number=3,
            original_content="老旧围墙阻挡",
        )
        remark.add_manual_change("补录路线点", "许工")
        assert len(remark.manual_changes) == 1
        assert "许工" in remark.manual_changes[0]
        assert "补录路线点" in remark.manual_changes[0]

    def test_obstacle_remark_to_evidence_summary(self):
        remark = ObstacleRemark(
            record_id="REC_001",
            original_line_number=3,
            original_content="老旧围墙阻挡",
            processing_status=ProcessingStatus.LENGTH_NOT_RECALCULATED,
            needs_customer_review=True,
        )
        summary = remark.to_evidence_summary()
        assert summary["原始行号"] == 3
        assert summary["原始内容"] == "老旧围墙阻挡"
        assert summary["当前处理状态"] == "补录路线未重算"
        assert summary["是否需要客户复核"] is True

    def test_floor_profile_sketch(self):
        sketch = FloorProfileSketch(
            sketch_id="SKT_001",
            record_id="REC_001",
            file_path="/path/to/sketch.png",
            building="2号楼",
            floors=7,
        )
        assert sketch.floors == 7
        assert sketch.has_supplement_view is False

        sketch.add_view_note("已补看，无异常", "许工")
        assert sketch.has_supplement_view is True
        assert len(sketch.view_notes) == 1
        assert sketch.reviewed_by == "许工"

    def test_measurement_record_calculate_route_length(self):
        record = MeasurementRecord(
            record_id="REC_001",
            community_name="阳光花园",
            building_a="1号楼",
            building_b="2号楼",
            measured_distance=22.3,
            route_points=[
                {"x": 0, "y": 0},
                {"x": 8, "y": 0},
                {"x": 8, "y": 6},
                {"x": 22.3, "y": 6},
            ],
        )
        length = record.calculate_route_length()
        expected = 8 + 6 + 14.3
        assert abs(length - expected) < 0.01
        assert record.length_recalculated is True

    def test_measurement_record_mark_length_not_recalculated(self):
        remark = ObstacleRemark(
            record_id="REC_001",
            original_line_number=3,
            original_content="测试",
        )
        record = MeasurementRecord(
            record_id="REC_001",
            community_name="阳光花园",
            building_a="1号楼",
            building_b="2号楼",
            measured_distance=22.3,
            obstacle_remark=remark,
        )
        record.mark_length_not_recalculated()
        assert record.length_recalculated is False
        assert remark.processing_status == ProcessingStatus.LENGTH_NOT_RECALCULATED
        assert remark.needs_customer_review is True


class TestRouteLengthCalculator:
    def test_calculate_straight_line(self):
        points = [{"x": 0, "y": 0}, {"x": 10, "y": 0}]
        length = RouteLengthCalculator.calculate(points)
        assert length == 10.0

    def test_calculate_l_shape(self):
        points = [
            {"x": 0, "y": 0},
            {"x": 8, "y": 0},
            {"x": 8, "y": 6},
        ]
        length = RouteLengthCalculator.calculate(points)
        assert length == 14.0

    def test_calculate_single_point(self):
        points = [{"x": 0, "y": 0}]
        length = RouteLengthCalculator.calculate(points)
        assert length == 0.0

    def test_check_needs_recalculation_new_points(self):
        record = MeasurementRecord(
            record_id="REC_001",
            community_name="阳光花园",
            building_a="1号楼",
            building_b="2号楼",
            measured_distance=22.3,
            route_points=[{"x": 0, "y": 0}, {"x": 15, "y": 0}],
        )
        new_points = [{"x": 0, "y": 0}, {"x": 8, "y": 0}, {"x": 8, "y": 6}]
        needs, reason = RouteLengthCalculator.check_needs_recalculation(record, new_points)
        assert needs is True
        assert "补录了新的路线点" in reason


class TestDataProcessor:
    def test_import_obstacle_remarks(self, processor, sample_csv):
        result = processor.import_obstacle_remarks(sample_csv, "许工")
        assert result["imported"] == 3
        assert result["duplicates"] == 1
        assert len(processor.project.records) == 4

        for record in processor.project.records.values():
            if record.obstacle_remark and record.obstacle_remark.is_duplicate:
                assert any(
                    "检测到重复记录" in c
                    for c in record.obstacle_remark.manual_changes
                )

    def test_supplement_route_without_auto_recalc(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = next(iter(processor.project.records.keys()))

        new_points = [
            {"x": 0, "y": 0},
            {"x": 8, "y": 0},
            {"x": 8, "y": 6},
            {"x": 22.3, "y": 6},
        ]
        result = processor.supplement_route(
            record_id, new_points, "补录绕行点", "许工", auto_recalculate=False
        )

        assert result["success"] is True
        assert result["needs_recalculation"] is True
        assert result.get("auto_recalculated") is not True

        record = processor.project.get_record(record_id)
        assert record.is_supplementary is True
        assert record.length_recalculated is False
        assert record.obstacle_remark.processing_status == ProcessingStatus.LENGTH_NOT_RECALCULATED
        assert record.obstacle_remark.needs_customer_review is True

    def test_supplement_route_with_auto_recalc(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = next(iter(processor.project.records.keys()))

        new_points = [
            {"x": 0, "y": 0},
            {"x": 8, "y": 0},
            {"x": 8, "y": 6},
            {"x": 22.3, "y": 6},
        ]
        result = processor.supplement_route(
            record_id, new_points, "补录绕行点", "许工", auto_recalculate=True
        )

        assert result["success"] is True
        assert result["auto_recalculated"] is True

        record = processor.project.get_record(record_id)
        assert record.length_recalculated is True
        assert record.route_length is not None

    def test_recalculate_route_length(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = next(iter(processor.project.records.keys()))
        record = processor.project.get_record(record_id)
        record.route_points = [
            {"x": 0, "y": 0},
            {"x": 8, "y": 0},
            {"x": 8, "y": 6},
            {"x": 22.3, "y": 6},
        ]
        record.is_supplementary = True
        record.length_recalculated = False

        result = processor.recalculate_route_length(record_id, "许工")
        assert result["success"] is True
        assert result["length_changed"] is True

        record = processor.project.get_record(record_id)
        assert record.length_recalculated is True
        assert record.obstacle_remark.processing_status == ProcessingStatus.RECALCULATED

    def test_add_and_review_floor_sketch(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = next(iter(processor.project.records.keys()))

        add_result = processor.add_floor_sketch(
            record_id, "/path/sketch.png", "2号楼", 7, "许工"
        )
        assert add_result["success"] is True
        sketch_id = add_result["sketch_id"]

        review_result = processor.review_floor_sketch(
            sketch_id, "已补看，无异常", "许工"
        )
        assert review_result["success"] is True

        record = processor.project.get_record(record_id)
        assert len(record.floor_sketches) == 1
        assert record.floor_sketches[0].has_supplement_view is True

    def test_save_and_load_project(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            processor.save_project(temp_path)
            assert os.path.exists(temp_path)

            loaded = DataProcessor.load_project(temp_path)
            assert len(loaded.project.records) == len(processor.project.records)
        finally:
            os.unlink(temp_path)


class TestSelfChecker:
    def test_check_duplicate_imports(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        checker = SelfChecker(processor.project)

        result = checker.check_duplicate_imports()
        assert result["passed"] is False
        assert result["duplicate_count"] == 1

    def test_check_length_not_recalculated(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = list(processor.project.records.keys())[0]

        processor.supplement_route(
            record_id,
            [{"x": 0, "y": 0}, {"x": 8, "y": 0}, {"x": 8, "y": 6}],
            auto_recalculate=False,
        )

        checker = SelfChecker(processor.project)
        result = checker.check_length_not_recalculated()
        assert result["passed"] is False
        assert result["not_recalculated_count"] == 1

    def test_check_supplement_then_recalculate(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = list(processor.project.records.keys())[0]

        processor.supplement_route(
            record_id,
            [{"x": 0, "y": 0}, {"x": 8, "y": 0}, {"x": 8, "y": 6}],
            auto_recalculate=True,
        )

        checker = SelfChecker(processor.project)
        result = checker.check_supplement_then_recalculate()
        assert result["passed"] is True
        assert result["validated_count"] == 1

    def test_check_export_consistency(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        checker = SelfChecker(processor.project)
        result = checker.check_export_consistency()
        assert result["passed"] is True

    def test_run_all_checks(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        checker = SelfChecker(processor.project)
        results = checker.run_all_checks()
        assert len(results) == 4
        assert all("check_name" in r for r in results)

    def test_get_records_needing_customer_review(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        record_id = list(processor.project.records.keys())[0]

        processor.supplement_route(
            record_id,
            [{"x": 0, "y": 0}, {"x": 8, "y": 0}],
            auto_recalculate=False,
        )

        checker = SelfChecker(processor.project)
        needing_review = checker.get_records_needing_customer_review()
        assert len(needing_review) >= 1
        assert needing_review[0]["status"] == ProcessingStatus.LENGTH_NOT_RECALCULATED.value


class TestUnifiedDataSource:
    def test_get_all_records(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        data_source = UnifiedDataSource(processor.project)
        records = data_source.get_all_records()
        assert len(records) == 4

    def test_get_record_detail(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        data_source = UnifiedDataSource(processor.project)
        record_id = next(iter(processor.project.records.keys()))

        detail = data_source.get_record_detail(record_id)
        assert detail is not None
        assert "obstacle_remark_evidence" in detail

    def test_get_evidence_summary(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        data_source = UnifiedDataSource(processor.project)
        record_id = next(iter(processor.project.records.keys()))

        summary = data_source.get_evidence_summary(record_id)
        assert summary is not None
        assert summary["数据来源"] == "统一数据源"
        assert "障碍物备注证据" in summary


class TestDataExporter:
    def test_export_to_excel(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        exporter = DataExporter(processor.project)

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            temp_path = f.name

        try:
            result = exporter.export_to_excel(temp_path)
            assert result["success"] is True
            assert os.path.exists(temp_path)

            df = pd.read_excel(temp_path, sheet_name="测量记录明细")
            assert len(df) == 4
        finally:
            os.unlink(temp_path)

    def test_export_to_json(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        exporter = DataExporter(processor.project)

        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            result = exporter.export_to_json(temp_path)
            assert result["success"] is True

            with open(temp_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            assert data["export_info"]["data_source"] == "统一数据源"
            assert len(data["records"]) == 4
        finally:
            os.unlink(temp_path)

    def test_verify_consistency(self, processor, sample_csv):
        processor.import_obstacle_remarks(sample_csv, "许工")
        exporter = DataExporter(processor.project)
        result = exporter.verify_consistency()
        assert result["consistent"] is True


class TestThreeStepWorkflow:
    def test_step1_import(self, sample_csv):
        workflow = ThreeStepWorkflow()
        step1 = workflow.step1_import_obstacle_remarks(sample_csv, "许工")
        assert step1["completed"] is True
        assert step1["import_result"]["imported"] == 3

    def test_step2_review_sketch(self, sample_csv):
        workflow = ThreeStepWorkflow()
        workflow.step1_import_obstacle_remarks(sample_csv, "许工")
        record_id = next(iter(workflow.project.records.keys()))

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            sketch_path = f.name

        try:
            step2 = workflow.step2_review_floor_sketches(
                record_id, sketch_path, "2号楼", 7, "已补看", "许工"
            )
            assert step2["completed"] is True
        finally:
            os.unlink(sketch_path)

    def test_step3_export(self, sample_csv):
        workflow = ThreeStepWorkflow()
        workflow.step1_import_obstacle_remarks(sample_csv, "许工")

        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            excel_path = f.name
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            json_path = f.name

        try:
            step3 = workflow.step3_export(excel_path, json_path, "许工")
            assert step3["completed"] is True
            assert step3["excel_export"]["success"] is True
            assert step3["consistency_check"]["consistent"] is True
        finally:
            os.unlink(excel_path)
            os.unlink(json_path)

    def test_handle_length_not_recalculated(self, sample_csv):
        workflow = ThreeStepWorkflow()
        workflow.step1_import_obstacle_remarks(sample_csv, "许工")
        record_id = list(workflow.project.records.keys())[1]

        new_points = [
            {"x": 0, "y": 0},
            {"x": 8, "y": 0},
            {"x": 8, "y": 6},
            {"x": 22.3, "y": 6},
        ]
        result = workflow.handle_length_not_recalculated(
            record_id, new_points, "补录绕行点", "许工", auto_recalculate=False
        )

        assert result["needs_customer_review"] is True
        assert result["auto_recalculated"] is False
        assert "evidence" in result

    def test_recalculate_after_review(self, sample_csv):
        workflow = ThreeStepWorkflow()
        workflow.step1_import_obstacle_remarks(sample_csv, "许工")
        record_id = list(workflow.project.records.keys())[1]

        workflow.handle_length_not_recalculated(
            record_id,
            [{"x": 0, "y": 0}, {"x": 8, "y": 0}, {"x": 8, "y": 6}],
            auto_recalculate=False,
        )

        result = workflow.recalculate_after_review(record_id, "许工")
        assert result["result"]["success"] is True

        record = workflow.project.get_record(record_id)
        assert record.obstacle_remark.processing_status == ProcessingStatus.VERIFIED

    def test_get_evidence_for_api(self, sample_csv):
        workflow = ThreeStepWorkflow()
        workflow.step1_import_obstacle_remarks(sample_csv, "许工")

        evidence = workflow.get_evidence_for_api()
        assert "project_id" in evidence
        assert "summary" in evidence
        assert "records" in evidence
        assert "workflow_history" in evidence

    def test_full_workflow(self, sample_csv):
        workflow = ThreeStepWorkflow()

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            sketch_path = f.name
        with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
            excel_path = f.name

        try:
            workflow.step1_import_obstacle_remarks(sample_csv, "许工")
            record_id = next(iter(workflow.project.records.keys()))

            workflow.step2_review_floor_sketches(
                record_id, sketch_path, "1号楼", 6, "已补看", "许工"
            )

            supplement_id = list(workflow.project.records.keys())[1]
            workflow.handle_length_not_recalculated(
                supplement_id,
                [{"x": 0, "y": 0}, {"x": 8, "y": 0}, {"x": 8, "y": 6}],
                auto_recalculate=False,
            )

            step3 = workflow.step3_export(excel_path, None, "许工")
            assert step3["completed"] is True

            checker = SelfChecker(workflow.project)
            needing_review = checker.get_records_needing_customer_review()
            assert len(needing_review) >= 1

            workflow.recalculate_after_review(supplement_id, "许工")

            final_checks = checker.run_all_checks()
            passed = sum(1 for c in final_checks if c["passed"])
            assert passed >= 3
        finally:
            os.unlink(sketch_path)
            os.unlink(excel_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
