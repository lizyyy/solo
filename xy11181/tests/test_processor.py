import os
import csv
import tempfile
import pytest
import time

from spare_parts.processor import PartProcessor
from spare_parts.models import ExitCode


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as td:
        yield td


@pytest.fixture
def sample_csv(temp_dir):
    csv_path = os.path.join(temp_dir, "test_parts.csv")
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '备件编码', '备件名称', '数量', '单位', '最小库存',
            '当前库存', '供应商', '单价', '最小包装量', '替代件'
        ])
        writer.writerow(['BJ-001', '轴承6205', 50, '个', 30, 12, '供应商A', 25.5, 10, 'BJ-002'])
        writer.writerow(['BJ-002', '轴承6205-2RS', 30, '个', 30, 45, '供应商B', 28.0, 5, ''])
        writer.writerow(['BJ-003', '油封30*50*10', 100, '个', 50, 8, '密封厂', 3.5, 20, ''])
    return csv_path


class TestEmptyDirectory:
    def test_empty_directory_returns_error(self, temp_dir):
        processor = PartProcessor()
        result = processor.process_file(temp_dir)
        assert len(result.errors) > 0
        assert "输入目录为空" in result.errors[0]

    def test_nonexistent_file_returns_error(self):
        processor = PartProcessor()
        result = processor.process_file("/nonexistent/path/file.csv")
        assert len(result.errors) > 0
        assert "输入文件不存在" in result.errors[0]
        assert processor.get_exit_code() == ExitCode.INPUT_NOT_FOUND.value


class TestBadRows:
    def test_missing_required_columns(self, temp_dir):
        csv_path = os.path.join(temp_dir, "bad_cols.csv")
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['备件编码', '备件名称', '数量'])

        processor = PartProcessor()
        result = processor.process_file(csv_path)
        assert len(result.errors) > 0
        assert "缺少必需列" in result.errors[0]
        assert processor.get_exit_code() == ExitCode.DATA_FORMAT_ERROR.value

    def test_invalid_quantity_row(self, temp_dir):
        csv_path = os.path.join(temp_dir, "invalid_qty.csv")
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '备件编码', '备件名称', '数量', '单位', '最小库存',
                '当前库存', '供应商', '单价', '最小包装量', '替代件'
            ])
            writer.writerow(['BJ-001', '轴承6205', '不是数字', '个', 30, 12, '供应商A', 25.5, 10, ''])

        processor = PartProcessor()
        result = processor.process_file(csv_path)
        assert len(result.errors) > 0
        assert "第2行解析失败" in result.errors[0]

    def test_empty_part_code(self, temp_dir):
        csv_path = os.path.join(temp_dir, "empty_code.csv")
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '备件编码', '备件名称', '数量', '单位', '最小库存',
                '当前库存', '供应商', '单价', '最小包装量', '替代件'
            ])
            writer.writerow(['', '轴承6205', 50, '个', 30, 12, '供应商A', 25.5, 10, ''])

        processor = PartProcessor()
        result = processor.process_file(csv_path)
        assert len(result.errors) > 0
        assert "第2行解析失败" in result.errors[0]


class TestNormalProcessing:
    def test_total_parts_count(self, sample_csv):
        processor = PartProcessor()
        result = processor.process_file(sample_csv)
        assert result.total_parts == 3

    def test_parts_needing_purchase(self, sample_csv):
        processor = PartProcessor()
        result = processor.process_file(sample_csv)
        assert result.parts_needing_purchase == 2

    def test_parts_with_alternatives(self, sample_csv):
        processor = PartProcessor()
        result = processor.process_file(sample_csv)
        assert result.parts_with_alternatives == 1

    def test_parts_with_min_package(self, sample_csv):
        processor = PartProcessor()
        result = processor.process_file(sample_csv)
        assert result.parts_with_min_package == 3

    def test_min_package_rounding(self):
        from spare_parts.models import SparePart
        part = SparePart(
            part_code="TEST",
            part_name="Test Part",
            quantity=100,
            unit="个",
            min_stock=30,
            current_stock=5,
            min_package=10
        )
        assert part.suggested_purchase == 30

    def test_alternative_parts_parsing(self):
        processor = PartProcessor()
        result = processor._parse_alternative_parts("A,B，C")
        assert result == ['A', 'B', 'C']


class TestRepeatableOutput:
    def test_output_has_timestamp(self, sample_csv, temp_dir):
        processor = PartProcessor()
        processor.process_file(sample_csv)
        output_path = processor.generate_output(temp_dir)
        filename = os.path.basename(output_path)
        assert "_" in filename
        assert filename.endswith(".csv")

    def test_multiple_runs_produce_different_files(self, sample_csv, temp_dir):
        output_dir = os.path.join(temp_dir, "outputs")
        os.makedirs(output_dir, exist_ok=True)

        processor1 = PartProcessor()
        processor1.process_file(sample_csv)
        output1 = processor1.generate_output(output_dir)

        time.sleep(1.1)

        processor2 = PartProcessor()
        processor2.process_file(sample_csv)
        output2 = processor2.generate_output(output_dir)

        assert output1 != output2
        assert os.path.exists(output1)
        assert os.path.exists(output2)


class TestExitCodes:
    def test_success_exit_code(self, sample_csv):
        processor = PartProcessor()
        processor.process_file(sample_csv)
        assert processor.get_exit_code() == ExitCode.SUCCESS.value

    def test_input_not_found_exit_code(self):
        processor = PartProcessor()
        processor.process_file("/nonexistent/file.csv")
        assert processor.get_exit_code() == ExitCode.INPUT_NOT_FOUND.value

    def test_data_format_error_exit_code(self, temp_dir):
        csv_path = os.path.join(temp_dir, "bad.csv")
        with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['bad', 'columns'])

        processor = PartProcessor()
        processor.process_file(csv_path)
        assert processor.get_exit_code() == ExitCode.DATA_FORMAT_ERROR.value
