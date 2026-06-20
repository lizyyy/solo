"""系统测试 - 验证所有核心功能"""

import os
import tempfile
import shutil
from pathlib import Path

import pytest

from src.parameter_manager import ParameterManager
from src.chart_explainer import ChartExplainer
from src.data_lineage import DataLineageTracker
from src.material_packer import MaterialPacker


class TestParameterManager:
    """测试参数管理模块"""
    
    def setup_method(self):
        self.manager = ParameterManager()
        
        raw_data1 = {"分子": 25, "分母": 100, "备注": "测试数据1"}
        self.manager.import_parameters(
            parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
            source_type="excel",
            source_id="test_data_1.xlsx",
            source_name="测试数据表格1",
            raw_data=raw_data1,
            created_by="测试人员1",
            version_name="v1",
            change_description="初始参数导入",
            change_reason="测试",
        )
        
        raw_data2 = {"分子": 30, "分母": 100, "备注": "测试数据2"}
        self.manager.import_parameters(
            parameters={"分子": 30, "分母": 100, "总数": 550, "样本量": 50},
            source_type="excel",
            source_id="test_data_1.xlsx",
            source_name="测试数据表格1",
            raw_data=raw_data2,
            created_by="测试人员1",
            version_name="v2",
            change_description="修正分子和总数",
            change_reason="发现录入错误",
        )
        
        raw_data3 = {"分子": 30, "分母": 0, "备注": "测试除零"}
        self.manager.import_parameters(
            parameters={"分子": 30, "分母": 0, "总数": 550, "样本量": 50, "A值": 85, "B值": 70},
            source_type="manual",
            source_id="manual_001",
            source_name="手动录入测试",
            raw_data=raw_data3,
            created_by="测试人员2",
            version_name="v3",
            change_description="添加A/B值，分母设为0",
            change_reason="测试边界条件",
        )
    
    def test_version_count(self):
        """测试版本数量"""
        versions = self.manager.list_versions()
        assert len(versions) == 3
    
    def test_active_version(self):
        """测试当前活跃版本"""
        active = self.manager.get_active_version()
        assert active is not None
        assert active.version_name == "v3"
    
    def test_version_timeline(self):
        """测试版本时间线"""
        timeline = self.manager.get_version_timeline()
        assert len(timeline) == 3
        assert timeline[0]["step"] == 1
        assert timeline[0]["version_name"] == "v1"
        assert timeline[2]["is_active"] == True
    
    def test_compare_versions(self):
        """测试版本比较"""
        versions = self.manager.list_versions()
        changes = self.manager.compare_versions(versions[0].version_id, versions[1].version_id)
        
        assert len(changes) == 2
        param_names = [c.param_name for c in changes]
        assert "分子" in param_names
        assert "总数" in param_names
    
    def test_trace_parameter_origin(self):
        """测试参数追溯"""
        history = self.manager.trace_parameter_origin("分子")
        assert len(history) == 3
        assert history[0]["value"] == 25
        assert history[1]["value"] == 30
        assert history[2]["value"] == 30
    
    def test_raw_data_preserved(self):
        """测试原始数据保留"""
        versions = self.manager.list_versions()
        assert versions[0].source.raw_data["分子"] == 25
        assert versions[0].source.raw_data["备注"] == "测试数据1"
    
    def test_save_and_load(self):
        """测试保存和加载"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        try:
            self.manager.save(temp_path)
            loaded = ParameterManager.load(temp_path)
            
            assert len(loaded.list_versions()) == 3
            assert loaded.get_active_version().version_name == "v3"
        finally:
            os.unlink(temp_path)


class TestChartExplainer:
    """测试图表解释引擎"""
    
    def setup_method(self):
        self.manager = ParameterManager()
        
        raw_data1 = {"分子": 25, "分母": 100, "备注": "测试数据1"}
        self.manager.import_parameters(
            parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
            source_type="excel",
            source_id="test_data_1.xlsx",
            source_name="测试数据表格1",
            raw_data=raw_data1,
            created_by="测试人员1",
            version_name="v1",
        )
        
        raw_data3 = {"分子": 30, "分母": 0, "备注": "测试除零"}
        self.manager.import_parameters(
            parameters={"分子": 30, "分母": 0, "总数": 550, "样本量": 50, "A值": 85, "B值": 70},
            source_type="manual",
            source_id="manual_001",
            source_name="手动录入测试",
            raw_data=raw_data3,
            created_by="测试人员2",
            version_name="v3",
        )
        
        self.explainer = ChartExplainer(self.manager)
    
    def test_explain_normal(self):
        """测试正常版本解释"""
        versions = self.manager.list_versions()
        explanation = self.explainer.explain(version_id=versions[0].version_id)
        
        assert explanation is not None
        assert explanation.version_name == "v1"
        assert len(explanation.key_findings) > 0
        assert len(explanation.calculation_steps) > 0
    
    def test_explain_with_boundary_issue(self):
        """测试除零边界情况"""
        versions = self.manager.list_versions()
        explanation = self.explainer.explain(version_id=versions[1].version_id)
        
        assert len(explanation.boundary_issues) > 0
        issue_types = [i.issue_type for i in explanation.boundary_issues]
        assert "除零错误" in issue_types
    
    def test_boundary_issue_has_suggestion(self):
        """测试边界问题有处理建议"""
        versions = self.manager.list_versions()
        explanation = self.explainer.explain(version_id=versions[1].version_id)
        
        for issue in explanation.boundary_issues:
            assert issue.suggestion is not None
            assert len(issue.suggestion) > 0
    
    def test_plain_language_summary(self):
        """测试通俗易懂的解释"""
        versions = self.manager.list_versions()
        explanation = self.explainer.explain(version_id=versions[0].version_id)
        
        assert explanation.plain_language_summary is not None
        assert len(explanation.plain_language_summary) > 0
    
    def test_trace_bad_data(self):
        """测试坏数据追溯"""
        result = self.explainer.trace_bad_data("分母")
        
        assert result["found"] == True
        assert "first_occurrence" in result
        assert "suggestion" in result
    
    def test_compare_explanations(self):
        """测试解释比较"""
        versions = self.manager.list_versions()
        exp1 = self.explainer.explain(version_id=versions[0].version_id)
        exp2 = self.explainer.explain(version_id=versions[1].version_id)
        
        comparison = self.explainer.compare_explanations(exp1.explanation_id, exp2.explanation_id)
        
        assert "parameter_changes" in comparison
        assert "step_changes" in comparison


class TestDataLineageTracker:
    """测试数据溯源系统"""
    
    def setup_method(self):
        self.manager = ParameterManager()
        
        raw_data1 = {"分子": 25, "分母": 100, "备注": "测试数据1"}
        self.manager.import_parameters(
            parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
            source_type="excel",
            source_id="test_data_1.xlsx",
            source_name="测试数据表格1",
            raw_data=raw_data1,
            created_by="测试人员1",
            version_name="v1",
        )
        
        raw_data3 = {"分子": 30, "分母": 0, "备注": "测试除零"}
        self.manager.import_parameters(
            parameters={"分子": 30, "分母": 0, "总数": 550, "样本量": 50, "A值": 85, "B值": 70},
            source_type="manual",
            source_id="manual_001",
            source_name="手动录入测试",
            raw_data=raw_data3,
            created_by="测试人员2",
            version_name="v3",
        )
        
        self.tracker = DataLineageTracker(self.manager)
    
    def test_build_lineage(self):
        """测试构建溯源链"""
        lineage = self.tracker.build_lineage_for_param("分子")
        assert len(lineage) == 2
        assert lineage[0].value == 25
        assert lineage[1].value == 30
    
    def test_investigate_issue(self):
        """测试调查问题"""
        explainer = ChartExplainer(self.manager)
        versions = self.manager.list_versions()
        explanation = explainer.explain(version_id=versions[1].version_id)
        
        for issue in explanation.boundary_issues:
            report = self.tracker.investigate_issue(issue)
            assert report is not None
            assert report.first_occurrence is not None
            assert len(report.suggestions) > 0
    
    def test_lineage_graph(self):
        """测试溯源图"""
        graph = self.tracker.get_lineage_graph("分母")
        assert "nodes" in graph
        assert "edges" in graph
        assert len(graph["nodes"]) == 2


class TestMaterialPacker:
    """测试材料打包功能"""
    
    def setup_method(self):
        self.manager = ParameterManager()
        
        raw_data1 = {"分子": 25, "分母": 100, "备注": "测试数据1"}
        self.manager.import_parameters(
            parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
            source_type="excel",
            source_id="test_data_1.xlsx",
            source_name="测试数据表格1",
            raw_data=raw_data1,
            created_by="测试人员1",
            version_name="v1",
        )
        
        raw_data3 = {"分子": 30, "分母": 0, "备注": "测试除零"}
        self.manager.import_parameters(
            parameters={"分子": 30, "分母": 0, "总数": 550, "样本量": 50, "A值": 85, "B值": 70},
            source_type="manual",
            source_id="manual_001",
            source_name="手动录入测试",
            raw_data=raw_data3,
            created_by="测试人员2",
            version_name="v3",
        )
        
        self.explainer = ChartExplainer(self.manager)
        self.tracker = DataLineageTracker(self.manager)
        self.packer = MaterialPacker(self.manager, self.explainer, self.tracker)
        
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir)
    
    def test_package(self):
        """测试打包功能"""
        package = self.packer.package(
            package_name="测试材料包",
            output_dir=self.temp_dir,
        )
        
        assert package is not None
        assert len(package.materials) > 0
        
        package_dir = package.output_dir
        assert (package_dir / "00_材料包说明.md").exists()
        assert (package_dir / "01_版本时间线.html").exists()
        assert (package_dir / "01_版本时间线.csv").exists()
        assert (package_dir / "02_图表解释报告.html").exists()
        assert (package_dir / "02_图表解释报告.json").exists()
        assert (package_dir / "03_边界问题处理建议.md").exists()
        assert (package_dir / "04_数据溯源报告").is_dir()
        assert (package_dir / "05_参数表").is_dir()
        assert (package_dir / "06_原始数据副本").is_dir()
        assert (package_dir / "manifest.json").exists()
    
    def test_readme_contains_instructions(self):
        """测试README包含使用说明"""
        package = self.packer.package(
            package_name="测试材料包",
            output_dir=self.temp_dir,
        )
        
        readme_path = package.output_dir / "00_材料包说明.md"
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        assert "先看这份历史时间线" in content
        assert "再看图表解释" in content
        assert "python -m src.cli timeline" in content
        assert "python -m src.cli explain" in content


class TestIntegration:
    """集成测试 - 模拟真实使用场景"""
    
    def test_full_workflow(self):
        """测试完整工作流"""
        temp_dir = tempfile.mkdtemp()
        data_file = os.path.join(temp_dir, "params.json")
        
        try:
            manager = ParameterManager()
            
            raw_data1 = {"分子": 25, "分母": 100, "备注": "教研编辑阿宁提供"}
            manager.import_parameters(
                parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
                source_type="excel",
                source_id="data_20240601.xlsx",
                source_name="6月1日数据表格",
                raw_data=raw_data1,
                created_by="阿宁",
                version_name="v1",
                change_description="初始参数导入",
                change_reason="首次录入",
            )
            
            raw_data2 = {"分子": 30, "分母": 100, "备注": "修正后的数据"}
            manager.import_parameters(
                parameters={"分子": 30, "分母": 100, "总数": 550, "样本量": 50},
                source_type="excel",
                source_id="data_20240601.xlsx",
                source_name="6月1日数据表格",
                raw_data=raw_data2,
                created_by="阿宁",
                version_name="v2",
                change_description="修正分子和总数",
                change_reason="发现原始数据录入错误",
            )
            
            manager.save(data_file)
            
            loaded_manager = ParameterManager.load(data_file)
            explainer = ChartExplainer(loaded_manager)
            tracker = DataLineageTracker(loaded_manager)
            packer = MaterialPacker(loaded_manager, explainer, tracker)
            
            timeline = loaded_manager.get_version_timeline()
            assert len(timeline) == 2
            
            changes = loaded_manager.compare_versions(
                timeline[0]["version_id"],
                timeline[1]["version_id"],
            )
            assert len(changes) == 2
            
            explanation = explainer.explain(version_id=timeline[1]["version_id"])
            assert explanation is not None
            assert len(explanation.plain_language_summary) > 0
            
            trace_result = explainer.trace_bad_data("分子")
            assert trace_result["found"] == True
            assert trace_result["first_occurrence"]["created_by"] == "阿宁"
            
            package = packer.package(
                package_name="6月调参结果",
                output_dir=temp_dir,
            )
            assert package is not None
            
        finally:
            shutil.rmtree(temp_dir)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
