import os
import sys
import csv
import tempfile
from click.testing import CliRunner
import pytest

from spare_parts.cli import cli


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def sample_csv():
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '备件编码', '备件名称', '数量', '单位', '最小库存',
            '当前库存', '供应商', '单价', '最小包装量', '替代件'
        ])
        writer.writerow(['BJ-001', '轴承6205', 50, '个', 30, 12, '供应商A', 25.5, 10, 'BJ-002'])
        writer.writerow(['BJ-002', '轴承6205-2RS', 30, '个', 30, 45, '供应商B', 28.0, 5, ''])
    yield f.name
    os.unlink(f.name)


class TestCliCommands:
    def test_version_command(self, runner):
        result = runner.invoke(cli, ['--version'])
        assert result.exit_code == 0
        assert '1.0.0' in result.output

    def test_help_command(self, runner):
        result = runner.invoke(cli, ['--help'])
        assert result.exit_code == 0
        assert '维修备件小库备件采购建议 CLI' in result.output

    def test_rules_command(self, runner):
        result = runner.invoke(cli, ['rules'])
        assert result.exit_code == 0
        assert '维修备件小库备件采购规则' in result.output
        assert '退出码说明' in result.output

    def test_sample_command(self, runner):
        with runner.isolated_filesystem():
            result = runner.invoke(cli, ['sample'])
            assert result.exit_code == 0
            assert '样例数据已生成' in result.output
            assert os.path.exists('sample_data/维修备件采购样例.csv')


class TestProcessCommand:
    def test_process_with_valid_file(self, runner, sample_csv):
        with runner.isolated_filesystem():
            output_dir = 'output'
            result = runner.invoke(cli, ['process', sample_csv, '-o', output_dir])
            assert result.exit_code == 0
            assert '处理结果汇总' in result.output
            assert '输出文件' in result.output

    def test_process_with_nonexistent_file(self, runner):
        result = runner.invoke(cli, ['process', '/nonexistent/file.csv'])
        assert result.exit_code == 2
        assert '输入文件不存在' in result.output

    def test_process_with_bad_columns(self, runner):
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['坏列1', '坏列2'])
            writer.writerow(['a', 'b'])

        try:
            result = runner.invoke(cli, ['process', f.name])
            assert result.exit_code == 3
            assert '缺少必需列' in result.output
        finally:
            os.unlink(f.name)

    def test_process_quiet_mode(self, runner, sample_csv):
        with runner.isolated_filesystem():
            result = runner.invoke(cli, ['process', sample_csv, '-q'])
            assert result.exit_code == 0
            assert '处理结果汇总' not in result.output


class TestIssueSections:
    def test_alternative_parts_section(self, runner, sample_csv):
        with runner.isolated_filesystem():
            result = runner.invoke(cli, ['process', sample_csv])
            assert result.exit_code == 0
            assert '替代件清单' in result.output

    def test_min_package_section(self, runner, sample_csv):
        with runner.isolated_filesystem():
            result = runner.invoke(cli, ['process', sample_csv])
            assert result.exit_code == 0
            assert '最小包装量处理' in result.output


class TestIntegration:
    def test_full_workflow(self, runner):
        with runner.isolated_filesystem():
            result = runner.invoke(cli, ['sample'])
            assert result.exit_code == 0

            sample_file = 'sample_data/维修备件采购样例.csv'
            assert os.path.exists(sample_file)

            result = runner.invoke(cli, ['process', sample_file])
            assert result.exit_code == 0
            assert '需采购备件' in result.output

            output_files = os.listdir('output')
            assert len(output_files) >= 1
            assert any(f.startswith('备件采购建议') for f in output_files)
