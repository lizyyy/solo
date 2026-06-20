import os
from typing import List, Optional

from .config import DEFAULT_CONFIG, STABLE_MESSAGES, AttributionConfig
from .models import QuestionRecord, AttributionResult
from .data_loader import DataLoader
from .attribution import SequenceAttribution
from .jump_detector import JumpDetector
from .exporter import ResultExporter


class AttributionPipeline:
    """完整的归因分析流水线"""

    def __init__(
        self,
        config: AttributionConfig = DEFAULT_CONFIG,
        data_loader: Optional[DataLoader] = None,
        attribution: Optional[SequenceAttribution] = None,
        jump_detector: Optional[JumpDetector] = None,
        exporter: Optional[ResultExporter] = None,
    ):
        self.config = config
        self.data_loader = data_loader or DataLoader(config)
        self.attribution = attribution or SequenceAttribution(config)
        self.jump_detector = jump_detector or JumpDetector(config)
        self.exporter = exporter or ResultExporter(config)

    def run(
        self,
        input_file: str,
        output_dir: str,
        base_filename: str = "sequence_error_attribution",
    ) -> AttributionResult:
        """
        运行完整的归因分析流水线
        参数名保持稳定，便于日常脚本调用
        """
        if not os.path.exists(input_file):
            raise FileNotFoundError(
                STABLE_MESSAGES.ERROR_FILE_NOT_FOUND.format(file_path=input_file)
            )

        records = self.data_loader.load_file(input_file)
        records, warnings = self.data_loader.validate_records(records)

        for w in warnings:
            print(f"[警告] {w}")

        records = self.attribution.analyze_batch(records)
        records = self.jump_detector.detect_batch(records)

        result = self.exporter.export_handover_package(
            records=records,
            output_dir=output_dir,
            base_filename=base_filename,
        )

        self.exporter.print_console_summary(result)

        return result

    def run_standalone(
        self,
        records: List[QuestionRecord],
        output_dir: str,
        base_filename: str = "sequence_error_attribution",
    ) -> AttributionResult:
        """
        对已有的记录列表运行分析（不加载文件）
        """
        records, warnings = self.data_loader.validate_records(records)

        for w in warnings:
            print(f"[警告] {w}")

        records = self.attribution.analyze_batch(records)
        records = self.jump_detector.detect_batch(records)

        result = self.exporter.export_handover_package(
            records=records,
            output_dir=output_dir,
            base_filename=base_filename,
        )

        self.exporter.print_console_summary(result)

        return result
