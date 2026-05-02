import json
from decimal import Decimal

import pytest

from water_activity_cli.calculator import WaterActivityCalculator
from water_activity_cli.models import (
    BakingProfile,
    CalculationResult,
    FormulaIngredient,
    Recipe,
    Unit,
    ValidationIssue,
    ValidationReport,
    WaterActivityTarget,
)
from water_activity_cli.reporter import (
    CSVReporter,
    JSONReporter,
    MarkdownReporter,
    ReportExporter,
)


class TestMarkdownReporter:
    def test_generate_basic(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        markdown = MarkdownReporter.generate(result)
        
        assert isinstance(markdown, str)
        assert len(markdown) > 0
        assert "测试曲奇" in markdown
        assert "水分活度" in markdown
    
    def test_generate_with_validation_report(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        validation_report = ValidationReport(
            valid=True,
            issues=[
                ValidationIssue(
                    level="warning",
                    category="test",
                    message="测试警告",
                    location="test",
                    suggestion="测试建议",
                )
            ],
            summary={"total": 1, "errors": 0, "warnings": 1, "info": 0},
        )
        
        markdown = MarkdownReporter.generate(result, validation_report)
        
        assert "测试警告" in markdown
    
    def test_generate_sections_present(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        markdown = MarkdownReporter.generate(result)
        
        assert "一、输入概览" in markdown
        assert "二、烘烤损耗" in markdown
        assert "三、目标与调整" in markdown
        assert "四、最终预测" in markdown


class TestCSVReporter:
    def test_generate_returns_list(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        csv_rows = CSVReporter.generate(result)
        
        assert isinstance(csv_rows, list)
        assert len(csv_rows) > 0
    
    def test_generate_row_structure(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        csv_rows = CSVReporter.generate(result)
        
        first_row = csv_rows[0]
        assert "category" in first_row
        assert "parameter" in first_row
        assert "value" in first_row
        assert "unit" in first_row
        assert "description" in first_row
    
    def test_generate_categories(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        csv_rows = CSVReporter.generate(result)
        
        categories = {row["category"] for row in csv_rows}
        assert "input" in categories
        assert "baking" in categories
        assert "target" in categories
        assert "adjustment" in categories
        assert "final" in categories


class TestJSONReporter:
    def test_generate_returns_dict(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        json_data = JSONReporter.generate(result)
        
        assert isinstance(json_data, dict)
    
    def test_generate_json_serializable(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        json_data = JSONReporter.generate(result)
        
        json_str = json.dumps(json_data, ensure_ascii=False)
        assert isinstance(json_str, str)
    
    def test_generate_structure(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        json_data = JSONReporter.generate(result)
        
        assert "recipe_name" in json_data
        assert "timestamp" in json_data
        assert "input" in json_data
        assert "baking" in json_data
        assert "target" in json_data
        assert "adjustment" in json_data
        assert "final" in json_data


class TestReportExporter:
    def test_export_package(self, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        package = ReportExporter.export_package(result)
        
        assert isinstance(package.markdown, str)
        assert isinstance(package.csv_content, list)
        assert isinstance(package.json_content, dict)
    
    def test_write_to_files(self, temp_dir, sample_recipe, sample_ingredients):
        calculator = WaterActivityCalculator(sample_ingredients)
        result = calculator.calculate(sample_recipe)
        
        package = ReportExporter.export_package(result)
        
        written_files = ReportExporter.write_to_files(package, temp_dir, "test_report")
        
        assert len(written_files) == 3
        
        md_file = temp_dir / "test_report.md"
        csv_file = temp_dir / "test_report.csv"
        json_file = temp_dir / "test_report.json"
        
        assert md_file.exists()
        assert csv_file.exists()
        assert json_file.exists()
        
        for f in written_files:
            assert f.exists()
