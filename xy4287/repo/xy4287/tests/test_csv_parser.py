"""测试CSV解析器"""

import tempfile
from pathlib import Path

import numpy as np
import pytest

from reverb_batch_processor.csv_parser import (
    SoundLevelMeterParser, CSVParseError, parse_csv_file
)
from reverb_batch_processor.sample_data import SampleDataGenerator


class TestSoundLevelMeterParser:
    """测试声级计解析器"""

    def test_parse_simple_csv(self):
        """测试解析简单CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.csv"
            generator.generate_decay_csv(
                file_path,
                rt60=1.0,
                snr_db=30.0,
                sample_rate=100.0,
                duration=3.0
            )

            parser = SoundLevelMeterParser()
            measurements = parser.parse_file(file_path)

            assert len(measurements) == 1
            assert measurements[0].num_samples > 0
            assert measurements[0].sample_rate > 0

    def test_parse_multi_band_csv(self):
        """测试解析多频段CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "multi_band.csv"
            generator.generate_multi_band_csv(file_path)

            parser = SoundLevelMeterParser()
            measurements = parser.parse_file(file_path)

            assert len(measurements) >= 1

    def test_parse_with_metadata(self):
        """测试解析带元数据的CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "with_metadata.csv"
            generator.generate_decay_csv(
                file_path,
                rt60=1.2,
                snr_db=35.0,
                include_metadata=True
            )

            parser = SoundLevelMeterParser()
            measurements = parser.parse_file(file_path)

            assert len(measurements) == 1
            assert 'file_name' in measurements[0].metadata

    def test_parse_non_existent_file(self):
        """测试解析不存在的文件"""
        parser = SoundLevelMeterParser()

        with pytest.raises(CSVParseError):
            parser.parse_file(Path("/non/existent/file.csv"))


class TestParseCsvFileFunction:
    """测试便捷函数"""

    def test_successful_parse(self):
        """测试成功解析"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.csv"
            generator.generate_decay_csv(file_path, rt60=1.0, snr_db=30.0)

            measurements, validation = parse_csv_file(file_path)

            assert len(measurements) == 1
            assert validation.status.value == "通过"

    def test_parse_with_invalid_file(self):
        """测试解析无效文件"""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "invalid.csv"

            with open(file_path, 'w') as f:
                f.write("这不是有效的CSV数据\n")
                f.write("完全乱码\n")

            measurements, validation = parse_csv_file(file_path)

            assert len(measurements) == 0


class TestSampleDataGenerator:
    """测试示例数据生成器"""

    def test_generate_decay_csv(self):
        """测试生成衰减CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "decay.csv"
            generator.generate_decay_csv(
                file_path,
                rt60=1.5,
                snr_db=25.0,
                sample_rate=50.0,
                duration=2.0
            )

            assert file_path.exists()

            with open(file_path, 'r') as f:
                lines = f.readlines()
                assert len(lines) > 0

    def test_generate_clipping_csv(self):
        """测试生成削波CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "clipping.csv"
            generator.generate_clipping_csv(file_path)

            assert file_path.exists()

    def test_generate_high_noise_csv(self):
        """测试生成高噪声CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "noisy.csv"
            generator.generate_high_noise_csv(file_path)

            assert file_path.exists()

    def test_generate_multiple_reflections_csv(self):
        """测试生成多次反射CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "reflections.csv"
            generator.generate_multiple_reflections_csv(file_path)

            assert file_path.exists()

    def test_generate_missing_data_csv(self):
        """测试生成缺失数据CSV"""
        generator = SampleDataGenerator()

        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "missing.csv"
            generator.generate_missing_data_csv(file_path, missing_ratio=0.1)

            assert file_path.exists()
