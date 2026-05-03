#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
导出模块测试 - Exporter Tests

测试报告导出功能。
"""

import pytest
import json
import csv
from pathlib import Path
from typing import List

from pvchecker.exporter import (
    ReportExporter,
    MarkdownExporter,
    CSVExporter,
    JSONExporter,
    ExportFormat,
    ExportResult,
)
from pvchecker.solver import ConfigurationSolution, SolutionType, SolutionScore
from pvchecker import PVModule, RoofZone, InverterMPPT, RiskItem


class TestMarkdownExporter:
    """Markdown导出器测试"""
    
    def test_export_basic(self, test_module, test_inverter, test_roof_zones):
        """测试基本导出"""
        exporter = MarkdownExporter()
        
        solutions = self._create_test_solutions()
        
        result = exporter.export(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        assert result.success == True
        assert result.format == "markdown"
    
    def test_export_to_file(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出到文件"""
        exporter = MarkdownExporter()
        
        output_path = temp_dir / "report.md"
        
        solutions = self._create_test_solutions()
        
        result = exporter.export(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
            output_path=output_path,
        )
        
        assert result.success == True
        assert output_path.exists()
        
        content = output_path.read_text(encoding='utf-8')
        
        assert "屋顶光伏串线校核报告" in content
        assert test_module.model in content
        assert test_inverter.inverter_model in content
    
    def test_export_with_risks(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试带风险的导出"""
        exporter = MarkdownExporter()
        
        output_path = temp_dir / "report_with_risks.md"
        
        solutions = self._create_test_solutions()
        risks = self._create_test_risks()
        
        result = exporter.export(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
            risks=risks,
            output_path=output_path,
        )
        
        assert result.success == True
        
        content = output_path.read_text(encoding='utf-8')
        
        assert "风险评估" in content
        assert "电压超限" in content
    
    def test_get_content(self, test_module, test_inverter, test_roof_zones):
        """测试获取内容"""
        exporter = MarkdownExporter()
        
        solutions = self._create_test_solutions()
        
        exporter.export(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        content = exporter.get_content()
        
        assert len(content) > 0
        assert "# " in content
    
    def _create_test_solutions(self) -> List[ConfigurationSolution]:
        """创建测试方案"""
        return [
            ConfigurationSolution(
                solution_id="test_1",
                solution_type=SolutionType.OPTIMAL,
                name="方案A",
                modules_per_string=10,
                strings_in_parallel=6,
                total_modules=60,
                estimated_voc_low_temp=650.0,
                estimated_voc_high_temp=500.0,
                estimated_v_mp=450.0,
                estimated_i_mp=60.0,
                estimated_total_power=30000.0,
                voltage_in_mppt_range=True,
                estimated_shading_loss_percent=3.0,
                estimated_cable_loss_percent=1.5,
                score=SolutionScore(
                    total_score=85.0,
                    efficiency_score=90.0,
                    cost_score=80.0,
                    risk_score=85.0,
                    voltage_match_score=90.0,
                ),
                notes="Test solution 1",
            ),
            ConfigurationSolution(
                solution_id="test_2",
                solution_type=SolutionType.MAX_SERIES,
                name="方案B",
                modules_per_string=15,
                strings_in_parallel=4,
                total_modules=60,
                estimated_voc_low_temp=975.0,
                estimated_voc_high_temp=750.0,
                estimated_v_mp=675.0,
                estimated_i_mp=40.0,
                estimated_total_power=30000.0,
                voltage_in_mppt_range=True,
                estimated_shading_loss_percent=5.0,
                estimated_cable_loss_percent=1.0,
                score=SolutionScore(
                    total_score=82.0,
                    efficiency_score=88.0,
                    cost_score=85.0,
                    risk_score=70.0,
                    voltage_match_score=85.0,
                ),
                notes="Test solution 2",
            ),
        ]
    
    def _create_test_risks(self) -> List[RiskItem]:
        """创建测试风险"""
        return [
            RiskItem(
                rule_name="低温开路电压超限风险",
                severity="high",
                message="低温下电压裕度不足",
                affected_components=["组串"],
                suggested_action="建议减少串联块数",
                risk_score=75.0,
            ),
            RiskItem(
                rule_name="线缆压降过高风险",
                severity="medium",
                message="线缆压降接近警告阈值",
                affected_components=["线缆"],
                suggested_action="建议增大线缆截面积",
                risk_score=40.0,
            ),
        ]


class TestCSVExporter:
    """CSV导出器测试"""
    
    def test_export_to_directory(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出到目录"""
        exporter = CSVExporter()
        
        output_dir = temp_dir / "csv_reports"
        solutions = self._create_test_solutions()
        risks = self._create_test_risks()
        
        result = exporter.export(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
            risks=risks,
            output_path=output_dir,
        )
        
        assert result.success == True
        assert output_dir.exists()
        
        csv_files = list(output_dir.glob("*.csv"))
        assert len(csv_files) >= 3
    
    def _create_test_solutions(self) -> List[ConfigurationSolution]:
        """创建测试方案"""
        return TestMarkdownExporter._create_test_solutions(self)
    
    def _create_test_risks(self) -> List[RiskItem]:
        """创建测试风险"""
        return TestMarkdownExporter._create_test_risks(self)


class TestJSONExporter:
    """JSON导出器测试"""
    
    def test_export_to_file(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出到文件"""
        exporter = JSONExporter()
        
        output_path = temp_dir / "report.json"
        solutions = TestMarkdownExporter._create_test_solutions(self)
        risks = TestMarkdownExporter._create_test_risks(self)
        
        result = exporter.export(
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
            risks=risks,
            output_path=output_path,
        )
        
        assert result.success == True
        assert output_path.exists()
        
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert 'metadata' in data
        assert 'module_params' in data
        assert 'inverter_params' in data
        assert 'solutions' in data
        assert 'risks' in data
        assert 'risk_summary' in data


class TestReportExporter:
    """统一导出接口测试"""
    
    def test_export_markdown(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出Markdown"""
        exporter = ReportExporter()
        
        output_path = temp_dir / "report.md"
        solutions = TestMarkdownExporter._create_test_solutions(self)
        
        result = exporter.export(
            format='markdown',
            output_path=output_path,
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        assert result.success == True
        assert output_path.exists()
    
    def test_export_json(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出JSON"""
        exporter = ReportExporter()
        
        output_path = temp_dir / "report.json"
        solutions = TestMarkdownExporter._create_test_solutions(self)
        
        result = exporter.export(
            format='json',
            output_path=output_path,
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        assert result.success == True
        assert output_path.exists()
    
    def test_export_csv(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出CSV"""
        exporter = ReportExporter()
        
        output_dir = temp_dir / "csv_out"
        solutions = TestMarkdownExporter._create_test_solutions(self)
        
        result = exporter.export(
            format='csv',
            output_path=output_dir,
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        assert result.success == True
        assert output_dir.exists()
    
    def test_export_all(self, temp_dir: Path, test_module, test_inverter, test_roof_zones):
        """测试导出所有格式"""
        exporter = ReportExporter()
        
        output_dir = temp_dir / "all_formats"
        solutions = TestMarkdownExporter._create_test_solutions(self)
        
        results = exporter.export_all(
            output_dir=output_dir,
            base_name="test_report",
            solutions=solutions,
            module=test_module,
            inverter=test_inverter,
            roof_zones=test_roof_zones,
        )
        
        assert 'markdown' in results
        assert 'csv' in results
        assert 'json' in results
        
        assert (output_dir / "test_report.md").exists()
        assert (output_dir / "test_report.json").exists()
