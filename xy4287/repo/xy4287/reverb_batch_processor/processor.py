"""批处理处理器"""

from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import asdict

from .models import (
    Room, MeasurementPoint, MeasurementData,
    AcousticMetrics, BatchResult, ValidationStatus,
    AnomalyType
)
from .csv_parser import parse_csv_file
from .validator import validate_measurement, ValidationConfig
from .acoustics import compute_acoustic_metrics, AcousticsConfig


class BatchProcessor:
    """批处理处理器"""

    def __init__(
        self,
        validation_config: Optional[ValidationConfig] = None,
        acoustics_config: Optional[AcousticsConfig] = None
    ):
        self.validation_config = validation_config or ValidationConfig()
        self.acoustics_config = acoustics_config or AcousticsConfig()

    def process_directory(
        self,
        directory: Path,
        room_name: Optional[str] = None,
        recursive: bool = False
    ) -> BatchResult:
        """
        处理整个目录

        Args:
            directory: 目录路径
            room_name: 房间名称（可选，从目录名推断）
            recursive: 是否递归搜索

        Returns:
            批处理结果
        """
        batch_result = BatchResult()

        if room_name is None:
            room_name = directory.name

        room = Room(
            id=room_name.lower().replace(' ', '_'),
            name=room_name
        )

        csv_files = self._find_csv_files(directory, recursive)

        for csv_file in csv_files:
            measurements, parse_validation = parse_csv_file(csv_file)

            if parse_validation.status == ValidationStatus.FAIL:
                batch_result.failed_measurements += 1
                continue

            for measurement in measurements:
                batch_result.total_measurements += 1

                point_name = self._infer_point_name(csv_file, measurement)
                point_id = point_name.lower().replace(' ', '_')

                if point_id not in room.points:
                    room.points[point_id] = MeasurementPoint(
                        id=point_id,
                        name=point_name
                    )

                point = room.points[point_id]

                band = measurement.metadata.get('band', 'unknown')
                point.measurements[band] = measurement

                validation = validate_measurement(measurement, self.validation_config)

                if validation.status == ValidationStatus.FAIL:
                    point.validation = validation
                    batch_result.failed_measurements += 1
                    continue

                metrics = compute_acoustic_metrics(measurement, self.acoustics_config)
                point.metrics[band] = metrics

                batch_result.passed_measurements += 1

        batch_result.rooms[room.id] = room

        return batch_result

    def process_files(
        self,
        files: List[Path],
        room_name: str = "default"
    ) -> BatchResult:
        """
        处理指定文件列表

        Args:
            files: 文件路径列表
            room_name: 房间名称

        Returns:
            批处理结果
        """
        batch_result = BatchResult()

        room = Room(
            id=room_name.lower().replace(' ', '_'),
            name=room_name
        )

        for csv_file in files:
            if not csv_file.exists():
                continue

            measurements, parse_validation = parse_csv_file(csv_file)

            if parse_validation.status == ValidationStatus.FAIL:
                batch_result.failed_measurements += 1
                continue

            for measurement in measurements:
                batch_result.total_measurements += 1

                point_name = self._infer_point_name(csv_file, measurement)
                point_id = point_name.lower().replace(' ', '_')

                if point_id not in room.points:
                    room.points[point_id] = MeasurementPoint(
                        id=point_id,
                        name=point_name
                    )

                point = room.points[point_id]

                band = measurement.metadata.get('band', 'unknown')
                point.measurements[band] = measurement

                validation = validate_measurement(measurement, self.validation_config)

                if validation.status == ValidationStatus.FAIL:
                    point.validation = validation
                    batch_result.failed_measurements += 1
                    continue

                metrics = compute_acoustic_metrics(measurement, self.acoustics_config)
                point.metrics[band] = metrics

                batch_result.passed_measurements += 1

        batch_result.rooms[room.id] = room

        return batch_result

    def _find_csv_files(self, directory: Path, recursive: bool) -> List[Path]:
        """查找CSV文件"""
        if recursive:
            return list(directory.rglob('*.csv'))
        else:
            return list(directory.glob('*.csv'))

    def _infer_point_name(self, file_path: Path, measurement: MeasurementData) -> str:
        """从文件和元数据推断测点名称"""
        if 'point' in measurement.metadata:
            return str(measurement.metadata['point'])

        file_name = file_path.stem

        patterns = [
            r'[Pp]oint[_-]?(\d+)',
            r'[Mm]easure[_-]?(\d+)',
            r'[_-](\d+)$',
        ]

        import re
        for pattern in patterns:
            match = re.search(pattern, file_name)
            if match:
                return f"测点{match.group(1)}"

        return file_name


def process_directory(
    directory: Path,
    room_name: Optional[str] = None,
    recursive: bool = False,
    validation_config: Optional[ValidationConfig] = None,
    acoustics_config: Optional[AcousticsConfig] = None
) -> BatchResult:
    """
    处理目录的便捷函数

    Args:
        directory: 目录路径
        room_name: 房间名称
        recursive: 是否递归
        validation_config: 校验配置
        acoustics_config: 声学计算配置

    Returns:
        批处理结果
    """
    processor = BatchProcessor(validation_config, acoustics_config)
    return processor.process_directory(directory, room_name, recursive)
