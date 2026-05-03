"""示例数据生成器 - 用于测试和演示。"""

import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pathlib import Path

from fits_quality_checker.models.models import (
    FITSMetadata,
    FileType,
    ObservationConfig,
)


class SampleDataGenerator:
    """示例数据生成器。

    用于生成模拟的FITS文件元数据，支持:
    - 正常数据
    - 带问题的数据（云划过、星点拖线、温度偏差等）
    - 多种文件类型（light/dark/flat）
    """

    def __init__(self, config: ObservationConfig, seed: int = 42):
        """初始化示例数据生成器。

        Args:
            config: 观测配置
            seed: 随机种子
        """
        self.config = config
        self.random = random.Random(seed)
        self._problematic_files: Dict[str, Dict[str, Any]] = {}

    def generate_batch(
        self,
        count: int,
        light_ratio: float = 0.6,
        dark_ratio: float = 0.25,
        flat_ratio: float = 0.15,
        include_problems: bool = True,
    ) -> List[FITSMetadata]:
        """生成一批示例元数据。

        Args:
            count: 总数量
            light_ratio: 光场比例
            dark_ratio: 暗场比例
            flat_ratio: 平场比例
            include_problems: 是否包含问题数据

        Returns:
            FITSMetadata列表
        """
        results: List[FITSMetadata] = []

        light_count = int(count * light_ratio)
        dark_count = int(count * dark_ratio)
        flat_count = count - light_count - dark_count

        self._problematic_files = {}

        if include_problems:
            self._prepare_problematic_indices(
                light_count, dark_count, flat_count
            )

        for i in range(light_count):
            metadata = self._generate_light_file(i, light_count)
            results.append(metadata)

        for i in range(dark_count):
            metadata = self._generate_dark_file(i, dark_count)
            results.append(metadata)

        for i in range(flat_count):
            metadata = self._generate_flat_file(i, flat_count)
            results.append(metadata)

        self.random.shuffle(results)
        return results

    def _prepare_problematic_indices(
        self, light_count: int, dark_count: int, flat_count: int
    ):
        """准备问题文件的索引。

        Args:
            light_count: 光场数量
            dark_count: 暗场数量
            flat_count: 平场数量
        """
        problem_ratio = 0.2

        light_problem_count = max(1, int(light_count * problem_ratio))
        light_problems = self.random.sample(
            range(light_count),
            min(light_problem_count, light_count)
        )

        dark_problem_count = max(1, int(dark_count * problem_ratio))
        dark_problems = self.random.sample(
            range(dark_count),
            min(dark_problem_count, dark_count)
        )

        for idx in light_problems:
            problem_type = self.random.choice([
                "cloud",
                "star_trail",
                "exposure_mismatch",
                "filter_mismatch",
            ])
            self._problematic_files[f"light_{idx}"] = {
                "type": problem_type,
                "severity": self.random.choice(["mild", "medium", "severe"]),
            }

        for idx in dark_problems:
            problem_type = self.random.choice([
                "temperature_mismatch",
                "exposure_mismatch",
            ])
            self._problematic_files[f"dark_{idx}"] = {
                "type": problem_type,
                "severity": self.random.choice(["medium", "severe"]),
            }

    def _generate_light_file(self, index: int, total: int) -> FITSMetadata:
        """生成光场文件元数据。

        Args:
            index: 索引
            total: 总数

        Returns:
            FITSMetadata
        """
        file_key = f"light_{index}"
        is_problematic = file_key in self._problematic_files
        problem_info = self._problematic_files.get(file_key, {})

        filters = ["L", "R", "G", "B", "Ha", "OIII", "SII"]
        filter_name = self.random.choice(filters)
        base_exposure = self.config.expected_exposures.get(filter_name, 300)

        exposure_time = float(base_exposure)
        temperature = self.config.expected_temperature or -10.0
        fwhm_base = 2.0 + self.random.random() * 1.0
        roundness_base = 0.85 + self.random.random() * 0.1
        noise_base = 8.0 + self.random.random() * 3.0

        if is_problematic:
            problem_type = problem_info.get("type")
            severity = problem_info.get("severity", "medium")

            if problem_type == "cloud":
                noise_base = self._apply_severity(noise_base, 2.0, 3.0, 5.0, severity)
                fwhm_base = self._apply_severity(fwhm_base, 1.2, 1.5, 2.0, severity)
            elif problem_type == "star_trail":
                roundness_base = self._apply_severity(roundness_base, 0.7, 0.5, 0.3, severity)
                fwhm_base = self._apply_severity(fwhm_base, 1.5, 2.0, 3.0, severity)
            elif problem_type == "exposure_mismatch":
                exposure_time = self._apply_severity(exposure_time, 0.8, 0.5, 0.3, severity)
            elif problem_type == "filter_mismatch":
                filter_name = self.random.choice([f for f in filters if f != filter_name])

        obs_time = datetime.now() - timedelta(
            hours=self.random.random() * 8,
            minutes=self.random.random() * 60,
        )

        file_name = f"light_{filter_name}_{index+1:04d}.fits"
        file_path = str(Path("/data/observation") / file_name)

        return FITSMetadata(
            file_path=file_path,
            file_name=file_name,
            file_type=FileType.LIGHT,
            exposure_time=exposure_time,
            filter_name=filter_name,
            temperature=temperature + (self.random.random() - 0.5) * 0.2,
            gain=100.0,
            offset=50.0,
            airmass=1.0 + self.random.random() * 0.5,
            observation_time=obs_time,
            object_name=self.config.target_name,
            x_pixel_size=self.config.pixel_size,
            y_pixel_size=self.config.pixel_size,
            x_bin=1,
            y_bin=1,
            header={
                "EXPTIME": exposure_time,
                "FILTER": filter_name,
                "TEMP": temperature,
                "GAIN": 100.0,
                "OFFSET": 50.0,
                "AIRMASS": 1.0 + self.random.random() * 0.5,
                "DATE-OBS": obs_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "OBJECT": self.config.target_name,
            },
        )

    def _generate_dark_file(self, index: int, total: int) -> FITSMetadata:
        """生成暗场文件元数据。

        Args:
            index: 索引
            total: 总数

        Returns:
            FITSMetadata
        """
        file_key = f"dark_{index}"
        is_problematic = file_key in self._problematic_files
        problem_info = self._problematic_files.get(file_key, {})

        base_exposure = self.random.choice([300.0, 600.0, 900.0])
        base_temperature = self.config.expected_temperature or -10.0

        exposure_time = base_exposure
        temperature = base_temperature + (self.random.random() - 0.5) * 0.1

        if is_problematic:
            problem_type = problem_info.get("type")
            severity = problem_info.get("severity", "medium")

            if problem_type == "temperature_mismatch":
                temp_offset = self._apply_severity(0, 1.0, 2.0, 5.0, severity)
                temperature = base_temperature + temp_offset * (1 if self.random.random() > 0.5 else -1)
            elif problem_type == "exposure_mismatch":
                exposure_time = self._apply_severity(exposure_time, 0.7, 0.5, 0.3, severity)

        obs_time = datetime.now() - timedelta(
            hours=self.random.random() * 12,
            minutes=self.random.random() * 60,
        )

        file_name = f"dark_{int(exposure_time)}s_{index+1:04d}.fits"
        file_path = str(Path("/data/calibration") / file_name)

        return FITSMetadata(
            file_path=file_path,
            file_name=file_name,
            file_type=FileType.DARK,
            exposure_time=exposure_time,
            filter_name="Dark",
            temperature=temperature,
            gain=100.0,
            offset=50.0,
            observation_time=obs_time,
            x_pixel_size=self.config.pixel_size,
            y_pixel_size=self.config.pixel_size,
            x_bin=1,
            y_bin=1,
            header={
                "EXPTIME": exposure_time,
                "FILTER": "Dark",
                "TEMP": temperature,
                "GAIN": 100.0,
                "OFFSET": 50.0,
                "DATE-OBS": obs_time.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )

    def _generate_flat_file(self, index: int, total: int) -> FITSMetadata:
        """生成平场文件元数据。

        Args:
            index: 索引
            total: 总数

        Returns:
            FITSMetadata
        """
        filters = ["L", "R", "G", "B"]
        filter_name = self.random.choice(filters)
        exposure_time = self.random.choice([0.1, 0.5, 1.0, 2.0])

        obs_time = datetime.now() - timedelta(
            hours=self.random.random() * 24,
            minutes=self.random.random() * 60,
        )

        file_name = f"flat_{filter_name}_{index+1:04d}.fits"
        file_path = str(Path("/data/calibration") / file_name)

        return FITSMetadata(
            file_path=file_path,
            file_name=file_name,
            file_type=FileType.FLAT,
            exposure_time=exposure_time,
            filter_name=filter_name,
            temperature=self.config.expected_temperature or 20.0,
            gain=100.0,
            offset=50.0,
            observation_time=obs_time,
            x_pixel_size=self.config.pixel_size,
            y_pixel_size=self.config.pixel_size,
            x_bin=1,
            y_bin=1,
            header={
                "EXPTIME": exposure_time,
                "FILTER": filter_name,
                "GAIN": 100.0,
                "OFFSET": 50.0,
                "DATE-OBS": obs_time.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )

    def _apply_severity(
        self,
        base_value: float,
        mild_factor: float,
        medium_factor: float,
        severe_factor: float,
        severity: str,
    ) -> float:
        """根据严重程度应用因子。

        Args:
            base_value: 基础值
            mild_factor: 轻度因子
            medium_factor: 中度因子
            severe_factor: 重度因子
            severity: 严重程度

        Returns:
            应用因子后的值
        """
        if severity == "mild":
            return base_value * mild_factor
        elif severity == "medium":
            return base_value * medium_factor
        elif severity == "severe":
            return base_value * severe_factor
        return base_value

    def generate_csv_sample(self, output_path: str, count: int = 20) -> str:
        """生成示例CSV元数据文件。

        Args:
            output_path: 输出路径
            count: 文件数量

        Returns:
            输出文件路径
        """
        metadatas = self.generate_batch(count)

        lines = [
            "file_path,file_name,file_type,exposure_time,filter,temperature,gain,observation_time"
        ]

        for m in metadatas:
            obs_time_str = m.observation_time.strftime("%Y-%m-%d %H:%M:%S") if m.observation_time else ""
            line = (
                f'"{m.file_path}",'
                f'"{m.file_name}",'
                f'"{m.file_type.value}",'
                f'{m.exposure_time or ""},'
                f'"{m.filter_name or ""}",'
                f'{m.temperature or ""},'
                f'{m.gain or ""},'
                f'"{obs_time_str}"'
            )
            lines.append(line)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return output_path
